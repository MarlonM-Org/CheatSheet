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
export interface Note { midi: number | null; dauer: number; bindung?: true; triole?: true; gruppe?: number }
export interface Takt { noten: Note[] }

// Zellen je Takt: 4/4 in Sechzehnteln = 16, 6/8 in Sechzehnteln = 12, 3/4 in Achteln = 6.
export const zellenJeTakt = (r: Raster) => (r.zaehler * r.feinheit) / r.nenner;
// Zellen je Schlag: der Schlag ist einheitenJeSchlag Einheiten (1/nenner) lang.
export const zellenJeSchlag = (r: Raster) => (einheitenJeSchlag(r.zaehler, r.nenner) * r.feinheit) / r.nenner;
// Dauer einer Zelle in Sekunden: der Schlag (60 / bpm) geteilt in seine Zellen.
export const zellenDauer = (r: Raster) => 60 / r.bpm / zellenJeSchlag(r);
export const taktDauer = (r: Raster) => zellenDauer(r) * zellenJeTakt(r);

// Hysterese: Ein Ton läuft weiter, solange die Tonhöhe weniger als `sprung`
// Halbtöne vom Median des bisherigen Tons abweicht — Vibrato um die
// Halbtongrenze zerhackt so keine gehaltenen Töne, und weil der Median der
// ganzen Strecke zählt (nicht der letzten Rahmen), wandert er bei einem
// Gleiten (Portamento) nicht mit. Jeder Rahmen bekommt den Median seines
// Tons. Kurze Aussetzer der Erkennung bis `aussetzer` Sekunden, nach denen
// derselbe Ton weitergeht, werden überbrückt (damit die Zelle klar bleibt;
// als Einsatz zählen sie weiterhin, siehe `einsaetze`).
export function hysterese(rahmen: readonly Tonrahmen[], sprung = 0.75, aussetzer = 0.15): Tonrahmen[] {
  const e = rahmen.map((f) => ({ ...f }));
  let glieder: number[] = [], toene: number[] = [], mitte = 0;
  let lueckeAb = -1; // Index des ersten unklaren Rahmens der laufenden Lücke
  const abschliessen = () => { for (const i of glieder) e[i].midi = mitte; glieder = []; toene = []; lueckeAb = -1; };
  for (let i = 0; i < e.length; i++) {
    const m = rahmen[i].midi;
    if (m === null) {
      if (glieder.length && lueckeAb < 0) lueckeAb = i;
      continue;
    }
    if (glieder.length && Math.abs(m - mitte) < sprung) {
      if (lueckeAb >= 0) {
        // Lücke zu Ende: kurz genug → Ton durchziehen, sonst war es eine Pause.
        if (rahmen[i].zeit - rahmen[lueckeAb].zeit <= aussetzer) { for (let k = lueckeAb; k < i; k++) glieder.push(k); }
        else { abschliessen(); glieder.push(i); toene.push(m); mitte = m; continue; }
        lueckeAb = -1;
      }
      glieder.push(i); toene.push(m); mitte = median(toene);
      continue;
    }
    if (glieder.length) abschliessen();
    glieder.push(i); toene.push(m); mitte = m;
  }
  if (glieder.length) abschliessen();
  return e;
}

// Rahmen auf Zellen verteilen: je Zelle der Median der klaren Tonhöhen, wenn
// mindestens `mindestAnteil` der Rahmen darin klar waren — sonst Pause.
// Zellen ohne Rahmen (Lücken) sind Pausen. Mit Tonart rückt der Median auf
// den nächsten Leiterton, sonst auf den nächsten Halbton.
export function zellen(rahmen: readonly Tonrahmen[], r: Raster, mindestAnteil = 0.5, tonart: Tonart | null = null): (number | null)[] {
  const dz = zellenDauer(r);
  const toene = new Map<number, number[]>();
  const alle = new Map<number, number>();
  let letzte = -1;
  for (const f of rahmen) {
    if (f.zeit < 0) continue;
    const z = Math.floor(f.zeit / dz);
    alle.set(z, (alle.get(z) ?? 0) + 1);
    if (f.midi !== null) {
      const l = toene.get(z) ?? [];
      l.push(f.midi);
      toene.set(z, l);
    }
    if (z > letzte) letzte = z;
  }
  const ergebnis: (number | null)[] = [];
  for (let z = 0; z <= letzte; z++) {
    const klar = toene.get(z) ?? [];
    const n = alle.get(z) ?? 0;
    ergebnis.push(n && klar.length >= n * mindestAnteil ? aufLeiter(median(klar), tonart) : null);
  }
  return ergebnis;
}

