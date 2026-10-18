// DOM overlay: the menu button, pause menu (settings, journal, how to play, tuning) and toasts.
import { TUNE, DEFAULTS, RANGES } from './tune.js';
import { GFX, GFX_INFO, RES_OPTS, saveGfx, overlay, debugInfo } from './gfx.js';

export function createUI({ audio, G, store, species, onPause, playSong, hooks = {} }) {
  const $ = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const root = document.getElementById('ui');

  const btn = $('button', 'menu-btn', '<span></span><span></span><span></span>');
  btn.setAttribute('aria-label', 'Menu');
  root.append(btn);

  const toastEl = $('div', 'toast'); root.append(toastEl);
  let toastTimer = 0;

  const menu = $('div', 'menu hidden');
  menu.innerHTML = `
    <div class="card" role="dialog" aria-label="Paused">
      <h1 data-act="title">Aloft</h1>
      <p class="sub"></p>
      <button data-act="resume" class="primary">Resume</button>
      <button data-act="photo" class="hidden">Photo mode</button>
      <div class="row">
        <button data-act="sound" class="half"></button>
        <button data-act="music" class="half hidden"></button>
      </div>
      <button data-act="glide"></button>
      <button data-act="install" class="hidden">Install the app</button>
      <details class="journal-sec hidden">
        <summary>Journal</summary>
        <p class="journey"></p>
        <canvas class="map" width="720" height="150"></canvas>
        <p class="nest"></p>
        <h3>Landmarks</h3>
        <ul class="landmarks"></ul>
      </details>
      <details>
        <summary>Songbook</summary>
        <ul class="songbook"></ul>
      </details>
      <details>
        <summary>How to play</summary>
        <ul class="howto">
          <li><b>Tap</b> to flap. One tap, one wingbeat. Each flap tires the wings; when they are spent they won't beat until gliding rests them.</li>
          <li><b>Press and hold</b> anywhere to point the hawk toward your finger. Point down to dive, up to climb, behind to swing round in a wingover.</li>
          <li>On a branch, the ground or the water, <b>one tap</b> turns or steps toward it; <b>two quick taps</b> take off.</li>
          <li>Let go and the hawk glides on its own. Diving builds speed; pulling up trades it for height. Too slow and it stalls.</li>
          <li>To land softly, <b>flare</b>: point up just before the branch or the ground.</li>
          <li><b>Thermals</b> rise above the treeline on sunny afternoons. Let go inside one and the hawk floats up as it glides across; turn back to stay in it. <b>Rings</b> hang all over the sky. Wind against a hillside gives <b>ridge lift</b>. Rising air beeps.</li>
          <li><b>Tap a branch</b> to fly to it and perch. At dusk, stay perched and the hawk roosts until dawn.</li>
          <li>Land on a pond to swim, then <b>tap the water</b> to drink. Three sips fill your thirst.</li>
          <li>On the ground, hold left or right to walk. <b>Tap berries</b> (six fill you) or, after rain, <b>worms</b> (three fill you). Dive at <b>mice</b> in the grass or <b>fish</b> in ponds.</li>
          <li>Perch near a <b>songbird</b> and a staff appears. Listen, then tap its lines to sing the song back. Sing a song you know from any perch and that species answers.</li>
          <li>The seasons turn every two days. Follow the flocks <b>south</b> (to the right) to the wintering marsh, and home again in spring. The <b>Journal</b> keeps your map and the landmarks you find.</li>
          <li>Pick up a <b>twig</b> under a tree and perch on a branch to start a <b>nest</b>. Five twigs and an egg appears; when it hatches, carry mice and fish home to feed the chick.</li>
          <li>Keyboard: Space flap, arrow keys or WASD to steer and walk, E to drink or eat, Esc for this menu.</li>
        </ul>
      </details>
      <details>
        <summary>Graphics</summary>
        <div class="gfx-list"></div>
        <small>Turn layers off if the game runs slowly on your device. Resolution "auto" lowers itself while frames are slow.</small>
        <button data-act="debug" class="quiet">Copy debug info</button>
      </details>
      <details class="tuning hidden">
        <summary>Tuning</summary>
        <div class="sliders"></div>
        <button data-act="tune-reset">Reset tuning</button>
      </details>
      <button data-act="newgame" class="quiet hidden">Start a new journey</button>
    </div>`;
  root.append(menu);
  const q = s => menu.querySelector(s);
  const soundBtn = q('[data-act=sound]'), musicBtn = q('[data-act=music]'), glideBtn = q('[data-act=glide]');
  const installBtn = q('[data-act=install]'), book = q('.songbook');
  if (hooks.music) musicBtn.classList.remove('hidden');
  if (hooks.photo) q('[data-act=photo]').classList.remove('hidden');
  if (hooks.journal) q('.journal-sec').classList.remove('hidden');
  if (hooks.newGame) q('[data-act=newgame]').classList.remove('hidden');

  // the tuning page is hidden: tap the title five times
  let titleTaps = 0, titleT = 0;
  const sliders = q('.sliders');
  for (const k of Object.keys(DEFAULTS)) {
    const [lo, hi] = RANGES[k], row = $('label', 'slider');
    row.innerHTML = `<span>${k}</span><input type="range" min="${lo}" max="${hi}" step="${(hi - lo) / 200}"><output></output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    inp.value = TUNE[k]; out.textContent = (+TUNE[k]).toFixed(2);
    inp.addEventListener('input', () => { TUNE[k] = +inp.value; out.textContent = (+inp.value).toFixed(2); saveTune(); });
    row.dataset.key = k; sliders.append(row);
  }
  function saveTune() { const o = {}; for (const k in DEFAULTS) if (TUNE[k] !== DEFAULTS[k]) o[k] = TUNE[k]; store.set('tune', o); }
  function syncSliders() { for (const row of sliders.children) { const k = row.dataset.key; row.querySelector('input').value = TUNE[k]; row.querySelector('output').textContent = (+TUNE[k]).toFixed(2); } }

  const gfxList = q('.gfx-list');
  function gfxButtons() {
    gfxList.innerHTML = '';
    const r = $('button', '', `Resolution: ${GFX.res === 'auto' ? 'auto' : GFX.res + 'x'}`); r.dataset.gfx = 'res'; gfxList.append(r);
    for (const [k, name] of GFX_INFO) { const b = $('button', GFX[k] ? '' : 'off', `${name}: ${GFX[k] ? 'on' : 'off'}`); b.dataset.gfx = k; gfxList.append(b); }
  }
  gfxList.addEventListener('click', e => {
    const k = e.target.dataset?.gfx; if (!k) return;
    if (k === 'res') GFX.res = RES_OPTS[(RES_OPTS.indexOf(GFX.res) + 1) % RES_OPTS.length];
    else GFX[k] = !GFX[k];
    saveGfx(store); overlay(GFX.fps); hooks.gfx?.(k); gfxButtons();
  });

  function refresh() {
    gfxButtons();
    q('.sub').textContent = hooks.subtitle ? hooks.subtitle() : 'Paused';
    soundBtn.textContent = `Sound: ${audio.on ? 'on' : 'off'}`;
    musicBtn.textContent = `Music: ${G.settings.music ? 'on' : 'off'}`;
    glideBtn.textContent = `Glide line: ${G.settings.glide ? 'shown' : 'hidden'}`;
    book.innerHTML = '';
    for (const sp of species) {
      const li = $('li');
      const known = G.learned.has(sp.id), info = G.songLog?.[sp.id];
      const where = info ? `<small>${info}</small>` : sp.hint ? `<small class="unknown">${sp.hint}</small>` : '';
      li.innerHTML = `<i style="background:${sp.breast};border-color:${sp.body}"></i><div>${known ? sp.name : '<span class="unknown">Not yet learned</span>'}${where}${known && sp.power ? `<small>Sing it: ${sp.power}</small>` : ''}</div>`;
      if (known) { const b = $('button', 'play', 'Play'); b.onclick = () => { audio.unlock(); playSong(sp); }; li.append(b); }
      book.append(li);
    }
    book.insertAdjacentHTML('afterbegin', `<li class="count">${G.learned.size} of ${species.length} songs learned</li>`);
    if (hooks.journal) {
      const j = hooks.journal();
      q('.journey').textContent = j.journey; q('.nest').textContent = j.nest;
      const ul = q('.landmarks'); ul.innerHTML = '';
      if (!j.landmarks.length) ul.innerHTML = '<li class="unknown">None found yet. Rare sights hide along the way.</li>';
      for (const l of j.landmarks) ul.append($('li', '', `${l.name} <small>${l.note}</small>`));
      hooks.drawMap?.(q('.map'));
    }
  }
  function open() { refresh(); menu.classList.remove('hidden'); onPause(true); }
  function close() { menu.classList.add('hidden'); onPause(false); }
  function toggle() { menu.classList.contains('hidden') ? open() : close(); }

  btn.addEventListener('click', () => { audio.unlock(); toggle(); });
  menu.addEventListener('click', e => {
    const act = e.target.dataset?.act;
    if (act === 'resume' || e.target === menu) close();
    if (act === 'sound') { audio.unlock(); audio.setOn(!audio.on); store.set('sound', audio.on); refresh(); }
    if (act === 'music') { audio.unlock(); G.settings.music = !G.settings.music; store.set('music', G.settings.music); hooks.music(G.settings.music); refresh(); }
    if (act === 'glide') { G.settings.glide = !G.settings.glide; store.set('glide', G.settings.glide); refresh(); }
    if (act === 'photo') { menu.classList.add('hidden'); hooks.photo(); }
    if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; installBtn.classList.add('hidden'); }
    if (act === 'debug') {
      const info = debugInfo(), el = e.target;
      navigator.clipboard?.writeText(info).then(() => { el.textContent = 'Copied. Paste it in the chat.'; }, () => { el.textContent = info; });
    }
    if (act === 'tune-reset') { Object.assign(TUNE, DEFAULTS); store.set('tune', {}); syncSliders(); }
    if (act === 'newgame' && confirmNew(e.target)) { hooks.newGame(); close(); }
    if (act === 'title') {
      const now = performance.now(); titleTaps = now - titleT < 600 ? titleTaps + 1 : 1; titleT = now;
      if (titleTaps >= 5) { q('.tuning').classList.remove('hidden'); q('.tuning').open = true; }
    }
  });
  // a second tap confirms, so a stray tap never wipes a journey
  function confirmNew(el) {
    if (el.dataset.armed) return true;
    el.dataset.armed = '1'; el.textContent = 'Tap again to start over (songs you learned are kept)';
    setTimeout(() => { delete el.dataset.armed; el.textContent = 'Start a new journey'; }, 3000);
    return false;
  }

  let deferredInstall = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; installBtn.classList.remove('hidden'); });

  // one toast at a time; later ones wait their turn so a hint is never cut short
  const queue = [];
  function toast(text, secs = 4.5) {
    if (toastTimer) { if (!queue.some(q => q[0] === text)) queue.push([text, secs]); return; }
    toastEl.textContent = text; toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastTimer = 0; if (queue.length) toast(...queue.shift()); }, 500);
    }, secs * 1000);
  }
  const isOpen = () => !menu.classList.contains('hidden');
  return { open, close, toggle, toast, refresh, isOpen, hideButton: h => btn.classList.toggle('hidden', h) };
}
