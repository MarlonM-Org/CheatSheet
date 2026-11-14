import { describe, expect, it } from 'vitest';
import { nachTitel, zumOffenen, zeitpunkt } from '@/domain/notenpult';

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

describe('Bibliothek öffnet beim offenen Stück (B-17)', () => {
  // Liste mit 600 px Sicht, 3000 px Inhalt, frisch geöffnet (scroll 0).
  const m = { scroll: 0, sicht: 600, gesamt: 3000 };
  it('offenes und nächstes Stück schon im Bild: Liste bleibt oben stehen', () => {
    expect(zumOffenen({ ...m, oben: 300, unten: 420 })).toBeNull();
    // Das letzte Stück, ganz im Bild (unten = seine eigene Unterkante).
    expect(zumOffenen({ ...m, oben: 520, unten: 580 })).toBeNull();
  });
  it('weiter unten: die Zeile rückt ins obere Drittel, darunter die nächsten', () => {
    expect(zumOffenen({ ...m, oben: 1500, unten: 1620 })).toBe(1300);
    // Offenes im Bild, das nächste nicht ganz: auch dann.
    expect(zumOffenen({ ...m, oben: 520, unten: 640 })).toBe(320);
  });
  it('nie über das Ende hinaus und nie über den Anfang', () => {
    expect(zumOffenen({ ...m, oben: 2900, unten: 2960 })).toBe(2400);
    expect(zumOffenen({ ...m, scroll: 900, oben: 100, unten: 220 })).toBe(0);
  });
  it('schon gescrollt und im Bild: nichts tun', () => {
    expect(zumOffenen({ ...m, scroll: 1000, oben: 1200, unten: 1320 })).toBeNull();
  });
});
