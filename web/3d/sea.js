// Things left at sea (the Earth remap, 2026-10-22): a freighter run aground on the shallows, a
// yacht's hull on a reef, bell buoys off the coasts, lighthouses on their rocks, an old oil rig
// out on the shelf. One maybe in each 3 km cell of sea, of a kind that suits how far it lies
// from the coast and the ocean it is in (earth.js oceanAt: none of them stands in the way of an
// ocean's crossing; they are places to rest). Listed with the settlements (settle.js, kind
// 'derelict') for flight's solids; drawn by sys/ruins.js (sys/seashapes.js). Pure, worker-safe.
import { coastDist, oceanAt } from './earth.js';
import { height } from './world.js';
import { ih } from './noise.js';

export const SEA_CELL = 3000;
// [kind, from, to (metres off the coast), weight by the ocean's way across]
const KINDS = [
  ['buoy', 120, 900, { islands: 1, westerlies: 1, trades: 1, whales: 1, soaring: .6, ice: 0 }],
  ['yacht', 60, 600, { islands: 1.2, trades: .6, westerlies: .3, whales: .5, soaring: .3, ice: 0 }],
  ['freighter', 150, 1200, { westerlies: 1, trades: .8, whales: .8, soaring: .6, islands: .5, ice: .5 }],
  ['rocklight', 200, 1500, { westerlies: 1, islands: 1, soaring: .7, trades: .5, whales: .4, ice: .2 }],
  ['rig', 1500, 6000, { westerlies: .3, whales: .2, trades: .15, soaring: .12, islands: .05, ice: .1 }],
];
const NAMES = { freighter: 'a wrecked freighter', rocklight: 'the rock lighthouse', rig: 'the old oil rig' };
const cache = new Map();
function derelictAt(gx, gz) {
  const key = gx * 100003 + gz; if (cache.has(key)) return cache.get(key);
  let D = null;
  if (ih(gx, gz, 951) < .5) for (let n = 0; n < 6 && !D; n++) {
    const x = (gx + .15 + ih(gx, gz, 952 + n) * .7) * SEA_CELL, z = (gz + .15 + ih(gx, gz, 960 + n) * .7) * SEA_CELL, off = -coastDist(x, z);
    if (off < 60) continue;
    const o = oceanAt(x, z); if (!o) continue;
    const ok = KINDS.filter(k => off > k[1] && off < k[2] && (k[3][o.travel] || 0) > 0); if (!ok.length) continue;
    let sum = 0; for (const k of ok) sum += k[3][o.travel];
    let r = ih(gx, gz, 970 + n) * sum, kind = ok[0][0]; for (const k of ok) if ((r -= k[3][o.travel]) <= 0) { kind = k[0]; break; }
    if (kind === 'rig' && ih(gx, gz, 985) > .2) continue;   // rigs are few and far out
    const y = height(x, z); if (y > -3 && kind !== 'yacht' && kind !== 'buoy') continue;
    const id = 'sea' + gx + '_' + gz, yaw = ih(gx, gz, 980) * 6.283;
    D = { id, kind: 'derelict', what: kind, x, y: 0, z, yaw, ocean: o.key, build: [{ kind: 'derelict', what: kind, x, y: 0, z, yaw, v: 0, id: id + '_0', clear: 0 }], fences: [], lanes: [], spots: [] };
    if (NAMES[kind]) D.lm = { id: 'l' + id, name: kind === 'freighter' ? 'The wreck in ' + o.name : kind === 'rig' ? 'The old rig in ' + o.name : 'The rock light', kind: 'derelict', x, y: 0, z, r: 30, h: 20, yaw: 0 };
  }
  cache.set(key, D); if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return D;
}
export function derelictsNear(x, z, r) {
  const out = [];
  for (let gz = Math.floor((z - r) / SEA_CELL); gz <= Math.floor((z + r) / SEA_CELL); gz++) for (let gx = Math.floor((x - r) / SEA_CELL); gx <= Math.floor((x + r) / SEA_CELL); gx++) {
    const D = derelictAt(gx, gz); if (D && Math.abs(D.x - x) < r && Math.abs(D.z - z) < r) out.push(D);
  }
  return out;
}
// [u, w, r, y0, top, perch] about its spot, turned with it (perch false: none on that top)
const SOLIDS = {
  freighter: [[-32, 0, 6.5, -8, 15, 1], [-18, 0, 6.5, -8, 4.4, 1], [-2, 0, 6.5, -8, 4.6, 1], [14, 0, 6.5, -8, 5, 1], [30, 0, 5, -8, 5.6, 1]],
  yacht: [[0, 0, 2.6, -2, 2.4, 1]],
  buoy: [[0, 0, 1.6, -1, 4.2, 1]],
  rocklight: [[0, 0, 7, -3, 3, 0], [0, 0, 4, 2, 26.6, 1], [0, 0, 2.2, 26.6, 31.4, 1]],
  rig: [[0, 0, 18, 22, 26, 1], [8, 8, 2.5, 26, 56, 1], [-8, -8, 7, 26, 32, 1]],
};
export function derelictSolids(b, pillar) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  for (const [u, w, r, y0, top, perch] of SOLIDS[b.what]) { const x = b.x + c * u - s * w, z = b.z + s * u + c * w; perch ? pillar(x, z, r, b.y + y0, b.y + top) : pillar(x, z, r, b.y + y0, b.y + top, { x, y: -1e9, z }); }
}
