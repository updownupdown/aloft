// Painting the sky's rarer moods (see atmos.js for when they happen): the rainbow, golden-hour
// rays, meteors and the northern lights on the far sky; dawn fog lying in the hollows and moulted
// feathers in the world; the faint wind arrow that hints the way; and the dream while roosting.
// Each is a handful of fills, and only drawn while it shows.
import { TAU, clamp, lerp, hash, C, shade, mix } from './util.js';
import { lift, softWash, strokes, pathPts } from './paint.js';
import * as W from './world.js';
import { nightness, SKYFX } from './palette.js';

// where the sun or moon sits on the sky at arc position a (0 rising, 1 setting): as in render.js
export const skyPos = (a, w, h) => [w * (.08 + .84 * a), h * .7 - Math.sin(clamp(a, 0, 1) * Math.PI) * h * .58];

// the lit part of the moon for its phase (0 new, .5 full): the bright limb, then the terminator back
export function moonPoly(x, y, r, phase) {
  const t = Math.cos(TAU * phase), side = phase < .5 ? 1 : -1, p = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; p.push([x + side * Math.cos(a) * r, y + Math.sin(a) * r]); }
  for (let i = 12; i >= 0; i--) { const a = -Math.PI / 2 + i / 12 * Math.PI; p.push([x + side * Math.cos(a) * r * t, y + Math.sin(a) * r]); }
  return p;
}
export const moonLit = phase => (1 - Math.cos(TAU * phase)) / 2;

// the far sky, painted on the half-resolution back layer after the sun, moon and stars
export function skyFx(ctx, G, P, w, h) {
  const night = nightness(G.tod);
  // northern lights: tall curtains in green and violet, swaying slowly
  if (G.aurora > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    SKYFX.aurora.forEach((col, k) => {
      const top = [], bot = [];
      for (let i = 0; i <= 16; i++) {
        const x = i / 16 * w * 1.2 - w * .1, wave = Math.sin(i * .7 + G.t * .12 * (k + 1) + k * 2) * 14 + Math.sin(i * 1.9 - G.t * .2) * 6;
        top.push([x, h * (.06 + k * .05) + wave]); bot.push([x, h * (.34 + k * .04) + wave * .6]);
      }
      const g = ctx.createLinearGradient(0, h * .04, 0, h * .42);
      g.addColorStop(0, C(col, 0)); g.addColorStop(.55, C(col, G.aurora * (.42 - k * .1))); g.addColorStop(1, C(col, 0));
      ctx.fillStyle = g; pathPts(ctx, [...top, ...bot.reverse()]); ctx.fill();
    });
    ctx.restore();
  }
  // meteors: one every second or two, a pale streak falling across the stars
  if (G.meteors && night > .5) {
    const slot = Math.floor(G.t / 1.4), u = G.t / 1.4 - slot;
    if (hash(slot * 1.7) < .7 && u < .35) {
      const x = hash(slot * 3.3) * w, y = hash(slot * 5.1) * h * .3, l = 30 + hash(slot) * 30, k = u / .35;
      ctx.save(); ctx.strokeStyle = C(P.paper, night * (1 - k) * .9); ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x + k * l, y + k * l * .5); ctx.lineTo(x + k * l - 14, y + k * l * .5 - 7); ctx.stroke(); ctx.restore();
    }
  }
  const sunA = (G.tod - .25) / .5, [sx, sy] = skyPos(sunA, w, h);
  // a rainbow stands opposite the sun as a shower clears: pale paper beneath, thin bands of colour
  if (G.rainbowT > 0) {
    const k = Math.min(1, G.rainbowT / 6, (80 - G.rainbowT) / 4) * (1 - night) * (1 - G.overcast * .6);
    const cx = w - sx, cy = h * .92, R = h * .62;
    ctx.save(); ctx.lineCap = 'butt';
    ctx.strokeStyle = C(P.paper, .25 * k); ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, R - 7, Math.PI, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'multiply'; ctx.lineWidth = 2.6;
    SKYFX.rainbow.forEach((col, i) => { ctx.strokeStyle = C(col, .32 * k); ctx.beginPath(); ctx.arc(cx, cy, R - i * 2.4, Math.PI * 1.04, TAU * .98); ctx.stroke(); });
    ctx.restore();
  }
  // golden hour: bands of light fan from a low sun and turn slowly
  const golden = Math.max(clamp(1 - Math.abs(G.tod - .29) / .05, 0, 1), clamp(1 - Math.abs(G.tod - .7) / .05, 0, 1)) * (1 - G.overcast);
  if (golden > .02 && sunA > -.05 && sunA < 1.05) {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * .32 + Math.sin(G.t * .05 + i) * .06 + (sunA < .5 ? .35 : -.35), sp = .05 + hash(i * 2.7) * .04, L = w * .9;
      p.push([[sx, sy], [sx + Math.cos(a - sp) * L, sy + Math.sin(a - sp) * L], [sx + Math.cos(a + sp) * L, sy + Math.sin(a + sp) * L]]);
    }
    ctx.save(); ctx.fillStyle = C(mix(P.paper, P.sun, .25), golden * .14); ctx.beginPath();
    for (const q of p) { ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); }
    ctx.fill(); ctx.restore();
  }
}

