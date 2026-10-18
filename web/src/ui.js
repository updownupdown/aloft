// DOM overlay: the menu button, pause menu (settings, how to play, songbook) and toasts.
export function createUI({ audio, G, store, species, onPause, playSong }) {
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
      <h1>Aloft</h1>
      <p class="sub">Paused</p>
      <button data-act="resume" class="primary">Resume</button>
      <button data-act="sound"></button>
      <button data-act="install" class="hidden">Install the app</button>
      <details>
        <summary>How to play</summary>
        <ul class="howto">
          <li><b>Tap</b> to flap. One tap, one wingbeat.</li>
          <li><b>Press and hold</b> anywhere to point the hawk toward your finger. Point down to dive, up to climb, behind to turn around.</li>
          <li>Let go and the hawk glides on its own. Diving builds speed; pulling up trades it for height. Too slow and it stalls.</li>
          <li><b>Thermals</b> rise above the treeline. Let go inside one and the hawk circles up. High thermals hold <b>rings</b> to fly through.</li>
          <li><b>Tap a branch</b> to fly to it and perch. Arrive slowly to land.</li>
          <li>Land on a pond to swim, then <b>tap the water</b> to drink. Three sips fill your thirst.</li>
          <li>On the ground, hold left or right to walk. <b>Tap berries</b> (six fill you) or, after rain, <b>worms</b> (three fill you).</li>
          <li>Perch near a <b>songbird</b> and a staff appears. Listen, then tap its lines to sing the song back.</li>
          <li>Keyboard: Space flap, arrow keys or WASD to steer and walk, E to drink or eat, Esc for this menu.</li>
        </ul>
      </details>
      <details>
        <summary>Songbook</summary>
        <ul class="songbook"></ul>
      </details>
    </div>`;
  root.append(menu);
  const soundBtn = menu.querySelector('[data-act=sound]');
  const installBtn = menu.querySelector('[data-act=install]');
  const book = menu.querySelector('.songbook');

  function refresh() {
    soundBtn.textContent = `Sound: ${audio.on ? 'on' : 'off'}`;
    book.innerHTML = '';
    for (const sp of species) {
      const li = $('li');
      const known = G.learned.has(sp.id);
      li.innerHTML = `<i style="background:${sp.breast};border-color:${sp.body}"></i>${known ? sp.name : '<span class="unknown">Not yet learned</span>'}`;
      if (known) { const b = $('button', 'play', 'Play'); b.onclick = () => { audio.unlock(); playSong(sp); }; li.append(b); }
      book.append(li);
    }
    const n = G.learned.size;
    book.insertAdjacentHTML('afterbegin', `<li class="count">${n} of ${species.length} songs learned</li>`);
  }
  function open() { refresh(); menu.classList.remove('hidden'); onPause(true); }
  function close() { menu.classList.add('hidden'); onPause(false); }
  function toggle() { menu.classList.contains('hidden') ? open() : close(); }

  btn.addEventListener('click', () => { audio.unlock(); toggle(); });
  menu.addEventListener('click', e => {
    const act = e.target.dataset?.act;
    if (act === 'resume' || e.target === menu) close();
    if (act === 'sound') { audio.unlock(); audio.setOn(!audio.on); store.set('sound', audio.on); refresh(); }
    if (act === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; installBtn.classList.add('hidden'); }
  });

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
  return { open, close, toggle, toast, refresh };
}
