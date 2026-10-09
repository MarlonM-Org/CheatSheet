import { describe, expect, it } from 'vitest';
import { nurLesbare, pdfLesbar } from '@/domain/lesbar';

const pdf = (inhalt: string) => new Blob([`%PDF-1.4 ${inhalt}`], { type: 'application/pdf' });
// Ein Blob, den der Browser nicht mehr lesen kann (Safari nach geschlossener Verbindung).
class KaputterBlob extends Blob {
  override slice(): Blob { throw new DOMException('Blob nicht lesbar', 'NotReadableError'); }
}
const noten = (id: string, datei: unknown) => ({ id, titel: id, stimme: '', erstellt: 1, datei });

describe('Übe-Sicherung: nur lesbare Noten', () => {
  it('erkennt PDFs am Anfang der Datei', async () => {
    expect(await pdfLesbar(pdf('x'))).toBe(true);
    expect(await pdfLesbar(new Blob(['<html>']))).toBe(false);
    expect(await pdfLesbar(new Blob([]))).toBe(false);
    expect(await pdfLesbar(undefined)).toBe(false);
    expect(await pdfLesbar({})).toBe(false);
    expect(await pdfLesbar(new KaputterBlob(['%PDF-1.4']))).toBe(false);
  });

  it('erkennt PDFs mit Vorspann innerhalb der ersten 1024 Bytes', async () => {
    expect(await pdfLesbar(new Blob(['\r\n\u0000Vorspann\n%PDF-1.7 x']))).toBe(true);
    expect(await pdfLesbar(new Blob(['x'.repeat(1019), '%PDF-1.7']))).toBe(true);
    expect(await pdfLesbar(new Blob(['x'.repeat(1020), '%PDF-1.7']))).toBe(false);
    expect(await pdfLesbar(new Blob(['Vorspann %PDF ohne Strich']))).toBe(false);
  });

  it('lässt nicht lesbare Noten samt Stellen und Anmerkungen weg', async () => {
    const { bestand, fehlen } = await nurLesbare({
      noten: [noten('gut', pdf('eins')), noten('kaputt', new KaputterBlob(['%PDF'])), noten('fehlt', undefined)],
      stellen: [{ id: 's1', notenId: 'gut' }, { id: 's2', notenId: 'kaputt' }],
      anmerkungen: [{ id: 'gut:1', notenId: 'gut' }, { id: 'fehlt:1', notenId: 'fehlt' }],
    });
    expect(bestand.noten.map((n) => n.id)).toEqual(['gut']);
    expect(bestand.stellen.map((s) => s.id)).toEqual(['s1']);
    expect(bestand.anmerkungen.map((a) => a.id)).toEqual(['gut:1']);
    expect(fehlen.map((n) => n.titel)).toEqual(['kaputt', 'fehlt']);
  });

  it('gibt den Bestand unverändert zurück, wenn alles lesbar ist', async () => {
    const bestand = { noten: [noten('a', pdf('a'))], stellen: [], anmerkungen: [] };
    const r = await nurLesbare(bestand);
    expect(r.bestand).toBe(bestand);
    expect(r.fehlen).toEqual([]);
  });
});
