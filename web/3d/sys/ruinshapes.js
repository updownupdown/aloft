// The meshes of the abandoned places (settle.js says where they stand): stone cottages and
// farmhouses in three states of decay, a barn, a chapel with its tower, a well, a still wind
// pump with broken vanes, a cart with a wheel off, an upturned boat, the old bridges, and the
// small things people left behind (ARTEFACTS). No lit windows anywhere: the glass is dark.
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';
import { DIM, WALL_LEFT } from '../settle.js';

const STONE = [[.6, .58, .53], [.54, .52, .48], [.66, .63, .57]], MOSS = [.44, .5, .33], MOSS2 = [.38, .46, .3];
const SLATE = [.37, .38, .41], SLATE2 = [.31, .33, .36], DARK = [.11, .11, .12], WOOD = [.45, .39, .32], WOOD2 = [.37, .32, .27];
const IVY = [.3, .44, .26], IVY2 = [.36, .5, .28];

// a box from its middle bottom, l long (along x), h high, w wide, turned a
export function box(B, x, y, z, l, h, w, a, col, top = col) {
  const c = Math.cos(a), s = Math.sin(a), P = (u, v, t) => [x + c * u - s * t, y + v, z + s * u + c * t];
  const q = (p0, p1, p2, p3, k) => { B.tri(p0, p1, p2, k, (rnd() - .5) * .06); B.tri(p0, p2, p3, k, (rnd() - .5) * .06); };
  const L = l / 2, W = w / 2;
  q(P(-L, 0, -W), P(L, 0, -W), P(L, h, -W), P(-L, h, -W), col); q(P(L, 0, W), P(-L, 0, W), P(-L, h, W), P(L, h, W), col);
  q(P(-L, 0, W), P(-L, 0, -W), P(-L, h, -W), P(-L, h, W), col); q(P(L, 0, -W), P(L, 0, W), P(L, h, W), P(L, h, -W), col);
  q(P(-L, h, -W), P(L, h, -W), P(L, h, W), P(-L, h, W), top);
}
const quad = (B, a, b, c, d, col) => { B.tri(a, b, c, col, (rnd() - .5) * .08); B.tri(a, c, d, col, (rnd() - .5) * .08); };
const pick = a => a[Math.floor(rnd() * a.length)];

// a wall from (x0, z0) to (x1, z1), t thick, h high; ragged: its top broken into steps of
// uneven height (a ruin), with gaps for a door or window cut by `holes` ([from, to] along it, 0..1)
function wall(B, x0, z0, x1, z1, y0, h, t, cols, ragged = 0, holes = []) {
  const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(L / 1.6));
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n, um = (u0 + u1) / 2;
    if (holes.some(([p, q]) => um > p && um < q)) continue;
    const hh = ragged ? h * (1 - ragged * (.25 + .75 * rnd()) * (.6 + .4 * Math.sin(i * 1.7 + x0))) : h;
    box(B, x0 + (x1 - x0) * um, y0, z0 + (z1 - z0) * um, L / n + .02, hh - y0, t, a, pick(cols), rnd() < .3 ? MOSS : pick(cols));
  }
}
// a dark pane of glass or an empty doorway, set into the wall face (local x along the wall)
function opening(B, x, y, z, a, w, h, col = DARK) { box(B, x, y, z, w, h, .06, a, col); }
// ivy climbing a wall corner: a few flattened tufts
function ivy(B, x, y, z, h) {
  for (let k = 0; k < 4; k++) blob(B, x + (rnd() - .5) * .6, y + k * h / 4 + .3, z + (rnd() - .5) * .6, .55 + rnd() * .3, IVY, IVY2, [1, .9, 1]);
}

