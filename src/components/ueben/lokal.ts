'use client';

import type { Ausschnitte } from '@/domain/ausschnitt';
import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';
import type { Sprung } from '@/domain/spruenge';
import {
  dateiStand, einspielenPlanen, grabsteineLesen, grabsteineVereinigen, notenZusammenfuehren, seiteZusammenfuehren, stand,
  stelleZusammenfuehren, type Einspielplan, type Grabstein, type Staende, type Vorhanden,
} from '@/domain/einspielen';
import {
  EINSTELLUNGEN_GELADEN, EINSTELLUNGEN_STAND, einstellungenFuerSicherung, einstellungenLesen, einstellungenSammeln, standHier, uebernehmen,
  type EinstellungsStand,
} from '@/domain/einstellungen';
import { nurLesbare } from '@/domain/lesbar';
import { sicherungLesen, sicherungPacken, SicherungsFehler, type SicherungsInhalt } from '@/domain/sicherung';
import { dateiQuelle, dateiVerloren, ohneDatei, verbindungVerloren } from '@/domain/speicher';
import { tagMitNamen, tagsAbgleichen, tagSchluessel, tagsLesen, tagsUmschreiben, tagsVon, type Tag, type TagFarbe } from '@/domain/tags';
import { profileLesen, profileVereinigen, type Tonprofil } from '@/domain/tonprofil';

// Ablage nur auf diesem Gerät (IndexedDB): Noten-PDFs, markierte Stellen,
// geschaffte Tempi, Anmerkungen. Keine Datenbank, kein Server. Safari kann die
// Daten löschen, wenn die Seite lange nicht geöffnet wurde; als
// Home-Bildschirm-App seltener — dagegen hilft die Übe-Sicherung.
// Name der Datenbank wie in der Registerführer-App („ueben“). Schema 3: die
// drei Speicher von dort plus „dateien“ — die PDF-Dateien als reine Bytes,
// getrennt von den Noten. Safari verliert Blobs in IndexedDB mitunter, und
// jedes Schreiben eines Noten-Datensatzes schrieb die Datei mit. Ältere
// Stücke tragen ihre Datei noch als Blob im Datensatz (datei); sie ziehen um,
// sobald sie einmal gelesen werden (notenDatei).

export interface LokaleNoten {
  id: string; titel: string; stimme: string; erstellt: number;
  // Nur ältere Stücke, bis zum Umzug in „dateien“.
  datei?: Blob;
  dateiname?: string;
  zuletzt?: number;
  aktualisiert?: number;
  // Nur Chrome/Edge am Rechner: Verweis auf die Datei, um ohne Dateiauswahl neu zu laden.
  handle?: FileSystemFileHandle;
  blaettern?: { modus: Blaettermodus; linien: Record<number, number> };
  // Angezeigter Bereich je Seite (Anteile der Seite); ohne Eintrag die ganze Seite.
  ausschnitte?: Ausschnitte;
  // Sprünge (F-05): Wiederholung, D.S., D.C., Coda — vom Sprungzeichen zur Einstiegsstelle.
  spruenge?: Sprung[];
  // Sammlungen (F-13): Namen, ein Stück kann in mehreren sein.
  sammlungen?: string[];
  // Tags (F-14): ids der Tag-Definitionen (tagsLaden).
  tags?: string[];
  // Größe der PDF in Bytes (ab 2026-10-12; erkennt Doppelte beim Ordner-Import).
  groesse?: number;
  // Letzte Änderung (ab 2026-10-12): Beim Laden einer Sicherung gilt der neuere Stand.
  geaendert?: number;
}
export interface LokaleStelle {
  id: string; notenId: string; seite: number; x: number; y: number; b: number; h: number;
  titel: string; notiz: string; zielTempo: number | null; tempi: { tempo: number; am: number }[];
  geaendert?: number;
}
// entfernt: ids weg-radierter Striche — damit sie beim Laden einer Sicherung
// nicht zurückkehren (ab 2026-10-12).
export interface SeitenAnmerkungen { id: string; notenId: string; seite: number; objekte: Anmerkung[]; entfernt?: string[]; geaendert?: number }
// Schlüssel ist die id der Noten.
interface LokaleDatei { id: string; daten: ArrayBuffer; typ: string }

type Speicher = 'noten' | 'stellen' | 'anmerkungen' | 'dateien';

// Eine Verbindung für die ganze Seite, einmal geöffnet und wiederverwendet.
// Will ein anderes Fenster (neuere Version) das Schema anheben, gibt diese
// Seite die Verbindung frei und öffnet beim nächsten Zugriff neu. Schlägt das
// Öffnen fehl, wird der Merker zurückgesetzt — der nächste Zugriff versucht es
// wieder, statt ewig denselben Fehler zu liefern.
let verbindung: Promise<IDBDatabase> | null = null;

function oeffnen(): Promise<IDBDatabase> {
  rueckkehrBeobachten();
  if (verbindung) return verbindung;
  const diese: Promise<IDBDatabase> = new Promise<IDBDatabase>((ok, fehler) => {
    let aufgegeben = false;
    // Antwortet der Speicher gar nicht, nicht ewig „wird geladen“ zeigen.
    const wecker = window.setTimeout(() => {
      aufgegeben = true;
      fehler(new Error('Der Gerätespeicher antwortet nicht. Bitte neu laden.'));
    }, 8000);
    const r = indexedDB.open('ueben', 3);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('noten', { keyPath: 'id' });
        db.createObjectStore('stellen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
      }
      if (e.oldVersion < 2) db.createObjectStore('anmerkungen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
      if (e.oldVersion < 3) db.createObjectStore('dateien', { keyPath: 'id' });
    };
    r.onsuccess = () => {
      window.clearTimeout(wecker);
      const db = r.result;
      // Kam die Verbindung doch noch, nachdem wir aufgegeben haben: gleich wieder zu.
      if (aufgegeben) { db.close(); return; }
      db.onversionchange = () => { db.close(); vergessen(diese); };
      db.onclose = () => vergessen(diese);
      ok(db);
    };
    r.onerror = () => { window.clearTimeout(wecker); fehler(r.error); };
    // Ein anderes Fenster hält noch eine ältere Version offen.
    r.onblocked = () => {
      window.clearTimeout(wecker);
      aufgegeben = true;
      fehler(new Error('Der Gerätespeicher ist gerade blockiert. Bitte andere CheatSheet-Fenster und -Tabs schließen und neu laden.'));
    };
  });
  verbindung = diese;
  // Jeder Fehler beim Öffnen (auch ein sofort geworfener, etwa im privaten
  // Modus) gibt den Merker frei.
  diese.catch(() => vergessen(diese));
  return diese;
}

