// Jam-Karte (I-19): die typischen Session-Stücke mit Form, Tonart und
// Akkorden je Takt — klingend gespeichert, angezeigt notiert für die
// gewählte Stimmung (./akkorde). Nur Akkordfolgen und Form: keine Melodien,
// keine Texte. Notizen nennen Stufen statt Tonarten (gezeigt wird notiert). Die Folgen sind die, die bei Jam-Sessions üblich sind
// (Real-Book-/iReal-Fassungen); Varianten gibt es bei jedem Standard —
// wer anders spielt, legt ein eigenes Stück an.
// Eigene Stücke liegen im localStorage `ueben:jamkarte` und reisen mit der
// Sicherung (./einstellungen). Rein, getestet.

import type { Grabstein } from './einspielen';
import { folgeLesen, folgeText, folgeTransponieren, tonartLesen, tonartSymbol, tonartTransponieren, type Folge, type Richtung, type TonartAngabe } from './akkorde';
import type { Stimmung } from './ueben';

/** Ein Formteil: Name (A, B, Blues …) und Akkorde je Takt als Text ("| Cm7 | F7 |", ASCII, klingend). */
export interface JamTeil { name: string; akkorde: string }

export interface JamStueck {
  id: string;
  titel: string;
  komponist?: string;
  /** "AABA", "12-taktiger Blues" … */
  form: string;
  /** Tonart klingend wie auf dem Leadsheet: "F", "Bb", "Cm". */
  tonart: string;
  /** Gefühl und Tempo: "Medium Swing", "Bossa Nova" … */
  gefuehl?: string;
  teile: JamTeil[];
  /** Skill der Kartei, auf den „Heute gespielt“ zählt. */
  skill?: string;
  /** Selbst angelegt (bearbeitbar, reist mit der Sicherung). */
  eigen?: boolean;
  notiz?: string;
  /** Eigene Stücke: zuletzt gespeichert (Abgleich zweier Geräte, jamStueckeVereinigen). */
  geaendert?: number;
}

const t = (name: string, akkorde: string): JamTeil => ({ name, akkorde });

