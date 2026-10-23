'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { anmerkungsBefehle, hatMarkierungen } from '@/domain/ebene';
import type { Quelle } from '@/domain/bestand';
import { istNachladeFehler } from '@/domain/nachladen';
import { seitenInSicht, zurPdf, type Gliederungspunkt } from '@/domain/sicht';
import { dateiVerloren } from '@/domain/speicher';
import { DateiVerloren } from './lokal';

// Eine neuere Version ist ausgeliefert, und Code dieser Seite fehlt: neu laden.
export class NeueVersionFehler extends Error {
  constructor() { super('Neue Version verfügbar — bitte neu laden.'); }
}

// Name des Workers mit pdf.js-Version, beim Build aus next.config.ts eingesetzt.
const WORKER = process.env.PDF_WORKER as string;
// Ordner der Bild-Decoder (JBIG2, JPEG 2000) — ohne sie bleiben so
// gespeicherte Scans leer, nur Markierungen darüber wären zu sehen.
const DECODER = process.env.PDF_WASM as string;

// pdf.js erst im Browser laden (groß, braucht DOM). Worker liegt in public/.
export async function pdfLaden(datei: Blob): Promise<PDFDocumentProxy> {
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    throw new NeueVersionFehler();
  }
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  try {
    let daten: ArrayBuffer;
    try { daten = await datei.arrayBuffer(); } catch (x) { throw dateiVerloren(x) ? new DateiVerloren() : x; }
    return await pdfjs.getDocument({ data: new Uint8Array(daten), wasmUrl: DECODER }).promise;
  } catch (e) {
    throw istNachladeFehler(e) ? new NeueVersionFehler() : e;
  }
}

// Eine Seite als Bild der Breite px (Gerätepixel): die nackte Seite ohne die
// Anmerkungen des PDFs und — stecken Markierungen darin — deren Ebene zum
// Darüberlegen (ebene.ts). So lassen sich die Markierungen radieren.
export interface SeitenBild { seite: HTMLCanvasElement; ebene: HTMLCanvasElement | null }
export async function seiteMitEbene(pdf: Dokument, nr: number, px: number): Promise<SeitenBild> {
  return ausschnittRendern(pdf, nr, px, { x: 0, y: 0, b: 1, h: 1 }).bild;
}

// Nur ein Teil r der Seite (Anteile 0…1), die Seite in der Breite seitenPx
// gedacht — beim Zoomen (E-06) der sichtbare Teil in Bildschirmschärfe,
// statt die ganze Seite riesig zu rendern. Abbrechbar, wenn weitergezoomt wird.
export function ausschnittRendern(pdf: Dokument, nr: number, seitenPx: number, r: { x: number; y: number; b: number; h: number }) {
  const aufgaben: { cancel: () => void }[] = [];
  let abgebrochen = false;
  const merken = <T extends { cancel: () => void }>(t: T) => { aufgaben.push(t); if (abgebrochen) t.cancel(); return t; };
  const bild = (async (): Promise<SeitenBild> => {
    const { AnnotationMode, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const page = await pdf.getPage(nr);
    const v1 = page.getViewport({ scale: 1 });
    const scale = seitenPx / v1.width;
    const B = v1.width * scale, H = v1.height * scale;
    const viewport = page.getViewport({ scale, offsetX: -r.x * B, offsetY: -r.y * H });
    const leinwand = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(r.b * B)); c.height = Math.max(1, Math.round(r.h * H));
      return c;
    };
    const seite = leinwand();
    await merken(page.render({ canvas: seite, viewport, annotationMode: AnnotationMode.DISABLE })).promise;
    if (!hatMarkierungen(await page.getAnnotations({ intent: 'display' }))) return { seite, ebene: null };
    // Nur die Zeichenbefehle der Anmerkungen ausführen, auf eine eigene
    // Leinwand mit Alphakanal (pdf.js legt seine ohne an) und ohne Hintergrund.
    // Kein Vergleich zweier Durchgänge: Safari zeichnet die Seite beim zweiten
    // Mal mitunter anders, dann deckte die Ebene die Noten weiß zu.
    // Scheitert die Ebene, bleiben wenigstens die Noten (ohne Markierungen).
    try {
      const { fnArray } = await page.getOperatorList({ annotationMode: AnnotationMode.ENABLE_FORMS });
      const drin = anmerkungsBefehle(fnArray, OPS.beginAnnotation, OPS.endAnnotation);
      const ebene = leinwand();
      await merken(page.render({
        canvas: ebene, canvasContext: ebene.getContext('2d')!, viewport, annotationMode: AnnotationMode.ENABLE_FORMS,
        background: 'rgba(0,0,0,0)', operationsFilter: (i) => drin[i] === 1,
      })).promise;
      return { seite, ebene };
    } catch (x) {
      if (abgebrochen) throw x;
      console.error('Markierungen aus dem PDF ließen sich nicht zeichnen', x);
      return { seite, ebene: null };
    }
  })();
  return { bild, abbrechen: () => { abgebrochen = true; for (const t of aufgaben) t.cancel(); } };
}

// ── Sicht auf einen Teil der PDF (F-03) ──

// Was Betrachter und Stück-Blatt von der PDF brauchen: Seitenzahl und Seiten.
export type Dokument = Pick<PDFDocumentProxy, 'numPages' | 'getPage'>;

// Ein virtuelles Stück sieht nur die Seiten von–bis seiner Quelle, ab 1
// gezählt; die PDF selbst bleibt die der Quelle (und wird dort freigegeben).
export function seitenFenster(pdf: PDFDocumentProxy, quelle: Quelle | undefined): Dokument {
  if (!quelle) return pdf;
  const numPages = seitenInSicht({ quelle }, pdf.numPages);
  return { numPages, getPage: (nr: number) => pdf.getPage(zurPdf({ id: '', quelle }, nr)) };
}

// Das Inhaltsverzeichnis der PDF (Gliederung), flach: Titel und Seite (ab 1).
// Punkte, deren Ziel sich nicht auflösen lässt, fallen weg.
export async function gliederungLesen(pdf: PDFDocumentProxy): Promise<Gliederungspunkt[]> {
  const gliederung = await pdf.getOutline().catch(() => null);
  if (!gliederung) return [];
  const r: Gliederungspunkt[] = [];
  const durch = async (punkte: typeof gliederung) => {
    for (const p of punkte) {
      try {
        const ziel = typeof p.dest === 'string' ? await pdf.getDestination(p.dest) : p.dest;
        const ref = Array.isArray(ziel) ? ziel[0] : null;
        if (ref && typeof ref === 'object') r.push({ titel: p.title, seite: (await pdf.getPageIndex(ref)) + 1 });
        else if (typeof ref === 'number') r.push({ titel: p.title, seite: ref + 1 });
      } catch { /* Ziel nicht auflösbar — Punkt entfällt */ }
      if (p.items?.length) await durch(p.items);
    }
  };
  await durch(gliederung);
  return r;
}
