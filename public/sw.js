/**
 * clinconvert Service Worker
 *
 * 策略：
 *   - app shell (HTML / CSS / JS) → cache-first（離線可用）
 *   - sample data → cache-first
 *   - 其他 → network-first（讓使用者隨時拿到最新版）
 *
 * 因為 clinconvert 是純前端工具（無後端 API），cache shell 後可完全離線使用 ──
 * 對偏遠 / 斷網診所場景特別重要。
 */

const CACHE_NAME = 'clinconvert-shell-v1';
const APP_SHELL = [
  '/',
  '/en/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  // build assets 是動態 hash 路徑，靠 fetch 時 cache
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // 部分資源缺也不要 fail install
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 只處理同源
  if (url.origin !== self.location.origin) return;

  // Astro build assets（_astro/...）跟 sample data：cache-first + 背景更新
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/sample-data/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML：network-first，failover 到 cache
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/')))
    );
    return;
  }
});
