// The Earth under Aloft: a rough real world (Natural Earth coastlines, oceans narrowed, Europe
// enlarged) laid on a strip 96 km round that wraps east to west. earthdata.js holds the baked
// grids (tools/earth/bake.py makes it): metres to the coast, the biome and continent every 500 m,
// and latitude and longitude every 2 km. Pure functions of (x, z), so the chunk worker runs them
// too. x east, z south; the wrap seam (x = +-W/2) runs down the open Pacific, the poles are the
// strip's north and south edges, both ice.
import { ageSnow } from './ages.js';
import { EARTH, SDF, CELL, BIOME_IDS, CONTINENTS, LL, GRAIN, LAKE, LAKES, RIVERS } from './earthdata.js';
export { EARTH, BIOME_IDS, CONTINENTS, LAKES };

const W = EARTH.W, X0 = EARTH.X0, Z0 = EARTH.Z0;
export const NORTH = Z0, SOUTH = Z0 + EARTH.H;          // the edges of the world (z)
// x brought into -W/2 .. W/2
export const wrapX = x => x - W * Math.floor((x + W / 2) / W);
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function bytes(s) { const t = atob(s), a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; }
// metres to the coast, / 50 (+ land, - sea)
const sd = (() => {
  const b = bytes(SDF.data), a = new Int8Array(b.length);
  for (let j = 0; j < SDF.nz; j++) { let acc = 0; for (let i = 0; i < SDF.nx; i++) { const k = j * SDF.nx + i; acc += b[k] - 128; a[k] = acc; } }
  return a;
})();
// runs of (value, count) bytes
function runs(G) {
  const b = bytes(G.data), a = new Uint8Array(G.nx * G.nz); let o = 0;
  for (let i = 0; i < b.length; i += 2) { a.fill(b[i], o, o + b[i + 1]); o += b[i + 1]; }
  return a;
}
const cells = runs(CELL), grains = runs(GRAIN), lakes = runs(LAKE);

