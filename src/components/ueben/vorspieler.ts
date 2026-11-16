'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Klang } from '@/domain/notensatz';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';

// Vorspielen notierter Klänge mit Stimmung, Kammerton und Lautstärke wie im
// Stimmgerät/Metronom; ein neuer Klang stoppt den alten, Schließen stoppt alles.
export function useVorspieler() {
  const stimm = useStimmgeraetApi();
  const metro = useMetronom();
  const klang = useRef({ st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut });
  useEffect(() => { klang.current = { st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut }; }, [stimm.stimmung, stimm.kammerton, metro.laut]);
  const laufend = useRef<Vorspiel | null>(null);
  const stopp = useCallback(() => { laufend.current?.stopp(); laufend.current = null; }, []);
  useEffect(() => stopp, [stopp]);
  const spielen = useCallback((k: readonly Klang[]) => {
    stopp();
    if (k.length) laufend.current = vorspielen(k, klang.current.st, klang.current.a, klang.current.laut);
  }, [stopp]);
  return { spielen, stopp, stimmung: stimm.stimmung };
}