// Den Merker nur freigeben, wenn er noch auf diese Verbindung zeigt — eine
// inzwischen neu geöffnete bleibt.
function vergessen(welche: Promise<IDBDatabase>) {
  if (verbindung === welche) verbindung = null;
}

// Zurück in der App: iOS kappt im Hintergrund mitunter die Verbindung, ohne
// dass sie als geschlossen gilt — der nächste Zugriff scheitert dann oder
// hängt. Deshalb nach jeder Rückkehr frisch öffnen (kostet Millisekunden).
// Laufende Transaktionen laufen auf der alten Verbindung noch zu Ende.
let beobachtet = false;
function rueckkehrBeobachten() {
  if (beobachtet || typeof document === 'undefined') return;
  beobachtet = true;
  document.addEventListener('visibilitychange', () => {
    const alt = verbindung;
    if (document.visibilityState !== 'visible' || !alt) return;
    vergessen(alt);
    alt.then((db) => db.close(), () => { /* war schon kaputt */ });
  });
}

// Eine Transaktion über einen oder mehrere Speicher. Abgelehnt wird nur in
// onabort: Jeder Fehler bricht die Transaktion ab, und erst dann steht der
// Grund in t.error (in onerror ist er noch leer). Wirft die Arbeit selbst,
// bricht sie mit genau diesem Grund ab. `arbeit` liefert optional, was nach
// dem Abschluss herauskommt.
//
// Ist die Verbindung inzwischen zu oder verloren (Safari kappt sie mitunter
// von selbst: db.transaction wirft InvalidStateError, oder die Transaktion
// bricht mit UnknownError ab), wird sie vergessen und die Transaktion EINMAL
// mit einer frischen Verbindung versucht. Abgebrochen hat sie nichts
// geschrieben, der neue Versuch ist sicher.
async function transaktion<T>(
  speicher: Speicher | Speicher[],
  modus: IDBTransactionMode,
  arbeit: (t: IDBTransaction, abbrechen: (grund: unknown) => void) => (() => T) | void,
  nochmal = true,
): Promise<T> {
  const offen = oeffnen();
  const db = await offen;
  try {
    const t = db.transaction(speicher, modus);
    return await new Promise<T>((ok, fehler) => {
      let grund: unknown = null;
      let ergebnis: (() => T) | void = undefined;
      const abbrechen = (x: unknown) => { grund ??= x; try { t.abort(); } catch { /* schon beendet */ } };
      t.oncomplete = () => ok(ergebnis ? ergebnis() : (undefined as T));
      t.onabort = () => fehler(grund ?? t.error ?? new Error('Der Gerätespeicher hat den Vorgang abgebrochen.'));
      try { ergebnis = arbeit(t, abbrechen); } catch (x) { abbrechen(x); }
    });
  } catch (x) {
    if (!nochmal || !verbindungVerloren(x)) throw x;
    vergessen(offen);
    try { db.close(); } catch { /* schon zu */ }
    return transaktion(speicher, modus, arbeit, false);
  }
}

const tx = <T>(speicher: Speicher, modus: IDBTransactionMode, arbeit: (s: IDBObjectStore) => IDBRequest<T> | void) =>
  transaktion<T>(speicher, modus, (t) => {
    const req = arbeit(t.objectStore(speicher));
    return req ? () => req.result : undefined;
  });

const ALLE: Speicher[] = ['noten', 'stellen', 'anmerkungen'];
const ALLE_MIT_DATEIEN: Speicher[] = [...ALLE, 'dateien'];

// ── Noten ──
export const alleNoten = () => tx<LokaleNoten[]>('noten', 'readonly', (s) => s.getAll());
export const notenHolen = (id: string) => tx<LokaleNoten | undefined>('noten', 'readonly', (s) => s.get(id));
// Eine gewählte Datei ist nicht lesbar (etwa noch nicht aus iCloud geladen).
export class DateiNichtLesbar extends Error {}
// Eine gewählte Datei ganz lesen. Eine nicht lesbare fällt hier mit klarer
// Meldung auf.
async function bytesLesen(datei: Blob): Promise<LokaleDatei['daten']> {
  try {
    return await datei.arrayBuffer();
  } catch (x) {
    throw new DateiNichtLesbar(`Die Datei ließ sich nicht lesen (${(x as Error)?.name ?? x}). Liegt sie nur in iCloud? Erst in der Dateien-App öffnen, dann erneut wählen.`);
  }
}

// Die gespeicherte PDF-Datei eines Stücks ist auf dem Gerät nicht mehr lesbar.
export class DateiVerloren extends Error {
  constructor() {
    super('Die PDF-Datei dieses Stücks ist auf dem Gerät nicht mehr lesbar. In der Bibliothek „Auswählen“, das Stück antippen, „Aktualisieren“ und die Datei neu wählen — Stellen und Anmerkungen bleiben erhalten.');
  }
}

// Datensatz und Datei in EINER Transaktion: ganz oder gar nicht. Der Datensatz
// geht immer ohne Blob in die Datenbank.
const mitDatei = (n: LokaleNoten, daten: ArrayBuffer, typ: string) =>
  transaktion<void>(['noten', 'dateien'], 'readwrite', (t) => {
    t.objectStore('noten').put(ohneDatei(n));
    t.objectStore('dateien').put({ id: n.id, daten, typ } satisfies LokaleDatei);
  });

