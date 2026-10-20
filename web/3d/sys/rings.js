// Golden rings hang over the land; fly through one for a burst of speed. Collected rings
// stay collected (by id) until they come back after a day.
import { ringsNear } from '../world.js';
import { DAY } from '../sky.js';

export function ringsSystem(G) {
  const b = G.b, got = new Map();   // ring id -> G.clock time collected
  G.rings = 0;
  const live = r => { const t = got.get(r.id); return t === undefined || G.clock - t > DAY; };
  G.hud.tip('ring', () => b.state === 'fly' && ringsNear(b.p[0], b.p[2], 60).some(r => live(r) && Math.hypot(r.x - b.p[0], r.y - b.p[1], r.z - b.p[2]) < 60), 'A golden ring: fly through it for a burst of speed.');
  return {
    id: 'rings',
    update() {
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
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; G.part([r.x + Math.cos(a) * r.r * Math.cos(r.yaw), r.y + Math.sin(a) * r.r, r.z + Math.cos(a) * r.r * Math.sin(r.yaw)], [0, .5, 0], 1.2, [1, .85, .45], .09); }
      }
      G.hud.counter = G.rings ? `${G.rings} ring${G.rings > 1 ? 's' : ''}` : '';
    },
    scene(S) {
      const d = S.props.ring ||= [];
      for (const r of ringsNear(S.cam[0], S.cam[2], 320)) if (live(r)) d.push(r.x, r.y, r.z, r.r * (1 + Math.sin(G.t * 3 + r.id) * .03), r.yaw, .7, 0, 0);
    },
    save: () => ({ n: G.rings, got: [...got].slice(-300) }),
    load(o) { G.rings = o.n || 0; for (const [k, v] of o.got || []) got.set(k, v); },
  };
}
