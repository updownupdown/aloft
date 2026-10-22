// The hawk, built in code each frame from a pose: a red-tail with a brown back, cream belly
// with a streaked band, dark patagial bars and wrist commas under pale wings, slotted
// primaries and a rufous tail. Faces carry a top and an underside colour; the shader picks by
// which side faces the camera, so a bank shows the pale underwing.
// Model space: x right, y up, z forward (beak at +z). One unit is roughly 0.6 m.
// Other birds to fly as (birds.js): Settings > Bird picks one (sys/species.js); ?bird=swift etc. tries any.
import { BIRDS, buildBird } from './birds.js';

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const C = {
  back: hex('#6e4a2f'), side: hex('#8a6240'), belly: hex('#efe3c8'), band: hex('#7a5638'), cap: hex('#4b3322'), throat: hex('#f3ead8'),
  covert: hex('#7b5434'), hand: hex('#5e3f27'), prim: hex('#4a3322'), primTip: hex('#2a1d14'), lead: hex('#6b4a2e'),
  under: hex('#efe4cc'), bar: hex('#3a2a1f'), handUnder: hex('#e4dacb'), comma: hex('#3f2c1e'), primUnder: hex('#d6cec0'), tipUnder: hex('#3a2c22'),
  tail: hex('#b5562c'), tailBand: hex('#3a2418'), tailTip: hex('#eadbc2'), tailUnder: hex('#ead2c2'),
  beak: hex('#3a3430'), cere: hex('#e0b23a'), eye: hex('#1e1612'), shine: hex('#9a8a78'), leg: hex('#d8a838'), talon: hex('#2a2420'), cheek: hex('#7a5a3e'), thigh: hex('#e9dcc0'),
};

export const HAWK_SCALE = .62;
const asked = new URLSearchParams(globalThis.location?.search || '').get('bird');
export let BIRD = BIRDS[asked] ? asked : 'hawk';
export const setBird = id => { BIRD = BIRDS[id] ? id : 'hawk'; };
const buf = new Float32Array(8000 * 12);
let o = 0;

