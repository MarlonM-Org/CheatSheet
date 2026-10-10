'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  aufloesen, STANDARD_DUNKEL, STANDARD_HELL, THEMA_CHROME,
  type Modus, type Thema,
} from '@/domain/thema';
import { gespeichert, speichern } from './ueben/klang';

// Farbwelt anwenden: data-thema am <html>, Browser-Chrome-Farbe mitziehen.
// Die Erstanwendung vor dem ersten Bild macht das Inline-Script im Layout —
// hier passiert alles Weitere (Systemwechsel, Einstellungsänderung).

const systemDunkel = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function themaAnwenden() {
  const thema = aufloesen(
    gespeichert<Modus>('ueben:modus', 'system'),
    gespeichert<Thema | null>('ueben:thema-hell', null),
    gespeichert<Thema | null>('ueben:thema-dunkel', null),
    systemDunkel(),
  );
  document.documentElement.dataset.thema = thema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMA_CHROME[thema]);
  return thema;
}

// Im Layout eingehängt: hält das Thema aktuell, wenn das System umschaltet
// oder ein zweites Fenster die Einstellung ändert.
export function ThemaWaechter() {
  useEffect(() => {
    themaAnwenden();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const auf = () => { themaAnwenden(); };
    mq.addEventListener('change', auf);
    window.addEventListener('storage', auf);
    return () => { mq.removeEventListener('change', auf); window.removeEventListener('storage', auf); };
  }, []);
  return null;
}

// Für den Einstellungsbereich: lesen, setzen, sofort anwenden.
export function useThema() {
  const [modus, setModusRoh] = useState<Modus>(() => gespeichert('ueben:modus', 'system'));
  const [hell, setHellRoh] = useState<Thema>(() => gespeichert('ueben:thema-hell', STANDARD_HELL));
  const [dunkel, setDunkelRoh] = useState<Thema>(() => gespeichert('ueben:thema-dunkel', STANDARD_DUNKEL));
  const sysDunkel = useSyncExternalStore(
    (melden) => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', melden);
      return () => mq.removeEventListener('change', melden);
    },
    systemDunkel,
    () => false,
  );

  const setModus = useCallback((m: Modus) => { setModusRoh(m); speichern('ueben:modus', m); themaAnwenden(); }, []);
  const setHell = useCallback((t: Thema) => { setHellRoh(t); speichern('ueben:thema-hell', t); themaAnwenden(); }, []);
  const setDunkel = useCallback((t: Thema) => { setDunkelRoh(t); speichern('ueben:thema-dunkel', t); themaAnwenden(); }, []);

  return { modus, setModus, hell, setHell, dunkel, setDunkel, aktiv: aufloesen(modus, hell, dunkel, sysDunkel) };
}