export const JAM_STUECKE: readonly JamStueck[] = [
  {
    id: 'blues-b', titel: 'Blues in B♭', form: '12-taktiger Jazz-Blues', tonart: 'Bb', gefuehl: 'Medium Swing', skill: 'blues-in-b',
    teile: [t('Blues', '| Bb7 | Eb7 | Bb7 | Fm7 Bb7 | Eb7 | Edim7 | Bb7 | Dm7 G7 | Cm7 | F7 | Bb7 G7 | Cm7 F7 |')],
    notiz: 'Für den Anfang reichen die drei Dominantseptakkorde I7, IV7, V7.',
  },
  {
    id: 'blues-b-einfach', titel: 'Blues in B♭ (einfach)', form: '12-taktiger Blues', tonart: 'Bb', gefuehl: 'Shuffle oder Swing', skill: 'blues-in-b',
    teile: [t('Blues', '| Bb7 | Eb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7 |')],
    notiz: 'Drei Akkorde, darüber die Blues-Tonleiter auf dem Grundton.',
  },
  {
    id: 'blues-f', titel: 'Blues in F', form: '12-taktiger Jazz-Blues', tonart: 'F', gefuehl: 'Medium Swing',
    teile: [t('Blues', '| F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7 |')],
  },
  {
    id: 'moll-blues-c', titel: 'Moll-Blues in C', form: '12-taktiger Moll-Blues', tonart: 'Cm', gefuehl: 'Medium Swing',
    teile: [t('Blues', '| Cm7 | Cm7 | Cm7 | Cm7 | Fm7 | Fm7 | Cm7 | Cm7 | Ab7 | G7 | Cm7 | G7 |')],
    notiz: 'Wie „Mr. P.C.“ — Moll-Pentatonik auf dem Grundton geht über fast alles.',
  },
  {
    id: 'blue-bossa', titel: 'Blue Bossa', komponist: 'Kenny Dorham', form: '16 Takte', tonart: 'Cm', gefuehl: 'Bossa Nova', skill: 'blue-bossa',
    teile: [
      t('A', '| Cm7 | Cm7 | Fm7 | Fm7 | Dm7b5 | G7alt | Cm7 | Cm7 |'),
      t('B', '| Ebm7 | Ab7 | Dbmaj7 | Dbmaj7 | Dm7b5 | G7alt | Cm7 | Dm7b5 G7alt |'),
    ],
    notiz: 'Takt 9–12: ii–V–I nach Dur einen Halbton über dem Grundton (♭II), dann zurück nach Moll.',
  },
  {
    id: 'autumn-leaves', titel: 'Autumn Leaves', komponist: 'Joseph Kosma', form: 'AABC, 32 Takte', tonart: 'Gm', gefuehl: 'Medium Swing', skill: 'autumn-leaves',
    teile: [
      t('A', '| Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7b9 | Gm6 | Gm6 |'),
      t('A', '| Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7b9 | Gm6 | Gm6 |'),
      t('B', '| Am7b5 | D7b9 | Gm6 | Gm6 | Cm7 | F7 | Bbmaj7 | Ebmaj7 |'),
      t('C', '| Am7b5 | D7b9 | Gm7 Gb7 | Fm7 E7 | Ebmaj7 | Am7b5 D7b9 | Gm6 | Gm6 |'),
    ],
    notiz: 'ii–V–I in Dur (Takt 1–4) und in der Moll-Parallele (Takt 5–8) im Wechsel.',
  },
  {
    id: 'summertime', titel: 'Summertime', komponist: 'George Gershwin', form: '16 Takte', tonart: 'Am', gefuehl: 'Langsamer Swing', skill: 'summertime',
    teile: [
      t('A', '| Am6 | E7 | Am6 | Am6 | Dm7 | Dm7 | Bm7b5 | E7 |'),
      t('B', '| Am6 | E7 | Am6 | D7 | C F7 | Bm7b5 E7 | Am6 | Bm7b5 E7 |'),
    ],
    notiz: 'Moll-Pentatonik auf dem Grundton trägt durch das ganze Stück.',
  },
  {
    id: 'fly-me-to-the-moon', titel: 'Fly Me to the Moon', komponist: 'Bart Howard', form: 'ABAB′, 32 Takte', tonart: 'C', gefuehl: 'Medium Swing',
    teile: [
      t('A', '| Am7 | Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 A7 |'),
      t('B', '| Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | Bm7b5 E7 |'),
      t('A', '| Am7 | Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 A7 |'),
      t('B′', '| Dm7 | G7 | Em7 | A7 | Dm7 | G7 | Cmaj7 | Bm7b5 E7 |'),
    ],
    notiz: 'Quintfall fast überall — gut für Guide Tones.',
  },
  {
    id: 'all-the-things-you-are', titel: 'All the Things You Are', komponist: 'Jerome Kern', form: 'AABA′, 36 Takte', tonart: 'Ab', gefuehl: 'Medium Swing',
    teile: [
      t('A', '| Fm7 | Bbm7 | Eb7 | Abmaj7 | Dbmaj7 | Dm7 G7 | Cmaj7 | Cmaj7 |'),
      t('A', '| Cm7 | Fm7 | Bb7 | Ebmaj7 | Abmaj7 | Am7 D7 | Gmaj7 | Gmaj7 |'),
      t('B', '| Am7 | D7 | Gmaj7 | Gmaj7 | F#m7 | B7 | Emaj7 | C7#5 |'),
      t('A′', '| Fm7 | Bbm7 | Eb7 | Abmaj7 | Dbmaj7 | Dbm7 Gb7 | Cm7 | Bdim7 | Bbm7 | Eb7 | Abmaj7 | Gm7b5 C7 |'),
    ],
    notiz: 'Wandert mit ii–V–Is durch fünf Tonarten — der letzte A-Teil hat 12 Takte.',
  },
  {
    id: 'take-the-a-train', titel: 'Take the A Train', komponist: 'Billy Strayhorn', form: 'AABA, 32 Takte', tonart: 'C', gefuehl: 'Medium-Up Swing',
    teile: [
      t('A', '| C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | Dm7 G7 |'),
      t('A', '| C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | C6 |'),
      t('B', '| Fmaj7 | Fmaj7 | Fmaj7 | Fmaj7 | D7 | D7 | Dm7 | G7 |'),
      t('A', '| C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | Dm7 G7 |'),
    ],
    notiz: 'Takt 3–4: II7 mit ♯11 — diese Spannung ist der Klang des Stücks.',
  },
  {
    id: 'so-what', titel: 'So What', komponist: 'Miles Davis', form: 'AABA, 32 Takte (modal)', tonart: 'Dm', gefuehl: 'Medium Swing',
    teile: [
      t('A', '| Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 |'),
      t('A', '| Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 |'),
      t('B', '| Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 |'),
      t('A', '| Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 |'),
    ],
    notiz: 'Dorisch auf dem Grundton, im B-Teil einen Halbton höher.',
  },
  {
    id: 'cantaloupe-island', titel: 'Cantaloupe Island', komponist: 'Herbie Hancock', form: '16 Takte', tonart: 'Fm', gefuehl: 'Funk / gerade Achtel',
    teile: [t('Form', '| Fm7 | Fm7 | Fm7 | Fm7 | Db7 | Db7 | Db7 | Db7 | Dm7 | Dm7 | Dm7 | Dm7 | Fm7 | Fm7 | Fm7 | Fm7 |')],
    notiz: 'Drei Klangflächen à vier Takte: Dorisch, Mixolydisch, Dorisch — Akkord antippen zeigt die Leiter.',
  },
  {
    id: 'watermelon-man', titel: 'Watermelon Man', komponist: 'Herbie Hancock', form: '16-taktiger Blues', tonart: 'F', gefuehl: 'Funk / gerade Achtel',
    teile: [t('Form', '| F7 | F7 | F7 | F7 | Bb7 | Bb7 | F7 | F7 | C7 | Bb7 | C7 | Bb7 | C7 | Bb7 | F7 | F7 |')],
    notiz: 'Blues-Tonleiter auf dem Grundton geht über alles.',
  },
];

