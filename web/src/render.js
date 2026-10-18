// Draws one frame in the Wet Wash style. World layers are washed polygons; the sky,
// far hills and weather are screen-space layers with parallax.
import { TAU, clamp, lerp, hash, vnoise, fbm, C, shade, mix } from './util.js';
import { wash, stroke, jit, pathPts, circP, ellP, bloom, softWash, lift, mist, paperBase, paperFinish } from './paint.js';
import * as W from './world.js';
import { nightness } from './palette.js';
import { mousePos, fishPos } from './life.js';

const BS = 1.25; // hawk drawing scale

export function render(ctx, G) {
  const { w, h } = G.view, P = G.P, cam = G.cam;
  background(ctx, G, P, w, h);
  celestial(ctx, G, P, w, h);
  for (const c of clouds(G, w, h)) cloud(ctx, c, P, G);

  // far and mid hills: parallax in both axes so climbing high drops them away
  const lift0 = (G.camGround - cam.y);
  const farY = x => h * .6 + lift0 * .1 - 58 * Math.pow(vnoise(x / 170, 9), 1.4) - 14 * vnoise(x / 48, 10) + 5 * vnoise(x / 13, 11);
  const midY = x => h * .7 + lift0 * .28 + 24 * fbm(x / 300, 5);
  wash(ctx, layerPts(cam.x * .12, farY, w, h, 8), P.far, .42, { passes: 3, amp: 3.5, seed: 1, rim: .25 });
  mist(ctx, h * .3 + lift0 * .1, h * .8 + lift0 * .1, w, P.paper, .6);
  farBirds(ctx, G, P, w, h);
  wash(ctx, layerPts(cam.x * .4, midY, w, h, 6), P.mid, .5, { passes: 3, amp: 3, seed: 2, rim: .35 });
  midTrees(ctx, G, P, w, midY);
  mist(ctx, h * .55 + lift0 * .28, h * .95 + lift0 * .28, w, P.paper, .4);

  ctx.save(); ctx.translate(-cam.x, -cam.y);
  const x0 = cam.x - 40, x1 = cam.x + w + 40;
  for (const t of W.thermalsIn(x0 - 60, x1 + 60)) thermal(ctx, t, G, P);
  const rings = G.visibleRings;
  for (const r of rings) ring(ctx, r, P, G, 0);
  if (G.gather) gathering(ctx, G, P);
  groundLayer(ctx, G, P, x0, x1);
  for (const p of W.pondsIn(x0, x1)) pond(ctx, p, P, G);
  for (const l of W.landmarksIn(x0 - 120, x1 + 120)) landmark(ctx, l, P, G);
  const trees = W.treesIn(x0 - 40, x1 + 40);
  for (const t of trees) tree(ctx, t, P, G);
  if (G.nest) nest(ctx, G.nest, P, G);
  for (const b of W.bushesIn(x0, x1)) bush(ctx, b, P, G);
  if (G.wormsOk()) for (const wm of W.wormsIn(x0, x1)) if (!G.eaten.has(wm.id + G.rainId)) worm(ctx, wm, P, G);
  for (const tw of W.twigsIn(x0, x1)) if (!G.twigGone(tw.id)) twig(ctx, tw.x, tw.y, tw.a, P);
  for (const m of W.miceIn(x0, x1)) if (!G.eaten.has(m.id + ':' + G.day)) mouse(ctx, m, P, G);
  for (const t of trees) if (t.song?.active) { const p = t.song.perch; songbird(ctx, p.x, p.y - 3.4, t.song.sp, t.song.singingT > 0, p.x < t.x ? -1 : 1, P, G); }
  if (G.visitor) visitor(ctx, G.visitor, P, G);
  if (G.hint) hintMark(ctx, G.hint, P, G);
  streaks(ctx, G, P);
  if (G.glide) glideLine(ctx, G.glide, P, G);
  for (const o of G.boids) smallBird(ctx, o, P, G);
  for (const h of G.hawks) drawHawk(ctx, h, P, G, h.scale);
  drawHawk(ctx, G.bird, P, G);
  if (G.carry) carried(ctx, G, P);
  stamina(ctx, G.bird, P);
  for (const r of rings) ring(ctx, r, P, G, 1);
  particles(ctx, G, P);
  ctx.restore();

  rain(ctx, G, P, w, h);
  nearBirds(ctx, G, P, w, h);
  const night = nightness(G.tod) * (G.brightT > 0 ? .35 : 1);
  if (night > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C([150, 160, 200], night * .35); ctx.fillRect(0, 0, w, h); ctx.restore(); }
  if (G.flash > 0) { ctx.save(); ctx.fillStyle = C([255, 255, 250], G.flash * .55); ctx.fillRect(0, 0, w, h); ctx.restore(); }
  paperFinish(ctx, w, h);
}

