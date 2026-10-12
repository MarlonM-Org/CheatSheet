// Die Speicherschicht (src/components/ueben/lokal.ts) gegen einen echten
// Gerätespeicher (fake-indexeddb): Datenbank „cheatsheet“, Umstieg über die
// Sicherung, die Vorgängerin „ueben“ bleibt unberührt. docs/datenmodell.md.
import { existsSync, readFileSync } from 'node:fs';
import { IDBDatabase } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sicherungLesen, sicherungPacken } from '@/domain/sicherung';
import {
  abzug, altesGeraetAnlegen, datenbanken, neuesGeraet, pdf, roh, rohSchreiben, schemaVon, text, VORGAENGER, type Geraet,
} from './hilfen/geraet';

let g: Geraet;
beforeEach(async () => { g = await neuesGeraet(); });

const stelle = (stueckId: string, seite: number, y: number, titel = 'T. 1') =>
  ({ stueckId, seite, x: 0.1, y, b: 0.3, h: 0.1, titel });
const strich = { id: 'x', art: 'stift' as const, farbe: '#000', breite: 2, punkte: [0, 0, 1, 1] };
const spur = { id: 'r', art: 'radiert' as const, breite: 0.02, punkte: [0.5, 0.5] };
const anlegen = (titel: string, inhalt = titel) => g.lokal.stueckAnlegen({ titel, stimme: '', datei: pdf(inhalt) });

describe('Datenbank „cheatsheet“', () => {
  it('legt auf einem leeren Gerät alle Speicher mit ihren Indizes an', async () => {
    await g.lokal.alleStuecke();
    const mitIndex = { schluessel: 'id', indizes: ['stueckId'] };
    expect(await schemaVon()).toEqual({
      version: 1,
      speicher: {
        stuecke: { schluessel: 'id', indizes: [] },
        dateien: { schluessel: 'id', indizes: [] },
        stellen: mitIndex, anmerkungen: mitIndex, lesezeichen: mitIndex, merker: mitIndex,
        setlisten: { schluessel: 'id', indizes: [] },
      },
    });
  });
});

describe('Die Vorgängerin „ueben“', () => {
  it.each([1, 2, 3] as const)('bleibt mit Schema %i bytegleich liegen, während die App arbeitet', async (stand) => {
    await altesGeraetAnlegen(stand, {
      noten: [{ id: 'n1', titel: 'Pomp', stimme: '', erstellt: 1, datei: pdf('alt') }],
      stellen: [{ id: 's1', notenId: 'n1', seite: 1, x: 0, y: 0, b: 1, h: 1, titel: '', notiz: '', zielTempo: null, tempi: [] }],
    });
    const vorher = await abzug(VORGAENGER);
    expect(await g.lokal.vorgaengerDa()).toBe(true);
    const id = await anlegen('Neu');
    await g.lokal.stelleAnlegen(stelle(id, 1, 0.1));
    await g.lokal.sicherungErstellen();
    await g.lokal.stueckeLoeschen([id]);
    expect(await abzug(VORGAENGER)).toEqual(vorher);
    expect((await schemaVon(VORGAENGER)).version).toBe(stand);
    expect(await g.lokal.alleStuecke()).toEqual([]); // nichts aus „ueben“ übernommen
  });

  it('fehlt sie, legt die Frage danach sie nicht an', async () => {
    expect(await g.lokal.vorgaengerDa()).toBe(false);
    await g.lokal.alleStuecke();
    expect(await g.lokal.vorgaengerDa()).toBe(false);
    expect(await datenbanken()).toEqual(['cheatsheet']);
  });

  it('kennt der Browser die Liste der Datenbanken nicht, heißt es nein', async () => {
    await altesGeraetAnlegen(3, {});
    Object.defineProperty(indexedDB, 'databases', { value: undefined, configurable: true });
    expect(await g.lokal.vorgaengerDa()).toBe(false);
  });
});