// metres to the nearest coast: positive on land, negative at sea (smooth: bilinear on 250 m)
export function coastDist(x, z) {
  const u = (wrapX(x) - X0) / SDF.step, v = clamp((z - Z0) / SDF.step, 0, SDF.nz - 1.001);
  const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j, nx = SDF.nx;
  const i0 = mod(i, nx), i1 = mod(i + 1, nx), r0 = j * nx, r1 = (j + 1) * nx;
  const a = sd[r0 + i0], b = sd[r0 + i1], c = sd[r1 + i0], d = sd[r1 + i1];
  return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 50;
}
function cellByte(x, z) {
  const i = mod(Math.round((wrapX(x) - X0) / CELL.step), CELL.nx), j = clamp(Math.round((z - Z0) / CELL.step), 0, CELL.nz - 1);
  return cells[j * CELL.nx + i];
}
// the baked biome there ('sea', 'forest', 'taiga' ...; biomes.js turns it into a land's palette)
export const earthBiome = (x, z) => BIOME_IDS[cellByte(x, z) & 31];
// how much of the ground round a point is desert, 0..1 (smooth: bilinear on the 500 m cells)
const DRY = new Uint8Array(BIOME_IDS.length); for (const k of ['desert', 'saltflat', 'badlands']) DRY[BIOME_IDS.indexOf(k)] = 1;
export function dryAt(x, z) {
  const u = (wrapX(x) - X0) / CELL.step, v = clamp((z - Z0) / CELL.step, 0, CELL.nz - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
  const at = (a, b) => DRY[cells[b * CELL.nx + mod(a, CELL.nx)] & 31];
  const p = at(i, j), q = at(i + 1, j), r = at(i, j + 1), t = at(i + 1, j + 1);
  return p + (q - p) * fx + (r - p) * fz + (p - q - r + t) * fx * fz;
}
// 'europe', 'africa', 'asia', 'n-america', 's-america', 'oceania', 'antarctica', or null at sea
export const continentAt = (x, z) => CONTINENTS[cellByte(x, z) >> 5];

// ---- the great lakes and rivers (Natural Earth): lakes are water in the land at the sea's level,
// fresh unless salt; rivers are lines in metres (rank 0 the greatest), cut by world.js riverAt
// the lake there, or near its water (within 500 m): { name, salt } or null
const CASPIAN = { name: 'the Caspian Sea', salt: true };
// lakes named for the water, never a nation or a human use (CLAUDE.md: as a bird sees them)
const LAKE_AS = { 'Lago de Nicaragua': 'Lake Cocibolca', 'Réservoir Manicouagan': 'the Ring Lake', 'Rybinsk Reservoir': 'the Rybinsk water', 'Lago Titicaca': 'Lake Titicaca' };
export function lakeAt(x, z) {
  const i = mod(Math.round((wrapX(x) - X0) / LAKE.step), LAKE.nx), j = clamp(Math.round((z - Z0) / LAKE.step), 0, LAKE.nz - 1);
  const k = lakes[j * LAKE.nx + i];
  if (!k) {
    // the Caspian, a salt lake the land mask has as sea
    if (coastDist(x, z) > 500) return null;
    const [lat, lon] = latLon(x, z);
    return lat > 36.5 && lat < 47.5 && lon > 46.5 && lon < 55 ? CASPIAN : null;
  }
  const l = LAKES[k - 1]; return { name: LAKE_AS[l[0]] || l[0], salt: !!l[1] };
}
// the bearing of the ranges' ridges there (radians, 0..PI, along x = 0), or -1 off the ranges
export function grainAt(x, z) {
  const i = mod(Math.round((wrapX(x) - X0) / GRAIN.step), GRAIN.nx), j = clamp(Math.round((z - Z0) / GRAIN.step), 0, GRAIN.nz - 1);
  const q = grains[j * GRAIN.nx + i]; return q ? (q - 1) / 16 * Math.PI : -1;
}
// f(theta) blended over the four grain nodes round a point (bilinear; theta -1 off the ranges),
// each bearing's value worked out once
export function byGrain(x, z, f) {
  const u = (wrapX(x) - X0) / GRAIN.step, v = clamp((z - Z0) / GRAIN.step, 0, GRAIN.nz - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
  const q = [grains[j * GRAIN.nx + mod(i, GRAIN.nx)], grains[j * GRAIN.nx + mod(i + 1, GRAIN.nx)], grains[(j + 1) * GRAIN.nx + mod(i, GRAIN.nx)], grains[(j + 1) * GRAIN.nx + mod(i + 1, GRAIN.nx)]];
  const w = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz];
  if (q[0] === q[1] && q[0] === q[2] && q[0] === q[3]) return f(q[0] ? (q[0] - 1) / 16 * Math.PI : -1);
  let s = 0;
  for (let n = 0; n < 4; n++) {
    if (w[n] <= 0 || q.indexOf(q[n]) < n) continue;
    let wt = 0; for (let m = n; m < 4; m++) if (q[m] === q[n]) wt += w[m];
    s += wt * f(q[n] ? (q[n] - 1) / 16 * Math.PI : -1);
  }
  return s;
}
// The rivers' segments in buckets of RB metres (each one in every bucket within RM of it), so a
// point finds the near ones in one look
const RB = 250, RM = 320, RNX = Math.ceil(W / RB);
// The baked lines step from grid cell to grid cell (turns of 50 to 140 degrees, a zig-zag on the
// ground): smoothed once here into curves, a weighted average along the line (twice), then a
// round of corner cutting (Chaikin). The ends stay put.
function smoothLine(p) {
  let q = p;
  for (let r = 0; r < 2; r++) {
    const o = q.slice(), n = q.length / 2;
    for (let i = 1; i < n - 1; i++) for (let c = 0; c < 2; c++) {
      let s = 0, w = 0;
      for (let k = -2; k <= 2; k++) { const j = Math.min(n - 1, Math.max(0, i + k)), wt = 3 - Math.abs(k); s += q[j * 2 + c] * wt; w += wt; }
      o[i * 2 + c] = s / w;
    }
    q = o;
  }
  for (let r = 0; r < 1; r++) {
    const o = [q[0], q[1]];
    for (let k = 0; k + 3 < q.length; k += 2) o.push(q[k] * .75 + q[k + 2] * .25, q[k + 1] * .75 + q[k + 3] * .25, q[k] * .25 + q[k + 2] * .75, q[k + 1] * .25 + q[k + 3] * .75);
    o.push(q[q.length - 2], q[q.length - 1]);
    q = o;
  }
  return q;
}
export const RIVER_LINES = RIVERS.map(([name, rank, p0], id) => {
  const p = p0.length > 4 ? smoothLine(p0) : p0;
  const cum = [0]; for (let k = 0; k + 3 < p.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]));
  return { id, name, rank, p, cum, len: cum[cum.length - 1], openA: false, openB: false };
});
const rbuckets = (() => {
  const m = new Map();
  for (const L of RIVER_LINES) for (let k = 0; k + 3 < L.p.length; k += 2) {
    const ax = L.p[k], az = L.p[k + 1], bx = L.p[k + 2], bz = L.p[k + 3];
    const i0 = Math.floor((Math.min(ax, bx) - RM - X0) / RB), i1 = Math.floor((Math.max(ax, bx) + RM - X0) / RB);
    const j0 = Math.floor((Math.min(az, bz) - RM - Z0) / RB), j1 = Math.floor((Math.max(az, bz) + RM - Z0) / RB);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const key = j * RNX + mod(i, RNX); let a = m.get(key); if (!a) m.set(key, a = []);
      a.push(L.id, k);
    }
  }
  return m;
})();
// a line's end that stops on dry land (a source, not a mouth, a lake or another river) fades out
let ended = false;
function ends() {
  ended = true;
  for (const L of RIVER_LINES) for (const end of [0, 1]) {
    const k = end ? L.p.length - 2 : 0, x = L.p[k], z = L.p[k + 1];
    if (coastDist(x, z) < 120 || lakeAt(x, z)) continue;
    const o = bakedRiverOf(x, z, L.id); L[end ? 'openB' : 'openA'] = !o || o.d > 60;
  }
}
// the nearest great river within RM: { d (metres), side (+1/-1), t (along the segment 0..1), line, k (segment) } or null
export const bakedRiver = (x, z) => bakedRiverOf(x, z, -1);
function bakedRiverOf(x, z, not) {
  if (!ended) ends();
  x = wrapX(x);
  const a = rbuckets.get(Math.floor((z - Z0) / RB) * RNX + mod(Math.floor((x - X0) / RB), RNX)); if (!a) return null;
  let best = null, bd = RM * RM;
  for (let n = 0; n < a.length; n += 2) {
    const L = RIVER_LINES[a[n]], k = a[n + 1], p = L.p;
    if (L.id === not) continue;
    let ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
    // (a line across the seam: brought to this side)
    if (ax - x > W / 2) { ax -= W; bx -= W; } else if (x - ax > W / 2) { ax += W; bx += W; }
    const ux = bx - ax, uz = bz - az, l2 = ux * ux + uz * uz || 1;
    const t = clamp(((x - ax) * ux + (z - az) * uz) / l2, 0, 1), dx = x - ax - ux * t, dz = z - az - uz * t, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = { d: 0, side: ux * (z - az) - uz * (x - ax) < 0 ? -1 : 1, t, line: L, k }; }
  }
  if (best) { best.d = Math.sqrt(bd); const L = best.line, at = L.cum[best.k / 2] + best.t * (L.cum[best.k / 2 + 1] - L.cum[best.k / 2]); best.fade = Math.min(L.openA ? at / 500 : 1, L.openB ? (L.len - at) / 500 : 1, 1); }
  return best;
}

