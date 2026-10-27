import { describe, expect, it } from 'vitest';
import type { Raster, Stimme, Takt } from '@/domain/notation';
import { legen } from '@/domain/notensatz';
import { abschnittKuerzen, nachlaufKuerzen, takteEinsetzen, vorgabeArt, vorlaufKlaenge, zeitStrecken } from '@/domain/taktaufnahme';

const R: Raster = { bpm: 120, zaehler: 4, nenner: 4, feinheit: 16 };
const kurz = (t: Takt) => t.noten.map((n) => `${n.midi ?? 'z'}/${n.dauer}${n.bindung ? '-' : ''}`).join(' ');
const takt = (...noten: [number | null, number, boolean?][]) => legen(noten.map(([midi, dauer, b]) => ({ midi, dauer, ...(b ? { bindung: true as const } : {}) })), R);
const leer = () => takt([null, 16]);
const stimme = (name: string, takte: Takt[]): Stimme => ({ name, schluessel: 'violin', takte });

describe('takteEinsetzen', () => {
  const alt = [takt([60, 16]), takt([62, 16]), takt([64, 16])];
  const neu = [takt([67, 8], [69, 8]), takt([71, 16])];
  it('fügt mitten drin ein, andere Stimmen bekommen dort leere Takte', () => {
    const e = takteEinsetzen([stimme('a', alt), stimme('b', [takt([48, 16]), takt([50, 16]), takt([52, 16])])], 0, 1, neu, 'einfuegen', R);
    expect(e.stimmen[0].takte.map(kurz)).toEqual(['60/16', '67/8 69/8', '71/16', '62/16', '64/16']);
    expect(e.stimmen[1].takte.map(kurz)).toEqual(['48/16', 'z/16', 'z/16', '50/16', '52/16']);
    expect([e.von, e.bis]).toEqual([1, 3]);
  });
  it('ersetzt und wächst über das Ende hinaus, die andere Stimme wird aufgefüllt', () => {
    const e = takteEinsetzen([stimme('a', alt), stimme('b', [takt([48, 16])])], 0, 2, neu, 'ersetzen', R);
    expect(e.stimmen[0].takte.map(kurz)).toEqual(['60/16', '62/16', '67/8 69/8', '71/16']);
    expect(e.stimmen[1].takte.map(kurz)).toEqual(['48/16', 'z/16', 'z/16', 'z/16']);
  });
  it('hängt an, wenn der Zieltakt hinter dem Ende liegt — in beiden Arten gleich', () => {
    for (const art of ['einfuegen', 'ersetzen'] as const) {
      const e = takteEinsetzen([stimme('a', alt)], 0, 3, neu, art, R);
      expect(e.stimmen[0].takte.map(kurz)).toEqual(['60/16', '62/16', '64/16', '67/8 69/8', '71/16']);
      expect([e.von, e.bis]).toEqual([3, 5]);
    }
  });
  it('löst einen Bogen in den Zieltakt, wenn die Höhe nicht passt, und lässt ihn bei gleicher Höhe', () => {
    const gebunden = [takt([60, 16, true]), takt([60, 16])];
    const anders = takteEinsetzen([stimme('a', gebunden)], 0, 1, [takt([62, 16])], 'ersetzen', R);
    expect(anders.stimmen[0].takte.map(kurz)).toEqual(['60/16', '62/16']);
    const gleich = takteEinsetzen([stimme('a', gebunden)], 0, 1, [takt([60, 16])], 'ersetzen', R);
    expect(gleich.stimmen[0].takte.map(kurz)).toEqual(['60/16-', '60/16']);
  });
  it('löst einen Bogen aus dem letzten neuen Takt in den Folgetakt, wenn die Höhe nicht passt', () => {
    const e = takteEinsetzen([stimme('a', alt)], 0, 1, [takt([67, 16, true])], 'einfuegen', R);
    expect(e.stimmen[0].takte.map(kurz)).toEqual(['60/16', '67/16', '62/16', '64/16']);
    const passt = takteEinsetzen([stimme('a', alt)], 0, 1, [takt([62, 16, true])], 'einfuegen', R);
    expect(passt.stimmen[0].takte.map(kurz)).toEqual(['60/16', '62/16-', '62/16', '64/16']);
  });
});

