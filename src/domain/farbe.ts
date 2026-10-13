// Farben umrechnen (E-08): Hex, RGB, HSV — für Pipette und Farbwähler.
// Rein, getestet.

export interface RGB { r: number; g: number; b: number } // 0…255
export interface HSV { h: number; s: number; v: number } // h 0…360, s und v 0…1

const kanal = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
const zwei = (x: number) => kanal(x).toString(16).padStart(2, '0');

export const hexVon = ({ r, g, b }: RGB) => `#${zwei(r)}${zwei(g)}${zwei(b)}`;

// „#abc“, „#aabbcc“, „rgb(…)“, „rgba(…)“ → RGB (die Deckkraft fällt weg); sonst null.
export function rgbAus(farbe: string): RGB | null {
  const f = farbe.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(f);
  if (m) {
    const [r, g, b] = [...m[1]].map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  m = /^#([0-9a-f]{6})$/.exec(f);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
  }
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/.exec(f);
  if (m) {
    const [r, g, b] = m.slice(1, 4).map(Number);
    if (r <= 255 && g <= 255 && b <= 255) return { r, g, b };
  }
  return null;
}

// Eingabe im Hex-Feld: mit oder ohne „#“, drei oder sechs Stellen.
export function hexEingabe(text: string): string | null {
  const t = text.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return null;
  return hexVon(rgbAus(`#${t}`)!);
}

export function hsvAus({ r, g, b }: RGB): HSV {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), d = max - Math.min(R, G, B);
  let h = 0;
  if (d) {
    h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function rgbAusHsv({ h, s, v }: HSV): RGB {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: kanal((r + m) * 255), g: kanal((g + m) * 255), b: kanal((b + m) * 255) };
}

// Hell genug für ein dunkles Zeichen darauf (Pipette auf ihrer Farbe)?
export const istHell = ({ r, g, b }: RGB) => 0.299 * r + 0.587 * g + 0.114 * b > 150;

// ── Marker ── Er legt seine Farbe zu 40 % auf das Papier (multipliziert).
export const MARKER_DECKKRAFT = 0.4;
export const markerFarbe = ({ r, g, b }: RGB) => `rgba(${kanal(r)}, ${kanal(g)}, ${kanal(b)}, ${MARKER_DECKKRAFT})`;

// Aufgenommener Ton → Markerfarbe, die auf weißem Papier genau diesen Ton
// ergibt — so weit das geht (ein Marker wird nie dunkler als 60 % Weiß).
export function markerFuer(p: RGB): RGB {
  const a = MARKER_DECKKRAFT, z = (x: number) => kanal((x - 255 * (1 - a)) / a);
  return { r: z(p.r), g: z(p.g), b: z(p.b) };
}

// ── Pipette ── Ein kleines Feld (RGBA, quadratisch, ungerade Kante) um den
// Finger. Ist die Mitte fast weiß — neben einen dünnen Strich getippt —,
// zählt der Punkt, der sich am deutlichsten vom Papier abhebt. Punkte
// außerhalb der Leinwand (durchsichtig) zählen nicht. Nichts da: null.
export function pipettenPunkt(daten: ArrayLike<number>, kante: number): RGB | null {
  const punkt = (i: number): RGB | null => (daten[i * 4 + 3] === 0 ? null : { r: daten[i * 4], g: daten[i * 4 + 1], b: daten[i * 4 + 2] });
  const abstand = (p: RGB) => 765 - p.r - p.g - p.b;
  const mitte = punkt((kante * kante - 1) / 2);
  if (mitte && abstand(mitte) > 30) return mitte;
  let bester = mitte;
  for (let i = 0; i < kante * kante; i++) {
    const p = punkt(i);
    if (p && (!bester || abstand(p) > abstand(bester))) bester = p;
  }
  return bester;
}
