// Persönliche Einstellungen, die mit der Sicherung reisen: was zur Person und
// zum Instrument gehört — Stimmung und Kammerton, Metronom (Klang, Lautstärke,
// Takt, Akzente, Unterteilung, Trainer), Stift-, Marker- und Textfarbe,
// Wischrichtung, Zoomen auch beim Lesen, Tonumfang fürs Tonprofil. Was zum Gerät gehört, bleibt:
// Hell/Dunkel und Farbwelten, Lage der Fenster, zuletzt Geöffnetes, Filter,
// das Tempo (folgt den Stellen). Tags und Tonprofile haben eigene Felder.
//
// Auf dem Gerät liegen die Werte im localStorage (JSON) unter ihrem
// Schlüssel; dazu der Zeitpunkt der letzten echten Änderung
// (EINSTELLUNGEN_STAND). Beim Laden einer Sicherung gewinnt der neuere Stand,
// und zwar als Ganzes. Rein und getestet.

import { STIFT_STANDARD, type StiftEinstellung } from './stift';
import { STIMMUNGEN, type Stimmung } from './ueben';

export const METRONOM_KLAENGE = ['holz', 'klick', 'glocke'] as const;
export type MetronomKlang = (typeof METRONOM_KLAENGE)[number];
const AKZENTE = ['betont', 'normal', 'stumm'] as const;
export type Akzent = (typeof AKZENTE)[number];
export interface Trainer { an: boolean; schritt: number; takte: number; ziel: number }
export interface Tonumfang { von: number; bis: number; stamm: boolean }

export interface Einstellungswerte {
  'stimm:st': Stimmung;
  'stimm:a': number;
  'metro:klang': MetronomKlang;
  'metro:laut': number;
  'metro:takt': number;
  'metro:akzente': Akzent[];
  'metro:unter': number;
  'metro:trainer': Trainer;
  'ueben:stift': StiftEinstellung;
  'ueben:marker': StiftEinstellung;
  'ueben:text': StiftEinstellung;
  'ueben:wisch-umkehren': boolean;
  'ueben:zoom-immer': boolean;
  'ueben:tonprofil-umfang': Tonumfang;
}
export type Mitreisend = keyof Einstellungswerte;
export type Werte = Partial<Einstellungswerte>;
export interface EinstellungsStand { stand: number; werte: Werte }

// Was gilt, solange nichts gespeichert ist — die Anbieter lesen ihre
// Vorgaben von hier. Ein frisches Gerät schreibt beim Start genau diese
// Werte; das ist keine Änderung (istAenderung).
export const EINSTELLUNG_STANDARD: Einstellungswerte = {
  // Standard B (deutsch, = internationales B♭).
  'stimm:st': 'B',
  'stimm:a': 442,
  'metro:klang': 'holz',
  'metro:laut': 0.9,
  'metro:takt': 4,
  'metro:akzente': ['betont', 'normal', 'normal', 'normal'],
  'metro:unter': 1,
  'metro:trainer': { an: false, schritt: 4, takte: 4, ziel: 120 },
  'ueben:stift': STIFT_STANDARD.stift,
  'ueben:marker': STIFT_STANDARD.marker,
  'ueben:text': STIFT_STANDARD.text,
  'ueben:wisch-umkehren': false,
  'ueben:zoom-immer': false,
  'ueben:tonprofil-umfang': { von: 55, bis: 79, stamm: false },
};

// Zeitpunkt der letzten echten Änderung eines mitreisenden Werts (ms).
export const EINSTELLUNGEN_STAND = 'ueben:einstellungen-geaendert';
// Ereignis am window, nachdem eine Sicherung Einstellungen gesetzt hat: Wer
// Werte im Speicher hält (Metronom, Stimmgerät …), liest sie neu — sonst
// schriebe er bei der nächsten Änderung die alten zurück.
export const EINSTELLUNGEN_GELADEN = 'ueben:einstellungen-geladen';

