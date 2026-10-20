// Simple graphics styles: the same world drawn with flat shapes and almost no blending, for
// smooth frames and a cool phone. Shapes are gathered by colour into one path each and filled
// once, so a frame is a few dozen opaque fills: no textures, no sprites, no multiply passes.
// Night and weather are baked into the colours instead of laid over the frame.
//   cut     Paper cut: flat layers of coloured paper, each casting a small shadow
//   ink     Pen and ink: outlines and hatching on bare paper, a few spots of colour
//   pixel   Pixel: the paper cut drawn into a canvas ~216 pixels tall, scaled up crisp
//   shadow  Shadow play: a bright sky behind dark silhouettes, the fewest colours of all
import { TAU, clamp, lerp, hash, vnoise, fbm, C, shade, mix } from './util.js';
import * as W from './world.js';
import { nightness } from './palette.js';
import { GFX } from './gfx.js';
import { mousePos, fishPos } from './life.js';
import { keepsakesIn } from './story.js';
import { moonPoly } from './skyfx.js';
import { wingGeo, focusMark, stamina, particles, rain } from './render.js';

export const STYLES = [['wash', 'Watercolour'], ['cut', 'Paper cut'], ['ink', 'Pen and ink'], ['pixel', 'Pixel'], ['shadow', 'Shadow play']];
export const PIXEL_ROWS = 180;
const BS = 1.25, OWL = 6, NB = [112, 122, 178];

let S = 'cut', K = null, lw = 1, ink = null;   // style, colours this frame, ink line width (world units)
const mul = (base, c, a) => [base[0] * (1 - a + a * c[0] / 255), base[1] * (1 - a + a * c[1] / 255), base[2] * (1 - a + a * c[2] / 255)];

// Every role's colour as watercolour over paper would show it (paint at strength a), then
// turned into the style's own colour.
function colours(G, P) {
  const p = P.paper, w = (c, a) => mul(p, c, a);
  const near = w(P.near, .72), water = w(P.water, .55), mid = mix(p, P.mid, .62);
  const health = G.bird.health ?? .85, tail = G.bird.adult ? mix(mix(P.tail, P.birdPale, .5), P.tail, health) : mix(mix(P.bird, P.birdPale, .3), P.tail, .25 * health);
  const k = {
    skyTop: P.sky, sky2: P.sky2, horizon: mix(P.horizon, p, .3), sun: P.sun, moon: [230, 232, 236], star: p,
    cloud: mix(p, P.sky, .1), cloudSh: mix(p, P.cloudShade, .45),
    far: mix(p, mix(P.far, P.sky, .35), .5), mid, midTree: mul(mid, P.pine, .45), near, deep: mul(near, P.ground, .32), snow: p,
    water, ice: w(mix(P.water, p, .55), .4), fish: mul(water, shade(P.water, .55), .5),
    trunk: w(P.trunk, .8), birch: w(mix(p, P.trunk, .28), .8), bare: w(P.trunk, .45),
    leaf: w(P.leaf, .7), leafHi: w(P.leafHi, .65), leafDk: w(P.leafDk, .75), pine: w(P.pine, .75), pineDk: w(P.pineDk, .82), blossom: P.blossom,
    berry: w(P.berry, .9), worm: w(P.worm, .95), mouse: w(mix(P.ground, [120, 110, 100], .5), .85), stone: w(mix(mix(P.far, p, .25), P.ground, .4), .6),
    chick: [200, 190, 175], egg: [236, 228, 210], glint: P.ring,
    ring: mix(p, P.ring, .15), ringEdge: w(P.cloudShade, .7), leafT: w(mix(P.leafDk, P.leafHi, .35), .8),
    bird: w(P.bird, .85), birdWing: w(P.birdWing, .85), dark: w(P.birdFar, .62), pale: w(P.birdPale, .5), under: w(mix(P.birdPale, P.bird, .35), .55),
    tail: w(tail, .78), beak: w(P.beak, .9), eye: P.birdFar, crow: w(P.crow, .8), flock: w(P.birdFar, .55), glide: P.birdFar,
  };
  if (S === 'shadow') {
    // the land and everything on it in one dark, a little lifted toward the sky with distance
    const D = shade(mix(P.near, P.birdFar, .6), .42), low = mix(P.horizon, P.sky2, .3);
    for (const n in k) if (!['skyTop', 'sky2', 'horizon', 'sun', 'moon', 'star', 'cloud', 'cloudSh'].includes(n)) k[n] = D;
    Object.assign(k, {
      skyTop: shade(P.sky, .85), horizon: mix(P.horizon, P.sun, .35), sun: mix(P.sun, p, .4), cloud: mix(low, p, .45), cloudSh: mix(low, P.sky, .3),
      far: mix(low, D, .3), mid: mix(low, D, .58), midTree: mix(low, D, .66), deep: shade(D, .9), water: mix(low, D, .25), ice: mix(low, p, .3), fish: mix(low, D, .5),
      snow: mix(D, p, .35), berry: shade(P.berry, .75), tail: shade(P.tail, .6), beak: shade(P.beak, .55), ring: mix(p, P.sun, .3), ringEdge: mix(p, P.sun, .6),
      leafT: mix(low, D, .45), glint: mix(p, P.sun, .5), glide: mix(p, P.sun, .4), egg: [236, 228, 210], blossom: shade(P.blossom, .6),
      eye: mix(p, P.sun, .4),
    });
  }
  if (S === 'ink') {
    // bare paper with the faintest tints; colour only where it tells you something
    const keep = { berry: .8, tail: .6, beak: .7, worm: .7, water: .3, ice: .2, sun: .5, glint: .9, dark: .7, eye: 1, ring: 0, egg: 0, blossom: .5, bird: .45, birdWing: .5, under: .12, crow: .7, flock: .6, mouse: .35 };
    for (const n in k) if (!['skyTop', 'sky2', 'horizon', 'moon', 'star', 'glide'].includes(n)) k[n] = n in keep ? w(n === 'water' || n === 'ice' ? P.water : n === 'dark' || n === 'eye' ? P.birdFar : n === 'glint' ? P.ring : n === 'egg' ? [236, 228, 210] : n === 'tail' ? tail : P[n] || p, keep[n]) : mix(p, k[n], .14);
    ink = mix(P.birdFar, p, .08);
  }
  if (S === 'pixel') for (const n in k) k[n] = k[n].map(v => Math.round(v / 17) * 17);   // a short palette
  // night: what the watercolour lays over the frame as a blue multiply, here mixed into each colour
  const night = nightness(G.tod) * (G.brightT > 0 ? .35 : 1) * (G.learned.has(OWL) ? .6 : 1) * .6, out = {};
  for (const n in k) out[n] = C(night > 0 ? mul(k[n], NB, night) : k[n]);
  out._ink = ink && C(night > 0 ? mul(ink, NB, night * .5) : ink);
  out._inkFar = ink && C(mix(night > 0 ? mul(ink, NB, night * .5) : ink, P.paper, .55));
  return out;
}
const raw = new Map();
function col(r) {
  if (typeof r === 'string') return K[r];
  const key = r.join();
  if (!raw.has(key)) raw.set(key, C(S === 'shadow' ? shade(mix(r, [40, 36, 40], .7), .8) : S === 'ink' ? mix(K.__p, r, .7) : r));
  return raw.get(key);
}

