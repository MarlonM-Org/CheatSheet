'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { anmerkungsBefehle, hatMarkierungen } from '@/domain/ebene';
import { istNachladeFehler } from '@/domain/nachladen';
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
export async function seiteMitEbene(pdf: PDFDocumentProxy, nr: number, px: number): Promise<SeitenBild> {
  const { AnnotationMode, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const page = await pdf.getPage(nr);
  const v1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: px / v1.width });
  const leinwand = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
    return c;
  };
  const seite = leinwand();
  await page.render({ canvas: seite, viewport, annotationMode: AnnotationMode.DISABLE }).promise;
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
    await page.render({
      canvas: ebene, canvasContext: ebene.getContext('2d')!, viewport, annotationMode: AnnotationMode.ENABLE_FORMS,
      background: 'rgba(0,0,0,0)', operationsFilter: (i) => drin[i] === 1,
    }).promise;
    return { seite, ebene };
  } catch (x) {
    console.error('Markierungen aus dem PDF ließen sich nicht zeichnen', x);
    return { seite, ebene: null };
  }
}
