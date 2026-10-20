// Low-poly shapes for instancing: trees (unit height), a ring, a mote. Same vertex layout as
// the ground: pos, normal, colour, colour. Instances tint and scale them.
import { PAL, TREE } from './world.js';

function builder() {
  const a = [];
  const tri = (p, q, r, col, j = 0) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const k = 1 + j;
    for (const v of [p, q, r]) a.push(v[0], v[1], v[2], nx, ny, nz, col[0] * k, col[1] * k, col[2] * k, col[0] * k, col[1] * k, col[2] * k);
  };
  return { tri, out: () => new Float32Array(a) };
}
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function prism(B, x, z, r0, r1, y0, y1, sides, col) {
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    const p0 = [x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0], p1 = [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0];
    const q0 = [x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], q1 = [x + Math.cos(b) * r1, y1, z + Math.sin(b) * r1];
    B.tri(p0, q1, p1, col, (rnd() - .5) * .08); B.tri(p0, q0, q1, col, (rnd() - .5) * .08);
  }
}
function cone(B, y0, y1, r, sides, col, twist = 0) {
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2 + twist, b = (i + 1) / sides * Math.PI * 2 + twist, rr = r * (.85 + rnd() * .3);
    const p0 = [Math.cos(a) * rr, y0 - rnd() * .03, Math.sin(a) * rr], p1 = [Math.cos(b) * r, y0, Math.sin(b) * r];
    B.tri(p0, [0, y1, 0], p1, col, (rnd() - .5) * .14);
    B.tri(p0, p1, [0, y0 + .02, 0], col, -.25);
  }
}
// a lumpy low-poly ball: an octahedron split once, pushed out to a sphere and jittered
function blob(B, cx, cy, cz, r, col, col2) {
  const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
  const cache = new Map();
  const norm = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const key = v => v.map(x => x.toFixed(3)).join();
  const pt = v => { const k = key(v); if (!cache.has(k)) { const j = .85 + rnd() * .3; cache.set(k, [cx + v[0] * r * j, cy + v[1] * r * j * .85, cz + v[2] * r * j]); } return cache.get(k); };
  for (const [i, j, k] of F) {
    const a = V[i], b = V[j], c = V[k];
    const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]), ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
    for (const [p, q, s] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) B.tri(pt(p), pt(s), pt(q), rnd() < .5 ? col : col2, (rnd() - .5) * .12);
  }
}

export function broadleaf() {
  seed = 7; const B = builder();
  prism(B, 0, 0, TREE.trunkR[0], TREE.trunkR[0] * .6, -.05, TREE.trunkH[0] + .1, 5, PAL.bark);
  // the low limb (a perch under the canopy), along +x; instances turn it by their yaw
  const lr = .018;
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2, b = (i + 1) / 4 * Math.PI * 2;
    const p = (t, ang) => [t * TREE.limbL, TREE.limbY - .04 + t * .06 + Math.sin(ang) * lr * (1 - t * .5), Math.cos(ang) * lr * (1 - t * .5)];
    B.tri(p(0, a), p(1, b), p(1, a), PAL.bark); B.tri(p(0, a), p(0, b), p(1, b), PAL.bark);
  }
  blob(B, TREE.limbL * .9, TREE.limbY + .08, 0, .08, PAL.leaf, PAL.leaf2);
  const R = TREE.crownR;
  blob(B, 0, TREE.crownY, 0, R, PAL.leaf, PAL.leaf2);
  blob(B, R * .55, TREE.crownY - .08, R * .3, R * .62, PAL.leaf2, PAL.leaf);
  blob(B, -R * .5, TREE.crownY - .05, -R * .35, R * .6, PAL.leaf, PAL.leaf2);
  blob(B, 0, TREE.crownY + R * .55, 0, R * .5, PAL.leaf2, PAL.leaf);
  return B.out();
}
export function pine() {
  seed = 11; const B = builder();
  prism(B, 0, 0, TREE.trunkR[1], TREE.trunkR[1] * .5, -.05, .5, 5, PAL.bark);
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
