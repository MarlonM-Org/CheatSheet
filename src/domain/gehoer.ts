// Ohr-Trainer (I-01): Die App spielt eine kurze Phrase vor, man spielt sie
// nach, die Tonerkennung hört zu. Hier stehen die Stufen, das Erzeugen der
// Phrasen (mit Startwert, damit Tests und „Nochmal" dieselbe Phrase liefern),
// die Klänge fürs Vorspielen und die Bewertung des Gespielten. Alle Töne sind
// notiert (wie das Stimmgerät sie anzeigt), als MIDI-Zahl. Rein, getestet.

import type { Klang } from './notensatz';
import type { Tonstueck } from './notation';
import { tonName } from './tonprofil';

export type StufenId = 'drei' | 'fuenf' | 'leiter' | 'dreiklang' | 'rhythmus' | 'chromatisch';

export interface Stufe {
  id: StufenId;
  name: string;
  hinweis: string;
  // Erlaubte Abstände zum Grundton in Halbtönen.
  toene: readonly number[];
  // Größter Sprung zwischen zwei Tönen (Halbtöne).
  sprung: number;
  // Töne je Phrase.
  laenge: number;
  takte: 1 | 2;
  // Achtel erlaubt (sonst nur Viertel, der letzte Ton füllt auf).
  achtel: boolean;
  // Chromatische Durchgänge: leiterfremde Töne nur als Halbtonschritt zu einem Leiterton.
  chromatisch?: true;
}

const DUR = [0, 2, 4, 5, 7, 9, 11, 12];

export const STUFEN: readonly Stufe[] = [
  { id: 'drei', name: 'Drei Töne', hinweis: 'Grundton, 2. und 3. Stufe, nur Schritte', toene: [0, 2, 4], sprung: 2, laenge: 3, takte: 1, achtel: false },
  { id: 'fuenf', name: 'Fünf Töne', hinweis: 'Grundton bis Quinte, Schritte und Terzen', toene: [0, 2, 4, 5, 7], sprung: 4, laenge: 4, takte: 1, achtel: false },
  { id: 'leiter', name: 'Dur-Tonleiter', hinweis: 'ganze Oktave, Sprünge bis zur Quinte', toene: DUR, sprung: 7, laenge: 5, takte: 2, achtel: false },
  { id: 'dreiklang', name: 'Dreiklänge', hinweis: 'Akkordtöne und Oktave, große Sprünge', toene: [-5, 0, 4, 7, 12], sprung: 12, laenge: 5, takte: 2, achtel: false },
  { id: 'rhythmus', name: 'Mit Rhythmus', hinweis: 'Dur-Tonleiter mit Achteln', toene: DUR, sprung: 5, laenge: 6, takte: 2, achtel: true },
  { id: 'chromatisch', name: 'Chromatisch', hinweis: 'Durchgangstöne zwischen den Leitertönen', toene: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], sprung: 4, laenge: 6, takte: 2, achtel: true, chromatisch: true },
];

export const stufeFinden = (id: string): Stufe => STUFEN.find((s) => s.id === id) ?? STUFEN[0];

// Bequemer Umfang einer B-Klarinette, notiert: E3 … A5.
export const UMFANG = { von: 52, bis: 81 } as const;
// Wählbare Grundtöne (notiert): G3 … G4 — darüber reicht die Oktave nicht mehr in den Umfang.
export const GRUNDTOENE = { von: 55, bis: 67 } as const;
// Ruhetöne: Anfang und Ende einer Phrase (Grundton, Terz, Quinte, Oktave).
const RUHE = new Set([0, 4, 7, 12, -5]);
const LEITER = new Set([0, 2, 4, 5, 7, 9, 11]);
const inLeiter = (abstand: number) => LEITER.has(((abstand % 12) + 12) % 12);

