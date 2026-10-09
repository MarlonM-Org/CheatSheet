'use client';

import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';
import { einspielenPlanen, type Einspielplan, type Vorhanden } from '@/domain/einspielen';
import { nurLesbare } from '@/domain/lesbar';
import { sicherungLesen, sicherungPacken, SicherungsFehler, type SicherungsInhalt } from '@/domain/sicherung';

// Ablage nur auf diesem Gerät (IndexedDB): Noten-PDFs, markierte Stellen,
// geschaffte Tempi, Anmerkungen. Keine Datenbank, kein Server. Safari kann die
// Daten löschen, wenn die Seite lange nicht geöffnet wurde; als
// Home-Bildschirm-App seltener — dagegen hilft die Übe-Sicherung.
// Name und Schema der Datenbank wie in der Registerführer-App („ueben“, Version 2).

export interface LokaleNoten {
  id: string; titel: string; stimme: string; erstellt: number; datei: Blob;
  dateiname?: string;
  zuletzt?: number;
  aktualisiert?: number;
  // Nur Chrome/Edge am Rechner: Verweis auf die Datei, um ohne Dateiauswahl neu zu laden.
  handle?: FileSystemFileHandle;
  blaettern?: { modus: Blaettermodus; linien: Record<number, number> };
}
export interface LokaleStelle {
  id: string; notenId: string; seite: number; x: number; y: number; b: number; h: number;
  titel: string; notiz: string; zielTempo: number | null; tempi: { tempo: number; am: number }[];
}
export interface SeitenAnmerkungen { id: string; notenId: string; seite: number; objekte: Anmerkung[] }

type Speicher = 'noten' | 'stellen' | 'anmerkungen';

// Eine Verbindung für die ganze Seite, einmal geöffnet und wiederverwendet.
// Will ein anderes Fenster (neuere Version) das Schema anheben, gibt diese
// Seite die Verbindung frei und öffnet beim nächsten Zugriff neu.
let verbindung: Promise<IDBDatabase> | null = null;

function oeffnen(): Promise<IDBDatabase> {
  verbindung ??= new Promise<IDBDatabase>((ok, fehler) => {
    let aufgegeben = false;
    const r = indexedDB.open('ueben', 2);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('noten', { keyPath: 'id' });
        db.createObjectStore('stellen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
      }
      if (e.oldVersion < 2) db.createObjectStore('anmerkungen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
    };
    r.onsuccess = () => {
      const db = r.result;
      // Kam die Verbindung doch noch, nachdem wir aufgegeben haben: gleich wieder zu.
      if (aufgegeben) { db.close(); return; }
      db.onversionchange = () => { db.close(); verbindung = null; };
      db.onclose = () => { verbindung = null; };
      ok(db);
    };
    r.onerror = () => { verbindung = null; fehler(r.error); };
    // Ein anderes Fenster hält noch eine ältere Version offen.
    r.onblocked = () => {
      aufgegeben = true;
      verbindung = null;
      fehler(new Error('Der Gerätespeicher ist gerade blockiert. Bitte andere CheatSheet-Fenster und -Tabs schließen und neu laden.'));
    };
  });
  return verbindung;
}

// Eine Transaktion über einen oder mehrere Speicher. Abgelehnt wird nur in
// onabort: Jeder Fehler bricht die Transaktion ab, und erst dann steht der
// Grund in t.error (in onerror ist er noch leer). Wirft die Arbeit selbst,
// bricht sie mit genau diesem Grund ab. `arbeit` liefert optional, was nach
// dem Abschluss herauskommt.
async function transaktion<T>(
  speicher: Speicher | Speicher[],
  modus: IDBTransactionMode,
  arbeit: (t: IDBTransaction, abbrechen: (grund: unknown) => void) => (() => T) | void,
): Promise<T> {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const t = db.transaction(speicher, modus);
    let grund: unknown = null;
    let ergebnis: (() => T) | void = undefined;
    const abbrechen = (x: unknown) => { grund ??= x; try { t.abort(); } catch { /* schon beendet */ } };
    t.oncomplete = () => ok(ergebnis ? ergebnis() : (undefined as T));
    t.onabort = () => fehler(grund ?? t.error ?? new Error('Der Gerätespeicher hat den Vorgang abgebrochen.'));
    try { ergebnis = arbeit(t, abbrechen); } catch (x) { abbrechen(x); }
  });
}

