'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  OHNE_SAMMLUNG, REIHENFOLGE, reihenfolgeLesen, stueckAuswahl, wahlStart, type Eingrenzung, type WahlAnsicht, type WahlGruppe,
} from '@/domain/sammlungen';
import { gespeichert, speichern } from './klang';
import type { Stueck } from './lokal';
import { useDialogFokus } from './tasten';

// Stückauswahl nach Sammlungen (F-23, Wunsch Marlon 2026-11-19): Wo Stücke
// zur Auswahl stehen, sind sie nach Sammlungen geordnet und durchsuchbar. Ein
// Knopf wie ein Auswahlfeld; ein Tipp legt ein Blatt darüber (nichts darunter
// rückt): oben „Sammlungen | A–Z“, das Suchfeld und die Sammlungen als Chips
// (Reihenfolge der Bibliothek, „Alle“ vorn, „Ohne Sammlung“ hinten), darunter
// die Stücke — je Sammlung eine Gruppe, A–Z darin, ein Stück in mehreren
// Sammlungen in jeder („auch in …“). Ein Tipp auf ein Stück wählt es und
// schließt das Blatt. Das Blatt hat eine feste Höhe: Ansicht, Sammlung und
// Suche wechseln nur die Liste.
// Es beginnt immer bei der Sammlung, die gerade in der Bibliothek gewählt ist
// (Rückmeldung Marlon 2026-11-19); gemerkt am Gerät ist nur die Ansicht, für
// alle Auswahlen gemeinsam (`ueben:stueckwahl`, { ansicht } — reist nicht
// mit). Die Bibliothek selbst bleibt unberührt.
// Die Suche (Titel, Stimme, Komponist; Groß/klein und Akzente egal) steht oben
// im Blatt, über den Chips: Die Bildschirmtastatur deckt nur das untere Ende
// der Liste, und die Liste bekommt so viel Platz darunter, dass jeder Treffer
// darüber scrollt. Regeln: stueckAuswahl und wahlStart in @/domain/sammlungen.
export const STUECKWAHL = 'ueben:stueckwahl';

const name = (s: Stueck) => `${s.titel}${s.stimme ? ` · ${s.stimme}` : ''}`;

export function StueckWahl({ stuecke, wert, waehlen, titel, alle, info, disabled = false, className = '' }: {
  // Was zur Wahl steht.
  stuecke: Stueck[];
  wert: string | null;
  waehlen: (id: string | null) => void;
  // Wofür gewählt wird (über „Stück wählen“ im Blatt, im Namen des Knopfs): „Neue Aufnahme“.
  titel: string;
  // Mit „keinem Stück“ als Wahl (Filter): sein Text und eine Zahl dazu.
  alle?: { text: string; info?: string };
  // Kleine Angabe je Stück (z. B. „3 Aufnahmen“), neben der Stimme.
  info?: (s: Stueck) => string;
  disabled?: boolean;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const gewaehlt = wert === null ? undefined : stuecke.find((s) => s.id === wert);
  const text = gewaehlt ? name(gewaehlt) : alle?.text ?? 'Stück wählen';
  return (
    <>
      <button type="button" className={`feld sw-knopf ${className}`} onClick={() => setOffen(true)} disabled={disabled}
        aria-haspopup="dialog" aria-expanded={offen} aria-label={`Stück wählen (${titel}): ${text}`}>
        <span className="sw-knopf-text">{text}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
      </button>
      {offen && (
        <WahlBlatt stuecke={stuecke} wert={gewaehlt ? wert : null} titel={titel} alle={alle} info={info}
          waehlen={(id) => { setOffen(false); if (id !== wert) waehlen(id); }} schliessen={() => setOffen(false)} />
      )}
    </>
  );
}

// Wie viel die Bildschirmtastatur unten verdeckt (iPhone, iPad): Das Blatt
// behält seine Höhe — nichts rückt —, nur die Liste bekommt unten so viel
// Platz, dass jeder Eintrag über die Tastatur scrollen kann. Zu viel Platz
// (iPad, Blatt mittig) schadet nicht.
function useTastaturHoehe() {
  const [hoehe, setHoehe] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const messen = () => setHoehe(Math.max(0, Math.round(window.innerHeight - vv.height)));
    vv.addEventListener('resize', messen);
    messen();
    return () => vv.removeEventListener('resize', messen);
  }, []);
  return hoehe;
}

