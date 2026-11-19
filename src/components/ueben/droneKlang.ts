// Klangerzeugung der Drone (I-18) je Klangprofil — erzeugt, keine Datei.
// Welche Töne klingen und wie rein, steht in @/domain/drone; hier nur, wie
// sie klingen. Die Tonhöhe bleibt in jedem Profil fest (zum Intonieren);
// Bewegung entsteht nur über Lautstärke, Klangfarbe und Raum.
//
//  - weich:     zwei leicht verstimmte Sinus und ein leises Dreieck je
//               Stimme; jede Stimme atmet in eigenem, langsamem Takt.
//  - orgel:     ein Pfeifenklang (feste Obertöne), ganz ruhig — Schwebungen
//               gegen den eigenen Ton sind so am deutlichsten zu hören.
//  - streicher: drei Sägezähne je Stimme (Mitte genau, außen ±7 Cent, die
//               außen wandern leicht), Tiefpass, der langsam auf- und
//               zugeht, ein wenig Körper und Bogenrauschen.
//  - tanpura:   gezupfte Saiten im Kreis (Reihenfolge: tanpuraFolge). Jeder
//               Anschlag ist obertonreich; eine Resonanz blüht kurz auf und
//               wandert durch die Obertöne nach unten (der Jawari-Glanz).
//
// Alle Profile laufen in einen gemeinsamen Hall (Nachhall aus Rauschen
// berechnet). Eine Ebene ist eine Schicht, die selbst ein- und ausblendet;
// beim Wechsel blendet die neue ein, die alte aus.

import { tanpuraFolge, type DroneKlang, type DroneStimme } from '@/domain/drone';

export interface Ebene {
  aus: GainNode;
  quellen: Set<AudioScheduledSourceNode>;
  uhr: number | null;
  /** Nur Tanpura: Anschläge bis zur Zeit `bis` (Sekunden im Kontext) planen. */
  planen?: (bis: number) => void;
}

// Pegel je Profil, damit beim Umschalten die Lautstärke gleich bleibt
// (gemessen am mittleren Pegel, Bezug: weich).
const PEGEL: Record<DroneKlang, number> = { weich: 1, orgel: 0.52, streicher: 1.1, tanpura: 0.66 };
// Anteil, der in den Hall geht.
const HALL: Record<DroneKlang, number> = { weich: 0.32, orgel: 0.4, streicher: 0.36, tanpura: 0.3 };

// Nachhall: Rauschen, das abklingt und dabei dunkler wird (etwa 2,8 s bis
// −60 dB), 12 ms Vorverzögerung. Einmal je Kontext.
export function hallBauen(ctx: BaseAudioContext, ziel: AudioNode): AudioNode {
  const rate = ctx.sampleRate, n = Math.floor(2.8 * rate), vor = Math.floor(0.012 * rate);
  const buf = ctx.createBuffer(2, n, rate);
  for (let k = 0; k < 2; k++) {
    const d = buf.getChannelData(k);
    let y = 0;
    for (let i = vor; i < n; i++) {
      const t = i / rate;
      y += (0.08 + 0.8 * Math.exp(-t / 0.5)) * (Math.random() * 2 - 1 - y);
      d[i] = y * Math.exp(-t / 0.41) * Math.min(1, (i - vor) / (0.01 * rate));
    }
  }
  const hall = ctx.createConvolver();
  hall.buffer = buf;
  hall.connect(ziel);
  return hall;
}

const wellen = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function welle(ctx: BaseAudioContext, name: string, obertoene: readonly number[]): PeriodicWave {
  let m = wellen.get(ctx);
  if (!m) { m = new Map(); wellen.set(ctx, m); }
  let w = m.get(name);
  if (!w) {
    const imag = new Float32Array([0, ...obertoene]);
    w = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
    m.set(name, w);
  }
  return w;
}
// Pfeife: Grundton kräftig, Oktave, Quinte darüber, Superoktave, wenig darüber.
const ORGEL = [1, 0.5, 0.26, 0.22, 0.08, 0.07, 0, 0.05, 0, 0.02];
// Saite: Obertöne fallen langsam ab, bis weit hinauf.
const SAITE = Array.from({ length: 40 }, (_, i) => 1 / Math.pow(i + 1, 0.75));

function filter(ctx: BaseAudioContext, typ: BiquadFilterType, frequenz: number, q: number, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = typ; f.frequency.value = frequenz; f.Q.value = q; f.gain.value = gain;
  return f;
}

