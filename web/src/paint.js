// Watercolour toolkit, ported from the Wet Wash art direction demo.
// Every object is a polygon washed two or three times with slightly different wobbly
// edges in multiply blend, so paint pools where the passes overlap.
import { TAU, clamp, vnoise, hash, C, shade } from './util.js';

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Paper textures are generated at the view's size (on resize) so the grain never tiles or stretches.
export let coldPress = null, granule = null;
export function makePaper(w, h) {
  w = Math.ceil(w); h = Math.ceil(h);
  const c = makeCanvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  // cold-press paper: white with tooth, faint fibres and a few buckles
  for (let i = 0; i < w * h / 5000; i++) {
    const px = Math.random() * w, py = Math.random() * h, r = 40 + Math.random() * 120;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(160,140,110,.05)'); g.addColorStop(1, 'rgba(160,140,110,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const v = Math.random(); const k = v < .06 ? -14 : v > .97 ? 6 : (Math.random() - .5) * 7;
    a[i] = clamp(a[i] + k, 0, 255); a[i + 1] = clamp(a[i + 1] + k, 0, 255); a[i + 2] = clamp(a[i + 2] + k * .8, 0, 255);
  }
  x.putImageData(d, 0, 0);
  x.lineWidth = .4;
  for (let i = 0; i < w * h / 430; i++) {
    const px = Math.random() * w, py = Math.random() * h, an = Math.random() * TAU, l = 3 + Math.random() * 9;
    x.strokeStyle = `rgba(120,105,85,${.04 + Math.random() * .06})`;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); x.stroke();
  }
  coldPress = c;
  // granulation: pigment settling in the paper's tooth
  const gw = Math.ceil(w / 2), gh = Math.ceil(h / 2), c2 = makeCanvas(gw, gh), x2 = c2.getContext('2d'), d2 = x2.createImageData(gw, gh), a2 = d2.data;
  for (let i = 0; i < a2.length; i += 4) { const v = Math.random(); const k = v < .18 ? 205 + Math.random() * 30 : 255; a2[i] = a2[i + 1] = a2[i + 2] = k; a2[i + 3] = 255; }
  x2.putImageData(d2, 0, 0); granule = c2;
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
  const passes = o.passes || 3, amp = o.amp || 2.2, seed = o.seed || 1, rim = o.rim === undefined ? .5 : o.rim, base = o.base || 0;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (let p = 0; p < passes; p++) {
    ctx.fillStyle = C(col, a * (1.15 / passes) * (p === 0 ? 1.1 : .9));
    pathPts(ctx, jit(pts, amp * (p + 1) / passes, seed, p, base)); ctx.fill();
  }
  if (rim > 0) {
    ctx.strokeStyle = C(shade(col, .78), a * rim); ctx.lineWidth = o.rimW || 1.3; ctx.lineJoin = 'round';
    pathPts(ctx, jit(pts, amp * .6, seed, 9, base), o.closeRim !== false); ctx.stroke();
  }
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
  g.addColorStop(0, C(paper, 0)); g.addColorStop(1, C(paper, a)); ctx.fillStyle = g; ctx.fillRect(0, y0, w, y1 - y0); ctx.restore();
}
export function paperBase(ctx, P, w, h) {
  ctx.fillStyle = C(P.paper); ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .85; ctx.drawImage(coldPress, 0, 0, w, h); ctx.restore();
}
export function paperFinish(ctx, w, h, gran = .12) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = gran; ctx.drawImage(granule, 0, 0, w, h);
  ctx.globalAlpha = .5; ctx.drawImage(coldPress, 0, 0, w, h); ctx.restore();
}
export { hash };
