// Where people lived, long ago. Nobody does now: the farmsteads, the villages round their greens,
// the fishing hamlets on the shore, the shepherds' folds up on the hills, and the keepers'
// cottages under the dark lighthouses all stand empty, roofs fallen in, trees growing through
// them. Worn tracks still join them, with old stone bridges over the rivers (some broken), and
// the things people left lie about: bottles, china, keys, and here and there a real treasure.
// Like the rest of the world this is a pure function of the seed, kept in small caches.
//   settlementsNear(x, z, r) -> [{ id, kind, name, x, y, z, yaw, build: [...], fences, spots, lm }]
//   buildingsNear(x, z, r), roadShade(x, z) (0..1, for the ground's colour), bridgesNear(x, z, r)
// The meshes and the finding are sys/ruins.js; world.js asks here for solids, fences, trees to
// clear, the villages' landmarks and the warm air over them.
import { railNear } from './rail.js';
import { earthBiome, continentAt, regionAt } from './earth.js';
import { wondersNear, wonderSolids } from './wonders.js';
import { derelictsNear, derelictSolids } from './sea.js';
import { height, groundAt, normalAt, forest, riverAt, sightsNear } from './world.js';
import { blend } from './biomes.js';
import { ih, fbm, smooth } from './noise.js';

export const SETTLE_CELL = 600, ROAD_MAX = 1050;
// placing goes by the mean water level, not the tide's (world.js WATER), so it never changes
const WATER = 0;
// what was built where: [kind, chance] per land
const KINDS = {
  meadow: [['village', .22], ['farm', .45]], lakeland: [['village', .16], ['farm', .38]], savanna: [['farm', .26]],
  moor: [['farm', .2], ['fold', .24]], birch: [['farm', .2]], forest: [['farm', .06]], coast: [['hamlet', .5]],
  mountains: [['fold', .16]], fjord: [['hamlet', .25]],
  maquis: [['village', .14], ['farm', .3]], steppe: [['fold', .16], ['farm', .1]], taiga: [['farm', .05]], tundra: [['fold', .04]],
  desert: [['village', .05], ['farm', .04]], canyon: [['farm', .04]], badlands: [['farm', .04]], swamp: [['village', .1]], marsh: [['village', .1], ['farm', .08]],
  rainforest: [['village', .06]], karst: [['village', .12], ['farm', .2]], alpine: [['fold', .14]], volcano: [['farm', .06]],
};
// how thickly people lived, by continent (the Earth remap, 2026-10-22): Europe most, nobody on the ice
const DENSITY = { europe: 1.25, asia: .85, 'n-america': .8, africa: .65, 's-america': .65, oceania: .5, antarctica: 0 };
// how they built (ruinshapes.js styled): by the land first, then the region and the continent
const CROFT = new Set(['highlands', 'lochness', 'ireland', 'iceland', 'lakes', 'britain']);
export function styleOf(x, z) {
  const land = earthBiome(x, z), reg = regionAt(x, z)?.key, cont = continentAt(x, z);
  if (land === 'swamp' || land === 'marsh' || land === 'rainforest') return 'stilt';
  if (['desert', 'canyon', 'badlands', 'saltflat'].includes(land) || (land === 'savanna' && cont === 'africa') || reg === 'arabia' || reg === 'sahel' || reg === 'atlas') return 'adobe';
  if (land === 'taiga' || land === 'tundra' || reg === 'finland' || reg === 'sweden' || reg === 'norway' || reg === 'russia' || reg === 'canada' || reg === 'alaska') return 'log';
  if (CROFT.has(reg)) return 'croft';
  if (cont === 'n-america' || cont === 'oceania') return 'timber';
  return 'stone';
}
// building sizes (m): L long (local x), W wide, wall height, ridge height, how far round to clear
// trees. A building's door is on its +z side (the chapel's and the barn's on the +x end).
export const DIM = {
  cottage: { L: 8, W: 6, wall: 3.2, ridge: 5.6, clear: 8 }, keeper: { L: 8, W: 6, wall: 3.2, ridge: 5.6, clear: 8 },
  farmhouse: { L: 11, W: 7, wall: 5.4, ridge: 8.2, clear: 10 }, barn: { L: 12, W: 8, wall: 5, ridge: 8.25, clear: 11 },
  chapel: { L: 13, W: 7, wall: 4.6, ridge: 7.6, clear: 14 }, spire: { L: 4, W: 4, clear: 0 }, hut: { L: 5, W: 4, wall: 2.2, ridge: 3.6, clear: 6 },
  well: { L: 2, W: 2, clear: 3 }, pump: { L: 3, W: 3, clear: 4 }, cart: { L: 3.4, W: 1.6, clear: 3 }, boat: { L: 4, W: 1.6, clear: 3 },
};
// the walls left standing, by variant: 0 roofed (sagging, mossy), 1 roof fallen in, 2 a shell
export const WALL_LEFT = [1, 1, .62];
const NAME_A = ['Ash', 'Brack', 'Thorn', 'Hollin', 'Wren', 'Elder', 'Fern', 'Marl', 'Rush', 'Haw', 'Lark', 'Sallow', 'Alder', 'Briar', 'Cobble', 'Linden', 'Otter', 'Rook', 'Heron', 'Bramble'];
// a tree or a bird, then a landscape word (James, 2026-10-24: no settlement words, no Farm or Fold:
// a bird names the place by its ford, combe or mere)
const NAME_B = ['ford', 'combe', 'ley', 'hope', 'den', 'well', 'field', 'mere', 'holt'];
const nameAt = (gx, gz) => NAME_A[Math.floor(ih(gx, gz, 641) * NAME_A.length)] + NAME_B[Math.floor(ih(gx, gz, 642) * NAME_B.length)];

