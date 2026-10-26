// The 3D world is a pure function of position and a seeded hash: terrain height, where trees
// stand, where thermals rise and rings hang. Only small caches are kept. The lands themselves
// (which biome is where, and each one's ground and colours) are in biomes.js; the seed and the
// noise in noise.js; the Earth underneath (coasts, continents, latitude) in earth.js. The world
// is 96 km round and wraps east to west (main.js moves the bird across the seam). Coordinates:
// x east, z south, y up, metres-ish. Water level is y = 0.
import { store } from './util.js';
import { ih, fbm, smooth, clamp, WORLD, newWorld } from './noise.js';
import { BIOMES, PAL, blend, weightOf, share, rollBiome, cellsNear } from './biomes.js';
import { coastDist, latLon, latAt, oceanKey, regionAt, wrapX, toXZ, EARTH, NORTH, SOUTH, seasonAt, snowLine, dryAt } from './earth.js';
import { railCut, railShade, railNear, railSolids, railLandmarks } from './rail.js';
import { settlementsNear, buildingsNear, bridgesNear, roadShade, buildingSolids, bridgeSolids, polesNear, poleSolids, clearOf, saplingIn } from './settle.js';
export { ih, fbm, WORLD, newWorld, PAL, blend };
export { coastDist, latLon, latAt, regionAt, wrapX, toXZ, EARTH, NORTH, SOUTH } from './earth.js';

export const CHUNK = 96;
// Ground detail (Settings > Ground detail): cells per chunk side. Low is 16 (6 m facets),
// Medium 32 (3 m, the default), High 96 (1 m). Triangles grow with the square. Detail falls
// off in rings round the bird (RINGS: out to so many metres, so many cells), so the finest steps
// only build the few chunks close by; past the last ring it is the base step (CELLS).
export const GROUND = [[16, 'Low', '6 m facets'], [32, 'Medium', '3 m facets'], [96, 'High', '1 m facets, heavier on memory and battery']];
export let CELLS = 32, CELL = CHUNK / 48, RINGS = [], GROUND_SET = 32;   // GROUND_SET: the step picked
export function setGroundDetail(n) {
  if (!GROUND.some(g => g[0] === n)) n = n < 24 ? 16 : n > 48 ? 96 : 32;
  GROUND_SET = n;
  RINGS = n <= 48 ? [[160, Math.min(48, n * 2)], [1e9, n]]
    : n === 96 ? [[120, 96], [1e9, 48]]
    : [[90, 192], [200, 96], [1e9, 48]];
  CELLS = RINGS[RINGS.length - 1][1]; CELL = CHUNK / RINGS[0][1];
}
// how many cells a side for a chunk whose middle is d metres from the bird
export const cellsFor = d => RINGS.find(r => d < r[0])[1];
setGroundDetail(store.get('ground', 32));
// The water level: 0 on average, but the tides, the rain and the summer move it (sys/waters.js
// calls setWater). One level for all water, sea and lakes alike, kept within half a metre or so.
export let WATER = 0;
export function setWater(y) { WATER = y; }

// what systems change at run time: the snowline (0 summer .. 1 deep winter, chunks must be
// rebuilt when it moves), the thermals' strength, and extra lift (storm cells, waves, kettles)
// yearFrac: the calendar (earth.js yearFrac), which with the latitude sets each place's season and snow
export const env = { snow: 0, snowLine: 185, season: 'summer', seasonDay: 0, yearFrac: .47, thermal: 1, lifts: [], thermals: [], solids: [], shade: null };   // shade(x, z): cloud shadow 0..1 (sys/air.js); solids: fns (x, z, r, out) adding things that move or float (sys/sealife.js, sys/drift.js)

// how much of each kind of country a point is, 0..1 each (older callers read these)
export function bands(x, z, bl = blend(x, z)) {
  return {
    w: z, bl, lakes: weightOf(bl, 'lakes'), marsh: weightOf(bl, 'marsh'), high: weightOf(bl, 'high'), ridge: weightOf(bl, 'peaks'),
    coast: weightOf(bl, 'coast'), dry: weightOf(bl, 'dry'), moor: share(bl, 'moor'),
  };
}
export function biomeAt(x, z) {
  const bl = blend(x, z);
  return { name: bl[0].name, k: bands(x, z, bl), bl };
}
export function placeName(x, z) {
  const l = landmarksNear(x, z, 700).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  if (l && Math.hypot(l.x - x, l.z - z) < 300 + (l.kind === 'sight' ? l.r : 0)) return l.name;
  const r = regionAt(x, z);
  return r ? `${blend(x, z)[0].b.label}, ${r.name}` : blend(x, z)[0].b.label;
}

// ---- terrain -----------------------------------------------------------------------------
// The shared rolling ground, then each biome near the point shapes its own, blended by weight;
// then the old railway's cuttings and embankments (rail.js, which reads baseHeight)
export const height = (x, z) => railCut(x, z, baseHeight(x, z));
export function baseHeight(x, z) {
  const bl = blend(x, z), B = { big: fbm(x / 520, z / 520, 1, 3), mid: fbm(x / 150, z / 150, 2, 3), fine: fbm(x / 32, z / 32, 5, 2) };
  let h = 0;
  for (const e of bl) h += e.w * e.b.h(x, z, B, e);
  if (!bl[0].b.flat) h += B.fine * 1.6 * (1 - share(bl, 'saltflat'));
  h = shore(x, z, h, bl);
  h = riverCut(x, z, h);
  return h;
}
// The real coastline (earth.js: metres to the coast) roughened by noise at two sizes: the land
// shelves down to beaches, or drops in sea cliffs where the land is cliffy; the sea floor deepens
// away from the shore. Out at sea: islands, and near the poles the pack ice.
function shore(x, z, h, bl) {
  const c = coastDist(x, z);
  if (c > 1400) return h;
  const s = c + fbm(x / 430, z / 430, 31, 3) * 300 + fbm(x / 90, z / 90, 32, 2) * 55;
  const cliff = Math.min(1, weightOf(bl, 'cliff')), w = 75 - 62 * cliff;
  const land = h * (.12 + .88 * cliff + (1 - cliff) * .88 * smooth(0, 900, s)) + 1.2 * (1 - cliff);
  const bed = -3 - 32 * smooth(0, 1800, -s);
  let y = bed + (land - bed) * smooth(-w, w, s);
  if (s < 400) y = Math.max(y, isles(x, z));   // (a real island the coastline has too rises from it)
  if (y < 1 && (z < NORTH + 5500 || z > SOUTH - 4200)) {   // the pack ice, with leads of open water
    const k = z < 0 ? smooth(NORTH + 5500, NORTH + 2500, z) : smooth(SOUTH - 4200, SOUTH - 1800, z);
    const floe = smooth(-.1, .12, fbm(x / 160, z / 160, 33, 3) + k * .5 - .25);
    y = y + (Math.max(y, .9 + fbm(x / 30, z / 30, 34, 1) * .25) - y) * floe * smooth(0, .3, k);
  }
  return y;
}
// Islands: the real small ones (too small for the baked coastline) and, in the island seas
// (earth.js OCEANS travel 'islands'), a scatter of volcanic islands and coral atolls to hop
// across. Never near the wrap seam.
const REAL_ISLES = [[19.6, -155.5, 950, 'volcano'], [20.8, -156.3, 520, 'volcano'], [38.6, -28, 520, 'volcano'], [32.7, -17, 420, 'volcano'], [28.3, -16.6, 620, 'volcano'],
  [32.3, -64.8, 340, 'atoll'], [-.6, -90.5, 600, 'volcano'], [-17.6, -149.4, 520, 'volcano'], [-27.1, -109.4, 320, 'volcano'], [62, -6.9, 420, 'high'], [-20.3, 57.6, 420, 'volcano'],
  [-21.1, 55.5, 460, 'volcano'], [3.2, 73.2, 420, 'atoll'], [-4.7, 55.5, 360, 'high'], [-9, -140, 420, 'volcano'], [13.4, 144.8, 360, 'high'], [-15.9, -5.7, 320, 'volcano'],
  [-7.9, -14.4, 300, 'volcano'], [-37.1, -12.3, 320, 'volcano'], [16, -24, 460, 'volcano'], [12.5, 54, 420, 'high'], [-21.2, -159.8, 320, 'atoll'], [-14.3, -170.7, 300, 'atoll']];
