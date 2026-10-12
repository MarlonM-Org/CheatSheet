'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gleicheSammlung, imFilter, mitSammlung, ohneSammlung, sammlungenVon, sammlungName } from '@/domain/sammlungen';
import type { LokaleNoten } from './lokal';
import { useDialogFokus, useEscape } from './tasten';

// Sammlungen (F-13) in der Bibliothek: Filterzeile, Einsortieren, Hinzufügen
// mit Zielsammlung. Regeln in @/domain/sammlungen.

type Uebersicht = { name: string; anzahl: number }[];

// Filterzeile: „Alle“, jede Sammlung mit Zahl ihrer Stücke, „+ Sammlung“.
// Eine gerade angelegte, noch leere Sammlung steht mit 0 da, solange sie
// gewählt ist.
export function SammlungenLeiste({ uebersicht, aktiv, waehlen }: {
  uebersicht: Uebersicht; aktiv: string | null; waehlen: (name: string | null) => void;
}) {
  const [formular, setFormular] = useState<null | 'neu'>(null);
  const leer = aktiv !== null && !uebersicht.some((s) => gleicheSammlung(s.name, aktiv));
  return (
    <div className="space-y-2">
      <div className="sammlungen" role="group" aria-label="Sammlungen">
        <button type="button" className="sammlung-chip" aria-pressed={aktiv === null} onClick={() => waehlen(null)}>Alle</button>
        {uebersicht.map((s) => (
          <button key={s.name} type="button" className="sammlung-chip" aria-pressed={aktiv !== null && gleicheSammlung(s.name, aktiv)} onClick={() => waehlen(s.name)}>
            {s.name}<span className="sammlung-zahl">{s.anzahl}</span>
          </button>
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

// Die gewählte Sammlung: deutlich als Filter markiert, mit Umbenennen und Auflösen.
export function SammlungKopf({ name, anzahl, umbenennen, aufloesen }: {
  name: string; anzahl: number; umbenennen: (neu: string) => void; aufloesen: () => void;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  return (
    <div className="sammlung-kopf">
      {bearbeiten ? (
        <>
          <NameFormular start={name} knopf="Umbenennen" platzhalter="Neuer Name" abbrechen={() => setBearbeiten(false)}
            fertig={(neu) => { setBearbeiten(false); if (neu !== name) umbenennen(neu); }} />
          {anzahl > 0 && (
            <button type="button" className="text-knopf bib-loeschen" onClick={() => { setBearbeiten(false); aufloesen(); }}>
              Sammlung auflösen (die {anzahl} {anzahl === 1 ? 'Stück bleibt' : 'Stücke bleiben'} in der Bibliothek)
            </button>
          )}
        </>
      ) : (
        <p className="text-sm">
          <span className="gedaempft">Sammlung</span> <strong>„{name}“</strong> <span className="gedaempft">· {anzahl} {anzahl === 1 ? 'Stück' : 'Stücke'}</span>
          {anzahl > 0 && <button type="button" className="text-knopf bib-fertig ml-2" onClick={() => setBearbeiten(true)}>bearbeiten</button>}
        </p>
      )}
    </div>
  );
}

// „+ Noten“ mit kleinem Menü: PDF-Dateien oder einen ganzen Ordner wählen.
// Ist eine Sammlung gewählt, steht oben unübersehbar, dass neue Stücke dort
// einsortiert werden — mit Schalter zum Abwählen.
export function HinzufuegenMenue({ ziel, einsortieren, setEinsortieren, dateien, ordner, gesperrt }: {
  ziel: string | null; einsortieren: boolean; setEinsortieren: (an: boolean) => void;
  dateien: () => void; ordner: () => void; gesperrt: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const menue = useRef<HTMLDivElement>(null);
  // Beim Öffnen einmal ins Bild holen (die Bibliothek scrollt).
  useEffect(() => { if (offen) menue.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [offen]);
  const waehlen = (f: () => void) => { setOffen(false); f(); };
  return (
    <div className="bib-menue-huelle">
      <button type="button" className="knopf knopf-klein" aria-expanded={offen} aria-haspopup="menu" onClick={() => setOffen(!offen)} disabled={gesperrt}
        title={ziel && einsortieren ? `Neue Stücke kommen in „${ziel}“` : undefined}>
        + Noten{ziel && einsortieren && <span className="ziel-punkt" aria-hidden="true" />}
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
            <button type="button" role="menuitem" className="bib-menue-punkt" onClick={() => waehlen(dateien)}>
              PDF-Dateien wählen<span>eine oder mehrere</span>
            </button>
            <button type="button" role="menuitem" className="bib-menue-punkt" onClick={() => waehlen(ordner)}>
              Ordner wählen<span>alle PDFs darin · Unterordner werden Sammlungen</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Einsortieren: für die gewählten Stücke jede Sammlung an/aus. Haben nur
// manche Stücke eine Sammlung, steht ihr Häkchen halb — antippen setzt sie für alle.
export function SammlungWahl({ noten, uebersicht, speichern, schliessen }: {
  noten: LokaleNoten[]; uebersicht: Uebersicht;
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
