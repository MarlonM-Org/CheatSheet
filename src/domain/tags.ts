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

// auch: weitere ids desselben Tags — vom anderen Gerät oder zusammengelegte
// Doppelte (tagsAbgleichen). Reist in der Sicherung mit; wer es nicht kennt,
// überliest es.
export interface Tag { id: string; name: string; farbe: TagFarbe; geaendert: number; auch?: string[] }

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

// Gleicher Name = derselbe Tag: Groß/klein egal, Leerraum getrimmt und
// zusammengefasst.
export const tagSchluessel = (name: string) => name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('de');

// Der Tag mit diesem Namen (beim Umbenennen ohne den Tag selbst).
export const tagMitNamen = (tags: Tag[], name: string, ohneId?: string) =>
  tags.find((t) => t.id !== ohneId && tagSchluessel(t.name) === tagSchluessel(name));

// Namen, die es auf dem Gerät mehrfach gibt (je einmal, erste Schreibweise).
export function doppelteNamen(tags: Tag[]): string[] {
  const je = new Map<string, { name: string; anzahl: number }>();
  for (const t of tags) {
    const k = tagSchluessel(t.name);
    const da = je.get(k);
    if (da) da.anzahl++; else je.set(k, { name: t.name, anzahl: 1 });
  }
  return [...je.values()].filter((x) => x.anzahl > 1).map((x) => x.name);
}

const istFarbe = (x: unknown): x is TagFarbe => typeof x === 'string' && (TAG_FARBEN as readonly string[]).includes(x);

