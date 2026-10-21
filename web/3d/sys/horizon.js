// The far horizon: past the drawn ground, the hills and peaks of the lands beyond stand on the
// skyline as soft, hazy silhouettes, so the snowy north and the high country are always in view.
// For each of N bearings it keeps the steepest rise the land makes (from 560 m out to 4 km),
// worked out a few bearings a frame, and lays a see-through strip at RING metres (S.ribbon).
import { height } from '../world.js';
import { mix3 } from '../util.js';

const N = 120, RING = 1250, NEAR = 560, FAR = 4000;

export function horizonSystem(G) {
  const rise = new Float32Array(N).fill(-1), snowy = new Float32Array(N);
  let from = null, next = 0;
  return {
    id: 'horizon',
    update() {
      const p = G.b.p;
      if (!from || Math.hypot(p[0] - from[0], p[2] - from[2]) > 250) { from = [p[0], 0, p[2]]; next = 0; }
      if (next >= N) return;
      // a few bearings each frame (each one is 24 height samples)
      for (let k = 0; k < 6 && next < N; k++, next++) {
        const a = next / N * 6.283, c = Math.cos(a), s = Math.sin(a);
        let best = -1, top = 0;
        for (let d = NEAR; d < FAR; d *= 1.09) {
          const h = height(from[0] + c * d, from[2] + s * d), r = (h - 30) / d;
          if (r > best) { best = r; top = h; }
        }
        rise[next] = best; snowy[next] = top;
      }
    },
    scene(S) {
      if (rise[0] < -.5) return;
      const R = S.ribbon ||= [], cam = S.cam, line = S.snowLine ?? 999;
      const far = mix3(S.horizon, [.5, .56, .66], .32), snow = mix3(S.horizon, [.95, .97, 1], .55);
      for (let i = 0; i < N; i++) {
        const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        // the rise is measured from 30 m above the water; lay it from there
        const t0 = 30 + rise[i] * RING, t1 = 30 + rise[(i + 1) % N] * RING, foot = Math.min(t0, t1) - 140;
        const col = snowy[i] > line + 30 ? snow : far, al = .55;
        const P = (c, s, yy) => [cam[0] + c * RING, yy, cam[2] + s * RING];
        const q = [P(c0, s0, foot), P(c1, s1, foot), P(c1, s1, t1), P(c0, s0, t0)];
        for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) R.push(v[0], v[1], v[2], col[0], col[1], col[2], al);
      }
    },
  };
}
