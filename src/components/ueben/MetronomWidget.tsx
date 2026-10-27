'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TAKTARTEN, taktartText } from '@/domain/takt';
import { gespeichert, speichern } from './klang';
import { Metronom } from './Metronom';
import { useMetronom } from './MetronomKontext';
import { useSchiebbar } from './schiebbar';
import { useDialogFokus, useEscape } from './tasten';

// Metronom als Widget (B-03): Start/Stopp, Tempo (antippen zum Eintippen),
// Regler, −1/+1 und ±10 %, Taktart mit Taktpunkten (antippen: Kästchen mit
// den üblichen Taktarten, D-07). Am Kopf frei über den Bildschirm
// schiebbar, damit die Noten lesbar bleiben. „Alles" öffnet das volle
// Metronom; dieser Zustand liegt in der Zentrale, damit die Blätter-Tasten
// hinter dem Dialog gesperrt sind. Schließen blendet nur aus — der
// Taktgeber läuft im Kontext weiter.
//
// Schmal (D-06, D-07): eine aufrechte Säule, nur so breit wie der Start-Knopf —
// Start, Taktart mit Punkten, Tempo, +1 und −1 übereinander (so hoch wie der
// Start-Knopf); ohne Regler und ohne ±10 %. Gemerkt je Gerät
// (`ueben:metronom-schmal`).
export function MetronomWidget({ schliessen, voll, vollSetzen }: {
  schliessen: () => void; voll: boolean; vollSetzen: (an: boolean) => void;
}) {
  const { bpm, setBpm, laeuft, start, stopp, aktiv, takt, nenner, taktartSetzen, akzente } = useMetronom();
  const [eingabe, setEingabe] = useState<string | null>(null);
  const [taktWahl, setTaktWahl] = useState(false);
  const taktHuelle = useRef<HTMLDivElement>(null);
  // Das Kästchen schließt, sobald irgendwo anders getippt wird — der Tipp
  // selbst geht durch (kein Fang), damit nie zwei Aufklapper stehen.
  useEffect(() => {
    if (!taktWahl) return;
    const zu = (e: PointerEvent) => { if (!taktHuelle.current?.contains(e.target as Node)) setTaktWahl(false); };
    document.addEventListener('pointerdown', zu, true);
    return () => document.removeEventListener('pointerdown', zu, true);
  }, [taktWahl]);
  const taktWahlZu = useCallback(() => setTaktWahl(false), []);
  useEscape(taktWahlZu, taktWahl);
  const [schmal, setSchmal] = useState(() => gespeichert('ueben:metronom-schmal', false));
  const schmalSetzen = (an: boolean) => { setSchmal(an); speichern('ueben:metronom-schmal', an); };
  const { panel, lage, ebene, anfassen, bewegen, loslassen } = useSchiebbar('ueben:lage-metronom');
  const uebernehmen = () => { const n = Number(eingabe); if (n) setBpm(n); setEingabe(null); };

  const startKnopf = (
    <button type="button" className="metro-start" aria-pressed={laeuft} aria-label={laeuft ? 'Metronom stoppen' : 'Metronom starten'}
      onClick={laeuft ? stopp : () => void start()}>
      {laeuft
        ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5v9M13 5.5v9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
        : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor" /></svg>}
    </button>
  );
  const tempo = eingabe !== null ? (
    <input className="metro-zahl tempo-eingabe" autoFocus inputMode="numeric" value={eingabe} aria-label="Tempo eingeben"
      onChange={(e) => setEingabe(e.target.value.replace(/\D/g, '').slice(0, 3))}
      onBlur={uebernehmen} onKeyDown={(e) => { if (e.key === 'Enter') uebernehmen(); if (e.key === 'Escape') setEingabe(null); }} />
  ) : (
    <button type="button" className="metro-bpm" onClick={() => setEingabe(String(bpm))} aria-label={`Tempo ${bpm}, antippen zum Eingeben`}>
      <span className="metro-zahl">{bpm}</span>
      <span className="metro-einheit">BPM</span>
    </button>
  );
  const punkte = (
    <div className="metro-punkte" aria-hidden="true">
      {akzente.map((a, i) => (
        <i key={i} className={`${aktiv?.schlag === i && aktiv.sub === 0 ? 'an' : ''} ${a === 'betont' ? 'eins' : ''} ${a === 'stumm' ? 'stumm' : ''}`} />
      ))}
    </div>
  );
  const taktLabel = <span className="metro-taktlabel">{schmal ? '' : 'Takt '}{taktartText(takt, nenner)}</span>;
  // Taktart und Punkte sind ein Knopf: Antippen klappt ein kleines Popover
  // mit den üblichen Taktarten auf (wie die Schnellwahl der großen Ansicht);
  // es schwebt über dem Widget, nichts rückt.
  const taktKnopf = (
    <div className="metro-takt-huelle" ref={taktHuelle}>
      <button type="button" className="metro-takt" aria-haspopup="true" aria-expanded={taktWahl}
        aria-label={`Taktart ${taktartText(takt, nenner)}, antippen zum Wählen`} onClick={() => setTaktWahl(!taktWahl)}>
        {taktLabel}
        {punkte}
      </button>
      {taktWahl && (
        <div className="metro-taktwahl" role="group" aria-label="Taktart wählen">
          {TAKTARTEN.map(([z, n]) => (
            <button key={`${z}/${n}`} type="button" className="taktart-chip" aria-pressed={z === takt && n === nenner}
              onClick={() => { taktartSetzen(z, n); setTaktWahl(false); }}>
              {taktartText(z, n)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const alles = <button type="button" className="text-knopf gedaempft text-xs underline" onClick={() => vollSetzen(true)}>alles</button>;

  return (
    <section ref={panel} className={`panel ${lage ? 'schwebt' : ''} ${schmal ? 'metro-schmal' : ''}`}
      style={lage ? { left: lage.x, top: lage.y, zIndex: 41 + ebene } : undefined}
      role="region" aria-label="Metronom">
      <div className="panel-kopf anfasser" onPointerDown={anfassen} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
        <svg className="griff" viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" /><circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" /></svg>
        {!schmal && <h2>Metronom</h2>}
        {!schmal && alles}
        <button type="button" className="panel-zu metro-breite" onClick={() => schmalSetzen(!schmal)}
          aria-label={schmal ? 'Breite Ansicht' : 'Schmale Ansicht'} title={schmal ? 'Breite Ansicht' : 'Schmale Ansicht'}>
          {schmal
            ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 10H2.5M5 7.5 2.5 10 5 12.5M12 10h5.5M15 7.5l2.5 2.5-2.5 2.5" /></svg>
            : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10H8M5.5 7.5 8 10l-2.5 2.5M17.5 10H12M14.5 7.5 12 10l2.5 2.5" /></svg>}
        </button>
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Metronom-Widget ausblenden">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      {schmal ? (
        <div className="metro-saeule">
          {startKnopf}
          {taktKnopf}
          {tempo}
          <div className="gruppe senkrecht">
            <button type="button" onClick={() => setBpm(bpm + 1)} aria-label="Ein Schlag schneller">+1</button>
            <button type="button" onClick={() => setBpm(bpm - 1)} aria-label="Ein Schlag langsamer">−1</button>
          </div>
          {alles}
        </div>
      ) : (
        <>
          <div className="metro-zeile1">
            {startKnopf}
            {tempo}
            {taktKnopf}
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
          <div className="metro-zeile3">
            <input className="regler" type="range" min={20} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" />
          </div>
        </>
      )}
      {voll && <MetronomBlatt schliessen={() => vollSetzen(false)} />}
    </section>
  );
}

// Als Portal: Das Dock bildet einen eigenen Stapel-Kontext (z-index),
// der Dialog muss aber über Leiste und Bibliothek liegen.
function MetronomBlatt({ schliessen }: { schliessen: () => void }) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt" role="dialog" aria-modal="true" aria-label="Metronom" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>
        <Metronom />
      </div>
    </div>,
    document.body,
  );
}
