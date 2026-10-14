'use client';

import {
  dateiVon, loeschFolgen, quelleFehler, seitenId, setlistenOhne,
  type Lesezeichen, type Loeschfolgen, type Merker, type SeitenAnmerkungen, type Setliste, type Stelle, type Stueck,
} from '@/domain/bestand';
import {
  dateiStand, einspielenPlanen, eintragZusammenfuehren, grabsteineLesen, grabsteineVereinigen, notenZusammenfuehren,
  nurGueltige, seiteZusammenfuehren, stand, stelleZusammenfuehren, type Einspielplan, type Grabstein, type Staende, type Vorhanden,
} from '@/domain/einspielen';
import {
  EINSTELLUNGEN_GELADEN, EINSTELLUNGEN_STAND, einstellungenFuerSicherung, einstellungenLesen, einstellungenSammeln, standHier, uebernehmen,
  type EinstellungsStand,
} from '@/domain/einstellungen';
import { nurLesbare } from '@/domain/lesbar';
import type { Anmerkung } from '@/domain/notenpult';
import { sicherungLesen, sicherungPacken, SicherungsFehler, type Zusatz } from '@/domain/sicherung';
import { verbindungVerloren } from '@/domain/speicher';
import { tagMitNamen, tagsAbgleichen, tagSchluessel, tagsLesen, tagsUmschreiben, tagsVon, type Tag, type TagFarbe } from '@/domain/tags';
import { profileLesen, profileVereinigen, type Tonprofil } from '@/domain/tonprofil';
import { ohneFehlende, vonSicherung, zurSicherung } from '@/domain/uebersetzen';
import { dateiQuelle, ohneDatei, VORGAENGER_SPEICHER } from '@/domain/vorgaenger';

export type { Lesezeichen, Merker, SeitenAnmerkungen, Setliste, Stelle, Stueck } from '@/domain/bestand';

// Ablage nur auf diesem Gerät (IndexedDB „cheatsheet“): Stücke mit ihrer
// PDF, markierte Stellen, geschaffte Tempi, Anmerkungen, Lesezeichen, Merker,
// Setlisten. Keine Datenbank, kein Server. Safari kann die Daten löschen,
// wenn die Seite lange nicht geöffnet wurde; als Home-Bildschirm-App
// seltener — dagegen hilft die Sicherung. Schema und Beziehungen:
// docs/datenmodell.md, Typen und Regeln: @/domain/bestand.
//
// Die Vorgängerin „ueben“ (bis Schema 3, Registerführer-Zuschnitt) wird nie
// geändert, nie umgebaut, nie gelöscht. Geöffnet wird sie nur zum Lesen, wenn
// jemand „Übernehmen“ wählt (vorgaengerPruefen), und nur, wenn die Liste der
// Datenbanken sie nennt (vorgaengerDa). Ihre Daten laufen dann durch dasselbe
// Einspielen wie eine Sicherung.
//
// Jede Änderung setzt `geaendert`: Beim Laden einer Sicherung gilt der neuere
// Stand. Gelöschtes hinterlässt einen Grabstein (localStorage), damit eine
// Sicherung es nicht zurückbringt (Regeln in @/domain/einspielen). Tag-
// Definitionen und Tonprofile liegen im localStorage und reisen im Kopf der
// Sicherung mit.
const DATENBANK = 'cheatsheet';
const VERSION = 1;
const VORGAENGER = 'ueben';

// Die PDF als reine Bytes, Schlüssel ist die id des Stücks. Nie ein Blob:
// Safari verliert Blobs in IndexedDB mitunter.
interface Datei { id: string; daten: ArrayBuffer; typ: string }

type Speicher = 'stuecke' | 'dateien' | 'stellen' | 'anmerkungen' | 'lesezeichen' | 'merker' | 'setlisten';
const ALLE: Speicher[] = ['stuecke', 'dateien', 'stellen', 'anmerkungen', 'lesezeichen', 'merker', 'setlisten'];
// Was per stueckId an einem Stück hängt.
const AM_STUECK = ['stellen', 'anmerkungen', 'lesezeichen', 'merker'] as const;

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
    const r = indexedDB.open(DATENBANK, VERSION);
    // Neue Versionen bekommen hier ihren eigenen Schritt (if e.oldVersion < 2 …)
    // und einen Migrationstest — nie Daten verwerfen.
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('stuecke', { keyPath: 'id' });
        db.createObjectStore('dateien', { keyPath: 'id' });
        for (const name of AM_STUECK) db.createObjectStore(name, { keyPath: 'id' }).createIndex('stueckId', 'stueckId');
        db.createObjectStore('setlisten', { keyPath: 'id' });
      }
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

// Ein Datensatz lesen, ändern, schreiben — in EINER Transaktion, damit nichts
// dazwischenfällt. Gibt es ihn nicht, bleibt alles, wie es ist.
const aendern = <T extends { id: string }>(speicher: Speicher, id: string, neu: (alt: T) => T) =>
  transaktion<void>(speicher, 'readwrite', (t, abbrechen) => {
    const s = t.objectStore(speicher);
    const r = s.get(id) as IDBRequest<T | undefined>;
    r.onsuccess = () => {
      try { if (r.result) s.put({ ...neu(r.result), id }); } catch (x) { abbrechen(x); }
    };
  });

// ── Stücke ──
export const alleStuecke = () => tx<Stueck[]>('stuecke', 'readonly', (s) => s.getAll());
export const stueckHolen = (id: string) => tx<Stueck | undefined>('stuecke', 'readonly', (s) => s.get(id));