// The paper and the sky wash only change with the palette and the weather, so they are painted
// into an offscreen canvas and copied each frame; repainted when their colours move.
let bg = null, bgKey = '';
function background(ctx, G, P, w, h) {
  const px = G.view.px, cw = Math.round(w * px), ch = Math.round(h * px);
  const q = c => (c[0] >> 1) + ',' + (c[1] >> 1) + ',' + (c[2] >> 1);
  const key = [cw, ch, q(P.paper), q(P.sky), q(P.sky2), q(P.horizon), q(P.cloudShade), Math.round(G.overcast * 50)].join('|');
  if (key !== bgKey) {
    if (!bg) bg = document.createElement('canvas');
    if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
    const b = bg.getContext('2d');
    b.setTransform(px, 0, 0, px, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    paperBase(b, P, w, h); sky(b, G, P, w, h);
    bgKey = key;
  }
  ctx.drawImage(bg, 0, 0, w, h);
}

function layerPts(base, fy, w, h, step) {
  const p = [[-8, h + 6]];
  const i0 = Math.floor((base - 8) / step), i1 = Math.ceil((base + w + 8) / step);
  for (let i = i0; i <= i1; i++) p.push([i * step - base, fy(i * step)]);
  p.push([w + 8, h + 6]); return p;
}

function sky(ctx, G, P, w, h) {
  softWash(ctx, w * .5, -40, w * .9, 170, P.sky, .55); softWash(ctx, w * .2, 30, w * .5, 120, P.sky, .3); softWash(ctx, w * .8, 10, w * .5, 130, P.sky2, .28);
  softWash(ctx, w * .5, h * .67, w * .8, 70, P.horizon, .35);
  for (let i = 0; i < 4; i++) bloom(ctx, w * hash(i * 3.1 + 2) * .9 + 20, 14 + hash(i * 5.7) * 70, 22 + hash(i * 2.3) * 40, P.sky, .16);
  if (G.overcast > 0) softWash(ctx, w * .5, 0, w, h * .7, P.cloudShade, G.overcast * .45);
}

function celestial(ctx, G, P, w, h) {
  const night = nightness(G.tod);
  if (night > .01) {
    for (let i = 0; i < 60; i++) {
      const x = hash(i * 3.7) * w, y = hash(i * 9.1) * h * .55, tw = .5 + .5 * Math.sin(G.t * 1.5 + i);
      ctx.fillStyle = C(P.paper, night * (1 - G.overcast) * .8 * tw); ctx.beginPath(); ctx.arc(x, y, .5 + hash(i * 5.5) * .7, 0, TAU); ctx.fill();
    }
  }
  const arc = (a, r, col, al) => {
    if (a < -.05 || a > 1.05) return;
    const x = w * (.08 + .84 * a), y = h * .7 - Math.sin(clamp(a, 0, 1) * Math.PI) * h * .58;
    lift(ctx, circP(x, y, r + 3, 16), P.paper, .6 * al);
    wash(ctx, circP(x, y, r, 16), col, .55 * al, { passes: 2, amp: 1.2, seed: 33, rim: .35 });
    bloom(ctx, x, y, r * 2.6, col, .18 * al);
  };
  const vis = 1 - G.overcast * .8;
  arc((G.tod - .25) / .5, 15, P.sun, vis);
  arc(((G.tod + .25) % 1) / .5, 10, [230, 232, 236], vis * night);
}

function clouds(G, w, h) {
  const out = [], base = G.cam.x * .06 + G.cloudDrift, cell = 120, i0 = Math.floor((base - 160) / cell);
  const cover = .3 + G.overcast * .65;
  for (let i = i0; i < i0 + Math.ceil(w / cell) + 4; i++) {
    if (hash(i * 3.3) > cover) continue;
    out.push({ x: i * cell + hash(i * 1.9) * 60 - base, y: 18 + hash(i * 4.1) * h * .22 + (G.camGround - G.cam.y) * .05, w: 40 + hash(i * 8.2) * 60 + G.overcast * 40, seed: i });
  }
  return out;
}
// a cumulus: puffs of paper lifted out of the sky wash, with a soft grey belly; storms paint them dark instead
function cloud(ctx, c, P, G) {
  const n = 4 + (c.seed & 1) + (G.overcast > .5 ? 1 : 0), dark = G.storm;
  const col = mix(P.cloudShade, shade(P.cloudShade, .6), dark);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), r = c.w * (.15 + .13 * Math.sin(u * Math.PI)) * (.8 + .4 * hash(c.seed * 3 + i));
    puffs.push([c.x + u * c.w, c.y - Math.sin(u * Math.PI) * c.w * .07 + (hash(c.seed + i) - .5) * 4, r]);
  }
  for (const [x, y, r] of puffs) lift(ctx, jit(circP(x, y, r, 14, .8), r * .1, c.seed, 2), P.paper, .42 * (1 - dark * .6));
  softWash(ctx, c.x + c.w * .5, c.y + c.w * .06, c.w * .6, c.w * .1, col, .3 + dark * .35);
  if (dark > .05) for (const [x, y, r] of puffs) wash(ctx, circP(x, y, r, 14, .8), col, .22 * dark, { passes: 2, amp: r * .12, seed: c.seed + x | 0, rim: .15 });
}

function midTrees(ctx, G, P, w, midY) {
  const base = G.cam.x * .4, cell = 11, i0 = Math.floor((base - 20) / cell), i1 = Math.ceil((base + w + 20) / cell);
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 1.37 + 500) > .5) continue;
    const wx = i * cell + hash(i * 2.91) * cell * .6, x = wx - base, y = midY(wx) + 1, s = .45 + .2 * hash(i * 5.3);
    if (Math.abs(midY(wx + 5) - midY(wx - 5)) > 8) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (hash(i * 7.7) < .5) wash(ctx, [[-7.5, -4], [-4, -12], [-5, -13], [-2.5, -20], [-3.5, -21], [0, -31], [3.5, -21], [2.5, -20], [5, -13], [4, -12], [7.5, -4]], P.pine, .35, { passes: 2, amp: 1.4, seed: i, rim: .4 });
    else for (let k = 0; k < 3; k++) wash(ctx, circP([0, -5, 5][k], [-18, -13, -14][k], [8, 5.5, 6][k], 10), P.leaf, .3, { passes: 2, amp: 1.4, seed: i + k, rim: .35 });
    ctx.restore();
  }
}

function farBirds(ctx, G, P, w, h) {
  for (const f of G.flocks) for (let j = 0; j < f.n; j++) {
    const x = f.x + j * 9 - (j % 2) * 3, y = f.y + (j % 2) * 5 + Math.sin(G.t * 1.3 + j) * 1.5, s = f.s;
    const fl = Math.sin(G.t * 7 + j * 1.3) * 2.2 * s;
    stroke(ctx, [[x - 4 * s, y - fl], [x, y], [x + 4 * s, y - fl]], P.birdFar, .5, .8, 90 + j);
  }
}

function nearBirds(ctx, G, P, w, h) {
  for (const n of G.nearBirds) {
    const fl = Math.sin(n.ph) * 5;
    ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.dir * 1.6, 1.6);
    wash(ctx, ellP(0, 0, 5, 2.6, -.1), n.col, .65, { passes: 2, amp: .6, seed: n.seed, rim: .4 });
    wash(ctx, circP(4.5, -1.5, 2.3, 9), n.col, .65, { passes: 2, amp: .5, seed: n.seed + 1, rim: .4 });
    wash(ctx, [[-1, -1], [-4, -1 - fl], [2, -.5]], shade(n.col, .7), .7, { passes: 2, amp: .5, seed: n.seed + 2, rim: .3 });
    wash(ctx, [[-4, 0], [-8, -1], [-8, 1.5]], n.col, .6, { passes: 1, amp: .4, seed: n.seed + 3, rim: .3 });
    ctx.restore();
  }
}

