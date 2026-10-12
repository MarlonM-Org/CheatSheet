// Ist-Zustand der Speicherschicht (Schema 3) festgehalten, bevor das Schema
// wechselt (A-02/A-03). Diese Tests beschreiben, was lokal.ts leisten muss —
// nicht, wie es das tut; sie gelten auch für jedes neue Schema.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  altesGeraetAnlegen, neuesGeraet, pdf, roh, rohOeffnen, rohSchreiben, schemaVon, text, type Geraet,
} from './hilfen/geraet';
import { IDBDatabase } from 'fake-indexeddb';

let g: Geraet;
beforeEach(async () => { g = await neuesGeraet(); });

const stelle = (notenId: string, seite: number, y: number, titel = 'T. 1') =>
  ({ notenId, seite, x: 0.1, y, b: 0.3, h: 0.1, titel });

describe('Schema 3', () => {
  it('legt auf einem leeren Gerät alle Speicher mit ihren Indizes an', async () => {
    await g.lokal.alleNoten();
    expect(await schemaVon()).toEqual({
      version: 3,
      speicher: {
        noten: { schluessel: 'id', indizes: [] },
        stellen: { schluessel: 'id', indizes: ['notenId'] },
        anmerkungen: { schluessel: 'id', indizes: ['notenId'] },
        dateien: { schluessel: 'id', indizes: [] },
      },
    });
  });

  it.each([1, 2] as const)('hebt ein Gerät mit Schema %i an, ohne Daten zu verlieren', async (stand) => {
    await altesGeraetAnlegen(stand, {
      noten: [{ id: 'n1', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, datei: pdf('alt'), dateiname: 'pomp.pdf' }],
      stellen: [{ id: 's1', ...stelle('n1', 2, 0.5), notiz: 'leise', zielTempo: 96, tempi: [{ tempo: 80, am: 5 }] }],
    });
    expect(await g.lokal.alleNoten()).toHaveLength(1);
    expect((await schemaVon()).version).toBe(3);
    const [n] = await g.lokal.alleNoten();
    expect(n).toMatchObject({ id: 'n1', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, dateiname: 'pomp.pdf' });
    expect(await (await g.lokal.notenDatei(n)).text()).toBe('%PDF-1.4 alt');
    expect(await g.lokal.stellenVon('n1')).toEqual([
      { id: 's1', ...stelle('n1', 2, 0.5), notiz: 'leise', zielTempo: 96, tempi: [{ tempo: 80, am: 5 }] },
    ]);
    expect(await g.lokal.anmerkungenVon('n1')).toEqual([]);
  });

  it('meldet ein blockiertes Anheben, solange ein altes Fenster die Verbindung hält', async () => {
    await altesGeraetAnlegen(2, {});
    const altesFenster = await rohOeffnen(); // gibt bei versionchange nicht frei
    await expect(g.lokal.alleNoten()).rejects.toThrow(/blockiert/);
    altesFenster.close();
  });
});

