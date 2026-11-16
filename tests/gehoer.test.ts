import { describe, expect, it } from 'vitest';
import {
  bewerten, dauern, einsaetze, empfehlung, hinweis, istStufe, nachbarStufe, naechsterGrundton, phraseDauer, phraseErzeugen,
  phraseKlaenge, rundeMerken, vorlaufFuerRunde, STUFEN, UMFANG, verlaufLesen, VERLAUF_MAX, zufall, type Phrase, type Runde,
} from '@/domain/gehoer';
import type { Tonstueck } from '@/domain/notation';

const RUHE = new Set([0, 4, 7, 12, -5]);
const LEITER = new Set([0, 2, 4, 5, 7, 9, 11]);

// Gespielte Tonstücke genau wie die Phrase (Zeit ab dem Einsatz).
function wieGespielt(p: Phrase, bpm: number, versatz = 0): Tonstueck[] {
  return phraseKlaenge(p, bpm).map((k) => ({ start: k.beginn + versatz, ende: k.beginn + k.dauer + versatz, midi: k.midi }));
}

describe('Phrasen', () => {
  it('jede Stufe: richtige Länge, Takt voll, Ruhetöne an den Enden, keine Wiederholung, im Umfang', () => {
    for (const s of STUFEN) {
      for (let seed = 1; seed <= 300; seed++) {
        const g = 55 + (seed % 13);
        const p = phraseErzeugen(s.id, g, seed);
        expect(p.toene).toHaveLength(s.laenge);
        expect(p.toene.reduce((a, t) => a + t.dauer, 0)).toBe(s.takte * 4);
        expect(RUHE.has(p.toene[0].midi - g)).toBe(true);
        expect(RUHE.has(p.toene[p.toene.length - 1].midi - g)).toBe(true);
        expect(p.toene[p.toene.length - 1].dauer).toBeGreaterThanOrEqual(1);
        for (let i = 0; i < p.toene.length; i++) {
          const t = p.toene[i];
          expect(t.midi).toBeGreaterThanOrEqual(UMFANG.von);
          expect(t.midi).toBeLessThanOrEqual(UMFANG.bis);
          expect(s.toene).toContain(t.midi - g);
          if (i) {
            expect(t.midi).not.toBe(p.toene[i - 1].midi);
            expect(Math.abs(t.midi - p.toene[i - 1].midi)).toBeLessThanOrEqual(s.sprung);
          }
        }
      }
    }
  });

  it('gleicher Startwert, gleiche Phrase', () => {
    expect(phraseErzeugen('leiter', 60, 42)).toEqual(phraseErzeugen('leiter', 60, 42));
  });

  it('chromatisch: leiterfremde Töne lösen sich per Halbton in einen Leiterton auf', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = phraseErzeugen('chromatisch', 60, seed);
      p.toene.forEach((t, i) => {
        const a = ((t.midi - 60) % 12 + 12) % 12;
        if (!LEITER.has(a)) {
          const n = p.toene[i + 1];
          expect(n).toBeDefined();
          expect(Math.abs(n.midi - t.midi)).toBe(1);
          expect(LEITER.has(((n.midi - 60) % 12 + 12) % 12)).toBe(true);
        }
      });
    }
  });

  it('Achtel paarweise: jeder Ton nach einer Achtel auf dem Schlag oder auf der Zählzeit „und" eines Paares', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const d = dauern(6, 2, true, zufall(seed));
      expect(d.reduce((a, b) => a + b, 0)).toBe(8);
      expect(d[d.length - 1]).toBeGreaterThanOrEqual(1);
      const e = einsaetze({ stufe: 'rhythmus', grundton: 60, takte: 2, toene: d.map((x) => ({ midi: 60, dauer: x })) });
      expect(Number.isInteger(e[e.length - 1])).toBe(true);
    }
  });

  it('Klänge: Einsätze in Sekunden, Vorlauf negativ', () => {
    const p: Phrase = { stufe: 'drei', grundton: 60, takte: 1, toene: [{ midi: 60, dauer: 1 }, { midi: 62, dauer: 1 }, { midi: 64, dauer: 2 }] };
    expect(phraseKlaenge(p, 60).map((k) => k.beginn)).toEqual([0, 1, 2]);
    expect(phraseKlaenge(p, 120, -2).map((k) => k.beginn)).toEqual([-2, -1.5, -1]);
    expect(phraseDauer(p, 120)).toBe(2);
  });

  it('Vorlauf: Phrase, dann ein Takt Einzählen vor der Antwort', () => {
    const p: Phrase = { stufe: 'drei', grundton: 60, takte: 1, toene: [{ midi: 60, dauer: 1 }, { midi: 62, dauer: 1 }, { midi: 64, dauer: 2 }] };
    const v = vorlaufFuerRunde(p, 60);
    expect(v.takte).toBe(2);
    expect(v.klaenge.map((k) => k.beginn)).toEqual([-8, -7, -6]);
    // Der letzte Ton endet vor dem Einzähl-Takt.
    const letzter = v.klaenge[v.klaenge.length - 1];
    expect(letzter.beginn + letzter.dauer).toBeLessThanOrEqual(-4);
  });

  it('Grundton wechselt nur auf Wunsch und bleibt ein Leiterton im Bereich', () => {
    expect(naechsterGrundton(60, false, zufall(1))).toBe(60);
    for (let s = 1; s < 100; s++) {
      const g = naechsterGrundton(60, true, zufall(s));
      expect(g).not.toBe(60);
      expect(g).toBeGreaterThanOrEqual(55);
      expect(g).toBeLessThanOrEqual(67);
      expect(LEITER.has(g % 12)).toBe(true);
    }
  });
});

