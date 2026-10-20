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
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createHawk, step, perchAhead } from './flight.js';
import { height, WATER, thermalsNear, forest, treesNear, perchesOf } from './world.js';
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
import { appRows } from './app.js';
import { STYLES } from './post.js';

const SYSTEMS = [clockSystem, airSystem, ringsSystem, foodSystem, aimSystem];

export function start(canvas, ui) {
  const gl = createGL(canvas);
  if (!gl) { ui.innerHTML = '<div class="card3"><h1>Aloft</h1><p>This browser has no WebGL2, which Aloft needs. Try Chrome or a newer phone browser.</p></div>'; return; }
  const R = createRenderer(gl), input = createInput(canvas);
  const audio = createAudio(), music = createMusic(audio);
  audio.on = store.get('sound', true);
  music.setMode(store.get('musicMode', 'valley'));
  const b = createHawk(0, -60);

  // ---- the game object and its bus --------------------------------------------------------
  const listeners = new Map();
  const G = {
    b, R, audio, music, input, store, t: 0, clock: 0, paused: false, parts: [], flags: store.get('flags3d', {}),
    settings: { sound: audio.on, music: store.get('music', true), invert: store.get('invert3d', false), fps: store.get('fps3d', false), full: store.get('fullRate3d', false) },
    res: 1, systems: {},
    on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    emit: (name, ...a) => { for (const fn of listeners.get(name) || []) fn(...a); },
    part: (p, v, life, col, size) => { if (G.parts.length < 400) G.parts.push({ p: [...p], v, life, max: life, col, size }); },
  };
  G.hud = createHud(G, ui, input);
  G.menu = createMenu(G, ui);
  const camera = createCamera(G);
  const systems = SYSTEMS.map(f => f(G));
  for (const s of systems) G.systems[s.id] = s;

  // ---- save and resume -----------------------------------------------------------------
  const S0 = store.get('save3d', null);
  if (!S0) { b.state = 'fly'; b.p[1] += 35; b.s = 12; }
  else {
    Object.assign(b, { p: S0.p, yaw: S0.yaw, state: 'ground', stamina: S0.stamina ?? 1 });
    b.p[1] = Math.max(height(b.p[0], b.p[2]), WATER) + .35;
    G.clock = S0.clock || 0;
    if (S0.perch) { const t = treesNear(b.p[0], b.p[2], 3)[0]; if (t) { b.state = 'perch'; b.perch = perchesOf(t)[0]; b.p = [b.perch.x, b.perch.y + .25, b.perch.z]; } }
    for (const s of systems) if (s.load && S0.sys?.[s.id]) s.load(S0.sys[s.id]);
  }
  function persist() {
    const sys = {}; for (const s of systems) if (s.save) sys[s.id] = s.save();
    store.set('save3d', { p: b.p, yaw: b.yaw, stamina: b.stamina, clock: G.clock, perch: b.state === 'perch', sys });
    store.set('flags3d', G.flags);
  }
  G.persist = persist;

  // ?res=1&full=1 pins the resolution and lifts the cap, for measuring
  const qs = new URLSearchParams(location.search);
  if (qs.has('full')) G.settings.full = qs.get('full') !== '0';
  G.pinRes = qs.has('res') ? +qs.get('res') : null; if (G.pinRes) G.res = G.pinRes;
  input.invert = G.settings.invert;
  music.setOn(G.settings.music);
  input.onAny = () => { audio.unlock(); G.emit('gesture'); };
  G.on('gesture', () => audio.unlock());

  // ---- flight events -------------------------------------------------------------------------
  const H = G.hud;
  const E = {
    get sun() { return G.light.daylight; },
    flap: (q, side) => { audio.flap(); H.did('flap'); G.emit('flap', q, side); },
    tired: () => H.toast('Your wings are spent. Glide or find rising air while they recover.'),
    takeoff: () => { audio.rustle(.4); G.emit('takeoff'); },
    land: kind => {
      if (kind === 'water') audio.splash(false); else if (kind === 'perch') { audio.rustle(.8); audio.thump(.2); } else audio.thump(.3);
      G.emit('land', kind);
    },
    bump: (p, what) => {
      audio.thump(.5); for (let i = 0; i < 5; i++) G.part(p, [(Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3], 1.5, [.45, .32, .2], .06);
      if (what === 'trunk') H.toast('Bonk. Trunks are hard: aim for the gaps, or slow down and land on a limb.');
      G.emit('bump', what);
    },
    leaves: (p, s) => { audio.rustle(.5 + Math.min(.5, s / 20)); for (let i = 0; i < 8; i++) G.part(p, [(Math.random() - .5) * 4, Math.random() * 2, (Math.random() - .5) * 4], 1.2, [.4, .55, .25], .07); G.emit('leaves'); },
    splash: (p, s) => { audio.splash(s > 15); for (let i = 0; i < 10; i++) G.part([p[0], WATER, p[2]], [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], .9, [.85, .92, .95], .06); G.emit('splash'); },
  };

  // ---- HUD and menu rows for the core -----------------------------------------------------
  const setWings = H.meter('wings', { label: 'wings', colour: 'linear-gradient(90deg,#8a6240,#b8862f)' });
  H.tip('flap', () => b.state !== 'fly', 'Tap both thumbs together to flap and take off.');
  H.tip('bank', () => b.state === 'fly', 'Two thumbs, two wings: tip one up and the other down to bank and turn.');
  H.tip('climb', () => b.state === 'fly', 'Push both thumbs up to climb, both down to dive.');
  H.tip('tuck', () => b.state === 'fly' && b.p[1] - height(b.p[0], b.p[2]) > 30, 'Slide your thumbs together to tuck your wings and stoop.');
  H.tip('flare', () => !!G.perchMark, 'A perch ahead. Slide your thumbs apart to flare, and glide onto it slowly.');
  const play = 'play', how = 'how';
  G.menu.tab(play, 'Play');
  G.menu.toggle(play, { label: 'Sound', get: () => G.settings.sound, set: v => { G.settings.sound = v; audio.setOn(v); store.set('sound', v); } });
  G.menu.toggle(play, { label: 'Music', get: () => G.settings.music, set: v => { G.settings.music = v; music.setOn(v); store.set('music', v); } });
  G.menu.toggle(play, { label: 'Invert climb and dive', sub: 'thumbs up to dive', get: () => G.settings.invert, set: v => { G.settings.invert = input.invert = v; store.set('invert3d', v); } });
  G.menu.toggle(play, { label: 'Full refresh rate', sub: 'smoother, more battery', get: () => G.settings.full, set: v => { G.settings.full = v; store.set('fullRate3d', v); } });
  G.menu.toggle(play, { label: 'Frame rate', get: () => G.settings.fps, set: v => { G.settings.fps = v; store.set('fps3d', v); H.showFps(v); } });
  G.menu.button(play, { label: 'Show the tips again', onClick: () => { H.resetTips(); G.menu.set(false); } });
  G.menu.button(play, { label: 'Music lab', sub: 'tune Valley', href: 'musiclab.html' });
  G.menu.button(play, { label: 'Start a new journey', sub: 'from the valley', onClick: el => {
    if (el.dataset.sure) { store.set('save3d', null); location.reload(); } else { el.dataset.sure = 1; el.firstChild.textContent = 'Tap again to start over '; }
  } });
  // the look: one of the styles in post.js (?style=ink to try one)
  R.style = qs.get('style') || store.get('style3d', 'plain');
  if (!STYLES.some(([k]) => k === R.style)) R.style = 'plain';
  const styleBtn = G.menu.button(play, { label: 'Look', sub: 'Low poly', onClick: el => {
    const i = STYLES.findIndex(([k]) => k === R.style), next = STYLES[(i + 1) % STYLES.length];
    R.style = next[0]; store.set('style3d', R.style); el.querySelector('em').textContent = next[1];
  } });
  styleBtn.querySelector('em').textContent = STYLES.find(([k]) => k === R.style)[1];
  appRows(G);
  H.showFps(G.settings.fps);
  G.menu.tab(how, 'How to fly').insertAdjacentHTML('beforeend', `<ul class="how">
    <li><b>Your two thumbs are your wings.</b> Put one on each side of the screen; each becomes a stick where it lands.</li>
    <li><b>Tap both together</b> to flap. One thumb alone leads with that wing (the other follows lightly): a weaker stroke that nudges you round.</li>
    <li><b>Both up</b> to climb, <b>both down</b> to dive. Climbing costs speed, diving earns it.</li>
    <li><b>One up, one down</b> banks toward the lower thumb, like tipping your wings.</li>
    <li><b>Slide them together</b> to tuck your wings and stoop: the faint aim dots focus on a spot. <b>Slide them apart</b> to spread and flare: you slow, can hover with flaps, and drop your feet to land.</li>
    <li><b>Mice</b> twitch the grass in open meadows. Dive at one and come in low; your feet reach for it. The aim ring turns berry-red on a mouse.</li>
    <li>Fly slow into a <b>branch, a treetop or the leaves</b> and you settle on it. Trunks are hard; the hawk steers a little round the ones ahead. The aim ring is sage where a landing would be soft.</li>
    <li><b>Drink</b> by landing at the water's edge or on the water.</li>
    <li>Motes under a cloud mark a <b>thermal</b>. Inside it, hold a thumb still and the hawk circles the rising air on its own. Windward slopes lift too.</li>
    <li>Fly through the <b>golden rings</b> for a burst of speed.</li>
    <li>Keyboard: W/S climb and dive, A/D bank, Shift tuck, E flare, Space flap, P pause.</li>
  </ul>`);
  G.on('pause', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); audio.suspend(); G.menu.set(true); } else audio.resume(); });
  addEventListener('pagehide', persist);

  // tricks, for whoever is watching (a mate, the story): a full stoop, a wingover (a hard
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
  let last = performance.now(), saveT = 0, resT = 0, frames = 0, skipT = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    // cap at 60 on faster screens unless asked: half the battery for little loss
    if (!G.settings.full && now - skipT < 1000 / 61) return;
    skipT = now;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (G.paused) return;
    G.t += dt; G.clock += dt;
    frames++; resT += dt;
    if (resT > 1.5) {
      const fps = frames / resT; frames = 0; resT = 0;
      const target = G.settings.full ? 80 : 55;
      if (G.pinRes) { /* pinned */ } else if (fps < target && G.res > .5) { G.res = Math.max(.5, G.res - .1); resize(); }
      else if (fps > target + 4 && G.res < 1) { G.res = Math.min(1, G.res + .05); resize(); }
      H.fps(`${fps.toFixed(0)} fps · res ${G.res.toFixed(2)} · ${R.stats.chunks} chunks · ${(R.stats.tris / 1000).toFixed(0)}k tris`);
    }

    const c = input.read();
    G.systems.clock.update(dt, c);
    step(b, c, dt, E);
    if (Math.abs(c.roll) > .5) H.did('bank');
    if (Math.abs(c.pitch) > .5) H.did('climb');
    if (c.spread < -.5) { H.did('tuck'); H.did('aim'); }
    if (c.spread > .5) H.did('flare');
    G.perchMark = perchAhead(b);
    tricks(dt);
    for (const s of systems) if (s.id !== 'clock') s.update?.(dt, c);

    for (const p of G.parts) { p.life -= dt; p.v[1] -= 1.5 * dt; for (let k = 0; k < 3; k++) p.p[k] += p.v[k] * dt; }
    G.parts = G.parts.filter(p => p.life > 0);

    // the scene: light, camera and hawk, then whatever each system adds
    const S = { ...G.light, time: G.t, wind: G.windK ?? .3, fogDen: .0042, autumnCol: [.8, .5, .22], props: {}, motes: [] };
    camera.update(dt, S);
    if (G.perchMark) (S.props.ring ||= []).push(G.perchMark.x, G.perchMark.y + .35, G.perchMark.z, .45, G.t * 1.5, .7, 0, 0);
    for (const s of systems) s.scene?.(S);
    for (const q of G.parts) S.motes.push(...q.p, ...q.col, q.size * Math.min(1, q.life / q.max * 2));
    R.updateChunks(S.cam, 3);
    R.updateTrees(b.p, G.season);
    R.draw(S, null, canvas.width, canvas.height);

    // sound
    const above = b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER), L = G.light;
    audio.ambience(Math.min(1, b.s / 30 + (G.storm || 0) * .3), G.rain || 0, { height: above * 2, stoop: clamp((b.s - 25) / 18, 0, 1), night: L.night, frogs: L.night * (height(b.p[0], b.p[2]) < 3 ? 1 : 0) });
    music.update(dt, { night: L.night, storm: G.storm || 0, learned: G.learned || new Set(), species: G.species || [], speed: b.s * 4, wind: G.windK ?? .3, height: above * 2 });

    setWings(b.stamina);
    H.status = b.state === 'fly' ? `${above.toFixed(0)} m · ${(b.s * 3.6).toFixed(0)} km/h${b.ride ? ' · riding the thermal' : b.lift > .8 ? ' · rising air' : ''}`
      : b.eating > 0 ? 'eating' : b.state === 'perch' ? 'perched' : b.state === 'swim' ? 'on the water' : 'on the ground';
    H.update(dt);
    saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  }

  // debug helpers
  window.__aloft3d = {
    G, b, R,
    dbg: {
      thermal() { const t = thermalsNear(b.p[0], b.p[2], 600).sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (t) { b.state = 'fly'; b.p = [t.x - 30, height(t.x, t.z) + 40, t.z]; b.yaw = Math.PI / 2; b.s = 12; } return t; },
      forest() { for (let r = 50; r < 3000; r += 50) for (let a = 0; a < 6.28; a += .5) { const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r; if (forest(x, z) > .25 && height(x, z) > 2) { b.state = 'fly'; b.p = [x, height(x, z) + 14, z]; b.s = 11; return [x, z]; } } },
      // above the nearest mouse, facing it from 40 m back, 25 m up
      mouse() { const m = [...G.systems.food.mice.values()].sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (!m) return null; b.state = 'fly'; b.yaw = 0; b.p = [m.x, m.y + 25, m.z + 40]; b.s = 13; b.gamma = 0; return m; },
      fly(h = 40) { b.state = 'fly'; b.p[1] = height(b.p[0], b.p[2]) + h; b.s = 13; },
      time(t) { G.tod = t; },
    },
  };
  requestAnimationFrame(frame);
}
