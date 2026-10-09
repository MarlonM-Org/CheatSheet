import type { Metadata, Viewport } from 'next';
import { ADRESSE } from '@/adresse';
import { Offline } from '@/components/Offline';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(ADRESSE),
  title: 'Üben · Notenpult',
  description: 'Metronom, Stimmgerät und Notenpult zum Üben. Alles bleibt auf dem Gerät.',
  // Persönliches Werkzeug, nicht für Suchmaschinen.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Üben', statusBarStyle: 'black' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111111' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="kopf">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <span className="block text-lg font-extrabold leading-tight">Üben</span>
            <span className="block text-xs tracking-wider opacity-70">METRONOM · STIMMGERÄT · NOTENPULT</span>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-8">
          <p className="gedaempft text-sm">Alles bleibt auf diesem Gerät — keine Anmeldung, kein Konto, nichts auf einem Server.</p>
        </footer>
        <Offline />
      </body>
    </html>
  );
}
