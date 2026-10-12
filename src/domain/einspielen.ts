// Prüft den Inhalt einer gelesenen Übe-Sicherung, bevor etwas auf dem Gerät
// landet, und plant das Einspielen: was neu ist, was überschrieben wird, was
// übersprungen wird. Rein, getestet. Das Dateiformat selbst steht in
// ./sicherung (Vertrag mit registerfuehrer, hier nicht angefasst).
//
// Einspielen führt zusammen statt zu ersetzen, und zwar ohne Verlust: Was es
// nur auf dem Gerät gibt, bleibt. Bei gleicher id kommen Titel, Notizen und
// Rahmen aus der Sicherung, aber Tempo-Verläufe und Striche werden vereinigt
// (siehe stelleZusammenfuehren, seiteZusammenfuehren, notenZusammenfuehren).
//
// Die vier optionalen Listen (virtuelle Stücke, Lesezeichen, Merker,
// Setlisten) liegen schon im Zuschnitt des Geräts (`stueckId`). Bei gleicher
// id gewinnt die Sicherung ganz — eine Setliste samt Reihenfolge, Einträge
// werden nicht gemischt. Was auf ein Stück zeigt, das es danach nicht gibt,
// wird übersprungen und gezählt; eine Setliste bleibt, notfalls leer.
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

export interface Einspielplan<N> {
  noten: N[];
  stellen: (Zugeordnet & Record<string, unknown>)[];
  anmerkungen: (Zugeordnet & Record<string, unknown>)[];
  // Noten, die es auf dem Gerät noch nicht gibt.
  neu: number;
  // Was es auf dem Gerät schon gibt (gleiche id) und zusammengeführt wird —
  // Anlass der Rückfrage. ueberschrieben.noten sind die aktualisierten Noten.
  ueberschrieben: { noten: number; stellen: number; anmerkungen: number };
  // Was auf Noten zeigt, die es weder in der Sicherung noch auf dem Gerät
  // gibt (Stellen, Anmerkungen, virtuelle Stücke ohne Quelle, Lesezeichen,
  // Merker, Setlisten-Einträge) — nicht übernommen, nur gezählt.
  uebersprungen: number;
  // Die optionalen Listen, bereinigt. virtuelle zählen bei neu bzw.
  // ueberschrieben.noten mit.
  zusatz: Zusatz;
  // Was davon auf dem Gerät schon liegt und ganz ersetzt wird.
  ersetzt: { lesezeichen: number; merker: number; setlisten: number };
}

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
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istStelle)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istSeite)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');
  const roh = {
    virtuelle: inhalt.virtuelle ?? [], lesezeichen: inhalt.lesezeichen ?? [],
    merker: inhalt.merker ?? [], setlisten: inhalt.setlisten ?? [],
  };
  if (!roh.virtuelle.every(istVirtuell)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stück ungültig).');
  if (!roh.lesezeichen.every(istLesezeichen)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Lesezeichen ungültig).');
  if (!roh.merker.every(istMerker)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Merker ungültig).');
  if (!roh.setlisten.every(istSetliste)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Setliste ungültig).');

  const inSicherung = new Set(inhalt.noten.map((n) => n.id));
  // Virtuelle Stücke brauchen eine echte Quelle — in der Sicherung oder auf
  // dem Gerät (dort nicht von der Sicherung zum virtuellen gemacht).
  const virtuelleIds = new Set((roh.virtuelle as Roh[]).map((v) => v.id));
  const echteAufGeraet = vorhanden.echte ?? vorhanden.noten;
  const echt = (id: string) => inSicherung.has(id) || (echteAufGeraet.has(id) && !virtuelleIds.has(id));
  const virtuelle = (roh.virtuelle as Roh[]).filter((v) => !inSicherung.has(v.id) && echt((v.quelle as { stueckId: string }).stueckId));
  const stueckIds = new Set([...inSicherung, ...virtuelle.map((v) => v.id)]);
  const stueck = (id: string) => stueckIds.has(id) || vorhanden.noten.has(id);

  const bekannt = (e: Zugeordnet) => stueck(e.notenId);
  const stellen = (inhalt.stellen as (Zugeordnet & Record<string, unknown>)[]).filter(bekannt);
  const anmerkungen = (inhalt.anmerkungen as (Zugeordnet & Record<string, unknown>)[]).filter(bekannt);
  const lesezeichen = (roh.lesezeichen as Roh[]).filter((l) => stueck(l.stueckId as string));
  const merker = (roh.merker as Roh[]).filter((m) => stueck(m.stueckId as string));
  const lzIds = new Set([...lesezeichen.map((l) => l.id), ...(vorhanden.lesezeichen ?? [])]);
  let eintraegeWeg = 0;
  const setlisten = (roh.setlisten as Roh[]).map((sl) => {
    const alle = sl.eintraege as Roh[];
    const bleiben = alle.filter((e) => (e.art === 'stueck' ? stueck(e.stueckId as string)
      : e.art === 'lesezeichen' ? lzIds.has(e.lesezeichenId as string) : true));
    eintraegeWeg += alle.length - bleiben.length;
    return bleiben.length === alle.length ? sl : { ...sl, eintraege: bleiben };
  });

  const zaehlen = (ids: Iterable<string>, da: ReadonlySet<string> = new Set()) => [...ids].filter((id) => da.has(id)).length;
  const ids = (l: Roh[]) => new Set(l.map((e) => e.id));
  const noten = zaehlen(stueckIds, vorhanden.noten);
  return {
    noten: inhalt.noten,
    stellen,
    anmerkungen,
    neu: stueckIds.size - noten,
    ueberschrieben: {
      noten,
      stellen: zaehlen(ids(stellen), vorhanden.stellen),
      anmerkungen: zaehlen(ids(anmerkungen), vorhanden.anmerkungen),
    },
    uebersprungen: inhalt.stellen.length - stellen.length + inhalt.anmerkungen.length - anmerkungen.length
      + roh.virtuelle.length - virtuelle.length + roh.lesezeichen.length - lesezeichen.length
      + roh.merker.length - merker.length + eintraegeWeg,
    zusatz: { virtuelle, lesezeichen, merker, setlisten },
    ersetzt: {
      lesezeichen: zaehlen(ids(lesezeichen), vorhanden.lesezeichen),
      merker: zaehlen(ids(merker), vorhanden.merker),
      setlisten: zaehlen(ids(setlisten), vorhanden.setlisten),
    },
  };
}

