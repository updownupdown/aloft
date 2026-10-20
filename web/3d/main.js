// Aloft in 3D, a prototype: the same hawk, hills, thermals and rings, seen from just behind
// the bird, flown with two thumbs as two wings. Shares the 2D game's sound (audio.js, music.js).
import { createGL } from './gl.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createHawk, step, fwd, perchAhead } from './flight.js';
import { height, WATER, thermalsNear, thermalCentre, ringsNear, forest, treesNear, perchesOf } from './world.js';
import { createAudio } from '../src/audio.js';
import { createMusic } from '../src/music.js';

const DAY = 480;   // seconds in a day, as in 2D
const store = {
  get(k, d) { try { const v = localStorage.getItem('aloft.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aloft.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const lerp = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const norm = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// sky moods by sun height: night, dusk, day (rgb 0..1, Aloft's paper-warm horizon)
const MOOD = {
  day: { zenith: [.52, .68, .8], horizon: [.92, .9, .83], sunCol: [.78, .73, .62], skyAmb: [.5, .55, .6], gndAmb: [.38, .35, .28], cloud: [.97, .95, .9] },
  dusk: { zenith: [.42, .42, .6], horizon: [.97, .7, .5], sunCol: [.85, .52, .3], skyAmb: [.45, .38, .46], gndAmb: [.3, .22, .2], cloud: [.98, .78, .66] },
  night: { zenith: [.04, .06, .13], horizon: [.15, .17, .27], sunCol: [.2, .24, .34], skyAmb: [.13, .16, .26], gndAmb: [.05, .06, .09], cloud: [.2, .22, .3] },
};
function sky(tod) {
  const a = (tod - .25) * Math.PI * 2, el = Math.sin(a);
  let m;
  const blend = (A, B, t) => Object.fromEntries(Object.keys(A).map(k => [k, mix3(A[k], B[k], t)]));
  if (el > .25) m = MOOD.day; else if (el > 0) m = blend(MOOD.dusk, MOOD.day, el / .25); else m = blend(MOOD.night, MOOD.dusk, smooth(-.2, 0, el));
  const az = a * .9 + .6;
  const sunDir = norm([Math.cos(az) * Math.cos(Math.asin(el)), el, Math.sin(az) * Math.cos(Math.asin(el)) - .3]);
  // at night the moon lights from high in the opposite sky
  const light = el > -.05 ? [sunDir[0], Math.max(sunDir[1], .08), sunDir[2]] : norm([-sunDir[0], .6, -sunDir[2]]);
  return { ...m, sun: norm(light), sunSky: sunDir, night: smooth(.05, -.2, el), daylight: smooth(-.05, .3, el) };
}

export function start(canvas, ui) {
  const gl = createGL(canvas);
  if (!gl) { ui.innerHTML = '<div class="card3"><h1>Aloft · 3D</h1><p>This browser has no WebGL2, so the 3D mode cannot run here.</p><a class="btn" href="index.html?mode=2d">Play the 2D game</a></div>'; return; }
  const R = createRenderer(gl), input = createInput(canvas);
  const audio = createAudio(), music = createMusic(audio);
  audio.on = store.get('sound', true);
  music.setMode(store.get('musicMode', 'valley'));
  const S0 = store.get('save3d', null);
  const b = createHawk(0, -60);
  const G = {
    b, tod: .34, day: 1, collected: new Set(), parts: [], paused: false, t: 0, hints: store.get('hints3d', {}),
    settings: { sound: audio.on, music: store.get('music', true), invert: store.get('invert3d', false), fps: store.get('fps3d', false), full: store.get('fullRate3d', false) },
    cam: null, camYaw: 0, camPitch: 0, res: 1, fpsAvg: 60,
  };
  if (!S0) { b.state = 'fly'; b.p[1] += 35; b.s = 12; }
  else {
    Object.assign(b, { p: S0.p, yaw: S0.yaw, state: 'ground', rings: S0.rings || 0 });
    b.p[1] = Math.max(height(b.p[0], b.p[2]), WATER) + .35;
    G.tod = S0.tod ?? .34; G.day = S0.day || 1; G.collected = new Set(S0.collected || []);
    if (S0.perch) { const t = treesNear(b.p[0], b.p[2], 3)[0]; if (t) { b.state = 'perch'; b.perch = perchesOf(t)[0]; b.p = [b.perch.x, b.perch.y + .25, b.perch.z]; } }
  }
  input.invert = G.settings.invert;
  music.setOn(G.settings.music);
  input.onAny = () => { audio.unlock(); if (!G.started) { G.started = true; } };

  // ---- events from the flight model ------------------------------------------------------
  const part = (p, v, life, col, size) => { if (G.parts.length < 300) G.parts.push({ p: [...p], v, life, max: life, col, size }); };
  const E = {
    collected: G.collected, sun: 1,
    flap: (q, side) => { audio.flap(); hint('flap', true); if (side) hint('oneWing', true); },
    tired: () => toast('Your wings are spent. Glide or find rising air while they recover.'),
    takeoff: () => audio.rustle(.4),
    land: kind => {
      if (kind === 'water') audio.splash(false); else if (kind === 'perch') { audio.rustle(.8); audio.thump(.2); } else audio.thump(.3);
      hint('landed', true);
    },
    bump: (p, what) => {
      audio.thump(.5); for (let i = 0; i < 5; i++) part(p, [(Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3], 1.5, [.45, .32, .2], .06);
      if (what === 'trunk') toast('Bonk. Trunks are hard: aim for the gaps, or slow down and land on a limb.');
    },
    leaves: (p, s) => { audio.rustle(.5 + Math.min(.5, s / 20)); for (let i = 0; i < 8; i++) part(p, [(Math.random() - .5) * 4, Math.random() * 2, (Math.random() - .5) * 4], 1.2, [.4, .55, .25], .07); },
    splash: (p, s) => { audio.splash(s > 15); for (let i = 0; i < 10; i++) part([p[0], WATER, p[2]], [(Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3], .9, [.85, .92, .95], .06); },
    ring: r => {
      audio.ring(); G.collected.add(r.id); hint('ring', true);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; part([r.x + Math.cos(a) * r.r * Math.cos(r.yaw), r.y + Math.sin(a) * r.r, r.z + Math.cos(a) * r.r * Math.sin(r.yaw)], [0, .5, 0], 1.2, [1, .85, .45], .09); }
    },
  };

  // ---- HUD -----------------------------------------------------------------------------
  ui.innerHTML = `
    <button class="menu3" aria-label="Menu"><i></i><i></i></button>
    <div class="hud3"><span class="wings"><b></b></span><span class="ringc"></span><span class="alt"></span></div>
    <div class="fps3 hidden"></div>
    <div class="pad3 L"><i></i></div><div class="pad3 R"><i></i></div>
    <p class="hint3"></p><p class="toast3"></p>
    <div class="card3 hidden">
      <h1>Aloft <em>in 3D</em></h1><p class="sub">A prototype to try against the 2D game.</p>
      <button data-act="resume" class="btn main">Resume</button>
      <button data-act="sound" class="sw"><span>Sound</span><i></i></button>
      <button data-act="music" class="sw"><span>Music</span><i></i></button>
      <button data-act="invert" class="sw"><span>Invert climb and dive <small>thumbs up to dive</small></span><i></i></button>
      <button data-act="full" class="sw"><span>Full refresh rate <small>smoother, more battery</small></span><i></i></button>
      <button data-act="fps" class="sw"><span>Frame rate</span><i></i></button>
      <button data-act="hints" class="btn">Show the tips again</button>
      <a class="btn" data-act="2d" href="index.html?mode=2d">Play the 2D game</a>
      <h2>How to fly</h2>
      <ul class="how">
        <li><b>Your two thumbs are your wings.</b> Put one on each side of the screen; each becomes a stick where it lands.</li>
        <li><b>Tap both together</b> to flap. One thumb alone flaps one wing: a weaker stroke that nudges you round.</li>
        <li><b>Both up</b> to climb, <b>both down</b> to dive. Climbing costs speed, diving earns it.</li>
        <li><b>One up, one down</b> banks toward the lower thumb, like tipping your wings.</li>
        <li><b>Slide them together</b> to tuck your wings and stoop fast. <b>Slide them apart</b> to spread and flare: you slow, can hover with flaps, and drop your feet to land.</li>
        <li>Fly slow into a <b>branch, a treetop or the leaves</b> and you settle on it. Trunks are hard; the hawk steers a little round the ones ahead.</li>
        <li>Shimmering motes under a cloud mark a <b>thermal</b>. Inside it, hold a thumb still and the hawk circles the rising air on its own. Windward slopes lift too.</li>
        <li>Fly through the <b>golden rings</b> for a burst of speed.</li>
        <li>Keyboard: W/S climb and dive, A/D bank, Shift tuck, E flare, Space flap.</li>
      </ul>
    </div>`;
  const q = s => ui.querySelector(s);
  const card = q('.card3'), hintEl = q('.hint3'), toastEl = q('.toast3'), padL = q('.pad3.L'), padR = q('.pad3.R');
  const refresh = () => {
    for (const k of ['sound', 'music', 'invert', 'fps', 'full']) q(`[data-act=${k}]`).classList.toggle('on', !!G.settings[k]);
    q('.fps3').classList.toggle('hidden', !G.settings.fps);
  };
  refresh();
  const pause = on => { G.paused = on; card.classList.toggle('hidden', !on); if (on) persist(); };
  q('.menu3').addEventListener('click', () => { audio.unlock(); pause(!G.paused); });
  card.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'resume') pause(false);
    if (act === 'sound') { G.settings.sound = !G.settings.sound; audio.setOn(G.settings.sound); store.set('sound', G.settings.sound); }
    if (act === 'music') { G.settings.music = !G.settings.music; music.setOn(G.settings.music); store.set('music', G.settings.music); }
    if (act === 'invert') { G.settings.invert = input.invert = !G.settings.invert; store.set('invert3d', G.settings.invert); }
    if (act === 'fps') { G.settings.fps = !G.settings.fps; store.set('fps3d', G.settings.fps); }
    if (act === 'full') { G.settings.full = !G.settings.full; store.set('fullRate3d', G.settings.full); }
    if (act === 'hints') { G.hints = {}; store.set('hints3d', {}); pause(false); }
    if (act === '2d') store.set('mode', '2d');
    refresh();
  });
  addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') pause(!G.paused); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); audio.suspend(); pause(true); } else audio.resume(); });
  addEventListener('pagehide', persist);

  let toastT = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); toastT = 4; }
  // tips, one at a time, each until the player has done the thing (or it has been seen a while)
  const TIPS = [
    ['flap', s => s === 'ground' || s === 'perch' || s === 'swim', 'Tap both thumbs together to flap and take off.'],
    ['bank', () => true, 'Two thumbs, two wings: tip one up and the other down to bank and turn.'],
    ['climb', () => true, 'Push both thumbs up to climb, both down to dive.'],
    ['tuck', () => b.p[1] - height(b.p[0], b.p[2]) > 30, 'Slide your thumbs together to tuck your wings and stoop.'],
    ['flare', () => !!G.perchMark, 'A perch ahead. Slide your thumbs apart to flare, and glide onto it slowly.'],
    ['ride', () => !!b.inThermal, 'Rising air! Hold a thumb still and the hawk circles it, climbing.'],
    ['ring', () => G.ringAhead, 'A golden ring: fly through it for a burst of speed.'],
    ['landed', () => false, ''],
  ];
  let hintNow = null, hintT = 0;
  function hint(id, done) { if (done) { if (!G.hints[id]) { G.hints[id] = 1; store.set('hints3d', G.hints); } if (hintNow === id) hintT = Math.min(hintT, .3); } }
  function updateHints(dt, c) {
    if (Math.abs(c.roll) > .5) hint('bank', true);
    if (Math.abs(c.pitch) > .5) hint('climb', true);
    if (c.spread < -.5) hint('tuck', true);
    if (c.spread > .5) hint('flare', true);
    if (b.ride) hint('ride', true);
    hintT -= dt;
    if (hintT <= 0) {
      hintNow = null;
      for (const [id, when, text] of TIPS) if (text && !G.hints[id] && when(b.state)) { hintNow = id; hintEl.textContent = text; hintT = 9; break; }
    }
    hintEl.classList.toggle('show', !!hintNow && hintT > .3);
    if (hintNow && hintT < .4 && hintT > 0 && hintNow !== 'flap') { G.hints[hintNow] = (G.hints[hintNow] || 0); }
  }

  function persist() {
    store.set('save3d', { p: b.p, yaw: b.yaw, tod: G.tod, day: G.day, rings: b.rings, collected: [...G.collected].slice(-300), perch: b.state === 'perch' });
  }

  // ---- the frame -------------------------------------------------------------------------
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
    let dt = Math.min(.05, (now - last) / 1000); last = now;
    if (G.paused) return;
    G.t += dt;
    frames++; resT += dt;
    G.fpsAvg = lerp(G.fpsAvg, 1 / Math.max(dt, .001), .05);
    if (resT > 1.5) {
      const fps = frames / resT; frames = 0; resT = 0;
      const target = G.settings.full ? 80 : 55;
      if (fps < target && G.res > .5) { G.res = Math.max(.5, G.res - .1); resize(); }
      else if (fps > target + 4 && G.res < 1) { G.res = Math.min(1, G.res + .05); resize(); }
      q('.fps3').textContent = `${fps.toFixed(0)} fps · res ${G.res.toFixed(2)} · ${R.stats.chunks} chunks · ${(R.stats.tris / 1000).toFixed(0)}k tris`;
    }

    G.tod += dt / DAY; if (G.tod >= 1) { G.tod -= 1; G.day++; }
    const L = sky(G.tod); E.sun = L.daylight;
    const c = input.read();
    step(b, c, dt, E);
    updateHints(dt, c);
    toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show');

    // particles
    for (const p of G.parts) { p.life -= dt; p.v[1] -= 1.5 * dt; for (let k = 0; k < 3; k++) p.p[k] += p.v[k] * dt; }
    G.parts = G.parts.filter(p => p.life > 0);

    const scene = camera(dt, L);
    R.updateChunks(G.cam, 3);
    const season = Math.floor((G.day - 1) / 8) % 4;
    R.updateTrees(b.p, { key: season, autumn: season === 1 ? 1 : 0 });
    R.draw(scene, null, canvas.width, canvas.height);

    // sound
    const above = b.p[1] - Math.max(height(b.p[0], b.p[2]), WATER);
    audio.ambience(Math.min(1, b.s / 30), 0, { height: above * 2, stoop: clamp((b.s - 25) / 18, 0, 1), night: L.night, frogs: L.night * (height(b.p[0], b.p[2]) < 3 ? 1 : 0) });
    if (b.lift > .8) audio.vario(b.lift * 9);
    music.update(dt, { night: L.night, storm: 0, learned: new Set(), species: [], speed: b.s * 4, wind: .3, height: above * 2 });

    hud(c, above);
    saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  }

  function camera(dt, L) {
    const p = b.p;
    let look, want;
    if (b.state === 'fly') {
      // the camera swings after the hawk's heading rather than its position, so it never falls behind
      G.camYaw += angleTo(G.camYaw, b.yaw) * Math.min(1, dt * 3.5);
      G.camPitch += (b.gamma * .45 - G.camPitch) * Math.min(1, dt * 2.5);
      const cp = G.camPitch, d = [Math.sin(G.camYaw) * Math.cos(cp), Math.sin(cp), -Math.cos(G.camYaw) * Math.cos(cp)];
      const dist = 2.4 + Math.min(b.s, 40) * .03, h = 1.35 + Math.min(b.s, 40) * .005;
      want = [p[0] - d[0] * dist, p[1] - d[1] * dist + h, p[2] - d[2] * dist];
      look = [p[0] + d[0] * 3, p[1] + d[1] * 3 + .2, p[2] + d[2] * 3];
    } else {
      G.camYaw += angleTo(G.camYaw, b.yaw + Math.sin(G.t * .15) * .5) * Math.min(1, dt * .8);
      G.camPitch = 0;
      const d = [Math.sin(G.camYaw), 0, -Math.cos(G.camYaw)];
      want = [p[0] - d[0] * 3, p[1] + 1.1, p[2] - d[2] * 3];
      look = [p[0] + d[0] * 1.5, p[1] + .4, p[2] + d[2] * 1.5];
    }
    if (!G.cam) G.cam = want.slice();
    const k = b.state === 'fly' && !G.wasStill ? 1 : Math.min(1, dt * 2);
    for (let i = 0; i < 3; i++) G.cam[i] += (want[i] - G.cam[i]) * k;
    if (b.state === 'fly' && Math.hypot(want[0] - G.cam[0], want[1] - G.cam[1], want[2] - G.cam[2]) < .05) G.wasStill = false;
    if (b.state !== 'fly') G.wasStill = true;
    G.cam[1] = Math.max(G.cam[1], height(G.cam[0], G.cam[2]) + 1.1, WATER + .6);
    if (!G.look) G.look = look.slice();
    for (let i = 0; i < 3; i++) G.look[i] += (look[i] - G.look[i]) * Math.min(1, dt * (b.state === 'fly' ? 12 : 4));

    // the hawk's frame: forward with a body pitch, banked by roll
    const pv = b.state === 'fly' ? b.gamma * .8 + b.flare * .45 - b.tuck * .1 : b.state === 'perch' ? .5 : b.state === 'ground' ? .3 : .08;
    const f = [Math.sin(b.yaw) * Math.cos(pv), Math.sin(pv), -Math.cos(b.yaw) * Math.cos(pv)];
    const r0 = [Math.cos(b.yaw), 0, Math.sin(b.yaw)], u0 = cross(r0, f), cr = Math.cos(b.roll), sr = Math.sin(b.roll);
    const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr];
    const u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];
    let hp = p;
    if (b.settle > 0 && b.from) { const t = smooth(0, 1, 1 - b.settle / .45); hp = mix3(b.from, p, t); }
    if (b.state === 'fly' && b.settle <= 0) b.from = null;

    G.perchMark = perchAhead(b);
    const rings = ringsNear(G.cam[0], G.cam[2], 320).filter(x => !G.collected.has(x.id));
    G.ringAhead = rings.some(x => Math.hypot(x.x - p[0], x.y - p[1], x.z - p[2]) < 60);
    const clouds = [], motes = [];
    for (const t of thermalsNear(G.cam[0], G.cam[2], 650)) {
      const [cx, cz] = thermalCentre(t, t.top);
      clouds.push({ x: cx, y: t.top + 18, z: cz, s: 20 + t.r * .7, yaw: t.id % 7 });
      if (Math.hypot(t.x - G.cam[0], t.z - G.cam[2]) > 240) continue;
      const g0 = Math.max(height(t.x, t.z), WATER), span = Math.min(160, t.top - g0);
      for (let i = 0; i < 46; i++) {
        const h1 = ((i * 97 + t.id) % 101) / 101, h2 = ((i * 61 + t.id * 3) % 89) / 89;
        const y = g0 + ((G.t * t.w * .9 * L.daylight + h1 * span) % span);
        const [mx, mz] = thermalCentre(t, y), a = h2 * 6.283 + G.t * .25 * (i & 1 ? 1 : -1), rr = t.r * .75 * Math.sqrt((h1 * 7.3) % 1);
        const fade = smooth(0, 12, y - g0) * smooth(span, span - 30, y - g0);
        motes.push(mx + Math.cos(a) * rr, y, mz + Math.sin(a) * rr, 1, .93, .74, .22 * fade);
      }
    }
    for (const q of G.parts) motes.push(...q.p, ...q.col, q.size * Math.min(1, q.life / q.max * 2));

    const camUp = norm([r0[0] * Math.sin(b.roll) * .3, 1, r0[2] * Math.sin(b.roll) * .3]);
    const aspect = innerWidth / innerHeight;
    let fov = (52 + Math.min(b.s, 45) * .4) * Math.PI / 180; if (aspect < 1) fov = Math.min(1.9, fov * 1.35);

    // the pose: wing beats, fold, flare, feet and tail
    const glide = b.state !== 'fly' ? 0 : .1 + Math.sin(G.t * 1.7) * .025 + (b.lift > 1 ? .05 : 0) - b.tuck * .12 + b.flare * .2;
    const beat = (t0) => {
      const D = .42, ph = t0 / D;
      if (ph >= 1) return [glide, 0];
      const fa = ph < .28 ? lerp(glide, 1.05, smooth(0, 1, ph / .28)) : ph < .72 ? lerp(1.05, -.8, smooth(0, 1, (ph - .28) / .44)) : lerp(-.8, glide, smooth(0, 1, (ph - .72) / .28));
      const hand = ph < .28 ? -.35 : ph < .72 ? .45 * Math.sin((ph - .28) / .44 * Math.PI) : -.2 * (1 - (ph - .72) / .28);
      return [fa, hand];
    };
    const [fl, hl] = beat(b.flapL), [fr, hr] = beat(b.flapR);
    const settled = b.state !== 'fly';
    const pose = {
      flapL: settled ? .05 : fl, flapR: settled ? .05 : fr, handL: hl, handR: hr,
      fold: settled ? clamp(1 - b.settle * 1.6, 0, 1) : clamp(b.tuck * .75 + b.canopy * .25, 0, 1),
      flare: settled ? clamp(b.settle * 2, 0, 1) : b.flare,
      legs: settled ? 1 : clamp(Math.max(b.flare, G.perchMark && Math.hypot(G.perchMark.x - p[0], G.perchMark.y - p[1], G.perchMark.z - p[2]) < 8 ? 1 : 0), 0, 1) * .9,
      tail: settled ? .05 : clamp(b.flare * .9 + Math.abs(b.roll) * .35 + (b.ride ? .3 : 0), 0, 1), tailPitch: b.flare * .3, t: G.t,
    };

    return {
      ...L, cam: G.cam, look: G.look, camUp, fov, time: G.t, wind: .3, camHigh: G.cam[1] - height(G.cam[0], G.cam[2]),
      fogDen: .0042, focus: hp, autumnCol: [.8, .5, .22],
      hawk: { p: hp, r: [-r[0], -r[1], -r[2]], u, f }, pose,
      rings: rings.map(x => ({ ...x, pulse: 1 + Math.sin(G.t * 3 + x.id) * .03 })), perchMark: G.perchMark, clouds, motes,
    };
  }

  function hud(c, above) {
    q('.wings b').style.width = (b.stamina * 100).toFixed(0) + '%';
    q('.wings').classList.toggle('low', b.stamina < .2);
    q('.ringc').textContent = b.rings ? `${b.rings} ring${b.rings > 1 ? 's' : ''}` : '';
    q('.alt').textContent = b.state === 'fly' ? `${above.toFixed(0)} m · ${(b.s * 3.6).toFixed(0)} km/h${b.ride ? ' · riding the thermal' : b.lift > .8 ? ' · rising air' : ''}` : b.state === 'perch' ? 'perched' : b.state === 'swim' ? 'on the water' : 'on the ground';
    for (const [el, P, side] of [[padL, input.L, -1], [padR, input.R, 1]]) {
      const on = P.id !== null;
      el.classList.toggle('on', on);
      if (on) {
        el.style.left = (P.x0 - 45) + 'px'; el.style.top = (P.y0 - 45) + 'px'; el.style.right = el.style.bottom = 'auto';
        el.firstChild.style.transform = `translate(${P.dx * 30}px, ${P.dy * 30}px)`;
      } else { el.style.left = el.style.top = el.style.right = el.style.bottom = ''; el.firstChild.style.transform = ''; }
      void side;
    }
    void c;
  }

  // debug helpers, as in 2D
  window.__aloft3d = {
    G, b, R,
    dbg: {
      thermal() { const t = thermalsNear(b.p[0], b.p[2], 600).sort((a, q) => Math.hypot(a.x - b.p[0], a.z - b.p[2]) - Math.hypot(q.x - b.p[0], q.z - b.p[2]))[0]; if (t) { b.state = 'fly'; b.p = [t.x - 30, height(t.x, t.z) + 40, t.z]; b.yaw = Math.PI / 2; b.s = 12; } return t; },
      forest() { for (let r = 50; r < 3000; r += 50) for (let a = 0; a < 6.28; a += .5) { const x = b.p[0] + Math.cos(a) * r, z = b.p[2] + Math.sin(a) * r; if (forest(x, z) > .25 && height(x, z) > 2) { b.state = 'fly'; b.p = [x, height(x, z) + 14, z]; b.s = 11; return [x, z]; } } },
      fly(h = 40) { b.state = 'fly'; b.p[1] = height(b.p[0], b.p[2]) + h; b.s = 13; },
      time(t) { G.tod = t; },
    },
  };
  requestAnimationFrame(frame);
}
