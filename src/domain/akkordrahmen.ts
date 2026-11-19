// Akkordrahmen (I-04 mit G-01, Wunsch Marlon 2026-11-19): Ein Stück der
// Jam-Karte wird zum leeren Notenblatt — Takte ohne Noten (nur Pausen),
// über jedem Takt sein Akkord, notiert für die Stimmung. Darin schreibt oder
// nimmt man auf (Aufnahmeleiste), die Begleitung aus den Akkorden spielt
// dazu. Dazu: die Akkorde bleiben bei ihrem Takt, wenn Takte eingefügt oder
// gelöscht werden, und die Hörbeispiele der Übe-Anleitung als Notenzeile.
// Rein, getestet.

import { akkordLesen, akkordText, akkordVersetzen, folgeBequem, tonKlasse, type Akkord, type FolgenTakt, type TonartAngabe } from './akkorde';
import { akkordLagen, stilAusGefuehl, type BegleitStil, type BegleitTon } from './begleitung';
import { jamLesen, jamNotiert, type JamStueck } from './jamkarte';
import { alsAbcStimmen, TONARTEN, zellenJeSchlag, zellenJeTakt, type Raster, type Stimme, type TaktAkkorde, type Takt, type Tonart } from './notation';
import { BLATT, legen } from './notensatz';
import { schlaegeJeTakt } from './takt';
import type { Stimmung } from './ueben';

/** Tonart der Akkord-Lehre → Tonart des Notenblatts (gibt es sie dort nicht, etwa Fis-Dur: keine). */
export const notationsTonart = (t: TonartAngabe | null | undefined): Tonart | null =>
  (t ? TONARTEN.find((x) => x.moll === t.moll && x.grund === tonKlasse(t.grund)) ?? null : null);

export interface Rahmen {
  titel: string;
  komponist?: string;
  /** Akkordsymbole je Takt (ASCII), notiert für die Stimmung. */
  akkorde: string[][];
  tonart: Tonart | null;
  begleitung: BegleitStil;
}

/** Die notierten Akkorde eines Jam-Stücks je Takt, über alle Teile. */
export function jamTakteNotiert(s: JamStueck, stimmung: Stimmung): FolgenTakt[] {
  return jamNotiert(jamLesen(s), stimmung).teile.flatMap((t) => t.folge.takte);
}

/** Ein Jam-Stück als Rahmen fürs Notenblatt (notiert für die Stimmung). */
export function jamRahmen(s: JamStueck, stimmung: Stimmung): Rahmen {
  const g = jamNotiert(jamLesen(s), stimmung);
  return {
    titel: s.titel,
    ...(s.komponist ? { komponist: s.komponist } : {}),
    akkorde: g.teile.flatMap((t) => t.folge.takte).map((t) => t.akkorde.map((a) => akkordText(a, { ascii: true }))),
    tonart: notationsTonart(g.tonart),
    begleitung: stilAusGefuehl(s.gefuehl),
  };
}

/** Leere Takte zum Rahmen (Blattraster): Pausen, geteilt an den Akkordwechseln — so steht jedes Symbol über seinem Schlag. */
export function rahmenTakte(akkorde: TaktAkkorde, blatt: Raster): Takt[] {
  const js = zellenJeSchlag(blatt), jt = zellenJeTakt(blatt);
  return akkorde.map((liste) => {
    const lagen = akkordLagen(Math.max(1, liste.length), schlaegeJeTakt(blatt.zaehler, blatt.nenner)).map((l) => Math.round(l * js));
    return legen(lagen.map((p, k) => ({ midi: null, dauer: (k + 1 < lagen.length ? lagen[k + 1] : jt) - p })), blatt);
  });
}

/** Nach einer Änderung im Blatt die Akkorde bei ihren Takten halten: Kamen Takte hinzu oder fielen weg (Takt +/−,
 *  Einfügen beim Aufnehmen), rücken die Akkorde dahinter mit; neue Takte haben keinen Akkord. Erkannt wird das an
 *  den Takten selbst — was gleich geblieben ist, ist dasselbe Objekt. */