// Kleiner, reproduzierbarer Zufall (mulberry32).
export function zufall(startwert: number): () => number {
  let a = startwert >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const waehle = <T>(liste: readonly T[], z: () => number): T => liste[Math.min(liste.length - 1, Math.floor(z() * liste.length))];

// Ein Ton der Phrase: notierte Höhe und Dauer in Schlägen (Viertel = 1).
export interface PhrasenTon { midi: number; dauer: number }
export interface Phrase { stufe: StufenId; grundton: number; takte: 1 | 2; toene: PhrasenTon[] }

export const SCHLAEGE_JE_TAKT = 4;

// Dauern: Viertel (und Achtel), der letzte Ton füllt bis zum Ende der Phrase
// (mindestens ein Schlag — eine Phrase endet auf einem gehaltenen Ton).
export function dauern(anzahl: number, takte: number, achtel: boolean, z: () => number): number[] {
  const gesamt = takte * SCHLAEGE_JE_TAKT;
  const d: number[] = [];
  let summe = 0;
  const mindest = achtel ? 0.5 : 1;
  for (let i = 0; i < anzahl - 1; i++) {
    const uebrig = anzahl - 1 - i;              // noch zu setzende Töne vor dem letzten, dieser eingeschlossen
    const platz = gesamt - summe - 1 - (uebrig - 1) * mindest;   // höchstens so lang, damit alle passen und der letzte ≥ 1 Schlag bleibt
    let wert: number;
    if (!Number.isInteger(summe)) wert = 0.5;   // Achtel immer paarweise: zurück auf den Schlag
    else if (achtel && uebrig >= 2 && z() < 0.45) wert = 0.5;
    else if (z() < 0.25 && platz >= 2) wert = 2;
    else wert = 1;
    if (wert > platz) wert = mindest;
    d.push(wert);
    summe += wert;
  }
  d.push(gesamt - summe);
  return d;
}

// Eine Phrase der Stufe zum Grundton (notiert). Beginnt und endet auf einem
// Ruheton, keine Tonwiederholung, alles im Umfang.
export function phraseErzeugen(stufeId: StufenId, grundton: number, startwert: number): Phrase {
  const stufe = stufeFinden(stufeId);
  const z = zufall(startwert);
  const imUmfang = (a: number) => grundton + a >= UMFANG.von && grundton + a <= UMFANG.bis;
  const erlaubt = stufe.toene.filter(imUmfang);
  const ruhe = erlaubt.filter((a) => RUHE.has(a));
  for (let versuch = 0; versuch < 200; versuch++) {
    const folge: number[] = [waehle(ruhe.length ? ruhe : erlaubt, z)];
    let ok = true;
    for (let i = 1; i < stufe.laenge && ok; i++) {
      const vorher = folge[i - 1];
      const letzter = i === stufe.laenge - 1;
      let kandidaten = erlaubt.filter((a) => a !== vorher && Math.abs(a - vorher) <= stufe.sprung);
      if (stufe.chromatisch) {
        // Nach einem leiterfremden Ton: Halbtonschritt zu einem Leiterton.
        if (!inLeiter(vorher)) kandidaten = kandidaten.filter((a) => Math.abs(a - vorher) === 1 && inLeiter(a));
        // Leiterfremd nur, wenn danach noch ein Ton kommt.
        if (letzter) kandidaten = kandidaten.filter(inLeiter);
      }
      if (letzter) kandidaten = kandidaten.filter((a) => RUHE.has(a));
      if (!kandidaten.length) { ok = false; break; }
      // Schritte bevorzugen: Kandidaten nach Abstand gewichtet.
      const gewichte = kandidaten.map((a) => 1 / Math.abs(a - vorher));
      let r = z() * gewichte.reduce((x, y) => x + y, 0);
      let k = 0;
      while (k < kandidaten.length - 1 && r > gewichte[k]) { r -= gewichte[k]; k++; }
      folge.push(kandidaten[k]);
    }
    if (!ok) continue;
    const d = dauern(folge.length, stufe.takte, stufe.achtel, z);
    return { stufe: stufe.id, grundton, takte: stufe.takte, toene: folge.map((a, i) => ({ midi: grundton + a, dauer: d[i] })) };
  }
  // Rückfall (kommt bei den festen Stufen nicht vor): die Tonleiter hinauf.
  const folge = erlaubt.slice(0, stufe.laenge);
  const d = dauern(folge.length, stufe.takte, false, z);
  return { stufe: stufe.id, grundton, takte: stufe.takte, toene: folge.map((a, i) => ({ midi: grundton + a, dauer: d[i] })) };
}

// Einsätze der Töne in Schlägen ab Phrasenbeginn.
export function einsaetze(p: Phrase): number[] {
  const e: number[] = [];
  let t = 0;
  for (const ton of p.toene) { e.push(t); t += ton.dauer; }
  return e;
}

// Klänge fürs Vorspielen; `beginn` in Sekunden ab `ab` (für den Vorlauf vor
// dem Einsatz: ab = −Phrasendauer). Leicht abgesetzt, damit man die Töne zählt.
export function phraseKlaenge(p: Phrase, bpm: number, ab = 0): Klang[] {
  const schlag = 60 / bpm;
  const e = einsaetze(p);
  return p.toene.map((t, i) => ({ beginn: ab + e[i] * schlag, dauer: t.dauer * schlag * 0.9, midi: t.midi }));
}

export const phraseDauer = (p: Phrase, bpm: number) => p.takte * SCHLAEGE_JE_TAKT * 60 / bpm;

// Zwischen Vorspiel und Antwort zählt die App noch einmal einen Takt ein —
// erst hören, kurz sortieren, dann eingezählt einsetzen (Wunsch 2026-11-16).
export const ANTWORT_EINZAEHLEN = 1;

// Vorlauf für die Mikrofon-Spur: Phrase, danach ein leerer Takt nur mit Klick.
export function vorlaufFuerRunde(p: Phrase, bpm: number): { klaenge: Klang[]; takte: number } {
  const takt = SCHLAEGE_JE_TAKT * 60 / bpm;
  return { klaenge: phraseKlaenge(p, bpm, -(phraseDauer(p, bpm) + ANTWORT_EINZAEHLEN * takt)), takte: p.takte + ANTWORT_EINZAEHLEN };
}

// Grundton für die nächste Runde: fest oder, beim Wechseln, ein anderer
// Leiter-Grundton (notiert) als zuletzt.
export function naechsterGrundton(aktuell: number, wechseln: boolean, z: () => number): number {
  if (!wechseln) return aktuell;
  const moeglich: number[] = [];
  for (let m = GRUNDTOENE.von; m <= GRUNDTOENE.bis; m++) if (m !== aktuell && LEITER.has(m % 12)) moeglich.push(m);
  return waehle(moeglich, z);
}

// ---- Bewertung ----

export type Art = 'richtig' | 'falsch' | 'fehlt';
export interface Bewertet { ziel: number; gespielt: number | null; art: Art; oktave?: true; imTakt?: boolean }
export interface Ergebnis { noten: Bewertet[]; zuviel: number; richtig: number; imTakt: number; quote: number }

// Toleranz für „im Takt": Einsatz höchstens so viele Schläge daneben.
export const TAKT_TOLERANZ = 1 / 3;

// Gespielte Tonstücke (Zeit ab dem Einsatz) gegen die Phrase. Ausrichtung per
// Editierdistanz über die Tonhöhe (Oktave egal: Registerfehler zählen als
// richtig, werden markiert); Ersetzen ist billiger als Auslassen + Einfügen,
// damit ein falscher Ton als falsch gilt und nicht als fehlt + zuviel.
export function bewerten(p: Phrase, stuecke: readonly Tonstueck[], bpm: number): Ergebnis {
  const schlag = 60 / bpm;
  const ende = phraseDauer(p, bpm) + 2 * schlag;
  const g = stuecke.filter((s) => s.start < ende).map((s) => ({ midi: Math.round(s.midi), start: s.start }));
  const z = p.toene.map((t) => t.midi);
  const gleich = (a: number, b: number) => ((a - b) % 12 + 12) % 12 === 0;
  const n = z.length, m = g.length;
  const kosten: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const ersetzen = kosten[i - 1][j - 1] + (gleich(z[i - 1], g[j - 1].midi) ? 0 : 1);
      kosten[i][j] = Math.min(ersetzen, kosten[i - 1][j] + 1, kosten[i][j - 1] + 1);
    }
  }
  const noten: Bewertet[] = [];
  let zuviel = 0;
  const e = einsaetze(p);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && kosten[i][j] === kosten[i - 1][j - 1] + (gleich(z[i - 1], g[j - 1].midi) ? 0 : 1)) {
      const ziel = z[i - 1], gespielt = g[j - 1];
      const treffer = gleich(ziel, gespielt.midi);
      const b: Bewertet = { ziel, gespielt: gespielt.midi, art: treffer ? 'richtig' : 'falsch', imTakt: Math.abs(gespielt.start / schlag - e[i - 1]) <= TAKT_TOLERANZ };
      if (treffer && ziel !== gespielt.midi) b.oktave = true;
      noten.unshift(b);
      i--; j--;
    } else if (i > 0 && kosten[i][j] === kosten[i - 1][j] + 1) {
      noten.unshift({ ziel: z[i - 1], gespielt: null, art: 'fehlt' });
      i--;
    } else {
      zuviel++;
      j--;
    }
  }
  const richtig = noten.filter((b) => b.art === 'richtig').length;
  const imTakt = noten.filter((b) => b.art === 'richtig' && b.imTakt).length;
  return { noten, zuviel, richtig, imTakt, quote: n ? richtig / n : 0 };
}

