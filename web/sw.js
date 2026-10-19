// Offline support. Stale-while-revalidate: the game opens instantly from cache and any
// update deployed since is fetched in the background, showing on the next launch.
const CACHE = 'aloft-v16';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'src/game.js', 'src/tune.js', 'src/util.js', 'src/paint.js', 'src/palette.js', 'src/world.js', 'src/bird.js', 'src/input.js', 'src/audio.js', 'src/songs.js', 'src/render.js', 'src/ui.js', 'src/life.js', 'src/journey.js', 'src/music.js', 'src/photo.js', 'src/gfx.js', 'src/singing.js', 'src/dial.js',
  'src/haptics.js', 'src/intentions.js', 'src/fauna.js', 'src/strips.js', 'src/controls.js', 'src/story.js', 'src/birdvoice.js', 'lab.html', 'lab.css', 'musiclab.html', 'src/letter.js',
  'fonts/cormorant-garamond-italic.woff2', 'fonts/spectral-regular.woff2', 'fonts/spectral-italic.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
