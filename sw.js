const CACHE_NAME = 'kazarbuild-v10';
const DATA_CACHE_NAME = 'kazarbuild-data-v1';

const ASSETS = [
  '/techcards/',
  '/techcards/index.html',
  '/techcards/card.html',
  '/techcards/style.css',
  '/techcards/manifest.json',
  '/techcards/js/config.js',
  '/techcards/js/i18n.js',
  '/techcards/js/supabase.js',
  '/techcards/js/app.js',
  '/techcards/icons/icon-192.png',
  '/techcards/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v9...');
  
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

// Активация — удаляем старые кэши
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

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Запросы к Supabase API — Network First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Запросы к внешним ресурсам (изображения unsplash и т.д.) — Cache First
  if (!url.hostname.includes('github.io') && url.protocol === 'https:') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Локальные файлы — Cache First с обновлением
  event.respondWith(cacheFirstWithUpdate(request));
});

// Стратегия: Network First (для API)
async function networkFirstStrategy(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные GET запросы
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
    
    // Возвращаем пустой массив для API запросов
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Стратегия: Cache First (для внешних ресурсов)
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
    // Для изображений возвращаем placeholder
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#f0f0f0" width="400" height="300"/><text fill="#999" font-family="sans-serif" font-size="18" x="50%" y="50%" text-anchor="middle" dy=".3em">Изображение недоступно</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Стратегия: Cache First с фоновым обновлением (для локальных файлов)
async function cacheFirstWithUpdate(request) {
  const cache = await caches.open(CACHE_NAME);
  
  const cachedResponse = await cache.match(request);
  
  // Фоновое обновление
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  
  // Возвращаем кэш или ждём сеть
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetchPromise;
  
  if (networkResponse) {
    return networkResponse;
  }
  
  // Если HTML — возвращаем главную страницу
  if (request.headers.get('Accept')?.includes('text/html')) {
    const fallback = await cache.match('/techcards/index.html');
    if (fallback) return fallback;
  }
  
  return new Response('Offline', { status: 503 });
}