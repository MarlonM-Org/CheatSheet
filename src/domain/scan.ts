// Kamera-Scan und Foto-Import (F-07): Aus einem Foto von Papiernoten wird
// eine saubere Seite — Blattrand finden, entzerren, Schatten und ungleiches
// Licht herausrechnen, auf Wunsch Schwarz-Weiß — und aus den Seiten eine
// PDF. Alles rein auf Pixelfeldern (RGBA, wie ImageData), ohne Canvas, ohne
// Bibliothek, getestet. Die Komponente (Scan.tsx) holt die Pixel aus dem
// Bild und zeigt das Ergebnis.

export interface Bild { daten: Uint8ClampedArray<ArrayBuffer>; b: number; h: number }
// Eine Ecke in Anteilen des Bildes (0…1), damit sie unabhängig von der
// Auflösung bleibt (Vorschau klein, Ergebnis groß).
export interface Punkt { x: number; y: number }
// Ecken im Uhrzeigersinn ab oben links.
export type Ecken = [Punkt, Punkt, Punkt, Punkt];
export type Stufe = 'foto' | 'scan' | 'sw';
export const STUFEN: { stufe: Stufe; name: string; hinweis: string }[] = [
  { stufe: 'foto', name: 'Foto', hinweis: 'Nur Licht und Schatten ausgleichen, Farben bleiben' },
  { stufe: 'scan', name: 'Scan', hinweis: 'Papier weiß, Noten kräftig, Bleistift bleibt lesbar' },
  { stufe: 'sw', name: 'Schwarz-Weiß', hinweis: 'Nur schwarz und weiß, kleinste Datei' },
];

export const GANZES_BILD: Ecken = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

// ── Grauwerte ──

export function grauwerte(bild: Bild): Float32Array {
  const { daten, b, h } = bild;
  const g = new Float32Array(b * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * daten[p] + 0.587 * daten[p + 1] + 0.114 * daten[p + 2];
  return g;
}

// Kastenweichzeichner (getrennt in Zeilen und Spalten, laufende Summe) —
// Ränder werden gespiegelt gedacht, indem der Rand sich wiederholt.
export function weichzeichnen(g: Float32Array, b: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return Float32Array.from(g);
  const z = new Float32Array(b * h), s = new Float32Array(b * h);
  const n = 2 * r + 1;
  const kl = (v: number, max: number) => (v < 0 ? 0 : v >= max ? max - 1 : v);
  for (let y = 0; y < h; y++) {
    const o = y * b;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += g[o + kl(k, b)];
    for (let x = 0; x < b; x++) {
      z[o + x] = sum / n;
      sum += g[o + kl(x + r + 1, b)] - g[o + kl(x - r, b)];
    }
  }
  for (let x = 0; x < b; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += z[kl(k, h) * b + x];
    for (let y = 0; y < h; y++) {
      s[y * b + x] = sum / n;
      sum += z[kl(y + r + 1, h) * b + x] - z[kl(y - r, h) * b + x];
    }
  }
  return s;
}

// Hintergrund (Beleuchtung) schätzen: Helles Papier mit dunklen Noten darauf
// — die Noten sind klein gegen den Radius, der Mittelwert liegt knapp unter
// dem Papierweiß. Vorher ein Maximum in kleinen Fenstern, damit Noten den
// Hintergrund nicht herunterziehen. Gerechnet auf dem verkleinerten Bild
// (schneller), dann hochgezogen.
export function hintergrund(g: Float32Array, b: number, h: number): Float32Array {
  const f = Math.max(1, Math.round(Math.max(b, h) / 200));
  const kb = Math.max(1, Math.floor(b / f)), kh = Math.max(1, Math.floor(h / f));
  const klein = new Float32Array(kb * kh);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kb; x++) {
    // Maximum im Block: nimmt das Papier, nicht die Note.
    let m = 0;
    for (let yy = 0; yy < f; yy++) for (let xx = 0; xx < f; xx++) { const v = g[(y * f + yy) * b + x * f + xx]; if (v > m) m = v; }
    klein[y * kb + x] = m;
  }
  const glatt = weichzeichnen(weichzeichnen(klein, kb, kh, Math.max(2, Math.round(kb / 12))), kb, kh, Math.max(2, Math.round(kb / 12)));
  // Hochziehen (bilinear)
  const r = new Float32Array(b * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(kh - 1, (y + 0.5) / f - 0.5), y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(kh - 1, y0 + 1), ty = Math.max(0, sy - y0);
    for (let x = 0; x < b; x++) {
      const sx = Math.min(kb - 1, (x + 0.5) / f - 0.5), x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(kb - 1, x0 + 1), tx = Math.max(0, sx - x0);
      const o = glatt[y0 * kb + x0] * (1 - tx) + glatt[y0 * kb + x1] * tx;
      const u = glatt[y1 * kb + x0] * (1 - tx) + glatt[y1 * kb + x1] * tx;
      r[y * b + x] = o * (1 - ty) + u * ty;
    }
  }
  return r;
}

