'use client';

import { createPortal } from 'react-dom';
import { useEscape } from './tasten';

// Was Stellen sind und wie man sie markiert — hinter dem „i“ neben dem
// Stellen-Schalter und als Hinweis, wenn man Stellen ohne eine einzige
// einschaltet. Tippen irgendwo schließt.
export function StellenInfo({ leer, schliessen }: { leer: boolean; schliessen: () => void }) {
  useEscape(schliessen);
  return createPortal(
    <div className="stellen-info" role="dialog" aria-modal="true" aria-label="Stellen" onClick={schliessen}>
      <div className="stellen-info-karte">
        <p className="abschnitt-titel !text-lg">{leer ? 'Noch keine Stellen' : 'Stellen'}</p>
        <ul className="stichpunkte text-sm">
          <li>Schwierige Takte markieren und gezielt üben</li>
          <li>‹ › springt von Stelle zu Stelle</li>
          <li>„✓ geschafft“ merkt sich dein Tempo</li>
        </ul>
        <p className="text-sm font-semibold">Markieren</p>
        <ol className="stichpunkte text-sm">
          <li>Stift oben rechts</li>
          <li>Werkzeug „Stelle“ (ganz rechts)</li>
          <li>Rahmen um die Takte ziehen</li>
          <li>Namen geben, speichern</li>
        </ol>
        <p className="gedaempft text-xs">Tippen schließt</p>
      </div>
    </div>,
    document.body,
  );
}
