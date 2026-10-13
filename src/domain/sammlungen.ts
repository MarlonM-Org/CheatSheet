// Sammlungen (F-13): Jedes Stück trägt eine Liste von Namen („Orchester A“,
// „Märsche“ …). Eine Sammlung ist nur dieser Name — ein Stück kann in mehreren
// stecken und liegt trotzdem nur einmal auf dem Gerät. Eine Sammlung gibt es,
// solange ein Stück sie trägt. Rein und getestet.

const sammler = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const gleich = (a: string, b: string) => sammler.compare(a, b) === 0;
// Gleiche Sammlung? Groß/klein und Akzente egal („märsche“ = „Märsche“).
export const gleicheSammlung = gleich;
const TAG = 86_400_000;

// Name aus einer Eingabe: Leerraum geglättet, höchstens 40 Zeichen, leer = keiner.
export function sammlungName(text: string): string | null {
  const n = text.replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return n || null;
}

export function sammlungenVon(n: { sammlungen?: unknown }): string[] {
  return Array.isArray(n.sammlungen) ? n.sammlungen.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
}

export const mitSammlung = (liste: string[], name: string) => (liste.some((x) => gleich(x, name)) ? liste : [...liste, name]);
export const ohneSammlung = (liste: string[], name: string) => liste.filter((x) => !gleich(x, name));
export function sammlungUmbenennen(liste: string[], alt: string, neu: string): string[] {
  if (!liste.some((x) => gleich(x, alt))) return liste;
  const andere = liste.filter((x) => !gleich(x, alt));
  const vorhanden = andere.find((x) => gleich(x, neu));
  if (vorhanden) return andere;
  const i = liste.findIndex((x) => gleich(x, alt));
  const ergebnis = [...andere];
  ergebnis.splice(i, 0, neu);
  return ergebnis;
}

export const imFilter = (n: { sammlungen?: unknown }, sammlung: string | null) =>
  sammlung === null || sammlungenVon(n).some((x) => gleich(x, sammlung));

// Alle Sammlungen mit der Zahl ihrer Stücke, A–Z (Zahlen als Zahlen). Die
// erste Schreibweise gilt.
export function sammlungenUebersicht(noten: { sammlungen?: unknown }[]): { name: string; anzahl: number }[] {
  const je: { name: string; anzahl: number }[] = [];
  for (const n of noten) {
    for (const name of new Set(sammlungenVon(n))) {
      const da = je.find((x) => gleich(x.name, name));
      if (da) da.anzahl++; else je.push({ name, anzahl: 1 });
    }
  }
  return je.sort((a, b) => sammler.compare(a.name, b.name));
}

// ── Ordner übernehmen ──
// Pfad wie „Noten/Orchester A/Florentiner.pdf“ (relativ zum gewählten
// Ordner). Unterordner werden Sammlungen; der gewählte Ordner selbst nur,
// wenn die PDF direkt darin liegt.
export function sammlungenAusPfad(pfad: string): string[] {
  const ordner = pfad.split('/').slice(0, -1);
  const namen = (ordner.length > 1 ? ordner.slice(1) : ordner).map(sammlungName).filter((x): x is string => x !== null);
  return namen.reduce<string[]>(mitSammlung, []);
}

const dateiname = (pfad: string) => pfad.split('/').pop() ?? pfad;
// Dateinamen vergleichen: Groß/klein egal, gleiche Unicode-Form.
export const dateiSchluessel = (name: string) => name.normalize('NFC').toLowerCase();
const schluessel = dateiSchluessel;

// Plan für die PDFs eines Ordners: Was schon in der Bibliothek liegt (gleicher
// Dateiname und gleiche Größe), wird nur einsortiert — keine zweite Kopie.
// Dieselbe Datei in mehreren Unterordnern wird EIN Stück in mehreren
// Sammlungen. Gleicher Name mit anderer Größe (etwa „Klarinette 1.pdf“ in
// jedem Stück-Ordner) sind verschiedene Stücke. `aktiv`: die gerade gewählte
// Sammlung, wenn neue Stücke dort einsortiert werden sollen.
export function ordnerPlanen(
  dateien: { pfad: string; groesse: number }[],
  vorhanden: { id: string; dateiname?: string; groesse?: number }[],
  aktiv: string | null = null,
): {
  neu: { index: number; name: string; sammlungen: string[] }[];
  bekannt: { notenId: string; sammlungen: string[] }[];
  doppelt: number;
  ohnePdf: number;
} {
  const gruppen = new Map<string, { index: number; name: string; groesse: number; sammlungen: string[] }>();
  let doppelt = 0, ohnePdf = 0;
  dateien.forEach((d, index) => {
    const name = dateiname(d.pfad);
    if (!/\.pdf$/i.test(name)) { ohnePdf++; return; }
    const k = `${schluessel(name)}|${d.groesse}`;
    const da = gruppen.get(k);
    const sammlungen = sammlungenAusPfad(d.pfad);
    if (da) { doppelt++; da.sammlungen = sammlungen.reduce(mitSammlung, da.sammlungen); }
    else gruppen.set(k, { index, name, groesse: d.groesse, sammlungen });
  });
  const neu: { index: number; name: string; sammlungen: string[] }[] = [];
  const bekannt: { notenId: string; sammlungen: string[] }[] = [];
  for (const g of gruppen.values()) {
    const sammlungen = aktiv ? mitSammlung(g.sammlungen, aktiv) : g.sammlungen;
    const treffer = vorhanden.find((n) => n.dateiname && schluessel(n.dateiname) === schluessel(g.name) && n.groesse === g.groesse);
    if (treffer) bekannt.push({ notenId: treffer.id, sammlungen });
    else neu.push({ index: g.index, name: g.name, sammlungen });
  }
  return { neu, bekannt, doppelt, ohnePdf };
}

// ── Erinnerung an die Sicherung (H-01) ──
// Fällig, wenn die letzte Sicherung länger als 7 Tage her ist und sich seitdem
// etwas geändert hat — oder, noch nie gesichert, die ersten Noten älter als 7
// Tage sind. tage: wie lange die letzte Sicherung her ist.
export function sicherungFaellig(letzte: number | null, letzteAenderung: number, ersteDaten: number | null, jetzt: number):
  { faellig: boolean; tage: number | null } {
  if (letzte === null) return { faellig: ersteDaten !== null && jetzt - ersteDaten > 7 * TAG && letzteAenderung > 0, tage: null };
  const tage = Math.floor((jetzt - letzte) / TAG);
  return { faellig: jetzt - letzte > 7 * TAG && letzteAenderung > letzte, tage };
}