function tri(a, b, c, top, bot, up) {
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (up && nx * up[0] + ny * up[1] + nz * up[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  for (const p of [a, b, c]) {
    buf[o++] = p[0]; buf[o++] = p[1]; buf[o++] = p[2]; buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
    buf[o++] = top[0]; buf[o++] = top[1]; buf[o++] = top[2]; buf[o++] = bot[0]; buf[o++] = bot[1]; buf[o++] = bot[2];
  }
}
const quad = (a, b, c, d, top, bot, up) => { tri(a, b, c, top, bot, up); tri(a, c, d, top, bot, up); };

// pose: { flapL/flapR (rad, + up), handL/handR (rad, extra at the wrist), fold 0..1, flare 0..1, legs 0..1, tail 0..1 fan, t }
export function buildHawk(pose, bird = BIRD) {
  if (bird !== 'hawk') return buildBird(bird, pose);
  if (!bodyMesh) { o = 0; body(); bodyMesh = buf.slice(0, o); }   // the body never changes: build it once
  buf.set(bodyMesh); o = bodyMesh.length;
  if (pose.headYaw || pose.headPitch || pose.fluff) bend(pose);
  wing(pose, 1); wing(pose, -1);
  tail(pose);
  if (pose.legs > .02) {   // legs depend only on how far they hang: cache them in 20 steps
    const k = Math.round(pose.legs * 20);
    let m = legCache.get(k);
    if (!m) { const o0 = o; legs({ legs: k / 20 }); m = buf.slice(o0, o); legCache.set(k, m); o = o0; }
    buf.set(m, o); o += m.length;
  }
  return buf.subarray(0, o);
}

// the head turns on the neck (headYaw: + to the hawk's left, headPitch: + down, radians), the neck
// easing between body and head; fluff (0..1) puffs the whole body out, as in rain or a rouse
function bend(p) {
  const yaw = p.headYaw || 0, pitch = p.headPitch || 0, puff = 1 + (p.fluff || 0) * .14, PY = .03, PZ = .19;
  for (let i = 0; i < bodyMesh.length; i += 12) {
    let x = buf[i] * puff, y = buf[i + 1] * puff, z = buf[i + 2], nx = buf[i + 3], ny = buf[i + 4], nz = buf[i + 5];
    const w = Math.min(1, Math.max(0, (z - .15) / .09)), k = w * w * (3 - 2 * w);
    if (k > 0) {
      const cp = Math.cos(pitch * k), sp = Math.sin(pitch * k), cy = Math.cos(yaw * k), sy = Math.sin(yaw * k);
      let ry = y - PY, rz = z - PZ;
      [ry, rz] = [ry * cp - rz * sp, ry * sp + rz * cp];
      let n1 = ny * cp - nz * sp, n2 = ny * sp + nz * cp; ny = n1; nz = n2;
      [x, rz] = [x * cy + rz * sy, -x * sy + rz * cy];
      n1 = nx * cy + nz * sy; n2 = -nx * sy + nz * cy; nx = n1; nz = n2;
      y = ry + PY; z = rz + PZ;
    }
    buf[i] = x; buf[i + 1] = y; buf[i + 2] = z; buf[i + 3] = nx; buf[i + 4] = ny; buf[i + 5] = nz;
  }
}

const mix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// a faint per-facet shade so the plumage reads as feathers, not plastic
const jit = (c, k) => { const h = Math.sin(k * 127.1 + 31.7) * 43758.5, v = 1 + ((h - Math.floor(h)) - .5) * .09; return [c[0] * v, c[1] * v, c[2] * v]; };

// the body's profile: z, half width, half height, centre y; smoothed between stations
const R = [[-.3, .05, .035, .01], [-.18, .09, .075, 0], [-.02, .115, .1, -.01], [.12, .1, .095, 0], [.21, .07, .072, .028], [.27, .07, .072, .048], [.33, .056, .058, .046], [.37, .034, .038, .038]];
const cr = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
function station(t) {
  const i = Math.min(R.length - 2, Math.floor(t)), f = t - i, g = j => R[Math.max(0, Math.min(R.length - 1, j))];
  return [0, 1, 2, 3].map(c => cr(g(i - 1)[c], g(i)[c], g(i + 1)[c], g(i + 2)[c], f));
}
const SIDES = 12, STEPS = 3;
let bodyMesh = null;
const legCache = new Map();

function body() {
  const n = (R.length - 1) * STEPS + 1, rings = [];
  for (let j = 0; j < n; j++) {
    const [z, w, h, y] = station(j / STEPS);
    rings.push(Array.from({ length: SIDES }, (_, k) => {
      const a = k / SIDES * Math.PI * 2, s = Math.sin(a);
      // a flatter back, a rounder breast; the crown sits a little high
      return [Math.cos(a) * w, y + s * h * (s > 0 ? .92 : 1.05), z];
    }));
  }
  for (let j = 0; j < n - 1; j++) for (let k = 0; k < SIDES; k++) {
    const k2 = (k + 1) % SIDES, a = rings[j][k], b = rings[j][k2], c = rings[j + 1][k2], d = rings[j + 1][k];
    const s = Math.sin((k + .5) / SIDES * Math.PI * 2), z = (a[2] + c[2]) / 2;
    let col;
    if (z > .21) col = s > .15 ? C.cap : s > -.45 ? C.cheek : C.throat;   // dark cap, brown cheek, pale throat
    else if (s > .35) col = (j + k) % 3 ? C.back : mixc(C.back, C.side, .45);   // mottled mantle
    else if (s > -.35) col = C.side;
    else col = z > -.12 && z < .05 && (j + k) % 2 ? C.band : C.belly;           // the streaked belly band
    col = jit(col, j * 13 + k * 7);
    quad(a, d, c, b, col, col);
  }
  // the hooked beak: a yellow cere, then a dark bill curving down to the hook
  const last = rings[n - 1], [z0, w0, h0, y0] = R[R.length - 1];
  const B = [[.72, .02, -.004, C.cere], [.5, .05, -.01, C.beak], [.3, .072, -.022, C.beak]].map(([sc, dz, dy, col]) => ({ col, pts: Array.from({ length: SIDES }, (_, k) => {
    const a = k / SIDES * Math.PI * 2; return [Math.cos(a) * w0 * sc, y0 + dy + Math.sin(a) * h0 * sc, z0 + dz];
  }) }));
  let prev = last;
  for (const r of B) { for (let k = 0; k < SIDES; k++) { const k2 = (k + 1) % SIDES; quad(prev[k], r.pts[k], r.pts[k2], prev[k2], r.col, r.col); } prev = r.pts; }
  const tip = [0, y0 - .048, z0 + .088];
  for (let k = 0; k < SIDES; k++) tri(prev[k], tip, prev[(k + 1) % SIDES], C.beak, C.beak);
  // eyes under a stern brow
  const [ez, ew, eh, ey] = station(5.25);
  for (const sx of [1, -1]) {
    const c = [sx * (ew * .94 + .006), ey + eh * .3, ez], r = .016;
    const pt = a => [c[0], c[1] + Math.sin(a) * r, c[2] + Math.cos(a) * r * 1.15];
    for (let i = 0; i < 6; i++) tri(c, pt(i / 6 * Math.PI * 2), pt((i + 1) / 6 * Math.PI * 2), C.eye, C.eye);
    tri([c[0] + sx * .001, c[1] + .009, c[2] + .004], [c[0] + sx * .001, c[1] + .004, c[2] + .01], [c[0] + sx * .001, c[1] + .01, c[2] + .011], C.shine, C.shine);
    tri([sx * ew * .7, c[1] + .03, c[2] - .03], [sx * (ew + .012), c[1] + .016, c[2] + .012], [sx * ew * .55, c[1] + .026, c[2] + .034], C.cap, C.cap);
  }
}

function rotZ(u, y, z, a, sgn) { return [sgn * (u * Math.cos(a) - y * Math.sin(a)), u * Math.sin(a) + y * Math.cos(a), z]; }
// a lead-inner, b lead-outer, c trail-outer, d trail-inner, cut into a grid with a little camber
function panel(P, a, b, c, d, nu, nv, cam, top, bot, up) {
  const at = (u, v) => { const L = mix2(a, b, u), T = mix2(d, c, u); return P(mix2(L, T, v), cam * 4 * v * (1 - v)); };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
    quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), jit(top, i * 5 + j), bot, up);
  }
}
// scalloped feather tips along an edge from p to q, pointing along dir
function scallops(P, p, q, n, dir, len, y, top, bot, up, alt) {
  for (let i = 0; i < n; i++) {
    const A = mix2(p, q, i / n), B = mix2(p, q, (i + 1) / n), M = mix2(A, B, .5), T = [M[0] + dir[0] * len, M[1] + dir[1] * len];
    tri(P(A, y), P(B, y), P(T, y), jit(top, i), alt && i & 1 ? alt : bot, up);
  }
}