describe('Noten', () => {
  it('legt den Datensatz ohne Blob und die Datei als Bytes in „dateien“ ab', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'Pomp', stimme: 'Klar 1', datei: pdf('eins'), dateiname: 'pomp.pdf' });
    const [n] = await roh('noten');
    expect(n).toMatchObject({ id, titel: 'Pomp', stimme: 'Klar 1', dateiname: 'pomp.pdf' });
    expect(n).not.toHaveProperty('datei');
    expect(typeof n.erstellt).toBe('number');
    const [d] = await roh<{ id: string; daten: ArrayBuffer; typ: string }>('dateien');
    expect(d.id).toBe(id);
    expect(d.daten).toBeInstanceOf(ArrayBuffer);
    expect(text(d.daten)).toBe('%PDF-1.4 eins');
    expect(d.typ).toBe('application/pdf');
  });

  it('liefert die Datei aus „dateien“', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('eins') });
    const n = await g.lokal.notenHolen(id);
    const datei = await g.lokal.notenDatei(n!);
    expect(datei.type).toBe('application/pdf');
    expect(await datei.text()).toBe('%PDF-1.4 eins');
  });

  it('zieht die Datei eines älteren Stücks beim Lesen nach „dateien“ um', async () => {
    await altesGeraetAnlegen(3, { noten: [{ id: 'alt', titel: 'Alt', stimme: '', erstellt: 1, datei: pdf('blob') }] });
    const n = await g.lokal.notenHolen('alt');
    expect(n?.datei).toBeInstanceOf(Blob);
    expect(await (await g.lokal.notenDatei(n!)).text()).toBe('%PDF-1.4 blob');
    const [datensatz] = await roh('noten');
    expect(datensatz).not.toHaveProperty('datei');
    expect(datensatz).toMatchObject({ id: 'alt', titel: 'Alt' });
    const [d] = await roh<{ id: string; daten: ArrayBuffer }>('dateien');
    expect(d.id).toBe('alt');
    expect(text(d.daten)).toBe('%PDF-1.4 blob');
  });

  it('meldet eine verlorene Datei klar', async () => {
    await altesGeraetAnlegen(3, { noten: [{ id: 'weg', titel: 'Weg', stimme: '', erstellt: 1 }] });
    const n = await g.lokal.notenHolen('weg');
    await expect(g.lokal.notenDatei(n!)).rejects.toBeInstanceOf(g.lokal.DateiVerloren);
  });

  it('ändert Felder, ohne die Datei anzufassen', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('eins') });
    await g.lokal.notenAendern(id, { titel: 'B', blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    const n = await g.lokal.notenHolen(id);
    expect(n).toMatchObject({ id, titel: 'B', blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    expect(await (await g.lokal.notenDatei(n!)).text()).toBe('%PDF-1.4 eins');
  });

  it('ersetzt die Datei, der Datensatz bleibt ohne Blob', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('eins') });
    await g.lokal.notenAendern(id, { datei: pdf('zwei'), dateiname: 'neu.pdf' });
    const [n] = await roh('noten');
    expect(n).not.toHaveProperty('datei');
    expect(n.dateiname).toBe('neu.pdf');
    expect(await (await g.lokal.notenDatei((await g.lokal.notenHolen(id))!)).text()).toBe('%PDF-1.4 zwei');
  });

  it('zieht ein älteres Stück beim Ändern mit um', async () => {
    await altesGeraetAnlegen(3, { noten: [{ id: 'alt', titel: 'Alt', stimme: '', erstellt: 1, datei: pdf('blob') }] });
    await g.lokal.notenAendern('alt', { titel: 'Neu' });
    const [n] = await roh('noten');
    expect(n).toMatchObject({ id: 'alt', titel: 'Neu' });
    expect(n).not.toHaveProperty('datei');
    expect(text((await roh<{ daten: ArrayBuffer }>('dateien'))[0].daten)).toBe('%PDF-1.4 blob');
  });

  it('ändert nichts an einem Stück, das es nicht gibt', async () => {
    await g.lokal.notenAendern('gibtsnicht', { titel: 'X' });
    expect(await g.lokal.alleNoten()).toEqual([]);
  });

  it('löscht ein Stück samt Datei, Stellen und Anmerkungen — andere bleiben', async () => {
    const a = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('a') });
    const b = await g.lokal.notenAnlegen({ titel: 'B', stimme: '', datei: pdf('b') });
    for (const id of [a, b]) {
      await g.lokal.stelleAnlegen(stelle(id, 1, 0.2));
      await g.lokal.stelleAnlegen(stelle(id, 2, 0.2));
      await g.lokal.anmerkungenSpeichern(id, 1, [{ id: 'x', art: 'stift', farbe: '#000', breite: 2, punkte: [0, 0, 1, 1] }]);
    }
    await g.lokal.notenLoeschen(a);
    expect((await g.lokal.alleNoten()).map((n) => n.id)).toEqual([b]);
    expect((await roh('dateien')).map((d) => d.id)).toEqual([b]);
    expect(new Set((await roh('stellen')).map((s) => s.notenId))).toEqual(new Set([b]));
    expect((await roh('anmerkungen')).map((s) => s.notenId)).toEqual([b]);
    expect(await g.lokal.stellenVon(b)).toHaveLength(2);
  });

  it('merkt „zuletzt geöffnet“ auf dem Gerät, nicht in der Datenbank', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('a') });
    const vorher = await roh('noten');
    g.lokal.zuletztMerken(id);
    expect(g.lokal.zuletztListe()[id]).toBeTypeOf('number');
    expect(await roh('noten')).toEqual(vorher);
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
    expect(st[0]).toMatchObject({ notiz: '', zielTempo: null, tempi: [] });
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
  it('ein Datensatz je Seite mit Schlüssel „notenId:seite“, Speichern ersetzt die Seite', async () => {
    const strich = { id: 'x', art: 'stift' as const, farbe: '#000', breite: 2, punkte: [0, 0, 1, 1] };
    const spur = { id: 'r', art: 'radiert' as const, breite: 0.02, punkte: [0.5, 0.5] };
    await g.lokal.anmerkungenSpeichern('n', 1, [strich]);
    await g.lokal.anmerkungenSpeichern('n', 2, [spur]);
    await g.lokal.anmerkungenSpeichern('n', 1, [strich, spur]);
    await g.lokal.anmerkungenSpeichern('anders', 1, []);
    const seiten = (await g.lokal.anmerkungenVon('n')).sort((a, b) => a.seite - b.seite);
    expect(seiten).toEqual([
      { id: 'n:1', notenId: 'n', seite: 1, objekte: [strich, spur] },
      { id: 'n:2', notenId: 'n', seite: 2, objekte: [spur] },
    ]);
  });
});

