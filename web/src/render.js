// Draws one frame in the Wet Wash style. World layers are washed polygons; the sky,
// far hills and weather are screen-space layers with parallax.
import { TAU, clamp, lerp, hash, vnoise, fbm, C, shade, mix } from './util.js';
import { wash, stroke, strokes, jit, pathPts, circP, ellP, bloom, softWash, lift, mist, paperBase, paperFinish, sprite, blit, spriteFrame, stamp, put } from './paint.js';
import * as W from './world.js';
import { nightness } from './palette.js';
import { GFX } from './gfx.js';
import { mousePos, fishPos } from './life.js';
import { drawFauna } from './fauna.js';

const BS = 1.25; // hawk drawing scale

export function render(ctx, G) {
  const { w, h } = G.view, P = G.P, cam = G.cam, S = G.view.scr;
  spriteFrame(); pk = palKey(P, G);
  // everything behind the land is soft, so it is painted at half resolution and copied up in one go.
  // The sky and clouds are far away and don't zoom; the hills zoom out a little, less than the land.
  const bw = Math.round(S.w * S.px * BACK), bh = Math.round(S.h * S.px * BACK);
  if (!back) back = document.createElement('canvas');
  if (back.width !== bw || back.height !== bh) { back.width = bw; back.height = bh; }
  const bx = back.getContext('2d'), spx = bw / S.w;
  bx.setTransform(spx, 0, 0, spx, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1;
  const cx = G.camC.x, cy = G.camC.y, lift0 = G.camGround - cy;
  background(bx, G, P, S.w, S.h, spx);
  celestial(bx, G, P, S.w, S.h);
  if (GFX.clouds) for (const c of clouds(G, S.w, S.h, cx, lift0)) cloud(bx, c, P, G);
  // far and mid hills: parallax in both axes so climbing high drops them away
  const hz = 1 + (G.view.z - 1) * .45, hw = S.w * hz, hh = S.h * hz, hpx = bw / hw;
  bx.setTransform(hpx, 0, 0, hpx, 0, 0);
  const l0 = lift0 - hh * .32;
  if (GFX.hills) hillLayer(bx, G, 'far', cx * .12 - hw / 2, hh * .6 + l0 * .1, hw, hpx);
  if (GFX.mist) mist(bx, hh * .3 + l0 * .1, hh * .8 + l0 * .1, hw, P.paper, .6);
  bx.setTransform(spx, 0, 0, spx, 0, 0); farBirds(bx, G, P, S.w, S.h); bx.setTransform(hpx, 0, 0, hpx, 0, 0);
  hillLayer(bx, G, 'mid', cx * .4 - hw / 2, hh * .7 + l0 * .28, hw, hpx);
  if (GFX.mist) mist(bx, hh * .55 + l0 * .28, hh * .95 + l0 * .28, hw, P.paper, .4);
  ctx.drawImage(back, 0, 0, w, h);
  // each hawk is painted on its own small layer first, so its many passes never blend on the big canvas
  const hawks = [...G.hawks.map(hk => hawkLayer(G, hk, P, hk.scale, 'h' + G.hawks.indexOf(hk))), hawkLayer(G, G.bird, P, 1, 'me')];

  ctx.save(); ctx.translate(-cam.x, -cam.y);
  const x0 = cam.x - 40, x1 = cam.x + w + 40;
  if (GFX.thermals) for (const t of W.thermalsIn(x0 - 60, x1 + 60)) thermal(ctx, t, G, P);
  const rings = G.visibleRings;
  for (const r of rings) ring(ctx, r, P, G, 0);
  if (G.gather) gathering(ctx, G, P);
  groundLayer(ctx, G, P, x0, x1);
  for (const p of W.pondsIn(x0, x1)) pond(ctx, p, P, G);
  shadow(ctx, G.bird, P);
  for (const l of W.landmarksIn(x0 - 120, x1 + 120)) landmark(ctx, l, P, G);
  const trees = W.treesIn(x0 - 40, x1 + 40);
  for (const t of trees) tree(ctx, t, P, G);
  if (G.nest) nest(ctx, G.nest, P, G);
  for (const b of W.bushesIn(x0, x1)) bush(ctx, b, P, G);
  if (G.wormsOk()) for (const wm of W.wormsIn(x0, x1)) if (!G.eaten.has(wm.id + G.rainId)) worm(ctx, wm, P, G);
  for (const tw of W.twigsIn(x0, x1)) if (!G.twigGone(tw.id)) twig(ctx, tw.x, tw.y, tw.a, P, G.view.spx);
  drawFauna(ctx, G, P);
  for (const m of W.miceIn(x0, x1)) if (!G.eaten.has(m.id + ':' + G.day)) mouse(ctx, m, P, G);
  for (const t of trees) if (t.song?.active) { const p = t.song.perch; songbird(ctx, p.x, p.y - 3.4, t.song.sp, t.song.singingT > 0, p.x < t.x ? -1 : 1, P, G); }
  if (G.visitor) visitor(ctx, G.visitor, P, G);
  if (G.hint) hintMark(ctx, G.hint, P, G);
  if (GFX.streaks) streaks(ctx, G, P);
  if (G.glide) glideLine(ctx, G.glide, P, G);
  for (const o of G.boids) smallBird(ctx, o, P, G);
  for (const c of G.crows) crow(ctx, c, P, G);
  for (const hl of hawks) ctx.drawImage(hl.c, hl.x, hl.y, hl.w, hl.w);
  if (G.carry) carried(ctx, G, P);
  stamina(ctx, G.bird, P);
  for (const r of rings) ring(ctx, r, P, G, 1);
  particles(ctx, G, P);
  ctx.restore();

  // weather and the birds that dash past are screen space
  ctx.save(); ctx.scale(w / S.w, h / S.h);
  if (GFX.weather) rain(ctx, G, P, S.w, S.h);
  nearBirds(ctx, G, P, S.w, S.h);
  ctx.restore();
  const night = nightness(G.tod) * (G.brightT > 0 ? .35 : 1);
  if (night > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C([150, 160, 200], night * .35); ctx.fillRect(0, 0, w, h); ctx.restore(); }
  if (G.flash > 0) { ctx.save(); ctx.fillStyle = C([255, 255, 250], G.flash * .55); ctx.fillRect(0, 0, w, h); ctx.restore(); }
  if (GFX.paper) paperFinish(ctx, w, h);
}

// The paper and the sky wash only change with the palette and the weather, so they are painted
// into an offscreen canvas and copied each frame; repainted when their colours move.
const BACK = .5;
let bg = null, bgKey = '', back = null;
function background(ctx, G, P, w, h, px) {
  const cw = Math.round(w * px), ch = Math.round(h * px);
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

// the colours every sprite depends on, coarsely quantised, plus the season amounts
let pk = '';
function palKey(P, G) {
  let k = '';
  for (const n of ['far', 'mid', 'near', 'ground', 'pine', 'pineDk', 'leaf', 'leafHi', 'leafDk', 'trunk', 'birdFar']) { const c = P[n]; k += (c[0] >> 2) + ',' + (c[1] >> 2) + ',' + (c[2] >> 2) + ';'; }
  return k + Math.round(G.sea.winter * 25) + ',' + Math.round(G.view.spx * 100);
}

// Far and mid hills scroll with parallax. Their shape in layer space never changes, so they are
// painted as sprite strips (mid hills with their little trees) and slid into place each frame.
const HILL = {
  far: { cw: 256, step: 8, y: x => -58 * Math.pow(vnoise(x / 170, 9), 1.4) - 14 * vnoise(x / 48, 10) + 5 * vnoise(x / 13, 11), lo: -80, hi: 8, col: 'far', a: .42, o: { passes: 3, amp: 3.5, seed: 1, rim: .25 } },
  mid: { cw: 192, step: 6, y: x => 24 * fbm(x / 300, 5), lo: -60, hi: 28, col: 'mid', a: .5, o: { passes: 3, amp: 3, seed: 2, rim: .35 }, trees: true },
};
function hillLayer(ctx, G, which, base, oy, w, px) {
  const L = HILL[which], P = G.P, h = Math.round(G.view.scr.h * 1.7);   // deep enough for any zoom
  ctx.save(); ctx.translate(-base, oy);
  for (let c = Math.floor(base / L.cw); c * L.cw < base + w; c++) {
    const xa = c * L.cw, xb = xa + L.cw, yb = L.hi + h + 10;
    const s = sprite(which + c, pk + h, xa, L.lo, xb, yb, G.view.scr.px * BACK, x => {
      const i0 = Math.floor(xa / L.step) - 2, i1 = Math.ceil(xb / L.step) + 2, pts = [[i0 * L.step, yb + 30]];
      for (let i = i0; i <= i1; i++) pts.push([i * L.step, L.y(i * L.step)]);
      pts.push([i1 * L.step, yb + 30]);
      wash(x, pts, P[L.col], L.a, { ...L.o, base: i0 });
      if (L.trees) midTrees(x, P, xa - 12, xb + 12, L.y);
    });
    blit(ctx, s);
  }
  ctx.restore();
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
    for (let g = 0; g < 4; g++) {
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const tw = .5 + .5 * Math.sin(G.t * 1.5 + i); if (Math.min(3, Math.floor(tw * 4)) !== g) continue;
        const x = hash(i * 3.7) * w, y = hash(i * 9.1) * h * .55, r = .5 + hash(i * 5.5) * .7;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fillStyle = C(P.paper, night * (1 - G.overcast) * .8 * (g + .5) / 4); ctx.fill();
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

function clouds(G, w, h, cx, lift0) {
  const out = [], base = cx * .06 + G.cloudDrift, cell = 120, i0 = Math.floor((base - 160) / cell);
  const cover = .3 + G.overcast * .65;
  for (let i = i0; i < i0 + Math.ceil(w / cell) + 4; i++) {
    if (hash(i * 3.3) > cover) continue;
    out.push({ x: i * cell + hash(i * 1.9) * 60 - base, y: 18 + hash(i * 4.1) * h * .22 + (lift0 - h * .32) * .05, w: 40 + hash(i * 8.2) * 60 + G.overcast * 40, seed: i });
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

function midTrees(ctx, P, xa, xb, midY) {
  const cell = 11, i0 = Math.floor(xa / cell), i1 = Math.ceil(xb / cell);
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 1.37 + 500) > .5) continue;
    const wx = i * cell + hash(i * 2.91) * cell * .6, x = wx, y = midY(wx) + 1, s = .45 + .2 * hash(i * 5.3);
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

// birds dashing past close to the eye: the small flying bird stamp, scaled up
function nearBirds(ctx, G, P, w, h) {
  for (const n of G.nearBirds) {
    ctx.save(); ctx.translate(n.x, n.y); ctx.scale(2.2, 2.2);
    n.wing ??= shade(n.col, .7);
    smallBird(ctx, { x: 0, y: 0, vx: n.dir, ph: n.ph, col: n.col, wing: n.wing, seed: n.seed }, P, G);
    ctx.restore();
  }
}

/* ---------- world layer ---------- */
// The land is painted in sprite chunks, each a multiply-only strip from above the grass line
// to below the bottom of any view; snow and the swaying grass are drawn live on top.
const GC = 160;
function groundLayer(ctx, G, P, x0, x1) {
  const step = 4, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step);
  const day = 1 - nightness(G.tod) * .8, tk = .2 * day * (1 - G.sea.winter * .7), vh = Math.round(G.view.hMax);
  const key = pk + vh + ',' + Math.round(tk * 200);
  for (let c = Math.floor(x0 / GC); c * GC < x1; c++) {
    const xa = c * GC, xb = xa + GC, j0 = xa / step - 4, j1 = xb / step + 4;
    let lo = Infinity, hi = -Infinity;
    for (let j = j0; j <= j1; j++) { const y = W.groundY(j * step); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const bottom = hi + vh + 10;
    const s = sprite('g' + c, key, xa, lo - 8, xb, bottom, G.view.spx, x => {
      const top = [];
      for (let j = j0; j <= j1; j++) top.push([j * step, W.groundY(j * step)]);
      const poly = [[j0 * step, bottom + 30], ...top, [j1 * step, bottom + 30]];
      wash(x, poly, P.near, .62, { passes: 3, amp: 2.2, seed: 3, rim: .5, base: j0 });
      const deep = [[j0 * step, bottom + 30], ...top.map(p => [p[0], p[1] + 22 + 8 * vnoise(p[0] / 40, 8)]), [j1 * step, bottom + 30]];
      wash(x, deep, P.ground, .16, { passes: 2, amp: 3, seed: 4, rim: 0, base: j0 });
      // each biome tints its land: one fill with a sideways gradient, so biome borders blend
      const ga = Math.floor(xa / 40) * 40, gb = Math.ceil(xb / 40) * 40 + 40;
      const gx = x.createLinearGradient(ga, 0, gb, 0);
      for (let wx = ga; wx <= gb; wx += 40) gx.addColorStop((wx - ga) / (gb - ga), C(W.biomeAt(wx).tint, tk));
      x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = gx; pathPts(x, poly); x.fill(); x.restore();
    });
    blit(ctx, s);
  }
  const top = [];
  for (let i = i0; i <= i1; i++) top.push([i * step, W.groundY(i * step)]);
  // snow lies along the ground in winter
  if (G.sea.winter > .05) lift(ctx, [...top.map(p => [p[0], p[1] - .5]), ...top.slice().reverse().map(p => [p[0], p[1] + 3.5 + 2 * vnoise(p[0] / 30, 12)])], P.paper, .75 * G.sea.winter);
  // grass tufts along the edge
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.near, .8), .5); ctx.lineWidth = .8;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 3.17) > .45) continue;
    const x = i * step + hash(i) * 3, y = W.groundY(Math.round(x)), l = (2 + hash(i * 1.3) * 3) * (W.biomeAt(x).name === 'marsh' ? 2.6 : 1), sw = Math.sin(G.t * 1.5 + i) * .8 + G.wind * .04;
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
  for (const f of p.fish) if (!G.eaten.has(f.id + ':' + G.day)) fish(ctx, fishPos(f, p, G.t), P, f.seed, G.view.spx);
  softWash(ctx, p.c, p.waterY + 6, (p.x1 - p.x0) * .6, 10, P.water, .25);
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = C(P.paper, .7); ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const y = p.waterY + 2.5 + k * 3.5, xa = lerp(p.x0, p.x1, .15 + .2 * hash(p.k + k)) + Math.sin(G.t * .8 + k) * 2, len = (p.x1 - p.x0) * (.25 - k * .05);
    if (W.groundY(Math.round(xa)) < y + 1 || W.groundY(Math.round(xa + len)) < y + 1) continue;
    ctx.moveTo(xa, y); ctx.lineTo(xa + len, y);
  }
  ctx.stroke(); ctx.restore();
  stroke(ctx, [[p.x0, p.waterY], [p.x1, p.waterY]], shade(P.water, .7), .35, 1, p.k);
  // reeds on the banks
  const stems = [], heads = [];
  for (const [x, s] of [[p.x0 + 2, -1], [p.x1 - 2, 1]]) for (let j = 0; j < 4; j++) {
    const rx = x + s * j * 2.5, ry = W.groundY(Math.round(rx)) + 1, l = 10 + 8 * hash(p.k * 9 + j + s), sw = Math.sin(G.t * 1.2 + j) * 1.2 + G.wind * .06;
    stems.push([[rx, ry], [rx + sw * .5, ry - l * .5], [rx + sw, ry - l]]);
    if (j % 2) heads.push(ellP(rx + sw, ry - l + 1, 1.2, 3, 0, 8));
  }
  strokes(ctx, stems, P.pine, .55, 1, p.k);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C(P.trunk, .75); ctx.beginPath(); for (const hd of heads) { ctx.moveTo(hd[0][0], hd[0][1]); for (const q of hd) ctx.lineTo(q[0], q[1]); ctx.closePath(); } ctx.fill(); ctx.restore();
}

