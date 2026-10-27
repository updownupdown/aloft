// Wildlife: flocks of small birds (finches by day, a starling murmuration at dusk over open
// land), herons fishing in the shallows, fish that
// rise and jump in lakes and the sea, wild hawks circling in the strongest thermals (a kettle).
// Everything is placed by hash in cells; only what is near the hawk is simulated, and its
// state is forgotten when the hawk leaves. Fish can be caught: skim low over one as it rises,
// the same forgiving reach as for mice (a tucked dive reaches further).
import { height, forest, WATER, ih, fbm, bands, thermalsNear, thermalCentre, env } from '../world.js';
import { smallBird, heronStanding, heronFlying, fish, soaringHawk, soaringHawkFar } from './faunashapes.js';
import { angleTo } from '../util.js';

export const FAUNA = {
  flockCell: 420, flockR: 380,          // flocks: one maybe per cell, simulated within flockR
  heronCell: 220, heronR: 240,
  fishCell: 40, fishR: 90,
  fish: .35, catchR: 1.6, catchDive: 1.6, catchH: 2.2,   // as food.js: fill, reach, extra reach diving, how low
  plungeR: 4.5,                         // an osprey plunging feet first (sys/moves.js sets b.plunge) reaches fish this far, at any depth
  kettleW: 4.6, kettleR: 520,           // thermals at least this strong carry a kettle of wild hawks
};

