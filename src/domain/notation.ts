// Einsingen und Einspielen (G-02/G-03): Aus einer Tonhöhenspur — vom
// Mikrofon oder aus einer Audio-Datei, je Rahmen ein notierter Ton oder
// Stille — werden Noten auf dem Taktraster, und aus den Noten wird ABC-Text,
// den abcjs zeichnet. Die Tonhöhen kommen von `grundfrequenz`/`frequenzZuTon`
// (./ueben), schon notiert fürs Instrument. Rein, getestet.
//
// Das Ergebnis ist immer ein Vorschlag: Die Erkennung ist nie fehlerfrei,
// korrigiert wird später im Editor (G-01). Hier steht die Rasterung an einer
// Stelle, damit sie ohne Oberfläche verbessert werden kann.

import type { Notation } from './bestand';
import { einheitenJeSchlag, istNenner, istZusammengesetzt, type Nenner } from './takt';
import { median } from './ueben';

// Ein Rahmen der Tonhöhenspur: `zeit` in Sekunden ab Schlag 1 von Takt 1
// (davor liegende Rahmen zählen nicht), `midi` der notierte Ton (C4 = 60,
// Nachkommastellen = Cent) oder null für Stille und Unklares, `pegel` die
// Lautstärke des Rahmens (Effektivwert 0…1; ohne Pegel keine
// Anschlag-Erkennung, dann trennen nur Lücken gleiche Töne).
export interface Tonrahmen { zeit: number; midi: number | null; pegel?: number }

// Effektivwert (RMS) eines Abtastfensters — der Pegel eines Rahmens.
export function effektivwert(puffer: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < puffer.length; i++) s += puffer[i] * puffer[i];
  return puffer.length ? Math.sqrt(s / puffer.length) : 0;
}

// ── Tonart ──
// Die Tonart zieht erkannte Töne auf die Leiter (gleicht Intonation aus, die
// um einen Halbton schwankt) und bestimmt Vorzeichen und Schreibweise im ABC.
// `kreuze`: Vorzeichen der Tonart, negativ = Bs.
export interface Tonart { abc: string; name: string; grund: number; moll: boolean; kreuze: number }
export const TONARTEN: readonly Tonart[] = [
  { abc: 'C', name: 'C-Dur', grund: 0, moll: false, kreuze: 0 },
  { abc: 'G', name: 'G-Dur', grund: 7, moll: false, kreuze: 1 },
  { abc: 'D', name: 'D-Dur', grund: 2, moll: false, kreuze: 2 },
  { abc: 'A', name: 'A-Dur', grund: 9, moll: false, kreuze: 3 },
  { abc: 'E', name: 'E-Dur', grund: 4, moll: false, kreuze: 4 },
  { abc: 'F', name: 'F-Dur', grund: 5, moll: false, kreuze: -1 },
  { abc: 'Bb', name: 'B-Dur', grund: 10, moll: false, kreuze: -2 },
  { abc: 'Eb', name: 'Es-Dur', grund: 3, moll: false, kreuze: -3 },
  { abc: 'Ab', name: 'As-Dur', grund: 8, moll: false, kreuze: -4 },
  { abc: 'Am', name: 'a-Moll', grund: 9, moll: true, kreuze: 0 },
  { abc: 'Em', name: 'e-Moll', grund: 4, moll: true, kreuze: 1 },
  { abc: 'Bm', name: 'h-Moll', grund: 11, moll: true, kreuze: 2 },
  { abc: 'Dm', name: 'd-Moll', grund: 2, moll: true, kreuze: -1 },
  { abc: 'Gm', name: 'g-Moll', grund: 7, moll: true, kreuze: -2 },
  { abc: 'Cm', name: 'c-Moll', grund: 0, moll: true, kreuze: -3 },
];
export const tonartFinden = (abc: string | null | undefined): Tonart | null => TONARTEN.find((t) => t.abc === abc) ?? null;

const DUR_STUFEN = [0, 2, 4, 5, 7, 9, 11], MOLL_STUFEN = [0, 2, 3, 5, 7, 8, 10];
// Tonklassen (0…11) der Leiter.
export function leiter(t: Tonart | null | undefined): Set<number> | null {
  if (!t) return null;
  return new Set((t.moll ? MOLL_STUFEN : DUR_STUFEN).map((s) => (t.grund + s) % 12));
}
// Gemessene Tonhöhe (mit Nachkommastellen) auf den nächsten Leiterton
// runden — ohne Tonart auf den nächsten Halbton.
export function aufLeiter(tonhoehe: number, t: Tonart | null | undefined): number {
  const l = leiter(t);
  if (!l) return Math.round(tonhoehe);
  let best = Math.round(tonhoehe), abstand = Infinity;
  for (let k = Math.floor(tonhoehe) - 1; k <= Math.floor(tonhoehe) + 2; k++) {
    if (!l.has(((k % 12) + 12) % 12)) continue;
    const d = Math.abs(k - tonhoehe);
    if (d < abstand) { abstand = d; best = k; }
  }
  return best;
}

// Das Raster: Tempo je Schlag (wie das Metronom), Taktart, und die Zelle —
// `feinheit` Zellen je ganzer Note. Beim Transkribieren ist das der kleinste
// Notenwert, auf den gerundet wird (Achtel oder Sechzehntel); das Notenblatt
// (./notensatz) rechnet feiner, mit 96 Zellen (32tel und Triolen).
export type Feinheit = 8 | 16;
export interface Raster { bpm: number; zaehler: number; nenner: Nenner; feinheit: number }
export const FEINHEITEN: { feinheit: Feinheit; name: string }[] = [{ feinheit: 8, name: 'Achtel' }, { feinheit: 16, name: 'Sechzehntel' }];

