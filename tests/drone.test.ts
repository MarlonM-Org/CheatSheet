import { describe, expect, it } from 'vitest';
import { DRONE_LAGE, DRONE_STANDARD, droneGrundton, droneLautPruefen, droneStimmen, droneToene, FARBEN, istDroneEinstellung, klasseName, stimmenPegel } from '@/domain/drone';

describe('Grundton in der Lage', () => {
  it('jede Tonklasse landet in C3 … H3', () => {
    for (let k = 0; k < 12; k++) {
      const g = droneGrundton(k);
      expect(g).toBeGreaterThanOrEqual(DRONE_LAGE.von);
      expect(g).toBeLessThanOrEqual(DRONE_LAGE.bis);
      expect(g % 12).toBe(k);
    }
  });
  it('MIDI-Zahl aus beliebiger Oktave wird auf die Tonklasse zurückgeführt', () => {
    expect(droneGrundton(72)).toBe(48);
    expect(droneGrundton(70)).toBe(58); // B
    expect(droneGrundton(34)).toBe(58);
    expect(droneGrundton(-2)).toBe(58);
  });
});

describe('Töne je Farbe (notiert)', () => {
  it('nur Grundton: Grundton und Oktave', () => expect(droneToene(10, 'grundton')).toEqual([58, 70]));
  it('Grundton + Quinte: C – G – c', () => expect(droneToene(0, 'quinte')).toEqual([48, 55, 60]));
  it('Dur und Moll unterscheiden sich nur in der Terz', () => {
    expect(droneToene(7, 'dur')).toEqual([55, 62, 67, 71]);
    expect(droneToene(7, 'moll')).toEqual([55, 62, 67, 70]);
  });
  it('Dorisch: große Sexte, Mixolydisch: kleine Septime — ohne Terz', () => {
    expect(droneToene(2, 'dorisch')).toEqual([50, 57, 62, 71]); // D A d h
    expect(droneToene(7, 'mixolydisch')).toEqual([55, 62, 67, 77]); // G D g f
    for (const f of ['dorisch', 'mixolydisch'] as const) {
      const t = droneToene(0, f).map((m) => m % 12);
      expect(t).not.toContain(3);
      expect(t).not.toContain(4);
    }
  });
  it('aufsteigend sortiert, alle in ruhiger Lage', () => {
    for (const f of FARBEN) for (let k = 0; k < 12; k++) {
      const t = droneToene(k, f);
      expect([...t].sort((a, b) => a - b)).toEqual(t);
      expect(t[0]).toBeGreaterThanOrEqual(48);
      expect(t[t.length - 1]).toBeLessThanOrEqual(81);
    }
  });
  it('der Grundton ist die lauteste Stimme', () => {
    for (const f of FARBEN) {
      const s = droneStimmen(5, f);
      expect(s[0].gewicht).toBe(Math.max(...s.map((x) => x.gewicht)));
    }
  });
});

describe('Namen, Prüfung, Pegel', () => {
  it('deutsche Namen', () => {
    expect([0, 1, 3, 6, 8, 10, 11].map(klasseName)).toEqual(['C', 'Cis', 'Es', 'Fis', 'As', 'B', 'H']);
    expect(klasseName(70)).toBe('B');
  });
  it('Einstellung prüfen', () => {
    expect(istDroneEinstellung(DRONE_STANDARD)).toBe(true);
    expect(istDroneEinstellung({ grundton: 12, farbe: 'dur', laut: 0.5 })).toBe(false);
    expect(istDroneEinstellung({ grundton: 3, farbe: 'lydisch', laut: 0.5 })).toBe(false);
    expect(istDroneEinstellung({ grundton: 3, farbe: 'dur', laut: 2 })).toBe(false);
  });
  it('Lautstärke geklemmt', () => {
    expect(droneLautPruefen(3)).toBe(1);
    expect(droneLautPruefen(-1)).toBe(0);
    expect(droneLautPruefen('x')).toBe(0.5);
  });
  it('Pegel summieren sich auf 1', () => {
    const s = droneStimmen(10, 'dur');
    const p = stimmenPegel(s, [117, 175, 233, 294]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(p[0]).toBeGreaterThan(p[3]);
  });
});
