import { describe, expect, it } from 'vitest';
import { ganzLesbar, nurLesbare, pdfLesbar } from '@/domain/lesbar';

const pdf = (inhalt: string) => new Blob([`%PDF-1.4 ${inhalt}`], { type: 'application/pdf' });
// Ein Blob, den der Browser nicht mehr lesen kann (Safari nach geschlossener Verbindung).
class KaputterBlob extends Blob {
  override slice(): Blob { throw new DOMException('Blob nicht lesbar', 'NotReadableError'); }
}
// Ein Blob, dessen Inhalt kürzer ist als angegeben (abgeschnittener Eintrag im
// Gerätespeicher) oder der beim Lesen mittendrin abbricht.
class GekuerzterBlob extends Blob {
  override stream(): ReadableStream<Uint8Array<ArrayBuffer>> { return new Blob([super.slice(0, this.size - 3)]).stream(); }
}
class AbbrechenderBlob extends Blob {
  override stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    let erster = true;
    return new ReadableStream({
      pull: (c) => {
        if (erster) { erster = false; c.enqueue(new Uint8Array(4)); } else c.error(new DOMException('weg', 'NotReadableError'));
      },
    });
  }
}
class LaengererBlob extends Blob {
  override stream(): ReadableStream<Uint8Array<ArrayBuffer>> { return new Blob([super.slice(), 'mehr']).stream(); }
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

  it('liest die ganze Datei und zählt die Bytes gegen die Größe', async () => {
    const gross = new Blob(['%PDF-1.7 ', new Uint8Array(3 * 1024 * 1024)]);
    expect(await ganzLesbar(gross)).toBe(true);
    expect(await ganzLesbar(new Blob([]))).toBe(true);
    expect(await ganzLesbar(new GekuerzterBlob(['%PDF-1.4 x']))).toBe(false);
    expect(await ganzLesbar(new AbbrechenderBlob(['%PDF-1.4 abc']))).toBe(false);
    expect(await ganzLesbar(new LaengererBlob(['%PDF-1.4 abc']))).toBe(false);
    // Kopf in Ordnung, Rest nicht: zählt als nicht lesbar.
    expect(await pdfLesbar(new GekuerzterBlob(['%PDF-1.4 x']))).toBe(false);
    expect(await pdfLesbar(new AbbrechenderBlob(['%PDF-1.4 abc']))).toBe(false);
  });

  it('lässt nicht lesbare Noten samt Stellen und Anmerkungen weg', async () => {
    const { bestand, fehlen } = await nurLesbare({
      noten: [noten('gut', pdf('eins')), noten('kaputt', new KaputterBlob(['%PDF'])), noten('fehlt', undefined), noten('gekuerzt', new GekuerzterBlob(['%PDF-1.4 zu kurz']))],
      stellen: [{ id: 's1', notenId: 'gut' }, { id: 's2', notenId: 'kaputt' }],
      anmerkungen: [{ id: 'gut:1', notenId: 'gut' }, { id: 'fehlt:1', notenId: 'fehlt' }],
    });
    expect(bestand.noten.map((n) => n.id)).toEqual(['gut']);
    expect(bestand.stellen.map((s) => s.id)).toEqual(['s1']);
    expect(bestand.anmerkungen.map((a) => a.id)).toEqual(['gut:1']);
    expect(fehlen.map((n) => n.titel)).toEqual(['kaputt', 'fehlt', 'gekuerzt']);
  });

  it('gibt den Bestand unverändert zurück, wenn alles lesbar ist', async () => {
    const bestand = { noten: [noten('a', pdf('a'))], stellen: [], anmerkungen: [] };
    const r = await nurLesbare(bestand);
    expect(r.bestand).toBe(bestand);
    expect(r.fehlen).toEqual([]);
  });
});
