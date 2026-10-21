// The other hunters and pests of the air. Crows mob you when you fly low by their woods,
// until you climb away (C3). A bald eagle chases you while you carry a fish, and takes it if
// it catches you, unless you get to a perch first (C3). Other hunters show you where food is
// (C5): a kestrel hangs over a mouse in the meadow, gulls wheel and plunge over rising fish,
// ravens circle over carrion on the open hills (land beside it for a meal).
import { height, groundAt, forest, blend, ih, WATER } from '../world.js';
import { crow, eagle, kestrel, gull, raven, carrion } from './critshapes.js';

const CARRION_CELL = 600, CARRION_LANDS = { moor: .4, mountains: .3, alpine: .25, savanna: .4, badlands: .3, meadow: .12 };

export function huntersSystem(G) {
  const b = G.b, R = G.R, H = G.hud;
  for (const [k, f] of Object.entries({ crow, eagle, kestrel, gull, raven })) { R.shape(k + 'U', f(true)); R.shape(k + 'D', f(false)); }
  R.shape('carrion', carrion());
  G.guide?.page('eagle', 'Bald eagle', 'A fishing bird, but a pirate too: it would rather rob an osprey than catch its own.');
  G.guide?.page('kestrel', 'American kestrel', 'The smallest falcon hangs on beating wings over one spot, watching for a mouse.');
  G.guide?.page('gull', 'Herring gull', 'Where gulls wheel and plunge, the fish are near the surface.');
  G.guide?.page('raven', 'Common raven', 'Ravens circle over a carcass and call the wolves and eagles to open it.');
  const once = (id, msg, secs = 4) => { if (!G.flags[id]) { G.flags[id] = 1; H.toast(msg, secs); } };
  const caw = (d = 0) => { G.audio.tone?.({ f: 620, f2: 470, dur: .16, vol: .05, delay: d }); G.audio.tone?.({ f: 600, f2: 440, dur: .14, vol: .045, delay: d + .22 }); };
  let mob = null, mobCool = 40, pirate = null, carryT = 0, eaten = {};

  function startMob() {
    const a = b.yaw;
    mob = { t: 0, crows: Array.from({ length: 4 }, (_, i) => ({ p: [b.p[0] + Math.sin(a) * 30 + (i - 1.5) * 4, b.p[1] + 3, b.p[2] - Math.cos(a) * 30], ph: i * 1.6, v: [0, 0, 0] })) };
    caw(); caw(.5);
    once('crows', 'Crows! They mob a hawk near their woods. Climb away and they give up.', 4);
  }
  function carrionNear(r) {
    const out = [], x0 = b.p[0], z0 = b.p[2];
    for (let gz = Math.floor((z0 - r) / CARRION_CELL); gz <= Math.floor((z0 + r) / CARRION_CELL); gz++) for (let gx = Math.floor((x0 - r) / CARRION_CELL); gx <= Math.floor((x0 + r) / CARRION_CELL); gx++) {
      const x = (gx + .25 + ih(gx, gz, 401) * .5) * CARRION_CELL, z = (gz + .25 + ih(gx, gz, 402) * .5) * CARRION_CELL, id = gx + '_' + gz;
      if (ih(gx, gz, 403 + (G.day % 3)) > (CARRION_LANDS[blend(x, z)[0].name] || 0) || height(x, z) < 1) continue;
      if (eaten[id] && G.day - eaten[id] < 3) continue;
      out.push({ id, x, z, y: groundAt(x, z), yaw: ih(gx, gz, 404) * 6.28 });
    }
    return out;
  }
  let carrions = [], carrionT = 0;

  return {
    id: 'hunters',
    update(dt) {
      const ground = Math.max(height(b.p[0], b.p[2]), WATER), above = b.p[1] - ground, day = G.light.daylight > .5;
      // crows: low over the woods by day
      mobCool -= dt;
      if (!mob && mobCool <= 0 && day && b.state === 'fly' && above < 35 && forest(b.p[0], b.p[2]) > .15 && Math.random() < dt * .03) startMob();
      if (mob) {
        mob.t += dt;
        for (const c of mob.crows) {
          // each dives at you from its own side, then swings round again
          c.ph += dt * 1.7;
          const t = [b.p[0] + Math.cos(c.ph) * 5, b.p[1] + 2 + Math.sin(c.ph * 1.3) * 2, b.p[2] + Math.sin(c.ph) * 5];
          for (let i = 0; i < 3; i++) { c.v[i] += ((t[i] - c.p[i]) * 2.5 - c.v[i]) * Math.min(1, dt * 2.5); c.p[i] += c.v[i] * dt; }
          if (Math.hypot(c.p[0] - b.p[0], c.p[1] - b.p[1], c.p[2] - b.p[2]) < 1.6 && Math.random() < dt * 2) { b.yaw += (Math.random() - .5) * .25; G.audio.feather?.(); }
        }
        if (Math.random() < dt * .7) caw();
        if (above > 60 || mob.t > 30 || b.state !== 'fly') { mob = null; mobCool = 120; if (above > 60) once('crowsGone', 'High enough: the crows turn back to their trees.', 3); }
      }
      // the eagle and your fish
      carryT = b.carry?.kind === 'fish' && b.state === 'fly' ? carryT + dt : 0;
      if (!pirate && carryT > 4 && Math.random() < dt * .25) {
        const a = b.yaw + Math.PI;
        pirate = { p: [b.p[0] + Math.sin(a) * 60, b.p[1] + 25, b.p[2] - Math.cos(a) * 60], t: 0, flee: 0 };
        G.audio.tone?.({ f: 1800, f2: 1500, dur: .12, vol: .05 }); G.audio.tone?.({ f: 1900, f2: 1400, dur: .1, vol: .05, delay: .16 }); G.audio.tone?.({ f: 1800, f2: 1300, dur: .1, vol: .05, delay: .3 });
        once('eagle', 'A bald eagle wants your fish! Get to a perch, or the ground, to eat it.', 4.5);
      }
      if (pirate) {
        pirate.t += dt;
        const e = pirate.p;
        if (pirate.flee > 0) { pirate.flee -= dt; e[1] += dt * 6; e[0] += Math.sin(pirate.yaw) * 18 * dt; e[2] -= Math.cos(pirate.yaw) * 18 * dt; if (pirate.flee <= 0) pirate = null; }
        else {
          const dx = b.p[0] - e[0], dy = b.p[1] + .5 - e[1], dz = b.p[2] - e[2], d = Math.hypot(dx, dy, dz), v = Math.min(26, (b.s || 10) + 3);
          pirate.yaw = Math.atan2(dx, -dz);
          for (const [i, k] of [[0, dx], [1, dy], [2, dz]]) e[i] += k / (d || 1) * v * dt;
          if (b.carry?.kind !== 'fish' || b.state !== 'fly') { pirate.flee = 4; }   // eaten, or landed with it: it gives up
          else if (d < 2.5) { b.carry = null; pirate.flee = 6; H.toast('The eagle snatched your fish!', 3); G.audio.feather?.(); }
          else if (pirate.t > 35 || d > 160) pirate.flee = 4;
        }
      }
      // carrion: ravens over it; come down beside it for a meal
      if ((carrionT -= dt) <= 0) { carrionT = 2; carrions = carrionNear(700); }
      if (b.state === 'fly') for (const c of carrions) {
        if (b.p[1] - c.y < 2.5 && Math.hypot(b.p[0] - c.x, b.p[2] - c.z) < 2.5) {
          eaten[c.id] = G.day; carrions = carrions.filter(o => o !== c);
          G.systems.food?.take?.({ x: c.x + 1, y: c.y, z: c.z, kind: 'carrion', food: .45, wet: .05, name: 'a share of the carrion' });
          once('carrion', 'Carrion: the ravens showed you. Not pretty, but it fills you up.', 4);
          break;
        }
      }
    },
    scene(S) {
      const cam = S.cam, flap = k => Math.sin(G.t * k) > 0, push = (n, up, p, s, yaw) => (S.props[n + (up ? 'U' : 'D')] ||= []).push(p[0], p[1], p[2], s, yaw, .5, 0, 0);
      if (mob) for (const c of mob.crows) push('crow', flap(14 + c.ph % 3), c.p, 1, Math.atan2(c.v[2], c.v[0]));
      if (pirate) push('eagle', flap(5), pirate.p, 1, pirate.yaw - Math.PI / 2);
      if (pirate && Math.hypot(pirate.p[0] - cam[0], pirate.p[2] - cam[2]) < 60) G.sight?.('eagle', ...pirate.p, 1.2);
      if (G.light.daylight < .5) return;
      // a kestrel hanging over a mouse, wings beating fast
      const mice = G.systems.food?.mice;
      if (mice) {
        let n = 0;
        for (const m of mice.values()) {
          if (n >= 2 || m.hidden > 0 || ih(m.id | 0, 0, 410) > .35) continue;
          const d = Math.hypot(m.x - cam[0], m.z - cam[2]); if (d > 260 || d < 25) continue;
          n++;
          const p = [m.x + Math.sin(G.t * .7 + n) * .6, m.y + 12 + Math.sin(G.t * 1.1) * .4, m.z];
          push('kestrel', flap(22), p, 1, Math.PI);   // into the wind
          if (d < 70) G.sight?.('kestrel', ...p, .5);
        }
      }
      // gulls wheeling over fish near the surface, now and then one plunges
      const fish = G.wild?.fish || [];
      let g = 0;
      for (const f of fish) {
        if (g >= 4 || ih(f.id | 0, 0, 411) > .4) continue;
        const d = Math.hypot(f.x - cam[0], f.z - cam[2]); if (d > 260) continue;
        g++;
        for (let i = 0; i < 2; i++) {
          const a = G.t * (.5 + i * .12) + i * 3 + f.id, plunge = f.up > .6 && i === 0 ? (f.up - .6) * 2.5 : 0;
          const p = [f.x + Math.cos(a) * 9 * (1 - plunge), WATER + 14 - plunge * 13, f.z + Math.sin(a) * 9 * (1 - plunge)];
          push('gull', plunge > 0 ? false : flap(6 + i), p, 1, a + Math.PI / 2);
          if (d < 80) G.sight?.('gull', ...p, .6);
        }
      }
      // carrion, and its ravens
      for (const c of carrions) {
        if (Math.abs(c.x - cam[0]) > 500 || Math.abs(c.z - cam[2]) > 500) continue;
        (S.props.carrion ||= []).push(c.x, c.y, c.z, 1, c.yaw, .5, 0, 0);
        for (let i = 0; i < 3; i++) {
          const a = G.t * .35 + i * 2.1, p = [c.x + Math.cos(a) * 14, c.y + 22 + i * 4, c.z + Math.sin(a) * 14];
          push('raven', flap(2.2) && Math.sin(G.t * .4 + i) > .5, p, 1, a + Math.PI / 2);
          if (i === 0 && Math.hypot(c.x - cam[0], c.z - cam[2]) < 90) G.sight?.('raven', ...p, 1);
        }
      }
    },
    save: () => ({ eaten }),
    load(o) { eaten = o.eaten || eaten; },
  };
}