// a house: four walls (doors on +z), gables, and a roof by variant v (0 whole but sagging and
// mossy, 1 fallen in on one side with the rafters showing, 2 no roof, walls broken down)
function house(o) {
  const { L, W, wall: H, ridge: R } = o.d, v = o.v, B = builder(), t = .42, l = L / 2, w = W / 2, cols = o.cols;
  const ragged = v === 2 ? 1 - WALL_LEFT[2] : 0, y0 = -1.2;
  // walls: front (+z) with the door and windows, back, two gable ends
  const door = o.doorAt ?? 0, dw = .55 / L;
  wall(B, -l, w, l, w, y0, H, t, cols, ragged, [[.5 + door - dw, .5 + door + dw]]);
  wall(B, -l, -w, l, -w, y0, H, t, cols, ragged);
  wall(B, -l, -w, -l, w, y0, H, t, cols, ragged);
  wall(B, l, -w, l, w, y0, H, t, cols, ragged);
  // the doorway, dark inside; windows dark (never lit), one or two rows
  opening(B, (door) * L, -.2, w + .2, 0, 1.05, 2.2);
  const rows = H > 4.5 ? [1.1, 3.6] : [1.1];
  for (const y of rows) for (const u of o.windows) {
    if (v === 2 && y > H * WALL_LEFT[2] - 1.4) continue;
    opening(B, u * L, y, w + .2, 0, .8, 1, rnd() < .3 ? [.16, .18, .2] : DARK); opening(B, u * L, y, -w - .2, 0, .8, 1);
  }
  if (v < 2) {
    // gables
    for (const k of [-1, 1]) { const x = k * l; B.tri([x, H, -w], [x, H, w], [x, R - .3, 0], pick(cols)); }
    const sag = .3, slope = (k, s, e, col) => {   // a strip of one roof slope, s..e along it
      const P = (u, top) => [u, top ? R - (Math.sin(Math.PI * (u / L + .5)) * sag) : H - .25, (top ? 0 : (w + .45)) * k];
      quad(B, P(s, 0), P(e, 0), P(e, 1), P(s, 1), col);
    };
    const N = 6;
    for (const k of [-1, 1]) for (let i = 0; i < N; i++) {
      const s = -l - .3 + (L + .6) * i / N, e = -l - .3 + (L + .6) * (i + 1) / N;
      if (v === 1 && (k > 0 ? i > 0 && i < N - 1 : rnd() < .5)) {   // fallen in: rafters left
        tube(B, [(s + e) / 2, H - .1, (w + .3) * k], [(s + e) / 2, R - .4, 0], .07, WOOD2);
        continue;
      }
      slope(k, s, e, rnd() < (o.moss ?? .3) ? (rnd() < .5 ? MOSS : MOSS2) : (rnd() < .5 ? o.roof[0] : o.roof[1]));
    }
    if (v === 1) tube(B, [-l, R - .4, 0], [l, R - .4, 0], .09, WOOD2);   // the ridge beam
    if (o.chimney !== false && v === 0) box(B, l - .5, H, 0, .7, R - H + 1, .7, 0, pick(cols));
  } else {
    // rubble fallen inside and out
    for (let k = 0; k < 7; k++) box(B, (rnd() - .5) * L * 1.1, -.3, (rnd() - .5) * W * 1.3, .4 + rnd() * .4, .3 + rnd() * .3, .3 + rnd() * .4, rnd() * 6, pick(cols), rnd() < .4 ? MOSS : pick(cols));
  }
  ivy(B, l - .2, 0, w - .2, Math.min(H, 3) * (v === 2 ? .7 : 1));
  if (rnd() < .6) ivy(B, -l + .2, 0, -w + .2, H * .8);
  return B.out();
}
export const cottage = v => { reseed(301 + v); return house({ d: DIM.cottage, v, cols: STONE, roof: [SLATE, SLATE2], windows: [-.28, .28] }); };
export const keeper = v => { reseed(311 + v); return house({ d: DIM.keeper, v, cols: [[.86, .85, .8], [.82, .81, .77], [.88, .87, .83]], roof: [[.3, .3, .32], [.26, .26, .28]], windows: [-.3, .3], moss: .15 }); };
export const hut = v => { reseed(321 + v); return house({ d: DIM.hut, v, cols: STONE, roof: [SLATE, SLATE2], windows: [.3], chimney: false }); };
export function farmhouse(v) {
  reseed(331 + v);
  const B = house({ d: DIM.farmhouse, v, cols: [[.74, .7, .62], [.7, .66, .58], [.77, .73, .66]], roof: [SLATE, SLATE2], windows: [-.33, .33], moss: .35 });
  // the porch over the door: two posts and a lean-to roof, sagging
  const P = builder(); reseed(335 + v);
  for (const k of [-1, 1]) tube(P, [k * 1.3, -.2, 5.4], [k * 1.3, 2.6 - (k > 0 && v ? .5 : 0), 5.4], .07, WOOD);
  if (v < 2) quad(P, [-1.6, 2.5, 5.6], [1.6, 2.6 - (v ? .6 : 0), 5.6], [1.6, 3, 3.5], [-1.6, 3, 3.5], WOOD2);
  const a = new Float32Array(B.length + P.out().length); a.set(B); a.set(P.out(), B.length); return a;
}

