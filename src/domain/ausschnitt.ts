// Ausschnitt je Seite: welcher Bereich einer PDF-Seite angezeigt wird —
// z. B. ohne die breiten weißen Ränder eines Scans. Gespeichert am Stück
// (`ausschnitte`, je Seitennummer), in Anteilen der Seite wie Stellen und
// Anmerkungen; die bleiben in Seiten-Koordinaten, nur die Anzeige rückt
// zurecht. Rein, getestet.

import type { Rechteck } from './ueben';

export const VOLL: Rechteck = { x: 0, y: 0, b: 1, h: 1 };
export const MIN = 0.15; // kleinster Ausschnitt: so viel der Seite bleibt mindestens
export type Ausschnitte = Record<number, Rechteck>;
// Griffe: Kanten und Ecken nach Himmelsrichtung, „mitte“ verschiebt.
export type Griff = 'n' | 's' | 'w' | 'o' | 'nw' | 'no' | 'sw' | 'so' | 'mitte';

const klemmen = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ziehen(r: Rechteck, griff: Griff, dx: number, dy: number): Rechteck {
  if (griff === 'mitte') return { ...r, x: klemmen(r.x + dx, 0, 1 - r.b), y: klemmen(r.y + dy, 0, 1 - r.h) };
  let links = r.x, oben = r.y, rechts = r.x + r.b, unten = r.y + r.h;
  if (griff.includes('w')) links = klemmen(links + dx, 0, rechts - MIN);
  if (griff.includes('o')) rechts = klemmen(rechts + dx, links + MIN, 1);
  if (griff.includes('n')) oben = klemmen(oben + dy, 0, unten - MIN);
  if (griff.includes('s')) unten = klemmen(unten + dy, oben + MIN, 1);
  return { x: links, y: oben, b: rechts - links, h: unten - oben };
}

// Neuen Rahmen aufziehen (außerhalb des alten angesetzt). Zu klein: null —
// ein versehentliches Tippen daneben lässt den alten stehen.
export function aufspannen(x1: number, y1: number, x2: number, y2: number): Rechteck | null {
  const k = (v: number) => klemmen(v, 0, 1);
  const x = k(Math.min(x1, x2)), y = k(Math.min(y1, y2));
  const b = k(Math.max(x1, x2)) - x, h = k(Math.max(y1, y2)) - y;
  return b < MIN || h < MIN ? null : { x, y, b, h };
}

export const istVoll = (r: Rechteck) => r.x < 0.005 && r.y < 0.005 && r.x + r.b > 0.995 && r.y + r.h > 0.995;
const runden = (r: Rechteck): Rechteck => {
  const z = (v: number) => Math.round(v * 10000) / 10000;
  return { x: z(r.x), y: z(r.y), b: z(r.b), h: z(r.h) };
};

// Ganze Seite heißt: kein Eintrag.
export function ausschnittSetzen(alle: Ausschnitte, seite: number, r: Rechteck): Ausschnitte {
  const neu = { ...alle };
  if (istVoll(r)) delete neu[seite];
  else neu[seite] = runden(r);
  return neu;
}

export function fuerAlleSeiten(seiten: number, r: Rechteck): Ausschnitte {
  if (istVoll(r)) return {};
  return Object.fromEntries(Array.from({ length: seiten }, (_, i) => [i + 1, runden(r)]));
}

const stimmig = (r: unknown): r is Rechteck => {
  if (!r || typeof r !== 'object') return false;
  const { x, y, b, h } = r as Record<string, unknown>;
  if (![x, y, b, h].every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
  const [X, Y, B, H] = [x, y, b, h] as number[];
  return X >= 0 && Y >= 0 && B >= MIN - 1e-9 && H >= MIN - 1e-9 && X + B <= 1 + 1e-9 && Y + H <= 1 + 1e-9;
};

export function ausschnitteLesen(roh: unknown): Ausschnitte {
  if (!roh || typeof roh !== 'object') return {};
  const aus: Ausschnitte = {};
  for (const [k, v] of Object.entries(roh)) {
    const seite = Number(k);
    if (Number.isInteger(seite) && seite >= 1 && stimmig(v)) aus[seite] = { x: v.x, y: v.y, b: v.b, h: v.h };
  }
  return aus;
}

// Was gerade zu sehen ist: eine Seite oder (Halbseiten-Blättern) zwei —
// dann der Bereich, der beide Ausschnitte umfasst.
export function ausschnittFuer(alle: Ausschnitte, seiten: number[]): Rechteck {
  const teile = seiten.map((s) => alle[s] ?? VOLL);
  if (teile.length === 1) return teile[0];
  const links = Math.min(...teile.map((t) => t.x)), oben = Math.min(...teile.map((t) => t.y));
  const rechts = Math.max(...teile.map((t) => t.x + t.b)), unten = Math.max(...teile.map((t) => t.y + t.h));
  return istVoll({ x: links, y: oben, b: rechts - links, h: unten - oben }) ? VOLL : { x: links, y: oben, b: rechts - links, h: unten - oben };
}

// Rahmen (sichtbar, so groß wie der Platz erlaubt) und Blatt (die ganze
// Seite, so vergrößert und verschoben, dass der Ausschnitt den Rahmen füllt).
// format = Höhe/Breite der Seite.
export function darstellung(platz: { b: number; h: number }, format: number, r: Rechteck) {
  const verhaeltnis = (r.h * format) / r.b;
  const breite = Math.min(platz.b - 8, (platz.h - 8) / verhaeltnis);
  const rahmen = { b: Math.floor(breite), h: Math.floor(breite * verhaeltnis) };
  // Genau füllen (gerundeter Rahmen): Abweichung vom Seitenformat unter einem Pixel.
  const b = rahmen.b / r.b, h = rahmen.h / r.h;
  return { rahmen, blatt: { b, h, x: -r.x * b, y: -r.y * h } };
}

// Zwei Seiten nebeneinander (B-13): jede Seite bekommt die halbe Breite (mit
// Lücke dazwischen), derselbe Ausschnitt gilt für beide. Das Blatt umfasst
// beide ganzen Seiten; `lagen` sagt je Seite, wo sie auf dem Blatt liegt —
// als Anteile des Blatts, damit Marken und Punkte in Seiten-Koordinaten
// bleiben können.
export interface SeitenLage { x: number; y: number; b: number; h: number }
export function doppelDarstellung(platz: { b: number; h: number }, format: number, r: Rechteck, luecke = 10) {
  const einzeln = darstellung({ b: (platz.b - luecke) / 2 + 8, h: platz.h }, format, r);
  const { b: rb, h: rh } = einzeln.rahmen, pb = einzeln.blatt.b, ph = einzeln.blatt.h;
  const versatz = rb + luecke;
  const blatt = { b: versatz + pb, h: ph, x: einzeln.blatt.x, y: einzeln.blatt.y };
  const lage = (x: number): SeitenLage => ({ x: x / blatt.b, y: 0, b: pb / blatt.b, h: 1 });
  return {
    rahmen: { b: 2 * rb + luecke, h: rh },
    blatt,
    lagen: { links: lage(0), rechts: lage(versatz) },
    // Die Lücke zwischen den Seiten, als Anteile des Blatts.
    luecke: { x: pb / blatt.b, y: 0, b: (versatz - pb) / blatt.b, h: 1 } as SeitenLage,
  };
}