let isleList = null;
const isleCells = new Map(), ISLE = 2600;
function isleCell(gx, gz) {
  const k = gx * 100003 + gz; let c = isleCells.get(k); if (c !== undefined) return c;
  c = null;
  const x = (gx + .2 + ih(gx, gz, 341) * .6) * ISLE, z = (gz + .2 + ih(gx, gz, 342) * .6) * ISLE;
  if (Math.abs(x) < EARTH.W / 2 - EARTH.SEAM - 2200 && coastDist(x, z) < -1400 && z > NORTH + 6000 && z < SOUTH - 5000) {
    const [lat, lon] = latLon(x, z), o = oceanKey(lat, lon), p = o === 'pacific-s' ? .32 : o === 'med' ? .12 : 0;
    if (ih(gx, gz, 343) < p) c = { x, z, r: 170 + ih(gx, gz, 344) * 330, kind: Math.abs(lat) < 24 && ih(gx, gz, 345) < .55 ? 'atoll' : 'volcano', H: 24 + ih(gx, gz, 346) * 70 };
  }
  isleCells.set(k, c); if (isleCells.size > 4000) isleCells.delete(isleCells.keys().next().value);
  return c;
}
function isleH(I, x, z) {
  const d = Math.hypot(x - I.x, z - I.z) / I.r * (1 + fbm(x / 90, z / 90, 347, 2) * .18);
  if (d > 1.6) return -99;
  if (I.kind === 'atoll') return Math.max(-3.5 + 3 * smooth(.9, .6, d), 1.8 * Math.exp(-(((d - .82) / .13) ** 2)) - 6 * smooth(.95, 1.5, d));
  const cone = I.kind === 'high' ? (1 - d * d) * I.H : I.H * smooth(1.05, .1, d) ** 1.5 - (I.kind === 'volcano' ? 6 * smooth(.16, 0, d) : 0);
  return Math.max(-30 * smooth(1, 1.6, d), cone + 2 * smooth(1.1, .9, d));
}
export function islesNear(x, z, r) {
  if (!isleList) isleList = REAL_ISLES.map(([la, lo, R, kind], i) => { const p = toXZ(la, lo); return p && Math.abs(p[0]) < EARTH.W / 2 - EARTH.SEAM - 1500 ? { x: p[0], z: p[1], r: R, kind, H: kind === 'atoll' ? 0 : R * .11, real: i } : null; }).filter(Boolean);
  const out = isleList.filter(I => Math.abs(I.x - x) < r + I.r * 1.6 && Math.abs(I.z - z) < r + I.r * 1.6);
  const a = Math.floor((x - r - 800) / ISLE), b = Math.floor((x + r + 800) / ISLE), c = Math.floor((z - r - 800) / ISLE), d = Math.floor((z + r + 800) / ISLE);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const I = isleCell(gx, gz); if (I) out.push(I); }
  return out;
}
function isles(x, z) {
  let y = -99;
  for (const I of islesNear(x, z, 0)) y = Math.max(y, isleH(I, x, z));
  return y;
}
// Rivers: long winding channels (where a slow noise crosses zero) cut down below the water
// through whatever land they cross, in valleys that widen with the height of the land around,
// with a bed deep enough for fish. They come and go with a second, slower noise: they rise
// where it turns positive (a spring) and run until it fades (into a lake, the sea, or the
// ground). RIVER.scale is the spacing; flow and foam are sys/rivers.js.
export const RIVER = { scale: 1500, seed: 91, half: 8, bed: -2.2 };
// side: which side of the channel the point is on (+1/-1); lean (-1..1) which bank is the high,
// steep outer one along this stretch (the other is a low, wide inner bank), changing as it winds
export function riverAt(x, z) {
  const m = fbm(x / 2600, z / 2600, RIVER.seed + 7, 1) - dryAt(x, z) * .6;   // the deserts have none (a wadi at most)
  if (m < .02) return null;
  // the channel line is warped by noises at four sizes, so it swings in big meanders (some
  // reaches wild, some calmer), bends and doglegs within them, and small kinks close up
  const u = (sd, k) => fbm(x / k, z / k, RIVER.seed + sd, 1) * .5 + .5;
  const big = 110 + 140 * u(33, 900), mid = 90 + 170 * u(35, 600);
  const ax = fbm(x / 150, z / 150, RIVER.seed + 21, 2), az = fbm(x / 150, z / 150, RIVER.seed + 23, 2);
  const cx = fbm(x / 85, z / 85, RIVER.seed + 37, 2), cz = fbm(x / 85, z / 85, RIVER.seed + 39, 2);
  const bx = fbm(x / 40, z / 40, RIVER.seed + 25, 1), bz = fbm(x / 40, z / 40, RIVER.seed + 27, 1);
  const wx = x + fbm(x / 520, z / 520, RIVER.seed + 11, 2) * big + ax * mid + cx * 55 + bx * 16, wz = z + fbm(x / 520, z / 520, RIVER.seed + 13, 2) * big + az * mid + cz * 55 + bz * 16;
  const v = fbm(wx / RIVER.scale, wz / RIVER.scale, RIVER.seed, 2) + fbm(wx / (RIVER.scale / 5), wz / (RIVER.scale / 5), RIVER.seed + 2, 1) * .12;
  // the width wanders a lot: long reaches broad or narrow, pools and narrows, and now and then
  // a slack wide pool where the river spreads out
  const pool = smooth(.62, .85, u(41, 220));
  const wide = (.45 + 1.2 * u(17, 340)) * (.55 + .9 * u(29, 1100)) * (.7 + .6 * u(31, 95)) * (1 + 1.4 * pool);
  return { d: Math.abs(v) * RIVER.scale * .55, w: RIVER.half * wide * smooth(.02, .2, m), m, side: v < 0 ? -1 : 1, lean: clamp(fbm(x / 260, z / 260, RIVER.seed + 19, 1) * 2.2, -1, 1) };
}
function riverCut(x, z, h) {
  const r = riverAt(x, z); if (!r || h < RIVER.bed) return h;
  const s1 = r.side * r.lean;   // +1 on the outer (cut) bank, -1 on the inner one
  const bank = (r.w + 22 + Math.max(0, h) * 1.1) * (1 - s1 * .45); if (r.d > bank) return h;
  // the bed: deepest under the outer bank, up to the waterline at the edge; where the river
  // fades it shallows to a dry gully
  const k = smooth(.02, .2, r.m), u = r.w > .5 ? Math.min(1, r.d / r.w) : 1, deep = 1 + s1 * .35;
  const bed = RIVER.bed * deep * k * (1 - u ** (1.6 + s1)) + (1 - k) * 1.2 + (r.d > r.w ? (r.d - r.w) * .04 : 0);
  if (h <= bed) return h;
  // the valley sides, and the bank over the water: a steep cut on the outer side, a low
  // shelving bar on the inner
  const s = smooth(r.w, bank, r.d), y = bed + (h - bed) * s, lip = 2 + s1 * 1.6, run = 4 - s1 * 2.5;
  const cut = r.d > r.w ? Math.max(y, Math.min(h, lip * smooth(r.w, r.w + run, r.d))) : y;
  // and the whole valley fades out with the river (where riverAt gives up it was still a full
  // cut: a sheer wall across the valley's end, James 2026-10-23)
  return h + (cut - h) * smooth(.02, .09, r.m);
}
export function normalAt(x, z) {
  const e = 1.5, hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
}
// the ground as drawn: the chunk's triangles, not the smooth function between their corners
// (so small things set on a ridge sit on it, not above it). This follows the near chunks' finer
// cells (CELL), which is where the bird is and where small things are set down.
export function groundAt(x, z) {
  const i = Math.floor(x / CELL), j = Math.floor(z / CELL), u = x / CELL - i, v = z / CELL - j, xa = i * CELL, za = j * CELL;
  const a = height(xa, za), b = height(xa + CELL, za), c = height(xa, za + CELL), d = height(xa + CELL, za + CELL);
  if ((i + j) & 1) return u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  return u > v ? a + (b - a) * u + (d - b) * v : a + (c - a) * v + (d - c) * u;
}
// the slope of the drawn ground there (its triangle's normal, y up)
export function groundNormal(x, z) {
  const e = .3, hx = groundAt(x + e, z) - groundAt(x - e, z), hz = groundAt(x, z + e) - groundAt(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
}
// open meadow vs woodland: where trees grow (above about .1 is wood)
function forestOf(x, z, bl) {
  let f = fbm(x / 220, z / 220, 9, 2);
  for (const e of bl) f += e.w * e.b.forest;
  return f;
}
export const forest = (x, z) => forestOf(x, z, blend(x, z));

// ---- colours -------------------------------------------------------------------------------
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
let facet = 2;   // the facet size of the chunk being built (chunkMesh), for the railway's ballast
function groundColour(x, y, z, ny, bl = blend(x, z)) {
  const steep = 1 - ny;
  let c = [0, 0, 0], own = 0, noSnow = 0, sandy = 0;
  for (const e of bl) {
    if (e.w < .02) continue;
    const k = e.b.c(x, y, z, steep, e);
    c[0] += k[0] * e.w; c[1] += k[1] * e.w; c[2] += k[2] * e.w;
    own += (e.b.ownRock || 0) * e.w; noSnow += (e.b.noSnow || 0) * e.w; sandy += (e.b.flat ? 1 : 0) * e.w;
  }
  const t = bl.reduce((s, e) => s + (e.w < .02 ? 0 : e.w), 0) || 1; c = [c[0] / t, c[1] / t, c[2] / t];
  // wood floor darker under the trees
  c = mixc(c, PAL.wood, smooth(.05, .45, forestOf(x, z, bl)) * .45 * (1 - own));
  const marsh = weightOf(bl, 'marsh');
  if (y < 1.8 && sandy < .5) c = mixc(PAL.sand, c, smooth(.4, 1.8, y) * (marsh > .5 ? .6 : 1) + (marsh > .5 ? .4 : 0));
  if (y < 0) c = mixc(PAL.mud, PAL.sand, clamp(1 + y / 6, 0, 1));
  c = mixc(c, mixc(PAL.rock, PAL.rock2, ih(x | 0, z | 0, 3)), smooth(.22, .42, steep) * (1 - own));
  // the season on the ground: fresh green in spring; in autumn leaf litter under the trees and
  // tired, bare patches in the open (chunks are rebuilt when the season or snowline moves)
  // The season is the place's own (earth.js: the south has summer while the north has winter)
  const lat = latAt(x, z), se = seasonAt(lat, env.yearFrac);
  if (!se.tropic && (se.i === 3 || se.i === 1)) {
    const grassy = smooth(.0, .08, c[1] - c[0]) * (1 - own) * (y > 1.8 ? 1 : 0), f = forestOf(x, z, bl);
    if (se.i === 3) c = mixc(c, [c[0] * .9, c[1] * 1.05 + .015, c[2] * .85], grassy * smooth(0, 3, se.d + 1) * .5);
    else {
      const patch = smooth(.05, .4, fbm(x / 18, z / 18, 61, 2)), turn = smooth(0, 6, se.d + 1);
      c = mixc(c, mixc(PAL.wood, [.62, .4, .2], .55), grassy * smooth(.05, .35, f) * turn * .55);
      c = mixc(c, [.62, .58, .38], grassy * (1 - f) * patch * turn * .4);
    }
  }
  // the old tracks between the empty farms and villages (settle.js), worn earth half grown over
  const rd = y > .3 ? roadShade(x, z) : 0;
  if (rd > 0) c = mixc(c, [.74, .66, .5], rd * (.6 + .4 * smooth(-.3, .25, fbm(x / 70, z / 70, 695, 2))));
  // the railway's ballast, grey stone with grass coming through
  // (as wide as two facets of the chunk being built, and soft: a strip narrower than a facet caught
  // only some of them and read from afar as a dark dashed line; none on the coarsest ground)
  const bal = y > .3 && facet < 4 ? railShade(x, z, Math.max(2.6, facet * 1.6)) : 0;
  if (bal > 0) c = mixc(c, [.58, .55, .5], bal * .55 * (.65 + .35 * smooth(-.3, .3, fbm(x / 9, z / 9, 696, 2))));
  // snow on the heights, and in winter right down to the meadows (not on cliffs, not below water);
  // lower toward the poles, where the ice and the tundra keep some all year
  const line = snowLine(lat, env.yearFrac);
  c = mixc(c, PAL.snow, smooth(line - 5, line + 25, y + fbm(x / 40, z / 40, 7, 2) * 12) * smooth(.45, .25, steep) * (y > .3 ? 1 : 0) * (1 - noSnow * .85));
  const j = .92 + ih(Math.floor(x * 7), Math.floor(z * 7), 5) * .14;   // a little pigment variation per facet
  return [c[0] * j, c[1] * j, c[2] * j];
}
// the land's colour for the map (0..255; the map draws water itself)
export function mapColour(x, z) {
  const y = height(x, z), n = normalAt(x, z), c = groundColour(x, y, z, n[1]);
  return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
}

// A chunk of ground as flat-shaded triangles: pos, normal, colour, colour (two-sided slot).
// size: a far tile (render.js) is one big coarse chunk, sunk a little (drop) under the near ground
export function chunkMesh(cx, cz, N = CELLS, size = CHUNK, drop = 0) {
  const C = size / N, x0 = cx * size, z0 = cz * size;
  facet = C;
  const H = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = height(x0 + i * C, z0 + j * C) - drop;
  // the open sea floor is dead flat: one cell is the same picture as a thousand (its edges match
  // any neighbour's exactly, being the same flat height)
  if (N > 1 && H.every(h => h === H[0])) return chunkMesh(cx, cz, 1, size, drop);
  // the biomes are looked up once per few cells for colouring (they change over 100s of m)
  const BL = [], bs = N >= 36 ? 4 : 2, bn = N / bs;
  for (let j = 0; j < N; j += bs) for (let i = 0; i < N; i += bs) BL.push(blend(x0 + (i + bs / 2) * C, z0 + (j + bs / 2) * C));
  const out = new Float32Array((N * N * 2 + N * 8) * 3 * 12); let o = 0, bl = null, skirt = false;
  const bake = lookBakes(x0, z0, N, size, C, H, drop);
  // the ground's slope at an edge point of the grid (for the skirts: lit as the ground they hang
  // from, not as a wall, which showed as dark dashes along the seams wherever one peeked out)
  const at = (i, j) => H[Math.max(0, Math.min(N, j)) * (N + 1) + Math.max(0, Math.min(N, i))];
  const slope = (i, j) => { const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * C), gz = (at(i, j + 1) - at(i, j - 1)) / (2 * C), l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]; };
  let skirtN = null;
  const tri = (ax, ay, az, bx, by, bz, cx_, cy, cz_) => {
    let ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx_ - ax, vy = cy - ay, vz = cz_ - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (skirtN) [nx, ny, nz] = skirtN;
    const mx = (ax + bx + cx_) / 3, mz = (az + bz + cz_) / 3, col = groundColour(mx, (ay + by + cy) / 3, mz, Math.abs(ny), bl);
    // a faint per-facet shade, so the ground reads as cut facets rather than noise
    const k = 1 + (ih(Math.floor(mx * 3), Math.floor(mz * 3), 77) - .5) * .05; col[0] *= k; col[1] *= k; col[2] *= k;
    let back = col;
    if (!skirt) {
      const a = bake.light(mx, mz, (ay + by + cy) / 3); col[0] *= a; col[1] *= a; col[2] *= a * (1 + (1 - a) * .25);
      back = bake.hills(mx, mz);
    }
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cx_, cy, cz_]]) {
      out[o++] = px; out[o++] = py; out[o++] = pz; out[o++] = nx; out[o++] = ny; out[o++] = nz;
      out[o++] = col[0]; out[o++] = col[1]; out[o++] = col[2]; out[o++] = back[0]; out[o++] = back[1]; out[o++] = back[2];
    }
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    bl = BL[Math.floor(j / bs) * bn + Math.floor(i / bs)];
    const xa = x0 + i * C, xb = xa + C, za = z0 + j * C, zb = za + C;
    const a = H[j * (N + 1) + i], b = H[j * (N + 1) + i + 1], c = H[(j + 1) * (N + 1) + i], d = H[(j + 1) * (N + 1) + i + 1];
    if ((i + j) & 1) { tri(xa, a, za, xa, c, zb, xb, b, za); tri(xb, b, za, xa, c, zb, xb, d, zb); }
    else { tri(xa, a, za, xa, c, zb, xb, d, zb); tri(xa, a, za, xb, d, zb, xb, b, za); }
  }
  // skirts: a short wall down from each edge, hiding the cracks where a finer chunk meets a coarser one
  const S = drop ? 30 : 3; skirt = true;
  for (let e = 0; e < N; e++) {
    for (const [i0, j0, i1, j1] of [[e, 0, e + 1, 0], [e + 1, N, e, N], [0, e + 1, 0, e], [N, e, N, e + 1]]) {
      bl = BL[Math.floor(Math.min(j0, N - 1) / bs) * bn + Math.floor(Math.min(i0, N - 1) / bs)];
      const xa = x0 + i0 * C, za = z0 + j0 * C, xb = x0 + i1 * C, zb = z0 + j1 * C, ha = H[j0 * (N + 1) + i0], hb = H[j1 * (N + 1) + i1];
      skirtN = slope((i0 + i1) / 2 | 0, (j0 + j1) / 2 | 0);
      tri(xa, ha, za, xb, hb, zb, xb, hb - S, zb); tri(xa, ha, za, xb, hb - S, zb, xa, ha - S, za);
    }
  }
  return out.subarray(0, o);
}

