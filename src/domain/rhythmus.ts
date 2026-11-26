// Rhythmus der Erkennung (G-12): wie ein Schlag beim Transkribieren geteilt
// wird, eingestellt vor der Aufnahme oder vor dem Laden einer Datei. Gerade
// in Achtel oder Sechzehntel (wie bisher „kleinster Wert“), in Triolen
// (Achteltriolen: das Viertel in drei gleiche Teile) oder geswingt: die
// Achtel lang-kurz, wie lang die erste ist, sagt der Anteil — dieselbe Skala
// wie beim Swing-Metronom (I-17: 50 gerade, 60 locker, 67 triolisch,
// höchstens 75). Geschrieben wird Swing gerade, mit „Swing“ im Kopf
// (Jazz-Brauch); beim Vorspielen swingt es wieder. Rein, getestet.

import {
  einswingen, rastern, segmentieren, segmentOptionen, versatzSchaetzen, viertelDauer,
  type Lesart, type Raster, type Takt, type Tonart, type Tonrahmen,
} from './notation';
import { aufsBlatt, skalieren } from './notensatz';
import { ANTEIL_MAX, ANTEIL_MIN, anteilPruefen } from './swing';
import { istZusammengesetzt, type Nenner } from './takt';
import { median } from './ueben';

export type Einteilung = 'achtel' | 'sechzehntel' | 'triolen' | 'swing';
export const EINTEILUNGEN: readonly { einteilung: Einteilung; name: string; hinweis: string }[] = [
  { einteilung: 'achtel', name: 'Achtel', hinweis: 'gerade, kleinster Wert die Achtel' },
  { einteilung: 'sechzehntel', name: 'Sechzehntel', hinweis: 'gerade, kleinster Wert die Sechzehntel' },
  { einteilung: 'triolen', name: 'Triolen', hinweis: 'jedes Viertel in drei gleiche Teile (Achteltriolen)' },
  { einteilung: 'swing', name: 'Swing', hinweis: 'Achtel lang-kurz — wie lang die erste ist, stellt der Regler ein' },
];
export interface Rhythmus { einteilung: Einteilung; anteil: number }
export const RHYTHMUS_STANDARD: Rhythmus = { einteilung: 'sechzehntel', anteil: 60 };
export { ANTEIL_MAX, ANTEIL_MIN };

// Gespeichert (ueben:einspiel-feinheit, nur am Gerät): die Einteilung — oder
// aus der Zeit davor die Feinheit 8 bzw. 16.
export function einteilungLesen(v: unknown): Einteilung {
  if (v === 8) return 'achtel';
  if (v === 16) return 'sechzehntel';
  return EINTEILUNGEN.some((e) => e.einteilung === v) ? (v as Einteilung) : RHYTHMUS_STANDARD.einteilung;
}
export const anteilLesen = (v: unknown): number => anteilPruefen(v);

// Triolen und Swing teilen das Viertel — in zusammengesetzten Taktarten
// (6/8, 9/8, 12/8) ist der Schlag schon dreigeteilt, und in Taktarten auf
// Achtel (3/8, 5/8) gibt es kein Viertel als Schlag: dort nicht.
export const einteilungMoeglich = (e: Einteilung, zaehler: number, nenner: Nenner): boolean =>
  e === 'achtel' || e === 'sechzehntel' || (!istZusammengesetzt(zaehler, nenner) && nenner <= 4);
// Was tatsächlich gilt: Geht die Wahl in der Taktart nicht, Sechzehntel.
export const wirksam = (rh: Rhythmus, zaehler: number, nenner: Nenner): Rhythmus =>
  einteilungMoeglich(rh.einteilung, zaehler, nenner) ? rh : { ...rh, einteilung: 'sechzehntel' };

// Zellen je ganzer Note fürs Runden: Achtel 8, Sechzehntel 16, Triolen 12
// (drei je Viertel), Swing 16 (die Achtel entswingt, Läufe in Sechzehnteln
// bleiben möglich).
export const erkennungsFeinheit = (e: Einteilung): number => (e === 'achtel' ? 8 : e === 'triolen' ? 12 : 16);
export const erkennungsRaster = (r: Pick<Raster, 'bpm' | 'zaehler' | 'nenner'>, rh: Rhythmus): Raster =>
  ({ bpm: r.bpm, zaehler: r.zaehler, nenner: r.nenner, feinheit: erkennungsFeinheit(wirksam(rh, r.zaehler, r.nenner).einteilung) });