describe('Verbindung', () => {
  it('öffnet nach der Rückkehr in die App frisch und arbeitet weiter', async () => {
    g = await neuesGeraet({ mitDokument: true });
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('a') });
    const oeffnen = vi.spyOn(indexedDB, 'open');
    await g.lokal.notenHolen(id);
    expect(oeffnen).not.toHaveBeenCalled(); // eine Verbindung für die ganze Seite
    g.sichtbar!('hidden');
    g.sichtbar!('visible');
    await g.lokal.notenAendern(id, { titel: 'B' });
    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect((await g.lokal.notenHolen(id))?.titel).toBe('B');
  });

  it('versucht es nach verlorener Verbindung einmal mit einer frischen', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('a') });
    const verloren = () => { throw Object.assign(new Error('Connection to Indexed Database server lost'), { name: 'UnknownError' }); };
    const transaktion = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(verloren);
    expect((await g.lokal.notenHolen(id))?.titel).toBe('A');
    transaktion.mockImplementationOnce(verloren).mockImplementationOnce(verloren);
    await expect(g.lokal.notenHolen(id)).rejects.toThrow(/lost/); // nur EIN neuer Versuch
    transaktion.mockRestore();
  });

  it('Datensatz und Datei ganz oder gar nicht: Scheitert einer, bleibt der alte Stand', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('alt') });
    // Eine Funktion lässt sich nicht speichern (DataCloneError) — die neue Datei darf dann auch nicht ankommen.
    await expect(g.lokal.notenAendern(id, { titel: 'B', datei: pdf('neu'), handle: (() => {}) as never })).rejects.toThrow();
    expect((await g.lokal.notenHolen(id))?.titel).toBe('A');
    expect(text((await roh<{ daten: ArrayBuffer }>('dateien'))[0].daten)).toBe('%PDF-1.4 alt');
  });

  it('löscht nur, was am Stück hängt', async () => {
    const id = await g.lokal.notenAnlegen({ titel: 'A', stimme: '', datei: pdf('a') });
    // Ohne notenId taucht ein Datensatz im Index nicht auf und bleibt unberührt.
    await rohSchreiben('anmerkungen', [{ id: 'fremd', seite: 1, objekte: [] }]);
    await g.lokal.notenLoeschen(id);
    expect(await roh('anmerkungen')).toEqual([{ id: 'fremd', seite: 1, objekte: [] }]);
  });
});

