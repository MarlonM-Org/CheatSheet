// Lick-Sammlung (I-16): kurze Phrasen lernen, in alle zwölf Tonarten bringen,
// nach dem Prinzip der Skill-Kartei wiederholen. Rein, getestet.
//
// • Ein Lick ist *relativ* gespeichert: je Ton Stammton-Schritte und Halbtöne
//   über dem Grundton der Tonart (wie ein Intervall), dazu die Dauer — so
//   klingt er in jeder Tonart gleich und ist richtig geschrieben (über
//   ./akkorde: tonVersetzen). Akkordsymbole ebenso (Grundton relativ + Endung).
// • Eingabe kompakt als Text in einer Tonart, z. B. in d-Moll
//   `"Dm7" D8 E8 F8 A8 | C4`: Tonnamen international (B = H, Bb = B♭),
//   Dauer 1 2 4 8 16, `.` punktiert, `t` triolisch, `z` Pause; ohne Dauer gilt
//   die vorige. Jeder Ton liegt dem vorigen am nächsten (Tritonus abwärts),
//   `'` eine Oktave höher, `,` tiefer. `|` ist nur Lesehilfe.
// • Wiederholen: Stärke 0–4 nach eigener Einschätzung („sitzt / fast / noch
//   nicht“), daraus der Abstand bis zur nächsten Wiederholung → „heute fällig“.
// • Speicher `ueben:licks` (reist mit der Sicherung): eigene Licks, Stand je
//   Lick, ausgeblendete Start-Licks.

import {
  akkordPruefen, endungText, istAkkord, tonartAusKlasse, tonartLesen, tonartName, tonKlasse, tonSchlicht, tonSymbol, tonVersetzen,
  type Ton, type TonartAngabe,
} from './akkorde';
import { lageWaehlen, TAKT, tonartFolge, triolenFehler, UMFANG, type Abschnitt, type Ereignis, type Reihenfolge } from './etueden';
import { tageSeit } from './skills';

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Ein Ton: Stammton-Schritte `s` und Halbtöne `h` über dem Grundton (auch negativ), Dauer `t` in Ticks (12 je Viertel). */
export interface LickTon { s: number; h: number; t: number }
export interface LickPause { t: number }
export type LickNote = LickTon | LickPause;
/** Akkordsymbol ab Tick `ab`: Grundton relativ (s 0–6, h 0–11), Endung ASCII ("m7", "7b9"). */
export interface LickAkkord { ab: number; s: number; h: number; endung: string }

export interface Lick {
  id: string;
  name: string;
  /** Worüber: "Blues", "ii–V–I", "m7" … (frei, kurz). */
  ueber: string;
  /** Moll-Tonart (Schreibweise des Grundtons: gis-Moll statt as-Moll). */
  moll: boolean;
  noten: LickNote[];
  akkorde: LickAkkord[];
  /** Zum Bearbeiten: der eingegebene Text und die Tonart dazu ("C", "Am"). */
  text: string;
  tonart: string;
}

export const istTon = (n: LickNote): n is LickTon => 's' in n;
export const istPause = (n: LickNote) => !istTon(n);

// ════════════════════════════════════════════════════════════════════
// Eingabe lesen
// ════════════════════════════════════════════════════════════════════

export const LICK_TAKTE_MAX = 8;
export const LICK_NOTEN_MAX = 128;

const DAUER: Record<string, number> = { 1: 48, 2: 24, 4: 12, 8: 6, 16: 3 };
const diatonisch = (t: Ton, midi: number) => 7 * Math.floor((midi - t.vz) / 12) + t.stamm;

/** Bezugshöhe des Grundtons: in Oktave 4 (C4 … H4). */
const grundMidi = (g: Ton) => 60 + tonKlasse(g);

export interface LickGelesen { noten: LickNote[]; akkorde: LickAkkord[]; fehler: string[] }