// Typische Gesangsartefakte auf Zellenebene: Eine einzelne Zelle, die zu
// beiden Nachbartönen etwa eine Oktave springt, ist ein Oktavfehler der
// Erkennung und rückt in deren Lage. Eine einzelne Zelle unmittelbar vor
// einem längeren Ton, höchstens zwei Halbtöne von ihm entfernt, ist ein
// angeschliffener Ansatz und geht in ihn auf.
export function nachbessern(z: readonly (number | null)[]): (number | null)[] {
  const e = [...z];
  for (let i = 1; i + 1 < e.length; i++) {
    const t = e[i], l = e[i - 1], n = e[i + 1];
    if (t === null || l === null || n === null || l === t || n === t) continue;
    if ([l, n].every((x) => Math.abs(x - t) >= 10 && Math.abs(x - t) <= 14)) e[i] = t + (l > t ? 12 : -12);
  }
  for (let i = 0; i + 1 < e.length; i++) {
    const t = e[i], f = e[i + 1];
    if (t === null || f === null || t === f || (i > 0 && e[i - 1] === t)) continue;
    let lauf = 0;
    while (i + 1 + lauf < e.length && e[i + 1 + lauf] === f) lauf++;
    if (lauf >= 2 && Math.abs(f - t) <= 2) e[i] = f;
  }
  return e;
}

// Ausreißer glätten: Eine einzelne Zelle, deren beide Nachbarn gleich sind
// und von ihr abweichen, nimmt deren Wert an — das tilgt Knackser (ein
// falscher Ton für eine Zelle) genauso wie Lücken in gehaltenen Tönen.
export function glaetten(z: readonly (number | null)[]): (number | null)[] {
  const e = [...z];
  for (let i = 1; i < e.length - 1; i++) {
    if (e[i - 1] === e[i + 1] && e[i] !== e[i - 1]) e[i] = e[i - 1];
  }
  return e;
}

