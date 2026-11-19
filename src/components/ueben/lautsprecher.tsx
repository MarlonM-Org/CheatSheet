'use client';

import { useEffect } from 'react';
import { LAUTSPRECHER_SCHLUESSEL, LAUTSPRECHER_STANDARD, lautsprecherAnfang } from '@/domain/lautsprecher';
import { imHintergrundWeiter } from '@/domain/taktgeber';
import { geraeteSchalter, hintergrundSchalter, mischenSchalter, useSchalter } from './klang';

// Lautsprecher für alle Klänge (B-20): eine Wahl fürs ganze Gerät. Jeder
// Schalter „Lautsprecher“ (Einstellungen, Stimmgerät, Metronom, Drone,
// Einsingen, Ohr-Trainer, Aufnehmen, Etüden, Licks, Hör-Übungen,
// Spickzettel, Griffe) zeigt und ändert dieselbe. Was sie fürs Mikrofon
// bedeutet: @/domain/lautsprecher. Dazu (D-08) „Mit anderen Apps mischen“
// und „Metronom im Hintergrund“ — ebenfalls am Gerät, Regeln in
// @/domain/lautsprecher und @/domain/taktgeber.

// Ist noch nichts gewählt, gelten die früheren Schalter (lautsprecherAnfang).
const lautsprecher = geraeteSchalter(LAUTSPRECHER_SCHLUESSEL, LAUTSPRECHER_STANDARD, lautsprecherAnfang);

// Die gültige Wahl; beim ersten Lesen aus dem Speicher (samt früherer Schalter).
export const lautsprecherAn = lautsprecher.an;
// Ändern: merken und allen Bescheid geben — noch in der Tipp-Geste, damit
// ein laufendes Stimmgerät sein Mikrofon gleich neu öffnen kann.
export const lautsprecherSetzen = lautsprecher.setzen;

export function useLautsprecher(): [boolean, (an: boolean) => void] {
  return useSchalter(lautsprecher);
}

// Ruft `tun` nach jedem Umschalten auf (synchron, in der Geste). `tun` sollte stabil sein.
export function useBeimUmschalten(tun: () => void) {
  useEffect(() => lautsprecher.abonnieren(tun), [tun]);
}

export const HINWEIS_KURZ = 'An: Ton aus dem Lautsprecher, auch während das Mikrofon hört. Aus: für Kopfhörer — rohes Mikrofon.';
export const HINWEIS_MISCHEN = 'Metronom und Klänge laufen zu Musik aus Spotify, Moises oder iReal Pro, statt sie anzuhalten. Dann gilt der Stummschalter.';
export const HINWEIS_HINTERGRUND = 'Läuft weiter, wenn eine andere App vorn oder der Bildschirm gesperrt ist. Nicht zusammen mit „Mischen“.';

// Ein Schalter, überall gleich: Titel und Hinweis links, Schalter rechts.
// Der Hinweis hängt nicht vom Zustand ab — beim Umschalten verschiebt sich nichts.
function SchalterZeile({ titel, hinweis, an, setzen, gesperrt = false, className = '' }: {
  titel: string; hinweis: string; an: boolean; setzen: (an: boolean) => void; gesperrt?: boolean; className?: string;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 text-left ${className}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{titel}</span>
        <span className="block text-xs gedaempft">{hinweis}</span>
      </span>
      <input type="checkbox" role="switch" className="ios-schalter" checked={an} disabled={gesperrt} onChange={(e) => setzen(e.target.checked)} />
    </label>
  );
}

export function LautsprecherSchalter({ hinweis = HINWEIS_KURZ, gesperrt = false, className = '' }: { hinweis?: string; gesperrt?: boolean; className?: string }) {
  const [an, setzen] = useLautsprecher();
  return <SchalterZeile titel="Lautsprecher" hinweis={hinweis} an={an} setzen={setzen} gesperrt={gesperrt} className={className} />;
}

