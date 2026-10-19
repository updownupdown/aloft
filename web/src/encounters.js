// Small stories that happen to the hawk on its way, each from what real red-tails meet:
// kingbirds and blackbirds that mob a hawk near their nests in spring and summer, a bald
// eagle that chases a hawk carrying a fish to rob it, bison on the prairie flushing
// grasshoppers a hawk can snatch, monarchs drifting south in autumn and hanging in clusters
// at dusk, a bear fishing a run of leaping fish at some forest lakes, and, on a later
// journey, a grown hawk with your chick's markings that circles once with you.
// Where the still things are is a pure function of the world; what is happening now lives in G.enc.
import { TAU, clamp, hash, C, shade, mix } from './util.js';
import * as W from './world.js';
import { wash, stroke, strokes, ellP, circP, lift, stamp, put } from './paint.js';
import { sight } from './guide.js';
import { SPECIES } from './songs.js';
const RWBL = 'sp' + SPECIES.find(s => s.name === 'Red-winged blackbird')?.id;

export function createEnc(store) {
  return { mob: [], mobT: 40, mobTree: null, eagle: null, eagleT: 0, held: 0, fall: null, hop: [], mon: [], grown: null, grownT: 30,
    chicks: store.get('chicks', []), met: store.get('grownMet', -1), lastJ: null };
}
const day = G => G.tod > .26 && G.tod < .76;
const groundUp = (G, b) => W.groundY(b.x) - b.y;

/* ---------- sounds, made from the game's synth ---------- */
const sfx = {
  // the eastern kingbird's sputtering "kzeer" and the red-winged blackbird's "check"
  kingbird: A => { for (let k = 0; k < 4; k++) A.tone?.({ f: 3800 + k * 200, f2: 4600, dur: .07, vol: .05, type: 'sawtooth', delay: k * .09, lp: 6000, vib: 300, vibF: 60 }); },
  blackbird: A => { A.burst?.({ f: 2200, q: 3, dur: .06, vol: .14 }); A.tone?.({ f: 1900, f2: 1500, dur: .05, vol: .05, type: 'square', lp: 3000 }); },
  // a bald eagle's thin, chittering whistle: nothing like its size
  eagle: A => { for (let k = 0; k < 5; k++) A.tone?.({ f: 2600 - k * 90, f2: 2900 - k * 120, dur: .09, vol: .06, type: 'triangle', delay: k * .11, vib: 60, vibF: 30 }); },
  grunt: A => A.burst?.({ f: 240, f2: 160, type: 'lowpass', dur: .5, vol: .3 }),
  woof: A => { A.burst?.({ f: 380, f2: 200, type: 'lowpass', dur: .25, vol: .35 }); A.burst?.({ f: 320, f2: 180, type: 'lowpass', dur: .2, vol: .25, delay: .3 }); },
  splash: A => A.burst?.({ f: 1600, f2: 500, q: .7, dur: .3, vol: .12 }),
};

