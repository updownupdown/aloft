// The procedural world. Everything is a pure function of world x and a hash, so the
// world is endless in both directions and identical on every visit.
// Coordinates: x right (= south, the migration direction), y DOWN, ground sits around y = 0.
import { hash, vnoise, fbm, lerp, smooth, clamp } from './util.js';
import { TUNE } from './tune.js';

// set by the game every frame: thermal strength (time of day, weather), wind, winter
export const env = { thermal: 1, wind: 0, winter: 0 };

/* ---------- biomes ---------- */
// Long noise-chosen stretches. The far south (the migration's end) is always marsh.
export const JOURNEY = 36000;
export const START_X = -1250;  // the edge of a forest
export const BIOMES = {
  meadow: { name: 'meadow', amp: .55, trees: .6, ponds: .6, bushes: 1.7, mice: .6, broadleaf: .85, wind: 1, tint: [128, 140, 80] },
  forest: { name: 'forest', amp: 1, trees: 1.8, ponds: .5, bushes: .6, mice: .15, broadleaf: .5, wind: .8, tint: [60, 110, 80] },
  lakeland: { name: 'lakeland', amp: .7, trees: 1, ponds: 1.35, bushes: 1, mice: .25, broadleaf: .7, wind: 1, tint: [80, 130, 120] },
  cliffs: { name: 'cliffs', amp: 3.2, trees: .55, ponds: .35, bushes: .5, mice: .2, broadleaf: .15, wind: 1.5, tint: [130, 120, 105] },
  marsh: { name: 'marsh', amp: .35, trees: .45, ponds: 1.5, bushes: 1.2, mice: .3, broadleaf: .9, wind: .9, tint: [120, 140, 95] },
};
const biomeCache = new Map();
function biomeRaw(x) {
  if (x > JOURNEY - 1800) return BIOMES.marsh;
  const v = vnoise(x / 2600, 51) * .75 + vnoise(x / 700, 52) * .25;
  return v < .36 ? BIOMES.meadow : v < .55 ? BIOMES.forest : v < .72 ? BIOMES.lakeland : BIOMES.cliffs;
}
export function biomeAt(x) {
  const k = Math.round(x / 50);
  let b = biomeCache.get(k);
  if (!b) { b = biomeRaw(k * 50); biomeCache.set(k, b); if (biomeCache.size > 20000) biomeCache.clear(); }
  return b;
}
// a numeric biome property blended across the borders so terrain never steps
const blendCache = new Map();
function blendedK(k, key) {
  const ck = key + k;
  let v = blendCache.get(ck);
  if (v === undefined) {
    v = 0; for (let j = -4; j <= 4; j++) v += biomeAt((k + j * 2) * 40)[key];
    v /= 9; blendCache.set(ck, v); if (blendCache.size > 40000) blendCache.clear();
  }
  return v;
}

const blended = (x, key) => { const f = x / 40, i = Math.floor(f); return lerp(blendedK(i, key), blendedK(i + 1, key), f - i); };

const groundRaw = x => {
  const amp = blended(x, 'amp');
  const crag = amp > 1.3 ? (amp - 1.3) * 14 * (Math.abs(fbm(x / 90, 6)) - .3) : 0;   // rocky cliffs get sharper ridges
  return amp * (22 * fbm(x / 240, 1) + 5 * fbm(x / 60, 4)) + 40 * fbm(x / 1100, 3) - crag;
};

