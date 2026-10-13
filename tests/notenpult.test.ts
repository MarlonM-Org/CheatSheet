import { describe, expect, it } from 'vitest';
import { ansichten, ansichtVonSeite, ausDateiname, getroffen, hauptseite, radierWeg, strichKappen, zuordnen, type Anmerkung } from '@/domain/notenpult';

describe('Blättern', () => {
  it('ganze Seiten: eine Ansicht je Seite', () => {
    expect(ansichten(3, 'ganz')).toEqual([{ art: 'ganz', seite: 1 }, { art: 'ganz', seite: 2 }, { art: 'ganz', seite: 3 }]);
  });
  it('halbe Seiten: dazwischen oben die nächste, unten der Rest der aktuellen', () => {
    const a = ansichten(3, 'halb');
    expect(a.map((x) => x.art)).toEqual(['ganz', 'halb', 'ganz', 'halb', 'ganz']);
    expect(a[1]).toEqual({ art: 'halb', oben: 2, unten: 1, schnitt: 0.5 });
    expect(hauptseite(a[1])).toBe(2);
  });
  it('eigene Linie je Seite; nah am Rand heißt ganz blättern', () => {
    const a = ansichten(3, 'linie', { 1: 0.3, 2: 0.97 });
    expect(a).toEqual([
      { art: 'ganz', seite: 1 }, { art: 'halb', oben: 2, unten: 1, schnitt: 0.3 },
      { art: 'ganz', seite: 2 }, { art: 'ganz', seite: 3 },
    ]);
    expect(ansichtVonSeite(a, 3)).toBe(3);
  });
});

describe('Dateien', () => {
  it('liest Titel und Stimme aus dem Dateinamen', () => {
    expect(ausDateiname('Pomp and Circumstance - Klarinette in B 1.pdf')).toEqual({ titel: 'Pomp and Circumstance', stimme: 'Klarinette in B 1' });
    expect(ausDateiname('Arsenal.PDF')).toEqual({ titel: 'Arsenal', stimme: '' });
  });
  it('ordnet neue Dateien den vorhandenen Noten zu', () => {
    const noten = [
      { id: 'a', dateiname: 'Pomp - Klar 1.pdf', titel: 'Pomp', stimme: 'Klar 1' },
      { id: 'b', titel: 'Arsenal', stimme: 'Klarinette 2' },
      { id: 'c', titel: 'Fehlt', stimme: '' },
    ];
    const r = zuordnen(noten, ['arsenal - klarinette 2.PDF', 'Pomp - Klar 1.pdf', 'Neu.pdf']);
    expect(r.paare).toEqual([{ notenId: 'a', datei: 1 }, { notenId: 'b', datei: 0 }]);
    expect(r.ohneDatei.map((n) => n.id)).toEqual(['c']);
    expect(r.ohneNoten).toEqual([2]);
  });
});

describe('Radierer', () => {
  const strich: Anmerkung = { id: '1', art: 'stift', farbe: '#000', breite: 0.004, punkte: [0.1, 0.1, 0.3, 0.1] };
  it('trifft Striche nahe der Linie, nicht daneben', () => {
    expect(getroffen(strich, 0.2, 0.1, 0.01)).toBe(true);
    expect(getroffen(strich, 0.2, 0.2, 0.01)).toBe(false);
  });
  it('trifft Text in seinem Kasten', () => {
    const t: Anmerkung = { id: '2', art: 'text', farbe: '#000', groesse: 0.02, x: 0.5, y: 0.5, text: 'leise' };
    expect(getroffen(t, 0.51, 0.495, 0.005)).toBe(true);
    expect(getroffen(t, 0.2, 0.2, 0.005)).toBe(false);
  });
});

describe('Radieren schneidet', () => {
  const nah = (a: number[], b: number[]) => { expect(a).toHaveLength(b.length); a.forEach((x, i) => expect(x).toBeCloseTo(b[i])); };
  it('in der Mitte radiert: zwei Linien', () => {
    const teile = strichKappen([0.1, 0.5, 0.5, 0.5], 0.3, 0.5, 0.05, 1)!;
    expect(teile).toHaveLength(2);
    nah(teile[0], [0.1, 0.5, 0.25, 0.5]);
    nah(teile[1], [0.35, 0.5, 0.5, 0.5]);
  });
  it('auch zwischen weit auseinander liegenden Punkten (schneller Strich)', () => {
    const teile = strichKappen([0, 0, 1, 0], 0.5, 0.01, 0.02, 1)!;
    expect(teile).toHaveLength(2);
    expect(teile[0].at(-2)).toBeCloseTo(0.5 - Math.sqrt(0.02 ** 2 - 0.01 ** 2));
  });
  it('am Ende radiert: ein kürzerer Strich; ganz überdeckt: nichts', () => {
    const teile = strichKappen([0.1, 0.5, 0.2, 0.5, 0.3, 0.5], 0.3, 0.5, 0.05, 1)!;
    expect(teile).toHaveLength(1);
    nah(teile[0], [0.1, 0.5, 0.2, 0.5, 0.25, 0.5]);
    expect(strichKappen([0.3, 0.5, 0.31, 0.5], 0.3, 0.5, 0.05, 1)).toEqual([]);
    expect(strichKappen([0.3, 0.5], 0.3, 0.5, 0.05, 1)).toEqual([]);
  });
  it('nicht getroffen: null', () => {
    expect(strichKappen([0.1, 0.5, 0.5, 0.5], 0.3, 0.7, 0.05, 1)).toBeNull();
    expect(strichKappen([0.1, 0.5], 0.3, 0.7, 0.05, 1)).toBeNull();
    // nur berührt (Tangente) zählt nicht
    expect(strichKappen([0.1, 0.5, 0.5, 0.5], 0.3, 0.55, 0.05, 1)).toBeNull();
  });
  it('Höhe zählt im Seitenformat', () => {
    // 0,04 Seitenhöhe = 0,0566 Seitenbreiten: außerhalb eines Radius von 0,05
    expect(strichKappen([0.1, 0.5, 0.5, 0.5], 0.3, 0.54, 0.05, 1.414)).toBeNull();
    expect(strichKappen([0.1, 0.5, 0.5, 0.5], 0.3, 0.54, 0.05, 1)).not.toBeNull();
  });
  it('winzige Reste fallen weg', () => {
    expect(strichKappen([0.249, 0.5, 0.3, 0.5], 0.3, 0.5, 0.05, 1)).toEqual([]);
  });
  it('ein schneller Wisch wird lückenlos nachgezogen', () => {
    expect(radierWeg(null, 0.5, 0.5, 0.01)).toEqual([{ x: 0.5, y: 0.5 }]);
    const weg = radierWeg({ x: 0, y: 0.5 }, 0.1, 0.5, 0.01, 1);
    expect(weg).toHaveLength(20);
    expect(weg.at(-1)).toEqual({ x: 0.1, y: 0.5 });
    for (let i = 1; i < weg.length; i++) expect(weg[i].x - weg[i - 1].x).toBeLessThanOrEqual(0.005 + 1e-12);
  });
});
