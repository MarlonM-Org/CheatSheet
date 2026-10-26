// Der Bestand auf dem Gerät (Datenbank „cheatsheet“, docs/datenmodell.md):
// Stücke mit ihrer PDF, Stellen, Anmerkungen je Seite, Lesezeichen, Merker
// und Setlisten. Hier stehen die Typen und die Regeln, die nicht vom
// Gerätespeicher abhängen — rein, getestet.
import type { Ausschnitte } from './ausschnitt';
import type { Anmerkung, Blaettern } from './notenpult';
import type { Sprung } from './spruenge';

export interface Stueck {
  id: string; titel: string; stimme: string; erstellt: number;
  aktualisiert?: number;
  dateiname?: string;
  // Nur Chrome/Edge am Rechner: Verweis auf die Datei, um ohne Dateiauswahl neu zu laden.
  handle?: FileSystemFileHandle;
  // Blättern: Modus für alle Seiten, Abweichungen und Linien je Seite (F-06, F-16).
  blaettern?: Blaettern;
  // Angezeigter Bereich je Seite (Anteile der Seite); ohne Eintrag die ganze Seite.
  ausschnitte?: Ausschnitte;
  // Sprünge (F-05): Wiederholung, D.S., D.C., Coda — vom Sprungzeichen zur Einstiegsstelle.
  spruenge?: Sprung[];
  // „Zuletzt geöffnet“ liegt im localStorage; ältere Datensätze (über die
  // Sicherung aus „ueben“) tragen es noch hier (zuletztAus in ./speicher).
  zuletzt?: number;
  // Größe der PDF in Bytes (erkennt Doppelte beim Ordner-Import).
  groesse?: number;
  // Letzte Änderung: Beim Laden einer Sicherung gilt der neuere Stand.
  geaendert?: number;
  // Sammlungen (F-13): Namen, ein Stück kann in mehreren sein.
  sammlungen?: string[];
  // Tags (F-14): ids der Tag-Definitionen (@/domain/tags, im localStorage).
  tags?: string[];
  // Metadaten (F-01)
  komponist?: string; genre?: string; tonart?: string;
  schwierigkeit?: 1 | 2 | 3 | 4 | 5; kennung?: string;
  // Virtuelles Stück (F-03): die Seiten von–bis aus der PDF eines echten Stücks.
  quelle?: Quelle;
  // Selbst geschrieben oder eingesungen (G-01…G-03): die Quelle, aus der die
  // PDF in `dateien` gerendert wurde — nur damit lässt es sich wieder bearbeiten.
  notation?: Notation;
  // Eigene Aufnahmen beim Üben (G-09): nur die Angaben; die Audio-Bytes
  // liegen in `dateien` unter der id der Aufnahme. Reisen nicht mit der
  // Sicherung (zu groß), bleiben auf dem Gerät.
  aufnahmen?: Aufnahme[];
}
// Eine Aufnahme: wann, wie lang (Sekunden), Audio-Typ (audio/mp4, audio/webm),
// auf welcher Seite bzw. bei welcher Stelle sie entstand, optional ein Name.
export interface Aufnahme { id: string; am: number; dauer: number; typ: string; seite?: number; stelleId?: string; titel?: string }
export interface Quelle { stueckId: string; von: number; bis: number }
// `art`: wie das Stück entstand — getippt, live eingesungen oder aus einer Audio-Datei.
export interface Notation { format: 'abc'; text: string; art: 'geschrieben' | 'eingesungen' | 'audio' }

export interface Stelle {
  id: string; stueckId: string; seite: number; x: number; y: number; b: number; h: number;
  titel: string; notiz: string; zielTempo: number | null; tempi: { tempo: number; am: number }[];
  // Favorit (★): für den Stellen-Mix „nur Favoriten“. Abgewählt bleibt `false` stehen.
  favorit?: boolean;
  geaendert?: number;
}
// entfernt: ids weg-radierter Striche — damit sie beim Laden einer Sicherung
// nicht zurückkehren.
export interface SeitenAnmerkungen {
  id: string; stueckId: string; seite: number; objekte: Anmerkung[]; entfernt?: string[]; geaendert?: number;
}
export interface Lesezeichen { id: string; stueckId: string; seite: number; titel: string; erstellt: number; geaendert?: number }
export interface Merker { id: string; stueckId: string; seite: number; gesetzt: number; geaendert?: number }

export type Eintrag =
  | { id: string; art: 'stueck'; stueckId: string }
  | { id: string; art: 'lesezeichen'; lesezeichenId: string }
  // Gewollt leerer Platz („spiele ich auswendig“) — nie der Rest eines gelöschten Stücks.
  | { id: string; art: 'platzhalter'; titel: string };
export interface Setliste { id: string; titel: string; erstellt: number; aktualisiert?: number; geaendert?: number; eintraege: Eintrag[] }

// Anmerkungen und Merker: ein Datensatz je Seite.
export const seitenId = (stueckId: string, seite: number) => `${stueckId}:${seite}`;

export const istVirtuell = (s: Pick<Stueck, 'quelle'>) => s.quelle !== undefined;

// Wo die Stellen und Anmerkungen einer Seite liegen. Ein virtuelles Stück
// teilt sie mit seiner Quelle: Seite 1 des virtuellen ist Seite `von` der
// PDF, und gespeichert wird unter der Quelle mit der Seite der PDF.
export function ablage(s: Pick<Stueck, 'id' | 'quelle'>, seite: number): { stueckId: string; seite: number } {
  return s.quelle ? { stueckId: s.quelle.stueckId, seite: s.quelle.von + seite - 1 } : { stueckId: s.id, seite };
}

