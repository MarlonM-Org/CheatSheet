// Generierte Etüden (I-14): Muster durch die zwölf Tonarten — Dur-Tonleiter,
// Dreiklang- und Septakkord-Arpeggien, 1-2-3-5, Guide-Tone-Linien durch die
// ii–V–I, Umspielungen. Rein, getestet.
//
// • Tonhöhen sind *notiert* (wie alles in den Werkzeugen); `vorspielen`
//   rechnet beim Abspielen in klingend um.
// • Jeder Ton ist geschrieben (Stammton + Vorzeichen) aus dem Harmonie-Kern
//   (./akkorde): F♯-Dur hat Eis, G♭-Dur hat Ces, die Umspielung von Fis
//   kommt von Eis. Doppelvorzeichen werden schlicht geschrieben.
// • Die Oktave wählt jede Phrase für sich: der Klarinetten-Umfang (notiert
//   E3 … A5, obere Grenze einstellbar bis C6) wird nie verlassen, und die
//   Phrase liegt möglichst mittig darin.
// • Rhythmus in Ticks (12 je Viertel): Viertel, Achtel, Achteltriolen.
//   Jede Tonart beginnt mit einem neuen Takt; ein langer Schlusston füllt
//   den Takt auf.
//
// Der zweite Teil (Notenfolge → ABC und Klänge) gilt auch für die Licks (I-16).

import {
  akkordBauen, akkordPruefen, akkordText, istAkkord, leiterBauen, stufenTon, tonAusKlasse, tonKlasse, tonSchlicht, tonSymbol,
  tonVersetzen, tonartName, vorzeichen, type Struktur, type Ton, type TonartAngabe,
} from './akkorde';
import type { Klang } from './notensatz';

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ════════════════════════════════════════════════════════════════════
// Notenfolge: Ereignisse, Takte, ABC, Klänge
// ════════════════════════════════════════════════════════════════════

/** Ticks je Viertel (teilbar durch 2, 3 und 4: Achtel, Triolen, Sechzehntel). */
export const TICKS = 12;
/** Ein 4/4-Takt. */
export const TAKT = 4 * TICKS;

/** Ein Ton (oder mit `ton: null` eine Pause) einer Notenfolge. */
export interface Ereignis {
  ton: Ton | null;
  /** Notiert (MIDI); bei Pausen ohne Bedeutung. */
  midi: number;
  ticks: number;
  /** Akkordsymbol über dem Ton (ASCII, z. B. "Dm7"). */
  akkord?: string;
  /** Füllt den Takt bis zum Ende auf (Schlusston). */
  lang?: boolean;
}

/** Eine Tonart einer Etüde (oder ein Lick in einer Tonart): beginnt mit einem neuen Takt. */
export interface Abschnitt { titel: string; ereignisse: Ereignis[] }

interface Gelegt { ton: Ton | null; midi: number; beginn: number; ticks: number; akkord?: string }
interface Stueck { ton: Ton | null; midi: number; beginn: number; ticks: number; akkord?: string; titel?: string; gebunden: boolean; fortsetzung: boolean }

/** Ereignisse auf die Zeitachse legen (ab Takt 0), `lang` auffüllen, am Ende mit Pause bis zum Taktende. */
function legen(ereignisse: readonly Ereignis[]): Gelegt[] {
  const aus: Gelegt[] = [];
  let pos = 0;
  for (const e of ereignisse) {
    const ticks = e.lang ? TAKT - (pos % TAKT) : e.ticks;
    aus.push({ ton: e.ton, midi: e.midi, beginn: pos, ticks, akkord: e.akkord });
    pos += ticks;
  }
  if (pos % TAKT) aus.push({ ton: null, midi: 0, beginn: pos, ticks: TAKT - (pos % TAKT) });
  return aus;
}

/** Länge in Takten (aufgerundet). */
export const abschnittTakte = (a: Abschnitt) => {
  const g = legen(a.ereignisse);
  const ende = g.length ? g[g.length - 1].beginn + g[g.length - 1].ticks : 0;
  return Math.ceil(ende / TAKT);
};

const tolerant = (t: number) => t % 3 === 0;
// Darstellbare Werte ohne Triole (Ticks): ganze, punktierte halbe, halbe, punktierte Viertel, Viertel, punktierte Achtel, Achtel, Sechzehntel.
const WERTE = [48, 36, 24, 18, 12, 9, 6, 3];

