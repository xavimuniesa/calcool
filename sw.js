/* Calcool — service worker: funciona sense connexió */
const V = 'calcool-v2';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Italiana&family=Michroma&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(CORE);
    try {
      const r = await fetch(FONT_CSS, {mode: 'cors'});
      if (r.ok) {
        const css = await r.clone().text();
        await c.put(FONT_CSS, r);
        const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(urls.map(u => fetch(u, {mode: 'cors'}).then(f => f.ok && c.put(u, f)).catch(() => {})));
      }
    } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Canvis de moneda: sempre per xarxa (l'app gestiona la manca de connexió)
  if (url.hostname.includes('frankfurter')) return;

  // Tipografies de Google: primer la memòria cau
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const hit = await caches.match(req, {ignoreVary: true});
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') (await caches.open(V)).put(req, r.clone());
        return r;
      } catch (err) { return new Response('', {status: 504}); }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // Fitxers propis: resposta immediata des de la memòria cau i actualització discreta
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req, {ignoreSearch: true}) ||
                (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Sense connexió', {status: 503});
  })());
});
