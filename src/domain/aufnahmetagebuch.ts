// Aufnahme-Tagebuch (I-20): alle eigenen Aufnahmen (G-09) über alle Stücke,
// neueste zuerst, nach Tagen; filtern nach Stück; zwei Aufnahmen desselben
// Stücks bzw. derselben Stelle vergleichen (alt gegen neu). Rein, getestet.
//
// Datenmodell unverändert: Die Angaben liegen am Stück (`aufnahmen`), die
// Bytes in „dateien“ unter der id der Aufnahme (docs/datenmodell.md). Sie
// bleiben auf dem Gerät und reisen nicht mit der Sicherung.
import type { Aufnahme, Stelle, Stueck } from './bestand';
import { nachTitel } from './notenpult';
import { imFilter } from './sammlungen';
import { imTagFilter } from './tags';

export interface TagebuchEintrag {
  aufnahme: Aufnahme;
  stueckId: string; stueckTitel: string;
  stelleId?: string; stelleTitel?: string; stelleSeite?: number;
  skillId?: string;
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Eine Aufnahme-Angabe prüfen: id, Zeitpunkt, Dauer ≥ 0, Typ — sonst null (wird übergangen, nicht gelöscht). */
export function aufnahmeLesen(roh: unknown): Aufnahme | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const a = roh as Record<string, unknown>;
  if (typeof a.id !== 'string' || !istZahl(a.am) || !istZahl(a.dauer) || a.dauer < 0 || typeof a.typ !== 'string') return null;
  return roh as Aufnahme;
}

/** Alle Aufnahmen aller Stücke, neueste zuerst (bei Gleichstand nach id). */
export function tagebuch(
  stuecke: readonly Pick<Stueck, 'id' | 'titel' | 'aufnahmen'>[],
  stellen: readonly Pick<Stelle, 'id' | 'titel' | 'seite'>[],
): TagebuchEintrag[] {
  const st = new Map(stellen.map((s) => [s.id, s]));
  const alle: TagebuchEintrag[] = [];
  for (const s of stuecke) {
    for (const roh of Array.isArray(s.aufnahmen) ? s.aufnahmen : []) {
      const a = aufnahmeLesen(roh);
      if (!a) continue;
      const stelle = a.stelleId ? st.get(a.stelleId) : undefined;
      alle.push({
        aufnahme: a, stueckId: s.id, stueckTitel: s.titel,
        ...(a.stelleId ? { stelleId: a.stelleId } : {}),
        ...(stelle ? { stelleTitel: stelle.titel, stelleSeite: stelle.seite } : {}),
        ...(typeof a.skillId === 'string' ? { skillId: a.skillId } : {}),
      });
    }
  }
  return alle.sort((x, y) => y.aufnahme.am - x.aufnahme.am || x.aufnahme.id.localeCompare(y.aufnahme.id));
}

/** Wo sie entstand: „Stelle „T. 32–48““, „Stelle auf Seite 3“, „Seite 2“ oder leer. */
export function wo(e: TagebuchEintrag): string {
  if (e.stelleTitel !== undefined) return e.stelleTitel ? `Stelle „${e.stelleTitel}“` : `Stelle auf Seite ${e.stelleSeite}`;
  return e.aufnahme.seite ? `Seite ${e.aufnahme.seite}` : '';
}

export const tagebuchFiltern = (alle: TagebuchEintrag[], stueckId: string | null) =>
  stueckId === null ? alle : alle.filter((e) => e.stueckId === stueckId);

/** Stücke mit Aufnahmen (für den Filter), nach Titel, mit Anzahl. */
export function stueckeMitAufnahmen(alle: readonly TagebuchEintrag[]): { id: string; titel: string; anzahl: number }[] {
  const m = new Map<string, { id: string; titel: string; anzahl: number }>();
  for (const e of alle) {
    const x = m.get(e.stueckId) ?? { id: e.stueckId, titel: e.stueckTitel, anzahl: 0 };
    x.anzahl++;
    m.set(e.stueckId, x);
  }
  return [...m.values()].sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

// ── Über die Bibliothek (Rückmeldung Marlon 2026-11-19) ──
// Die Aufnahmen sind über die Bibliothek abrufbar: Die Zeile „Aufnahmen“ und
// das Tagebuch grenzen auf das ein, was die Bibliothek gerade zeigt — Sammlung
// und Tag, wie der Stellen-Mix (B-19). „Alle“ im Tagebuch zeigt den Rest; so
// bleiben auch Aufnahmen zu einem Skill auffindbar, deren Stück woanders liegt.
export interface Bereich { sammlung: string | null; tag: string | null }
type ImBereich = { sammlungen?: unknown; tags?: unknown };

export const imBereich = (s: ImBereich | undefined, b: Bereich) => !!s && imFilter(s, b.sammlung) && imTagFilter(s, b.tag);

/** drin: Aufnahmen der Stücke im Bereich (Reihenfolge bleibt); draußen: die übrigen, davon mit Skill. */
export function tagebuchBereich(alle: TagebuchEintrag[], stuecke: readonly (ImBereich & { id: string })[], b: Bereich):
  { drin: TagebuchEintrag[]; draussen: number; draussenSkill: number } {
  if (b.sammlung === null && b.tag === null) return { drin: alle, draussen: 0, draussenSkill: 0 };
  const je = new Map(stuecke.map((s) => [s.id, s]));
  const drin = alle.filter((e) => imBereich(je.get(e.stueckId), b));
  const draussen = alle.filter((e) => !drin.includes(e));
  return { drin, draussen: draussen.length, draussenSkill: draussen.filter((e) => e.skillId !== undefined).length };
}

/** „Märsche · Wichtig“: Sammlung und Tag-Name (wie mixTitel); null ohne beides. */
export const bereichTitel = (sammlung: string | null, tagName: string | null) => [sammlung, tagName].filter(Boolean).join(' · ') || null;

/** Zeile „Aufnahmen“ in der Bibliothek, rechts: „4 · zuletzt heute“, „keine in „Märsche““, „noch keine“. */
export function aufnahmenStand(drin: number, gesamt: number, neueste: number | null, jetzt: number, titel: string | null): string {
  if (!drin || neueste === null) return gesamt && titel ? `keine in „${titel}“` : 'noch keine';
  return `${drin} · zuletzt ${zuletztKurz(neueste, jetzt)}`;
}

/** „heute“, „gestern“, sonst „3. Nov.“ (anderes Jahr: „3. Nov. 2025“), Ortszeit. */
export function zuletztKurz(t: number, jetzt: number): string {
  const titel = tagTitel(t, jetzt);
  if (titel === 'Heute' || titel === 'Gestern') return titel.toLowerCase();
  const d = new Date(t);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date(jetzt).getFullYear() ? { year: 'numeric' } : {}) });
}

