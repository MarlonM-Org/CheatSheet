'use client';

import { useEffect, useState } from 'react';

// Meldet den Service Worker an (public/sw.js): Nach einem Besuch mit Netz läuft
// die App auch im Proberaum ohne Netz. In der Entwicklung nicht — dort würde
// der Cache alte Stände zeigen.
//
// Übernimmt eine neue Version die offene Seite, kommt ein leiser Hinweis zum
// Neuladen — nie automatisch, sonst wären halbe Eingaben oder ein laufendes
// Metronom mitten im Üben weg. Beim allerersten Besuch (vorher kein Service
// Worker) gibt es nichts Neues, also auch keinen Hinweis.
export function Offline() {
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    // Erster Wechsel ohne vorigen Service Worker = Erstinstallation, kein Hinweis.
    let bisher = !!sw.controller;
    const gewechselt = () => { if (bisher) setNeu(true); bisher = true; };
    sw.addEventListener('controllerchange', gewechselt);
    sw.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    return () => sw.removeEventListener('controllerchange', gewechselt);
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
