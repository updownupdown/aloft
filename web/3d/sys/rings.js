// Rings of cloud hang over the land (little doughnuts of cumulus, as if a puff had been blown
// through); fly through the hole for a burst of speed. Collected rings stay collected (by id)
// until they come back after a day.
import { ringsNear } from '../world.js';
import { DAY } from '../sky.js';
import { builder, blob, reseed } from '../shapes.js';

// puffs round a circle in the x-y plane (radius 1.25, the hole about .85), thin along z
function cloudRing() {
  reseed(71); const B = builder(), W = [.98, .97, .94], S = [.88, .88, .9];
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + Math.sin(i * 3.1) * .08, r = 1.25 + Math.sin(i * 1.7) * .05;
    blob(B, Math.cos(a) * r, Math.sin(a) * r, 0, .36 + Math.abs(Math.sin(i * 2.3)) * .14, W, S, [1, 1, .7]);
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .4; blob(B, Math.cos(a) * 1.45, Math.sin(a) * 1.45, .12, .26, W, W, [1, 1, .6]); }
  return B.out();
}

export function ringsSystem(G) {
  const b = G.b, got = new Map();   // ring id -> G.clock time collected
  G.rings = 0;
  G.R.shape('cloudring', cloudRing());
  const live = r => { const t = got.get(r.id); return t === undefined || G.clock - t > DAY; };
  G.hud.tip('ring', () => b.state === 'fly' && ringsNear(b.p[0], b.p[2], 60).some(r => live(r) && Math.hypot(r.x - b.p[0], r.y - b.p[1], r.z - b.p[2]) < 60), 'A ring of cloud: fly through the hole for a burst of speed.');
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
        for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; G.part([r.x + Math.cos(a) * r.r * Math.cos(r.yaw), r.y + Math.sin(a) * r.r, r.z + Math.cos(a) * r.r * Math.sin(r.yaw)], [Math.cos(a) * 1.5 * Math.cos(r.yaw), Math.sin(a) * 1.5 + .5, Math.cos(a) * 1.5 * Math.sin(r.yaw)], 1.4, [.97, .97, .95], .3); }
      }
      G.hud.counter = G.rings ? `${G.rings} ring${G.rings > 1 ? 's' : ''}` : '';
    },
    scene(S) {
      const d = S.props.cloudring ||= [];
      for (const r of ringsNear(S.cam[0], S.cam[2], 320)) if (live(r)) d.push(r.x, r.y, r.z, r.r * (1 + Math.sin(G.t * .6 + r.id) * .025), r.yaw + Math.sin(G.t * .2 + r.id) * .04, .5, 0, 0);
    },
    save: () => ({ n: G.rings, got: [...got].slice(-300) }),
    load(o) { G.rings = o.n || 0; for (const [k, v] of o.got || []) got.set(k, v); },
  };
}
