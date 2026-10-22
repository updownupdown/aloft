// The animals of the other lands (C1), squirrels in the woods (C2), and monarchs and
// dragonflies (C7). Prey you can take like a mouse: jackrabbits on the dry lands (they zigzag
// when you stoop), lizards on the rocks (they dart for a crack), marmots on the peaks (a whistle,
// and they're gone), crabs on the mangrove and sea shores, and squirrels, on the ground or
// off a branch (a squirrel taken from a branch rides in your feet: eat it on a perch).
// Bigger neighbours to watch: mountain goats on the steeps, bison on the savanna, egrets in the
// mangroves, seals hauled out on the fjords' rocks. Placed by hash in cells near the hawk;
// prey shows to the aim (G.prey) and is eaten through food.js (G.systems.food.take()).
import { height, groundAt, groundNormal, blend, treesNear, perchesOf, ih, WATER, fencesNear } from '../world.js';
import { bridgesNear } from '../settle.js';
import { jackrabbit, lizard, marmot, crab, goat, bison, egret, seal, squirrel, monarch, dragonfly, snake } from './critshapes.js';

export const CRIT = { cell: 90, near: 240, catchR: 1.6, catchDive: 1.6, catchH: 2.2 };
// what lives where: [kind, chance per cell, how many]
const LIVES = {
  desert: [['jackrabbit', .45, 1], ['lizard', .4, 1]], badlands: [['jackrabbit', .45, 1], ['lizard', .35, 1]], canyon: [['lizard', .45, 1]],
  savanna: [['jackrabbit', .35, 1], ['bison', .22, 6]], saltflat: [['jackrabbit', .15, 1]], moor: [['bison', .06, 4]],
  alpine: [['marmot', .45, 2], ['goat', .3, 3]], mountains: [['marmot', .35, 2], ['goat', .25, 2]], cliffs: [['goat', .3, 3]],
  swamp: [['crab', .6, 3], ['egret', .5, 2]], marsh: [['egret', .35, 2]], coast: [['crab', .3, 2], ['seal', .2, 3]], fjord: [['seal', .4, 4]],
  forest: [['squirrel', .5, 2]], birch: [['squirrel', .45, 2]], lakeland: [['squirrel', .3, 1]], redwood: [['squirrel', .5, 2]],
};
// prey: how much it fills (food, water), its name; and how fast it runs
const PREY = { jackrabbit: [.32, .06, 'a jackrabbit', 7.5], lizard: [.14, .04, 'a lizard', 4], marmot: [.3, .06, 'a marmot', 5], crab: [.12, .1, 'a crab', 2.2], squirrel: [.22, .05, 'a squirrel', 5.5], snake: [.2, .05, 'a grass snake', 0] };
const SPOT = {   // where in its cell an animal will stand: ground height and slope
  crab: (h, n) => h > -.15 && h < .9, seal: (h, n) => h > .1 && h < 1.6, egret: h => h < -.05 && h > -.5,
  goat: (h, n) => h > 4 && n < .8 && n > .45, lizard: (h, n) => h > 1, bison: (h, n) => h > 2 && n > .9,
};

