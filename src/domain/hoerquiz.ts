// Hör-Übungen per Antippen (I-08): Die App spielt ein Intervall, einen
// Dreiklang oder einen Septakkord, man tippt die Antwort. Hier stehen die
// Stufen und Antwortoptionen, das Erzeugen einer Runde (mit Startwert, damit
// Tests und „Nochmal" dieselben Fragen liefern), die Klänge fürs Vorspielen und
// die Bewertung mit Verwechslungen. Alle Töne sind notiert (B-Klarinette, wie
// im Rest der App) als MIDI-Zahl; umgerechnet wird erst beim Spielen. Rein, getestet.

import { zufall } from './gehoer';
import type { Klang } from './notensatz';

export type HoerUebungId = 'intervalle' | 'dreiklaenge' | 'septakkorde';
export const HOER_UEBUNGEN: readonly HoerUebungId[] = ['intervalle', 'dreiklaenge', 'septakkorde'];
export type Richtung = 'auf' | 'ab' | 'zusammen' | 'gemischt';
export const RICHTUNGEN: readonly { id: Richtung; name: string }[] = [
  { id: 'auf', name: 'aufwärts' },
  { id: 'ab', name: 'abwärts' },
  { id: 'zusammen', name: 'zusammen' },
  { id: 'gemischt', name: 'gemischt' },
];

export interface Antwort { id: string; name: string; kurz: string; toene: readonly number[] }

const INTERVALLE: readonly Antwort[] = [
  { id: 'prime', name: 'Prime', kurz: 'P1', toene: [0] },
  { id: 'kl2', name: 'kleine Sekunde', kurz: 'kl. 2', toene: [0, 1] },
  { id: 'gr2', name: 'große Sekunde', kurz: 'gr. 2', toene: [0, 2] },
  { id: 'kl3', name: 'kleine Terz', kurz: 'kl. 3', toene: [0, 3] },
  { id: 'gr3', name: 'große Terz', kurz: 'gr. 3', toene: [0, 4] },
  { id: 'quarte', name: 'Quarte', kurz: 'Q4', toene: [0, 5] },
  { id: 'tritonus', name: 'Tritonus', kurz: 'Tritonus', toene: [0, 6] },
  { id: 'quinte', name: 'Quinte', kurz: 'Q5', toene: [0, 7] },
  { id: 'kl6', name: 'kleine Sexte', kurz: 'kl. 6', toene: [0, 8] },
  { id: 'gr6', name: 'große Sexte', kurz: 'gr. 6', toene: [0, 9] },
  { id: 'kl7', name: 'kleine Septime', kurz: 'kl. 7', toene: [0, 10] },
  { id: 'gr7', name: 'große Septime', kurz: 'gr. 7', toene: [0, 11] },
  { id: 'oktave', name: 'Oktave', kurz: 'Okt.', toene: [0, 12] },
];

const DREIKLAENGE: readonly Antwort[] = [
  { id: 'dur', name: 'Dur', kurz: 'Dur', toene: [0, 4, 7] },
  { id: 'moll', name: 'Moll', kurz: 'Moll', toene: [0, 3, 7] },
  { id: 'vermindert', name: 'vermindert', kurz: 'dim', toene: [0, 3, 6] },
  { id: 'uebermaessig', name: 'übermäßig', kurz: 'aug', toene: [0, 4, 8] },
];

const SEPTAKKORDE: readonly Antwort[] = [
  { id: 'maj7', name: 'maj7', kurz: 'maj7', toene: [0, 4, 7, 11] },
  { id: 'dom7', name: 'Dominantsept (7)', kurz: '7', toene: [0, 4, 7, 10] },
  { id: 'm7', name: 'm7', kurz: 'm7', toene: [0, 3, 7, 10] },
  { id: 'm7b5', name: 'halbvermindert (m7♭5)', kurz: 'm7♭5', toene: [0, 3, 6, 10] },
  { id: 'dim7', name: 'vermindert (dim7)', kurz: 'dim7', toene: [0, 3, 6, 9] },
];

const ALLE: Record<HoerUebungId, readonly Antwort[]> = { intervalle: INTERVALLE, dreiklaenge: DREIKLAENGE, septakkorde: SEPTAKKORDE };

