'use client';

import { neueRunde, rundeAbgleichen, rundeLesen, rundeStand, type Runde } from '@/domain/stellen';
import { gespeichert, speichern } from './klang';
import { alleStellen, type LokaleStelle } from './lokal';

// Stellen-Mix (F-11): Stellen aus allen Stücken bunt gemischt üben, Runde
// für Runde jede einmal (Regeln in @/domain/stellen). Die Runde liegt auf dem
// Gerät im localStorage — nach einem App-Wechsel geht es an derselben Stelle
// weiter. Sie reist nicht mit der Sicherung.

const RUNDE = 'ueben:mix';
export const rundeLaden = () => rundeLesen(gespeichert<unknown>(RUNDE, null));
export const rundeSpeichern = (r: Runde) => speichern(RUNDE, r);

export interface MixStand { runde: Runde; stueckVon: Record<string, string> }

// Die gespeicherte Runde an die Stellen auf dem Gerät angleichen (oder, ohne
// Runde bzw. mit `neu`, frisch mischen) und speichern.
export async function mixLaden(neu = false): Promise<MixStand> {
  const stellen = await alleStellen();
  const alt = neu ? null : rundeLaden();
  const runde = alt ? rundeAbgleichen(alt, stellen) : neueRunde(stellen);
  rundeSpeichern(runde);
  return { runde, stueckVon: Object.fromEntries(stellen.map((s) => [s.id, s.notenId])) };
}

// Was der Notenbetrachter im Mix braucht: die Stelle und das Blättern durch
// die Runde (über Stückgrenzen hinweg).
export interface MixSteuerung {
  stelle: string; nr: number; anzahl: number;
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

// Einstieg in der Bibliothek.
export function MixKarte({ stellen, starten }: { stellen: LokaleStelle[]; starten: (neu: boolean) => void }) {
  const stand = rundeStand(rundeLaden(), stellen);
  const { anzahl, stuecke, geuebt, fertig } = stand;
  const laeuft = geuebt > 0 && !fertig;
  const text = !anzahl ? 'Markiere Stellen in den Noten — hier übst du sie dann bunt gemischt aus allen Stücken.'
    : fertig ? 'Runde geschafft · neu mischen'
    : laeuft ? `Weiter bei ${geuebt + 1} von ${anzahl}`
    : `${anzahl} ${anzahl === 1 ? 'Stelle' : 'Stellen'} aus ${stuecke} ${stuecke === 1 ? 'Stück' : 'Stücken'}`;
  return (
    <div className="mix-karte">
      <button type="button" className="mix-start" disabled={!anzahl} onClick={() => starten(fertig)}>
        <span className="mix-symbol"><MischSymbol /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Stellen-Mix</span>
          <span className="gedaempft block text-sm">{text}</span>
        </span>
        {!!anzahl && <span className="gedaempft" aria-hidden="true">›</span>}
      </button>
      {laeuft && <button type="button" className="mix-neu" onClick={() => starten(true)}>Neu mischen</button>}
    </div>
  );
}

// Nach der letzten Stelle einer Runde.
export function MixFertig({ anzahl, neu, zurueck, beenden }: { anzahl: number; neu: () => void; zurueck: () => void; beenden: () => void }) {
  return (
    <div className="leer">
      <span className="mix-symbol gross"><MischSymbol /></span>
      {anzahl ? (
        <>
          <p className="titel">Runde geschafft</p>
          <p className="gedaempft max-w-xs">Alle {anzahl} {anzahl === 1 ? 'Stelle' : 'Stellen'} waren einmal dran. Die nächste Runde mischt neu.</p>
          <button type="button" className="knopf" onClick={neu}>Neue Runde</button>
          <div className="flex gap-2">
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={zurueck}>‹ Letzte Stelle</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={beenden}>Fertig</button>
          </div>
        </>
      ) : (
        <>
          <p className="titel">Keine Stellen</p>
          <p className="gedaempft max-w-xs">In den Noten mit dem Werkzeug „Stelle“ einen Rahmen um schwierige Takte ziehen — dann kommen sie hier in den Mix.</p>
          <button type="button" className="knopf" onClick={beenden}>Fertig</button>
        </>
      )}
    </div>
  );
}
