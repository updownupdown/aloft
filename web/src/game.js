// Game state, systems and the main loop.
import { TAU, clamp, lerp, hash, fbm, C, shade } from './util.js';
import { wash, circP, lift, makePaper } from './paint.js';
import { palette } from './palette.js';
import * as W from './world.js';
import { createBird, updateBird, flap, perchOn } from './bird.js';
import { createInput, readInput } from './input.js';
import { createAudio } from './audio.js';
import { SPECIES } from './songs.js';
import { render } from './render.js';
import { createUI } from './ui.js';

const DAY = 480;               // one day = 8 minutes
const THIRST_S = 180;          // full to empty in 3 minutes
const HUNGER_S = 300;          // full to empty in 5 minutes
const BERRY_REGROW = 120;
const RING_RESPAWN = 90;

const store = {
  get(k, d) { try { const v = localStorage.getItem('aloft.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aloft.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export function start(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const audio = createAudio();
  audio.on = store.get('sound', true);

  const G = {
    t: 0, dt: 0, view: { w: 480, h: 270, s: 1 }, cam: { x: 0, y: 0 }, camGround: 0,
    clockT: 0, tod: .36, P: null,
    bird: createBird(0, -150),
    wind: 0, flapPower: 1,
    weather: 'sunny', weatherT: 90, overcast: 0, storm: 0, rain: 0, wet: 0, rainId: 0, flash: 0, cloudDrift: 0, nextBolt: 5,
    thirst: 100, hunger: 100, score: store.get('score', 0),
    eaten: new Set(), berries: new Map(), ringsTaken: new Map(), visibleRings: [],
    parts: [], flocks: [], nearBirds: [], nextFlock: 4, nextNear: 12,
    staff: { species: null, tree: null, tries: [], lastTry: 0, wrongT: 0, singIdx: -1, doneT: 0 },
    learned: new Set(store.get('learned', [])),
    seen: new Set(), hint: null, paused: false, pendingEat: null,
  };
  G.bird.s = 85;
  G.emit = (type, d = {}) => events[type]?.(d);
  G.berryGone = id => G.berries.has(id) && G.t - G.berries.get(id) < BERRY_REGROW;
  G.passRings = (px, py, x, y) => {
    for (const r of G.visibleRings) {
      if (r.gone || (px - r.x) * (x - r.x) > 0 || px === x) continue;
      const yy = lerp(py, y, (r.x - px) / (x - px));
      if (Math.abs(yy - r.y) < r.r * .8) {
        G.ringsTaken.set(r.id, G.t); r.gone = true; G.score++; store.set('score', G.score);
        audio.ring(); for (let i = 0; i < 10; i++) spark(r.x, r.y + (Math.random() - .5) * r.r * 2);
        once('ring', 'Ring! Fly through more high in the thermals.');
      }
    }
  };

  const ui = createUI({
    audio, G, store, species: SPECIES,
    onPause: p => { G.paused = p; },
    playSong: sp => sp.notes.forEach((n, i) => setTimeout(() => audio.note(n, sp.voice), i * sp.gap * 1000)),
  });
  input.onAny = () => audio.unlock();
  input.onKey = k => { if (k === 'Escape' || k === 'KeyP') ui.toggle(); if (k === 'KeyE') interact(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && !G.paused) ui.open(); });

  /* ---------- events from the bird ---------- */
  const part = (type, x, y, vx, vy, life, extra = {}) => G.parts.push({ type, x, y, vx, vy, life, max: life, ...extra });
  const spark = (x, y) => part('spark', x, y, (Math.random() - .5) * 30, (Math.random() - .5) * 30, .7);
  const events = {
    flap: () => audio.flap(),
    splash: ({ x, y, big }) => {
      audio.splash(big);
      for (let i = 0; i < (big ? 16 : 8); i++) part('drop', x, y, (Math.random() - .5) * 60, -30 - Math.random() * 50, .7);
      part('ripple', x, y + 1, 0, 0, 1.2);
    },
    crash: ({ x, y }) => {
      audio.thump();
      for (let i = 0; i < 6; i++) part('puff', x + (Math.random() - .5) * 8, y - 2, (Math.random() - .5) * 20, -10, .8);
      for (let i = 0; i < 3; i++) part('feather', x, y - 6, (Math.random() - .5) * 30, -20, 1.6, { a: Math.random() * TAU });
      once('crash', 'Too fast! Pull up and slow down before you touch the ground.');
    },
    land: ({ kind }) => {
      if (kind === 'perch') { audio.rustle(); once('perch', 'Perched. Tap to take off, or point down to glide off the branch.'); }
      if (kind === 'ground') { audio.thump(); once('ground', 'On the ground. Hold left or right to walk. Tap to take off.'); }
      if (kind === 'swim') once('swim', 'Swimming. Tap the water to drink. Three sips fill you up.');
    },
  };
  const hintsSeen = new Set(store.get('hints', []));
  function once(key, text) { if (hintsSeen.has(key)) return; hintsSeen.add(key); store.set('hints', [...hintsSeen]); ui.toast(text); }

  /* ---------- taps ---------- */
  function toWorld(p) { return { x: G.cam.x + p.x / G.view.s, y: G.cam.y + p.y / G.view.s, lx: p.x / G.view.s, ly: p.y / G.view.s }; }
  function nearestPerch(wx, wy, r) {
    let best = null, bd = r;
    for (const t of W.treesIn(wx - 60, wx + 60)) for (const p of t.perches) {
      if (p.occupied) continue; const d = Math.hypot(p.x - wx, p.y - 3 - wy); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function foodAt(wx, wy, r) {
    let best = null, bd = r;
    if (G.wet > .25) for (const wm of W.wormsIn(wx - 30, wx + 30)) { if (G.eaten.has(wm.id + G.rainId)) continue; const d = Math.hypot(wm.x - wx, wm.y - 3 - wy); if (d < bd) { bd = d; best = { kind: 'worm', id: wm.id + G.rainId, x: wm.x }; } }
    for (const b of W.bushesIn(wx - 30, wx + 30)) for (const be of b.berries) { if (G.berryGone(be.id)) continue; const d = Math.hypot(be.x - wx, be.y - wy); if (d < bd) { bd = d; best = { kind: 'berry', id: be.id, x: be.x }; } }
    return best;
  }
  function drink() {
    const b = G.bird; if (G.thirst >= 99.5) { ui.toast('Not thirsty right now.', 1.5); return; }
    G.thirst = Math.min(100, G.thirst + 100 / 3); b.peckT = .35; audio.drink();
    part('ripple', b.x + b.face * 9, (W.waterAt(b.x + b.face * 6) ?? b.y + 3), 0, 0, 1);
  }
  function eat(f) {
    const b = G.bird; b.peckT = .35; audio.eat();
    if (f.kind === 'worm') { G.eaten.add(f.id); G.hunger = Math.min(100, G.hunger + 100 / 3); }
    else { G.berries.set(f.id, G.t); G.hunger = Math.min(100, G.hunger + 100 / 6); }
  }
  function nearWater(b) { for (const dx of [0, 8, -8, 14, -14]) if (W.waterAt(b.x + dx) !== null) return true; return false; }
  function interact() {
    const b = G.bird;
    if (b.state === 'swim' || (b.state === 'ground' && nearWater(b))) { drink(); return; }
    if (b.state === 'ground') { const f = foodAt(b.x + b.face * 8, b.y, 40); if (f) { if (Math.abs(f.x - b.x) < 12) eat(f); else { b.walkTo = f.x - b.face * 6; G.pendingEat = f; } } }
  }
  function onTap(p) {
    const b = G.bird, w = toWorld(p);
    if (staffHit(w.lx, w.ly)) return;
    // water: drink while swimming or standing at the edge
    if ((b.state === 'swim' || (b.state === 'ground' && nearWater(b))) && Math.abs(w.x - b.x) < 90) {
      const wy = W.waterAt(w.x);
      if (wy !== null && w.y > wy - 25 && w.y < wy + 30) { drink(); return; }
    }
    if (b.state === 'ground') {
      const f = foodAt(w.x, w.y, 13);
      if (f && Math.abs(f.x - b.x) < 180) {
        if (Math.abs(f.x - b.x) < 12) eat(f); else { b.walkTo = f.x - Math.sign(f.x - b.x) * 6; G.pendingEat = f; }
        return;
      }
    }
    const pr = nearestPerch(w.x, w.y, 16);
    if (pr && pr !== b.perch) {
      b.target = pr; once('tapperch', 'Heading for that branch. The hawk slows and lands if it can reach it.');
      if (b.state !== 'fly') { flap(b, G.flapPower, G); b.target = pr; }
      return;
    }
    b.target = null; flap(b, G.flapPower, G);
  }

  /* ---------- songs on the staff ---------- */
  const STAFF = { w: 200, h: 54 };
  function staffRect() { return { x: (G.view.w - STAFF.w) / 2, y: 8, w: STAFF.w, h: STAFF.h }; }
  const laneY = (r, lane) => r.y + 11 + (4 - lane) * 8;
  function staffHit(lx, ly) {
    const S = G.staff; if (!S.species) return false;
    const r = staffRect(); if (lx < r.x || lx > r.x + r.w || ly < r.y - 4 || ly > r.y + r.h + 4) return false;
    let lane = 0, bd = 1e9; for (let l = 0; l < 5; l++) { const d = Math.abs(ly - laneY(r, l)); if (d < bd) { bd = d; lane = l; } }
    const sp = SPECIES[S.species];
    audio.note(lane, sp.voice, .2);
    if (G.t - S.lastTry > 3 || S.wrongT > 0 || S.doneT > 0) { S.tries = []; S.wrongT = 0; S.doneT = 0; }
    S.lastTry = G.t;
    const i = S.tries.length; S.tries.push(lane);
    if (sp.notes[i] !== lane) S.wrongT = .9;
    else if (S.tries.length === sp.notes.length) {
      S.doneT = 2.5;
      if (!G.learned.has(sp.id)) {
        G.learned.add(sp.id); store.set('learned', [...G.learned]); audio.learned();
        ui.toast(`You learned the ${sp.name}'s song.`, 3); ui.refresh();
        for (let k = 0; k < 12; k++) spark(G.bird.x + (Math.random() - .5) * 20, G.bird.y - 10 + (Math.random() - .5) * 14);
      }
    }
    return true;
  }
  function updateSongs(dt) {
    const b = G.bird, S = G.staff;
    let near = null, nd = 95;
    const trees = W.treesIn(G.cam.x - 60, G.cam.x + G.view.w + 60);
    for (const t of trees) {
      const s = t.song; if (!s) continue;
      s.singingT = Math.max(0, (s.singingT || 0) - dt);
      s.next -= dt;
      const d = Math.hypot(s.perch.x - b.x, s.perch.y - b.y);
      if (s.next <= 0) {
        const sp = SPECIES[s.species]; s.next = 7 + hash(G.t) * 5; s.singingT = sp.notes.length * sp.gap + .2;
        const vol = .16 * clamp(1 - d / 320, 0, 1);
        sp.notes.forEach((n, i) => setTimeout(() => {
          if (G.paused) return;
          if (vol > .005) audio.note(n, sp.voice, vol);
          part('note', s.perch.x + 3, s.perch.y - 8, (hash(i + G.t) - .3) * 12, -16, 1.4, { col: shade(sp.cols.body, .8) });
          if (S.tree === t) S.singIdx = i;
        }, i * sp.gap * 1000));
        setTimeout(() => { if (S.tree === t) S.singIdx = -1; }, (sp.notes.length * sp.gap + .3) * 1000);
      }
      if (d < nd && b.state !== 'fly') { nd = d; near = t; }
    }
    if (near !== S.tree) { S.tree = near; S.species = near ? near.song.species : null; S.tries = []; S.singIdx = -1; if (near) once('song', 'A songbird! Listen, then tap the lines of the staff to sing its song back.'); }
    S.wrongT = Math.max(0, S.wrongT - dt); S.doneT = Math.max(0, S.doneT - dt);
    if (S.wrongT > 0 && S.wrongT - dt <= 0) S.tries = [];
  }
  function drawStaff() {
    const S = G.staff; if (!S.species) return;
    const sp = SPECIES[S.species], r = staffRect(), P = G.P;
    lift(ctx, [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], P.paper, .82);
    wash(ctx, [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], P.cloudShade, .18, { passes: 2, amp: 1.5, seed: 5, rim: .4 });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.birdFar, .55); ctx.lineWidth = .6;
    for (let l = 0; l < 5; l++) { ctx.beginPath(); ctx.moveTo(r.x + 30, laneY(r, l)); ctx.lineTo(r.x + r.w - 8, laneY(r, l)); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = C(P.birdFar, .8); ctx.font = '7px Georgia, serif'; ctx.textBaseline = 'middle';
    ctx.fillText(sp.name, r.x + 4, r.y + 12);
    ctx.fillStyle = C(P.birdFar, .55); ctx.font = '6px Georgia, serif';
    ctx.fillText(G.learned.has(sp.id) ? 'learned' : 'listen', r.x + 4, r.y + 22);
    const col = i => r.x + 44 + i * (r.w - 60) / Math.max(1, sp.notes.length - 1 || 1);
    sp.notes.forEach((n, i) => {
      const x = col(i), y = laneY(r, n), lit = S.singIdx === i;
      ctx.strokeStyle = C(lit ? sp.cols.breast : P.birdFar, lit ? .95 : .4); ctx.lineWidth = lit ? 1.6 : .8;
      ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.6, -.35, 0, TAU); ctx.stroke();
      if (lit) { ctx.fillStyle = C(sp.cols.breast, .7); ctx.fill(); }
    });
    S.tries.forEach((n, i) => {
      if (i >= sp.notes.length) return;
      const ok = sp.notes[i] === n, x = col(i) + 1, y = laneY(r, n);
      ctx.fillStyle = C(ok ? (S.doneT > 0 ? [60, 130, 70] : P.birdFar) : [180, 60, 50], .85);
      ctx.beginPath(); ctx.ellipse(x, y, 3, 2.3, -.35, 0, TAU); ctx.fill();
    });
  }

  /* ---------- HUD meters (painted on the canvas) ---------- */
  function drawHUD() {
    const P = G.P, x = 50 / G.view.s + 4, y = 9;
    const meter = (yy, v, col, icon) => {
      icon(x + 5, yy + 4);
      lift(ctx, [[x + 13, yy + 1], [x + 63, yy + 1], [x + 63, yy + 7], [x + 13, yy + 7]], P.paper, .6);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.birdFar, .35); ctx.lineWidth = .6; ctx.strokeRect(x + 13, yy + 1, 50, 6); ctx.restore();
      const low = v < 20 && Math.sin(G.t * 6) > 0;
      if (v > 0) wash(ctx, [[x + 13.5, yy + 1.5], [x + 13.5 + 49 * v / 100, yy + 1.5], [x + 13.5 + 49 * v / 100, yy + 6.5], [x + 13.5, yy + 6.5]], low ? [190, 70, 50] : col, .8, { passes: 2, amp: .5, seed: 3, rim: .3 });
    };
    meter(y, G.thirst, P.water, (cx, cy) => wash(ctx, [[cx, cy - 4.5], [cx + 3, cy + .5], [cx + 2, cy + 3], [cx - 2, cy + 3], [cx - 3, cy + .5]], P.water, .9, { passes: 2, amp: .3, seed: 1, rim: .4 }));
    meter(y + 11, G.hunger, P.berry, (cx, cy) => { wash(ctx, circP(cx - 1.5, cy + 1, 2.2, 8), P.berry, .9, { passes: 2, amp: .3, seed: 2, rim: .4 }); wash(ctx, circP(cx + 1.8, cy, 2.2, 8), P.berry, .9, { passes: 2, amp: .3, seed: 4, rim: .4 }); });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.ring, .8); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x + 5, y + 26, 1.8, 3.6, 0, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.fillStyle = C(P.birdFar, .75); ctx.font = '7px Georgia, serif'; ctx.textBaseline = 'middle'; ctx.fillText(String(G.score), x + 13, y + 26.5);
  }

  /* ---------- world systems ---------- */
  function updateWeather(dt) {
    G.weatherT -= dt;
    if (G.weatherT <= 0) {
      const r = Math.random(), prev = G.weather;
      G.weather = r < .6 ? 'sunny' : r < .87 ? 'cloudy' : 'stormy';
      G.weatherT = 70 + Math.random() * 80;
      if (G.weather === 'stormy' && prev !== 'stormy') G.rainId++;
    }
    const tgt = { sunny: [0, 0], cloudy: [.65, 0], stormy: [1, 1] }[G.weather];
    G.overcast += clamp(tgt[0] - G.overcast, -dt / 15, dt / 15);
    G.storm += clamp(tgt[1] - G.storm, -dt / 15, dt / 15);
    G.rain = clamp((G.storm - .35) / .5, 0, 1);
    G.wet = clamp(G.wet + (G.rain > .1 ? dt / 20 * G.rain : -dt / 100), 0, 1);
    G.wind = 6 * Math.sin(G.t * .05) + G.storm * 34 * fbm(G.t * .15, 30);
    G.cloudDrift += dt * (2.5 + G.wind * .2);
    G.flash = Math.max(0, G.flash - dt * 3);
    if (G.storm > .75) { G.nextBolt -= dt; if (G.nextBolt <= 0) { G.flash = 1; G.nextBolt = 6 + Math.random() * 12; audio.thunder(.4 + Math.random() * 1.4); } }
    if (G.rain > .3 && G.wet > .25) once('worms', 'Rain brings worms up. Land on open ground after rain and tap them to eat.');
  }
  function updateCritters(dt) {
    const { w, h } = G.view, camDx = G.cam.x - (G.lastCamX ?? G.cam.x); G.lastCamX = G.cam.x;
    if ((G.nextFlock -= dt) <= 0) {
      G.nextFlock = 18 + Math.random() * 25; const dir = Math.random() < .5 ? 1 : -1;
      G.flocks.push({ x: dir > 0 ? -60 : w + 20, y: 25 + Math.random() * h * .3, dir, n: 3 + (Math.random() * 4 | 0), s: .7 + Math.random() * .5, v: 9 + Math.random() * 8 });
    }
    for (const f of G.flocks) f.x += f.dir * f.v * dt - camDx * .15;
    G.flocks = G.flocks.filter(f => f.x > -120 && f.x < w + 120);
    if ((G.nextNear -= dt) <= 0) {
      G.nextNear = 15 + Math.random() * 25; const dir = Math.random() < .5 ? 1 : -1, n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) G.nearBirds.push({ x: dir > 0 ? -30 - i * 22 : w + 30 + i * 22, y: h * (.3 + Math.random() * .4), y0: 0, dir, v: 120 + Math.random() * 40, ph: Math.random() * TAU, seed: i + (Math.random() * 99 | 0), col: SPECIES[(Math.random() * SPECIES.length) | 0].cols.body });
    }
    for (const n of G.nearBirds) { n.x += n.dir * n.v * dt - camDx * 1.3; n.ph += dt * 22; n.y += Math.sin(G.t * 4 + n.seed) * 20 * dt; }
    G.nearBirds = G.nearBirds.filter(n => n.x > -100 && n.x < w + 100);
    for (const p of G.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'drop' || p.type === 'feather') p.vy += (p.type === 'drop' ? 160 : 15) * dt;
      if (p.type === 'feather') { p.vx *= .98; p.a += dt * 2; }
    }
    G.parts = G.parts.filter(p => p.life > 0);
  }
  function updateCamera(dt, snap) {
    const b = G.bird, { w, h } = G.view;
    const lead = b.state === 'fly' ? b.face * w * .14 : 0;
    const tx = b.x + lead - w / 2;
    const gAhead = Math.max(W.groundY(b.x), W.groundY(b.x + lead));
    let ty = b.y - h * .52;
    ty = Math.min(ty, gAhead - h * .82);           // keep the ground near the bottom
    ty = Math.max(ty, W.CEILING - 100);
    const k = snap ? 1 : Math.min(1, dt * 2.6);
    G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * Math.min(1, k * 1.4);
    const cg = W.groundY(G.cam.x + w / 2) - h * .82;
    G.camGround = snap ? cg : G.camGround + (cg - G.camGround) * Math.min(1, dt * 1.5);
  }

  function step(dt) {
    G.t += dt; G.dt = dt;
    G.clockT += dt; G.tod = (.36 + G.clockT / DAY) % 1;
    const raw = readInput(input), b = G.bird;
    for (const tp of raw.taps) onTap(tp);
    for (let i = 0; i < raw.flaps; i++) { b.target = null; flap(b, G.flapPower, G); }
    let steer = null;
    if (raw.steer) { const w = toWorld(raw.steer); steer = { wx: w.x, wy: w.y }; }
    updateBird(b, dt, { steer, pitch: raw.pitch, face: raw.face }, G);
    if (G.pendingEat && b.state === 'ground' && b.walkTo === null) { if (Math.abs(G.pendingEat.x - b.x) < 14) eat(G.pendingEat); G.pendingEat = null; }
    if (b.state !== 'ground') G.pendingEat = null;
    if (b.circling) once('thermal', 'A thermal. Let go and the hawk circles upward on the warm air.');

    G.thirst = Math.max(0, G.thirst - dt * 100 / THIRST_S);
    G.hunger = Math.max(0, G.hunger - dt * 100 / HUNGER_S);
    G.flapPower = .5 + .25 * (G.thirst > 0) + .25 * (G.hunger > 0);
    if (G.thirst < 25) once('thirsty', 'Thirsty. Find a pond and land on the water to drink.');
    if (G.hunger < 25) once('hungry', 'Hungry. Bushes have berries, and worms come up after rain.');
    G.hint = b.target;

    updateWeather(dt); updateCritters(dt); updateSongs(dt); updateCamera(dt);
    const vr = [];
    for (const t of W.thermalsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) for (const r of t.rings) {
      const tk = G.ringsTaken.get(r.id); r.gone = tk !== undefined && G.t - tk < RING_RESPAWN; vr.push(r);
    }
    G.visibleRings = vr;
    audio.ambience(b.state === 'fly' ? clamp(b.s / 200, 0, 1) * .8 + G.storm * .3 : G.storm * .4, G.rain);
  }

  /* ---------- sizing and loop ---------- */
  function resize() {
    const cw = innerWidth, ch = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    let s = ch / 300; if (cw / s < 420) s = cw / 420;   // css px per world unit
    const pxCap = Math.min(dpr, 1600 / Math.max(cw, ch)); // cap the backing store: washes are fill-rate heavy
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * pxCap); canvas.height = Math.round(ch * pxCap);
    G.view = { w: cw / s, h: ch / s, s, px: pxCap * s };
    makePaper(G.view.w, G.view.h);
  }
  addEventListener('resize', resize); resize();
  G.P = palette(G.tod, 0, 0);
  updateCamera(0, true);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!G.paused) step(dt);
    G.P = palette(G.tod, G.overcast, G.storm);
    ctx.setTransform(G.view.px, 0, 0, G.view.px, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    render(ctx, G);
    drawHUD(); drawStaff();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  ui.toast('Tap to flap. Press and hold to point the hawk where you want to go.', 6);
  if (innerHeight > innerWidth) ui.toast('Turn your phone sideways for a wider view.', 4);
  // handy for poking at state from the console, and for screenshot scripts
  const b = G.bird, snap = () => updateCamera(0, true);
  const fresh = () => { b.perch = null; b.target = null; b.walkTo = null; b.s = 0; b.g = 0; };
  G.dbg = {
    treeWithSong() { for (let x = b.x; x < b.x + 20000; x += 200) for (const t of W.treesIn(x, x + 200)) if (t.song) return t; },
    pond() { return W.pondsIn(b.x, b.x + 5000)[0]; },
    trees: W.treesIn, bushes: W.bushesIn,
    staffPts() { const r = staffRect(), sp = SPECIES[G.staff.species]; return sp.notes.map(n => [(r.x + 100) * G.view.s, laneY(r, n) * G.view.s]); },
    perch(q) { fresh(); perchOn(b, q, G); snap(); },
    swim(p) { fresh(); b.x = p.c; b.y = p.waterY - 3; b.state = 'swim'; snap(); },
    ground() { fresh(); const bu = W.bushesIn(b.x, b.x + 5000)[0]; b.x = bu.x + 16; b.y = W.groundY(b.x) - 6; b.state = 'ground'; b.face = -1; snap(); },
    fly(y) { fresh(); b.state = 'fly'; b.y = y; b.s = 85; b.g = -.17; snap(); },
    thermal() { const t = W.thermalsIn(b.x + 200, b.x + 3000).find(t => t.rings.length); fresh(); b.state = 'fly'; b.x = t.c - 60; b.y = t.rings[0].y + 10; b.s = 85; snap(); },
  };
  window.__aloft = G;
  return G;
}
