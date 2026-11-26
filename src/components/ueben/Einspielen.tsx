'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  alsAbcStimmen, bandpegel, effektivwert, LESARTEN, notenDateiname, taktDauer, tempoAusTipps, TONARTEN, tonartFinden,
  zellenDauer, zellenJeSchlag, type Gelesen, type Lesart, type Raster, type Stimme, type Tonrahmen,
} from '@/domain/notation';
import {
  ANTEIL_MAX, ANTEIL_MIN, anteilLesen, EINTEILUNGEN, einteilungLesen, einteilungMoeglich, erkennungsRaster, swingAnteil, swingSchaetzen, transkribieren,
  wirksam, type Einteilung, type Rhythmus,
} from '@/domain/rhythmus';
import type { Stueck } from '@/domain/bestand';
import { TAKTARTEN, taktartText, type Nenner } from '@/domain/takt';
import { aufBlatt, aufsBlattStimmen, einstimmig, leeresBlatt, type Klang } from '@/domain/notensatz';
import { akkordeNachfuehren, rahmenTakte, type Rahmen } from '@/domain/akkordrahmen';
import { akkordTakte, alsKlaenge, begleitungBauen, istStil, type BegleitStil } from '@/domain/begleitung';
import { schlaegeJeTakt } from '@/domain/takt';
import { frequenzZuTon, grundfrequenz, type Stimmung } from '@/domain/ueben';
import { gespeichert, speichern, wiedergabeSitzung } from './klang';
import { useLautsprecher } from './lautsprecher';
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
// Mikrofon: Mit „Lautsprecher“ (Vorgabe; seit B-20 eine Geräte-Einstellung
// für alle Klänge, @/domain/lautsprecher) läuft die Sprachverarbeitung des
// Browsers — Verstärkung und Echo-Unterdrückung, auf dem iPhone dasselbe wie
// Freisprechen beim Telefonieren: der Klick kommt aus dem Lautsprecher, das
// Mikrofon hört auch aus Abstand, und der Klick bleibt aus der Aufnahme
// draußen. Ohne ist es das rohe Mikrofon (iOS: dann Hörer statt Lautsprecher
// und ohne Verstärkung) — nah am Mund, aber unverfälscht. Die Aufnahme
// selbst wird nicht behalten: Angehört wird das Transkribierte (Notensatz).
//
// Rhythmus (G-12, @/domain/rhythmus): vor der Aufnahme oder dem Laden wählt
// man, wie ein Schlag geteilt wird — Achtel, Sechzehntel, Triolen oder Swing
// mit Regler (wie lang die erste Achtel ist, 50–75 % des Viertels). Nach der
// Aufnahme bleibt die Wahl umlegbar (dieselbe Spur, neu gelesen); die App
// misst den Swing der Aufnahme und bietet ihn an.

export type EinspielQuelle = 'mikro' | 'datei' | 'leer';
type Phase = 'bereit' | 'zaehlt' | 'nimmt' | 'rechnet' | 'vorschlag';

// Die Einteilung (früher die Feinheit 8 oder 16) und der Swing-Anteil — nur am Gerät.
const FEINHEIT_SCHLUESSEL = 'ueben:einspiel-feinheit';
const SWING_SCHLUESSEL = 'ueben:einspiel-swing';
const LESART_SCHLUESSEL = 'ueben:einspiel-lesart';
const KLICK_SCHLUESSEL = 'ueben:einspiel-klick';
const TONART_SCHLUESSEL = 'ueben:einspiel-tonart';
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

// Audio und Video (nur die Tonspur wird gelesen) — was der Browser dekodieren kann.
const ACCEPT = 'audio/*,video/*,.m4a,.mp3,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.opus,.flac,.webm,.mp4,.m4v,.mov';
const istMedium = (f: File) => /^(audio|video)\//.test(f.type) || /\.(m4a|mp3|wav|aac|aif|aiff|caf|ogg|oga|opus|flac|webm|mp4|m4v|mov)$/i.test(f.name);
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
// Entwurf: Noten von außen (MusicXML aus einer Erkennungs-App, G-11) —
// Speichern legt ein neues Stück an, das Original bleibt.
export interface Entwurf { gelesen: Gelesen; titel: string }