// ── Lesen, Umrechnen ──

export interface JamTeilGelesen { name: string; folge: Folge }
export interface JamGelesen { stueck: JamStueck; tonart: TonartAngabe | null; teile: JamTeilGelesen[]; takte: number; fehler: string[] }

/** Ein Stück lesen — klingend wie gespeichert. */
export function jamLesen(s: JamStueck): JamGelesen {
  const teile = s.teile.map((x) => ({ name: x.name, folge: folgeLesen(x.akkorde) }));
  return {
    stueck: s, tonart: tonartLesen(s.tonart), teile,
    takte: teile.reduce((n, x) => n + x.folge.takte.length, 0),
    fehler: teile.flatMap((x) => x.folge.fehler),
  };
}

/** Ein gelesenes Stück für eine Stimmung umrechnen (klingend → notiert). */
export function jamNotiert(g: JamGelesen, st: Stimmung): JamGelesen {
  return {
    ...g,
    tonart: g.tonart ? tonartTransponieren(g.tonart, st, 'zuNotiert') : null,
    teile: g.teile.map((x) => ({ name: x.name, folge: folgeTransponieren(x.folge, st, 'zuNotiert') })),
  };
}

// ── Eigene Stücke ──

export const JAM_SCHLUESSEL = 'ueben:jamkarte';
export const JAM_MAX = 200;

const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

/** Ist das ein gültiges eigenes Stück (Grenzen gegen kaputte Dateien)? */
export function istJamStueck(v: unknown): v is JamStueck {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return text(s.id, 80) && (s.id as string).length > 0 && text(s.titel, 120) && (s.titel as string).trim().length > 0
    && (s.komponist === undefined || text(s.komponist, 120)) && text(s.form, 80) && text(s.tonart, 12)
    && (s.gefuehl === undefined || text(s.gefuehl, 80)) && (s.notiz === undefined || text(s.notiz, 1000))
    && (s.skill === undefined || text(s.skill, 80)) && (s.eigen === undefined || typeof s.eigen === 'boolean')
    && (s.geaendert === undefined || (typeof s.geaendert === 'number' && Number.isFinite(s.geaendert) && s.geaendert > 0))
    && Array.isArray(s.teile) && s.teile.length >= 1 && s.teile.length <= 20
    && s.teile.every((x) => !!x && typeof x === 'object' && text((x as JamTeil).name, 20) && text((x as JamTeil).akkorde, 2000));
}

/** Validator für ./einstellungen: eine Liste eigener Stücke. */
export const jamStueckeGueltig = (v: unknown): v is JamStueck[] => Array.isArray(v) && v.length <= JAM_MAX && v.every(istJamStueck);

