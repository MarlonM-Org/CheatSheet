'use client';

import { useRef, useState } from 'react';
import { hexVon, istHell, rgbAus } from '@/domain/farbe';
import { DICKEN, eigeneFarbe, FARBEN, RADIERER_BREITEN, type Pipetten, type StiftEinstellung, type ZeichenWerkzeug } from '@/domain/stift';
import { STEMPEL, STEMPEL_FAKTOREN, STEMPEL_REIHE, type StempelZeichen } from '@/domain/stempel';
import { Farbwaehler } from './Farbwaehler';
import { StempelBild } from './SprungZeichen';
import { useSchiebbar } from './schiebbar';

export type Werkzeug = 'stift' | 'marker' | 'text' | 'radierer' | 'stelle' | 'schere' | 'stempel';
// Schere (E-12): Ausschnitt als Sticker — oder Schnitt mit Lücke zum Schreiben.
export type SchereModus = 'sticker' | 'schnitt';
const ZEICHNER: Werkzeug[] = ['stift', 'marker', 'text'];

// Markerfarben sind halbtransparent (Malwirkung) — Spitze und Rondell
// zeigen sie satt, wie bei Apples Textmarker.
const deckend = (f: string) => f.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)');
const alsHex = (f: string) => hexVon(rgbAus(f) ?? { r: 0, g: 0, b: 0 });

// Werkzeug-Palette (E-03) nach dem Vorbild der System-Stiftpalette auf dem
// iPad (Dateien/Markierungen): eine schwebende Pille, aus der die Werkzeuge
// als gezeichnete Instrumente ragen — das aktive hebt sich heraus, die
// Spitzen tragen die gewählte Farbe. Tipp aufs aktive Werkzeug öffnet die
// Optionen-Blase (Strichstärken, Radierer-Breiten, Finger-Schalter), das
// Farbrondell rechts die Farben — mit Pipette und Farbwähler (E-08). Doppeltipp auf die Werkzeug-Reihe wechselt zum Radierer und
// zurück — wie der Doppeltipp am Apple Pencil (den Safari nicht durchreicht).

// ── Instrumente: gezeichnete Stifte, Spitze in der aktuellen Farbe ──────

// Feine Kontur um die farbigen Teile: So bleibt auch Weiß (E-09) auf der
// hellen Palette zu sehen; bei dunklen Farben fällt sie nicht auf.
const KONTUR = 'rgba(0, 0, 0, 0.22)';

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
      <path d="M14 2 L20.5 20 L7.5 20 Z" fill={farbe} stroke={KONTUR} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M14 2 L16.2 8 L11.8 8 Z" fill="rgba(0,0,0,0.25)" />
      <rect x="7.5" y="20" width="13" height="5.5" fill="url(#ik-metall)" />
      <rect x="7" y="25.5" width="14" height="6.5" fill={farbe} stroke={KONTUR} strokeWidth="0.7" />
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
      <path d="M9 4 L19 4 L21.5 18 L6.5 18 Z" fill={farbe} stroke={KONTUR} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M9 4 L19 4 L19.6 7.5 L8.4 7.5 Z" fill="rgba(0,0,0,0.22)" />
      <rect x="5.5" y="18" width="17" height="7" fill={farbe} stroke={KONTUR} strokeWidth="0.7" />
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
      <rect x="7" y="22" width="14" height="5" fill={farbe} stroke={KONTUR} strokeWidth="0.7" />
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

// Schere (E-12): zwei Klingen mit Ösen, Sticker-Ecke darunter.
function SchereKoerper() {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-schere" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
      </defs>
      <path d="M7 8a7 7 0 0 1 14 0v80H7z" fill="url(#ik-schere)" />
      <path d="M10.5 6.5L17.5 20M17.5 6.5L10.5 20" stroke="#3a3a40" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.5" cy="22.5" r="2.3" fill="none" stroke="#3a3a40" strokeWidth="1.5" />
      <circle cx="18.5" cy="22.5" r="2.3" fill="none" stroke="#3a3a40" strokeWidth="1.5" />
      <rect x="8.5" y="30" width="11" height="7" rx="1" fill="#a8781f" opacity="0.55" />
    </svg>
  );
}