describe('Bewertung', () => {
  const p: Phrase = { stufe: 'fuenf', grundton: 60, takte: 1, toene: [{ midi: 60, dauer: 1 }, { midi: 64, dauer: 1 }, { midi: 62, dauer: 1 }, { midi: 67, dauer: 1 }] };

  it('alles richtig und im Takt', () => {
    const e = bewerten(p, wieGespielt(p, 90), 90);
    expect(e.richtig).toBe(4);
    expect(e.imTakt).toBe(4);
    expect(e.quote).toBe(1);
    expect(hinweis(e)).toMatch(/Alles richtig/);
  });

  it('falscher Ton zählt als falsch, nicht als fehlt + zuviel', () => {
    const g = wieGespielt(p, 90);
    g[2] = { ...g[2], midi: 63 };
    const e = bewerten(p, g, 90);
    expect(e.noten.map((b) => b.art)).toEqual(['richtig', 'richtig', 'falsch', 'richtig']);
    expect(e.zuviel).toBe(0);
  });

  it('ausgelassener Ton fehlt, überzähliger zählt als zuviel', () => {
    const g = wieGespielt(p, 90);
    const ohne = [g[0], g[1], g[3]];
    expect(bewerten(p, ohne, 90).noten.map((b) => b.art)).toEqual(['richtig', 'richtig', 'fehlt', 'richtig']);
    const mit = [g[0], { start: 0.4, ende: 0.5, midi: 70 }, ...g.slice(1)];
    const e = bewerten(p, mit, 90);
    expect(e.richtig).toBe(4);
    expect(e.zuviel).toBe(1);
  });

  it('falsche Oktave zählt als richtig, markiert', () => {
    const g = wieGespielt(p, 90);
    g[3] = { ...g[3], midi: 79 };
    const e = bewerten(p, g, 90);
    expect(e.richtig).toBe(4);
    expect(e.noten[3].oktave).toBe(true);
  });

  it('zu spät: richtig, aber nicht im Takt', () => {
    const e = bewerten(p, wieGespielt(p, 60, 0.5), 60);
    expect(e.richtig).toBe(4);
    expect(e.imTakt).toBe(0);
    expect(hinweis(e)).toMatch(/Klick/);
  });

  it('Töne weit nach dem Ende zählen nicht', () => {
    const g = [...wieGespielt(p, 120), { start: 10, ende: 11, midi: 50 }];
    expect(bewerten(p, g, 120).zuviel).toBe(0);
  });

  it('Hinweise: nichts gehört, Anfang, Richtung', () => {
    expect(hinweis(bewerten(p, [], 90))).toMatch(/Nichts gehört/);
    const g = wieGespielt(p, 90);
    expect(hinweis(bewerten(p, [{ ...g[0], midi: 62 }, ...g.slice(1)], 90))).toMatch(/Anfang/);
    // Richtung verkehrt: 60 → 57 → 59 → 55 (statt hoch, runter, hoch)
    const verkehrt = [g[0], { ...g[1], midi: 57 }, { ...g[2], midi: 59 }, { ...g[3], midi: 55 }];
    expect(hinweis(bewerten(p, verkehrt, 90))).toMatch(/Richtung/);
  });
});

describe('Verlauf und Stufen', () => {
  const r = (stufe: Runde['stufe'], quote: number, am = 1): Runde => ({ am, stufe, grundton: 60, quote });

  it('fünf gute Runden: hoch; drei schlechte: runter; Ränder bleiben', () => {
    expect(empfehlung([r('drei', 0.9), r('drei', 0.8), r('drei', 1), r('drei', 0.8), r('drei', 0.9)], 'drei')).toBe('hoch');
    expect(empfehlung([r('drei', 0.9), r('drei', 0.8), r('drei', 1), r('drei', 0.8)], 'drei')).toBeNull();
    expect(empfehlung([r('fuenf', 0.2), r('fuenf', 0.3), r('fuenf', 0.4)], 'fuenf')).toBe('runter');
    expect(empfehlung([r('drei', 0), r('drei', 0), r('drei', 0)], 'drei')).toBeNull();
    // Nur die Runden seit dem Wechsel auf die Stufe zählen.
    expect(empfehlung([r('drei', 1), r('drei', 1), r('drei', 1), r('fuenf', 1), r('fuenf', 1)], 'fuenf')).toBeNull();
  });

  it('Nachbarstufe, Prüfen, Begrenzung', () => {
    expect(nachbarStufe('drei', 'hoch')).toBe('fuenf');
    expect(nachbarStufe('drei', 'runter')).toBe('drei');
    expect(istStufe('leiter')).toBe(true);
    expect(istStufe('gibtsnicht')).toBe(false);
    expect(verlaufLesen([r('drei', 0.5), { am: 1, stufe: 'x', grundton: 60, quote: 0.5 }, r('drei', 2), null])).toHaveLength(1);
    expect(verlaufLesen('kaputt')).toEqual([]);
    let v: Runde[] = [];
    for (let i = 0; i < VERLAUF_MAX + 10; i++) v = rundeMerken(v, r('drei', 0.5, i));
    expect(v).toHaveLength(VERLAUF_MAX);
    expect(v[0].am).toBe(10);
  });
});
