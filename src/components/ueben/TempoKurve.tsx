'use client';

import { useEffect, useRef, useState } from 'react';
import { reserveVon, tagesbeste, tempoAchse, type Tempo } from '@/domain/stellen';

// Tempo-Verlauf einer Stelle (F-12): je Übetag das Beste als Linie, alle
// geschafften Tempi als leise Punkte (so sieht man das Aufwärmen), Ziel als
// Linie und die Reserve (+10 %) als Band darüber — der Deckel der Kurve.
// Antippen bzw. Überfahren zeigt den Tag in der Zeile darüber (verdeckt nichts).

const datum = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const wochentag = (t: number) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short' });

export function TempoKurve({ tempi, ziel, kompakt = false }: { tempi: Tempo[]; ziel: number | null; kompakt?: boolean }) {
  const huelle = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  const [aktiv, setAktiv] = useState<number | null>(null);
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tage = tagesbeste(tempi);
  const reserve = ziel ? reserveVon(ziel) : null;
  const H = kompakt ? 120 : 190;
  const L = 32, R = 10, O = 12, U = 22, INNEN = 12;
  const W = breite;

  // Dieselbe Hülle in jedem Fall: Sie wird einmal vermessen.
  if (!tage.length) {
    return (
      <div ref={huelle} className="kurve">
        <p className="gedaempft text-sm">Noch kein Tempo geschafft — mit „✓ … geschafft“ kommt hier der erste Punkt.</p>
      </div>
    );
  }

  const achse = tempoAchse([...tempi.map((t) => t.tempo), ...(ziel && reserve ? [ziel, reserve] : [])]);
  const y = (v: number) => O + (1 - (v - achse.min) / (achse.max - achse.min)) * (H - O - U);
  const x0 = tage[0].tag, x1 = tage[tage.length - 1].tag;
  const x = (tag: number) => (x1 === x0 ? (L + W - R) / 2 : L + INNEN + ((tag - x0) / (x1 - x0)) * (W - L - R - 2 * INNEN));
  const letzter = tage[tage.length - 1];
  const zeiger = aktiv === null ? null : tage[Math.min(aktiv, tage.length - 1)];

  // Zeiger findet den nächsten Übetag (wie ein Fadenkreuz), nicht den Punkt.
  const naechster = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    tage.forEach((t, i) => { if (Math.abs(x(t.tag) - px) < Math.abs(x(tage[best].tag) - px)) best = i; });
    setAktiv(best);
  };

  const beschreibung = `Tempo-Verlauf: ${tage.length} ${tage.length === 1 ? 'Übetag' : 'Übetage'}, zuletzt ${letzter.tempo}`
    + `, bestes ${Math.max(...tage.map((t) => t.tempo))}${ziel ? `, Ziel ${ziel}` : ''}.`;

  return (
    <div ref={huelle} className="kurve">
      <p className="kurve-tipp" aria-live="polite">
        {zeiger ? (
          <><strong>{zeiger.tempo}</strong> bestes · {wochentag(zeiger.tag)} {datum(zeiger.tag)}{zeiger.alle.length > 1 ? ` · geschafft ${zeiger.alle.join(' · ')}` : ''}</>
        ) : <span className="kurve-tipp-leer">Tippe auf einen Tag</span>}
      </p>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={beschreibung} className="kurve-svg">
          {achse.striche.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="kurve-gitter" />
              <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="kurve-achse">{v}</text>
            </g>
          ))}
          {ziel && reserve && (
            <>
              <rect x={L} width={W - L - R} y={y(reserve)} height={Math.max(0, y(ziel) - y(reserve))} className="kurve-reserve" />
              <line x1={L} x2={W - R} y1={y(ziel)} y2={y(ziel)} className="kurve-ziel" />
              {/* Links beschriftet: Dort liegen die frühen, langsameren Tage — rechts steht der letzte Wert. */}
              <text x={L + 4} y={y(ziel) + 12} className="kurve-marke">Ziel {ziel}</text>
              <text x={L + 4} y={y(reserve) - 4} className="kurve-marke leise">+10 % · {reserve}</text>
            </>
          )}
          {zeiger && <line x1={x(zeiger.tag)} x2={x(zeiger.tag)} y1={O} y2={H - U} className="kurve-zeiger" />}
          {tage.map((t) => t.alle.map((v, i) => <circle key={`${t.tag}:${i}`} cx={x(t.tag)} cy={y(v)} r={3} className="kurve-punkt" />))}
          {tage.length > 1 && (
            <polyline points={tage.map((t) => `${x(t.tag)},${y(t.tempo)}`).join(' ')} className="kurve-linie" />
          )}
          {tage.map((t) => <circle key={t.tag} cx={x(t.tag)} cy={y(t.tempo)} r={4.5} className="kurve-bestes" />)}
          <text x={x(letzter.tag)} y={y(letzter.tempo) - 9} textAnchor={tage.length > 1 ? 'end' : 'middle'} className="kurve-wert">{letzter.tempo}</text>
          <text x={L} y={H - 6} className="kurve-achse">{datum(x0)}</text>
          {x1 !== x0 && <text x={W - R} y={H - 6} textAnchor="end" className="kurve-achse">{datum(x1)}</text>}
          <rect x={L} y={0} width={Math.max(0, W - L - R)} height={H} fill="transparent" className="kurve-fang"
            onPointerDown={naechster} onPointerMove={naechster}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAktiv(null); }} />
        </svg>
      )}
      <div className="kurve-legende" aria-hidden="true">
        <span><i className="schluessel-linie" />Bestes je Tag</span>
        <span><i className="schluessel-punkt" />geschafft</span>
        {ziel && <span><i className="schluessel-ziel" />Ziel · Reserve</span>}
      </div>
    </div>
  );
}
