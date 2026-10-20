// Mountain waves: on some afternoons the wind flowing over high ground sets up standing waves
// downwind, high above the land. In a wave's rising half the air lifts smoothly and strongly;
// lens-shaped clouds sit still on the crests to mark them. (Ridge lift on windward slopes is
// in world.js airLift.) Sets G.waveK (0..1) for the day.
import { height, env, WIND, ih } from '../world.js';
import { smooth } from '../util.js';
import { lens } from './faunashapes.js';

export const WAVE = { len: 620, lift: 2.8, lo: 150, hi: 700, upwind: 480 };
const WL = Math.hypot(WIND[0], WIND[2]), WX = WIND[0] / WL, WZ = WIND[2] / WL;

// how much high ground lies upwind of a point (0..1)
const mtnUp = (x, z) => smooth(70, 150, height(x - WX * WAVE.upwind, z - WZ * WAVE.upwind));

export function windsSystem(G) {
  G.R.shape('lens', lens());
  G.waveK = 0;
  env.lifts.push((x, y, z) => {
    if (G.waveK < .02 || y < WAVE.lo) return 0;
    const along = x * WX + z * WZ;
    return G.waveK * WAVE.lift * Math.sin(along / WAVE.len * 6.283) * smooth(WAVE.lo, WAVE.lo + 60, y) * smooth(WAVE.hi, WAVE.hi - 150, y) * mtnUp(x, z);
  });
  let told = false;
  return {
    id: 'winds',
    update() {
      const day = ih(G.day, 7, 141) < .5 ? 1 : 0;
      G.waveK = day * smooth(.48, .55, G.tod) * (1 - smooth(.76, .82, G.tod)) * (1 - (G.storm || 0)) * (1 - (G.overcast || 0) * .6);
      if (!told && G.waveK > .5 && G.b.state === 'fly' && G.b.p[1] > WAVE.lo && G.b.lift > 1.2) {
        told = true;
        if (!G.flags.wave) { G.flags.wave = 1; G.hud.toast('Wave lift! Smooth rising air downwind of the mountains, under the lens-shaped clouds.', 6); }
      }
    },
    scene(S) {
      if (G.waveK < .05) return;
      const cam = S.cam, d = S.props.lens ||= [], along0 = cam[0] * WX + cam[2] * WZ, cross0 = -cam[0] * WZ + cam[2] * WX, CS = 280;
      for (let n = Math.floor((along0 - 650) / WAVE.len); n <= Math.ceil((along0 + 650) / WAVE.len); n++) {
        const a = WAVE.len * (n + .25);
        for (let m = Math.floor((cross0 - 650) / CS); m <= Math.ceil((cross0 + 650) / CS); m++) {
          if (ih(n, m, 142) > .55) continue;
          const c = (m + ih(n, m, 143)) * CS, x = a * WX - c * WZ, z = a * WZ + c * WX;
          if (mtnUp(x, z) < .5) continue;
          d.push(x, WAVE.lo + 150 + ih(n, m, 144) * 160, z, (55 + ih(n, m, 145) * 30) * Math.min(1, G.waveK * 1.5), Math.atan2(WX, -WZ) + (ih(n, m, 146) - .5) * .3, .5, 0, 0);
        }
      }
    },
  };
}
