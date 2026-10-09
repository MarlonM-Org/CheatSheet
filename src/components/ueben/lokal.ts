'use client';

import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';
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

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const r = indexedDB.open('ueben', 2);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('noten', { keyPath: 'id' });
        db.createObjectStore('stellen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
      }
      if (e.oldVersion < 2) db.createObjectStore('anmerkungen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}

async function tx<T>(speicher: Speicher, modus: IDBTransactionMode, arbeit: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const t = db.transaction(speicher, modus);
    const req = arbeit(t.objectStore(speicher));
    t.oncomplete = () => ok(req ? req.result : (undefined as T));
    t.onerror = () => fehler(t.error);
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

// Spielt eine Sicherung ein. Erst wird alles gelesen und geprüft, dann in EINER
// Transaktion geschrieben: entweder kommt alles an oder nichts. Einträge mit
// gleicher id werden ersetzt, alle anderen bleiben unberührt.
export async function sicherungEinspielen(datei: Blob): Promise<{ noten: number; stellen: number; anmerkungen: number }> {
  const { kopf, noten } = await sicherungLesen(datei);
  const mitNotenId = (e: { id?: unknown; notenId?: unknown }) => typeof e.id === 'string' && typeof e.notenId === 'string';
  if (!kopf.stellen.every(mitNotenId) || !kopf.anmerkungen.every(mitNotenId)) {
    throw new SicherungsFehler('Die Sicherung ist beschädigt (Stelle oder Anmerkung ohne Zuordnung).');
  }
  // PDFs als eigene Blobs ablösen: Ein Ausschnitt der gewählten Datei hinge
  // sonst an ihr, und die kann (iCloud, Downloads) später verschwinden.
  const fertig = await Promise.all(noten.map(async (n) => ({ ...n, datei: new Blob([await n.datei.arrayBuffer()], { type: n.datei.type }) })));

  const db = await oeffnen();
  await new Promise<void>((ok, fehler) => {
    const t = db.transaction(['noten', 'stellen', 'anmerkungen'], 'readwrite');
    for (const n of fertig) t.objectStore('noten').put(n);
    for (const st of kopf.stellen) t.objectStore('stellen').put(st);
    for (const a of kopf.anmerkungen) t.objectStore('anmerkungen').put(a);
    t.oncomplete = () => ok();
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error ?? new Error('Speichern abgebrochen.'));
  });
  dauerhaftAnfragen();
  return { noten: fertig.length, stellen: kopf.stellen.length, anmerkungen: kopf.anmerkungen.length };
}
