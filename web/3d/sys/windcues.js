// Wind cues: the winds that help you, seen as well as heard.
// - Rising wind (ridge lift on a windward slope or cliff, mountain waves, the swells' faces, any
//   other lift that is not a thermal): pale streaks of air run up past the bird, and a soft warm
//   glow rises from the bottom edge of the screen, stronger for stronger lift (rising air is warm,
//   as the thermals are, cues.js).
// - The wind itself (the weather's, a sky river: sys/skyrivers.js): streaks run along with it, and
//   G.hud.wind says, under the speed, where it blows (an arrow, as the camera looks) and how hard,
//   blue when it is behind you, red when it is in your face (James 10-27).
import { height, normalAt, WIND, env, WATER } from '../world.js';
import { smooth } from '../util.js';

export const WINDCUE = { lift: .8, liftFull: 4, carry: 1.5, carryFull: 8, glow: .8, streaks: 26, box: 26, life: 1.8 };
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;

export function windCuesSystem(G) {
  const b = G.b, ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', `<div class="windv3"></div>
  <style>
    .windv3 { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0; overflow: hidden;
      background: linear-gradient(to top, rgba(255, 170, 90, .6), rgba(255, 170, 90, .18) 20%, transparent 36%); }
  </style>`);
  const vEl = ui.querySelector('.windv3');
  let vK = 0, hK = 0, camYaw = b.yaw;
  const streaks = [];
  // the lift here that isn't a thermal's: the windward slope (as world.js airLift) and env.lifts
  const windLift = (x, y, z) => {
    let w = 0;
    const above = y - height(x, z);
    if (above < 70) { const n = normalAt(x, z), up = -(n[0] * WIND[0] + n[2] * WIND[2]); if (up > 0) w += up * 9 * smooth(70, 10, above); }
    for (const f of env.lifts) w += f(x, y, z);
    return w;
  };
  let up = 0, liftT = 0;
  G.on('wrap', dx => { for (const s of streaks) s.p[0] += dx; });   // the world wrapped under the bird

  return {
    id: 'windcues',
    update(dt) {
      const fly = b.state === 'fly' && !G.menu?.open && !b.asleep;
      if ((liftT -= dt) <= 0) { liftT = .1; up = fly ? windLift(b.p[0], b.p[1], b.p[2]) : 0; }
      // rising wind: from below
      const v = fly && !b.inThermal ? smooth(WINDCUE.lift, WINDCUE.liftFull, Math.min(up, b.lift ?? up)) : 0;
      vK += (v - vK) * Math.min(1, dt * (v > vK ? 2.5 : 1.2));
      vEl.style.opacity = (vK * WINDCUE.glow).toFixed(3);
      // a carrying wind (a sky river): the streaks run with it
      const sw = G.skyWind || [0, 0], sv = Math.hypot(sw[0], sw[1]);
      const h = fly ? smooth(WINDCUE.carry, WINDCUE.carryFull, sv) : 0;
      hK += (h - hK) * Math.min(1, dt * 1.5);
      // the wind under the speed: its way as the camera looks (0: straight ahead, into the screen),
      // and how much of it is behind the bird (1) or in its face (-1)
      const w = b.wind || [0, 0], wl = Math.hypot(w[0], w[1]);
      if (G.hud) G.hud.wind = fly && wl > .3 ? {
        a: Math.atan2(w[0] * Math.cos(camYaw) + w[1] * Math.sin(camYaw), w[0] * Math.sin(camYaw) - w[1] * Math.cos(camYaw)),
        kmh: Math.round(wl * 3.6), tail: (w[0] * Math.sin(b.yaw) - w[1] * Math.cos(b.yaw)) / wl,
      } : null;
      // streaks of moving air round the bird, while either wind is on
      const on = Math.max(vK, hK);
      const vel = [(G.skyWind?.[0] || 0) + WX * 3, 0, (G.skyWind?.[1] || 0) + WZ * 3];
      vel[1] = Math.max(0, up) * 1.4;
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]; s.t += dt;
        for (let k = 0; k < 3; k++) s.p[k] += s.v[k] * dt;
        if (s.t > WINDCUE.life || Math.hypot(s.p[0] - b.p[0], s.p[2] - b.p[2]) > WINDCUE.box * 1.6) streaks.splice(i, 1);
      }
      while (on > .05 && streaks.length < WINDCUE.streaks * on) {
        const B = WINDCUE.box, x = b.p[0] + (Math.random() - .5) * B * 2, z = b.p[2] + (Math.random() - .5) * B * 2;
        const y = Math.max(b.p[1] + (Math.random() - .6) * B * .7, Math.max(height(x, z), WATER) + 1.5);
        const j = .8 + Math.random() * .4;
        streaks.push({ p: [x, y, z], v: vel.map(q => q * j), t: 0, k: on });
      }
    },
    scene(S) {
      const cam = S.cam;
      if (Math.hypot(b.p[0] - cam[0], b.p[2] - cam[2]) > .5) camYaw = Math.atan2(b.p[0] - cam[0], -(b.p[2] - cam[2]));   // the way the camera looks (yaw as b.yaw: 0 north, x east)
      if (!streaks.length) return;
      const R = S.ribbon ||= [];
      for (const s of streaks) {
        const vl = Math.hypot(...s.v) || 1, len = Math.min(5, 1 + vl * .4), d = s.v.map(q => q / vl);
        const q = [s.p[0] - d[0] * len, s.p[1] - d[1] * len, s.p[2] - d[2] * len];
        const to = [cam[0] - s.p[0], cam[1] - s.p[1], cam[2] - s.p[2]], dist = Math.hypot(...to);
        if (dist < 3) continue;
        let sx = d[1] * to[2] - d[2] * to[1], sy = d[2] * to[0] - d[0] * to[2], sz = d[0] * to[1] - d[1] * to[0];
        const sl = Math.hypot(sx, sy, sz) || 1, w = .06 + dist * .004; sx *= w / sl; sy *= w / sl; sz *= w / sl;
        const a = Math.sin(Math.PI * Math.min(1, s.t / WINDCUE.life)) * .6 * s.k * smooth(3, 9, dist);
        const c = [.82, .9, 1];
        const A = [s.p[0] - sx, s.p[1] - sy, s.p[2] - sz, ...c, a], Bv = [s.p[0] + sx, s.p[1] + sy, s.p[2] + sz, ...c, a];
        const C = [q[0] + sx, q[1] + sy, q[2] + sz, ...c, 0], D = [q[0] - sx, q[1] - sy, q[2] - sz, ...c, 0];
        R.push(...A, ...Bv, ...C, ...A, ...C, ...D);
      }
    },
  };
}
