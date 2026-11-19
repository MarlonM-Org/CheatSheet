// Untere Leiste (B-01, B-18): links zwei Orte — Lernen und Noten (die
// Bibliothek) —, rechts zwei Werkzeuge — Stimmgerät und Metronom. Ein Ort
// legt sich als Seite über die Noten, ein Werkzeug schwebt als Widget.

export type Ort = 'lernen' | 'bibliothek' | null;

// Ein Tipp auf einen Ort zeigt ihn; ist er schon offen, schließt er ihn.
// Der andere Ort weicht — ein ganzer Seitenwechsel, kein Stapel.
export const ortUmschalten = (offen: Ort, ziel: Exclude<Ort, null>): Ort => (offen === ziel ? null : ziel);

// Ein Tipp auf einen Ort, wenn darauf eine Unterseite liegt (iPad: ein
// Werkzeug als ganze Seite über Lernen, die Leiste bleibt bedienbar): Der
// offene Ort führt zu seiner Übersicht zurück — wie ein Tab auf dem iPhone —,
// statt alles zu schließen. Sonst wie ortUmschalten.
export function ortTippen(offen: Ort, ziel: Exclude<Ort, null>, unterseite: boolean): { ort: Ort; zurUebersicht: boolean } {
  if (offen === ziel && unterseite) return { ort: offen, zurUebersicht: true };
  return { ort: ortUmschalten(offen, ziel), zurUebersicht: false };
}

// Ein Sprung aus einer Seite in die andere — die Kachel „Aufnahme-Tagebuch“
// in Lernen führt zu den Aufnahmen in der Bibliothek (I-20, Rückmeldung
// Marlon 2026-11-19). Ganzer Seitenwechsel: Das Ziel öffnet, der andere Ort
// weicht samt seiner Unterseite. Anders als ein Tipp auf den Knopf schließt
// ein Sprung nie; danach gilt die Leiste wie immer.
export const ortSprung = (_offen: Ort, ziel: Exclude<Ort, null>): Ort => ziel;
