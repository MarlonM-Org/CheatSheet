// Sprünge (F-05): zwei Punkte im Stück verknüpfen — Wiederholung, D.S.,
// D.C., Coda. Am Sprungzeichen („von“) sitzt eine Marke; Antippen springt
// zur Ansicht mit der Einstiegsstelle („nach“). Gespeichert am Stück
// (`spruenge`), Koordinaten in Anteilen der Seite wie Stellen, Anmerkungen
// und Ausschnitte. Rein, getestet.

import { hauptseite, type Ansicht } from './notenpult';
import type { Rechteck } from './ueben';

export type SprungArt = 'wdh' | 'ds' | 'dc' | 'coda';
export const SPRUNG_ARTEN: SprungArt[] = ['wdh', 'ds', 'dc', 'coda'];
export const KUERZEL: Record<SprungArt, string> = { wdh: 'Wdh.', ds: 'D.S.', dc: 'D.C.', coda: 'Coda' };

export interface Punkt { seite: number; x: number; y: number }
export interface Sprung { id: string; von: Punkt; nach: Punkt; art: SprungArt }

const z = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;

function punktLesen(roh: unknown): Punkt | null {
  if (!roh || typeof roh !== 'object') return null;
  const { seite, x, y } = roh as Record<string, unknown>;
  if (!Number.isInteger(seite) || (seite as number) < 1) return null;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { seite: seite as number, x: z(x), y: z(y) };
}

// Reihenfolge: nach Seite und Lage des Sprungzeichens (wie im Stück).
const vorher = (a: Sprung, b: Sprung) => a.von.seite - b.von.seite || a.von.y - b.von.y || a.von.x - b.von.x;

// Prüft und säubert (Sicherung, ältere Stände): Kaputtes fällt weg, Anteile
// bleiben in 0..1, je id ein Sprung.
export function spruengeLesen(roh: unknown): Sprung[] {
  if (!Array.isArray(roh)) return [];
  const ids = new Set<string>();
  const aus: Sprung[] = [];
  for (const r of roh) {
    if (!r || typeof r !== 'object') continue;
    const { id, von, nach, art } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !id || ids.has(id)) continue;
    if (!SPRUNG_ARTEN.includes(art as SprungArt)) continue;
    const v = punktLesen(von), n = punktLesen(nach);
    if (!v || !n) continue;
    ids.add(id);
    aus.push({ id, von: v, nach: n, art: art as SprungArt });
  }
  return aus.sort(vorher);
}

// Sprünge einer neueren Version (Art hier unbekannt, sonst stimmig) zeigt
// diese Version nicht. Beim Schreiben reisen sie unverändert mit — sonst
// gingen sie beim nächsten Setzen oder Löschen auf diesem Gerät verloren.
function fremde(roh: unknown, belegt: Set<string>): Sprung[] {
  if (!Array.isArray(roh)) return [];
  const ids = new Set(belegt);
  const aus: Sprung[] = [];
  for (const r of roh) {
    if (!r || typeof r !== 'object') continue;
    const { id, von, nach, art } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !id || ids.has(id)) continue;
    if (typeof art !== 'string' || !art || SPRUNG_ARTEN.includes(art as SprungArt)) continue;
    if (!punktLesen(von) || !punktLesen(nach)) continue;
    ids.add(id);
    aus.push(r as Sprung); // Art nur nominell: der Eintrag bleibt, wie er war.
  }
  return aus;
}

// Was am Stück gespeichert wird: die eigene Liste, dazu die fremden Einträge
// aus dem Datensatz (roh). Je id einer; eigene gehen vor.
export function spruengeSchreiben(neu: Sprung[], roh: unknown): Sprung[] {
  const belegt = new Set([...neu, ...spruengeLesen(roh)].map((s) => s.id));
  return [...neu, ...fremde(roh, belegt)];
}

export function sprungHinzufuegen(liste: Sprung[], s: Omit<Sprung, 'id'>, id: string): Sprung[] {
  const neu: Sprung = { id, art: s.art, von: { seite: s.von.seite, x: z(s.von.x), y: z(s.von.y) }, nach: { seite: s.nach.seite, x: z(s.nach.x), y: z(s.nach.y) } };
  return [...liste, neu].sort(vorher);
}

