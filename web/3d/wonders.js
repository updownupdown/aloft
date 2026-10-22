// The wonders people left (James, 2026-10-22): a few great works standing empty where they stood
// on the real Earth (earth.js toXZ), each on the right kind of ground near there: a flat spot, a
// peak, a shore, a strait to span, a ridge for the Great Wall to walk. Each one is a landmark to
// find; settle.js lists them with the settlements (kind 'wonder'), so the trees keep off them and
// flight perches on them; sys/ruins.js draws them (sys/wondershapes.js) and keeps the Journal page.
// Pure and worker-safe: the smooth height and WATER = 0, worked out once per wonder when first near.
import { toXZ } from './earth.js';
import { height } from './world.js';
import { ih } from './noise.js';

const WATER = 0;
// key: [name, lat, lon, ground, footprint radius, the story the Journal tells]
export const WONDERS = {
  eiffel: ['The Eiffel Tower', 48.858, 2.294, 'flat', 30, 'An iron tower over a city long gone to meadow. Its rust is the colour of a red-tail’s back.'],
  liberty: ['The Statue of Liberty', 40.689, -74.045, 'coast', 32, 'A green copper woman on a star-shaped fort, her torch held up to ships that no longer come.'],
  giza: ['The Pyramids of Giza', 29.979, 31.134, 'flat', 100, 'The oldest of them all. Swifts nest in the cracks between the stones.'],
  colosseum: ['The Colosseum', 41.89, 12.492, 'flat', 56, 'A ring of arches, half of it fallen. Grass grows where the crowds sat.'],
  pisa: ['The Leaning Tower', 43.723, 10.396, 'flat', 10, 'It leaned before people left, and it leans still, a little more each year.'],
  stonehenge: ['Stonehenge', 51.179, -1.826, 'flat', 18, 'Older than the cities, and it has outlasted them too.'],
  taj: ['The Taj Mahal', 27.175, 78.042, 'flat', 70, 'A white tomb built for love. The marble is going grey, and the gardens are a forest.'],
  greatwall: ['The Great Wall', 40.43, 116.57, 'ridge', 8, 'A wall that walks the ridges as far as you can fly. Its towers make good lookouts.'],
  angkor: ['Angkor Wat', 13.412, 103.867, 'flat', 50, 'The forest took it back once before. It is taking it back again.'],
  opera: ['The Opera House', -33.857, 151.215, 'coast', 60, 'White shells by the water. Gulls sit along their edges and nobody sings inside.'],
  redeemer: ['Christ the Redeemer', -22.952, -43.21, 'peak', 8, 'Arms open over the hills, as if to welcome every bird that passes.'],
  picchu: ['Machu Picchu', -13.163, -72.545, 'peak', 50, 'A stone town on a saddle in the clouds. The terraces are wild flower meadows now.'],
  moai: ['The Moai', -27.125, -109.277, 'coast', 24, 'Stone heads with their backs to the sea, still watching over the island.'],
  goldengate: ['The Golden Gate', 37.82, -122.478, 'strait', 20, 'A red bridge across the bay, its middle fallen into the water.'],
};

// what flight bumps into and perches on: [u, w, r, y0, top, perch?] about the wonder's spot, turned with it
const EIFFEL_SOLIDS = [[-17, -17, 4, -1, 20], [17, -17, 4, -1, 20], [17, 17, 4, -1, 20], [-17, 17, 4, -1, 20],
  [0, 0, 13, 20, 21.6, 1], [0, 0, 8, 41.5, 42.8, 1], [0, 0, 4, 42.8, 99], [0, 0, 2.5, 99, 101.8, 1]];
const LIBERTY_SOLIDS = [[0, 0, 12, -2, 31.2, 1], [0, 0, 3.6, 31.2, 53.6], [0, 0, 2, 53.6, 57.6, 1], [3.45, -.4, 1.2, 57.6, 68.6, 1]];
const GIZA_SOLIDS = [[0, 0, 40, -1, 40], [0, 0, 18, 40, 62], [0, 0, 5, 62, 70, 1], [-95, 75, 38, -1, 38], [-95, 75, 17, 38, 59], [-95, 75, 4, 59, 66, 1], [-165, 150, 20, -1, 32, 1]];
const COLOSSEUM_SOLIDS = Array.from({ length: 16 }, (_, i) => { const t = i / 16 * 6.283, top = Math.sin(t) > .35 ? 20 : 37; return [Math.cos(t) * 48.5, Math.sin(t) * 40, 5, -1, top, 1]; });
const TAJ_SOLIDS = [[0, 0, 33, -1, 6, 1], [0, 0, 16, 6, 26, 1], [0, 0, 9, 26, 46], [0, 0, 2, 46, 51, 1], ...[[-30, -30], [30, -30], [30, 30], [-30, 30]].map(([x, z]) => [x, z, 2.3, 6, 46.2, 1])];
const OPERA_SOLIDS = [[-20, -10, 12, -6, 34, 1], [-4, -10, 9, -6, 28], [12, -10, 8, -6, 20], [-14, 16, 9, -6, 23, 1], [8, 16, 6, -6, 17]];
const REDEEMER_SOLIDS = [[0, 0, 4.5, -2, 8, 1], [0, 0, 3.2, 8, 34.2, 1], [-12, 0, 1.4, 27, 29.6, 1], [12, 0, 1.4, 27, 29.6, 1]];
const HENGE_SOLIDS = [...Array.from({ length: 10 }, (_, i) => { const a = i / 10 * 6.283; return [Math.cos(a) * 15, Math.sin(a) * 15, 1.6, -1, 4.9, 1]; }),
  ...[0, 1, 2, 4].map(i => { const a = Math.PI * .75 + i / 4 * Math.PI * 1.5; return [Math.cos(a) * 8, Math.sin(a) * 8, 1.8, -1, 6.7 + (i === 2 ? 1.5 : 0), 1]; })];
