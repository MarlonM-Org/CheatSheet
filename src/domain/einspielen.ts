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
//
// Die optionalen Listen der Datenbank „cheatsheet“ (virtuelle Stücke,
// Lesezeichen, Merker, Setlisten) liegen schon im Zuschnitt des Geräts
// (`stueckId`) und folgen denselben Regeln: neuerer Stand gewinnt (eine
// Setliste samt Reihenfolge, Einträge werden nicht gemischt), Grabsteine
// reisen mit. Was auf ein Stück zeigt, das es danach nicht gibt, wird
// übersprungen und gezählt; eine Setliste bleibt, notfalls leer. Virtuelle
// Stücke brauchen eine echte Quelle.
import { SicherungsFehler, type Zusatz } from './sicherung';

export interface Zugeordnet { id: string; notenId: string }

// Die ids, die schon auf dem Gerät liegen, je Speicher. `noten` sind alle
// Stücke, `echte` die mit eigener PDF (fehlt es: alle).
export interface Vorhanden {
  noten: ReadonlySet<string>;
  stellen: ReadonlySet<string>;
  anmerkungen: ReadonlySet<string>;
  echte?: ReadonlySet<string>;
  lesezeichen?: ReadonlySet<string>;
  merker?: ReadonlySet<string>;
  setlisten?: ReadonlySet<string>;
}

// Ein gelöschtes Stück (samt Stellen und Anmerkungen; auch ein virtuelles),
// eine gelöschte Stelle, ein gelöschter Tag (F-14, @/domain/tags), ein
// gelöschtes Tonprofil (C-04, @/domain/tonprofil), Lesezeichen, Merker oder
// eine Setliste.
export const GRABSTEIN_ARTEN = ['noten', 'stelle', 'tag', 'tonprofil', 'lesezeichen', 'merker', 'setliste'] as const;
export interface Grabstein { art: (typeof GRABSTEIN_ARTEN)[number]; id: string; am: number }

// Stand eines Eintrags auf dem Gerät, für Grabsteine und „neuer gewinnt“.
// datei: wann die PDF zuletzt gesetzt wurde.
export interface Staende {
  noten: ReadonlyMap<string, { stand: number; datei: number }>;
  stellen: ReadonlyMap<string, number>;
  lesezeichen?: ReadonlyMap<string, number>;
  merker?: ReadonlyMap<string, number>;
  setlisten?: ReadonlyMap<string, number>;
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
  loeschen: Loeschen;
  // Hier gelöscht und dort seitdem unverändert: wird nicht wieder angelegt (Einträge).
  verworfen: number;
  // Noten, deren PDF aus der Sicherung kommt (dort nicht älter als hier).
  dateiAusSicherung: string[];
  // Die optionalen Listen, bereinigt. virtuelle zählen bei neu bzw.
  // ueberschrieben.noten mit.
  zusatz: Zusatz;
  // Was davon auf dem Gerät schon liegt und zusammengeführt wird.
  ersetzt: { lesezeichen: number; merker: number; setlisten: number };
}

export interface Loeschen { noten: string[]; stellen: string[]; lesezeichen?: string[]; merker?: string[]; setlisten?: string[] }
const anzahlLoeschen = (l: Loeschen) => l.noten.length + l.stellen.length
  + (l.lesezeichen?.length ?? 0) + (l.merker?.length ?? 0) + (l.setlisten?.length ?? 0);

const istGrabstein = (x: unknown): x is Grabstein => typeof x === 'object' && x !== null
  && (GRABSTEIN_ARTEN as readonly string[]).includes((x as Grabstein).art)
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

const ganzAb1 = (x: unknown) => Number.isInteger(x) && (x as number) >= 1;
const text = (x: unknown) => typeof x === 'string';

// Virtuelles Stück: wie Noten, dazu ein gültiger Seitenbereich.
function istVirtuell(n: unknown): boolean {
  if (!istNote(n)) return false;
  const q = (n as Record<string, unknown>).quelle;
  return istObjekt(q) && text(q.stueckId) && ganzAb1(q.von) && ganzAb1(q.bis) && (q.bis as number) >= (q.von as number);
}

const istLesezeichen = (e: unknown) => istObjekt(e) && text(e.id) && text(e.stueckId) && ganzAb1(e.seite)
  && text(e.titel) && istZahl(e.erstellt);

