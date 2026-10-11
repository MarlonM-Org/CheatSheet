// Stift-Ausbau (E-01/E-02): Dicken und Farben je Werkzeug — reine Logik.
// Vorbild ist Apples Pencil-Werkzeugpalette: jedes Werkzeug merkt sich
// seine Farbe und Dicke; die Werte hier sind relativ zur Seitenbreite.

export type ZeichenWerkzeug = 'stift' | 'marker' | 'text';

export interface StiftEinstellung { farbe: string; breite: number }

export const STIFT_DICKEN = [
  { name: 'Fein', wert: 0.0015 },
  { name: 'Mittel', wert: 0.0025 },   // bisheriger fester Wert
  { name: 'Kräftig', wert: 0.004 },
  { name: 'Breit', wert: 0.006 },
] as const;

export const MARKER_DICKEN = [
  { name: 'Schmal', wert: 0.009 },
  { name: 'Mittel', wert: 0.014 },    // bisheriger fester Wert
  { name: 'Breit', wert: 0.022 },
] as const;

// Kuratierte Palette (E-02). Die drei alten Standardfarben bleiben enthalten,
// damit bestehende Anmerkungen zur Auswahl passen.
export const STIFTFARBEN = [
  '#1b1b1b', '#5f5b53', '#d12d2d', '#e8740c', '#a8781f',
  '#1f7a43', '#1f5fd1', '#7b3ff2', '#d12d8a',
] as const;

export const MARKERFARBEN = [
  'rgba(255, 214, 0, 0.45)', 'rgba(80, 220, 120, 0.4)', 'rgba(255, 120, 200, 0.35)',
  'rgba(80, 170, 255, 0.4)', 'rgba(255, 150, 60, 0.4)', 'rgba(170, 120, 255, 0.4)',
] as const;

export const TEXT_GROESSE = 0.024;

export const STIFT_STANDARD: Record<ZeichenWerkzeug, StiftEinstellung> = {
  stift: { farbe: STIFTFARBEN[0], breite: STIFT_DICKEN[1].wert },
  marker: { farbe: MARKERFARBEN[0], breite: MARKER_DICKEN[1].wert },
  text: { farbe: STIFTFARBEN[0], breite: TEXT_GROESSE },
};

export const DICKEN: Record<ZeichenWerkzeug, readonly { name: string; wert: number }[]> = {
  stift: STIFT_DICKEN,
  marker: MARKER_DICKEN,
  text: [],
};

export const FARBEN: Record<ZeichenWerkzeug, readonly string[]> = {
  stift: STIFTFARBEN,
  marker: MARKERFARBEN,
  text: STIFTFARBEN,
};

// Gespeicherte Einstellungen können fehlen oder von alten Ständen stammen —
// nur bekannte Farben und Dicken gelten, sonst der Standard.
export function einstellungPruefen(werkzeug: ZeichenWerkzeug, wert: unknown): StiftEinstellung {
  const standard = STIFT_STANDARD[werkzeug];
  if (!wert || typeof wert !== 'object') return standard;
  const e = wert as Partial<StiftEinstellung>;
  const farbe = typeof e.farbe === 'string' && FARBEN[werkzeug].includes(e.farbe) ? e.farbe : standard.farbe;
  const breite = werkzeug === 'text'
    ? TEXT_GROESSE
    : DICKEN[werkzeug].some((d) => d.wert === e.breite) ? (e.breite as number) : standard.breite;
  return { farbe, breite };
}
