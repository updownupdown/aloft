// The world's dice: a seeded integer hash and value noise built on it. Everything generated
// (land, trees, rocks, thermals, weather days) comes from ih(), so a new seed is a new world.
// The seed lives in store 'worldSeed' (default 1); ?seed=N tries one without saving it.
import { store } from './util.js';

export const WORLD = { seed: 1 };
let S = 0;
export function setSeed(n) { WORLD.seed = n >>> 0; S = Math.imul(WORLD.seed ^ 0x5bd1e995, 0x9e3779b1); }
const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
setSeed(qs?.has('seed') ? +qs.get('seed') : store.get('worldSeed', 1));

export function ih(ix, iz, s = 0) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s + 1, 1442695041) ^ S;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function vn(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = ih(ix, iz, s), b = ih(ix + 1, iz, s), c = ih(ix, iz + 1, s), d = ih(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
// fractal value noise, -1..1
export function fbm(x, z, s, oct = 3) {
  let v = 0, amp = .5, f = 1, sum = 0;
  for (let i = 0; i < oct; i++) { v += vn(x * f, z * f, s + i * 17) * amp; sum += amp; amp *= .5; f *= 2.03; }
  return v / sum * 2 - 1;
}
// sharp crests where the noise crosses zero, 0..1
export const ridged = (x, z, s, oct = 3) => 1 - Math.abs(fbm(x, z, s, oct));
// the same crests, rounded over the top (soft sets how broad the rounding is)
export const softRidged = (x, z, s, oct = 3, soft = .08) => { const f = fbm(x, z, s, oct); return 1 - Math.sqrt(f * f + soft * soft) + soft; };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// a fresh game in a fresh world: a new seed, the old save cleared
export function newWorld(seed = (Math.random() * 1e9) | 0) {
  store.set('worldSeed', seed); store.set('save3d', null);
  if (typeof location !== 'undefined') { const u = new URL(location.href); u.searchParams.delete('seed'); location.replace(u.href); }
}
