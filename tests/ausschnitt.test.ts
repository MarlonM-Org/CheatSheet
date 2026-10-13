import { describe, expect, it } from 'vitest';
import {
  ausschnitteLesen, ausschnittFuer, ausschnittSetzen, aufspannen, darstellung, fuerAlleSeiten, istVoll, MIN, VOLL, ziehen,
} from '@/domain/ausschnitt';

const r = (x: number, y: number, b: number, h: number) => ({ x, y, b, h });
const nah = (a: { x: number; y: number; b: number; h: number }, e: typeof a) =>
  (['x', 'y', 'b', 'h'] as const).forEach((k) => expect(a[k]).toBeCloseTo(e[k], 6));

describe('Ausschnitt an Griffen ziehen', () => {
  const a = r(0.1, 0.1, 0.8, 0.8);
  it('Kanten verschieben nur ihre Seite', () => {
    nah(ziehen(a, 'n', 0, 0.05), r(0.1, 0.15, 0.8, 0.75));
    nah(ziehen(a, 's', 0, -0.1), r(0.1, 0.1, 0.8, 0.7));
    nah(ziehen(a, 'w', 0.05, 0), r(0.15, 0.1, 0.75, 0.8));
    nah(ziehen(a, 'o', 0.05, 0), r(0.1, 0.1, 0.85, 0.8));
  });
  it('Ecken verschieben zwei Seiten', () => {
    nah(ziehen(a, 'nw', -0.05, -0.05), r(0.05, 0.05, 0.85, 0.85));
    nah(ziehen(a, 'so', 0.05, 0.05), r(0.1, 0.1, 0.85, 0.85));
  });
  it('nie über den Seitenrand und nie kleiner als MIN', () => {
    nah(ziehen(a, 'nw', -0.5, -0.5), r(0, 0, 0.9, 0.9));
    nah(ziehen(a, 'o', -0.9, 0), r(0.1, 0.1, MIN, 0.8));
    nah(ziehen(a, 'n', 0, 0.9), r(0.1, 0.9 - MIN, 0.8, MIN));
  });
  it('Mitte verschiebt den ganzen Rahmen, bleibt auf der Seite', () => {
    nah(ziehen(a, 'mitte', 0.05, -0.02), r(0.15, 0.08, 0.8, 0.8));
    nah(ziehen(a, 'mitte', 0.5, 0.5), r(0.2, 0.2, 0.8, 0.8));
  });
  it('neuer Rahmen aufgespannt; zu klein → null', () => {
    nah(aufspannen(0.8, 0.9, 0.2, 0.1)!, r(0.2, 0.1, 0.6, 0.8));
    expect(aufspannen(0.2, 0.2, 0.25, 0.9)).toBeNull();
  });
});

describe('Speichern je Seite', () => {
  it('ganze Seite wird nicht gespeichert, gerundet', () => {
    expect(istVoll(r(0.001, 0, 0.999, 1))).toBe(true);
    expect(ausschnittSetzen({ 2: r(0.1, 0.1, 0.8, 0.8) }, 2, VOLL)).toEqual({});
    expect(ausschnittSetzen({}, 3, r(0.123456, 0.1, 0.8, 0.7))).toEqual({ 3: r(0.1235, 0.1, 0.8, 0.7) });
  });
  it('für alle Seiten übernehmen', () => {
    expect(fuerAlleSeiten(3, r(0.1, 0.1, 0.8, 0.8))).toEqual({ 1: r(0.1, 0.1, 0.8, 0.8), 2: r(0.1, 0.1, 0.8, 0.8), 3: r(0.1, 0.1, 0.8, 0.8) });
    expect(fuerAlleSeiten(3, VOLL)).toEqual({});
  });
  it('liest nur stimmige Einträge (Sicherung, ältere Stände)', () => {
    expect(ausschnitteLesen(undefined)).toEqual({});
    expect(ausschnitteLesen({ 1: r(0.1, 0.1, 0.8, 0.8), 2: r(0.5, 0.5, 0.8, 0.8), x: r(0, 0, 0.5, 0.5), 3: { x: 'a' }, 4: r(0, 0, 0.01, 0.5) }))
      .toEqual({ 1: r(0.1, 0.1, 0.8, 0.8) });
  });
  it('Halbseiten-Ansicht: was beide Seiten zeigen wollen (ohne Ausschnitt: ganz)', () => {
    const alle = { 1: r(0.1, 0.05, 0.8, 0.9), 2: r(0.05, 0.1, 0.8, 0.85) };
    nah(ausschnittFuer(alle, [1, 2]), r(0.05, 0.05, 0.85, 0.9));
    expect(ausschnittFuer(alle, [2, 3])).toEqual(VOLL);
    expect(ausschnittFuer(alle, [1])).toEqual(alle[1]);
  });
});

describe('Darstellung: der Ausschnitt füllt den Platz', () => {
  it('ganze Seite wie bisher eingepasst', () => {
    expect(darstellung({ b: 408, h: 808 }, 1.414, VOLL)).toEqual({ rahmen: { b: 400, h: 565 }, blatt: { b: 400, h: 565, x: -0, y: -0 } });
  });
  it('Ausschnitt: Blatt größer, so verschoben, dass der Bereich im Rahmen steht', () => {
    const d = darstellung({ b: 408, h: 1008 }, 1.414, r(0.1, 0.1, 0.8, 0.5));
    expect(d.rahmen).toEqual({ b: 400, h: 353 });
    expect(d.blatt.b).toBeCloseTo(500, 6);
    expect(d.blatt.x).toBeCloseTo(-50, 6);
    expect(d.blatt.h).toBeCloseTo(706, 6);
    expect(d.blatt.y).toBeCloseTo(-70.6, 6);
  });
});
