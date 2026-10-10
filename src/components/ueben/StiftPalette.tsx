'use client';

import { useRef, useState } from 'react';
import { DICKEN, FARBEN, type StiftEinstellung, type ZeichenWerkzeug } from '@/domain/stift';
import { useSchiebbar } from './schiebbar';

export type Werkzeug = 'stift' | 'marker' | 'text' | 'radierer' | 'stelle';
const ZEICHNER: Werkzeug[] = ['stift', 'marker', 'text'];

// Markerfarben sind halbtransparent (Malwirkung) — Spitze und Rondell
// zeigen sie satt, wie bei Apples Textmarker.
const deckend = (f: string) => f.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)');

// Werkzeug-Palette (E-03) nach dem Vorbild der System-Stiftpalette auf dem
// iPad (Dateien/Markierungen): eine schwebende Pille, aus der die Werkzeuge
// als gezeichnete Instrumente ragen — das aktive hebt sich heraus, die
// Spitzen tragen die gewählte Farbe. Tipp aufs aktive Werkzeug öffnet die
// Optionen-Blase (Strichstärken, Finger-Schalter), das Farbrondell rechts
// die Farben. Doppeltipp auf die Werkzeug-Reihe wechselt zum Radierer und
// zurück — wie der Doppeltipp am Apple Pencil (den Safari nicht durchreicht).

// ── Instrumente: gezeichnete Stifte, Spitze in der aktuellen Farbe ──────

function StiftKoerper({ farbe }: { farbe: string }) {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-stift" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
        <linearGradient id="ik-metall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a9aa2" /><stop offset="0.35" stopColor="#dcdce2" />
          <stop offset="0.7" stopColor="#c0c0c8" /><stop offset="1" stopColor="#8e8e96" />
        </linearGradient>
      </defs>
      <path d="M14 2 L20.5 20 L7.5 20 Z" fill={farbe} />
      <path d="M14 2 L16.2 8 L11.8 8 Z" fill="rgba(0,0,0,0.25)" />
      <rect x="7.5" y="20" width="13" height="5.5" fill="url(#ik-metall)" />
      <rect x="7" y="25.5" width="14" height="6.5" fill={farbe} />
      <path d="M7 32h14v56a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 7 88z" fill="url(#ik-stift)" />
    </svg>
  );
}

function MarkerKoerper({ farbe }: { farbe: string }) {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-marker" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
      </defs>
      <path d="M9 4 L19 4 L21.5 18 L6.5 18 Z" fill={farbe} />
      <path d="M9 4 L19 4 L19.6 7.5 L8.4 7.5 Z" fill="rgba(0,0,0,0.22)" />
      <rect x="5.5" y="18" width="17" height="7" fill={farbe} />
      <path d="M5.5 25h17v62a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 5.5 87z" fill="url(#ik-marker)" />
    </svg>
  );
}

function TextKoerper({ farbe }: { farbe: string }) {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-text" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
      </defs>
      <path d="M7 8a7 7 0 0 1 14 0v80H7z" fill="url(#ik-text)" />
      <rect x="7" y="22" width="14" height="5" fill={farbe} />
      <text x="14" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#3a3a40"
        fontFamily="-apple-system, system-ui, sans-serif">Aa</text>
    </svg>
  );
}

function RadiererKoerper() {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-radierer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
        <linearGradient id="ik-gummi" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f8f97" /><stop offset="0.35" stopColor="#c6c6cd" />
          <stop offset="1" stopColor="#85858d" />
        </linearGradient>
      </defs>
      <path d="M7 10a7 7 0 0 1 14 0v14H7z" fill="url(#ik-gummi)" />
      <path d="M7 24h14v64a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 7 88z" fill="url(#ik-radierer)" />
      <rect x="7" y="24" width="14" height="2" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
}

function StelleKoerper() {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-stelle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
      </defs>
      <path d="M7 8a7 7 0 0 1 14 0v80H7z" fill="url(#ik-stelle)" />
      <rect x="8.5" y="10" width="11" height="8.5" rx="1.5" fill="none" stroke="#a8781f"
        strokeWidth="1.5" strokeDasharray="2.6 2" />
      <rect x="7" y="24" width="14" height="5" fill="#a8781f" opacity="0.55" />
    </svg>
  );
}

// ── Palette ─────────────────────────────────────────────────────────────

