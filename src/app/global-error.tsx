'use client';

// Letzte Rettung, falls sogar das Layout scheitert.
export default function GlobalerFehler() {
  return (
    <html lang="de">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#fcfcfb', color: '#1d1b17' }}>
        <h1>CheatSheet</h1>
        <p>Gerade klappt etwas nicht. Deine Noten, Stellen und Anmerkungen bleiben auf diesem Gerät.</p>
        <button type="button" onClick={() => location.reload()} style={{ padding: '0.6rem 1rem', borderRadius: 10, fontWeight: 700 }}>Neu laden</button>
      </body>
    </html>
  );
}
