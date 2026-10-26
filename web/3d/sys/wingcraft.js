// Wingcraft (round eight): wet feathers (C3) and the wind at landing (C4).
//   C3 rain soaks the feathers (b.wet 0..1; a plunge or a swim soaks them at once): heavier wings,
//      a higher stall and weaker beats (flight.js FLY.wet*). They dry slowly in the air, faster
//      in the open, and fastest spread out in the sun (still.js sets b.sunning).
//   C4 the wind carries the hawk and decides its landings (flight.js); here, the signs of it:
//      wind lanes on water, the travelling bands in the grass (flora.js reads G.windStreak) and a
//      word the first time a landing runs on downwind
import { height, WATER, WIND } from '../world.js';
import { clamp } from '../util.js';

export const CRAFT = {
  soak: 1 / 50, dryFly: 1 / 200, dryOpen: 1 / 260, drySun: 1 / 30,   // a second's worth, at full rain or of drying
};
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;

export function wingcraftSystem(G) {
  const b = G.b, H = G.hud;
  b.wet = 0;
  let soakSaid = false;
  G.windStreak = { x: WX, z: WZ, k: 0, t: 0 };

  G.hud.tip('wind', () => b.state === 'fly' && b.flare > .4 && (G.windK ?? 0) > .35 && b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER) < 12,
    'Land into the wind: the bands in the grass and the lanes on the water run the way it blows. Into it you land slow and soft; with it you run on.');
  G.on('land', kind => {
    if (kind === 'ground' && b.landRun > 1.5 && !G.flags.runOn) { G.flags.runOn = 1; H.glint('Downwind landing', 'The wind was behind you: you came in fast and ran on. Turn into the wind to land soft.', 'flare'); }
    if (kind === 'water') b.wet = 1;
  });

  G.dev?.add({ id: 'r8-wet', area: 'Flight', round: 'R8 C3', title: 'Wet feathers: rain soaks the wings (heavier, weaker beats); they dry in the air and in the sun', how: 'Fly in rain a minute (or land on water): flaps feel weaker. Perch in the sun to dry.', go: () => { b.wet = 1; } });
  G.dev?.add({ id: 'r8-wind', area: 'Flight', round: 'R8 C4', title: 'Land into the wind: the hawk drifts with the wind; landings count ground speed; downwind you run on', how: 'On a windy day land on open ground with the wind behind, then into it. Watch the grass bands and the lanes on water.' });

  return {
    id: 'wingcraft',
    update(dt) {
      // C3: soaking and drying
      const rain = Math.max(G.rain || 0, (G.snowing || 0) * .3), under = b.state === 'perch' && b.tree ? .3 : 1;
      if (b.state === 'swim' || b.plunge) b.wet = 1;
      else if (rain > .1) b.wet = Math.min(1, b.wet + rain * CRAFT.soak * under * dt);
      else b.wet = Math.max(0, b.wet - (b.sunning ? CRAFT.drySun : b.state === 'fly' ? CRAFT.dryFly * (1 + b.s / 20) : CRAFT.dryOpen) * dt);
      if (b.wet > .5 && !soakSaid) { soakSaid = true; if (!G.flags.soaked) { G.flags.soaked = 1; H.glint('Soaked', 'Your feathers are soaked: the wings feel heavy. Perch in the sun and spread them to dry.', 'thirst'); } }
      if (b.wet < .1) soakSaid = false;
      // C4: the grass bands run with the wind's strength
      const ws = (G.windK ?? .3);
      G.windStreak.k = clamp((ws - .15) / .6, 0, 1); G.windStreak.t += dt * (2 + ws * 6);
    },
    scene(S) {
      // C4: wind lanes on water near the hawk: faint pale lines running with the wind, drifting
      const k = G.windStreak.k; if (k < .05) return;
      const cx = b.p[0], cz = b.p[2]; if (Math.hypot(S.cam[0] - cx, S.cam[2] - cz) > 200) return;
      const out = S.surface ||= [], along0 = cx * WX + cz * WZ, cross0 = -cx * WZ + cz * WX, a = .1 + .14 * k;
      for (let li = Math.floor((cross0 - 50) / 7); li <= Math.ceil((cross0 + 50) / 7); li++) {
        const cr = li * 7 + Math.sin(li * 12.9) * 2, len = 6 + (Math.sin(li * 4.1) * .5 + .5) * 8, gap = len * 1.8;
        const shift = (G.windStreak.t * .8 + li * 3.3) % gap;
        for (let s = Math.floor((along0 - 60) / gap) * gap + shift; s < along0 + 60; s += gap) {
          const p0 = [s * WX - cr * WZ, s * WZ + cr * WX], p1 = [(s + len) * WX - cr * WZ, (s + len) * WZ + cr * WX];
          if (height(p0[0], p0[1]) > WATER - .3 || height(p1[0], p1[1]) > WATER - .3) continue;
          const w = .09, nx = -WZ * w, nz = WX * w, y = WATER + .015;
          const v = (x, z, al) => out.push(x, y, z, .92, .96, 1, al);
          v(p0[0] - nx, p0[1] - nz, 0); v(p1[0] - nx, p1[1] - nz, 0); v((p0[0] + p1[0]) / 2 + nx, (p0[1] + p1[1]) / 2 + nz, a);
          v(p0[0] + nx, p0[1] + nz, 0); v(p1[0] + nx, p1[1] + nz, 0); v((p0[0] + p1[0]) / 2 - nx, (p0[1] + p1[1]) / 2 - nz, a);
        }
      }
    },
    save: () => ({ wet: +b.wet.toFixed(2) }),
    load(o) { b.wet = o?.wet || 0; },
  };
}