// Trees are sprites: the trunk and canopy as one (swayed by skewing the copy, so the crown
// moves and the roots stay), the perch branches as another that holds still under the hawk.
// Snow and blossom are paper and petals rather than multiply paint, so they are drawn live.
function tree(ctx, t, P, G) {
  const h = t.h, sd = t.seed, sw = Math.sin(G.t * 1.3 + sd * 1.7) * (1.2 + Math.abs(G.wind) * .05);
  const leaves = t.type ? 1 - G.sea.winter * .92 : 1, px = G.view.spx, R = 7 + h * (t.type ? .36 : .31);
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.lean);
  const body = sprite('t' + t.i, pk, -R, -h * 1.12 - 6, R, 5, px, x => treeBody(x, t, P, leaves));
  ctx.save(); ctx.transform(1, 0, -sw / h, 1, 0, 0); blit(ctx, body); ctx.restore();
  if (t.type === 0) {
    // snow settles on the tiers in winter
    if (G.sea.winter > .05) for (let k = 0; k < 5; k++) {
      const yb = -h * (.16 + k * .16), yt = yb - h * .3, hw = h * .3 * (1 - k / 5.6), s2 = sw * (k + 1) / 5;
      lift(ctx, [[-hw * .9, yb - 1], [s2, yt + 1], [hw * .9, yb - 1], [hw * .5, yb - h * .04], [s2 * .5, yt + h * .1], [-hw * .5, yb - h * .04]], P.paper, .6 * G.sea.winter);
    }
  } else if (G.sea.spring > .05) {
    // spring blossom, one path for all the petals
    const Rb = h * .2, cy = -h * .78, blobs = treeBlobs(Rb, cy);
    ctx.fillStyle = C(P.blossom, .8 * G.sea.spring); ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const bb = blobs[i % 5], a = hash(sd * 5 + i) * TAU, r = bb[2] * .8 * Math.sqrt(hash(sd + i * 3)), x = bb[0] + Math.cos(a) * r + sw * .4, y = bb[1] + Math.sin(a) * r;
      ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, TAU);
    }
    ctx.fill();
  }
  let bx0 = 0, bx1 = 0, by0 = 0, by1 = -h;
  for (const b of t.branches) { bx0 = Math.min(bx0, b.x1); bx1 = Math.max(bx1, b.x1); by0 = Math.min(by0, b.y1); by1 = Math.max(by1, b.y0); }
  blit(ctx, sprite('tb' + t.i, pk, bx0 - 9, by0 - 9, bx1 + 9, by1 + 6, px, x => {
    // the perchable branches, drawn over the canopy so they read as places to land
    for (const b of t.branches) {
      stroke(x, [[0, b.y0 + 2], [b.x1 * .5, b.y0 + (b.y1 - b.y0) * .45], [b.x1, b.y1]], P.trunk, .9, 2.4, sd);
      if (leaves > .02) wash(x, circP(b.x1 + b.side * 1.5, b.y1 - 2.5, 4, 9), t.type ? P.leaf : P.pine, .5 * leaves, { passes: 2, amp: 1, seed: sd + 30, rim: .3 });
    }
  }));
  ctx.restore();
}
const treeBlobs = (R, cy) => [[0, cy, R], [-R * .8, cy + R * .35, R * .72], [R * .85, cy + R * .3, R * .75], [-R * .3, cy - R * .7, R * .66], [R * .45, cy - R * .55, R * .6]];
function treeBody(ctx, t, P, leaves) {
  const h = t.h, sd = t.seed, tw = Math.max(2, h * .035);
  wash(ctx, [[-tw * 1.3, 1], [-tw * .45, -h * .82], [tw * .45, -h * .82], [tw * 1.3, 1]], P.trunk, .7, { passes: 2, amp: .7, seed: sd, rim: .4 });
  if (t.type === 0) {
    const tiers = 5;
    for (let k = 0; k < tiers; k++) {
      const yb = -h * (.16 + k * .16), yt = yb - h * .3, hw = h * .3 * (1 - k / (tiers + .6));
      wash(ctx, [[-hw, yb], [-hw * .55, yb - h * .06], [0, yt], [hw * .55, yb - h * .06], [hw, yb], [0, yb + h * .03]], k % 2 ? P.pine : P.pineDk, .55, { passes: 2, amp: 1.6, seed: sd + k, rim: .4 });
    }
    return;
  }
  const R = h * .2, cy = -h * .78, blobs = treeBlobs(R, cy);
  // bare twigs show through as the leaves fall
  if (leaves < .8) for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (hash(sd * 3 + i) - .5) * 2.2, l = R * (1.1 + .5 * hash(sd + i * 7)), y0 = -h * .7;
    stroke(ctx, [[0, y0], [Math.cos(a) * l * .5, y0 + Math.sin(a) * l * .5], [Math.cos(a) * l, y0 + Math.sin(a) * l]], P.trunk, .7 * (1 - leaves), 1.4, sd + i);
  }
  if (leaves > .02) {
    blobs.forEach((b, i) => wash(ctx, circP(b[0], b[1], b[2], 13), i > 2 ? P.leafHi : P.leaf, .55 * leaves * (.8 + .2 * hash(sd + i)), { passes: 2, amp: 1.8, seed: sd + i * 2, rim: .4 }));
    wash(ctx, circP(R * .3, cy + R * .25, R * .55, 10), P.leafDk, .35 * leaves, { passes: 1, amp: 1, seed: sd + 8, rim: 0 });
  }
}

