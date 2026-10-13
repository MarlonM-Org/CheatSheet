// Tags (F-14): selbst angelegte, farbige Markierungen für Stücke — „Wichtig
// üben“ (rot), „Mein Solo“ (blau) … Anders als Sammlungen gibt es einen Tag
// auch, solange noch kein Stück ihn trägt; die Definitionen liegen deshalb
// eigens auf dem Gerät (localStorage) und reisen im Kopf der Sicherung mit.
// Stücke tragen nur die ids (`tags`). Rein und getestet.

import type { Grabstein } from './einspielen';

// Farben der Tags; die Werte je Farbwelt stehen in globals.css (.tag-<farbe>).
// Ein Tag erscheint immer mit seinem Namen, nie als Farbe allein.
export const TAG_FARBEN = ['rot', 'orange', 'gelb', 'gruen', 'tuerkis', 'blau', 'lila', 'pink', 'grau'] as const;
export type TagFarbe = (typeof TAG_FARBEN)[number];
export const FARB_NAMEN: Record<TagFarbe, string> = {
  rot: 'Rot', orange: 'Orange', gelb: 'Gelb', gruen: 'Grün', tuerkis: 'Türkis', blau: 'Blau', lila: 'Lila', pink: 'Pink', grau: 'Grau',
};

export interface Tag { id: string; name: string; farbe: TagFarbe; geaendert: number }

// Zum schnellen Start (Marlons vier).
export const VORSCHLAEGE: { name: string; farbe: TagFarbe }[] = [
  { name: 'Wichtig üben', farbe: 'rot' },
  { name: 'Mein Solo', farbe: 'blau' },
  { name: 'Wenige Stellen', farbe: 'gelb' },
  { name: 'Kann ich', farbe: 'gruen' },
];

export function tagName(text: string): string | null {
  const n = text.replace(/\s+/g, ' ').trim().slice(0, 30).trim();
  return n || null;
}

const istFarbe = (x: unknown): x is TagFarbe => typeof x === 'string' && (TAG_FARBEN as readonly string[]).includes(x);

export function tagsLesen(roh: unknown): Tag[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>();
  const tags: Tag[] = [];
  for (const t of roh) {
    if (!t || typeof t !== 'object') continue;
    const { id, name, farbe, geaendert } = t as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim() || gesehen.has(id)) continue;
    gesehen.add(id);
    tags.push({ id, name, farbe: istFarbe(farbe) ? farbe : 'grau', geaendert: typeof geaendert === 'number' && Number.isFinite(geaendert) ? geaendert : 0 });
  }
  return tags;
}

// Die Tag-ids eines Stücks; mit `tags` nur die, die es noch gibt.
export function tagsVon(n: { tags?: unknown }, tags?: Tag[]): string[] {
  const ids = Array.isArray(n.tags) ? n.tags.filter((x): x is string => typeof x === 'string') : [];
  return tags ? ids.filter((id) => tags.some((t) => t.id === id)) : ids;
}
export const mitTag = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);
export const ohneTag = (ids: string[], id: string) => ids.filter((x) => x !== id);
export const imTagFilter = (n: { tags?: unknown }, tagId: string | null) => tagId === null || tagsVon(n).includes(tagId);

// Jeder Tag mit der Zahl seiner Stücke, in der Reihenfolge der Tags.
export function tagUebersicht(tags: Tag[], noten: { tags?: unknown }[]): { tag: Tag; anzahl: number }[] {
  return tags.map((tag) => ({ tag, anzahl: noten.filter((n) => tagsVon(n).includes(tag.id)).length }));
}

// Tags aus einer Sicherung einspielen: je id der neuere Stand; gelöschte
// (Grabstein, nicht älter als der Tag) bleiben weg; neue kommen hinten dazu.
export function tagsVereinigen(hier: Tag[], dort: Tag[], grabsteine: Grabstein[]): Tag[] {
  const je = new Map<string, Tag>();
  for (const t of [...hier, ...dort]) {
    const da = je.get(t.id);
    if (!da || t.geaendert > da.geaendert) je.set(t.id, t);
  }
  const tot = new Map(grabsteine.filter((g) => g.art === 'tag').map((g) => [g.id, g.am]));
  return [...je.values()].filter((t) => (tot.get(t.id) ?? -1) < t.geaendert);
}
