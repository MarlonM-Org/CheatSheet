import { describe, expect, it } from 'vitest';
import { einstellungenLesen } from '@/domain/einstellungen';
import { keinZusatz, sicherungLesen, sicherungPacken, sicherungsName, SicherungsFehler } from '@/domain/sicherung';

const pdf = (inhalt: string) => new Blob([`%PDF-1.4 ${inhalt}`], { type: 'application/pdf' });

describe('Übe-Sicherung', () => {
  const inhalt = {
    noten: [
      { id: 'a', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, datei: pdf('eins'), handle: { nicht: 'übertragbar' }, blaettern: { modus: 'halb', linien: { 1: 0.3 }, jeSeite: { 2: 'ganz' } },
        spruenge: [{ id: 'j1', von: { seite: 3, x: 0.5, y: 0.4 }, nach: { seite: 1, x: 0.1, y: 0.3 }, art: 'ds' }] },
      { id: 'b', titel: 'Ärger mit Ümlauten', stimme: '', erstellt: 2, datei: pdf('zwei, etwas länger') },
    ],
    stellen: [{ id: 's1', notenId: 'a', seite: 1, x: 0.1, y: 0.2, b: 0.3, h: 0.1, titel: 'T. 1–4', notiz: '', zielTempo: 96, tempi: [{ tempo: 80, am: 5 }] }],
    anmerkungen: [{ id: 'a:1', notenId: 'a', seite: 1, objekte: [{ id: 'x', art: 'text', farbe: '#000', groesse: 0.02, x: 0.5, y: 0.5, text: 'leise' }] }],
  };

  it('überträgt Noten, Dateien, Stellen und Anmerkungen verlustfrei', async () => {
    const datei = await sicherungPacken(inhalt, 'registerfuehrer', 1234);
    const { kopf, noten } = await sicherungLesen(datei);
    expect(kopf.quelle).toBe('registerfuehrer');
    expect(kopf.erstellt).toBe(1234);
    expect(kopf.stellen).toEqual(inhalt.stellen);
    expect(kopf.anmerkungen).toEqual(inhalt.anmerkungen);
    expect(noten.map((n) => n.titel)).toEqual(['Pomp', 'Ärger mit Ümlauten']);
    expect(noten[0].blaettern).toEqual({ modus: 'halb', linien: { 1: 0.3 }, jeSeite: { 2: 'ganz' } });
    // Sprünge (F-05) reisen als Feld am Stück mit.
    expect(noten[0].spruenge).toEqual([{ id: 'j1', von: { seite: 3, x: 0.5, y: 0.4 }, nach: { seite: 1, x: 0.1, y: 0.3 }, art: 'ds' }]);
    expect(await noten[0].datei.text()).toBe('%PDF-1.4 eins');
    expect(await noten[1].datei.text()).toBe('%PDF-1.4 zwei, etwas länger');
    expect(noten[0].datei.type).toBe('application/pdf');
  });

  it('lässt den Dateiverweis weg', async () => {
    const { noten } = await sicherungLesen(await sicherungPacken(inhalt, 'x', 0));
    expect('handle' in noten[0]).toBe(false);
  });

  it('geht auch ganz leer', async () => {
    const { kopf, noten } = await sicherungLesen(await sicherungPacken({ noten: [], stellen: [], anmerkungen: [] }, 'x', 0));
    expect(noten).toEqual([]);
    expect(kopf.stellen).toEqual([]);
  });

  it('erkennt fremde, abgeschnittene und verlängerte Dateien', async () => {
    await expect(sicherungLesen(pdf('kein Backup'))).rejects.toThrow(SicherungsFehler);
    const gut = await sicherungPacken(inhalt, 'x', 0);
    await expect(sicherungLesen(gut.slice(0, gut.size - 3))).rejects.toThrow(/unvollständig/);
    await expect(sicherungLesen(new Blob([gut, 'xx']))).rejects.toThrow(/am Ende/);
    await expect(sicherungLesen(gut.slice(0, 20))).rejects.toThrow(/Kopf/);
  });

  it('trägt Grabsteine und Tags im Kopf mit — ohne sie bleibt der Kopf wie bisher', async () => {
    const leer = { noten: [], stellen: [], anmerkungen: [] };
    const profil = { id: 'p', am: 3, stimmung: 'B', kammerton: 442, toene: [{ midi: 60, cent: 4 }] };
    const mit = await sicherungLesen(await sicherungPacken(leer, 'test', 1, { geloescht: [{ art: 'noten', id: 'x', am: 5 }], tags: [{ id: 't', name: 'Solo', farbe: 'blau', geaendert: 1 }], tonprofile: [profil] }));
    expect(mit.kopf.tonprofile).toEqual([profil]);
    expect(mit.kopf.geloescht).toEqual([{ art: 'noten', id: 'x', am: 5 }]);
    expect(mit.kopf.tags).toEqual([{ id: 't', name: 'Solo', farbe: 'blau', geaendert: 1 }]);
    const ohne = await sicherungLesen(await sicherungPacken(leer, 'test', 1));
    expect('geloescht' in ohne.kopf || 'tags' in ohne.kopf).toBe(false);
  });

  it('trägt persönliche Einstellungen im Kopf mit', async () => {
    const leer = { noten: [], stellen: [], anmerkungen: [] };
    const einstellungen = { stand: 1760000000000, werte: { 'stimm:st': 'Es', 'stimm:a': 443, 'metro:klang': 'glocke', 'ueben:stift': { farbe: '#d12d2d', breite: 0.004 } } };
    const mit = await sicherungLesen(await sicherungPacken(leer, 'cheatsheet', 1, { einstellungen }));
    expect(mit.kopf.einstellungen).toEqual(einstellungen);
    expect(einstellungenLesen(mit.kopf.einstellungen)).toEqual(einstellungen);
    // ohne Einstellungen, oder ohne einen Wert: kein Feld
    const ohne = await sicherungLesen(await sicherungPacken(leer, 'cheatsheet', 1));
    expect('einstellungen' in ohne.kopf).toBe(false);
    expect(einstellungenLesen(ohne.kopf.einstellungen)).toBeNull();
    const leereWerte = await sicherungLesen(await sicherungPacken(leer, 'cheatsheet', 1, { einstellungen: { stand: 5, werte: {} } }));
    expect('einstellungen' in leereWerte.kopf).toBe(false);
  });

  it('lädt eine alte Datei ohne die neuen Felder (z. B. aus dem Registerführer)', async () => {
    const datei = new TextEncoder().encode('%PDF-1.4 alt');
    const kopf = new TextEncoder().encode(JSON.stringify({
      version: 1, erstellt: 99, quelle: 'registerfuehrer',
      noten: [{ id: 'n', titel: 'Alt', stimme: '', erstellt: 1, groesse: datei.byteLength, typ: 'application/pdf' }],
      stellen: [{ id: 's', notenId: 'n', seite: 1 }], anmerkungen: [],
    }));
    const vorspann = new Uint8Array(9);
    vorspann.set([0x55, 0x45, 0x42, 0x45], 0);
    vorspann[4] = 1;
    new DataView(vorspann.buffer).setUint32(5, kopf.byteLength, false);
    const { kopf: k, noten } = await sicherungLesen(new Blob([vorspann, kopf, datei]));
    expect(noten.map((n) => n.titel)).toEqual(['Alt']);
    expect(await noten[0].datei.text()).toBe('%PDF-1.4 alt');
    expect(k.stellen).toHaveLength(1);
    expect(einstellungenLesen(k.einstellungen)).toBeNull();
  });

  it('kaputtes Einstellungs-Feld: Datei lädt, Einstellungen bleiben weg', async () => {
    const leer = { noten: [], stellen: [], anmerkungen: [] };
    const datei = await sicherungPacken(leer, 'fremd', 1, { einstellungen: { stand: 5, werte: { 'stimm:a': 'sehr hoch', 'ueben:modus': 'dunkel' } } });
    const { kopf } = await sicherungLesen(datei);
    expect(einstellungenLesen(kopf.einstellungen)).toBeNull();
  });

  it('benennt die Datei mit Datum und Uhrzeit', () => {
    expect(sicherungsName(new Date(2026, 9, 9, 18, 5))).toBe('Uebe-Sicherung 2026-10-09 18.05.uebe');
  });
});

