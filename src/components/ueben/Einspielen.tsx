'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  alsAbcStimmen, bandpegel, effektivwert, FEINHEITEN, LESARTEN, notenDateiname, rastern, taktDauer, tempoAusTipps, TONARTEN, tonartFinden, versatzSchaetzen,
  zellenDauer, zellenJeSchlag, type Feinheit, type Gelesen, type Lesart, type Raster, type Stimme, type Tonrahmen,
} from '@/domain/notation';
import type { Stueck } from '@/domain/bestand';
import { TAKTARTEN, taktartText, type Nenner } from '@/domain/takt';
import { aufBlatt, aufsBlattStimmen, einstimmig, leeresBlatt, skalieren } from '@/domain/notensatz';
import { frequenzZuTon, grundfrequenz, type Stimmung } from '@/domain/ueben';
import { audioSitzung, gespeichert, speichern } from './klang';
import { useMikrofonSpur } from './mikrofonspur';
import { stueckAnlegen, stueckNeuSchreiben } from './lokal';
import { useMetronom } from './MetronomKontext';
import { Notenblatt, type BlattPos, type BlattStand } from './Notensatz';
import { Aufnahmeleiste, type LeistenZustand, type Vorschau } from './Aufnahmeleiste';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { notationPdf } from './notenpdf';
import { fehlerGrund } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';
import { ohneCancelAbbrechen } from './dateiwahl';

// Einsingen, Audio laden oder Schreiben (G-01/G-02/G-03): eine Stimme wird
// aufgenommen — live über das Mikrofon mit Einzähler und Klick, oder aus
// einer Audio-Datei (Sprachmemo, mp3, wav) — und auf dem Taktraster zu
// Noten; oder man fängt mit einem leeren Takt an. Das Ergebnis ist ein
// Vorschlag im Notenblatt (./Notensatz: antippen, verschieben, Werte,
// Vorspielen mit Klavierklang); „Als Stück speichern“ legt ein Stück mit
// gerenderter PDF an, die ABC-Quelle bleibt am Stück (`notation`).
// Rechnen in @/domain/notation; Tonhöhen wie beim Stimmgerät (YIN), schon
// notiert fürs Instrument (Stimmung aus dem Stimmgerät).
//
// Mikrofon: Mit „Lautsprecher“ (Vorgabe) läuft die Sprachverarbeitung des
// Browsers — Verstärkung und Echo-Unterdrückung, auf dem iPhone dasselbe wie
// Freisprechen beim Telefonieren: der Klick kommt aus dem Lautsprecher, das
// Mikrofon hört auch aus Abstand, und der Klick bleibt aus der Aufnahme
// draußen. Ohne ist es das rohe Mikrofon (iOS: dann Hörer statt Lautsprecher
// und ohne Verstärkung) — nah am Mund, aber unverfälscht. Die Aufnahme
// selbst wird nicht behalten: Angehört wird das Transkribierte (Notensatz).

export type EinspielQuelle = 'mikro' | 'datei' | 'leer';
type Phase = 'bereit' | 'zaehlt' | 'nimmt' | 'rechnet' | 'vorschlag';

const FEINHEIT_SCHLUESSEL = 'ueben:einspiel-feinheit';
const LESART_SCHLUESSEL = 'ueben:einspiel-lesart';
const KLICK_SCHLUESSEL = 'ueben:einspiel-klick';
const TONART_SCHLUESSEL = 'ueben:einspiel-tonart';
const LAUTSPRECHER_SCHLUESSEL = 'ueben:einspiel-lautsprecher';
// Pegel, ab dem ein Fenster als Ton gilt (−50 dBFS), für Audio-Dateien;
// das Mikrofon regelt mikrofonspur.ts.
const MINDEST_PEGEL = 0.003;
// Längste Aufnahme in Takten — danach hält die App von selbst an.
const MAX_TAKTE = 64;
// Audio-Dateien: Abtastrate und Fenster der Tonerkennung (23 ms Fenster
// reichen ab ~45 Hz; Schritt 11,6 ms).
const RATE = 22050, FENSTER = 1024, SCHRITT = 256;
const KLAR = 0.85;
// Gerenderte Seite (A4-Verhältnis) in Pixeln.

const luft = () => new Promise<void>((ok) => setTimeout(ok, 0));

const ACCEPT = 'audio/*,.m4a,.mp3,.wav,.aac,.aiff,.caf,.ogg,.flac';
function audioWaehlen(): Promise<File | null> {
  return new Promise((ok) => {
    let fertig = false;
    const ende = (f: File | null) => { if (!fertig) { fertig = true; ok(f); } };
    const input = document.createElement('input');
    input.type = 'file'; input.accept = ACCEPT;
    input.onchange = () => ende(input.files?.[0] ?? null);
    input.oncancel = () => ende(null);
    ohneCancelAbbrechen(input, () => ende(null));
    input.click();
  });
}

interface Wiedergabe { ctx: AudioContext; quelle: AudioBufferSourceNode; beginn: number; raf: number }