// Eine gewählte Datei ist nicht lesbar (etwa noch nicht aus iCloud geladen).
export class DateiNichtLesbar extends Error {}
// Eine gewählte Datei ganz lesen. Eine nicht lesbare fällt hier mit klarer
// Meldung auf.
async function bytesLesen(datei: Blob): Promise<ArrayBuffer> {
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

// Datensatz und Datei in EINER Transaktion: ganz oder gar nicht.
const mitDatei = (s: Stueck, daten: ArrayBuffer, typ: string) =>
  transaktion<void>(['stuecke', 'dateien'], 'readwrite', (t) => {
    t.objectStore('stuecke').put(s);
    t.objectStore('dateien').put({ id: s.id, daten, typ } satisfies Datei);
  });

const typVon = (datei: Blob) => datei.type || 'application/pdf';

export async function stueckAnlegen(n: {
  titel: string; stimme: string; datei: Blob; dateiname?: string; handle?: FileSystemFileHandle; sammlungen?: string[]; tags?: string[];
}): Promise<string> {
  const id = crypto.randomUUID();
  const { datei, ...felder } = n;
  const daten = await bytesLesen(datei);
  const jetzt = Date.now();
  await mitDatei({ ...felder, id, erstellt: jetzt, geaendert: jetzt, groesse: daten.byteLength }, daten, typVon(datei));
  dauerhaftAnfragen();
  return id;
}

// Ändert Felder des Stücks; mit `datei` wird die PDF-Datei ersetzt (nur bei
// einem Stück mit eigener PDF).
export async function stueckAendern(id: string, felder: Partial<Omit<Stueck, 'id'>> & { datei?: Blob }) {
  const { datei, ...rest } = felder;
  if (!datei) return aendern<Stueck>('stuecke', id, (alt) => ({ ...alt, ...rest, geaendert: Date.now() }));
  const daten = await bytesLesen(datei);
  const alt = await stueckHolen(id);
  if (!alt) return;
  if (alt.quelle) throw new Error('Dieses Stück zeigt Seiten aus einem anderen — seine PDF lässt sich nicht ersetzen.');
  await mitDatei({ ...alt, ...rest, id, geaendert: Date.now(), groesse: daten.byteLength }, daten, typVon(datei));
}

// Ein virtuelles Stück: die Seiten von–bis aus der PDF eines echten Stücks
// (F-03). Die Quelle wird in derselben Transaktion geprüft.
export async function virtuellesAnlegen(n: Omit<Stueck, 'id' | 'erstellt' | 'quelle'> & { quelle: NonNullable<Stueck['quelle']> }): Promise<string> {
  const id = crypto.randomUUID();
  await transaktion<void>('stuecke', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('stuecke');
    const r = s.get(n.quelle.stueckId) as IDBRequest<Stueck | undefined>;
    r.onsuccess = () => {
      const fehler = quelleFehler(n.quelle, r.result);
      if (fehler) abbrechen(new Error(fehler));
      else { const jetzt = Date.now(); s.put({ ...n, id, erstellt: jetzt, geaendert: jetzt } satisfies Stueck); }
    };
  });
  return id;
}

// Die PDF-Datei eines Stücks — bei einem virtuellen die seiner Quelle.
export async function stueckDatei(s: Pick<Stueck, 'id' | 'quelle'>): Promise<Blob> {
  const eintrag = await tx<Datei | undefined>('dateien', 'readonly', (d) => d.get(dateiVon(s)));
  if (!(eintrag?.daten instanceof ArrayBuffer)) throw new DateiVerloren();
  return new Blob([eintrag.daten], { type: eintrag.typ || 'application/pdf' });
}

// „Zuletzt geöffnet“ liegt auf dem Gerät im localStorage, nicht im
// Datensatz: Öffnen soll gar nicht in die Datenbank schreiben. Der ältere
// Stand im Datensatz (s.zuletzt) gilt weiter (zuletztAus in @/domain/speicher).
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

// ── Grabsteine (Gelöschtes) ── auf dem Gerät im localStorage; sie reisen mit
// der Sicherung (Regeln in @/domain/einspielen).
const GRAB = 'ueben:geloescht';
export function grabsteineHier(): Grabstein[] {
  try { return grabsteineLesen(JSON.parse(localStorage.getItem(GRAB) ?? '[]')); } catch { return []; }
}
function grabsteineSetzen(g: Grabstein[]) {
  try { localStorage.setItem(GRAB, JSON.stringify(grabsteineVereinigen(g, [], Date.now()))); } catch { /* egal */ }
}
function begraben(art: Grabstein['art'], ids: readonly string[]) {
  if (!ids.length) return;
  const am = Date.now();
  grabsteineSetzen([...grabsteineHier(), ...ids.map((id) => ({ art, id, am }))]);
}