describe('Sicherung (.uebe) von Gerät zu Gerät', () => {
  async function befuellen() {
    const a = await g.lokal.notenAnlegen({ titel: 'Pomp', stimme: 'Klar 1', datei: pdf('pomp'), dateiname: 'pomp.pdf' });
    await g.lokal.notenAendern(a, { blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    await g.lokal.stelleAnlegen(stelle(a, 1, 0.2, 'T. 1–4'));
    const [s] = await g.lokal.stellenVon(a);
    await g.lokal.stelleAendern(s.id, { zielTempo: 96, notiz: 'leise' });
    await g.lokal.tempoGeschafft(s.id, 80);
    await g.lokal.anmerkungenSpeichern(a, 1, [
      { id: 't', art: 'text', farbe: '#000', groesse: 0.02, x: 0.5, y: 0.5, text: 'p' },
      { id: 'r', art: 'radiert', breite: 0.02, punkte: [0.1, 0.1] },
    ]);
    return a;
  }

  const bestand = async () => ({
    noten: (await g.lokal.alleNoten()).map((n) => ({ ...n })).sort((x, y) => x.id.localeCompare(y.id)),
    stellen: await roh('stellen'),
    anmerkungen: await roh('anmerkungen'),
  });

  it('überträgt Noten, Dateien, Stellen und Anmerkungen; PDFs nie als Blob', async () => {
    const a = await befuellen();
    const vorher = await bestand();
    const { datei, noten, fehlen } = await g.lokal.sicherungErstellen();
    expect(noten).toBe(1);
    expect(fehlen).toEqual([]);

    g = await neuesGeraet();
    const e = await g.lokal.sicherungPruefen(datei);
    expect(e.neu).toBe(1);
    await g.lokal.sicherungSchreiben(e);

    const nachher = await bestand();
    expect(nachher.stellen).toEqual(vorher.stellen);
    expect(nachher.anmerkungen).toEqual(vorher.anmerkungen);
    expect(nachher.noten).toHaveLength(1);
    expect(nachher.noten[0]).toMatchObject({ id: a, titel: 'Pomp', stimme: 'Klar 1', blaettern: { modus: 'halb', linien: { 1: 0.3 } } });
    for (const n of await roh('noten')) expect(n).not.toHaveProperty('datei');
    expect((await roh('dateien')).map((d) => d.id)).toEqual([a]);
    expect(await (await g.lokal.notenDatei(nachher.noten[0])).text()).toBe('%PDF-1.4 pomp');
  });

  it('zweimal laden ergibt keine Dubletten und keine vorläufigen Reste', async () => {
    await befuellen();
    const { datei } = await g.lokal.sicherungErstellen();
    g = await neuesGeraet();
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    const einmal = await bestand();
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect(await bestand()).toEqual(einmal);
    expect((await roh('dateien')).every((d) => !String(d.id).startsWith('einspielen:'))).toBe(true);
  });

  it('nimmt ältere Stücke mit Blob im Datensatz mit, lässt unlesbare weg', async () => {
    await altesGeraetAnlegen(3, {
      noten: [
        { id: 'alt', titel: 'Alt', stimme: '', erstellt: 1, datei: pdf('blob') },
        { id: 'kaputt', titel: 'Kaputt', stimme: '', erstellt: 2, datei: new Blob(['kein pdf']) },
        { id: 'weg', titel: 'Weg', stimme: '', erstellt: 3 },
      ],
      stellen: [{ id: 's', ...stelle('kaputt', 1, 0.1), notiz: '', zielTempo: null, tempi: [] }],
    });
    const { datei, noten, fehlen } = await g.lokal.sicherungErstellen();
    expect(noten).toBe(1);
    expect(fehlen.map((n) => n.id).sort()).toEqual(['kaputt', 'weg']);
    g = await neuesGeraet();
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect((await g.lokal.alleNoten()).map((n) => n.id)).toEqual(['alt']);
    expect(await roh('stellen')).toEqual([]);
  });

  it('erkennt eine falsche Datei', async () => {
    await expect(g.lokal.sicherungPruefen(new Blob(['hallo']))).rejects.toThrow(/Übe-Sicherung/);
  });
});
