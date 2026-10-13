import { describe, expect, it } from 'vitest';
import { anmerkungsBefehle, hatMarkierungen } from '@/domain/ebene';
import { radierZug, type Anmerkung } from '@/domain/notenpult';

describe('Markierungs-Ebene aus dem PDF', () => {
  it('zählt Zeichnungen, Stempel, Textmarker — nicht Links, Notizfenster, Formularfelder', () => {
    expect(hatMarkierungen([{ annotationType: 13 }])).toBe(true); // Stempel (Apple „Markieren“)
    expect(hatMarkierungen([{ annotationType: 15 }])).toBe(true); // Freihand
    expect(hatMarkierungen([{ annotationType: 9 }])).toBe(true); // Textmarker
    expect(hatMarkierungen([{ annotationType: 2 }, { annotationType: 16 }, { annotationType: 20 }])).toBe(false);
    expect(hatMarkierungen([])).toBe(false);
  });
  it('nimmt genau die Zeichenbefehle der Anmerkungen, samt Anfang und Ende', () => {
    const A = 80, E = 81; // pdf.js OPS.beginAnnotation / endAnnotation
    // Seite: 1, 2 · Anmerkung: 80, 3, 4, 81 · Seite: 5 · Anmerkung: 80, 6, 81
    expect([...anmerkungsBefehle([1, 2, A, 3, 4, E, 5, A, 6, E], A, E)]).toEqual([0, 0, 1, 1, 1, 1, 0, 1, 1, 1]);
  });
  it('ohne Anmerkungen nichts, verschachtelte zählen mit', () => {
    expect([...anmerkungsBefehle([1, 2, 3], 80, 81)]).toEqual([0, 0, 0]);
    expect([...anmerkungsBefehle([80, 80, 1, 81, 2, 81, 3], 80, 81)]).toEqual([1, 1, 1, 1, 1, 1, 0]);
  });
});

describe('Radier-Zug', () => {
  const strich: Anmerkung = { id: 's', art: 'stift', farbe: '#000', breite: 0.004, punkte: [0.1, 0.1, 0.3, 0.1] };
  const weit: Anmerkung = { id: 'w', art: 'stift', farbe: '#000', breite: 0.004, punkte: [0.8, 0.8, 0.9, 0.8] };
  let n = 0;
  const neueId = () => `r${++n}`;

  it('ohne Markierungs-Ebene: schneidet getroffene eigene Striche, sonst nichts', () => {
    const r = radierZug([strich, weit], 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    // Die Mitte ist weg: zwei Stücke mit neuen ids, der ferne Strich bleibt.
    expect(r.objekte.map((a) => a.id)).toEqual([expect.stringMatching(/^r/), expect.stringMatching(/^r/), 'w']);
    const [links, rechts] = r.objekte as { punkte: number[] }[];
    expect(links.punkte[0]).toBe(0.1);
    expect(links.punkte.at(-2)).toBeCloseTo(0.2 - 0.014); // Radius + halbe Strichbreite
    expect(rechts.punkte[0]).toBeCloseTo(0.2 + 0.014);
    expect(rechts.punkte.at(-2)).toBe(0.3);
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
  it('Texte fallen ganz weg, Marker werden geschnitten', () => {
    const text: Anmerkung = { id: 't', art: 'text', farbe: '#000', groesse: 0.024, x: 0.19, y: 0.105, text: 'pp' };
    const marker: Anmerkung = { id: 'm', art: 'marker', farbe: 'rgba(255, 214, 0, 0.45)', breite: 0.014, punkte: [0.1, 0.1, 0.3, 0.1] };
    const r = radierZug([text, marker], 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    expect(r.objekte.every((a) => a.art === 'marker')).toBe(true);
    expect(r.objekte).toHaveLength(2);
    // Gerade Enden: Die Lücke reicht nur so weit, wie der Radierer das Band berührt.
    expect((r.objekte[0] as { punkte: number[] }).punkte.at(-2)).toBeCloseTo(0.2 - Math.hypot(0.012, 0.007));
  });
  it('Radier-Spuren selbst werden nicht weg-radiert', () => {
    const spur: Anmerkung = { id: 'alt', art: 'radiert', breite: 0.024, punkte: [0.2, 0.1, 0.3, 0.1] };
    const r = radierZug([spur, strich], 0.2, 0.1, 0.012, 1.414, null, false, neueId);
    expect(r.objekte[0]).toBe(spur);
    expect(r.objekte.slice(1).every((a) => a.art === 'stift')).toBe(true); // der Strich: geschnitten
  });
});
