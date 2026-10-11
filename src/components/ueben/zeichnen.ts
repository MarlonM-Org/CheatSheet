'use client';

import type { Anmerkung } from '@/domain/notenpult';

// Zeichnet Anmerkungen einer Seite in ein Rechteck (x0, y0, b, h) der Leinwand.
export function anmerkungenZeichnen(ctx: CanvasRenderingContext2D, objekte: Anmerkung[], x0: number, y0: number, b: number, h: number) {
  for (const a of objekte) {
    if (a.art === 'radiert') continue; // wirkt nur auf die übernommene Ebene
    ctx.save();
    if (a.art === 'text') {
      ctx.fillStyle = a.farbe;
      ctx.font = `600 ${a.groesse * b}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(a.text, x0 + a.x * b, y0 + a.y * h);
    } else {
      strichZeichnen(ctx, a.punkte, a.farbe, a.breite * b, x0, y0, b, h, a.art === 'marker');
    }
    ctx.restore();
  }
}

// Glatte Linie durch die Punkte (Mittelpunkt-Kurven), Marker halbtransparent.
export function strichZeichnen(ctx: CanvasRenderingContext2D, p: number[], farbe: string, breite: number,
  x0: number, y0: number, b: number, h: number, marker = false) {
  if (p.length < 2) return;
  ctx.strokeStyle = farbe;
  ctx.lineWidth = breite;
  ctx.lineCap = marker ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  if (marker) ctx.globalCompositeOperation = 'multiply';
  const X = (i: number) => x0 + p[i] * b, Y = (i: number) => y0 + p[i + 1] * h;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  if (p.length === 2) ctx.lineTo(X(0) + 0.1, Y(0));
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (X(i) + X(i + 2)) / 2, my = (Y(i) + Y(i + 2)) / 2;
    ctx.quadraticCurveTo(X(i), Y(i), mx, my);
  }
  if (p.length >= 4) ctx.lineTo(X(p.length - 2), Y(p.length - 2));
  ctx.stroke();
}

// Übernommene Markierungen aus dem PDF (ebene) in ein Rechteck zeichnen, an
// den Radier-Spuren ausgestanzt: erst auf die Hilfsleinwand, dort die Spuren
// wegnehmen, dann darüberlegen. Multipliziert wie Tinte und Textmarker auf
// Papier — so bleiben Noten unter einer Hervorhebung schwarz.
export function ebeneZeichnen(ctx: CanvasRenderingContext2D, ebene: HTMLCanvasElement, objekte: Anmerkung[],
  x0: number, y0: number, b: number, h: number, hilfe: HTMLCanvasElement) {
  const spuren = objekte.filter((a) => a.art === 'radiert');
  let bild = ebene;
  if (spuren.length) {
    const w = Math.round(b), hh = Math.round(h);
    if (hilfe.width !== w || hilfe.height !== hh) { hilfe.width = w; hilfe.height = hh; }
    const hc = hilfe.getContext('2d')!;
    hc.globalCompositeOperation = 'source-over';
    hc.clearRect(0, 0, w, hh);
    hc.drawImage(ebene, 0, 0, w, hh);
    hc.globalCompositeOperation = 'destination-out';
    for (const s of spuren) strichZeichnen(hc, s.punkte, '#000', s.breite * w, 0, 0, w, hh);
    hc.globalCompositeOperation = 'source-over';
    bild = hilfe;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(bild, x0, y0, b, h);
  ctx.restore();
}
