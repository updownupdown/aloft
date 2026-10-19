// Ghost flights: the way you flew over each stretch of land is kept, and when you come back
// over it on another day, going the same way, a faint painted hawk flies it again beside you,
// from the moment you both cross into it. Race your past self, or follow it to where it went.
// The land is cut into cells; each keeps the latest pass in each direction, a short list of
// [seconds since entering the cell, x, y, flags] sampled every few dozen units. All on the device.
import { clamp, lerp } from './util.js';
import * as W from './world.js';
import { createBird, pose } from './bird.js';

const CELL = 600, MAX_PTS = 80, SAMPLE = 22, KEEP_CELLS = 140;
const FLAP = 1, SIT = 2;
const cellOf = x => Math.floor(x / CELL);

export function createGhosts(store) {
  const saved = store.get('ghosts', null);
  return { cells: saved?.seed === W.seed.v ? saved.cells : {}, rec: null, play: null, saveT: 0, store, on: store.get('ghostOn', true) };
}

/* ---------- recording ---------- */
function finishCell(G, R) {
  const H = G.ghosts;
  if (R.pts.length < 3 || !R.crossed) return;   // only a full crossing makes a ghost worth racing
  H.cells[R.dir + ':' + R.cell] = { day: G.day, j: G.journeys, pts: R.pts };
  const keys = Object.keys(H.cells);
  if (keys.length > KEEP_CELLS) { keys.sort((a, b) => H.cells[a].day - H.cells[b].day); delete H.cells[keys[0]]; }
  if (G.t - H.saveT > 15) { H.saveT = G.t; H.store.set('ghosts', { seed: W.seed.v, cells: H.cells }); }
}
function record(G) {
  const H = G.ghosts, b = G.bird, c = cellOf(b.x);
  let R = H.rec;
  if (R && R.cell !== c) {
    // crossing the far edge in the direction of travel completes the cell
    R.crossed = (c - R.cell) === R.dir;
    finishCell(G, R); R = null;
  }
  if (!R) {
    const dir = b.vx > 0 ? 1 : -1;
    R = H.rec = { cell: c, dir, t0: G.t, pts: [], lx: -1e9, ly: 0, lt: -9, crossed: false };
    // a cell only counts if you entered it from its near edge
    R.fromEdge = Math.abs(b.x - (dir > 0 ? c * CELL : (c + 1) * CELL)) < 60;
  }
  if (!R.fromEdge) return;
  const flags = (b.state !== 'fly' ? SIT : 0) | (b.flapAmt > .5 ? FLAP : 0), t = G.t - R.t0;
  if (Math.hypot(b.x - R.lx, b.y - R.ly) > SAMPLE || t - R.lt > 1.5 || flags !== R.lf) {
    if (R.pts.length >= MAX_PTS) { R.pts = R.pts.filter((_, i) => i % 2 === 0); }   // a long stay: keep every other point
    R.pts.push([Math.round(t * 10) / 10, Math.round(b.x), Math.round(b.y), flags]);
    R.lx = b.x; R.ly = b.y; R.lt = t; R.lf = flags;
  }
}

/* ---------- playback ---------- */
function startCell(G, dir, cell, chainDay) {
  const seg = G.ghosts.cells[dir + ':' + cell];
  if (!seg || seg.day === G.day && seg.j === G.journeys) return null;
  if (chainDay !== undefined && seg.day !== chainDay) return null;
  return { seg, dir, cell, t: 0 };
}
function sampleAt(pts, t) {
  let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < t) i++;
  const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 1;
  return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), flags: (u < .5 ? a : b)[3], done: t >= pts[pts.length - 1][0] };
}
export function updateGhost(G, dt, { once }) {
  const H = G.ghosts, b = G.bird;
  if (!H) return;
  record(G);
  if (!H.on) { H.play = null; return; }
  const c = cellOf(b.x), dir = b.vx > 0 ? 1 : -1;
  // you cross into a cell your past self crossed the same way on another day: off you both go
  if (!H.play && b.state === 'fly' && H.rec?.fromEdge && G.t - H.rec.t0 < .5) {
    const p = startCell(G, dir, c);
    if (p) {
      H.play = p; p.bird = createBird(p.seg.pts[0][1], p.seg.pts[0][2]); p.bird.kind = 'ghost'; p.fade = 0;
      once('ghost', 'A ghost of your own flight, the last time you came this way. Race it, or follow it.', 5);
    }
  }
  const P = H.play; if (!P) return;
  P.t += dt;
  let q = sampleAt(P.seg.pts, P.t);
  if (q.done) {
    // on into the next cell, if the same day's flight went on that way
    const next = startCell(G, P.dir, P.cell + P.dir, P.seg.day);
    if (next) { Object.assign(P, { seg: next.seg, cell: next.cell, t: 0 }); q = sampleAt(P.seg.pts, 0); }
    else P.ending = true;
  }
  const g = P.bird, vx = (q.x - g.x) / Math.max(dt, 1e-3), vy = (q.y - g.y) / Math.max(dt, 1e-3);
  g.x = q.x; g.y = q.y;
  if (Math.abs(vx) > 4) g.face = vx > 0 ? 1 : -1;
  g.state = q.flags & SIT ? 'perch' : 'fly';
  g.s = Math.hypot(vx, vy); g.vx = vx; g.vy = vy; g.g = Math.atan2(-vy, Math.abs(vx) + 1);
  if (q.flags & FLAP && g.flapLeft <= 0) g.flapLeft = 1;
  g.air = q.flags & FLAP ? 0 : 30;
  pose(g, dt, G);
  // it fades in, and out again at the end, or once it is far out of sight
  const far = Math.abs(g.x - b.x) > G.view.w * 1.5;
  P.fade = clamp(P.fade + (P.ending || far ? -dt : dt) / 1.5, 0, 1);
  if ((P.ending || far) && P.fade <= 0) H.play = null;
}
export const ghostBird = G => G.ghosts?.play?.fade > 0 ? G.ghosts.play : null;
export function saveGhosts(G) { const H = G.ghosts; if (H) H.store.set('ghosts', { seed: W.seed.v, cells: H.cells }); }
export function setGhosts(G, on) { G.ghosts.on = on; G.ghosts.store.set('ghostOn', on); }

// for the console: lay down a made-up pass over the next cell, from yesterday, and fly into it
export function ghostDebug(G, { fresh, snap }) {
  return {
    ghost() {
      const b = G.bird, c = cellOf(b.x) + 1, x0 = c * CELL, pts = [];
      for (let i = 0; i <= 40; i++) { const x = x0 + i * CELL / 40; pts.push([i * .45, x, W.groundY(x) - 150 - Math.sin(i * .3) * 40, i % 6 < 2 ? FLAP : 0]); }
      for (let k = 1; k < 4; k++) G.ghosts.cells[`1:${c + k}`] = { day: -1, j: G.journeys, pts: pts.map(p => [p[0], p[1] + k * CELL, p[2], p[3]]) };
      G.ghosts.cells[`1:${c}`] = { day: -1, j: G.journeys, pts };
      fresh(); b.state = 'fly'; b.x = x0 - 30; b.y = W.groundY(x0) - 150; b.s = 85; b.vx = 85; b.face = 1; b.g = -.1; snap();
    },
  };
}
