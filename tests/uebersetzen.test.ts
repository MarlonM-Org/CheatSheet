import { describe, expect, it } from 'vitest';
import type { Setliste } from '@/domain/bestand';
import { ohneFehlende, vonSicherung, zurSicherung } from '@/domain/uebersetzen';

describe('Zwischen Sicherung und Gerät übersetzen', () => {
  const stelle = { id: 's', stueckId: 'a', seite: 1, x: 0, y: 0, b: 1, h: 1, titel: 'T. 1', notiz: '', zielTempo: null, tempi: [{ tempo: 80, am: 1 }] };

  it('Stellen und Anmerkungen hin und zurück ohne Verlust', () => {
    const datei = zurSicherung(stelle);
    expect(datei).toEqual({ ...{ id: 's', seite: 1, x: 0, y: 0, b: 1, h: 1, titel: 'T. 1', notiz: '', zielTempo: null, tempi: [{ tempo: 80, am: 1 }] }, notenId: 'a' });
    expect('stueckId' in datei).toBe(false);
    expect(vonSicherung(datei)).toEqual(stelle);
    const seite = { id: 'a:2', notenId: 'a', seite: 2, objekte: [] };
    expect(vonSicherung(seite)).toEqual({ id: 'a:2', stueckId: 'a', seite: 2, objekte: [] });
  });
});

describe('Vor dem Packen: was an fehlenden Stücken hängt', () => {
  const v = (id: string, quelle: string) => ({ id, titel: id, stimme: '', erstellt: 1, quelle: { stueckId: quelle, von: 1, bis: 2 } });
  const setliste: Setliste = { id: 'sl', titel: 'Konzert', erstellt: 1, eintraege: [
    { id: '1', art: 'stueck', stueckId: 'gut' },
    { id: '2', art: 'stueck', stueckId: 'kaputt' },
    { id: '3', art: 'stueck', stueckId: 'v-kaputt' },
    { id: '4', art: 'lesezeichen', lesezeichenId: 'lz-kaputt' },
    { id: '5', art: 'lesezeichen', lesezeichenId: 'lz-gut' },
    { id: '6', art: 'platzhalter', titel: 'auswendig' },
  ] };
  const zusatz = {
    virtuelle: [v('v-gut', 'gut'), v('v-kaputt', 'kaputt')],
    lesezeichen: [{ id: 'lz-gut', stueckId: 'gut', seite: 1, titel: '', erstellt: 1 }, { id: 'lz-kaputt', stueckId: 'v-kaputt', seite: 1, titel: '', erstellt: 1 }],
    merker: [{ id: 'gut:1', stueckId: 'gut', seite: 1, gesetzt: 1 }, { id: 'kaputt:1', stueckId: 'kaputt', seite: 1, gesetzt: 1 }],
    setlisten: [setliste, { id: 'ruhig', titel: 'Ruhig', erstellt: 1, eintraege: [{ id: '1', art: 'stueck' as const, stueckId: 'gut' }] }],
  };

  it('nimmt virtuelle Stücke, Lesezeichen, Merker und Einträge mit heraus; Setlisten bleiben', () => {
    const { zusatz: z, fehlenVirtuelle } = ohneFehlende(zusatz, new Set(['kaputt']));
    expect(fehlenVirtuelle.map((x) => x.id)).toEqual(['v-kaputt']);
    expect(z.virtuelle.map((x) => x.id)).toEqual(['v-gut']);
    expect(z.lesezeichen.map((x) => x.id)).toEqual(['lz-gut']);
    expect(z.merker.map((x) => x.id)).toEqual(['gut:1']);
    expect(z.setlisten[0].eintraege.map((e) => e.id)).toEqual(['1', '5', '6']);
    expect(z.setlisten[0].aktualisiert).toBeUndefined(); // packen ändert nichts am Bestand
    expect(z.setlisten[1]).toBe(zusatz.setlisten[1]);
  });

  it('ohne fehlende Stücke bleibt alles, wie es ist', () => {
    const { zusatz: z, fehlenVirtuelle } = ohneFehlende(zusatz, new Set());
    expect(fehlenVirtuelle).toEqual([]);
    expect(z).toEqual(zusatz);
  });
});
