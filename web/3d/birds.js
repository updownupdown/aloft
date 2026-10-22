// Other birds to fly as (a study; the hawk stays the default). Each species is a set of numbers
// for one shared builder: body rings, a bill, wings, a tail and legs, painted per species, built
// each frame from the same pose the hawk uses (camera.js), so the controls drive them unchanged.
// Model space and units match hawk.js: x right, y up, z forward (bill at +z), one unit ~0.6 m.
// `fly` holds the changes to FLY (flight.js) that give each species its feel.

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const band = (s, top, side, belly) => s > .35 ? top : s > -.35 ? side : belly;

export const BIRDS = {
  swift: {
    name: 'Common swift', scale: .75,
    fly: { best: 15, maxS: 52, cd: .0042, cdTuck: .0018, stall: 6, stallFlare: 4.4, roll: 1.7, flapS: 3.4, flapUp: 1.1, flapHover: 1.4, flapCost: .035, landS: 9 },
    rings: [[-.26, .03, .03, 0], [-.14, .065, .06, 0], [0, .08, .075, 0], [.13, .075, .07, .005], [.22, .065, .06, .01], [.29, .05, .046, .012], [.33, .028, .026, .008]],
    paint: (i, s) => i >= 4 && s < -.3 ? hex('#cfc7ba') : s > .2 ? hex('#34302e') : hex('#45403c'),
    bill: { len: .035, w: .3, drop: .008, base: hex('#2a2624'), tip: hex('#1d1a19') },
    eye: [.045, .03, .27, .012], brow: hex('#2c2826'),
    wing: {
      root: [.06, .05], arm: .17, hand: .56, chord1: .2, chord2: .12, sweepE: .3, sweepH: -.85, dihedral: .02, droop: -.05,
      prims: { n: 4, len: .36, w: .7, fan: [-.12, -.32], slot: 0 },
      top: { lead: '#2e2a28', covert: '#3a3532', hand: '#2b2725', prim: '#26221f', tip: '#1f1b19', trail: '#3a3532' },
      under: { bar: '#4a4440', covert: '#4f4844', hand: '#45403c', wrist: '#3c3734', prim: '#4b4541', tip: '#3d3835', trail: '#5a534e' },
    },
    tail: { n: 4, spread: [.22, .45], len: .2, shape: 'fork', base: [0, 0, -.24], top: hex('#2f2b29'), under: hex('#4a4440') },
    legs: { len: .06, at: [.025, -.05, .05], col: hex('#3a3430'), foot: 'cling' },
    anim(p, t, air) { if (!air) return; const burst = (t % 3.2) < .8 ? 1 : 0, k = (1 - p.fold) * burst; p.flapL += Math.sin(t * 30) * .4 * k; p.flapR += Math.sin(t * 30) * .4 * k; },
  },

  heron: {
    name: 'Grey heron', scale: 1.3, maxFold: .35,
    fly: { best: 9, maxS: 30, cd: .009, cdTuck: .005, stall: 5.5, stallFlare: 3, roll: .7, flapS: 2.2, flapUp: 1.0, flapHover: 2.4, flapCost: .05, landS: 8 },
    // in flight the neck folds back into a pouch; standing (settled) it rises in an S
    rings: [[-.36, .05, .045, 0], [-.22, .12, .1, 0], [-.04, .15, .12, -.01], [.12, .13, .11, 0], [.22, .1, .12, -.05], [.3, .075, .08, -.02], [.36, .06, .06, .03], [.42, .045, .045, .035]],
    stand: [[-.36, .05, .045, 0], [-.22, .12, .1, 0], [-.04, .15, .12, -.01], [.12, .13, .11, .03], [.17, .065, .07, .2], [.19, .055, .055, .36], [.27, .06, .055, .45], [.33, .045, .045, .45]],
    paint(i, s) {
      if (i <= 3) return band(s, hex('#8c959a'), hex('#a7aeb1'), hex('#d8dbd5'));
      if (i <= 5) return s < -.6 && i === 5 ? hex('#5a5e63') : hex('#e2e4df');
      return s > .7 ? hex('#ecede9') : s > -.1 ? hex('#26282c') : hex('#eeefea');   // white crown, black stripe
    },
    bill: { len: .3, w: .55, drop: .01, base: hex('#c9a43a'), tip: hex('#d9b84a') },
    eye: [.042, .045, .4, .012], brow: hex('#26282c'),
    plume: hex('#202226'),
    wing: {
      root: [.1, .06], arm: .55, hand: .5, chord1: .46, chord2: .38, sweepE: 0, sweepH: -.05, dihedral: -.02, droop: -.35,
      prims: { n: 5, len: .34, w: 1.1, fan: [-.05, -.7], slot: .02 },
      top: { lead: '#c9cdcf', covert: '#9aa2a6', hand: '#7d868b', prim: '#33393e', tip: '#272c30', trail: '#3d4449' },
      under: { bar: '#d6d9d6', covert: '#848c91', hand: '#6f777c', wrist: '#cfd2cf', prim: '#3a4045', tip: '#2c3135', trail: '#3f464b' },
    },
    tail: { n: 5, spread: [.15, .5], len: .16, shape: 'square', base: [0, 0, -.34], top: hex('#7d868b'), under: hex('#8c959a') },
    legs: { len: .62, at: [.035, -.07, -.06], col: hex('#9b8655'), foot: 'toes', trail: true },
    anim(p, t, air) { if (!air) return; const k = (1 - p.fold) * (1 - p.flare * .6), f = Math.sin(t * 4.6) * .38 * k; p.flapL += f; p.flapR += f; p.handL += Math.sin(t * 4.6 - 1) * .18 * k; p.handR += Math.sin(t * 4.6 - 1) * .18 * k; },
  },

  mallard: {
    name: 'Mallard', scale: .82,
    fly: { best: 17, maxS: 34, cd: .009, cdTuck: .005, stall: 10, stallFlare: 5.5, roll: 1.2, flapS: 3.6, flapUp: 1.6, flapHover: 2.6, flapCost: .04, landS: 11 },
    rings: [[-.3, .06, .05, .02], [-.18, .13, .1, 0], [0, .15, .12, -.01], [.14, .13, .11, 0], [.22, .06, .065, .06], [.28, .055, .06, .1], [.33, .07, .07, .12], [.39, .06, .055, .12], [.43, .035, .03, .11]],
    paint(i, s) {
      if (i === 0) return hex('#1f2023');                                     // the black curl at the tail
      if (i === 3) return s > .35 ? hex('#7d7266') : hex('#6b3a2a');          // chestnut breast
      if (i === 4) return hex('#f1efe8');                                     // the white collar
      if (i >= 5) return s > -.6 ? hex('#2d5a3d') : hex('#244a31');           // green head
      return band(s, hex('#7f746a'), hex('#b9b5ad'), hex('#cfcac0'));
    },
    bill: { len: .13, w: .7, drop: .02, tipw: .035, tiph: .004, base: hex('#d8c04a'), tip: hex('#c9b23e') },
    eye: [.06, .135, .385, .012], brow: hex('#244a31'),
    wing: {
      root: [.1, .06], arm: .3, hand: .36, chord1: .28, chord2: .2, sweepE: .05, sweepH: -.25, dihedral: .04, droop: 0,
      prims: { n: 5, len: .3, w: .9, fan: [-.04, -.42], slot: 0 },
      speculum: hex('#3c4fae'),
      top: { lead: '#8a7e72', covert: '#9a9086', hand: '#7d7369', prim: '#6c645c', tip: '#5a534d', trail: '#f2f0ea' },
      under: { bar: '#e6e4de', covert: '#dcd9d2', hand: '#cfccc5', wrist: '#d6d3cc', prim: '#b4b0a9', tip: '#9c9892', trail: '#d0cdc6' },
    },
    tail: { n: 5, spread: [.12, .4], len: .14, shape: 'wedge', base: [0, .02, -.28], top: hex('#d9d6cf'), under: hex('#e9e6df') },
    legs: { len: .1, at: [.05, -.08, -.02], col: hex('#e88a2e'), foot: 'web' },
    anim(p, t, air) { if (!air) return; const k = 1 - p.fold * .8; p.flapL += Math.sin(t * 17) * .55 * k; p.flapR += Math.sin(t * 17) * .55 * k; p.handL += Math.sin(t * 17 - 1.2) * .2 * k; p.handR += Math.sin(t * 17 - 1.2) * .2 * k; },
  },

  owl: {
    name: 'Barn owl', scale: .95,
    fly: { best: 9, maxS: 32, cd: .013, cdTuck: .003, stall: 5, stallFlare: 2.6, roll: 1.15, flapS: 2.6, flapHover: 4.3, flapCost: .058, landS: 9 },
    rings: [[-.24, .05, .04, 0], [-.12, .11, .09, 0], [.02, .125, .11, 0], [.13, .115, .105, .02], [.2, .12, .12, .06], [.27, .13, .13, .08], [.32, .11, .11, .08], [.345, .06, .06, .08]],
    paint(i, s) {
      if (i >= 5) return s > .3 ? hex('#bd9a6c') : hex('#f4efe4');
      return band(s, hex('#bd9a6c'), hex('#d6bf98'), hex('#f5f0e6'));
    },
    face: { z: .335, y: .085, r: .13, col: hex('#f7f2e8'), rim: hex('#c99f68') },
    bill: { len: .05, w: .25, drop: .03, base: hex('#e8d6bd'), tip: hex('#d9c3a5') },
    eye: [.045, .1, .352, .022],
    wing: {
      root: [.1, .06], arm: .44, hand: .42, chord1: .38, chord2: .34, sweepE: .02, sweepH: -.08, dihedral: .03, droop: 0,
      prims: { n: 5, len: .34, w: 1.1, fan: [-.05, -.75], slot: .02 },
      top: { lead: '#bb9c74', covert: '#bf9d70', hand: '#aa9b88', prim: '#b8a68c', tip: '#8a7b68', trail: '#b49c7c' },
      under: { bar: '#f6f2ea', covert: '#f4efe6', hand: '#f2ede4', wrist: '#e7ddcd', prim: '#ece6dc', tip: '#d9cfc0', trail: '#eee8de' },
    },
    tail: { n: 6, spread: [.15, .5], len: .17, shape: 'square', base: [0, 0, -.22], top: hex('#c9a874'), under: hex('#f1ebdf'), bar: hex('#8f7a5e') },
    legs: { len: .2, at: [.045, -.07, .05], col: hex('#f0ebe2'), foot: 'talon' },
  },

  osprey: {
    name: 'Osprey', scale: 1.1,
    fly: { best: 13, maxS: 52, cd: .0046, cdTuck: .002, stall: 8, roll: .8, yaw: 1.0, flapHover: 3.8, flapCost: .075 },
    rings: [[-.3, .045, .032, .01], [-.18, .085, .07, 0], [-.02, .105, .095, -.01], [.12, .095, .09, 0], [.21, .07, .072, .025], [.29, .066, .068, .045], [.36, .04, .044, .04]],
    paint(i, s) {
      if (i >= 4) return s > .45 ? hex('#efebe2') : s > -.2 ? hex('#3b2c22') : hex('#f4f1ea');   // white head, dark eye stripe
      return band(s, hex('#4a382a'), hex('#5b4634'), hex('#f3f0e9'));
    },
    bill: { len: .1, w: .55, drop: .045, base: hex('#3c3a3a'), tip: hex('#1f1c1b') },
    eye: [.064, .06, .31, .014], brow: hex('#3b2c22'), iris: hex('#e8c43c'),
    wing: {
      root: [.1, .06], arm: .48, hand: .44, chord1: .34, chord2: .27, sweepE: .12, sweepH: -.45, dihedral: .16, droop: -.42,
      prims: { n: 4, len: .38, w: .9, fan: [-.04, -.55], slot: .025 },
      top: { lead: '#4b392b', covert: '#4f3c2d', hand: '#45342a', prim: '#2f241d', tip: '#211915', trail: '#47362a' },
      under: { bar: '#f1ede4', covert: '#eeeae1', hand: '#e7e2d8', wrist: '#1f1814', prim: '#c9c2b6', tip: '#2b221c', trail: '#7d7168' },
    },
    tail: { n: 6, spread: [.12, .7], len: .27, shape: 'square', base: [0, 0, -.28], top: hex('#5b4634'), under: hex('#e2dbcf'), bar: hex('#3b2c22') },
    legs: { len: .17, at: [.04, -.07, .04], col: hex('#cfd3c9'), foot: 'talon' },
  },

  // the northern royal albatross of Taiaroa Head: about 3 m of narrow wing, black above, white
  // below with a black trailing edge; a big pale-pink hooked bill; pink webbed feet
  albatross: {
    name: 'Royal albatross', scale: 1.38, fit: .6,
    fly: { best: 15, maxS: 46, cd: .0034, cdTuck: .0018, stall: 9, stallFlare: 5, roll: .7, yaw: .9, flapS: 2.6, flapUp: 1.1, flapHover: 2.4, flapCost: .085, landS: 12 },
    rings: [[-.3, .045, .035, .02], [-.18, .085, .075, 0], [-.02, .1, .095, -.01], [.13, .088, .088, 0], [.22, .062, .068, .03], [.29, .06, .064, .05], [.35, .045, .046, .05]],
    paint(i, s) {
      if (i >= 4) return s > .2 ? hex('#f6f5f0') : hex('#fbfaf6');                 // white head
      return band(s, hex('#f1efe9'), hex('#f7f6f1'), hex('#fdfcf8'));
    },
    bill: { len: .21, w: .72, drop: .06, base: hex('#efc8b4'), tip: hex('#e4b79a') },
    eye: [.058, .07, .31, .012], brow: hex('#5a5550'),
    wing: {
      root: [.1, .07], arm: .62, hand: .66, chord1: .2, chord2: .15, sweepE: .06, sweepH: -.22, dihedral: .02, droop: -.08,
      prims: { n: 5, len: .3, w: .7, fan: [-.02, -.3], slot: 0 },
      top: { lead: '#2a2725', covert: '#33302d', hand: '#262321', prim: '#1d1b1a', tip: '#171615', trail: '#2c2927' },
      under: { bar: '#fbfaf5', covert: '#f6f4ee', hand: '#f1eee7', wrist: '#e9e6df', prim: '#2a2725', tip: '#1d1b1a', trail: '#2e2b29' },
    },
    tail: { n: 6, spread: [.12, .35], len: .16, shape: 'wedge', base: [0, .01, -.3], top: hex('#e9e7e1'), under: hex('#f6f5f0'), bar: hex('#3a3633') },
    legs: { len: .13, at: [.05, -.08, -.02], col: hex('#e8b9b0'), foot: 'web' },
  },

  raven: {
    name: 'Common raven', scale: 1.05,
    fly: { best: 12, maxS: 40, cd: .0064, roll: 1.5, yaw: 1.55, flapHover: 2.6, flapCost: .047 },
    rings: [[-.32, .05, .04, 0], [-.18, .1, .085, 0], [-.02, .115, .1, -.01], [.12, .1, .095, 0], [.21, .08, .085, .02], [.29, .075, .07, .04], [.35, .05, .05, .04]],
    paint: (i, s) => s > .35 ? hex('#25252d') : s > -.35 ? hex('#1d1d24') : hex('#2a2a33'),
    bill: { len: .16, w: .75, drop: .035, base: hex('#18181d'), tip: hex('#101014') },
    eye: [.06, .06, .3, .012], brow: hex('#1b1b21'),
    beard: hex('#22222a'),
    wing: {
      root: [.1, .06], arm: .42, hand: .42, chord1: .37, chord2: .3, sweepE: .03, sweepH: -.12, dihedral: .05, droop: -.05,
      prims: { n: 5, len: .42, w: 1, fan: [0, -.85], slot: .035 },
      top: { lead: '#23232b', covert: '#272730', hand: '#202027', prim: '#1b1b21', tip: '#141418', trail: '#23232a' },
      under: { bar: '#2b2b34', covert: '#30303a', hand: '#2c2c35', wrist: '#25252d', prim: '#3a3a44', tip: '#2a2a32', trail: '#33333c' },
    },
    tail: { n: 6, spread: [.14, .5], len: .3, shape: 'wedge', base: [0, 0, -.3], top: hex('#22222a'), under: hex('#2d2d36') },
    legs: { len: .15, at: [.04, -.07, .04], col: hex('#1a1a1f'), foot: 'talon' },
  },
};

