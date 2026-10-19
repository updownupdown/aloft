// Watercolour toolkit, ported from the Wet Wash art direction demo.
// Every object is a polygon washed two or three times with slightly different wobbly
// edges in multiply blend, so paint pools where the passes overlap.
import { TAU, clamp, vnoise, hash, C, shade } from './util.js';
import { stats } from './gfx.js';

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Paper textures are generated at the view's size (on resize) so the grain never tiles or stretches.
export let coldPress = null, granule = null, finish = null;
const GRAN = .1;

// Smooth noise for nearly nothing: a tiny random canvas scaled up with smoothing on.
function cloudy(x, w, h, cells, lo, hi, alpha) {
  const cw = Math.max(2, Math.round(w / cells)), ch = Math.max(2, Math.round(h / cells)), c = makeCanvas(cw, ch), cx = c.getContext('2d');
  const d = cx.createImageData(cw, ch);
  for (let i = 0; i < d.data.length; i += 4) { const v = lo + Math.random() * (hi - lo); d.data[i] = v; d.data[i + 1] = v * .985; d.data[i + 2] = v * .955; d.data[i + 3] = 255; }
  cx.putImageData(d, 0, 0);
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = alpha; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(c, 0, 0, w, h); x.restore();
}
// Handmade cotton-rag paper as a white-based multiply texture: cloudy formation where the pulp
// settled unevenly, curling fibres, a few flecks of plant matter, and fine tooth. k scales the
// fibres and flecks (1 is about one CSS pixel), so the same paper serves the game and the menu card.
export function handmadeTex(w, h, k = 1) {
  w = Math.ceil(w); h = Math.ceil(h);
  const c = makeCanvas(w, h), x = c.getContext('2d');
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
export function makePaper(w, h) {
  w = Math.ceil(w); h = Math.ceil(h);
  // fine-grained handmade paper: the fibres and flecks stay small whatever the resolution
  coldPress = handmadeTex(w, h, clamp(Math.min(w, h) / 700, .6, 1.4));
  // granulation: pigment settling in the paper's tooth, at full resolution so the grain is fine
  const c2 = makeCanvas(w, h), x2 = c2.getContext('2d'), d2 = x2.createImageData(w, h), a2 = d2.data;
  for (let i = 0; i < a2.length; i += 4) { const v = Math.random(); const k = v < .14 ? 212 + Math.random() * 28 : 255; a2[i] = a2[i + 1] = a2[i + 2] = k; a2[i + 3] = 255; }
  x2.putImageData(d2, 0, 0); granule = c2;
  // the finishing glaze: granulation and paper tooth merged into one texture, so the frame
  // takes a single multiply pass (multiplying by A then by B is the same as by A x B)
  const c3 = makeCanvas(w, h), x3 = c3.getContext('2d'); x3.fillStyle = '#fff'; x3.fillRect(0, 0, w, h);
  x3.globalCompositeOperation = 'multiply'; x3.globalAlpha = GRAN; x3.drawImage(granule, 0, 0, w, h);
  x3.globalAlpha = .6; x3.drawImage(coldPress, 0, 0, w, h); finish = c3;
}

// A jittered copy of a point list. Pass picks a different deformation so overlapping passes pool at the edges.
// `base` offsets the noise index so world-anchored shapes keep the same wobble while the camera moves.
export function jit(pts, amp, seed, pass, base = 0) {
  const o = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], k = (i + base) * .41 + pass * 7.3;
    o.push([p[0] + (vnoise(k, seed) * 2 - 1) * amp, p[1] + (vnoise(k, seed + pass * 3 + 5) * 2 - 1) * amp]);
  }
  return o;
}
export function pathPts(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// the core: several translucent multiply passes with different edge jitter, plus a darker rim where pigment dries
export function wash(ctx, pts, col, a, o = {}) {
  const passes = o.passes || 3, amp = o.amp || 2.2, seed = o.seed || 1, base = o.base || 0;
  // pooled edges: pigment dries darker at the rim of every wash
  const rim = o.rim === undefined ? .5 : o.rim, rimA = rim > 0 ? Math.min(.75, (rim * 1.7 + .12) * .75) : 0;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (let p = 0; p < passes; p++) {
    ctx.fillStyle = C(col, a * (1.15 / passes) * (p === 0 ? 1.1 : .9));
    pathPts(ctx, jit(pts, amp * (p + 1) / passes, seed, p, base)); ctx.fill();
  }
  if (inSprite && rim > 0) edgePool(ctx, pts, col, a, amp, seed, base);
  if (rimA > 0) {
    ctx.strokeStyle = C(shade(col, .62), a * rimA); ctx.lineWidth = o.rimW || 1.3; ctx.lineJoin = 'round';
    pathPts(ctx, jit(pts, amp * .6, seed, 9, base), o.closeRim !== false); ctx.stroke();
  }
  ctx.restore();
}
// Paint gathering just inside the edge as a wash dries: a soft stroke clipped to the shape. Only
// inside cached sprites, so it costs nothing per frame. Strip polygons reach past their sprite on
// the sides, so the stroke never shows at the seams.
let inSprite = false;
function edgePool(ctx, pts, col, a, amp, seed, base) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const d = Math.min(x1 - x0, y1 - y0, 14), path = jit(pts, amp * .5, seed, 1, base);
  ctx.save(); pathPts(ctx, path); ctx.clip(); ctx.lineJoin = 'round';
  ctx.strokeStyle = C(shade(col, .8), a * .165); ctx.lineWidth = d * .45; ctx.stroke();
  ctx.strokeStyle = C(shade(col, .75), a * .135); ctx.lineWidth = d * .15; ctx.stroke();
  ctx.restore();
}
// a painted stroke (branches, legs): a couple of jittered multiply lines
export function stroke(ctx, pts, col, a, w, seed) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = C(col, a * (k ? .55 : .8)); ctx.lineWidth = w * (k ? .6 : 1);
    pathPts(ctx, jit(pts, w * .25, seed, k), false); ctx.stroke();
  }
  ctx.restore();
}
// several painted strokes in one go: each pass is a single path, so it costs two draws in all
export function strokes(ctx, list, col, a, w, seed) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = C(col, a * (k ? .55 : .8)); ctx.lineWidth = w * (k ? .6 : 1); ctx.beginPath();
    list.forEach((pts, i) => { const q = jit(pts, w * .25, seed + i, k); ctx.moveTo(q[0][0], q[0][1]); for (let j = 1; j < q.length; j++) ctx.lineTo(q[j][0], q[j][1]); });
    ctx.stroke();
  }
  ctx.restore();
}
export function circP(x, y, r, n = 14, sq = 1) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r * sq]); } return p; }
export function ellP(x, y, rx, ry, rot = 0, n = 16) {
  const p = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = i / n * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; p.push([x + ex * c - ey * s, y + ex * s + ey * c]); }
  return p;
}
// wet-in-wet bloom: a cauliflower ring where a wet drop pushed pigment outward
export function bloom(ctx, x, y, r, col, a) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; const sd = (x * .13 + y * .71) | 0;
  pathPts(ctx, jit(circP(x, y, r, 22), r * .22, sd, 1)); ctx.clip();
  const g = ctx.createRadialGradient(x + r * .1, y - r * .1, 0, x, y, r);
  g.addColorStop(0, C(col, 0)); g.addColorStop(.55, C(col, a * .12)); g.addColorStop(.86, C(col, a * .55)); g.addColorStop(1, C(col, a * .15));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
