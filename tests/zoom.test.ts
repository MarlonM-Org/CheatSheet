import { describe, expect, it } from 'vitest';
import { begrenzen, einrasten, OHNE_ZOOM, sichtbarerTeil, ZOOM_MAX, zoomenUm, zweiFinger } from '@/domain/zoom';

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