// ---- the builder ---------------------------------------------------------------------------
const buf = new Float32Array(8000 * 12);
let o = 0, K = 1;

function tri(a, b, c, top, bot, up) {
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (up && nx * up[0] + ny * up[1] + nz * up[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  for (const p of [a, b, c]) {
    buf[o++] = p[0] * K; buf[o++] = p[1] * K; buf[o++] = p[2] * K; buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
    buf[o++] = top[0]; buf[o++] = top[1]; buf[o++] = top[2]; buf[o++] = bot[0]; buf[o++] = bot[1]; buf[o++] = bot[2];
  }
}
const quad = (a, b, c, d, top, bot, up) => { tri(a, b, c, top, bot, up); tri(a, c, d, top, bot, up); };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const cols = {};
const col = h => cols[h] || (cols[h] = hex(h));

// pose: the hawk's (hawk.js). Settled on a perch, the ground or water when legs and fold are both full.
// the perched acts' head turns and fluffing (as hawk.js bend): the head turns on the neck (headYaw + to
// the bird's left, headPitch + down), easing in over the neck ring; fluff puffs the body out
function bend(sp, p, n) {
  const N = sp.rings[sp.rings.length - 2], PZ = N[0] * K, PY = N[3] * K, W = .09 * K;
  const yaw = p.headYaw || 0, pitch = p.headPitch || 0, puff = 1 + (p.fluff || 0) * .14;
  for (let i = 0; i < n; i += 12) {
    let x = buf[i] * puff, y = buf[i + 1] * puff, z = buf[i + 2], nx = buf[i + 3], ny = buf[i + 4], nz = buf[i + 5];
    const w = Math.min(1, Math.max(0, (z - PZ + W * .5) / W)), k = w * w * (3 - 2 * w);
    if (k > 0) {
      const cp = Math.cos(pitch * k), sn = Math.sin(pitch * k), cy = Math.cos(yaw * k), sy = Math.sin(yaw * k);
      let ry = y - PY, rz = z - PZ;
      [ry, rz] = [ry * cp - rz * sn, ry * sn + rz * cp];
      [ny, nz] = [ny * cp - nz * sn, ny * sn + nz * cp];
      [x, rz] = [x * cy + rz * sy, -x * sy + rz * cy];
      [nx, nz] = [nx * cy + nz * sy, -nx * sy + nz * cy];
      y = ry + PY; z = rz + PZ;
    }
    buf[i] = x; buf[i + 1] = y; buf[i + 2] = z; buf[i + 3] = nx; buf[i + 4] = ny; buf[i + 5] = nz;
  }
}

// an extra roll about the body's long axis, for the raven's tumble (sys/moves.js sets it)
export const SPIN = { a: 0 };
export function buildBird(id, pose) {
  const sp = BIRDS[id];
  const p = { flapL: 0, flapR: 0, handL: 0, handR: 0, fold: 0, flare: 0, legs: 0, tail: 0, tailPitch: 0, t: 0, ...pose };
  const settled = p.legs > .95 && p.fold > .9;
  if (!settled && sp.maxFold) p.fold = Math.min(p.fold, sp.maxFold);   // a heron never stoops
  sp.anim?.(p, p.t, !settled);
  o = 0; K = sp.scale;
  body(sp, p);
  if (p.headYaw || p.headPitch || p.fluff) bend(sp, p, o);
  wing(sp, p, 1); wing(sp, p, -1);
  tail(sp, p);
  if (p.legs > .02 || sp.legs.trail) legs(sp, p);
  if (SPIN.a) {
    const c = Math.cos(SPIN.a), s = Math.sin(SPIN.a);
    for (let i = 0; i < o; i += 12) for (const k of [i, i + 3]) { const x = buf[k], y = buf[k + 1]; buf[k] = x * c - y * s; buf[k + 1] = x * s + y * c; }
  }
  return buf.subarray(0, o);
}

function body(sp, p) {
  const S = 12, st = sp.stand ? Math.min(1, p.fold) * Math.min(1, p.legs) : 0;
  const R = sp.rings.map((r, i) => st ? r.map((v, k) => v + (sp.stand[i][k] - v) * st) : r);
  // a rounder body: a Catmull-Rom ring between each pair of the species' rings, painted as the first
  const Rs = [];
  for (let i = 0; i < R.length; i++) {
    Rs.push([...R[i], i]);
    if (i < R.length - 1) {
      const a = R[Math.max(0, i - 1)], b = R[i], c = R[i + 1], d = R[Math.min(R.length - 1, i + 2)];
      Rs.push([0, 1, 2, 3].map(k => (-a[k] + 9 * b[k] + 9 * c[k] - d[k]) / 16).concat(i));
    }
  }
  const ring = Rs.map(([z, w, h, y]) => Array.from({ length: S }, (_, k) => { const a = k / S * Math.PI * 2; return [Math.cos(a) * w, y + Math.sin(a) * h, z]; }));
  for (let j = 0; j < Rs.length - 1; j++) for (let k = 0; k < S; k++) {
    const k2 = (k + 1) % S, s = Math.sin((k + .5) / S * Math.PI * 2), c = sp.paint(Rs[j][4], s);
    quad(ring[j][k], ring[j + 1][k], ring[j + 1][k2], ring[j][k2], c, c);
  }
  const F = R[R.length - 1], f = ring[Rs.length - 1];
  // the bill: a half-way ring, then a point (or, for a duck, a flat spatula edge)
  const B = sp.bill, zt = F[0] + B.len, mid = f.map(([x, y]) => [x * B.w, F[3] + (y - F[3]) * B.w - B.drop * .3, F[0] + B.len * .45]);
  const tip = f.map((_, k) => { const a = k / S * Math.PI * 2; return [Math.cos(a) * (B.tipw || 0), F[3] - B.drop + Math.sin(a) * (B.tiph || 0), zt]; });
  for (let k = 0; k < S; k++) {
    const k2 = (k + 1) % S;
    quad(f[k], mid[k], mid[k2], f[k2], B.base, B.base);
    quad(mid[k], tip[k], tip[k2], mid[k2], B.tip, B.tip);
  }
  if (sp.face) {   // the owl's heart-shaped facial disc, then dark eyes set in it
    const { z, y, r, col: fc, rim } = sp.face, n = 10;
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
      const rr = a => r * (1 - .25 * Math.max(0, Math.sin(a)) ** 6) * (Math.sin(a) < 0 ? .9 : 1);
      const pa = [Math.cos(a0) * rr(a0) * .95, y + Math.sin(a0) * rr(a0), z - .03], pb = [Math.cos(a1) * rr(a1) * .95, y + Math.sin(a1) * rr(a1), z - .03];
      tri([0, y - .02, z + .012], pb, pa, fc, fc);
      tri(pa, pb, [pb[0] * 1.08, pb[1] + (pb[1] - y) * .08, z - .05], rim, rim);
    }
  }
  for (const sx of [1, -1]) {
    const [ex, ey, ez, er] = sp.eye, e = [sx * ex, ey + (sp.stand ? (sp.stand[R.length - 2][3] - sp.rings[R.length - 2][3]) * st : 0), ez + (sp.stand ? (sp.stand[R.length - 2][0] - sp.rings[R.length - 2][0]) * st : 0)];
    const dark = [.09, .07, .06], iris = sp.iris || dark, n = 6, c0 = [e[0] + sx * er * .25, e[1], e[2] + er * .35];
    for (let k = 0; k < n; k++) {   // the iris, a little disc facing out and forward, then the pupil on it
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, at = (a, r) => [e[0], e[1] + Math.sin(a) * er * r, e[2] + Math.cos(a) * er * r * 1.2];
      tri(c0, at(a0, 1), at(a1, 1), iris, iris);
      if (sp.iris) tri([c0[0] + sx * .002, c0[1], c0[2]], at(a0, .5).map((v, i) => i ? v : v + sx * .002), at(a1, .5).map((v, i) => i ? v : v + sx * .002), dark, dark);
    }
    tri([c0[0] + sx * .003, c0[1] + er * .45, c0[2] + er * .2], [c0[0] + sx * .003, c0[1] + er * .2, c0[2] + er * .45], [c0[0] + sx * .003, c0[1] + er * .15, c0[2] + er * .1], [.95, .95, .92], [.95, .95, .92]);
    if (sp.brow) tri([sx * ex * .75, e[1] + er * 2.6, e[2] - .02], [sx * ex * 1.1, e[1] + er * 1.6, e[2] + .02], [sx * ex * .95, e[1] + er * 2.2, e[2] - .06], sp.brow, sp.brow);
  }
  if (sp.plume) {   // the heron's black nape plumes
    const h = R[R.length - 2];
    for (const sx of [.012, -.012]) tri([sx, h[3] + h[2] * .7, h[0]], [sx * 2, h[3] + h[2] * .2, h[0] - .02], [sx * 3, h[3] - .02, h[0] - .2], sp.plume, sp.plume);
  }
  if (sp.beard) {   // a raven's shaggy throat
    const h = R[R.length - 3];
    for (const sx of [.03, -.03, 0]) tri([sx - .025, h[3] - h[2] * .8, h[0] + .03], [sx + .025, h[3] - h[2] * .8, h[0] + .03], [sx, h[3] - h[2] * 1.35, h[0] - .02], sp.beard, sp.beard);
  }
}

function rotZ(u, y, z, a, sgn) { return [sgn * (u * Math.cos(a) - y * Math.sin(a)), u * Math.sin(a) + y * Math.cos(a), z]; }

// the hawk's wing (hawk.js) with its lengths, sweep, bend and feather fan made into numbers
function wing(sp, p, sgn) {
  const W_ = sp.wing, T = W_.top, U = W_.under, fold = p.fold, flare = p.flare;
  // the open wing, then folding moves the elbow and wrist toward fixed spots beside the body, so
  // both bones lie back along its side and the primaries stack straight back over the tail (as
  // hawk.js does): folded wings never cross
  const sweepE = W_.sweepE + flare * .2, sweepH = W_.sweepH + flare * .35;
  const S = W_.root, len1 = W_.arm, len2 = W_.hand;
  const E0 = [S[0] + Math.cos(sweepE) * len1, S[1] + Math.sin(sweepE) * len1 + .04];
  const W0 = [E0[0] + Math.cos(sweepE + sweepH * .6) * len2, E0[1] + Math.sin(sweepE + sweepH * .6) * len2 - .03];
  const E = lerp2(E0, [.15, -.12], fold), W = lerp2(W0, [.16, -.36], fold);
  const chord1 = W_.chord1 + (.1 - W_.chord1) * fold, chord2 = W_.chord2 + (.1 - W_.chord2) * fold;
  const back = a => [Math.sin(a), -Math.cos(a)];
  const aE = Math.atan2(E[1] - S[1], E[0] - S[0]), aW = Math.atan2(W[1] - E[1], W[0] - E[0]);
  const bE = back(aE), bW = back(aW);
  const St = [S[0], S[1] - chord1], Et = [E[0] + bE[0] * chord1 * .95, E[1] + bE[1] * chord1 * .95], Wt = [W[0] + bW[0] * chord2, W[1] + bW[1] * chord2];
  const uE = E[0], open = 1 - fold;
  const a1 = (sgn > 0 ? p.flapL : p.flapR) + W_.dihedral * open, a2 = a1 + (sgn > 0 ? p.handL : p.handR) + W_.droop * open;
  const xMin = .03 * fold, keep = v => (sgn * v[0] < xMin ? [sgn * xMin, v[1], v[2]] : v);
  const P = (q, y = 0) => {
    if (q[0] <= uE) return keep(rotZ(q[0], y, q[1], a1, sgn));
    const inner = rotZ(uE, 0, 0, a1, sgn), du = q[0] - uE;
    return keep([inner[0] + sgn * du * Math.cos(a2), inner[1] + du * Math.sin(a2) + y + .03 * fold, q[1]]);
  };
  const up = [-sgn * Math.sin(a1) * .5, Math.cos(a1), 0], lead = .035;
  const Sl = [S[0], S[1] - lead], El = [E[0] + bE[0] * lead, E[1] + bE[1] * lead], Wl = [W[0] + bW[0] * lead, W[1] + bW[1] * lead];
  quad(P(S), P(E), P(El), P(Sl), col(T.lead), col(U.bar), up);
  quad(P(Sl), P(El), P(Et), P(St), col(T.covert), col(U.covert), up);
  quad(P(E), P(W), P(Wl), P(El), col(T.lead), col(U.wrist), up);
  quad(P(El), P(Wl), P(Wt), P(Et), col(T.hand), col(U.hand), up);
  for (const [A0, A1, B0, B1, cT, cU, m] of [[Sl, El, St, Et, T.lead, U.bar, .38], [El, Wl, Et, Wt, T.lead, U.wrist, .45]]) {
    for (let i = 0; i < 4; i++) {
      const t0 = i / 4, t1 = (i + 1) / 4, A = lerp2(A0, A1, t0), B = lerp2(A0, A1, t1);
      const Ad = lerp2(A, lerp2(B0, B1, t0), m), Bd = lerp2(B, lerp2(B0, B1, t1), m), tip = [(Ad[0] + Bd[0]) / 2, (Ad[1] + Bd[1]) / 2 - .025];
      quad(P(A, .005), P(B, .005), P(Bd, .005), P(Ad, .005), col(cT), col(cU), up);
      tri(P(Ad, .005), P(Bd, .005), P(tip, .005), col(cT), col(cU), up);
    }
  }
  if (W_.speculum) quad(P(lerp2(Sl, St, .55), .006), P(lerp2(El, Et, .55), .006), P(Et, .006), P(St, .006), W_.speculum, col(U.covert), up);
  const pr = W_.prims, n = pr.n + 2, fan0 = pr.fan[0] - flare * .25, fan1 = pr.fan[1] - flare * .35;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), base = [W[0] + (Wt[0] - W[0]) * t * .7, W[1] + (Wt[1] - W[1]) * t * .7];
    const angOpen = sweepE + sweepH + fan0 + (fan1 - fan0) * t + Math.sin(p.t * 9 + i) * .02;
    const ang = angOpen + (-Math.PI / 2 - .08 + (t - .5) * .06 - angOpen) * fold;
    const L = (pr.len - t * .1) * (1 - fold * .2), dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const w0 = .045 * pr.w * pr.n / n * 1.15, w1 = .026 * pr.w * pr.n / n * 1.15;
    const b1 = [base[0] + nrm[0] * w0, base[1] + nrm[1] * w0], b2 = [base[0] - nrm[0] * w0, base[1] - nrm[1] * w0];
    const m1 = [base[0] + dir[0] * L * .72 + nrm[0] * w1, base[1] + dir[1] * L * .72 + nrm[1] * w1];
    const m2 = [base[0] + dir[0] * L * .72 - nrm[0] * w1, base[1] + dir[1] * L * .72 - nrm[1] * w1];
    const tp = [base[0] + dir[0] * L, base[1] + dir[1] * L];
    const lift = open * pr.slot * (1 - t), k1 = [(b1[0] + m1[0]) / 2, (b1[1] + m1[1]) / 2], k2 = [(b2[0] + m2[0]) / 2, (b2[1] + m2[1]) / 2];
    // each feather in two panels and a tip, so it can bend up through its length
    quad(P(b1, i * .002), P(k1, lift * .3 + i * .002), P(k2, lift * .3 + i * .002), P(b2, i * .002), col(T.prim), col(U.prim), up);
    quad(P(k1, lift * .3 + i * .002), P(m1, lift * .7 + i * .002), P(m2, lift * .7 + i * .002), P(k2, lift * .3 + i * .002), col(T.prim), col(U.prim), up);
    tri(P(m1, lift * .7 + i * .002), P(tp, lift + i * .002), P(m2, lift * .7 + i * .002), col(T.tip), col(U.tip), up);
  }
  const Et2 = [Et[0] + bE[0] * .03, Et[1] + bE[1] * .03], St2 = [St[0], St[1] - .03], Wt2 = [Wt[0] + bW[0] * .03, Wt[1] + bW[1] * .03];
  quad(P(St), P(Et), P(Et2), P(St2), col(T.trail), col(U.trail), up);
  quad(P(Et), P(Wt), P(Wt2), P(Et2), col(T.trail), col(U.trail), up);
}