// ---- placing ---------------------------------------------------------------------------------
function spotOK(x, z, kind) {
  const y = height(x, z);
  if (kind === 'hamlet' ? y < 1.8 || y > 14 : y < 2.5 || y > 120) return false;
  if (normalAt(x, z)[1] < (kind === 'hamlet' ? .86 : .93) || forest(x, z) > (kind === 'fold' || kind === 'hamlet' ? .3 : .14)) return false;
  const r = riverAt(x, z); if (r && r.d < r.w + 30) return false;
  if (kind === 'hamlet' && seaward(x, z) === null) return false;
  return !sightsNear(x, z, 160).some(l => l.kind !== 'sight' && Math.hypot(l.x - x, l.z - z) < 150);
}
// the way down to open water within 60 m, or null
function seaward(x, z) {
  let best = null, lo = WATER - .8;
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, h = height(x + Math.cos(a) * 55, z + Math.sin(a) * 55); if (h < lo) { lo = h; best = a; } }
  return best;
}
// a building's footing: its lowest corner (its walls run down into the slope), or null where the
// ground is too steep or wet for it. The smooth height, not the drawn ground, so the chunk worker
// (whose ground detail may differ) places everything just the same.
function footing(x, z, yaw, d) {
  const c = Math.cos(yaw), s = Math.sin(yaw), L = d.L / 2, W = d.W / 2;
  let lo = 1e9, hi = -1e9;
  for (const [u, w] of [[-L, -W], [L, -W], [L, W], [-L, W], [0, 0]]) { const y = height(x + c * u - s * w, z + s * u + c * w); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return lo < WATER + .7 || hi - lo > 2.6 || railNear(x, z) < Math.max(L, W) + 6 ? null : lo;
}

function layout(kind, x, z, gx, gz) {
  const id = 's' + gx + '_' + gz, h = n => ih(gx, gz, 650 + n), yaw0 = h(0) * 6.283, c0 = Math.cos(yaw0), s0 = Math.sin(yaw0);
  const S = { id, kind, name: nameAt(gx, gz), x, y: height(x, z), z, yaw: yaw0, build: [], fences: [], spots: [], lanes: [] };
  const at = (u, w) => [x + c0 * u - s0 * w, z + s0 * u + c0 * w];
  const variant = (n, roofed = .5) => (h(n) < roofed ? 0 : h(n) < roofed + (1 - roofed) * .6 ? 1 : 2);
  const put = (k, px, pz, yaw, v = 0) => {
    const y = footing(px, pz, yaw, DIM[k]); if (y === null) return null;
    const b = { kind: k, x: px, y, z: pz, yaw, v, id: id + '_' + S.build.length }; S.build.push(b); return b;
  };
  // where a building's door is, and a spot just outside it
  const door = (b, out = 1.4) => { const d = DIM[b.kind], k = b.kind === 'barn' || b.kind === 'chapel' ? [d.L / 2 + out, 0] : [0, d.W / 2 + out]; return [b.x + Math.cos(b.yaw) * k[0] - Math.sin(b.yaw) * k[1], b.z + Math.sin(b.yaw) * k[0] + Math.cos(b.yaw) * k[1]]; };
  const spot = (px, pz, what) => S.spots.push({ x: px, y: groundAt(px, pz), z: pz, what });
  const facing = (px, pz, tx, tz) => Math.atan2(-(tx - px), tz - pz);   // a door (+z) toward a point
  if (kind === 'farm') {
    const house = put('farmhouse', x, z, yaw0, variant(1));
    if (!house) return null;
    const [bx, bz] = at(2, -24), barn = put('barn', bx, bz, yaw0 + Math.PI / 2, h(2) < .55 ? 0 : 1);
    const [wx, wz] = at(9, 10), well = put('well', wx, wz, h(3) * 6);
    if (h(4) < .6) { const [px, pz] = at(-18, -12); put('pump', px, pz, h(5) * 6.283, 0); }
    if (h(6) < .5) { const [px, pz] = at(13, -10); const cart = put('cart', px, pz, yaw0 + h(7) * 2); if (cart) spot(...door(cart, .2), 'cart'); }
    spot(...door(house), 'door');
    if (barn) { spot(...door(barn, .6), 'barn'); S.lanes.push([...door(barn, 2), ...door(house, 2)]); }
    if (well) spot(well.x + 1.3, well.z + .4, 'well');
    // the paddock past the barn: a wire fence (a stone wall on the moor) round a field, its gate open
    const wall = blend(x, z)[0].name === 'moor', step = wall ? 3 : 4, posts = [];
    const corners = [[-20, -38], [18, -38], [18, -66], [-20, -66]];
    for (let e = 0; e < 4; e++) {
      const [u0, w0] = corners[e], [u1, w1] = corners[(e + 1) % 4], n = Math.round(Math.hypot(u1 - u0, w1 - w0) / step);
      for (let i = 0; i < n; i++) {
        if (e === 0 && i < 2) continue;   // the gate
        const [px, pz] = at(u0 + (u1 - u0) * i / n, w0 + (w1 - w0) * i / n), y = groundAt(px, pz);
        if (height(px, pz) < 1 || forest(px, pz) > .3) { if (posts.length > 3) S.fences.push({ id: 'p' + id + '_' + S.fences.length, kind: wall ? 'wall' : 'fence', posts: posts.splice(0) }); posts.length = 0; continue; }
        const k = posts.length, low = ih(gx * 31 + k, gz, 661) < .15;
        posts.push([px, y, pz, wall ? (low ? .25 : .6 + ih(gx, gz * 31 + k, 662) * .35) : 1.3]);
      }
    }
    if (posts.length > 3) S.fences.push({ id: 'p' + id + '_' + S.fences.length, kind: wall ? 'wall' : 'fence', posts });
    S.yard = [...at(4, -8), 12];
  } else if (kind === 'village') {
    // a chapel at the head of the green, cottages round it with their doors toward the well
    const n = 5 + Math.floor(h(1) * 4), [cx, cz] = at(0, -34);
    const chapel = put('chapel', cx, cz, Math.atan2(z - cz, x - cx), h(2) < .6 ? 0 : 1);
    if (chapel) spot(...door(chapel, 1.2), 'chapel');
    for (let i = 0; i < n; i++) {
      const a = yaw0 - Math.PI / 2 + (i + 1) / (n + 1) * 5.4 - 2.7 + Math.PI + (h(10 + i) - .5) * .25, r = 27 + h(20 + i) * 9;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, b = put('cottage', px, pz, facing(px, pz, x, z), variant(30 + i, .4));
      if (!b) continue;
      S.lanes.push([...door(b, 2), x, z]);
      if (h(40 + i) < .6) spot(...door(b), 'door');
    }
    const well = put('well', x, z, h(3) * 6); if (well) spot(x - 1.2, z + .6, 'well');
    S.lm = { id: 'v' + id, name: S.name, kind: 'village', x, y: S.y, z, r: 30, h: 12, yaw: yaw0 };
  } else if (kind === 'hamlet') {
    // cottages in a row above the shore, doors to the sea, boats turned over on the beach
    const a = seaward(x, z), dx = Math.cos(a), dz = Math.sin(a), n = 3 + Math.floor(h(1) * 2);
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 13 + (h(10 + i) - .5) * 3, back = 10 + h(15 + i) * 6, px = x - dz * o - dx * back, pz = z + dx * o - dz * back;
      const b = put('cottage', px, pz, Math.atan2(-dx, dz), variant(20 + i, .35));
      if (b && h(30 + i) < .55) spot(...door(b), 'door');
      if (i % 2 === 0) for (let d = 6; d < 40; d += 2) {
        const bx = px + dx * d, bz = pz + dz * d, y = height(bx, bz);
        if (height(bx, bz) < WATER + 1.2) { const boat = y > WATER + .3 && put('boat', bx - dx, bz - dz, a + 1.2 + h(40 + i)); if (boat) spot(boat.x + 1.2 * dz, boat.z - 1.2 * dx, 'boat'); break; }
      }
    }
    if (!S.build.length) return null;
  } else if (kind === 'fold') {
    // a shepherd's hut and a round stone fold for the sheep, its gateway open
    const hut = put('hut', x, z, yaw0, h(1) < .4 ? 1 : 2);
    if (!hut) return null;
    spot(...door(hut), 'door');
    const [fx, fz] = at(15, 2), posts = [];
    for (let i = 2; i < 17; i++) {
      const a = i / 17 * 6.283 + yaw0, px = fx + Math.cos(a) * 8, pz = fz + Math.sin(a) * 8, y = groundAt(px, pz);
      if (height(px, pz) < 1) continue;
      posts.push([px, y, pz, ih(gx * 17 + i, gz, 671) < .2 ? .3 : .75 + ih(gx, gz * 17 + i, 672) * .3]);
    }
    if (posts.length > 3) S.fences.push({ id: 'f' + id, kind: 'wall', posts });
    spot(fx + .5, fz - .5, 'fold');
  }
  return S.build.length ? S : null;
}

