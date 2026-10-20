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
let seed = 1; export const reseed = n => { seed = n; }; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function prism(B, x, z, r0, r1, y0, y1, sides, col) {
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    const p0 = [x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0], p1 = [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0];
    const q0 = [x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], q1 = [x + Math.cos(b) * r1, y1, z + Math.sin(b) * r1];
    B.tri(p0, q1, p1, col, (rnd() - .5) * .08); B.tri(p0, q0, q1, col, (rnd() - .5) * .08);
  }
}
export function cone(B, y0, y1, r, sides, col, twist = 0) {
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2 + twist, b = (i + 1) / sides * Math.PI * 2 + twist, rr = r * (.85 + rnd() * .3);
    const p0 = [Math.cos(a) * rr, y0 - rnd() * .03, Math.sin(a) * rr], p1 = [Math.cos(b) * r, y0, Math.sin(b) * r];
    B.tri(p0, [0, y1, 0], p1, col, (rnd() - .5) * .14);
    B.tri(p0, p1, [0, y0 + .02, 0], col, -.25);
  }
}
// a lumpy low-poly ball: an octahedron split once, pushed out to a sphere and jittered
export function blob(B, cx, cy, cz, r, col, col2, sc = [1, .85, 1]) {
  const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
  const cache = new Map();
  const norm = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const key = v => v.map(x => x.toFixed(3)).join();
  const pt = v => { const k = key(v); if (!cache.has(k)) { const j = .85 + rnd() * .3; cache.set(k, [cx + v[0] * r * j * sc[0], cy + v[1] * r * j * sc[1], cz + v[2] * r * j * sc[2]]); } return cache.get(k); };
  for (const [i, j, k] of F) {
    const a = V[i], b = V[j], c = V[k];
    const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]), ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
    for (const [p, q, s] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) B.tri(pt(p), pt(s), pt(q), rnd() < .5 ? col : col2, (rnd() - .5) * .12);
  }
}

