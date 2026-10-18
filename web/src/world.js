// The procedural world. Everything is a pure function of world x and a hash, so the
// world is endless in both directions and identical on every visit.
// Coordinates: x right, y DOWN, ground sits around y = 0.
import { hash, vnoise, fbm, lerp, smooth } from './util.js';

const groundRaw = x => 22 * fbm(x / 240, 1) + 40 * fbm(x / 1100, 3) + 5 * fbm(x / 60, 4);

/* ---------- ponds ---------- */
const PS = 820;
const pondCache = new Map();
function pondK(k) {
  if (pondCache.has(k)) return pondCache.get(k);
  let p = null;
  if (hash(k * 3.1 + .5) < .72) {
    const c = k * PS + 200 + hash(k * 1.7) * 300;
    const w = 34 + 34 * hash(k * 5.3), rim = groundRaw(c);
    p = { k, c, w, depth: 12 + 10 * hash(k * 7.9), rim, waterY: rim + 2, x0: null, x1: null };
  }
  pondCache.set(k, p);
  if (p) { // the actual wet span, where the bowl dips below the water line
    let a = p.c, b = p.c;
    while (a > p.c - p.w && groundY(a - 1) > p.waterY) a--;
    while (b < p.c + p.w && groundY(b + 1) > p.waterY) b++;
    p.x0 = a; p.x1 = b;
  }
  return p;
}
export function pondNear(x, reach = 2.4) {
  const k = Math.round((x - 350) / PS);
  for (let j = k - 1; j <= k + 1; j++) { const p = pondK(j); if (p && Math.abs(x - p.c) < p.w * reach) return p; }
  return null;
}
export function groundY(x) {
  let h = groundRaw(x);
  const p = pondNear(x);
  if (p) {
    const d = Math.abs(x - p.c) / p.w;
    h = lerp(h, p.rim, smooth(2.4, 1.2, d));
    if (d < 1) h += p.depth * Math.pow(1 - d * d, 1.2);
  }
  return h;
}
// water surface at x, or null when x is dry land
export function waterAt(x) {
  const p = pondNear(x, 1);
  if (p && Math.abs(x - p.c) < p.w && groundY(x) > p.waterY) return p.waterY;
  return null;
}
export function pondsIn(x0, x1) {
  const out = [];
  for (let k = Math.floor((x0 - 350) / PS) - 1; k <= Math.ceil((x1 - 350) / PS) + 1; k++) { const p = pondK(k); if (p && p.x1 > x0 - 20 && p.x0 < x1 + 20) out.push(p); }
  return out;
}
const slope = x => Math.abs(groundY(x + 6) - groundY(x - 6));
const grove = x => vnoise(x / 520, 21);

/* ---------- trees ---------- */
export const TC = 46;
export const SPECIES = 6; // number of songbird species, see songs.js
const treeCache = new Map();
function treeAt(i) {
  if (treeCache.has(i)) return treeCache.get(i);
  let t = null;
  const g = grove(i * TC);
  if (hash(i * 1.37 + 11) < (g > .5 ? .7 : .1)) {
    const x = i * TC + hash(i * 2.91) * TC * .7;
    const p = pondNear(x, 1.6);
    if (!p && slope(x) < 7) {
      const gy = groundY(x);
      const h = (g > .5 ? 74 : 60) + 64 * hash(i * 5.3);
      const type = hash(i * 7.7) < .42 ? 0 : 1;
      t = { i, x, y: gy + 1, h, type, seed: i, perches: [], song: null };
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
  // some trees hold a singing songbird on one branch; the player perches on another
  if (hash(i * 9.1) < .32) {
    const p = t.perches[0]; p.occupied = true;
    t.song = { perch: p, species: Math.floor(hash(i * 4.4) * SPECIES), next: hash(i) * 4 };
  }
}
export function treesIn(x0, x1) { const out = []; for (let i = Math.floor(x0 / TC) - 2; i <= Math.ceil(x1 / TC) + 1; i++) { const t = treeAt(i); if (t) out.push(t); } return out; }

/* ---------- bushes and berries ---------- */
const BC = 64;
const bushCache = new Map();
function bushAt(i) {
  if (bushCache.has(i)) return bushCache.get(i);
  let b = null;
  const x = i * BC + hash(i * 4.7 + 2) * BC * .6;
  if (hash(i * 2.3 + 7) < (grove(x) > .5 ? .12 : .3) && !pondNear(x, 1.5) && slope(x) < 8) {
    const r = 8 + 6 * hash(i * 6.9);
    b = { i, x, y: groundY(x) + 2, r, seed: i + 700, berries: [] };
    const n = 4 + Math.floor(hash(i * 1.9) * 4);
    for (let j = 0; j < n; j++) {
      const a = Math.PI * (1.1 + .8 * hash(i * 13 + j)), rr = r * (.55 + .4 * hash(i * 17 + j));
      b.berries.push({ id: `b${i}_${j}`, x: x + Math.cos(a) * rr * 1.2, y: b.y - r * .7 + Math.sin(a) * rr * .8 });
    }
  }
  bushCache.set(i, b);
  if (bushCache.size > 3000) bushCache.clear();
  return b;
}
export function bushesIn(x0, x1) { const out = []; for (let i = Math.floor(x0 / BC) - 1; i <= Math.ceil(x1 / BC) + 1; i++) { const b = bushAt(i); if (b) out.push(b); } return out; }

/* ---------- worms (only shown while the ground is wet) ---------- */
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
  thCache.set(k, t); return t;
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
  return 48 * t.str * horiz * vert * (.85 + .15 * Math.sin(time * .7 + t.k));
}
