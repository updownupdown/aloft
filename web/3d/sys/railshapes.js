// The old railway's meshes (rail.js says where it runs): the track in 200 m pieces (rusted rails
// on rotting sleepers, a few gone), the stone viaducts, a little station with its canopy and a
// rusting pair of carriages, and the tunnel mouths. All in world coordinates about a point.
import { builder, blob, tube, reseed, rnd } from '../shapes.js';
import { box } from './ruinshapes.js';

const STONE = [[.6, .58, .53], [.54, .52, .48], [.66, .63, .57]], MOSS = [.44, .5, .33], DARK = [.11, .11, .12];
const RUST = [.46, .3, .22], RUST2 = [.38, .25, .2], SLEEPER = [.3, .27, .24], SLATE = [.37, .38, .41], SLATE2 = [.31, .33, .36];
const pick = a => a[Math.floor(rnd() * a.length)];
const GAUGE = .72;

// a piece of track through its points ({ x, z, g }), y absolute, from its first point
export function track(ch) {
  reseed(701 + (ch.c & 1023)); const B = builder(), P = ch.pts, ox = P[0].x, oz = P[0].z;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], yaw = Math.atan2(b.z - a.z, b.x - a.x), nx = -Math.sin(yaw), nz = Math.cos(yaw), L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let u = 1.2; u < L; u += 2.5) {
      if (rnd() < .12) continue;   // rotted away
      const t = u / L, x = a.x + (b.x - a.x) * t - ox, z = a.z + (b.z - a.z) * t - oz, y = a.g + (b.g - a.g) * t;
      box(B, x, y - .02, z, .26, .12, 2.3, yaw + Math.PI / 2 + (rnd() - .5) * .08, SLEEPER);
    }
    for (const k of [-GAUGE, GAUGE]) tube(B, [a.x + nx * k - ox, a.g + .16, a.z + nz * k - oz], [b.x + nx * k - ox, b.g + .16, b.z + nz * k - oz], .06, rnd() < .5 ? RUST : RUST2);
  }
  return { tris: B.out(), at: [ox, oz] };
}
// a viaduct along its points: a pier at each, round-ish arches between them (stepped boxes, open
// below so you can fly through), the deck and its parapets; the piers stand in the river or the
// valley floor (p.h, the ground before the line was laid)
export function viaduct(v) {
  reseed(711); const B = builder(), P = v.pts, ox = P[0].x, oz = P[0].z;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], yaw = Math.atan2(b.z - a.z, b.x - a.x), L = Math.hypot(b.x - a.x, b.z - a.z), c = Math.cos(yaw), s = Math.sin(yaw);
    const at = u => [a.x + c * u - ox, a.z + s * u - oz], gy = u => a.g + (b.g - a.g) * u / L;
    // the deck: the arch's spandrels in steps, deeper toward each pier
    const N = 6;
    for (let k = 0; k < N; k++) {
      const u = (k + .5) / N * L, f = Math.max(Math.abs(2 * k / N - 1), Math.abs(2 * (k + 1) / N - 1)), drop = 1.3 + 5.5 * (1 - Math.sqrt(Math.max(0, 1 - f * f))), [x, z] = at(u), y = gy(u);
      box(B, x, y - drop, z, L / N + .02, drop, 4.4, yaw, pick(STONE), [.5, .48, .44]);
      for (const w of [-2.05, 2.05]) box(B, x - s * w, y, z + c * w, L / N + .02, .8, .3, yaw, pick(STONE), rnd() < .3 ? MOSS : pick(STONE));
    }
    // the pier at b (the far end is an abutment into the bank, drawn by the last point)
    if (i + 2 < P.length) {
      const [x, z] = at(L), top = b.g - 1.2, foot = Math.min(b.h, 0) - 2;
      if (top > foot) box(B, x, foot, z, 2.6, top - foot, 4.8, yaw, pick(STONE), MOSS);
      if (b.h < 0) box(B, x, -.6, z, 3.2, .9, 5.4, yaw, [.36, .4, .32]);   // weed at the waterline
    }
  }
  // the abutments at each end, down into the bank
  for (const [p, q] of [[P[0], P[1]], [P[P.length - 1], P[P.length - 2]]]) {
    const yaw = Math.atan2(q.z - p.z, q.x - p.x), lo = Math.min(p.h, q.h) - 1;
    if (p.g > lo) box(B, p.x - ox, lo, p.z - oz, 5, p.g - lo, 4.6, yaw, pick(STONE), [.5, .48, .44]);
  }
  return { tris: B.out(), at: [ox, oz] };
}
// the station (from its middle; the line runs along local x at local z = -9): a platform, a
// small stone booking hall with a slate roof, and a canopy on iron posts over the platform edge
export function station() {
  reseed(721); const B = builder();
  box(B, 0, -3.5, -5.6, 26, 4.4, 4, 0, STONE[1], [.58, .56, .52]);
  for (let u = -12; u <= 12; u += 2) box(B, u, .9, -7.45, 2, .04, .35, 0, [.7, .68, .62]);   // the pale edge stones
  box(B, 0, -3.5, 0, 8, 6.9, 4.2, 0, pick(STONE));
  for (const u of [-2.6, 2.6]) box(B, u, 1.4, -2.13, 1, 1.5, .06, 0, DARK);
  box(B, 0, .9, -2.13, 1.1, 2.1, .06, 0, [.24, .2, .17]);
  // the roof, hipped
  const y0 = 3.4;
  B.tri([-4.3, y0, -2.4], [4.3, y0, -2.4], [2.4, 5.4, 0], SLATE); B.tri([-4.3, y0, -2.4], [2.4, 5.4, 0], [-2.4, 5.4, 0], SLATE);
  B.tri([4.3, y0, 2.4], [-4.3, y0, 2.4], [-2.4, 5.4, 0], SLATE2); B.tri([4.3, y0, 2.4], [-2.4, 5.4, 0], [2.4, 5.4, 0], SLATE2);
  B.tri([4.3, y0, -2.4], [4.3, y0, 2.4], [2.4, 5.4, 0], SLATE); B.tri([-4.3, y0, 2.4], [-4.3, y0, -2.4], [-2.4, 5.4, 0], SLATE2);
  // the canopy: posts along the platform, a sloping roof, a few sheets gone
  for (let u = -9; u <= 9; u += 4.5) { tube(B, [u, .9, -6.6], [u, 4, -6.6], .07, [.25, .3, .28]); tube(B, [u, 4, -6.6], [u, 4.3, -2.2], .05, [.25, .3, .28]); }
  for (let u = -10; u < 10; u += 2.5) {
    if (rnd() < .2) continue;
    const q = [[u, 3.95, -7.2], [u + 2.5, 3.95, -7.2], [u + 2.5, 4.35, -2.2], [u, 4.35, -2.2]];
    B.tri(q[0], q[2], q[1], [.5, .54, .5]); B.tri(q[0], q[3], q[2], [.5, .54, .5]);
    B.tri(q[0], q[1], q[2], [.4, .44, .42]); B.tri(q[0], q[2], q[3], [.4, .44, .42]);
  }
  // the name board, its letters long weathered off
  tube(B, [6, .9, -4.2], [6, 2.6, -4.2], .05, [.25, .3, .28]); tube(B, [9, .9, -4.2], [9, 2.6, -4.2], .05, [.25, .3, .28]);
  box(B, 7.5, 2.2, -4.2, 3.4, .6, .08, 0, [.86, .84, .78]);
  return B.out();
}
// a carriage rusting on the rails (local x along the line), its windows dark; v 1: a sapling
// grown up through its broken roof
export function carriage(v) {
  reseed(731 + v); const B = builder(), body = v ? [.42, .3, .26] : [.36, .38, .32], roof = [.32, .3, .28];
  for (const u of [-3.2, 3.2]) for (const k of [-GAUGE, GAUGE]) tube(B, [u - .4, .5, k], [u + .4, .5, k], .32, DARK);
  box(B, 0, .55, 0, 9.4, .35, 2.2, 0, RUST2);
  box(B, 0, .9, 0, 9, 2.4, 2.6, 0, body, roof);
  for (let u = -3.6; u <= 3.6; u += 1.2) for (const k of [-1.31, 1.31]) box(B, u, 2, k, .8, .8, .03, 0, DARK);
  for (const k of [-1.31, 1.31]) for (let u = -4.4; u <= 4.4; u += .9) if (rnd() < .3) box(B, u, .95 + rnd() * .5, k, .5, .3 + rnd() * .5, .04, 0, rnd() < .5 ? RUST : RUST2);   // rust coming through
  if (v) {
    box(B, 1, 3.28, 0, 2.4, .06, 2.7, 0, DARK);   // the hole in the roof
    tube(B, [1, .9, 0], [1, 4.6, 0], .1, [.36, .3, .25]);
    blob(B, 1, 5.4, 0, 1.6, [.42, .55, .3], [.36, .5, .28], [1, 1, 1], 2);
    blob(B, 1.6, 4.6, .6, 1, [.4, .52, .28], [.46, .58, .32]);
  }
  return B.out();
}
// a tunnel mouth facing out along local -x (the tunnel runs off along +x): a stone face, the dark
// arch, and the hill above it
export function portal() {
  reseed(741); const B = builder();
  for (const k of [-1, 1]) box(B, 0, -1, k * 3.9, 1.6, 10, 3.4, 0, pick(STONE), MOSS);
  box(B, 0, 5.4, 0, 1.6, 3.6, 4.4, 0, pick(STONE), MOSS);
  for (let i = 0; i < 5; i++) { const a = i / 4 * Math.PI, r = 2.2; box(B, -.6, 4 + Math.sin(a) * 1.3, Math.cos(a) * r, .5, .4, .9, 0, STONE[2]); }
  box(B, .4, -1, 0, .5, 6.4, 4.4, 0, DARK);
  box(B, 0, 9, 0, 1.9, .4, 11.2, 0, STONE[1], MOSS);
  return B.out();
}
