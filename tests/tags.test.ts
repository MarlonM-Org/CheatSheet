import { describe, expect, it } from 'vitest';
import {
  imTagFilter, mitTag, ohneTag, tagName, tagsLesen, tagsVereinigen, tagsVon, tagUebersicht, VORSCHLAEGE,
  type Tag,
} from '@/domain/tags';

const tag = (id: string, name: string, farbe = 'rot', geaendert = 1) => ({ id, name, farbe, geaendert }) as Tag;

describe('Tags: Definitionen', () => {
  it('Name: geglättet, nicht leer, höchstens 30 Zeichen', () => {
    expect(tagName('  Wichtig   üben ')).toBe('Wichtig üben');
    expect(tagName('  ')).toBeNull();
    expect(tagName('x'.repeat(50))).toHaveLength(30);
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
  });
});

describe('Tags zwischen Geräten (Sicherung)', () => {
  it('neuer gewinnt je Tag, neue kommen dazu, gelöschte bleiben weg', () => {
    const hier = [tag('a', 'Solo alt', 'blau', 5), tag('b', 'Kann ich', 'gruen', 9), tag('weg', 'Hier gelöscht?', 'grau', 1)];
    const dort = [tag('a', 'Mein Solo', 'blau', 8), tag('b', 'Kann ich (alt)', 'gruen', 2), tag('c', 'Wichtig', 'rot', 3), tag('tot', 'Dort gelöscht', 'grau', 1)];
    const grabsteine = [{ art: 'tag' as const, id: 'weg', am: 4 }, { art: 'tag' as const, id: 'tot', am: 4 }, { art: 'noten' as const, id: 'c', am: 99 }];
    expect(tagsVereinigen(hier, dort, grabsteine)).toEqual([tag('a', 'Mein Solo', 'blau', 8), tag('b', 'Kann ich', 'gruen', 9), tag('c', 'Wichtig', 'rot', 3)]);
  });
  it('später wieder angelegt (neuer als der Grabstein): bleibt', () => {
    expect(tagsVereinigen([], [tag('a', 'Neu', 'rot', 10)], [{ art: 'tag', id: 'a', am: 4 }])).toEqual([tag('a', 'Neu', 'rot', 10)]);
  });
});
