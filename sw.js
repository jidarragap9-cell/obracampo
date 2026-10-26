/* Service worker: guarda la app en caché para que abra sin internet y se actualice en segundo plano. */
const VERSION = 'obracampo-v4';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/db.js', 'js/ui.js', 'js/calc.js', 'js/bitacora.js', 'js/report.js', 'js/precios.js', 'js/presupuesto.js',
  'js/elementos.js', 'js/iso.js', 'js/plano.js', 'js/contencion.js', 'js/app.js', 'icons/icon.svg',
];
const OPCIONALES = ['icons/icon-192.png', 'icons/icon-512.png'];

// cache: 'reload' evita copiar archivos viejos de la caché HTTP (GitHub Pages la mantiene 10 minutos)
const fresco = url => new Request(url, { cache: 'reload' });

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ARCHIVOS.map(fresco)).then(() => Promise.allSettled(OPCIONALES.map(a => c.add(fresco(a))))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const enCache = await cache.match(e.request, { ignoreSearch: true });
    const clave = e.request.url.split(/[?#]/)[0];
    const red = fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) cache.put(clave, r.clone()); return r; })
      .catch(() => enCache);
    return enCache || red;
  }));
});
