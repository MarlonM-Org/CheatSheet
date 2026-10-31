import { describe, expect, it } from 'vitest';
import { anBreite, aufStelle, begrenzen, einrasten, istDoppeltipp, OHNE_ZOOM, sichtbarerTeil, ZOOM_MAX, zoomenUm, zweiFinger } from '@/domain/zoom';

const rahmen = { b: 600, h: 800 };

describe('Zoom', () => {
  it('Faktor zwischen 1 und dem Höchstwert', () => {
    expect(begrenzen({ z: 0.5, x: 0, y: 0 }, rahmen).z).toBe(1);
    expect(begrenzen({ z: 99, x: 0, y: 0 }, rahmen).z).toBe(ZOOM_MAX);
  });
  it('Verschieben bis der Rand in der Mitte steht, nicht weiter', () => {
    // z = 2: Der rechte Rand liegt 600 px rechts der Mitte; −600 holt ihn in die Mitte.
    expect(begrenzen({ z: 2, x: -5000, y: 5000 }, rahmen)).toEqual({ z: 2, x: -600, y: 800 });
    expect(begrenzen({ z: 2, x: -100, y: 30 }, rahmen)).toEqual({ z: 2, x: -100, y: 30 });
  });
  it('zoomt um einen Punkt: was darunter liegt, bleibt dort', () => {
    const p = { x: 120, y: -80 };
    const z = zoomenUm(OHNE_ZOOM, 2, p, rahmen);
    // Blattpunkt unter p vorher: (p − t)/z = p; nachher: (p − t')/z' muss gleich sein.
    expect((p.x - z.x) / z.z).toBeCloseTo(p.x);
    expect((p.y - z.y) / z.z).toBeCloseTo(p.y);
    expect(zoomenUm(z, 1 / 4, p, rahmen).z).toBe(1);
  });
  it('zwei Finger: Abstand ist der Faktor, die Mitte zieht mit', () => {
    const z = zweiFinger(OHNE_ZOOM, { x: -50, y: 0 }, { x: 50, y: 0 }, { x: -60, y: 20 }, { x: 140, y: 20 }, rahmen);
    expect(z.z).toBeCloseTo(2);
    // Der Blattpunkt unter der alten Mitte (0, 0) liegt jetzt unter der neuen (40, 20).
    expect(z.x).toBeCloseTo(40);
    expect(z.y).toBeCloseTo(20);
  });
  it('kaum gezoomt rastet beim Loslassen auf 1 ein', () => {
    expect(einrasten({ z: 1.03, x: 12, y: 4 })).toEqual(OHNE_ZOOM);
    expect(einrasten({ z: 1.5, x: 12, y: 4 })).toEqual({ z: 1.5, x: 12, y: 4 });
  });
});

describe('Sichtbarer Teil der Seite', () => {
  const blatt = { b: 600, h: 800, x: 0, y: 0 };
  it('ohne Zoom die ganze Seite', () => {
    expect(sichtbarerTeil(OHNE_ZOOM, { b: 1000, h: 900 }, rahmen, blatt)).toEqual({ x: 0, y: 0, b: 1, h: 1 });
  });
  it('doppelt gezoomt in der Mitte: das mittlere Viertel, mit Rand etwas mehr', () => {
    const t = sichtbarerTeil({ z: 2, x: 0, y: 0 }, { b: 600, h: 800 }, rahmen, blatt)!;
    expect(t.x).toBeCloseTo(0.25); expect(t.b).toBeCloseTo(0.5);
    expect(t.y).toBeCloseTo(0.25); expect(t.h).toBeCloseTo(0.5);
    const mitRand = sichtbarerTeil({ z: 2, x: 0, y: 0 }, { b: 600, h: 800 }, rahmen, blatt, 0.1)!;
    expect(mitRand.x).toBeCloseTo(0.2); expect(mitRand.b).toBeCloseTo(0.6);
  });
  it('Rand in der Mitte: nur die halbe Fläche zeigt Seite', () => {
    const t = sichtbarerTeil({ z: 2, x: -600, y: 0 }, { b: 600, h: 800 }, rahmen, blatt)!;
    expect(t.x).toBeCloseTo(0.75); expect(t.x + t.b).toBeCloseTo(1);
  });
  it('mit Ausschnitt: in Seitenanteilen, nur was im Rahmen liegt', () => {
    // Rahmen zeigt die rechte Hälfte der Seite: Blatt doppelt so breit, nach links verschoben.
    const t = sichtbarerTeil(OHNE_ZOOM, { b: 1000, h: 900 }, rahmen, { b: 1200, h: 800, x: -600, y: 0 })!;
    expect(t.x).toBeCloseTo(0.5); expect(t.b).toBeCloseTo(0.5);
  });
});

