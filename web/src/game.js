// Game state, systems and the main loop.
import { TAU, clamp, lerp, smooth, hash, fbm, C, shade } from './util.js';
import { wash, circP, lift, makePaper } from './paint.js';
import { palette, seasonAmounts, nightness } from './palette.js';
import * as W from './world.js';
import { createBird, updateBird, flap, nudge, perchOn, hopDown, predictGlide, FEET } from './bird.js';
import { applyTune } from './tune.js';
import { createInput, readInput } from './input.js';
import { createSticks } from './sticks.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { SPECIES, speciesFor, active, timeOfDay } from './songs.js';
import { render } from './render.js';
import { createUI } from './ui.js';
import { mousePos, fishPos, reveal, rise, updateFlock, callVisitor, updateVisitor, makeHawk, updateHawk, updateCrows, freeze } from './life.js';
import { loadJourney, saveJourney, updateJourney, journal, drawMap, placeNote, atPerch, updateNest, seasonName, NEST_TWIGS } from './journey.js';
import { createMusic, MUSIC_MODES } from './music.js';
import { loadStory, updateHealth, noteFlap, noteTrick, keepsakesIn, takeKeepsake, updateCourtship, courtNote } from './story.js';
import { createPhoto } from './photo.js';
import { createSinging } from './singing.js';
import { createDial, hourName } from './dial.js';
import { createHaptics } from './haptics.js';
import { createIntentions } from './intentions.js';
import { createFauna, updateFauna, squirrelTree } from './fauna.js';
import { GFX, loadGfx, overlay, record, stats } from './gfx.js';
import { createGhosts, updateGhost, saveGhosts, ghostDebug } from './ghost.js';
import { createNight, updateNight } from './night.js';
import { createSkies, updateSkies, skiesDebug, hush } from './skies.js';
import { createRidge, updateRidge, RIDGE } from './ridge.js';
import { createEnc, updateEncounters, caughtFish, scrapsIn, eatScrap, morphOf, encDebug } from './encounters.js';
import { spriteCount } from './paint.js';
import { captureSightings, guidePages, pageName } from './guide.js';
import { postcard } from './postcard.js';
import { airEnv, carve, kettlesIn, kettle, lensesIn, cumuliIn } from './air.js';
import { initAtmos, updateAtmos, wakeAtmos } from './atmos.js';
import { dream, fogDepth } from './skyfx.js';

const DAY = 480;               // one day = 8 minutes
const SEASON_DAYS = 8;         // days per season: a full year is 32 days
const THIRST_S = 420;          // full to empty in 7 minutes
const HUNGER_S = 300;          // full to empty in 5 minutes
const BERRY_REGROW = 120;
const RING_RESPAWN = 90;
const TWIG_REGROW = 300;
const POWER_CD = 40;           // seconds before a song's gift works again
const powerCD = sp => sp.powerKey === 'companion' ? POWER_CD * 4 : POWER_CD;   // a companion hawk is a rarer gift
// Zoom, as how many times more world fits on screen than the art was first drawn at (300 units
// tall). Perched or low and slow it sits at ZOOM; high and fast it eases out to ZOOM_OUT.
const ZOOM = 1.5, ZOOM_OUT = 2.85;
const TAKEOFF_TAPS = .55;      // a second tap within this many seconds takes off
const RING_BOOST = 85;         // speed a cloud ring adds (more straight out of a loop or flip)
const CALL_CD = 6;             // seconds between screams
const CHORUS_S = 150;          // how long the dawn chorus lasts
const DREAM_S = 7;             // the dream while roosting
const AWAY_S = 300;            // away this long, and the game says where you were on return

