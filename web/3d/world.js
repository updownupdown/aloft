// The 3D world is a pure function of position and a seeded hash: terrain height, where trees
// stand, where thermals rise and rings hang. Only small caches are kept. The lands themselves
// (which biome is where, and each one's ground and colours) are in biomes.js; the seed and the
// noise in noise.js. Coordinates: x east, z south, y up, metres-ish. Water level is y = 0.
import { store } from './util.js';
import { ih, fbm, smooth, clamp, WORLD, newWorld } from './noise.js';
import { BIOMES, PAL, JOURNEY, blend, weightOf, share, rollBiome, cellsNear } from './biomes.js';
export { ih, fbm, WORLD, newWorld, PAL, JOURNEY, blend };

export const CHUNK = 96;
// Ground detail (Settings > Ground detail): cells per chunk side. 16 is 6 m facets, 24 (the
// default) 4 m, 32 3 m, 48 2 m. Triangles grow with the square: 1x, 2.25x, 4x, 9x. Chunks near
// the bird (NEAR_R) get twice as many a side, up to 48 (CELLS_NEAR; see cellsFor()).
export const GROUND = [[16, 'Coarse', '6 m facets'], [24, 'Fine', '4 m facets'], [32, 'Finer', '3 m facets, more for the GPU'], [48, 'Finest', '2 m facets, heavy: try it on a fast phone']];
export const NEAR_R = 160;
export let CELLS = 24, CELLS_NEAR = 48, CELL = CHUNK / CELLS_NEAR;
export function setGroundDetail(n) { CELLS = GROUND.some(g => g[0] === n) ? n : 24; CELLS_NEAR = Math.min(48, CELLS * 2); CELL = CHUNK / CELLS_NEAR; }
// how many cells a side for a chunk whose middle is d metres from the bird
export const cellsFor = d => (d < NEAR_R ? CELLS_NEAR : CELLS);
setGroundDetail(store.get('ground', 24));
export const WATER = 0;

// what systems change at run time: the snowline (0 summer .. 1 deep winter, chunks must be
// rebuilt when it moves), the thermals' strength, and extra lift (storm cells, waves, kettles)
export const env = { snow: 0, season: 'summer', seasonDay: 0, thermal: 1, lifts: [] };

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
  return blend(x, z)[0].b.label;
}

// ---- terrain -----------------------------------------------------------------------------
// The shared rolling ground, then each biome near the point shapes its own, blended by weight.
export function height(x, z) {
  const bl = blend(x, z), B = { big: fbm(x / 520, z / 520, 1, 3), mid: fbm(x / 150, z / 150, 2, 3), fine: fbm(x / 32, z / 32, 5, 2) };
  let h = 0;
  for (const e of bl) h += e.w * e.b.h(x, z, B, e);
  if (!bl[0].b.flat) h += B.fine * 1.6 * (1 - share(bl, 'saltflat'));
  // a valley floor near the start so the first flight begins over a meadow and pond
  const d0 = Math.hypot(x, z + 60);
  if (d0 < 260) h = h * smooth(30, 260, d0) + (1 - smooth(30, 260, d0)) * (6 + 10 * Math.min(1, d0 / 120) - 14 * Math.max(0, 1 - Math.hypot(x - 40, z + 150) / 55));
  return h;
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
  let f = fbm(x / 220, z / 220, 9, 2) - .35 * Math.max(0, 1 - Math.hypot(x, z + 60) / 200);
  for (const e of bl) f += e.w * e.b.forest;
  return f;
}
export const forest = (x, z) => forestOf(x, z, blend(x, z));

