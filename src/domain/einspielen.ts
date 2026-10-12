// Prüft den Inhalt einer gelesenen Übe-Sicherung, bevor etwas auf dem Gerät
// landet, und plant das Einspielen: was neu ist, was überschrieben wird, was
// übersprungen wird. Rein, getestet. Das Dateiformat selbst steht in
// ./sicherung (Vertrag mit registerfuehrer, hier nicht angefasst).
//
// Einspielen führt zusammen statt zu ersetzen: Was es nur auf dem Gerät gibt,
// bleibt. Bei gleicher id gilt der neuere Stand (Feld `geaendert`, bei älteren
// Einträgen aktualisiert/erstellt bzw. das letzte Tempo); Tempo-Verläufe und
// Striche werden immer vereinigt, Wegradiertes (`entfernt`) bleibt weg.
// Gelöschtes reist als Grabstein mit: Was auf dem anderen Gerät gelöscht und
// hier seitdem nicht geändert wurde, wird auch hier gelöscht — und was hier
// gelöscht wurde, legt die Sicherung nicht wieder an.
import { SicherungsFehler } from './sicherung';

export interface Zugeordnet { id: string; notenId: string }

// Die ids, die schon auf dem Gerät liegen, je Speicher.
export interface Vorhanden {
  noten: ReadonlySet<string>;
  stellen: ReadonlySet<string>;
  anmerkungen: ReadonlySet<string>;
}

// Ein gelöschtes Stück (samt Stellen und Anmerkungen), eine gelöschte Stelle,
// ein gelöschter Tag (F-14, @/domain/tags) oder ein gelöschtes Tonprofil
// (C-04, @/domain/tonprofil).
export interface Grabstein { art: 'noten' | 'stelle' | 'tag' | 'tonprofil'; id: string; am: number }

// Stand eines Eintrags auf dem Gerät, für Grabsteine und „neuer gewinnt“.
// datei: wann die PDF zuletzt gesetzt wurde.
export interface Staende {
  noten: ReadonlyMap<string, { stand: number; datei: number }>;
  stellen: ReadonlyMap<string, number>;
}

export interface Einspielplan<N> {
  noten: N[];
  stellen: (Zugeordnet & Record<string, unknown>)[];
  anmerkungen: (Zugeordnet & Record<string, unknown>)[];
  // Noten, die es auf dem Gerät noch nicht gibt.
  neu: number;
  // Was es auf dem Gerät schon gibt (gleiche id) und zusammengeführt wird —
  // Anlass der Rückfrage. ueberschrieben.noten sind die aktualisierten Noten.
  ueberschrieben: { noten: number; stellen: number; anmerkungen: number };
  // Stellen und Anmerkungen ohne zugehörige Noten (weder in der Sicherung noch
  // auf dem Gerät) — nicht übernommen, nur gezählt.
  uebersprungen: number;
  // Auf dem anderen Gerät gelöscht, hier seitdem unverändert: wird hier gelöscht.
  loeschen: { noten: string[]; stellen: string[] };
  // Hier gelöscht und dort seitdem unverändert: wird nicht wieder angelegt (Einträge).
  verworfen: number;
  // Noten, deren PDF aus der Sicherung kommt (dort nicht älter als hier).
  dateiAusSicherung: string[];
}

const istGrabstein = (x: unknown): x is Grabstein => typeof x === 'object' && x !== null
  && ['noten', 'stelle', 'tag', 'tonprofil'].includes((x as Grabstein).art)
  && typeof (x as Grabstein).id === 'string' && typeof (x as Grabstein).am === 'number' && Number.isFinite((x as Grabstein).am);

export function grabsteineLesen(roh: unknown): Grabstein[] {
  return Array.isArray(roh) ? roh.filter(istGrabstein).map(({ art, id, am }) => ({ art, id, am })) : [];
}

// Je Eintrag der späteste Grabstein; nach einem Jahr fallen sie weg (bis
// dahin hat jedes Gerät die Löschung längst bekommen).
export function grabsteineVereinigen(a: Grabstein[], b: Grabstein[], jetzt: number, haltenTage = 365): Grabstein[] {
  const je = new Map<string, Grabstein>();
  for (const g of [...a, ...b]) {
    const k = `${g.art}:${g.id}`;
    const da = je.get(k);
    if (!da || g.am > da.am) je.set(k, g);
  }
  const grenze = jetzt - haltenTage * 86_400_000;
  return [...je.values()].filter((g) => g.am >= grenze);
}

