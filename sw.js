/*
 * sw.js — lets Food Journal open without internet.
 *
 * "Network first": when you're online you always get the newest version
 * of the app; a copy is saved so it still opens when you're offline.
 * (Your notes themselves are in localStorage, not here.)
 */
const CACHE = 'food-journal-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