export function faunaSystem(G) {
  const b = G.b, H = G.hud;
  const R = G.R;
  R.shape('birdU', smallBird(true)); R.shape('birdD', smallBird(false));
  R.shape('heron', heronStanding()); R.shape('heronU', heronFlying(true)); R.shape('heronD', heronFlying(false));
  R.shape('fish', fish()); R.shape('soar', soaringHawk()); R.shape('soarFar', soaringHawkFar());
  const flocks = new Map(), herons = new Map(), fishes = new Map();
  let refreshT = 0, fishBoost = 0;
  G.wild = { fish: [], flocks, herons };
  const once = (id, title, msg, ic, how) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.quietly(how, title, msg, ic); } };
  const sight = (key, x, y, z, r) => G.sight?.(key, x, y, z, r);
  const low = () => b.state !== 'fly' || b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER) < 22;
  const near = (x, z, r) => Math.hypot(x - b.p[0], z - b.p[2]) < r;
  const tod = () => G.tod, storm = () => G.storm || 0;

  // ---- what lives where (pure functions of the cell) ----------------------------------------
  function flockOf(gx, gz) {
    if (ih(gx, gz, 101) > .45) return null;
    const x = (gx + .5) * FAUNA.flockCell, z = (gz + .5) * FAUNA.flockCell, k = bands(x, z);
    // (over land only: finches and starlings do not flock far out over the sea; a flock there scared
    // up again and again as you flew over open water, James 10-27)
    if (height(x, z) < 1) return null;
    const open = forest(x, z) < .15;
    const dusk = tod() > .66 && tod() < .8;
    const kind = dusk && open && ih(gx, gz, 102) < .6 + k.marsh * .4 ? 'starling' : tod() > .24 && tod() < .76 ? 'finch' : null;
    if (!kind || storm() > .6) return null;
    return { id: gx * 7717 + gz, kind, n: kind === 'starling' ? 46 : 9 + Math.floor(ih(gx, gz, 103) * 8), hx: x, hz: z };
  }
  // a heron wants shallow water by a shore
  function shallowNear(x, z, seed) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4 + seed, r = 6 + i * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = height(px, pz);
      if (h < -.05 && h > -.6) return [px, pz];
    }
    return null;
  }
  function heronOf(gx, gz) {
    if (ih(gx, gz, 121) > .5 || storm() > .7) return null;
    const p = shallowNear((gx + .5) * FAUNA.heronCell, (gz + .5) * FAUNA.heronCell, ih(gx, gz, 122) * 6);
    return p && { id: gx * 5003 + gz, x: p[0], z: p[1] };
  }
  function fishOf(gx, gz) {
    if (ih(gx, gz, 131) > .35) return null;
    const x = (gx + .2 + ih(gx, gz, 132) * .6) * FAUNA.fishCell, z = (gz + .2 + ih(gx, gz, 133) * .6) * FAUNA.fishCell;
    if (height(x, z) > -1.6) return null;
    return { id: gx * 4001 + gz, hx: x, hz: z };
  }
  function cells(size, r, make, into, init) {
    const a = Math.floor((b.p[0] - r) / size), c = Math.floor((b.p[0] + r) / size), d = Math.floor((b.p[2] - r) / size), e = Math.floor((b.p[2] + r) / size), seen = new Set();
    for (let gz = d; gz <= e; gz++) for (let gx = a; gx <= c; gx++) {
      const o = make(gx, gz); if (!o) continue;
      seen.add(o.id);
      if (!into.has(o.id)) into.set(o.id, init(o));
    }
    for (const id of into.keys()) if (!seen.has(id)) into.delete(id);
  }
  function refresh() {
    cells(FAUNA.flockCell, FAUNA.flockR, flockOf, flocks, o => ({ ...o, cx: o.hx, cz: o.hz, cy: height(o.hx, o.hz) + 14, vx: 0, vz: 0, scare: -99, t: Math.random() * 100,
      birds: Array.from({ length: o.n }, (_, i) => ({ p: [o.hx, height(o.hx, o.hz) + 14, o.hz], v: [0, 0, 0], ph: ih(o.id, i, 104) * 6.28, o: [ih(o.id, i, 105) - .5, ih(o.id, i, 106) - .5, ih(o.id, i, 107) - .5] })) }));
    cells(FAUNA.heronCell, FAUNA.heronR, heronOf, herons, o => ({ ...o, y: WATER - .3, yaw: ih(o.id, 1, 123) * 6.28, state: 'stand', t: 0, to: null }));
  }

  // ---- behaviour ----------------------------------------------------------------------------
  function flockStep(F, dt) {
    F.t += dt;
    const hd = Math.hypot(F.cx - b.p[0], F.cz - b.p[2]), close = b.state === 'fly' && hd < 30 && Math.abs(F.cy - b.p[1]) < 25;
    // a flock you come at whirrs up, the first time (a flurry of wings, not leaves); chased on, it
    // flees in silence until it has settled a while
    if (close && F.scare <= 0) { if (F.scare < -12) G.audio.flurry?.(.4 * Math.max(0, 1 - Math.hypot(hd, F.cy - b.p[1]) / 40)); F.scare = 4; }
    F.scare -= dt;
    // the flock's centre wanders round its home; a hawk sends it away
    const wx = F.hx + fbm(F.t * .02, F.id, 108, 2) * 160, wz = F.hz + fbm(F.id, F.t * .02, 109, 2) * 160;
    let ax = (wx - F.cx) * .02, az = (wz - F.cz) * .02;
    if (F.scare > 0) { ax += (F.cx - b.p[0]) / (hd || 1) * 6; az += (F.cz - b.p[2]) / (hd || 1) * 6; }
    F.vx = (F.vx + ax * dt) * (1 - dt * .5); F.vz = (F.vz + az * dt) * (1 - dt * .5);
    const sp = Math.hypot(F.vx, F.vz), max = F.scare > 0 ? 14 : 7; if (sp > max) { F.vx *= max / sp; F.vz *= max / sp; }
    F.cx += F.vx * dt; F.cz += F.vz * dt;
    const g = Math.max(height(F.cx, F.cz), WATER);
    F.cy += ((g + (F.kind === 'starling' ? 28 : 12) + Math.sin(F.t * .3) * 5) - F.cy) * dt * .5;
    // each bird chases its own spot in a shape that breathes and folds (a murmuration's swirl)
    const big = F.kind === 'starling' ? 16 + Math.sin(F.t * .4) * 7 : 5, sq = F.scare > 0 ? 1.8 : 1;
    for (let i = 0; i < F.birds.length; i++) {
      const q = F.birds[i], a = F.t * (F.kind === 'starling' ? .5 : .9) + q.ph;
      const tx = F.cx + (q.o[0] * Math.cos(a) - q.o[2] * Math.sin(a * .7)) * big * 2 * sq;
      const ty = F.cy + q.o[1] * big * (F.kind === 'starling' ? 1.2 + Math.sin(F.t * .7 + q.o[0] * 4) : 1) * sq;
      const tz = F.cz + (q.o[2] * Math.cos(a) + q.o[0] * Math.sin(a * .7)) * big * 2 * sq;
      for (const [k, t] of [[0, tx], [1, ty], [2, tz]]) q.v[k] = (q.v[k] + (t - q.p[k]) * dt * 3) * (1 - dt * 1.6);
      for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      q.p[1] = Math.max(q.p[1], Math.max(height(q.p[0], q.p[2]), WATER) + 1.5);
    }
  }
  function heronStep(h, dt) {
    h.t += dt;
    if (h.state === 'stand') {
      if (b.state === 'fly' && near(h.x, h.z, 28) && low()) {
        h.state = 'fly'; h.t = 0; G.audio.heron?.();
        const a = Math.atan2(h.z - b.p[2], h.x - b.p[0]) + (Math.random() - .5);
        h.to = shallowNear(h.x + Math.cos(a) * 160, h.z + Math.sin(a) * 160, Math.random() * 6) || [h.x + Math.cos(a) * 160, h.z + Math.sin(a) * 160];
        once('heron', 'Heron', 'A heron lifts from the shallows with a croak, slow and grey.', 'guide');
      } else if (Math.random() < dt * .1) h.yaw += (Math.random() - .5) * .8;
      h.y = WATER - .3;
    } else {
      const dx = h.to[0] - h.x, dz = h.to[1] - h.z, d = Math.hypot(dx, dz);
      h.yaw += angleTo(h.yaw, Math.atan2(dz, dx)) * Math.min(1, dt * 1.5);
      const sp = 7 * Math.min(1, h.t / 1.5);
      h.x += Math.cos(h.yaw) * sp * dt; h.z += Math.sin(h.yaw) * sp * dt;
      const g = Math.max(height(h.x, h.z), WATER), cruise = g + Math.min(12, d * .25) + 1;
      h.y += (cruise - h.y) * Math.min(1, dt * 1.2);
      if (d < 3) { h.state = 'stand'; h.x = h.to[0]; h.z = h.to[1]; }
    }
  }
  function fishStep(f, dt) {
    const rate = fishBoost > 0 ? 3 : 1;
    // a hawk hanging slow over the water too long: the fish sink deep a while (3D thread, C4)
    const hov = b.state === 'fly' && b.s < 8 && b.p[1] - WATER < 30 && Math.hypot(b.p[0] - f.x, b.p[2] - f.z) < 14;
    f.watch = hov ? (f.watch || 0) + dt : Math.max(0, (f.watch || 0) - dt);
    if (f.watch > 2.5 && f.jump < 0) { f.up = 0; f.wait = Math.max(f.wait, 6); f.watch = 2.5; }
    if (f.jump >= 0) {
      f.jump += dt / 1.1; if (f.jump >= 1) { f.jump = -1; f.wait = (5 + Math.random() * 14) / rate; ripple(f.x + Math.cos(f.yaw) * 1.6, f.z + Math.sin(f.yaw) * 1.6, 1); }
    } else if ((f.wait -= dt) <= 0) {
      f.up += dt / 1.5;
      // (a fish jumps in silence: a splash for every one across the water was a sound again and again, James 10-27)
      if (f.up > 1.6) { f.up = 0; if (Math.random() < .55) { f.jump = 0; ripple(f.x, f.z, 1); } else f.wait = (3 + Math.random() * 10) / rate; }
    } else {
      f.up = Math.max(0, f.up - dt);
      if (Math.random() < dt * .3) { f.yaw += (Math.random() - .5) * 2; }
      const nx = f.x + Math.cos(f.yaw) * dt * .8, nz = f.z + Math.sin(f.yaw) * dt * .8;
      if (height(nx, nz) < -1.2 && Math.hypot(nx - f.hx, nz - f.hz) < 15) { f.x = nx; f.z = nz; } else f.yaw += 2;
    }
    if (f.up > .3 && Math.random() < dt * 3) ripple(f.x, f.z, .4);
  }
  function ripple(x, z, k) {
    for (let i = 0; i < 10 * k; i++) { const a = i / (10 * k) * 6.283; G.part([x + Math.cos(a) * .3, WATER + .05, z + Math.sin(a) * .3], [Math.cos(a) * 1.2, .4 * k, Math.sin(a) * 1.2], .6, [.9, .94, .96], .05); }
  }
  // the fish's height: under the surface, rising to it, or arcing through the air
  const fishY = f => f.jump >= 0 ? WATER + Math.sin(f.jump * Math.PI) * 1.3 - .1 : WATER - .45 + Math.min(1, f.up) * .32;
  function tryCatch() {
    if (b.state !== 'fly' || b.carry) return;   // (feet full)
    const focus = G.aim?.focus || 0, deep = b.plunge > 0;
    for (const f of fishes.values()) {
      if (!deep && f.up < .5 && f.jump < 0) continue;
      const fy = fishY(f), above = b.p[1] - fy, hd = Math.hypot(b.p[0] - f.x, b.p[2] - f.z);
      if (deep ? hd < FAUNA.plungeR : above < FAUNA.catchH + focus * 2.5 && above > -1 && hd < FAUNA.catchR + FAUNA.catchDive * focus) {
        fishes.delete(f.id); caught.set(f.id, G.clock);
        b.state = 'swim'; b.p = [f.x, WATER + .35, f.z]; b.s = 0;
        G.systems.food?.hold?.(FAUNA.fish, .05, 'fish');   // in the feet: Eat, or carry it off (food.js)
        G.audio.splash(true);
        for (let i = 0; i < 14; i++) G.part([f.x, WATER, f.z], [(Math.random() - .5) * 4, 2 + Math.random() * 3, (Math.random() - .5) * 4], 1, [.85, .92, .95], .07);
        G.emit('catch', { kind: 'fish', x: f.x, z: f.z });
        once('firstFish', 'A fish', 'A fish! Snatched from the surface. Tap Eat, or carry it to a branch.', 'prey');
        return;
      }
    }
  }
  // caught fish stay gone a while
  const caught = new Map();
  const fishOfLive = (gx, gz) => { const o = fishOf(gx, gz); if (!o) return null; const t = caught.get(o.id); return t !== undefined && G.clock - t < 200 ? null : o; };

  // kettles: wild hawks circling in the strongest thermals, by day
  // (and with your wings low, one gathers over the best thermal near you: R5, wake() below)
  let kettleT = null, kettleWait = 0;
  function wake(dt) {
    const tired = b.state === 'fly' && b.stamina / Math.max(.05, b.maxStamina ?? 1) < .35;
    if (kettleT && (b.stamina / Math.max(.05, b.maxStamina ?? 1) > .7 || b.state !== 'fly' || Math.hypot(kettleT.x - b.p[0], kettleT.z - b.p[2]) > 900)) kettleT = null;
    if (kettleT || !tired || G.light.daylight < .5 || storm() > .4 || (kettleWait -= dt) > 0) return;
    kettleWait = .5;
    kettleT = thermalsNear(b.p[0], b.p[2], 500).filter(t => !t.volcano && Math.hypot(t.x - b.p[0], t.z - b.p[2]) < 500).sort((p, q) => q.w - p.w)[0] || null;
    if (kettleT) once('lowkettle', 'Birds over the lift', 'Wings tiring? Look for birds circling: they gather where the air rises, and climb with you.', 'thermal');
  }
  const strong = t => t.w * env.thermal >= FAUNA.kettleW || t.id === kettleT?.id;
  function kettles() {
    const out = []; if (G.light.daylight < .5 || storm() > .4) return out;
    for (const t of thermalsNear(b.p[0], b.p[2], FAUNA.kettleR)) {
      if (!strong(t)) continue;
      const g = height(t.x, t.z), n = 3 + (t.id % 4);
      out.push({ t, g, n });
    }
    return out;
  }
  // flying with a kettle helps: the wild hawks show the core, and the column runs a little stronger
  env.lifts.push((x, y, z) => {
    if (G.light.daylight < .5 || storm() > .4) return 0;
    for (const t of thermalsNear(x, z, 60)) {
      if (!strong(t)) continue;
      const [cx, cz] = thermalCentre(t, y);
      if (Math.hypot(x - cx, z - cz) < t.r * .8 && y < t.top) return .8;
    }
    return 0;
  });

  G.on('gift', ev => {
    if (ev.key === 'fish') { fishBoost = 120 * (ev.k || 1); ev.handled = true; H.glint('Fish rising', 'Fish are rising in the lakes.', 'prey'); }
  });

  return {
    id: 'fauna',
    update(dt) {
      wake(dt);
      fishBoost = Math.max(0, fishBoost - dt);
      if ((refreshT -= dt) <= 0) {
        refreshT = .7; refresh();
        // fish cells use the caught list
        cells(FAUNA.fishCell, FAUNA.fishR, fishOfLive, fishes, o => ({ ...o, x: o.hx, z: o.hz, yaw: ih(o.id, 1, 134) * 6.28, up: 0, wait: 2 + Math.random() * 12, jump: -1 }));
      }
      for (const F of flocks.values()) flockStep(F, dt);
      for (const h of herons.values()) heronStep(h, dt);
      for (const f of fishes.values()) fishStep(f, dt);
      tryCatch();
      G.wild.fish = [...fishes.values()].map(f => ({ id: f.id, x: f.x, y: fishY(f), z: f.z, up: f.jump >= 0 ? 1 : Math.min(1, f.up) }));
    },
    scene(S) {
      const cam = S.cam, vis = (x, z, r) => Math.hypot(x - cam[0], z - cam[2]) < r;
      const U = S.props.birdU ||= [], D = S.props.birdD ||= [];
      for (const F of flocks.values()) {
        if (!vis(F.cx, F.cz, 300)) continue;
        for (const q of F.birds) {
          const yaw = Math.atan2(q.v[2], q.v[0]), up = Math.sin(G.t * 16 + q.ph) > 0 && (Math.hypot(q.v[0], q.v[2]) > 2 || F.scare > 0 || q.ph > 3);
          (up ? U : D).push(q.p[0], q.p[1], q.p[2], 1.1, yaw, .5, 0, 0);
        }
        sight(F.kind, F.cx, F.cy, F.cz, F.kind === 'starling' ? 30 : 6);
      }
      const hs = S.props.heron ||= [], hu = S.props.heronU ||= [], hdn = S.props.heronD ||= [];
      for (const h of herons.values()) {
        if (!vis(h.x, h.z, 260)) continue;
        if (h.state === 'stand') hs.push(h.x, h.y, h.z, 1, h.yaw, .5, 0, 0);
        else (Math.sin(G.t * 5) > 0 ? hu : hdn).push(h.x, h.y, h.z, 1, h.yaw, .5, 0, 0);
        sight('heron', h.x, h.y + 1, h.z, 1.5);
      }
      const fs = S.props.fish ||= [];
      for (const f of fishes.values()) {
        if (f.jump < 0 && f.up < .2) continue;
        if (!vis(f.x, f.z, 90)) continue;
        const y = fishY(f), yaw = f.yaw;
        if (f.jump >= 0) { const d = (f.jump - .5) * 1.6; fs.push(f.x + Math.cos(yaw) * d, y, f.z + Math.sin(yaw) * d, .8, yaw, .5, 0, 0); sight('fish', f.x, y, f.z, .6); }
        else fs.push(f.x, y, f.z, .75, yaw, .3, 0, 0);
      }
      const so = S.props.soar ||= [];
      for (const K of kettles()) {
        const { t, g, n } = K;
        for (let i = 0; i < n; i++) {
          const y = Math.min(t.top - 20, g + 40 + i * 28 + Math.sin(G.t * .1 + i) * 10), [cx, cz] = thermalCentre(t, y), r = t.r * (.5 + .1 * (i % 3));
          const a = G.t * (11 / r) * (i & 1 ? 1 : -1) + i * 2.1;
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          so.push(x, y, z, 1, a + (i & 1 ? Math.PI / 2 : -Math.PI / 2), .4 + (i % 3) * .2, 0, 0);
          if (i === 0) sight('kettlehawk', x, y, z, 1.2);
        }
        if (Math.hypot(t.x - b.p[0], t.z - b.p[2]) < 200) once('kettle', 'A kettle of hawks', 'A kettle of wild hawks circles in that thermal. Join them: they show you the core.', 'thermal');
      }
    },
    // debug: __aloft3d.G.systems.fauna.go('heron' | 'fish' | 'flock' | 'kettle')
    go(kind) {
      const make = { heron: [heronOf, FAUNA.heronCell], fish: [fishOf, FAUNA.fishCell], flock: [flockOf, FAUNA.flockCell] }[kind];
      if (kind === 'flock') G.tod = .7;
      let at = null;
      if (kind === 'kettle') { const t = thermalsNear(b.p[0], b.p[2], 3000).filter(t => t.w * env.thermal >= FAUNA.kettleW).sort((p, q) => Math.hypot(p.x - b.p[0], p.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (t) at = [t.x, t.z, 90]; }
      else for (let r = 0; r < 40 && !at; r++) for (let gz = -r; gz <= r && !at; gz++) for (let gx = -r; gx <= r && !at; gx++) {
        if (Math.max(Math.abs(gx), Math.abs(gz)) !== r) continue;
        const o = make[0](Math.floor(b.p[0] / make[1]) + gx, Math.floor(b.p[2] / make[1]) + gz);
        if (o) at = [o.x ?? o.hx, o.z ?? o.hz, kind === 'fish' ? 6 : 14];
      }
      if (!at) return null;
      b.state = 'fly'; b.p = [at[0], Math.max(height(at[0], at[1]), WATER) + at[2], at[1] + 45]; b.yaw = 0; b.s = 12;
      refreshT = 0; return at;
    },
    save: () => ({ caught: [...caught].slice(-100) }),
    load(o) { for (const [k, v] of o.caught || []) caught.set(k, v); },
  };
}