// The ground bakes:
// light(x, z, y): the hollow light (hollows and foot slopes darker, ridges a touch lighter,
// and the ground under trees), from the heights round about on a coarse grid;
// hills(x, z): the eight horizon heights round the spot packed into the back colour (2 + three
// 4-bit steps a channel; render.js COMMON_FS hills() reads them back);
const HILL_D = [10, 22, 45, 90, 180, 350, 650];
function lookBakes(x0, z0, N, size, C, H, drop) {
  const B = {};
  // a value grid laid over the chunk, every g metres or so, read back bilinearly
  const grid = (g, comps, fn) => {
    const n = Math.max(1, Math.round(size / g)), st = size / n, v = new Float32Array((n + 1) * (n + 1) * comps);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) fn(x0 + i * st, z0 + j * st, v, ((j * (n + 1)) + i) * comps);
    return (x, z, c) => {
      const fx = Math.min(n - 1e-6, Math.max(0, (x - x0) / st)), fz = Math.min(n - 1e-6, Math.max(0, (z - z0) / st)), i = fx | 0, j = fz | 0, u = fx - i, w = fz - j;
      const at = (a, b) => v[((b * (n + 1)) + a) * comps + c];
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - w) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * w;
    };
  };
  {
    const ao = grid(Math.max(6, C), 2, (x, z, v, o) => {
      let near = 0, far = 0;
      for (let q = 0; q < 6; q++) { const an = q * 1.047 + .3; near += height(x + Math.cos(an) * 12, z + Math.sin(an) * 12); far += height(x + Math.cos(an) * 45, z + Math.sin(an) * 45); }
      v[o] = near / 6; v[o + 1] = far / 6;
    });
    // the trees' patches (near chunks only, where a tree spans a few cells)
    let TD = null; const tn = Math.max(1, Math.round(size / Math.max(C, 1.5))), ts = size / tn;
    if (C <= 4) {
      TD = new Float32Array((tn + 1) * (tn + 1)).fill(1);
      for (const t of treesNear(x0 + size / 2, z0 + size / 2, size / 2 + 10)) {
        const R = t.s * (t.kind ? .28 : .4) + 1.2, i0 = Math.max(0, Math.floor((t.x - R - x0) / ts)), i1 = Math.min(tn, Math.ceil((t.x + R - x0) / ts)), j0 = Math.max(0, Math.floor((t.z - R - z0) / ts)), j1 = Math.min(tn, Math.ceil((t.z + R - z0) / ts));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(x0 + i * ts - t.x, z0 + j * ts - t.z); if (d < R) TD[j * (tn + 1) + i] = Math.min(TD[j * (tn + 1) + i], 1 - .3 * (1 - d / R) ** 1.4); }
      }
    }
    B.light = (x, z, y) => {
      const dn = ao(x, z, 0) - y - drop, df = ao(x, z, 1) - y - drop;
      let a = Math.min(1.06, Math.max(.62, 1 - Math.max(dn, 0) * .035 - Math.max(df, 0) * .009 + Math.max(-df, 0) * .002));
      if (TD) { const i = Math.round((x - x0) / ts), j = Math.round((z - z0) / ts); if (i >= 0 && j >= 0 && i <= tn && j <= tn) a *= TD[j * (tn + 1) + i]; }
      return a;
    };
  }
  {
    const hz = grid(Math.max(12, C), 8, (x, z, v, o) => {
      const h0 = Math.max(height(x, z), WATER);
      for (let k = 0; k < 8; k++) {
        const dx = Math.cos(k / 8 * 6.2832), dz = Math.sin(k / 8 * 6.2832); let t = 0;
        for (const d of HILL_D) t = Math.max(t, (height(x + dx * d, z + dz * d) - h0) / d);
        v[o + k] = Math.atan(t);
      }
    });
    B.hills = (x, z) => {
      const q = k => Math.round(Math.sqrt(Math.min(1, hz(x, z, k) / 1.5708)) * 15);
      return [2 + q(0) + q(1) * 16 + q(2) * 256, 2 + q(3) + q(4) * 16 + q(5) * 256, 2 + q(6) + q(7) * 16];
    };
  }
  return B;
}

