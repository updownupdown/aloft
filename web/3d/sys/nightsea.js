// Night crossings: out of sight of land after dark, steer by the stars. The sky turns about its
// pole, which stands as high above the horizon as you are far from the equator (render.js uPole):
// the pole star due north in the northern half of the world, the Southern Cross pointing to the
// south pole in the other (the real stars, stars.js). Look at a constellation for a moment and
// its stars brighten, with faint lines between them. Skim low over the sea at night and the
// plankton lights where you pass: a soft blue-green furrow spreading behind you, and sparks that
// flash in it and fade (laid on the water as strips and little facets, not points: James 10-24).
import { height, WATER, latAt, coastDist, ih } from '../world.js';
import { CONSTELLATIONS, CENTRES, SPANS, skyDir } from '../stars.js';

// gaze: how long to look before a constellation lights, how fast it comes and goes (s), and how
// near the middle of the view it must be (radians, on top of its own size)
const GAZE = { hold: 1.6, rise: 1.4, fall: 3, near: .2 };
// the plankton: a point of the furrow every `step` m, how long it glows (s), how fast it spreads
// (m/s each side) and how bright; sparks a second (more at speed), how long each flashes (s), size
export const PLANKTON = { step: .7, life: 3.6, spread: 1.1, glow: .42, sparks: 9, sparkLife: [.5, 1.5], spark: [.07, .17], max: 160,
  field: 1.1, fieldR: 10, lit: 6 };   // the glints in the water round you: a grid cell's size, how far, how near you must come (m)