function WahlBlatt({ stuecke, wert, titel, alle, info, waehlen, schliessen }: {
  stuecke: Stueck[]; wert: string | null; titel: string;
  alle?: { text: string; info?: string }; info?: (s: Stueck) => string;
  waehlen: (id: string | null) => void; schliessen: () => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const [start] = useState(() => wahlStart(gespeichert<unknown>(STUECKWAHL, null), gespeichert<string | null>('ueben:sammlung', null), stuecke, wert));
  const [ansicht, setAnsicht] = useState<WahlAnsicht>(start.ansicht);
  const [eingrenzung, setEingrenzung] = useState<Eingrenzung>(start.eingrenzung);
  const [suche, setSuche] = useState('');
  const reihenfolge = useMemo(() => reihenfolgeLesen(gespeichert<unknown>(REIHENFOLGE, [])), []);
  const a = useMemo(() => stueckAuswahl(stuecke, reihenfolge, ansicht, eingrenzung, suche), [stuecke, reihenfolge, ansicht, eingrenzung, suche]);
  const gliedern = a.sammlungen.length > 0;
  const sucht = suche.trim() !== '';
  // Gemerkt wird nur die Ansicht; die Sammlung kommt jedes Mal von der Bibliothek.
  const ansichtSetzen = (n: WahlAnsicht) => { setAnsicht(n); speichern(STUECKWAHL, { ansicht: n }); };
  const tastatur = useTastaturHoehe();

  // Escape leert erst die Suche, dann schließt es nur dieses Blatt: Es liegt
  // zuoberst, darum fängt es die Taste vor allen anderen (Erfassen am window)
  // und gibt sie nicht weiter.
  const sucheJetzt = useRef(suche);
  useEffect(() => { sucheJetzt.current = suche; }, [suche]);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); e.preventDefault();
      if (sucheJetzt.current) setSuche(''); else schliessen();
    };
    window.addEventListener('keydown', taste, true);
    return () => window.removeEventListener('keydown', taste, true);
  }, [schliessen]);

  // Beim Öffnen steht das gewählte Stück im Blick (Oberkante bei einem
  // Drittel, unter der Gruppen-Überschrift), danach scrollt nur der Finger.
  // Neue Ansicht, Sammlung oder Suche: Liste von oben.
  const liste = useRef<HTMLDivElement>(null);
  const gezeigt = useRef<string | null>(null);
  useLayoutEffect(() => {
    const box = liste.current;
    const jetzt = `${ansicht}|${eingrenzung}|${suche}`;
    if (!box || gezeigt.current === jetzt) return;
    const erstesMal = gezeigt.current === null;
    gezeigt.current = jetzt;
    if (!erstesMal) { box.scrollTop = 0; return; }
    const zeile = box.querySelector<HTMLElement>('.sw-zeile[aria-checked="true"]');
    if (!zeile) return;
    const z = zeile.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (z.bottom - b.top > box.clientHeight) box.scrollTop += z.top - b.top - box.clientHeight / 3;
  }, [ansicht, eingrenzung, suche]);

  const zeile = (s: Stueck, auch: string[], art: WahlGruppe<Stueck>['art'], schluessel: string) => {
    // Beim Suchen auch der Komponist — sonst wäre ein Treffer darüber nicht zu erkennen.
    const unter = [s.stimme, sucht ? s.komponist ?? '' : '', info?.(s) ?? '', auch.length ? (art === 'alle' ? auch.join(', ') : `auch in ${auch.join(', ')}`) : ''].filter(Boolean).join(' · ');
    return (
      <li key={schluessel}>
        <button type="button" role="radio" aria-checked={s.id === wert} className="sw-zeile" onClick={() => waehlen(s.id)}>
          <span className="sw-zeile-text">
            <span className="bib-titel">{s.titel}</span>
            {unter && <span className="bib-unterzeile">{unter}</span>}
          </span>
          <span className="sw-haken" aria-hidden="true">{s.id === wert ? '✓' : ''}</span>
        </button>
      </li>
    );
  };
  // Ein Chip: beim Suchen mit der Zahl der Treffer darin (ohne Treffer blass, aber da — nichts rückt).
  const chip = (wahl: Eingrenzung, text: string, anzahl: number) => (
    <button key={wahl === null ? ':alle' : `s:${wahl}`} type="button" className={`sammlung-chip${sucht && !anzahl ? ' sw-chip-leer' : ''}`}
      aria-pressed={a.eingrenzung === wahl} onClick={() => setEingrenzung(wahl)}>
      {text} <span className="sammlung-zahl">{anzahl}</span>
    </button>
  );
  const woText = a.eingrenzung === OHNE_SAMMLUNG ? 'ohne Sammlung' : `in „${a.eingrenzung}“`;

  return createPortal(
    <div className="blatt-hintergrund sw-hintergrund" onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt sw-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="sw-oben">
          <span className="kennzahl-label min-w-0 flex-1 truncate">{titel}</span>
          <button type="button" className="panel-zu" onClick={schliessen} aria-label="Schließen">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <div className="sw-titel">
          <h2 id={kopf} className="text-xl font-extrabold">Stück wählen</h2>
          {gliedern && (
            <div className="segment sw-ansicht" role="group" aria-label="Ordnung">
              <button type="button" aria-pressed={ansicht === 'sammlungen'} onClick={() => ansichtSetzen('sammlungen')}>Sammlungen</button>
              <button type="button" aria-pressed={ansicht === 'abc'} onClick={() => ansichtSetzen('abc')}>A–Z</button>
            </div>
          )}
        </div>

        <input type="search" className="feld sw-suche" value={suche} onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen: Titel, Stimme, Komponist" aria-label="Stücke durchsuchen"
          enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />

        {gliedern && (
          <div className="sw-chips" role="group" aria-label="Sammlung">
            {chip(null, 'Alle', a.treffer)}
            {a.sammlungen.map((s) => chip(s.name, s.name, s.anzahl))}
            {a.ohneDa && chip(OHNE_SAMMLUNG, 'Ohne Sammlung', a.ohne)}
          </div>
        )}

        <div ref={liste} className="sw-liste" style={tastatur ? { paddingBottom: `calc(1.5rem + ${tastatur}px)` } : undefined}>
          {alle && !sucht && (
            <ul className="sw-gruppe" role="radiogroup" aria-label={alle.text}>
              <li>
                <button type="button" role="radio" aria-checked={wert === null} className="sw-zeile" onClick={() => waehlen(null)}>
                  <span className="sw-zeile-text">
                    <span className="bib-titel">{alle.text}</span>
                    {alle.info && <span className="bib-unterzeile">{alle.info}</span>}
                  </span>
                  <span className="sw-haken" aria-hidden="true">{wert === null ? '✓' : ''}</span>
                </button>
              </li>
            </ul>
          )}
          {sucht && !a.gruppen.length && (
            <div className="sw-nichts" role="status">
              {a.eingrenzung !== null && a.treffer > 0 ? (
                <>
                  <span>Nichts {woText} gefunden.</span>
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setEingrenzung(null)}>
                    In allen suchen · {a.treffer} Treffer
                  </button>
                </>
              ) : <span>Nichts gefunden für „{suche.trim()}“.</span>}
            </div>
          )}
          {a.gruppen.map((g) => {
            const kopfText = g.art === 'sammlung' ? g.name : g.art === 'ohne' ? 'Ohne Sammlung' : '';
            // Überschriften nur in der Gliederung; eingegrenzt nennt sie schon der Chip.
            const mitKopf = kopfText !== '' && a.eingrenzung === null;
            return (
              <section key={`${g.art}:${g.name}`} className="sw-abschnitt" aria-label={kopfText || 'Alle Stücke'}>
                {mitKopf && <h3 className="sw-kopf"><span className="kennzahl-label">{kopfText}</span><span className="sammlung-zahl">{g.zeilen.length}</span></h3>}
                <ul className="sw-gruppe" role="radiogroup" aria-label={kopfText || 'Alle Stücke'}>
                  {g.zeilen.map((z) => zeile(z.stueck, z.auch, g.art, z.stueck.id))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
