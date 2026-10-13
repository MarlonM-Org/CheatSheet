'use client';

import { useMetronom } from './MetronomKontext';

// Untere Leiste (B-01): drei große Knöpfe — Stimmgerät · Noten · Metronom,
// die Noten in der Mitte. „Noten" öffnet die Bibliothek, „Metronom" und
// „Stimmgerät" schalten ihre schwebenden Widgets.
// Sie liegt über den Noten; `weg` schiebt sie nach unten hinaus.
export function UntereLeiste({ weg, bibliothekOffen, metroAn, stimmAn, umschalten }: {
  weg: boolean; bibliothekOffen: boolean; metroAn: boolean; stimmAn: boolean;
  umschalten: (ziel: 'bibliothek' | 'metronom' | 'stimmgeraet') => void;
}) {
  const { laeuft } = useMetronom();
  return (
    <nav className={`leiste ${weg ? 'weg' : ''}`} aria-label="Werkzeuge" inert={weg}>
      <div className="leiste-innen">
        <button type="button" className="leiste-knopf" aria-pressed={stimmAn} onClick={() => umschalten('stimmgeraet')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5v5.7a4 4 0 0 0 8 0V3.5" /><path d="M12 13.2v5.3" /><path d="M9.3 20.5h5.4" /></svg>
          <span className="leiste-label">Stimmgerät</span>
        </button>
        <button type="button" className="leiste-knopf" aria-pressed={bibliothekOffen} onClick={() => umschalten('bibliothek')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5" /><path d="M8 8h8M8 11h8M8 14h8M8 17h8" /></svg>
          <span className="leiste-label">Noten</span>
        </button>
        <button type="button" className="leiste-knopf" aria-pressed={metroAn} onClick={() => umschalten('metronom')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 3.5h5.4l3.5 16H5.8l3.5-16z" /><path d="M6.9 15.5h10.2" /><path d="M12 15.5l4-8.2" /><circle cx="16.4" cy="6.5" r="1.4" /></svg>
          <span className="leiste-label">Metronom</span>
          {laeuft && <span className="leiste-punkt" aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
}
