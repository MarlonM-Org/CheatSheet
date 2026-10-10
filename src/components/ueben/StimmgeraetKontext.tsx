'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { frequenzZuTon, grundfrequenz, median, STIMMUNGEN, tonFrequenz, type Stimmung, type Ton } from '@/domain/ueben';
import { audioSitzung, gespeichert, speichern, wachHalten } from './klang';

// Ein Stimmgerät für die ganze App: große Ansicht und schwebendes Widget
// teilen sich Mikrofon, Messung und Einstellungen — wie beim Metronom.

interface StimmWert {
  an: boolean; start: () => Promise<void>; stopp: () => void; fehler: string;
  ton: Ton | null; frisch: boolean;
  kammerton: number; setKammerton: (n: number) => void;
  stimmung: Stimmung; setStimmung: (s: Stimmung) => void;
  refTon: number | null; refOktave: number; refOktaveWechseln: (o: number) => void;
  referenzSpielen: (halbton: number) => void; referenzAus: () => void;
}

const Kontext = createContext<StimmWert | null>(null);
export function useStimmgeraet(): StimmWert {
  const w = useContext(Kontext);
  if (!w) throw new Error('useStimmgeraet außerhalb von StimmgeraetAnbieter');
  return w;
}

export function StimmgeraetAnbieter({ children }: { children: React.ReactNode }) {
  const [an, setAn] = useState(false);
  const [fehler, setFehler] = useState('');
  const [ton, setTon] = useState<Ton | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [kammerton, setKammertonRoh] = useState(() => gespeichert('stimm:a', 442));
  const [stimmung, setStimmungRoh] = useState<Stimmung>(() => gespeichert('stimm:st', 'C'));
  const [refTon, setRefTon] = useState<number | null>(null);
  const [refOktave, setRefOktave] = useState(4);
  const einst = useRef({ kammerton, stimmung });
  useEffect(() => { einst.current = { kammerton, stimmung }; speichern('stimm:a', kammerton); speichern('stimm:st', stimmung); }, [kammerton, stimmung]);

  const mikro = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number; freigeben: (() => void) | null } | null>(null);
  const referenz = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  const referenzAus = useCallback(() => {
    const r = referenz.current;
    if (r) r.gain.gain.setTargetAtTime(0, r.ctx.currentTime, 0.06);
    setRefTon(null);
  }, []);

  const stopp = useCallback(() => {
    const m = mikro.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    void m.ctx.close();
    m.freigeben?.();
    mikro.current = null;
    setAn(false); setTon(null); setFrisch(false);
  }, []);

  const start = useCallback(async () => {
    if (mikro.current) return;
    setFehler('');
    referenzAus();
    try {
      audioSitzung('play-and-record');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const puffer = new Float32Array(analyser.fftSize);
      const verlauf: number[] = [];
      let zuletzt = 0, zuletztGehoert = 0;
      const schleife = (t: number) => {
        if (t - zuletzt > 50) {
          zuletzt = t;
          analyser.getFloatTimeDomainData(puffer);
          const r = grundfrequenz(puffer, ctx.sampleRate);
          if (r && r.klarheit > 0.85) {
            // Sprünge (neuer Ton) setzen die Glättung zurück
            if (verlauf.length && Math.abs(12 * Math.log2(r.frequenz / median(verlauf))) > 0.6) verlauf.length = 0;
            verlauf.push(r.frequenz);
            if (verlauf.length > 7) verlauf.shift();
            setTon(frequenzZuTon(median(verlauf), einst.current.kammerton, einst.current.stimmung));
            setFrisch(true);
            zuletztGehoert = t;
          } else if (t - zuletztGehoert > 450) {
            setFrisch(false); // letzten Ton gedimmt stehen lassen
            verlauf.length = 0;
          }
        }
        mikro.current!.raf = requestAnimationFrame(schleife);
      };
      mikro.current = { stream, ctx, raf: requestAnimationFrame(schleife), freigeben: null };
      setAn(true);
      mikro.current.freigeben = await wachHalten();
    } catch (e) {
      setFehler((e as Error).name === 'NotAllowedError'
        ? 'Das Mikrofon ist nicht erlaubt. In den Einstellungen des Browsers für diese Seite erlauben.'
        : `Mikrofon nicht verfügbar (${(e as Error).name}).`);
    }
  }, [referenzAus]);

  // Referenzton: weicher, orgelartiger Klang mit sanftem Ein- und Ausblenden.
  const referenzSpielen = useCallback((halbton: number) => {
    if (refTon === halbton) return referenzAus();
    stopp();
    audioSitzung('playback');
    const notiertMidi = (refOktave + 1) * 12 + halbton;
    const frequenz = tonFrequenz(notiertMidi - STIMMUNGEN[einst.current.stimmung], einst.current.kammerton);
    let r = referenz.current;
    if (!r) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.35, 0.12, 0.05])));
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      r = referenz.current = { ctx, osc, gain };
    }
    void r.ctx.resume();
    const jetzt = r.ctx.currentTime;
    r.osc.frequency.setTargetAtTime(frequenz, jetzt, 0.01);
    r.gain.gain.cancelScheduledValues(jetzt);
    r.gain.gain.setTargetAtTime(0.25, jetzt, 0.05);
    setRefTon(halbton);
  }, [refTon, refOktave, referenzAus, stopp]);

  const refOktaveWechseln = useCallback((o: number) => { setRefOktave(o); referenzAus(); }, [referenzAus]);
  const setKammerton = useCallback((n: number) => setKammertonRoh(Math.max(430, Math.min(450, n))), []);
  const setStimmung = useCallback((s: Stimmung) => setStimmungRoh(s), []);

  useEffect(() => () => {
    const m = mikro.current;
    if (m) { cancelAnimationFrame(m.raf); m.stream.getTracks().forEach((t) => t.stop()); void m.ctx.close(); m.freigeben?.(); }
    void referenz.current?.ctx.close();
  }, []);

  return (
    <Kontext.Provider value={{
      an, start, stopp, fehler, ton, frisch,
      kammerton, setKammerton, stimmung, setStimmung,
      refTon, refOktave, refOktaveWechseln, referenzSpielen, referenzAus,
    }}>
      {children}
    </Kontext.Provider>
  );
}