const PISA_SOLIDS = [[0, 0, 7.4, -1, 24], [0, 1.6, 7.4, 24, 48, 1], [0, 2.8, 5, 48, 55.6, 1]];
const PICCHU_SOLIDS = [[30, 0, 4.4, -1, 4.8, 1], ...Array.from({ length: 6 }, (_, i) => [-38 + i * 15, i & 1 ? 18 : -18, 3.4, -1, 3, 1])];
const ANGKOR_SOLIDS = [[0, 0, 48, -1, 6, 1], [0, 0, 35, 6, 13, 1], [0, 0, 23, 13, 22, 1], [0, 0, 6, 22, 55, 1], ...[[-18, -18], [18, -18], [18, 18], [-18, 18]].map(([x, z]) => [x, z, 4, 22, 46, 1])];
const MOAI_SOLIDS = Array.from({ length: 9 }, (_, i) => [-18 + i * 4.5, 0, 1.3, -1, i === 2 || i === 6 ? 3.4 : i % 3 === 0 ? 10.9 : 9.4, 1]);
const goldenGateSolids = span => { const T = span * .32; return [[-T, 0, 7, -6, 88, 1], [T, 0, 7, -6, 88, 1]]; };
const SOLIDS = { eiffel: EIFFEL_SOLIDS, liberty: LIBERTY_SOLIDS, giza: GIZA_SOLIDS, colosseum: COLOSSEUM_SOLIDS, taj: TAJ_SOLIDS, opera: OPERA_SOLIDS,
  redeemer: REDEEMER_SOLIDS, stonehenge: HENGE_SOLIDS, pisa: PISA_SOLIDS, picchu: PICCHU_SOLIDS, angkor: ANGKOR_SOLIDS, moai: MOAI_SOLIDS };
export function wonderSolids(b, pillar) {
  if (b.kind === 'walltower') return pillar(b.x, b.z, 4.6, b.y - 4, b.y + 12);
  if (b.kind === 'wallseg') return pillar(b.x, b.z, 2.8, b.y - 4, b.top);
  const L = b.key === 'goldengate' ? goldenGateSolids(b.span) : SOLIDS[b.key] || [], c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  for (const [u, w, r, y0, top, perch] of L) { const x = b.x + c * u - s * w, z = b.z + s * u + c * w; perch ? pillar(x, z, r, b.y + y0, b.y + top) : pillar(x, z, r, b.y + y0, b.y + top, { x, y: -1e9, z }); }
}

