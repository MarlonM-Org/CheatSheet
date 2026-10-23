// Stempel (E-04, Teil 1): musikalische Zeichen, die man auf die Seite setzt —
// Segno, Coda, Fermate, Atemzeichen, Zäsur, Dynamik, Fingersätze. Jedes
// Zeichen ist ein Bild im 24×24-Kasten (Pfade wie in SVG, Mitte 12/12) oder
// ein kurzer Text in kursiver Serife. Gesetzt wird mit der Mitte auf den
// angetippten Punkt; `groesse` ist die Kastenbreite in Anteilen der
// Seitenbreite. D.S. und Coda beim Sprung-Setzen legen ihren Stempel an die
// Einstiegsstelle (SPRUNG_STEMPEL). Rein und getestet.

import type { Anmerkung } from './notenpult';
import type { SprungArt } from './spruenge';

export type StempelZeichen =
  | 'segno' | 'coda' | 'fermate' | 'atem' | 'zaesur'
  | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5';

export interface StempelBild {
  name: string;
  // Kastenbreite in Anteilen der Seitenbreite.
  groesse: number;
  pfade?: { d: string; voll?: boolean }[];
  text?: string;
  // Schriftgröße des Texts im 24er-Kasten.
  schrift?: number;
}

const dyn = (text: string, name: string): StempelBild => ({ name, groesse: 0.03, text, schrift: 15 });
const finger = (n: number): StempelBild => ({ name: `Fingersatz ${n}`, groesse: 0.016, text: String(n), schrift: 17 });

export const STEMPEL: Record<StempelZeichen, StempelBild> = {
  // Segno: hohes, schlankes S mit Schrägstrich und zwei Punkten.
  segno: {
    name: 'Segno', groesse: 0.034,
    pfade: [
      { d: 'M16.4 5.3C15.6 3.4 13.5 2.6 11.7 3.2 9.7 3.9 8.7 5.9 9.4 7.8c.7 1.9 2.7 2.6 4.2 3.6 1.5 1 3.3 2.2 3.5 4.3.2 2.2-1.3 4-3.4 4.4-2 .4-4.3-.5-5-2.4' },
      { d: 'M6 22.5 18 1.5' },
      { d: 'M4.6 12.4a1.3 1.3 0 1 0 .01 0z', voll: true },
      { d: 'M19.4 11.6a1.3 1.3 0 1 0 .01 0z', voll: true },
    ],
  },
  coda: {
    name: 'Coda', groesse: 0.03,
    pfade: [
      { d: 'M12 5.5C14.9 5.5 17.2 8.4 17.2 12S14.9 18.5 12 18.5 6.8 15.6 6.8 12 9.1 5.5 12 5.5z' },
      { d: 'M12 2v20M2 12h20' },
    ],
  },
  fermate: { name: 'Fermate', groesse: 0.03, pfade: [{ d: 'M3 16a9 9 0 0 1 18 0' }, { d: 'M12 14.2a1.7 1.7 0 1 0 .01 0z', voll: true }] },
  atem: { name: 'Atemzeichen', groesse: 0.014, pfade: [{ d: 'M10.5 4c3.8 0 5.2 2.8 3.6 6.4L9.5 20' }] },
  zaesur: { name: 'Zäsur', groesse: 0.022, pfade: [{ d: 'M7 20 13 4M14 20 20 4' }] },
  pp: dyn('pp', 'Pianissimo'), p: dyn('p', 'Piano'), mp: dyn('mp', 'Mezzopiano'),
  mf: dyn('mf', 'Mezzoforte'), f: dyn('f', 'Forte'), ff: dyn('ff', 'Fortissimo'),
  f1: finger(1), f2: finger(2), f3: finger(3), f4: finger(4), f5: finger(5),
};
export const STEMPEL_REIHE: StempelZeichen[] = ['segno', 'coda', 'fermate', 'atem', 'zaesur', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'f1', 'f2', 'f3', 'f4', 'f5'];
export const istStempelZeichen = (z: unknown): z is StempelZeichen => typeof z === 'string' && Object.prototype.hasOwnProperty.call(STEMPEL, z);

// Welcher Stempel beim Sprung an die Einstiegsstelle kommt.
export const SPRUNG_STEMPEL: Partial<Record<SprungArt, StempelZeichen>> = { ds: 'segno', coda: 'coda' };

export type Stempel = Extract<Anmerkung, { art: 'stempel' }>;
export function stempelAnlegen(id: string, zeichen: StempelZeichen, x: number, y: number, farbe: string, luecke: string | null = null): Stempel {
  const st: Stempel = { id, art: 'stempel', zeichen, x, y, groesse: STEMPEL[zeichen].groesse, farbe };
  if (luecke) st.luecke = luecke;
  return st;
}

// Der Kasten des Stempels in Seitenanteilen (Höhe über das Seitenformat).
export function stempelKasten(a: { x: number; y: number; groesse: number }, seitenformat = 1.414) {
  const h = a.groesse / seitenformat;
  return { x: a.x - a.groesse / 2, y: a.y - h / 2, b: a.groesse, h };
}
