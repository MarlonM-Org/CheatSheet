'use client';

import { useState } from 'react';
import { Metronom } from './Metronom';
import { useMetronom } from './MetronomKontext';

// Metronom als angedocktes Widget (B-03): Start/Stopp, Tempo (antippen zum
// Eintippen), −1/+1 und ±10 %, Taktpunkte. „Alles" öffnet das volle Metronom.
// Schließen blendet nur aus — der Taktgeber läuft im Kontext weiter.
export function MetronomWidget({ schliessen }: { schliessen: () => void }) {
  const { bpm, setBpm, laeuft, start, stopp, aktiv, akzente } = useMetronom();
  const [eingabe, setEingabe] = useState<string | null>(null);
  const [voll, setVoll] = useState(false);
  const uebernehmen = () => { const n = Number(eingabe); if (n) setBpm(n); setEingabe(null); };

  return (
    <section className="panel" role="region" aria-label="Metronom">
      <div className="panel-kopf">
        <h2>Metronom</h2>
        <button type="button" className="text-knopf gedaempft text-xs underline" onClick={() => setVoll(true)}>alles</button>
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Metronom-Widget ausblenden">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="metro-zeile1">
        <button type="button" className="metro-start" aria-pressed={laeuft} aria-label={laeuft ? 'Metronom stoppen' : 'Metronom starten'}
          onClick={laeuft ? stopp : () => void start()}>
          {laeuft
            ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5v9M13 5.5v9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
            : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor" /></svg>}
        </button>
        {eingabe !== null ? (
          <input className="metro-zahl tempo-eingabe" autoFocus inputMode="numeric" value={eingabe} aria-label="Tempo eingeben"
            onChange={(e) => setEingabe(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={uebernehmen} onKeyDown={(e) => { if (e.key === 'Enter') uebernehmen(); if (e.key === 'Escape') setEingabe(null); }} />
        ) : (
          <button type="button" className="metro-bpm" onClick={() => setEingabe(String(bpm))} aria-label={`Tempo ${bpm}, antippen zum Eingeben`}>
            <span className="metro-zahl">{bpm}</span>
            <span className="metro-einheit">BPM</span>
          </button>
        )}
        <div className="metro-takt">
          <span className="metro-taktlabel">Takt {akzente.length}/4</span>
          <div className="metro-punkte" aria-hidden="true">
            {akzente.map((a, i) => (
              <i key={i} className={`${aktiv?.schlag === i && aktiv.sub === 0 ? 'an' : ''} ${i === 0 ? 'eins' : ''} ${a === 'stumm' ? 'stumm' : ''}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="metro-zeile2">
        <div className="gruppe">
          <button type="button" onClick={() => setBpm(bpm - 1)} aria-label="Ein Schlag langsamer">−1</button>
          <button type="button" onClick={() => setBpm(bpm + 1)} aria-label="Ein Schlag schneller">+1</button>
        </div>
        <div className="gruppe">
          <button type="button" onClick={() => setBpm(bpm / 1.1)} aria-label="Zehn Prozent langsamer">−10 %</button>
          <button type="button" onClick={() => setBpm(bpm * 1.1)} aria-label="Zehn Prozent schneller">+10 %</button>
        </div>
      </div>
      {voll && (
        <div className="blatt-hintergrund" onClick={() => setVoll(false)}>
          <div className="blatt" role="dialog" aria-label="Metronom" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setVoll(false)}>Fertig</button>
            </div>
            <Metronom />
          </div>
        </div>
      )}
    </section>
  );
}
