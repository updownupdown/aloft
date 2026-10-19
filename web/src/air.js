// Lift beyond the thermals and ridges, and the clouds that mark it:
//  - wave lift: on still evenings the air over the mountains rises in long smooth waves, high
//    above the thermals, each crest marked by a lens-shaped cloud;
//  - kettles: on big migration days wild hawks gather in a strong thermal and circle up it
//    together; inside the kettle the hawk climbs faster, and when they peel off south in a
//    loose line, following them is easy flying;
//  - cumulus: every thermal tops out in a cloud at the cloudbase, and flying through one
//    carves a tunnel of bare paper that slowly heals.
// Positions are pure functions of x, the day and the clock; only the tunnels are stored.
import * as W from './world.js';
import { hash as hash0, smooth, clamp, lerp, TAU } from './util.js';

const hash = n => hash0(n + W.seed.v * 13.7);
// set by the game each frame: how strong the evening wave is (0 to 1)
export const airEnv = { wave: 0 };

/* ---------- wave lift and lens clouds ---------- */
// Wave cells over the mountains; each holds a train of two or three crests downwind of a peak.
const WS = 2600, WAVE_LO = -620, WAVE_HI = -1750, WAVE = 34;
const waveCache = new Map();
function waveK(k) {
  if (waveCache.has(k)) return waveCache.get(k);
  let w = null;
  const c = k * WS + 500 + hash(k * 3.9 + 7) * (WS - 1000);
  if (W.rugged(c) > .45 && hash(k * 5.7 + 2) < .7) {
    const n = 2 + (hash(k * 2.3) < .5 ? 1 : 0), lam = 480 + 220 * hash(k * 8.1);
    w = { k, crests: [] };
    for (let j = 0; j < n; j++) w.crests.push({ id: `lens${k}_${j}`, x: c + j * lam, y: -1180 - 160 * hash(k * 4 + j) + j * 40, len: 260 - j * 40 + 60 * hash(k + j * 9), seed: k * 7 + j });
  }
  waveCache.set(k, w); if (waveCache.size > 400) waveCache.clear();
  return w;
}
export function lensesIn(x0, x1) {
  const out = [];
  if (airEnv.wave <= 0) return out;
  for (let k = Math.floor((x0 - 1000) / WS); k <= Math.ceil(x1 / WS); k++) { const w = waveK(k); if (w) for (const c of w.crests) if (c.x + c.len > x0 && c.x - c.len < x1) out.push(c); }
  return out;
}
// smooth, silent lift: strongest just upwind of each crest, from a little above the thermals'
// cloudbase up to well over the lens clouds
export function waveLift(x, y) {
  if (airEnv.wave <= 0 || y > WAVE_LO) return 0;
  const k = Math.floor(x / WS);
  let v = 0;
  for (let j = k - 1; j <= k; j++) {
    const w = waveK(j); if (!w) continue;
    for (const c of w.crests) {
      const d = (x - c.x + 80) / 260;
      if (Math.abs(d) < 1) v = Math.max(v, (.5 + .5 * Math.cos(d * Math.PI)));
    }
  }
  if (!v) return 0;
  const vert = smooth(-WAVE_LO, -WAVE_LO + 160, -y) * (1 - smooth(-WAVE_HI - 200, -WAVE_HI, -y));
  return WAVE * airEnv.wave * v * vert;
}