// ── Sammlungen und Tags ── Mehrere Stücke in EINER Transaktion umsortieren
// bzw. markieren.
type Einordnung = Pick<Stueck, 'sammlungen' | 'tags'>;
const einordnen = (aenderungen: { id: string; felder: Einordnung }[]) =>
  transaktion<void>('stuecke', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('stuecke');
    const jetzt = Date.now();
    for (const a of aenderungen) {
      const r = s.get(a.id) as IDBRequest<Stueck | undefined>;
      r.onsuccess = () => {
        try { if (r.result) s.put({ ...r.result, ...a.felder, geaendert: jetzt }); } catch (x) { abbrechen(x); }
      };
    }
  });
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
// Der eigene, unveränderte Name geht immer (Umfärben, auch solange es Doppelte gibt).
export function tagAendern(id: string, felder: { name?: string; farbe?: TagFarbe }): boolean {
  const tags = tagsLaden();
  const bisher = tags.find((t) => t.id === id);
  const umbenannt = felder.name !== undefined && (!bisher || tagSchluessel(felder.name) !== tagSchluessel(bisher.name));
  if (umbenannt && tagMitNamen(tags, felder.name!, id)) return false;
  tagsSpeichern(tags.map((t) => (t.id === id ? { ...t, ...felder, geaendert: Date.now() } : t)));
  return true;
}
// Tag löschen: von allen Stücken nehmen, Grabstein für die anderen Geräte —
// auch unter seinen weiteren ids (dort heißt er womöglich anders).
export async function tagLoeschen(id: string) {
  const betroffen = (await alleStuecke()).filter((n) => n.tags?.includes(id));
  await tagsSetzen(betroffen.map((n) => ({ id: n.id, tags: (n.tags ?? []).filter((x) => x !== id) })));
  const tags = tagsLaden();
  tagsSpeichern(tags.filter((t) => t.id !== id));
  begraben('tag', [id, ...(tags.find((t) => t.id === id)?.auch ?? [])]);
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

// Die Tag-Listen hiesiger Stücke umschreiben (in der laufenden Transaktion).
function stueckeUmschreiben(s: IDBObjectStore, stuecke: Stueck[], tabelle: Record<string, string>) {
  for (const n of stuecke) {
    const neu = mitTagTabelle(n, tabelle);
    if (neu) s.put(neu);
  }
}

// Gleichnamige Tags auf diesem Gerät zu einem zusammenlegen (Regeln in
// tagsAbgleichen): die Stücke in EINER Transaktion umschreiben, dann die
// Tags. Liefert, wie viele Tags dabei wegfielen.
type Abgleich = ReturnType<typeof tagsAbgleichen>;
export async function doppelteZusammenfuehren(): Promise<number> {
  const vorher = tagsLaden();
  const abgleich = await transaktion<Abgleich | null>('stuecke', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('stuecke');
    const alle = s.getAll() as IDBRequest<Stueck[]>;
    let a: Abgleich | null = null;
    alle.onsuccess = () => {
      try {
        a = tagsAbgleichen(vorher, [], [], { hier: alle.result });
        stueckeUmschreiben(s, alle.result, a.tabelle);
      } catch (x) { abbrechen(x); }
    };
    return () => a;
  });
  if (!abgleich) return 0;
  tagsSpeichern(abgleich.tags);
  tagVerweiseUmschreiben(abgleich.tabelle);
  return vorher.length - abgleich.tags.length;
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
  begraben('tonprofil', [id]);
}

// Größe der PDF je Stück — für Stücke ohne `groesse` aus „dateien“ gelesen
// (einzeln, nur für die gefragten). Virtuelle Stücke haben keine eigene.
export async function dateiGroessen(stuecke: Stueck[]): Promise<Map<string, number>> {
  const groessen = new Map<string, number>();
  for (const n of stuecke) {
    if (n.quelle) continue;
    if (typeof n.groesse === 'number') { groessen.set(n.id, n.groesse); continue; }
    const d = await tx<Datei | undefined>('dateien', 'readonly', (s) => s.get(n.id));
    if (d?.daten instanceof ArrayBuffer) groessen.set(n.id, d.daten.byteLength);
  }
  return groessen;
}

// Was alles an den Stücken hängt, die gelöscht werden sollen — für die
// Rückfrage, bevor etwas passiert (Regeln in @/domain/bestand).
const LOESCHBESTAND: Speicher[] = ['stuecke', 'lesezeichen', 'merker', 'setlisten'];
function loeschbestandLesen(t: IDBTransaction) {
  const [stuecke, lesezeichen, merker, setlisten] = LOESCHBESTAND.map((n) => t.objectStore(n).getAll());
  return () => ({
    stuecke: stuecke.result as Stueck[], lesezeichen: lesezeichen.result as Lesezeichen[],
    merker: merker.result as Merker[], setlisten: setlisten.result as Setliste[],
  });
}
export const loeschVorschau = (ids: string[]) =>
  transaktion<Loeschfolgen>(LOESCHBESTAND, 'readonly', (t) => {
    const bestand = loeschbestandLesen(t);
    return () => loeschFolgen(ids, bestand(), Date.now());
  });

// Stücke samt allem, was an ihnen hängt, innerhalb einer laufenden
// Transaktion über alle Speicher löschen; `fertig` bekommt die Folgen.
// Virtuelle Stücke aus einer gelöschten Quelle fallen mit weg, Setlisten
// verlieren die Einträge darauf. Die geteilten Stellen und Anmerkungen eines
// virtuellen Stücks liegen bei der Quelle und bleiben, solange es sie gibt.
function entfernen(t: IDBTransaction, ids: string[], abbrechen: (x: unknown) => void, fertig: (f: Loeschfolgen) => void) {
  const bestand = loeschbestandLesen(t);
  // Der letzte der Lesezugriffe meldet, wann alles da ist.
  const letzter = t.objectStore('setlisten').count();
  letzter.onsuccess = () => {
    try {
      const f = loeschFolgen(ids, bestand(), Date.now());
      fertig(f);
      for (const id of f.stuecke) {
        t.objectStore('stuecke').delete(id);
        t.objectStore('dateien').delete(id);
        for (const name of ['stellen', 'anmerkungen'] as const) {
          const s = t.objectStore(name);
          const r = s.index('stueckId').getAllKeys(id);
          r.onsuccess = () => {
            try { for (const k of r.result) s.delete(k); } catch (x) { abbrechen(x); }
          };
        }
      }
      for (const id of f.lesezeichen) t.objectStore('lesezeichen').delete(id);
      for (const id of f.merker) t.objectStore('merker').delete(id);
      for (const s of f.setlisten) t.objectStore('setlisten').put(s);
    } catch (x) { abbrechen(x); }
  };
}
const folgenBegraben = (f: Loeschfolgen) => {
  begraben('noten', f.stuecke);
  begraben('lesezeichen', f.lesezeichen);
  begraben('merker', f.merker);
};

