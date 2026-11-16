// Harmonie-Kern (I-11 Akkord-Spickzettel, I-12 Transponier-Helfer, Grundlage
// für I-14 Etüden, I-15 Spielhilfe, I-16 Licks, I-19 Jam-Karte). Rein, getestet.
//
// ── Schreibweisen (Entscheidung) ──
// • Akkordsymbole international wie auf jedem Leadsheet: B♭7, F♯m7, Bmaj7
//   (B = deutsches H). Eingabe nimmt `b`/`#` und `♭`/`♯`, dazu `H` als H.
//   Gespeichert wird ASCII (`akkordText(a, { ascii: true })` → "Bb7b9"),
//   angezeigt mit ♭/♯ (`akkordText(a)` → "B♭7♭9").
// • Einzelne Töne deutsch wie im Rest der App (`tonName` in ./tonprofil):
//   B = B♭, H = B, Es, Fis, Ces, Eis, Heses … (`tonDeutsch`).
// • Jeder Ton ist *geschrieben* (Stammton + Vorzeichen), nicht nur Tonklasse:
//   Akkord- und Leitertöne folgen ihrer Stufe (C°7 = C Es Ges Heses, F♯-Dur
//   hat Eis, G♭-Dur hat Ces). Transponieren geht über Intervalle
//   (Stammtöne + Halbtöne), danach wählt `bequem…` die enharmonisch
//   bequemste Schreibweise (≤ 6 Vorzeichen, keine Doppelvorzeichen am Grundton).
//
// ── Bausteine ──
// Ton (Stammton + Vorzeichen) → Intervall → Akkord (Grundton, Struktur,
// Bass) mit Tönen, Funktionen, Guide Tones, Leiter-Vorschlägen → Folge
// (Takte mit Akkorden) → Transponieren klingend ↔ notiert je Stimmung →
// Klänge (MIDI) und ABC für Vorspielen und Notenzeile.

import type { Klang } from './notensatz';
import { STIMMUNGEN, type Stimmung } from './ueben';

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ════════════════════════════════════════════════════════════════════
// Töne
// ════════════════════════════════════════════════════════════════════

/** Ein geschriebener Ton ohne Oktave: Stammton 0–6 (C D E F G A B/H) und Vorzeichen −2…+2. */
export interface Ton { stamm: number; vz: number }

const STAMM_KLASSE = [0, 2, 4, 5, 7, 9, 11];
const STAMM_INTERNATIONAL = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STAMM_DEUTSCH = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];

/** Tonklasse 0–11 (C = 0). */
export const tonKlasse = (t: Ton) => mod(STAMM_KLASSE[t.stamm] + t.vz, 12);
export const gleicherTon = (a: Ton, b: Ton) => a.stamm === b.stamm && a.vz === b.vz;

const VZ_ZEICHEN: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };
const VZ_ASCII: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** Internationaler Name wie im Akkordsymbol: "B♭", "F♯", "B" (= H); `ascii` → "Bb", "F#". */
export const tonSymbol = (t: Ton, ascii = false) => STAMM_INTERNATIONAL[t.stamm] + (ascii ? VZ_ASCII : VZ_ZEICHEN)[t.vz];

/** Deutscher Name wie in der App: C, Cis, Ces, Es, As, B (= H♭), H, Heses, Eis, His … */
export function tonDeutsch(t: Ton): string {
  const s = STAMM_DEUTSCH[t.stamm];
  if (t.vz === 0) return s;
  if (t.vz === 1) return `${s}is`;
  if (t.vz === 2) return `${s}isis`;
  if (t.vz === -1) return s === 'H' ? 'B' : s === 'E' || s === 'A' ? `${s}s` : `${s}es`;
  return s === 'H' ? 'Heses' : s === 'E' ? 'Eses' : s === 'A' ? 'Asas' : `${s}eses`;
}

/** Deutscher Name mit Oktave wie `tonName` (C4 = 60), aber richtig geschrieben (Ces5 statt H4 bleibt Ces… mit der Oktave des Stammtons). */
export function tonDeutschMitOktave(t: Ton, midi: number): string {
  return `${tonDeutsch(t)}${Math.floor((midi - t.vz) / 12) - 1}`;
}

