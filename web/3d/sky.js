// The clock and the sky: time of day, days and seasons, and the light they make.
// Systems read G.light (sun direction and colours, night, daylight) and G.season.
import { mix3, norm, smooth } from './util.js';

export const DAY = 480;          // seconds in a day
export const SEASON_DAYS = 8;    // days in a season
export const SEASONS = ['summer', 'autumn', 'winter', 'spring'];

// sky moods by sun height: night, dusk, day (rgb 0..1, Aloft's paper-warm horizon)
const MOOD = {
  day: { zenith: [.52, .68, .8], horizon: [.92, .9, .83], sunCol: [.78, .73, .62], skyAmb: [.5, .55, .6], gndAmb: [.38, .35, .28], cloud: [.97, .95, .9] },
  dusk: { zenith: [.42, .42, .6], horizon: [.97, .7, .5], sunCol: [.85, .52, .3], skyAmb: [.45, .38, .46], gndAmb: [.3, .22, .2], cloud: [.98, .78, .66] },
  night: { zenith: [.04, .06, .13], horizon: [.15, .17, .27], sunCol: [.2, .24, .34], skyAmb: [.13, .16, .26], gndAmb: [.05, .06, .09], cloud: [.2, .22, .3] },
};
export function light(tod) {
  const a = (tod - .25) * Math.PI * 2, el = Math.sin(a);
  let m;
  const blend = (A, B, t) => Object.fromEntries(Object.keys(A).map(k => [k, mix3(A[k], B[k], t)]));
  if (el > .25) m = MOOD.day; else if (el > 0) m = blend(MOOD.dusk, MOOD.day, el / .25); else m = blend(MOOD.night, MOOD.dusk, smooth(-.2, 0, el));
  const az = a * .9 + .6;
  const sunDir = norm([Math.cos(az) * Math.cos(Math.asin(el)), el, Math.sin(az) * Math.cos(Math.asin(el)) - .3]);
  // at night the moon lights from high in the opposite sky
  const L = el > -.05 ? [sunDir[0], Math.max(sunDir[1], .08), sunDir[2]] : norm([-sunDir[0], .6, -sunDir[2]]);
  return { ...m, sun: norm(L), sunSky: sunDir, night: smooth(.05, -.2, el), daylight: smooth(-.05, .3, el) };
}
export const period = tod => (tod < .2 || tod > .8 ? 'night' : tod < .33 ? 'dawn' : tod > .68 ? 'dusk' : 'day');

export function clockSystem(G) {
  const seasonOf = () => { const i = Math.floor((G.day - 1) / SEASON_DAYS) % 4; return { i, name: SEASONS[i], key: i, autumn: i === 1 ? 1 : 0, winter: i === 2 ? 1 : 0 }; };
  G.tod = .34; G.day = 1; G.light = light(G.tod); G.season = seasonOf();
  return {
    id: 'clock',
    update(dt) {
      G.tod += dt / DAY;
      if (G.tod >= 1) { G.tod -= 1; G.day++; G.emit('newDay', G.day); }
      const s = seasonOf(); if (s.i !== G.season.i) G.emit('season', s);
      G.season = s; G.light = light(G.tod);
    },
    save: () => ({ tod: G.tod, day: G.day }),
    load(o) { G.tod = o.tod ?? G.tod; G.day = o.day || 1; G.season = seasonOf(); G.light = light(G.tod); },
  };
}
