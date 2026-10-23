import { describe, expect, it } from 'vitest';
import {
  DICKEN, einstellungPruefen, FARBEN, farbeGueltig, MARKER_DICKEN, MARKERFARBEN, pipettenFarbe, pipettenPruefen,
  RADIERER_BREITEN, RADIERER_STANDARD, radiererPruefen, STIFT_DICKEN, STIFT_STANDARD, STIFTFARBEN, TEXT_GROESSE,
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
    expect(STIFTFARBEN).not.toContain('#a8781f'); // Platz der Pipette (E-08)
  });
  it('Weiß statt Grau (E-09): Weiß zum Abdecken, Grau nur noch als eigene Farbe', () => {
    expect(STIFTFARBEN).toContain('#ffffff');
    expect(STIFTFARBEN).not.toContain('#5f5b53');
    expect(FARBEN.text).toContain('#ffffff');
    expect(MARKERFARBEN).not.toContain('#ffffff');
    // Ein früher gewähltes Grau bleibt gültig (Farbwähler-Form), nichts springt auf den Standard.
    expect(einstellungPruefen('stift', { farbe: '#5f5b53', breite: 0.004 })).toEqual({ farbe: '#5f5b53', breite: 0.004 });
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
  it('eigene Farben (Pipette, Farbwähler) gelten in der Form des Werkzeugs', () => {
    expect(einstellungPruefen('stift', { farbe: '#a8781f', breite: 0.004 })).toEqual({ farbe: '#a8781f', breite: 0.004 });
    expect(einstellungPruefen('marker', { farbe: 'rgba(10, 20, 30, 0.4)', breite: 0.014 }).farbe).toBe('rgba(10, 20, 30, 0.4)');
    expect(farbeGueltig('stift', '#A8781F')).toBe(false); // nur so, wie die App sie schreibt
    expect(farbeGueltig('stift', 'rgba(10, 20, 30, 0.4)')).toBe(false);
    expect(farbeGueltig('marker', '#a8781f')).toBe(false);
    expect(farbeGueltig('text', 42)).toBe(false);
  });
  it('Text hat feste Größe und nur Farbwahl', () => {
    expect(einstellungPruefen('text', { farbe: STIFTFARBEN[3], breite: 0.5 })).toEqual({ farbe: STIFTFARBEN[3], breite: TEXT_GROESSE });
    expect(FARBEN.text).toBe(STIFTFARBEN);
    expect(DICKEN.text).toHaveLength(0);
  });
});

describe('Pipette', () => {
  it('Stift und Text nehmen den Ton, der Marker rechnet auf Papier zurück', () => {
    expect(pipettenFarbe('stift', { r: 209, g: 45, b: 45 })).toBe('#d12d2d');
    expect(pipettenFarbe('text', { r: 209, g: 45, b: 45 })).toBe('#d12d2d');
    expect(pipettenFarbe('marker', { r: 255, g: 255, b: 153 })).toBe('rgba(255, 255, 0, 0.4)');
  });
  it('gemerkte Farben je Werkzeug, Unsinn fällt weg', () => {
    expect(pipettenPruefen({ stift: '#123456', marker: '#123456', text: 'rot' })).toEqual({ stift: '#123456' });
    expect(pipettenPruefen(null)).toEqual({});
  });
});

describe('Radierer', () => {
  it('Breiten steigen auf, die bisherige feste ist der Standard', () => {
    const werte = RADIERER_BREITEN.map((d) => d.wert);
    expect(werte).toEqual([...werte].sort((a, b) => a - b));
    expect(RADIERER_STANDARD).toBe(0.024); // bisher Radius 0,012
    expect(radiererPruefen(0.045)).toBe(0.045);
    expect(radiererPruefen(0.3)).toBe(RADIERER_STANDARD);
    expect(radiererPruefen(undefined)).toBe(RADIERER_STANDARD);
  });
});
