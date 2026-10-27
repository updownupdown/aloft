// Aloft: a hawk riding thermals over hills, woods and lakes, flown with two thumbs as two
// wings. This file boots the game and runs the frame; everything else is a system.
//
// A system is a function (G) => { id, update?(dt, c), scene?(S), save?(), load?(o) }, listed
// in SYSTEMS below. It can add HUD meters and tips (G.hud), menu tabs and rows (G.menu),
// instanced shapes (G.R.shape(name, triangles), then push 8 floats per instance into
// S.props[name]: x, y, z, scale, yaw, tint, turn, phase), points (S.motes: x, y, z, r, g, b,
// size) and particles (G.part()). It listens and speaks on the bus: G.on(name, fn) and
// G.emit(name, ...args). Events: flap, takeoff, land, bump, leaves, splash, ring, catch,
// newDay, season, pause, resume, gesture, trick ('stoop' or 'wingover').
// Weather (sys/weather.js) sets G.rain, G.storm, G.windK (0..1); the tail colour reads G.tailRed.
import { createGL } from './gl.js';
import { createRenderer, treeSway } from './render.js';
import { createPerf } from './perf.js';
import { createInput } from './input.js';
import { createHawk, step, perchAhead } from './flight.js';
import { height, WATER, WIND, thermalsNear, forest, treesNear, perchesOf, solidsNear, toXZ, EARTH } from './world.js';
import { BIRD } from './hawk.js';
import { polesSystem } from './sys/poles.js';
import { createAudio } from '../src/audio.js';
import { createMusic } from '../src/music.js';
import { store, clamp } from './util.js';
import { clockSystem } from './sky.js';
import { createHud } from './hud.js';
import { createMenu } from './menu.js';
import { createCamera } from './camera.js';
import { airSystem } from './sys/air.js';
import { ringsSystem } from './sys/rings.js';
import { foodSystem } from './sys/food.js';
import { aimSystem } from './sys/aim.js';
import { songsSystem } from './sys/songs.js';
import { momentsSystem } from './sys/moments.js';
import { appRows } from './app.js';
import { guideSystem } from './sys/guide.js';
import { journeySystem } from './sys/journey.js';
import { storySystem } from './sys/story.js';
import { ruinsSystem } from './sys/ruins.js';
import { howtoSystem } from './sys/howto.js';
import { weatherSystem } from './sys/weather.js';
import { faunaSystem } from './sys/fauna.js';
import { landsSystem } from './sys/lands.js';
import { seasonsSystem } from './sys/seasons.js';
import { glowSystem } from './sys/glow.js';
import { landAirSystem } from './sys/landair.js';
import { watersSystem } from './sys/waters.js';
import { findwaterSystem } from './sys/findwater.js';
import { crittersSystem } from './sys/critters.js';
import { huntersSystem } from './sys/hunters.js';
import { windsSystem } from './sys/winds.js';
import { floraSystem } from './sys/flora.js';
import { bushesSystem } from './sys/bushes.js';
import { sleepSystem } from './sys/sleep.js';
import { feelSystem } from './sys/feel.js';
import { batterySystem } from './sys/battery.js';
import { speciesSystem } from './sys/species.js';
import { aimsSystem } from './sys/aims.js';
import { movesSystem } from './sys/moves.js';
import { lifeSystem } from './sys/life.js';
import { ledgerSystem } from './sys/ledger.js';
import { neighboursSystem } from './sys/neighbours.js';
import { lessonsSystem } from './sys/lessons.js';
import { fieldsSystem } from './sys/fields.js';
import { skyDaysSystem } from './sys/skydays.js';
import { raptorsSystem } from './sys/raptors.js';
import { wingcraftSystem } from './sys/wingcraft.js';
import { stillSystem } from './sys/still.js';
import { swellsSystem } from './sys/swells.js';
import { cuesSystem } from './sys/cues.js';
import { windCuesSystem } from './sys/windcues.js';
import { waySystem } from './sys/way.js';
import { berriesSystem } from './sys/berries.js';
import { sealifeSystem } from './sys/sealife.js';
import { driftSystem } from './sys/drift.js';
import { islesSystem } from './sys/isles.js';
import { skyRiversSystem } from './sys/skyrivers.js';
import { nightSeaSystem } from './sys/nightsea.js';
import { hiddenSystem } from './sys/hidden.js';
import { natureSystem } from './sys/nature.js';
import { cavesSystem } from './sys/caves.js';
import { growthSystem } from './sys/growth.js';
import { questsSystem } from './sys/quests.js';
import { findsSystem } from './sys/finds.js';
import { errandsSystem } from './sys/errands.js';
import { loreSystem } from './sys/lore.js';
import { oceanSystem } from './sys/ocean.js';
import { visitorsSystem } from './sys/visitors.js';
import { agesSystem } from './sys/ages.js';
import { AGE_ID, AGE_SKIP, ageName } from './ages.js';
import { createLooks } from './look.js';

