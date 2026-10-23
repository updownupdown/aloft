// Weather and the sky's moods. The weather drifts between clear, cloudy, rain and storm (snow
// in winter), greying the sky, thickening the haze and weakening the thermals; storms roll in
// as a dark cell on the wind with lightning, thunder, gusty lift ahead and sink under the core.
// Also: dawn fog that fills the hollows, a rainbow when a shower clears, the moon and its
// phases, meteor showers on rare clear nights, northern (and southern) lights in the high latitudes, and a sea
// of cloud filling the valleys of the high country on still mornings.
// Sets G.overcast, G.rain, G.storm, G.snowing, G.windK, G.fog (0..1) and env.thermal; the
// snowline (env.snow) follows the season and the ground is repainted when it moves.
import { height, WATER, env, bands, WIND, ih, fbm } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { DAY } from '../sky.js';
import { snowAt, snowLine, yearFrac } from '../earth.js';
import { clamp, lerp, mix3, smooth, norm } from '../util.js';

export const WEATHER = {
  minT: 100, maxT: 220,                         // seconds each spell lasts
  odds: { clear: .5, cloudy: .27, rain: .13, storm: .1 },
  change: 25,                                    // seconds to blend from one spell to the next
  bolt: [5, 14],                                 // seconds between lightning strokes in a storm
  cell: { r: 220, speed: 7, lift: 4.5, sink: 3.2 },   // storm cell: radius, drift (m/s), gust-front lift, core sink
};
// the snowline by season and day in it (0 summer .. 1 deep winter): it creeps down through
// autumn and winter, a step each day, and climbs back through spring

function dropShape() {
  const B = builder(), c = [.74, .79, .86];
  // a thin streak, leaning downwind along +x (instances turn it to the wind)
  const a = [0, 0, 0], b = [.25, 1.3, 0], w = .012;
  B.tri([a[0], a[1], -w], [b[0], b[1], -w], [b[0], b[1], w], c); B.tri([a[0], a[1], -w], [b[0], b[1], w], [a[0], a[1], w], c);
  B.tri([a[0] - w, a[1], 0], [b[0] - w, b[1], 0], [b[0] + w, b[1], 0], c); B.tri([a[0] - w, a[1], 0], [b[0] + w, b[1], 0], [a[0] + w, a[1], 0], c);
  return B.out();
}
function boltShape() {
  reseed(23); const B = builder(), c = [1.25, 1.22, 1.1];
  let p = [0, 1, 0];
  for (let i = 0; i < 9; i++) {
    const q = [p[0] + (Math.sin(i * 7.1) * .07), p[1] - 1 / 9, p[2] + Math.cos(i * 3.3) * .05], w = .006;
    B.tri([p[0] - w, p[1], p[2]], [q[0] - w, q[1], q[2]], [q[0] + w, q[1], q[2]], c); B.tri([p[0] - w, p[1], p[2]], [q[0] + w, q[1], q[2]], [p[0] + w, p[1], p[2]], c);
    B.tri([p[0], p[1], p[2] - w], [q[0], q[1], q[2] - w], [q[0], q[1], q[2] + w], c); B.tri([p[0], p[1], p[2] - w], [q[0], q[1], q[2] + w], [p[0], p[1], p[2] + w], c);
    p = q;
  }
  return B.out();
}
// a thunderhead: a tall heap of grey balls on a dark flat base, with an anvil spreading on top
function stormShape() {
  reseed(29); const B = builder(), D = [.42, .43, .47], L = [.6, .6, .64], T = [.78, .77, .78];
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = i ? .6 : 0; blob(B, Math.cos(a) * r, .15, Math.sin(a) * r, .5, D, L, [1, .55, 1]); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + .3; blob(B, Math.cos(a) * .35, .65 + i * .08, Math.sin(a) * .35, .45, L, T); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; blob(B, .3 + Math.cos(a) * .7, 1.35, Math.sin(a) * .55, .42, T, L, [1.3, .35, 1]); }
  return B.out();
}
// one flat puff for the sea of cloud
function puffShape() {
  reseed(31); const B = builder(), W = [.97, .96, .94], S = [.88, .88, .9];
  blob(B, 0, 0, 0, .7, W, S, [1, .32, 1]); blob(B, .45, .05, .2, .45, W, S, [1, .4, 1]); blob(B, -.4, .04, -.25, .5, S, W, [1, .4, 1]);
  return B.out();
}