export async function notenAnlegen(n: { titel: string; stimme: string; datei: Blob; dateiname?: string; handle?: FileSystemFileHandle; sammlungen?: string[]; tags?: string[] }): Promise<string> {
  const id = crypto.randomUUID();
  const daten = await bytesLesen(n.datei);
  const jetzt = Date.now();
  await mitDatei({ ...ohneDatei(n), id, erstellt: jetzt, geaendert: jetzt, groesse: daten.byteLength }, daten, n.datei.type || 'application/pdf');
  dauerhaftAnfragen();
  return id;
}

// Ändert Felder der Noten; mit `datei` wird die PDF-Datei ersetzt. Ein Stück,
// das seine Datei noch im Datensatz trägt, zieht dabei um — der Blob wird nie
// zurückgeschrieben. Ist die alte Datei verloren, bleibt alles, wie es ist
// (DateiVerloren); retten lässt es sich mit einer neu gewählten Datei.
export async function notenAendern(id: string, felder: Partial<LokaleNoten>) {
  const neu = felder.datei ? { daten: await bytesLesen(felder.datei), typ: felder.datei.type || 'application/pdf' } : null;
  const alt = await notenHolen(id);
  if (!alt) return;
  const n = { ...alt, ...ohneDatei(felder), id, geaendert: Date.now(), ...(neu ? { groesse: neu.daten.byteLength } : {}) };
  if (neu) return mitDatei(n, neu.daten, neu.typ);
  if (alt.datei) {
    const daten = await alteDateiLesen(alt.datei);
    return mitDatei(n, daten, alt.datei.type || 'application/pdf');
  }
  await tx('noten', 'readwrite', (s) => s.put(ohneDatei(n)));
}

async function alteDateiLesen(datei: Blob): Promise<ArrayBuffer> {
  try { return await datei.arrayBuffer(); } catch (x) { throw dateiVerloren(x) ? new DateiVerloren() : x; }
}

// Umzug einer gelesenen alten Datei: Bytes in „dateien“, Datensatz ohne Blob
// — in einem Schritt und auf dem Datensatz, wie er jetzt ist (nebenher
// umbenannt bleibt umbenannt). Inzwischen gelöscht, ersetzt oder schon
// umgezogen: nichts tun.
const umzugSchreiben = (id: string, daten: ArrayBuffer, typ: string) =>
  transaktion<void>(['noten', 'dateien'], 'readwrite', (t, abbrechen) => {
    const noten = t.objectStore('noten');
    const r = noten.get(id) as IDBRequest<LokaleNoten | undefined>;
    r.onsuccess = () => {
      try {
        if (!r.result?.datei) return;
        noten.put(ohneDatei(r.result));
        t.objectStore('dateien').put({ id, daten, typ } satisfies LokaleDatei);
      } catch (x) { abbrechen(x); }
    };
  });

// Die PDF-Datei eines Stücks. Trägt es sie noch als Blob im Datensatz, zieht
// sie dabei in „dateien“ um. Scheitert nur der Umzug, zählt die gelesene Datei
// trotzdem — er wird beim nächsten Mal versucht.
export async function notenDatei(n: LokaleNoten): Promise<Blob> {
  const eintrag = await tx<LokaleDatei | undefined>('dateien', 'readonly', (s) => s.get(n.id));
  const quelle = dateiQuelle(eintrag, n);
  if (quelle === 'dateien') return new Blob([eintrag!.daten], { type: eintrag!.typ || 'application/pdf' });
  if (quelle === 'keine' || !n.datei) throw new DateiVerloren();
  const daten = await alteDateiLesen(n.datei);
  const typ = n.datei.type || 'application/pdf';
  await umzugSchreiben(n.id, daten, typ).catch((x) => console.error('Umzug der PDF-Datei verschoben', x));
  return new Blob([daten], { type: typ });
}

// Alle Stücke, die ihre Datei noch als Blob tragen, nacheinander umziehen —
// im Hintergrund nach dem Laden der Bibliothek und vor jeder Sicherung. Alte
// Blobs liest Safari nur, solange die Verbindung offen ist, und verliert sie
// mitunter; als Bytes sind sie sicher. Jeder Datensatz wird erst unmittelbar
// vor dem Lesen geholt. Eine verlorene Datei bleibt, wie sie ist (die
// Sicherung nennt das Stück). Läuft schon ein Umzug, wird er mitgenutzt.
let umzug: Promise<void> | null = null;
export function alleUmziehen(): Promise<void> {
  umzug ??= (async () => {
    const ids = (await alleNoten()).filter((n) => n.datei).map((n) => n.id);
    for (const id of ids) {
      try {
        const n = await notenHolen(id);
        if (!n?.datei) continue;
        await umzugSchreiben(id, await n.datei.arrayBuffer(), n.datei.type || 'application/pdf');
      } catch (x) {
        console.warn('PDF-Datei nicht umgezogen', id, x);
      }
    }
  })().finally(() => { umzug = null; });
  return umzug;
}

// „Zuletzt geöffnet“ liegt auf dem Gerät im localStorage, nicht im
// Datensatz: Jedes Schreiben des Datensatzes schreibt die PDF-Datei mit —
// Öffnen soll gar nicht in die Datenbank schreiben. Der ältere Stand im
// Datensatz (n.zuletzt) gilt weiter (zuletztAus in @/domain/speicher).
const ZULETZT = 'ueben:zuletzt';
export function zuletztListe(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ZULETZT) ?? '{}') ?? {}; } catch { return {}; }
}
export function zuletztMerken(id: string) {
  try { localStorage.setItem(ZULETZT, JSON.stringify({ ...zuletztListe(), [id]: Date.now() })); } catch { /* egal */ }
}
// Wann zuletzt eine Sicherung gespeichert wurde (H-01: Erinnerung in der Bibliothek).
const LETZTE_SICHERUNG = 'ueben:letzte-sicherung';
export function letzteSicherung(): number | null {
  try { const t = Number(localStorage.getItem(LETZTE_SICHERUNG)); return t > 0 ? t : null; } catch { return null; }
}
export function sicherungGespeichert() {
  try { localStorage.setItem(LETZTE_SICHERUNG, String(Date.now())); } catch { /* egal */ }
}