const store = {
  get(k, d) { try { const v = localStorage.getItem('aloft.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aloft.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export function start(canvas) {
  const ctx = canvas.getContext('2d');
  const sticks = createSticks();
  const input = createInput(canvas, sticks);
  const audio = createAudio();
  audio.on = store.get('sound', true);
  const haptics = createHaptics(store);
  applyTune(store.get('tune', {}));
  loadGfx(store); overlay(GFX.fps);

  const G = {
    t: 0, dt: 0, view: { w: 480, h: 270, s: 1, px: 1, spx: 1, z: ZOOM, scr: { w: 480, h: 270, s: 1 } }, cam: { x: 0, y: 0 }, camC: { x: 0, y: 0 }, camLead: 0, camGround: 0, zoom: ZOOM,
    clockT: 0, tod: .36, day: 1, seasonS: 0, sea: seasonAmounts(0), P: null,
    bird: createBird(W.START_X, -150),
    wind: 0, flapPower: 1,
    weather: 'sunny', weatherT: 90, overcast: 0, storm: 0, rain: 0, wet: 0, rainId: 0, flash: 0, cloudDrift: 0, nextBolt: 5,
    thirst: 100, hunger: 100, score: store.get('score', 0),
    eaten: new Set(), berries: new Map(), ringsTaken: new Map(), twigsTaken: new Map(), visibleRings: [],
    parts: [], flocks: [], nearBirds: [], nextFlock: 4, nextNear: 40,
    boids: [], flockGoal: null, nextBoids: 10, scatterT: 0, hawks: [], visitor: null, crows: [], fauna: createFauna(), enc: createEnc(store),
    chorus: null, chorusDay: 0, callT: 0, glideFrom: null,
    staff: { mode: null, species: null, tree: null, tries: [], lastTry: 0, wrongT: 0, doneT: 0, sang: null },
    learned: new Set(store.get('learned', [])), heard: new Set(store.get('heard', [0, 1])),
    hint: null, paused: false, pendingEat: null, carry: null, perchT: 0, roostT: 0, roost: null,
    // song gifts
    powerCD: {}, wormsT: 0, followT: 0, calmT: 0, tailwindT: 0, tailDir: 1, brightT: 0, warmT: 0, liftT: 0, duskT: 0, singAllT: 0, ripen: null,
    thermalK: 1, streaks: [], glide: null, photo: false,
    settings: { glide: store.get('glide', true), music: store.get('music', true), lefty: store.get('lefty', false), full: store.get('full', true), quiet: store.get('quietHud', true), oneThumb: store.get('oneThumb', false), saver: store.get('saver', false) },
  };
  const saved = loadJourney(G, store);
  G.ghosts = createGhosts(store); G.night = createNight(); G.skies = createSkies(); G.ridge = createRidge(store);
  loadStory(G, saved); initAtmos(G, saved?.atmos);
  const b = G.bird;
  if (saved) { b.x = saved.x; G.clockT = saved.clockT; G.thirst = saved.thirst; G.hunger = saved.hunger; }
  b.y = Math.min(saved?.y ?? -1e9, W.groundY(b.x) - 120) ; if (b.y < W.CEILING + 100) b.y = W.groundY(b.x) - 150;
  b.s = 85; b.adult = G.journeys > 0;
  if (G.nest?.fledged) G.hawks.push(Object.assign(makeHawk(b.x - 60, b.y - 20, 'young'), { morph: morphOf(G.nest) }));
  b.health = G.health;

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
      if (Math.abs(yy - r.y) < r.r * 1.5) {
        G.ringsTaken.set(r.id, G.t); r.gone = true; G.score++; store.set('score', G.score);
        audio.ring(); haptics.ring(); intentions.note('rings'); for (let i = 0; i < 10; i++) spark(r.x, r.y + (Math.random() - .5) * r.r * 2);
        // a gust through the cloud: a burst of speed along the line the hawk is flying
        const flip = b.flipT > 0;
        b.s = Math.min(280, b.s + RING_BOOST * (flip ? 1.8 : 1)); b.stall = false; b.hover = 0;
        if (flip) { b.flipT = 0; ui.toast('Through the ring out of a flip: a big burst of speed!', 2); }
        for (let i = 0; i < 4; i++) part('puff', r.x + (Math.random() - .5) * 10, r.y + (Math.random() - .5) * r.r * 1.6, -b.face * (20 + Math.random() * 20), (Math.random() - .5) * 8, .8);
        once('ring', 'A cloud ring! Flying through one gives a burst of speed. There are more all over the sky.');
      }
    }
  };

  const music = createMusic(audio);
  music.on = G.settings.music;
  music.setMode(store.get('musicMode', 'valley'));
  const playSong = sp => sp.notes.forEach((n, i) => setTimeout(() => audio.note(n, sp.voice), i * sp.gap * 1000));
  const ui = createUI({
    audio, G, store, species: SPECIES, haptics,
    onPause: p => { G.paused = p; if (!p) readInput(input); },
    playSong,
    hooks: {
      music: on => music.setOn(on),
      musicModes: MUSIC_MODES,
      musicMode: m => { if (m) { music.setMode(m); store.set('musicMode', m); } return music.mode; },
      photo: () => photo.begin(),
      journal: () => ({ ...journal(G, DAY), court: courtNote(G) }),
      drawMap: cv => drawMap(G, cv),
      album: () => store.get('album', []),
      guide: () => guidePages(store),
      // a new journey flies a shared world if a link named one, else a fresh one of its own
      quit,
      fullscreen: on => { G.settings.full = on; store.set('full', on); if (on) goFull(); else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); },
      newGame: () => { store.set('save', null); store.set('seed', G.sharedSeed ?? 1 + Math.floor(Math.random() * 99999)); G.noSave = true; location.reload(); },
      gfx: k => { if (k === 'res') { res = 0; resLock = false; perf.prev = 0; perf.fails = 0; resize(); } redraw = true; },
      subtitle: () => { const h = hourName(G.tod); return `${h[0].toUpperCase()}${h.slice(1)} on day ${G.day}, ${seasonName(G)}.`; },
    },
  });
  const photo = createPhoto({ canvas, G, ui, onEnd: () => { readInput(input); G.paused = false; }, store, caption: () => `Day ${G.day}, ${seasonName(G)}, over ${placeNote(G, b.x)}` });
  // the screen stays awake while the game is up (the lock lapses when the tab is hidden)
  let wakeLock = null;
  const stayAwake = async () => { if (wakeLock || !navigator.wakeLock) return; try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* denied, or low battery */ } };
  input.onAny = () => { audio.unlock(); stayAwake(); };
  canvas.addEventListener('pointerup', () => { if (G.settings.full) goFull(); });   // a touch's lift is what lets a page go full screen
  // full screen in the browser hides the phone's buttons, so stray thumbs reach them less
  // (an installed app is already full screen)
  function goFull() {
    const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    if (standalone || document.fullscreenElement || !document.fullscreenEnabled || G.photo) return;
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  }
  // quitting saves, then closes the app if the system lets a page do that; if not, it says the
  // journey is safe and the app can be closed
  function quit() {
    persist();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    try { window.close(); } catch { /* not allowed */ }
    setTimeout(() => ui.goodbye(), 250);
  }
  input.onKey = k => {
    if (G.photo) { if (k === 'Escape') photo.end(); return; }
    if (k === 'Escape' || k === 'KeyP') ui.toggle(); if (k === 'KeyE') interact(); if (k === 'KeyC') call();
    // number keys 1 to 5 sing the five song notes, for keyboards
    const n = 'Digit1 Digit2 Digit3 Digit4 Digit5'.split(' ').indexOf(k);
    if (n >= 0 && G.staff.mode) { audio.note(n, G.voiceNow(), .18); singer.glow(n); singNote(n); }
  };
  const persist = () => { if (!G.noSave) { saveJourney(G, store); saveGhosts(G); store.set('seen', { t: Date.now(), doing: doing() }); } };
  // what the hawk was up to, for the welcome back after time away
  function doing() {
    if (G.roost) return 'roosting';
    if (G.nest && !G.nest.fledged) return G.nest.chick ? 'feeding your chick' : 'building your nest';
    return { perch: 'resting in a tree', ground: 'on the ground', swim: 'on the water' }[b.state] || (G.goal === 'south' ? 'flying south' : 'flying home');
  }
  function welcome(was) {
    const h = hourName(G.tod);
    return `Welcome back. ${h[0].toUpperCase()}${h.slice(1)} on day ${G.day}, over ${placeNote(G, b.x)}. You were ${was || 'flying'}.`;
  }
  // hidden (another app, another tab, the screen off): save, pause and go quiet; sound comes back on return
  document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); audio.suspend(); if (!G.paused) ui.open(); } else { audio.resume(); stayAwake(); } });
  addEventListener('pagehide', () => { persist(); audio.suspend(); });
  addEventListener('pageshow', () => audio.resume());
  document.addEventListener('freeze', () => audio.suspend());

  /* ---------- events from the bird ---------- */
  const part = (type, x, y, vx, vy, life, extra = {}) => G.parts.push({ type, x, y, vx, vy, life, max: life, ...extra });
  const spark = (x, y) => part('spark', x, y, (Math.random() - .5) * 30, (Math.random() - .5) * 30, .7);
  const puff = (x, y, n = 6) => { for (let i = 0; i < n; i++) part('puff', x + (Math.random() - .5) * 8, y - 2, (Math.random() - .5) * 20, -10, .8); };
  const events = {
    flap: ({ quality } = {}) => { audio.flap(); haptics.flap(); G.glideFrom = null; noteFlap(G, quality); },
    // a loop, a flip: acrobatics count toward a courtship down south
    trick: ({ kind } = {}) => { noteTrick(G, kind); once('trick', 'Acrobatics! Loops, flips and stoops all count when a hawk down south is watching.'); },
    hop: () => { audio.rustle(.5); },
    tired: () => { audio.tired?.(); once('noflap', 'Your wings are spent. Glide, or find rising air, until they recover.'); },
    splash: ({ x, y, big }) => {
      audio.splash(big); haptics.land(!big);
      for (let i = 0; i < (big ? 16 : 8); i++) part('drop', x, y, (Math.random() - .5) * 60, -30 - Math.random() * 50, .7);
      part('ripple', x, y + 1, 0, 0, 1.2);
    },
    crash: ({ x, y }) => {
      audio.thump(); haptics.crash(); puff(x, y);
      for (let i = 0; i < 3; i++) part('feather', x, y - 6, (Math.random() - .5) * 30, -20, 1.6, { a: Math.random() * TAU });
      once('crash', 'Hard landing! Pull up to slow down before you touch the ground.');
    },
    // a well-flared landing settles quietly; arriving fast is a clumsy hop that costs a little strength
    land: ({ kind, soft, speed }) => {
      if (kind === 'perch') {
        if (soft) { audio.rustle(.7); haptics.land(true); }
        else { audio.thump(.25); audio.rustle(); haptics.land(false); b.hopT = .4; b.stamina = Math.max(0, b.stamina - .1); for (let i = 0; i < 2; i++) part('feather', b.x, b.y - 4, (Math.random() - .5) * 24, -16, 1.4, { a: Math.random() * TAU }); }
        once('perch', 'Perched. Tap one stick to hop, both to take off, push both down to drop to the branch below. Sing with the pools round the sticks.');
        if (!soft) once('softland', 'A clumsy landing. Flare (point up) just before the branch to settle softly.');
        atPerch(G, b.perch, { toast: ui.toast, once, audio, spark });
        if (b.perch.tree) intentions.note('perch', b.perch.tree.i);
      }
      if (kind === 'ground') {
        if (soft) { audio.thump(.25); haptics.land(true); }
        else if (speed < 80) { audio.thump(.5); haptics.land(false); puff(b.x, b.y + FEET, 3); b.stamina = Math.max(0, b.stamina - .06); }
        once('ground', 'On the ground. Tap one stick to hop that way, push both down to eat or drink, tap both to take off.');
      }
      if (kind === 'swim') once('swim', 'Swimming. Tap the water to drink: three sips fill you up. Tap twice quickly to take off.');
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
        const q = fishPos(f, p, G.t); if (Math.abs(q.x - h.x) < (G.focus?.kind ? 22 : 15)) { got = { kind: 'fish', id: f.id }; break; }
      }
    } else {
      if (h.y + FEET < gy - 7) return false;
      // a stoop straight out of a kite has the mouse already picked: it reaches a little further
      const fromKite = G.t - h.kiteLeft < 2.5, reach = fromKite || G.focus?.kind ? 20 : 12;   // (so does a focused one)
      for (const m of W.miceIn(h.x - 30, h.x + 30)) {
        if (G.eaten.has(m.id + ':' + G.day)) continue;
        const q = mousePos(m, G.t); if ((q.show > .3 || fromKite) && Math.abs(q.x - h.x) < reach) { got = { kind: 'mouse', id: m.id }; break; }
      }
    }
    if (!got) return false;
    G.eaten.add(got.id + ':' + G.day); haptics.catch(); intentions.note(got.kind);
    h.y = Math.min(h.y, (wy ?? gy) - FEET - 4); h.g = .5; h.s = Math.max(62, h.s * .7); h.kick = -18;
    if (got.kind === 'fish') events.splash({ x: h.x, y: wy, big: true }); else { audio.thump(); puff(h.x, gy, 4); }
    if (got.kind === 'fish' && !G.nest?.chick && caughtFish(G, W.pondNear(h.x, 1))) {
      audio.rustle(); ui.toast('Caught a fish!', 1.8);   // held in the talons: an eagle may come for it
    } else if (G.nest?.chick && !G.carry && G.hunger >= 30) {
      G.carry = got.kind; audio.rustle();
      ui.toast(`Caught a ${got.kind}! Carry it to your nest for the chick.`, 3);
    } else {
      G.hunger = Math.min(100, G.hunger + (got.kind === 'fish' ? 40 : 50)); audio.eat();
      ui.toast(`Caught a ${got.kind}!`, 1.8);
    }
    return true;
  };

  /* ---------- taps ---------- */
  function toWorld(p) { return { x: G.cam.x + p.x / G.view.s, y: G.cam.y + p.y / G.view.s, lx: p.x / G.view.scr.s, ly: p.y / G.view.scr.s }; }
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
    for (const k of keepsakesIn(wx - 30, wx + 30)) if (!G.kept.has(k.id)) consider(k.x, k.y - 2, { kind: 'keepsake', id: k.id, x: k.x, k });
    for (const sc of scrapsIn(G, wx - 30, wx + 30)) consider(sc.x, sc.y - 2, { kind: 'scrap', id: sc.id, x: sc.x });
    return best;
  }
  function drink() {
    if (G.thirst >= 99.5) { ui.toast('Not thirsty right now.', 1.5); return; }
    G.thirst = Math.min(100, G.thirst + 100 / 3); b.peckT = .35; audio.drink(); haptics.sip();
    const pd = W.pondNear(b.x, 1.2); if (pd) intentions.note('drink', pd.k);
    part('ripple', b.x + b.face * 9, (W.waterAt(b.x + b.face * 6) ?? b.y + 3), 0, 0, 1);
  }
  function eat(f) {
    b.peckT = .35;
    if (f.kind === 'keepsake') { audio.rustle(.6); takeKeepsake(G, f.k, ui.toast); return; }
    if (f.kind === 'scrap') { audio.eat(); eatScrap(G, f, ui.toast); return; }
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
  // on a perch, the ground or the water one tap turns or steps toward it; a quick second tap takes off
  let lastTapT = -9;
  function tapFlap(dir) {
    if (b.state === 'fly') { b.target = null; flap(b, G.flapPower, G); return; }
    if (G.t - lastTapT < TAKEOFF_TAPS) { lastTapT = -9; b.target = null; flap(b, G.flapPower, G); return; }
    lastTapT = G.t; nudge(b, dir || b.face);
  }
  function onTap(p) {
    const w = toWorld(p), z = G.view.z;
    // water: drink while swimming or standing at the edge
    if ((b.state === 'swim' || (b.state === 'ground' && nearWater())) && Math.abs(w.x - b.x) < 90) {
      const wy = W.waterAt(w.x);
      if (wy !== null && w.y > wy - 25 && w.y < wy + 30) { drink(); return; }
    }
    if (b.state === 'ground') {
      const f = foodAt(w.x, w.y, 9 * z);
      if (f && Math.abs(f.x - b.x) < 180) {
        if (Math.abs(f.x - b.x) < 12) eat(f); else { b.walkTo = f.x - Math.sign(f.x - b.x) * 6; G.pendingEat = f; }
        return;
      }
    }
    const pr = nearestPerch(w.x, w.y, 11 * z);
    // perched, a tap below the hawk drops it down a level: the next branch, or the ground
    if (b.state === 'perch' && w.y > b.y + 12 && Math.abs(w.x - b.x) < 110 && (!pr || pr.y > b.y)) {
      lastTapT = -9; hopDown(b, G, Math.abs(w.x - b.x) > 6 ? Math.sign(w.x - b.x) : b.face); return;
    }
    if (pr && pr !== b.perch) {
      b.target = pr; once('tapperch', 'Heading for that branch. The hawk slows and lands if it can reach it.');
      if (b.state !== 'fly') { flap(b, G.flapPower, G); b.target = pr; }
      return;
    }
    tapFlap(Math.abs(w.x - b.x) > 4 ? Math.sign(w.x - b.x) : b.face);
  }

  /* ---------- songs: listen, then play them back on the singing string ---------- */
  // learn mode: a songbird is near, listen and copy it. sing mode: perched with nobody
  // near, sing any song you know and that species answers, bringing its gift.
  const PHRASE = { dawn: 'at dawn', day: 'in the daytime', dusk: 'at dusk', night: 'at night' };
  // a songbird sings; in a duet (a song you already know, sung beside its bird) it sings
  // only the first half and leaves the rest to you
  function sing(sp, perch, owner, vol = .16) {
    const d = Math.hypot(perch.x - b.x, perch.y - b.y), v = vol * clamp(1 - d / 320, 0, 1);
    const S = G.staff, duet = S.duet && S.tree?.song === owner, count = duet ? Math.ceil(sp.notes.length / 2) : sp.notes.length;
    owner.singingT = owner.singT = count * sp.gap + .2;
    if (duet) { S.tries = []; S.wrongT = 0; S.doneT = 0; S.errs = []; S.lastTry = G.t + count * sp.gap; }
    sp.notes.slice(0, count).forEach((n, i) => setTimeout(() => {
      if (G.paused && !G.photo) return;
      if (v > .005) audio.note(n, sp.voice, v);
      if (v > .04) hear(sp);
      part('note', perch.x + 3, perch.y - 8, (hash(i + G.t) - .3) * 12, -16, 1.4, { col: shade(sp.cols.body, .8) });
      if (G.staff.tree && G.staff.tree.song === owner) singer.glow(n);
    }, i * sp.gap * 1000));
  }
  // a note held in tune on the string (or a number key on a keyboard). `err` is how far off
  // the pitch was, 0 to 1; with the timing between notes it sets the quality of a duet.
  function singNote(lane, err = 0) {
    const S = G.staff; if (!S.mode) return;
    const sp = S.mode === 'learn' ? SPECIES[S.species] : null;
    // a pause, or a finished song, starts over; a wrong note only flashes and is not counted
    if (G.t - S.lastTry > 6 || S.doneT > 0) { S.tries = []; S.wrongT = 0; S.doneT = 0; S.sang = null; S.errs = []; }
    const gap = sp ? Math.max(sp.gap * 2, .45) : .6, late = S.tries.length || S.duet ? clamp((Math.abs(G.t - S.lastTry - gap) - .15) / gap, 0, 1) : 0;
    S.lastTry = G.t; (S.errs ??= []).push(.6 * clamp(err, 0, 1) + .4 * late);
    haptics.note(); music.echo(lane);
    const off = sp && S.duet ? Math.ceil(sp.notes.length / 2) : 0;
    const i = off + S.tries.length; S.tries.push(lane);
    const quality = () => 1 - S.errs.reduce((a, v) => a + v, 0) / Math.max(1, S.errs.length);
    if (sp) {
      if (sp.notes[i] !== lane) { S.wrongT = .5; S.tries.pop(); S.errs[S.errs.length - 1] = 1; }
      else if (i + 1 === sp.notes.length) {
        S.doneT = 2.5;
        if (!G.learned.has(sp.id)) learn(sp);
        else respond(sp, S.tree, quality());
        intentions.note('song');
      }
    } else {
      const fits = [...G.learned].map(id => SPECIES[id]).filter(s => S.tries.every((n, k) => s.notes[k] === n));
      const done = fits.find(s => s.notes.length === S.tries.length);
      if (!fits.length) { S.wrongT = .5; S.tries.pop(); }
      else if (done) { S.doneT = 2.5; S.sang = done; respond(done, null, quality()); intentions.note('song'); if (G.suitor) G.courtBonus += .06; }
    }
  }
  function learn(sp) {
    G.learned.add(sp.id); store.set('learned', [...G.learned]); audio.learned();
    if (G.staff.tree) G.staff.duet = true;
    G.songLog[sp.id] = `Learned on day ${G.day} ${PHRASE[timeOfDay(G.tod)]}, in ${placeNote(G, b.x)}`;
    store.set('songlog', G.songLog);
    ui.toast(`You learned the ${sp.name}'s song.`, 3); singer.cheer(`Song learned: the ${sp.name}`);
    once('singback', 'Sing a song you know from any perch, and that bird answers with a gift.', 5);
    for (let k = 0; k < 12; k++) spark(b.x + (Math.random() - .5) * 20, b.y - 10 + (Math.random() - .5) * 14);
  }
  // call and response: the species answers, and its song does something. A clean duet (pitch
  // and timing) makes the gift last longer; in a dawn chorus every bird you know answers.
  function respond(sp, tree, q = 1) {
    if (tree) setTimeout(() => { const d = G.staff.duet; G.staff.duet = false; if (tree.song?.active) sing(sp, tree.song.perch, tree.song); G.staff.duet = d; }, 700);
    else callVisitor(G, sp);
    const scale = .6 + .6 * q, how = q > .85 ? ' A perfect duet.' : q < .45 ? ' (A rough one: cleaner notes make the gift last.)' : '';
    singer.cheer(q > .85 ? `A perfect song: the ${sp.name} answers` : `The ${sp.name} answers`);
    if (G.chorus) {
      const others = [...G.learned].map(id => SPECIES[id]).filter(s => s !== sp && (G.powerCD[s.id] ?? 0) <= G.t);
      for (const s2 of others) { G.powerCD[s2.id] = G.t + powerCD(s2); usePower(s2, .5); }
      if (others.length) ui.toast(`The whole chorus answers: ${others.map(s => s.name).join(', ')} too.`, 4);
    }
    if ((G.powerCD[sp.id] ?? 0) > G.t) { ui.toast(`The ${sp.name} answers your song.${how}`, 2.5); return; }
    G.powerCD[sp.id] = G.t + powerCD(sp);
    usePower(sp, scale);
    ui.toast(`The ${sp.name} answers: ${sp.power}.${how}`, 3.5);
  }
  function usePower(sp, k = 1) {
    switch (sp.powerKey) {
      case 'worms': G.wormsT = 45 * k; G.rainId++; break;
      case 'flock': G.followT = 60 * k; G.boids = []; break;
      case 'calm': G.calmT = 120 * k; G.weather = 'sunny'; G.weatherT = 120 * k; break;
      case 'ripen': {
        G.ripen = { x: b.x, t: G.t };
        for (const bu of W.bushesIn(b.x - 320 * k, b.x + 320 * k)) for (const be of bu.berries) G.berries.delete(be.id);
        break;
      }
      case 'companion': {
        const c = G.hawks.find(h => h.kind === 'companion');
        if (c) c.life = 150 * (1 - k); else { const h = makeHawk(b.x - b.face * 220, b.y - 90, 'companion'); h.life = 150 * (1 - k); G.hawks.push(h); }
        break;
      }
      case 'tailwind': G.tailwindT = 45 * k; G.tailDir = b.face; break;
      case 'night': G.brightT = 90 * k; break;
      case 'lark': b.stamina = Math.min(1, b.stamina + k); G.thirst = Math.min(100, G.thirst + 15 * k); break;
      case 'warm': G.warmT = 180 * k; break;
      case 'mice': reveal.until = G.t + 60 * k; break;
      case 'fish': rise.until = G.t + 60 * k; break;
      case 'dew': G.thirst = Math.min(100, G.thirst + 30 * k); break;
      case 'glint': glint(); break;
      case 'sing': G.singAllT = 120 * k; break;
      case 'lift': G.liftT = 90 * k; break;
      case 'dusk': G.duskT = 150 * k; break;
    }
  }
  // a blue jay's gift: it scolds toward the nearest keepsake still in the grass
  function glint() {
    const k = keepsakesIn(b.x - 4000, b.x + 4000).filter(k => !G.kept.has(k.id)).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0];
    if (!k) { ui.toast('The jay scolds, but there is nothing shining near here.', 3); return; }
    const d = Math.abs(k.x - b.x), far = d < 400 ? 'close by' : d < 1500 ? 'a short flight' : 'a long glide';
    ui.toast(`The jay scolds toward something shining in the grass, ${far} to the ${k.x > b.x ? 'south' : 'north'}.`, 4);
  }
  // Imitating a songbird: the hawk sings that species' song in its voice, and the right-hand
  // notes take on that voice too. A bird of that kind singing nearby answers.
  G.callable = () => SPECIES.filter(sp => G.heard.has(sp.id) || G.learned.has(sp.id)).map(sp => sp.id);
  G.voiceNow = () => SPECIES[G.singVoice ?? 1].voice;
  G.imitate = id => {
    const sp = SPECIES[id]; if (!sp) return;
    G.singVoice = id; playSong(sp);
    const t = W.treesIn(b.x - 300, b.x + 300).find(t => t.song?.active && t.song.sp === sp);
    if (t) t.song.next = Math.min(t.song.next, sp.notes.length * sp.gap + .8);
  };
  function hear(sp) { if (!G.heard.has(sp.id)) { G.heard.add(sp.id); store.set('heard', [...G.heard]); } }
  // the red-tail's scream: mice freeze in the open, distant hawks answer, your companion and
  // fledgling come to you
  function call() {
    if (G.callT > 0 || G.photo || G.roost) return;
    G.callT = CALL_CD; audio.scream(false, echoOf(b.x, b.y)); haptics.call(); b.peckT = .5;
    freeze.until = G.t + 5; freeze.at = G.t;
    const others = G.hawks.filter(h => Math.hypot(h.x - b.x, h.y - b.y) > 60);
    if (others.length || Math.random() < .6) audio.scream(true);
    for (const h of G.hawks) { if (h.kind === 'young') { audio.peep(); h.called = G.t; } else h.called = G.t; }
    if (G.gather) audio.scream(true);
    once('call', 'Your call carries over the valley. Mice freeze where they stand, and any hawk that knows you comes.');
  }
  // a cliff, a rock spire or a mountainside within reach sends the call back, later the further off
  function echoOf(x, y) {
    let d = Infinity;
    const sc = W.scarpNear(x, 1400); if (sc) d = Math.hypot(sc.x - x, W.groundY(sc.x) - sc.H * .5 - y);
    for (const sp of W.spiresIn(x - 1000, x + 1000)) d = Math.min(d, Math.hypot(sp.x - x, W.groundY(sp.x) - y));
    if (W.biomeAt(x).name === 'mountains') d = Math.min(d, 500 + hash(x * .01) * 400);
    return d < 1400 ? { delay: d / 343 * 1.6, vol: .5 * (1 - d / 1400) } : null;
  }
  // every clear morning but in winter, the whole wood sings at once for a few minutes
  function updateChorus(dt) {
    if (G.chorus) { if ((G.chorus.t -= dt) <= 0) G.chorus = null; return; }
    if (G.chorusDay === G.day || G.tod < .27 || G.tod > .31 || G.sea.winter > .5 || G.storm > .4) return;
    G.chorusDay = G.day;
    G.chorus = { t: CHORUS_S }; once('chorus', 'The dawn chorus: for a few minutes at sunrise every bird nearby sings. Join in and all the songs you know answer at once.', 5);
  }
  function updateSongs(dt) {
    const S = G.staff;
    let near = null, nd = 95;
    for (const t of W.treesIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
      const s = t.song; if (!s) continue;
      s.sp ??= speciesFor(t.bio, s.seed);
      const on = (active(s.sp, G.tod, G.storm, G.sea.winter) || (G.singAllT > 0 || G.chorus && s.sp.name !== 'Owl') && G.storm < .6) && b.perch !== s.perch;
      if (on !== !!s.active) { s.active = on; s.perch.occupied = on; }
      if (!on) continue;
      s.singingT = Math.max(0, (s.singingT || 0) - dt);
      s.next -= dt;
      // in a duet the bird waits while you are still answering
      if (S.duet && S.tree === t && S.tries.length && G.t - S.lastTry < 4) s.next = Math.max(s.next, 1);
      if (s.next <= 0) { s.next = G.chorus ? 2.5 + hash(G.t) * 3 : 7 + hash(G.t) * 5; sing(s.sp, s.perch, s); }
      const d = Math.hypot(s.perch.x - b.x, s.perch.y - b.y);
      if (d < nd && b.state !== 'fly') { nd = d; near = t; }
    }
    if (G.visitor) G.visitor.singT = Math.max(0, (G.visitor.singT || 0) - dt);
    updateVisitor(G, dt, v => sing(v.sp, { x: v.x, y: v.y + 3.4 }, v));
    const mode = near ? 'learn' : b.state === 'perch' && G.learned.size && G.perchT > 1.2 ? 'sing' : null;
    if (mode !== S.mode || near !== S.tree) {
      S.mode = mode; S.tree = near; S.species = near ? near.song.sp.id : null; S.tries = []; S.sang = null; S.errs = [];
      S.duet = !!near && G.learned.has(near.song.sp.id);
      if (mode === 'learn') once('song', 'A songbird! Tap Sing, listen, then find its notes on the string at the right. Hold each one in tune.', 6);
      if (S.duet) once('duet', `You know the ${near.song.sp.name}'s song: a duet. It sings the first half, you answer with the rest.`, 5);
    }
    S.wrongT = Math.max(0, S.wrongT - dt); S.doneT = Math.max(0, S.doneT - dt);
    if (S.wrongT > 0 && S.wrongT - dt <= 0) S.tries = [];
  }
  const dial = createDial();
  const callBtn = document.createElement('button'); callBtn.className = 'call-btn'; callBtn.textContent = 'Call'; callBtn.setAttribute('aria-label', 'Hawk call');
  callBtn.addEventListener('click', () => { audio.unlock(); call(); });
  const sleepBtn = document.createElement('button'); sleepBtn.className = 'sleep-btn hidden'; sleepBtn.textContent = 'Sleep'; sleepBtn.setAttribute('aria-label', 'Sleep until dawn');
  sleepBtn.addEventListener('click', () => { audio.unlock(); sleep(); });
  document.getElementById('ui').append(callBtn, sleepBtn);
  const intentions = createIntentions(G, store, { toast: ui.toast, audio, spark }); G.intentions = intentions;
  // the singing button and string, and the dots that show how far into a song you are
  const singer = createSinging({ audio, sticks, voice: () => G.voiceNow(), onNote: singNote, onMimic: mimic, onToggle: o => { G.singing = o; hudKey = ''; document.getElementById('ui').classList.toggle('singing', o); if (o) once('string', 'The pools round the right stick are song notes: touch them to sing. Round the left stick are the birds you know: touch one to sing its song.', 6); } });
  // one-thumb mode plays on the stick under the thumb you'd use: the right, or the left if left-handed
  const single = () => G.settings.oneThumb ? (G.settings.lefty ? 'L' : 'R') : null;
  const controls = createControls({ G, b, sticks, interact, call, once, single });
  // a pool round the left stick: the hawk sings that bird's song in its voice (and the notes take
  // on that voice); a bird whose song you have learned answers with its gift
  function mimic(id) {
    const sp = SPECIES[id], S = G.staff;
    if (!sp || G.t - (G.mimicT || -9) < .6) return;
    G.mimicT = G.t + sp.notes.length * sp.gap;
    G.imitate(id);
    sp.notes.forEach((n, i) => setTimeout(() => part('note', b.x + b.face * 4, b.y - 8, (hash(i + G.t) - .3) * 12, -16, 1.4, { col: shade(sp.cols.breast, .8) }), i * sp.gap * 1000));
    haptics.note(); singer.cheer(`You sing the ${sp.name}'s song`);
    if (!G.learned.has(id)) return;   // (only heard so far: its voice, but no gift yet)
    const tree = S.mode === 'learn' && S.tree?.song.sp === sp ? S.tree : null;
    setTimeout(() => { S.sang = sp; respond(sp, tree, .8); intentions.note('song'); if (G.suitor) G.courtBonus += .06; }, sp.notes.length * sp.gap * 1000 + 200);
  }
  function updateSinging(dt) {
    const S = G.staff, sp = S.mode === 'learn' ? SPECIES[S.species] : null;
    const available = !G.photo && !G.roost && b.state !== 'fly' && (b.state === 'perch' || S.mode === 'learn');
    singer.update(dt, { available, next: sp ? sp.notes[S.tries.length] ?? -1 : -1, known: G.callable().map(id => SPECIES[id]), learned: G.learned, lefty: G.settings.lefty });
    if (!singer.open) return;
    const state = S.wrongT > 0 ? 'wrong' : S.doneT > 0 ? 'done' : '', off = sp && S.duet ? Math.ceil(sp.notes.length / 2) : 0;
    if (sp) singer.progress(sp.notes.length, off + S.tries.length, state, off);
    else singer.progress(Math.max(S.tries.length, S.sang ? S.sang.notes.length : 0), S.tries.length, state);
  }

  /* ---------- the field guide and postcards: cut from the finished frame ---------- */
  // a landmark found puts a postcard in the album a moment later, once it is in the picture
  let foundIds = new Set(Object.keys(G.found)), card = null;
  function afterFrame() {
    const when = `day ${G.day}, ${seasonName(G)}`;
    for (const k of captureSightings(G, canvas, store, `First seen on ${when}, over ${placeNote(G, b.x)}.`)) ui.toast(`New in your field guide: ${pageName(k)}.`, 2.5);
    for (const id in G.found) if (!foundIds.has(id)) { foundIds.add(id); card = { t: G.t + 1.2, name: G.found[id].name, x: G.found[id].x }; }
    // the picture waits until the landmark is in view (a hawk high above it sees only sky); it gives up after a while
    const at = card && [(card.x - G.cam.x) * G.view.px, (W.groundY(card.x) - 30 - G.cam.y) * G.view.px];
    if (card && G.t > card.t + 40) card = null;
    if (card && G.t > card.t && at[0] > canvas.width * .15 && at[0] < canvas.width * .85 && at[1] > canvas.height * .3 && at[1] < canvas.height * .95) {
      try {
        const album = store.get('album', []);
        album.push({ src: postcard(canvas, card.name, `${when[0].toUpperCase()}${when.slice(1)}`, at), note: `A postcard from ${card.name}, ${when}.`, card: true });
        while (album.length > 16) album.shift();
        store.set('album', album);
        ui.toast('A postcard is in your journal\'s album.', 2.5);
      } catch { /* storage full: no postcard this time */ }
      card = null;
    }
  }

  /* ---------- HUD meters (painted on the canvas) ---------- */
  // Thirst, hunger and wings, each a pencil line with a tick for every sip or berry that would
  // fill it, and a pool of pigment washed along it as far as the meter is full. The meters live
  // on their own small canvas over the game, repainted only when they change.
  // drawn a fifth larger than the rest of the screen art, with longer bars, so they read at a glance
  const HUD_K = 1.2, BAR = 64;
  const hud = document.createElement('canvas'); hud.className = 'hud'; document.body.append(hud);
  // Quiet HUD: the meters fade away while all of them are well filled, and drift back when one
  // runs low, or for a few seconds after a touch away from the sticks (or on the meters themselves)
  let hudQuiet = false, hudWake = -9;
  canvas.addEventListener('pointerdown', e => { if (!sticks.zoneAt(e.clientX, e.clientY) || e.clientY < 90) hudWake = G.t; });
  function quietHUD() {
    const low = Math.min(G.thirst, G.hunger), tired = b.stamina < (hudQuiet ? .3 : .45);
    const q = G.settings.quiet && G.t - hudWake > 4 && !tired && (hudQuiet ? low > 50 : low > 70);
    if (q !== hudQuiet) { hudQuiet = q; hud.classList.toggle('quiet', q); }
  }
  let hudKey = '';
  // the meters start just right of the menu button, wherever the phone's cutout puts it
  let menuR = 0;
  const menuRight = () => menuR || (menuR = document.querySelector('.menu-btn')?.getBoundingClientRect().right || 54);
  addEventListener('resize', () => { menuR = 0; hudKey = ''; });
  document.fonts?.ready.then(() => { hudKey = ''; });   // repaint once the bundled fonts are in
  // a rounded bar as a polygon, so wash() can give it a wobbly edge
  const pillP = (x0, y0, w, h) => {
    const r = h / 2, p = []; w = Math.max(w, h);
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + Math.PI * i / 6; p.push([x0 + w - r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
    for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + Math.PI * i / 6; p.push([x0 + r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
    return p;
  };
  function drawHUD() {
    const P = G.P, S = G.view.scr.s * HUD_K, x = (menuRight() + 6) / S, y = 8, low = Math.sin(G.t * 6) > 0;
    const key = [Math.ceil(G.thirst), Math.ceil(G.hunger), Math.ceil(b.stamina * 50), G.thirst < 20 && low, G.hunger < 20 && low, S, G.photo, G.singing && G.settings.lefty, P.paper[0] >> 3, P.birdFar[0] >> 3, P.water[2] >> 3].join();
    if (key === hudKey) return;
    hudKey = key;
    const dpr = Math.min(devicePixelRatio || 1, 2), sc = S * dpr, W0 = x + 84, H0 = y + 36;
    if (hud.width !== Math.ceil(W0 * sc)) { hud.width = Math.ceil(W0 * sc); hud.height = Math.ceil(H0 * sc); hud.style.width = W0 * S + 'px'; hud.style.height = H0 * S + 'px'; }
    const ctx = hud.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hud.width, hud.height);
    if (G.photo) return;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const meter = (yy, v, col, ticks, seed, icon) => {
      icon(x + 5, yy + 4);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = C(P.birdFar, .4); ctx.lineWidth = .6; ctx.beginPath();
      ctx.moveTo(x + 13, yy + 4); ctx.lineTo(x + 13 + BAR, yy + 4);
      for (let i = 1; i < ticks; i++) { const tx = x + 13 + BAR * i / ticks; ctx.moveTo(tx, yy + 1.5); ctx.lineTo(tx, yy + 6.5); }
      ctx.stroke(); ctx.restore();
      const blink = v < 20 && low;
      if (v > 1) wash(ctx, pillP(x + 13, yy + 1, BAR * v / 100, 6), blink ? [190, 70, 50] : col, .72, { passes: 2, amp: .6, seed, rim: .35, rimW: .8 });
    };
    meter(y, G.thirst, P.water, 3, 3, (cx, cy) => wash(ctx, [[cx, cy - 4.5], [cx + 3, cy + .5], [cx + 2, cy + 3], [cx - 2, cy + 3], [cx - 3, cy + .5]], P.water, .9, { passes: 2, amp: .3, seed: 1, rim: .4 }));
    meter(y + 11.5, G.hunger, P.berry, 6, 5, (cx, cy) => { wash(ctx, circP(cx - 1.5, cy + 1, 2.2, 8), P.berry, .9, { passes: 2, amp: .3, seed: 2, rim: .4 }); wash(ctx, circP(cx + 1.8, cy, 2.2, 8), P.berry, .9, { passes: 2, amp: .3, seed: 4, rim: .4 }); });
    meter(y + 23, b.stamina * 100, shade(P.thermal, .8), 0, 7, (cx, cy) => wash(ctx, [[cx - 3.2, cy + 4], [cx - 1.2, cy - .5], [cx + 1.6, cy - 4], [cx + 3.4, cy - 3.2], [cx + 2.2, cy + 1], [cx - 1, cy + 4]], shade(P.thermal, .8), .9, { passes: 2, amp: .3, seed: 6, rim: .4 }));
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
    G.seasonS = (G.clockT / DAY / SEASON_DAYS + 3.75 + (G.seasonShift || 0)) % 4;   // starts at the beginning of summer
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
    W.env.thermal = G.thermalK * (G.liftT > 0 ? 1.35 : 1);
    // the evening wave over the mountains: smooth lift on calm, clear evenings
    airEnv.wave = smooth(.6, .66, G.tod) * (1 - smooth(.79, .84, G.tod)) * (1 - G.storm) * (1 - G.overcast * .6);
    G.cloudDrift += dt * (2.5 + G.wind * .2);
    G.flash = Math.max(0, G.flash - dt * 3);
    if (G.storm > .75 && G.sea.winter < .5) { G.nextBolt -= dt; if (G.nextBolt <= 0) { const cell = G.skies?.cell, km = cell ? clamp(Math.abs(cell.x - b.x) / 700 + Math.random() * .4, .3, 4) : .3 + Math.random() * 3.5; G.flash = 1 - km / 5; G.nextBolt = 6 + Math.random() * 12; audio.thunder(km / .343, km); } }
    if (G.rain > .3 && G.wet > .25 && G.sea.winter < .5) once('worms', 'Rain brings worms up. Land on open ground after rain and tap them to eat.');
    if (G.sea.autumn > .6) once('autumn', 'Autumn. The leaves are turning, and the flocks fly south.');
    if (G.sea.winter > .6) once('winter', 'Winter. Small ponds freeze, most songbirds have gone, and only some bushes keep their berries.', 6);
    if (G.sea.spring > .6) once('spring', 'Spring. Blossom, and the songbirds are back.');
    if (G.sea.winter > .35) once('snow', 'First snow. The ground is white and berries are scarce. Mice under the snow are only a faint stir: hover or kite over the grass to spot them.', 6);
  }
  function updateCritters(dt) {
    const { w, h } = G.view.scr, camDx = (G.camC.x - (G.lastCamX ?? G.camC.x)) / G.view.z; G.lastCamX = G.camC.x;
    if ((G.nextFlock -= dt) <= 0) {
      // distant flocks mostly travel the way the migration goes
      G.nextFlock = 18 + Math.random() * 25; const dir = (Math.random() < .75 ? 1 : -1) * (G.goalDir || 1);
      G.flocks.push({ x: dir > 0 ? -60 : w + 20, y: 25 + Math.random() * h * .3, dir, n: 3 + (Math.random() * 4 | 0), s: .7 + Math.random() * .5, v: 9 + Math.random() * 8 });
    }
    for (const f of G.flocks) f.x += f.dir * f.v * dt - camDx * .15;
    G.flocks = G.flocks.filter(f => f.x > -120 && f.x < w + 120);
    if ((G.nextNear -= dt) <= 0) {
      // birds dashing past the eye are a rare surprise, not traffic
      G.nextNear = 50 + Math.random() * 70; const dir = Math.random() < .5 ? 1 : -1, n = 1 + (Math.random() < .3 ? 1 : 0);
      for (let i = 0; i < n; i++) G.nearBirds.push({ x: dir > 0 ? -30 - i * 22 : w + 30 + i * 22, y: h * (.3 + Math.random() * .4), y0: 0, dir, v: 120 + Math.random() * 40, ph: Math.random() * TAU, seed: i + (Math.random() * 99 | 0), col: SPECIES[(Math.random() * SPECIES.length) | 0].cols.body });
    }
    for (const n of G.nearBirds) { n.x += n.dir * n.v * dt - camDx * 1.3; n.ph += dt * 22; n.y += Math.sin(G.t * 4 + n.seed) * 20 * dt; }
    G.nearBirds = G.nearBirds.filter(n => n.x > -100 && n.x < w + 100);
    updateFlock(G, dt, audio, once);
    updateCrows(G, dt, { audio, haptics, once }); updateFauna(G, dt, { audio, once });
    updateEncounters(G, dt, { audio, haptics, once, toast: ui.toast, store, makeHawk });
    updateGhost(G, dt, { once }); updateNight(G, dt, { audio, once }); updateSkies(G, dt, { once, haptics, audio }); updateRidge(G, dt, { once, toast: ui.toast, audio });
    if (G.spawnYoung) { G.spawnYoung = false; G.hawks.push(Object.assign(makeHawk(G.nest.x, G.nest.y - 10, 'young'), { morph: morphOf(G.nest) })); }
    G.hawks = G.hawks.filter(h => updateHawk(G, h, dt));
    if (G.hawks.some(h => h.kind === 'companion' && h.life < 1)) once('companion', 'A red-shouldered hawk, smaller than you, its tail barred black and white. Follow it: it knows where the thermals and food are.');
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
      if (keepsakesIn(G.cam.x + 40, G.cam.x + G.view.w - 40).some(k => !G.kept.has(k.id))) once('keepsake', 'Something glints in the grass: a keepsake for a nest. Land beside it and tap it to pick it up.');
    }
  }
  // night roost: perched in the evening or at night, the Sleep button sleeps until dawn
  const canSleep = () => b.state === 'perch' && (G.tod > .66 || G.tod < .2) && !G.roost && !G.photo && !singer.open;
  function sleep() { if (canSleep()) { G.roost = { t: 0, done: false, D: G.dream.length > 5 ? DREAM_S : 0 }; audio.rustle(.4); } }
  function updateRoost(dt) {
    const dark = G.tod > .72 || G.tod < .2;
    if (dark && b.state === 'fly') once('roost', 'Night is falling. Perch in a tree and tap Sleep to roost until dawn.');
    if (canSleep()) once('sleep', 'Tap Sleep (at the top) to roost here until dawn, or stay up for the night.', 5);
    if (!G.roost) return;
    const R = G.roost; R.t += dt;
    if (R.t > 1.6 + R.D && !R.done) {
      R.done = true;
      const cur = .36 + G.clockT / DAY, frac = cur % 1;
      G.clockT = ((frac > .25 ? Math.floor(cur) + 1.25 : Math.floor(cur) + .25) - .36) * DAY;
      G.thirst = Math.min(100, G.thirst + 15); G.hunger = Math.min(100, G.hunger + 15); b.stamina = 1;
      G.weather = 'sunny'; G.weatherT = 60 + Math.random() * 60; G.overcast = 0; G.storm = 0;
      updateClock(); persist(); intentions.note('roost');
      wakeAtmos(G);
      ui.toast(`Dawn, day ${G.day}. You roosted through the night.`, 3);
    }
    if (R.D && R.t > 1.5 && R.t < 1.6) once('dream', 'Asleep, the hawk dreams the day\'s flight.', 3);
    if (R.t > 4 + R.D) G.roost = null;
  }
  const roostFade = () => { const R = G.roost; if (!R) return 0; const t = R.t > 1.5 + R.D ? R.t - R.D : Math.min(R.t, 1.5); return t < 1.5 ? t / 1.5 : t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 1.6); };
  // Zoom eases out with height and speed, and back in to land. The view resizes about its centre.
  function updateZoom(dt, snap) {
    const up = W.groundY(b.x) - b.y;
    const out = b.state === 'fly' ? clamp(.7 * smooth(140, 650, up) + .5 * smooth(100, 190, b.s), 0, 1) : 0;
    // perched as the light goes, the view eases in a touch and holds; it eases back out at take-off
    const dusk = G.tod > .7 || G.tod < .22, cosy = b.state === 'perch' && dusk && G.perchT > 2 ? .86 : 1;
    const zt = G.zoomLock || (ZOOM + (ZOOM_OUT - ZOOM) * out) * cosy;   // zoomLock: set from the console for close-ups
    G.zoom = snap ? zt : G.zoom + (zt - G.zoom) * Math.min(1, dt * .5);
    setView();
  }
  // The camera follows the centre of a soft box around the hawk, with a small lead that eases
  // slowly toward its heading, so flapping, bobbing and turning barely move the picture.
  function updateCamera(dt, snap) {
    const { w, h } = G.view, C0 = G.camC;
    const leadT = b.state === 'fly' ? clamp(b.vx / 100, -1, 1) * w * .07 : 0;
    G.camLead = snap ? leadT : G.camLead + (leadT - G.camLead) * Math.min(1, dt * .6);
    const tx = b.x + G.camLead;
    const gAhead = Math.max(W.groundY(b.x), W.groundY(b.x + G.camLead));
    let ty = b.y + h * .02;
    ty = Math.min(ty, gAhead - h * .32);            // keep the ground near the bottom
    ty = Math.max(ty, W.SKY - 100 + h / 2);
    if (snap) { C0.x = tx; C0.y = ty; }
    else {
      const soft = (e, dz) => Math.sign(e) * Math.max(0, Math.abs(e) - dz) + e * .2;
      C0.x += soft(tx - C0.x, w * .05) * Math.min(1, dt * 2);
      C0.y += soft(ty - C0.y, h * .07) * Math.min(1, dt * 2.4);
      // never let the ground climb past the bottom edge
      C0.y = Math.min(C0.y, W.groundY(b.x) - h * .32 + 20);
    }
    G.cam.x = C0.x - w / 2; G.cam.y = C0.y - h / 2;
    const cg = W.groundY(C0.x);
    G.camGround = snap ? cg : G.camGround + (cg - G.camGround) * Math.min(1, dt * 1.5);
  }

  let saveT = 0;
  function step(dt) {
    G.t += dt; G.dt = dt;
    G.clockT += dt * (G.duskT > 0 ? .35 : 1); updateClock();   // a veery's gift: the evening lingers
    const raw = readInput(input);
    if (!G.roost) {
      for (const tp of raw.taps) onTap(tp);
      for (let i = 0; i < raw.flaps; i++) tapFlap(raw.face || b.face);
    }
    let steer = null;
    if (raw.steer && !G.roost) { const w = toWorld(raw.steer); steer = { wx: w.x, wy: w.y }; }
    const ctl = controls.update(raw.sticks);
    if (G.settings.oneThumb) once('onethumb', 'One thumb: tap the stick to flap. Hold it up to glide, down to land, inward to perch or hunt, outward to turn round. On a branch, tap to fly and flick sideways to hop.', 7);
    updateBird(b, dt, G.roost ? { steer: null, pitch: 0, face: 0 } : { steer: steer || ctl.steer, pitch: raw.pitch, face: raw.face, yoke: ctl.yoke }, G);
    G.perchT = b.state === 'perch' ? G.perchT + dt : 0;
    if (G.pendingEat && b.state === 'ground' && b.walkTo === null) { if (Math.abs(G.pendingEat.x - b.x) < 14) eat(G.pendingEat); G.pendingEat = null; }
    if (b.state !== 'ground') G.pendingEat = null;
    if (b.circling) once('thermal', 'A thermal: warm rising air. Hold both thumbs high to ride it up; the hawk turns back at the edges on its own.');
    // entering rising air: a pulse in the hand, and a thermal counted for the day's intention
    const inLift = b.state === 'fly' && b.air > 12;
    if (inLift && !G.wasLift) { haptics.lift(); if (b.air > 20 && G.t - (G.liftAt || -99) > 6) { G.liftAt = G.t; intentions.note('thermals'); } }
    G.wasLift = inLift;
    if (b.kiteT > .5) { once('kite', 'Kiting: held into the wind, the hawk hangs on the air. Watch the grass below, then point down to stoop.'); intentions.note('kite'); }
    if (b.state === 'fly' && b.y < W.CEILING) intentions.note('high');
    // how far the hawk has glided since its last wingbeat
    if (b.state === 'fly') { G.glideFrom ??= b.x; intentions.note('glide', undefined, Math.abs(b.x - G.glideFrom)); } else G.glideFrom = null;
    const stoop = b.state === 'fly' ? smooth(175, 250, b.s) : 0;
    haptics.stoop(stoop, G.t);
    if (W.ridgeLift(b.x, b.y) > 8 && b.state === 'fly') once('ridge', 'Ridge lift: wind meeting a hillside rises up its face. Grass and leaves streaming uphill show where. Glide along it without a wingbeat.', 6);
    if (b.wave > 8 && b.state === 'fly') once('wave', 'Wave lift: on calm evenings the air over the mountains rises in long smooth waves. The lens-shaped clouds mark each crest.', 6);
    if (G.thermalK > .06 && carve(G, b)) once('carve', 'Into the cloud. The hawk carves a tunnel through it, and the cloud slowly heals.', 5);
    if (b.kettle === 'join') once('kettle-join', 'Flying with the kettle: the wild hawks show you the strongest air, and you climb faster with them. When they peel off south, follow the line.', 6);
    else if ((G.kettleSeenT = (G.kettleSeenT || 0) - dt) <= 0) { G.kettleSeenT = 2; if (kettlesIn(G.cam.x, G.cam.x + G.view.w, G).length) once('kettle', 'A kettle: wild hawks gathering in a strong thermal on their way south, circling up together. Join them.', 6); }
    if (b.stamina < .15 && b.state === 'fly') once('tired', 'Tired wings. Glide a while, or find rising air, and your strength comes back.');
    // storms are bumpy in open air; shelter in a tree
    if (G.storm > .3 && b.state === 'fly') b.kick += fbm(G.t * 1.7, 41) * G.storm * 120 * dt;
    updateStreaks(dt);
    G.glide = G.settings.glide && b.state === 'fly' ? predictGlide(b, G) : null;

    if (!G.roost) {
      G.thirst = Math.max(0, G.thirst - dt * 100 / THIRST_S);
      G.hunger = Math.max(0, G.hunger - dt * 100 / HUNGER_S);
    }
    // nothing bad comes of an empty meter; a healthy hawk just flies a little stronger
    if (!G.roost) updateHealth(G, dt);
    G.flapPower = 1 + .12 * G.health;
    // a full-speed stoop is acrobatics too (counted once per dive)
    if (b.state === 'fly' && b.s > 235 && !G.stoopArmed) { G.stoopArmed = true; events.trick({ kind: 'stoop' }); }
    if (b.s < 150 || b.state !== 'fly') G.stoopArmed = false;
    if (G.thirst < 25) once('thirsty', 'Thirsty. Find a pond and land on the water to drink.');
    if (G.hunger < 25) once('hungry', 'Hungry. Bushes have berries, worms come up after rain, and mice and fish can be caught with a dive.');
    G.hint = b.target;
    for (const k of ['wormsT', 'followT', 'calmT', 'tailwindT', 'brightT', 'warmT', 'liftT', 'duskT', 'singAllT']) G[k] = Math.max(0, G[k] - dt);

    G.callT = Math.max(0, G.callT - dt);
    updateWeather(dt); updateChorus(dt); updateCritters(dt); updateSongs(dt); updateRoost(dt); updateZoom(dt); updateCamera(dt);
    updateSinging(dt); dial.update(G.tod, G.day, G.photo, G.score); intentions.update();
    callBtn.classList.toggle('hidden', G.photo || !!G.roost);
    sleepBtn.classList.toggle('hidden', !canSleep());
    updateJourney(G, dt, { toast: ui.toast, once, audio, spring: () => { G.seasonShift = ((3.05 - G.clockT / DAY / SEASON_DAYS - 3.75) % 4 + 4) % 4; updateClock(); } });
    updateAtmos(G, dt, { toast: ui.toast, once, place: x => placeNote(G, x) });
    updateNest(G, DAY, ui.toast);
    updateCourtship(G, dt, { toast: ui.toast, audio, makeHawk, place: placeNote(G, b.x) });
    const vr = [];
    for (const r of W.ringsIn(G.cam.x - 60, G.cam.x + G.view.w + 60)) {
      const tk = G.ringsTaken.get(r.id); r.gone = tk !== undefined && G.t - tk < RING_RESPAWN; vr.push(r);
    }
    G.visibleRings = vr;
    // the soundscape of where the hawk is: pines or cliffs in the wind, a waterfall, night frogs
    const falls = W.landmarksIn(b.x - 400, b.x + 400).find(l => l.type === 'falls') || W.scarpsIn(b.x - 400, b.x + 400).filter(sc => sc.falls).map(sc => ({ x: sc.x, y: W.groundY(sc.x) - sc.H * .5 }))[0], pondHere = W.pondNear(b.x, 2.5);
    const height = W.groundY(b.x) - b.y + hush(G) * 400;   // above the sea of cloud the ground sounds are gone
    const night = nightness(G.tod), frogs = pondHere && !W.frozen(pondHere) && night > .5 && G.sea.winter < .5 && G.rain < .5 ? clamp(1 - Math.abs(b.x - pondHere.c) / 260, 0, 1) * night : 0;
    audio.ambience(b.state === 'fly' ? clamp(b.s / 200, 0, 1) * .8 + G.storm * .3 : G.storm * .4, G.rain * (G.sea.winter > .5 ? .2 : 1), {
      bio: W.biomeAt(b.x).name, stoop, falls: falls ? clamp(1 - Math.hypot(falls.x - b.x, falls.y - b.y) / 380, 0, 1) : 0, frogs,
      height, night, sea: G.sea, fog: G.fog * fogDepth(b.x, b.y),
    });
    audio.vario(b.state === 'fly' ? b.air : 0);
    if ((saveT -= dt) <= 0) { saveT = 4; persist(); }
  }

  /* ---------- sizing and loop ---------- */
  // Resolution: device pixels per css pixel. Washes are fill-rate heavy, so it starts modest and
  // steps down while frames run slow; the level that worked is remembered for next time.
  const RES_MIN = .7;
  let res = 0, resLock = false;
  function resMax() { return Math.min(devicePixelRatio || 1, 1.6, 1500 / Math.max(innerWidth, innerHeight)) * (saverOn ? .7 : 1); }
  // Battery saver: on a low battery that isn't charging (or always, by the setting) the game
  // draws 30 frames a second at a lower resolution, and a small leaf shows by the meters.
  let saverOn = false, batteryLow = false;
  // a small leaf under the menu button while it is on (outside the meters, which fade when full)
  const saverLeaf = document.createElement('div'); saverLeaf.className = 'saver-leaf hidden'; saverLeaf.title = 'Battery saver';
  saverLeaf.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 13.5C2.6 8 6 3.4 13.2 2.6 13.4 9 9.6 13 3 13.5Z" fill="#6f8a4a" fill-opacity=".85" stroke="#3a2418" stroke-opacity=".55" stroke-width=".7"/><path d="M2.6 14.2 10.8 5.4" stroke="#3a2418" stroke-opacity=".7" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>';
  document.getElementById('ui').append(saverLeaf);
  navigator.getBattery?.().then(bt => {
    const f = () => { batteryLow = !bt.charging && bt.level <= .2; };
    f(); bt.addEventListener('levelchange', f); bt.addEventListener('chargingchange', f);
  }).catch(() => {});
  function updateSaver() {
    const on = !!G.settings.saver || batteryLow;
    if (on === saverOn) return;
    saverOn = G.saverOn = on; res = 0; resLock = false; perf.prev = 0; resize(); saverLeaf.classList.toggle('hidden', !on);
    if (on && !G.settings.saver) ui.toast('Battery low: Aloft drops to 30 frames a second to save it.', 4);
  }
  // G.view.scr is screen space, sized as the art was first drawn (300 units tall): the sky, far
  // hills, weather and HUD live there. G.view itself is the zoomed world view, and spx is the
  // fixed resolution world sprites are painted at, so zooming never repaints them.
  let scrS = 1;
  function resize() {
    const cw = innerWidth, ch = innerHeight;
    scrS = ch / 300; if (cw / scrS < 420) scrS = cw / 420;   // css px per screen unit
    if (GFX.res !== 'auto') res = Math.min(GFX.res, devicePixelRatio || 1);
    else res = clamp(res || store.get('res', 9) * 1.08, Math.min(RES_MIN, resMax()), resMax());
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * res); canvas.height = Math.round(ch * res);
    G.view.scr = { w: cw / scrS, h: ch / scrS, s: scrS, px: res * scrS };
    setView();
    stats.res = res; stats.canvas = canvas.width + '×' + canvas.height;
    const sw = G.view.scr.w, sh = G.view.scr.h;
    if (!G.paper || G.paper[0] !== Math.ceil(sw) || G.paper[1] !== Math.ceil(sh)) { makePaper(sw, sh); G.paper = [Math.ceil(sw), Math.ceil(sh)]; }
    redraw = true;
  }
  function setView() {
    const V = G.view, s = scrS / G.zoom;
    V.s = s; V.w = innerWidth / s; V.h = innerHeight / s; V.px = res * s; V.z = G.zoom;
    V.spx = res * scrS / ZOOM; V.hMax = innerHeight / (scrS / ZOOM_OUT);
  }
  // watch frame times in two-second windows; drop resolution when slow, and stop if that doesn't help
  const perf = { n: 0, sum: 0, prev: 0, settle: 0, fails: 0, step: 1 }, now = () => performance.now(), t0 = now();
  function setRes(r) { res = r; perf.settle = 1; resize(); store.set('res', res); }
  function watchFrames(ms) {
    if (resLock || GFX.res !== 'auto' || ms > 250 || saverOn) { perf.n = perf.sum = 0; return; }
    perf.n++; perf.sum += ms;
    if (perf.sum < 2000) return;
    const avg = perf.sum / perf.n; perf.n = perf.sum = 0;
    if (now() - t0 < 4000) return;
    if (perf.settle) { perf.settle--; return; }   // the window after a change repaints every sprite; don't judge it
    if (perf.prev && avg > perf.prev * .93) { resLock = ++perf.fails >= 2; perf.prev = 0; setRes(Math.min(resMax(), res / perf.step)); return; } // no better: fill rate isn't the problem
    perf.prev = 0;
    if (avg > 1000 / 55 && res > RES_MIN + .01) { perf.step = avg > 1000 / 25 ? .75 : .87; perf.prev = avg; setRes(Math.max(RES_MIN, res * perf.step)); }
  }
  let redraw = true;
  addEventListener('resize', () => { res = 0; resize(); }); resize();
  updateClock();
  G.P = palette(G.tod, 0, 0, G.sea);
  updateZoom(0, true); updateCamera(0, true);

  let last = performance.now();
  let camKey = '';
  let lastDrawn = 0;
  function frame(now) {
    updateSaver();
    if (saverOn && now - lastDrawn < 1000 / 30 - 4) { requestAnimationFrame(frame); return; }
    lastDrawn = now;
    const ms = now - last, dt = Math.min(.05, ms / 1000); last = now;
    const ta = performance.now();
    if (!G.paused) { step(dt); watchFrames(ms); }
    const t1 = performance.now();
    // while paused the picture holds still, so only repaint when photo mode pans or the view changes
    const ck = G.cam.x + ',' + G.cam.y + G.photo;
    if (!G.paused || redraw || ck !== camKey) {
      redraw = false; camKey = ck;
      G.P = palette(G.tod, G.overcast, G.storm, G.sea);
      ctx.setTransform(G.view.px, 0, 0, G.view.px, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      render(ctx, G);
      if (!G.paused) { afterFrame(); quietHUD(); }
      drawHUD();
      const f = roostFade();
      if (f > 0) { ctx.fillStyle = C([28, 30, 46], f * .92); ctx.fillRect(0, 0, G.view.w, G.view.h); }
      const R = G.roost; if (R?.D && R.t > 1.5 && !R.done) { const k = (R.t - 1.5) / R.D; dream(ctx, G, G.P, G.view.w, G.view.h, Math.min(1, k * 1.3), Math.min(1, k * 6, (1 - k) * 6)); }
    }
    if (!G.paused) { record(ms, t1 - ta, performance.now() - t1); stats.sprites = spriteCount(); }
    music.update(dt, { night: nightness(G.tod), storm: G.storm, learned: G.learned, species: SPECIES, speed: b.state === 'fly' ? b.s : 0, wind: G.wind, height: W.groundY(b.x) - b.y });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const seen = store.get('seen', null), away = seen ? (Date.now() - seen.t) / 1000 : 0;
  ui.toast(saved && away > AWAY_S ? welcome(seen.doing) : saved ? `Welcome back. Day ${G.day}, ${seasonName(G)}.` : 'A thumb on each stick in the corners: tap both together to flap, flick one sideways to turn. The menu has more.', saved ? 3 : 7);
  if (G.sharedSeed !== null) ui.toast(`A friend shared world ${G.sharedSeed}. "Start a new journey" in the menu flies it (your songs are kept).`, 6);
  else if (!saved && G.seed) ui.toast(`World ${G.seed}: new hills, new ponds. The journal has a link to share it.`, 5);
  if (innerHeight > innerWidth) ui.toast('Turn your phone sideways for a wider view.', 4);

  // handy for poking at state from the console, and for screenshot scripts
  const snap = () => { updateZoom(0, true); updateCamera(0, true); };
  const fresh = () => { b.perch = null; b.target = null; b.walkTo = null; b.s = 0; b.g = 0; };
  G.dbg = {
    treeWithSong() { for (let x = b.x; x < b.x + 20000; x += 200) for (const t of W.treesIn(x, x + 200)) if (t.song && active(speciesFor(t.bio, t.song.seed), G.tod, G.storm, G.sea.winter)) return t; },
    pond() { return W.pondsIn(b.x, b.x + 5000)[0]; },
    biome: x => W.biomeAt(x).name,
    scarp(falls) { for (let x = b.x + 200; x < b.x + 60000; x += 700) { const s = W.scarpsIn(x, x + 700).find(s => !falls || s.falls); if (s) return s; } },
    landmark(type) { for (let x = b.x + 200; x < b.x + 60000; x += 2000) { const l = W.landmarksIn(x, x + 2000).find(l => !type || l.type === type); if (l) return l; } },
    goto(x, y) { fresh(); b.state = 'fly'; b.x = x; b.y = y ?? W.groundY(x) - 120; b.s = 85; b.g = -.17; snap(); },
    trees: W.treesIn, bushes: W.bushesIn, mice: W.miceIn, twigs: W.twigsIn, perches: W.perchesIn,
    singer, sing: singNote, lanePt: lane => singer.lanePt(lane),
    perch(q) { fresh(); perchOn(b, q, G); snap(); },
    swim(p) { fresh(); b.x = p.c; b.y = p.waterY - 3; b.state = 'swim'; snap(); },
    ground() { fresh(); const bu = W.bushesIn(b.x, b.x + 5000)[0]; b.x = bu.x + 16; b.y = W.groundY(b.x) - 6; b.state = 'ground'; b.face = -1; snap(); },
    fly(y) { fresh(); b.state = 'fly'; b.y = y; b.s = 85; b.g = -.17; snap(); },
    thermal() { const t = W.thermalsIn(b.x + 200, b.x + 8000).find(t => t.rings.length); fresh(); b.state = 'fly'; b.x = t.c - t.w * .8; b.y = t.rings[0].y + 60; b.s = 85; b.face = 1; snap(); },
    time(tod) { G.clockT += (((tod - G.tod) % 1 + 1) % 1) * DAY; updateClock(); },
    season(s) { G.seasonShift = ((s - G.clockT / DAY / SEASON_DAYS - 3.75) % 4 + 4) % 4; updateClock(); },
    weather(w) { G.weather = w; G.weatherT = 999; const t = { sunny: [0, 0], cloudy: [.65, 0], stormy: [1, 1] }[w]; G.overcast = t[0]; G.storm = t[1]; },
    learnAll() { for (const sp of SPECIES) G.learned.add(sp.id); },
    power(name) { usePower(SPECIES.find(s => s.name === name)); },
    respond(name) { respond(SPECIES.find(s => s.name === name), null); },
    call, chorus() { G.chorus = { t: CHORUS_S }; G.chorusDay = G.day; }, intentions, haptics,
    crows() { G.crowT = 0; const t = W.treesIn(b.x, b.x + 3000)[0]; fresh(); b.state = 'fly'; b.x = t.x - 40; b.y = t.y - 80; b.s = 70; b.g = -.1; snap(); },
    squirrel() { const t = W.treesIn(b.x, b.x + 20000).find(squirrelTree); fresh(); b.state = 'fly'; b.x = t.x + 140; b.y = t.y - 90; b.s = 30; b.face = -1; snap(); return t; },
    keepsake() { const k = keepsakesIn(b.x + 100, b.x + 20000).find(k => !G.kept.has(k.id)); fresh(); b.x = k.x + 14; b.y = W.groundY(b.x) - 6; b.state = 'ground'; b.face = -1; snap(); return k; },
    health(v) { G.health = v; b.health = v; },
    marsh() { fresh(); b.state = 'fly'; b.x = W.JOURNEY - 1500; b.y = W.groundY(b.x) - 150; b.s = 85; b.face = 1; G.goal = 'north'; snap(); },
    trick: k => events.trick({ kind: k || 'loop' }),
    kettle(on = true) { kettle.force = on; const t = W.thermalsIn(b.x + 200, b.x + 8000).find(t => t.str >= .95) || W.thermalsIn(b.x + 200, b.x + 8000)[0]; fresh(); b.state = 'fly'; b.x = t.c - t.w * .8; b.y = t.y0 - 120; b.s = 70; b.face = 1; snap(); return t; },
    wave() { this.time(.7); this.weather('sunny'); G.overcast = G.storm = 0; airEnv.wave = 1; let c; for (let x = b.x; !c && x < b.x + 200000; x += 2000) c = lensesIn(x, x + 2000)[0]; fresh(); b.state = 'fly'; b.x = c.x - 260; b.y = -900; b.s = 70; b.face = 1; snap(); return c; },
    cloud() { this.time(.5); const c = cumuliIn(b.x + 300, b.x + 6000)[0]; fresh(); b.state = 'fly'; b.x = c.x - c.w * .7; b.y = c.y; b.s = 80; b.g = 0; b.face = 1; snap(); return c; },
    heron() { const p = W.pondsIn(b.x, b.x + 20000).find(p => p.w >= 40 && hash(p.k * 4.4 + 2) <= .32); fresh(); b.state = 'fly'; b.x = p.c - 150; b.y = p.waterY - 60; b.s = 70; b.face = 1; snap(); return p; },
  };
  Object.assign(G.dbg, encDebug(G, { fresh, snap }), ghostDebug(G, { fresh, snap }), skiesDebug(G, { fresh, snap }), { ridge() { fresh(); b.state = 'fly'; b.x = RIDGE.x0 + 500; b.y = W.groundY(b.x) - 120; b.s = 85; b.face = 1; snap(); } });
  window.__aloft = G;
  return G;
}
