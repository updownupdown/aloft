// Caves and tunnels you can fly into (options H2 and H4 to H8 of the geography study): the ground is
// cut out under a roof. Each is a path of points { x, z, w (half width), c (ceiling over the floor),
// f (floor height) }; inside the path the ground drops to the floor (world.js height, via cut()),
// and a roof (sys/caves.js draws it) keeps the hill's own surface over the hollow, so from above
// nothing shows but the mouth. The bird bumps the ceiling inside (sys/caves.js) and stands on the
// roof from above (world.js surface()).
//   cave     a mouth in a steep face in the ridge lands, a passage, a hall at the back
//   icecave  the same in the ice, blue
//   seacave  a mouth at the foot of a sea cliff, the sea running in
//   tube     a lava tube under a fire mountain's lava field, open to the sky at its two collapses
//   cenote   a round pit with sheer sides down to water in the Yucatán's limestone (open)
//   tarn     a bowl high in the snowy peaks holding a pool (open, no roof)
//   adit     an old mine's tunnel into its hill (world.js mines)
//   tunnel   a railway tunnel (rail.js), open at both portals
// A pure function of position and ih(), like the rest of the world.
import { ih, fbm, smooth, clamp } from './noise.js';
import { blend } from './biomes.js';
import { coastDist, latLon, EARTH, wrapX } from './earth.js';
import { railsNear } from './rail.js';
import { height0, sightsNear } from './world.js';

export const CAVE_CELL = 1500;
export const ROOF_OUT = 3.2;   // the roof reaches this far past the hollow's side (over the ground mesh's sloped edge, 3 m facets at most)
const NCX = Math.round(EARTH.W / CAVE_CELL);
const CAVE_LANDS = new Set(['mountains', 'alpine', 'cliffs', 'canyon', 'fjord', 'karst']), SEA_LANDS = new Set(['coast', 'cliffs', 'fjord', 'moor']);
// the ground without the cuts (H0), and the sights (for the mines)
const H0 = (x, z) => height0(x, z), SIGHTS = (x, z, r) => sightsNear(x, z, r);
export const ground0 = H0;
let building = 0, cutting = true;
// far tiles keep the hills whole (chunkMesh turns the cuts off for them)
export const setCutting = on => { cutting = on; };

const slope = (x, z) => { const e = 2, hx = H0(x + e, z) - H0(x - e, z), hz = H0(x, z + e) - H0(x, z - e), l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l]; };
const pt = (x, z, w, c, f) => ({ x, z, w, c, f });
function finish(cv) {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const p of cv.pts) { x0 = Math.min(x0, p.x - p.w); z0 = Math.min(z0, p.z - p.w); x1 = Math.max(x1, p.x + p.w); z1 = Math.max(z1, p.z + p.w); }
  Object.assign(cv, { x0: x0 - 4, z0: z0 - 4, x1: x1 + 4, z1: z1 + 4, holes: cv.holes || [] });
  return cv;
}