// ── Aufbereiten ──

// Licht ausgleichen und je nach Stufe nachschärfen. Liefert ein neues Bild.
export function aufbereiten(bild: Bild, stufe: Stufe): Bild {
  const { daten, b, h } = bild;
  const g = grauwerte(bild);
  const bg = hintergrund(g, b, h);
  const aus = new Uint8ClampedArray(daten.length);
  // „scan“: Pegel strecken — alles ab hier weiß, alles bis hier schwarz.
  const weiss = 0.86, schwarz = 0.25;
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    const gain = 255 / Math.max(24, bg[i]);
    if (stufe === 'sw') {
      const v = g[i] * gain / 255 >= 0.62 ? 255 : 0;
      aus[p] = aus[p + 1] = aus[p + 2] = v;
    } else {
      for (let c = 0; c < 3; c++) {
        let v = daten[p + c] * gain / 255;
        if (stufe === 'scan') v = (v - schwarz) / (weiss - schwarz);
        aus[p + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
    aus[p + 3] = 255;
  }
  return { daten: aus, b, h };
}

// ── Blattrand ──

// Die hellste zusammenhängende Fläche (das Papier) im verkleinerten Bild, ihre
// vier äußersten Punkte sind die Ecken. Liegt ein kräftiger Schatten auf dem
// Blatt, schneidet die Schwelle das Blatt schräg ab — dann noch einmal mit
// einer tieferen Schwelle (die den Schatten vom Tisch trennt), und es gilt
// das Viereck, das mehr nach Blatt aussieht (gegenüberliegende Kanten ähnlich
// lang). Findet sich nichts Brauchbares (zu klein, zu schmal), gilt das ganze
// Bild. Die Ecken bekommen 1 % Luft nach außen, damit kein Rand fehlt.
export function blattrand(bild: Bild): Ecken {
  const ziel = 160;
  const f = Math.max(1, Math.ceil(Math.max(bild.b, bild.h) / ziel));
  const kb = Math.max(2, Math.floor(bild.b / f)), kh = Math.max(2, Math.floor(bild.h / f));
  const g = new Float32Array(kb * kh);
  for (let y = 0; y < kh; y++) for (let x = 0; x < kb; x++) {
    let s = 0, n = 0;
    for (let yy = 0; yy < f; yy++) for (let xx = 0; xx < f; xx++) {
      const p = ((y * f + yy) * bild.b + x * f + xx) * 4;
      s += 0.299 * bild.daten[p] + 0.587 * bild.daten[p + 1] + 0.114 * bild.daten[p + 2]; n++;
    }
    g[y * kb + x] = s / n;
  }
  const t = otsu(g);
  const erster = blattKandidat(g, kb, kh, t);
  let wahl = erster;
  if (!erster || erster.guete < 0.7) {
    // Die dunkle Klasse noch einmal teilen: Schatten auf dem Blatt gegen Tisch.
    const dunkel = g.filter((v) => v < t);
    if (dunkel.length > 0) {
      const zweiter = blattKandidat(g, kb, kh, otsu(dunkel));
      if (zweiter && zweiter.flaeche < 0.92 && (!erster || zweiter.guete > erster.guete)) wahl = zweiter;
    }
  }
  if (!wahl) return GANZES_BILD;
  return mitLuft(wahl.ecken, 0.01);
}

interface Kandidat { ecken: Ecken; flaeche: number; guete: number }

// Größte helle Zusammenhangskomponente ab Schwelle `t` und ihr Viereck.
function blattKandidat(g: Float32Array, kb: number, kh: number, t: number): Kandidat | null {
  const hell = new Uint8Array(kb * kh);
  for (let i = 0; i < g.length; i++) hell[i] = g[i] >= t ? 1 : 0;
  const marke = new Int32Array(kb * kh).fill(-1);
  let beste = -1, besteN = 0, anzahl = 0;
  const stapel: number[] = [];
  for (let start = 0; start < hell.length; start++) {
    if (!hell[start] || marke[start] >= 0) continue;
    const id = anzahl++;
    let n = 0;
    stapel.push(start); marke[start] = id;
    while (stapel.length) {
      const i = stapel.pop()!;
      n++;
      const x = i % kb, y = (i - x) / kb;
      const nachbarn = [i - 1, i + 1, i - kb, i + kb];
      const ok = [x > 0, x < kb - 1, y > 0, y < kh - 1];
      for (let k = 0; k < 4; k++) if (ok[k] && hell[nachbarn[k]] && marke[nachbarn[k]] < 0) { marke[nachbarn[k]] = id; stapel.push(nachbarn[k]); }
    }
    if (n > besteN) { besteN = n; beste = id; }
  }
  if (beste < 0 || besteN < 0.15 * kb * kh) return null;
  let tl = 0, tr = 0, br = 0, bl = 0, sTl = Infinity, sTr = -Infinity, sBr = -Infinity, sBl = Infinity;
  for (let i = 0; i < marke.length; i++) {
    if (marke[i] !== beste) continue;
    const x = i % kb, y = (i - x) / kb;
    if (x + y < sTl) { sTl = x + y; tl = i; }
    if (x - y > sTr) { sTr = x - y; tr = i; }
    if (x + y > sBr) { sBr = x + y; br = i; }
    if (x - y < sBl) { sBl = x - y; bl = i; }
  }
  const punkt = (i: number, dx: number, dy: number): Punkt => {
    const x = i % kb, y = (i - x) / kb;
    return { x: Math.max(0, Math.min(1, (x + dx) / kb)), y: Math.max(0, Math.min(1, (y + dy) / kh)) };
  };
  const ecken: Ecken = [punkt(tl, 0, 0), punkt(tr, 1, 0), punkt(br, 1, 1), punkt(bl, 0, 1)];
  const oben = abstand(ecken[0], ecken[1]), unten = abstand(ecken[3], ecken[2]);
  const links = abstand(ecken[0], ecken[3]), rechts = abstand(ecken[1], ecken[2]);
  if (Math.min(oben, unten) < 0.25 || Math.min(links, rechts) < 0.25 || !konvex(ecken)) return null;
  const verh = (a: number, b: number) => Math.min(a, b) / Math.max(a, b);
  return { ecken, flaeche: besteN / (kb * kh), guete: verh(oben, unten) * verh(links, rechts) };
}

// Ecken vom Schwerpunkt aus um den Anteil `luft` nach außen schieben (im Bild gehalten).
export function mitLuft(e: Ecken, luft: number): Ecken {
  const mx = (e[0].x + e[1].x + e[2].x + e[3].x) / 4, my = (e[0].y + e[1].y + e[2].y + e[3].y) / 4;
  return e.map((p) => ({
    x: Math.max(0, Math.min(1, p.x + Math.sign(p.x - mx) * luft)),
    y: Math.max(0, Math.min(1, p.y + Math.sign(p.y - my) * luft)),
  })) as Ecken;
}

const abstand = (p: Punkt, q: Punkt) => Math.hypot(p.x - q.x, p.y - q.y);

export function konvex(e: Ecken): boolean {
  let vorzeichen = 0;
  for (let i = 0; i < 4; i++) {
    const a = e[i], b = e[(i + 1) % 4], c = e[(i + 2) % 4];
    const kreuz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(kreuz) < 1e-9) return false;
    const s = Math.sign(kreuz);
    if (vorzeichen === 0) vorzeichen = s; else if (s !== vorzeichen) return false;
  }
  return true;
}

// Schwelle nach Otsu (zwei Klassen, kleinste Varianz innerhalb).
export function otsu(g: Float32Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, Math.round(g[i])))]++;
  const n = g.length;
  let summe = 0;
  for (let t = 0; t < 256; t++) summe += t * hist[t];
  let sB = 0, wB = 0, best = 0, schwelle = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (summe - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; schwelle = t + 1; }
  }
  return schwelle;
}