export function broadleaf() {
  seed = 7; const B = builder();
  prism(B, 0, 0, TREE.trunkR[0], TREE.trunkR[0] * .6, -.05, TREE.trunkH[0] + .1, 5, PAL.bark);
  // the limbs (perches under the canopy, see TREE.limbs), each with a tuft at its tip
  for (const [o, y, l] of TREE.limbs[0]) limb(B, o, y, l, TREE.limbR[0], PAL.leaf, PAL.leaf2);
  const R = TREE.crownR;
  blob(B, 0, TREE.crownY, 0, R, PAL.leaf, PAL.leaf2);
  blob(B, R * .55, TREE.crownY - .08, R * .3, R * .62, PAL.leaf2, PAL.leaf);
  blob(B, -R * .5, TREE.crownY - .05, -R * .35, R * .6, PAL.leaf, PAL.leaf2);
  blob(B, 0, TREE.crownY + R * .55, 0, R * .5, PAL.leaf2, PAL.leaf);
  return B.out();
}
// a limb from the trunk at height y, turned o from +x, l long, r thick, rising a little to a tuft
function limb(B, o, y, l, r, leaf, leaf2, bark = PAL.bark) {
  const c = Math.cos(o), s = Math.sin(o);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2, b = (i + 1) / 4 * Math.PI * 2;
    const p = (t, ang) => { const u = t * l, w = Math.cos(ang) * r * (1 - t * .5); return [u * c - w * s, y - .04 + t * .06 + Math.sin(ang) * r * (1 - t * .5), u * s + w * c]; };
    B.tri(p(0, a), p(1, b), p(1, a), bark); B.tri(p(0, a), p(0, b), p(1, b), bark);
  }
  if (leaf) blob(B, l * 1.05 * c, y + .06, l * 1.05 * s, .07, leaf, leaf2);
}
export function pine() {
  seed = 11; const B = builder();
  prism(B, 0, 0, TREE.trunkR[1], TREE.trunkR[1] * .5, -.05, .5, 5, PAL.bark);
  for (const [o, y, l] of TREE.limbs[1]) limb(B, o, y, l, TREE.limbR[1]);   // bare limbs reaching out past the needles
  cone(B, .18, .62, .26, 7, PAL.pine, 0);
  cone(B, .42, .82, .2, 7, PAL.pine2, .4);
  cone(B, .64, 1.0, .13, 6, PAL.pine, .8);
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
  prism(B, 0, 0, .03, .018, -.05, .8, 5, PAL.birch);
  for (const y of [.12, .27, .4, .58]) prism(B, 0, 0, .031, .029, y, y + .018, 5, dark);
  limbsOf(B, 2, PAL.birchLeaf, PAL.birchLeaf2, PAL.birch);
  blob(B, 0, .74, 0, .19, PAL.birchLeaf, PAL.birchLeaf2, [.9, 1.4, .9]);
  blob(B, .07, .56, .05, .14, PAL.birchLeaf2, PAL.birchLeaf, [1, 1.2, 1]);
  blob(B, -.06, .62, -.06, .13, PAL.birchLeaf, PAL.birchLeaf2, [1, 1.2, 1]);
  return B.out();
}
export function redwood() {
  seed = 17; const B = builder();
  prism(B, 0, 0, .075, .04, -.05, .1, 6, PAL.redBark);
  prism(B, 0, 0, .04, .016, .1, .92, 6, PAL.redBark);
  limbsOf(B, 3, null, null, PAL.redBark);
  cone(B, .4, .64, .15, 7, PAL.redLeaf, 0);
  cone(B, .54, .78, .13, 7, PAL.pine, .5);
  cone(B, .68, .9, .1, 6, PAL.redLeaf, 1);
  cone(B, .8, 1.0, .07, 6, PAL.pine, 1.5);
  return B.out();
}
export function acacia() {
  seed = 23; const B = builder();
  prism(B, 0, 0, .04, .03, -.05, .55, 5, PAL.bark);
  limbsOf(B, 4, PAL.acacia, PAL.acacia2);
  for (const [o, y, l] of LOOKS[4].limbs) tube(B, [Math.cos(o) * l * .5, y, Math.sin(o) * l * .5], [Math.cos(o) * l * .8, .8, Math.sin(o) * l * .8], .012, PAL.bark);
  blob(B, 0, .84, 0, .42, PAL.acacia, PAL.acacia2, [1.25, .22, 1.25]);
  blob(B, .18, .9, .08, .26, PAL.acacia2, PAL.acacia, [1.2, .25, 1.2]);
  return B.out();
}
export function saguaro() {
  seed = 29; const B = builder(), L = LOOKS[5];
  prism(B, 0, 0, .05, .045, -.05, .94, 8, PAL.cactus);
  blob(B, 0, .95, 0, .05, PAL.cactus2, PAL.cactus, [1, .9, 1]);
  for (const [o, y, l] of L.limbs) {
    limb(B, o, y, l, L.limbR, null, null, PAL.cactus2);
    const x = Math.cos(o) * l, z = Math.sin(o) * l;
    prism(B, x, z, .032, .028, y - .01, y + .26, 6, PAL.cactus);
    blob(B, x, y + .26, z, .03, PAL.cactus2, PAL.cactus);
  }
  return B.out();
}
export function joshua() {
  seed = 31; const B = builder(), bark = [.5, .43, .33], L = LOOKS[6];
  prism(B, 0, 0, .05, .035, -.05, .55, 5, bark);
  prism(B, 0, 0, .03, .02, .55, .92, 5, bark);
  const spikes = (x, y, z) => { blob(B, x, y, z, .07, PAL.joshua, PAL.acacia2, [1, .8, 1]); for (let i = 0; i < 5; i++) { const a = i * 1.26; B.tri([x + Math.cos(a) * .04, y, z + Math.sin(a) * .04], [x + Math.cos(a + .5) * .04, y, z + Math.sin(a + .5) * .04], [x + Math.cos(a) * .1, y + .07, z + Math.sin(a) * .1], PAL.joshua); } };
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
  prism(B, 0, 0, .04, .028, .15, .58, 5, PAL.bark);
  limbsOf(B, 7, PAL.mangrove, PAL.leaf);
  blob(B, 0, .7, 0, .33, PAL.mangrove, PAL.leaf, [1.3, .75, 1.3]);
  blob(B, .26, .62, .1, .2, PAL.leaf, PAL.mangrove);
  blob(B, -.22, .63, -.16, .2, PAL.mangrove, PAL.leaf);
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
];
