// Taktart des Metronoms (D-05): Zähler (Schläge je Takt) und Nenner
// (Notenwert eines Schlags). Das Tempo gilt je Nenner-Note — so wie ein
// Metronom „♪ = 120“ bei 6/8 meint. Rein und getestet.

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
