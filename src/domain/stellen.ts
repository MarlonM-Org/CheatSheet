// Stellen üben: welches Tempo gilt, und der Stellen-Mix (F-11). Rein, getestet.

export interface Tempo { tempo: number; am: number }

// Zuletzt (nach Datum) und am schnellsten geschafftes Tempo einer Stelle —
// null, solange noch keins geschafft ist. Beim gleichen Zeitpunkt gilt der
// später eingetragene.
export function tempoStand(tempi: Tempo[]): { zuletzt: number | null; bestes: number | null } {
  let zuletzt: Tempo | null = null;
  let bestes = 0;
  for (const t of tempi) {
    if (!zuletzt || t.am >= zuletzt.am) zuletzt = t;
    bestes = Math.max(bestes, t.tempo);
  }
  return { zuletzt: zuletzt?.tempo ?? null, bestes: bestes || null };
}

// ── Ziel und Tempo-Verlauf (F-12) ──

const TAG = 86_400_000;
const tagVon = (t: number) => new Date(t).setHours(0, 0, 0, 0);

// Je Übetag das schnellste geschaffte Tempo, dazu alle des Tages in ihrer
// Reihenfolge. Wer zum Aufwärmen langsamer einsteigt, zieht damit den Tag
// nicht herunter — die Kurve zeigt, was an dem Tag ging.
export function tagesbeste(tempi: Tempo[]): { tag: number; tempo: number; alle: number[] }[] {
  const tage = new Map<number, number[]>();
  for (const t of [...tempi].sort((a, b) => a.am - b.am)) {
    const tag = tagVon(t.am);
    const l = tage.get(tag);
    if (l) l.push(t.tempo); else tage.set(tag, [t.tempo]);
  }
  return [...tage].map(([tag, alle]) => ({ tag, tempo: Math.max(...alle), alle }));
}

// Wie viel schneller als vor `tage` Tagen? Verglichen wird das Beste bis
// heute mit dem Besten bis zur Grenze — Aufwärmen und schlechte Tage
// verfälschen nichts. Ist alles jünger, zählt der erste Übetag als
// Ausgangspunkt; bei nur einem Übetag gibt es nichts zu vergleichen.
export function steigerung(tempi: Tempo[], jetzt: number, tage = 21):
  { von: number; bis: number; prozent: number; seit: number; seitBeginn: boolean } | null {
  if (!tempi.length) return null;
  const bis = Math.max(...tempi.map((t) => t.tempo));
  const grenze = jetzt - tage * TAG;
  const frueher = tempi.filter((t) => t.am <= grenze);
  let von: number, seit: number, seitBeginn: boolean;
  if (frueher.length) {
    von = Math.max(...frueher.map((t) => t.tempo)); seit = grenze; seitBeginn = false;
  } else {
    const tb = tagesbeste(tempi);
    if (tb.length < 2) return null;
    von = tb[0].tempo; seit = tb[0].tag; seitBeginn = true;
  }
  return { von, bis, prozent: Math.round((bis / von - 1) * 100), seit, seitBeginn };
}

// Reserve über dem Ziel: Wer eine Stelle sicher können will, übt sie etwas
// schneller, als sie muss — falls es im Konzert flotter wird.
export const RESERVE = 0.1;
export const reserveVon = (ziel: number) => Math.round(ziel * (1 + RESERVE));

// Wie weit ist das Beste vom Ziel? offen → ziel (erreicht) → reserve (mit Reserve).
export function zielStand(bestes: number | null, ziel: number | null): { anteil: number; fehlt: number; stufe: 'offen' | 'ziel' | 'reserve' } | null {
  if (!ziel) return null;
  const b = bestes ?? 0;
  return { anteil: b / ziel, fehlt: Math.max(0, ziel - b), stufe: b >= reserveVon(ziel) ? 'reserve' : b >= ziel ? 'ziel' : 'offen' };
}

// Zieltempo aus einer Eingabe („120“, „♩ = 120“): Schläge pro Minute 20–400, sonst keins.
export function zielAusText(text: string): number | null {
  const z = Number(text.replace(/\D/g, ''));
  return z >= 20 && z <= 400 ? z : null;
}