function bush(ctx, b, P, G) {
  const { x, y, r } = b, bare = b.hardy ? 0 : G.sea.winter * .6;
  blit(ctx, sprite('b' + b.i, pk + b.hardy, x - r * 1.25 - 4, y - r * 1.3 - 4, x + r * 1.25 + 4, y + 3, G.view.spx, c => {
    wash(c, ellP(x, y - r * .55, r * 1.25, r * .75), P.leafDk, .55 * (1 - bare), { passes: 2, amp: 1.5, seed: b.seed, rim: .4 });
    wash(c, ellP(x - r * .3, y - r * .75, r * .7, r * .45), P.leaf, .4 * (1 - bare), { passes: 1, amp: 1, seed: b.seed + 1, rim: 0 });
  }));
  if (G.sea.winter > .05) lift(ctx, ellP(x - r * .1, y - r * 1.15, r * .95, r * .25), P.paper, .6 * G.sea.winter);
  for (const be of b.berries) {
    if (!G.berryOk(b, be)) continue;
    const st = stamp('berry', P.berry.map(v => v >> 2).join(), -2.6, -2.6, 2.6, 2.6, G.view.spx * 1.5, c => {
      wash(c, circP(0, 0, 1.7, 7), P.berry, .85, { passes: 2, amp: .3, seed: 5, rim: .4 });
      c.fillStyle = C(P.paper, .7); c.fillRect(-.8, -.9, .7, .7);
    });
    ctx.drawImage(st.c, be.x + st.x0, be.y + st.y0, st.w, st.h);
  }
}

// a soft shadow under a hawk flying low over the ground: one blended ellipse, so the height of
// a landing or a stoop can be judged. Fainter and wider the higher the hawk.
function shadow(ctx, b, P) {
  if (b.state === 'perch' || b.state === 'swim') return;
  const gy = W.groundY(b.x), up = gy - b.y;
  if (up > 130 || W.waterAt(b.x) !== null) return;
  const k = 1 - up / 130;
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C(shade(P.near, .55), .2 * k * k + .04);
  ctx.beginPath(); ctx.ellipse(b.x + b.face * 2, gy + .6, 9 + up * .07, 2.2 + up * .008, 0, 0, TAU); ctx.fill(); ctx.restore();
}

function worm(ctx, wm, P, G) {
  const ph = G.t * 3 + wm.seed, x = wm.x, y = wm.y + 1;
  const pts = [];
  for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([x + Math.sin(ph + u * 4) * 1.6 * u, y - u * 5.5]); }
  stroke(ctx, pts, P.worm, .95, 1.6, wm.seed);
  ctx.fillStyle = C(shade(P.worm, .7), .8); ctx.beginPath(); ctx.ellipse(x, y + .3, 2.4, .9, 0, 0, TAU); ctx.fill();
}

