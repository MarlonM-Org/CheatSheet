// Tonprofil (C-04): sein Instrument kennenlernen. Man spielt Ton für Ton,
// die App misst je Ton die Abweichung (Median über eine ruhige Messung) — das
// Ergebnis zeigt, welche Töne auf *diesem* Instrument zu hoch oder zu tief
// liegen. Profile werden datiert gespeichert, damit man die Entwicklung sieht;
// darauf bauen Hinweise für eine sauber intonierte Tonleiter auf.
// Töne sind notiert (wie das Stimmgerät sie anzeigt), als MIDI-Zahl. Rein, getestet.

import type { Grabstein } from './einspielen';
import { median, STIMMUNGEN, type Stimmung } from './ueben';

export interface ProfilTon { midi: number; cent: number }
export interface Tonprofil { id: string; am: number; stimmung: Stimmung; kammerton: number; toene: ProfilTon[] }

const NAMEN = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
export const tonName = (midi: number) => `${NAMEN[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const SAUBER = 5; // ±Cent, die als sauber gelten (wie im Stimmgerät)

export function tonReihe(von: number, bis: number): number[] {
  const [a, b] = von <= bis ? [von, bis] : [bis, von];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// Wie viele Ablesungen (~50 ms) ein Ton braucht: gut eine Sekunde ruhig halten.
export const MESS_ANZAHL = 20;

// Eine Ablesung des Stimmgeräts verarbeiten: Nur der gesuchte Ton zählt
// (Stille und andere Töne nicht). Sind genug Werte da, ist das Ergebnis ihr
// Median — Ansatz und einzelne Ausreißer fallen kaum ins Gewicht.
export function messen(werte: number[], ablesung: ProfilTon | null, ziel: number): { werte: number[]; ergebnis: number | null } {
  if (!ablesung || ablesung.midi !== ziel) return { werte, ergebnis: null };
  const neu = [...werte, ablesung.cent];
  return { werte: neu, ergebnis: neu.length >= MESS_ANZAHL ? Math.round(median(neu)) : null };
}

// Überblick: mittlere Abweichung (Betrag), wie viele Töne sauber sind, die
// auffälligsten (bis zu fünf, größte Abweichung zuerst).
export function kennzahlen(p: Tonprofil): { anzahl: number; mittel: number; sauber: number; auffaellig: ProfilTon[] } {
  const t = p.toene;
  return {
    anzahl: t.length,
    mittel: t.length ? Math.round(t.reduce((s, x) => s + Math.abs(x.cent), 0) / t.length) : 0,
    sauber: t.filter((x) => Math.abs(x.cent) <= SAUBER).length,
    auffaellig: t.filter((x) => Math.abs(x.cent) > SAUBER).sort((a, b) => Math.abs(b.cent) - Math.abs(a.cent)).slice(0, 5),
  };
}

// Je Ton, den beide Profile haben: besser heißt näher an sauber.
export function vergleich(neu: Tonprofil, alt: Tonprofil): { midi: number; neu: number; alt: number; besser: boolean }[] {
  const vorher = new Map(alt.toene.map((t) => [t.midi, t.cent]));
  return neu.toene.filter((t) => vorher.has(t.midi)).sort((a, b) => a.midi - b.midi)
    .map((t) => ({ midi: t.midi, neu: t.cent, alt: vorher.get(t.midi)!, besser: Math.abs(t.cent) < Math.abs(vorher.get(t.midi)!) }));
}

// ── Tonleiter ── Neigung des Instruments je Stufe und, im Akkord, die
// Terz-Regel (reine Stimmung: Dur-Terz 386 statt 400 Cent → etwa 14 tiefer,
// Moll-Terz 316 statt 300 → etwa 16 höher; Quinte/Quarte praktisch rein).
const LEITERN = { dur: [0, 2, 4, 5, 7, 9, 11, 12], moll: [0, 2, 3, 5, 7, 8, 10, 12] } as const;
const zahl = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}`;

export function neigung(cent: number | null): string {
  if (cent === null) return 'noch nicht gemessen';
  if (Math.abs(cent) <= SAUBER) return 'sitzt';
  return cent > 0 ? `neigt zu hoch (${zahl(cent)}) — tiefer ansetzen` : `neigt zu tief (${zahl(cent)}) — höher ansetzen, gut stützen`;
}

// Die Terz im Akkord: Zielwert (Dur −14, Moll +16) mit der Neigung des
// eigenen Tons verrechnet — so sagt der Hinweis, wie viel wirklich zu tun ist.
function terzHinweis(art: 'dur' | 'moll', c: number | null): string {
  const ziel = art === 'dur' ? -14 : 16;
  const grund = art === 'dur' ? 'als Terz im Dur-Akkord etwa 14 Cent tiefer als angezeigt' : 'als Terz im Moll-Akkord etwa 16 Cent höher als angezeigt';
  if (c === null) return grund;
  const d = c - ziel;
  if (Math.abs(d) <= SAUBER) return `${grund} — mit deinen ${zahl(c)} passt das schon`;
  return `${grund} — mit deinen ${zahl(c)} also etwa ${Math.abs(d)} ${d > 0 ? 'tiefer' : 'höher'} ansetzen`;
}

export function tonleiterHinweise(p: Tonprofil, grundton: number, art: 'dur' | 'moll'):
  { stufe: number; midi: number; name: string; cent: number | null; hinweis: string; akkord?: string }[] {
  const cent = new Map(p.toene.map((t) => [t.midi, t.cent]));
  const start = [...cent.keys()].filter((m) => ((m % 12) + 12) % 12 === grundton).sort((a, b) => a - b)[0];
  if (start === undefined) return [];
  return LEITERN[art].map((schritt, i) => {
    const midi = start + schritt, c = cent.has(midi) ? cent.get(midi)! : null;
    const akkord = i === 2 ? terzHinweis(art, c) : i === 4 ? 'als Quinte praktisch wie angezeigt' : undefined;
    return { stufe: i + 1, midi, name: tonName(midi), cent: c, hinweis: neigung(c), ...(akkord ? { akkord } : {}) };
  });
}

// ── Speichern und übertragen ── neueste zuerst.
const istStimmung = (x: unknown): x is Stimmung => typeof x === 'string' && x in STIMMUNGEN;
const endlich = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function profileLesen(roh: unknown): Tonprofil[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>();
  return roh.filter((p): p is Tonprofil => {
    if (!p || typeof p !== 'object') return false;
    const { id, am, stimmung, kammerton, toene } = p as Record<string, unknown>;
    if (typeof id !== 'string' || gesehen.has(id) || !endlich(am) || !istStimmung(stimmung) || !endlich(kammerton) || !Array.isArray(toene)) return false;
    if (!toene.every((t) => t && typeof t === 'object' && Number.isInteger((t as ProfilTon).midi) && endlich((t as ProfilTon).cent))) return false;
    gesehen.add(id);
    return true;
  }).map(({ id, am, stimmung, kammerton, toene }) => ({ id, am, stimmung, kammerton, toene: toene.map(({ midi, cent }) => ({ midi, cent })) }))
    .sort((a, b) => b.am - a.am);
}

export function profileVereinigen(hier: Tonprofil[], dort: Tonprofil[], grabsteine: Grabstein[]): Tonprofil[] {
  const tot = new Set(grabsteine.filter((g) => g.art === 'tonprofil').map((g) => g.id));
  const je = new Map<string, Tonprofil>();
  for (const p of [...hier, ...dort]) if (!tot.has(p.id) && !je.has(p.id)) je.set(p.id, p);
  return [...je.values()].sort((a, b) => b.am - a.am);
}
