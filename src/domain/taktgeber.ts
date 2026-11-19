// Taktgeber des Metronoms und das Metronom im Hintergrund (D-08). Rein,
// getestet (tests/taktgeber.test.ts).
//
// Das Metronom plant seine Klicks auf der Audio-Uhr voraus (Web Audio:
// jeder Klick ein Puffer, der zu seiner Zeit startet). Im Vordergrund nur
// 0,12 s, damit ein Tipp auf Tempo, Taktart oder Akzent sofort wirkt. Im
// Hintergrund (andere App vorn, Bildschirm gesperrt) weckt WebKit die Seite
// nur noch etwa einmal je Sekunde; damit kein Klick fehlt, wird dann einige
// Sekunden voraus geplant. Zurück in der App wird alles jenseits des kurzen
// Vorlaufs zurückgeholt und neu geplant — mit den Werten von jetzt.
//
// Dass Web Audio im Hintergrund überhaupt weiterläuft, hängt an iOS:
// WebKit unterbricht einen AudioContext beim Wechsel in den Hintergrund,
// außer die Seite hat `navigator.audioSession.type` auf „playback“ (oder
// „play-and-record“) gesetzt (WebKit `AudioContext::shouldOverrideBackground-
// PlaybackRestriction`; Fehler 261554, behoben in WebKit 2024-03, berichtet
// ab iOS 17.5). Gemischt („ambient“) hält iOS den Ton im Hintergrund an.

import type { Akzent, Trainer } from './einstellungen';
import { abstandZumNaechsten, taktKlicks, type KlickArt, type Swing } from './swing';
import { taktartText, type Nenner } from './takt';
import { trainerTempo } from './ueben';

// Gerät-Einstellung „Metronom im Hintergrund“: Vorgabe an (Wunsch Marlon
// 2026-11-19). Ob iOS mitspielt, prüft die App bei der Rückkehr — war der Ton
// unterbrochen, steht das Metronom dann still wie früher (D-02).
export const HINTERGRUND_SCHLUESSEL = 'ueben:metronom-hintergrund';
export const HINTERGRUND_STANDARD = true;

// Läuft ein laufendes Metronom beim Verlassen der App weiter? Nur mit der
// Einstellung und nicht gemischt: „ambient“ unterbricht iOS im Hintergrund.
export function imHintergrundWeiter(e: { hintergrund: boolean; mischen: boolean }): boolean {
  return e.hintergrund && !e.mischen;
}

// Vorlauf in Sekunden. Vorn kurz (Änderungen wirken sofort), hinten lang:
// verborgene Seiten bekommen ihre Timer in WebKit gebündelt im Sekundentakt,
// ein Aussetzer von 1–2 s darf keinen Klick kosten.
export const VORLAUF_VORN = 0.12;
export const VORLAUF_HINTEN = 5;
export const vorlauf = (sichtbar: boolean): number => (sichtbar ? VORLAUF_VORN : VORLAUF_HINTEN);

// Ein Klick, der beim Planen schon so weit zurückliegt, schweigt: Stand das
// Planen still (Hänger, iOS hat die Seite angehalten), kämen sonst alle
// verpassten Klicks auf einmal. Knapp Verspätetes klingt sofort.
export const VERSPAETET = 0.05;

export interface TaktgeberStand {
  /** Zeit des nächsten Klicks auf der Audio-Uhr (s). */
  naechster: number;
  /** Platz im Takt (Index in taktKlicks). */
  pos: number;
  /** Takte seit dem Start, der erste ist 0 (für den Trainer). */
  taktNr: number;
  erster: boolean;
  /** Tempo, mit dem gerade geplant wird; der Trainer erhöht es. */
  bpm: number;
}

export interface TaktgeberWerte {
  takt: number;
  nenner: Nenner;
  unter: number;
  akzente: readonly Akzent[];
  swing: Swing;
  trainer: Trainer;
  /** Tempo beim Start — davon geht der Trainer aus. */
  startBpm: number;
}

export interface GeplanterKlick {
  zeit: number;
  /** null: stumm — gestellt stumm, „nur 2 und 4“ oder verpasst. Die Anzeige läuft trotzdem mit. */
  art: KlickArt | null;
  schlag: number;
  sub: number;
  /** Neues Tempo des Trainers ab diesem Klick (für die Anzeige). */
  tempo?: number;
  /** Stand vor diesem Klick: Zurückholen setzt hier wieder an. */
  vorher: TaktgeberStand;
}

export const taktgeberStart = (zeit: number, bpm: number): TaktgeberStand => ({ naechster: zeit, pos: 0, taktNr: 0, erster: true, bpm });

// Plant alle Klicks vor `bis`. `jetzt` ist die Audio-Uhr beim Planen (für
// verpasste Klicks). Liefert die Klicks und den neuen Stand; der alte bleibt.
// Die Klicks des Takts werden je Klick neu berechnet, damit Akzente und
// Optionen sofort gelten (I-17); das Tempo gilt je Schlag (D-07).
export function taktgeberPlanen(stand: TaktgeberStand, w: TaktgeberWerte, bis: number, jetzt: number): { klicks: GeplanterKlick[]; stand: TaktgeberStand } {
  const s = { ...stand };
  const klicks: GeplanterKlick[] = [];
  // Schutz gegen ein unsinniges Tempo: nie eine Endlosschleife.
  if (!(s.bpm > 0) || !Number.isFinite(s.naechster)) return { klicks, stand: s };
  while (s.naechster < bis) {
    const takt = taktKlicks(w.takt, w.nenner, w.unter, w.akzente, w.swing);
    if (s.pos >= takt.length) s.pos = 0;
    const vorher = { ...s };
    const k = takt[s.pos];
    let tempo: number | undefined;
    if (s.pos === 0) {
      if (s.erster) s.erster = false; else s.taktNr++;
      if (w.trainer.an) {
        const neu = trainerTempo(w.startBpm, w.trainer.schritt, w.trainer.takte, w.trainer.ziel, s.taktNr);
        if (neu !== s.bpm && neu > 0) { s.bpm = neu; tempo = neu; }
      }
    }
    klicks.push({ zeit: s.naechster, art: s.naechster >= jetzt - VERSPAETET ? k.art : null, schlag: k.schlag, sub: k.sub, tempo, vorher });
    s.naechster += abstandZumNaechsten(takt, s.pos, w.takt, w.nenner) * 60 / s.bpm;
    s.pos = (s.pos + 1) % takt.length;
  }
  return { klicks, stand: s };
}

// Zurückholen: Index des ersten geplanten Klicks ab `ab` (sortiert nach
// Zeit). Alles davor bleibt, alles ab dort wird gestoppt und ab dessen
// `vorher` neu geplant. Keiner → die Länge der Liste.
export function zurueckAb(geplant: readonly { zeit: number }[], ab: number): number {
  const i = geplant.findIndex((k) => k.zeit >= ab);
  return i < 0 ? geplant.length : i;
}

// Sperrbildschirm und Kontrollzentrum (Media Session): was dort steht.
export function jetztLaeuft(bpm: number, takt: number, nenner: Nenner): { titel: string; unter: string } {
  return { titel: 'Metronom', unter: `${Math.round(bpm)} BPM · ${taktartText(takt, nenner)}` };
}