// Ob das Einspielen etwas auf dem Gerät überschreibt und deshalb nachfragt.
export const ueberschreibt = (p: Pick<Einspielplan<unknown>, 'ueberschrieben'> & Partial<Pick<Einspielplan<unknown>, 'ersetzt'>>) =>
  p.ueberschrieben.noten + p.ueberschrieben.stellen + p.ueberschrieben.anmerkungen
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

// Stelle: Titel, Notiz, Zieltempo und Rahmen aus der Sicherung, Tempi vereinigt.
export function stelleZusammenfuehren<S extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: S): S {
  if (!geraet) return sicherung;
  return { ...geraet, ...sicherung, tempi: tempiVereinigen(liste(geraet.tempi) as Tempo[], liste(sicherung.tempi) as Tempo[]) };
}

// Seite mit Anmerkungen: Striche und Texte nach ihrer id vereinigen. Was es auf
// beiden Seiten gibt, kommt aus der Sicherung und bleibt an seinem Platz; was
// nur in der Sicherung ist, kommt dahinter (darüber gezeichnet).
export function seiteZusammenfuehren<A extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: A): A {
  if (!geraet) return sicherung;
  const id = (o: unknown) => (istObjekt(o) && typeof o.id === 'string' ? o.id : null);
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
  return { ...geraet, ...sicherung, objekte };
}

// Noten: alles aus der Sicherung (auch die Datei), aber der Dateiverweis des
// Geräts bleibt — er lässt sich nicht übertragen und gehört zu diesem Gerät.
export function notenZusammenfuehren<N extends Record<string, unknown>>(geraet: Record<string, unknown> | undefined, sicherung: N): N {
  const { handle: _fremd, ...rest } = sicherung;
  void _fremd;
  if (!geraet) return rest as N;
  return { ...geraet, ...rest, ...(geraet.handle !== undefined ? { handle: geraet.handle } : {}) } as N;
}

// Text der Rückfrage. `datum` ist der lesbare Zeitpunkt der Sicherung oder null.
export function rueckfrage(
  p: Pick<Einspielplan<unknown>, 'ueberschrieben' | 'uebersprungen'> & Partial<Pick<Einspielplan<unknown>, 'ersetzt'>>,
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
  return `${datum ? `Die Sicherung vom ${datum}` : 'Die Sicherung (Datum unbekannt)'} aktualisiert auf diesem Gerät ${was}. `
    + 'Titel, Notizen, Rahmen, PDF-Dateien und Blättermodus kommen aus der Sicherung. '
    + 'Tempo-Verläufe und Striche werden zusammengeführt; Striche, die hier seit der Sicherung wegradiert wurden, erscheinen wieder.'
    + (e.setlisten ? ' Setlisten kommen ganz aus der Sicherung, samt Reihenfolge.' : '')
    + (p.uebersprungen ? ` ${n(p.uebersprungen, 'Eintrag', 'Einträge')} ohne zugehörige Noten ${p.uebersprungen === 1 ? 'wird' : 'werden'} übersprungen.` : '')
    + ' Laden?';
}
