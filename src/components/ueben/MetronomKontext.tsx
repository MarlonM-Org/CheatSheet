'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EINSTELLUNG_STANDARD as STANDARD, type Akzent, type Trainer } from '@/domain/einstellungen';
import { abstandZumNaechsten, taktKlicks, type Swing } from '@/domain/swing';
import { akzenteFuer, nennerPruefen, unterPruefen, type Nenner } from '@/domain/takt';
import { trainerTempo } from '@/domain/ueben';
import {
  audioSitzung, gespeichert, klangPuffer, speichern, useBeimVerlassen, useEinstellungenGeladen, verwerfen, wachHalten, type Art, type Klang,
} from './klang';
import { skillGeuebt } from './skillspeicher';

export type { Akzent, Trainer };

interface MetronomWert {
  bpm: number; setBpm: (n: number) => void; laeuft: boolean; start: () => void; stopp: () => void;
  aktiv: { schlag: number; sub: number } | null;
  // Taktart (D-05): takt = Schläge je Takt (Zähler), nenner = Notenwert eines Schlags.
  takt: number; nenner: Nenner; taktartSetzen: (zaehler: number, nenner: Nenner) => void;
  akzente: Akzent[]; akzentWechseln: (i: number) => void;
  unter: number; setUnter: (n: number) => void; klang: Klang; setKlang: (k: Klang) => void;
  laut: number; setLaut: (n: number) => void; trainer: Trainer; setTrainer: (t: Trainer) => void;
  // Swing-Metronom (I-17): nur 2 und 4, hörbare Achtel mit Swing-Anteil (@/domain/swing).
  swing: Swing; setSwing: (s: Swing) => void;
}

const Kontext = createContext<MetronomWert | null>(null);
export function useMetronom(): MetronomWert {
  const w = useContext(Kontext);
  if (!w) throw new Error('useMetronom außerhalb von MetronomAnbieter');
  return w;
}

