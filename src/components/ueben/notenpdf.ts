'use client';

import { pdfBauen, type Seitenbild } from '@/domain/scan';

// Notation → PDF (G-01): abcjs zeichnet je Notenzeile ein SVG; die Zeilen
// werden auf A4-Seiten verteilt (keine Zeile wird zerschnitten), als JPEG
// gerastert und zu einer PDF gebaut (@/domain/scan). Genutzt beim Speichern
// aus dem Notenblatt und beim Umbenennen eines geschriebenen Stücks (der
// Titel steht auf dem Blatt).

const SEITE_B = 1240, SEITE_H = 1754, SEITE_RAND = 90, SKALA = 1.6;

export async function notationPdf(abc: string, titel: string): Promise<{ datei: Blob; seiten: number }> {
  const seiten = await alsSeiten(abc);
  return { datei: new Blob([pdfBauen(seiten, titel)], { type: 'application/pdf' }), seiten: seiten.length };
}

// ABC → Seiten: abcjs zeichnet je Notenzeile ein SVG; die Zeilen werden auf
// A4-Seiten verteilt (keine Zeile wird zerschnitten) und als JPEG geliefert.
async function alsSeiten(abc: string): Promise<Seitenbild[]> {
  const halter = document.createElement('div');
  halter.style.cssText = `position:fixed;left:-30000px;top:0;width:${SEITE_B}px;background:#fff;color:#000`;
  document.body.appendChild(halter);
  try {
    const { renderAbc } = await import('abcjs');
    renderAbc(halter, abc, {
      oneSvgPerLine: true, scale: SKALA, staffwidth: (SEITE_B - 2 * SEITE_RAND) / SKALA,
      paddingleft: 0, paddingright: 0, paddingtop: 10, paddingbottom: 10, foregroundColor: '#000',
    });
    const svgs = [...halter.querySelectorAll('svg')];
    if (!svgs.length) throw new Error('abcjs hat nichts gezeichnet.');
    const neu = () => { const c = document.createElement('canvas'); c.width = SEITE_B; c.height = SEITE_H; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, SEITE_B, SEITE_H); return c; };
    const seiten: Seitenbild[] = [];
    let canvas = neu(), y = SEITE_RAND;
    for (const svg of svgs) {
      // abcjs bemisst die Zeile unskaliert (viewBox) und skaliert per CSS-Transform —
      // die Seite rechnet selbst: Maß aus der viewBox mal Skala.
      const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
      const b = Math.ceil((vb[2] || svg.clientWidth) * SKALA), h = Math.ceil((vb[3] || svg.clientHeight) * SKALA);
      if (y + h > SEITE_H - SEITE_RAND && y > SEITE_RAND) { seiten.push(await alsJpeg(canvas)); canvas = neu(); y = SEITE_RAND; }
      await svgZeichnen(svg, b, h, canvas, Math.round((SEITE_B - b) / 2), y);
      y += h;
    }
    seiten.push(await alsJpeg(canvas));
    return seiten;
  } finally { halter.remove(); }
}

async function svgZeichnen(svg: SVGSVGElement, b: number, h: number, canvas: HTMLCanvasElement, x: number, y: number) {
  const kopie = svg.cloneNode(true) as SVGSVGElement;
  // Den CSS-Transform (Skalierung) nicht mitnehmen — als Bild skaliert die viewBox.
  kopie.removeAttribute('style'); kopie.removeAttribute('class');
  kopie.setAttribute('width', String(b)); kopie.setAttribute('height', String(h));
  kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(kopie)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    canvas.getContext('2d')!.drawImage(img, x, y, b, h);
  } finally { URL.revokeObjectURL(url); }
}

function alsJpeg(c: HTMLCanvasElement): Promise<Seitenbild> {
  return new Promise((ok, fehler) => c.toBlob(async (blob) => {
    if (!blob) return fehler(new Error('Die Seite ließ sich nicht als JPEG speichern.'));
    ok({ jpeg: new Uint8Array(await blob.arrayBuffer()), b: c.width, h: c.height });
  }, 'image/jpeg', 0.9));
}