// Ein Satz, woran es lag — der wichtigste zuerst.
export function hinweis(e: Ergebnis): string {
  const n = e.noten.length;
  const gespielt = e.noten.filter((b) => b.gespielt !== null);
  if (!gespielt.length) return 'Nichts gehört — näher ans Mikrofon, lauter, oder nach dem Vorspiel direkt einsetzen.';
  if (e.richtig === n && e.zuviel === 0) {
    return e.imTakt === n ? 'Alles richtig und im Takt. Bereit für mehr?' : 'Alle Töne richtig — jetzt noch genau mit dem Klick einsetzen.';
  }
  if (e.noten[0].art !== 'richtig') return 'Der Anfang war daneben: Den ersten Ton vor dem Spielen innerlich singen, dann erst greifen.';
  // Richtung: Bewegung zwischen aufeinanderfolgenden gespielten Zielnoten.
  let richtungFalsch = 0, richtungen = 0;
  for (let k = 1; k < n; k++) {
    const a = e.noten[k - 1], b = e.noten[k];
    if (a.gespielt === null || b.gespielt === null) continue;
    richtungen++;
    if (Math.sign(b.ziel - a.ziel) !== Math.sign(b.gespielt - a.gespielt)) richtungFalsch++;
  }
  const fehlt = e.noten.filter((b) => b.art === 'fehlt').length;
  if (fehlt >= Math.max(2, n / 3)) return 'Einige Töne fehlen — lieber weiterspielen als anhalten, Fehler korrigierst du im nächsten Durchgang.';
  if (richtungen && richtungFalsch / richtungen >= 0.3) return 'Die Richtung stimmt oft nicht: Vor jedem Ton entscheiden — hoch oder runter?';
  if (e.zuviel > 1) return 'Zu viele Töne: nicht suchen, sondern entscheiden und spielen.';
  return 'Richtung stimmt, die Abstände noch nicht ganz: Schritt oder Sprung? Die Phrase einmal mitsingen.';
}