// Eine Note (oder Pause: midi null) mit Dauer in Zellen (1/feinheit).
// `bindung`: geht in die nächste Note über (Haltebogen, gleiche Tonhöhe).
// `triole`: Teil einer Triole — geschrieben wird sie anderthalbfach so lang,
// wie sie klingt; `gruppe` steht an der ersten Note der Triole und zählt
// ihre Noten (ABC: `(3:2:gruppe`).
// `bogenAuf`/`bogenZu`: Bindebogen (Phrasierung, ABC `(` … `)`) beginnt bzw.
// endet an dieser Note — anders als `bindung` (Haltebogen: dieselbe Höhe,
// die Dauern addieren sich).
export interface Note { midi: number | null; dauer: number; bindung?: true; triole?: true; gruppe?: number; bogenAuf?: true; bogenZu?: true }
export interface Takt { noten: Note[] }
// Eine Stimme des Blatts (G-01, mehrstimmig): Name, Schlüssel, ihre Takte.
// Alle Stimmen eines Stücks haben gleich viele Takte.
export type Schluessel = 'violin' | 'bass' | 'alt' | 'tenor';
export const SCHLUESSEL: { art: Schluessel; name: string; zeichen: string }[] = [
  { art: 'violin', name: 'Violinschlüssel', zeichen: '𝄞' }, { art: 'bass', name: 'Bassschlüssel', zeichen: '𝄢' },
  { art: 'alt', name: 'Altschlüssel (Bratsche)', zeichen: '𝄡' }, { art: 'tenor', name: 'Tenorschlüssel', zeichen: '𝄡' },
];
const ABC_CLEF: Record<Schluessel, string> = { violin: 'treble', bass: 'bass', alt: 'alto', tenor: 'tenor' };
const CLEF_ABC: Record<string, Schluessel> = { treble: 'violin', bass: 'bass', alto: 'alt', tenor: 'tenor' };
export interface Stimme { name: string; schluessel: Schluessel; takte: Takt[] }

// Zellen je Takt: 4/4 in Sechzehnteln = 16, 6/8 in Sechzehnteln = 12, 3/4 in Achteln = 6.
export const zellenJeTakt = (r: Raster) => (r.zaehler * r.feinheit) / r.nenner;
// Zellen je Schlag: der Schlag ist einheitenJeSchlag Einheiten (1/nenner) lang.
export const zellenJeSchlag = (r: Raster) => (einheitenJeSchlag(r.zaehler, r.nenner) * r.feinheit) / r.nenner;
// Dauer einer Zelle in Sekunden: der Schlag (60 / bpm) geteilt in seine Zellen.
export const zellenDauer = (r: Raster) => 60 / r.bpm / zellenJeSchlag(r);
export const taktDauer = (r: Raster) => zellenDauer(r) * zellenJeTakt(r);

// Median der klaren Tonhöhen in einem Fenster von `breite` Rahmen um jeden
// Rahmen — tilgt einzelne Ausreißer (Oktavsprung der Erkennung für einen
// Rahmen, Knackser), bevor die Hysterese sie als Tonwechsel liest.
export function medianGlaetten(rahmen: readonly Tonrahmen[], breite = 5): Tonrahmen[] {
  const h = Math.floor(breite / 2);
  return rahmen.map((f, i) => {
    if (f.midi === null) return { ...f };
    const w: number[] = [];
    for (let k = Math.max(0, i - h); k <= Math.min(rahmen.length - 1, i + h); k++) {
      const m = rahmen[k].midi;
      if (m !== null) w.push(m);
    }
    return { ...f, midi: median(w) };
  });
}

// Hysterese: Ein Ton läuft weiter, solange die Tonhöhe weniger als `sprung`
// Halbtöne vom Median des bisherigen Tons abweicht — Vibrato um die
// Halbtongrenze zerhackt so keine gehaltenen Töne, und weil der Median der
// ganzen Strecke zählt (nicht der letzten Rahmen), wandert er bei einem
// Gleiten (Portamento) nicht mit. Eine Abweichung zählt erst, wenn der
// Median der nächsten `bestaetigen` klaren Rahmen abweicht (ein Rahmen
// Vibrato-Spitze oder Ausreißer gehört noch zum Ton). Jeder Rahmen bekommt
// den Median seines Tons. Kurze Aussetzer der Erkennung bis `aussetzer`
// Sekunden werden überbrückt, wenn danach derselbe Ton weitergeht — beurteilt
// erst `ansatz` Sekunden nach der Lücke, weil die Stimme in den neuen Ton
// einschleift und die ersten Rahmen noch beim alten liegen.
export function hysterese(rahmen: readonly Tonrahmen[], sprung = 0.75, aussetzer = 0.15, bestaetigen = 3, ansatz = 0.06): Tonrahmen[] {
  const e = medianGlaetten(rahmen);
  const roh = e.map((f) => f.midi);
  let glieder: number[] = [], toene: number[] = [], mitte = 0;
  let lueckeAb = -1; // Index des ersten unklaren Rahmens der laufenden Lücke
  const abschliessen = () => { for (const i of glieder) e[i].midi = mitte; glieder = []; toene = []; lueckeAb = -1; };
  // Weicht der Median der nächsten `bestaetigen` klaren Rahmen ab i (ohne die
  // ersten `ueberspringen` Sekunden) um mindestens `sprung` von `mitte` ab?
  // Nur die zusammenhängende Stimme ab i zählt: endet sie vorher (nächster
  // Aussetzer, nächster Konsonant), entscheiden die Rahmen bis dahin — sonst
  // würde der Blick nach vorn in die nächste Note reichen.
  const dauerhaft = (i: number, ueberspringen: number) => {
    const spaet: number[] = [], alle: number[] = [];
    for (let k = i; k < roh.length && spaet.length < bestaetigen; k++) {
      const m = roh[k];
      if (m === null) break;
      alle.push(m);
      if (rahmen[k].zeit - rahmen[i].zeit >= ueberspringen) spaet.push(m);
    }
    const w = spaet.length ? spaet : alle;
    return w.length > 0 && Math.abs(median(w) - mitte) >= sprung;
  };
  for (let i = 0; i < e.length; i++) {
    const m = roh[i];
    if (m === null) {
      if (glieder.length && lueckeAb < 0) lueckeAb = i;
      continue;
    }
    if (glieder.length && lueckeAb >= 0) {
      // Lücke zu Ende: kurz genug und derselbe Ton danach → durchziehen, sonst neue Note.
      if (rahmen[i].zeit - rahmen[lueckeAb].zeit <= aussetzer && !dauerhaft(i, ansatz)) {
        for (let k = lueckeAb; k < i; k++) glieder.push(k);
        lueckeAb = -1;
        glieder.push(i); toene.push(m); mitte = median(toene);
        continue;
      }
      abschliessen();
    } else if (glieder.length && (Math.abs(m - mitte) < sprung || !dauerhaft(i, 0))) {
      glieder.push(i); toene.push(m); mitte = median(toene);
      continue;
    } else if (glieder.length) {
      abschliessen();
    }
    glieder.push(i); toene.push(m); mitte = m;
  }
  if (glieder.length) abschliessen();
  return e;
}

