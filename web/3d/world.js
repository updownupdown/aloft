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

// ---- the journey south and its lands -----------------------------------------------------
// South is +z. The lands come in bands along it (their edges wobble with x): lakes and woods
// at home, open meadows, the Great Ridge (a wall of peaks with a few passes), cliffs and high
// country, the coast (a bay of sea every few km east-west, ringed by sea cliffs), and from
// `marsh` on, the wintering marsh: flat, wet and full of pools.
export const JOURNEY = { home: 0, ridge: 3600, cliffs: 4600, coast: 6200, marsh: 9000 };
export const BAY = { x: 700, every: 4000, rx: 620, rz: 900 };
// what systems change at run time: the snowline (0 summer .. 1 deep winter, chunks must be
// rebuilt when it moves), the thermals' strength, and extra lift (storm cells, waves, kettles)
export const env = { snow: 0, thermal: 1, lifts: [] };

const wob = (x, z) => z + fbm(x / 900, z / 1300, 61, 2) * 320;
// band weights at a point, 0..1 each
export function bands(x, z) {
  const w = wob(x, z), J = JOURNEY;
  const ridge = Math.exp(-(((w - J.ridge) / 230) ** 2));
  const high = smooth(J.ridge - 200, J.ridge + 300, w) * (1 - smooth(J.coast - 900, J.coast - 400, w));
  const coast = smooth(J.coast - 1100, J.coast - 700, w) * (1 - smooth(J.coast + 700, J.coast + 1100, w));
  const marsh = smooth(J.marsh - 500, J.marsh + 150, w);
  const lakes = 1 - smooth(800, 1700, w);
  return { w, ridge, high, coast, marsh, lakes };
}
// where the bay's sea is: 0 inland, 1 open water (an ellipse with a wobbly shore)
export function bayAt(x, z, k = bands(x, z)) {
  if (k.coast < .01) return { d: 9, sea: 0 };
  const bx = BAY.x + Math.round((x - BAY.x) / BAY.every) * BAY.every;
  const d = Math.hypot((x - bx) / BAY.rx, (z - JOURNEY.coast) / BAY.rz) / Math.max(.05, k.coast) + fbm(x / 160, z / 160, 63, 2) * .12;
  return { d, sea: smooth(1, .965, d) };
}
export function biomeAt(x, z) {
  const k = bands(x, z), bay = bayAt(x, z, k);
  const name = k.marsh > .5 ? 'marsh' : bay.d < 1.35 ? 'coast' : k.ridge > .45 ? 'ridge' : k.high > .5 ? (cliffy(x, z) > .5 ? 'cliffs' : 'mountains')
    : forest(x, z) > .2 ? 'forest' : k.lakes > .5 ? 'lakeland' : 'meadow';
  return { name, k };
}
const cliffy = (x, z) => smooth(-.2, .12, fbm(x / 650, z / 650, 64, 2));
export function placeName(x, z) {
  const l = landmarksNear(x, z, 700).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  if (l && Math.hypot(l.x - x, l.z - z) < 400) return l.name;
  return { marsh: 'the wintering marsh', coast: 'the coast', ridge: 'the Great Ridge', cliffs: 'the cliffs', mountains: 'the high country', forest: 'the woods', lakeland: 'the lakelands', meadow: 'the meadows' }[biomeAt(x, z).name];
}

