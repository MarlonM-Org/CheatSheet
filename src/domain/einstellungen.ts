// Einstellungen und Lernstand im localStorage — was davon mit der Sicherung
// reist und wie (A-08, „schmale Sicherung“). Rein und getestet.
//
// Vier Gruppen; ein neuer Schlüssel gehört in genau eine davon:
//
// 1. Mitreisend (MITREISEND): was zur Person und zum Instrument gehört —
//    Stimmung und Kammerton, Tonumfang fürs Tonprofil, Stift-, Marker- und
//    Textfarbe, Wischrichtung, „Immer zoomen“, Reihenfolge der Sammlungen.
//    Dazu der Zeitpunkt der letzten echten Änderung (EINSTELLUNGEN_STAND);
//    beim Laden einer Sicherung gewinnt der neuere Stand, und zwar als Ganzes.
// 2. Lernstand (LERNSTAND): Skill-Kartei, Licks, eigene Jam-Stücke. Das sind
//    Nutzerdaten, keine Einstellungen: Sie reisen im selben Feld der
//    Sicherung (`einstellungen.werte`, Format unverändert), rücken den Stand
//    aber nicht vor und werden beim Laden je Eintrag zusammengeführt
//    (lernstandVereinigen) — sonst überschriebe eine nebenbei geänderte
//    Einstellung den Lernstand des anderen Geräts.
// 3. Nur am Gerät (GERAET und alles Übrige): Metronom-Klang und -Lautstärke,
//    Ohr-Trainer, Stufe der Hör-Übungen, Klang der Drone (ueben:drone-klang),
//    Hell/Dunkel und Farbwelten, Lage der Fenster, zuletzt Geöffnetes,
//    Filter, das Tempo (folgt den Stellen), der Verlauf des Ohr-Trainers, der
//    Tagesstand von „Heute“, die Ansicht der Stückauswahl (ueben:stueckwahl,
//    F-23: nur { ansicht }, die Sammlung kommt von der Bibliothek), ob der Ton
//    bei offenem Mikrofon aus dem Lautsprecher kommt (ueben:lautsprecher, B-20,
//    samt den früheren ueben:einspiel-lautsprecher und ueben:stimm-verstaerken;
//    Kopfhörer hat man am Gerät, nicht als Person), ob Klänge mit anderen Apps
//    mischen (ueben:mischen) und ob das Metronom im Hintergrund weiterläuft
//    (ueben:metronom-hintergrund, D-08) … Tags und Tonprofile haben eigene
//    Felder in der Sicherung.
// 4. Nicht gespeichert (VERALTET): Taktart, Nenner, Akzente, Unterteilung,
//    Tempo-Trainer, Swing, Drone (Grundton, Farbe, Lautstärke), Etüden-Wahl. Jede Sitzung beginnt mit dem
//    App-Standard; die alten Schlüssel räumt die App beim Start weg.

import type { Grabstein } from './einspielen';
import type { StufenId } from './gehoer';
import { skillsGueltig, skillsLesen, skillsVereinigen, type SkillSpeicher } from './skills';
import { jamStueckeGueltig, jamStueckeLesen, jamStueckeVereinigen, type JamStueck } from './jamkarte';
import { LICKS_STANDARD, licksGueltig, licksLesen, licksVereinigen, type LickSpeicher } from './licks';
import { SWING_STANDARD, type Swing } from './swing';
import { STIFT_STANDARD, type StiftEinstellung } from './stift';
import { NENNER_STANDARD, type Nenner } from './takt';
import { STIMMUNGEN, type Stimmung } from './ueben';

export const METRONOM_KLAENGE = ['holz', 'klick', 'glocke'] as const;
export type MetronomKlang = (typeof METRONOM_KLAENGE)[number];
export type Akzent = 'betont' | 'normal' | 'stumm';
export interface Trainer { an: boolean; schritt: number; takte: number; ziel: number }
export interface Tonumfang { von: number; bis: number; stamm: boolean }
export interface OhrEinstellung { stufe: StufenId; grundton: number; bpm: number; wechseln: boolean }

// ── 1. Mitreisend ──

