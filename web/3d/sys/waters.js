// Running water and the rise and fall of it (B3, B8). The rivers are cut into the ground by
// world.js (riverAt); here they flow: pale streaks of foam drift downstream on the surface,
// whiter and quicker through the rapids where the hills close in, with spray and the sound of
// it nearby. Fish and herons find the rivers on their own (fauna.js looks for deep and
// shallow water). The water level moves: two tides a day, up after rain, down through the
// summer. It is one level for all the water (the sea and the lakes alike), so it stays small.
import { height, riverAt, WATER, setWater } from '../world.js';
import { clamp } from '../util.js';
import { DAY } from '../sky.js';

const LEVEL = { tide: .32, rain: .35, summer: .3 };   // metres
const SCAN_R = 190, STEP = 5;

export function watersSystem(G) {
  const b = G.b, H = G.hud;
  let wet = 0, pts = [], from = null, rush = 0;
  const down = new Map();   // 40 m cell -> the way downstream there

  // the way downstream: along the channel, toward the lower side of the valley
  function flowAt(x, z, r) {
    const e = 2, gx = (riverAt(x + e, z)?.d ?? r.d) - (riverAt(x - e, z)?.d ?? r.d), gz = (riverAt(x, z + e)?.d ?? r.d) - (riverAt(x, z - e)?.d ?? r.d);
    const l = Math.hypot(gx, gz) || 1; let tx = -gz / l, tz = gx / l;
    const key = Math.floor(x / 40) + ',' + Math.floor(z / 40);
    let ref = down.get(key);
    if (!ref) {
      const side = (s) => height(x + tx * 140 * s + tz * 150, z + tz * 140 * s - tx * 150) + height(x + tx * 140 * s - tz * 150, z + tz * 140 * s + tx * 150);
      ref = side(1) < side(-1) ? [tx, tz] : [-tx, -tz];
      down.set(key, ref); if (down.size > 4000) down.clear();
    }
    if (tx * ref[0] + tz * ref[1] < 0) { tx = -tx; tz = -tz; }
    return [tx, tz, l];
  }
  function scan() {
    pts = [];
    const x0 = Math.floor((b.p[0] - SCAN_R) / STEP), z0 = Math.floor((b.p[2] - SCAN_R) / STEP), n = (SCAN_R * 2) / STEP;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = (x0 + i) * STEP, z = (z0 + j) * STEP, r = riverAt(x, z);
      if (!r || r.d > r.w * .8 || r.w < 1.5) continue;
      const h = height(x, z); if (h > -.25) continue;
      const [dx, dz] = flowAt(x, z, r);
      // rapids where the hills close in on the river
      const banks = height(x - dz * (r.w + 14), z + dx * (r.w + 14)) + height(x + dz * (r.w + 14), z - dx * (r.w + 14));
      const rapid = clamp((banks - 12) / 20, 0, 1);
      pts.push({ x, z, dx, dz, rapid, ph: (i * 7.31 + j * 3.17) % 1 });
    }
    from = [b.p[0], b.p[2]];
  }

  return {
    id: 'waters',
    update(dt) {
      // the level
      wet = clamp(wet + dt / DAY * ((G.rain || 0) * 4 - wet * 1.2), 0, 1);
      const s = G.season || {}, summer = s.i === 0 ? Math.sin(Math.PI * Math.min(1, ((s.d || 0) + (G.tod || 0)) / 8)) : 0;
      setWater(LEVEL.tide * Math.sin((G.tod || 0) * Math.PI * 4) + LEVEL.rain * wet - LEVEL.summer * summer);
      if (!from || Math.hypot(b.p[0] - from[0], b.p[2] - from[1]) > 25) scan();
      // spray and the rush of the rapids nearby
      let near = 0;
      for (const p of pts) {
        if (!p.rapid) continue;
        const d = Math.hypot(p.x - b.p[0], p.z - b.p[2]);
        near = Math.max(near, p.rapid * clamp(1 - d / 90, 0, 1));
        if (d < 70 && Math.random() < dt * p.rapid * .25) G.part([p.x + (Math.random() - .5) * 3, WATER + .2, p.z + (Math.random() - .5) * 3], [p.dx * 2 + (Math.random() - .5), 1.2 + Math.random() * 1.5, p.dz * 2 + (Math.random() - .5)], 1.2, [.95, .97, 1], .5 + Math.random() * .4);
      }
      rush += (near - rush) * Math.min(1, dt * 2);
      G.babble = rush * clamp(1 - (b.p[1] - WATER) / 120, 0, 1);
      if (pts.length > 30 && b.p[1] - WATER < 60 && G.flags && !G.flags.river) { G.flags.river = 1; H.glint('River', 'A river, running down to the sea. Fish hold in its deep runs.', 'prey'); }
    },
    scene(S) {
      S.water = WATER;
      if (!pts.length) return;
      // foam streaks drifting downstream on the surface
      const R = S.surface ||= [], y = WATER + .04, c = S.light?.daylight ?? G.light.daylight;
      const col = [.82 + .14 * c, .86 + .12 * c, .9 + .1 * c];
      for (const p of pts) for (let k = 0; k < 2; k++) {
        const ph = (p.ph + k * .5) % 1, sp = .3 + p.rapid * .8, f = (G.t * sp + ph) % 1, len = 2.6 + p.rapid * 3, wd = .07 + p.rapid * .08;
        const al = (.2 + p.rapid * .35) * Math.sin(Math.PI * f), off = (ph - .5) * 3.4;
        const x = p.x + p.dx * (f - .5) * STEP * 1.6 - p.dz * off, z = p.z + p.dz * (f - .5) * STEP * 1.6 + p.dx * off;
        const ax = p.dx * len * .5, az = p.dz * len * .5, sx = -p.dz * wd, sz = p.dx * wd;
        const v = [[x - ax, z - az], [x - sx, z - sz], [x + ax, z + az], [x - ax, z - az], [x + ax, z + az], [x + sx, z + sz]];
        for (const q of v) R.push(q[0], y, q[1], col[0], col[1], col[2], al);
      }
    },
    save: () => ({ wet }),
    load(o) { wet = o.wet || 0; },
  };
}
