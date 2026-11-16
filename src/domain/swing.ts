// Swing-Metronom (I-17): welche Klicks ein Takt hat und wann. Rein, getestet.
//
// Zeiten sind in **Puls** angegeben (1 Puls = ein Schlag des Tempos, also
// 60 / bpm Sekunden; in 6/8 ist der Puls die punktierte Viertel). Das
// Tempo ändert den Versatz nicht — wer plant, rechnet Versatz × 60 / bpm.
//
// Zwei Optionen kommen zu Takt, Akzenten und Unterteilung dazu:
//  - „Nur 2 und 4“: Klick nur auf den geraden Schlägen (2, 4, 6 …) — der
//    Backbeat des Jazz. Gilt für einfache Taktarten mit gerader Schlagzahl ab
//    vier (4/4, 6/4, 8/4 …). In 3/4, 5/4, 2/4 und zusammengesetzten Takten
//    (6/8, 9/8, 12/8) gibt es keine 2 und 4 im jazzigen Sinn: die Option ist
//    dort wirkungslos (zweiVierMoeglich). Ein so stummer Schlag schweigt samt
//    seiner Unterteilung, wie ein stumm gestellter Schlag auch.
//  - „Achtel hörbar“ mit Swing-Anteil: jeder Schlag bekommt einen leiseren
//    Nachschlag (das „und“); sein Anteil am Schlag, 50 % gerade bis 67 %
//    triolisch (Standard 60 %). Ersetzt die gewählte Unterteilung. In
//    zusammengesetzten Takten (Achtel in Dreiergruppen) gibt es keinen
//    Swing — dort bleibt es bei der Unterteilung.

import type { Akzent } from './einstellungen';
import { einheitenJeSchlag, istZusammengesetzt, type Nenner } from './takt';

export interface Swing {
  zweiVier: boolean;
  achtel: boolean;
  /** Lage des Nachschlags im Schlag in Prozent: 50 gerade … 67 triolisch (erlaubt 50–75). */
  anteil: number;
}
export const SWING_STANDARD: Swing = { zweiVier: false, achtel: false, anteil: 60 };
export const ANTEIL_MIN = 50;
export const ANTEIL_MAX = 75;
export const ANTEILE: readonly { anteil: number; name: string }[] = [
  { anteil: 50, name: 'Gerade' }, { anteil: 60, name: 'Locker' }, { anteil: 67, name: 'Triolisch' },
];

export const anteilPruefen = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(ANTEIL_MAX, Math.max(ANTEIL_MIN, Math.round(v))) : SWING_STANDARD.anteil;

export function istSwing(v: unknown): v is Swing {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return typeof s.zweiVier === 'boolean' && typeof s.achtel === 'boolean'
    && Number.isInteger(s.anteil) && (s.anteil as number) >= ANTEIL_MIN && (s.anteil as number) <= ANTEIL_MAX;
}

export const zweiVierMoeglich = (zaehler: number, nenner: Nenner): boolean =>
  !istZusammengesetzt(zaehler, nenner) && zaehler >= 4 && zaehler % 2 === 0;
export const swingMoeglich = (zaehler: number, nenner: Nenner): boolean => !istZusammengesetzt(zaehler, nenner);

// Klingt der Schlag (0-basiert, eine Einheit je Taktpunkt) bei „nur 2 und 4“?
export const schlagKlingt = (zaehler: number, nenner: Nenner, schlag: number, zweiVier: boolean): boolean =>
  !zweiVier || !zweiVierMoeglich(zaehler, nenner) || schlag % 2 === 1;

export type KlickArt = 'betont' | 'normal' | 'unter';
export interface Klick {
  schlag: number; sub: number;
  /** Zeit ab Taktanfang in Puls. */
  versatz: number;
  /** null: stumm (kein Klang, nur die Anzeige läuft mit). */
  art: KlickArt | null;
}

// Alle Klicks eines Takts in Reihenfolge. `akzente` je Taktpunkt (fehlt einer: normal).
export function taktKlicks(zaehler: number, nenner: Nenner, unter: number, akzente: readonly Akzent[], swing: Swing): Klick[] {
  const e = einheitenJeSchlag(zaehler, nenner);
  const geschwungen = swing.achtel && swingMoeglich(zaehler, nenner);
  const teile = geschwungen ? 2 : Math.max(1, unter);
  const liste: Klick[] = [];
  for (let schlag = 0; schlag < zaehler; schlag++) {
    const akzent = akzente[schlag] ?? 'normal';
    const klingt = akzent !== 'stumm' && schlagKlingt(zaehler, nenner, schlag, swing.zweiVier);
    for (let sub = 0; sub < teile; sub++) {
      const bruch = geschwungen ? (sub === 0 ? 0 : swing.anteil / 100) : sub / teile;
      liste.push({
        schlag, sub, versatz: (schlag + bruch) / e,
        art: !klingt ? null : sub > 0 ? 'unter' : akzent === 'betont' ? 'betont' : 'normal',
      });
    }
  }
  return liste;
}

// Länge eines Takts in Puls.
export const taktLaenge = (zaehler: number, nenner: Nenner): number => zaehler / einheitenJeSchlag(zaehler, nenner);

// Abstand vom Klick `i` zum nächsten (der erste des Folgetakts nach dem letzten), in Puls.
export function abstandZumNaechsten(liste: readonly Klick[], i: number, zaehler: number, nenner: Nenner): number {
  const jetzt = liste[i].versatz;
  return i + 1 < liste.length ? liste[i + 1].versatz - jetzt : taktLaenge(zaehler, nenner) + liste[0].versatz - jetzt;
}