// Welche Antworten je Stufe gelten (ids, in Anzeigereihenfolge der Liste oben).
const STUFEN: Record<HoerUebungId, readonly (readonly string[])[]> = {
  intervalle: [
    ['prime', 'quarte', 'quinte', 'oktave'],
    ['prime', 'kl3', 'gr3', 'quarte', 'quinte', 'kl6', 'gr6', 'oktave'],
    INTERVALLE.map((a) => a.id),
  ],
  dreiklaenge: [['dur', 'moll'], ['dur', 'moll', 'vermindert', 'uebermaessig']],
  septakkorde: [['maj7', 'dom7', 'm7'], ['maj7', 'dom7', 'm7', 'm7b5', 'dim7']],
};

export const UEBUNG_NAMEN: Record<HoerUebungId, string> = { intervalle: 'Intervalle', dreiklaenge: 'Dreiklänge', septakkorde: 'Septakkorde' };
export const stufenAnzahl = (u: HoerUebungId) => STUFEN[u].length;
export const stufeKlemmen = (u: HoerUebungId, stufe: number) => Math.min(stufenAnzahl(u), Math.max(1, Math.round(Number.isFinite(stufe) ? stufe : 1)));

export const STUFEN_HINWEIS: Record<HoerUebungId, readonly string[]> = {
  intervalle: ['Prime, Quarte, Quinte, Oktave', '+ Terzen und Sexten', 'alle Intervalle bis zur Oktave'],
  dreiklaenge: ['Dur und Moll', '+ vermindert und übermäßig'],
  septakkorde: ['maj7, 7 und m7', '+ halbvermindert und vermindert'],
};

export function optionen(u: HoerUebungId, stufe: number): readonly Antwort[] {
  const ids = new Set(STUFEN[u][stufeKlemmen(u, stufe) - 1]);
  return ALLE[u].filter((a) => ids.has(a.id));
}

export const antwortFinden = (u: HoerUebungId, id: string): Antwort | undefined => ALLE[u].find((a) => a.id === id);
export const antwortName = (u: HoerUebungId, id: string) => antwortFinden(u, id)?.name ?? id;
// Dativ für „mit …": aus „große Terz" wird „großer Terz".
const mitName = (u: HoerUebungId, id: string) => antwortName(u, id).replace(/^(kleine|große) /, '$1r ');

export const FRAGEN_JE_RUNDE = 10;
// Tiefster Ton (notiert) zufällig in G3 … F♯4: darüber reicht auch der Septakkord / die Oktave bequem in den Umfang.
export const TIEFSTER = { von: 55, bis: 66 } as const;

export type Wiedergabe = 'auf' | 'ab' | 'zusammen';
export interface Frage { uebung: HoerUebungId; antwort: string; tiefster: number; wiedergabe: Wiedergabe }

const waehle = <T,>(liste: readonly T[], z: () => number): T => liste[Math.min(liste.length - 1, Math.floor(z() * liste.length))];

export function rundeErzeugen(u: HoerUebungId, stufe: number, richtung: Richtung, startwert: number, anzahl = FRAGEN_JE_RUNDE): Frage[] {
  const z = zufall(startwert);
  const ops = optionen(u, stufe);
  const fragen: Frage[] = [];
  for (let i = 0; i < anzahl; i++) {
    const vorher = fragen[i - 1];
    const wahl = ops.length > 1 ? ops.filter((a) => a.id !== vorher?.antwort) : ops;
    const antwort = waehle(wahl, z).id;
    let tiefster = TIEFSTER.von + Math.floor(z() * (TIEFSTER.bis - TIEFSTER.von + 1));
    if (vorher && tiefster === vorher.tiefster) tiefster = tiefster === TIEFSTER.bis ? TIEFSTER.von : tiefster + 1;
    const r = u === 'intervalle' ? (richtung === 'gemischt' ? waehle<Wiedergabe>(['auf', 'ab', 'zusammen'], z) : richtung) : 'zusammen';
    fragen.push({ uebung: u, antwort, tiefster, wiedergabe: r });
  }
  return fragen;
}

const SCHRITT = 0.9;      // Sekunden je Ton beim Nacheinander
const AKKORD = 2.2;       // Sekunden, die ein Zusammenklang steht

