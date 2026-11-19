'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { LAUTSPRECHER_SCHLUESSEL, LAUTSPRECHER_STANDARD, lautsprecherAnfang } from '@/domain/lautsprecher';
import { speichern } from './klang';

// Lautsprecher für alle Klänge (B-20): eine Wahl fürs ganze Gerät. Jeder
// Schalter „Lautsprecher“ (Einstellungen, Stimmgerät, Metronom, Drone,
// Einsingen, Ohr-Trainer, Aufnehmen) zeigt und ändert dieselbe. Was sie
// fürs Mikrofon bedeutet: @/domain/lautsprecher.

let wert: boolean | null = null;
const zuhoerer = new Set<() => void>();

function roh(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

// Die gültige Wahl; beim ersten Lesen aus dem Speicher (samt früherer Schalter).
export function lautsprecherAn(): boolean {
  if (typeof window === 'undefined') return LAUTSPRECHER_STANDARD;
  if (wert === null) wert = lautsprecherAnfang(roh);
  return wert;
}

// Ändern: merken und allen Bescheid geben — noch in der Tipp-Geste, damit
// ein laufendes Stimmgerät sein Mikrofon gleich neu öffnen kann.
export function lautsprecherSetzen(an: boolean) {
  if (lautsprecherAn() === an) return;
  wert = an;
  speichern(LAUTSPRECHER_SCHLUESSEL, an);
  for (const z of zuhoerer) z();
}

function abonnieren(z: () => void) {
  zuhoerer.add(z);
  return () => { zuhoerer.delete(z); };
}

export function useLautsprecher(): [boolean, (an: boolean) => void] {
  const an = useSyncExternalStore(abonnieren, lautsprecherAn, () => LAUTSPRECHER_STANDARD);
  return [an, lautsprecherSetzen];
}

// Ruft `tun` nach jedem Umschalten auf (synchron, in der Geste). `tun` sollte stabil sein.
export function useBeimUmschalten(tun: () => void) {
  useEffect(() => abonnieren(tun), [tun]);
}

export const HINWEIS_KURZ = 'An: Ton aus dem Lautsprecher, auch während das Mikrofon hört. Aus: für Kopfhörer — rohes Mikrofon.';

// Der Schalter, überall gleich: Titel und Hinweis links, Schalter rechts.
// Der Hinweis hängt nicht vom Zustand ab — beim Umschalten verschiebt sich nichts.
export function LautsprecherSchalter({ hinweis = HINWEIS_KURZ, gesperrt = false, className = '' }: { hinweis?: string; gesperrt?: boolean; className?: string }) {
  const [an, setzen] = useLautsprecher();
  return (
    <label className={`flex items-center justify-between gap-3 text-left ${className}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Lautsprecher</span>
        <span className="block text-xs gedaempft">{hinweis}</span>
      </span>
      <input type="checkbox" role="switch" className="ios-schalter" checked={an} disabled={gesperrt} onChange={(e) => setzen(e.target.checked)} />
    </label>
  );
}

// In den Einstellungen: die Wahl mit Erklärung (steht still, nichts springt).
export function LautsprecherEinstellung() {
  return (
    <section className="space-y-2" aria-label="Ton und Mikrofon">
      <p className="text-sm font-semibold">Ton und Mikrofon</p>
      <LautsprecherSchalter hinweis="Ton aus dem Lautsprecher, auch während das Mikrofon hört." />
      <ul className="stichpunkte gedaempft text-sm">
        <li><strong>An</strong> — wie Freisprechen: Klick, Klavier und Drone kommen laut aus dem Lautsprecher, das Mikrofon hört auch aus Abstand, die eigenen Klänge bleiben aus Aufnahme und Erkennung draußen.</li>
        <li><strong>Aus</strong> — für Kopfhörer: rohes Mikrofon, unverfälscht, nah am Instrument. Ohne Kopfhörer kommt der Ton auf dem iPhone dann leise aus dem Hörer.</li>
        <li>Gilt, sobald das Mikrofon an ist: Stimmgerät, Aufnehmen, Einsingen, Ohr-Trainer. Sonst kommt jeder Klang ohnehin aus dem Lautsprecher, auch bei Stummschalter.</li>
        <li>Bluetooth-Box, AirPods oder AirPlay wählst du im Kontrollzentrum — die App spielt dorthin.</li>
      </ul>
    </section>
  );
}
