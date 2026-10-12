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