// ---- placing them ------------------------------------------------------------------------------
// a cave: the steepest high spot of the cell, the passage straight into the hill with a little bend,
// as long as the hill covers it
function cave(gx, gz, cx, cz, kind) {
  let best = null;
  for (let i = 0; i < 60; i++) {
    const a = i * 2.39996 + ih(gx, gz, 951) * 6.283, r = 30 + i * 11, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H0(x, z);
    if (y < 18) continue;
    const n = slope(x, z); if (n[1] > .72) continue;
    const l = Math.hypot(n[0], n[2]) || 1, dx = n[0] / l, dz = n[2] / l, f = y - 2.5;
    // the hill must stand over the passage and the hall
    if (H0(x - dx * 14, z - dz * 14) < f + 10 || H0(x - dx * 28, z - dz * 28) < f + 13 || H0(x - dx * 38, z - dz * 38) < f + 17) continue;
    if (!best || n[1] < best.n) best = { x, z, dx, dz, f, n: n[1] };
  }
  if (!best) return null;
  const { x, z, dx, dz, f } = best, bend = (ih(gx, gz, 952) - .5) * 10, px = -dz, pz = dx;
  return finish({ kind, id: `cv${kind[0]}${gx}_${gz}`, mouth: { x, z, y: f, dx, dz },
    pts: [pt(x + dx * 7, z + dz * 7, 4.6, 6, f), pt(x, z, 4.6, 6, f), pt(x - dx * 14 + px * bend * .5, z - dz * 14 + pz * bend * .5, 4.2, 5.6, f + .4),
      pt(x - dx * 26 + px * bend, z - dz * 26 + pz * bend, 4.6, 6.5, f + .8), pt(x - dx * 37 + px * bend * .6, z - dz * 37 + pz * bend * .6, 9.5, 10, f + 1)] });
}
// a sea cave: a cliff at the shore, the passage inland from the water
function seacave(gx, gz, cx, cz) {
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996 + ih(gx, gz, 953) * 6.283, r = 20 + i * 8, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, c = coastDist(x, z);
    if (c < 4 || c > 40 || H0(x, z) < 6) continue;
    const e = 25, gxd = coastDist(x + e, z) - coastDist(x - e, z), gzd = coastDist(x, z + e) - coastDist(x, z - e), l = Math.hypot(gxd, gzd) || 1, ux = gxd / l, uz = gzd / l;   // inland
    if (H0(x + ux * 14, z + uz * 14) < 7.5 || H0(x + ux * 26, z + uz * 26) < 8.5) continue;
    if (H0(x - ux * 16, z - uz * 16) > .5) continue;   // the sea right below
    const f = -1.8;
    return finish({ kind: 'seacave', id: `cvs${gx}_${gz}`, mouth: { x, z, y: 0, dx: -ux, dz: -uz },
      pts: [pt(x - ux * 12, z - uz * 12, 5, 6, f), pt(x, z, 5, 6, f), pt(x + ux * 14, z + uz * 14, 4.6, 5.6, f), pt(x + ux * 26, z + uz * 26, 8, 7, f)] });
  }
  return null;
}
// a lava tube: under a level lava field, open where its roof fell in at both ends
function tube(gx, gz, cx, cz) {
  for (let i = 0; i < 50; i++) {
    const a = i * 2.39996 + ih(gx, gz, 954) * 6.283, r = 40 + i * 14, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H0(x, z);
    if (y < 6 || y > 60 || slope(x, z)[1] < .93) continue;
    const d = ih(gx, gz, 955) * 6.283, dx = Math.cos(d), dz = Math.sin(d), P = [];
    let lo = 1e9;
    for (let k = -3; k <= 3; k++) { const m = Math.sin(k * 1.3 + d) * 5, px = x + dx * k * 15 - dz * m, pz = z + dz * k * 15 + dx * m; lo = Math.min(lo, H0(px, pz)); P.push([px, pz]); }
    const c = 6, f = lo - c - 2.6;
    if (f < 1) continue;
    return finish({ kind: 'tube', id: `cvt${gx}_${gz}`, mouth: { x: P[0][0], z: P[0][1], y: f, dx, dz },
      pts: P.map(([px, pz], k) => pt(px, pz, k === 0 || k === 6 ? 6.5 : 5, c, f + Math.abs(k - 3) * .15)),
      holes: [{ x: P[0][0], z: P[0][1], r: 6.2 }, { x: P[6][0], z: P[6][1], r: 6.2 }] });
  }
  return null;
}
// a cenote: a level spot in the limestone, a pit to water under a ring of overhanging rock
function cenote(gx, gz, cx, cz) {
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 10 + i * 8, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H0(x, z);
    if (y < 2.2 || slope(x, z)[1] < .95 || coastDist(x, z) < 60) continue;
    const R = 8 + ih(gx, gz, 956) * 5;
    return finish({ kind: 'cenote', id: `cvo${gx}_${gz}`, open: true, mouth: { x, z, y: 0, dx: 1, dz: 0 }, pts: [pt(x, z, R, 0, -4.5)] });
  }
  return null;
}
// a tarn: a bowl on a high shelf of the peaks with a pool in it
function tarn(gx, gz, cx, cz) {
  for (let i = 0; i < 50; i++) {
    const a = i * 2.39996 + ih(gx, gz, 957), r = 40 + i * 13, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H0(x, z);
    if (y < 70 || slope(x, z)[1] < .86) continue;
    const R = 18 + ih(gx, gz, 958) * 10, f = y - 5;
    return finish({ kind: 'tarn', id: `cvn${gx}_${gz}`, open: true, bowl: 5, mouth: { x, z, y: f + 2.6, dx: 1, dz: 0 }, pool: { x, z, y: f + 2.6, r: R * .72 }, pts: [pt(x, z, R, 0, f)] });
  }
  return null;
}
// an old mine's adit: from the timber mouth (lands.js mine(), 4 m uphill of the headframe) into the hill
function adit(l) {
  const ux = -Math.cos(l.yaw), uz = -Math.sin(l.yaw), x = l.x + ux * 4, z = l.z + uz * 4, f = l.y - .8;
  return finish({ kind: 'adit', id: 'cvm' + l.id, mouth: { x, z, y: f, dx: -ux, dz: -uz },
    pts: [pt(x - ux * 2, z - uz * 2, 2.4, 3.6, f), pt(x, z, 2.4, 3.6, f), pt(x + ux * 20, z + uz * 20, 2.4, 3.6, f + .3), pt(x + ux * 36, z + uz * 36, 4, 4.5, f + .5)] });
}
// a railway tunnel: the run of the line between two portals
function railTunnels(cx, cz, gx, gz) {
  const out = [], seen = new Set();
  for (const R of railsNear(cx, cz, CAVE_CELL)) {
    const P = R.P, n = P.length - 1;
    for (let k = 1; k < n; k++) {
      if (P[k].mode !== 'tunnel' || P[k - 1].mode !== 'grade') continue;
      let e = k; while (e <= n && P[e].mode === 'tunnel') e++;
      if (e > n || P[e].mode !== 'grade') continue;
      const a = P[k - 1]; if (Math.floor(a.x / CAVE_CELL) !== gx || Math.floor(a.z / CAVE_CELL) !== gz) continue;
      const id = `cvr${Math.round(a.x)}_${Math.round(a.z)}`; if (seen.has(id)) continue; seen.add(id);
      const pts = []; for (let q = k - 1; q <= e; q++) pts.push(pt(P[q].x, P[q].z, 4.2, 7.5, P[q].g - .3));
      out.push(finish({ kind: 'tunnel', id, mouth: { x: a.x, z: a.z, y: a.g, dx: 0, dz: 0 }, pts }));
    }
  }
  return out;
}
const cells = new Map();
function cellCaves(gx, gz) {
  const gxw = ((gx % NCX) + NCX) % NCX, key = gxw * 4099 + gz; let L = cells.get(key); if (L) return L;
  L = []; building++;
  try {
    const cx = (gx + .3 + ih(gxw, gz, 959) * .4) * CAVE_CELL, cz = (gz + .3 + ih(gxw, gz, 960) * .4) * CAVE_CELL, bl = blend(cx, cz), land = bl[0].name;
    const add = c => { if (c) L.push(c); };
    if (CAVE_LANDS.has(land) && ih(gxw, gz, 961) < .4) add(cave(gxw, gz, cx, cz, 'cave'));
    if (land === 'ice' && bl[0].cont !== 'antarctica' && ih(gxw, gz, 962) < .35) add(cave(gxw, gz, cx, cz, 'icecave'));
    if (land === 'ice' && bl[0].cont === 'antarctica' && ih(gxw, gz, 962) < .2) add(cave(gxw, gz, cx, cz, 'icecave'));
    if (SEA_LANDS.has(land) && ih(gxw, gz, 963) < .35) add(seacave(gxw, gz, cx, cz));
    if (land === 'volcano' && ih(gxw, gz, 964) < .6) add(tube(gxw, gz, cx, cz));
    const [la, lo] = latLon(cx, cz);
    // the Yucatán's limestone: a few to each cell (it is barely a cell across)
    if (la > 16.5 && la < 23.5 && lo > -93.5 && lo < -85) for (let q = 0; q < 4; q++) {
      const sx = cx + ((q & 1) - .5) * 700, sz = cz + ((q >> 1) - .5) * 700, [a, b] = latLon(sx, sz);
      if (a > 17.8 && a < 22 && b > -91.5 && b < -86.5 && ih(gxw * 4 + q, gz, 965) < .8) add(cenote(gxw * 4 + q, gz, sx, sz));
    }
    if ((land === 'alpine' || land === 'mountains') && ih(gxw, gz, 966) < .35) add(tarn(gxw, gz, cx, cz));
    for (const l of SIGHTS?.(cx, cz, CAVE_CELL) || []) if (l.kind === 'mine' && Math.floor(l.x / CAVE_CELL) === gx && Math.floor(l.z / CAVE_CELL) === gz) add(adit(l));
    L.push(...railTunnels(cx, cz, gx, gz));
  } finally { building--; }
  cells.set(key, L); if (cells.size > 900) cells.delete(cells.keys().next().value);
  return L;
}
// the caves whose box holds (x, z)
const near = [];
export function cavesAt(x, z) {
  near.length = 0;
  const xw = wrapX(x), gx = Math.floor(xw / CAVE_CELL), gz = Math.floor(z / CAVE_CELL);
  for (let j = gz - 1; j <= gz + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) for (const cv of cellCaves(i, j)) if (xw > cv.x0 && xw < cv.x1 && z > cv.z0 && z < cv.z1) near.push(cv);
  return near;
}
export function cavesNear(x, z, r) {
  const out = [], xw = wrapX(x), g0 = Math.floor((xw - r) / CAVE_CELL), g1 = Math.floor((xw + r) / CAVE_CELL), h0 = Math.floor((z - r) / CAVE_CELL), h1 = Math.floor((z + r) / CAVE_CELL);
  for (let j = h0; j <= h1; j++) for (let i = g0; i <= g1; i++) for (const cv of cellCaves(i, j)) if (cv.x1 > xw - r && cv.x0 < xw + r && cv.z1 > z - r && cv.z0 < z + r) out.push(cv);
  return out;
}