// Stücke samt allem, was an ihnen hängt, in EINER Transaktion: ganz oder gar
// nicht. Die Grabsteine sorgen dafür, dass eine Sicherung sie nicht zurückbringt.
export async function stueckeLoeschen(ids: string[]): Promise<Loeschfolgen> {
  const folgen = await transaktion<Loeschfolgen>(ALLE, 'readwrite', (t, abbrechen) => {
    let f: Loeschfolgen | null = null;
    entfernen(t, ids, abbrechen, (x) => { f = x; });
    return () => f!;
  });
  folgenBegraben(folgen);
  return folgen;
}

// ── Stellen ──
// Alle Stellen aller Stücke (Stellen-Mix, Zählen in der Bibliothek).
export const alleStellen = () => tx<Stelle[]>('stellen', 'readonly', (s) => s.getAll());
export const stellenVon = async (stueckId: string) =>
  (await tx<Stelle[]>('stellen', 'readonly', (s) => s.index('stueckId').getAll(stueckId)))
    .sort((a, b) => a.seite - b.seite || a.y - b.y);
export async function stelleAnlegen(st: Omit<Stelle, 'id' | 'tempi' | 'notiz' | 'zielTempo' | 'geaendert'>, zielTempo: number | null = null) {
  await tx('stellen', 'readwrite', (s) => s.put({ ...st, id: crypto.randomUUID(), notiz: '', zielTempo, tempi: [], geaendert: Date.now() } satisfies Stelle));
}
export const stelleAendern = (id: string, felder: Partial<Omit<Stelle, 'id'>>) =>
  aendern<Stelle>('stellen', id, (alt) => ({ ...alt, ...felder, geaendert: Date.now() }));
export async function stelleLoeschen(id: string) {
  await tx('stellen', 'readwrite', (s) => s.delete(id));
  begraben('stelle', [id]);
}
export const tempoGeschafft = (id: string, tempo: number) =>
  aendern<Stelle>('stellen', id, (alt) => ({ ...alt, tempi: [...alt.tempi, { tempo: Math.round(tempo), am: Date.now() }], geaendert: Date.now() }));

// ── Anmerkungen (je Seite ein Datensatz) ──
export const anmerkungenVon = (stueckId: string) =>
  tx<SeitenAnmerkungen[]>('anmerkungen', 'readonly', (s) => s.index('stueckId').getAll(stueckId));
// Merkt sich, was seit dem letzten Speichern weg ist (wegradiert, rückgängig)
// — und vergisst es wieder, wenn es zurückkommt (wiederholen).
export const anmerkungenSpeichern = (stueckId: string, seite: number, objekte: Anmerkung[]) =>
  transaktion<void>('anmerkungen', 'readwrite', (t, abbrechen) => {
    const s = t.objectStore('anmerkungen');
    const id = seitenId(stueckId, seite);
    const r = s.get(id) as IDBRequest<SeitenAnmerkungen | undefined>;
    r.onsuccess = () => {
      try {
        const jetzt = new Set(objekte.map((o) => o.id));
        const weg = new Set([...(r.result?.entfernt ?? []), ...(r.result?.objekte ?? []).map((o) => o.id)].filter((x) => !jetzt.has(x)));
        s.put({ id, stueckId, seite, objekte, entfernt: [...weg], geaendert: Date.now() } satisfies SeitenAnmerkungen);
      } catch (x) { abbrechen(x); }
    };
  });

// ── Lesezeichen (F-03) ──
export const lesezeichenVon = async (stueckId: string) =>
  (await tx<Lesezeichen[]>('lesezeichen', 'readonly', (s) => s.index('stueckId').getAll(stueckId))).sort((a, b) => a.seite - b.seite);
export async function lesezeichenAnlegen(l: Pick<Lesezeichen, 'stueckId' | 'seite' | 'titel'>): Promise<string> {
  const id = crypto.randomUUID();
  const jetzt = Date.now();
  await tx('lesezeichen', 'readwrite', (s) => s.put({ ...l, id, erstellt: jetzt, geaendert: jetzt } satisfies Lesezeichen));
  return id;
}
export const lesezeichenAendern = (id: string, felder: Partial<Pick<Lesezeichen, 'seite' | 'titel'>>) =>
  aendern<Lesezeichen>('lesezeichen', id, (alt) => ({ ...alt, ...felder, geaendert: Date.now() }));
// Samt den Einträgen in Setlisten, in EINER Transaktion.
export async function lesezeichenLoeschen(id: string) {
  await transaktion<void>(['lesezeichen', 'setlisten'], 'readwrite', (t, abbrechen) => {
    t.objectStore('lesezeichen').delete(id);
    const s = t.objectStore('setlisten');
    const r = s.getAll() as IDBRequest<Setliste[]>;
    r.onsuccess = () => {
      try { for (const sl of setlistenOhne(r.result, new Set(), new Set([id]), Date.now())) s.put(sl); } catch (x) { abbrechen(x); }
    };
  });
  begraben('lesezeichen', [id]);
}

