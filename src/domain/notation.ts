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
import { einheitenJeSchlag, istZusammengesetzt, type Nenner } from './takt';
import { median } from './ueben';

// Ein Rahmen der Tonhöhenspur: `zeit` in Sekunden ab Schlag 1 von Takt 1
// (davor liegende Rahmen zählen nicht), `midi` der notierte Ton (C4 = 60)
// oder null für Stille und Unklares.
export interface Tonrahmen { zeit: number; midi: number | null }

// Das Raster: Tempo je Schlag (wie das Metronom), Taktart, und der kleinste
// Notenwert, auf den gerundet wird (Achtel oder Sechzehntel).
export type Feinheit = 8 | 16;
export interface Raster { bpm: number; zaehler: number; nenner: Nenner; feinheit: Feinheit }
export const FEINHEITEN: { feinheit: Feinheit; name: string }[] = [{ feinheit: 8, name: 'Achtel' }, { feinheit: 16, name: 'Sechzehntel' }];

// Eine Note (oder Pause: midi null) mit Dauer in Zellen (1/feinheit).
// `bindung`: geht in die nächste Note über (Haltebogen, gleiche Tonhöhe).
export interface Note { midi: number | null; dauer: number; bindung?: true }
export interface Takt { noten: Note[] }

// Zellen je Takt: 4/4 in Sechzehnteln = 16, 6/8 in Sechzehnteln = 12, 3/4 in Achteln = 6.
export const zellenJeTakt = (r: Raster) => (r.zaehler * r.feinheit) / r.nenner;
// Zellen je Schlag: der Schlag ist einheitenJeSchlag Einheiten (1/nenner) lang.
export const zellenJeSchlag = (r: Raster) => (einheitenJeSchlag(r.zaehler, r.nenner) * r.feinheit) / r.nenner;
// Dauer einer Zelle in Sekunden: der Schlag (60 / bpm) geteilt in seine Zellen.
export const zellenDauer = (r: Raster) => 60 / r.bpm / zellenJeSchlag(r);
export const taktDauer = (r: Raster) => zellenDauer(r) * zellenJeTakt(r);

// Rahmen auf Zellen verteilen: je Zelle der Median der klaren Tonhöhen, wenn
// mindestens `mindestAnteil` der Rahmen darin klar waren — sonst Pause.
// Zellen ohne Rahmen (Lücken) sind Pausen.
export function zellen(rahmen: readonly Tonrahmen[], r: Raster, mindestAnteil = 0.5): (number | null)[] {
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
      l.push(Math.round(f.midi));
      toene.set(z, l);
    }
    if (z > letzte) letzte = z;
  }
  const ergebnis: (number | null)[] = [];
  for (let z = 0; z <= letzte; z++) {
    const klar = toene.get(z) ?? [];
    const n = alle.get(z) ?? 0;
    ergebnis.push(n && klar.length >= n * mindestAnteil ? Math.round(median(klar)) : null);
  }
  return ergebnis;
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

// Einsätze: Wo nach einer Lücke von mindestens `luecke` unklaren Rahmen
// wieder ein Ton kommt, setzt eine neue Note an — auch auf derselben
// Tonhöhe (zweimal dasselbe A). Liefert die Zellen mit Einsatz. Die Lücke
// ist kürzer als eine Zelle, sonst wäre sie schon eine Pause; der Einsatz
// rückt auf die nächste Zellgrenze. Hier könnte
// später eine Einsatz-Erkennung aus dem Pegel (G-02) einhängen.
export function einsaetze(rahmen: readonly Tonrahmen[], r: Raster, luecke = 2): Set<number> {
  const dz = zellenDauer(r);
  const e = new Set<number>();
  let unklar = luecke; // der erste Ton ist immer ein Einsatz
  for (const f of rahmen) {
    if (f.midi === null) { unklar++; continue; }
    if (unklar >= luecke && f.zeit >= 0) e.add(Math.round(f.zeit / dz));
    unklar = 0;
  }
  return e;
}

// Erlaubte Notenwerte in Zellen, absteigend: ganze Zweierpotenzen und ihre
// punktierten Formen, höchstens ein Takt lang.
// Pausen bleiben ohne Punktierung (eine punktierte halbe Pause liest niemand gern).
export function notenwerte(r: Raster, punktiert = true): number[] {
  const max = zellenJeTakt(r);
  const werte = new Set<number>();
  for (let v = 1; v <= max; v *= 2) {
    werte.add(v);
    if (punktiert && v >= 2 && (v * 3) / 2 <= max) werte.add((v * 3) / 2);
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

// Zellen → Takte: gleiche Nachbarn werden zu Noten (außer bei einem Einsatz
// nach einer Lücke), an Taktgrenzen geteilt
// und gebunden, in erlaubte Werte zerlegt. Pausen am Ende fallen weg, der
// letzte Takt wird mit Pausen gefüllt. Ohne einen einzigen Ton: keine Takte.
export function rastern(rahmen: readonly Tonrahmen[], r: Raster): Takt[] {
  const z = glaetten(zellen(rahmen, r));
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

// Die Takte als ABC-Text: Kopf (Titel, Taktart, Einheit = Zelle, Tempo je
// Schlag, Tonart C), dann die Noten — Leerzeichen an jeder Schlaggrenze
// (so balkt abcjs je Schlag), vier Takte je Zeile.
export function alsAbc(takte: readonly Takt[], r: Raster, kopf: AbcKopf): string {
  const schlag = einheitenJeSchlag(r.zaehler, r.nenner);
  const zeilen = [
    'X:1',
    `T:${kopf.titel.trim() || 'Ohne Titel'}`,
    ...(kopf.komponist ? [`C:${kopf.komponist}`] : []),
    `M:${r.zaehler}/${r.nenner}`,
    `L:1/${r.feinheit}`,
    `Q:${schlag}/${r.nenner}=${r.bpm}`,
    'K:C',
  ];
  const js = zellenJeSchlag(r);
  const text: string[] = [];
  takte.forEach((t, i) => {
    let pos = 0;
    const noten = t.noten.map((n) => {
      const d = n.dauer === 1 ? '' : String(n.dauer);
      const s = (n.midi === null ? 'z' : abcTon(n.midi)) + d + (n.bindung ? '-' : '');
      pos += n.dauer;
      return pos % js === 0 ? `${s} ` : s;
    }).join('');
    text.push(noten.trim() + (i === takte.length - 1 ? ' |]' : ' |' + ((i + 1) % 4 === 0 ? '\n' : ' ')));
  });
  return zeilen.join('\n') + '\n' + (text.length ? text.join('') : 'z |]') + '\n';
}

// ── Stück ──

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
