/* Minimaler Offline-Cache fuer die statischen Dateien.
   API-Aufrufe (POST/GET an den Server) werden NICHT gecacht. */
const CACHE = "fms-tool-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/statuses.js",
  "./js/api.js",
  "./js/app.js",
  "./data/gears.js",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Nur eigene statische GET-Dateien aus dem Cache bedienen.
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