// Vorlage: ein gespeichertes Stück mit Quelle zum Weiterbearbeiten
// („Komponieren“ in der Notenansicht) — Speichern schreibt es neu.
export interface Vorlage { stueck: Stueck; gelesen: Gelesen }

export function EinspielenDialog({ quelle: quelleStart, sammlungen, tags, vorlage, fertig, schliessen }: {
  quelle: EinspielQuelle;
  sammlungen: string[]; tags: string[];
  vorlage?: Vorlage;
  fertig: (meldung: string) => void;
  schliessen: () => void;
}) {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  const [quelle, setQuelle] = useState<EinspielQuelle>(vorlage ? 'leer' : quelleStart);
  const [phase, setPhase] = useState<Phase>(vorlage || quelleStart === 'leer' ? 'vorschlag' : 'bereit');
  // Raster: Vorgaben vom Metronom (bei einer Vorlage: aus ihr), hier nur für diese Aufnahme geändert.
  const [bpm, setBpmRoh] = useState(vorlage ? vorlage.gelesen.raster.bpm : metro.bpm);
  const setBpm = (n: number) => setBpmRoh(Math.min(300, Math.max(20, Math.round(n))));
  // Das Tempo-Feld: frei tippen (Text nur während der Eingabe), übernommen
  // und begrenzt beim Verlassen oder mit Enter.
  const [tempoText, setTempoText] = useState<string | null>(null);
  const tempoUebernehmen = () => { const n = Number(tempoText); if (n) setBpm(n); setTempoText(null); };
  const [taktart, setTaktart] = useState<[number, Nenner]>(vorlage ? [vorlage.gelesen.raster.zaehler, vorlage.gelesen.raster.nenner] : [metro.takt, metro.nenner]);
  const [feinheit, setFeinheitRoh] = useState<Feinheit>(() => (gespeichert<number>(FEINHEIT_SCHLUESSEL, 16) === 8 ? 8 : 16));
  const setFeinheit = (f: Feinheit) => { setFeinheitRoh(f); speichern(FEINHEIT_SCHLUESSEL, f); };
  // Lesart der Erkennung: melodisch (gehaltene Töne) oder rhythmisch (kurze Töne, Schwellen folgen dem Tempo).
  const [lesart, setLesartRoh] = useState<Lesart>(() => (gespeichert<string>(LESART_SCHLUESSEL, 'melodisch') === 'rhythmisch' ? 'rhythmisch' : 'melodisch'));
  const setLesart = (l: Lesart) => { setLesartRoh(l); speichern(LESART_SCHLUESSEL, l); };
  const [klickWeiter, setKlickWeiterRoh] = useState(() => gespeichert(KLICK_SCHLUESSEL, true));
  const setKlickWeiter = (an: boolean) => { setKlickWeiterRoh(an); speichern(KLICK_SCHLUESSEL, an); };
  const [lautsprecher, setLautsprecherRoh] = useState(() => gespeichert(LAUTSPRECHER_SCHLUESSEL, true));
  const setLautsprecher = (an: boolean) => { setLautsprecherRoh(an); speichern(LAUTSPRECHER_SCHLUESSEL, an); };
  // Tonart (notiert, wie das Stimmgerät zeigt): zieht die Töne auf die Leiter
  // und setzt die Vorzeichen; leer = keine Tonart, Töne bleiben, wie gehört.
  const [tonartAbc, setTonartAbcRoh] = useState(() => (vorlage ? vorlage.gelesen.tonart?.abc ?? '' : gespeichert<string>(TONART_SCHLUESSEL, 'C')));
  const setTonartAbc = (a: string) => { setTonartAbcRoh(a); speichern(TONART_SCHLUESSEL, a); setTonartBlatt(null); };
  const tonart = useMemo(() => tonartFinden(tonartAbc), [tonartAbc]);
  // Tonart des Blatts nach dem Transponieren (null: wie die Erkennung). Nur
  // für Anzeige und Speichern — die Erkennung behält ihre Tonart, sonst würde
  // jedes Transponieren den Vorschlag neu rastern und Bearbeitungen verwerfen.
  const [tonartBlatt, setTonartBlatt] = useState<string | null>(null);
  const tonartAnzeige = useMemo(() => tonartFinden(tonartBlatt ?? tonartAbc), [tonartBlatt, tonartAbc]);
  const tonartBlattRef = useRef(tonartBlatt);
  useEffect(() => { tonartBlattRef.current = tonartBlatt; }, [tonartBlatt]);
  const raster = useMemo<Raster>(() => ({ bpm, zaehler: taktart[0], nenner: taktart[1], feinheit }), [bpm, taktart, feinheit]);
  const rasterRef = useRef(raster);
  useEffect(() => { rasterRef.current = raster; }, [raster]);
  const einst = useRef({ kammerton: stimm.kammerton, stimmung: stimm.stimmung as Stimmung });
  useEffect(() => { einst.current = { kammerton: stimm.kammerton, stimmung: stimm.stimmung }; }, [stimm.kammerton, stimm.stimmung]);

  // Die Tonhöhenspur: Mikrofon ab Schlag 1 (start 0), Datei ab Dateianfang
  // mit `start` = Taktanfang in Sekunden.
  const [spur, setSpur] = useState<Tonrahmen[]>([]);
  const [start, setStart] = useState(0);
  const [dauer, setDauer] = useState(0); // Länge der Datei in Sekunden
  const [dateiName, setDateiName] = useState('');
  const [titel, setTitel] = useState(vorlage?.stueck.titel ?? '');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [spielt, setSpielt] = useState(false);

  // Mikrofon: Klick, Spur, Live-Anzeige — im Hook; hier nur die Phasen des Dialogs.
  const mikrofon = useMikrofonSpur();
  const anzeige = mikrofon.anzeige;
  const audio = useRef<AudioBuffer | null>(null);
  const wiedergabe = useRef<Wiedergabe | null>(null);
  const spurBild = useRef<HTMLCanvasElement>(null);
  const fokus = useDialogFokus<HTMLDivElement>();

  // Rastern: Spur ab Taktanfang, um die geschätzte Latenz vorgezogen
  // (Aufnahmeweg und Einrasten der Tonerkennung verspäten alle Einsätze
  // gleichmäßig), mit Tonart.
  const erkannt = useMemo(() => {
    if (phase !== 'vorschlag' || quelle === 'leer') return [];
    const abStart = spur.map((f) => ({ ...f, zeit: f.zeit - start }));
    const versatz = versatzSchaetzen(abStart, raster);
    // Aufs Blattraster (96 Zellen: 32tel, Triolen) gebracht.
    return skalieren(rastern(versatz ? abStart.map((f) => ({ ...f, zeit: f.zeit - versatz })) : abStart, raster, { tonart, lesart }), raster.feinheit);
  }, [phase, quelle, spur, start, raster, tonart, lesart]);
  const blattRaster = useMemo(() => aufBlatt(raster), [raster]);
  // Schreiben: ein leerer Takt in der Taktart (Tempo und Tonart ändern das Blatt nicht).
  const [zaehler, nenner] = taktart;
  const leer = useMemo(() => leeresBlatt(aufBlatt({ bpm: 60, zaehler, nenner, feinheit: 16 })), [zaehler, nenner]);
  // Grundlage als eine Stimme; mehr Stimmen kommen im Notenblatt dazu.
  const basisLeer = useMemo(() => einstimmig(leer), [leer]);
  const basisErkannt = useMemo(() => einstimmig(erkannt), [erkannt]);
  const basis = quelle === 'leer' ? basisLeer : basisErkannt;
  // Bearbeitet im Notenblatt — gilt, solange die Grundlage dieselbe ist
  // (neue Aufnahme, anderes Raster: alles von vorn).
  const [bearbeitet, setBearbeitet] = useState<{ basis: Stimme[]; stimmen: Stimme[] } | null>(
    () => (vorlage ? { basis: basisLeer, stimmen: aufsBlattStimmen(vorlage.gelesen.stimmen, vorlage.gelesen.raster.feinheit, vorlage.gelesen.raster) } : null));
  const stimmen = bearbeitet && bearbeitet.basis === basis ? bearbeitet.stimmen : basis;
  const takte = stimmen[0]?.takte ?? [];
  // Verlauf für Rückgängig/Wiederherstellen — je Eintrag mit seiner Grundlage,
  // ein Eintrag aus einer anderen Grundlage (neue Aufnahme) zählt nicht.
  const verlauf = useRef<{ zurueck: { basis: Stimme[]; stimmen: Stimme[]; tonart: string | null }[]; vor: { basis: Stimme[]; stimmen: Stimme[]; tonart: string | null }[] }>({ zurueck: [], vor: [] });
  // Ob es etwas zurück- oder vorzugehen gibt (für die Knöpfe) — als Zustand, nicht aus dem Ref gelesen.
  const [kann, setKann] = useState({ zurueck: false, vor: false });
  const stimmenRef = useRef(stimmen);
  useEffect(() => { stimmenRef.current = stimmen; }, [stimmen]);
  const kannNeu = useCallback((b: Stimme[]) => {
    const v = verlauf.current;
    setKann({ zurueck: v.zurueck.some((e) => e.basis === b), vor: v.vor.some((e) => e.basis === b) });
  }, []);
  const aendern = useCallback((neu: Stimme[]) => {
    const v = verlauf.current;
    v.zurueck.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current });
    if (v.zurueck.length > 200) v.zurueck.shift();
    v.vor = [];
    stimmenRef.current = neu;
    setBearbeitet({ basis, stimmen: neu });
    kannNeu(basis);
  }, [basis, kannNeu]);
  const zurueck = () => {
    const v = verlauf.current;
    const e = v.zurueck.pop();
    if (!e || e.basis !== basis) { if (e) v.zurueck.push(e); return; }
    v.vor.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current });
    stimmenRef.current = e.stimmen;
    setBearbeitet({ basis, stimmen: e.stimmen });
    setTonartBlatt(e.tonart);
    kannNeu(basis);
  };
  const vor = () => {
    const v = verlauf.current;
    const e = v.vor.pop();
    if (!e || e.basis !== basis) { if (e) v.vor.push(e); return; }
    v.zurueck.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current });
    stimmenRef.current = e.stimmen;
    setBearbeitet({ basis, stimmen: e.stimmen });
    setTonartBlatt(e.tonart);
    kannNeu(basis);
  };
  const kannZurueck = kann.zurueck, kannVor = kann.vor;

  // ── Aufnahmeleiste (in das Blatt hinein aufnehmen) ──
  const [leiste, setLeiste] = useState(false);
  const [blattStand, setBlattStand] = useState<BlattStand>({ auswahl: null, aktiv: 0, stumm: [], takte: 0 });
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [leistenZustand, setLeistenZustand] = useState<LeistenZustand>('scharf');
  const [auswahlVorgabe, setAuswahlVorgabe] = useState<BlattPos | null>(null);
  const leisteBeschaeftigt = leiste && leistenZustand !== 'scharf';
  const leisteSchliessen = useCallback(() => { setLeiste(false); setVorschau(null); setLeistenZustand('scharf'); }, []);
  const leisteUebernehmen = useCallback((neu: Stimme[], naechsterTakt: number) => {
    aendern(neu);
    const s = blattStand.aktiv;
    setAuswahlVorgabe({ stimme: s, takt: Math.min(naechsterTakt, Math.max(0, (neu[s]?.takte.length ?? 1) - 1)), note: 0 });
  }, [aendern, blattStand.aktiv]);

  // ── Spur zeichnen ──
  const zeichnen = useCallback((liste: readonly Tonrahmen[], jetzt: number | null) => {
    const c = spurBild.current;
    if (!c) return;
    const r = rasterRef.current;
    const dpr = window.devicePixelRatio || 1;
    const b = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(b * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(b * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, b, h);
    const stil = getComputedStyle(c);
    const farbe = (name: string, sonst: string) => stil.getPropertyValue(name).trim() || sonst;
    // Zeitfenster: Datei ganz, live die letzten acht Sekunden.
    const live = quelle === 'mikro';
    const ende = live ? Math.max(8, jetzt ?? 0) : Math.max(dauer, 1);
    const anfang = live ? ende - 8 : 0;
    const x = (t: number) => ((t - anfang) / (ende - anfang)) * b;
    // Tonhöhenbereich aus den Daten, mindestens zwei Oktaven.
    const toene = liste.filter((f) => f.midi !== null).map((f) => f.midi!);
    let lo = toene.length ? Math.min(...toene) - 3 : 55, hi = toene.length ? Math.max(...toene) + 3 : 79;
    if (hi - lo < 24) { const m = (hi + lo) / 2; lo = m - 12; hi = m + 12; }
    const y = (midi: number) => h - ((midi - lo) / (hi - lo)) * h;
    // Taktraster ab `start` (Datei) bzw. 0 (live).
    const td = taktDauer(r), sd = zellenDauer(r) * zellenJeSchlag(r);
    const nullpunkt = live ? 0 : start;
    // Taktstriche kräftiger, Schläge zart — in jeder Farbwelt aus der Tinte.
    g.lineWidth = 1;
    g.strokeStyle = farbe('--tinte', '#222');
    const ersterSchlag = Math.floor((anfang - nullpunkt) / sd);
    for (let k = ersterSchlag; ; k++) {
      const t = nullpunkt + k * sd;
      if (t > ende) break;
      if (t < anfang) continue;
      const taktgrenze = Math.abs((t - nullpunkt) / td - Math.round((t - nullpunkt) / td)) < 1e-6;
      g.globalAlpha = taktgrenze ? 0.45 : 0.12;
      g.beginPath(); g.moveTo(x(t) + 0.5, 0); g.lineTo(x(t) + 0.5, h); g.stroke();
    }
    g.globalAlpha = 1;
    // Vor dem Taktanfang (Datei): abgedunkelt.
    if (!live && start > anfang) { g.fillStyle = 'rgb(0 0 0 / 8%)'; g.fillRect(0, 0, x(start), h); }
    // Die Töne.
    g.fillStyle = farbe('--messing', '#b08d57');
    const breite = Math.max(1.5, (b / (ende - anfang)) * 0.012);
    for (const f of liste) {
      if (f.midi === null || f.zeit < anfang || f.zeit > ende) continue;
      g.fillRect(x(f.zeit), y(Math.round(f.midi)) - 2, breite, 4);
    }
    // Abspielkopf (Datei) oder „jetzt“ (live).
    if (jetzt !== null) {
      g.strokeStyle = farbe('--tinte', '#222'); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x(jetzt), 0); g.lineTo(x(jetzt), h); g.stroke();
    }
  }, [quelle, dauer, start]);
  useEffect(() => { if (phase !== 'nimmt' && phase !== 'zaehlt') zeichnen(spur, null); }, [zeichnen, spur, phase, raster]);
  useEffect(() => {
    const neu = () => zeichnen(mikrofon.aktiv ? mikrofon.rahmen.current : spur, null);
    window.addEventListener('resize', neu);
    return () => window.removeEventListener('resize', neu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeichnen, spur]);

  // ── Mikrofon ──
  // `stoppen`/`starten` des Hooks sind stabil — nur daran hängen, nicht am
  // Hook-Objekt: der Aufräum-Effekt unten darf nur beim Schließen laufen.
  const stoppen = mikrofon.stoppen;
  const mikrofonStarten = mikrofon.starten;
  const aufnehmen = useCallback(() => {
    setFehler('');
    void mikrofonStarten({
      raster: rasterRef.current, lautsprecher, klickWeiter, metro: { klang: metro.klang, laut: metro.laut },
      stimmung: einst.current.stimmung, kammerton: einst.current.kammerton,
      einzaehlTakte: 1, vorlauf: null, maxTakte: MAX_TAKTE,
      beiPhase: setPhase,
      beiFortschritt: (liste, rel) => zeichnen(liste, Math.max(0, rel)),
      beiEnde: (liste, ok) => { if (ok) { setSpur(liste); setStart(0); setPhase('vorschlag'); } else setPhase('bereit'); },
      beiFehler: setFehler,
    });
  }, [mikrofonStarten, metro.klang, metro.laut, klickWeiter, lautsprecher, zeichnen]);

  // ── Audio-Datei ──
  const dateiLaden = useCallback(async (f: File) => {
    setFehler(''); setPhase('rechnet'); setLaeuft('Audio wird gelesen …');
    try {
      const ctx = new AudioContext();
      let roh: AudioBuffer;
      try { roh = await ctx.decodeAudioData(await f.arrayBuffer()); } finally { void ctx.close(); }
      if (roh.duration > 300) throw new Error('länger als fünf Minuten — bitte einen Ausschnitt');
      const offline = new OfflineAudioContext(1, Math.ceil(roh.duration * RATE), RATE);
      const q = offline.createBufferSource();
      q.buffer = roh; q.connect(offline.destination); q.start();
      const mono = await offline.startRendering();
      audio.current = mono;
      const d = mono.getChannelData(0);
      const liste: Tonrahmen[] = [];
      let erster: number | null = null;
      for (let i = 0; i + FENSTER <= d.length; i += SCHRITT) {
        const fenster = d.subarray(i, i + FENSTER);
        const g = grundfrequenz(fenster, RATE, undefined, MINDEST_PEGEL);
        const ton = g && g.klarheit > KLAR ? frequenzZuTon(g.frequenz, einst.current.kammerton, einst.current.stimmung) : null;
        const zeit = (i + FENSTER / 2) / RATE;
        liste.push({ zeit, midi: ton ? ton.midi + ton.cent / 100 : null, pegel: effektivwert(fenster), mitte: bandpegel(fenster, RATE) });
        if (ton && erster === null) erster = zeit;
        if (liste.length % 300 === 0) { setLaeuft(`Töne werden erkannt … ${Math.round((100 * i) / d.length)} %`); await luft(); }
      }
      setSpur(liste); setDauer(mono.duration); setStart(erster ?? 0); setDateiName(f.name);
      if (!titel) setTitel(f.name.replace(/\.[^.]+$/, ''));
      setPhase('vorschlag');
    } catch (x) {
      setFehler(`Die Datei ließ sich nicht lesen: ${fehlerGrund(x)}`);
      setPhase('bereit');
    } finally { setLaeuft(null); }
  }, [titel]);

  const wiedergabeAus = useCallback(() => {
    const w = wiedergabe.current;
    if (!w) return;
    cancelAnimationFrame(w.raf);
    try { w.quelle.stop(); } catch { /* schon vorbei */ }
    void w.ctx.close();
    wiedergabe.current = null;
    setSpielt(false);
  }, []);
  const abspielen = useCallback(() => {
    if (wiedergabe.current) return wiedergabeAus();
    const a = audio.current;
    if (!a) return;
    audioSitzung('playback');
    const ctx = new AudioContext();
    const q = ctx.createBufferSource();
    q.buffer = a; q.connect(ctx.destination);
    const beginn = ctx.currentTime;
    q.start(beginn);
    q.onended = () => { if (wiedergabe.current?.quelle === q) wiedergabeAus(); };
    const schleife = () => {
      const w = wiedergabe.current;
      if (!w) return;
      zeichnen(spur, w.ctx.currentTime - w.beginn);
      w.raf = requestAnimationFrame(schleife);
    };
    wiedergabe.current = { ctx, quelle: q, beginn, raf: requestAnimationFrame(schleife) };
    setSpielt(true);
  }, [spur, zeichnen, wiedergabeAus]);

  // Tempo tippen — auch während die Datei läuft.
  const tipps = useRef<number[]>([]);
  const tippen = () => {
    tipps.current = [...tipps.current, performance.now()].slice(-8);
    const t = tempoAusTipps(tipps.current);
    if (t) setBpm(t);
  };
  // Taktanfang: in die Spur tippen (nur Datei).
  const spurTippen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (quelle !== 'datei' || !spur.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    setStart(Math.max(0, Math.min(dauer, ((e.clientX - r.left) / r.width) * dauer)));
  };

  // Quelle wechseln: alles zurück auf Anfang.
  const quelleWechseln = (q: EinspielQuelle) => {
    if (q === quelle) return;
    stoppen(false); wiedergabeAus();
    setQuelle(q); setSpur([]); setStart(0); setDauer(0); setDateiName(''); setPhase(q === 'leer' ? 'vorschlag' : 'bereit'); setFehler('');
    // Zum Schreiben wechseln nimmt den Vorschlag mit — da geht es ja weiter.
    setBearbeitet(q === 'leer' && phase === 'vorschlag' && takte.length ? { basis: basisLeer, stimmen } : null);
  };
  const nochmal = () => { wiedergabeAus(); setSpur([]); setStart(0); setDauer(0); setDateiName(''); setBearbeitet(null); setPhase('bereit'); };

  // ── Speichern: ABC → Seiten (JPEG) → PDF → Stück ──
  async function speichernUndSchliessen() {
    if (!takte.length || laeuft) return;
    setFehler('');
    const name = titel.trim() || vorlage?.stueck.titel || (quelle === 'mikro' ? 'Eingesungen' : quelle === 'leer' ? 'Neues Stück' : dateiName.replace(/\.[^.]+$/, '') || 'Aus Audio');
    const text = alsAbcStimmen(stimmen, blattRaster, { titel: name }, tonartAnzeige);
    try {
      setLaeuft('Noten werden gezeichnet …');
      await luft();
      const { datei, seiten } = await notationPdf(text, name);
      setLaeuft('PDF wird geschrieben …');
      await luft();
      if (vorlage) {
        await stueckNeuSchreiben(vorlage.stueck.id, {
          datei, dateiname: notenDateiname(name, new Date()), titel: name, seiten,
          notation: { format: 'abc', text, art: vorlage.stueck.notation?.art ?? 'geschrieben' },
        });
        fertig(`„${name}“ neu geschrieben: ${takte.length} ${takte.length === 1 ? 'Takt' : 'Takte'}, ${seiten} ${seiten === 1 ? 'Seite' : 'Seiten'}.`);
        return;
      }
      await stueckAnlegen({
        titel: name, stimme: '', datei, dateiname: notenDateiname(name, new Date()),
        ...(sammlungen.length ? { sammlungen } : {}), ...(tags.length ? { tags } : {}),
        notation: { format: 'abc', text, art: quelle === 'mikro' ? 'eingesungen' : quelle === 'leer' ? 'geschrieben' : 'audio' },
      });
      fertig(`„${name}“ mit ${takte.length} ${takte.length === 1 ? 'Takt' : 'Takten'} angelegt${sammlungen.length ? `, in „${sammlungen.join(', ')}“` : ''}.`);
    } catch (x) {
      setFehler(`Speichern ging nicht: ${fehlerGrund(x)}`);
      setLaeuft(null);
    }
  }

  const beschaeftigt = phase === 'zaehlt' || phase === 'nimmt' || phase === 'rechnet' || !!laeuft || leisteBeschaeftigt;
  useEscape(() => { if (!beschaeftigt) schliessen(); });
  useEffect(() => () => { stoppen(false); wiedergabeAus(); }, [stoppen, wiedergabeAus]);

  const mikroAktiv = phase === 'zaehlt' || phase === 'nimmt';
  // Mikrofon: ab dem Einzähler ist das Raster fest (die Spur ist dagegen
  // aufgenommen). Schreiben: Taktart und kleinster Wert, sobald etwas auf
  // dem Blatt steht — sonst wäre es weg; das Tempo bleibt frei.
  const festesTempo = quelle === 'mikro' && phase !== 'bereit';
  const festesRaster = festesTempo || (quelle === 'leer' && !!bearbeitet);
  const stimmungHinweis = stimm.stimmung !== 'C' ? ` · notiert für ${stimm.stimmung}-Instrument` : '';

  return createPortal(
    <div className="scan-dialog" role="dialog" aria-modal="true" aria-label="Selbst schreiben, einsingen oder Audio laden" ref={fokus} tabIndex={-1}>
      <div className="panel-kopf mit-linie">
        <h2>{vorlage ? 'Komponieren' : quelle === 'mikro' ? 'Einsingen' : quelle === 'leer' ? 'Schreiben' : 'Aus Audio'}</h2>
        <span className="bib-anzahl">{phase === 'vorschlag' && takte.length ? `· ${takte.length} ${takte.length === 1 ? 'Takt' : 'Takte'}` : ''}</span>
        <span className="flex-1" />
        <button type="button" className="panel-zu" onClick={schliessen} disabled={beschaeftigt} aria-label="Abbrechen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>

      {/* Mitte: Inhalt scrollt; die Aufnahmeleiste liegt darüber am unteren Rand, der Fuß mit „Speichern“ bleibt frei. */}
      <div className="scan-mitte">
      <div className="scan-inhalt" style={leiste ? { paddingBottom: '10rem' } : undefined}>
        {fehler && <p className="karte warnung" role="alert">{fehler}</p>}

        {!vorlage && (
          <div className="segment !mx-0" role="group" aria-label="Quelle">
            <button type="button" aria-pressed={quelle === 'mikro'} onClick={() => quelleWechseln('mikro')} disabled={beschaeftigt}>Mikrofon</button>
            <button type="button" aria-pressed={quelle === 'datei'} onClick={() => quelleWechseln('datei')} disabled={beschaeftigt}>Audio-Datei</button>
            <button type="button" aria-pressed={quelle === 'leer'} onClick={() => quelleWechseln('leer')} disabled={beschaeftigt}>Schreiben</button>
          </div>
        )}

        <div className="karte einspiel-raster">
          <label className="einspiel-feld">
            <span>Tempo</span>
            <span className="flex items-center gap-2">
              <input className="feld feld-zahl" type="number" inputMode="numeric" min={20} max={300} value={tempoText ?? String(bpm)} disabled={festesTempo}
                onChange={(e) => setTempoText(e.target.value)} onBlur={tempoUebernehmen}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tempoUebernehmen(); } }} aria-label="Tempo in Schlägen je Minute" />
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={tippen} disabled={festesTempo}>Tempo tippen</button>
            </span>
          </label>
          <div className="einspiel-feld">
            <span>Taktart</span>
            <div className="segment !mx-0" role="group" aria-label="Taktart">
              {TAKTARTEN.map(([z, n]) => (
                <button key={`${z}/${n}`} type="button" aria-pressed={taktart[0] === z && taktart[1] === n} disabled={festesRaster} onClick={() => setTaktart([z, n])}>{taktartText(z, n)}</button>
              ))}
            </div>
          </div>
          {quelle !== 'leer' && (
            <>
              <div className="einspiel-feld">
                <span>Kleinster Wert</span>
                <div className="segment !mx-0" role="group" aria-label="Kleinster Notenwert (Erkennung)">
                  {FEINHEITEN.map((f) => (
                    <button key={f.feinheit} type="button" aria-pressed={feinheit === f.feinheit} disabled={festesRaster} onClick={() => setFeinheit(f.feinheit)}>{f.name}</button>
                  ))}
                </div>
              </div>
              <div className="einspiel-feld">
                <span>Lesart</span>
                <div className="segment !mx-0" role="group" aria-label="Lesart der Erkennung">
                  {LESARTEN.map((l) => (
                    <button key={l.lesart} type="button" aria-pressed={lesart === l.lesart} onClick={() => setLesart(l.lesart)} title={l.hinweis}>{l.name}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <label className="einspiel-feld">
            <span>Tonart</span>
            <select className="feld feld-zahl" value={tonartAbc} onChange={(e) => setTonartAbc(e.target.value)} aria-label="Tonart (zieht die Töne auf die Leiter)">
              <option value="">keine</option>
              {TONARTEN.map((t) => <option key={t.abc} value={t.abc}>{t.name}</option>)}
            </select>
          </label>
          {quelle === 'mikro' && (
            <>
              <label className="einspiel-feld">
                <span>Klick während der Aufnahme</span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={klickWeiter} disabled={festesRaster} onChange={(e) => setKlickWeiter(e.target.checked)} />
              </label>
              <label className="einspiel-feld">
                <span>Lautsprecher</span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={lautsprecher} disabled={festesRaster} onChange={(e) => setLautsprecher(e.target.checked)} />
              </label>
            </>
          )}
        </div>

        {quelle !== 'leer' && (
          <canvas ref={spurBild} className={`einspiel-spur ${quelle === 'datei' && spur.length ? 'tippbar' : ''}`} onPointerDown={spurTippen}
            aria-label="Tonhöhenspur" role="img" />
        )}

        {quelle === 'mikro' && (
          <div className="einspiel-mitte">
            {phase === 'bereit' && (
              <>
                <button type="button" className="einspiel-aufnahme" onClick={() => void aufnehmen()} aria-label="Aufnahme starten">
                  <span className="einspiel-punkt" aria-hidden="true" />
                </button>
                <p className="gedaempft text-sm">Ein Takt wird eingezählt, dann läuft die Aufnahme. Eine Stimme: singen, summen, Trompete, Bass{stimmungHinweis}.</p>
                <p className="gedaempft text-xs">{lautsprecher
                  ? 'Lautsprecher an: wie Freisprechen — der Klick kommt aus dem Lautsprecher, das Mikrofon hört auch aus etwas Abstand, der Klick bleibt aus der Aufnahme draußen.'
                  : 'Lautsprecher aus: das rohe Mikrofon ohne Verstärkung — nah am Mund singen; auf dem iPhone kommt der Klick dann leise aus dem Hörer.'}</p>
              </>
            )}
            {mikroAktiv && (
              <>
                <div className="einspiel-stand" role="status" aria-live="polite">
                  {phase === 'zaehlt'
                    ? <span className="einspiel-zaehlt">{anzeige.zaehlt ?? ''}</span>
                    : <><span className="einspiel-zaehlt">{anzeige.takt ?? 1}</span><span className="gedaempft text-sm">Takt · Schlag {anzeige.schlag ?? 1}</span></>}
                  <span className="einspiel-ton">{anzeige.ton || ' '}</span>
                </div>
                <button type="button" className={`einspiel-aufnahme ${phase === 'nimmt' ? 'nimmt' : ''}`} onClick={() => stoppen(phase === 'nimmt')} aria-label={phase === 'nimmt' ? 'Aufnahme beenden' : 'Einzähler abbrechen'}>
                  <span className="einspiel-stopp" aria-hidden="true" />
                </button>
                <p className="gedaempft text-sm">{phase === 'zaehlt' ? 'Einzähler …' : 'Aufnahme läuft — Stopp, wenn die Melodie zu Ende ist.'}</p>
              </>
            )}
            {phase === 'vorschlag' && (
              <div className="einspiel-zeile">
                <button type="button" className="knopf knopf-leise knopf-klein" onClick={nochmal}>Nochmal aufnehmen</button>
              </div>
            )}
          </div>
        )}

        {quelle === 'datei' && (
          <div className="einspiel-mitte">
            {phase === 'bereit' && (
              <>
                <button type="button" className="knopf" onClick={() => void audioWaehlen().then((f) => f && dateiLaden(f))}>Audio-Datei wählen</button>
                <p className="gedaempft text-sm">Sprachmemo (m4a), mp3, wav — eine Stimme, kein ganzer Song. Vom iPhone: Sprachmemo teilen → „In Dateien sichern“, dann hier wählen{stimmungHinweis}.</p>
              </>
            )}
            {phase === 'rechnet' && <p className="gedaempft text-sm" role="status">{laeuft}</p>}
            {phase === 'vorschlag' && (
              <>
                <div className="einspiel-zeile">
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={abspielen} aria-pressed={spielt}>{spielt ? '■ Anhalten' : '▶ Anhören'}</button>
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={nochmal}>Andere Datei</button>
                  <span className="gedaempft text-xs">{dateiName} · {Math.round(dauer)} s · Taktanfang bei {start.toFixed(2)} s</span>
                </div>
                <p className="gedaempft text-xs">Tempo mittippen, während die Datei läuft. In die Spur tippen, wo der erste Takt beginnt — das Raster rückt mit.</p>
              </>
            )}
          </div>
        )}

        {phase === 'vorschlag' && (
          <div className="karte space-y-2">
            {takte.length
              ? <Notenblatt stimmen={vorschau?.stimmen ?? stimmen} raster={blattRaster} tonart={tonartAnzeige} titel={titel}
                  aendern={vorschau || leisteBeschaeftigt ? undefined : aendern} tonartAendern={(t) => setTonartBlatt(t?.abc ?? '')}
                  verlauf={{ zurueck: kannZurueck ? zurueck : null, vor: kannVor ? vor : null }}
                  hervorgehoben={vorschau ? { stimme: blattStand.aktiv, von: vorschau.von, bis: vorschau.bis, farbe: 'messing' } : null}
                  aufnehmen={quelle === 'leer' && !leiste && typeof navigator !== 'undefined' && !!navigator.mediaDevices ? () => setLeiste(true) : undefined}
                  beiStand={setBlattStand} auswahlVorgabe={auswahlVorgabe} />
              : (
                <div className="einspiel-zeile">
                  <p className="gedaempft text-sm">Kein Ton erkannt. Näher ans Mikrofon, lauter, oder eine andere Datei.</p>
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aendern(basisLeer)}>Trotzdem schreiben</button>
                </div>
              )}
            {quelle !== 'leer' && <p className="gedaempft text-xs">Ein Vorschlag — die Erkennung ist nie fehlerfrei; hier lässt er sich korrigieren. Die Quelle (ABC) bleibt am Stück.</p>}
          </div>
        )}
      </div>
      {leiste && phase === 'vorschlag' && quelle === 'leer' && (
        <Aufnahmeleiste stimmen={stimmen} aktiv={blattStand.aktiv} stumm={blattStand.stumm} auswahlTakt={blattStand.auswahl?.takt ?? null}
          raster={raster} blattRaster={blattRaster} tonart={tonart} lesart={lesart} setLesart={setLesart} lautsprecher={lautsprecher} setLautsprecher={setLautsprecher}
          metro={{ klang: metro.klang, laut: metro.laut }} stimmung={stimm.stimmung} kammerton={stimm.kammerton}
          vorschauAendern={setVorschau} zustandAendern={setLeistenZustand} uebernehmen={leisteUebernehmen} schliessen={leisteSchliessen} />
      )}
      </div>
      <form className="scan-fuss" onSubmit={(e) => { e.preventDefault(); void speichernUndSchliessen(); }}>
        <input className="feld" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel des Stücks" aria-label="Titel" disabled={!!laeuft} />
        <button type="submit" className="knopf" disabled={phase !== 'vorschlag' || !takte.length || !!laeuft}>{laeuft ?? (vorlage ? 'Speichern' : 'Als Stück speichern')}</button>
      </form>
    </div>,
    document.body,
  );
}
