import { describe, expect, it } from 'vitest';
import {
  einspielenPlanen, eintragZusammenfuehren, grabsteineLesen, grabsteineVereinigen, notenZusammenfuehren, rueckfrage, seiteZusammenfuehren, stand,
  stelleZusammenfuehren, tempiVereinigen, ueberschreibt, type Vorhanden,
} from '@/domain/einspielen';
import { SicherungsFehler } from '@/domain/sicherung';

const note = (id: string, mehr: object = {}) => ({ id, titel: `Titel ${id}`, stimme: '', erstellt: 1, datei: new Blob(['%PDF']), ...mehr });
const stelle = (id: string, notenId: string) => ({ id, notenId, seite: 1, x: 0, y: 0, b: 1, h: 1, titel: '', notiz: '', zielTempo: null, tempi: [] });
const anm = (notenId: string, seite: number) => ({ id: `${notenId}:${seite}`, notenId, seite, objekte: [] });
const geraet = (noten: string[] = [], stellen: string[] = [], anmerkungen: string[] = []): Vorhanden =>
  ({ noten: new Set(noten), stellen: new Set(stellen), anmerkungen: new Set(anmerkungen) });

describe('Sicherung einspielen planen', () => {
  it('trennt neue und schon vorhandene Noten', () => {
    const plan = einspielenPlanen({ noten: [note('a'), note('b'), note('c')], stellen: [stelle('s1', 'a')], anmerkungen: [anm('b', 1)] }, geraet(['b', 'x']));
    expect(plan.neu).toBe(2);
    expect(plan.ueberschrieben).toEqual({ noten: 1, stellen: 0, anmerkungen: 0 });
    expect(plan.stellen).toHaveLength(1);
    expect(plan.anmerkungen).toHaveLength(1);
    expect(plan.uebersprungen).toBe(0);
  });

  it('zählt, was auf dem Gerät überschrieben würde — nur gleiche ids', () => {
    const plan = einspielenPlanen({
      noten: [note('a')],
      stellen: [stelle('s1', 'a'), stelle('s2', 'a')],
      anmerkungen: [anm('a', 1), anm('a', 2)],
    }, geraet(['a'], ['s1', 's-nur-geraet'], ['a:2', 'a:9']));
    expect(plan.ueberschrieben).toEqual({ noten: 1, stellen: 1, anmerkungen: 1 });
    expect(ueberschreibt(plan)).toBe(true);
    // Alles aus der Sicherung wird übernommen; was nur auf dem Gerät ist, plant
    // der Plan gar nicht ein — es bleibt also unberührt.
    expect(plan.stellen.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(plan.anmerkungen.map((a) => a.id)).toEqual(['a:1', 'a:2']);
  });

  it('fragt nicht nach, wenn nichts überschrieben wird', () => {
    const plan = einspielenPlanen({ noten: [note('neu')], stellen: [stelle('s9', 'alt')], anmerkungen: [anm('alt', 3)] }, geraet(['alt'], ['s1'], ['alt:1']));
    expect(plan.ueberschrieben).toEqual({ noten: 0, stellen: 0, anmerkungen: 0 });
    expect(ueberschreibt(plan)).toBe(false);
    // Stelle und Anmerkung zu Noten, die nur auf dem Gerät sind, kommen dazu.
    expect(plan.stellen.map((s) => s.id)).toEqual(['s9']);
    expect(plan.anmerkungen.map((a) => a.id)).toEqual(['alt:3']);
  });

  it('überspringt Stellen und Anmerkungen ohne Noten und zählt sie', () => {
    const plan = einspielenPlanen({
      noten: [note('a')],
      stellen: [stelle('s1', 'a'), stelle('s2', 'weg'), stelle('s3', 'geraet')],
      anmerkungen: [anm('weg', 1), anm('a', 2)],
    }, geraet(['geraet'], ['s2'], ['weg:1']));
    expect(plan.stellen.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(plan.anmerkungen.map((a) => a.id)).toEqual(['a:2']);
    expect(plan.uebersprungen).toBe(2);
    // Übersprungenes überschreibt auch nichts.
    expect(plan.ueberschrieben).toEqual({ noten: 0, stellen: 0, anmerkungen: 0 });
  });

  it('zählt doppelte ids in der Sicherung einmal', () => {
    const plan = einspielenPlanen({ noten: [note('a'), note('a')], stellen: [stelle('s1', 'a'), stelle('s1', 'a')], anmerkungen: [] }, geraet(['a'], ['s1']));
    expect(plan.neu).toBe(0);
    expect(plan.ueberschrieben).toEqual({ noten: 1, stellen: 1, anmerkungen: 0 });
  });

  it('weist ungültige Noten ab', () => {
    const leer = { stellen: [], anmerkungen: [] };
    for (const kaputt of [note('a', { titel: 3 }), note('a', { stimme: null }), note('a', { erstellt: '1' }), note('a', { erstellt: Number.NaN })]) {
      expect(() => einspielenPlanen({ noten: [kaputt], ...leer }, geraet())).toThrow(SicherungsFehler);
    }
    expect(() => einspielenPlanen({ noten: [null as unknown as { id: string }], ...leer }, geraet())).toThrow(/Noteneintrag/);
  });

  it('weist Stellen und Anmerkungen ohne gültige Zuordnung ab', () => {
    const n = [note('a')];
    expect(() => einspielenPlanen({ noten: n, stellen: [{ id: 's', notenId: 7 }], anmerkungen: [] }, geraet())).toThrow(/Stelle/);
    expect(() => einspielenPlanen({ noten: n, stellen: ['s'], anmerkungen: [] }, geraet())).toThrow(/Stelle/);
    expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [null] }, geraet())).toThrow(/Anmerkung/);
    expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [[]] }, geraet())).toThrow(/Anmerkung/);
  });

  it('weist Stellen ohne Seite, Rahmen oder Tempo-Verlauf ab', () => {
    const n = [note('a')];
    const gut = stelle('s', 'a');
    expect(() => einspielenPlanen({ noten: n, stellen: [gut], anmerkungen: [] }, geraet())).not.toThrow();
    for (const kaputt of [
      { seite: 0 }, { seite: 1.5 }, { seite: '1' }, { seite: undefined },
      { x: '0' }, { y: null }, { b: Number.NaN }, { h: undefined },
      { tempi: undefined }, { tempi: {} },
    ]) {
      expect(() => einspielenPlanen({ noten: n, stellen: [{ ...gut, ...kaputt }], anmerkungen: [] }, geraet()), JSON.stringify(kaputt))
        .toThrow(/^Die Sicherung ist beschädigt/);
    }
  });

  it('weist Anmerkungen ohne Seite, Objekte oder mit falscher id ab', () => {
    const n = [note('a')];
    expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [anm('a', 2)] }, geraet())).not.toThrow();
    for (const kaputt of [
      { ...anm('a', 2), seite: '2' }, { ...anm('a', 2), seite: undefined },
      { ...anm('a', 2), objekte: undefined }, { ...anm('a', 2), objekte: 'x' },
      { ...anm('a', 2), id: 'a:3' }, { ...anm('a', 2), id: 'b:2' }, { ...anm('a', 2), id: 'irgendwas' },
    ]) {
      expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [kaputt] }, geraet()), JSON.stringify(kaputt))
        .toThrow(/^Die Sicherung ist beschädigt/);
    }
  });

  it('geht ganz leer', () => {
    expect(einspielenPlanen({ noten: [], stellen: [], anmerkungen: [] }, geraet(['a'], ['s'], ['a:1'])))
      .toMatchObject({ neu: 0, ueberschrieben: { noten: 0, stellen: 0, anmerkungen: 0 }, uebersprungen: 0 });
  });
});