// One path per colour, filled in the order the colours first appear; lines after fills.
class Batch {
  constructor(shadow) { this.f = new Map(); this.l = new Map(); this.shadow = shadow; }
  path(r) { let p = this.f.get(r); if (!p) this.f.set(r, p = new Path2D()); return p; }
  poly(r, pts) { const p = this.path(r); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); }
  ell(r, x, y, rx, ry, rot = 0) { const p = this.path(r); p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); p.ellipse(x, y, rx, ry, rot, 0, TAU); p.closePath(); }
  line(r, pts, w) {
    const k = r + '|' + w; let p = this.l.get(k); if (!p) this.l.set(k, p = new Path2D());
    p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  }
  flush(ctx) {
    if (this.shadow && S === 'cut') {
      // cut paper lifts off the page: every layer casts one soft-edged shadow down and right
      ctx.save(); ctx.translate(.9, 1.3); ctx.fillStyle = 'rgba(40,30,24,.16)';
      for (const p of this.f.values()) ctx.fill(p);
      ctx.restore();
    }
    for (const [r, p] of this.f) fillPath(ctx, r, p);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [k, p] of this.l) {
      const i = k.lastIndexOf('|'), r = k.slice(0, i), w = +k.slice(i + 1);
      ctx.strokeStyle = S === 'ink' ? K._ink : K[r]; ctx.lineWidth = S === 'ink' ? Math.max(lw, w * .55) : w; ctx.stroke(p);
    }
    this.f.clear(); this.l.clear();
  }
}
// In ink the outline goes down first at twice the width and the fill covers its inner half, so
// shapes of one colour that overlap (puffs of a cloud, blobs of a crown) share one outline.
function fillPath(ctx, r, p, w = lw) {
  if (S === 'ink' && r !== 'snow' && r !== 'star') { ctx.strokeStyle = r === 'far' || r === 'cloud' ? K._inkFar : K._ink; ctx.lineWidth = w * 2; ctx.lineJoin = 'round'; ctx.stroke(p); }
  ctx.fillStyle = col(r); ctx.fill(p);
}

