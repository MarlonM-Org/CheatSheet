'use client';

import { useEffect, useRef } from 'react';

// Escape schließt das oberste Overlay. `aktiv` gatet den Listener, damit
// übereinanderliegende Overlays nicht gleichzeitig reagieren.
export function useEscape(schliessen: () => void, aktiv = true) {
  useEffect(() => {
    if (!aktiv) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      schliessen();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [schliessen, aktiv]);
}

// Dialog-Fokus: beim Öffnen auf den Dialog, beim Schließen zurück.
// (Keine volle Fokusfalle — bewusst leichtgewichtig, Tab bleibt frei.)
export function useDialogFokus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => { vorher?.focus?.(); };
  }, []);
  return ref;
}
