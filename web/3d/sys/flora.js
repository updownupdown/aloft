// Small things on the ground, near the hawk: grass tufts, flowers, stones and reeds (bushes are
// world.js bushesNear, drawn by sys/bushes.js).
// Scattered by hash in 8 m cells (so the same tuft is always in the same place), cached per
// cell, drawn instanced within FLORA.near metres of the camera. They make height and speed
// readable close to the ground, which the big facets alone don't.
import { height, groundAt, groundNormal, forest, bands, ih, fbm, PAL, WATER, env } from '../world.js';
import { rollBiome } from '../biomes.js';
import { smooth } from '../util.js';
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
// a sagebrush or desert scrub: low grey-green lumps
function scrub() {
  reseed(43); const B = builder(), c1 = [.55, .58, .44], c2 = [.64, .63, .5];
  blob(B, 0, .18, 0, .3, c1, c2, [1.2, .6, 1], 2); blob(B, .22, .14, .1, .2, c2, c1, [1, .7, 1], 2);
  return B.out();
}
// a small barrel cactus
function barrel() {
  reseed(47); const B = builder();
  blob(B, 0, .2, 0, .22, PAL.cactus, PAL.cactus2, [1, 1.1, 1], 2);
  B.tri([-.04, .43, 0], [.04, .43, 0], [0, .48, .03], [.9, .45, .45]);
  return B.out();
}
function stone() { reseed(31); const B = builder(); blob(B, 0, .05, 0, .3, PAL.rock, PAL.rock2, [1.2, .55, .9], 2); return B.out(); }
function reeds() {
  reseed(41); const B = builder();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = .05 + (i % 3) * .05, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .7 + (i % 4) * .18, lean = (i % 2 ? .08 : -.06);
    B.tri([x - .015, 0, z], [x + .015, 0, z], [x + lean, h, z + lean * .5], i % 2 ? PAL.reed : PAL.reed2);
    if (i % 3 === 0) blob(B, x + lean * .93, h * .9, z + lean * .46, .03, PAL.mud, PAL.bark, [.6, 2.2, .6]);
  }
  return B.out();
}

