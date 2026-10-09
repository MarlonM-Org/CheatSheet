'use client';

import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';

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
