// Low-poly shapes for instancing: trees (unit height), a ring, a mote. Same vertex layout as
// the ground: pos, normal, colour, colour. Instances tint and scale them.
import { PAL, TREE, LOOKS } from './world.js';

export function builder() {
  const a = [];
  const tri = (p, q, r, col, j = 0) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const k = 1 + j;
    for (const v of [p, q, r]) a.push(v[0], v[1], v[2], nx, ny, nz, col[0] * k, col[1] * k, col[2] * k, col[0] * k, col[1] * k, col[2] * k);
  };
  return { tri, out: () => new Float32Array(a) };
}
let seed = 1; export const reseed = n => { seed = n; }; export const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// an upright prism; rib < 1 pulls every other corner in (a fluted cactus, a ribbed trunk)
export function prism(B, x, z, r0, r1, y0, y1, sides, col, rib = 1) {
  const k = i => (i & 1 ? rib : 1);
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2, ka = k(i), kb = k(i + 1);
    const p0 = [x + Math.cos(a) * r0 * ka, y0, z + Math.sin(a) * r0 * ka], p1 = [x + Math.cos(b) * r0 * kb, y0, z + Math.sin(b) * r0 * kb];
    const q0 = [x + Math.cos(a) * r1 * ka, y1, z + Math.sin(a) * r1 * ka], q1 = [x + Math.cos(b) * r1 * kb, y1, z + Math.sin(b) * r1 * kb];
    B.tri(p0, q1, p1, col, (rnd() - .5) * .08); B.tri(p0, q0, q1, col, (rnd() - .5) * .08);
    if (r1 > .001) B.tri(q0, [x, y1, z], q1, col);   // the top, so a stone or post seen from above is closed
  }
}
// a cone of needles; serr > 0 gives it a ragged skirt: every other point tucked in and up, the
// rest drooping, with a fold halfway up each facet so the tier reads as layered boughs
export function cone(B, y0, y1, r, sides, col, twist = 0, serr = 0) {
  const P = Array.from({ length: sides }, (_, i) => {
    const a = i / sides * Math.PI * 2 + twist, tuck = serr && i & 1, rr = r * (tuck ? 1 - serr : .88 + rnd() * .24);
    return [Math.cos(a) * rr, y0 + (tuck ? serr * .25 * (y1 - y0) : -rnd() * .03 - (serr ? .04 * (y1 - y0) : 0)), Math.sin(a) * rr];
  });
  for (let i = 0; i < sides; i++) {
    const p0 = P[i], p1 = P[(i + 1) % sides], j = (rnd() - .5) * .14;
    if (serr) {
      // the facet folds at a ring 40% of the way up, pushed out a little
      const m = t => [t[0] * .66, y0 + (y1 - y0) * .4, t[2] * .66], m0 = m(p0), m1 = m(p1);
      B.tri(p0, m0, p1, col, j); B.tri(p1, m0, m1, col, j + .03); B.tri(m0, [0, y1, 0], m1, col, j + .06);
    } else B.tri(p0, [0, y1, 0], p1, col, j);
    B.tri(p0, p1, [0, y0 + .02, 0], col, -.25);
  }
}
// a lumpy low-poly ball: an octahedron split lv times (1: 32 facets, 2: 128), pushed out to a
// sphere and jittered (finer balls are jittered less, so they read as rounder, not spikier)
export function blob(B, cx, cy, cz, r, col, col2, sc = [1, .85, 1], lv = 1) {
  const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]].map(f => f.map(i => V[i]));
  const cache = new Map(), jit = lv > 1 ? .18 : .3;
  const norm = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const mid = (a, b) => norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  const key = v => v.map(x => x.toFixed(3)).join();
  const pt = v => { const k = key(v); if (!cache.has(k)) { const j = 1 - jit / 2 + rnd() * jit; cache.set(k, [cx + v[0] * r * j * sc[0], cy + v[1] * r * j * sc[1], cz + v[2] * r * j * sc[2]]); } return cache.get(k); };
  for (let l = 0; l < lv; l++) F = F.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]; });
  for (const [p, q, s] of F) B.tri(pt(p), pt(s), pt(q), rnd() < .5 ? col : col2, (rnd() - .5) * .12);
}

