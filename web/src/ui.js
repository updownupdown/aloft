// DOM overlay: the menu button, pause menu (settings, journal, how to play, tuning) and toasts.
import { TUNE, DEFAULTS, RANGES } from './tune.js';
import { GFX, GFX_INFO, RES_OPTS, saveGfx, overlay, debugInfo } from './gfx.js';
import { letter } from './letter.js';

export function createUI({ audio, G, store, species, onPause, playSong, haptics, hooks = {} }) {
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
      <header class="card-head"><h1 data-act="title">Aloft</h1><p class="sub"></p></header>
      <nav class="tabs" role="tablist">
        <button data-tab="play" role="tab">Settings</button>
        <button data-tab="journal" role="tab" class="hidden">Journal</button>
        <button data-tab="songs" role="tab">Songs</button>
        <button data-tab="help" role="tab">How to play</button>
        <button data-tab="gfx" role="tab">Graphics</button>
      </nav>
      <div class="panes">
        <section class="pane" data-pane="play">
          <button data-act="photo" class="row-btn hidden">Photo mode</button>
          <button data-act="sound" class="sw" role="switch"><span>Sound</span><i></i></button>
          <button data-act="music" class="sw hidden" role="switch"><span>Music</span><i></i></button>
          <button data-act="musicmode" class="row-btn hidden">Music style <em></em></button>
          <a class="row-btn" href="musiclab.html">Music lab <em>tune Valley</em></a>
          <button data-act="haptics" class="sw" role="switch"><span>Vibration</span><i></i></button>
          <button data-act="glide" class="sw" role="switch"><span>Glide line</span><i></i></button>
          <button data-act="quiet" class="sw" role="switch"><span>Quiet meters <small>hide when full</small></span><i></i></button>
          <button data-act="lefty" class="sw" role="switch"><span>Left-handed</span><i></i></button>
          <button data-act="full" class="sw hidden" role="switch"><span>Full screen</span><i></i></button>
          <button data-act="install" class="row-btn hidden">Install on this phone</button>
          <button data-act="quit" class="row-btn hidden">Quit</button>
          <button data-act="newgame" class="quiet hidden">Start a new journey</button>
        </section>
        <section class="pane" data-pane="journal">
          <p class="journey"></p>
          <canvas class="map" width="720" height="150"></canvas>
          <p class="intent"></p>
          <p class="nest"></p>
          <p class="court"></p>
          <h3>Landmarks</h3>
          <ul class="landmarks"></ul>
          <h3>Field guide <small class="guide-count"></small></h3>
          <ul class="guide"></ul>
          <h3>Album</h3>
          <div class="album"></div>
          <p class="world"><span></span> <button data-act="share" class="quiet">Share this world</button></p>
        </section>
        <section class="pane" data-pane="songs">
          <a class="quiet" href="lab.html">Bird song lab: try other voices for the songbirds</a>
          <ul class="songbook"></ul>
        </section>
        <section class="pane" data-pane="help">
          <ul class="howto">
            <li>Hold the phone sideways with a thumb on each of the two watercolour <b>sticks</b> in the bottom corners. A stick leans from wherever your thumb lands.</li>
            <li><b>Tap both sticks together</b> to flap. Well-timed beats barely tire the wings; ragged taps waste strength. One stick on its own gives a weak, tiring half-beat.</li>
            <li><b>Flick one stick sideways</b> to turn that way, or lean both the same way.</li>
            <li><b>Push both up</b> and the hawk trims for its longest glide, or inside a thermal it <b>rides the thermal</b>: it floats up as high as the air goes, turning back softly at the edges. <b>Both down</b> and it slows and settles down to land.</li>
            <li><b>One up and one down</b> tilts the nose. Pushed hard over at speed it flies one <b>loop</b> (nose up) or <b>front flip</b> (nose down); bring the sticks back toward the middle before the next. A cloud ring straight after gives a big burst of speed.</li>
            <li><b>Both inward</b> picks a branch nearby and flies to it. <b>Inward and down</b> picks a mouse or a fish and stoops on it. <b>Inward and up</b> finds the nearest thermal and heads for it. Let go to break off.</li>
            <li><b>Both outward</b> hangs the hawk on beating wings to look around (it tires them). <b>Outward and down</b> is a stoop, wings tucked. <b>Outward and up</b> gives the hawk's call.</li>
            <li>On a branch or the ground: tap <b>one stick</b> to hop that way; tap <b>both</b> to take off; push <b>both down</b> to eat or drink, or on a branch to drop down to the one below.</li>
            <li>In the middle of the screen, tap things to go to them (a branch, berries, the water). Press and hold there to point the hawk at your finger, as before.</li>
            <li>Let go and the hawk glides on its own. Diving builds speed; pulling up trades it for height. Too slow and it stalls.</li>
            <li>To land softly, <b>flare</b>: point up just before the branch or the ground.</li>
            <li><b>Thermals</b> rise above the treeline on sunny afternoons. Let go inside one and the hawk floats up as it glides across; turn back to stay in it, and the lift is strongest in the core. Look for <b>leaves</b> spiralling upward. <b>Cloud rings</b> hang all over the sky; fly through one for a burst of speed. Wind against a hillside gives <b>ridge lift</b>. Rising air beeps.</li>
            <li><b>Kiting:</b> face into the wind, low over open ground, and hold the nose a little up. The hawk hangs still on the air and the mice below show themselves. Point down to stoop on one.</li>
            <li>The <b>call</b> button (top) gives the red-tail's scream. Mice freeze in the open, other hawks answer, and your companion or fledgling comes to you. Keyboard: C.</li>
            <li><b>Tap a branch</b> to fly to it and perch. From evening on, a perched hawk can tap <b>Sleep</b> (top) to roost until dawn.</li>
            <li>Land on a pond to swim, then <b>tap the water</b> to drink. Three sips fill your thirst.</li>
            <li>On the ground, hold left or right to walk. <b>Tap berries</b> (six fill you) or, after rain, <b>worms</b> (three fill you). Dive at <b>mice</b> in the grass or <b>fish</b> in ponds.</li>
            <li>On a branch, two half rings of pools open round the sticks. Round the right stick are the five <b>song notes</b>, low to high. Perch near a <b>songbird</b>, listen, then touch each note in turn; the pools glow as the bird sings them, and the next one wears a red ring. A wrong note only flashes, so carry on. Round the left stick are the <b>birds you know</b>: touch one and the hawk sings its whole song, and that bird answers with its gift. Keyboard: keys 1 to 5.</li>
            <li>Once you know a bird's song, singing beside it is a <b>duet</b>: it sings the first half and you answer with the rest. The cleaner your pitch and timing, the longer its gift lasts. On some mornings the whole wood sings a <b>dawn chorus</b>: join in and every bird you know answers at once.</li>
            <li>Each dawn the <b>Journal</b> offers one small intention for the day; finish it and you earn a feather. Pictures from photo mode go in the journal's album.</li>
            <li>The seasons turn every eight days. Follow the flocks <b>south</b> (to the right) to the wintering marsh, and home again in spring. The <b>Journal</b> keeps your map and the landmarks you find.</li>
            <li>Keep well fed and watered and flap cleanly, and over time your hawk grows <b>healthy</b>: its tail turns a deep, glossy red. Nothing bad happens when you are hungry or thirsty; health just builds more slowly.</li>
            <li>Rare <b>keepsakes</b> glint in the grass: land and tap one to keep it for a nest. Down south in the wintering marsh, a hawk may come to look you over. A healthy tail, keepsakes, songs you know and <b>acrobatics</b> win it as your <b>mate</b>, who flies with you and helps feed your chick.</li>
            <li>Pick up a <b>twig</b> under a tree and perch on a branch to start a <b>nest</b>. Five twigs and an egg appears; when it hatches, carry mice and fish home to feed the chick.</li>
            <li>Keyboard: Space flap, arrow keys or WASD to steer and walk, E to drink or eat, Esc for this menu.</li>
          </ul>
        </section>
        <section class="pane" data-pane="gfx">
          <div class="gfx-list"></div>
          <small>Turn layers off if the game runs slowly on your device. Resolution "auto" lowers itself while frames are slow.</small>
          <button data-act="debug" class="quiet">Copy debug info</button>
          <details class="tuning hidden">
            <summary>Tuning</summary>
            <div class="sliders"></div>
            <button data-act="tune-reset" class="quiet">Reset tuning</button>
          </details>
        </section>
      </div>
      <footer class="card-foot"><button data-act="resume" class="primary">Resume</button></footer>
    </div>`;
  root.append(menu);
  letter(menu);
  const q = s => menu.querySelector(s);
  const soundBtn = q('[data-act=sound]'), musicBtn = q('[data-act=music]'), glideBtn = q('[data-act=glide]'), quietBtn = q('[data-act=quiet]');
  const hapticsBtn = q('[data-act=haptics]'), leftyBtn = q('[data-act=lefty]');
  root.classList.toggle('lefty', !!G.settings.lefty);
  const installBtn = q('[data-act=install]'), book = q('.songbook');
  const modeBtn = q('[data-act=musicmode]');
  if (hooks.music) musicBtn.classList.remove('hidden');
  if (hooks.musicMode) modeBtn.classList.remove('hidden');
  if (hooks.photo) q('[data-act=photo]').classList.remove('hidden');
  if (hooks.journal) q('[data-tab=journal]').classList.remove('hidden');

  // tabs: one section at a time, remembered between visits
  let tab = store.get('tab', 'play');
  function showTab(t) {
    if (!q(`[data-tab=${t}]`) || q(`[data-tab=${t}]`).classList.contains('hidden')) t = 'play';
    tab = t; store.set('tab', t);
    for (const b of menu.querySelectorAll('[data-tab]')) { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of menu.querySelectorAll('.pane')) p.classList.toggle('hidden', p.dataset.pane !== t);
    q('.panes').scrollTop = 0;
    if (t === 'journal') hooks.drawMap?.(q('.map'));
  }
  if (hooks.newGame) q('[data-act=newgame]').classList.remove('hidden');
  if (hooks.quit) q('[data-act=quit]').classList.remove('hidden');
  const fullBtn = q('[data-act=full]');
  if (hooks.fullscreen && document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) fullBtn.classList.remove('hidden');

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
    const r = $('button', 'row-btn res', `Resolution <em>${GFX.res === 'auto' ? 'auto' : GFX.res + 'x'}</em>`); r.dataset.gfx = 'res'; gfxList.append(r);
    for (const [k, name] of GFX_INFO) {
      const b = $('button', 'sw' + (GFX[k] ? ' on' : ''), `<span>${name}</span><i></i>`); b.dataset.gfx = k; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', !!GFX[k]); gfxList.append(b);
    }
  }
  gfxList.addEventListener('click', e => {
    const k = e.target.closest('[data-gfx]')?.dataset.gfx; if (!k) return;
    if (k === 'res') GFX.res = RES_OPTS[(RES_OPTS.indexOf(GFX.res) + 1) % RES_OPTS.length];
    else GFX[k] = !GFX[k];
    saveGfx(store); overlay(GFX.fps); hooks.gfx?.(k); gfxButtons();
  });

  function refresh() {
    gfxButtons();
    q('.sub').textContent = hooks.subtitle ? hooks.subtitle() : 'Paused';
    const sw = (el, on) => { el.classList.toggle('on', !!on); el.setAttribute('aria-checked', !!on); };
    if (hooks.musicMode) { const m = hooks.musicMode(); modeBtn.querySelector('em').textContent = hooks.musicModes.find(x => x[0] === m)?.[1] ?? m; }
    sw(soundBtn, audio.on); sw(musicBtn, G.settings.music); sw(glideBtn, G.settings.glide); sw(quietBtn, G.settings.quiet); sw(hapticsBtn, haptics?.on); sw(leftyBtn, G.settings.lefty); sw(fullBtn, G.settings.full);
    if (!haptics) hapticsBtn.classList.add('hidden');
    book.innerHTML = '';
    for (const sp of species) {
      const li = $('li');
      const known = G.learned.has(sp.id), info = G.songLog?.[sp.id];
      const where = info ? `<small>${info}</small>` : sp.hint ? `<small class="unknown">${sp.hint}</small>` : '';
      li.innerHTML = `<i style="--body:${sp.body};--breast:${sp.breast}"></i><div>${known ? sp.name : '<span class="unknown">Not yet learned</span>'}${where}${known && sp.power ? `<small>Sing it: ${sp.power}</small>` : ''}</div>`;
      if (!known) li.classList.add('unknown-sp');
      if (known) { const b = $('button', 'play', 'Play'); b.setAttribute('aria-label', `Play the ${sp.name}'s song`); b.onclick = () => { audio.unlock(); playSong(sp); }; li.append(b); }
      book.append(li);
    }
    book.insertAdjacentHTML('afterbegin', `<li class="count">${G.learned.size} of ${species.length} songs learned</li>`);
    if (hooks.journal) {
      const j = hooks.journal();
      q('.journey').textContent = j.journey; q('.nest').textContent = j.nest; q('.court').textContent = j.court || '';
      const ul = q('.landmarks'); ul.innerHTML = '';
      if (!j.landmarks.length) ul.innerHTML = '<li class="unknown">None found yet. Rare sights hide along the way.</li>';
      for (const l of j.landmarks) ul.append($('li', '', `${l.name} <small>${l.note}</small>`));
      if (tab === 'journal') hooks.drawMap?.(q('.map'));
      q('.intent').textContent = j.intent || '';
      q('.world span').textContent = j.world || '';
      // the field guide: a page per animal, its picture once seen, an empty round until then
      const pages = hooks.guide?.() || [], gl = q('.guide');
      q('.guide-count').textContent = `${pages.filter(p => p.seen).length} of ${pages.length} seen`;
      gl.textContent = '';
      for (const p of pages) {
        const li = $('li'); li.className = p.seen ? 'seen' : '';
        li.innerHTML = `<div class="pic"></div><div><b></b><small></small></div>`;
        if (p.seen) { const img = $('img'); img.alt = ''; img.src = p.seen.src; li.querySelector('.pic').append(img); }
        li.querySelector('b').textContent = p.seen ? p.name : 'Not yet seen';
        li.querySelector('small').textContent = p.seen ? `${p.note} ${p.seen.note}` : p.hint ? `A songbird. ${p.hint}.` : 'Keep your eyes open.';
        gl.append(li);
      }
      const album = q('.album'), pics = hooks.album?.() || [];
      album.innerHTML = pics.length ? '' : '<small class="unknown">No pictures yet. Photo mode is in this menu.</small>';
      for (const p of pics.slice().reverse()) { const fig = $('figure', p.card ? 'postcard' : ''); fig.innerHTML = `<img alt=""><figcaption></figcaption>`; fig.querySelector('img').src = p.src; fig.querySelector('figcaption').textContent = p.note; album.append(fig); }
    }
  }
  function open() { refresh(); showTab(tab); menu.classList.remove('hidden'); root.classList.add('menu-open'); onPause(true); }
  function close() { menu.classList.add('hidden'); root.classList.remove('menu-open'); onPause(false); }
  function toggle() { menu.classList.contains('hidden') ? open() : close(); }

  btn.addEventListener('click', () => { audio.unlock(); toggle(); });
  menu.addEventListener('click', e => {
    const t = e.target.closest?.('[data-tab]'); if (t) { showTab(t.dataset.tab); return; }
    const act = e.target.closest?.('[data-act]')?.dataset.act;
    if (act === 'resume' || e.target === menu) close();
    if (act === 'sound') { audio.unlock(); audio.setOn(!audio.on); store.set('sound', audio.on); refresh(); }
    if (act === 'music') { audio.unlock(); G.settings.music = !G.settings.music; store.set('music', G.settings.music); hooks.music(G.settings.music); refresh(); }
    if (act === 'musicmode') {
      // each tap moves to the next style; music comes on if it was off, so the new style is heard
      audio.unlock(); const M = hooks.musicModes, i = M.findIndex(x => x[0] === hooks.musicMode());
      hooks.musicMode(M[(i + 1) % M.length][0]);
      if (!G.settings.music) { G.settings.music = true; store.set('music', true); hooks.music(true); }
      refresh();
    }
    if (act === 'glide') { G.settings.glide = !G.settings.glide; store.set('glide', G.settings.glide); refresh(); }
    if (act === 'quiet') { G.settings.quiet = !G.settings.quiet; store.set('quietHud', G.settings.quiet); refresh(); }
    if (act === 'haptics' && haptics) { haptics.setOn(!haptics.on); if (haptics.on) haptics.land(false); refresh(); }
    if (act === 'full') { hooks.fullscreen(!G.settings.full); refresh(); }
    if (act === 'quit') { close(); hooks.quit(); }
    if (act === 'lefty') { G.settings.lefty = !G.settings.lefty; store.set('lefty', G.settings.lefty); root.classList.toggle('lefty', G.settings.lefty); refresh(); }
    if (act === 'share') {
      const el = e.target, url = hooks.journal?.().link || location.href;
      const copied = () => { el.textContent = 'Link copied'; setTimeout(() => { el.textContent = 'Share this world'; }, 2500); };
      if (navigator.share) navigator.share({ title: 'Aloft', text: 'Fly the same hills as me in Aloft.', url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(copied, () => { el.textContent = url; });
    }
    if (e.target.tagName === 'IMG' && e.target.closest('.album')) e.target.closest('figure').classList.toggle('big');
    if (act === 'photo') { menu.classList.add('hidden'); root.classList.remove('menu-open'); hooks.photo(); }
    if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; installBtn.classList.add('hidden'); }
    if (act === 'debug') {
      const info = debugInfo(), el = e.target;
      navigator.clipboard?.writeText(info).then(() => { el.textContent = 'Copied. Paste it in the chat.'; }, () => { el.textContent = info; });
    }
    if (act === 'tune-reset') { Object.assign(TUNE, DEFAULTS); store.set('tune', {}); syncSliders(); }
    if (act === 'newgame' && confirmNew(e.target)) { hooks.newGame(); close(); }
    if (act === 'title') {
      const now = performance.now(); titleTaps = now - titleT < 600 ? titleTaps + 1 : 1; titleT = now;
      if (titleTaps >= 5) { q('.tuning').classList.remove('hidden'); q('.tuning').open = true; showTab('gfx'); }
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
  // after Quit, if the page could not close itself: the journey is saved, close whenever you like
  function goodbye() {
    if (document.hidden) return;
    const g = $('div', 'menu goodbye', `<div class="card"><header class="card-head"><h1>Aloft</h1></header><p class="bye">Your journey is saved. You can close the app now, or fly on.</p><footer class="card-foot"><button class="primary">Fly on</button></footer></div>`);
    g.querySelector('.primary').onclick = () => g.remove();
    root.append(g);
    onPause(true); g.querySelector('.primary').addEventListener('click', () => onPause(false));
  }
  return { open, close, toggle, toast, refresh, isOpen, goodbye, hideButton: h => btn.classList.toggle('hidden', h) };
}
