// The hawk, built in code each frame from a pose: a red-tail with a brown back, cream belly
// with a streaked band, dark patagial bars and wrist commas under pale wings, slotted
// primaries and a rufous tail. Faces carry a top and an underside colour; the shader picks by
// which side faces the camera, so a bank shows the pale underwing.
// Model space: x right, y up, z forward (beak at +z). One unit is roughly 0.6 m.

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const C = {
  back: hex('#6e4a2f'), side: hex('#8a6240'), belly: hex('#efe3c8'), band: hex('#7a5638'), cap: hex('#4b3322'), throat: hex('#f3ead8'),
  covert: hex('#7b5434'), hand: hex('#5e3f27'), prim: hex('#4a3322'), primTip: hex('#2a1d14'), lead: hex('#6b4a2e'),
  under: hex('#efe4cc'), bar: hex('#3a2a1f'), handUnder: hex('#e4dacb'), comma: hex('#3f2c1e'), primUnder: hex('#d6cec0'), tipUnder: hex('#3a2c22'),
  tail: hex('#b5562c'), tailBand: hex('#3a2418'), tailTip: hex('#eadbc2'), tailUnder: hex('#ead2c2'),
  beak: hex('#3a3430'), cere: hex('#e0b23a'), eye: hex('#1e1612'), leg: hex('#d8a838'),
};

export const HAWK_SCALE = .62;
const buf = new Float32Array(6000 * 12);
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
export function buildHawk(pose) {
  o = 0;
  body(pose);
  wing(pose, 1); wing(pose, -1);
  tail(pose);
  if (pose.legs > .02) legs(pose);
  return buf.subarray(0, o);
}

function body(p) {
  const R = [ // z, half width, half height, centre y
    [-.30, .05, .035, .01], [-.18, .09, .075, 0], [-.02, .115, .1, -.01], [.12, .1, .095, 0], [.21, .072, .075, .025], [.29, .068, .07, .045], [.36, .04, .045, .04],
  ];
  const S = 8, ring = R.map(([z, w, h, y]) => Array.from({ length: S }, (_, k) => { const a = k / S * Math.PI * 2; return [Math.cos(a) * w, y + Math.sin(a) * h, z]; }));
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < S; k++) {
    const k2 = (k + 1) % S, a = ring[i][k], b = ring[i][k2], c = ring[i + 1][k2], d = ring[i + 1][k];
    const s = Math.sin((k + .5) / S * Math.PI * 2), z = R[i][0];
    let col = s > .35 ? C.back : s > -.35 ? C.side : C.belly;
    if (s <= -.35 && i === 2) col = C.band;                       // the belly band
    if (i >= 4) col = s > .1 ? C.cap : s > -.5 ? C.side : C.throat;   // dark cap, pale throat
    if (i === 3 && s > -.35 && s <= .35) col = C.side;
    void z;
    quad(a, d, c, b, col, col);
  }
  // beak: yellow cere then a dark hooked tip
  const f = ring[R.length - 1], tip = [0, .0, .46], hook = [0, -.03, .43];
  for (let k = 0; k < S; k++) {
    const a = f[k], b = f[(k + 1) % S], m = [(a[0] + b[0]) * .4, (a[1] + b[1]) * .5 * .9 + .004, (a[2] + b[2]) * .5 + .035];
    tri(a, b, m, C.cere, C.cere);
    tri(m, b, (k & 1) ? hook : tip, C.beak, C.beak);
  }
  // eyes
  for (const sx of [1, -1]) {
    const e = [sx * .066, .065, .31];
    tri([e[0], e[1] + .016, e[2]], [e[0] + sx * .004, e[1], e[2] + .022], [e[0], e[1] - .014, e[2]], C.eye, C.eye);
  }
}

function rotZ(u, y, z, a, sgn) { return [sgn * (u * Math.cos(a) - y * Math.sin(a)), u * Math.sin(a) + y * Math.cos(a), z]; }

