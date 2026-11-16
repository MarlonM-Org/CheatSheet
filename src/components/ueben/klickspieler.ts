'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vortrag } from '@/domain/etueden';
import { vorspielen, type Vorspiel } from './klavier';
import { audioSitzung, klangPuffer, useBeimVerlassen } from './klang';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';

// Vorspielen mit Klick (Etüden I-14, Licks I-16): die notierten Klänge wie
// `useVorspieler` (Stimmung, Kammerton, Lautstärke), dazu der Klick des
// Metronoms (sein Klang) je Viertel samt Vorzählen — im selben AudioContext,
// damit beides genau zusammen läuft. Ein neuer Start stoppt den alten;
// Schließen und Verlassen der App stoppen alles.
export function useKlickSpieler() {
  const stimm = useStimmgeraetApi();
  const metro = useMetronom();
  const einst = useRef({ st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut, klang: metro.klang });
  useEffect(() => { einst.current = { st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut, klang: metro.klang }; },
    [stimm.stimmung, stimm.kammerton, metro.laut, metro.klang]);
  const laufend = useRef<Vorspiel | null>(null);
  const timer = useRef(0);
  const [laeuft, setLaeuft] = useState(false);

  const stopp = useCallback(() => {
    window.clearTimeout(timer.current);
    laufend.current?.stopp();
    laufend.current = null;
    setLaeuft(false);
  }, []);
  useEffect(() => stopp, [stopp]);
  useBeimVerlassen(stopp);

  const spielen = useCallback((v: Vortrag) => {
    stopp();
    if (!v.klaenge.length) return;
    audioSitzung('playback');
    const { st, a, laut, klang } = einst.current;
    const vs = vorspielen(v.klaenge, st, a, laut);
    if (v.klicks.length) {
      const ctx = vs.ctx;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0.05, laut) * 0.8;
      gain.connect(ctx.destination);
      const betont = klangPuffer(ctx, klang, 'betont'), normal = klangPuffer(ctx, klang, 'normal');
      for (const k of v.klicks) {
        const q = ctx.createBufferSource();
        q.buffer = k.betont ? betont : normal;
        q.connect(gain);
        q.start(vs.beginn + k.zeit);
      }
    }
    laufend.current = vs;
    setLaeuft(true);
    timer.current = window.setTimeout(() => { laufend.current = null; setLaeuft(false); }, (v.dauer + 0.6) * 1000);
  }, [stopp]);

  return { spielen, stopp, laeuft, stimmung: stimm.stimmung };
}