export function renderSimple(ctx, G, style) {
  S = style === 'pixel' ? 'pixel' : style; const P = G.P, { w, h } = G.view, cam = G.cam, scr = G.view.scr;
  K = colours(G, P); K.__p = P.paper; raw.clear();
  ctx.imageSmoothingEnabled = S !== 'pixel';
  // screen space: sky, sun and moon, clouds, far and mid hills
  ctx.save(); ctx.scale(w / scr.w, h / scr.h);
  lw = 1.15 / scr.s;
  sky(ctx, G, P, scr.w, scr.h);
  hills(ctx, G, scr.w, scr.h);
  ctx.restore();

  ctx.save(); ctx.translate(-cam.x, -cam.y);
  lw = 1.15 / G.view.s;
  const x0 = cam.x - 40, x1 = cam.x + w + 40, B = new Batch(true), top = cam.y - 20, bot = cam.y + h + 40;
  if (GFX.thermals) for (const t of W.thermalsIn(x0 - 60, x1 + 60)) thermal(ctx, t, G);
  const rings = G.visibleRings;
  ringHalves(ctx, rings, G, 0);
  // the land, the water in its hollows
  const step = S === 'pixel' ? 6 : 4, gt = [];
  for (let x = Math.floor(x0 / step) * step; x <= x1 + step; x += step) gt.push([x, W.groundY(x)]);
  B.poly('near', [[gt[0][0], bot + 40], ...gt, [gt[gt.length - 1][0], bot + 40]]);
  B.poly('deep', [[gt[0][0], bot + 40], ...gt.map(p => [p[0], p[1] + 22 + 8 * vnoise(p[0] / 40, 8)]), [gt[gt.length - 1][0], bot + 40]]);
  if (G.sea.winter > .3) B.poly('snow', [...gt.map(p => [p[0], p[1] - .5]), ...gt.slice().reverse().map(p => [p[0], p[1] + 2 + 6 * G.sea.winter])]);
  for (const p of W.pondsIn(x0, x1)) pond(B, p, G);
  B.flush(ctx);
  if (S === 'ink') hatch(ctx, gt, G);
  for (const l of W.landmarksIn(x0 - 120, x1 + 120)) landmark(B, l, G);
  const trees = W.treesIn(x0 - 40, x1 + 40);
  for (const t of trees) tree(B, t, G);
  B.flush(ctx);
  const leaves = G.sea.winter < .5;
  for (const b of W.bushesIn(x0, x1)) {
    const { x, y, r } = b, bare = !b.hardy && !leaves;
    B.ell(bare ? 'bare' : 'leafDk', x, y - r * .55, r * 1.25, r * .75);
    if (!bare) B.ell('leaf', x - r * .3, y - r * .75, r * .7, r * .45);
    for (const be of b.berries) if (G.berryOk(b, be)) B.ell('berry', be.x, be.y, 1.8, 1.8);
  }
  if (G.nest) nest(B, G.nest, G);
  if (G.wormsOk()) for (const wm of W.wormsIn(x0, x1)) if (!G.eaten.has(wm.id + G.rainId)) {
    const ph = G.t * 3 + wm.seed, pts = []; for (let k = 0; k <= 4; k++) { const u = k / 4; pts.push([wm.x + Math.sin(ph + u * 4) * 1.6 * u, wm.y + 1 - u * 5.5]); }
    B.line('worm', pts, 1.6);
  }
  for (const tw of W.twigsIn(x0, x1)) if (!G.twigGone(tw.id)) { const c = Math.cos(tw.a) * 5, s = Math.sin(tw.a) * 5; B.line('trunk', [[tw.x - c, tw.y - s], [tw.x + c, tw.y + s]], 1.1); }
  for (const k of keepsakesIn(x0, x1)) if (!G.kept.has(k.id)) B.ell('glint', k.x, W.groundY(k.x) - 1.2, 1.6 + .5 * Math.sin(G.t * 3), 1.6);
  const bk = G.bird;
  for (const m of W.miceIn(x0, x1)) if (!G.eaten.has(m.id + ':' + G.day)) {
    const q = mousePos(m, G.t); if (bk.kiteT > .3 && Math.abs(m.x - bk.x) < 140) q.show = Math.max(q.show, .9);
    if (q.show < .35) continue;
    const y = q.y + 1 - 2.2 * q.show - Math.abs(Math.sin(G.t * 14 + m.seed)) * .6 * q.run;
    B.ell('mouse', q.x, y, 3, 1.8); B.ell('mouse', q.x + 2.6 * q.dir, y - .3, 1.4, 1.4); B.line('mouse', [[q.x - 2.5 * q.dir, y + .5], [q.x - 7 * q.dir, y + .2]], .5);
  }
  for (const t of trees) if (t.song?.active) { const p = t.song.perch; songbird(B, p.x, p.y - 3.4, t.song.sp, t.song.singingT > 0, p.x < t.x ? -1 : 1, G); }
  const v = G.visitor;
  if (v) { if (!v.flying) songbird(B, v.x, v.y, v.sp, v.singT > 0, v.perch && v.perch.x < bk.x ? 1 : -1, G); else smallBird(B, v.x, v.y, v.dir, G.t * 24, v.sp.cols.body, 1.3); }
  for (const o of G.boids) smallBird(B, o.x, o.y, o.vx < 0 ? -1 : 1, o.ph, o.col, 1.3);
  for (const c of G.crows) smallBird(B, c.x, c.y, c.vxs < 0 ? -1 : 1, c.ph, 'crow', 2.2);
  B.flush(ctx);
  if (G.glide) glideLine(ctx, G.glide, G);
  for (const hk of G.hawks) hawk(ctx, hk, G, hk.scale || 1);
  hawk(ctx, bk, G, 1);
  if (G.carry) { const x = bk.x - bk.face, y = bk.y + (bk.state === 'fly' ? 5.5 : 4); if (G.carry === 'twig') B.line('trunk', [[x - 5, y], [x + 5, y + 1]], 1.1); else B.ell(G.carry === 'fish' ? 'fish' : 'mouse', x, y, 3, 1.6, .3); B.flush(ctx); }
  stamina(ctx, bk, P);
  if (G.focus) focusMark(ctx, G.focus, P, G);
  else if (bk.target && bk.state === 'fly') focusMark(ctx, { kind: 'perch', x: bk.target.x, y: bk.target.y - 3 }, P, G);
  ringHalves(ctx, rings, G, 1);
  particles(ctx, G, P);
  ctx.restore();

  ctx.save(); ctx.scale(w / scr.w, h / scr.h);
  if (GFX.weather) rain(ctx, G, P, scr.w, scr.h);
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = C([255, 255, 250], G.flash * .55); ctx.fillRect(0, 0, w, h); }
}