export function crittersSystem(G) {
  const b = G.b, R = G.R;
  R.shape('jack', jackrabbit(false)); R.shape('jackR', jackrabbit(true)); R.shape('lizard', lizard());
  R.shape('marmot', marmot(true)); R.shape('marmotR', marmot(false)); R.shape('crab', crab()); R.shape('goat', goat());
  R.shape('bison', bison(true)); R.shape('bisonU', bison(false)); R.shape('egret', egret()); R.shape('seal', seal());
  R.shape('squirrel', squirrel(false)); R.shape('squirrelR', squirrel(true));
  R.shape('snake', snake(false)); R.shape('snakeS', snake(true));
  R.shape('monarchU', monarch(true)); R.shape('monarchD', monarch(false)); R.shape('dragonfly', dragonfly());
  const PAGES = {
    jackrabbit: ['Black-tailed jackrabbit', 'Not a rabbit but a hare: born furred and running, it zigzags at forty miles an hour.'],
    lizard: ['Side-blotched lizard', 'Basks on warm rock all morning and darts for a crack the moment a shadow crosses it.'],
    marmot: ['Hoary marmot', 'Its shrill whistle warns the whole slope; the old trappers called it the whistler.'],
    crab: ['Mangrove tree crab', 'Scuttles sideways over the roots and drops into the water when anything comes near.'],
    goat: ['Mountain goat', 'Climbs ledges no hunter can follow, on hooves with soft grippy pads.'],
    bison: ['American bison', 'The heaviest animal of the plains, and still quick enough to outrun a horse.'],
    egret: ['Great egret', 'Wades the shallows on black legs and spears fish with a yellow bill.'],
    seal: ['Harbour seal', 'Hauls out on the rocks at low tide to rest and warm up, and slips in at the first alarm.'],
    monarch: ['Monarch butterfly', 'Each autumn millions fly thousands of miles south to the same few mountain forests.'],
    snake: ['Grass snake', 'Basks on warm stone through the afternoon and pours itself into the nearest crack at a shadow. Red-tails take snakes as readily as mice.'],
    dragonfly: ['Common green darner', 'Hunts other insects on the wing, catching nearly every one it chases.'],
  };
  for (const [k, [n, t]] of Object.entries(PAGES)) G.guide?.page(k, n, t);
  const live = new Map(), gone = new Map();   // id -> animal; id -> G.clock taken
  let refreshT = 0;
  G.prey = [];
  const once = (id, msg, secs = 4) => { if (!G.flags[id]) { G.flags[id] = 1; G.hud.toast(msg, secs); } };

  function cellOf(gx, gz) {
    const cx = (gx + .5) * CRIT.cell, cz = (gz + .5) * CRIT.cell, lives = LIVES[blend(cx, cz)[0].name];
    if (!lives) return [];
    const out = [];
    lives.forEach(([kind, p, n], k) => {
      if (ih(gx, gz, 220 + k) > p) return;
      // find a spot that suits it (a few tries round the cell)
      for (let t = 0; t < 6; t++) {
        const x = (gx + .15 + ih(gx, gz, 230 + k * 7 + t) * .7) * CRIT.cell, z = (gz + .15 + ih(gx, gz, 240 + k * 7 + t) * .7) * CRIT.cell;
        const h = height(x, z), nrm = groundNormal(x, z)[1];
        if (SPOT[kind] ? !SPOT[kind](h, nrm) : h < 1 || nrm < .75) continue;
        for (let i = 0; i < n; i++) {
          const id = 'c' + gx + '_' + gz + '_' + k + '_' + i;
          if (gone.has(id) && G.clock - gone.get(id) < 300) continue;
          const a = ih(gx, gz, 250 + i) * 6.28, r = i ? 3 + ih(gx, gz, 260 + i) * 9 : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
          out.push({ id, kind, hx: x, hz: z, x: px, z: pz, y: kind === 'egret' ? WATER - .25 : groundAt(px, pz), yaw: ih(gx, gz, 270 + i) * 6.28, t: ih(gx, gz, 280 + i) * 3, go: 0, flee: 0, hidden: 0, zig: 0, up: 0 });
        }
        break;
      }
    });
    return out;
  }
  function refresh() {
    const a = Math.floor((b.p[0] - CRIT.near) / CRIT.cell), c = Math.floor((b.p[0] + CRIT.near) / CRIT.cell), d = Math.floor((b.p[2] - CRIT.near) / CRIT.cell), e = Math.floor((b.p[2] + CRIT.near) / CRIT.cell), seen = new Set();
    for (let gz = d; gz <= e; gz++) for (let gx = a; gx <= c; gx++) for (const o of cellOf(gx, gz)) { seen.add(o.id); if (!live.has(o.id)) live.set(o.id, o); }
    for (const o of snakes()) { seen.add(o.id); if (!live.has(o.id)) live.set(o.id, o); }
    for (const id of live.keys()) if (!seen.has(id)) live.delete(id);
    G.prey = [...live.values()].filter(o => PREY[o.kind]);
  }

  // grass snakes (round eight A2): on warm, dry afternoons out of winter they bask on the tops of
  // the stone walls and the bridges' parapets; at a shadow they pour into the cracks
  const warm = () => G.tod > .38 && G.tod < .68 && (G.overcast || 0) < .5 && (G.rain || 0) < .05 && !G.season?.winter && !(G.season?.i === 3 && (G.season.d || 0) < 3);
  G.dev?.add({ id: 'r8-snakes', title: 'Grass snakes on warm stone', area: 'Wildlife', round: 'R8 A2',
    how: 'Warm dry afternoons (not winter): look along stone walls and bridge parapets; stoop fast, they slip into the cracks.',
    go: () => {
      G.tod = .5;
      const f = fencesNear(b.p[0], b.p[2], 2500).filter(f => f.kind === 'wall').sort((a, q) => Math.hypot(a.posts[0][0] - b.p[0], a.posts[0][2] - b.p[2]) - Math.hypot(q.posts[0][0] - b.p[0], q.posts[0][2] - b.p[2]))[0];
      if (f) { const p = f.posts[0]; b.state = 'fly'; b.p = [p[0], p[1] + 25, p[2] + 35]; b.yaw = 0; b.s = 11; b.gamma = 0; }
    } });
  function snakes() {
    const out = []; if (!warm()) return out;
    for (const f of fencesNear(b.p[0], b.p[2], CRIT.near)) {
      if (f.kind !== 'wall') continue;
      for (let i = 0; i < f.posts.length - 1; i++) {
        const p = f.posts[i], q = f.posts[i + 1], id = 's' + f.id + '_' + i;
        if (ih(i, f.id.length * 31 + Math.round(p[0]), 290) > .07 || p[3] < .35 || Math.abs(p[0] - b.p[0]) > CRIT.near || Math.abs(p[2] - b.p[2]) > CRIT.near) continue;
        if (gone.has(id) && G.clock - gone.get(id) < 300) continue;
        const x = (p[0] + q[0]) / 2, z = (p[2] + q[2]) / 2;
        out.push({ id, kind: 'snake', hx: x, hz: z, x, z, y: (p[1] + p[3] + q[1] + q[3]) / 2 + .02, yaw: Math.atan2(q[2] - p[2], q[0] - p[0]), t: 0, go: 0, flee: 0, hidden: 0, zig: 0, up: 0 });
      }
    }
    for (const g of bridgesNear(b.p[0], b.p[2], CRIT.near)) {
      const id = 'sb' + Math.round(g.x0) + '_' + Math.round(g.z0);
      if (ih(Math.round(g.x0), Math.round(g.z0), 291) > .5 || (gone.has(id) && G.clock - gone.get(id) < 300)) continue;
      const yaw = Math.atan2(g.z1 - g.z0, g.x1 - g.x0), sd = ih(Math.round(g.x1), 1, 292) < .5 ? -1.7 : 1.7, k = .2 + ih(Math.round(g.z1), 2, 293) * .6;
      const x = g.x0 + (g.x1 - g.x0) * k - Math.sin(yaw) * sd, z = g.z0 + (g.z1 - g.z0) * k + Math.cos(yaw) * sd;
      out.push({ id, kind: 'snake', hx: x, hz: z, x, z, y: g.y + .77, yaw, t: 0, go: 0, flee: 0, hidden: 0, zig: 0, up: 0 });
    }
    return out;
  }

  // ---- behaviour ----
  const step = (o, sp, dt) => {
    const nx = o.x + Math.cos(o.yaw) * sp * dt, nz = o.z + Math.sin(o.yaw) * sp * dt, h = height(nx, nz);
    const ok = o.kind === 'crab' ? h < 1.2 : o.kind === 'goat' ? h > 3 : h > .6;
    if (ok) { o.x = nx; o.z = nz; } else o.yaw += 2.2;
    o.y = o.kind === 'egret' ? WATER - .25 : groundAt(o.x, o.z);
  };
  function squirrelStep(o, dt) {
    // on the ground it runs from trunk to trunk; at a trunk it climbs to a limb and sits a while
    if (o.climb) {
      o.y += (o.climb.y - o.y > 0 ? 1 : -1) * 2.2 * dt * (o.flee > 0 ? 1.6 : 1);
      if (Math.abs(o.climb.y - o.y) < .15) { o.y = o.climb.y; if ((o.st -= dt) <= 0) { if (o.climb.down) o.climb = null; else { o.climb = { y: groundAt(o.x, o.z), down: true }; o.st = 0; } } }
      return;
    }
    if (!o.to || (o.st -= dt) <= 0) {
      const ts = treesNear(o.x, o.z, 25).filter(t => t.kind === 0 || t.look === 2 || t.look === 3);
      const t = ts[Math.floor(Math.random() * ts.length)];
      o.to = t ? { x: t.x, z: t.z, t } : { x: o.hx + (Math.random() - .5) * 20, z: o.hz + (Math.random() - .5) * 20 }; o.st = 8;
    }
    const dx = o.to.x - o.x, dz = o.to.z - o.z, d = Math.hypot(dx, dz);
    o.yaw = Math.atan2(dz, dx);
    if (d < .6) {
      // up the trunk to one of its limbs
      const lim = o.to.t && perchesOf(o.to.t).filter(p => !p.top)[0];
      if (lim) { o.x = lim.x; o.z = lim.z; o.climb = { y: lim.y, down: false }; o.st = 4 + Math.random() * 6; }
      o.to = null; return;
    }
    o.go = Math.max(0, o.go - dt);
    if (o.go <= 0 && Math.random() < dt * .8) o.go = .6 + Math.random();
    if (o.go > 0 || o.flee > 0) step(o, PREY.squirrel[3] * (o.flee > 0 ? 1.3 : .7), dt);
  }
  function animalStep(o, dt) {
    o.t += dt; o.flee = Math.max(0, o.flee - dt); o.hidden = Math.max(0, o.hidden - dt);
    if (o.hidden > 0) return;
    const hd = Math.hypot(o.x - b.p[0], o.z - b.p[2]), above = b.p[1] - o.y;
    const sn = o.kind === 'snake', stooped = G.aim?.target === o && (G.aim.focus || 0) > .35 && (!sn || hd < 20), nearLow = b.state === 'fly' && hd < (sn ? 10 : 22) && above < 16;
    if ((stooped || nearLow) && o.flee <= 0) {
      o.flee = 3;
      if (o.kind === 'marmot') { G.audio.tone?.({ f: 2900, f2: 2500, dur: .3, vol: .05 }); o.hide = 1.2; }
      if (o.kind === 'lizard') o.hide = 1;
      if (o.kind === 'snake') { o.hide = .7; once('snake', 'A grass snake, basking on the warm stone: it pours into the cracks at your shadow. Come in fast and low.'); }
      if (o.kind === 'crab' || o.kind === 'seal') o.hide = 1.5;
      if (o.kind === 'egret') o.hide = .6;
      if (o.kind === 'squirrel' && !o.climb) { G.audio.tone?.({ f: 3400, f2: 2800, dur: .08, vol: .04 }); G.audio.tone?.({ f: 3400, f2: 2800, dur: .08, vol: .04, delay: .12 }); }
    }
    if (o.hide !== undefined && o.flee > 0) { if ((o.hide -= dt) <= 0) { o.hidden = o.kind === 'seal' ? 30 : o.kind === 'snake' ? 45 : 8; o.hide = undefined; if (o.kind === 'egret') G.part([o.x, .8, o.z], [0, 3, 0], .8, [.95, .95, .93], .3); return; } }
    const away = Math.atan2(o.z - b.p[2], o.x - b.p[0]);
    switch (o.kind) {
      case 'squirrel': squirrelStep(o, dt); break;
      case 'jackrabbit':
        if (o.flee > 0) { if ((o.zig -= dt) <= 0) { o.zig = .35 + Math.random() * .3; o.yaw = away + (Math.random() < .5 ? .9 : -.9); } step(o, PREY.jackrabbit[3], dt); }
        else if ((o.go -= dt) > 0) step(o, 2.5, dt); else if (Math.random() < dt * .5) { o.go = .4; o.yaw += (Math.random() - .5) * 2; }
        break;
      case 'snake': if (o.flee > 0) o.yaw += Math.sin(o.t * 14) * dt * 3; break;   // writhing into a crack
      case 'lizard': case 'marmot': case 'crab':
        if (o.flee > 0) { o.yaw = o.kind === 'crab' ? away + Math.PI / 2 : away; step(o, PREY[o.kind][3], dt); }
        else if ((o.go -= dt) > 0) step(o, PREY[o.kind][3] * .3, dt); else if (Math.random() < dt * .3) { o.go = .5; o.yaw += (Math.random() - .5) * 2.5; }
        break;
      case 'goat': if ((o.go -= dt) > 0) step(o, .6, dt); else if (Math.random() < dt * .1) { o.go = 1.5; o.yaw += (Math.random() - .5) * 2; } break;
      case 'bison':
        if (o.flee > 0 && hd < 14 && above < 8) { o.yaw = away; step(o, 6, dt); }
        else { if (Math.hypot(o.x - o.hx, o.z - o.hz) > 30) o.yaw = Math.atan2(o.hz - o.z, o.hx - o.x); step(o, .35, dt); }
        break;
    }
  }
  function tryCatch() {
    if (b.state !== 'fly' || b.carry) return;   // (feet full)
    const focus = G.aim?.focus || 0, r = CRIT.catchR + CRIT.catchDive * focus;
    for (const o of live.values()) {
      if (!PREY[o.kind] || o.hidden > 0) continue;
      const above = b.p[1] - o.y, hd = Math.hypot(b.p[0] - o.x, b.p[2] - o.z);
      if (above < CRIT.catchH + focus * 2.5 && above > -1 && hd < r) {
        live.delete(o.id); gone.set(o.id, G.clock); G.prey = G.prey.filter(p => p !== o);
        const [food, wet, name] = PREY[o.kind], high = o.y - groundAt(o.x, o.z) > 1;
        G.systems.food?.take?.({ x: o.x, y: o.y, z: o.z, kind: o.kind, food, wet, name, carry: high });
        if (o.kind === 'squirrel') once('squirrel', high ? 'Snatched off the branch! Carry it to a perch to eat.' : 'A squirrel, caught on the ground.');
        return;
      }
    }
  }

  // ---- monarchs and dragonflies (C7) ----
  function insects(S) {
    const cam = S.cam, s = G.season?.name, L = G.light;
    if (L.daylight < .5 || (G.rain || 0) > .2) return;
    // autumn: a river of monarchs drifting south, a few metres up, along a band that moves day to day
    if (s === 'autumn') {
      const U = S.props.monarchU ||= [], D = S.props.monarchD ||= [], lane = (ih(G.day, 0, 290) - .5) * 600;
      const bx = Math.round((cam[0] - lane) / 400) * 400 + lane;
      if (Math.abs(bx - cam[0]) < 160) for (let i = 0; i < 60; i++) {
        const h1 = ih(i, 1, 291), h2 = ih(i, 2, 292), z = cam[2] - 120 + ((h1 * 240 + G.t * 2.4) % 240), x = bx + (h2 - .5) * 40 + Math.sin(G.t * .7 + i) * 2;
        const y = Math.max(height(x, z), WATER) + 2 + ih(i, 3, 293) * 12 + Math.sin(G.t * 1.3 + i * 2) * .6;
        (Math.sin(G.t * 18 + i) > 0 ? U : D).push(x, y, z, 1.6, Math.PI / 2 + Math.sin(G.t + i) * .4, .5, 0, 0);
      }
    }
    // summer: dragonflies hawking over the ponds' edges, darting and hanging
    if (s === 'summer' || (s === 'spring' && (G.season.d || 0) > 4)) {
      const P = S.props.dragonfly ||= [];
      for (let i = 0; i < 24; i++) {
        const gx = Math.floor(cam[0] / 30) * 30 + (ih(i, 4, 294) - .5) * 120, gz = Math.floor(cam[2] / 30) * 30 + (ih(i, 5, 295) - .5) * 120, h = height(gx, gz);
        if (h > .4 || h < -1.5) continue;
        const ph = Math.floor(G.t * .7 + ih(i, 6, 296) * 5), dx = (ih(i, ph, 297) - .5) * 6, dz = (ih(i, ph, 298) - .5) * 6;
        P.push(gx + dx, .6 + ih(i, ph, 299) * 1.2, gz + dz, 1.5, ih(i, ph, 300) * 6.28, .5, 0, 0);
      }
    }
  }

  return {
    id: 'critters',
    update(dt) {
      if ((refreshT -= dt) <= 0) { refreshT = 1; refresh(); }
      for (const o of live.values()) animalStep(o, dt);
      tryCatch();
    },
    scene(S) {
      const cam = S.cam;
      for (const o of live.values()) {
        if (o.hidden > 0 || Math.abs(o.x - cam[0]) > 200 || Math.abs(o.z - cam[2]) > 200) continue;
        const run = o.flee > 0 || o.go > 0;
        const shape = { jackrabbit: run ? 'jackR' : 'jack', marmot: run ? 'marmotR' : 'marmot', bison: o.flee > 0 ? 'bisonU' : 'bison', squirrel: run || o.climb ? 'squirrelR' : 'squirrel', snake: o.flee > 0 ? 'snakeS' : 'snake' }[o.kind] || o.kind;
        const hop = o.kind === 'jackrabbit' && run ? Math.abs(Math.sin(G.t * 9 + o.t)) * .35 : 0;
        (S.props[shape] ||= []).push(o.x, o.y + hop, o.z, o.kind === 'snake' ? 1.7 : 1, o.yaw, .5, 0, 0);   // a snake a little large, to read from the air
        if (Math.abs(o.x - cam[0]) < 60 && Math.abs(o.z - cam[2]) < 60) G.sight?.(o.kind, o.x, o.y + .3, o.z, { bison: 1.5, goat: .8, seal: .7, egret: .6 }[o.kind] || .3);
      }
      insects(S);
    },
  };
}
