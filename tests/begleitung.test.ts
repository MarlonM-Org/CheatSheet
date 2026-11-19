import { describe, expect, it } from 'vitest';
import { akkordLesen, folgeLesen, tonKlasse, type Akkord } from '@/domain/akkorde';
import {
  akkordLagen, akkordTakte, abschnitte, alsKlaenge, begleitKlicks, begleitungBauen, beispielLinie, einzaehlKlicks, folgeAlsSymbole, griff, griffStufen, nahe,
  stilAusGefuehl, tempoAusGefuehl,
} from '@/domain/begleitung';
import { JAM_STUECKE, jamLesen } from '@/domain/jamkarte';

const A = (s: string) => akkordLesen(s) as Akkord;
const klasse = (m: number) => ((m % 12) + 12) % 12;
const takteVon = (text: string) => folgeLesen(text).takte;

describe('Stil und Tempo aus dem Gefühl', () => {
  it('liest die Gefühle der Jam-Karte', () => {
    expect(stilAusGefuehl('Medium Swing')).toBe('swing');
    expect(stilAusGefuehl('Shuffle oder Swing')).toBe('swing');
    expect(stilAusGefuehl('Langsamer Swing')).toBe('swing');
    expect(stilAusGefuehl('Bossa Nova')).toBe('bossa');
    expect(stilAusGefuehl('Funk / gerade Achtel')).toBe('gerade');
    expect(stilAusGefuehl('Ballad')).toBe('ballade');
    expect(stilAusGefuehl(undefined)).toBe('swing');
  });
  it('Tempo-Hinweis: Ballade langsam, Up schnell', () => {
    expect(tempoAusGefuehl('Ballad')).toBeLessThan(tempoAusGefuehl('Langsamer Swing'));
    expect(tempoAusGefuehl('Langsamer Swing')).toBeLessThan(tempoAusGefuehl('Medium Swing'));
    expect(tempoAusGefuehl('Medium Swing')).toBeLessThan(tempoAusGefuehl('Medium-Up Swing'));
  });
});

describe('Akkorde im Takt', () => {
  it('teilt den Takt auf Schläge', () => {
    expect(akkordLagen(1, 4)).toEqual([0]);
    expect(akkordLagen(2, 4)).toEqual([0, 2]);
    expect(akkordLagen(3, 4)).toEqual([0, 1, 2]);
    expect(akkordLagen(4, 4)).toEqual([0, 1, 2, 3]);
    expect(akkordLagen(2, 3)).toEqual([0, 1]);
    expect(akkordLagen(5, 4)).toEqual([0, 0.5, 1, 2, 3]);
  });
  it('Abschnitte mit Dauer', () => {
    const [t] = takteVon('| Dm7 G7 |');
    expect(abschnitte(t, 4).map((x) => [x.ab, x.dauer])).toEqual([[0, 2], [2, 2]]);
  });
});

describe('Klavier-Griffe', () => {
  it('Septakkorde ohne Grundton, mit None (Dominante: 9 und 13)', () => {
    expect(griffStufen(A('C7'))).toEqual([4, 10, 2, 9]);
    expect(griffStufen(A('Cm7'))).toEqual([3, 10, 2, 7]);
    expect(griffStufen(A('Cmaj7'))).toEqual([4, 11, 2, 7]);
    expect(griffStufen(A('C6'))).toEqual([4, 9, 2, 7]);
    expect(griffStufen(A('Cm7b5'))).toEqual([3, 10, 6]);
    expect(new Set(griffStufen(A('Cdim7')))).toEqual(new Set([3, 6, 9]));
  });
  it('Alterierte Dominante: 3, ♭7, ♯9, ♭13', () => {
    expect(griffStufen(A('C7alt'))).toEqual([4, 10, 3, 8]);
  });
  it('Dreiklänge bleiben Dreiklänge mit Grundton', () => {
    expect(griffStufen(A('C'))).toEqual([0, 4, 7]);
    expect(griffStufen(A('Cm'))).toEqual([0, 3, 7]);
  });
  it('enge Lage im Bereich, richtige Töne', () => {
    for (const s of ['C7', 'F#m7', 'Bbmaj7', 'Ebm7b5', 'G7alt', 'Ab6', 'Db', 'B7#11']) {
      const a = A(s);
      const m = griff(a);
      expect(m[0], s).toBeGreaterThanOrEqual(52);
      expect(m[0], s).toBeLessThan(64);
      expect(m[m.length - 1] - m[0], s).toBeLessThanOrEqual(12);
      const soll = new Set(griffStufen(a).map((h) => klasse(tonKlasse(a.grund) + h)));
      expect(new Set(m.map(klasse)), s).toEqual(soll);
    }
  });
  it('Stimmführung: ii–V–I bewegt sich wenig', () => {
    const dm = griff(A('Dm7')), g = griff(A('G7'), dm), c = griff(A('Cmaj7'), g);
    const weg = (x: number[], y: number[]) => y.reduce((s, m) => s + Math.min(...x.map((v) => Math.abs(v - m))), 0);
    expect(weg(dm, g)).toBeLessThanOrEqual(6);
    expect(weg(g, c)).toBeLessThanOrEqual(6);
  });
});

