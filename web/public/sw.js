/* Service worker for the Target Tracker PWA.
   - App code (hashed files in /assets/): cache first, they never change.
   - Page (index.html): network first, falls back to the cached copy, then to offline.html.
   - Data (payload*.json, pricing_store*.b64, any /api/ call): never cached. Merchant and pricing data
     stays out of the device cache and is always fresh. Offline, the app opens but shows the offline page
     until the data can be loaded. */
const VERSION = "tt-v1";
const SHELL = VERSION + "-shell";
const ASSETS = VERSION + "-assets";
const DATA = /(payload[^/]*\.json|pricing_store[^/]*\.b64|\/api\/)/i;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["./", "offline.html", "manifest.webmanifest", "icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // fonts and other sites: browser default
  if (DATA.test(url.pathname)) return;                    // data: straight to the network, never stored

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put("./", copy)); return res; })
        .catch(() => caches.match("./").then((r) => r || caches.match("offline.html")))
    );
    return;
  }

  if (/\/assets\//.test(url.pathname) || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