// Wie neu ist ein Eintrag? geaendert, sonst aktualisiert/erstellt, sonst das letzte Tempo.
export function stand(e: Record<string, unknown> | undefined): number {
  if (!e) return 0;
  if (istZahl(e.geaendert)) return e.geaendert;
  const am = liste(e.tempi).map((t) => zahl((t as Tempo)?.am));
  return Math.max(0, ...[e.aktualisiert, e.erstellt].filter(istZahl), ...am);
}
// Wann die PDF eines Stücks zuletzt gesetzt wurde.
export const dateiStand = (n: Record<string, unknown>) => (istZahl(n.aktualisiert) ? n.aktualisiert : istZahl(n.erstellt) ? n.erstellt : 0);

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function istNote(n: unknown): boolean {
  return istObjekt(n) && typeof n.id === 'string' && typeof n.titel === 'string' && typeof n.stimme === 'string'
    && typeof n.erstellt === 'number' && Number.isFinite(n.erstellt);
}

function istZugeordnet(e: unknown): e is Zugeordnet & Record<string, unknown> {
  return istObjekt(e) && typeof e.id === 'string' && typeof e.notenId === 'string';
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

// Eine Stelle braucht ihre Seite (ganze Zahl ab 1), den Rahmen und den
// Tempo-Verlauf — sonst kann der Notenbetrachter sie nicht zeigen.
function istStelle(e: unknown): boolean {
  return istZugeordnet(e) && Number.isInteger(e.seite) && (e.seite as number) >= 1
    && istZahl(e.x) && istZahl(e.y) && istZahl(e.b) && istZahl(e.h) && Array.isArray(e.tempi);
}

// Anmerkungen liegen je Seite in einem Datensatz mit der id „notenId:seite“;
// passt die id nicht dazu, gäbe es dieselbe Seite zweimal.
function istSeite(e: unknown): boolean {
  return istZugeordnet(e) && istZahl(e.seite) && Array.isArray(e.objekte) && e.id === `${e.notenId}:${e.seite}`;
}

export function einspielenPlanen<N extends { id: string }>(
  inhalt: { noten: N[]; stellen: unknown[]; anmerkungen: unknown[] },
  vorhanden: Vorhanden,
  // Grabsteine der Sicherung und des Geräts, Stand der Einträge auf dem Gerät.
  extra: { grabsteine?: Grabstein[]; geraetGrabsteine?: Grabstein[]; staende?: Staende } = {},
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istStelle)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istSeite)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');

  // Hier gelöscht und in der Sicherung seitdem nicht geändert: nicht wieder anlegen.
  const hierGeloescht = new Map((extra.geraetGrabsteine ?? []).map((g) => [`${g.art}:${g.id}`, g.am]));
  const tot = (art: 'noten' | 'stelle', e: { id: string }) => (hierGeloescht.get(`${art}:${e.id}`) ?? -1) >= stand(e as Record<string, unknown>);
  const notenTot = new Set(inhalt.noten.filter((n) => tot('noten', n)).map((n) => n.id));
  const notenListe = inhalt.noten.filter((n) => !notenTot.has(n.id));

  const inSicherung = new Set(notenListe.map((n) => n.id));
  const bekannt = (e: Zugeordnet) => inSicherung.has(e.notenId) || vorhanden.noten.has(e.notenId);
  let verworfen = notenTot.size;
  let uebersprungen = 0;
  const sortieren = <E extends Zugeordnet & Record<string, unknown>>(alle: E[], art?: 'noten' | 'stelle') => alle.filter((e) => {
    if (notenTot.has(e.notenId) && !vorhanden.noten.has(e.notenId)) { verworfen++; return false; }
    if (art && tot(art, e)) { verworfen++; return false; }
    if (!bekannt(e)) { uebersprungen++; return false; }
    return true;
  });
  const stellen = sortieren(inhalt.stellen as (Zugeordnet & Record<string, unknown>)[], 'stelle');
  const anmerkungen = sortieren(inhalt.anmerkungen as (Zugeordnet & Record<string, unknown>)[]);
  const zaehlen = (ids: Iterable<string>, da: ReadonlySet<string>) => [...ids].filter((id) => da.has(id)).length;
  const noten = zaehlen(inSicherung, vorhanden.noten);

  // Dort gelöscht: hier löschen, wenn es hier seitdem nicht geändert wurde.
  const inSicherungStellen = new Set(stellen.map((e) => e.id));
  const loeschen = { noten: [] as string[], stellen: [] as string[] };
  for (const g of extra.grabsteine ?? []) {
    if (g.art === 'noten' && vorhanden.noten.has(g.id) && !inSicherung.has(g.id)
      && (extra.staende?.noten.get(g.id)?.stand ?? 0) < g.am && !loeschen.noten.includes(g.id)) loeschen.noten.push(g.id);
    if (g.art === 'stelle' && vorhanden.stellen.has(g.id) && !inSicherungStellen.has(g.id)
      && (extra.staende?.stellen.get(g.id) ?? 0) < g.am && !loeschen.stellen.includes(g.id)) loeschen.stellen.push(g.id);
  }
  const dateiAusSicherung = [...new Set(notenListe.filter((n) => {
    const hier = extra.staende?.noten.get(n.id);
    return !hier || dateiStand(n as unknown as Record<string, unknown>) >= hier.datei;
  }).map((n) => n.id))];

  return {
    noten: notenListe,
    stellen,
    anmerkungen,
    neu: inSicherung.size - noten,
    ueberschrieben: {
      noten,
      stellen: zaehlen(new Set(stellen.map((s) => s.id)), vorhanden.stellen),
      anmerkungen: zaehlen(new Set(anmerkungen.map((a) => a.id)), vorhanden.anmerkungen),
    },
    uebersprungen,
    loeschen,
    verworfen,
    dateiAusSicherung,
  };
}

