// Fachlogik des Notenbetrachters: Blättern, Dateien zuordnen, Anmerkungen.
// Rein und getestet — die Oberfläche rechnet nichts davon selbst.

export type Blaettermodus = 'ganz' | 'halb' | 'linie';

// Eine Ansicht ist das, was gerade auf dem Bildschirm steht: eine ganze Seite,
// oder beim Halbseiten-Blättern oben schon der Anfang der nächsten Seite und
// unten noch der Rest der aktuellen (wie bei Notenpulten üblich) — oder zwei
// Seiten nebeneinander (B-13, wie ein aufgeschlagenes Heft).
export type Ansicht =
  | { art: 'ganz'; seite: number }
  | { art: 'halb'; oben: number; unten: number; schnitt: number }
  | { art: 'doppel'; links: number; rechts: number };

// Zwei Seiten nebeneinander: Einstellung je Gerät (localStorage), gilt im
// Querformat; beim Anmerken und Blättern-Einstellen zeigt der Betrachter
// weiter eine Seite.
export const ZWEI_SEITEN = 'ueben:zwei-seiten';

// Wie ein Stück blättert (gespeichert am Stück): modus gilt für alle Seiten,
// jeSeite weicht für einzelne davon ab (F-16) — z. B. eigene Linie, aber
// Seite 2 ganz. Die Linien bleiben je Seite stehen, auch wenn die Seite
// gerade anders blättert: Wechselt sie zurück auf Linie, ist sie wieder da.
export interface Blaettern {
  modus: Blaettermodus;
  linien: Record<number, number>;
  jeSeite?: Record<number, Blaettermodus>;
}

const MODI: readonly string[] = ['ganz', 'halb', 'linie'];
const gueltig = (m: unknown): m is Blaettermodus => typeof m === 'string' && MODI.includes(m);

// Liegt die Linie zu nah am Rand, wird ganz geblättert.
const sinnvoll = (s: number) => s > 0.05 && s < 0.95;

export function ansichten(seiten: number, modus: Blaettermodus, linien: Record<number, number> = {}, jeSeite: Record<number, Blaettermodus> = {}, doppel = false): Ansicht[] {
  const liste: Ansicht[] = [];
  if (doppel) {
    // Zwei Seiten nebeneinander: 1–2, 3–4, …; eine übrige letzte Seite allein.
    // Halb und Linie gelten hier nicht — geblättert wird je Doppelseite.
    for (let p = 1; p <= seiten; p += 2) liste.push(p < seiten ? { art: 'doppel', links: p, rechts: p + 1 } : { art: 'ganz', seite: p });
    return liste;
  }
  for (let p = 1; p <= seiten; p++) {
    liste.push({ art: 'ganz', seite: p });
    const m = gueltig(jeSeite[p]) ? jeSeite[p] : modus;
    if (p < seiten && m !== 'ganz') {
      const s = m === 'halb' ? 0.5 : (linien[p] ?? 0.5);
      if (sinnvoll(s)) liste.push({ art: 'halb', oben: p + 1, unten: p, schnitt: s });
    }
  }
  return liste;
}

export function seitenModus(b: Blaettern, seite: number): Blaettermodus {
  const m = b.jeSeite?.[seite];
  return gueltig(m) ? m : b.modus;
}

// Geblättert wird an Seite 1 bis zur vorletzten.
const blaetterSeiten = (seiten: number) => Array.from({ length: Math.max(0, seiten - 1) }, (_, i) => i + 1);

// Blättern alle Seiten gleich? (Die letzte zählt nicht, dort wird nicht geblättert.)
export function einheitlich(b: Blaettern, seiten: number): boolean {
  const modi = blaetterSeiten(seiten).map((p) => seitenModus(b, p));
  return modi.every((m) => m === modi[0]);
}

