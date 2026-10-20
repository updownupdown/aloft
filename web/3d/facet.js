// Low poly for the pages around the world: the menu sheet, the HUD, the journal map, postcards
// and the seal are flat polygons, each facet one colour, shaded by which way it leans toward a
// light in the upper left, the way the world's own triangles are. Painted on demand, never every
// frame.
const TAU = Math.PI * 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
export const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const C = (a, al) => al === undefined ? `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})` : `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${cl(al, 0, 1)})`;
export const shade = (a, k) => [cl(a[0] * k, 0, 255), cl(a[1] * k, 0, 255), cl(a[2] * k, 0, 255)];

// the world's colours (world.js PAL, as 0..255), for the UI's accents
export const PIG = {
  paper: hexRGB('#f1ece0'), paper2: hexRGB('#e6dcc8'), ink: hexRGB('#2b1a10'), ink2: hexRGB('#5a3a26'),
  meadow: hexRGB('#9bb067'), wood: hexRGB('#6f8f4e'), pine: hexRGB('#3e6446'), sand: hexRGB('#d9c08e'), rock: hexRGB('#8f8577'),
  bark: hexRGB('#5c4632'), ring: hexRGB('#e2a93a'), water: hexRGB('#4f7fa6'), sky: hexRGB('#84aed0'), berry: hexRGB('#a8483a'), wax: hexRGB('#a8402e'),
};

let rs = 1;
export const seedR = s => { rs = Math.floor(s * 7919 + 13) % 2147483647 || 1; };
export const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

export function poly(x, pts, fill) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } }
// a facet's brightness: its slope (from the heights at its corners) against a light up and to the left
const LIGHT = (() => { const l = [-.45, -.6, .66], n = Math.hypot(...l); return l.map(v => v / n); })();
export function lit(a, b, c, k = 1) {
  const u = [b[0] - a[0], b[1] - a[1], (b[2] - a[2]) * k], v = [c[0] - a[0], c[1] - a[1], (c[2] - a[2]) * k];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (n[2] < 0) n = n.map(q => -q);
  const l = Math.hypot(...n) || 1;
  return (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / l;
}
// a rectangle cut into jittered triangles, each shaded by its lean; colour(cx, cy) gives the base
// colour at a facet's centre. relief scales how far the facets tilt; gap strokes each facet in its
// own colour so no hairline of background shows along the seams.
export function facets(x, x0, y0, w, h, cell, colour, { seed = 1, relief = 1, gap = .8 } = {}) {
  seedR(seed);
  const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell)), sx = w / nx, sy = h / ny, V = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const edge = i === 0 || j === 0 || i === nx || j === ny;
    V.push([x0 + i * sx + (edge ? 0 : (rnd() - .5) * sx * .55), y0 + j * sy + (edge ? 0 : (rnd() - .5) * sy * .55), rnd() * cell * .5]);
  }
  const at = (i, j) => V[j * (nx + 1) + i];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    const tris = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const t of tris) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const base = colour(cx, cy, t); if (!base) continue;
      const f = base.length > 3 ? base[3] : lit(...t, relief);
      const col = C(shade(base, .9 + f * .14));
      poly(x, t, col);
      if (gap) { x.strokeStyle = col; x.lineWidth = gap; x.lineJoin = 'round'; x.stroke(); }
    }
  }
}
// a rectangle with its corners cut off
export const chamfer = (x0, y0, w, h, c) => [[x0 + c, y0], [x0 + w - c, y0], [x0 + w, y0 + c], [x0 + w, y0 + h - c], [x0 + w - c, y0 + h], [x0 + c, y0 + h], [x0, y0 + h - c], [x0, y0 + c]];
export const ngon = (cx, cy, r, n, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
// a flat gem: a polygon fanned from its centre, each wedge shaded by the way it faces
export function gem(x, cx, cy, r, n, col, { rot = 0, depth = .6, inner = 0 } = {}) {
  const P = ngon(cx, cy, r, n, rot);
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n], mid = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx);
    const f = -(Math.cos(mid) * LIGHT[0] + Math.sin(mid) * LIGHT[1]) * depth;
    const c0 = inner ? [cx + (p[0] - cx) * inner, cy + (p[1] - cy) * inner] : [cx, cy], c1 = inner ? [cx + (q[0] - cx) * inner, cy + (q[1] - cy) * inner] : null;
    poly(x, c1 ? [p, q, c1, c0] : [p, q, c0], C(shade(col, 1 + f * .35)));
  }
  return P;
}
// a crisp shadow: the shape again, offset down and right, in one flat dark
export function hardShadow(x, pts, dx, dy, a = .22) { poly(x, pts.map(([px, py]) => [px + dx, py + dy]), `rgba(30,18,10,${a})`); }