export function EinspielenDialog({ quelle: quelleStart, sammlungen, tags, vorlage, entwurf, rahmen, fertig, schliessen }: {
  quelle: EinspielQuelle;
  sammlungen: string[]; tags: string[];
  vorlage?: Vorlage;
  entwurf?: Entwurf;
  // Akkordrahmen (aus der Jam-Karte): leere Takte mit Akkorden darüber, Begleitung beim Vorspielen und Aufnehmen.
  rahmen?: Rahmen;
  fertig: (meldung: string) => void;
  schliessen: () => void;
}) {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  // Noten, mit denen das Blatt anfängt: ein gespeichertes Stück oder ein Entwurf von außen.
  const grundlage = vorlage?.gelesen ?? entwurf?.gelesen;
  const komponieren = !!(grundlage || rahmen);
  const [quelle, setQuelle] = useState<EinspielQuelle>(komponieren ? 'leer' : quelleStart);
  const [phase, setPhase] = useState<Phase>(komponieren || quelleStart === 'leer' ? 'vorschlag' : 'bereit');
  // Raster: Vorgaben vom Metronom (bei einer Vorlage: aus ihr), hier nur für diese Aufnahme geändert.
  const [bpm, setBpmRoh] = useState(grundlage ? grundlage.raster.bpm : metro.bpm);
  const setBpm = (n: number) => setBpmRoh(Math.min(300, Math.max(20, Math.round(n))));
  // Das Tempo-Feld: frei tippen (Text nur während der Eingabe), übernommen
  // und begrenzt beim Verlassen oder mit Enter.
  const [tempoText, setTempoText] = useState<string | null>(null);
  const tempoUebernehmen = () => { const n = Number(tempoText); if (n) setBpm(n); setTempoText(null); };
  const [taktart, setTaktart] = useState<[number, Nenner]>(grundlage ? [grundlage.raster.zaehler, grundlage.raster.nenner] : rahmen ? [4, 4] : [metro.takt, metro.nenner]);
  // Rhythmus der Erkennung: Einteilung und Swing-Anteil.
  const [rhythmus, setRhythmusRoh] = useState<Rhythmus>(() => ({
    einteilung: einteilungLesen(gespeichert<unknown>(FEINHEIT_SCHLUESSEL, 16)), anteil: anteilLesen(gespeichert<unknown>(SWING_SCHLUESSEL, 60)),
  }));
  const setRhythmus = (neu: Partial<Rhythmus>) => {
    const r = { ...rhythmus, ...neu };
    if (r.einteilung !== rhythmus.einteilung) speichern(FEINHEIT_SCHLUESSEL, r.einteilung);
    if (r.anteil !== rhythmus.anteil) speichern(SWING_SCHLUESSEL, r.anteil);
    setRhythmusRoh(r);
  };
  // Lesart der Erkennung: melodisch (gehaltene Töne) oder rhythmisch (kurze Töne, Schwellen folgen dem Tempo).
  const [lesart, setLesartRoh] = useState<Lesart>(() => (gespeichert<string>(LESART_SCHLUESSEL, 'melodisch') === 'rhythmisch' ? 'rhythmisch' : 'melodisch'));
  const setLesart = (l: Lesart) => { setLesartRoh(l); speichern(LESART_SCHLUESSEL, l); };
  const [klickWeiter, setKlickWeiterRoh] = useState(() => gespeichert(KLICK_SCHLUESSEL, true));
  const setKlickWeiter = (an: boolean) => { setKlickWeiterRoh(an); speichern(KLICK_SCHLUESSEL, an); };
  // Lautsprecher (B-20): eine Wahl fürs ganze Gerät, auch in der Aufnahmeleiste.
  const [lautsprecher, setLautsprecher] = useLautsprecher();
  // Tonart (notiert, wie das Stimmgerät zeigt): zieht die Töne auf die Leiter
  // und setzt die Vorzeichen; leer = keine Tonart, Töne bleiben, wie gehört.
  const [tonartAbc, setTonartAbcRoh] = useState(() => (grundlage ? grundlage.tonart?.abc ?? '' : rahmen ? rahmen.tonart?.abc ?? '' : gespeichert<string>(TONART_SCHLUESSEL, 'C')));
  const setTonartAbc = (a: string) => { setTonartAbcRoh(a); speichern(TONART_SCHLUESSEL, a); setTonartBlatt(null); };
  const tonart = useMemo(() => tonartFinden(tonartAbc), [tonartAbc]);
  // Tonart des Blatts nach dem Transponieren (null: wie die Erkennung). Nur
  // für Anzeige und Speichern — die Erkennung behält ihre Tonart, sonst würde
  // jedes Transponieren den Vorschlag neu rastern und Bearbeitungen verwerfen.
  const [tonartBlatt, setTonartBlatt] = useState<string | null>(null);
  const tonartAnzeige = useMemo(() => tonartFinden(tonartBlatt ?? tonartAbc), [tonartBlatt, tonartAbc]);
  const tonartBlattRef = useRef(tonartBlatt);
  useEffect(() => { tonartBlattRef.current = tonartBlatt; }, [tonartBlatt]);
  const raster = useMemo<Raster>(() => erkennungsRaster({ bpm, zaehler: taktart[0], nenner: taktart[1] }, rhythmus), [bpm, taktart, rhythmus]);
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
  const [titel, setTitel] = useState(vorlage?.stueck.titel ?? entwurf?.titel ?? rahmen?.titel ?? '');
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
  // Nach der Einteilung (Achtel, Sechzehntel, Triolen, Swing) gerundet, aufs Blattraster (96 Zellen) gebracht.
  const abStart = useMemo(() => (phase !== 'vorschlag' || quelle === 'leer' ? [] : spur.map((f) => ({ ...f, zeit: f.zeit - start }))), [phase, quelle, spur, start]);
  const erkannt = useMemo(() => (abStart.length ? transkribieren(abStart, raster, rhythmus, { tonart, lesart }).takte : []), [abStart, raster, rhythmus, tonart, lesart]);
  // Der Swing der Aufnahme, aus dem Gesamtbild gemessen (null: zu wenige Achtelpaare).
  const gemessen = useMemo(() => (abStart.length ? swingSchaetzen(abStart, raster, lesart) : null), [abStart, raster, lesart]);
  const blattRaster = useMemo(() => aufBlatt(raster), [raster]);
  // Schreiben: ein leerer Takt in der Taktart (Tempo und Tonart ändern das Blatt nicht).
  const [zaehler, nenner] = taktart;
  // Swing des Blatts: bei Aufnahme und Datei aus der Wahl; beim Schreiben aus dem Stück (oder einer Aufnahme im Stück).
  const [swingLeer, setSwingLeer] = useState(grundlage?.swing ?? 0);
  // Was gilt (Triolen und Swing gibt es in 6/8 nicht — dann Sechzehntel).
  const wirkt: Einteilung = wirksam(rhythmus, zaehler, nenner).einteilung;
  const blattSwing = quelle === 'leer' ? swingLeer : swingAnteil(rhythmus, zaehler, nenner);
  const leer = useMemo(() => {
    const b = aufBlatt({ bpm: 60, zaehler, nenner, feinheit: 16 });
    return rahmen?.akkorde.length ? rahmenTakte(rahmen.akkorde, b) : leeresBlatt(b);
  }, [zaehler, nenner, rahmen]);
  // Grundlage als eine Stimme; mehr Stimmen kommen im Notenblatt dazu.
  const basisLeer = useMemo(() => einstimmig(leer), [leer]);
  const basisErkannt = useMemo(() => einstimmig(erkannt), [erkannt]);
  const basis = quelle === 'leer' ? basisLeer : basisErkannt;
  // Bearbeitet im Notenblatt — gilt, solange die Grundlage dieselbe ist
  // (neue Aufnahme, anderes Raster: alles von vorn).
  const [bearbeitet, setBearbeitet] = useState<{ basis: Stimme[]; stimmen: Stimme[] } | null>(
    () => (grundlage ? { basis: basisLeer, stimmen: aufsBlattStimmen(grundlage.stimmen, grundlage.raster.feinheit, grundlage.raster) } : null));
  const stimmen = bearbeitet && bearbeitet.basis === basis ? bearbeitet.stimmen : basis;
  const takte = stimmen[0]?.takte ?? [];
  // Akkordsymbole je Takt (Leadsheet): aus dem Rahmen oder der Vorlage; sie bleiben bei ihren Takten (akkordeNachfuehren).
  const [akkorde, setAkkorde] = useState<string[][]>(() => rahmen?.akkorde ?? grundlage?.akkorde ?? []);
  const akkordeRef = useRef(akkorde);
  useEffect(() => { akkordeRef.current = akkorde; }, [akkorde]);
  const [stil, setStil] = useState<BegleitStil>(() => rahmen?.begleitung ?? (istStil(grundlage?.begleitung) ? grundlage.begleitung : 'swing'));
  const hatAkkorde = akkorde.some((x) => x.length);
  // Verlauf für Rückgängig/Wiederherstellen — je Eintrag mit seiner Grundlage,
  // ein Eintrag aus einer anderen Grundlage (neue Aufnahme) zählt nicht.
  type Schritt = { basis: Stimme[]; stimmen: Stimme[]; tonart: string | null; akkorde: string[][] };
  const verlauf = useRef<{ zurueck: Schritt[]; vor: Schritt[] }>({ zurueck: [], vor: [] });
  // Ob es etwas zurück- oder vorzugehen gibt (für die Knöpfe) — als Zustand, nicht aus dem Ref gelesen.
  const [kann, setKann] = useState({ zurueck: false, vor: false });
  const stimmenRef = useRef(stimmen);
  useEffect(() => { stimmenRef.current = stimmen; }, [stimmen]);
  const kannNeu = useCallback((b: Stimme[]) => {
    const v = verlauf.current;
    setKann({ zurueck: v.zurueck.some((e) => e.basis === b), vor: v.vor.some((e) => e.basis === b) });
  }, []);
  const aendern = useCallback((neu: Stimme[], neueAkkorde?: string[][]) => {
    const v = verlauf.current;
    v.zurueck.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current, akkorde: akkordeRef.current });
    if (v.zurueck.length > 200) v.zurueck.shift();
    v.vor = [];
    const akk = neueAkkorde ?? akkordeNachfuehren(stimmenRef.current, neu, akkordeRef.current);
    stimmenRef.current = neu;
    akkordeRef.current = akk;
    setBearbeitet({ basis, stimmen: neu });
    setAkkorde(akk);
    kannNeu(basis);
  }, [basis, kannNeu]);
  const zurueck = () => {
    const v = verlauf.current;
    const e = v.zurueck.pop();
    if (!e || e.basis !== basis) { if (e) v.zurueck.push(e); return; }
    v.vor.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current, akkorde: akkordeRef.current });
    stimmenRef.current = e.stimmen;
    akkordeRef.current = e.akkorde;
    setBearbeitet({ basis, stimmen: e.stimmen });
    setAkkorde(e.akkorde);
    setTonartBlatt(e.tonart);
    kannNeu(basis);
  };
  const vor = () => {
    const v = verlauf.current;
    const e = v.vor.pop();
    if (!e || e.basis !== basis) { if (e) v.vor.push(e); return; }
    v.zurueck.push({ basis, stimmen: stimmenRef.current, tonart: tonartBlattRef.current, akkorde: akkordeRef.current });
    stimmenRef.current = e.stimmen;
    akkordeRef.current = e.akkorde;
    setBearbeitet({ basis, stimmen: e.stimmen });
    setAkkorde(e.akkorde);
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
    const sw = swingAnteil(rhythmus, raster.zaehler, raster.nenner);
    if (sw) setSwingLeer(sw);
    const s = blattStand.aktiv;
    setAuswahlVorgabe({ stimme: s, takt: Math.min(naechsterTakt, Math.max(0, (neu[s]?.takte.length ?? 1) - 1)), note: 0 });
  }, [aendern, blattStand.aktiv, rhythmus, raster.zaehler, raster.nenner]);

  // Begleitung aus den Akkorden beim Aufnehmen: Klänge ab `ziel − vor` bis `ziel + n` Takte, Zeit ab dem Zieltakt.
  const begleitKlaenge = useCallback((ziel: number, vor: number, n: number): Klang[] => {
    if (!hatAkkorde) return [];
    const schlaege = schlaegeJeTakt(raster.zaehler, raster.nenner), td = taktDauer(raster);
    const voll = Array.from({ length: Math.max(takte.length, ziel + n) }, (_, i) => akkorde[i] ?? []);
    return alsKlaenge(begleitungBauen(akkordTakte(voll), stil, { schlaege, schleife: false }), raster.bpm, { schlaege, ab: Math.max(0, ziel - vor), bis: ziel + n })
      .map((k) => ({ ...k, beginn: k.beginn - Math.min(vor, ziel) * td }));
  }, [hatAkkorde, raster, takte.length, akkorde, stil]);

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
      raster: rasterRef.current, klickWeiter, metro: { klang: metro.klang, laut: metro.laut, zweiVier: metro.swing.zweiVier },
      stimmung: einst.current.stimmung, kammerton: einst.current.kammerton,
      einzaehlTakte: 1, vorlauf: null, maxTakte: MAX_TAKTE,
      beiPhase: setPhase,
      beiFortschritt: (liste, rel) => zeichnen(liste, Math.max(0, rel)),
      beiEnde: (liste, ok) => { if (ok) { setSpur(liste); setStart(0); setPhase('vorschlag'); } else setPhase('bereit'); },
      beiFehler: setFehler,
    });
  }, [mikrofonStarten, metro.klang, metro.laut, metro.swing.zweiVier, klickWeiter, zeichnen]);

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
    wiedergabeSitzung();
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
    const mit = q === 'leer' && phase === 'vorschlag' && takte.length > 0;
    setBearbeitet(mit ? { basis: basisLeer, stimmen } : null);
    if (mit) setSwingLeer(blattSwing);
  };
  const nochmal = () => { wiedergabeAus(); setSpur([]); setStart(0); setDauer(0); setDateiName(''); setBearbeitet(null); setPhase('bereit'); };

  // ── Speichern: ABC → Seiten (JPEG) → PDF → Stück ──
  async function speichernUndSchliessen() {
    if (!takte.length || laeuft) return;
    setFehler('');
    const name = titel.trim() || vorlage?.stueck.titel || entwurf?.titel || (quelle === 'mikro' ? 'Eingesungen' : quelle === 'leer' ? 'Neues Stück' : dateiName.replace(/\.[^.]+$/, '') || 'Aus Audio');
    const text = alsAbcStimmen(stimmen, blattRaster, { titel: name, ...(hatAkkorde ? { begleitung: stil } : {}), ...(blattSwing ? { swing: blattSwing } : {}) }, tonartAnzeige, akkorde);
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
        notation: { format: 'abc', text, art: entwurf || quelle === 'leer' ? 'geschrieben' : quelle === 'mikro' ? 'eingesungen' : 'audio' },
      });
      fertig(`„${name}“ mit ${takte.length} ${takte.length === 1 ? 'Takt' : 'Takten'} angelegt${sammlungen.length ? `, in „${sammlungen.join(', ')}“` : ''}.`);
    } catch (x) {
      setFehler(`Speichern ging nicht: ${fehlerGrund(x)}`);
      setLaeuft(null);
    }
  }

  const beschaeftigt = phase === 'zaehlt' || phase === 'nimmt' || phase === 'rechnet' || !!laeuft || leisteBeschaeftigt;

  // Ziehen und Ablegen: eine Audio- oder Video-Datei auf den Dialog werfen —
  // wechselt zur Quelle „Audio-Datei“ und liest sie (nicht beim Komponieren
  // und nicht, solange etwas läuft).
  const [zieht, setZieht] = useState(false);
  const ablegenMoeglich = !komponieren && !beschaeftigt;
  const ziehen = (e: React.DragEvent) => {
    if (!ablegenMoeglich || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setZieht(true);
  };
  const ablegen = (e: React.DragEvent) => {
    setZieht(false);
    if (!ablegenMoeglich) return;
    const f = Array.from(e.dataTransfer.files)[0];
    if (!f) return;
    e.preventDefault();
    if (!istMedium(f)) { setFehler(`„${f.name}“ ist keine Audio- oder Video-Datei.`); return; }
    if (quelle !== 'datei') { stoppen(false); wiedergabeAus(); setQuelle('datei'); setSpur([]); setStart(0); setDauer(0); setDateiName(''); setBearbeitet(null); }
    else wiedergabeAus();
    void dateiLaden(f);
  };
  useEscape(() => { if (!beschaeftigt) schliessen(); });
  useEffect(() => () => { stoppen(false); wiedergabeAus(); }, [stoppen, wiedergabeAus]);

  const mikroAktiv = phase === 'zaehlt' || phase === 'nimmt';
  // Mikrofon: ab dem Einzähler ist das Raster fest (die Spur ist dagegen
  // aufgenommen). Schreiben: Taktart und kleinster Wert, sobald etwas auf
  // dem Blatt steht — sonst wäre es weg; das Tempo bleibt frei.
  const festesTempo = quelle === 'mikro' && phase !== 'bereit';
  const festesRaster = festesTempo || (quelle === 'leer' && (!!bearbeitet || !!rahmen));
  const stimmungHinweis = stimm.stimmung !== 'C' ? ` · notiert für ${stimm.stimmung}-Instrument` : '';

  return createPortal(
    <div className="scan-dialog" role="dialog" aria-modal="true" aria-label="Selbst schreiben, einsingen oder Audio laden" ref={fokus} tabIndex={-1}>
      <div className="panel-kopf mit-linie">
        <h2>{komponieren ? 'Komponieren' : quelle === 'mikro' ? 'Einsingen' : quelle === 'leer' ? 'Schreiben' : 'Aus Audio'}</h2>
        <span className="bib-anzahl">{phase === 'vorschlag' && takte.length ? `· ${takte.length} ${takte.length === 1 ? 'Takt' : 'Takte'}` : ''}</span>
        <span className="flex-1" />
        <button type="button" className="panel-zu" onClick={schliessen} disabled={beschaeftigt} aria-label="Abbrechen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>

      {/* Mitte: Inhalt scrollt; die Aufnahmeleiste liegt darüber am unteren Rand, der Fuß mit „Speichern“ bleibt frei. */}
      <div className={`scan-mitte ${zieht ? 'zieht' : ''}`} onDragOver={ziehen} onDragEnter={ziehen} onDragLeave={(e) => { if (e.currentTarget === e.target) setZieht(false); }} onDrop={ablegen}>
      <div className="scan-inhalt" style={leiste ? { paddingBottom: '10rem' } : undefined}>
        {fehler && <p className="karte warnung" role="alert">{fehler}</p>}

        {!komponieren && (
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
              <div className="einspiel-feld einspiel-rhythmus">
                <span>Rhythmus</span>
                <div className="segment !mx-0" role="group" aria-label="Rhythmus der Erkennung: wie ein Schlag geteilt wird">
                  {EINTEILUNGEN.map((e) => (
                    <button key={e.einteilung} type="button" aria-pressed={wirkt === e.einteilung} disabled={!einteilungMoeglich(e.einteilung, zaehler, nenner)}
                      onClick={() => setRhythmus({ einteilung: e.einteilung })} title={e.hinweis}>{e.name}</button>
                  ))}
                </div>
              </div>
              <SwingWahl anteil={rhythmus.anteil} an={wirkt === 'swing'} moeglich={einteilungMoeglich('swing', zaehler, nenner)}
                setzen={(anteil) => setRhythmus({ einteilung: 'swing', anteil })} gemessen={gemessen} hatSpur={abStart.length > 0} />
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
              <label className="einspiel-feld" title="Gilt fürs ganze Gerät (Einstellungen)">
                <span>Lautsprecher</span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={lautsprecher} disabled={mikroAktiv} onChange={(e) => setLautsprecher(e.target.checked)} />
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
                <p className="gedaempft text-xs">Lautsprecher an: wie Freisprechen — der Klick kommt aus dem Lautsprecher und bleibt aus der Aufnahme draußen, das Mikrofon hört auch aus etwas Abstand. Aus: das rohe Mikrofon für Kopfhörer — ohne Kopfhörer nah am Mund singen, der Klick kommt dann leise aus dem Hörer.</p>
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
                <button type="button" className="knopf" onClick={() => void audioWaehlen().then((f) => f && dateiLaden(f))}>Audio- oder Video-Datei wählen</button>
                <p className="gedaempft text-sm">Sprachmemo (m4a), mp3, wav, aac, flac, ogg — oder ein Video (mp4, mov): gelesen wird die Tonspur. Eine Stimme, kein ganzer Song; höchstens fünf Minuten. Am Rechner oder iPad die Datei einfach hierher ziehen. Vom iPhone: Sprachmemo teilen → „In Dateien sichern“, dann hier wählen{stimmungHinweis}.</p>
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
                  beiStand={setBlattStand} auswahlVorgabe={auswahlVorgabe}
                  akkorde={akkorde} begleitung={{ stil, setzen: setStil }} swing={blattSwing} />
              : (
                <div className="einspiel-zeile">
                  <p className="gedaempft text-sm">Kein Ton erkannt. Näher ans Mikrofon, lauter, oder eine andere Datei.</p>
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aendern(basisLeer)}>Trotzdem schreiben</button>
                </div>
              )}
            {quelle !== 'leer' && <p className="gedaempft text-xs">Ein Vorschlag — die Erkennung ist nie fehlerfrei; hier lässt er sich korrigieren. Die Quelle (ABC) bleibt am Stück.</p>}
            {entwurf && <p className="gedaempft text-xs">Ein Entwurf aus der Notenerkennung — mit dem Original vergleichen; rote Takte stimmen nicht mit der Taktart. Transponieren: Mehr → „Transponieren · alle Stimmen“. „Als Stück speichern“ legt ein neues Stück an, das Original bleibt.</p>}
            {rahmen && <p className="gedaempft text-xs">▶ spielt die Begleitung aus den Akkorden, ● nimmt ab dem gewählten Takt auf — die Begleitung läuft mit (am besten mit Kopfhörer). Akkorde und Stil: Mehr → Akkorde.</p>}
          </div>
        )}
      </div>
      {leiste && phase === 'vorschlag' && quelle === 'leer' && (
        <Aufnahmeleiste stimmen={stimmen} aktiv={blattStand.aktiv} stumm={blattStand.stumm} auswahlTakt={blattStand.auswahl?.takt ?? null}
          raster={raster} blattRaster={blattRaster} tonart={tonart} lesart={lesart} setLesart={setLesart} rhythmus={rhythmus} setRhythmus={setRhythmus}
          metro={{ klang: metro.klang, laut: metro.laut, zweiVier: metro.swing.zweiVier }} stimmung={stimm.stimmung} kammerton={stimm.kammerton}
          vorschauAendern={setVorschau} zustandAendern={setLeistenZustand} uebernehmen={leisteUebernehmen} schliessen={leisteSchliessen}
          akkordBegleitung={hatAkkorde ? begleitKlaenge : undefined} />
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

// Swing-Regler (G-12): wie lang die erste Achtel eines Viertels ist (50 %
// gerade … 67 % triolisch … 75 %). Das Bild zeigt ein Viertel, geteilt in
// lang und kurz, mit Strichen bei 50 % und 67 %. Den Regler bewegen schaltet
// auf Swing. Nach einer Aufnahme steht darunter, was die App darin misst,
// mit „Übernehmen“. Die Zeile ist immer da und behält ihre Höhe — nichts
// rückt, wenn die Wahl wechselt.
function SwingWahl({ anteil, an, moeglich, setzen, gemessen, hatSpur }: {
  anteil: number; an: boolean; moeglich: boolean; setzen: (anteil: number) => void; gemessen: number | null; hatSpur: boolean;
}) {
  // Der Knopf steht da, sobald es einen Swing zu übernehmen gibt, und wird nur
  // unsichtbar, wenn er schon gilt — so bleibt die Zeile gleich hoch.
  const angebot = moeglich && hatSpur && gemessen !== null && gemessen > 53;
  const uebernehmen = angebot && (!an || Math.abs(gemessen - anteil) >= 2);
  const text = !moeglich ? 'In dieser Taktart ist der Schlag schon dreigeteilt — kein Swing, keine Triolen.'
    : hatSpur && gemessen !== null ? (gemessen <= 53 ? `In der Aufnahme: gerade Achtel (≈ ${gemessen} %).` : `In der Aufnahme: Achtel lang-kurz, ≈ ${gemessen} %.`)
      : hatSpur ? 'In der Aufnahme sind zu wenige Achtelpaare, um den Swing zu messen.'
        : an ? 'Die erste Achtel jedes Viertels ist lang: 50 % gerade, 60 % locker, 67 % triolisch. Geschrieben wird gerade, mit „Swing“ über dem Stück.'
          : 'Regler bewegen schaltet auf Swing. Nach der Aufnahme misst die App, wie stark es swingt.';
  return (
    <div className={`einspiel-swing ${an ? '' : 'aus'}`} role="group" aria-label="Swing">
      <span className="einspiel-swing-name">Swing {an ? `${anteil} %` : 'aus'}</span>
      <div className="einspiel-swingbild" aria-hidden="true">
        <span style={{ width: `${anteil}%` }}>lang</span>
        <span>kurz</span>
        <i style={{ left: '50%' }} /><i style={{ left: `${200 / 3}%` }} />
      </div>
      <span />
      <input className="regler" type="range" min={ANTEIL_MIN} max={ANTEIL_MAX} step={1} value={anteil} disabled={!moeglich}
        onChange={(e) => setzen(Number(e.target.value))} aria-label="Swing: Anteil der ersten Achtel am Viertel" aria-valuetext={`${anteil} Prozent`} />
      <p className="einspiel-swing-hinweis gedaempft text-xs" aria-live="polite">
        {text}
        {angebot && (
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setzen(gemessen!)} disabled={!uebernehmen}
            style={uebernehmen ? undefined : { visibility: 'hidden' }} aria-hidden={!uebernehmen}>Swing {gemessen} % übernehmen</button>
        )}
      </p>
    </div>
  );
}