describe('Sicherung zusammenführen ohne Verlust', () => {
  it('vereinigt Tempo-Verläufe: jeder Eintrag einmal, nach Zeit sortiert', () => {
    const geraet = [{ tempo: 80, am: 1 }, { tempo: 92, am: 30 }, { tempo: 88, am: 20 }];
    const sicherung = [{ tempo: 84, am: 10 }, { tempo: 80, am: 1 }, { tempo: 88, am: 20 }, { tempo: 90, am: 20 }];
    expect(tempiVereinigen(geraet, sicherung)).toEqual([
      { tempo: 80, am: 1 }, { tempo: 84, am: 10 }, { tempo: 88, am: 20 }, { tempo: 90, am: 20 }, { tempo: 92, am: 30 },
    ]);
    expect(tempiVereinigen([], [])).toEqual([]);
  });

  it('Stelle: Sicherung neuer → ihre Felder, Tempi vereinigt, Geräte-Felder bleiben', () => {
    const geraet = { ...stelle('s1', 'a'), titel: 'Gerät', notiz: 'alt', x: 0.5, zielTempo: 120, tempi: [{ tempo: 80, am: 1 }, { tempo: 96, am: 50 }], nurGeraet: true, geaendert: 60 };
    const sicherung = { ...stelle('s1', 'a'), titel: 'Sicherung', notiz: 'neu', x: 0.1, zielTempo: null, tempi: [{ tempo: 80, am: 1 }, { tempo: 84, am: 10 }], geaendert: 70 };
    const r = stelleZusammenfuehren(geraet, sicherung);
    expect(r).toMatchObject({ titel: 'Sicherung', notiz: 'neu', x: 0.1, zielTempo: null, nurGeraet: true, geaendert: 70 });
    expect(r.tempi).toEqual([{ tempo: 80, am: 1 }, { tempo: 84, am: 10 }, { tempo: 96, am: 50 }]);
    // Ohne Gegenstück auf dem Gerät: unverändert.
    expect(stelleZusammenfuehren(undefined, sicherung)).toBe(sicherung);
  });

  it('Stelle: Gerät neuer → seine Felder bleiben, Tempi trotzdem vereinigt', () => {
    const geraet = { ...stelle('s1', 'a'), titel: 'Gerät', zielTempo: 120, tempi: [{ tempo: 96, am: 50 }], geaendert: 90 };
    const sicherung = { ...stelle('s1', 'a'), titel: 'Sicherung', zielTempo: 100, tempi: [{ tempo: 84, am: 10 }], geaendert: 40 };
    const r = stelleZusammenfuehren(geraet, sicherung);
    expect(r).toMatchObject({ titel: 'Gerät', zielTempo: 120, geaendert: 90 });
    expect(r.tempi).toEqual([{ tempo: 84, am: 10 }, { tempo: 96, am: 50 }]);
  });

  it('Stand eines Eintrags: geändert, sonst aktualisiert/erstellt, sonst letztes Tempo', () => {
    expect(stand({ geaendert: 9, erstellt: 20 })).toBe(9);
    expect(stand({ erstellt: 5, aktualisiert: 12 })).toBe(12);
    expect(stand({ tempi: [{ tempo: 80, am: 3 }, { tempo: 90, am: 7 }] })).toBe(7);
    expect(stand({})).toBe(0);
    expect(stand(undefined)).toBe(0);
  });

  it('Seite: Wegradiertes bleibt weg — von welchem Gerät auch immer', () => {
    const strich = (id: string) => ({ id, art: 'stift', farbe: '#000', breite: 0.0025, punkte: [0, 0, 1, 1] });
    const geraet = { ...anm('a', 1), objekte: [strich('alt'), strich('neuHier')], entfernt: ['wegDort'] };
    const sicherung = { ...anm('a', 1), objekte: [strich('wegDort'), strich('neuDort')], entfernt: ['alt'] };
    const r = seiteZusammenfuehren(geraet, sicherung);
    expect(r.objekte.map((o) => (o as { id: string }).id)).toEqual(['neuHier', 'neuDort']);
    expect([...(r.entfernt as string[])].sort()).toEqual(['alt', 'wegDort']);
  });

  it('Seite: Striche nach id vereinigt, bei gleicher id gewinnt die Sicherung', () => {
    const strich = (id: string, farbe = '#000') => ({ id, art: 'stift', farbe, breite: 0.0025, punkte: [0, 0, 1, 1] });
    const geraet = { ...anm('a', 1), objekte: [strich('g1'), strich('beide', 'rot'), strich('g2')] };
    const sicherung = { ...anm('a', 1), objekte: [strich('s1'), strich('beide', 'blau')] };
    const r = seiteZusammenfuehren(geraet, sicherung);
    expect(r.objekte.map((o) => (o as { id: string }).id)).toEqual(['g1', 'beide', 'g2', 's1']);
    expect((r.objekte[1] as { farbe: string }).farbe).toBe('blau');
    expect(r).toMatchObject({ id: 'a:1', notenId: 'a', seite: 1 });
    expect(seiteZusammenfuehren(undefined, sicherung)).toBe(sicherung);
    // Leere Sicherung löscht keine Striche.
    expect(seiteZusammenfuehren(geraet, { ...anm('a', 1), objekte: [] }).objekte).toHaveLength(3);
  });

  it('Noten: Gerät neuer → seine Felder bleiben (z. B. Sammlungen), Verweis auch', () => {
    const handle = { name: 'Marsch.pdf' };
    const geraet = { ...note('a'), titel: 'Gerät', sammlungen: ['Märsche'], handle, geaendert: 80 };
    const r = notenZusammenfuehren(geraet, { ...note('a'), titel: 'Sicherung', sammlungen: [], geaendert: 30 });
    expect(r).toMatchObject({ titel: 'Gerät', sammlungen: ['Märsche'], geaendert: 80 });
    expect((r as { handle?: unknown }).handle).toBe(handle);
  });

  it('Noten: Felder und Datei aus der Sicherung, Dateiverweis des Geräts bleibt', () => {
    const handle = { name: 'Marsch.pdf' };
    const geraetDatei = new Blob(['%PDF alt']), neueDatei = new Blob(['%PDF neu']);
    const geraet = { ...note('a'), titel: 'Gerät', datei: geraetDatei, handle, zuletzt: 5 };
    const r = notenZusammenfuehren(geraet, { ...note('a'), titel: 'Sicherung', datei: neueDatei });
    expect(r).toMatchObject({ titel: 'Sicherung', zuletzt: 5 });
    expect(r.datei).toBe(neueDatei);
    expect((r as { handle?: unknown }).handle).toBe(handle);
    // Ein Verweis in der Sicherung selbst (fremdes Gerät) wird nie übernommen.
    expect('handle' in notenZusammenfuehren(undefined, { ...note('a'), handle: { fremd: true } })).toBe(false);
    expect('handle' in notenZusammenfuehren({ ...note('a') }, { ...note('a'), handle: { fremd: true } })).toBe(false);
  });
});