// ── Entzerren ──

// Zielgröße des entzerrten Blatts: die längeren Kanten des Vierecks in
// Pixeln der Quelle, die lange Seite höchstens `maxLang`.
export function zielmass(ecken: Ecken, b: number, h: number, maxLang = 2000): { b: number; h: number } {
  const px = (p: Punkt) => ({ x: p.x * b, y: p.y * h });
  const [tl, tr, br, bl] = ecken.map(px);
  const breite = Math.max(abstand(tl, tr), abstand(bl, br));
  const hoehe = Math.max(abstand(tl, bl), abstand(tr, br));
  const f = Math.min(1, maxLang / Math.max(breite, hoehe));
  return { b: Math.max(1, Math.round(breite * f)), h: Math.max(1, Math.round(hoehe * f)) };
}

// Projektive Abbildung vom Einheitsquadrat auf das Viereck (Heckbert): (u,v)
// in 0…1 → Punkt im Quellbild (Anteile).
export function homographie(e: Ecken): (u: number, v: number) => Punkt {
  const [p0, p1, p2, p3] = e;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let a, b, c, d, ee, f, g = 0, hh = 0;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x; d = p1.y - p0.y; ee = p2.y - p1.y; f = p0.y;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    hh = (dx1 * dy3 - dx3 * dy1) / det;
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + hh * p3.x; c = p0.x;
    d = p1.y - p0.y + g * p1.y; ee = p3.y - p0.y + hh * p3.y; f = p0.y;
  }
  return (u, v) => { const w = g * u + hh * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + ee * v + f) / w }; };
}