// Noten samt Stellen und Anmerkungen löschen (innerhalb einer Transaktion).
function notenEntfernen(t: IDBTransaction, id: string, abbrechen: (x: unknown) => void) {
  t.objectStore('noten').delete(id);
  t.objectStore('dateien').delete(id);
  for (const name of ['stellen', 'anmerkungen'] as const) {
    const s = t.objectStore(name);
    const r = s.index('notenId').getAllKeys(id);
    r.onsuccess = () => {
      try { for (const k of r.result) s.delete(k); } catch (x) { abbrechen(x); }
    };
  }
}
// Noten samt Stellen und Anmerkungen in EINER Transaktion: ganz oder gar nicht.
// Der Grabstein sorgt dafür, dass eine Sicherung sie nicht zurückbringt.
export async function notenLoeschen(id: string) {
  await transaktion<void>(ALLE_MIT_DATEIEN, 'readwrite', (t, abbrechen) => notenEntfernen(t, id, abbrechen));
  begraben('noten', id);
}

// ── Grabsteine (gelöschte Noten und Stellen) ── auf dem Gerät im
// localStorage; sie reisen mit der Sicherung (Regeln in @/domain/einspielen).
const GRAB = 'ueben:geloescht';
export function grabsteineHier(): Grabstein[] {
  try { return grabsteineLesen(JSON.parse(localStorage.getItem(GRAB) ?? '[]')); } catch { return []; }
}
function grabsteineSetzen(g: Grabstein[]) {
  try { localStorage.setItem(GRAB, JSON.stringify(grabsteineVereinigen(g, [], Date.now()))); } catch { /* egal */ }
}
function begraben(art: Grabstein['art'], ...ids: string[]) {
  const am = Date.now();
  grabsteineSetzen([...grabsteineHier(), ...ids.map((id) => ({ art, id, am }))]);
}

// ── Sammlungen und Tags ── Mehrere Stücke in EINER Transaktion umsortieren
// bzw. markieren. Ein Datensatz, der seine PDF noch als alten Blob trägt,
// zieht dabei über notenAendern um (der Blob wird nie zurückgeschrieben).
type Einordnung = Pick<LokaleNoten, 'sammlungen' | 'tags'>;
async function einordnen(aenderungen: { id: string; felder: Einordnung }[]) {
  const mitBlob: typeof aenderungen = [];
  const jetzt = Date.now();
  await transaktion<void>('noten', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('noten');
    for (const a of aenderungen) {
      const r = s.get(a.id) as IDBRequest<LokaleNoten | undefined>;
      r.onsuccess = () => {
        try {
          if (!r.result) return;
          if (r.result.datei) { mitBlob.push(a); return; }
          s.put({ ...r.result, ...a.felder, geaendert: jetzt });
        } catch (x) { abbrechen(x); }
      };
    }
  });
  for (const a of mitBlob) await notenAendern(a.id, a.felder);
}
export const sammlungenSetzen = (aenderungen: { id: string; sammlungen: string[] }[]) =>
  einordnen(aenderungen.map(({ id, sammlungen }) => ({ id, felder: { sammlungen } })));
export const tagsSetzen = (aenderungen: { id: string; tags: string[] }[]) =>
  einordnen(aenderungen.map(({ id, tags }) => ({ id, felder: { tags } })));

// Tag-Definitionen (F-14) auf dem Gerät; sie reisen im Kopf der Sicherung mit.
const TAGS = 'ueben:tags';
export function tagsLaden(): Tag[] {
  try { return tagsLesen(JSON.parse(localStorage.getItem(TAGS) ?? '[]')); } catch { return []; }
}
function tagsSpeichern(tags: Tag[]) {
  try { localStorage.setItem(TAGS, JSON.stringify(tags)); } catch { /* egal */ }
}
// Gibt es den Namen schon (Groß/klein egal), kommt der vorhandene Tag zurück
// — keine Doppelten.
export function tagAnlegen(name: string, farbe: TagFarbe): Tag {
  const tags = tagsLaden();
  const da = tagMitNamen(tags, name);
  if (da) return da;
  const tag = { id: crypto.randomUUID(), name, farbe, geaendert: Date.now() };
  tagsSpeichern([...tags, tag]);
  return tag;
}
// Umbenennen auf einen Namen, den ein anderer Tag trägt: nichts ändern (false).
export function tagAendern(id: string, felder: { name?: string; farbe?: TagFarbe }): boolean {
  const tags = tagsLaden();
  const bisher = tags.find((t) => t.id === id);
  const umbenannt = felder.name !== undefined && (!bisher || tagSchluessel(felder.name) !== tagSchluessel(bisher.name));
  if (umbenannt && tagMitNamen(tags, felder.name!, id)) return false;
  tagsSpeichern(tags.map((t) => (t.id === id ? { ...t, ...felder, geaendert: Date.now() } : t)));
  return true;
}

// Ein Datensatz mit umgeschriebenen Tag-ids; null, wenn sich nichts ändert.
// `geaendert` bleibt: Nur die ids ändern sich, nicht das Stück — sonst gälte
// es beim nächsten Laden als neuer als Änderungen vom anderen Gerät.
function mitTagTabelle<N extends object>(n: N, tabelle: Record<string, string>): N | null {
  const alt = (n as { tags?: unknown }).tags;
  if (!Array.isArray(alt)) return null;
  const neu = tagsUmschreiben(tagsVon({ tags: alt }), tabelle);
  return neu.length === alt.length && neu.every((x, i) => x === alt[i]) ? null : { ...n, tags: neu };
}

