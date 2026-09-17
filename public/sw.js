// Cache volutamente limitata alla struttura dell'app. I contenuti della guida e
// la chat non vengono salvati sul dispositivo: appartengono alla struttura e
// possono cambiare, oltre a non dover restare sul telefono di un ospite.
const CACHE = 'haplyhost-shell-v1'
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(OFFLINE)) || Response.error())
    )
  }
})
