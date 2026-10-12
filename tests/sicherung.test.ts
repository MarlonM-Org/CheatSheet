import { describe, expect, it } from 'vitest';
import { sicherungLesen, sicherungPacken, sicherungsName, SicherungsFehler } from '@/domain/sicherung';

const pdf = (inhalt: string) => new Blob([`%PDF-1.4 ${inhalt}`], { type: 'application/pdf' });

describe('Übe-Sicherung', () => {
  const inhalt = {
    noten: [
      { id: 'a', titel: 'Pomp', stimme: 'Klar 1', erstellt: 1, datei: pdf('eins'), handle: { nicht: 'übertragbar' }, blaettern: { modus: 'halb', linien: { 1: 0.3 } } },
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
    expect(noten[0].blaettern).toEqual({ modus: 'halb', linien: { 1: 0.3 } });
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

  it('benennt die Datei mit Datum und Uhrzeit', () => {
    expect(sicherungsName(new Date(2026, 9, 9, 18, 5))).toBe('Uebe-Sicherung 2026-10-09 18.05.uebe');
  });
});
