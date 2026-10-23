import { describe, expect, it } from 'vitest';
import {
  akzenteFuer, istZusammengesetzt, NENNER, nennerPruefen, nennerSchritt, TAKTARTEN, taktartText, zaehlerPruefen, ZAEHLER_MAX,
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
    expect(TAKTARTEN.map(([z, n]) => taktartText(z, n))).toEqual(['2/4', '3/4', '4/4', '6/8', '9/8', '12/8']);
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