export function broadleaf() {
  seed = 7; const B = builder(), r = TREE.trunkR[0];
  prism(B, 0, 0, r * 1.7, r, -.05, .05, 8, PAL.bark, .7);   // root flare
  prism(B, 0, 0, r, r * .8, .05, TREE.trunkH[0] * .6, 8, PAL.bark, .9);
  prism(B, 0, 0, r * .8, r * .6, TREE.trunkH[0] * .6, TREE.trunkH[0] + .1, 8, PAL.bark, .9);
  // the limbs (perches under the canopy, see TREE.limbs), each with a tuft at its tip
  for (const [o, y, l] of TREE.limbs[0]) limb(B, o, y, l, TREE.limbR[0], PAL.leaf, PAL.leaf2);
  const R = TREE.crownR;
  blob(B, 0, TREE.crownY, 0, R, PAL.leaf, PAL.leaf2, undefined, 2);
  blob(B, R * .55, TREE.crownY - .08, R * .3, R * .62, PAL.leaf2, PAL.leaf, undefined, 2);
  blob(B, -R * .5, TREE.crownY - .05, -R * .35, R * .6, PAL.leaf, PAL.leaf2, undefined, 2);
  blob(B, 0, TREE.crownY + R * .55, 0, R * .5, PAL.leaf2, PAL.leaf, undefined, 2);
  blob(B, -R * .2, TREE.crownY - .02, R * .62, R * .5, PAL.leaf2, PAL.leaf);
  blob(B, R * .35, TREE.crownY + .1, -R * .55, R * .45, PAL.leaf, PAL.leaf2);
  return B.out();
}
// a limb from the trunk at height y, turned o from +x, l long, r thick, rising a little to a tuft
function limb(B, o, y, l, r, leaf, leaf2, bark = PAL.bark) {
  const c = Math.cos(o), s = Math.sin(o);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, b = (i + 1) / 6 * Math.PI * 2;
    const p = (t, ang) => { const u = t * l, w = Math.cos(ang) * r * (1 - t * .5); return [u * c - w * s, y - .04 + t * .06 + Math.sin(ang) * r * (1 - t * .5), u * s + w * c]; };
    B.tri(p(0, a), p(1, b), p(1, a), bark); B.tri(p(0, a), p(0, b), p(1, b), bark);
  }
  if (leaf) blob(B, l * 1.05 * c, y + .06, l * 1.05 * s, .07, leaf, leaf2);
}
export function pine() {
  seed = 11; const B = builder();
  prism(B, 0, 0, TREE.trunkR[1] * 1.5, TREE.trunkR[1], -.05, .04, 7, PAL.bark, .7);
  prism(B, 0, 0, TREE.trunkR[1], TREE.trunkR[1] * .5, .04, .5, 7, PAL.bark);
  for (const [o, y, l] of TREE.limbs[1]) limb(B, o, y, l, TREE.limbR[1]);   // bare limbs reaching out past the needles
  cone(B, .16, .5, .27, 12, PAL.pine, 0, .3);
  cone(B, .32, .66, .23, 12, PAL.pine2, .4, .3);
  cone(B, .48, .8, .18, 10, PAL.pine, .8, .3);
  cone(B, .64, .92, .13, 10, PAL.pine2, 1.2, .3);
  cone(B, .8, 1.0, .08, 8, PAL.pine, 1.6, .25);
  return B.out();
}
export function ring() {
  const B = builder(), N = 20, M = 5, R = 1, r = .09;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const P = (a, b) => [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(a) * (R + Math.cos(b) * r), Math.sin(b) * r];
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, b0 = j / M * Math.PI * 2, b1 = (j + 1) / M * Math.PI * 2;
    B.tri(P(a0, b0), P(a1, b0), P(a1, b1), PAL.ring); B.tri(P(a0, b0), P(a1, b1), P(a0, b1), PAL.ring);
  }
  return B.out();
}