// Each species is told by its silhouette (sp.look): the wren's tail cocked high, the lark's
// crest, the finch's stubby bill, the thrush's spotted breast, the owl round and big-headed.
function songbird(ctx, x, y, sp, singing, face, P, G) {
  const c = sp.cols, L = sp.look, bob = singing ? Math.sin(G.t * 18) * .4 : 0;
  const lv = singing ? Math.round((Math.sin(G.t * 30) + 1) * 1.5) : -1, open = lv < 0 ? 0 : .9 + (lv / 1.5 - 1) * .5;
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(face * L.size, L.size);
  put(ctx, stamp('song' + sp.id + ':' + lv, pk, -10, -10, 9, 5, G.view.spx * 2 * L.size, x => {
    const ink = P.birdFar;
    if (L.owl) {
      // an owl: one round shape, a flat face with two big eyes, ear tufts, a stub of a tail
      stroke(x, [[-.6, 2.4], [-1, 3.6]], ink, .7, .55, 6); stroke(x, [[1, 2.4], [1.2, 3.6]], ink, .7, .55, 5);
      wash(x, [[-3, 1], [-5.5, 2.8], [-4.6, 3.6], [-2, 2.4]], c.cap, .8, { passes: 1, amp: .2, seed: 7, rim: .3 });
      wash(x, ellP(0, -.6, 4.4, 3.6, -.1), c.body, .82, { passes: 2, amp: .35, seed: 8, rim: .4 });
      wash(x, ellP(.8, .6, 2.8, 2.4, -.1), c.breast, .8, { passes: 1, amp: .25, seed: 9, rim: 0 });
      x.fillStyle = C(shade(c.body, .6), .6); x.beginPath(); for (let k = 0; k < 5; k++) { const sx = -.6 + (k % 3) * 1.3, sy = -.2 + Math.floor(k / 3) * 1.4; x.moveTo(sx + .5, sy); x.ellipse(sx, sy, .5, .3, .4, 0, TAU); } x.fill();
      wash(x, ellP(-1.6, -1.4, 2.6, 1.8, -.25), shade(c.body, .72), .7, { passes: 1, amp: .25, seed: 12, rim: .35 });
      wash(x, circP(1.4, -4.2, 3.4, 12), c.body, .85, { passes: 2, amp: .3, seed: 10, rim: .4 });
      wash(x, [[-1.2, -6.4], [-2.2, -9.4], [.2, -7.2]], c.cap, .85, { passes: 1, amp: .15, seed: 13, rim: 0 });
      wash(x, [[3.2, -6.6], [4.8, -9.2], [4.6, -6.6]], c.cap, .85, { passes: 1, amp: .15, seed: 14, rim: 0 });
      lift(x, ellP(2.2, -4, 2.4, 2.2, 0), P.paper, .55);   // the facial disc
      for (const ex of [.9, 3.4]) { x.fillStyle = C(P.beak, .95); x.beginPath(); x.arc(ex, -4.3, 1, 0, TAU); x.fill(); x.fillStyle = C(ink); x.beginPath(); x.arc(ex + .1, -4.3, .55, 0, TAU); x.fill(); }
      x.fillStyle = C(ink, .9); x.beginPath(); x.moveTo(1.6, -3.4); x.lineTo(2.9, -3.3 + open * .4); x.lineTo(2.2, -2.3); x.fill();
      return;
    }
    // a plump little bird with its tail cocked, standing on thin legs
    stroke(x, [[-.4, 2.2], [-.8, 3.6]], ink, .7, .45, 6); stroke(x, [[.8, 2.2], [.9, 3.6]], ink, .7, .45, 5);
    const tl = L.tail, tip = [-7.6 + (tl - 1) * 1.8, -3.4 * tl];
    wash(x, [[-2.6, -.4], tip, [tip[0] + .2, tip[1] + 1.4], [-6.4 + (tl - 1) * 1.6, -1.6 * tl], [-2.2, 1.2]], c.cap, .75, { passes: 1, amp: .2, seed: 7, rim: .35 });
    wash(x, ellP(0, 0, 4.2, 2.9, -.28), c.body, .8, { passes: 2, amp: .35, seed: 8, rim: .4 });
    wash(x, ellP(1.3, 1, 2.6, 1.8, -.2), c.breast, .85, { passes: 1, amp: .25, seed: 9, rim: 0 });
    if (L.spots) { x.fillStyle = C(shade(c.body, .55), .7); x.beginPath(); for (let k = 0; k < 6; k++) { const sx = -.2 + (k % 3) * 1.3, sy = .3 + Math.floor(k / 3) * 1.1 + (k % 2) * .3; x.moveTo(sx + .4, sy); x.ellipse(sx, sy, .4, .28, .5, 0, TAU); } x.fill(); }
    wash(x, ellP(-1.2, -.7, 3.1, 1.5, -.32), shade(c.body, .72), .7, { passes: 1, amp: .25, seed: 12, rim: .35 });
    lift(x, [[-2.6, -.6], [.6, -1.4], [.4, -.9], [-2.4, -.1]], P.paper, .45);
    wash(x, circP(3.1, -2.7, 2.3, 10), c.body, .85, { passes: 2, amp: .25, seed: 10, rim: .4 });
    wash(x, ellP(2.7, -3.8, 2.1, 1.1, -.1, 9), c.cap, .85, { passes: 1, amp: .15, seed: 11, rim: 0 });
    if (L.crest) wash(x, [[1.6, -4.6], [2.6, -7.4], [3.4, -6.8], [4, -4.7]], c.cap, .85, { passes: 1, amp: .15, seed: 15, rim: 0 });
    if (L.bib) wash(x, ellP(3.2, -.9, 1.6, 1, .3, 8), c.cap, .85, { passes: 1, amp: .1, seed: 16, rim: 0 });
    const bl = 5 + 2 * L.bill, bt = L.thick ? .5 : 0;
    x.fillStyle = C(ink, .9); x.beginPath(); x.moveTo(5, -3 - bt); x.lineTo(bl, -2.6 - open * .5); x.lineTo(5, -2.1); x.moveTo(5, -2.2); x.lineTo(bl - .4, -1.8 + open * .5); x.lineTo(5, -1.6 + bt); x.fill();
    x.fillStyle = C(P.paper, .85); x.beginPath(); x.arc(3.8, -3, .75, 0, TAU); x.fill();
    x.fillStyle = C(ink); x.beginPath(); x.arc(3.85, -3, .45, 0, TAU); x.fill();
  }));
  ctx.restore();
}
// a crow: the small flying bird, bigger and black
function crow(ctx, c, P, G) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1.75, 1.75);
  smallBird(ctx, { x: 0, y: 0, vx: c.vxs, ph: c.ph, col: P.crow, wing: shade(P.crow, .85), seed: c.seed }, P, G);
  ctx.restore();
}
function visitor(ctx, v, P, G) {
  if (!v.flying) { songbird(ctx, v.x, v.y, v.sp, v.singT > 0, v.perch && v.perch.x < G.bird.x ? 1 : -1, P, G); return; }
  smallBird(ctx, { x: v.x, y: v.y, vx: v.dir, ph: G.t * 24, col: v.sp.cols.body, wing: v.sp.cols.cap, seed: 3, breast: v.sp.cols.breast }, P, G);
}
// a small bird in flight (flocks, visitors)
// a small bird in flight (flocks, visitors), from one of eight wingbeat stamps
function smallBird(ctx, o, P, G) {
  const lv = Math.round((Math.sin(o.ph) + 1) * 3.5), fl = (lv / 3.5 - 1) * 3.2, dir = o.vx < 0 ? -1 : 1, sd = o.seed % 4;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(dir * 1.3, 1.3);
  put(ctx, stamp('sb' + o.col + o.wing + o.breast + sd + ':' + lv, '', -8, -6, 7, 6, G.view.spx * 1.6, x => {
    // a swept, pointed wing that beats above and below a teardrop body; notched tail
    const far = fl * .7;
    wash(x, [[.2, -.6], [-2.2, -1 - far], [-3.6, -1.2 - far * 1.1], [-.8, -.3]], shade(o.wing, .85), .5, { passes: 1, amp: .2, seed: sd + 5, rim: .2 });
    wash(x, [[-2.6, -.2], [-6.4, -1.4], [-5.6, 0], [-6.4, 1.2], [-2.6, .8]], o.col, .65, { passes: 1, amp: .2, seed: sd + 3, rim: .25 });
    wash(x, [[4.4, -.9], [2, -1.9], [-1.5, -1.4], [-3.4, 0], [-1.4, 1.5], [2, 1.5]], o.col, .75, { passes: 1, amp: .25, seed: sd, rim: .4 });
    if (o.breast) wash(x, ellP(1.2, .7, 2.2, .9, -.05, 8), o.breast, .75, { passes: 1, amp: .15, seed: sd + 4, rim: 0 });
    wash(x, circP(3.6, -.9, 1.5, 9), o.col, .8, { passes: 1, amp: .2, seed: sd + 1, rim: .4 });
    x.fillStyle = C(P.birdFar, .85); x.beginPath(); x.moveTo(4.9, -1.2); x.lineTo(6.2, -.8); x.lineTo(4.9, -.5); x.fill();
    wash(x, [[1.2, -.6], [-1.4, -.8 - fl], [-3.8, -1.2 - fl * 1.15], [-.6, .2]], o.wing, .8, { passes: 1, amp: .2, seed: sd + 2, rim: .35 });
  }));
  ctx.restore();
}

