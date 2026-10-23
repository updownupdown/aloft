// Hunger and thirst, mice in the meadows, worms after rain, and drinking (tap the water: at its edge,
// afloat, or a puddle after rain).
// Running low on either lowers how full the wings can get (G.maxStamina, marked on the wings bar).
// Mice live in 48 m cells of open grass; only those near the hawk are simulated. A caught
// mouse's cell refills after a while. Now and then a mouse squeaks (little white marks over it, a
// cue seen from high up; often while you hunt with wings tucked, bigger for the owl). A mouse
// that sees you coming bolts and digs down out of reach, leaving a scrape of earth.
// Catching is forgiving: come down low over one and the feet reach for it; dive with wings
// tucked (the aim tightens, see aim.js) and the reach is longer.
// A catch (a mouse, a worm, a fish, other prey) is held in the feet (b.carry) and eaten only when you
// tap Eat (the action button): the hawk bends and tears at it until it is gone. Or carry it off:
// to a branch (a calmer meal, worth more; Leave it there to cache it), or home, where it drops into
// the nest by itself (for the chick, or kept there for later).
import { height, normalAt, forest, WATER, ih, fbm, coastDist } from '../world.js';
import { mouseRich } from '../settle.js';
import { builder, blob, reseed } from '../shapes.js';
import { clamp, smooth } from '../util.js';
import { BIRD } from '../hawk.js';

export const FOOD = {
  hungerTime: 1200, thirstTime: 1680,        // seconds from full to empty (four times the 2D times)
  mouse: .45, mouseWet: .1, drink: .3,       // how much a mouse fills (and quenches), how fast water refills
  worm: .08, wet: 300, worms: 3,             // a worm's fill, seconds the ground stays wet after rain, worms at once
  lowAt: .35, lowMax: .3,                    // below lowAt, hunger and thirst each take up to lowMax off max stamina
  cell: 48, near: 170, respawn: 150,         // mouse cells, simulated radius, seconds to refill
  catchR: 1.5, catchDive: 1.6, catchH: 2.6,  // reach, extra reach diving, how low to be
  freeze: 2.5, bolt: 3, burrow: 25, dig: .8,  // a passing shadow freezes a mouse; a stoop sends it bolting home to dig down (gone a while)
  squeak: .05, squeakHunt: .2,                // chance a mouse squeaks each quarter second; hunting (wings tucked) as often as before
  meal: 2.4, wormMeal: 1.1, perchMeal: 1.15, cacheDays: 2,   // seconds to eat (a worm); a calm meal on a perch is worth more; a cache keeps two days
};

// a worm: one rough tapered tube, gently curved, with the pale saddle band near its head
function wormShape() {
  const B = builder(), pink = [.78, .5, .5], dark = [.64, .4, .42], band = [.86, .62, .6];
  const N = 9, SIDES = 6, len = .17, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = (t - .5) * len, z = Math.sin(t * Math.PI * 1.4 - .4) * .018;
    const r = .0035 + .0085 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** .6 * (1 - Math.sin(i * 2.7) * .12);   // tapered, a little lumpy
    pts.push({ x, z, r: i === 0 || i === N ? .0015 : r });
  }
  const ring = (q, i) => Array.from({ length: SIDES }, (_, k) => {
    const g = k / SIDES * Math.PI * 2 + i * .3, prev = pts[Math.max(0, i - 1)], next = pts[Math.min(N, i + 1)];
    const dx = next.x - prev.x, dz = next.z - prev.z, l = Math.hypot(dx, dz) || 1;   // the side direction, across the body
    return [q.x - dz / l * Math.cos(g) * q.r, q.r * .85 + Math.sin(g) * q.r * .85, q.z + dx / l * Math.cos(g) * q.r];
  });
  const rings = pts.map(ring);
  for (let i = 0; i < N; i++) for (let k = 0; k < SIDES; k++) {
    const k2 = (k + 1) % SIDES, col = i === 6 ? band : (i + k) % 2 ? pink : dark;
    B.tri(rings[i][k], rings[i + 1][k], rings[i + 1][k2], col); B.tri(rings[i][k], rings[i + 1][k2], rings[i][k2], col);
  }
  return B.out();
}