// The wing folds like a real one: at fold 1 the elbow and wrist lie back along the body's side and
// the primaries stack straight back over the tail, each hand on its own side of the back.
const FOLD = { E: [.14, -.1], W: [.125, -.28], chord1: .09, chord2: .09, lift: .06 };
function wing(p, sgn) {
  const fold = p.fold, flare = p.flare, f = fold * fold * (3 - 2 * fold);
  const sweepE = flare * .2, sweepH = flare * .35, S = [.1, .06];
  const Eo = [S[0] + Math.cos(sweepE) * .4, S[1] + Math.sin(sweepE) * .4 + .04];
  const Wo = [Eo[0] + Math.cos(sweepE + sweepH * .6) * .38, Eo[1] + Math.sin(sweepE + sweepH * .6) * .38 - .03];
  const E = mix2(Eo, FOLD.E, f), W = mix2(Wo, FOLD.W, f);
  const chord1 = .4 + (FOLD.chord1 - .4) * f, chord2 = .32 + (FOLD.chord2 - .32) * f;
  const back = a => [Math.sin(a), -Math.cos(a)];   // the trailing direction for a bone at angle a
  const aE = Math.atan2(E[1] - S[1], E[0] - S[0]), aW = Math.atan2(W[1] - E[1], W[0] - E[0]);
  const bE = back(aE), bW = back(aW);
  const St = [S[0], S[1] - chord1], Et = [E[0] + bE[0] * chord1 * .95, E[1] + bE[1] * chord1 * .95], Wt = [W[0] + bW[0] * chord2, W[1] + bW[1] * chord2];
  const uE = E[0], uMin = .035 * f, lift = FOLD.lift * f;
  // the arm turns at the shoulder, the hand lags (or leads) by p.hand; +x is the hawk's left side
  const a1 = sgn > 0 ? p.flapL : p.flapR, a2 = a1 + (sgn > 0 ? p.handL : p.handR);
  const P = (q, y = 0) => {
    const u = Math.max(q[0], uMin);
    if (u <= uE) return rotZ(u, y + lift, q[1], a1, sgn);
    const inner = rotZ(uE, lift, 0, a1, sgn), du = u - uE;
    return [inner[0] + sgn * du * Math.cos(a2), inner[1] + du * Math.sin(a2) + y, q[1]];
  };
  const up = [-sgn * Math.sin(a1) * .5, Math.cos(a1), 0];
  const lead = .035, cam = .022 * (1 - f);
  const Sl = [S[0], S[1] - lead], El = [E[0] + bE[0] * lead, E[1] + bE[1] * lead], Wl = [W[0] + bW[0] * lead, W[1] + bW[1] * lead];
  // leading edge (the dark patagial bar beneath), the arm, the hand
  panel(P, S, E, El, Sl, 3, 1, 0, C.lead, C.bar, up);
  panel(P, Sl, El, Et, St, 3, 3, cam, C.covert, C.under, up);
  panel(P, E, W, Wl, El, 2, 1, 0, C.lead, C.comma, up);
  panel(P, El, Wl, Wt, Et, 3, 2, cam * .7, C.hand, C.handUnder, up);
  // two rows of coverts scalloped across the arm, one across the hand, with dark flecks beneath
  const row = (A, B, C2, D, v, n, dir, len, y, top, bot, alt) => scallops(P, mix2(A, D, v), mix2(B, C2, v), n, dir, len, y, top, bot, up, alt);
  row(Sl, El, Et, St, .02, 5, bE, .05, .008 + cam * .4, C.side, C.under, C.comma);
  row(Sl, El, Et, St, .42, 6, bE, .045, .007 + cam * .9, mixc(C.covert, C.side, .5), C.under);
  row(El, Wl, Wt, Et, .05, 4, bW, .045, .007 + cam * .4, mixc(C.hand, C.side, .4), C.handUnder, C.comma);
  // the wrist comma
  tri(P(Wl, .002), P([Wl[0] - .05, Wl[1] - .02], .002), P(mix2(Wl, Wt, .5), .002), C.hand, C.comma, up);
  // the secondaries' feather tips along the trailing edge, dark beneath
  scallops(P, St, Et, 6, bE, .035, 0, C.covert, C.tipUnder, up);
  scallops(P, Et, Wt, 3, bW, .035, 0, C.hand, C.tipUnder, up);
  // five slotted primaries fanning from the wrist; folded, they stack straight back over the tail
  const fan0 = -.05 - flare * .25, fan1 = -.75 - flare * .35;
  for (let i = 0; i < 5; i++) {
    const t = i / 4, base = mix2(W, Wt, t * .7 * (1 - f * .65));
    const open = sweepE + sweepH + fan0 + (fan1 - fan0) * t + Math.sin(p.t * 9 + i) * .02, shut = -Math.PI / 2 - .26 + .08 * t;
    const ang = open + (shut - open) * f;
    const L = (.42 - t * .1) * (1 - f * .25), dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const nw = 1 - f * .45, w0 = .045 * nw, w1 = .03 * nw, w2 = .024 * nw;
    const at = (k, w) => [base[0] + dir[0] * L * k + nrm[0] * w, base[1] + dir[1] * L * k + nrm[1] * w];
    // the outer feathers bend up in the air: a soaring hawk's fingers. Folded, each lies a hair above the next.
    const curl = (1 - f) * .035 * (1 - t), stack = f * (4 - i) * .003;
    const y = k => curl * k * k + stack - f * .055 * k;   // folded, the tips rest down on the tail
    quad(P(at(0, w0), y(0)), P(at(.45, w1), y(.45)), P(at(.45, -w1), y(.45)), P(at(0, -w0), y(0)), jit(C.prim, i), C.primUnder, up);
    quad(P(at(.45, w1), y(.45)), P(at(.8, w2), y(.8)), P(at(.8, -w2), y(.8)), P(at(.45, -w1), y(.45)), C.prim, C.primUnder, up);
    tri(P(at(.8, w2), y(.8)), P(at(1, 0), y(1)), P(at(.8, -w2), y(.8)), C.primTip, C.tipUnder, up);
  }
}

