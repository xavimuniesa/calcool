/* Calcool — service worker
   · index.html: primer la xarxa (versió nova a l'instant), si no n'hi ha, la còpia desada
   · resta de fitxers (lletres, icones): primer la còpia desada, actualització discreta
   · canvis de moneda: sempre per xarxa (l'app gestiona la manca de connexió) */
const V = 'calcool-v6';
const CORE = ['./', './index.html', './manifest.json',
  './fonts/italiana.woff2', './fonts/michroma.woff2', './fonts/bodoni-moda.woff2',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V)
    .then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(r, ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isPage) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const r = await timeout(fetch(req, {cache: 'no-cache'}), 4000);
        if (r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./index.html')) || new Response('Sense connexió', {status: 503});
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req, {ignoreSearch: true});
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('', {status: 504});
  })());
});
