// Offline-Betrieb von CheatSheet. Die Liste der Dateien schreibt
// scripts/precache.mjs nach dem Build nach /precache.json und setzt hier die
// Version ein — dadurch ändert sich diese Datei mit jedem Build, und der
// Browser installiert den neuen Stand.
const VERSION = 'entwicklung';
const PRAEFIX = 'ueben-';
const CACHE = PRAEFIX + VERSION;
// So lange wartet ein Seitenaufruf aufs Netz, dann kommt der Stand aus dem Cache.
const ZEITLIMIT_SEITE = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Kein Netz oder Serverfehler: Installation scheitert, die alte Version
      // bleibt aktiv, der Browser versucht es später erneut.
      const liste = await fetch('/precache.json', { cache: 'no-store' });
      const cache = await caches.open(CACHE);
      if (liste.status === 404) {
        // Ohne Liste (Entwicklung) nur die Startseite vorhalten, Rest beim Abruf.
        await cache.add(new Request('/', { cache: 'reload' })).catch(() => {});
      } else {
        if (!liste.ok) throw new Error(`precache.json: ${liste.status}`);
        const { dateien } = await liste.json();
        try {
          // Alles oder nichts: Fehlt eine Datei, wäre der neue Stand offline kaputt.
          await Promise.all(dateien.map((pfad) => cache.add(new Request(pfad, { cache: 'reload' }))));
        } catch (fehler) {
          await caches.delete(CACHE);
          throw fehler;
        }
      }
      await self.skipWaiting();
    })(),
  );
});

// Behält den aktuellen und den direkt vorigen Stand: Eine noch offene alte
// Seite findet so weiter ihre Code-Stücke. Ältere Stände fliegen raus.
// caches.keys() liefert in der Reihenfolge des Anlegens.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const andere = (await caches.keys()).filter((n) => n.startsWith(PRAEFIX) && n !== CACHE);
      for (const name of andere.slice(0, -1)) await caches.delete(name);
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

  // Seiten (und Next-Seitendaten) zuerst aus dem Netz, damit online der
  // neueste Stand kommt; bei langsamem oder fehlendem Netz aus dem Cache.
  const seite = anfrage.mode === 'navigate' || anfrage.headers.has('rsc') || url.pathname.endsWith('.txt');
  event.respondWith(seite ? netzZuerst(event, url) : cacheZuerst(anfrage));
});

// Erst im eigenen Cache suchen (neuester Stand), dann in allen übrigen.
async function ausCache(anfrage, optionen) {
  const eigener = await (await caches.open(CACHE)).match(anfrage, optionen);
  return eigener || caches.match(anfrage, optionen);
}

function netzZuerst(event, url) {
  const anfrage = event.request;
  const schluessel = url.origin + url.pathname;
  const netz = fetch(anfrage);
  // Kopie sofort ziehen (vor jedem Lesen) und im Hintergrund ablegen — auch
  // wenn die Antwort zu spät kommt und diesmal der Cache geantwortet hat.
  const kopie = netz.then((a) => (a.ok && a.type === 'basic' && !a.redirected ? a.clone() : null));
  event.waitUntil(
    kopie
      .then(async (k) => { if (k) await (await caches.open(CACHE)).put(schluessel, k); })
      .catch(() => {}),
  );

  return (async () => {
    try {
      return await new Promise((ok, fehler) => {
        const uhr = setTimeout(() => fehler(new Error('Zeitlimit')), ZEITLIMIT_SEITE);
        netz.then((a) => { clearTimeout(uhr); ok(a); }, (e) => { clearTimeout(uhr); fehler(e); });
      });
    } catch {
      const treffer = (await ausCache(schluessel, { ignoreSearch: true }))
        || (anfrage.mode === 'navigate' ? await ausCache('/') : undefined);
      // Nichts im Cache: doch aufs Netz warten (oder dessen Fehler melden).
      return treffer || netz;
    }
  })();
}

// Gehashte Dateien unter /_next/static/ und übrige statische Dateien.
async function cacheZuerst(anfrage) {
  const treffer = await ausCache(anfrage);
  if (treffer) return treffer;
  const antwort = await fetch(anfrage);
  if (antwort.ok && antwort.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(anfrage, antwort.clone());
  }
  return antwort;
}
