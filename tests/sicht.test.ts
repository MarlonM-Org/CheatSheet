import { describe, expect, it } from 'vitest';
import {
  bereichLesen, inSicht, neueLesezeichen, quellenText, seitenInSicht, stellenJeStueck, stueckeAusLesezeichen, stueckeMitSeite, zurPdf, zurSicht,
} from '@/domain/sicht';

const v = { id: 'v', quelle: { stueckId: 'q', von: 3, bis: 5 } };
const echt: { id: string; quelle?: { stueckId: string; von: number; bis: number } } = { id: 'q' };

describe('Sicht eines virtuellen Stücks', () => {
  it('zählt seine Seiten ab 1, höchstens bis zum Ende der PDF', () => {
    expect(seitenInSicht(v, 10)).toBe(3);
    expect(seitenInSicht(v, 4)).toBe(2);
    expect(seitenInSicht(v, 2)).toBe(0);
    expect(seitenInSicht(echt, 10)).toBe(10);
  });
  it('rechnet PDF-Seiten in die Sicht um und zurück', () => {
    expect(zurSicht(v, 3)).toBe(1);
    expect(zurSicht(v, 5)).toBe(3);
    expect(zurSicht(v, 2)).toBeNull();
    expect(zurSicht(v, 6)).toBeNull();
    expect(zurSicht(echt, 7)).toBe(7);
    expect(zurPdf(v, 1)).toBe(3);
    expect(zurPdf(echt, 7)).toBe(7);
  });
  it('zeigt von Stellen und Anmerkungen nur die im Bereich, mit Sicht-Seite', () => {
    const liste = [{ id: 'a', seite: 2 }, { id: 'b', seite: 3 }, { id: 'c', seite: 5 }, { id: 'd', seite: 6 }];
    expect(inSicht(v, liste)).toEqual([{ id: 'b', seite: 1 }, { id: 'c', seite: 3 }]);
    expect(inSicht(echt, liste)).toEqual(liste);
    // Unveränderte Einträge bleiben dieselben Objekte (keine Neuzeichnung).
    expect(inSicht(echt, liste)[0]).toBe(liste[0]);
  });
  it('weiß, welche Stücke eine PDF-Seite zeigen', () => {
    const stuecke = [echt, v, { id: 'w', quelle: { stueckId: 'q', von: 1, bis: 2 } }, { id: 'x' }];
    expect(stueckeMitSeite(stuecke, 'q', 4)).toEqual(['q', 'v']);
    expect(stueckeMitSeite(stuecke, 'q', 1)).toEqual(['q', 'w']);
    expect(stueckeMitSeite(stuecke, 'x', 1)).toEqual(['x']);
  });
  it('zählt Stellen auch für virtuelle Stücke', () => {
    const stellen = [{ stueckId: 'q', seite: 1 }, { stueckId: 'q', seite: 4 }, { stueckId: 'q', seite: 5 }, { stueckId: 'x', seite: 1 }];
    expect(stellenJeStueck([echt, v, { id: 'x' }], stellen)).toEqual({ q: 3, v: 2, x: 1 });
  });
});

describe('Bereich für ein neues virtuelles Stück', () => {
  it('liest von–bis aus Text', () => {
    expect(bereichLesen('3', '5', 10)).toEqual({ von: 3, bis: 5 });
    expect(bereichLesen(' 3 ', '', 10)).toEqual({ von: 3, bis: 3 });
  });
  it('nennt den Grund, wenn der Bereich nicht passt', () => {
    expect(bereichLesen('a', '5', 10)).toMatch(/ganze Seitenzahlen/);
    expect(bereichLesen('0', '5', 10)).toMatch(/Seiten 1 bis 10/);
    expect(bereichLesen('1', '2', 1)).toMatch(/nur 1 Seite/);
    expect(bereichLesen('5', '3', 10)).toMatch(/vor der ersten/);
    expect(bereichLesen('1', '10', 10)).toMatch(/alle Seiten/);
  });
});

describe('Stücke aus Lesezeichen', () => {
  const lz = (seite: number, titel = `L${seite}`) => ({ seite, titel });
  it('je Lesezeichen ein Stück bis vor das nächste, das letzte bis zum Ende', () => {
    expect(stueckeAusLesezeichen([lz(7), lz(1, 'Marsch'), lz(4)], 10)).toEqual([
      { titel: 'Marsch', von: 1, bis: 3 }, { titel: 'L4', von: 4, bis: 6 }, { titel: 'L7', von: 7, bis: 10 },
    ]);
  });
  it('gleiche Seite nur einmal, außerhalb der PDF gar nicht, leerer Titel heißt „Seite n“', () => {
    expect(stueckeAusLesezeichen([lz(2, ''), lz(2, 'B'), lz(12)], 10)).toEqual([{ titel: 'Seite 2', von: 2, bis: 10 }]);
  });
  it('lässt Bereiche aus, die es schon als Stück gibt', () => {
    expect(stueckeAusLesezeichen([lz(1), lz(4)], 10, [{ stueckId: 'q', von: 1, bis: 3 }])).toEqual([{ titel: 'L4', von: 4, bis: 10 }]);
  });
  it('ohne Lesezeichen nichts', () => {
    expect(stueckeAusLesezeichen([], 10)).toEqual([]);
  });
});

describe('Lesezeichen aus dem Inhaltsverzeichnis', () => {
  it('nur neue Punkte, ohne Doppelte, nur innerhalb der PDF', () => {
    const g = [{ titel: 'Marsch', seite: 1 }, { titel: ' marsch ', seite: 1 }, { titel: 'Polka', seite: 4 }, { titel: '', seite: 5 }, { titel: 'Weg', seite: 11 }, { titel: 'Halb', seite: 2.5 }];
    expect(neueLesezeichen(g, [{ seite: 4, titel: 'Polka' }], 10)).toEqual([{ titel: 'Marsch', seite: 1 }]);
  });
  it('derselbe Titel auf einer anderen Seite ist neu', () => {
    expect(neueLesezeichen([{ titel: 'Trio', seite: 6 }], [{ seite: 2, titel: 'Trio' }], 10)).toEqual([{ titel: 'Trio', seite: 6 }]);
  });
});

describe('Text zur Quelle', () => {
  it('nennt Seiten und Quelle', () => {
    expect(quellenText({ stueckId: 'q', von: 3, bis: 5 }, 'Band')).toBe('Seiten 3–5 aus „Band“');
    expect(quellenText({ stueckId: 'q', von: 3, bis: 3 }, undefined)).toBe('Seite 3');
  });
});
