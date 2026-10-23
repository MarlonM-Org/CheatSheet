// Notenzeichen zu den Sprüngen (F-05): Segno beim D.S., das Coda-Zeichen
// (beide aus den Stempeln, E-04), das Wiederholungszeichen. D.C. hat keins.
// Als SVG — die Unicode-Zeichen (𝄋 𝄌 𝄇) fehlen vielen Schriften.
import type { SprungArt } from '@/domain/spruenge';
import { STEMPEL, type StempelZeichen } from '@/domain/stempel';

export function SprungZeichen({ art }: { art: SprungArt }) {
  if (art === 'dc') return null;
  if (art === 'ds' || art === 'coda') return <StempelBild zeichen={art === 'ds' ? 'segno' : 'coda'} className="sprung-zeichen" />;
  return (
    <svg className="sprung-zeichen" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="voll" cx="6" cy="9.2" r="1.5" />
      <circle className="voll" cx="6" cy="14.8" r="1.5" />
      <path d="M11.2 4v16" />
      <rect className="voll" x="15" y="4" width="3.6" height="16" />
    </svg>
  );
}

// Ein Stempel als Bild (Palette, Sprungzeichen): Pfade als SVG, Text kursiv.
export function StempelBild({ zeichen, className = 'stempel-bild' }: { zeichen: StempelZeichen; className?: string }) {
  const bild = STEMPEL[zeichen];
  if (bild.text) {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize={bild.schrift ?? 15} fontStyle="italic" fontWeight="700"
          fontFamily="'Times New Roman', Georgia, serif" fill="currentColor" stroke="none">{bild.text}</text>
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {(bild.pfade ?? []).map((p, i) => <path key={i} d={p.d} className={p.voll ? 'voll' : undefined} />)}
    </svg>
  );
}