// Das Viereck aus dem Bild auf ein Rechteck ziehen (Rückwärtsabbildung mit
// bilinearer Interpolation).
export function entzerren(bild: Bild, ecken: Ecken, ziel: { b: number; h: number }): Bild {
  const { daten, b, h } = bild;
  const H = homographie(ecken);
  const aus = new Uint8ClampedArray(ziel.b * ziel.h * 4);
  for (let j = 0; j < ziel.h; j++) {
    const v = (j + 0.5) / ziel.h;
    for (let i = 0; i < ziel.b; i++) {
      const q = H((i + 0.5) / ziel.b, v);
      const sx = Math.max(0, Math.min(b - 1, q.x * b - 0.5)), sy = Math.max(0, Math.min(h - 1, q.y * h - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(b - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const tx = sx - x0, ty = sy - y0;
      const o = (j * ziel.b + i) * 4;
      for (let c = 0; c < 3; c++) {
        const p00 = daten[(y0 * b + x0) * 4 + c], p10 = daten[(y0 * b + x1) * 4 + c], p01 = daten[(y1 * b + x0) * 4 + c], p11 = daten[(y1 * b + x1) * 4 + c];
        aus[o + c] = (p00 * (1 - tx) + p10 * tx) * (1 - ty) + (p01 * (1 - tx) + p11 * tx) * ty;
      }
      aus[o + 3] = 255;
    }
  }
  return { daten: aus, b: ziel.b, h: ziel.h };
}

// Um Vierteldrehungen im Uhrzeigersinn drehen.
export function drehen(bild: Bild, viertel: number): Bild {
  const n = ((viertel % 4) + 4) % 4;
  if (n === 0) return bild;
  const { daten, b, h } = bild;
  const quer = n % 2 === 1;
  const nb = quer ? h : b, nh = quer ? b : h;
  const aus = new Uint8ClampedArray(daten.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) {
    const [nx, ny] = n === 1 ? [h - 1 - y, x] : n === 2 ? [b - 1 - x, h - 1 - y] : [y, b - 1 - x];
    const q = (y * b + x) * 4, z = (ny * nb + nx) * 4;
    aus[z] = daten[q]; aus[z + 1] = daten[q + 1]; aus[z + 2] = daten[q + 2]; aus[z + 3] = daten[q + 3];
  }
  return { daten: aus, b: nb, h: nh };
}

// Eine Ecke verschieben (Anteile, im Bild gehalten).
export function eckeSetzen(ecken: Ecken, nr: number, p: Punkt): Ecken {
  const neu = ecken.map((e, i) => (i === nr ? { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) } : e)) as Ecken;
  return neu;
}

// ── PDF aus Seiten ──

export interface Seitenbild { jpeg: Uint8Array<ArrayBuffer>; b: number; h: number }

// Eine PDF (1.4) mit einem JPEG je Seite, Seite im DIN-A4-Maß passend zum
// Seitenverhältnis des Bilds (hoch 595 × …, quer 842 × …). Reine Bytes.
export function pdfBauen(seiten: Seitenbild[], titel: string): Uint8Array<ArrayBuffer> {
  if (!seiten.length) throw new Error('Keine Seiten.');
  const enc = new TextEncoder();
  const teile: Uint8Array[] = [];
  const offsets: number[] = [];
  let laenge = 0;
  const schreiben = (t: Uint8Array | string) => { const u = typeof t === 'string' ? enc.encode(t) : t; teile.push(u); laenge += u.length; };
  const objekt = (nr: number, kopf: string, strom?: Uint8Array) => {
    offsets[nr] = laenge;
    schreiben(`${nr} 0 obj\n${kopf}\n`);
    if (strom) { schreiben('stream\n'); schreiben(strom); schreiben('\nendstream\n'); }
    schreiben('endobj\n');
  };
  schreiben('%PDF-1.4\n%âãÏÓ\n');
  // 1 Katalog, 2 Seitenbaum, 3 Info, dann je Seite 3 Objekte
  const seitenNr = (i: number) => 4 + i * 3;
  const kids = seiten.map((_, i) => `${seitenNr(i)} 0 R`).join(' ');
  objekt(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objekt(2, `<< /Type /Pages /Kids [${kids}] /Count ${seiten.length} >>`);
  objekt(3, `<< /Title (${pdfText(titel)}) /Producer (CheatSheet Scan) >>`);
  seiten.forEach((s, i) => {
    const hoch = s.h >= s.b;
    const B = hoch ? 595 : 842, Hh = hoch ? Math.round(595 * s.h / s.b) : Math.round(842 * s.h / s.b);
    const inhalt = enc.encode(`q ${B} 0 0 ${Hh} 0 0 cm /Im0 Do Q`);
    objekt(seitenNr(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${B} ${Hh}] /Resources << /XObject << /Im0 ${seitenNr(i) + 2} 0 R >> >> /Contents ${seitenNr(i) + 1} 0 R >>`);
    objekt(seitenNr(i) + 1, `<< /Length ${inhalt.length} >>`, inhalt);
    objekt(seitenNr(i) + 2, `<< /Type /XObject /Subtype /Image /Width ${s.b} /Height ${s.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.jpeg.length} >>`, s.jpeg);
  });
  const anzahl = 4 + seiten.length * 3;
  const xref = laenge;
  let tabelle = `xref\n0 ${anzahl}\n0000000000 65535 f \n`;
  for (let i = 1; i < anzahl; i++) tabelle += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  schreiben(tabelle);
  schreiben(`trailer\n<< /Size ${anzahl} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const aus = new Uint8Array(laenge);
  let o = 0;
  for (const t of teile) { aus.set(t, o); o += t.length; }
  return aus;
}

// Text für einen PDF-String: nur ASCII, Klammern und Backslash geschützt.
export function pdfText(t: string): string {
  return t.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[\\()]/g, (c) => `\\${c}`).slice(0, 200);
}

// Dateiname für die Bibliothek: aus dem Titel, ohne Sonderzeichen.
export function scanDateiname(titel: string, jetzt: Date): string {
  const kern = titel.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Scan';
  const d = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  return `${kern} (Scan ${d}).pdf`;
}
