import { describe, expect, it } from 'vitest';
import {
  doppelteNamen, imTagFilter, mitTag, ohneTag, tagMitNamen, tagName, tagSchluessel, tagsAbgleichen, tagsLesen, tagsUmschreiben,
  tagsVon, tagUebersicht, VORSCHLAEGE, type Tag,
} from '@/domain/tags';
import type { Grabstein } from '@/domain/einspielen';

const tag = (id: string, name: string, farbe = 'rot', geaendert = 1, auch?: string[]) => ({ id, name, farbe, geaendert, ...(auch ? { auch } : {}) }) as Tag;
const grab = (id: string, am: number): Grabstein => ({ art: 'tag', id, am });
// Stücke mit Tags: je id so viele Stücke wie angegeben.
const stuecke = (je: Record<string, number>) => Object.entries(je).flatMap(([id, n]) => Array.from({ length: n }, () => ({ tags: [id] })));
const vereinigen = (hier: Tag[], dort: Tag[], grabsteine: Grabstein[] = []) => tagsAbgleichen(hier, dort, grabsteine).tags;

describe('Tags: Definitionen', () => {
  it('Name: geglättet, nicht leer, höchstens 30 Zeichen', () => {
    expect(tagName('  Wichtig   üben ')).toBe('Wichtig üben');
    expect(tagName('  ')).toBeNull();
    expect(tagName('x'.repeat(50))).toHaveLength(30);
  });
  it('liest auch die weiteren ids (auch): nur Texte, ohne die eigene, jede einmal', () => {
    expect(tagsLesen([{ ...tag('a', 'Solo'), auch: ['b', 'a', 3, 'b', ''] }, { ...tag('c', 'X'), auch: 'kaputt' }])).toEqual([tag('a', 'Solo', 'rot', 1, ['b']), tag('c', 'X')]);
  });
  it('liest nur stimmige Tags; unbekannte Farbe wird grau, doppelte ids einmal', () => {
    expect(tagsLesen([tag('a', 'Solo', 'blau'), tag('b', 'X', 'neon'), { id: 'c' }, tag('a', 'doppelt'), null])).toEqual([
      tag('a', 'Solo', 'blau'), tag('b', 'X', 'grau'),
    ]);
    expect(tagsLesen('kaputt')).toEqual([]);
  });
  it('Vorschläge: Wichtig üben (rot), Mein Solo (blau), Wenige Stellen (gelb), Kann ich (grün)', () => {
    expect(VORSCHLAEGE.map((v) => `${v.name}:${v.farbe}`)).toEqual(['Wichtig üben:rot', 'Mein Solo:blau', 'Wenige Stellen:gelb', 'Kann ich:gruen']);
  });
});

describe('Tags an Stücken', () => {
  const tags = [tag('rot', 'Wichtig üben'), tag('blau', 'Solo', 'blau')];
  it('nur ids, die es (noch) gibt; ohne Liste alle', () => {
    expect(tagsVon({ tags: ['rot', 'weg', 3] }, tags)).toEqual(['rot']);
    expect(tagsVon({ tags: ['rot', 'weg'] })).toEqual(['rot', 'weg']);
    expect(tagsVon({})).toEqual([]);
  });
  it('setzen und entfernen ohne Doppel', () => {
    expect(mitTag(['rot'], 'rot')).toEqual(['rot']);
    expect(mitTag(['rot'], 'blau')).toEqual(['rot', 'blau']);
    expect(ohneTag(['rot', 'blau'], 'rot')).toEqual(['blau']);
  });
  it('Filter und Übersicht in der Reihenfolge der Tags', () => {
    expect(imTagFilter({ tags: ['rot'] }, null)).toBe(true);
    expect(imTagFilter({ tags: ['rot'] }, 'blau')).toBe(false);
    expect(tagUebersicht(tags, [{ tags: ['blau', 'rot'] }, { tags: ['rot'] }, {}])).toEqual([
      { tag: tags[0], anzahl: 2 }, { tag: tags[1], anzahl: 1 },
    ]);
    // In einer Sammlung nur die Tags, die dort vorkommen (F-20); unter „Alle“ bleiben alle.
    expect(tagUebersicht(tags, [{ tags: ['rot'] }], true)).toEqual([{ tag: tags[0], anzahl: 1 }]);
    expect(tagUebersicht(tags, [{}], false).map((x) => x.anzahl)).toEqual([0, 0]);
  });
});