// ---- trees -------------------------------------------------------------------------------
// Each tree: x, y, z, scale (height in m), yaw, kind (0 broadleaf, 1 pine), look, id.
// `kind` sets how a tree behaves (trunk, crown, collisions in flight.js); `look` which mesh
// draws it (shapes.js TREE_LOOKS) and where its limbs are. Shapes are in unit space (height 1);
// these numbers are shared by the meshes, the perches and collisions.
export const TREE = {
  trunkR: [.045, .04], trunkH: [.5, .35],
  crownY: .68, crownR: .3,                      // broadleaf crown sphere (soft)
  limbY: .42, limbL: .3,                        // broadleaf low limb, a perch under the canopy
  // perchable limbs: [turn from the tree's yaw, height, length] (broadleaf); pines get [turn, height, reach]
  limbs: [[[0, .42, .3], [2.3, .5, .27], [4.2, .36, .28]], [[0, .3, .26], [2.1, .42, .26], [4.2, .54, .18]]],
  limbR: [.018, .015],                           // limb thickness at the trunk (it tapers to half)
};
// the looks: 0 broadleaf, 1 pine, then the trees of the other lands, each with its own limbs
export const LOOK = { broadleaf: 0, pine: 1, birch: 2, redwood: 3, acacia: 4, saguaro: 5, joshua: 6, mangrove: 7, oak: 8, poplar: 9, spruce: 10, juniper: 11, willow: 12, sequoia: 13, larch: 14, palm: 15, kapok: 16, stonePine: 17, olive: 18, cypress: 19 };
export const LOOKS = [
  { kind: 0, limbs: TREE.limbs[0], limbR: TREE.limbR[0] },
  { kind: 1, limbs: TREE.limbs[1], limbR: TREE.limbR[1] },
  { kind: 0, limbs: [[0, .46, .2], [2.4, .56, .19], [4.3, .4, .2]], limbR: .014 },                     // birch
  { kind: 1, limbs: [[0, .32, .16], [2.1, .44, .15], [4.2, .56, .12]], limbR: .012 },                   // redwood
  { kind: 0, limbs: [[0, .56, .3], [2.2, .6, .28], [4.2, .54, .3]], limbR: .02 },                       // acacia
  { kind: 1, limbs: [[0, .42, .14], [3.1, .55, .12]], limbR: .035 },                                    // saguaro arms
  { kind: 1, limbs: [[0, .5, .22], [2.1, .56, .2], [4.1, .46, .22]], limbR: .03 },                      // Joshua tree
  { kind: 0, limbs: [[0, .44, .3], [2.3, .5, .28], [4.2, .4, .28]], limbR: .018 },                      // mangrove
  { kind: 0, limbs: [[0, .36, .38], [2.2, .42, .36], [4.3, .32, .37]], limbR: .026 },                   // spreading oak
  { kind: 0, limbs: [[0, .22, .14], [2.6, .28, .13]], limbR: .012 },                                    // poplar
  { kind: 1, limbs: [[0, .2, .2], [2.1, .27, .19], [4.2, .34, .17]], limbR: .011 },                     // spruce
  { kind: 0, limbs: [[.6, .38, .3], [3, .44, .27]], limbR: .022 },                                      // juniper
  { kind: 0, limbs: [[0, .4, .28], [2.1, .46, .3], [4.2, .38, .27]], limbR: .022 },                     // willow
  { kind: 1, limbs: [[0, .5, .17], [2.3, .58, .15], [4.4, .46, .16]], limbR: .016 },                    // giant sequoia
  { kind: 1, limbs: [[0, .24, .17], [2.1, .34, .15], [4.2, .44, .12]], limbR: .011 },                   // larch
  { kind: 0, limbs: [[.4, .87, .13], [2.5, .88, .12], [4.6, .87, .13]], limbR: .012 },                  // palm: the frond stems
  { kind: 0, limbs: [[0, .76, .28], [2.1, .78, .3], [4.2, .74, .28]], limbR: .022 },                    // kapok
  { kind: 1, limbs: [[0, .64, .22], [2.1, .67, .2], [4.2, .65, .23]], limbR: .018 },                    // stone pine
  { kind: 0, limbs: [[.5, .4, .28], [2.6, .44, .26], [4.5, .38, .28]], limbR: .022 },                   // olive
  { kind: 1, limbs: [], limbR: .01 },                                                                   // cypress: only its tip
];
// what grows where: each land's trees as [look, weight] (a weight may depend on the spot), mixed
// by a roll; each kind also comes and goes in its own slow patches, so a wood has stands of one
// kind running into another rather than an even salt-and-pepper. Willows and poplars keep to
// low wet ground, spruce to the heights, giant sequoias stand in groves in the high country and
// among the redwoods, the dry lands have junipers and cacti (no pines). w is where on the Earth
// (the cell's cont, lat, lon): cacti and Joshua trees are the Americas', the Sahara has acacias
// and date palms, the Med its olives and stone pines, and NATIVE keeps each tree to its continents.
const SIZE_OF = [[11, 8], [13, 8], [12, 7], [34, 18], [8, 4], [6, 5], [6, 4], [9, 5], [10, 7], [16, 7], [15, 9], [5, 4], [10, 5], [38, 18], [15, 8], [9, 6], [30, 12], [12, 6], [5, 3], [11, 6]];   // by look: [smallest grown height, extra]
const MIX = {
  meadow: (y, wet) => [[0, 5], [8, 3], [2, 1], [1, 1], [9, wet * 4], [12, wet * 3]],
  forest: (y, wet, hi) => [[0, 6], [8, 3], [2, 1.5], [1, 2 + hi * 4], [10, hi * 3], [9, wet * 2], [12, wet * 2]],
  lakeland: (y, wet, hi) => [[0, 4], [2, 2], [1, 2 + hi * 3], [8, 1.5], [12, wet * 5], [9, wet * 2]],
  birch: (y, wet, hi) => [[2, 8], [1, 1.5], [10, 1 + hi * 2], [0, .6]],
  redwood: (y, wet, hi, tr, w) => [[3, 7], [13, sierra(w) * 1.2], [10, 1], [0, 1], [12, wet * 2]],
  moor: (y, wet) => [[2, 3], [1, 1.5], [11, 1.5], [8, .6], [12, wet * 2]],
  mountains: (y, wet, hi, tr, w) => [[1, 3], [10, 2 + hi * 3], [13, sierra(w) * 2.2 * (1 - hi * .6)], [2, 1], [0, 1 - hi]],
  alpine: (y, wet, hi) => [[10, 5], [1, 3], [11, 1 - hi * .8]],
  cliffs: () => [[1, 3], [11, 2], [10, 1]],
  fjord: () => [[10, 4], [1, 3], [2, 1.5]],
  coast: (y, wet, hi, tr) => [[1, 4 * (1 - tr)], [11, 1.5 * (1 - tr)], [8, 1 - tr * .6], [15, 7 * tr]],
  karst: (y, wet, hi, tr) => [[0, 3], [11, 2 * (1 - tr)], [1, 1.5 * (1 - tr)], [8, 1], [9, wet * 2 * (1 - tr)], [15, (1 + wet * 2) * tr]],
  volcano: () => [[11, 3], [1, 1.5], [2, .5]],
  desert: (y, wet, hi, tr, w) => AMERICAS(w) ? [[5, 5], [6, 3], [11, 1], [9, wet * 2], [15, wet * 4]]
    : w.cont === 'oceania' ? [[4, 4], [0, 1.5], [15, wet * 3]]
    : w.lat > 35 ? [[11, 4], [9, wet * 3]]                                   // the Gobi: saxaul scrub
    : [[4, 3], [15, .2 + wet * 6], [11, .6]],                                // the Sahara and Arabia: acacias, date palms by water
  canyon: (y, wet, hi, tr, w) => [[11, 6], [5, 1], [4, 2], [9, wet * 5]],
  badlands: (y, wet) => [[11, 6], [6, .4], [9, wet * 5]],
  savanna: (y, wet, hi, tr) => [[4, 7], [0, 2], [11, .6], [9, wet * 2 * (1 - tr)], [15, wet * 3 * tr]],
  swamp: (y, wet, hi, tr) => [[7, 6], [12, 2 * (1 - tr)], [0, 1], [15, 1.5 * tr]],
  marsh: (y, wet) => [[12, 3 + wet * 2], [0, 2], [9, 1.5]],
  taiga: (y, wet) => [[10, 6], [14, 4], [1, 2.5], [2, 1.5], [12, wet * 1.5]],
  tundra: () => [[2, 3], [14, 2], [12, 1], [11, 1]],
  rainforest: (y, wet) => [[0, 6], [16, 1.1], [8, 2], [15, .4 + wet * 3], [7, wet * 2]],
  maquis: (y, wet, hi, tr, w) => [[18, 4], [17, 2.5], [19, 1.5], [8, 2], [11, 2], [9, wet * 2], [0, MED(w) ? 0 : 3]],
  steppe: (y, wet) => [[9, wet * 4 + .3], [12, wet * 2], [2, .4], [8, .5], [11, .5]],
};
// how big the trees of a land grow (stunted on the moor and the heights, tall in sheltered woods)
const SIZE_K = { moor: .7, alpine: .8, cliffs: .75, coast: .8, fjord: .9, volcano: .75, canyon: .85, badlands: .8, forest: 1.08, redwood: 1.1, tundra: .45, taiga: .95, rainforest: 1.6, maquis: .7, steppe: .8 };
// where each tree grows wild, by continent (w: the cell's cont, lat, lon); the rest grow anywhere
const AMERICAS = w => w.cont === 'n-america' || w.cont === 's-america';
const MED = w => w.lon > -10 && w.lon < 45 && w.lat > 29 && w.lat < 47;
const sierra = w => w.cont === 'n-america' && w.lon < -115 ? 1 : 0;   // giant sequoias: the Sierra Nevada's
const NORTHERN = w => w.cont === 'europe' || (w.cont === 'asia' && w.lat > 26) || (w.cont === 'n-america' && w.lat > 30) || (w.cont === 'africa' && w.lat > 28);   // (not the tropics)
const NATIVE = {
  1: w => NORTHERN(w) || w.cont === 's-america' || w.cont === 'n-america',   // pines (and Mexico's, and Chile's monkey puzzles)
  2: NORTHERN, 10: NORTHERN, 14: NORTHERN, 9: NORTHERN,              // birch, spruce, larch, poplar
  8: w => NORTHERN(w) || w.cont === 'n-america',                     // oaks (and Mexico's)
  3: AMERICAS, 13: sierra, 5: w => AMERICAS(w) && w.lat < 37, 6: w => w.cont === 'n-america' && w.lat < 38,   // redwoods, sequoias, saguaros, Joshua trees
  4: w => w.cont === 'africa' || w.cont === 'asia' || w.cont === 'oceania',   // acacias
  16: w => w.cont !== 'europe' && w.cont !== 'oceania',              // kapok
  17: MED, 18: MED,                                                  // stone pines, olives
  19: w => MED(w) || w.cont === 'n-america',                         // cypress (and the Monterey cypress)
  11: w => NORTHERN(w) || w.cont === 'africa',                       // junipers
};
function lookFor(b, x, z, y, r, f, w = {}) {
  const wet = smooth(5, 1.5, y), hi = smooth(45, 110, y), tr = smooth(30, 22, Math.abs(latAt(x, z)));   // tr: the tropics, where palms grow
  const list = (MIX[b] || MIX.meadow)(y, wet, hi, tr, w).filter(([look]) => !w.cont || !NATIVE[look] || NATIVE[look](w));
  if (!list.length) return LOOK.broadleaf;
  let sum = 0; const wt = list.map(([look, v]) => { v = Math.max(0, v) * Math.max(.05, 1 + 1.4 * fbm(x / 190, z / 190, 40 + look, 2)); sum += v; return v; });
  if (sum <= 0) return list[0][0];
  let pick = list[0][0], acc = 0;
  for (let i = 0; i < list.length; i++) if (r * sum < (acc += wt[i])) { pick = list[i][0]; break; }
  return pick;
}
// a tree's height: its kind's range, the land's, the grove's (old woods and young ones), and its
// own age: some saplings, most grown, now and then an old giant
function sizeOf(look, b, x, z, f, a, e) {
  const [s0, ds] = SIZE_OF[look], age = a < .16 ? .45 + a / .16 * .3 : a > .95 ? 1.2 + (a - .95) * 3 : 1;
  const grove = 1 + .16 * fbm(x / 420, z / 420, 39, 2), edge = .82 + .18 * smooth(-.1, .35, f);
  return (s0 + e * ds) * age * grove * edge * (SIZE_K[b] || 1);
}
// trees per 10 m spot, by how wooded the place is
const densityOf = (b, f, x, z, w) => {
  switch (b) {
    case 'desert': return w && !AMERICAS(w) ? .009 : .028;   // the Sahara's few acacias, the Sonoran's cactus forest
    case 'canyon': return .012;
    case 'badlands': return .004;
    case 'saltflat': return 0;
    case 'savanna': return fbm(x / 160, z / 160, 32, 2) > .15 ? .07 : .012;     // acacias in loose groves
    case 'swamp': return .3;
    case 'ice': return 0;
    case 'tundra': return .006;
    case 'steppe': return .02;
    case 'rainforest': return f > -.3 ? .6 : .3;
    case 'taiga': return f > .1 ? .5 : f > -.2 ? .2 : .04;
    default: return f > .32 ? .55 : f > .12 ? .2 : f > -.1 ? .03 : .008;
  }
};
const treeCache = new Map();
export function treesIn(cx, cz) {
  const key = cx + ',' + cz; let t = treeCache.get(key); if (t) return t;
  t = []; const G = 10, n = CHUNK / G;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = cx * n + i, gz = cz * n + j;
    const x = (gx + .15 + ih(gx, gz, 21) * .7) * G, z = (gz + .15 + ih(gx, gz, 22) * .7) * G;
    const p = ih(gx, gz, 23); if (p > .55) continue;
    const bl = blend(x, z), e = rollBiome(bl, ih(gx, gz, 27)), f = forestOf(x, z, bl);
    if (p > densityOf(e.name, f, x, z, e)) continue;
    const y = groundAt(x, z), wet = e.name === 'swamp';
    if ((wet ? y < -1.2 || y > 3 : y < 1.2) || y > 140) continue;
    const nm = normalAt(x, z); if (nm[1] < .82) continue;
    if (roadShade(x, z) > .25 || railNear(x, z) < 6) continue;   // nor on the old tracks and the railway
    const look = lookFor(e.name, x, z, y, ih(gx, gz, 28), f, e);
    const s = sizeOf(look, e.name, x, z, f, ih(gx, gz, 29), ih(gx, gz, 24));
    t.push({ x, y: y - .3, z, s, yaw: ih(gx, gz, 25) * 6.283, kind: LOOKS[look].kind, look, id: gx * 7919 + gz, tint: ih(gx, gz, 26) });
  }
  // clear the ground round each landmark; the giant oaks and willows are trees themselves
  for (const l of landmarksNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 30)) {
    if (l.kind === 'sight') continue;
    const clear = l.kind === 'falls' ? 26 : l.r + 8;
    for (let i = t.length - 1; i >= 0; i--) if (Math.hypot(t[i].x - l.x, t[i].z - l.z) < clear) t.splice(i, 1);
    if (l.kind !== 'oak' && l.kind !== 'willow' && l.kind !== 'giant') continue;
    if (Math.floor(l.x / CHUNK) !== cx || Math.floor(l.z / CHUNK) !== cz) continue;
    const look = l.kind === 'giant' ? LOOK.redwood : l.kind === 'willow' ? LOOK.willow : LOOK.oak;
    t.push({ x: l.x, y: l.y - .5, z: l.z, s: l.h, yaw: l.yaw, kind: LOOKS[look].kind, look, id: 900001 + (cx * 31 + cz) * 7, tint: l.kind === 'willow' ? .9 : .2, landmark: l.id });
  }
  // and off the old buildings, but a young tree grows up through each roofless shell
  for (const bd of buildingsNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 16)) {
    const clear = clearOf(bd);
    for (let i = t.length - 1; i >= 0; i--) if (Math.hypot(t[i].x - bd.x, t[i].z - bd.z) < clear) t.splice(i, 1);
    if (saplingIn(bd) && Math.floor(bd.x / CHUNK) === cx && Math.floor(bd.z / CHUNK) === cz) {
      const r = ih(Math.round(bd.x), Math.round(bd.z), 696), look = bd.y > 60 ? LOOK.pine : LOOK.broadleaf;
      t.push({ x: bd.x + (r - .5) * 1.5, y: bd.y - .2, z: bd.z + (r - .5), s: 6 + r * 4, yaw: r * 6.283, kind: LOOKS[look].kind, look, id: 3e7 + Math.round(bd.x) * 7 + Math.round(bd.z) * 131, tint: r });
    }
  }
  treeCache.set(key, t);
  if (treeCache.size > 600) treeCache.delete(treeCache.keys().next().value);
  return t;
}
export function treesNear(x, z, r) {
  const out = [], c0 = Math.floor((x - r) / CHUNK), c1 = Math.floor((x + r) / CHUNK), d0 = Math.floor((z - r) / CHUNK), d1 = Math.floor((z + r) / CHUNK);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) for (const t of treesIn(cx, cz)) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r) out.push(t);
  return out;
}
// ---- bushes --------------------------------------------------------------------------------
// Bushes 1 to 3 m tall: leafy shrubs at wood edges and in meadow thickets, gorse on the moors and
// the coast, sagebrush in the dry lands, thorn bushes on the savanna. A bird can stand on top of
// one (solidsNear gives each a perch there, soft: true). { x, y, z, s (height), w (width/height),
// yaw, kind (prop name, shapes.js BUSH_SHAPES), tint, id }. Drawn by sys/bushes.js.
const BUSH_LANDS = {
  moor: ['gorse', .09, 1.2, .8], coast: ['gorse', .06, 1.1, .7], cliffs: ['gorse', .04, 1, .6],
  desert: ['sage', .035, 1, .6], canyon: ['sage', .06, 1.1, .6], badlands: ['sage', .045, 1, .6], volcano: ['sage', .015, .9, .5],
  savanna: ['thorn', .06, 1.6, 1.1], saltflat: null, alpine: ['gorse', .02, .8, .5], ice: null,
  tundra: ['heath', .07, .8, .7], steppe: ['sage', .05, .9, .7], maquis: ['gorse', .12, 1.3, .9],
};
const bushCache = new Map();
export function bushesIn(cx, cz) {
  const key = cx + ',' + cz; let out = bushCache.get(key); if (out) return out;
  out = []; const G = 8, n = CHUNK / G, trees = treesIn(cx, cz);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = cx * n + i, gz = cz * n + j, p = ih(gx, gz, 161); if (p > .2) continue;
    const x = (gx + .15 + ih(gx, gz, 162) * .7) * G, z = (gz + .15 + ih(gx, gz, 163) * .7) * G;
    const bl = blend(x, z), b = rollBiome(bl, ih(gx, gz, 164)).name, f = forestOf(x, z, bl);
    const clump = smooth(-.1, .5, fbm(x / 70, z / 70, 165, 2));   // they grow in thickets
    let L = BUSH_LANDS[b];   // (null: none there, the salt pan and the ice)
    if (L === undefined) {   // the green lands: wood edges thick with them, a few thickets out in the open, few under the trees
      const d = f > .32 ? .02 : f > -.1 ? .13 : .025 + .07 * clump;
      L = ['bush', d, 1.6, 1];
    }
    if (!L || p > L[1] * (.4 + 1.2 * clump)) continue;
    const y = groundAt(x, z); if (y < 1 || y > 170) continue;
    if (normalAt(x, z)[1] < .78) continue;
    if (roadShade(x, z) > .25 || railNear(x, z) < 6) continue;
    if (trees.some(t => Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3)) continue;
    const s = L[2] * (.6 + ih(gx, gz, 166) * .5 + clump * .25) + L[3] * ih(gx, gz, 167) * .5;
    out.push({ x, y: y - .1, z, s, w: L[0] === 'sage' ? 1.3 : L[0] === 'thorn' ? 1.4 : 1.15, yaw: ih(gx, gz, 168) * 6.283, kind: L[0], tint: ih(gx, gz, 169), id: 5e7 + gx * 7919 + gz });
  }
  for (const bd of buildingsNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 16)) {
    const clear = clearOf(bd);
    for (let i = out.length - 1; i >= 0; i--) if (Math.hypot(out[i].x - bd.x, out[i].z - bd.z) < clear) out.splice(i, 1);
  }
  for (const l of landmarksNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 30)) {
    if (l.kind === 'sight') continue;
    for (let i = out.length - 1; i >= 0; i--) if (Math.hypot(out[i].x - l.x, out[i].z - l.z) < (l.kind === 'falls' ? 26 : l.r + 6)) out.splice(i, 1);
  }
  bushCache.set(key, out);
  if (bushCache.size > 600) bushCache.delete(bushCache.keys().next().value);
  return out;
}
export function bushesNear(x, z, r) {
  const out = [], c0 = Math.floor((x - r) / CHUNK), c1 = Math.floor((x + r) / CHUNK), d0 = Math.floor((z - r) / CHUNK), d1 = Math.floor((z + r) / CHUNK);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) for (const o of bushesIn(cx, cz)) if (Math.abs(o.x - x) < r && Math.abs(o.z - z) < r) out.push(o);
  return out;
}
// how high the top of a bush's mesh is (unit height; the round shrub and gorse dome a little under 1)
export const BUSH_TOP = { bush: 1.01, gorse: .97, sage: .98, thorn: .95, heath: .8 };

