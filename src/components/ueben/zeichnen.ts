'use client';

import type { Anmerkung } from '@/domain/notenpult';
import { istSticker, stickerHoehe } from '@/domain/schnitte';
import type { SeitenBild } from './pdf';

const lueckeVon = (a: Anmerkung): string | null => ('luecke' in a && a.luecke ? a.luecke : null);

// Zeichnet Anmerkungen einer Seite in ein Rechteck (x0, y0, b, h) der Leinwand
// — die der Seite selbst, oder (luecke) die in der Lücke eines Schnitts (E-12),
// deren Rechteck dann bei der Oberkante der Lücke beginnt.
export function anmerkungenZeichnen(ctx: CanvasRenderingContext2D, objekte: Anmerkung[], x0: number, y0: number, b: number, h: number, luecke: string | null = null) {
  for (const a of objekte) {
    if (a.art === 'radiert') continue; // wirkt nur auf die übernommene Ebene
    if (a.art === 'schnitt' || a.art === 'sticker') continue; // zeichnet blattZeichnen (Teilstücke, Sticker)
    if (lueckeVon(a) !== luecke) continue;
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
// (ganze Seite, Halb-Ansicht); auf der Doppelseite je Hälfte, bei Schnitten
// (E-12) je Teilstück nach unten gerückt. luecke: dieser Teil ist die Lücke
// eines Schnitts (kein Seitenbild, nur was darin geschrieben wurde; blattLage
// beginnt an ihrer Oberkante, y0…y1 ist ihre Höhe).
export interface BlattTeil {
  seite: number; y0: number; y1: number; bild: HTMLCanvasElement | null; ebene: HTMLCanvasElement | null; lage: Lage; blattLage?: Lage; luecke?: string | null;
}
export interface BlattExtras {
  stellen: { seite: number; x: number; y: number; b: number; h: number }[];
  schnitt: number | null;
  hervor: { x: number; y: number; b: number; h: number } | null;
  // Lücke zwischen zwei Seiten (Doppelseite): leicht getönt, kein Papier.
  luecke?: Lage | null;
  // Seitenbilder, aus denen Sticker ihren Ausschnitt holen (je Quellseite).
  quellen?: Map<number, SeitenBild> | null;
  // Palette offen: Ränder der Lücken und Sticker zeigen (zum Anfassen).
  bearbeitbar?: boolean;
}
export function blattZeichnen(ctx: CanvasRenderingContext2D, seite: Lage, teile: BlattTeil[],
  anm: Record<number, Anmerkung[]>, extras: BlattExtras, hilfe: () => HTMLCanvasElement) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const t of teile) {
    const objekte = anm[t.seite] ?? [];
    const S = t.blattLage ?? seite;
    const { x: X, y: Y, b: W, h: H } = S;
    const luecke = t.luecke ?? null;
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y + t.y0 * H, W, (t.y1 - t.y0) * H); ctx.clip();
    if (t.bild) ctx.drawImage(t.bild, t.lage.x, t.lage.y, t.lage.b, t.lage.h);
    if (t.ebene && !luecke) ebeneZeichnen(ctx, t.ebene, t.lage, objekte, S, hilfe());
    anmerkungenZeichnen(ctx, objekte, X, Y, W, H, luecke);
    if (!luecke) {
      for (const st of objekte.filter(istSticker)) {
        stickerZeichnen(ctx, st, S, extras.quellen?.get(st.von.seite) ?? null, anm[st.von.seite] ?? [], !!extras.bearbeitbar);
      }
      for (const st of extras.stellen.filter((x) => x.seite === t.seite)) {
        ctx.strokeStyle = 'rgba(168, 120, 31, 0.55)'; ctx.lineWidth = Math.max(1, W / 600);
        ctx.setLineDash([W / 120, W / 160]); ctx.strokeRect(X + st.x * W, Y + st.y * H, st.b * W, st.h * H); ctx.setLineDash([]);
      }
    } else if (extras.bearbeitbar) {
      // Lücke beim Bearbeiten: gestrichelte Ober- und Unterkante.
      ctx.strokeStyle = 'rgba(168, 120, 31, 0.6)'; ctx.lineWidth = Math.max(1, W / 600);
      ctx.setLineDash([W / 120, W / 160]);
      ctx.beginPath(); ctx.moveTo(X, Y + 1); ctx.lineTo(X + W, Y + 1); ctx.moveTo(X, Y + t.y1 * H - 1); ctx.lineTo(X + W, Y + t.y1 * H - 1); ctx.stroke();
      ctx.setLineDash([]);
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

// Ein Sticker (E-12): der Ausschnitt `von` einer Seite — ihr Bild, ihre
// übernommenen Markierungen und ihre Anmerkungen — auf diese Seite gelegt.
// S: wo die ganze Zielseite auf der Leinwand liegt. Ohne Quellbild bleibt
// ein leerer Rahmen (das Bild kommt gleich nach).
export function stickerZeichnen(ctx: CanvasRenderingContext2D, st: Extract<Anmerkung, { art: 'sticker' }>, S: Lage,
  quelle: SeitenBild | null, quellObjekte: Anmerkung[], rahmen: boolean) {
  const { x: X, y: Y, b: W, h: H } = S;
  const dx = X + st.x * W, dy = Y + st.y * H, dw = st.b * W, dh = stickerHoehe(st) * H;
  ctx.save();
  ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(dx, dy, dw, dh);
  if (quelle) {
    const q = quelle.seite;
    const sx = st.von.x * q.width, sy = st.von.y * q.height, sw = st.von.b * q.width, sh = st.von.h * q.height;
    ctx.drawImage(q, sx, sy, sw, sh, dx, dy, dw, dh);
    if (quelle.ebene) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(quelle.ebene, sx, sy, sw, sh, dx, dy, dw, dh); ctx.globalCompositeOperation = 'source-over'; }
  }
  // Anmerkungen der Quelle: die Quellseite gedacht so groß, dass ihr Ausschnitt den Sticker füllt.
  const f = st.b / st.von.b, fh = stickerHoehe(st) / st.von.h;
  anmerkungenZeichnen(ctx, quellObjekte, dx - st.von.x * W * f, dy - st.von.y * H * fh, W * f, H * fh);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rahmen ? 'rgba(168, 120, 31, 0.8)' : 'rgba(29, 27, 23, 0.28)'; ctx.lineWidth = Math.max(1, W / 700);
  if (rahmen) ctx.setLineDash([W / 120, W / 160]);
  ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
  ctx.restore();
}