// an old barn: faded red boards, a grey roof (v 1: half its sheets gone, the trusses bare)
export function barn(v) {
  reseed(341 + v); const B = builder(), red = [.55, .3, .24], red2 = [.48, .27, .22], roof = [.42, .42, .44], roof2 = [.36, .36, .38], white = [.8, .78, .72];
  box(B, 0, -1, 0, 12, 6, 8, 0, red);
  for (const k of [-1, 1]) B.tri([6.02 * k, 5, -4], [6.02 * k, 5, 4], [6.02 * k, 8.2, 0], red2);
  for (const k of [-1, 1]) for (let i = 0; i < 6; i++) {
    const s = -6.4 + i * 12.8 / 6, e = s + 12.8 / 6;
    if (v && k > 0 && i > 0 && i < 5 && i !== 3) { tube(B, [(s + e) / 2, 4.8, 4.2], [(s + e) / 2, 8.2, 0], .08, WOOD2); continue; }
    const P = (u, top) => [u, top ? 8.3 : 4.8, top ? 0 : 4.4 * k], col = rnd() < .25 ? [.5, .36, .28] : (k > 0 ? roof : roof2);   // rust on some sheets
    quad(B, P(s, 0), P(e, 0), P(e, 1), P(s, 1), col);
  }
  box(B, 6.04, -.4, 0, .05, 4, 3.2, 0, DARK); box(B, 6.06, 3.7, 0, .06, .2, 3.4, 0, white);   // the doorway and its lintel
  box(B, 6.9, -.1, 1.1, 1.8, .12, 1.4, .3, WOOD2);                                              // a door leaf fallen in the grass
  box(B, -6.04, 5.2, 0, .05, 1.2, 1.2, 0, DARK);
  box(B, 0, 8.2, 0, 13, .2, .3, 0, roof2);
  ivy(B, -5.8, 0, 3.8, 4);
  return B.out();
}
// a stone chapel: the nave (door on +x), a square tower at the west end with open belfry arches
// and a crenellated top, tall dark windows
export function chapel(v) {
  reseed(351 + v);
  const d = DIM.chapel, nave = house({ d, v, cols: STONE, roof: [SLATE, SLATE2], windows: [-.3, 0, .3], chimney: false, doorAt: .35 });
  const B = builder(), tx = -d.L / 2 - 2, cols = STONE;
  box(B, tx, -1.2, 0, 4, 13.2, 4, 0, pick(cols));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; opening(B, tx + Math.cos(a) * 2.03, 9.2, Math.sin(a) * 2.03, a + Math.PI / 2, 1, 1.8); }
  for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(B, tx + i * 1.65, 12, j * 1.65, .7, 1, .7, 0, pick(cols), MOSS);
  opening(B, d.L / 2 + .22, -.2, 0, Math.PI / 2, 1.4, 2.8);   // the west door, in the +x end
  for (const y of [2, 5]) opening(B, tx - 2.03, y, 0, Math.PI / 2, .5, 1.3);
  ivy(B, tx + 1.8, 0, 1.8, 6);
  const o = B.out(), a = new Float32Array(nave.length + o.length); a.set(nave); a.set(o, nave.length); return a;
}
export function well() {
  reseed(361); const B = builder();
  prism(B, 0, 0, .95, .9, -.4, .75, 10, STONE[0]);
  prism(B, 0, 0, .7, .7, .5, .76, 10, DARK);                       // the dark water far down
  for (const k of [-1, 1]) box(B, k * .85, .7, 0, .14, 1.5, .14, 0, WOOD);
  tube(B, [-.85, 2, 0], [.85, 2, 0], .06, WOOD2);
  for (const k of [-1, 1]) quad(B, [-1.1, 2.05, 0], [1.1, 2.05, 0], [1.1, 1.75, .75 * k], [-1.1, 1.75, .75 * k], k > 0 ? SLATE : MOSS);
  return B.out();
}
// a farm wind pump, long still: the wheel jammed with half its vanes gone, the tail bent
export function pump() {
  reseed(371); const B = builder(), iron = [.42, .4, .38], iron2 = [.5, .46, .42], rust = [.55, .35, .24];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of legs) tube(B, [i * 1.5, -.5, j * 1.5], [i * .35, 11, j * .35], .06, iron);
  for (let k = 0; k < 4; k++) { const [i, j] = legs[k], [i2, j2] = legs[(k + 1) % 4]; for (const y of [2, 5, 8]) { if (k === 2 && y === 5) continue; const r = 1.5 - y / 11.5 * 1.15; tube(B, [i * r, y, j * r], [i2 * r, y, j2 * r], .035, iron2); } }
  box(B, 0, 10.9, 0, 1.3, .15, 1.3, 0, rust);
  tube(B, [0, 11.6, 0], [-2.4, 11.9, .5], .05, iron);
  B.tri([-1.7, 11.5, .4], [-2.8, 12.6, .8], [-2.9, 11.4, .7], rust);
  tube(B, [0, 11, 0], [.35, 11.6, 0], .08, iron);
  for (let i = 0; i < 12; i++) {
    if ([1, 2, 5, 8, 9].includes(i)) continue;
    const a = (i + .3) / 12 * 6.283, b = a + .32, c = Math.cos, s = Math.sin, len = i === 4 ? 1.1 : 1.9, col = i & 1 ? [.6, .52, .44] : rust;
    B.tri([.4, 11.6 + c(a) * .35, s(a) * .35], [.5, 11.6 + c(a) * len, s(a) * len], [.5, 11.6 + c(b) * len, s(b) * len], col);
    B.tri([.4, 11.6 + c(a) * .35, s(a) * .35], [.5, 11.6 + c(b) * len, s(b) * len], [.4, 11.6 + c(b) * .35, s(b) * .35], col);
  }
  return B.out();
}
// a wooden cart, one wheel off and lying in the grass, its shafts down
export function cart() {
  reseed(381); const B = builder();
  box(B, 0, .55, 0, 2.6, .12, 1.4, 0, WOOD);
  for (const k of [-1, 1]) box(B, 0, .67, k * .68, 2.6, .4, .08, 0, WOOD2);
  box(B, -1.28, .67, 0, .08, .4, 1.4, 0, WOOD2);
  for (const k of [-1, 1]) tube(B, [1.3, .6, k * .45], [2.9, .02, k * .5], .05, WOOD2);
  const wheel = (cx, cy, cz, flat) => {
    const P = a => flat ? [cx + Math.cos(a) * .55, cy, cz + Math.sin(a) * .55] : [cx + Math.cos(a) * .55, cy + Math.sin(a) * .55, cz];
    for (let i = 0; i < 10; i++) tube(B, P(i / 10 * 6.283), P((i + 1) / 10 * 6.283), .05, WOOD2);
    for (let i = 0; i < 5; i++) tube(B, [cx, cy, cz], P(i / 5 * 6.283 + .3), .03, WOOD);
  };
  wheel(0, .55, .8, false);
  wheel(.8, .05, -1.6, true);
  box(B, 0, -.1, -.8, .3, .55, .2, 0, WOOD2);   // the bare axle end propped on a stone
  return B.out();
}
// a rowing boat turned over on the shore, its paint faded
export function boat() {
  reseed(391); const B = builder();
  blob(B, 0, .05, 0, 2, [.33, .46, .5], [.4, .38, .34], [1, .3, .36], 1);
  box(B, 0, -.1, 0, 4, .12, .1, 0, WOOD2);
  return B.out();
}
// a stone bridge over a river, laid along its ends (world coordinates from the middle, y absolute):
// an arch under a level deck, parapets, and on a broken one the middle fallen into the water
export function bridge(g) {
  reseed(401); const B = builder(), mx = (g.x0 + g.x1) / 2, mz = (g.z0 + g.z1) / 2, yaw = Math.atan2(g.z1 - g.z0, g.x1 - g.x0);
  const half = Math.hypot(g.x1 - g.x0, g.z1 - g.z0) / 2 + 3, n = Math.max(6, Math.round(half / .9)), seg = half * 2 / n, c = Math.cos(yaw), s = Math.sin(yaw);
  const at = u => [c * u, s * u];
  for (let i = 0; i < n; i++) {
    const u = -half + (i + .5) * seg, f = u / half;
    if (g.broken && Math.abs(f) < .22) continue;
    const under = g.y - 1 - (g.y - 1.6) * (1 - f * f) * .85, [px, pz] = at(u);
    box(B, px, under, pz, seg + .03, g.y - under, 3.6, yaw, pick(STONE), rnd() < .2 ? MOSS : [.52, .5, .46]);
    // parapets, crumbled near a break
    const gone = g.broken && Math.abs(f) < .34;
    for (const k of [-1.65, 1.65]) if (!gone || rnd() < .3) box(B, px - s * k, g.y, pz + c * k, seg + .03, .75 - (gone ? .4 : 0), .3, yaw, pick(STONE), rnd() < .3 ? MOSS : pick(STONE));
  }
  // the abutments run down into the banks
  for (const k of [-1, 1]) { const [px, pz] = at(k * (half - 1.5)); box(B, px, g.y - 6, pz, 3, 6, 4.2, yaw, STONE[1]); }
  if (g.broken) for (let k = 0; k < 6; k++) { const [px, pz] = at((rnd() - .5) * half * .5); box(B, px + (rnd() - .5) * 2, -1.8, pz + (rnd() - .5) * 2, .8, 1.4, .7, rnd() * 6, pick(STONE), MOSS); }
  return { tris: B.out(), at: [mx, mz] };   // x, z about the middle, y as is
}

