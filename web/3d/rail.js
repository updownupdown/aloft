// The old railway (round eight B2). Lines run roughly east to west, one maybe in each 3.2 km band,
// winding gently. The bed holds a smooth grade: it runs in cuttings through rises and on low
// embankments over dips (railCut, applied inside world.js height), crosses valleys and every
// river on stone viaducts, goes under the big hills in tunnels, and stops where it would meet
// the sea or a wide lake. Little stations stand beside it, rusting carriages on the rails.
// Pure function of the seed (the chunk worker runs it too): no DOM, no G.
//   railCut(x, z, h): the ground with the railway's bed in it (the hot path: one Map lookup)
//   railShade(x, z): ballast for the ground's colour; railNear(x, z): metres to a line (<= 40)
//   railsNear(x, z, r): { cells } for drawing and solids (sys/ruins.js, world.js solidsNear)
import { baseHeight } from './world.js';
import { ih, fbm } from './noise.js';

export const RAIL_CELL = 3200, STEP = 20, BED = 3.5, REACH = 32;
const C = RAIL_CELL, WATER = 0, B64 = 64;
const bandOn = j => ih(j, 7, 801) < .5;
const zb = (i, j) => (j + .32 + .36 * ih(i, j, 802)) * C;
// the line's middle at x, in band j
export function lineZ(x, j) {
  const i = Math.floor(x / C), t = x / C - i, s = (1 - Math.cos(Math.PI * t)) / 2;
  return zb(i, j) + (zb(i + 1, j) - zb(i, j)) * s + fbm(x / 700, j * 13.1, 803, 2) * 90;
}

