const CACHE_NAME = 'lidercontrol-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './menu.html',
  './formulario.html',
  './styles.css',
  './menu.css',
  './formulario.css',
  './menu.js',
  './formulario.js',
  './app.js',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Al instalar el Service Worker, se cachean los archivos especificados
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Archivos cacheados:', urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

// Estrategia "Stale-While-Revalidate" para servir recursos
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Actualiza el recurso en caché con la versión más reciente de la red
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => {
            // Si falla la red y no está cacheado, devolver un recurso alternativo
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        // Devuelve la respuesta cacheada o la promesa de red
        return response || fetchPromise;
      });
    })
  );
});

// Activación del Service Worker y limpieza de cachés antiguos
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Manejo de errores y recursos faltantes
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html'); // Devuelve la página inicial en caso de error
          }
        })
      );
    })
  );
});