/* ---------- ponds ---------- */
const PS = 520;
const pondCache = new Map();
function pondK(k) {
  if (pondCache.has(k)) return pondCache.get(k);
  let p = null;
  const c = k * PS + 120 + hash(k * 1.7) * 280, bio = biomeAt(c);
  if (hash(k * 3.1 + .5) < .45 * bio.ponds) {
    const w = (30 + 34 * hash(k * 5.3)) * (bio.ponds > 1.2 ? 1.3 : 1), rim = groundRaw(c);
    p = { k, c, w, depth: 12 + 10 * hash(k * 7.9), rim, waterY: rim + 2, x0: null, x1: null, fish: [] };
    // larger ponds keep open water in winter; small ones freeze
    p.deep = w > 52;
    const nf = 1 + Math.floor(hash(k * 6.1) * (w > 50 ? 3 : 2));
    for (let j = 0; j < nf; j++) p.fish.push({ id: `f${k}_${j}`, seed: k * 7 + j });
  }
  pondCache.set(k, p);
  if (p) { // the actual wet span, where the bowl dips below the water line
    let a = p.c, b = p.c;
    while (a > p.c - p.w && bedY(a - 1, p) > p.waterY) a--;
    while (b < p.c + p.w && bedY(b + 1, p) > p.waterY) b++;
    p.x0 = a; p.x1 = b;
  }
  if (pondCache.size > 4000) pondCache.clear();
  return p;
}
export const frozen = p => env.winter > .5 && !p.deep;
export function pondNear(x, reach = 2.4) {
  const k = Math.round((x - 260) / PS);
  for (let j = k - 1; j <= k + 1; j++) { const p = pondK(j); if (p && Math.abs(x - p.c) < p.w * reach) return p; }
  return null;
}
function bedY(x, p) {
  let h = groundRaw(x);
  if (p) {
    const d = Math.abs(x - p.c) / p.w;
    h = lerp(h, p.rim, smooth(2.4, 1.2, d));
    if (d < 1) h += p.depth * Math.pow(1 - d * d, 1.2);
  }
  return h;
}
// the surface you can stand on: frozen ponds are flat ice
export function groundY(x) {
  const p = pondNear(x), h = bedY(x, p);
  return p && p.x0 !== null && frozen(p) ? Math.min(h, p.waterY) : h;
}
// water surface at x, or null when x is dry land (or ice)
export function waterAt(x) {
  const p = pondNear(x, 1);
  if (p && Math.abs(x - p.c) < p.w && bedY(x, p) > p.waterY && !frozen(p)) return p.waterY;
  return null;
}
export function pondsIn(x0, x1) {
  const out = [];
  for (let k = Math.floor((x0 - 260) / PS) - 1; k <= Math.ceil((x1 - 260) / PS) + 1; k++) { const p = pondK(k); if (p && p.x1 > x0 - 20 && p.x0 < x1 + 20) out.push(p); }
  return out;
}
export const pondBed = bedY;
const slope = x => Math.abs(groundY(x + 6) - groundY(x - 6));
const grove = x => vnoise(x / 520, 21);

/* ---------- landmarks: rare sights worth remembering ---------- */
const LC = 4200;
const LM_NAMES = {
  oak: ['The Old Oak', 'The Elder Oak', 'Grandfather Oak'],
  falls: ['Silver Falls', 'The Long Falls', 'Mist Falls'],
  tower: ['The Ruined Tower', 'The Watchtower', 'The Lonely Tower'],
  stones: ['The Standing Stones', 'The Heron Stones', 'The Grey Stones'],
};
const lmCache = new Map();
function landmarkK(k) {
  if (lmCache.has(k)) return lmCache.get(k);
  let l = null;
  if (k !== 0 && hash(k * 2.7 + 9) < .8) {
    let x = k * LC + 700 + hash(k * 3.9) * (LC - 1400);
    // nudge off ponds
    for (let n = 0; n < 6 && pondNear(x, 1.8); n++) x += 160;
    const bio = biomeAt(x);
    const type = bio.name === 'forest' ? 'oak' : bio.name === 'cliffs' ? 'falls' : bio.name === 'meadow' ? 'tower' : bio.name === 'marsh' ? 'stones' : (hash(k) < .5 ? 'stones' : 'oak');
    const names = LM_NAMES[type], gy = groundY(x);
    l = { k, id: `l${k}`, x, y: gy, type, name: names[Math.floor(hash(k * 5.1) * names.length)], perches: [] };
    const P = (dx, dy, j) => l.perches.push({ id: `${l.id}_${j}`, landmark: l, x: x + dx, y: gy + dy, occupied: false });
    if (type === 'oak') { l.h = 210; P(0, -l.h - 2, 0); P(-58, -128, 1); P(64, -112, 2); }
    if (type === 'tower') { l.h = 150; P(-8, -l.h, 0); P(10, -l.h + 6, 1); }
    if (type === 'falls') { l.h = 190; P(-14, -l.h + 2, 0); }
    if (type === 'stones') { l.h = 44; P(0, -l.h, 0); P(-26, -30, 1); P(24, -34, 2); }
  }
  lmCache.set(k, l); return l;
}
export function landmarksIn(x0, x1) { const out = []; for (let k = Math.floor(x0 / LC) - 1; k <= Math.ceil(x1 / LC); k++) { const l = landmarkK(k); if (l && l.x > x0 - 200 && l.x < x1 + 200) out.push(l); } return out; }
const nearLandmark = x => { const l = landmarkK(Math.round((x - LC / 2) / LC)) || landmarkK(Math.floor(x / LC)); return l && Math.abs(l.x - x) < 90; };

