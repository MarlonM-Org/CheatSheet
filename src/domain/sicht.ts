// Die Sicht auf ein Stück (F-03): Ein virtuelles Stück zeigt die Seiten
// von–bis aus der PDF seiner Quelle und zählt sie ab 1. Stellen, Anmerkungen,
// Lesezeichen und Merker liegen in Seiten der PDF (docs/datenmodell.md) —
// hier werden sie in die Sicht umgerechnet und zurück. Rein, getestet.
import { ablage, type Lesezeichen, type Quelle, type Stueck } from './bestand';

type Sicht = Pick<Stueck, 'id' | 'quelle'>;

// Wie viele Seiten das Stück zeigt — ein virtuelles höchstens bis zum Ende der PDF.
export function seitenInSicht(s: Pick<Stueck, 'quelle'>, pdfSeiten: number): number {
  if (!s.quelle) return pdfSeiten;
  return Math.max(0, Math.min(s.quelle.bis, pdfSeiten) - s.quelle.von + 1);
}

// Seite der PDF → Seite in der Sicht; null, wenn sie nicht gezeigt wird.
export function zurSicht(s: Pick<Stueck, 'quelle'>, pdfSeite: number): number | null {
  if (!s.quelle) return pdfSeite;
  if (pdfSeite < s.quelle.von || pdfSeite > s.quelle.bis) return null;
  return pdfSeite - s.quelle.von + 1;
}

// Seite in der Sicht → Seite der PDF (bei der Quelle).
export const zurPdf = (s: Sicht, seite: number) => ablage(s, seite).seite;

// Einträge mit PDF-Seiten (Stellen, Anmerkungen, Lesezeichen, Merker) in die
// Sicht: nur die gezeigten, mit umgerechneter Seite, Reihenfolge bleibt.
export function inSicht<T extends { seite: number }>(s: Pick<Stueck, 'quelle'>, liste: readonly T[]): T[] {
  const r: T[] = [];
  for (const e of liste) {
    const seite = zurSicht(s, e.seite);
    if (seite !== null) r.push(seite === e.seite ? e : { ...e, seite });
  }
  return r;
}

// Welche Stücke eine Stelle (oder Anmerkung) der PDF-Seite zeigen: die Quelle
// selbst und jedes virtuelle Stück, dessen Bereich die Seite enthält.
export function stueckeMitSeite(stuecke: readonly Pick<Stueck, 'id' | 'quelle'>[], stueckId: string, seite: number): string[] {
  return stuecke
    .filter((s) => s.id === stueckId || (s.quelle?.stueckId === stueckId && zurSicht(s, seite) !== null))
    .map((s) => s.id);
}

// Stellen je Stück zählen — ein virtuelles zählt die der Quelle in seinem Bereich.
export function stellenJeStueck(stuecke: readonly Pick<Stueck, 'id' | 'quelle'>[], stellen: readonly { stueckId: string; seite: number }[]): Record<string, number> {
  const je: Record<string, number> = {};
  for (const st of stellen) for (const id of stueckeMitSeite(stuecke, st.stueckId, st.seite)) je[id] = (je[id] ?? 0) + 1;
  return je;
}

// ── Bereich für ein neues virtuelles Stück ──

// Aus Eingaben (Text) einen Bereich innerhalb der PDF machen — oder der Grund,
// warum nicht. `pdfSeiten` ist die Zahl der Seiten der Quelle.
export function bereichLesen(vonText: string, bisText: string, pdfSeiten: number): { von: number; bis: number } | string {
  const von = Number(vonText.trim()), bis = Number(bisText.trim() || vonText.trim());
  if (!Number.isInteger(von) || !Number.isInteger(bis)) return 'Bitte ganze Seitenzahlen eingeben.';
  if (von < 1 || bis > pdfSeiten) return `Die PDF hat ${pdfSeiten === 1 ? 'nur 1 Seite' : `die Seiten 1 bis ${pdfSeiten}`}.`;
  if (bis < von) return 'Die letzte Seite liegt vor der ersten.';
  if (von === 1 && bis === pdfSeiten) return 'Das wären alle Seiten — dafür braucht es kein eigenes Stück.';
  return { von, bis };
}

// Je Lesezeichen ein Stück: vom Lesezeichen bis vor das nächste, das letzte
// bis zum Ende der PDF. Lesezeichen auf derselben Seite ergeben nur eines
// (das erste); eines außerhalb der PDF entfällt. Schon vorhandene virtuelle
// Stücke mit genau diesem Bereich werden übersprungen.
export function stueckeAusLesezeichen(
  lesezeichen: readonly Pick<Lesezeichen, 'seite' | 'titel'>[], pdfSeiten: number, vorhandene: readonly Quelle[] = [],
): { titel: string; von: number; bis: number }[] {
  const sortiert = [...lesezeichen].filter((l) => l.seite >= 1 && l.seite <= pdfSeiten).sort((a, b) => a.seite - b.seite);
  const r: { titel: string; von: number; bis: number }[] = [];
  for (let i = 0; i < sortiert.length; i++) {
    const l = sortiert[i];
    if (i > 0 && sortiert[i - 1].seite === l.seite) continue;
    const naechste = sortiert.slice(i + 1).find((n) => n.seite > l.seite);
    const bis = naechste ? naechste.seite - 1 : pdfSeiten;
    if (vorhandene.some((q) => q.von === l.seite && q.bis === bis)) continue;
    r.push({ titel: l.titel.trim() || `Seite ${l.seite}`, von: l.seite, bis });
  }
  return r;
}

// ── Inhaltsverzeichnis der PDF ──

export interface Gliederungspunkt { titel: string; seite: number }

// Welche Punkte des Inhaltsverzeichnisses noch kein Lesezeichen sind: gleiche
// Seite und gleicher Titel gelten als vorhanden; Punkte ohne Seite oder
// außerhalb der PDF entfallen; doppelte Punkte einmal.
export function neueLesezeichen(gliederung: readonly Gliederungspunkt[], vorhandene: readonly Pick<Lesezeichen, 'seite' | 'titel'>[], pdfSeiten: number): Gliederungspunkt[] {
  const da = new Set(vorhandene.map((l) => `${l.seite}\u0000${l.titel.trim().toLowerCase()}`));
  const r: Gliederungspunkt[] = [];
  for (const g of gliederung) {
    const titel = g.titel.trim();
    if (!titel || !Number.isInteger(g.seite) || g.seite < 1 || g.seite > pdfSeiten) continue;
    const key = `${g.seite}\u0000${titel.toLowerCase()}`;
    if (da.has(key)) continue;
    da.add(key);
    r.push({ titel, seite: g.seite });
  }
  return r;
}

// Beschreibung eines virtuellen Stücks für die Bibliothek: „Seiten 3–5 aus „Band““.
export function quellenText(q: Quelle, quellTitel: string | undefined): string {
  const seiten = q.von === q.bis ? `Seite ${q.von}` : `Seiten ${q.von}–${q.bis}`;
  return quellTitel ? `${seiten} aus „${quellTitel}“` : seiten;
}