// Anschläge aus dem Pegel: Zeitpunkte, an denen die Lautstärke innerhalb von
// `fenster` Sekunden um mindestens `anschlag` dB steigt (Konsonant, neu
// angesetzte Silbe, Klavieranschlag) — je Anstieg der Rahmen mit dem
// stärksten Sprung, höchstens einer je `abstand` Sekunden. Rahmen ohne Pegel
// liefern nichts.
export function anschlaege(rahmen: readonly Tonrahmen[], anschlag = 6, fenster = 0.05, abstand = 0.09): number[] {
  const mit = rahmen.filter((f) => f.pegel !== undefined);
  if (mit.length < 3) return [];
  const db = mit.map((f) => 20 * Math.log10((f.pegel ?? 0) + 1e-5));
  // Anstieg je Rahmen: gegenüber dem leisesten Rahmen der letzten `fenster` Sekunden.
  const anstieg = db.map((d, i) => {
    let tiefst = d;
    for (let k = i - 1; k >= 0 && mit[i].zeit - mit[k].zeit <= fenster; k--) tiefst = Math.min(tiefst, db[k]);
    return d - tiefst;
  });
  const e: number[] = [];
  let i = 0;
  while (i < anstieg.length) {
    if (anstieg[i] < anschlag) { i++; continue; }
    // Innerhalb des Anstiegs den stärksten Sprung nehmen.
    let best = i, j = i;
    while (j < anstieg.length && anstieg[j] >= anschlag) { if (anstieg[j] > anstieg[best]) best = j; j++; }
    const t = mit[best].zeit;
    if (!e.length || t - e[e.length - 1] >= abstand) e.push(t);
    i = j;
  }
  return e;
}

// Verschiebung aller Einsätze gegen das Achtelraster (Aufnahmelatenz, und
// die Tonerkennung rastet erst nach dem Konsonanten ein): zirkulärer
// Mittelwert der Phasen aller Tonwechsel, als Verspätung in [0, Achtel).
// Nur, wenn die Einsätze einheitlich liegen (Konsistenz ≥ `mindest`) —
// sonst wäre es Synkopik, keine Latenz. Die Spur wird um den Wert
// vorgezogen (`zeit - versatz`).
export function versatzSchaetzen(rahmen: readonly Tonrahmen[], r: Raster, mindest = 0.4): number {
  const achtel = (60 / r.bpm) / (einheitenJeSchlag(r.zaehler, r.nenner) === 3 ? 3 : 2);
  const glatt = hysterese(rahmen);
  const wechsel: number[] = [];
  let vorher: number | null = null;
  for (const f of glatt) {
    if (f.midi !== null && f.midi !== vorher && f.zeit >= 0) wechsel.push(f.zeit);
    vorher = f.midi;
  }
  if (wechsel.length < 4) return 0;
  let x = 0, y = 0;
  for (const t of wechsel) { const w = ((t % achtel) / achtel) * 2 * Math.PI; x += Math.cos(w); y += Math.sin(w); }
  x /= wechsel.length; y /= wechsel.length;
  if (Math.hypot(x, y) < mindest) return 0;
  const winkel = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  const versatz = (winkel / (2 * Math.PI)) * achtel;
  return versatz < 0.015 ? 0 : versatz;
}

// Erlaubte Notenwerte in Zellen, absteigend: die ganze Note und ihre
// Halbierungen, solange sie ganze Zellen bleiben (16: bis zur Zelle; 96:
// bis zum 32tel = 3 Zellen), dazu die punktierten Formen, höchstens ein
// Takt lang. Pausen bleiben ohne Punktierung (eine punktierte halbe Pause
// liest niemand gern).
export function notenwerte(r: Raster, punktiert = true): number[] {
  const max = zellenJeTakt(r);
  const werte = new Set<number>();
  for (let v = r.feinheit; v >= 1 && Number.isInteger(v); v /= 2) {
    if (v <= max) werte.add(v);
    if (punktiert && Number.isInteger(v * 1.5) && v * 1.5 <= max && v / 2 >= 1) werte.add(v * 1.5);
  }
  return [...werte].sort((a, b) => b - a);
}

// Gruppe: In geraden Taktarten mit mehr als zwei Schlägen (4/4, 4/2) die
// Takthälfte — ein Wert darf sie nicht verdecken; sonst der Schlag.
export const zellenJeGruppe = (r: Raster) => (r.zaehler > 2 && r.zaehler % 2 === 0 && !istZusammengesetzt(r.zaehler, r.nenner) ? zellenJeTakt(r) / 2 : zellenJeSchlag(r));

// Eine Strecke gleicher Tonhöhe in erlaubte Werte zerlegen: zwischen den
// Schlägen erst bis zur nächsten Schlaggrenze, auf dem Schlag bis zur
// nächsten Gruppengrenze (Takthälfte), auf der Gruppengrenze der größte Wert,
// der hineinpasst — so bleiben Schläge und Takthälfte lesbar. `ab` ist die
// Lage im Takt (Zellen).
export function zerlegen(ab: number, dauer: number, r: Raster, punktiert = true): number[] {
  const werte = notenwerte(r, punktiert);
  const js = zellenJeSchlag(r), jg = zellenJeGruppe(r);
  const teile: number[] = [];
  let pos = ab, rest = dauer;
  while (rest > 0) {
    const grenze = pos % js !== 0 ? Math.min(rest, js - (pos % js)) : pos % jg !== 0 ? Math.min(rest, jg - (pos % jg)) : rest;
    const wert = werte.find((w) => w <= grenze) ?? 1;
    teile.push(wert);
    pos += wert; rest -= wert;
  }
  return teile;
}