/**
 * „Neue Aufnahme“: welches Stück vorgewählt ist. Ein im Tagebuch gefiltertes
 * Stück (ausdrücklich gewählt), sonst das offene Stück (Rückmeldung Marlon
 * 2026-11-19), sonst das der neuesten Aufnahme, sonst A–Z das erste. Was es
 * nicht (mehr) gibt, wird übersprungen.
 */
export function neueAufnahmeVorwahl(
  stuecke: readonly Pick<Stueck, 'id' | 'titel' | 'stimme'>[],
  wunsch: { filter: string | null; offen: string | null; neueste: string | null },
): string | null {
  for (const id of [wunsch.filter, wunsch.offen, wunsch.neueste]) if (id !== null && stuecke.some((s) => s.id === id)) return id;
  return [...stuecke].sort(nachTitel)[0]?.id ?? null;
}

const tagBeginn = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

/** „Heute“, „Gestern“, sonst „Fr., 14. Nov. 2026“ (Ortszeit). */
export function tagTitel(t: number, jetzt: number): string {
  const tag = tagBeginn(t), heute = tagBeginn(jetzt);
  if (tag === heute) return 'Heute';
  const gestern = new Date(heute); gestern.setDate(gestern.getDate() - 1);
  if (tag === gestern.getTime()) return 'Gestern';
  return new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Nach Tagen gruppiert, Reihenfolge der Liste bleibt. */
export function nachTagen(alle: readonly TagebuchEintrag[], jetzt: number): { tag: number; titel: string; eintraege: TagebuchEintrag[] }[] {
  const gruppen: { tag: number; titel: string; eintraege: TagebuchEintrag[] }[] = [];
  for (const e of alle) {
    const tag = tagBeginn(e.aufnahme.am);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte?.tag === tag) letzte.eintraege.push(e);
    else gruppen.push({ tag, titel: tagTitel(e.aufnahme.am, jetzt), eintraege: [e] });
  }
  return gruppen;
}

// ── Vergleichen ──
const schluessel = (e: TagebuchEintrag) => `${e.stueckId}\u0000${e.aufnahme.stelleId ?? ''}`;

/** Zwei verschiedene Aufnahmen desselben Stücks an derselben Stelle (oder beide ohne Stelle). */
export const vergleichbar = (a: TagebuchEintrag, b: TagebuchEintrag) => a.aufnahme.id !== b.aufnahme.id && schluessel(a) === schluessel(b);

/** Die passenden anderen Aufnahmen zu `id`, älteste zuerst (alt gegen neu). */
export function vergleichsPartner(alle: readonly TagebuchEintrag[], id: string): TagebuchEintrag[] {
  const e = alle.find((x) => x.aufnahme.id === id);
  if (!e) return [];
  return alle.filter((x) => vergleichbar(e, x)).sort((x, y) => x.aufnahme.am - y.aufnahme.am);
}

/** A = die ältere, B = die neuere; null, wenn nicht vergleichbar. */
export function vergleichsPaar(alle: readonly TagebuchEintrag[], id1: string, id2: string): { a: TagebuchEintrag; b: TagebuchEintrag } | null {
  const x = alle.find((e) => e.aufnahme.id === id1), y = alle.find((e) => e.aufnahme.id === id2);
  if (!x || !y || !vergleichbar(x, y)) return null;
  return x.aufnahme.am <= y.aufnahme.am ? { a: x, b: y } : { a: y, b: x };
}

/** A/B umschalten: an derselben Stelle weiter, höchstens bis kurz vor das Ende der anderen. */
export function umschaltZeit(position: number, dauerZiel: number): number {
  const p = Math.max(0, istZahl(position) ? position : 0);
  return istZahl(dauerZiel) && dauerZiel > 0 ? Math.min(p, Math.max(0, dauerZiel - 0.25)) : p;
}

// ── Namen und Dauer ──
export const aufnahmeNameAufbereiten = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 80);
export const dauerText = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