describe('Stücke', () => {
  it('legt den Datensatz ohne Blob und die Datei als Bytes in „dateien“ ab', async () => {
    const id = await g.lokal.stueckAnlegen({ titel: 'Pomp', stimme: 'Klar 1', datei: pdf('eins'), dateiname: 'pomp.pdf' });
    const [s] = await roh('stuecke');
    expect(s).toMatchObject({ id, titel: 'Pomp', stimme: 'Klar 1', dateiname: 'pomp.pdf' });
    expect(s).not.toHaveProperty('datei');
    expect(typeof s.erstellt).toBe('number');
    const [d] = await roh<{ id: string; daten: ArrayBuffer; typ: string }>('dateien');
    expect(d.id).toBe(id);
    expect(d.daten).toBeInstanceOf(ArrayBuffer);
    expect(text(d.daten)).toBe('%PDF-1.4 eins');
    expect(d.typ).toBe('application/pdf');
  });

  it('liefert die Datei', async () => {
    const id = await anlegen('A', 'eins');
    const datei = await g.lokal.stueckDatei((await g.lokal.stueckHolen(id))!);
    expect(datei.type).toBe('application/pdf');
    expect(await datei.text()).toBe('%PDF-1.4 eins');
  });

  it('meldet eine verlorene Datei klar', async () => {
    await g.lokal.alleStuecke(); // erst die App die Datenbank anlegen lassen
    await rohSchreiben('stuecke', [{ id: 'weg', titel: 'Weg', stimme: '', erstellt: 1 }]);
    await expect(g.lokal.stueckDatei({ id: 'weg' })).rejects.toBeInstanceOf(g.lokal.DateiVerloren);
  });

  it('ändert Felder samt Metadaten, ohne die Datei anzufassen', async () => {
    const id = await anlegen('A', 'eins');
    await g.lokal.stueckAendern(id, { titel: 'B', komponist: 'Elgar', tags: ['Marsch'], blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    const s = await g.lokal.stueckHolen(id);
    expect(s).toMatchObject({ id, titel: 'B', komponist: 'Elgar', tags: ['Marsch'], blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    expect(await (await g.lokal.stueckDatei(s!)).text()).toBe('%PDF-1.4 eins');
  });

  it('ersetzt die Datei, der Datensatz bleibt ohne Blob', async () => {
    const id = await anlegen('A', 'eins');
    await g.lokal.stueckAendern(id, { datei: pdf('zwei'), dateiname: 'neu.pdf' });
    const [s] = await roh('stuecke');
    expect(s).not.toHaveProperty('datei');
    expect(s.dateiname).toBe('neu.pdf');
    expect(await (await g.lokal.stueckDatei({ id })).text()).toBe('%PDF-1.4 zwei');
  });

  it('ändert nichts an einem Stück, das es nicht gibt', async () => {
    await g.lokal.stueckAendern('gibtsnicht', { titel: 'X' });
    await g.lokal.stueckAendern('gibtsnicht', { titel: 'X', datei: pdf('x') });
    expect(await roh('stuecke')).toEqual([]);
    expect(await roh('dateien')).toEqual([]);
  });

  it('Datensatz und Datei ganz oder gar nicht: Scheitert einer, bleibt der alte Stand', async () => {
    const id = await anlegen('A', 'alt');
    // Eine Funktion lässt sich nicht speichern (DataCloneError) — die neue Datei darf dann auch nicht ankommen.
    await expect(g.lokal.stueckAendern(id, { titel: 'B', datei: pdf('neu'), handle: (() => {}) as never })).rejects.toThrow();
    expect((await g.lokal.stueckHolen(id))?.titel).toBe('A');
    expect(text((await roh<{ daten: ArrayBuffer }>('dateien'))[0].daten)).toBe('%PDF-1.4 alt');
  });

  it('merkt „zuletzt geöffnet“ auf dem Gerät, nicht in der Datenbank', async () => {
    const id = await anlegen('A');
    const vorher = await roh('stuecke');
    g.lokal.zuletztMerken(id);
    expect(g.lokal.zuletztListe()[id]).toBeTypeOf('number');
    expect(await roh('stuecke')).toEqual(vorher);
  });
});

describe('Virtuelle Stücke', () => {
  const quelle = (stueckId: string, von = 3, bis = 5) => ({ stueckId, von, bis });

  it('zeigen die PDF ihrer Quelle', async () => {
    const band = await anlegen('Sammelband', 'band');
    const v = await g.lokal.virtuellesAnlegen({ titel: 'Marsch', stimme: '', quelle: quelle(band) });
    const s = await g.lokal.stueckHolen(v);
    expect(s).toMatchObject({ titel: 'Marsch', quelle: quelle(band) });
    expect(await (await g.lokal.stueckDatei(s!)).text()).toBe('%PDF-1.4 band');
    expect((await roh('dateien')).map((d) => d.id)).toEqual([band]);
  });

  it('brauchen ein echtes Stück als Quelle und einen gültigen Bereich — sonst wird nichts angelegt', async () => {
    const band = await anlegen('Sammelband');
    const v = await g.lokal.virtuellesAnlegen({ titel: 'Marsch', stimme: '', quelle: quelle(band) });
    await expect(g.lokal.virtuellesAnlegen({ titel: 'X', stimme: '', quelle: quelle('weg') })).rejects.toThrow(/gibt es nicht/);
    await expect(g.lokal.virtuellesAnlegen({ titel: 'X', stimme: '', quelle: quelle(v) })).rejects.toThrow(/eigener PDF/);
    await expect(g.lokal.virtuellesAnlegen({ titel: 'X', stimme: '', quelle: quelle(band, 4, 2) })).rejects.toThrow(/Seitenbereich/);
    expect((await g.lokal.alleStuecke()).map((s) => s.titel).sort()).toEqual(['Marsch', 'Sammelband']);
  });

  it('ihre PDF lässt sich nicht ersetzen', async () => {
    const band = await anlegen('Sammelband');
    const v = await g.lokal.virtuellesAnlegen({ titel: 'Marsch', stimme: '', quelle: quelle(band) });
    await expect(g.lokal.stueckAendern(v, { datei: pdf('x') })).rejects.toThrow(/anderen/);
    expect(await roh('dateien')).toHaveLength(1);
  });
});

describe('Löschen', () => {
  it('ein Stück samt Datei, Stellen und Anmerkungen — andere bleiben', async () => {
    const a = await anlegen('A');
    const b = await anlegen('B');
    for (const id of [a, b]) {
      await g.lokal.stelleAnlegen(stelle(id, 1, 0.2));
      await g.lokal.stelleAnlegen(stelle(id, 2, 0.2));
      await g.lokal.anmerkungenSpeichern(id, 1, [strich]);
    }
    await g.lokal.stueckeLoeschen([a]);
    expect((await g.lokal.alleStuecke()).map((s) => s.id)).toEqual([b]);
    expect((await roh('dateien')).map((d) => d.id)).toEqual([b]);
    expect(new Set((await roh('stellen')).map((s) => s.stueckId))).toEqual(new Set([b]));
    expect((await roh('anmerkungen')).map((s) => s.stueckId)).toEqual([b]);
    expect(await g.lokal.stellenVon(b)).toHaveLength(2);
  });

  it('eine Quelle nimmt ihre virtuellen Stücke, Lesezeichen, Merker und Setlisten-Einträge mit', async () => {
    const band = await anlegen('Sammelband');
    const pomp = await anlegen('Pomp');
    const marsch = await g.lokal.virtuellesAnlegen({ titel: 'Marsch', stimme: '', quelle: { stueckId: band, von: 3, bis: 5 } });
    const lzBand = await g.lokal.lesezeichenAnlegen({ stueckId: band, seite: 2, titel: 'Trio' });
    await g.lokal.lesezeichenAnlegen({ stueckId: marsch, seite: 1, titel: 'Anfang' });
    const lzPomp = await g.lokal.lesezeichenAnlegen({ stueckId: pomp, seite: 1, titel: 'Anfang' });
    await g.lokal.merkerSetzen(marsch, 1, true);
    await g.lokal.merkerSetzen(pomp, 2, true);
    const konzert = await g.lokal.setlisteAnlegen('Konzert');
    await g.lokal.setlisteAendern(konzert, { eintraege: [
      { id: '1', art: 'stueck', stueckId: pomp },
      { id: '2', art: 'stueck', stueckId: marsch },
      { id: '3', art: 'lesezeichen', lesezeichenId: lzBand },
      { id: '4', art: 'platzhalter', titel: 'auswendig' },
      { id: '5', art: 'lesezeichen', lesezeichenId: lzPomp },
    ] });
    const ruhig = await g.lokal.setlisteAnlegen('Ruhig');
    await g.lokal.setlisteAendern(ruhig, { eintraege: [{ id: '1', art: 'stueck', stueckId: pomp }] });
    const ruhigVorher = await g.lokal.setlisteHolen(ruhig);

    const vorschau = await g.lokal.loeschVorschau([band]);
    expect(vorschau.virtuelleTitel).toEqual(['Marsch']);
    expect(vorschau.setlistenTitel).toEqual(['Konzert']);
    expect(await g.lokal.alleStuecke()).toHaveLength(3); // die Vorschau schreibt nichts

    const folgen = await g.lokal.stueckeLoeschen([band]);
    expect(folgen.stuecke.sort()).toEqual([band, marsch].sort());
    expect((await g.lokal.alleStuecke()).map((s) => s.id)).toEqual([pomp]);
    expect((await roh('lesezeichen')).map((l) => l.id)).toEqual([lzPomp]);
    expect((await g.lokal.alleMerker()).map((m) => m.id)).toEqual([`${pomp}:2`]);
    expect((await g.lokal.setlisteHolen(konzert))?.eintraege.map((e) => e.id)).toEqual(['1', '4', '5']);
    expect(await g.lokal.setlisteHolen(ruhig)).toEqual(ruhigVorher);
  });

  it('ein virtuelles Stück lässt Quelle und geteilte Stellen und Anmerkungen stehen', async () => {
    const band = await anlegen('Sammelband');
    const marsch = await g.lokal.virtuellesAnlegen({ titel: 'Marsch', stimme: '', quelle: { stueckId: band, von: 3, bis: 5 } });
    await g.lokal.stelleAnlegen(stelle(band, 3, 0.2)); // gesetzt im Marsch, liegt bei der Quelle
    await g.lokal.anmerkungenSpeichern(band, 3, [strich]);
    await g.lokal.stueckeLoeschen([marsch]);
    expect((await g.lokal.alleStuecke()).map((s) => s.id)).toEqual([band]);
    expect(await g.lokal.stellenVon(band)).toHaveLength(1);
    expect(await g.lokal.anmerkungenVon(band)).toHaveLength(1);
    expect(await roh('dateien')).toHaveLength(1);
  });

  it('löscht nur, was am Stück hängt', async () => {
    const id = await anlegen('A');
    // Ohne stueckId taucht ein Datensatz im Index nicht auf und bleibt unberührt.
    await rohSchreiben('anmerkungen', [{ id: 'fremd', seite: 1, objekte: [] }]);
    await g.lokal.stueckeLoeschen([id]);
    expect(await roh('anmerkungen')).toEqual([{ id: 'fremd', seite: 1, objekte: [] }]);
  });
});

describe('Stellen', () => {
  it('legt an mit leerer Notiz, ohne Ziel und ohne Tempi; sortiert nach Seite und Höhe', async () => {
    await g.lokal.stelleAnlegen(stelle('n', 2, 0.1, 'c'));
    await g.lokal.stelleAnlegen(stelle('n', 1, 0.8, 'b'));
    await g.lokal.stelleAnlegen(stelle('n', 1, 0.2, 'a'));
    await g.lokal.stelleAnlegen(stelle('anders', 1, 0.1, 'x'));
    const st = await g.lokal.stellenVon('n');
    expect(st.map((s) => s.titel)).toEqual(['a', 'b', 'c']);
    expect(st[0]).toMatchObject({ stueckId: 'n', notiz: '', zielTempo: null, tempi: [] });
    expect(st[0].id).toBeTypeOf('string');
  });

  it('ändert Felder, hängt geschaffte Tempi an und löscht', async () => {
    await g.lokal.stelleAnlegen(stelle('n', 1, 0.1));
    const [{ id }] = await g.lokal.stellenVon('n');
    await g.lokal.stelleAendern(id, { notiz: 'leise', zielTempo: 96 });
    await g.lokal.tempoGeschafft(id, 79.6);
    await g.lokal.tempoGeschafft(id, 84);
    const [s] = await g.lokal.stellenVon('n');
    expect(s).toMatchObject({ id, notiz: 'leise', zielTempo: 96 });
    expect(s.tempi.map((t) => t.tempo)).toEqual([80, 84]);
    expect(s.tempi[0].am).toBeTypeOf('number');
    await g.lokal.stelleLoeschen(id);
    expect(await g.lokal.stellenVon('n')).toEqual([]);
  });

  it('ignoriert Änderungen an einer Stelle, die es nicht gibt', async () => {
    await g.lokal.stelleAendern('gibtsnicht', { notiz: 'x' });
    await g.lokal.tempoGeschafft('gibtsnicht', 80);
    expect(await roh('stellen')).toEqual([]);
  });
});

describe('Anmerkungen', () => {
  it('ein Datensatz je Seite mit Schlüssel „stueckId:seite“, Speichern ersetzt die Seite', async () => {
    await g.lokal.anmerkungenSpeichern('n', 1, [strich]);
    await g.lokal.anmerkungenSpeichern('n', 2, [spur]);
    await g.lokal.anmerkungenSpeichern('n', 1, [strich, spur]);
    await g.lokal.anmerkungenSpeichern('anders', 1, []);
    const seiten = (await g.lokal.anmerkungenVon('n')).sort((a, b) => a.seite - b.seite);
    expect(seiten).toEqual([
      { id: 'n:1', stueckId: 'n', seite: 1, objekte: [strich, spur] },
      { id: 'n:2', stueckId: 'n', seite: 2, objekte: [spur] },
    ]);
  });
});

describe('Lesezeichen', () => {
  it('anlegen, nach Seite sortiert lesen, umbenennen', async () => {
    const b = await g.lokal.lesezeichenAnlegen({ stueckId: 'n', seite: 5, titel: 'Trio' });
    await g.lokal.lesezeichenAnlegen({ stueckId: 'n', seite: 2, titel: 'Anfang' });
    await g.lokal.lesezeichenAnlegen({ stueckId: 'anders', seite: 1, titel: 'x' });
    await g.lokal.lesezeichenAendern(b, { titel: 'Trio (D.C.)' });
    const l = await g.lokal.lesezeichenVon('n');
    expect(l.map((x) => [x.seite, x.titel])).toEqual([[2, 'Anfang'], [5, 'Trio (D.C.)']]);
    expect(l[0].erstellt).toBeTypeOf('number');
  });

  it('löschen entfernt es auch aus Setlisten, in einem Schritt', async () => {
    const lz = await g.lokal.lesezeichenAnlegen({ stueckId: 'n', seite: 5, titel: 'Trio' });
    const sl = await g.lokal.setlisteAnlegen('Konzert');
    await g.lokal.setlisteAendern(sl, { eintraege: [
      { id: '1', art: 'lesezeichen', lesezeichenId: lz }, { id: '2', art: 'stueck', stueckId: 'n' },
    ] });
    await g.lokal.lesezeichenLoeschen(lz);
    expect(await g.lokal.lesezeichenVon('n')).toEqual([]);
    expect((await g.lokal.setlisteHolen(sl))?.eintraege.map((e) => e.id)).toEqual(['2']);
  });
});

describe('Merker', () => {
  it('einer je Seite; setzen, wegnehmen, alle auf einmal löschen', async () => {
    await g.lokal.merkerSetzen('n', 3, true);
    await g.lokal.merkerSetzen('n', 3, true);
    await g.lokal.merkerSetzen('n', 7, true);
    await g.lokal.merkerSetzen('m', 1, true);
    expect((await g.lokal.merkerVon('n')).map((m) => m.id).sort()).toEqual(['n:3', 'n:7']);
    await g.lokal.merkerSetzen('n', 3, false);
    expect((await g.lokal.alleMerker()).map((m) => m.id).sort()).toEqual(['m:1', 'n:7']);
    await g.lokal.alleMerkerLoeschen();
    expect(await g.lokal.alleMerker()).toEqual([]);
  });
});

describe('Setlisten', () => {
  it('anlegen, Einträge in Reihenfolge (auch mehrfach), umbenennen, löschen', async () => {
    const id = await g.lokal.setlisteAnlegen('Konzert');
    expect(await g.lokal.setlisteHolen(id)).toMatchObject({ id, titel: 'Konzert', eintraege: [] });
    const eintraege = [
      { id: '1', art: 'stueck' as const, stueckId: 'a' },
      { id: '2', art: 'platzhalter' as const, titel: 'auswendig' },
      { id: '3', art: 'stueck' as const, stueckId: 'a' },
    ];
    await g.lokal.setlisteAendern(id, { eintraege });
    await g.lokal.setlisteAendern(id, { titel: 'Konzert Mai' });
    const s = await g.lokal.setlisteHolen(id);
    expect(s).toMatchObject({ titel: 'Konzert Mai', eintraege });
    expect(s?.aktualisiert).toBeTypeOf('number');
    await g.lokal.setlisteLoeschen(id);
    expect(await g.lokal.alleSetlisten()).toEqual([]);
  });
});

describe('Verbindung', () => {
  it('öffnet nach der Rückkehr in die App frisch und arbeitet weiter', async () => {
    g = await neuesGeraet({ mitDokument: true });
    const id = await anlegen('A');
    const oeffnen = vi.spyOn(indexedDB, 'open');
    await g.lokal.stueckHolen(id);
    expect(oeffnen).not.toHaveBeenCalled(); // eine Verbindung für die ganze Seite
    g.sichtbar!('hidden');
    g.sichtbar!('visible');
    await g.lokal.stueckAendern(id, { titel: 'B' });
    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect((await g.lokal.stueckHolen(id))?.titel).toBe('B');
  });

  it('versucht es nach verlorener Verbindung einmal mit einer frischen', async () => {
    const id = await anlegen('A');
    const verloren = () => { throw Object.assign(new Error('Connection to Indexed Database server lost'), { name: 'UnknownError' }); };
    const transaktion = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(verloren);
    expect((await g.lokal.stueckHolen(id))?.titel).toBe('A');
    transaktion.mockImplementationOnce(verloren).mockImplementationOnce(verloren);
    await expect(g.lokal.stueckHolen(id)).rejects.toThrow(/lost/); // nur EIN neuer Versuch
    transaktion.mockRestore();
  });
});

describe('Sicherung von Gerät zu Gerät', () => {
  async function befuellen() {
    const a = await g.lokal.stueckAnlegen({ titel: 'Pomp', stimme: 'Klar 1', datei: pdf('pomp'), dateiname: 'pomp.pdf' });
    await g.lokal.stueckAendern(a, { blaettern: { modus: 'halb', linien: { 1: 0.3 } }, komponist: 'Elgar', tags: ['Marsch'] });
    const band = await anlegen('Sammelband', 'band');
    const v = await g.lokal.virtuellesAnlegen({ titel: 'Polka', stimme: '', quelle: { stueckId: band, von: 2, bis: 3 }, genre: 'Polka' });
    await g.lokal.stelleAnlegen(stelle(a, 1, 0.2, 'T. 1–4'));
    const [s] = await g.lokal.stellenVon(a);
    await g.lokal.stelleAendern(s.id, { zielTempo: 96, notiz: 'leise' });
    await g.lokal.tempoGeschafft(s.id, 80);
    await g.lokal.anmerkungenSpeichern(a, 1, [{ id: 't', art: 'text', farbe: '#000', groesse: 0.02, x: 0.5, y: 0.5, text: 'p' }, spur]);
    await g.lokal.anmerkungenSpeichern(band, 2, [strich]);
    const lz = await g.lokal.lesezeichenAnlegen({ stueckId: band, seite: 2, titel: 'Polka' });
    await g.lokal.merkerSetzen(v, 1, true);
    const sl = await g.lokal.setlisteAnlegen('Konzert');
    await g.lokal.setlisteAendern(sl, { eintraege: [
      { id: '1', art: 'stueck', stueckId: a }, { id: '2', art: 'stueck', stueckId: v },
      { id: '3', art: 'lesezeichen', lesezeichenId: lz }, { id: '4', art: 'platzhalter', titel: 'auswendig' },
    ] });
    return { a, band, v };
  }

  // Der ganze Bestand, wie er auf dem Gerät liegt, ohne Handles.
  const bestand = async () => {
    const sortiert = <T extends { id: string }>(l: T[]) => [...l].sort((x, y) => x.id.localeCompare(y.id));
    const a = await abzug('cheatsheet');
    return {
      ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, sortiert(v as { id: string }[])])),
      dateien: sortiert(a.dateien as { id: string; daten: ArrayBuffer; typ: string }[]).map((d) => ({ ...d, daten: text(d.daten) })),
    };
  };

  it('überträgt alles: Stücke samt Metadaten, virtuelle, Dateien, Stellen, Anmerkungen, Lesezeichen, Merker, Setlisten', async () => {
    await befuellen();
    const vorher = await bestand();
    const { datei, noten, fehlen } = await g.lokal.sicherungErstellen();
    expect(noten).toBe(3);
    expect(fehlen).toEqual([]);

    g = await neuesGeraet();
    const e = await g.lokal.sicherungPruefen(datei);
    expect(e.neu).toBe(3);
    expect(e.uebersprungen).toBe(0);
    await g.lokal.sicherungSchreiben(e);
    expect(await bestand()).toEqual(vorher);
    for (const s of await roh('stuecke')) expect(s).not.toHaveProperty('datei');
  });

  it('zweimal laden ergibt keine Dubletten und keine vorläufigen Reste', async () => {
    await befuellen();
    const { datei } = await g.lokal.sicherungErstellen();
    g = await neuesGeraet();
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    const einmal = await bestand();
    const zweite = await g.lokal.sicherungPruefen(datei);
    expect(zweite.ersetzt).toEqual({ lesezeichen: 1, merker: 1, setlisten: 1 });
    await g.lokal.sicherungSchreiben(zweite);
    expect(await bestand()).toEqual(einmal);
    expect((await roh('dateien')).every((d) => !String(d.id).startsWith('einspielen:'))).toBe(true);
  });

  it('lässt unlesbare Stücke weg — samt ihren virtuellen, Lesezeichen und Merkern', async () => {
    const { band, v } = await befuellen();
    await rohSchreiben('dateien', [{ id: band, daten: new TextEncoder().encode('kein pdf').buffer, typ: 'application/pdf' }]);
    const { datei, noten, fehlen } = await g.lokal.sicherungErstellen();
    expect(noten).toBe(1);
    expect(fehlen.map((s) => s.id).sort()).toEqual([band, v].sort());
    g = await neuesGeraet();
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect((await g.lokal.alleStuecke()).map((s) => s.titel)).toEqual(['Pomp']);
    expect(await roh('lesezeichen')).toEqual([]);
    expect(await roh('merker')).toEqual([]);
    expect(await roh('anmerkungen')).toHaveLength(1);
    // Die Setliste kommt mit, nur ohne die Einträge auf Weggelassenes.
    expect((await g.lokal.alleSetlisten())[0].eintraege.map((e) => e.id)).toEqual(['1', '4']);
  });

  it('erkennt eine falsche Datei', async () => {
    await expect(g.lokal.sicherungPruefen(new Blob(['hallo']))).rejects.toThrow(/Übe-Sicherung/);
  });
});

describe('Umstieg: Sicherungen im bisherigen Format', () => {
  // So hat die Fassung mit „ueben“ (bis Schema 3) gesichert: Noten mit allen
  // Feldern des Datensatzes, Stellen und Anmerkungen mit notenId, keine
  // weiteren Listen. Dasselbe schreibt die Registerführer-App.
  const alteSicherung = (quelle: string) => sicherungPacken({
    noten: [
      { id: 'n1', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, aktualisiert: 2, zuletzt: 3, dateiname: 'pomp.pdf',
        blaettern: { modus: 'linie' as const, linien: { 2: 0.4 } }, datei: pdf('pomp') },
      { id: 'n2', titel: 'Ärger mit Ümlauten', stimme: '', erstellt: 4, datei: pdf('zwei') },
    ],
    stellen: [{ id: 's1', notenId: 'n1', seite: 2, x: 0.1, y: 0.2, b: 0.3, h: 0.1, titel: 'T. 1–4', notiz: 'leise', zielTempo: 96, tempi: [{ tempo: 80, am: 5 }] }],
    anmerkungen: [{ id: 'n1:2', notenId: 'n1', seite: 2, objekte: [strich, spur] }],
  }, quelle, 1234);

  it.each(['cheatsheet', 'registerfuehrer'])('lädt eine Sicherung aus „%s“ vollständig ins neue Schema', async (quelle) => {
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(await alteSicherung(quelle)));
    expect(await g.lokal.stueckHolen('n1')).toEqual({ id: 'n1', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, aktualisiert: 2, zuletzt: 3, dateiname: 'pomp.pdf', blaettern: { modus: 'linie', linien: { 2: 0.4 } } });
    expect(await g.lokal.stueckHolen('n2')).toEqual({ id: 'n2', titel: 'Ärger mit Ümlauten', stimme: '', erstellt: 4 });
    expect(await (await g.lokal.stueckDatei({ id: 'n1' })).text()).toBe('%PDF-1.4 pomp');
    expect(await (await g.lokal.stueckDatei({ id: 'n2' })).text()).toBe('%PDF-1.4 zwei');
    expect(await g.lokal.stellenVon('n1')).toEqual([
      { id: 's1', stueckId: 'n1', seite: 2, x: 0.1, y: 0.2, b: 0.3, h: 0.1, titel: 'T. 1–4', notiz: 'leise', zielTempo: 96, tempi: [{ tempo: 80, am: 5 }] },
    ]);
    expect(await g.lokal.anmerkungenVon('n1')).toEqual([{ id: 'n1:2', stueckId: 'n1', seite: 2, objekte: [strich, spur] }]);
    for (const name of ['stellen', 'anmerkungen']) for (const e of await roh(name)) expect(e).not.toHaveProperty('notenId');
    expect(await roh('lesezeichen')).toEqual([]);
    expect(await roh('setlisten')).toEqual([]);
  });

  it('eine neue Sicherung bleibt für ältere Leser im bisherigen Zuschnitt', async () => {
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(await alteSicherung('cheatsheet')));
    const { kopf } = await sicherungLesen((await g.lokal.sicherungErstellen()).datei);
    expect(kopf.version).toBe(1);
    expect(kopf.stellen[0]).toMatchObject({ id: 's1', notenId: 'n1' });
    expect(kopf.stellen[0]).not.toHaveProperty('stueckId');
    expect(kopf.anmerkungen[0]).toMatchObject({ id: 'n1:2', notenId: 'n1' });
  });
});