// ── Segmentierung in Sekunden ──
// Erst werden aus der Spur Töne in Sekunden (Tonstücke), dann erst Zellen.
// Die Regeln folgen dem, was pYIN/Tony, Basic Pitch, Omnizart und Klangios
// Gesangscode gemeinsam haben (reports/Gesang zu Noten transkribieren.md):
// Mindestdauer 100 ms, gleiche Töne über Lücken bis 130 ms verbinden,
// Anschläge nur zum Trennen gleicher Töne, Tonhöhe als Median ohne den
// Ansatz. Ein Tonstück endet, wo die Stimme aufhört oder der Ton wechselt.
export interface Tonstueck { start: number; ende: number; midi: number }
export interface SegmentOptionen {
  tonart?: Tonart | null;
  mindest?: number;   // s: kürzere Stücke fallen weg (pYIN prunethresh 0,1)
  luecke?: number;    // s: gleiche Töne über kürzere Lücken ohne Anschlag verbinden
  anschlag?: number;  // dB: Pegelanstieg, der einen Neuansatz anzeigt (0 = keine Anschläge)
  ansatz?: number;    // s: Anfang eines Stücks, der beim Tonhöhen-Median nicht zählt
  kurz?: number;      // s: „kurz" für die Nachbesserung (Oktavfehler, angeschliffener Ansatz)
}

// Mittlerer Abstand zweier Rahmen in Sekunden.
function rahmenAbstand(rahmen: readonly Tonrahmen[]): number {
  const d: number[] = [];
  for (let i = 1; i < rahmen.length; i++) d.push(rahmen[i].zeit - rahmen[i - 1].zeit);
  return d.length ? median(d) : 0.02;
}

export function segmentieren(rahmen: readonly Tonrahmen[], o: SegmentOptionen = {}): Tonstueck[] {
  const mindest = o.mindest ?? 0.1, luecke = o.luecke ?? 0.13, ansatz = o.ansatz ?? 0.06;
  const ab = rahmen.filter((f) => f.zeit >= 0);
  if (!ab.length) return [];
  const dt = rahmenAbstand(ab);
  const glatt = hysterese(ab);
  const schlaege = o.anschlag === 0 ? [] : anschlaege(ab, o.anschlag ?? 6);

  // Läufe gleicher Hysterese-Tonhöhe → Rahmenbereiche [i, j).
  const bereiche: [number, number][] = [];
  for (let i = 0; i < glatt.length;) {
    if (glatt[i].midi === null) { i++; continue; }
    let j = i;
    while (j < glatt.length && glatt[j].midi === glatt[i].midi) j++;
    bereiche.push([i, j]);
    i = j;
  }
  // An Anschlägen im Inneren teilen (gleicher Ton, neu angesetzt). Endet kurz
  // vor dem Anschlag eine überbrückte Lücke (Konsonant), beginnt die neue Note
  // dort, wo die Stimme wieder einsetzt — nicht erst, wo der Pegel oben ist.
  const geteilt: [number, number][] = [];
  for (const [i, j] of bereiche) {
    const start = ab[i].zeit, ende = ab[j - 1].zeit + dt;
    const grenzen = [i];
    for (const t of schlaege) {
      if (t < start + mindest || t > ende - mindest) continue;
      let k = grenzen[grenzen.length - 1];
      while (k < j && ab[k].zeit < t) k++;
      let g = k;
      while (g > i && ab[g - 1].midi !== null && t - ab[g - 1].zeit <= 0.08) g--;   // zurück bis zum Beginn der Stimme
      if (g === k || ab[g - 1]?.midi !== null) g = k;                                  // keine Lücke davor: am Anschlag
      if (g < j && ab[g].zeit - ab[grenzen[grenzen.length - 1]].zeit >= mindest) grenzen.push(g);
    }
    grenzen.push(j);
    for (let g = 0; g + 1 < grenzen.length; g++) geteilt.push([grenzen[g], grenzen[g + 1]]);
  }
  // Tonhöhe je Stück: Median der klaren Rahmen ohne den Ansatz.
  const leiter = o.tonart ?? null;
  const stuecke: Tonstueck[] = [];
  for (const [i, j] of geteilt) {
    const start = ab[i].zeit, ende = ab[j - 1].zeit + dt;
    const von = ende - start > 2 * ansatz ? start + ansatz : start;
    const w: number[] = [];
    for (let k = i; k < j; k++) { const m = ab[k].midi; if (m !== null && ab[k].zeit >= von) w.push(m); }
    if (!w.length) for (let k = i; k < j; k++) { const m = ab[k].midi; if (m !== null) w.push(m); }
    if (!w.length) continue;
    stuecke.push({ start, ende, midi: aufLeiter(median(w), leiter) });
  }
  // Oktavfehler und angeschliffene Ansätze zuerst (ein Ansatz von 60 ms ist
  // kürzer als die Mindestdauer, gehört aber zur Note), dann gleiche Töne über
  // kurze Lücken verbinden, wenn kein Anschlag dazwischen liegt (der Konsonant
  // beginnt bis 100 ms vor der Stimmpause, der Pegel ist erst bis 80 ms nach
  // dem Stimmeinsatz oben), zuletzt die Mindestdauer.
  const verbunden: Tonstueck[] = [];
  for (const s of nachbessern(stuecke, o.kurz ?? 0.15)) {
    const v = verbunden[verbunden.length - 1];
    if (v && v.midi === s.midi && s.start - v.ende < luecke && !schlaege.some((t) => t >= v.ende - 0.1 && t <= s.start + 0.08)) {
      v.ende = s.ende;
      continue;
    }
    verbunden.push({ ...s });
  }
  return verbunden.filter((s) => s.ende - s.start >= mindest);
}

