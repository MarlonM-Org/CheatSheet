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

// Die PDF-Datei eines Stücks liegt seit Schema 3 als reine Bytes im eigenen
// Speicher „dateien“ — Safari verliert Blobs in IndexedDB mitunter. Ältere
// Stücke tragen sie noch als Blob im Datensatz, bis sie umziehen.
export function dateiQuelle(eintrag: unknown, n: { datei?: unknown }): 'dateien' | 'datensatz' | 'keine' {
  if (eintrag && typeof eintrag === 'object' && (eintrag as { daten?: unknown }).daten instanceof ArrayBuffer) return 'dateien';
  return n.datei instanceof Blob ? 'datensatz' : 'keine';
}

// Datensatz ohne die Datei — so wird nie ein Blob zurückgeschrieben.
export function ohneDatei<T extends { datei?: unknown }>(n: T): Omit<T, 'datei'> {
  const kopie = { ...n };
  Reflect.deleteProperty(kopie, 'datei');
  return kopie;
}