// Gemerkter Tag-Filter der Bibliothek und Bereich des laufenden Mix: zeigt
// er auf eine zusammengelegte id, auf die bleibende umstellen.
function tagVerweiseUmschreiben(tabelle: Record<string, string>) {
  const neu = (id: unknown) => (typeof id === 'string' && Object.hasOwn(tabelle, id) ? tabelle[id] : null);
  try {
    const filter = neu(JSON.parse(localStorage.getItem('ueben:tag') ?? 'null'));
    if (filter) localStorage.setItem('ueben:tag', JSON.stringify(filter));
    const mix = JSON.parse(localStorage.getItem('ueben:mix-an') ?? 'null') as { tag?: unknown } | null;
    const mixTag = mix && typeof mix === 'object' ? neu(mix.tag) : null;
    if (mixTag) localStorage.setItem('ueben:mix-an', JSON.stringify({ ...mix, tag: mixTag }));
  } catch { /* egal */ }
}

// Gleichnamige Tags auf diesem Gerät zu einem zusammenlegen (Regeln in
// tagsAbgleichen): die Stücke in EINER Transaktion umschreiben, dann die
// Tags. Liefert, wie viele Tags dabei wegfielen.
type Abgleich = ReturnType<typeof tagsAbgleichen>;
export async function doppelteZusammenfuehren(): Promise<number> {
  const vorher = tagsLaden();
  const { abgleich, mitBlob } = await transaktion<{ abgleich: Abgleich | null; mitBlob: LokaleNoten[] }>('noten', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('noten');
    const alle = s.getAll() as IDBRequest<LokaleNoten[]>;
    let abgleich: Abgleich | null = null;
    const mitBlob: LokaleNoten[] = [];
    alle.onsuccess = () => {
      try {
        abgleich = tagsAbgleichen(vorher, [], [], { hier: alle.result });
        mitBlob.push(...stueckeUmschreiben(s, alle.result, abgleich.tabelle));
      } catch (x) { abbrechen(x); }
    };
    return () => ({ abgleich, mitBlob });
  });
  if (!abgleich) return 0;
  const { tags, tabelle } = abgleich;
  tagsSpeichern(tags);
  tagVerweiseUmschreiben(tabelle);
  await nachziehen(mitBlob);
  return vorher.length - tags.length;
}
// Die Tag-Listen hiesiger Stücke umschreiben (in der laufenden Transaktion).
// Den alten Blob nie zurückschreiben: Solche Stücke kommen zurück und ziehen
// danach über notenAendern um (nachziehen).
function stueckeUmschreiben(s: IDBObjectStore, noten: LokaleNoten[], tabelle: Record<string, string>): LokaleNoten[] {
  const mitBlob: LokaleNoten[] = [];
  for (const n of noten) {
    const neu = mitTagTabelle(n, tabelle);
    if (!neu) continue;
    if (n.datei) mitBlob.push(neu); else s.put(neu);
  }
  return mitBlob;
}
// Stücke, die ihre PDF noch als alten Blob tragen: umschreiben und dabei umziehen.
async function nachziehen(noten: LokaleNoten[]) {
  for (const n of noten) {
    try { await notenAendern(n.id, { tags: n.tags }); } catch (x) { console.warn('Tags eines Stücks nicht umgeschrieben', n.id, x); }
  }
}
// Tonprofile (C-04) auf dem Gerät, neueste zuerst; sie reisen im Kopf der Sicherung mit.
const TONPROFILE = 'ueben:tonprofile';
export function tonprofileLaden(): Tonprofil[] {
  try { return profileLesen(JSON.parse(localStorage.getItem(TONPROFILE) ?? '[]')); } catch { return []; }
}
// Wirft, wenn der Speicher voll ist — eine Messung soll nicht still verloren gehen.
function tonprofileSpeichern(p: Tonprofil[]) {
  localStorage.setItem(TONPROFILE, JSON.stringify(p));
}
export function tonprofilAnlegen(p: Omit<Tonprofil, 'id'>): Tonprofil {
  const neu = { ...p, id: crypto.randomUUID() };
  tonprofileSpeichern([neu, ...tonprofileLaden()]);
  return neu;
}
export function tonprofilLoeschen(id: string) {
  tonprofileSpeichern(tonprofileLaden().filter((p) => p.id !== id));
  begraben('tonprofil', id);
}

// Tag löschen: von allen Stücken nehmen, Grabstein für die anderen Geräte —
// auch unter seinen weiteren ids (dort heißt er womöglich anders).
export async function tagLoeschen(id: string) {
  const betroffen = (await alleNoten()).filter((n) => n.tags?.includes(id));
  await tagsSetzen(betroffen.map((n) => ({ id: n.id, tags: (n.tags ?? []).filter((x) => x !== id) })));
  const tags = tagsLaden();
  tagsSpeichern(tags.filter((t) => t.id !== id));
  begraben('tag', id, ...(tags.find((t) => t.id === id)?.auch ?? []));
}

// Größe der PDF je Stück — für ältere Stücke ohne `groesse` aus „dateien“ gelesen
// (einzeln, nur für die gefragten).
export async function dateiGroessen(noten: LokaleNoten[]): Promise<Map<string, number>> {
  const groessen = new Map<string, number>();
  for (const n of noten) {
    if (typeof n.groesse === 'number') { groessen.set(n.id, n.groesse); continue; }
    const d = await tx<LokaleDatei | undefined>('dateien', 'readonly', (s) => s.get(n.id));
    if (d?.daten instanceof ArrayBuffer) groessen.set(n.id, d.daten.byteLength);
    else if (n.datei) groessen.set(n.id, n.datei.size);
  }
  return groessen;
}

