'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  folgeLesen, folgeText, folgeTransponieren, klarinettenSchwierigkeit, STIMMUNG_NAMEN, tonartAusKlasse, tonartEnharmonisch, tonartName,
  tonartSymbol, tonartTransponieren, tonKlasse, vorzeichen, vorzeichenText, type Richtung, type TonartAngabe,
} from '@/domain/akkorde';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

// Transponier-Helfer (I-12): Tonart klingend → notiert (und zurück) mit
// Vorzeichen und Hinweis, wie bequem sie auf der Klarinette liegt; eine
// Akkordfolge („E A B7 E“) für dich notiert, enharmonisch bequem
// geschrieben. Stimmung aus dem Stimmgerät. Regeln in @/domain/akkorde.

const KLASSEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function TransponierBlatt({ schliessen }: { schliessen: () => void }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { stimmung } = useStimmgeraetApi();
  const [richtung, setRichtung] = useState<Richtung>('zuNotiert');
  const [klasse, setKlasse] = useState(4);
  const [moll, setMoll] = useState(false);
  const [folge, setFolge] = useState('E A B7 E');
  const [kopiert, setKopiert] = useState(false);
  useEscape(schliessen);

  const von: TonartAngabe = tonartAusKlasse(klasse, moll);
  const nach = tonartTransponieren(von, stimmung, richtung);
  const notiert = richtung === 'zuNotiert' ? nach : von;
  const schwer = klarinettenSchwierigkeit(notiert);
  const anders = tonartEnharmonisch(nach);
  const links = richtung === 'zuNotiert' ? 'klingend' : 'notiert', rechts = richtung === 'zuNotiert' ? 'notiert' : 'klingend';

  const gelesen = folgeLesen(folge);
  const ergebnis = folgeTransponieren(gelesen, stimmung, richtung);
  const ausgabe = folgeText(ergebnis, { jeZeile: 4 });

  const tauschen = () => {
    // Ergebnis wird neue Eingabe — Tonart und Folge.
    setKlasse(tonKlasse(nach.grund));
    setMoll(nach.moll);
    if (gelesen.takte.length) setFolge(folgeText(ergebnis, { ascii: true, jeZeile: 4 }));
    setRichtung(richtung === 'zuNotiert' ? 'zuKlingend' : 'zuNotiert');
    setKopiert(false);
  };

  const kopieren = async () => {
    try { await navigator.clipboard.writeText(ausgabe); setKopiert(true); } catch { setKopiert(false); }
  };

  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Transponieren</h2>
            <p className="gedaempft text-sm">{STIMMUNG_NAMEN[stimmung]}{stimmung === 'C' ? ' — klingend = notiert; Stimmung im Stimmgerät wählen' : ''}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        <div className="harmonie-richtung">
          <strong>{links}</strong>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={tauschen} aria-label="Richtung tauschen">⇄ tauschen</button>
          <strong>{rechts}</strong>
        </div>

        <section className="space-y-2" aria-label="Tonart">
          <span className="kennzahl-label">Tonart {links}</span>
          <div className="harmonie-grundtoene" role="group" aria-label={`Grundton ${links}`}>
            {KLASSEN.map((k) => (
              <button key={k} type="button" aria-pressed={k === klasse} onClick={() => setKlasse(k)}>{tonartSymbol(tonartAusKlasse(k, moll)).replace(/m$/, '')}</button>
            ))}
          </div>
          <div className="hoer-gruppe" role="group" aria-label="Tongeschlecht">
            <button type="button" aria-pressed={!moll} onClick={() => setMoll(false)}>Dur</button>
            <button type="button" aria-pressed={moll} onClick={() => setMoll(true)}>Moll</button>
          </div>
          <div className="harmonie-tonarten">
            <div>
              <span className="kennzahl-label">{links}</span>
              <strong>{tonartName(von)}</strong>
              <span className="gedaempft text-sm">{vorzeichenText(vorzeichen(von))}</span>
            </div>
            <span className="harmonie-pfeil" aria-hidden="true">→</span>
            <div className="ziel">
              <span className="kennzahl-label">{rechts}</span>
              <strong>{tonartName(nach)}</strong>
              <span className="gedaempft text-sm">{vorzeichenText(vorzeichen(nach))}{anders && Math.abs(vorzeichen(nach)) >= 5 ? ` · auch ${tonartName(anders)}` : ''}</span>
            </div>
          </div>
          <p className={`harmonie-schwer ${schwer.unbequem ? 'unbequem' : ''}`}>
            <strong>Klarinette ({tonartName(notiert)}): {schwer.stufe}.</strong> {schwer.hinweis}
          </p>
        </section>

        <section className="space-y-2" aria-label="Akkordfolge">
          <label className="kennzahl-label" htmlFor={`${kopf}-folge`}>Akkordfolge {links}</label>
          <textarea id={`${kopf}-folge`} className="feld harmonie-folge" value={folge} rows={3} onChange={(e) => { setFolge(e.target.value); setKopiert(false); }}
            placeholder="E A B7 E  oder  | Cm7 F7 | Bbmaj7 |" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <span className="kennzahl-label">{rechts}</span>
          <pre className="harmonie-ausgabe" aria-live="polite">{ausgabe || ' '}</pre>
          <div className="harmonie-fehlerzeile text-sm">{gelesen.fehler.length ? <span className="warnung">{gelesen.fehler.join(' · ')}</span> : <span className="gedaempft">Taktstriche mit |, mehrere Akkorde je Takt mit Leerzeichen, % wiederholt.</span>}</div>
          <button type="button" className="knopf knopf-leise w-full" disabled={!ausgabe} onClick={() => void kopieren()}>{kopiert ? '✓ Kopiert' : 'Ergebnis kopieren'}</button>
        </section>
      </div>
    </div>,
    document.body,
  );
}
