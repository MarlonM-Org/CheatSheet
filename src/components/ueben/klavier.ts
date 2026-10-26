'use client';

import { STIMMUNGEN, tonFrequenz, type Stimmung } from '@/domain/ueben';
import type { Klang } from '@/domain/notensatz';

// Vorspielen (G-04), erste Stufe: ein Klavier-ähnlicher Ton aus Web Audio,
// ohne Soundfont-Dateien — läuft offline und wiegt nichts. Je Ton ein
// Oszillator mit Obertonwelle, ein Tiefpass, der nach dem Anschlag zugeht
// (die Helligkeit klingt ab, das macht den Klavier-Eindruck), und eine
// Hüllkurve: harter Anschlag, Ausklingen, am Notenende gedämpft.
// Echte Instrumentklänge (Soundfonts) bleiben die Ausbaustufe (G-07).

const welle = new WeakMap<BaseAudioContext, PeriodicWave>();
function klavierWelle(ctx: BaseAudioContext): PeriodicWave {
  let w = welle.get(ctx);
  if (!w) {
    // Obertöne eines angeschlagenen Saite: fallend, der zweite etwas stärker.
    const amp = [0, 1, 0.55, 0.3, 0.2, 0.12, 0.07, 0.04, 0.025, 0.015];
    const real = new Float32Array(amp.length), imag = Float32Array.from(amp);
    w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    welle.set(ctx, w);
  }
  return w;
}

// Einen Ton planen: `frequenz` klingend, `beginn`/`dauer` in Kontextzeit.
export function klavierTon(ctx: BaseAudioContext, ziel: AudioNode, frequenz: number, beginn: number, dauer: number, staerke = 1) {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(klavierWelle(ctx));
  osc.frequency.value = frequenz;
  // Zweiter, leicht verstimmter Oszillator für Wärme (zwei Saiten).
  const osc2 = ctx.createOscillator();
  osc2.setPeriodicWave(klavierWelle(ctx));
  osc2.frequency.value = frequenz;
  osc2.detune.value = 4;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.4;
  const hell = Math.min(9000, Math.max(frequenz * 6, 1200)), dunkel = Math.max(frequenz * 1.5, 300);
  filter.frequency.setValueAtTime(hell, beginn);
  filter.frequency.setTargetAtTime(dunkel, beginn + 0.01, 0.35);
  const gain = ctx.createGain();
  // Tiefe Töne sind in der Welle kräftiger — leicht ausgleichen.
  const pegel = staerke * 0.28 * Math.min(1.4, Math.max(0.6, Math.pow(440 / frequenz, 0.25)));
  const ende = beginn + dauer;
  gain.gain.setValueAtTime(0, beginn);
  gain.gain.linearRampToValueAtTime(pegel, beginn + 0.004);
  gain.gain.setTargetAtTime(pegel * 0.35, beginn + 0.004, 0.6);
  gain.gain.setTargetAtTime(0, ende, 0.035);
  osc.connect(filter); osc2.connect(filter);
  filter.connect(gain); gain.connect(ziel);
  osc.start(beginn); osc2.start(beginn);
  osc.stop(ende + 0.3); osc2.stop(ende + 0.3);
}

// Notierte Tonhöhe → klingende Frequenz (Instrument und Kammerton wie im Stimmgerät).
export const klingend = (midi: number, stimmung: Stimmung, kammerton: number) => tonFrequenz(midi - STIMMUNGEN[stimmung], kammerton);

export interface Vorspiel { ctx: AudioContext; beginn: number; stopp: () => void }

// Alle Klänge vorspielen: ein frischer Kontext, Töne in einem rollenden
// Fenster von zwei Sekunden geplant (ein langes Stück legt nicht tausend
// Knoten auf einmal an). `zeit()` liefert die Stelle in Sekunden ab Schlag 1.
export function vorspielen(liste: readonly Klang[], stimmung: Stimmung, kammerton: number, laut: number): Vorspiel & { zeit: () => number } {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = Math.max(0.05, laut);
  master.connect(ctx.destination);
  const beginn = ctx.currentTime + 0.08;
  let naechster = 0, timer = 0;
  const planen = () => {
    const bis = ctx.currentTime - beginn + 2;
    while (naechster < liste.length && liste[naechster].beginn < bis) {
      const k = liste[naechster++];
      klavierTon(ctx, master, klingend(k.midi, stimmung, kammerton), beginn + k.beginn, k.dauer);
    }
    if (naechster < liste.length) timer = window.setTimeout(planen, 500);
  };
  planen();
  return {
    ctx, beginn,
    zeit: () => ctx.currentTime - beginn,
    stopp: () => { window.clearTimeout(timer); naechster = liste.length; void ctx.close(); },
  };
}