function mouse(ctx, m, P, G) {
  const q = mousePos(m, G.t), b = G.bird;
  if (b.kiteT > .3 && Math.abs(m.x - b.x) < 140) q.show = Math.max(q.show, .9);   // a kiting hawk sees the grass move
  if (q.show <= .02) return;
  const y = q.y + 1 - 2.2 * q.show, hop = Math.abs(Math.sin(G.t * 14 + m.seed)) * .6 * q.run, sd = m.seed % 4;
  ctx.save(); ctx.translate(q.x, y - hop); ctx.scale(q.dir, 1);
  const col = mix(P.ground, [120, 110, 100], .5), a = .85;
  put(ctx, stamp('mouse' + sd, pk, -8, -3, 5, 3, G.view.spx, x => {
    stroke(x, [[-2.5, .5], [-5, 1.2], [-7, .2]], col, a * .8, .5, sd);
    wash(x, ellP(0, 0, 3, 1.8, 0, 10), col, a, { passes: 2, amp: .3, seed: sd, rim: .4 });
    wash(x, circP(2.6, -.3, 1.4, 8), col, a, { passes: 1, amp: .2, seed: sd + 1, rim: .4 });
    x.fillStyle = C(shade(col, .7), a); x.beginPath(); x.arc(2, -1.6, .8, 0, TAU); x.fill();
  }), q.show);
  ctx.restore();
}
function fish(ctx, f, P, seed, px) {
  const col = shade(P.water, .55), sd = seed % 4;
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1);
  put(ctx, stamp('fish' + sd, col.map(v => v >> 2).join(), -7, -3, 5, 3, px, x => {
    wash(x, [[3.5, 0], [1, -1.3], [-2.5, -.8], [-4, 0], [-2.5, .8], [1, 1.3]], col, .45, { passes: 1, amp: .3, seed: sd, rim: .3 });
    wash(x, [[-3.6, 0], [-6, -1.6], [-5.6, 1.6]], col, .4, { passes: 1, amp: .2, seed: sd + 1, rim: 0 });
  }));
  ctx.restore();
}
function twig(ctx, x, y, a, P, px) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  put(ctx, stamp('twig', pk, -6.5, -3.5, 6.5, 1.5, px, c => {
    stroke(c, [[-5, 0], [0, -.4], [5, .2]], P.trunk, .85, 1.1, 5);
    stroke(c, [[1, -.3], [3, -2.2]], P.trunk, .8, .7, 6);
  }));
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
  if (G.carry === 'twig') twig(ctx, x, y, b.face * .2, P, G.view.spx);
  else if (G.carry === 'mouse') { ctx.save(); ctx.translate(x, y + 1); ctx.scale(b.face, 1); wash(ctx, ellP(0, 0, 3, 1.6, .3, 10), [130, 120, 110], .85, { passes: 1, amp: .3, seed: 2, rim: .4 }); ctx.restore(); }
  else if (G.carry === 'fish') { ctx.save(); ctx.translate(x, y + 1); ctx.scale(b.face, 1); fish(ctx, { x: 0, y: 0, dir: 1 }, { water: [150, 170, 190] }, 4, G.view.spx); ctx.restore(); }
}

