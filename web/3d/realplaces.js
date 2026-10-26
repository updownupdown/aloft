// The real natural wonders (option E of the geography study): each at its real place on the strip
// (earth.js toXZ), drawn larger than the strip's scale would allow so it reads from the air. Most
// are shapes in the ground (shapeAt, added to the terrain by world.js after the rivers): Uluru's
// red dome, the tepuis' sheer tablelands, the Matterhorn's horn, the cliff and crescent of the great
// falls. The rest are meshes drawn by sys/nature.js (geysers, the glacier, basalt columns, white
// terraces) or other landmarks (sea stacks, waterfall curtains: sys/lands.js draws those).
// A pure function of position: the list is fixed, and each shape's ground (y0) is the terrain's own
// at its middle, worked out once.
import { fbm, smooth, ih, clamp } from './noise.js';
import { toXZ, coastDist, bakedRiver, EARTH } from './earth.js';

// [id, name, lat, lon, form, options]  (r: radius in metres, h: height over the ground)
export const REAL = [
  ['victoria', 'The Smoke That Thunders', -17.92, 25.86, 'falls', { r: 200, drop: 34, gorge: 70, arc: 1.25 }],
  ['iguazu', 'The Hundred Falls', -25.69, -54.44, 'falls', { r: 220, drop: 26, gorge: 85, arc: 1.5 }],
  ['niagara', 'The Horseshoe Falls', 43.08, -79.07, 'falls', { r: 170, drop: 24, gorge: 55, arc: 1.05 }],
  ['angel', 'The Cloud Falls', 5.97, -62.54, 'tepui', { r: 300, h: 150, falls: 1 }],
  ['roraima', 'The Sky Island', 5.14, -60.76, 'tepui', { r: 330, h: 125 }],
  ['table', 'Table Mountain', -33.96, 18.4, 'tepui', { r: 230, h: 95, long: 1.8 }],
  ['uluru', 'The Great Red Rock', -25.34, 131.04, 'dome', { r: 150, h: 48, long: 1.7 }],
  ['devils', 'The Fluted Tower', 44.59, -104.72, 'tower', { r: 42, h: 62 }],
  ['monument', 'The Red Buttes', 36.98, -110.1, 'buttes', { r: 420, h: 55, n: 5 }],
  ['matterhorn', 'the Matterhorn', 45.98, 7.66, 'horn', { r: 280, h: 210 }],
  ['everest', 'The Highest Peak', 27.99, 86.93, 'horn', { r: 460, h: 320 }],
  ['paine', 'The Blue Towers', -50.94, -73.4, 'spires', { r: 170, h: 150, n: 3 }],
  ['causeway', 'The Stepping Stones', 55.24, -6.51, 'columns', { r: 42, coast: 1 }],
  ['fingal', 'The Pillared Cave', 56.43, -6.34, 'columns', { r: 34, coast: 1, cave: 1 }],
  ['oldfaithful', 'The Steady Fountain', 44.46, -110.83, 'geyser', { r: 30 }],
  ['geysir', 'The Gusher', 64.31, -20.3, 'geyser', { r: 26 }],
  ['moreno', 'The Blue Ice Wall', -50.47, -73.03, 'glacier', { r: 160, h: 32, coast: 1 }],
  ['apostles', 'The Sea Pillars', -38.66, 143.1, 'stacks', { r: 260, n: 8, coast: 1 }],
  ['halong', 'The Drowned Hills', 20.9, 107.1, 'stacks', { r: 420, n: 16, coast: 1, tall: 1 }],
  ['moher', 'The Tall Sea Cliffs', 52.97, -9.43, 'seacliff', { r: 420, h: 46, coast: 1 }],
  ['grandcanyon', 'the Grand Canyon', 36.1, -112.1, 'name', { r: 300 }],
  ['sossus', 'The Red Dunes', -24.73, 15.29, 'dunes', { r: 360, h: 60 }],
  ['reef', 'the Great Barrier Reef', -18.3, 147.7, 'reef', { r: 900, coast: 1 }],
  ['pamukkale', 'The Cotton Terraces', 37.92, 29.12, 'terraces', { r: 130, h: 34 }],
];
// the real fire mountains, to name the volcano landmarks near them (world.js cellSight)
export const VOLCANOES = [[37.75, 15, 'Etna'], [40.82, 14.43, 'Vesuvius'], [38.79, 15.21, 'Stromboli'], [63.98, -19.67, 'Hekla'], [35.36, 138.73, 'Mount Fuji'], [-3.07, 37.35, 'Kilimanjaro'],
  [46.85, -121.76, 'The White Fire Mountain'], [46.2, -122.18, 'The Broken Fire Mountain'], [19.48, -155.6, 'Mauna Loa'], [28.27, -16.64, 'Teide'], [19.02, -98.62, 'Popocatépetl'], [-.68, -78.44, 'Cotopaxi'],
  [-39.42, -71.93, 'Villarrica'], [-6.1, 105.42, 'Krakatoa'], [-7.54, 110.45, 'Merapi'], [-77.53, 167.15, 'The Ice Fire Mountain'], [39.7, 44.3, 'Mount Ararat'], [56.06, 160.64, 'Klyuchevskaya'],
  [38.47, -28.4, 'Pico'], [-21.24, 55.71, 'Piton de la Fournaise'], [-39.3, 174.06, 'Taranaki'], [-39.28, 175.57, 'Ruapehu'], [-1.52, 29.25, 'Nyiragongo'], [15.13, 120.35, 'Pinatubo'],
  [13.26, 123.69, 'Mayon'], [-.83, -91.13, 'The Island Fire Mountain'], [-27.12, -109.28, 'Rano Kau'], [64.63, -17.52, 'Bárðarbunga'], [55.95, -160.0, 'Shishaldin'], [-15.79, -71.86, 'El Misti']];
