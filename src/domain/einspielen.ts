// Prüft den Inhalt einer gelesenen Übe-Sicherung, bevor etwas auf dem Gerät
// landet, und plant das Einspielen: was neu ist, was überschrieben wird, was
// übersprungen wird. Rein, getestet. Das Dateiformat selbst steht in
// ./sicherung (Vertrag mit registerfuehrer, hier nicht angefasst).
//
// Einspielen führt zusammen statt zu ersetzen: Bei gleicher id gewinnt die
// Sicherung; Stellen und Anmerkungen, die es nur auf dem Gerät gibt, bleiben.
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
  // Was auf dem Gerät überschrieben würde (gleiche id) — Anlass der Rückfrage.
  // ueberschrieben.noten sind zugleich die aktualisierten Noten.
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

export function einspielenPlanen<N extends { id: string }>(
  inhalt: { noten: N[]; stellen: unknown[]; anmerkungen: unknown[] },
  vorhanden: Vorhanden,
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istZugeordnet)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istZugeordnet)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');

  const inSicherung = new Set(inhalt.noten.map((n) => n.id));
  const bekannt = (e: Zugeordnet) => inSicherung.has(e.notenId) || vorhanden.noten.has(e.notenId);
  const stellen = inhalt.stellen.filter(bekannt);
  const anmerkungen = inhalt.anmerkungen.filter(bekannt);
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