// Mit echten Daten, nur lokal: CHEATSHEET_EXPORT=data-export/<datei>.uebe npm test
// Die Datei liegt nie im Repo (öffentlich; data-export/ steht in .gitignore).
const exportPfad = process.env.CHEATSHEET_EXPORT;
describe.skipIf(!exportPfad || !existsSync(exportPfad))('Umstieg mit einem echten Export', () => {
  it('kommt vollständig an und überlebt den Rundlauf', async () => {
    const datei = new Blob([readFileSync(exportPfad!)]);
    const { kopf, noten } = await sicherungLesen(datei);
    const e = await g.lokal.sicherungPruefen(datei);
    expect(e.uebersprungen).toBe(0);
    await g.lokal.sicherungSchreiben(e);
    expect(await roh('stuecke')).toHaveLength(noten.length + (kopf.virtuelle?.length ?? 0));
    expect(await roh('stellen')).toHaveLength(kopf.stellen.length);
    expect(await roh('anmerkungen')).toHaveLength(kopf.anmerkungen.length);
    for (const n of noten) {
      const gespeichert = new Uint8Array(await (await g.lokal.stueckDatei({ id: n.id })).arrayBuffer());
      expect(Buffer.compare(gespeichert, new Uint8Array(await n.datei.arrayBuffer())), `PDF von „${String(n.titel)}“`).toBe(0);
    }
    const nochmal = await sicherungLesen((await g.lokal.sicherungErstellen()).datei);
    expect(nochmal.kopf.stellen).toEqual(expect.arrayContaining(kopf.stellen));
    expect(nochmal.kopf.anmerkungen).toEqual(expect.arrayContaining(kopf.anmerkungen));
  }, 120_000);
});
