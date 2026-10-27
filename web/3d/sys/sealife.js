// Life at sea: great whales that surface, blow and dive (stand on a broad back to rest until it
// sounds), fish boils with gulls diving into them (food), flying fish bursting ahead of a bird
// skimming the warm seas, and sea turtles paddling up to breathe. Which ocean has more of what
// follows earth.js OCEANS: the whale road (the Indian Ocean) has the most whales.
// Placed by hash in cells like fauna.js; only what is near the bird is simulated, and forgotten
// when it leaves.
import { height, WATER, ih, env, latAt } from '../world.js';
import { oceanAt } from '../earth.js';
import { FAUNA } from './fauna.js';
import { whaleBack, fluke, turtle, flyingFish, gull } from './oceanshapes.js';

export const SEA = {
  whaleCell: 1400, whaleR: 1100, whaleUp: [45, 80], whaleDown: [35, 70], whaleV: 1.3,
  boilCell: 900, boilR: 700, boilSlot: 150,      // a boil lasts a slot (s), then maybe another
  turtleCell: 520, turtleR: 400,
  flyEvery: 9,                                   // seconds between flying-fish bursts, skimming the warm seas
};
// how likely a whale, a boil or a turtle is per cell, by the ocean's kind of crossing
const WHALES = { whales: .6, soaring: .22, ice: .2, westerlies: .16, trades: .16, islands: .12 };
const BOILS = { whales: .3, soaring: .35, westerlies: .35, trades: .3, islands: .3, ice: .1 };

