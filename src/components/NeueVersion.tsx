'use client';

// Meldung, wenn Code einer neueren Version fehlt: nur neu laden hilft.
export function NeueVersion() {
  return (
    <div className="karte space-y-3" role="alert">
      <p className="font-bold">Neue Version verfügbar — bitte neu laden.</p>
      <button type="button" className="knopf" onClick={() => location.reload()}>Neu laden</button>
    </div>
  );
}
