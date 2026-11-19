import { describe, expect, it } from 'vitest';
import {
  aufnahmeLesen, aufnahmeNameAufbereiten, aufnahmenStand, bereichTitel, dauerText, imBereich, nachTagen, neueAufnahmeVorwahl, stueckeMitAufnahmen,
  tagebuch, tagebuchBereich, tagebuchFiltern, tagTitel, umschaltZeit, vergleichbar, vergleichsPaar, vergleichsPartner, wo, zuletztKurz,
} from '@/domain/aufnahmetagebuch';

const auf = (id: string, am: number, extra: Record<string, unknown> = {}) => ({ id, am, dauer: 10, typ: 'audio/mp4', ...extra });
const tag = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();

const stuecke = [
  { id: 'pomp', titel: 'Pomp', aufnahmen: [auf('p1', tag(10)), auf('p2', tag(14), { stelleId: 's1' }), auf('p3', tag(16, 9), { stelleId: 's1', titel: 'Gut' })] },
  { id: 'blues', titel: 'Blues in B', aufnahmen: [auf('b1', tag(16, 10), { skillId: 'blues-b' }), { kaputt: true }] },
  { id: 'leer', titel: 'Leer' },
] as never[];
const stellen = [{ id: 's1', titel: 'T. 32–48', seite: 2 }, { id: 's2', titel: '', seite: 3 }];

describe('Aufnahmen prüfen', () => {
  it('braucht id, Zeitpunkt, Dauer und Typ', () => {
    expect(aufnahmeLesen(auf('a', 1))).toEqual(auf('a', 1));
    for (const x of [null, 1, {}, { id: 'a', am: 1, dauer: -1, typ: 'x' }, { id: 'a', am: 'gestern', dauer: 1, typ: 'x' }, { id: 1, am: 1, dauer: 1, typ: 'x' }]) {
      expect(aufnahmeLesen(x)).toBeNull();
    }
  });
});

describe('Tagebuch: alle Aufnahmen über alle Stücke', () => {
  const t = tagebuch(stuecke, stellen);
  it('neueste zuerst, Unbrauchbares übergangen', () => {
    expect(t.map((e) => e.aufnahme.id)).toEqual(['b1', 'p3', 'p2', 'p1']);
  });
  it('mit Stück, Stelle und Skill', () => {
    expect(t[1]).toMatchObject({ stueckId: 'pomp', stueckTitel: 'Pomp', stelleId: 's1', stelleTitel: 'T. 32–48' });
    expect(t[0]).toMatchObject({ stueckId: 'blues', skillId: 'blues-b' });
  });
  it('„wo“: Stelle, sonst Seite, sonst nichts; eine Stelle ohne Titel nennt ihre Seite', () => {
    expect(wo(t[1])).toBe('Stelle „T. 32–48“');
    expect(wo(tagebuch([{ id: 'x', titel: 'X', aufnahmen: [auf('a', 1, { stelleId: 's2' })] }] as never[], stellen)[0])).toBe('Stelle auf Seite 3');
    expect(wo(tagebuch([{ id: 'x', titel: 'X', aufnahmen: [auf('a', 1, { seite: 4 })] }] as never[], stellen)[0])).toBe('Seite 4');
    expect(wo(t[0])).toBe('');
  });
  it('eine gelöschte Stelle: die Aufnahme bleibt, nur ohne Stellen-Namen', () => {
    const [e] = tagebuch([{ id: 'x', titel: 'X', aufnahmen: [auf('a', 1, { stelleId: 'weg', seite: 2 })] }] as never[], []);
    expect(e.stelleTitel).toBeUndefined();
    expect(wo(e)).toBe('Seite 2');
  });
  it('filtert nach Stück', () => {
    expect(tagebuchFiltern(t, 'pomp').map((e) => e.aufnahme.id)).toEqual(['p3', 'p2', 'p1']);
    expect(tagebuchFiltern(t, null)).toBe(t);
  });
  it('Stücke zum Filtern: nur mit Aufnahmen, nach Titel, mit Anzahl', () => {
    expect(stueckeMitAufnahmen(t)).toEqual([{ id: 'blues', titel: 'Blues in B', anzahl: 1 }, { id: 'pomp', titel: 'Pomp', anzahl: 3 }]);
  });
  it('nach Tagen gruppiert, Reihenfolge bleibt', () => {
    const g = nachTagen(t, tag(16, 18));
    expect(g.map((x) => [x.titel, x.eintraege.map((e) => e.aufnahme.id)])).toEqual([
      ['Heute', ['b1', 'p3']], [tagTitel(tag(14), tag(16, 18)), ['p2']], [tagTitel(tag(10), tag(16, 18)), ['p1']],
    ]);
  });
  it('Tagestitel: Heute, Gestern, sonst Datum', () => {
    expect(tagTitel(tag(16, 1), tag(16, 23))).toBe('Heute');
    expect(tagTitel(tag(15, 23), tag(16, 1))).toBe('Gestern');
    expect(tagTitel(tag(3), tag(16))).toMatch(/3\./);
  });
});

