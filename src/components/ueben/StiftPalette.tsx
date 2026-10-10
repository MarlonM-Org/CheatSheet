'use client';

import { useRef } from 'react';
import { DICKEN, FARBEN, type StiftEinstellung, type ZeichenWerkzeug } from '@/domain/stift';
import { useSchiebbar } from './schiebbar';

export type Werkzeug = 'stift' | 'marker' | 'text' | 'radierer' | 'stelle';
const ZEICHNER: Werkzeug[] = ['stift', 'marker', 'text'];

// Werkzeug-Palette (E-03), Vorbild Apples Pencil-Palette: schwebend und frei
// verschiebbar, Undo/Redo, jedes Werkzeug merkt sich Farbe und Dicke.
// Doppeltipp auf die Werkzeug-Reihe wechselt zum Radierer und zurück — wie
// der Doppeltipp am Apple Pencil (den Safari an Webseiten nicht durchreicht).
export function StiftPalette({
  werkzeug, wechseln, einst, einstellen, fingerZeichnen, setFingerZeichnen,
  rueckgaengig, wiederholen, kannRueck, kannWieder, hinweis, schliessen,
}: {
  werkzeug: Werkzeug | null;
  wechseln: (w: Werkzeug | null) => void;
  einst: Record<ZeichenWerkzeug, StiftEinstellung>;
  einstellen: (w: ZeichenWerkzeug, e: StiftEinstellung) => void;
  fingerZeichnen: boolean; setFingerZeichnen: (b: boolean) => void;
  rueckgaengig: () => void; wiederholen: () => void;
  kannRueck: boolean; kannWieder: boolean;
  hinweis: string | null;
  schliessen: () => void;
}) {
  const { panel, lage, ebene, anfassen, bewegen, loslassen } = useSchiebbar('ueben:lage-stift');
  // Doppeltipp-Erkennung: Werkzeug vor dem ERSTEN Tipp zählt.
  const tipp = useRef<{ t: number; vorher: Werkzeug | null } | null>(null);
  const zurueckNach = useRef<Werkzeug>('stift');

  function werkzeugTipp(w: Werkzeug, jetzt: number) {
    const letzter = tipp.current;
    tipp.current = { t: jetzt, vorher: werkzeug };
    if (letzter && jetzt - letzter.t < 350) {
      tipp.current = null;
      if (letzter.vorher === 'radierer') wechseln(zurueckNach.current);
      else {
        if (letzter.vorher) zurueckNach.current = letzter.vorher;
        wechseln('radierer');
      }
      return;
    }
    if (w !== 'radierer') zurueckNach.current = w === 'stelle' ? zurueckNach.current : w;
    wechseln(w);
  }

  const zeichner = werkzeug && ZEICHNER.includes(werkzeug) ? (werkzeug as ZeichenWerkzeug) : null;
  const dicken = zeichner ? DICKEN[zeichner] : [];
  const farben = zeichner ? FARBEN[zeichner] : [];

  const WERKZEUGE: { w: Werkzeug; name: string; pfad: React.ReactNode }[] = [
    { w: 'stift', name: 'Stift', pfad: <path d="M4 20l1.2-4.2L16.6 4.4a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.2 18.8 4 20z" /> },
    { w: 'marker', name: 'Marker', pfad: <><path d="M6.5 15.5l9-9a1.6 1.6 0 0 1 2.3 0l-0.3-0.3a1.6 1.6 0 0 1 0 2.3l-9 9-3.6 1.3 1.6-3.3z" /><path d="M4.5 20.5h15" /></> },
    { w: 'text', name: 'Text', pfad: <><path d="M5 6V4.5h14V6" /><path d="M12 4.5V19.5M9.5 19.5h5" /></> },
    { w: 'radierer', name: 'Radierer', pfad: <><path d="M8.5 19.5L4 15a1.8 1.8 0 0 1 0-2.5L12.5 4a1.8 1.8 0 0 1 2.5 0l4.5 4.5a1.8 1.8 0 0 1 0 2.5l-8.5 8.5z" /><path d="M8.5 19.5H19.5" /></> },
    { w: 'stelle', name: 'Stelle', pfad: <rect x="4.5" y="6.5" width="15" height="11" rx="1" strokeDasharray="3 2.4" /> },
  ];

  return (
    <div ref={panel as React.RefObject<HTMLDivElement>}
      className={`stift-palette ${lage ? 'schwebt' : ''}`}
      style={lage ? { left: lage.x, top: lage.y, zIndex: 42 + ebene } : undefined}
      role="toolbar" aria-label="Zeichenwerkzeuge"
      onPointerDown={anfassen} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
      <div className="palette-zeile">
        <svg className="griff" viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" /><circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" /></svg>
        <button type="button" className="palette-knopf" onClick={rueckgaengig} disabled={!kannRueck} aria-label="Rückgängig" title="Rückgängig">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5L4.5 10.5l4 4" /><path d="M4.5 10.5H15a4.5 4.5 0 0 1 0 9h-3" /></svg>
        </button>
        <button type="button" className="palette-knopf" onClick={wiederholen} disabled={!kannWieder} aria-label="Wiederholen" title="Wiederholen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 6.5l4 4-4 4" /><path d="M19.5 10.5H9a4.5 4.5 0 0 0 0 9h3" /></svg>
        </button>
        <span className="palette-trenner" aria-hidden="true" />
        <div className="palette-werkzeuge" role="group" aria-label="Werkzeug (Doppeltipp: Radierer)">
          {WERKZEUGE.map(({ w, name, pfad }) => (
            <button key={w} type="button" className="werkzeug-knopf" aria-pressed={werkzeug === w}
              onClick={(e) => werkzeugTipp(w, e.timeStamp)} aria-label={name} title={name}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{pfad}</svg>
            </button>
          ))}
        </div>
        <span className="palette-trenner" aria-hidden="true" />
        <button type="button" className="palette-knopf" onClick={schliessen} aria-label="Werkzeuge schließen" title="Werkzeuge schließen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {zeichner && (
        <div className="palette-zeile optionen">
          {dicken.length > 0 && (
            <div className="palette-dicken" role="group" aria-label="Dicke">
              {dicken.map((d, i) => (
                <button key={d.wert} type="button" className="dicke-knopf" aria-pressed={einst[zeichner].breite === d.wert}
                  onClick={() => einstellen(zeichner, { ...einst[zeichner], breite: d.wert })} aria-label={`Dicke ${d.name}`} title={d.name}>
                  <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
                </button>
              ))}
            </div>
          )}
          <div className="palette-farben" role="group" aria-label="Farbe">
            {farben.map((f) => (
              <button key={f} type="button" className="farb-knopf" style={{ background: f }}
                aria-pressed={einst[zeichner].farbe === f}
                onClick={() => einstellen(zeichner, { ...einst[zeichner], farbe: f })} aria-label="Farbe wählen" />
            ))}
          </div>
        </div>
      )}
      {(werkzeug === 'stift' || werkzeug === 'marker' || werkzeug === 'radierer') && (
        <div className="palette-zeile fuss">
          <label className="palette-schalter">
            <input type="checkbox" checked={fingerZeichnen} onChange={(e) => setFingerZeichnen(e.target.checked)} /> auch mit dem Finger
          </label>
          {hinweis && <span className="palette-hinweis">{hinweis}</span>}
        </div>
      )}
      {werkzeug !== 'stift' && werkzeug !== 'marker' && werkzeug !== 'radierer' && hinweis && (
        <div className="palette-zeile fuss"><span className="palette-hinweis">{hinweis}</span></div>
      )}
    </div>
  );
}