// the fog's surface: a little above the land's average level nearby, so it pools in hollows and
// the ridges and treetops stand out of it
const fogTop = new Map();
function fogLevel(x) {
  let v = fogTop.get(x);
  if (v === undefined) {
    let s = 0; for (let k = -4; k <= 4; k++) s += W.groundY(x + k * 60);
    v = s / 9 - 16; if (fogTop.size > 400) fogTop.clear(); fogTop.set(x, v);
  }
  return v;
}
export function fogDepth(x, y) { return clamp((y - fogLevel(Math.round(x / 8) * 8)) / 20 + .5, 0, 1); }
// world space, after the land and trees: two veils of lifted paper
export function fog(ctx, G, P, x0, x1) {
  if (G.fog < .02) return;
  const top = [], bot = [];
  for (let x = Math.floor(x0 / 8) * 8; x <= x1 + 8; x += 8) {
    const g = W.groundY(x), f = fogLevel(x) + Math.sin(x / 70 + G.t * .15) * 3;
    top.push([x, Math.min(g, f)]); bot.push([x, g + 40]);
  }
  ctx.save();
  const g = ctx.createLinearGradient(0, Math.min(...top.map(p => p[1])) - 10, 0, Math.max(...bot.map(p => p[1])));
  g.addColorStop(0, C(P.paper, 0)); g.addColorStop(.15, C(P.paper, G.fog * .55)); g.addColorStop(1, C(P.paper, G.fog * .8));
  ctx.fillStyle = g; pathPts(ctx, [...top.map(p => [p[0], p[1] - 10]), ...bot.reverse()]); ctx.fill();
  ctx.restore();
}
// moulted feathers lying where they fell: a quill and a soft vane each
export function molted(ctx, G, P, x0, x1) {
  const list = G.molted.filter(f => f.x > x0 && f.x < x1);
  if (!list.length) return;
  strokes(ctx, list.map(f => [[f.x - Math.cos(f.a) * 4, f.y - 1 - Math.abs(Math.sin(f.a)) * 1.5], [f.x, f.y - .6], [f.x + Math.cos(f.a) * 4, f.y - .3]]), P.tail || shade(P.ground, .8), .55, 1.6, 7);
}
// screen space, over everything: the faint wind arrow that hints the way
export function whisper(ctx, G, P, w, h) {
  if (G.whisper < .03) return;
  const dir = G.goal === 'south' ? 1 : -1, y = h * .2, drift = (G.t * 18) % 60, list = [];
  for (let i = 0; i < 3; i++) {
    const x = w * .5 + dir * (drift - 30 + i * 22) - dir * 30, yy = y + i * 5 - 5;
    list.push([[x - dir * 26, yy + 2], [x - dir * 10, yy - 2], [x + dir * 6, yy]]);
  }
  const hx = w * .5 + dir * (drift + 26);
  list.push([[hx - dir * 8, y - 8], [hx, y], [hx - dir * 8, y + 7]]);
  strokes(ctx, list, shade(P.sky, .65), G.whisper * .35 * (1 - nightness(G.tod) * .5), 1.4, 11);
}
// the dream: the day's flight replayed as drifting washes over the dark (k 0..1 through it)
export function dream(ctx, G, P, w, h, k, a) {
  const D = G.dream; if (D.length < 4 || a <= 0) return;
  let lo = Infinity, hi = -Infinity, top = 1;
  for (const [x, ht] of D) { lo = Math.min(lo, x); hi = Math.max(hi, x); top = Math.max(top, ht); }
  const span = Math.max(hi - lo, 1), n = Math.max(2, Math.floor(D.length * k));
  const at = i => [w * .12 + (D[i][0] - lo) / span * w * .76, h * .78 - D[i][1] / top * h * .55];
  const pts = []; for (let i = 0; i < n; i++) pts.push(at(i));
  const cols = [P.sky, P.leaf, P.sun, P.water];
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = Math.max(0, n - 12); i < n; i += 3) { const [x, y] = pts[i]; const c = cols[i % 4]; const g = ctx.createRadialGradient(x, y, 0, x, y, 40); g.addColorStop(0, C(c, .22 * a)); g.addColorStop(1, C(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - 40, y - 40, 80, 80); }
  ctx.strokeStyle = C(mix(P.paper, P.sun, .3), .35 * a); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + Math.sin(G.t + i * .3) * 2) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  const [hx, hy] = pts[n - 1]; ctx.fillStyle = C(P.paper, .5 * a); ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}
