// Small things on the ground, near the hawk: grass tufts, flowers, stones and reeds (bushes are
// world.js bushesNear, drawn by sys/bushes.js).
// Scattered by hash in 8 m cells (so the same tuft is always in the same place), cached per
// cell, drawn instanced within FLORA.near metres of the camera. They make height and speed
// readable close to the ground, which the big facets alone don't.
import { height, groundAt, groundNormal, forest, bands, ih, fbm, PAL, WATER, env } from '../world.js';
import { rollBiome } from '../biomes.js';
import { smooth } from '../util.js';
import { builder, blob, reseed, rnd } from '../shapes.js';

export const FLORA = { cell: 8, near: 95, cache: 1600, meadow: 30 };
const TUFT_NAMES = ['tuft', 'tuft1', 'tuft2', 'tuft3'];

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const PETAL = { flowerY: hex('#e8c24a'), flowerW: hex('#efe9dc'), flowerP: hex('#9a6fa8') };

// grass tufts in four makes: a few long arching blades, a dense short clump, a tall upright
// sheaf, a sprawling one; each blade bends in two facets, and the shades vary blade to blade
const TUFTS = [[5, .42, .5, 4], [11, .24, .25, 5], [7, .55, .15, 6], [9, .32, .75, 7]];   // blades, height, how far they arch out, seed
function tuft([n, H, arch, sd]) {
  reseed(23 + sd); const B = builder(), shades = [[.52, .66, .32], [.62, .7, .36], [.47, .6, .3], [.58, .64, .34]];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + rnd() * 1.4, r = .02 + rnd() * .07, h = H * (.6 + rnd() * .55), out = arch * (.5 + rnd()) * h, w = .018 + rnd() * .016;
    const ca = Math.cos(a), sa = Math.sin(a), x = ca * r, z = sa * r, col = shades[(i + sd) % 4];
    const m = [x + ca * out * .35, h * .6, z + sa * out * .35], t = [x + ca * out, h * (.95 - arch * .25), z + sa * out];
    B.tri([x - w * sa, 0, z + w * ca], [x + w * sa, 0, z - w * ca], [m[0] + w * .6 * sa, m[1], m[2] - w * .6 * ca], col);
    B.tri([x - w * sa, 0, z + w * ca], [m[0] + w * .6 * sa, m[1], m[2] - w * .6 * ca], [m[0] - w * .6 * sa, m[1], m[2] + w * .6 * ca], col);
    B.tri([m[0] - w * .6 * sa, m[1], m[2] + w * .6 * ca], [m[0] + w * .6 * sa, m[1], m[2] - w * .6 * ca], t, col);
  }
  return B.out();
}
// B, grass near you (a look test, R.look.grass): a patch of meadow, thirty blades in a
// metre and a half, laid down thickly close to the camera
function meadow() {
  reseed(61); const B = builder(), shades = [[.5, .64, .31], [.6, .69, .35], [.45, .58, .29], [.56, .63, .33], [.64, .66, .38]];
  for (let i = 0; i < 30; i++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * .8, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const b = rnd() * 6.283, cb = Math.cos(b), sb = Math.sin(b), h = .28 + rnd() * .32, lean = (.1 + rnd() * .25) * h, w = .016 + rnd() * .014, col = shades[i % 5];
    const m = [x + cb * lean * .35, h * .6, z + sb * lean * .35], t = [x + cb * lean, h, z + sb * lean];
    B.tri([x - w * sb, 0, z + w * cb], [x + w * sb, 0, z - w * cb], [m[0] + w * .6 * sb, m[1], m[2] - w * .6 * cb], col);
    B.tri([x - w * sb, 0, z + w * cb], [m[0] + w * .6 * sb, m[1], m[2] - w * .6 * cb], [m[0] - w * .6 * sb, m[1], m[2] + w * .6 * cb], col);
    B.tri([m[0] - w * .6 * sb, m[1], m[2] + w * .6 * cb], [m[0] + w * .6 * sb, m[1], m[2] - w * .6 * cb], t, col);
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
  TUFTS.forEach((t, i) => R.shape(i ? 'tuft' + i : 'tuft', tuft(t))); R.shape('scrub', scrub()); R.shape('barrel', barrel()); R.shape('stone', stone()); R.shape('reeds', reeds()); R.shape('meadow', meadow());
  for (const k in PETAL) R.shape(k, flower(PETAL[k]));
  const cache = new Map();
  // what grows in one cell: [kind, x, y, z, scale, yaw, tint][]
  function cell(cx, cz) {
    const key = cx * 73856093 ^ cz * 19349663;
    let c = cache.get(key); if (c) return c;
    c = [];
    const x0 = cx * FLORA.cell, z0 = cz * FLORA.cell, k = bands(x0, z0), roll = rollBiome(k.bl, ih(cx, cz, 270)), bio = roll.name;
    const ground = GROUND[bio], cacti = roll.cont === 'n-america' || roll.cont === 's-america';   // barrel cacti are the Americas' alone
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
      else if (ground) { kind = ground(r, n); if (kind === 'gold') { kind = 'tuft'; gold = 1; } if (kind === 'barrel' && !cacti) kind = 'scrub'; if (kind === 'stone' && ih(cx, cz, 280 + i) > scree) kind = null; }                  // the dry and bare lands
      else if (n < .8 || (k.high + k.ridge > .5 && r < .45)) kind = r < .35 * scree ? 'stone' : null;           // slopes and heights: stones, in patches
      else if (f < .25 && !snowy) kind = r < .62 ? 'tuft' : r < .78 && !G.season?.winter ? ['flowerY', 'flowerW', 'flowerP'][(ih(cx, cz, 260) * 3) | 0] : r < .78 + .04 * scree ? 'stone' : null;
      if ((kind === 'tuft' || kind === 'scrub') && snowy) kind = null;
      if (kind) c.push([kind, x, y - .05, z, kind === 'stone' ? sc * (.6 + r) : kind === 'tuft' ? sc * (1 + ih(cx, cz, 260 + i) * 1.2) : sc, yaw, tint, gold]);
      if (kind === 'tuft') { c.lush = (c.lush || 0) + 1; c.gold = (c.gold || 0) + gold; }
    }
    if (cache.size > FLORA.cache) cache.delete(cache.keys().next().value);
    cache.set(key, c);
    return c;
  }
  // (B) the meadow patches of a cell, where its tufts grow thickly: [x, y, z, yaw, tint][], made
  // the first time they are wanted
  function meadows(cx, cz, c) {
    if (c.meadow) return c.meadow;
    c.meadow = [];
    const lush = (c.lush || 0) / 7, C = FLORA.cell;
    if (lush < .15) return c.meadow;
    for (let i = 0; i < 36; i++) {
      if (ih(cx, cz, 300 + i) > lush * 1.6) continue;
      const x = (cx + (i % 6 + ih(cx, cz, 420 + i)) / 6) * C, z = (cz + (Math.floor(i / 6) + ih(cx, cz, 460 + i)) / 6) * C, y = groundAt(x, z);
      if (y < WATER + .4 || y > env.snowLine || groundNormal(x, z)[1] < .88 || forest(x, z) > .3) continue;   // (gentle ground only: a patch lies level)
      c.meadow.push(x, y - .08, z, ih(cx, cz, 500 + i) * 6.283, ih(cx, cz, 540 + i));
    }
    return c.meadow;
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
        if (ws) k += Math.max(0, Math.sin((x * ws.x + z * ws.z) / 6 - ws.t)) ** 2 * ws.k * .5;
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
        // (B) the meadow near you, growing in from nothing over its last few metres so it never pops
        const MD = FLORA.meadow;
        if (R.look?.grass && dd < (MD + C) ** 2) {
          const c = cell(cx, cz), m = meadows(cx, cz, c), out = S.props.meadow ||= [], turn = c.gold > c.lush / 2 ? .9 : autumn * .6;
          for (let i = 0; i < m.length; i += 5) {
            const d = Math.hypot(m[i] - cam[0], m[i + 2] - cam[2]), g = 1 - smooth(MD - 8, MD, d);
            if (g > 0) out.push(m[i], m[i + 1], m[i + 2], g * (.85 + m[i + 4] * .4), m[i + 3], m[i + 4], turn, 0);
          }
        }
        for (const [kind, x, y, z, sc, yaw, tint, gold] of cell(cx, cz)) {
          if (far && kind !== 'stone') continue;   // small things only close up
          const k = (g || sk || ws) && (kind === 'tuft' || kind.startsWith('flower')) ? stir(x, z) : 0;
          // a gust presses the blades down and shows their paler undersides (the sway itself, in
          // waves running downwind, is the renderer's: render.js INST_VS)
          const name = kind === 'tuft' ? TUFT_NAMES[Math.floor(tint * 97) % 4] : kind;
          (S.props[name] ||= []).push(x, y, z, sc * (1 - k * .25), yaw, tint + k * 2, gold ? .9 : kind === 'tuft' ? autumn * .6 : 0, 0);
        }
      }
    },
  };
}