// Ein Merker je Seite, id „stueckId:seite“ wie bei den Anmerkungen.
const istMerker = (e: unknown) => istObjekt(e) && text(e.id) && text(e.stueckId) && ganzAb1(e.seite)
  && istZahl(e.gesetzt) && e.id === `${e.stueckId}:${e.seite}`;

function istEintrag(e: unknown): boolean {
  if (!istObjekt(e) || !text(e.id)) return false;
  if (e.art === 'stueck') return text(e.stueckId);
  if (e.art === 'lesezeichen') return text(e.lesezeichenId);
  return e.art === 'platzhalter' && text(e.titel);
}

const istSetliste = (e: unknown) => istObjekt(e) && text(e.id) && text(e.titel) && istZahl(e.erstellt)
  && Array.isArray(e.eintraege) && e.eintraege.every(istEintrag);

type Roh = { id: string } & Record<string, unknown>;

export function einspielenPlanen<N extends { id: string }>(
  inhalt: { noten: N[]; stellen: unknown[]; anmerkungen: unknown[] } & Partial<Record<keyof Zusatz, unknown[]>>,
  vorhanden: Vorhanden,
  // Grabsteine der Sicherung und des Geräts, Stand der Einträge auf dem Gerät.
  extra: { grabsteine?: Grabstein[]; geraetGrabsteine?: Grabstein[]; staende?: Staende } = {},
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istStelle)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istSeite)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');
  const roh = {
    virtuelle: (inhalt.virtuelle ?? []) as Roh[], lesezeichen: (inhalt.lesezeichen ?? []) as Roh[],
    merker: (inhalt.merker ?? []) as Roh[], setlisten: (inhalt.setlisten ?? []) as Roh[],
  };
  if (!roh.virtuelle.every(istVirtuell)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stück ungültig).');
  if (!roh.lesezeichen.every(istLesezeichen)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Lesezeichen ungültig).');
  if (!roh.merker.every(istMerker)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Merker ungültig).');
  if (!roh.setlisten.every(istSetliste)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Setliste ungültig).');

  // Hier gelöscht und in der Sicherung seitdem nicht geändert: nicht wieder anlegen.
  const hierGeloescht = new Map((extra.geraetGrabsteine ?? []).map((g) => [`${g.art}:${g.id}`, g.am]));
  const tot = (art: Grabstein['art'], e: { id: string }) => (hierGeloescht.get(`${art}:${e.id}`) ?? -1) >= stand(e as Record<string, unknown>);
  const notenTot = new Set([...inhalt.noten, ...roh.virtuelle].filter((n) => tot('noten', n)).map((n) => n.id));
  const notenListe = inhalt.noten.filter((n) => !notenTot.has(n.id));

  const inSicherung = new Set(notenListe.map((n) => n.id));
  // Virtuelle Stücke brauchen eine echte Quelle — in der Sicherung oder auf
  // dem Gerät (dort nicht von der Sicherung zum virtuellen gemacht).
  const virtuelleIds = new Set(roh.virtuelle.map((v) => v.id));
  const echteAufGeraet = vorhanden.echte ?? vorhanden.noten;
  const echt = (id: string) => inSicherung.has(id) || (echteAufGeraet.has(id) && !virtuelleIds.has(id));
  let verworfen = notenTot.size;
  let uebersprungen = 0;
  const virtuelle = roh.virtuelle.filter((v) => {
    if (notenTot.has(v.id) || inSicherung.has(v.id)) return false;
    if (echt((v.quelle as { stueckId: string }).stueckId)) return true;
    uebersprungen++;
    return false;
  });
  for (const v of virtuelle) inSicherung.add(v.id);
  const bekannt = (e: Zugeordnet) => inSicherung.has(e.notenId) || vorhanden.noten.has(e.notenId);
  const sortieren = <E extends Zugeordnet & Record<string, unknown>>(alle: E[], art?: 'noten' | 'stelle') => alle.filter((e) => {
    if (notenTot.has(e.notenId) && !vorhanden.noten.has(e.notenId)) { verworfen++; return false; }
    if (art && tot(art, e)) { verworfen++; return false; }
    if (!bekannt(e)) { uebersprungen++; return false; }
    return true;
  });
  const stellen = sortieren(inhalt.stellen as (Zugeordnet & Record<string, unknown>)[], 'stelle');
  const anmerkungen = sortieren(inhalt.anmerkungen as (Zugeordnet & Record<string, unknown>)[]);
  // Lesezeichen und Merker hängen per stueckId am Stück.
  const amStueck = (alle: Roh[], art: Grabstein['art']) => alle.filter((e) => {
    const zu = e.stueckId as string;
    if (notenTot.has(zu) && !vorhanden.noten.has(zu)) { verworfen++; return false; }
    if (tot(art, e)) { verworfen++; return false; }
    if (!inSicherung.has(zu) && !vorhanden.noten.has(zu)) { uebersprungen++; return false; }
    return true;
  });
  const lesezeichen = amStueck(roh.lesezeichen, 'lesezeichen');
  const merker = amStueck(roh.merker, 'merker');
  const lzIds = new Set([...lesezeichen.map((l) => l.id), ...(vorhanden.lesezeichen ?? [])]);
  const stueck = (id: string) => inSicherung.has(id) || vorhanden.noten.has(id);
  const setlisten = roh.setlisten.filter((sl) => {
    if (!tot('setliste', sl)) return true;
    verworfen++;
    return false;
  }).map((sl) => {
    const alle = sl.eintraege as Roh[];
    const bleiben = alle.filter((e) => (e.art === 'stueck' ? stueck(e.stueckId as string)
      : e.art === 'lesezeichen' ? lzIds.has(e.lesezeichenId as string) : true));
    uebersprungen += alle.length - bleiben.length;
    return bleiben.length === alle.length ? sl : { ...sl, eintraege: bleiben };
  });
  const zaehlen = (ids: Iterable<string>, da: ReadonlySet<string> = new Set()) => [...ids].filter((id) => da.has(id)).length;
  const noten = zaehlen(inSicherung, vorhanden.noten);
  const ids = (l: Roh[]) => new Set(l.map((e) => e.id));

  // Dort gelöscht: hier löschen, wenn es hier seitdem nicht geändert wurde.
  const inSicherungStellen = new Set(stellen.map((e) => e.id));
  const loeschen: Required<Loeschen> = { noten: [], stellen: [], lesezeichen: [], merker: [], setlisten: [] };
  const zusatzLoeschen = [
    { art: 'lesezeichen', liste: loeschen.lesezeichen, da: vorhanden.lesezeichen, inDatei: ids(lesezeichen), staende: extra.staende?.lesezeichen },
    { art: 'merker', liste: loeschen.merker, da: vorhanden.merker, inDatei: ids(merker), staende: extra.staende?.merker },
    { art: 'setliste', liste: loeschen.setlisten, da: vorhanden.setlisten, inDatei: ids(setlisten), staende: extra.staende?.setlisten },
  ] as const;
  for (const g of extra.grabsteine ?? []) {
    if (g.art === 'noten' && vorhanden.noten.has(g.id) && !inSicherung.has(g.id)
      && (extra.staende?.noten.get(g.id)?.stand ?? 0) < g.am && !loeschen.noten.includes(g.id)) loeschen.noten.push(g.id);
    if (g.art === 'stelle' && vorhanden.stellen.has(g.id) && !inSicherungStellen.has(g.id)
      && (extra.staende?.stellen.get(g.id) ?? 0) < g.am && !loeschen.stellen.includes(g.id)) loeschen.stellen.push(g.id);
    for (const z of zusatzLoeschen) {
      if (g.art === z.art && z.da?.has(g.id) && !z.inDatei.has(g.id)
        && (z.staende?.get(g.id) ?? 0) < g.am && !z.liste.includes(g.id)) z.liste.push(g.id);
    }
  }
  const dateiAusSicherung = [...new Set(notenListe.filter((n) => {
    const hier = extra.staende?.noten.get(n.id);
    return !hier || dateiStand(n as unknown as Record<string, unknown>) >= hier.datei;
  }).map((n) => n.id))];

  // Die optionalen Listen nur, wenn es etwas zu löschen gibt.
  const loeschenKurz: Loeschen = { noten: loeschen.noten, stellen: loeschen.stellen };
  for (const k of ['lesezeichen', 'merker', 'setlisten'] as const) if (loeschen[k].length) loeschenKurz[k] = loeschen[k];
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
    loeschen: loeschenKurz,
    verworfen,
    dateiAusSicherung,
    zusatz: { virtuelle, lesezeichen, merker, setlisten },
    ersetzt: {
      lesezeichen: zaehlen(ids(lesezeichen), vorhanden.lesezeichen),
      merker: zaehlen(ids(merker), vorhanden.merker),
      setlisten: zaehlen(ids(setlisten), vorhanden.setlisten),
    },
  };
}

