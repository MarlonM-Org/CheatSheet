import { describe, expect, it } from 'vitest';
import { folgeLesen } from '@/domain/akkorde';
import { akkordeNachfuehren, akkordeVersetzen, beispielAbc, jamRahmen, jamTakteNotiert, linieAlsTakte, notationsTonart, rahmenTakte, taktAkkordeSetzen } from '@/domain/akkordrahmen';
import { beispielLinie } from '@/domain/begleitung';
import { JAM_STUECKE } from '@/domain/jamkarte';
import { abcLesen, akkordAnNoten, alsAbcStimmen, tonartFinden, vorzugAusAkkorden, type Raster, type Stimme } from '@/domain/notation';
import { BLATT, inAllen, inStimme, taktEinfuegen, taktLoeschen, taktStimmt } from '@/domain/notensatz';
import { takteEinsetzen } from '@/domain/taktaufnahme';

const blatt: Raster = { bpm: 120, zaehler: 4, nenner: 4, feinheit: BLATT };
const stueck = (id: string) => JAM_STUECKE.find((s) => s.id === id)!;

describe('Rahmen aus der Jam-Karte', () => {
  it('Blues in B♭ für die B-Klarinette: notiert in C, zwölf Takte, Swing', () => {
    const r = jamRahmen(stueck('blues-b'), 'B');
    expect(r.akkorde).toHaveLength(12);
    expect(r.akkorde[0]).toEqual(['C7']);
    expect(r.akkorde[3]).toEqual(['Gm7', 'C7']);
    expect(r.tonart?.abc).toBe('C');
    expect(r.begleitung).toBe('swing');
  });
  it('Blue Bossa klingend (C): c-Moll, Bossa, 16 Takte über beide Teile', () => {
    const r = jamRahmen(stueck('blue-bossa'), 'C');
    expect(r.akkorde).toHaveLength(16);
    expect(r.tonart?.abc).toBe('Cm');
    expect(r.begleitung).toBe('bossa');
    expect(jamTakteNotiert(stueck('blue-bossa'), 'C')).toHaveLength(16);
  });
  it('Tonart ohne Eintrag im Blatt: keine', () => {
    expect(notationsTonart({ grund: { stamm: 3, vz: 1 }, moll: false })).toBeNull(); // Fis-Dur
    expect(notationsTonart(null)).toBeNull();
  });
});

describe('Leere Takte zum Rahmen', () => {
  it('ein Akkord: ganze Pause, zwei: zwei halbe — jeder Takt stimmt', () => {
    const t = rahmenTakte([['C7'], ['Gm7', 'C7'], ['Dm7', 'G7', 'C', 'A7']], blatt);
    expect(t[0].noten.map((n) => [n.midi, n.dauer])).toEqual([[null, 96]]);
    expect(t[1].noten.map((n) => [n.midi, n.dauer])).toEqual([[null, 48], [null, 48]]);
    expect(t[2].noten.map((n) => n.dauer)).toEqual([24, 24, 24, 24]);
    for (const x of t) expect(taktStimmt(x, blatt)).toBe(true);
  });
  it('die Symbole stehen über ihrem Schlag', () => {
    const t = rahmenTakte([['Gm7', 'C7']], blatt);
    expect([...akkordAnNoten(t[0], ['Gm7', 'C7'], blatt)]).toEqual([[0, ['Gm7']], [1, ['C7']]]);
  });
});

