// The art for air.js: lens clouds over the mountains, kettles of wild hawks, the cumulus at the
// cloudbase with the tunnels carved through them, and the grass and leaves streaming up a ridge
// where the wind meets it. Everything is a cached stamp laid down with plain alpha, or one fill.
import { TAU, clamp, hash, C, shade, mix } from './util.js';
import { wash, circP, ellP, stamp, put, softWash } from './paint.js';
import * as W from './world.js';
import { airEnv, lensesIn, kettlesIn, cumuliIn, HEAL, CARVE_R } from './air.js';

const q = c => c.map(v => v >> 3).join();

/* ---------- ridge lift: where the wind meets a hillside ---------- */
// The strength of the ridge lift along the ground, sampled every 40 units once a frame; the
// grass leans and flutters with it, and leaves stream up the face and off the crest.
const RC = 40;
let field = { i0: 0, v: [] };
export function ridgeField(G, x0, x1) {
  const i0 = Math.floor(x0 / RC), v = [];
  for (let i = i0; i <= Math.ceil(x1 / RC) + 1; i++) { const x = i * RC; v.push(W.ridgeLift(x, W.groundY(x) - 30)); }
  field = { i0, v };
}
// how far the grass at x leans downwind (world units at its tip)
export function streamAt(x, t, i) {
  const f = field.v, k = Math.floor(x / RC) - field.i0;
  const s = f[k] === undefined ? 0 : f[k] + ((f[k + 1] ?? f[k]) - f[k]) * (x / RC - Math.floor(x / RC));
  if (s < 1.5) return 0;
  const a = Math.min(1, s / 14);
  return Math.sign(W.env.wind) * a * (2.2 + Math.sin(t * 9 + i * 1.7) * .9);
}
export function ridgeLeaves(ctx, G, P) {
  const f = field.v, dir = Math.sign(W.env.wind) || 1, col = mix(P.leafDk, P.leafHi, .35);
  ctx.save();
  for (let lv = 1; lv <= 2; lv++) {
    ctx.beginPath();
    for (let k = 0; k < f.length; k++) {
      const s = f[k]; if (s < 4) continue;
      const i = field.i0 + k, n = s > 10 ? 3 : 2;
      for (let j = 0; j < n; j++) {
        const rate = .32 + .18 * hash(i * 3.1 + j), u = (G.t * rate + hash(i * 7.7 + j * 2.9)) % 1;
        const fade = Math.sin(u * Math.PI);
        if ((fade < .5) !== (lv === 1)) continue;
        // up the face close to the grass, then lifting off past the crest
        const lx = i * RC + hash(i + j * 5) * RC + dir * u * 150, ly = W.groundY(lx) - 4 - u * u * 80 + Math.sin(G.t * 3 + j) * 2;
        const rot = G.t * (4 + j) + i, l = 2.6 + 1.4 * hash(i * 2.3 + j), wd = l * (.25 + .3 * Math.abs(Math.cos(rot * 1.3)));
        ctx.moveTo(lx + Math.cos(rot) * l, ly + Math.sin(rot) * l); ctx.ellipse(lx, ly, l, wd, rot, 0, TAU);
      }
    }
    ctx.fillStyle = C(col, lv === 1 ? .4 : .85); ctx.fill();
  }
  ctx.restore();
}

/* ---------- lens clouds ---------- */
// A lenticular: long and smooth, a stack of two or three thin plates of bare paper, warmed
// underneath by the low evening sun.
export function lenses(ctx, G, P, x0, x1) {
  const a = airEnv.wave; if (a <= 0) return;
  const warm = mix(P.cloudShade, P.sun, .35);
  for (const c of lensesIn(x0, x1)) {
    const L = c.len, s = stamp(c.id, q(P.paper) + q(warm), -L, -40, L, 30, G.view.spx * .6, x => {
      const plates = 2 + (c.seed % 2);
      for (let p = 0; p < plates; p++) {
        const l = L * (1 - p * .2), th = 9 - p * 2, y = -p * 13, pts = [];
        for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([-l + 2 * l * u, y - th * Math.pow(Math.sin(u * Math.PI), .7)]); }
        for (let i = 24; i >= 0; i--) { const u = i / 24; pts.push([-l + 2 * l * u, y + th * .45 * Math.pow(Math.sin(u * Math.PI), .9)]); }
        x.globalCompositeOperation = 'source-over'; x.fillStyle = C(P.paper, .92); x.beginPath(); pts.forEach((pt, i) => i ? x.lineTo(...pt) : x.moveTo(...pt)); x.fill();
        wash(x, pts.slice(25).concat([[l * .7, y], [-l * .7, y]]), warm, .32, { passes: 2, amp: 1.2, seed: c.seed + p, rim: .25 });
      }
    });
    ctx.save(); ctx.translate(c.x, c.y + Math.sin(G.t * .05 + c.seed) * 3); put(ctx, s, a * .95); ctx.restore();
  }
}