function wing(p, sgn) {
  const fold = p.fold, flare = p.flare;
  // plan view: u outward, v forward. Folding swings the arm and hand back; flaring brings them forward.
  const sweepE = -fold * .45 + flare * .2, sweepH = -fold * 2.1 + flare * .35;
  const S = [.1, .06], len1 = .4 * (1 - fold * .25), len2 = .38;
  const E = [S[0] + Math.cos(sweepE) * len1, S[1] + Math.sin(sweepE) * len1 + .04];
  const W = [E[0] + Math.cos(sweepE + sweepH * .6) * len2, E[1] + Math.sin(sweepE + sweepH * .6) * len2 - .03];
  const chord1 = .4 * (1 - fold * .5), chord2 = .32 * (1 - fold * .45);
  const back = a => [Math.sin(a), -Math.cos(a)];   // the trailing direction for a bone at angle a
  const bE = back(sweepE), bW = back(sweepE + sweepH * .6);
  const St = [S[0], S[1] - chord1], Et = [E[0] + bE[0] * chord1 * .95, E[1] + bE[1] * chord1 * .95], Wt = [W[0] + bW[0] * chord2, W[1] + bW[1] * chord2];
  const uE = E[0];
  // dihedral and flap: the arm turns at the shoulder, the hand lags (or leads) by p.hand
  // +x is the hawk's left side (the model is mirrored into a right-handed world)
  const a1 = sgn > 0 ? p.flapL : p.flapR, a2 = a1 + (sgn > 0 ? p.handL : p.handR);
  const P = (q, y = 0) => {
    if (q[0] <= uE) return rotZ(q[0], y, q[1], a1, sgn);
    const inner = rotZ(uE, 0, 0, a1, sgn), du = q[0] - uE;
    return [inner[0] + sgn * du * Math.cos(a2), inner[1] + du * Math.sin(a2) + y, q[1]];
  };
  const up = [-sgn * Math.sin(a1) * .5, Math.cos(a1), 0];
  const lead = .035;
  // leading-edge strip (dark patagial bar underneath), inner panel, hand panel
  const Sl = [S[0], S[1] - lead], El = [E[0] + bE[0] * lead, E[1] + bE[1] * lead], Wl = [W[0] + bW[0] * lead, W[1] + bW[1] * lead];
  quad(P(S), P(E), P(El), P(Sl), C.lead, C.bar, up);
  quad(P(Sl), P(El), P(Et), P(St), C.covert, C.under, up);
  quad(P(E), P(W), P(Wl), P(El), C.lead, C.comma, up);
  quad(P(El), P(Wl), P(Wt), P(Et), C.hand, C.handUnder, up);
  // the wrist comma
  tri(P(Wl), P([Wl[0] - .05, Wl[1] - .02]), P([(Wl[0] + Wt[0]) / 2, (Wl[1] + Wt[1]) / 2]), C.hand, C.comma, up);
  // five slotted primaries fanning from the wrist
  const fan0 = -.05 - flare * .25 + fold * .2, fan1 = -.75 - flare * .35 - fold * .5;
  for (let i = 0; i < 5; i++) {
    const t = i / 4, base = [W[0] + (Wt[0] - W[0]) * t * .7, W[1] + (Wt[1] - W[1]) * t * .7];
    const ang = sweepE + sweepH + fan0 + (fan1 - fan0) * t + Math.sin(p.t * 9 + i) * .02;
    const L = (.42 - t * .1) * (1 - fold * .2), dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const w0 = .045, w1 = .026;
    const b1 = [base[0] + nrm[0] * w0, base[1] + nrm[1] * w0], b2 = [base[0] - nrm[0] * w0, base[1] - nrm[1] * w0];
    const m1 = [base[0] + dir[0] * L * .72 + nrm[0] * w1, base[1] + dir[1] * L * .72 + nrm[1] * w1];
    const m2 = [base[0] + dir[0] * L * .72 - nrm[0] * w1, base[1] + dir[1] * L * .72 - nrm[1] * w1];
    const tp = [base[0] + dir[0] * L, base[1] + dir[1] * L];
    // the outer feathers bend up a little more in the air: a soaring hawk's fingers
    const lift = (1 - fold) * .03 * (1 - t);
    quad(P(b1), P(m1, lift * .7), P(m2, lift * .7), P(b2), C.prim, C.primUnder, up);
    tri(P(m1, lift * .7), P(tp, lift), P(m2, lift * .7), C.primTip, C.tipUnder, up);
  }
  // secondaries' dark trailing edge underneath
  const Et2 = [Et[0] + bE[0] * .03, Et[1] + bE[1] * .03], St2 = [St[0], St[1] - .03], Wt2 = [Wt[0] + bW[0] * .03, Wt[1] + bW[1] * .03];
  quad(P(St), P(Et), P(Et2), P(St2), C.covert, C.tipUnder, up);
  quad(P(Et), P(Wt), P(Wt2), P(Et2), C.hand, C.tipUnder, up);
}

function tail(p) {
  const n = 6, spread = .14 + p.tail * .9, L = .3 + p.tail * .03, base = [0, .0, -.27], up = [0, 1, 0];
  const droop = p.tailPitch || 0;
  for (let i = 0; i < n; i++) {
    const a = -spread + (2 * spread) * (i / (n - 1));
    const dir = [Math.sin(a), -Math.sin(droop) * .8, -Math.cos(a)], side = [Math.cos(a), 0, Math.sin(a)];
    const w = .045 + p.tail * .012;
    const at = (k, s) => [base[0] + dir[0] * L * k + side[0] * w * s, base[1] + dir[1] * L * k, base[2] + dir[2] * L * k + side[2] * w * s];
    quad(at(0, -.5), at(0, .5), at(.78, 1), at(.78, -1), C.tail, C.tailUnder, up);
    quad(at(.78, -1), at(.78, 1), at(.88, 1), at(.88, -1), C.tailBand, C.tailUnder, up);
    quad(at(.88, -1), at(.88, 1), at(1, .8), at(1, -.8), C.tailTip, C.tailTip, up);
  }
}

function legs(p) {
  const d = .16 * p.legs;
  for (const sx of [1, -1]) {
    const a = [sx * .04, -.07, .04], b = [sx * .045, -.07 - d, .04 + d * .2];
    quad([a[0] - .012, a[1], a[2]], [a[0] + .012, a[1], a[2]], [b[0] + .01, b[1], b[2]], [b[0] - .01, b[1], b[2]], C.leg, C.leg);
    for (const dz of [-.03, .04]) tri([b[0] - .01, b[1], b[2]], [b[0] + .01, b[1], b[2]], [b[0], b[1] - .015, b[2] + dz], C.beak, C.beak);
  }
}
