// Rare days and the hours of the day (round eight B5, B6, B7, C2).
// B5 an eclipse: once in a long while the moon crosses the sun in the afternoon; the light
// dims and cools, a few stars show, the birds go quiet, then the day comes back.
// B6 the hush after snow: fresh snow quiets the world (soft wind, no insects, calls carrying
// further through the valley echo); the first morning after a snowfall is the stillest of all.
// B7 hoar frost: on the coldest clear mornings every tree and grass blade is white until the
// sun reaches it, and the frost melts off in a line that follows the light across the land
// (S.frost: amount, the melt line, and where the line is measured from; drawn in render.js).
// C2 evening glass-off: in the last light before dusk the valley gives up its warmth in a broad,
// gentle lift, easy soaring everywhere while the light turns gold.
// Sets G.hush (0..1, read by the ambience and the songbirds) and G.eclipse (0..1).
import { height, env, ih } from '../world.js';
import { clamp, smooth, mix3, norm } from '../util.js';
import { DAY } from '../sky.js';

export const SKYDAYS = {
  eclipse: .045, eclipseAt: [.455, .545],   // chance a day has one; when it starts and ends
  frost: .6, glass: [.615, .735], glassLift: .95,
};

export function skyDaysSystem(G) {
  const b = G.b, H = G.hud;
  const once = (id, msg, secs = 5) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs); } };
  const note = text => { G.skyNotes ||= []; if (!G.skyNotes.includes(text)) { G.skyNotes.push(text); if (G.skyNotes.length > 20) G.skyNotes.shift(); G.emit('skyNote', text); } };
  let forceEclipse = 0, forceFrost = 0, forceHush = 0, snowT = -1e9, frostO = null, frostDay = 0;
  G.hush = 0; G.eclipse = 0; G.glass = 0;

  // B5: how far into the eclipse (0 none .. 1 the sun hidden)
  function eclipse() {
    const [a, e] = SKYDAYS.eclipseAt, mid = (a + e) / 2;
    if (forceEclipse !== G.day && (G.day < 4 || ih(G.day, 0, 701) > SKYDAYS.eclipse)) return { k: 0, f: 0 };
    const t = G.tod; if (t < a || t > e) return { k: 0, f: 0 };
    return { k: smooth(a, mid - .006, t) * (1 - smooth(mid + .006, e, t)), f: (t - a) / (e - a) };
  }
  // B7: how frosted the morning is (0..1), and the melt line's progress (0 all white .. 1 gone)
  function frost() {
    const s = G.season || {}, d = s.d || 0;
    const cold = s.winter || (s.autumn && d >= 5) || (s.i === 3 && d < 3);
    const day = G.tod > .6 ? G.day + 1 : G.day;   // the frost that forms tonight belongs to tomorrow's morning
    if (forceFrost !== day && (!cold || ih(day, 0, 702) > SKYDAYS.frost)) return { k: 0, melt: 1 };
    const t = G.tod > .6 ? G.tod - 1 : G.tod;
    const k = smooth(-.2, -.05, t) * (1 - (G.overcast || 0) * .8) * (1 - (G.rain || 0));
    return { k, melt: smooth(.25, .43, t) };
  }
  // C2: the evening glass-off (0..1)
  const glass = () => {
    const [a, e] = SKYDAYS.glass;
    return smooth(a, a + .03, G.tod) * (1 - smooth(e - .03, e, G.tod)) * (1 - (G.overcast || 0)) * (1 - (G.rain || 0)) * (1 - (G.season?.winter || 0) * .6);
  };
  env.lifts.push((x, y, z) => {
    if (G.glass < .02) return 0;
    const above = y - height(x, z);
    return G.glass * SKYDAYS.glassLift * smooth(2, 25, above) * smooth(520, 260, above);
  });

  G.dev?.add({ id: 'r8-eclipse', title: 'An eclipse', area: 'World', round: 'R8 B5', how: 'Rare (about one day in twenty, mid afternoon): the light dims and cools, stars show, birds go quiet.', go: () => { forceEclipse = G.day; G.tod = SKYDAYS.eclipseAt[0] - .005; } });
  G.dev?.add({ id: 'r8-hush', title: 'The hush after snow', area: 'World', round: 'R8 B6', how: 'Winter, the morning after a snowfall: soft wind, no insects, your call echoes further.', go: () => { forceHush = G.clock + 90; } });
  G.dev?.add({ id: 'r8-frost', title: 'Hoar frost mornings', area: 'World', round: 'R8 B7', how: 'Cold clear mornings (winter, late autumn, early spring): trees and grass white at dawn, melting off in a line that follows the sun.', go: () => { forceFrost = G.day; G.tod = .22; } });
  G.dev?.add({ id: 'r8-glass', title: 'Evening glass-off', area: 'Flight', round: 'R8 C2', how: 'The last light before dusk on a fair day: a broad gentle lift everywhere, the light turning gold.', go: () => { G.tod = SKYDAYS.glass[0] + .01; } });

  return {
    id: 'skydays',
    update(dt) {
      // B5
      const E = eclipse(); G.eclipse = E.k;
      if (E.k > .05) { once('eclipse' + G.day, 'The light is going strange and thin: an eclipse. The moon is crossing the sun.', 6); note(`Day ${G.day}: an eclipse of the sun.`); }
      // B6: snow falling quiets things a little; the morning after it is the stillest of all
      if ((G.snowing || 0) > .3) snowT = G.clock;
      const since = G.clock - snowT, fresh = since < DAY * 1.2 && env.snow > .3;
      const morning = smooth(.19, .24, G.tod) * (1 - smooth(.4, .48, G.tod));
      let hush = Math.max((G.snowing || 0) * .5, fresh && (G.snowing || 0) < .1 ? .45 + .55 * morning : 0, forceHush > G.clock ? 1 : 0);
      if (fresh && morning > .5 && (G.snowing || 0) < .1) once('hush' + G.day, 'Fresh snow, and the world has gone hushed: the wind is soft, and every call carries.', 6);
      hush = Math.max(hush, E.k);
      G.hush += (hush - G.hush) * Math.min(1, dt * .5);
      G.windK = (G.windK ?? .3) * (1 - .55 * G.hush);   // weather sets it each frame, before this
      // C2
      G.glass += (glass() - G.glass) * Math.min(1, dt * .4);
      if (G.glass > .5 && b.state === 'fly') once('glass' + G.day, 'Evening glass-off: the valley gives up its warmth in a broad, gentle lift. Easy soaring everywhere until dusk.', 6);
      // B7
      const F = frost();
      if (F.k > .3 && F.melt < .5 && G.light.daylight > .2) once('frost' + G.day, 'Hoar frost: every tree and blade white. It melts off as the sun reaches it.', 5);
      if (F.k < .01) frostO = null; else if (!frostO || frostDay !== G.day) { frostO = [b.p[0], b.p[2]]; frostDay = G.day; }
      G.frost = F;
    },
    scene(S) {
      // B5: the light dims and cools toward a dusky blue, the stars come out, the sun goes dark
      const k = G.eclipse;
      if (k > .001) {
        S.sunCol = S.sunCol.map(v => v * (1 - .88 * k));
        S.skyAmb = mix3(S.skyAmb, [.22, .26, .38], .7 * k); S.gndAmb = mix3(S.gndAmb, [.12, .13, .18], .7 * k);
        S.zenith = mix3(S.zenith, [.1, .13, .24], .8 * k); S.horizon = mix3(S.horizon, [.46, .44, .52], .65 * k); S.cloud = mix3(S.cloud, [.4, .42, .5], .6 * k);
        S.night = Math.max(S.night || 0, .6 * k * k);
        // the moon's dark disc sliding over the sun, and a pale ring of the corona round it
        const sd = G.light.sunSky, D = 700, R = 26, f = eclipse().f, side = norm([-sd[2], 0, sd[0]]), off = (f * 2 - 1) * R * 2.4;
        const sp = [S.cam[0] + sd[0] * D, S.cam[1] + sd[1] * D, S.cam[2] + sd[2] * D];
        if (sd[1] > 0) {
          S.motes.push(...sp, ...mix3(S.zenith, [.95, .93, .88], k * .7), R * 1.8);
          S.motes.push(sp[0] + side[0] * off, sp[1] + .3, sp[2] + side[2] * off, ...mix3(S.zenith, [.04, .05, .09], Math.min(1, k * 2)), R);
        }
      }
      // C2: the low sun turns gold
      if (G.glass > .01) { const g = G.glass; S.sunCol = mix3(S.sunCol, [1, .74, .44].map((v, i) => v * Math.max(...S.sunCol) * 1.05), .5 * g); S.horizon = mix3(S.horizon, [.98, .82, .58], .25 * g); }
      // B7: render.js whitens the ground, trees and grass where the melt line hasn't passed
      const F = G.frost;
      if (F && F.k > .01 && frostO) {
        const sd = G.light.sunSky, l = Math.hypot(sd[0], sd[2]) || 1;
        S.frost = [F.k, 3 - F.melt * 7, frostO[0], frostO[1]];
        S.frostDir = [sd[0] / l, sd[2] / l];
      }
    },
  };
}
