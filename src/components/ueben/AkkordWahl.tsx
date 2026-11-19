'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AKKORD_ARTEN, akkordAusTeilen, akkordLesen, akkordName, akkordTeile, akkordText, enharmonisch, tonAusKlasse, tonLesen, tonSymbol,
} from '@/domain/akkorde';
import { useDialogFokus, useEscape } from './tasten';

// Akkord-Auswahl (Wunsch Marlon 2026-11-19): Akkorde antippen statt tippen —
// erst der Grundton, dann die Art (Dur, m, 7, maj7, m7 …). Jeder Tipp zeigt
// sofort das Ergebnis: Ein Grundton legt einen Akkord an (in der zuletzt
// gewählten Art), eine Art ändert den gewählten Akkord. „Takt ›“ geht zum
// nächsten Takt (am Ende: ein neuer), „wie davor“ wiederholt den Takt davor,
// „＋ Akkord“ setzt einen zweiten Akkord in den Takt. Genutzt im Formular der
// Jam-Karte und im Notenblatt (dort sind die Takte fest).

// Grundtöne in der üblichen Leadsheet-Schreibweise; ⇄ schreibt den gewählten um (D♭ ⇄ C♯).
const GRUNDTOENE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => tonSymbol(tonAusKlasse(k, k === 6 ? 'kreuz' : 'be'), true));
const zeigen = (ascii: string) => { const a = akkordLesen(ascii); return a ? akkordText(a) : ascii; };
const MAX_JE_TAKT = 4;

