// Markierungen, die schon im PDF stecken (etwa mit Apples „Markieren“ in der
// Dateien-App gezeichnet): Die Seite wird ohne die Anmerkungen des PDFs
// gezeichnet, die Anmerkungen allein auf eine eigene, durchsichtige Ebene.
// Sie liegt über der nackten Seite und lässt sich radieren — darunter
// erscheinen die sauberen Noten. Das PDF selbst bleibt unverändert.

// Arten von PDF-Anmerkungen (pdf.js AnnotationType), die keine Markierung
// sind: Link, Notizfenster (Popup), Formularfeld.
const KEINE_MARKIERUNG = new Set([2, 16, 20]);

export function hatMarkierungen(anmerkungen: { annotationType: number }[]): boolean {
  return anmerkungen.some((a) => !KEINE_MARKIERUNG.has(a.annotationType));
}

// Welche Zeichenbefehle einer Seite gehören zu Anmerkungen? 1 für jeden
// Befehl zwischen Anfang und Ende einer Anmerkung (beide eingeschlossen),
// sonst 0. Nur diese ausgeführt ergeben die Markierungs-Ebene allein —
// ohne die Seite, ohne Pixelvergleich.
export function anmerkungsBefehle(befehle: ArrayLike<number>, anfang: number, ende: number): Uint8Array {
  const drin = new Uint8Array(befehle.length);
  let tiefe = 0;
  for (let i = 0; i < befehle.length; i++) {
    if (befehle[i] === anfang) tiefe++;
    drin[i] = tiefe > 0 ? 1 : 0;
    if (befehle[i] === ende && tiefe > 0) tiefe--;
  }
  return drin;
}
