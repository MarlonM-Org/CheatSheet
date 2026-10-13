'use client';

import { useState } from 'react';
import { DUNKLE_THEMEN, HELLE_THEMEN, MODI, MODUS_NAME, THEMA_NAME, type Thema } from '@/domain/thema';
import { useThema } from '@/components/thema';
import { BlaetternEinstellung } from './Blaettern';
import { tagsLaden } from './lokal';
import { Sicherung, useSicherungLaden } from './Sicherung';
import { TagVerwaltung } from './Tags';
import { useDialogFokus, useEscape } from './tasten';

// Muster je Farbwelt: Grundton und Akzent — passend zu den Token-Sätzen
// in globals.css (dort gepflegt, hier nur fürs Vorschau-Pünktchen).
const WELT_MUSTER: Record<Thema, string> = {
  weiss: 'linear-gradient(135deg, #fcfcfb 50%, #a8781f 50%)',
  sommer: 'linear-gradient(135deg, #fdf4f2 50%, #b03a66 50%)',
  dunkelblau: 'linear-gradient(135deg, #0f1722 50%, #d9ad55 50%)',
  schwarz: 'linear-gradient(135deg, #000000 50%, #d9ad55 50%)',
};

function WeltWahl({ titel, welten, wert, setzen, aktiv }: {
  titel: string; welten: readonly Thema[]; wert: Thema; setzen: (t: Thema) => void; aktiv: Thema;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{titel}</p>
      <div className="segment !mx-0" role="group" aria-label={titel}>
        {welten.map((t) => (
          <button key={t} type="button" aria-pressed={wert === t} onClick={() => setzen(t)}>
            <i className="welt-punkt" style={{ background: WELT_MUSTER[t] }} aria-hidden="true" />
            {THEMA_NAME[t]}{aktiv === t ? ' •' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// Einstellungen (B-04): Erscheinungsbild Hell/Dunkel/System plus je eine
// helle und dunkle Farbwelt (der Punkt markiert die gerade aktive Welt);
// darunter Daten übertragen — Sicherung erstellen und laden (B-06).
// `geaendert` meldet eine geladene Sicherung, damit die Bibliothek neu liest.
export function Einstellungen({ schliessen, geaendert }: { schliessen: () => void; geaendert: () => void }) {
  const { modus, setModus, hell, setHell, dunkel, setDunkel, aktiv } = useThema();
  const laden = useSicherungLaden(geaendert);
  // Tags (F-14) liegen im localStorage; nach jeder Änderung neu lesen und der
  // Bibliothek Bescheid geben.
  const [tags, setTags] = useState(() => tagsLaden());
  const tagsGeaendert = () => { setTags(tagsLaden()); geaendert(); };
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();

  return (
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Einstellungen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="abschnitt-titel">Einstellungen</h2>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Erscheinungsbild</p>
          <div className="segment !mx-0" role="group" aria-label="Erscheinungsbild">
            {MODI.map((m) => (
              <button key={m} type="button" aria-pressed={modus === m} onClick={() => setModus(m)}>{MODUS_NAME[m]}</button>
            ))}
          </div>
          <p className="gedaempft text-xs">„System“ folgt der Einstellung des Geräts und wechselt zwischen deiner hellen und dunklen Farbwelt.</p>
        </div>
        <WeltWahl titel="Helle Farbwelt" welten={HELLE_THEMEN} wert={hell} setzen={setHell} aktiv={aktiv} />
        <WeltWahl titel="Dunkle Farbwelt" welten={DUNKLE_THEMEN} wert={dunkel} setzen={setDunkel} aktiv={aktiv} />
        <hr className="trenner" />
        <TagVerwaltung tags={tags} geaendert={tagsGeaendert} />
        <hr className="trenner" />
        <BlaetternEinstellung />
        <hr className="trenner" />
        <Sicherung laden={laden} />
        {laden.meldung && <p className="karte" role="status">{laden.meldung}</p>}
        {laden.fehler && <p className="karte warnung" role="alert">{laden.fehler}</p>}
        {laden.eingabe}
        <p className="gedaempft text-sm">Alles bleibt auf diesem Gerät. Kein Konto, kein Server.</p>
      </div>
    </div>
  );
}
