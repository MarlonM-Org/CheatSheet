import { describe, expect, it } from 'vitest';
import {
  ablage, dateiVon, loeschFolgen, loeschHinweis, quelleFehler, setlistenOhne, type Loeschbestand, type Setliste,
} from '@/domain/bestand';

const echt = (id: string, titel = id) => ({ id, titel });
const virtuell = (id: string, quelle: string, titel = id) => ({ id, titel, quelle: { stueckId: quelle, von: 3, bis: 5 } });
const liste = (id: string, eintraege: Setliste['eintraege']): Setliste => ({ id, titel: `Liste ${id}`, erstellt: 1, eintraege });

describe('Virtuelle Stücke teilen die Seiten der Quelle', () => {
  it('Seite 1 des virtuellen ist Seite „von“ der PDF, gespeichert unter der Quelle', () => {
    const v = { id: 'v', quelle: { stueckId: 'q', von: 3, bis: 5 } };
    expect(ablage(v, 1)).toEqual({ stueckId: 'q', seite: 3 });
    expect(ablage(v, 3)).toEqual({ stueckId: 'q', seite: 5 });
    expect(dateiVon(v)).toBe('q');
  });
  it('ein echtes Stück legt bei sich selbst ab', () => {
    expect(ablage({ id: 'a' }, 2)).toEqual({ stueckId: 'a', seite: 2 });
    expect(dateiVon({ id: 'a' })).toBe('a');
  });
  it('die Quelle muss ein echtes Stück sein, der Bereich gültig', () => {
    const q = { stueckId: 'q', von: 2, bis: 4 };
    expect(quelleFehler(q, {})).toBeNull();
    expect(quelleFehler({ ...q, von: 4, bis: 4 }, {})).toBeNull();
    expect(quelleFehler(q, undefined)).toMatch(/gibt es nicht/);
    expect(quelleFehler(q, { quelle: { stueckId: 'x', von: 1, bis: 1 } })).toMatch(/eigener PDF/);
    expect(quelleFehler({ ...q, von: 0 }, {})).toMatch(/Seitenbereich/);
    expect(quelleFehler({ ...q, von: 5, bis: 4 }, {})).toMatch(/Seitenbereich/);
    expect(quelleFehler({ ...q, von: 1.5 }, {})).toMatch(/Seitenbereich/);
    expect(quelleFehler({ von: 1, bis: 2 }, {})).toMatch(/Quelle fehlt/);
    expect(quelleFehler(null, {})).toMatch(/Quelle fehlt/);
  });
});

describe('Löschen und seine Folgen', () => {
  const bestand: Loeschbestand = {
    stuecke: [echt('band', 'Sammelband'), virtuell('marsch', 'band', 'Marsch'), virtuell('polka', 'band', 'Polka'), echt('pomp', 'Pomp'), virtuell('anders', 'pomp')],
    lesezeichen: [{ id: 'lz-band', stueckId: 'band' }, { id: 'lz-marsch', stueckId: 'marsch' }, { id: 'lz-pomp', stueckId: 'pomp' }],
    merker: [{ id: 'band:1', stueckId: 'band' }, { id: 'polka:1', stueckId: 'polka' }, { id: 'pomp:2', stueckId: 'pomp' }],
    setlisten: [
      liste('konzert', [
        { id: '1', art: 'stueck', stueckId: 'pomp' },
        { id: '2', art: 'stueck', stueckId: 'marsch' },
        { id: '3', art: 'platzhalter', titel: 'auswendig' },
        { id: '4', art: 'lesezeichen', lesezeichenId: 'lz-band' },
        { id: '5', art: 'stueck', stueckId: 'pomp' },
      ]),
      liste('probe', [{ id: '1', art: 'stueck', stueckId: 'pomp' }]),
    ],
  };

  it('eine Quelle nimmt ihre virtuellen Stücke mit, samt Lesezeichen, Merkern und Setlisten-Einträgen', () => {
    const f = loeschFolgen(['band'], bestand, 99);
    expect(f.stuecke.sort()).toEqual(['band', 'marsch', 'polka']);
    expect(f.lesezeichen.sort()).toEqual(['lz-band', 'lz-marsch']);
    expect(f.merker.sort()).toEqual(['band:1', 'polka:1']);
    expect(f.virtuelleTitel).toEqual(['Marsch', 'Polka']);
    expect(f.setlistenTitel).toEqual(['Liste konzert']);
    // Die übrigen Einträge bleiben in ihrer Reihenfolge, der Platzhalter auch.
    expect(f.setlisten).toEqual([{ ...bestand.setlisten[0], aktualisiert: 99, geaendert: 99, eintraege: [
      { id: '1', art: 'stueck', stueckId: 'pomp' },
      { id: '3', art: 'platzhalter', titel: 'auswendig' },
      { id: '5', art: 'stueck', stueckId: 'pomp' },
    ] }]);
  });

  it('ein virtuelles Stück zu löschen, lässt die Quelle und die anderen stehen', () => {
    const f = loeschFolgen(['marsch'], bestand, 99);
    expect(f.stuecke).toEqual(['marsch']);
    expect(f.lesezeichen).toEqual(['lz-marsch']);
    expect(f.merker).toEqual([]);
    expect(f.virtuelleTitel).toEqual([]);
    expect(f.setlisten.map((s) => s.eintraege.map((e) => e.id))).toEqual([['1', '3', '4', '5']]);
  });

  it('mehrfache Einträge desselben Stücks verschwinden alle', () => {
    const f = loeschFolgen(['pomp'], bestand, 99);
    expect(f.stuecke.sort()).toEqual(['anders', 'pomp']);
    expect(f.setlistenTitel).toEqual(['Liste konzert', 'Liste probe']);
    expect(f.setlisten[1].eintraege).toEqual([]); // die Setliste selbst bleibt, notfalls leer
  });

  it('nennt ein gewähltes virtuelles Stück nicht noch einmal als mitbetroffen', () => {
    const f = loeschFolgen(['band', 'marsch'], bestand, 99);
    expect(f.stuecke.sort()).toEqual(['band', 'marsch', 'polka']);
    expect(f.virtuelleTitel).toEqual(['Polka']);
  });

  it('ohne Folgen: nichts in Setlisten, keine virtuellen', () => {
    const f = loeschFolgen(['gibtsnicht'], bestand, 99);
    expect(f).toMatchObject({ stuecke: ['gibtsnicht'], lesezeichen: [], merker: [], setlisten: [], virtuelleTitel: [], setlistenTitel: [] });
    expect(loeschHinweis(f)).toBe('');
  });

  it('Setlisten ohne gelöschte Lesezeichen', () => {
    expect(setlistenOhne(bestand.setlisten, new Set(), new Set(['lz-band']), 5).map((s) => s.eintraege.map((e) => e.id))).toEqual([['1', '2', '3', '5']]);
  });

  it('sagt in der Rückfrage, was mit wegfällt', () => {
    expect(loeschHinweis({ virtuelleTitel: ['Marsch', 'Polka'], setlistenTitel: ['Konzert Mai'] })).toBe(
      'Damit fallen auch 2 Stücke daraus weg („Marsch“, „Polka“). Betroffen ist 1 Setliste („Konzert Mai“); die Einträge werden dort entfernt.',
    );
    expect(loeschHinweis({ virtuelleTitel: ['Marsch'], setlistenTitel: ['A', 'B'] })).toBe(
      'Damit fällt auch 1 Stück daraus weg („Marsch“). Betroffen sind 2 Setlisten („A“, „B“); die Einträge werden dort entfernt.',
    );
  });
});