const cells = new Map(), buckets = new Map();
function bucket(x0, z0, x1, z1, seg) {
  for (let b = Math.floor((Math.min(z0, z1) - REACH) / B64); b <= Math.floor((Math.max(z0, z1) + REACH) / B64); b++)
    for (let a = Math.floor((Math.min(x0, x1) - REACH) / B64); a <= Math.floor((Math.max(x0, x1) + REACH) / B64); a++) {
      const k = a * 100003 + b; let L = buckets.get(k); if (!L) buckets.set(k, L = []); L.push(seg);
    }
}
// one band's stretch across cell i: samples every STEP m (with a margin each side so the grade
// and the cuts agree across the cell edges), each { x, z, h, g, mode: 'grade' | 'via' | 'tunnel' | null }
function cell(i, j) {
  const key = i * 100003 + j; if (cells.has(key)) return cells.get(key);
  let R = null;
  if (bandOn(j)) {
    const x0 = i * C - 800, n = (C + 1600) / STEP, P = [];
    for (let k = 0; k <= n; k++) { const x = x0 + k * STEP, z = lineZ(x, j); P.push({ x, z, h: baseHeight(x, z), k: Math.round(x / STEP) }); }
    // the grade: the ground smoothed over 1.2 km, never below the highest water
    for (let k = 0; k <= n; k++) { let s = 0, m = 0; for (let q = Math.max(0, k - 30); q <= Math.min(n, k + 30); q++) { s += Math.max(P[q].h, 3); m++; } P[k].g = Math.max(s / m, 3.2); }
    // where there could be no line: the high mountains, near the start, long water
    const ok = P.map(p => p.h < 170 && Math.hypot(p.x, p.z + 60) > 800);
    for (let k = 0; k <= n;) {
      if (P[k].h >= WATER + 1) { k++; continue; }
      let e = k; while (e <= n && P[e].h < WATER + 1) e++;
      if (e - k > 9 || k === 0 || e > n) for (let q = k; q < e; q++) ok[q] = false;
      k = e;
    }
    // runs shorter than 600 m are not worth a line
    for (let k = 0; k <= n;) {
      if (!ok[k]) { k++; continue; }
      let e = k; while (e <= n && ok[e]) e++;
      if (e - k < 30 && k > 0 && e <= n) for (let q = k; q < e; q++) ok[q] = false;
      k = e;
    }
    for (let k = 0; k <= n; k++) {
      const p = P[k], d = p.g - p.h;
      p.mode = !ok[k] ? null : p.h < WATER + 1 || d > 12 ? 'via' : d < -26 ? 'tunnel' : 'grade';
    }
    R = { i, j, P, chunks: [], vias: [], portals: [], station: null, cars: [], lms: [] };
    const inside = k => P[k].x >= i * C - 40 && P[k].x <= (i + 1) * C + 40;
    for (let k = 0; k < n; k++) {
      const a = P[k], b = P[k + 1]; if (!inside(k) || !a.mode || !b.mode) continue;
      if (a.mode === 'tunnel' || b.mode === 'tunnel') continue;
      // the bed under a viaduct is left alone; the ground beside the grade is cut and filled
      const seg = [a.x, a.z, a.g, b.x, b.z, b.g, a.mode === 'via' || b.mode === 'via' ? 0 : 1];
      bucket(a.x, a.z, b.x, b.z, seg);
    }
    // what is drawn: rails in 200 m chunks, the viaducts, the tunnel mouths, a station
    const own = k => P[k].x >= i * C && P[k].x < (i + 1) * C;
    for (let k = 0; k < n; k++) {
      if (!own(k) || !P[k].mode || !P[k + 1].mode || P[k].mode === 'tunnel' || P[k + 1].mode === 'tunnel') continue;
      const c = Math.floor(P[k].k / 10); let ch = R.chunks.find(o => o.c === c);
      if (!ch) R.chunks.push(ch = { c, id: 'r' + j + '_' + c, pts: [P[k]] });
      ch.pts.push(P[k + 1]);
    }
    for (let k = 1; k < n; k++) {
      if (!own(k)) continue;
      if (P[k].mode === 'via' && P[k - 1].mode !== 'via') {
        let e = k; while (e < n && P[e].mode === 'via') e++;
        if (P[e].mode) {
          const pts = P.slice(k - 1, e + 1), v = { id: 'v' + j + '_' + P[k].k, pts, broken: false };
          R.vias.push(v);
          if (e - k >= 9 && !R.lms.some(l => l.kind === 'viaduct')) R.lms.push({ id: 'via' + j + '_' + P[k].k, name: VIA_NAMES[Math.floor(ih(j, P[k].k, 804) * VIA_NAMES.length)], kind: 'viaduct', x: pts[pts.length >> 1].x, y: pts[pts.length >> 1].g, z: pts[pts.length >> 1].z, r: 40, h: 20, yaw: 0 });
        }
      }
      // a tunnel mouth where the grade meets a tunnel, facing out along the line
      if (P[k].mode === 'grade' && (P[k + 1].mode === 'tunnel' || P[k - 1].mode === 'tunnel')) {
        const o = P[k + 1].mode === 'tunnel' ? P[k + 1] : P[k - 1];
        R.portals.push({ x: P[k].x + (o.x - P[k].x) * .5, z: P[k].z + (o.z - P[k].z) * .5, y: P[k].g, yaw: Math.atan2(o.z - P[k].z, o.x - P[k].x) });
      }
    }
    // a station on a level stretch, with a pair of carriages left at the platform
    if (ih(i, j, 805) < .7) for (let t = 0; t < 40; t++) {
      const k = 30 + Math.floor(ih(i, j, 806 + t) * (n - 60));
      if (!own(k) || [-3, -2, -1, 0, 1, 2, 3].some(q => P[k + q].mode !== 'grade' || Math.abs(P[k + q].h - P[k + q].g) > 3)) continue;
      const p = P[k], q = P[k + 1], yaw = Math.atan2(q.z - p.z, q.x - p.x), side = ih(i, j, 807) < .5 ? -1 : 1;
      const nx = -Math.sin(yaw) * side, nz = Math.cos(yaw) * side;
      R.station = { id: 's' + i + '_' + j, x: p.x + nx * 9, z: p.z + nz * 9, y: p.g, yaw: yaw + (side < 0 ? Math.PI : 0), px: p.x + nx * 3.7, pz: p.z + nz * 3.7, lineYaw: yaw };
      R.lms.push({ id: 'st' + i + '_' + j, name: 'The old station', kind: 'station', x: p.x, y: p.g, z: p.z, r: 25, h: 6, yaw });
      for (const [n, v] of [[0, 0], [1, ih(i, j, 808) < .6 ? 1 : 0]]) {
        const u = 3 + n * 10, a = P[k + 1];
        R.cars.push({ x: p.x + Math.cos(yaw) * u, z: p.z + Math.sin(yaw) * u, y: p.g + (a.g - p.g) * u / STEP, yaw, v, id: 'c' + i + '_' + j + n });
      }
      break;
    }
  }
  cells.set(key, R);
  return R;
}
const VIA_NAMES = ['The Long Viaduct', 'The Swift Arches', 'The Stone Viaduct', 'The Nine Arches', 'The High Viaduct'];