// Langsames Schwanken eines Werts um `basis`, um ± `tiefe` (in Einheiten
// des Parameters).
function schwanken(ctx: BaseAudioContext, e: Ebene, param: AudioParam, basis: number, tiefe: number, rate: number, start: number) {
  param.value = basis;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = tiefe;
  lfo.connect(g); g.connect(param);
  lfo.start(start);
  e.quellen.add(lfo);
}

function oszillator(ctx: BaseAudioContext, e: Ebene, ziel: AudioNode, f: number, start: number, art: OscillatorType | PeriodicWave, detune = 0, anteil = 1) {
  const o = ctx.createOscillator();
  if (typeof art === 'object') o.setPeriodicWave(art); else o.type = art;
  o.frequency.value = f;
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.value = anteil;
  o.connect(g); g.connect(ziel);
  o.start(start);
  e.quellen.add(o);
  return o;
}

const ATEM = [0.071, 0.053, 0.089, 0.064, 0.047];

export function ebeneBauen(
  ctx: BaseAudioContext, ziel: AudioNode, hall: AudioNode | null, klang: DroneKlang,
  stimmen: readonly DroneStimme[], freq: readonly number[], pegel: readonly number[], einblenden: number,
): Ebene {
  const jetzt = ctx.currentTime;
  const aus = ctx.createGain();
  aus.gain.setValueAtTime(0, jetzt);
  aus.gain.setTargetAtTime(1, jetzt, klang === 'tanpura' ? 0.02 : einblenden);
  aus.connect(ziel);
  if (hall) { const send = ctx.createGain(); send.gain.value = HALL[klang]; aus.connect(send); send.connect(hall); }
  const e: Ebene = { aus, quellen: new Set(), uhr: null };
  const summe = ctx.createGain();
  summe.gain.value = PEGEL[klang];

  if (klang === 'weich') {
    const tp = filter(ctx, 'lowpass', 1100, 0.3);
    summe.connect(tp); tp.connect(aus);
    freq.forEach((f, i) => {
      const s = ctx.createGain();
      schwanken(ctx, e, s.gain, pegel[i], pegel[i] * 0.3, ATEM[i % ATEM.length], jetzt);
      s.connect(summe);
      oszillator(ctx, e, s, f, jetzt, 'sine', -6, 0.42);
      oszillator(ctx, e, s, f, jetzt, 'sine', 6, 0.42);
      oszillator(ctx, e, s, f, jetzt, 'triangle', 0, 0.2);
    });
  } else if (klang === 'orgel') {
    const tp = filter(ctx, 'lowpass', 5000, 0.5);
    summe.connect(tp); tp.connect(aus);
    const w = welle(ctx, 'orgel', ORGEL);
    freq.forEach((f, i) => {
      const s = ctx.createGain();
      s.gain.value = pegel[i];
      s.connect(summe);
      oszillator(ctx, e, s, f, jetzt, w);
    });
  } else if (klang === 'streicher') {
    const tp = filter(ctx, 'lowpass', 1600, 0.6);
    schwanken(ctx, e, tp.frequency, 1600, 400, 0.07, jetzt);
    const koerper = filter(ctx, 'peaking', 900, 1, 3);
    const tief = filter(ctx, 'highpass', 70, 0.7);
    summe.connect(tp); tp.connect(koerper); koerper.connect(tief); tief.connect(aus);
    freq.forEach((f, i) => {
      const s = ctx.createGain();
      schwanken(ctx, e, s.gain, pegel[i], pegel[i] * 0.15, ATEM[i % ATEM.length] * 1.3, jetzt);
      s.connect(summe);
      oszillator(ctx, e, s, f, jetzt, 'sawtooth', 0, 0.34);
      const unten = oszillator(ctx, e, s, f, jetzt, 'sawtooth', -7, 0.33);
      const oben = oszillator(ctx, e, s, f, jetzt, 'sawtooth', 7, 0.33);
      schwanken(ctx, e, unten.detune, -7, 2.5, 0.13 + i * 0.02, jetzt);
      schwanken(ctx, e, oben.detune, 7, 2.5, 0.17 + i * 0.02, jetzt);
    });
    // Bogenrauschen, ganz leise.
    const n = Math.floor(2 * ctx.sampleRate);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const rauschen = ctx.createBufferSource();
    rauschen.buffer = buf; rauschen.loop = true;
    const band = filter(ctx, 'bandpass', 2600, 0.7);
    const leise = ctx.createGain();
    schwanken(ctx, e, leise.gain, 0.012, 0.004, 0.09, jetzt);
    rauschen.connect(band); band.connect(leise); leise.connect(koerper);
    rauschen.start(jetzt);
    e.quellen.add(rauschen);
  } else {
    summe.connect(aus);
    const folge = tanpuraFolge(stimmen);
    const w = welle(ctx, 'saite', SAITE);
    const abstand = 1.1;
    let naechste = jetzt + 0.05, pos = 0;
    e.planen = (bis: number) => {
      while (naechste < bis) {
        const i = folge[pos];
        const staerke = (0.55 + 0.45 * stimmen[i].gewicht) * (0.92 + Math.random() * 0.16);
        zupfen(ctx, e, summe, freq[i], naechste, staerke, i === 0, w);
        const letzte = pos === folge.length - 1;
        pos = letzte ? 0 : pos + 1;
        naechste += abstand * (letzte ? 2 : 1) + (Math.random() - 0.5) * 0.08;
      }
    };
    e.planen(jetzt + 1.2);
    if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined' && ctx instanceof AudioContext) {
      e.uhr = window.setInterval(() => e.planen?.(ctx.currentTime + 1.2), 300);
    }
  }
  return e;
}