export function nightSeaSystem(G) {
  const b = G.b;
  let lat = 0, sparkT = 0, run = 0, skim = false, skimK = 0;
  let trail = [], sparks = [];   // the furrow: [x, z, age, run]; sparks: [x, z, age, life, turn, size]
  const gaze = new Float32Array(CONSTELLATIONS.length), held = new Float32Array(CONSTELLATIONS.length);
  const named = new Set();
  let lastT = 0;
  G.on('wrap', dx => { for (const g of trail) g[0] += dx; for (const g of sparks) g[0] += dx; });
  G.hud.tip('stars', () => b.state === 'fly' && (G.light.night || 0) > .6 && coastDist(b.p[0], b.p[2]) < -2500,
    'Out of sight of land at night, steer by the stars. North of the equator the pole star stands due north, as high above the sea as you are far from the equator, and the sky turns about it; south of it, the long arm of the Southern Cross points to the south pole of the sky.');
  // which constellation is in the middle of the view, above the horizon, on a clear night
  function lookUp(S) {
    const dt = Math.min(.1, Math.max(0, S.time - lastT)); lastT = S.time;
    const f = [S.look[0] - S.cam[0], S.look[1] - S.cam[1], S.look[2] - S.cam[2]], fl = Math.hypot(...f) || 1;
    let pick = -1, best = 1;
    // (not while asleep: the view looks up at the turning sky)
    if ((S.night || 0) > .5 && (S.overcast || 0) < .5 && !b.asleep) for (let i = 0; i < CENTRES.length; i++) {
      const c = skyDir(CENTRES[i], S.pole, S.starA || 0); if (c[1] < .1) continue;
      const a = Math.acos(Math.min(1, (f[0] * c[0] + f[1] * c[1] + f[2] * c[2]) / fl)) / (GAZE.near + SPANS[i] * .6);
      if (a < best) { best = a; pick = i; }
    }
    let any = false;
    for (let i = 0; i < gaze.length; i++) {
      held[i] = i === pick ? held[i] + dt : 0;
      gaze[i] = held[i] > GAZE.hold ? Math.min(1, gaze[i] + dt / GAZE.rise) : Math.max(0, gaze[i] - dt / GAZE.fall);
      if (gaze[i] > 0) any = true;
      if (gaze[i] > .6 && !named.has(i)) { named.add(i); G.hud.name(CONSTELLATIONS[i].name, 'sleep'); }
    }
    S.gaze = any ? gaze : null;
  }
  // the furrow: a strip down the trail, brightest along its middle and fading to nothing at its
  // edges, widening and dimming with age; then the sparks, small diamonds that flash and fade
  function plankton(S) {
    if (!trail.length && !sparks.length && skimK <= 0) return;
    const P = PLANKTON, out = S.surface ||= [], y = WATER + .04, mid = [.25, 1.5, 1.6], edge = [.1, .6, 1.2];   // (over 1: it glows, the tone curve keeps it from washing out)
    const v = (x, z, c, a) => out.push(x, y, z, c[0], c[1], c[2], a);
    const diamond = (x, z, t, r, col, a) => {
      const c = Math.cos(t), sn = Math.sin(t), p = [[x + c * r, z + sn * r], [x - sn * r * .45, z + c * r * .45], [x - c * r, z - sn * r], [x + sn * r * .45, z - c * r * .45]];
      for (const i of [0, 1, 2, 0, 2, 3]) v(p[i][0], p[i][1], col, a);
    };
    // the glints: the sea is full of them, each lighting as you come near (so the water ahead of you
    // and under your wings wakes up as you pass, where the view can see it) and dimming behind
    if (skimK > 0) {
      const C = P.field, n = Math.ceil(P.fieldR / C), gx0 = Math.floor(b.p[0] / C), gz0 = Math.floor(b.p[2] / C), dim = [.12, .75, 1.1];
      for (let gz = gz0 - n; gz <= gz0 + n; gz++) for (let gx = gx0 - n; gx <= gx0 + n; gx++) {
        if (ih(gx, gz, 731) > .7) continue;
        const x = (gx + ih(gx, gz, 732)) * C, z = (gz + ih(gx, gz, 733)) * C, d = Math.hypot(x - b.p[0], z - b.p[2]);
        if (d > P.fieldR) continue;
        const near = Math.max(0, 1 - d / P.lit), tw = .5 + .5 * Math.sin(G.t * (1.3 + ih(gx, gz, 734) * 2) + gx * 3.1 + gz);
        const a = skimK * (near * near * .95 + .22 * tw) * (1 - d / P.fieldR);
        if (a > .02) diamond(x, z, ih(gx, gz, 735) * 3.14, .05 + ih(gx, gz, 736) * .07 + near * .06, near > .3 ? [.4, 1.7, 1.9] : dim, Math.min(1, a));
      }
    }
    const k = a => Math.min(1, a * 5) * (1 - a / P.life) ** 1.5 * P.glow;
    for (let i = 0; i + 1 < trail.length; i++) {
      const A = trail[i], B = trail[i + 1]; if (A[3] !== B[3]) continue;
      const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const wa = .3 + A[2] * P.spread, wb = .3 + B[2] * P.spread, ka = k(A[2]), kb = k(B[2]);
      for (const s of [-1, 1]) {
        const ax = A[0] + nx * wa * s, az = A[1] + nz * wa * s, bx = B[0] + nx * wb * s, bz = B[1] + nz * wb * s;
        v(A[0], A[1], mid, ka); v(B[0], B[1], mid, kb); v(bx, bz, edge, 0);
        v(A[0], A[1], mid, ka); v(bx, bz, edge, 0); v(ax, az, edge, 0);
      }
    }
    for (const [x, z, a, l, t, r] of sparks) diamond(x, z, t, r, [.5, 1.8, 1.9], Math.min(1, a * 9) * (1 - a / l) ** 2 * (.75 + .25 * Math.sin(G.t * 23 + x * 7)) * .95);
  }
  return {
    id: 'nightsea',
    dbg: () => ({ trail: trail.length, sparks: sparks.length, skim }),   // (debug)
    update(dt) {
      lat = latAt(b.p[0], b.p[2]);
      const P = PLANKTON;
      for (const g of trail) g[2] += dt;
      for (const g of sparks) g[2] += dt;
      trail = trail.filter(g => g[2] < P.life); sparks = sparks.filter(g => g[2] < g[3]);
      // the plankton: skimming low over the sea at night
      const was = skim;
      skim = (G.light.night || 0) > .5 && b.state === 'fly' && b.p[1] - WATER < 3.2 && height(b.p[0], b.p[2]) < -1;
      skimK = Math.max(0, Math.min(1, skimK + (skim ? dt * 1.5 : -dt * .8)));
      if (!skim) { if (was) run++; return; }
      const last = trail[trail.length - 1];
      if (!last || last[3] !== run || Math.hypot(b.p[0] - last[0], b.p[2] - last[1]) > P.step) { if (trail.length < P.max) trail.push([b.p[0], b.p[2], 0, run]); }
      sparkT += dt * P.sparks * (1 + (b.s || 0) * .12);
      for (; sparkT > 1; sparkT--) {
        if (sparks.length >= P.max) continue;
        // in the furrow, mostly along its spreading edges
        const g = trail[Math.max(0, trail.length - 1 - Math.floor(Math.random() * Math.min(trail.length, 12)))];
        const w = (.3 + g[2] * P.spread) * (Math.random() < .7 ? (Math.random() < .5 ? -1 : 1) : (Math.random() - .5)), a = Math.random() * 6.283;
        sparks.push([g[0] + Math.cos(a) * w, g[1] + Math.sin(a) * w, 0, P.sparkLife[0] + Math.random() * (P.sparkLife[1] - P.sparkLife[0]), Math.random() * 3.14, P.spark[0] + Math.random() * (P.spark[1] - P.spark[0])]);
      }
      if (!G.flags.plankton) { G.flags.plankton = 1; G.hud.glint('Plankton', 'The sea glows where you skim it: plankton, lit by your passing.', 'how'); }
    },
    scene(S) {
      const r = lat * Math.PI / 180;
      S.pole = [0, Math.sin(r), -Math.cos(r)];
      lookUp(S);
      plankton(S);
    },
  };
}
