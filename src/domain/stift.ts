// Stift-Ausbau (E-01/E-02): Dicken und Farben je Werkzeug — reine Logik.
// Vorbild ist Apples Pencil-Werkzeugpalette: jedes Werkzeug merkt sich
// seine Farbe und Dicke; die Werte hier sind relativ zur Seitenbreite.

import { hexVon, markerFarbe, markerFuer, rgbAus, type RGB } from './farbe';

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
// damit bestehende Anmerkungen zur Auswahl passen. Gold (#a8781f) ist seit
// E-08 heraus: Sein Platz gehört der Pipette, jede andere Farbe geht über
// den Farbwähler. Statt Grau (#5f5b53) steht seit E-09 Weiß in der Palette
// — zum Abdecken auf dem Blatt; ein gespeichertes Grau gilt weiter als
// eigene Farbe.
export const STIFTFARBEN = [
  '#1b1b1b', '#ffffff', '#d12d2d', '#e8740c',
  '#1f7a43', '#1f5fd1', '#7b3ff2', '#d12d8a',
] as const;

export const MARKERFARBEN = [
  'rgba(255, 214, 0, 0.45)', 'rgba(80, 220, 120, 0.4)', 'rgba(255, 120, 200, 0.35)',
  'rgba(80, 170, 255, 0.4)', 'rgba(255, 150, 60, 0.4)', 'rgba(170, 120, 255, 0.4)',
] as const;

export const TEXT_GROESSE = 0.024;

// Radierer (E-07): Breite relativ zur Seitenbreite. „Mittel“ ist die bisherige
// feste Breite.
export const RADIERER_BREITEN = [
  { name: 'Fein', wert: 0.01 },
  { name: 'Mittel', wert: 0.024 },
  { name: 'Breit', wert: 0.045 },
  { name: 'Sehr breit', wert: 0.08 },
] as const;
export const RADIERER_STANDARD = RADIERER_BREITEN[1].wert;
export const radiererPruefen = (wert: unknown): number =>
  RADIERER_BREITEN.some((d) => d.wert === wert) ? (wert as number) : RADIERER_STANDARD;

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

// Eigene Farben (E-08, Pipette und Farbwähler): Stift und Text als „#rrggbb“,
// der Marker halbtransparent wie seine Palette („rgba(r, g, b, 0.4)“).
export function eigeneFarbe(werkzeug: ZeichenWerkzeug, rgb: RGB): string {
  return werkzeug === 'marker' ? markerFarbe(rgb) : hexVon(rgb);
}
// Mit der Pipette aufgenommen: Der Marker soll auf dem Papier den Ton
// treffen, den man angetippt hat (farbe.ts, markerFuer).
export function pipettenFarbe(werkzeug: ZeichenWerkzeug, punkt: RGB): string {
  return eigeneFarbe(werkzeug, werkzeug === 'marker' ? markerFuer(punkt) : punkt);
}
export function farbeGueltig(werkzeug: ZeichenWerkzeug, farbe: unknown): farbe is string {
  if (typeof farbe !== 'string') return false;
  if (FARBEN[werkzeug].includes(farbe)) return true;
  const rgb = rgbAus(farbe);
  return rgb !== null && eigeneFarbe(werkzeug, rgb) === farbe;
}

// Gespeicherte Einstellungen können fehlen oder von alten Ständen stammen —
// nur gültige Farben und bekannte Dicken gelten, sonst der Standard.
export function einstellungPruefen(werkzeug: ZeichenWerkzeug, wert: unknown): StiftEinstellung {
  const standard = STIFT_STANDARD[werkzeug];
  if (!wert || typeof wert !== 'object') return standard;
  const e = wert as Partial<StiftEinstellung>;
  const farbe = farbeGueltig(werkzeug, e.farbe) ? e.farbe : standard.farbe;
  const breite = werkzeug === 'text'
    ? TEXT_GROESSE
    : DICKEN[werkzeug].some((d) => d.wert === e.breite) ? (e.breite as number) : standard.breite;
  return { farbe, breite };
}

// Die zuletzt mit der Pipette aufgenommene Farbe, je Werkzeug.
export type Pipetten = Partial<Record<ZeichenWerkzeug, string>>;
export function pipettenPruefen(wert: unknown): Pipetten {
  if (!wert || typeof wert !== 'object') return {};
  const p: Pipetten = {};
  for (const w of ['stift', 'marker', 'text'] as const) {
    const f = (wert as Record<string, unknown>)[w];
    if (farbeGueltig(w, f)) p[w] = f;
  }
  return p;
}