export function MischenSchalter({ hinweis = HINWEIS_MISCHEN, className = '' }: { hinweis?: string; className?: string }) {
  const [an, setzen] = useSchalter(mischenSchalter);
  return <SchalterZeile titel="Mit anderen Apps mischen" hinweis={hinweis} an={an} setzen={setzen} className={className} />;
}

// Zeigt, was gilt: Mit „Mischen“ ist er aus und gesperrt (die eigene Wahl
// bleibt gemerkt und gilt wieder, sobald „Mischen“ aus ist).
export function HintergrundSchalter({ hinweis = HINWEIS_HINTERGRUND, className = '' }: { hinweis?: string; className?: string }) {
  const [an, setzen] = useSchalter(hintergrundSchalter);
  const [mischen] = useSchalter(mischenSchalter);
  return (
    <SchalterZeile titel="Metronom im Hintergrund" hinweis={hinweis} an={imHintergrundWeiter({ hintergrund: an, mischen })}
      setzen={setzen} gesperrt={mischen} className={className} />
  );
}

// In den Einstellungen: alle drei mit Erklärung (steht still, nichts springt).
export function TonUndMikrofon() {
  return (
    <section className="space-y-3" aria-label="Ton und Mikrofon">
      <p className="text-sm font-semibold">Ton und Mikrofon</p>
      <div className="space-y-2">
        <LautsprecherSchalter hinweis="Ton aus dem Lautsprecher, auch während das Mikrofon hört." />
        <ul className="stichpunkte gedaempft text-sm">
          <li><strong>An</strong> (Vorgabe) — wie Freisprechen: Klick, Klavier und Drone kommen laut aus dem Lautsprecher, das Mikrofon hört auch aus Abstand, die eigenen Klänge bleiben aus Aufnahme und Erkennung draußen.</li>
          <li><strong>Aus</strong> — für Kopfhörer: rohes Mikrofon, unverfälscht, nah am Instrument. Ohne Kopfhörer kommt der Ton auf dem iPhone dann leise aus dem Hörer.</li>
          <li>Gilt, sobald das Mikrofon an ist: Stimmgerät, Aufnehmen, Einsingen, Ohr-Trainer, Griffe. Sonst kommt jeder Klang ohnehin aus dem Lautsprecher, auch bei Stummschalter.</li>
          <li>Ob Kopfhörer oder eine Box dran sind, verrät iOS einer Web-App nicht verlässlich — darum entscheidest du hier. Der Ton geht so oder so dorthin; „aus“ ändert nur das Mikrofon.</li>
          <li>Bluetooth-Box, AirPods oder AirPlay wählst du im Kontrollzentrum — die App spielt dorthin.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <MischenSchalter hinweis="Metronom und Klänge laufen zu Musik aus Spotify, Moises oder iReal Pro, statt sie anzuhalten." />
        <ul className="stichpunkte gedaempft text-sm">
          <li><strong>Haken:</strong> Gemischt gilt der Stummschalter — ist das iPhone stumm, bleibt auch CheatSheet still.</li>
          <li>Solange das Mikrofon hört (Stimmgerät, Aufnahme, Einsingen), hält iOS die andere Musik trotzdem an.</li>
          <li>Gemischt läuft nichts im Hintergrund: Wechselst du in die andere App, hält das Metronom an.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <HintergrundSchalter hinweis="Läuft weiter, wenn eine andere App vorn oder der Bildschirm gesperrt ist." />
        <ul className="stichpunkte gedaempft text-sm">
          <li>Anhalten geht dann auch auf dem Sperrbildschirm und im Kontrollzentrum.</li>
          <li>Startet eine andere App eigene Musik (etwa Spotify), hält iOS das Metronom in der Regel an. Mit „Mischen“ klingt beides zusammen — dann aber nur, solange CheatSheet vorn ist.</li>
          <li>Braucht iOS 17.5 oder neuer. Hat iOS den Ton doch unterbrochen, steht das Metronom bei der Rückkehr still.</li>
          <li>Drone, Vorspielen, Stimmgerät und Aufnahme halten beim Verlassen weiter an.</li>
        </ul>
      </div>
    </section>
  );
}
