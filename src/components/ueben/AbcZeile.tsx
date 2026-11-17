'use client';

import { useEffect, useRef, useState } from 'react';

// Eine kleine, nur gezeigte Notenzeile aus ABC-Text (abcjs, erst bei Bedarf
// geladen) — für Spickzettel, Etüden, Licks, Griffweisen. Füllt die Breite,
// zeichnet bei Größenänderung neu, Farbe aus dem Thema. Die Höhe ist
// reserviert (`hoehe`), damit nichts springt, während abcjs lädt. Mehrere
// Notenbilder im Text (X:1, X:2 … — die Etüden: eins je Tonart, damit jede
// ihre Vorzeichen vorne hat) stehen untereinander.

export function AbcZeile({ abc, hoehe = 96, label, umbrechen = true }: {
  abc: string; hoehe?: number; label?: string;
  /** false: die Zeilen des ABC-Texts bleiben, wie sie sind (Etüden: eine Tonart je Zeile). */
  umbrechen?: boolean;
}) {
  const bild = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    const el = bild.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = bild.current;
    if (!el || !breite) return;
    let aktuell = true;
    const tinte = getComputedStyle(el).getPropertyValue('--tinte').trim() || '#222';
    void import('abcjs').then((m) => {
      if (!aktuell || !bild.current) return;
      const stuecke = abc.split(/\n(?=X:)/).filter((t) => t.trim());
      const ziele = stuecke.map(() => document.createElement('div'));
      bild.current.replaceChildren(...ziele);
      const zeichnen = (skala: number) => stuecke.forEach((t, i) => m.renderAbc(ziele[i], t, {
        add_classes: true, paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0,
        scale: skala, staffwidth: (breite - 8) / skala, foregroundColor: tinte,
        // Schmal (Handy): umbrechen statt abschneiden.
        // Feste Zeilen: auf die Breite verkleinern, falls eine nicht passt.
        ...(umbrechen ? { wrap: { minSpacing: 1.4, maxSpacing: 2.6, preferredMeasuresPerLine: breite < 560 ? 2 : 4 } } : { responsive: 'resize' as const }),
      }));
      zeichnen(breite >= 560 ? 1.1 : 0.95);
      setFehler(false);
    }).catch(() => { if (aktuell) setFehler(true); });
    return () => { aktuell = false; };
  }, [abc, breite, umbrechen]);

  return (
    <div className="abc-zeile" style={{ minHeight: hoehe }} role="img" aria-label={label}>
      <div ref={bild} />
      {fehler && <p className="gedaempft text-sm">Die Noten ließen sich nicht zeichnen.</p>}
    </div>
  );
}