const tx = <T>(speicher: Speicher, modus: IDBTransactionMode, arbeit: (s: IDBObjectStore) => IDBRequest<T> | void) =>
  transaktion<T>(speicher, modus, (t) => {
    const req = arbeit(t.objectStore(speicher));
    return req ? () => req.result : undefined;
  });

const ALLE: Speicher[] = ['noten', 'stellen', 'anmerkungen'];

// ── Noten ──
export const alleNoten = () => tx<LokaleNoten[]>('noten', 'readonly', (s) => s.getAll());
export const notenHolen = (id: string) => tx<LokaleNoten | undefined>('noten', 'readonly', (s) => s.get(id));
export async function notenAnlegen(n: { titel: string; stimme: string; datei: Blob; dateiname?: string; handle?: FileSystemFileHandle }): Promise<string> {
  const id = crypto.randomUUID();
  await tx('noten', 'readwrite', (s) => s.put({ ...n, id, erstellt: Date.now() }));
  dauerhaftAnfragen();
  return id;
}
export async function notenAendern(id: string, felder: Partial<LokaleNoten>) {
  const alt = await notenHolen(id);
  if (alt) await tx('noten', 'readwrite', (s) => s.put({ ...alt, ...felder, id }));
}
// Noten samt Stellen und Anmerkungen in EINER Transaktion: ganz oder gar nicht.
export const notenLoeschen = (id: string) => transaktion<void>(ALLE, 'readwrite', (t, abbrechen) => {
  t.objectStore('noten').delete(id);
  for (const name of ['stellen', 'anmerkungen'] as const) {
    const s = t.objectStore(name);
    const r = s.index('notenId').getAllKeys(id);
    r.onsuccess = () => {
      try { for (const k of r.result) s.delete(k); } catch (x) { abbrechen(x); }
    };
  }
});

// ── Stellen ──
export const stellenVon = async (notenId: string) =>
  (await tx<LokaleStelle[]>('stellen', 'readonly', (s) => s.index('notenId').getAll(notenId)))
    .sort((a, b) => a.seite - b.seite || a.y - b.y);
export async function stelleAnlegen(st: Omit<LokaleStelle, 'id' | 'tempi' | 'notiz' | 'zielTempo'>) {
  await tx('stellen', 'readwrite', (s) => s.put({ ...st, id: crypto.randomUUID(), notiz: '', zielTempo: null, tempi: [] }));
}
export async function stelleAendern(id: string, felder: Partial<LokaleStelle>) {
  const alt = await tx<LokaleStelle | undefined>('stellen', 'readonly', (s) => s.get(id));
  if (alt) await tx('stellen', 'readwrite', (s) => s.put({ ...alt, ...felder, id }));
}
export const stelleLoeschen = (id: string) => tx('stellen', 'readwrite', (s) => s.delete(id));
export async function tempoGeschafft(id: string, tempo: number) {
  const alt = await tx<LokaleStelle | undefined>('stellen', 'readonly', (s) => s.get(id));
  if (alt) await stelleAendern(id, { tempi: [...alt.tempi, { tempo: Math.round(tempo), am: Date.now() }] });
}

// ── Anmerkungen (je Seite ein Datensatz) ──
export const anmerkungenVon = (notenId: string) =>
  tx<SeitenAnmerkungen[]>('anmerkungen', 'readonly', (s) => s.index('notenId').getAll(notenId));
export const anmerkungenSpeichern = (notenId: string, seite: number, objekte: Anmerkung[]) =>
  tx('anmerkungen', 'readwrite', (s) => s.put({ id: `${notenId}:${seite}`, notenId, seite, objekte }));

