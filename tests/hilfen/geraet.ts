// Ein Gerät für Tests der Speicherschicht (src/components/ueben/lokal.ts):
// frischer Gerätespeicher (fake-indexeddb), frisch geladenes Modul — die
// Verbindung merkt sich lokal.ts modulweit —, dazu window, localStorage und
// auf Wunsch document.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { vi } from 'vitest';

type Lokal = typeof import('@/components/ueben/lokal');

export interface Geraet {
  lokal: Lokal;
  // Wechselt die Sichtbarkeit (nur mit `mitDokument`): wie die Rückkehr in die App.
  sichtbar?: (zustand: 'visible' | 'hidden') => void;
}

export async function neuesGeraet(o: { mitDokument?: boolean } = {}): Promise<Geraet> {
  const g = globalThis as Record<string, unknown>;
  g.indexedDB = new IDBFactory();
  g.IDBKeyRange = IDBKeyRange;
  g.window = globalThis;
  const ablage = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => ablage.get(k) ?? null,
    setItem: (k: string, v: string) => void ablage.set(k, String(v)),
    removeItem: (k: string) => void ablage.delete(k),
    clear: () => ablage.clear(),
  };
  let sichtbar: Geraet['sichtbar'];
  if (o.mitDokument) {
    const dok = Object.assign(new EventTarget(), { visibilityState: 'visible' as 'visible' | 'hidden' });
    g.document = dok;
    sichtbar = (zustand) => { dok.visibilityState = zustand; dok.dispatchEvent(new Event('visibilitychange')); };
  } else {
    delete g.document;
  }
  vi.resetModules();
  const lokal = await import('@/components/ueben/lokal');
  return { lokal, sichtbar };
}

// ── Direkter Zugriff am Modul vorbei ──

const anfrage = <T>(r: IDBRequest<T>) => new Promise<T>((ok, fehler) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fehler(r.error);
});

// Öffnet „ueben“ in der vorhandenen Version, ohne etwas anzulegen.
export async function rohOeffnen(): Promise<IDBDatabase> {
  return anfrage(indexedDB.open('ueben'));
}

// Alles aus einem Speicher, so wie es wirklich auf dem Gerät liegt.
export async function roh<T = Record<string, unknown>>(speicher: string): Promise<T[]> {
  const db = await rohOeffnen();
  try {
    return await anfrage(db.transaction(speicher).objectStore(speicher).getAll() as IDBRequest<T[]>);
  } finally {
    db.close();
  }
}

export async function rohSchreiben(speicher: string, eintraege: unknown[]): Promise<void> {
  const db = await rohOeffnen();
  try {
    await new Promise<void>((ok, fehler) => {
      const t = db.transaction(speicher, 'readwrite');
      for (const e of eintraege) t.objectStore(speicher).put(e);
      t.oncomplete = () => ok();
      t.onabort = () => fehler(t.error);
    });
  } finally {
    db.close();
  }
}

// Aufbau des Schemas, wie es in jeder Version ausgeliefert wurde. Eingefroren:
// Diese Stände liegen auf echten Geräten und dürfen sich hier nie ändern,
// auch wenn lokal.ts längst weiter ist.
export const SCHEMA_STAENDE = [1, 2, 3] as const;
export type SchemaStand = (typeof SCHEMA_STAENDE)[number];

function schemaAufbauen(db: IDBDatabase, alt: number, neu: SchemaStand) {
  if (alt < 1 && neu >= 1) {
    db.createObjectStore('noten', { keyPath: 'id' });
    db.createObjectStore('stellen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
  }
  if (alt < 2 && neu >= 2) db.createObjectStore('anmerkungen', { keyPath: 'id' }).createIndex('notenId', 'notenId');
  if (alt < 3 && neu >= 3) db.createObjectStore('dateien', { keyPath: 'id' });
}

// Ein Gerät, auf dem eine ältere Fassung der App Daten hinterlassen hat.
export async function altesGeraetAnlegen(
  stand: SchemaStand,
  inhalt: Partial<Record<'noten' | 'stellen' | 'anmerkungen' | 'dateien', unknown[]>>,
): Promise<void> {
  const r = indexedDB.open('ueben', stand);
  r.onupgradeneeded = (e) => schemaAufbauen(r.result, e.oldVersion, stand);
  const db = await anfrage(r);
  const speicher = Object.keys(inhalt).filter((s) => (inhalt as Record<string, unknown[]>)[s].length);
  if (speicher.length) {
    await new Promise<void>((ok, fehler) => {
      const t = db.transaction(speicher, 'readwrite');
      for (const s of speicher) for (const e of (inhalt as Record<string, unknown[]>)[s]) t.objectStore(s).put(e);
      t.oncomplete = () => ok();
      t.onabort = () => fehler(t.error);
    });
  }
  db.close();
}

// Stores und Indizes, wie sie auf dem Gerät angelegt sind.
export async function schemaVon(): Promise<{ version: number; speicher: Record<string, { schluessel: unknown; indizes: string[] }> }> {
  const db = await rohOeffnen();
  try {
    const speicher: Record<string, { schluessel: unknown; indizes: string[] }> = {};
    const namen = [...db.objectStoreNames];
    if (namen.length) {
      const t = db.transaction(namen);
      for (const n of namen) {
        const s = t.objectStore(n);
        speicher[n] = { schluessel: s.keyPath, indizes: [...s.indexNames].sort() };
      }
    }
    return { version: db.version, speicher };
  } finally {
    db.close();
  }
}

// Eine kleine, gültig aussehende PDF-Datei.
export const pdf = (inhalt: string) => new Blob([`%PDF-1.4 ${inhalt}`], { type: 'application/pdf' });
export const text = (b: ArrayBuffer) => new TextDecoder().decode(b);