/* ---------- landmarks ---------- */
// landmarks are big, still paintings: their multiply passes are sprites, the moving water,
// snow and blossom are drawn live on top
function landmark(ctx, l, P, G) {
  const { x, y, h } = l, s = l.k * 7, px = G.view.spx;
  const box = (id, draw, x0 = x - 110, y0 = y - h - 30, x1 = x + 110, y1 = y + 8) => blit(ctx, sprite(l.id + id, pk, x0, y0, x1, y1, px, draw));
  if (l.type === 'oak') {
    const R = 60, leaves = 1 - G.sea.winter * .9, cy = y - h * .7;
    box('', c => {
      wash(c, [[x - 9, y + 2], [x - 5, y - h * .55], [x + 5, y - h * .55], [x + 10, y + 2]], P.trunk, .8, { passes: 2, amp: 1, seed: s, rim: .5 });
      for (const p of l.perches) stroke(c, [[x, y - h * .45], [lerp(x, p.x, .5), lerp(y - h * .5, p.y, .6)], [p.x, p.y + 1]], P.trunk, .9, 3, s + 1);
      if (leaves > .02) {
        wash(c, ellP(x, cy, R * 1.25, R * .7), P.leafDk, .4 * leaves, { passes: 2, amp: 3, seed: s + 20, rim: .4 });
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU, r = R * (.6 + .4 * hash(s + i));
          wash(c, circP(x + Math.cos(a) * R * .85, cy + Math.sin(a) * R * .5, r * .55, 13), i % 3 ? P.leaf : P.leafHi, .45 * leaves, { passes: 2, amp: 2, seed: s + i, rim: .4 });
        }
      }
    });
    if (leaves > .02 && G.sea.spring > .05) {
      ctx.fillStyle = C(P.blossom, .8 * G.sea.spring); ctx.beginPath();
      for (let i = 0; i < 30; i++) {
        const a = hash(s + i * 3) * TAU, r = Math.sqrt(hash(s + i * 5)) * R, bx = x + Math.cos(a) * r * 1.2, by = cy + Math.sin(a) * r * .65;
        ctx.moveTo(bx + 1.5, by); ctx.arc(bx, by, 1.5, 0, TAU);
      }
      ctx.fill();
    }
    box('p', c => { for (const p of l.perches) stroke(c, [[lerp(x, p.x, .6), lerp(y - h * .5, p.y, .8)], [p.x, p.y + 1]], P.trunk, .9, 2.2, s + 2); });
  } else if (l.type === 'tower') {
    box('', c => {
      const w0 = 16, top = y - h;
      const body = [[x - w0, y + 2], [x - w0 + 2, top + 10], [x - w0 + 4, top], [x - 4, top], [x - 4, top + 5], [x + 3, top + 5], [x + 4, top + 12], [x + w0 - 3, top + 22], [x + w0, y + 2]];
      wash(c, body, mix(P.far, P.ground, .4), .75, { passes: 3, amp: 1, seed: s, rim: .55 });
      c.save(); pathPts(c, body); c.clip(); c.globalCompositeOperation = 'multiply'; c.strokeStyle = C(shade(P.ground, .7), .35); c.lineWidth = .6; c.beginPath();
      for (let r = 0; r < 14; r++) { const yy = y - r * 11; c.moveTo(x - w0 + 2, yy); c.lineTo(x + w0 - 2, yy); }
      c.stroke(); c.restore();
      wash(c, [[x - 4, y - h * .55], [x + 3, y - h * .55], [x + 3, y - h * .45], [x - 4, y - h * .45]], P.birdFar, .6, { passes: 1, amp: .3, seed: s + 3, rim: 0 });
      for (let i = 0; i < 5; i++) wash(c, circP(x - w0 + 4 + i * 6, y - 18 - hash(s + i) * 40, 6, 9), P.leafDk, .35, { passes: 1, amp: 1, seed: s + i, rim: .3 });
    }, x - 30, y - h - 6, x + 30);
  } else if (l.type === 'falls') {
    const top = y - h;
    box('', c => {
      const rock = [[x - 50, y + 4], [x - 44, top + 40], [x - 30, top + 6], [x - 10, top], [x + 6, top + 4], [x + 12, top + 30], [x + 34, top + 70], [x + 52, y + 4]];
      wash(c, rock, mix(P.far, P.ground, .5), .7, { passes: 3, amp: 2.5, seed: s, rim: .55 });
    }, x - 60, top - 8, x + 62, y + 10);
    const fall = [[x - 6, top + 2], [x + 4, top + 4], [x + 9, y], [x - 9, y]];
    lift(ctx, fall, P.paper, .85);
    wash(ctx, fall, P.water, .25 * (1 - G.sea.winter * .5), { passes: 2, amp: 1, seed: s + 1, rim: .2 });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .8), .35); ctx.lineWidth = .7; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const xx = x - 5 + i * 2, o = (G.t * 60 + i * 23) % 40; for (let yy = top + 6 + o; yy < y; yy += 40) { ctx.moveTo(xx + (yy - top) * .02, yy); ctx.lineTo(xx + (yy - top) * .02, yy + 14); } }
    ctx.stroke(); ctx.restore();
    for (let i = 0; i < 4; i++) softWash(ctx, x + (i - 1.5) * 8, y - 4, 14, 6, P.paper, .3);
  } else if (l.type === 'stones') {
    const S = [[-26, 30, 7], [0, 44, 9], [24, 34, 8], [-46, 18, 6], [44, 20, 6]];
    box('', c => {
      for (const [dx, hh, w0] of S) wash(c, [[x + dx - w0, y + 2], [x + dx - w0 * .8, y - hh + 2], [x + dx, y - hh], [x + dx + w0 * .8, y - hh + 3], [x + dx + w0, y + 2]], mix(P.far, P.ground, .3), .7, { passes: 2, amp: 1, seed: s + dx, rim: .55 });
    }, x - 60, y - 52, x + 60, y + 8);
    if (G.sea.winter > .05) for (const [dx, hh, w0] of S) lift(ctx, [[x + dx - w0 * .8, y - hh + 2], [x + dx, y - hh], [x + dx + w0 * .8, y - hh + 3], [x + dx, y - hh + 4]], P.paper, .7 * G.sea.winter);
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

// the warm column is a sprite (one blended copy instead of nine); the rising curls share one path
function thermal(ctx, t, G, P) {
  const top = W.CEILING, vis = clamp(.6 - G.storm * .5, 0, 1);
  if (vis <= 0) return;
  blit(ctx, sprite('th' + t.k, pk + Math.round(vis * 20) + (P.thermal[0] >> 2) + (P.thermal[1] >> 2), t.c - t.w, top, t.c + t.w, t.y0, G.view.spx * .4, x => {
    x.globalCompositeOperation = 'multiply';
    const hg = x.createLinearGradient(t.c - t.w, 0, t.c + t.w, 0);
    hg.addColorStop(0, C(P.thermal, 0)); hg.addColorStop(.3, C(P.thermal, .07 * vis)); hg.addColorStop(.5, C(P.thermal, .24 * vis)); hg.addColorStop(.7, C(P.thermal, .07 * vis)); hg.addColorStop(1, C(P.thermal, 0));
    x.fillStyle = hg; x.fillRect(t.c - t.w, top, t.w * 2, t.y1 - top);
    // the base of the column fades in from nothing, soft on every side
    for (let k = 0; k < 8; k++) { x.globalAlpha = (k + .5) / 8; x.fillRect(t.c - t.w, t.y0 - (t.y0 - t.y1) * (k + 1) / 8, t.w * 2, (t.y0 - t.y1) / 8 + .2); }
  }));
  // leaves carried up the column, tumbling as they rise: they show where the air is rising
  // without a word. Two fills for all of them (the ones fading in at the base, and the rest).
  ctx.save();
  const span = t.y0 - top, n = 24, y0 = G.cam.y - 10, y1 = G.cam.y + G.view.h + 10;
  const col = mix(P.leafDk, P.leafHi, .35), al = Math.min(1, vis * 1.6);
  for (let lv = 1; lv <= 2; lv++) {
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const rate = 26 + 14 * hash(j * 5.1 + t.k);
      const y = t.y0 - ((G.t * rate + j * span / n + t.k * 37) % span);
      const fade = Math.min(1, (t.y0 - y) / 50);
      if (fade <= 0 || (fade < 1) !== (lv === 1) || y < y0 || y > y1) continue;
      // nearer the core the leaves rise in a tighter spiral
      const ph = G.t * (1.2 + hash(j + t.k)) + j, x = t.c + (hash(t.k * 3 + j) - .5) * t.w * 1.3 + Math.sin(ph) * 9;
      const rot = ph * 1.7, l = 3 + 1.6 * hash(j * 2.3), wdt = l * (.25 + .3 * Math.abs(Math.cos(ph * 1.3)));
      ctx.moveTo(x + Math.cos(rot) * l, y + Math.sin(rot) * l); ctx.ellipse(x, y, l, wdt, rot, 0, TAU);
    }
    ctx.fillStyle = C(col, (lv === 1 ? .45 : .9) * al); ctx.fill();
  }
  ctx.restore();
}

// A ring is a small loop of cloud: puffs of paper around an upright oval, shaded underneath,
// warmed a touch by the sun. Each half (behind the hawk, in front of it) is one cached stamp.
const RING_RX = 10.5, RING_RY = 18.5;
function ring(ctx, r, P, G, half) {
  if (r.gone) return;
  const wob = Math.sin(G.t * 2 + r.x) * .6, dark = G.storm;
  const st = stamp('cring' + half, [P.paper, P.cloudShade, P.ring].map(c => c.map(v => v >> 3).join()).join() + (dark > .3 ? 'd' : ''), -19, -27, 19, 27, G.view.spx * 1.3, x => {
    const n = 8, puffs = [];
    for (let i = 0; i < n; i++) {
      const a = (half ? -Math.PI / 2 : Math.PI / 2) + Math.PI * (i + .5) / n, rr = 5 + 2.2 * hash(i * 3.1 + half * 7);
      puffs.push([Math.cos(a) * RING_RX, Math.sin(a) * RING_RY, rr, i]);
    }
    x.fillStyle = C(P.paper, .96); x.beginPath();
    for (const [px, py, rr, i] of puffs) { const q = jit(circP(px, py, rr, 12), rr * .12, i + half * 9, 1); x.moveTo(...q[0]); for (const v of q) x.lineTo(...v); x.closePath(); }
    x.fill();
    x.globalCompositeOperation = 'source-atop';   // shade and warmth stay inside the puffs
    x.fillStyle = C(P.cloudShade, .6 + dark * .3); x.beginPath();
    for (const [px, py, rr] of puffs) { x.moveTo(px + rr * .3 + rr * .85, py + rr * .45); x.arc(px + rr * .3, py + rr * .45, rr * .85, 0, TAU); }
    x.fill();
    x.fillStyle = C(P.ring, .3); x.beginPath();
    for (const [px, py, rr] of puffs) { x.moveTo(px - rr * .2 + rr * .7, py - rr * .45); x.arc(px - rr * .2, py - rr * .45, rr * .7, 0, TAU); }
    x.fill();
  });
  ctx.drawImage(st.c, r.x + st.x0, r.y + wob + st.y0, st.w, st.h);
}

