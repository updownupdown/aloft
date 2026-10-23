// Meshes for the open sea's life and drift (sys/sealife.js, sys/drift.js, sys/isles.js): whales, turtles, flying
// fish, gulls, icebergs and floes, driftwood and a bottle. Real sizes in metres unless noted; the
// head or bow points along +x.
import { builder, blob, prism, tube, reseed, rnd } from '../shapes.js';

// a great whale's back, long and dark, a small fin far back and the blowholes forward. Unit: 1 m;
// the top of the back is at y = .55 (the bird stands there), the waterline at 0
export function whaleBack() {
  reseed(301); const B = builder(), d = [.24, .27, .31], d2 = [.29, .32, .36];
  // lofted from rings along its length: wide flat head, the back highest a third of the way, tapering to the tail stock
  const X = [7.2, 6.4, 5, 3, .5, -2, -4.2, -6, -7.2], half = [.2, .9, 1.5, 1.9, 1.9, 1.6, 1.1, .6, .3], top = [-.15, .3, .5, .58, .6, .5, .32, .05, -.2], N = 10;
  const ring = i => Array.from({ length: N + 1 }, (_, k) => { const a = k / N * Math.PI; return [X[i], -.8 + (top[i] + .8) * Math.sin(a) * (.9 + rnd() * .05 * (k % N ? 1 : 0)), Math.cos(a) * half[i]]; });
  const R = X.map((_, i) => ring(i));
  for (let i = 0; i < X.length - 1; i++) for (let k = 0; k < N; k++) {
    const c = k < 2 || k > N - 3 ? d2 : d, j = (rnd() - .5) * .06;   // a little paler down the flanks
    B.tri(R[i][k], R[i + 1][k], R[i + 1][k + 1], c, j); B.tri(R[i][k], R[i + 1][k + 1], R[i][k + 1], c, j);
  }
  B.tri([-3.4, .45, -.05], [-4.6, .3, 0], [-4.3, .95, 0], d); B.tri([-3.4, .45, .05], [-4.3, .95, 0], [-4.6, .3, 0], d);   // the small fin
  for (const z of [-.12, .12]) B.tri([5.2, .52, z], [5, .52, z * 2], [5.35, .5, z * 2], [.1, .1, .12]);   // the blowholes
  return B.out();
}
// the flukes, raised as it dives (the tail stock and the two blades)
export function fluke() {
  reseed(303); const B = builder(), d = [.22, .25, .29], pale = [.75, .76, .74];
  tube(B, [0, -2, 0], [0, 0, 0], .45, d);
  B.tri([0, 0, 0], [.2, .9, -2.2], [-.3, 1.2, -1.2], d); B.tri([0, 0, 0], [-.3, 1.2, -1.2], [.2, .9, -2.2], pale);
  B.tri([0, 0, 0], [.2, .9, 2.2], [-.3, 1.2, 1.2], d); B.tri([0, 0, 0], [-.3, 1.2, 1.2], [.2, .9, 2.2], pale);
  return B.out();
}
// a sea turtle paddling at the surface: a domed shell, flippers out
export function turtle() {
  reseed(307); const B = builder(), sh = [.36, .33, .22], sh2 = [.44, .38, .24], sk = [.5, .48, .38];
  blob(B, 0, 0, 0, .45, sh, sh2, [1.25, .38, 1], 1);
  blob(B, .62, .02, 0, .14, sk, sk, [1.3, .9, 1]);
  for (const [x, z, l] of [[.25, 1, .55], [.25, -1, .55], [-.35, 1, .3], [-.35, -1, .3]]) B.tri([x, 0, z * .3], [x + .15, 0, z * .3], [x - .2, -.02, z * (.3 + l)], sk);
  return B.out();
}
// a flying fish gliding on stiff wing-fins (unit: 1 m long)
export function flyingFish() {
  reseed(311); const B = builder(), bk = [.25, .38, .55], sd = [.82, .86, .9], fin = [.62, .74, .86];
  blob(B, 0, 0, 0, .1, bk, sd, [2.6, .6, .6]);
  B.tri([.06, .02, 0], [-.12, .02, .32], [-.16, .02, .05], fin); B.tri([.06, .02, 0], [-.16, .02, -.05], [-.12, .02, -.32], fin);
  B.tri([-.24, 0, 0], [-.4, .1, 0], [-.4, -.12, 0], bk);
  return B.out();
}
// a gull, wings up or down (unit: 1 m span)
export function gull(up) {
  reseed(313); const B = builder(), w = [.94, .94, .92], g = [.7, .72, .74], tip = [.2, .2, .22], y = up ? .16 : -.1;
  blob(B, 0, 0, 0, .08, w, w, [2.2, .8, .8]);
  B.tri([.08, 0, 0], [-.06, 0, 0], [0, y, .48], g); B.tri([-.06, 0, 0], [.08, 0, 0], [0, y, -.48], g);
  B.tri([0, y, .48], [-.06, 0, .3], [-.04, y * 1.1, .56], tip); B.tri([0, y, -.48], [-.04, y * 1.1, -.56], [-.06, 0, -.3], tip);
  return B.out();
}
// an iceberg: a tabular slab or a peaked berg (unit: 1 m; the slab is radius 1, its top at y = .35)
export function berg(peaked) {
  reseed(peaked ? 317 : 319); const B = builder(), w = [.93, .96, .98], b = [.72, .84, .9];
  if (peaked) {
    blob(B, 0, -.2, 0, 1, w, b, [1.1, 1.2, .9], 1);
    blob(B, .3, .45, .1, .55, w, b, [1, 1.5, .9], 1);
  } else {   // wide and flat: radius 1, the top .35 over the water
    prism(B, 0, 0, 1.04, 1, -1, .3, 8, b);
    prism(B, 0, 0, 1, .9, .28, .35, 8, w);
  }
  return B.out();
}
// a pan of sea ice (unit: 1 m across, a few centimetres proud of the water)
export function floe() {
  reseed(323); const B = builder(), w = [.9, .94, .96], b = [.74, .84, .9];
  const n = 9, P = Array.from({ length: n }, (_, i) => { const a = i / n * 6.283, r = .8 + rnd() * .3; return [Math.cos(a) * r, .12, Math.sin(a) * r]; });
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n];
    B.tri([0, .14, 0], q, p, w);
    B.tri(p, q, [q[0], -.15, q[2]], b); B.tri(p, [q[0], -.15, q[2]], [p[0], -.15, p[2]], b);
  }
  return B.out();
}
// a drifting tree trunk, silver with salt, a stub of root at one end (unit: 1 m long)
export function driftwood() {
  reseed(327); const B = builder(), w = [.66, .62, .55], w2 = [.56, .52, .46];
  tube(B, [-.5, 0, 0], [.5, 0, .02], .06, w);
  tube(B, [.5, 0, .02], [.58, .05, .12], .03, w2); tube(B, [.5, 0, .02], [.6, -.02, -.1], .03, w2);
  tube(B, [-.1, .02, 0], [-.22, .1, .14], .015, w2);
  return B.out();
}
// a glass bottle bobbing, a paper curled inside (unit: 1 m long)
export function bottle() {
  reseed(331); const B = builder(), g = [.42, .66, .58], g2 = [.55, .76, .68], p = [.94, .9, .78];
  blob(B, 0, 0, 0, .14, g, g2, [2.1, .9, .9], 1);
  tube(B, [.28, .01, 0], [.42, .02, 0], .04, g2);
  B.tri([-.15, .02, 0], [.12, .02, -.03], [.1, .06, .04], p);
  return B.out();
}
// a pool of rain water in the island rock (unit radius), and a nesting seabird sitting
export function pool() {
  reseed(337); const B = builder(), c = [.5, .62, .7], rim = [.48, .45, .42];
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, b = (i + 1) / 10 * 6.283; B.tri([0, .02, 0], [Math.cos(b), .02, Math.sin(b)], [Math.cos(a), .02, Math.sin(a)], c); B.tri([Math.cos(a), .02, Math.sin(a)], [Math.cos(b) * 1.2, .06, Math.sin(b) * 1.2], [Math.cos(a) * 1.2, .06, Math.sin(a) * 1.2], rim); }
  return B.out();
}
export function sitter() {
  reseed(339); const B = builder(), w = [.94, .94, .92], g = [.62, .64, .66];
  blob(B, 0, .12, 0, .13, w, g, [1.6, .9, .9]); blob(B, .17, .22, 0, .06, w, w);
  return B.out();
}