// Senkrechte Achse der Tempo-Kurve: runde Striche (3–5), etwas Luft über dem
// Höchsten — mit Ziel und Reserve hat die Kurve so ihren Deckel.
export function tempoAchse(werte: number[]): { min: number; max: number; striche: number[] } {
  const lo = Math.min(...werte), hi = Math.max(...werte);
  const spanne = Math.max(hi - lo, 10);
  const schritt = [5, 10, 20, 25, 50, 100].find((s) => spanne / s <= 4) ?? 100;
  const luft = spanne * 0.05;
  const min = Math.max(0, Math.floor((lo - luft) / schritt) * schritt);
  const max = Math.ceil((hi + luft) / schritt) * schritt;
  const striche: number[] = [];
  for (let v = min; v <= max; v += schritt) striche.push(v);
  return { min, max, striche };
}

// ── Stellen-Mix ──
// Stellen aus allen Stücken in bunter Reihenfolge üben. Eine Runde enthält
// jede Stelle genau einmal — so bleibt keine liegen —, gemischt, und nach
// Möglichkeit nie zwei Stellen desselben Stücks hintereinander.

export interface MixStelle { id: string; notenId: string }
// pos zeigt auf die aktuelle Stelle; pos = reihe.length heißt: Runde geschafft.
export interface Runde { reihe: string[]; pos: number }

function durchmischen<T>(liste: T[], zufall: () => number): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

// Gemischte Reihenfolge der Stellen-ids. Schritt für Schritt kommt ein
// anderes Stück als zuletzt dran (davor: das Stück direkt vor dieser Reihe),
// zufällig, aber nach Zahl seiner offenen Stellen gewichtet — so verteilen
// sich große Stücke über die ganze Runde. Hat ein Stück mehr als die Hälfte
// der übrigen Stellen, muss es sofort dran, sonst stünden am Ende zwei seiner
// Stellen beieinander. Nur wenn es gar nicht anders geht (fast alles aus
// einem Stück), folgen Stellen desselben Stücks aufeinander.
export function mischen(stellen: MixStelle[], zufall: () => number = Math.random, davor: string | null = null): string[] {
  const stuecke = new Map<string, string[]>();
  for (const s of stellen) {
    const l = stuecke.get(s.notenId);
    if (l) l.push(s.id); else stuecke.set(s.notenId, [s.id]);
  }
  for (const l of stuecke.values()) durchmischen(l, zufall);

  const reihe: string[] = [];
  let rest = stellen.length;
  let vorher = davor;
  while (rest > 0) {
    const offen = [...stuecke].filter(([, l]) => l.length > 0);
    const andere = offen.filter(([n]) => n !== vorher);
    const groesstes = offen.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    let wahl: [string, string[]];
    if (!andere.length) wahl = offen[0];
    else if (groesstes[0] !== vorher && 2 * groesstes[1].length > rest) wahl = groesstes;
    else {
      let los = zufall() * andere.reduce((summe, [, l]) => summe + l.length, 0);
      wahl = andere.find(([, l]) => (los -= l.length) < 0) ?? andere[andere.length - 1];
    }
    reihe.push(wahl[1].pop()!);
    vorher = wahl[0];
    rest--;
  }
  return reihe;
}

// Bereich eines Mix: alle Stellen oder die einer Sammlung (F-13), auf Wunsch
// nur offene — die ihr Ziel samt Reserve noch nicht geschafft haben.
export interface MixBereich { sammlung: string | null; offen: boolean }

// Offen: noch kein Ziel gesetzt, oder Ziel + Reserve noch nicht geschafft.
export function stelleOffen(s: { zielTempo: number | null; tempi: Tempo[] }): boolean {
  if (!s.zielTempo) return true;
  return (tempoStand(s.tempi).bestes ?? 0) < reserveVon(s.zielTempo);
}

