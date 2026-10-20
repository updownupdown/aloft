// Watercolour on paper for the menu, the HUD and the journal (the 3D world is not painted, but
// the pages around it are): handmade paper, washes with wobbly pooled edges, a torn sheet edge,
// ink lines and a flat brush stroke. Painted on demand, never every frame.
const TAU = Math.PI * 2;
const ihash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = ihash(i + seed * 1013.7), b = ihash(i + 1 + seed * 1013.7);
  return a + (b - a) * u;
}
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
export const C = (a, al) => al === undefined ? `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})` : `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${cl(al, 0, 1)})`;
export const shade = (a, k) => [cl(a[0] * k, 0, 255), cl(a[1] * k, 0, 255), cl(a[2] * k, 0, 255)];
export const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// a seeded random for paintings that must look the same every time they are painted
let rs = 1;
export const seedR = s => { rs = Math.floor(s * 7919 + 13) % 2147483647 || 1; };
export const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// smooth noise for nearly nothing: a tiny random canvas scaled up with smoothing on
function cloudy(x, w, h, cells, lo, hi, alpha) {
  const cw = Math.max(2, Math.round(w / cells)), ch = Math.max(2, Math.round(h / cells)), c = canvasOf(cw, ch), cx = c.getContext('2d');
  const d = cx.createImageData(cw, ch);
  for (let i = 0; i < d.data.length; i += 4) { const v = lo + Math.random() * (hi - lo); d.data[i] = v; d.data[i + 1] = v * .985; d.data[i + 2] = v * .955; d.data[i + 3] = 255; }
  cx.putImageData(d, 0, 0);
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = alpha; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(c, 0, 0, w, h); x.restore();
}
// handmade cotton-rag paper as a white-based multiply texture: cloudy formation, curling fibres,
// flecks of plant matter and fine tooth. k scales the fibres (1 is about one CSS pixel).
export function handmadeTex(w, h, k = 1) {
  w = Math.ceil(w); h = Math.ceil(h);
  const c = canvasOf(w, h), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  cloudy(x, w, h, 90 * k, 228, 255, .5);
  cloudy(x, w, h, 26 * k, 232, 255, .45);
  cloudy(x, w, h, 7 * k, 236, 255, .4);
  const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const v = Math.random(), q = v < .05 ? -16 : v > .975 ? 7 : (Math.random() - .5) * 9;
    a[i] += q; a[i + 1] += q; a[i + 2] += q * .85;
  }
  x.putImageData(d, 0, 0);
  for (let i = 0; i < w * h / (260 * k * k); i++) {
    const px = Math.random() * w, py = Math.random() * h, an = Math.random() * TAU, l = (Math.random() < .06 ? 18 + Math.random() * 26 : 4 + Math.random() * 10) * k, bend = (Math.random() - .5) * l * .8;
    x.strokeStyle = `rgba(118,100,78,${.035 + Math.random() * .07})`; x.lineWidth = (.35 + Math.random() * .5) * k;
    const ex = px + Math.cos(an) * l, ey = py + Math.sin(an) * l;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo((px + ex) / 2 - Math.sin(an) * bend, (py + ey) / 2 + Math.cos(an) * bend, ex, ey); x.stroke();
  }
  for (let i = 0; i < w * h / (9000 * k * k); i++) {
    const px = Math.random() * w, py = Math.random() * h;
    if (Math.random() < .7) { x.fillStyle = `rgba(92,70,48,${.18 + Math.random() * .25})`; x.beginPath(); x.arc(px, py, (.4 + Math.random() * .8) * k, 0, TAU); x.fill(); }
    else { const an = Math.random() * TAU, l = (2 + Math.random() * 5) * k; x.strokeStyle = Math.random() < .5 ? 'rgba(150,110,70,.28)' : 'rgba(120,130,80,.24)'; x.lineWidth = (.8 + Math.random()) * k; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); x.stroke(); }
  }
  return c;
}