// Stempel (E-04): Griff mit Platte, darunter ein kleines Segno.
function StempelKoerper() {
  return (
    <svg className="instrument" viewBox="0 0 28 92" aria-hidden="true">
      <defs>
        <linearGradient id="ik-stempel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c9cf" /><stop offset="0.3" stopColor="#f6f6f8" />
          <stop offset="0.7" stopColor="#e6e6ea" /><stop offset="1" stopColor="#b9b9c1" />
        </linearGradient>
      </defs>
      <path d="M7 8a7 7 0 0 1 14 0v80H7z" fill="url(#ik-stempel)" />
      <rect x="6" y="20" width="16" height="6" rx="1.5" fill="#3a3a40" />
      <path d="M11 20v-5a3 3 0 0 1 6 0v5" fill="none" stroke="#3a3a40" strokeWidth="1.6" />
      <g transform="translate(8.5 28) scale(0.46)" fill="none" stroke="#a8781f" strokeWidth="2.6" strokeLinecap="round">
        <path d="M16.4 5.3C15.6 3.4 13.5 2.6 11.7 3.2 9.7 3.9 8.7 5.9 9.4 7.8c.7 1.9 2.7 2.6 4.2 3.6 1.5 1 3.3 2.2 3.5 4.3.2 2.2-1.3 4-3.4 4.4-2 .4-4.3-.5-5-2.4" />
        <path d="M6 22.5 18 1.5" />
      </g>
    </svg>
  );
}

// Pipette: Glas mit Gummikappe, schräg — wie die übliche Pipette.
function PipettenBild() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.6 4.6a2.6 2.6 0 0 1 3.7 0l1.1 1.1a2.6 2.6 0 0 1 0 3.7l-1.9 1.9 1 1-1.5 1.5-5.3-5.3 1.5-1.5 1 1z" />
      <path d="M11.2 8.4L4.8 14.8a2 2 0 0 0-.5.9l-.6 2.6-.9.9a1.1 1.1 0 0 0 1.6 1.6l.9-.9 2.6-.6a2 2 0 0 0 .9-.5l6.4-6.4" />
    </svg>
  );
}

// ── Palette ─────────────────────────────────────────────────────────────

