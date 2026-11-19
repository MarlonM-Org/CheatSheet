import { describe, expect, it } from 'vitest';
import { akkordText, folgeAkkorde, tonartName } from '@/domain/akkorde';
import {
  istJamStueck, JAM_STUECKE, jamAlle, jamAlsEingabe, jamAusEingabe, jamEntfernen, jamLesen, jamNotiert, jamSpeichern, jamStueckeGueltig,
  jamStueckeLesen, teileAusText, teileAlsText, zeilen, entwurfAusText, entwurfAlsText, takteAusText, naechsterTeilName, type JamEingabe, type JamStueck,
} from '@/domain/jamkarte';
import { skillFinden } from '@/domain/skillkatalog';

// Erwartete Taktzahl je Stück — aus der Form.
const TAKTE: Record<string, number> = {
  'blues-b': 12, 'blues-b-einfach': 12, 'blues-f': 12, 'moll-blues-c': 12, 'blue-bossa': 16, 'autumn-leaves': 32, summertime: 16,
  'fly-me-to-the-moon': 32, 'all-the-things-you-are': 36, 'take-the-a-train': 32, 'so-what': 32, 'cantaloupe-island': 16, 'watermelon-man': 16,
};

describe('Mitgelieferte Stücke', () => {
  it('ids eindeutig, alle mit erwarteter Taktzahl', () => {
    expect(new Set(JAM_STUECKE.map((s) => s.id)).size).toBe(JAM_STUECKE.length);
    expect(JAM_STUECKE.map((s) => s.id).sort()).toEqual(Object.keys(TAKTE).sort());
  });
  for (const s of JAM_STUECKE) {
    it(`${s.titel}: lesbar, Takte passen zur Form`, () => {
      const g = jamLesen(s);
      expect(g.fehler).toEqual([]);
      expect(g.tonart, s.tonart).not.toBeNull();
      expect(g.takte).toBe(TAKTE[s.id]);
      // AABA-Formen: Teile zu 8 Takten (All the Things: letzter A-Teil 12).
      if (/^AAB|^ABAB/.test(s.form)) {
        const laengen = g.teile.map((t) => t.folge.takte.length);
        expect(laengen.slice(0, 3)).toEqual([8, 8, 8]);
      }
      if (/Blues/.test(s.form) && /12/.test(s.form)) expect(g.teile[0].folge.takte).toHaveLength(12);
      expect(s.form.length).toBeGreaterThan(0);
      if (s.skill) expect(skillFinden(s.skill), s.skill).toBeDefined();
      // Jedes Stück ist für alle Stimmungen sauber zu schreiben (kein Doppelvorzeichen am Grundton).
      for (const st of ['B', 'Es', 'F', 'C'] as const) {
        for (const t of jamNotiert(g, st).teile) for (const a of folgeAkkorde(t.folge)) expect(Math.abs(a.grund.vz), `${s.id} ${st} ${akkordText(a)}`).toBeLessThan(2);
      }
    });
  }
  it('die Session-Stücke aus der ROADMAP sind dabei', () => {
    const titel = JAM_STUECKE.map((s) => s.titel).join(' ');
    for (const t of ['Blues in B♭', 'Blues in F', 'Blue Bossa', 'Autumn Leaves', 'Summertime', 'Fly Me to the Moon', 'All the Things You Are', 'Take the A Train', 'So What', 'Cantaloupe Island', 'Watermelon Man']) {
      expect(titel).toContain(t);
    }
  });
  it('Stichproben der Changes', () => {
    const takt = (id: string, i: number) => jamLesen(JAM_STUECKE.find((s) => s.id === id)!).teile.flatMap((t) => t.folge.takte)[i].akkorde.map((a) => akkordText(a)).join(' ');
    expect(takt('blues-b', 5)).toBe('E°7');
    expect(takt('blues-f', 5)).toBe('B°7');
    expect(takt('blue-bossa', 8)).toBe('E♭m7');
    expect(takt('blue-bossa', 10)).toBe('D♭maj7');
    expect(takt('autumn-leaves', 0)).toBe('Cm7');
    expect(takt('so-what', 16)).toBe('E♭m7');
    expect(takt('take-the-a-train', 2)).toBe('D7♯11');
    expect(takt('cantaloupe-island', 4)).toBe('D♭7');
    expect(takt('all-the-things-you-are', 31)).toBe('B°7');
  });
  it('notiert für die B-Klarinette', () => {
    const g = jamNotiert(jamLesen(JAM_STUECKE.find((s) => s.id === 'autumn-leaves')!), 'B');
    expect(tonartName(g.tonart!)).toBe('a-Moll');
    expect(g.teile[0].folge.takte.map((t) => akkordText(t.akkorde[0]))).toEqual(['Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Bm7♭5', 'E7♭9', 'Am6', 'Am6']);
    const blues = jamNotiert(jamLesen(JAM_STUECKE.find((s) => s.id === 'blues-b')!), 'B');
    expect(tonartName(blues.tonart!)).toBe('C-Dur');
    expect(akkordText(folgeAkkorde(blues.teile[0].folge)[0])).toBe('C7');
    const es = jamNotiert(jamLesen(JAM_STUECKE.find((s) => s.id === 'blues-f')!), 'Es');
    expect(tonartName(es.tonart!)).toBe('D-Dur');
  });
});