// ── Stellen ──
// Alle Stellen aller Stücke (Stellen-Mix, Zählen in der Bibliothek).
export const alleStellen = () => tx<LokaleStelle[]>('stellen', 'readonly', (s) => s.getAll());
export const stellenVon = async (notenId: string) =>
  (await tx<LokaleStelle[]>('stellen', 'readonly', (s) => s.index('notenId').getAll(notenId)))
    .sort((a, b) => a.seite - b.seite || a.y - b.y);
export async function stelleAnlegen(st: Omit<LokaleStelle, 'id' | 'tempi' | 'notiz' | 'zielTempo'>, zielTempo: number | null = null) {
  await tx('stellen', 'readwrite', (s) => s.put({ ...st, id: crypto.randomUUID(), notiz: '', zielTempo, tempi: [], geaendert: Date.now() }));
}
export async function stelleAendern(id: string, felder: Partial<LokaleStelle>) {
  const alt = await tx<LokaleStelle | undefined>('stellen', 'readonly', (s) => s.get(id));
  if (alt) await tx('stellen', 'readwrite', (s) => s.put({ ...alt, ...felder, id, geaendert: Date.now() }));
}
export async function stelleLoeschen(id: string) {
  await tx('stellen', 'readwrite', (s) => s.delete(id));
  begraben('stelle', id);
}
export async function tempoGeschafft(id: string, tempo: number) {
  const alt = await tx<LokaleStelle | undefined>('stellen', 'readonly', (s) => s.get(id));
  if (alt) await stelleAendern(id, { tempi: [...alt.tempi, { tempo: Math.round(tempo), am: Date.now() }] });
}

// ── Anmerkungen (je Seite ein Datensatz) ──
export const anmerkungenVon = (notenId: string) =>
  tx<SeitenAnmerkungen[]>('anmerkungen', 'readonly', (s) => s.index('notenId').getAll(notenId));
// Merkt sich, was seit dem letzten Speichern weg ist (wegradiert, rückgängig)
// — und vergisst es wieder, wenn es zurückkommt (wiederholen).
export const anmerkungenSpeichern = (notenId: string, seite: number, objekte: Anmerkung[]) =>
  transaktion<void>('anmerkungen', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('anmerkungen');
    const id = `${notenId}:${seite}`;
    const r = s.get(id) as IDBRequest<SeitenAnmerkungen | undefined>;
    r.onsuccess = () => {
      try {
        const jetzt = new Set(objekte.map((o) => o.id));
        const weg = new Set([...(r.result?.entfernt ?? []), ...(r.result?.objekte ?? []).map((o) => o.id)].filter((x) => !jetzt.has(x)));
        s.put({ id, notenId, seite, objekte, entfernt: [...weg], geaendert: Date.now() } satisfies SeitenAnmerkungen);
      } catch (x) { abbrechen(x); }
    };
  });

// Bittet den Browser, die Daten nicht von selbst zu löschen. Still: Lehnt er
// ab oder kann er das nicht, bleibt es beim Normalfall.
let angefragt = false;
function dauerhaftAnfragen() {
  if (angefragt) return;
  angefragt = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* egal */ }
}

// ── Übe-Sicherung (.uebe, Format in @/domain/sicherung) ──
// In der Sicherung trägt jedes Stück seine Datei (fehlt sie, sortiert nurLesbare es aus).
type SicherungsNoten = LokaleNoten & { datei: Blob | undefined };
type Bestand = SicherungsInhalt<SicherungsNoten, LokaleStelle, SeitenAnmerkungen>;

// Alle drei Speicher in EINER Transaktion: ein stimmiger Stand, auch wenn
// nebenher etwas geändert wird. Die Verbindung bleibt offen — Safari kann die
// PDF-Blobs sonst nicht mehr lesen.
// Die Datei jedes Stücks kommt als Blob dazu (Format der Sicherung), aus
// „dateien“ oder — bei älteren — aus dem Datensatz.
export const allesLesen = () => transaktion<Bestand>(ALLE_MIT_DATEIEN, 'readonly', (t) => {
  const noten = t.objectStore('noten').getAll() as IDBRequest<LokaleNoten[]>;
  const stellen = t.objectStore('stellen').getAll() as IDBRequest<LokaleStelle[]>;
  const anmerkungen = t.objectStore('anmerkungen').getAll() as IDBRequest<SeitenAnmerkungen[]>;
  const dateien = t.objectStore('dateien').getAll() as IDBRequest<LokaleDatei[]>;
  return () => {
    const bytes = new Map(dateien.result.map((d) => [d.id, d]));
    const mit = noten.result.map((n) => {
      const d = bytes.get(n.id);
      const datei = dateiQuelle(d, n) === 'dateien' ? new Blob([d!.daten], { type: d!.typ || 'application/pdf' }) : n.datei;
      return { ...n, datei };
    });
    return { noten: mit, stellen: stellen.result, anmerkungen: anmerkungen.result };
  };
});

// Persönliche Einstellungen (Stimmung, Metronom, Stiftfarben …) im
// localStorage; sie reisen im Kopf der Sicherung mit, der neuere Stand
// gewinnt als Ganzes (Regeln in @/domain/einstellungen).
const merkzettel = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

// Setzt die Einstellungen einer Sicherung, wenn sie neuer sind als die hier;
// was der Datei fehlt, bleibt. Danach lesen Metronom, Stimmgerät & Co. neu.
function einstellungenUebernehmen(dort: EinstellungsStand | null): boolean {
  if (!uebernehmen(standHier(merkzettel(EINSTELLUNGEN_STAND), einstellungenSammeln(merkzettel)), dort)) return false;
  let gesetzt = true;
  try {
    for (const [k, v] of Object.entries(dort.werte)) localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem(EINSTELLUNGEN_STAND, String(dort.stand));
  } catch { gesetzt = false; }
  // Auch wenn nur ein Teil ankam: Was jetzt gespeichert ist, gilt überall.
  window.dispatchEvent(new Event(EINSTELLUNGEN_GELADEN));
  return gesetzt;
}

