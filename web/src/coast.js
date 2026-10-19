// The coast: two thirds of the way south the land ends in sea cliffs, and an arm of the sea lies
// between them and the cliffs on the far side. The sea wind meets the cliff faces and rises up
// them, so you can hang along the edge without a wingbeat. Swells roll in and break white at the
// cliff feet, spray rises off them, and gulls wheel along the edge, calling.
import { TAU, clamp, smooth, hash, C, mix, shade } from './util.js';
import * as W from './world.js';
import { wash, stroke, ellP, circP, stamp, put, lift } from './paint.js';
import { sight } from './guide.js';

const { BAY } = W;
const edges = [BAY.c - BAY.w, BAY.c + BAY.w];
export const nearCoast = x => Math.abs(x - BAY.c) < BAY.w + 900;

// cliff lift: the sea breeze piles up against each face and rises, strongest just off the edge
// and up to a couple of hundred units over the cliff top
const top = x => W.groundY(Math.round(x));
function cliffLift(x, y) {
  const d = Math.abs(x - BAY.c) - BAY.w;   // distance inland from the nearest cliff edge
  if (d < -150 || d > 300) return 0;
  const lip = top(BAY.c + Math.sign(x - BAY.c) * (BAY.w + 12)), up = lip - y;
  if (up < -110 || up > 280) return 0;
  return 34 * smooth(-150, -50, d) * (1 - smooth(140, 300, d)) * smooth(-110, -40, up) * (1 - smooth(180, 280, up));
}
W.extraLifts.push(cliffLift);

export const createCoast = () => ({ gulls: [], callT: 3, here: false });
export function updateCoast(G, dt, { once, audio }) {
  const S = G.coast, b = G.bird, here = nearCoast(b.x);
  if (here && !S.here && Math.abs(b.x - BAY.c) < BAY.w + 400) {
    if (!G.found.coast) { G.found.coast = { name: BAY.name, x: BAY.c, note: `Found on day ${G.day}` }; audio.learned?.(); }
    once('coast5', 'The sea. Wind off the water rises up the cliff faces: hang along the edge without a wingbeat, then cross to the far cliffs.', 7);
  }
  S.here = here || (S.here && nearCoast(b.x));
  // the gulls keep to the cliffs, a few over each edge, wheeling on the updraft
  if (here && !S.gulls.length) for (let i = 0; i < 9; i++) {
    const e = edges[i % 2], s = Math.random() * 99;
    S.gulls.push({ e, s, ph: Math.random() * TAU, r: 40 + Math.random() * 90, x: e, y: top(e + Math.sign(e - BAY.c) * 20) - 40, face: 1, flapT: 0 });
  }
  if (!here) { S.gulls.length = 0; return; }
  for (const g of S.gulls) {
    g.ph += dt * (.25 + (g.s % 1) * .2);
    const out = Math.sign(BAY.c - g.e);   // out over the sea
    const tx = g.e + out * (30 + g.r * (.5 + .5 * Math.sin(g.ph))) + Math.sin(g.ph * 2.3 + g.s) * 30;
    const ty = top(g.e - out * 20) - 30 - g.r * .6 - Math.sin(g.ph * 1.7 + g.s) * 35;
    const vx = (tx - g.x) * .8; g.x += vx * dt; g.y += (ty - g.y) * .8 * dt;
    if (Math.abs(vx) > 3) g.face = vx > 0 ? 1 : -1;
    g.flapT = Math.max(0, g.flapT - dt); if (Math.random() < dt * .08) g.flapT = 1.2;
  }
  // the calls: a laughing "kee-ow" or a short "kek kek", now and then, louder near the cliffs
  if ((S.callT -= dt) <= 0) {
    S.callT = 1.5 + Math.random() * 5;
    const near = 1 - clamp((Math.min(...edges.map(e => Math.abs(b.x - e))) - 100) / 900, 0, 1), vol = .05 * near;
    if (vol > .006) {
      if (Math.random() < .6) { audio.tone?.({ f: 1500, f2: 2300, dur: .12, vol, type: 'sawtooth' }); audio.tone?.({ f: 2200, f2: 1250, dur: .32, vol: vol * .9, type: 'sawtooth', vib: 40, vibF: 18, delay: .13 }); }
      else for (let k = 0; k < 3; k++) audio.tone?.({ f: 1900, f2: 1600, dur: .07, vol: vol * .8, type: 'sawtooth', delay: k * .16 });
    }
    audio.burst?.({ dur: 1.6, vol: .03 * near + .01, f: 700, f2: 250, type: 'lowpass', q: .4 });   // a swell breaking somewhere below
  }
}

