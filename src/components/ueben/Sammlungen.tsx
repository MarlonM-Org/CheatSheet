'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gleicheSammlung, imFilter, mitSammlung, ohneSammlung, sammlungenVon, sammlungName } from '@/domain/sammlungen';
import type { Tag } from '@/domain/tags';
import { useHalten } from './Kontext';
import type { Stueck } from './lokal';
import { TagPunkt } from './Tags';
import { useDialogFokus, useEscape } from './tasten';

// Sammlungen (F-13) in der Bibliothek: Filterzeile, Einsortieren, Hinzufügen
// mit Zielsammlung. Regeln in @/domain/sammlungen.

type Uebersicht = { name: string; anzahl: number }[];

// Filterzeile: „Alle“, jede Sammlung mit Zahl ihrer Stücke, „+ Sammlung“.
// Eine gerade angelegte, noch leere Sammlung steht mit 0 da, solange sie
// gewählt ist.
export function SammlungenLeiste({ uebersicht, aktiv, waehlen, halten }: {
  uebersicht: Uebersicht; aktiv: string | null; waehlen: (name: string | null) => void;
  // Halten oder Rechtsklick auf einen Chip: Kontext-Blatt der Sammlung (F-08).
  halten: (name: string) => void;
}) {
  const [formular, setFormular] = useState<null | 'neu'>(null);
  const leer = aktiv !== null && !uebersicht.some((s) => gleicheSammlung(s.name, aktiv));
  return (
    <div className="space-y-2">
      <div className="sammlungen" role="group" aria-label="Sammlungen">
        <button type="button" className="sammlung-chip" aria-pressed={aktiv === null} onClick={() => waehlen(null)}>Alle</button>
        {uebersicht.map((s) => (
          <SammlungChip key={s.name} name={s.name} anzahl={s.anzahl} aktiv={aktiv !== null && gleicheSammlung(s.name, aktiv)}
            // Zweiter Tipp auf den gewählten Chip: wie Halten — das Kontext-Blatt (F-20, keine Kopfzeile mehr).
            waehlen={() => (aktiv !== null && gleicheSammlung(s.name, aktiv) ? halten(s.name) : waehlen(s.name))} halten={() => halten(s.name)} />
        ))}
        {leer && <button type="button" className="sammlung-chip" aria-pressed="true">{aktiv}<span className="sammlung-zahl">0</span></button>}
        <button type="button" className="sammlung-chip sammlung-neu" onClick={() => setFormular(formular ? null : 'neu')} aria-expanded={formular === 'neu'}>+ Sammlung</button>
      </div>
      {formular === 'neu' && (
        <NameFormular knopf="Anlegen" platzhalter="z. B. Märsche oder Orchester A" abbrechen={() => setFormular(null)}
          fertig={(name) => { setFormular(null); waehlen(name); }} />
      )}
    </div>
  );
}

function SammlungChip({ name, anzahl, aktiv, waehlen, halten }: { name: string; anzahl: number; aktiv: boolean; waehlen: () => void; halten: () => void }) {
  const geste = useHalten(halten);
  return (
    <button type="button" className="sammlung-chip haltbar" aria-pressed={aktiv} onClick={waehlen} {...geste}>
      {name}<span className="sammlung-zahl">{anzahl}</span>
    </button>
  );
}

function NameFormular({ start = '', knopf, platzhalter, fertig, abbrechen }: {
  start?: string; knopf: string; platzhalter: string; fertig: (name: string) => void; abbrechen: () => void;
}) {
  const [text, setText] = useState(start);
  const name = sammlungName(text);
  return (
    <form className="sammlung-formular" onSubmit={(e) => { e.preventDefault(); if (name) fertig(name); }}>
      <input className="feld" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={platzhalter} aria-label="Name der Sammlung" maxLength={60} />
      <button type="submit" className="knopf knopf-klein" disabled={!name}>{knopf}</button>
      <button type="button" className="text-knopf bib-fertig" onClick={abbrechen}>Abbrechen</button>
    </form>
  );
}

