// Farbwelten (Themes) und Hell/Dunkel-Modus — reine Logik, DOM-frei.
//
// Modell (B-04): Der Modus entscheidet hell oder dunkel (oder folgt dem
// System). Je Seite wählt man seine Farbwelt: eine helle (Weiß, Sommer) und
// eine dunkle (Dunkelblau, Schwarz). Aufgelöst wird immer auf genau ein
// Thema, das als data-thema am <html> landet.

export type Modus = 'system' | 'hell' | 'dunkel';
export type Thema = 'weiss' | 'sommer' | 'dunkelblau' | 'schwarz';

export const MODI: Modus[] = ['system', 'hell', 'dunkel'];
export const HELLE_THEMEN: readonly Thema[] = ['weiss', 'sommer'];
export const DUNKLE_THEMEN: readonly Thema[] = ['dunkelblau', 'schwarz'];

export const THEMA_NAME: Record<Thema, string> = {
  weiss: 'Weiß',
  sommer: 'Sommer',
  dunkelblau: 'Dunkelblau',
  schwarz: 'Schwarz',
};

export const MODUS_NAME: Record<Modus, string> = {
  system: 'System',
  hell: 'Hell',
  dunkel: 'Dunkel',
};

// Browser-Chrome (meta theme-color) je Thema — der Grundton der Fläche.
export const THEMA_CHROME: Record<Thema, string> = {
  weiss: '#fcfcfb',
  sommer: '#fdf3f1',
  dunkelblau: '#0b1420',
  schwarz: '#000000',
};

export const STANDARD_HELL: Thema = 'weiss';
export const STANDARD_DUNKEL: Thema = 'dunkelblau';

export const istDunkel = (t: Thema) => DUNKLE_THEMEN.includes(t);

const oderStandard = (t: unknown, erlaubt: readonly Thema[], standard: Thema): Thema =>
  erlaubt.includes(t as Thema) ? (t as Thema) : standard;

// Gespeicherte Werte können fehlen oder (nach App-Updates) ungültig sein —
// dann gilt der Standard, nie ein kaputter Zustand.
export function aufloesen(
  modus: unknown,
  hell: unknown,
  dunkel: unknown,
  systemDunkel: boolean,
): Thema {
  const m: Modus = MODI.includes(modus as Modus) ? (modus as Modus) : 'system';
  const dunkelAktiv = m === 'dunkel' || (m === 'system' && systemDunkel);
  return dunkelAktiv
    ? oderStandard(dunkel, DUNKLE_THEMEN, STANDARD_DUNKEL)
    : oderStandard(hell, HELLE_THEMEN, STANDARD_HELL);
}