/* ---------- trees ---------- */
export const TC = 46;
const treeCache = new Map();
function treeAt(i) {
  if (treeCache.has(i)) return treeCache.get(i);
  let t = null;
  const g = grove(i * TC), x = i * TC + hash(i * 2.91) * TC * .7, bio = biomeAt(x);
  if (hash(i * 1.37 + 11) < (g > .5 ? .55 : .1) * bio.trees) {
    const p = pondNear(x, 1.6);
    if (!p && slope(x) < 7 && !nearLandmark(x)) {
      const gy = groundY(x);
      const h = (g > .5 ? 74 : 60) + 64 * hash(i * 5.3);
      const type = hash(i * 7.7) < bio.broadleaf ? 1 : 0;
      t = { i, x, y: gy + 1, h, type, seed: i, perches: [], song: null, bio: bio.name };
      buildTree(t);
    }
  }
  treeCache.set(i, t);
  if (treeCache.size > 3000) treeCache.clear();
  return t;
}
function buildTree(t) {
  const { h, i } = t;
  t.lean = (hash(i * 3.3) - .5) * .06;
  const n = 2 + (hash(i * 4.1) < .5 ? 1 : 0);
  t.branches = [];
  let side = hash(i * 6.1) < .5 ? -1 : 1;
  for (let j = 0; j < n; j++) {
    let f, len;
    if (t.type === 0) { f = .28 + j * .14 + hash(i * 8 + j) * .06; len = h * .28 * (1 - (f - .15) / .85) + 8; }
    else { f = .38 + j * .1 + hash(i * 8 + j) * .05; len = h * (.2 + .08 * hash(i * 9 + j)) + 6; }
    const by = -h * f, rise = -(3 + 5 * hash(i * 10 + j));
    const b = { side, f, len, x0: 0, y0: by, x1: side * len, y1: by + rise };
    t.branches.push(b);
    // a perch near the branch tip, standing on its top edge (world coordinates)
    const k = .78;
    t.perches.push({ id: `p${i}_${j}`, tree: t, x: t.x + b.x1 * k + t.lean * -by, y: t.y + b.y0 + (b.y1 - b.y0) * k - 1.2, occupied: false });
    side = -side;
  }
  if (t.type === 0) t.perches.push({ id: `p${i}_top`, tree: t, x: t.x + t.lean * h, y: t.y - h + 1, occupied: false });
  // some trees are home to a songbird; which species and when it is there is up to songs.js
  if (hash(i * 9.1) < .4) t.song = { perch: t.perches[0], seed: hash(i * 4.4), next: hash(i) * 4, singingT: 0 };
}
export function treesIn(x0, x1) { const out = []; for (let i = Math.floor(x0 / TC) - 2; i <= Math.ceil(x1 / TC) + 1; i++) { const t = treeAt(i); if (t) out.push(t); } return out; }
// every place a bird can stand: tree branches and landmarks
export function perchesIn(x0, x1) {
  const out = [];
  for (const t of treesIn(x0, x1)) for (const p of t.perches) out.push(p);
  for (const l of landmarksIn(x0, x1)) for (const p of l.perches) out.push(p);
  return out;
}

// fallen twigs under some trees, for building a nest
export function twigsIn(x0, x1) {
  const out = [];
  for (const t of treesIn(x0, x1)) {
    if (hash(t.i * 2.2 + 4) > .45) continue;
    const x = t.x + (hash(t.i * 3.7) - .5) * 26;
    if (pondNear(x, 1.3)) continue;
    out.push({ id: `tw${t.i}`, x, y: groundY(x), a: (hash(t.i * 5.1) - .5) * .5 });
  }
  return out;
}

/* ---------- bushes and berries ---------- */
const BC = 64;
const bushCache = new Map();
function bushAt(i) {
  if (bushCache.has(i)) return bushCache.get(i);
  let b = null;
  const x = i * BC + hash(i * 4.7 + 2) * BC * .6, bio = biomeAt(x);
  if (hash(i * 2.3 + 7) < (grove(x) > .5 ? .12 : .3) * bio.bushes && !pondNear(x, 1.5) && slope(x) < 8 && !nearLandmark(x)) {
    const r = 8 + 6 * hash(i * 6.9);
    b = { i, x, y: groundY(x) + 2, r, seed: i + 700, berries: [], hardy: hash(i * 3.3) < .3 };
    const n = 4 + Math.floor(hash(i * 1.9) * 4);
    for (let j = 0; j < n; j++) {
      const a = Math.PI * (1.1 + .8 * hash(i * 13 + j)), rr = r * (.55 + .4 * hash(i * 17 + j));
      b.berries.push({ id: `b${i}_${j}`, j, x: x + Math.cos(a) * rr * 1.2, y: b.y - r * .7 + Math.sin(a) * rr * .8 });
    }
  }
  bushCache.set(i, b);
  if (bushCache.size > 3000) bushCache.clear();
  return b;
}
export function bushesIn(x0, x1) { const out = []; for (let i = Math.floor(x0 / BC) - 1; i <= Math.ceil(x1 / BC) + 1; i++) { const b = bushAt(i); if (b) out.push(b); } return out; }