const cache = new Map();
function settlementAt(gx, gz) {
  const key = gx * 100003 + gz; if (cache.has(key)) return cache.get(key);
  let S = null;
  const x0 = (gx + .25 + ih(gx, gz, 601) * .5) * SETTLE_CELL, z0 = (gz + .25 + ih(gx, gz, 602) * .5) * SETTLE_CELL;
  const dens = DENSITY[continentAt(x0, z0)] || 0;
  if (dens) {
    const list = KINDS[blend(x0, z0)[0].name], p = ih(gx, gz, 603) / dens;
    let kind = null, acc = 0;
    if (list) for (const [k, w] of list) if (p < (acc += w)) { kind = k; break; }
    // a few tries round the middle of the cell; a hamlet walks out from the bay to the shore
    if (kind) for (let n = 0; n < (kind === 'hamlet' ? 16 : 9) && !S; n++) {
      let x = x0 + Math.cos(n * 2.4) * n * 24, z = z0 + Math.sin(n * 2.4) * n * 24;
      if (kind === 'hamlet') {
        const a = n * .39 + p * 6.283; x = NaN;
        for (let r = 0; r < 420; r += 12) { const px = x0 + Math.cos(a) * r, pz = z0 + Math.sin(a) * r; if (height(px, pz) > 2.2) { x = px + Math.cos(a) * 8; z = pz + Math.sin(a) * 8; break; } }
        if (Number.isNaN(x)) continue;
      }
      if (spotOK(x, z, kind)) S = layout(kind, x, z, gx, gz);
    }
    if (S) { S.style = styleOf(S.x, S.z); for (const b of S.build) b.style = S.style; }
  }
  cache.set(key, S); if (cache.size > 3000) cache.delete(cache.keys().next().value);
  return S;
}
// the lighthouse keepers' cottages, and the fire lookouts' empty cabins (their towers are landmarks)
const sightCache = new Map();
function ofSight(l) {
  if (sightCache.has(l.id)) return sightCache.get(l.id);
  let S = null;
  if (l.kind === 'lighthouse') {
    // the cottage a little inland, its door toward the light
    let hi = -1e9, a = 0;
    for (let i = 0; i < 12; i++) { const t = i / 12 * 6.283, y = height(l.x + Math.cos(t) * 20, l.z + Math.sin(t) * 20); if (y > hi) { hi = y; a = t; } }
    const px = l.x + Math.cos(a) * 17, pz = l.z + Math.sin(a) * 17, yaw = Math.atan2(-(l.x - px), l.z - pz);
    S = { id: 'k' + l.id, kind: 'light', name: l.name, x: px, y: height(px, pz), z: pz, yaw, build: [], fences: [], lanes: [], spots: [] };
    const y = footing(px, pz, yaw, DIM.keeper);
    if (y !== null) S.build.push({ kind: 'keeper', x: px, y, z: pz, yaw, v: ih(l.x | 0, l.z | 0, 681) < .5 ? 0 : 1, id: S.id + '_0' });
    S.spots.push({ x: px - Math.sin(yaw) * 4.4, y: groundAt(px - Math.sin(yaw) * 4.4, pz + Math.cos(yaw) * 4.4), z: pz + Math.cos(yaw) * 4.4, what: 'door' });
    // up on the lamp gallery, beside where a hawk perches (world.js solidsNear)
    S.spots.push({ x: l.x + 2.3 * Math.cos(.6), y: l.y + 18.85, z: l.z + 2.3 * Math.sin(.6), what: 'gallery' });
    S.lanes.push([px, pz, l.x, l.z]);
  } else if (l.kind === 'lookout') {
    S = { id: 'k' + l.id, kind: 'watch', name: l.name, x: l.x, y: l.y, z: l.z, yaw: l.yaw, build: [], fences: [], lanes: [], spots: [{ x: l.x + 1.9, y: l.y + 13.85, z: l.z + 1.2, what: 'walk' }] };
  }
  sightCache.set(l.id, S);
  return S;
}
// A drowned village (B3): a valley flooded long ago for a reservoir. The church spire stands
// out of the lake with its weathervane (a perch); the cottages lie under the water, their
// roofs just at the surface, so in a dry summer (lower water) they break it. One maybe per
// DROWN_CELL in the lake lands, where a lake floor 4.5 to 7 m down is wide enough.
const DROWN_CELL = 2400, DROWN_LANDS = { lakeland: .6, meadow: .3, birch: .3, forest: .25, moor: .25 };
const drownCache = new Map();
function drownedAt(gx, gz) {
  const key = gx * 100003 + gz; if (drownCache.has(key)) return drownCache.get(key);
  let S = null;
  const x0 = (gx + .5) * DROWN_CELL, z0 = (gz + .5) * DROWN_CELL;
  if (ih(gx, gz, 731) < (DROWN_LANDS[blend(x0, z0)[0].name] || 0)) {
    for (let i = 0; i < 90 && !S; i++) {
      const a = i * 2.39996, r = 20 + i * 9, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, y = height(x, z);
      if (y > -4.5 || y < -7 || riverAt(x, z)?.d < 60) continue;
      if ([[30, 0], [-30, 0], [0, 30], [0, -30]].some(([u, w]) => height(x + u, z + w) > -2.5)) continue;   // open water all round
      const nm = nameAt(gx * 7 + 3, gz * 7 + 1);
      S = { id: 'd' + gx + '_' + gz, kind: 'drowned', name: nm, x, y, z, yaw: ih(gx, gz, 732) * 6.283, build: [{ kind: 'spire', x, y, z, yaw: ih(gx, gz, 733) * 6.283, v: 0, id: 'd' + gx + '_' + gz + '_0' }], fences: [], lanes: [], spots: [] };
      for (let k = 0; k < 14 && S.build.length < 7; k++) {
        const b2 = k * 2.39996 + 1, r2 = 16 + k * 3.5, px = x + Math.cos(b2) * r2, pz = z + Math.sin(b2) * r2, py = height(px, pz);
        if (py < -6.4 || py > -5) continue;
        S.build.push({ kind: 'cottage', x: px, y: py, z: pz, yaw: Math.atan2(-(x - px), z - pz), v: ih(gx * 5 + k, gz, 734) < .4 ? 0 : 1 + (ih(gx, gz * 5 + k, 735) < .5), id: S.id + '_' + S.build.length, under: true });
      }
      S.lm = { id: 'v' + S.id, name: 'The drowned spire at ' + nm, kind: 'drowned', x, y: 0, z, r: 20, h: 16, yaw: 0 };
    }
  }
  drownCache.set(key, S);
  return S;
}
// the settlements within r (a box), with the keepers' and fire watchers' places when `sights`
export function settlementsNear(x, z, r, sights = true) {
  const out = [], C = SETTLE_CELL, a = Math.floor((x - r - 80) / C), b = Math.floor((x + r + 80) / C), c = Math.floor((z - r - 80) / C), d = Math.floor((z + r + 80) / C);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const S = settlementAt(gx, gz); if (S && Math.abs(S.x - x) < r + 80 && Math.abs(S.z - z) < r + 80) out.push(S); }
  const D = DROWN_CELL;
  for (let gz = Math.floor((z - r - 80) / D); gz <= Math.floor((z + r + 80) / D); gz++) for (let gx = Math.floor((x - r - 80) / D); gx <= Math.floor((x + r + 80) / D); gx++) {
    const S = drownedAt(gx, gz); if (S && Math.abs(S.x - x) < r + 80 && Math.abs(S.z - z) < r + 80) out.push(S);
  }
  out.push(...wondersNear(x, z, r), ...derelictsNear(x, z, r + 80));
  if (sights) for (const l of sightsNear(x, z, r)) if (l.kind === 'lighthouse' || l.kind === 'lookout') { const S = ofSight(l); if (S) out.push(S); }
  return out;
}
export function buildingsNear(x, z, r) {
  const out = [];
  // (a wonder reaches as far as its clearing)
  for (const S of settlementsNear(x, z, r, false)) for (const b of S.build) { const e = r + (b.kind === 'wonder' ? b.clear : 0); if (Math.abs(b.x - x) < e && Math.abs(b.z - z) < e) out.push(b); }
  for (const S of settlementsNear(x, z, r)) if (S.kind === 'light') for (const b of S.build) if (Math.abs(b.x - x) < r && Math.abs(b.z - z) < r) out.push(b);
  return out;
}

