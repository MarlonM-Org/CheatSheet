import type { MetadataRoute } from 'next';

// Statisch erzeugt (output: 'export'). „standalone“: als App vom Home-Bildschirm
// ohne Browserleiste.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Üben',
    short_name: 'Üben',
    description: 'Metronom, Stimmgerät und Notenpult. Alles bleibt auf dem Gerät.',
    lang: 'de',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
