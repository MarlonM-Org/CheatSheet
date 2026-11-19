// Lautsprecher für alle Klänge (B-20). Eine Geräte-Einstellung entscheidet,
// was das Mikrofon liefern soll, solange die App zugleich Ton ausgibt
// (Stimmgerät, Aufnehmen, Einsingen, Ohr-Trainer — und alles, was dabei
// klingt: Klick, Klavier, Drone).
//
// iPhone/iPad (WebKit): Mit Sprachverarbeitung (Echo-Unterdrückung) läuft das
// Mikrofon wie beim Freisprechen — der Ton kommt laut aus dem Lautsprecher,
// das Mikrofon hört aus Abstand, die eigenen Klänge bleiben draußen. Ohne
// ist es das rohe Mikrofon, unverfälscht und nah dran; der Ton geht dann in
// den Kopfhörer, ohne Kopfhörer leise aus dem Hörer. Einen Weg, Lautsprecher
// und rohes Mikrofon zu kombinieren, gibt es im Browser nicht.
// Ohne offenes Mikrofon kommt jeder Klang ohnehin aus dem Lautsprecher (bzw.
// Kopfhörer, Bluetooth, AirPlay — was im Kontrollzentrum gewählt ist).
//
// Rein und getestet (tests/lautsprecher.test.ts).

// Gerät-Einstellung: ob man gerade Kopfhörer trägt, ist eine Frage des
// Geräts, nicht der Person — reist nicht mit der Sicherung.
export const LAUTSPRECHER_SCHLUESSEL = 'ueben:lautsprecher';
export const LAUTSPRECHER_STANDARD = true;
// Frühere Schalter mit derselben Wirkung (G-03 „Lautsprecher“ beim
// Einsingen, „Mikrofon verstärken“ im Stimmgerät). Solange noch nichts
// gewählt ist, gilt der erste, der gemerkt ist. Sie bleiben im Speicher
// stehen; geschrieben wird nur noch der neue Schlüssel.
export const FRUEHERE_SCHALTER = ['ueben:einspiel-lautsprecher', 'ueben:stimm-verstaerken'] as const;

// Wozu das Mikrofon läuft: Töne erkennen (Stimmgerät, Einsingen,
// Ohr-Trainer, Tonprofil, Griffe) oder eine Aufnahme zum Anhören (G-09, I-20).
export type MikrofonZweck = 'erkennen' | 'aufnehmen';

export interface Mikrofonwunsch { echoCancellation: boolean; noiseSuppression: false; autoGainControl: boolean }

// Lautsprecher an: Echo-Unterdrückung (iPhone: Freisprechen); zum Erkennen
// auch die Verstärkung des Browsers (hört aus Abstand), beim Aufnehmen nicht
// (Instrumente pumpen sonst). Aus: das rohe Mikrofon. Rauschunterdrückung
// nie — sie nimmt gehaltene Töne als Dauergeräusch.
export function mikrofonWunsch(lautsprecher: boolean, zweck: MikrofonZweck): Mikrofonwunsch {
  return { echoCancellation: lautsprecher, noiseSuppression: false, autoGainControl: lautsprecher && zweck === 'erkennen' };
}

export type Sitzung = 'playback' | 'play-and-record';

// navigator.audioSession.type: Solange ein Mikrofon offen ist, „play-and-
// record“ (mit „playback“ stellte iOS das Mikrofon stumm). Sonst immer
// „playback“ — Ton auch bei Stummschalter, und nach dem Mikrofon kein
// Hängenbleiben in der Telefon-Lautstärke.
export function sitzungFuer(offeneMikrofone: number): Sitzung {
  return offeneMikrofone > 0 ? 'play-and-record' : 'playback';
}

function wahrheitswert(roh: string | null): boolean | null {
  if (roh === null) return null;
  try { const v: unknown = JSON.parse(roh); return typeof v === 'boolean' ? v : null; } catch { return null; }
}

// Die gemerkte Wahl; `lesen` liefert den gespeicherten JSON-Text
// (localStorage.getItem). Schreibt nichts.
export function lautsprecherAnfang(lesen: (k: string) => string | null): boolean {
  for (const k of [LAUTSPRECHER_SCHLUESSEL, ...FRUEHERE_SCHALTER]) {
    const v = wahrheitswert(lesen(k));
    if (v !== null) return v;
  }
  return LAUTSPRECHER_STANDARD;
}