// where a hawk can sit on a tree: the crown top, and out along each of its look's limbs
export function perchesOf(t) {
  const L = LOOKS[t.look ?? t.kind] || LOOKS[t.kind];
  const p = [{ x: t.x, y: t.y + t.s * (t.kind ? 1.0 : .97), z: t.z, top: true }];
  // on top of the limb (its centre line rises .06 along it and it tapers to half its thickness)
  const f = t.kind ? .85 : .75;
  for (const [o, y, l] of L.limbs) {
    const a = t.yaw + o, r = l * f, top = y - .04 + f * .06 + L.limbR * (1 - f * .5);
    p.push({ x: t.x + Math.cos(a) * t.s * r, y: t.y + t.s * top, z: t.z + Math.sin(a) * t.s * r, top: false, a });
  }
  return p;
}

// ---- landmarks ---------------------------------------------------------------------------
// Sights worth remembering. The great sights belong to a whole land and stand in the middle of
// its cell: the lighthouse on a coast, the fire mountain, a summit cairn on the snowy peaks, the
// great arch of a canyon, a giant redwood, a fjord's waterfall, and places that are sights in
// themselves ('sight': the stone forest, the salt pan, the painted hills, the singing dunes).
// Then one maybe per 1300 m cell, its kind suited to its land, and the marsh's old willow at the
// end of the journey. { id, name, kind, x, y, z, r, h, yaw }.
// The giant oaks, willows and redwoods are trees too (see treesIn), so they can be perched on.
export const LM_CELL = 1300;
const LM_NAMES = {
  oak: ['The Old Oak', 'The Elder Oak', 'Grandfather Oak', 'The Hollow Oak'],
  stones: ['The Standing Stones', 'The Heron Stones', 'The Grey Stones', 'The Nine Maidens'],
  redstones: ['The Red Stones', 'The Sun Stones', 'The Sand Circle'],
  cairn: ['The Shepherd\'s Cairn', 'The High Cairn', 'The Wind Cairn'],
  summit: ['The Summit Cairn', 'The Snow Crown', 'The Eagle\'s Peak'],
  tower: ['The Ruined Tower', 'The Watchtower', 'The Lonely Tower'],
  falls: ['Silver Falls', 'The Long Falls', 'Mist Falls', 'The Bridal Veil'],
  lighthouse: ['The Lighthouse', 'The North Light', 'Gull Point Light'],
  willow: ['The Old Willow'],
  volcano: ['The Fire Mountain', 'The Smoking Hill', 'Ember Peak'],
  arch: ['The Great Arch', 'The Sky Bridge', 'The Window Rock'],
  giant: ['The Grandfather Redwood', 'The Tallest Tree', 'The Cathedral Tree'],
  karst: ['The Stone Forest', 'The Hundred Towers'], saltflat: ['The White Pan', 'The Salt Mirror'],
  badlands: ['The Painted Hills', 'The Striped Hills'], desert: ['The Singing Dunes', 'The Golden Sea'],
  barn: ['The Old Barn', 'The Red Barn', 'The Owl Barn', 'The Hay Barn'], lookout: ['The Fire Lookout', 'The Ranger\'s Lookout', 'Pine Watch'],
  windmill: ['The Old Windmill', 'The Iron Mill', 'The Wind Pump'], stack: ['The Old Man', 'The Needle', 'The Gull Stack', 'The Lone Stack'],
};
const SIZE = { oak: [40, 14], willow: [30, 12], giant: [70, 12], stones: [4, 9], cairn: [3, 2], tower: [22, 5], falls: [0, 6], lighthouse: [26, 4], volcano: [0, 240], arch: [30, 16], sight: [0, 260], barn: [9, 8], lookout: [17, 4], windmill: [13, 3], stack: [30, 4] };
const lmCache = new Map();
const nameOf = (kind, a, b) => { const n = LM_NAMES[kind]; return n[Math.floor(ih(a, b, 85) * n.length)]; };
function fixedLandmarks() {
  if (lmCache.has('fixed')) return lmCache.get('fixed');
  const L = [];
  lmCache.set('fixed', L);
  return L;
}
function finishLandmark(l, seed) {
  // nudge off water and onto fairly level ground
  const fixed = l.kind === 'falls' || l.kind === 'volcano' || l.kind === 'sight' || l.kind === 'lighthouse' || l.kind === 'stack';
  for (let n = 0; n < 12 && !fixed && (height(l.x, l.z) < 1.5 || normalAt(l.x, l.z)[1] < .8); n++) { l.x += Math.cos(n * 2.4) * 30; l.z += Math.sin(n * 2.4) * 30; }
  l.y = height(l.x, l.z); l.yaw = ih(l.x | 0, l.z | 0, seed) * 6.283;
  [l.h, l.r] = SIZE[l.kind];
  return l;
}
// a waterfall wants a sheer drop: look around for the steepest step down
function fallsSpot(x, z) {
  let best = null;
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 20 + i * 14, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, n = normalAt(px, pz);
    if (n[1] > .5) continue;
    const dl = Math.hypot(n[0], n[2]), dx = n[0] / dl, dz = n[2] / dl, top = height(px - dx * 6, pz - dz * 6), bot = height(px + dx * 14, pz + dz * 14);
    if (top - bot > 18 && (!best || top - bot > best.drop)) best = { x: px - dx * 6, z: pz - dz * 6, drop: top - bot, dx, dz };
  }
  return best;
}
// the great sight of a land, in the middle of its cell
function cellSight(c) {
  const key = 'b' + c.gx + '_' + c.gz; if (lmCache.has(key)) return lmCache.get(key);
  let l = null; const { gx, gz, cx, cz } = c, id = 'b' + gx + '_' + gz;
  if (blend(cx, cz)[0].name === c.name) switch (c.name) {
    case 'coast': {
      // walk out from the bay until there is land, and stand the light on the headland
      // on the real shore: the high ground nearest the sea within the land's patch
      for (let i = 0; i < 90 && !l; i++) { const a = i * 2.39996, r = 20 + i * 8, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, d = coastDist(x, z); if (d > 15 && d < 80 && height(x, z) > 6) l = { kind: 'lighthouse', x, z }; }
      break;
    }
    case 'volcano': l = { kind: 'volcano', x: cx, z: cz }; break;
    case 'alpine': {
      let best = null;
      for (let i = 0; i < 48; i++) { const a = i * 2.39996, r = 15 + i * 7, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = height(x, z); if (!best || h > best.h) best = { x, z, h }; }
      l = { kind: 'cairn', x: best.x, z: best.z, summit: 1 };
      break;
    }
    case 'canyon': l = { kind: 'arch', x: cx, z: cz }; break;
    case 'redwood': l = { kind: 'giant', x: cx, z: cz }; break;
    case 'fjord': case 'cliffs': { const f = fallsSpot(cx, cz); if (f) l = { kind: 'falls', x: f.x, z: f.z, drop: f.drop, dx: f.dx, dz: f.dz }; break; }
    case 'karst': case 'saltflat': case 'badlands': case 'desert': l = { kind: 'sight', x: cx, z: cz, of: c.name }; break;
  }
  if (l) {
    l.id = id; l.name = nameOf(l.summit ? 'summit' : l.of || l.kind, gx, gz);
    finishLandmark(l, 87);
    if (l.kind === 'arch' && (l.y < 2 || normalAt(l.x, l.z)[1] < .9)) l = null;   // an arch wants a level mesa top
    else if (l.kind !== 'volcano' && l.kind !== 'sight' && l.kind !== 'falls' && l.y < 1) l = null;
  }
  lmCache.set(key, l);
  return l;
}
// fire lookouts over the woods and sea stacks off the coasts (where the osprey nests); the
// barns and wind pumps stand with their farmsteads now (settle.js)
const LM_KIND = {
  forest: ['oak', 'oak', 'stones', 'lookout'], lakeland: ['oak', 'oak', 'stones'], birch: ['oak', 'stones', 'lookout'], meadow: ['tower', 'stones', 'oak'],
  savanna: ['tower', 'redstones'], cliffs: ['falls'], mountains: ['cairn', 'falls', 'lookout'], alpine: ['cairn'], fjord: ['falls', 'stack'], moor: ['stones', 'cairn', 'tower'],
  coast: ['stones', 'tower', 'stack', 'stack'], marsh: ['willow', 'stones'], swamp: [], desert: ['redstones'], canyon: ['redstones', 'falls'], badlands: ['redstones'],
  redwood: ['lookout'], taiga: ['lookout', 'stones'], tundra: ['cairn', 'stones'], steppe: ['stones', 'tower'], maquis: ['tower', 'stones'],
  rainforest: ['falls'],
};
// a sea stack wants shallow water just off the shore (a stack is a piece of the cliff the sea cut
// off, so it stands close in, never out in open water)
function stackSpot(x, z) {
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, r = 10 + i * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = height(px, pz); if (h < -1.5 && h > -6 && coastDist(px, pz) > -120) return [px, pz]; }
  return null;
}
// every land for the Journal's lands collection: its key, its name and its one sight to find
// (a landmark kind; 'summit' is the summit cairn, 'sight' the land itself, seen from the middle)
const SIGHT_OF = { coast: 'lighthouse', volcano: 'volcano', alpine: 'summit', canyon: 'arch', redwood: 'giant', fjord: 'falls', cliffs: 'falls', karst: 'sight', saltflat: 'sight', badlands: 'sight', desert: 'sight' };
export const LANDS = Object.keys(BIOMES).map(key => ({ key, label: BIOMES[key].label, sight: SIGHT_OF[key] || LM_KIND[key]?.[0] || null }));
function landmarkCell(gx, gz) {
  const key = gx + ',' + gz; if (lmCache.has(key)) return lmCache.get(key);
  let l = null;
  const x = (gx + .25 + ih(gx, gz, 81) * .5) * LM_CELL, z = (gz + .25 + ih(gx, gz, 82) * .5) * LM_CELL;
  if (ih(gx, gz, 83) < .42) {
    const kinds = LM_KIND[blend(x, z)[0].name];
    let kind = kinds?.[Math.floor(ih(gx, gz, 84) * kinds.length)];
    if (kind) {
      l = { id: 'l' + gx + '_' + gz, name: nameOf(kind, gx, gz), kind: kind === 'redstones' ? 'stones' : kind, x, z };
      if (kind === 'falls') { const f = fallsSpot(x, z); if (f) Object.assign(l, { x: f.x, z: f.z, drop: f.drop, dx: f.dx, dz: f.dz }); else { l.kind = 'cairn'; l.name = LM_NAMES.cairn[0]; } }
      if (kind === 'stack') { const p = stackSpot(x, z); if (p) [l.x, l.z] = p; else l.kind = null; }
      if (l.kind) finishLandmark(l, 86);
      if (l.kind === 'stack') l.h = -l.y + 12 + ih(gx, gz, 87) * 8;   // its top stands this far over its foot (stout: lands.js stack)
      else if (!l.kind || l.y < 1) l = null;
    }
  }
  lmCache.set(key, l);
  return l;
}
// the sights alone (settle.js places the farms and villages away from them)
export function sightsNear(x, z, r) {
  const out = [], inBox = l => l && Math.abs(l.x - x) < r && Math.abs(l.z - z) < r;
  for (const l of fixedLandmarks()) if (inBox(l)) out.push(l);
  for (const c of cellsNear(x, z, r + 400)) { const l = cellSight(c); if (inBox(l)) out.push(l); }
  const a = Math.floor((x - r) / LM_CELL), b = Math.floor((x + r) / LM_CELL), c = Math.floor((z - r) / LM_CELL), d = Math.floor((z + r) / LM_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
    const l = landmarkCell(gx, gz);
    // the great sights keep their country to themselves
    if (inBox(l) && !out.some(o => o.kind !== 'sight' && Math.hypot(o.x - l.x, o.z - l.z) < 350)) out.push(l);
  }
  return out;
}
// the sights and the abandoned villages (settle.js), each a place to find
export function landmarksNear(x, z, r) {
  const out = sightsNear(x, z, r);
  for (const S of settlementsNear(x, z, r, false)) if (S.lm && Math.abs(S.x - x) < r && Math.abs(S.z - z) < r) out.push(S.lm);
  out.push(...railLandmarks(x, z, r));
  return out;
}

