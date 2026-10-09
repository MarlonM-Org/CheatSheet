'use client';

import { useEffect, useState } from 'react';

// So oft schaut die App bei Rückkehr nach einer neuen Version.
const PRUEFABSTAND = 6 * 60 * 60 * 1000;

// Fragt den steuernden Service Worker nach seiner Build-Kennung. Keine Antwort
// (kein Controller, ältere sw.js ohne Kennung): null.
function kennungFragen(sw: ServiceWorkerContainer): Promise<string | null> {
  const ziel = sw.controller;
  if (!ziel) return Promise.resolve(null);
  return new Promise((ok) => {
    const kanal = new MessageChannel();
    const uhr = window.setTimeout(() => ok(null), 3000);
    kanal.port1.onmessage = (e: MessageEvent<{ kennung?: unknown }>) => {
      window.clearTimeout(uhr);
      ok(typeof e.data?.kennung === 'string' ? e.data.kennung : null);
    };
    ziel.postMessage({ frage: 'version' }, [kanal.port2]);
  });
}

// Meldet den Service Worker an (public/sw.js): Nach einem Besuch mit Netz läuft
// die App auch im Proberaum ohne Netz. In der Entwicklung nicht — dort würde
// der Cache alte Stände zeigen.
//
// Läuft ein anderer Stand als der der offenen Seite, kommt ein leiser Hinweis
// zum Neuladen — nie automatisch, sonst wären halbe Eingaben oder ein
// laufendes Metronom mitten im Üben weg. Maßstab ist die Build-Kennung, die
// Seite und Service Worker beide kennen: Hat die Seite schon den neuen Stand
// (frisch aus dem Netz geladen), gibt es keinen Hinweis.
export function Offline() {
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    const eigene = process.env.BUILD_KENNUNG;
    let aus = false;
    let registrierung: ServiceWorkerRegistration | null = null;
    let zuletzt = Date.now();

    // Nach einem Wechsel des Service Workers: Weicht seine Kennung ab, ist die
    // Seite veraltet.
    const gewechselt = async () => {
      const k = await kennungFragen(sw);
      if (!aus && k) setNeu(k !== eigene);
    };

    // Beim Start ist eine Abweichung zweideutig: Die Seite kann neuer sein als
    // der Service Worker (frisch aus dem Netz, Update unterwegs) oder älter.
    // Erst nach einer Update-Prüfung ist klar, ob der laufende Service Worker
    // der neueste ist — dann ist die Seite veraltet. Kommt ein neuer, meldet
    // sich der Wechsel von selbst.
    const beimStart = async (r: ServiceWorkerRegistration) => {
      if (!sw.controller || (await kennungFragen(sw)) === eigene) return;
      try { await r.update(); } catch { return; } // offline: lieber kein Hinweis als ein falscher
      if (r.installing || r.waiting) return;
      zuletzt = Date.now();
      const k = await kennungFragen(sw);
      if (!aus && k && k !== eigene) setNeu(true);
    };

    // Bei Rückkehr in die App (Home-Bildschirm bleibt oft tagelang offen)
    // höchstens alle sechs Stunden nach einer neuen Version schauen.
    const sichtbar = () => {
      if (document.visibilityState !== 'visible' || !registrierung || Date.now() - zuletzt < PRUEFABSTAND) return;
      zuletzt = Date.now();
      registrierung.update().catch(() => {});
    };

    sw.addEventListener('controllerchange', gewechselt);
    document.addEventListener('visibilitychange', sichtbar);
    sw.register('/sw.js', { updateViaCache: 'none' })
      .then((r) => { registrierung = r; return beimStart(r); })
      .catch(() => {});
    return () => {
      aus = true;
      sw.removeEventListener('controllerchange', gewechselt);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, []);

  if (!neu) return null;
  return (
    <div className="neue-version" role="status">
      <span>Neue Version da —</span>
      <button type="button" className="knopf knopf-klein" onClick={() => location.reload()}>neu laden</button>
      <button type="button" className="neue-version-weg" aria-label="Hinweis schließen" onClick={() => setNeu(false)}>×</button>
    </div>
  );
}