/* ---------- world layer ---------- */
function groundLayer(ctx, G, P, x0, x1) {
  const step = 4, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step), bottom = G.cam.y + G.view.h + 10;
  const top = [];
  for (let i = i0; i <= i1; i++) top.push([i * step, W.groundY(i * step)]);
  const poly = [[i0 * step, bottom], ...top, [i1 * step, bottom]];
  wash(ctx, poly, P.near, .62, { passes: 3, amp: 2.2, seed: 3, rim: .5, base: i0 });
  const deep = [[i0 * step, bottom], ...top.map(p => [p[0], p[1] + 22 + 8 * vnoise(p[0] / 40, 8)]), [i1 * step, bottom]];
  wash(ctx, deep, P.ground, .16, { passes: 2, amp: 3, seed: 4, rim: 0, base: i0 });
  // each biome tints its land: ochre meadows, deep green forest, grey rock on the cliffs
  const day = 1 - nightness(G.tod) * .8, tk = .2 * day * (1 - G.sea.winter * .7);
  // one fill with a sideways gradient, so biome borders blend instead of showing a seam
  const gx = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let x = Math.floor(x0 / 40) * 40; x <= x1 + 40; x += 40) gx.addColorStop(clamp((x - x0) / (x1 - x0), 0, 1), C(W.biomeAt(x).tint, tk));
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gx; pathPts(ctx, poly); ctx.fill(); ctx.restore();
  // snow lies along the ground in winter
  if (G.sea.winter > .05) lift(ctx, [...top.map(p => [p[0], p[1] - .5]), ...top.slice().reverse().map(p => [p[0], p[1] + 3.5 + 2 * vnoise(p[0] / 30, 12)])], P.paper, .75 * G.sea.winter);
  // grass tufts along the edge
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.near, .8), .5); ctx.lineWidth = .8;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 3.17) > .45) continue;
    const x = i * step + hash(i) * 3, y = W.groundY(x), l = (2 + hash(i * 1.3) * 3) * (W.biomeAt(x).name === 'marsh' ? 2.6 : 1), sw = Math.sin(G.t * 1.5 + i) * .8 + G.wind * .04;
    ctx.moveTo(x, y + 1); ctx.lineTo(x + sw - .8, y - l); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1.5 + sw, y - l * .8);
  }
  ctx.stroke(); ctx.restore();
}

function pond(ctx, p, P, G) {
  // the water follows the bowl of the bank, so it never reads as a cut-out
  const pts = [], step = 2;
  for (let x = p.x0; x <= p.x1; x += step) pts.push([x, W.groundY(x)]);
  const poly = [[p.x0 - 1, p.waterY], [p.x1 + 1, p.waterY], ...pts.reverse()];
  lift(ctx, poly, P.paper, .7);
  if (W.frozen(p)) {
    // ice: a pale flat sheet with a few scratches
    wash(ctx, poly, mix(P.water, P.paper, .55), .4, { passes: 2, amp: .8, seed: p.k + 40, rim: .3 });
    stroke(ctx, [[p.x0, p.waterY], [p.x1, p.waterY]], shade(P.water, .8), .5, 1.2, p.k);
    ctx.save(); ctx.strokeStyle = C(P.paper, .8); ctx.lineWidth = .7; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const xa = lerp(p.x0, p.x1, .2 + .25 * k); ctx.moveTo(xa, p.waterY + 1.5); ctx.lineTo(xa + 8, p.waterY + 2.5); }
    ctx.stroke(); ctx.restore();
    return;
  }
  wash(ctx, poly, P.water, .45, { passes: 2, amp: 1, seed: p.k + 40, rim: .25 });
  for (const f of p.fish) if (!G.eaten.has(f.id + ':' + G.day)) fish(ctx, fishPos(f, p, G.t), P, f.seed);
  softWash(ctx, p.c, p.waterY + 6, (p.x1 - p.x0) * .6, 10, P.water, .25);
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = C(P.paper, .7); ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const y = p.waterY + 2.5 + k * 3.5, xa = lerp(p.x0, p.x1, .15 + .2 * hash(p.k + k)) + Math.sin(G.t * .8 + k) * 2, len = (p.x1 - p.x0) * (.25 - k * .05);
    if (W.groundY(xa) < y + 1 || W.groundY(xa + len) < y + 1) continue;
    ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xa + len, y); ctx.stroke();
  }
  ctx.restore();
  stroke(ctx, [[p.x0, p.waterY], [p.x1, p.waterY]], shade(P.water, .7), .35, 1, p.k);
  // reeds on the banks
  for (const [x, s] of [[p.x0 + 2, -1], [p.x1 - 2, 1]]) for (let j = 0; j < 4; j++) {
    const rx = x + s * j * 2.5, ry = W.groundY(rx) + 1, l = 10 + 8 * hash(p.k * 9 + j + s), sw = Math.sin(G.t * 1.2 + j) * 1.2 + G.wind * .06;
    stroke(ctx, [[rx, ry], [rx + sw * .5, ry - l * .5], [rx + sw, ry - l]], P.pine, .55, 1, p.k + j);
    if (j % 2) wash(ctx, ellP(rx + sw, ry - l + 1, 1.2, 3), P.trunk, .6, { passes: 1, amp: .3, seed: j, rim: 0 });
  }
}