// ---- terrain -----------------------------------------------------------------------------
// Rolling hills with lakes in the hollows; ridged ranges where `mount` is high, more of them
// in the high country; then each band shapes its own ground.
export function height(x, z) {
  const k = bands(x, z);
  const big = fbm(x / 520, z / 520, 1, 3);
  const mid = fbm(x / 150, z / 150, 2, 3);
  const mount = smooth(.15, .6, fbm(x / 1400 + 3.1, z / 1400, 3, 2)) * (.5 + .4 * k.high) * (1 - k.marsh) * (1 - k.coast * .7);
  let h = 13 + big * 34 + mid * 13 + fbm(x / 32, z / 32, 5, 2) * 1.6 - k.lakes * smooth(-.1, -.5, big) * 9;
  if (mount > .001) h += mount * ((1 - Math.abs(fbm(x / 260, z / 260, 4, 3))) ** 2 * 150 + 20);
  // the Great Ridge: a wall of peaks east to west, notched by a few passes
  if (k.ridge > .01) {
    const peaks = .55 + .45 * (1 - Math.abs(fbm(x / 170, z / 170, 65, 2))) ** 2, pass = smooth(.25, .5, fbm(x / 520, 3.7, 66, 2));
    h += k.ridge * (210 * peaks * (1 - pass * .72) + 15);
  }
  // cliffs: the high country breaks into ledges with sheer rock between
  if (k.high > .01) {
    const c = cliffy(x, z) * k.high * .85;
    if (c > .01) { const t = Math.max(0, h) / 24, f = t - Math.floor(t); h += c * ((Math.floor(t) + smooth(.78, .96, f)) * 24 - h); }
  }
  // the coast: raised land behind the shore, falling sheer into a bay (sandy coves in places)
  if (k.coast > .01) {
    const bay = bayAt(x, z, k), cove = smooth(.1, .4, fbm(x / 300, z / 300, 67, 1));
    const sea = cove > .5 ? smooth(1.08, .9, bay.d) : bay.sea;
    h += 26 * smooth(1.45, 1, bay.d) * (1 - cove) * k.coast;
    h = h * (1 - sea) - 16 * sea;
  }
  // the marsh: low and flat, with pools and channels between reedy hummocks
  if (k.marsh > .01) h += k.marsh * (.55 + fbm(x / 55, z / 55, 68, 2) * 2.6 + fbm(x / 260, z / 260, 69, 2) * 1.8 - h);
  // a valley floor near the start so the first flight begins over a meadow and pond
  const d0 = Math.hypot(x, z + 60);
  if (d0 < 260) h = h * smooth(30, 260, d0) + (1 - smooth(30, 260, d0)) * (6 + 10 * Math.min(1, d0 / 120) - 14 * Math.max(0, 1 - Math.hypot(x - 40, z + 150) / 55));
  return h;
}
export function normalAt(x, z) {
  const e = 1.5, hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
}
// open meadow vs woodland: where trees grow
export const forest = (x, z) => {
  const k = bands(x, z);
  return fbm(x / 220, z / 220, 9, 2) - .35 * Math.max(0, 1 - Math.hypot(x, z + 60) / 200) - k.coast * .25 - k.marsh * .3 - k.ridge * .15;
};