// a jittered copy of a point list; each pass deforms differently so overlapping passes pool
export function jit(pts, amp, seed, pass) {
  const o = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], k = i * .41 + pass * 7.3;
    o.push([p[0] + (vnoise(k, seed) * 2 - 1) * amp, p[1] + (vnoise(k, seed + pass * 3 + 5) * 2 - 1) * amp]);
  }
  return o;
}
export function pathPts(x, pts, close = true) {
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  if (close) x.closePath();
}
// a wash: translucent multiply passes with different edge jitter and a darker rim where it dried
export function wash(x, pts, col, a, o = {}) {
  const passes = o.passes || 3, amp = o.amp || 2.2, seed = o.seed || 1;
  const rim = o.rim === undefined ? .5 : o.rim, rimA = rim > 0 ? Math.min(.75, (rim * 1.7 + .12) * .75) : 0;
  x.save(); x.globalCompositeOperation = 'multiply';
  for (let p = 0; p < passes; p++) {
    x.fillStyle = C(col, a * (1.15 / passes) * (p === 0 ? 1.1 : .9));
    pathPts(x, jit(pts, amp * (p + 1) / passes, seed, p)); x.fill();
  }
  if (rimA > 0) {
    x.strokeStyle = C(shade(col, .62), a * rimA); x.lineWidth = o.rimW || 1.3; x.lineJoin = 'round';
    pathPts(x, jit(pts, amp * .6, seed, 9)); x.stroke();
  }
  x.restore();
}
export const circP = (cx, cy, r, n = 14) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
// a rounded bar as a polygon, so wash() can give it a wobbly edge
export function pillP(x0, y0, w, h) {
  const r = h / 2, p = []; w = Math.max(w, h);
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + Math.PI * i / 6; p.push([x0 + w - r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
  for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + Math.PI * i / 6; p.push([x0 + r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
  return p;
}
// an ink line: two jittered multiply strokes
export function inkLine(x, pts, a, w, col = [58, 36, 24]) {
  x.save(); x.globalCompositeOperation = 'multiply'; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let k = 0; k < 2; k++) { x.strokeStyle = C(col, a * (k ? .5 : .85)); x.lineWidth = w * (k ? .6 : 1); pathPts(x, jit(pts, w * .5, 3 + k, k), false); x.stroke(); }
  x.restore();
}
export function wobbly(x0, y0, x1, y1, n, amp) { seedR(x0 + y0); const p = []; for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0) * i / n + (rnd() - .5) * amp, y0 + (y1 - y0) * i / n + (rnd() - .5) * amp]); return p; }
// a rectangle's outline with a torn, fibrous edge (amp) that wanders slowly
export function deckle(x0, y0, w, h, amp, seed, rot = 0) {
  seedR(seed); const pts = [], step = 3;
  let d = 0;
  const edge = (ax, ay, bx, by, nx, ny) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    for (let i = 0; i < n; i++) {
      const t = i / n; d += (rnd() - .5) * amp * .5; d *= .92;
      const j = d + (rnd() - .5) * amp;
      pts.push([ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j]);
    }
  };
  edge(x0, y0, x0 + w, y0, 0, -1); edge(x0 + w, y0, x0 + w, y0 + h, 1, 0); edge(x0 + w, y0 + h, x0, y0 + h, 0, 1); edge(x0, y0 + h, x0, y0, -1, 0);
  const cx = x0 + w / 2, cy = y0 + h / 2, c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([px, py]) => [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c]);
}
// a flat brush pulled once from left to right: square where it lands, full through the middle,
// breaking into bristle marks where it lifts off, with dry streaks where the paint ran out
export function brush(x, x0, cy, len, hgt, col, seed) {
  seedR(seed + 40); const top = [], bot = [], n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x0 + len * t;
    const body = Math.min(1, t * 9, (1 - t) * 3.2) ** .45 * (1 - t * .15);
    const sag = (t - .5) * hgt * .1;
    const fray = t > .72 ? (rnd() - .3) * hgt * .22 * (t - .72) / .28 : 0;
    top.push([px + (rnd() - .5) * 2, cy - sag - hgt / 2 * body + (rnd() - .5) * hgt * .07 + fray]);
    bot.push([px + (rnd() - .5) * 2, cy - sag + hgt / 2 * body + (rnd() - .5) * hgt * .07 - fray]);
  }
  const band = [...top, ...bot.reverse()];
  wash(x, band, col, .3, { passes: 3, amp: hgt * .05, seed, rim: .22, rimW: 1.2 });
  const core = band.map(([px, py]) => [px, cy - (px - x0 - len / 2) / len * hgt * .1 + (py - cy) * .55]);
  wash(x, core, col, .14, { passes: 2, amp: hgt * .06, seed: seed + 1, rim: 0 });
  x.save(); x.globalCompositeOperation = 'multiply'; x.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const off = (rnd() - .5) * hgt * .75, s0 = x0 + len * (.15 + rnd() * .45), e0 = x0 + len * (.82 + rnd() * .2);
    const y = t => cy + off - ((t - x0) / len - .5) * hgt * .1;
    x.strokeStyle = C(col, .13 + rnd() * .08); x.lineWidth = .7 + rnd() * 1.3;
    x.beginPath(); x.moveTo(s0, y(s0)); x.lineTo(e0, y(e0)); x.stroke();
  }
  x.restore();
}