export function AkkordWahl({ titel, takte, start, aendern, schliessen, festeTakte = false, taktNummer = (i) => i + 1, hoeren, oben = false }: {
  titel: string;
  /** Die Takte (je Takt die Symbole, ASCII). */
  takte: readonly (readonly string[])[];
  /** Takt zum Öffnen; = Länge heißt: ein neuer Takt am Ende. */
  start: number;
  aendern: (takte: string[][]) => void;
  schliessen: () => void;
  /** Takte weder anhängen noch löschen (Notenblatt: die Takte gibt das Blatt vor). */
  festeTakte?: boolean;
  /** Nummer, die über dem Takt steht. */
  taktNummer?: (i: number) => number;
  /** Akkord anhören (ASCII). */
  hoeren?: (symbol: string) => void;
  /** Über dem Notenblatt (Vollbild-Dialog): eine Ebene höher. */
  oben?: boolean;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const max = festeTakte ? Math.max(0, takte.length - 1) : takte.length;
  const [takt, setTakt] = useState(Math.max(0, Math.min(start, max)));
  const takt0 = takte[takt] ?? [];
  const [aktivRoh, setAktiv] = useState<number | null>(takt0.length ? 0 : null);
  const aktiv = aktivRoh !== null && aktivRoh < takt0.length ? aktivRoh : null;
  const [letzteEndung, setLetzteEndung] = useState(() => (takt0[0] ? akkordTeile(takt0[0])?.endung ?? '7' : '7'));
  useEscape(schliessen);

  const setzen = (neuerTakt: string[]) => {
    const neu = takte.map((x) => [...x]);
    if (takt >= neu.length) neu.push(neuerTakt); else neu[takt] = neuerTakt;
    // Ein neuer Takt ohne Akkord wird nicht angelegt.
    if (!neuerTakt.length && takt === neu.length - 1 && takt >= takte.length) neu.pop();
    aendern(neu);
  };
  const gewaehlt = aktiv !== null ? akkordTeile(takt0[aktiv]) : null;

  const grundTippen = (g: string) => {
    if (aktiv !== null) {
      const t = akkordTeile(takt0[aktiv]);
      const neu = [...takt0];
      neu[aktiv] = akkordAusTeilen({ grund: g, endung: t?.endung ?? letzteEndung });
      setzen(neu);
      return;
    }
    if (takt0.length >= MAX_JE_TAKT) return;
    setzen([...takt0, akkordAusTeilen({ grund: g, endung: letzteEndung })]);
    setAktiv(takt0.length);
  };
  const artTippen = (e: string) => {
    setLetzteEndung(e);
    if (aktiv === null || !gewaehlt) return;
    const neu = [...takt0];
    neu[aktiv] = akkordAusTeilen({ grund: gewaehlt.grund, endung: e, bass: gewaehlt.bass });
    setzen(neu);
    hoeren?.(neu[aktiv]);
  };
  const umschreiben = () => {
    if (aktiv === null || !gewaehlt) return;
    const t = tonLesen(gewaehlt.grund);
    const u = t && t.vz !== 0 ? enharmonisch(t, t.vz > 0 ? 1 : -1) : null;
    if (!u) return;
    const neu = [...takt0];
    neu[aktiv] = akkordAusTeilen({ ...gewaehlt, grund: tonSymbol(u, true) });
    setzen(neu);
  };
  const gehe = (i: number) => {
    const z = Math.max(0, Math.min(i, max));
    setTakt(z);
    setAktiv((takte[z] ?? []).length ? 0 : null);
  };
  const wieDavor = () => { if (takt > 0 && takte[takt - 1]) { setzen([...takte[takt - 1]]); setAktiv(0); } };
  const akkordWeg = () => { if (aktiv === null) return; setzen(takt0.filter((_, i) => i !== aktiv)); setAktiv(aktiv > 0 ? aktiv - 1 : null); };
  const taktWeg = () => {
    if (festeTakte || takt >= takte.length) return;
    aendern(takte.filter((_, i) => i !== takt).map((x) => [...x]));
    const z = Math.min(takt, takte.length - 1);
    setTakt(z);
    setAktiv((takte[z + 1] ?? []).length ? 0 : null);
  };
  const neuerTakt = takt >= takte.length;
  const name = gewaehlt ? akkordLesen(takt0[aktiv!]) : null;

  return createPortal(
    <div className={`blatt-hintergrund akkordwahl-hintergrund${oben ? ' oben' : ''}`} onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt akkordwahl" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Akkorde antippen</h2>
            <p className="gedaempft text-sm">{titel}</p>
          </div>
          <button type="button" className="knopf knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        <div className="akkordwahl-takt" aria-live="polite">
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => gehe(takt - 1)} disabled={takt === 0} aria-label="Takt davor">‹</button>
          <div className="akkordwahl-mitte">
            <span className="kennzahl-label">{neuerTakt ? `Neuer Takt ${taktNummer(takt)}` : `Takt ${taktNummer(takt)}`}</span>
            <div className="akkordwahl-chips" role="group" aria-label="Akkorde im Takt">
              {takt0.length
                ? takt0.map((s, i) => (
                  <button key={i} type="button" aria-pressed={aktiv === i} onClick={() => setAktiv(i)}>{zeigen(s)}</button>
                ))
                : <span className="gedaempft text-sm">Grundton antippen</span>}
            </div>
            <span className="akkordwahl-name gedaempft text-xs">{name ? akkordName(name) : ' '}</span>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => gehe(takt + 1)} disabled={takt >= max || (neuerTakt && !takt0.length)}
            aria-label={takt + 1 >= takte.length && !festeTakte ? 'Neuer Takt' : 'Nächster Takt'}>›</button>
        </div>

        <div className="harmonie-grundtoene" role="group" aria-label="Grundton">
          {GRUNDTOENE.map((g) => (
            <button key={g} type="button" aria-pressed={gewaehlt?.grund === g} onClick={() => grundTippen(g)}>{zeigen(g)}</button>
          ))}
        </div>
        <div className="harmonie-arten" role="group" aria-label="Art">
          {AKKORD_ARTEN.map((a) => (
            <button key={a.endung || 'dur'} type="button" aria-pressed={gewaehlt ? gewaehlt.endung === a.endung : false} disabled={aktiv === null}
              onClick={() => artTippen(a.endung)}>{a.name || 'Dur'}</button>
          ))}
        </div>

        <div className="akkordwahl-aktionen">
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setAktiv(null)} disabled={takt0.length >= MAX_JE_TAKT || aktiv === null}
            title="Noch einen Akkord in diesen Takt (dann teilen sie ihn)">＋ Akkord</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={wieDavor} disabled={takt === 0} title="Die Akkorde des Takts davor">wie davor</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={umschreiben} disabled={!gewaehlt || !/[#b]/.test(gewaehlt.grund)} title="Grundton enharmonisch umschreiben (D♭ ⇄ C♯)">♭ ⇄ ♯</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={akkordWeg} disabled={aktiv === null}>Akkord ✕</button>
          {!festeTakte && <button type="button" className="knopf knopf-leise knopf-klein" onClick={taktWeg} disabled={neuerTakt}>Takt ✕</button>}
          {hoeren && <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aktiv !== null && hoeren(takt0[aktiv])} disabled={aktiv === null}>▶ Hören</button>}
        </div>
        <p className="gedaempft text-xs">Grundton tippen legt einen Akkord an, die Art ändert ihn. „›“ geht zum nächsten Takt{festeTakte ? '' : ' — am Ende kommt ein neuer dazu'}.</p>
      </div>
    </div>,
    document.body,
  );
}
