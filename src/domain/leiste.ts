// Untere Leiste (B-01, B-18): links zwei Orte — Lernen und Noten (die
// Bibliothek) —, rechts zwei Werkzeuge — Stimmgerät und Metronom. Ein Ort
// legt sich als Seite über die Noten, ein Werkzeug schwebt als Widget.

export type Ort = 'lernen' | 'bibliothek' | null;

// Ein Tipp auf einen Ort zeigt ihn; ist er schon offen, schließt er ihn.
// Der andere Ort weicht — ein ganzer Seitenwechsel, kein Stapel.
export const ortUmschalten = (offen: Ort, ziel: Exclude<Ort, null>): Ort => (offen === ziel ? null : ziel);