function tree(ctx, t, P, G) {
  const h = t.h, sd = t.seed, sw = Math.sin(G.t * 1.3 + sd * 1.7) * (1.2 + Math.abs(G.wind) * .05);
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.lean);
  const tw = Math.max(2, h * .035);
  wash(ctx, [[-tw * 1.3, 1], [-tw * .45, -h * .82], [tw * .45, -h * .82], [tw * 1.3, 1]], P.trunk, .7, { passes: 2, amp: .7, seed: sd, rim: .4 });
  if (t.type === 0) {
    const tiers = 5;
    for (let k = 0; k < tiers; k++) {
      const yb = -h * (.16 + k * .16), yt = yb - h * .3, hw = h * .3 * (1 - k / (tiers + .6)), s2 = sw * (k + 1) / tiers;
      wash(ctx, [[-hw, yb], [-hw * .55, yb - h * .06], [s2, yt], [hw * .55, yb - h * .06], [hw, yb], [0, yb + h * .03]], k % 2 ? P.pine : P.pineDk, .55, { passes: 2, amp: 1.6, seed: sd + k, rim: .4 });
    }
    // snow settles on the tiers in winter
    if (G.sea.winter > .05) for (let k = 0; k < tiers; k++) {
      const yb = -h * (.16 + k * .16), yt = yb - h * .3, hw = h * .3 * (1 - k / (tiers + .6)), s2 = sw * (k + 1) / tiers;
      lift(ctx, [[-hw * .9, yb - 1], [s2, yt + 1], [hw * .9, yb - 1], [hw * .5, yb - h * .04], [s2 * .5, yt + h * .1], [-hw * .5, yb - h * .04]], P.paper, .6 * G.sea.winter);
    }
  } else {
    const R = h * .2, cy = -h * .78, leaves = 1 - G.sea.winter * .92;
    const blobs = [[0, cy, R], [-R * .8, cy + R * .35, R * .72], [R * .85, cy + R * .3, R * .75], [-R * .3, cy - R * .7, R * .66], [R * .45, cy - R * .55, R * .6]];
    // bare twigs show through as the leaves fall
    if (leaves < .8) for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (hash(sd * 3 + i) - .5) * 2.2, l = R * (1.1 + .5 * hash(sd + i * 7)), y0 = -h * .7;
      stroke(ctx, [[0, y0], [Math.cos(a) * l * .5 + sw * .2, y0 + Math.sin(a) * l * .5], [Math.cos(a) * l + sw * .5, y0 + Math.sin(a) * l]], P.trunk, .7 * (1 - leaves), 1.4, sd + i);
    }
    if (leaves > .02) {
      blobs.forEach((b, i) => wash(ctx, circP(b[0] + sw * (i + 1) * .3, b[1], b[2], 13), i > 2 ? P.leafHi : P.leaf, .55 * leaves * (.8 + .2 * hash(sd + i)), { passes: 2, amp: 1.8, seed: sd + i * 2, rim: .4 }));
      wash(ctx, circP(R * .3, cy + R * .25, R * .55, 10), P.leafDk, .35 * leaves, { passes: 1, amp: 1, seed: sd + 8, rim: 0 });
    }
    // spring blossom
    if (G.sea.spring > .05) for (let i = 0; i < 14; i++) {
      const b = blobs[i % 5], a = hash(sd * 5 + i) * TAU, r = b[2] * .8 * Math.sqrt(hash(sd + i * 3));
      ctx.fillStyle = C(P.blossom, .8 * G.sea.spring); ctx.beginPath(); ctx.arc(b[0] + Math.cos(a) * r + sw * .4, b[1] + Math.sin(a) * r, 1.3, 0, TAU); ctx.fill();
    }
  }
  // the perchable branches, drawn over the canopy so they read as places to land
  for (const b of t.branches) {
    stroke(ctx, [[0, b.y0 + 2], [b.x1 * .5, b.y0 + (b.y1 - b.y0) * .45], [b.x1, b.y1]], P.trunk, .9, 2.4, sd);
    const tuft = t.type ? 1 - G.sea.winter * .92 : 1;
    if (tuft > .02) wash(ctx, circP(b.x1 + b.side * 1.5 + sw * .3, b.y1 - 2.5, 4, 9), t.type ? P.leaf : P.pine, .5 * tuft, { passes: 2, amp: 1, seed: sd + 30, rim: .3 });
  }
  ctx.restore();
}

function bush(ctx, b, P, G) {
  const { x, y, r } = b, bare = b.hardy ? 0 : G.sea.winter * .6;
  wash(ctx, ellP(x, y - r * .55, r * 1.25, r * .75), P.leafDk, .55 * (1 - bare), { passes: 2, amp: 1.5, seed: b.seed, rim: .4 });
  wash(ctx, ellP(x - r * .3, y - r * .75, r * .7, r * .45), P.leaf, .4 * (1 - bare), { passes: 1, amp: 1, seed: b.seed + 1, rim: 0 });
  if (G.sea.winter > .05) lift(ctx, ellP(x - r * .1, y - r * 1.15, r * .95, r * .25), P.paper, .6 * G.sea.winter);
  for (const be of b.berries) {
    if (!G.berryOk(b, be)) continue;
    wash(ctx, circP(be.x, be.y, 1.7, 7), P.berry, .85, { passes: 2, amp: .3, seed: b.seed + 5, rim: .4 });
    ctx.fillStyle = C(P.paper, .7); ctx.fillRect(be.x - .8, be.y - .9, .7, .7);
  }
}

function worm(ctx, wm, P, G) {
  const ph = G.t * 3 + wm.seed, x = wm.x, y = wm.y + 1;
  const pts = [];
  for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([x + Math.sin(ph + u * 4) * 1.6 * u, y - u * 5.5]); }
  stroke(ctx, pts, P.worm, .95, 1.6, wm.seed);
  ctx.fillStyle = C(shade(P.worm, .7), .8); ctx.beginPath(); ctx.ellipse(x, y + .3, 2.4, .9, 0, 0, TAU); ctx.fill();
}

function songbird(ctx, x, y, sp, singing, face, P, G) {
  const c = sp.cols, bob = singing ? Math.sin(G.t * 18) * .4 : 0;
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(face, 1);
  wash(ctx, [[-3, 0], [-7, 3.5], [-6, 4.2], [-2, 1.2]], c.cap, .7, { passes: 1, amp: .3, seed: 7, rim: .3 });
  wash(ctx, ellP(0, 0, 4.2, 3, -.35), c.body, .8, { passes: 2, amp: .4, seed: 8, rim: .4 });
  wash(ctx, ellP(.8, 1, 2.6, 1.8, -.35), c.breast, .8, { passes: 1, amp: .3, seed: 9, rim: 0 });
  wash(ctx, circP(3, -2.6, 2.3, 9), c.body, .85, { passes: 2, amp: .3, seed: 10, rim: .4 });
  wash(ctx, ellP(2.8, -3.6, 2, 1, 0, 8), c.cap, .8, { passes: 1, amp: .2, seed: 11, rim: 0 });
  const open = singing ? .9 + Math.sin(G.t * 30) * .5 : 0;
  ctx.fillStyle = C(P.birdFar, .9); ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(7, -2.6 - open * .5); ctx.lineTo(5, -2.1); ctx.moveTo(5, -2.2); ctx.lineTo(6.6, -1.8 + open * .5); ctx.lineTo(5, -1.6); ctx.fill();
  ctx.fillStyle = C(P.birdFar); ctx.beginPath(); ctx.arc(3.8, -3, .45, 0, TAU); ctx.fill();
  ctx.restore();
}
function visitor(ctx, v, P, G) {
  if (!v.flying) { songbird(ctx, v.x, v.y, v.sp, v.singT > 0, v.perch && v.perch.x < G.bird.x ? 1 : -1, P, G); return; }
  smallBird(ctx, { x: v.x, y: v.y, vx: v.dir, ph: G.t * 24, col: v.sp.cols.body, wing: v.sp.cols.cap, seed: 3, breast: v.sp.cols.breast }, P, G);
}
// a small bird in flight (flocks, visitors)
function smallBird(ctx, o, P, G) {
  const fl = Math.sin(o.ph) * 3.2, dir = o.vx < 0 ? -1 : 1;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(dir * 1.3, 1.3);
  wash(ctx, ellP(0, 0, 3.4, 1.8, -.1, 10), o.col, .7, { passes: 1, amp: .4, seed: o.seed, rim: .4 });
  wash(ctx, circP(3, -1, 1.6, 8), o.col, .7, { passes: 1, amp: .3, seed: o.seed + 1, rim: .4 });
  if (o.breast) wash(ctx, ellP(.8, .7, 2, 1, -.1, 8), o.breast, .7, { passes: 1, amp: .2, seed: o.seed + 4, rim: 0 });
  wash(ctx, [[-1, -.6], [-3, -.6 - fl], [1.4, -.3]], o.wing, .75, { passes: 1, amp: .3, seed: o.seed + 2, rim: .3 });
  wash(ctx, [[-3, 0], [-6, -.8], [-6, 1]], o.col, .6, { passes: 1, amp: .3, seed: o.seed + 3, rim: .2 });
  ctx.restore();
}