/* ---------- sky and hills ---------- */
// the sky gradient is a 1-pixel-wide canvas stretched over the screen: one copy a frame
let skyC = null, skyKey = '';
function sky(ctx, G, P, w, h) {
  if (S === 'ink') { ctx.fillStyle = K.cloud; ctx.fillRect(0, 0, w, h); }
  else {
    const key = K.skyTop + K.sky2 + K.horizon + G.overcast.toFixed(2);
    if (key !== skyKey) {
      skyKey = key; skyC ??= document.createElement('canvas'); skyC.width = 1; skyC.height = 64;
      const x = skyC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, K.skyTop); g.addColorStop(.45, K.sky2); g.addColorStop(.8, K.horizon); g.addColorStop(1, K.horizon);
      x.fillStyle = g; x.fillRect(0, 0, 1, 64);
    }
    ctx.drawImage(skyC, 0, 0, w, h);
  }
  const night = nightness(G.tod), vis = 1 - G.overcast * .8;
  if (night > .05 && G.overcast < .7) {
    ctx.fillStyle = K.star; ctx.globalAlpha = night * (1 - G.overcast); ctx.beginPath();
    for (let i = 0; i < 70; i++) { const tw = Math.sin(G.t * 1.5 + i) > -.3, x = hash(i * 3.7) * w, y = hash(i * 9.1) * h * .55, r = tw ? .9 : .5; ctx.rect(x - r / 2, y - r / 2, r, r); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
  const body = (a, r, c, phase) => {
    if (a < -.05 || a > 1.05 || vis < .2) return;
    const x = w * (.08 + .84 * a), y = h * .7 - Math.sin(clamp(a, 0, 1) * Math.PI) * h * .58, p = new Path2D();
    if (phase === undefined) p.arc(x, y, S === 'shadow' ? r * 1.8 : r, 0, TAU);
    else { const m = moonPoly(x, y, r, phase); p.moveTo(m[0][0], m[0][1]); for (const q of m) p.lineTo(q[0], q[1]); p.closePath(); }
    fillPath(ctx, c, p);
  };
  body((G.tod - .25) / .5, 15, 'sun');
  if (night > .2) body(((G.tod + .25) % 1) / .5, 10, 'moon', G.moonPhase ?? .5);
  if (!GFX.clouds) return;
  // flat clouds: a belly and a few puffs, all clouds in two fills
  const base = G.camC.x * .06 + G.cloudDrift, cell = 120, i0 = Math.floor((base - 160) / cell), cover = .3 + G.overcast * .65;
  const lift0 = G.camGround - G.camC.y, puff = new Path2D(), belly = new Path2D();
  for (let i = i0; i < i0 + Math.ceil(w / cell) + 4; i++) {
    if (hash(i * 3.3) > cover) continue;
    const cx = i * cell + hash(i * 1.9) * 60 - base, cy = 18 + hash(i * 4.1) * h * .22 + (lift0 - h * .32) * .05, cw = 40 + hash(i * 8.2) * 60 + G.overcast * 40, n = 4 + (i & 1);
    belly.moveTo(cx, cy + cw * .05); belly.ellipse(cx + cw * .5, cy + cw * .05, cw * .62, cw * .09, 0, 0, TAU);
    for (let j = 0; j < n; j++) {
      const u = j / (n - 1), r = cw * (.15 + .13 * Math.sin(u * Math.PI)) * (.8 + .4 * hash(i * 3 + j)), x = cx + u * cw, y = cy - Math.sin(u * Math.PI) * cw * .07;
      puff.moveTo(x + r, y); puff.arc(x, y, r, 0, TAU);
    }
  }
  fillPath(ctx, 'cloudSh', belly); fillPath(ctx, 'cloud', puff);
}

// the watercolour's far and mid hill outlines, slid with the same parallax
const FAR = x => -58 * Math.pow(vnoise(x / 170, 9), 1.4) - 14 * vnoise(x / 48, 10) + 5 * vnoise(x / 13, 11);
const MID = x => 24 * fbm(x / 300, 5);
function hills(ctx, G, sw, sh) {
  const hz = 1 + (G.view.z - 1) * .45, hw = sw * hz, hh = sh * hz, k = 1 / hz;
  const cx = G.camC.x, l0 = G.camGround - G.camC.y - hh * .32;
  const layer = (fn, base, oy, stepN, role, trees) => {
    const p = new Path2D(), st = stepN, i0 = Math.floor(base / st) - 1, i1 = Math.ceil((base + hw) / st) + 1, bottom = sh + 10;
    p.moveTo((i0 * st - base) * k, bottom);
    for (let i = i0; i <= i1; i++) p.lineTo((i * st - base) * k, (fn(i * st) + oy) * k);
    p.lineTo((i1 * st - base) * k, bottom); p.closePath();
    if (trees) {
      // the little trees along the mid hills: one triangle each, in a fill of their own
      const t = new Path2D(), cell = 11;
      for (let i = Math.floor(base / cell); i <= Math.ceil((base + hw) / cell); i++) {
        if (hash(i * 1.37 + 500) > .5) continue;
        const x = i * cell + hash(i * 2.91) * cell * .6, y = fn(x) + 1, s = (.45 + .2 * hash(i * 5.3)) * (hash(i * 7.7) < .5 ? 1 : .8);
        if (Math.abs(fn(x + 5) - fn(x - 5)) > 8) continue;
        const X = (x - base) * k, Y = (y + oy) * k, s2 = s * k;
        t.moveTo(X - 7 * s2, Y); t.lineTo(X, Y - 30 * s2); t.lineTo(X + 7 * s2, Y); t.closePath();
      }
      fillPath(ctx, role, p); fillPath(ctx, 'midTree', t); return;
    }
    fillPath(ctx, role, p);
  };
  if (GFX.hills) layer(FAR, cx * .12 - hw / 2, hh * .6 + l0 * .1, S === 'pixel' ? 12 : 8, 'far');
  layer(MID, cx * .4 - hw / 2, hh * .7 + l0 * .28, S === 'pixel' ? 10 : 6, 'mid', true);
}

/* ---------- the world ---------- */
function hatch(ctx, gt, G) {
  // ink hatching just under the grass line, denser on the slopes
  const p = new Path2D();
  for (let i = 0; i < gt.length - 1; i++) {
    const [x, y] = gt[i];
    if (W.waterAt(x) !== null) continue;
    const n = 1 + (Math.abs(gt[i + 1][1] - y) > 1.5 ? 1 : 0);
    for (let j = 0; j < n; j++) { const xx = x + j * 2, l = 3 + 3 * hash(i * 1.7 + j); p.moveTo(xx, y + 2.5); p.lineTo(xx - l * .5, y + 2.5 + l); }
    if (hash(i * 3.17) < .4) { p.moveTo(x, y + .5); p.lineTo(x + .8, y - 2.5 - 2 * hash(i)); }
  }
  ctx.strokeStyle = K._ink; ctx.lineWidth = lw * .8; ctx.stroke(p);
}

function pond(B, p, G) {
  const pts = [];
  for (let x = p.x0; x <= p.x1; x += 2) pts.push([x, W.groundY(x)]);
  B.poly(W.frozen(p) ? 'ice' : 'water', [[p.x0 - 1, p.waterY], [p.x1 + 1, p.waterY], ...pts.reverse()]);
  if (W.frozen(p)) return;
  for (const f of p.fish) if (!G.eaten.has(f.id + ':' + G.day)) {
    const q = fishPos(f, p, G.t);
    B.poly('fish', [[q.x + 3.5 * q.dir, q.y], [q.x, q.y - 1.3], [q.x - 4 * q.dir, q.y], [q.x - 6 * q.dir, q.y - 1.6], [q.x - 6 * q.dir, q.y + 1.6], [q.x - 4 * q.dir, q.y], [q.x, q.y + 1.3]]);
  }
  // a couple of lines of light on the water
  for (let k = 0; k < 2; k++) {
    const y = p.waterY + 2.5 + k * 3.5, xa = lerp(p.x0, p.x1, .15 + .2 * hash(p.k + k)) + Math.sin(G.t * .8 + k) * 2, len = (p.x1 - p.x0) * (.25 - k * .06);
    if (W.groundY(Math.round(xa)) < y + 1 || W.groundY(Math.round(xa + len)) < y + 1) continue;
    B.line(S === 'shadow' ? 'ring' : 'snow', [[xa, y], [xa + len, y]], .9);
  }
}

const treeBlobs = (R, cy) => [[0, cy, R], [-R * .8, cy + R * .35, R * .72], [R * .85, cy + R * .3, R * .75], [-R * .3, cy - R * .7, R * .66], [R * .45, cy - R * .55, R * .6]];
function tree(B, t, G) {
  const h = t.h, sd = t.seed, sw = Math.sin(G.t * 1.3 + sd * 1.7) * (1.2 + Math.abs(G.wind) * .05);
  const leaves = t.ever || G.sea.winter < .55, ca = Math.cos(t.lean), sa = Math.sin(t.lean);
  // local tree space (y up the trunk) to world, with the crown swayed by a skew
  const T = (x, y, sway = 1) => { x -= sw / h * y * sway; return [t.x + x * ca - y * sa, t.y + x * sa + y * ca]; };
  const poly = (r, pts, sway) => B.poly(r, pts.map(([x, y]) => T(x, y, sway)));
  const ell = (r, x, y, rx, ry) => { const [X, Y] = T(x, y); B.ell(r, X, Y, rx, ry, t.lean); };
  const tw = Math.max(2, h * .035), trunk = (w0, w1, top, r = 'trunk', bend = 0) => poly(r, [[-w0, 1], [bend - w1, -h * top], [bend + w1, -h * top], [w0, 1]], .5);
  const snow = G.sea.winter > .4;
  if (t.type === 0) {
    trunk(tw * 1.3, tw * .45, .82);
    for (let k = 0; k < 5; k++) {
      const yb = -h * (.16 + k * .16), yt = yb - h * .3, hw = h * .3 * (1 - k / 5.6);
      poly(k % 2 ? 'pine' : 'pineDk', [[-hw, yb], [0, yt], [hw, yb]]);
      if (snow) poly('snow', [[-hw * .8, yb - h * .03], [0, yt + 1], [hw * .8, yb - h * .03], [0, yb - h * .08]]);
    }
  } else if (t.type === 5) {
    const bend = (hash(sd * 3) - .5) * h * .08;
    trunk(Math.max(2, h * .03) * 1.3, Math.max(2, h * .03) * .5, .8, 'trunk', bend);
    [[-h * .1, -h * .78, h * .3], [h * .14, -h * .9, h * .26], [-h * .02, -h * .99, h * .17]].forEach(([x, y, rx], i) => { ell(i % 2 ? 'pine' : 'pineDk', x, y, rx, rx * .26); if (snow) ell('snow', x, y - rx * .2, rx * .8, rx * .1); });
  } else if (t.type === 2) {
    trunk(Math.max(1.5, h * .022) * 1.2, Math.max(1.5, h * .022) * .4, .9, 'birch');
    if (leaves) for (let i = 0; i < 7; i++) ell(i % 3 ? 'leafHi' : 'leaf', (hash(sd * 5 + i) - .5) * h * .4, -h * (.62 + .32 * hash(sd * 7 + i)), h * (.07 + .04 * hash(sd + i * 11)), h * (.07 + .04 * hash(sd + i * 11)));
  } else if (t.type === 3) {
    const R = h * .46, cy = -h * .8;
    trunk(Math.max(2.2, h * .045) * 1.5, Math.max(2.2, h * .045) * .6, .58);
    if (leaves) {
      ell('leaf', 0, cy + h * .02, R * 1.05, h * .17);
      const cur = [[-R * 1.05, cy + h * .02]];
      for (let i = 0; i <= 8; i++) { const u = i / 8 - .5; cur.push([u * R * 2.25, cy + h * (.42 + .1 * hash(sd + i)) * (1 - Math.abs(u) * .6)]); }
      cur.push([R * 1.05, cy + h * .02]); poly('leafDk', cur);
    }
  } else if (t.type === 4) {
    trunk(tw, tw * .4, .6);
    if (leaves) { ell('leafDk', 0, -h * .62, h * .15, h * .38); ell('leaf', -h * .03, -h * .72, h * .09, h * .24); }
  } else {
    trunk(tw * 1.3, tw * .45, .82);
    const R = h * .2, cy = -h * .78;
    if (leaves) {
      treeBlobs(R, cy).forEach(([x, y, r], i) => ell(i > 2 ? 'leafHi' : 'leaf', x, y, r, r));
      if (t.type === 1 && G.sea.spring > .4) for (let i = 0; i < 3; i++) { const [x, y, r] = treeBlobs(R, cy)[i + 1]; ell('blossom', x, y - r * .2, r * .45, r * .45); }
      if (snow) ell('snow', 0, cy - R * .9, R * .9, R * .25);
    } else for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (hash(sd * 3 + i) - .5) * 2.2, l = R * (1.1 + .5 * hash(sd + i * 7)), y0 = -h * .7;
      B.line('trunk', [T(0, y0), T(Math.cos(a) * l, y0 + Math.sin(a) * l)], 1.2);
    }
  }
  // the perches, drawn over the crown so they read as places to land
  for (const b of t.branches) {
    B.line('trunk', [T(0, b.y0 + 2, 0), T(b.x1 * .5, b.y0 + (b.y1 - b.y0) * .45, 0), T(b.x1, b.y1, 0)], 2.4);
    if (leaves) ell(t.ever ? 'pine' : 'leaf', b.x1 + b.side * 1.5, b.y1 - 2.5, 3.6, 3.2);
  }
}

