// Game state, systems and the main loop.
import { TAU, clamp, lerp, hash, fbm, C, shade } from './util.js';
import { wash, circP, lift, makePaper } from './paint.js';
import { palette, seasonAmounts, nightness } from './palette.js';
import * as W from './world.js';
import { createBird, updateBird, flap, perchOn, predictGlide, FEET } from './bird.js';
import { applyTune } from './tune.js';
import { createInput, readInput } from './input.js';
import { createAudio } from './audio.js';
import { SPECIES, speciesFor, active, timeOfDay } from './songs.js';
import { render } from './render.js';
import { createUI } from './ui.js';
import { mousePos, fishPos, updateFlock, callVisitor, updateVisitor, makeHawk, updateHawk } from './life.js';
import { loadJourney, saveJourney, updateJourney, journal, drawMap, placeNote, atPerch, updateNest, seasonName, NEST_TWIGS } from './journey.js';
import { createMusic } from './music.js';
import { createPhoto } from './photo.js';

const DAY = 480;               // one day = 8 minutes
const THIRST_S = 180;          // full to empty in 3 minutes
const HUNGER_S = 300;          // full to empty in 5 minutes
const BERRY_REGROW = 120;
const RING_RESPAWN = 90;
const TWIG_REGROW = 300;
const POWER_CD = 40;           // seconds before a song's gift works again