// ---- latitude and longitude ----------------------------------------------------------------
const llAt = (i, j, k) => k === 0 ? LL.lat[j * LL.nx + mod(i, LL.nx)] : LL.lon[j * LL.nx + mod(i, LL.nx)] + 360 * Math.floor(i / LL.nx);
// [lat, lon] in degrees, lon -180..180
export function latLon(x, z) {
  const u = (wrapX(x) - X0) / LL.step, v = clamp((z - Z0) / LL.step, 0, LL.nz - 1.001);
  const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j, out = [0, 0];
  for (let k = 0; k < 2; k++) {
    const a = llAt(i, j, k), b = llAt(i + 1, j, k), c = llAt(i, j + 1, k), d = llAt(i + 1, j + 1, k);
    out[k] = a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  out[1] = mod(out[1] + 180, 360) - 180;
  return out;
}
export const latAt = (x, z) => latLon(x, z)[0];
// where a real place is in the game: [x, z], or null when it is off the strip (past the poles)
const ang = (la1, lo1, la2, lo2) => { const r = Math.PI / 180, d = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return d; };
export function toXZ(lat, lon) {
  let best = null, bd = 9;
  for (let j = 0; j < LL.nz; j++) for (let i = 0; i < LL.nx; i++) {
    const d = ang(lat, lon, LL.lat[j * LL.nx + i], LL.lon[j * LL.nx + i]);
    if (d < bd) { bd = d; best = [X0 + i * LL.step, Z0 + j * LL.step]; }
  }
  if (!best) return null;
  // then a few Newton steps on the smooth map
  let [x, z] = best;
  for (let n = 0; n < 12; n++) {
    const e = 40, p = latLon(x, z), px = latLon(x + e, z), pz = latLon(x, z + e);
    const dl = (a, b) => mod(a - b + 180, 360) - 180;
    const a11 = (px[0] - p[0]) / e, a12 = (pz[0] - p[0]) / e, a21 = dl(px[1], p[1]) / e, a22 = dl(pz[1], p[1]) / e;
    const r0 = lat - p[0], r1 = dl(lon, p[1]), det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-12) break;
    const dx = (r0 * a22 - a12 * r1) / det, dz = (a11 * r1 - r0 * a21) / det;
    x += clamp(dx, -3000, 3000); z = clamp(z + clamp(dz, -3000, 3000), NORTH, SOUTH);
    if (Math.abs(dx) + Math.abs(dz) < 1) break;
  }
  return [wrapX(x), clamp(z, NORTH, SOUTH)];   // (a place past the strip's polar edge: the edge, not off the world)
}