function landmark(B, l, G) {
  const { x, y, h } = l;
  if (l.type === 'oak') {
    const cy = y - h + 72, R = 62;
    B.poly('trunk', [[x - 16, y + 4], [x - 7, y - h * .55], [x + 7, y - h * .55], [x + 16, y + 4]]);
    for (const [px, py] of [[-58, -128], [64, -112]]) B.line('trunk', [[x, y - h * .4], [x + px * .5, y + py + 8], [x + px, y + py + 1]], 4);
    if (G.sea.winter < .55) for (const [dx, dy, r, c] of [[-R * .75, 18, .55, 'leafDk'], [R * .78, 22, .55, 'leafDk'], [0, 0, .82, 'leaf'], [-R * .35, -28, .5, 'leafHi'], [R * .3, -36, .55, 'leaf']]) B.ell(c, x + dx, cy + dy, R * r * 1.15, R * r);
    else for (const a of [-2.4, -1.9, -1.2, -.7]) B.line('trunk', [[x, y - h * .5], [x + Math.cos(a) * R, cy + Math.sin(a) * R * .9]], 2.4);
  } else if (l.type === 'tower') {
    B.poly('stone', [[x - 16, y + 4], [x - 16, y - h], [x + 2, y - h], [x + 4, y - h + 6], [x + 16, y - h + 6], [x + 16, y + 4]]);
    B.poly('dark', [[x - 3, y - h * .62], [x - 3, y - h * .74], [x + 3, y - h * .74], [x + 3, y - h * .62]]);
  } else if (l.type === 'falls') {
    B.poly('stone', [[x - 34, y + 4], [x - 30, y - h * .7], [x - 22, y - h + 2], [x - 4, y - h + 6], [x + 14, y - h * .55], [x + 26, y + 4]]);
    B.poly('water', [[x - 4, y - h + 8], [x + 6, y - h + 10], [x + 9, y], [x - 3, y]]);
    B.ell('water', x + 3, y + 1, 16, 3);
  } else {
    for (const [dx, hh, ww] of [[0, 44, 7], [-26, 30, 5.5], [24, 34, 6]]) B.poly('stone', [[x + dx - ww, y + 3], [x + dx - ww * .9, y - hh + 2], [x + dx, y - hh], [x + dx + ww * .9, y - hh + 2], [x + dx + ww, y + 3]]);
  }
}