export function tagsLesen(roh: unknown): Tag[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>();
  const tags: Tag[] = [];
  for (const t of roh) {
    if (!t || typeof t !== 'object') continue;
    const { id, name, farbe, geaendert, auch: weitere } = t as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim() || gesehen.has(id)) continue;
    gesehen.add(id);
    const auch = Array.isArray(weitere) ? [...new Set(weitere.filter((x): x is string => typeof x === 'string' && x !== '' && x !== id))] : [];
    tags.push({
      id, name, farbe: istFarbe(farbe) ? farbe : 'grau', geaendert: typeof geaendert === 'number' && Number.isFinite(geaendert) ? geaendert : 0,
      ...(auch.length ? { auch } : {}),
    });
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

// Tag-ids einer Liste über die Tabelle umschreiben (alte id → neue), jede einmal.
export const tagsUmschreiben = (ids: string[], tabelle: Readonly<Record<string, string>>) =>
  [...new Set(ids.map((id) => (Object.hasOwn(tabelle, id) ? tabelle[id] : id)))];

// Tags aus einer Sicherung einspielen (ohne Sicherung: Doppelte auf dem
// Gerät zusammenlegen). Derselbe Tag ist:
//  1. dieselbe id oder eine seiner weiteren ids (auch) — so bleibt er derselbe,
//     auch wenn ihn ein Gerät umbenennt. Je Tag gilt der neuere Stand; ein
//     Grabstein, der nicht älter ist, löscht ihn (unter jeder seiner ids).
//  2. danach: derselbe Name (tagSchluessel), nach dem jeweils neueren Stand.
// Es bleibt die hiesige id — jedes Gerät bleibt stabil; unter mehreren
// hiesigen die mit den meisten Stücken hier (Gleichstand: die kleinere), gibt
// es den Tag nur dort, die mit den meisten Stücken dort. Name und Farbe vom
// neuesten Stand; alle anderen ids merkt sich der Tag (auch).
// tabelle: andere id → bleibende, für die Tag-Listen der Stücke.
// grabsteine: für gelöschte Tags die ids, die noch keinen Grabstein hatten.
export function tagsAbgleichen(
  hier: Tag[], dort: Tag[], grabsteine: Grabstein[],
  stuecke: { hier?: readonly object[]; dort?: readonly object[] } = {},
): { tags: Tag[]; tabelle: Record<string, string>; grabsteine: Grabstein[] } {
  const eintraege = [...hier.map((tag) => ({ tag, hier: true })), ...dort.map((tag) => ({ tag, hier: false }))];

  // 1. Gruppen über id und auch (Union-Find über alle ids).
  const oben = new Map<string, string>();
  const wurzel = (x: string): string => {
    let w = x;
    while (oben.has(w) && oben.get(w) !== w) w = oben.get(w)!;
    oben.set(x, w);
    return w;
  };
  const verbinden = (a: string, b: string) => { const wa = wurzel(a), wb = wurzel(b); if (wa !== wb) oben.set(wb, wa); };
  for (const { tag } of eintraege) { wurzel(tag.id); for (const a of tag.auch ?? []) verbinden(tag.id, a); }

  type Gruppe = { ids: Set<string>; glieder: typeof eintraege; erster: number };
  const nachWurzel = new Map<string, Gruppe>();
  eintraege.forEach((e, i) => {
    const w = wurzel(e.tag.id);
    const g = nachWurzel.get(w) ?? { ids: new Set<string>(), glieder: [], erster: i };
    g.glieder.push(e);
    for (const id of [e.tag.id, ...(e.tag.auch ?? [])]) g.ids.add(id);
    nachWurzel.set(w, g);
  });
  // Der neueste Stand (bei Gleichstand der hiesige bzw. der frühere).
  const neuester = (glieder: typeof eintraege) => glieder.reduce((a, b) => (b.tag.geaendert > a.tag.geaendert ? b : a)).tag;

  const tot = new Map<string, number>();
  for (const g of grabsteine) if (g.art === 'tag' && g.am > (tot.get(g.id) ?? -1)) tot.set(g.id, g.am);
  const neueGrabsteine: Grabstein[] = [];
  const lebend: Gruppe[] = [];
  for (const g of nachWurzel.values()) {
    const stand = neuester(g.glieder).geaendert;
    const am = Math.max(-1, ...[...g.ids].map((id) => tot.get(id) ?? -1));
    if (am < stand) { lebend.push(g); continue; }
    for (const id of g.ids) if ((tot.get(id) ?? -1) < am) neueGrabsteine.push({ art: 'tag', id, am });
  }

  // 2. Gleichnamige (nach dem neueren Stand) zusammen.
  const nachName = new Map<string, Gruppe>();
  for (const g of lebend.sort((a, b) => a.erster - b.erster)) {
    const k = tagSchluessel(neuester(g.glieder).name);
    const da = nachName.get(k);
    if (!da) { nachName.set(k, { ids: new Set(g.ids), glieder: [...g.glieder], erster: g.erster }); continue; }
    for (const id of g.ids) da.ids.add(id);
    da.glieder.push(...g.glieder);
  }

  const zaehlen = (liste: readonly object[] = []) => {
    const je = new Map<string, number>();
    for (const n of liste) for (const id of new Set(tagsVon(n as { tags?: unknown }))) je.set(id, (je.get(id) ?? 0) + 1);
    return je;
  };
  const anzahl = { hier: zaehlen(stuecke.hier), dort: zaehlen(stuecke.dort) };
  const tags: Tag[] = [];
  const tabelle = new Map<string, string>();
  for (const g of [...nachName.values()].sort((a, b) => a.erster - b.erster)) {
    const hiesige = g.glieder.filter((e) => e.hier);
    const kandidaten = (hiesige.length ? hiesige : g.glieder).map((e) => e.tag.id);
    const je = hiesige.length ? anzahl.hier : anzahl.dort;
    const id = kandidaten.reduce((a, b) => {
      const za = je.get(a) ?? 0, zb = je.get(b) ?? 0;
      return zb > za || (zb === za && b < a) ? b : a;
    });
    const neu = neuester(g.glieder);
    const auch = [...g.ids].filter((x) => x !== id).sort();
    for (const x of auch) tabelle.set(x, id);
    tags.push({ id, name: neu.name, farbe: neu.farbe, geaendert: Math.max(...g.glieder.map((e) => e.tag.geaendert)), ...(auch.length ? { auch } : {}) });
  }
  return { tags, tabelle: Object.fromEntries(tabelle), grabsteine: neueGrabsteine };
}
