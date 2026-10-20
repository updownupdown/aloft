// The 3D world, like the 2D one, is a pure function of position and a hash: terrain height,
// where trees stand, where thermals rise and rings hang. Only small caches are kept.
// Coordinates: x east, z south, y up, metres-ish. Water level is y = 0.

export const CHUNK = 96, CELLS = 16, CELL = CHUNK / CELLS;
export const WATER = 0;

// ---- noise -------------------------------------------------------------------------------
export function ih(ix, iz, s = 0) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function vn(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = ih(ix, iz, s), b = ih(ix + 1, iz, s), c = ih(ix, iz + 1, s), d = ih(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, s, oct = 3) {
  let v = 0, amp = .5, f = 1, sum = 0;
  for (let i = 0; i < oct; i++) { v += vn(x * f, z * f, s + i * 17) * amp; sum += amp; amp *= .5; f *= 2.03; }
  return v / sum * 2 - 1;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- terrain -----------------------------------------------------------------------------
// Rolling hills with lakes in the hollows; a ridged range rises where `mount` is high.
export function height(x, z) {
  const big = fbm(x / 520, z / 520, 1, 3);
  const mid = fbm(x / 150, z / 150, 2, 3);
  const mount = smooth(.15, .6, fbm(x / 1400 + 3.1, z / 1400, 3, 2));
  const ridge = (1 - Math.abs(fbm(x / 260, z / 260, 4, 3))) ** 2;
  let h = 13 + big * 34 + mid * 13 + fbm(x / 32, z / 32, 5, 2) * 1.6;
  h += mount * (ridge * 150 + 20);
  // a valley floor near the start so the first flight begins over a meadow and pond
  const d0 = Math.hypot(x, z + 60);
  h = h * smooth(30, 260, d0) + (d0 < 260 ? (1 - smooth(30, 260, d0)) * (6 + 10 * Math.min(1, d0 / 120) - 14 * Math.max(0, 1 - Math.hypot(x - 40, z + 150) / 55)) : 0);
  return h;
}
export function normalAt(x, z) {
  const e = 1.5, hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
}
// open meadow vs woodland: where trees grow
export const forest = (x, z) => fbm(x / 220, z / 220, 9, 2) - .35 * Math.max(0, 1 - Math.hypot(x, z + 60) / 200);

// ---- colours (Aloft's pigments, rgb 0..1) --------------------------------------------------
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const PAL = {
  sand: hex('#d9c08e'), meadow: hex('#9bb067'), meadow2: hex('#b8b56a'), wood: hex('#6f8f4e'), moss: hex('#57794a'),
  rock: hex('#8f8577'), rock2: hex('#a79c8a'), snow: hex('#f1ece0'), mud: hex('#7d6a4c'),
  bark: hex('#5c4632'), leaf: hex('#5f8a45'), leaf2: hex('#7a9a48'), leafA: hex('#c08a34'), pine: hex('#3e6446'), pine2: hex('#4f7556'),
  ring: hex('#e2a93a'),
};
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function groundColour(x, y, z, ny) {
  const steep = 1 - ny;
  let c = mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2)));
  c = mixc(c, PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .45);
  c = mixc(c, PAL.wood, smooth(-.1, .4, forest(x, z)) * .7);
  if (y < 1.8) c = mixc(PAL.sand, c, smooth(.4, 1.8, y));
  if (y < 0) c = mixc(PAL.mud, PAL.sand, clamp(1 + y / 6, 0, 1));
  c = mixc(c, mixc(PAL.rock, PAL.rock2, ih(x | 0, z | 0, 3)), smooth(.22, .42, steep));
  c = mixc(c, PAL.snow, smooth(120, 150, y + fbm(x / 40, z / 40, 7, 2) * 12) * smooth(.45, .25, steep));
  const j = .92 + ih(Math.floor(x * 7), Math.floor(z * 7), 5) * .14;   // a little pigment variation per facet
  return [c[0] * j, c[1] * j, c[2] * j];
}

