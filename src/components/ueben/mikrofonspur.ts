// Die Tonhöhenspur vom Mikrofon: Klick (Einzähler, Vorlauf, auf Wunsch
// weiter), auf Wunsch die Takte davor aus dem Stück vorgespielt — alles in
// einem AudioContext, damit Klick, Vorspiel und Spur dieselbe Uhr haben —
// und je 20 ms ein Rahmen (Tonhöhe wie beim Stimmgerät, Pegel, Mittenband).
// Genutzt vom Einsing-Dialog (ganzes Stück) und von der Aufnahmeleiste (ab
// einem Takt). Die Aufnahme selbst wird nicht behalten.
//
// Lautsprecher: mit „verarbeitet“ läuft die Sprachverarbeitung des Browsers
// (Verstärkung, Echo-Unterdrückung; iPhone: Freisprechen) — der Klick kommt
// aus dem Lautsprecher und bleibt aus der Spur draußen. Ohne: das rohe
// Mikrofon, nah am Mund.

import { useCallback, useEffect, useRef, useState } from 'react';
import { bandpegel, effektivwert, taktDauer, type Raster, type Tonrahmen } from '@/domain/notation';
import type { Klang } from '@/domain/notensatz';
import { schlaegeJeTakt } from '@/domain/takt';
import { frequenzZuTon, grundfrequenz, type Stimmung } from '@/domain/ueben';
import { audioSitzung, klangPuffer, mikrofonOffen, mikrofonWunsch, useBeimVerlassen, wachHalten, type Klang as MetronomKlang } from './klang';
import { klavierTon, klingend } from './klavier';

// Pegel, ab dem ein Fenster als Ton gilt (−50 dBFS): das rohe Mikrofon ohne
// Verstärkung liefert aus einem Meter Abstand deutlich weniger als das
// Stimmgerät am Instrument gewohnt ist.
const MINDEST_PEGEL = 0.003;
const KLAR = 0.85;

export type SpurPhase = 'ruhe' | 'zaehlt' | 'nimmt';
// Live-Anzeige (sparsam aktualisiert): `zaehlt` Schläge bis zum Einsatz,
// `vor` Takte Vorlauf, die noch kommen; ab dem Einsatz Takt/Schlag und Ton.
export interface SpurAnzeige { zaehlt?: number; vor?: number; takt?: number; schlag?: number; ton?: string }

export interface SpurStart {
  raster: Raster;
  lautsprecher: boolean;
  klickWeiter: boolean;
  metro: { klang: MetronomKlang; laut: number };
  stimmung: Stimmung; kammerton: number;
  // Takte nur mit Klick vor dem Einsatz (Einzähler).
  einzaehlTakte: number;
  // Vorgespielte Takte vor dem Einsatz (Klick läuft mit): Klänge mit
  // `beginn` relativ zum Einsatz (negativ), dazu die Zahl der Takte.
  vorlauf?: { klaenge: readonly Klang[]; takte: number } | null;
  // Längste Aufnahme in Takten — danach hält die Spur von selbst an.
  maxTakte: number;
  // Phasenwechsel (Einzähler/Vorlauf läuft; Aufnahme läuft) — aus dem Ablauf heraus, kein Effekt nötig.
  beiPhase?: (phase: 'zaehlt' | 'nimmt') => void;
  beiFortschritt?: (rahmen: readonly Tonrahmen[], rel: number) => void;
  // Am Ende: die Rahmen (Zeit ab dem Einsatz), `behalten` false bei Abbruch im Einzähler.
  beiEnde?: (rahmen: Tonrahmen[], behalten: boolean) => void;
  beiFehler?: (text: string) => void;
}

interface Mikro {
  stream: MediaStream; ctx: AudioContext; raf: number; quellen: AudioBufferSourceNode[]; t0: number;
  freigeben: (() => void) | null; abmelden: () => void; beiEnde?: SpurStart['beiEnde'];
}