// where a wonder stands: a spot of the right kind within reach of its real place, its height
// (the lowest of its footprint, so it sits into the slope) and a facing
const cache = new Map();
const ok = (x, z, rr) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < 9; i++) { const a = i / 8 * 6.283, r = i ? rr : 0, h = height(x + Math.cos(a) * r, z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); } return [lo, hi]; };
function spiral(x0, z0, R, step, score) {
  let best = null, bs = -1e9;
  for (let r = 0; r <= R; r += step) for (let i = 0, n = Math.max(1, Math.round(r / step * 6)); i < n; i++) {
    const a = i / n * 6.283, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, s = score(x, z, r);
    if (s > bs) { bs = s; best = [x, z]; }
  }
  return bs > -1e8 ? best : null;
}
export function wonderAt(key) {
  if (cache.has(key)) return cache.get(key);
  const [name, lat, lon, ground, rr] = WONDERS[key], p = toXZ(lat, lon);
  let W = null;
  const [x0, z0] = p || [];
  if (p) {
    let at = null, yaw = ih(key.length, key.charCodeAt(0), 941) * 6.283, extra = {};
    if (ground === 'flat') at = spiral(x0, z0, 1200, 60, (x, z, r) => { const [lo, hi] = ok(x, z, rr); return lo < WATER + 1.5 ? -1e9 : -(hi - lo) * 30 - r * .02; });
    if (ground === 'peak') at = spiral(x0, z0, 1500, 70, (x, z, r) => { const [lo, hi] = ok(x, z, rr); return lo < WATER + 2 ? -1e9 : lo - (hi - lo) * 2 - r * .01; });
    if (ground === 'coast') at = spiral(x0, z0, 1500, 50, (x, z, r) => {
      const [lo, hi] = ok(x, z, rr); if (lo < WATER + 1 || hi - lo > 6) return -1e9;
      let sea = 0, dir = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; if (height(x + Math.cos(a) * (rr + 30), z + Math.sin(a) * (rr + 30)) < WATER) { sea++; dir = a; } }
      return sea ? -r * .02 - (hi - lo) * 4 + sea : -1e9;
    });
    if (ground === 'strait') {
      // the narrowest water between two shores within reach, the towers on the shallows
      let best = null;
      for (let r = 0; r <= 2400 && !best; r += 120) for (let i = 0, n = Math.max(1, Math.round(r / 120 * 6)); i < n; i++) {
        const a0 = i / n * 6.283, x = x0 + Math.cos(a0) * r, z = z0 + Math.sin(a0) * r; if (height(x, z) > WATER - 1) continue;
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI, c = Math.cos(a), s = Math.sin(a), side = d => { for (let u = 40; u < 500; u += 20) if (height(x + c * u * d, z + s * u * d) > WATER + 3) return u; return null; };
          const u1 = side(1), u0 = side(-1); if (!u1 || !u0) continue;
          const span = u0 + u1 + 60; if (span > 900 || (best && span >= best.span)) continue;
          best = { x: x + c * (u1 - u0) / 2, z: z + s * (u1 - u0) / 2, span, yaw: a };
        }
      }
      if (best) { at = [best.x, best.z]; yaw = best.yaw; extra.span = best.span; }
    }
    if (ground === 'ridge') at = spiral(x0, z0, 1500, 60, (x, z, r) => height(x, z) - r * .03);
    if (at) {
      const [x, z] = at, [lo] = ok(x, z, rr);
      W = { id: 'w_' + key, key, kind: 'wonder', name, x, y: Math.max(lo, WATER) - .2, z, yaw, build: [], fences: [], lanes: [], spots: [], ...extra };
      if (ground === 'coast') {   // face the sea
        let sx = 0, sz = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; if (height(x + Math.cos(a) * 120, z + Math.sin(a) * 120) < WATER) { sx += Math.cos(a); sz += Math.sin(a); } }
        if (sx || sz) W.yaw = Math.atan2(sz, sx);
      }
      if (key === 'greatwall') wallPath(W);
      else W.build.push({ kind: 'wonder', key, x: W.x, y: W.y, z: W.z, yaw: W.yaw, v: 0, id: W.id + '_0', clear: rr + 6, span: W.span });
      W.lm = { id: 'wd_' + key, name, kind: 'wonder', x: W.x, y: W.y, z: W.z, r: rr, h: 20, yaw: 0 };
    }
  }
  cache.set(key, W);
  return W;
}
// the Great Wall walks the ridges both ways from its spot, ~1.4 km each way, a point every 20 m:
// each step the highest of a few headings near the last one; a run of it fallen here and there
function wallPath(W) {
  const half = (dir) => {
    const P = [], a0 = W.yaw + (dir < 0 ? Math.PI : 0); let x = W.x, z = W.z, a = a0;
    for (let i = 0; i < 70; i++) {
      let best = null, bh = -1e9;
      for (const da of [-.5, -.25, 0, .25, .5]) { const b = Math.max(a0 - .8, Math.min(a0 + .8, a + da)), nx = x + Math.cos(b) * 20, nz = z + Math.sin(b) * 20, h = height(nx, nz) - Math.abs(da) * 3; if (h > bh) { bh = h; best = [nx, nz, b]; } }
      [x, z, a] = best; const y = height(x, z); if (y < WATER + 1) break;
      P.push({ x, z, y });
    }
    return P;
  };
  const P = [...half(-1).reverse(), { x: W.x, z: W.z, y: height(W.x, W.z) }, ...half(1)];
  P.forEach((p, i) => { p.fallen = ih(Math.floor(i / 6), W.x | 0, 943) < .2; });
  W.path = P;
  P.forEach((p, i) => {
    if (i % 10 === 5) W.build.push({ kind: 'walltower', key: W.key, x: p.x, y: p.y, z: p.z, yaw: 0, v: 0, id: W.id + '_t' + i, clear: 9 });
    else if (i % 2 === 0) W.build.push({ kind: 'wallseg', key: W.key, x: p.x, y: p.y, z: p.z, yaw: 0, v: 0, id: W.id + '_s' + i, clear: 6, top: p.y + (p.fallen ? 2 : 7) });
  });
}
// the wonders whose spot could be within r (a box) of (x, z): worked out only when its real place
// is within reach, so the far ones cost nothing
export function wondersNear(x, z, r) {
  const out = [];
  for (const key in WONDERS) {
    const [, lat, lon] = WONDERS[key], p = toXZ(lat, lon);
    if (!p || Math.abs(p[0] - x) > r + 3000 || Math.abs(p[1] - z) > r + 3000) continue;
    const W = wonderAt(key); if (W && Math.abs(W.x - x) < r + 1600 && Math.abs(W.z - z) < r + 1600) out.push(W);
  }
  return out;
}