const SYSTEMS = [speciesSystem, movesSystem, lifeSystem, clockSystem, weatherSystem, watersSystem, windsSystem, floraSystem, bushesSystem, airSystem, ringsSystem, foodSystem, findwaterSystem, aimSystem, sleepSystem, feelSystem, batterySystem, songsSystem, momentsSystem,
  guideSystem, journeySystem, storySystem, ruinsSystem, howtoSystem, faunaSystem, neighboursSystem, landsSystem, seasonsSystem, glowSystem, landAirSystem, crittersSystem, huntersSystem, aimsSystem,
  fieldsSystem, skyDaysSystem, raptorsSystem, wingcraftSystem, stillSystem, swellsSystem, berriesSystem, cuesSystem, windCuesSystem, waySystem, polesSystem,
  sealifeSystem, driftSystem, islesSystem, skyRiversSystem, nightSeaSystem, lessonsSystem, hiddenSystem, natureSystem, cavesSystem, growthSystem, questsSystem, findsSystem, errandsSystem, loreSystem, oceanSystem, visitorsSystem, agesSystem, ledgerSystem];

// Where each bird first flies, in its own land (earth.js toXZ: latitude, longitude): the
// red-tail at a forest edge in the Finger Lakes, the osprey over a Scottish loch, the barn owl in
// the Loire farmland, the raven over a Norwegian fjord, the royal albatross on Taiaroa Head (its one
// mainland colony, at the mouth of Otago Harbour). Then the nearest open ground to start over.
const STARTS = { hawk: [42.6, -76.7], osprey: [57.2, -4.5], owl: [47.4, 0.7], raven: [61.2, 7], albatross: [-45.775, 170.73] };
export function startOf(bird) {
  const [x0, z0] = toXZ(...(STARTS[bird] || STARTS.hawk)) || [0, 0];
  for (let i = 0; i < 400; i++) {
    const a = i * 2.39996, r = i * 12, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, h = height(x, z);
    if (h > 3 && h < 90 && forest(x, z) < .25) return [Math.round(x), Math.round(z)];
  }
  return [Math.round(x0), Math.round(z0)];
}

export function start(canvas, ui) {
  const gl = createGL(canvas, !/[?&]aa=0/.test(location.search));   // (?aa=0: no multisampling, to measure what it costs)
  if (!gl) { ui.innerHTML = '<div class="card3"><h1>Tiercel</h1><p>This browser has no WebGL2, which Tiercel needs. Try Chrome or a newer phone browser.</p></div>'; return; }
  const R = createRenderer(gl), input = createInput(canvas);
  const audio = createAudio(), music = createMusic(audio);
  audio.on = store.get('sound', true);
  music.setMode(store.get('musicMode', 'valley'));
  // Saves are not kept across big changes yet (experimental): one from before the Earth world
  // (no home in it) is dropped, and the bird starts afresh in its own land
  let S0 = store.get('save3d', null);
  if (S0 && !S0.home) { S0 = null; store.set('save3d', null); }
  const home = S0?.home || startOf(BIRD !== 'hawk' ? BIRD : store.get('bird', 'hawk'));
  const b = createHawk(home[0], home[1]);

  // ---- the game object and its bus --------------------------------------------------------
  const listeners = new Map();
  const G = {
    b, R, home, startOf, audio, music, input, store, t: 0, clock: 0, paused: false, parts: [], flags: store.get('flags3d', {}),
    settings: { sound: audio.on, music: store.get('music', true), invert: store.get('invert3d', false), fps: store.get('fps3d', false), fpsCap: store.get('fpsCap3d', store.get('fullRate3d', false) ? 90 : 60) },
    age: AGE_ID, ageName, timeless: AGE_ID !== 'earth',   // the age (ages.js): meters stand still outside the present
    res: 1, systems: {}, fresh: !S0,   // fresh: a new journey (sys/lessons.js starts the first flight)
    on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    emit: (name, ...a) => { for (const fn of listeners.get(name) || []) fn(...a); },
    part: (p, v, life, col, size) => { if (G.parts.length < 400) G.parts.push({ p: [...p], v, life, max: life, col, size }); },
  };
  G.perf = R.prof = createPerf(gl);   // Settings > Advanced > Frame cost
  if (/[?&]perf=deep/.test(location.search)) G.perf.deep = true;
  G.hud = createHud(G, ui, input);
  G.menu = createMenu(G, ui);
  const camera = createCamera(G);
  const systems = SYSTEMS.filter(f => !AGE_SKIP.has(f.name)).map(f => f(G));   // (some belong only to the present, or to a living Earth)
  for (const s of systems) G.systems[s.id] = s;

  // ---- save and resume -----------------------------------------------------------------
  // a new journey begins on a branch near home, for the first flight (sys/lessons.js); with no tree
  // near, on the ground
  if (!S0) {
    const t = treesNear(b.p[0], b.p[2], 250).sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0];
    const p = t && perchesOf(t).find(q => !q.top);
    if (p) Object.assign(b, { state: 'perch', perch: p, tree: t, p: [p.x, p.y + .14, p.z], s: 0 });
    else { b.state = 'ground'; b.p[1] = Math.max(height(b.p[0], b.p[2]), WATER) + .35; }
  }
  else {
    Object.assign(b, { p: S0.p, yaw: S0.yaw, state: 'ground', stamina: S0.stamina ?? 1 });
    b.p[1] = Math.max(height(b.p[0], b.p[2]), WATER) + .35;
    G.clock = S0.clock || 0;
    if (S0.perch) { const t = treesNear(b.p[0], b.p[2], 3)[0]; if (t) { b.state = 'perch'; b.perch = perchesOf(t).filter(p => !p.top).sort((a, q) => Math.hypot(a.x - b.p[0], a.y - b.p[1], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.y - b.p[1], q.z - b.p[2]))[0]; b.p = [b.perch.x, b.perch.y + .14, b.perch.z]; } }
    for (const s of systems) if (s.load && S0.sys?.[s.id]) s.load(S0.sys[s.id]);
  }
  function persist() {
    if (G.resetting) return;   // a new journey or world has cleared the save; the reload must not write it back
    const sys = AGE_SKIP.size ? { ...(store.get('save3d')?.sys || {}) } : {};   // (what the systems left out of this age saved stays)
    for (const s of systems) if (s.save) sys[s.id] = s.save();
    store.set('save3d', { p: b.p, yaw: b.yaw, stamina: b.stamina, clock: G.clock, perch: b.state === 'perch', home: G.home, sys });
    store.set('flags3d', G.flags);
  }
  G.persist = persist;

  // ?res=1&full=1 pins the resolution and lifts the cap, for measuring
  const qs = new URLSearchParams(location.search);
  if (qs.has('full')) G.settings.fpsCap = qs.get('full') !== '0' ? 240 : 60;