// ---- Verlauf und Steigerung ----

export interface Runde { am: number; stufe: StufenId; grundton: number; quote: number }
export const VERLAUF_MAX = 200;

export function rundeMerken(verlauf: readonly Runde[], r: Runde): Runde[] {
  return [...verlauf, r].slice(-VERLAUF_MAX);
}

// Vorschlag zur Stufe: fünf Runden im Schnitt ≥ 80 % → hoch; die letzten drei
// im Schnitt < 40 % → runter. Gezählt wird nur seit dem letzten Wechsel auf
// diese Stufe (die letzten Runden am Stück).
export function empfehlung(verlauf: readonly Runde[], stufe: StufenId): 'hoch' | 'runter' | null {
  const am: Runde[] = [];
  for (let k = verlauf.length - 1; k >= 0 && verlauf[k].stufe === stufe; k--) am.unshift(verlauf[k]);
  const schnitt = (l: Runde[]) => l.reduce((s, r) => s + r.quote, 0) / l.length;
  const i = STUFEN.findIndex((s) => s.id === stufe);
  if (am.length >= 5 && schnitt(am.slice(-5)) >= 0.8 && i < STUFEN.length - 1) return 'hoch';
  if (am.length >= 3 && schnitt(am.slice(-3)) < 0.4 && i > 0) return 'runter';
  return null;
}

export const nachbarStufe = (stufe: StufenId, richtung: 'hoch' | 'runter'): StufenId => {
  const i = STUFEN.findIndex((s) => s.id === stufe);
  return STUFEN[Math.max(0, Math.min(STUFEN.length - 1, i + (richtung === 'hoch' ? 1 : -1)))].id;
};

// Prüfen gelesener Werte (localStorage, Sicherung).
export const istStufe = (v: unknown): v is StufenId => typeof v === 'string' && STUFEN.some((s) => s.id === v);
export function verlaufLesen(v: unknown): Runde[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is Runde => !!r && typeof r === 'object' && typeof r.am === 'number' && istStufe(r.stufe)
    && Number.isInteger(r.grundton) && typeof r.quote === 'number' && r.quote >= 0 && r.quote <= 1).slice(-VERLAUF_MAX);
}

export const tonBezeichnung = (midi: number) => tonName(midi);