function nest(B, n, G) {
  const { x, y } = n, k = Math.min(1, n.twigs / 5);
  if (n.eggAt !== undefined && !n.chick && !n.fledged) B.ell('egg', x + 1, y - 2.5, 2, 2.6, .2);
  if (n.chick) { const bob = Math.sin(G.t * 5) * .6; B.ell('chick', x, y - 3.5 + bob, 3, 3); B.ell('chick', x + 1.6, y - 7 + bob, 2, 2); }
  B.poly('trunk', [[x - 6 * (.5 + .5 * k), y - 2], [x + 6 * (.5 + .5 * k), y - 2], [x + 4, y + 1.5], [x - 4, y + 1.5]]);
}

function songbird(B, x, y, sp, singing, face, G) {
  const c = sp.cols, L = sp.look, s = L.size, bob = singing ? Math.sin(G.t * 18) * .4 : 0;
  B.line(c.cap, [[x - face * 1.5 * s, y + bob], [x - face * (3.5 + 1.5 * L.tail) * s, y - (L.tail > 1.2 ? 3 : -1.5) * s + bob]], 1.4 * s);
  B.ell(c.body, x, y + bob, 2.8 * s, 2.2 * s);
  B.ell(c.breast, x + face * .8 * s, y + .7 * s + bob, 1.7 * s, 1.4 * s);
  B.ell(c.cap, x + face * 2.2 * s, y - 1.9 * s + bob, 1.6 * s, 1.6 * s);
  B.poly('dark', [[x + face * 3.6 * s, y - 2.2 * s + bob], [x + face * (4.4 + L.bill * .6) * s, y - 1.8 * s + bob], [x + face * 3.6 * s, y - 1.4 * s + bob]]);
}
function smallBird(B, x, y, dir, ph, colr, k) {
  const fl = Math.sin(ph) * 3.2, d = dir * k;
  B.poly(colr, [[x + 4.4 * d, y - .9 * k], [x + 2 * d, y - 1.9 * k], [x - 3.4 * d, y], [x - 6.4 * d, y - 1.4 * k], [x - 5.6 * d, y], [x - 6.4 * d, y + 1.2 * k], [x - 1.4 * d, y + 1.5 * k], [x + 2 * d, y + 1.5 * k]]);
  B.poly(colr, [[x + 1.2 * d, y - .6 * k], [x - 1.4 * d, y - (.8 + fl) * k], [x - 3.8 * d, y - (1.2 + fl * 1.15) * k], [x - .6 * d, y + .2 * k]]);
}