// Abweichungen nur, wo sie etwas ändern; blättern alle gleich, ist das der Modus.
function ordnen(modus: Blaettermodus, linien: Record<number, number>, jeSeite: Record<number, unknown>, seiten: number): Blaettern {
  const p = blaetterSeiten(seiten);
  const modi = p.map((s) => (gueltig(jeSeite[s]) ? jeSeite[s] : modus));
  if (modi.every((m) => m === modi[0])) return { modus: modi[0] ?? modus, linien };
  const je: Record<number, Blaettermodus> = {};
  p.forEach((s, i) => { if (modi[i] !== modus) je[s] = modi[i]; });
  return { modus, linien, jeSeite: je };
}

// Blättern einer Seite setzen — oder für alle: dann fallen die Abweichungen
// weg. Die letzte Seite blättert nicht, dort ändert sich nichts.
export function modusSetzen(b: Blaettern, seiten: number, seite: number | 'alle', m: Blaettermodus): Blaettern {
  if (seite === 'alle') return { modus: m, linien: b.linien };
  if (seite < 1 || seite >= seiten) return b;
  return ordnen(b.modus, b.linien, { ...b.jeSeite, [seite]: m }, seiten);
}

// Gespeicherten Wert lesen (auch aus einer Sicherung): Fehlendes heißt ganz,
// Unsinn fällt weg, Abweichungen werden geordnet.
export function blaetternLesen(roh: unknown, seiten: number): Blaettern {
  const r = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const modus = gueltig(r.modus) ? r.modus : 'ganz';
  const linien: Record<number, number> = {};
  if (r.linien && typeof r.linien === 'object') {
    for (const [k, v] of Object.entries(r.linien)) if (typeof v === 'number' && Number.isFinite(v)) linien[Number(k)] = v;
  }
  const je = r.jeSeite && typeof r.jeSeite === 'object' ? r.jeSeite as Record<number, unknown> : {};
  return ordnen(modus, linien, je, seiten);
}

// Zeigt die Ansicht die Seite ganz (allein oder als Hälfte einer Doppelseite)?
export const zeigtGanz = (a: Ansicht, seite: number) =>
  (a.art === 'ganz' && a.seite === seite) || (a.art === 'doppel' && (a.links === seite || a.rechts === seite));

// Index der Ansicht, die eine Seite ganz zeigt (für Sprünge und Moduswechsel).
export function ansichtVonSeite(liste: Ansicht[], seite: number): number {
  const i = liste.findIndex((a) => zeigtGanz(a, seite));
  return i < 0 ? 0 : i;
}

// Welche Seite „gilt“ gerade (für Seitenanzeige und Zeichnen)?
export function hauptseite(a: Ansicht): number {
  return a.art === 'ganz' ? a.seite : a.art === 'halb' ? a.oben : a.links;
}