export function akkordeNachfuehren(alt: readonly Stimme[], neu: readonly Stimme[], akkorde: TaktAkkorde): string[][] {
  const kopie = akkorde.map((x) => [...x]);
  const k = neu.findIndex((s, i) => !!alt[i] && s.takte.length !== alt[i].takte.length);
  if (k < 0 || !kopie.length) return kopie;
  const a = alt[k].takte, n = neu[k].takte;
  let p = 0;
  while (p < a.length && p < n.length && a[p] === n[p]) p++;
  let q = 0;
  while (q < a.length - p && q < n.length - p && a[a.length - 1 - q] === n[n.length - 1 - q]) q++;
  const altMitte = a.length - p - q, neuMitte = n.length - p - q;
  const mitte = Array.from({ length: neuMitte }, (_, i) => (i < altMitte ? [...(kopie[p + i] ?? [])] : []));
  const ergebnis = [...kopie.slice(0, p), ...mitte, ...kopie.slice(a.length - q)];
  // Ohne Akkord am Ende braucht es keine Einträge.
  while (ergebnis.length && !ergebnis[ergebnis.length - 1].length) ergebnis.pop();
  return ergebnis;
}

/** Akkorde eines Takts setzen (leer: keiner); die Liste wächst bei Bedarf. */
export function taktAkkordeSetzen(akkorde: TaktAkkorde, takt: number, symbole: readonly string[]): string[][] {
  const neu = akkorde.map((x) => [...x]);
  while (neu.length <= takt) neu.push([]);
  neu[takt] = [...symbole];
  while (neu.length && !neu[neu.length - 1].length) neu.pop();
  return neu;
}

// Stammton-Schritte je Halbton-Abstand (kleine Sekunde = 1 Schritt, Tritonus als übermäßige Quarte …).
const SCHRITTE = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/** Akkorde mit dem Blatt transponieren (Halbtöne), in der bequemsten Schreibweise der ganzen Folge; Unlesbares bleibt. */
export function akkordeVersetzen(akkorde: TaktAkkorde, halbtoene: number): string[][] {
  const h = ((halbtoene % 12) + 12) % 12;
  if (!h) return akkorde.map((x) => [...x]);
  const gelesen = akkorde.map((t) => t.map((s) => akkordLesen(s)));
  const folge = folgeBequem({ takte: gelesen.map((t) => ({ akkorde: t.filter((a): a is Akkord => !!a).map((a) => akkordVersetzen(a, { stufen: SCHRITTE[h], halbtoene: h })) })), fehler: [] });
  return gelesen.map((t, i) => {
    let k = 0;
    return t.map((a, j) => (a ? akkordText(folge.takte[i].akkorde[k++], { ascii: true }) : akkorde[i][j]));
  });
}

// ── Hörbeispiele als Notenzeile ──

/** Eine Linie (./begleitung `beispielLinie`) als Takte des Blatts; Lücken werden Pausen. */
export function linieAlsTakte(linie: readonly (readonly BegleitTon[])[], blatt: Raster): Takt[] {
  const js = zellenJeSchlag(blatt), jt = zellenJeTakt(blatt);
  return linie.map((toene) => {
    const strecken: { midi: number | null; dauer: number }[] = [];
    let pos = 0;
    for (const t of [...toene].sort((x, y) => x.schlag - y.schlag)) {
      const ab = Math.round(t.schlag * js), dauer = Math.min(Math.round(t.dauer * js), jt - ab);
      if (ab > pos) strecken.push({ midi: null, dauer: ab - pos });
      if (dauer > 0) strecken.push({ midi: t.midi, dauer });
      pos = ab + Math.max(0, dauer);
    }
    if (pos < jt) strecken.push({ midi: null, dauer: jt - pos });
    return legen(strecken, blatt);
  });
}

/** ABC der Beispiel-Linie mit den Akkorden darüber — ohne Titel und Tempo (nur zum Zeigen). */
export function beispielAbc(linie: readonly (readonly BegleitTon[])[], akkorde: TaktAkkorde, tonart: Tonart | null, schlaege = 4): string {
  const r: Raster = { bpm: 100, zaehler: schlaege, nenner: 4, feinheit: BLATT };
  const text = alsAbcStimmen([{ name: '', schluessel: 'violin', takte: linieAlsTakte(linie, r) }], r, { titel: '' }, tonart, akkorde);
  return text.split('\n').filter((z) => !/^[TQ]:/.test(z)).join('\n');
}