// Typische Gesangsartefakte: Ein kurzes Stück, das zu beiden Nachbarn etwa
// eine Oktave springt, ist ein Oktavfehler der Erkennung und rückt in deren
// Lage (gleicht es dann dem Vorgänger, geht es in ihm auf). Ein kurzes Stück
// unmittelbar vor einem längeren, höchstens zwei Halbtöne entfernt, ist ein
// angeschliffener Ansatz und geht in ihn auf.
export function nachbessern(stuecke: readonly Tonstueck[], kurz: number): Tonstueck[] {
  const e = stuecke.map((s) => ({ ...s }));
  for (let i = 0; i < e.length; i++) {
    if (e[i].ende - e[i].start > kurz) continue;
    if (i === 0 || i + 1 >= e.length) continue;   // am Rand fehlt ein Nachbar
    const nachbarn = [e[i - 1].midi, e[i + 1].midi];
    if (nachbarn.every((n) => Math.abs(n - e[i].midi) >= 10 && Math.abs(n - e[i].midi) <= 14)) {
      e[i].midi += nachbarn[0] > e[i].midi ? 12 : -12;
      // Gleicht es nun dem Vorgänger, war es dessen Fortsetzung.
      if (i > 0 && e[i - 1].midi === e[i].midi && e[i].start - e[i - 1].ende < kurz) { e[i - 1].ende = e[i].ende; e.splice(i, 1); i--; }
    }
  }
  const ergebnis: Tonstueck[] = [];
  for (let i = 0; i < e.length; i++) {
    const s = e[i], f = e[i + 1];
    if (f && s.ende - s.start <= kurz && f.start - s.ende < kurz && Math.abs(f.midi - s.midi) <= 2 && f.ende - f.start > s.ende - s.start) {
      ergebnis.push({ start: s.start, ende: f.ende, midi: f.midi });
      i++;
      continue;
    }
    ergebnis.push(s);
  }
  return ergebnis;
}

// ── Rasterung ──

// Metrische Ebene einer Zelle: 0 Schlag, 1 Schlaghälfte (bzw. -drittel im
// zusammengesetzten Takt), 2 feiner.
function ebene(zelle: number, r: Raster): number {
  const js = zellenJeSchlag(r);
  if (zelle % js === 0) return 0;
  const teile = istZusammengesetzt(r.zaehler, r.nenner) ? 3 : 2;
  return Number.isInteger(js / teile) && zelle % (js / teile) === 0 ? 1 : 2;
}

// Alle Einsätze gemeinsam auf Zellen runden (dynamische Programmierung).
// Kandidaten je Einsatz: die Zelle davor und danach. Kosten: Abweichung in
// Zellen plus `strafe`, wenn die Zelle metrisch feiner liegt, als der
// Abstand zur Nachbarnote nahelegt (MuseScore-Import: eine Note von
// Viertellänge gehört selten auf ein Sechzehntel-Offbeat). Zwei Einsätze
// teilen sich nie eine Zelle.
export function einsaetzeRastern(starts: readonly number[], r: Raster, strafe = 0.35): number[] {
  if (!starts.length) return [];
  const dz = zellenDauer(r), js = zellenJeSchlag(r);
  const kandidaten = starts.map((s, i) => {
    const x = s / dz;
    const ioi = i + 1 < starts.length ? starts[i + 1] - s : i ? s - starts[i - 1] : dz * js;
    const ioiZ = ioi / dz;
    const ebeneLaenge = ioiZ >= 0.75 * js ? 0 : ioiZ >= 0.375 * js ? 1 : 2;
    return [...new Set([Math.max(0, Math.floor(x)), Math.max(0, Math.ceil(x))])].map((z) => ({ z, kosten: Math.abs(x - z) + strafe * Math.max(0, ebene(z, r) - ebeneLaenge) }));
  });
  const beste: { kosten: number; vor: number }[][] = [];
  kandidaten.forEach((k, i) => {
    beste.push(k.map(({ z, kosten }) => {
      if (i === 0) return { kosten, vor: -1 };
      let b = { kosten: Infinity, vor: -1 };
      kandidaten[i - 1].forEach((v, j) => {
        const g = beste[i - 1][j].kosten + kosten;
        if (v.z < z && g < b.kosten) b = { kosten: g, vor: j };
      });
      return b;
    }));
  });
  const letzte = beste[beste.length - 1];
  let j = letzte.reduce((bj, b, idx) => (b.kosten < letzte[bj].kosten ? idx : bj), 0);
  if (!Number.isFinite(letzte[j].kosten)) {
    // Ausweg: nacheinander runden, Kollisionen nach hinten schieben.
    let vorige = -1;
    return starts.map((s) => { vorige = Math.max(Math.round(s / dz), vorige + 1); return vorige; });
  }
  const zellen: number[] = [];
  for (let i = kandidaten.length - 1; i >= 0; i--) { zellen.push(kandidaten[i][j].z); j = beste[i][j].vor; }
  return zellen.reverse();
}

export interface RasterOptionen { tonart?: Tonart | null }

