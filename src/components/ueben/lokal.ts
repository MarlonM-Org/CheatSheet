'use client';

import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';
import { einspielenPlanen, type Einspielplan } from '@/domain/einspielen';
import { sicherungLesen, sicherungPacken, SicherungsFehler } from '@/domain/sicherung';

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

async function tx<T>(speicher: Speicher, modus: IDBTransactionMode, arbeit: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const t = db.transaction(speicher, modus);
    const req = arbeit(t.objectStore(speicher));
    t.oncomplete = () => ok(req ? req.result : (undefined as T));
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error ?? new Error('Abgebrochen.'));
  });
}

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
export async function notenLoeschen(id: string) {
  for (const st of await stellenVon(id)) await stelleLoeschen(st.id);
  for (const a of await anmerkungenVon(id)) await tx('anmerkungen', 'readwrite', (s) => s.delete(a.id));
  await tx('noten', 'readwrite', (s) => s.delete(id));
}

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
export const alleStellen = () => tx<LokaleStelle[]>('stellen', 'readonly', (s) => s.getAll());
export const alleAnmerkungen = () => tx<SeitenAnmerkungen[]>('anmerkungen', 'readonly', (s) => s.getAll());

export async function sicherungErstellen(): Promise<Blob> {
  const [noten, stellen, anmerkungen] = await Promise.all([alleNoten(), alleStellen(), alleAnmerkungen()]);
  return sicherungPacken({ noten, stellen, anmerkungen }, 'cheatsheet', Date.now());
}

// Einspielen in zwei Schritten, damit die Oberfläche dazwischen nachfragen
// kann: erst lesen, prüfen und mit dem Gerät abgleichen — dabei wird nichts
// geschrieben —, dann alles in EINER Transaktion schreiben.
export interface Einspielung extends Einspielplan<Record<string, unknown> & { id: string; datei: Blob }> {
  erstellt: number;
}

export async function sicherungPruefen(datei: Blob): Promise<Einspielung> {
  let gelesen: Awaited<ReturnType<typeof sicherungLesen>>;
  try {
    gelesen = await sicherungLesen(datei);
  } catch (e) {
    // Alles, was das Format nicht selbst benennt (z. B. kaputter Kopf mit
    // falschen Typen), ist für die Person dasselbe.
    throw e instanceof SicherungsFehler ? e : new SicherungsFehler('Die Sicherung ist beschädigt.');
  }
  const { kopf, noten } = gelesen;
  const vorhanden = new Set((await tx<IDBValidKey[]>('noten', 'readonly', (s) => s.getAllKeys())).map(String));
  const plan = einspielenPlanen({ noten, stellen: kopf.stellen, anmerkungen: kopf.anmerkungen }, vorhanden);
  return { ...plan, erstellt: kopf.erstellt };
}

// Schreibt eine geprüfte Sicherung: entweder kommt alles an oder nichts.
// Ersetzte Noten bekommen genau den Stand der Sicherung — Stellen und
// Anmerkungen, die es dort zu ihnen nicht gibt, werden entfernt. Alle anderen
// Noten bleiben unberührt.
// Die PDF-Ausschnitte gehen direkt an put: IndexedDB legt ihren Inhalt selbst
// ab und hängt danach nicht mehr an der gewählten Datei.
export async function sicherungSchreiben(e: Einspielung): Promise<{ neu: number; ersetzt: number; stellen: number; anmerkungen: number; uebersprungen: number }> {
  const db = await oeffnen();
  await new Promise<void>((ok, fehler) => {
    const t = db.transaction(['noten', 'stellen', 'anmerkungen'], 'readwrite');
    let grund: unknown = null;
    t.oncomplete = () => ok();
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(grund ?? t.error ?? new Error('Speichern abgebrochen.'));
    const abbrechen = (x: unknown) => { grund ??= x; try { t.abort(); } catch { /* schon beendet */ } };
    try {
      const noten = t.objectStore('noten');
      const stellen = t.objectStore('stellen');
      const anmerkungen = t.objectStore('anmerkungen');
      for (const n of e.noten) noten.put(n);
      for (const st of e.stellen) stellen.put(st);
      for (const a of e.anmerkungen) anmerkungen.put(a);
      const behalten = new Map([
        [stellen, new Set(e.stellen.map((x) => x.id))],
        [anmerkungen, new Set(e.anmerkungen.map((x) => x.id))],
      ]);
      for (const notenId of e.ersetzt) {
        for (const [speicher, ids] of behalten) {
          const r = speicher.index('notenId').getAllKeys(notenId);
          r.onsuccess = () => {
            try {
              for (const k of r.result) if (!ids.has(String(k))) speicher.delete(k);
            } catch (x) { abbrechen(x); }
          };
        }
      }
    } catch (x) {
      abbrechen(x);
    }
  });
  dauerhaftAnfragen();
  return { neu: e.neu, ersetzt: e.ersetzt.length, stellen: e.stellen.length, anmerkungen: e.anmerkungen.length, uebersprungen: e.uebersprungen };
}