/* ---------- kettles ---------- */
// a wild hawk soaring, seen a little from below: broad pale wings with dark edges, a rufous
// fanned tail. One stamp, turned and scaled for each bird.
function wildHawk(P, spx) {
  return stamp('kettlehawk', q(P.bird) + q(P.birdPale) + q(P.tail), -17, -14, 13, 13, spx * 1.4, x => {
    // far wing raised behind the body, its upper side brown, fingered at the tip
    wash(x, [[3, -1.5], [-1, -7], [-5, -11.5], [-8, -13], [-9.5, -12], [-10.5, -10.5], [-11, -9], [-8, -5], [-4, -.5]], shade(P.bird, .95), .8, { passes: 2, amp: .35, seed: 3, rim: .5 });
    // a short fanned rufous tail
    wash(x, [[-6, -1], [-13, -3.2], [-14.5, -.5], [-13.5, 2.4], [-6, 1.6]], P.tail, .85, { passes: 2, amp: .3, seed: 5, rim: .45 });
    // body and dark-capped head
    wash(x, [[9, -.8], [6, -2.8], [-1, -2.6], [-7, -.4], [-1, 2.6], [6, 1.8]], P.bird, .9, { passes: 2, amp: .35, seed: 1, rim: .5 });
    wash(x, circP(8.4, -1, 2.4, 9), shade(P.bird, .75), .9, { passes: 1, amp: .2, seed: 2, rim: .4 });
    // near wing, the long pale underside, with a dark trailing edge and tip
    wash(x, [[4, .5], [0, 2], [-4, 6], [-8, 10], [-11, 12], [-12.5, 11], [-11, 8.5], [-7, 3.5], [-3, 0]], P.birdPale, .85, { passes: 2, amp: .35, seed: 4, rim: .35 });
    wash(x, [[-8, 10], [-11, 12], [-12.5, 11], [-11, 8.5], [-9.5, 9]], shade(P.bird, .65), .8, { passes: 1, amp: .2, seed: 6, rim: .3 });
    wash(x, [[-3, 0], [-7, 3.5], [-11, 8.5], [-10, 8.8], [-6.5, 4.6], [-2.6, 1.2]], shade(P.bird, .8), .55, { passes: 1, amp: .2, seed: 7, rim: 0 });
  });
}
export function kettles(ctx, G, P, x0, x1) {
  const ks = kettlesIn(x0, x1, G); if (!ks.length) return;
  const s = wildHawk(P, G.view.spx);
  for (const K of ks) {
    // the farther side of the circle first, smaller and paler
    K.hawks.sort((a, b) => a.z - b.z);
    for (const h of K.hawks) {
      const k = 1.45 * h.z;
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.bank * h.face * .6); ctx.scale(h.face * k, k * (1 - Math.abs(h.bank) * .4));
      put(ctx, s, .55 + .45 * h.z); ctx.restore();
    }
  }
}

