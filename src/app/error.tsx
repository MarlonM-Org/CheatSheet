'use client';

import { istNachladeFehler } from '@/domain/nachladen';

// Fängt Fehler der Seite ab. Die Daten liegen in IndexedDB und sind von so
// einem Fehler nicht betroffen. Das Layout hat kein eigenes Polster mehr
// (B-01), darum bringt die Karte ihren Rahmen selbst mit.
export default function Fehler({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const neueVersion = istNachladeFehler(error);
  return (
    <div className="mx-auto max-w-xl p-4" role="alert">
      <div className="karte space-y-3">
      <h1 className="abschnitt-titel">{neueVersion ? 'Neue Version verfügbar' : 'CheatSheet hat gerade ein Problem'}</h1>
      <p>
        {neueVersion
          ? 'Inzwischen gibt es eine neuere Version. Bitte neu laden.'
          : 'Deine Noten, Stellen und Anmerkungen bleiben auf diesem Gerät. Neu laden hilft meistens.'}
      </p>
      <button className="knopf" type="button" onClick={() => location.reload()}>Neu laden</button>
      {error.digest && <p className="gedaempft text-xs">Fehlercode: {error.digest}</p>}
      </div>
    </div>
  );
}
