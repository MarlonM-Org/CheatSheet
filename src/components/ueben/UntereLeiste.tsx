'use client';

import { useMetronom } from './MetronomKontext';

// Untere Leiste (B-01, B-18): vier große Knöpfe in zwei Gruppen. Links die
// Orte — Lernen · Noten: ein Tipp legt ihre Seite über die Noten, noch einer
// schließt sie, der andere Ort weicht. Rechts die Werkzeuge — Stimmgerät ·
// Metronom: ein Tipp schaltet ihr schwebendes Widget. Eine Haarlinie trennt
// die Paare. Sie liegt über den Noten; `weg` schiebt sie nach unten hinaus.
export function UntereLeiste({ weg, lernenOffen, bibliothekOffen, mixLaeuft, metroAn, stimmAn, umschalten }: {
  weg: boolean; lernenOffen: boolean; bibliothekOffen: boolean;
  // Ein Stellen-Mix läuft: Punkt am Noten-Knopf — dort, in der Bibliothek,
  // wird er gestartet (B-19) —, wie „läuft“ am Metronom.
  mixLaeuft: boolean;
  metroAn: boolean; stimmAn: boolean;
  umschalten: (ziel: 'lernen' | 'bibliothek' | 'metronom' | 'stimmgeraet') => void;
}) {
  const { laeuft } = useMetronom();
  return (
    <nav className={`leiste ${weg ? 'weg' : ''}`} aria-label="Leiste" inert={weg}>
      <div className="leiste-innen">
        <button type="button" className="leiste-knopf" aria-pressed={lernenOffen} onClick={() => umschalten('lernen')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20h4.5v-4.5h4.5V11h4.5V6.5h3" /><path d="M20 6.5V2.8" /><path d="M20 3l-3.2 1.3L20 5.6" /></svg>
          <span className="leiste-label">Lernen</span>
        </button>
        <button type="button" className="leiste-knopf" aria-pressed={bibliothekOffen} onClick={() => umschalten('bibliothek')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5" /><path d="M8 8h8M8 11h8M8 14h8M8 17h8" /></svg>
          <span className="leiste-label">Noten</span>
          {mixLaeuft && <span className="leiste-punkt" aria-hidden="true" />}
        </button>
        <span className="leiste-trenner" aria-hidden="true" />
        <button type="button" className="leiste-knopf" aria-pressed={stimmAn} onClick={() => umschalten('stimmgeraet')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5v5.7a4 4 0 0 0 8 0V3.5" /><path d="M12 13.2v5.3" /><path d="M9.3 20.5h5.4" /></svg>
          <span className="leiste-label">Stimmgerät</span>
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
