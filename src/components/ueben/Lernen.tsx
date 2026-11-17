'use client';

import { useEffect, useMemo, useState } from 'react';
import { sammlungenOrdnen, sammlungenUebersicht } from '@/domain/sammlungen';
import { mixQuelle, type MixBereich, type MixQuelle } from '@/domain/stellen';
import type { Tag } from '@/domain/tags';
import { REIHENFOLGE } from './Bibliothek';
import { HoerUebungenZeile } from './HoerUebung';
import { gespeichert, speichern } from './klang';
import { alleStellen, alleStuecke, tagsLaden, type Stelle, type Stueck } from './lokal';
import { OhrTrainerZeile } from './OhrTrainer';
import { HeuteAbschnitt, SkillStand, SkillsZeile } from './Skills';
import { GrosseSeiten } from './seite';
import { ladeFehler } from './speicherfehler';
import { MixZeile } from './StellenMix';
import { useEscape } from './tasten';
import { Werkzeuge } from './Werkzeuge';

// Lernen (B-18): der Ort neben den Noten — oben „Heute“ (I-09), darunter
// Üben (Stellen-Mix, Ohr-Trainer, Hör-Übungen), zuletzt „Mein Stand“ mit der
// Skill-Kartei. Legt sich über die Noten — anders als die Bibliothek auch auf
// dem iPad über die ganze Breite, der Inhalt in einer mittigen Spalte — und
// öffnet immer oben. Werkzeuge, Übungen und Kartei werden auf dem iPad zur
// ganzen Seite darüber (./seite), Auswahl-Blätter wie die Mix-Optionen
// bleiben kleine Blätter.
// Darunter die Werkzeuge (I-11…I-20). Was aus I-02…I-06 dazukommt, erscheint
// hier erst, wenn es gebaut ist.

// Woraus der Mix hier mischt (am Gerät, reist nicht mit — ein Filter).
const MIX_WORAUS = 'ueben:mix-woraus';

export function Lernen({ schliessen, escapeAktiv, stand, mixStarten, mixAktiv, tiefMelden }: {
  schliessen: () => void;
  // Escape schließt die Seite nur, wenn kein Dialog darüber liegt.
  escapeAktiv: boolean;
  // Zählt hoch, wenn eine Sicherung geladen wurde: Daten neu lesen.
  stand: number;
  mixStarten: (neu: boolean, bereich: MixBereich) => void;
  // Der gerade laufende Mix (null: keiner) — seine Runde heißt „Weiter bei …“.
  mixAktiv: MixBereich | null;
  // Liegt ein Werkzeug oder eine Übung darauf? Auf dem iPad bleibt die Leiste
  // dabei bedienbar, ein Tipp auf „Lernen“ führt dann zur Übersicht zurück.
  tiefMelden: (tief: boolean) => void;
}) {
  const [blattOffen, setBlattOffen] = useState(false);
  useEscape(schliessen, escapeAktiv && !blattOffen);
  useEffect(() => { tiefMelden(blattOffen); return () => tiefMelden(false); }, [blattOffen, tiefMelden]);

  const [daten, setDaten] = useState<{ noten: Stueck[]; stellen: Stelle[]; tags: Tag[]; reihenfolge: string[] } | null>(null);
  useEffect(() => {
    let weg = false;
    Promise.all([alleStuecke(), alleStellen()]).then(([noten, stellen]) => {
      if (!weg) setDaten({ noten, stellen, tags: tagsLaden(), reihenfolge: gespeichert<string[]>(REIHENFOLGE, []) });
    }, ladeFehler);
    return () => { weg = true; };
  }, [stand]);

  const sammlungen = useMemo(
    () => (daten ? sammlungenOrdnen(sammlungenUebersicht(daten.noten), daten.reihenfolge).map((x) => x.name) : []),
    [daten],
  );
  const [gemerkt, setGemerkt] = useState<unknown>(() => gespeichert<unknown>(MIX_WORAUS, null));
  const quelle = mixQuelle(gemerkt,
    { sammlung: gespeichert<string | null>('ueben:sammlung', null), tag: gespeichert<string | null>('ueben:tag', null) },
    sammlungen, daten?.tags.map((t) => t.id) ?? []);
  const waehlen = (q: MixQuelle) => { setGemerkt(q); speichern(MIX_WORAUS, q); };
  const tag = daten?.tags.find((t) => t.id === quelle.tag) ?? null;

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
              {daten ? (
                <MixZeile sammlung={quelle.sammlung} tag={tag} noten={daten.noten} stellen={daten.stellen} starten={mixStarten} aktiv={mixAktiv}
                  woraus={{ sammlungen, tags: daten.tags, waehlen }} offenMelden={setBlattOffen} />
              ) : (
                // Platzhalter gleicher Höhe, bis die Stellen gelesen sind — nichts rückt nach.
                <div className="mix-einstieg" aria-hidden="true"><span className="mix-symbol klein" /><span className="mix-einstieg-titel">Stellen-Mix</span><span className="mix-einstieg-stand">…</span></div>
              )}
              <OhrTrainerZeile offenMelden={setBlattOffen} />
              <HoerUebungenZeile offenMelden={setBlattOffen} />
            </div>

            <h3 className="lernen-titel">Werkzeuge</h3>
            <Werkzeuge offenMelden={setBlattOffen} />

            <h3 className="lernen-titel">Mein Stand</h3>
            <SkillsZeile offenMelden={setBlattOffen} />
            <SkillStand />
          </div>
        </GrosseSeiten>
      </div>
    </section>
  );
}