// Kleine Strich-Symbole für das Menü (wie das Zahnrad im Kopf).
function Symbol({ art }: { art: 'dokument' | 'ordner' | 'kamera' | 'bild' | 'stift' }) {
  const pfad = {
    dokument: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
    ordner: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    kamera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
    bild: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></>,
    stift: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /><path d="M14 3v5h5" /><path d="m20.5 12.5-7 7-2.5.5.5-2.5 7-7a1.4 1.4 0 0 1 2 2z" /></>,
  }[art];
  return (
    <svg className="bib-menue-symbol" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {pfad}
    </svg>
  );
}

// „+ Noten“ mit kleinem Menü in drei Zeilen: PDF-Dateien oder ein ganzer
// Ordner (der Browser hat dafür zwei getrennte Dialoge — ein Ordner lässt
// sich aus der Dateiwahl heraus nicht öffnen, darum zwei Hälften), Kamera
// (Einscannen) oder Fotos (F-07), und „Selbst schreiben“ (G-01/G-02/G-03):
// ein Dialog für Schreiben, Einsingen und Audio laden — die Quelle wechselt
// man darin. Nur Symbol und Name, keine Erklärzeilen.
// Ist eine Sammlung gewählt, steht oben unübersehbar, dass neue Stücke dort
// einsortiert werden — mit Schalter zum Abwählen.
export function HinzufuegenMenue({ ziel, einsortieren, setEinsortieren, tagZiel, markieren, setMarkieren, dateien, ordner, scannen, fotos, schreiben, gesperrt }: {
  ziel: string | null; einsortieren: boolean; setEinsortieren: (an: boolean) => void;
  // Gewählter Tag (F-14): neue Stücke damit markieren — genauso sichtbar.
  tagZiel: Tag | null; markieren: boolean; setMarkieren: (an: boolean) => void;
  dateien: () => void; ordner: () => void; scannen: () => void; fotos: () => void; schreiben: () => void; gesperrt: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const menue = useRef<HTMLDivElement>(null);
  // Beim Öffnen einmal ins Bild holen (die Bibliothek scrollt).
  useEffect(() => { if (offen) menue.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [offen]);
  const waehlen = (f: () => void) => { setOffen(false); f(); };
  const punkt = (art: 'dokument' | 'ordner' | 'kamera' | 'bild' | 'stift', name: string, f: () => void) => (
    <button type="button" role="menuitem" className="bib-menue-punkt" onClick={() => waehlen(f)}><Symbol art={art} />{name}</button>
  );
  return (
    <div className="bib-menue-huelle">
      <button type="button" className="knopf knopf-klein" aria-expanded={offen} aria-haspopup="menu" onClick={() => setOffen(!offen)} disabled={gesperrt}
        title={[ziel && einsortieren ? `Neue Stücke kommen in „${ziel}“` : '', tagZiel && markieren ? `Neue Stücke werden mit „${tagZiel.name}“ markiert` : ''].filter(Boolean).join(' · ') || undefined}>
        + Noten{((ziel && einsortieren) || (tagZiel && markieren)) && <span className="ziel-punkt" aria-hidden="true" />}
      </button>
      {offen && (
        <>
          <button type="button" className="nav-fang" aria-label="Menü schließen" onClick={() => setOffen(false)} />
          <div className="bib-menue" role="menu" aria-label="Noten hinzufügen" ref={menue}>
            {ziel && (
              <label className={`bib-menue-ziel ${einsortieren ? 'an' : ''}`}>
                <span>
                  <strong>In „{ziel}“ einsortieren</strong>
                  <span className="block text-xs gedaempft">{einsortieren ? 'Neue Stücke kommen in diese Sammlung.' : 'Neue Stücke kommen in keine Sammlung.'}</span>
                </span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={einsortieren} onChange={(e) => setEinsortieren(e.target.checked)} />
              </label>
            )}
            {tagZiel && (
              <label className={`bib-menue-ziel ${markieren ? 'an' : ''}`}>
                <span>
                  <strong className="inline-flex items-center gap-1.5">Mit <TagPunkt farbe={tagZiel.farbe} />„{tagZiel.name}“ markieren</strong>
                  <span className="block text-xs gedaempft">{markieren ? 'Neue Stücke bekommen diesen Tag.' : 'Neue Stücke bleiben ohne Tag.'}</span>
                </span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={markieren} onChange={(e) => setMarkieren(e.target.checked)} />
              </label>
            )}
            <div className="bib-menue-zeile">
              {punkt('dokument', 'PDF-Dateien', dateien)}
              {punkt('ordner', 'Ordner', ordner)}
            </div>
            <div className="bib-menue-zeile">
              {punkt('kamera', 'Einscannen', scannen)}
              {punkt('bild', 'Fotos', fotos)}
            </div>
            {punkt('stift', 'Selbst schreiben', schreiben)}
          </div>
        </>
      )}
    </div>
  );
}

// Einsortieren: für die gewählten Stücke jede Sammlung an/aus. Haben nur
// manche Stücke eine Sammlung, steht ihr Häkchen halb — antippen setzt sie für alle.
export function SammlungWahl({ noten, uebersicht, speichern, schliessen }: {
  noten: Stueck[]; uebersicht: Uebersicht;
  speichern: (aenderungen: { id: string; sammlungen: string[] }[]) => void; schliessen: () => void;
}) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  type Zustand = 'alle' | 'teils' | 'keine';
  const [namen, setNamen] = useState(() => uebersicht.map((s) => s.name));
  const [stand, setStand] = useState<Record<string, Zustand>>(() => Object.fromEntries(uebersicht.map((s) => {
    const drin = noten.filter((n) => imFilter(n, s.name)).length;
    return [s.name, drin === 0 ? 'keine' : drin === noten.length ? 'alle' : 'teils'];
  })));
  const [neu, setNeu] = useState('');
  const neuerName = sammlungName(neu);

  function anlegen() {
    if (!neuerName) return;
    const da = namen.find((x) => gleicheSammlung(x, neuerName));
    if (!da) setNamen([...namen, neuerName]);
    setStand({ ...stand, [da ?? neuerName]: 'alle' });
    setNeu('');
  }
  function uebernehmen() {
    const aenderungen = noten.map((n) => {
      let l = sammlungenVon(n);
      for (const name of namen) {
        if (stand[name] === 'alle') l = mitSammlung(l, name);
        if (stand[name] === 'keine') l = ohneSammlung(l, name);
      }
      return { id: n.id, sammlungen: l, vorher: sammlungenVon(n) };
    }).filter((a) => a.sammlungen.join('\u0000') !== a.vorher.join('\u0000')).map(({ id, sammlungen }) => ({ id, sammlungen }));
    speichern(aenderungen);
  }
  const titel = noten.length === 1 ? noten[0].titel : `${noten.length} Stücke`;

  // Als Portal an der Seite: aus der Bibliothek heraus läge das Blatt sonst
  // unter der unteren Leiste.
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="In Sammlungen einsortieren" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Sammlungen</h2>
            <p className="gedaempft truncate text-sm">{titel}</p>
          </div>
          <button type="button" className="knopf knopf-klein" onClick={uebernehmen}>Fertig</button>
        </div>
        {namen.length === 0 && <p className="gedaempft text-sm">Noch keine Sammlungen — unten die erste anlegen.</p>}
        <ul className="sammlung-wahl">
          {namen.map((name) => (
            <li key={name}>
              <label>
                <input type="checkbox" className="auswahl-box" checked={stand[name] === 'alle'}
                  ref={(el) => { if (el) el.indeterminate = stand[name] === 'teils'; }}
                  onChange={() => setStand({ ...stand, [name]: stand[name] === 'alle' ? 'keine' : 'alle' })} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {stand[name] === 'teils' && <span className="gedaempft text-xs">bei manchen</span>}
              </label>
            </li>
          ))}
        </ul>
        <form className="sammlung-formular" onSubmit={(e) => { e.preventDefault(); anlegen(); }}>
          <input className="feld" value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Neue Sammlung, z. B. Märsche" aria-label="Neue Sammlung" maxLength={60} />
          <button type="submit" className="knopf knopf-leise knopf-klein" disabled={!neuerName}>Anlegen</button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