function mouseShape() {
  reseed(5); const B = builder(), fur = [.55, .46, .38], belly = [.72, .64, .55];
  blob(B, 0, .05, 0, .07, fur, belly, [1.5, .8, 1]);                 // body, along +x
  blob(B, .1, .06, 0, .04, fur, fur, [1.2, .9, 1]);                  // head
  blob(B, .085, .1, .025, .018, [.75, .55, .5], fur); blob(B, .085, .1, -.025, .018, [.75, .55, .5], fur);   // ears
  for (let i = 0; i < 5; i++) B.tri([-.09 - i * .025, .04 - i * .004, -.004], [-.09 - i * .025, .04 - i * .004, .004], [-.115 - i * .025, .036 - i * .004, 0], [.62, .5, .46]);   // tail
  return B.out();
}

// a squeak: three short strokes fanning up from a point, like a cartoon cry (drawn facing the camera)
function squeakShape() {
  const B = builder(), w = [1, .97, .9];
  for (const a of [-.85, 0, .85]) {
    const s = Math.sin(a), c = Math.cos(a), r0 = .07, r1 = a ? .17 : .2, t = .04;
    const p = r => [s * r, c * r, 0], q = (r, k) => [s * r + c * k, c * r - s * k, 0];
    const A = q(r0, -t * .5), Bq = q(r0, t * .5), C = q(r1, t), D = q(r1, -t), E = p(r1 + .02);
    B.tri(A, Bq, C, w); B.tri(A, C, D, w); B.tri(D, C, E, w);
  }
  return B.out();
}
// the scrape of earth a mouse leaves where it dug down
function burrowShape() {
  reseed(11); const B = builder(), earth = [.42, .33, .24], dark = [.2, .15, .11];
  blob(B, 0, -.02, 0, .12, earth, earth, [1.3, .35, 1.1]);
  blob(B, .02, .015, 0, .045, dark, dark, [1, .3, 1]);
  return B.out();
}

