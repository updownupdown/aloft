// Sky rivers: steady winds high over two oceans (earth.js OCEANS travel). The westerlies blow
// east and a little north across the North Atlantic, the trade winds west and toward the equator
// across the South Atlantic. Climb into one and it carries you (G.skyWind, added to the wind in
// main.js); low over the water it hardly blows. Rows of small clouds, cloud streets, run along it
// and drift with it, so you can see the way it goes.
import { height, WATER, ih, coastDist, toXZ } from '../world.js';
import { oceanAt } from '../earth.js';
import { smooth } from '../util.js';

export const SKYRIVER = { low: 45, high: 230, cloudY: 330, street: 1300, step: 300, draw: 3200 };
const RIVERS = {
  westerlies: { dir: [.97, -.25], v: 9, name: 'the westerlies', way: 'east' },
  trades: { dir: [-.86, -.5], v: 7, name: 'the trade winds', way: 'west' },
};

export function skyRiversSystem(G) {
  const b = G.b, H = G.hud;
  let here = null, k = 0, checkT = 0;
  G.skyWind = [0, 0];
  const once = (id, msg, secs = 6) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs, 'event'); } };
  G.dev?.add({ id: 'skyrivers', title: 'Sky rivers: the westerlies and the trades', area: 'World', how: 'Over the North Atlantic the westerlies blow east high up, over the South Atlantic the trade winds blow west: climb above 50 m and they carry you, strongest from 230 m. Cloud streets show the way. Go puts you high over the mid Atlantic.',
    go: () => { const [x, z] = toXZ(38, -40); b.state = 'fly'; b.p = [x, 260, z]; b.yaw = Math.PI / 2; b.s = 10; b.gamma = 0; b.vy = 0; } });
  return {
    id: 'skyrivers',
    update(dt) {
      // which river the bird is over, and how far out to sea (none near the coast), now and then
      if ((checkT -= dt) <= 0) {
        checkT = 1;
        const o = oceanAt(b.p[0], b.p[2]), r = o && RIVERS[o.travel];
        here = r || null; k = r ? smooth(0, -1800, coastDist(b.p[0], b.p[2])) : 0;
      }
      const agl = b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER), up = smooth(SKYRIVER.low, SKYRIVER.high, agl);
      const want = here ? here.v * k * up : 0, cur = Math.hypot(...G.skyWind);
      const v = cur + (want - cur) * Math.min(1, dt * .5), d = here ? here.dir : G.skyWind.map(q => q / (cur || 1));
      G.skyWind = [d[0] * v, d[1] * v];
      if (here && k > .5 && b.state === 'fly' && up > .5) once('skyriver_' + here.way, `You are in ${here.name}, a sky river: high up it carries you ${here.way}. Ride it across; going the other way, keep low over the water.`);
    },
    scene(S) {
      if (!here || k < .05) return;
      // cloud streets: rows along the wind, drifting with it, fading in from the coast
      const cam = S.cam, [dx, dz] = here.dir, px = -dz, pz = dx, D = SKYRIVER.draw, St = SKYRIVER.street, Sp = SKYRIVER.step;
      const u0 = cam[0] * dx + cam[2] * dz, v0 = cam[0] * px + cam[2] * pz, drift = G.clock * here.v * .5;
      const C = S.props.cloud ||= [];
      for (let iv = Math.floor((v0 - D) / St); iv <= Math.floor((v0 + D) / St); iv++) {
        if (ih(iv, 0, 491) < .25) continue;   // a gap in the streets
        const vv = iv * St + (ih(iv, 0, 492) - .5) * 200;
        for (let iu = Math.floor((u0 - drift - D) / Sp); iu <= Math.floor((u0 - drift + D) / Sp); iu++) {
          if (ih(iu, iv, 493) < .45 + .25 * Math.sin(iu * .07 + iv)) continue;
          const uu = iu * Sp + drift + (ih(iu, iv, 494) - .5) * 60, x = uu * dx + vv * px, z = uu * dz + vv * pz;
          const dd = Math.hypot(x - cam[0], z - cam[2]); if (dd > D) continue;
          C.push(x, SKYRIVER.cloudY + ih(iu, iv, 495) * 60, z, (24 + ih(iu, iv, 496) * 26) * k, ih(iu, iv, 497) * 7, .75, 0, 0);
        }
      }
    },
  };
}
