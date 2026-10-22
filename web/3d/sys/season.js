// The first season, guided: days 1 to 8 of the first year each bring one thing to learn (rising
// air, perching, mice, water, songs, rings, sleep, new country), shown by the companion hawk,
// who flies to it (sys/fauna.js G.companion.fly) while a note says what it is doing. The lesson is
// also the day's aim (sys/aims.js asks G.lessonAim). Nothing stops play; each lesson shows once.
import * as W from '../world.js';
import { period } from '../sky.js';

const LESSONS = [
  { aim: 'high', say: 'Your companion circles in rising air ahead. Follow it and hold a thumb still: the air carries you up.', go: thermal },
  { aim: 'perch', say: 'Your companion drops to a treetop. Slow down and flare (thumbs apart) to land on a branch.', go: tree },
  { aim: 'mouse', say: 'Your companion skims low over the grass, hunting. Watch for a mouse, then stoop at it (thumbs together).', go: low },
  { aim: 'drink', say: 'Your companion heads for water. Land at the edge, or on it, to drink.', go: water },
  { aim: 'sing', say: 'Songbirds sing from the trees. Perch near one and copy its song: they answer, and some give gifts.', go: tree },
  { aim: 'course', say: 'Your companion flies through a ring of mist. A course of them climbs away: fly them one after another.', go: rings },
  { aim: 'sleep', say: 'Night is coming. Your companion finds a roost: perch on a branch and Sleep till dawn.', go: tree, dusk: true },
  { aim: 'far', say: 'The whole Earth is yours to wander. Your companion sets off to see new country: follow it a while.', go: far },
];

// where the companion flies for each lesson: [x, y, z] points from where the hawk is
function thermal(b) {
  const t = W.thermalsNear(b.p[0], b.p[2], 500).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!t) return null;
  const pts = [];
  for (let i = 0; i < 16; i++) { const y = b.p[1] + i * 6, [cx, cz] = W.thermalCentre(t, y), a = i * .8; pts.push([cx + Math.cos(a) * t.r * .5, y, cz + Math.sin(a) * t.r * .5]); }
  return pts;
}
function tree(b) {
  const t = W.treesNear(b.p[0], b.p[2], 260).filter(t => Math.hypot(t.x - b.p[0], t.z - b.p[2]) > 50).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!t) return null;
  const p = W.perchesOf(t)[0];
  return [[(b.p[0] + p.x) / 2, Math.max(b.p[1], p.y + 15), (b.p[2] + p.z) / 2], [p.x, p.y + 1.5, p.z]];
}
function low(b) {
  const pts = [];   // ahead, low over the ground
  for (let i = 1; i <= 6; i++) { const x = b.p[0] + Math.sin(b.yaw) * i * 40, z = b.p[2] - Math.cos(b.yaw) * i * 40; pts.push([x, Math.max(W.height(x, z), W.WATER) + 9, z]); }
  return pts;
}
function water(b) {
  let best = null, bd = 1e9;
  for (let r = 60; r <= 900; r += 60) for (let a = 0; a < 6.283; a += .4) {
    const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r;
    if (W.height(x, z) < W.WATER - .5 && r < bd) { best = [x, z]; bd = r; }
    if (best) break;
  }
  if (!best) return null;
  return [[(b.p[0] + best[0]) / 2, b.p[1], (b.p[2] + best[1]) / 2], [best[0], W.WATER + 3, best[1]]];
}
function rings(b) {
  const first = W.ringsNear(b.p[0], b.p[2], 700).filter(r => r.k === 0).sort((a, c) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(c.x - b.p[0], c.z - b.p[2]))[0];
  if (!first) return null;
  return W.ringsNear(first.x, first.z, 900).filter(r => r.circuit === first.circuit).sort((a, c) => a.k - c.k).map(r => [r.x, r.y, r.z]);
}
function far(b) { const d = [Math.sin(b.yaw), -Math.cos(b.yaw)]; return [[b.p[0] + d[0] * 250, b.p[1] + 10, b.p[2] + d[1] * 250], [b.p[0] + d[0] * 600, b.p[1] + 20, b.p[2] + d[1] * 600]]; }

export function seasonSystem(G) {
  const b = G.b, S = { done: {} };
  const first = () => (G.journey?.year ?? 1) === 1 && G.day <= LESSONS.length;
  G.lessonAim = () => first() ? LESSONS[G.day - 1].aim : null;
  let wait = 20;
  G.on('newDay', () => { wait = 20; });
  return {
    id: 'season',
    soon() { wait = 0; },   // for testing: the day's lesson at the next chance
    update(dt) {
      if (!first() || S.done[G.day] || G.menu?.open) return;
      const L = LESSONS[G.day - 1], dusk = G.tod > .7 && G.tod < .78;
      if ((wait -= dt) > 0 || b.state !== 'fly' || G.companion?.busy) return;
      if (L.dusk ? !dusk : period(G.tod) !== 'day') return;
      const pts = L.go(b);
      if (!pts) { wait = 15; return; }   // nothing of the kind nearby yet: try again further on
      S.done[G.day] = 1;
      G.companion?.fly(pts, 13, () => {});
      G.hud.toast(L.say, 8, 'tutorial');
    },
    save: () => S,
    load(o) { Object.assign(S, o); },
  };
}