/* ---------- cumulus and the tunnels through them ---------- */
const carved = new Map();
function cloudArt(c, P, G) {
  const W0 = c.w * .8, H0 = c.h;
  return stamp(c.id, q(P.paper) + q(P.cloudShade) + Math.round(G.storm * 4), -W0, -H0 * .9, W0, H0 * .35, G.view.spx * .5, x => {
    // puffs heaped into a dome over a flat base, bare paper; the belly and the shaded side washed grey
    const n = 9 + (c.seed & 3), puffs = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), r = H0 * (.22 + .2 * Math.sin(u * Math.PI)) * (.8 + .4 * hash(c.seed * 3 + i));
      puffs.push([(u - .5) * W0 * 1.35, -Math.sin(u * Math.PI) * H0 * .3 + H0 * .05 + (hash(c.seed + i) - .5) * 8, r]);
    }
    for (let i = 0; i < 7; i++) { const u = (i + .5) / 7; puffs.push([(u - .5) * W0 * 1.2, H0 * .12, H0 * (.15 + .04 * hash(c.seed * 7 + i))]); }   // the flat underside
    for (let i = 0; i < 4; i++) { const u = (i + .5) / 4; puffs.push([(u - .5) * W0 * .8, -H0 * .42 - hash(c.seed * 5 + i) * H0 * .12, H0 * (.2 + .08 * hash(i + c.seed))]); }
    x.save(); x.beginPath(); x.rect(-W0, -H0, W0 * 2, H0 * 1.28); x.clip();   // a flat base
    x.fillStyle = C(P.paper, .96); x.beginPath();
    for (const [px, py, r] of puffs) { x.moveTo(px + r, py); x.arc(px, py, r, 0, TAU); }
    x.fill();
    x.globalCompositeOperation = 'source-atop';
    const g = x.createLinearGradient(0, -H0 * .5, 0, H0 * .28);
    g.addColorStop(0, C(P.cloudShade, 0)); g.addColorStop(.5, C(P.cloudShade, .22 + G.storm * .3)); g.addColorStop(1, C(P.cloudShade, .6 + G.storm * .3));
    x.fillStyle = g; x.fillRect(-W0, -H0, W0 * 2, H0 * 1.3);
    x.restore();
    x.globalCompositeOperation = 'source-atop';
    for (const [px, py, r] of puffs) softWash(x, px + r * .3, py + r * .35, r * .9, r * .5, P.cloudShade, .12);
  });
}
// the cloud with any tunnel cut out of it: the base art copied onto its own canvas, then the
// hawk's path erased in soft circles that shrink as the tunnel heals
function carvedArt(s, c, pts, G) {
  let L = carved.get(c.id);
  if (!L) { L = { c: document.createElement('canvas'), at: -1 }; carved.set(c.id, L); }
  const cv = L.c;
  if (cv.width !== s.c.width || cv.height !== s.c.height) { cv.width = s.c.width; cv.height = s.c.height; L.at = -1; }
  // while the hawk is inside it changes every frame; healing alone, a few times a second is plenty
  const last = pts[pts.length - 1].t;
  if (G.t - L.at < (G.t - last < .2 ? 0 : .25)) return cv;
  L.at = G.t;
  const x = cv.getContext('2d'), k = cv.width / s.w;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(s.c, 0, 0);
  x.setTransform(k, 0, 0, k, -(c.x + s.x0) * k, -(c.y + s.y0) * k);
  // first a grey shadow round the tunnel's edge, so the hollow reads, then the hollow itself
  for (const [rk, a, op] of [[1.7, .3, 'source-atop'], [1.3, .5, 'destination-out'], [1, .95, 'destination-out']]) {
    x.globalCompositeOperation = op;
    x.fillStyle = op === 'source-atop' ? C(G.P.cloudShade, a) : `rgba(0,0,0,${a})`; x.beginPath();
    for (const p of pts) {
      const age = G.t - p.t, r = CARVE_R * rk * (1 - age / HEAL) * (.85 + .3 * hash(p.x * .1));
      if (r > .5) { x.moveTo(p.x + r, p.y); x.arc(p.x, p.y, r, 0, TAU); }
    }
    x.fill();
  }
  return cv;
}
export function cumuli(ctx, G, P, x0, x1) {
  const vis = clamp(G.thermalK * 1.6, 0, 1) * (1 - G.overcast * .5);
  for (const id of carved.keys()) if (!G.carve?.has(id)) carved.delete(id);
  if (vis <= .02) return;
  for (const c of cumuliIn(x0, x1)) {
    const s = cloudArt(c, P, G), pts = G.carve?.get(c.id);
    ctx.save(); ctx.translate(c.x, c.y);
    if (pts?.length) { const a = ctx.globalAlpha; ctx.globalAlpha = a * vis; ctx.drawImage(carvedArt(s, c, pts, G), s.x0, s.y0, s.w, s.h); ctx.globalAlpha = a; }
    else put(ctx, s, vis);
    ctx.restore();
  }
}