// the ground with the line's bed in it: level within BED of the line, the sides cut back (in a
// cutting) or built out (on an embankment) to meet the land; nothing under a viaduct
let li = NaN, lj = NaN;
function nearest(x, z) {
  const i = Math.floor(x / C), j = Math.floor(z / C);
  if (i !== li || j !== lj) { li = i; lj = j; cell(i, j); }
  const L = buckets.get(Math.floor(x / B64) * 100003 + Math.floor(z / B64)); if (!L) return null;
  let best = null, bd = REACH;
  for (const s of L) {
    const ex = s[3] - s[0], ez = s[4] - s[1], l2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - s[0]) * ex + (z - s[1]) * ez) / l2));
    const d = Math.hypot(x - s[0] - ex * t, z - s[1] - ez * t);
    if (d < bd) { bd = d; best = { d, g: s[2] + (s[5] - s[2]) * t, grade: s[6] }; }
  }
  return best;
}
export function railCut(x, z, h) {
  const n = nearest(x, z); if (!n || !n.grade) return h;
  if (n.d < BED) return n.g;
  const k = n.d - BED;
  return Math.min(Math.max(h, n.g - k * .7), n.g + k * 1.1);
}
// ballast on the bed (0..1), for the ground's colour
export function railShade(x, z) { const n = nearest(x, z); return n && n.grade && n.d < 2.6 ? 1 - n.d / 2.6 * .6 : 0; }
export function railNear(x, z) { const n = nearest(x, z); return n ? n.d : 1e9; }

export function railsNear(x, z, r) {
  const out = [];
  for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) { const R = cell(i, j); if (R) out.push(R); }
  return out;
}
export function railLandmarks(x, z, r) {
  const out = [];
  for (const R of railsNear(x, z, r)) for (const l of R.lms) if (Math.abs(l.x - x) < r && Math.abs(l.z - z) < r) out.push(l);
  return out;
}
// flight bumps into the piers (the arches between are open: fly through them), perches on the
// parapets, the station roof, the carriages and over the tunnel mouths
export function railSolids(x, z, r, pillar) {
  for (const R of railsNear(x, z, r + 30)) {
    const near = (px, pz) => Math.abs(px - x) < r + 12 && Math.abs(pz - z) < r + 12;
    for (const v of R.vias) for (let k = 1; k < v.pts.length - 1; k++) {
      const p = v.pts[k]; if (!near(p.x, p.z)) continue;
      pillar(p.x, p.z, 1.5, Math.min(p.h, WATER) - 3, p.g - 1.4);
      pillar(p.x, p.z, 2.4, p.g - 1.4, p.g + .9, { x: p.x, y: p.g + .9, z: p.z });
    }
    if (R.station && near(R.station.x, R.station.z)) { const s = R.station; pillar(s.x, s.z, 3.2, s.y - 1, s.y + 5.4, { x: s.x, y: s.y + 5.5, z: s.z }); }
    for (const c of R.cars) if (near(c.x, c.z)) for (const k of [-3.5, 3.5]) { const px = c.x + Math.cos(c.yaw) * k, pz = c.z + Math.sin(c.yaw) * k; pillar(px, pz, 1.7, c.y - .5, c.y + 3.6, { x: px, y: c.y + 3.6, z: pz }); }
    for (const o of R.portals) if (near(o.x, o.z)) for (const k of [-4.5, 4.5]) { const px = o.x - Math.sin(o.yaw) * k, pz = o.z + Math.cos(o.yaw) * k; pillar(px, pz, 2.4, o.y - 1, o.y + 9, { x: px, y: o.y + 9, z: pz }); }
  }
}