// a gull: white body, pale grey wings dipped in black at the tips
function gullArt(frame, P, spx) {
  return stamp('gull' + frame, P.paper.join() + P.birdFar.join(), -16, -10, 12, 6, spx, x => {
    const grey = mix(mix(P.paper, P.birdFar, .45), P.water, .2), white = mix(P.paper, grey, .18), f = frame ? -.45 : 1;
    // long narrow wings swept back, as a gull holds them on the wind
    const wing = [[2.5, -1], [0, -3.5 * f], [-5, -6.5 * f], [-14, -8 * f], [-9, -4.5 * f], [-4, -1]];
    wash(x, wing.map(([a, b]) => [a + 2.5, b * .6]), shade(grey, .9), .45, { passes: 1, amp: .3, seed: 2, rim: .2 });   // the far wing
    wash(x, [[-4, -1], [-10, -1.2], [-10, 1.3], [-4, 1.2]], white, .5, { passes: 1, amp: .2, seed: 3, rim: .25 });
    wash(x, ellP(0, 0, 7, 2.6, 0), white, .55, { passes: 2, amp: .3, seed: 4, rim: .35 });
    wash(x, circP(6.4, -.9, 2.1, 10), white, .55, { passes: 1, amp: .2, seed: 5, rim: .35 });
    stroke(x, [[8.2, -.8], [10.2, -.2]], P.beak, .9, .8, 6);
    wash(x, wing, grey, .6, { passes: 2, amp: .3, seed: 6, rim: .35 });
    wash(x, [[-9, -6.8 * f], [-14, -8 * f], [-10.5, -5.2 * f]], P.birdFar, .85, { passes: 1, amp: .2, seed: 7, rim: .3 });
  });
}

// drawn in the world layer after the ponds: swells, breakers and spray, then the gulls
export function drawCoast(ctx, G, P) {
  const S = G.coast; if (!S?.here) return;
  const x0 = G.cam.x - 20, x1 = G.cam.x + G.view.w + 20, y = W.SEA_Y, t = G.t, a0 = Math.max(x0, edges[0]), a1 = Math.min(x1, edges[1]);
  if (a1 > a0) {
    // the swells: long pale crest lines rolling in toward each cliff, all in one stroke
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = C(P.paper, .75); ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const side = k % 2 ? 1 : -1, ph = ((t * .07 + hash(k * 3.1)) % 1);   // each swell travels from mid-sea to the cliff
      const xc = BAY.c + side * BAY.w * (.1 + .9 * ph), len = 14 + 26 * hash(k * 5.7), yy = y + 1.5 + (k % 3) * 2.2;
      if (xc < a0 - 40 || xc > a1 + 40) continue;
      ctx.moveTo(xc - len / 2, yy); ctx.quadraticCurveTo(xc, yy - 1.4, xc + len / 2, yy);
    }
    ctx.stroke(); ctx.restore();
    // the breakers at each cliff foot: white water rising and falling, with spray thrown up the face
    for (const e of edges) {
      if (e < x0 - 60 || e > x1 + 60) continue;
      const out = Math.sign(BAY.c - e), surge = .5 + .5 * Math.sin(t * .9 + e);
      const foam = [[e, y - 2 - 6 * surge]];
      for (let i = 0; i <= 10; i++) foam.push([e + out * i * 4.5, y - (1 - i / 10) * (3 + 5 * surge) + Math.sin(t * 3 + i) * .6]);
      foam.push([e + out * 46, y + 2], [e, y + 3]);
      lift(ctx, foam, P.paper, .6 + .25 * surge);
      if (surge > .7) for (let i = 0; i < 4; i++) {
        const k = (surge - .7) / .3, sx = e + out * (4 + i * 5), sy = y - 8 - k * (16 + i * 7) - hash(i + e) * 6;
        lift(ctx, circP(sx, sy, 2.2 + 2 * k, 7), P.paper, .5 * (1 - k * .6));
      }
    }
  }
  const sp = G.view.spx;
  for (const g of S.gulls) {
    if (g.x < x0 - 20 || g.x > x1 + 20) continue;
    const frame = g.flapT > 0 && Math.sin(g.flapT * 18) < 0 ? 1 : 0;
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.face * 1.35, 1.35);
    put(ctx, gullArt(frame, P, sp * 1.9), .95);
    ctx.restore();
    sight(G, 'gull', g.x, g.y, 10);
  }
}

export const coastDebug = (G, { fresh, snap }) => ({
  coast() { const b = G.bird; fresh(); b.state = 'fly'; b.x = edges[0] - 120; b.y = top(edges[0] - 20) - 70; b.s = 80; b.face = 1; snap(); return BAY; },
});
