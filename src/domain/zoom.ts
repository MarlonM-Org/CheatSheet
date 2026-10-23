// Heranzoomen beim Anmerken (E-06): Faktor und Verschiebung des Blatts.
// Rein, getestet. Verschiebung in Bildschirm-Pixeln, gemessen von der Mitte
// des Rahmens in Ruhelage; z = 1 heißt: so wie ohne Zoom.

import type { Rechteck } from './ueben';

export interface Zoom { z: number; x: number; y: number }
export interface Groesse { b: number; h: number }
export interface Punkt { x: number; y: number }

export const OHNE_ZOOM: Zoom = { z: 1, x: 0, y: 0 };
export const ZOOM_MAX = 6;
// Einstellung (E-10): auch beim Lesen zoomen, nicht nur bei offener
// Stift-Palette. Reist mit der Sicherung (@/domain/einstellungen).
export const ZOOM_IMMER = 'ueben:zoom-immer';
// Kaum gezoomt: beim Loslassen ganz zurück, kein Rest-Zoom von 1,03.
const EINRASTEN = 1.08;

const faktor = (z: number) => Math.min(ZOOM_MAX, Math.max(1, z));

// Verschieben geht so weit, dass jeder Punkt des Rahmens in die Mitte
// kommt — auch der Rand, daneben bleibt leere Fläche. Weiter nicht.
export function begrenzen(zoom: Zoom, rahmen: Groesse): Zoom {
  const z = faktor(zoom.z);
  const mx = (rahmen.b * z) / 2, my = (rahmen.h * z) / 2;
  return { z, x: Math.min(mx, Math.max(-mx, zoom.x)), y: Math.min(my, Math.max(-my, zoom.y)) };
}

// Zoomen um den Punkt p (Bildschirm, von der Rahmenmitte aus): Was unter p liegt, bleibt dort.
export function zoomenUm(zoom: Zoom, mal: number, p: Punkt, rahmen: Groesse): Zoom {
  const z = faktor(zoom.z * mal), k = z / zoom.z;
  return begrenzen({ z, x: p.x - (p.x - zoom.x) * k, y: p.y - (p.y - zoom.y) * k }, rahmen);
}

// Zwei Finger: Der Abstand ändert den Faktor, die Mitte zwischen ihnen zieht
// das Blatt mit. a0, b0 beim Aufsetzen, a1, b1 jetzt.
export function zweiFinger(start: Zoom, a0: Punkt, b0: Punkt, a1: Punkt, b1: Punkt, rahmen: Groesse): Zoom {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y), d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const z = faktor(start.z * (d0 > 0 ? d1 / d0 : 1)), k = z / start.z;
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  return begrenzen({ z, x: m1.x - (m0.x - start.x) * k, y: m1.y - (m0.y - start.y) * k }, rahmen);
}

export const einrasten = (zoom: Zoom): Zoom => (zoom.z < EINRASTEN ? OHNE_ZOOM : zoom);
export const gezoomt = (zoom: Zoom) => zoom.z > 1;

// Sichtbarer Teil der Seite (Anteile 0…1) — ihn rendert der Betrachter beim
// Zoomen scharf nach. platz: die Fläche, in deren Mitte der Rahmen liegt;
// blatt: Lage der ganzen Seite im Rahmen (darstellung, ausschnitt.ts). rand:
// so viel mehr je Seite (Anteil des Sichtbaren), damit kleines Schieben
// nicht gleich unscharf wird. Nichts von der Seite zu sehen: null.
export function sichtbarerTeil(zoom: Zoom, platz: Groesse, rahmen: Groesse,
  blatt: { b: number; h: number; x: number; y: number }, rand = 0): Rechteck | null {
  // Bildschirm → Rahmen (ungezoomt, von links oben), nur innerhalb des Rahmens.
  const zuRahmen = (s: number, t: number, laenge: number) => (s - t) / zoom.z + laenge / 2;
  const l = Math.max(0, zuRahmen(-platz.b / 2, zoom.x, rahmen.b)), r = Math.min(rahmen.b, zuRahmen(platz.b / 2, zoom.x, rahmen.b));
  const o = Math.max(0, zuRahmen(-platz.h / 2, zoom.y, rahmen.h)), u = Math.min(rahmen.h, zuRahmen(platz.h / 2, zoom.y, rahmen.h));
  if (r <= l || u <= o) return null;
  const rx = (r - l) * rand, ry = (u - o) * rand;
  const x0 = Math.max(0, (l - rx - blatt.x) / blatt.b), x1 = Math.min(1, (r + rx - blatt.x) / blatt.b);
  const y0 = Math.max(0, (o - ry - blatt.y) / blatt.h), y1 = Math.min(1, (u + ry - blatt.y) / blatt.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}
