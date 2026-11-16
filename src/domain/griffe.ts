// Griffweisen (I-13): Grifftabelle der B-Klarinette, Böhm-System mit
// 17 Klappen und 6 Ringen, notiert E3 (MIDI 52) bis C7 (MIDI 96). Je Ton der
// Standardgriff, gängige Alternativen (links/rechts kleiner Finger,
// chromatische Griffe, Resonanzgriffe der Kehltöne, Altissimo) und Triller
// für häufige Fälle. Rein, getestet (tests/griffe.test.ts).
//
// QUELLE: The Woodwind Fingering Guide (WFG), Boehm-System-Klarinette,
//   https://www.wfg.woodwind.org/clarinet/ — Schreibweise cl_fing.html;
//   Grundgriffe cl_bas_1/2/3.html; Alternativen cl_alt_1/2/4.html;
//   Triller cl_tr2_1/2.html (abgerufen 2026-11-16). Jeder Griff steht hier in
//   der WFG-Schreibweise (`wfg`) und wird daraus gelesen, damit er sich Zeichen
//   für Zeichen gegen die Quelle prüfen lässt. Für das obere Altissimo (Gis6–C7)
//   nennt der WFG keinen „Basic“-Griff — Standard ist hier der erste dort
//   aufgeführte. Weggelassen: Griffe für Zusatzklappen, die das 17/6-Modell
//   nicht hat (linke As/Es-Klappe, 7. Ring, artikuliertes Cis/Gis) und Zeilen,
//   deren Zuordnung beim Abruf nicht eindeutig war.
//
// WFG-Schreibweise: `R` Überblasklappe, `T` Daumenloch; links `A`/`G#`
// (A- und Gis-Klappe), Löcher 1–3 (`-` = offen), `Eb` (Es/B-Sliver zwischen
// 2 und 3), kleiner Finger `E`, `F`, `F#`, `C#`; nach `|` rechts die
// Seitenklappen 1–4 (4 = Es/B), Löcher 1–3, `B` (H/Fis-Sliver vor Loch 3),
// kleiner Finger `E`, `F`, `F#`, `G#`.

export type Taste =
  | 'register' | 'daumen' | 'a' | 'gis' | 'l1' | 'l2' | 'l3' | 'esSliver'
  | 'lE' | 'lF' | 'lFis' | 'lCis'
  | 's1' | 's2' | 's3' | 's4' | 'r1' | 'r2' | 'r3' | 'hSliver'
  | 'rE' | 'rF' | 'rFis' | 'rGis';

export const TASTEN: readonly { id: Taste; name: string }[] = [
  { id: 'register', name: 'Überblasklappe' },
  { id: 'daumen', name: 'Daumenloch' },
  { id: 'a', name: 'A-Klappe' },
  { id: 'gis', name: 'Gis-Klappe' },
  { id: 'l1', name: 'links 1' },
  { id: 'l2', name: 'links 2' },
  { id: 'l3', name: 'links 3' },
  { id: 'esSliver', name: 'Es/B-Sliver (links)' },
  { id: 'lE', name: 'E/H-Klappe links' },
  { id: 'lF', name: 'F/C-Klappe links' },
  { id: 'lFis', name: 'Fis/Cis-Klappe links' },
  { id: 'lCis', name: 'Cis/Gis-Klappe' },
  { id: 's1', name: 'Seitenklappe 1' },
  { id: 's2', name: 'Seitenklappe 2' },
  { id: 's3', name: 'Seitenklappe 3' },
  { id: 's4', name: 'Seitenklappe 4 (Es/B)' },
  { id: 'r1', name: 'rechts 1' },
  { id: 'r2', name: 'rechts 2' },
  { id: 'r3', name: 'rechts 3' },
  { id: 'hSliver', name: 'H/Fis-Sliver (rechts)' },
  { id: 'rE', name: 'E/H-Klappe rechts' },
  { id: 'rF', name: 'F/C-Klappe rechts' },
  { id: 'rFis', name: 'Fis/Cis-Klappe rechts' },
  { id: 'rGis', name: 'As/Es-Klappe rechts' },
];
const TASTEN_NAME = new Map(TASTEN.map((t) => [t.id, t.name]));
export const tastenName = (t: Taste) => TASTEN_NAME.get(t) ?? t;

