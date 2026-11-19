'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DRONE_STANDARD, droneLautPruefen, droneStimmen, FARBE_HINWEIS, FARBE_NAME, FARBEN, KLAENGE, KLANG_HINWEIS, KLANG_NAME, klangPruefen, klasseName,
  stimmenPegel, tonklasse, type DroneEinstellung, type DroneFarbe, type DroneKlang,
} from '@/domain/drone';
import { tonName } from '@/domain/tonprofil';
import type { Stimmung } from '@/domain/ueben';
import { audioSitzung, gespeichert, speichern, useBeimVerlassen, verwerfen, wachHalten } from './klang';
import { ebeneAusblenden, ebeneBauen, ebeneSofortStoppen, hallBauen, type Ebene } from './droneKlang';
import { klingend } from './klavier';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';

// Drone (I-18): ein ruhiger Liegeklang (Grundton, Quinte, Akkord- oder
// Modusfarbe) zum Improvisieren und Intonieren. Erzeugt, keine Datei.
// Töne und Voicing: @/domain/drone. Klangprofile: ./droneKlang.
//
// ── useDrone() — wiederverwendbar (z. B. Spielhilfe in den Noten, I-15) ──
//   const { laeuft, starten, stoppen, aendern } = useDrone();
//   starten({ grundton: 10, farbe: 'quinte' })   // aus einer Tipp-Geste (iOS)
//   aendern({ farbe: 'dur' })                    // Teilwerte; weicher Übergang
//   stoppen()                                    // weiches Ausklingen
// Optionen (DroneOpt):
//   grundton    notierte MIDI-Zahl (beliebige Oktave) oder Tonklasse 0–11 (0 = C);
//               die Drone legt ihn selbst in die Lage C3–H3 (notiert)
//   farbe       'grundton' | 'quinte' (Standard) | 'dur' | 'moll' | 'dorisch' | 'mixolydisch'
//   klang       'weich' | 'orgel' | 'streicher' | 'tanpura'; fehlt er, gilt die
//               zuletzt im Drone-Blatt gewählte (auf dem Gerät, ueben:drone-klang)
//   lautstaerke 0–1 (Standard 0,5)
//   stimmung    Stimmung des Instruments ('B' = B-Klarinette …) und
//   kammerton   Hz für A: gelten für notiert → klingend. Fehlt eines,
//               gilt die gespeicherte Wahl des Stimmgeräts (stimm:st / stimm:a).
// Verhalten: Die Drone gehört dem Bauteil, das den Hook nutzt — sie läuft,
// solange es eingehängt ist, und klingt beim Aushängen aus. Verlässt man die
// App (Hintergrund, Sperre), hält sie an (iOS unterbricht den Ton ohnehin);
// `laeuft` wird dann false. starten() während sie läuft wirkt wie aendern().
// aendern() ohne laufende Drone merkt sich nur die Werte.
export interface DroneOpt { grundton: number; farbe?: DroneFarbe; klang?: DroneKlang; lautstaerke?: number; stimmung?: Stimmung; kammerton?: number }
type Werte = Required<DroneOpt>;

const EINSCHWINGEN = 0.45;  // Zeitkonstante (s) beim Einsetzen — etwa 1,3 s bis voll
const UEBERGANG = 0.3;      // beim Wechsel von Ton oder Farbe
const AUSKLINGEN = 0.3;     // beim Stoppen
const NACHLAUF = 4;         // so lange bleibt der Kontext nach dem Stoppen, bis Töne und Hall leise genug sind
// Klangprofil: bleibt auf dem Gerät, reist nicht mit der Sicherung (@/domain/einstellungen).
const KLANG_SCHLUESSEL = 'ueben:drone-klang';
const klangGespeichert = () => klangPruefen(gespeichert<unknown>(KLANG_SCHLUESSEL, null));

const werteVon = (o: DroneOpt, alt?: Werte): Werte => ({
  grundton: o.grundton,
  farbe: o.farbe ?? alt?.farbe ?? 'quinte',
  klang: o.klang ?? alt?.klang ?? klangGespeichert(),
  lautstaerke: droneLautPruefen(o.lautstaerke ?? alt?.lautstaerke),
  stimmung: o.stimmung ?? alt?.stimmung ?? gespeichert<Stimmung>('stimm:st', 'B'),
  kammerton: o.kammerton ?? alt?.kammerton ?? gespeichert('stimm:a', 442),
});
const pegelFuer = (laut: number) => 0.45 * laut * laut;