// Ein Taktgeber für die ganze Übe-Seite: große Ansicht und Mini-Leiste im
// Notenbetrachter steuern dasselbe Metronom, es läuft beim Wechseln weiter.
export function MetronomAnbieter({ children }: { children: React.ReactNode }) {
  const [bpm, setBpmRoh] = useState(() => gespeichert('metro:bpm', 80));
  const setBpm = useCallback((n: number) => { const w = Math.min(300, Math.max(20, Math.round(n))); setBpmRoh(w); speichern('metro:bpm', w); }, []);
  const [laeuft, setLaeuft] = useState(false);
  const [takt, setTakt] = useState(() => gespeichert('metro:takt', STANDARD['metro:takt']));
  const [nenner, setNenner] = useState<Nenner>(() => nennerPruefen(gespeichert('metro:nenner', STANDARD['metro:nenner'])));
  const [akzente, setAkzente] = useState<Akzent[]>(() => akzenteFuer(
    gespeichert('metro:takt', STANDARD['metro:takt']), nennerPruefen(gespeichert('metro:nenner', STANDARD['metro:nenner'])), gespeichert<Akzent[]>('metro:akzente', [])));
  const [unter, setUnter] = useState(() => gespeichert('metro:unter', STANDARD['metro:unter']));
  const [klang, setKlang] = useState<Klang>(() => gespeichert('metro:klang', STANDARD['metro:klang']));
  const [laut, setLaut] = useState(() => gespeichert('metro:laut', STANDARD['metro:laut']));
  const [trainer, setTrainer] = useState<Trainer>(() => gespeichert('metro:trainer', STANDARD['metro:trainer']));
  const [swing, setSwing] = useState<Swing>(() => gespeichert('metro:swing', STANDARD['metro:swing']));
  const [aktiv, setAktiv] = useState<{ schlag: number; sub: number } | null>(null);
  // Eine Sicherung hat Einstellungen übernommen: neu lesen, sonst schriebe
  // der Effekt unten die alten Werte zurück. Das Tempo bleibt am Gerät.
  const neuLesen = useCallback(() => {
    const t = gespeichert('metro:takt', STANDARD['metro:takt']);
    const n = nennerPruefen(gespeichert('metro:nenner', STANDARD['metro:nenner']));
    setTakt(t);
    setNenner(n);
    setAkzente(akzenteFuer(t, n, gespeichert<Akzent[]>('metro:akzente', [])));
    setUnter(unterPruefen(t, n, gespeichert('metro:unter', STANDARD['metro:unter'])));
    setKlang(gespeichert('metro:klang', STANDARD['metro:klang']));
    setLaut(gespeichert('metro:laut', STANDARD['metro:laut']));
    setTrainer(gespeichert('metro:trainer', STANDARD['metro:trainer']));
    setSwing(gespeichert('metro:swing', STANDARD['metro:swing']));
  }, []);
  useEinstellungenGeladen(neuLesen);

  // Alles, was der Taktgeber liest, als Referenz (er läuft außerhalb von React).
  const r = useRef({ bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing, startBpm: bpm });
  useEffect(() => {
    r.current = { ...r.current, bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing };
  }, [bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing]);
  useEffect(() => { speichern('metro:takt', takt); speichern('metro:nenner', nenner); speichern('metro:akzente', akzente); speichern('metro:unter', unter); speichern('metro:klang', klang); speichern('metro:laut', laut); speichern('metro:trainer', trainer); speichern('metro:swing', swing); },
    [takt, nenner, akzente, unter, klang, laut, trainer, swing]);

  const audio = useRef<{ ctx: AudioContext; gain: GainNode; puffer: Map<string, AudioBuffer> } | null>(null);
  const lauf = useRef<{ timer: number; raf: number; naechster: number; pos: number; taktNr: number; erster: boolean; schlange: { zeit: number; schlag: number; sub: number }[]; freigeben: (() => void) | null } | null>(null);

  function puffer(k: Klang, art: Art) {
    const a = audio.current!;
    const key = `${k}:${art}`;
    if (!a.puffer.has(key)) a.puffer.set(key, klangPuffer(a.ctx, k, art));
    return a.puffer.get(key)!;
  }

  function planen() {
    const a = audio.current!, l = lauf.current!, c = r.current;
    a.gain.gain.setTargetAtTime(c.laut, a.ctx.currentTime, 0.02);
    while (l.naechster < a.ctx.currentTime + 0.12) {
      // Die Klicks des Takts (Reihenfolge, Versatz, Stärke) kommen aus @/domain/swing;
      // je Klick neu berechnet, damit Akzente und Optionen sofort gelten.
      const klicks = taktKlicks(c.takt, c.nenner, c.unter, c.akzente, c.swing);
      if (l.pos >= klicks.length) l.pos = 0;
      const k = klicks[l.pos];
      if (l.pos === 0) {
        if (l.erster) l.erster = false; else l.taktNr++;
        if (c.trainer.an) {
          const neu = trainerTempo(c.startBpm, c.trainer.schritt, c.trainer.takte, c.trainer.ziel, l.taktNr);
          if (neu !== c.bpm) { c.bpm = neu; const z = l.naechster; window.setTimeout(() => setBpm(neu), Math.max(0, (z - a.ctx.currentTime) * 1000)); }
        }
      }
      if (k.art) {
        const q = a.ctx.createBufferSource();
        q.buffer = puffer(c.klang, k.art);
        q.connect(a.gain);
        q.start(l.naechster);
      }
      l.schlange.push({ zeit: l.naechster, schlag: k.schlag, sub: k.sub });
      // Das Tempo gilt je Schlag (D-07): in 6/8 drei Einheiten je Schlag.
      l.naechster += abstandZumNaechsten(klicks, l.pos, c.takt, c.nenner) * 60 / c.bpm;
      l.pos = (l.pos + 1) % klicks.length;
    }
  }

  // Anzeige folgt der Audio-Uhr, nicht einem Timer — dadurch exakt synchron.
  function zeigen() {
    const a = audio.current, l = lauf.current;
    if (!a || !l) return;
    let neu: { schlag: number; sub: number } | null = null;
    while (l.schlange.length && l.schlange[0].zeit <= a.ctx.currentTime) neu = l.schlange.shift()!;
    if (neu) setAktiv(neu);
    l.raf = requestAnimationFrame(zeigen);
  }

  async function start() {
    if (lauf.current) return;
    audioSitzung('playback');
    // Läuft der Kontext nicht, war er unterbrochen (App-Wechsel, Anruf) und
    // bliebe auf iOS stumm: verwerfen, solange die Tipp-Geste noch gilt.
    if (audio.current && audio.current.ctx.state !== 'running') {
      verwerfen(audio.current.ctx);
      audio.current = null;
    }
    if (!audio.current) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      audio.current = { ctx, gain, puffer: new Map() };
    }
    // Nicht auf resume() warten — es kehrt auf iOS teils nie zurück. Geplant
    // wird auf der Audio-Uhr; die steht, bis der Kontext läuft.
    audio.current.ctx.resume().catch(() => { /* egal */ });
    r.current.startBpm = r.current.bpm;
    if (r.current.swing.achtel) skillGeuebt('swing-artikulation');
    lauf.current = { timer: 0, raf: 0, naechster: audio.current.ctx.currentTime + 0.08, pos: 0, erster: true, taktNr: 0, schlange: [], freigeben: null };
    const l = lauf.current;
    l.timer = window.setInterval(planen, 25);
    l.raf = requestAnimationFrame(zeigen);
    planen();
    setLaeuft(true);
    const freigeben = await wachHalten();
    // Inzwischen gestoppt? Dann die Bildschirmsperre gleich wieder lösen.
    if (lauf.current === l) l.freigeben = freigeben; else freigeben?.();
  }

  const stopp = useCallback(() => {
    const l = lauf.current;
    if (l) { window.clearInterval(l.timer); cancelAnimationFrame(l.raf); l.freigeben?.(); }
    lauf.current = null;
    setLaeuft(false);
    setAktiv(null);
  }, []);

  // App verlassen: iOS unterbricht den Ton, und im Hintergrund plant der
  // Taktgeber ohnehin nicht weiter. Anhalten und den Kontext verwerfen —
  // zurück in der App startet ein Tipp das Metronom mit frischem Ton.
  const verlassen = useCallback(() => {
    stopp();
    verwerfen(audio.current?.ctx);
    audio.current = null;
  }, [stopp]);
  useBeimVerlassen(verlassen);

  useEffect(() => () => {
    const l = lauf.current;
    if (l) { window.clearInterval(l.timer); cancelAnimationFrame(l.raf); l.freigeben?.(); }
    void audio.current?.ctx.close();
  }, []);

  // Taktart wechseln: Bei gleichem Nenner bleiben die gesetzten Akzente
  // Schlag für Schlag; ein anderer Nenner bekommt die Standard-Betonung
  // (6/8 betont die Eins und die Vier).
  const taktartSetzen = (z: number, n: Nenner) => {
    setTakt(z); setNenner(n);
    setAkzente((a) => akzenteFuer(z, n, n === nenner ? a : []));
    // Die Unterteilung teilt in 4/4 die Viertel, in 6/8 die Achtel — gibt es sie dort nicht, zurück auf die erste.
    setUnter((u) => unterPruefen(z, n, u));
  };
  const akzentWechseln = (i: number) => setAkzente((a) => a.map((x, j) => (j !== i ? x : x === 'betont' ? 'normal' : x === 'normal' ? 'stumm' : 'betont')));

  return (
    <Kontext.Provider value={{
      bpm, setBpm, laeuft, start, stopp, aktiv, takt, nenner, taktartSetzen, akzente, akzentWechseln,
      unter, setUnter, klang, setKlang, laut, setLaut, trainer, setTrainer, swing, setSwing,
    }}>
      {children}
    </Kontext.Provider>
  );
}
