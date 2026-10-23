import { describe, expect, it } from 'vitest';
import {
  aufbereiten, blattrand, drehen, eckeSetzen, entzerren, GANZES_BILD, grauwerte, hintergrund, homographie, konvex, otsu, pdfBauen, pdfText,
  scanDateiname, weichzeichnen, zielmass, type Bild, type Ecken,
} from '@/domain/scan';

// Ein Bild malen: Hintergrundfarbe, dann ein Rechteck (oder Viereck) in anderer Farbe.
function bild(b: number, h: number, farbe: (x: number, y: number) => [number, number, number]): Bild {
  const daten = new Uint8ClampedArray(b * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) {
    const [r, g, bl] = farbe(x, y), p = (y * b + x) * 4;
    daten[p] = r; daten[p + 1] = g; daten[p + 2] = bl; daten[p + 3] = 255;
  }
  return { daten, b, h };
}
const pixel = (im: Bild, x: number, y: number) => { const p = (y * im.b + x) * 4; return [im.daten[p], im.daten[p + 1], im.daten[p + 2]]; };

describe('Grauwerte und Weichzeichnen', () => {
  it('Grauwert gewichtet die Kanäle', () => {
    const im = bild(2, 1, (x) => (x ? [255, 255, 255] : [0, 0, 0]));
    expect([...grauwerte(im)]).toEqual([0, 255]);
  });
  it('Weichzeichnen glättet eine Kante, erhält Flächen', () => {
    const g = new Float32Array([0, 0, 0, 0, 255, 255, 255, 255]);
    const w = weichzeichnen(g, 8, 1, 1);
    expect(w[0]).toBe(0); expect(w[7]).toBe(255);
    expect(w[3]).toBeCloseTo(85, 0); expect(w[4]).toBeCloseTo(170, 0);
    expect([...weichzeichnen(g, 8, 1, 0)]).toEqual([...g]);
  });
});

describe('Beleuchtung ausgleichen', () => {
  // Papier mit Helligkeitsverlauf (Schatten links) und dünnen „Noten“ (dunkle Linien).
  const schattig = bild(200, 120, (x, y) => {
    const licht = 120 + 120 * (x / 200);
    const note = y % 20 === 10 && x > 20 && x < 180;
    const v = note ? 20 : licht;
    return [v, v, v];
  });
  it('schätzt den Hintergrund als das helle Papier, nicht die Noten', () => {
    const g = grauwerte(schattig);
    const bg = hintergrund(g, 200, 120);
    // Auf einer Notenzeile ist der Hintergrund trotzdem hell (Papier ringsum).
    expect(bg[10 * 200 + 100]).toBeGreaterThan(150);
    // Links dunkler als rechts — der Verlauf ist drin.
    expect(bg[60 * 200 + 20]).toBeLessThan(bg[60 * 200 + 180]);
  });
  it('„foto“: Papier wird überall gleich hell, Noten bleiben dunkel', () => {
    const aus = aufbereiten(schattig, 'foto');
    expect(pixel(aus, 15, 5)[0]).toBeGreaterThan(235);
    expect(pixel(aus, 185, 5)[0]).toBeGreaterThan(235);
    expect(pixel(aus, 100, 10)[0]).toBeLessThan(80);
  });
  it('„scan“ streckt die Pegel, „sw“ kennt nur 0 und 255', () => {
    const scan = aufbereiten(schattig, 'scan');
    expect(pixel(scan, 15, 5)[0]).toBe(255);
    expect(pixel(scan, 100, 10)[0]).toBeLessThan(30);
    const sw = aufbereiten(schattig, 'sw');
    const werte = new Set<number>();
    for (let i = 0; i < sw.daten.length; i += 4) werte.add(sw.daten[i]);
    expect([...werte].sort()).toEqual([0, 255]);
    expect(pixel(sw, 100, 10)).toEqual([0, 0, 0]);
    expect(pixel(sw, 100, 5)).toEqual([255, 255, 255]);
  });
  it('„foto“ behält Farben (Bleistift grau, Marker gelb)', () => {
    const bunt = bild(100, 60, (x, y) => (y === 30 && x > 10 && x < 90 ? [240, 220, 60] : [200, 200, 200]));
    const aus = aufbereiten(bunt, 'foto');
    const [r, g, b] = pixel(aus, 50, 30);
    expect(r).toBeGreaterThan(b + 60); expect(g).toBeGreaterThan(b + 60);
  });
});