// A chunk of ground as flat-shaded triangles: pos, normal, colour, colour (two-sided slot).
export function chunkMesh(cx, cz) {
  const N = CELLS, x0 = cx * CHUNK, z0 = cz * CHUNK;
  const H = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = height(x0 + i * CELL, z0 + j * CELL);
  const out = new Float32Array(N * N * 6 * 12 + N * 4 * 6 * 12); let o = 0;
  const tri = (ax, ay, az, bx, by, bz, cx_, cy, cz_) => {
    let ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx_ - ax, vy = cy - ay, vz = cz_ - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const col = groundColour((ax + bx + cx_) / 3, (ay + by + cy) / 3, (az + bz + cz_) / 3, Math.abs(ny));
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cx_, cy, cz_]]) {
      out[o++] = px; out[o++] = py; out[o++] = pz; out[o++] = nx; out[o++] = ny; out[o++] = nz;
      out[o++] = col[0]; out[o++] = col[1]; out[o++] = col[2]; out[o++] = col[0]; out[o++] = col[1]; out[o++] = col[2];
    }
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const xa = x0 + i * CELL, xb = xa + CELL, za = z0 + j * CELL, zb = za + CELL;
    const a = H[j * (N + 1) + i], b = H[j * (N + 1) + i + 1], c = H[(j + 1) * (N + 1) + i], d = H[(j + 1) * (N + 1) + i + 1];
    if ((i + j) & 1) { tri(xa, a, za, xa, c, zb, xb, b, za); tri(xb, b, za, xa, c, zb, xb, d, zb); }
    else { tri(xa, a, za, xa, c, zb, xb, d, zb); tri(xa, a, za, xb, d, zb, xb, b, za); }
  }
  return out.subarray(0, o);
}

// ---- trees -------------------------------------------------------------------------------
// Each tree: x, y, z, scale (height in m), yaw, kind (0 broadleaf, 1 pine), id.
// Shapes are in unit space (height 1); these numbers are shared by the mesh and collisions.
export const TREE = {
  trunkR: [.045, .04], trunkH: [.5, .35],
  crownY: .68, crownR: .3,                      // broadleaf crown sphere (soft)
  limbY: .42, limbL: .3,                        // broadleaf low limb, a perch under the canopy
};
const treeCache = new Map();
export function treesIn(cx, cz) {
  const key = cx + ',' + cz; let t = treeCache.get(key); if (t) return t;
  t = []; const G = 10, n = CHUNK / G;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = cx * n + i, gz = cz * n + j;
    const x = (gx + .15 + ih(gx, gz, 21) * .7) * G, z = (gz + .15 + ih(gx, gz, 22) * .7) * G;
    const f = forest(x, z), p = ih(gx, gz, 23);
    const dens = f > .32 ? .55 : f > .12 ? .2 : f > -.1 ? .03 : .008;
    if (p > dens) continue;
    const y = height(x, z); if (y < 1.2 || y > 135) continue;
    const nm = normalAt(x, z); if (nm[1] < .82) continue;
    if (Math.hypot(x, z + 60) < 22) continue;   // keep the starting spot clear
    const pine = (y > 60 || fbm(x / 300, z / 300, 31, 2) > .25) ? 1 : 0;
    const s = (pine ? 13 : 11) + ih(gx, gz, 24) * 9;
    t.push({ x, y: y - .3, z, s, yaw: ih(gx, gz, 25) * 6.283, kind: pine, id: gx * 7919 + gz, tint: ih(gx, gz, 26) });
  }
  treeCache.set(key, t);
  if (treeCache.size > 600) treeCache.delete(treeCache.keys().next().value);
  return t;
}
export function treesNear(x, z, r) {
  const out = [], c0 = Math.floor((x - r) / CHUNK), c1 = Math.floor((x + r) / CHUNK), d0 = Math.floor((z - r) / CHUNK), d1 = Math.floor((z + r) / CHUNK);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) for (const t of treesIn(cx, cz)) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r) out.push(t);
  return out;
}
// where a hawk can sit on a tree: the crown top, and for broadleaves the end of the low limb
export function perchesOf(t) {
  const p = [{ x: t.x, y: t.y + t.s * (t.kind ? 1.0 : .97), z: t.z, top: true }];
  if (!t.kind) p.push({ x: t.x + Math.cos(t.yaw) * t.s * TREE.limbL, y: t.y + t.s * (TREE.limbY + .03), z: t.z + Math.sin(t.yaw) * t.s * TREE.limbL, top: false });
  return p;
}

