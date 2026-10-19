// Big skies. Storm riding: when the weather turns stormy a thunderstorm cell drifts over the
// land, and ahead of its rain curtain the gust front shoves air upward hard enough for the climb
// of the journey; under the curtain itself the air sinks and the rain lashes. Sea of cloud: on
// some still mornings after a clear night, an inversion leaves a white floor of cloud over the
// valleys; climb through it and the world is cloud tops and peaks, silent and gold, until the sun
// burns it off by mid-morning.
import { TAU, clamp, lerp, smooth, hash, fbm, C, mix, shade } from './util.js';
import * as W from './world.js';

export const createSkies = () => ({ cell: null, inv: null, invDay: -1, above: 0, fog: 0 });

/* ---------- the storm cell ---------- */
const CURTAIN = 160, FRONT = 320, FRONT_W = 220, BASE = -330;
const frontX = c => c.x + c.dir * FRONT;
// the gust front's lift, and the sinking air under the rain
function stormLift(x, y) {
  const c = S.cell; if (!c || c.k <= 0) return 0;
  const gy = W.groundY(x), up = gy - y;
  if (up < 10) return 0;
  const d = Math.abs(x - frontX(c)) / FRONT_W;
  let v = 0;
  if (d < 1) {
    const bell = .5 + .5 * Math.cos(d * Math.PI);
    v = 88 * bell * smooth(10, 60, up) * (1 - smooth(1050, 1350, -y));
  }
  if (Math.abs(x - c.x) < CURTAIN && y > BASE) v -= 26 * smooth(CURTAIN, CURTAIN * .6, Math.abs(x - c.x));
  return v * c.k;
}
let S = null;

function updateStorm(G, dt, { once, haptics, audio }) {
  const b = G.bird;
  if (!S.cell && G.weather === 'stormy' && G.sea.winter < .5 && G.t > 30) {
    // it comes from upwind, toward you
    const dir = Math.sign(G.wind) || 1;
    S.cell = { x: b.x - dir * 900, dir, v: 15 * dir, k: 0, life: 0 };
  }
  const c = S.cell; if (!c) return;
  c.life += dt; c.x += c.v * dt;
  const dying = G.weather !== 'stormy' && G.storm < .4 || Math.abs(c.x - b.x) > 2600;
  c.k = clamp(c.k + (dying ? -dt / 8 : dt / 6), 0, 1);
  if (dying && c.k <= 0) { S.cell = null; return; }
  if (b.state !== 'fly') return;
  const inFront = Math.abs(b.x - frontX(c)) < FRONT_W * .8, under = Math.abs(b.x - c.x) < CURTAIN && b.y > BASE;
  if (inFront && c.k > .5) once('storm', 'A thunderstorm\'s gust front: the air ahead of the rain is surging upward. Ride it high, and stay ahead of the rain.', 6);
  if (under) {
    once('stormrain', 'Under the storm: lashing rain and sinking air. Get out ahead of it, or above it.', 5);
    // gusts buffet you, and the lightning is close
    if (Math.random() < dt * 1.5) { b.kick += (Math.random() - .3) * 30; haptics.jolt?.(); }
    if (Math.random() < dt * .12) { G.flash = 1; audio.thunder?.(.3); }
  }
}

/* ---------- the inversion ---------- */
function updateInversion(G, dt, { once }) {
  const b = G.bird;
  if (G.tod > .19 && G.tod < .3 && S.invDay !== G.day) {
    S.invDay = G.day;
    const still = G.overcast < .3 && G.storm < .1 && G.sea.winter < .8;
    S.inv = still && hash(G.day * 7.31 + W.seed.v * .37) < .3 ? { top: -250 - 40 * hash(G.day * 3.1), seed: G.day } : null;
  }
  const I = S.inv;
  if (!I) { S.above = 0; S.fog = 0; return; }
  // it thins and sinks into the valleys as the sun gets up
  const burn = smooth(.33, .46, G.tod);
  I.y = I.top + 140 * burn; I.k = (1 - burn) * smooth(.17, .22, G.tod) * (G.storm < .3 ? 1 : 0);
  if (G.tod > .5 || G.tod < .15) { S.inv = null; return; }
  const rel = b.y - I.y;   // negative above the top
  S.above = I.k * smooth(5, -30, rel);
  S.fog = I.k * (rel > -25 && rel < 90 ? smooth(-25, 5, rel) * (1 - smooth(60, 90, rel) * .55) : 0);
  if (S.above > .6) once('cloudsea', 'A sea of cloud. Above the morning inversion it is silent and gold; the sun burns it away by mid-morning.', 6);
  else if (I.k > .5 && rel > 20 && b.state === 'fly') once('inversion', 'Low cloud this morning, lying in the valleys. Climb up through it.', 5);
}

