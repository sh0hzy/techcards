const CACHE_NAME = 'kazarbuild-v43';
const DATA_CACHE_NAME = 'kazarbuild-data-v1';

const ASSETS = [
  '/techcards/',
  '/techcards/index.html',
  '/techcards/card.html',
  '/techcards/admin.html',
  '/techcards/style.css',
  '/techcards/admin.css',
  '/techcards/js/config.js',
  '/techcards/js/i18n.js',
  '/techcards/js/supabase.js',
  '/techcards/js/app.js',
  '/techcards/js/card.js',
  '/techcards/js/admin.js',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing ...',);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets...');
        return cache.addAll(ASSETS);
      })
      .catch((err) => {
        console.error('[SW] Cache addAll failed:', err);
      })
  );
  
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  if (!url.hostname.includes('github.io') && url.protocol === 'https:') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  event.respondWith(cacheFirstWithUpdate(request));
});

async function networkFirstStrategy(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#f0f0f0" width="400" height="300"/><text fill="#999" font-family="sans-serif" font-size="18" x="50%" y="50%" text-anchor="middle" dy=".3em">Изображение недоступно</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirstWithUpdate(request) {
  const cache = await caches.open(CACHE_NAME);
  
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetchPromise;
  
  if (networkResponse) {
    return networkResponse;
  }
  
  if (request.headers.get('Accept')?.includes('text/html')) {
    const fallback = await cache.match('/techcards/index.html');
    if (fallback) return fallback;
  }
  
  return new Response('Offline', { status: 503 });
}