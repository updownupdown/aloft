// Hunger and thirst, mice in the meadows, and drinking at the water's edge.
// Mice live in 48 m cells of open grass; only those near the hawk are simulated. A caught
// mouse's cell refills after a while. Grass twitches over each mouse, a cue seen from high up.
// Catching is forgiving: come down low over one and the feet reach for it; dive with wings
// tucked (the aim tightens, see aim.js) and the reach is longer.
import { height, normalAt, forest, WATER, ih } from '../world.js';
import { builder, blob, reseed } from '../shapes.js';
import { clamp } from '../util.js';

export const FOOD = {
  hungerTime: 600, thirstTime: 840,          // seconds from full to empty (twice the 2D times)
  mouse: .45, drink: .3,                     // how much a mouse fills, how fast water refills
  cell: 48, near: 170, respawn: 150,         // mouse cells, simulated radius, seconds to refill
  catchR: 1.5, catchDive: 1.6, catchH: 2.6,  // reach, extra reach diving, how low to be
};

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
  G.R.shape('mouse', mouseShape());
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
    b.eating = 2.4; G.hunger = Math.min(1, G.hunger + FOOD.mouse);
    G.audio.thump(.3); G.audio.eat(); setTimeout(() => G.audio.eat(), 600); setTimeout(() => G.audio.eat(), 1300);
    G.hud.did('hunt'); G.emit('catch', { kind: 'mouse', x: m.x, z: m.z });
    if (!G.flags.firstMouse) { G.flags.firstMouse = 1; G.hud.toast('Caught! A mouse fills you up a good way.'); }
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
      setHunger(G.hunger); setThirst(G.thirst);
      // grass twitches over mice: little green flecks, easy to spot from the air
      if ((rustleT -= dt) <= 0) {
        rustleT = .25;
        for (const m of mice.values()) if (Math.random() < .2 || m.flee > 0) for (let i = 0; i < 3; i++) G.part([m.x + (Math.random() - .5) * .4, m.y + .25, m.z + (Math.random() - .5) * .4], [(Math.random() - .5) * .8, 1 + Math.random(), (Math.random() - .5) * .8], .7, [.62, .72, .35], .12);
      }
    },
    scene(S) {
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