// Klänge einer Antwort über dem tiefsten Ton, so wie die Frage erklingt.
export function klaengeFuer(u: HoerUebungId, antwortId: string, tiefster: number, wiedergabe: Wiedergabe): Klang[] {
  const toene = (antwortFinden(u, antwortId)?.toene ?? [0]).map((t) => tiefster + t);
  if (wiedergabe === 'zusammen') return toene.map((midi) => ({ beginn: 0, dauer: AKKORD, midi }));
  const reihe = wiedergabe === 'ab' ? [...toene].reverse() : toene;
  return reihe.map((midi, i) => ({ beginn: i * SCHRITT, dauer: SCHRITT * 1.1, midi }));
}

export const frageKlaenge = (f: Frage): Klang[] => klaengeFuer(f.uebung, f.antwort, f.tiefster, f.wiedergabe);
// „So klingt deine Antwort": dieselbe Lage und Art, aber mit der gewählten Antwort.
export const antwortKlaenge = (f: Frage, gewaehlt: string): Klang[] => klaengeFuer(f.uebung, gewaehlt, f.tiefster, f.wiedergabe);

export const wiedergabeText = (w: Wiedergabe) => (w === 'auf' ? 'aufwärts' : w === 'ab' ? 'abwärts' : 'zusammen');

export interface Verwechslung { soll: string; gegeben: string; anzahl: number }
export interface Auswertung {
  richtig: number;
  gesamt: number;
  quote: number;
  je: boolean[];
  verwechslungen: Verwechslung[];
  texte: string[];
}

export function bewerten(fragen: readonly Frage[], antworten: readonly (string | null)[]): Auswertung {
  const je = fragen.map((f, i) => antworten[i] === f.antwort);
  const richtig = je.filter(Boolean).length;
  const zaehler = new Map<string, Verwechslung>();
  fragen.forEach((f, i) => {
    const g = antworten[i];
    if (g === null || g === undefined || g === f.antwort) return;
    const k = `${f.antwort}|${g}`;
    const v = zaehler.get(k) ?? { soll: f.antwort, gegeben: g, anzahl: 0 };
    v.anzahl++;
    zaehler.set(k, v);
  });
  const u = fragen[0]?.uebung;
  const verwechslungen = [...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl || a.soll.localeCompare(b.soll) || a.gegeben.localeCompare(b.gegeben));
  const texte = u ? verwechslungen.map((v) => `${antwortName(u, v.soll)} mit ${mitName(u, v.gegeben)} verwechselt: ${v.anzahl}×`) : [];
  return { richtig, gesamt: fragen.length, quote: fragen.length ? richtig / fragen.length : 0, je, verwechslungen, texte };
}

// Zuletzt gewählte Stufe (und bei Intervallen die Richtung), je Übung.
export interface HoerEinstellung {
  intervalle: { stufe: number; richtung: Richtung };
  dreiklaenge: { stufe: number };
  septakkorde: { stufe: number };
}
export const HOER_STANDARD: HoerEinstellung = { intervalle: { stufe: 1, richtung: 'auf' }, dreiklaenge: { stufe: 1 }, septakkorde: { stufe: 1 } };

const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const stufeGueltig = (u: HoerUebungId, v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= stufenAnzahl(u);
export const istRichtung = (v: unknown): v is Richtung => typeof v === 'string' && RICHTUNGEN.some((r) => r.id === v);

export const istHoerEinstellung = (v: unknown): v is HoerEinstellung =>
  objekt(v)
  && objekt(v.intervalle) && stufeGueltig('intervalle', v.intervalle.stufe) && istRichtung(v.intervalle.richtung)
  && objekt(v.dreiklaenge) && stufeGueltig('dreiklaenge', v.dreiklaenge.stufe)
  && objekt(v.septakkorde) && stufeGueltig('septakkorde', v.septakkorde.stufe);

// Aus Gespeichertem lesen; Kaputtes fällt je Übung auf den Standard zurück.
export function hoerEinstellungLesen(v: unknown): HoerEinstellung {
  const o = objekt(v) ? v : {};
  const teil = (k: HoerUebungId) => (objekt(o[k]) && stufeGueltig(k, (o[k] as Record<string, unknown>).stufe) ? (o[k] as Record<string, unknown>).stufe as number : 1);
  const r = objekt(o.intervalle) && istRichtung(o.intervalle.richtung) ? o.intervalle.richtung : 'auf';
  return { intervalle: { stufe: teil('intervalle'), richtung: r }, dreiklaenge: { stufe: teil('dreiklaenge') }, septakkorde: { stufe: teil('septakkorde') } };
}