// Ein Kopf von Hand, um auch Dateien zu bauen, die sicherungPacken nie schreibt.
function rohDatei(kopf: object, ...pdfs: Blob[]): Blob {
  const json = new TextEncoder().encode(JSON.stringify(kopf));
  const vorspann = new Uint8Array(9);
  vorspann.set([0x55, 0x45, 0x42, 0x45], 0);
  vorspann[4] = 1;
  new DataView(vorspann.buffer).setUint32(5, json.byteLength, false);
  return new Blob([vorspann, json, ...pdfs]);
}

describe('Übe-Sicherung: optionale Listen (seit „cheatsheet“)', () => {
  const noten = [{ id: 'band', titel: 'Sammelband', stimme: '', erstellt: 1, datei: pdf('band') }];
  const zusatz = {
    virtuelle: [{ id: 'v', titel: 'Marsch', stimme: '', erstellt: 2, quelle: { stueckId: 'band', von: 3, bis: 5 }, handle: { nicht: 'übertragbar' } }],
    lesezeichen: [{ id: 'lz', stueckId: 'band', seite: 3, titel: 'Marsch', erstellt: 3 }],
    merker: [{ id: 'band:4', stueckId: 'band', seite: 4, gesetzt: 4 }],
    setlisten: [{ id: 'sl', titel: 'Konzert', erstellt: 5, eintraege: [{ id: 'e', art: 'stueck', stueckId: 'v' }] }],
  };

  it('überträgt sie im Kopf; der Datenteil gehört nur den Noten', async () => {
    const datei = await sicherungPacken({ noten, stellen: [], anmerkungen: [] }, 'cheatsheet', 7, zusatz);
    const { kopf, noten: gelesen } = await sicherungLesen(datei);
    expect(kopf.version).toBe(1);
    const { handle: _h, ...virtuell } = zusatz.virtuelle[0];
    void _h;
    expect(kopf.virtuelle).toEqual([virtuell]);
    expect(kopf.lesezeichen).toEqual(zusatz.lesezeichen);
    expect(kopf.merker).toEqual(zusatz.merker);
    expect(kopf.setlisten).toEqual(zusatz.setlisten);
    expect(gelesen).toHaveLength(1);
    expect(await gelesen[0].datei.text()).toBe('%PDF-1.4 band');
  });

  it('ohne sie wie bisher (Registerführer, ältere Fassungen)', async () => {
    const { kopf } = await sicherungLesen(await sicherungPacken({ noten, stellen: [], anmerkungen: [] }, 'registerfuehrer', 7));
    for (const k of ['virtuelle', 'lesezeichen', 'merker', 'setlisten'] as const) expect(kopf[k]).toBeUndefined();
    // Leere Listen schreibt die Sicherung gar nicht erst.
    const leer = await sicherungLesen(await sicherungPacken({ noten: [], stellen: [], anmerkungen: [] }, 'x', 0, keinZusatz()));
    expect(leer.kopf.setlisten).toBeUndefined();
  });

  it('eine Liste, die keine ist, macht die Sicherung kaputt', async () => {
    const kopf = { version: 1, erstellt: 0, quelle: 'x', noten: [], stellen: [], anmerkungen: [] };
    await expect(sicherungLesen(rohDatei({ ...kopf, virtuelle: 5 }))).rejects.toThrow(/beschädigt/);
    await expect(sicherungLesen(rohDatei({ ...kopf, setlisten: {} }))).rejects.toThrow(/beschädigt/);
    await expect(sicherungLesen(rohDatei({ ...kopf, merker: null }))).rejects.toThrow(/beschädigt/);
    await expect(sicherungLesen(rohDatei({ ...kopf, lesezeichen: [] }))).resolves.toBeTruthy();
  });
});