export type GriffArt = 'standard' | 'alternative' | 'triller';
export interface Griff {
  midi: number;           // notiert
  art: GriffArt;
  tasten: Taste[];        // gedrückt bzw. geschlossen
  wfg: string;            // Quelle, WFG-Schreibweise
  hinweis?: string;
  nach?: number;          // Triller: oberer Ton
  triller?: Taste[];      // Triller: diese Tasten bewegen
}

export const BEREICH = { von: 52, bis: 96 } as const;

// ── Lagen ── WFG: Chalumeau bis B4 (Kehltöne G4–B4 darin), Clarion H4–C6,
// Altissimo ab Cis6.
export type Lage = 'chalumeau' | 'kehltoene' | 'clarion' | 'altissimo';
export const LAGE_NAMEN: Record<Lage, string> = { chalumeau: 'Chalumeau', kehltoene: 'Kehltöne', clarion: 'Clarion', altissimo: 'Altissimo' };
export function lageVon(midi: number): Lage {
  if (midi <= 66) return 'chalumeau';
  if (midi <= 70) return 'kehltoene';
  if (midi <= 84) return 'clarion';
  return 'altissimo';
}

// ── WFG-Schreibweise lesen ──
const LINKS_KLEIN: [string, Taste][] = [['F#', 'lFis'], ['C#', 'lCis'], ['E', 'lE'], ['F', 'lF']];
const RECHTS_KLEIN: [string, Taste][] = [['F#', 'rFis'], ['G#', 'rGis'], ['E', 'rE'], ['F', 'rF']];
const LOCH = /^[123-]$/;