// Nicht lesbare Noten (kaputter, verlorener oder nicht ganz lesbarer
// PDF-Inhalt — jede Datei wird dafür einmal komplett gelesen) kommen samt
// ihren Stellen und Anmerkungen nicht mit; `fehlen` nennt sie.
export async function sicherungErstellen(): Promise<{ datei: Blob; noten: number; fehlen: LokaleNoten[] }> {
  // Erst alles als Bytes ablegen: Alte Blobs liest Safari beim Prüfen
  // mitunter nicht, obwohl das Stück sich öffnen lässt.
  await alleUmziehen();
  const { bestand, fehlen } = await nurLesbare(await allesLesen());
  // Nach nurLesbare trägt jedes verbliebene Stück eine lesbare Datei.
  const datei = await sicherungPacken(bestand as SicherungsInhalt<LokaleNoten & { datei: Blob }, LokaleStelle, SeitenAnmerkungen>, 'cheatsheet', Date.now(),
    { geloescht: grabsteineHier(), tags: tagsLaden(), tonprofile: tonprofileLaden(), einstellungen: einstellungenFuerSicherung(merkzettel) });
  return { datei, noten: bestand.noten.length, fehlen };
}

// Einspielen in zwei Schritten, damit die Oberfläche dazwischen nachfragen
// kann: erst lesen, prüfen und mit dem Gerät abgleichen — dabei wird nichts
// geschrieben —, dann alles in EINER Transaktion schreiben.
export interface Einspielung extends Einspielplan<Record<string, unknown> & { id: string; datei: Blob }> {
  erstellt: number;
  grabsteine: Grabstein[];
  tags: Tag[];
  tonprofile: Tonprofil[];
  einstellungen: EinstellungsStand | null;
}

// Falsche Datei gewählt: Der Vertrag sagt nur, dass es keine Sicherung ist —
// hier kommt dazu, wo die richtige liegt.
const FALSCHE_DATEI = 'Das ist keine Übe-Sicherung';
const WO_SIE_LIEGT = ' Bitte die .uebe-Datei wählen (in Dateien → Downloads).';

export async function sicherungPruefen(datei: Blob): Promise<Einspielung> {
  let gelesen: Awaited<ReturnType<typeof sicherungLesen>>;
  try {
    gelesen = await sicherungLesen(datei);
  } catch (e) {
    if (e instanceof SicherungsFehler && e.message.startsWith(FALSCHE_DATEI)) throw new SicherungsFehler(e.message + WO_SIE_LIEGT);
    // Alles, was das Format nicht selbst benennt (z. B. kaputter Kopf mit
    // falschen Typen), ist für die Person dasselbe.
    throw e instanceof SicherungsFehler ? e : new SicherungsFehler('Die Sicherung ist beschädigt.');
  }
  const { kopf, noten } = gelesen;
  // Was es hier gibt und wie neu es ist (für „neuer gewinnt“ und Grabsteine).
  const { vorhanden, staende } = await transaktion<{ vorhanden: Vorhanden; staende: Staende }>(ALLE, 'readonly', (t) => {
    const n = t.objectStore('noten').getAll() as IDBRequest<LokaleNoten[]>;
    const s = t.objectStore('stellen').getAll() as IDBRequest<LokaleStelle[]>;
    const a = t.objectStore('anmerkungen').getAllKeys();
    return () => ({
      vorhanden: { noten: new Set(n.result.map((x) => x.id)), stellen: new Set(s.result.map((x) => x.id)), anmerkungen: new Set(a.result.map(String)) },
      staende: {
        noten: new Map(n.result.map((x) => [x.id, { stand: stand(ohneDatei(x) as Record<string, unknown>), datei: dateiStand(x as unknown as Record<string, unknown>) }])),
        stellen: new Map(s.result.map((x) => [x.id, stand(x as unknown as Record<string, unknown>)])),
      },
    });
  });
  const grabsteine = grabsteineLesen(kopf.geloescht);
  const plan = einspielenPlanen({ noten, stellen: kopf.stellen, anmerkungen: kopf.anmerkungen }, vorhanden,
    { grabsteine, geraetGrabsteine: grabsteineHier(), staende });
  return { ...plan, erstellt: kopf.erstellt, grabsteine, tags: tagsLesen(kopf.tags), tonprofile: profileLesen(kopf.tonprofile),
    einstellungen: einstellungenLesen(kopf.einstellungen) };
}