export interface Einstellungswerte {
  'stimm:st': Stimmung;
  'stimm:a': number;
  'ueben:stift': StiftEinstellung;
  'ueben:marker': StiftEinstellung;
  'ueben:text': StiftEinstellung;
  'ueben:wisch-umkehren': boolean;
  'ueben:zoom-immer': boolean;
  'ueben:tonprofil-umfang': Tonumfang;
  // Namen der Sammlungen in der Reihenfolge der Leiste (F-13; fehlende kommen dahinter, A–Z).
  'ueben:sammlungen-reihenfolge': string[];
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
  'ueben:stift': STIFT_STANDARD.stift,
  'ueben:marker': STIFT_STANDARD.marker,
  'ueben:text': STIFT_STANDARD.text,
  'ueben:wisch-umkehren': false,
  'ueben:zoom-immer': false,
  'ueben:tonprofil-umfang': { von: 55, bis: 79, stamm: false },
  'ueben:sammlungen-reihenfolge': [],
};

// ── 3. und 4. Vorgaben für Gerät und Sitzung ──

// Metronom: Klang und Lautstärke bleiben am Gerät (`metro:klang`,
// `metro:laut`), alles Übrige beginnt jede Sitzung hier.
export const METRONOM_STANDARD: {
  klang: MetronomKlang; laut: number; takt: number; nenner: Nenner; akzente: Akzent[]; unter: number; trainer: Trainer; swing: Swing;
} = {
  klang: 'holz',
  laut: 0.9,
  takt: 4,
  nenner: NENNER_STANDARD,
  akzente: ['betont', 'normal', 'normal', 'normal'],
  unter: 1,
  trainer: { an: false, schritt: 4, takte: 4, ziel: 120 },
  // Swing-Metronom (I-17): nur 2 und 4, hörbare Achtel mit Swing-Anteil.
  swing: SWING_STANDARD,
};
// Ohr-Trainer (I-01): Stufe, Grundton (notiert), Tempo, Grundton jede Runde wechseln.
export const OHR_STANDARD: OhrEinstellung = { stufe: 'drei', grundton: 60, bpm: 80, wechseln: false };

// Bleiben am Gerät, reisen nicht mit (die Stufen sind der eigene Stand,
// Klang und Lautstärke hängen am Lautsprecher).
export const GERAET = ['metro:klang', 'metro:laut', 'ueben:ohr', 'ueben:hoerquiz', 'ueben:drone-klang'] as const;
// Früher gespeichert, jetzt nur noch für die Sitzung: Die App löscht sie beim Start.
export const VERALTET = [
  'metro:takt', 'metro:nenner', 'metro:akzente', 'metro:unter', 'metro:trainer', 'metro:swing', 'ueben:drone', 'ueben:etueden',
] as const;

// Zeitpunkt der letzten echten Änderung eines mitreisenden Werts (ms).
export const EINSTELLUNGEN_STAND = 'ueben:einstellungen-geaendert';
// Ereignis am window, nachdem eine Sicherung Einstellungen oder Lernstand
// gesetzt hat: Wer Werte im Speicher hält (Stimmgerät, Stifte, Licks …),
// liest sie neu — sonst schriebe er bei der nächsten Änderung die alten zurück.
export const EINSTELLUNGEN_GELADEN = 'ueben:einstellungen-geladen';

const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const zahl = (v: unknown, von: number, bis: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= von && v <= bis;
const ganz = (v: unknown, von: number, bis: number): v is number => Number.isInteger(v) && zahl(v, von, bis);
const eines = (liste: readonly string[]) => (v: unknown) => typeof v === 'string' && liste.includes(v);
const stift = (v: unknown) => objekt(v) && typeof v.farbe === 'string' && v.farbe.length > 0 && v.farbe.length <= 64 && zahl(v.breite, 0.0001, 0.1);

// Je Schlüssel: Ist der Wert von passender Art? Grenzen so, dass kein Wert
// aus einer fremden oder kaputten Datei etwas lahmlegt; Farben prüft
// einstellungPruefen beim Öffnen eines Stücks genauer.
const PRUEFEN: Record<Mitreisend, (v: unknown) => boolean> = {
  'stimm:st': eines(Object.keys(STIMMUNGEN)),
  'stimm:a': (v) => zahl(v, 430, 450),
  'ueben:stift': stift,
  'ueben:marker': stift,
  'ueben:text': stift,
  'ueben:wisch-umkehren': (v) => typeof v === 'boolean',
  'ueben:zoom-immer': (v) => typeof v === 'boolean',
  'ueben:tonprofil-umfang': (v) => objekt(v) && ganz(v.von, 0, 127) && ganz(v.bis, 0, 127) && v.von <= v.bis && typeof v.stamm === 'boolean',
  'ueben:sammlungen-reihenfolge': (v) => Array.isArray(v) && v.length <= 1000 && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 60),
};

