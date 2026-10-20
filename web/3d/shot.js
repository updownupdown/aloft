// Pictures from the frame: where a world point lands on screen, and cutting part of the frame
// out once it is drawn. WebGL clears its picture once the frame is shown, so a cut is queued as
// a microtask from a system's scene(), which runs right after the renderer has drawn this frame.
import { norm, cross } from './util.js';

export const glCanvas = () => document.getElementById('game3');

// a world point on the canvas (canvas pixels), its depth, and how many pixels a metre is there
export function project(S, p, W, H) {
  if (!S?.cam) return null;
  const f = norm([S.look[0] - S.cam[0], S.look[1] - S.cam[1], S.look[2] - S.cam[2]]);
  const r = norm(cross(f, S.camUp || [0, 1, 0])), u = cross(r, f);
  const d = [p[0] - S.cam[0], p[1] - S.cam[1], p[2] - S.cam[2]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (z < .3) return null;
  const t = Math.tan(S.fov / 2), aspect = W / H;
  const nx = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * t * aspect), ny = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * t);
  return { x: (nx * .5 + .5) * W, y: (.5 - ny * .5) * H, z, px: H / 2 / (z * t) };
}

// after this frame is drawn, call fn(canvas) with the finished picture
const after = [];
export function afterDraw(fn) {
  if (!after.length) queueMicrotask(() => { const c = glCanvas(); for (const f of after.splice(0)) { try { f(c); } catch { /* a lost context */ } } });
  after.push(fn);
}

// a round portrait: a square of the frame round (cx, cy), fading out at its edge like a wash
// that ran dry, on a little round of paper
export function portrait(canvas, cx, cy, side, S = 120) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#f4eee1'; x.fillRect(0, 0, S, S);
  const m = document.createElement('canvas'); m.width = m.height = S;
  const mx = m.getContext('2d');
  mx.drawImage(canvas, cx - side / 2, cy - side / 2, side, side, 0, 0, S, S);
  mx.globalCompositeOperation = 'destination-in';
  const g = mx.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .5); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  mx.fillStyle = g; mx.fillRect(0, 0, S, S);
  x.drawImage(m, 0, 0);
  return c.toDataURL('image/jpeg', .7);
}
// a small copy of the whole frame, for the album
export function thumb(canvas, w = 320) {
  const h = Math.round(w * canvas.height / canvas.width), c = document.createElement('canvas');
  c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return c.toDataURL('image/jpeg', .6);
}
