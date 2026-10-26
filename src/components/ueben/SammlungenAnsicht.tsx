'use client';

import { useState } from 'react';
import { nachTitel } from '@/domain/notenpult';
import { gleicheSammlung, imFilter, sammlungenVon, sammlungName } from '@/domain/sammlungen';
import { gespeichert, speichern } from './klang';
import { MehrKnopf, useHalten } from './Kontext';
import type { Stueck } from './lokal';
import { useDialogFokus, useEscape } from './tasten';

// Große Ansicht der Sammlungen (F-13, Wunsch Marlon 2026-10-26): über den
// Pfeil rechts an der Leiste. Jede Sammlung ist ein Abschnitt in der
// gemerkten Reihenfolge, darunter ihre Stücke (A–Z); ein Tipp auf den Kopf
// klappt den Abschnitt zu oder auf (je Gerät gemerkt, `ueben:sammlungen-zu`),
// „⋯“ oder Halten öffnet das Kontext-Blatt der Sammlung (umbenennen,
// verschieben, Stücke auswählen, auflösen). Ein Stück antippen öffnet es;
// sein „⋯“ das Stück-Blatt. Zuletzt „Ohne Sammlung“, damit nichts fehlt.
// Liegt über der Bibliothek, unter den Kontext-Blättern.
const ZU_SCHLUESSEL = 'ueben:sammlungen-zu';

export function SammlungenAnsicht({ uebersicht, noten, stellenJe, aktiv, waehlen, halten, stueck, oeffnen, anlegen, schliessen, escapeAktiv }: {
  uebersicht: { name: string; anzahl: number }[]; noten: Stueck[]; stellenJe: Record<string, number>;
  aktiv: string | null;
  // Nur diese Sammlung zeigen: Filter setzen, Ansicht zu.
  waehlen: (name: string | null) => void;
  halten: (name: string) => void;
  stueck: (id: string) => void;
  oeffnen: (id: string) => void;
  anlegen: (name: string) => void;
  schliessen: () => void;
  escapeAktiv: boolean;
}) {
  useEscape(schliessen, escapeAktiv);
  const fokus = useDialogFokus<HTMLDivElement>();
  const [zu, setZu] = useState<string[]>(() => { const l = gespeichert<unknown>(ZU_SCHLUESSEL, []); return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []; });
  const istZu = (name: string) => zu.some((x) => gleicheSammlung(x, name));
  const umklappen = (name: string) => {
    const neu = istZu(name) ? zu.filter((x) => !gleicheSammlung(x, name)) : [...zu, name];
    setZu(neu); speichern(ZU_SCHLUESSEL, neu);
  };
  const [neu, setNeu] = useState<string | null>(null);
  const neuerName = neu === null ? null : sammlungName(neu);
  const ohne = noten.filter((n) => sammlungenVon(n).length === 0).sort(nachTitel);
  const abschnitte: { name: string; stuecke: Stueck[]; echt: boolean }[] = [
    ...uebersicht.map((s) => ({ name: s.name, stuecke: noten.filter((n) => imFilter(n, s.name)).sort(nachTitel), echt: true })),
    ...(ohne.length ? [{ name: 'Ohne Sammlung', stuecke: ohne, echt: false }] : []),
  ];

  return (
    <section className="sammlungen-ansicht" role="dialog" aria-modal="true" aria-label="Alle Sammlungen" ref={fokus} tabIndex={-1}>
      <div className="panel-kopf mit-linie">
        <h2>Sammlungen</h2>
        <span className="bib-anzahl">· {uebersicht.length}</span>
        <span className="flex-1" />
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Sammlungen schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="bib-inhalt space-y-3">
        {uebersicht.length === 0 && <p className="karte text-sm">Noch keine Sammlungen. Unten die erste anlegen — oder beim Hinzufügen einen ganzen Ordner wählen: Seine Unterordner werden Sammlungen.</p>}
        {abschnitte.map((a) => (
          <Abschnitt key={a.name} name={a.name} stuecke={a.stuecke} zu={istZu(a.name)} umklappen={() => umklappen(a.name)}
            aktiv={a.echt && aktiv !== null && gleicheSammlung(aktiv, a.name)}
            mehr={a.echt ? () => halten(a.name) : null} stellenJe={stellenJe} stueck={stueck} oeffnen={oeffnen} />
        ))}
        {neu === null ? (
          <button type="button" className="knopf knopf-leise" onClick={() => setNeu('')}>+ Sammlung</button>
        ) : (
          <form className="sammlung-formular" onSubmit={(e) => { e.preventDefault(); if (neuerName) { anlegen(neuerName); setNeu(null); } }}>
            <input className="feld" autoFocus value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="z. B. Märsche oder Orchester A" aria-label="Name der Sammlung" maxLength={60} />
            <button type="submit" className="knopf knopf-klein" disabled={!neuerName}>Anlegen</button>
            <button type="button" className="text-knopf bib-fertig" onClick={() => setNeu(null)}>Abbrechen</button>
          </form>
        )}
        <p className="gedaempft text-xs">Reihenfolge, Umbenennen und Auflösen: „⋯“ an der Sammlung (oder halten). Stücke einsortieren: „⋯“ am Stück → Sammlungen.</p>
      </div>
      <div className="bib-fuss">
        <button type="button" className="text-knopf" onClick={() => waehlen(null)}>Alle Stücke zeigen</button>
      </div>
    </section>
  );
}

