'use client';

import { useEffect, useRef, useState } from 'react';
import { frequenzZuTon, grundfrequenz, median, STIMMUNGEN, tonFrequenz, type Stimmung, type Ton } from '@/domain/ueben';
import { audioSitzung, gespeichert, speichern, wachHalten } from './klang';

const TONNAMEN = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
const SAUBER = 5; // ±Cent, die als sauber gelten

// ±50 Cent auf ±60° Zeigerausschlag
const winkel = (cent: number) => (Math.max(-50, Math.min(50, cent)) / 50) * 60;
function punkt(grad: number, radius: number) {
  const rad = ((grad - 90) * Math.PI) / 180;
  return { x: 150 + radius * Math.cos(rad), y: 165 + radius * Math.sin(rad) };
}
function bogen(von: number, bis: number, radius: number) {
  const a = punkt(von, radius), b = punkt(bis, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
}

export function Stimmgeraet() {
  const [an, setAn] = useState(false);
  const [fehler, setFehler] = useState('');
  const [ton, setTon] = useState<Ton | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [kammerton, setKammerton] = useState(() => gespeichert('stimm:a', 442));
  const [stimmung, setStimmung] = useState<Stimmung>(() => gespeichert('stimm:st', 'C'));
  const [refTon, setRefTon] = useState<number | null>(null);
  const [refOktave, setRefOktave] = useState(4);
  const einst = useRef({ kammerton, stimmung });
  useEffect(() => { einst.current = { kammerton, stimmung }; speichern('stimm:a', kammerton); speichern('stimm:st', stimmung); }, [kammerton, stimmung]);

  const mikro = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number; freigeben: (() => void) | null } | null>(null);
  const referenz = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  async function start() {
    setFehler('');
    referenzAus();
    try {
      audioSitzung('play-and-record');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const puffer = new Float32Array(analyser.fftSize);
      const verlauf: number[] = [];
      let zuletzt = 0, zuletztGehoert = 0;
      const schleife = (t: number) => {
        if (t - zuletzt > 50) {
          zuletzt = t;
          analyser.getFloatTimeDomainData(puffer);
          const r = grundfrequenz(puffer, ctx.sampleRate);
          if (r && r.klarheit > 0.85) {
            // Sprünge (neuer Ton) setzen die Glättung zurück
            if (verlauf.length && Math.abs(12 * Math.log2(r.frequenz / median(verlauf))) > 0.6) verlauf.length = 0;
            verlauf.push(r.frequenz);
            if (verlauf.length > 7) verlauf.shift();
            setTon(frequenzZuTon(median(verlauf), einst.current.kammerton, einst.current.stimmung));
            setFrisch(true);
            zuletztGehoert = t;
          } else if (t - zuletztGehoert > 450) {
            setFrisch(false); // letzten Ton gedimmt stehen lassen
            verlauf.length = 0;
          }
        }
        mikro.current!.raf = requestAnimationFrame(schleife);
      };
      mikro.current = { stream, ctx, raf: requestAnimationFrame(schleife), freigeben: null };
      setAn(true);
      mikro.current.freigeben = await wachHalten();
    } catch (e) {
      setFehler((e as Error).name === 'NotAllowedError'
        ? 'Das Mikrofon ist nicht erlaubt. In den Einstellungen des Browsers für diese Seite erlauben.'
        : `Mikrofon nicht verfügbar (${(e as Error).name}).`);
    }
  }

  function stopp() {
    const m = mikro.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    void m.ctx.close();
    m.freigeben?.();
    mikro.current = null;
    setAn(false); setTon(null); setFrisch(false);
  }

  // Referenzton: weicher, orgelartiger Klang mit sanftem Ein- und Ausblenden.
  function referenzSpielen(halbton: number) {
    if (refTon === halbton) return referenzAus();
    stopp();
    audioSitzung('playback');
    const notiertMidi = (refOktave + 1) * 12 + halbton;
    const frequenz = tonFrequenz(notiertMidi - STIMMUNGEN[stimmung], kammerton);
    let r = referenz.current;
    if (!r) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.35, 0.12, 0.05])));
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      r = referenz.current = { ctx, osc, gain };
    }
    void r.ctx.resume();
    const jetzt = r.ctx.currentTime;
    r.osc.frequency.setTargetAtTime(frequenz, jetzt, 0.01);
    r.gain.gain.cancelScheduledValues(jetzt);
    r.gain.gain.setTargetAtTime(0.25, jetzt, 0.05);
    setRefTon(halbton);
  }
  function referenzAus() {
    const r = referenz.current;
    if (r) r.gain.gain.setTargetAtTime(0, r.ctx.currentTime, 0.06);
    setRefTon(null);
  }

  useEffect(() => () => {
    const m = mikro.current;
    if (m) { cancelAnimationFrame(m.raf); m.stream.getTracks().forEach((t) => t.stop()); void m.ctx.close(); m.freigeben?.(); }
    void referenz.current?.ctx.close();
  }, []);

  const cent = ton?.cent ?? 0;
  const sauber = ton && frisch && Math.abs(cent) <= SAUBER;
  const farbe = !ton || !frisch ? 'var(--gedaempft)' : sauber ? 'var(--gut)' : Math.abs(cent) <= 15 ? 'var(--messing)' : 'var(--warnung)';
  const zeiger = punkt(winkel(cent), 128);

  return (
    <div className="stimmgeraet space-y-5">
      <div className="relative mx-auto max-w-sm">
        <svg viewBox="0 0 300 180" className="w-full" aria-hidden="true">
          <path d={bogen(-60, 60, 130)} fill="none" stroke="var(--linie)" strokeWidth="14" strokeLinecap="round" />
          <path d={bogen(winkel(-SAUBER), winkel(SAUBER), 130)} fill="none" stroke="var(--gut)" strokeWidth="14" opacity={sauber ? 1 : 0.45} />
          {Array.from({ length: 11 }, (_, i) => {
            const c = -50 + i * 10;
            const lang = c === 0 || Math.abs(c) === 50;
            const a = punkt(winkel(c), lang ? 104 : 110), b = punkt(winkel(c), 118);
            return <line key={c} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={lang ? 2.5 : 1.5} opacity={0.55} />;
          })}
          <text x={punkt(-60, 150).x - 4} y={punkt(-60, 150).y + 8} fontSize="11" fill="currentColor" opacity="0.6">♭</text>
          <text x={punkt(60, 150).x - 2} y={punkt(60, 150).y + 8} fontSize="11" fill="currentColor" opacity="0.6">♯</text>
          <line x1="150" y1="165" x2={zeiger.x} y2={zeiger.y} stroke={farbe} strokeWidth="4" strokeLinecap="round"
            style={{ transition: 'all 120ms ease-out' }} />
          <circle cx="150" cy="165" r="8" fill={farbe} style={{ transition: 'fill 120ms' }} />
        </svg>

      </div>

      <div className="-mt-4 text-center">
        <span className="ton-name" style={{ color: farbe, opacity: ton && !frisch ? 0.45 : 1 }}>
          {ton ? ton.name : '–'}<sub className="ton-oktave">{ton?.oktave ?? ''}</sub>
        </span>
      </div>
      <p className="text-center tabular-nums" style={{ color: farbe }}>
        {!an ? 'Mikrofon starten und einen Ton spielen'
          : !ton ? 'Spiel einen langen Ton …'
          : <>{sauber ? 'sauber' : cent < 0 ? 'zu tief' : 'zu hoch'} · {cent > 0 ? '+' : ''}{cent} Cent · <span className="gedaempft">{ton.frequenz.toFixed(1)} Hz</span></>}
      </p>

      <div className="flex justify-center">
        <button className={`start-knopf breit ${an ? 'laeuft' : ''}`} type="button" onClick={an ? stopp : start}>
          {an ? 'Stopp' : 'Stimmgerät starten'}
        </button>
      </div>
      {fehler && <p className="warnung text-center text-sm">{fehler}</p>}

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <span className="flex items-center gap-1">a′
          <button className="rund-knopf klein" type="button" onClick={() => setKammerton(Math.max(430, kammerton - 1))} aria-label="Kammerton tiefer">−</button>
          <strong className="tabular-nums">{kammerton} Hz</strong>
          <button className="rund-knopf klein" type="button" onClick={() => setKammerton(Math.min(450, kammerton + 1))} aria-label="Kammerton höher">+</button>
        </span>
        <div className="segment" role="group" aria-label="Instrument in">
          {(Object.keys(STIMMUNGEN) as Stimmung[]).map((s) => (
            <button key={s} type="button" aria-pressed={stimmung === s} onClick={() => setStimmung(s)}>in {s}</button>
          ))}
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-semibold">Referenzton spielen</summary>
        <div className="mt-3 space-y-2">
          <div className="segment" role="group" aria-label="Oktave">
            {[3, 4, 5].map((o) => <button key={o} type="button" aria-pressed={refOktave === o} onClick={() => { setRefOktave(o); referenzAus(); }}>Oktave {o}</button>)}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {TONNAMEN.map((n, i) => (
              <button key={n} type="button" className={`ton-taste ${refTon === i ? 'an' : ''}`} onClick={() => referenzSpielen(i)}>{n}</button>
            ))}
          </div>
          <p className="gedaempft text-xs">Notierte Töne für ein Instrument in {stimmung}; es erklingt der passende Ton bei a′ = {kammerton} Hz. Nochmal tippen zum Ausschalten.</p>
        </div>
      </details>
    </div>
  );
}