describe('Eigene Stücke', () => {
  const eingabe: JamEingabe = { titel: 'Mein Blues', komponist: '', form: '', tonart: 'G', gefuehl: 'Shuffle', akkorde: '| G7 | C7 | G7 | G7 |\n| C7 | C7 | G7 | G7 |\n| D7 | C7 | G7 | D7 |', notiz: '' };
  it('Formular → Stück (klingend), Form aus der Taktzahl', () => {
    const { stueck, fehler } = jamAusEingabe(eingabe, 'e1', { richtung: 'klingend', stimmung: 'B' });
    expect(fehler).toEqual([]);
    expect(stueck!.teile.map((t) => t.name)).toEqual(['A', 'B', 'C']);
    expect(stueck!.form).toBe('12 Takte');
    expect(stueck!.eigen).toBe(true);
    expect(stueck!.gefuehl).toBe('Shuffle');
    expect(stueck).not.toHaveProperty('komponist');
    expect(istJamStueck(stueck)).toBe(true);
  });
  it('notiert eingegeben → klingend gespeichert', () => {
    const { stueck } = jamAusEingabe({ ...eingabe, tonart: 'A', akkorde: 'A7 D7 E7' }, 'e2', { richtung: 'notiert', stimmung: 'B' });
    expect(stueck!.tonart).toBe('G');
    expect(stueck!.teile[0].akkorde).toBe('| G7 | C7 | D7 |');
  });
  it('Fehler statt Stück', () => {
    expect(jamAusEingabe({ ...eingabe, titel: ' ' }, 'x', { richtung: 'klingend', stimmung: 'B' }).fehler).toContain('Titel fehlt.');
    expect(jamAusEingabe({ ...eingabe, tonart: 'Q' }, 'x', { richtung: 'klingend', stimmung: 'B' }).stueck).toBeNull();
    expect(jamAusEingabe({ ...eingabe, akkorde: '| G7 | Xy |' }, 'x', { richtung: 'klingend', stimmung: 'B' }).fehler).toHaveLength(1);
    expect(jamAusEingabe({ ...eingabe, akkorde: '' }, 'x', { richtung: 'klingend', stimmung: 'B' }).fehler).toContain('Akkorde fehlen.');
  });
  it('Teile mit Namen', () => {
    expect(teileAusText("A: | C | G7 |\nB: | F | C |\nA': | C |")).toEqual([
      { name: 'A', akkorde: '| C | G7 |' }, { name: 'B', akkorde: '| F | C |' }, { name: "A'", akkorde: '| C |' },
    ]);
    expect(teileAusText('C F G7 C')).toEqual([{ name: 'Form', akkorde: 'C F G7 C' }]);
    expect(teileAusText(teileAlsText([{ name: 'A', akkorde: '| C |' }, { name: 'B', akkorde: '| F |' }]))).toEqual([{ name: 'A', akkorde: '| C |' }, { name: 'B', akkorde: '| F |' }]);
  });
  it('Bearbeiten: Stück → Formular → Stück bleibt gleich', () => {
    const { stueck } = jamAusEingabe(eingabe, 'e1', { richtung: 'klingend', stimmung: 'B' });
    const wieder = jamAusEingabe(jamAlsEingabe(stueck!), 'e1', { richtung: 'klingend', stimmung: 'B' }).stueck;
    expect(wieder).toEqual(stueck);
  });
  it('Liste: speichern ersetzt, entfernen, eigene zuerst', () => {
    const s1 = jamAusEingabe(eingabe, 'e1', { richtung: 'klingend', stimmung: 'B' }).stueck!;
    const s2 = { ...s1, id: 'e2', titel: 'Zwei' };
    let liste: JamStueck[] = jamSpeichern([], s1);
    liste = jamSpeichern(liste, s2);
    liste = jamSpeichern(liste, { ...s1, titel: 'Neu' });
    expect(liste.map((s) => s.titel)).toEqual(['Neu', 'Zwei']);
    expect(jamEntfernen(liste, 'e2').map((s) => s.id)).toEqual(['e1']);
    expect(jamAlle(liste).slice(0, 2).map((s) => s.id)).toEqual(['e1', 'e2']);
    expect(jamAlle(liste)).toHaveLength(2 + JAM_STUECKE.length);
  });
  it('Lesen aus dem Speicher: Ungültiges und Doppeltes fällt weg', () => {
    const s1 = jamAusEingabe(eingabe, 'e1', { richtung: 'klingend', stimmung: 'B' }).stueck!;
    expect(jamStueckeLesen([s1, s1, { id: 'kaputt' }, null, 'x'])).toEqual([s1]);
    expect(jamStueckeLesen('quatsch')).toEqual([]);
    expect(jamStueckeGueltig([s1])).toBe(true);
    expect(jamStueckeGueltig([{ ...s1, teile: [] }])).toBe(false);
    expect(jamStueckeGueltig([{ ...s1, titel: 'x'.repeat(500) }])).toBe(false);
  });
  it('Raster: 4 Takte je Zeile', () => {
    expect(zeilen([1, 2, 3, 4, 5, 6])).toEqual([[1, 2, 3, 4], [5, 6]]);
  });
});

