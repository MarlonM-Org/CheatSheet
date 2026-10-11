'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ebeneAusDifferenz, hatMarkierungen } from '@/domain/ebene';
import { istNachladeFehler } from '@/domain/nachladen';

// Eine neuere Version ist ausgeliefert, und Code dieser Seite fehlt: neu laden.
export class NeueVersionFehler extends Error {
  constructor() { super('Neue Version verfügbar — bitte neu laden.'); }
}

// Name des Workers mit pdf.js-Version, beim Build aus next.config.ts eingesetzt.
const WORKER = process.env.PDF_WORKER as string;

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
    return await pdfjs.getDocument({ data: new Uint8Array(await datei.arrayBuffer()) }).promise;
  } catch (e) {
    throw istNachladeFehler(e) ? new NeueVersionFehler() : e;
  }
}

// Eine Seite als Bild der Breite px (Gerätepixel): die nackte Seite ohne die
// Anmerkungen des PDFs und — stecken Markierungen darin — deren Ebene zum
// Darüberlegen (ebene.ts). So lassen sich die Markierungen radieren.
export interface SeitenBild { seite: HTMLCanvasElement; ebene: HTMLCanvasElement | null }
export async function seiteMitEbene(pdf: PDFDocumentProxy, nr: number, px: number): Promise<SeitenBild> {
  const { AnnotationMode } = await import('pdfjs-dist/legacy/build/pdf.mjs');
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
  const mitBild = leinwand();
  await page.render({ canvas: mitBild, viewport, annotationMode: AnnotationMode.ENABLE_FORMS }).promise;
  const mit = mitBild.getContext('2d')!.getImageData(0, 0, mitBild.width, mitBild.height);
  const ohne = seite.getContext('2d')!.getImageData(0, 0, seite.width, seite.height);
  mitBild.width = 0; mitBild.height = 0;
  ebeneAusDifferenz(mit.data, ohne.data);
  // pdf.js legt seine Leinwand ohne Alphakanal an (alpha: false) — die Ebene
  // braucht einen, sonst deckt sie die Seite zu. Deshalb eine eigene.
  const ebene = leinwand();
  ebene.getContext('2d')!.putImageData(mit, 0, 0);
  return { seite, ebene };
}
