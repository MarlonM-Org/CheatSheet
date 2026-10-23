import { describe, expect, it } from 'vitest';
import { getroffen, radierZug, type Anmerkung } from '@/domain/notenpult';
import { istStempelZeichen, SPRUNG_STEMPEL, STEMPEL, STEMPEL_REIHE, stempelAnlegen, stempelKasten } from '@/domain/stempel';

describe('Stempel (E-04)', () => {
  it('jedes Zeichen hat Bild oder Text und eine Größe, die Reihe ist vollständig', () => {
    for (const z of STEMPEL_REIHE) {
      const b = STEMPEL[z];
      expect(b.groesse).toBeGreaterThan(0);
      expect(!!b.text || (b.pfade?.length ?? 0) > 0, z).toBe(true);
    }
    expect(new Set(STEMPEL_REIHE).size).toBe(Object.keys(STEMPEL).length);
    expect(istStempelZeichen('segno')).toBe(true);
    expect(istStempelZeichen('toString')).toBe(false);
  });
  it('D.S. legt das Segno, Coda das Coda-Zeichen, Wiederholung nichts', () => {
    expect(SPRUNG_STEMPEL.ds).toBe('segno');
    expect(SPRUNG_STEMPEL.coda).toBe('coda');
    expect(SPRUNG_STEMPEL.wdh).toBeUndefined();
  });
  it('anlegen: Mitte auf dem Punkt, Größe aus dem Zeichen, Lücke nur wenn gesetzt', () => {
    const s = stempelAnlegen('a', 'segno', 0.3, 0.4, '#1b1b1b');
    expect(s).toEqual({ id: 'a', art: 'stempel', zeichen: 'segno', x: 0.3, y: 0.4, groesse: STEMPEL.segno.groesse, farbe: '#1b1b1b' });
    expect(stempelAnlegen('b', 'f', 0.1, 0.1, '#000', 'L').luecke).toBe('L');
    const k = stempelKasten(s, 2);
    expect(k.b).toBe(s.groesse); expect(k.h).toBeCloseTo(s.groesse / 2); expect(k.x + k.b / 2).toBeCloseTo(0.3);
  });
  it('der Radierer trifft den Kasten und nimmt den Stempel ganz weg', () => {
    const s: Anmerkung = stempelAnlegen('a', 'coda', 0.5, 0.5, '#000');
    expect(getroffen(s, 0.5, 0.5, 0.005)).toBe(true);
    expect(getroffen(s, 0.6, 0.5, 0.005)).toBe(false);
    const r = radierZug([s], 0.5, 0.5, 0.005, 1.414, null, false, () => 'n');
    expect(r.geaendert).toBe(true);
    expect(r.objekte).toEqual([]);
  });
});