// Swing-Anteil, der fürs Schreiben und Vorspielen gilt (0: kein Swing).
export const swingAnteil = (rh: Rhythmus, zaehler: number, nenner: Nenner): number => {
  const w = wirksam(rh, zaehler, nenner);
  return w.einteilung === 'swing' && w.anteil > 50 ? w.anteil : 0;
};

export interface Transkription { takte: Takt[]; versatz: number }

// Spur (ab Taktanfang) → Takte auf dem Blattraster (96 Zellen je Ganze), nach
// der gewählten Einteilung. Erst wird die Latenz passend zum Muster geschätzt
// und abgezogen (wenn `versatz` nicht schon bekannt ist), dann gerundet.
// Triolen werden aufs Blatt neu gelegt — das Blatt erkennt Triolen-Schläge
// und schreibt sie mit Klammer.
export function transkribieren(rahmen: readonly Tonrahmen[], r: Pick<Raster, 'bpm' | 'zaehler' | 'nenner'>, rh: Rhythmus,
  o: { tonart?: Tonart | null; lesart?: Lesart; versatz?: number } = {}): Transkription {
  const w = wirksam(rh, r.zaehler, r.nenner);
  const er = erkennungsRaster(r, w);
  const swing = swingAnteil(w, r.zaehler, r.nenner);
  const versatz = o.versatz ?? versatzSchaetzen(rahmen, er, 0.4, { triolen: w.einteilung === 'triolen', swing });
  const spur = versatz ? rahmen.map((f) => ({ ...f, zeit: f.zeit - versatz })) : rahmen;
  const roh = rastern(spur, er, { tonart: o.tonart ?? null, lesart: o.lesart, swing });
  return { takte: w.einteilung === 'triolen' ? aufsBlatt(roh, er.feinheit, er) : skalieren(roh, er.feinheit), versatz };
}

// Swing-Anteil aus der Aufnahme schätzen — aus dem Gesamtbild, nicht Note
// für Note: Je zwei aufeinanderfolgende Abstände zwischen Einsätzen, die
// zusammen etwa ein Viertel ergeben (± 15 %), sind ein Achtelpaar; sein
// Anteil ist der längere Abstand durch das Viertel. Davon der Median, auf
// ganze Prozent, 50–75. Das kommt ohne Latenz und ohne Lage der Eins aus
// (die verschieben alle Einsätze gleich). Sechzehntel-Läufe (Paare von
// einem halben Viertel), Viertel und Triolen (drei je Viertel: zwei Drittel
// Viertel) zählen nicht. Unter vier Paaren: null (zu wenig, um es zu sagen).
export function swingSchaetzen(rahmen: readonly Tonrahmen[], r: Pick<Raster, 'bpm' | 'zaehler' | 'nenner'>, lesart: Lesart = 'melodisch'): number | null {
  if (istZusammengesetzt(r.zaehler, r.nenner)) return null;
  const er: Raster = { ...r, feinheit: 16 };
  const q = viertelDauer(er);
  const starts = segmentieren(rahmen, segmentOptionen(lesart, er)).map((s) => s.start);
  const anteile: number[] = [];
  for (let i = 0; i + 2 < starts.length; i++) {
    const a = starts[i + 1] - starts[i], b = starts[i + 2] - starts[i + 1];
    if (Math.abs(a + b - q) > 0.15 * q) continue;
    anteile.push(Math.max(a, b) / (a + b));
  }
  if (anteile.length < 4) return null;
  return Math.min(ANTEIL_MAX, Math.max(ANTEIL_MIN, Math.round(median(anteile) * 100)));
}

// Fürs Vorspielen eines Swing-Stücks (G-04): Beginn und Dauer jedes Klangs
// (in gerader Zeit geschrieben) geswingt.
export function geswingt<T extends { beginn: number; dauer: number }>(klaenge: readonly T[], r: Raster, anteil: number): T[] {
  if (!(anteil > 50) || istZusammengesetzt(r.zaehler, r.nenner)) return [...klaenge];
  const q = viertelDauer(r);
  return klaenge.map((k) => {
    const beginn = einswingen(k.beginn, q, anteil);
    return { ...k, beginn, dauer: einswingen(k.beginn + k.dauer, q, anteil) - beginn };
  });
}