describe('Begleitung', () => {
  const blues = jamLesen(JAM_STUECKE.find((s) => s.id === 'blues-b')!).teile[0].folge.takte;
  it('Swing: je Takt Bass auf der Eins mit dem Grundton, Zeiten im Takt', () => {
    const b = begleitungBauen(blues, 'swing');
    expect(b).toHaveLength(12);
    b.forEach((takt, i) => {
      const bass = takt.filter((t) => t.stimme === 'bass');
      expect(bass[0].schlag).toBe(0);
      expect(klasse(bass[0].midi), `Takt ${i + 1}`).toBe(tonKlasse(blues[i].akkorde[0].grund));
      for (const t of takt) {
        expect(t.schlag).toBeGreaterThanOrEqual(0);
        expect(t.schlag + t.dauer).toBeLessThanOrEqual(4 + 1e-9);
        expect(t.dauer).toBeGreaterThan(0);
      }
      for (const t of bass) { expect(t.midi).toBeGreaterThanOrEqual(36); expect(t.midi).toBeLessThanOrEqual(60); }
      expect(takt.some((t) => t.stimme === 'akkord')).toBe(true);
    });
  });
  it('Walking Bass: vier Viertel im Takt mit einem Akkord, zwei Akkorde: je zwei', () => {
    const b = begleitungBauen(blues, 'swing');
    expect(b[0].filter((t) => t.stimme === 'bass').map((t) => t.schlag)).toEqual([0, 1, 2, 3]);
    expect(b[3].filter((t) => t.stimme === 'bass').map((t) => t.schlag)).toEqual([0, 1, 2, 3]);
    // Takt 4 (Fm7 B♭7): auf der Drei der zweite Grundton.
    expect(klasse(b[3].filter((t) => t.stimme === 'bass')[2].midi)).toBe(10);
  });
  it('Im Kreis: der letzte Ton führt chromatisch zum ersten Grundton', () => {
    const b = begleitungBauen(blues, 'swing');
    const letzter = b[11].filter((t) => t.stimme === 'bass').pop()!;
    const erster = b[0].filter((t) => t.stimme === 'bass')[0];
    expect(Math.abs(letzter.midi - erster.midi)).toBe(1);
  });
  it('Ohne Schleife endet die Form mit einem ausgehaltenen Schlussakkord', () => {
    const b = begleitungBauen(blues, 'swing', { schleife: false });
    const schluss = b[11];
    expect(schluss.every((t) => t.schlag === 0 && t.dauer > 3.5)).toBe(true);
    expect(schluss.filter((t) => t.stimme === 'bass')).toHaveLength(1);
  });
  it('Bossa: Bass 1 – 2-und – 3 – 4-und, Klavier synkopiert', () => {
    const b = begleitungBauen(takteVon('| Cm7 | Cm7 |'), 'bossa');
    expect(b[0].filter((t) => t.stimme === 'bass').map((t) => t.schlag)).toEqual([0, 1.5, 2, 3.5]);
    expect([...new Set(b[0].filter((t) => t.stimme === 'akkord').map((t) => t.schlag))]).toEqual([0, 1.5, 3]);
    expect([...new Set(b[1].filter((t) => t.stimme === 'akkord').map((t) => t.schlag))]).toEqual([1, 2.5]);
  });
  it('Swing-Achtel: das Und liegt hinter der Mitte', () => {
    const b = begleitungBauen(takteVon('| C7 |'), 'swing');
    const und = b[0].filter((t) => t.stimme === 'akkord').map((t) => t.schlag).filter((x) => x % 1 !== 0);
    expect(und.length).toBeGreaterThan(0);
    for (const x of und) expect(x % 1).toBeCloseTo(0.62);
  });
  it('Ballade: Grundton und Quinte in Halben', () => {
    const b = begleitungBauen(takteVon('| Cmaj7 | Cmaj7 |'), 'ballade');
    const bass = b[0].filter((t) => t.stimme === 'bass');
    expect(bass.map((t) => t.schlag)).toEqual([0, 2]);
    expect(klasse(bass[1].midi)).toBe(7);
  });
  it('alle Jam-Stücke in allen Stilen ohne Lücke', () => {
    for (const s of JAM_STUECKE) {
      const takte = jamLesen(s).teile.flatMap((t) => t.folge.takte);
      for (const stil of ['swing', 'bossa', 'gerade', 'ballade'] as const) {
        const b = begleitungBauen(takte, stil);
        expect(b).toHaveLength(takte.length);
        for (const t of b) expect(t.length, `${s.id} ${stil}`).toBeGreaterThan(0);
        for (const t of b.flat()) expect(Number.isFinite(t.midi) && Number.isFinite(t.schlag)).toBe(true);
      }
    }
  });
});