/* ---------- C1: mobbing ---------- */
// A small songbird defending its nest dives at a hawk passing low, chattering, and sometimes
// lands a peck on its back. Leave its tree behind and it lets you go.
const MOBBERS = {
  kingbird: { name: 'eastern kingbird', col: [62, 64, 72], wing: [44, 44, 52], breast: [236, 232, 222], call: 'kingbird' },
  blackbird: { name: 'red-winged blackbird', col: [34, 30, 32], wing: [26, 22, 24], shoulder: [200, 50, 40], call: 'blackbird' },
};
const nestTree = t => hash(t.i * 17.3 + 5) < .3 && t.bio !== 'cliffs';
function updateMob(G, dt, { audio, haptics, once }) {
  const E = G.enc, b = G.bird;
  if (!E.mob.length) {
    if ((E.mobT -= dt) > 0 || b.state !== 'fly' || !day(G) || G.storm > .4) return;
    E.mobT = 8;
    const nesting = G.sea.winter < .3 && G.sea.autumn < .5;
    if (!nesting || groundUp(G, b) > 150 || G.crows.length) return;
    const t = W.treesIn(b.x - 70, b.x + 70).find(nestTree); if (!t) return;
    const kind = t.bio === 'marsh' || t.bio === 'lakeland' || t.type === 3 ? 'blackbird' : 'kingbird', M = MOBBERS[kind];
    const n = 1 + (hash(t.i * 3.9) < .4 ? 1 : 0);
    for (let i = 0; i < n; i++) E.mob.push({ kind, x: t.x + (i ? 8 : -6), y: t.y - t.h * .6, vxs: 0, vys: -20, ph: i * 2, seed: i + 5, diveT: .6 + i * 1.1, diving: 0, callT: 0 });
    E.mobTree = t; E.mobLife = 0; E.mobT = 70 + Math.random() * 60;
    sfx[M.call](audio);
    once('mob' + kind, kind === 'kingbird' ? 'A kingbird, defending its nest. Small birds chase hawks out of their home trees. Fly on and it lets you go.'
      : 'A red-winged blackbird, flashing its red shoulders at you. You are near its nest: fly on and it lets you go.', 5);
    return;
  }
  E.mobLife += dt;
  const t = E.mobTree, gone = Math.abs(b.x - t.x) > 240 || groundUp(G, b) > 260 || b.state !== 'fly' || E.mobLife > 25;
  for (const m of E.mob) {
    const M = MOBBERS[m.kind];
    let T;
    if (gone) T = { x: t.x, y: t.y - t.h * .6 };
    else {
      m.diveT -= dt;
      if (m.diveT <= 0 && !m.diving) { m.diving = .7; m.diveT = 1.6 + Math.random() * 1.6; }
      if (m.diving > 0) {
        // straight at the hawk's back, from above
        m.diving -= dt; T = { x: b.x - b.face * 2, y: b.y - 6 };
        if (Math.hypot(m.x - b.x, m.y - b.y + 6) < 7) { m.diving = 0; b.kick += 8; haptics.jolt?.(); sfx[M.call](audio); }
      } else T = { x: b.x - b.face * 10 + Math.sin(G.t * 3 + m.seed) * 10, y: b.y - 22 + Math.cos(G.t * 2.4 + m.seed) * 6 };
    }
    const dx = T.x - m.x, dy = T.y - m.y, d = Math.hypot(dx, dy) || 1, want = Math.min(m.diving > 0 ? 190 : 160, 40 + d * 2.2);
    m.vxs += (dx / d * want - m.vxs) * Math.min(1, dt * 3); m.vys += (dy / d * want - m.vys) * Math.min(1, dt * 3);
    m.x += m.vxs * dt; m.y += m.vys * dt; m.ph += dt * 30;
    if ((m.callT -= dt) <= 0 && !gone) { m.callT = 1.2 + Math.random() * 1.5; sfx[M.call](audio); }
  }
  if (gone && E.mob.every(m => Math.hypot(m.x - t.x, m.y - (t.y - t.h * .6)) < 6)) E.mob = [];
}
function drawMob(ctx, G, P, smallBird) {
  for (const m of G.enc.mob) {
    const M = MOBBERS[m.kind], night = mix(P.birdFar, [255, 255, 255], .15);
    const col = mix(M.col, night, .35 * (1 - day(G))), wing = mix(M.wing, night, .35 * (1 - day(G)));
    smallBird(ctx, { x: m.x, y: m.y, vx: m.vxs, ph: m.ph, col, wing, breast: M.breast, seed: m.seed }, P, G);
    sight(G, m.kind === 'kingbird' ? 'kingbird' : RWBL, m.x, m.y + 3, 9);
    if (M.shoulder) { const dir = m.vxs < 0 ? -1 : 1; ctx.fillStyle = C(M.shoulder, .95); ctx.beginPath(); ctx.ellipse(m.x - dir * 1.2, m.y - 1.4, 1.3, .8, 0, 0, TAU); ctx.fill(); }
  }
}

