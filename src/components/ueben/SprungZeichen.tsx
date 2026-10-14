// Notenzeichen zu den Sprüngen (F-05), neben dem Kürzel: Segno beim D.S.,
// das Coda-Zeichen, das Wiederholungszeichen. D.C. hat keins. Als SVG — die
// Unicode-Zeichen (𝄋 𝄌 𝄇) fehlen vielen Schriften.
import type { SprungArt } from '@/domain/spruenge';

export function SprungZeichen({ art }: { art: SprungArt }) {
  if (art === 'dc') return null;
  return (
    <svg className="sprung-zeichen" viewBox="0 0 24 24" aria-hidden="true">
      {art === 'ds' && (
        <>
          <path d="M15.9 7.3C15 5.6 13 5 11.3 5.3 9.4 5.7 8.2 7.2 8.6 8.8c.4 1.7 2.4 2.4 3.9 3 1.6.6 3.6 1.3 3.9 3 .3 1.7-1 3.2-2.9 3.5-1.7.3-3.6-.2-4.5-1.8" />
          <path d="M6.5 20 17.5 4" />
          <circle className="voll" cx="6.4" cy="13.6" r="1.35" />
          <circle className="voll" cx="17.6" cy="10.4" r="1.35" />
        </>
      )}
      {art === 'coda' && (
        <>
          <ellipse cx="12" cy="12" rx="5.4" ry="6.2" />
          <path d="M12 2.5v19M2.5 12h19" />
        </>
      )}
      {art === 'wdh' && (
        <>
          <circle className="voll" cx="6" cy="9.2" r="1.5" />
          <circle className="voll" cx="6" cy="14.8" r="1.5" />
          <path d="M11.2 4v16" />
          <rect className="voll" x="15" y="4" width="3.6" height="16" />
        </>
      )}
    </svg>
  );
}