/** Tonname lesen (international, ASCII oder ♭/♯; `H` = B): "Bb", "F#", "E♭", "H", "Cb". */
export function tonLesen(text: string): Ton | null {
  const m = /^([A-Ha-h])(bb|𝄫|b|♭|##|𝄪|#|♯)?$/.exec(text.trim());
  if (!m) return null;
  return tonAusTeilen(m[1], m[2] ?? '');
}

function tonAusTeilen(buchstabe: string, vz: string): Ton {
  const b = buchstabe.toUpperCase();
  const stamm = b === 'H' ? 6 : STAMM_INTERNATIONAL.indexOf(b);
  const v = vz === 'bb' || vz === '𝄫' ? -2 : vz === 'b' || vz === '♭' ? -1 : vz === '##' || vz === '𝄪' ? 2 : vz === '#' || vz === '♯' ? 1 : 0;
  return { stamm, vz: v };
}

/** Tonklasse geschrieben, mit Kreuzen oder Bs (weiße Tasten immer ohne Vorzeichen). */
export function tonAusKlasse(klasse: number, mit: 'kreuz' | 'be' = 'be'): Ton {
  const k = mod(klasse, 12);
  const natur = STAMM_KLASSE.indexOf(k);
  if (natur >= 0) return { stamm: natur, vz: 0 };
  return mit === 'kreuz' ? { stamm: STAMM_KLASSE.indexOf(k - 1), vz: 1 } : { stamm: STAMM_KLASSE.indexOf(k + 1), vz: -1 };
}

/** Derselbe Klang auf dem Nachbar-Stammton: `richtung` +1 (C♯ → D♭), −1 (D♭ → C♯). Null, wenn mehr als zwei Vorzeichen nötig wären. */
export function enharmonisch(t: Ton, richtung: 1 | -1): Ton | null {
  const stamm = mod(t.stamm + richtung, 7);
  let vz = mod(tonKlasse(t) - STAMM_KLASSE[stamm], 12);
  if (vz > 6) vz -= 12;
  return Math.abs(vz) <= 2 ? { stamm, vz } : null;
}

/** Ein Ton mit möglichst wenigen Vorzeichen (Doppelvorzeichen und E♯/B♯/F♭/C♭ werden schlicht). */
export const tonSchlicht = (t: Ton): Ton => (t.vz === 0 ? t : tonAusKlasse(tonKlasse(t), t.vz > 0 ? 'kreuz' : 'be'));

// ════════════════════════════════════════════════════════════════════
// Intervalle und Stufen
// ════════════════════════════════════════════════════════════════════

/** Ein Intervall: Stammton-Schritte (Terz = 2) und Halbtöne (große Terz = 4). */
export interface Intervall { stufen: number; halbtoene: number }

/** Ton um ein Intervall versetzen (`richtung` −1 = abwärts), Schreibweise folgt dem Intervall. */
export function tonVersetzen(t: Ton, iv: Intervall, richtung: 1 | -1 = 1): Ton {
  const stamm = mod(t.stamm + richtung * iv.stufen, 7);
  const ziel = mod(tonKlasse(t) + richtung * iv.halbtoene, 12);
  let vz = mod(ziel - STAMM_KLASSE[stamm], 12);
  if (vz > 6) vz -= 12;
  // Mehr als ein Doppelvorzeichen gibt es nicht — dann eben schlicht.
  return Math.abs(vz) <= 2 ? { stamm, vz } : tonAusKlasse(ziel, vz > 0 ? 'kreuz' : 'be');
}

/** Stufe über dem Grundton: Zahl 1–13 (9 = None …) und Halbtöne über dem Grundton (0–11). */
export interface Stufe { zahl: number; halbtoene: number }
const NATUR: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

/** Funktionsbezeichnung einer Stufe: "1", "♭3", "♯11", "𝄫7" … */
export function funktion(s: Stufe): string {
  const basis = ((s.zahl - 1) % 7) + 1;
  let d = mod(s.halbtoene - NATUR[basis], 12);
  if (d > 6) d -= 12;
  return `${VZ_ZEICHEN[d] ?? ''}${s.zahl}`;
}

/** Der geschriebene Ton einer Stufe über `grund`. Doppelvorzeichen werden schlicht geschrieben, wie auf
 *  Leadsheets üblich (C°7 = C E♭ G♭ A, D♭7♭9 hat D statt E𝄫); die Funktion bleibt (𝄫7, ♭9). */
export function stufenTon(grund: Ton, s: Stufe): Ton {
  const t = tonVersetzen(grund, { stufen: s.zahl - 1, halbtoene: s.halbtoene });
  return Math.abs(t.vz) === 2 ? tonSchlicht(t) : t;
}

// ════════════════════════════════════════════════════════════════════
// Akkorde
// ════════════════════════════════════════════════════════════════════

export type Terz = 'gross' | 'klein' | 'sus4' | 'sus2';
export type Quinte = 'rein' | 'vermindert' | 'uebermaessig' | 'keine';
export type Septime = 'klein' | 'gross' | 'vermindert' | null;
/** Optionstöne (Spannungen) in fester Reihenfolge. */
export const OPTIONEN = ['b9', '9', '#9', '11', '#11', 'b13', '13'] as const;
export type Option = (typeof OPTIONEN)[number];

/** Aufbau eines Akkords, unabhängig vom Grundton. */
export interface Struktur { terz: Terz; quinte: Quinte; septime: Septime; sexte: boolean; optionen: Option[]; alt: boolean }

/** Grundart für Namen und Leiter-Vorschläge. */
export type AkkordArt =
  | 'dur' | 'moll' | 'vermindert' | 'uebermaessig' | 'sus4' | 'sus2' | 'dur6' | 'moll6'
  | 'dom7' | 'dom7sus4' | 'maj7' | 'moll7' | 'mollMaj7' | 'halbvermindert' | 'vermindert7';

export interface AkkordTon {
  ton: Ton;
  /** Funktion über dem Grundton: "1", "♭3", "5", "♭7", "♯11" … */
  funktion: string;
  /** Halbtöne über dem Grundton (0–11). */
  halbtoene: number;
  /** Guide Tone (Terz und Septime, bzw. Terz und Sexte bei 6-Akkorden, Quarte bei sus). */
  guide: boolean;
}

export interface Akkord {
  grund: Ton;
  /** Basston bei Slash-Akkorden (C/E), sonst null. */
  bass: Ton | null;
  struktur: Struktur;
  art: AkkordArt;
  /** Akkordtöne vom Grundton aufwärts in Stufenfolge (1, 3, 5, 7, 9, 11, 13). */
  toene: AkkordTon[];
}

const OPTION_STUFE: Record<Option, Stufe> = {
  b9: { zahl: 9, halbtoene: 1 }, 9: { zahl: 9, halbtoene: 2 }, '#9': { zahl: 9, halbtoene: 3 },
  11: { zahl: 11, halbtoene: 5 }, '#11': { zahl: 11, halbtoene: 6 }, b13: { zahl: 13, halbtoene: 8 }, 13: { zahl: 13, halbtoene: 9 },
};

/** Die Stufen eines Akkordaufbaus, aufsteigend nach Stufenzahl. */
export function strukturStufen(s: Struktur): Stufe[] {
  const st: Stufe[] = [{ zahl: 1, halbtoene: 0 }];
  if (s.terz === 'gross') st.push({ zahl: 3, halbtoene: 4 });
  if (s.terz === 'klein') st.push({ zahl: 3, halbtoene: 3 });
  if (s.terz === 'sus2') st.push({ zahl: 2, halbtoene: 2 });
  if (s.terz === 'sus4') st.push({ zahl: 4, halbtoene: 5 });
  if (s.quinte === 'rein') st.push({ zahl: 5, halbtoene: 7 });
  if (s.quinte === 'vermindert') st.push({ zahl: 5, halbtoene: 6 });
  if (s.quinte === 'uebermaessig') st.push({ zahl: 5, halbtoene: 8 });
  if (s.sexte) st.push({ zahl: 6, halbtoene: 9 });
  if (s.septime === 'klein') st.push({ zahl: 7, halbtoene: 10 });
  if (s.septime === 'gross') st.push({ zahl: 7, halbtoene: 11 });
  if (s.septime === 'vermindert') st.push({ zahl: 7, halbtoene: 9 });
  for (const o of OPTIONEN) if (s.optionen.includes(o)) st.push(OPTION_STUFE[o]);
  return st;
}

/** Grundart aus dem Aufbau. */
export function akkordArt(s: Struktur): AkkordArt {
  const { terz, quinte, septime } = s;
  if (terz === 'klein' && quinte === 'vermindert') return septime === 'vermindert' ? 'vermindert7' : septime === 'klein' ? 'halbvermindert' : 'vermindert';
  if (septime === 'klein') return terz === 'klein' ? 'moll7' : terz === 'gross' ? 'dom7' : 'dom7sus4';
  if (septime === 'gross') return terz === 'klein' ? 'mollMaj7' : 'maj7';
  if (terz === 'gross') return quinte === 'uebermaessig' ? 'uebermaessig' : s.sexte ? 'dur6' : 'dur';
  if (terz === 'klein') return s.sexte ? 'moll6' : 'moll';
  return terz;
}

const istGuide = (s: Stufe, alle: readonly Stufe[]) => {
  if (s.zahl === 3 || (s.zahl === 4 && !alle.some((x) => x.zahl === 3))) return true;
  if (s.zahl === 7) return true;
  return s.zahl === 6 && !alle.some((x) => x.zahl === 7);
};

/** Akkord aus Grundton, Aufbau und (optional) Bass. */
export function akkordBauen(grund: Ton, struktur: Struktur, bass: Ton | null = null): Akkord {
  const stufen = strukturStufen(struktur);
  const toene = stufen.map((s) => ({ ton: stufenTon(grund, s), funktion: funktion(s), halbtoene: s.halbtoene, guide: istGuide(s, stufen) }));
  const b = bass && tonKlasse(bass) !== tonKlasse(grund) ? bass : null;
  return { grund, bass: b, struktur, art: akkordArt(struktur), toene };
}

/** Die Guide Tones des Akkords (Terz und Septime; ohne Septime die Sexte; sus: Quarte). */
export const guideTones = (a: Akkord) => a.toene.filter((t) => t.guide);

// ── Lesen ──

export interface AkkordFehler { fehler: string }

const ZEICHEN_ERSATZ: [RegExp, string][] = [
  [/[♭]/g, 'b'], [/[♯]/g, '#'], [/[Δ∆]/g, 'maj'], [/\^/g, 'maj'], [/[−–]/g, '-'], [/[øØ]/g, 'h'], [/[°º]/g, 'o'],
  [/[\s(),]/g, ''],
];

/** Ein Akkordsymbol lesen (C, Cm, C-, C7, Cmaj7/CΔ/CM7, Cm7, Cm7♭5/Cø, Cdim/C°, Cdim7/C°7, C6, Cm6, C6/9,
 *  C9, Cmaj9, Cm9, C7♭9, C7♯9, C7♯11, C7♭13, C7alt, C13, Csus4, C7sus4, C+/Caug, C7♯5, Cadd9, C/E …). */
export function akkordPruefen(text: string): Akkord | AkkordFehler {
  const roh = text.trim();
  if (!roh) return { fehler: 'Leer' };
  const m = /^([A-Ha-h])(bb|b|♭|##|#|♯)?(.*)$/.exec(roh);
  if (!m) return { fehler: `„${roh}“: Ein Akkord beginnt mit dem Grundton (A–G, H).` };
  // Ein kleines b direkt am Anfang ist ein Vorzeichen (Bb, Eb); "bb" ebenso.
  const grund = tonAusTeilen(m[1], m[2] ?? '');
  let rest = m[3];
  // Slash-Akkord: letzter /X (nicht 6/9).
  let bass: Ton | null = null;
  const slash = /\/([A-Ha-h](?:bb|b|♭|##|#|♯)?)$/.exec(rest);
  if (slash) { bass = tonLesen(slash[1]); rest = rest.slice(0, slash.index); }
  for (const [re, neu] of ZEICHEN_ERSATZ) rest = rest.replace(re, neu);
  const s = strukturLesen(rest);
  if ('fehler' in s) return { fehler: `„${roh}“: ${s.fehler}` };
  return akkordBauen(grund, s, bass);
}

/** Wie `akkordPruefen`, aber null statt Fehlertext. */
export function akkordLesen(text: string): Akkord | null {
  const a = akkordPruefen(text);
  return 'fehler' in a ? null : a;
}
export const istAkkord = (a: Akkord | AkkordFehler): a is Akkord => !('fehler' in a);

function strukturLesen(roh: string): Struktur | AkkordFehler {
  let r = roh;
  const nimm = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(r);
    if (m) r = r.slice(m[0].length);
    return m;
  };
  let terz: Terz = 'gross', quinte: Quinte = 'rein', septime: Septime = null, sexte = false, alt = false;
  const opt = new Set<Option>();
  let dim = false, gross = false, elfDominant = false;

  const MAJ = /^(maj|Maj|MAJ|ma(?=[79]|1[13])|M(?=[79]|1[13]|$)|j(?=[79]))/;
  if (nimm(MAJ)) gross = true;
  else if (nimm(/^(min|mi|m|-)/)) {
    terz = 'klein';
    if (nimm(MAJ)) gross = true;
  } else if (nimm(/^h/)) { terz = 'klein'; quinte = 'vermindert'; septime = 'klein'; nimm(/^7/); }
  else if (nimm(/^(dim|o)/)) { terz = 'klein'; quinte = 'vermindert'; dim = true; }
  if (nimm(/^(\+|aug)/)) quinte = 'uebermaessig';

  const zahl = nimm(/^(6\/9|69|6|7|9|11|13)/);
  if (zahl) {
    const z = zahl[1];
    if (z === '6' || z === '6/9' || z === '69') { sexte = true; if (z !== '6') opt.add('9'); }
    else {
      septime = gross ? 'gross' : dim ? 'vermindert' : 'klein';
      if (z === '9' || z === '11' || z === '13') opt.add('9');
      if (z === '11') { opt.add('11'); elfDominant = terz === 'gross' && !gross; }
      if (z === '13') opt.add('13');
    }
  } else if (gross) septime = 'gross';

  while (r.length) {
    if (nimm(/^sus2/)) { terz = 'sus2'; continue; }
    if (nimm(/^sus4?/)) { terz = 'sus4'; continue; }
    if (nimm(/^alt/)) { alt = true; continue; }
    if (nimm(/^(\+|aug)/)) { quinte = 'uebermaessig'; continue; }
    const add = nimm(/^add(9|2|11|4|13|6)/);
    if (add) {
      const a = add[1];
      if (a === '9' || a === '2') opt.add('9'); else if (a === '11' || a === '4') opt.add('11'); else if (a === '13') opt.add('13'); else sexte = true;
      continue;
    }
    const fuenf = nimm(/^(#|\+|b|-)5/);
    if (fuenf) { quinte = fuenf[1] === '#' || fuenf[1] === '+' ? 'uebermaessig' : 'vermindert'; continue; }
    const sp = nimm(/^(b|#|-|\+)?(9|11|13)/);
    if (sp) {
      const v = sp[1] === '-' ? 'b' : sp[1] === '+' ? '#' : sp[1] ?? '';
      const o = `${v}${sp[2]}`;
      if (!(OPTIONEN as readonly string[]).includes(o)) return { fehler: `${o} gibt es als Option nicht.` };
      opt.add(o as Option);
      // Eine Spannung ohne Septime (C♭9) meint den Septakkord.
      if (!septime && !sexte && (o === 'b9' || o === '#9' || o === '#11' || o === 'b13')) septime = 'klein';
      continue;
    }
    return { fehler: `„${r}“ verstehe ich nicht.` };
  }

  // Dominant-11 (C11) klingt ohne Terz: ein 9sus4.
  if (elfDominant) { terz = 'sus4'; opt.delete('11'); }
  if (alt) {
    if (!septime) septime = 'klein';
    if (septime !== 'klein' || terz === 'klein') return { fehler: 'alt gibt es nur am Dominantseptakkord.' };
    for (const o of ['b9', '#9', '#11', 'b13'] as Option[]) opt.add(o);
    opt.delete('9'); opt.delete('11'); opt.delete('13');
    quinte = 'keine';
  }
  // Doppelte Tonklassen bereinigen.
  if (opt.has('9') && (opt.has('b9') || opt.has('#9')) && !alt) opt.delete('9');
  if (opt.has('13') && opt.has('b13')) opt.delete('13');
  if (quinte === 'uebermaessig') opt.delete('b13');
  if (quinte === 'vermindert') opt.delete('#11');
  if (terz === 'sus4') opt.delete('11');
  if (sexte) opt.delete('13');
  if (terz === 'klein') opt.delete('#9');
  if (septime === 'vermindert' && sexte) sexte = false;
  return { terz, quinte, septime, sexte, optionen: OPTIONEN.filter((o) => opt.has(o)), alt };
}

// ── Schreiben ──

const ALS: Record<Option, [string, string]> = {
  b9: ['♭9', 'b9'], 9: ['9', '9'], '#9': ['♯9', '#9'], 11: ['11', '11'], '#11': ['♯11', '#11'], b13: ['♭13', 'b13'], 13: ['13', '13'],
};

/** Nur die Endung (ohne Grundton und Bass): "m7♭5", "maj7", "7♯9" — oder ASCII "m7b5". */
export function endungText(s: Struktur, ascii = false): string {
  const i = ascii ? 1 : 0;
  const f = (o: Option) => ALS[o][i];
  const b = ascii ? 'b' : '♭', k = ascii ? '#' : '♯';
  const art = akkordArt(s);
  const opt = new Set(s.optionen);
  const rest = (weg: Option[]) => s.optionen.filter((o) => !weg.includes(o)).map(f).join('');
  // Höchste natürliche Option als Zahl (9, 11, 13), wenn die darunter mit da sind.
  const zahl = (): { z: string; weg: Option[] } => {
    // 13 schließt die 9 ein — auch C13♭9 (die alterierte None steht dahinter).
    if (opt.has('13')) return { z: '13', weg: ['13', '9', ...(opt.has('11') && opt.has('9') ? ['11' as Option] : [])] };
    if (opt.has('11') && opt.has('9')) return { z: '11', weg: ['11', '9'] };
    if (opt.has('9')) return { z: '9', weg: ['9'] };
    return { z: '7', weg: [] };
  };
  switch (art) {
    case 'dur': return (opt.size ? `add${s.optionen.map(f).join('')}` : '');
    case 'moll': return `m${opt.size ? `add${s.optionen.map(f).join('')}` : ''}`;
    case 'vermindert': return ascii ? 'dim' : '°';
    case 'uebermaessig': return `+${rest([])}`;
    case 'sus4': return `sus4${rest([])}`;
    case 'sus2': return `sus2${rest([])}`;
    case 'dur6': return opt.has('9') ? `6/9${rest(['9'])}` : `6${rest([])}`;
    case 'moll6': return opt.has('9') ? `m6/9${rest(['9'])}` : `m6${rest([])}`;
    case 'vermindert7': return `${ascii ? 'dim7' : '°7'}${rest([])}`;
    case 'halbvermindert': return `m7${b}5${rest([])}`;
    case 'maj7': { const { z, weg } = zahl(); return `maj${z}${s.quinte === 'uebermaessig' ? `${k}5` : ''}${rest(weg)}`; }
    case 'mollMaj7': { const { z, weg } = zahl(); return `m(maj${z})${rest(weg)}`; }
    case 'moll7': { const { z, weg } = zahl(); return `m${z}${s.quinte === 'uebermaessig' ? `${k}5` : ''}${rest(weg)}`; }
    case 'dom7sus4': { const { z, weg } = zahl(); return `${z}sus4${rest(weg)}`; }
    case 'dom7': {
      if (s.alt) return '7alt';
      const { z, weg } = zahl();
      const q = s.quinte === 'uebermaessig' ? `${k}5` : s.quinte === 'vermindert' ? `${b}5` : '';
      return `${z}${q}${rest(weg)}`;
    }
  }
}

/** Akkordsymbol international: "B♭7♭9", "F♯m7", "C/E"; `ascii` → "Bb7b9" (zum Speichern, liest sich zurück). */
export function akkordText(a: Akkord, { ascii = false }: { ascii?: boolean } = {}): string {
  return `${tonSymbol(a.grund, ascii)}${endungText(a.struktur, ascii)}${a.bass ? `/${tonSymbol(a.bass, ascii)}` : ''}`;
}

const OPTION_NAMEN = (o: Option) => ALS[o][0];

/** Deutscher Name: "Es-Dur", "fis-Moll-Septakkord", "B-Dominantseptakkord mit ♭9", "C-Dur über E". */
export function akkordName(a: Akkord): string {
  const G = tonDeutsch(a.grund), g = G.toLowerCase();
  const s = a.struktur;
  const optionen = s.alt ? [] : s.optionen.filter((o) => !((a.art === 'dur6' || a.art === 'moll6') && o === '9')).map(OPTION_NAMEN);
  const mit = optionen.length ? ` mit ${optionen.length > 1 ? `${optionen.slice(0, -1).join(', ')} und ${optionen[optionen.length - 1]}` : optionen[0]}` : '';
  const q = s.quinte === 'uebermaessig' && a.art !== 'uebermaessig' ? ', übermäßige Quinte' : s.quinte === 'vermindert' && a.art === 'dom7' ? ', verminderte Quinte' : '';
  const NAME: Record<AkkordArt, string> = {
    dur: `${G}-Dur`,
    moll: `${g}-Moll`,
    vermindert: `${G} vermindert`,
    uebermaessig: `${G} übermäßig`,
    sus4: `${G} mit Quarte statt Terz`,
    sus2: `${G} mit Sekunde statt Terz`,
    dur6: `${G}-Dur mit Sexte${s.optionen.includes('9') ? ' und None' : ''}`,
    moll6: `${g}-Moll mit Sexte${s.optionen.includes('9') ? ' und None' : ''}`,
    dom7: `${G}-Dominantseptakkord${s.alt ? ', alteriert' : ''}`,
    dom7sus4: `${G}-Septakkord mit Quarte statt Terz`,
    maj7: `${G}-Dur mit großer Septime`,
    moll7: `${g}-Moll-Septakkord`,
    mollMaj7: `${g}-Moll mit großer Septime`,
    halbvermindert: `${G} halbvermindert`,
    vermindert7: `${G} vermindert (Septakkord)`,
  };
  const verbunden = mit && NAME[a.art].includes(' mit ') ? mit.replace(/^ mit /, ' und ') : mit;
  return `${NAME[a.art]}${q}${verbunden}${a.bass ? ` über ${tonDeutsch(a.bass)}` : ''}`;
}

/** Endungen für die Schnellwahl (ASCII, wie sie `akkordPruefen` liest). */
export const SCHNELLWAHL: readonly { endung: string; name: string }[] = [
  { endung: '', name: 'Dur' }, { endung: 'm', name: 'Moll' }, { endung: '7', name: '7' }, { endung: 'maj7', name: 'maj7' },
  { endung: 'm7', name: 'm7' }, { endung: 'm7b5', name: 'm7♭5' }, { endung: 'dim7', name: '°7' }, { endung: '6', name: '6' },
  { endung: 'm6', name: 'm6' }, { endung: '9', name: '9' }, { endung: '7b9', name: '7♭9' }, { endung: '7#11', name: '7♯11' },
  { endung: '7alt', name: '7alt' }, { endung: 'sus4', name: 'sus4' }, { endung: '7sus4', name: '7sus4' }, { endung: '+', name: '+' },
];

// ════════════════════════════════════════════════════════════════════
// Leitern (Tonleitern, Modi)
// ════════════════════════════════════════════════════════════════════

export type LeiterId =
  | 'ionisch' | 'dorisch' | 'phrygisch' | 'lydisch' | 'mixolydisch' | 'aeolisch' | 'lokrisch'
  | 'lokrisch9' | 'melodischMoll' | 'lydischDominant' | 'mixolydischB13' | 'alteriert' | 'harmonischMoll' | 'phrygischDur'
  | 'halbtonGanzton' | 'ganztonHalbton' | 'ganzton' | 'durPentatonik' | 'mollPentatonik' | 'blues';

const L = (zahlen: string): Stufe[] => zahlen.split(' ').map((z) => {
  const m = /^(bb|b|#)?(\d+)$/.exec(z)!;
  const zahl = Number(m[2]);
  const d = m[1] === 'bb' ? -2 : m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  return { zahl, halbtoene: mod(NATUR[((zahl - 1) % 7) + 1] + d, 12) };
});

export const LEITERN: Record<LeiterId, { name: string; stufen: Stufe[] }> = {
  ionisch: { name: 'Ionisch (Dur)', stufen: L('1 2 3 4 5 6 7') },
  dorisch: { name: 'Dorisch', stufen: L('1 2 b3 4 5 6 b7') },
  phrygisch: { name: 'Phrygisch', stufen: L('1 b2 b3 4 5 b6 b7') },
  lydisch: { name: 'Lydisch', stufen: L('1 2 3 #4 5 6 7') },
  mixolydisch: { name: 'Mixolydisch', stufen: L('1 2 3 4 5 6 b7') },
  aeolisch: { name: 'Äolisch (natürliches Moll)', stufen: L('1 2 b3 4 5 b6 b7') },
  lokrisch: { name: 'Lokrisch', stufen: L('1 b2 b3 4 b5 b6 b7') },
  lokrisch9: { name: 'Lokrisch ♮2', stufen: L('1 2 b3 4 b5 b6 b7') },
  melodischMoll: { name: 'Melodisch Moll (Jazz-Moll)', stufen: L('1 2 b3 4 5 6 7') },
  lydischDominant: { name: 'Lydisch ♭7 (Lydisch-Dominant)', stufen: L('1 2 3 #4 5 6 b7') },
  mixolydischB13: { name: 'Mixolydisch ♭13', stufen: L('1 2 3 4 5 b6 b7') },
  alteriert: { name: 'Alteriert (Superlokrisch)', stufen: L('1 b2 #2 3 #4 b6 b7') },
  harmonischMoll: { name: 'Harmonisch Moll', stufen: L('1 2 b3 4 5 b6 7') },
  phrygischDur: { name: 'Phrygisch-Dur (HM5)', stufen: L('1 b2 3 4 5 b6 b7') },
  halbtonGanzton: { name: 'Halbton-Ganzton', stufen: L('1 b2 #2 3 #4 5 6 b7') },
  ganztonHalbton: { name: 'Ganzton-Halbton', stufen: L('1 2 b3 4 b5 b6 6 7') },
  ganzton: { name: 'Ganzton', stufen: L('1 2 3 #4 #5 b7') },
  durPentatonik: { name: 'Dur-Pentatonik', stufen: L('1 2 3 5 6') },
  mollPentatonik: { name: 'Moll-Pentatonik', stufen: L('1 b3 4 5 b7') },
  blues: { name: 'Blues-Tonleiter', stufen: L('1 b3 4 #4 5 b7') },
};

export interface LeiterTon { ton: Ton; funktion: string; halbtoene: number }
export interface Leiter { id: LeiterId; name: string; grund: Ton; toene: LeiterTon[] }

export function leiterBauen(id: LeiterId, grund: Ton): Leiter {
  const def = LEITERN[id];
  return { id, name: def.name, grund, toene: def.stufen.map((s) => ({ ton: stufenTon(grund, s), funktion: funktion(s), halbtoene: s.halbtoene })) };
}

export interface LeiterVorschlag { leiter: Leiter; warum: string }

/** Passende Leitern zum Akkord, die erste ist die Standardwahl; je ein kurzer Satz warum. */
export function leiterVorschlaege(a: Akkord): LeiterVorschlag[] {
  const v = (id: LeiterId, warum: string): LeiterVorschlag => ({ leiter: leiterBauen(id, a.grund), warum });
  const s = a.struktur, o = new Set(s.optionen);
  switch (a.art) {
    case 'dur': return [
      v('ionisch', 'Die Dur-Tonleiter selbst — klingt nach Zuhause; die 4 nur im Vorbeigehen.'),
      v('durPentatonik', 'Fünf Töne ohne Reibung — der sichere Start zum Improvisieren.'),
      v('lydisch', '♯4 statt 4: offen und schwebend, nichts reibt mit der Terz.'),
    ];
    case 'dur6': return [
      v('ionisch', 'Die Sexte gehört zur Dur-Tonleiter — ein Tonika-Klang.'),
      v('durPentatonik', 'Die Pentatonik enthält 6 und 9 — passt genau.'),
    ];
    case 'maj7': return s.quinte === 'uebermaessig' || o.has('#11') ? [
      v('lydisch', '♯11 oder ♯5 im Symbol verlangt Lydisch.'),
    ] : [
      v('ionisch', 'Die Tonleiter des Akkords (I. Stufe); die 4 reibt mit der 3 — nicht drauf landen.'),
      v('lydisch', '♯11 statt 4: der moderne, helle maj7-Klang (IV. Stufe).'),
      v('durPentatonik', 'Ohne 4 und 7 — nichts kann schief klingen.'),
    ];
    case 'moll': return [
      v('dorisch', 'Moll mit großer Sexte — die Standardwahl im Jazz.'),
      v('aeolisch', 'Natürliches Moll mit kleiner Sexte — dunkler, wenn der Akkord die Tonika in Moll ist.'),
      v('mollPentatonik', 'Fünf Töne, die über Moll immer gehen.'),
    ];
    case 'moll7': return [
      v('dorisch', 'Moll mit großer Sexte — die ii in der ii–V–I und der Klang von „So What“.'),
      v('aeolisch', 'Wenn der Akkord die vi. Stufe oder Moll-Tonika ist: kleine Sexte.'),
      v('mollPentatonik', 'Fünf Töne ohne Reibung — gut für den Anfang.'),
    ];
    case 'moll6': case 'mollMaj7': return [
      v('melodischMoll', 'Moll mit großer 6 und 7 — genau die Töne des Akkords; der Jazz-Moll-Klang.'),
      v('dorisch', 'Mit kleiner Septime — wenn es weniger gespannt klingen soll.'),
    ];
    case 'halbvermindert': return [
      v('lokrisch', 'Die Akkordtöne plus ♭2, 4, ♭6 — die ii in Moll.'),
      v('lokrisch9', 'Mit großer None statt ♭2 — weicher; 6. Modus von melodisch Moll.'),
    ];
    case 'vermindert': case 'vermindert7': return [
      v('ganztonHalbton', 'Abwechselnd Ganz- und Halbton: alle Akkordtöne und je ein Ton einen Ganzton darüber.'),
    ];
    case 'uebermaessig': return [
      v('ganzton', 'Nur Ganztöne — enthält 1, 3 und ♯5.'),
    ];
    case 'sus4': case 'dom7sus4': return [
      v('mixolydisch', 'Die Quarte ist hier Akkordton — frei darauf landen.'),
      v('dorisch', 'Dorisch auf der Quinte des Akkords klingt mit; hier vom Grundton: ♭3 als Blue Note.'),
    ];
    case 'sus2': return [
      v('ionisch', 'Dur ohne Terz im Akkord — die Tonleiter darf sie bringen.'),
      v('durPentatonik', 'Die Pentatonik hat 2 und 5 — passt zum offenen Klang.'),
    ];
    case 'dom7': {
      if (s.alt) return [
        v('alteriert', 'Alle Spannungen alteriert (♭9, ♯9, ♯11, ♭13) — 7. Modus von melodisch Moll; löst stark auf.'),
        v('halbtonGanzton', 'Mit reiner Quinte und 13 statt ♭13 — wenn die Begleitung so spielt.'),
      ];
      const b9 = o.has('b9'), k9 = o.has('#9'), k11 = o.has('#11') || s.quinte === 'vermindert', b13 = o.has('b13') || s.quinte === 'uebermaessig';
      if ((b9 || k9) && b13) return [
        v('alteriert', '♭9/♯9 und ♭13 zusammen — die alterierte Leiter enthält alle.'),
        v('phrygischDur', 'Mit reiner Quinte: Dominante in Moll (5. Stufe von harmonisch Moll).'),
      ];
      if (b9) return [
        v('halbtonGanzton', 'Abwechselnd Halbton und Ganzton: ♭9, ♯9, ♯11 und 13 — der „verminderte“ Dominant-Klang.'),
        v('phrygischDur', 'Wenn es nach Moll aufgelöst wird: ♭9 und ♭13 (5. Stufe von harmonisch Moll).'),
      ];
      if (k9) return [
        v('alteriert', '♯9 klingt meist alteriert — dazu ♭9, ♯11, ♭13.'),
        v('halbtonGanzton', '♯9 mit reiner Quinte und 13.'),
        v('blues', 'Die ♯9 ist die Blue Note (♭3) — im Blues die einfachste Wahl.'),
      ];
      if (k11) return [
        v('lydischDominant', '♯11 statt 4: Mixolydisch mit erhöhter Quarte — 4. Modus von melodisch Moll.'),
        v('ganzton', 'Wenn auch die Quinte erhöht klingt.'),
      ];
      if (b13) return s.quinte === 'uebermaessig' ? [
        v('ganzton', '♯5 mit großer None: die Ganztonleiter.'),
        v('alteriert', 'Mit ♭9/♯9 dazu: alteriert.'),
      ] : [
        v('mixolydischB13', 'Mixolydisch mit ♭13 (5. Modus von melodisch Moll) — oft in Moll-Tonarten.'),
        v('alteriert', 'Noch mehr Spannung: auch ♭9 und ♯9.'),
      ];
      return [
        v('mixolydisch', 'Dur mit kleiner Septime — genau die Akkordtöne plus 9, 11, 13; die 11 nur im Vorbeigehen.'),
        v('blues', 'Im Blues geht die Blues-Tonleiter über alle Akkorde.'),
        v('durPentatonik', 'Fünf Töne (1 2 3 5 6) — klingt hell und sicher.'),
      ];
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// Tonarten, Vorzeichen, Bequemlichkeit
// ════════════════════════════════════════════════════════════════════

export interface TonartAngabe { grund: Ton; moll: boolean }

const DUR_VORZEICHEN = [0, 2, 4, -1, 1, 3, 5]; // C D E F G A B

/** Vorzeichen der Tonart: + Kreuze, − Bs (F♯-Dur 6, G♭-Dur −6, d-Moll −1, C♯-Dur 7). */
export const vorzeichen = (t: TonartAngabe) => DUR_VORZEICHEN[t.grund.stamm] + 7 * t.grund.vz - (t.moll ? 3 : 0);

/** Text der Vorzeichen: "3 ♯", "2 ♭", "keine". */
export function vorzeichenText(n: number): string {
  return n === 0 ? 'keine Vorzeichen' : `${Math.abs(n)} ${n > 0 ? '♯' : '♭'}`;
}

/** "F♯-Dur", "es-Moll" (deutsche Tonnamen, Moll klein). */
export const tonartName = (t: TonartAngabe) => (t.moll ? `${tonDeutsch(t.grund).toLowerCase()}-Moll` : `${tonDeutsch(t.grund)}-Dur`);
/** Wie auf dem Leadsheet: "F♯", "E♭m"; `ascii` → "F#", "Ebm". */
export const tonartSymbol = (t: TonartAngabe, ascii = false) => `${tonSymbol(t.grund, ascii)}${t.moll ? 'm' : ''}`;

/** Tonart lesen: "F", "Bb", "Gm", "F#m", "C-", "Es-Dur", "fis-Moll", "Cmaj7" (Akkord → seine Tonart). */
export function tonartLesen(text: string): TonartAngabe | null {
  const t = text.trim();
  const deutsch = /^([A-Ha-h])(is|es|s)?[- ]?(dur|moll)$/i.exec(t);
  if (deutsch) {
    const b = deutsch[1].toUpperCase(), e = (deutsch[2] ?? '').toLowerCase();
    // Deutsch: B = H♭, H = H.
    const grund: Ton = b === 'B' ? { stamm: 6, vz: -1 } : tonAusTeilen(b, e === 'is' ? '#' : e ? 'b' : '');
    const moll = deutsch[3].toLowerCase() === 'moll';
    if (b === 'B' && e) return null;
    return { grund, moll };
  }
  const a = akkordLesen(t);
  if (!a) return null;
  return { grund: a.grund, moll: a.struktur.terz === 'klein' };
}

/** Die enharmonisch andere Schreibweise (F♯ ↔ G♭, C♯ ↔ D♭), wenn sie höchstens 7 Vorzeichen hat. */
export function tonartEnharmonisch(t: TonartAngabe): TonartAngabe | null {
  const kandidaten = ([1, -1] as const).map((r) => enharmonisch(t.grund, r)).filter((g): g is Ton => !!g)
    .map((grund) => ({ grund, moll: t.moll })).sort((a, b) => Math.abs(vorzeichen(a)) - Math.abs(vorzeichen(b)));
  return kandidaten.length && Math.abs(vorzeichen(kandidaten[0])) <= 7 ? kandidaten[0] : null;
}

/** Bequemste Schreibweise: mehr als 6 Vorzeichen (C♯-Dur, d♯-Moll …) oder ein Doppelvorzeichen werden enharmonisch umgeschrieben. */
export function tonartBequem(t: TonartAngabe): TonartAngabe {
  const n = vorzeichen(t);
  if (Math.abs(n) <= 6 && Math.abs(t.grund.vz) < 2) return t;
  const alt = enharmonisch(t.grund, n > 0 ? 1 : -1);
  if (!alt) return t;
  const neu = { grund: alt, moll: t.moll };
  return Math.abs(vorzeichen(neu)) < Math.abs(n) ? tonartBequem(neu) : t;
}

/** Tonart aus Tonklasse: weniger Vorzeichen gewinnt; bei Gleichstand (6) die B-Schreibweise. */
export function tonartAusKlasse(klasse: number, moll: boolean): TonartAngabe {
  const be = { grund: tonAusKlasse(klasse, 'be'), moll }, kreuz = { grund: tonAusKlasse(klasse, 'kreuz'), moll };
  return Math.abs(vorzeichen(kreuz)) < Math.abs(vorzeichen(be)) ? kreuz : be;
}

export type Schwierigkeit = 'leicht' | 'mittel' | 'schwer' | 'sehr schwer';

/** Wie bequem eine *notierte* Tonart auf der Klarinette liegt. Kreuz-Tonarten zählen etwas schwerer
 *  (Seitenklappen, Gabelgriffe über dem Bruch) als gleich viele Bs. */
export function klarinettenSchwierigkeit(t: TonartAngabe): { stufe: Schwierigkeit; unbequem: boolean; hinweis: string } {
  const n = vorzeichen(t);
  const last = n > 0 ? n + 0.5 : -n;
  const stufe: Schwierigkeit = last <= 2 ? 'leicht' : last <= 4 ? 'mittel' : last <= 5 ? 'schwer' : 'sehr schwer';
  const anders = tonartEnharmonisch(t);
  const hinweis = stufe === 'leicht' ? 'Liegt bequem.'
    : stufe === 'mittel' ? 'Geht gut — Tonleiter und Dreiklang vorher einmal durchspielen.'
      : `Unbequem: ${vorzeichenText(n)}. Tonleiter langsam üben, auf Gabel- und Seitengriffe achten${anders && Math.abs(vorzeichen(anders)) <= 6 ? `; oder als ${tonartName(anders)} denken (${vorzeichenText(vorzeichen(anders))})` : ''}.`;
  return { stufe, unbequem: stufe === 'schwer' || stufe === 'sehr schwer', hinweis };
}

// ════════════════════════════════════════════════════════════════════
// Transponieren: klingend ↔ notiert
// ════════════════════════════════════════════════════════════════════

/** Notiert = klingend + dieses Intervall (B-Klarinette: große Sekunde, Es: große Sexte, F: Quinte). */
export const STIMMUNG_INTERVALL: Record<Stimmung, Intervall> = {
  C: { stufen: 0, halbtoene: 0 },
  B: { stufen: 1, halbtoene: 2 },
  Es: { stufen: 5, halbtoene: 9 },
  F: { stufen: 4, halbtoene: 7 },
};
/** Kurzname der Stimmung für die Oberfläche. */
export const STIMMUNG_NAMEN: Record<Stimmung, string> = { C: 'C-Instrument', B: 'B-Klarinette', Es: 'Es-Instrument', F: 'F-Instrument' };
/** Für Instrumente außerhalb des Stimmgeräts (A-Klarinette: kleine Terz). */
export const A_KLARINETTE: Intervall = { stufen: 2, halbtoene: 3 };
export { STIMMUNGEN };

export type Richtung = 'zuNotiert' | 'zuKlingend';
const intervallVon = (s: Stimmung | Intervall): Intervall => (typeof s === 'string' ? STIMMUNG_INTERVALL[s] : s);
const vorz = (r: Richtung): 1 | -1 => (r === 'zuNotiert' ? 1 : -1);

/** Einen Ton zwischen klingend und notiert umrechnen. */
export const tonTransponieren = (t: Ton, s: Stimmung | Intervall, r: Richtung) => tonVersetzen(t, intervallVon(s), vorz(r));

/** Eine Tonart umrechnen, in bequemster Schreibweise (concert E → B-Klarinette F♯; concert B → D♭ statt C♯). */
export function tonartTransponieren(t: TonartAngabe, s: Stimmung | Intervall, r: Richtung): TonartAngabe {
  return tonartBequem({ grund: tonTransponieren(t.grund, s, r), moll: t.moll });
}

/** Einen Akkord umrechnen (Schreibweise dem Intervall nach; Doppelvorzeichen am Grundton werden schlicht). */
export function akkordTransponieren(a: Akkord, s: Stimmung | Intervall, r: Richtung): Akkord {
  const fix = (t: Ton) => (Math.abs(t.vz) === 2 ? tonSchlicht(t) : t);
  return akkordBauen(fix(tonTransponieren(a.grund, s, r)), a.struktur, a.bass ? fix(tonTransponieren(a.bass, s, r)) : null);
}

/** Akkord um beliebige Halbtöne/Stufen versetzen (Etüden durch die Tonarten). */
export const akkordVersetzen = (a: Akkord, iv: Intervall, richtung: 1 | -1 = 1): Akkord =>
  akkordBauen(tonVersetzen(a.grund, iv, richtung), a.struktur, a.bass ? tonVersetzen(a.bass, iv, richtung) : null);

// ════════════════════════════════════════════════════════════════════
// Akkordfolgen
// ════════════════════════════════════════════════════════════════════

export interface FolgenTakt { akkorde: Akkord[] }
export interface Folge { takte: FolgenTakt[]; fehler: string[] }

/** Akkordfolge lesen. Mit Taktstrichen: "| Cm7 F7 | B♭maj7 |" (Leerzeichen trennen Akkorde im Takt,
 *  `%` wiederholt den Takt davor, Zeilenwechsel = Taktstrich). Ohne Taktstriche ist jeder Akkord
 *  ein Takt: "E A B7 E". Unlesbares landet in `fehler`, der Rest bleibt. */
export function folgeLesen(text: string): Folge {
  const fehler: string[] = [];
  const t = text.replace(/\|\||\|:|:\||[[\]]/g, '|');
  const mitStrichen = t.includes('|');
  const roh: string[][] = mitStrichen
    ? t.split(/[|\n]/).map((x) => x.trim()).filter((x) => x.length).map((x) => x.split(/\s+/))
    : t.split(/\s+/).filter((x) => x.length).map((x) => [x]);
  const takte: FolgenTakt[] = [];
  for (const takt of roh) {
    if (takt.length === 1 && takt[0] === '%') {
      if (takte.length) takte.push({ akkorde: [...takte[takte.length - 1].akkorde] });
      else fehler.push('% ohne Takt davor');
      continue;
    }
    const akkorde: Akkord[] = [];
    for (const w of takt) {
      const a = akkordPruefen(w);
      if (istAkkord(a)) akkorde.push(a); else fehler.push(a.fehler);
    }
    if (akkorde.length) takte.push({ akkorde });
  }
  return { takte, fehler };
}

/** Folge als Text mit Taktstrichen: "| Cm7 F7 | B♭maj7 |"; `jeZeile` Takte je Zeile (0 = alles in einer). */
export function folgeText(f: Folge, { ascii = false, jeZeile = 0 }: { ascii?: boolean; jeZeile?: number } = {}): string {
  if (!f.takte.length) return '';
  const takte = f.takte.map((t) => t.akkorde.map((a) => akkordText(a, { ascii })).join(' '));
  if (!jeZeile) return `| ${takte.join(' | ')} |`;
  const zeilen: string[] = [];
  for (let i = 0; i < takte.length; i += jeZeile) zeilen.push(`| ${takte.slice(i, i + jeZeile).join(' | ')} |`);
  return zeilen.join('\n');
}

/** Alle Akkorde der Folge der Reihe nach. */
export const folgeAkkorde = (f: Folge): Akkord[] => f.takte.flatMap((t) => t.akkorde);

const folgeAbbilden = (f: Folge, g: (a: Akkord) => Akkord): Folge => ({ takte: f.takte.map((t) => ({ akkorde: t.akkorde.map(g) })), fehler: f.fehler });

// Wie unbequem eine Schreibweise der ganzen Folge ist: je Grundton die
// Vorzeichen seiner Tonart (Moll-Akkorde als Moll-Tonart) — so gewinnt
// "F♯ B C♯7" gegen "G♭ C♭ D♭7", aber "D♭ G♭ A♭7" gegen "C♯ F♯ G♯7".
function folgenLast(akkorde: readonly Akkord[]): number {
  let last = 0;
  for (const a of akkorde) {
    const moll = a.struktur.terz === 'klein';
    const n = Math.abs(vorzeichen({ grund: a.grund, moll }));
    last += n + (n > 7 ? 4 : 0) + (Math.abs(a.grund.vz) === 2 ? 10 : 0);
    if (a.bass) last += Math.abs(a.bass.vz) === 2 ? 10 : Math.abs(a.bass.vz);
  }
  return last;
}

/** Die ganze Folge enharmonisch so schreiben, dass sie am bequemsten liest (bei Gleichstand bleibt sie). */
export function folgeBequem(f: Folge): Folge {
  const kandidaten = [f, ...([1, -1] as const).map((r) => {
    const um = (t: Ton) => enharmonisch(t, r);
    let ok = true;
    const neu = folgeAbbilden(f, (a) => {
      const g = um(a.grund), b = a.bass ? um(a.bass) : null;
      if (!g || (a.bass && !b)) { ok = false; return a; }
      return akkordBauen(g, a.struktur, b);
    });
    return ok ? neu : null;
  }).filter((x): x is Folge => !!x)];
  let best = f, bestLast = folgenLast(folgeAkkorde(f));
  for (const k of kandidaten.slice(1)) {
    const l = folgenLast(folgeAkkorde(k));
    if (l < bestLast) { best = k; bestLast = l; }
  }
  return best;
}

/** Folge umrechnen (klingend ↔ notiert), in bequemster Schreibweise. */
export const folgeTransponieren = (f: Folge, s: Stimmung | Intervall, r: Richtung): Folge =>
  folgeBequem(folgeAbbilden(f, (a) => akkordTransponieren(a, s, r)));

/** Text rein, Text raus: "E A B7 E" klingend → "| F♯ | B | C♯7 | F♯ |" für die B-Klarinette. */
export function folgeTextTransponieren(text: string, s: Stimmung | Intervall, r: Richtung, opt: { ascii?: boolean; jeZeile?: number } = {}): { text: string; fehler: string[] } {
  const f = folgeTransponieren(folgeLesen(text), s, r);
  return { text: folgeText(f, opt), fehler: f.fehler };
}

// ════════════════════════════════════════════════════════════════════
// Klänge (MIDI) und ABC
// ════════════════════════════════════════════════════════════════════

/** Lage beim Vorspielen/Zeigen: tiefster Ton (Grundton bzw. Bass) in diesem Bereich (MIDI, im Tonraum des Akkords). */
export const LAGEN = {
  // Klarinette notiert: tiefster Ton E3–D♯4, ein 13er-Akkord endet spätestens bei C6.
  klarinette: { von: 52, bis: 63 },
  // Klavier: Grundton um das mittlere C herum, voll und nicht dumpf.
  klavier: { von: 48, bis: 59 },
  // Notenzeile: Violinschlüssel, wenig Hilfslinien.
  notenzeile: { von: 57, bis: 68 },
} as const;
export type Lage = keyof typeof LAGEN;

const tiefsterIn = (klasse: number, von: number) => von + mod(klasse - von, 12);

/** Akkordtöne als MIDI, eng geschichtet vom Grundton aufwärts; ein Slash-Bass liegt darunter. */
export function akkordMidi(a: Akkord, lage: Lage = 'klavier'): number[] {
  const { von } = LAGEN[lage];
  const unten = a.bass ? tiefsterIn(tonKlasse(a.bass), von) : null;
  let letzter = unten ?? tiefsterIn(tonKlasse(a.grund), von) - 1;
  const midi: number[] = unten !== null ? [unten] : [];
  for (const t of a.toene) {
    const k = tonKlasse(t.ton);
    const m = letzter + 1 + mod(k - (letzter + 1), 12);
    midi.push(m);
    letzter = m;
  }
  return midi;
}

/** Leitertöne als MIDI, aufwärts eine Oktave (mit dem Grundton oben). */
export function leiterMidi(l: Leiter, lage: Lage = 'klarinette'): number[] {
  const start = tiefsterIn(tonKlasse(l.grund), LAGEN[lage].von);
  return [...l.toene.map((t) => start + t.halbtoene), start + 12];
}

export interface KlangOptionen { bpm?: number; ab?: number; lage?: Lage }

/** Akkord zum Anhören: erst gebrochen (Achtel), dann zusammen. MIDI im Tonraum des Akkords —
 *  zum Vorspielen (`vorspielen` erwartet notiert) den notierten Akkord geben. */
export function akkordKlaenge(a: Akkord, { bpm = 100, ab = 0, lage = 'klavier' }: KlangOptionen = {}): Klang[] {
  const achtel = 30 / bpm;
  const m = akkordMidi(a, lage);
  const gebrochen = m.map((midi, i) => ({ beginn: ab + i * achtel, dauer: achtel * 0.95, midi }));
  const t = ab + m.length * achtel + achtel;
  return [...gebrochen, ...m.map((midi) => ({ beginn: t, dauer: 4 * achtel * 2, midi }))];
}

/** Leiter zum Anhören: auf- und abwärts in Achteln. */
export function leiterKlaenge(l: Leiter, { bpm = 100, ab = 0, lage = 'klarinette' }: KlangOptionen = {}): Klang[] {
  const achtel = 30 / bpm;
  const auf = leiterMidi(l, lage);
  const folge = [...auf, ...auf.slice(0, -1).reverse()];
  return folge.map((midi, i) => ({ beginn: ab + i * achtel, dauer: i === folge.length - 1 ? achtel * 3 : achtel * 0.95, midi }));
}

/** Akkord und danach seine erste (oder gewählte) Leiter. */
export function akkordUndLeiterKlaenge(a: Akkord, l: Leiter, opt: KlangOptionen = {}): Klang[] {
  const k = akkordKlaenge(a, opt);
  const ende = Math.max(...k.map((x) => x.beginn + x.dauer));
  return [...k, ...leiterKlaenge(l, { ...opt, ab: ende + 0.3 })];
}

// ABC mit ausgeschriebenen Vorzeichen (Tonart C), Vorzeichen gelten bis zum Taktstrich.
const ABC_VZ: Record<number, string> = { [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^' };
class AbcVorzeichen {
  private stand = new Map<string, number>();
  neuerTakt() { this.stand.clear(); }
  note(t: Ton, midi: number): string {
    const oktave = Math.floor((midi - t.vz) / 12) - 1;
    const b = STAMM_INTERNATIONAL[t.stamm];
    const k = `${b}${oktave}`;
    const vorher = this.stand.get(k) ?? 0;
    const zeichen = vorher === t.vz ? '' : ABC_VZ[t.vz];
    this.stand.set(k, t.vz);
    const name = oktave >= 5 ? b.toLowerCase() + "'".repeat(oktave - 5) : b + ','.repeat(Math.max(0, 4 - oktave));
    return zeichen + name;
  }
}

/** Geschriebene Töne zu MIDI (aufsteigend) — für die Notenzeile der Akkordtöne. */
function geschrieben(a: Akkord, lage: Lage): { ton: Ton; midi: number }[] {
  const m = akkordMidi(a, lage);
  const toene = [...(a.bass ? [a.bass] : []), ...a.toene.map((t) => t.ton)];
  return toene.map((ton, i) => ({ ton, midi: m[i] }));
}

/** ABC-Kopf einer kleinen Notenzeile ohne Taktart. */
const abcKopf = (titel?: string) => ['X:1', ...(titel ? [`T:${titel}`] : []), 'M:none', 'L:1/8', 'K:C clef=treble'];

/** Notenzeile für den Spickzettel: Takt 1 der Akkord als Klang (ganze Note, Symbol darüber),
 *  Takt 2 die Akkordtöne gebrochen (Viertel), danach (optional) die Leiter aufwärts. */
export function akkordAbc(a: Akkord, leiter?: Leiter | null, { lage = 'notenzeile' as Lage } = {}): string {
  const vz = new AbcVorzeichen();
  const toene = geschrieben(a, lage);
  const klang = `"${akkordText(a, { ascii: true })}"[${toene.map((t) => vz.note(t.ton, t.midi)).join('')}]8`;
  vz.neuerTakt();
  const gebrochen = toene.map((t) => `${vz.note(t.ton, t.midi)}2`).join(' ');
  const teile = [klang, gebrochen];
  if (leiter) {
    vz.neuerTakt();
    const start = toene.find((t) => gleicherTon(t.ton, a.grund))?.midi ?? tiefsterIn(tonKlasse(a.grund), LAGEN[lage].von);
    const l = [...leiter.toene.map((t) => ({ ton: t.ton, midi: start + t.halbtoene })), { ton: leiter.grund, midi: start + 12 }];
    teile.push(l.map((t) => vz.note(t.ton, t.midi)).join(''));
  }
  return `${abcKopf().join('\n')}\n${teile.join(' | ')} |]\n`;
}

/** Notenzeile einer Leiter allein (aufwärts, Achtel). */
export function leiterAbc(l: Leiter, { lage = 'notenzeile' as Lage } = {}): string {
  const vz = new AbcVorzeichen();
  const start = tiefsterIn(tonKlasse(l.grund), LAGEN[lage].von);
  const toene = [...l.toene.map((t) => ({ ton: t.ton, midi: start + t.halbtoene })), { ton: l.grund, midi: start + 12 }];
  return `${abcKopf().join('\n')}\n${toene.map((t) => vz.note(t.ton, t.midi)).join('')} |]\n`;
}