const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const zahl = (v: unknown, von: number, bis: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= von && v <= bis;
const ganz = (v: unknown, von: number, bis: number): v is number => Number.isInteger(v) && zahl(v, von, bis);
const eines = (liste: readonly string[]) => (v: unknown) => typeof v === 'string' && liste.includes(v);
const stift = (v: unknown) => objekt(v) && typeof v.farbe === 'string' && v.farbe.length > 0 && v.farbe.length <= 64 && zahl(v.breite, 0.0001, 0.1);

// Je Schlüssel: Ist der Wert von passender Art? Grenzen so, dass kein Wert
// aus einer fremden oder kaputten Datei etwas lahmlegt (Takt 0, Unterteilung
// 0 …); Farben prüft einstellungPruefen beim Öffnen eines Stücks genauer.
const PRUEFEN: Record<Mitreisend, (v: unknown) => boolean> = {
  'stimm:st': eines(Object.keys(STIMMUNGEN)),
  'stimm:a': (v) => zahl(v, 430, 450),
  'metro:klang': eines(METRONOM_KLAENGE),
  'metro:laut': (v) => zahl(v, 0, 1),
  'metro:takt': (v) => ganz(v, 1, 16),
  'metro:akzente': (v) => Array.isArray(v) && v.length <= 16 && v.every(eines(AKZENTE)),
  'metro:unter': (v) => ganz(v, 1, 8),
  'metro:trainer': (v) => objekt(v) && typeof v.an === 'boolean'
    && ganz(v.schritt, 1, 1000) && ganz(v.takte, 1, 1000) && ganz(v.ziel, 1, 1000),
  'ueben:stift': stift,
  'ueben:marker': stift,
  'ueben:text': stift,
  'ueben:wisch-umkehren': (v) => typeof v === 'boolean',
  'ueben:zoom-immer': (v) => typeof v === 'boolean',
  'ueben:tonprofil-umfang': (v) => objekt(v) && ganz(v.von, 0, 127) && ganz(v.bis, 0, 127) && v.von <= v.bis && typeof v.stamm === 'boolean',
};

export const MITREISEND = Object.keys(PRUEFEN) as Mitreisend[];
// hasOwnProperty statt Object.hasOwn: läuft auch auf älteren iPhones.
export const istMitreisend = (k: string): k is Mitreisend => Object.prototype.hasOwnProperty.call(PRUEFEN, k);
const gueltig = (k: Mitreisend, v: unknown) => PRUEFEN[k](v);

function json(roh: string | null): { wert: unknown } | null {
  if (roh === null) return null;
  try { return { wert: JSON.parse(roh) }; } catch { return null; }
}

// Vergleich unabhängig von der Reihenfolge der Felder.
const kanonisch = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (objekt(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  : x));

// Die mitreisenden Werte des Geräts; `lesen` liefert den gespeicherten
// JSON-Text (localStorage.getItem). Unlesbares und Unpassendes bleibt weg.
export function einstellungenSammeln(lesen: (k: string) => string | null): Werte {
  const werte: Record<string, unknown> = {};
  for (const k of MITREISEND) {
    const j = json(lesen(k));
    if (j && gueltig(k, j.wert)) werte[k] = j.wert;
  }
  return werte as Werte;
}

export function standLesen(roh: string | null): number {
  const n = Number(roh);
  return roh !== null && Number.isFinite(n) && n > 0 ? n : 0;
}

// Stand des Geräts. Ohne Zeitstempel (Einstellungen von vor seiner
// Einführung) gilt: 1, wenn etwas vom Standard abweicht — älter als jede
// datierte Änderung, aber neuer als ein frisches Gerät —, sonst 0.
export function standHier(gespeichert: string | null, werte: Werte): number {
  const s = standLesen(gespeichert);
  if (s) return s;
  return MITREISEND.some((k) => k in werte && kanonisch(werte[k]) !== kanonisch(EINSTELLUNG_STANDARD[k])) ? 1 : 0;
}

// Für den Kopf der Sicherung; nichts, wenn hier nie etwas eingestellt wurde.
export function einstellungenFuerSicherung(lesen: (k: string) => string | null): EinstellungsStand | undefined {
  const werte = einstellungenSammeln(lesen);
  const stand = standHier(lesen(EINSTELLUNGEN_STAND), werte);
  return stand > 0 && Object.keys(werte).length ? { stand, werte } : undefined;
}

// Das Feld `einstellungen` aus dem Kopf einer Sicherung. Fehlt es (ältere
// Sicherung, Registerführer) oder ist es unbrauchbar: null. Nur bekannte
// Schlüssel mit passenden Werten bleiben.
export function einstellungenLesen(roh: unknown): EinstellungsStand | null {
  if (!objekt(roh) || !zahl(roh.stand, 1, Number.MAX_SAFE_INTEGER) || !objekt(roh.werte)) return null;
  const werte: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(roh.werte)) if (istMitreisend(k) && gueltig(k, v)) werte[k] = v;
  return Object.keys(werte).length ? { stand: roh.stand, werte: werte as Werte } : null;
}

// Übernehmen nur, wenn die Datei neuer ist als das Gerät — dann alle ihre
// Werte (was ihr fehlt, bleibt hier) samt ihrem Stand.
export const uebernehmen = (hier: number, dort: EinstellungsStand | null): dort is EinstellungsStand => !!dort && dort.stand > hier;

// Zählt das Schreiben von `neu` unter `k` als Änderung? Nur bei mitreisenden
// Werten, die sich wirklich ändern. Fehlt der alte Wert (oder ist er
// unlesbar), gilt der Standard — ein frisches Gerät schreibt ihn beim Start.
export function istAenderung(k: string, alt: string | null, neu: unknown): boolean {
  if (!istMitreisend(k)) return false;
  const vorher = json(alt)?.wert ?? EINSTELLUNG_STANDARD[k];
  return kanonisch(vorher) !== kanonisch(neu);
}

// Der Zeitstempel steigt nur — auch wenn die Uhr hinter einem übernommenen
// Stand zurückliegt.
export const neuerStand = (alt: number, jetzt: number) => Math.max(jetzt, alt + 1);
