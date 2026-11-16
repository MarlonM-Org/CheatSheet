import { describe, expect, it } from 'vitest';
import { abstandZumNaechsten, anteilPruefen, istSwing, schlagKlingt, SWING_STANDARD, swingMoeglich, taktKlicks, taktLaenge, zweiVierMoeglich } from '@/domain/swing';
import { akzenteFuer, klickDauer } from '@/domain/takt';

const aus = SWING_STANDARD;
const art = (l: ReturnType<typeof taktKlicks>) => l.map((k) => k.art);

describe('Klicks ohne Swing wie bisher', () => {
  it('4/4 ohne Unterteilung: vier Klicks, Eins betont', () => {
    const l = taktKlicks(4, 4, 1, akzenteFuer(4, 4), aus);
    expect(l.map((k) => k.versatz)).toEqual([0, 1, 2, 3]);
    expect(art(l)).toEqual(['betont', 'normal', 'normal', 'normal']);
  });
  it('Unterteilung in Achteln liegt in der Mitte, Nachschläge leiser', () => {
    const l = taktKlicks(4, 4, 2, akzenteFuer(4, 4), aus);
    expect(l.map((k) => k.versatz)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(art(l).filter((a) => a === 'unter')).toHaveLength(4);
  });
  it('Abstand stimmt mit klickDauer überein (Puls × 60 / bpm)', () => {
    for (const [z, n, u] of [[4, 4, 1], [4, 4, 3], [6, 8, 1], [6, 8, 2], [3, 4, 4]] as const) {
      const l = taktKlicks(z, n, u, akzenteFuer(z, n), aus);
      for (let i = 0; i < l.length; i++) expect(abstandZumNaechsten(l, i, z, n) * 60 / 100).toBeCloseTo(klickDauer(100, z, n, u), 9);
    }
  });
  it('stumme Schläge schweigen samt Unterteilung, laufen aber in der Anzeige mit', () => {
    const l = taktKlicks(4, 4, 2, ['betont', 'stumm', 'normal', 'normal'], aus);
    expect(l).toHaveLength(8);
    expect(art(l).slice(2, 4)).toEqual([null, null]);
  });
  it('zusammengesetzt: 6/8 hat zwei Pulse je Takt', () => {
    expect(taktLaenge(6, 8)).toBe(2);
    expect(taktKlicks(6, 8, 1, akzenteFuer(6, 8), aus).map((k) => k.versatz)).toEqual([0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3]);
  });
});

describe('Nur 2 und 4', () => {
  it('4/4: Klick nur auf Schlag 2 und 4', () => {
    const l = taktKlicks(4, 4, 1, akzenteFuer(4, 4), { ...aus, zweiVier: true });
    expect(art(l)).toEqual([null, 'normal', null, 'normal']);
  });
  it('6/4 klickt auf 2, 4, 6; die Eins bleibt in der Anzeige', () => {
    const l = taktKlicks(6, 4, 1, akzenteFuer(6, 4), { ...aus, zweiVier: true });
    expect(art(l).map((a) => a !== null)).toEqual([false, true, false, true, false, true]);
  });
  it('wirkungslos in 3/4, 5/4, 2/4 und 6/8', () => {
    for (const [z, n] of [[3, 4], [5, 4], [2, 4], [6, 8], [12, 8]] as const) {
      expect(zweiVierMoeglich(z, n)).toBe(false);
      expect(art(taktKlicks(z, n, 1, akzenteFuer(z, n), { ...aus, zweiVier: true }))).toEqual(art(taktKlicks(z, n, 1, akzenteFuer(z, n), aus)));
    }
    expect(zweiVierMoeglich(4, 2)).toBe(true);
  });
  it('schlagKlingt für die Aufnahmespur', () => {
    expect([0, 1, 2, 3].map((s) => schlagKlingt(4, 4, s, true))).toEqual([false, true, false, true]);
    expect([0, 1, 2].map((s) => schlagKlingt(3, 4, s, true))).toEqual([true, true, true]);
    expect([0, 1].map((s) => schlagKlingt(4, 4, s, false))).toEqual([true, true]);
  });
  it('mit stummem Schlag 2 bleibt er stumm', () => {
    expect(art(taktKlicks(4, 4, 1, ['normal', 'stumm', 'normal', 'normal'], { ...aus, zweiVier: true }))).toEqual([null, null, null, 'normal']);
  });
});

describe('Hörbare Achtel mit Swing', () => {
  const s = (anteil: number) => ({ ...aus, achtel: true, anteil });
  it('gerade 50 % liegt mittig', () => {
    expect(taktKlicks(4, 4, 1, akzenteFuer(4, 4), s(50)).slice(0, 4).map((k) => k.versatz)).toEqual([0, 0.5, 1, 1.5]);
  });
  it('triolisch 67 % und locker 60 %', () => {
    expect(taktKlicks(2, 4, 1, akzenteFuer(2, 4), s(67)).map((k) => k.versatz)).toEqual([0, 0.67, 1, 1.67]);
    expect(taktKlicks(2, 4, 1, akzenteFuer(2, 4), s(60)).map((k) => k.versatz)).toEqual([0, 0.6, 1, 1.6]);
  });
  it('ersetzt die Unterteilung', () => {
    expect(taktKlicks(4, 4, 4, akzenteFuer(4, 4), s(67))).toHaveLength(8);
  });
  it('Abstände ergeben einen Takt', () => {
    const l = taktKlicks(4, 4, 1, akzenteFuer(4, 4), s(67));
    const summe = l.reduce((x, _k, i) => x + abstandZumNaechsten(l, i, 4, 4), 0);
    expect(summe).toBeCloseTo(4, 9);
    expect(abstandZumNaechsten(l, 0, 4, 4)).toBeCloseTo(0.67, 9);
    expect(abstandZumNaechsten(l, 1, 4, 4)).toBeCloseTo(0.33, 9);
  });
  it('nicht in zusammengesetzten Takten', () => {
    expect(swingMoeglich(6, 8)).toBe(false);
    expect(taktKlicks(6, 8, 1, akzenteFuer(6, 8), s(67))).toHaveLength(6);
  });
  it('zusammen mit 2 und 4: nur diese Schläge samt Nachschlag', () => {
    const l = taktKlicks(4, 4, 1, akzenteFuer(4, 4), { zweiVier: true, achtel: true, anteil: 67 });
    expect(art(l)).toEqual([null, null, 'normal', 'unter', null, null, 'normal', 'unter']);
  });
  it('Nachschlag ist immer leiser', () => {
    expect(art(taktKlicks(4, 4, 1, ['betont', 'normal', 'normal', 'normal'], s(60)))[1]).toBe('unter');
  });
});

describe('Prüfen', () => {
  it('Anteil geklemmt', () => {
    expect(anteilPruefen(10)).toBe(50);
    expect(anteilPruefen(99)).toBe(75);
    expect(anteilPruefen(66.6)).toBe(67);
    expect(anteilPruefen('x')).toBe(60);
  });
  it('istSwing', () => {
    expect(istSwing(SWING_STANDARD)).toBe(true);
    expect(istSwing({ zweiVier: true, achtel: false, anteil: 49 })).toBe(false);
    expect(istSwing({ zweiVier: 1, achtel: false, anteil: 60 })).toBe(false);
    expect(istSwing(null)).toBe(false);
  });
});
