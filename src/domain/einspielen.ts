// Prüft den Inhalt einer gelesenen Übe-Sicherung, bevor etwas auf dem Gerät
// landet, und plant das Einspielen: was neu ist, was überschrieben wird, was
// übersprungen wird. Rein, getestet. Das Dateiformat selbst steht in
// ./sicherung (Vertrag mit registerfuehrer, hier nicht angefasst).
//
// Einspielen führt zusammen statt zu ersetzen, und zwar ohne Verlust: Was es
// nur auf dem Gerät gibt, bleibt. Bei gleicher id kommen Titel, Notizen und
// Rahmen aus der Sicherung, aber Tempo-Verläufe und Striche werden vereinigt
// (siehe stelleZusammenfuehren, seiteZusammenfuehren, notenZusammenfuehren).
import { SicherungsFehler } from './sicherung';

export interface Zugeordnet { id: string; notenId: string }

// Die ids, die schon auf dem Gerät liegen, je Speicher.
export interface Vorhanden {
  noten: ReadonlySet<string>;
  stellen: ReadonlySet<string>;
  anmerkungen: ReadonlySet<string>;
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

export function einspielenPlanen<N extends { id: string }>(
  inhalt: { noten: N[]; stellen: unknown[]; anmerkungen: unknown[] },
  vorhanden: Vorhanden,
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istStelle)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istSeite)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');

  const inSicherung = new Set(inhalt.noten.map((n) => n.id));
  const bekannt = (e: Zugeordnet) => inSicherung.has(e.notenId) || vorhanden.noten.has(e.notenId);
  const stellen = (inhalt.stellen as (Zugeordnet & Record<string, unknown>)[]).filter(bekannt);
  const anmerkungen = (inhalt.anmerkungen as (Zugeordnet & Record<string, unknown>)[]).filter(bekannt);
  const zaehlen = (ids: Iterable<string>, da: ReadonlySet<string>) => [...ids].filter((id) => da.has(id)).length;
  const noten = zaehlen(inSicherung, vorhanden.noten);
  return {
    noten: inhalt.noten,
    stellen,
    anmerkungen,
    neu: inSicherung.size - noten,
    ueberschrieben: {
      noten,
      stellen: zaehlen(new Set(stellen.map((s) => s.id)), vorhanden.stellen),
      anmerkungen: zaehlen(new Set(anmerkungen.map((a) => a.id)), vorhanden.anmerkungen),
    },
    uebersprungen: inhalt.stellen.length - stellen.length + inhalt.anmerkungen.length - anmerkungen.length,
  };
}

// Ob das Einspielen etwas auf dem Gerät überschreibt und deshalb nachfragt.
export const ueberschreibt = (p: Pick<Einspielplan<unknown>, 'ueberschrieben'>) =>
  p.ueberschrieben.noten + p.ueberschrieben.stellen + p.ueberschrieben.anmerkungen > 0;

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
export function rueckfrage(p: Pick<Einspielplan<unknown>, 'ueberschrieben' | 'uebersprungen'>, datum: string | null): string {
  const u = p.ueberschrieben;
  const n = (z: number, eins: string, mehr: string) => `${z} ${z === 1 ? eins : mehr}`;
  return `${datum ? `Die Sicherung vom ${datum}` : 'Die Sicherung (Datum unbekannt)'} aktualisiert auf diesem Gerät `
    + `${n(u.noten, 'Noten', 'Noten')}, ${n(u.stellen, 'Stelle', 'Stellen')} und ${n(u.anmerkungen, 'Seite', 'Seiten')} mit Anmerkungen. `
    + 'Tempo-Verläufe und Striche werden zusammengeführt, nichts geht verloren; Titel, Notizen und Rahmen kommen aus der Sicherung.'
    + (p.uebersprungen ? ` ${n(p.uebersprungen, 'Eintrag', 'Einträge')} ohne zugehörige Noten ${p.uebersprungen === 1 ? 'wird' : 'werden'} übersprungen.` : '')
    + ' Laden?';
}