describe('nachlaufKuerzen', () => {
  it('lässt einen Sechzehntel-Nachklang im Folgetakt weg und löst die Bindung', () => {
    const t = [takt([60, 8], [62, 8, true]), takt([62, 1], [null, 15])];
    expect(nachlaufKuerzen(t, R).map(kurz)).toEqual(['60/8 62/8']);
  });
  it('lässt eine echte Überbindung und einen Takt mit eigenem Einsatz stehen', () => {
    const lang = [takt([62, 16, true]), takt([62, 8], [null, 8])];
    expect(nachlaufKuerzen(lang, R).map(kurz)).toEqual(['62/16-', '62/8 z/8']);
    const eigen = [takt([62, 16, true]), takt([62, 1], [64, 3], [null, 12])];
    expect(nachlaufKuerzen(eigen, R)).toHaveLength(2);
    expect(nachlaufKuerzen([takt([60, 16])], R)).toHaveLength(1);
  });
});

describe('abschnittKuerzen und vorgabeArt', () => {
  it('kürzt auf n Takte und löst die Bindung am Schnitt', () => {
    const t = [takt([60, 16, true]), takt([60, 16]), takt([62, 16])];
    expect(abschnittKuerzen(t, 1, R).map(kurz)).toEqual(['60/16']);
    expect(abschnittKuerzen(t, 5, R)).toHaveLength(3);
    expect(abschnittKuerzen(t, 0, R)).toEqual([]);
  });
  it('schlägt Ersetzen für leere Zieltakte und das Stückende vor, sonst Einfügen', () => {
    const t = [takt([60, 16]), leer(), leer(), takt([64, 8], [null, 8])];
    expect(vorgabeArt(t, 1, 2)).toBe('ersetzen');
    expect(vorgabeArt(t, 1, 3)).toBe('einfuegen');
    expect(vorgabeArt(t, 3, 1)).toBe('einfuegen');
    expect(vorgabeArt(t, 4, 2)).toBe('ersetzen');
  });
});

describe('vorlaufKlaenge', () => {
  const a = stimme('a', [takt([60, 16]), takt([62, 8], [64, 8]), takt([65, 16])]);
  const b = stimme('b', [takt([48, 16, true]), takt([48, 16]), takt([50, 16])]);
  it('liefert die Klänge des Vortakts relativ zum Zieltakt, abgeschnitten am Fenster', () => {
    // Takt 2 ist das Ziel: Vorlauf = Takt 1 (2 s bei 120 bpm): a: 62 (−2…−1), 64 (−1…0); b: 48 begann in Takt 0 und wird abgeschnitten.
    const k = vorlaufKlaenge([a, b], R, new Set(), 0, 2, 1, false);
    expect(k.map((x) => [x.midi, +x.beginn.toFixed(3), +x.dauer.toFixed(3)])).toEqual([[48, -2, 2], [62, -2, 1], [64, -1, 1]]);
  });
  it('lässt stumme Stimmen weg, ist bei Takt 1 leer, und bringt mit „weiter“ die Begleitung ab dem Ziel', () => {
    expect(vorlaufKlaenge([a, b], R, new Set([1]), 0, 2, 1, false).map((x) => x.midi)).toEqual([62, 64]);
    expect(vorlaufKlaenge([a, b], R, new Set(), 0, 0, 1, false)).toEqual([]);
    const weiter = vorlaufKlaenge([a, b], R, new Set(), 0, 2, 0, true);
    expect(weiter.map((x) => [x.midi, +x.beginn.toFixed(3), +x.dauer.toFixed(3)])).toEqual([[50, 0, 2]]);
  });
});

describe('zeitStrecken', () => {
  it('skaliert die Zeiten', () => {
    expect(zeitStrecken([{ zeit: 1, midi: 60 }, { zeit: 2.5, midi: null }], 0.75).map((f) => f.zeit)).toEqual([0.75, 1.875]);
  });
});