// a cumulus cap for a thermal: a few lumpy balls, flat underneath
export function cloud() {
  seed = 19; const B = builder(), W = [.97, .96, .93], S = [.9, .89, .9];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, r = i ? .55 : 0;
    blob(B, Math.cos(a) * r, .1 + (i ? 0 : .25), Math.sin(a) * r * .7, i ? .45 + rnd() * .2 : .65, W, S);
  }
  return B.out();
}

// ---- the trees of the other lands (each look's limbs are in world.js LOOKS, so the hawk sits
// on real wood) ------------------------------------------------------------------------------
// a four-sided tube from p to q (roots, upturned arms)
export function tube(B, p, q, r, col) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d) || 1, u = Math.abs(d[1] / l) > .9 ? [1, 0, 0] : [0, 1, 0];
  const nrm = v => { const k = Math.hypot(...v) || 1; return v.map(x => x / k * r); };
  const s = nrm([d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]), t = nrm([d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]);
  const ring = c => [[c[0] + s[0], c[1] + s[1], c[2] + s[2]], [c[0] + t[0], c[1] + t[1], c[2] + t[2]], [c[0] - s[0], c[1] - s[1], c[2] - s[2]], [c[0] - t[0], c[1] - t[1], c[2] - t[2]]];
  const A = ring(p), Q = ring(q);
  for (let i = 0; i < 4; i++) { B.tri(A[i], A[(i + 1) % 4], Q[(i + 1) % 4], col); B.tri(A[i], Q[(i + 1) % 4], Q[i], col); }
}
const limbsOf = (B, look, leaf, leaf2, bark) => { for (const [o, y, l] of LOOKS[look].limbs) limb(B, o, y, l, LOOKS[look].limbR, leaf, leaf2, bark); };
export function birch() {
  seed = 13; const B = builder(), dark = [.25, .24, .22];
  prism(B, 0, 0, .03, .018, -.05, .8, 8, PAL.birch);
  for (const y of [.08, .12, .2, .27, .34, .4, .5, .58]) prism(B, 0, 0, .031 - y * .014, .03 - y * .014, y, y + .012 + (y * 97 % 1) * .01, 8, dark);
  limbsOf(B, 2, PAL.birchLeaf, PAL.birchLeaf2, PAL.birch);
  blob(B, 0, .74, 0, .19, PAL.birchLeaf, PAL.birchLeaf2, [.9, 1.4, .9], 2);
  blob(B, .07, .56, .05, .14, PAL.birchLeaf2, PAL.birchLeaf, [1, 1.2, 1], 2);
  blob(B, -.06, .62, -.06, .13, PAL.birchLeaf, PAL.birchLeaf2, [1, 1.2, 1], 2);
  blob(B, -.04, .86, .05, .1, PAL.birchLeaf2, PAL.birchLeaf, [1, 1.3, 1]);
  return B.out();
}
export function redwood() {
  seed = 17; const B = builder();
  prism(B, 0, 0, .075, .04, -.05, .1, 10, PAL.redBark, .75);
  prism(B, 0, 0, .04, .028, .1, .5, 10, PAL.redBark, .85);
  prism(B, 0, 0, .028, .016, .5, .92, 8, PAL.redBark, .85);
  limbsOf(B, 3, null, null, PAL.redBark);
  cone(B, .4, .64, .15, 11, PAL.redLeaf, 0, .3);
  cone(B, .54, .78, .13, 11, PAL.pine, .5, .3);
  cone(B, .68, .9, .1, 9, PAL.redLeaf, 1, .3);
  cone(B, .8, 1.0, .07, 8, PAL.pine, 1.5, .25);
  return B.out();
}
export function acacia() {
  seed = 23; const B = builder();
  prism(B, 0, 0, .04, .03, -.05, .55, 8, PAL.bark, .85);
  limbsOf(B, 4, PAL.acacia, PAL.acacia2);
  for (const [o, y, l] of LOOKS[4].limbs) tube(B, [Math.cos(o) * l * .5, y, Math.sin(o) * l * .5], [Math.cos(o) * l * .8, .8, Math.sin(o) * l * .8], .012, PAL.bark);
  blob(B, 0, .84, 0, .42, PAL.acacia, PAL.acacia2, [1.25, .22, 1.25], 2);
  blob(B, .18, .9, .08, .26, PAL.acacia2, PAL.acacia, [1.2, .25, 1.2], 2);
  blob(B, -.2, .88, -.1, .22, PAL.acacia2, PAL.acacia, [1.2, .25, 1.2]);
  return B.out();
}
export function saguaro() {
  seed = 29; const B = builder(), L = LOOKS[5];
  prism(B, 0, 0, .05, .045, -.05, .94, 16, PAL.cactus, .82);
  blob(B, 0, .95, 0, .05, PAL.cactus2, PAL.cactus, [1, .9, 1], 2);
  for (const [o, y, l] of L.limbs) {
    limb(B, o, y, l, L.limbR, null, null, PAL.cactus2);
    const x = Math.cos(o) * l, z = Math.sin(o) * l;
    prism(B, x, z, .032, .028, y - .01, y + .26, 12, PAL.cactus, .82);
    blob(B, x, y + .26, z, .03, PAL.cactus2, PAL.cactus, undefined, 2);
  }
  return B.out();
}
export function joshua() {
  seed = 31; const B = builder(), bark = [.5, .43, .33], L = LOOKS[6];
  prism(B, 0, 0, .05, .035, -.05, .55, 8, bark, .8);
  prism(B, 0, 0, .03, .02, .55, .92, 7, bark, .8);
  const spikes = (x, y, z) => { blob(B, x, y, z, .07, PAL.joshua, PAL.acacia2, [1, .8, 1]); for (let i = 0; i < 9; i++) { const a = i * .7; B.tri([x + Math.cos(a) * .04, y, z + Math.sin(a) * .04], [x + Math.cos(a + .5) * .04, y, z + Math.sin(a + .5) * .04], [x + Math.cos(a) * .1, y + .07, z + Math.sin(a) * .1], PAL.joshua); } };
  for (const [o, y, l] of L.limbs) {
    limb(B, o, y, l, L.limbR, null, null, bark);
    const x = Math.cos(o) * l, z = Math.sin(o) * l;
    tube(B, [x, y + .02, z], [x * 1.15, y + .2, z * 1.15], .022, bark);
    spikes(x * 1.15, y + .22, z * 1.15);
  }
  spikes(0, .94, 0);
  return B.out();
}
export function mangrove() {
  seed = 37; const B = builder();
  for (let i = 0; i < 7; i++) {   // stilt roots arching down into the water
    const a = i / 7 * 6.283 + .3, r = .2 + (i % 3) * .04;
    tube(B, [Math.cos(a) * .02, .24, Math.sin(a) * .02], [Math.cos(a) * r * .6, .2, Math.sin(a) * r * .6], .012, PAL.bark);
    tube(B, [Math.cos(a) * r * .6, .2, Math.sin(a) * r * .6], [Math.cos(a) * r, -.08, Math.sin(a) * r], .012, PAL.bark);
  }
  prism(B, 0, 0, .04, .028, .15, .58, 8, PAL.bark, .85);
  limbsOf(B, 7, PAL.mangrove, PAL.leaf);
  blob(B, 0, .7, 0, .33, PAL.mangrove, PAL.leaf, [1.3, .75, 1.3], 2);
  blob(B, .26, .62, .1, .2, PAL.leaf, PAL.mangrove, undefined, 2);
  blob(B, -.22, .63, -.16, .2, PAL.mangrove, PAL.leaf, undefined, 2);
  return B.out();
}
// a spreading oak: a stout trunk forking low into a broad, flattened crown of many lumps
export function oak() {
  seed = 53; const B = builder(), L = LOOKS[8];
  prism(B, 0, 0, .1, .06, -.05, .06, 9, PAL.bark, .7);
  prism(B, 0, 0, .06, .048, .06, .36, 9, PAL.bark, .88);
  for (const [o, , l] of [[1.1, 0, .2], [3.3, 0, .18], [5.2, 0, .2]]) tube(B, [0, .34, 0], [Math.cos(o) * l, .58, Math.sin(o) * l], .028, PAL.bark);
  limbsOf(B, 8, PAL.leaf, PAL.leaf2);
  blob(B, 0, .7, 0, .34, PAL.leaf, PAL.leaf2, [1.35, .62, 1.35], 2);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283 + .4, r = .3 + (i % 2) * .08;
    blob(B, Math.cos(a) * r, .62 + (i % 3) * .05, Math.sin(a) * r, .2 + (i % 3) * .03, i & 1 ? PAL.leaf2 : PAL.leaf, PAL.leaf, [1.2, .75, 1.2], 1);
  }
  blob(B, .05, .86, -.04, .22, PAL.leaf2, PAL.leaf, [1.3, .6, 1.3], 1);
  return B.out();
}
// a poplar: tall and slender, a column of leaves nearly to the ground
export function poplar() {
  seed = 59; const B = builder(), col = [.42, .6, .3], col2 = [.5, .66, .33];
  prism(B, 0, 0, .032, .02, -.05, .25, 7, PAL.bark, .85);
  prism(B, 0, 0, .02, .01, .25, .9, 6, PAL.bark);
  limbsOf(B, 9, null, null);
  blob(B, 0, .58, 0, .2, col, col2, [.62, 2.15, .62], 2);
  blob(B, .04, .4, .03, .13, col2, col, [.8, 1.8, .8], 1);
  blob(B, -.04, .74, -.02, .11, col2, col, [.8, 1.8, .8], 1);
  return B.out();
}
// a spruce: narrow and dark, many short drooping tiers to a spire
export function spruce() {
  seed = 61; const B = builder(), d1 = [.22, .37, .3], d2 = [.28, .43, .34];
  prism(B, 0, 0, .03, .022, -.05, .04, 7, PAL.bark, .7);
  prism(B, 0, 0, .022, .008, .04, .96, 6, PAL.bark);
  limbsOf(B, 10, null, null);
  const T = 7;
  for (let i = 0; i < T; i++) { const u = i / T, y0 = .1 + u * .78; cone(B, y0, y0 + .2 + (1 - u) * .04, .19 * (1 - u * .82) + .03, 10, i & 1 ? d2 : d1, i * .45, .35); }
  return B.out();
}
// a juniper of the dry lands: a twisted trunk, silver dead wood and dense blue-green clumps
export function juniper() {
  seed = 67; const B = builder(), bark = [.47, .39, .3], dead = [.66, .62, .55], c1 = [.3, .43, .36], c2 = [.38, .5, .4];
  tube(B, [0, -.05, 0], [.06, .3, .03], .05, bark); tube(B, [.06, .3, .03], [-.02, .55, -.04], .035, bark);
  tube(B, [.06, .3, .03], [.24, .5, .1], .022, dead);   // a bleached limb, its tip bare
  limbsOf(B, 11, null, null, bark);
  blob(B, -.03, .66, -.05, .24, c1, c2, [1.25, .75, 1.1], 2);
  blob(B, .2, .5, .12, .14, c2, c1, [1.2, .7, 1.2], 1);
  blob(B, -.22, .5, .08, .15, c1, c2, [1.2, .7, 1], 1);
  blob(B, .08, .82, .02, .14, c2, c1, [1.2, .8, 1.2], 1);
  return B.out();
}
// a weeping willow by the water: a leaning trunk, a dome, and a curtain of hanging strands
export function willow() {
  seed = 71; const B = builder(), c1 = [.53, .64, .33], c2 = [.62, .7, .38];
  tube(B, [0, -.05, 0], [.05, .42, .02], .055, PAL.bark);
  limbsOf(B, 12, null, null);
  blob(B, .05, .68, .02, .32, c1, c2, [1.3, .62, 1.3], 2);
  blob(B, .2, .74, .1, .18, c2, c1, [1.2, .7, 1.2], 1);
  for (let i = 0; i < 22; i++) {   // strands: thin hanging blades round the rim, longest on the side it leans
    const a = i / 22 * 6.283 + rnd() * .2, r = .36 + rnd() * .06, x = .05 + Math.cos(a) * r, z = .02 + Math.sin(a) * r;
    const top = .66 + rnd() * .05, bot = .2 + rnd() * .14 - Math.cos(a) * .05, w = .06, tx = -Math.sin(a) * w, tz = Math.cos(a) * w, out = 1.08;
    const col = i & 1 ? c1 : c2;
    B.tri([x - tx, top, z - tz], [x + tx, top, z + tz], [.05 + (x - .05) * out, bot, .02 + (z - .02) * out], col);
    B.tri([x + tx, top, z + tz], [x - tx, top, z - tz], [.05 + (x - .05) * out, bot, .02 + (z - .02) * out], col);
  }
  return B.out();
}
// a giant sequoia: a vast fluted cinnamon trunk, bare for half its height, under a narrow,
// lumpy, round-topped crown
export function sequoia() {
  seed = 101; const B = builder(), bark = [.62, .34, .22], bark2 = [.55, .3, .2], c1 = [.27, .42, .3], c2 = [.33, .48, .33];
  prism(B, 0, 0, .13, .075, -.05, .08, 12, bark2, .7);   // the buttressed foot
  prism(B, 0, 0, .075, .055, .08, .45, 12, bark, .8);
  prism(B, 0, 0, .055, .025, .45, .96, 10, bark, .85);
  limbsOf(B, 13, null, null, bark);
  // a core of foliage up the top half, and clumps hung off it on the ends of hidden boughs
  blob(B, 0, .74, 0, .15, c1, c2, [1, 1.9, 1], 1);
  for (let i = 0; i < 16; i++) {
    const u = rnd(), y = .5 + u * .42, reach = .2 * (1 - u * .7), r = .055 + .06 * (1 - u) * (.7 + rnd() * .6), a = i * 2.4 + rnd() * .6;
    blob(B, Math.cos(a) * reach, y, Math.sin(a) * reach, r, i & 1 ? c1 : c2, i & 1 ? c2 : c1, [1.25, .6, 1.25], 1);
  }
  blob(B, 0, .95, 0, .07, c2, c1, [1, 1.1, 1], 1);
  return B.out();
}
// far versions: a trunk and one lump
function far(trunk, top, r, crown, y, cr, sc, col, col2) {
  return () => { seed = 41; const B = builder(); prism(B, 0, 0, r, r * .7, -.05, top, 4, trunk); if (crown) blob(B, 0, y, 0, cr, col, col2, sc); return B.out(); };
}
// every tree look in LOOK order: its mesh, its far mesh (null: the renderer's own) and how
// much its leaves turn in autumn
export const TREE_LOOKS = [
  { near: broadleaf, far: null, autumn: 1 },
  { near: pine, far: null, autumn: 0 },
  { near: birch, far: far(PAL.birch, .8, .03, 1, .7, .22, [.9, 1.5, .9], PAL.birchLeaf, PAL.birchLeaf2), autumn: 1.4 },
  { near: redwood, far: () => { seed = 43; const B = builder(); prism(B, 0, 0, .05, .02, -.05, .5, 4, PAL.redBark); cone(B, .38, 1, .15, 5, PAL.redLeaf); return B.out(); }, autumn: 0 },
  { near: acacia, far: far(PAL.bark, .8, .035, 1, .86, .42, [1.25, .22, 1.25], PAL.acacia, PAL.acacia2), autumn: .25 },
  { near: saguaro, far: saguaro, autumn: 0 },
  { near: joshua, far: joshua, autumn: 0 },
  { near: mangrove, far: far(PAL.bark, .55, .04, 1, .68, .34, [1.3, .75, 1.3], PAL.mangrove, PAL.leaf), autumn: .1 },
  { near: oak, far: far(PAL.bark, .5, .055, 1, .7, .42, [1.35, .6, 1.35], PAL.leaf, PAL.leaf2), autumn: 1 },
  { near: poplar, far: far(PAL.bark, .6, .03, 1, .56, .22, [.62, 2, .62], [.42, .6, .3], [.5, .66, .33]), autumn: 1.3 },
  { near: spruce, far: () => { seed = 73; const B = builder(); prism(B, 0, 0, .03, .01, -.05, .3, 4, PAL.bark); cone(B, .08, 1, .2, 5, [.22, .37, .3]); return B.out(); }, autumn: 0 },
  { near: juniper, far: far([.47, .39, .3], .5, .04, 1, .64, .28, [1.2, .8, 1.1], [.3, .43, .36], [.38, .5, .4]), autumn: 0 },
  { near: willow, far: far(PAL.bark, .45, .05, 1, .55, .4, [1.15, 1, 1.15], [.53, .64, .33], [.62, .7, .38]), autumn: .8 },
  { near: sequoia, far: far([.62, .34, .22], .6, .08, 1, .72, .19, [1, 1.35, 1], [.27, .42, .3], [.33, .48, .33]), autumn: 0 },
];

