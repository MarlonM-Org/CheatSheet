import { describe, expect, it } from 'vitest';
import { ebeneAusDifferenz, hatMarkierungen } from '@/domain/ebene';
import { radierZug, type Anmerkung } from '@/domain/notenpult';

const px = (...werte: number[]) => new Uint8ClampedArray(werte);

describe('Markierungs-Ebene aus dem PDF', () => {
  it('zählt Zeichnungen, Stempel, Textmarker — nicht Links, Notizfenster, Formularfelder', () => {
    expect(hatMarkierungen([{ annotationType: 13 }])).toBe(true); // Stempel (Apple „Markieren“)
    expect(hatMarkierungen([{ annotationType: 15 }])).toBe(true); // Freihand
    expect(hatMarkierungen([{ annotationType: 9 }])).toBe(true); // Textmarker
    expect(hatMarkierungen([{ annotationType: 2 }, { annotationType: 16 }, { annotationType: 20 }])).toBe(false);
    expect(hatMarkierungen([])).toBe(false);
  });
  it('was sich unterscheidet, kommt deckend aus „mit“; Gleiches wird durchsichtig', () => {
    const mit = px(255, 255, 255, 255, 250, 220, 40, 255, 10, 10, 10, 255);
    const ohne = px(255, 255, 255, 255, 255, 255, 255, 255, 10, 10, 10, 255);
    expect([...ebeneAusDifferenz(mit, ohne)]).toEqual([255, 255, 255, 0, 250, 220, 40, 255, 10, 10, 10, 0]);
  });
  it('winzige Abweichungen (Kantenglättung) zählen nicht', () => {
    expect([...ebeneAusDifferenz(px(254, 253, 255, 255), px(255, 255, 255, 255))]).toEqual([254, 253, 255, 0]);
    expect([...ebeneAusDifferenz(px(240, 255, 255, 255), px(255, 255, 255, 255))]).toEqual([240, 255, 255, 255]);
  });
});

describe('Radier-Zug', () => {
  const strich: Anmerkung = { id: 's', art: 'stift', farbe: '#000', breite: 0.004, punkte: [0.1, 0.1, 0.3, 0.1] };
  const weit: Anmerkung = { id: 'w', art: 'stift', farbe: '#000', breite: 0.004, punkte: [0.8, 0.8, 0.9, 0.8] };
  let n = 0;
  const neueId = () => `r${++n}`;

  it('ohne Markierungs-Ebene: nimmt getroffene eigene Striche weg, sonst nichts', () => {
    const r = radierZug([strich, weit], 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    expect(r.objekte.map((a) => a.id)).toEqual(['w']);
    expect(r.spur).toBeNull();
    const liste = [weit];
    const nichts = radierZug(liste, 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    expect(nichts.objekte).toBe(liste); // dieselbe Liste: nichts geändert
    expect(nichts.geaendert).toBe(false);
  });
  it('mit Markierungs-Ebene: beginnt eine Radier-Spur und verlängert sie', () => {
    const a = radierZug([weit], 0.5, 0.5, 0.012, 1.414, null, true, neueId);
    expect(a.geaendert).toBe(true);
    const spur = a.objekte.find((o) => o.art === 'radiert');
    expect(spur).toMatchObject({ art: 'radiert', breite: 0.024, punkte: [0.5, 0.5] });
    const b = radierZug(a.objekte, 0.52, 0.5, 0.012, 1.414, a.spur, true, neueId);
    expect(b.objekte.find((o) => o.id === a.spur)).toMatchObject({ punkte: [0.5, 0.5, 0.52, 0.5] });
    expect(b.objekte.filter((o) => o.art === 'radiert')).toHaveLength(1);
  });
  it('Radier-Spuren selbst werden nicht weg-radiert', () => {
    const spur: Anmerkung = { id: 'alt', art: 'radiert', breite: 0.024, punkte: [0.2, 0.1, 0.3, 0.1] };
    const r = radierZug([spur, strich], 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    expect(r.objekte.map((a) => a.id)).toEqual(['alt']);
  });
});
