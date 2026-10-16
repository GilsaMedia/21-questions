importScripts('./config.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

// The messaging SDK displays push notifications and opens fcmOptions.link on tap.
firebase.initializeApp(self.APP_CONFIG.firebase);
firebase.messaging();

const CACHE = 'q21-v2';
// Vite's hashed JS/CSS files get cached by the fetch handler the first time they load.
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Own files: network first so updates show up immediately, cache as offline fallback.
  if (url.origin === location.origin) {
    e.respondWith(fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })));
    return;
  }

  // Versioned SDK files and fonts never change: cache first.
  if (url.hostname === 'www.gstatic.com' || url.hostname.startsWith('fonts.')) {
    e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })));
  }
});