/** Gespeichertes lesen: Ungültiges fällt weg, doppelte ids zählen einmal. */
export function jamStueckeLesen(v: unknown): JamStueck[] {
  if (!Array.isArray(v)) return [];
  const ids = new Set<string>();
  return v.filter((x): x is JamStueck => istJamStueck(x) && !ids.has(x.id) && !!ids.add(x.id)).slice(0, JAM_MAX)
    .map((x) => ({ ...x, eigen: true }));
}

/** Eingabe des Formulars: Teile als Zeilen, je Zeile optional "Name:" davor ("A: | Cm7 | F7 |"). */
export function teileAusText(eingabe: string): JamTeil[] {
  const zeilen = eingabe.split('\n').map((z) => z.trim()).filter(Boolean);
  return zeilen.map((z, i) => {
    const m = /^([A-Za-z][A-Za-z0-9′']{0,11})\s*:\s*(.*)$/.exec(z);
    return m ? { name: m[1], akkorde: m[2] } : { name: zeilen.length > 1 ? String.fromCharCode(65 + Math.min(i, 25)) : 'Form', akkorde: z };
  });
}
export const teileAlsText = (teile: readonly JamTeil[]) => teile.map((x) => `${x.name}: ${x.akkorde}`).join('\n');

// ── Entwurf: Teile mit Takten zum Antippen (Akkord-Auswahl im Formular) ──
// Der Text des Formulars bleibt die Quelle; der Entwurf zerlegt ihn in Teile
// und Takte (Symbole, wie getippt — auch Unlesbares bleibt stehen, damit
// nichts verloren geht) und schreibt ihn zurück.

export interface TeilEntwurf { name: string; takte: string[][] }

/** Akkord-Text eines Teils in Takte: Taktstriche trennen (`%` wiederholt den Takt davor), ohne Striche ist jeder Akkord ein Takt. */
export function takteAusText(akkorde: string): string[][] {
  const t = akkorde.replace(/\|\||\|:|:\||[[\]]/g, '|');
  const roh = t.includes('|')
    ? t.split(/[|\n]/).map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+/))
    : t.split(/\s+/).filter(Boolean).map((x) => [x]);
  const takte: string[][] = [];
  for (const takt of roh) {
    if (takt.length === 1 && takt[0] === '%') { if (takte.length) takte.push([...takte[takte.length - 1]]); continue; }
    takte.push(takt);
  }
  return takte;
}

export const entwurfAusText = (eingabe: string): TeilEntwurf[] =>
  teileAusText(eingabe).map((t) => ({ name: t.name, takte: takteAusText(t.akkorde) }));

export const entwurfAlsText = (teile: readonly TeilEntwurf[]): string =>
  teile.map((t) => `${t.name}: ${t.takte.length ? `| ${t.takte.map((x) => x.join(' ')).join(' | ')} |` : ''}`).join('\n');

/** Name für einen neuen Teil: der nächste Buchstabe nach dem letzten (A, B, C …). */
export function naechsterTeilName(teile: readonly TeilEntwurf[]): string {
  const buchstaben = teile.map((t) => /^[A-Z]/.exec(t.name)?.[0]).filter((b): b is string => !!b);
  if (!buchstaben.length) return 'A';
  const hoechster = buchstaben.reduce((a, b) => (a > b ? a : b));
  return hoechster >= 'Z' ? 'Z' : String.fromCharCode(hoechster.charCodeAt(0) + 1);
}

export interface JamEingabe { titel: string; komponist: string; form: string; tonart: string; gefuehl: string; akkorde: string; notiz: string }

/** Formular → eigenes Stück. Eingabe notiert wird nach klingend umgerechnet (gespeichert ist immer klingend).
 *  Fehler: Liste lesbarer Gründe; dann kein Stück. */