// ---- the things people left ------------------------------------------------------------------
// trinkets turn up anywhere people lived; treasures are one of a kind, each where it belongs
export const TRINKETS = {
  bottle: 'a blue glass bottle', shard: 'a shard of blue and white china', button: 'a brass button', spoon: 'a tarnished spoon',
  marble: 'an amber glass marble', key: 'an old iron key', thimble: 'a silver thimble', bead: 'a red glass bead',
  ribbon: 'a faded red ribbon', coin: 'a worn copper coin', cap: 'a red bottle cap',
};
// [name, where it lies (settlement kinds), the story it tells]
export const TREASURES = {
  lens: ['A prism from the great lens', ['light'], 'A wedge of cut glass from the lighthouse lamp. When the sun is low it throws small rainbows.'],
  lampkey: ['The lamp room key', ['light'], 'A brass key on a tag worn smooth by a keeper’s thumb. The lamp it opened has been dark a long time.'],
  bell: ['The chapel handbell', ['village'], 'A little bronze bell with a wooden handle. It still rings, thin and clear.'],
  locket: ['A silver locket', ['village'], 'Inside, two faces, too worn now to make out.'],
  watch: ['A pocket watch', ['village', 'farm'], 'Stopped at ten past four, on some day nobody remembers.'],
  teacup: ['A blue and white teacup', ['village', 'hamlet'], 'Its handle is gone, but the painted birds on it are still flying.'],
  horseshoe: ['A lucky horseshoe', ['farm'], 'Once nailed over a barn door, ends up, so the luck would not run out.'],
  whistle: ['A tin whistle', ['farm', 'fold'], 'A child’s. The wind sometimes finds a note in it.'],
  float: ['A green glass float', ['hamlet'], 'It held up a fishing net once. Still whole, still sea-green.'],
  sheepbell: ['A sheep bell', ['fold'], 'Copper, on a cracked leather strap. The hills were full of these once.'],
  spyglass: ['A fire watcher’s spyglass', ['watch'], 'Brass, the lens a little cloudy. Someone up here watched the woods for smoke, every summer.'],
};
const GLASS = [.36, .55, .72], CHINA = [.92, .91, .87], BLUE = [.3, .42, .7], BRASS = [.8, .64, .3], SILVER = [.78, .78, .76], IRON = [.36, .32, .3], RED = [.72, .2, .18];
export const ARTEFACT_SHAPES = {
  bottle: B => { prism(B, 0, 0, .07, .07, 0, .22, 8, GLASS); prism(B, 0, 0, .07, .028, .22, .28, 8, GLASS); prism(B, 0, 0, .028, .028, .28, .34, 6, GLASS); },
  shard: B => { B.tri([-.12, .01, -.06], [.12, .01, -.08], [.04, .01, .12], CHINA); B.tri([-.04, .012, -.02], [.06, .012, -.03], [.02, .012, .05], BLUE); },
  button: B => prism(B, 0, 0, .06, .06, 0, .02, 8, BRASS),
  spoon: B => { box(B, 0, 0, 0, .22, .015, .03, 0, SILVER); blob(B, .14, .02, 0, .045, SILVER, [.66, .66, .64], [1.3, .3, 1]); },
  marble: B => blob(B, 0, .045, 0, .045, [.85, .55, .2], [.75, .45, .15]),
  key: B => { box(B, 0, 0, 0, .22, .02, .025, 0, IRON); prism(B, -.13, 0, .045, .045, 0, .02, 6, IRON); box(B, .1, 0, .025, .03, .02, .05, 0, IRON); },
  thimble: B => prism(B, 0, 0, .04, .032, 0, .06, 8, SILVER),
  bead: B => blob(B, 0, .04, 0, .04, RED, [.6, .15, .15]),
  ribbon: B => { quad(B, [-.2, .01, -.02], [0, .01, .02], [0, .01, .06], [-.2, .01, .02], RED); quad(B, [0, .01, .02], [.2, .01, -.03], [.2, .01, .01], [0, .01, .06], [.62, .18, .18]); },
  coin: B => prism(B, 0, 0, .05, .05, 0, .012, 8, [.72, .46, .3]),
  cap: B => prism(B, 0, 0, .05, .05, 0, .02, 10, RED),
  lens: B => { prism(B, 0, 0, .12, .07, 0, .16, 6, [.8, .88, .92]); prism(B, 0, 0, .07, .02, .16, .2, 6, [.88, .94, .96]); },
  lampkey: B => { box(B, 0, 0, 0, .3, .025, .035, 0, BRASS); prism(B, -.18, 0, .06, .06, 0, .025, 8, BRASS); box(B, .13, 0, .03, .04, .025, .07, 0, BRASS); box(B, -.28, 0, .06, .1, .01, .07, .4, [.86, .8, .62]); },
  bell: B => { prism(B, 0, 0, .1, .05, 0, .13, 10, [.66, .5, .28]); tube(B, [0, .13, 0], [0, .26, 0], .022, WOOD); },
  locket: B => { blob(B, 0, .02, 0, .06, SILVER, [.7, .7, .68], [1, .35, 1.2]); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, b = (i + 1) / 8 * 6.283; tube(B, [.1 + Math.cos(a) * .1, .01, Math.sin(a) * .1], [.1 + Math.cos(b) * .1, .01, Math.sin(b) * .1], .006, SILVER); } },
  watch: B => { prism(B, 0, 0, .08, .08, 0, .03, 10, [.82, .66, .32]); prism(B, 0, 0, .065, .065, .03, .034, 10, CHINA); box(B, .02, .035, 0, .05, .004, .008, 0, DARK); },
  teacup: B => { prism(B, 0, 0, .05, .075, 0, .08, 10, CHINA); prism(B, 0, 0, .066, .072, .045, .06, 10, BLUE); },
  horseshoe: B => { for (let i = 0; i < 7; i++) { const a = -.5 + i / 7 * 4.1, b = -.5 + (i + 1) / 7 * 4.1; tube(B, [Math.cos(a) * .11, .02, Math.sin(a) * .11], [Math.cos(b) * .11, .02, Math.sin(b) * .11], .018, IRON); } },
  whistle: B => { tube(B, [-.12, .02, 0], [.12, .02, 0], .022, SILVER); box(B, -.06, .035, 0, .03, .01, .03, 0, DARK); },
  float: B => blob(B, 0, .1, 0, .1, [.42, .62, .5], [.36, .55, .45]),
  sheepbell: B => { prism(B, 0, 0, .07, .05, 0, .1, 6, [.7, .45, .28]); tube(B, [-.06, .11, 0], [.06, .11, 0], .015, [.4, .28, .2]); },
  spyglass: B => { tube(B, [-.18, .03, 0], [.04, .03, 0], .03, BRASS); tube(B, [.04, .03, 0], [.18, .03, 0], .022, BRASS); },
};
export function artefactMesh(kind) { reseed(500 + kind.length); const B = builder(); ARTEFACT_SHAPES[kind](B); return B.out(); }
