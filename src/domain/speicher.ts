// Fehler des Gerätespeichers (IndexedDB) einordnen.

const name = (x: unknown) =>
  x !== null && typeof x === 'object' && 'name' in x ? String((x as { name: unknown }).name) : '';

// Die Verbindung ist weg, nicht der Vorgang falsch: Safari kappt sie mitunter
// von selbst, vor allem nach der Rückkehr aus dem Hintergrund („Connection to
// Indexed Database server lost“ → UnknownError); auf einer geschlossenen
// Verbindung wirft jede Transaktion InvalidStateError. Ein abgebrochener
// Vorgang hat nichts geschrieben — ein neuer Versuch mit frischer Verbindung
// ist sicher.
export function verbindungVerloren(x: unknown): boolean {
  const n = name(x);
  return n === 'UnknownError' || n === 'InvalidStateError';
}

// Nur das ist „Gerätespeicher voll“ — alles andere darf nicht so heißen.
export function speicherVoll(x: unknown): boolean {
  return name(x) === 'QuotaExceededError';
}

// Die Datei hinter einem gespeicherten Stück ist nicht mehr lesbar (Safari:
// „The object can not be found here“). Retten lässt sie sich nur, indem man
// sie neu wählt — Stellen und Anmerkungen hängen nicht an ihr.
export function dateiVerloren(x: unknown): boolean {
  const n = name(x);
  return n === 'NotFoundError' || n === 'NotReadableError';
}

// „Zuletzt geöffnet“: der spätere Stand aus der Liste auf dem Gerät und dem
// älteren Feld im Datensatz (bis 2026-10-11 dort gespeichert).
export function zuletztAus(liste: Record<string, number>, n: { id: string; zuletzt?: number }): number | undefined {
  const t = Math.max(liste[n.id] ?? 0, n.zuletzt ?? 0);
  return t > 0 ? t : undefined;
}

// ── Dauerhafter Speicher (A-07) ── Die App bittet den Browser beim Start,
// ihre Daten vom Aufräumen bei Speichermangel auszunehmen
// (navigator.storage.persist). Was er antwortet, steht in den Einstellungen:
// null = die Anfrage gibt es in diesem Browser nicht.
export type SpeicherDauer = boolean | null;
export function speicherDauerText(d: SpeicherDauer): { kurz: string; lang: string } {
  if (d === true) return { kurz: 'Dauerhaft', lang: 'Der Browser hat zugesagt, die Daten beim Aufräumen zu behalten.' };
  if (d === false) return { kurz: 'Nicht zugesagt', lang: 'Der Browser kann die Daten bei Speichermangel oder nach langer Zeit ohne Nutzung löschen.' };
  return { kurz: 'Keine Angabe', lang: 'Dieser Browser kennt die Zusage nicht.' };
}
