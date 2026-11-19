'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { EINSTELLUNGEN_GELADEN, EINSTELLUNGEN_STAND, istAenderung, neuerStand, standLesen, type MetronomKlang } from '@/domain/einstellungen';
import { MISCHEN_SCHLUESSEL, MISCHEN_STANDARD, schalterAnfang, sitzungFuer } from '@/domain/lautsprecher';
import { HINTERGRUND_SCHLUESSEL, HINTERGRUND_STANDARD } from '@/domain/taktgeber';

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

function roh(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

// Ein Schalter am Gerät (localStorage, reist nicht mit der Sicherung): beim
// ersten Lesen aus dem Speicher, geschrieben über speichern(), alle Anzeigen
// hören mit (useSchalter). `nachher` läuft nach jedem Umschalten, noch in der
// Tipp-Geste (etwa: Audio-Sitzung neu setzen).
export interface Schalter {
  standard: boolean;
  an: () => boolean;
  setzen: (an: boolean) => void;
  abonnieren: (z: () => void) => () => void;
}
export function geraeteSchalter(
  schluessel: string, standard: boolean,
  anfang: (lesen: (k: string) => string | null) => boolean = (lesen) => schalterAnfang(lesen, schluessel, standard),
  nachher?: () => void,
): Schalter {
  let wert: boolean | null = null;
  const zuhoerer = new Set<() => void>();
  const an = () => {
    if (typeof window === 'undefined') return standard;
    if (wert === null) wert = anfang(roh);
    return wert;
  };
  return {
    standard, an,
    setzen(neu) {
      if (an() === neu) return;
      wert = neu;
      speichern(schluessel, neu);
      nachher?.();
      for (const z of zuhoerer) z();
    },
    abonnieren(z) { zuhoerer.add(z); return () => { zuhoerer.delete(z); }; },
  };
}
export function useSchalter(s: Schalter): [boolean, (an: boolean) => void] {
  const an = useSyncExternalStore(s.abonnieren, s.an, () => s.standard);
  return [an, s.setzen];
}

// Mit anderen Apps mischen (D-08): gilt für jeden Klang, solange kein
// Mikrofon offen ist. Umschalten setzt die Sitzung sofort.
export const mischenSchalter = geraeteSchalter(MISCHEN_SCHLUESSEL, MISCHEN_STANDARD, undefined, () => sitzungSetzen());
// Metronom im Hintergrund (D-08): nur ohne Mischen (@/domain/taktgeber).
export const hintergrundSchalter = geraeteSchalter(HINTERGRUND_SCHLUESSEL, HINTERGRUND_STANDARD);

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
// Audio-Sitzung (iPhone/iPad ab iOS 16.4, wo der Browser sie kennt) nach der
// Regel in @/domain/lautsprecher: Solange ein Mikrofon offen ist,
// „play-and-record“, sonst „playback“ (Ton auch bei Stummschalter, im
// Hintergrund weiter) oder — mit „Mit anderen Apps mischen“ — „ambient“.
// Früher blieb nach Stimmgerät, Einsingen oder Ohr-Trainer „play-and-record“
// stehen, bis zufällig das Metronom startete — Hör-Übungen, Spickzettel,
// Griffe spielten dann womöglich in Telefon-Lautstärke (so berichten es
// WebKit-Fehlermeldungen; auf dem Gerät nicht beobachtet).
let mikrofone = 0;
function sitzungSetzen() {
  const nav = navigator as AudioSessionNavigator;
  try { if (nav.audioSession) nav.audioSession.type = sitzungFuer(mikrofone, mischenSchalter.an()); } catch { /* egal */ }
}
// Vor jedem Ton aufrufen, in der Tipp-Geste (Metronom, Vorspielen, Drone,
// Referenzton, Aufnahmen abspielen).
export function wiedergabeSitzung() {
  sitzungSetzen();
}
// Ein Mikrofon anmelden — vor getUserMedia, damit iOS die Sitzung schon
// umgestellt hat, wenn es aufgeht (sonst klingt der Ton danach leiser). Die
// Rückgabe meldet es wieder ab, auch wenn getUserMedia scheitert.
export function mikrofonOffen(): () => void {
  mikrofone++;
  sitzungSetzen();
  let offen = true;
  return () => { if (!offen) return; offen = false; mikrofone--; sitzungSetzen(); };
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

// Gegenstück: Ruft `tun` auf, wenn die App wieder vorn ist. `tun` sollte stabil sein.
export function useBeimZurueckkommen(tun: () => void) {
  useEffect(() => {
    const wechsel = () => { if (document.visibilityState === 'visible') tun(); };
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