describe('Rückfrage beim Laden', () => {
  const plan = (noten: number, stellen: number, anmerkungen: number, uebersprungen = 0, loeschen = { noten: [] as string[], stellen: [] as string[] }) =>
    ({ ueberschrieben: { noten, stellen, anmerkungen }, uebersprungen, loeschen });

  it('nennt Datum, Anzahlen und wie zusammengeführt wird', () => {
    expect(rueckfrage(plan(2, 1, 3), '09.10.2026, 16:27 Uhr')).toBe(
      'Die Sicherung vom 09.10.2026, 16:27 Uhr aktualisiert auf diesem Gerät 2 Noten, 1 Stelle und 3 Seiten mit Anmerkungen. '
      + 'Wo beide Geräte etwas geändert haben, gilt der neuere Stand; Tempo-Verläufe und Striche werden zusammengeführt, Wegradiertes bleibt weg. Laden?',
    );
  });

  it('ohne Datum und mit übersprungenen Einträgen', () => {
    expect(rueckfrage(plan(0, 2, 1, 1), null)).toBe(
      'Die Sicherung (Datum unbekannt) aktualisiert auf diesem Gerät 2 Stellen und 1 Seite mit Anmerkungen. '
      + 'Wo beide Geräte etwas geändert haben, gilt der neuere Stand; Tempo-Verläufe und Striche werden zusammengeführt, Wegradiertes bleibt weg. '
      + '1 Eintrag ohne zugehörige Noten wird übersprungen. Laden?',
    );
    expect(rueckfrage(plan(1, 0, 0, 3), null)).toContain(' 3 Einträge ohne zugehörige Noten werden übersprungen.');
    expect(rueckfrage(plan(1, 0, 0), null)).toContain('aktualisiert auf diesem Gerät 1 Noten. ');
  });

  it('nennt, was auf dem anderen Gerät gelöscht wurde und hier verschwindet', () => {
    const r = rueckfrage(plan(0, 0, 0, 0, { noten: ['a', 'b'], stellen: ['s'] }), null);
    expect(r).toContain('Auf dem anderen Gerät gelöscht und deshalb auch hier gelöscht: 2 Stücke (samt Stellen und Anmerkungen) und 1 Stelle.');
    expect(rueckfrage(plan(0, 0, 0, 0, { noten: [], stellen: ['s', 't'] }), null)).toContain('gelöscht: 2 Stellen.');
  });
});