// Spur → Takte. Erst Tonstücke in Sekunden (`segmentieren`), dann die
// Legato-Regel: Nur die Einsätze werden gerundet; jede Note dauert bis zum
// nächsten Einsatz, und eine Pause entsteht nur, wenn die Stille davor
// mindestens eine Schlaghälfte (und 150 ms) lang ist — so machen es der
// MuseScore-Import (preserveLegato) und Klangios Gesangscode (Offset =
// nächster Onset), und so zerfällt kein gehaltener Ton in Sechzehntel und
// Pausen. Die letzte Note endet an ihrem gerundeten Ende. Dann an
// Taktgrenzen geteilt und gebunden, in erlaubte Werte zerlegt; Pausen am Ende
// fallen weg, der letzte Takt wird mit Pausen gefüllt. Ohne Ton: keine Takte.
export function rastern(rahmen: readonly Tonrahmen[], r: Raster, optionen: RasterOptionen = {}): Takt[] {
  const dz = zellenDauer(r), js = zellenJeSchlag(r);
  const stuecke = segmentieren(rahmen, { tonart: optionen.tonart ?? null, kurz: 1.1 * dz });
  if (!stuecke.length) return [];
  const starts = einsaetzeRastern(stuecke.map((s) => s.start), r);
  const pause = Math.max(0.15, (dz * js) / 2);
  const noten = stuecke.map((s, i) => {
    const z = starts[i];
    let e = Math.max(z + 1, Math.round(s.ende / dz));
    if (i + 1 < stuecke.length) {
      const naechste = starts[i + 1];
      e = stuecke[i + 1].start - s.ende >= pause ? Math.max(z + 1, Math.min(e, naechste)) : naechste;
    }
    return { ab: z, dauer: e - z, midi: s.midi };
  });
  const jt = zellenJeTakt(r);
  const letzte = Math.max(...noten.map((n) => n.ab + n.dauer));
  const z: (number | null)[] = Array<number | null>(Math.ceil(letzte / jt) * jt).fill(null);
  const neu = new Set<number>();
  for (const n of noten) { for (let k = n.ab; k < n.ab + n.dauer; k++) z[k] = n.midi; neu.add(n.ab); }

  // Strecken gleicher Tonhöhe über die ganze Spur.
  const strecken: { midi: number | null; ab: number; dauer: number }[] = [];
  for (let i = 0; i < z.length; i++) {
    const s = strecken[strecken.length - 1];
    if (s && s.midi === z[i] && !(z[i] !== null && neu.has(i))) s.dauer++; else strecken.push({ midi: z[i], ab: i, dauer: 1 });
  }

  const takte: Takt[] = Array.from({ length: z.length / jt }, () => ({ noten: [] }));
  for (const s of strecken) {
    let ab = s.ab, rest = s.dauer;
    while (rest > 0) {
      const takt = Math.floor(ab / jt), imTakt = ab % jt;
      const hier = Math.min(rest, jt - imTakt);
      const teile = zerlegen(imTakt, hier, r, s.midi !== null);
      teile.forEach((dauer, i) => {
        const letzter = i === teile.length - 1 && hier === rest;
        takte[takt].noten.push(s.midi !== null && !letzter ? { midi: s.midi, dauer, bindung: true } : { midi: s.midi, dauer });
      });
      ab += hier; rest -= hier;
    }
  }
  return takte;
}

// ── ABC ──

const ABC_NAMEN = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];

// Tonhöhe als ABC: C4 (60) = C, C5 = c, C6 = c', C3 = C, — Vorzeichen als Kreuz.
export function abcTon(midi: number): string {
  const oktave = Math.floor(midi / 12) - 1;
  const name = ABC_NAMEN[((midi % 12) + 12) % 12];
  if (oktave >= 5) return name.toLowerCase() + "'".repeat(oktave - 5);
  return name + ','.repeat(Math.max(0, 4 - oktave));
}

export interface AbcKopf { titel: string; komponist?: string }

// Schreibweise mit Vorzeichen wie in der Notation: Die Tonart setzt die
// Vorzeichen des Takts, ein gesetztes Vorzeichen gilt bis zum Taktstrich für
// diesen Ton (in dieser Oktave). Geschrieben wird nur, was von diesem Stand
// abweicht — in Kreuz-Tonarten mit Kreuzen, in B-Tonarten mit Bs. (Ohne
// das gälte in ABC ein `^C` für jedes weitere C im Takt.)
const KREUZ_REIHE = ['F', 'C', 'G', 'D', 'A', 'E', 'B'], B_REIHE = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const KREUZ_NAMEN: [string, string][] = [['C', ''], ['C', '^'], ['D', ''], ['D', '^'], ['E', ''], ['F', ''], ['F', '^'], ['G', ''], ['G', '^'], ['A', ''], ['A', '^'], ['B', '']];
const B_NAMEN: [string, string][] = [['C', ''], ['D', '_'], ['D', ''], ['E', '_'], ['E', ''], ['F', ''], ['G', '_'], ['G', ''], ['A', '_'], ['A', ''], ['B', '_'], ['B', '']];
function vorzeichenDerTonart(t: Tonart | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!t) return m;
  if (t.kreuze > 0) KREUZ_REIHE.slice(0, t.kreuze).forEach((b) => m.set(b, '^'));
  if (t.kreuze < 0) B_REIHE.slice(0, -t.kreuze).forEach((b) => m.set(b, '_'));
  return m;
}
class Vorzeichenstand {
  private stand = new Map<string, string>();
  private readonly tonartVz: Map<string, string>;
  constructor(private tonart: Tonart | null | undefined) { this.tonartVz = vorzeichenDerTonart(tonart); }
  neuerTakt() { this.stand.clear(); }
  schreiben(midi: number): string {
    const oktave = Math.floor(midi / 12) - 1;
    const [buchstabe, vz] = (this.tonart && this.tonart.kreuze < 0 ? B_NAMEN : KREUZ_NAMEN)[((midi % 12) + 12) % 12];
    const schluessel = `${buchstabe}${oktave}`;
    const aktuell = this.stand.get(schluessel) ?? this.tonartVz.get(buchstabe) ?? '';
    const zeichen = vz === aktuell ? '' : vz === '' ? '=' : vz;
    if (zeichen) this.stand.set(schluessel, vz);
    const name = oktave >= 5 ? buchstabe.toLowerCase() + "'".repeat(oktave - 5) : buchstabe + ','.repeat(Math.max(0, 4 - oktave));
    return zeichen + name;
  }
}

// Die Takte einer Stimme als ABC-Text: Kopf (Titel, Taktart, Einheit =
// Zelle, Tempo je Schlag, Tonart), dann die Noten — Leerzeichen an jeder
// Schlaggrenze (so balkt abcjs je Schlag), vier Takte je Zeile.
export const alsAbc = (takte: readonly Takt[], r: Raster, kopf: AbcKopf, tonart: Tonart | null = null): string =>
  alsAbcStimmen([{ name: '', schluessel: 'violin', takte: [...takte] }], r, kopf, tonart);