function mouse(ctx, m, P, G) {
  const q = mousePos(m, G.t); if (q.show <= .02) return;
  const a = .85 * q.show, y = q.y + 1 - 2.2 * q.show, hop = Math.abs(Math.sin(G.t * 14 + m.seed)) * .6 * q.run;
  ctx.save(); ctx.translate(q.x, y - hop); ctx.scale(q.dir, 1);
  const col = mix(P.ground, [120, 110, 100], .5);
  stroke(ctx, [[-2.5, .5], [-5, 1.2], [-7, .2]], col, a * .8, .5, m.seed);
  wash(ctx, ellP(0, 0, 3, 1.8, 0, 10), col, a, { passes: 2, amp: .3, seed: m.seed, rim: .4 });
  wash(ctx, circP(2.6, -.3, 1.4, 8), col, a, { passes: 1, amp: .2, seed: m.seed + 1, rim: .4 });
  ctx.fillStyle = C(shade(col, .7), a); ctx.beginPath(); ctx.arc(2, -1.6, .8, 0, TAU); ctx.fill();
  ctx.restore();
}
function fish(ctx, f, P, seed) {
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1);
  const col = shade(P.water, .55);
  wash(ctx, [[3.5, 0], [1, -1.3], [-2.5, -.8], [-4, 0], [-2.5, .8], [1, 1.3]], col, .45, { passes: 1, amp: .3, seed, rim: .3 });
  wash(ctx, [[-3.6, 0], [-6, -1.6], [-5.6, 1.6]], col, .4, { passes: 1, amp: .2, seed: seed + 1, rim: 0 });
  ctx.restore();
}
function twig(ctx, x, y, a, P) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  stroke(ctx, [[-5, 0], [0, -.4], [5, .2]], P.trunk, .85, 1.1, 5);
  stroke(ctx, [[1, -.3], [3, -2.2]], P.trunk, .8, .7, 6);
  ctx.restore();
}
function nest(ctx, n, P, G) {
  const x = n.x, y = n.y, k = Math.min(1, n.twigs / 5);
  if (n.eggAt !== undefined && !n.chick && !n.fledged) wash(ctx, ellP(x + 1, y - 2.5, 2, 2.6, .2, 10), [236, 228, 210], .9, { passes: 1, amp: .2, seed: 9, rim: .5 });
  if (n.chick) {
    const bob = Math.sin(G.t * 5) * .6;
    wash(ctx, circP(x, y - 3.5 + bob, 3, 10), [200, 190, 175], .85, { passes: 2, amp: .4, seed: 11, rim: .4 });
    wash(ctx, circP(x + 1.6, y - 7 + bob, 2, 9), [200, 190, 175], .85, { passes: 1, amp: .3, seed: 12, rim: .4 });
    const open = Math.sin(G.t * 8) > .3 ? 1 : 0;
    wash(ctx, [[x + 3, y - 7.5 + bob], [x + 5.2, y - 7 + bob - open], [x + 3, y - 6.3 + bob]], P.beak, .9, { passes: 1, amp: .1, seed: 13, rim: 0 });
  }
  wash(ctx, [[x - 6 * (.5 + .5 * k), y - 2], [x + 6 * (.5 + .5 * k), y - 2], [x + 4, y + 1.5], [x - 4, y + 1.5]], P.trunk, .75, { passes: 2, amp: .7, seed: 14, rim: .5 });
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.trunk, .7), .6); ctx.lineWidth = .5; ctx.beginPath();
  for (let i = 0; i < n.twigs * 2; i++) { const u = hash(i * 3.1) - .5; ctx.moveTo(x + u * 12, y - 1.5 + hash(i) * 2); ctx.lineTo(x + u * 12 + 4, y + hash(i * 2.2) * 2 - .5); }
  ctx.stroke(); ctx.restore();
}
// what the hawk is carrying, held in its talons
function carried(ctx, G, P) {
  const b = G.bird, x = b.x - b.face * 1, y = b.y + (b.state === 'fly' ? 4.5 : 3);
  if (G.carry === 'twig') twig(ctx, x, y, b.face * .2, P);
  else if (G.carry === 'mouse') { ctx.save(); ctx.translate(x, y + 1); ctx.scale(b.face, 1); wash(ctx, ellP(0, 0, 3, 1.6, .3, 10), [130, 120, 110], .85, { passes: 1, amp: .3, seed: 2, rim: .4 }); ctx.restore(); }
  else if (G.carry === 'fish') { ctx.save(); ctx.translate(x, y + 1); ctx.scale(b.face, 1); fish(ctx, { x: 0, y: 0, dir: 1 }, { water: [150, 170, 190] }, 4); ctx.restore(); }
}