// ── Merker (F-04): einer je Seite ──
export const merkerVon = (stueckId: string) => tx<Merker[]>('merker', 'readonly', (s) => s.index('stueckId').getAll(stueckId));
export const alleMerker = () => tx<Merker[]>('merker', 'readonly', (s) => s.getAll());
export async function merkerSetzen(stueckId: string, seite: number, gesetzt: boolean) {
  const id = seitenId(stueckId, seite);
  const jetzt = Date.now();
  await tx('merker', 'readwrite', (s) => {
    if (gesetzt) s.put({ id, stueckId, seite, gesetzt: jetzt, geaendert: jetzt } satisfies Merker);
    else s.delete(id);
  });
  if (!gesetzt) begraben('merker', [id]);
}
export async function alleMerkerLoeschen() {
  const ids = await transaktion<string[]>('merker', 'readwrite', (t) => {
    const s = t.objectStore('merker');
    const r = s.getAllKeys();
    s.clear();
    return () => r.result.map(String);
  });
  begraben('merker', ids);
}

// ── Setlisten (F-02) ──
export const alleSetlisten = () => tx<Setliste[]>('setlisten', 'readonly', (s) => s.getAll());
export const setlisteHolen = (id: string) => tx<Setliste | undefined>('setlisten', 'readonly', (s) => s.get(id));
export async function setlisteAnlegen(titel: string): Promise<string> {
  const id = crypto.randomUUID();
  const jetzt = Date.now();
  await tx('setlisten', 'readwrite', (s) => s.put({ id, titel, erstellt: jetzt, geaendert: jetzt, eintraege: [] } satisfies Setliste));
  return id;
}
export const setlisteAendern = (id: string, felder: Partial<Pick<Setliste, 'titel' | 'eintraege'>>) =>
  aendern<Setliste>('setlisten', id, (alt) => ({ ...alt, ...felder, aktualisiert: Date.now(), geaendert: Date.now() }));
export async function setlisteLoeschen(id: string) {
  await tx('setlisten', 'readwrite', (s) => s.delete(id));
  begraben('setliste', [id]);
}

// Bittet den Browser, die Daten nicht von selbst zu löschen. Still: Lehnt er
// ab oder kann er das nicht, bleibt es beim Normalfall.
let angefragt = false;
function dauerhaftAnfragen() {
  if (angefragt) return;
  angefragt = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* egal */ }
}

// Liegt auf dem Gerät noch die Datenbank der Vorgängerversion? Nur über die
// Liste der Datenbanken: indexedDB.open würde eine leere anlegen, wo keine
// war. Kennt der Browser die Liste nicht, heißt die Antwort nein.
export async function vorgaengerDa(): Promise<boolean> {
  try {
    const liste = await indexedDB.databases?.();
    return !!liste?.some((d) => d.name === VORGAENGER);
  } catch {
    return false;
  }
}

// ── Sicherung (.uebe, Format in @/domain/sicherung) ──