export function foodSystem(G) {
  const b = G.b, mice = new Map(), caught = new Map();   // id -> mouse; id -> G.clock caught
  G.R.shape('mouse', mouseShape()); G.R.shape('worm', wormShape());
  G.R.shape('squeak', squeakShape()); G.R.shape('burrow', burrowShape());
  const squeaks = [];   // { m, t }: marks over squeaking mice, each a moment long
  const worms = []; let wormT = 0; G.wet = 0;
  const caches = G.caches = [];   // { x, y, z, kind, food, wet, day }: catches left on branches
  G.hud.tip('carry', () => !!b.carry && b.state !== 'fly' && !(b.eating > 0), 'Tap Eat to eat your catch here, or take off with it in your feet: on a branch it is a calmer meal, and at your nest it drops in for later.');
  G.hud.tip('worms', () => b.state === 'ground' && worms.length > 0, 'After rain, worms come up. Tap to hop to the nearest one and pick it up, then Eat.');
  G.hunger = 1; G.thirst = 1;
  const setHunger = G.hud.meter('hunger', { label: 'food', colour: 'linear-gradient(90deg,#a8483a,#c96a4e)' });
  const setThirst = G.hud.meter('thirst', { label: 'water', colour: 'linear-gradient(90deg,#3f6f9a,#6c9ac0)' });
  G.hud.tip('hunt', () => G.hunger < .7 && b.state === 'fly' && G.aim?.target, 'A mouse in the grass! Tuck your wings (thumbs together) and dive at it. Come in low and your feet reach.');
  G.hud.tip('drink', () => G.thirst < .6 && b.state !== 'fly', 'Thirsty? Tap the water near you to drink: at its edge, afloat, or a puddle after rain.');
  let drinking = false, sipT = 0, rustleT = 0;
  // water to drink: afloat, at the water's edge, or by a puddle (seasons.js G.puddles: 8 floats each)
  // (and the rain pools in island rock, sys/isles.js G.pools)
  const puddleAt = (x, z, pad) => { for (const P of [G.puddles || [], G.pools || []]) for (let i = 0; i < P.length; i += 8) if (Math.hypot(P[i] - x, P[i + 2] - z) < P[i + 3] + pad) return [P[i], P[i + 1], P[i + 2]]; return null; };
  // the sea is salt: only rivers, lakes, puddles and rain pools quench a thirst
  const salt = () => coastDist(b.p[0], b.p[2]) < 30 && !puddleAt(b.p[0], b.p[2], 1.2);
  const shore = () => [[2, 0], [-2, 0], [0, 2], [0, -2], [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4]].some(([x, z]) => height(b.p[0] + x, b.p[2] + z) < WATER);
  const waterBy = () => b.state === 'swim' || (b.state === 'ground' && (shore() || !!puddleAt(b.p[0], b.p[2], 1.2)));
  // aim.js calls drink() for a tap on the water; a tap on water out of reach hops over first (b.wantDrink)
  G.water = {
    puddleAt,
    drink() {
      if (!waterBy() || b.settle > 0) return false;
      if (G.thirst >= .99) { G.hud.tally('Not thirsty', 'thirst'); return true; }
      if (salt()) { G.hud.say('The sea is salt. Drink from a river or a lake, or the rain pools on the islands.', { kind: 'warn', secs: 3.5, icon: 'thirst' }); return true; }
      drinking = true; sipT = 0; return true;
    },
  };

  // which mice live in a cell (fixed by hash, cached), where their burrow is. Mice gather where
  // people kept grain: thick round the old barns and farmyards, the folds and village gardens
  // (settle.js mouseRich), thin in the open country but for a few good meadow patches; the
  // valley where you start keeps plenty so nobody begins hungry
  const cellCache = new Map();
  function cellMice(cx, cz) {
    const key = cx * 100003 + cz; let c = cellCache.get(key); if (c) return c;
    c = cellMiceOf(cx, cz); cellCache.set(key, c); if (cellCache.size > 4000) cellCache.delete(cellCache.keys().next().value);
    return c;
  }
  function cellMiceOf(cx, cz) {
    const x0 = cx * FOOD.cell, z0 = cz * FOOD.cell, mx = x0 + FOOD.cell / 2, mz = z0 + FOOD.cell / 2;
    const rich = mouseRich(mx, mz), patch = smooth(.15, .45, fbm(mx / 400, mz / 400, 73, 2)), home = 1 - smooth(250, 450, Math.hypot(mx, mz + 60));
    const p = Math.max(.16 + .3 * patch + .75 * rich, .55 * home), r = ih(cx, cz, 71);
    const out = [], n = r < p ? 1 + (ih(cx, cz, 72) < .3 + rich * .5) + (rich > .6 && ih(cx, cz, 74) < rich - .4) : 0;
    // a few tries per mouse for a dry, open, fairly flat spot in the cell (glades count)
    for (let k = 0; k < n; k++) for (let tr = 0; tr < 4; tr++) {
      const x = x0 + (.1 + ih(cx, cz, 73 + k * 7 + tr) * .8) * FOOD.cell, z = z0 + (.1 + ih(cx, cz, 75 + k * 7 + tr) * .8) * FOOD.cell;
      if (height(x, z) < 1 || forest(x, z) > .2 || normalAt(x, z)[1] < .82) continue;
      // its burrow is a few metres off where it forages: a mouse that sees you stoop runs for it
      const ba = ih(cx, cz, 79 + k) * 6.283, bx = x + Math.cos(ba) * 4.5, bz = z + Math.sin(ba) * 4.5;
      out.push({ id: cx * 92821 + cz * 6113 + k, hx: x, hz: z, bx: height(bx, bz) > 1 ? bx : x, bz: height(bx, bz) > 1 ? bz : z }); break;
    }
    return out;
  }
  G.mouseCells = cellMice;   // sys/fields.js reads the homes for its signs and the fox
  function refresh() {
    const r = FOOD.near, c0 = Math.floor((b.p[0] - r) / FOOD.cell), c1 = Math.floor((b.p[0] + r) / FOOD.cell);
    const d0 = Math.floor((b.p[2] - r) / FOOD.cell), d1 = Math.floor((b.p[2] + r) / FOOD.cell), seen = new Set();
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) for (const m of cellMice(cx, cz)) {
      const t = caught.get(m.id); if (t !== undefined && G.clock - t < FOOD.respawn) continue;
      seen.add(m.id);
      if (!mice.has(m.id)) mice.set(m.id, { ...m, x: m.hx, z: m.hz, yaw: ih(m.id, 1, 77) * 6.28, go: 0, wait: 1 + Math.random() * 3, flee: 0 });
    }
    for (const id of mice.keys()) if (!seen.has(id)) mice.delete(id);
  }
  let refreshT = 0;

  function simulate(m, dt) {
    // wander near the burrow in short scurries; run from a low, close shadow
    const dx = m.x - b.p[0], dz = m.z - b.p[2], hd = Math.hypot(dx, dz), hh = b.p[1] - height(b.p[0], b.p[2]), low = hh < 14, air = b.state === 'fly';
    const w = G.wary?.(m.hx, m.hz) || 0;   // a meadow where you missed a few times: its mice are on edge (sys/fields.js)
    if (m.seen > 0) m.seen -= dt;
    if (m.hidden > 0) { m.hidden -= dt; m.x = m.bx; m.z = m.bz; m.y = height(m.x, m.z); return; }
    // digging down: a moment of flying earth, then it is gone
    if (m.dig > 0) {
      m.dig -= dt;
      if (Math.random() < dt * 14) G.part([m.x, m.y + .05, m.z], [(Math.random() - .5) * 1.6, 1 + Math.random() * 1.2, (Math.random() - .5) * 1.6], .6, Math.random() < .5 ? [.42, .33, .24] : [.55, .46, .34], .07);
      if (m.dig <= 0) { m.dig = 0; m.hidden = FOOD.burrow; m.bx = m.x; m.bz = m.z; }
      return;
    }
    // you landed (or hopped down) close by: it runs for its burrow
    if ((b.state === 'ground' || b.state === 'perch' && b.p[1] - m.y < 6) && hd < 7 && !m.bolt) { m.bolt = true; m.flee = 3; m.freeze = 0; }
    if (air && hd < 10 + 12 * w && low && m.flee <= 0 && !G.silent) { m.flee = 1.2; m.yaw = Math.atan2(dx, -dz) + (Math.random() - .5); }
    // a shadow sweeping over from high up: it freezes (and stops rustling the grass)
    if (air && hd < 5 + 22 * w && !low && m.flee <= 0) m.freeze = FOOD.freeze;
    // a stoop at it: it bolts for its burrow, and if it gets there it is gone a while
    if (air && !G.silent && G.aim?.target === m && G.aim.focus > .35 - .2 * w && hd < 30 + 30 * w && !m.bolt) {
      m.bolt = true; m.flee = 3; m.freeze = 0;
    }
    if (m.bolt) {
      m.yaw = Math.atan2(m.bx - m.x, -(m.bz - m.z));
      // home (or out of breath, then down any hole): it digs in
      if (Math.hypot(m.x - m.bx, m.z - m.bz) < .4 || m.flee <= 0) {
        m.bolt = false; m.flee = 0; m.dig = FOOD.dig; m.go = 0; G.emit('escaped', m);
        if (!G.flags.burrow) { G.flags.burrow = 1; G.hud.glint('Into its burrow', 'It dug into its burrow. Mice bolt when they see you stoop or land near: come in fast and low, or from behind.', 'prey'); }
        return;
      }
    }
    let sp = 0;
    if (m.freeze > 0 && m.flee <= 0) { m.freeze -= dt; sp = 0; }
    else if (m.flee > 0) { m.flee -= dt; sp = m.bolt ? FOOD.bolt : 2.2; }
    else if (m.go > 0) { m.go -= dt; sp = 1.1; }
    else if ((m.wait -= dt) <= 0) { m.go = .4 + Math.random() * .8; m.wait = 1 + Math.random() * 3; m.yaw += (Math.random() - .5) * 2.4; }
    const away = Math.hypot(m.x - m.hx, m.z - m.hz);
    if (away > 8) m.yaw = Math.atan2(m.hx - m.x, -(m.hz - m.z));    // back toward home
    const nx = m.x + Math.sin(m.yaw) * sp * dt, nz = m.z - Math.cos(m.yaw) * sp * dt;
    if (height(nx, nz) > 1) { m.x = nx; m.z = nz; } else m.yaw += 2;
    m.y = height(m.x, m.z);
    // still in tall hay it can't be made out (sys/fields.js), until it moves or squeaks
    m.cover = sp < .5 && !(m.seen > 0) && (G.grassCover?.(m.x, m.z) || 0) > .6;
  }

  // what the feet hold: nothing is eaten until Eat is tapped
  function hold(food, wet, kind) { b.carry = { food, wet, kind }; G.emit('hold', b.carry); }
  // Eat: the meal takes a moment (a worm less), the catch shrinks in the feet as the hawk tears at it
  // and fills you as it ends; take off before then and the rest comes with you
  function startMeal() {
    const c = b.carry; if (!c || b.state === 'fly' || b.eating > 0) return;
    const k = b.state === 'perch' ? FOOD.perchMeal : 1;
    b.carry = null; b.meal = { food: c.food * k, wet: c.wet * k, kind: c.kind };
    b.eating = b.mealT = c.kind === 'worm' ? FOOD.wormMeal : FOOD.meal;
    G.hud.did('carry'); G.hud.did('eat');
  }
  function finish() {
    const m = b.meal; b.meal = null; if (!m) return;
    G.hunger = Math.min(1, G.hunger + m.food); G.thirst = Math.min(1, G.thirst + m.wet);
    G.emit('ate', m.kind);
  }
  // perched with a catch: Leave it here tucks it into the fork of the branch for later
  function leave() {
    const c = b.carry; if (!c || b.state !== 'perch') return;
    b.carry = null; noPick = b.perch;
    caches.push({ x: b.perch.x, y: b.perch.y, z: b.perch.z, kind: c.kind, food: c.food, wet: c.wet, day: G.day + G.tod, yaw: b.yaw });
    G.hud.tally('Kept for later: on your map', 'pin');
    G.emit('cache', caches[caches.length - 1]);
  }
  // landing with a catch at the nest: it drops in (nest.js feeds the chick; else it keeps there);
  // landing where you left one: you pick it up again
  let noPick = null, landed = false;
  G.on('land', () => { landed = true; });
  function arrive() {
    if (!landed || b.settle > 0) return;
    landed = false;
    if (b.state !== 'perch') return;
    const n = G.nest, atNest = n && Math.hypot(b.perch.x - n.x, b.perch.y - n.y, b.perch.z - n.z) < 3;
    if (b.carry && atNest) {
      const c = b.carry; b.carry = null;
      if (G.nestDrop?.(c)) return;
      caches.push({ x: n.x, y: n.y + .05, z: n.z, kind: c.kind, food: c.food, wet: c.wet, day: G.day + G.tod, yaw: b.yaw, nest: true });
      G.hud.tally('In the nest, for later', 'nest'); G.emit('cache', caches[caches.length - 1]);
      noPick = b.perch; return;
    }
    if (!b.carry && b.perch !== noPick) {
      const i = caches.findIndex(c => Math.hypot(c.x - b.p[0], c.y - b.p[1], c.z - b.p[2]) < (c.nest ? 3 : 1.5));
      if (i >= 0) { const c = caches.splice(i, 1)[0]; hold(c.food, c.wet, c.kind); G.hud.tally(c.nest ? 'A meal from the nest' : 'Back in your feet', 'prey'); G.emit('cache', null); }
    }
    noPick = null;
  }
  // with the one action button off: an Eat button of its own (left of Take off)
  const ui = document.getElementById('ui3') || document.body;
  ui.insertAdjacentHTML('beforeend', '<button class="takeoff3 eat3 gone" aria-label="Eat">Eat</button><style>#ui3 .takeoff3.eat3 { right: calc(var(--actr) + 150px); }</style>');
  const eatBtn = ui.querySelector('.eat3');
  eatBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G.actions.eat.when()) startMeal(); else if (G.actions.berries.when()) G.berries.eat(); });
  (G.actions ||= {}).eat = { run: startMeal, when: () => !!b.carry && b.state !== 'fly' && !(b.settle > 0) && !(b.eating > 0) && !b.asleep };
  // a bush in fruit under your feet (sys/berries.js)
  G.actions.berries = { run: () => G.berries?.eat(), when: () => !b.carry && !(b.eating > 0) && !b.asleep && !!G.berries?.here() };
  G.actions.leave = { run: leave, when: () => !!b.carry && b.state === 'perch' && !(b.settle > 0) && !(b.eating > 0) };
  function eat(m) {
    caught.set(m.id, G.clock); mice.delete(m.id);
    b.state = 'ground'; b.from = [...b.p]; b.p = [m.x, Math.max(m.y, WATER) + .35, m.z]; b.settle = .45; b.s = 0;
    hold(FOOD.mouse, FOOD.mouseWet, 'mouse');
    // make it plain: a strike and a squeak, a puff of grass, a rising glint, then the meal
    const A = G.audio;
    A.thump(.6); A.rustle(1.2); A.tone?.({ f: 2400, f2: 3100, dur: .07, vol: .07, delay: .05 }); A.tone?.({ f: 2600, f2: 2100, dur: .06, vol: .05, delay: .16 });
    setTimeout(() => A.feather(), 350);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; G.part([m.x, m.y + .15, m.z], [Math.cos(a) * 2.6, 1.2 + Math.random() * 1.5, Math.sin(a) * 2.6], .8, i % 3 ? [.6, .7, .34] : [.55, .44, .3], .1); }
    for (let i = 0; i < 8; i++) G.part([m.x + (Math.random() - .5) * .6, m.y + .5, m.z + (Math.random() - .5) * .6], [0, 1.6 + Math.random(), 0], 1.4, [1, .86, .45], .14);
    G.hud.tally('Caught a mouse', 'prey');
    G.hud.did('hunt'); G.emit('catch', { kind: 'mouse', x: m.x, z: m.z });
    if (!G.flags.firstMouse) { G.flags.firstMouse = 1; G.hud.say('Caught! Tap Eat to eat it here, or carry it to a branch or your nest.', { kind: 'tutorial', secs: 5, icon: 'prey' }); }
  }

  // other prey (sys/critters.js: jackrabbits, lizards, marmots, crabs, squirrels): the same
  // strike as a mouse; one taken off a branch (carry) rides in your feet to a perch
  function take(p) {
    const A = G.audio;
    hold(p.food, p.wet, p.kind);
    if (p.carry) A.feather();
    else {
      b.state = 'ground'; b.from = [...b.p]; b.p = [p.x, Math.max(p.y, WATER) + .35, p.z]; b.settle = .45; b.s = 0;
      A.thump(.6); A.rustle(1);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; G.part([p.x, p.y + .15, p.z], [Math.cos(a) * 2.2, 1.2 + Math.random() * 1.5, Math.sin(a) * 2.2], .8, [.55, .46, .34], .1); }
    for (let i = 0; i < 6; i++) G.part([p.x + (Math.random() - .5) * .6, p.y + .5, p.z + (Math.random() - .5) * .6], [0, 1.6 + Math.random(), 0], 1.4, [1, .86, .45], .14);
    G.hud.tally(`Caught ${p.name}`, 'prey');
    G.hud.did('hunt'); G.emit('catch', { kind: p.kind, x: p.x, z: p.z });
  }

  // ---- worms: after rain they come up near you, only while you are on the ground --------------
  function worms_(dt) {
    G.wet = (G.rain || 0) > .3 ? 1 : Math.max(0, G.wet - dt / FOOD.wet);
    const here = b.state === 'ground' && G.wet > .05;
    for (let i = worms.length - 1; i >= 0; i--) {
      const w = worms[i], d = Math.hypot(w.x - b.p[0], w.z - b.p[2]);
      w.t += dt;
      if (d > 14 || (!here && b.state !== 'ground')) { worms.splice(i, 1); continue; }
      if (b.state === 'ground' && d < .55 && b.settle <= 0 && !b.carry && !(b.eating > 0)) {   // landed on it: pick it up
        worms.splice(i, 1); hold(FOOD.worm, FOOD.worm * .3, 'worm');
        G.audio.rustle(.3); G.hud.did('worms');
        for (let k = 0; k < 6; k++) G.part([w.x, w.y + .1, w.z], [(Math.random() - .5) * 1.4, 1 + Math.random(), (Math.random() - .5) * 1.4], .6, [.45, .36, .26], .08);
        G.emit('catch', { kind: 'worm', x: w.x, z: w.z });
      }
    }
    if (here && worms.length < FOOD.worms && (wormT -= dt) <= 0) {
      wormT = worms.length ? 1.5 + Math.random() * 2.5 : .3;
      for (let tr = 0; tr < 10; tr++) {
        const a = Math.random() * 6.283, r = 1.5 + Math.random() * 3.5, x = b.p[0] + Math.sin(a) * r, z = b.p[2] - Math.cos(a) * r, y = height(x, z);
        if (y < WATER + .3 || forest(x, z) > .6 || normalAt(x, z)[1] < .8) continue;
        worms.push({ x, y, z, yaw: Math.random() * 6.283, t: 0 });
        for (let k = 0; k < 4; k++) G.part([x, y + .05, z], [(Math.random() - .5) * .6, .6 + Math.random() * .5, (Math.random() - .5) * .6], .5, [.4, .32, .24], .06);
        break;
      }
    }
    // a hop goes to the nearest worm close by
    let best = null, bd = 6;
    for (const w of worms) { const d = Math.hypot(w.x - b.p[0], w.z - b.p[2]); if (d < bd) { bd = d; best = w; } }
    b.hopAim = best ? [best.x, best.y, best.z] : null;
  }

  return {
    id: 'food',
    mice, take, hold,
    update(dt) {
      G.hunger = Math.max(0, G.hunger - dt / FOOD.hungerTime);
      G.thirst = Math.max(0, G.thirst - dt / FOOD.thirstTime);
      if ((refreshT -= dt) <= 0) { refreshT = .5; refresh(); }
      // took off mid-meal: what is left comes too
      if (b.state === 'fly' && b.meal) { const k = Math.max(.2, b.eating / (b.mealT || FOOD.meal)); b.carry = { ...b.meal, food: b.meal.food * k, wet: b.meal.wet * k }; b.meal = null; b.eating = 0; }
      if (b.eating > 0) {   // the meal: bend to the feet and tear, a bite at a time
        const t0 = b.mealT - b.eating, t1 = t0 + dt;
        if (Math.floor(t1 / .55) > Math.floor(t0 / .55) && b.eating > .3) { G.audio.eat(); const q = [b.p[0], b.p[1] - .25, b.p[2]]; for (let k = 0; k < 3; k++) G.part(q, [(Math.random() - .5) * .8, .5 + Math.random() * .6, (Math.random() - .5) * .8], .5, b.meal?.kind === 'fish' ? [.75, .8, .82] : b.meal?.kind === 'berries' ? [.7, .16, .14] : b.meal?.kind === 'bilberries' ? [.26, .24, .44] : [.55, .44, .34], .05); }
        b.eatPose = { headPitch: .7 + .35 * Math.max(0, Math.sin(t1 * 11.4)), headYaw: Math.sin(t1 * 3.1) * .2, fluff: .15 };
      } else b.eatPose = null;
      if (b.eating > 0 && b.eating - dt <= 0) finish();
      arrive();
      eatBtn.classList.toggle('gone', !(G.actions.eat.when() || G.actions.berries.when()) || !!G.menu?.open);
      for (let i = caches.length - 1; i >= 0; i--) if (G.day + G.tod - caches[i].day > FOOD.cacheDays) caches.splice(i, 1);
      let reach = 0;
      for (const m of mice.values()) {
        simulate(m, dt);
        if (b.state !== 'fly' || m.hidden > 0 || b.carry) continue;   // (feet full: a second catch dropped the first)
        const above = b.p[1] - m.y, hd = Math.hypot(b.p[0] - m.x, b.p[2] - m.z);
        if (above < 7 && hd < 7) reach = 1;
        const focus = G.aim?.focus || 0, r = FOOD.catchR + FOOD.catchDive * focus;
        if (above < FOOD.catchH + focus * 2.5 && hd < r) { eat(m); break; }
      }
      b.reach = reach;
      if (b.eating > 0) b.eating -= dt;
      // drinking: a tap on the water starts it; it goes on until full, or until you move off
      if (b.wantDrink && b.settle <= 0 && !b.goTo) { b.wantDrink = false; if (b.state === 'ground') G.water.drink(); }
      if (drinking && (G.thirst >= 1 || b.settle > 0 || b.goTo || !waterBy())) drinking = false;
      if (drinking) {
        G.thirst = Math.min(1, G.thirst + FOOD.drink * dt);
        if (G.thirst >= 1) drinking = false;   // full: stop here, as thirst creeps back before the check above next frame
        else if ((sipT -= dt) <= 0) { sipT = 1.1; G.audio.drink(); }
        G.hud.did('drink');
      }
      // empty meters slow how fast the wings recover (the meters flash when low: no message)
      b.recover = (G.hunger > 0 ? 1 : .5) * (G.thirst > 0 ? 1 : .5);
      // low food or water: the wings can't fill all the way
      const low = v => Math.max(0, FOOD.lowAt - v) / FOOD.lowAt * FOOD.lowMax;
      G.maxStamina = b.maxStamina = 1 - low(G.hunger) - low(G.thirst);
      b.stamina = Math.min(b.stamina, b.maxStamina);
      setHunger(G.hunger); setThirst(G.thirst);
      worms_(dt);
      // mice squeak now and then (a frozen one keeps still and quiet); hunting with wings tucked you
      // pick out every squeak, and an owl hears them more often still
      for (let i = squeaks.length - 1; i >= 0; i--) if ((squeaks[i].t += dt) > .7) squeaks.splice(i, 1);
      if ((rustleT -= dt) <= 0) {
        rustleT = .25;
        const hunt = b.state === 'fly' && (G.aim?.focus || 0) > .35, k = (hunt ? FOOD.squeakHunt : FOOD.squeak) * (BIRD === 'owl' ? 1.5 : 1);
        for (const m of mice.values()) if (!(m.hidden > 0) && !(m.dig > 0) && !(m.freeze > 0 && m.flee <= 0) && Math.random() < (m.flee > 0 ? .4 : k) && !squeaks.some(q => q.m === m)) { squeaks.push({ m, t: 0 }); m.seen = 2; }
      }
    },
    scene(S) {
      const wp = S.props.worm ||= [];
      for (const w of worms) { const up = Math.min(1, w.t * 1.5); wp.push(w.x, w.y - .03 + up * .03, w.z, 2.2 * up, w.yaw + Math.sin(G.t * 5 + w.x) * .35, .5, 0, 0); }
      const d = S.props.mouse ||= [];
      // at night a mouse's eyes catch the moon; an owl's song (known, or its gift) makes them easy to find
      const owl = Math.min(1, (G.learned?.has(6) ? .45 : 0) + (G.gifts?.night > 0 ? 1 : 0)), eye = (S.night || 0) * (.35 + owl * .65);
      // the catch in your feet, and catches left on branches
      const held = b.carry || (b.eating > 0 ? b.meal : null);
      if (held && S.hawk) {
        const h = S.hawk, u = h.u, k = b.carry ? 1 : Math.max(0, b.eating / (b.mealT || FOOD.meal)) ** .7;   // eaten away to nothing
        const kind = held.kind === 'worm' ? 'worm' : held.kind === 'fish' ? 'fish' : 'mouse', sc = { worm: 2.2, fish: .8, mouse: 1.6 }[kind] * k;
        if (sc > .02) (S.props[kind] ||= []).push(h.p[0] - u[0] * .3, h.p[1] - u[1] * .3 - .05, h.p[2] - u[2] * .3, sc, b.yaw - Math.PI / 2, .5, 0, 0);
      }
      for (const c of caches) if (Math.hypot(c.x - S.cam[0], c.z - S.cam[2]) < 120) d.push(c.x, c.y + .02, c.z, 1.6, c.yaw, .35, 0, 0);
      const hole = S.props.burrow ||= [], sq = S.props.squeak ||= [];
      for (const m of mice.values()) {
        const dc = Math.hypot(m.x - S.cam[0], m.y - S.cam[1], m.z - S.cam[2]);
        if (m.hidden > 0 || m.dig > 0) { if (dc < 120) hole.push(m.bx ?? m.x, m.y, m.bz ?? m.z, 1, m.id % 6.28, .5, 0, 0); }
        if (m.hidden > 0) continue;
        // digging, it noses down into the earth
        const dk = m.dig > 0 ? m.dig / FOOD.dig : 1;
        if (dc < 120) d.push(m.x, m.y - (1 - dk) * .1, m.z, 1.6 * (.4 + .6 * dk), m.yaw - Math.PI / 2, .5, 0, 0);
        if (eye > .05 && dc < 60 + owl * 140) S.motes.push(m.x, m.y + .12, m.z, .95, .85, .5, dc * (.003 + owl * .004) * eye * (.75 + .25 * Math.sin(G.t * 3 + m.id)));
      }
      // squeaks pop up over the mouse, facing you, sized to stay about as big on screen from high up
      for (const q of squeaks) {
        const m = q.m, dx = S.cam[0] - m.x, dz = S.cam[2] - m.z, dc = Math.hypot(dx, m.y - S.cam[1], dz);
        if (m.hidden > 0 || dc > 170) continue;
        const pop = Math.sin(Math.min(1, q.t / .7) * Math.PI) ** .5, s = Math.max(.8, Math.min(14, dc * .11)) * (BIRD === 'owl' ? 1.4 : 1) * pop;
        sq.push(m.x, m.y + .12 + s * .05 + q.t * .15 * s, m.z, s, Math.atan2(-dx, dz), .5, 0, 0);
      }
    },
    save: () => ({ hunger: G.hunger, thirst: G.thirst, caught: [...caught].slice(-200), caches, carry: b.carry || b.meal || null }),
    load(o) {
      G.hunger = clamp(o.hunger ?? 1, 0, 1); G.thirst = clamp(o.thirst ?? 1, 0, 1); for (const [k, v] of o.caught || []) caught.set(k, v);
      caches.push(...(o.caches || [])); b.carry = o.carry || null;
    },
  };
}
