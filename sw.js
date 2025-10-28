// Minimal service worker to make the app installable and provide offline fallback
const CACHE_NAME = 'agrogestor-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/styles.css',
  '/script.js',
  '/auth.js',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Network-first for navigation, cache fallback for others
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')))
    return
  }
  event.respondWith(caches.match(event.request).then((resp) => resp || fetch(event.request).catch(() => {})))
})
