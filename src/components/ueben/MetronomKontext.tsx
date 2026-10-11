'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { trainerTempo } from '@/domain/ueben';
import { audioSitzung, gespeichert, klangPuffer, speichern, useBeimVerlassen, verwerfen, wachHalten, type Art, type Klang } from './klang';

export type Akzent = 'betont' | 'normal' | 'stumm';
export interface Trainer { an: boolean; schritt: number; takte: number; ziel: number }

const akzenteFuer = (takt: number, alt: Akzent[] = []): Akzent[] =>
  Array.from({ length: takt }, (_, i) => alt[i] ?? (i === 0 ? 'betont' : 'normal'));

interface MetronomWert {
  bpm: number; setBpm: (n: number) => void; laeuft: boolean; start: () => void; stopp: () => void;
  aktiv: { schlag: number; sub: number } | null;
  takt: number; taktAendern: (n: number) => void; akzente: Akzent[]; akzentWechseln: (i: number) => void;
  unter: number; setUnter: (n: number) => void; klang: Klang; setKlang: (k: Klang) => void;
  laut: number; setLaut: (n: number) => void; trainer: Trainer; setTrainer: (t: Trainer) => void;
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
  const [takt, setTakt] = useState(() => gespeichert('metro:takt', 4));
  const [akzente, setAkzente] = useState<Akzent[]>(() => akzenteFuer(gespeichert('metro:takt', 4), gespeichert('metro:akzente', [])));
  const [unter, setUnter] = useState(() => gespeichert('metro:unter', 1));
  const [klang, setKlang] = useState<Klang>(() => gespeichert('metro:klang', 'holz'));
  const [laut, setLaut] = useState(() => gespeichert('metro:laut', 0.9));
  const [trainer, setTrainer] = useState(() => gespeichert('metro:trainer', { an: false, schritt: 4, takte: 4, ziel: 120 }));
  const [aktiv, setAktiv] = useState<{ schlag: number; sub: number } | null>(null);

  // Alles, was der Taktgeber liest, als Referenz (er läuft außerhalb von React).
  const r = useRef({ bpm, takt, akzente, unter, klang, laut, trainer, startBpm: bpm });
  useEffect(() => {
    r.current = { ...r.current, bpm, takt, akzente, unter, klang, laut, trainer };
  }, [bpm, takt, akzente, unter, klang, laut, trainer]);
  useEffect(() => { speichern('metro:takt', takt); speichern('metro:akzente', akzente); speichern('metro:unter', unter); speichern('metro:klang', klang); speichern('metro:laut', laut); speichern('metro:trainer', trainer); },
    [takt, akzente, unter, klang, laut, trainer]);

  const audio = useRef<{ ctx: AudioContext; gain: GainNode; puffer: Map<string, AudioBuffer> } | null>(null);
  const lauf = useRef<{ timer: number; raf: number; naechster: number; schritt: number; taktNr: number; schlange: { zeit: number; schlag: number; sub: number }[]; freigeben: (() => void) | null } | null>(null);

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
      const proSchlag = c.unter;
      const schlag = Math.floor(l.schritt / proSchlag) % c.takt;
      const sub = l.schritt % proSchlag;
      if (schlag === 0 && sub === 0) {
        if (l.schritt > 0) l.taktNr++;
        if (c.trainer.an) {
          const neu = trainerTempo(c.startBpm, c.trainer.schritt, c.trainer.takte, c.trainer.ziel, l.taktNr);
          if (neu !== c.bpm) { c.bpm = neu; const z = l.naechster; window.setTimeout(() => setBpm(neu), Math.max(0, (z - a.ctx.currentTime) * 1000)); }
        }
      }
      const akzent = c.akzente[schlag] ?? 'normal';
      if (akzent !== 'stumm') {
        const art: Art = sub > 0 ? 'unter' : akzent === 'betont' ? 'betont' : 'normal';
        const q = a.ctx.createBufferSource();
        q.buffer = puffer(c.klang, art);
        q.connect(a.gain);
        q.start(l.naechster);
      }
      l.schlange.push({ zeit: l.naechster, schlag, sub });
      l.naechster += 60 / c.bpm / proSchlag;
      l.schritt++;
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
    lauf.current = { timer: 0, raf: 0, naechster: audio.current.ctx.currentTime + 0.08, schritt: 0, taktNr: 0, schlange: [], freigeben: null };
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

  const taktAendern = (n: number) => { setTakt(n); setAkzente((a) => akzenteFuer(n, a)); };
  const akzentWechseln = (i: number) => setAkzente((a) => a.map((x, j) => (j !== i ? x : x === 'betont' ? 'normal' : x === 'normal' ? 'stumm' : 'betont')));

  return (
    <Kontext.Provider value={{
      bpm, setBpm, laeuft, start, stopp, aktiv, takt, taktAendern, akzente, akzentWechseln,
      unter, setUnter, klang, setKlang, laut, setLaut, trainer, setTrainer,
    }}>
      {children}
    </Kontext.Provider>
  );
}