// ---- colours (Aloft's pigments, rgb 0..1) --------------------------------------------------
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const PAL = {
  sand: hex('#d9c08e'), meadow: hex('#9bb067'), meadow2: hex('#b8b56a'), wood: hex('#6f8f4e'), moss: hex('#57794a'),
  rock: hex('#8f8577'), rock2: hex('#a79c8a'), snow: hex('#f1ece0'), mud: hex('#7d6a4c'),
  bark: hex('#5c4632'), leaf: hex('#5f8a45'), leaf2: hex('#7a9a48'), leafA: hex('#c08a34'), pine: hex('#3e6446'), pine2: hex('#4f7556'),
  ring: hex('#e2a93a'), reed: hex('#b3a35e'), reed2: hex('#8f9a55'), heath: hex('#9a8a62'), heather: hex('#8c6f78'),
};
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function groundColour(x, y, z, ny) {
  const steep = 1 - ny, k = bands(x, z);
  let c = mixc(PAL.meadow, PAL.meadow2, smooth(-.35, .35, fbm(x / 70, z / 70, 11, 2)));
  c = mixc(c, PAL.moss, smooth(.1, .5, fbm(x / 25, z / 25, 12, 2)) * .45);
  c = mixc(c, PAL.wood, smooth(-.1, .4, forest(x, z)) * .7);
  if (k.marsh > .01) c = mixc(c, mixc(PAL.reed, PAL.reed2, smooth(-.3, .3, fbm(x / 18, z / 18, 13, 2))), k.marsh * .85);
  if (k.coast > .01) c = mixc(c, mixc(PAL.heath, PAL.heather, smooth(.1, .5, fbm(x / 40, z / 40, 14, 2))), k.coast * .5);
  if (k.high + k.ridge > .01) c = mixc(c, PAL.heath, Math.min(1, k.high + k.ridge) * smooth(40, 110, y) * .5);
  if (y < 1.8) c = mixc(PAL.sand, c, smooth(.4, 1.8, y) * (k.marsh > .5 ? .6 : 1) + (k.marsh > .5 ? .4 : 0));
  if (y < 0) c = mixc(PAL.mud, PAL.sand, clamp(1 + y / 6, 0, 1));
  c = mixc(c, mixc(PAL.rock, PAL.rock2, ih(x | 0, z | 0, 3)), smooth(.22, .42, steep));
  // snow on the heights, and in winter right down to the meadows (not on cliffs, not below water)
  const line = 185 - env.snow * 200;
  c = mixc(c, PAL.snow, smooth(line - 5, line + 25, y + fbm(x / 40, z / 40, 7, 2) * 12) * smooth(.45, .25, steep) * (y > .3 ? 1 : 0));
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
    const k = bands(x, z);
    const y = height(x, z); if (y < 1.2 || y > 135) continue;
    const nm = normalAt(x, z); if (nm[1] < .82) continue;
    if (Math.hypot(x, z + 60) < 22) continue;   // keep the starting spot clear
    const pine = (y > 60 || k.coast > .5 || fbm(x / 300, z / 300, 31, 2) > .25 + k.marsh) && k.marsh < .5 ? 1 : 0;
    const s = (pine ? 13 : 11) + ih(gx, gz, 24) * 9;
    t.push({ x, y: y - .3, z, s, yaw: ih(gx, gz, 25) * 6.283, kind: pine, id: gx * 7919 + gz, tint: ih(gx, gz, 26) });
  }
  // clear the ground round each landmark; the giant oaks and willows are trees themselves
  for (const l of landmarksNear((cx + .5) * CHUNK, (cz + .5) * CHUNK, CHUNK / 2 + 30)) {
    const clear = l.kind === 'falls' ? 26 : l.r + 8;
    for (let i = t.length - 1; i >= 0; i--) if (Math.hypot(t[i].x - l.x, t[i].z - l.z) < clear) t.splice(i, 1);
    if (l.kind !== 'oak' && l.kind !== 'willow') continue;
    if (Math.floor(l.x / CHUNK) !== cx || Math.floor(l.z / CHUNK) !== cz) continue;
    t.push({ x: l.x, y: l.y - .5, z: l.z, s: l.h, yaw: l.yaw, kind: 0, id: 900001 + (cx * 31 + cz) * 7, tint: l.kind === 'willow' ? .9 : .2, landmark: l.id });
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

// ---- landmarks ---------------------------------------------------------------------------
// Sights worth remembering: a few fixed on the way south (the pass over the Great Ridge, the
// sea cliffs and their lighthouse, the marsh's old willow), and one maybe per 1300 m cell
// elsewhere, its kind suited to its land. { id, name, kind, x, y, z, r, h, yaw }.
// The giant oaks and willows are trees too (see treesIn), so they can be perched on.
export const LM_CELL = 1300;
const LM_NAMES = {
  oak: ['The Old Oak', 'The Elder Oak', 'Grandfather Oak', 'The Hollow Oak'],
  stones: ['The Standing Stones', 'The Heron Stones', 'The Grey Stones', 'The Nine Maidens'],
  cairn: ['The Shepherd\'s Cairn', 'The High Cairn', 'The Wind Cairn'],
  tower: ['The Ruined Tower', 'The Watchtower', 'The Lonely Tower'],
  falls: ['Silver Falls', 'The Long Falls', 'Mist Falls'],
  lighthouse: ['The Lighthouse'],
  willow: ['The Old Willow'],
};
const lmCache = new Map();
function fixedLandmarks() {
  if (lmCache.has('fixed')) return lmCache.get('fixed');
  // the pass: the lowest point of the ridge crest near the way south
  let best = null;
  for (let x = -700; x <= 700; x += 20) {
    let top = -1, tz = 0;
    for (let z = JOURNEY.ridge - 500; z <= JOURNEY.ridge + 500; z += 25) { const h = height(x, z); if (h > top) { top = h; tz = z; } }
    if (!best || top < best.y) best = { x, z: tz, y: top };
  }
  // the bay's west shore: walk in from the open water until there is land
  const shore = z => { let x = BAY.x; while (x > BAY.x - BAY.rx * 2 && height(x, z) < 6) x -= 4; return x; };
  const headZ = JOURNEY.coast - BAY.rz * .4;
  const L = [
    { id: 'pass', name: 'The Ridge Pass', kind: 'cairn', x: best.x, z: best.z },
    { id: 'seacliffs', name: 'The Sea Cliffs', kind: 'stones', x: shore(JOURNEY.coast + 150) - 30, z: JOURNEY.coast + 150 },
    { id: 'lighthouse', name: 'The Lighthouse', kind: 'lighthouse', x: shore(headZ) - 9, z: headZ },
    { id: 'willow', name: 'The Old Willow', kind: 'willow', x: 60, z: JOURNEY.marsh + 400 },
  ];
  // a waterfall on the way through the cliffs
  for (const z of [JOURNEY.cliffs, JOURNEY.cliffs + 500, JOURNEY.cliffs - 500, JOURNEY.cliffs + 1000]) {
    const f = fallsSpot(0, z); if (!f) continue;
    L.push({ id: 'falls', name: 'The High Falls', kind: 'falls', x: f.x, z: f.z, drop: f.drop, dx: f.dx, dz: f.dz }); break;
  }
  for (const l of L) finishLandmark(l, 7);
  lmCache.set('fixed', L);
  return L;
}
function finishLandmark(l, seed) {
  // nudge off water and onto fairly level ground
  for (let n = 0; n < 12 && (height(l.x, l.z) < 1.5 || normalAt(l.x, l.z)[1] < .8) && l.kind !== 'falls'; n++) { l.x += Math.cos(n * 2.4) * 30; l.z += Math.sin(n * 2.4) * 30; }
  l.y = height(l.x, l.z); l.yaw = ih(l.x | 0, l.z | 0, seed) * 6.283;
  l.h = { oak: 40, willow: 30, stones: 4, cairn: 3, tower: 22, falls: 0, lighthouse: 26 }[l.kind]; l.r = { oak: 14, willow: 12, stones: 9, cairn: 2, tower: 5, falls: 6, lighthouse: 4 }[l.kind];
  return l;
}
// a waterfall wants a sheer drop: look around for the steepest step down
function fallsSpot(x, z) {
  let best = null;
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 20 + i * 14, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, n = normalAt(px, pz);
    if (n[1] > .5) continue;
    const dl = Math.hypot(n[0], n[2]), dx = n[0] / dl, dz = n[2] / dl, top = height(px - dx * 6, pz - dz * 6), bot = height(px + dx * 14, pz + dz * 14);
    if (top - bot > 18 && (!best || top - bot > best.drop)) best = { x: px - dx * 6, z: pz - dz * 6, drop: top - bot, dx, dz };
  }
  return best;
}
function landmarkCell(gx, gz) {
  const key = gx + ',' + gz; if (lmCache.has(key)) return lmCache.get(key);
  let l = null;
  const x = (gx + .25 + ih(gx, gz, 81) * .5) * LM_CELL, z = (gz + .25 + ih(gx, gz, 82) * .5) * LM_CELL;
  const near = fixedLandmarks().some(f => Math.hypot(f.x - x, f.z - z) < 700) || Math.hypot(x, z) < 500;
  if (!near && ih(gx, gz, 83) < .42) {
    const bio = biomeAt(x, z).name, r = ih(gx, gz, 84);
    const kind = bio === 'forest' || bio === 'lakeland' ? (r < .65 ? 'oak' : 'stones') : bio === 'meadow' ? (r < .45 ? 'tower' : r < .75 ? 'stones' : 'oak')
      : bio === 'cliffs' ? 'falls' : bio === 'mountains' || bio === 'ridge' ? (r < .6 ? 'cairn' : 'falls') : bio === 'coast' ? 'stones' : bio === 'marsh' ? (r < .5 ? 'willow' : 'stones') : null;
    if (kind) {
      const names = LM_NAMES[kind];
      l = { id: 'l' + gx + '_' + gz, name: names[Math.floor(ih(gx, gz, 85) * names.length)], kind, x, z };
      if (kind === 'falls') { const f = fallsSpot(x, z); if (f) Object.assign(l, { x: f.x, z: f.z, drop: f.drop, dx: f.dx, dz: f.dz }); else { l.kind = 'cairn'; l.name = LM_NAMES.cairn[0]; } }
      finishLandmark(l, 86);
      if (l.y < 1) l = null;
    }
  }
  lmCache.set(key, l);
  return l;
}
export function landmarksNear(x, z, r) {
  const out = [];
  for (const l of fixedLandmarks()) if (Math.abs(l.x - x) < r && Math.abs(l.z - z) < r) out.push(l);
  const a = Math.floor((x - r) / LM_CELL), b = Math.floor((x + r) / LM_CELL), c = Math.floor((z - r) / LM_CELL), d = Math.floor((z + r) / LM_CELL);
  for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) { const l = landmarkCell(gx, gz); if (l && Math.abs(l.x - x) < r && Math.abs(l.z - z) < r) out.push(l); }
  return out;
}

