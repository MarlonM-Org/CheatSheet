// Markierungen, die schon im PDF stecken (etwa mit Apples „Markieren“ in der
// Dateien-App gezeichnet): Die Seite wird einmal mit und einmal ohne die
// Anmerkungen des PDFs gezeichnet; was sich unterscheidet, ist die Ebene der
// Markierungen. Sie liegt über der nackten Seite und lässt sich radieren —
// darunter erscheinen die sauberen Noten. Das PDF selbst bleibt unverändert.

// Arten von PDF-Anmerkungen (pdf.js AnnotationType), die keine Markierung
// sind: Link, Notizfenster (Popup), Formularfeld.
const KEINE_MARKIERUNG = new Set([2, 16, 20]);

export function hatMarkierungen(anmerkungen: { annotationType: number }[]): boolean {
  return anmerkungen.some((a) => !KEINE_MARKIERUNG.has(a.annotationType));
}

// Pixel (RGBA), die sich zwischen „mit“ und „ohne“ unterscheiden, kommen
// deckend aus „mit“; der Rest wird durchsichtig. Über die nackte Seite gelegt
// ergibt das genau das Bild mit Markierungen. Winzige Abweichungen bis zur
// Toleranz zählen nicht. Arbeitet in „mit“ (spart Speicher) und gibt es zurück.
export function ebeneAusDifferenz(mit: Uint8ClampedArray, ohne: Uint8ClampedArray, toleranz = 3): Uint8ClampedArray {
  for (let i = 0; i < mit.length; i += 4) {
    const anders = Math.abs(mit[i] - ohne[i]) > toleranz
      || Math.abs(mit[i + 1] - ohne[i + 1]) > toleranz
      || Math.abs(mit[i + 2] - ohne[i + 2]) > toleranz;
    mit[i + 3] = anders ? 255 : 0;
  }
  return mit;
}
