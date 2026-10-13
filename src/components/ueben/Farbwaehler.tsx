'use client';

import { useRef, useState } from 'react';
import { hexEingabe, hexVon, hsvAus, rgbAus, rgbAusHsv, type HSV, type RGB } from '@/domain/farbe';

// Farbwähler (E-08) — die übliche Ausstattung im Stil der Stift-Palette:
// Feld für Sättigung (nach rechts) und Helligkeit (nach oben), Farbton-
// Leiste, Regler für Rot, Grün und Blau, Hex-Feld. Jede Änderung gilt sofort
// (die Spitze des Werkzeugs zeigt sie), „Fertig“ schließt.
export function Farbwaehler({ farbe, setzen, fertig }: {
  farbe: string; // „#rrggbb“
  setzen: (hex: string) => void;
  fertig: () => void;
}) {
  // HSV als eigener Stand: Bei Grau (keine Sättigung) bliebe der Farbton
  // sonst nicht stehen, und die Leiste spränge auf Rot.
  const [hsv, setHsv] = useState<HSV>(() => hsvAus(rgbAus(farbe) ?? { r: 0, g: 0, b: 0 }));
  const rgb = rgbAusHsv(hsv), hex = hexVon(rgb);
  // Während der Eingabe darf das Hex-Feld unfertig sein.
  const [hexText, setHexText] = useState<string | null>(null);

  const waehlen = (neu: HSV) => { setHsv(neu); setzen(hexVon(rgbAusHsv(neu))); };
  const ausRgb = (neu: RGB) => {
    const h = hsvAus(neu);
    waehlen(h.s === 0 || h.v === 0 ? { ...h, h: hsv.h } : h);
  };

  const feld = useRef<HTMLDivElement>(null);
  const feldGriff = (e: React.PointerEvent) => {
    const r = feld.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    waehlen({ ...hsv, s, v });
  };

  const regler = (name: string, k: keyof RGB) => {
    const ende = (x: number) => hexVon({ ...rgb, [k]: x });
    return (
      <label className="fw-regler">
        <span>{name}</span>
        <input type="range" min={0} max={255} value={rgb[k]} aria-label={name}
          style={{ '--spur': `linear-gradient(to right, ${ende(0)}, ${ende(255)})` } as React.CSSProperties}
          onChange={(e) => ausRgb({ ...rgb, [k]: Number(e.target.value) })} />
        <output className="tabular-nums">{rgb[k]}</output>
      </label>
    );
  };

  return (
    // Ziehen im Wähler verschiebt nicht die Palette.
    <div className="farbwaehler" onPointerDown={(e) => e.stopPropagation()}>
      <div ref={feld} className="fw-feld" role="slider" aria-label="Sättigung und Helligkeit" tabIndex={0}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s * 100)} aria-valuetext={hex}
        style={{ '--ton': `hsl(${hsv.h} 100% 50%)` } as React.CSSProperties}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); feldGriff(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) feldGriff(e); }}
        onKeyDown={(e) => {
          const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
          if (!d) return;
          e.preventDefault();
          waehlen({ ...hsv, s: Math.max(0, Math.min(1, hsv.s + d[0])), v: Math.max(0, Math.min(1, hsv.v + d[1])) });
        }}>
        <i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <input type="range" className="fw-ton" min={0} max={359} value={Math.round(hsv.h)} aria-label="Farbton"
        onChange={(e) => waehlen({ ...hsv, h: Number(e.target.value) })} />
      {regler('R', 'r')}
      {regler('G', 'g')}
      {regler('B', 'b')}
      <div className="fw-fuss">
        <span className="fw-probe" style={{ background: hex }} aria-hidden="true" />
        <label className="fw-hex">
          <span>#</span>
          <input value={hexText ?? hex.slice(1)} maxLength={7} spellCheck={false} autoCapitalize="off" autoComplete="off"
            aria-label="Hex-Code"
            onChange={(e) => {
              setHexText(e.target.value);
              const neu = hexEingabe(e.target.value);
              if (neu) ausRgb(rgbAus(neu)!);
            }}
            onBlur={() => setHexText(null)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setHexText(null); fertig(); } }} />
        </label>
        <button type="button" className="knopf knopf-klein" onClick={fertig}>Fertig</button>
      </div>
    </div>
  );
}