describe('Entwurf zum Antippen', () => {
  it('Text → Teile mit Takten → Text', () => {
    const text = 'A: | Cm7 F7 | Bbmaj7 | % |\nB: | Am7b5 | D7 |';
    const e = entwurfAusText(text);
    expect(e).toEqual([
      { name: 'A', takte: [['Cm7', 'F7'], ['Bbmaj7'], ['Bbmaj7']] },
      { name: 'B', takte: [['Am7b5'], ['D7']] },
    ]);
    expect(entwurfAlsText(e)).toBe('A: | Cm7 F7 | Bbmaj7 | Bbmaj7 |\nB: | Am7b5 | D7 |');
    expect(entwurfAusText(entwurfAlsText(e))).toEqual(e);
  });
  it('ohne Taktstriche ist jeder Akkord ein Takt, Unlesbares bleibt stehen', () => {
    expect(takteAusText('E A B7 E')).toEqual([['E'], ['A'], ['B7'], ['E']]);
    expect(takteAusText('| Xyz | C |')).toEqual([['Xyz'], ['C']]);
  });
  it('leerer Teil bleibt als Teil erhalten', () => {
    expect(entwurfAlsText([{ name: 'A', takte: [] }])).toBe('A: ');
    expect(entwurfAusText('A: ')).toEqual([{ name: 'A', takte: [] }]);
  });
  it('nächster Teilname', () => {
    expect(naechsterTeilName([])).toBe('A');
    expect(naechsterTeilName([{ name: 'A', takte: [] }, { name: 'B', takte: [] }])).toBe('C');
    expect(naechsterTeilName([{ name: 'Form', takte: [] }])).toBe('G');
  });
  it('über den Entwurf angelegt wie über den Text', () => {
    const e: JamEingabe = { titel: 'Test', komponist: '', form: '', tonart: 'C', gefuehl: '', notiz: '', akkorde: entwurfAlsText([{ name: 'A', takte: [['C'], ['F7'], ['G7']] }]) };
    const r = jamAusEingabe(e, 'x', { richtung: 'klingend', stimmung: 'B' });
    expect(r.fehler).toEqual([]);
    expect(r.stueck!.teile).toEqual([{ name: 'A', akkorde: '| C | F7 | G7 |' }]);
  });
});
