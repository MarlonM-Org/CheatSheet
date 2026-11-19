// Sammlungen (F-13): Jedes Stück trägt eine Liste von Namen („Orchester A“,
// „Märsche“ …). Eine Sammlung ist nur dieser Name — ein Stück kann in mehreren
// stecken und liegt trotzdem nur einmal auf dem Gerät. Eine Sammlung gibt es,
// solange ein Stück sie trägt. Rein und getestet.
import { nachTitel } from './notenpult';

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

// ── Reihenfolge der Sammlungen ──
export const REIHENFOLGE = 'ueben:sammlungen-reihenfolge';
// Aus dem Speicher: nur Namen, Unsinn wird leer.
export const reihenfolgeLesen = (roh: unknown): string[] => (Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : []);
// Persönlich (reist mit der Sicherung, `ueben:sammlungen-reihenfolge`): die
// Namen in der Reihenfolge, in der die Leiste sie zeigt. Was in der Liste
// fehlt (neue Sammlungen, aus einem Ordner übernommene), kommt dahinter in
// der Reihenfolge der Übersicht (A–Z); was es nicht mehr gibt, stört nicht.
export function sammlungenOrdnen<T extends { name: string }>(liste: T[], reihenfolge: string[]): T[] {
  const vorn: T[] = [];
  for (const name of reihenfolge) {
    const da = liste.find((x) => gleich(x.name, name));
    if (da && !vorn.includes(da)) vorn.push(da);
  }
  return [...vorn, ...liste.filter((x) => !vorn.includes(x))];
}

// Eine Sammlung in der gezeigten Reihenfolge verschieben; zurück kommt die
// ganze neue Reihenfolge (zum Speichern). Unbekannter Name: unverändert.
export function reihenfolgeVerschieben(namen: string[], name: string, wohin: 'anfang' | 'vor' | 'zurueck' | 'ende'): string[] {
  const i = namen.findIndex((x) => gleich(x, name));
  if (i < 0) return namen;
  const ziel = wohin === 'anfang' ? 0 : wohin === 'ende' ? namen.length - 1 : wohin === 'vor' ? Math.max(0, i - 1) : Math.min(namen.length - 1, i + 1);
  if (ziel === i) return namen;
  const neu = [...namen];
  neu.splice(i, 1);
  neu.splice(ziel, 0, namen[i]);
  return neu;
}

// Nach dem Umbenennen behält die Sammlung ihren Platz. Gab es den neuen
// Namen schon (Zusammenlegen), bleibt dessen Platz, der alte fällt weg.
export function reihenfolgeUmbenennen(reihenfolge: string[], alt: string, neu: string): string[] {
  if (reihenfolge.some((x) => gleich(x, neu))) return reihenfolge.filter((x) => !gleich(x, alt));
  return reihenfolge.map((x) => (gleich(x, alt) ? neu : x));
}

// ── Stückauswahl nach Sammlungen (F-23) ──
// Wo Stücke zur Auswahl stehen, sind sie nach Sammlungen geordnet und
// durchsuchbar: je Sammlung eine Gruppe in der Reihenfolge der Bibliothek,
// darin A–Z wie in der Bibliothek (nachTitel), zuletzt „Ohne Sammlung“. Ein
// Stück in mehreren Sammlungen steht in jeder davon — dort, wo man es sucht,
// wie in der großen Ansicht (F-21) — und nennt die übrigen („auch“).
// Umschaltbar auf eine Liste A–Z (jedes Stück einmal) und eingrenzbar auf eine
// Sammlung oder auf „Ohne Sammlung“. Gezählt wird nur, was zur Wahl steht.

// Eingrenzung „Ohne Sammlung“: Eine Sammlung kann nicht leer heißen (sammlungName).
export const OHNE_SAMMLUNG = '';
export type WahlAnsicht = 'sammlungen' | 'abc';
/** null: alle; ein Name: nur diese Sammlung; OHNE_SAMMLUNG: nur Stücke ohne Sammlung. */
export type Eingrenzung = string | null;
type Waehlbar = { titel: string; stimme: string; sammlungen?: unknown; komponist?: unknown };
/** auch: die übrigen Sammlungen des Stücks (in der Gruppe „alle“: alle), Reihenfolge und Schreibweise der Übersicht. */
export interface WahlZeile<T> { stueck: T; auch: string[] }
/** art „sammlung“ mit ihrem Namen; „ohne“ und „alle“ (eine Liste ohne Gliederung) haben keinen. */
export interface WahlGruppe<T> { art: 'sammlung' | 'ohne' | 'alle'; name: string; zeilen: WahlZeile<T>[] }
export interface StueckAuswahl<T> {
  // Für die Chips: die Sammlungen aller wählbaren Stücke in der Reihenfolge der
  // Bibliothek — beim Suchen dieselben (nichts rückt), die Zahl nennt die Treffer.
  sammlungen: { name: string; anzahl: number }[];
  // Treffer ohne Sammlung; ohneDa: Gibt es unter den wählbaren überhaupt welche (Chip „Ohne Sammlung“)?
  ohne: number;
  ohneDa: boolean;
  // Die geltende Eingrenzung — was es unter den wählbaren Stücken nicht gibt, wird null.
  eingrenzung: Eingrenzung;
  gruppen: WahlGruppe<T>[];
  // Treffer unter allen wählbaren Stücken, unabhängig von der Eingrenzung (ohne Suche: alle).
  treffer: number;
}