describe('Tags zwischen Geräten (Sicherung)', () => {
  it('neuer gewinnt je Tag, neue kommen dazu, gelöschte bleiben weg', () => {
    const hier = [tag('a', 'Solo alt', 'blau', 5), tag('b', 'Kann ich', 'gruen', 9), tag('weg', 'Hier gelöscht?', 'grau', 1)];
    const dort = [tag('a', 'Mein Solo', 'blau', 8), tag('b', 'Kann ich (alt)', 'gruen', 2), tag('c', 'Wichtig', 'rot', 3), tag('tot', 'Dort gelöscht', 'grau', 1)];
    const grabsteine = [{ art: 'tag' as const, id: 'weg', am: 4 }, { art: 'tag' as const, id: 'tot', am: 4 }, { art: 'noten' as const, id: 'c', am: 99 }];
    expect(vereinigen(hier, dort, grabsteine)).toEqual([tag('a', 'Mein Solo', 'blau', 8), tag('b', 'Kann ich', 'gruen', 9), tag('c', 'Wichtig', 'rot', 3)]);
  });
  it('später wieder angelegt (neuer als der Grabstein): bleibt', () => {
    expect(vereinigen([], [tag('a', 'Neu', 'rot', 10)], [grab('a', 4)])).toEqual([tag('a', 'Neu', 'rot', 10)]);
  });
  it('alte Sicherung ohne Tags: alles bleibt, wie es ist', () => {
    const hier = [tag('a', 'Solo', 'blau', 5)];
    expect(tagsAbgleichen(hier, [], [])).toEqual({ tags: hier, tabelle: {}, grabsteine: [] });
  });
});

