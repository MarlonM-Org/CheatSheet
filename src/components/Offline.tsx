'use client';

import { useEffect } from 'react';

// Meldet den Service Worker an (public/sw.js): Nach einem Besuch mit Netz läuft
// die App auch im Proberaum ohne Netz. In der Entwicklung nicht — dort würde
// der Cache alte Stände zeigen.
export function Offline() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
