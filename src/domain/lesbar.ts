// Vor dem Packen einer Sicherung: Nur Noten, deren PDF sich wirklich lesen
// lässt, kommen mit — wie in der Registerführer-App. Rein, getestet.
import type { SicherungsInhalt } from './sicherung';

// Liest den Anfang der Datei. Die Kennung „%PDF-“ darf wie bei PDF-Lesern
// üblich irgendwo in den ersten 1024 Bytes stehen — manche Programme schreiben
// einen Vorspann davor. Ein Blob, den der Browser nicht mehr lesen kann
// (Safari nach geschlossener Verbindung), zählt als nicht lesbar.
export async function pdfLesbar(datei: unknown): Promise<boolean> {
  if (!(datei instanceof Blob)) return false;
  try {
    return (await datei.slice(0, 1024).text()).includes('%PDF-');
  } catch {
    return false;
  }
}

// Nicht lesbare Noten samt ihren Stellen und Anmerkungen weglassen, statt die
// ganze Sicherung zu verwerfen. `fehlen` nennt die weggelassenen Noten.
export async function nurLesbare<
  N extends { id: string; datei: unknown },
  S extends { notenId: string },
  A extends { notenId: string },
>(bestand: SicherungsInhalt<N, S, A>): Promise<{ bestand: SicherungsInhalt<N, S, A>; fehlen: N[] }> {
  const pruefung = await Promise.all(bestand.noten.map((n) => pdfLesbar(n.datei)));
  const fehlen = bestand.noten.filter((_, i) => !pruefung[i]);
  if (!fehlen.length) return { bestand, fehlen };
  const weg = new Set(fehlen.map((n) => n.id));
  return {
    bestand: {
      noten: bestand.noten.filter((n) => !weg.has(n.id)),
      stellen: bestand.stellen.filter((s) => !weg.has(s.notenId)),
      anmerkungen: bestand.anmerkungen.filter((a) => !weg.has(a.notenId)),
    },
    fehlen,
  };
}