// Eine Schicht im laufenden Klang: Töne rein gestimmt (@/domain/drone), Pegel je Stimme.
function schicht(ctx: AudioContext, master: GainNode, hall: AudioNode, w: Werte, zeitkonstante: number): Ebene {
  const stimmen = droneStimmen(w.grundton, w.farbe);
  const freq = stimmen.map((s) => klingend(s.midi, w.stimmung, w.kammerton) * Math.pow(2, s.cent / 1200));
  return ebeneBauen(ctx, master, hall, w.klang, stimmen, freq, stimmenPegel(stimmen, freq), zeitkonstante);
}

export function useDrone() {
  const [laeuft, setLaeuft] = useState(false);
  const an = useRef(false);
  const w = useRef<Werte | null>(null);
  const audio = useRef<{ ctx: AudioContext; master: GainNode; hall: AudioNode; ebene: Ebene | null; alte: Ebene[] } | null>(null);
  const schluss = useRef(0);
  const freigeben = useRef<(() => void) | null>(null);

  const kontextZu = useCallback((hart: boolean) => {
    const a = audio.current;
    window.clearTimeout(schluss.current);
    if (!a) return;
    if (hart) { verwerfen(a.ctx); audio.current = null; return; }
    schluss.current = window.setTimeout(() => { if (audio.current === a && !an.current) { verwerfen(a.ctx); audio.current = null; } }, NACHLAUF * 1000);
  }, []);

  const aufhoeren = useCallback((hart: boolean) => {
    const a = audio.current;
    const lief = an.current;
    an.current = false;
    if (a) {
      for (const e of [a.ebene, ...a.alte]) if (e) { if (hart) ebeneSofortStoppen(e); else ebeneAusblenden(a.ctx, e, AUSKLINGEN); }
      a.ebene = null; a.alte = [];
    }
    kontextZu(hart);
    freigeben.current?.();
    freigeben.current = null;
    if (lief) setLaeuft(false);
  }, [kontextZu]);

  const aendern = useCallback((o: Partial<DroneOpt>) => {
    const alt = w.current;
    if (!alt) { if (o.grundton !== undefined) w.current = werteVon(o as DroneOpt); return; }
    const neu = werteVon({ ...o, grundton: o.grundton ?? alt.grundton }, alt);
    w.current = neu;
    const a = audio.current;
    if (!an.current || !a) return;
    a.master.gain.setTargetAtTime(pegelFuer(neu.lautstaerke), a.ctx.currentTime, 0.06);
    const klangGleich = tonklasse(neu.grundton) === tonklasse(alt.grundton) && neu.farbe === alt.farbe && neu.klang === alt.klang
      && neu.stimmung === alt.stimmung && neu.kammerton === alt.kammerton;
    if (klangGleich) return;
    // Übergang: neue Schicht blendet ein, die alte aus — kein Klick, kein Loch.
    if (a.ebene) { ebeneAusblenden(a.ctx, a.ebene, UEBERGANG); a.alte.push(a.ebene); }
    a.ebene = schicht(a.ctx, a.master, a.hall, neu, UEBERGANG);
    a.alte = a.alte.slice(-3);
  }, []);

  const starten = useCallback((o: DroneOpt) => {
    if (an.current) { aendern(o); return; }
    w.current = werteVon(o, w.current ?? undefined);
    audioSitzung('playback');
    window.clearTimeout(schluss.current);
    // Ein unterbrochener Kontext bliebe auf iOS stumm: verwerfen, solange die Geste gilt.
    if (audio.current && audio.current.ctx.state !== 'running') { verwerfen(audio.current.ctx); audio.current = null; }
    if (!audio.current) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      const master = ctx.createGain();
      master.gain.value = pegelFuer(w.current.lautstaerke);
      master.connect(ctx.destination);
      audio.current = { ctx, master, hall: hallBauen(ctx, master), ebene: null, alte: [] };
    }
    const a = audio.current;
    a.ctx.resume().catch(() => { /* egal */ }); // nicht abwarten: kehrt auf iOS teils nie zurück
    a.master.gain.setTargetAtTime(pegelFuer(w.current.lautstaerke), a.ctx.currentTime, 0.06);
    a.ebene = schicht(a.ctx, a.master, a.hall, w.current, EINSCHWINGEN);
    an.current = true;
    setLaeuft(true);
    void wachHalten().then((f) => { if (an.current) freigeben.current = f; else f?.(); });
  }, [aendern]);

  const stoppen = useCallback(() => aufhoeren(false), [aufhoeren]);

  // App verlassen: der Ton ist weg, der Kontext unbrauchbar — sofort aufräumen.
  useBeimVerlassen(useCallback(() => aufhoeren(true), [aufhoeren]));
  // Aushängen: ausklingen lassen, danach den Kontext schließen.
  useEffect(() => () => {
    const a = audio.current;
    an.current = false;
    if (!a) return;
    for (const e of [a.ebene, ...a.alte]) if (e) ebeneAusblenden(a.ctx, e, AUSKLINGEN);
    audio.current = null;
    window.clearTimeout(schluss.current);
    window.setTimeout(() => verwerfen(a.ctx), NACHLAUF * 1000);
    freigeben.current?.();
  }, []);

  return { laeuft, starten, stoppen, aendern };
}