export const MITREISEND = Object.keys(PRUEFEN) as Mitreisend[];
// hasOwnProperty statt Object.hasOwn: läuft auch auf älteren iPhones.
const hat = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const istMitreisend = (k: string): k is Mitreisend => hat(PRUEFEN, k);
const gueltig = (k: Mitreisend, v: unknown) => PRUEFEN[k](v);

// ── 2. Lernstand ──

export interface Lernstand {
  // Skill-Kartei (I-07): Markierung und gemessene Stufe je Skill-id.
  'ueben:skills': SkillSpeicher;
  // Lick-Sammlung (I-16): eigene Licks, Stand je Lick, ausgeblendete Start-Licks.
  'ueben:licks': LickSpeicher;
  // Jam-Karte (I-19): eigene Stücke (Form, Tonart, Akkorde klingend).
  'ueben:jamkarte': JamStueck[];
}
export type LernstandSchluessel = keyof Lernstand;

// Je Schlüssel: streng prüfen (was aus einer Datei kommt), nachsichtig lesen
// (was auf dem Gerät liegt — kaputte Einträge fallen weg, der Rest bleibt),
// leer (dann reist nichts), zusammenführen.
const LERN: { [K in LernstandSchluessel]: {
  pruefen: (v: unknown) => boolean;
  lesen: (v: unknown) => Lernstand[K];
  leer: (v: Lernstand[K]) => boolean;
  vereinigen: (hier: Lernstand[K], dort: Lernstand[K], grabsteine: Grabstein[]) => Lernstand[K];
} } = {
  'ueben:skills': {
    pruefen: skillsGueltig, lesen: skillsLesen, leer: (v) => Object.keys(v).length === 0, vereinigen: (h, d) => skillsVereinigen(h, d),
  },
  'ueben:licks': {
    pruefen: licksGueltig, lesen: licksLesen,
    leer: (v) => !v.eigene.length && !Object.keys(v.stand).length && !v.aus.length && v.ausAm === undefined,
    vereinigen: licksVereinigen,
  },
  'ueben:jamkarte': {
    pruefen: jamStueckeGueltig, lesen: jamStueckeLesen, leer: (v) => v.length === 0, vereinigen: jamStueckeVereinigen,
  },
};
export const LERNSTAND = Object.keys(LERN) as LernstandSchluessel[];
export const istLernstand = (k: string): k is LernstandSchluessel => hat(LERN, k);
export const LERNSTAND_LEER: Lernstand = { 'ueben:skills': {}, 'ueben:licks': LICKS_STANDARD, 'ueben:jamkarte': [] };

function json(roh: string | null): { wert: unknown } | null {
  if (roh === null) return null;
  try { return { wert: JSON.parse(roh) }; } catch { return null; }
}

// Vergleich unabhängig von der Reihenfolge der Felder.
const kanonisch = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (objekt(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  : x));

// Der Lernstand des Geräts, nachsichtig gelesen (fehlt etwas: leer).
export function lernstandHier(lesen: (k: string) => string | null): Lernstand {
  const l = { ...LERNSTAND_LEER } as Record<LernstandSchluessel, unknown>;
  for (const k of LERNSTAND) {
    const j = json(lesen(k));
    if (j) l[k] = LERN[k].lesen(j.wert);
  }
  return l as unknown as Lernstand;
}

// Lernstand der Sicherung mit dem des Geräts zusammenführen: je Skill, je
// Lick, je Jam-Stück gewinnt der neuere Stand; Grabsteine (Gerät und Datei)
// nehmen Gelöschtes mit — auch, wenn die Datei den Schlüssel gar nicht hat.
// Liefert nur, was sich hier ändert.
export function lernstandVereinigen(hier: Lernstand, dort: Partial<Lernstand>, grabsteine: Grabstein[]): Partial<Lernstand> {
  const neu: Partial<Record<LernstandSchluessel, unknown>> = {};
  for (const k of LERNSTAND) {
    const v = (LERN[k].vereinigen as (h: unknown, d: unknown, g: Grabstein[]) => unknown)(hier[k], dort[k] ?? LERNSTAND_LEER[k], grabsteine);
    if (kanonisch(v) !== kanonisch(hier[k])) neu[k] = v;
  }
  return neu as Partial<Lernstand>;
}

