/* WY Pdf Box — service worker: แคชตัวแอปและไลบรารีเพื่อใช้งานออฟไลน์ */
const CACHE = 'wy-pdf-box-v9';
const SHARE_CACHE = 'wy-pdf-box-share';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SHARE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const reqUrl = new URL(e.request.url);

  /* รับไฟล์ที่แชร์มาจากแอปอื่น (Android Share Target) */
  if (e.request.method === 'POST' && reqUrl.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.getAll('file').find(f => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')));
        if (!file) return Response.redirect('./?shared=0', 303);
        const c = await caches.open(SHARE_CACHE);
        await c.put('shared-file', new Response(file, {
          headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name || 'shared.pdf') }
        }));
        return Response.redirect('./?shared=1', 303);
      } catch (err) {
        return Response.redirect('./?shared=0', 303);
      }
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const url = e.request.url;
        if (res.ok && (url.startsWith(self.location.origin) || url.includes('cdnjs.cloudflare.com') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
