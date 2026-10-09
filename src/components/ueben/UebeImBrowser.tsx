'use client';

import dynamic from 'next/dynamic';

// Nur im Browser rendern: Einstellungen kommen aus dem Gerätespeicher, Audio
// und Mikrofon gibt es auf dem Server nicht.
export const UebeImBrowser = dynamic(() => import('./UebeZentrale').then((m) => m.UebeZentrale), {
  ssr: false,
  loading: () => <p className="gedaempft">Lädt …</p>,
});