function hintMark(ctx, p, P, G) {
  const a = .35 + .25 * Math.sin(G.t * 4);
  ctx.save(); ctx.strokeStyle = C(P.paper, a + .2); ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.arc(p.x, p.y - 3, 7, 0, TAU); ctx.stroke(); ctx.restore();
}

/* ---------- the hawk ---------- */
// the wing is a little 3D rig seen from slightly below; `yaw` swings it round for a turn
function wingGeo(b, side, yaw = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), V = .32 * Math.abs(sy);   // head-on, the wings show their shallow V
  const SPAN = 31 * b.L, cp = .87, sp = .5, sh = [2, -2.2], th0 = b.theta + V, th1 = b.theta + b.bend + V;
  function at(s, xo) {
    const a = Math.min(s, .45) * SPAN; let y = -a * Math.sin(th0), z = a * Math.cos(th0);
    if (s > .45) { const hh = (s - .45) * SPAN; y -= hh * Math.sin(th1); z += hh * Math.cos(th1); }
    z *= side; const x = sh[0] + xo - s * s * 3.5 * b.L;
    return [x * cy - z * sy, sh[1] + y * cp + (x * sy + z * cy) * sp];
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

const layers = new Map();
function hawkLayer(G, b, P, k, id) {
  const R = 40 * (k || 1), px = G.view.px, n = Math.ceil(R * 2 * px);
  let L = layers.get(id);
  if (!L) { L = { c: document.createElement('canvas') }; layers.set(id, L); }
  if (L.c.width !== n) L.c.width = L.c.height = n;
  const x = L.c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, n, n);
  x.setTransform(px, 0, 0, px, (R - b.x) * px, (R - b.y) * px);
  drawHawk(x, b, P, G, k);
  L.x = b.x - R; L.y = b.y - R; L.w = R * 2;
  return L;
}
function drawHawk(ctx, b, P, G, k = 1) {
  if (b.state === 'fly') {
    // turning, the hawk swings square to the viewer and on round: yaw 0 is side-on, ±π/2 head-on
    let yaw = 0;
    if (b.yaw) { const u = Math.min(1, b.yaw.t / b.yaw.dur); yaw = (u < .5 ? u * Math.PI : u * Math.PI - Math.PI) * b.yawSgn; }
    else if (b.turnT > 0) yaw = (1 - b.turnT / .32) * Math.PI - Math.PI;   // other hawks: already facing the new way
    ctx.save(); ctx.translate(b.x, b.y + b.bob); ctx.scale(b.face * BS * k, BS * k);
    ctx.rotate(b.pitch * Math.cos(yaw)); flyingHawk(ctx, b, P, yaw);
    ctx.restore(); return;
  }
  const u = b.turnT > 0 ? 1 - b.turnT / .32 : 1;
  const xs = b.face * (b.turnT > 0 ? -Math.cos(u * Math.PI) : 1);
  const sx = Math.sign(xs) * Math.max(.18, Math.abs(xs));
  ctx.save(); ctx.translate(b.x, b.y + b.bob); ctx.scale(sx * BS * k, BS * k);
  sittingHawk(ctx, b, P, G);
  ctx.restore();
}

// A soaring red-tail seen from a little below: dark brown back and head, cream underparts
// with a streaky belly band, pale underwings with the dark leading-edge bar and dark
// fingertips, and the brick-red tail with its dark band. Light is paper left bare.
function flyingHawk(ctx, b, P, yaw = 0) {
  const fan = b.tailFan, a = .8, amp = 1.1, ink = P.birdFar;
  const tail = [[-8, -1.6], [-21, -3.2 - 3.6 * fan], [-23.6, .6], [-21, 3.8 + 3.2 * fan], [-8, 2.2]];
  const body = ellP(0, .3, 11.8, 4.3), head = circP(11.2, -2.2, 4, 12);
  const far = wingGeo(b, -1, yaw), near = wingGeo(b, 1, yaw);
  wash(ctx, far.outline, ink, a * .42, { passes: 1, amp, seed: 71, rim: .35 });
  wash(ctx, [...far.band(0), ...far.band(.22).reverse()], P.bird, a * .4, { passes: 1, amp: .6, seed: 70, rim: 0 });
  // the body foreshortens as it swings round (never quite to a line: head-on it is still round)
  const cy = Math.cos(yaw), bodyX = Math.sign(cy || 1) * Math.max(.3, Math.abs(cy));
  ctx.save(); ctx.scale(bodyX, 1);
  // paper under the body so the far wing never shows through it
  lift(ctx, body, P.paper, .95); lift(ctx, head, P.paper, .95); lift(ctx, tail, P.paper, .9);
  wash(ctx, tail, tailColour(b, P), a * .75, { passes: 2, amp, seed: 72, rim: .5 });
  const tb = u => [lerp(-8, -21, u), lerp(-1.6, -3.2 - 3.6 * fan, u), lerp(2.2, 3.8 + 3.2 * fan, u)];
  // the adult's one dark band near the tip; a young hawk's tail is barred all along
  for (const [u0, u1] of b.adult ? [[.78, .88]] : [[.3, .36], [.5, .56], [.7, .76], [.88, .94]]) {
    const [bx0, ya0, yb0] = tb(u0), [bx1, ya1, yb1] = tb(u1);
    wash(ctx, [[bx0, ya0], [bx1, ya1], [bx1, yb1], [bx0, yb0]], ink, a * (b.adult ? .35 : .28), { passes: 1, amp: .3, seed: 79, rim: 0 });
  }
  wash(ctx, body, P.bird, a, { passes: 2, amp, seed: 73, rim: .45 });
  // cream belly and the band of streaks across it
  lift(ctx, ellP(1.2, 2.4, 9.6, 2.5), P.paper, .7);
  wash(ctx, ellP(1.2, 2.4, 9.6, 2.5), P.birdPale, a * .35, { passes: 1, amp: .4, seed: 80, rim: 0 });
  ctx.fillStyle = C(ink, a * .45); ctx.beginPath();
  for (let k = 0; k < 6; k++) { const x = -3.5 + k * 1.5, y = 2.6 + (k % 2) * .6; ctx.moveTo(x + .9, y); ctx.ellipse(x, y, .9, .45, .5, 0, TAU); }
  ctx.fill();
  wash(ctx, head, P.bird, a, { passes: 2, amp: amp * .8, seed: 74, rim: .45 });
  wash(ctx, ellP(10.4, -4.1, 3.7, 1.9, -.1), ink, a * .35, { passes: 1, amp: .3, seed: 81, rim: 0 });
  lift(ctx, ellP(12.6, -.2, 1.8, 1.1, .2), P.paper, .45);
  beakAt(ctx, 14.3, -2.6, P, a);
  eye(ctx, 12.6, -3.3, P);
  ctx.restore();
  // the near wing, underside: pale with the dark bar on its leading edge and dark tips
  lift(ctx, near.outline, P.paper, .6);
  wash(ctx, near.outline, mix(P.birdPale, P.bird, .35), a * .6, { passes: 2, amp, seed: 76, rim: .6 });
  wash(ctx, [...near.band(0), ...near.band(.2).reverse()], ink, a * .5, { passes: 1, amp: .5, seed: 77, rim: .2 });
  wash(ctx, [...near.band(.78), ...near.band(1).reverse()], ink, a * .3, { passes: 1, amp, seed: 78, rim: 0 });
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(ink, a * .7); ctx.lineWidth = .7;
  ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.moveTo(...near.bases[k]); ctx.lineTo(...near.fingers[k]); } ctx.stroke();
  ctx.restore();
}

// a red-tail earns its red tail: until the first migration is flown the tail is barred brown
const tailColour = (b, P) => b.adult ? P.tail : mix(P.bird, P.birdPale, .3);
// hooked dark beak over a yellow cere
function beakAt(ctx, x, y, P, a) {
  const k = .78, q = pts => pts.map(([u, v]) => [x + u * k, y + v * k]);
  wash(ctx, q([[0, -1.5], [3.2, -.8], [4.2, .7], [3.7, 2], [3, 1], [.4, 1.5]]), P.birdFar, a * .85, { passes: 1, amp: .15, seed: 75, rim: .4 });
  wash(ctx, q([[-.3, -1.6], [1.3, -1.2], [1.3, 1.1], [-.3, 1.5]]), P.beak, a, { passes: 1, amp: .1, seed: 82, rim: .3 });
}