// The landmarks worth finding (the Journal's Places, the Map's tally, the compass): every wonder
// and fire mountain, and over the rest of the Earth at most one in each NOTABLE cell, the most
// remarkable near the cell's anchor (falls and arches before lighthouses and stacks, before towers
// and old oaks). The rest stay in the world as scenery, not finds (James 10-24: under 100 in all,
// spread evenly; with the islands' sights and the two ice edges about 90).
export const NOTABLE = { cell: 10000, r: 3000 };
const RANK = { wonder: 9, volcano: 9, falls: 7, arch: 7, drowned: 6, lighthouse: 5, stack: 5, viaduct: 4, summit: 4, tower: 3, station: 3, lookout: 2, oak: 2, willow: 2, stones: 2, cairn: 1, derelict: 1, village: 1 };
const notableCache = new Map();
function notableIn(gx, gz) {
  const key = gx + ',' + gz; if (notableCache.has(key)) return notableCache.get(key);
  const C = NOTABLE.cell, ax = (gx + .3 + ih(gx, gz, 191) * .4) * C, az = (gz + .3 + ih(gx, gz, 192) * .4) * C;
  let best = null, bs = -1;
  for (const l of landmarksNear(ax, az, NOTABLE.r)) {
    if (l.kind === 'sight' || Math.floor(l.x / C) !== gx || Math.floor(l.z / C) !== gz) continue;
    const sc = (RANK[l.summit ? 'summit' : l.kind] || 1) * 1e5 - Math.hypot(l.x - ax, l.z - az);
    if (sc > bs) { bs = sc; best = l.id; }
  }
  notableCache.set(key, best);
  return best;
}
export function isNotable(l) {
  if (l.kind === 'wonder' || l.kind === 'volcano') return true;
  if (l.kind === 'sight') return false;
  return notableIn(Math.floor(l.x / NOTABLE.cell), Math.floor(l.z / NOTABLE.cell)) === l.id;
}

