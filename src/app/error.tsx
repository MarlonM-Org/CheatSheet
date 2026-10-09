'use client';

import { istNachladeFehler } from '@/domain/nachladen';

// Fängt Fehler der Seite ab. Kopf und Fuß (Layout) bleiben stehen. Die Daten
// liegen in IndexedDB und sind von so einem Fehler nicht betroffen.
export default function Fehler({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const neueVersion = istNachladeFehler(error);
  return (
    <div className="karte space-y-3" role="alert">
      <h1 className="abschnitt-titel">{neueVersion ? 'Neue Version verfügbar' : 'CheatSheet hat gerade ein Problem'}</h1>
      <p>
        {neueVersion
          ? 'Inzwischen gibt es eine neuere Version. Bitte neu laden.'
          : 'Deine Noten, Stellen und Anmerkungen bleiben auf diesem Gerät. Neu laden hilft meistens.'}
      </p>
      <button className="knopf" type="button" onClick={() => location.reload()}>Neu laden</button>
      {error.digest && <p className="gedaempft text-xs">Fehlercode: {error.digest}</p>}
    </div>
  );
}