function eye(ctx, x, y, P) {
  ctx.fillStyle = C(P.birdFar); ctx.beginPath(); ctx.arc(x, y, .75, 0, TAU); ctx.fill();
  ctx.fillStyle = C(P.paper, .9); ctx.beginPath(); ctx.arc(x + .25, y - .25, .25, 0, TAU); ctx.fill();
  // the stern brow
  ctx.strokeStyle = C(P.birdFar, .6); ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(x - 1.4, y - .8); ctx.lineTo(x + 1.2, y - 1.1); ctx.stroke();
}

// perched, walking or swimming: wings folded along an upright body, cream breast to the front
function sittingHawk(ctx, b, P, G) {
  const mode = b.state, a = .82, ink = P.birdFar;
  const rot = mode === 'perch' ? -.75 : mode === 'ground' ? -.35 : -.12;
  const peck = b.peckT > 0 ? Math.sin((1 - b.peckT / .35) * Math.PI) : 0;
  const by = mode === 'swim' ? 1.2 : -1;
  const hx0 = mode === 'perch' ? 5.4 : 8, hy0 = mode === 'perch' ? -8.8 : -6;
  const hx = hx0 + peck * 3, hy = hy0 + peck * (mode === 'perch' ? 6 : 8);
  const tail = mode === 'perch' ? [[-3, 3], [-9, 14], [-6.2, 15.6], [-.5, 5]] : [[-6, 0], [-18, 1 + (mode === 'swim' ? -2 : 2)], [-17.5, 4], [-5, 3]];
  const body = ellP(0, by, 9.5, 5.4, rot);
  const wing = ellP(-1.8, by - .5, 9, 3.5, rot + .14);
  const head = circP(hx, hy, 4, 12);
  const R = (x, y) => [x * Math.cos(rot) - y * Math.sin(rot), by + x * Math.sin(rot) + y * Math.cos(rot)];
  // legs first so the body sits on them
  if (mode !== 'swim') {
    const step = b.moving ? Math.sin(b.walkPh) * 2.2 : 0;
    stroke(ctx, [[-.5, by + 3.5], [-1 + step, 6]], P.beak, .9, 1.1, 81);
    stroke(ctx, [[1.5, by + 3.5], [1.5 - step, 6]], P.beak, .9, 1.1, 82);
  }
  lift(ctx, body, P.paper, .95); lift(ctx, head, P.paper, .95);
  wash(ctx, tail, tailColour(b, P), a, { passes: 2, amp: .8, seed: 72, rim: .5 });
  if (mode === 'perch') {
    if (b.adult) wash(ctx, [[-7.6, 11.2], [-8.4, 12.8], [-5.6, 14.2], [-4.6, 12.6]], ink, a * .35, { passes: 1, amp: .2, seed: 79, rim: 0 });
    else for (let k = 0; k < 3; k++) { const u = .45 + k * .2; wash(ctx, [[lerp(-3, -9, u), lerp(3, 14, u)], [lerp(-3, -9, u + .06), lerp(3, 14, u + .06)], [lerp(-.5, -6.2, u + .06), lerp(5, 15.6, u + .06)], [lerp(-.5, -6.2, u), lerp(5, 15.6, u)]], ink, a * .28, { passes: 1, amp: .15, seed: 79 + k, rim: 0 }); }
  }
  wash(ctx, body, P.bird, a, { passes: 2, amp: 1, seed: 73, rim: .45 });
  // cream breast with a belly band of streaks
  const breast = ellP(...R(2.4, 2), 6, 3.1, rot);
  lift(ctx, breast, P.paper, .7);
  wash(ctx, breast, P.birdPale, a * .35, { passes: 1, amp: .3, seed: 80, rim: 0 });
  ctx.fillStyle = C(ink, a * .45); ctx.beginPath();
  for (let k = 0; k < 5; k++) { const [x, y] = R(-1 + k * 1.3, 3.6 + (k % 2) * .5); ctx.moveTo(x + .8, y); ctx.ellipse(x, y, .8, .4, rot + .6, 0, TAU); }
  ctx.fill();
  wash(ctx, wing, P.birdWing, a, { passes: 2, amp: .9, seed: 76, rim: .55 });
  // pale-edged feathers on the folded wing
  ctx.fillStyle = C(P.paper, .28); ctx.beginPath();
  for (let k = 0; k < 4; k++) { const [x, y] = R(-4 + k * 2.4, -1.4 + (k % 2) * 1.1); ctx.moveTo(x + .9, y); ctx.ellipse(x, y, .9, .25, rot + .1, 0, TAU); }
  ctx.fill();
  wash(ctx, [[-6 + Math.cos(rot) * -2, by + 2], [-14, by + (mode === 'perch' ? 9 : 1.5)], [-5, by + 4]], ink, a * .6, { passes: 1, amp: .5, seed: 78, rim: .3 });
  wash(ctx, head, P.bird, a, { passes: 2, amp: .8, seed: 74, rim: .45 });
  wash(ctx, ellP(hx - .6, hy - 1.9, 3.6, 1.9, -.1), ink, a * .35, { passes: 1, amp: .3, seed: 83, rim: 0 });
  lift(ctx, ellP(hx + 1.2, hy + 2.3, 1.6, 1, .3), P.paper, .4);
  beakAt(ctx, hx + 3.1, hy - .2, P, a);
  eye(ctx, hx + 1.6, hy - 1, P);
  if (mode === 'swim') {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .7), .5); ctx.lineWidth = .7;
    const r = 1 + (G.t * 6) % 6;
    ctx.beginPath(); ctx.ellipse(0, 4.5, 11 + r, 1.4 + r * .15, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

// Phone GPUs pay for every blended draw, so the flecks go out as one path per strength level.
function streaks(ctx, G, P) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = .7;
  for (let lv = 1; lv <= 3; lv++) {
    ctx.beginPath(); let any = false;
    for (const s of G.streaks) {
      if (s.trail.length < 3) continue;
      const k = Math.sin(Math.PI * s.life / s.max);
      if (Math.min(3, Math.ceil(k * 3)) !== lv) continue;
      const t = s.trail; ctx.moveTo(t[0][0], t[0][1]); for (let i = 1; i < t.length; i++) ctx.lineTo(t[i][0], t[i][1]); any = true;
    }
    if (any) { ctx.strokeStyle = C(P.birdFar, .16 * (lv - .5) / 3); ctx.stroke(); }
  }
  ctx.restore();
}

// a faint dotted arc to where the current glide would land
function glideLine(ctx, pts, P, G) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C(P.birdFar, .5);
  const n = pts.length;
  for (let g = 0; g < 3; g++) {
    ctx.beginPath();
    for (let i = 3; i < n; i += 3) { if (Math.min(2, Math.floor(i / n * 3)) !== g) continue; ctx.moveTo(pts[i][0] + .8, pts[i][1]); ctx.arc(pts[i][0], pts[i][1], .8, 0, TAU); }
    ctx.globalAlpha = .2 + .5 * (1 - (g + .5) / 3); ctx.fill();
  }
  if (pts.end) { const e = pts[n - 1]; ctx.globalAlpha = .5; ctx.strokeStyle = C(P.birdFar, .6); ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(e[0], e[1] + 5, 5, 1.6, 0, 0, TAU); ctx.stroke(); }
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
    ctx.save(); ctx.fillStyle = C(P.paper, .85); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 22 + hash(i * 7.1) * 20, y = (hash(i * 2.3) * (h + 20) + G.t * sp) % (h + 20) - 10;
      const x = ((hash(i * 5.9) * (w + 40) + G.t * G.wind * .8 + Math.sin(G.t + i) * 6 - G.cam.x * .3) % (w + 40) + w + 40) % (w + 40) - 20, r = .7 + hash(i) * .8;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill(); ctx.restore(); return;
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
