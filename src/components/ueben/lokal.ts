'use client';

import type { Anmerkung, Blaettermodus } from '@/domain/notenpult';
import {
  einspielenPlanen, notenZusammenfuehren, seiteZusammenfuehren, stelleZusammenfuehren, type Einspielplan, type Vorhanden,
} from '@/domain/einspielen';
import { nurLesbare } from '@/domain/lesbar';
import { sicherungLesen, sicherungPacken, SicherungsFehler, type SicherungsInhalt } from '@/domain/sicherung';
import { verbindungVerloren } from '@/domain/speicher';

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

// ── Noten ──
export const alleNoten = () => tx<LokaleNoten[]>('noten', 'readonly', (s) => s.getAll());
export const notenHolen = (id: string) => tx<LokaleNoten | undefined>('noten', 'readonly', (s) => s.get(id));
// Die gewählte Datei erst ganz in den Arbeitsspeicher holen: Safari kann
// eine Datei direkt aus der Dateiauswahl mitunter nicht in den Gerätespeicher
// übernehmen („Error preparing Blob/File data …“). Eine Kopie geht
// zuverlässig — und eine nicht lesbare Datei fällt hier mit klarer Meldung auf.
async function imSpeicher(datei: Blob): Promise<Blob> {
  try {
    return new Blob([await datei.arrayBuffer()], { type: datei.type || 'application/pdf' });
  } catch (x) {
    throw new Error(`Die Datei ließ sich nicht lesen (${(x as Error)?.name ?? x}). Liegt sie nur in iCloud? Erst in der Dateien-App öffnen, dann erneut wählen.`);
  }
}

export async function notenAnlegen(n: { titel: string; stimme: string; datei: Blob; dateiname?: string; handle?: FileSystemFileHandle }): Promise<string> {
  const id = crypto.randomUUID();
  const datei = await imSpeicher(n.datei);
  await tx('noten', 'readwrite', (s) => s.put({ ...n, datei, id, erstellt: Date.now() }));
  dauerhaftAnfragen();
  return id;
}
export async function notenAendern(id: string, felder: Partial<LokaleNoten>) {
  if (felder.datei) felder = { ...felder, datei: await imSpeicher(felder.datei) };
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

// Nicht lesbare Noten (kaputter, verlorener oder nicht ganz lesbarer
// PDF-Inhalt — jede Datei wird dafür einmal komplett gelesen) kommen samt
// ihren Stellen und Anmerkungen nicht mit; `fehlen` nennt sie.
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
// Zusammenführen ohne Verlust (Regeln in @/domain/einspielen): Bei gleicher id
// gewinnen die Felder der Sicherung, aber Tempo-Verläufe und Striche werden
// vereinigt und der Dateiverweis des Geräts bleibt. Was es nur auf dem Gerät
// gibt, bleibt unberührt. Lesen und Schreiben in EINER readwrite-Transaktion:
// Was nebenher geändert wird, kann nicht zwischen Lesen und Schreiben fallen.
// Die PDF-Ausschnitte gehen direkt an put: IndexedDB legt ihren Inhalt selbst
// ab und hängt danach nicht mehr an der gewählten Datei.
export async function sicherungSchreiben(e: Einspielung): Promise<{ neu: number; aktualisiert: number; stellen: number; anmerkungen: number; uebersprungen: number }> {
  await transaktion<void>(ALLE, 'readwrite', (t, abbrechen) => {
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
    einspielen('noten', e.noten, notenZusammenfuehren);
    einspielen('stellen', e.stellen, stelleZusammenfuehren);
    einspielen('anmerkungen', e.anmerkungen, seiteZusammenfuehren);
  });
  dauerhaftAnfragen();
  return { neu: e.neu, aktualisiert: e.ueberschrieben.noten, stellen: e.stellen.length, anmerkungen: e.anmerkungen.length, uebersprungen: e.uebersprungen };
}
