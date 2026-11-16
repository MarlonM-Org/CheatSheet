'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STIMMUNG_NAMEN, tonDeutsch } from '@/domain/akkorde';
import {
  abschnitteAbc, abschnitteKlaenge, ETUEDEN_STANDARD, ETUEDEN_TEMPO, etuedeBauen, grundFuer, istEtuedenEinstellung, MUSTER, musterVon,
  OBERE_GRENZEN, REIHENFOLGE_NAMEN, REIHENFOLGEN, RHYTHMEN, RHYTHMUS_NAMEN, RHYTHMUS_TICKS, TAKT, type EtuedenEinstellung,
} from '@/domain/etueden';
import { skillFinden } from '@/domain/skillkatalog';
import { AbcZeile } from './AbcZeile';
import { gespeichert, speichern, useEinstellungenGeladen } from './klang';
import { useKlickSpieler } from './klickspieler';
import { skillGeuebt } from './skillspeicher';
import { useDialogFokus, useEscape } from './tasten';

// Generierte Etüden (I-14): ein Muster durch die Tonarten (Quinten-,
// Quartenzirkel, chromatisch oder eine), Rhythmus, Tempo, obere Grenze des
// Umfangs. Notenzeile mit einer Tonart je Zeile (auf dem Handy umbrochen),
// Vorspielen mit Klick und einem Takt Vorzählen, „Geübt“ zählt auf die
// Klarinetten-Skills. Regeln in @/domain/etueden; Wahl in `ueben:etueden`.

const SCHLUESSEL = 'ueben:etueden';
const REIHENFOLGE_KURZ = { quinten: 'Quinten', quarten: 'Quarten', chromatisch: 'Chromat.', eine: 'Eine' } as const;
const laden = (): EtuedenEinstellung => {
  const v = gespeichert<unknown>(SCHLUESSEL, ETUEDEN_STANDARD);
  return istEtuedenEinstellung(v) ? v : ETUEDEN_STANDARD;
};

/** Breite eines Elements (für Takte je Zeile). */
export function useBreite<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, breite };
}

/** Takte je Zeile (1, 2, 4, 8): höchstens etwa 12 Noten auf dem Handy, 32 auf dem iPad. */
export const takteFuer = (breite: number, ticksJeNote: number) => {
  const n = Math.max(1, Math.floor((breite >= 560 ? 32 : 12) / (TAKT / ticksJeNote)));
  return 2 ** Math.floor(Math.log2(n));
};

