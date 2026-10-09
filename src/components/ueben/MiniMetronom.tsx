'use client';

import { useState } from 'react';
import { Metronom } from './Metronom';
import { useMetronom } from './MetronomKontext';

// Schmale Leiste fürs Üben in den Noten: Start/Stopp, Tempo schieben,
// ±10 %, Tempo antippen zum Eintippen. „Mehr“ öffnet das volle Metronom.
export function MiniMetronom({ dunkel = false }: { dunkel?: boolean }) {
  const { bpm, setBpm, laeuft, start, stopp, aktiv, akzente } = useMetronom();
  const [eingabe, setEingabe] = useState<string | null>(null);
  const [voll, setVoll] = useState(false);
  const uebernehmen = () => { const n = Number(eingabe); if (n) setBpm(n); setEingabe(null); };

  return (
    <>
      <div className={`mini-metronom ${dunkel ? 'dunkel' : ''}`} role="group" aria-label="Metronom">
        <button type="button" className={`mini-start ${laeuft ? 'laeuft' : ''}`} onClick={laeuft ? stopp : start} aria-label={laeuft ? 'Metronom stoppen' : 'Metronom starten'}>
          {laeuft ? <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
        </button>
        {eingabe !== null ? (
          <input className="mini-bpm mini-eingabe" autoFocus inputMode="numeric" value={eingabe} aria-label="Tempo eingeben"
            onChange={(e) => setEingabe(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={uebernehmen} onKeyDown={(e) => { if (e.key === 'Enter') uebernehmen(); if (e.key === 'Escape') setEingabe(null); }} />
        ) : (
          <button type="button" className="mini-bpm" onClick={() => setEingabe(String(bpm))} aria-label={`Tempo ${bpm}, antippen zum Eingeben`}>
            <span>{bpm}</span>
            <span className="mini-punkte" aria-hidden="true">
              {akzente.map((_, i) => <i key={i} className={aktiv?.schlag === i && aktiv.sub === 0 ? (i === 0 ? 'eins' : 'an') : ''} />)}
            </span>
          </button>
        )}
        <button type="button" className="mini-knopf" onClick={() => setBpm(bpm / 1.1)} aria-label="10 Prozent langsamer">−10%</button>
        <input className="regler mini-regler" type="range" min={20} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" />
        <button type="button" className="mini-knopf" onClick={() => setBpm(bpm * 1.1)} aria-label="10 Prozent schneller">+10%</button>
        <button type="button" className="mini-knopf" onClick={() => setVoll(true)} aria-label="Ganzes Metronom öffnen" title="Ganzes Metronom">⋯</button>
      </div>
      {voll && (
        <div className="blatt-hintergrund" onClick={() => setVoll(false)}>
          <div className="blatt" role="dialog" aria-label="Metronom" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" className="mini-knopf" onClick={() => setVoll(false)}>Fertig</button>
            </div>
            <Metronom />
          </div>
        </div>
      )}
    </>
  );
}
