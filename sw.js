// sw.js - basic cache-first service worker for PWA assets
const CACHE_NAME = 'autofix-cache-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
