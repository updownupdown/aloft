// The way to water (D1): thirsty in the air, the nearest fresh water shows on the compass as a
// drop. Puddles and rain pools near by come first; else a search spreads out from where you are, a
// few points a frame on a 90 m grid out to 2.4 km, nearest first (a river near a point counts, so a
// narrow one is not missed between them). The sea is salt (food.js), so its shore never counts.
import { height, riverAt, WATER } from '../world.js';
import { coastDist } from '../earth.js';

export const FIND = { thirst: .6, far: 2400, grid: 90, perFrame: 24, again: 250, pools: 400, there: 25 };

// grid steps within reach, nearest first
const STEPS = [];
{ const n = Math.ceil(FIND.far / FIND.grid); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (Math.hypot(i, j) * FIND.grid <= FIND.far) STEPS.push([i, j]); }
STEPS.sort((a, c) => Math.hypot(a[0], a[1]) - Math.hypot(c[0], c[1]));

// fresh water at (or within a few tens of metres of) a point: where it is, or null
function freshAt(x, z) {
  if (coastDist(x, z) < 30) return null;
  if (height(x, z) < WATER) return [x, z];
  const r = riverAt(x, z);
  if (!r || r.d > r.w + FIND.grid * .6 || r.w < 1.5) return null;
  // near a river: find its water round the point
  for (let k = 1; k <= 3; k++) for (let a = 0; a < 8; a++) {
    const px = x + Math.cos(a * .785) * k * 15, pz = z + Math.sin(a * .785) * k * 15;
    if (height(px, pz) < WATER && coastDist(px, pz) >= 30) return [px, pz];
  }
  return null;
}

export function findwaterSystem(G) {
  const b = G.b;
  let at = null, i = 0, best = null, found = null;   // the search's centre, its step, its find; the water shown
  const pool = () => {
    let o = null, od = FIND.pools;
    for (const P of [G.puddles || [], G.pools || []]) for (let k = 0; k < P.length; k += 8) { const d = Math.hypot(P[k] - b.p[0], P[k + 2] - b.p[2]); if (d < od) { od = d; o = [P[k], P[k + 2]]; } }
    return o;
  };
  const want = () => G.thirst < FIND.thirst && b.state === 'fly';
  (G.marks ||= []).push(() => {
    if (!want()) return [];
    const w = pool() || found;
    return w && Math.hypot(w[0] - b.p[0], w[1] - b.p[2]) > FIND.there ? [['water', w[0], w[1], 'Fresh water']] : [];
  });
  G.on('wrap', dx => { if (at) at[0] += dx; if (found) found[0] += dx; if (best) best[0] += dx; });
  return {
    id: 'findwater',
    update() {
      if (!want()) return;
      if (!at || Math.hypot(b.p[0] - at[0], b.p[2] - at[1]) > FIND.again) { at = [Math.round(b.p[0] / FIND.grid) * FIND.grid, Math.round(b.p[2] / FIND.grid) * FIND.grid]; i = 0; best = null; }
      if (i >= STEPS.length) return;
      for (let n = 0; n < FIND.perFrame && i < STEPS.length; n++, i++) {
        const [di, dj] = STEPS[i], w = freshAt(at[0] + di * FIND.grid, at[1] + dj * FIND.grid);
        if (w) { best = w; i = STEPS.length; }
      }
      if (i >= STEPS.length) found = best;   // (none within reach: nothing shown, until you have flown on)
    },
  };
}
