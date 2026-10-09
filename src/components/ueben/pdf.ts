'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';

// pdf.js erst im Browser laden (groß, braucht DOM). Worker liegt in public/.
export async function pdfLaden(datei: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjs.getDocument({ data: new Uint8Array(await datei.arrayBuffer()) }).promise;
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
