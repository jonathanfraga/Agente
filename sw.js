const CACHE_NAME = 'bridgeia-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'services/fileService.js',
  'services/cryptoService.js',
  'manifest.json'
];

// Instala o aplicativo e guarda os arquivos no computador
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativa o aplicativo offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