let volc = null;
export function volcanoName(x, z) {
  volc ||= VOLCANOES.map(([la, lo, n]) => { const p = toXZ(la, lo); return { x: p[0], z: p[1], n }; });
  let best = null, bd = 1800;
  for (const v of volc) { const d = Math.hypot(v.x - x, v.z - z); if (d < bd) { bd = d; best = v.n; } }
  return best;
}

// ---- the places, laid on the strip --------------------------------------------------------------
let places = null;
// a coast point near (x, z): just inland (land > 0) or just out (land < 0), metres from the shore
function coastNear(x, z, want) {
  let best = null, bd = 1e9;
  for (let i = 0; i < 260; i++) {
    const a = i * 2.39996, r = 10 + i * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, c = coastDist(px, pz);
    const e = Math.abs(c - want); if (e < 25 && r < bd) { bd = r; best = [px, pz]; break; }
  }
  return best || [x, z];
}
export function realPlaces() {
  if (places) return places;
  places = [];
  for (const [id, name, lat, lon, form, o] of REAL) {
    const p = toXZ(lat, lon); if (!p) continue;
    let [x, z] = p;
    if (Math.abs(x) > EARTH.W / 2 - EARTH.SEAM - 600) continue;
    // the coast's wonders stand at the shore; the land's well inland
    if (o.coast) [x, z] = coastNear(x, z, form === 'reef' ? -500 : form === 'stacks' ? -40 : form === 'seacliff' ? 30 : 12);
    else if (coastDist(x, z) < (o.r || 100) + 60) for (let i = 0; i < 120; i++) { const a = i * 2.39996, r = 20 + i * 12, px = p[0] + Math.cos(a) * r, pz = p[1] + Math.sin(a) * r; if (coastDist(px, pz) > (o.r || 100) + 80) { x = px; z = pz; break; } }
    const P = { id: 'real_' + id, key: id, name, form, x, z, r: o.r || 100, h: o.h || 0, o, yaw: ih(x | 0, z | 0, 611) * Math.PI * 2, y0: null, parts: [] };
    // the great falls face down their river, where there is one
    if (form === 'falls') { const rv = bakedRiver(x, z); if (rv && rv.d < 500) { const L = rv.line, k = rv.k; P.yaw = Math.atan2(L.p[k + 3] - L.p[k + 1], L.p[k + 2] - L.p[k]); } }
    // the seaward way, for the coast's wonders
    if (o.coast) { const e = 30, gx = coastDist(x + e, z) - coastDist(x - e, z), gz = coastDist(x, z + e) - coastDist(x, z - e); P.yaw = Math.atan2(-gz, -gx); }
    if (form === 'buttes' || form === 'spires') for (let i = 0; i < o.n; i++) {
      const a = i / o.n * 6.283 + ih(i, 3, 612) * 1.2, rr = i === 0 ? 0 : P.r * (.35 + .55 * ih(i, 4, 613));
      P.parts.push({ x: x + Math.cos(a) * rr * (form === 'spires' ? .45 : 1), z: z + Math.sin(a) * rr * (form === 'spires' ? .45 : 1), r: form === 'spires' ? 30 + ih(i, 5, 614) * 22 : 45 + ih(i, 5, 614) * 55, h: P.h * (.6 + .4 * ih(i, 6, 615)) });
    }
    places.push(P);
  }
  return places;
}
// places by 1 km bucket, for the terrain
const BK = 1000, buckets = new Map();
let bucketed = false;
function near(x, z) {
  if (!bucketed) {
    bucketed = true;
    for (const P of realPlaces()) {
      const R = P.r * (P.o.long || 1) * 1.6 + 60;
      for (let j = Math.floor((P.z - R) / BK); j <= Math.floor((P.z + R) / BK); j++) for (let i = Math.floor((P.x - R) / BK); i <= Math.floor((P.x + R) / BK); i++) {
        const k = i * 4099 + j; let a = buckets.get(k); if (!a) buckets.set(k, a = []); a.push(P);
      }
    }
  }
  return buckets.get(Math.floor(x / BK) * 4099 + Math.floor(z / BK));
}

