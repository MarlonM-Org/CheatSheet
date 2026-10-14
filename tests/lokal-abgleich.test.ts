// Tags ohne Doppelte und persönliche Einstellungen über die Sicherung — die
// Speicherschicht gegen einen echten Gerätespeicher (fake-indexeddb).
import { beforeEach, describe, expect, it } from 'vitest';
import { neuesGeraet, pdf, type Geraet } from './hilfen/geraet';

let g: Geraet;
beforeEach(async () => {
  g = await neuesGeraet();
  // Metronom & Co. hören im Browser auf ein Ereignis am window.
  (globalThis as unknown as { dispatchEvent: () => boolean }).dispatchEvent = () => true;
});

const anlegen = (titel: string) => g.lokal.stueckAnlegen({ titel, stimme: '', datei: pdf(titel) });
const ueberSicherung = async () => {
  const { datei } = await g.lokal.sicherungErstellen();
  return datei;
};

describe('Tags über die Sicherung', () => {
  it('gleichnamige Tags zweier Geräte werden ein Tag; die Stücke tragen die hiesige id', async () => {
    const tagA = g.lokal.tagAnlegen('Wichtig üben', 'rot');
    const a = await anlegen('Pomp');
    await g.lokal.tagsSetzen([{ id: a, tags: [tagA.id] }]);
    const datei = await ueberSicherung();

    g = await neuesGeraet();
    const tagB = g.lokal.tagAnlegen('wichtig  üben', 'blau');
    const b = await anlegen('Scan');
    await g.lokal.tagsSetzen([{ id: b, tags: [tagB.id] }]);
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));

    const tags = g.lokal.tagsLaden();
    expect(tags.map((t) => ({ id: t.id, auch: t.auch }))).toEqual([{ id: tagB.id, auch: [tagA.id] }]);
    expect((await g.lokal.alleStuecke()).map((s) => s.tags)).toEqual([[tagB.id], [tagB.id]]);
  });

  it('der gemerkte Tag-Filter zeigt danach auf den bleibenden Tag', async () => {
    const tagA = g.lokal.tagAnlegen('Solo', 'blau');
    await anlegen('Pomp');
    const datei = await ueberSicherung();
    g = await neuesGeraet();
    const tagB = g.lokal.tagAnlegen('Solo', 'blau');
    await anlegen('Scan');
    localStorage.setItem('ueben:tag', JSON.stringify(tagB.id));
    await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect(JSON.parse(localStorage.getItem('ueben:tag')!)).toBe(tagB.id);
    expect(g.lokal.tagsLaden()[0].auch).toEqual([tagA.id]);
  });

  it('Doppelte auf dem Gerät lassen sich ohne Sicherung zusammenführen (es bleibt die id mit den meisten Stücken)', async () => {
    const x = await anlegen('A'), y = await anlegen('B'), z = await anlegen('C');
    localStorage.setItem('ueben:tags', JSON.stringify([
      { id: 't1', name: 'Kann ich', farbe: 'gruen', geaendert: 1 },
      { id: 't2', name: 'kann ich', farbe: 'gruen', geaendert: 2 },
    ]));
    await g.lokal.tagsSetzen([{ id: x, tags: ['t1'] }, { id: y, tags: ['t2'] }, { id: z, tags: ['t2'] }]);
    expect(await g.lokal.doppelteZusammenfuehren()).toBe(1);
    expect(g.lokal.tagsLaden().map((t) => t.id)).toEqual(['t2']);
    expect((await g.lokal.alleStuecke()).map((s) => s.tags)).toEqual([['t2'], ['t2'], ['t2']]);
  });

  it('einen vorhandenen Namen anlegen liefert den vorhandenen Tag; umbenennen darauf geht nicht', () => {
    const a = g.lokal.tagAnlegen('Wichtig üben', 'rot');
    expect(g.lokal.tagAnlegen('WICHTIG ÜBEN', 'blau')).toEqual(a);
    const b = g.lokal.tagAnlegen('Solo', 'blau');
    expect(g.lokal.tagAendern(b.id, { name: 'wichtig üben' })).toBe(false);
    expect(g.lokal.tagAendern(b.id, { name: 'Solo', farbe: 'lila' })).toBe(true);
    expect(g.lokal.tagsLaden().find((t) => t.id === b.id)?.farbe).toBe('lila');
  });
});

describe('Einstellungen über die Sicherung', () => {
  it('neuere reisen mit (ohne Hell/Dunkel), ältere überschreiben nichts', async () => {
    localStorage.setItem('stimm:a', '443');
    localStorage.setItem('stimm:st', '"Es"');
    localStorage.setItem('ueben:modus', '"dunkel"');
    localStorage.setItem('ueben:einstellungen-geaendert', '1000');
    await anlegen('Pomp');
    const datei = await ueberSicherung();

    g = await neuesGeraet();
    const ergebnis = await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect(ergebnis.einstellungen).toBe(true);
    expect(localStorage.getItem('stimm:a')).toBe('443');
    expect(localStorage.getItem('stimm:st')).toBe('"Es"');
    expect(localStorage.getItem('ueben:modus')).toBeNull();

    // Hier danach geändert (neuer): die alte Sicherung ändert nichts mehr.
    localStorage.setItem('stimm:a', '441');
    localStorage.setItem('ueben:einstellungen-geaendert', '2000');
    const nochmal = await g.lokal.sicherungSchreiben(await g.lokal.sicherungPruefen(datei));
    expect(nochmal.einstellungen).toBe(false);
    expect(localStorage.getItem('stimm:a')).toBe('441');
  });
});
