// Rings of mist hang over the land in courses (world.js ringLoop): faint wisps of cloud, just
// about visible. Each course starts low and climbs; fly through one for a burst of speed
// (+4 m/s), enough to carry the hawk up to the next, which glows a little brighter. Fly a whole
// course in one go and it says so ('ringLoop'). The courses are laid afresh each day.
import { ringsNear, setRingDay } from '../world.js';
import { DAY } from '../sky.js';
import { mix3 } from '../util.js';

export function ringsSystem(G) {
  const b = G.b, got = new Map();   // ring id -> G.clock time collected
  G.rings = 0;
  let run = null;   // the loop being flown: { circuit, n, k, count, t }
  const live = r => { const t = got.get(r.id); return t === undefined || G.clock - t > DAY; };
  G.hud.tip('ring', () => b.state === 'fly' && ringsNear(b.p[0], b.p[2], 60).some(r => live(r) && Math.hypot(r.x - b.p[0], r.y - b.p[1], r.z - b.p[2]) < 60), 'A faint ring of mist: fly through it for a burst of speed. The next ring of its course glows, a little higher.');
  return {
    id: 'rings',
    live,
    update() {
      setRingDay(G.day || 0);
      if (run && G.clock - run.t > 25) run = null;
      if (b.state !== 'fly' || !b.prev) return;
      for (const r of ringsNear(b.p[0], b.p[2], 30)) {
        if (!live(r)) continue;
        const n = [-Math.sin(r.yaw), 0, Math.cos(r.yaw)];
        const d0 = (b.prev[0] - r.x) * n[0] + (b.prev[2] - r.z) * n[2], d1 = (b.p[0] - r.x) * n[0] + (b.p[2] - r.z) * n[2];
        if (Math.sign(d0) === Math.sign(d1)) continue;
        const rad = Math.hypot(b.p[0] - r.x - n[0] * d1, b.p[1] - r.y, b.p[2] - r.z - n[2] * d1);
        if (rad > r.r) continue;
        b.s = Math.min(46, b.s + 4); G.rings++; got.set(r.id, G.clock);
        G.audio.ring(); G.hud.did('ring'); G.emit('ring', r);
        // a loop flown ring after ring, without a long pause between
        if (run && run.circuit === r.circuit && G.clock - run.t < 25) { run.count++; run.t = G.clock; } else run = { circuit: r.circuit, count: 1, t: G.clock };
        run.next = r.k + 1;
        if (run.count >= r.of) {
          run = null; G.emit('ringLoop', { circuit: r.circuit, n: r.of, level: r.level });
          G.hud.toast(`A whole course of ${r.of} rings, flown in one go${r.level === 'hard' ? ': a hard one' : ''}.`, 3);
        }
        for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; G.part([r.x + Math.cos(a) * r.r * Math.cos(r.yaw), r.y + Math.sin(a) * r.r, r.z + Math.cos(a) * r.r * Math.sin(r.yaw)], [Math.cos(a) * 1.5 * Math.cos(r.yaw), Math.sin(a) * 1.5 + .5, Math.cos(a) * 1.5 * Math.sin(r.yaw)], 1.4, [.97, .97, .95], .3); }
      }
      G.hud.counter = G.rings ? `${G.rings} ring${G.rings > 1 ? 's' : ''}` : '';
    },
    scene(S) {
      // each ring a circle of soft points, barely paler than the sky behind, drifting a little
      for (const r of ringsNear(S.cam[0], S.cam[2], 360)) {
        if (!live(r)) continue;
        const d = Math.hypot(r.x - S.cam[0], r.y - S.cam[1], r.z - S.cam[2]), near = Math.min(1, 30 / Math.max(d, 1));
        // the way on glows a little: the next ring of the course being flown, else each course's first
        const next = run ? run.circuit === r.circuit && r.k === run.next : r.k === 0;
        // lined up to fly through it (aim.js): it warms a little toward a soft yellow
        const aimed = G.aim?.ring?.id === r.id;
        const base = mix3(S.horizon, [1, 1, .98], .16 + near * .22 + (next ? .14 : 0));
        const col = aimed ? mix3(base, G.aim.ringCol || [1, .84, .4], .4) : base, c = Math.cos(r.yaw), sn = Math.sin(r.yaw);
        for (let i = 0; i < 40; i++) {
          const a = i / 40 * 6.283 + G.t * .05, w = Math.sin(i * 2.7 + G.t * .4 + r.id) * .35, rr = r.r * (1 + w * .1);
          const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr, lz = Math.sin(i * 1.3 + G.t * .3) * .4;
          S.motes.push(r.x + c * lx - sn * lz, r.y + ly, r.z + sn * lx + c * lz, ...col, (.9 + Math.abs(w) * 1.1) * (aimed ? 1.12 : 1));
        }
      }
    },
    save: () => ({ n: G.rings, got: [...got].slice(-300) }),
    load(o) { G.rings = o.n || 0; for (const [k, v] of o.got || []) got.set(k, v); },
  };
}
