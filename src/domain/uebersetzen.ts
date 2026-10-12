// Zwischen Sicherung und Gerät übersetzen. Die Sicherung trägt Stellen und
// Anmerkungen im Zuschnitt der Registerführer-App (`notenId`, Vertrag), das
// Gerät im eigenen (`stueckId`). Alles andere reist unverändert. Rein,
// getestet.
import type { Eintrag, Lesezeichen, Merker, Setliste, Stueck } from './bestand';

function umbenennen<T extends Record<string, unknown>>(e: T, von: string, nach: string): Record<string, unknown> {
  const { [von]: wert, ...rest } = e;
  return { ...rest, [nach]: wert };
}

export const zurSicherung = <T extends { stueckId: string }>(e: T) =>
  umbenennen(e, 'stueckId', 'notenId') as Omit<T, 'stueckId'> & { notenId: string };
export const vonSicherung = <T extends { id: string; notenId: string }>(e: T) =>
  umbenennen(e, 'notenId', 'stueckId') as Record<string, unknown> & { id: string; stueckId: string };

export interface Zusatzbestand {
  virtuelle: Stueck[]; lesezeichen: Lesezeichen[]; merker: Merker[]; setlisten: Setliste[];
}

// Vor dem Packen: Echte Stücke ohne lesbare PDF bleiben draußen (nurLesbare).
// Was an ihnen hängt, auch — ihre virtuellen Stücke (die dann in `fehlen`
// mit genannt werden), Lesezeichen und Merker; Setlisten bleiben, ihnen
// fehlen nur diese Einträge.
export function ohneFehlende(z: Zusatzbestand, fehlen: ReadonlySet<string>): { zusatz: Zusatzbestand; fehlenVirtuelle: Stueck[] } {
  const fehlenVirtuelle = z.virtuelle.filter((v) => v.quelle && fehlen.has(v.quelle.stueckId));
  const weg = new Set([...fehlen, ...fehlenVirtuelle.map((v) => v.id)]);
  const lesezeichen = z.lesezeichen.filter((l) => !weg.has(l.stueckId));
  const lzDa = new Set(lesezeichen.map((l) => l.id));
  const bleibt = (e: Eintrag) => (e.art === 'stueck' ? !weg.has(e.stueckId) : e.art === 'lesezeichen' ? lzDa.has(e.lesezeichenId) : true);
  return {
    zusatz: {
      virtuelle: z.virtuelle.filter((v) => !weg.has(v.id)),
      lesezeichen,
      merker: z.merker.filter((m) => !weg.has(m.stueckId)),
      setlisten: z.setlisten.map((s) => (s.eintraege.every(bleibt) ? s : { ...s, eintraege: s.eintraege.filter(bleibt) })),
    },
    fehlenVirtuelle,
  };
}