/* ---------- C2: the eagle pirate ---------- */
// Bald eagles rob ospreys and hawks of their fish. Near open water, a fish you catch may bring
// one down on you: out-climb it (it is heavy and slow to rise) or reach a perch and the fish is
// yours; let it catch you and you let go, and it takes the fish out of the air.
export function caughtFish(G, p, force = false) {
  const E = G.enc;
  if (!p || E.eagle || G.carry || (G.t < E.eagleT && !force)) return false;
  if (!(p.lake || p.w > 48) || (hash(p.k * 5.7 + G.day) > .6 && !force)) return false;
  const b = G.bird, side = -b.face;
  E.eagle = { x: b.x + side * 240, y: b.y - 140, vxs: -side * 60, vys: 30, ph: 0, t: 0, state: 'chase', face: -side };
  E.held = 40; E.eagleT = G.t + 150; G.carry = 'fish';
  return true;
}
function eatHeld(G, toast, audio, msg) {
  const E = G.enc;
  if (G.carry === 'fish') G.carry = null;
  G.hunger = Math.min(100, G.hunger + E.held); E.held = 0; audio.eat(); toast(msg, 3);
}
function updateEagle(G, dt, { audio, haptics, once, toast }) {
  const E = G.enc, e = E.eagle, b = G.bird; if (!e) return;
  e.t += dt;
  if (E.held && G.carry !== 'fish') E.held = 0;   // the fish went somewhere else (fed to a chick)
  let T, max = 150;
  if (e.state === 'chase') {
    if (e.t > 1.5 && e.t < 2) { sfx.eagle(audio); once('eagle', 'A bald eagle! Eagles rob hawks of their fish. Out-climb it, or reach a perch, and the fish is yours.', 5); }
    T = { x: b.x - b.face * 4, y: b.y - 3 };
    const d = Math.hypot(e.x - b.x, e.y - b.y);
    if (!E.held || b.state === 'perch' || b.state === 'ground') {
      if (E.held) eatHeld(G, toast, audio, 'Down out of the chase, you eat your fish.');
      e.state = 'leave';
    } else if (d < 13) {
      // you let go: the fish falls and the eagle rolls over to take it
      G.carry = null; E.held = 0; E.fall = { x: b.x, y: b.y + 4, vy: 0 }; e.state = 'catch';
      haptics.jolt?.(); b.kick += 14; sfx.eagle(audio); toast('You let go of the fish, and the eagle takes it out of the air.', 3.5);
    } else if (b.y < e.y - 110 || d > 420 || e.t > 30) {
      eatHeld(G, toast, audio, 'The eagle gives up. The fish is yours.'); e.state = 'leave';
    }
  }
  if (e.state === 'catch') {
    const f = E.fall; f.vy += 200 * dt; f.y += f.vy * dt;
    T = { x: f.x, y: f.y }; max = 200;
    if (Math.hypot(e.x - f.x, e.y - f.y) < 8 || f.y > W.groundY(f.x)) { E.fall = null; e.state = 'leave'; e.fish = true; }
  }
  if (e.state === 'leave') { T = { x: e.x + e.face * 300, y: e.y - 120 }; max = 120; if (Math.abs(e.x - b.x) > 700) { E.eagle = null; return; } }
  const dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1, want = Math.min(max, 40 + d * 1.5);
  e.vxs += (dx / d * want - e.vxs) * Math.min(1, dt * 1.4); e.vys += (dy / d * want - e.vys) * Math.min(1, dt * 1.4);
  e.vys = Math.max(e.vys, -38);   // heavy: it climbs slowly
  e.x += e.vxs * dt; e.y += e.vys * dt;
  const gy = W.groundY(e.x); if (e.y > gy - 25) { e.y = gy - 25; e.vys = Math.min(0, e.vys); }
  if (Math.abs(e.vxs) > 10) e.face = e.vxs > 0 ? 1 : -1;
  e.ph += dt * (e.vys < -15 || e.state === 'catch' ? 6 : 2.5);
}
function drawEagle(ctx, G, P) {
  const e = G.enc.eagle; if (!e) return;
  if (G.enc.fall) { const f = G.enc.fall; ctx.fillStyle = C([170, 180, 190], .9); ctx.beginPath(); ctx.ellipse(f.x, f.y, 3.2, 1.2, .4, 0, TAU); ctx.fill(); }
  // a soaring eagle holds its wings flat as a plank; flapping, it gives slow deep beats
  const lv = e.state === 'leave' && e.vys > -10 ? 2 : Math.round((Math.sin(e.ph) + 1) * 2), fl = (lv / 2 - 1) * 10;
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face * 1.4, 1.4);   // bigger than the hawk, by a third
  put(ctx, stamp('eagle' + lv, P.eagle.join() + P.paper.join(), -32, -30, 30, 22, G.view.spx * 1.3, x => {
    const col = P.eagle, dk = shade(col, .75), white = mix(P.paper, P.birdPale, .25);
    const wing = s => [[6, -1], [-2, -2 - fl * s], [-12, -4 - fl * 1.3 * s], [-24, -6 - fl * 1.5 * s], [-20, -2 - fl * 1.1 * s], [-26, -1 - fl * s], [-16, 1], [-4, 3]];
    wash(x, wing(.8), dk, .7, { passes: 1, amp: .6, seed: 61, rim: .3 });   // the far wing
    // the white tail, a broad wedge
    wash(x, [[-11, -1.6], [-21, -3.6], [-23, .4], [-21, 3.8], [-11, 2]], white, .55, { passes: 2, amp: .4, seed: 62, rim: .5 });
    wash(x, ellP(0, .2, 13.5, 4.8, -.04), col, .82, { passes: 2, amp: .6, seed: 63, rim: .4 });
    // the white head and the heavy yellow bill
    wash(x, circP(13, -2.2, 4.6, 12), white, .5, { passes: 2, amp: .3, seed: 64, rim: .5 });
    lift(x, circP(13.2, -2.4, 3.6, 10), P.paper, .55);
    wash(x, [[16.5, -3.6], [21, -2.6], [21.6, -.6], [20, .2], [16.5, -.6]], P.beak, .9, { passes: 1, amp: .2, seed: 65, rim: .4 });
    x.fillStyle = C(P.birdFar); x.beginPath(); x.arc(15.2, -3.4, .7, 0, TAU); x.fill();
    stroke(x, [[-2, 4], [3, 6.5]], P.beak, .8, 1.4, 66);   // yellow feet
    wash(x, wing(1.1), col, .85, { passes: 2, amp: .6, seed: 67, rim: .45 });   // the near wing over the body
    strokes(x, [[[-22, -6 - fl * 1.6], [-28, -7 - fl * 1.7]], [[-24, -3.5 - fl * 1.3], [-30, -3.5 - fl * 1.4]], [[-25, -1 - fl * 1.1], [-31, 0 - fl * 1.1]]], dk, .8, 1.2, 68);   // fingers
  }));
  sight(G, 'eagle', e.x, e.y + 8, 30);
  if (e.fish) { ctx.fillStyle = C([170, 180, 190], .9); ctx.beginPath(); ctx.ellipse(0, 7, 3.2, 1.1, .2, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------- C3: bison on the prairie, and the grasshoppers they flush ---------- */
// Swainson's hawks follow grazing herds for the insects their hooves kick up: a lot of small
// meals for a hawk flying low behind them.
const HC = 1700;
export function herdOf(i) {
  if (hash(i * 3.3 + 8) > .5) return null;
  const x = i * HC + 300 + hash(i * 1.9) * (HC - 600);
  if (W.biomeAt(x).name !== 'meadow' || W.pondNear(x, 2)) return null;
  const n = 3 + Math.floor(hash(i * 7.1) * 3);
  return { i, x, n, dir: hash(i * 2.4) < .5 ? -1 : 1 };
}
function bisonPos(h, j, t) {
  // they graze slowly along, the herd drifting back and forth over the same few hundred units
  const ph = t * .018 + h.i + j * .3, x = h.x + (j - h.n / 2) * 62 + hash(h.i * 9 + j) * 20 + Math.sin(ph) * 70;
  return { x, y: W.groundY(Math.round(x)), dir: Math.cos(ph) > 0 ? 1 : -1, walk: Math.abs(Math.cos(ph)) > .35 };
}
const herdsIn = (x0, x1) => { const out = []; for (let i = Math.floor(x0 / HC) - 1; i <= Math.ceil(x1 / HC); i++) { const h = herdOf(i); if (h) out.push(h); } return out; };
function updateBison(G, dt, { audio, once }) {
  const E = G.enc, b = G.bird, warm = G.sea.winter < .4;
  for (const h of herdsIn(G.cam.x - 100, G.cam.x + G.view.w + 100)) {
    if (Math.abs(h.x - b.x) < G.view.w * .6) { once('bison', 'Bison. As they walk they kick up grasshoppers: fly low behind them and snap them up, as Swainson\'s hawks do.', 5); }
    if (Math.random() < dt * .08) sfx.grunt(audio);
    if (!warm || !day(G) || E.hop.length > 12) continue;
    for (let j = 0; j < h.n; j++) {
      const q = bisonPos(h, j, G.t);
      if (!q.walk || Math.random() > dt * .6) continue;
      E.hop.push({ x: q.x + q.dir * 14 + (Math.random() - .5) * 10, y: q.y - 1, vx: (Math.random() - .5) * 50, vy: -50 - Math.random() * 50, life: 2 });
    }
  }
  let ate = 0;
  for (const g of E.hop) {
    g.life -= dt; g.vy += 180 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.y > W.groundY(Math.round(g.x))) g.life = 0;
    if (b.state === 'fly' && Math.hypot(g.x - b.x, g.y - b.y - 3) < 10) { g.life = 0; ate++; }
  }
  E.hop = E.hop.filter(g => g.life > 0);
  if (ate) { G.hunger = Math.min(100, G.hunger + 2 * ate); audio.eat(); once('hopper', 'A grasshopper! Each one is a small bite.'); }
}
function drawBison(ctx, G, P) {
  const col = P.bison;
  for (const h of herdsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) for (let j = 0; j < h.n; j++) {
    const q = bisonPos(h, j, G.t), step = q.walk ? Math.floor(G.t * 2.4 + j) % 2 : 2, graze = !q.walk && Math.sin(G.t * .3 + j) > -.3;
    if (j === 0) sight(G, 'bison', q.x, q.y - 4, 34);
    ctx.save(); ctx.translate(q.x, q.y + 1); const k = 1.75 + .25 * hash(h.i * 5 + j); ctx.scale(q.dir * k, k);
    put(ctx, stamp('bison' + step + (graze ? 1 : 0), col.join(), -20, -24, 22, 2, G.view.spx * 1.2, c => {
      const dk = shade(col, .7), pale = mix(col, P.ground, .35);
      const a = step === 0 ? 2 : step === 1 ? -2 : 0;
      strokes(c, [[[-10, -8], [-10 - a, 0]], [[-6.5, -8], [-6.5 + a, 0]], [[6, -8], [6 + a, 0]], [[9, -8], [9 - a, 0]]], dk, .85, 2.3, 70);
      // a low rump that rises to the great shaggy hump over the shoulders
      wash(c, [[-15, -8], [-15.5, -12], [-13, -15], [-6, -15.5], [0, -17], [4, -21], [8, -21.5], [11.5, -19], [13.5, -14], [13, -9], [10, -6.5], [-12, -6]], col, .8, { passes: 2, amp: .6, seed: 71, rim: .45 });
      wash(c, [[4, -21], [8, -21.5], [11.5, -19], [14, -13], [12.5, -7], [7, -8], [4, -14]], pale, .5, { passes: 2, amp: .7, seed: 72, rim: .3 });   // the woolly cape
      const hy = graze ? -3 : -10;
      wash(c, ellP(16, hy, 4.6, 3.6, graze ? .9 : .3), dk, .85, { passes: 2, amp: .4, seed: 73, rim: .4 });   // the heavy head, carried low
      wash(c, [[15, hy + 2], [17, hy + 7], [19, hy + 2]], dk, .8, { passes: 1, amp: .3, seed: 74, rim: .2 });   // beard
      stroke(c, [[15, hy - 3], [14, hy - 6], [16, hy - 6.5]], [70, 62, 54], .85, .9, 75);   // a short curved horn
      stroke(c, [[-15, -12], [-17, -6], [-16.5, -4]], dk, .8, .8, 76);   // the tail
      c.fillStyle = C(P.birdFar); c.beginPath(); c.arc(17.5, hy - 1, .55, 0, TAU); c.fill();
    }));
    ctx.restore();
  }
  // grasshoppers: tiny and quick, just a fleck of green
  if (G.enc.hop.length) {
    ctx.fillStyle = C(mix(P.leafHi, [120, 140, 40], .5), .9); ctx.beginPath();
    for (const g of G.enc.hop) { ctx.moveTo(g.x + 1.4, g.y); ctx.ellipse(g.x, g.y, 1.4, .6, Math.atan2(g.vy, g.vx), 0, TAU); }
    ctx.fill();
  }
}

/* ---------- C4: monarchs ---------- */
// In autumn monarch butterflies flutter south across the land, low over the fields, the same
// way the hawk is going; at dusk some trees are hung with clusters of them.
const monarchsOut = G => G.sea.autumn > .4 && G.storm < .4;
const clusterTree = t => t.type !== 2 && hash(t.i * 21.7 + 3) < .14;
function updateMonarchs(G, dt, { once }) {
  const E = G.enc, b = G.bird, { w } = G.view;
  if (!monarchsOut(G) || !day(G)) { E.mon = E.mon.filter(m => (m.fade -= dt) > 0); return; }
  const want = 9;
  while (E.mon.length < want) {
    const first = !E.mon.started, x = first ? G.cam.x + Math.random() * w : (Math.random() < .7 ? G.cam.x - 20 : G.cam.x + w + 20);
    E.mon.push({ x, y: W.groundY(Math.round(x)) - 25 - Math.random() * 120, ph: Math.random() * TAU, seed: Math.random() * 99, v: 10 + Math.random() * 8, fade: 1 });
    if (E.mon.length >= want) E.mon.started = true;
  }
  for (const m of E.mon) {
    m.ph += dt * (12 + Math.sin(G.t + m.seed) * 4);
    m.x += (m.v + G.wind * .4) * dt; m.y += Math.sin(G.t * 1.3 + m.seed) * 14 * dt;
    const gy = W.groundY(Math.round(m.x)); m.y = clamp(m.y, gy - 180, gy - 12);
    // brushed aside by a passing hawk
    const d = Math.hypot(m.x - b.x, m.y - b.y); if (d < 14) { m.x += (m.x - b.x) / d * 40 * dt; m.y += (m.y - b.y) / d * 40 * dt; }
  }
  E.mon = E.mon.filter(m => m.x > G.cam.x - 60 && m.x < G.cam.x + w + 60);
  if (E.mon.some(m => Math.abs(m.x - b.x) < 80 && Math.abs(m.y - b.y) < 60)) { once('monarch', 'Monarch butterflies, flying south like you. Some cross a whole continent to winter in the mountains.', 5); }
}
function drawMonarchs(ctx, G, P) {
  const E = G.enc; if (!E.mon.length) return;
  const orange = mix(P.monarch, P.paper, .05), ink = P.birdFar;
  for (const m of E.mon) {
    const open = Math.abs(Math.sin(m.ph)), a = clamp(m.fade, 0, 1) * .95;
    ctx.fillStyle = C(orange, a); ctx.beginPath();
    ctx.ellipse(m.x - .3, m.y - 1.8 * open, 3, 2.1 * open + .4, -.5, 0, TAU);
    ctx.ellipse(m.x + 1.1, m.y + .3 + 1 * open, 2, 1.4 * open + .3, .4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C(ink, a * .9); ctx.fillRect(m.x - .9, m.y - .3, 2, .6);
    sight(G, 'monarch', m.x, m.y + 1, 9);
  }
}
function drawClusters(ctx, G, P) {
  if (!monarchsOut(G) || (G.tod > .3 && G.tod < .62)) return;
  ctx.fillStyle = C(P.monarch, .85); ctx.beginPath();
  for (const t of W.treesIn(G.cam.x - 40, G.cam.x + G.view.w + 40)) {
    if (!clusterTree(t)) continue;
    // hanging in clumps under the branches, close in to the trunk
    for (const br of t.branches) for (let j = 0; j < 7; j++) {
      const u = .3 + .6 * hash(t.i * 13 + j + br.f * 50), x = t.x + br.x1 * u + t.lean * -br.y0, y = t.y + br.y0 + (br.y1 - br.y0) * u + 1.5 + hash(t.i + j) * 3.5;
      ctx.moveTo(x + 1.3, y); ctx.ellipse(x, y, 1.3, 1.9, 0, 0, TAU);
    }
  }
  ctx.fill();
}

/* ---------- C5: the bear at the river ---------- */
// At some forest lakes a bear stands in the shallows where fish run, swiping them out of the
// air as they leap. What it drops on the bank is a meal for a hawk that lands beside it.
export const bearOf = p => {
  if (!p || W.frozen(p) || p.w < 45 || hash(p.k * 9.7 + 1) > .4) return null;
  const bio = W.biomeAt(p.c).name; if (bio !== 'forest' && bio !== 'lakeland' && bio !== 'cliffs') return null;
  const side = hash(p.k * 2.3) < .5 ? -1 : 1, x = side < 0 ? p.x0 + 9 : p.x1 - 9;
  return { k: p.k, x, y: p.waterY + 3, face: -side, side, grizzly: bio === 'cliffs' };
};
const bearOut = G => G.sea.winter < .4 && G.tod > .24 && G.tod < .8;
const LEAP = 3.6;
// scraps left on the bank beside the bear, gone once eaten (for the day)
export function scrapsIn(G, x0, x1) {
  const out = []; if (!bearOut(G)) return out;
  for (const p of W.pondsIn(x0, x1)) {
    const br = bearOf(p); if (!br) continue;
    for (let j = 0; j < 2; j++) {
      const x = br.x + br.side * (30 + j * 10), id = `sc${p.k}_${j}:${G.day}`;
      if (!G.eaten.has(id)) out.push({ id, x, y: W.groundY(Math.round(x)) });
    }
  }
  return out;
}
export function eatScrap(G, f, toast) { G.eaten.add(f.id); G.hunger = Math.min(100, G.hunger + 25); toast('Salmon left by the bear. A good meal.', 2); }
function updateBears(G, dt, { audio, once }) {
  if (!bearOut(G)) return;
  const b = G.bird;
  for (const p of W.pondsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
    const br = bearOf(p); if (!br) continue;
    if (Math.abs(br.x - b.x) < 160) { once('bear', 'A bear fishing the run, swiping salmon out of the air. Land on the bank beside it for the scraps.', 5); }
    const u = ((G.t + br.k * 1.7) % LEAP) / LEAP;
    if (Math.abs(br.x - b.x) < 220 && u < dt / LEAP * 1.2) sfx.splash(audio);
    if ((b.state === 'ground' || b.state === 'swim') && Math.abs(b.x - br.x) < 24 && !G.enc.woofT) { G.enc.woofT = 4; sfx.woof(audio); }
  }
  if (G.enc.woofT) G.enc.woofT = Math.max(0, G.enc.woofT - dt);
}
function drawBears(ctx, G, P) {
  if (!bearOut(G)) return;
  for (const p of W.pondsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
    const br = bearOf(p); if (!br) continue;
    const u = ((G.t + br.k * 1.7) % LEAP) / LEAP, swipe = u > .2 && u < .3;
    // a leaping fish: out of the water downstream, arcing up toward the bear
    if (u < .3) {
      const k = u / .3, fx = br.x + br.face * (44 - 30 * k), fy = p.waterY - Math.sin(k * Math.PI) * 30;
      if (k < .85 || !swipe) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(-br.face * (Math.PI / 2 - k * Math.PI) * .7); ctx.fillStyle = C(mix(P.water, [200, 120, 110], .55), .9); ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 1.3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    const col = br.grizzly ? mix(P.bear, P.deer, .35) : P.bear;
    ctx.save(); ctx.translate(br.x, br.y); ctx.scale(br.face * 1.6, 1.6);
    put(ctx, stamp('bear' + (swipe ? 1 : 0) + (br.grizzly ? 'g' : ''), col.join(), -16, -26, 18, 2, G.view.spx * 1.3, c => {
      const dk = shade(col, .7), pale = mix(col, P.ground, .3);
      // standing in the shallows, legs half in the water; head low, watching the current
      strokes(c, [[[-9, -8], [-9, 0]], [[-5, -8], [-5, 0]], [[5, -9], [5, 0]]], dk, .85, 2.8, 80);
      wash(c, ellP(-2, -13, 11.5, 6.2, -.08), col, .85, { passes: 2, amp: .6, seed: 81, rim: .45 });
      wash(c, ellP(5, -14.5, 6.5, 6, 0), col, .85, { passes: 1, amp: .5, seed: 87, rim: .35 });
      if (br.grizzly) wash(c, [[0, -19], [6, -21], [9, -17], [3, -15]], pale, .5, { passes: 1, amp: .5, seed: 82, rim: .3 });   // the grizzly's shoulder hump
      const hy = swipe ? -18 : -12;
      wash(c, ellP(13, hy, 4.4, 3.4, swipe ? -.2 : .5), col, .9, { passes: 2, amp: .3, seed: 83, rim: .4 });
      wash(c, ellP(16.4, hy + (swipe ? 0 : 1.6), 2.2, 1.6, .3), pale, .8, { passes: 1, amp: .2, seed: 84, rim: .3 });   // muzzle
      wash(c, circP(11.5, hy - 3.6, 1.3, 8), dk, .9, { passes: 1, amp: .1, seed: 85, rim: 0 });   // ear
      c.fillStyle = C(P.birdFar); c.beginPath(); c.arc(14.6, hy - 1, .55, 0, TAU); c.fill();
      // the front paw: down in the water, or raised to swipe
      stroke(c, swipe ? [[8, -14], [13, -20], [16, -21]] : [[8, -9], [9, 0]], dk, .9, 2.8, 86);
    }));
    ctx.restore();
    sight(G, br.grizzly ? 'grizzly' : 'bear', br.x + br.face * 4, br.y - 12, 30);
    // the water laps round its legs
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(shade(P.water, .75), .45); ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(br.x, p.waterY + .5, 20 + Math.sin(G.t * 2) * 1.5, 1.4, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  for (const s of scrapsIn(G, G.cam.x - 40, G.cam.x + G.view.w + 40)) {
    ctx.fillStyle = C(mix([196, 110, 100], P.paper, .1), .9); ctx.beginPath(); ctx.ellipse(s.x, s.y - 1, 2.6, 1.1, .3, 0, TAU); ctx.fill();
    ctx.fillStyle = C(mix(P.water, [200, 200, 205], .5), .85); ctx.beginPath(); ctx.ellipse(s.x - 2, s.y - 1, 1.2, .9, 0, 0, TAU); ctx.fill();
  }
}

/* ---------- C6: your chick, grown ---------- */
// At the end of a journey a fledgling goes its own way. On a later one a wild hawk with its
// markings comes by, circles once with you, and leaves.
const MORPHS = ['light', 'dark', 'rufous'];
export const morphOf = n => n.morph ?? (n.morph = MORPHS[Math.floor(hash((n.x || 0) * .37 + (n.y || 0)) * 3)]);
function updateGrown(G, dt, { toast, once, store, makeHawk, audio }) {
  const E = G.enc, b = G.bird;
  if (E.lastJ === null) E.lastJ = G.journeys;
  if (G.journeys > E.lastJ) {
    E.lastJ = G.journeys;
    // the young one leaves you at a journey's end
    const young = G.hawks.find(h => h.kind === 'young');
    if (G.nest?.fledged) {
      E.chicks.push({ morph: morphOf(G.nest), j: G.journeys, place: G.nest.place, day: G.day });
      store.set('chicks', E.chicks); G.nest = null;
      if (young) Object.assign(young, { kind: 'grown', life: 30, scale: .98, adult: true, morph: E.chicks.at(-1).morph });
      toast('Your young hawk is grown, and goes its own way. Perhaps you will meet again.', 5);
    }
  }
  if (E.grown) return;
  const c = E.chicks.find(c => G.journeys > c.j);
  if (!c || E.met === G.journeys || b.state !== 'fly' || !day(G) || groundUp(G, b) < 60) return;
  if ((E.grownT -= dt) > 0) return;
  E.grownT = 40;
  if (Math.random() > .2) return;
  const h = makeHawk(b.x - b.face * 220, b.y - 80, 'grown'); Object.assign(h, { morph: c.morph, scale: .98, adult: true });
  G.hawks.push(h); E.grown = h; E.met = G.journeys; store.set('grownMet', E.met);
  audio.scream?.(true);
  toast(`A red-tail with your chick's ${c.morph} markings. Grown now, it circles once with you, then goes its own way.`, 6);
}

/* ---------- the hooks the game calls ---------- */
export function updateEncounters(G, dt, deps) {
  G.enc.deps = deps;
  updateMob(G, dt, deps); updateEagle(G, dt, deps); updateBison(G, dt, deps); updateMonarchs(G, dt, deps); updateBears(G, dt, deps); updateGrown(G, dt, deps);
  if (G.enc.grown && !G.hawks.includes(G.enc.grown)) G.enc.grown = null;
}
// on the land, among the trees and fauna
export function drawEncountersGround(ctx, G, P) { drawBison(ctx, G, P); drawBears(ctx, G, P); drawClusters(ctx, G, P); }
// in the air, with the other flying birds
export function drawEncountersAir(ctx, G, P, smallBird) { drawMonarchs(ctx, G, P); drawMob(ctx, G, P, smallBird); drawEagle(ctx, G, P); }

// a grown hawk keeps your chick's markings: pale, dark or rufous red-tail colour morphs
const morphPals = new Map();
export function morphPal(P, morph) {
  const k = morph; let e = morphPals.get(k);
  if (e && e.src === P) return e.pal;
  let pal;
  if (morph === 'dark') pal = { ...P, bird: shade(P.bird, .62), birdWing: shade(P.birdWing, .65), birdPale: shade(mix(P.birdPale, P.bird, .7), .85) };
  else if (morph === 'rufous') pal = { ...P, birdPale: mix(P.birdPale, P.tail, .5), bird: mix(P.bird, P.tail, .3) };
  else pal = { ...P, bird: mix(P.bird, P.birdPale, .32), birdPale: mix(P.birdPale, P.paper, .45) };
  morphPals.set(k, { src: P, pal });
  return pal;
}

// for the console and screenshot scripts
export function encDebug(G, { fresh, snap }) {
  const b = G.bird, E = G.enc, fly = (x, y, s = 70) => { fresh(); b.state = 'fly'; b.x = x; b.y = y; b.s = s; b.g = -.1; snap(); };
  return {
    mob() { const t = W.treesIn(b.x, b.x + 30000).find(nestTree); E.mobT = 0; fly(t.x - 30, t.y - 60); return t; },
    eagle() { const p = W.pondsIn(b.x, b.x + 40000).find(p => p.lake || p.w > 48); fly(p.c, p.waterY - 60, 60); G.carry = null; E.eagle = null; caughtFish(G, p, true); return E.eagle; },
    bison() { for (let x = b.x; x < b.x + 80000; x += HC) { const h = herdsIn(x, x + HC)[0]; if (h) { fly(h.x - 60, W.groundY(h.x) - 30); return h; } } },
    monarchs() { E.mon = []; return E; },
    bear() { const p = W.pondsIn(b.x, b.x + 80000).find(p => bearOf(p)); const br = bearOf(p); fly(br.x - br.face * 70, br.y - 50, 40); return br; },
    grown(morph = 'rufous') { E.chicks.push({ morph, j: -1 }); E.met = -9; E.grownT = 0; const r = Math.random; Math.random = () => 0; updateGrown(G, 0, E.deps); Math.random = r; return E.grown; },
  };
}
