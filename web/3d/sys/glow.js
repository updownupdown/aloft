// Night glow: fireflies over the summer meadows and woods' edges, glowing fungi at the feet of
// the giant redwoods, pale green fire in the surf along mangrove and sea shores, and embers
// rising from the fire mountain. Small and few, near the hawk, only in the dark.
import { height, treesNear, landmarksNear, blend, ih } from '../world.js';
import { mix3 } from '../util.js';

const FIREFLY_LANDS = { meadow: 1, lakeland: 1, forest: .7, birch: .6, savanna: .4, swamp: .8, marsh: .8 };
const SURF_LANDS = { mangrove: 1, swamp: 1, coast: .7, fjord: .4 };

export function glowSystem(G) {
  const b = G.b;
  let from = null, shore = [], fungi = [], volcano = null, land = 'meadow';
  function place() {
    const x0 = b.p[0], z0 = b.p[2];
    land = blend(x0, z0)[0].name;
    shore = []; fungi = [];
    // the waterline: points where the ground crosses the water, every 6 m within 110 m
    if (SURF_LANDS[land]) for (let gz = -18; gz <= 18; gz++) for (let gx = -18; gx <= 18; gx++) {
      const x = Math.floor(x0 / 6 + gx) * 6, z = Math.floor(z0 / 6 + gz) * 6, h = height(x, z);
      if (h > -.6 && h < .1 && Math.hypot(x - x0, z - z0) < 110) shore.push(x, z, ih(x | 0, z | 0, 601));
    }
    for (const t of treesNear(x0, z0, 70)) if (t.look === 3) for (let k = 0; k < 3; k++) {
      const a = ih(t.id, k, 602) * 6.28, r = t.s * .09;
      fungi.push(t.x + Math.cos(a) * r, t.y + .15, t.z + Math.sin(a) * r);
    }
    volcano = landmarksNear(x0, z0, 1000).find(l => l.kind === 'volcano') || null;
  }
  return {
    id: 'glow',
    update(dt) {
      if (!from || Math.hypot(b.p[0] - from[0], b.p[2] - from[2]) > 40) { place(); from = [b.p[0], 0, b.p[2]]; }
      // embers spark up out of the crater (by day too, but they show at night)
      if (volcano && Math.random() < dt * 6) {
        const a = Math.random() * 6.283, r = Math.random() * 10;
        G.part([volcano.x + Math.cos(a) * r, volcano.y + 2, volcano.z + Math.sin(a) * r], [(Math.random() - .5) * 3, 6 + Math.random() * 6, (Math.random() - .5) * 3], 2.5, [1, .45 + Math.random() * .25, .15], .5 + Math.random() * .4);
      }
    },
    scene(S) {
      const night = G.light.night;
      if (night < .15) return;
      const M = S.motes, cam = S.cam, t = G.t;
      // fireflies: summer and late spring, on still dry nights
      const warm = G.season?.name === 'summer' ? 1 : G.season?.name === 'spring' && G.season.d > 4 ? .5 : 0;
      const ff = (FIREFLY_LANDS[land] || 0) * warm * (1 - (G.rain || 0)) * night;
      if (ff > .05) for (let i = 0; i < 46 * ff; i++) {
        const h1 = ih(i, 1, 611), h2 = ih(i, 2, 612), cx = Math.floor(cam[0] / 60) * 60, cz = Math.floor(cam[2] / 60) * 60;
        const x = cx + (h1 - .5) * 120 + Math.sin(t * .3 + i) * 3, z = cz + (h2 - .5) * 120 + Math.cos(t * .27 + i * 1.3) * 3;
        const y = height(x, z) + .6 + ih(i, 3, 613) * 2.2 + Math.sin(t * .8 + i) * .4;
        const blink = Math.max(0, Math.sin(t * (1.3 + h1) + i * 2.1)) ** 6;
        if (blink > .05 && y > .5) M.push(x, y, z, ...mix3(S.horizon, [.85, 1, .45], blink * night), .14);
      }
      // fungi glowing softly at the redwoods' feet
      for (let i = 0; i < fungi.length; i += 3) M.push(fungi[i], fungi[i + 1], fungi[i + 2], ...mix3(S.horizon, [.45, .95, .85], night * (.6 + .3 * Math.sin(t * .5 + i))), .22);
      // the surf: a pale green glimmer where the waves break on the shore
      for (let i = 0; i < shore.length; i += 3) {
        const w = Math.max(0, Math.sin(t * 1.1 + shore[i] * .05 + shore[i + 1] * .04 + shore[i + 2] * 6)) ** 3;
        if (w > .1) M.push(shore[i], .15, shore[i + 1], ...mix3(S.horizon, [.4, 1, .85], w * night * SURF_LANDS[land]), .5);
      }
    },
  };
}
