'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { einzaehlKlicks, type BegleitKlick, type BegleitTon } from '@/domain/begleitung';
import type { Stimmung } from '@/domain/ueben';
import { klangPuffer, useBeimVerlassen, verwerfen, wachHalten, wiedergabeSitzung } from './klang';
import { klangSpielen, klingend } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';

// Begleitung abspielen (I-04): Takt für Takt geplant, auf der Audio-Uhr wie
// das Metronom — Tempo, Lautstärke und Klick-Klang sind die des Metronoms;
// ein neues Tempo gilt ab dem nächsten Takt. Läuft im Kreis (Jam-Karte) oder
// einmal durch (Hörbeispiel). Der Takt, der gerade klingt, kommt als Zustand
// zurück (−1 im Einzähler). Startet die Begleitung, hält das Metronom an —
// zwei Uhren liefen sonst gegeneinander.

export interface BegleitStart {
  /** Je Takt die Töne (./begleitung: Bass, Klavier, Beispiel-Linie). */
  takte: readonly (readonly BegleitTon[])[];
  /** Klick je Takt (Klang des Metronoms); null: ohne Klick. */
  klicks: readonly BegleitKlick[] | null;
  schlaege: number;
  /** Tonraum der MIDI-Werte: notiert für diese Stimmung („C“: klingend). */
  stimmung: Stimmung;
  schleife: boolean;
  einzaehlen: boolean;
}

interface Lauf {
  ctx: AudioContext; master: GainNode; klick: GainNode; timer: number; raf: number;
  naechster: number; takt: number; einzaehler: boolean; ende: number | null;
  schlange: { zeit: number; takt: number }[]; o: BegleitStart; freigeben: (() => void) | null;
  puffer: Map<string, AudioBuffer>;
}

export function useBegleiter() {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  const einst = useRef({ bpm: metro.bpm, laut: metro.laut, klang: metro.klang, a: stimm.kammerton });
  useEffect(() => { einst.current = { bpm: metro.bpm, laut: metro.laut, klang: metro.klang, a: stimm.kammerton }; }, [metro.bpm, metro.laut, metro.klang, stimm.kammerton]);
  const metroLaeuft = useRef(metro.laeuft);
  useEffect(() => { metroLaeuft.current = metro.laeuft; }, [metro.laeuft]);
  const metroStopp = metro.stopp;
  const lauf = useRef<Lauf | null>(null);
  const [takt, setTakt] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const stoppen = useCallback(() => {
    const l = lauf.current;
    if (!l) return;
    window.clearInterval(l.timer);
    cancelAnimationFrame(l.raf);
    l.freigeben?.();
    verwerfen(l.ctx);
    lauf.current = null;
    setLaeuft(false);
    setTakt(null);
  }, []);

  const planen = useCallback(() => {
    const l = lauf.current;
    if (!l) return;
    const { ctx, o } = l;
    const e = einst.current;
    l.master.gain.setTargetAtTime(Math.max(0.05, e.laut), ctx.currentTime, 0.02);
    l.klick.gain.setTargetAtTime(Math.max(0.05, e.laut) * 0.55, ctx.currentTime, 0.02);
    // Klick-Klänge je Klang einmal erzeugen (der Klang des Metronoms kann wechseln).
    const puffer = (art: 'betont' | 'normal') => {
      const key = `${e.klang}:${art}`;
      if (!l.puffer.has(key)) l.puffer.set(key, klangPuffer(ctx, e.klang, art));
      return l.puffer.get(key)!;
    };
    const klicken = (liste: readonly BegleitKlick[], ab: number, sek: number) => {
      for (const k of liste) {
        const q = ctx.createBufferSource();
        q.buffer = puffer(k.betont ? 'betont' : 'normal');
        q.connect(l.klick);
        q.start(ab + k.schlag * sek);
      }
    };
    while (l.ende === null && l.naechster < ctx.currentTime + 0.3) {
      const sek = 60 / Math.max(20, e.bpm);
      if (l.einzaehler) {
        klicken(einzaehlKlicks(o.schlaege), l.naechster, sek);
        l.schlange.push({ zeit: l.naechster, takt: -1 });
        l.naechster += o.schlaege * sek;
        l.einzaehler = false;
        continue;
      }
      if (l.takt >= o.takte.length) {
        if (o.schleife && o.takte.length) l.takt = 0;
        else { l.ende = l.naechster; break; }
      }
      for (const t of o.takte[l.takt]) {
        klangSpielen(ctx, l.master, { beginn: 0, dauer: t.dauer * sek, midi: t.midi, stimme: t.stimme, staerke: t.staerke },
          klingend(t.midi, o.stimmung, e.a), l.naechster + t.schlag * sek);
      }
      if (o.klicks) klicken(o.klicks, l.naechster, sek);
      l.schlange.push({ zeit: l.naechster, takt: l.takt });
      l.naechster += o.schlaege * sek;
      l.takt++;
    }
  }, []);


  const starten = useCallback((o: BegleitStart, ab = 0) => {
    stoppen();
    if (!o.takte.length) return;
    if (metroLaeuft.current) metroStopp();
    wiedergabeSitzung();
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    ctx.resume().catch(() => { /* egal — geplant wird auf der Audio-Uhr */ });
    const master = ctx.createGain(), klick = ctx.createGain();
    master.connect(ctx.destination); klick.connect(ctx.destination);
    master.gain.value = Math.max(0.05, einst.current.laut);
    klick.gain.value = Math.max(0.05, einst.current.laut) * 0.55;
    const l: Lauf = {
      ctx, master, klick, timer: 0, raf: 0, naechster: ctx.currentTime + 0.1, takt: Math.max(0, Math.min(ab, o.takte.length - 1)),
      einzaehler: o.einzaehlen, ende: null, schlange: [], o, freigeben: null, puffer: new Map(),
    };
    lauf.current = l;
    // Anzeige folgt der Audio-Uhr.
    const zeigen = () => {
      if (lauf.current !== l) return;
      let neu: number | null = null;
      while (l.schlange.length && l.schlange[0].zeit <= l.ctx.currentTime) neu = l.schlange.shift()!.takt;
      if (neu !== null) setTakt(neu);
      if (l.ende !== null && l.ctx.currentTime > l.ende + 0.4) { stoppen(); return; }
      l.raf = requestAnimationFrame(zeigen);
    };
    l.timer = window.setInterval(planen, 50);
    l.raf = requestAnimationFrame(zeigen);
    planen();
    setLaeuft(true);
    setTakt(o.einzaehlen ? -1 : l.takt);
    void wachHalten().then((f) => { if (lauf.current === l) l.freigeben = f; else f?.(); });
  }, [stoppen, planen, metroStopp]);

  // Neue Töne (anderer Stil, andere Linie), während es läuft: ab dem nächsten Takt.
  const tauschen = useCallback((o: Pick<BegleitStart, 'takte' | 'klicks'>) => {
    const l = lauf.current;
    if (l) l.o = { ...l.o, ...o };
  }, []);

  useBeimVerlassen(stoppen);
  useEffect(() => stoppen, [stoppen]);

  return { starten, stoppen, tauschen, laeuft, takt, bpm: metro.bpm, setBpm: metro.setBpm };
}