// ---- air ---------------------------------------------------------------------------------
// Thermals: one maybe per 240 m cell, over sunny ground. Each column leans a little downwind.
export const THERMAL_CELL = 240;
export function thermalAt(gx, gz) {
  if (ih(gx, gz, 41) > .62) return null;
  const x = (gx + .2 + ih(gx, gz, 42) * .6) * THERMAL_CELL, z = (gz + .2 + ih(gx, gz, 43) * .6) * THERMAL_CELL;
  if (height(x, z) < 1) return null;   // none over lakes
  return { x, z, r: 24 + ih(gx, gz, 44) * 16, w: 3.6 + ih(gx, gz, 45) * 2.4, top: 260 + ih(gx, gz, 46) * 180, id: gx * 104729 + gz };
}
export function thermalsNear(x, z, r) {
  const out = [], a = Math.floor((x - r) / THERMAL_CELL), b = Math.floor((x + r) / THERMAL_CELL), c = Math.floor((z - r) / THERMAL_CELL), d = Math.floor((z + r) / THERMAL_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const t = thermalAt(gx, gz); if (t) out.push(t); }
  return out;
}
// the column's centre at height y (it drifts with the wind as it rises)
export const WIND = [1, 0, .25];
export const thermalCentre = (t, y) => [t.x + WIND[0] * y * .12, t.z + WIND[2] * y * .12];

// vertical air speed at a point: thermals, ridge lift on windward slopes, gentle sink elsewhere
export function airLift(x, y, z, sun) {
  let w = -.25;
  for (const t of thermalsNear(x, z, 80)) {
    const [tx, tz] = thermalCentre(t, y), d = Math.hypot(x - tx, z - tz);
    if (d > t.r * 1.6 || y > t.top) continue;
    const k = Math.exp(-(d * d) / (t.r * t.r * .55)) * smooth(t.top, t.top - 60, y) * smooth(-2, 15, y - height(x, z));
    w += t.w * k * (.35 + .65 * sun) - (d > t.r ? .6 : 0);
  }
  const g = height(x, z), above = y - g;
  if (above < 70) {
    const n = normalAt(x, z), up = -(n[0] * WIND[0] + n[2] * WIND[2]);   // slope facing the wind
    if (up > 0) w += up * 9 * smooth(70, 10, above);
  }
  return w;
}

// Rings: one maybe per 170 m cell, floating 25 to 80 m above the ground.
export const RING_CELL = 170;
export function ringsNear(x, z, r) {
  const out = [], a = Math.floor((x - r) / RING_CELL), b = Math.floor((x + r) / RING_CELL), c = Math.floor((z - r) / RING_CELL), d = Math.floor((z + r) / RING_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
    if (ih(gx, gz, 51) > .55) continue;
    const rx = (gx + .2 + ih(gx, gz, 52) * .6) * RING_CELL, rz = (gz + .2 + ih(gx, gz, 53) * .6) * RING_CELL;
    const ry = Math.max(height(rx, rz), WATER) + 22 + ih(gx, gz, 54) * 55;
    out.push({ x: rx, y: ry, z: rz, yaw: ih(gx, gz, 55) * 6.283, r: 4.5, id: gx * 7907 + gz * 31 });
  }
  return out;
}
