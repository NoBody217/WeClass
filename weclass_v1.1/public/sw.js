self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // 简单的透传，不缓存，只为了满足 Chrome 的 PWA 安装条件
  e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
});