describe('Blattrand', () => {
  it('findet ein helles Blatt auf dunklem Grund', () => {
    const im = bild(320, 240, (x, y) => (x >= 40 && x < 280 && y >= 30 && y < 210 ? [230, 230, 225] : [40, 35, 30]));
    const e = blattrand(im);
    expect(e[0].x).toBeCloseTo(40 / 320 - 0.01, 1); expect(e[0].y).toBeCloseTo(30 / 240 - 0.01, 1);
    expect(e[2].x).toBeCloseTo(280 / 320 + 0.01, 1); expect(e[2].y).toBeCloseTo(210 / 240 + 0.01, 1);
  });
  it('ein schräges Blatt: die Ecken liegen an den äußersten Punkten', () => {
    // Parallelogramm: oben nach rechts versetzt
    const im = bild(320, 240, (x, y) => { const v = (y - 20) / 200; const links = 100 - 60 * v, rechts = 260 - 60 * v; return y >= 20 && y < 220 && x >= links && x < rechts ? [240, 240, 240] : [30, 30, 30]; });
    const e = blattrand(im);
    expect(e[0].x).toBeGreaterThan(e[3].x); // oben links rechts von unten links
    expect(e[1].x).toBeGreaterThan(e[2].x);
    expect(konvex(e)).toBe(true);
  });
  it('ein kräftiger Schatten auf dem Blatt schneidet es nicht ab', () => {
    // Blatt 40..280 × 30..210; links unten liegt ein Schatten, der das Papier auf 45 % abdunkelt
    const im = bild(320, 240, (x, y) => {
      const blatt = x >= 40 && x < 280 && y >= 30 && y < 210;
      const schatten = (x - 40) / 240 + (210 - y) / 180 < 0.9 ? 0.45 : 1;
      const v = blatt ? 240 * schatten : 70 * (x < 160 ? 0.5 : 1);
      return [v, v, v];
    });
    const e = blattrand(im);
    expect(e[3].x).toBeLessThan(0.17); expect(e[3].y).toBeGreaterThan(0.84);
    expect(e[0].x).toBeLessThan(0.17); expect(e[0].y).toBeLessThan(0.14);
  });
  it('ohne erkennbares Blatt gilt das ganze Bild', () => {
    const grau = bild(100, 80, () => [128, 128, 128]);
    expect(blattrand(grau)).toEqual(GANZES_BILD);
    const klein = bild(200, 200, (x, y) => (x > 90 && x < 110 && y > 90 && y < 110 ? [255, 255, 255] : [0, 0, 0]));
    expect(blattrand(klein)).toEqual(GANZES_BILD);
  });
  it('Otsu trennt zwei Helligkeiten', () => {
    const g = new Float32Array(100).map((_, i) => (i < 50 ? 40 + (i % 5) : 200 + (i % 5)));
    const t = otsu(g);
    expect(t).toBeGreaterThan(44); expect(t).toBeLessThanOrEqual(201);
  });
  it('konvex erkennt verdrehte Vierecke', () => {
    expect(konvex(GANZES_BILD)).toBe(true);
    const verdreht: Ecken = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(konvex(verdreht)).toBe(false);
  });
  it('eine Ecke verschieben bleibt im Bild', () => {
    const e = eckeSetzen(GANZES_BILD, 1, { x: 1.4, y: -0.2 });
    expect(e[1]).toEqual({ x: 1, y: 0 });
    expect(e[0]).toBe(GANZES_BILD[0]);
  });
});