// ---- bushes (world.js bushesNear; drawn by sys/bushes.js): unit height, perched on top --------
// a round leafy shrub (hazel, hawthorn) at wood edges and in the meadows
export function shrub() {
  seed = 79; const B = builder();
  blob(B, 0, .55, 0, .48, PAL.leaf2, PAL.leaf, [1.15, .95, 1.1], 2);
  blob(B, .4, .38, .15, .32, PAL.leaf, PAL.leaf2, [1, .9, 1], 1);
  blob(B, -.36, .36, -.14, .3, PAL.moss, PAL.leaf2, [1, .9, 1], 1);
  blob(B, .08, .32, -.38, .28, PAL.leaf, PAL.moss, [1, .9, 1], 1);
  return B.out();
}
// gorse on the moors and the coast: dark spiny lumps flecked with yellow flowers
export function gorse() {
  seed = 83; const B = builder(), c1 = [.3, .42, .26], c2 = [.36, .48, .28], fl = [.93, .78, .26];
  blob(B, 0, .5, 0, .5, c1, c2, [1.2, .95, 1.1], 1);
  blob(B, .42, .32, .1, .32, c2, c1, [1, .9, 1], 1);
  blob(B, -.38, .3, .14, .3, c1, c2, [1, .9, 1], 1);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 6.283, u = rnd() * .9, r = .5 * Math.cos(u * 1.2) * 1.15 + .02, y = .5 + Math.sin(u) * .47, x = Math.cos(a) * r, z = Math.sin(a) * r;
    B.tri([x, y, z], [x + .07, y + .02, z + .03], [x + .02, y + .07, z - .04], fl);
  }
  return B.out();
}
// sagebrush of the dry lands: a wide grey-green mound on a few twisted stems
export function sage() {
  seed = 89; const B = builder(), c1 = [.55, .6, .48], c2 = [.63, .67, .53], st = [.45, .4, .33];
  for (let i = 0; i < 4; i++) { const a = i * 1.7; tube(B, [0, -.05, 0], [Math.cos(a) * .25, .4, Math.sin(a) * .25], .03, st); }
  blob(B, 0, .58, 0, .45, c1, c2, [1.3, .8, 1.2], 1);
  blob(B, .36, .5, .2, .3, c2, c1, [1.1, .8, 1.1], 1);
  blob(B, -.34, .48, -.16, .3, c1, c2, [1.1, .8, 1.1], 1);
  return B.out();
}
// a thorn bush of the savanna: bare stems fanning up to a flat green top
export function thorn() {
  seed = 97; const B = builder(), st = [.42, .34, .26];
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + .3; tube(B, [Math.cos(a) * .05, -.05, Math.sin(a) * .05], [Math.cos(a) * .42, .78, Math.sin(a) * .42], .025, st); }
  blob(B, 0, .84, 0, .5, PAL.acacia, PAL.acacia2, [1.4, .3, 1.4], 1);
  blob(B, .3, .8, .2, .3, PAL.acacia2, PAL.acacia, [1.3, .35, 1.3], 1);
  return B.out();
}
export const BUSH_SHAPES = { bush: shrub, gorse, sage, thorn };
