// Blättern per Geste (B-08): Finger, Scroll-Ring, Mausrad, Blätterpedal.
// Ein Scroll-Ring am iPhone (über AssistiveTouch) wischt wie ein Finger —
// im Video-Modus nach oben/unten, im Lese-Modus nach links/rechts. Pedale
// senden Tasten. Alles läuft auf weiter/zurück hinaus. Rein, getestet.

export type Blaetter = 'weiter' | 'zurueck';
export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';
export type Erkannt =
  | { art: 'wisch'; richtung: Richtung; weg: number; aktion: Blaetter }
  | { art: 'tippen' }
  | { art: 'nichts'; weg: number }; // zu kurz für einen Wisch, zu lang fürs Tippen

export const WISCH_MIN = 40; // px: ab hier ist es ein Wisch
const TIPP_WEG = 12; // px: so wenig Bewegung ist noch Tippen
const TIPP_DAUER = 600; // ms

// Wie beim Umblättern einer Seite bzw. beim Weiterwischen eines Videos:
// nach links oder oben = weiter. „Umkehren“ tauscht nur hoch und runter.
function aktion(r: Richtung, umkehren: boolean): Blaetter {
  if (r === 'links') return 'weiter';
  if (r === 'rechts') return 'zurueck';
  return (r === 'hoch') !== umkehren ? 'weiter' : 'zurueck';
}

export function zeigerGeste(dx: number, dy: number, dauer: number, umkehren = false): Erkannt {
  const weg = Math.round(Math.max(Math.abs(dx), Math.abs(dy)));
  if (weg >= WISCH_MIN) {
    const richtung: Richtung = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'links' : 'rechts') : (dy < 0 ? 'hoch' : 'runter');
    return { art: 'wisch', richtung, weg, aktion: aktion(richtung, umkehren) };
  }
  if (Math.hypot(dx, dy) <= TIPP_WEG && dauer <= TIPP_DAUER) return { art: 'tippen' };
  return { art: 'nichts', weg };
}

// ── Mausrad / Trackpad ── Eine Bewegung (auch mit Nachlauf) blättert genau
// einmal; erst nach RAD_PAUSE Ruhe zählt die nächste.
export const RAD_SCHWELLE = 40; // px
export const RAD_PAUSE = 250; // ms
export interface Rad { summe: number; fertig: boolean; zuletzt: number }
export const RAD_ANFANG: Rad = { summe: 0, fertig: false, zuletzt: -Infinity };

export function radGeste(z: Rad, dx: number, dy: number, t: number, umkehren = false): { z: Rad; aktion: Blaetter | null } {
  const neu = t - z.zuletzt > RAD_PAUSE;
  // Rad runter / nach rechts schiebt den Inhalt wie ein Wisch nach oben / links.
  const d = Math.abs(dx) > Math.abs(dy) ? dx : umkehren ? -dy : dy;
  const summe = (neu ? 0 : z.summe) + d;
  const fertig = neu ? false : z.fertig;
  if (!fertig && Math.abs(summe) >= RAD_SCHWELLE) return { z: { summe: 0, fertig: true, zuletzt: t }, aktion: summe > 0 ? 'weiter' : 'zurueck' };
  return { z: { summe, fertig, zuletzt: t }, aktion: null };
}

// WheelEvent.deltaMode: 0 Pixel, 1 Zeilen, 2 Seiten.
export const radWeg = (delta: number, modus: number, seitenhoehe: number) =>
  modus === 1 ? delta * 16 : modus === 2 ? delta * seitenhoehe : delta;

// ── Tasten ── Bluetooth-Blätterpedale senden meist Pfeil- oder Bild-Tasten.
export function tastenAktion(taste: string): Blaetter | null {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(taste)) return 'weiter';
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(taste)) return 'zurueck';
  return null;
}

export const WISCH_UMKEHREN = 'ueben:wisch-umkehren';
