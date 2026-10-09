import { describe, expect, it } from 'vitest';
import { frequenzZuTon, grundfrequenz, median, mitRand, rechteckAus, tempoBezeichnung, trainerTempo } from '@/domain/ueben';

function sinus(f: number, rate = 44100, n = 2048) {
  const p = new Float32Array(n);
  for (let i = 0; i < n; i++) p[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / rate) + 0.2 * Math.sin((4 * Math.PI * f * i) / rate);
  return p;
}

describe('Stimmgerät', () => {
  it('benennt Töne deutsch, mit Kammerton und Cent', () => {
    expect(frequenzZuTon(442)).toMatchObject({ name: 'A', oktave: 4, cent: 0 });
    expect(frequenzZuTon(440, 442)?.cent).toBe(-8);
    expect(frequenzZuTon(442 * 2 ** (1 / 12))?.name).toBe('B');
    expect(frequenzZuTon(442 * 2 ** (2 / 12))?.name).toBe('H');
  });
  it('rechnet für B-, Es- und F-Instrumente um', () => {
    const b = 442 * 2 ** (1 / 12); // klingendes B
    expect(frequenzZuTon(b, 442, 'B')?.name).toBe('C'); // B-Klarinette greift C
    expect(frequenzZuTon(442, 442, 'Es')?.name).toBe('Fis'); // Altsax: klingendes A = notiert Fis
    expect(frequenzZuTon(442, 442, 'F')?.name).toBe('E');
  });
  it('erkennt die Grundfrequenz eines Tons, auch tief (Tuba) und mit Obertönen', () => {
    for (const f of [58.3, 116.5, 233, 442, 880, 1400]) {
      const r = grundfrequenz(sinus(f, 48000, 4096), 48000)!;
      expect(Math.abs(r.frequenz - f) / f).toBeLessThan(0.003); // < 5 Cent
      expect(r.klarheit).toBeGreaterThan(0.8);
    }
  });
  it('schweigt bei Stille und Rauschen', () => {
    expect(grundfrequenz(new Float32Array(4096), 48000)).toBeNull();
    let x = 1;
    const rauschen = new Float32Array(4096).map(() => { x = (x * 16807) % 2147483647; return (x / 2147483647 - 0.5) * 0.5; });
    expect(grundfrequenz(rauschen, 48000)).toBeNull();
  });
  it('glättet mit dem Median', () => {
    expect(median([440, 441, 880, 442, 439])).toBe(441);
  });
});

describe('Ausschnitte', () => {
  it('zieht ein Rechteck in jede Richtung und begrenzt es', () => {
    expect(rechteckAus(0.5, 0.6, 0.2, 0.4)).toEqual({ x: 0.2, y: 0.4, b: 0.3, h: expect.closeTo(0.2) });
    expect(rechteckAus(-1, 0, 2, 0.1)).toMatchObject({ x: 0, b: 1 });
  });
  it('gibt Rand dazu, ohne über die Seite hinauszugehen', () => {
    const r = mitRand({ x: 0.02, y: 0.5, b: 0.3, h: 0.1 }, 0.06);
    expect(r.x).toBe(0);
    expect(r.b).toBeCloseTo(0.38);
    expect(mitRand({ x: 0.9, y: 0.9, b: 0.1, h: 0.1 }, 0.06)).toMatchObject({ b: expect.closeTo(0.16), h: expect.closeTo(0.115) });
  });
});

describe('Metronom', () => {
  it('benennt Tempi', () => {
    expect(tempoBezeichnung(50)).toBe('Largo');
    expect(tempoBezeichnung(96)).toBe('Andante');
    expect(tempoBezeichnung(132)).toBe('Allegro');
  });
  it('steigert im Trainer bis zum Ziel', () => {
    expect(trainerTempo(80, 4, 2, 100, 0)).toBe(80);
    expect(trainerTempo(80, 4, 2, 100, 3)).toBe(84);
    expect(trainerTempo(80, 4, 2, 100, 40)).toBe(100);
    expect(trainerTempo(80, 0, 2, 100, 40)).toBe(80);
  });
});
