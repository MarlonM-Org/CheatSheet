// Spielhilfe in deinen Noten (I-15): Akkordsymbole je Takt an einer Stelle,
// beim Üben Akkord für Akkord notiert für die eigene Stimmung, mit
// Akkordtönen, Guide Tones und einer Drone auf dem Grundton. Keine
// Begleitspur (Leitbild). Rein, getestet.
//
// Gespeichert an der Stelle als `akkorde: { text, eingabe }` (Typ in
// ./bestand). Der Text ist eine Akkordfolge in der Syntax von `folgeLesen`
// (./akkorde): Takte mit `|`, Akkorde im Takt mit Leerzeichen, `%` wiederholt.
// Das Feld reist wie jedes zusätzliche Feld einer Stelle mit der Sicherung.
import {
  akkordText, folgeLesen, folgeText, folgeTransponieren, type Akkord, type Folge,
} from './akkorde';
import type { StellenAkkorde } from './bestand';
import type { DroneFarbe } from './drone';
import type { Stimmung } from './ueben';

export type AkkordEingabe = StellenAkkorde['eingabe'];

/** Das Feld prüfen. Unbrauchbares → null (die Stelle bleibt, wie sie ist); unbekannte Eingabeart → klingend. */
export function akkordeLesen(roh: unknown): StellenAkkorde | null {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return null;
  const { text, eingabe } = roh as Record<string, unknown>;
  if (typeof text !== 'string') return null;
  return { text, eingabe: eingabe === 'notiert' ? 'notiert' : 'klingend' };
}

/** Hat die Stelle mindestens einen lesbaren Akkord? */
export function hatAkkorde(s: { akkorde?: unknown }): boolean {
  const a = akkordeLesen(s.akkorde);
  return !!a && folgeLesen(a.text).takte.length > 0;
}

/** Eingabe fürs Speichern: einheitlich mit Taktstrichen in ASCII („| Cm7 F7 | Bbmaj7 |“).
 *  Leer → `{ text: '' }` (entfernt). Mit unlesbaren Akkorden: `wert` null, Fehler genannt. */
export function akkordeAufbereiten(text: string, eingabe: AkkordEingabe): { wert: StellenAkkorde | null; fehler: string[]; takte: number } {
  if (!text.trim()) return { wert: { text: '', eingabe }, fehler: [], takte: 0 };
  const f = folgeLesen(text);
  if (f.fehler.length) return { wert: null, fehler: f.fehler, takte: f.takte.length };
  return { wert: { text: folgeText(f, { ascii: true }), eingabe }, fehler: [], takte: f.takte.length };
}

/** Ein Schritt der Spielhilfe: ein Akkord in seinem Takt. */
export interface SpielhilfeSchritt {
  /** Takt in der Stelle, ab 1. */
  takt: number;
  /** Der wievielte Akkord im Takt (ab 1) und wie viele dort stehen. */
  nr: number; imTakt: number;
  /** Notiert für die Stimmung (das, was man greift) und klingend. */
  notiert: Akkord; klingend: Akkord;
}

const flach = (f: Folge) => f.takte.flatMap((t, ti) => t.akkorde.map((a, i) => ({ takt: ti + 1, nr: i + 1, imTakt: t.akkorde.length, a })));

/** Alle Schritte, Akkord für Akkord. Klingend eingegeben → notiert in bequemster Schreibweise;
 *  notiert eingegeben bleibt, wie es dasteht. */
export function spielhilfeSchritte(akkorde: StellenAkkorde | null, stimmung: Stimmung): SpielhilfeSchritt[] {
  if (!akkorde) return [];
  const f = folgeLesen(akkorde.text);
  if (!f.takte.length) return [];
  const notiert = akkorde.eingabe === 'notiert' ? f : folgeTransponieren(f, stimmung, 'zuNotiert');
  const klingend = akkorde.eingabe === 'klingend' ? f : folgeTransponieren(f, stimmung, 'zuKlingend');
  const n = flach(notiert), k = flach(klingend);
  return n.map((x, i) => ({ takt: x.takt, nr: x.nr, imTakt: x.imTakt, notiert: x.a, klingend: k[i].a }));
}

/** „T. 3 von 8“, bei mehreren Akkorden im Takt „T. 1 · 2/2 von 8“. */
export function schrittText(s: SpielhilfeSchritt, takte: number): string {
  return `T. ${s.takt}${s.imTakt > 1 ? ` · ${s.nr}/${s.imTakt}` : ''} von ${takte}`;
}

/** Nächster bzw. voriger Schritt, rundherum (die Stelle wird geloopt). */
export function schrittWeiter(pos: number, anzahl: number, richtung: 1 | -1): number {
  if (anzahl <= 0) return 0;
  const p = Number.isInteger(pos) && pos >= 0 && pos < anzahl ? pos : anzahl - 1;
  return (((p + richtung) % anzahl) + anzahl) % anzahl;
}

/** Klangfarbe der Drone zum Akkord: Dur/maj7 → Dur, Moll → Moll, Dominante → Mixolydisch,
 *  m7 → Dorisch; verminderte und übermäßige nur Grundton (eine reine Quinte riebe), sonst Quinte. */
export function droneFarbeFuer(a: Akkord): DroneFarbe {
  switch (a.art) {
    case 'dur': case 'dur6': case 'maj7': return 'dur';
    case 'moll': case 'moll6': case 'mollMaj7': return 'moll';
    case 'dom7': return 'mixolydisch';
    case 'moll7': return 'dorisch';
    case 'vermindert': case 'vermindert7': case 'halbvermindert': case 'uebermaessig': return 'grundton';
    default: return 'quinte';
  }
}

/** Kurzform für Listen: „| Cm7 F7 | B♭maj7 |“ (mit ♭/♯), leer bei nichts Lesbarem. */
export function akkordeKurz(a: StellenAkkorde | null): string {
  if (!a) return '';
  const f = folgeLesen(a.text);
  return f.takte.length ? `| ${f.takte.map((t) => t.akkorde.map((x) => akkordText(x)).join(' ')).join(' | ')} |` : '';
}