describe('ABC mit Akkorden', () => {
  const akkorde = [['C7'], ['Gm7', 'C7'], ['F#dim7'], ['Dm7b5', 'G7alt']];
  const stimmen: Stimme[] = [{ name: '', schluessel: 'violin', takte: rahmenTakte(akkorde, blatt) }];
  it('schreibt die Symbole an die Noten, ° als o', () => {
    const text = alsAbcStimmen(stimmen, blatt, { titel: 'Blues', begleitung: 'swing' }, tonartFinden('C'), akkorde);
    expect(text).toContain('"C7"z96');
    expect(text).toContain('"Gm7"z48 "C7"z48');
    expect(text).toContain('"F#o7"z96');
    expect(text).toContain('% begleitung: swing');
  });
  it('liest Akkorde und Stil zurück, die Noten bleiben', () => {
    const text = alsAbcStimmen(stimmen, blatt, { titel: 'Blues', begleitung: 'bossa' }, tonartFinden('C'), akkorde);
    const g = abcLesen(text)!;
    expect(g.akkorde).toEqual([['C7'], ['Gm7', 'C7'], ['F#dim7'], ['Dm7b5', 'G7alt']]);
    expect(g.begleitung).toBe('bossa');
    expect(g.stimmen[0].takte).toEqual(stimmen[0].takte);
  });
  it('ohne Akkorde wie bisher', () => {
    const text = alsAbcStimmen(stimmen, blatt, { titel: 'X' }, null);
    expect(text).not.toContain('"');
    expect(text).not.toContain('begleitung');
    expect(abcLesen(text)!.akkorde).toEqual([]);
  });
  it('mehrstimmig: Akkorde nur über der ersten Stimme', () => {
    const zwei: Stimme[] = [stimmen[0], { name: 'Bass', schluessel: 'bass', takte: rahmenTakte([[], [], [], []], blatt) }];
    const text = alsAbcStimmen(zwei, blatt, { titel: 'X' }, null, akkorde);
    const [, v2] = text.split('V:2\n');
    expect(v2).not.toContain('"');
    expect(abcLesen(text)!.akkorde[1]).toEqual(['Gm7', 'C7']);
  });
  it('Akkordwechsel mitten in einer Note: an die nächste Note danach, gibt es keine, an die klingende', () => {
    const takt = { noten: [{ midi: 60, dauer: 72 }, { midi: 62, dauer: 24 }] };
    expect([...akkordAnNoten(takt, ['C', 'F'], blatt)]).toEqual([[0, ['C']], [1, ['F']]]);
    const ganz = { noten: [{ midi: 60, dauer: 96 }] };
    expect([...akkordAnNoten(ganz, ['C', 'F'], blatt)]).toEqual([[0, ['C', 'F']]]);
    const takt2 = { noten: [{ midi: 60, dauer: 24 }, { midi: 62, dauer: 24 }, { midi: 64, dauer: 48 }] };
    expect([...akkordAnNoten(takt2, ['C', 'F'], blatt)]).toEqual([[0, ['C']], [2, ['F']]]);
  });
  it('Triole und Bogen: Symbol nach der Klammer, Rücklesen klappt', () => {
    const takt = { noten: [
      { midi: 60, dauer: 8, triole: true as const, gruppe: 3 }, { midi: 62, dauer: 8, triole: true as const }, { midi: 64, dauer: 8, triole: true as const },
      { midi: 65, dauer: 24, bogenAuf: true as const }, { midi: 67, dauer: 48, bogenZu: true as const },
    ] };
    const text = alsAbcStimmen([{ name: '', schluessel: 'violin', takte: [takt] }], blatt, { titel: 'X' }, null, [['C', 'G7']]);
    expect(text).toContain('(3:2:3"C"');
    expect(text).toContain('"G7"');
    const g = abcLesen(text)!;
    expect(g.akkorde).toEqual([['C', 'G7']]);
    expect(g.stimmen[0].takte[0].noten.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67]);
  });
});

describe('Akkorde nachführen', () => {
  const akkorde = [['A'], ['B'], ['C'], ['D']];
  const s0: Stimme[] = [
    { name: '', schluessel: 'violin', takte: rahmenTakte(akkorde, blatt) },
    { name: 'Bass', schluessel: 'bass', takte: rahmenTakte(akkorde, blatt) },
  ];
  it('Noten ändern: Akkorde bleiben', () => {
    const neu = inStimme(s0, 0, [{ noten: [{ midi: 60, dauer: 96 }] }, ...s0[0].takte.slice(1)], blatt);
    expect(akkordeNachfuehren(s0, neu, akkorde)).toEqual(akkorde);
  });
  it('Takt einfügen nach Takt 2: dahinter rücken die Akkorde mit, der neue hat keinen', () => {
    const neu = inAllen(s0, (t) => taktEinfuegen(t, blatt, 1));
    expect(akkordeNachfuehren(s0, neu, akkorde)).toEqual([['A'], ['B'], [], ['C'], ['D']]);
  });
  it('Takt löschen: sein Akkord geht mit', () => {
    const neu = inAllen(s0, (t) => taktLoeschen(t, blatt, 1));
    expect(akkordeNachfuehren(s0, neu, akkorde)).toEqual([['A'], ['C'], ['D']]);
  });
  it('Aufnahme einfügen in Takt 3: zwei neue Takte ohne Akkord davor', () => {
    const takt = { noten: [{ midi: 60, dauer: 96 }] };
    const { stimmen } = takteEinsetzen(s0, 0, 2, [takt, takt], 'einfuegen', blatt);
    expect(akkordeNachfuehren(s0, stimmen, akkorde)).toEqual([['A'], ['B'], [], [], ['C'], ['D']]);
  });
  it('Aufnahme ersetzt: Akkorde bleiben', () => {
    const takt = { noten: [{ midi: 60, dauer: 96 }] };
    const { stimmen } = takteEinsetzen(s0, 0, 1, [takt, takt], 'ersetzen', blatt);
    expect(akkordeNachfuehren(s0, stimmen, akkorde)).toEqual(akkorde);
  });
  it('Akkorde eines Takts setzen', () => {
    expect(taktAkkordeSetzen(akkorde, 1, ['Bm7', 'E7'])[1]).toEqual(['Bm7', 'E7']);
    expect(taktAkkordeSetzen([], 2, ['C'])).toEqual([[], [], ['C']]);
    expect(taktAkkordeSetzen([['C']], 0, [])).toEqual([]);
  });
});

