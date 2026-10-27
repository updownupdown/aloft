// The way: a thread of light motes from the bird toward somewhere it should go (James 10-27: in
// place of the companion hawk). G.way.show(x, y, z, { title, secs, near, done, beacon }) marks the
// place on the compass and, while you fly, spins out a short trail of warm motes toward it; with
// beacon a slow column of motes also rises over the place itself when you are within sight of it.
// Reached (within near metres) it calls done() and ends; it fades after secs. One way at a time.
// Used by the lessons' and quests' Show me (Today) and the gleams that rise over something worth seeing (visitors.js).
import { height, WATER, wrapX } from '../world.js';

export const WAY = { secs: 240, near: 45, trail: .3, beacon: 2500 };

export function waySystem(G) {
  const b = G.b;
  let W = null, trailT = 0, beamT = 0;
  G.way = {
    get busy() { return !!W; },
    get at() { return W && [W.x, W.y, W.z]; }, get title() { return W?.title; },
    show(x, y, z, o = {}) {
      W = { x, y: y ?? Math.max(height(x, z), WATER) + 20, z, title: o.title || 'The way', t: o.secs ?? WAY.secs, near: o.near ?? WAY.near, done: o.done, beacon: !!o.beacon };
    },
    stop() { W = null; },
  };
  (G.marks ||= []).push(() => W ? [['way', W.x, W.z, W.title]] : []);
  G.on('wrap', dx => { if (W) W.x += dx; });

  return {
    id: 'way',
    update(dt) {
      if (!W) return;
      const dx = wrapX(W.x - b.p[0]), dy = W.y - b.p[1], dz = W.z - b.p[2], d = Math.hypot(dx, dz);
      if ((W.t -= dt) <= 0) { W = null; return; }
      if (d < W.near && Math.abs(dy) < 40) { const done = W.done; W = null; done?.(); return; }
      if (b.state === 'fly' && (trailT -= dt) <= 0) {
        trailT = WAY.trail;
        const D = Math.hypot(dx, dy, dz) || 1;
        for (const r of [7, 13, 19]) if (r < D) G.part([b.p[0] + dx / D * r, b.p[1] + dy / D * r + .5, b.p[2] + dz / D * r], [dx / D * 2.5, .8, dz / D * 2.5], 1.1, [1, .88, .55], .2);
      }
      if (W.beacon && d < WAY.beacon && (beamT -= dt) <= 0) {
        beamT = .12;
        const a = Math.random() * 6.28, r = Math.random() * 3;
        G.part([b.p[0] + dx + Math.cos(a) * r, W.y - 4 + Math.random() * 4, b.p[2] + dz + Math.sin(a) * r], [0, 7 + Math.random() * 3, 0], 3, [1, .9, .6], Math.max(.5, d * .004));   // (bigger far off, to be seen)
      }
    },
  };
}