// Ein Anschlag der Tanpura: kurzer Einsatz, langes Abklingen (die tiefe
// Saite länger); der Körper wird mit der Zeit dunkler, die Jawari-Resonanz
// blüht nach dem Anschlag auf und wandert durch die Obertöne nach unten.
function zupfen(ctx: BaseAudioContext, e: Ebene, ziel: AudioNode, f: number, t: number, staerke: number, tief: boolean, w: PeriodicWave) {
  const o = ctx.createOscillator();
  o.setPeriodicWave(w);
  o.frequency.value = f;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(0, t);
  huelle.gain.linearRampToValueAtTime(staerke, t + 0.006);
  huelle.gain.setTargetAtTime(0, t + 0.006, tief ? 3 : 2.2);
  const koerper = filter(ctx, 'lowpass', Math.min(6000, f * 24), 0.5);
  koerper.frequency.setValueAtTime(Math.min(6000, f * 24), t);
  koerper.frequency.setTargetAtTime(Math.max(500, f * 4), t + 0.01, 1.5);
  const jawari = filter(ctx, 'bandpass', Math.min(4200, f * 18), 5);
  jawari.frequency.setValueAtTime(Math.min(4200, f * 18), t);
  jawari.frequency.setTargetAtTime(Math.max(700, f * 5), t + 0.05, 1.1 + Math.random() * 0.4);
  const glanz = ctx.createGain();
  glanz.gain.setValueAtTime(0, t);
  glanz.gain.setTargetAtTime(2.2, t + 0.02, 0.18);
  glanz.gain.setTargetAtTime(0, t + 0.6, 1.4);
  o.connect(huelle);
  huelle.connect(koerper); koerper.connect(ziel);
  huelle.connect(jawari); jawari.connect(glanz); glanz.connect(ziel);
  o.start(t);
  o.stop(t + (tief ? 14 : 11));
  e.quellen.add(o);
  o.addEventListener('ended', () => { e.quellen.delete(o); try { glanz.disconnect(); koerper.disconnect(); } catch { /* egal */ } });
}

export function ebeneAusblenden(ctx: BaseAudioContext, e: Ebene, zeitkonstante: number) {
  const jetzt = ctx.currentTime;
  if (e.uhr !== null) { window.clearInterval(e.uhr); e.uhr = null; }
  e.planen = undefined;
  try {
    e.aus.gain.cancelScheduledValues(jetzt);
    e.aus.gain.setValueAtTime(e.aus.gain.value, jetzt);
    e.aus.gain.setTargetAtTime(0, jetzt, zeitkonstante);
  } catch { /* Kontext schon zu */ }
  const ende = jetzt + zeitkonstante * 9;
  for (const q of e.quellen) { try { q.stop(ende); } catch { /* schon gestoppt */ } }
  if (typeof window !== 'undefined') window.setTimeout(() => { try { e.aus.disconnect(); } catch { /* egal */ } }, (zeitkonstante * 9 + 0.5) * 1000);
}

export function ebeneSofortStoppen(e: Ebene) {
  if (e.uhr !== null) { window.clearInterval(e.uhr); e.uhr = null; }
  e.planen = undefined;
  for (const q of e.quellen) { try { q.stop(); } catch { /* egal */ } }
}