export function StiftPalette({
  werkzeug, wechseln, einst, einstellen, radierBreite, radiererEinstellen,
  pipetten, farbeAufnehmen, setFarbeAufnehmen, fingerZeichnen, setFingerZeichnen,
  rueckgaengig, wiederholen, kannRueck, kannWieder, schereModus, schereEinstellen, stempel, stempelEinstellen, stempelFaktor, stempelFaktorEinstellen,
}: {
  werkzeug: Werkzeug | null;
  wechseln: (w: Werkzeug | null) => void;
  einst: Record<ZeichenWerkzeug, StiftEinstellung>;
  einstellen: (w: ZeichenWerkzeug, e: StiftEinstellung) => void;
  radierBreite: number; radiererEinstellen: (b: number) => void;
  pipetten: Pipetten; farbeAufnehmen: boolean; setFarbeAufnehmen: (an: boolean) => void;
  fingerZeichnen: boolean; setFingerZeichnen: (b: boolean) => void;
  rueckgaengig: () => void; wiederholen: () => void;
  schereModus: SchereModus; schereEinstellen: (m: SchereModus) => void;
  stempel: StempelZeichen; stempelEinstellen: (z: StempelZeichen) => void;
  stempelFaktor: number; stempelFaktorEinstellen: (f: number) => void;
  kannRueck: boolean; kannWieder: boolean;
}) {
  const { panel, lage, ebene, anfassen, bewegen, loslassen } = useSchiebbar('ueben:lage-stift');
  const [blase, setBlase] = useState<'optionen' | 'farben' | 'waehler' | null>(null);
  // Schwebt die Palette weit oben, öffnen die Blasen nach unten.
  const blaseUnten = !!lage && lage.y < 380;
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
    if (w !== 'radierer') zurueckNach.current = w === 'stelle' || w === 'schere' ? zurueckNach.current : w;
    setBlase(null);
    wechseln(w);
  }

  const zeichner = werkzeug && ZEICHNER.includes(werkzeug) ? (werkzeug as ZeichenWerkzeug) : null;
  // Welche Farbe gilt: eine der Palette, die der Pipette oder eine eigene.
  const farbe = zeichner ? einst[zeichner].farbe : null;
  const pipette = zeichner ? pipetten[zeichner] : undefined;
  const herkunft = !zeichner || !farbe ? null : FARBEN[zeichner].includes(farbe) ? 'palette' : farbe === pipette ? 'pipette' : 'eigen';
  const blasenKlasse = `palette-blase ${blaseUnten ? 'unten' : ''}`;
  const dickenWerkzeug = werkzeug === 'stift' || werkzeug === 'marker' ? (werkzeug as 'stift' | 'marker') : null;

  const WERKZEUGE: { w: Werkzeug; name: string; bild: React.ReactNode }[] = [
    { w: 'stift', name: 'Stift', bild: <StiftKoerper farbe={einst.stift.farbe} /> },
    { w: 'marker', name: 'Marker', bild: <MarkerKoerper farbe={deckend(einst.marker.farbe)} /> },
    { w: 'text', name: 'Text', bild: <TextKoerper farbe={einst.text.farbe} /> },
    { w: 'radierer', name: 'Radierer', bild: <RadiererKoerper /> },
    { w: 'stelle', name: 'Stelle', bild: <StelleKoerper /> },
    { w: 'schere', name: 'Schere', bild: <SchereKoerper /> },
    { w: 'stempel', name: 'Stempel', bild: <StempelKoerper /> },
  ];

  return (
    <div ref={panel as React.RefObject<HTMLDivElement>}
      className={`stift-palette ${lage ? 'schwebt' : ''}`}
      style={lage ? { left: lage.x, top: lage.y, zIndex: 42 + ebene } : undefined}
      role="toolbar" aria-label="Zeichenwerkzeuge"
      onPointerDown={anfassen} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>

      {blase === 'optionen' && dickenWerkzeug && (
        <div className={blasenKlasse} role="group" aria-label="Strichstärke">
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
      {blase === 'optionen' && werkzeug === 'stempel' && (
        <div className={blasenKlasse} role="group" aria-label="Stempel">
          <div className="blase-stempel">
            {STEMPEL_REIHE.map((z) => (
              <button key={z} type="button" className="stempel-knopf" aria-pressed={stempel === z} title={STEMPEL[z].name} aria-label={STEMPEL[z].name}
                onClick={() => { stempelEinstellen(z); setBlase(null); }}>
                <StempelBild zeichen={z} />
              </button>
            ))}
          </div>
          <div className="segment !mx-0 mt-2" role="group" aria-label="Größe der Stempel">
            {STEMPEL_FAKTOREN.map((f) => (
              <button key={f.wert} type="button" aria-pressed={stempelFaktor === f.wert} onClick={() => stempelFaktorEinstellen(f.wert)}>{f.name}</button>
            ))}
          </div>
          <p className="palette-hinweis">Antippen setzt den Stempel mit der Mitte auf die Stelle. Der Radierer nimmt ihn ganz weg.</p>
        </div>
      )}
      {blase === 'optionen' && werkzeug === 'schere' && (
        <div className={blasenKlasse} role="group" aria-label="Schere">
          <div className="segment !mx-0" role="group" aria-label="Was die Schere tut">
            <button type="button" aria-pressed={schereModus === 'sticker'} onClick={() => { schereEinstellen('sticker'); setBlase(null); }}>Sticker</button>
            <button type="button" aria-pressed={schereModus === 'schnitt'} onClick={() => { schereEinstellen('schnitt'); setBlase(null); }}>Schnitt</button>
          </div>
          <p className="palette-hinweis">
            {schereModus === 'sticker' ? 'Rahmen um Takte ziehen: ein Sticker, den du verschieben und auf eine andere Seite legen kannst.'
              : 'Antippen und nach unten ziehen: schneidet die Seite auf und macht Platz zum Schreiben.'}
          </p>
        </div>
      )}
      {blase === 'optionen' && werkzeug === 'radierer' && (
        <div className={blasenKlasse} role="group" aria-label="Radierer">
          <div className="blase-dicken">
            {RADIERER_BREITEN.map((d, i) => (
              <button key={d.wert} type="button" className="dicke-knopf" aria-pressed={radierBreite === d.wert}
                onClick={() => { radiererEinstellen(d.wert); setBlase(null); }}
                aria-label={`Radierer ${d.name}`} title={d.name}>
                <svg viewBox="0 0 44 20" aria-hidden="true">
                  <circle cx="22" cy="10" r={2.2 + i * 2.4} fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            ))}
          </div>
          <label className="palette-schalter">
            <input type="checkbox" checked={fingerZeichnen} onChange={(e) => setFingerZeichnen(e.target.checked)} /> auch mit dem Finger
          </label>
        </div>
      )}
      {blase === 'farben' && zeichner && (
        <div className={blasenKlasse} role="group" aria-label="Farbe">
          <div className="blase-farben">
            {FARBEN[zeichner].map((f) => (
              <button key={f} type="button" className="farb-knopf" style={{ background: f }}
                aria-pressed={farbe === f}
                onClick={() => { einstellen(zeichner, { ...einst[zeichner], farbe: f }); setBlase(null); }} aria-label="Farbe wählen" />
            ))}
            {/* Rechte Spalte: oben die Pipette (in ihrer zuletzt aufgenommenen
                Farbe), unten der Farbwähler. */}
            <button type="button" className={`farb-knopf farb-pipette ${pipette && istHell(rgbAus(pipette)!) ? 'hell' : ''}`}
              style={pipette ? { background: deckend(pipette) } : undefined}
              aria-pressed={herkunft === 'pipette'} title="Farbe vom Blatt aufnehmen"
              aria-label="Pipette: Farbe vom Blatt aufnehmen"
              onClick={() => { setFarbeAufnehmen(true); setBlase(null); }}>
              <PipettenBild />
            </button>
            <button type="button" className="farb-knopf farb-eigen" aria-pressed={herkunft === 'eigen'}
              title="Eigene Farbe" aria-label="Eigene Farbe wählen" onClick={() => setBlase('waehler')}>
              {herkunft === 'eigen' && farbe && <i style={{ background: deckend(farbe) }} />}
            </button>
          </div>
        </div>
      )}
      {blase === 'waehler' && zeichner && farbe && (
        <div className={`${blasenKlasse} blase-waehler`} role="group" aria-label="Eigene Farbe">
          <Farbwaehler key={zeichner} farbe={alsHex(farbe)}
            setzen={(hex) => einstellen(zeichner, { ...einst[zeichner], farbe: eigeneFarbe(zeichner, rgbAus(hex)!) })}
            fertig={() => setBlase(null)} />
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

      <button type="button" className={`farb-rondell ${farbeAufnehmen ? 'nimmt-auf' : ''}`} disabled={!zeichner}
        aria-label={farbeAufnehmen ? 'Pipette beenden' : 'Farbe wählen'} aria-pressed={blase === 'farben' || blase === 'waehler' || farbeAufnehmen}
        title={farbeAufnehmen ? 'Pipette beenden' : 'Farbe'}
        onClick={() => {
          if (farbeAufnehmen) { setFarbeAufnehmen(false); return; }
          setBlase(blase === 'farben' || blase === 'waehler' ? null : 'farben');
        }}>
        <i style={{ background: farbe ? deckend(farbe) : 'var(--flaeche2)' }}>{farbeAufnehmen && <PipettenBild />}</i>
      </button>
    </div>
  );
}
