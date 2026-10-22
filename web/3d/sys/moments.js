// Music that notices (round eight): a few moments of a flight get a soft answer from Valley's
// piano (G.music.moment): first light, breaking out of a thermal into clear air high up, landing
// on a high perch, a long glide without a wingbeat. Never a jingle and never every time: each
// moment has a chance, and music.js answers at most every couple of minutes.
import { height, WATER } from '../world.js';

export function momentsSystem(G) {
  const b = G.b;
  let tod = G.tod, thermT = 0, outT = 0, glided = false, was = b.state;
  const ground = () => Math.max(height(b.p[0], b.p[2]), WATER);
  const moment = (what, chance) => G.music?.moment?.(what, chance);
  G.dev?.add({ id: 'music-moments', area: 'Songs and music', round: 8, pr: 182, title: 'Music that notices: the piano answers a few moments', how: 'With Music on: first light; climb a thermal for half a minute and fly out of it high up; land on a tall tree or a hilltop; glide a minute without flapping.', go: () => { if (G.music) G.music.momentT = -1e9; moment('the feature list', 1); } });
  return {
    id: 'moments',
    update(dt) {
      if (tod < .22 && G.tod >= .22 && (G.storm || 0) < .5) moment('first light', .9);
      tod = G.tod;
      if (b.state === 'fly') {
        // a good climb in a thermal, then out into clear air, high
        if (b.lift > 1) { thermT += dt; outT = 0; }
        else if (thermT > 0 && (outT += dt) > 3) { if (thermT > 25 && b.p[1] - ground() > 120) moment('out of a thermal', .6); thermT = 0; }
        // a long glide without a wingbeat
        const still = Math.min(b.flapL, b.flapR);
        if (still > 55 && !glided) { glided = true; moment('a long glide', .5); } else if (still < 1) glided = false;
      } else thermT = 0;
      // landing on a high perch: a tall tree, or a perch up on the hills
      if (b.state === 'perch' && was !== 'perch' && (b.p[1] - height(b.p[0], b.p[2]) > 16 || b.p[1] > 130)) moment('a high perch', .6);
      was = b.state;
    },
  };
}