// Ob das Einspielen etwas auf dem Gerät überschreibt oder löscht und deshalb nachfragt.
export const ueberschreibt = (p: Pick<Einspielplan<unknown>, 'ueberschrieben'> & { loeschen?: Einspielplan<unknown>['loeschen'] }) =>
  p.ueberschrieben.noten + p.ueberschrieben.stellen + p.ueberschrieben.anmerkungen
  + (p.loeschen ? p.loeschen.noten.length + p.loeschen.stellen.length : 0) > 0;

// ── Zusammenführen bei gleicher id ──
// Die Felder der Sicherung gewinnen; was nur auf dem Gerät steht, bleibt.

type Tempo = { tempo: unknown; am: unknown };
const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

// Tempo-Verläufe vereinigen: jeder Eintrag (am + tempo) einmal, nach Zeit sortiert.
export function tempiVereinigen<T extends Tempo>(geraet: readonly T[], sicherung: readonly T[]): T[] {
  const gesehen = new Set<string>();
  const alle: T[] = [];
  for (const t of [...geraet, ...sicherung]) {
    const schluessel = `${String(t?.am)}|${String(t?.tempo)}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    alle.push(t);
  }
  return alle.sort((a, b) => zahl(a?.am) - zahl(b?.am));
}

const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

// Der neuere der beiden Einträge setzt seine Felder durch; Felder, die nur
// der andere hat, bleiben.
function neuerGewinnt(geraet: Record<string, unknown>, sicherung: Record<string, unknown>) {
  const g = stand(geraet), s = stand(sicherung);
  return { ...(g > s ? { ...sicherung, ...geraet } : { ...geraet, ...sicherung }), geaendert: Math.max(g, s) };
}

// Stelle: Titel, Notiz, Zieltempo und Rahmen vom neueren Stand, Tempi vereinigt.
export function stelleZusammenfuehren<S extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: S): S {
  if (!geraet) return sicherung;
  return { ...neuerGewinnt(geraet, sicherung), tempi: tempiVereinigen(liste(geraet.tempi) as Tempo[], liste(sicherung.tempi) as Tempo[]) } as unknown as S;
}

// Seite mit Anmerkungen: Striche und Texte nach ihrer id vereinigen. Was es auf
// beiden Seiten gibt, kommt aus der Sicherung und bleibt an seinem Platz; was
// nur in der Sicherung ist, kommt dahinter (darüber gezeichnet). Was auf
// einem der beiden Geräte wegradiert wurde (`entfernt`), bleibt weg.
export function seiteZusammenfuehren<A extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: A): A {
  if (!geraet) return sicherung;
  const id = (o: unknown) => (istObjekt(o) && typeof o.id === 'string' ? o.id : null);
  const entfernt = new Set([...liste(geraet.entfernt), ...liste(sicherung.entfernt)].filter((x): x is string => typeof x === 'string'));
  const ausSicherung = new Map<string, unknown>();
  for (const o of liste(sicherung.objekte)) { const k = id(o); if (k !== null) ausSicherung.set(k, o); }
  const vergeben = new Set<string>();
  const objekte: unknown[] = [];
  for (const o of liste(geraet.objekte)) {
    const k = id(o);
    if (k === null) { objekte.push(o); continue; }
    if (vergeben.has(k)) continue;
    vergeben.add(k);
    objekte.push(ausSicherung.has(k) ? ausSicherung.get(k) : o);
  }
  for (const o of liste(sicherung.objekte)) {
    const k = id(o);
    if (k === null) { objekte.push(o); continue; }
    if (vergeben.has(k)) continue;
    vergeben.add(k);
    objekte.push(ausSicherung.get(k));
  }
  return { ...geraet, ...sicherung, objekte: objekte.filter((o) => !entfernt.has(id(o) ?? '')), entfernt: [...entfernt], geaendert: Math.max(stand(geraet), stand(sicherung)) };
}

// Noten: Felder vom neueren Stand (Titel, Stimme, Sammlungen, Blättern); die
// Datei wählt der Plan (dateiAusSicherung). Der Dateiverweis des Geräts bleibt
// — er lässt sich nicht übertragen und gehört zu diesem Gerät.
export function notenZusammenfuehren<N extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: N): N {
  const { handle: _fremd, ...rest } = sicherung;
  void _fremd;
  if (!geraet) return rest as N;
  const { handle: verweis, ...hier } = geraet;
  return { ...neuerGewinnt(hier, rest), ...(rest.datei !== undefined ? { datei: rest.datei } : {}), ...(verweis !== undefined ? { handle: verweis } : {}) } as unknown as N;
}

// Text der Rückfrage. `datum` ist der lesbare Zeitpunkt der Sicherung oder null.
export function rueckfrage(p: Pick<Einspielplan<unknown>, 'ueberschrieben' | 'uebersprungen'> & { loeschen?: Einspielplan<unknown>['loeschen'] }, datum: string | null): string {
  const u = p.ueberschrieben;
  const n = (z: number, eins: string, mehr: string) => `${z} ${z === 1 ? eins : mehr}`;
  const teile = [
    u.noten ? n(u.noten, 'Noten', 'Noten') : '',
    u.stellen ? n(u.stellen, 'Stelle', 'Stellen') : '',
    u.anmerkungen ? `${n(u.anmerkungen, 'Seite', 'Seiten')} mit Anmerkungen` : '',
  ].filter(Boolean);
  const was = teile.length ? teile.slice(0, -1).join(', ') + (teile.length > 1 ? ' und ' : '') + teile[teile.length - 1] : 'nichts';
  const weg = p.loeschen ?? { noten: [], stellen: [] };
  const geloescht = [
    weg.noten.length ? `${n(weg.noten.length, 'Stück', 'Stücke')} (samt Stellen und Anmerkungen)` : '',
    weg.stellen.length ? n(weg.stellen.length, 'Stelle', 'Stellen') : '',
  ].filter(Boolean).join(' und ');
  return `${datum ? `Die Sicherung vom ${datum}` : 'Die Sicherung (Datum unbekannt)'} aktualisiert auf diesem Gerät ${was}. `
    + 'Wo beide Geräte etwas geändert haben, gilt der neuere Stand; Tempo-Verläufe und Striche werden zusammengeführt, Wegradiertes bleibt weg.'
    + (geloescht ? ` Auf dem anderen Gerät gelöscht und deshalb auch hier gelöscht: ${geloescht}.` : '')
    + (p.uebersprungen ? ` ${n(p.uebersprungen, 'Eintrag', 'Einträge')} ohne zugehörige Noten ${p.uebersprungen === 1 ? 'wird' : 'werden'} übersprungen.` : '')
    + ' Laden?';
}
