'use client';

import { useRef } from 'react';
import { aufspannen, ziehen, type Griff } from '@/domain/ausschnitt';
import type { Rechteck } from '@/domain/ueben';

const GRIFFE: Griff[] = ['nw', 'n', 'no', 'w', 'o', 'sw', 's', 'so'];
const NAME: Record<Griff, string> = {
  nw: 'Ecke oben links', n: 'Kante oben', no: 'Ecke oben rechts', w: 'Kante links', o: 'Kante rechts',
  sw: 'Ecke unten links', s: 'Kante unten', so: 'Ecke unten rechts', mitte: 'Ausschnitt',
};

// Ausschnitt einer Seite einstellen: Rahmen über der ganzen Seite, an Ecken
// und Kanten ziehen, in der Mitte verschieben, daneben neu aufziehen.
// Liegt im Blatt — Koordinaten sind Anteile der Seite (wie Stellen).
export function AusschnittRahmen({ r, setzen, blatt }: {
  r: Rechteck; setzen: (r: Rechteck) => void; blatt: React.RefObject<HTMLDivElement | null>;
}) {
  const zug = useRef<{ griff: Griff | 'neu'; start: Rechteck; x: number; y: number } | null>(null);
  const aussen = useRef<HTMLDivElement>(null);
  const relativ = (e: React.PointerEvent) => {
    const b = blatt.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
  };
  const greifen = (e: React.PointerEvent, griff: Griff | 'neu') => {
    // Nicht blättern, nicht zeichnen: der Rahmen gehört dem Einstellen.
    e.stopPropagation();
    e.preventDefault();
    // Alle Bewegungen an die Fläche, egal welcher Griff gefasst wurde.
    aussen.current!.setPointerCapture(e.pointerId);
    const p = relativ(e);
    zug.current = { griff, start: r, x: p.x, y: p.y };
  };
  const bewegen = (e: React.PointerEvent) => {
    const z = zug.current;
    if (!z) return;
    const p = relativ(e);
    setzen(z.griff === 'neu' ? (aufspannen(z.x, z.y, p.x, p.y) ?? z.start) : ziehen(z.start, z.griff, p.x - z.x, p.y - z.y));
  };
  const loslassen = (e: React.PointerEvent) => { e.stopPropagation(); zug.current = null; };
  // Griffe und Mitte greifen selbst; die Fläche daneben zieht neu auf.
  const lage = { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` };
  return (
    <>
    {/* Abdunkeln nur auf der Seite; die Griffe dürfen über den Rand ragen. */}
    <div className="b-aus-schatten" aria-hidden="true"><div className="b-aus-loch" style={lage} /></div>
    <div ref={aussen} className="b-aus-flaeche" onPointerDown={(e) => greifen(e, 'neu')}
      onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
      <div className="b-aus" style={lage}
        aria-label={NAME.mitte} onPointerDown={(e) => greifen(e, 'mitte')}>
        {GRIFFE.map((g) => (
          <span key={g} className={`b-aus-griff g-${g}`} aria-label={NAME[g]} onPointerDown={(e) => greifen(e, g)} />
        ))}
      </div>
    </div>
    </>
  );
}
