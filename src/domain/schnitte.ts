// Schere (E-12): Schnitte teilen eine Seite und schieben alles darunter nach
// unten; die Lücke ist Platz zum Schreiben. Die Seite behält ihre
// Koordinaten — gerechnet wird nur ein Versatz je Teilstück beim Zeichnen
// und beim Tippen. Höhen hier immer in Seitenhöhen der ursprünglichen
// Seite (1 = die ganze Seite). Rein und getestet.

import type { Anmerkung } from './notenpult';

export interface Schnitt { id: string; y: number; abstand: number }
// Kleinster Abstand, der als Lücke bleibt — darunter ist der Schnitt weg.
export const ABSTAND_MIN = 0.015;
export const ABSTAND_MAX = 1;

export const istSchnitt = (a: Anmerkung): a is Extract<Anmerkung, { art: 'schnitt' }> => a.art === 'schnitt';
export const istSticker = (a: Anmerkung): a is Extract<Anmerkung, { art: 'sticker' }> => a.art === 'sticker';

// Die Schnitte einer Seite, von oben nach unten.
export function schnitteVon(objekte: readonly Anmerkung[]): Schnitt[] {
  return objekte.filter(istSchnitt).map(({ id, y, abstand }) => ({ id, y, abstand })).sort((a, b) => a.y - b.y);
}

// Höhe des gedehnten Blatts in Seitenhöhen.
export const dehnung = (s: readonly Schnitt[]) => 1 + s.reduce((summe, x) => summe + x.abstand, 0);

// Teilstücke der Seite: ihr Bereich auf der ursprünglichen Seite und wie weit
// sie auf dem Blatt nach unten rücken.
export interface Teilstueck { y0: number; y1: number; versatz: number }
export function teilstuecke(s: readonly Schnitt[]): Teilstueck[] {
  const teile: Teilstueck[] = [];
  let y0 = 0, versatz = 0;
  for (const x of s) {
    teile.push({ y0, y1: x.y, versatz });
    y0 = x.y; versatz += x.abstand;
  }
  teile.push({ y0, y1: 1, versatz });
  return teile;
}

// Die Lücken: Oberkante auf dem gedehnten Blatt (Seitenhöhen) und Höhe.
export interface Luecke { id: string; oben: number; abstand: number }
export function luecken(s: readonly Schnitt[]): Luecke[] {
  let versatz = 0;
  return s.map((x) => { const l = { id: x.id, oben: x.y + versatz, abstand: x.abstand }; versatz += x.abstand; return l; });
}

// Wo auf der Seite liegt eine Höhe des gedehnten Blatts? Entweder in einem
// Teilstück (y auf der ursprünglichen Seite) oder in einer Lücke (y ab deren
// Oberkante). `bezug` ist, was man von der Blatt-Höhe abzieht — damit ein
// Strich, der hier beginnt, Punkt für Punkt gleich umgerechnet wird.
export type Ort = { luecke: string | null; y: number; bezug: number };
export function zurSeite(s: readonly Schnitt[], yBlatt: number): Ort {
  let versatz = 0;
  for (const x of s) {
    if (yBlatt <= x.y + versatz) return { luecke: null, y: yBlatt - versatz, bezug: versatz };
    if (yBlatt < x.y + versatz + x.abstand) return { luecke: x.id, y: yBlatt - (x.y + versatz), bezug: x.y + versatz };
    versatz += x.abstand;
  }
  return { luecke: null, y: yBlatt - versatz, bezug: versatz };
}

// Umgekehrt: eine Höhe der Seite (oder ab Oberkante einer Lücke) aufs
// gedehnte Blatt. Ein Punkt genau auf einem Schnitt gehört zum Teil darüber.
export function aufsBlatt(s: readonly Schnitt[], y: number, luecke: string | null = null): number {
  let versatz = 0;
  for (const x of s) {
    if (luecke === x.id) return x.y + versatz + y;
    if (luecke === null && y <= x.y) return y + versatz;
    versatz += x.abstand;
  }
  return y + versatz;
}

// Ein Rechteck der Seite (etwa der Ausschnitt) auf dem gedehnten Blatt, als
// Anteile des Blatts.
export function rechteckGedehnt(s: readonly Schnitt[], r: { x: number; y: number; b: number; h: number }) {
  const d = dehnung(s), oben = aufsBlatt(s, r.y), unten = aufsBlatt(s, r.y + r.h);
  return { x: r.x, y: oben / d, b: r.b, h: (unten - oben) / d };
}

// Schnitt setzen oder verändern. Zu kleiner Abstand entfernt den Schnitt —
// samt allem, was in seiner Lücke stand.
export function schnittSetzen(objekte: Anmerkung[], id: string, y: number, abstand: number): Anmerkung[] {
  const a = Math.min(ABSTAND_MAX, abstand);
  if (a < ABSTAND_MIN) return schnittEntfernen(objekte, id);
  const yk = Math.max(0.02, Math.min(0.98, y));
  const da = objekte.some((o) => o.id === id);
  return da
    ? objekte.map((o) => (o.id === id && o.art === 'schnitt' ? { ...o, y: yk, abstand: a } : o))
    : [...objekte, { id, art: 'schnitt', y: yk, abstand: a }];
}
export function schnittEntfernen(objekte: Anmerkung[], id: string): Anmerkung[] {
  return objekte.filter((o) => o.id !== id && !('luecke' in o && o.luecke === id));
}

// ── Sticker ──
export type Sticker = Extract<Anmerkung, { art: 'sticker' }>;
// Höhe auf der Zielseite: folgt dem Seitenverhältnis des Ausschnitts
// (Quelle und Ziel haben dasselbe Seitenformat).
export const stickerHoehe = (st: Sticker) => st.b * (st.von.h / st.von.b);
export const stickerRechteck = (st: Sticker) => ({ x: st.x, y: st.y, b: st.b, h: stickerHoehe(st) });
export const stickerGetroffen = (st: Sticker, x: number, y: number) => {
  const r = stickerRechteck(st);
  return x >= r.x && x <= r.x + r.b && y >= r.y && y <= r.y + r.h;
};
// Sticker aus einem Ausschnitt anlegen: liegt zunächst etwas versetzt über
// dem Original (so sieht man ihn, und er bleibt im Bild).
export function stickerAus(id: string, seite: number, r: { x: number; y: number; b: number; h: number }): Sticker {
  const x = Math.min(1 - r.b, r.x + 0.04), y = Math.min(1 - r.h, r.y + 0.04);
  return { id, art: 'sticker', von: { seite, ...r }, x: Math.max(0, x), y: Math.max(0, y), b: r.b };
}
// Verschieben und Größe ändern — bleibt mit mindestens einem Viertel im Bild,
// mindestens 5 % breit, höchstens die ganze Seite.
export function stickerBewegen(st: Sticker, dx: number, dy: number): Sticker {
  const h = stickerHoehe(st);
  return { ...st, x: Math.max(-st.b * 0.75, Math.min(1 - st.b * 0.25, st.x + dx)), y: Math.max(-h * 0.75, Math.min(1 - h * 0.25, st.y + dy)) };
}
export function stickerSkalieren(st: Sticker, b: number): Sticker {
  return { ...st, b: Math.max(0.05, Math.min(1, b)) };
}
