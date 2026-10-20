// The app around the game: Update (fetch every file afresh and reload), Full screen, Quit, and
// Quiet meters.
export function appRows(G) {
  // Update: save, fetch the newest version of every file past every cache, and start again on it,
  // so a new version shows in one go instead of after two reloads
  async function update() {
    G.persist();
    G.hud.toast('Fetching the latest Aloft…', 6);
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
    } catch { G.hud.toast('Could not reach the internet to update. Try again with a connection.', 5); }
  }
  // full screen hides the phone's status bar and buttons, so stray thumbs reach them less
  if (document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen)').matches) {
    G.menu.toggle('play', { label: 'Full screen', sub: 'off shows the phone’s bars and buttons', get: () => !!document.fullscreenElement,
      set: v => { if (v) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); } });
  }
  if ('serviceWorker' in navigator && 'caches' in window) G.menu.button('play', { label: 'Update', sub: 'fetch the latest version and reload', onClick: () => { G.menu.set(false); update(); } });
  G.menu.toggle('play', { label: 'Quiet meters', sub: 'hide them while they are well filled', get: () => G.hud.quiet, set: v => { G.hud.quiet = v; G.store.set('quietHud3d', v); } });

  // Quit saves, then closes the app if the system lets a page do that; if not, it says the
  // journey is safe and the app can be closed
  function quit() {
    G.persist();
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
    el.querySelector('button').onclick = () => { el.remove(); G.paused = false; };
  }
  G.menu.button('play', { label: 'Quit', sub: 'saves your journey, then closes', onClick: quit });
}
