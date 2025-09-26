// Contenido corregido para service-worker.js
const CACHE_NAME = 'lidercontrol-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './menu.html',
  './formulariocaj.html', // Agregado
  './formularioof.html',  // Agregado
  './styles.css',
  './menu.css',
  './script.js', // Corregido el nombre del archivo
  './menu.js',
  './formulariocaj.js', // Agregado
  './formularioof.js',  // Agregado
  './firebase-config.js', // Agregado para que la config esté offline
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
  // Asegúrate de que los archivos 'formulario.html', '.css', '.js' no estén si no los usas.
];

self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Archivos cacheados:', urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

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

// Listener 'fetch' ÚNICO Y CORREGIDO
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Si la petición a la red es exitosa, la guardamos en caché.
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });

        // Devolvemos la respuesta cacheada inmediatamente si existe,
        // mientras en segundo plano se actualiza desde la red.
        // Si no hay nada en caché, esperamos a la respuesta de la red.
        return cachedResponse || fetchPromise;
      }).catch(() => {
        // Si todo falla (ni caché ni red), para peticiones de navegación,
        // devolvemos el index.html como fallback.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});