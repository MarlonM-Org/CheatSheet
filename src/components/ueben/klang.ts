'use client';

import { useEffect } from 'react';
import { EINSTELLUNGEN_GELADEN, EINSTELLUNGEN_STAND, istAenderung, neuerStand, standLesen, type MetronomKlang } from '@/domain/einstellungen';

// Klänge für das Metronom, einmal synthetisiert und als Puffer abgelegt —
// kurz, trocken und mit klarem Anschlag, damit man sie im Ensemble-Lärm hört.
export type Klang = MetronomKlang;
export type Art = 'betont' | 'normal' | 'unter';

const DAUER = { holz: 0.09, klick: 0.03, glocke: 0.35 };

export function klangPuffer(ctx: BaseAudioContext, klang: Klang, art: Art): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * DAUER[klang]);
  const puffer = ctx.createBuffer(1, n, rate);
  const d = puffer.getChannelData(0);
  const hoehe = art === 'betont' ? 1.45 : art === 'unter' ? 0.8 : 1;
  let zufall = 7;
  const rauschen = () => { zufall = (zufall * 16807) % 2147483647; return zufall / 1073741823 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    if (klang === 'holz') {
      // Holzblock: zwei unharmonische Teiltöne, sehr schneller Abfall, kurzer Rauschanschlag
      const f = 1050 * hoehe;
      v = 0.75 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 55)
        + 0.35 * Math.sin(2 * Math.PI * f * 2.71 * t) * Math.exp(-t * 90)
        + 0.25 * rauschen() * Math.exp(-t * 900);
    } else if (klang === 'klick') {
      v = rauschen() * Math.exp(-t * (art === 'betont' ? 260 : 380)) * (art === 'unter' ? 0.6 : 1)
        + 0.3 * Math.sin(2 * Math.PI * 3200 * hoehe * t) * Math.exp(-t * 300);
    } else {
      const f = 880 * hoehe;
      v = 0.6 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9)
        + 0.2 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 14)
        + 0.1 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 20);
    }
    // weicher Einsatz gegen Knacksen
    d[i] = v * Math.min(1, i / (rate * 0.0008)) * (art === 'unter' ? 0.45 : art === 'betont' ? 1 : 0.75);
  }
  return puffer;
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
// iPhone/iPad: Wiedergabe auch bei Stummschalter (wo der Browser es kann).
export function audioSitzung(typ: 'playback' | 'play-and-record') {
  const nav = navigator as AudioSessionNavigator;
  try { if (nav.audioSession) nav.audioSession.type = typ; } catch { /* egal */ }
}

// iPhone/iPad, vor allem als Home-Bildschirm-App: Geht die App in den
// Hintergrund, unterbricht iOS jeden AudioContext. Zurück im Vordergrund
// bleibt er stumm, und resume() hilft nicht mehr (kehrt teils nie zurück).
// Darum wird ein unterbrochener Kontext nie weiterverwendet, sondern
// geschlossen — der nächste Tipp legt in seiner Geste einen frischen an.
export function verwerfen(ctx: AudioContext | undefined) {
  if (ctx && ctx.state !== 'closed') ctx.close().catch(() => { /* egal */ });
}

// Ruft `tun` auf, sobald die App verlassen wird: andere App, Home-Bildschirm,
// Sperre, anderer Tab. `tun` sollte stabil sein (useCallback).
export function useBeimVerlassen(tun: () => void) {
  useEffect(() => {
    const wechsel = () => { if (document.visibilityState === 'hidden') tun(); };
    document.addEventListener('visibilitychange', wechsel);
    return () => document.removeEventListener('visibilitychange', wechsel);
  }, [tun]);
}

type WakeLockNavigator = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
// Bildschirm nicht ausgehen lassen, solange Metronom oder Stimmgerät laufen.
export async function wachHalten(): Promise<(() => void) | null> {
  try {
    const sperre = await (navigator as WakeLockNavigator).wakeLock?.request('screen');
    return sperre ? () => { void sperre.release(); } : null;
  } catch { return null; }
}

export function gespeichert<T>(k: string, standard: T): T {
  if (typeof window === 'undefined') return standard;
  try { const v = localStorage.getItem(k); return v === null ? standard : (JSON.parse(v) as T); } catch { return standard; }
}
// Ändert sich dabei ein Wert, der mit der Sicherung reist, wirklich, rückt
// der Zeitstempel der Einstellungen vor (@/domain/einstellungen). Dieselben
// Werte noch einmal — so schreiben die Anbieter beim Start — bewegen ihn nicht.
export function speichern(k: string, v: unknown) {
  try {
    const geaendert = istAenderung(k, localStorage.getItem(k), v);
    localStorage.setItem(k, JSON.stringify(v));
    if (geaendert) localStorage.setItem(EINSTELLUNGEN_STAND, String(neuerStand(standLesen(localStorage.getItem(EINSTELLUNGEN_STAND)), Date.now())));
  } catch { /* egal */ }
}

// Ruft `tun` auf, nachdem eine Sicherung Einstellungen übernommen hat — wer
// Werte im Speicher hält, liest sie dann neu. `tun` sollte stabil sein.
export function useEinstellungenGeladen(tun: () => void) {
  useEffect(() => {
    window.addEventListener(EINSTELLUNGEN_GELADEN, tun);
    return () => window.removeEventListener(EINSTELLUNGEN_GELADEN, tun);
  }, [tun]);
}