// ---- the shape of one ----------------------------------------------------------------------------
// where (x, z) is in a cave: d from the path, and the path's w, c, f there (interpolated)
const Q = { d: 0, w: 0, c: 0, f: 0, t: 0 };
export function local(cv, x, z) {
  x = wrapX(x);
  const P = cv.pts;
  if (P.length === 1) { const p = P[0]; Q.d = Math.hypot(x - p.x, z - p.z); Q.w = p.w; Q.c = p.c; Q.f = p.f; Q.t = 0; return Q; }
  let best = 1e9;
  for (let k = 0; k + 1 < P.length; k++) {
    const a = P[k], b = P[k + 1], ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1;
    const t = clamp(((x - a.x) * ux + (z - a.z) * uz) / l2, 0, 1), d = Math.hypot(x - a.x - ux * t, z - a.z - uz * t), w = a.w + (b.w - a.w) * t;
    if (d - w < best) { best = d - w; Q.d = d; Q.w = w; Q.c = a.c + (b.c - a.c) * t; Q.f = a.f + (b.f - a.f) * t; Q.t = (k + t) / (P.length - 1); }
  }
  return Q;
}
const inHole = (cv, x, z) => { for (const h of cv.holes) if (Math.hypot(wrapX(x) - h.x, z - h.z) < h.r) return true; return false; };
// the roof's underside over (x, z), or null where there is none (open sky, the mouth, a hole)
export function roofUnder(cv, x, z, q = local(cv, x, z)) {
  if (cv.open || inHole(cv, x, z) || q.d > q.w + ROOF_OUT) return null;
  const k = Math.min(1, q.d / q.w), under = cv.lip ? H0(x, z) - cv.lip : q.f + q.c * (.78 + .22 * (1 - k * k));
  return H0(x, z) > under + .8 ? under : null;
}
// the ground with the caves cut out (world.js height)
export function cut(x, z, h) {
  if (building || !cutting) return h;
  for (const cv of cavesAt(x, z)) {
    const q = local(cv, x, z); if (q.d >= q.w) continue;
    let fl = q.f + Math.abs(fbm(x / 6, z / 6, 967, 1)) * .5;
    if (cv.bowl) fl = q.f + cv.bowl * (q.d / q.w) ** 2;
    else if (cv.kind === 'cenote' || cv.kind === 'seacave') fl = q.f;
    if (h > fl) h = fl;
  }
  return h;
}
// the roof over a point and its top, if a roof is there: { under, top, cv } or null
export function roofAt(x, z) {
  if (!cutting) return null;
  for (const cv of cavesAt(x, z)) { const q = local(cv, x, z), u = roofUnder(cv, x, z, q); if (u != null && q.d < q.w) return { under: u, top: H0(x, z), cv }; }
  return null;
}
// near enough to a cave's hollow that no tree or bush should stand there
export function nearCave(x, z) {
  for (const cv of cavesAt(x, z)) { const q = local(cv, x, z); if (q.d < q.w + 3) return true; }
  return false;
}
// how dim the ground is in a cave's shade (0 open .. 1 deep inside), and whether it is ice
export function caveShade(x, z, y) {
  for (const cv of cavesAt(x, z)) {
    // the floor under the roof, and the walls up to it (their facets reach a little past the hollow's
    // side, under the roof's wide eaves)
    const q = local(cv, x, z); if (q.d > q.w + ROOF_OUT - .4) continue;
    const u = roofUnder(cv, x, z, q); if (u == null || (q.d < q.w ? y > u : y > H0(x, z) - .4)) continue;
    return { k: .35 + .45 * smooth(0, .5, q.t), ice: cv.kind === 'icecave', wet: cv.kind === 'seacave' || cv.kind === 'cenote' };
  }
  return null;
}
