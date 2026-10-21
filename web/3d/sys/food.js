// Hunger and thirst, mice in the meadows, worms after rain, and drinking at the water's edge.
// Running low on either lowers how full the wings can get (G.maxStamina, marked on the wings bar).
// Mice live in 48 m cells of open grass; only those near the hawk are simulated. A caught
// mouse's cell refills after a while. Grass twitches over each mouse, a cue seen from high up.
// Catching is forgiving: come down low over one and the feet reach for it; dive with wings
// tucked (the aim tightens, see aim.js) and the reach is longer.
import { height, normalAt, forest, WATER, ih } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { clamp } from '../util.js';

export const FOOD = {
  hungerTime: 1200, thirstTime: 1680,        // seconds from full to empty (four times the 2D times)
  mouse: .45, mouseWet: .1, drink: .3,       // how much a mouse fills (and quenches), how fast water refills
  worm: .08, wet: 300, worms: 3,             // a worm's fill, seconds the ground stays wet after rain, worms at once
  lowAt: .35, lowMax: .3,                    // below lowAt, hunger and thirst each take up to lowMax off max stamina
  cell: 48, near: 170, respawn: 150,         // mouse cells, simulated radius, seconds to refill
  catchR: 1.5, catchDive: 1.6, catchH: 2.6,  // reach, extra reach diving, how low to be
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

export function foodSystem(G) {
  const b = G.b, mice = new Map(), caught = new Map();   // id -> mouse; id -> G.clock caught
  G.R.shape('mouse', mouseShape()); G.R.shape('worm', wormShape());
  const worms = []; let wormT = 0; G.wet = 0;
  G.hud.tip('worms', () => b.state === 'ground' && worms.length > 0, 'After rain, worms come up. Tap to hop to the nearest one and eat it.');
  G.hunger = 1; G.thirst = 1;
  const setHunger = G.hud.meter('hunger', { label: 'food', colour: 'linear-gradient(90deg,#a8483a,#c96a4e)' });
  const setThirst = G.hud.meter('thirst', { label: 'water', colour: 'linear-gradient(90deg,#3f6f9a,#6c9ac0)' });
  G.hud.tip('hunt', () => G.hunger < .7 && b.state === 'fly' && G.aim?.target, 'A mouse in the grass! Tuck your wings (thumbs together) and dive at it. Come in low and your feet reach.');
  G.hud.tip('drink', () => G.thirst < .6 && b.state !== 'fly', 'Thirsty? Land at the water’s edge, or on the water, to drink.');
  let sipT = 0, rustleT = 0;

  // which mice live in a cell (fixed by hash), where their burrow is
  function cellMice(cx, cz) {
    const out = [], x0 = cx * FOOD.cell, z0 = cz * FOOD.cell, n = ih(cx, cz, 71) < .55 ? 1 + (ih(cx, cz, 72) < .3) : 0;
    // a few tries per mouse for a dry, open, fairly flat spot in the cell (glades count)
    for (let k = 0; k < n; k++) for (let tr = 0; tr < 4; tr++) {
      const x = x0 + (.1 + ih(cx, cz, 73 + k * 7 + tr) * .8) * FOOD.cell, z = z0 + (.1 + ih(cx, cz, 75 + k * 7 + tr) * .8) * FOOD.cell;
      if (height(x, z) < 1 || forest(x, z) > .2 || normalAt(x, z)[1] < .82) continue;
      out.push({ id: cx * 92821 + cz * 6113 + k, hx: x, hz: z }); break;
    }
    return out;
  }
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
    const dx = m.x - b.p[0], dz = m.z - b.p[2], hd = Math.hypot(dx, dz), low = b.p[1] - height(b.p[0], b.p[2]) < 14;
    if (b.state === 'fly' && hd < 10 && low && m.flee <= 0) { m.flee = 1.2; m.yaw = Math.atan2(dx, -dz) + (Math.random() - .5); }
    let sp = 0;
    if (m.flee > 0) { m.flee -= dt; sp = 2.2; }
    else if (m.go > 0) { m.go -= dt; sp = 1.1; }
    else if ((m.wait -= dt) <= 0) { m.go = .4 + Math.random() * .8; m.wait = 1 + Math.random() * 3; m.yaw += (Math.random() - .5) * 2.4; }
    const away = Math.hypot(m.x - m.hx, m.z - m.hz);
    if (away > 8) m.yaw = Math.atan2(m.hx - m.x, -(m.hz - m.z));    // back toward home
    const nx = m.x + Math.sin(m.yaw) * sp * dt, nz = m.z - Math.cos(m.yaw) * sp * dt;
    if (height(nx, nz) > 1) { m.x = nx; m.z = nz; } else m.yaw += 2;
    m.y = height(m.x, m.z);
  }

  function eat(m) {
    caught.set(m.id, G.clock); mice.delete(m.id);
    b.state = 'ground'; b.from = [...b.p]; b.p = [m.x, Math.max(m.y, WATER) + .35, m.z]; b.settle = .45; b.s = 0;
    b.eating = 2.4; G.hunger = Math.min(1, G.hunger + FOOD.mouse); G.thirst = Math.min(1, G.thirst + FOOD.mouseWet);
    // make it plain: a strike and a squeak, a puff of grass, a rising glint, then the meal
    const A = G.audio;
    A.thump(.6); A.rustle(1.2); A.tone?.({ f: 2400, f2: 3100, dur: .07, vol: .07, delay: .05 }); A.tone?.({ f: 2600, f2: 2100, dur: .06, vol: .05, delay: .16 });
    setTimeout(() => A.feather(), 350); setTimeout(() => A.eat(), 800); setTimeout(() => A.eat(), 1400); setTimeout(() => A.eat(), 2000);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; G.part([m.x, m.y + .15, m.z], [Math.cos(a) * 2.6, 1.2 + Math.random() * 1.5, Math.sin(a) * 2.6], .8, i % 3 ? [.6, .7, .34] : [.55, .44, .3], .1); }
    for (let i = 0; i < 8; i++) G.part([m.x + (Math.random() - .5) * .6, m.y + .5, m.z + (Math.random() - .5) * .6], [0, 1.6 + Math.random(), 0], 1.4, [1, .86, .45], .14);
    G.hud.toast('Caught a mouse', 2);
    G.hud.did('hunt'); G.emit('catch', { kind: 'mouse', x: m.x, z: m.z });
    if (!G.flags.firstMouse) { G.flags.firstMouse = 1; G.hud.toast('Caught! A mouse fills you up a good way.'); }
  }

  // ---- worms: after rain they come up near you, only while you are on the ground --------------
  function worms_(dt) {
    G.wet = (G.rain || 0) > .3 ? 1 : Math.max(0, G.wet - dt / FOOD.wet);
    const here = b.state === 'ground' && G.wet > .05;
    for (let i = worms.length - 1; i >= 0; i--) {
      const w = worms[i], d = Math.hypot(w.x - b.p[0], w.z - b.p[2]);
      w.t += dt;
      if (d > 14 || (!here && b.state !== 'ground')) { worms.splice(i, 1); continue; }
      if (b.state === 'ground' && d < .55 && b.settle <= 0) {   // landed on it: eat
        worms.splice(i, 1); b.eating = .9;
        G.hunger = Math.min(1, G.hunger + FOOD.worm); G.thirst = Math.min(1, G.thirst + FOOD.worm * .3);
        G.audio.eat(); setTimeout(() => G.audio.eat(), 300); G.hud.did('worms');
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
    mice,
    update(dt) {
      G.hunger = Math.max(0, G.hunger - dt / FOOD.hungerTime);
      G.thirst = Math.max(0, G.thirst - dt / FOOD.thirstTime);
      if ((refreshT -= dt) <= 0) { refreshT = .5; refresh(); }
      let reach = 0;
      for (const m of mice.values()) {
        simulate(m, dt);
        if (b.state !== 'fly') continue;
        const above = b.p[1] - m.y, hd = Math.hypot(b.p[0] - m.x, b.p[2] - m.z);
        if (above < 7 && hd < 7) reach = 1;
        const focus = G.aim?.focus || 0, r = FOOD.catchR + FOOD.catchDive * focus;
        if (above < FOOD.catchH + focus * 2.5 && hd < r) { eat(m); break; }
      }
      b.reach = reach;
      if (b.eating > 0) b.eating -= dt;
      // drinking: floating, or standing at the edge of water
      const g = height(b.p[0], b.p[2]);
      const shore = b.state === 'ground' && [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([x, z]) => height(b.p[0] + x, b.p[2] + z) < WATER);
      if ((b.state === 'swim' || shore) && G.thirst < 1) {
        G.thirst = Math.min(1, G.thirst + FOOD.drink * dt);
        if ((sipT -= dt) <= 0) { sipT = 1.1; G.audio.drink(); }
        G.hud.did('drink');
      }
      void g;
      // empty meters slow how fast the wings recover (the meters flash when low: no message)
      b.recover = (G.hunger > 0 ? 1 : .5) * (G.thirst > 0 ? 1 : .5);
      // low food or water: the wings can't fill all the way
      const low = v => Math.max(0, FOOD.lowAt - v) / FOOD.lowAt * FOOD.lowMax;
      G.maxStamina = b.maxStamina = 1 - low(G.hunger) - low(G.thirst);
      b.stamina = Math.min(b.stamina, b.maxStamina);
      setHunger(G.hunger); setThirst(G.thirst);
      worms_(dt);
      // grass twitches over mice: little green flecks, easy to spot from the air
      if ((rustleT -= dt) <= 0) {
        rustleT = .25;
        for (const m of mice.values()) if (Math.random() < .2 || m.flee > 0) for (let i = 0; i < 3; i++) G.part([m.x + (Math.random() - .5) * .4, m.y + .25, m.z + (Math.random() - .5) * .4], [(Math.random() - .5) * .8, 1 + Math.random(), (Math.random() - .5) * .8], .7, [.62, .72, .35], .12);
      }
    },
    scene(S) {
      const wp = S.props.worm ||= [];
      for (const w of worms) { const up = Math.min(1, w.t * 1.5); wp.push(w.x, w.y - .03 + up * .03, w.z, 2.2 * up, w.yaw + Math.sin(G.t * 5 + w.x) * .35, .5, 0, 0); }
      const d = S.props.mouse ||= [];
      // at night a mouse's eyes catch the moon; an owl's song (known, or its gift) makes them easy to find
      const owl = Math.min(1, (G.learned?.has(6) ? .45 : 0) + (G.gifts?.night > 0 ? 1 : 0)), eye = (S.night || 0) * (.35 + owl * .65);
      for (const m of mice.values()) {
        const dc = Math.hypot(m.x - S.cam[0], m.y - S.cam[1], m.z - S.cam[2]);
        if (dc < 120) d.push(m.x, m.y, m.z, 1.6, m.yaw - Math.PI / 2, .5, 0, 0);
        if (eye > .05 && dc < 60 + owl * 140) S.motes.push(m.x, m.y + .12, m.z, .95, .85, .5, dc * (.003 + owl * .004) * eye * (.75 + .25 * Math.sin(G.t * 3 + m.id)));
      }
    },
    save: () => ({ hunger: G.hunger, thirst: G.thirst, caught: [...caught].slice(-200) }),
    load(o) { G.hunger = clamp(o.hunger ?? 1, 0, 1); G.thirst = clamp(o.thirst ?? 1, 0, 1); for (const [k, v] of o.caught || []) caught.set(k, v); },
  };
}
