'use client';

import { useState } from 'react';

// Favorit (★) einer Stelle: gefüllt in Messing = Favorit, nur Umriss = keiner.
// An und aus unterscheiden sich in der Form, nicht nur in der Farbe.
export function Stern({ an }: { an: boolean }) {
  return (
    <svg className={`stern ${an ? 'an' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z"
        fill={an ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

// Stern-Knopf (44 × 44): ein Tipp setzt oder nimmt den Favoriten. Kurzes
// Aufploppen beim Setzen (nicht bei reduzierter Bewegung, siehe CSS).
export function SternKnopf({ an, umschalten, className = '', ...rest }: {
  an: boolean; umschalten: () => void; className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className'>) {
  const [ploppt, setPloppt] = useState(0);
  return (
    <button type="button" className={`stern-knopf ${className}`} aria-pressed={an} aria-label="Favorit"
      title={an ? 'Favorit — antippen nimmt den Stern weg' : 'Als Favorit markieren'}
      onClick={() => { if (!an) setPloppt((n) => n + 1); umschalten(); }} {...rest}>
      <span key={ploppt} className={ploppt ? 'stern-plopp' : undefined}><Stern an={an} /></span>
    </button>
  );
}