// Alles in EINER Transaktion: ein stimmiger Stand, auch wenn nebenher etwas
// geändert wird. Echte Stücke tragen ihre PDF als Blob (Format der
// Sicherung), virtuelle reisen in einer eigenen Liste ohne PDF.
const allesLesen = () => transaktion(ALLE, 'readonly', (t) => {
  const r = Object.fromEntries(ALLE.map((n) => [n, t.objectStore(n).getAll()])) as Record<Speicher, IDBRequest<unknown[]>>;
  return () => {
    const stuecke = r.stuecke.result as Stueck[];
    const bytes = new Map((r.dateien.result as Datei[]).map((d) => [d.id, d]));
    const echte = stuecke.filter((s) => !s.quelle).map((s) => {
      const d = bytes.get(s.id);
      return { ...s, datei: d ? new Blob([d.daten], { type: d.typ || 'application/pdf' }) : undefined };
    });
    return {
      echte,
      stellen: (r.stellen.result as Stelle[]).map(zurSicherung),
      anmerkungen: (r.anmerkungen.result as SeitenAnmerkungen[]).map(zurSicherung),
      zusatz: {
        virtuelle: stuecke.filter((s) => s.quelle),
        lesezeichen: r.lesezeichen.result as Lesezeichen[],
        merker: r.merker.result as Merker[],
        setlisten: r.setlisten.result as Setliste[],
      },
    };
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

// Nicht lesbare Stücke (kaputter, verlorener oder nicht ganz lesbarer
// PDF-Inhalt — jede Datei wird dafür einmal komplett gelesen) kommen samt
// allem, was an ihnen hängt, nicht mit; `fehlen` nennt sie. Grabsteine,
// Tag-Definitionen und Tonprofile reisen im Kopf mit.
export async function sicherungErstellen(): Promise<{ datei: Blob; noten: number; fehlen: Stueck[] }> {
  const alles = await allesLesen();
  const { bestand, fehlen } = await nurLesbare({ noten: alles.echte, stellen: alles.stellen, anmerkungen: alles.anmerkungen });
  const { zusatz, fehlenVirtuelle } = ohneFehlende(alles.zusatz, new Set(fehlen.map((n) => n.id)));
  // Nach nurLesbare trägt jedes verbliebene Stück eine lesbare Datei.
  const noten = bestand.noten as (Stueck & { datei: Blob })[];
  const datei = await sicherungPacken({ ...bestand, noten }, 'cheatsheet', Date.now(), {
    ...(zusatz as unknown as Zusatz), geloescht: grabsteineHier(), tags: tagsLaden(), tonprofile: tonprofileLaden(),
    einstellungen: einstellungenFuerSicherung(merkzettel),
  });
  return { datei, noten: noten.length + zusatz.virtuelle.length, fehlen: [...fehlen, ...fehlenVirtuelle] };
}

// Einspielen in zwei Schritten, damit die Oberfläche dazwischen nachfragen
// kann: erst lesen, prüfen und mit dem Gerät abgleichen — dabei wird nichts
// geschrieben —, dann alles in EINER Transaktion schreiben.
// Bei der Übernahme aus „ueben“ kann einem Stück die Datei fehlen (`datei`
// leer, `ohnePdf` nennt es); es kommt trotzdem samt Stellen und Anmerkungen.
export interface Einspielung extends Einspielplan<Record<string, unknown> & { id: string; datei?: Blob }> {
  erstellt: number;
  grabsteine: Grabstein[];
  tags: Tag[];
  tonprofile: Tonprofil[];
  // Persönliche Einstellungen aus der Sicherung (nicht bei der Übernahme aus „ueben“).
  einstellungen: EinstellungsStand | null;
  // Nur bei der Übernahme aus „ueben“: Titel der Stücke ohne lesbare PDF,
  // weggelassene kaputte Einträge, Dateiverweise (gehören zu diesem Gerät).
  ohnePdf?: string[];
  ungueltig?: number;
  verweise?: ReadonlyMap<string, FileSystemFileHandle>;
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
  return planen({ ...kopf, noten }, kopf);
}

// Mit dem Gerät abgleichen — liest nur. Was es hier gibt und wie neu es ist
// (für „neuer gewinnt“ und Grabsteine).
async function planen(
  inhalt: { noten: (Record<string, unknown> & { id: string; datei?: Blob })[]; stellen: unknown[]; anmerkungen: unknown[] } & Partial<Zusatz>,
  kopf: { erstellt: number; geloescht?: unknown; tags?: unknown; tonprofile?: unknown; einstellungen?: unknown },
): Promise<Einspielung> {
  const namen: Speicher[] = ['stuecke', 'stellen', 'anmerkungen', 'lesezeichen', 'merker', 'setlisten'];
  const { vorhanden, staende } = await transaktion<{ vorhanden: Vorhanden; staende: Staende }>(namen, 'readonly', (t) => {
    const [st, s, a, l, m, sl] = namen.map((name) => t.objectStore(name).getAll()) as IDBRequest<Record<string, unknown>[]>[];
    const ids = (r: IDBRequest<Record<string, unknown>[]>) => new Set(r.result.map((x) => x.id as string));
    const staendeVon = (r: IDBRequest<Record<string, unknown>[]>) => new Map(r.result.map((x) => [x.id as string, stand(x)]));
    return () => {
      const stuecke = st.result as unknown as Stueck[];
      return {
        vorhanden: {
          noten: ids(st), echte: new Set(stuecke.filter((x) => !x.quelle).map((x) => x.id)),
          stellen: ids(s), anmerkungen: ids(a), lesezeichen: ids(l), merker: ids(m), setlisten: ids(sl),
        },
        staende: {
          noten: new Map(st.result.map((x) => [x.id as string, { stand: stand(x), datei: dateiStand(x) }])),
          stellen: staendeVon(s), lesezeichen: staendeVon(l), merker: staendeVon(m), setlisten: staendeVon(sl),
        },
      };
    };
  });
  const grabsteine = grabsteineLesen(kopf.geloescht);
  const plan = einspielenPlanen(inhalt, vorhanden, { grabsteine, geraetGrabsteine: grabsteineHier(), staende });
  return {
    ...plan, erstellt: kopf.erstellt, grabsteine, tags: tagsLesen(kopf.tags), tonprofile: profileLesen(kopf.tonprofile),
    einstellungen: einstellungenLesen(kopf.einstellungen),
  };
}

// ── Übernahme aus der Vorgängerin „ueben“ ── nur lesend.

// Ohne Versionsangabe geöffnet: kein Umbau, kein Schreiben. Verschwindet die
// Datenbank genau zwischen Nachfrage und Öffnen, würde das eine leere
// anlegen — dann bricht das Anlegen ab.
function vorgaengerOeffnen(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((ok, fehler) => {
    let aufgegeben = false;
    const wecker = window.setTimeout(() => {
      aufgegeben = true;
      fehler(new Error('Der alte Speicher antwortet nicht. Bitte neu laden.'));
    }, 8000);
    const r = indexedDB.open(VORGAENGER);
    r.onupgradeneeded = () => { r.transaction?.abort(); };
    r.onsuccess = () => {
      window.clearTimeout(wecker);
      // Kam die Verbindung doch noch, nachdem wir aufgegeben haben: gleich wieder zu.
      if (aufgegeben) r.result.close(); else ok(r.result);
    };
    r.onerror = () => { window.clearTimeout(wecker); fehler(r.error ?? new Error('Der alte Speicher ließ sich nicht öffnen.')); };
  });
}

// Alles aus „ueben“ in EINER lesenden Transaktion — je nach Schema gibt es
// nicht jeden Speicher.
async function vorgaengerLesen(): Promise<Partial<Record<(typeof VORGAENGER_SPEICHER)[number], unknown[]>>> {
  const db = await vorgaengerOeffnen();
  try {
    const namen = VORGAENGER_SPEICHER.filter((n) => db.objectStoreNames.contains(n));
    if (!namen.length) return {};
    return await new Promise((ok, fehler) => {
      const t = db.transaction(namen, 'readonly');
      const r = namen.map((n) => t.objectStore(n).getAll());
      t.oncomplete = () => ok(Object.fromEntries(namen.map((n, i) => [n, r[i].result])));
      t.onabort = () => fehler(t.error ?? new Error('Der alte Speicher hat das Lesen abgebrochen.'));
    });
  } finally {
    db.close();
  }
}

type AlteNoten = Record<string, unknown> & { id: string; titel: string; datei?: unknown; handle?: FileSystemFileHandle };

// Die Noten aus „ueben“ wie eine Sicherung abgleichen; geschrieben wird mit
// sicherungSchreiben (dieselben Regeln: neuerer Stand, Grabsteine, keine
// Dubletten). Die PDF kommt aus „dateien“ oder, bei älteren Stücken, aus dem
// Datensatz; ist keine lesbar, kommt das Stück ohne sie (`ohnePdf`) — seine
// Stellen und Anmerkungen bleiben, die Datei lässt sich neu wählen.
// Kaputte Einträge fallen weg (`ungueltig`), statt alles aufzuhalten.
export async function vorgaengerPruefen(): Promise<Einspielung> {
  if (!(await vorgaengerDa())) throw new SicherungsFehler('Auf diesem Gerät gibt es keine Noten aus der Vorgängerversion.');
  const alt = await vorgaengerLesen();
  const dateien = new Map((alt.dateien ?? []).map((d) => [(d as Datei).id, d]));
  delete alt.dateien;
  const { noten: gueltig, stellen, anmerkungen, ungueltig } = nurGueltige({
    noten: (alt.noten ?? []) as AlteNoten[], stellen: alt.stellen ?? [], anmerkungen: alt.anmerkungen ?? [],
  });
  const noten: (Record<string, unknown> & { id: string; datei?: Blob })[] = [];
  const ohnePdf: string[] = [];
  const verweise = new Map<string, FileSystemFileHandle>();
  for (const n of gueltig) {
    const eintrag = dateien.get(n.id) as Datei | undefined;
    let datei: Blob | undefined;
    const quelle = dateiQuelle(eintrag, n);
    if (quelle === 'dateien') datei = new Blob([eintrag!.daten], { type: eintrag!.typ || 'application/pdf' });
    // Die gelesenen Bytes freigeben, sobald sie im Blob stecken.
    dateien.delete(n.id);
    if (quelle === 'datensatz') {
      // Safari verliert solche Blobs mitunter — dann eben ohne Datei.
      try { datei = new Blob([await (n.datei as Blob).arrayBuffer()], { type: typVon(n.datei as Blob) }); } catch { /* verloren */ }
    }
    if (!datei) ohnePdf.push(n.titel);
    if (n.handle) verweise.set(n.id, n.handle);
    noten.push({ ...ohneDatei(n), id: n.id, ...(datei ? { datei } : {}) });
  }
  return { ...(await planen({ noten, stellen, anmerkungen }, { erstellt: Date.now() })), ohnePdf, ungueltig, verweise };
}

// Schreibt eine geprüfte Sicherung: entweder kommt alles an oder nichts.
// Zusammenführen ohne Verlust (Regeln in @/domain/einspielen): Bei gleicher id
// gilt der neuere Stand, Tempo-Verläufe und Striche werden vereinigt,
// Wegradiertes bleibt weg, der Dateiverweis des Geräts bleibt. Was auf dem
// anderen Gerät gelöscht und hier seitdem unverändert ist, wird auch hier
// gelöscht. Was es nur auf dem Gerät gibt, bleibt unberührt. Lesen und
// Schreiben in EINER readwrite-Transaktion: Was nebenher geändert wird, kann
// nicht zwischen Lesen und Schreiben fallen. Stellen und Anmerkungen kommen
// im Zuschnitt der Sicherung (notenId) und werden übersetzt.
//
// Die PDFs gehen nie als Blob in die Datenbank (Safari verliert sie mitunter):
// Erst liegen sie einzeln als Bytes vorläufig in „dateien“ (Schlüssel
// „einspielen:<id>“) — so ist nie die ganze Sicherung zugleich im
// Arbeitsspeicher —, dann zieht die eine Transaktion sie an ihren Platz. Nur
// PDFs, die dort nicht älter sind als hier. Reste eines abgebrochenen Laufs
// räumt der nächste weg.
const VORLAEUFIG = 'einspielen:';
export async function sicherungSchreiben(e: Einspielung): Promise<{
  neu: number; aktualisiert: number; stellen: number; anmerkungen: number; uebersprungen: number; geloescht: number;
  lesezeichen: number; merker: number; setlisten: number; einstellungen: boolean;
}> {
  const vorlaeufig = () => IDBKeyRange.bound(VORLAEUFIG, `${VORLAEUFIG}￿`);
  await tx('dateien', 'readwrite', (s) => { s.delete(vorlaeufig()); });
  // Nur Stücke, die ihre Datei auch mitbringen (bei der Übernahme aus „ueben“
  // kann sie fehlen).
  const mitDateiDa = new Set(e.noten.filter((n) => n.datei).map((n) => n.id));
  const dateiNehmen = new Set(e.dateiAusSicherung.filter((id) => mitDateiDa.has(id)));
  for (const n of e.noten) {
    const datei = n.datei;
    if (!dateiNehmen.has(n.id) || !datei) continue;
    const daten = await bytesLesen(datei);
    await tx('dateien', 'readwrite', (s) => s.put({ id: VORLAEUFIG + n.id, daten, typ: typVon(datei) } satisfies Datei));
  }
  const ids = [...new Set(e.noten.filter((n) => dateiNehmen.has(n.id)).map((n) => n.id))];
  let folgen: Loeschfolgen | null = null;
  const tagsVorher = tagsLaden();
  const grabsteine = [...grabsteineHier(), ...e.grabsteine];
  let abgleich: Abgleich | null = null;
  await transaktion<void>(ALLE, 'readwrite', (t, abbrechen) => {
    const dateien = t.objectStore('dateien');
    // Nacheinander, damit nicht alle Dateien zugleich gelesen im Speicher liegen.
    const umziehen = (i: number) => {
      if (i >= ids.length) return;
      const r = dateien.get(VORLAEUFIG + ids[i]) as IDBRequest<Datei | undefined>;
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
    // hiesigen id. Dafür erst alle Stücke hier lesen (für Doppelte auf dem
    // Gerät zählt, welche id die meisten Stücke trägt); dann die Tag-Listen
    // umschreiben — die aus der Sicherung vor dem Zusammenführen, die übrigen
    // hiesigen direkt. Alles Weitere wird erst danach eingereiht, damit die
    // Reihenfolge unten (Löschen nach allem Einspielen) erhalten bleibt.
    const stuecke = t.objectStore('stuecke');
    const alle = stuecke.getAll() as IDBRequest<Stueck[]>;
    alle.onsuccess = () => {
      try {
        const a = tagsAbgleichen(tagsVorher, e.tags, grabsteine, { hier: alle.result, dort: [...e.noten, ...e.zusatz.virtuelle] });
        abgleich = a;
        const umschreiben = <N extends object>(n: N) => mitTagTabelle(n, a.tabelle) ?? n;
        // Datensätze ohne Blob — die Datei liegt in „dateien“. Kam sie aus der
        // Sicherung, gelten deren Zeitpunkt und Größe der Datei. Bei der
        // Übernahme aus „ueben“ kommt der Dateiverweis mit, wenn hier keiner ist.
        einspielen('stuecke', e.noten.map(umschreiben), (g, n) => {
          const { datei, ...zusammen } = notenZusammenfuehren(g && umschreiben(g), n);
          const verweis = zusammen.handle === undefined ? e.verweise?.get(n.id) : undefined;
          const z = verweis ? { ...zusammen, handle: verweis } : zusammen;
          if (!dateiNehmen.has(n.id) || !datei) return z as typeof n;
          return { ...z, groesse: datei.size, ...(typeof n.aktualisiert === 'number' ? { aktualisiert: n.aktualisiert } : {}) } as unknown as typeof n;
        });
        einspielen('stuecke', e.zusatz.virtuelle.map(umschreiben), (g, n) => notenZusammenfuehren(g && umschreiben(g), n));
        // Die schon zusammengeführten und die gleich gelöschten nicht anfassen.
        const anders = new Set([...e.noten, ...e.zusatz.virtuelle].map((n) => n.id).concat(e.loeschen.noten));
        stueckeUmschreiben(stuecke, alle.result.filter((n) => !anders.has(n.id)), a.tabelle);
        einspielen('stellen', e.stellen.map(vonSicherung), stelleZusammenfuehren);
        einspielen('anmerkungen', e.anmerkungen.map(vonSicherung), seiteZusammenfuehren);
        einspielen('lesezeichen', e.zusatz.lesezeichen, eintragZusammenfuehren);
        einspielen('merker', e.zusatz.merker, eintragZusammenfuehren);
        einspielen('setlisten', e.zusatz.setlisten, eintragZusammenfuehren);
        // Auf dem anderen Gerät gelöscht (und hier seitdem unverändert) — erst
        // nach dem Einspielen. Die Datensätze schreibt jeweils der Erfolg ihres
        // Lesens; diese Anfrage steht hinter allen Lesezugriffen oben, ihr Erfolg
        // kommt also erst, wenn alles Geschriebene schon eingereiht ist. So sieht
        // das Löschen die geladenen Setlisten (und nicht den alten Stand, der sie
        // sonst überschreiben würde) und nimmt ihnen die Einträge.
        const eingespielt = t.objectStore('setlisten').count();
        eingespielt.onsuccess = () => {
          try {
            for (const id of e.loeschen.stellen) t.objectStore('stellen').delete(id);
            for (const id of e.loeschen.lesezeichen ?? []) t.objectStore('lesezeichen').delete(id);
            for (const id of e.loeschen.merker ?? []) t.objectStore('merker').delete(id);
            for (const id of e.loeschen.setlisten ?? []) t.objectStore('setlisten').delete(id);
            if (e.loeschen.noten.length) entfernen(t, e.loeschen.noten, abbrechen, (f) => { folgen = f; });
          } catch (x) { abbrechen(x); }
        };
      } catch (x) { abbrechen(x); }
    };
  });
  // Die Löschungen der Sicherung gelten jetzt auch hier — und reisen weiter;
  // dazu die Grabsteine gelöschter Tags unter ihren hiesigen ids.
  const ergebnis = abgleich as Abgleich | null;
  grabsteineSetzen([...grabsteineHier(), ...e.grabsteine, ...(ergebnis?.grabsteine ?? [])]);
  if (folgen) folgenBegraben(folgen);
  if (ergebnis) {
    tagsSpeichern(ergebnis.tags);
    tagVerweiseUmschreiben(ergebnis.tabelle);
  }
  tonprofileSpeichern(profileVereinigen(tonprofileLaden(), e.tonprofile, grabsteineHier()));
  const einstellungen = einstellungenUebernehmen(e.einstellungen);
  dauerhaftAnfragen();
  const l = e.loeschen;
  return {
    neu: e.neu, aktualisiert: e.ueberschrieben.noten, stellen: e.stellen.length, anmerkungen: e.anmerkungen.length,
    uebersprungen: e.uebersprungen,
    geloescht: l.noten.length + l.stellen.length + (l.lesezeichen?.length ?? 0) + (l.merker?.length ?? 0) + (l.setlisten?.length ?? 0),
    lesezeichen: e.zusatz.lesezeichen.length, merker: e.zusatz.merker.length, setlisten: e.zusatz.setlisten.length,
    einstellungen,
  };
}