/* ---------- landmarks ---------- */
function landmark(ctx, l, P, G) {
  const { x, y, h } = l, s = l.k * 7;
  if (l.type === 'oak') {
    const R = 60;
    wash(ctx, [[x - 9, y + 2], [x - 5, y - h * .55], [x + 5, y - h * .55], [x + 10, y + 2]], P.trunk, .8, { passes: 2, amp: 1, seed: s, rim: .5 });
    for (const p of l.perches) stroke(ctx, [[x, y - h * .45], [lerp(x, p.x, .5), lerp(y - h * .5, p.y, .6)], [p.x, p.y + 1]], P.trunk, .9, 3, s + 1);
    const leaves = 1 - G.sea.winter * .9;
    if (leaves > .02) {
      const cy = y - h * .7;
      wash(ctx, ellP(x, cy, R * 1.25, R * .7), P.leafDk, .4 * leaves, { passes: 2, amp: 3, seed: s + 20, rim: .4 });
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU, r = R * (.6 + .4 * hash(s + i));
        wash(ctx, circP(x + Math.cos(a) * R * .85, cy + Math.sin(a) * R * .5, r * .55, 13), i % 3 ? P.leaf : P.leafHi, .45 * leaves, { passes: 2, amp: 2, seed: s + i, rim: .4 });
      }
      if (G.sea.spring > .05) for (let i = 0; i < 30; i++) {
        const a = hash(s + i * 3) * TAU, r = Math.sqrt(hash(s + i * 5)) * R;
        ctx.fillStyle = C(P.blossom, .8 * G.sea.spring); ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * .65, 1.5, 0, TAU); ctx.fill();
      }
    }
    for (const p of l.perches) stroke(ctx, [[lerp(x, p.x, .6), lerp(y - h * .5, p.y, .8)], [p.x, p.y + 1]], P.trunk, .9, 2.2, s + 2);
  } else if (l.type === 'tower') {
    const w0 = 16, top = y - h;
    const body = [[x - w0, y + 2], [x - w0 + 2, top + 10], [x - w0 + 4, top], [x - 4, top], [x - 4, top + 5], [x + 3, top + 5], [x + 4, top + 12], [x + w0 - 3, top + 22], [x + w0, y + 2]];
    wash(ctx, body, mix(P.far, P.ground, .4), .75, { passes: 3, amp: 1, seed: s, rim: .55 });
    ctx.save(); pathPts(ctx, body); ctx.clip(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.ground, .7), .35); ctx.lineWidth = .6; ctx.beginPath();
    for (let r = 0; r < 14; r++) { const yy = y - r * 11; ctx.moveTo(x - w0 + 2, yy); ctx.lineTo(x + w0 - 2, yy); }
    ctx.stroke(); ctx.restore();
    wash(ctx, [[x - 4, y - h * .55], [x + 3, y - h * .55], [x + 3, y - h * .45], [x - 4, y - h * .45]], P.birdFar, .6, { passes: 1, amp: .3, seed: s + 3, rim: 0 });
    for (let i = 0; i < 5; i++) wash(ctx, circP(x - w0 + 4 + i * 6, y - 18 - hash(s + i) * 40, 6, 9), P.leafDk, .35, { passes: 1, amp: 1, seed: s + i, rim: .3 });
  } else if (l.type === 'falls') {
    const top = y - h;
    const rock = [[x - 50, y + 4], [x - 44, top + 40], [x - 30, top + 6], [x - 10, top], [x + 6, top + 4], [x + 12, top + 30], [x + 34, top + 70], [x + 52, y + 4]];
    wash(ctx, rock, mix(P.far, P.ground, .5), .7, { passes: 3, amp: 2.5, seed: s, rim: .55 });
    const fall = [[x - 6, top + 2], [x + 4, top + 4], [x + 9, y], [x - 9, y]];
    lift(ctx, fall, P.paper, .85);
    wash(ctx, fall, P.water, .25 * (1 - G.sea.winter * .5), { passes: 2, amp: 1, seed: s + 1, rim: .2 });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .8), .35); ctx.lineWidth = .7; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const xx = x - 5 + i * 2, o = (G.t * 60 + i * 23) % 40; for (let yy = top + 6 + o; yy < y; yy += 40) { ctx.moveTo(xx + (yy - top) * .02, yy); ctx.lineTo(xx + (yy - top) * .02, yy + 14); } }
    ctx.stroke(); ctx.restore();
    for (let i = 0; i < 4; i++) softWash(ctx, x + (i - 1.5) * 8, y - 4, 14, 6, P.paper, .3);
  } else if (l.type === 'stones') {
    for (const [dx, hh, w0] of [[-26, 30, 7], [0, 44, 9], [24, 34, 8], [-46, 18, 6], [44, 20, 6]]) {
      wash(ctx, [[x + dx - w0, y + 2], [x + dx - w0 * .8, y - hh + 2], [x + dx, y - hh], [x + dx + w0 * .8, y - hh + 3], [x + dx + w0, y + 2]], mix(P.far, P.ground, .3), .7, { passes: 2, amp: 1, seed: s + dx, rim: .55 });
      if (G.sea.winter > .05) lift(ctx, [[x + dx - w0 * .8, y - hh + 2], [x + dx, y - hh], [x + dx + w0 * .8, y - hh + 3], [x + dx, y - hh + 4]], P.paper, .7 * G.sea.winter);
    }
  }
}

// other hawks gathered over the wintering marsh, circling high
function gathering(ctx, G, P) {
  const g = G.gather, a = Math.min(1, g.t / 5) * Math.min(1, (60 - g.t) / 3);
  for (let i = 0; i < 9; i++) {
    const ph = G.t * (.25 + .05 * (i % 3)) + i * 2.1, r = 50 + 30 * (i % 4);
    const x = g.x + 40 + Math.cos(ph) * r * 1.6, y = W.groundY(g.x) - 170 - i * 11 + Math.sin(ph) * r * .3, s = .8 + .2 * hash(i);
    wash(ctx, [[x - 11 * s, y - 2], [x - 4 * s, y - 1], [x, y + 1.5], [x + 4 * s, y - 1], [x + 11 * s, y - 2], [x + 4 * s, y + 1.2], [x, y + 3], [x - 4 * s, y + 1.2]], P.birdFar, .45 * a, { passes: 1, amp: .4, seed: i, rim: .3 });
  }
}

function thermal(ctx, t, G, P) {
  const top = W.CEILING, vis = clamp(.6 - G.storm * .5, 0, 1);
  if (vis <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  const hg = ctx.createLinearGradient(t.c - t.w, 0, t.c + t.w, 0);
  hg.addColorStop(0, C(P.thermal, 0)); hg.addColorStop(.5, C(P.thermal, .2 * vis)); hg.addColorStop(1, C(P.thermal, 0));
  ctx.fillStyle = hg; ctx.fillRect(t.c - t.w, top, t.w * 2, t.y1 - top);
  // the base of the column fades in from nothing, soft on every side
  for (let k = 0; k < 8; k++) { ctx.globalAlpha = (k + .5) / 8; ctx.fillRect(t.c - t.w, t.y0 - (t.y0 - t.y1) * (k + 1) / 8, t.w * 2, (t.y0 - t.y1) / 8 + .2); }
  ctx.globalAlpha = 1;
  // rising wind curls (Windlines style): short arcs drifting upward in the column
  ctx.strokeStyle = C(shade(P.thermal, .7), .6 * vis); ctx.lineWidth = 1; ctx.lineCap = 'round';
  const span = t.y0 - top, n = 22;
  for (let j = 0; j < n; j++) {
    const y = t.y0 - ((G.t * 30 + j * span / n + t.k * 37) % span);
    const fade = Math.min(1, (t.y0 - y) / 50);
    if (fade <= 0) continue;
    const x = t.c + (hash(t.k * 3 + j) - .5) * t.w * 1.4 + Math.sin(G.t * .9 + j) * 3, r = 4 + 4 * hash(j + t.k);
    ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * (1.1 + .3 * hash(j)), Math.PI * (1.7 + .3 * hash(j * 2))); ctx.stroke();
  }
  ctx.restore();
}

