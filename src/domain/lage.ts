// Lage schwebender Panels (Widgets, Stift-Palette) auf dem Bildschirm.

export interface Lage { x: number; y: number }
export interface Groesse { b: number; h: number }

// Lage so verschieben, dass das Panel ganz im Fenster liegt (mit Rand).
// Passt es nicht, gewinnt die linke obere Ecke — dort sitzt der Griff.
export function insBild(l: Lage, panel: Groesse, fenster: Groesse, rand = 4): Lage {
  return {
    x: Math.max(rand, Math.min(fenster.b - panel.b - rand, l.x)),
    y: Math.max(rand, Math.min(fenster.h - panel.h - rand, l.y)),
  };
}
