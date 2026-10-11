import { describe, expect, it } from 'vitest';
import { nachTitel, zeitpunkt } from '@/domain/notenpult';

const n = (titel: string, stimme = '') => ({ titel, stimme });

describe('Bibliothek A–Z', () => {
  it('Zahlen am Anfang zählen als Zahlen: 1, 2, … 9, 10, 12', () => {
    const titel = ['10 Ungarische Tänze Nr 5', '1 Pomp and Circumstance', '12 Pirates of the Caribbean', '2 Concerto for Trumpet', '3 Sax Wind and Brass', '9 Finale'];
    expect([...titel].map((t) => n(t)).sort(nachTitel).map((x) => x.titel)).toEqual([
      '1 Pomp and Circumstance', '2 Concerto for Trumpet', '3 Sax Wind and Brass', '9 Finale', '10 Ungarische Tänze Nr 5', '12 Pirates of the Caribbean',
    ]);
  });
  it('Groß/klein egal, Umlaute an ihrem Platz, gleicher Titel nach Stimme', () => {
    expect([n('zebra'), n('Apfel'), n('Äpfel'), n('banane')].sort(nachTitel).map((x) => x.titel)).toEqual(['Apfel', 'Äpfel', 'banane', 'zebra']);
    expect([n('Marsch', 'Klarinette 2'), n('Marsch', 'Klarinette 10'), n('Marsch', 'Klarinette 1')].sort(nachTitel).map((x) => x.stimme))
      .toEqual(['Klarinette 1', 'Klarinette 2', 'Klarinette 10']);
  });
});

describe('Zeitpunkt „zuletzt“', () => {
  const jetzt = new Date(2026, 9, 11, 20, 0).getTime();
  it('Tag, Monat und Uhrzeit', () => {
    expect(zeitpunkt(new Date(2026, 9, 11, 18, 48).getTime(), jetzt)).toBe('11.10., 18:48');
    expect(zeitpunkt(new Date(2026, 0, 3, 7, 5).getTime(), jetzt)).toBe('03.01., 07:05');
  });
  it('aus einem anderen Jahr mit Jahreszahl', () => {
    expect(zeitpunkt(new Date(2025, 11, 24, 9, 30).getTime(), jetzt)).toBe('24.12.2025, 09:30');
  });
});
