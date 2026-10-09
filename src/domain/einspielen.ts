// Prüft den Inhalt einer gelesenen Übe-Sicherung, bevor etwas auf dem Gerät
// landet, und plant das Einspielen: was neu ist, was ersetzt wird, was
// übersprungen wird. Rein, getestet. Das Dateiformat selbst steht in
// ./sicherung (Vertrag mit registerfuehrer, hier nicht angefasst).
import { SicherungsFehler } from './sicherung';

export interface Zugeordnet { id: string; notenId: string }

export interface Einspielplan<N> {
  noten: N[];
  stellen: (Zugeordnet & Record<string, unknown>)[];
  anmerkungen: (Zugeordnet & Record<string, unknown>)[];
  neu: number;
  // Noten, die es schon auf dem Gerät gibt; sie werden samt Stellen und
  // Anmerkungen durch den Stand der Sicherung ersetzt.
  ersetzt: string[];
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
  vorhandeneNoten: ReadonlySet<string>,
): Einspielplan<N> {
  if (!inhalt.noten.every(istNote)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
  if (!inhalt.stellen.every(istZugeordnet)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle ungültig).');
  if (!inhalt.anmerkungen.every(istZugeordnet)) throw new SicherungsFehler('Die Sicherung ist beschädigt (Anmerkung ungültig).');

  const inSicherung = new Set(inhalt.noten.map((n) => n.id));
  const bekannt = (e: Zugeordnet) => inSicherung.has(e.notenId) || vorhandeneNoten.has(e.notenId);
  const stellen = inhalt.stellen.filter(bekannt);
  const anmerkungen = inhalt.anmerkungen.filter(bekannt);
  const ersetzt = [...inSicherung].filter((id) => vorhandeneNoten.has(id));
  return {
    noten: inhalt.noten,
    stellen,
    anmerkungen,
    neu: inSicherung.size - ersetzt.length,
    ersetzt,
    uebersprungen: inhalt.stellen.length - stellen.length + inhalt.anmerkungen.length - anmerkungen.length,
  };
}