/** In darstellbare Stücke teilen: an Taktstrichen, bei Triolen an Zählzeiten, sonst in Notenwerte. */
function teilen(g: Gelegt[], titel: string): Stueck[] {
  const aus: Stueck[] = [];
  g.forEach((e, i) => {
    let beginn = e.beginn, rest = e.ticks, erstes = true;
    while (rest > 0) {
      const bisTakt = TAKT - (beginn % TAKT);
      let n = Math.min(rest, bisTakt);
      if (!tolerant(beginn) || !tolerant(n)) {
        // Triolisch: höchstens bis zur nächsten Zählzeit.
        n = Math.min(n, TICKS - (beginn % TICKS));
      } else if (!WERTE.includes(n)) {
        n = WERTE.find((w) => w <= n) ?? 3;
      }
      rest -= n;
      aus.push({
        ton: e.ton, midi: e.midi, beginn, ticks: n, akkord: erstes ? e.akkord : undefined,
        titel: i === 0 && erstes ? titel : undefined, gebunden: rest > 0 && e.ton !== null, fortsetzung: !erstes,
      });
      beginn += n;
      erstes = false;
    }
  });
  return aus;
}

/** Fehlertext, wenn Triolen keine ganze Zählzeit füllen (sonst null). */
export function triolenFehler(ereignisse: readonly Ereignis[]): string | null {
  const st = teilen(legen(ereignisse), '');
  const schlaege = new Map<number, Stueck[]>();
  for (const s of st) {
    const b = Math.floor(s.beginn / TICKS);
    schlaege.set(b, [...(schlaege.get(b) ?? []), s]);
  }
  for (const liste of schlaege.values()) {
    const triolisch = liste.some((s) => !tolerant(s.beginn) || !tolerant(s.ticks));
    if (triolisch && !liste.every((s) => s.ticks % 4 === 0 && (s.beginn % TICKS) % 4 === 0)) return 'Triolen müssen eine Zählzeit füllen (drei Triolen-Achtel oder Viertel + Achtel).';
  }
  return null;
}

