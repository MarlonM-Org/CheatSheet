// Begleitung aus Akkorden (I-04, Wunsch Marlon 2026-11-19): Aus den Akkorden
// je Takt (Jam-Karte, Komponieren mit Akkordrahmen) entsteht eine kleine
// Band zum Mitspielen — Bass, Klavier-Akkorde und der Klick des Metronoms —
// im Stil des Stücks (Swing, Bossa, gerade Achtel, Ballade). Erzeugt wird
// nichts als Datei: es ist Vorspielen wie G-04 (Leitbild). Dazu die
// Hörbeispiele der Übe-Anleitung (Grundtöne, Guide Tones, Arpeggien) als
// Linie über denselben Akkorden. Rein, getestet.
//
// Zeiten in **Schlägen** ab Taktanfang (4/4: Viertel) — das Tempo rechnet
// erst der Spieler hinein, Takt für Takt; so gilt ein neues Tempo ab dem
// nächsten Takt, ohne dass etwas neu berechnet werden muss.
// Tonhöhen als MIDI im Tonraum der Akkorde: Wer notierte Akkorde gibt
// (Klarinette in B), spielt sie mit der Stimmung ab (wie `vorspielen`).

import { akkordLesen, akkordText, tonKlasse, type Akkord, type AkkordTon, type FolgenTakt } from './akkorde';
import type { Klang } from './notensatz';

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ── Stil ──

export type BegleitStil = 'swing' | 'bossa' | 'gerade' | 'ballade';
export const BEGLEIT_STILE: readonly BegleitStil[] = ['swing', 'bossa', 'gerade', 'ballade'];
export const STIL_NAMEN: Record<BegleitStil, string> = { swing: 'Swing', bossa: 'Bossa', gerade: 'Gerade', ballade: 'Ballade' };
export const istStil = (v: unknown): v is BegleitStil => BEGLEIT_STILE.includes(v as BegleitStil);

/** Stil aus dem Gefühl der Jam-Karte: „Bossa Nova“ → bossa, „Funk / gerade Achtel“ → gerade, „Ballad“ → ballade, sonst Swing (auch Shuffle). */
export function stilAusGefuehl(gefuehl: string | undefined): BegleitStil {
  const g = (gefuehl ?? '').toLowerCase();
  if (/bossa|samba|latin/.test(g)) return 'bossa';
  if (/funk|gerade|straight|rock|pop/.test(g)) return 'gerade';
  if (/ballad/.test(g)) return 'ballade';
  return 'swing';
}

/** Übliches Session-Tempo zum Gefühl (Viertel je Minute) — als Hinweis, geübt wird gern langsamer. */
export function tempoAusGefuehl(gefuehl: string | undefined): number {
  const g = (gefuehl ?? '').toLowerCase();
  if (/ballad/.test(g)) return 66;
  if (/langsam|slow/.test(g)) return 84;
  if (/up/.test(g)) return 170;
  if (/bossa/.test(g)) return 130;
  if (/funk|gerade/.test(g)) return 104;
  if (/shuffle/.test(g)) return 110;
  return 126;
}

// ── Akkorde im Takt ──

/** Ein Akkord im Takt: Beginn und Dauer in Schlägen. */
export interface Abschnitt { akkord: Akkord; ab: number; dauer: number }

/** Mehrere Akkorde teilen den Takt auf Schläge: zwei in 4/4 auf 1 und 3, drei auf 1, 2, 3, vier je Schlag. */
export function akkordLagen(n: number, schlaege: number): number[] {
  if (n <= 0) return [];
  const lagen = Array.from({ length: n }, (_, k) => Math.floor((k * schlaege) / n));
  // Mehr Akkorde als Schläge: die übrigen auf halbe Schläge (sollte selten sein).
  return lagen.map((l, k) => (k > 0 && l <= lagen[k - 1] ? lagen[k - 1] + 0.5 : l));
}