// Die Stellen eines Bereichs. `behalten`: schon geübte und die aktuelle Stelle
// der laufenden Runde — sie bleiben, auch wenn sie inzwischen geschafft sind,
// damit Zählung und Platz in der Runde nicht springen.
export function mixAuswahl<S extends MixStelle & { zielTempo: number | null; tempi: Tempo[] }>(
  stellen: S[], imBereich: (notenId: string) => boolean, nurOffen: boolean, behalten: ReadonlySet<string> = new Set(),
): S[] {
  return stellen.filter((s) => imBereich(s.notenId) && (behalten.has(s.id) || !nurOffen || stelleOffen(s)));
}

// Speicherplatz der Runde je Bereich; „alle“ behält den bisherigen.
export const mixSchluessel = (b: MixBereich) =>
  !b.sammlung && !b.offen ? 'ueben:mix' : `ueben:mix:${b.offen ? 'offen:' : ''}${b.sammlung ?? '*'}`;

// Gespeicherter Bereich des laufenden Mix (bis 2026-10-12 nur true/false).
export function mixBereichLesen(roh: unknown): MixBereich | null {
  if (roh === true) return { sammlung: null, offen: false };
  if (!roh || typeof roh !== 'object') return null;
  const { sammlung, offen } = roh as { sammlung?: unknown; offen?: unknown };
  return { sammlung: typeof sammlung === 'string' && sammlung ? sammlung : null, offen: offen === true };
}

export const neueRunde = (stellen: MixStelle[], zufall: () => number = Math.random): Runde =>
  ({ reihe: mischen(stellen, zufall), pos: 0 });

// Die Runde an den Bestand anpassen: Gelöschte fallen weg (ist die aktuelle
// weg, rückt die nächste an ihren Platz), neue kommen gemischt in den noch
// offenen Teil. Was schon dran war, bleibt vorn. Unverändert bleibt die
// Reihenfolge, wenn nichts neu ist.
export function rundeAbgleichen(r: Runde, stellen: MixStelle[], zufall: () => number = Math.random): Runde {
  const stueck = new Map(stellen.map((s) => [s.id, s.notenId]));
  const da = (id: string) => stueck.has(id);
  const gesehen = r.reihe.slice(0, r.pos).filter(da);
  const aktuell = r.reihe[r.pos];
  const vorne = aktuell !== undefined && da(aktuell) ? [...gesehen, aktuell] : gesehen;
  const offen = r.reihe.slice(r.pos + 1).filter(da);
  const bekannt = new Set(r.reihe);
  const neu = stellen.filter((s) => !bekannt.has(s.id));
  const rest = neu.length
    ? mischen([...offen.map((id) => ({ id, notenId: stueck.get(id)! })), ...neu], zufall, vorne.length ? stueck.get(vorne[vorne.length - 1])! : null)
    : offen;
  return { reihe: [...vorne, ...rest], pos: gesehen.length };
}

// Für die Bibliothek: wie viele Stellen aus wie vielen Stücken, wie viele in
// dieser Runde schon dran waren (und noch da sind).
export function rundeStand(r: Runde | null, stellen: MixStelle[]): { anzahl: number; stuecke: number; geuebt: number; fertig: boolean } {
  const ids = new Set(stellen.map((s) => s.id));
  const geuebt = r ? r.reihe.slice(0, r.pos).filter((id) => ids.has(id)).length : 0;
  return { anzahl: stellen.length, stuecke: new Set(stellen.map((s) => s.notenId)).size, geuebt, fertig: stellen.length > 0 && geuebt >= stellen.length };
}

// Gespeicherte Runde (localStorage) prüfen: Unstimmiges gilt als keine Runde.
export function rundeLesen(roh: unknown): Runde | null {
  if (!roh || typeof roh !== 'object') return null;
  const { reihe, pos } = roh as { reihe?: unknown; pos?: unknown };
  if (!Array.isArray(reihe) || !reihe.every((x) => typeof x === 'string')) return null;
  if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 0) return null;
  const einmal = [...new Set(reihe as string[])];
  return { reihe: einmal, pos: Math.min(pos, einmal.length) };
}
