// Fachlogik des Notenbetrachters: Blättern, Dateien zuordnen, Anmerkungen.
// Rein und getestet — die Oberfläche rechnet nichts davon selbst.

export type Blaettermodus = 'ganz' | 'halb' | 'linie';

// Eine Ansicht ist das, was gerade auf dem Bildschirm steht: eine ganze Seite,
// oder beim Halbseiten-Blättern oben schon der Anfang der nächsten Seite und
// unten noch der Rest der aktuellen (wie bei Notenpulten üblich).
export type Ansicht =
  | { art: 'ganz'; seite: number }
  | { art: 'halb'; oben: number; unten: number; schnitt: number };

// Liegt die Linie zu nah am Rand, wird ganz geblättert.
const sinnvoll = (s: number) => s > 0.05 && s < 0.95;

export function ansichten(seiten: number, modus: Blaettermodus, linien: Record<number, number> = {}): Ansicht[] {
  const liste: Ansicht[] = [];
  for (let p = 1; p <= seiten; p++) {
    liste.push({ art: 'ganz', seite: p });
    if (p < seiten && modus !== 'ganz') {
      const s = modus === 'halb' ? 0.5 : (linien[p] ?? 0.5);
      if (sinnvoll(s)) liste.push({ art: 'halb', oben: p + 1, unten: p, schnitt: s });
    }
  }
  return liste;
}

// Index der Ansicht, die eine Seite ganz zeigt (für Sprünge und Moduswechsel).
export function ansichtVonSeite(liste: Ansicht[], seite: number): number {
  const i = liste.findIndex((a) => a.art === 'ganz' && a.seite === seite);
  return i < 0 ? 0 : i;
}

// Welche Seite „gilt“ gerade (für Seitenanzeige und Zeichnen)?
export function hauptseite(a: Ansicht): number {
  return a.art === 'ganz' ? a.seite : a.oben;
}

// „Pomp and Circumstance - Klarinette in B 1.pdf“ → Titel und Stimme.
export function ausDateiname(name: string): { titel: string; stimme: string } {
  const ohne = name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  const teile = ohne.split(/\s+[-–]\s+/);
  if (teile.length >= 2) return { titel: teile.slice(0, -1).join(' – ').trim(), stimme: teile.at(-1)!.trim() };
  return { titel: ohne, stimme: '' };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\.pdf$/, '').replace(/[^a-z0-9]+/g, '');

// Ordnet neu gewählte Dateien vorhandenen Noten zu: erst über den Dateinamen,
// dann über „Titel – Stimme“. Liefert Zuordnung und was übrig blieb.
export function zuordnen<N extends { id: string; dateiname?: string; titel: string; stimme: string }>(
  noten: N[], dateinamen: string[],
): { paare: { notenId: string; datei: number }[]; ohneDatei: N[]; ohneNoten: number[] } {
  const frei = new Set(dateinamen.map((_, i) => i));
  const paare: { notenId: string; datei: number }[] = [];
  const ohneDatei: N[] = [];
  for (const n of noten) {
    const ziele = [n.dateiname, `${n.titel} - ${n.stimme}`, n.titel].filter(Boolean).map((x) => norm(x!));
    const treffer = [...frei].find((i) => ziele.includes(norm(dateinamen[i])));
    if (treffer === undefined) ohneDatei.push(n);
    else { paare.push({ notenId: n.id, datei: treffer }); frei.delete(treffer); }
  }
  return { paare, ohneDatei, ohneNoten: [...frei] };
}

// ── Anmerkungen (Stift, Marker, Text) ── Koordinaten relativ zur Seite (0..1).
// „radiert“ ist eine Radier-Spur über den aus dem PDF übernommenen
// Markierungen (siehe ebene.ts): Sie nimmt diese Ebene an den überstrichenen
// Stellen weg und wird selbst nicht gezeichnet.
export type Anmerkung =
  | { id: string; art: 'stift' | 'marker'; farbe: string; breite: number; punkte: number[] }
  | { id: string; art: 'text'; farbe: string; groesse: number; x: number; y: number; text: string }
  | { id: string; art: 'radiert'; breite: number; punkte: number[] };

// Trifft der Radierer (Punkt, Radius relativ zur Seitenbreite) eine Anmerkung?
export function getroffen(a: Anmerkung, x: number, y: number, radius: number, seitenformat = 1.414): boolean {
  if (a.art === 'text') {
    const h = a.groesse * 1.2, b = a.groesse * 0.55 * a.text.length / seitenformat;
    return x >= a.x - radius && x <= a.x + b + radius && y >= a.y - h - radius && y <= a.y + radius;
  }
  const p = a.punkte;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const ax = p[i], ay = p[i + 1];
    const bx = p[i + 2] ?? ax, by = p[i + 3] ?? ay;
    // Abstand Punkt–Strecke, Höhe auf Seitenformat umgerechnet
    const dx = bx - ax, dy = (by - ay) * seitenformat;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * seitenformat * dy) / len2)) : 0;
    const qx = ax + t * dx - x, qy = (ay * seitenformat + t * dy) - y * seitenformat;
    if (qx * qx + qy * qy <= (radius + a.breite / 2) ** 2) return true;
  }
  return false;
}

// Ein Punkt eines Radier-Wischs: Getroffene eigene Striche und Texte fallen
// weg. Liegen übernommene Markierungen auf der Seite (ebene), wird zusätzlich
// die Radier-Spur dieses Wischs verlängert — oder begonnen, wenn es noch
// keine gibt (spur = ihre id). Radier-Spuren selbst werden nicht weg-radiert.
// Ohne Änderung kommt dieselbe Liste zurück.
export function radierZug(
  objekte: Anmerkung[], x: number, y: number, radius: number, seitenformat: number,
  spur: string | null, ebene: boolean, neueId: () => string,
): { objekte: Anmerkung[]; spur: string | null; geaendert: boolean } {
  let neu = objekte.filter((a) => a.art === 'radiert' || !getroffen(a, x, y, radius, seitenformat));
  let geaendert = neu.length !== objekte.length;
  if (ebene) {
    const da = spur !== null && neu.some((a) => a.id === spur);
    if (da) neu = neu.map((a) => (a.id === spur && a.art === 'radiert' ? { ...a, punkte: [...a.punkte, x, y] } : a));
    else { spur = neueId(); neu = [...neu, { id: spur, art: 'radiert', breite: radius * 2, punkte: [x, y] }]; }
    geaendert = true;
  }
  return { objekte: geaendert ? neu : objekte, spur, geaendert };
}