// Die PDF eines Stücks liegt in „dateien“ unter dieser id.
export const dateiVon = (s: Pick<Stueck, 'id' | 'quelle'>) => s.quelle?.stueckId ?? s.id;

// Taugt die Quelle für ein virtuelles Stück? Sie muss ein echtes Stück sein
// (keine Ketten), der Bereich ganze Seiten ab 1, nicht rückwärts. Liefert den
// Grund oder null.
export function quelleFehler(q: unknown, quellStueck: Pick<Stueck, 'quelle'> | undefined): string | null {
  if (typeof q !== 'object' || q === null) return 'Die Quelle fehlt.';
  const { stueckId, von, bis } = q as Record<string, unknown>;
  if (typeof stueckId !== 'string') return 'Die Quelle fehlt.';
  if (!Number.isInteger(von) || !Number.isInteger(bis) || (von as number) < 1 || (bis as number) < (von as number)) {
    return 'Der Seitenbereich ist ungültig.';
  }
  if (!quellStueck) return 'Das Stück, aus dem die Seiten kommen, gibt es nicht.';
  if (istVirtuell(quellStueck)) return 'Die Seiten müssen aus einem Stück mit eigener PDF kommen.';
  return null;
}

// ── Löschen ──

export interface Loeschbestand {
  stuecke: Pick<Stueck, 'id' | 'titel' | 'quelle'>[];
  lesezeichen: Pick<Lesezeichen, 'id' | 'stueckId'>[];
  merker: Pick<Merker, 'id' | 'stueckId'>[];
  setlisten: Setliste[];
}

export interface Loeschfolgen {
  // Alle zu löschenden Stücke: die gewählten und die virtuellen aus ihnen.
  stuecke: string[];
  lesezeichen: string[];
  merker: string[];
  // Setlisten, aus denen Einträge verschwinden, schon ohne sie.
  setlisten: Setliste[];
  // Für die Rückfrage: virtuelle Stücke, die mit wegfallen (Titel), und die
  // betroffenen Setlisten (Titel).
  virtuelleTitel: string[];
  setlistenTitel: string[];
}

// Was das Löschen der Stücke `ids` alles mitnimmt. Virtuelle Stücke aus einer
// gelöschten Quelle fallen mit weg; Lesezeichen und Merker gehören zum
// Stück; Setlisten-Einträge auf gelöschte Stücke oder Lesezeichen werden
// entfernt (keine Platzhalter: die wären von gewollten nicht zu unterscheiden).
// Stellen, Anmerkungen und Dateien hängen per stueckId und sind Sache des
// Speichers.
export function loeschFolgen(ids: readonly string[], b: Loeschbestand, jetzt: number): Loeschfolgen {
  const gewaehlt = new Set(ids);
  const virtuelle = b.stuecke.filter((s) => s.quelle && gewaehlt.has(s.quelle.stueckId) && !gewaehlt.has(s.id));
  const weg = new Set([...gewaehlt, ...virtuelle.map((s) => s.id)]);
  const lesezeichen = b.lesezeichen.filter((l) => weg.has(l.stueckId)).map((l) => l.id);
  const lzWeg = new Set(lesezeichen);
  const setlisten = setlistenOhne(b.setlisten, weg, lzWeg, jetzt);
  return {
    stuecke: [...weg],
    lesezeichen,
    merker: b.merker.filter((m) => weg.has(m.stueckId)).map((m) => m.id),
    setlisten,
    virtuelleTitel: virtuelle.map((s) => s.titel),
    setlistenTitel: setlisten.map((s) => s.titel),
  };
}

// Setlisten ohne Einträge auf die genannten Stücke und Lesezeichen — nur
// die, die sich dadurch ändern. Die übrigen Einträge behalten ihre Reihenfolge.
export function setlistenOhne(
  setlisten: readonly Setliste[], stuecke: ReadonlySet<string>, lesezeichen: ReadonlySet<string>, jetzt: number,
): Setliste[] {
  const raus = (e: Eintrag) => (e.art === 'stueck' && stuecke.has(e.stueckId))
    || (e.art === 'lesezeichen' && lesezeichen.has(e.lesezeichenId));
  return setlisten
    .filter((s) => s.eintraege.some(raus))
    .map((s) => ({ ...s, eintraege: s.eintraege.filter((e) => !raus(e)), aktualisiert: jetzt, geaendert: jetzt }));
}

// Zusatz zur Rückfrage beim Löschen; leer, wenn nichts mitbetroffen ist.
export function loeschHinweis(f: Pick<Loeschfolgen, 'virtuelleTitel' | 'setlistenTitel'>): string {
  const liste = (t: string[]) => t.map((x) => `„${x}“`).join(', ');
  const teile: string[] = [];
  const v = f.virtuelleTitel.length;
  if (v) teile.push(`Damit ${v === 1 ? 'fällt' : 'fallen'} auch ${v === 1 ? '1 Stück' : `${v} Stücke`} daraus weg (${liste(f.virtuelleTitel)}).`);
  const s = f.setlistenTitel.length;
  if (s) teile.push(`${s === 1 ? 'Betroffen ist 1 Setliste' : `Betroffen sind ${s} Setlisten`} (${liste(f.setlistenTitel)}); die Einträge werden dort entfernt.`);
  return teile.join(' ');
}