describe('Doppeltipp: an die Breite', () => {
  // Querformat: Platz 1000 × 700, hochformatige Seite füllt die Höhe: Rahmen 490 × 692.
  const platz = { b: 1000, h: 700 }, r = { b: 490, h: 692 };
  const blatt = { b: 490, h: 692, x: 0, y: 0 };
  it('zieht die Seite auf die Platzbreite, Oberkante oben', () => {
    const z = anBreite(platz, r, blatt);
    expect(z.z).toBeCloseTo(1000 / 490);
    expect(z.x).toBe(0);
    // Gezoomte Rahmenhöhe 1412 > 700: Oberkante des Rahmens an die Oberkante des Platzes.
    expect(z.y).toBeCloseTo((692 * z.z - 700) / 2);
  });
  it('legt die Mitte einer Stelle in die Bildschirmmitte', () => {
    const z = anBreite(platz, r, blatt, 0.25);
    // Punkt bei 25 % der Seite (173 px) soll in der Mitte liegen: Verschiebung = (346 − 173) · z nach unten.
    expect(z.y).toBeCloseTo((692 / 2 - 0.25 * 692) * z.z);
    expect(anBreite(platz, r, blatt, 0.5).y).toBeCloseTo(0);
  });
  it('bleibt in den Grenzen des Verschiebens', () => {
    const z = anBreite(platz, r, blatt, 0);
    expect(z.y).toBeLessThanOrEqual((r.h * z.z) / 2);
  });
  it('Hochformat: die Seite füllt die Breite schon — kein Zoom', () => {
    expect(anBreite({ b: 600, h: 1000 }, { b: 592, h: 837 }, { b: 592, h: 837, x: 0, y: 0 })).toEqual(OHNE_ZOOM);
  });
  it('mit Ausschnitt rechnet die Seitenlage im Rahmen mit', () => {
    // Ausschnitt zeigt die untere Hälfte: das Blatt ragt oben aus dem Rahmen (y negativ).
    const z = anBreite(platz, { b: 490, h: 346 }, { b: 490, h: 692, x: 0, y: -346 }, 0.75);
    // 75 % der Seite liegt genau in der Rahmenmitte → keine Verschiebung.
    expect(z.y).toBeCloseTo(0);
  });
  it('Stelle: so weit heran, dass sie den Platz füllt, ihre Mitte in der Bildschirmmitte', () => {
    // Breites Band in der oberen Hälfte: die Breite stößt zuerst an.
    const st = { x: 0.1, y: 0.2, b: 0.8, h: 0.1 };
    const z = aufStelle(platz, r, blatt, st);
    expect(z.z).toBeCloseTo((1000 / (0.8 * 490)) * 0.92);
    // Mitte der Stelle (245 px, 173 px) liegt in der Mitte: Rahmenmitte (245, 346) wird um (346 − 173) · z nach unten geschoben.
    expect(z.x).toBeCloseTo(0);
    expect(z.y).toBeCloseTo((346 - 0.25 * 692) * z.z);
    // Hohe, schmale Stelle: die Höhe stößt zuerst an, der Faktor bleibt unter dem Höchstwert.
    const hoch = aufStelle(platz, r, blatt, { x: 0.4, y: 0.1, b: 0.1, h: 0.8 });
    expect(hoch.z).toBeCloseTo((700 / (0.8 * 692)) * 0.92);
    expect(aufStelle(platz, r, blatt, { x: 0.45, y: 0.45, b: 0.02, h: 0.02 }).z).toBe(ZOOM_MAX);
  });
  it('Stelle, die den Platz schon füllt, oder ohne Fläche: kein Zoom', () => {
    expect(aufStelle({ b: 600, h: 1000 }, { b: 592, h: 837 }, { b: 592, h: 837, x: 0, y: 0 }, { x: 0, y: 0, b: 1, h: 1 })).toEqual(OHNE_ZOOM);
    expect(aufStelle(platz, r, blatt, { x: 0.2, y: 0.2, b: 0, h: 0.1 })).toEqual(OHNE_ZOOM);
  });
  it('Stelle am Rand: die Verschiebung bleibt in den Grenzen', () => {
    const z = aufStelle(platz, r, blatt, { x: 0, y: 0, b: 0.3, h: 0.05 });
    expect(Math.abs(z.x)).toBeLessThanOrEqual((r.b * z.z) / 2);
    expect(Math.abs(z.y)).toBeLessThanOrEqual((r.h * z.z) / 2);
  });
  it('erkennt zwei Tipps kurz nacheinander nahe beieinander', () => {
    expect(istDoppeltipp(null, { x: 0, y: 0, t: 1000 })).toBe(false);
    expect(istDoppeltipp({ x: 0, y: 0, t: 1000 }, { x: 10, y: 5, t: 1400 })).toBe(true);
    expect(istDoppeltipp({ x: 0, y: 0, t: 1000 }, { x: 10, y: 5, t: 1500 })).toBe(false);
    expect(istDoppeltipp({ x: 0, y: 0, t: 1000 }, { x: 80, y: 5, t: 1200 })).toBe(false);
  });
});
