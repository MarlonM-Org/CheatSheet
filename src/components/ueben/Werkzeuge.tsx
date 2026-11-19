'use client';

import { useState, type ReactNode } from 'react';
import { DroneBlatt } from './Drone';
import { EtuedenBlatt } from './Etueden';
import { GriffeBlatt } from './Griffe';
import { JamKarteBlatt } from './JamKarte';
import { LicksBlatt } from './Licks';
import { SpickzettelBlatt } from './Spickzettel';
import { TransponierBlatt } from './Transponieren';

// Werkzeuge fürs freie Spielen (I-11…I-20): Kacheln auf der Lernen-Seite, jede
// öffnet ihr Blatt über der Liste. Neue Werkzeuge: Eintrag in WERKZEUGE.
// Ausnahme Aufnahme-Tagebuch (I-20): Die Aufnahmen liegen an den Stücken und
// sind seit 2026-11-19 über die Bibliothek abrufbar (Rückmeldung Marlon) —
// die Kachel führt dorthin, ein ganzer Seitenwechsel.

interface Werkzeug {
  id: string;
  name: string;
  info: string;
  zeichen: string;
  // Ein Blatt über Lernen — oder (ohne Blatt) ein Sprung an einen anderen Ort.
  blatt?: (schliessen: () => void) => ReactNode;
}

const WERKZEUGE: readonly Werkzeug[] = [
  { id: 'jam', name: 'Jam-Karte', info: 'Session-Stücke, Akkorde für dich', zeichen: '▦', blatt: (z) => <JamKarteBlatt schliessen={z} /> },
  { id: 'spick', name: 'Akkord-Spickzettel', info: 'Töne, Guide Tones, Leitern', zeichen: '♯', blatt: (z) => <SpickzettelBlatt schliessen={z} /> },
  { id: 'trans', name: 'Transponieren', info: 'klingend ↔ notiert', zeichen: '⇅', blatt: (z) => <TransponierBlatt schliessen={z} /> },
  { id: 'griffe', name: 'Griffweisen', info: 'Standard, Alternativen, Triller', zeichen: '◉', blatt: (z) => <GriffeBlatt schliessen={z} /> },
  { id: 'etueden', name: 'Etüden', info: 'Muster durch alle 12 Tonarten', zeichen: '♫', blatt: (z) => <EtuedenBlatt schliessen={z} /> },
  { id: 'licks', name: 'Licks', info: 'Sammeln, transponieren, wiederholen', zeichen: '♪', blatt: (z) => <LicksBlatt schliessen={z} /> },
  { id: 'drone', name: 'Drone', info: 'Liegeton zum Improvisieren', zeichen: '∿', blatt: (z) => <DroneBlatt schliessen={z} /> },
  { id: 'tagebuch', name: 'Aufnahme-Tagebuch', info: 'In der Bibliothek: alt gegen neu', zeichen: '●' },
];

export function Werkzeuge({ offenMelden, zuAufnahmen }: { offenMelden?: (offen: boolean) => void; zuAufnahmen?: () => void }) {
  const [offen, setOffenRoh] = useState<string | null>(null);
  const setOffen = (id: string | null) => { setOffenRoh(id); offenMelden?.(id !== null); };
  const aktiv = WERKZEUGE.find((w) => w.id === offen);
  return (
    <section className="werkzeuge" aria-label="Werkzeuge">
      <div className="werkzeuge-raster">
        {WERKZEUGE.filter((w) => w.blatt || zuAufnahmen).map((w) => (
          w.blatt ? (
            <button key={w.id} type="button" className="werkzeug-kachel" aria-haspopup="dialog" aria-expanded={offen === w.id} onClick={() => setOffen(w.id)}>
              <span className="werkzeug-zeichen" aria-hidden="true">{w.zeichen}</span>
              <span className="werkzeug-text">
                <strong>{w.name}</strong>
                <span>{w.info}</span>
              </span>
            </button>
          ) : (
            <button key={w.id} type="button" className="werkzeug-kachel" onClick={zuAufnahmen}>
              <span className="werkzeug-zeichen tb-zeichen" aria-hidden="true">{w.zeichen}</span>
              <span className="werkzeug-text">
                <strong>{w.name}</strong>
                <span>{w.info}</span>
              </span>
              <span className="bib-pfeil werkzeug-pfeil" aria-hidden="true">›</span>
            </button>
          )
        ))}
      </div>
      {aktiv?.blatt?.(() => setOffen(null))}
    </section>
  );
}
