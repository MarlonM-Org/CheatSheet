'use client';

import { MODI, MODUS_NAME } from '@/domain/thema';
import { useThema } from '@/components/thema';
import { useDialogFokus, useEscape } from './tasten';

// Einstellungen (B-04): Erscheinungsbild Hell/Dunkel/System.
// Eigene Farbwelten (Dunkelblau, Schwarz, Weiß, Sommer) folgen später.
export function Einstellungen({ schliessen }: { schliessen: () => void }) {
  const { modus, setModus } = useThema();
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
          <p className="gedaempft text-xs">„System“ folgt der Einstellung des Geräts. Eigene Farbwelten kommen später dazu.</p>
        </div>
        <p className="gedaempft text-sm">Alles bleibt auf diesem Gerät. Kein Konto, kein Server.</p>
      </div>
    </div>
  );
}