export function EtuedenBlatt({ schliessen }: { schliessen: () => void }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { spielen, stopp, laeuft, stimmung } = useKlickSpieler();
  const [w, setWRoh] = useState<EtuedenEinstellung>(laden);
  const [klick, setKlick] = useState(true);
  const [geuebt, setGeuebt] = useState<string | null>(null);
  const { ref: flaeche, breite } = useBreite<HTMLDivElement>();
  useEinstellungenGeladen(useCallback(() => setWRoh(laden()), []));

  const setW = (teil: Partial<EtuedenEinstellung>) => {
    stopp();
    const neu = { ...w, ...teil };
    setWRoh(neu);
    speichern(SCHLUESSEL, neu);
  };
  const zu = () => { stopp(); schliessen(); };
  useEscape(zu);

  const muster = musterVon(w.muster);
  const etuede = useMemo(() => etuedeBauen(w), [w]);
  const takte = takteFuer(breite, RHYTHMUS_TICKS[w.rhythmus]);
  const abc = useMemo(() => abschnitteAbc(etuede.abschnitte, { takteJeZeile: takte }), [etuede, takte]);
  const vorspielen = () => spielen(abschnitteKlaenge(etuede.abschnitte, w.bpm, { klick, vorzaehlen: klick ? 4 : 0 }));
  const vorliebe = w.reihenfolge === 'quinten' ? 'kreuz' : 'be';
  const geuebtMelden = () => {
    for (const s of muster.skills) skillGeuebt(s);
    setGeuebt(muster.id);
  };
  const skillNamen = muster.skills.map((s) => skillFinden(s)?.name).filter(Boolean).join(', ');

  return createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt et-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Etüden</h2>
            <p className="gedaempft text-sm">Muster durch die Tonarten — notiert für {STIMMUNG_NAMEN[stimmung]}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        <div className="harmonie-arten et-muster" role="group" aria-label="Muster">
          {MUSTER.map((m) => (
            <button key={m.id} type="button" aria-pressed={w.muster === m.id} onClick={() => setW({ muster: m.id })}>{m.kurz}</button>
          ))}
        </div>
        <p className="et-was text-sm"><strong>{muster.name}.</strong> {muster.was}</p>

        <div className="et-feld">
          <span className="kennzahl-label">Tonarten</span>
          <div className="hoer-gruppe et-segment" role="group" aria-label="Tonarten">
            {REIHENFOLGEN.map((r) => (
              <button key={r} type="button" aria-pressed={w.reihenfolge === r} aria-label={REIHENFOLGE_NAMEN[r]} onClick={() => setW({ reihenfolge: r })}>{REIHENFOLGE_KURZ[r]}</button>
            ))}
          </div>
        </div>
        <div className="et-feld">
          <span className="kennzahl-label">{w.reihenfolge === 'eine' ? 'Tonart' : 'Beginnen mit'}</span>
          <div className="harmonie-grundtoene" role="group" aria-label={w.reihenfolge === 'eine' ? 'Tonart' : 'Erste Tonart'}>
            {Array.from({ length: 12 }, (_, k) => {
              const g = grundFuer(k, muster.moll, vorliebe);
              return (
                <button key={k} type="button" aria-pressed={w.start === k} onClick={() => setW({ start: k })}>
                  {muster.moll ? tonDeutsch(g).toLowerCase() : tonDeutsch(g)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="et-zwei">
          <div className="et-feld">
            <span className="kennzahl-label">Rhythmus</span>
            <div className="hoer-gruppe et-segment" role="group" aria-label="Rhythmus">
              {RHYTHMEN.map((r) => (
                <button key={r} type="button" aria-pressed={w.rhythmus === r} onClick={() => setW({ rhythmus: r })}>{RHYTHMUS_NAMEN[r]}</button>
              ))}
            </div>
          </div>
          <div className="et-feld">
            <span className="kennzahl-label">Höchster Ton</span>
            <div className="hoer-gruppe et-segment" role="group" aria-label="Höchster Ton (notiert)">
              {OBERE_GRENZEN.map((o) => (
                <button key={o.midi} type="button" aria-pressed={w.ober === o.midi} onClick={() => setW({ ober: o.midi })}>{o.name}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="et-tempo">
          <label className="et-tempo-zahl" htmlFor={`${kopf}-tempo`}><strong>{w.bpm}</strong><span>BPM</span></label>
          <input id={`${kopf}-tempo`} type="range" min={ETUEDEN_TEMPO.von} max={ETUEDEN_TEMPO.bis} step={2} value={w.bpm}
            onChange={(e) => setW({ bpm: Number(e.target.value) })} aria-label="Tempo" />
          <button type="button" className="swing-chip" aria-pressed={klick} onClick={() => { stopp(); setKlick(!klick); }}>Klick</button>
        </div>

        <div className="hoer-aktionen">
          {laeuft
            ? <button type="button" className="knopf" onClick={stopp}>■ Stopp</button>
            : <button type="button" className="knopf" onClick={vorspielen}>▶ Vorspielen</button>}
          <button type="button" className="knopf knopf-leise" disabled={geuebt === muster.id} onClick={geuebtMelden}>
            {geuebt === muster.id ? '✓ Geübt' : 'Geübt'}
          </button>
        </div>
        <p className="gedaempft text-xs et-hinweis">
          {geuebt === muster.id ? `Zählt für: ${skillNamen}.` : `${klick ? 'Ein Takt Vorzählen, dann ' : ''}${etuede.abschnitte.length === 1 ? 'eine Tonart' : `${etuede.abschnitte.length} Tonarten`} am Stück. „Geübt“ zählt für: ${skillNamen}.`}
        </p>

        <div ref={flaeche} className="et-noten">
          {breite > 0 && <AbcZeile abc={abc} hoehe={etuede.abschnitte.length > 1 ? 600 : 120} umbrechen={false} label={`${muster.name}, ${REIHENFOLGE_NAMEN[w.reihenfolge]}`} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
