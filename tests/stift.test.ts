import { describe, expect, it } from 'vitest';
import {
  DICKEN, einstellungPruefen, FARBEN, MARKER_DICKEN, MARKERFARBEN,
  STIFT_DICKEN, STIFT_STANDARD, STIFTFARBEN, TEXT_GROESSE,
} from '@/domain/stift';

describe('Dicken und Farben', () => {
  it('Dicken steigen auf und enthalten die bisherigen festen Werte', () => {
    const werte = (l: readonly { wert: number }[]) => l.map((d) => d.wert);
    expect(werte(STIFT_DICKEN)).toEqual([...werte(STIFT_DICKEN)].sort((a, b) => a - b));
    expect(werte(MARKER_DICKEN)).toEqual([...werte(MARKER_DICKEN)].sort((a, b) => a - b));
    expect(werte(STIFT_DICKEN)).toContain(0.0025); // alte Stift-Breite
    expect(werte(MARKER_DICKEN)).toContain(0.014); // alte Marker-Breite
  });
  it('Paletten sind eindeutig und enthalten die alten Standardfarben', () => {
    expect(new Set(STIFTFARBEN).size).toBe(STIFTFARBEN.length);
    expect(new Set(MARKERFARBEN).size).toBe(MARKERFARBEN.length);
    for (const alt of ['#1b1b1b', '#d12d2d', '#1f5fd1']) expect(STIFTFARBEN).toContain(alt);
    expect(MARKERFARBEN[0]).toBe('rgba(255, 214, 0, 0.45)');
    expect(STIFTFARBEN.length).toBeGreaterThanOrEqual(8);
  });
});

describe('einstellungPruefen', () => {
  it('lässt gültige Werte durch', () => {
    expect(einstellungPruefen('stift', { farbe: '#1f5fd1', breite: 0.004 })).toEqual({ farbe: '#1f5fd1', breite: 0.004 });
  });
  it('fällt bei Unsinn auf den Standard zurück', () => {
    expect(einstellungPruefen('stift', null)).toEqual(STIFT_STANDARD.stift);
    expect(einstellungPruefen('marker', { farbe: 'lila', breite: 99 })).toEqual(STIFT_STANDARD.marker);
    expect(einstellungPruefen('stift', { farbe: STIFTFARBEN[2], breite: 0.00001 })).toEqual({ farbe: STIFTFARBEN[2], breite: STIFT_STANDARD.stift.breite });
  });
  it('Text hat feste Größe und nur Farbwahl', () => {
    expect(einstellungPruefen('text', { farbe: STIFTFARBEN[3], breite: 0.5 })).toEqual({ farbe: STIFTFARBEN[3], breite: TEXT_GROESSE });
    expect(FARBEN.text).toBe(STIFTFARBEN);
    expect(DICKEN.text).toHaveLength(0);
  });
});
