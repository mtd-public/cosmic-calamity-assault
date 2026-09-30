// Offline play once loaded (pattern from mtd-public/cosmic-calamity sw.js).
// Network first for everything so a new build is picked up immediately; the
// cache is only the offline fallback. Bump VERSION when the file list changes.
const VERSION = 'cca-v2';
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './touch-zoom-guard/touch-zoom-guard.css', './touch-zoom-guard/touch-zoom-guard.js',
  './js/main.js', './js/sim.js', './js/world.js', './js/levels.js', './js/tuning.js', './js/weapons.js', './js/enemies.js',
  './js/render.js', './js/models.js', './js/textures.js', './js/fx.js', './js/hud.js', './js/input.js', './js/pad.js',
  './js/rig.js', './js/rigs.js', './js/gunmodels.js', './js/viewmodel.js', './js/vehicles.js', './js/vehiclemodels.js',
  './js/audio.js', './js/sfx-synth.js', './js/utils.js', './js/vendor/three.module.min.js', './js/vendor/addons/BufferGeometryUtils.js',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res && res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))));
});