// Fence lines and dry-stone walls across the open farmland, maybe one run per 170 m cell:
// a rusted wire fence on posts (red-tails love fence posts) or a low wall of stacked stones.
// { id, kind: 'fence' | 'wall', posts: [[x, y, z, h], ...] } with a post every STEP metres along
// the drawn ground; a run stops at water, a steep bank or a tree line. A wall's h is how high it
// stands at that post: knee to waist high, rising and falling, tumbled down to a low heap here
// and there (its fallen stones lie beside it, sys/lands.js).
export const FENCE_CELL = 170;
const FENCE_LANDS = { meadow: .5, lakeland: .3, moor: .45, savanna: .3, birch: .12 };
const fenceCache = new Map();
function fenceCell(gx, gz) {
  const key = gx + ',' + gz; if (fenceCache.has(key)) return fenceCache.get(key);
  let f = null;
  const x = (gx + .2 + ih(gx, gz, 171) * .6) * FENCE_CELL, z = (gz + .2 + ih(gx, gz, 172) * .6) * FENCE_CELL, land = blend(x, z)[0].name;
  if (Math.hypot(x, z) > 160 && ih(gx, gz, 173) < (FENCE_LANDS[land] || 0)) {
    const kind = land === 'moor' || ih(gx, gz, 174) < .3 ? 'wall' : 'fence', step = kind === 'wall' ? 3 : 4;
    const a = ih(gx, gz, 175) * 6.283, bend = (ih(gx, gz, 176) - .5) * .012, n = 10 + Math.floor(ih(gx, gz, 177) * 20), posts = [];
    let px = x, pz = z, h = a;
    for (let i = 0; i < n; i++) {
      const y = groundAt(px, pz);
      if (y < 1 || groundNormal(px, pz)[1] < .8 || forest(px, pz) > .25) { if (posts.length > 3) break; posts.length = 0; }
      else {
        const k = posts.length, low = ih(gx * 37 + k, gz, 178) < .14 || ih(gx * 37 + k + 1, gz, 178) < .07;
        const wh = kind === 'wall' ? (low ? .18 + ih(gx, gz * 41 + k, 179) * .15 : .5 + .16 * Math.sin(k * .55 + gx) + ih(gx * 41 + k, gz, 180) * .3) : 1.3;
        posts.push([px, y, pz, wh]);
      }
      px += Math.cos(h) * step; pz += Math.sin(h) * step; h += bend * step;
    }
    if (posts.length > 3) f = { id: 'f' + gx + '_' + gz, kind, posts };
  }
  fenceCache.set(key, f); if (fenceCache.size > 1500) fenceCache.delete(fenceCache.keys().next().value);
  return f;
}
export function fencesNear(x, z, r) {
  const out = [], a = Math.floor((x - r - 120) / FENCE_CELL), b = Math.floor((x + r + 120) / FENCE_CELL), c = Math.floor((z - r - 120) / FENCE_CELL), d = Math.floor((z + r + 120) / FENCE_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const f = fenceCell(gx, gz); if (f && f.posts.some(p => Math.abs(p[0] - x) < r && Math.abs(p[2] - z) < r)) out.push(f); }
  // the farms' paddocks and the shepherds' folds
  for (const S of settlementsNear(x, z, r, false)) for (const f of S.fences) if (f.posts.some(p => Math.abs(p[0] - x) < r && Math.abs(p[2] - z) < r)) out.push(f);
  return out;
}

// Rocks in the open country, one maybe per 64 m cell: granite tors crowning the moors and the
// savanna's kopjes, red hoodoos (tall pillars with a cap stone) and small arches in the dry
// country, boulders in the high country, black lava rocks round the fire mountain, and skerries,
// low humps of rock just off the rocky shores (fjords, cliffs, moors, the Mediterranean's maquis,
// the north's rocky coasts; not the sandy tropics). (Tall thin sea stacks in open water were taken
// out, James 10-24: they looked unnatural.) { x, y, z, kind, s (height in m), yaw, id }.
// Solid, and a hawk can stand on top.
export const ROCK_CELL = 64;
const ROCKS = {
  moor: [['tor', .35], ['skerry', .25]], savanna: [['tor', .06]], canyon: [['hoodoo', .3], ['arch', .02]], badlands: [['hoodoo', .14]], desert: [['hoodoo', .03]],
  mountains: [['boulder', .2]], alpine: [['boulder', .22]], cliffs: [['skerry', .4], ['boulder', .14]], volcano: [['lava', .16]], fjord: [['skerry', .5]], coast: [['skerry', .45], ['boulder', .05]],
  tundra: [['skerry', .2], ['boulder', .22]], taiga: [['skerry', .12], ['boulder', .08]], maquis: [['skerry', .25], ['boulder', .1]], steppe: [['tor', .03]],
};
ROCKS.sahara = [['tor', .04]];   // the Old World's deserts: rounded sandstone outcrops
const ROCK_S = { tor: 5, hoodoo: 14, boulder: 2.4, lava: 2.2, arch: 12, skerry: 0 };
const rockCache = new Map();
function rockAt(gx, gz) {
  const key = gx + ',' + gz; if (rockCache.has(key)) return rockCache.get(key);
  let o = null;
  const x = (gx + .2 + ih(gx, gz, 151) * .6) * ROCK_CELL, z = (gz + .2 + ih(gx, gz, 152) * .6) * ROCK_CELL, p = ih(gx, gz, 153);
  const at = rollBiome(blend(x, z), ih(gx, gz, 156)), list = at.name === 'desert' && !AMERICAS(at) ? ROCKS.sahara : ROCKS[at.name];   // red hoodoos are the American deserts'
  // rocks gather in outcrops: thick in some patches, none in others
  const crop = smooth(.05, .45, fbm(x / 260, z / 260, 158, 2)) * 1.6;
  let kind = null, acc = 0;
  if (list && crop > 0) for (const [k, w] of list) if (p < (acc += w * .6 * crop)) { kind = k; break; }
  if (kind) {
    const y = groundAt(x, z), s = ROCK_S[kind] * (.7 + ih(gx, gz, 154) * .7), yaw = ih(gx, gz, 155) * 6.283, id = gx * 9973 + gz;
    if (kind === 'skerry') { if (y < -.4 && y > -5 && coastDist(x, z) > -220) o = { x, y, z, kind, s: -y + 1 + ih(gx, gz, 157) * 3.5, yaw, id }; }   // just off the shore, 1 to 4.5 m out of the water
    else if (y > 1 && groundNormal(x, z)[1] > (kind === 'arch' ? .92 : .82)) o = { x, y, z, kind, s, yaw, id };
  }
  rockCache.set(key, o); if (rockCache.size > 4000) rockCache.delete(rockCache.keys().next().value);
  return o;
}
export function rocksNear(x, z, r) {
  const out = [], a = Math.floor((x - r) / ROCK_CELL), b = Math.floor((x + r) / ROCK_CELL), c = Math.floor((z - r) / ROCK_CELL), d = Math.floor((z + r) / ROCK_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const o = rockAt(gx, gz); if (o) out.push(o); }
  return out;
}

// an arch as two legs (unit size: legs .42 out each side, .14 thick, the span on top to .85)
const archLegs = (o, s) => [-1, 1].map(k => ({ x: o.x + Math.cos(o.yaw) * .42 * s * k, z: o.z + Math.sin(o.yaw) * .42 * s * k }));
// solid things as upright cylinders { x, z, r, y0, top } (rocks, towers, the lighthouse, stones,
// cairns, arches), and where a hawk could stand on them, for flight to bump into and perch on
export function solidsNear(x, z, r) {
  const out = [];
  // a hard column (r, from y0 to top) with a perch where its drawn mesh really ends (feet on the
  // surface: the hawk adds its own height), by default on the middle of the top
  const pillar = (px, pz, rad, y0, top, perch = { x: px, y: top, z: pz }) => out.push({ x: px, z: pz, r: rad, y0, top, perch: { ...perch, top: true } });
  // rocks are drawn .3 m sunk into the ground (lands.js)
  const TOP = { tor: 1, hoodoo: 1, boulder: .75, lava: .7, skerry: 1 };
  for (const o of rocksNear(x, z, r + 10)) {
    if (o.kind === 'arch') { for (const g of archLegs(o, o.s)) pillar(g.x, g.z, .12 * o.s, o.y - 1, o.y - .3 + o.s * .68); continue; }
    const rad = { tor: .7, hoodoo: .16, boulder: .45, lava: .5, skerry: 1 }[o.kind] * o.s;
    pillar(o.x, o.z, rad, o.y - 1, o.y - .3 + o.s * TOP[o.kind]);
  }
  for (const l of landmarksNear(x, z, r + 30)) {
    // the tower is a hollow ruin: perch on its tallest piece of wall; the lighthouse on its gallery rail
    if (l.kind === 'tower') { const a = l.yaw + Math.PI / 9; pillar(l.x, l.z, 4, l.y - 1, l.y + 20.4, { x: l.x + Math.cos(a) * 3.35, y: l.y + 21.5, z: l.z + Math.sin(a) * 3.35 }); }
    if (l.kind === 'lighthouse') {   // the tower to its gallery, then the narrower lantern and cap
      pillar(l.x, l.z, 3.2, l.y - 1, l.y + 18.8, { x: l.x + 2.25, y: l.y + 18.8, z: l.z });
      pillar(l.x, l.z, 1.9, l.y + 18.8, l.y + 23.7, { x: l.x - 2.25, y: l.y + 18.8, z: l.z });
    }
    if (l.kind === 'cairn') pillar(l.x, l.z, .9, l.y - 1, l.y + 2.33);
    // the lookout's cabin roof, the stack's turf
    if (l.kind === 'lookout') pillar(l.x, l.z, 2.4, l.y - 1, l.y + 16.4, { x: l.x + 1.6, y: l.y + 16.4, z: l.z });
    if (l.kind === 'stack') pillar(l.x, l.z, .26 * l.h, l.y - 1, l.y - .3 + l.h);
    if (l.kind === 'arch') for (const g of archLegs(l, l.h)) pillar(g.x, g.z, .12 * l.h, l.y - 1, l.y - .5 + l.h * .68);
    if (l.kind === 'stones') for (let i = 0; i < 9; i++) {
      const a = i / 9 * 6.283, c = Math.cos(l.yaw), s = Math.sin(l.yaw), lx = Math.cos(a) * 8, lz = Math.sin(a) * 8, h = 2.6 + (i * 37 % 10) / 10 * 1.8;
      pillar(l.x + c * lx - s * lz, l.z + s * lx + c * lz, .55, l.y - 1, l.y + h);
    }
  }
  // the empty houses, barns, chapels and wells, and the bridges' parapets
  for (const bd of buildingsNear(x, z, r + 14)) buildingSolids(bd, pillar);
  for (const g of bridgesNear(x, z, r + 30)) bridgeSolids(g, pillar);
  for (const o of polesNear(x, z, r + 6)) poleSolids(o, pillar);
  railSolids(x, z, r, pillar);
  // bushes: stand on top; the sides are leaves (soft: brush through, don't bump)
  for (const o of bushesNear(x, z, r + 4)) { pillar(o.x, o.z, o.s * o.w * .3, o.y - .5, o.y + o.s * BUSH_TOP[o.kind]); Object.assign(out[out.length - 1], { soft: true, bush: o }); }
  // fence posts (perch on top) and the walls' coping stones
  for (const f of fencesNear(x, z, r + 4)) for (const p of f.posts) if (Math.abs(p[0] - x) < r + 4 && Math.abs(p[2] - z) < r + 4) pillar(p[0], p[2], f.kind === 'wall' ? .5 : .09, p[1] - 1, p[1] + p[3]);
  // whales, icebergs, floes and driftwood: a system's own pillars, each with a lasting perch
  // object (a moving one carries the bird with it: perch.ride)
  for (const f of env.solids) f(x, z, r, out);
  return out;
}

