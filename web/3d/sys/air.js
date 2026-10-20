// Rising air made visible: a cumulus cap over each thermal and motes drifting up the column.
// The vario beeps while the hawk climbs in it. (The lift itself is world.js airLift().)
import { height, WATER, thermalsNear, thermalCentre } from '../world.js';
import { smooth } from '../util.js';

export function airSystem(G) {
  const b = G.b;
  G.hud.tip('ride', () => !!b.inThermal, 'Rising air! Hold a thumb still and the hawk circles it, climbing.');
  return {
    id: 'air',
    update() {
      if (b.ride) G.hud.did('ride');
      if (b.lift > .8 && b.state === 'fly') G.audio.vario(b.lift * 9);
    },
    scene(S) {
      const clouds = S.props.cloud ||= [];
      for (const t of thermalsNear(S.cam[0], S.cam[2], 650)) {
        const [cx, cz] = thermalCentre(t, t.top);
        clouds.push(cx, t.top + 18, cz, 20 + t.r * .7, t.id % 7, .6, 0, 0);
        if (Math.hypot(t.x - S.cam[0], t.z - S.cam[2]) > 240) continue;
        const g0 = Math.max(height(t.x, t.z), WATER), span = Math.min(160, t.top - g0);
        for (let i = 0; i < 46; i++) {
          const h1 = ((i * 97 + t.id) % 101) / 101, h2 = ((i * 61 + t.id * 3) % 89) / 89;
          const y = g0 + ((G.t * t.w * .9 * G.light.daylight + h1 * span) % span);
          const [mx, mz] = thermalCentre(t, y), a = h2 * 6.283 + G.t * .25 * (i & 1 ? 1 : -1), rr = t.r * .75 * Math.sqrt((h1 * 7.3) % 1);
          const fade = smooth(0, 12, y - g0) * smooth(span, span - 30, y - g0);
          S.motes.push(mx + Math.cos(a) * rr, y, mz + Math.sin(a) * rr, 1, .93, .74, .22 * fade);
        }
      }
    },
  };
}