// ---- tracks and bridges --------------------------------------------------------------------
// Each settlement's track runs to its nearest neighbour (a village's to its three nearest),
// bending gently, sampled every 10 m; one that would cross a lake or the sea, or climb a cliff,
// was never made. Where it crosses a river there is a stone bridge, a few of them fallen in
// the middle. The segments go into 48 m buckets for the ground's colour.
const RB = 48, buckets = new Map(), made = new Set(), linked = new Set(), ready = new Set(), bridges = [];
function addSeg(x0, z0, x1, z1, w, k) {
  const s = [x0, z0, x1, z1, w, k];
  for (let j = Math.floor((Math.min(z0, z1) - w) / RB); j <= Math.floor((Math.max(z0, z1) + w) / RB); j++)
    for (let i = Math.floor((Math.min(x0, x1) - w) / RB); i <= Math.floor((Math.max(x0, x1) + w) / RB); i++) {
      const key = i * 100003 + j; let B = buckets.get(key); if (!B) buckets.set(key, B = []); B.push(s);
    }
}
function makeRoad(p, q) {
  const key = p.id < q.id ? p.id + '|' + q.id : q.id + '|' + p.id; if (made.has(key)) return; made.add(key);
  if (p.id > q.id) [p, q] = [q, p];
  const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz), n = Math.max(2, Math.ceil(L / 10)), nx = -dz / L, nz = dx / L;
  const seed = ih(Math.round(p.x), Math.round(q.z), 691), bend = (seed - .5) * L * .2, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, ox = p.x + dx * t, oz = p.z + dz * t, off = Math.sin(Math.PI * t) * (bend + fbm(ox / 170, oz / 170, 692, 2) * 36);
    const x = ox + nx * off, z = oz + nz * off; pts.push([x, z, height(x, z)]);
  }
  // check it, and find the river crossings
  const crossings = []; let run = -1;
  for (let i = 0; i <= n; i++) {
    const [x, z, y] = pts[i];
    if (y > 150 || (i && Math.abs(y - pts[i - 1][2]) > 7)) return;
    const wet = y < WATER + .5;
    if (wet && run < 0) run = i;
    if (!wet && run >= 0) {
      if (i - run > 6) return;   // too wide: a lake or the sea
      const m = pts[(run + i - 1) >> 1], r = riverAt(m[0], m[1]); if (!r || r.d > r.w + 8 || run === 0) return;
      crossings.push([run - 1, i]); run = -1;
    }
  }
  if (run >= 0) return;
  for (let i = 0; i < n; i++) addSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3.2, .75);
  for (const [i0, i1] of crossings) {
    const a = pts[i0], b = pts[i1], y = Math.max(a[2], b[2], WATER + 2.2) + .3;   // over the highest tide
    bridges.push({ id: 'b' + key.replace(/[^a-z0-9]/gi, '') + i0, x0: a[0], z0: a[1], x1: b[0], z1: b[1], y, broken: ih(i0, Math.round(a[0]), 693) < .3 });
  }
  if (L > 280 && seed < .75) poleLine(key, pts, ih(Math.round(q.x), Math.round(p.z), 694) < .5 ? -1 : 1);
}
// An old pole line beside a track: leaning wooden poles every POLE_STEP metres a few metres off
// it, a crossarm with two wires sagging between them; some lean hard, a few have fallen, and
// here and there a wire has snapped and hangs. A red-tail's hunting line: perch pole to pole
// and watch the verge. { id, poles: [{ x, y, z, yaw, state (0 up, 1 leaning, 2 fallen), side, top }], box }
export const POLE = { step: 36, h: 7.5, off: 4.5, lean: .22 };
const lines = [];
function poleLine(key, pts, side) {
  const poles = [], id = 'w' + key.replace(/[^a-z0-9]/gi, '');
  let run = 0, next = 30, total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(z1 - z0, x1 - x0);
    while (run + l >= next) {
      const t = (next - run) / l, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
      const x = cx - Math.sin(yaw) * POLE.off * side, z = cz + Math.cos(yaw) * POLE.off * side, y = height(x, z), k = poles.length;
      next += POLE.step;
      if (y < WATER + .8 || next - POLE.step > total - 30) continue;   // none in the water, none right at either end
      const r = ih(Math.round(x * 3), Math.round(z * 3), 695), state = r < .1 ? 2 : r < .32 ? 1 : 0, lean = (r * 7 % 1) < .5 ? -1 : 1;
      const tilt = state === 1 ? POLE.lean : 0, py = yaw + (lean < 0 ? Math.PI : 0);
      const top = [x - Math.sin(py) * Math.sin(tilt) * POLE.h, y + Math.cos(tilt) * POLE.h, z + Math.cos(py) * Math.sin(tilt) * POLE.h];
      poles.push({ x, y, z, yaw: state === 1 ? py : yaw, line: yaw, state, top, k, id: id + '_' + k, snap: ih(k, Math.round(x), 696) < .18 });
    }
    run += l;
  }
  if (poles.length < 3) return;
  const xs = poles.map(o => o.x), zs = poles.map(o => o.z);
  lines.push({ id, poles, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] });
}
function ensureBox(x, z, r) {
  for (let gz = Math.floor((z - r) / SETTLE_CELL); gz <= Math.floor((z + r) / SETTLE_CELL); gz++)
    for (let gx = Math.floor((x - r) / SETTLE_CELL); gx <= Math.floor((x + r) / SETTLE_CELL); gx++) ensure(gx, gz);
}
export function linesNear(x, z, r) {
  ensureBox(x, z, r);
  return lines.filter(L => L.box[0] - r < x && L.box[2] + r > x && L.box[1] - r < z && L.box[3] + r > z);
}
export function polesNear(x, z, r) {
  const out = [];
  for (const L of linesNear(x, z, r)) for (const o of L.poles) if (Math.abs(o.x - x) < r && Math.abs(o.z - z) < r) out.push(o);
  return out;
}
function linkFrom(S) {
  if (linked.has(S.id) || S.kind === 'drowned') return; linked.add(S.id);
  const nb = settlementsNear(S.x, S.z, ROAD_MAX).filter(o => o !== S && o.kind !== 'drowned' && o.kind !== 'wonder' && o.kind !== 'derelict').map(o => [o, Math.hypot(o.x - S.x, o.z - S.z)]).filter(o => o[1] < ROAD_MAX).sort((a, b) => a[1] - b[1]);
  for (const [o] of nb.slice(0, S.kind === 'village' ? 3 : 1)) makeRoad(S, o);
  // the lanes in a settlement: door to the green, house to barn; and the trodden yard
  for (const [x0, z0, x1, z1] of S.lanes) addSeg(x0, z0, x1, z1, 2.2, .55);
  if (S.yard) addSeg(S.yard[0], S.yard[1], S.yard[0], S.yard[1], S.yard[2], .4);
}
// everything that could reach the settlement cell (gx, gz) is laid
function ensure(gx, gz) {
  const key = gx * 100003 + gz; if (ready.has(key)) return; ready.add(key);
  const C = SETTLE_CELL;
  for (const S of settlementsNear((gx + .5) * C, (gz + .5) * C, C * 2.8)) linkFrom(S);
}
let lastCell = NaN;
function ensureAt(x, z) {
  const gx = Math.floor(x / SETTLE_CELL), gz = Math.floor(z / SETTLE_CELL), k = gx * 100003 + gz;
  if (k !== lastCell) { lastCell = k; ensure(gx, gz); }
}
// how much a point is worn track (0..1): for the ground's colour and to keep trees off
export function roadShade(x, z) {
  ensureAt(x, z);
  const B = buckets.get(Math.floor(x / RB) * 100003 + Math.floor(z / RB)); if (!B) return 0;
  let v = 0;
  for (const [x0, z0, x1, z1, w, k] of B) {
    const ex = x1 - x0, ez = z1 - z0, l2 = ex * ex + ez * ez, t = l2 ? Math.max(0, Math.min(1, ((x - x0) * ex + (z - z0) * ez) / l2)) : 0;
    const d = Math.hypot(x - x0 - ex * t, z - z0 - ez * t); if (d < w) v = Math.max(v, k * smooth(w, w * .35, d));
  }
  return v;
}
export function bridgesNear(x, z, r) {
  ensureBox(x, z, r);
  return bridges.filter(b => Math.abs((b.x0 + b.x1) / 2 - x) < r && Math.abs((b.z0 + b.z1) / 2 - z) < r);
}

