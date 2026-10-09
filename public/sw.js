// Offline-Betrieb der Übe-App. Die Liste der Dateien schreibt
// scripts/precache.mjs nach dem Build nach /precache.json und setzt hier die
// Version ein — dadurch ändert sich diese Datei mit jedem Build, und der
// Browser installiert den neuen Stand.
const VERSION = 'entwicklung';
const PRAEFIX = 'ueben-';
const CACHE = PRAEFIX + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      let dateien = ['/'];
      try {
        const antwort = await fetch('/precache.json', { cache: 'no-store' });
        if (antwort.ok) dateien = (await antwort.json()).dateien;
      } catch {
        // Ohne Liste (z. B. Entwicklung) nur die Startseite vorhalten.
      }
      // Einzeln laden: Eine fehlende Datei soll die Installation nicht kippen;
      // sie wird dann beim ersten Abruf nachgeladen.
      await Promise.all(
        dateien.map((pfad) =>
          cache.add(new Request(pfad, { cache: 'reload' })).catch(() => {}),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PRAEFIX) && name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || anfrage.headers.has('range')) return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return; // Fremde Herkunft: nie cachen
  if (url.pathname === '/sw.js' || url.pathname === '/precache.json') return;

  // Seiten (und Next-Seitendaten) zuerst aus dem Netz, damit online immer der
  // neueste Stand kommt; ohne Netz aus dem Cache.
  const seite = anfrage.mode === 'navigate' || anfrage.headers.has('rsc') || url.pathname.endsWith('.txt');
  event.respondWith(seite ? netzZuerst(anfrage) : cacheZuerst(anfrage));
});

async function netzZuerst(anfrage) {
  const cache = await caches.open(CACHE);
  try {
    const antwort = await fetch(anfrage);
    if (antwort.ok && antwort.type === 'basic') await cache.put(anfrage, antwort.clone());
    return antwort;
  } catch (fehler) {
    const treffer = (await cache.match(anfrage, { ignoreSearch: true }))
      || (anfrage.mode === 'navigate' ? await cache.match('/') : undefined);
    if (treffer) return treffer;
    throw fehler;
  }
}

// Gehashte Dateien unter /_next/static/ und übrige statische Dateien.
async function cacheZuerst(anfrage) {
  const treffer = await caches.match(anfrage);
  if (treffer) return treffer;
  const antwort = await fetch(anfrage);
  if (antwort.ok && antwort.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(anfrage, antwort.clone());
  }
  return antwort;
}
