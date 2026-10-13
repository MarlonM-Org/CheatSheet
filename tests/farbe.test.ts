import { describe, expect, it } from 'vitest';
import { hexEingabe, hexVon, hsvAus, istHell, markerFarbe, markerFuer, MARKER_DECKKRAFT, pipettenPunkt, rgbAus, rgbAusHsv } from '@/domain/farbe';

describe('Farben umrechnen', () => {
  it('liest Hex und rgb(a), sonst null', () => {
    expect(rgbAus('#1f5fd1')).toEqual({ r: 31, g: 95, b: 209 });
    expect(rgbAus('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgbAus('rgba(255, 214, 0, 0.45)')).toEqual({ r: 255, g: 214, b: 0 });
    expect(rgbAus('rgb(1,2,3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(rgbAus('rgb(256, 0, 0)')).toBeNull();
    expect(rgbAus('lila')).toBeNull();
    expect(rgbAus('#12345')).toBeNull();
  });
  it('schreibt Hex klein und begrenzt', () => {
    expect(hexVon({ r: 31, g: 95, b: 209 })).toBe('#1f5fd1');
    expect(hexVon({ r: 300, g: -4, b: 12.6 })).toBe('#ff000d');
  });
  it('Hex-Feld: mit oder ohne #, drei oder sechs Stellen', () => {
    expect(hexEingabe('1F5FD1')).toBe('#1f5fd1');
    expect(hexEingabe(' #abc ')).toBe('#aabbcc');
    expect(hexEingabe('#abcd')).toBeNull();
    expect(hexEingabe('xyz')).toBeNull();
  });
  it('HSV hin und zurück', () => {
    expect(hsvAus({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvAus({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
    expect(rgbAusHsv({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(rgbAusHsv({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    for (const hex of ['#1f5fd1', '#d12d8a', '#5f5b53', '#e8740c', '#ffffff', '#000000']) {
      expect(hexVon(rgbAusHsv(hsvAus(rgbAus(hex)!)))).toBe(hex);
    }
  });
  it('hell oder dunkel', () => {
    expect(istHell({ r: 255, g: 214, b: 0 })).toBe(true);
    expect(istHell({ r: 31, g: 95, b: 209 })).toBe(false);
  });
});

describe('Marker', () => {
  it('ist halbtransparent', () => {
    expect(markerFarbe({ r: 10, g: 20, b: 30 })).toBe(`rgba(10, 20, 30, ${MARKER_DECKKRAFT})`);
  });
  it('trifft auf weißem Papier den aufgenommenen Ton, soweit möglich', () => {
    const papier = (c: number) => 255 * (1 - MARKER_DECKKRAFT) + c * MARKER_DECKKRAFT;
    const ton = { r: 255, g: 237, b: 180 };
    const m = markerFuer(ton);
    expect(Math.abs(papier(m.r) - ton.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(papier(m.g) - ton.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(papier(m.b) - ton.b)).toBeLessThanOrEqual(1);
    // Dunkler als ein Marker je werden kann: so dunkel wie möglich
    expect(markerFuer({ r: 0, g: 0, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('Pipette', () => {
  const feld = (punkte: [number, number, number, number][]) => punkte.flat();
  const W: [number, number, number, number] = [255, 255, 255, 255];
  it('nimmt die Mitte, wenn sie Farbe hat', () => {
    const d = feld([W, W, W, W, [209, 45, 45, 255], [0, 0, 0, 255], W, W, W]);
    expect(pipettenPunkt(d, 3)).toEqual({ r: 209, g: 45, b: 45 });
  });
  it('fast weiße Mitte: der deutlichste Punkt daneben (dünner Strich)', () => {
    const d = feld([W, W, W, [31, 95, 209, 255], [250, 250, 252, 255], W, W, [200, 210, 240, 255], W]);
    expect(pipettenPunkt(d, 3)).toEqual({ r: 31, g: 95, b: 209 });
  });
  it('Punkte außerhalb der Leinwand zählen nicht', () => {
    const leer: [number, number, number, number] = [0, 0, 0, 0];
    expect(pipettenPunkt(feld([leer, leer, leer, leer, W, leer, leer, leer, leer]), 3)).toEqual({ r: 255, g: 255, b: 255 });
    expect(pipettenPunkt(feld([leer, leer, leer, leer, leer, leer, leer, leer, leer]), 3)).toBeNull();
  });
});