// Mehrere Stimmen: je Stimme `V:n name="…" clef=…` im Kopf und `V:n` vor
// ihren Takten; abcjs setzt sie als Akkolade mit gleichen Taktstrichen.
// Eine namenlose Stimme im Violinschlüssel kommt ohne V: aus (so bleibt
// jedes bisher gespeicherte Stück gleich).
export function alsAbcStimmen(stimmen: readonly Stimme[], r: Raster, kopf: AbcKopf, tonart: Tonart | null = null): string {
  const schlag = einheitenJeSchlag(r.zaehler, r.nenner);
  const einzeln = stimmen.length === 1 && !stimmen[0].name && stimmen[0].schluessel === 'violin';
  const clef = (s: Stimme) => ABC_CLEF[s.schluessel] ?? 'treble';
  const zeilen = [
    'X:1',
    `T:${kopf.titel.trim() || 'Ohne Titel'}`,
    ...(kopf.komponist ? [`C:${kopf.komponist}`] : []),
    `M:${r.zaehler}/${r.nenner}`,
    `L:1/${r.feinheit}`,
    `Q:${schlag}/${r.nenner}=${r.bpm}`,
    ...(einzeln ? [] : stimmen.map((s, i) => `V:${i + 1} name="${s.name.replace(/"/g, "'")}" clef=${clef(s)}`)),
    `K:${tonart?.abc ?? 'C'}`,
  ];
  const koerper = stimmen.map((s, i) => (einzeln ? '' : `V:${i + 1}\n`) + taktText(s.takte, r, tonart));
  return zeilen.join('\n') + '\n' + koerper.join('') ;
}

function taktText(takte: readonly Takt[], r: Raster, tonart: Tonart | null): string {
  const js = zellenJeSchlag(r);
  const text: string[] = [];
  const vorzeichen = new Vorzeichenstand(tonart);
  // Bindebögen nur paarweise schreiben: ein Anfang ohne Ende (oder umgekehrt)
  // bliebe nach dem Löschen einer Note stehen und brächte abcjs durcheinander.
  const alle = takte.flatMap((t) => t.noten);
  const auf = new Set<Note>(), zu = new Set<Note>();
  const offen: Note[] = [];
  for (const n of alle) {
    if (n.bogenAuf && n.midi !== null) offen.push(n);
    if (n.bogenZu && n.midi !== null && offen.length) { const a = offen.pop()!; if (a !== n) { auf.add(a); zu.add(n); } }
  }
  takte.forEach((t, i) => {
    let pos = 0;
    vorzeichen.neuerTakt();
    const noten = t.noten.map((n) => {
      // Triole: geschrieben anderthalbfach, die Klammer `(3:2:k` vor der ersten Note.
      const w = n.triole ? (n.dauer * 3) / 2 : n.dauer;
      const d = w === 1 ? '' : String(w);
      const s = (n.gruppe ? `(3:2:${n.gruppe}` : '') + (auf.has(n) ? '(' : '') + (n.midi === null ? 'z' : vorzeichen.schreiben(n.midi)) + d + (n.bindung ? '-' : '') + (zu.has(n) ? ')' : '');
      pos += n.dauer;
      return pos % js === 0 ? `${s} ` : s;
    }).join('');
    text.push(noten.trim() + (i === takte.length - 1 ? ' |]' : ' |' + ((i + 1) % 4 === 0 ? '\n' : ' ')));
  });
  return (text.length ? text.join('') : 'z |]') + '\n';
}

// ABC zurücklesen — nur die Schreibweise von alsAbc (eine Stimme; Kopf
// X/T/C/M/L/Q/K; Noten mit Vorzeichen nach Notationsregel, Oktavzeichen,
// Dauer in Zellen, `-` Bindung; `z` Pause; `(3:2:k` Triole; `|` und `|]`).
// Damit lässt sich ein gespeichertes Stück wieder bearbeiten. null, wenn der
// Text nicht so aussieht.
// `takte` ist die erste Stimme (für Einstimmiges), `stimmen` alle.
export interface Gelesen { takte: Takt[]; stimmen: Stimme[]; raster: Raster; tonart: Tonart | null; titel: string }
const STAMMTOENE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function abcLesen(text: string): Gelesen | null {
  const zeilen = text.split(/\r?\n/);
  let titel = '', zaehler = 4, nenner: Nenner = 4, feinheit = 16, bpm = 80, tonart: Tonart | null = null;
  let kopf = true;
  const koerper: string[] = [];
  const meta: { name: string; schluessel: Schluessel }[] = [];
  let schluesselEinzeln: Schluessel = 'violin';
  for (const z of zeilen) {
    const m = kopf ? /^([A-Za-z]):(.*)$/.exec(z) : null;
    if (m) {
      const wert = m[2].trim();
      if (m[1] === 'T') titel = wert;
      else if (m[1] === 'V') {
        const nr = Number(/^(\d+)/.exec(wert)?.[1] ?? '0');
        const name = /name="([^"]*)"/.exec(wert)?.[1] ?? '';
        meta[nr - 1] = { name, schluessel: CLEF_ABC[/clef=(\w+)/.exec(wert)?.[1] ?? ''] ?? 'violin' };
      }
      else if (m[1] === 'M') { const t = /^(\d+)\/(\d+)$/.exec(wert); if (!t || !istNenner(Number(t[2]))) return null; zaehler = Number(t[1]); nenner = Number(t[2]) as Nenner; }
      else if (m[1] === 'L') { const t = /^1\/(\d+)$/.exec(wert); if (!t) return null; feinheit = Number(t[1]); }
      else if (m[1] === 'Q') { const t = /=(\d+)$/.exec(wert); if (t) bpm = Number(t[1]); }
      else if (m[1] === 'K') { tonart = tonartFinden(wert.split(/\s+/)[0]); schluesselEinzeln = CLEF_ABC[/clef=(\w+)/.exec(wert)?.[1] ?? ''] ?? 'violin'; kopf = false; }
    } else if (!kopf) koerper.push(z);
  }
  if (kopf) return null;
  const r: Raster = { bpm, zaehler, nenner, feinheit };
  // Der Körper: ohne V: eine Stimme; sonst je `V:n`-Zeile die Takte dieser Stimme.
  const abschnitte: { nr: number; zeilen: string[] }[] = [];
  for (const z of koerper) {
    const v = /^V:(\d+)\s*$/.exec(z);
    if (v) abschnitte.push({ nr: Number(v[1]), zeilen: [] });
    else { if (!abschnitte.length) abschnitte.push({ nr: 1, zeilen: [] }); abschnitte[abschnitte.length - 1].zeilen.push(z); }
  }
  const stimmen: Stimme[] = [];
  for (const a of abschnitte) {
    const takte = takteLesen(a.zeilen.join(' '), tonart);
    if (!takte) return null;
    const m = meta[a.nr - 1];
    stimmen[a.nr - 1] = { name: m?.name ?? '', schluessel: m?.schluessel ?? schluesselEinzeln, takte };
  }
  const gueltig = stimmen.filter((s): s is Stimme => !!s);
  if (!gueltig.length || !gueltig[0].takte.length) return null;
  return { takte: gueltig[0].takte, stimmen: gueltig, raster: r, tonart, titel };
}