// ── Suchen ── Titel, Stimme, Komponist; Groß/klein, Akzente und ß egal
// („marsch“ findet „Märsche“, „etude“ findet „Étude“). Mehrere Wörter müssen
// alle vorkommen, gleich in welchem Feld („blue 2“).
export const suchForm = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss');
export const suchWoerter = (suche: string) => suchForm(suche).split(/\s+/).filter(Boolean);
export function passtZurSuche(s: Waehlbar, woerter: readonly string[]): boolean {
  if (!woerter.length) return true;
  const text = suchForm([s.titel, s.stimme, typeof s.komponist === 'string' ? s.komponist : ''].join(' '));
  return woerter.every((w) => text.includes(w));
}

export function stueckAuswahl<T extends Waehlbar>(
  stuecke: readonly T[], reihenfolge: readonly string[], ansicht: WahlAnsicht, eingrenzung: Eingrenzung, suche = '',
): StueckAuswahl<T> {
  const woerter = suchWoerter(suche);
  const passend = woerter.length ? stuecke.filter((s) => passtZurSuche(s, woerter)) : stuecke;
  const alleSammlungen = sammlungenOrdnen(sammlungenUebersicht([...stuecke]), [...reihenfolge]);
  const namen = alleSammlungen.map((s) => s.name);
  // Sammlungen eines Stücks in der Schreibweise und Reihenfolge der Übersicht.
  const vonStueck = (s: T) => { const eigene = sammlungenVon(s); return namen.filter((n) => eigene.some((x) => gleich(x, n))); };
  const az = [...passend].sort(nachTitel);
  const ohneListe = az.filter((s) => sammlungenVon(s).length === 0);
  const ohneDa = stuecke.some((s) => sammlungenVon(s).length === 0);
  // Ob es die Eingrenzung gibt, entscheiden alle wählbaren Stücke, nicht die Treffer.
  const gilt: Eingrenzung = eingrenzung === OHNE_SAMMLUNG ? (ohneDa ? OHNE_SAMMLUNG : null)
    : eingrenzung === null ? null : namen.find((n) => gleich(n, eingrenzung)) ?? null;
  const gruppe = (name: string): WahlGruppe<T> => ({
    art: 'sammlung', name,
    zeilen: az.filter((s) => imFilter(s, name)).map((s) => ({ stueck: s, auch: vonStueck(s).filter((n) => n !== name) })),
  });
  const ohne: WahlGruppe<T> = { art: 'ohne', name: '', zeilen: ohneListe.map((s) => ({ stueck: s, auch: [] })) };
  let gruppen: WahlGruppe<T>[];
  if (gilt === OHNE_SAMMLUNG) gruppen = [ohne];
  else if (gilt !== null) gruppen = [gruppe(gilt)];
  else if (ansicht === 'abc' || !namen.length) gruppen = [{ art: 'alle', name: '', zeilen: az.map((s) => ({ stueck: s, auch: vonStueck(s) })) }];
  else gruppen = [...namen.map(gruppe), ohne];
  return {
    sammlungen: alleSammlungen.map((s) => ({ name: s.name, anzahl: woerter.length ? passend.filter((p) => imFilter(p, s.name)).length : s.anzahl })),
    ohne: ohneListe.length, ohneDa, eingrenzung: gilt,
    // Gruppen ohne Zeilen (beim Suchen) fallen weg — keine leeren Überschriften.
    gruppen: gruppen.filter((g) => g.zeilen.length > 0),
    treffer: passend.length,
  };
}

// Beim Öffnen einer Auswahl (Rückmeldung Marlon 2026-11-19): Sie beginnt
// immer bei der Sammlung, die gerade in der Bibliothek gewählt ist
// (`ueben:sammlung`) — keine eigene gemerkte Eingrenzung. Gemerkt am Gerät
// bleibt nur die Ansicht (`ueben:stueckwahl`, { ansicht }, für alle Auswahlen
// gemeinsam; reist nicht mit). Ein früher dort gemerktes `sammlung` zählt
// nicht mehr. Was es unter den wählbaren Stücken nicht gibt, wird „alle“;
// ebenso, wenn das gewählte Stück nicht in der Sammlung liegt — die Wahl
// bleibt sichtbar.
export function wahlStart<T extends Waehlbar & { id: string }>(gemerkt: unknown, bibliothek: string | null, stuecke: readonly T[], gewaehlt: string | null):
  { ansicht: WahlAnsicht; eingrenzung: Eingrenzung } {
  const g = gemerkt && typeof gemerkt === 'object' ? gemerkt as { ansicht?: unknown } : {};
  const ansicht: WahlAnsicht = g.ansicht === 'abc' ? 'abc' : 'sammlungen';
  // Eine leere Sammlung gibt es nicht: Auch die Bibliothek zeigt dann alle.
  let eingrenzung = bibliothek ? stueckAuswahl(stuecke, [], ansicht, bibliothek).eingrenzung : null;
  const stueck = gewaehlt === null ? undefined : stuecke.find((s) => s.id === gewaehlt);
  if (stueck && eingrenzung !== null && !imFilter(stueck, eingrenzung)) eingrenzung = null;
  return { ansicht, eingrenzung };
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
