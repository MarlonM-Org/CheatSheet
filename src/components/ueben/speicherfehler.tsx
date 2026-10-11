'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { speicherVoll, verbindungVerloren } from '@/domain/speicher';

// Fehler beim Speichern auf dem Gerät sichtbar machen. Gespeichert wird meist
// nebenbei (Striche, Blätterlinie, geschaffte Tempi); scheitert das still,
// glaubt die Person, es sei gesichert — und beim nächsten Öffnen fehlt es.

// Alles, was geworfen wird, als Error — Browser werfen auch DOMExceptions
// ohne Prototyp-Kette zu Error oder nackte Werte.
export function alsFehler(x: unknown): Error {
  return x instanceof Error ? x : new Error(String(x));
}

// Der Grund in Worten. „Voll“ heißt es nur, wenn der Speicher wirklich voll
// ist — eine abgerissene Verbindung (oft nach einem App-Wechsel) ist etwas
// anderes und mit „Neu laden“ behoben.
export function fehlerGrund(x: unknown): string {
  const err = alsFehler(x);
  if (speicherVoll(err)) return `Der Gerätespeicher ist voll (${err.message}).`;
  if (verbindungVerloren(err)) return `Die Verbindung zum Gerätespeicher war unterbrochen (${err.message}).`;
  return err.message;
}

// Ein Hinweis für die ganze Seite; der letzte Fehler gewinnt, ein Fehler beim
// Speichern wird nicht von einem beim Lesen verdrängt.
let hinweis: { titel: string; grund: string; speichern: boolean } | null = null;
const zuhoerer = new Set<() => void>();
const melden = () => { for (const z of zuhoerer) z(); };

// Für jedes Speichern auf dem Gerät, etwa als .catch(speicherFehler).
export function speicherFehler(x: unknown): void {
  hinweis = { titel: 'Nicht gespeichert — bitte neu laden.', grund: fehlerGrund(x) || 'unbekannter Fehler', speichern: true };
  melden();
}

// Für Lesen, das nebenbei passiert (Stellen, Anmerkungen nachladen).
export function ladeFehler(x: unknown): void {
  if (hinweis?.speichern) return;
  hinweis = { titel: 'Nicht geladen — bitte neu laden.', grund: fehlerGrund(x) || 'unbekannter Fehler', speichern: false };
  melden();
}

function abonnieren(z: () => void) {
  zuhoerer.add(z);
  return () => { zuhoerer.delete(z); };
}

// Einmal in die Seite setzen. Liegt über allem, auch über dem Notenbetrachter.
export function SpeicherHinweis() {
  const aktuell = useSyncExternalStore(abonnieren, () => hinweis, () => null);
  if (!aktuell) return null;
  return createPortal(
    <div className="speicher-hinweis" role="alert">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{aktuell.titel}</p>
        <p className="text-sm opacity-80">{aktuell.grund}</p>
      </div>
      <button type="button" className="knopf knopf-klein" onClick={() => location.reload()}>Neu laden</button>
      <button type="button" className="neue-version-weg" aria-label="Hinweis schließen" onClick={() => { hinweis = null; melden(); }}>×</button>
    </div>,
    document.body,
  );
}
