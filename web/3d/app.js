// The app around the game: Update (fetch every file afresh and reload), Quit, Quiet meters, a new
// world, and full screen always (asked for again on the next touch whenever the phone's bars come
// back).
import { actionButton } from './action.js';

export function appRows(G) {
  // Update: save, fetch the newest version of every file past every cache, and start again on it,
  // so a new version shows in one go instead of after two reloads
  async function update() {
    G.persist();
    G.hud.reply('Fetching the latest Aloft…', 6);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await Promise.race([reg.update().catch(() => {}), new Promise(ok => setTimeout(ok, 6000))]);
        const w = reg.installing || reg.waiting;
        if (w) await new Promise(ok => { const done = () => (w.state === 'activated' || w.state === 'redundant') && ok(); w.addEventListener('statechange', done); done(); setTimeout(ok, 8000); });
      }
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        await Promise.all((await c.keys()).map(async q => { const r = await fetch(q.url, { cache: 'reload' }); if (r.ok) await c.put(q, r); }));
      }
      location.reload();
    } catch { G.hud.reply('Could not reach the internet to update. Try again with a connection.', 5); }
  }
  // full screen hides the phone's status bar and buttons, so stray thumbs reach them less; a page
  // may only ask from inside a touch, so each touch asks while it is not full screen
  let askT = 0;
  const wantFull = document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen)').matches && matchMedia('(pointer: coarse)').matches;
  if (wantFull) G.on('gesture', () => {
    if (document.fullscreenElement || quitting || performance.now() - askT < 1500) return;
    askT = performance.now(); document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  });
  let quitting = false;
  if ('serviceWorker' in navigator && 'caches' in window) {
    const row = G.menu.button('play', { label: 'Update', sub: 'fetch the latest version and reload', group: 'app', onClick: () => { G.menu.set(false); update(); } });
    // the build this page started on: the number of sw.js's CACHE ('aloft-v220' is build 220), read
    // once at boot so a newer build installing in the background does not claim to be running
    caches.keys().then(ks => {
      const n = Math.max(0, ...ks.map(k => +(/^aloft-v(\d+)$/.exec(k)?.[1] || 0)));
      G.build = n || null;
      row.querySelector('em').textContent = `${n ? `build ${n}` : 'build unknown (not cached yet)'}: tap to fetch the latest and reload`;
    }).catch(() => {});
  }
  // colour-blind aim colours: orange and blue for prey and perches in place of red and green
  // (sys/aim.js reads it; each aim ring also has its own shape)
  G.settings.cbAim = G.store.get('cbAim3d', false);
  G.menu.toggle('play', { label: 'Colour-blind aim colours', sub: 'orange prey, blue perches', get: () => G.settings.cbAim, set: v => { G.settings.cbAim = v; G.store.set('cbAim3d', v); } });

  // Quit saves, then closes the app if the system lets a page do that; if not, it says the
  // journey is safe and the app can be closed
  function quit() {
    G.persist(); quitting = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    try { window.close(); } catch { /* not allowed */ }
    setTimeout(goodbye, 250);
  }
  function goodbye() {
    if (document.hidden) return;
    G.menu.set(false); G.paused = true;
    document.getElementById('ui3').insertAdjacentHTML('beforeend', `<div class="veil3 bye3"><div class="card3"><h1>Aloft</h1>
      <p>Your journey is saved. You can close the app now, or fly on.</p><button class="main3">Fly on</button></div></div>`);
    const el = document.querySelector('.bye3');
    el.querySelector('button').onclick = () => { el.remove(); G.paused = false; quitting = false; };
  }
  // Graphics: one row for how much the world draws. Low, Medium or High pick a level (0, 1, 2);
  // Ultra is High with mirror reflections (look.js T; real shadows were taken out, James 10-24; Auto never picks it);
  // Auto starts at Medium and lets the frame watch (G6, flight thread) move G.gfx.level. Systems
  // listen for 'gfx' (ground detail, tree density, tree distance); the ground's view distance is set here. After a change
  // the frame rate shows for a little while in play, so the difference can be seen
  const PRESETS = ['auto', 'low', 'medium', 'high', 'ultra'], LEVEL = { low: 0, medium: 1, high: 2, ultra: 2 }, VIEW = [.8, 1, 1.15];
  const R = G.R, base = R.view;
  G.gfx = { preset: PRESETS.includes(G.store.get('gfx3d')) ? G.store.get('gfx3d') : 'auto', level: 1 };
  G.gfx.level = LEVEL[G.gfx.preset] ?? G.store.get('gfxAuto3d', 1);
  const applyGfx = () => {
    R.view = base * VIEW[G.gfx.level];
    G.emit('gfx', G.gfx.level);
  };
  G.on('gfxAuto', lv => { if (G.gfx.preset !== 'auto' || lv === G.gfx.level) return; G.gfx.level = lv; G.store.set('gfxAuto3d', lv); applyGfx(); });
  // what each level draws, in words (VIEW above; tree distances in main.js treeGfx; ground in lands.js)
  const SAYS = ['you see 20% less far, trees to 300 m (flat pictures past 150 m), full trees within 80 m',
    'trees to 400 m (flat pictures past 210 m), full trees within 110 m', 'you see 15% farther, trees to 460 m (flat pictures past 280 m), full trees within 130 m, foam on the shores'];
  const gfxSub = p => 'How far you see and how many trees are drawn. ' + (p === 'auto'
    ? `Auto starts at Medium and steps down when frames drop, up when there is room, never to Ultra (now ${['Low', 'Medium', 'High'][G.gfx.level]})`
    : p === 'ultra' ? `Ultra: as High, with trees to 540 m (flat only past 400 m), plus the hills mirrored in the water. Costly: a phone may lose a fifth of its frames or more`
    : `${p[0].toUpperCase() + p.slice(1)}: ${SAYS[LEVEL[p]]}`);
  let peekFps = false;
  G.menu.choice('play', { label: 'Graphics', options: PRESETS.map(p => [p, p[0].toUpperCase() + p.slice(1)]), get: () => G.gfx.preset, sub: gfxSub, set: p => {
    G.gfx.preset = p; G.store.set('gfx3d', p);
    G.gfx.level = LEVEL[p] ?? G.store.get('gfxAuto3d', 1);
    applyGfx(); peekFps = true;
  } });
  G.on('resume', () => {
    if (!peekFps || G.settings.fps) return;
    peekFps = false; G.hud.showFps(true); G.hud.reply('The frame rate shows for a few seconds, top right.', 4);
    setTimeout(() => { if (!G.settings.fps) G.hud.showFps(false); }, 12000);
  });
  applyGfx();
  // the screen stays awake while flying (it would dim in a long glide); let go while paused
  let lock = null;
  const wake = async () => { if (lock || G.paused || document.hidden || !navigator.wakeLock) return; try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch { lock = null; } };
  G.on('resume', wake); G.on('gesture', wake);
  G.on('pause', () => { lock?.release().catch(() => {}); lock = null; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // haptics: a tick for each wing beat, a thump on landing, a knock on a bump, a pulse on catching
  // food or entering strong lift, a flutter for a gust, a long buzz when a stoop reaches full speed
  G.settings.haptics = G.store.get('haptics3d', true);
  if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) {
    const buzz = p => { if (G.settings.haptics && !G.paused) try { navigator.vibrate(p); } catch { /* not allowed */ } };
    G.on('flap', () => buzz(7)); G.on('land', () => buzz(28)); G.on('bump', () => buzz([18, 40, 18]));
    G.on('catch', () => buzz([12, 50, 24])); G.on('ring', () => buzz(14));
    G.on('gust', (k, head) => buzz(head > .3 ? [8, 40, 8, 40, 8] : 30));   // met nose-on a gust lifts; side-on it rocks
    let inLift = false, fast = false;
    setInterval(() => {
      const b = G.b; if (!b || G.paused || b.state !== 'fly') { inLift = fast = false; return; }
      if (b.lift > 1.6 && !inLift) buzz([10, 60, 10]); inLift = b.lift > 1.2 ? inLift || b.lift > 1.6 : false;
      if (b.s > 36 && !fast) buzz(160); fast = b.s > 31 ? fast || b.s > 36 : false;
    }, 120);
    G.menu.toggle('play', { label: 'Haptics', sub: 'feel wing beats, landings, lift', get: () => G.settings.haptics, set: v => { G.settings.haptics = v; G.store.set('haptics3d', v); if (v) buzz(20); } });
  }
  actionButton(G, document.getElementById('ui3'));
  G.menu.quit = quit;
}