function Abschnitt({ name, stuecke, zu, umklappen, aktiv, mehr, stellenJe, stueck, oeffnen }: {
  name: string; stuecke: Stueck[]; zu: boolean; umklappen: () => void; aktiv: boolean;
  mehr: (() => void) | null; stellenJe: Record<string, number>; stueck: (id: string) => void; oeffnen: (id: string) => void;
}) {
  const geste = useHalten(mehr ?? (() => {}));
  return (
    <section className={`sammlung-abschnitt ${zu ? 'zu' : ''}`} aria-label={name}>
      <div className="sammlung-abschnitt-kopf">
        <button type="button" className={`sammlung-abschnitt-titel ${mehr ? 'haltbar' : ''}`} onClick={umklappen} aria-expanded={!zu} aria-pressed={aktiv} {...(mehr ? geste : {})}>
          <svg className="sammlung-abschnitt-pfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          <strong>{name}</strong>
          <span className="sammlung-zahl">{stuecke.length}</span>
        </button>
        {mehr && <MehrKnopf tun={mehr} aria={`Mehr zu Sammlung „${name}“`} />}
      </div>
      {!zu && (stuecke.length ? (
        <ul className="bib-liste">
          {stuecke.map((n) => <Zeile key={n.id} n={n} stellen={stellenJe[n.id] ?? 0} oeffnen={() => oeffnen(n.id)} mehr={() => stueck(n.id)} />)}
        </ul>
      ) : (
        <p className="sammlung-abschnitt-leer gedaempft text-sm">Noch keine Stücke. Über „+ Noten“ hinzufügen, wenn diese Sammlung gewählt ist — oder am Stück „⋯ → Sammlungen“.</p>
      ))}
    </section>
  );
}

function Zeile({ n, stellen, oeffnen, mehr }: { n: Stueck; stellen: number; oeffnen: () => void; mehr: () => void }) {
  const halten = useHalten(mehr);
  const weitere = sammlungenVon(n);
  return (
    <li className="bib-zeile haltbar">
      <button type="button" className="bib-stueck" onClick={oeffnen} {...halten}>
        <span className="bib-titel">{n.titel}</span>
        <span className="bib-unterzeile">
          {[n.stimme, stellen ? `${stellen} ${stellen === 1 ? 'Stelle' : 'Stellen'}` : '', weitere.length > 1 ? `auch in ${weitere.length - 1} ${weitere.length === 2 ? 'weiterer Sammlung' : 'weiteren Sammlungen'}` : ''].filter(Boolean).join(' · ')}
        </span>
      </button>
      <MehrKnopf tun={mehr} aria={`Mehr zu „${n.titel}“`} />
    </li>
  );
}