// ---- the oceans --------------------------------------------------------------------------
// Each ocean has its own way across (the sea threads build on these): 'westerlies' a river of air
// to ride east, 'trades' one to ride west, 'soaring' long swells for dynamic soaring, 'islands'
// stepping stones, 'whales' life at sea to rest on, 'ice' floes and bergs.
export const OCEANS = {
  arctic: { name: 'the Arctic Ocean', travel: 'ice' },
  southern: { name: 'the Southern Ocean', travel: 'ice' },
  med: { name: 'the Mediterranean', travel: 'islands' },
  'atlantic-n': { name: 'the North Atlantic', travel: 'westerlies' },
  'atlantic-s': { name: 'the South Atlantic', travel: 'trades' },
  indian: { name: 'the Indian Ocean', travel: 'whales' },
  'pacific-n': { name: 'the North Pacific', travel: 'soaring' },
  'pacific-s': { name: 'the South Pacific', travel: 'islands' },
};
export function oceanKey(lat, lon) {
  if (lat > 66) return 'arctic';
  if (lat < -52) return 'southern';
  if (lon > -6 && lon < 42 && lat > 30 && lat < 47.5) return 'med';
  if (lat >= 0 && lon > -100 && lon < -5) return 'atlantic-n';
  if (lat >= 0 && lon >= -5 && lon < 30 && lat > 20) return 'atlantic-n';
  if (lat < 0 && lon > -68 && lon < 20) return 'atlantic-s';
  if (lon >= 20 && lon < 120 && lat < 30) return lat < 0 && lon > 115 ? 'pacific-s' : 'indian';
  return lat >= 0 ? 'pacific-n' : 'pacific-s';
}
// { key, name, travel } at sea, null on land
export function oceanAt(x, z) {
  if (coastDist(x, z) > 0 || lakeAt(x, z)) return null;
  const [lat, lon] = latLon(x, z), key = oceanKey(lat, lon);
  return { key, ...OCEANS[key] };
}