function ring(ctx, r, P, G, half) {
  if (r.gone) return;
  const a0 = half ? -Math.PI / 2 : Math.PI / 2, wob = Math.sin(G.t * 2 + r.x) * .6;
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = C(P.ring, k ? .45 : .75); ctx.lineWidth = k ? 1.2 : 2.6;
    ctx.beginPath(); ctx.ellipse(r.x + k * .5, r.y + wob, 5 + k * .4, r.r, 0, a0, a0 + Math.PI); ctx.stroke();
  }
  ctx.restore();
}

function hintMark(ctx, p, P, G) {
  const a = .35 + .25 * Math.sin(G.t * 4);
  ctx.save(); ctx.strokeStyle = C(P.paper, a + .2); ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.arc(p.x, p.y - 3, 7, 0, TAU); ctx.stroke(); ctx.restore();
}

/* ---------- the hawk ---------- */
function wingGeo(b, side) {
  const SPAN = 27 * b.L, cp = .906, sp = .423, sh = [2, -2.6], th0 = b.theta, th1 = b.theta + b.bend;
  function at(s, xo) {
    const a = Math.min(s, .45) * SPAN; let y = -a * Math.sin(th0), z = a * Math.cos(th0);
    if (s > .45) { const hh = (s - .45) * SPAN; y -= hh * Math.sin(th1); z += hh * Math.cos(th1); }
    z *= side; return [sh[0] + xo - s * s * 3.5 * b.L, sh[1] + y * cp + z * sp];
  }
  const lead = [[0, 6], [.25, 7.5], [.5, 6.5], [.72, 3]].map(([s, x]) => at(s, x));
  const trail = [[.72, -8], [.5, -9.5], [.25, -10], [0, -8]].map(([s, x]) => at(s, x));
  const fingers = [], notches = [], bases = [];
  for (let k = 0; k < 5; k++) {
    const x = 1 - k * (1.6 + b.splay * 1.3);
    fingers.push(at(1.05 - k * .035 * (1 + b.splay * .3), x)); bases.push(at(.8, x - .6));
    if (k < 4) notches.push(at(.86, x - (.9 + b.splay * .6)));
  }
  const outline = [...lead]; for (let k = 0; k < 5; k++) { outline.push(fingers[k]); if (k < 4) outline.push(notches[k]); } outline.push(...trail);
  return { outline, fingers, bases, band: f => { const r = []; for (let i = 0; i < 4; i++) r.push([lerp(lead[i][0], trail[3 - i][0], f), lerp(lead[i][1], trail[3 - i][1], f)]); return r; } };
}

function drawHawk(ctx, b, P, G, k = 1) {
  const u = b.turnT > 0 ? 1 - b.turnT / .32 : 1;
  const xs = b.face * (b.turnT > 0 ? -Math.cos(u * Math.PI) : 1);
  const sx = Math.sign(xs) * Math.max(.18, Math.abs(xs));
  ctx.save(); ctx.translate(b.x, b.y + b.bob); ctx.scale(sx * BS * k, BS * k);
  if (b.state === 'fly') { ctx.rotate(b.pitch); flyingHawk(ctx, b, P); }
  else sittingHawk(ctx, b, P, G);
  ctx.restore();
}

function flyingHawk(ctx, b, P) {
  const fan = b.tailFan, a = .8, amp = 1.1;
  const tail = [[-8, -1.8], [-20, -3.2 - 3.5 * fan], [-22.5, .6], [-20, 3.6 + 3 * fan], [-8, 2.4]];
  const body = ellP(0, 0, 11, 4.8), head = circP(11, -2.6, 4.3, 12);
  const beak = [[14.4, -4.4], [18.6, -2.4], [17.8, -.6], [16.6, -1.5], [14.6, -.9]];
  const far = wingGeo(b, -1), near = wingGeo(b, 1);
  wash(ctx, far.outline, P.birdFar, a * .45, { passes: 1, amp, seed: 71, rim: .35 });
  // paper under the body so the far wing never shows through it
  lift(ctx, body, P.paper, .95); lift(ctx, head, P.paper, .95); lift(ctx, tail, P.paper, .9);
  wash(ctx, tail, P.tail, a * .75, { passes: 2, amp, seed: 72, rim: .5 });
  wash(ctx, body, P.bird, a, { passes: 2, amp, seed: 73, rim: .45 });
  wash(ctx, head, P.bird, a, { passes: 2, amp: amp * .8, seed: 74, rim: .45 });
  lift(ctx, ellP(1.5, 3.4, 8.5, 2.6), P.paper, .5);
  wash(ctx, beak, P.beak, a, { passes: 1, amp: .4, seed: 75, rim: .4 });
  lift(ctx, near.outline, P.paper, .45);
  wash(ctx, near.outline, P.birdWing, a * .85, { passes: 2, amp, seed: 76, rim: .6 });
  wash(ctx, [...near.band(.62), ...near.band(.84).reverse()], P.birdFar, a * .45, { passes: 1, amp, seed: 77, rim: 0 });
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.birdFar, a * .6); ctx.lineWidth = .5;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(...near.bases[k]); ctx.lineTo(...near.fingers[k]); ctx.stroke(); }
  ctx.restore();
  eye(ctx, 12.7, -3.6, P);
}

function eye(ctx, x, y, P) { ctx.fillStyle = C(P.paper); ctx.beginPath(); ctx.arc(x, y, .8, 0, TAU); ctx.fill(); ctx.fillStyle = C(P.birdFar); ctx.beginPath(); ctx.arc(x + .2, y, .5, 0, TAU); ctx.fill(); }

