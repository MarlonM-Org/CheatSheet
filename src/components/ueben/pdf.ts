'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
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

// Rendert eine Seite in eine Leinwand mit gegebener Breite in CSS-Pixeln.
export async function seiteZeichnen(pdf: PDFDocumentProxy, seite: number, canvas: HTMLCanvasElement, breite: number) {
  const page = await pdf.getPage(seite);
  const basis = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const viewport = page.getViewport({ scale: (breite / basis.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${breite}px`;
  canvas.style.height = `${(viewport.height / dpr)}px`;
  await page.render({ canvas, viewport }).promise;
}