// ---- solids --------------------------------------------------------------------------------
// each building as upright columns for flight to bump into, with perches where its mesh ends:
// the roof ridge, the chimney, the chapel tower, a ruin's wall top (pillar is world.js's)
export function buildingSolids(b, pillar) {
  if (!DIM[b.kind]) return b.kind === 'derelict' ? derelictSolids(b, pillar) : wonderSolids(b, pillar);
  const d = DIM[b.kind], c = Math.cos(b.yaw), s = Math.sin(b.yaw), P = (u, w) => [b.x + c * u - s * w, b.z + s * u + c * w];
  const top = b.y + (b.v === 0 ? d.ridge : d.wall * WALL_LEFT[b.v]), r = d.W / 2 + .3;
  switch (b.kind) {
    case 'cottage': case 'keeper': case 'farmhouse': case 'barn': case 'hut':
      for (const k of [-.27, .27]) { const [x, z] = P(d.L * k, 0); pillar(x, z, r, b.y - 1, top, { x, y: top + (b.v === 0 ? .1 : 0), z }); }
      if (b.v === 0 && b.kind !== 'barn' && b.kind !== 'hut') { const [x, z] = P(d.L / 2 - .5, 0); pillar(x, z, .45, top, top + 1, { x, y: top + 1, z }); }   // the chimney
      break;
    case 'chapel': {
      for (const k of [-.2, .25]) { const [x, z] = P(d.L * k, 0); pillar(x, z, r, b.y - 1, top, { x, y: top + (b.v === 0 ? .1 : 0), z }); }
      const [x, z] = P(-d.L / 2 - 2, 0); pillar(x, z, 2.3, b.y - 1, b.y + 12.4, { x, y: b.y + 12.4, z });
      break;
    }
    case 'spire': pillar(b.x, b.z, 2.3, b.y - 1, b.y + 14); pillar(b.x, b.z, .9, b.y + 14, b.y + 21, { x: b.x, y: b.y + 23.4, z: b.z }); break;   // the weathervane's perch
    case 'well': pillar(b.x, b.z, 1, b.y - 1, b.y + 2.35); break;
    case 'pump': pillar(b.x, b.z, 1, b.y - 1, b.y + 11.2); break;
    case 'cart': pillar(b.x, b.z, 1.1, b.y - 1, b.y + 1.15); break;
    case 'boat': pillar(b.x, b.z, 1, b.y - 1, b.y + .7); break;
  }
}
// a standing pole's top (a leaning one's too), for perching; a fallen one is a log in the grass
export function poleSolids(o, pillar) {
  if (o.state === 2) return;
  pillar(o.x, o.z, .16, o.y - 1, o.y + POLE.h * (o.state ? .97 : 1), { x: o.top[0], y: o.top[1] + .05, z: o.top[2] });
}
export function bridgeSolids(g, pillar) {
  // the parapets' ends, both banks
  const yaw = Math.atan2(g.z1 - g.z0, g.x1 - g.x0), c = Math.cos(yaw), s = Math.sin(yaw);
  for (const [x, z, k] of [[g.x0, g.z0, -1], [g.x1, g.z1, 1]]) for (const sd of [-1.7, 1.7]) {
    const px = x - c * k * 2 - s * sd, pz = z - s * k * 2 + c * sd;
    pillar(px, pz, .35, g.y - 3, g.y + .75, { x: px, y: g.y + .75, z: pz });
  }
}
// how far round a building trees are kept off (world.js treesIn), and a young tree growing out
// of each shell of a cottage (they are trees like any other: perches)
export const clearOf = b => b.clear ?? DIM[b.kind].clear;
export const saplingIn = b => b.v === 2 && (b.kind === 'cottage' || b.kind === 'hut' || b.kind === 'farmhouse');
export const nearRoad = (x, z) => roadShade(x, z) > .2;

// how good a place is for mice (0..1): barns, granary corners and farmyards above all, then the
// folds, the village gardens and the shells of cottages; nothing past 90 m from them
const RICH = { barn: 1, farmhouse: .8, cart: .7, well: .55, hut: .7, cottage: .6, chapel: .45, keeper: .4, pump: .5 };
export function mouseRich(x, z) {
  // the verges under the pole lines are rough grass, good for voles
  let v = polesNear(x, z, 40).length ? .35 : 0;
  for (const bd of buildingsNear(x, z, 90)) if (!bd.under) v = Math.max(v, (RICH[bd.kind] || 0) * smooth(90, 18, Math.hypot(bd.x - x, bd.z - z)));
  return v;
}
