'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// Fehler beim Speichern auf dem Gerät sichtbar machen. Gespeichert wird meist
// nebenbei (Striche, Blätterlinie, geschaffte Tempi); scheitert das still,
// glaubt die Person, es sei gesichert — und beim nächsten Öffnen fehlt es.

// Alles, was geworfen wird, als Error — Browser werfen auch DOMExceptions
// ohne Prototyp-Kette zu Error oder nackte Werte.
export function alsFehler(x: unknown): Error {
  return x instanceof Error ? x : new Error(String(x));
}

// Der Grund in Worten, mit Hinweis bei vollem Gerätespeicher.
export function fehlerGrund(x: unknown): string {
  const err = alsFehler(x);
  return `${err.message}${err.name === 'QuotaExceededError' ? ' (Gerätespeicher voll)' : ''}`;
}

export const NICHT_GESPEICHERT = 'Nicht gespeichert — Gerätespeicher voll oder blockiert. Bitte neu laden.';
export const NICHT_GELADEN = 'Nicht geladen — Gerätespeicher blockiert. Bitte neu laden.';

// Ein Hinweis für die ganze Seite; der letzte Fehler gewinnt, ein Fehler beim
// Speichern wird nicht von einem beim Lesen verdrängt.
let hinweis: { titel: string; grund: string } | null = null;
const zuhoerer = new Set<() => void>();
const melden = () => { for (const z of zuhoerer) z(); };

// Für jedes Speichern auf dem Gerät, etwa als .catch(speicherFehler).
export function speicherFehler(x: unknown): void {
  hinweis = { titel: NICHT_GESPEICHERT, grund: fehlerGrund(x) || 'unbekannter Fehler' };
  melden();
}

// Für Lesen, das nebenbei passiert (Stellen, Anmerkungen nachladen).
export function ladeFehler(x: unknown): void {
  if (hinweis?.titel === NICHT_GESPEICHERT) return;
  hinweis = { titel: NICHT_GELADEN, grund: fehlerGrund(x) || 'unbekannter Fehler' };
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