// Schreibt eine geprüfte Sicherung: entweder kommt alles an oder nichts.
// Zusammenführen ohne Verlust (Regeln in @/domain/einspielen): Bei gleicher id
// gewinnen die Felder der Sicherung, aber Tempo-Verläufe und Striche werden
// vereinigt und der Dateiverweis des Geräts bleibt. Was es nur auf dem Gerät
// gibt, bleibt unberührt. Lesen und Schreiben in EINER readwrite-Transaktion:
// Was nebenher geändert wird, kann nicht zwischen Lesen und Schreiben fallen.
//
// Die PDFs gehen nie als Blob in die Datenbank (Safari verliert sie mitunter):
// Erst liegen sie einzeln als Bytes vorläufig in „dateien“ (Schlüssel
// „einspielen:<id>“) — so ist nie die ganze Sicherung zugleich im
// Arbeitsspeicher —, dann zieht die eine Transaktion sie an ihren Platz. Die
// Datei aus der Sicherung gewinnt. Reste eines abgebrochenen Laufs räumt der
// nächste weg.
const VORLAEUFIG = 'einspielen:';
export async function sicherungSchreiben(e: Einspielung): Promise<{
  neu: number; aktualisiert: number; stellen: number; anmerkungen: number; uebersprungen: number; geloescht: number; einstellungen: boolean;
}> {
  const vorlaeufig = () => IDBKeyRange.bound(VORLAEUFIG, `${VORLAEUFIG}\uffff`);
  await tx('dateien', 'readwrite', (s) => { s.delete(vorlaeufig()); });
  // Nur die PDFs, die aus der Sicherung kommen (dort nicht älter als hier).
  const dateiNehmen = new Set(e.dateiAusSicherung);
  for (const n of e.noten) {
    if (!dateiNehmen.has(n.id)) continue;
    const daten = await bytesLesen(n.datei);
    await tx('dateien', 'readwrite', (s) => s.put({ id: VORLAEUFIG + n.id, daten, typ: n.datei.type || 'application/pdf' } satisfies LokaleDatei));
  }
  const ids = [...new Set(e.noten.filter((n) => dateiNehmen.has(n.id)).map((n) => n.id))];
  const tagsVorher = tagsLaden();
  const grabsteine = [...grabsteineHier(), ...e.grabsteine];
  const { abgleich, mitBlob } = await transaktion<{ abgleich: Abgleich | null; mitBlob: LokaleNoten[] }>(ALLE_MIT_DATEIEN, 'readwrite', (t, abbrechen) => {
    const dateien = t.objectStore('dateien');
    // Nacheinander, damit nicht alle Dateien zugleich gelesen im Speicher liegen.
    const umziehen = (i: number) => {
      if (i >= ids.length) return;
      const r = dateien.get(VORLAEUFIG + ids[i]) as IDBRequest<LokaleDatei | undefined>;
      r.onsuccess = () => {
        try {
          if (!r.result) throw new Error('Eine Datei aus der Sicherung fehlt beim Einspielen — bitte noch einmal laden.');
          dateien.put({ ...r.result, id: ids[i] });
          dateien.delete(VORLAEUFIG + ids[i]);
          umziehen(i + 1);
        } catch (x) { abbrechen(x); }
      };
    };
    umziehen(0);
    const einspielen = <E extends { id: string }>(
      name: Speicher, eintraege: E[], zusammen: (geraet: Record<string, unknown> | undefined, neu: E) => E,
    ) => {
      const s = t.objectStore(name);
      // Stand je id: Kommt eine id mehrfach vor, baut jeder Eintrag auf dem vorigen auf.
      const stand = new Map<string, E>();
      for (const eintrag of eintraege) {
        const r = s.get(eintrag.id) as IDBRequest<Record<string, unknown> | undefined>;
        r.onsuccess = () => {
          try {
            const zusammengefuehrt = zusammen(stand.get(eintrag.id) ?? r.result, eintrag);
            stand.set(eintrag.id, zusammengefuehrt);
            s.put(zusammengefuehrt);
          } catch (x) { abbrechen(x); }
        };
      }
    };
    // Tags (Regeln in tagsAbgleichen): gleichnamige werden EIN Tag mit der
    // hiesigen id. Dafür erst alle Stücke hier lesen (für die Doppelten auf
    // dem Gerät zählt, welche id die meisten Stücke trägt), dann die
    // Tag-Listen umschreiben — die aus der Sicherung vor dem Zusammenführen,
    // die übrigen hiesigen direkt.
    const noten = t.objectStore('noten');
    const alle = noten.getAll() as IDBRequest<LokaleNoten[]>;
    let abgleich: Abgleich | null = null;
    const mitBlob: LokaleNoten[] = [];
    alle.onsuccess = () => {
      try {
        const a = tagsAbgleichen(tagsVorher, e.tags, grabsteine, { hier: alle.result, dort: e.noten });
        abgleich = a;
        const umschreiben = <N extends object>(n: N) => mitTagTabelle(n, a.tabelle) ?? n;
        // Datensätze ohne Blob — die Datei liegt jetzt in „dateien“. Kam sie aus
        // der Sicherung, gelten deren Zeitpunkt und Größe der Datei.
        einspielen('noten', e.noten.map(umschreiben), (g, n) => {
          const z = ohneDatei(notenZusammenfuehren(g && umschreiben(g), n)) as typeof n;
          if (!dateiNehmen.has(n.id)) return z;
          return { ...z, groesse: n.datei.size, ...(typeof n.aktualisiert === 'number' ? { aktualisiert: n.aktualisiert } : {}) };
        });
        // Die schon zusammengeführten und die gleich gelöschten nicht anfassen.
        const anders = new Set([...e.noten.map((n) => n.id), ...e.loeschen.noten]);
        mitBlob.push(...stueckeUmschreiben(noten, alle.result.filter((n) => !anders.has(n.id)), a.tabelle));
      } catch (x) { abbrechen(x); }
    };
    einspielen('stellen', e.stellen, stelleZusammenfuehren);
    einspielen('anmerkungen', e.anmerkungen, seiteZusammenfuehren);
    // Auf dem anderen Gerät gelöscht (und hier seitdem unverändert).
    for (const id of e.loeschen.noten) notenEntfernen(t, id, abbrechen);
    for (const id of e.loeschen.stellen) t.objectStore('stellen').delete(id);
    return () => ({ abgleich, mitBlob });
  });
  // Die Löschungen der Sicherung gelten jetzt auch hier — und reisen weiter;
  // dazu die Grabsteine gelöschter Tags unter ihren hiesigen ids.
  grabsteineSetzen([...grabsteineHier(), ...e.grabsteine, ...(abgleich?.grabsteine ?? [])]);
  if (abgleich) {
    tagsSpeichern(abgleich.tags);
    tagVerweiseUmschreiben(abgleich.tabelle);
  }
  await nachziehen(mitBlob);
  tonprofileSpeichern(profileVereinigen(tonprofileLaden(), e.tonprofile, grabsteineHier()));
  const einstellungen = einstellungenUebernehmen(e.einstellungen);
  dauerhaftAnfragen();
  return {
    neu: e.neu, aktualisiert: e.ueberschrieben.noten, stellen: e.stellen.length, anmerkungen: e.anmerkungen.length,
    uebersprungen: e.uebersprungen, geloescht: e.loeschen.noten.length + e.loeschen.stellen.length, einstellungen,
  };
}