// Bittet den Browser, die Daten nicht von selbst zu löschen. Still: Lehnt er
// ab oder kann er das nicht, bleibt es beim Normalfall.
let angefragt = false;
function dauerhaftAnfragen() {
  if (angefragt) return;
  angefragt = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* egal */ }
}

// ── Übe-Sicherung (.uebe, Format in @/domain/sicherung) ──
type Bestand = SicherungsInhalt<LokaleNoten, LokaleStelle, SeitenAnmerkungen>;

// Alle drei Speicher in EINER Transaktion: ein stimmiger Stand, auch wenn
// nebenher etwas geändert wird. Die Verbindung bleibt offen — Safari kann die
// PDF-Blobs sonst nicht mehr lesen.
export const allesLesen = () => transaktion<Bestand>(ALLE, 'readonly', (t) => {
  const noten = t.objectStore('noten').getAll() as IDBRequest<LokaleNoten[]>;
  const stellen = t.objectStore('stellen').getAll() as IDBRequest<LokaleStelle[]>;
  const anmerkungen = t.objectStore('anmerkungen').getAll() as IDBRequest<SeitenAnmerkungen[]>;
  return () => ({ noten: noten.result, stellen: stellen.result, anmerkungen: anmerkungen.result });
});

// Nicht lesbare Noten (kaputter oder verlorener PDF-Inhalt) kommen samt ihren
// Stellen und Anmerkungen nicht mit; `fehlen` nennt sie.
export async function sicherungErstellen(): Promise<{ datei: Blob; noten: number; fehlen: LokaleNoten[] }> {
  const { bestand, fehlen } = await nurLesbare(await allesLesen());
  const datei = await sicherungPacken(bestand, 'cheatsheet', Date.now());
  return { datei, noten: bestand.noten.length, fehlen };
}

// Einspielen in zwei Schritten, damit die Oberfläche dazwischen nachfragen
// kann: erst lesen, prüfen und mit dem Gerät abgleichen — dabei wird nichts
// geschrieben —, dann alles in EINER Transaktion schreiben.
export interface Einspielung extends Einspielplan<Record<string, unknown> & { id: string; datei: Blob }> {
  erstellt: number;
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
  const vorhanden = await transaktion<Vorhanden>(ALLE, 'readonly', (t) => {
    const [n, s, a] = ALLE.map((name) => t.objectStore(name).getAllKeys());
    const ids = (r: IDBRequest<IDBValidKey[]>) => new Set(r.result.map(String));
    return () => ({ noten: ids(n), stellen: ids(s), anmerkungen: ids(a) });
  });
  const plan = einspielenPlanen({ noten, stellen: kopf.stellen, anmerkungen: kopf.anmerkungen }, vorhanden);
  return { ...plan, erstellt: kopf.erstellt };
}

// Schreibt eine geprüfte Sicherung: entweder kommt alles an oder nichts.
// Zusammenführen: Bei gleicher id gewinnt die Sicherung; Stellen und
// Anmerkungen, die es nur auf dem Gerät gibt, bleiben.
// Die PDF-Ausschnitte gehen direkt an put: IndexedDB legt ihren Inhalt selbst
// ab und hängt danach nicht mehr an der gewählten Datei.
export async function sicherungSchreiben(e: Einspielung): Promise<{ neu: number; aktualisiert: number; stellen: number; anmerkungen: number; uebersprungen: number }> {
  await transaktion<void>(ALLE, 'readwrite', (t) => {
    const noten = t.objectStore('noten');
    const stellen = t.objectStore('stellen');
    const anmerkungen = t.objectStore('anmerkungen');
    for (const n of e.noten) noten.put(n);
    for (const st of e.stellen) stellen.put(st);
    for (const a of e.anmerkungen) anmerkungen.put(a);
  });
  dauerhaftAnfragen();
  return { neu: e.neu, aktualisiert: e.ueberschrieben.noten, stellen: e.stellen.length, anmerkungen: e.anmerkungen.length, uebersprungen: e.uebersprungen };
}
