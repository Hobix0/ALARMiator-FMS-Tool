/* Service-Worker: Netzwerk zuerst, Cache als Fallback (offline).
   "Netzwerk zuerst" verhindert, dass alte Dateien haengen bleiben - Aenderungen
   kommen beim naechsten Laden mit Verbindung sofort an.
   Fremd-Hosts (Firebase, Leaflet, OSM, API) werden NICHT behandelt/gecacht. */
const CACHE = "fms-tool-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./karte.html",
  "./uebersicht.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/statuses.js",
  "./js/api.js",
  "./js/sync.js",
  "./js/app.js",
  "./js/map.js",
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
  const url = new URL(req.url);
  if(req.method !== "GET" || url.origin !== location.origin) return; // API/CDN direkt ans Netz

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