// ---- colours -------------------------------------------------------------------------------
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
  if (env.season === 'spring' || env.season === 'autumn') {
    const grassy = smooth(.0, .08, c[1] - c[0]) * (1 - own) * (y > 1.8 ? 1 : 0), f = forestOf(x, z, bl);
    if (env.season === 'spring') c = mixc(c, [c[0] * .9, c[1] * 1.05 + .015, c[2] * .85], grassy * smooth(0, 3, env.seasonDay + 1) * .5);
    else {
      const patch = smooth(.05, .4, fbm(x / 18, z / 18, 61, 2)), turn = smooth(0, 6, env.seasonDay + 1);
      c = mixc(c, mixc(PAL.wood, [.62, .4, .2], .55), grassy * smooth(.05, .35, f) * turn * .55);
      c = mixc(c, [.62, .58, .38], grassy * (1 - f) * patch * turn * .4);
    }
  }
  // snow on the heights, and in winter right down to the meadows (not on cliffs, not below water)
  const line = 185 - env.snow * 200;
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
export function chunkMesh(cx, cz, N = CELLS) {
  const C = CHUNK / N, x0 = cx * CHUNK, z0 = cz * CHUNK;
  const H = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = height(x0 + i * C, z0 + j * C);
  // the biomes are looked up once per few cells for colouring (they change over 100s of m)
  const BL = [], bs = N >= 36 ? 4 : 2, bn = N / bs;
  for (let j = 0; j < N; j += bs) for (let i = 0; i < N; i += bs) BL.push(blend(x0 + (i + bs / 2) * C, z0 + (j + bs / 2) * C));
  const out = new Float32Array((N * N * 2 + N * 8) * 3 * 12); let o = 0, bl = null, skirt = false;
  const tri = (ax, ay, az, bx, by, bz, cx_, cy, cz_) => {
    let ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx_ - ax, vy = cy - ay, vz = cz_ - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const mx = (ax + bx + cx_) / 3, mz = (az + bz + cz_) / 3, col = groundColour(mx, (ay + by + cy) / 3, mz, skirt ? 1 : Math.abs(ny), bl);
    // a faint per-facet shade, so the ground reads as cut facets rather than noise
    const k = 1 + (ih(Math.floor(mx * 3), Math.floor(mz * 3), 77) - .5) * .05; col[0] *= k; col[1] *= k; col[2] *= k;
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cx_, cy, cz_]]) {
      out[o++] = px; out[o++] = py; out[o++] = pz; out[o++] = nx; out[o++] = ny; out[o++] = nz;
      out[o++] = col[0]; out[o++] = col[1]; out[o++] = col[2]; out[o++] = col[0]; out[o++] = col[1]; out[o++] = col[2];
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
  const S = 3; skirt = true;
  for (let e = 0; e < N; e++) {
    for (const [i0, j0, i1, j1] of [[e, 0, e + 1, 0], [e + 1, N, e, N], [0, e + 1, 0, e], [N, e, N, e + 1]]) {
      bl = BL[Math.floor(Math.min(j0, N - 1) / bs) * bn + Math.floor(Math.min(i0, N - 1) / bs)];
      const xa = x0 + i0 * C, za = z0 + j0 * C, xb = x0 + i1 * C, zb = z0 + j1 * C, ha = H[j0 * (N + 1) + i0], hb = H[j1 * (N + 1) + i1];
      tri(xa, ha, za, xb, hb, zb, xb, hb - S, zb); tri(xa, ha, za, xb, hb - S, zb, xa, ha - S, za);
    }
  }
  return out.subarray(0, o);
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
export const LOOK = { broadleaf: 0, pine: 1, birch: 2, redwood: 3, acacia: 4, saguaro: 5, joshua: 6, mangrove: 7 };
export const LOOKS = [
  { kind: 0, limbs: TREE.limbs[0], limbR: TREE.limbR[0] },
  { kind: 1, limbs: TREE.limbs[1], limbR: TREE.limbR[1] },
  { kind: 0, limbs: [[0, .46, .2], [2.4, .56, .19], [4.3, .4, .2]], limbR: .014 },                     // birch
  { kind: 1, limbs: [[0, .32, .16], [2.1, .44, .15], [4.2, .56, .12]], limbR: .012 },                   // redwood
  { kind: 0, limbs: [[0, .56, .3], [2.2, .6, .28], [4.2, .54, .3]], limbR: .02 },                       // acacia
  { kind: 1, limbs: [[0, .42, .14], [3.1, .55, .12]], limbR: .035 },                                    // saguaro arms
  { kind: 1, limbs: [[0, .5, .22], [2.1, .56, .2], [4.1, .46, .22]], limbR: .03 },                      // Joshua tree
  { kind: 0, limbs: [[0, .44, .3], [2.3, .5, .28], [4.2, .4, .28]], limbR: .018 },                      // mangrove
];
// what grows where: [look, share] lists and the scale range, by biome
const lookFor = (b, x, z, y, r) => {
  const pineish = y > 60 || fbm(x / 300, z / 300, 31, 2) > .25;
  switch (b) {
    case 'birch': return r < .78 ? [LOOK.birch, 12, 7] : [LOOK.pine, 13, 8];
    case 'redwood': return r < .7 ? [LOOK.redwood, 34, 18] : [LOOK.broadleaf, 13, 8];
    case 'alpine': case 'fjord': case 'coast': return [LOOK.pine, 11, 8];
    case 'desert': return r < .65 ? [LOOK.saguaro, 6, 5] : [LOOK.joshua, 6, 4];
    case 'canyon': case 'badlands': return r < .6 ? [LOOK.pine, 5, 3] : [LOOK.saguaro, 6, 4];
    case 'savanna': return [LOOK.acacia, 8, 4];
    case 'swamp': return r < .8 ? [LOOK.mangrove, 9, 5] : [LOOK.broadleaf, 11, 6];
    case 'marsh': return [LOOK.broadleaf, 10, 6];
    default: return pineish ? [LOOK.pine, 13, 9] : [LOOK.broadleaf, 11, 9];
  }
};
// trees per 10 m spot, by how wooded the place is
const densityOf = (b, f, x, z) => {
  switch (b) {
    case 'desert': return .028;
    case 'canyon': return .012;
    case 'badlands': return .004;
    case 'saltflat': return 0;
    case 'savanna': return fbm(x / 160, z / 160, 32, 2) > .15 ? .07 : .012;     // acacias in loose groves
    case 'swamp': return .3;
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
    if (p > densityOf(e.name, f, x, z)) continue;
    const y = groundAt(x, z), wet = e.name === 'swamp';
    if ((wet ? y < -1.2 || y > 3 : y < 1.2) || y > 140) continue;
    const nm = normalAt(x, z); if (nm[1] < .82) continue;
    if (Math.hypot(x, z + 60) < 22) continue;   // keep the starting spot clear
    const [look, s0, ds] = lookFor(e.name, x, z, y, ih(gx, gz, 28));
    const s = s0 + ih(gx, gz, 24) * ds;
    t.push({ x, y: y - .3, z, s, yaw: ih(gx, gz, 25) * 6.283, kind: LOOKS[look].kind, look, id: gx * 7919 + gz, tint: ih(gx, gz, 26) });
  }
  // clear the ground round each landmark; the giant oaks and willows are trees themselves
  for (const l of landmarksNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 30)) {
    if (l.kind === 'sight') continue;
    const clear = l.kind === 'falls' ? 26 : l.r + 8;
    for (let i = t.length - 1; i >= 0; i--) if (Math.hypot(t[i].x - l.x, t[i].z - l.z) < clear) t.splice(i, 1);
    if (l.kind !== 'oak' && l.kind !== 'willow' && l.kind !== 'giant') continue;
    if (Math.floor(l.x / CHUNK) !== cx || Math.floor(l.z / CHUNK) !== cz) continue;
    const look = l.kind === 'giant' ? LOOK.redwood : LOOK.broadleaf;
    t.push({ x: l.x, y: l.y - .5, z: l.z, s: l.h, yaw: l.yaw, kind: LOOKS[look].kind, look, id: 900001 + (cx * 31 + cz) * 7, tint: l.kind === 'willow' ? .9 : .2, landmark: l.id });
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
  const L = [{ id: 'willow', name: 'The Old Willow', kind: 'willow', x: 60, z: JOURNEY.marsh + 400 }];
  for (const l of L) finishLandmark(l, 7);
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
      const a = ih(gx, gz, 331) * 6.283;
      for (let r = 200; r < 700; r += 6) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (height(x, z) > 8) { l = { kind: 'lighthouse', x: x + Math.cos(a) * 9, z: z + Math.sin(a) * 9 }; break; } }
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
// the old human traces too (no people): barns on farmland, fire lookouts over the woods,
// wind pumps on the open country, and sea stacks off the coasts (where the osprey nests)
const LM_KIND = {
  forest: ['oak', 'oak', 'stones', 'lookout'], lakeland: ['oak', 'oak', 'stones', 'barn'], birch: ['oak', 'stones', 'lookout'], meadow: ['tower', 'stones', 'oak', 'barn', 'barn', 'windmill'],
  savanna: ['tower', 'redstones', 'windmill', 'barn'], cliffs: ['falls'], mountains: ['cairn', 'falls', 'lookout'], alpine: ['cairn'], fjord: ['falls', 'stack'], moor: ['stones', 'cairn', 'tower', 'windmill'],
  coast: ['stones', 'tower', 'stack', 'stack'], marsh: ['willow', 'stones'], swamp: ['willow'], desert: ['redstones'], canyon: ['redstones', 'falls'], badlands: ['redstones'],
  redwood: ['lookout'], saltflat: ['windmill'],
};
// a sea stack wants open water 4 to 12 m deep near the shore
function stackSpot(x, z) {
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, r = 10 + i * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = height(px, pz); if (h < -4 && h > -12) return [px, pz]; }
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
  if (Math.hypot(x, z) > 500 && ih(gx, gz, 83) < .42) {
    const kinds = LM_KIND[blend(x, z)[0].name];
    let kind = kinds?.[Math.floor(ih(gx, gz, 84) * kinds.length)];
    if (kind) {
      l = { id: 'l' + gx + '_' + gz, name: nameOf(kind, gx, gz), kind: kind === 'redstones' ? 'stones' : kind, x, z };
      if (kind === 'falls') { const f = fallsSpot(x, z); if (f) Object.assign(l, { x: f.x, z: f.z, drop: f.drop, dx: f.dx, dz: f.dz }); else { l.kind = 'cairn'; l.name = LM_NAMES.cairn[0]; } }
      if (kind === 'stack') { const p = stackSpot(x, z); if (p) [l.x, l.z] = p; else l.kind = null; }
      if (l.kind) finishLandmark(l, 86);
      if (l.kind === 'stack') l.h = -l.y + 16 + ih(gx, gz, 87) * 14;   // its top stands this far over its foot
      else if (!l.kind || l.y < 1) l = null;
    }
  }
  lmCache.set(key, l);
  return l;
}
export function landmarksNear(x, z, r) {
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

// Fence lines and dry-stone walls across the open farmland, maybe one run per 170 m cell:
// a rusted wire fence on posts (red-tails love fence posts) or a low wall of stacked stones.
// { id, kind: 'fence' | 'wall', posts: [[x, y, z], ...] } with a post every STEP metres along
// the drawn ground; a run stops at water, a steep bank or a tree line.
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
      else posts.push([px, y, pz]);
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
  return out;
}