function thermal(ctx, t, G) {
  // leaves carried up the column are all that shows of it: one fill
  const span = t.y0 - W.CEILING, y0 = G.cam.y - 10, y1 = G.cam.y + G.view.h + 10, p = new Path2D();
  if (G.storm > .9) return;
  for (let j = 0; j < 26; j++) {
    const rate = 26 + 14 * hash(j * 5.1 + t.k), y = t.y0 - ((G.t * rate + j * span / 26 + t.k * 37) % span);
    if (y < y0 || y > y1 || t.y0 - y < 20) continue;
    const ph = G.t * (1.2 + hash(j + t.k)) + j, x = t.c + (hash(t.k * 3 + j) - .5) * t.w * 1.3 + Math.sin(ph) * 9;
    const rot = ph * 1.7, l = 3 + 1.6 * hash(j * 2.3), wd = l * (.25 + .3 * Math.abs(Math.cos(ph * 1.3)));
    p.moveTo(x + Math.cos(rot) * l, y + Math.sin(rot) * l); p.ellipse(x, y, l, wd, rot, 0, TAU);
  }
  ctx.fillStyle = K.leafT; ctx.fill(p);
}

// rings: the half behind the hawk, then the half in front
function ringHalves(ctx, rings, G, half) {
  const p = new Path2D(), a0 = half ? -Math.PI / 2 : Math.PI / 2;
  for (const r of rings) {
    if (r.gone) continue;
    const y = r.y + Math.sin(G.t * 2 + r.x) * .6;
    p.moveTo(r.x + 10.5 * Math.cos(a0), y + 18.5 * Math.sin(a0)); p.ellipse(r.x, y, 10.5, 18.5, 0, a0, a0 + Math.PI);
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = S === 'ink' ? K._ink : K.ringEdge; ctx.lineWidth = S === 'ink' ? 4.6 : 5.6; ctx.stroke(p);
  ctx.strokeStyle = S === 'ink' ? K.cloud : K.ring; ctx.lineWidth = S === 'ink' ? 3 : 4; ctx.stroke(p);
}

function glideLine(ctx, pts, G) {
  if (pts.length < 4) return;
  ctx.save(); ctx.strokeStyle = S === 'ink' ? K._ink : K.glide; ctx.globalAlpha = S === 'shadow' ? .6 : .45; ctx.lineWidth = .9; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(pts[2][0], pts[2][1]); for (let i = 3; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  ctx.restore();
}

/* ---------- the hawk ---------- */
// The red-tail in a handful of flat shapes, drawn straight onto the frame (no layer of its own).
function hawk(ctx, b, G, k) {
  const sh = lw / (BS * k);
  // in shadow play the hawk is outlined in sky light first, so it reads against the dark trees
  const parts = [], f = (r, build) => { const p = new Path2D(); build(p); parts.push([r, p, ctx.getTransform()]); };
  const poly = pts => p => { p.moveTo(pts[0][0], pts[0][1]); for (const q of pts) p.lineTo(q[0], q[1]); p.closePath(); };
  const ell = (x, y, rx, ry, rot = 0) => p => { p.ellipse(x, y, rx, ry, rot, 0, TAU); };
  ctx.save();
  if (b.state === 'fly') {
    let yaw = 0;
    if (b.yaw) { const u = Math.min(1, b.yaw.t / b.yaw.dur); yaw = (u < .5 ? u * Math.PI : u * Math.PI - Math.PI) * b.yawSgn; }
    else if (b.turnT > 0) yaw = (1 - b.turnT / .32) * Math.PI - Math.PI;
    ctx.translate(b.x, b.y + b.bob); ctx.scale(b.face * BS * k, BS * k); ctx.rotate(b.pitch * Math.cos(yaw));
    const fan = b.tailFan, far = wingGeo(b, -1, yaw), near = wingGeo(b, 1, yaw), cy = Math.cos(yaw), bx = Math.sign(cy || 1) * Math.max(.3, Math.abs(cy));
    f('dark', poly(far.outline));
    ctx.save(); ctx.scale(bx, 1);
    f('tail', poly([[-8, -1.6], [-21, -3.2 - 3.6 * fan], [-23.6, .6], [-21, 3.8 + 3.2 * fan], [-8, 2.2]]));
    f('bird', ell(0, .3, 11.8, 4.3));
    f('pale', ell(1.2, 2.4, 9.6, 2.5));
    f('bird', ell(11.2, -2.2, 4, 4));
    f('beak', poly([[14.1, -3.8], [16.8, -3.2], [17.6, -2], [16.6, -1], [14.2, -1.4]]));
    if (S !== 'ink') f('eye', ell(12.6, -3.3, .8, .8));
    ctx.restore();
    f('under', poly(near.outline));
    f('dark', poly([...near.band(0), ...near.band(.22).reverse()]));
    f('dark', poly([...near.band(.8), ...near.band(1).reverse()]));
  } else {
    const u = b.turnT > 0 ? 1 - b.turnT / .32 : 1, xs = b.face * (b.turnT > 0 ? -Math.cos(u * Math.PI) : 1), sx = Math.sign(xs) * Math.max(.18, Math.abs(xs));
    ctx.translate(b.x, b.y + b.bob); ctx.scale(sx * BS * k, BS * k);
    const mode = b.state, rot = mode === 'perch' ? -.75 : mode === 'ground' ? -.35 : -.12, by = mode === 'swim' ? 1.2 : -1;
    const peck = b.peckT > 0 ? Math.sin((1 - b.peckT / .35) * Math.PI) : 0;
    const hx = (mode === 'perch' ? 5.4 : 8) + peck * 3, hy = (mode === 'perch' ? -8.8 : -6) + peck * (mode === 'perch' ? 6 : 8);
    const R = (x, y) => [x * Math.cos(rot) - y * Math.sin(rot), by + x * Math.sin(rot) + y * Math.cos(rot)];
    if (mode !== 'swim') {
      const st = b.moving ? Math.sin(b.walkPh) * 2.2 : 0;
      ctx.strokeStyle = S === 'ink' ? K._ink : K.beak; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-.5, by + 3.5); ctx.lineTo(-1 + st, 6); ctx.moveTo(1.5, by + 3.5); ctx.lineTo(1.5 - st, 6); ctx.stroke();
    }
    f('tail', poly(mode === 'perch' ? [[-3, 3], [-9, 14], [-6.2, 15.6], [-.5, 5]] : [[-6, 0], [-18, 1 + (mode === 'swim' ? -2 : 2)], [-17.5, 4], [-5, 3]]));
    f('bird', ell(0, by, 9.5, 5.4, rot));
    f('pale', ell(...R(2.4, 2), 6, 3.1, rot));
    f('birdWing', ell(-1.8, by - .5, 9, 3.5, rot + .14));
    f('bird', ell(hx, hy, 4, 4));
    f('dark', ell(hx - .6, hy - 1.9, 3.4, 1.6, -.1));
    f('beak', poly([[hx + 3, hy - 1.4], [hx + 5.6, hy - .8], [hx + 6.3, hy + .5], [hx + 5.4, hy + 1.3], [hx + 3, hy + 1]]));
    if (S !== 'ink') f('eye', ell(hx + 1.6, hy - 1, .75, .75));
  }
  if (S === 'shadow') {
    ctx.strokeStyle = K.ringEdge; ctx.lineWidth = sh * 2.6; ctx.lineJoin = 'round';
    for (const [r, p, m] of parts) if (r !== 'eye') { ctx.setTransform(m); ctx.stroke(p); }
  }
  for (const [r, p, m] of parts) { ctx.setTransform(m); fillPath(ctx, r, p, sh); }
  ctx.restore();
}