// ── Sicherung ──

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

// Der Lernstand für die Sicherung: nur gültige, nicht leere Werte.
export function lernstandSammeln(lesen: (k: string) => string | null): Partial<Lernstand> {
  const l: Partial<Record<LernstandSchluessel, unknown>> = {};
  for (const k of LERNSTAND) {
    const j = json(lesen(k));
    if (j && LERN[k].pruefen(j.wert) && !(LERN[k].leer as (v: unknown) => boolean)(j.wert)) l[k] = j.wert;
  }
  return l as Partial<Lernstand>;
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

// Für den Kopf der Sicherung: `{ stand, werte }` wie bisher; `werte` trägt
// die mitreisenden Einstellungen (nur, wenn hier je etwas eingestellt wurde)
// und den Lernstand. Nichts, wenn beides fehlt. Der Stand ist mindestens 1
// (so verlangt es das Lesen); ohne Einstellungen übernimmt ihn niemand.
export function einstellungenFuerSicherung(lesen: (k: string) => string | null): { stand: number; werte: Record<string, unknown> } | undefined {
  const werte = einstellungenSammeln(lesen);
  const stand = standHier(lesen(EINSTELLUNGEN_STAND), werte);
  const alle = { ...(stand > 0 ? werte : {}), ...lernstandSammeln(lesen) };
  return Object.keys(alle).length ? { stand: Math.max(1, stand), werte: alle } : undefined;
}

export interface EinstellungenGelesen extends EinstellungsStand { lernstand: Partial<Lernstand> }

// Das Feld `einstellungen` aus dem Kopf einer Sicherung. Fehlt es (ältere
// Sicherung, Registerführer) oder ist es unbrauchbar: null. Nur bekannte
// Schlüssel mit passenden Werten bleiben; was früher mitreiste (Metronom,
// Ohr-Trainer …), wird übergangen.
export function einstellungenLesen(roh: unknown): EinstellungenGelesen | null {
  if (!objekt(roh) || !zahl(roh.stand, 1, Number.MAX_SAFE_INTEGER) || !objekt(roh.werte)) return null;
  const werte: Record<string, unknown> = {};
  const lernstand: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(roh.werte)) {
    if (istMitreisend(k) && gueltig(k, v)) werte[k] = v;
    else if (istLernstand(k) && LERN[k].pruefen(v)) lernstand[k] = v;
  }
  return Object.keys(werte).length || Object.keys(lernstand).length
    ? { stand: roh.stand, werte: werte as Werte, lernstand: lernstand as Partial<Lernstand> }
    : null;
}

// Übernehmen nur, wenn die Datei Einstellungen trägt und neuer ist als das
// Gerät — dann alle ihre Werte (was ihr fehlt, bleibt hier) samt ihrem Stand.
export const uebernehmen = (hier: number, dort: EinstellungsStand | null): dort is EinstellungsStand =>
  !!dort && Object.keys(dort.werte).length > 0 && dort.stand > hier;

// Zählt das Schreiben von `neu` unter `k` als Änderung? Nur bei mitreisenden
// Werten, die sich wirklich ändern. Fehlt der alte Wert (oder ist er
// unlesbar), gilt der Standard — ein frisches Gerät schreibt ihn beim Start.
// Lernstand rückt den Stand nicht vor: Er wird je Eintrag zusammengeführt.
export function istAenderung(k: string, alt: string | null, neu: unknown): boolean {
  if (!istMitreisend(k)) return false;
  const vorher = json(alt)?.wert ?? EINSTELLUNG_STANDARD[k];
  return kanonisch(vorher) !== kanonisch(neu);
}

// Der Zeitstempel steigt nur — auch wenn die Uhr hinter einem übernommenen
// Stand zurückliegt.
export const neuerStand = (alt: number, jetzt: number) => Math.max(jetzt, alt + 1);