// ---- the shapes in the ground ------------------------------------------------------------------
let inside = false;   // working out a place's own ground: no shapes
// the ground under a place's middle (the terrain without the shapes), once
function ground(P, base) {
  if (P.y0 == null) {
    inside = true;
    let s = 0; for (let i = 0; i < 5; i++) { const a = i * 1.2566, r = i ? P.r * .5 : 0; s += base(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r); }
    inside = false;
    P.y0 = Math.max(s / 5, 1.5);
  }
  return P.y0;
}
// a point in the place's frame: u along its yaw, v across, both / r (and the long axis stretched)
function frame(P, x, z, long = 1) {
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw), dx = x - P.x, dz = z - P.z;
  return [(dx * c + dz * s) / (P.r * long), (-dx * s + dz * c) / P.r];
}
const mesaProfile = (d, edge = .9) => smooth(1, edge, d);
// h: the terrain so far; base(x, z): the terrain without the shapes (world.js baseHeight)
export function shapeAt(x, z, h, base) {
  if (inside) return h;
  const list = near(x, z); if (!list) return h;
  for (const P of list) {
    const o = P.o;
    switch (P.form) {
      case 'dome': {   // Uluru: a long red loaf with sheer flanks, gullied
        const [u, v] = frame(P, x, z, o.long), d = Math.hypot(u, v) * (1 + fbm(x / 40, z / 40, 621, 2) * .06);
        if (d >= 1.05) break;
        const t = d < 1 ? (1 - d ** 5) ** .35 : 0, gully = Math.abs(fbm(x / 18, z / 18, 622, 1)) * 3 * t;
        h = Math.max(h, ground(P, base) + P.h * t - gully);
        break;
      }
      case 'tepui': {   // a tableland with sheer walls, a broken rim, a pale talus round its foot
        const [u, v] = frame(P, x, z, o.long || 1), d = Math.hypot(u, v) * (1 + fbm(x / 70, z / 70, 623, 2) * .1);
        if (d >= 1.5) break;
        const top = mesaProfile(d, .95) * (1 + fbm(x / 50, z / 50, 624, 2) * .05), talus = smooth(1.45, 1, d) * .16;
        h = Math.max(h, ground(P, base) + P.h * Math.max(top, talus));
        break;
      }
      case 'tower': {   // Devils Tower: a fluted column on a skirt of fallen rubble
        const d = Math.hypot(x - P.x, z - P.z) / P.r, flute = Math.cos(Math.atan2(z - P.z, x - P.x) * 14) * .025;
        if (d >= 3) break;
        const col = mesaProfile(d + flute, .9) * (1 - .12 * d), skirt = smooth(3, 1, d) ** 1.6 * .22;
        h = Math.max(h, ground(P, base) + P.h * Math.max(col, skirt));
        break;
      }
      case 'buttes': case 'spires': {
        const y0 = ground(P, base);
        for (const B of P.parts) {
          const d = Math.hypot(x - B.x, z - B.z) / B.r * (1 + fbm(x / 30, z / 30, 625, 2) * .08);
          if (d >= 2.2) continue;
          const t = P.form === 'buttes' ? Math.max(mesaProfile(d, .9), smooth(2.2, 1, d) ** 1.5 * .28) : Math.max(0, 1 - d) ** .7 * (1 + fbm(x / 12, z / 12, 626, 1) * .08);
          h = Math.max(h, y0 + B.h * t);
        }
        break;
      }
      case 'horn': {   // a pyramid of four faces, sharp edges and a crooked summit
        const [u, v] = frame(P, x, z), d = (Math.abs(u + v) + Math.abs(u - v)) * .5 ** .5 * (1 + fbm(x / 60, z / 60, 627, 2) * .1);
        if (d >= 1) break;
        h = Math.max(h, ground(P, base) * .7 + P.h * (1 - d) ** 1.35 + Math.abs(fbm(x / 20, z / 20, 628, 1)) * 4 * (1 - d));
        break;
      }
      case 'falls': {   // a plateau broken by a horseshoe gorge: the river falls over its lip
        const [u, v] = frame(P, x, z), g = Math.hypot(u - o.gorge / P.r, v) * P.r - o.gorge * (1 + fbm(x / 30, z / 30, 629, 1) * .1);
        const d = Math.hypot(u, v);
        if (d >= 1.3) break;
        const lip = smooth(0, 6, g) * smooth(1.3, .8, d) * (u < o.gorge / P.r ? 1 : smooth(o.gorge * 1.6 / P.r, o.gorge / P.r, u));
        if (lip > 0) h = Math.max(h, ground(P, base) + o.drop * lip - (1 - lip) * 2);
        else if (g < 0) h = Math.min(h, Math.max(-2.5, h - 4));   // the plunge pool below
        break;
      }
      case 'seacliff': {   // Moher: the land shoulders up into a long wall over the sea
        const d = Math.hypot(x - P.x, z - P.z) / P.r; if (d >= 1) break;
        const c = coastDist(x, z), k = smooth(1, .55, d);
        if (c > -10) h = Math.max(h, h + (P.h * k * smooth(-4, 18, c + fbm(x / 25, z / 25, 630, 2) * 10)));
        break;
      }
      case 'dunes': {   // Sossusvlei: star dunes, the tallest on Earth, red
        const d = Math.hypot(x - P.x, z - P.z) / P.r; if (d >= 1) break;
        const w = fbm(x / 120, z / 120, 631, 2) * 3;
        const rid = Math.max((1 - Math.abs(Math.sin((x + z) * .7 / 62 + w))) ** 3, (1 - Math.abs(Math.sin((x - z) * .7 / 75 + w))) ** 3);
        h = Math.max(h, ground(P, base) + P.h * smooth(1, .15, d) * (.3 + .7 * rid));
        break;
      }
      case 'geyser': {   // a level basin of sinter round the vent
        const d = Math.hypot(x - P.x, z - P.z) / P.r; if (d >= 2.2) break;
        const y0 = ground(P, base); h = h + (y0 - h) * smooth(2.2, 1.2, d);
        break;
      }
      case 'terraces': {   // Pamukkale: a white hillside of travertine steps, each holding a pool
        const d = Math.hypot(x - P.x, z - P.z) / P.r; if (d >= 1) break;
        const t = P.h * smooth(1, 0, d + fbm(x / 40, z / 40, 632, 2) * .1), st = 2.6;
        h = Math.max(h, ground(P, base) + Math.floor(t / st) * st + smooth(.8, 1, (t / st) % 1) * st);
        break;
      }
    }
  }
  return h;
}
// the ground's colour on the shapes: [r, g, b, weight] or null
const RED = [.7, .33, .2], RED2 = [.62, .28, .17], TEP = [.32, .3, .3], WHITE = [.93, .92, .88], BLUE = [.55, .8, .86], DUNE = [.8, .42, .24];
export function colourAt(x, y, z, steep) {
  const list = near(x, z); if (!list) return null;
  for (const P of list) {
    const d = Math.hypot(x - P.x, z - P.z) / (P.r * (P.o.long || 1));
    if (P.y0 == null || d > 1.3) continue;
    const up = y - P.y0;
    switch (P.form) {
      case 'dome': if (up > 1) return [...(fbm(x / 9, y / 3, 633, 1) > 0 ? RED : RED2), smooth(1, 4, up)]; break;
      case 'tepui': if (up > P.h * .2) return [...(steep > .3 ? TEP : [.36, .44, .32]), smooth(P.h * .2, P.h * .3, up)]; break;
      case 'tower': case 'spires': if (up > 6 && steep > .25) return [.48, .44, .4, .9]; break;
      case 'buttes': if (up > 4) return [...RED, smooth(4, 10, up) * (steep > .2 ? 1 : .6)]; break;
      case 'dunes': if (d < 1) return [...DUNE, smooth(1, .7, d)]; break;
      case 'terraces': if (d < 1 && up > .5) return [...(steep < .05 && ((up % 2.6) < .9) ? BLUE : WHITE), smooth(1, .85, d)]; break;
    }
  }
  return null;
}
export { clamp };
