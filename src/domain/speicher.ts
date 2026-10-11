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