function tail(sp, p) {
  const Tl = sp.tail, n = Math.round(Tl.n * 1.5), spread = Tl.spread[0] + p.tail * Tl.spread[1], base = Tl.base, up = [0, 1, 0], droop = p.tailPitch || 0;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, a = u * spread;
    const L = Tl.len * (Tl.shape === 'fork' ? 1 + .55 * Math.abs(u) : Tl.shape === 'wedge' ? 1 - .35 * Math.abs(u) : 1);
    const dir = [Math.sin(a), -Math.sin(droop) * .8, -Math.cos(a)], side = [Math.cos(a), 0, Math.sin(a)], w = (.045 + p.tail * .012) * Tl.n / n * 1.25;
    const lay = (i % 2) * .004 + i * .0015;   // feathers overlap like shingles
    const at = (k, s) => [base[0] + dir[0] * L * k + side[0] * w * s, base[1] + dir[1] * L * k + lay - .01 * k * k, base[2] + dir[2] * L * k + side[2] * w * s];
    quad(at(0, -.5), at(0, .5), at(.4, .8), at(.4, -.8), Tl.top, Tl.under, up);
    quad(at(.4, -.8), at(.4, .8), at(.8, 1), at(.8, -1), Tl.top, Tl.under, up);
    quad(at(.8, -1), at(.8, 1), at(1, Tl.shape === 'fork' ? .3 : .8), at(1, Tl.shape === 'fork' ? -.3 : -.8), Tl.bar || Tl.top, Tl.under, up);
  }
}

