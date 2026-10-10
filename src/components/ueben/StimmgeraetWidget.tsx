'use client';

import { createPortal } from 'react-dom';
import { Stimmgeraet } from './Stimmgeraet';
import { useStimmgeraet } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

const SAUBER = 5; // ±Cent, die als sauber gelten

// Stimmgerät als angedocktes Widget (B-03): Start/Stopp, erkannter Ton,
// feine Skala, Abweichung als „+2"/„−3". „Alles" öffnet die große Ansicht
// (Kammerton, Stimmung, Referenzton); dieser Zustand liegt in der Zentrale,
// damit die Blätter-Tasten hinter dem Dialog gesperrt sind. Ausblenden
// stoppt das Mikrofon.
export function StimmgeraetWidget({ schliessen, voll, vollSetzen }: {
  schliessen: () => void; voll: boolean; vollSetzen: (an: boolean) => void;
}) {
  const { an, start, stopp, fehler, ton, frisch } = useStimmgeraet();

  const cent = ton?.cent ?? 0;
  const sauber = ton && frisch && Math.abs(cent) <= SAUBER;
  const farbe = !ton || !frisch ? 'var(--leise)' : sauber ? 'var(--gut)' : Math.abs(cent) <= 15 ? 'var(--messing)' : 'var(--warnung)';
  const zustand = !an ? 'Mikrofon ist aus'
    : !ton ? 'Spiel einen Ton'
    : sauber ? 'rein' : Math.abs(cent) <= 15 ? 'fast rein' : cent < 0 ? 'zu tief' : 'zu hoch';
  // ±50 Cent auf die Skalenbreite, Mitte 110
  const x = 110 + (Math.max(-50, Math.min(50, cent)) / 50) * 100;

  return (
    <section className="panel" role="region" aria-label="Stimmgerät">
      <div className="panel-kopf">
        <h2>Stimmgerät</h2>
        <button type="button" className="text-knopf gedaempft text-xs underline" onClick={() => vollSetzen(true)}>alles</button>
        <button type="button" className="panel-zu" onClick={() => { stopp(); schliessen(); }} aria-label="Stimmgerät ausblenden">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="stimm-zeile">
        <button type="button" className="metro-start" aria-pressed={an} aria-label={an ? 'Mikrofon stoppen' : 'Mikrofon starten'}
          onClick={an ? stopp : () => void start()}>
          {an
            ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5v9M13 5.5v9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20M9.5 20h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
        </button>
        <div className="stimm-ton" style={{ color: farbe, opacity: ton && !frisch ? 0.45 : 1 }} aria-live="polite"
          aria-label={ton ? `Erkannter Ton ${ton.name}, Abweichung ${cent > 0 ? 'plus' : 'minus'} ${Math.abs(cent)}` : 'Kein Ton erkannt'}>
          {ton ? ton.name : '–'}<span className="stimm-okt">{ton?.oktave ?? ''}</span>
        </div>
        <div className="stimm-skala" aria-hidden="true">
          <svg viewBox="0 0 220 44">
            {Array.from({ length: 11 }, (_, i) => {
              const c = -50 + i * 10;
              const tx = 110 + (c / 50) * 100;
              const lang = c === 0 || Math.abs(c) === 50;
              return <line key={c} x1={tx} y1={lang ? 8 : 13} x2={tx} y2={lang ? 36 : 31}
                stroke={c === 0 ? 'var(--gedaempft)' : 'var(--linie-stark)'} strokeWidth={c === 0 ? 2 : 1.3} />;
            })}
            <rect x={110 - (SAUBER / 50) * 100} y="18" width={(SAUBER / 50) * 200} height="8" fill="var(--gut)" opacity={sauber ? 0.6 : 0.22} />
            {ton && (
              <g style={{ transform: `translateX(${x - 110}px)`, transition: 'transform 120ms ease-out' }}>
                <line x1="110" y1="4" x2="110" y2="40" stroke={farbe} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
          </svg>
        </div>
        <div className="stimm-wert">
          <span className="stimm-abw tabular-nums" style={{ color: farbe }}>{ton && frisch ? `${cent > 0 ? '+' : cent < 0 ? '−' : ''}${Math.abs(cent)}` : '–'}</span>
          <span className="stimm-zustand">{zustand}</span>
        </div>
      </div>
      {fehler && <p className="warnung px-4 pb-3 text-sm">{fehler}</p>}
      {voll && <StimmgeraetBlatt schliessen={() => vollSetzen(false)} />}
    </section>
  );
}

// Als Portal: Das Dock bildet einen eigenen Stapel-Kontext (z-index),
// der Dialog muss aber über Leiste und Bibliothek liegen.
function StimmgeraetBlatt({ schliessen }: { schliessen: () => void }) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt" role="dialog" aria-modal="true" aria-label="Stimmgerät" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>
        <Stimmgeraet />
      </div>
    </div>,
    document.body,
  );
}