// ---- air ---------------------------------------------------------------------------------
// Thermals: one maybe per 240 m cell, over sunny ground. Each column leans a little downwind. They
// are wide (48 to 80 m across the core's radius), so a hawk soaring on spread wings can circle inside
// one and steer to stay in the strongest part, rather than be held in by the game.
export const THERMAL_CELL = 240;
export function thermalAt(gx, gz) {
  if (ih(gx, gz, 41) > .62) return null;
  const x = (gx + .2 + ih(gx, gz, 42) * .6) * THERMAL_CELL, z = (gz + .2 + ih(gx, gz, 43) * .6) * THERMAL_CELL;
  const y = height(x, z); if (y < 1) return null;   // none over lakes
  // the column tops out a few hundred metres over its ground (so mountains have them too)
  return { x, z, r: 48 + ih(gx, gz, 44) * 32, w: 3.6 + ih(gx, gz, 45) * 2.4, top: 245 + Math.max(0, y - 15) * .9 + ih(gx, gz, 46) * 180, id: gx * 104729 + gz };
}
export function thermalsNear(x, z, r) {
  const out = [], a = Math.floor((x - r) / THERMAL_CELL), b = Math.floor((x + r) / THERMAL_CELL), c = Math.floor((z - r) / THERMAL_CELL), d = Math.floor((z + r) / THERMAL_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const t = thermalAt(gx, gz); if (t) out.push(t); }
  // columns that come and go (a song at an arch wakes one: env.thermals, weather.js)
  for (const t of env.thermals) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r) out.push(t);
  // sun-warmed stone: a gentle column over each empty village
  for (const S of settlementsNear(x, z, r, false)) if (S.kind === 'village') out.push({ x: S.x, z: S.z, r: 40, w: 3, top: S.y + 280, id: 7e7 + Math.round(S.x) * 3 + Math.round(S.z) });
  // the fire mountain's warm breath: a strong, wide column over its smoking cone
  for (const l of landmarksNear(x, z, r + 60)) if (l.kind === 'volcano') out.push({ x: l.x, z: l.z, r: 80, w: 7, top: 720, id: Math.abs((l.x | 0) * 31 + (l.z | 0)), volcano: true });
  return out;
}
// the column's centre at height y (it drifts with the wind as it rises)
export const WIND = [1, 0, .25];
export const thermalCentre = (t, y) => [t.x + WIND[0] * y * .12, t.z + WIND[2] * y * .12];

// vertical air speed at a point: thermals, ridge lift on windward slopes, gentle sink elsewhere
export function airLift(x, y, z, sun) {
  let w = -.25;
  for (const t of thermalsNear(x, z, 140)) {
    const [tx, tz] = thermalCentre(t, y), d = Math.hypot(x - tx, z - tz);
    if (d > t.r * 1.6 || y > t.top) continue;
    const k = Math.exp(-(d * d) / (t.r * t.r * .55)) * smooth(t.top, t.top - 60, y) * smooth(-2, 15, y - height(x, z));
    // a cloud's shadow over the column's foot cools the ground: the thermal weakens (round eight C1)
    const sh = env.shade && !t.volcano ? env.shade(t.x, t.z) : 0;
    w += t.w * k * (.35 + .65 * sun) * env.thermal * (1 - .65 * sh) - (d > t.r ? .6 : 0);
  }
  const g = height(x, z), above = y - g;
  if (above < 70) {
    const n = normalAt(x, z), up = -(n[0] * WIND[0] + n[2] * WIND[2]);   // slope facing the wind
    if (up > 0) w += up * 9 * smooth(70, 10, above);
  }
  for (const f of env.lifts) w += f(x, y, z);
  return w;
}

// Rings come in courses: one maybe per 1100 m cell, a chain of 6 to 12 rings laid along a
// shape (a climbing spiral, an S-curve, switchbacks, a figure of eight, a long arc or a
// staircase). Each starts low, 10 to 20 m over the ground where a hawk can find it, and climbs
// ring by ring, so the boost from one carries the hawk up to the next. Easy courses climb
// gently with wide rings; hard ones climb steeply with small rings, wound tighter. The courses
// are laid afresh each day (setRingDay, from sys/rings.js).
export const RING_CELL = 1100;
const loopCache = new Map();
let ringDay = 0;
export function setRingDay(d) { if (d !== ringDay) { ringDay = d; loopCache.clear(); } }
const tri = t => 2 * Math.abs(t - Math.floor(t + .5));
// course shapes as paths in local metres (x along, z across), by a parameter t of about a metre
export const COURSES = {
  spiral: (t, k) => { const R = 45 + k * 25; return [Math.cos(t / R) * R, Math.sin(t / R) * R]; },
  scurve: (t, k) => [t, Math.sin(t / (60 + k * 30)) * (40 + k * 25)],
  zigzag: (t, k) => [t * .7, (tri(t / (150 + k * 60)) - .5) * (90 + k * 40)],
  eight: (t, k) => { const a = 90 + k * 40, u = t / (a * 1.2); return [Math.sin(u) * a, Math.sin(u) * Math.cos(u) * a]; },
  arc: (t, k) => { const R = 180 + k * 120; return [Math.sin(t / R) * R, (1 - Math.cos(t / R)) * R]; },
  stairs: (t, k) => { const w = 110 + k * 40, u = t / w; return [t * .9, Math.sin(t / 45) * 12 + smooth(.35, .65, tri(u / 2)) * 40]; },
};
const SHAPES = Object.keys(COURSES);
export function ringLoop(gx, gz) {
  const key = gx + ',' + gz; if (loopCache.has(key)) return loopCache.get(key);
  let L = null; const s = ringDay * 7 + 51, h = n => ih(gx, gz, s * 13 + n);
  if (h(0) < .35) {
    const x0 = (gx + .2 + h(1) * .6) * RING_CELL, z0 = (gz + .2 + h(2) * .6) * RING_CELL;
    const hard = h(3), level = hard < .4 ? 'easy' : hard < .8 ? 'steady' : 'hard';
    const shape = SHAPES[Math.floor(h(4) * SHAPES.length)], f = COURSES[shape], k = h(5), turn = h(6) * 6.283, flip = h(7) < .5 ? -1 : 1;
    const n = 6 + Math.floor(hard * 7), gap = 75 - hard * 12, rise = 4 + hard * 9, r = 6.5 - hard * 2;
    // walk the shape, a ring every `gap` metres along it
    const c = Math.cos(turn), sn = Math.sin(turn), at = t => { const [a, b] = f(t, k), [a0, b0] = f(0, k), u = a - a0, v = (b - b0) * flip; return [x0 + c * u - sn * v, z0 + sn * u + c * v]; };
    const pts = [at(0)];
    for (let t = 1; pts.length < n && t < 6000; t++) { const p = at(t), q = pts[pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= gap) pts.push(p); }
    // the course leads somewhere (R1): its last ring hangs over a landmark near by, else over rising
    // air (the last ring's lift carries you up into it, sys/rings.js)
    const lm = landmarksNear(x0, z0, 450).filter(l => l.name && Math.hypot(l.x - x0, l.z - z0) < 450)[0];
    const th = !lm && thermalsNear(x0, z0, 400).filter(t => !t.volcano).sort((a, c) => Math.hypot(a.x - x0, a.z - z0) - Math.hypot(c.x - x0, c.z - z0))[0];
    const end = lm ? { kind: 'place', name: lm.name, x: lm.x, z: lm.z } : th ? { kind: 'air', x: th.x, z: th.z } : null;
    if (end) { const [lx, lz] = pts[pts.length - 1], sx = end.x - lx, sz = end.z - lz; for (const p of pts) { p[0] += sx; p[1] += sz; } }
    const [sx0, sz0] = pts[0];
    const id = (gx * 7907 + gz * 31) * 64 + (ringDay % 64), y0 = Math.max(height(sx0, sz0), WATER) + 10 + h(8) * 10;
    L = { id, x: sx0, z: sz0, n: pts.length, shape, level, end, rings: [] };
    let y = y0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], g = Math.max(height(x, z), WATER);
      y = Math.max(y0 + i * rise, g + 12, i ? y : 0);
      // the ring's plane faces along the course: its normal (-sin yaw, cos yaw) is the way on
      const q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)], tx = q[0] - p[0], tz = q[1] - p[1];
      L.rings.push({ x, y, z, yaw: Math.atan2(-tx, tz), r, id: id * 16 + i, circuit: id, k: i, of: pts.length, level, end });
    }
  }
  loopCache.set(key, L); if (loopCache.size > 400) loopCache.delete(loopCache.keys().next().value);
  return L;
}
export function ringsNear(x, z, r) {
  const out = [], m = 1400, a = Math.floor((x - r - m) / RING_CELL), b = Math.floor((x + r + m) / RING_CELL), c = Math.floor((z - r - m) / RING_CELL), d = Math.floor((z + r + m) / RING_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
    const L = ringLoop(gx, gz); if (!L) continue;
    for (const q of L.rings) if (Math.abs(q.x - x) < r && Math.abs(q.z - z) < r) out.push(q);
  }
  return out;
}

// the middle of the nearest land of a kind (for testing: __aloft3d and the map's teleport)
export function findBiome(name, x = 0, z = 0) {
  for (let r = 1000; r <= 16000; r *= 2) {
    const c = cellsNear(x, z, r).filter(e => e.name === name).sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0];
    if (c) return [c.cx, c.cz];
  }
  return null;
}