export function softWash(ctx, x, y, rx, ry, col, a) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, C(col, a)); g.addColorStop(.6, C(col, a * .7)); g.addColorStop(1, C(col, 0));
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
}
// lifted paint: an opaque-ish paper fill, used for mist, highlights and to stop washes showing through
export function lift(ctx, pts, paper, a) { ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = C(paper, a); pathPts(ctx, pts); ctx.fill(); ctx.restore(); }
export function mist(ctx, y0, y1, w, paper, a) {
  ctx.save(); const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, C(paper, 0)); g.addColorStop(1, C(paper, a)); ctx.fillStyle = g; ctx.fillRect(0, y0, w, Math.max(y1 - y0, 0) + 2000); ctx.restore();  // holds its strength below y1, so no edge shows
}
export function paperBase(ctx, P, w, h) {
  ctx.fillStyle = C(P.paper); ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .85; ctx.drawImage(coldPress, 0, 0, w, h); ctx.restore();
}
export function paperFinish(ctx, w, h) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(finish, 0, 0, w, h); ctx.restore();
}

// Sprites. A drawing made only of multiply passes can be painted once onto white and then
// multiplied into the frame in one copy: scene x (1 - a + a x colour) is the same either way.
// Each sprite is kept by id and repainted when its key (palette, season, scale) changes;
// stale ones are repainted a few per frame so a palette shift never stalls a frame.
const sprites = new Map(), pool = [];
let frameNo = 0, budget = 0;
export function spriteFrame() {
  frameNo++; budget = 3;
  if (sprites.size > 140) for (const [id, s] of sprites) if (frameNo - s.used > 90) { sprites.delete(id); pool.push(s.c); }
}
export function sprite(id, key, x0, y0, x1, y1, px, draw, white = true) {
  let s = sprites.get(id);
  if (!s || (s.key !== key && budget-- > 0)) {
    const cw = Math.max(1, Math.ceil((x1 - x0) * px)), ch = Math.max(1, Math.ceil((y1 - y0) * px));
    const c = s?.c || pool.pop() || makeCanvas(cw, ch);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); } else x.clearRect(0, 0, cw, ch);
    x.setTransform(px, 0, 0, px, -x0 * px, -y0 * px);
    inSprite = white; draw(x); inSprite = false;
    s = { c, key, x0, y0, w: x1 - x0, h: y1 - y0, used: frameNo };  // drawn at its exact size so neighbouring strips never overlap
    sprites.set(id, s); stats.repaints++;
  }
  s.used = frameNo;
  return s;
}
export const spriteCount = () => sprites.size;
// Stamps are small things that move (birds, mice, berries): painted once onto clear paper and
// laid down with plain alpha, which phone GPUs draw far more cheaply than a multiply.
export const stamp = (id, key, x0, y0, x1, y1, px, draw) => sprite(id, key, x0, y0, x1, y1, px, draw, false);
export function put(ctx, s, alpha = 1) {
  if (alpha < 1) { const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h); ctx.globalAlpha = a; }
  else ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h);
}
export function blit(ctx, s) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(s.c, s.x0, s.y0, s.w, s.h); ctx.restore();
}
// Strips laid edge to edge (ground, hills) are snapped to whole device pixels. Two multiplies
// that each half-cover the pixel on their shared edge leave it lighter than either strip, which
// showed as a hairline of white paper between terrain sections. Translate and scale only.
export function blitStrip(ctx, s) {
  const m = ctx.getTransform(), x0 = Math.round(m.a * s.x0 + m.e), x1 = Math.round(m.a * (s.x0 + s.w) + m.e);
  const y0 = Math.round(m.d * s.y0 + m.f), y1 = Math.round(m.d * (s.y0 + s.h) + m.f);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(s.c, x0, y0, x1 - x0, y1 - y0); ctx.restore();
}
export { hash };