export function updateSkies(G, dt, deps) { S = G.skies; updateStorm(G, dt, deps); updateInversion(G, dt, deps); }
// how quiet the world should be: above the cloud sea, only the wind
export const hush = G => G.skies?.above || 0;
// things in the air below the cloud floor are hidden while you are above it
export const underSea = (G, y) => G.skies?.inv && G.skies.above > .5 && y > G.skies.inv.y;
export const extraLift = (x, y) => S ? stormLift(x, y) : 0;
W.extraLifts.push(extraLift);

/* ---------- drawing ---------- */
// world space, behind the hawks
export function drawSkies(ctx, G, P) {
  S = G.skies; if (!S) return;
  if (S.cell) drawStorm(ctx, G, P, S.cell);
  if (S.inv && S.inv.k > .01) drawSea(ctx, G, P, S.inv);
}
function drawStorm(ctx, G, P, c) {
  const k = c.k, x0 = G.cam.x - 60, x1 = G.cam.x + G.view.w + 60;
  const a = Math.min(c.x - CURTAIN - 60, frontX(c) - FRONT_W), b2 = Math.max(c.x + CURTAIN + 60, frontX(c) + FRONT_W);
  if (b2 < x0 - 400 || a > x1 + 400) return;
  const dark = mix(P.cloudShade, P.birdFar, .4), t = G.t;
  // the tower: a great bumpy column of cloud above the cell, with an anvil spreading at the top
  ctx.save(); ctx.globalAlpha = .5 * k; ctx.fillStyle = C(mix(dark, P.paper, .35)); ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const u = i / 8, y = lerp(BASE - 20, -1300, u), w = lerp(150, 120, u) + (u > .8 ? (u - .8) * 1800 : 0);
    const r = 70 + 30 * hash(i * 3.1), cx = c.x + Math.sin(i * 1.7) * 25 + (u > .8 ? c.dir * (u - .8) * 600 : 0);
    ctx.moveTo(cx + w, y); ctx.ellipse(cx, y, w, r, 0, 0, TAU);
  }
  ctx.fill();
  // the dark shelf cloud along its base, running out ahead over the gust front
  ctx.globalAlpha = .6 * k; ctx.fillStyle = C(dark); ctx.beginPath();
  const s0 = c.x - c.dir * (CURTAIN + 60), s1 = frontX(c) + c.dir * FRONT_W * .7, lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  ctx.moveTo(lo, BASE - 40);
  for (let x = lo; x <= hi; x += 20) ctx.lineTo(x, BASE - 40 - 14 * Math.abs(fbm(x / 60 + t * .05, 71)));
  for (let x = hi; x >= lo; x -= 20) { const ahead = (x - c.x) * c.dir > CURTAIN; ctx.lineTo(x, BASE + 6 * fbm(x / 40 + t * .1, 72) + (ahead ? 10 + 8 * Math.sin(x / 30 + t) : 0)); }
  ctx.fill();
  // the rain curtain: a grey veil from the cloud base to the ground, streaked
  const gy = W.groundY(Math.round(c.x));
  const g = ctx.createLinearGradient(0, BASE, 0, gy);
  g.addColorStop(0, C(shade(P.water, .7), .4 * k)); g.addColorStop(1, C(shade(P.water, .8), .18 * k));
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(c.x - CURTAIN, BASE, CURTAIN * 2, gy - BASE + 20);
  ctx.strokeStyle = C(shade(P.water, .6), .25 * k); ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 26; i++) { const x = c.x - CURTAIN + hash(i * 4.7) * CURTAIN * 2, y = BASE + ((hash(i * 2.3) * 400 + t * 220) % (gy - BASE)); ctx.moveTo(x, y); ctx.lineTo(x + c.dir * 4, y + 26); }
  ctx.stroke();
  // ragged scud torn upward along the gust front: you can see where the air is rising
  ctx.fillStyle = C(mix(P.paper, P.cloudShade, .3), .55 * k); ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const fx = frontX(c) + (hash(i * 6.1) - .5) * FRONT_W * 1.4, gyy = W.groundY(Math.round(fx));
    const span = gyy - 40 - BASE, y = gyy - 40 - ((hash(i * 1.3) * span + t * 60) % span);
    ctx.moveTo(fx + 9, y); ctx.ellipse(fx, y, 9, 3.5, 0, 0, TAU);
  }
  ctx.fill(); ctx.restore();
}
function drawSea(ctx, G, P, I) {
  const x0 = G.cam.x - 60, x1 = G.cam.x + G.view.w + 60, top = I.y, drift = G.t * .02;
  // a row of soft domes, slowly drifting
  const edge = x => {
    const xx = x - G.t * 2, i = Math.floor(xx / 90), u = xx / 90 - i, h = 9 + 22 * hash(i * 1.7 + I.seed);
    return top - 4 - h * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) - 3 * fbm(x / 40 + drift, I.seed + 4);
  };
  ctx.save();
  if (S.above > .01) {
    // from above: a bright floor of cloud tops to the bottom of the view, peaks rising out of it
    const bottom = G.cam.y + G.view.h + 60;
    ctx.globalAlpha = .94 * S.above; ctx.fillStyle = C(mix(P.paper, P.horizon, .12)); ctx.beginPath();
    ctx.moveTo(x0, bottom); for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, edge(x)); ctx.lineTo(x1, bottom); ctx.fill();
    // soft shadows in the hollows between the domes
    ctx.globalAlpha = .35 * S.above; ctx.strokeStyle = C(P.cloudShade); ctx.lineWidth = 2; ctx.beginPath();
    for (let x = x0; x <= x1; x += 6) { const y = edge(x) + 6 + (top - edge(x)) * .4; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  if (S.above < .99) {
    // from below: a grey ceiling with a ragged underside
    ctx.globalAlpha = .55 * I.k * (1 - S.above); ctx.fillStyle = C(mix(P.cloudShade, P.paper, .4)); ctx.beginPath();
    ctx.moveTo(x0, top - 200); ctx.lineTo(x1, top - 200);
    for (let x = x1; x >= x0; x -= 16) ctx.lineTo(x, top + 55 + 10 * fbm(x / 50 + drift, I.seed + 5));
    ctx.fill();
  }
  ctx.restore();
}
// screen space, over everything: the fog inside the cloud, and the gold light above it
export function drawSkiesScreen(ctx, G, P, w, h) {
  S = G.skies; if (!S) return;
  if (S.above > .01) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C(P.sun, 0)); g.addColorStop(.6, C(P.sun, .16 * S.above)); g.addColorStop(1, C(P.sun, .05 * S.above));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (S.fog > .01) { ctx.fillStyle = C(mix(P.paper, P.cloudShade, .2), .85 * S.fog); ctx.fillRect(0, 0, w, h); }
}

export function skiesDebug(G, { fresh, snap }) {
  return {
    storm() { G.dbg.weather('stormy'); G.skies.cell = null; const b = G.bird, dir = 1; G.skies.cell = { x: b.x - dir * (FRONT + 40), dir, v: 15 * dir, k: 1, life: 0 }; },
    cloudsea() { G.dbg.time(.24); G.dbg.weather('sunny'); G.skies.invDay = G.day; G.skies.inv = { top: -260, seed: G.day }; },
  };
}