export const sprungLoeschen = (liste: Sprung[], id: string) => liste.filter((s) => s.id !== id);

// „S. 3 → S. 1 · D.S.“
export const sprungText = (s: Sprung) => `S. ${s.von.seite} → S. ${s.nach.seite} · ${KUERZEL[s.art]}`;

// Nach vorn ist es meist die Coda, zurück eine Wiederholung (D.S./D.C. wählt man).
export function artVorschlag(von: Punkt, nach: Punkt): SprungArt {
  return nach.seite > von.seite || (nach.seite === von.seite && nach.y > von.y) ? 'coda' : 'wdh';
}

// Welche Seite liegt an dieser Höhe der Ansicht? Halb: oben bis zum Schnitt
// die nächste Seite, darunter der Rest der aktuellen.
export function seiteAn(a: Ansicht, y: number): number {
  return a.art === 'ganz' ? a.seite : y < a.schnitt ? a.oben : a.unten;
}

export function punktSichtbar(a: Ansicht, p: Punkt): boolean {
  if (a.art === 'ganz') return p.seite === a.seite;
  return (p.seite === a.oben && p.y < a.schnitt) || (p.seite === a.unten && p.y >= a.schnitt);
}

export const sichtbareMarken = (liste: Sprung[], a: Ansicht) => liste.filter((s) => punktSichtbar(a, s.von));

// Index der Ansicht, die die Einstiegsstelle zeigt: die ganze Zielseite.
// Gibt es die Seite nicht (mehr), null.
export function zielAnsicht(liste: Ansicht[], nach: Punkt): number | null {
  const i = liste.findIndex((a) => a.art === 'ganz' && a.seite === nach.seite);
  return i < 0 ? null : i;
}

// Zurück zur Ausgangsansicht: dieselbe, sonst die ganze Seite, die dort galt.
export function ansichtFinden(liste: Ansicht[], a: Ansicht): number {
  const gleich = liste.findIndex((b) => (b.art === 'ganz' && a.art === 'ganz' && b.seite === a.seite)
    || (b.art === 'halb' && a.art === 'halb' && b.oben === a.oben && b.unten === a.unten && Math.abs(b.schnitt - a.schnitt) < 1e-9));
  if (gleich >= 0) return gleich;
  const ganz = liste.findIndex((b) => b.art === 'ganz' && b.seite === hauptseite(a));
  return ganz < 0 ? 0 : ganz;
}

// Liegt eine Marke außerhalb des Ausschnitts, rückt sie an dessen Rand —
// sichtbar und antippbar.
export function einpassen(p: { x: number; y: number }, r: Rechteck): { x: number; y: number } {
  return { x: Math.min(r.x + r.b, Math.max(r.x, p.x)), y: Math.min(r.y + r.h, Math.max(r.y, p.y)) };
}

// ── Sprung setzen: erst das Sprungzeichen, dann (nach Blättern) das Ziel,
// dann die Art. Erneutes Tippen im letzten Schritt versetzt das Ziel.
// gewaehlt: die Art ist von Hand gewählt (sonst folgt sie dem Vorschlag).
export type Setzen =
  | { schritt: 'von' }
  | { schritt: 'nach'; von: Punkt }
  | { schritt: 'art'; von: Punkt; nach: Punkt; art: SprungArt; gewaehlt?: boolean };

const aufSeite = (p: Punkt) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

export function setzenTippen(zustand: Setzen, p: Punkt): Setzen {
  if (!aufSeite(p)) return zustand;
  if (zustand.schritt === 'von') return { schritt: 'nach', von: p };
  if (zustand.schritt === 'nach') return { schritt: 'art', von: zustand.von, nach: p, art: artVorschlag(zustand.von, p) };
  // Ziel versetzt: der Vorschlag zieht mit, solange nichts gewählt ist.
  return { ...zustand, nach: p, art: zustand.gewaehlt ? zustand.art : artVorschlag(zustand.von, p) };
}

export function artWaehlen(zustand: Setzen, art: SprungArt): Setzen {
  return zustand.schritt === 'art' ? { ...zustand, art, gewaehlt: true } : zustand;
}
