'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EINSTELLUNG_STANDARD as STANDARD, type Akzent, type Trainer } from '@/domain/einstellungen';
import type { Swing } from '@/domain/swing';
import { akzenteFuer, nennerPruefen, unterPruefen, type Nenner } from '@/domain/takt';
import {
  imHintergrundWeiter, jetztLaeuft, taktgeberPlanen, taktgeberStart, vorlauf, VORLAUF_VORN, zurueckAb, type TaktgeberStand,
} from '@/domain/taktgeber';
import {
  gespeichert, hintergrundSchalter, klangPuffer, mischenSchalter, speichern, useBeimVerlassen, useBeimZurueckkommen, useEinstellungenGeladen,
  verwerfen, wachHalten, wiedergabeSitzung, type Art, type Klang,
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

interface Audio { ctx: AudioContext; gain: GainNode; puffer: Map<string, AudioBuffer> }
// Ein geplanter Klick: seine Quelle (stumm: keine), der Timer, der das neue
// Tempo des Trainers zeigt, und der Stand davor — zum Zurückholen.
interface Geplant { zeit: number; quelle: AudioBufferSourceNode | null; anzeige: number; vorher: TaktgeberStand }
interface Lauf {
  timer: number; raf: number; stand: TaktgeberStand; geplant: Geplant[];
  schlange: { zeit: number; schlag: number; sub: number }[]; freigeben: (() => void) | null;
}

function puffer(a: Audio, k: Klang, art: Art) {
  const key = `${k}:${art}`;
  if (!a.puffer.has(key)) a.puffer.set(key, klangPuffer(a.ctx, k, art));
  return a.puffer.get(key)!;
}

// Einen geplanten Klick zurücknehmen: Eine Quelle, die vor ihrem Start
// gestoppt wird, klingt nie; abgehängt bleibt sie sicher still.
function abbrechen(g: Geplant) {
  window.clearTimeout(g.anzeige);
  if (!g.quelle) return;
  try { g.quelle.stop(); } catch { /* egal */ }
  g.quelle.disconnect();
}

// Sperrbildschirm und Kontrollzentrum (Media Session). Mit der Sitzung
// „playback“ zeigt iOS dort auch reines Web Audio — mit diesem Titel.
type MediaNavigator = Navigator & { mediaSession?: MediaSession };
function sperrbildschirm(): MediaSession | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as MediaNavigator).mediaSession ?? null;
}
function handgriff(ms: MediaSession, aktion: MediaSessionAction, tun: MediaSessionActionHandler | null) {
  try { ms.setActionHandler(aktion, tun); } catch { /* Aktion unbekannt: egal */ }
}

