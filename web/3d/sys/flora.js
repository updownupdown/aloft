// Small things on the ground, near the hawk: grass tufts, flowers, stones, bushes and reeds.
// Scattered by hash in 8 m cells (so the same tuft is always in the same place), cached per
// cell, drawn instanced within FLORA.near metres of the camera. They make height and speed
// readable close to the ground, which the big facets alone don't.
import { height, normalAt, forest, bands, ih, PAL, WATER, env } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';

export const FLORA = { cell: 8, near: 95, cache: 1600 };

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const PETAL = { flowerY: hex('#e8c24a'), flowerW: hex('#efe9dc'), flowerP: hex('#9a6fa8') };

function tuft() {
  reseed(23); const B = builder(), g1 = [.52, .66, .32], g2 = [.62, .7, .36];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283 + i * .7, r = .06 + (i % 3) * .03, h = .28 + (i % 4) * .07;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, lx = Math.cos(a) * .2, lz = Math.sin(a) * .2;
    B.tri([x - .03 * Math.sin(a), 0, z + .03 * Math.cos(a)], [x + .03 * Math.sin(a), 0, z - .03 * Math.cos(a)], [x + lx * h, h, z + lz * h], i % 2 ? g1 : g2);
  }
  return B.out();
}
function flower(col) {
  reseed(29); const B = builder(), stem = [.45, .58, .3], mid = [.86, .7, .3];
  B.tri([-.012, 0, 0], [.012, 0, 0], [0, .3, 0], stem); B.tri([0, 0, -.012], [0, 0, .012], [0, .3, 0], stem);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.283, b = a + .9;
    B.tri([0, .3, 0], [Math.cos(a) * .07, .31, Math.sin(a) * .07], [Math.cos(b) * .07, .31, Math.sin(b) * .07], col);
  }
  B.tri([-.02, .315, -.02], [.02, .315, -.02], [0, .315, .025], mid);
  return B.out();
}
function stone() { reseed(31); const B = builder(); blob(B, 0, .05, 0, .3, PAL.rock, PAL.rock2, [1.2, .55, .9]); return B.out(); }
function bush() {
  reseed(37); const B = builder();
  blob(B, 0, .32, 0, .42, PAL.leaf2, PAL.leaf, [1, .75, 1]);
  blob(B, .3, .22, .12, .3, PAL.leaf2, PAL.leaf, [1, .8, 1]);
  blob(B, -.28, .2, -.1, .28, PAL.moss, PAL.leaf2, [1, .8, 1]);
  return B.out();
}
function reeds() {
  reseed(41); const B = builder();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = .05 + (i % 3) * .05, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .7 + (i % 4) * .18, lean = (i % 2 ? .08 : -.06);
    B.tri([x - .015, 0, z], [x + .015, 0, z], [x + lean, h, z + lean * .5], i % 2 ? PAL.reed : PAL.reed2);
    if (i % 3 === 0) blob(B, x + lean * .93, h * .9, z + lean * .46, .03, PAL.mud, PAL.bark, [.6, 2.2, .6]);
  }
  return B.out();
}

export function floraSystem(G) {
  const R = G.R;
  R.shape('tuft', tuft()); R.shape('stone', stone()); R.shape('bush', bush()); R.shape('reeds', reeds());
  for (const k in PETAL) R.shape(k, flower(PETAL[k]));
  const cache = new Map();
  // what grows in one cell: [kind, x, y, z, scale, yaw, tint][]
  function cell(cx, cz) {
    const key = cx * 73856093 ^ cz * 19349663;
    let c = cache.get(key); if (c) return c;
    c = [];
    const x0 = cx * FLORA.cell, z0 = cz * FLORA.cell, k = bands(x0, z0);
    for (let i = 0; i < 7; i++) {
      const x = x0 + ih(cx, cz, 200 + i) * FLORA.cell, z = z0 + ih(cx, cz, 210 + i) * FLORA.cell, y = height(x, z);
      if (y < WATER - .2) continue;
      const r = ih(cx, cz, 220 + i), n = normalAt(x, z)[1], f = forest(x, z), sc = .8 + ih(cx, cz, 230 + i) * .6, yaw = ih(cx, cz, 240 + i) * 6.283, tint = ih(cx, cz, 250 + i);
      const snowy = y > 185 - env.snow * 200;
      let kind = null;
      if (y < .9 || (k.marsh > .5 && r < .5)) kind = y > WATER - .2 && (k.marsh > .3 || y < .5) ? 'reeds' : null;   // at the water's edge
      else if (n < .8 || (k.high + k.ridge > .5 && r < .45)) kind = r < .7 ? 'stone' : null;                    // slopes and heights: stones
      else if (f > .05 && f < .35 && r < .1) kind = 'bush';                                                     // wood edges
      else if (f < .25 && !snowy) kind = r < .62 ? 'tuft' : r < .78 && !G.season?.winter ? ['flowerY', 'flowerW', 'flowerP'][(ih(cx, cz, 260) * 3) | 0] : r < .82 ? 'stone' : null;
      if (kind === 'tuft' && snowy) kind = null;
      if (kind) c.push([kind, x, y - .05, z, kind === 'stone' ? sc * (.6 + r) : kind === 'tuft' ? sc * 1.7 : sc, yaw, tint]);
    }
    if (cache.size > FLORA.cache) cache.delete(cache.keys().next().value);
    cache.set(key, c);
    return c;
  }
  G.on('season', () => cache.clear());   // flowers come and go with the winter
  return {
    id: 'flora',
    scene(S) {
      const cam = S.cam, N = FLORA.near, C = FLORA.cell;
      if (cam[1] - height(cam[0], cam[2]) > 120) return;   // too high to see them
      const a = Math.floor((cam[0] - N) / C), b = Math.floor((cam[0] + N) / C), d0 = Math.floor((cam[2] - N) / C), d1 = Math.floor((cam[2] + N) / C);
      const autumn = S.autumn ?? (G.season?.autumn || 0);
      for (let cz = d0; cz <= d1; cz++) for (let cx = a; cx <= b; cx++) {
        const mx = (cx + .5) * C - cam[0], mz = (cz + .5) * C - cam[2], dd = mx * mx + mz * mz;
        if (dd > N * N) continue;
        const far = dd > (N * .6) ** 2;
        for (const [kind, x, y, z, sc, yaw, tint] of cell(cx, cz)) {
          if (far && kind !== 'bush' && kind !== 'stone') continue;   // small things only close up
          (S.props[kind] ||= []).push(x, y, z, sc, yaw, tint, kind === 'tuft' || kind === 'bush' ? autumn * .6 : 0, 0);
        }
      }
    },
  };
}