// Anschläge aus dem Pegel: Zeitpunkte, an denen die Lautstärke innerhalb von
// `fenster` Sekunden um mindestens `anschlag` dB steigt (Konsonant, neu
// angesetzte Silbe, Klavieranschlag) — je Anstieg der Rahmen mit dem
// stärksten Sprung, höchstens einer je `abstand` Sekunden. Rahmen ohne Pegel
// liefern nichts.
export function anschlaege(rahmen: readonly Tonrahmen[], anschlag = 6, fenster = 0.05, abstand = 0.1): number[] {
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

// Einsätze: Wo nach einer Lücke von mindestens `luecke` unklaren Rahmen
// wieder ein Ton kommt, setzt eine neue Note an — auch auf derselben
// Tonhöhe (zweimal dasselbe A). Dazu jeder Anschlag aus dem Pegel, der auf
// einen klingenden Ton fällt. Liefert die Zellen mit Einsatz. Die Lücke
// ist kürzer als eine Zelle, sonst wäre sie schon eine Pause; der Einsatz
// rückt auf die nächste Zellgrenze.
export function einsaetze(rahmen: readonly Tonrahmen[], r: Raster, luecke = 2, anschlag = 6): Set<number> {
  const dz = zellenDauer(r);
  const e = new Set<number>();
  let unklar = luecke; // der erste Ton ist immer ein Einsatz
  for (const f of rahmen) {
    if (f.midi === null) { unklar++; continue; }
    if (unklar >= luecke && f.zeit >= 0) e.add(Math.round(f.zeit / dz));
    unklar = 0;
  }
  if (anschlag > 0) {
    const klar = rahmen.filter((f) => f.midi !== null);
    for (const t of anschlaege(rahmen, anschlag)) {
      if (t < 0) continue;
      // Nur, wenn kurz nach dem Anschlag ein Ton klingt (sonst ein Geräusch).
      const klingt = klar.some((f) => f.zeit >= t && f.zeit - t <= 0.12);
      if (klingt) e.add(Math.round(t / dz));
    }
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

export interface RasterOptionen { tonart?: Tonart | null }

// Zellen → Takte: gleiche Nachbarn werden zu Noten (außer bei einem Einsatz
// nach einer Lücke oder einem Anschlag), an Taktgrenzen geteilt
// und gebunden, in erlaubte Werte zerlegt. Pausen am Ende fallen weg, der
// letzte Takt wird mit Pausen gefüllt. Ohne einen einzigen Ton: keine Takte.
// Reihenfolge: Hysterese auf den Rahmen → Zellen (mit Tonart) → Glätten →
// Oktav-/Ansatz-Korrektur; Einsätze aus den rohen Rahmen (Lücken, Pegel).
export function rastern(rahmen: readonly Tonrahmen[], r: Raster, optionen: RasterOptionen = {}): Takt[] {
  const z = nachbessern(glaetten(zellen(hysterese(rahmen), r, 0.5, optionen.tonart ?? null)));
  const neu = einsaetze(rahmen, r);
  while (z.length && z[z.length - 1] === null) z.pop();
  if (!z.length) return [];
  const jt = zellenJeTakt(r);
  while (z.length % jt) z.push(null);

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

// Die Takte als ABC-Text: Kopf (Titel, Taktart, Einheit = Zelle, Tempo je
// Schlag, Tonart), dann die Noten — Leerzeichen an jeder Schlaggrenze
// (so balkt abcjs je Schlag), vier Takte je Zeile.
export function alsAbc(takte: readonly Takt[], r: Raster, kopf: AbcKopf, tonart: Tonart | null = null): string {
  const schlag = einheitenJeSchlag(r.zaehler, r.nenner);
  const zeilen = [
    'X:1',
    `T:${kopf.titel.trim() || 'Ohne Titel'}`,
    ...(kopf.komponist ? [`C:${kopf.komponist}`] : []),
    `M:${r.zaehler}/${r.nenner}`,
    `L:1/${r.feinheit}`,
    `Q:${schlag}/${r.nenner}=${r.bpm}`,
    `K:${tonart?.abc ?? 'C'}`,
  ];
  const js = zellenJeSchlag(r);
  const text: string[] = [];
  const vorzeichen = new Vorzeichenstand(tonart);
  takte.forEach((t, i) => {
    let pos = 0;
    vorzeichen.neuerTakt();
    const noten = t.noten.map((n) => {
      // Triole: geschrieben anderthalbfach, die Klammer `(3:2:k` vor der ersten Note.
      const w = n.triole ? (n.dauer * 3) / 2 : n.dauer;
      const d = w === 1 ? '' : String(w);
      const s = (n.gruppe ? `(3:2:${n.gruppe}` : '') + (n.midi === null ? 'z' : vorzeichen.schreiben(n.midi)) + d + (n.bindung ? '-' : '');
      pos += n.dauer;
      return pos % js === 0 ? `${s} ` : s;
    }).join('');
    text.push(noten.trim() + (i === takte.length - 1 ? ' |]' : ' |' + ((i + 1) % 4 === 0 ? '\n' : ' ')));
  });
  return zeilen.join('\n') + '\n' + (text.length ? text.join('') : 'z |]') + '\n';
}

// ABC zurücklesen — nur die Schreibweise von alsAbc (eine Stimme; Kopf
// X/T/C/M/L/Q/K; Noten mit Vorzeichen nach Notationsregel, Oktavzeichen,
// Dauer in Zellen, `-` Bindung; `z` Pause; `(3:2:k` Triole; `|` und `|]`).
// Damit lässt sich ein gespeichertes Stück wieder bearbeiten. null, wenn der
// Text nicht so aussieht.
export interface Gelesen { takte: Takt[]; raster: Raster; tonart: Tonart | null; titel: string }
const STAMMTOENE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function abcLesen(text: string): Gelesen | null {
  const zeilen = text.split(/\r?\n/);
  let titel = '', zaehler = 4, nenner: Nenner = 4, feinheit = 16, bpm = 80, tonart: Tonart | null = null;
  let kopf = true;
  const koerper: string[] = [];
  for (const z of zeilen) {
    const m = kopf ? /^([A-Za-z]):(.*)$/.exec(z) : null;
    if (m) {
      const wert = m[2].trim();
      if (m[1] === 'T') titel = wert;
      else if (m[1] === 'M') { const t = /^(\d+)\/(\d+)$/.exec(wert); if (!t || !istNenner(Number(t[2]))) return null; zaehler = Number(t[1]); nenner = Number(t[2]) as Nenner; }
      else if (m[1] === 'L') { const t = /^1\/(\d+)$/.exec(wert); if (!t) return null; feinheit = Number(t[1]); }
      else if (m[1] === 'Q') { const t = /=(\d+)$/.exec(wert); if (t) bpm = Number(t[1]); }
      else if (m[1] === 'K') { tonart = tonartFinden(wert); kopf = false; }
    } else if (!kopf) koerper.push(z);
  }
  if (kopf) return null;
  const r: Raster = { bpm, zaehler, nenner, feinheit };
  const vorzeichenTonart = vorzeichenDerTonart(tonart);
  const stand = new Map<string, string>();
  const takte: Takt[] = [];
  let noten: Note[] = [];
  let triole = 0;
  const VZ: Record<string, number> = { '^': 1, _: -1, '=': 0 };
  const muster = /\s+|\(3:2:(\d+)|(\|\]?)|([\^_=]?)([A-Ga-gz])([',]*)(\d*)(-?)/y;
  const quelle = koerper.join(' ');
  muster.lastIndex = 0;
  while (muster.lastIndex < quelle.length) {
    const m = muster.exec(quelle);
    if (!m) return null;
    if (m[0].trim() === '') continue;
    if (m[1]) { triole = Number(m[1]); continue; } // Klammer: gilt für die nächsten k Noten
    if (m[2]) { if (noten.length) { takte.push({ noten }); noten = []; } stand.clear(); continue; }
    const [, , , vz, buchstabe, oktaven, dauerText, bindung] = m;
    const w = dauerText ? Number(dauerText) : 1;
    const n: Note = { midi: null, dauer: triole ? (w * 2) / 3 : w };
    if (triole) n.triole = true;
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
  if (!takte.length) return null;
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
  return { takte, raster: r, tonart, titel };
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