/* ---------- small life on the ground: worms after rain, mice in the grass ---------- */
const WC = 38;
export function wormsIn(x0, x1) {
  const out = [];
  for (let i = Math.floor(x0 / WC); i <= Math.ceil(x1 / WC); i++) {
    if (hash(i * 5.7 + 3) > .42) continue;
    const x = i * WC + hash(i * 8.3) * WC * .8;
    if (pondNear(x, 1.25) || slope(x) > 8) continue;
    out.push({ id: `w${i}`, x, y: groundY(x), seed: i });
  }
  return out;
}
const MC = 90;
export function miceIn(x0, x1) {
  const out = [];
  for (let i = Math.floor(x0 / MC); i <= Math.ceil(x1 / MC); i++) {
    const x = i * MC + hash(i * 4.1 + 5) * MC * .6;
    if (hash(i * 6.3 + 1) > biomeAt(x).mice || pondNear(x, 1.4) || slope(x) > 9) continue;
    out.push({ id: `m${i}`, x, seed: i });
  }
  return out;
}

/* ---------- thermals and rings ---------- */
const TS = 700;
const thCache = new Map();
function thermalK(k) {
  if (thCache.has(k)) return thCache.get(k);
  let t = null;
  if (hash(k * 6.6 + 1) < .85) {
    const c = k * TS + 100 + hash(k * 2.2) * 240;
    t = { k, c, w: 38 + 16 * hash(k * 4.2), str: .8 + .35 * hash(k * 5.5), base: groundY(c), rings: [] };
    // a treeline-relative column: lift starts just above the tallest trees
    t.y0 = t.base - 110; t.y1 = t.base - 165;
    if (hash(k * 8.8) < .75) {
      const n = 1 + Math.floor(hash(k * 9.9) * 3);
      for (let j = 0; j < n; j++) t.rings.push({ id: `r${k}_${j}`, x: t.c + (hash(k * 3 + j) - .5) * t.w * 2.2, y: t.base - 280 - j * 100 - hash(k * 7 + j) * 30, r: 15 });
    }
  }
  thCache.set(k, t); if (thCache.size > 2000) thCache.clear(); return t;
}
export function thermalsIn(x0, x1) { const out = []; for (let k = Math.floor((x0 - 100) / TS) - 1; k <= Math.ceil(x1 / TS); k++) { const t = thermalK(k); if (t) out.push(t); } return out; }
export function thermalAt(x) { const k = Math.round((x - 220) / TS); for (let j = k - 1; j <= k + 1; j++) { const t = thermalK(j); if (t && Math.abs(x - t.c) < t.w) return t; } return null; }
export const CEILING = -820;
// upward air speed (world units/s) at a point
export function lift(x, y, time) {
  const t = thermalAt(x); if (!t) return 0;
  const d = Math.abs(x - t.c) / t.w;
  const horiz = .5 + .5 * Math.cos(d * Math.PI);
  const vert = smooth(-t.y0, -t.y1, -y) * (1 - smooth(-CEILING - 140, -CEILING, -y));
  return TUNE.thermal * env.thermal * t.str * horiz * vert * (.85 + .15 * Math.sin(time * .7 + t.k));
}
// horizontal wind, a little stronger with height and over the cliffs
export const windAt = (y, x) => env.wind * (1 + clamp(-y / 600, 0, 1) * .6) * (x === undefined ? 1 : blended(x, 'wind'));
// ridge lift: wind meeting a rising hillside is pushed up along its windward face
export function ridgeLift(x, y) {
  const gy = groundY(x), h = gy - y;
  if (h < 0 || h > 170) return 0;
  const slope = (groundY(x + 30) - groundY(x - 30)) / 60;   // negative when the ground rises to the right
  const up = -windAt(y, x) * slope;
  if (up <= 0) return 0;
  return up * TUNE.ridge * smooth(0, 12, h) * (1 - smooth(50, 170, h));
}
// total upward air speed at a point
export const updraft = (x, y, time) => lift(x, y, time) + ridgeLift(x, y);
