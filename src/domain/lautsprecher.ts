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
// Automatisch erkennen, ob Kopfhörer oder eine Box dran sind, kann eine
// Web-App auf iOS nicht verlässlich (Recherche D-08/B-20, 2026-11-19): Den
// Audio-Weg (Lautsprecher, Kopfhörer, Bluetooth, AirPlay) verrät WebKit
// Webseiten nicht. `enumerateDevices` nennt nur Mikrofone, Namen erst nach
// der Mikrofon-Erlaubnis, und Kopfhörer ohne Mikrofon, Boxen und AirPlay gar
// nicht. Darum bleibt es beim Schalter, Vorgabe „an“ — der Ton geht ohnehin
// dorthin, wo iOS ihn hinschickt; „aus“ ändert nur das Mikrofon.
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

export type Sitzung = 'playback' | 'play-and-record' | 'ambient';

// Mit anderen Apps mischen (D-08): Metronom und Klänge laufen zu Musik aus
// Spotify, Moises, iReal Pro, statt sie anzuhalten. Gerät-Einstellung (ob
// nebenher Musik läuft, ist eine Frage des Geräts), Vorgabe aus: gemischt
// gilt der Stummschalter, und im Hintergrund hält iOS den Ton an.
export const MISCHEN_SCHLUESSEL = 'ueben:mischen';
export const MISCHEN_STANDARD = false;

// navigator.audioSession.type: Solange ein Mikrofon offen ist, „play-and-
// record“ (mit „playback“ stellte iOS das Mikrofon stumm) — auch beim
// Mischen: WebKit setzt für Aufnahme und Wiedergabe kein „mit anderen
// mischen“, die andere Musik hält an. Sonst „ambient“, wenn gemischt werden
// soll (der einzige Typ, den WebKit mischen lässt; „transient“ ist dasselbe),
// und andernfalls „playback“ — Ton auch bei Stummschalter, im Hintergrund
// weiter, und nach dem Mikrofon kein Hängenbleiben in der Telefon-Lautstärke.
export function sitzungFuer(offeneMikrofone: number, mischen = false): Sitzung {
  if (offeneMikrofone > 0) return 'play-and-record';
  return mischen ? 'ambient' : 'playback';
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

// Ein gemerkter Schalter (Gerät): nur ein echter Wahrheitswert zählt, sonst
// die Vorgabe. Schreibt nichts.
export function schalterAnfang(lesen: (k: string) => string | null, schluessel: string, standard: boolean): boolean {
  return wahrheitswert(lesen(schluessel)) ?? standard;
}