// solid landmarks as upright cylinders { x, z, r, y0, top } (towers, the lighthouse, stones,
// cairns), and where a hawk could stand on them, for flight to bump into and perch on
export function solidsNear(x, z, r) {
  const out = [];
  for (const l of landmarksNear(x, z, r + 20)) {
    if (l.kind === 'tower' || l.kind === 'lighthouse') out.push({ x: l.x, z: l.z, r: l.kind === 'tower' ? 4 : 3.2, y0: l.y - 1, top: l.y + (l.kind === 'tower' ? 20 : 24), perch: { x: l.x, y: l.y + (l.kind === 'tower' ? 20.5 : 24.6), z: l.z, top: true } });
    if (l.kind === 'cairn') out.push({ x: l.x, z: l.z, r: .9, y0: l.y - 1, top: l.y + 2.6, perch: { x: l.x, y: l.y + 2.7, z: l.z, top: true } });
    if (l.kind === 'stones') for (let i = 0; i < 9; i++) {
      const a = i / 9 * 6.283, c = Math.cos(l.yaw), s = Math.sin(l.yaw), lx = Math.cos(a) * 8, lz = Math.sin(a) * 8, h = 2.6 + (i * 37 % 10) / 10 * 1.8;
      const sx = l.x + c * lx - s * lz, sz = l.z + s * lx + c * lz;
      out.push({ x: sx, z: sz, r: .55, y0: l.y - 1, top: l.y + h, perch: { x: sx, y: l.y + h + .1, z: sz, top: true } });
    }
  }
  return out;
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
    w += t.w * k * (.35 + .65 * sun) * env.thermal - (d > t.r ? .6 : 0);
  }
  const g = height(x, z), above = y - g;
  if (above < 70) {
    const n = normalAt(x, z), up = -(n[0] * WIND[0] + n[2] * WIND[2]);   // slope facing the wind
    if (up > 0) w += up * 9 * smooth(70, 10, above);
  }
  for (const f of env.lifts) w += f(x, y, z);
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