// the tail's colour with health: 0 a juvenile's brown with fine dark bars, 1 glossy brick red
const JUV = { tail: hex('#8a6a48'), tailBand: hex('#4a3626'), tailTip: hex('#d9c8ad') };
function tail(p) {
  const red = Math.max(0, Math.min(1, p.tailRed ?? 1));
  const T = { tail: mixc(JUV.tail, C.tail, red), band: mixc(JUV.tailBand, C.tailBand, red), tip: mixc(JUV.tailTip, C.tailTip, red) };
  const n = 12, spread = .12 + p.tail * .9, L = .3 + p.tail * .03, base = [0, .0, -.27], up = [0, 1, 0];
  const droop = p.tailPitch || 0;
  for (let i = 0; i < n; i++) {
    const c = (n - 1) / 2, a = -spread + (2 * spread) * (i / (n - 1));
    const dir = [Math.sin(a), -Math.sin(droop) * .8, -Math.cos(a)], side = [Math.cos(a), 0, Math.sin(a)];
    const w = .028 + p.tail * .008, lift = (c - Math.abs(i - c)) * .0016;   // the middle feathers lie on top
    const at = (k, s) => [base[0] + dir[0] * L * k + side[0] * w * s, base[1] + dir[1] * L * k + lift, base[2] + dir[2] * L * k + side[2] * w * s];
    const col = jit(T.tail, i);
    if (red < .6) {   // a juvenile's tail is barred all along
      for (let k = 0; k < 4; k++) {
        quad(at(k * .195, -.5 - k * .12), at(k * .195, .5 + k * .12), at(k * .195 + .16, .6 + k * .12), at(k * .195 + .16, -.6 - k * .12), col, C.tailUnder, up);
        quad(at(k * .195 + .16, -.6 - k * .12), at(k * .195 + .16, .6 + k * .12), at(k * .195 + .195, .62 + k * .12), at(k * .195 + .195, -.62 - k * .12), mixc(T.band, T.tail, red / .6), C.tailUnder, up);
      }
    } else {
      quad(at(0, -.5), at(0, .5), at(.4, .8), at(.4, -.8), col, C.tailUnder, up);
      quad(at(.4, -.8), at(.4, .8), at(.78, 1), at(.78, -1), col, C.tailUnder, up);
    }
    quad(at(.78, -1), at(.78, 1), at(.88, 1), at(.88, -1), T.band, C.tailUnder, up);
    quad(at(.88, -1), at(.88, 1), at(.97, .85), at(.97, -.85), T.tip, T.tip, up);
    tri(at(.97, -.85), at(.97, .85), at(1.02, 0), T.tip, T.tip, up);   // a rounded feather end
  }
}

