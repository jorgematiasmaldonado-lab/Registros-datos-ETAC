/* =====================================================================
   ETAC · Registro de campo · Service worker (funcionamiento sin internet)
   © Maldonado Jorge Matias
   - La app se guarda en el teléfono / la computadora la primera vez que
     se abre con internet. Después abre aunque no haya señal.
   - Con internet, siempre trae la versión más nueva de index.html
     (si la señal es muy débil, a los 4 s usa la copia guardada).
   - Nunca guarda los datos de Supabase: eso lo maneja la app.
   ===================================================================== */
const VERSION = 'etac-campo-v1';
const PROPIOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];
const EXTERNOS = [];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(PROPIOS);
    await Promise.all(EXTERNOS.map((u) => fetch(new Request(u, { mode: 'no-cors' })).then((r) => c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k.startsWith('etac-campo') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function conTiempo(p, ms) { return new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error('lento')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); }); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname)) return;                    // datos en vivo: nunca desde la copia
  const propio = url.origin === self.location.origin;
  // Página principal: primero internet, si no hay (o tarda), la copia guardada
  if (req.mode === 'navigate' || (propio && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await conTiempo(fetch(req, { cache: 'no-store' }), 4000);
        if (r && r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  // Íconos, librerías y demás: la copia guardada y, si falta, internet
  if (propio || EXTERNOS.includes(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const g = await c.match(req.url);
      if (g) return g;
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req.url, r.clone());
      return r;
    })());
  }
});
