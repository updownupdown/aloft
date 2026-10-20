// Small helpers shared by the 3D modules: storage, maths, vectors.
export const store = {
  get(k, d) { try { const v = localStorage.getItem('aloft.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aloft.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const norm = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// a seeded random in [0,1) per call site, for things that must not change between visits
export function rng(seed) { let s = (seed * 16807 + 1) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