// Rocks in the open country, one maybe per 64 m cell: granite tors crowning the moors and the
// savanna's kopjes, red hoodoos (tall pillars with a cap stone) and small arches in the dry
// country, boulders in the high country, black lava rocks round the fire mountain, and sea
// stacks standing in the fjords and bays. { x, y, z, kind, s (height in m), yaw, id }.
// Solid, and a hawk can stand on top.
export const ROCK_CELL = 64;
const ROCKS = {
  moor: [['tor', .35]], savanna: [['tor', .06]], canyon: [['hoodoo', .3], ['arch', .02]], badlands: [['hoodoo', .14]], desert: [['hoodoo', .03]],
  mountains: [['boulder', .2]], alpine: [['boulder', .22]], cliffs: [['boulder', .14]], volcano: [['lava', .16]], fjord: [['stack', .35]], coast: [['stack', .3], ['boulder', .05]],
};
const ROCK_S = { tor: 5, hoodoo: 14, boulder: 2.4, lava: 2.2, arch: 12, stack: 0 };
const rockCache = new Map();
function rockAt(gx, gz) {
  const key = gx + ',' + gz; if (rockCache.has(key)) return rockCache.get(key);
  let o = null;
  const x = (gx + .2 + ih(gx, gz, 151) * .6) * ROCK_CELL, z = (gz + .2 + ih(gx, gz, 152) * .6) * ROCK_CELL, p = ih(gx, gz, 153);
  const list = ROCKS[rollBiome(blend(x, z), ih(gx, gz, 156)).name];
  // rocks gather in outcrops: thick in some patches, none in others
  const crop = smooth(.05, .45, fbm(x / 260, z / 260, 158, 2)) * 1.6;
  let kind = null, acc = 0;
  if (list && crop > 0) for (const [k, w] of list) if (p < (acc += w * .6 * crop)) { kind = k; break; }
  if (kind) {
    const y = groundAt(x, z), s = ROCK_S[kind] * (.7 + ih(gx, gz, 154) * .7), yaw = ih(gx, gz, 155) * 6.283, id = gx * 9973 + gz;
    if (kind === 'stack') { if (y < -4) o = { x, y, z, kind, s: -y + 8 + ih(gx, gz, 157) * 24, yaw, id }; }
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
  const TOP = { tor: 1, hoodoo: 1, boulder: .75, lava: .7, stack: 1 };
  for (const o of rocksNear(x, z, r + 10)) {
    if (o.kind === 'arch') { for (const g of archLegs(o, o.s)) pillar(g.x, g.z, .12 * o.s, o.y - 1, o.y - .3 + o.s * .68); continue; }
    const rad = { tor: .7, hoodoo: .16, boulder: .45, lava: .5, stack: .14 }[o.kind] * o.s;
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
    // the barn's roof ridge, the lookout's cabin roof, the wind pump's platform, the stack's turf
    if (l.kind === 'barn') { const c = Math.cos(l.yaw), s = Math.sin(l.yaw); for (const k of [-3.5, 0, 3.5]) pillar(l.x + c * k, l.z + s * k, 3.6, l.y - 1, l.y + 7.6, { x: l.x + c * k, y: l.y + 8.25, z: l.z + s * k }); }
    if (l.kind === 'lookout') pillar(l.x, l.z, 2.4, l.y - 1, l.y + 16.4, { x: l.x + 1.6, y: l.y + 16.4, z: l.z });
    if (l.kind === 'windmill') pillar(l.x, l.z, 1, l.y - 1, l.y + 11.2);
    if (l.kind === 'stack') pillar(l.x, l.z, .12 * l.h, l.y - 1, l.y - .3 + l.h);
    if (l.kind === 'arch') for (const g of archLegs(l, l.h)) pillar(g.x, g.z, .12 * l.h, l.y - 1, l.y - .5 + l.h * .68);
    if (l.kind === 'stones') for (let i = 0; i < 9; i++) {
      const a = i / 9 * 6.283, c = Math.cos(l.yaw), s = Math.sin(l.yaw), lx = Math.cos(a) * 8, lz = Math.sin(a) * 8, h = 2.6 + (i * 37 % 10) / 10 * 1.8;
      pillar(l.x + c * lx - s * lz, l.z + s * lx + c * lz, .55, l.y - 1, l.y + h);
    }
  }
  // fence posts (perch on top) and the walls' coping stones
  for (const f of fencesNear(x, z, r + 4)) for (const p of f.posts) if (Math.abs(p[0] - x) < r + 4 && Math.abs(p[2] - z) < r + 4) pillar(p[0], p[2], f.kind === 'wall' ? .5 : .09, p[1] - 1, p[1] + (f.kind === 'wall' ? .95 : 1.3));
  return out;
}

// ---- air ---------------------------------------------------------------------------------
// Thermals: one maybe per 240 m cell, over sunny ground. Each column leans a little downwind.
export const THERMAL_CELL = 240;
export function thermalAt(gx, gz) {
  if (ih(gx, gz, 41) > .62) return null;
  const x = (gx + .2 + ih(gx, gz, 42) * .6) * THERMAL_CELL, z = (gz + .2 + ih(gx, gz, 43) * .6) * THERMAL_CELL;
  const y = height(x, z); if (y < 1) return null;   // none over lakes
  // the column tops out a few hundred metres over its ground (so mountains have them too)
  return { x, z, r: 24 + ih(gx, gz, 44) * 16, w: 3.6 + ih(gx, gz, 45) * 2.4, top: 245 + Math.max(0, y - 15) * .9 + ih(gx, gz, 46) * 180, id: gx * 104729 + gz };
}
export function thermalsNear(x, z, r) {
  const out = [], a = Math.floor((x - r) / THERMAL_CELL), b = Math.floor((x + r) / THERMAL_CELL), c = Math.floor((z - r) / THERMAL_CELL), d = Math.floor((z + r) / THERMAL_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const t = thermalAt(gx, gz); if (t) out.push(t); }
  // the fire mountain's warm breath: a strong, wide column over its smoking cone
  for (const l of landmarksNear(x, z, r + 60)) if (l.kind === 'volcano') out.push({ x: l.x, z: l.z, r: 48, w: 7, top: 720, id: Math.abs((l.x | 0) * 31 + (l.z | 0)), volcano: true });
  return out;
}
// the column's centre at height y (it drifts with the wind as it rises)
export const WIND = [1, 0, .25];
export const thermalCentre = (t, y) => [t.x + WIND[0] * y * .12, t.z + WIND[2] * y * .12];

// vertical air speed at a point: thermals, ridge lift on windward slopes, gentle sink elsewhere
export function airLift(x, y, z, sun) {
  let w = -.25;
  for (const t of thermalsNear(x, z, 80)) {
    const [tx, tz] = thermalCentre(t, y), d = Math.hypot(x - tx, z - tz);
    if (d > t.r * 1.6 || y > t.top) continue;
    const k = Math.exp(-(d * d) / (t.r * t.r * .55)) * smooth(t.top, t.top - 60, y) * smooth(-2, 15, y - height(x, z));
    w += t.w * k * (.35 + .65 * sun) * env.thermal - (d > t.r ? .6 : 0);
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
    const id = (gx * 7907 + gz * 31) * 64 + (ringDay % 64), y0 = Math.max(height(x0, z0), WATER) + 10 + h(8) * 10;
    L = { id, x: x0, z: z0, n: pts.length, shape, level, rings: [] };
    let y = y0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], g = Math.max(height(x, z), WATER);
      y = Math.max(y0 + i * rise, g + 12, i ? y : 0);
      // the ring's plane faces along the course: its normal (-sin yaw, cos yaw) is the way on
      const q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)], tx = q[0] - p[0], tz = q[1] - p[1];
      L.rings.push({ x, y, z, yaw: Math.atan2(-tx, tz), r, id: id * 16 + i, circuit: id, k: i, of: pts.length, level });
    }
  }
  loopCache.set(key, L); if (loopCache.size > 400) loopCache.delete(loopCache.keys().next().value);
  return L;
}
export function ringsNear(x, z, r) {
  const out = [], m = 950, a = Math.floor((x - r - m) / RING_CELL), b = Math.floor((x + r + m) / RING_CELL), c = Math.floor((z - r - m) / RING_CELL), d = Math.floor((z + r + m) / RING_CELL);
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