// ---- named regions: the names the message line and the Journal use ------------------------
// [key, name, lat, lon, radius lat, radius lon]: an ellipse on the real globe; first match wins
// Named by what a bird could see (James, 2026-10-24): the shape of the land, the water, the stone,
// the trees, never a nation or a people (the Loire lowlands, not France; the maple hills, not New
// England). Islands, seas, rivers and ranges keep their names: they name the land. The keys are
// what saves hold, so they stay as they were.
export const REGIONS = [
  ['alps', 'the Alps', 46.2, 10, 1.5, 4.5], ['pyrenees', 'the Pyrenees', 42.7, 0.8, .8, 2.6], ['highlands', 'the Highlands', 57.2, -4.8, 1.5, 2.6],
  ['fingerlakes', 'the Finger Lakes', 42.6, -76.8, .7, 1.4], ['loire', 'the Loire', 47.4, 0.7, .5, 1.6], ['lochness', 'the Great Glen', 57.2, -4.6, .5, .8], ['sogne', 'the Sognefjord', 61.15, 6.8, .35, 1.4],
  ['lakes', 'the Lakeland fells', 54.5, -3.1, .5, .9], ['ireland', 'Ireland', 53.3, -8, 2, 3], ['britain', 'Britain', 53, -1.5, 3.5, 3.5], ['iceland', 'Iceland', 64.9, -18.5, 1.6, 5],
  ['norway', 'the fjord coast', 63, 9, 5, 6], ['finland', 'the thousand lakes', 62.5, 26.5, 3, 5], ['sweden', 'the Scandinavian forests', 61, 15.5, 5, 4], ['iberia', 'Iberia', 40, -4, 4, 6],
  ['france', 'the Loire lowlands', 46.6, 2.5, 3.6, 4.6], ['italy', 'the Apennine peninsula', 42.5, 12.8, 4, 3.2], ['greece', 'the Aegean shores', 39, 22.5, 2.6, 3.4], ['carpathians', 'the Carpathians', 47.5, 23.5, 2, 4],
  ['caucasus', 'the Caucasus', 42.8, 44, 1.6, 4.5], ['germany', 'the Rhine lowlands', 51.5, 9, 3.5, 6], ['poland', 'the great northern plain', 52, 19.5, 2.5, 5], ['russia', 'the eastern forests', 57, 40, 5, 14],
  ['sahara', 'the Sahara', 23, 10, 8, 22], ['atlas', 'the Atlas', 32, -5, 2.2, 5], ['nile', 'the Nile', 24, 32, 7, 1.6], ['arabia', 'Arabia', 23.5, 46, 7, 10],
  ['sahel', 'the Sahel', 13.5, 5, 3, 20], ['congo', 'the Congo', 0, 22, 5, 9], ['serengeti', 'the Serengeti', -2.5, 35, 3, 3.5], ['kilimanjaro', 'Kilimanjaro', -3.1, 37.4, .6, .6],
  ['kalahari', 'the Kalahari', -23, 22, 4, 5], ['cape', 'the Cape', -33.5, 20, 1.8, 4], ['madagascar', 'Madagascar', -19, 46.7, 7, 3.5], ['okavango', 'the Okavango', -19.3, 22.9, 1.2, 1.4],
  ['himalaya', 'the Himalaya', 29.5, 83, 2.5, 10], ['tibet', 'the high plateau', 33, 88, 4, 10], ['india', 'the Ganges plains', 21, 78, 9, 9], ['siberia', 'Siberia', 63, 100, 10, 40],
  ['steppe', 'the steppe', 48, 70, 5, 25], ['gobi', 'the Gobi', 43, 105, 4, 12], ['china', 'the Yangtze lowlands', 30, 112, 9, 12], ['guilin', 'the karst hills', 24.8, 110.3, 2, 2.5],
  ['japan', 'the eastern islands', 36.5, 138.5, 6, 6], ['indochina', 'the monsoon forests', 16, 104, 7, 6], ['borneo', 'Borneo', 0.5, 114, 4, 5], ['indonesia', 'the equator islands', -4, 118, 6, 22],
  ['kamchatka', 'Kamchatka', 56, 159.5, 4, 4], ['outback', 'the Outback', -25, 133, 7, 12], ['nz', 'New Zealand', -41.5, 173, 6, 5], ['tasmania', 'Tasmania', -42, 146.6, 1.4, 2],
  ['alaska', 'Alaska', 64, -152, 7, 16], ['bc', 'the coast mountains', 54, -128, 6, 6], ['rockies', 'the Rockies', 45, -112, 8, 6], ['yosemite', 'the Sierra Nevada', 37.5, -119.3, 2, 1.6],
  ['redwoods', 'the redwood coast', 40, -123.8, 2.5, 1.2], ['california', 'the long dry valley', 36, -119.5, 4, 3.5], ['grandcanyon', 'the Grand Canyon', 36.2, -112.5, 1.4, 2.2], ['southwest', 'the red rock desert', 33, -110, 4, 6],
  ['plains', 'the Great Plains', 42, -101, 8, 6], ['greatlakes', 'the Great Lakes', 45, -84, 4, 8], ['appalachians', 'the Appalachians', 38, -80, 5, 5], ['newengland', 'the maple hills', 43.5, -71.5, 2.6, 3.5],
  ['florida', 'the Everglades', 26.5, -81, 2, 1.8], ['canada', 'the north woods', 54, -95, 6, 30], ['arctic', 'the Arctic tundra', 70, -100, 8, 50], ['greenland', 'Greenland', 72, -40, 12, 25],
  ['mexico', 'the cactus highlands', 22, -102, 7, 9], ['yucatan', 'the Yucatán', 20, -89, 2.5, 3], ['amazon', 'the Amazon', -4, -62, 8, 14], ['andes', 'the Andes', -18, -70, 22, 4],
  ['altiplano', 'the Altiplano', -19, -67.5, 3, 3], ['pantanal', 'the Pantanal', -17.5, -57, 2.5, 2.5], ['pampas', 'the Pampas', -35, -62, 4, 5], ['patagonia', 'Patagonia', -47, -69, 6, 6],
  ['galapagos', 'the Galápagos', -.5, -90.5, 1.5, 1.5], ['hawaii', 'Hawaii', 20, -156.5, 2, 3], ['antarctica', 'Antarctica', -80, 0, 18, 180],
];
export function regionAt(x, z) {
  const [lat, lon] = latLon(x, z);
  for (const R of REGIONS) {
    const dl = mod(lon - R[3] + 180, 360) - 180;
    if (((lat - R[2]) / R[4]) ** 2 + (dl / R[5]) ** 2 <= 1) return { key: R[0], name: R[1] };
  }
  return null;
}