describe('Gleichnamige Tags sind EIN Tag', () => {
  it('Name vergleichen: Groß/klein egal, Leerraum getrimmt und zusammengefasst', () => {
    expect(tagSchluessel('  Wichtig   ÜBEN ')).toBe(tagSchluessel('wichtig üben'));
    expect(tagSchluessel('Wichtig üben')).not.toBe(tagSchluessel('Wichtig uben'));
  });
  it('Tag mit diesem Namen finden — beim Umbenennen ohne den Tag selbst', () => {
    const tags = [tag('a', 'Wichtig üben'), tag('b', 'Kann ich')];
    expect(tagMitNamen(tags, ' wichtig  Üben')).toEqual(tags[0]);
    expect(tagMitNamen(tags, 'Neu')).toBeUndefined();
    expect(tagMitNamen(tags, 'WICHTIG üben', 'a')).toBeUndefined();
    expect(tagMitNamen(tags, 'kann ich', 'a')).toEqual(tags[1]);
  });
  it('Doppelte auf dem Gerät erkennen (je Name einmal genannt)', () => {
    expect(doppelteNamen([tag('a', 'Wichtig üben'), tag('b', 'Solo'), tag('c', 'wichtig üben'), tag('d', 'WICHTIG ÜBEN')])).toEqual(['Wichtig üben']);
    expect(doppelteNamen([tag('a', 'Wichtig üben'), tag('b', 'Solo')])).toEqual([]);
  });
  it('ids einer Liste umschreiben, ohne Doppel', () => {
    expect(tagsUmschreiben(['d1', 'h1', 'x', 'd2'], { d1: 'h1', d2: 'h1' })).toEqual(['h1', 'x']);
    expect(tagsUmschreiben(['x'], {})).toEqual(['x']);
  });

  describe('zwei Geräte legen denselben Tag getrennt an', () => {
    const A = [tag('a1', 'Wichtig üben', 'rot', 10), tag('a2', 'Mein Solo', 'blau', 10)];
    const B = [tag('b1', 'Wichtig üben', 'rot', 20), tag('b2', 'Mein Solo', 'blau', 20)];
    it('B lädt A: B behält seine ids, kennt As ids als „auch“, Tabelle dort → hier', () => {
      const r = tagsAbgleichen(B, A, []);
      expect(r.tags).toEqual([tag('b1', 'Wichtig üben', 'rot', 20, ['a1']), tag('b2', 'Mein Solo', 'blau', 20, ['a2'])]);
      expect(r.tabelle).toEqual({ a1: 'b1', a2: 'b2' });
    });
    it('und zurück: A behält seine ids', () => {
      const b = tagsAbgleichen(B, A, []).tags;
      const r = tagsAbgleichen(A, b, []);
      expect(r.tags.map((t) => t.id)).toEqual(['a1', 'a2']);
      expect(r.tabelle).toEqual({ b1: 'a1', b2: 'a2' });
      expect(r.tags[0].auch).toEqual(['b1']);
    });
    it('Name und Farbe vom neueren Stand, die id bleibt die hiesige', () => {
      const dort = [tag('d1', 'wichtig ÜBEN', 'orange', 30)];
      expect(vereinigen([tag('h1', 'Wichtig üben', 'rot', 5)], dort)).toEqual([tag('h1', 'wichtig ÜBEN', 'orange', 30, ['d1'])]);
      expect(vereinigen([tag('h1', 'Wichtig üben', 'rot', 50)], dort)).toEqual([tag('h1', 'Wichtig üben', 'rot', 50, ['d1'])]);
    });
    it('Reihenfolge: hiesige an ihrem Platz, neue hinten', () => {
      const r = vereinigen([tag('h1', 'Solo'), tag('h2', 'Kann ich')], [tag('d9', 'Neu'), tag('d2', 'kann ich')]);
      expect(r.map((t) => t.id)).toEqual(['h1', 'h2', 'd9']);
    });
  });

  it('umbenannt auf dem anderen Gerät: über „auch“ erkannt, der neue Name gilt', () => {
    const r = tagsAbgleichen([tag('b1', 'Wichtig üben', 'rot', 5, ['a1'])], [tag('a1', 'Dringend', 'rot', 9, ['b1'])], []);
    expect(r.tags).toEqual([tag('b1', 'Dringend', 'rot', 9, ['a1'])]);
    expect(r.tabelle).toEqual({ a1: 'b1' });
  });
  it('ein veralteter Name zählt nicht: hier umbenannt, dort noch der alte', () => {
    const r = tagsAbgleichen([tag('b1', 'Solo', 'blau', 5, ['a1']), tag('b3', 'Wichtig', 'rot', 6)], [tag('a1', 'Wichtig', 'blau', 3)], []);
    expect(r.tags).toEqual([tag('b1', 'Solo', 'blau', 5, ['a1']), tag('b3', 'Wichtig', 'rot', 6)]);
    expect(r.tabelle).toEqual({ a1: 'b1' });
  });
  it('umbenannt in einen Namen, den es hier schon gibt: wird eins', () => {
    const hier = [tag('b1', 'Wichtig', 'rot', 5, ['a1']), tag('b2', 'Dringend', 'gelb', 6)];
    const r = tagsAbgleichen(hier, [tag('a1', 'Dringend', 'rot', 9)], [], { hier: stuecke({ b1: 1, b2: 2 }) });
    expect(r.tags).toEqual([tag('b2', 'Dringend', 'rot', 9, ['a1', 'b1'])]);
    expect(r.tabelle).toEqual({ a1: 'b2', b1: 'b2' });
  });

  describe('Doppelte schon auf dem Gerät', () => {
    it('es bleibt die id mit den meisten Stücken; Name und Farbe vom neuesten Stand', () => {
      const hier = [tag('h1', 'Wichtig üben', 'rot', 5), tag('h2', 'Solo', 'blau', 1), tag('h3', 'wichtig üben', 'orange', 7)];
      const r = tagsAbgleichen(hier, [], [], { hier: stuecke({ h1: 1, h3: 3 }) });
      expect(r.tags).toEqual([tag('h3', 'wichtig üben', 'orange', 7, ['h1']), tag('h2', 'Solo', 'blau', 1)]);
      expect(r.tabelle).toEqual({ h1: 'h3' });
    });
    it('Gleichstand: die kleinere id', () => {
      const r = tagsAbgleichen([tag('z', 'Solo', 'blau', 5), tag('m', 'solo', 'blau', 3)], [], [], { hier: stuecke({ z: 1, m: 1 }) });
      expect(r.tags).toEqual([tag('m', 'Solo', 'blau', 5, ['z'])]);
      expect(r.tabelle).toEqual({ z: 'm' });
    });
    it('beim Laden: hiesige Doppelte und der Tag aus der Sicherung werden eins', () => {
      const hier = [tag('h1', 'Wichtig üben', 'rot', 5), tag('h2', 'Wichtig üben', 'rot', 6)];
      const r = tagsAbgleichen(hier, [tag('d1', 'Wichtig üben', 'rot', 4)], [], { hier: stuecke({ h2: 2, h1: 1 }), dort: stuecke({ d1: 9 }) });
      expect(r.tags).toEqual([tag('h2', 'Wichtig üben', 'rot', 6, ['d1', 'h1'])]);
      expect(r.tabelle).toEqual({ h1: 'h2', d1: 'h2' });
    });
    it('Doppelte nur in der Sicherung: die id mit den meisten Stücken dort', () => {
      const r = tagsAbgleichen([], [tag('d1', 'Neu', 'gelb', 2), tag('d2', 'neu', 'gelb', 1)], [], { dort: stuecke({ d2: 2, d1: 1 }) });
      expect(r.tags).toEqual([tag('d2', 'Neu', 'gelb', 2, ['d1'])]);
      expect(r.tabelle).toEqual({ d1: 'd2' });
    });
  });

  describe('Grabsteine', () => {
    it('Grabstein unter der anderen id (auch) neuer als der Tag: weg, und der Grabstein gilt dann auch für die hiesige id', () => {
      const r = tagsAbgleichen([tag('b1', 'Wichtig', 'rot', 5, ['a1']), tag('b2', 'Solo')], [], [grab('a1', 8)]);
      expect(r.tags).toEqual([tag('b2', 'Solo')]);
      expect(r.grabsteine).toEqual([grab('b1', 8)]);
    });
    it('Tag seitdem geändert (neuer als der Grabstein): bleibt', () => {
      const r = tagsAbgleichen([tag('b1', 'Wichtig', 'rot', 12, ['a1'])], [tag('a1', 'Wichtig', 'rot', 3)], [grab('a1', 8)]);
      expect(r.tags).toEqual([tag('b1', 'Wichtig', 'rot', 12, ['a1'])]);
      expect(r.grabsteine).toEqual([]);
    });
    it('hier gelöscht, dort noch da — ein hier neu angelegter gleichnamiger Tag bleibt', () => {
      const r = tagsAbgleichen([tag('b1', 'Wichtig', 'rot', 5)], [tag('a1', 'Wichtig', 'rot', 3)], [grab('a1', 4)]);
      expect(r.tags).toEqual([tag('b1', 'Wichtig', 'rot', 5)]);
      expect(r.tabelle).toEqual({});
    });
  });
});