const SCHLUESSEL = 'ueben:drone';
const KLASSEN = Array.from({ length: 12 }, (_, i) => i);

// Blatt „Drone“. `grundton`: damit öffnen (notierte MIDI-Zahl oder Tonklasse), sonst die zuletzt gewählte Tonart.
export function DroneBlatt({ schliessen, grundton }: { schliessen: () => void; grundton?: number }) {
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const stimm = useStimmgeraetApi();
  const drone = useDrone();
  const [ein, setEinRoh] = useState<DroneEinstellung>(() => {
    const e = gespeichert<DroneEinstellung>(SCHLUESSEL, DRONE_STANDARD);
    return grundton === undefined ? e : { ...e, grundton: tonklasse(grundton) };
  });
  const setEin = (t: Partial<DroneEinstellung>) => { const n = { ...ein, ...t }; setEinRoh(n); speichern(SCHLUESSEL, n); };
  const [klang, setKlangRoh] = useState<DroneKlang>(klangGespeichert);
  const setKlang = (k: DroneKlang) => { setKlangRoh(k); speichern(KLANG_SCHLUESSEL, k); };
  useEscape(schliessen);

  const { aendern } = drone;
  useEffect(() => {
    aendern({ grundton: ein.grundton, farbe: ein.farbe, klang, lautstaerke: ein.laut, stimmung: stimm.stimmung, kammerton: stimm.kammerton });
  }, [aendern, ein.grundton, ein.farbe, klang, ein.laut, stimm.stimmung, stimm.kammerton]);

  const toene = droneStimmen(ein.grundton, ein.farbe).map((s) => tonName(s.midi));
  const optionen = () => ({ grundton: ein.grundton, farbe: ein.farbe, klang, lautstaerke: ein.laut, stimmung: stimm.stimmung, kammerton: stimm.kammerton });

  return createPortal(
    <div className={`blatt-hintergrund${seite.klasse}`} onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Drone" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Drone</h2>
            <p className="gedaempft text-sm">Ein ruhiger Klangteppich zum Improvisieren und Intonieren. Er klingt, solange dieses Blatt offen ist.</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        <div className="space-y-2">
          <span className="kennzahl-label">Klang</span>
          <div className="dr-klaenge" role="group" aria-label="Klang">
            {KLAENGE.map((k) => (
              <button key={k} type="button" aria-pressed={k === klang} onClick={() => setKlang(k)}>{KLANG_NAME[k]}</button>
            ))}
          </div>
          <p className="gedaempft dr-klang-hinweis text-sm">{KLANG_HINWEIS[klang]}</p>
        </div>

        <div className="space-y-2">
          <span className="kennzahl-label">Grundton (notiert)</span>
          <div className="dr-tasten" role="group" aria-label="Grundton">
            {KLASSEN.map((k) => (
              <button key={k} type="button" aria-pressed={k === ein.grundton} onClick={() => setEin({ grundton: k })}>{klasseName(k)}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="kennzahl-label">Farbe</span>
          <div className="dr-farben" role="group" aria-label="Farbe">
            {FARBEN.map((f) => (
              <button key={f} type="button" aria-pressed={f === ein.farbe} onClick={() => setEin({ farbe: f })}>{FARBE_NAME[f]}</button>
            ))}
          </div>
          <p className="gedaempft dr-hinweis text-sm">{FARBE_HINWEIS[ein.farbe]}</p>
        </div>

        <p className="text-sm"><span className="gedaempft">Töne (notiert): </span><strong>{toene.join(' · ')}</strong></p>

        <label className="flex items-center gap-3 text-sm font-semibold">Lautstärke
          <input className="regler flex-1" type="range" min={0} max={1} step={0.05} value={ein.laut} onChange={(e) => setEin({ laut: Number(e.target.value) })} />
        </label>

        <div className="flex flex-col items-center gap-2">
          <button className={`start-knopf ${drone.laeuft ? 'laeuft' : ''}`} type="button" aria-label={drone.laeuft ? 'Drone stoppen' : 'Drone starten'}
            onClick={drone.laeuft ? drone.stoppen : () => drone.starten(optionen())}>
            {drone.laeuft ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
          </button>
          <p className="gedaempft dr-status text-sm" aria-live="polite">{drone.laeuft ? `Läuft · ${klasseName(ein.grundton)} ${FARBE_NAME[ein.farbe]} · ${KLANG_NAME[klang]}` : 'Gestoppt'}</p>
        </div>
      </div>
    </div>,
    seite.ziel,
  );
}
