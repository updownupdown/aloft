// The clock and the sky: time of day, days and seasons, and the light they make.
// Systems read G.light (sun direction and colours, night, daylight), G.season and G.date.
import { mix3, norm, smooth } from './util.js';
import { latAt, seasonAt, yearFrac, dateOf, declination } from './earth.js';

export const DAY = 480;          // seconds in a day
export const SEASON_DAYS = 8;    // days in a season (a year is 32: earth.js YEAR_DAYS)
export const SEASONS = ['summer', 'autumn', 'winter', 'spring'];

// sky moods by sun height: night, dusk, day (rgb 0..1, Aloft's paper-warm horizon)
const MOOD = {
  day: { zenith: [.52, .68, .8], horizon: [.92, .9, .83], sunCol: [.78, .73, .62], skyAmb: [.5, .55, .6], gndAmb: [.38, .35, .28], cloud: [.97, .95, .9] },
  dusk: { zenith: [.42, .42, .6], horizon: [.97, .7, .5], sunCol: [.85, .52, .3], skyAmb: [.45, .38, .46], gndAmb: [.3, .22, .2], cloud: [.98, .78, .66] },
  night: { zenith: [.08, .11, .21], horizon: [.24, .27, .4], sunCol: [.36, .4, .52], skyAmb: [.27, .31, .44], gndAmb: [.13, .14, .19], cloud: [.3, .33, .42] },   // moonlit: dim, but the land reads
};
// The sun from the hour, the latitude and the date (earth.js): long summer days and short winter
// ones, the midnight sun and polar night near the ice, high noon in the tropics. A little gentler
// than the real sky (TILT) so a northern winter still has some day to fly in. Without a latitude
// (the labs) it is the old 45 degree north at the equinox.
const TILT = .85;
export function sunAt(tod, lat = 45, yf = 79 / 365) {
  const r = Math.PI / 180, la = Math.max(-80, Math.min(80, lat)) * r, dec = declination(yf) * TILT, H = (tod - .5) * Math.PI * 2;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const east = -Math.cos(dec) * Math.sin(H), north = Math.cos(la) * Math.sin(dec) - Math.sin(la) * Math.cos(dec) * Math.cos(H);
  return { el: Math.sin(el), dir: norm([east, Math.sin(el), -north]) };
}
export function light(tod, lat, yf) {
  const { el, dir: sunDir } = sunAt(tod, lat, yf);
  let m;
  const blend = (A, B, t) => Object.fromEntries(Object.keys(A).map(k => [k, mix3(A[k], B[k], t)]));
  if (el > .25) m = MOOD.day; else if (el > 0) m = blend(MOOD.dusk, MOOD.day, el / .25); else m = blend(MOOD.night, MOOD.dusk, smooth(-.2, 0, el));
  // at night the moon lights from high in the opposite sky
  const L = el > -.05 ? [sunDir[0], Math.max(sunDir[1], .08), sunDir[2]] : norm([-sunDir[0], .6, -sunDir[2]]);
  return { ...m, sun: norm(L), sunSky: sunDir, el, night: smooth(.05, -.2, el), daylight: smooth(-.05, .3, el) };
}
export const period = tod => (tod < .2 || tod > .8 ? 'night' : tod < .33 ? 'dawn' : tod > .68 ? 'dusk' : 'day');

// The calendar runs the same everywhere (G.day, G.yearFrac, G.date: '26 June'); the season is the
// bird's own, from where it is: G.season is summer in the north while the south has winter (and
// the tropics an endless summer). It is looked at every few seconds, and changing it ('season')
// waits till the new one has held a little, so a bird on the equator does not flicker.
export function clockSystem(G) {
  // d: the day within the season (0..7); bare: broadleaves leafless (winter and the first days of spring)
  const seasonOf = () => {
    const lat = latAt(G.b.p[0], G.b.p[2]), q = seasonAt(lat, G.yearFrac), i = q.i, d = q.d;
    return { i, d, name: SEASONS[i], key: i, lat, date: G.date.text, tropic: !!q.tropic, autumn: i === 1 ? 1 : 0, winter: i === 2 ? 1 : 0, bare: i === 2 || (i === 3 && d < 2) ? 1 : 0 };
  };
  const tick = () => { G.yearFrac = yearFrac(G.day, G.tod); G.date = dateOf(G.yearFrac); };
  G.tod = .34; G.day = 1; tick(); G.season = seasonOf(); G.light = light(G.tod, G.season.lat, G.yearFrac);
  let lookT = 0, want = null, wantT = 0;
  return {
    id: 'clock',
    update(dt) {
      G.tod += dt / DAY;
      if (G.tod >= 1) { G.tod -= 1; G.day++; G.emit('newDay', G.day); }
      tick();
      if ((lookT -= dt) <= 0) {
        lookT = 2; const s = seasonOf();
        if (s.i === G.season.i) { want = null; G.season = s; }
        else if (!want || want.i !== s.i) { want = s; wantT = 0; G.season = { ...G.season, lat: s.lat, d: s.d }; }
        else if ((wantT += 2) >= 6) { want = null; G.season = s; G.emit('season', s); }
      }
      G.light = light(G.tod, G.season.lat, G.yearFrac);
    },
    save: () => ({ tod: G.tod, day: G.day }),
    load(o) { G.tod = o.tod ?? G.tod; G.day = o.day || 1; tick(); G.season = seasonOf(); G.light = light(G.tod, G.season.lat, G.yearFrac); },
    reseason() { const s = seasonOf(), was = G.season.i; G.season = s; if (s.i !== was) G.emit('season', s); },
  };
}
