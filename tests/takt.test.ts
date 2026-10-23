import { describe, expect, it } from 'vitest';
import {
  akzenteFuer, einheitenJeSchlag, istZusammengesetzt, klickDauer, NENNER, nennerPruefen, nennerSchritt, schlaegeJeTakt, schlagName, TAKTARTEN,
  taktartText, unterPruefen, unterteilungen, zaehlerPruefen, ZAEHLER_MAX,
} from '@/domain/takt';

describe('Taktart', () => {
  it('Nenner sind Notenwerte, Unsinn fällt auf Viertel zurück', () => {
    expect(NENNER).toEqual([2, 4, 8, 16]);
    expect(nennerPruefen(8)).toBe(8);
    expect(nennerPruefen(3)).toBe(4);
    expect(nennerPruefen('8')).toBe(4);
    expect(nennerPruefen(undefined)).toBe(4);
  });
  it('Zähler zwischen 1 und 16, sonst 4', () => {
    expect(zaehlerPruefen(12)).toBe(12);
    expect(zaehlerPruefen(0)).toBe(4);
    expect(zaehlerPruefen(ZAEHLER_MAX + 1)).toBe(4);
    expect(zaehlerPruefen(2.5)).toBe(4);
  });
  it('Schnellwahl enthält die üblichen Taktarten', () => {
    expect(TAKTARTEN.map(([z, n]) => taktartText(z, n))).toEqual(['4/4', '3/4', '6/8', '2/4']);
  });
  it('zusammengesetzt sind 6/8, 9/8, 12/8 — nicht 3/8, 6/4 oder 4/4', () => {
    expect(istZusammengesetzt(6, 8)).toBe(true);
    expect(istZusammengesetzt(12, 8)).toBe(true);
    expect(istZusammengesetzt(12, 16)).toBe(true);
    expect(istZusammengesetzt(3, 8)).toBe(false);
    expect(istZusammengesetzt(6, 4)).toBe(false);
    expect(istZusammengesetzt(4, 4)).toBe(false);
  });
  it('Nenner-Schritt bleibt in der Reihe', () => {
    expect(nennerSchritt(4, 1)).toBe(8);
    expect(nennerSchritt(4, -1)).toBe(2);
    expect(nennerSchritt(2, -1)).toBe(2);
    expect(nennerSchritt(16, 1)).toBe(16);
  });
});

describe('akzenteFuer', () => {
  it('einfache Takte betonen die Eins', () => {
    expect(akzenteFuer(4, 4)).toEqual(['betont', 'normal', 'normal', 'normal']);
    expect(akzenteFuer(1, 4)).toEqual(['betont']);
  });
  it('zusammengesetzte Takte betonen jede Dreiergruppe', () => {
    expect(akzenteFuer(6, 8)).toEqual(['betont', 'normal', 'normal', 'betont', 'normal', 'normal']);
    expect(akzenteFuer(12, 8).filter((a) => a === 'betont')).toHaveLength(4);
    expect(akzenteFuer(3, 8)).toEqual(['betont', 'normal', 'normal']);
  });
  it('vorhandene Akzente bleiben, der Rest wird aufgefüllt', () => {
    expect(akzenteFuer(5, 4, ['normal', 'stumm', 'betont'])).toEqual(['normal', 'stumm', 'betont', 'normal', 'normal']);
    expect(akzenteFuer(2, 4, ['normal', 'stumm', 'betont'])).toEqual(['normal', 'stumm']);
    expect(akzenteFuer(9, 8, akzenteFuer(6, 8))).toEqual(akzenteFuer(9, 8));
  });
});

describe('Schlag und Einheit (D-07)', () => {
  it('6/8 hat zwei Schläge zu drei Achteln, 4/4 vier Schläge zu einer Viertel', () => {
    expect(einheitenJeSchlag(6, 8)).toBe(3);
    expect(schlaegeJeTakt(6, 8)).toBe(2);
    expect(schlaegeJeTakt(12, 8)).toBe(4);
    expect(einheitenJeSchlag(4, 4)).toBe(1);
    expect(schlaegeJeTakt(3, 4)).toBe(3);
    expect(schlaegeJeTakt(7, 8)).toBe(7);
  });
  it('bei 6/8 und 120 kommen 360 Achtel in der Minute — ein Klick alle 1/6 Sekunde', () => {
    expect(klickDauer(120, 6, 8, 1)).toBeCloseTo(1 / 6);
    expect(klickDauer(120, 4, 4, 1)).toBeCloseTo(0.5);
    expect(klickDauer(120, 4, 4, 2)).toBeCloseTo(0.25);
    expect(klickDauer(60, 2, 2, 1)).toBeCloseTo(1);
  });
  it('Schlag in Worten', () => {
    expect(schlagName(4, 4)).toBe('Viertel');
    expect(schlagName(2, 2)).toBe('Halbe');
    expect(schlagName(6, 8)).toBe('punktierte Viertel');
    expect(schlagName(7, 8)).toBe('Achtel');
    expect(schlagName(12, 16)).toBe('punktierte Achtel');
  });
  it('Unterteilung richtet sich nach dem Nenner, Unpassendes fällt auf die erste zurück', () => {
    expect(unterteilungen(4, 4).map((x) => x.n)).toEqual([1, 2, 3, 4]);
    expect(unterteilungen(6, 8).map((x) => x.n)).toEqual([1, 2]);
    expect(unterteilungen(6, 8)[0].name).toBe('Achtel');
    expect(unterteilungen(2, 2)[0].name).toBe('Halbe');
    expect(unterPruefen(6, 8, 3)).toBe(1);
    expect(unterPruefen(4, 4, 3)).toBe(3);
  });
});
