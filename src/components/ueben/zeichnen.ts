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

// Übernommene Markierungen aus dem PDF (ebene) auf die Leinwand legen, an
// den Radier-Spuren ausgestanzt: erst auf die Hilfsleinwand (so groß wie die
// Leinwand), dort die Spuren wegnehmen, dann darüberlegen. Multipliziert wie
// Tinte und Textmarker auf Papier — so bleiben Noten unter einer
// Hervorhebung schwarz. bild: wo das Bild der Ebene auf der Leinwand liegt;
// seite: wo die ganze Seite liegt (für die Spuren). Beim Zoomen ist das
// Bild nur ein Ausschnitt der Seite.
export interface Lage { x: number; y: number; b: number; h: number }
export function ebeneZeichnen(ctx: CanvasRenderingContext2D, ebene: HTMLCanvasElement, bild: Lage, objekte: Anmerkung[],
  seite: Lage, hilfe: HTMLCanvasElement) {
  const spuren = objekte.filter((a) => a.art === 'radiert');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  if (!spuren.length) ctx.drawImage(ebene, bild.x, bild.y, bild.b, bild.h);
  else {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (hilfe.width !== w || hilfe.height !== h) { hilfe.width = w; hilfe.height = h; }
    const hc = hilfe.getContext('2d')!;
    hc.globalCompositeOperation = 'source-over';
    hc.clearRect(0, 0, w, h);
    hc.drawImage(ebene, bild.x, bild.y, bild.b, bild.h);
    hc.globalCompositeOperation = 'destination-out';
    for (const s of spuren) strichZeichnen(hc, s.punkte, '#000', s.breite * seite.b, seite.x, seite.y, seite.b, seite.h);
    hc.globalCompositeOperation = 'source-over';
    ctx.drawImage(hilfe, 0, 0);
  }
  ctx.restore();
}

// Ein Blatt zusammensetzen — die ganze Ansicht oder, beim Zoomen, ihr
// scharfer Ausschnitt: Seite(n), Markierungs-Ebene, Anmerkungen, Rahmen der
// Stellen, Übergangskante beim Halbseiten-Blättern, die geübte Stelle
// hervorgehoben. seite: wo die ganze Seite auf der Leinwand liegt; jeder
// Teil zeigt die Höhe y0…y1 einer Seite, sein Bild liegt bei lage.
// blattLage: wo die ganze Seite dieses Teils liegt — fehlt es, bei `seite`
// (ganze Seite, Halb-Ansicht); auf der Doppelseite je Hälfte.
export interface BlattTeil { seite: number; y0: number; y1: number; bild: HTMLCanvasElement; ebene: HTMLCanvasElement | null; lage: Lage; blattLage?: Lage }
export interface BlattExtras {
  stellen: { seite: number; x: number; y: number; b: number; h: number }[];
  schnitt: number | null;
  hervor: { x: number; y: number; b: number; h: number } | null;
  // Lücke zwischen zwei Seiten (Doppelseite): leicht getönt, kein Papier.
  luecke?: Lage | null;
}
export function blattZeichnen(ctx: CanvasRenderingContext2D, seite: Lage, teile: BlattTeil[],
  anm: Record<number, Anmerkung[]>, extras: BlattExtras, hilfe: () => HTMLCanvasElement) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const t of teile) {
    const objekte = anm[t.seite] ?? [];
    const S = t.blattLage ?? seite;
    const { x: X, y: Y, b: W, h: H } = S;
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y + t.y0 * H, W, (t.y1 - t.y0) * H); ctx.clip();
    ctx.drawImage(t.bild, t.lage.x, t.lage.y, t.lage.b, t.lage.h);
    if (t.ebene) ebeneZeichnen(ctx, t.ebene, t.lage, objekte, S, hilfe());
    anmerkungenZeichnen(ctx, objekte, X, Y, W, H);
    for (const st of extras.stellen.filter((x) => x.seite === t.seite)) {
      ctx.strokeStyle = 'rgba(168, 120, 31, 0.55)'; ctx.lineWidth = Math.max(1, W / 600);
      ctx.setLineDash([W / 120, W / 160]); ctx.strokeRect(X + st.x * W, Y + st.y * H, st.b * W, st.h * H); ctx.setLineDash([]);
    }
    ctx.restore();
  }
  if (extras.luecke) {
    const l = extras.luecke;
    ctx.fillStyle = 'rgba(29, 27, 23, 0.07)';
    ctx.fillRect(l.x, l.y, l.b, l.h);
  }
  const { x: X, y: Y, b: W, h: H } = seite;
  if (extras.schnitt !== null) {
    // Übergangskante: hier endet die neue Seite, darunter steht noch die alte.
    const y = Y + extras.schnitt * H;
    ctx.fillStyle = 'rgba(168, 120, 31, 0.9)';
    ctx.fillRect(X, y - Math.max(1.5, H / 500), W, Math.max(3, H / 250));
  }
  if (extras.hervor) {
    const r = extras.hervor;
    ctx.fillStyle = 'rgba(20, 20, 20, 0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.rect(X + r.x * W, Y + r.y * H, r.b * W, r.h * H);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#a8781f'; ctx.lineWidth = Math.max(2, W / 350);
    ctx.strokeRect(X + r.x * W, Y + r.y * H, r.b * W, r.h * H);
  }
}