if (qs.has('fps')) G.settings.fpsCap = +qs.get('fps') || 60;
  G.pinRes = qs.has('res') ? +qs.get('res') : null; if (G.pinRes) G.res = G.pinRes;
  input.invert = G.settings.invert;
  music.setOn(G.settings.music);
  let touchedAt = 0;   // the last touch or key: resting (below) waits a few seconds after it
  input.onAny = () => { audio.unlock(); G.emit('gesture'); touchedAt = G.touchedAt = performance.now(); };
  G.touchedAt = 0;   // still.js: how long the player has left the phone alone
  G.on('gesture', () => audio.unlock());

  // ---- flight events -------------------------------------------------------------------------
  const H = G.hud;
  // one button to take off, top centre, whenever the hawk is perched, on the ground or on the water
  // (3d.css styles it with the rest of the UI; it hides with the menu)
  ui.insertAdjacentHTML('beforeend', `<button class="takeoff3 gone" aria-label="Take off">Take off</button>`);
  const takeoffBtn = ui.querySelector('.takeoff3:not(.sleep3):not(.eat3)');
  const takeoff = e => { e.preventDefault(); e.stopPropagation(); audio.unlock?.(); b.wantOff = .6; };   // flight.js takes off as soon as it can
  takeoffBtn.addEventListener('pointerdown', takeoff);
  // the actions other UI can offer (menu.js's one action button): run() and when() it fits now
  (G.actions ||= {}).takeoff = { run: () => { audio.unlock?.(); b.wantOff = .6; }, when: () => b.state !== 'fly' && !(b.settle > 0) };
  const E = {
    get sun() { return G.light.daylight; },
    flap: (q, side, sync) => { audio.flap(); H.did('flap'); G.emit('flap', q, side); if (sync != null) wingGlow(sync); },
    tired: () => H.glint('Wings spent', 'Your wings are spent. Glide or find rising air while they recover.', 'stamina'),
    takeoff: () => { audio.rustle(.4); G.emit('takeoff'); },
    land: kind => {
      if (kind === 'water') audio.splash(false); else if (kind === 'perch') { audio.rustle(.8); audio.thump(.2); } else audio.thump(.3);
      G.emit('land', kind);
    },
    bump: (p, what) => {
      audio.thump(.5); for (let i = 0; i < 5; i++) G.part(p, [(Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3], 1.5, [.45, .32, .2], .06);
      if (what === 'trunk') H.glint('Bonk', 'Bonk. Trunks are hard: aim for the gaps, or slow down and land on a limb.', 'how');
      G.emit('bump', what);
    },
    leaves: (p, s) => { audio.brush(.6 + Math.min(.6, s / 20)); for (let i = 0; i < 8; i++) G.part(p, [(Math.random() - .5) * 4, Math.random() * 2, (Math.random() - .5) * 4], 1.2, [.4, .55, .25], .07); G.emit('leaves'); },
    barrel: () => { audio.rustle(.7); H.did('barrel'); },
    barrelDone: () => { G.emit('trick', 'barrel'); if (!G.flags.barrel) { G.flags.barrel = 1; H.glint('Barrel roll', 'A barrel roll! Both wings round together, a full turn.', 'turn'); } },
    splash: (p, s) => { audio.splash(s > 15); for (let i = 0; i < 10; i++) G.part([p[0], WATER, p[2]], [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], .9, [.85, .92, .95], .06); G.emit('splash'); },
  };
  G.E = E;

  // travel (the Map's Fast-travel): the menu shuts, the view fades to black, the hawk is set down on
  // the nearest perch to the spot (a branch, a bush, a stone; within TRAVEL_R m), else on the
  // ground or the water there, and the view fades back in
  const TRAVEL_R = 45;
  ui.insertAdjacentHTML('beforeend', '<div class="fade3" style="position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .4s;z-index:30"></div>');
  const fade = ui.querySelector('.fade3');
  G.travelTo = (x, z, done) => {
    G.menu.set(false); fade.style.pointerEvents = 'auto'; fade.style.opacity = 1;
    setTimeout(() => {
      let best = null, bd = TRAVEL_R;
      const near = (p, t) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { p, t }; } };
      for (const t of treesNear(x, z, TRAVEL_R)) for (const p of perchesOf(t)) if (!p.top) near(p, t);
      for (const o of solidsNear(x, z, TRAVEL_R)) if (o.perch) near(o.perch, null);
      Object.assign(b, { s: 0, vy: 0, gamma: 0, roll: 0, settle: 0, hop: 0, acc: 0, sPrev: 0, from: null, aimPerch: null, goTo: null, wantOff: 0, canopy: 0, snapCam: true });
      if (best) { b.state = 'perch'; b.perch = best.p; b.tree = best.t; b.p = [best.p.x, best.p.y + .14, best.p.z]; }
      else {
        const g = height(x, z); b.perch = b.tree = null;
        if (g < WATER) { b.state = 'swim'; b.p = [x, WATER + .12, z]; } else { b.state = 'ground'; b.p = [x, g + .35, z]; }
      }
      G.systems.clock.reseason?.();   // a new place, its own season straight away
      done?.();
      setTimeout(() => { fade.style.opacity = 0; fade.style.pointerEvents = 'none'; }, 250);
    }, 450);
  };

  // ---- HUD and menu rows for the core -----------------------------------------------------
  const setWings = H.meter('wings', { label: 'wings', colour: 'linear-gradient(90deg,#8a6240,#b8862f)' });
  // how well paired the last two-thumb flap was: the wings bar glows green, blue, orange or red a moment
  let glow = '', glowT = 0;
  function wingGlow(sync) { glow = sync > .8 ? '#5fd17a' : sync > .55 ? '#5aa9ff' : sync > .3 ? '#ffa64a' : '#ff5a4a'; glowT = .7; }
  H.tip('flap', () => b.state !== 'fly', 'Tap Take off (bottom right) to fly. Then tap both thumbs at once to flap.');
  H.tip('bank', () => b.state === 'fly', 'Two thumbs, two wings: tip one up and the other down to bank and turn.');
  H.tip('climb', () => b.state === 'fly', 'Push both thumbs up to climb, both down to dive.');
  H.tip('tuck', () => b.state === 'fly' && b.p[1] - height(b.p[0], b.p[2]) > 30, 'Slide your thumbs together to fold your wings for a fast glide; together and down to stoop.');
  H.tip('flare', () => !!G.perchMark, 'A perch ahead. Slide your thumbs apart to spread your wings and slow down; apart and down to brake onto it.');
  H.tip('hop', () => b.state === 'perch' && G.aim?.hops?.length > 0, 'Tap a green ring to hop to that branch. Drag sideways to turn round.');
  H.tip('ground', () => b.state === 'ground' && !(b.settle > 0), 'On the ground, tap a spot near by to hop over to it. Drag to turn round; pinch to see more or less round you.');
  const play = 'play';
  G.menu.tab(play, 'Play');
  G.menu.toggle(play, { label: 'Sound effects', sub: 'birds, wind, wings and calls', get: () => G.settings.sound, set: v => { G.settings.sound = v; audio.setOn(v); store.set('sound', v); } });
  G.menu.toggle(play, { label: 'Music', get: () => G.settings.music, set: v => { G.settings.music = v; music.setOn(v); store.set('music', v); } });
  // volumes: music, the wind, and the birds with every other sound
  // (the wind's slider was rescaled on 10-24, so its old setting doubles once, under a new key)
  const old = store.get('vol.wind', null); if (old != null && store.get('vol.wind2', null) == null) store.set('vol.wind2', Math.min(1, old * 2));
  const KEY = { wind: 'vol.wind2' };
  for (const [k, label] of [['music', 'Music volume'], ['wind', 'Wind volume'], ['rain', 'Rain volume'], ['fx', 'Birds and effects']]) {
    const key = KEY[k] || 'vol.' + k;
    audio.vol[k] = store.get(key, audio.vol[k]);
    G.menu.range(play, { label, get: () => audio.vol[k], set: v => { audio.setVol(k, v); store.set(key, v); } });
  }
  G.menu.toggle(play, { label: 'Invert climb and dive', sub: 'thumbs up to dive', get: () => G.settings.invert, set: v => { G.settings.invert = input.invert = v; store.set('invert3d', v); } });
  // Frame rate: a cap of 30, 60 or 90 frames a second; fewer frames, less battery
  if (G.settings.fpsCap < 30) G.settings.fpsCap = 30;
  G.menu.choice(play, { label: 'Frame rate', options: [[30, '30'], [60, '60'], [90, '90']], get: () => G.settings.fpsCap,
    set: v => { G.settings.fpsCap = v; store.set('fpsCap3d', v); },
    sub: v => v <= 30 ? 'frames a second: 30 saves the most battery' : v >= 90 ? 'frames a second: 90 is smoothest, uses the most battery' : 'frames a second: smooth, a fair battery' });
  // Clouds (clouds.js): soft volumes, and with them the fog as a layer of mist (James, 10-23);
  // ?clouds=poly (the old see-through polygons, lightest), facet or billow tries another for a visit
  const cq = new URLSearchParams(location.search).get('clouds');
  R.cloudStyle = ['poly', 'facet', 'billow'].includes(cq) ? cq : 'soft';
  G.dev?.add({ id: 'clouds-volume', area: 'World', title: 'Clouds as soft volumes, fog as valley mist', how: 'Fly into a cloud; on a misty morning climb out of the valley fog. Dev tools > Frame cost shows the clouds pass.' });
  G.settings.rest = store.get('rest3d', true);
  G.menu.toggle(play, { label: 'Rest at 30 fps', sub: 'perched or on the ground and left alone a few seconds: half the frames, less battery', get: () => G.settings.rest, set: v => { G.settings.rest = v; store.set('rest3d', v); } });
  G.menu.toggle(play, { label: 'Show frame rate', get: () => G.settings.fps, set: v => { G.settings.fps = v; store.set('fps3d', v); H.showFps(v); } });
  // one way to start over: every aloft. key goes (journey, journal, world seed, settings), as on the first
  // launch; three taps, each saying how many are left (James, 2026-10-24)
  const ASK = ['Reset all game data ', 'Tap twice more to erase everything ', 'Tap once more: this can’t be undone '];
  const reset = G.menu.button(play, { label: 'Reset all game data', sub: 'your journey, journal, world and settings, as on the first launch', group: 'play', onClick: el => {
    const n = (+el.dataset.taps || 0) + 1;
    if (n < 3) { el.dataset.taps = n; el.firstChild.textContent = ASK[n]; el.classList.add('warn3'); return; }
    G.resetting = true;
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('aloft.')) localStorage.removeItem(k); } catch { /* private mode */ }
    const u = new URL(location.href); u.searchParams.delete('seed'); location.replace(u.href);
  } });
  G.menu.onOpen(() => { delete reset.dataset.taps; reset.firstChild.textContent = ASK[0]; reset.classList.remove('warn3'); });
  appRows(G);
  createLooks(G, R);   // Ultra's reflections and High's shore foam (look.js)
  G.dev?.add({ id: 'frame-cost', area: 'Settings and performance', round: 'R8', title: 'Frame cost: milliseconds per system and per render pass', how: 'Fly a minute, then Settings > Advanced > Frame cost. GPU times show where the phone offers timer queries; add ?perf=deep to time them anyway (slower).' });
  G.dev?.add({ id: 'gpu-order', area: 'Settings and performance', round: 'R8', title: 'Cheaper drawing: solid things first with no discard, nearest ground first, sky last', how: 'Nothing to see: the same picture, less GPU work. Compare battery use (Settings) with the readings from before.' });
  G.dev?.add({ id: 'rest-30', area: 'Settings and performance', round: 'R8', title: 'Rest at 30 fps when perched or on the ground and untouched', how: 'Settings > Show frame rate, perch and leave the phone 5 s: 30; touch: back to your cap. Settings > Rest at 30 fps turns it off.' });
  G.dev?.add({ id: 'heat-guard', area: 'Settings and performance', round: 'R8 G2', title: 'Heat guard: resolution steps down early when late frames creep up', how: 'Graphics on Auto, play 20+ minutes: Frame cost shows late frames and "heat guard on" when it acts.' });
  G.dev?.add({ id: 'wings-map', area: 'Flight', round: 'Controls 10-22', title: 'Each thumb is a wing: spread wide to soar, spread and down to brake, folded for a fast glide, folded and down to stoop, folded and up to zoom', how: 'Lessons > Flying shows every wing position. Try each in flight.' });
  G.dev?.add({ id: 'barrel', area: 'Flight', round: 'Controls 10-22', title: 'Barrel roll: left stick down, right up, both a full circle anticlockwise (or the mirror, clockwise)', how: 'In flight at speed, turn both thumbs round together. Z / X on a keyboard.', go: () => { input.keyBarrel = 1; } });
  G.dev?.add({ id: 'soar-thermal', area: 'Flight', round: 'Controls 10-22', title: 'Ride thermals by soaring: wider thermals, spread wide and steer to circle; no auto-circling, no vario beeps', how: 'Find a thermal, spread both thumbs out, tip one slightly lower. The red arrows by your height show the lift.', go: () => window.__aloft3d?.dbg.thermal() });
  H.showFps(G.settings.fps);
  G.on('pause', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); audio.suspend(); G.menu.set(true); } else audio.resume(); });
  addEventListener('pagehide', persist);

  // tricks (the story, the life goals): a full stoop, a wingover (a hard
  // bank one way then the other)
  let stooping = false, lastBank = 0, lastBankT = -9;
  function tricks() {
    if (b.state !== 'fly') { stooping = false; return; }
    if (!stooping && b.s > 30 && b.tuck > .7) { stooping = true; G.emit('trick', 'stoop'); }
    if (stooping && b.s < 18) stooping = false;
    const side = b.roll > .8 ? 1 : b.roll < -.8 ? -1 : 0;
    if (side && side !== lastBank) { if (lastBank && G.t - lastBankT < 2) G.emit('trick', 'wingover'); lastBank = side; lastBankT = G.t; }
  }

  // ---- the frame ---------------------------------------------------------------------------
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2) * G.res;
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  }
  addEventListener('resize', resize); resize();
  let last = performance.now(), saveT = 0, resT = 0, frames = 0, owe = 1e9, prevRaf = 0;
  // Auto graphics (Settings > Graphics: Auto): when the resolution has already dropped as far as it
  // goes and the frames are still slow, step the level down; long smooth at full resolution, step it
  // up. Quick in the first 20 seconds, gentle after, and never twice within 20 seconds.
  let lowT = 0, highT = 0, sinceT = 0, playT = 0;
  // Heat guard (Auto graphics): a phone that warms up slows down in fits, so late frames (well past
  // their time) creep up before the average frame rate drops. When they pass 4% (over about half a
  // minute), the resolution steps down early, and holds there two minutes before it may come back.
  let late = 0, heat = 0, guardT = 0, capWas = 0, mixed = false, drawnAt = 0, upT = 0, downAgo = 99;
  function autoQuality(fps, target) {
    const W = 1.5; playT += W; sinceT += W;
    if (G.gfx?.preset !== 'auto' || G.pinRes) return;
    lowT = G.res <= .6 && fps < target ? lowT + W : Math.max(0, lowT - W);
    highT = G.res >= 1 && fps > target + 3 ? highT + W : 0;
    if (sinceT < 20) return;
    const lv = G.gfx.level;
    if (lowT >= (playT < 30 ? 6 : 9) && lv > 0) { G.emit('gfxAuto', lv - 1); lowT = highT = sinceT = 0; }
    else if (highT >= 45 && lv < 2) { G.emit('gfxAuto', lv + 1); lowT = highT = sinceT = 0; }
  }
  // the level also sets how far trees are drawn, how far they keep their detailed mesh, and where
  // they turn to flat pictures (render.js updateTrees; Ultra keeps the meshes farthest)
  const treeGfx = lv => {
    const u = G.gfx?.preset === 'ultra', i = lv ?? 1;
    R.treeView = u ? 540 : [300, 400, 460][i]; R.nearTrees = 110 * [.7, 1, 1.2][i] * (u ? 1.15 : 1); R.flatTrees = u ? 400 : [150, 210, 280][i];
  };
  G.on('gfx', treeGfx); treeGfx(G.gfx?.level);

  function frame(now) {
    requestAnimationFrame(frame);
    // the frame rate cap (Settings > Frame rate): frames are owed at the cap's pace and drawn on the
    // screen refresh that comes due, so 60 on a 90 Hz screen is 60, not every other refresh (45)
    // resting (Settings > Rest at 30 fps): perched or standing, untouched for 4 s, 30 is plenty
    const rest = G.settings.rest && b.state !== 'fly' && !(b.settle > 0) && now - touchedAt > 4000 && !G.singing && !G.camSing && !G.paused;
    const cap = G.capNow = rest ? Math.min(30, G.settings.fpsCap) : G.settings.fpsCap;
    if (cap !== capWas) { mixed = true; capWas = cap; }
    const gap = 1000 / cap;
    owe = Math.min(gap * 2, owe + now - (prevRaf || now)); prevRaf = now;
    if (owe < gap - 1.5) return;
    owe = Math.max(0, owe - gap);
    const dt = Math.min(.075, (now - last) / 1000); last = now;   // room for 15 fps (.067) so the game keeps time
    // paused (the menu open): the wind and water fade right out, the music slowly (and back after)
    if (G.paused) { audio.ambience(0, 0, { menu: true }); music.hold(G.menu.open); return; }
    const pf = G.perf; pf.begin();
    G.t += dt; G.clock += dt;
    frames++; resT += dt;
    if (drawnAt && now - drawnAt > gap * 1.6) late++;
    drawnAt = now;
    if (resT > 1.5) {
      const fps = frames / resT, lateShare = late / frames; frames = 0; resT = 0; late = 0;
      const target = Math.min(cap, 90) * .9 - 1;   // 60: 53, 90: 80, 30: 26
      // a window that went into or out of resting says nothing about the phone: skip it
      if (mixed) mixed = false;
      else {
        guardT = Math.max(0, guardT - 1.5); heat += (lateShare - heat) * .05;
        const auto = !G.pinRes && (G.gfx?.preset ?? 'auto') === 'auto';
        // (back up only after two smooth windows in a row and 9 s after the last step down: on a
        // phone right at the edge it hunted down and up every few seconds, and every resize of the
        // canvas is a hitch)
        upT = fps > target + 4 ? upT + 1 : 0; downAgo += 1.5;
        if (G.pinRes) { /* pinned */ } else if (fps < target && G.res > .5) { G.res = Math.max(.5, G.res - .1); resize(); downAgo = 0; }
        else if (auto && heat > .04 && G.res > .5 && !guardT) { G.res = Math.max(.5, G.res - .1); resize(); guardT = 120; heat = .02; downAgo = 0; }
        else if (upT >= 2 && downAgo >= 9 && G.res < 1 && !guardT) { G.res = Math.min(1, G.res + .05); resize(); upT = 0; }
        autoQuality(fps, target);
      }
      H.fps(fps); G.stats = { fps, res: G.res, chunks: R.stats.chunks, tris: R.stats.tris };
      pf.note = `${fps.toFixed(0)} fps of ${cap}${rest ? ' (resting)' : ''} · resolution ${Math.round(G.res * 100)}% · late frames ${(heat * 100).toFixed(1)}%${guardT ? ' · heat guard on' : ''} · main thread ${pf.cpu.toFixed(1)} ms${pf.gpu != null ? ` · GPU ${pf.gpu.toFixed(1)} ms` : ''} (${pf.gpuHow})`;
    }

    pf.lap('Core', 'frame rate, resolution');
    input.gyroOn = b.state === 'perch' && b.settle <= 0 && !(G.singing || G.camSing);   // not while singing: tapping notes shakes the phone
    const c = input.read();
    if (G.noControl) Object.assign(c, { pitch: 0, roll: 0, yaw: 0, keyRoll: 0, dragX: 0, dragY: 0, spread: 0, flap: null, held: false, both: false, barrel: 0 });   // the thumbs taken a moment (sys/poles.js: crossing a pole)
    pf.lap('Core', 'input');
    G.systems.clock.update(dt, c);
    pf.lap('Systems', 'clock');
    // the wind (world.js WIND, its strength from the weather): flight drifts with it and lands by it
    { const ws = (G.windK ?? .3) * 6 / Math.hypot(WIND[0], WIND[2]), pw = G.poleWind || [0, 0], sw = G.skyWind || [0, 0]; b.wind = [WIND[0] * ws + pw[0] + sw[0], WIND[2] * ws + pw[1] + sw[1]]; }   // sw: a sky river (sys/skyrivers.js)
    step(b, c, dt, E);
    // the world wraps east to west (earth.js): over the open Pacific the bird is moved round
    if (Math.abs(b.p[0]) > EARTH.W / 2) {
      const dx = -Math.sign(b.p[0]) * EARTH.W;
      b.p[0] += dx; if (b.from) b.from[0] += dx; b.snapCam = true;
      for (const p of G.parts) p.p[0] += dx;
      G.emit('wrap', dx);
    }
    if (Math.abs(c.roll) > .5) H.did('bank');
    if (Math.abs(c.pitch) > .5) H.did('climb');
    if (c.spread < -.5) { H.did('tuck'); H.did('aim'); }
    if (c.spread > .5) H.did('flare');
    G.perchMark = perchAhead(b);
    tricks(dt);
    pf.lap('Core', 'flight');
    for (const s of systems) if (s.id !== 'clock' && s.update) { s.update(dt, c); pf.lap('Systems', s.id); }

    for (const p of G.parts) { p.life -= dt; p.v[1] -= 1.5 * dt; for (let k = 0; k < 3; k++) p.p[k] += p.v[k] * dt; }
    G.parts = G.parts.filter(p => p.life > 0);
    pf.lap('Core', 'particles');

    // the scene: light, camera and hawk, then whatever each system adds
    const S = { ...G.light, time: G.t, wind: (G.windK ?? .3) + (G.gustWind || 0), fogDen: .0042 + .0012 * (G.light.night || 0), autumnCol: [.8, .5, .22], props: {}, motes: [] };
    // perched in a tree, the bird rides its limb's sway (render.js INST_VS), so it never seems to slide
    if (b.state === 'perch' && b.tree && b.perch) { const [dx, dz] = treeSway(b.tree, b.perch.y, S.time, S.wind); b.p[0] = b.perch.x + dx; b.p[2] = b.perch.z + dz; }
    camera.update(dt, S);
    pf.lap('Core', 'camera, hawk pose');
    for (const s of systems) if (s.scene) { s.scene(S); pf.lap('Systems', s.id); }
    for (const q of G.parts) S.motes.push(...q.p, ...q.col, q.size * Math.min(1, q.life / q.max * 2));
    pf.lap('Core', 'particles');
    R.fogView = 2.1 / S.fogDen;   // past this the haze hides everything: nothing is drawn there (night, rain, fog)
    R.updateChunks(S.cam, 3);
    pf.lap('Core', 'ground chunks');
    R.updateTrees(b.p, G.season);
    pf.lap('Core', 'trees (pick, sort)');
    R.draw(S, null, canvas.width, canvas.height);
    pf.lap('Core', 'draw calls');
    pf.poll();

    // sound
    const above = b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER), L = G.light;
    audio.ambience(Math.min(1, b.s / 30 + (G.storm || 0) * .3), G.rain || 0, { height: above * 2, stoop: clamp((b.s - 25) / 18, 0, 1), night: L.night, frogs: L.night * (height(b.p[0], b.p[2]) < 3 ? 1 : 0), falls: G.babble || 0, brook: G.brook?.amt || 0, brookPan: G.brook?.pan || 0, hush: G.hush || 0 });
    music.hold(false); music.update(dt, { night: L.night, storm: G.storm || 0, learned: G.learned || new Set(), species: G.species || [], speed: b.s * 4, wind: G.windK ?? .3, height: above * 2 });
    pf.lap('Core', 'sound, music');

    glowT -= dt; setWings(b.stamina, glowT > 0 ? glow : '', b.maxStamina ?? 1, b.over || 0);
    H.flight = b.state === 'fly' ? { m: above.toFixed(0), kmh: (b.s * 3.6).toFixed(0), lift: b.ride ? 'ride' : b.lift > .8 ? 'rise' : '', up: b.lift > .8 ? Math.min(3, Math.ceil(b.lift / 2)) : 0 } : null;
    H.height = above.toFixed(0);
    H.status = b.state === 'fly' ? '' : b.eating > 0 ? 'eating' : b.state === 'perch' ? 'perched' : b.state === 'swim' ? 'on the water' : 'on the ground';
    takeoffBtn.classList.toggle('gone', b.state === 'fly' || b.settle > 0);   // mid-meal, Take off carries the catch away
    H.update(dt);
    pf.lap('Core', 'HUD');
    saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
    pf.lap('Core', 'saving');
    pf.end();
  }

  // debug helpers
  window.__aloft3d = {
    G, b, R,
    dbg: {
      thermal() { const t = thermalsNear(b.p[0], b.p[2], 600).sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (t) { b.state = 'fly'; b.p = [t.x - t.r * .5, height(t.x, t.z) + 40, t.z]; b.yaw = Math.PI; b.s = 9; } return t; },
      forest() { for (let r = 50; r < 3000; r += 50) for (let a = 0; a < 6.28; a += .5) { const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r; if (forest(x, z) > .25 && height(x, z) > 2) { b.state = 'fly'; b.p = [x, height(x, z) + 14, z]; b.s = 11; return [x, z]; } } },
      // above the nearest mouse, facing it from 40 m back, 25 m up
      mouse() { const m = [...G.systems.food.mice.values()].sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (!m) return null; b.state = 'fly'; b.yaw = 0; b.p = [m.x, m.y + 25, m.z + 40]; b.s = 13; b.gamma = 0; return m; },
      fly(h = 40) { b.state = 'fly'; b.p[1] = height(b.p[0], b.p[2]) + h; b.s = 13; },
      time(t) { G.tod = t; },
    },
  };
  requestAnimationFrame(frame);
}
