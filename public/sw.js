// Offline-Betrieb von CheatSheet. Die Liste der Dateien schreibt
// scripts/precache.mjs nach dem Build nach /precache.json und setzt hier
// Version und Build-Kennung ein — dadurch ändert sich diese Datei mit jedem
// Build, und der Browser installiert den neuen Stand.
const VERSION = 'entwicklung';
// Dieselbe Kennung steckt in der Seite (process.env.__CHEATSHEET_BUILD_KENNUNG);
// nur wenn sie abweicht, zeigt die Seite „Neue Version da“. Sie steht auch in
// der Startseite und den Seitendaten (.txt) — daran prüft die Installation,
// dass sie wirklich diesen Stand im Cache hat.
const KENNUNG = 'entwicklung';
const PRAEFIX = 'ueben-';
const CACHE = PRAEFIX + VERSION;
// Kommt erst in den Cache, wenn der Stand vollständig ist; Inhalt ist der
// Zeitpunkt. Caches ohne Marker sind halbe Installationen.
const FERTIG = '/__fertig';
// So lange wartet ein Seitenaufruf aufs Netz, dann kommt der Stand aus dem Cache.
const ZEITLIMIT_SEITE = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Kein Netz oder Serverfehler: Installation scheitert, die alte Version
      // bleibt aktiv, der Browser versucht es später erneut.
      const liste = await fetch('/precache.json', { cache: 'no-store' });
      // Gibt es diesen Stand schon (Rückkehr zu einem früheren Deploy), darf ein
      // Fehlschlag seinen Cache nicht zerstören — eine offene Seite braucht ihn
      // womöglich noch.
      const schonDa = await caches.has(CACHE);
      const cache = await caches.open(CACHE);
      try {
        if (liste.status === 404 && VERSION === 'entwicklung') {
          // Ohne Liste (Entwicklung) nur die Startseite vorhalten, Rest beim Abruf.
          await cache.add(new Request('/', { cache: 'reload' })).catch(() => {});
        } else {
          if (!liste.ok) throw new Error(`precache.json: ${liste.status}`);
          const { version, dateien } = await liste.json();
          // Zwischen sw.js und precache.json kam ein neuer Deploy: Die Liste
          // gehört zu einem anderen Stand. Der Browser versucht es später erneut.
          if (version !== VERSION) throw new Error(`precache.json gehört zu ${version}, nicht zu ${VERSION}`);
          // Alles oder nichts: Fehlt eine Datei, wäre der neue Stand offline kaputt.
          await Promise.all(dateien.map((pfad) => cache.add(new Request(pfad, { cache: 'reload' }))));
          // Startseite und Seitendaten müssen zu diesem Stand gehören. Kam von
          // einem Zwischenspeicher unterwegs noch der alte (oder schon ein
          // neuerer) Stand, wäre die App offline gemischt: Installation scheitert.
          await kennungPruefen(cache, dateien.filter((pfad) => pfad === '/' || pfad.endsWith('.txt')));
        }
        await cache.put(FERTIG, new Response(String(Date.now())));
        // Hat ein gleichzeitiges Aufräumen den Cache gelöscht, ist nichts davon da.
        if (!(await caches.has(CACHE))) throw new Error('Cache während der Installation gelöscht');
      } catch (fehler) {
        if (!schonDa) await caches.delete(CACHE);
        throw fehler;
      }
      await self.skipWaiting();
    })(),
  );
});

async function kennungPruefen(cache, pfade) {
  if (!pfade.includes('/')) throw new Error('precache.json ohne Startseite');
  for (const pfad of pfade) {
    const antwort = await cache.match(pfad);
    const text = antwort ? await antwort.text() : '';
    if (!text.includes(KENNUNG)) throw new Error(`${pfad} gehört nicht zum Stand ${KENNUNG}`);
  }
}

// Behält den aktuellen und den jüngsten anderen vollständigen Stand: Eine noch
// offene alte Seite findet so weiter ihre Code-Stücke. Halbe Installationen
// (ohne Marker) und ältere Stände fliegen raus.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const fertige = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith(PRAEFIX) || name === CACHE) continue;
        const marker = await (await caches.open(name)).match(FERTIG);
        if (!marker) { await caches.delete(name); continue; }
        fertige.push({ name, zeit: Number(await marker.text()) || 0 });
      }
      fertige.sort((a, b) => b.zeit - a.zeit);
      for (const { name } of fertige.slice(1)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

// Die Seite fragt nach der Kennung (src/components/Offline.tsx).
self.addEventListener('message', (event) => {
  if (event.data && event.data.frage === 'version' && event.ports[0]) {
    event.ports[0].postMessage({ kennung: KENNUNG });
  }
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || anfrage.headers.has('range')) return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return; // Fremde Herkunft: nie cachen
  if (url.pathname === '/sw.js' || url.pathname === '/precache.json' || url.pathname === FERTIG) return;

  // Seiten (und Next-Seitendaten) zuerst aus dem Netz, damit online der
  // neueste Stand kommt; bei langsamem oder fehlendem Netz aus dem Cache.
  const seite = anfrage.mode === 'navigate' || anfrage.headers.has('rsc') || url.pathname.endsWith('.txt');
  event.respondWith(seite ? netzZuerst(anfrage, url) : cacheZuerst(anfrage));
});

// Erst im eigenen Cache suchen (Stand dieses Service Workers), dann in allen übrigen.
async function ausCache(anfrage, optionen) {
  const eigener = await (await caches.open(CACHE)).match(anfrage, optionen);
  return eigener || caches.match(anfrage, optionen);
}

// Seiten und Seitendaten kommen nie zur Laufzeit in den Cache, nur aus dem
// Vorab-Cache ihres eigenen Stands — sonst läge HTML eines neuen Deploys im
// Cache des alten, ohne die Code-Stücke, die es braucht.
function netzZuerst(anfrage, url) {
  const schluessel = url.origin + url.pathname;
  const netz = fetch(anfrage);
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

// Gehashte Dateien unter /_next/static/ und übrige statische Dateien. Was
// fehlt, kommt in den eigenen Cache — aber nur, wenn es ihn gibt: Ein dabei
// neu angelegter Cache hätte keinen Marker und fiele beim Aufräumen weg.
async function cacheZuerst(anfrage) {
  const treffer = await ausCache(anfrage);
  if (treffer) return treffer;
  const antwort = await fetch(anfrage);
  if (antwort.ok && antwort.type === 'basic' && (await caches.has(CACHE))) {
    const cache = await caches.open(CACHE);
    await cache.put(anfrage, antwort.clone());
  }
  return antwort;
}