describe('Hörbeispiel als Notenzeile', () => {
  const takte = folgeLesen('| Dm7 G7 | Cmaj7 |').takte;
  it('Grundtöne: zwei Halbe, dann eine Ganze; Lücken werden Pausen', () => {
    const t = linieAlsTakte(beispielLinie(takte, 'grundtoene'), blatt);
    expect(t[0].noten.map((n) => n.dauer)).toEqual([48, 48]);
    expect(t[1].noten.map((n) => n.dauer)).toEqual([96]);
    const halb = linieAlsTakte([[{ schlag: 1, dauer: 1, midi: 60, stimme: 'melodie', staerke: 1 }]], blatt);
    expect(halb[0].noten.map((n) => n.midi)).toEqual([null, 60, null]);
    expect(taktStimmt(halb[0], blatt)).toBe(true);
  });
  it('ABC ohne Titel und Tempo, mit Akkorden', () => {
    const abc = beispielAbc(beispielLinie(takte, 'guidetones'), [['Dm7', 'G7'], ['Cmaj7']], tonartFinden('C'));
    expect(abc).not.toMatch(/^T:/m);
    expect(abc).not.toMatch(/^Q:/m);
    expect(abc).toContain('"Dm7"');
    expect(abc).toContain('"Cmaj7"');
  });
});

describe('Akkorde transponieren', () => {
  it('mit dem Blatt: Halbtöne, bequem geschrieben, Unlesbares bleibt', () => {
    expect(akkordeVersetzen([['C7'], ['Gm7', 'C7']], 2)).toEqual([['D7'], ['Am7', 'D7']]);
    expect(akkordeVersetzen([['C7'], ['F7']], -2)).toEqual([['Bb7'], ['Eb7']]);
    expect(akkordeVersetzen([['C'], ['Xy']], 1)).toEqual([['Db'], ['Xy']]);
    expect(akkordeVersetzen([['Am7']], 12)).toEqual([['Am7']]);
  });
});

describe('Schreibweise nach den Akkorden', () => {
  it('über F7 Es, über A7 Cis — ohne Akkord nach der Tonart', () => {
    const takt = (midi: number) => ({ noten: [{ midi, dauer: 96 }] });
    const st: Stimme[] = [{ name: '', schluessel: 'violin', takte: [takt(63), takt(61), takt(63)] }];
    const text = alsAbcStimmen(st, blatt, { titel: 'X' }, tonartFinden('C'), [['F7'], ['A7']]);
    expect(text).toContain('"F7"_E96');
    expect(text).toContain('"A7"^C96');
    expect(text).toContain('^D96');
    expect(abcLesen(text)!.stimmen[0].takte.map((t) => t.noten[0].midi)).toEqual([63, 61, 63]);
  });
  it('gilt für alle Stimmen, die Symbole stehen nur über der ersten', () => {
    const st: Stimme[] = [
      { name: '', schluessel: 'violin', takte: [{ noten: [{ midi: 70, dauer: 96 }] }] },
      { name: 'B', schluessel: 'bass', takte: [{ noten: [{ midi: 46, dauer: 96 }] }] },
    ];
    const text = alsAbcStimmen(st, blatt, { titel: 'X' }, tonartFinden('C'), [['C7']]);
    expect(text.match(/"C7"/g)).toHaveLength(1);
    expect(text).toContain('_B,,96');
    expect(vorzugAusAkkorden(['Bb7', 'A7'])).toEqual(new Map([[10, '_'], [8, '_'], [1, '^']]));
  });
});
