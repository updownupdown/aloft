// Berries on the bushes that bear them: about three in five leafy shrubs (hawthorn, elder, rowan:
// red) and the tundra heath (bilberry, crowberry: blue-black), from late summer through autumn (all
// year in the tropics). Perched on top of a bush in fruit, Eat picks a beakful (food.js eat action,
// G.berries); a bush picked bare fruits again a few days on. The fruit shows as small clusters on
// the bushes near the bird.
import { bushesNear, BUSH_TOP } from '../world.js';
import { builder, blob, reseed, rnd } from '../shapes.js';

export const BERRY = { food: .07, wet: .03, regrow: 3, near: 70, share: .6 };   // a beakful's fill; days to fruit again; drawn this close; share of leafy shrubs in fruit

// a scatter of clusters over a unit shrub's dome (shapes.js shrub, heath)
function fruit(seed, col, col2, flat) {
  reseed(seed); const B = builder();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.283, u = .25 + rnd() * .9, r = .5 * Math.cos(u) * (flat ? 1.45 : 1.12), y = (flat ? .45 : .55) + Math.sin(u) * (flat ? .36 : .5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let k = 0; k < 3; k++) blob(B, x + (rnd() - .5) * .07, y + (rnd() - .5) * .05, z + (rnd() - .5) * .07, .027, col, col2, [1, 1, 1], 0);
  }
  return B.out();
}

export function berriesSystem(G) {
  const b = G.b, picked = new Map();   // bush id -> day picked bare
  G.R.shape('berries', fruit(211, [.72, .14, .12], [.52, .1, .1], false));
  G.R.shape('bilberries', fruit(223, [.24, .22, .42], [.16, .15, .3], true));
  const inSeason = () => { const s = G.season; return !!s && (s.tropic || s.i === 1 || (s.i === 0 && s.d >= 4)); };
  const bears = o => o.kind === 'heath' || (o.kind === 'bush' && o.tint < BERRY.share);
  const ripe = o => bears(o) && !(G.day + G.tod - (picked.get(o.id) ?? -99) < BERRY.regrow);
  // the bush in fruit the bird stands on, if any
  const here = () => {
    if (b.state !== 'perch' || b.settle > 0 || !inSeason()) return null;
    for (const o of bushesNear(b.p[0], b.p[2], 4)) {
      if (Math.hypot(o.x - b.p[0], o.z - b.p[2]) > o.s * o.w * .45 + .3 || Math.abs(o.y + o.s * BUSH_TOP[o.kind] - b.p[1]) > 1) continue;
      return ripe(o) ? o : null;
    }
    return null;
  };
  G.berries = {
    here,
    // food.js's Eat: a beakful, eaten like a worm (b.meal, finished by food.js)
    eat() {
      const o = here(); if (!o || b.eating > 0) return;
      picked.set(o.id, G.day + G.tod);
      b.meal = { food: BERRY.food, wet: BERRY.wet, kind: o.kind === 'heath' ? 'bilberries' : 'berries' };
      b.eating = b.mealT = 1.1;
      G.hud.did('berries');
    },
  };
  G.hud.tip('berries', () => !!here(), 'Berries! Tap Eat for a beakful. A bush picked bare fruits again in a few days.');
  G.dev?.add({ id: 'berries', area: 'Food', title: 'Berries to eat on bushes in fruit', how: 'From late summer through autumn, land on top of a leafy shrub with red berries, or tundra heath with blue ones, and tap Eat.',
    go: () => { const o = bushesNear(b.p[0], b.p[2], 400).filter(bears).sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
      if (!o) return G.hud.reply('No berry bushes near', 2);
      Object.assign(b, { state: 'fly', p: [o.x - 14, o.y + o.s + 4, o.z], yaw: Math.PI / 2, s: 7, vy: 0, gamma: 0, perch: null, tree: null, settle: 0 }); } });

  let list = [], from = null;
  return {
    id: 'berries',
    scene(S) {
      if (!inSeason()) return;
      const cam = S.cam, N = BERRY.near;
      if (!from || Math.hypot(cam[0] - from[0], cam[2] - from[1]) > 10) { from = [cam[0], cam[2]]; list = bushesNear(cam[0], cam[2], N + 10).filter(bears); }
      for (const o of list) {
        const dx = o.x - cam[0], dz = o.z - cam[2]; if (dx * dx + dz * dz > N * N || !ripe(o)) continue;
        (S.props[o.kind === 'heath' ? 'bilberries' : 'berries'] ||= []).push(o.x, o.y, o.z, o.s, o.yaw, 0, 0, 0);
      }
    },
    save: () => ({ picked: [...picked].filter(([, d]) => G.day + G.tod - d < BERRY.regrow) }),
    load(o) { picked.clear(); for (const [k, v] of o?.picked || []) picked.set(k, v); },
  };
}