// Ein Taktgeber für die ganze Übe-Seite: große Ansicht und Mini-Leiste im
// Notenbetrachter steuern dasselbe Metronom, es läuft beim Wechseln weiter.
// Planen und Zurückholen: @/domain/taktgeber.
export function MetronomAnbieter({ children }: { children: React.ReactNode }) {
  const audio = useRef<Audio | null>(null);
  const lauf = useRef<Lauf | null>(null);
  const [bpm, setBpmRoh] = useState(() => gespeichert('metro:bpm', 80));
  // Nur die Anzeige: Der Trainer meldet sein Tempo, wenn dessen Takt klingt.
  const tempoZeigen = useCallback((n: number) => { const w = Math.min(300, Math.max(20, Math.round(n))); setBpmRoh(w); speichern('metro:bpm', w); return w; }, []);
  // Von Hand (Tippen, ±1, Regler, Stelle): gilt ab dem nächsten geplanten Klick.
  const setBpm = useCallback((n: number) => {
    const w = tempoZeigen(n);
    if (lauf.current) lauf.current.stand.bpm = w;
  }, [tempoZeigen]);
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

  // Alles, was der Taktgeber liest, als Referenz (er läuft außerhalb von
  // React). Das Tempo, mit dem er plant, steht in seinem Stand (lauf.stand).
  const r = useRef({ bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing, startBpm: bpm });
  useEffect(() => {
    r.current = { ...r.current, bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing };
  }, [bpm, takt, nenner, akzente, unter, klang, laut, trainer, swing]);
  useEffect(() => { speichern('metro:takt', takt); speichern('metro:nenner', nenner); speichern('metro:akzente', akzente); speichern('metro:unter', unter); speichern('metro:klang', klang); speichern('metro:laut', laut); speichern('metro:trainer', trainer); speichern('metro:swing', swing); },
    [takt, nenner, akzente, unter, klang, laut, trainer, swing]);

  // Plant voraus: vorn 0,12 s, im Hintergrund einige Sekunden — dort weckt
  // iOS die Seite nur etwa einmal je Sekunde (D-08).
  const planen = useCallback(() => {
    const a = audio.current, l = lauf.current, c = r.current;
    if (!a || !l) return;
    const jetzt = a.ctx.currentTime;
    a.gain.gain.setTargetAtTime(c.laut, jetzt, 0.02);
    const { klicks, stand } = taktgeberPlanen(l.stand, c, jetzt + vorlauf(document.visibilityState !== 'hidden'), jetzt);
    l.stand = stand;
    for (const k of klicks) {
      let quelle: AudioBufferSourceNode | null = null;
      if (k.art) {
        quelle = a.ctx.createBufferSource();
        quelle.buffer = puffer(a, c.klang, k.art);
        quelle.connect(a.gain);
        quelle.start(k.zeit);
      }
      const neu = k.tempo;
      const anzeige = neu === undefined ? 0 : window.setTimeout(() => tempoZeigen(neu), Math.max(0, (k.zeit - jetzt) * 1000));
      l.geplant.push({ zeit: k.zeit, quelle, anzeige, vorher: k.vorher });
      l.schlange.push({ zeit: k.zeit, schlag: k.schlag, sub: k.sub });
    }
    // Gespieltes vergessen; von der Anzeige bleibt nur der letzte Schlag
    // (im Hintergrund zeichnet niemand die Schlange ab).
    const alt = zurueckAb(l.geplant, jetzt - 1);
    if (alt > 0) l.geplant.splice(0, alt);
    while (l.schlange.length > 1 && l.schlange[1].zeit <= jetzt) l.schlange.shift();
  }, [tempoZeigen]);

  // Zurück in der App: Was weit voraus geplant ist, zurücknehmen und neu
  // planen — so gelten Tempo, Taktart, Akzente und Trainer sofort.
  const zurueckholen = useCallback(() => {
    const a = audio.current, l = lauf.current;
    if (!a || !l) return;
    const i = zurueckAb(l.geplant, a.ctx.currentTime + VORLAUF_VORN);
    if (i >= l.geplant.length) return;
    const ab = l.geplant[i].zeit;
    for (const g of l.geplant.slice(i)) abbrechen(g);
    l.stand = { ...l.geplant[i].vorher };
    l.geplant.length = i;
    l.schlange = l.schlange.filter((x) => x.zeit < ab);
    planen();
  }, [planen]);

  // Anzeige folgt der Audio-Uhr, nicht einem Timer — dadurch exakt synchron.
  const zeigen = useCallback(function zeigen() {
    const a = audio.current, l = lauf.current;
    if (!a || !l) return;
    let neu: { schlag: number; sub: number } | null = null;
    while (l.schlange.length && l.schlange[0].zeit <= a.ctx.currentTime) neu = l.schlange.shift()!;
    if (neu) setAktiv(neu);
    l.raf = requestAnimationFrame(zeigen);
  }, []);

  const stopp = useCallback(() => {
    const l = lauf.current;
    if (l) {
      window.clearInterval(l.timer); cancelAnimationFrame(l.raf); l.freigeben?.();
      // Schon Geplantes verstummt sofort (im Hintergrund bis zu einigen Sekunden).
      const jetzt = audio.current?.ctx.currentTime ?? 0;
      for (const g of l.geplant) if (g.zeit > jetzt) abbrechen(g);
    }
    lauf.current = null;
    setLaeuft(false);
    setAktiv(null);
    const ms = sperrbildschirm();
    if (ms?.metadata) ms.playbackState = 'paused';
  }, []);

  // Sperrbildschirm: ▶ und ❚❚ steuern das Metronom, solange sein
  // Audio-Kontext da ist; mit ihm verschwindet der Eintrag.
  const startRef = useRef<() => Promise<void>>(async () => { /* bis zum ersten Zeichnen */ });
  const sperrbildschirmZeigen = useCallback((an: boolean) => {
    const ms = sperrbildschirm();
    if (!ms) return;
    try {
      if (!an) {
        ms.metadata = null;
        ms.playbackState = 'none';
        for (const a of ['play', 'pause', 'stop'] as const) handgriff(ms, a, null);
        return;
      }
      const c = r.current, j = jetztLaeuft(c.bpm, c.takt, c.nenner);
      ms.metadata = new MediaMetadata({ title: j.titel, artist: j.unter, album: 'CheatSheet' });
      ms.playbackState = 'playing';
      handgriff(ms, 'play', () => { void startRef.current(); });
      handgriff(ms, 'pause', () => stopp());
      handgriff(ms, 'stop', () => stopp());
    } catch { /* ohne Media Session nur ohne Sperrbildschirm */ }
  }, [stopp]);

  async function start() {
    if (lauf.current) return;
    wiedergabeSitzung();
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
    lauf.current = {
      timer: 0, raf: 0, stand: taktgeberStart(audio.current.ctx.currentTime + 0.08, r.current.bpm), geplant: [], schlange: [], freigeben: null,
    };
    const l = lauf.current;
    l.timer = window.setInterval(planen, 25);
    l.raf = requestAnimationFrame(zeigen);
    planen();
    setLaeuft(true);
    sperrbildschirmZeigen(true);
    const freigeben = await wachHalten();
    // Inzwischen gestoppt? Dann die Bildschirmsperre gleich wieder lösen.
    if (lauf.current === l) l.freigeben = freigeben; else freigeben?.();
  }
  useEffect(() => { startRef.current = start; });

  // App verlassen. Ohne „Metronom im Hintergrund“ (oder gemischt) wie
  // bisher: iOS unterbricht den Ton — anhalten und den Kontext verwerfen,
  // zurück in der App startet ein Tipp mit frischem Ton (D-02). Mit: gleich
  // einige Sekunden voraus planen, solange die Seite noch läuft (D-08).
  const verlassen = useCallback(() => {
    if (lauf.current && audio.current && imHintergrundWeiter({ hintergrund: hintergrundSchalter.an(), mischen: mischenSchalter.an() })) {
      planen();
      return;
    }
    stopp();
    verwerfen(audio.current?.ctx);
    audio.current = null;
    sperrbildschirmZeigen(false);
  }, [stopp, planen, sperrbildschirmZeigen]);
  useBeimVerlassen(verlassen);

  // Zurück in der App: Hat iOS den Ton doch unterbrochen (älteres iOS,
  // Anruf, andere App mit Musik), ehrlich anhalten. Sonst das weit
  // Vorausgeplante neu planen und den Bildschirm wieder wach halten.
  const zurueck = useCallback(() => {
    const a = audio.current, l = lauf.current;
    if (!a || !l) return;
    if (a.ctx.state !== 'running') {
      stopp();
      verwerfen(a.ctx);
      audio.current = null;
      sperrbildschirmZeigen(false);
      return;
    }
    zurueckholen();
    void wachHalten().then((freigeben) => {
      if (lauf.current === l) { l.freigeben?.(); l.freigeben = freigeben; } else freigeben?.();
    });
  }, [stopp, zurueckholen, sperrbildschirmZeigen]);
  useBeimZurueckkommen(zurueck);

  // Tempo oder Taktart geändert, während es läuft: der Sperrbildschirm zieht mit.
  useEffect(() => {
    const ms = sperrbildschirm();
    if (!laeuft || !ms?.metadata) return;
    const j = jetztLaeuft(bpm, takt, nenner);
    try { ms.metadata = new MediaMetadata({ title: j.titel, artist: j.unter, album: 'CheatSheet' }); } catch { /* egal */ }
  }, [laeuft, bpm, takt, nenner]);

  useEffect(() => () => {
    const l = lauf.current;
    if (l) { window.clearInterval(l.timer); cancelAnimationFrame(l.raf); l.freigeben?.(); }
    void audio.current?.ctx.close();
    sperrbildschirmZeigen(false);
  }, [sperrbildschirmZeigen]);

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