function legs(sp, p) {
  const Lg = sp.legs, down = Math.min(1, p.legs), dark = [.12, .1, .09];
  for (const sx of [1, -1]) {
    const a = [sx * Lg.at[0], Lg.at[1], Lg.at[2]];
    // a heron's legs trail behind it in the air and swing down to stand
    const d = Lg.trail ? [0, -.04 - (Lg.len - .04) * down, -Lg.len * (1 - down) + .03 * down] : [0, -Lg.len * down, Lg.len * .2 * down];
    const b = [a[0] + d[0], a[1] + d[1], a[2] + d[2]], w = .012 * (Lg.len > .4 ? 1.1 : 1);
    for (const [u0, v0, u1, v1] of [[-1, 0, 0, 1], [0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0]]) {
      quad([a[0] + u0 * w, a[1], a[2] + v0 * w], [a[0] + u1 * w, a[1], a[2] + v1 * w], [b[0] + u1 * w * .8, b[1], b[2] + v1 * w * .8], [b[0] + u0 * w * .8, b[1], b[2] + v0 * w * .8], Lg.col, Lg.col);
    }
    if (Lg.foot === 'web') {
      tri([b[0] - .035, b[1], b[2] + .06], [b[0] + .035, b[1], b[2] + .06], [b[0], b[1] + .005, b[2] - .01], Lg.col, Lg.col);
    } else if (Lg.foot === 'toes') {
      const f = Lg.trail ? [0, -(1 - down) * .02, -(1 - down)] : [0, 0, 1];
      for (const dx of [-.03, 0, .03]) tri([b[0] - .006, b[1], b[2]], [b[0] + .006, b[1], b[2]], [b[0] + dx, b[1] + f[1] * .1 - .004, b[2] + (down > .5 ? .09 : -.09)], Lg.col, Lg.col);
    } else {
      for (const [dx, dz] of [[-.022, .04], [0, .046], [.022, .04], [0, -.032]]) {
        const tip = [b[0] + dx, b[1] - .012, b[2] + dz];
        tri([b[0] - .008, b[1], b[2]], [b[0] + .008, b[1], b[2]], tip, Lg.col, Lg.col);
        tri([tip[0] - .004, tip[1] + .003, tip[2]], [tip[0] + .004, tip[1] + .003, tip[2]], [tip[0], tip[1] - .012, tip[2] + Math.sign(dz) * .008], dark, dark);
      }
    }
  }
}