export function abschnitte(t: FolgenTakt, schlaege: number): Abschnitt[] {
  const lagen = akkordLagen(t.akkorde.length, schlaege);
  return t.akkorde.map((akkord, k) => ({ akkord, ab: lagen[k], dauer: (k + 1 < lagen.length ? lagen[k + 1] : schlaege) - lagen[k] }));
}

// ── Klang-Ereignisse ──

export type BegleitStimme = 'bass' | 'akkord' | 'melodie';
/** Ein Ton der Begleitung: `schlag` ab Taktanfang, `dauer` in Schlägen, `staerke` 0…1. */
export interface BegleitTon { schlag: number; dauer: number; midi: number; stimme: BegleitStimme; staerke: number }

// Tonklassen (Halbtöne über dem Grundton) der Akkordtöne nach Rolle.
const istQuinte = (t: AkkordTon) => /^[♭♯]?5$/.test(t.funktion);
const istOption = (t: AkkordTon) => Number(t.funktion.replace(/[^0-9]/g, '')) >= 9;
const OPTION_FOLGE = ['♯9', '♭13', '♭9', '13', '9', '♯11', '11'];

/** Die Töne eines Klavier-Griffs (Halbtöne über dem Grundton, ohne Oktave): ohne Grundton (den spielt der Bass),
 *  Guide Tones zuerst, dann Optionen, dann die Quinte — höchstens vier. Schlichte Sept- und Sextakkorde bekommen
 *  die None (Dominante dazu die 13), wie es Pianisten tun; Dreiklänge bleiben Dreiklänge mit Grundton. */
export function griffStufen(a: Akkord): number[] {
  const s = a.struktur;
  const ohneGrund = a.toene.filter((t) => t.halbtoene !== 0);
  const vierklang = s.septime !== null || s.sexte;
  if (!vierklang && !s.optionen.length) return [0, ...ohneGrund.map((t) => t.halbtoene)];
  const guide = ohneGrund.filter((t) => t.guide);
  const optionen = ohneGrund.filter(istOption).sort((x, y) => OPTION_FOLGE.indexOf(x.funktion) - OPTION_FOLGE.indexOf(y.funktion));
  const rest = ohneGrund.filter((t) => !t.guide && !istOption(t));
  const stufen = [...guide, ...optionen, ...rest.filter(istQuinte), ...rest.filter((t) => !istQuinte(t))].map((t) => t.halbtoene);
  if (!s.optionen.length && !s.alt) {
    // Farbe: None (2) vor die Quinte, die Dominante bekommt statt der Quinte die 13 (9).
    const farbe = a.art === 'dom7' ? [2, 9] : a.art === 'halbvermindert' || a.art === 'vermindert7' ? [] : [2];
    const ohneQuinte = a.art === 'dom7' ? stufen.filter((h) => h !== 7) : stufen;
    const g = ohneQuinte.filter((h) => guide.some((t) => t.halbtoene === h));
    const r = ohneQuinte.filter((h) => !g.includes(h));
    const neu = [...g, ...farbe, ...r];
    return [...new Set(neu)].slice(0, 4);
  }
  const ergebnis = [...new Set(stufen)].slice(0, 4);
  return ergebnis.length < 3 ? [0, ...ergebnis] : ergebnis;
}

// Griff-Lage: tiefster Ton zwischen E3 und D♯4 (rund ums mittlere C, voll und nicht dumpf).
const GRIFF_UNTEN = 52, GRIFF_OBEN = 64;

/** Den Griff eines Akkords legen: enge Lage, so nah wie möglich am vorigen Griff (Stimmführung), ohne vorigen
 *  um die Mitte (E4). */
