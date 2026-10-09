// Vor dem Packen einer Sicherung: Nur Noten, deren PDF sich wirklich lesen
// lässt, kommen mit — wie in der Registerführer-App. Rein, getestet.
import type { SicherungsInhalt } from './sicherung';

// Prüft den Anfang der Datei und liest sie dann einmal ganz. Die Kennung
// „%PDF-“ darf wie bei PDF-Lesern üblich irgendwo in den ersten 1024 Bytes
// stehen — manche Programme schreiben einen Vorspann davor. Ein Blob, den der
// Browser nicht mehr (ganz) lesen kann — Safari nach geschlossener Verbindung,
// ein abgeschnittener Eintrag im Gerätespeicher —, zählt als nicht lesbar:
// Sonst bricht erst der Download der fertigen Sicherung ab, oder sie ist kaputt.
export async function pdfLesbar(datei: unknown): Promise<boolean> {
  if (!(datei instanceof Blob)) return false;
  try {
    return (await datei.slice(0, 1024).text()).includes('%PDF-') && await ganzLesbar(datei);
  } catch {
    return false;
  }
}

// Liest den Blob einmal komplett als Strom und zählt die Bytes gegen seine
// angegebene Größe. Der Inhalt wird nicht behalten — auch große PDFs brauchen
// dabei kaum Speicher.
export async function ganzLesbar(datei: Blob): Promise<boolean> {
  try {
    const leser = datei.stream().getReader();
    let bytes = 0;
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > datei.size) { await leser.cancel().catch(() => {}); return false; }
    }
    return bytes === datei.size;
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
  // Nacheinander: Jede Datei wird ganz gelesen, das soll ein iPad nicht für
  // alle Noten gleichzeitig tun.
  const fehlen: N[] = [];
  for (const n of bestand.noten) if (!(await pdfLesbar(n.datei))) fehlen.push(n);
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