export function weatherSystem(G) {
  const b = G.b, H = G.hud;
  let mistFloor = null;
  G.R.shape('drop', dropShape()); G.R.shape('bolt', boltShape()); G.R.shape('storm', stormShape()); G.R.shape('puff', puffShape());
  let spell = 'clear', spellT = 90, flash = 0, boltT = 8, bolt = null, rainbowT = 0, rainSeen = false;
  // how wet the ground is (it wets in rain and dries over a few minutes), lightning
  // flickering inside the storm cloud between strokes
  let wet = 0, cflash = 0, cflashT = 2, cflashAt = null;
  let meteorDay = 0, meteors = [], meteorT = 0, cell = null;
  G.overcast = 0; G.rain = 0; G.storm = 0; G.snowing = 0; G.windK = .3; G.fog = 0; G.aurora = 0;
  G.skyNotes = G.skyNotes || [];
  const once = (id, title, msg, ic, how) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.quietly(how, title, msg, ic); } };
  const note = text => { if (!G.skyNotes.includes(text)) { G.skyNotes.push(text); if (G.skyNotes.length > 20) G.skyNotes.shift(); G.emit('skyNote', text); } };
  const dayHash = (s) => ih(G.day, s, 91);

  // the spells to come, rolled ahead so the day dial can show a forecast (G.forecast)
  let queue = [];
  function roll() {
    const r = Math.random(), o = WEATHER.odds, winter = G.season?.winter || 0;
    const kind = r < o.clear - winter * .12 ? 'clear' : r < o.clear + o.cloudy ? 'cloudy' : r < o.clear + o.cloudy + o.rain ? 'rain' : 'storm';
    return { kind, secs: WEATHER.minT + Math.random() * (WEATHER.maxT - WEATHER.minT) };
  }
  const fill = () => { let t = 0; for (const q of queue) t += q.secs; while (queue.length < 2 || t < 600) { const q = roll(); queue.push(q); t += q.secs; } };
  function pick() { fill(); const q = queue.shift(); setSpell(q.kind, q.secs); fill(); }
  // what the weather will be `ahead` seconds from now: 'clear', 'cloud', 'rain', 'storm', 'fog' or 'snow'
  G.forecast = ahead => {
    fill();
    let kind = spell, t = spellT;
    for (const q of queue) { if (ahead < t) break; kind = q.kind; t += q.secs; }
    const tod = (G.tod + ahead / DAY) % 1, winter = G.season?.winter || 0;
    if ((kind === 'rain' || kind === 'storm') && winter > .5) return 'snow';
    if (kind !== 'storm' && dayHash(1) < .55 && tod > .19 && tod < .38 && kind !== 'rain') return 'fog';
    return kind === 'cloudy' ? 'cloud' : kind;
  };
  function setSpell(s, secs) {
    spell = s; spellT = secs ?? WEATHER.minT + Math.random() * (WEATHER.maxT - WEATHER.minT);
    if (s === 'storm') {
      // the cell rolls in from upwind, aimed to pass near the hawk
      const off = (Math.random() - .5) * 300;
      cell = { x: b.p[0] - WIND[0] * 900 - WIND[2] * off, z: b.p[2] - WIND[2] * 900 + WIND[0] * off };
    }
  }

  // storm-cell air: the gust front ahead of the cell lifts, the rain core sinks, all of it bumpy
  env.lifts.push((x, y, z) => {
    if (!cell || G.storm < .05) return 0;
    const dx = x - cell.x, dz = z - cell.z, d = Math.hypot(dx, dz), C = WEATHER.cell;
    if (d > C.r * 2.2) return 0;
    const ahead = (dx * WIND[0] + dz * WIND[2]) / Math.hypot(WIND[0], WIND[2]);
    const front = Math.exp(-(((d - C.r * 1.25) / (C.r * .35)) ** 2)) * smooth(-.2 * C.r, .5 * C.r, ahead);
    const core = Math.exp(-((d / (C.r * .7)) ** 2));
    const bump = fbm(G.t * 1.3, x * .02, 92, 2) * 2.2;
    return G.storm * (front * C.lift - core * C.sink + bump * smooth(C.r * 2.2, C.r, d));
  });

  // the warbler's song calms a storm
  G.on('gift', ev => {
    if (ev.key !== 'calm') return;
    ev.handled = true; setSpell('clear', 150 * (ev.k || 1));
  });

  // a learned song sung well at a landmark (songs.js 'placeSong'): the summit cairn calls the
  // northern lights, an arch wakes a hidden thermal under it, the falls throw a rainbow
  let songLights = 0;
  G.on('placeSong', ev => {
    const l = ev.l;
    if (ev.kind === 'lights') { songLights = 240; ev.handled = true; }
    else if (ev.kind === 'bow') { rainbowT = 80; ev.handled = true; }
    else if (ev.kind === 'thermal') {
      env.thermals = env.thermals.filter(t => t.until > G.t);
      env.thermals.push({ x: l.x, z: l.z, r: 50, w: 4.2, top: (l.y || 0) + 420, id: 900001 + (l.x | 0) % 997, song: true, until: G.t + 300 });
      ev.handled = true;
    }
  });
  return {
    id: 'weather',
    update(dt) {
      const L = G.light, winter = G.season?.winter || 0;
      // spells
      if ((spellT -= dt) <= 0) pick();
      const tgt = { clear: [0, 0, 0], cloudy: [.7, 0, 0], rain: [.85, .8, .1], storm: [1, 1, 1] }[spell];
      const k = dt / WEATHER.change;
      G.overcast += clamp(tgt[0] - G.overcast, -k, k);
      const rainT = tgt[1] * (cell && spell === 'storm' ? smooth(WEATHER.cell.r * 3, WEATHER.cell.r * .8, Math.hypot(b.p[0] - cell.x, b.p[2] - cell.z)) * .7 + .3 : 1);
      G.rain += clamp(rainT - G.rain, -k * 1.5, k * 1.5);
      G.storm += clamp(tgt[2] - G.storm, -k, k);
      G.snowing = winter > .5 ? G.rain : 0;
      if (cell) {
        cell.x += WIND[0] * WEATHER.cell.speed * dt; cell.z += WIND[2] * WEATHER.cell.speed * dt;
        if (G.storm < .02 && spell !== 'storm') cell = null;
      }
      // a slowly turning breeze, gusty in storms; it sways the trees and sings in the wings
      G.windK = clamp(.3 + fbm(G.t * .01, 3, 93, 2) * .35 + G.storm * .5 * (1 + fbm(G.t * .3, 7, 94, 1)) + G.overcast * .1, 0, 1);
      // rising air: none at night, weak at dawn, killed by rain, weaker in cloud and in winter
      env.thermal = (1 - .45 * G.overcast) * (1 - .85 * G.rain) * (1 - .35 * winter);
      // lightning
      flash = Math.max(0, flash - dt * 3.5);
      if (G.storm > .7 && winter < .5 && cell) {
        if ((boltT -= dt) <= 0) {
          boltT = WEATHER.bolt[0] + Math.random() * (WEATHER.bolt[1] - WEATHER.bolt[0]);
          const a = Math.random() * 6.283, r = Math.random() * WEATHER.cell.r;
          const x = cell.x + Math.cos(a) * r, z = cell.z + Math.sin(a) * r, km = Math.max(.15, Math.hypot(x - b.p[0], z - b.p[2]) / 1000);
          flash = clamp(1.2 - km / 2, .25, 1); bolt = { x, z, y: Math.max(height(x, z), WATER), t: .25, yaw: Math.random() * 6 };
          G.audio.thunder(km / .343, km);
          once('storm', 'Storm', 'A storm. Ride the gusts along its leading edge, or shelter in a tree until it passes.', 'updraft', 'n');
        }
      }
      if (bolt && (bolt.t -= dt) <= 0) bolt = null;
      wet = clamp(wet + (G.rain - G.snowing > .1 ? dt * .04 * G.rain : -dt * .004), 0, 1);
      cflash = Math.max(0, cflash - dt * 5);
      if (G.storm > .5 && cell && (cflashT -= dt) <= 0) {
        cflashT = .6 + Math.random() * 3.5; cflash = .5 + Math.random() * .5;
        const a = Math.random() * 6.283, r = Math.random() * WEATHER.cell.r * .8;
        cflashAt = [cell.x + Math.cos(a) * r, Math.max(80, b.p[1] + 60) + 40 + Math.random() * 120, cell.z + Math.sin(a) * r];
      }
      // dawn fog on most still mornings, thickest over the lakes and the marsh, gone by mid-morning
      const k2 = bands(b.p[0], b.p[2]), foggy = dayHash(1) < .55 && G.storm < .3;
      const morning = smooth(.19, .25, G.tod) * (1 - smooth(.32, .42, G.tod));
      G.fog = lerp(G.fog, foggy ? morning * (.7 + .3 * Math.max(k2.lakes, k2.marsh)) : 0, Math.min(1, dt * .3));
      if (G.fog > .4) once('fog', 'Fog', 'Morning fog fills the hollows. Climb and the treetops stand out of it; low down the world goes quiet.', 'how');
      // a rainbow when an afternoon shower clears
      if (G.rain > .35) rainSeen = true;
      if (rainSeen && G.rain < .08) {
        rainSeen = false;
        if (G.tod > .3 && G.tod < .72 && G.overcast < .75 && !G.snowing) { rainbowT = 80; H.name('Rainbow', 'graphics'); note(`Day ${G.day}: a rainbow.`); }
      }
      rainbowT = Math.max(0, rainbowT - dt);
      // the night's sky: the moon's phase over sixteen days, rare meteor showers, northern lights
      G.moonPhase = ((G.day + 5) % 16 + G.tod) / 16;   // 0 new, .5 full (a waxing moon the first night)
      if (G.tod > .78 && meteorDay !== G.day) {
        meteorDay = G.day;
        G.meteors = dayHash(2) < .14 && G.overcast < .3;
        if (G.meteors) { H.name('Meteor shower', 'sleep'); note(`Day ${G.day}: a meteor shower.`); }
      }
      if (G.tod > .25 && G.tod < .7) G.meteors = false;
      if (G.meteors && L.night > .5 && (meteorT -= dt) <= 0) {
        meteorT = .6 + Math.random() * 2.5;
        const a = Math.random() * 6.283, el = .45 + Math.random() * .6;
        meteors.push({ d: norm([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)]), v: norm([Math.random() - .5, -.35, Math.random() - .5]), t: 0, life: .5 + Math.random() * .5 });
      }
      for (const m of meteors) m.t += dt;
      meteors = meteors.filter(m => m.t < m.life);
      const north = smooth(46, 62, Math.abs(G.season?.lat ?? 0)), cold = clamp((G.season?.autumn || 0) + winter + (G.season?.name === 'spring' ? .5 : 0), 0, 1);
      if (songLights > 0) songLights -= dt;
      if (env.thermals.length && env.thermals[0].until < G.t) env.thermals = env.thermals.filter(t => t.until > G.t);
      const lights = Math.max(dayHash(3) < .45 ? L.night * (1 - G.overcast) * north * cold : 0, songLights > 0 ? Math.max(.25, L.night) * Math.min(1, songLights / 20) : 0);
      G.aurora = lerp(G.aurora, lights, Math.min(1, dt * .3));
      if (G.aurora > .5) note(`${G.date?.text || `Day ${G.day}`}: ${(G.season?.lat ?? 1) < 0 ? 'southern' : 'northern'} lights.`);
      if (G.snowing > .3) once('snow', 'Snow', 'Snow. Mice are harder to spot under it: look for the faint stir in the white.', 'how');
      // the snowline follows the date and the latitude (earth.js): env.snow is the bird's own, for the
      // systems near it; the ground paints each place's own from env.yearFrac, repainted once a day
      const yf = yearFrac(G.day, .5), lat = G.season.lat ?? 45;
      env.snow = snowAt(lat, yf); env.snowLine = snowLine(lat, yf); env.season = G.season?.name || 'summer'; env.seasonDay = G.season.d || 0;
      if (env.yearFrac !== yf) { env.yearFrac = yf; G.R.dropChunks?.(); }
      if (G.storm > .3 && b.state === 'fly') G.hud.did?.('storm');
    },
    scene(S) {
      S.snowLine = env.snowLine;   // render.js lays snow on leaves and needles above it
      const ov = G.overcast, st = G.storm, L = G.light;
      // greyer, flatter light under cloud; darker in a storm; a flash of lightning lifts it all
      const grey = [.7, .71, .72].map(v => v * (.25 + .75 * (1 - L.night)) * (1 - .4 * st));
      S.zenith = mix3(S.zenith, grey, ov * .85);
      S.horizon = mix3(S.horizon, mix3(grey, [.85, .85, .84], .4 * (1 - st) * (1 - L.night)), ov * .7);
      S.cloud = mix3(S.cloud, grey.map(v => v * 1.08), ov * .6);
      S.sunCol = S.sunCol.map(v => v * (1 - .65 * ov));
      S.skyAmb = S.skyAmb.map(v => v * (1 + .3 * ov * (1 - st)) * (1 - .3 * st));
      S.gndAmb = S.gndAmb.map(v => v * (1 + .2 * ov) * (1 - .3 * st));
      if (flash > 0) { const f = flash * (.6 + .4 * Math.sin(G.t * 60)); for (const k of ['zenith', 'horizon', 'skyAmb', 'gndAmb']) S[k] = S[k].map(v => v + f * .5); }
      // haze: thicker in rain and snow; fog lies in the hollows, so climbing out of it clears the view
      const above = S.cam[1] - Math.max(height(S.cam[0], S.cam[2]), WATER);
      // (with volume clouds, clouds.js, the morning fog is a layer of mist over the low ground round
      // about instead, its top a slowly followed few metres over the lowest of it)
      const mist = G.R.cloudStyle !== 'poly';
      S.fogDen = (S.fogDen || .0042) + G.rain * .004 + G.snowing * .003 + (mist ? 0 : G.fog * .018 * smooth(70, 15, above));
      if (G.fog > .05 && mist) {
        let lo = 1e9; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = i ? 220 : 0; lo = Math.min(lo, Math.max(height(S.cam[0] + Math.cos(a) * r, S.cam[2] + Math.sin(a) * r), WATER)); }
        mistFloor = mistFloor == null || Math.abs(mistFloor - lo) > 200 ? lo : mistFloor + (lo - mistFloor) * Math.min(1, .02);
        (S.mists ||= []).push([mistFloor + 14 + 26 * G.fog, .02 * G.fog, 12, 16]);
      }
      if (G.fog > .05 && !mist) S.horizon = mix3(S.horizon, [.9, .9, .88].map(v => v * (.3 + .7 * L.daylight)), G.fog * .5 * smooth(70, 15, above));
      const cam = S.cam;
      // rain streaks and snowflakes in a box that moves with the camera (they stay put in the world)
      const wrap = (v, c, r) => c + ((((v - c) % (2 * r)) + 3 * r) % (2 * r)) - r;
      const wyaw = Math.atan2(WIND[2], WIND[0]);
      if (G.rain - G.snowing > .02) {
        const d = S.props.drop ||= [], n = Math.round((G.rain - G.snowing) * 260), R = 22, Y = 14;
        for (let i = 0; i < n; i++) {
          const hx = ih(i, 1, 95) * 999, hz = ih(i, 2, 95) * 999, hy = ih(i, 3, 95) * 999;
          const y = cam[1] + Y - (((hy + G.t * 16) % (2 * Y)));
          d.push(wrap(hx - y * .2, cam[0], R), y, wrap(hz, cam[2], R), 1, -wyaw, .5, 0, 0);
        }
      }
      if (G.snowing > .02) {
        const n = Math.round(G.snowing * 320), R = 20, Y = 12;
        for (let i = 0; i < n; i++) {
          const hx = ih(i, 4, 95) * 999, hz = ih(i, 5, 95) * 999, hy = ih(i, 6, 95) * 999;
          const y = cam[1] + Y - (((hy + G.t * 1.6) % (2 * Y)));
          S.motes.push(wrap(hx + Math.sin(G.t * .7 + i) * 1.2 + G.t * 2, cam[0], R), y, wrap(hz + Math.cos(G.t * .5 + i * 1.3), cam[2], R), .96, .96, .97, .05);
        }
      }
      // the storm cell, and the bolt
      if (cell && st > .05) (S.props.storm ||= []).push(cell.x, Math.max(80, cam[1] + 60), cell.z, WEATHER.cell.r * 1.1 * Math.min(1, st * 1.5), 0, .5, 0, 0);
      if (bolt) (S.props.bolt ||= []).push(bolt.x, bolt.y, bolt.z, Math.max(150, cam[1] + 140 - bolt.y), bolt.yaw, .5, 0, 0);
      // rain shafts under the storm and the rain clouds, lightning lighting the clouds from inside,
      // the ground wet after rain
      S.wet = 0; S.flash = null; S.rainK = 0;
      {
        S.wet = wet * (1 - env.snow);
        if (bolt) S.flash = [bolt.x, Math.max(80, cam[1] + 60) + 60, bolt.z, flash];
        else if (cflash > 0 && cflashAt) S.flash = [...cflashAt, cflash];
        if (G.R.cloudStyle !== 'poly' && G.rain - G.snowing > .15) {
          const sh = S.props.shaft ||= [], k = G.rain - G.snowing;
          if (cell && st > .05) {
            const top = Math.max(80, cam[1] + 60);
            for (let i = 0; i < 5; i++) {
              const a = i * 2.4 + 1, r = WEATHER.cell.r * (.15 + .35 * ((i * .37) % 1)), x = cell.x + Math.cos(a) * r, z = cell.z + Math.sin(a) * r, g = Math.max(height(x, z), WATER);
              sh.push(x, g, z, top - g + 20, a, .3 + .5 * k * st, 0, 0);
            }
          }
          S.rainK = k;   // (render.js hangs a shaft under every other rain cloud, the clouds being laid later)
        }
      }
      // the rainbow: a faint, wide arc far off, opposite the sun, its colours running into each
      // other (many small overlapping points read as a smooth band), fading toward its feet
      if (rainbowT > 0) {
        const fade = Math.min(1, rainbowT / 12, (80 - rainbowT) / 8) * L.daylight * (1 - G.rain);
        const sd = S.sunSky || L.sunSky, ax = norm([-sd[0], 0, -sd[2]]), side = [-ax[2], 0, ax[0]], D = 560;
        const cols = [[.86, .4, .32], [.9, .64, .32], [.9, .85, .48], [.52, .74, .48], [.4, .56, .78], [.52, .44, .72]];
        const N = 14, M = 240;
        for (let k = 0; k < N; k++) {
          const u = k / (N - 1) * (cols.length - 1), c0 = cols[Math.floor(u)], c1 = cols[Math.min(cols.length - 1, Math.floor(u) + 1)];
          const edge = Math.sin(k / (N - 1) * Math.PI) * .6 + .4, col = mix3(c0, c1, u % 1), r = D * (.8 - k * .0075);
          for (let i = 0; i <= M; i++) {
            const t = i / M, a = .12 + t * (Math.PI - .24), x = Math.cos(a) * r, y = Math.sin(a) * r - D * .45;
            if (y < -20) continue;
            const feet = Math.min(1, Math.sin(t * Math.PI) * 2.2);
            S.motes.push(cam[0] + ax[0] * D + side[0] * x, cam[1] + y, cam[2] + ax[2] * D + side[2] * x, ...mix3(S.horizon, col, .38 * fade * edge * feet), 3.2);
          }
        }
      }
      // night: the moon (drawn by the sky, render.js: lit toward the sun, by its phase), meteors, aurora
      S.moonK = 0; S.overcast = ov;
      if (L.night > .05) {
        const D = 700;
        // where the moonlight comes from (sky.js: L.sun is the moon's at night)
        { const sd = L.sunSky, md = norm([-sd[0], .6, -sd[2]]); S.moon = [...md, G.moonPhase || 0]; S.moonK = Math.max(0, Math.min(1, (L.night - .35) / .4)) * (1 - ov); }   // where the moonlight comes from at night (sky.js)
        for (const m of meteors) {
          const f = m.t / m.life;
          for (let i = 0; i < 8; i++) {
            const t = (m.t - i * .025) * 260; if (t < 0) continue;
            S.motes.push(cam[0] + m.d[0] * D + m.v[0] * t, cam[1] + m.d[1] * D + m.v[1] * t, cam[2] + m.d[2] * D + m.v[2] * t, ...mix3(S.zenith, [1, .97, .9], (1 - i / 8) * (1 - f) * L.night), 2.2 - i * .2);
          }
        }
        // the northern lights are drawn by the sky itself (render.js)
        S.aurora = G.aurora * L.night * (1 - ov);
      }
      // a sea of cloud in the high country on still mornings: the valleys fill, the peaks stand out
      const k = bands(cam[0], cam[2]), hi = Math.max(k.high, k.ridge);
      // (only over the hills: never out over the sea, where it read as grey lumps on the water)
      const sea = hi * smooth(20, 45, height(cam[0], cam[2])) * (dayHash(4) < .4 ? 1 : 0) * smooth(.2, .25, G.tod) * (1 - smooth(.36, .45, G.tod)) * (1 - st);
      if (sea > .05) {
        const top = 72, P = S.props.puff ||= [], step = 34, R = 420;
        // (with volume clouds, clouds.js, it is a layer of mist: top, density, lumps, thinning above)
        if (G.R.cloudStyle !== 'poly') (S.mists ||= []).push([top + 6 - (1 - sea) * 30, .03 * sea, 18, 18]);
        const gx0 = Math.floor((cam[0] - R) / step), gz0 = Math.floor((cam[2] - R) / step);
        if (G.R.cloudStyle === 'poly') for (let gz = gz0; gz <= gz0 + 2 * R / step; gz++) for (let gx = gx0; gx <= gx0 + 2 * R / step; gx++) {
          const x = (gx + ih(gx, gz, 96)) * step, z = (gz + ih(gx, gz, 97)) * step;
          const h = height(x, z); if (Math.hypot(x - cam[0], z - cam[2]) > R || h > top - 8 || h < 3) continue;
          P.push(x + Math.sin(G.t * .05 + gx) * 4, top - 6 + ih(gx, gz, 98) * 6 - (1 - sea) * 30, z, 30 + ih(gx, gz, 99) * 14, ih(gx, gz, 100) * 6.28, .5, 0, 0);
        }
        if (cam[1] > top + 10) once('seacloud', 'Sea of cloud', 'A sea of cloud fills the valleys below, and the peaks stand out of it like islands.', 'how');
      }
    },
    save: () => ({ spell, spellT, queue, cell, rainbowT, notes: G.skyNotes.slice(-20) }),
    load(o) {
      spell = o.spell || 'clear'; spellT = o.spellT || 90; queue = Array.isArray(o.queue) ? o.queue : []; cell = o.cell || null; rainbowT = o.rainbowT || 0; G.skyNotes = o.notes || [];
      const t = { clear: [0, 0, 0], cloudy: [.7, 0, 0], rain: [.85, .8, .1], storm: [1, 1, 1] }[spell] || [0, 0, 0];
      [G.overcast, G.rain, G.storm] = t;
    },
    // debug: __aloft3d.G.systems.weather.set('storm')
    set(s, secs = 999) { setSpell(s, secs); },
    rainbow() { rainbowT = 80; },
  };
}