const STAMM = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ABC_VZ: Record<number, string> = { [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^' };
const abcLaenge = (n: number) => (n === 1 ? '' : String(n));
const zitat = (s: string) => s.replace(/"/g, "'");

function abcNote(t: Ton, midi: number): { schluessel: string; name: string } {
  const oktave = Math.floor((midi - t.vz) / 12) - 1;
  const b = STAMM[t.stamm];
  return { schluessel: `${b}${oktave}`, name: oktave >= 5 ? b.toLowerCase() + "'".repeat(oktave - 5) : b + ','.repeat(Math.max(0, 4 - oktave)) };
}

export interface AbcOptionen {
  /** Takte je Zeile (0 = ein Abschnitt je Zeile, ohne Umbruch darin). */
  takteJeZeile?: number;
  titel?: string;
}

/**
 * Notenzeile(n) als ABC: 4/4, Violinschlüssel, Vorzeichen ausgeschrieben (Tonart C, gelten bis zum
 * Taktstrich) — so liest jede Tonart ohne Vorzeichenwechsel. Jeder Abschnitt beginnt eine neue Zeile,
 * sein Titel steht als Text darüber, Akkordsymbole über den Tönen.
 */
export function abschnitteAbc(abschnitte: readonly Abschnitt[], { takteJeZeile = 0, titel }: AbcOptionen = {}): string {
  const zeilen: string[] = [];
  for (const a of abschnitte) {
    const st = teilen(legen(a.ereignisse), a.titel);
    let zeile = '';
    let stand = new Map<string, number>();
    let triole = -1; // Zählzeit der laufenden Triolengruppe
    let vorher: Stueck | null = null;
    for (let i = 0; i < st.length; i++) {
      const s = st[i];
      const takt = Math.floor(s.beginn / TAKT);
      if (s.beginn % TAKT === 0 && s.beginn > 0) {
        zeile += ' |';
        stand = new Map();
        if (takteJeZeile > 0 && takt % takteJeZeile === 0) { zeilen.push(zeile); zeile = ''; }
      }
      // Balken: Achtel zu vier (halber Takt), sonst je Zählzeit.
      const schlag = Math.floor(s.beginn / TICKS);
      const amSchlag = s.beginn % TICKS === 0;
      const achtelPaar = vorher?.ticks === 6 && s.ticks === 6 && s.beginn % (2 * TICKS) !== 0;
      if (zeile && ((amSchlag && !achtelPaar) || s.ticks >= TICKS || (vorher?.ticks ?? 0) >= TICKS)) zeile += ' ';
      // Triolengruppe beginnen.
      if (amSchlag && triole !== schlag) {
        const imSchlag = st.filter((x) => Math.floor(x.beginn / TICKS) === schlag && x.beginn < (schlag + 1) * TICKS);
        if (imSchlag.some((x) => !tolerant(x.beginn) || !tolerant(x.ticks))) {
          zeile += `(3:2:${imSchlag.length}`;
          triole = schlag;
        }
      }
      const inTriole = triole === schlag;
      const laenge = inTriole ? s.ticks / 2 : s.ticks / 3;
      if (s.titel) zeile += `"^${zitat(s.titel)}"`;
      if (s.akkord) zeile += `"${zitat(s.akkord)}"`;
      if (!s.ton) zeile += `z${abcLaenge(laenge)}`;
      else {
        const { schluessel, name } = abcNote(s.ton, s.midi);
        let zeichen = '';
        if (!s.fortsetzung) {
          const alt = stand.get(schluessel) ?? 0;
          if (alt !== s.ton.vz) zeichen = ABC_VZ[s.ton.vz];
          stand.set(schluessel, s.ton.vz);
        }
        zeile += `${zeichen}${name}${abcLaenge(laenge)}${s.gebunden ? '-' : ''}`;
      }
      vorher = s;
    }
    zeilen.push(`${zeile} |`);
  }
  if (zeilen.length) zeilen[zeilen.length - 1] = zeilen[zeilen.length - 1].replace(/ \|$/, ' |]');
  return ['X:1', ...(titel ? [`T:${zitat(titel)}`] : []), 'M:4/4', 'L:1/16', 'K:C clef=treble', ...zeilen].join('\n') + '\n';
}

export interface Klick { zeit: number; betont: boolean }
export interface Vortrag { klaenge: Klang[]; klicks: Klick[]; dauer: number }

/** Klänge (Sekunden, notiert) und Klick je Viertel; davor `vorzaehlen` Schläge nur Klick. */
export function abschnitteKlaenge(abschnitte: readonly Abschnitt[], bpm: number, { vorzaehlen = 4, klick = true }: { vorzaehlen?: number; klick?: boolean } = {}): Vortrag {
  const schlag = 60 / Math.max(20, Math.min(400, bpm));
  const sek = (ticks: number) => (ticks / TICKS) * schlag;
  const vorlauf = vorzaehlen * schlag;
  const klaenge: Klang[] = [];
  let ab = 0;
  for (const a of abschnitte) {
    const g = legen(a.ereignisse);
    for (const e of g) if (e.ton) klaenge.push({ beginn: vorlauf + sek(ab + e.beginn), dauer: sek(e.ticks) * 0.92, midi: e.midi });
    const ende = g.length ? g[g.length - 1].beginn + g[g.length - 1].ticks : 0;
    ab += ende;
  }
  const schlaege = vorzaehlen + ab / TICKS;
  const klicks: Klick[] = [];
  if (klick) for (let i = 0; i < schlaege; i++) klicks.push({ zeit: i * schlag, betont: i < vorzaehlen ? i === 0 : (i - vorzaehlen) % 4 === 0 });
  return { klaenge, klicks, dauer: vorlauf + sek(ab) };
}

// ════════════════════════════════════════════════════════════════════
// Umfang und Lage
// ════════════════════════════════════════════════════════════════════

/** Bequemer Klarinetten-Umfang, notiert: E3 … A5; obere Grenze einstellbar (G5 … C6). */
export const UMFANG = { von: 52, bis: 81, obenMin: 76, obenMax: 84 } as const;
/** Wahl der oberen Grenze in der Oberfläche. */
export const OBERE_GRENZEN: readonly { midi: number; name: string }[] = [
  { midi: 79, name: 'G5' }, { midi: 81, name: 'A5' }, { midi: 84, name: 'C6' },
];
const obenKlemmen = (ober: number) => Math.max(UMFANG.obenMin, Math.min(UMFANG.obenMax, Math.round(ober)));

/**
 * Oktavlage einer Phrase: Verschiebung (Vielfaches von 12), sodass alle Töne im Umfang liegen und die
 * Phrase möglichst mittig darin. Passt sie nirgends hinein, werden einzelne Töne oktaviert.
 */
export function lageWaehlen(midi: readonly number[], ober: number = UMFANG.bis): number[] {
  if (!midi.length) return [];
  const oben = obenKlemmen(ober), unten = UMFANG.von;
  const min = Math.min(...midi), max = Math.max(...midi);
  const mitte = (unten + oben) / 2;
  let beste: number | null = null, abstand = Infinity;
  for (let k = -10; k <= 10; k++) {
    const s = 12 * k;
    if (min + s < unten || max + s > oben) continue;
    const d = Math.abs((min + max) / 2 + s - mitte);
    if (d < abstand) { abstand = d; beste = s; }
  }
  if (beste !== null) return midi.map((m) => m + beste!);
  // Zu weit: so legen, dass wenig herausragt, dann einzeln oktavieren.
  let s0 = 0, ueber = Infinity;
  for (let k = -10; k <= 10; k++) {
    const s = 12 * k;
    const u = midi.reduce((a, m) => a + Math.max(0, unten - (m + s)) + Math.max(0, m + s - oben), 0);
    if (u < ueber) { ueber = u; s0 = s; }
  }
  return midi.map((m) => {
    let x = m + s0;
    while (x < unten) x += 12;
    while (x > oben) x -= 12;
    return x;
  });
}

// ════════════════════════════════════════════════════════════════════
// Muster
// ════════════════════════════════════════════════════════════════════

export type MusterId =
  | 'tonleiter' | 'dreiklangDur' | 'dreiklangMoll' | 'maj7' | 'dom7' | 'moll7' | 'halbvermindert'
  | 'muster1235' | 'guideTones' | 'umspielung';

export interface Muster {
  id: MusterId;
  name: string;
  /** Kurz für die Auswahl. */
  kurz: string;
  /** Was gespielt wird, ein Satz. */
  was: string;
  /** Moll-Klang: Grundton in Moll-Schreibweise (gis statt as). */
  moll: boolean;
  /** Skills der Kartei, auf die „Geübt“ zählt. */
  skills: readonly string[];
}

export const MUSTER: readonly Muster[] = [
  { id: 'tonleiter', name: 'Dur-Tonleiter', kurz: 'Tonleiter', moll: false, skills: ['tonleitern-12'], was: 'Eine Oktave auf und ab.' },
  { id: 'dreiklangDur', name: 'Dur-Dreiklang', kurz: 'Dur', moll: false, skills: ['dreiklang-arpeggien'], was: '1 3 5 8 5 3 1 — gebrochen auf und ab.' },
  { id: 'dreiklangMoll', name: 'Moll-Dreiklang', kurz: 'Moll', moll: true, skills: ['dreiklang-arpeggien'], was: '1 ♭3 5 8 5 ♭3 1 — gebrochen auf und ab.' },
  { id: 'maj7', name: 'maj7-Arpeggio', kurz: 'maj7', moll: false, skills: ['septakkord-arpeggien'], was: '1 3 5 7 8, zurück 7 5 3 1.' },
  { id: 'dom7', name: '7-Arpeggio (Dominante)', kurz: '7', moll: false, skills: ['septakkord-arpeggien'], was: '1 3 5 ♭7 8, zurück ♭7 5 3 1.' },
  { id: 'moll7', name: 'm7-Arpeggio', kurz: 'm7', moll: true, skills: ['septakkord-arpeggien'], was: '1 ♭3 5 ♭7 8, zurück ♭7 5 ♭3 1.' },
  { id: 'halbvermindert', name: 'm7♭5-Arpeggio', kurz: 'm7♭5', moll: true, skills: ['septakkord-arpeggien'], was: '1 ♭3 ♭5 ♭7 8, zurück ♭7 ♭5 ♭3 1.' },
  { id: 'muster1235', name: '1-2-3-5', kurz: '1-2-3-5', moll: false, skills: ['dreiklang-arpeggien'], was: '1 2 3 5 hinauf, 8 5 3 2 zurück, 1 — das Coltrane-Muster.' },
  { id: 'guideTones', name: 'Guide Tones ii–V–I', kurz: 'Guide Tones', moll: false, skills: ['guide-tones'],
    was: 'Zwei Linien durch die ii–V–I: Terz → Septime → Terz und Septime → Terz → Septime auf der Eins, dazwischen die Akkordtöne.' },
  { id: 'umspielung', name: 'Umspielung', kurz: 'Um\u00ADspielung', moll: false, skills: ['enclosure', 'dreiklang-arpeggien'],
    was: 'Jeden Dreiklangton einkreisen: Leiterton darüber, Halbton darunter, Ziel.' },
];
export const musterVon = (id: MusterId): Muster => MUSTER.find((m) => m.id === id) ?? MUSTER[0];
export const istMusterId = (v: unknown): v is MusterId => typeof v === 'string' && MUSTER.some((m) => m.id === v);

export const REIHENFOLGEN = ['quinten', 'quarten', 'chromatisch', 'eine'] as const;
export type Reihenfolge = (typeof REIHENFOLGEN)[number];
export const REIHENFOLGE_NAMEN: Record<Reihenfolge, string> = {
  quinten: 'Quintenzirkel', quarten: 'Quartenzirkel', chromatisch: 'Chromatisch', eine: 'Eine Tonart',
};

export const RHYTHMEN = ['viertel', 'achtel', 'triolen'] as const;
export type Rhythmus = (typeof RHYTHMEN)[number];
export const RHYTHMUS_NAMEN: Record<Rhythmus, string> = { viertel: 'Viertel', achtel: 'Achtel', triolen: 'Triolen' };
/** Ticks je Grundwert. */
export const RHYTHMUS_TICKS: Record<Rhythmus, number> = { viertel: 12, achtel: 6, triolen: 4 };

/** Die zwölf Tonklassen in der gewünschten Folge ab `start` (eine Tonart: nur `start`). */
export function tonartFolge(r: Reihenfolge, start: number): number[] {
  const s = mod(start, 12);
  if (r === 'eine') return [s];
  const schritt = r === 'quinten' ? 7 : r === 'quarten' ? 5 : 1;
  return Array.from({ length: 12 }, (_, i) => mod(s + i * schritt, 12));
}

/** Grundton einer Tonklasse: weniger Vorzeichen; bei Gleichstand (Fis/Ges, dis/es) nach `vorliebe`. */
export function grundFuer(klasse: number, moll: boolean, vorliebe: 'kreuz' | 'be' = 'be'): Ton {
  const be = tonAusKlasse(klasse, 'be'), kreuz = tonAusKlasse(klasse, 'kreuz');
  const nb = Math.abs(vorzeichen({ grund: be, moll })), nk = Math.abs(vorzeichen({ grund: kreuz, moll }));
  return nk < nb || (nk === nb && vorliebe === 'kreuz') ? kreuz : be;
}

// ── Kontur: geschriebene Töne mit Richtung → MIDI ──

type Richtung = 'auf' | 'ab' | 'nah';
interface KTon { ton: Ton; r: Richtung; einheiten?: number; lang?: boolean; akkord?: string }
type Phrase = KTon[];

const schlicht = (t: Ton): Ton => (Math.abs(t.vz) === 2 ? tonSchlicht(t) : t);

/** MIDI-Höhen (ohne feste Oktave): der erste Ton in Oktave −1, jeder weitere in seiner Richtung, `nah` = nächstgelegen (Tritonus abwärts). */
function kontur(p: Phrase): number[] {
  const aus: number[] = [];
  for (const k of p) {
    const kl = tonKlasse(k.ton);
    if (!aus.length) { aus.push(kl); continue; }
    const v = aus[aus.length - 1];
    const d = mod(kl - v, 12);
    if (k.r === 'auf') aus.push(v + (d || 12));
    else if (k.r === 'ab') aus.push(v - (mod(v - kl, 12) || 12));
    else aus.push(v + (d > 6 || d === 6 ? d - 12 : d));
  }
  return aus;
}

const STRUKTUR: Record<string, Struktur> = {};
function struktur(endung: string): Struktur {
  if (!STRUKTUR[endung]) {
    const a = akkordPruefen(`C${endung}`);
    if (!istAkkord(a)) throw new Error(endung);
    STRUKTUR[endung] = a.struktur;
  }
  return STRUKTUR[endung];
}
const akkordToene = (g: Ton, endung: string) => akkordBauen(g, struktur(endung)).toene.map((t) => t.ton);
const stufe = (g: Ton, zahl: number, halbtoene: number) => stufenTon(g, { zahl, halbtoene });

const auf = (ton: Ton, extra: Partial<KTon> = {}): KTon => ({ ton, r: 'auf', ...extra });
const ab = (ton: Ton, extra: Partial<KTon> = {}): KTon => ({ ton, r: 'ab', ...extra });
const nah = (ton: Ton, extra: Partial<KTon> = {}): KTon => ({ ton, r: 'nah', ...extra });

/** Arpeggio 1 … 8 und zurück. */
function arpeggio(t: Ton[]): Phrase {
  const hoch = [...t, t[0]];
  return [...hoch.map((x) => auf(x)), ...t.slice(1).reverse().map((x) => ab(x)), ab(t[0], { lang: true })];
}

interface Bau { titel: string; phrasen: Phrase[] }

function musterBauen(id: MusterId, g: Ton, rhythmus: Rhythmus): Bau {
  const dur: TonartAngabe = { grund: g, moll: false };
  const leiter = leiterBauen('ionisch', g).toene.map((t) => t.ton);
  switch (id) {
    case 'tonleiter':
      return { titel: tonartName(dur), phrasen: [[...leiter.map((t) => auf(t)), auf(g), ...leiter.slice(1).reverse().map((t) => ab(t)), ab(g, { lang: true })]] };
    case 'dreiklangDur': case 'dreiklangMoll': {
      const moll = id === 'dreiklangMoll';
      return { titel: tonartName({ grund: g, moll }), phrasen: [arpeggio(akkordToene(g, moll ? 'm' : ''))] };
    }
    case 'maj7': case 'dom7': case 'moll7': case 'halbvermindert': {
      const endung = { maj7: 'maj7', dom7: '7', moll7: 'm7', halbvermindert: 'm7b5' }[id];
      return { titel: akkordText(akkordBauen(g, struktur(endung))), phrasen: [arpeggio(akkordToene(g, endung))] };
    }
    case 'muster1235': {
      const [e1, e2, e3, , e5] = leiter;
      return { titel: tonartName(dur), phrasen: [[auf(e1), auf(e2), auf(e3), auf(e5), auf(e1), ab(e5), ab(e3), ab(e2), ab(e1, { lang: true })]] };
    }
    case 'guideTones': {
      const ii = stufe(g, 2, 2), v = stufe(g, 5, 7);
      const iiT = { 1: ii, 3: stufe(ii, 3, 3), 5: stufe(ii, 5, 7), 7: stufe(ii, 7, 10), 9: stufe(ii, 9, 2) };
      const vT = { 1: v, 3: stufe(v, 3, 4), 5: stufe(v, 5, 7), 7: stufe(v, 7, 10), 9: stufe(v, 9, 2) };
      const iT = { 3: stufe(g, 3, 4), 7: stufe(g, 7, 11) };
      const a = { ii: `${tonSymbol(ii, true)}m7`, v: `${tonSymbol(v, true)}7`, i: `${tonSymbol(g, true)}maj7` };
      // Linie A: Terz (ii) → Septime (V) → Terz (I) auf der Eins.
      const linieA: Phrase = [
        auf(iiT[3], { akkord: a.ii }), auf(iiT[5]), auf(iiT[7]), auf(iiT[9]),
        nah(vT[7], { akkord: a.v }), ab(vT[5]), ab(vT[3]), ab(vT[1]),
        nah(iT[3], { akkord: a.i, lang: true }),
      ];
      // Linie B: Septime (ii) → Terz (V) → Septime (I).
      const linieB: Phrase = [
        auf(iiT[7], { akkord: a.ii }), ab(iiT[5]), ab(iiT[3]), ab(iiT[1]),
        nah(vT[3], { akkord: a.v }), auf(vT[5]), auf(vT[7]), auf(vT[9]),
        nah(iT[7], { akkord: a.i, lang: true }),
      ];
      return { titel: tonartName(dur), phrasen: [linieA, linieB] };
    }
    case 'umspielung': {
      // Ziele: 1 3 5 8 5 3 1; je Ziel Leiterton darüber, Halbton darunter, Ziel (auf der Zählzeit lang).
      const ziele = [0, 2, 4, 0, 4, 2, 0];
      const zielPhrase: Phrase = ziele.map((i, n) => (n === 0 ? auf(leiter[i]) : n <= 3 ? auf(leiter[i]) : ab(leiter[i])));
      const zm = kontur(zielPhrase);
      const lang = rhythmus === 'triolen' ? 1 : 2;
      const p: { k: KTon; midi: number }[] = [];
      ziele.forEach((i, n) => {
        const ziel = leiter[i], oben = leiter[(i + 1) % 7];
        const obenAbstand = mod(tonKlasse(oben) - tonKlasse(ziel), 12);
        const unten = schlicht(tonVersetzen(ziel, { stufen: 1, halbtoene: 1 }, -1));
        p.push({ k: nah(oben), midi: zm[n] + obenAbstand });
        p.push({ k: nah(unten), midi: zm[n] - 1 });
        p.push({ k: nah(ziel, { einheiten: lang, lang: n === ziele.length - 1 }), midi: zm[n] });
      });
      return { titel: tonartName(dur), phrasen: [Object.assign(p.map((x) => x.k), { midi: p.map((x) => x.midi) })] };
    }
  }
}

export interface EtuedenWahl {
  muster: MusterId;
  reihenfolge: Reihenfolge;
  /** Erste (oder einzige) Tonart als Tonklasse, notiert (C = 0). */
  start: number;
  rhythmus: Rhythmus;
  /** Obere Grenze (MIDI, notiert), Standard A5 = 81. */
  ober?: number;
}

export interface Etuede { wahl: EtuedenWahl; abschnitte: Abschnitt[]; tonarten: TonartAngabe[] }

/** Die Etüde: je Tonart ein Abschnitt, im Umfang, richtig geschrieben. */
export function etuedeBauen(wahl: EtuedenWahl): Etuede {
  const m = musterVon(wahl.muster);
  const basis = RHYTHMUS_TICKS[wahl.rhythmus];
  const vorliebe = wahl.reihenfolge === 'quinten' ? 'kreuz' : 'be';
  const abschnitte: Abschnitt[] = [];
  const tonarten: TonartAngabe[] = [];
  for (const k of tonartFolge(wahl.reihenfolge, wahl.start)) {
    const g = grundFuer(k, m.moll, vorliebe);
    tonarten.push({ grund: g, moll: m.moll });
    const bau = musterBauen(m.id, g, wahl.rhythmus);
    const ereignisse: Ereignis[] = [];
    for (const p of bau.phrasen) {
      const roh = (p as Phrase & { midi?: number[] }).midi ?? kontur(p);
      const midi = lageWaehlen(roh, wahl.ober ?? UMFANG.bis);
      p.forEach((k2, i) => ereignisse.push({ ton: k2.ton, midi: midi[i], ticks: (k2.einheiten ?? 1) * basis, akkord: k2.akkord, lang: k2.lang }));
    }
    abschnitte.push({ titel: bau.titel, ereignisse });
  }
  return { wahl, abschnitte, tonarten };
}

/** Alle Töne der Etüde (ohne Pausen). */
export const etuedenToene = (e: Etuede) => e.abschnitte.flatMap((a) => a.ereignisse.filter((x) => x.ton));

// ════════════════════════════════════════════════════════════════════
// Einstellung (reist mit der Sicherung: `ueben:etueden`)
// ════════════════════════════════════════════════════════════════════

export interface EtuedenEinstellung { muster: MusterId; reihenfolge: Reihenfolge; start: number; rhythmus: Rhythmus; bpm: number; ober: number }
export const ETUEDEN_STANDARD: EtuedenEinstellung = { muster: 'tonleiter', reihenfolge: 'quinten', start: 0, rhythmus: 'achtel', bpm: 80, ober: UMFANG.bis };
export const ETUEDEN_TEMPO = { von: 40, bis: 240 } as const;

const ganzIn = (v: unknown, von: number, bis: number): v is number => Number.isInteger(v) && (v as number) >= von && (v as number) <= bis;
export function istEtuedenEinstellung(v: unknown): v is EtuedenEinstellung {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  return istMusterId(e.muster) && typeof e.reihenfolge === 'string' && (REIHENFOLGEN as readonly string[]).includes(e.reihenfolge)
    && ganzIn(e.start, 0, 11) && typeof e.rhythmus === 'string' && (RHYTHMEN as readonly string[]).includes(e.rhythmus)
    && ganzIn(e.bpm, ETUEDEN_TEMPO.von, ETUEDEN_TEMPO.bis) && ganzIn(e.ober, UMFANG.obenMin, UMFANG.obenMax);
}
