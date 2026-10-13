// Die Vorgängerin „ueben“ (bis Schema 3, Registerführer-Zuschnitt `notenId`):
// was die Übernahme aus ihr braucht. Rein, getestet. Gelesen wird sie nur in
// lokal.ts (vorgaengerPruefen) — geschrieben, umgebaut oder gelöscht nie.

// Die Speicher, die es je nach Schema gibt: 1 noten/stellen, 2 anmerkungen,
// 3 dateien.
export const VORGAENGER_SPEICHER = ['noten', 'stellen', 'anmerkungen', 'dateien'] as const;

// Wo die PDF eines Stücks liegt: seit Schema 3 als reine Bytes in „dateien“
// (Schlüssel = id der Noten). Ältere Stücke tragen sie noch als Blob im
// Datensatz — die Vorgängerin zog sie erst beim Lesen um.
export function dateiQuelle(eintrag: unknown, n: { datei?: unknown }): 'dateien' | 'datensatz' | 'keine' {
  if (eintrag && typeof eintrag === 'object' && (eintrag as { daten?: unknown }).daten instanceof ArrayBuffer) return 'dateien';
  return n.datei instanceof Blob ? 'datensatz' : 'keine';
}

// Datensatz ohne die Datei und ohne den Dateiverweis — beides reist getrennt,
// so landet nie ein Blob in „cheatsheet“.
export function ohneDatei<T extends { datei?: unknown; handle?: unknown }>(n: T): Omit<T, 'datei' | 'handle'> {
  const kopie = { ...n };
  Reflect.deleteProperty(kopie, 'datei');
  Reflect.deleteProperty(kopie, 'handle');
  return kopie;
}
