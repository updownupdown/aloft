// Offline support. Stale-while-revalidate: the game opens instantly from cache and any
// update deployed since is fetched in the background, showing on the next launch. A new
// version installs past the browser's own cache, and Update in the menu fetches everything afresh.
const CACHE = 'aloft-v43';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  '3d/3d.css', '3d/main.js', '3d/gl.js', '3d/util.js', '3d/world.js', '3d/shapes.js', '3d/hawk.js', '3d/render.js', '3d/input.js', '3d/flight.js',
  '3d/sky.js', '3d/hud.js', '3d/menu.js', '3d/camera.js', '3d/app.js', '3d/sys/air.js', '3d/sys/rings.js', '3d/sys/food.js', '3d/sys/aim.js', '3d/post.js',
  'src/audio.js', 'src/music.js', 'src/birdvoice.js', 'src/songs.js', 'lab.html', 'lab.css', 'musiclab.html',
  'fonts/cormorant-garamond-italic.woff2', 'fonts/spectral-regular.woff2', 'fonts/spectral-italic.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
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
