import type { MetadataRoute } from 'next';

// Statisch erzeugt (output: 'export'). „standalone“: als App vom Home-Bildschirm
// ohne Browserleiste.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CheatSheet',
    short_name: 'CheatSheet',
    description: 'Noten, schwierige Stellen, Metronom und Stimmgerät — alles auf deinem Gerät.',
    lang: 'de',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fcfcfb',
    theme_color: '#fcfcfb',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
