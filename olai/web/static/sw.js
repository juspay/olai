// olai service worker: shell offline, live data stays live.
//
// Cache the skin and scripts so a reopen without the network still draws.
// HTML is network-first with a cache fallback (last good page for offline
// reading). API, chat POSTs, and the SSE stream are never cached — they are
// the live view, and a stale one is worse than none.
//
// Capture-queue / background-sync is roadmap 0.7's second half; this file is
// the installable shell only.

var CACHE = 'olai-shell-v1';
var SHELL = [
  '/static/app.css',
  '/static/htmx.min.js',
  '/static/sse.js',
  '/static/collapse.js',
  '/static/prefs.js',
  '/static/chat.js',
  '/static/pwa.js',
  '/static/icon.svg',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/apple-touch-icon.png',
  '/static/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll fails the whole batch on one 404; one-by-one keeps the rest.
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isShell(url) {
  return url.pathname.indexOf('/static/') === 0;
}

function isLive(url) {
  // never cache the stream, the write verbs, or agent JSON
  return url.pathname === '/events'
    || url.pathname.indexOf('/api/') === 0
    || url.pathname.indexOf('/chat') === 0;
}

function isPage(url) {
  return url.pathname === '/' || url.pathname === '/today';
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isLive(url)) return; // network only, no intercept

  if (isShell(url)) {
    // cache-first: the skin rarely moves, and no-cache on app.css still
    // revalidates when online via the network branch below on miss
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  if (isPage(url)) {
    // network-first: online is the truth; offline is the last good page
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/') || new Response(
            'olai is offline and has nothing cached yet.\n',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
          );
        });
      })
    );
  }
});
