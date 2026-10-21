// Weather and the sky's moods. The weather drifts between clear, cloudy, rain and storm (snow
// in winter), greying the sky, thickening the haze and weakening the thermals; storms roll in
// as a dark cell on the wind with lightning, thunder, gusty lift ahead and sink under the core.
// Also: dawn fog that fills the hollows, a rainbow when a shower clears, the moon and its
// phases, meteor showers on rare clear nights, northern lights early in the journey, and a sea
// of cloud filling the valleys of the high country on still mornings.
// Sets G.overcast, G.rain, G.storm, G.snowing, G.windK, G.fog (0..1) and env.thermal; the
// snowline (env.snow) follows the season and the ground is repainted when it moves.
import { height, WATER, env, bands, WIND, ih, fbm } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { DAY } from '../sky.js';
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
const SNOW = { summer: () => 0, autumn: d => .04 + d * .045, winter: d => .5 + d * .072, spring: d => .62 - d * .075 };

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
  G.R.shape('drop', dropShape()); G.R.shape('bolt', boltShape()); G.R.shape('storm', stormShape()); G.R.shape('puff', puffShape());
  let spell = 'clear', spellT = 90, flash = 0, boltT = 8, bolt = null, rainbowT = 0, rainSeen = false;
  let meteorDay = 0, meteors = [], meteorT = 0, cell = null;
  G.overcast = 0; G.rain = 0; G.storm = 0; G.snowing = 0; G.windK = .3; G.fog = 0; G.aurora = 0;
  G.skyNotes = G.skyNotes || [];
  const once = (id, msg, secs = 5) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs); } };
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
    if (G.storm > .2 || G.rain > .2) H.toast('The storm eases, and the sky begins to clear.', 3);
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
          once('storm', 'A storm. Ride the gusts along its leading edge, or shelter in a tree until it passes.', 6);
        }
      }
      if (bolt && (bolt.t -= dt) <= 0) bolt = null;
      // dawn fog on most still mornings, thickest over the lakes and the marsh, gone by mid-morning
      const k2 = bands(b.p[0], b.p[2]), foggy = dayHash(1) < .55 && G.storm < .3;
      const morning = smooth(.19, .25, G.tod) * (1 - smooth(.32, .42, G.tod));
      G.fog = lerp(G.fog, foggy ? morning * (.7 + .3 * Math.max(k2.lakes, k2.marsh)) : 0, Math.min(1, dt * .3));
      if (G.fog > .4) once('fog', 'Morning fog fills the hollows. Climb and the treetops stand out of it; low down the world goes quiet.', 6);
      // a rainbow when an afternoon shower clears
      if (G.rain > .35) rainSeen = true;
      if (rainSeen && G.rain < .08) {
        rainSeen = false;
        if (G.tod > .3 && G.tod < .72 && G.overcast < .75 && !G.snowing) { rainbowT = 80; H.toast('The shower passes, and a rainbow stands over the land.', 4); note(`Day ${G.day}: a rainbow.`); }
      }
      rainbowT = Math.max(0, rainbowT - dt);
      // the night's sky: the moon's phase over sixteen days, rare meteor showers, northern lights
      G.moonPhase = ((G.day - 1) % 16 + G.tod) / 16;
      if (G.tod > .78 && meteorDay !== G.day) {
        meteorDay = G.day;
        G.meteors = dayHash(2) < .14 && G.overcast < .3;
        if (G.meteors) { H.toast('A meteor shower tonight. Watch the sky.', 4); note(`Day ${G.day}: a meteor shower.`); }
      }
      if (G.tod > .25 && G.tod < .7) G.meteors = false;
      if (G.meteors && L.night > .5 && (meteorT -= dt) <= 0) {
        meteorT = .6 + Math.random() * 2.5;
        const a = Math.random() * 6.283, el = .45 + Math.random() * .6;
        meteors.push({ d: norm([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)]), v: norm([Math.random() - .5, -.35, Math.random() - .5]), t: 0, life: .5 + Math.random() * .5 });
      }
      for (const m of meteors) m.t += dt;
      meteors = meteors.filter(m => m.t < m.life);
      const north = 1 - smooth(1500, 4500, b.p[2]), cold = clamp((G.season?.autumn || 0) + winter + (G.season?.name === 'spring' ? .5 : 0), 0, 1);
      const lights = dayHash(3) < .45 ? L.night * (1 - G.overcast) * north * cold : 0;
      G.aurora = lerp(G.aurora, lights, Math.min(1, dt * .3));
      if (G.aurora > .5) note(`Day ${G.day}: northern lights.`);
      if (G.snowing > .3) once('snow', 'Snow. Mice are harder to spot under it: look for the faint stir in the white.', 5);
      // the snowline follows the season; repaint the ground when it moves
      const sn = G.season?.name || 'summer', snow = Math.max(0, SNOW[sn]?.(G.season.d || 0) ?? 0);
      if (Math.abs(env.snow - snow) > .01 || env.season !== sn) { env.snow = snow; env.season = sn; env.seasonDay = G.season.d || 0; G.R.dropChunks?.(); }
      if (G.storm > .3 && b.state === 'fly') G.hud.did?.('storm');
    },
    scene(S) {
      S.snowLine = 185 - env.snow * 200;   // render.js lays snow on leaves and needles above it
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
      S.fogDen = (S.fogDen || .0042) + G.rain * .004 + G.snowing * .003 + G.fog * .018 * smooth(70, 15, above);
      if (G.fog > .05) S.horizon = mix3(S.horizon, [.9, .9, .88].map(v => v * (.3 + .7 * L.daylight)), G.fog * .5 * smooth(70, 15, above));
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
      // night: the moon (a pale disc, a sky-coloured one over it for the phase), meteors, aurora
      if (L.night > .05) {
        const sd = L.sunSky, md = norm([-sd[0], .08 + .1 * Math.max(0, -sd[1]), -sd[2] + .3]), D = 700;
        const mp = [cam[0] + md[0] * D, cam[1] + md[1] * D, cam[2] + md[2] * D], R = 16, a = L.night * (1 - ov);
        if (a > .05) {
          S.motes.push(...mp, ...mix3(S.zenith, [.95, .93, .85], a), R);
          const ph = G.moonPhase || 0, off = 2.1 * R * (1 - Math.abs(1 - 2 * ph)), s = ph < .5 ? 1 : -1;
          const side = norm([md[2], 0, -md[0]]);
          if (off < 2 * R - .5) S.motes.push(mp[0] + side[0] * off * s, mp[1] + .5, mp[2] + side[2] * off * s, ...S.zenith, R * 1.02);
        }
        for (const m of meteors) {
          const f = m.t / m.life;
          for (let i = 0; i < 8; i++) {
            const t = (m.t - i * .025) * 260; if (t < 0) continue;
            S.motes.push(cam[0] + m.d[0] * D + m.v[0] * t, cam[1] + m.d[1] * D + m.v[1] * t, cam[2] + m.d[2] * D + m.v[2] * t, ...mix3(S.zenith, [1, .97, .9], (1 - i / 8) * (1 - f) * L.night), 2.2 - i * .2);
          }
        }
        if (G.aurora > .03) {
          for (let c = 0; c < 3; c++) for (let i = 0; i < 72; i++) for (let j = 0; j < 7; j++) {
            const u = i / 71 - .5, x = u * 1700 + Math.sin(u * 7 + G.t * .15 + c * 2) * 110, z = -700 - c * 70 + Math.sin(u * 5 + c + G.t * .1) * 70;
            const sh = .55 + .45 * Math.sin(u * 30 + G.t * (.6 + c * .2) + j * .5), h = j / 6;
            const col = mix3([.3, .95, .55], [.65, .4, .85], h * .8);
            S.motes.push(cam[0] + x, cam[1] + 30 + j * 26 + c * 12 + Math.sin(u * 11 + G.t * .3) * 15, cam[2] + z, ...mix3(S.zenith, col, G.aurora * sh * (1 - h * .6) * .42), 22);
          }
        }
      }
      // a sea of cloud in the high country on still mornings: the valleys fill, the peaks stand out
      const k = bands(cam[0], cam[2]), hi = Math.max(k.high, k.ridge);
      const sea = hi * (dayHash(4) < .4 ? 1 : 0) * smooth(.2, .25, G.tod) * (1 - smooth(.36, .45, G.tod)) * (1 - st);
      if (sea > .05) {
        const top = 72, P = S.props.puff ||= [], step = 34, R = 420;
        const gx0 = Math.floor((cam[0] - R) / step), gz0 = Math.floor((cam[2] - R) / step);
        for (let gz = gz0; gz <= gz0 + 2 * R / step; gz++) for (let gx = gx0; gx <= gx0 + 2 * R / step; gx++) {
          const x = (gx + ih(gx, gz, 96)) * step, z = (gz + ih(gx, gz, 97)) * step;
          if (Math.hypot(x - cam[0], z - cam[2]) > R || height(x, z) > top - 8) continue;
          P.push(x + Math.sin(G.t * .05 + gx) * 4, top - 6 + ih(gx, gz, 98) * 6 - (1 - sea) * 30, z, 30 + ih(gx, gz, 99) * 14, ih(gx, gz, 100) * 6.28, .5, 0, 0);
        }
        if (cam[1] > top + 10) once('seacloud', 'A sea of cloud fills the valleys below, and the peaks stand out of it like islands.', 6);
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
