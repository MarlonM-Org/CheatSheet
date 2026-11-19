'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OHNE_SAMMLUNG, stueckAuswahl, wahlStart, type Eingrenzung, type WahlAnsicht, type WahlGruppe } from '@/domain/sammlungen';
import { REIHENFOLGE } from './Bibliothek';
import { gespeichert, speichern } from './klang';
import type { Stueck } from './lokal';
import { useDialogFokus } from './tasten';

// Stückauswahl nach Sammlungen (F-23, Wunsch Marlon 2026-11-19): Wo Stücke
// zur Auswahl stehen, sind sie nach Sammlungen geordnet. Ein Knopf wie ein
// Auswahlfeld; ein Tipp legt ein Blatt darüber (nichts darunter rückt): oben
// „Sammlungen | A–Z“ und die Sammlungen als Chips (Reihenfolge der
// Bibliothek, „Alle“ vorn, „Ohne Sammlung“ hinten), darunter die Stücke —
// je Sammlung eine Gruppe, A–Z darin, ein Stück in mehreren Sammlungen in
// jeder („auch in …“). Ein Tipp auf ein Stück wählt es und schließt das
// Blatt. Das Blatt hat eine feste Höhe: Ansicht und Sammlung wechseln nur die
// Liste. Ansicht und Eingrenzung sind am Gerät gemerkt, für alle Auswahlen
// gemeinsam (`ueben:stueckwahl`, ein Filter — reist nicht mit); noch keine
// Sammlung getippt → die der Bibliothek. Die Bibliothek selbst bleibt
// unberührt. Regeln: stueckAuswahl und wahlStart in @/domain/sammlungen.
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
  const reihenfolge = useMemo(() => { const r = gespeichert<unknown>(REIHENFOLGE, []); return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []; }, []);
  const a = useMemo(() => stueckAuswahl(stuecke, reihenfolge, ansicht, eingrenzung), [stuecke, reihenfolge, ansicht, eingrenzung]);
  const gliedern = a.sammlungen.length > 0;
  const merken = (neu: { ansicht?: WahlAnsicht; sammlung?: Eingrenzung }) => {
    const alt = gespeichert<unknown>(STUECKWAHL, null);
    speichern(STUECKWAHL, { ...(alt && typeof alt === 'object' ? alt : {}), ansicht, ...neu });
  };
  const ansichtSetzen = (n: WahlAnsicht) => { setAnsicht(n); merken({ ansicht: n }); };
  const eingrenzen = (e: Eingrenzung) => { setEingrenzung(e); merken({ sammlung: e }); };

  // Escape schließt nur dieses Blatt: Es liegt zuoberst, darum fängt es die
  // Taste vor allen anderen (Erfassen am window) und gibt sie nicht weiter.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); schliessen(); } };
    window.addEventListener('keydown', taste, true);
    return () => window.removeEventListener('keydown', taste, true);
  }, [schliessen]);

  // Beim Öffnen steht das gewählte Stück im Blick (Oberkante bei einem
  // Drittel, unter der Gruppen-Überschrift), danach scrollt nur der Finger.
  // Neue Ansicht oder Sammlung: Liste von oben.
  const liste = useRef<HTMLDivElement>(null);
  const gezeigt = useRef<string | null>(null);
  useLayoutEffect(() => {
    const box = liste.current;
    const jetzt = `${ansicht}|${eingrenzung}`;
    if (!box || gezeigt.current === jetzt) return;
    const erstesMal = gezeigt.current === null;
    gezeigt.current = jetzt;
    if (!erstesMal) { box.scrollTop = 0; return; }
    const zeile = box.querySelector<HTMLElement>('.sw-zeile[aria-checked="true"]');
    if (!zeile) return;
    const z = zeile.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (z.bottom - b.top > box.clientHeight) box.scrollTop += z.top - b.top - box.clientHeight / 3;
  }, [ansicht, eingrenzung]);

  const zeile = (s: Stueck, auch: string[], art: WahlGruppe<Stueck>['art'], schluessel: string) => {
    const unter = [s.stimme, info?.(s) ?? '', auch.length ? (art === 'alle' ? auch.join(', ') : `auch in ${auch.join(', ')}`) : ''].filter(Boolean).join(' · ');
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

        {gliedern && (
          <div className="mix-woraus-chips sw-chips" role="group" aria-label="Sammlung">
            <button type="button" className="sammlung-chip" aria-pressed={a.eingrenzung === null} onClick={() => eingrenzen(null)}>
              Alle <span className="sammlung-zahl">{stuecke.length}</span>
            </button>
            {a.sammlungen.map((s) => (
              <button key={s.name} type="button" className="sammlung-chip" aria-pressed={a.eingrenzung === s.name} onClick={() => eingrenzen(s.name)}>
                {s.name} <span className="sammlung-zahl">{s.anzahl}</span>
              </button>
            ))}
            {a.ohne > 0 && (
              <button type="button" className="sammlung-chip" aria-pressed={a.eingrenzung === OHNE_SAMMLUNG} onClick={() => eingrenzen(OHNE_SAMMLUNG)}>
                Ohne Sammlung <span className="sammlung-zahl">{a.ohne}</span>
              </button>
            )}
          </div>
        )}

        <div ref={liste} className="sw-liste">
          {alle && (
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
