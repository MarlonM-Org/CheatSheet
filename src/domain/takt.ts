// Taktart des Metronoms (D-05): Zähler (Einheiten je Takt, eine je
// Taktpunkt) und Nenner (ihr Notenwert). Das Tempo gilt je **Schlag**, dem
// gefühlten Puls: in 4/4 die Viertel, in 2/2 die Halbe, in 6/8 die
// punktierte Viertel (drei Achtel). Bei 6/8 und 120 kommen also 360 Achtel
// in der Minute, betont auf 1 und 4 (D-07). Rein und getestet.

import type { Akzent } from './einstellungen';

export const NENNER = [2, 4, 8, 16] as const;
export type Nenner = (typeof NENNER)[number];
export const NENNER_STANDARD: Nenner = 4;
export const ZAEHLER_MIN = 1;
export const ZAEHLER_MAX = 16;

export const NENNER_NAME: Record<Nenner, string> = { 2: 'Halbe', 4: 'Viertel', 8: 'Achtel', 16: 'Sechzehntel' };

// Häufige Taktarten als Schnellwahl.
export const TAKTARTEN: readonly [number, Nenner][] = [[2, 4], [3, 4], [4, 4], [6, 8], [9, 8], [12, 8]];

export const istNenner = (v: unknown): v is Nenner => NENNER.includes(v as Nenner);
export const nennerPruefen = (v: unknown): Nenner => (istNenner(v) ? v : NENNER_STANDARD);
export const zaehlerPruefen = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= ZAEHLER_MIN && (v as number) <= ZAEHLER_MAX ? (v as number) : 4;

export const taktartText = (zaehler: number, nenner: Nenner) => `${zaehler}/${nenner}`;

// Zusammengesetzte Takte (6/8, 9/8, 12/8 — Achtel oder kürzer in Dreiergruppen)
// betonen jede Gruppe; sonst nur die Eins.
export function istZusammengesetzt(zaehler: number, nenner: Nenner): boolean {
  return nenner >= 8 && zaehler > 3 && zaehler % 3 === 0;
}

// Standard-Akzente einer Taktart. Was `alt` schon hat, bleibt (Schlag für
// Schlag) — wer die Taktart nur verlängert, verliert nichts; beim Wechsel
// des Nenners gibt die Oberfläche kein `alt` mit.
export function akzenteFuer(zaehler: number, nenner: Nenner, alt: readonly Akzent[] = []): Akzent[] {
  const gruppe = istZusammengesetzt(zaehler, nenner) ? 3 : zaehler;
  return Array.from({ length: zaehler }, (_, i) => alt[i] ?? (i % gruppe === 0 ? 'betont' : 'normal'));
}

// Nächster Nenner in der Reihe (nach oben oder unten), am Rand bleibt er.
export function nennerSchritt(nenner: Nenner, richtung: 1 | -1): Nenner {
  const i = NENNER.indexOf(nenner) + richtung;
  return NENNER[Math.max(0, Math.min(NENNER.length - 1, i))];
}

// ── Schlag und Einheit (D-07) ──
// Einheiten je Schlag: zusammengesetzt 3 (die Achtel einer punktierten
// Viertel), sonst 1 — der Schlag ist die Einheit selbst.
export const einheitenJeSchlag = (zaehler: number, nenner: Nenner) => (istZusammengesetzt(zaehler, nenner) ? 3 : 1);
export const schlaegeJeTakt = (zaehler: number, nenner: Nenner) => zaehler / einheitenJeSchlag(zaehler, nenner);

// Der Notenwert eines Schlags, für „♩. = 120“ in Worten.
export function schlagName(zaehler: number, nenner: Nenner): string {
  const z = istZusammengesetzt(zaehler, nenner);
  return nenner === 2 ? 'Halbe' : nenner === 4 ? 'Viertel' : nenner === 8 ? (z ? 'punktierte Viertel' : 'Achtel') : z ? 'punktierte Achtel' : 'Sechzehntel';
}

// Unterteilung: Klicks je Einheit, benannt nach dem Notenwert, der dabei
// herauskommt. Hängt von der Taktart ab (in 4/4 teilt sie die Viertel, in
// 6/8 die Achtel) — eine gespeicherte Unterteilung, die es hier nicht gibt,
// fällt auf die erste zurück (unterPruefen).
export interface Unterteilung { n: number; zeichen: string; name: string; kurz: string }
const VIERTEL: Unterteilung[] = [
  { n: 1, zeichen: '♩', name: 'Viertel', kurz: '4tel' }, { n: 2, zeichen: '♫', name: 'Achtel', kurz: '8tel' },
  { n: 3, zeichen: '♪³', name: 'Triolen', kurz: 'Triole' }, { n: 4, zeichen: '♬', name: 'Sechzehntel', kurz: '16tel' },
];
const HALBE: Unterteilung[] = [
  { n: 1, zeichen: '𝅗𝅥', name: 'Halbe', kurz: 'Halbe' }, { n: 2, zeichen: '♩', name: 'Viertel', kurz: '4tel' },
  { n: 3, zeichen: '♩³', name: 'Triolen', kurz: 'Triole' }, { n: 4, zeichen: '♫', name: 'Achtel', kurz: '8tel' },
];
const ACHTEL: Unterteilung[] = [
  { n: 1, zeichen: '♪', name: 'Achtel', kurz: '8tel' }, { n: 2, zeichen: '♬', name: 'Sechzehntel', kurz: '16tel' },
];
const SECHZEHNTEL: Unterteilung[] = [
  { n: 1, zeichen: '♬', name: 'Sechzehntel', kurz: '16tel' }, { n: 2, zeichen: '♬♬', name: 'Zweiunddreißigstel', kurz: '32stel' },
];
export function unterteilungen(zaehler: number, nenner: Nenner): Unterteilung[] {
  void zaehler;
  return nenner === 2 ? HALBE : nenner === 4 ? VIERTEL : nenner === 8 ? ACHTEL : SECHZEHNTEL;
}
export function unterPruefen(zaehler: number, nenner: Nenner, unter: number): number {
  const liste = unterteilungen(zaehler, nenner);
  return liste.some((u) => u.n === unter) ? unter : liste[0].n;
}

// Dauer eines Klicks in Sekunden: der Schlag (60 / bpm) geteilt in seine
// Einheiten und deren Unterteilung.
export function klickDauer(bpm: number, zaehler: number, nenner: Nenner, unter: number): number {
  return 60 / bpm / einheitenJeSchlag(zaehler, nenner) / unter;
}
