'use client';

import { imFilter } from '@/domain/sammlungen';
import { imTagFilter } from '@/domain/tags';
import { mixAuswahl, mixSchluessel, neueRunde, rundeAbgleichen, rundeLesen, rundeStand, type MixBereich, type Runde } from '@/domain/stellen';
import { gespeichert, speichern } from './klang';
import { alleStellen, alleStuecke, type Stelle, type Stueck } from './lokal';

// Stellen-Mix (F-11): Stellen aus allen Stücken bunt gemischt üben, Runde
// für Runde jede einmal (Regeln in @/domain/stellen). Die Runde liegt auf dem
// Gerät im localStorage — nach einem App-Wechsel geht es an derselben Stelle
// weiter. Sie reist nicht mit der Sicherung.

// Jeder Bereich (alle, eine Sammlung, nur offene — F-13) hat seine eigene Runde.
export const rundeLaden = (b: MixBereich) => rundeLesen(gespeichert<unknown>(mixSchluessel(b), null));
export const rundeSpeichern = (b: MixBereich, r: Runde) => speichern(mixSchluessel(b), r);

export interface MixStand { bereich: MixBereich; runde: Runde; stueckVon: Record<string, string> }

// Die Stellen eines Bereichs. Schon geübte und die aktuelle Stelle der Runde
// bleiben drin, auch wenn sie inzwischen „geschafft“ sind.
export function bereichsStellen(b: MixBereich, noten: Stueck[], stellen: Stelle[], runde: Runde | null = null) {
  const drin = new Set(noten.filter((n) => imFilter(n, b.sammlung) && imTagFilter(n, b.tag)).map((n) => n.id));
  const behalten = new Set(runde ? runde.reihe.slice(0, runde.pos + 1) : []);
  return mixAuswahl(stellen, (notenId) => drin.has(notenId), b.offen, behalten);
}

// Die gespeicherte Runde an die Stellen auf dem Gerät angleichen (oder, ohne
// Runde bzw. mit `neu`, frisch mischen) und speichern.
export async function mixLaden(bereich: MixBereich, neu = false): Promise<MixStand> {
  const [noten, alle] = await Promise.all([alleStuecke(), alleStellen()]);
  const alt = neu ? null : rundeLaden(bereich);
  const stellen = bereichsStellen(bereich, noten, alle, alt);
  const runde = alt ? rundeAbgleichen(alt, stellen) : neueRunde(stellen);
  rundeSpeichern(bereich, runde);
  return { bereich, runde, stueckVon: Object.fromEntries(alle.map((s) => [s.id, s.stueckId])) };
}

// Was der Notenbetrachter im Mix braucht: die Stelle und das Blättern durch
// die Runde (über Stückgrenzen hinweg).
export interface MixSteuerung {
  stelle: string; nr: number; anzahl: number;
  // Name der Sammlung, aus der gemischt wird (null: alle).
  titel: string | null;
  weiter: () => void; zurueck: () => void;
  // Mix verlassen; das Stück bleibt offen.
  beenden: () => void;
  // Stellen wurden angelegt, geändert oder gelöscht.
  abgleichen: () => void;
}

const MischSymbol = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);

// Einstieg in der Bibliothek: mischt, was gerade gefiltert ist (Sammlung),
// auf Wunsch nur offene Stellen.
export function MixKarte({ bereich, tagName, noten, stellen, starten, nurOffen }: {
  bereich: MixBereich; tagName: string | null; noten: Stueck[]; stellen: Stelle[];
  starten: (neu: boolean, bereich: MixBereich) => void; nurOffen: (an: boolean) => void;
}) {
  const runde = rundeLaden(bereich);
  const auswahl = bereichsStellen(bereich, noten, stellen, runde);
  const { anzahl, stuecke, geuebt, fertig } = rundeStand(runde, auswahl);
  const laeuft = geuebt > 0 && !fertig;
  const titel = [bereich.sammlung, tagName].filter(Boolean).join(' · ');
  const wo = titel ? `in „${titel}“` : 'in den Noten';
  const text = !anzahl ? (bereich.offen ? `Keine offenen Stellen ${wo} — alles mit Reserve geschafft oder noch nichts markiert.` : `Markiere Stellen ${wo} — hier übst du sie dann bunt gemischt.`)
    : fertig ? 'Runde geschafft · neu mischen'
    : laeuft ? `Weiter bei ${geuebt + 1} von ${anzahl}`
    : `${anzahl} ${bereich.offen ? 'offene ' : ''}${anzahl === 1 ? 'Stelle' : 'Stellen'} aus ${stuecke} ${stuecke === 1 ? 'Stück' : 'Stücken'}`;
  return (
    <div className="mix-karte">
      <div className="mix-zeile">
        <button type="button" className="mix-start" disabled={!anzahl} onClick={() => starten(fertig, bereich)}>
          <span className="mix-symbol"><MischSymbol /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">Stellen-Mix{titel ? ` · ${titel}` : ''}</span>
            <span className="gedaempft block text-sm">{text}</span>
          </span>
          {!!anzahl && <span className="gedaempft" aria-hidden="true">›</span>}
        </button>
        {laeuft && <button type="button" className="mix-neu" onClick={() => starten(true, bereich)}>Neu mischen</button>}
      </div>
      <label className="mix-offen">
        <span>Nur offene Stellen<small>Ziel + Reserve noch nicht geschafft</small></span>
        <input type="checkbox" role="switch" className="ios-schalter" checked={bereich.offen} onChange={(e) => nurOffen(e.target.checked)} />
      </label>
    </div>
  );
}

// Nach der letzten Stelle einer Runde.
export function MixFertig({ anzahl, titel, neu, zurueck, beenden }: { anzahl: number; titel: string | null; neu: () => void; zurueck: () => void; beenden: () => void }) {
  return (
    <div className="leer">
      <span className="mix-symbol gross"><MischSymbol /></span>
      {anzahl ? (
        <>
          <p className="titel">Runde geschafft</p>
          <p className="gedaempft max-w-xs">Alle {anzahl} {anzahl === 1 ? 'Stelle' : 'Stellen'}{titel ? ` aus „${titel}“` : ''} waren einmal dran. Die nächste Runde mischt neu.</p>
          <button type="button" className="knopf" onClick={neu}>Neue Runde</button>
          <div className="flex gap-2">
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={zurueck}>‹ Letzte Stelle</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={beenden}>Fertig</button>
          </div>
        </>
      ) : (
        <>
          <p className="titel">Keine Stellen</p>
          <p className="gedaempft max-w-xs">{titel ? `In „${titel}“ gibt es gerade keine passenden Stellen. ` : ''}In den Noten mit dem Werkzeug „Stelle“ einen Rahmen um schwierige Takte ziehen — dann kommen sie hier in den Mix.</p>
          <button type="button" className="knopf" onClick={beenden}>Fertig</button>
        </>
      )}
    </div>
  );
}