export function useMikrofonSpur() {
  const [phase, setPhase] = useState<SpurPhase>('ruhe');
  const [anzeige, setAnzeige] = useState<SpurAnzeige>({});
  const mikro = useRef<Mikro | null>(null);
  const rahmen = useRef<Tonrahmen[]>([]);

  const stoppen = useCallback((behalten: boolean) => {
    const m = mikro.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    for (const q of m.quellen) { try { q.stop(); } catch { /* schon vorbei */ } }
    m.stream.getTracks().forEach((t) => t.stop());
    void m.ctx.close();
    m.freigeben?.();
    m.abmelden();
    mikro.current = null;
    setPhase('ruhe');
    setAnzeige({});
    m.beiEnde?.([...rahmen.current], behalten);
  }, []);

  const starten = useCallback(async (o: SpurStart) => {
    if (mikro.current) return;
    try {
      audioSitzung('play-and-record');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: mikrofonWunsch(o.lautsprecher) });
      const abmelden = mikrofonOffen();
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const puffer = new Float32Array(analyser.fftSize);
      const r = o.raster;
      const schlag = 60 / r.bpm, jeTakt = schlaegeJeTakt(r.zaehler, r.nenner), td = taktDauer(r);
      const vorlaufTakte = o.vorlauf?.takte ?? 0;
      const vorTakte = o.einzaehlTakte + vorlaufTakte;
      const beginn = ctx.currentTime + 0.15;
      const t0 = beginn + vorTakte * td;
      const maxDauer = o.maxTakte * td;
      // Klicks: Einzähler und Vorlauf, danach auf Wunsch weiter.
      const gain = ctx.createGain();
      gain.gain.value = o.metro.laut;
      gain.connect(ctx.destination);
      const betont = klangPuffer(ctx, o.metro.klang, 'betont'), normal = klangPuffer(ctx, o.metro.klang, 'normal');
      const quellen: AudioBufferSourceNode[] = [];
      const klick = (t: number, stark: boolean) => { const q = ctx.createBufferSource(); q.buffer = stark ? betont : normal; q.connect(gain); q.start(t); quellen.push(q); };
      for (let i = 0; i < vorTakte * jeTakt; i++) klick(beginn + i * schlag, i % jeTakt === 0);
      if (o.klickWeiter) for (let n = 0; n < jeTakt * o.maxTakte; n++) klick(t0 + n * schlag, n % jeTakt === 0);
      // Vorlauf: die Takte davor aus dem Stück, im selben Kontext wie der Klick.
      if (o.vorlauf?.klaenge.length) {
        const klavier = ctx.createGain();
        klavier.gain.value = Math.max(0.05, o.metro.laut);
        klavier.connect(ctx.destination);
        for (const k of o.vorlauf.klaenge) {
          const start = t0 + k.beginn;
          if (start >= beginn - 1e-3 && k.dauer > 0.01) klavierTon(ctx, klavier, klingend(k.midi, o.stimmung, o.kammerton), Math.max(beginn, start), k.dauer);
        }
      }
      rahmen.current = [];
      // Der Analyser liefert die letzten 4096 Abtastwerte: Mitte des Fensters
      // plus Eingangslatenz zurückrechnen.
      const versatz = analyser.fftSize / 2 / ctx.sampleRate + (ctx.baseLatency || 0);
      let zuletzt = 0, letzteAnzeige = 0, nimmt = false, ton: ReturnType<typeof frequenzZuTon> = null;
      const schleife = () => {
        const m = mikro.current;
        if (!m) return;
        const jetzt = ctx.currentTime;
        if (jetzt - zuletzt >= 0.02) {
          zuletzt = jetzt;
          analyser.getFloatTimeDomainData(puffer);
          const g = grundfrequenz(puffer, ctx.sampleRate, undefined, MINDEST_PEGEL);
          ton = g && g.klarheit > KLAR ? frequenzZuTon(g.frequenz, o.kammerton, o.stimmung) : null;
          const zeit = jetzt - versatz - t0;
          if (zeit >= -0.05) rahmen.current.push({ zeit, midi: ton ? ton.midi + ton.cent / 100 : null, pegel: effektivwert(puffer), mitte: bandpegel(puffer.subarray(puffer.length - 1024), ctx.sampleRate) });
        }
        const rel = jetzt - t0;
        if (jetzt - letzteAnzeige > 0.08) {
          letzteAnzeige = jetzt;
          if (rel < 0) {
            const vor = Math.ceil(-rel / td);
            setAnzeige({ zaehlt: Math.max(1, jeTakt - Math.floor(((-rel) % td) / schlag)), vor: vor <= vorlaufTakte ? vor : undefined });
          } else {
            if (!nimmt) { nimmt = true; setPhase('nimmt'); o.beiPhase?.('nimmt'); }
            setAnzeige({ takt: Math.floor(rel / td) + 1, schlag: Math.floor((rel % td) / schlag) + 1, ton: ton ? `${ton.name}${ton.oktave}` : '' });
          }
          o.beiFortschritt?.(rahmen.current, rel);
        }
        if (rel > maxDauer) { stoppen(true); return; }
        m.raf = requestAnimationFrame(schleife);
      };
      mikro.current = { stream, ctx, raf: requestAnimationFrame(schleife), quellen, t0, freigeben: null, abmelden, beiEnde: o.beiEnde };
      setPhase('zaehlt');
      o.beiPhase?.('zaehlt');
      setAnzeige({ zaehlt: jeTakt, vor: vorlaufTakte || undefined });
      const freigeben = await wachHalten();
      if (mikro.current) mikro.current.freigeben = freigeben; else freigeben?.();
    } catch (e) {
      o.beiFehler?.((e as Error).name === 'NotAllowedError'
        ? 'Das Mikrofon ist nicht erlaubt. In den Einstellungen des Browsers für diese Seite erlauben.'
        : `Mikrofon nicht verfügbar (${(e as Error).name}).`);
    }
  }, [stoppen]);

  // App-Wechsel (andere App, Sperre): anhalten, die Spur bleibt.
  useBeimVerlassen(useCallback(() => { if (mikro.current) stoppen(phase === 'nimmt'); }, [stoppen, phase]));
  useEffect(() => () => stoppen(false), [stoppen]);

  return { phase, anzeige, starten, stoppen, rahmen, aktiv: phase !== 'ruhe' };
}