describe('Gelöschtes übertragen (Grabsteine)', () => {
  const g = (art: 'noten' | 'stelle', id: string, am: number) => ({ art, id, am });

  it('liest nur stimmige Grabsteine', () => {
    expect(grabsteineLesen([g('noten', 'a', 5), { art: 'x', id: 'b', am: 1 }, { art: 'stelle', id: 3, am: 1 }, null, { art: 'tag', id: 't', am: 2 }]))
      .toEqual([g('noten', 'a', 5), { art: 'tag', id: 't', am: 2 }]);
    expect(grabsteineLesen(undefined)).toEqual([]);
  });
  it('vereinigt: je Eintrag der späteste, sehr alte fallen weg', () => {
    const tag = 86_400_000, jetzt = 400 * tag;
    expect(grabsteineVereinigen([g('noten', 'a', 40 * tag), g('stelle', 'uralt', 5 * tag), g('stelle', 's', 380 * tag)], [g('noten', 'a', 50 * tag), g('noten', 'b', 390 * tag)], jetzt))
      .toEqual([g('noten', 'a', 50 * tag), g('stelle', 's', 380 * tag), g('noten', 'b', 390 * tag)]);
  });

  const vorhanden = (noten: [string, number][], stellen: [string, number][] = []) => ({
    ids: geraet(noten.map(([id]) => id), stellen.map(([id]) => id)),
    staende: { noten: new Map(noten.map(([id, st]) => [id, { stand: st, datei: st }])), stellen: new Map(stellen) },
  });

  it('auf dem anderen Gerät gelöscht → hier löschen, wenn hier nicht später geändert', () => {
    const v = vorhanden([['a', 10], ['b', 90]], [['s1', 10], ['s2', 99]]);
    const plan = einspielenPlanen({ noten: [], stellen: [], anmerkungen: [] }, v.ids, {
      staende: v.staende, grabsteine: [g('noten', 'a', 50), g('noten', 'b', 50), g('stelle', 's1', 50), g('stelle', 's2', 50), g('noten', 'gibtsNicht', 50)],
    });
    expect(plan.loeschen).toEqual({ noten: ['a'], stellen: ['s1'] });
    expect(ueberschreibt(plan)).toBe(true);
  });

  it('hier gelöscht → aus der Sicherung nicht wieder anlegen (samt Stellen), außer dort später geändert', () => {
    const plan = einspielenPlanen({
      noten: [note('weg', { geaendert: 20 }), note('neuer', { geaendert: 80 })],
      stellen: [stelle('s-weg', 'weg'), { ...stelle('s-tot', 'neuer'), geaendert: 10 }],
      anmerkungen: [anm('weg', 1)],
    }, geraet(), { geraetGrabsteine: [g('noten', 'weg', 50), g('noten', 'neuer', 50), g('stelle', 's-tot', 50)] });
    expect(plan.noten.map((n) => n.id)).toEqual(['neuer']);
    expect(plan.stellen).toEqual([]);
    expect(plan.anmerkungen).toEqual([]);
    expect(plan.verworfen).toBe(4);
    expect(plan.uebersprungen).toBe(0);
  });

  it('PDF nur aus der Sicherung, wenn sie dort nicht älter ist als hier', () => {
    const plan = einspielenPlanen({ noten: [note('a', { aktualisiert: 30 }), note('b', { aktualisiert: 30 }), note('c')], stellen: [], anmerkungen: [] }, geraet(['a', 'b']), {
      staende: { noten: new Map([['a', { stand: 5, datei: 20 }], ['b', { stand: 5, datei: 40 }]]), stellen: new Map() },
    });
    expect(plan.dateiAusSicherung).toEqual(['a', 'c']);
  });
});

