'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Arbeits-Blätter (Werkzeuge, Ohr-Trainer, Hör-Übung, Skill-Kartei) auf der
// Lernen-Seite (B-18): Auf dem iPad werden sie zur ganzen Seite über der
// Leiste statt eines kleinen Fensters, und Leiste und Widgets bleiben
// bedienbar (Metronom, Stimmgerät, zurück zur Übersicht). Dafür liegen sie
// nicht am Ende des Dokuments, sondern in der App-Schale — dort ordnen sie
// sich zwischen Lernen (45) und Widgets/Leiste ein (Stapel in globals.css).
// Auf dem Handy sehen sie aus wie jedes Blatt; über den Noten (z. B.
// Spickzettel aus der Spielhilfe) bleiben sie Blätter. Auswahl- und
// Rückfrage-Blätter fragen nicht danach und bleiben klein.

const Seiten = createContext(false);

export function GrosseSeiten({ children }: { children: ReactNode }) {
  return <Seiten.Provider value>{children}</Seiten.Provider>;
}

/** Klasse für den Hintergrund eines Arbeits-Blatts und wohin es gerendert wird. */
export function useSeite(): { klasse: string; ziel: Element } {
  const inLernen = useContext(Seiten);
  const schale = inLernen && typeof document !== 'undefined' ? document.querySelector('.app-schale') : null;
  return { klasse: schale ? ' seite' : '', ziel: schale ?? document.body };
}