describe('Vergleichen: alt gegen neu', () => {
  const t = tagebuch(stuecke, stellen);
  const e = (id: string) => t.find((x) => x.aufnahme.id === id)!;
  it('vergleichbar sind Aufnahmen desselben Stücks an derselben Stelle (oder beide ohne Stelle)', () => {
    expect(vergleichbar(e('p2'), e('p3'))).toBe(true);
    expect(vergleichbar(e('p1'), e('p2'))).toBe(false);
    expect(vergleichbar(e('p1'), e('b1'))).toBe(false);
    expect(vergleichbar(e('p2'), e('p2'))).toBe(false);
  });
  it('Partner: die passenden anderen, älteste zuerst', () => {
    const viele = tagebuch([{ id: 'x', titel: 'X', aufnahmen: [auf('a', 3), auf('b', 1), auf('c', 2), auf('d', 4, { stelleId: 's1' })] }] as never[], []);
    expect(vergleichsPartner(viele, 'a').map((x) => x.aufnahme.id)).toEqual(['b', 'c']);
    expect(vergleichsPartner(viele, 'd')).toEqual([]);
    expect(vergleichsPartner(viele, 'gibtsnicht')).toEqual([]);
  });
  it('Paar: A ist die ältere, B die neuere — egal in welcher Reihenfolge gewählt', () => {
    expect(vergleichsPaar(t, 'p3', 'p2')).toEqual({ a: e('p2'), b: e('p3') });
    expect(vergleichsPaar(t, 'p2', 'p3')).toEqual({ a: e('p2'), b: e('p3') });
    expect(vergleichsPaar(t, 'p1', 'p3')).toBeNull();
  });
  it('Umschalten setzt an derselben Stelle fort, höchstens bis kurz vor das Ende', () => {
    expect(umschaltZeit(5, 20)).toBe(5);
    expect(umschaltZeit(30, 20)).toBeCloseTo(19.75);
    expect(umschaltZeit(-1, 20)).toBe(0);
    expect(umschaltZeit(5, Number.NaN)).toBe(5);
  });
});

describe('Namen und Dauer', () => {
  it('Namen: getrimmt, Leerraum zusammengefasst, höchstens 80 Zeichen', () => {
    expect(aufnahmeNameAufbereiten('  Gut   gelaufen \n')).toBe('Gut gelaufen');
    expect(aufnahmeNameAufbereiten('x'.repeat(100))).toHaveLength(80);
  });
  it('Dauer als m:ss', () => {
    expect(dauerText(0)).toBe('0:00');
    expect(dauerText(65.4)).toBe('1:05');
    expect(dauerText(3600)).toBe('60:00');
  });
});

