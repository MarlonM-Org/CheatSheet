import type { Metadata, Viewport } from 'next';
import { ADRESSE } from '@/adresse';
import { Offline } from '@/components/Offline';
import { ThemaWaechter } from '@/components/thema';
import './globals.css';

// Farbwelt vor dem ersten Bild anwenden (kein Aufblitzen der falschen Farben).
// Muss zur Logik in src/domain/thema.ts passen (Schlüssel, Standards).
const THEMA_SCRIPT = `(function(){try{
var g=function(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
var m=g('ueben:modus');if(m!=='hell'&&m!=='dunkel')m='system';
var d=m==='dunkel'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
var t=d?g('ueben:thema-dunkel'):g('ueben:thema-hell');
var ok=d?['dunkelblau','schwarz']:['weiss','sommer'];
if(ok.indexOf(t)<0)t=d?'dunkelblau':'weiss';
document.documentElement.dataset.thema=t;
}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(ADRESSE),
  title: 'CheatSheet',
  description: 'Noten, schwierige Stellen, Metronom und Stimmgerät. Alles auf deinem Gerät.',
  // Persönliches Werkzeug, nicht für Suchmaschinen.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'CheatSheet', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fcfcfb' };

// Keine Kopf- und Fußzeile (B-01): Die Noten sind die App, die Navigation
// ist die untere Leiste in der Übe-Zentrale. ThemaWaechter hält die
// Farbwelt aktuell, das Inline-Script wendet sie vor dem ersten Bild an.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEMA_SCRIPT }} />
        <ThemaWaechter />
        {children}
        <Offline />
      </body>
    </html>
  );
}