export function griff(a: Akkord, vorher: readonly number[] | null = null): number[] {
  const grund = tonKlasse(a.grund);
  const klassen = [...new Set(griffStufen(a).map((h) => mod(grund + h, 12)))].sort((x, y) => x - y);
  let best: number[] = [], kosten = Infinity;
  for (let k = 0; k < klassen.length; k++) {
    // Umkehrung k: ab Klasse k aufwärts geschichtet.
    const reihe = [...klassen.slice(k), ...klassen.slice(0, k)];
    for (let unten = GRIFF_UNTEN; unten < GRIFF_OBEN; unten++) {
      if (mod(unten, 12) !== reihe[0]) continue;
      const midi = [unten];
      for (const c of reihe.slice(1)) { const l = midi[midi.length - 1]; midi.push(l + 1 + mod(c - l - 1, 12)); }
      const c = vorher && vorher.length
        ? midi.reduce((sum, m) => sum + Math.min(...vorher.map((v) => Math.abs(v - m))), 0) + Math.abs(midi[0] - vorher[0]) * 0.25
        : Math.abs(midi.reduce((x, y) => x + y, 0) / midi.length - 64);
      if (c < kosten - 1e-9) { kosten = c; best = midi; }
    }
  }
  return best;
}

// Bass: zwischen C2 und E3 — tief genug für den Bass, hoch genug für Handy-Lautsprecher.
const BASS_UNTEN = 36, BASS_OBEN = 52;

/** Die Tonklasse `klasse` so nah wie möglich an `bei`, in den Bereich gezogen. */
export function nahe(klasse: number, bei: number, unten = BASS_UNTEN, oben = BASS_OBEN): number {
  let m = bei + mod(klasse - bei + 6, 12) - 6;
  while (m < unten) m += 12;
  // Nur so weit hinunter, wie der Bereich reicht (ein Bereich unter einer Oktave pendelte sonst).
  while (m > oben && m - 12 >= unten) m -= 12;
  return m;
}

const halbton = (a: Akkord, re: RegExp, sonst: number) => a.toene.find((t) => re.test(t.funktion))?.halbtoene ?? sonst;
const bassGrund = (a: Akkord) => tonKlasse(a.bass ?? a.grund);

// ── Rhythmen je Stil ──

/** Swing-Achtel: das „und“ liegt bei 62 % des Schlags (zwischen gerade und triolisch, wie „Locker“ im Metronom). */
export const SWING_ANTEIL = 0.62;

interface Anschlag { schlag: number; dauer: number }
// Klavier-Rhythmus eines Takts mit einem Akkord, im Wechsel zweier Takte (A/B). Zwei und mehr Akkorde im Takt:
// je Akkord ein Anschlag auf seinem Beginn.
function komp(stil: BegleitStil, schlaege: number, b: boolean, s: number): Anschlag[] {
  if (stil === 'ballade') return [{ schlag: 0, dauer: schlaege - 0.1 }];
  if (stil === 'swing') {
    // Charleston (1 und 2-und), im zweiten Takt verschoben (2 und 3-und).
    if (schlaege < 4) return [{ schlag: 0, dauer: 0.9 }, ...(schlaege >= 3 ? [{ schlag: 1 + s, dauer: 0.4 }] : [])];
    return b ? [{ schlag: 1, dauer: 0.7 }, { schlag: 2 + s, dauer: 0.9 }] : [{ schlag: 0, dauer: 1.2 }, { schlag: 1 + s, dauer: 0.45 }];
  }
  // Bossa und gerade: synkopierte Achtel über zwei Takte.
  const lang = stil === 'bossa' ? 0.45 : 0.3;
  const muster = b ? [1, 2.5] : [0, 1.5, 3];
  return muster.filter((x) => x < schlaege).map((x) => ({ schlag: x, dauer: lang }));
}

// ── Begleitung bauen ──

export interface BegleitOptionen {
  /** Schläge je Takt (4/4: 4). */
  schlaege?: number;
  /** Läuft im Kreis: der letzte Takt führt zum ersten zurück; sonst endet die Form mit einem Schlussakkord. */
  schleife?: boolean;
  swing?: number;
}

