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
        <p className="abschnitt-titel !text-lg">{leer ? 'Noch keine Stellen in diesem Stück' : 'Stellen'}</p>
        <p className="text-sm">
          Stellen sind die schwierigen Takte eines Stücks. Markiert, übst du sie gezielt: Im Stellen-Modus springst du
          mit ‹ › von Stelle zu Stelle, der Rest der Seite tritt zurück.
        </p>
        <ul className="stellen-info-liste text-sm">
          <li><strong>✓ geschafft</strong> speichert das Tempo, das du gerade schaffst — beim nächsten Mal startet das Metronom dort.</li>
          <li><strong>Zieltempo</strong> setzen und die Steigerung der letzten Wochen als Kurve sehen.</li>
          <li><strong>Stellen-Mix:</strong> Stellen aus allen Stücken bunt gemischt üben (in der Bibliothek).</li>
        </ul>
        <p className="text-sm font-semibold">So markierst du eine Stelle</p>
        <ol className="stellen-info-liste text-sm list-decimal">
          <li>Oben rechts den <strong>Stift</strong> antippen.</li>
          <li>In der Palette ganz rechts das Werkzeug <strong>Stelle</strong> wählen.</li>
          <li>Mit dem Finger einen <strong>Rahmen um die Takte</strong> ziehen.</li>
          <li>Einen Namen geben, z. B. „T. 32–48“, gern mit Zieltempo — <strong>Speichern</strong>.</li>
        </ol>
        <p className="gedaempft text-xs">Tippen zum Schließen</p>
      </div>
    </div>,
    document.body,
  );
}