const store = {
  get(k, d) { try { const v = localStorage.getItem('aloft.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aloft.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export function start(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const audio = createAudio();
  audio.on = store.get('sound', true);
  applyTune(store.get('tune', {}));

  const G = {
    t: 0, dt: 0, view: { w: 480, h: 270, s: 1 }, cam: { x: 0, y: 0 }, camGround: 0,
    clockT: 0, tod: .36, day: 1, seasonS: 0, sea: seasonAmounts(0), P: null,
    bird: createBird(W.START_X, -150),
    wind: 0, flapPower: 1,
    weather: 'sunny', weatherT: 90, overcast: 0, storm: 0, rain: 0, wet: 0, rainId: 0, flash: 0, cloudDrift: 0, nextBolt: 5,
    thirst: 100, hunger: 100, score: store.get('score', 0),
    eaten: new Set(), berries: new Map(), ringsTaken: new Map(), twigsTaken: new Map(), visibleRings: [],
    parts: [], flocks: [], nearBirds: [], nextFlock: 4, nextNear: 12,
    boids: [], flockGoal: null, nextBoids: 10, scatterT: 0, hawks: [], visitor: null,
    staff: { mode: null, species: null, tree: null, tries: [], lastTry: 0, wrongT: 0, singIdx: -1, doneT: 0, sang: null },
    learned: new Set(store.get('learned', [])),
    hint: null, paused: false, pendingEat: null, carry: null, perchT: 0, roostT: 0, roost: null,
    // song gifts
    powerCD: {}, wormsT: 0, followT: 0, calmT: 0, tailwindT: 0, tailDir: 1, brightT: 0, ripen: null,
    thermalK: 1, streaks: [], glide: null, photo: false,
    settings: { glide: store.get('glide', true), music: store.get('music', true) },
  };
  const saved = loadJourney(G, store);
  const b = G.bird;
  if (saved) { b.x = saved.x; G.clockT = saved.clockT; G.thirst = saved.thirst; G.hunger = saved.hunger; }
  b.y = Math.min(saved?.y ?? -1e9, W.groundY(b.x) - 120) ; if (b.y < W.CEILING + 100) b.y = W.groundY(b.x) - 150;
  b.s = 85;
  if (G.nest?.fledged) G.hawks.push(makeHawk(b.x - 60, b.y - 20, 'young'));

  G.emit = (type, d = {}) => events[type]?.(d);
  G.berryGone = id => G.berries.has(id) && G.t - G.berries.get(id) < BERRY_REGROW;
  // in winter only the hardy bushes keep their berries, unless a wren's song ripened them
  G.berryOk = (bu, be) => !G.berryGone(be.id) && (G.sea.winter < .5 || bu.hardy || (G.ripen && G.t - G.ripen.t < 120 && Math.abs(bu.x - G.ripen.x) < 320));
  G.wormsOk = () => (G.wet > .25 && G.sea.winter < .5) || G.wormsT > 0;
  G.twigGone = id => G.twigsTaken.has(id) && G.t - G.twigsTaken.get(id) < TWIG_REGROW;
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

  const music = createMusic(audio);
  music.on = G.settings.music;
  const playSong = sp => sp.notes.forEach((n, i) => setTimeout(() => audio.note(n, sp.voice), i * sp.gap * 1000));
  const ui = createUI({
    audio, G, store, species: SPECIES,
    onPause: p => { G.paused = p; if (!p) readInput(input); },
    playSong,
    hooks: {
      music: on => music.setOn(on),
      photo: () => photo.begin(),
      journal: () => journal(G, DAY),
      drawMap: cv => drawMap(G, cv),
      newGame: () => { store.set('save', null); G.noSave = true; location.reload(); },
      subtitle: () => `Paused. Day ${G.day}, ${seasonName(G)}.`,
    },
  });
  const photo = createPhoto({ canvas, G, ui, onEnd: () => { readInput(input); G.paused = false; } });
  input.onAny = () => audio.unlock();
  input.onKey = k => {
    if (G.photo) { if (k === 'Escape') photo.end(); return; }
    if (k === 'Escape' || k === 'KeyP') ui.toggle(); if (k === 'KeyE') interact();
  };
  const persist = () => { if (!G.noSave) saveJourney(G, store); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); if (!G.paused) ui.open(); } });
  addEventListener('pagehide', persist);

  /* ---------- events from the bird ---------- */
  const part = (type, x, y, vx, vy, life, extra = {}) => G.parts.push({ type, x, y, vx, vy, life, max: life, ...extra });
  const spark = (x, y) => part('spark', x, y, (Math.random() - .5) * 30, (Math.random() - .5) * 30, .7);
  const puff = (x, y, n = 6) => { for (let i = 0; i < n; i++) part('puff', x + (Math.random() - .5) * 8, y - 2, (Math.random() - .5) * 20, -10, .8); };
  const events = {
    flap: () => audio.flap(),
    splash: ({ x, y, big }) => {
      audio.splash(big);
      for (let i = 0; i < (big ? 16 : 8); i++) part('drop', x, y, (Math.random() - .5) * 60, -30 - Math.random() * 50, .7);
      part('ripple', x, y + 1, 0, 0, 1.2);
    },
    crash: ({ x, y }) => {
      audio.thump(); puff(x, y);
      for (let i = 0; i < 3; i++) part('feather', x, y - 6, (Math.random() - .5) * 30, -20, 1.6, { a: Math.random() * TAU });
      once('crash', 'Too fast! Pull up and slow down before you touch the ground.');
    },
    land: ({ kind }) => {
      if (kind === 'perch') {
        audio.rustle(); once('perch', 'Perched. Tap to take off, or point down to glide off the branch.');
        atPerch(G, b.perch, { toast: ui.toast, once, audio, spark });
      }
      if (kind === 'ground') { audio.thump(); once('ground', 'On the ground. Hold left or right to walk. Tap to take off.'); }
      if (kind === 'swim') once('swim', 'Swimming. Tap the water to drink. Three sips fill you up.');
    },
  };
  const hintsSeen = new Set(store.get('hints', []));
  function once(key, text, secs) { if (hintsSeen.has(key)) return; hintsSeen.add(key); store.set('hints', [...hintsSeen]); ui.toast(text, secs); }

  /* ---------- hunting: a dive that reaches a mouse or a fish ---------- */
  G.catchPrey = h => {
    if (h.g > -.15 || h.s < 50) return false;
    const gy = W.groundY(h.x), wy = W.waterAt(h.x);
    let got = null;
    if (wy !== null) {
      if (h.y + 3 < wy - 4) return false;
      const p = W.pondNear(h.x, 1);
      if (p) for (const f of p.fish) {
        if (G.eaten.has(f.id + ':' + G.day)) continue;
        const q = fishPos(f, p, G.t); if (Math.abs(q.x - h.x) < 15) { got = { kind: 'fish', id: f.id }; break; }
      }
    } else {
      if (h.y + FEET < gy - 7) return false;
      for (const m of W.miceIn(h.x - 30, h.x + 30)) {
        if (G.eaten.has(m.id + ':' + G.day)) continue;
        const q = mousePos(m, G.t); if (q.show > .3 && Math.abs(q.x - h.x) < 12) { got = { kind: 'mouse', id: m.id }; break; }
      }
    }
    if (!got) return false;
    G.eaten.add(got.id + ':' + G.day);
    h.y = Math.min(h.y, (wy ?? gy) - FEET - 4); h.g = .5; h.s = Math.max(62, h.s * .7); h.kick = -18;
    if (got.kind === 'fish') events.splash({ x: h.x, y: wy, big: true }); else { audio.thump(); puff(h.x, gy, 4); }
    if (G.nest?.chick && !G.carry && G.hunger >= 30) {
      G.carry = got.kind; audio.rustle();
      ui.toast(`Caught a ${got.kind}! Carry it to your nest for the chick.`, 3);
    } else {
      G.hunger = Math.min(100, G.hunger + (got.kind === 'fish' ? 40 : 50)); audio.eat();
      ui.toast(`Caught a ${got.kind}!`, 1.8);
    }
    return true;
  };

  /* ---------- taps ---------- */
  function toWorld(p) { return { x: G.cam.x + p.x / G.view.s, y: G.cam.y + p.y / G.view.s, lx: p.x / G.view.s, ly: p.y / G.view.s }; }
  function nearestPerch(wx, wy, r) {
    let best = null, bd = r;
    for (const p of W.perchesIn(wx - 60, wx + 60)) {
      if (p.occupied) continue; const d = Math.hypot(p.x - wx, p.y - 3 - wy); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function foodAt(wx, wy, r) {
    let best = null, bd = r;
    const consider = (x, y, f) => { const d = Math.hypot(x - wx, y - wy); if (d < bd) { bd = d; best = f; } };
    if (G.wormsOk()) for (const wm of W.wormsIn(wx - 30, wx + 30)) if (!G.eaten.has(wm.id + G.rainId)) consider(wm.x, wm.y - 3, { kind: 'worm', id: wm.id + G.rainId, x: wm.x });
    for (const bu of W.bushesIn(wx - 30, wx + 30)) for (const be of bu.berries) if (G.berryOk(bu, be)) consider(be.x, be.y, { kind: 'berry', id: be.id, x: be.x });
    if (!G.carry && !(G.nest && G.nest.twigs >= NEST_TWIGS)) for (const tw of W.twigsIn(wx - 30, wx + 30)) if (!G.twigGone(tw.id)) consider(tw.x, tw.y - 2, { kind: 'twig', id: tw.id, x: tw.x });
    return best;
  }
  function drink() {
    if (G.thirst >= 99.5) { ui.toast('Not thirsty right now.', 1.5); return; }
    G.thirst = Math.min(100, G.thirst + 100 / 3); b.peckT = .35; audio.drink();
    part('ripple', b.x + b.face * 9, (W.waterAt(b.x + b.face * 6) ?? b.y + 3), 0, 0, 1);
  }
  function eat(f) {
    b.peckT = .35;
    if (f.kind === 'twig') {
      G.twigsTaken.set(f.id, G.t); G.carry = 'twig'; audio.rustle();
      once('twig', G.nest ? 'A twig. Carry it to your nest.' : 'You picked up a twig. Perch on a tree branch to start a nest there.');
      return;
    }
    audio.eat();
    if (f.kind === 'worm') { G.eaten.add(f.id); G.hunger = Math.min(100, G.hunger + 100 / 3); }
    else { G.berries.set(f.id, G.t); G.hunger = Math.min(100, G.hunger + 100 / 6); }
  }
  function nearWater() { for (const dx of [0, 8, -8, 14, -14]) if (W.waterAt(b.x + dx) !== null) return true; return false; }
  function interact() {
    if (b.state === 'swim' || (b.state === 'ground' && nearWater())) { drink(); return; }
    if (b.state === 'ground') { const f = foodAt(b.x + b.face * 8, b.y, 40); if (f) { if (Math.abs(f.x - b.x) < 12) eat(f); else { b.walkTo = f.x - b.face * 6; G.pendingEat = f; } } }
  }
  function onTap(p) {
    const w = toWorld(p);
    if (staffHit(w.lx, w.ly)) return;
    // water: drink while swimming or standing at the edge
    if ((b.state === 'swim' || (b.state === 'ground' && nearWater())) && Math.abs(w.x - b.x) < 90) {
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
  // learn mode: a songbird is near, listen and copy it. sing mode: perched with nobody
  // near, sing any song you know and that species answers, bringing its gift.
  const STAFF = { w: 200, h: 54 };
  function staffRect() { return { x: (G.view.w - STAFF.w) / 2, y: 8, w: STAFF.w, h: STAFF.h }; }
  const laneY = (r, lane) => r.y + 11 + (4 - lane) * 8;
  const PHRASE = { dawn: 'at dawn', day: 'in the daytime', dusk: 'at dusk', night: 'at night' };
  function sing(sp, perch, owner, vol = .16) {
    const d = Math.hypot(perch.x - b.x, perch.y - b.y), v = vol * clamp(1 - d / 320, 0, 1);
    owner.singingT = owner.singT = sp.notes.length * sp.gap + .2;
    sp.notes.forEach((n, i) => setTimeout(() => {
      if (G.paused && !G.photo) return;
      if (v > .005) audio.note(n, sp.voice, v);
      part('note', perch.x + 3, perch.y - 8, (hash(i + G.t) - .3) * 12, -16, 1.4, { col: shade(sp.cols.body, .8) });
      if (G.staff.tree && G.staff.tree.song === owner) G.staff.singIdx = i;
    }, i * sp.gap * 1000));
    setTimeout(() => { if (G.staff.tree?.song === owner) G.staff.singIdx = -1; }, (sp.notes.length * sp.gap + .3) * 1000);
  }
  function staffHit(lx, ly) {
    const S = G.staff; if (!S.mode) return false;
    const r = staffRect(); if (lx < r.x || lx > r.x + r.w || ly < r.y - 4 || ly > r.y + r.h + 4) return false;
    let lane = 0, bd = 1e9; for (let l = 0; l < 5; l++) { const d = Math.abs(ly - laneY(r, l)); if (d < bd) { bd = d; lane = l; } }
    const sp = S.mode === 'learn' ? SPECIES[S.species] : null;
    audio.note(lane, sp ? sp.voice : 1, .2);
    if (G.t - S.lastTry > 3 || S.wrongT > 0 || S.doneT > 0) { S.tries = []; S.wrongT = 0; S.doneT = 0; S.sang = null; }
    S.lastTry = G.t;
    const i = S.tries.length; S.tries.push(lane);
    if (sp) {
      if (sp.notes[i] !== lane) S.wrongT = .9;
      else if (S.tries.length === sp.notes.length) {
        S.doneT = 2.5;
        if (!G.learned.has(sp.id)) learn(sp);
        else respond(sp, S.tree);
      }
    } else {
      const fits = [...G.learned].map(id => SPECIES[id]).filter(s => S.tries.every((n, k) => s.notes[k] === n));
      const done = fits.find(s => s.notes.length === S.tries.length);
      if (!fits.length) S.wrongT = .9;
      else if (done) { S.doneT = 2.5; S.sang = done; respond(done, null); }
    }
    return true;
  }
  function learn(sp) {
    G.learned.add(sp.id); store.set('learned', [...G.learned]); audio.learned();
    G.songLog[sp.id] = `Learned on day ${G.day} ${PHRASE[timeOfDay(G.tod)]}, in ${placeNote(G, b.x)}`;
    store.set('songlog', G.songLog);
    ui.toast(`You learned the ${sp.name}'s song.`, 3);
    once('singback', 'Sing a song you know from any perch, and that bird answers with a gift.', 5);
    for (let k = 0; k < 12; k++) spark(b.x + (Math.random() - .5) * 20, b.y - 10 + (Math.random() - .5) * 14);
  }
  // call and response: the species answers, and its song does something
  function respond(sp, tree) {
    if (tree) setTimeout(() => { if (tree.song?.active) sing(sp, tree.song.perch, tree.song); }, 700);
    else callVisitor(G, sp);
    if ((G.powerCD[sp.id] ?? 0) > G.t) { ui.toast(`The ${sp.name} answers your song.`, 2.5); return; }
    G.powerCD[sp.id] = G.t + POWER_CD;
    usePower(sp);
    ui.toast(`The ${sp.name} answers: ${sp.power}.`, 3.5);
  }
  function usePower(sp) {
    switch (sp.powerKey) {
      case 'worms': G.wormsT = 45; G.rainId++; break;
      case 'flock': G.followT = 60; G.boids = []; break;
      case 'calm': G.calmT = 120; G.weather = 'sunny'; G.weatherT = 120; break;
      case 'ripen': {
        G.ripen = { x: b.x, t: G.t };
        for (const bu of W.bushesIn(b.x - 320, b.x + 320)) for (const be of bu.berries) G.berries.delete(be.id);
        break;
      }
      case 'companion': {
        const c = G.hawks.find(h => h.kind === 'companion');
        if (c) c.life = 0; else G.hawks.push(makeHawk(b.x - b.face * 220, b.y - 90, 'companion'));
        break;
      }
      case 'tailwind': G.tailwindT = 45; G.tailDir = b.face; break;
      case 'night': G.brightT = 90; break;
      case 'lark': b.stamina = 1; G.thirst = Math.min(100, G.thirst + 15); break;
    }
  }
  function updateSongs(dt) {
    const S = G.staff;
    let near = null, nd = 95;
    for (const t of W.treesIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
      const s = t.song; if (!s) continue;
      s.sp ??= speciesFor(t.bio, s.seed);
      const on = active(s.sp, G.tod, G.storm, G.sea.winter) && b.perch !== s.perch;
      if (on !== !!s.active) { s.active = on; s.perch.occupied = on; }
      if (!on) continue;
      s.singingT = Math.max(0, (s.singingT || 0) - dt);
      s.next -= dt;
      if (s.next <= 0) { s.next = 7 + hash(G.t) * 5; sing(s.sp, s.perch, s); }
      const d = Math.hypot(s.perch.x - b.x, s.perch.y - b.y);
      if (d < nd && b.state !== 'fly') { nd = d; near = t; }
    }
    if (G.visitor) G.visitor.singT = Math.max(0, (G.visitor.singT || 0) - dt);
    updateVisitor(G, dt, v => sing(v.sp, { x: v.x, y: v.y + 3.4 }, v));
    const mode = near ? 'learn' : b.state === 'perch' && G.learned.size && G.perchT > 1.2 ? 'sing' : null;
    if (mode !== S.mode || near !== S.tree) {
      S.mode = mode; S.tree = near; S.species = near ? near.song.sp.id : null; S.tries = []; S.singIdx = -1; S.sang = null;
      if (mode === 'learn') once('song', 'A songbird! Listen, then tap the lines of the staff to sing its song back.');
    }
    S.wrongT = Math.max(0, S.wrongT - dt); S.doneT = Math.max(0, S.doneT - dt);
    if (S.wrongT > 0 && S.wrongT - dt <= 0) S.tries = [];
  }
  function drawStaff() {
    const S = G.staff; if (!S.mode) return;
    const sp = S.mode === 'learn' ? SPECIES[S.species] : S.sang, r = staffRect(), P = G.P;
    const fade = S.mode === 'sing' ? .75 : 1;
    lift(ctx, [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], P.paper, .82 * fade);
    wash(ctx, [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], P.cloudShade, .18 * fade, { passes: 2, amp: 1.5, seed: 5, rim: .4 });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.birdFar, .55 * fade); ctx.lineWidth = .6;
    for (let l = 0; l < 5; l++) { ctx.beginPath(); ctx.moveTo(r.x + 30, laneY(r, l)); ctx.lineTo(r.x + r.w - 8, laneY(r, l)); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = C(P.birdFar, .8); ctx.font = '7px Georgia, serif'; ctx.textBaseline = 'middle';
    ctx.fillText(S.mode === 'learn' ? sp.name : sp && S.doneT > 0 ? sp.name : 'Sing', r.x + 4, r.y + 12);
    ctx.fillStyle = C(P.birdFar, .55); ctx.font = '6px Georgia, serif';
    ctx.fillText(S.mode === 'learn' ? (G.learned.has(sp.id) ? 'learned' : 'listen') : 'a song', r.x + 4, r.y + 22);
    if (S.mode === 'sing') ctx.fillText('you know', r.x + 4, r.y + 29);
    const cols = S.mode === 'learn' ? sp.notes.length : 7;
    const col = i => r.x + 44 + i * (r.w - 60) / Math.max(1, cols - 1);
    if (S.mode === 'learn') sp.notes.forEach((n, i) => {
      const x = col(i), y = laneY(r, n), lit = S.singIdx === i;
      ctx.strokeStyle = C(lit ? sp.cols.breast : P.birdFar, lit ? .95 : .4); ctx.lineWidth = lit ? 1.6 : .8;
      ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.6, -.35, 0, TAU); ctx.stroke();
      if (lit) { ctx.fillStyle = C(sp.cols.breast, .7); ctx.fill(); }
    });
    S.tries.forEach((n, i) => {
      if (i >= cols) return;
      const ok = S.mode === 'learn' ? sp.notes[i] === n : S.wrongT <= 0, x = col(i) + 1, y = laneY(r, n);
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

  /* ---------- wind streaks: paint flecks carried by the real air field ---------- */
  function updateStreaks(dt) {
    const { w, h } = G.view, want = 26 + Math.min(60, Math.abs(G.wind) * 2.2);
    while (G.streaks.length < want) G.streaks.push({ x: G.cam.x + Math.random() * w, y: G.cam.y + Math.random() * h, life: 0, max: 2 + Math.random() * 3, trail: [] });
    for (const s of G.streaks) {
      s.life += dt;
      s.x += W.windAt(s.y, s.x) * dt * 1.6; s.y -= W.updraft(s.x, s.y, G.t) * dt * 1.2;
      s.trail.push([s.x, s.y]); if (s.trail.length > 7) s.trail.shift();
    }
    G.streaks = G.streaks.filter(s => s.life < s.max && s.x > G.cam.x - 80 && s.x < G.cam.x + w + 80 && s.y > G.cam.y - 80 && s.y < G.cam.y + h + 80);
    if (G.streaks.length > want + 10) G.streaks.length = Math.floor(want);
  }

  /* ---------- world systems ---------- */
  function updateClock() {
    G.tod = (.36 + G.clockT / DAY) % 1;
    G.day = Math.floor(.36 + G.clockT / DAY) + 1;
    G.seasonS = (G.clockT / DAY / 2 + 3.75 + (G.seasonShift || 0)) % 4;   // starts at the beginning of summer
    G.sea = seasonAmounts(G.seasonS);
    W.env.winter = G.sea.winter;
  }
  function updateWeather(dt) {
    G.weatherT -= dt;
    if (G.weatherT <= 0) {
      const r = Math.random(), prev = G.weather;
      G.weather = r < .6 ? 'sunny' : r < .87 ? 'cloudy' : 'stormy';
      G.weatherT = 70 + Math.random() * 80;
      if (G.weather === 'stormy' && prev !== 'stormy') G.rainId++;
    }
    if (G.calmT > 0) G.weather = 'sunny';
    const tgt = { sunny: [0, 0], cloudy: [.65, 0], stormy: [1, 1] }[G.weather];
    const rate = G.calmT > 0 ? 6 : 15;
    G.overcast += clamp(tgt[0] - G.overcast, -dt / rate, dt / rate);
    G.storm += clamp(tgt[1] - G.storm, -dt / rate, dt / rate);
    G.rain = clamp((G.storm - .35) / .5, 0, 1);
    G.wet = clamp(G.wet + (G.rain > .1 ? dt / 20 * G.rain : -dt / 100), 0, 1);
    // a slowly turning breeze, gusty in storms; it drives ridge lift and the wind streaks
    G.wind = 16 * fbm(G.t * .012, 31) + G.storm * 30 * fbm(G.t * .15, 30);
    if (G.tailwindT > 0) G.wind = lerp(G.wind, G.tailDir * 34, Math.min(1, G.tailwindT / 5));
    W.env.wind = G.wind;
    // thermals: none at night, weak at dawn, strongest early afternoon; rain grounds them, winter weakens them
    const a = (G.tod - .25) / .5;
    const sun = a > 0 && a < 1 ? Math.pow(Math.sin(a * Math.PI), .8) * (.75 + .45 * a) : 0;
    G.thermalK = sun * (1 - .45 * G.overcast) * (1 - G.rain) * (1 - .35 * G.sea.winter);
    W.env.thermal = G.thermalK;
    G.cloudDrift += dt * (2.5 + G.wind * .2);
    G.flash = Math.max(0, G.flash - dt * 3);
    if (G.storm > .75 && G.sea.winter < .5) { G.nextBolt -= dt; if (G.nextBolt <= 0) { G.flash = 1; G.nextBolt = 6 + Math.random() * 12; audio.thunder(.4 + Math.random() * 1.4); } }
    if (G.rain > .3 && G.wet > .25 && G.sea.winter < .5) once('worms', 'Rain brings worms up. Land on open ground after rain and tap them to eat.');
    if (G.sea.autumn > .6) once('autumn', 'Autumn. The leaves are turning, and the flocks fly south.');
    if (G.sea.winter > .6) once('winter', 'Winter. Small ponds freeze, most songbirds have gone, and only some bushes keep their berries.', 6);
    if (G.sea.spring > .6) once('spring', 'Spring. Blossom, and the songbirds are back.');
  }
  function updateCritters(dt) {
    const { w, h } = G.view, camDx = G.cam.x - (G.lastCamX ?? G.cam.x); G.lastCamX = G.cam.x;
    if ((G.nextFlock -= dt) <= 0) {
      // distant flocks mostly travel the way the migration goes
      G.nextFlock = 18 + Math.random() * 25; const dir = (Math.random() < .75 ? 1 : -1) * (G.goalDir || 1);
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
    updateFlock(G, dt, audio, once);
    if (G.spawnYoung) { G.spawnYoung = false; G.hawks.push(makeHawk(G.nest.x, G.nest.y - 10, 'young')); }
    G.hawks = G.hawks.filter(h => updateHawk(G, h, dt));
    if (G.hawks.some(h => h.kind === 'companion' && h.life < 1)) once('companion', 'Another hawk! Follow it: it knows where the thermals and food are.');
    for (const p of G.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'drop' || p.type === 'feather') p.vy += (p.type === 'drop' ? 160 : 15) * dt;
      if (p.type === 'feather') { p.vx *= .98; p.a += dt * 2; }
    }
    G.parts = G.parts.filter(p => p.life > 0);
    // first sightings of prey teach the hunt
    if (b.state === 'fly' && G.t > 20) {
      if (W.miceIn(G.cam.x + 40, G.cam.x + G.view.w - 40).some(m => !G.eaten.has(m.id + ':' + G.day) && mousePos(m, G.t).show > .8)) once('mice', 'Mice in the grass. Dive at one, fast and steep, to catch it.');
      if (W.pondsIn(G.cam.x + 40, G.cam.x + G.view.w - 40).some(p => !W.frozen(p) && p.fish.length)) once('fish', 'Fish in the pond. Dive into the water right above one to catch it.');
    }
  }
  // night roost: stay perched at dusk or night and the hawk sleeps until dawn
  function updateRoost(dt, still) {
    const dark = G.tod > .72 || G.tod < .2;
    if (dark && b.state === 'fly') once('roost', 'Night is falling. Perch in a tree and stay still to roost until dawn.');
    if (!G.roost) { G.roostT = b.state === 'perch' && dark && still ? G.roostT + dt : 0; if (G.roostT > 3) G.roost = { t: 0, done: false }; return; }
    const R = G.roost; R.t += dt;
    if (R.t > 1.6 && !R.done) {
      R.done = true;
      const cur = .36 + G.clockT / DAY, frac = cur % 1;
      G.clockT = ((frac > .25 ? Math.floor(cur) + 1.25 : Math.floor(cur) + .25) - .36) * DAY;
      G.thirst = Math.min(100, G.thirst + 15); G.hunger = Math.min(100, G.hunger + 15); b.stamina = 1;
      G.weather = 'sunny'; G.weatherT = 60 + Math.random() * 60; G.overcast = 0; G.storm = 0;
      updateClock(); persist();
      ui.toast(`Dawn, day ${G.day}. You roosted through the night.`, 3);
    }
    if (R.t > 4) { G.roost = null; G.roostT = 0; }
  }
  const roostFade = () => { const R = G.roost; if (!R) return 0; return R.t < 1.5 ? R.t / 1.5 : R.t < 2.4 ? 1 : Math.max(0, 1 - (R.t - 2.4) / 1.6); };
  function updateCamera(dt, snap) {
    const { w, h } = G.view;
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

  let saveT = 0;
  function step(dt) {
    G.t += dt; G.dt = dt;
    G.clockT += dt; updateClock();
    const raw = readInput(input);
    const still = !raw.taps.length && !raw.steer && !raw.face && !raw.pitch && !raw.flaps;
    if (!G.roost) {
      for (const tp of raw.taps) onTap(tp);
      for (let i = 0; i < raw.flaps; i++) { b.target = null; flap(b, G.flapPower, G); }
    }
    let steer = null;
    if (raw.steer && !G.roost) { const w = toWorld(raw.steer); steer = { wx: w.x, wy: w.y }; }
    updateBird(b, dt, G.roost ? { steer: null, pitch: 0, face: 0 } : { steer, pitch: raw.pitch, face: raw.face }, G);
    G.perchT = b.state === 'perch' ? G.perchT + dt : 0;
    if (G.pendingEat && b.state === 'ground' && b.walkTo === null) { if (Math.abs(G.pendingEat.x - b.x) < 14) eat(G.pendingEat); G.pendingEat = null; }
    if (b.state !== 'ground') G.pendingEat = null;
    if (b.circling) once('thermal', 'A thermal. Let go and the hawk circles upward on the warm air.');
    if (W.ridgeLift(b.x, b.y) > 8 && b.state === 'fly') once('ridge', 'Ridge lift: wind hitting the hillside pushes up along its face.');
    if (b.stamina < .15 && b.state === 'fly') once('tired', 'Tired wings. Glide a while, or find rising air, and your strength comes back.');
    // storms are bumpy in open air; shelter in a tree
    if (G.storm > .3 && b.state === 'fly') b.kick += fbm(G.t * 1.7, 41) * G.storm * 120 * dt;
    updateStreaks(dt);
    G.glide = G.settings.glide && b.state === 'fly' ? predictGlide(b, G) : null;

    if (!G.roost) {
      G.thirst = Math.max(0, G.thirst - dt * 100 / THIRST_S);
      G.hunger = Math.max(0, G.hunger - dt * 100 / HUNGER_S);
    }
    G.flapPower = .5 + .25 * (G.thirst > 0) + .25 * (G.hunger > 0);
    if (G.thirst < 25) once('thirsty', 'Thirsty. Find a pond and land on the water to drink.');
    if (G.hunger < 25) once('hungry', 'Hungry. Bushes have berries, worms come up after rain, and mice and fish can be caught with a dive.');
    G.hint = b.target;
    for (const k of ['wormsT', 'followT', 'calmT', 'tailwindT', 'brightT']) G[k] = Math.max(0, G[k] - dt);

    updateWeather(dt); updateCritters(dt); updateSongs(dt); updateRoost(dt, still); updateCamera(dt);
    updateJourney(G, dt, { toast: ui.toast, once, audio });
    updateNest(G, DAY, ui.toast);
    const vr = [];
    for (const t of W.thermalsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) for (const r of t.rings) {
      const tk = G.ringsTaken.get(r.id); r.gone = tk !== undefined && G.t - tk < RING_RESPAWN; vr.push(r);
    }
    G.visibleRings = vr;
    audio.ambience(b.state === 'fly' ? clamp(b.s / 200, 0, 1) * .8 + G.storm * .3 : G.storm * .4, G.rain * (G.sea.winter > .5 ? .2 : 1));
    audio.vario(b.state === 'fly' ? b.air : 0);
    if ((saveT -= dt) <= 0) { saveT = 4; persist(); }
  }

  /* ---------- sizing and loop ---------- */
  // Resolution: device pixels per css pixel. Washes are fill-rate heavy, so it starts modest and
  // steps down while frames run slow; the level that worked is remembered for next time.
  const RES_MIN = .7;
  let res = 0, resLock = false;
  function resMax() { return Math.min(devicePixelRatio || 1, 1.6, 1500 / Math.max(innerWidth, innerHeight)); }
  function resize() {
    const cw = innerWidth, ch = innerHeight;
    let s = ch / 300; if (cw / s < 420) s = cw / 420;   // css px per world unit
    res = clamp(res || store.get('res', 9) * 1.08, Math.min(RES_MIN, resMax()), resMax());
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * res); canvas.height = Math.round(ch * res);
    G.view = { w: cw / s, h: ch / s, s, px: res * s };
    if (!G.paper || G.paper[0] !== Math.ceil(G.view.w) || G.paper[1] !== Math.ceil(G.view.h)) { makePaper(G.view.w, G.view.h); G.paper = [Math.ceil(G.view.w), Math.ceil(G.view.h)]; }
    redraw = true;
  }
  // watch frame times in two-second windows; drop resolution when slow, and stop if that doesn't help
  const perf = { n: 0, sum: 0, prev: 0, settle: 0, fails: 0, step: 1 }, now = () => performance.now(), t0 = now();
  function setRes(r) { res = r; perf.settle = 1; resize(); store.set('res', res); }
  function watchFrames(ms) {
    if (resLock || ms > 250) { perf.n = perf.sum = 0; return; }
    perf.n++; perf.sum += ms;
    if (perf.sum < 2000) return;
    const avg = perf.sum / perf.n; perf.n = perf.sum = 0;
    if (now() - t0 < 4000) return;
    if (perf.settle) { perf.settle--; return; }   // the window after a change repaints every sprite; don't judge it
    if (perf.prev && avg > perf.prev * .93) { resLock = ++perf.fails >= 2; perf.prev = 0; setRes(Math.min(resMax(), res / perf.step)); return; } // no better: fill rate isn't the problem
    perf.prev = 0;
    if (avg > 1000 / 45 && res > RES_MIN + .01) { perf.step = avg > 1000 / 25 ? .75 : .87; perf.prev = avg; setRes(Math.max(RES_MIN, res * perf.step)); }
  }
  let redraw = true;
  addEventListener('resize', () => { res = 0; resize(); }); resize();
  updateClock();
  G.P = palette(G.tod, 0, 0, G.sea);
  updateCamera(0, true);

  let last = performance.now();
  let camKey = '';
  function frame(now) {
    const ms = now - last, dt = Math.min(.05, ms / 1000); last = now;
    if (!G.paused) { step(dt); watchFrames(ms); }
    // while paused the picture holds still, so only repaint when photo mode pans or the view changes
    const ck = G.cam.x + ',' + G.cam.y + G.photo;
    if (!G.paused || redraw || ck !== camKey) {
      redraw = false; camKey = ck;
      G.P = palette(G.tod, G.overcast, G.storm, G.sea);
      ctx.setTransform(G.view.px, 0, 0, G.view.px, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      render(ctx, G);
      if (!G.photo) { drawHUD(); drawStaff(); }
      const f = roostFade();
      if (f > 0) { ctx.fillStyle = C([28, 30, 46], f * .92); ctx.fillRect(0, 0, G.view.w, G.view.h); }
    }
    music.update(dt, { night: nightness(G.tod), storm: G.storm, learned: G.learned, species: SPECIES });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  ui.toast(saved ? `Welcome back. Day ${G.day}, ${seasonName(G)}.` : 'Tap to flap. Press and hold to point the hawk where you want to go.', saved ? 3 : 6);
  if (innerHeight > innerWidth) ui.toast('Turn your phone sideways for a wider view.', 4);

  // handy for poking at state from the console, and for screenshot scripts
  const snap = () => updateCamera(0, true);
  const fresh = () => { b.perch = null; b.target = null; b.walkTo = null; b.s = 0; b.g = 0; };
  G.dbg = {
    treeWithSong() { for (let x = b.x; x < b.x + 20000; x += 200) for (const t of W.treesIn(x, x + 200)) if (t.song && active(speciesFor(t.bio, t.song.seed), G.tod, G.storm, G.sea.winter)) return t; },
    pond() { return W.pondsIn(b.x, b.x + 5000)[0]; },
    landmark(type) { for (let x = b.x + 200; x < b.x + 60000; x += 2000) { const l = W.landmarksIn(x, x + 2000).find(l => !type || l.type === type); if (l) return l; } },
    goto(x, y) { fresh(); b.state = 'fly'; b.x = x; b.y = y ?? W.groundY(x) - 120; b.s = 85; b.g = -.17; snap(); },
    trees: W.treesIn, bushes: W.bushesIn, mice: W.miceIn, twigs: W.twigsIn, perches: W.perchesIn,
    staffPts() { const r = staffRect(), sp = SPECIES[G.staff.species]; return sp.notes.map(n => [(r.x + 100) * G.view.s, laneY(r, n) * G.view.s]); },
    lanePt(lane) { const r = staffRect(); return [(r.x + 100) * G.view.s, laneY(r, lane) * G.view.s]; },
    perch(q) { fresh(); perchOn(b, q, G); snap(); },
    swim(p) { fresh(); b.x = p.c; b.y = p.waterY - 3; b.state = 'swim'; snap(); },
    ground() { fresh(); const bu = W.bushesIn(b.x, b.x + 5000)[0]; b.x = bu.x + 16; b.y = W.groundY(b.x) - 6; b.state = 'ground'; b.face = -1; snap(); },
    fly(y) { fresh(); b.state = 'fly'; b.y = y; b.s = 85; b.g = -.17; snap(); },
    thermal() { const t = W.thermalsIn(b.x + 200, b.x + 3000).find(t => t.rings.length); fresh(); b.state = 'fly'; b.x = t.c - 60; b.y = t.rings[0].y + 10; b.s = 85; snap(); },
    time(tod) { G.clockT += (((tod - G.tod) % 1 + 1) % 1) * DAY; updateClock(); },
    season(s) { G.seasonShift = ((s - G.clockT / DAY / 2 - 3.75) % 4 + 4) % 4; updateClock(); },
    weather(w) { G.weather = w; G.weatherT = 999; const t = { sunny: [0, 0], cloudy: [.65, 0], stormy: [1, 1] }[w]; G.overcast = t[0]; G.storm = t[1]; },
    learnAll() { for (const sp of SPECIES) G.learned.add(sp.id); },
    power(name) { usePower(SPECIES.find(s => s.name === name)); },
    respond(name) { respond(SPECIES.find(s => s.name === name), null); },
  };
  window.__aloft = G;
  return G;
}