// ---- the calendar and the sun ----------------------------------------------------------------
// A year is 32 game days (four seasons of eight). Day 1 is midsummer in the north (21 June);
// the date runs on through the months, and each place's season comes from its latitude: the
// south has winter while the north has summer, the tropics an endless summer.
export const YEAR_DAYS = 32;
const JUNE21 = 171 / 365;
export const yearFrac = (day, tod = .5) => mod((day - 1 + tod) / YEAR_DAYS + JUNE21, 1);
// short month names, so the date fits beside the season (James, 2026-10-23: "Dec 25, Summer")
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dateOf(yf) {
  let d = Math.floor(yf * 365);
  for (let m = 0; m < 12; m++) { if (d < MDAYS[m]) return { month: m, day: d + 1, text: `${MONTHS[m]} ${d + 1}` }; d -= MDAYS[m]; }
  return { month: 11, day: 31, text: 'Dec 31' };
}
// the sun's declination (radians) through the year
export const declination = yf => 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (yf - 79 / 365));
// the season at a latitude: { i (0 summer, 1 autumn, 2 winter, 3 spring), d (day in the season 0..7), f (0..1 through it) }
const STARTS = [JUNE21, 265 / 365, 355 / 365, 79 / 365];
export function seasonAt(lat, yf) {
  if (Math.abs(lat) < 12) return { i: 0, d: Math.floor(mod(yf * YEAR_DAYS, 8)), f: mod(yf * 4, 1), tropic: true };
  const y = lat < 0 ? mod(yf + .5, 1) : yf;
  for (let k = 0; k < 4; k++) {
    const a = STARTS[k], b = STARTS[(k + 1) % 4], len = mod(b - a, 1), t = mod(y - a, 1);
    if (t < len) return { i: k, d: Math.min(7, Math.floor(t / len * 8)), f: t / len };
  }
  return { i: 0, d: 0, f: 0 };
}
// how wintry a place is now, 0 (summer) .. 1 (deep winter); and how much snow lies there 0..1
export const winterAt = (lat, yf) => .5 + .5 * Math.cos(2 * Math.PI * ((lat < 0 ? mod(yf + .5, 1) : yf) - 15 / 365));
export function snowAt(lat, yf) {
  const a = Math.abs(lat), w = winterAt(lat, yf), s = t => clamp(t, 0, 1);
  return s(w * s((a - 24) / 24) + s((a - 55) / 25) * (.35 + .4 * w));
}
// the snowline in metres (the old 185 m in summer, down below the meadows in deep winter)
export const snowLine = (lat, yf) => 185 - snowAt(lat, yf) * 200 + (Math.abs(lat) < 25 ? 70 : 0) + ageSnow(lat);   // (lower in the Ice, never in the Red Age: ages.js)