export function sealifeSystem(G) {
  const b = G.b, R = G.R, H = G.hud;
  R.shape('whale', whaleBack()); R.shape('fluke', fluke()); R.shape('turtle', turtle()); R.shape('flyfish', flyingFish());
  R.shape('gullU', gull(true)); R.shape('gullD', gull(false));
  G.guide?.page('whale', 'Humpback whale', 'Breathes out in a tall bushy blow you can see from miles off, then arches its back and lifts its flukes to dive.');
  G.guide?.page('gull', 'Herring gull', 'Follows the boils of fish across the open sea, dropping in for anything driven to the surface.');
  G.guide?.page('flyfish', 'Flying fish', 'Bursts from the water to glide on stiff winglike fins, sometimes for a hundred metres, to escape the tuna below.');
  G.guide?.page('turtle', 'Green sea turtle', 'Crosses whole oceans to lay its eggs on the beach where it hatched, rising every few minutes to breathe.');
  const whales = new Map(), boils = new Map(), turtles = new Map(), flyers = [];
  G.sea = {
    boils: () => boils, whales: () => whales,   // the senses (sys/finds.js: the glass float shows boils on the compass)
    // the whale's song (sys/lore.js): the nearest whale comes up beside you and waits
    summon(x, z) {
      let w = null, bd = 4000;
      for (const o of whales.values()) { const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; w = o; } }
      if (!w) return false;
      const a = Math.random() * 6.283;
      Object.assign(w, { x: x + Math.cos(a) * 45, z: z + Math.sin(a) * 45, hx: x, hz: z, up: true, t: 70, dive: 0, y: -3, blowT: 1.5, yaw: a + Math.PI / 2 });
      return true;
    },
  };
  const once = (id, title, msg, ic, how) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.quietly(how, title, msg, ic); } };
  const sea = (x, z) => oceanAt(x, z);
  let refreshT = 0, flyT = 4;

  // ---- whales ----------------------------------------------------------------------------------
  function whaleOf(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 401) * .6) * SEA.whaleCell, z = (gz + .2 + ih(gx, gz, 402) * .6) * SEA.whaleCell;
    const o = sea(x, z); if (!o || ih(gx, gz, 403) > (WHALES[o.travel] || .12) || height(x, z) > -10 || Math.abs(latAt(x, z)) > 74) return null;
    return { id: gx * 100003 + gz, hx: x, hz: z };
  }
  function whaleInit(o) {
    const up = ih(o.id, 0, 404) < .6, w = { ...o, x: o.hx, z: o.hz, yaw: ih(o.id, 0, 405) * 6.283, up, t: 5 + ih(o.id, 0, 406) * 40, dive: 0, blowT: 2 + ih(o.id, 0, 407) * 6, y: up ? 0 : -6 };
    w.solids = [-4, 0, 4].map(k => ({ k, x: 0, z: 0, r: 1.7, y0: -3, top: .3, perch: { x: 0, y: .42, z: 0, top: true, ride: w } }));
    return w;
  }
  const riding = w => b.state === 'perch' && b.perch?.ride === w;
  function whaleStep(w, dt) {
    const yaw0 = w.yaw;
    w.t -= dt;
    // wander slowly, keeping to its own stretch of sea and to deep water
    w.yaw += Math.sin(G.clock * .05 + w.id) * .04 * dt;
    const away = Math.hypot(w.x - w.hx, w.z - w.hz);
    if (away > 350) { const to = Math.atan2(w.hz - w.z, w.hx - w.x), d = Math.atan2(Math.sin(to - w.yaw), Math.cos(to - w.yaw)); w.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * .15); }
    const v = (w.up ? SEA.whaleV : SEA.whaleV * 1.8) * dt, nx = w.x + Math.cos(w.yaw) * v, nz = w.z + Math.sin(w.yaw) * v;
    if (height(nx + Math.cos(w.yaw) * 20, nz + Math.sin(w.yaw) * 20) < -8) { w.x = nx; w.z = nz; } else w.yaw += dt * .6;
    if (w.up) {
      // a last long breath, then the back arches and it sounds: anyone on it has to go
      if (w.t < 6) w.dive = Math.min(1, w.dive + dt / 6);
      if (w.t < 4 && riding(w) && !(b.wantOff > 0)) { b.wantOff = .6; H.say('The whale arches to dive: off you go.', { kind: 'warn', secs: 3, icon: 'takeoff' }); }
      if ((w.blowT -= dt) <= 0 && w.dive < .5) { w.blowT = 7 + Math.random() * 6; blow(w); }
      if (w.t <= 0) { w.up = false; w.t = SEA.whaleDown[0] + Math.random() * (SEA.whaleDown[1] - SEA.whaleDown[0]); }
    } else {
      w.dive = 0;
      if (w.t <= 0) { w.up = true; w.t = SEA.whaleUp[0] + Math.random() * (SEA.whaleUp[1] - SEA.whaleUp[0]); w.blowT = .5; }
    }
    // up: the back just awash, rising and settling with the breaths; diving: arching down
    const want = w.up ? -.05 + Math.sin(G.clock * .4 + w.id) * .08 - w.dive * w.dive * 5 : -7;
    w.y += (want - w.y) * Math.min(1, dt * (w.up ? .8 : .5));
    const c = Math.cos(w.yaw), s = Math.sin(w.yaw);
    for (const o of w.solids) { o.x = w.x + c * o.k; o.z = w.z + s * o.k; o.top = w.y + .3; o.perch.x = w.x + c * o.k * .9; o.perch.z = w.z + s * o.k * .9; o.perch.y = w.y + .42 + (o.k === 0 ? .1 : 0); }
    // carried along on its back
    if (riding(w)) {
      const p = b.perch; b.p[0] = p.x; b.p[1] = p.y + .14; b.p[2] = p.z; b.yaw += w.yaw - yaw0;
      if (w.y < -.6 && !(b.wantOff > 0)) b.wantOff = .6;
    }
  }
  function blow(w) {
    const hx = w.x + Math.cos(w.yaw) * 5.5, hz = w.z + Math.sin(w.yaw) * 5.5, d = Math.hypot(hx - b.p[0], hz - b.p[2]);
    if (d > 900) return;
    for (let i = 0; i < 26; i++) G.part([hx, w.y + .6, hz], [(Math.random() - .5) * 1.4, 6 + Math.random() * 3, (Math.random() - .5) * 1.4], 1.6 + Math.random() * .6, [.9, .93, .95], .35);
    if (d < 400) G.audio.burst?.({ f: 900, f2: 300, q: .5, dur: 1.1, vol: .3 * (1 - d / 400) });
  }
  // stand on the whale's back: it is a pillar (world.js solidsNear via env.solids) whose perch moves
  env.solids.push((x, z, r, out) => { for (const w of whales.values()) if (w.up && w.y > -.5 && Math.abs(w.x - x) < r + 8 && Math.abs(w.z - z) < r + 8) out.push(...w.solids); });
  G.on('land', kind => { if (kind === 'perch' && b.perch?.ride && whales.has(b.perch.ride.id)) once('whaleRide', 'Whale back', 'You stand on a whale’s back, rising and falling with its breathing. Rest here a while: it will tell you when it dives.', 'pin'); });
  G.on('wrap', dx => { for (const m of [whales, boils, turtles]) for (const o of m.values()) { o.x += dx; o.hx += dx; } for (const f of flyers) f.x += dx; });

  // ---- fish boils: the sea seething, gulls dropping in -----------------------------------------
  function boilOf(gx, gz) {
    const slot = Math.floor(G.clock / SEA.boilSlot);
    if (G.light.daylight < .3) return null;
    const x = (gx + .2 + ih(gx, gz, 411) * .6) * SEA.boilCell, z = (gz + .2 + ih(gx, gz, 412) * .6) * SEA.boilCell;
    const o = sea(x, z); if (!o || height(x, z) > -5 || ih(gx * 31 + slot, gz, 413) > (BOILS[o.travel] || .3)) return null;
    return { id: (gx * 100003 + gz) * 7 + slot % 7, hx: x, hz: z, n: 6 + Math.floor(ih(gx, gz, 414) * 6) };
  }
  const boilInit = o => ({ ...o, x: o.hx, z: o.hz, r: 9 + ih(o.id, 0, 415) * 6, life: 0, eaten: 0,
    gulls: Array.from({ length: o.n }, (_, i) => ({ a: i * 2.4, r: 8 + (i % 4) * 4, h: 9 + (i % 3) * 5, dive: -1, v: .5 + (i % 5) * .08 })) });
  function boilStep(o, dt) {
    o.life += dt;
    o.x += Math.cos(o.id) * .6 * dt; o.z += Math.sin(o.id) * .6 * dt;   // the shoal drifts
    const near = Math.hypot(o.x - b.p[0], o.z - b.p[2]);
    if (near < 160 && Math.random() < dt * 14) {   // fish breaking the surface all through it
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * o.r, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
      for (let i = 0; i < 4; i++) G.part([x, WATER + .05, z], [(Math.random() - .5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - .5) * 2], .6, [.9, .94, .96], .07);
    }
    for (const g of o.gulls) {
      g.a += g.v * dt * (g.dive >= 0 ? 0 : 1);
      if (g.dive >= 0) { g.dive += dt / 1.6; if (g.dive >= 1) { g.dive = -1; if (near < 120) splash(o.x + Math.cos(g.a) * g.r * .5, o.z + Math.sin(g.a) * g.r * .5, .6); } }
      else if (Math.random() < dt * .12) g.dive = 0;
    }
    if (near < 300 && Math.random() < dt * .4) G.audio.tone?.({ f: 1250 + Math.random() * 200, f2: 900, dur: .22, vol: .03 * (1 - near / 300), type: 'triangle', lp: 2400 });
    // snatch a fish from it: skim through low, or plunge in (the osprey)
    if (b.state === 'fly' && !b.carry && near < o.r + 2 && (b.plunge > 0 || b.p[1] - WATER < FAUNA.catchH + (G.aim?.focus || 0) * 2.5)) {
      b.state = 'swim'; b.p = [b.p[0], WATER + .35, b.p[2]]; b.s = 0;
      G.systems.food?.hold?.(FAUNA.fish, .05, 'fish');
      G.audio.splash(true); splash(b.p[0], b.p[2], 1.4);
      G.emit('catch', { kind: 'fish', x: b.p[0], z: b.p[2] });
      once('firstBoil', 'Fish boil', 'A fish from the boil! The gulls show where the shoals come up: follow their wheeling.', 'prey');
      if (++o.eaten > 2) o.life = 1e9;
    }
  }
  function splash(x, z, k) { for (let i = 0; i < 10 * k; i++) G.part([x, WATER, z], [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], .9, [.88, .93, .95], .06); }

  // ---- turtles ---------------------------------------------------------------------------------
  function turtleOf(gx, gz) {
    const x = (gx + .2 + ih(gx, gz, 421) * .6) * SEA.turtleCell, z = (gz + .2 + ih(gx, gz, 422) * .6) * SEA.turtleCell;
    if (ih(gx, gz, 423) > .3 || Math.abs(latAt(x, z)) > 34 || !sea(x, z) || height(x, z) > -2) return null;
    return { id: gx * 100003 + gz, hx: x, hz: z };
  }
  const turtleInit = o => ({ ...o, x: o.hx, z: o.hz, yaw: ih(o.id, 0, 424) * 6.283, t: ih(o.id, 0, 425) * 30, up: 0 });
  function turtleStep(o, dt) {
    o.t += dt; const cyc = o.t % 50, want = cyc < 22 ? 1 : 0;   // up to breathe a while, then down
    o.up += (want - o.up) * Math.min(1, dt * .5);
    o.yaw += Math.sin(o.t * .1 + o.id) * .1 * dt;
    if (Math.hypot(o.x - o.hx, o.z - o.hz) > 80) o.yaw = Math.atan2(o.hz - o.z, o.hx - o.x);
    o.x += Math.cos(o.yaw) * .5 * dt; o.z += Math.sin(o.yaw) * .5 * dt;
  }

  // ---- flying fish: a burst ahead of a bird skimming the warm sea ------------------------------
  function flyFish(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.t += dt;
      f.x += Math.cos(f.yaw) * 13 * dt; f.z += Math.sin(f.yaw) * 13 * dt;
      f.y = WATER + Math.min(1, f.t * 3) * (1.2 + Math.sin(f.t * 1.3) * .25) * Math.min(1, (f.life - f.t) * 3);
      if (f.t > f.life) { flyers.splice(i, 1); splash(f.x, f.z, .3); continue; }
      // snatched from the air
      if (b.state === 'fly' && !b.carry && Math.hypot(f.x - b.p[0], f.y - b.p[1], f.z - b.p[2]) < 1.6 + (G.aim?.focus || 0)) {
        flyers.splice(i, 1);
        G.systems.food?.hold?.(FAUNA.fish * .7, .04, 'fish'); G.audio.splash(false);
        G.emit('catch', { kind: 'fish', x: f.x, z: f.z });
        once('flyfish', 'Flying fish', 'A flying fish, caught on the wing!', 'prey', 't');
      }
    }
    if (b.state !== 'fly' || G.light.daylight < .4 || b.p[1] - WATER > 14 || b.s < 6) return;
    if ((flyT -= dt) > 0) return;
    flyT = SEA.flyEvery * (.5 + Math.random());
    const ahead = 30 + Math.random() * 20, fx = b.p[0] + Math.sin(b.yaw) * ahead, fz = b.p[2] - Math.cos(b.yaw) * ahead;
    if (Math.abs(latAt(fx, fz)) > 30 || !sea(fx, fz) || height(fx, fz) > -3) return;
    const yaw = Math.atan2(-Math.cos(b.yaw), Math.sin(b.yaw)) + (Math.random() - .5) * 1.4, n = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) flyers.push({ x: fx + (Math.random() - .5) * 8, z: fz + (Math.random() - .5) * 8, y: WATER, yaw: yaw + (Math.random() - .5) * .3, t: -i * .15, life: 2.5 + Math.random() * 2.5 });
    splash(fx, fz, .5);
  }

  function cells(size, r, make, into, init) {
    const a = Math.floor((b.p[0] - r) / size), c = Math.floor((b.p[0] + r) / size), d = Math.floor((b.p[2] - r) / size), e = Math.floor((b.p[2] + r) / size), seen = new Set();
    for (let gz = d; gz <= e; gz++) for (let gx = a; gx <= c; gx++) {
      const o = make(gx, gz); if (!o) continue;
      seen.add(o.id); if (!into.has(o.id)) into.set(o.id, init(o));
    }
    for (const [id, o] of into) if (!seen.has(id) && !(o.solids && riding(o))) into.delete(id);
  }

  G.dev?.add({ id: 'sealife', title: 'Life at sea: whales, boils, flying fish, turtles', area: 'World', how: 'Out over deep water: whales surface and blow (land on the back, and you are carried until it dives), gulls wheel over fish boils (skim through for a fish), flying fish burst ahead in the tropics, turtles come up to breathe. Go puts you near the nearest whale.',
    go: () => {
      let w = [...whales.values()].find(o => o.up);
      if (!w) for (let k = 0; k < 400 && !w; k++) { const a = k * 2.4, r = 1500 + k * 120, o = whaleOf(Math.floor((b.p[0] + Math.cos(a) * r) / SEA.whaleCell), Math.floor((b.p[2] + Math.sin(a) * r) / SEA.whaleCell)); if (o) { w = whaleInit(o); w.up = true; w.t = 70; w.y = 0; whales.set(w.id, w); } }
      if (!w) return H.reply('No whales near', 2);
      w.up = true; w.t = Math.max(w.t, 60); w.y = 0; w.dive = 0;
      b.state = 'fly'; b.p = [w.x - Math.cos(w.yaw) * 40, 14, w.z - Math.sin(w.yaw) * 40]; b.yaw = Math.atan2(Math.cos(w.yaw), -Math.sin(w.yaw)); b.s = 9; b.gamma = 0; b.vy = 0;
    } });

  return {
    id: 'sealife',
    update(dt) {
      if ((refreshT -= dt) <= 0) {
        refreshT = .7;
        const atSea = height(b.p[0], b.p[2]) < 0 || whales.size || boils.size;
        if (atSea) { cells(SEA.whaleCell, SEA.whaleR, whaleOf, whales, whaleInit); cells(SEA.boilCell, SEA.boilR, boilOf, boils, boilInit); cells(SEA.turtleCell, SEA.turtleR, turtleOf, turtles, turtleInit); }
        else { whales.clear(); boils.clear(); turtles.clear(); }
      }
      for (const w of whales.values()) whaleStep(w, dt);
      for (const [id, o] of boils) { boilStep(o, dt); if (o.life > SEA.boilSlot * 1.5) boils.delete(id); }
      for (const o of turtles.values()) turtleStep(o, dt);
      flyFish(dt);
    },
    scene(S) {
      const cam = S.cam, vis = (x, z, r) => Math.abs(x - cam[0]) < r && Math.abs(z - cam[2]) < r;
      const W = S.props.whale ||= [], F = S.props.fluke ||= [];
      for (const w of whales.values()) {
        if (!vis(w.x, w.z, 1500) || w.y < -5) continue;
        W.push(w.x, w.y, w.z, 1, w.yaw, .5, 0, 0);
        if (w.y > -2) G.sight('whale', w.x, w.y + .5, w.z, 6);
        // the flukes come up as it goes down
        if (w.dive > .55) { const k = (w.dive - .55) / .45, tx = w.x - Math.cos(w.yaw) * 8, tz = w.z - Math.sin(w.yaw) * 8; F.push(tx, -2.2 + Math.sin(k * Math.PI) * 4.2, tz, 1, w.yaw, .5, 0, 0); }
      }
      const gu = S.props.gullU ||= [], gd = S.props.gullD ||= [];
      for (const o of boils.values()) {
        if (!vis(o.x, o.z, 900)) continue;
        for (const g of o.gulls) {
          const dv = g.dive >= 0 ? Math.sin(g.dive * Math.PI) : 0, r = g.r * (1 - dv * .5), x = o.x + Math.cos(g.a) * r, z = o.z + Math.sin(g.a) * r, y = WATER + g.h * (1 - dv * .95);
          (dv > 0 || Math.sin(G.t * 6 + g.a * 3) > .2 ? gu : gd).push(x, y, z, 1.3, g.a + Math.PI / 2 + (dv > 0 ? 0 : 0), .5, 0, 0);
          G.sight('gull', x, y, z, .7);
        }
      }
      const T = S.props.turtle ||= [];
      for (const o of turtles.values()) if (o.up > .2 && vis(o.x, o.z, 300)) { T.push(o.x, WATER - .45 + o.up * .4, o.z, 1, o.yaw, .5, 0, 0); if (o.up > .8) G.sight('turtle', o.x, WATER, o.z, .7); }
      const FF = S.props.flyfish ||= [];
      for (const f of flyers) if (f.t > 0) { FF.push(f.x, f.y, f.z, 1, f.yaw, .5, 0, 0); G.sight('flyfish', f.x, f.y, f.z, .4); }
    },
  };
}