export function StiftPalette({
  werkzeug, wechseln, einst, einstellen, fingerZeichnen, setFingerZeichnen,
  rueckgaengig, wiederholen, kannRueck, kannWieder,
}: {
  werkzeug: Werkzeug | null;
  wechseln: (w: Werkzeug | null) => void;
  einst: Record<ZeichenWerkzeug, StiftEinstellung>;
  einstellen: (w: ZeichenWerkzeug, e: StiftEinstellung) => void;
  fingerZeichnen: boolean; setFingerZeichnen: (b: boolean) => void;
  rueckgaengig: () => void; wiederholen: () => void;
  kannRueck: boolean; kannWieder: boolean;
}) {
  const { panel, lage, ebene, anfassen, bewegen, loslassen } = useSchiebbar('ueben:lage-stift');
  const [blase, setBlase] = useState<'optionen' | 'farben' | null>(null);
  // Doppeltipp-Erkennung: das Werkzeug vor dem ERSTEN Tipp zählt.
  const tipp = useRef<{ t: number; vorher: Werkzeug | null } | null>(null);
  const zurueckNach = useRef<Werkzeug>('stift');

  function werkzeugTipp(w: Werkzeug, jetzt: number) {
    const letzter = tipp.current;
    tipp.current = { t: jetzt, vorher: werkzeug };
    if (letzter && jetzt - letzter.t < 350) {
      // Doppeltipp: Radierer ↔ voriges Werkzeug (wie am Apple Pencil).
      tipp.current = null;
      setBlase(null);
      if (letzter.vorher === 'radierer') wechseln(zurueckNach.current);
      else {
        if (letzter.vorher) zurueckNach.current = letzter.vorher;
        wechseln('radierer');
      }
      return;
    }
    if (w === werkzeug) {
      // Tipp aufs aktive Werkzeug: Optionen auf/zu (wie bei Apple).
      if (w !== 'stelle' && w !== 'text') setBlase(blase === 'optionen' ? null : 'optionen');
      return;
    }
    if (w !== 'radierer') zurueckNach.current = w === 'stelle' ? zurueckNach.current : w;
    setBlase(null);
    wechseln(w);
  }

  const zeichner = werkzeug && ZEICHNER.includes(werkzeug) ? (werkzeug as ZeichenWerkzeug) : null;
  const dickenWerkzeug = werkzeug === 'stift' || werkzeug === 'marker' ? (werkzeug as 'stift' | 'marker') : null;

  const WERKZEUGE: { w: Werkzeug; name: string; bild: React.ReactNode }[] = [
    { w: 'stift', name: 'Stift', bild: <StiftKoerper farbe={einst.stift.farbe} /> },
    { w: 'marker', name: 'Marker', bild: <MarkerKoerper farbe={deckend(einst.marker.farbe)} /> },
    { w: 'text', name: 'Text', bild: <TextKoerper farbe={einst.text.farbe} /> },
    { w: 'radierer', name: 'Radierer', bild: <RadiererKoerper /> },
    { w: 'stelle', name: 'Stelle', bild: <StelleKoerper /> },
  ];

  return (
    <div ref={panel as React.RefObject<HTMLDivElement>}
      className={`stift-palette ${lage ? 'schwebt' : ''}`}
      style={lage ? { left: lage.x, top: lage.y, zIndex: 42 + ebene } : undefined}
      role="toolbar" aria-label="Zeichenwerkzeuge"
      onPointerDown={anfassen} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>

      {blase === 'optionen' && dickenWerkzeug && (
        <div className="palette-blase" role="group" aria-label="Strichstärke">
          <div className="blase-dicken">
            {DICKEN[dickenWerkzeug].map((d) => (
              <button key={d.wert} type="button" className="dicke-knopf" aria-pressed={einst[dickenWerkzeug].breite === d.wert}
                onClick={() => { einstellen(dickenWerkzeug, { ...einst[dickenWerkzeug], breite: d.wert }); setBlase(null); }}
                aria-label={`Strichstärke ${d.name}`} title={d.name}>
                <svg viewBox="0 0 44 20" aria-hidden="true">
                  <line x1="5" y1="10" x2="39" y2="10" stroke="currentColor"
                    strokeWidth={2 + DICKEN[dickenWerkzeug].findIndex((x) => x.wert === d.wert) * 2.6} strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
          <label className="palette-schalter">
            <input type="checkbox" checked={fingerZeichnen} onChange={(e) => setFingerZeichnen(e.target.checked)} /> auch mit dem Finger
          </label>
        </div>
      )}
      {blase === 'optionen' && werkzeug === 'radierer' && (
        <div className="palette-blase" role="group" aria-label="Radierer">
          <label className="palette-schalter">
            <input type="checkbox" checked={fingerZeichnen} onChange={(e) => setFingerZeichnen(e.target.checked)} /> auch mit dem Finger
          </label>
        </div>
      )}
      {blase === 'farben' && zeichner && (
        <div className="palette-blase" role="group" aria-label="Farbe">
          <div className="blase-farben">
            {FARBEN[zeichner].map((f) => (
              <button key={f} type="button" className="farb-knopf" style={{ background: f }}
                aria-pressed={einst[zeichner].farbe === f}
                onClick={() => { einstellen(zeichner, { ...einst[zeichner], farbe: f }); setBlase(null); }} aria-label="Farbe wählen" />
            ))}
          </div>
        </div>
      )}

      <svg className="griff" viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" /><circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" /></svg>
      <button type="button" className="palette-knopf" onClick={rueckgaengig} disabled={!kannRueck} aria-label="Rückgängig" title="Rückgängig">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5L4.5 10.5l4 4" /><path d="M4.5 10.5H15a4.5 4.5 0 0 1 0 9h-3" /></svg>
      </button>
      <button type="button" className="palette-knopf" onClick={wiederholen} disabled={!kannWieder} aria-label="Wiederholen" title="Wiederholen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 6.5l4 4-4 4" /><path d="M19.5 10.5H9a4.5 4.5 0 0 0 0 9h3" /></svg>
      </button>

      <div className="werkzeug-schale" role="group" aria-label="Werkzeug (Doppeltipp: Radierer)">
        {WERKZEUGE.map(({ w, name, bild }) => (
          <button key={w} type="button" className="werkzeug-knopf" aria-pressed={werkzeug === w}
            onClick={(e) => werkzeugTipp(w, e.timeStamp)} aria-label={name} title={name}>
            {bild}
          </button>
        ))}
      </div>

      <button type="button" className="farb-rondell" disabled={!zeichner}
        aria-label="Farbe wählen" aria-pressed={blase === 'farben'} title="Farbe"
        onClick={() => setBlase(blase === 'farben' ? null : 'farben')}>
        <i style={{ background: zeichner ? deckend(einst[zeichner].farbe) : 'var(--flaeche2)' }} />
      </button>
    </div>
  );
}
