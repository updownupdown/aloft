// Landmarks drawn in the world (where they stand is world.js landmarksNear): standing stones,
// cairns, a ruined tower, the lighthouse on the sea cliffs (its lamp turns at night), and
// waterfalls spilling over the cliffs with mist at their feet. The giant oaks and willows are
// trees (world.js treesIn). Finding them, postcards and the journal belong to journey.js.
import { landmarksNear, height, WATER } from '../world.js';
import { mix3 } from '../util.js';
import { builder, blob, prism, reseed } from '../shapes.js';

const STONE = [.6, .59, .56], STONE2 = [.5, .5, .49], MOSS = [.45, .52, .36];

function stones() {
  reseed(61); const B = builder();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, h = 2.6 + (i * 37 % 10) / 10 * 1.8, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
    prism(B, x, z, .55, .42, -.4, h, 4, i % 3 ? STONE : STONE2);
  }
  prism(B, 0, 0, .9, .8, -.3, .5, 5, MOSS);     // the low altar stone
  return B.out();
}
function cairn() {
  reseed(62); const B = builder();
  for (let i = 0; i < 6; i++) blob(B, Math.sin(i * 2.1) * .2, .35 + i * .42, Math.cos(i * 1.7) * .2, .75 - i * .09, STONE, STONE2, [1, .6, 1]);
  return B.out();
}
function tower() {
  reseed(63); const B = builder(), N = 9, W = [.66, .62, .56], D = [.4, .37, .34];
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283, h = 22 - (i * 5 % 7) * 1.6 - (i > 5 ? 6 : 0);
    const p = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    for (const r of [4, 3.3]) { B.tri(p(a0, r, -.5), p(a1, r, -.5), p(a1, r * .92, h), r > 3.5 ? W : D); B.tri(p(a0, r, -.5), p(a1, r * .92, h), p(a0, r * .92, h), r > 3.5 ? W : D); }
    B.tri(p(a0, 3.68, h), p(a1, 3.68, h), p(a1, 3.03, h), W); B.tri(p(a0, 3.68, h), p(a1, 3.03, h), p(a0, 3.03, h), W);
    if (i % 3 === 1) { const y = 9 + i; B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y), p(a0 + .3, 4.02, y + 2), D); B.tri(p(a0 + .2, 4.02, y), p(a0 + .3, 4.02, y + 2), p(a0 + .2, 4.02, y + 2), D); }
  }
  return B.out();
}
function lighthouse() {
  reseed(64); const B = builder(), white = [.95, .93, .88], red = [.75, .25, .2], dark = [.2, .2, .22], lamp = [1.2, 1.1, .8];
  const bands = [[-1, 5, white], [5, 9, red], [9, 15, white], [15, 19, red]];
  for (const [y0, y1, c] of bands) prism(B, 0, 0, 3.2 - y0 * .04, 3.2 - y1 * .04, y0, y1, 10, c);
  prism(B, 0, 0, 2.8, 2.8, 19, 19.6, 10, dark);                // the gallery
  prism(B, 0, 0, 1.6, 1.6, 19.6, 22, 8, lamp);                 // the lantern
  prism(B, 0, 0, 1.9, .2, 22, 24.5, 8, dark);                  // the cap
  return B.out();
}
// a waterfall: a ribbon of white water laid over the cliff face from the lip downhill, built
// once per waterfall from the ground's own profile (local coordinates, +x downhill)
function fallsMesh(l) {
  const B = builder(), W = [.86, .92, .95], W2 = [.76, .86, .92], w = 3.2, pts = [];
  let s = -3, y0 = height(l.x - l.dx * 3, l.z - l.dz * 3);
  pts.push([s, y0 + .5]);
  for (s = 0; s < 120; s += 1.5) {
    const y = height(l.x + l.dx * s, l.z + l.dz * s);
    pts.push([s, y + .7]);
    if (s > 6 && y0 - y < 1) break;     // the fall has reached the bottom: it runs out flat
    y0 = y;
  }
  const yTop = pts[0][1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, ya] = pts[i], [b, yb] = pts[i + 1], ww = w * (1 + i * .02);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, -ww], [b, yb - yTop, ww], i & 1 ? W : W2);
    B.tri([a, ya - yTop, -ww], [b, yb - yTop, ww], [a, ya - yTop, ww], i & 1 ? W2 : W);
  }
  return { tris: B.out(), top: yTop, foot: [l.x + l.dx * pts[pts.length - 1][0], l.z + l.dz * pts[pts.length - 1][0]] };
}

export function landsSystem(G) {
  const R = G.R;
  R.shape('lm_stones', stones()); R.shape('lm_cairn', cairn()); R.shape('lm_tower', tower()); R.shape('lm_lighthouse', lighthouse());
  const fallsOf = new Map();   // landmark id -> { shape, top, foot }
  const fall = l => { let f = fallsOf.get(l.id); if (!f) { f = fallsMesh(l); f.shape = 'lm_falls_' + l.id; R.shape(f.shape, f.tris); fallsOf.set(l.id, f); } return f; };
  let near = [], nearT = 0;
  return {
    id: 'lands',
    update(dt) {
      if ((nearT -= dt) <= 0) { nearT = 1; near = landmarksNear(G.b.p[0], G.b.p[2], 700); }
      // spray and mist at the foot of each waterfall close by
      for (const l of near) if (l.kind === 'falls' && Math.hypot(l.x - G.b.p[0], l.z - G.b.p[2]) < 220 && Math.random() < dt * 14) {
        const [bx, bz] = fall(l).foot, by = Math.max(height(bx, bz), WATER) + .4;
        G.part([bx + (Math.random() - .5) * 3, by, bz + (Math.random() - .5) * 3], [(Math.random() - .5) * 2, 1 + Math.random() * 2, (Math.random() - .5) * 2], 1.4, [.92, .95, .97], .25);
      }
    },
    scene(S) {
      const cam = S.cam, L = G.light;
      for (const l of near) {
        if (Math.hypot(l.x - cam[0], l.z - cam[2]) > 600) continue;
        if (l.kind === 'stones') (S.props.lm_stones ||= []).push(l.x, l.y, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'cairn') (S.props.lm_cairn ||= []).push(l.x, l.y - .3, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'tower') (S.props.lm_tower ||= []).push(l.x, l.y - .5, l.z, 1, l.yaw, .5, 0, 0);
        if (l.kind === 'falls') { const f = fall(l); (S.props[f.shape] ||= []).push(l.x, f.top, l.z, 1, Math.atan2(l.dz, l.dx), .5, 0, 0); }
        if (l.kind === 'lighthouse') {
          (S.props.lm_lighthouse ||= []).push(l.x, l.y - .8, l.z, 1, 0, .5, 0, 0);
          // at dusk and night the lamp shines and its beam sweeps the sea
          const lit = 1 - L.daylight * .85;
          if (lit > .2) {
            const top = [l.x, l.y + 20, l.z], a = G.t * .9;
            S.motes.push(...top, 1, .95, .7, 2.2 * lit);
            for (let i = 1; i < 60; i++) S.motes.push(top[0] + Math.cos(a) * i * 2.6, top[1] - i * .06, top[2] + Math.sin(a) * i * 2.6, ...mix3(S.horizon, [1, .95, .75], lit * (1 - i / 62) * .8), .55 + i * .025);
          }
        }
      }
    },
  };
}