describe('Klick', () => {
  it('Swing auf 2 und 4, Bossa auf jedem Schlag, Einzähler mit betonter Eins', () => {
    expect(begleitKlicks('swing').map((k) => k.schlag)).toEqual([1, 3]);
    expect(begleitKlicks('ballade').map((k) => k.schlag)).toEqual([1, 3]);
    expect(begleitKlicks('bossa').map((k) => k.schlag)).toEqual([0, 1, 2, 3]);
    expect(begleitKlicks('swing', 3).map((k) => k.schlag)).toEqual([0, 1, 2]);
    expect(einzaehlKlicks().map((k) => k.betont)).toEqual([true, false, false, false]);
  });
});

describe('Hörbeispiele', () => {
  const ii_v_i = takteVon('| Dm7 | G7 | Cmaj7 | Cmaj7 |');
  it('Grundtöne: je Akkord der Grundton, so lang wie der Akkord', () => {
    const l = beispielLinie(takteVon('| Dm7 G7 | Cmaj7 |'), 'grundtoene');
    expect(l[0].map((t) => [t.schlag, t.dauer, klasse(t.midi)])).toEqual([[0, 2, 2], [2, 2, 7]]);
    expect(l[1].map((t) => klasse(t.midi))).toEqual([0]);
  });
  it('Guide Tones: Terz oder Septime, Schritte höchstens ein Ganzton', () => {
    const l = beispielLinie(ii_v_i, 'guidetones').flat();
    expect(l).toHaveLength(4);
    for (let i = 1; i < l.length; i++) expect(Math.abs(l[i].midi - l[i - 1].midi)).toBeLessThanOrEqual(2);
    const dm = A('Dm7'), g = A('G7');
    const guide = (a: Akkord) => a.toene.filter((t) => t.guide).map((t) => klasse(tonKlasse(a.grund) + t.halbtoene));
    expect(guide(dm)).toContain(klasse(l[0].midi));
    expect(guide(g)).toContain(klasse(l[1].midi));
  });
  it('Arpeggien: 1–3–5–7 in Vierteln, Dreiklang mit Oktave', () => {
    const l = beispielLinie(takteVon('| Cmaj7 | F |'), 'arpeggien');
    expect(l[0].map((t) => t.midi - l[0][0].midi)).toEqual([0, 4, 7, 11]);
    expect(l[0].map((t) => t.schlag)).toEqual([0, 1, 2, 3]);
    expect(l[1].map((t) => t.midi - l[1][0].midi)).toEqual([0, 4, 7, 12]);
  });
});

describe('Hilfen', () => {
  it('nahe: nächste Lage im Bereich, auch bei engem Bereich ohne Endlosschleife', () => {
    expect(nahe(0, 47)).toBe(48);
    expect(nahe(6, 60, 55, 65)).toBeGreaterThanOrEqual(55);
  });
  it('Symbole je Takt hin und zurück', () => {
    const t = takteVon('| Bb7 | Fm7 Bb7 | Dm7b5 G7alt |');
    expect(folgeAlsSymbole(akkordTakte(folgeAlsSymbole(t)))).toEqual([['Bb7'], ['Fm7', 'Bb7'], ['Dm7b5', 'G7alt']]);
    expect(akkordTakte([['Xy', 'C']])[0].akkorde).toHaveLength(1);
  });
});

describe('Als Klänge', () => {
  it('Sekunden nach Tempo, ab einem Takt', () => {
    const b = begleitungBauen(takteVon('| C7 | F7 | C7 |'), 'swing', { schleife: false });
    const k = alsKlaenge(b, 120, { ab: 1 });
    expect(k[0].beginn).toBe(0);
    expect(Math.max(...k.map((x) => x.beginn))).toBeLessThan(4);
    expect(k.some((x) => x.stimme === 'bass')).toBe(true);
    const bass = k.filter((x) => x.stimme === 'bass').map((x) => x.beginn);
    expect(bass.slice(0, 4)).toEqual([0, 0.5, 1, 1.5]);
  });
});