export function jamAusEingabe(e: JamEingabe, id: string, eingabe: { richtung: 'klingend' | 'notiert'; stimmung: Stimmung }): { stueck: JamStueck | null; fehler: string[] } {
  const fehler: string[] = [];
  if (!e.titel.trim()) fehler.push('Titel fehlt.');
  const tonart = tonartLesen(e.tonart);
  if (!tonart) fehler.push(`Tonart „${e.tonart}“ verstehe ich nicht (z. B. F, Bb, Cm).`);
  const roh = teileAusText(e.akkorde);
  if (!roh.length) fehler.push('Akkorde fehlen.');
  const zurueck: Richtung = 'zuKlingend';
  const teile: JamTeil[] = [];
  for (const x of roh) {
    const f = folgeLesen(x.akkorde);
    fehler.push(...f.fehler);
    if (!f.takte.length) continue;
    const klingend = eingabe.richtung === 'notiert' ? folgeTransponieren(f, eingabe.stimmung, zurueck) : f;
    teile.push({ name: x.name, akkorde: folgeText(klingend, { ascii: true }) });
  }
  if (fehler.length || !tonart) return { stueck: null, fehler };
  const tonartKlingend = eingabe.richtung === 'notiert' ? tonartTransponieren(tonart, eingabe.stimmung, zurueck) : tonart;
  const stueck: JamStueck = {
    id, titel: e.titel.trim(), form: e.form.trim() || `${teile.reduce((n, x) => n + folgeLesen(x.akkorde).takte.length, 0)} Takte`,
    tonart: tonartSymbol(tonartKlingend, true), teile, eigen: true,
    ...(e.komponist.trim() ? { komponist: e.komponist.trim() } : {}),
    ...(e.gefuehl.trim() ? { gefuehl: e.gefuehl.trim() } : {}),
    ...(e.notiz.trim() ? { notiz: e.notiz.trim() } : {}),
  };
  return { stueck, fehler: [] };
}

/** Stück → Formularwerte (für „Bearbeiten“, klingend). */
export const jamAlsEingabe = (s: JamStueck): JamEingabe => ({
  titel: s.titel, komponist: s.komponist ?? '', form: s.form, tonart: s.tonart, gefuehl: s.gefuehl ?? '', akkorde: teileAlsText(s.teile), notiz: s.notiz ?? '',
});

/** Eigenes Stück einfügen oder ersetzen (gleiche id), neueste oben; mit `jetzt` datiert. */
export function jamSpeichern(liste: readonly JamStueck[], s: JamStueck, jetzt?: number): JamStueck[] {
  const neu = jetzt === undefined ? s : { ...s, geaendert: jetzt };
  return [neu, ...liste.filter((x) => x.id !== s.id)].slice(0, JAM_MAX);
}
/** Löschen braucht einen Grabstein (Art „jamstueck“) — den setzt der Aufrufer. */
export const jamEntfernen = (liste: readonly JamStueck[], id: string) => liste.filter((x) => x.id !== id);

/** Beim Laden einer Sicherung (A-08): je id gewinnt der neuere Stand
 *  (`geaendert`), bei Gleichstand das Gerät; Grabsteine „jamstueck“ nehmen
 *  mit, was seit dem Löschen nicht mehr geändert wurde. Neueste oben. */
export function jamStueckeVereinigen(hier: readonly JamStueck[], dort: readonly JamStueck[], grabsteine: readonly Grabstein[]): JamStueck[] {
  const tot = new Map<string, number>();
  for (const g of grabsteine) if (g.art === 'jamstueck') tot.set(g.id, Math.max(g.am, tot.get(g.id) ?? 0));
  const zeit = (s: JamStueck) => s.geaendert ?? 0;
  const je = new Map<string, JamStueck>();
  for (const s of hier) if (!je.has(s.id)) je.set(s.id, s);
  for (const s of dort) {
    const da = je.get(s.id);
    if (!da || zeit(s) > zeit(da)) je.set(s.id, s);
  }
  return [...je.values()].filter((s) => (tot.get(s.id) ?? -1) < zeit(s))
    .sort((a, b) => zeit(b) - zeit(a)).slice(0, JAM_MAX);
}

/** Mitgelieferte und eigene Stücke für die Liste: eigene zuerst (neueste oben), dann die mitgelieferten. */
export function jamAlle(eigene: readonly JamStueck[]): JamStueck[] {
  return [...eigene, ...JAM_STUECKE];
}

/** Takte in Zeilen zu `je` (Raster der Ansicht, Handy: 4). */
export function zeilen<T>(takte: readonly T[], je = 4): T[][] {
  const z: T[][] = [];
  for (let i = 0; i < takte.length; i += je) z.push(takte.slice(i, i + je));
  return z;
}
