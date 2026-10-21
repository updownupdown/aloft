// Offline support. Stale-while-revalidate: the game opens instantly from cache and any
// update deployed since is fetched in the background, showing on the next launch. A new
// version installs past the browser's own cache, and Update in the menu fetches everything afresh.
const CACHE = 'aloft-v107';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  '3d/3d.css', '3d/main.js', '3d/gl.js', '3d/util.js', '3d/world.js', '3d/noise.js', '3d/biomes.js', '3d/shapes.js', '3d/hawk.js', '3d/render.js', '3d/chunkwork.js', '3d/input.js', '3d/flight.js',
  '3d/sky.js', '3d/hud.js', '3d/menu.js', '3d/camera.js', '3d/app.js', '3d/action.js', '3d/sys/air.js', '3d/sys/rings.js', '3d/sys/food.js', '3d/sys/aim.js', '3d/sys/flora.js', '3d/sys/sleep.js', '3d/sys/feel.js', '3d/sys/songs.js', '3d/sys/songbirds.js', '3d/sys/singui.js', '3d/sys/songs.css',
  '3d/facet.js', '3d/logo.js', '3d/compass.js', '3d/pics.js', '3d/letter.js', '3d/dial.js', '3d/shot.js', '3d/journal.js', '3d/sys/guide.js', '3d/sys/journey.js', '3d/sys/map.js', '3d/tips.js', '3d/sys/nest.js', '3d/sys/story.js', '3d/sys/photo.js', '3d/sys/howto.js', '3d/sys/aims.js', '3d/sys/seasons.js', '3d/sys/glow.js', '3d/sys/landair.js', '3d/sys/waters.js', '3d/sys/critters.js', '3d/sys/critshapes.js', '3d/sys/hunters.js', '3d/sys/season.js', '3d/sys/ghost.js',
  '3d/sys/weather.js', '3d/sys/winds.js', '3d/sys/fauna.js', '3d/sys/faunashapes.js', '3d/sys/lands.js', '3d/birds.js', '3d/sys/species.js', '3d/sys/moves.js', '3d/sys/life.js', 'birds.html', '3d/birdlab.js',
  'src/audio.js', 'src/music.js', 'src/birdvoice.js', 'src/songs.js', 'lab.html', 'lab.css', 'musiclab.html',
  'fonts/outfit.woff2'];

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