describe('Entzerren', () => {
  it('Homographie trifft die Ecken', () => {
    const e: Ecken = [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.1 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.8 }];
    const H = homographie(e);
    for (const [u, v, p] of [[0, 0, e[0]], [1, 0, e[1]], [1, 1, e[2]], [0, 1, e[3]]] as const) {
      const q = H(u, v);
      expect(q.x).toBeCloseTo(p.x, 6); expect(q.y).toBeCloseTo(p.y, 6);
    }
    // Affiner Sonderfall (Rechteck)
    const R = homographie([{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }]);
    expect(R(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
  it('zieht ein Viereck auf ein Rechteck: die Mitte landet in der Mitte, Inhalt stimmt', () => {
    // Blatt: Rechteck 40..280 × 30..210 mit einem dunklen Punkt in der Mitte
    const im = bild(320, 240, (x, y) => (Math.abs(x - 160) < 6 && Math.abs(y - 120) < 6 ? [0, 0, 0] : x >= 40 && x < 280 && y >= 30 && y < 210 ? [250, 250, 250] : [20, 20, 20]));
    const e: Ecken = [{ x: 40 / 320, y: 30 / 240 }, { x: 280 / 320, y: 30 / 240 }, { x: 280 / 320, y: 210 / 240 }, { x: 40 / 320, y: 210 / 240 }];
    const z = zielmass(e, 320, 240, 2000);
    expect(z).toEqual({ b: 240, h: 180 });
    const aus = entzerren(im, e, z);
    expect(pixel(aus, 120, 90)[0]).toBeLessThan(30);
    expect(pixel(aus, 10, 10)[0]).toBeGreaterThan(240);
    expect(pixel(aus, 230, 170)[0]).toBeGreaterThan(240);
  });
  it('Zielmaß begrenzt die lange Seite', () => {
    expect(zielmass(GANZES_BILD, 4000, 3000, 2000)).toEqual({ b: 2000, h: 1500 });
  });
  it('drehen um 90° vertauscht Breite und Höhe und bewegt die Ecke', () => {
    const im = bild(3, 2, (x, y) => (x === 0 && y === 0 ? [255, 0, 0] : [0, 0, 0]));
    const d = drehen(im, 1);
    expect([d.b, d.h]).toEqual([2, 3]);
    expect(pixel(d, 1, 0)).toEqual([255, 0, 0]); // oben links → oben rechts
    expect(drehen(im, 4)).toBe(im);
    expect(pixel(drehen(im, 2), 2, 1)).toEqual([255, 0, 0]);
  });
});

describe('PDF aus Seiten', () => {
  const jpeg = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i === 0 ? 0xff : i === 1 ? 0xd8 : i % 251));
  it('baut eine gültige Struktur: Kopf, Objekte, xref mit passenden Offsets, Trailer', () => {
    const pdf = pdfBauen([{ jpeg: jpeg(300), b: 100, h: 141 }, { jpeg: jpeg(50), b: 200, h: 100 }], 'Marsch (Test)');
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/Title (Marsch \\(Test\\))');
    expect(text).toContain('/MediaBox [0 0 595 839]');
    expect(text).toContain('/MediaBox [0 0 842 421]');
    const start = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const zeilen = text.slice(start).split('\n');
    const anzahl = Number(zeilen[1].split(' ')[1]);
    expect(anzahl).toBe(4 + 2 * 3);
    for (let i = 1; i < anzahl; i++) {
      const off = Number(zeilen[2 + i].slice(0, 10));
      expect(text.slice(off, off + `${i} 0 obj`.length)).toBe(`${i} 0 obj`);
    }
    // Die JPEG-Bytes liegen unverändert drin.
    const bild1 = text.indexOf('/Filter /DCTDecode /Length 300 >>\nstream\n') + '/Filter /DCTDecode /Length 300 >>\nstream\n'.length;
    expect([...pdf.slice(bild1, bild1 + 4)]).toEqual([0xff, 0xd8, 2, 3]);
  });
  it('ohne Seiten gibt es keine PDF', () => {
    expect(() => pdfBauen([], 'x')).toThrow(/Keine Seiten/);
  });
  it('PDF-Text: nur ASCII, Klammern geschützt', () => {
    expect(pdfText('Märsche (Trio) \\ ü')).toBe('Marsche \\(Trio\\) \\\\ u');
  });
  it('Dateiname aus Titel und Datum', () => {
    expect(scanDateiname(' Alte Kameraden: 1. Klar? ', new Date(2026, 9, 23))).toBe('Alte Kameraden 1. Klar (Scan 2026-10-23).pdf');
    expect(scanDateiname('', new Date(2026, 0, 5))).toBe('Scan (Scan 2026-01-05).pdf');
  });
});