// Die Seiten, die eine Ansicht (teils) zeigt.
export function seitenVon(a: Ansicht): number[] {
  return a.art === 'ganz' ? [a.seite] : a.art === 'halb' ? [a.oben, a.unten] : [a.links, a.rechts];
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
// E-12 (Schere): „schnitt“ teilt die Seite in Höhe y und schiebt alles
// darunter um `abstand` (in Seitenhöhen) nach unten — die Lücke ist Platz zum
// Schreiben. Was in der Lücke steht, trägt `luecke` (id des Schnitts), sein y
// zählt ab der Oberkante der Lücke, in Seitenhöhen wie sonst auch. Alles
// andere bleibt in den Koordinaten der ursprünglichen Seite (schnitte.ts).
// „sticker“ ist ein Ausschnitt `von` einer Seite (Rechteck, Anteile), auf
// diese Seite bei x/y in Breite b gelegt (die Höhe folgt dem Ausschnitt) —
// oder, mit `luecke`, in die Lücke eines Schnitts.
export type Anmerkung =
  | { id: string; art: 'stift' | 'marker'; farbe: string; breite: number; punkte: number[]; luecke?: string }
  | { id: string; art: 'text'; farbe: string; groesse: number; x: number; y: number; text: string; luecke?: string }
  | { id: string; art: 'radiert'; breite: number; punkte: number[] }
  // Stempel (E-04): Zeichen aus stempel.ts, Mitte bei x/y, groesse = Kastenbreite.
  | { id: string; art: 'stempel'; zeichen: string; x: number; y: number; groesse: number; farbe: string; luecke?: string }
  | { id: string; art: 'schnitt'; y: number; abstand: number }
  | { id: string; art: 'sticker'; von: { seite: number; x: number; y: number; b: number; h: number }; x: number; y: number; b: number; luecke?: string };

// Trifft der Radierer (Punkt, Radius relativ zur Seitenbreite) eine Anmerkung?
// Schnitte und Sticker nimmt er nicht weg (dafür gibt es die Schere).
export function getroffen(a: Anmerkung, x: number, y: number, radius: number, seitenformat = 1.414): boolean {
  if (a.art === 'schnitt' || a.art === 'sticker' || a.art === 'radiert') return false;
  if (a.art === 'stempel') {
    const b = a.groesse / 2, h = a.groesse / seitenformat / 2;
    return x >= a.x - b - radius && x <= a.x + b + radius && y >= a.y - h - radius && y <= a.y + h + radius;
  }
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

// Radieren schneidet (E-07): Ein Strich verliert nur das Stück, über das der
// Radierer fährt — aus einer langen Linie, in der Mitte radiert, werden zwei.
// Rechnet in Seitenbreiten (y mal Seitenformat). r: wie nah die Mittellinie
// dem Radierer kommen darf. Liefert die übrigen Stücke, [] wenn nichts
// bleibt, null wenn der Strich gar nicht getroffen ist. Winzige Reste fallen weg.
const MIN_REST = 0.002;
export function strichKappen(p: number[], x: number, y: number, r: number, seitenformat = 1.414): number[][] | null {
  const f = seitenformat, r2 = r * r;
  const innen = (i: number) => (p[i] - x) ** 2 + ((p[i + 1] - y) * f) ** 2 <= r2;
  if (p.length < 4) return p.length === 2 && innen(0) ? [] : null;
  const teile: number[][] = [];
  let teil: number[] = innen(0) ? [] : [p[0], p[1]];
  let getroffen = false;
  const abschliessen = () => { if (teil.length >= 4) teile.push(teil); teil = []; };
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
    // Wo liegt die Strecke A→B im Kreis? |A + t(B−A) − M|² = r², t in [0, 1]
    const dx = bx - ax, dy = (by - ay) * f, ex = ax - x, ey = (ay - y) * f;
    const a = dx * dx + dy * dy, b = 2 * (ex * dx + ey * dy), c = ex * ex + ey * ey - r2;
    let t0 = 1, t1 = 0;
    if (a > 0) {
      const d = b * b - 4 * a * c;
      if (d > 0) { t0 = Math.max(0, (-b - Math.sqrt(d)) / (2 * a)); t1 = Math.min(1, (-b + Math.sqrt(d)) / (2 * a)); }
    } else if (c <= 0) { t0 = 0; t1 = 1; }
    if (t1 - t0 <= 1e-9) { teil.push(bx, by); continue; }
    getroffen = true;
    if (t0 > 0) teil.push(ax + t0 * (bx - ax), ay + t0 * (by - ay));
    abschliessen();
    if (t1 < 1) teil = [ax + t1 * (bx - ax), ay + t1 * (by - ay), bx, by];
  }
  if (!getroffen) return null;
  abschliessen();
  const laenge = (q: number[]) => {
    let l = 0;
    for (let i = 0; i + 3 < q.length; i += 2) l += Math.hypot(q[i + 2] - q[i], (q[i + 3] - q[i + 1]) * f);
    return l;
  };
  return teile.filter((q) => laenge(q) >= MIN_REST);
}

// Ein Wisch kann schneller sein als die Ereignisse: Zwischen zwei Punkten
// wird in Schritten von höchstens einem halben Radius nachgezogen, damit
// keine Lücke stehen bleibt. Liefert die Punkte nach von (ohne von selbst).
export function radierWeg(von: { x: number; y: number } | null, x: number, y: number, radius: number, seitenformat = 1.414): { x: number; y: number }[] {
  if (!von) return [{ x, y }];
  const n = Math.min(200, Math.ceil(Math.hypot(x - von.x, (y - von.y) * seitenformat) / (radius / 2)));
  if (n <= 1) return [{ x, y }];
  return Array.from({ length: n }, (_, i) => ({ x: von.x + ((x - von.x) * (i + 1)) / n, y: von.y + ((y - von.y) * (i + 1)) / n }));
}

// Ein Punkt eines Radier-Wischs (radius: halbe Radiererbreite): Getroffene
// Striche werden an der Stelle geschnitten, getroffene Texte fallen ganz
// weg. Geschnittene Stücke bekommen neue ids — so landet die alte id unter
// „entfernt“, und eine Sicherung bringt den ganzen Strich nicht zurück.
// Liegen übernommene Markierungen auf der Seite (ebene), wird zusätzlich die
// Radier-Spur dieses Wischs verlängert — oder begonnen, wenn es noch keine
// gibt (spur = ihre id). Radier-Spuren selbst werden nicht weg-radiert.
// Ohne Änderung kommt dieselbe Liste zurück.
export function radierZug(
  objekte: Anmerkung[], x: number, y: number, radius: number, seitenformat: number,
  spur: string | null, ebene: boolean, neueId: () => string,
): { objekte: Anmerkung[]; spur: string | null; geaendert: boolean } {
  let geaendert = false;
  let neu: Anmerkung[] = [];
  for (const a of objekte) {
    if (a.art === 'radiert' || a.art === 'schnitt' || a.art === 'sticker') { neu.push(a); continue; }
    if (a.art === 'text' || a.art === 'stempel') {
      // Texte und Stempel gehen ganz weg.
      if (getroffen(a, x, y, radius, seitenformat)) geaendert = true;
      else neu.push(a);
      continue;
    }
    // Runde Enden reichen eine halbe Strichbreite über den Schnitt hinaus,
    // die geraden des Markers nicht — so endet die Lücke am Radierer.
    const r = a.art === 'marker' ? Math.hypot(radius, a.breite / 2) : radius + a.breite / 2;
    const teile = strichKappen(a.punkte, x, y, r, seitenformat);
    if (!teile) { neu.push(a); continue; }
    geaendert = true;
    for (const punkte of teile) neu.push({ ...a, id: neueId(), punkte });
  }
  if (ebene) {
    const da = spur !== null && neu.some((a) => a.id === spur);
    if (da) neu = neu.map((a) => (a.id === spur && a.art === 'radiert' ? { ...a, punkte: [...a.punkte, x, y] } : a));
    else { spur = neueId(); neu = [...neu, { id: spur, art: 'radiert', breite: radius * 2, punkte: [x, y] }]; }
    geaendert = true;
  }
  return { objekte: geaendert ? neu : objekte, spur, geaendert };
}

// ── Bibliothek ──
// A–Z wie im Finder: Zahlen als Zahlen („2 …“ vor „10 …“), Groß/klein egal;
// bei gleichem Titel nach Stimme.
const sammler = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
export function nachTitel(a: { titel: string; stimme: string }, b: { titel: string; stimme: string }): number {
  return sammler.compare(a.titel, b.titel) || sammler.compare(a.stimme, b.stimme);
}

// „11.10., 18:48“ — aus einem anderen Jahr „24.12.2025, 09:30“.
export function zeitpunkt(t: number, jetzt = Date.now()): string {
  const d = new Date(t), z = (x: number) => String(x).padStart(2, '0');
  const jahr = d.getFullYear() === new Date(jetzt).getFullYear() ? '' : String(d.getFullYear());
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${jahr}, ${z(d.getHours())}:${z(d.getMinutes())}`;
}