/** Typografische Zeichen vom Handy (Smart Punctuation) zurück in ASCII. */
const normal = (text: string) => text.replace(/[„“”‟″]/g, '"').replace(/[’‘′´`]/g, "'").replace(/♭/g, 'b').replace(/♯/g, '#');

/** Lick-Text in einer Tonart lesen. */
export function lickLesen(text: string, tonart: TonartAngabe): LickGelesen {
  const fehler: string[] = [];
  const noten: LickNote[] = [];
  const akkorde: LickAkkord[] = [];
  const g = tonart.grund;
  const gm = grundMidi(g);
  let vorige = gm;
  let dauer = 6;
  let pos = 0;
  const tokens = normal(text).match(/"[^"]*"|[^\s|"]+/g) ?? [];
  const dauerLesen = (z: string | undefined, punkt: string | undefined, triole: string | undefined, roh: string): number | null => {
    if (z === undefined && !punkt && !triole) return dauer;
    let d = z !== undefined ? DAUER[z] : dauer;
    if (punkt) d *= 1.5;
    if (triole) d = (d * 2) / 3;
    if (!Number.isInteger(d) || d <= 0) { fehler.push(`„${roh}“: Diese Dauer gibt es nicht.`); return null; }
    dauer = d;
    return d;
  };
  for (const tok of tokens) {
    if (tok.startsWith('"')) {
      const sym = tok.slice(1, -1).trim();
      if (!sym) continue;
      const a = akkordPruefen(sym);
      if (!istAkkord(a)) { fehler.push(a.fehler); continue; }
      akkorde.push({ ab: pos, s: mod(a.grund.stamm - g.stamm, 7), h: mod(tonKlasse(a.grund) - tonKlasse(g), 12), endung: endungText(a.struktur, true) });
      continue;
    }
    const p = /^[zZ](1|2|4|8|16)?(\.)?(t)?$/.exec(tok);
    if (p) {
      const d = dauerLesen(p[1], p[2], p[3], tok);
      if (d === null) continue;
      noten.push({ t: d });
      pos += d;
      continue;
    }
    const m = /^([A-Ha-h])(bb|b|##|#)?([',]*)(1|2|4|8|16)?(\.)?(t)?$/.exec(tok);
    if (!m) { fehler.push(`„${tok}“ verstehe ich nicht.`); continue; }
    const buchstabe = m[1].toUpperCase();
    const stamm = buchstabe === 'H' ? 6 : 'CDEFGAB'.indexOf(buchstabe);
    const vz = m[2] === 'bb' ? -2 : m[2] === 'b' ? -1 : m[2] === '##' ? 2 : m[2] === '#' ? 1 : 0;
    const ton: Ton = { stamm, vz };
    const d = dauerLesen(m[4], m[5], m[6], tok);
    if (d === null) continue;
    let diff = mod(tonKlasse(ton) - vorige, 12);
    if (diff >= 6) diff -= 12;
    let midi = vorige + diff;
    for (const c of m[3]) midi += c === "'" ? 12 : -12;
    vorige = midi;
    noten.push({ s: diatonisch(ton, midi) - diatonisch(g, gm), h: midi - gm, t: d });
    pos += d;
  }
  if (!noten.some((n) => !istPause(n))) fehler.push('Noch keine Töne.');
  if (noten.length > LICK_NOTEN_MAX) fehler.push(`Höchstens ${LICK_NOTEN_MAX} Noten.`);
  if (pos > LICK_TAKTE_MAX * TAKT) fehler.push(`Höchstens ${LICK_TAKTE_MAX} Takte.`);
  if (!fehler.length) {
    const t = triolenFehler(noten.map((n) => ({ ton: istPause(n) ? null : g, midi: 60, ticks: n.t })));
    if (t) fehler.push(t);
  }
  return { noten, akkorde, fehler };
}

// ════════════════════════════════════════════════════════════════════
// In einer Tonart zeigen und spielen
// ════════════════════════════════════════════════════════════════════

const schlicht = (t: Ton): Ton => (Math.abs(t.vz) === 2 ? tonSchlicht(t) : t);
const relativ = (g: Ton, s: number, h: number): Ton => schlicht(tonVersetzen(g, { stufen: mod(s, 7), halbtoene: mod(h, 12) }));

/** Tonart des Licks für eine Tonklasse (notiert): weniger Vorzeichen gewinnt. */
export const lickTonart = (l: Lick, klasse: number): TonartAngabe => tonartAusKlasse(klasse, l.moll);

/** Tonklasse der Eingabe-Tonart (Standard C). */
export function lickKlasse(l: Lick): number {
  const t = tonartLesen(l.tonart);
  return t ? tonKlasse(t.grund) : 0;
}

/** Der Lick in einer Tonart: geschriebene Töne, Lage im Klarinetten-Umfang, Akkordsymbole. */
export function lickAbschnitt(l: Lick, klasse: number, ober: number = UMFANG.bis): Abschnitt {
  const tonart = lickTonart(l, klasse);
  const g = tonart.grund;
  const toene = l.noten.filter(istTon);
  const midi = lageWaehlen(toene.map((n) => tonKlasse(g) + n.h), ober);
  let i = 0, pos = 0;
  const ereignisse: Ereignis[] = l.noten.map((n) => {
    const e: Ereignis = istTon(n) ? { ton: relativ(g, n.s, n.h), midi: midi[i++], ticks: n.t } : { ton: null, midi: 0, ticks: n.t };
    const hier = l.akkorde.filter((a) => a.ab >= pos && a.ab < pos + n.t);
    if (hier.length) e.akkord = hier.map((a) => `${tonSymbol(relativ(g, a.s, a.h), true)}${a.endung}`).join(' ');
    pos += n.t;
    return e;
  });
  return { titel: tonartName(tonart), ereignisse };
}

/** In allen zwölf Tonarten (Standard: Quartenzirkel ab der Eingabe-Tonart). */
export function lickAlle12(l: Lick, ober: number = UMFANG.bis, reihenfolge: Reihenfolge = 'quarten', start = lickKlasse(l)): Abschnitt[] {
  return tonartFolge(reihenfolge, start).map((k) => lickAbschnitt(l, k, ober));
}

/** Skills der Kartei, auf die das Üben eines Licks zählt. */
export const lickSkills = (l: Lick): string[] => ['licks-transponieren', ...(/blues/i.test(l.ueber) ? ['blues-phrasen'] : [])];

// ════════════════════════════════════════════════════════════════════
// Eingabe → Lick
// ════════════════════════════════════════════════════════════════════

export interface LickEingabe { name: string; ueber: string; tonart: string; text: string }

export function lickAusEingabe(e: LickEingabe, id: string): { lick: Lick; fehler?: undefined } | { lick?: undefined; fehler: string[] } {
  const fehler: string[] = [];
  const name = e.name.trim();
  if (!name) fehler.push('Name fehlt.');
  const tonart = tonartLesen(e.tonart);
  if (!tonart) fehler.push(`Tonart „${e.tonart}“ verstehe ich nicht (z. B. C, Bb, F#m).`);
  const g = tonart ? lickLesen(e.text, tonart) : null;
  if (g) fehler.push(...g.fehler);
  if (fehler.length || !g || !tonart) return { fehler };
  return {
    lick: {
      id, name: name.slice(0, 80), ueber: e.ueber.trim().slice(0, 40), moll: tonart.moll,
      noten: g.noten, akkorde: g.akkorde, text: e.text.trim().slice(0, 2000), tonart: e.tonart.trim().slice(0, 8),
    },
  };
}

export const lickAlsEingabe = (l: Lick): LickEingabe => ({ name: l.name, ueber: l.ueber, tonart: l.tonart, text: l.text });

// ════════════════════════════════════════════════════════════════════
// Start-Licks — eigene, schlichte Formulierungen gängiger Wendungen
// (keine Transkriptionen von Soli).
// ════════════════════════════════════════════════════════════════════

const START: readonly (LickEingabe & { id: string })[] = [
  { id: 'start-blues', name: 'Blues-Wendung abwärts', ueber: 'Blues', tonart: 'C',
    text: '"C7" G8 Bb8 C8 Eb8 C8 Bb8 G8 F#8 | F8 Eb8 C4 z2' },
  { id: 'start-251-chromatisch', name: 'ii–V–I mit chromatischem Abgang', ueber: 'ii–V–I', tonart: 'C',
    text: '"Dm7" D8 F8 A8 C8 "G7" B8 Bb8 A8 Ab8 | "Cmaj7" G2 z2' },
  { id: 'start-umspielung', name: 'Terz und Quinte umspielen', ueber: 'maj7', tonart: 'C',
    text: '"Cmaj7" F8 D#8 E4 A8 F#8 G4 | D8 B8 C2.' },
  { id: 'start-moll-penta', name: 'Moll-Pentatonik hin und zurück', ueber: 'm7', tonart: 'Am',
    text: '"Am7" E8 G8 A8 C8 D8 C8 A8 G8 | A2 z2' },
  { id: 'start-bebop-dominante', name: 'Bebop-Abgang über die Dominante', ueber: 'V–I', tonart: 'C',
    text: '"G7" G8 F#8 F8 E8 D8 F8 A8 B8 | "Cmaj7" C2 z2' },
  { id: 'start-guide-tones', name: 'Guide-Tone-Linie', ueber: 'ii–V–I', tonart: 'C',
    text: '"Dm7" F2 C2 | "G7" B2 F2 | "Cmaj7" E1' },
  { id: 'start-dur-penta', name: 'Dur-Pentatonik-Bogen', ueber: 'Dur', tonart: 'F',
    text: '"F6" F8 G8 A8 C8 D8 C8 A8 G8 | F8 D8 C4 z2' },
  { id: 'start-moll-251', name: 'Moll-ii–V in Triolen', ueber: 'Moll ii–V–i', tonart: 'Cm',
    text: '"Dm7b5" D8t F8t Ab8t C4 "G7b9" B8t D8t F8t Ab4 | "Cm6" G2 z2' },
];

export const START_LICKS: readonly Lick[] = START.map(({ id, ...e }) => {
  const r = lickAusEingabe(e, id);
  if (!r.lick) throw new Error(`Start-Lick ${id}: ${r.fehler.join(' ')}`);
  return r.lick;
});
export const istStartLick = (id: string) => START_LICKS.some((l) => l.id === id);

// ════════════════════════════════════════════════════════════════════
// Wiederholen
// ════════════════════════════════════════════════════════════════════

export interface LickStand { zuletzt: number; staerke: number }
export const STAERKE_MAX = 4;
/** Tage bis zur nächsten Wiederholung je Stärke 0–4. */
export const LICK_ABSTAND = [1, 2, 4, 8, 16] as const;
export const BEWERTUNGEN = ['sitzt', 'fast', 'nochNicht'] as const;
export type Bewertung = (typeof BEWERTUNGEN)[number];
export const BEWERTUNG_NAMEN: Record<Bewertung, string> = { sitzt: 'Sitzt', fast: 'Fast', nochNicht: 'Noch nicht' };

/** Nach dem Üben: sitzt → stärker, fast → bleibt (mindestens 1), noch nicht → 0. */
export function bewerten(alt: LickStand | undefined, b: Bewertung, jetzt: number): LickStand {
  const s = alt?.staerke ?? 0;
  const staerke = b === 'sitzt' ? Math.min(STAERKE_MAX, s + 1) : b === 'fast' ? Math.max(1, s) : 0;
  return { zuletzt: jetzt, staerke };
}

/** Tage bis fällig (≤ 0: heute fällig); nie geübt: 0. */
export function faelligIn(st: LickStand | undefined, jetzt: number): number {
  if (!st) return 0;
  return LICK_ABSTAND[st.staerke] - tageSeit(st.zuletzt, jetzt);
}
export const faellig = (st: LickStand | undefined, jetzt: number) => faelligIn(st, jetzt) <= 0;
export const heuteGeuebt = (st: LickStand | undefined, jetzt: number) => !!st && tageSeit(st.zuletzt, jetzt) === 0;

/** „Heute fällig“: am längsten überfällige zuerst, nie geübte danach. */
export function heuteFaellig(licks: readonly Lick[], stand: Record<string, LickStand>, jetzt: number): Lick[] {
  const st = (l: Lick) => (Object.prototype.hasOwnProperty.call(stand, l.id) ? stand[l.id] : undefined);
  return licks.filter((l) => faellig(st(l), jetzt))
    .map((l, i) => ({ l, i, neu: !st(l), d: faelligIn(st(l), jetzt) }))
    .sort((a, b) => Number(a.neu) - Number(b.neu) || a.d - b.d || a.i - b.i)
    .map((x) => x.l);
}

/** Kurztext zum Stand: "heute fällig", "morgen", "in 3 Tagen", "neu". */
export function faelligText(st: LickStand | undefined, jetzt: number): string {
  if (!st) return 'neu';
  const d = faelligIn(st, jetzt);
  return d <= 0 ? 'heute fällig' : d === 1 ? 'morgen' : `in ${d} Tagen`;
}

// ════════════════════════════════════════════════════════════════════
// Speicher
// ════════════════════════════════════════════════════════════════════

export const LICKS_SCHLUESSEL = 'ueben:licks';
export interface LickSpeicher {
  eigene: Lick[];
  /** Stand je Lick-id (eigene und Start-Licks). */
  stand: Record<string, LickStand>;
  /** Ausgeblendete Start-Licks. */
  aus: string[];
}
export const LICKS_STANDARD: LickSpeicher = { eigene: [], stand: {}, aus: [] };
export const LICKS_MAX = 300;

const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ganz = (v: unknown, von: number, bis: number): v is number => Number.isInteger(v) && (v as number) >= von && (v as number) <= bis;
const text = (v: unknown, max: number, leer = true): v is string => typeof v === 'string' && v.length <= max && (leer || v.length > 0);
const VERBOTEN = new Set(['__proto__', 'constructor', 'prototype']);
const idOk = (v: unknown): v is string => text(v, 80, false) && !VERBOTEN.has(v);

const noteOk = (n: unknown) => objekt(n) && ganz(n.t, 1, TAKT * LICK_TAKTE_MAX)
  && (('s' in n || 'h' in n) ? ganz(n.s, -40, 40) && ganz(n.h, -60, 60) : true);
const akkordOk = (a: unknown) => objekt(a) && ganz(a.ab, 0, TAKT * LICK_TAKTE_MAX) && ganz(a.s, 0, 6) && ganz(a.h, 0, 11) && text(a.endung, 20);

export function istLick(v: unknown): v is Lick {
  return objekt(v) && idOk(v.id) && text(v.name, 80, false) && text(v.ueber, 40) && typeof v.moll === 'boolean'
    && Array.isArray(v.noten) && v.noten.length > 0 && v.noten.length <= LICK_NOTEN_MAX && v.noten.every(noteOk)
    && Array.isArray(v.akkorde) && v.akkorde.length <= 64 && v.akkorde.every(akkordOk)
    && text(v.text, 2000) && text(v.tonart, 8);
}
const standOk = (v: unknown): v is LickStand => objekt(v) && typeof v.zuletzt === 'number' && Number.isFinite(v.zuletzt) && v.zuletzt > 0 && v.zuletzt < 8.64e15
  && ganz(v.staerke, 0, STAERKE_MAX);

/** Streng: nur ein ganz gültiger Speicher reist mit (Validator für die Sicherung). */
export function licksGueltig(v: unknown): v is LickSpeicher {
  if (!objekt(v) || !Array.isArray(v.eigene) || v.eigene.length > LICKS_MAX || !v.eigene.every(istLick)) return false;
  if (!objekt(v.stand) || Object.keys(v.stand).length > 2 * LICKS_MAX) return false;
  for (const [k, s] of Object.entries(v.stand)) if (!idOk(k) || !standOk(s)) return false;
  return Array.isArray(v.aus) && v.aus.length <= 100 && v.aus.every(idOk);
}

/** Tolerant lesen: Unbrauchbares fällt weg, der Rest bleibt. */
export function licksLesen(roh: unknown): LickSpeicher {
  if (!objekt(roh)) return { eigene: [], stand: {}, aus: [] };
  const eigene = Array.isArray(roh.eigene) ? roh.eigene.filter(istLick).slice(0, LICKS_MAX) : [];
  const stand: Record<string, LickStand> = {};
  if (objekt(roh.stand)) for (const [k, s] of Object.entries(roh.stand)) if (idOk(k) && standOk(s)) stand[k] = { zuletzt: s.zuletzt, staerke: s.staerke };
  const aus = Array.isArray(roh.aus) ? roh.aus.filter(idOk).slice(0, 100) : [];
  return { eigene, stand, aus };
}

/** Alle sichtbaren Licks: Start-Licks (ohne ausgeblendete), dann eigene. */
export const licksAlle = (sp: LickSpeicher): Lick[] => [...START_LICKS.filter((l) => !sp.aus.includes(l.id)), ...sp.eigene];

export function lickSichern(sp: LickSpeicher, l: Lick): LickSpeicher {
  const da = sp.eigene.some((x) => x.id === l.id);
  return { ...sp, eigene: da ? sp.eigene.map((x) => (x.id === l.id ? l : x)) : [...sp.eigene, l] };
}

/** Eigene löschen; Start-Licks ausblenden. Der Stand geht mit. */
export function lickEntfernen(sp: LickSpeicher, id: string): LickSpeicher {
  const stand = Object.fromEntries(Object.entries(sp.stand).filter(([k]) => k !== id));
  if (istStartLick(id)) return { ...sp, stand, aus: sp.aus.includes(id) ? sp.aus : [...sp.aus, id] };
  return { ...sp, stand, eigene: sp.eigene.filter((l) => l.id !== id) };
}

export const startLicksZeigen = (sp: LickSpeicher): LickSpeicher => ({ ...sp, aus: [] });

export const lickBewerten = (sp: LickSpeicher, id: string, b: Bewertung, jetzt: number): LickSpeicher =>
  ({ ...sp, stand: { ...sp.stand, [id]: bewerten(Object.prototype.hasOwnProperty.call(sp.stand, id) ? sp.stand[id] : undefined, b, jetzt) } });