/* ---------- kettles ---------- */
// A kettle's cycle: the hawks circle up the column, then peel off south one by one and glide away.
const CYCLE = 170, CLIMB = 85, PEEL = 3.2, SPEED = 58;
export const kettle = { force: false };   // (debug: every strong thermal has one)
// a big migration day: most autumn days, some spring days
export function bigDay(G) {
  if (kettle.force) return true;
  const h = hash(G.day * 7.3 + 1);
  return (G.sea.autumn > .5 && h < .55) || (G.sea.spring > .5 && h < .25);
}
function kettleOf(t, G) {
  if (!kettle.force && (t.str < .95 || hash(t.k * 3.7 + G.day * 1.3) > .6)) return null;
  const n = 6 + Math.floor(hash(t.k * 2.9 + G.day) * 7);
  return { t, n, ph: (G.t + hash(t.k * 6.1) * CYCLE) % CYCLE };
}
const TOP = () => W.CEILING + 50;
// where each hawk of a kettle is now: circling (with a depth for size), or gliding away south
function kettleHawks(K, G) {
  const { t, n, ph } = K, out = [];
  const climb = Math.min(1, ph / CLIMB), bottom = t.y0 - 30;
  for (let i = 0; i < n; i++) {
    const hi = hash(t.k * 9.1 + i * 3.3), r = t.w * (.18 + .22 * hi), spin = .55 + .15 * hash(i * 4.7 + t.k);
    const leave = CLIMB + i * PEEL, gone = ph - leave;
    if (gone > 0) {
      // peeled off: a long straight glide south, each a little behind the last
      const dx = gone * SPEED;
      if (dx > 2600) continue;
      out.push({ x: t.c + r + dx, y: TOP() + i * 6 + dx * .1 + Math.sin(G.t * .8 + i) * 3, face: 1, bank: 0, z: 1, i, glide: true });
      continue;
    }
    const a = ph * spin + i * TAU / n, y = lerp(bottom, TOP(), climb) + (hi - .5) * 140 * (1 - climb * .5);
    out.push({ x: t.c + Math.cos(a) * r, y: Math.max(TOP() - 30, y), face: Math.sin(a) > 0 ? -1 : 1, bank: Math.cos(a) * .25, z: .82 + .18 * Math.sin(a), i, glide: false });
  }
  return out;
}
export function kettlesIn(x0, x1, G) {
  const out = [];
  if (!bigDay(G) || G.tod < .33 || G.tod > .72 || G.storm > .4) return out;
  for (const t of W.thermalsIn(x0 - 2700, x1)) {
    const K = kettleOf(t, G); if (!K) continue;
    K.hawks = kettleHawks(K, G).filter(h => h.x > x0 - 30 && h.x < x1 + 30);
    if (K.hawks.length) out.push(K);
  }
  return out;
}
// extra lift for the hawk: inside a climbing kettle's band of birds the thermal works half as
// hard again (they mark the core); close behind the line gliding south, a gentle lift
export function kettleBoost(b, G) {
  if (!bigDay(G) || G.tod < .33 || G.tod > .72 || G.storm > .4) return { k: 1, follow: 0 };
  for (const t of W.thermalsIn(b.x - 2700, b.x + 10)) {
    const K = kettleOf(t, G); if (!K) continue;
    const hs = kettleHawks(K, G);
    if (K.ph < CLIMB + K.n * PEEL && Math.abs(b.x - t.c) < t.w * .7) {
      let lo = Infinity, hi = -Infinity;
      for (const h of hs) if (!h.glide) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); }
      if (b.y > lo - 90 && b.y < hi + 90) return { k: 1.5, follow: 0, K };
    }
    for (const h of hs) if (h.glide && Math.abs(h.x - b.x) < 90 && Math.abs(h.y - b.y) < 45) return { k: 1, follow: 7, K };
  }
  return { k: 1, follow: 0 };
}

/* ---------- cumulus at the cloudbase, and the tunnels carved through them ---------- */
export function cumulusOf(t) {
  return { id: 'cu' + t.k, x: t.c + (hash(t.k * 2.7) - .5) * t.w * .3, y: W.CEILING - 45, w: t.w * 1.2 + 80, h: 160 + 50 * hash(t.k * 5.3), seed: t.k };
}
export function cumuliIn(x0, x1) {
  const out = [];
  for (const t of W.thermalsIn(x0 - 400, x1 + 400)) { const c = cumulusOf(t); if (c.x + c.w > x0 && c.x - c.w < x1) out.push(c); }
  return out;
}
// is a point inside a cloud's body (an ellipse-ish dome over a flat base)?
export function inCloud(c, x, y) {
  const dx = (x - c.x) / (c.w * .58), dy = (y - c.y) / (c.h * .75);
  return y < c.y + c.h * .28 && dx * dx + dy * dy < 1;
}
export const HEAL = 60, CARVE_R = 17;
// record the hawk's path through a cloud: a point every few units, each healing over a minute
export function carve(G, b) {
  G.carve ??= new Map();
  for (const [id, pts] of G.carve) {
    while (pts.length && G.t - pts[0].t > HEAL) pts.shift();
    if (!pts.length) G.carve.delete(id);
  }
  if (b.state !== 'fly' || b.y > W.CEILING + 60) return null;
  const c = cumuliIn(b.x, b.x).find(c => inCloud(c, b.x, b.y));
  if (!c) return null;
  let pts = G.carve.get(c.id);
  if (!pts) G.carve.set(c.id, pts = []);
  const last = pts[pts.length - 1];
  if (!last || Math.hypot(b.x - last.x, b.y - last.y) > 7) pts.push({ x: b.x, y: b.y, t: G.t });
  else last.t = G.t;
  return c;
}