/** Die Begleitung der ganzen Form: je Takt die Töne (Bass und Klavier), Zeiten ab Taktanfang in Schlägen. */
export function begleitungBauen(takte: readonly FolgenTakt[], stil: BegleitStil, { schlaege = 4, schleife = true, swing = SWING_ANTEIL }: BegleitOptionen = {}): BegleitTon[][] {
  const alle = takte.map((t) => abschnitte(t, schlaege));
  const erster = alle.find((x) => x.length)?.[0]?.akkord ?? null;
  let bass = 43; // G2: Startlage, der erste Grundton liegt nahe dabei
  let griffVorher: number[] | null = null;
  const s = stil === 'swing' || stil === 'ballade' ? swing : 0.5;
  return alle.map((abs, ti) => {
    const toene: BegleitTon[] = [];
    if (!abs.length) return toene;
    const letzter = ti === alle.length - 1;
    // Schluss: Grundton und Akkord ausgehalten.
    if (letzter && !schleife) {
      const a = abs[0].akkord;
      bass = nahe(bassGrund(a), bass);
      griffVorher = griff(a, griffVorher);
      toene.push({ schlag: 0, dauer: schlaege - 0.05, midi: bass, stimme: 'bass', staerke: 0.85 });
      for (const m of griffVorher) toene.push({ schlag: 0, dauer: schlaege - 0.05, midi: m, stimme: 'akkord', staerke: 0.5 });
      return toene;
    }
    // Klavier.
    const anschlaege = abs.length === 1
      ? komp(stil, schlaege, ti % 2 === 1, s)
      : abs.map((x) => ({ schlag: x.ab, dauer: Math.min(x.dauer, stil === 'ballade' ? x.dauer : 1) - 0.1 }));
    const griffe = new Map<Abschnitt, number[]>();
    for (const x of abs) { griffVorher = griff(x.akkord, griffVorher); griffe.set(x, griffVorher); }
    for (const an of anschlaege) {
      const x = [...abs].reverse().find((y) => y.ab <= an.schlag + 1e-9) ?? abs[0];
      const ende = Math.min(an.schlag + an.dauer, x.ab + x.dauer);
      for (const m of griffe.get(x)!) toene.push({ schlag: an.schlag, dauer: ende - an.schlag, midi: m, stimme: 'akkord', staerke: 0.5 });
    }
    // Bass.
    abs.forEach((x, k) => {
      const a = x.akkord;
      const naechster = k + 1 < abs.length ? abs[k + 1].akkord
        : ti + 1 < alle.length ? alle[ti + 1][0]?.akkord ?? null : schleife ? erster : null;
      const grund = nahe(bassGrund(a), bass);
      const terz = halbton(a, /^[♭♯]?3$|^[24]$/, 4), quinte = halbton(a, /^[♭♯]?5$/, 7);
      // Chromatisch von unten oder oben zum nächsten Grundton (in der Lage, die dem letzten Ton am nächsten liegt);
      // bleibt der Grundton derselbe: die Quinte darunter.
      const annaeherung = (von: number) => {
        if (!naechster || bassGrund(naechster) === bassGrund(a)) return nahe(mod(bassGrund(a) + quinte, 12), grund - 5);
        const ziel = nahe(bassGrund(naechster), von);
        const d = von > ziel ? 1 : -1;
        return ziel + d === von ? ziel - d : ziel + d;
      };
      const ton = (schlag: number, dauer: number, midi: number, staerke = 0.8) => { toene.push({ schlag: x.ab + schlag, dauer, midi, stimme: 'bass', staerke }); bass = midi; };
      if (stil === 'swing') {
        // Walking Bass: Viertel, 1 – Terz – Quinte – Annäherung (aufwärts; liegt der Grundton hoch, abwärts).
        if (x.dauer < 2) { ton(0, Math.max(0.45, x.dauer - 0.1), grund, 0.85); return; }
        const ab = grund > 45 && x.dauer >= 3 ? -1 : 1;
        const unter = a.toene.find((y) => /7$/.test(y.funktion) || y.funktion === '6')?.halbtoene ?? quinte;
        const t2 = ab > 0 ? grund + terz : grund - (12 - unter), t3 = ab > 0 ? grund + quinte : grund - (12 - quinte);
        const linie = x.dauer >= 4 ? [grund, t2, t3] : x.dauer >= 3 ? [grund, t3] : [grund];
        linie.forEach((m, i) => ton(i, 0.9, m, i === 0 ? 0.85 : 0.75));
        for (let i = linie.length; i < Math.floor(x.dauer); i++) ton(i, 0.9, annaeherung(linie[linie.length - 1]), 0.75);
      } else if (stil === 'ballade') {
        // Zwei-Gefühl: Grundton und Quinte in Halben.
        ton(0, Math.min(2, x.dauer) - 0.1, grund, 0.8);
        if (x.dauer >= 4) ton(2, 1.9, nahe(mod(bassGrund(a) + quinte, 12), grund - 2), 0.7);
      } else {
        // Bossa (1 – Quinte auf 2-und und 3) und gerade Achtel (1, 2-und, Quinte auf 3, Annäherung auf 4-und).
        const q = nahe(mod(bassGrund(a) + quinte, 12), grund - 5);
        if (stil === 'bossa') {
          ton(0, Math.min(1.5, x.dauer) - 0.05, grund, 0.85);
          if (x.dauer >= 2) ton(1.5, 0.45, q, 0.7);
          if (x.dauer >= 4) { ton(2, 1.45, q, 0.75); ton(3.5, 0.45, grund, 0.7); }
        } else {
          ton(0, Math.min(1, x.dauer) - 0.1, grund, 0.85);
          if (x.dauer >= 2) ton(1.5, 0.4, grund, 0.65);
          if (x.dauer >= 4) { ton(2, 0.9, q, 0.75); ton(3.5, 0.4, annaeherung(q), 0.7); }
        }
      }
    });
    return toene.sort((a, b) => a.schlag - b.schlag);
  });
}