// what grows on the ground of the drier and barer lands, by a roll r and the slope n
// ('gold': a tuft of dry golden grass)
const GROUND = {
  desert: r => r < .1 ? 'scrub' : r < .14 ? 'barrel' : r < .17 ? 'stone' : null,
  canyon: (r, n) => n < .8 ? (r < .3 ? 'stone' : null) : r < .15 ? 'scrub' : r < .19 ? 'barrel' : null,
  badlands: r => r < .05 ? 'stone' : null,
  saltflat: () => null,
  savanna: r => r < .55 ? 'gold' : r < .62 ? 'scrub' : r < .65 ? 'stone' : null,
  moor: r => r < .45 ? 'gold' : r < .55 ? 'stone' : r < .62 ? 'flowerP' : null,
  volcano: (r, n) => r < .2 ? 'stone' : r < .3 && n > .85 ? 'tuft' : null,
  alpine: (r, n) => n < .8 || r < .3 ? (r < .6 ? 'stone' : null) : r < .55 ? 'tuft' : r < .62 ? 'flowerW' : null,
  ice: r => r < .03 ? 'stone' : null,
  tundra: r => r < .3 ? 'tuft' : r < .38 ? 'stone' : r < .42 ? 'flowerW' : null,
  steppe: r => r < .6 ? 'gold' : r < .64 ? 'scrub' : null,
  taiga: r => r < .22 ? 'tuft' : r < .3 ? 'stone' : null,
  maquis: r => r < .25 ? 'scrub' : r < .35 ? 'gold' : r < .4 ? 'stone' : r < .44 ? 'flowerP' : null,
};
export function floraSystem(G) {
  const R = G.R;
  R.shape('tuft', tuft()); R.shape('scrub', scrub()); R.shape('barrel', barrel()); R.shape('stone', stone()); R.shape('reeds', reeds());
  for (const k in PETAL) R.shape(k, flower(PETAL[k]));
  const cache = new Map();
  // what grows in one cell: [kind, x, y, z, scale, yaw, tint][]
  function cell(cx, cz) {
    const key = cx * 73856093 ^ cz * 19349663;
    let c = cache.get(key); if (c) return c;
    c = [];
    const x0 = cx * FLORA.cell, z0 = cz * FLORA.cell, k = bands(x0, z0), bio = rollBiome(k.bl, ih(cx, cz, 270)).name;
    const ground = GROUND[bio];
    for (let i = 0; i < 7; i++) {
      const x = x0 + ih(cx, cz, 200 + i) * FLORA.cell, z = z0 + ih(cx, cz, 210 + i) * FLORA.cell, y = groundAt(x, z);
      if (y < WATER - .2) continue;
      const r = ih(cx, cz, 220 + i), n = groundNormal(x, z)[1];
      if (n < .6) continue;                                                   // nothing clings to a crag
      const scree = smooth(.1, .45, fbm(x / 120, z / 120, 271, 2));            // stones lie in patches
      const f = forest(x, z), sc = .8 + ih(cx, cz, 230 + i) * .6, yaw = ih(cx, cz, 240 + i) * 6.283;
      const tint = ih(cx, cz, 250 + i); let gold = 0;
      const snowy = y > env.snowLine;
      let kind = null;
      if (y < .9 || (k.marsh > .5 && r < .5)) kind = y > WATER - .2 && (k.marsh > .3 || y < .5) ? 'reeds' : null;   // at the water's edge
      else if (ground) { kind = ground(r, n); if (kind === 'gold') { kind = 'tuft'; gold = 1; } if (kind === 'stone' && ih(cx, cz, 280 + i) > scree) kind = null; }                  // the dry and bare lands
      else if (n < .8 || (k.high + k.ridge > .5 && r < .45)) kind = r < .35 * scree ? 'stone' : null;           // slopes and heights: stones, in patches
      else if (f < .25 && !snowy) kind = r < .62 ? 'tuft' : r < .78 && !G.season?.winter ? ['flowerY', 'flowerW', 'flowerP'][(ih(cx, cz, 260) * 3) | 0] : r < .78 + .04 * scree ? 'stone' : null;
      if ((kind === 'tuft' || kind === 'scrub') && snowy) kind = null;
      if (kind) c.push([kind, x, y - .05, z, kind === 'stone' ? sc * (.6 + r) : kind === 'tuft' ? sc * 1.7 : sc, yaw, tint, gold]);
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
      // a gust front (G.gust, flight's feel) rolls across the grass as a pale band of bent blades
      // showing their undersides; skimming low (G.skim) lays the grass over round the bird
      const g = G.gust, sk = G.skim, ws = G.windStreak?.k > .05 ? G.windStreak : null;
      const stir = (x, z) => {
        let k = 0;
        // the wind's own bands (wingcraft.js), rolling across the grass the way it blows
        if (ws) k += Math.max(0, Math.sin((x * ws.x + z * ws.z) / 6 - ws.t)) ** 6 * ws.k * .6;
        if (g) {
          const s = (x - g.x) * g.dx + (z - g.z) * g.dz, side = Math.abs((x - g.x) * -g.dz + (z - g.z) * g.dx);
          if (s < 2 && s > -14 && side < g.w * .6) k += Math.exp(-((s + 4) ** 2) / 18) * g.k * (1 - side / (g.w * .6));
        }
        if (sk) { const d = Math.hypot(x - sk.x, z - sk.z); if (d < 7) k += (1 - d / 7) * sk.k; }
        return k;
      };
      // only the cells in front of the camera (a cone a little wider than the view, as the trees);
      // looking steeply down, all of them
      const v = G.R.viewInfo, fx = v ? v.f[0] : 0, fz = v ? v.f[2] : 0, fl = Math.hypot(fx, fz);
      const cone = v && v.f[1] > -.55 && fl > .01 ? Math.cos(Math.min(Math.PI, Math.atan(Math.tan(v.fov / 2) * v.aspect) + .6)) : -2;
      for (let cz = d0; cz <= d1; cz++) for (let cx = a; cx <= b; cx++) {
        const mx = (cx + .5) * C - cam[0], mz = (cz + .5) * C - cam[2], dd = mx * mx + mz * mz;
        if (dd > N * N) continue;
        if (dd > 2 * C * C && (mx * fx + mz * fz) / (Math.sqrt(dd) * fl) < cone) continue;   // off to the side or behind
        const far = dd > (N * .6) ** 2;
        for (const [kind, x, y, z, sc, yaw, tint, gold] of cell(cx, cz)) {
          if (far && kind !== 'stone') continue;   // small things only close up
          const k = (g || sk || ws) && (kind === 'tuft' || kind.startsWith('flower')) ? stir(x, z) : 0;
          (S.props[kind] ||= []).push(x, y, z, sc * (1 - k * .3), yaw + k * 1.2, tint + k * 3, gold ? .9 : kind === 'tuft' ? autumn * .6 : 0, 0);
        }
      }
    },
  };
}
