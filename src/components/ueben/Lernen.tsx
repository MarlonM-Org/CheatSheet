'use client';

import { useEffect, useState } from 'react';
import { HoerUebungenZeile } from './HoerUebung';
import { OhrTrainerZeile } from './OhrTrainer';
import { HeuteAbschnitt, SkillStand, SkillsZeile } from './Skills';
import { GrosseSeiten } from './seite';
import { useEscape } from './tasten';
import { Werkzeuge } from './Werkzeuge';

// Lernen (B-18, B-19): der Ort neben den Noten für grundlegende musikalische
// Fähigkeiten — Gehör, Harmonie, Technik, Improvisation —, nicht für die
// Arbeit an den eigenen Stücken: Der Stellen-Mix steht seit B-19 wieder in
// der Bibliothek über den Noten der gewählten Sammlung.
// Oben „Heute“ (I-09), darunter Üben (Ohr-Trainer, Hör-Übungen), die
// Werkzeuge (I-11…I-20) und zuletzt „Mein Stand“ mit der Skill-Kartei.
// Legt sich über die Noten — anders als die Bibliothek auch auf dem iPad über
// die ganze Breite, der Inhalt in einer mittigen Spalte — und öffnet immer
// oben. Werkzeuge, Übungen und Kartei werden auf dem iPad zur ganzen Seite
// darüber (./seite), Auswahl-Blätter bleiben kleine Blätter. Was aus
// I-02…I-06 dazukommt, erscheint hier erst, wenn es gebaut ist.

export function Lernen({ schliessen, escapeAktiv, tiefMelden, zuAufnahmen }: {
  schliessen: () => void;
  // Escape schließt die Seite nur, wenn kein Dialog darüber liegt.
  escapeAktiv: boolean;
  // Liegt ein Werkzeug oder eine Übung darauf? Auf dem iPad bleibt die Leiste
  // dabei bedienbar, ein Tipp auf „Lernen“ führt dann zur Übersicht zurück.
  tiefMelden: (tief: boolean) => void;
  // Kachel „Aufnahme-Tagebuch“: führt in die Bibliothek zu den Aufnahmen (ganzer Seitenwechsel).
  zuAufnahmen: () => void;
}) {
  const [blattOffen, setBlattOffen] = useState(false);
  useEscape(schliessen, escapeAktiv && !blattOffen);
  useEffect(() => { tiefMelden(blattOffen); return () => tiefMelden(false); }, [blattOffen, tiefMelden]);

  return (
    <section className="bibliothek lernen-seite" role="region" aria-label="Lernen">
      <div className="panel-kopf mit-linie">
        <h2>Lernen</h2>
        <span className="flex-1" />
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Lernen schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="bib-inhalt">
        <GrosseSeiten>
          <div className="lernen-spalte">
            <HeuteAbschnitt blattMelden={setBlattOffen} />

            <h3 className="lernen-titel">Üben</h3>
            <div className="lernen-ueben">
              <OhrTrainerZeile offenMelden={setBlattOffen} />
              <HoerUebungenZeile offenMelden={setBlattOffen} />
            </div>

            <h3 className="lernen-titel">Werkzeuge</h3>
            <Werkzeuge offenMelden={setBlattOffen} zuAufnahmen={zuAufnahmen} />

            <h3 className="lernen-titel">Mein Stand</h3>
            <SkillsZeile offenMelden={setBlattOffen} />
            <SkillStand />
          </div>
        </GrosseSeiten>
      </div>
    </section>
  );
}