// ── Klick ──

export interface BegleitKlick { schlag: number; betont: boolean }

/** Der Klick eines Takts (Klang des Metronoms): Swing und Ballade auf 2 und 4 (Hi-Hat), Bossa und gerade auf jedem Schlag. */
export function begleitKlicks(stil: BegleitStil, schlaege = 4): BegleitKlick[] {
  const zweiVier = (stil === 'swing' || stil === 'ballade') && schlaege >= 4 && schlaege % 2 === 0;
  return Array.from({ length: schlaege }, (_, i) => i).filter((i) => !zweiVier || i % 2 === 1).map((i) => ({ schlag: i, betont: false }));
}

/** Einzähler: ein Takt, jeder Schlag, die Eins betont. */
export const einzaehlKlicks = (schlaege = 4): BegleitKlick[] => Array.from({ length: schlaege }, (_, i) => ({ schlag: i, betont: i === 0 }));

// ── Hörbeispiele (Übe-Anleitung) ──

export type BeispielArt = 'grundtoene' | 'guidetones' | 'arpeggien';
export const BEISPIEL_NAMEN: Record<BeispielArt, string> = { grundtoene: 'Grundtöne', guidetones: 'Guide Tones', arpeggien: 'Arpeggien' };

// Lagen der Beispiel-Linien (MIDI im Tonraum der Akkorde; notiert für die Klarinette: A3 bis G5 bequem).
const LINIE = { grundtoene: { unten: 55, oben: 69, start: 60 }, guidetones: { unten: 59, oben: 74, start: 67 }, arpeggien: { unten: 55, oben: 66, start: 58 } } as const;