function takteLesen(quelle: string, tonart: Tonart | null): Takt[] | null {
  const vorzeichenTonart = vorzeichenDerTonart(tonart);
  const stand = new Map<string, string>();
  const takte: Takt[] = [];
  let noten: Note[] = [];
  let triole = 0;
  const VZ: Record<string, number> = { '^': 1, _: -1, '=': 0 };
  const muster = /\s+|\(3:2:(\d+)|(\|\]?)|(\(?)([\^_=]?)([A-Ga-gz])([',]*)(\d*)(-?)(\)?)/y;
  muster.lastIndex = 0;
  while (muster.lastIndex < quelle.length) {
    const m = muster.exec(quelle);
    if (!m) return null;
    if (m[0].trim() === '') continue;
    if (m[1]) { triole = Number(m[1]); continue; } // Klammer: gilt für die nächsten k Noten
    if (m[2]) { if (noten.length) { takte.push({ noten }); noten = []; } stand.clear(); continue; }
    const [, , , bogenAuf, vz, buchstabe, oktaven, dauerText, bindung, bogenZu] = m;
    const w = dauerText ? Number(dauerText) : 1;
    const n: Note = { midi: null, dauer: triole ? (w * 2) / 3 : w };
    if (triole) n.triole = true;
    if (bogenAuf && buchstabe !== 'z') n.bogenAuf = true;
    if (bogenZu && buchstabe !== 'z') n.bogenZu = true;
    if (buchstabe !== 'z') {
      const gross = buchstabe === buchstabe.toUpperCase();
      const name = buchstabe.toUpperCase();
      let oktave = gross ? 4 : 5;
      for (const o of oktaven) oktave += o === "'" ? 1 : -1;
      const schluessel = `${name}${oktave}`;
      const vorzeichen = vz ? VZ[vz] : (stand.has(schluessel) ? VZ[stand.get(schluessel)!] : VZ[vorzeichenTonart.get(name) ?? '=']);
      if (vz) stand.set(schluessel, vz);
      n.midi = (oktave + 1) * 12 + STAMMTOENE[name] + vorzeichen;
      if (bindung) n.bindung = true;
    }
    noten.push(n);
    if (triole) triole--;
  }
  if (noten.length) takte.push({ noten });
  // Triolen-Gruppen: aufeinanderfolgende Triolen-Noten je Takt bilden eine Gruppe.
  for (const t of takte) {
    let k = 0;
    while (k < t.noten.length) {
      if (!t.noten[k].triole) { k++; continue; }
      let ende = k;
      while (ende < t.noten.length && t.noten[ende].triole) ende++;
      t.noten[k].gruppe = ende - k;
      k = ende;
    }
  }
  return takte;
}

// Den Titel im ABC-Kopf tauschen (Umbenennen eines geschriebenen Stücks:
// der Titel steht auf dem Blatt). Ohne T:-Zeile wird eine eingesetzt.
export function abcMitTitel(text: string, titel: string): string {
  const t = `T:${titel.trim() || 'Ohne Titel'}`;
  return /^T:.*$/m.test(text) ? text.replace(/^T:.*$/m, t) : text.replace(/^X:.*$/m, (x) => `${x}\n${t}`);
}

// ── Stück ──

// Nach dem Neuschreiben der PDF (Bearbeiten, G-01): Was an Seiten hängt,
// bleibt auf seiner Seitennummer; was über der neuen Seitenzahl liegt,
// verfällt. Liefert die ids, die wegfallen.
export function ueberzaehlig(seiten: number, listen: { stellen: { id: string; seite: number }[]; anmerkungen: { id: string; seite: number }[]; lesezeichen: { id: string; seite: number }[]; merker: { id: string; seite: number }[] }) {
  const weg = (l: { id: string; seite: number }[]) => l.filter((x) => x.seite > seiten).map((x) => x.id);
  return { stellen: weg(listen.stellen), anmerkungen: weg(listen.anmerkungen), lesezeichen: weg(listen.lesezeichen), merker: weg(listen.merker) };
}

export function notationText(n: Notation | undefined): string {
  if (!n) return '';
  return n.art === 'geschrieben' ? 'geschrieben' : n.art === 'eingesungen' ? 'eingesungen' : 'aus Audio';
}

export function notenDateiname(titel: string, jetzt: Date): string {
  const kern = titel.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Noten';
  const d = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  return `${kern} (Noten ${d}).pdf`;
}

// Tempo aus Tipps (Zeitpunkte in Millisekunden): Mittel der Abstände der
// letzten acht Tipps innerhalb von 2,5 s; unter drei Tipps kein Ergebnis.
export function tempoAusTipps(tipps: readonly number[]): number | null {
  const jetzt = tipps[tipps.length - 1];
  const l = tipps.filter((t) => jetzt - t < 2500).slice(-8);
  if (l.length < 3) return null;
  const abst = l.slice(1).map((t, i) => t - l[i]);
  return Math.min(300, Math.max(20, Math.round(60000 / (abst.reduce((x, y) => x + y, 0) / abst.length))));
}
