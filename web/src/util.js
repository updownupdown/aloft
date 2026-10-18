// Small math, noise and colour helpers shared by every module.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const approach = (v, target, rate) => v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);

// Deterministic hash in [0,1). Everything in the world is generated from this, so it is
// the same every visit without storing anything.
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hash(i + seed * 1013.7), b = hash(i + 1 + seed * 1013.7);
  return a + (b - a) * u;
}
export function fbm(x, seed) { return (vnoise(x, seed) * .6 + vnoise(x * 2.1, seed + 1) * .28 + vnoise(x * 4.3, seed + 2) * .12) * 2 - 1; }

export function hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
export function C(a, al) { return al === undefined ? `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})` : `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${clamp(al, 0, 1)})`; }
export const shade = (a, k) => [clamp(a[0] * k, 0, 255), clamp(a[1] * k, 0, 255), clamp(a[2] * k, 0, 255)];
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const grey = (a, t) => { const g = (a[0] * .3 + a[1] * .55 + a[2] * .15); return mix(a, [g, g, g * 1.04], t); };
