// The Earth under Aloft: a rough real world (Natural Earth coastlines, oceans narrowed, Europe
// enlarged) laid on a strip 96 km round that wraps east to west. earthdata.js holds the baked
// grids (tools/earth/bake.py makes it): metres to the coast, the biome and continent every 500 m,
// and latitude and longitude every 2 km. Pure functions of (x, z), so the chunk worker runs them
// too. x east, z south; the wrap seam (x = +-W/2) runs down the open Pacific, the poles are the
// strip's north and south edges, both ice.
import { EARTH, SDF, CELL, BIOME_IDS, CONTINENTS, LL } from './earthdata.js';
export { EARTH, BIOME_IDS, CONTINENTS };

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
const cells = (() => {
  const b = bytes(CELL.data), a = new Uint8Array(CELL.nx * CELL.nz); let o = 0;
  for (let i = 0; i < b.length; i += 2) { a.fill(b[i], o, o + b[i + 1]); o += b[i + 1]; }
  return a;
})();

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
// 'europe', 'africa', 'asia', 'n-america', 's-america', 'oceania', 'antarctica', or null at sea
export const continentAt = (x, z) => CONTINENTS[cellByte(x, z) >> 5];

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
  if (coastDist(x, z) > 0) return null;
  const [lat, lon] = latLon(x, z), key = oceanKey(lat, lon);
  return { key, ...OCEANS[key] };
}

// ---- named regions: the names the message line and the Journal use ------------------------
// [key, name, lat, lon, radius lat, radius lon]: an ellipse on the real globe; first match wins
export const REGIONS = [
  ['alps', 'the Alps', 46.2, 10, 1.5, 4.5], ['pyrenees', 'the Pyrenees', 42.7, 0.8, .8, 2.6], ['highlands', 'the Scottish Highlands', 57.2, -4.8, 1.5, 2.6],
  ['fingerlakes', 'the Finger Lakes', 42.6, -76.8, .7, 1.4], ['loire', 'the Loire valley', 47.4, 0.7, .5, 1.6], ['lochness', 'the Great Glen', 57.2, -4.6, .5, .8], ['sogne', 'the Sognefjord', 61.15, 6.8, .35, 1.4],
  ['lakes', 'the Lake District', 54.5, -3.1, .5, .9], ['ireland', 'Ireland', 53.3, -8, 2, 3], ['britain', 'Britain', 53, -1.5, 3.5, 3.5], ['iceland', 'Iceland', 64.9, -18.5, 1.6, 5],
  ['norway', 'the Norwegian fjords', 63, 9, 5, 6], ['finland', 'the Finnish lakes', 62.5, 26.5, 3, 5], ['sweden', 'Sweden', 61, 15.5, 5, 4], ['iberia', 'Iberia', 40, -4, 4, 6],
  ['france', 'France', 46.6, 2.5, 3.6, 4.6], ['italy', 'Italy', 42.5, 12.8, 4, 3.2], ['greece', 'Greece', 39, 22.5, 2.6, 3.4], ['carpathians', 'the Carpathians', 47.5, 23.5, 2, 4],
  ['caucasus', 'the Caucasus', 42.8, 44, 1.6, 4.5], ['germany', 'Germany and the low countries', 51.5, 9, 3.5, 6], ['poland', 'the Polish plain', 52, 19.5, 2.5, 5], ['russia', 'the Russian forests', 57, 40, 5, 14],
  ['sahara', 'the Sahara', 23, 10, 8, 22], ['atlas', 'the Atlas', 32, -5, 2.2, 5], ['nile', 'the Nile', 24, 32, 7, 1.6], ['arabia', 'Arabia', 23.5, 46, 7, 10],
  ['sahel', 'the Sahel', 13.5, 5, 3, 20], ['congo', 'the Congo', 0, 22, 5, 9], ['serengeti', 'the Serengeti', -2.5, 35, 3, 3.5], ['kilimanjaro', 'Kilimanjaro', -3.1, 37.4, .6, .6],
  ['kalahari', 'the Kalahari', -23, 22, 4, 5], ['cape', 'the Cape', -33.5, 20, 1.8, 4], ['madagascar', 'Madagascar', -19, 46.7, 7, 3.5], ['okavango', 'the Okavango', -19.3, 22.9, 1.2, 1.4],
  ['himalaya', 'the Himalaya', 29.5, 83, 2.5, 10], ['tibet', 'Tibet', 33, 88, 4, 10], ['india', 'India', 21, 78, 9, 9], ['siberia', 'Siberia', 63, 100, 10, 40],
  ['steppe', 'the steppe', 48, 70, 5, 25], ['gobi', 'the Gobi', 43, 105, 4, 12], ['china', 'China', 30, 112, 9, 12], ['guilin', 'the karst hills of Guilin', 24.8, 110.3, 2, 2.5],
  ['japan', 'Japan', 36.5, 138.5, 6, 6], ['indochina', 'Indochina', 16, 104, 7, 6], ['borneo', 'Borneo', 0.5, 114, 4, 5], ['indonesia', 'the Indonesian islands', -4, 118, 6, 22],
  ['kamchatka', 'Kamchatka', 56, 159.5, 4, 4], ['outback', 'the Outback', -25, 133, 7, 12], ['nz', 'New Zealand', -41.5, 173, 6, 5], ['tasmania', 'Tasmania', -42, 146.6, 1.4, 2],
  ['alaska', 'Alaska', 64, -152, 7, 16], ['bc', 'the coast mountains', 54, -128, 6, 6], ['rockies', 'the Rockies', 45, -112, 8, 6], ['yosemite', 'the Sierra Nevada', 37.5, -119.3, 2, 1.6],
  ['redwoods', 'the redwood coast', 40, -123.8, 2.5, 1.2], ['california', 'California', 36, -119.5, 4, 3.5], ['grandcanyon', 'the Grand Canyon', 36.2, -112.5, 1.4, 2.2], ['southwest', 'the desert Southwest', 33, -110, 4, 6],
  ['plains', 'the Great Plains', 42, -101, 8, 6], ['greatlakes', 'the Great Lakes', 45, -84, 4, 8], ['appalachians', 'the Appalachians', 38, -80, 5, 5], ['newengland', 'New England', 43.5, -71.5, 2.6, 3.5],
  ['florida', 'the Everglades', 26.5, -81, 2, 1.8], ['canada', 'the Canadian forests', 54, -95, 6, 30], ['arctic', 'the Arctic tundra', 70, -100, 8, 50], ['greenland', 'Greenland', 72, -40, 12, 25],
  ['mexico', 'Mexico', 22, -102, 7, 9], ['yucatan', 'the Yucatán', 20, -89, 2.5, 3], ['amazon', 'the Amazon', -4, -62, 8, 14], ['andes', 'the Andes', -18, -70, 22, 4],
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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dateOf(yf) {
  let d = Math.floor(yf * 365);
  for (let m = 0; m < 12; m++) { if (d < MDAYS[m]) return { month: m, day: d + 1, text: `${MONTHS[m]} ${d + 1}` }; d -= MDAYS[m]; }
  return { month: 11, day: 31, text: 'December 31' };
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
export const snowLine = (lat, yf) => 185 - snowAt(lat, yf) * 200 + (Math.abs(lat) < 25 ? 70 : 0);