describe('Sicherung einspielen: optionale Listen', () => {
  const virtuell = (id: string, quelle: string) => ({ id, titel: `V ${id}`, stimme: '', erstellt: 1, quelle: { stueckId: quelle, von: 2, bis: 3 } });
  const lz = (id: string, stueckId: string) => ({ id, stueckId, seite: 2, titel: 'Marsch', erstellt: 1 });
  const mk = (stueckId: string, seite: number) => ({ id: `${stueckId}:${seite}`, stueckId, seite, gesetzt: 1 });
  const sl = (id: string, eintraege: object[]) => ({ id, titel: `Liste ${id}`, erstellt: 1, eintraege });
  const leer = { stellen: [], anmerkungen: [] };

  it('ohne die Listen wie bisher', () => {
    const plan = einspielenPlanen({ noten: [note('a')], ...leer }, geraet());
    expect(plan.zusatz).toEqual({ virtuelle: [], lesezeichen: [], merker: [], setlisten: [] });
    expect(plan.ersetzt).toEqual({ lesezeichen: 0, merker: 0, setlisten: 0 });
  });

  it('nimmt virtuelle Stücke mit echter Quelle, aus der Sicherung oder vom Gerät', () => {
    const plan = einspielenPlanen({
      noten: [note('band')], ...leer,
      virtuelle: [virtuell('v1', 'band'), virtuell('v2', 'geraet'), virtuell('v3', 'weg'), virtuell('v4', 'v-geraet')],
    }, { ...geraet(['geraet', 'v-geraet', 'v1']), echte: new Set(['geraet']) });
    // v3: Quelle gibt es nicht; v4: Quelle ist auf dem Gerät selbst virtuell.
    expect(plan.zusatz.virtuelle.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(plan.uebersprungen).toBe(2);
    // virtuelle zählen als Noten: band und v2 neu, v1 gibt es schon.
    expect(plan.neu).toBe(2);
    expect(plan.ueberschrieben.noten).toBe(1);
  });

  it('ein Stück auf dem Gerät, das die Sicherung virtuell macht, taugt nicht mehr als Quelle', () => {
    const plan = einspielenPlanen({ noten: [], ...leer, virtuelle: [virtuell('x', 'y'), virtuell('y', 'z')] },
      { ...geraet(['x', 'y', 'z']), echte: new Set(['x', 'y', 'z']) });
    expect(plan.zusatz.virtuelle.map((v) => v.id)).toEqual(['y']);
  });

  it('Lesezeichen, Merker und Stellen auch für virtuelle Stücke aus der Sicherung', () => {
    const plan = einspielenPlanen({
      noten: [note('band')], stellen: [stelle('s', 'v')], anmerkungen: [],
      virtuelle: [virtuell('v', 'band')], lesezeichen: [lz('l1', 'v'), lz('l2', 'weg')], merker: [mk('band', 2), mk('weg', 1)],
    }, geraet());
    expect(plan.stellen.map((s) => s.id)).toEqual(['s']);
    expect(plan.zusatz.lesezeichen.map((l) => l.id)).toEqual(['l1']);
    expect(plan.zusatz.merker.map((m) => m.id)).toEqual(['band:2']);
    expect(plan.uebersprungen).toBe(2);
  });

  it('Setlisten bleiben, verwaiste Einträge fallen heraus und werden gezählt', () => {
    const plan = einspielenPlanen({
      noten: [note('a')], ...leer, lesezeichen: [lz('l1', 'a')],
      setlisten: [sl('s', [
        { id: '1', art: 'stueck', stueckId: 'a' },
        { id: '2', art: 'stueck', stueckId: 'weg' },
        { id: '3', art: 'lesezeichen', lesezeichenId: 'l1' },
        { id: '4', art: 'lesezeichen', lesezeichenId: 'l-geraet' },
        { id: '5', art: 'lesezeichen', lesezeichenId: 'l-weg' },
        { id: '6', art: 'platzhalter', titel: 'auswendig' },
        { id: '7', art: 'stueck', stueckId: 'geraet' },
      ]), sl('nur-weg', [{ id: '1', art: 'stueck', stueckId: 'weg' }])],
    }, { ...geraet(['geraet']), lesezeichen: new Set(['l-geraet']) });
    expect(plan.zusatz.setlisten.map((s) => [s.id, (s.eintraege as { id: string }[]).map((e) => e.id)])).toEqual([
      ['s', ['1', '3', '4', '6', '7']],
      ['nur-weg', []],
    ]);
    expect(plan.uebersprungen).toBe(3);
  });

  it('zählt, was auf dem Gerät ganz ersetzt wird, und fragt dann nach', () => {
    const plan = einspielenPlanen({
      noten: [note('a')], ...leer, lesezeichen: [lz('l1', 'a')], merker: [mk('a', 1)], setlisten: [sl('s', [])],
    }, { ...geraet(), lesezeichen: new Set(['l1']), merker: new Set(['a:1']), setlisten: new Set(['s', 'andere']) });
    expect(plan.ersetzt).toEqual({ lesezeichen: 1, merker: 1, setlisten: 1 });
    expect(plan.ueberschrieben).toEqual({ noten: 0, stellen: 0, anmerkungen: 0 });
    expect(ueberschreibt(plan)).toBe(true);
    expect(rueckfrage(plan, null)).toContain('1 Lesezeichen, 1 Merker und 1 Setliste');
  });

  it('weist kaputte Einträge ab', () => {
    const n = { noten: [note('a')], ...leer };
    const kaputt: [string, object][] = [
      ['virtuelle', { ...virtuell('v', 'a'), quelle: { stueckId: 'a', von: 3, bis: 2 } }],
      ['virtuelle', { ...virtuell('v', 'a'), quelle: undefined }],
      ['virtuelle', { ...virtuell('v', 'a'), titel: 1 }],
      ['lesezeichen', { ...lz('l', 'a'), seite: 0 }],
      ['merker', { ...mk('a', 1), id: 'a:2' }],
      ['setlisten', sl('s', [{ id: '1', art: 'unbekannt' }])],
      ['setlisten', sl('s', [{ id: '1', art: 'stueck' }])],
      ['setlisten', { ...sl('s', []), eintraege: 'x' }],
    ];
    for (const [liste, eintrag] of kaputt) {
      expect(() => einspielenPlanen({ ...n, [liste]: [eintrag] }, geraet()), `${liste} ${JSON.stringify(eintrag)}`).toThrow(SicherungsFehler);
    }
  });
});

describe('Optionale Listen: neuerer Stand und Grabsteine', () => {
  const lz = (id: string, geaendert: number) => ({ id, stueckId: 'a', seite: 1, titel: `LZ ${geaendert}`, erstellt: 1, geaendert });
  const sl = (id: string, geaendert: number, eintraege: object[] = []) => ({ id, titel: `SL ${geaendert}`, erstellt: 1, geaendert, eintraege });
  const leer = { stellen: [], anmerkungen: [] };

  it('dort gelöscht → hier löschen, wenn hier nicht später geändert', () => {
    const plan = einspielenPlanen({ noten: [], ...leer }, { ...geraet(['a']), lesezeichen: new Set(['l-alt', 'l-neu']), merker: new Set(['a:1']), setlisten: new Set(['s']) }, {
      grabsteine: [
        { art: 'lesezeichen', id: 'l-alt', am: 50 }, { art: 'lesezeichen', id: 'l-neu', am: 50 },
        { art: 'merker', id: 'a:1', am: 50 }, { art: 'setliste', id: 's', am: 50 },
      ],
      staende: { noten: new Map(), stellen: new Map(), lesezeichen: new Map([['l-alt', 10], ['l-neu', 90]]), merker: new Map([['a:1', 10]]), setlisten: new Map([['s', 10]]) },
    });
    expect(plan.loeschen).toEqual({ noten: [], stellen: [], lesezeichen: ['l-alt'], merker: ['a:1'], setlisten: ['s'] });
    expect(ueberschreibt(plan)).toBe(true);
    expect(rueckfrage(plan, null)).toContain('1 Lesezeichen, 1 Merker und 1 Setliste');
  });

  it('hier gelöscht → die Sicherung legt es nicht wieder an, außer sie ist neuer', () => {
    const plan = einspielenPlanen({ noten: [note('a')], ...leer, lesezeichen: [lz('l1', 10), lz('l2', 90)], setlisten: [sl('s', 10)] }, geraet(), {
      geraetGrabsteine: [{ art: 'lesezeichen', id: 'l1', am: 50 }, { art: 'lesezeichen', id: 'l2', am: 50 }, { art: 'setliste', id: 's', am: 50 }],
    });
    expect(plan.zusatz.lesezeichen.map((l) => l.id)).toEqual(['l2']);
    expect(plan.zusatz.setlisten).toEqual([]);
    expect(plan.verworfen).toBe(2);
  });

  it('ein hier gelöschtes virtuelles Stück kommt nicht wieder, samt seinen Lesezeichen', () => {
    const v = { id: 'v', titel: 'V', stimme: '', erstellt: 1, geaendert: 10, quelle: { stueckId: 'a', von: 1, bis: 2 } };
    const plan = einspielenPlanen({ noten: [note('a')], ...leer, virtuelle: [v], lesezeichen: [{ ...lz('l', 5), stueckId: 'v' }] }, geraet(), {
      geraetGrabsteine: [{ art: 'noten', id: 'v', am: 50 }],
    });
    expect(plan.zusatz.virtuelle).toEqual([]);
    expect(plan.zusatz.lesezeichen).toEqual([]);
    expect(plan.verworfen).toBe(2);
  });

  it('Setliste: der neuere Stand ganz, Einträge nicht gemischt', () => {
    const hier = sl('s', 90, [{ id: '1', art: 'platzhalter', titel: 'hier' }]);
    const dort = sl('s', 10, [{ id: '2', art: 'platzhalter', titel: 'dort' }]);
    expect(eintragZusammenfuehren(hier, dort)).toEqual(hier);
    expect(eintragZusammenfuehren(dort, hier)).toEqual(hier);
    expect(eintragZusammenfuehren(undefined, dort)).toEqual(dort);
  });
});