// Ob das Einspielen etwas auf dem Gerät überschreibt oder löscht und deshalb nachfragt.
export const ueberschreibt = (p: Pick<Einspielplan<unknown>, 'ueberschrieben'> & { loeschen?: Loeschen; ersetzt?: Einspielplan<unknown>['ersetzt'] }) =>
  p.ueberschrieben.noten + p.ueberschrieben.stellen + p.ueberschrieben.anmerkungen
  + (p.loeschen ? anzahlLoeschen(p.loeschen) : 0)
  + (p.ersetzt ? p.ersetzt.lesezeichen + p.ersetzt.merker + p.ersetzt.setlisten : 0) > 0;

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

// Lesezeichen, Merker, Setlisten: der neuere Stand ganz (eine Setliste samt
// Reihenfolge — Einträge werden nicht gemischt).
export function eintragZusammenfuehren<E extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: E): E {
  if (!geraet) return sicherung;
  return (stand(geraet) > stand(sicherung) ? { ...sicherung, ...geraet } : { ...geraet, ...sicherung }) as E;
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
export function rueckfrage(
  p: Pick<Einspielplan<unknown>, 'ueberschrieben' | 'uebersprungen'> & { loeschen?: Loeschen; ersetzt?: Einspielplan<unknown>['ersetzt'] },
  datum: string | null,
): string {
  const u = p.ueberschrieben;
  const e = p.ersetzt ?? { lesezeichen: 0, merker: 0, setlisten: 0 };
  const n = (z: number, eins: string, mehr: string) => `${z} ${z === 1 ? eins : mehr}`;
  const teile = [
    u.noten ? n(u.noten, 'Noten', 'Noten') : '',
    u.stellen ? n(u.stellen, 'Stelle', 'Stellen') : '',
    u.anmerkungen ? `${n(u.anmerkungen, 'Seite', 'Seiten')} mit Anmerkungen` : '',
    e.lesezeichen ? n(e.lesezeichen, 'Lesezeichen', 'Lesezeichen') : '',
    e.merker ? n(e.merker, 'Merker', 'Merker') : '',
    e.setlisten ? n(e.setlisten, 'Setliste', 'Setlisten') : '',
  ].filter(Boolean);
  const was = teile.length ? teile.slice(0, -1).join(', ') + (teile.length > 1 ? ' und ' : '') + teile[teile.length - 1] : 'nichts';
  const aufzaehlen = (t: string[]) => t.slice(0, -1).join(', ') + (t.length > 1 ? ' und ' : '') + t[t.length - 1];
  const weg = p.loeschen ?? { noten: [], stellen: [] };
  const geloescht = [
    weg.noten.length ? `${n(weg.noten.length, 'Stück', 'Stücke')} (samt Stellen und Anmerkungen)` : '',
    weg.stellen.length ? n(weg.stellen.length, 'Stelle', 'Stellen') : '',
    weg.lesezeichen?.length ? n(weg.lesezeichen.length, 'Lesezeichen', 'Lesezeichen') : '',
    weg.merker?.length ? n(weg.merker.length, 'Merker', 'Merker') : '',
    weg.setlisten?.length ? n(weg.setlisten.length, 'Setliste', 'Setlisten') : '',
  ].filter(Boolean);
  return `${datum ? `Die Sicherung vom ${datum}` : 'Die Sicherung (Datum unbekannt)'} aktualisiert auf diesem Gerät ${was}. `
    + 'Wo beide Geräte etwas geändert haben, gilt der neuere Stand; Tempo-Verläufe und Striche werden zusammengeführt, Wegradiertes bleibt weg.'
    + (geloescht.length ? ` Auf dem anderen Gerät gelöscht und deshalb auch hier gelöscht: ${aufzaehlen(geloescht)}.` : '')
    + (p.uebersprungen ? ` ${n(p.uebersprungen, 'Eintrag', 'Einträge')} ohne zugehörige Noten ${p.uebersprungen === 1 ? 'wird' : 'werden'} übersprungen.` : '')
    + ' Laden?';
}
