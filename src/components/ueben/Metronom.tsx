'use client';

import { useRef, useState } from 'react';
import { tempoBezeichnung } from '@/domain/ueben';
import type { Klang } from './klang';
import { useMetronom } from './MetronomKontext';

const UNTERTEILUNG = [
  { n: 1, zeichen: '♩', name: 'Viertel', kurz: '4tel' }, { n: 2, zeichen: '♫', name: 'Achtel', kurz: '8tel' },
  { n: 3, zeichen: '♪³', name: 'Triolen', kurz: 'Triole' }, { n: 4, zeichen: '♬', name: 'Sechzehntel', kurz: '16tel' },
];
const KLAENGE: { k: Klang; name: string }[] = [{ k: 'holz', name: 'Holzblock' }, { k: 'klick', name: 'Klick' }, { k: 'glocke', name: 'Glocke' }];

export function Metronom() {
  const {
    bpm, setBpm, laeuft, start, stopp, aktiv, takt, taktAendern, akzente, akzentWechseln,
    unter, setUnter, klang, setKlang, laut, setLaut, trainer, setTrainer,
  } = useMetronom();
  const taps = useRef<number[]>([]);
  function tippen() {
    const jetzt = performance.now();
    taps.current = [...taps.current.filter((t) => jetzt - t < 2500), jetzt].slice(-8);
    if (taps.current.length >= 3) {
      const abst = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      setBpm(Math.min(300, Math.max(20, Math.round(60000 / (abst.reduce((x, y) => x + y, 0) / abst.length)))));
    }
  }

  const setzen = setBpm;
  const [eingabe, setEingabe] = useState<string | null>(null);
  function eingabeUebernehmen() {
    const n = Number(eingabe);
    if (n) setzen(n);
    setEingabe(null);
  }

  return (
    <div className="metronom space-y-5">
      <div className="text-center">
        {eingabe !== null ? (
          <input className="tempo-zahl tempo-eingabe" autoFocus inputMode="numeric" value={eingabe} aria-label="Tempo eingeben"
            onChange={(e) => setEingabe(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={eingabeUebernehmen} onKeyDown={(e) => { if (e.key === 'Enter') eingabeUebernehmen(); if (e.key === 'Escape') setEingabe(null); }} />
        ) : (
          <button type="button" className="tempo-zahl" onClick={() => setEingabe(String(bpm))} aria-label={`Tempo ${bpm}, antippen zum Eingeben`}>{bpm}</button>
        )}
        <div className="tempo-name">{tempoBezeichnung(bpm)}{trainer.an && laeuft ? ' · Trainer läuft' : ''}</div>
      </div>

      <div className="schlaege" role="group" aria-label="Schläge im Takt — antippen: betont, normal, stumm">
        {akzente.map((a, i) => (
          <button key={i} type="button" onClick={() => akzentWechseln(i)} className={`schlag schlag-${a} ${aktiv?.schlag === i ? (aktiv.sub === 0 ? 'an' : 'halb') : ''}`}
            aria-label={`Schlag ${i + 1}: ${a}`}>
            <span>{i + 1}</span>
          </button>
        ))}
      </div>

      <input className="regler" type="range" min={20} max={300} value={bpm} onChange={(e) => setzen(Number(e.target.value))} aria-label="Tempo" />

      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col gap-2">
          <button className="rund-knopf breit" type="button" onClick={() => setzen(bpm / 1.1)} aria-label="10 Prozent langsamer">−10 %</button>
          <button className="rund-knopf breit" type="button" onClick={() => setzen(bpm - 1)} aria-label="Ein Schlag langsamer">−1</button>
        </div>
        <button className={`start-knopf ${laeuft ? 'laeuft' : ''}`} type="button" onClick={laeuft ? stopp : start} aria-label={laeuft ? 'Stopp' : 'Start'}>
          {laeuft ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
        </button>
        <div className="flex flex-col gap-2">
          <button className="rund-knopf breit" type="button" onClick={() => setzen(bpm * 1.1)} aria-label="10 Prozent schneller">+10 %</button>
          <button className="rund-knopf breit" type="button" onClick={() => setzen(bpm + 1)} aria-label="Ein Schlag schneller">+1</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={tippen}>Tempo tippen</button>
        <label className="flex items-center gap-1 text-sm">Takt
          <select className="feld feld-schmal" value={takt} onChange={(e) => taktAendern(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="segment" role="group" aria-label="Unterteilung">
        {UNTERTEILUNG.map((u) => (
          <button key={u.n} type="button" aria-pressed={unter === u.n} onClick={() => setUnter(u.n)} title={u.name}>
            <span className="block text-lg leading-none">{u.zeichen}</span><span className="block text-[0.7rem]">{u.kurz}</span>
          </button>
        ))}
      </div>

      <details className="space-y-3">
        <summary className="cursor-pointer text-sm font-semibold">Klang, Lautstärke, Tempo-Trainer</summary>
        <div className="segment mt-3" role="group" aria-label="Klang">
          {KLAENGE.map((k) => <button key={k.k} type="button" aria-pressed={klang === k.k} onClick={() => setKlang(k.k)}>{k.name}</button>)}
        </div>
        <label className="flex items-center gap-3 text-sm">Lautstärke
          <input className="regler flex-1" type="range" min={0} max={1} step={0.05} value={laut} onChange={(e) => setLaut(Number(e.target.value))} />
        </label>
        <div className="karte space-y-2">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={trainer.an} onChange={(e) => setTrainer({ ...trainer, an: e.target.checked })} /> Tempo-Trainer
          </label>
          <p className="text-sm">
            Ab dem Start-Tempo alle
            <input className="feld feld-zahl mx-1 text-center" inputMode="numeric" value={trainer.takte} onChange={(e) => setTrainer({ ...trainer, takte: Number(e.target.value.replace(/\D/g, '')) || 1 })} aria-label="Takte" />
            Takte um
            <input className="feld feld-zahl mx-1 text-center" inputMode="numeric" value={trainer.schritt} onChange={(e) => setTrainer({ ...trainer, schritt: Number(e.target.value.replace(/\D/g, '')) || 1 })} aria-label="Schritt" />
            schneller, bis
            <input className="feld feld-zahl mx-1 text-center" inputMode="numeric" value={trainer.ziel} onChange={(e) => setTrainer({ ...trainer, ziel: Number(e.target.value.replace(/\D/g, '')) || 120 })} aria-label="Zieltempo" />
          </p>
        </div>
        <p className="gedaempft text-xs">Schlag-Punkte antippen: betont → normal → stumm. Der Bildschirm bleibt an, solange das Metronom läuft.</p>
      </details>
    </div>
  );
}