// a tapered tube from a to b, radius r0 to r1
function limb(a, b, r0, r1, col, n = 5) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1, ax = d.map(v => v / l);
  const ref = Math.abs(ax[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
  let s = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
  const sl = Math.hypot(...s); s = s.map(v => v / sl);
  const t = [ax[1] * s[2] - ax[2] * s[1], ax[2] * s[0] - ax[0] * s[2], ax[0] * s[1] - ax[1] * s[0]];
  const ring = (c, r) => Array.from({ length: n }, (_, k) => { const g = k / n * Math.PI * 2, cs = Math.cos(g) * r, sn = Math.sin(g) * r; return [c[0] + s[0] * cs + t[0] * sn, c[1] + s[1] * cs + t[1] * sn, c[2] + s[2] * cs + t[2] * sn]; });
  const A = ring(a, r0), B = ring(b, r1);
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; if (r1 > 0) quad(A[k], A[k2], B[k2], B[k], col, col); else tri(A[k], A[k2], b, col, col); }
}

function legs(p) {
  const d = .16 * p.legs;
  for (const sx of [1, -1]) {
    const a = [sx * .045, -.05, .04], k = [sx * .05, -.07 - d * .4, .05 + d * .1], b = [sx * .05, -.07 - d, .045 + d * .2];
    limb(a, k, .038, .022, C.thigh, 6);    // feathered trousers
    limb(k, b, .012, .01, C.leg);          // bare yellow shank
    // three toes forward, one back, each with a dark curved talon
    for (const [tx, tz, l] of [[.35, 1, .05], [0, 1, .055], [-.3, 1, .045], [0, -1, .035]]) {
      const dir = [sx * tx, -.18, tz], dl = Math.hypot(...dir), e = [b[0] + dir[0] / dl * l, b[1] + dir[1] / dl * l, b[2] + dir[2] / dl * l];
      limb(b, e, .008, .006, C.leg, 4);
      limb(e, [e[0] + dir[0] / dl * .012, e[1] - .014, e[2] + dir[2] / dl * .012], .006, 0, C.talon, 4);
    }
  }
}