// perched, walking or swimming: wings folded along an upright body
function sittingHawk(ctx, b, P, G) {
  const mode = b.state, a = .82;
  const rot = mode === 'perch' ? -.75 : mode === 'ground' ? -.35 : -.12;
  const peck = b.peckT > 0 ? Math.sin((1 - b.peckT / .35) * Math.PI) : 0;
  const by = mode === 'swim' ? 1.2 : -1;
  const hx0 = mode === 'perch' ? 5 : 8, hy0 = mode === 'perch' ? -8.5 : -6;
  const hx = hx0 + peck * 3, hy = hy0 + peck * (mode === 'perch' ? 6 : 8);
  const tail = mode === 'perch' ? [[-3, 3], [-9, 14], [-6, 15.5], [-.5, 5]] : [[-6, 0], [-18, 1 + (mode === 'swim' ? -2 : 2)], [-17.5, 4], [-5, 3]];
  const body = ellP(0, by, 9.5, 5.4, rot);
  const wing = ellP(-1.5, by - .3, 8.8, 3.6, rot + .12);
  const head = circP(hx, hy, 4.1, 12);
  // legs first so the body sits on them
  if (mode !== 'swim') {
    const step = b.moving ? Math.sin(b.walkPh) * 2.2 : 0;
    stroke(ctx, [[-.5, by + 3.5], [-1 + step, 6]], P.beak, .9, 1.1, 81);
    stroke(ctx, [[1.5, by + 3.5], [1.5 - step, 6]], P.beak, .9, 1.1, 82);
  }
  lift(ctx, body, P.paper, .95); lift(ctx, head, P.paper, .95);
  wash(ctx, tail, P.tail, a, { passes: 2, amp: .8, seed: 72, rim: .5 });
  wash(ctx, body, P.bird, a, { passes: 2, amp: 1, seed: 73, rim: .45 });
  lift(ctx, ellP(2.5, by + 2, 5.5, 3, rot), P.paper, .55);
  wash(ctx, wing, P.birdWing, a, { passes: 2, amp: .9, seed: 76, rim: .55 });
  wash(ctx, [[-6 + Math.cos(rot) * -2, by + 2], [-14, by + (mode === 'perch' ? 9 : 1.5)], [-5, by + 4]], P.birdFar, a * .6, { passes: 1, amp: .5, seed: 78, rim: .3 });
  wash(ctx, head, P.bird, a, { passes: 2, amp: .8, seed: 74, rim: .45 });
  wash(ctx, [[hx + 3.2, hy - 1.6], [hx + 7, hy + .2], [hx + 6.2, hy + 1.8], [hx + 5, hy + .9], [hx + 3.2, hy + 1.4]], P.beak, a, { passes: 1, amp: .3, seed: 75, rim: .4 });
  eye(ctx, hx + 1.6, hy - 1, P);
  if (mode === 'swim') {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .7), .5); ctx.lineWidth = .7;
    const r = 1 + (G.t * 6) % 6;
    ctx.beginPath(); ctx.ellipse(0, 4.5, 11 + r, 1.4 + r * .15, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

function streaks(ctx, G, P) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'round'; ctx.lineWidth = .7;
  for (const s of G.streaks) {
    if (s.trail.length < 3) continue;
    const k = Math.sin(Math.PI * s.life / s.max);
    ctx.strokeStyle = C(P.birdFar, .16 * k);
    pathPts(ctx, s.trail, false); ctx.stroke();
  }
  ctx.restore();
}

// a faint dotted arc to where the current glide would land
function glideLine(ctx, pts, P, G) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C(P.birdFar, .5);
  for (let i = 3; i < pts.length; i += 3) { const a = 1 - i / pts.length; ctx.globalAlpha = .2 + .5 * a; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], .8, 0, TAU); ctx.fill(); }
  if (pts.end) { const e = pts[pts.length - 1]; ctx.globalAlpha = .5; ctx.strokeStyle = C(P.birdFar, .6); ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(e[0], e[1] + 5, 5, 1.6, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// stamina shows as a thin ring that only appears once the wings are tiring
function stamina(ctx, b, P) {
  if (b.stamina > .97 || b.state !== 'fly') return;
  const a = Math.min(1, (1 - b.stamina) * 3);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = C(P.paper, .5 * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 22, -Math.PI * .75, Math.PI * .75 - .001, true); ctx.stroke();
  ctx.strokeStyle = C(b.stamina < .15 ? [190, 80, 50] : P.birdFar, .55 * a); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(b.x, b.y, 22, -Math.PI * .75, -Math.PI * .75 - Math.PI * 1.5 * b.stamina, true); ctx.stroke();
  ctx.restore();
}

/* ---------- particles and weather ---------- */
function particles(ctx, G, P) {
  for (const p of G.parts) {
    const k = p.life / p.max;
    if (p.type === 'drop') { ctx.fillStyle = C(P.water, .7 * k); ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, TAU); ctx.fill(); }
    else if (p.type === 'ripple') { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .7), .6 * k); ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3 + (1 - k) * 14, 1 + (1 - k) * 2, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    else if (p.type === 'puff') { ctx.fillStyle = C(P.ground, .25 * k); ctx.beginPath(); ctx.arc(p.x, p.y, 2 + (1 - k) * 5, 0, TAU); ctx.fill(); }
    else if (p.type === 'feather') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = C(P.bird, .7 * k); ctx.beginPath(); ctx.ellipse(0, 0, 3, 1, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.type === 'spark') { ctx.save(); ctx.strokeStyle = C(P.ring, k); ctx.lineWidth = 1; const r = 2 + (1 - k) * 4; ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke(); ctx.restore(); }
    else if (p.type === 'note') {
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = C(p.col); ctx.strokeStyle = C(p.col); ctx.lineWidth = .8;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 1.6, 1.2, -.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x + 1.4, p.y); ctx.lineTo(p.x + 1.4, p.y - 6); ctx.lineTo(p.x + 3.4, p.y - 4.5); ctx.stroke(); ctx.restore();
    }
  }
}

function rain(ctx, G, P, w, h) {
  if (G.rain <= .02) return;
  if (G.sea.winter > .5) {
    // snow: slow flakes drifting with the wind
    const n = Math.floor(140 * G.rain);
    ctx.save(); ctx.fillStyle = C(P.paper, .85);
    for (let i = 0; i < n; i++) {
      const sp = 22 + hash(i * 7.1) * 20, y = (hash(i * 2.3) * (h + 20) + G.t * sp) % (h + 20) - 10;
      const x = ((hash(i * 5.9) * (w + 40) + G.t * G.wind * .8 + Math.sin(G.t + i) * 6 - G.cam.x * .3) % (w + 40) + w + 40) % (w + 40) - 20;
      ctx.beginPath(); ctx.arc(x, y, .7 + hash(i) * .8, 0, TAU); ctx.fill();
    }
    ctx.restore(); return;
  }
  const n = Math.floor(170 * G.rain), slant = G.wind * .02 + .15;
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .75), .45); ctx.lineWidth = .7; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 260 + hash(i * 7.1) * 120;
    const y = (hash(i * 2.3) * (h + 20) + G.t * sp) % (h + 20) - 10;
    const x = ((hash(i * 5.9) * (w + 40) + G.t * sp * slant - G.cam.x * .3) % (w + 40) + w + 40) % (w + 40) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x + slant * 7, y + 7);
  }
  ctx.stroke(); ctx.restore();
}