function kleineFinger(s: string, tabelle: [string, Taste][], wfg: string): { rest: string; tasten: Taste[] } {
  const tasten: Taste[] = [];
  let rest = s;
  // von hinten: der letzte Teil sind Klappen des kleinen Fingers
  for (;;) {
    const treffer = tabelle.find(([k]) => rest.endsWith(k) && !/[0-9-]$/.test(k));
    if (!treffer) break;
    rest = rest.slice(0, -treffer[0].length);
    tasten.unshift(treffer[1]);
  }
  if (/[A-Za-z#]$/.test(rest) && !rest.endsWith('B') && !rest.endsWith('Eb')) throw new Error(`Unbekannte Klappe in „${wfg}“`);
  return { rest, tasten };
}

function loecher(s: string, seite: 'l' | 'r', wfg: string): Taste[] {
  if (s.length !== 3 || ![...s].every((z) => LOCH.test(z))) throw new Error(`Löcher nicht lesbar in „${wfg}“`);
  const t: Taste[] = [];
  [...s].forEach((z, i) => { if (z !== '-') { if (z !== String(i + 1)) throw new Error(`Loch ${z} an Stelle ${i + 1} in „${wfg}“`); t.push(`${seite}${i + 1}` as Taste); } });
  return t;
}

export function griffLesen(wfg: string): Taste[] {
  const s = wfg.replace(/[–—]/g, '-').trim();
  const [kopf, rumpf] = s.includes(' ') ? [s.slice(0, s.indexOf(' ')), s.slice(s.indexOf(' ') + 1)] : ['', s];
  if (!/^R?T?$/.test(kopf)) throw new Error(`Daumen nicht lesbar in „${wfg}“`);
  const teile = rumpf.split('|');
  if (teile.length !== 2) throw new Error(`Ohne „|“: „${wfg}“`);
  const tasten: Taste[] = [];
  if (kopf.includes('R')) tasten.push('register');
  if (kopf.includes('T')) tasten.push('daumen');

  // links: [A|G#] Löcher (mit Eb vor Loch 3) [kleiner Finger]
  let links = teile[0];
  if (links.startsWith('A')) { tasten.push('a'); links = links.slice(1); } else if (links.startsWith('G#')) { tasten.push('gis'); links = links.slice(2); }
  const lk = kleineFinger(links, LINKS_KLEIN, wfg);
  let lr = lk.rest;
  const es = lr.indexOf('Eb');
  if (es >= 0) { if (es !== 2) throw new Error(`Eb an falscher Stelle in „${wfg}“`); lr = lr.slice(0, 2) + lr.slice(4); }
  tasten.push(...loecher(lr, 'l', wfg));
  if (es >= 0) tasten.push('esSliver');
  tasten.push(...lk.tasten);

  // rechts: [Seitenklappen 1–4] Löcher (mit B vor Loch 3) [kleiner Finger]
  const rk = kleineFinger(teile[1], RECHTS_KLEIN, wfg);
  let rr = rk.rest;
  let sliver = false;
  if (rr.length >= 4 && rr[rr.length - 2] === 'B') { sliver = true; rr = rr.slice(0, -2) + rr.slice(-1); }
  if (rr.length < 3) throw new Error(`Rechte Hand nicht lesbar in „${wfg}“`);
  const seiten = rr.slice(0, -3);
  if (!/^1?2?3?4?$/.test(seiten)) throw new Error(`Seitenklappen nicht lesbar in „${wfg}“`);
  for (const z of seiten) tasten.push(`s${z}` as Taste);
  tasten.push(...loecher(rr.slice(-3), 'r', wfg));
  if (sliver) tasten.push('hSliver');
  tasten.push(...rk.tasten);
  return tasten;
}

// ── Daten ── [wfg, Hinweis?] je Ton; der erste Eintrag ist der Standardgriff.
// Triller: [wfg, oberer Ton, bewegte Tasten (WFG-rot), Hinweis].
type Zeile = [string, string?];
type TrillerZeile = [string, number, Taste[], string];

const L_KOMBI = 'mit Griffen für den linken kleinen Finger kombinieren';
const R_KOMBI = 'mit Griffen für den rechten kleinen Finger kombinieren';
const RESONANZ = 'Resonanzgriff: voller, stabiler — rechte Finger nach Klang ausprobieren';

const DATEN: Record<number, Zeile[]> = {
  // Chalumeau (cl_bas_1, cl_alt_1)
  52: [['T 123E|123', R_KOMBI], ['T 123|123E', L_KOMBI], ['T 123E|123F', 'im Wechsel mit F3']],
  53: [['T 123|123F', L_KOMBI], ['T 123F|123', R_KOMBI]],
  54: [['T 123F#|123', R_KOMBI], ['T 123|123F#', L_KOMBI], ['T 123F#|123F', 'im Wechsel mit F3']],
  55: [['T 123|123']],
  56: [['T 123|123G#']],
  57: [['T 123|12-']],
  58: [['T 123|1--']],
  59: [['T 123|-2-'], ['T 123|1-B-', 'chromatisch — im Wechsel mit B3 oder F4']],
  60: [['T 123|---']],
  61: [['T 123C#|---']],
  62: [['T 12-|---']],
  63: [['T 12-|4---'], ['T 12Eb-|---', 'chromatisch, für Triller — im Wechsel mit D4'], ['T 1--|1--', 'Gabelgriff, etwas hoch — für schnelle Wechsel mit rechts 1'], ['T 1--|-2-', 'Gabelgriff, etwas hoch — für schnelle Wechsel mit rechts 2']],
  64: [['T 1--|---']],
  65: [['T ---|---']],
  66: [['1--|---'], ['T ---|34---', 'chromatisch — für schnelle Wechsel mit F4']],
  // Kehltöne (cl_alt_1)
  67: [['---|---'], ['---|123', RESONANZ]],
  68: [['G#---|---'], ['T G#---|34---', 'im Wechsel mit Fis4']],
  69: [['A---|---'], ['A---|-23F', 'voller, weniger luftig'], ['A---|123', RESONANZ]],
  70: [['R A---|---'], ['A---|2---', 'Seitenklappe — für schnelle Wechsel mit A4'], ['R A--3|1-3F', 'bessere Intonation, klarer'],
    ['R A-23|-23F', 'voller Klang, gut in der Stimmung'], ['R A123|-23', 'gute Intonation, glatte Übergänge']],
  // Clarion (cl_bas_2, cl_alt_2)
  71: [['RT 123E|123', R_KOMBI], ['RT 123|123E', L_KOMBI], ['RT 123E|123F', 'im Wechsel mit C5'], ['RT A123E|123', 'offener Klang, für lange Töne']],
  72: [['RT 123|123F', L_KOMBI], ['RT 123F|123', R_KOMBI]],
  73: [['RT 123F#|123', R_KOMBI], ['RT 123|123F#', L_KOMBI], ['RT 123F#|123F', 'im Wechsel mit C5']],
  74: [['RT 123|123']],
  75: [['RT 123|123G#']],
  76: [['RT 123|12-']],
  77: [['RT 123|1--']],
  78: [['RT 123|-2-'], ['RT 123|1-B-', 'chromatisch — im Wechsel mit B4 oder F5'], ['RT 123|--3', 'im Wechsel mit D5']],
  79: [['RT 123|---']],
  80: [['RT 123C#|---'], ['RT 12-|12-', 'für Wechsel mit Griffen der rechten Hand']],
  81: [['RT 12-|---']],
  82: [['RT 12-|4---'], ['RT 12Eb-|---', 'chromatisch, für Triller — im Wechsel mit A5'], ['RT 1--|1--', 'Gabelgriff — für schnelle Wechsel mit rechts 1'], ['RT 1--|-2-', 'Gabelgriff, etwas hoch — für schnelle Wechsel']],
  83: [['RT 1--|---'], ['RT -23F#|123', 'im Wechsel mit tiefen Altissimo-Tönen']],
  84: [['RT ---|---'], ['RT -23|123', 'bessere Intonation, gut im ff'], ['RT ---|123', 'für große Sprünge (z. B. von D5) und pp'], ['RT --3|4123', 'für leise Einsätze und Sprünge aus D5']],
  // Altissimo (cl_bas_3; ab Gis6 cl_alt_4)
  85: [['RT -23|12-']],
  86: [['RT -23|1--G#']],
  87: [['RT -23|1-B-G#'], ['RT -23|--3G#', 'im Wechsel mit tiefen Clarion-Tönen'], ['RT -23|-2-G#', 'etwas tief — für schnelle Wechsel']],
  88: [['RT -23|---G#']],
  89: [['RT -23C#|---G#'], ['RT 123C#|123', 'zum Binden aus tieferen Lagen, für pp']],
  90: [['RT -2-|---G#'], ['RT 12-|4---G#', 'bessere Intonation, spricht in allen Lautstärken an, für große Sprünge'], ['RT 12-|123G#', 'zum Binden aus tieferen Lagen, stabil in pp und ff']],
  91: [['RT -2-|12-G#'], ['RT 1--|12-G#', 'zum Binden aus dem Clarion']],
  92: [['RT -23F#|1-3'], ['RT -23|1-3F#', 'mit rechtem kleinen Finger'], ['RT ---|1--G#', 'leicht zu greifen, sehr gute Intonation'], ['RT ---|4---G#', 'spricht in allen Lautstärken an, genaue Intonation']],
  93: [['RT -23|---F'], ['RT -23F|---', 'mit linkem kleinen Finger'], ['R ---|12-F#', 'ohne Daumen — spricht schnell an, gut in der Stimmung']],
  94: [['RT G#-23C#|---G#'], ['RT G#-23C#|34---', 'gute Intonation, spricht leicht an']],
  95: [['RT G#12-|12-'], ['RT 12-|12-F#', 'ohne Gis-Klappe']],
  96: [['RT G#1--|1--F#'], ['RT 1--|1--G#', 'ohne Gis-Klappe']],
};

const TRILLER: Record<number, TrillerZeile[]> = {
  // cl_tr2_1 / cl_tr2_2: Grundgriff des unteren Tons, rote Tasten bewegen.
  60: [['T 123|---', 62, ['l3'], 'Triller C–D: links 3 bewegen']],
  62: [['T 12-|4---', 63, ['s4'], 'Triller D–Es: Seitenklappe 4']],
  64: [['T 1--|34---', 66, ['s3', 's4'], 'Triller E–Fis: Seitenklappen 3 und 4']],
  67: [['A---|---', 69, ['a'], 'Triller G–A: A-Klappe']],
  68: [['G#---|2---', 69, ['s2'], 'Triller Gis–A: Seitenklappe 2'], ['G#---|1---', 70, ['s1'], 'Triller Gis–B: Seitenklappe 1']],
  69: [['A---|1---', 71, ['s1'], 'Triller A–H über den Bruch: A-Klappe halten, Seitenklappe 1'], ['A---|2---', 70, ['s2'], 'Triller A–B: Seitenklappe 2']],
  70: [['R A---|2---', 71, ['s2'], 'Triller B–H: Seitenklappe 2'], ['R A---|12---', 72, ['s1', 's2'], 'Triller B–C: Seitenklappen 1 und 2, gut in der Stimmung']],
  72: [['RT 123|123F', 74, ['rF'], 'Triller C–D: F/C-Klappe bewegen']],
  74: [['RT 123|123', 76, ['r3'], 'Triller D–E: rechts 3']],
  77: [['RT 123|1--', 79, ['r1'], 'Triller F–G: rechts 1']],
  79: [['RT 123|---', 81, ['l3'], 'Triller G–A: links 3']],
  81: [['RT 12-|4---', 82, ['s4'], 'Triller A–B: Seitenklappe 4'], ['RT 12Eb-|---', 82, ['esSliver'], 'Triller A–B: Es/B-Sliver']],
  83: [['RT 1--|---', 84, ['l1'], 'Triller H–C: links 1'], ['RT 1--|34---', 85, ['s3', 's4'], 'Triller H–Cis: Seitenklappen 3 und 4']],
};

function bauen(): Griff[][] {
  const je: Griff[][] = [];
  for (let m = BEREICH.von; m <= BEREICH.bis; m++) {
    const zeilen = DATEN[m] ?? [];
    const liste: Griff[] = zeilen.map(([wfg, hinweis], i) => ({
      midi: m, art: i === 0 ? 'standard' : 'alternative', tasten: griffLesen(wfg), wfg, ...(hinweis ? { hinweis } : {}),
    }));
    for (const [wfg, nach, triller, hinweis] of TRILLER[m] ?? []) liste.push({ midi: m, art: 'triller', tasten: griffLesen(wfg), wfg, hinweis, nach, triller });
    je.push(liste);
  }
  return je;
}
const TABELLE = bauen();

export function griffeFuer(midi: number): Griff[] {
  if (!Number.isInteger(midi) || midi < BEREICH.von || midi > BEREICH.bis) return [];
  return TABELLE[midi - BEREICH.von];
}
export const standardGriff = (midi: number): Griff | null => griffeFuer(midi).find((g) => g.art === 'standard') ?? null;
export const trillerFuer = (midi: number): Griff[] => griffeFuer(midi).filter((g) => g.art === 'triller');
export const alleGriffe = (): Griff[] => TABELLE.flat();

// ── Ton aus Namen ── deutsch (C, Cis, Des, D, Es/Dis, E, F, Fis/Ges, G,
// Gis/As, A, B/Ais, H, His, Ces …) oder mit Vorzeichen (#/♯, b/♭; „B“ allein
// ist deutsch = B♭). Oktave wie MIDI (C4 = 60).
const STAMM: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, h: 11 };
export function tonAusName(name: string): number | null {
  const m = /^\s*([A-Ha-h])([a-z#♯♭]*)(-?\d)\s*$/.exec(name);
  if (!m) return null;
  const buchstabe = m[1].toLowerCase(), rest = m[2], oktave = Number(m[3]);
  let stufe: number;
  if (buchstabe === 'b') {
    if (rest === '' || rest === 'es') stufe = 10;            // deutsch B
    else if (rest === 'b' || rest === '♭') stufe = 10;       // englisch B♭
    else if (rest === '#' || rest === '♯') stufe = 0 + 12;   // B♯ = C
    else return null;
  } else {
    stufe = STAMM[buchstabe];
    if (rest === 'is' || rest === '#' || rest === '♯') stufe += 1;
    else if (rest === 'es' || rest === 's' || rest === 'b' || rest === '♭') {
      if (rest === 's' && buchstabe !== 'a' && buchstabe !== 'e') return null; // As, Es
      if (rest === 'es' && (buchstabe === 'a' || buchstabe === 'e')) return null;
      stufe -= 1;
    } else if (rest !== '') return null;
  }
  return (oktave + 1) * 12 + stufe;
}