// Aufnahmen über die Bibliothek (Rückmeldung Marlon 2026-11-19): Die Zeile
// „Aufnahmen“ und das Tagebuch grenzen auf das ein, was die Bibliothek zeigt
// (Sammlung und Tag); „Alle“ zeigt den Rest — auch Aufnahmen mit Skill, deren
// Stück woanders liegt.
describe('Bereich der Bibliothek', () => {
  const bib = [
    { id: 'pomp', titel: 'Pomp', sammlungen: ['Märsche'], tags: ['t1'], aufnahmen: [auf('p1', tag(10)), auf('p2', tag(14))] },
    { id: 'alte', titel: 'Alte Kameraden', sammlungen: ['märsche'], aufnahmen: [auf('a1', tag(12))] },
    { id: 'blues', titel: 'Blues in B', sammlungen: ['Jazz'], aufnahmen: [auf('b1', tag(16, 10), { skillId: 'blues-b' }), auf('b2', tag(15))] },
    { id: 'skala', titel: 'Tonleitern', aufnahmen: [auf('s1', tag(16, 11), { skillId: 'tonleitern' })] },
    { id: 'leer', titel: 'Leer', sammlungen: ['Märsche'] },
  ] as never[];
  const alle = tagebuch(bib, []);
  const ids = (l: { aufnahme: { id: string } }[]) => l.map((e) => e.aufnahme.id);

  it('im Bereich: Sammlung (Groß/klein egal) und Tag zugleich; ohne beides alles', () => {
    expect(imBereich(bib[0], { sammlung: 'MÄRSCHE', tag: null })).toBe(true);
    expect(imBereich(bib[1], { sammlung: 'Märsche', tag: 't1' })).toBe(false);
    expect(imBereich(bib[0], { sammlung: 'Märsche', tag: 't1' })).toBe(true);
    expect(imBereich(bib[3], { sammlung: null, tag: null })).toBe(true);
    expect(imBereich(undefined, { sammlung: null, tag: null })).toBe(false);
  });
  it('drin und draußen, neueste zuerst; draußen zählt die mit Skill eigens', () => {
    const b = tagebuchBereich(alle, bib, { sammlung: 'Märsche', tag: null });
    expect(ids(b.drin)).toEqual(['p2', 'a1', 'p1']);
    expect(b.draussen).toBe(3);
    expect(b.draussenSkill).toBe(2);
    const t = tagebuchBereich(alle, bib, { sammlung: 'Märsche', tag: 't1' });
    expect(ids(t.drin)).toEqual(['p2', 'p1']);
    expect(t.draussen).toBe(4);
  });
  it('ohne Eingrenzung ist alles drin', () => {
    const b = tagebuchBereich(alle, bib, { sammlung: null, tag: null });
    expect(b.drin).toBe(alle);
    expect(b).toMatchObject({ draussen: 0, draussenSkill: 0 });
  });
  it('ein Stück, das es nicht mehr gibt, liegt draußen', () => {
    expect(tagebuchBereich(alle, bib.slice(1), { sammlung: 'Märsche', tag: null }).drin.map((e) => e.stueckId)).toEqual(['alte']);
  });
  it('Titel des Bereichs: Sammlung und Tag-Name, wie beim Stellen-Mix', () => {
    expect(bereichTitel('Märsche', 'Wichtig')).toBe('Märsche · Wichtig');
    expect(bereichTitel(null, 'Wichtig')).toBe('Wichtig');
    expect(bereichTitel(null, null)).toBeNull();
  });
});

describe('Zeile „Aufnahmen“ in der Bibliothek', () => {
  const jetzt = tag(16, 18);
  it('zuletzt: heute, gestern, sonst Tag und Monat (Jahr nur, wenn es ein anderes ist)', () => {
    expect(zuletztKurz(tag(16, 8), jetzt)).toBe('heute');
    expect(zuletztKurz(tag(15, 23), jetzt)).toBe('gestern');
    expect(zuletztKurz(tag(3), jetzt)).toMatch(/^3\. Nov/);
    expect(zuletztKurz(new Date(2025, 10, 3).getTime(), jetzt)).toMatch(/2025$/);
  });
  it('Zahl im Bereich und wann zuletzt', () => {
    expect(aufnahmenStand(4, 9, tag(16, 8), jetzt, 'Märsche')).toBe('4 · zuletzt heute');
    expect(aufnahmenStand(1, 1, tag(15), jetzt, null)).toBe('1 · zuletzt gestern');
  });
  it('leer: noch keine auf dem Gerät, sonst keine in der Auswahl', () => {
    expect(aufnahmenStand(0, 0, null, jetzt, 'Märsche')).toBe('noch keine');
    expect(aufnahmenStand(0, 5, null, jetzt, 'Märsche · Wichtig')).toBe('keine in „Märsche · Wichtig“');
    expect(aufnahmenStand(0, 5, null, jetzt, null)).toBe('noch keine');
  });
});

describe('„Neue Aufnahme“: welches Stück vorgewählt ist', () => {
  const st = [{ id: 'b', titel: 'B', stimme: '' }, { id: 'a', titel: 'A', stimme: '' }, { id: 'c', titel: 'C', stimme: '' }];
  it('der Filter im Tagebuch (ausdrücklich gewählt), sonst das offene Stück, sonst das der neuesten Aufnahme, sonst A–Z das erste', () => {
    expect(neueAufnahmeVorwahl(st, { filter: 'c', offen: 'b', neueste: 'a' })).toBe('c');
    expect(neueAufnahmeVorwahl(st, { filter: null, offen: 'b', neueste: 'c' })).toBe('b');
    expect(neueAufnahmeVorwahl(st, { filter: null, offen: null, neueste: 'c' })).toBe('c');
    expect(neueAufnahmeVorwahl(st, { filter: null, offen: null, neueste: null })).toBe('a');
  });
  it('was es nicht (mehr) gibt, wird übersprungen; ohne Stücke keins', () => {
    expect(neueAufnahmeVorwahl(st, { filter: 'weg', offen: 'auch-weg', neueste: 'b' })).toBe('b');
    expect(neueAufnahmeVorwahl([], { filter: 'a', offen: 'a', neueste: 'a' })).toBeNull();
  });
});