/** Eine Beispiel-Linie über der Form: je Takt die Töne. Grundtöne und Guide Tones (Terz/Septime, so nah wie möglich
 *  am vorigen — 7 → 3 → 7 durch die ii–V–I) klingen so lang wie ihr Akkord; Arpeggien gehen 1–3–5–7 in Vierteln. */
export function beispielLinie(takte: readonly FolgenTakt[], art: BeispielArt, schlaege = 4): BegleitTon[][] {
  const { unten, oben, start } = LINIE[art];
  let vorher: number = start;
  return takte.map((t) => abschnitte(t, schlaege).flatMap((x) => {
    const a = x.akkord, g = tonKlasse(a.grund);
    if (art === 'grundtoene') {
      vorher = nahe(g, vorher, unten, oben);
      return [{ schlag: x.ab, dauer: x.dauer, midi: vorher, stimme: 'melodie' as const, staerke: 0.9 }];
    }
    if (art === 'guidetones') {
      const kandidaten = a.toene.filter((y) => y.guide).map((y) => nahe(mod(g + y.halbtoene, 12), vorher, unten, oben));
      vorher = kandidaten.reduce((b, m) => (Math.abs(m - vorher) < Math.abs(b - vorher) || (Math.abs(m - vorher) === Math.abs(b - vorher) && m < b) ? m : b), kandidaten[0] ?? vorher);
      return [{ schlag: x.ab, dauer: x.dauer, midi: vorher, stimme: 'melodie' as const, staerke: 0.9 }];
    }
    // Arpeggien: Grundton nahe dem vorigen Grundton, dann aufwärts die Akkordtöne (mit Oktave, wenn nur drei).
    const grund = nahe(g, vorher, unten, oben);
    vorher = grund;
    const auf = a.toene.filter((y) => y.halbtoene !== 0 && !istOption(y)).map((y) => y.halbtoene).sort((p, q) => p - q);
    const reihe = [0, ...auf, ...(auf.length < 3 ? [12] : [])];
    const n = Math.max(1, Math.floor(x.dauer));
    return reihe.slice(0, n).map((h, i) => ({ schlag: x.ab + i, dauer: i === n - 1 ? x.dauer - i : 1, midi: grund + h, stimme: 'melodie' as const, staerke: 0.9 }));
  }));
}

// ── Akkordtext je Takt (Komponieren) ──

/** Akkordsymbole je Takt (ASCII) → Takte der Folge; Unlesbares fällt weg. */
export function akkordTakte(akkorde: readonly (readonly string[])[]): FolgenTakt[] {
  return akkorde.map((liste) => ({ akkorde: liste.map(akkordLesen).filter((a): a is Akkord => !!a) }));
}

/** Folge → Akkordsymbole je Takt (ASCII, liest sich zurück). */
export const folgeAlsSymbole = (takte: readonly FolgenTakt[]): string[][] => takte.map((t) => t.akkorde.map((a) => akkordText(a, { ascii: true })));

/** Takte der Begleitung als Klänge in Sekunden (fürs Vorspielen im Notenblatt): ab Takt `ab` (dort 0 s), bis vor
 *  Takt `bis`. Tempo je Schlag wie das Metronom. */
export function alsKlaenge(takte: readonly (readonly BegleitTon[])[], bpm: number, { schlaege = 4, ab = 0, bis = takte.length }: { schlaege?: number; ab?: number; bis?: number } = {}): Klang[] {
  const sek = 60 / Math.max(20, bpm);
  const liste: Klang[] = [];
  for (let i = Math.max(0, ab); i < Math.min(bis, takte.length); i++) {
    for (const t of takte[i]) liste.push({ beginn: ((i - ab) * schlaege + t.schlag) * sek, dauer: t.dauer * sek, midi: t.midi, stimme: t.stimme, staerke: t.staerke });
  }
  return liste.sort((x, y) => x.beginn - y.beginn);
}
