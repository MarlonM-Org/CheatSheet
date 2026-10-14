'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { imFilter } from '@/domain/sammlungen';
import {
  mixAuswahl, mixFertigText, mixLeer, mixMenge, mixSchluessel, neueRunde, rundeAbgleichen, rundeLesen, rundeStand, type MixBereich, type Runde,
} from '@/domain/stellen';
import { imTagFilter, type Tag } from '@/domain/tags';
import { gespeichert, speichern } from './klang';
import { alleStellen, alleStuecke, type Stelle, type Stueck } from './lokal';
import { ladeFehler } from './speicherfehler';
import { Stern } from './Stern';
import { TagPunkt } from './Tags';
import { useDialogFokus, useEscape } from './tasten';

// Stellen-Mix (F-11): Stellen aus allen Stücken bunt gemischt üben, Runde
// für Runde jede einmal (Regeln in @/domain/stellen). Die Runde liegt auf dem
// Gerät im localStorage — nach einem App-Wechsel geht es an derselben Stelle
// weiter. Sie reist nicht mit der Sicherung.

// Jeder Bereich (alle, eine Sammlung, ein Tag; nur offene, nur Favoriten) hat seine eigene Runde.
export const rundeLaden = (b: MixBereich) => rundeLesen(gespeichert<unknown>(mixSchluessel(b), null));
export const rundeSpeichern = (b: MixBereich, r: Runde) => speichern(mixSchluessel(b), r);

export interface MixStand { bereich: MixBereich; runde: Runde; stueckVon: Record<string, string> }

// Die Stellen eines Bereichs. Schon geübte und die aktuelle Stelle der Runde
// bleiben drin, auch wenn sie inzwischen „geschafft“ sind oder ihren Stern verloren haben.
export function bereichsStellen(b: MixBereich, noten: Stueck[], stellen: Stelle[], runde: Runde | null = null) {
  const drin = new Set(noten.filter((n) => imFilter(n, b.sammlung) && imTagFilter(n, b.tag)).map((n) => n.id));
  const behalten = new Set(runde ? runde.reihe.slice(0, runde.pos + 1) : []);
  return mixAuswahl(stellen, (notenId) => drin.has(notenId), b, behalten);
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

// „Märsche · Wichtig üben“: Sammlung und Tag, aus denen gemischt wird.
export const mixTitel = (sammlung: string | null, tagName: string | null) => [sammlung, tagName].filter(Boolean).join(' · ') || null;

// Was der Notenbetrachter im Mix braucht: die Stelle und das Blättern durch
// die Runde (über Stückgrenzen hinweg).
export interface MixSteuerung {
  stelle: string; nr: number; anzahl: number;
  // Name der Sammlung bzw. des Tags, aus denen gemischt wird (null: alle).
  titel: string | null;
  bereich: MixBereich;
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

// Die beiden Schalter (nur offene, nur Favoriten) gelten auf dem Gerät und
// bleiben gemerkt — Filter reisen nicht mit der Sicherung (@/domain/einstellungen).
type Nur = { offen: boolean; favoriten: boolean };
const nurLesen = (): Nur => ({ offen: gespeichert('ueben:mix-offen', false), favoriten: gespeichert('ueben:mix-favoriten', false) });
const nurMerken = (n: Nur) => { speichern('ueben:mix-offen', n.offen); speichern('ueben:mix-favoriten', n.favoriten); };

// Stand eines Bereichs: Stellen mit und ohne die Schalter, Runde. Sie läuft,
// wenn schon Stellen dran waren — oder wenn genau dieser Mix gerade offen ist
// (dann heißt es „Weiter bei 1 von 3“, nicht „Mix starten“).
function mixInfo(bereich: MixBereich, noten: Stueck[], stellen: Stelle[], aktiv: MixBereich | null) {
  const runde = rundeLaden(bereich);
  const stand = rundeStand(runde, bereichsStellen(bereich, noten, stellen, runde));
  const gesamt = bereichsStellen({ ...bereich, offen: false, favoriten: false }, noten, stellen).length;
  const offen = aktiv !== null && mixSchluessel(aktiv) === mixSchluessel(bereich);
  return { ...stand, gesamt, laeuft: stand.anzahl > 0 && !stand.fertig && (stand.geuebt > 0 || offen) };
}

// Einstieg in der Bibliothek: eine Zeile („Stellen-Mix · Weiter bei 4 von 9 ›“).
// Tippen öffnet die Optionen; gemischt wird, was gerade gefiltert ist.
export function MixZeile({ sammlung, tag, noten, stellen, starten, aktiv }: {
  sammlung: string | null; tag: Tag | null; noten: Stueck[]; stellen: Stelle[];
  starten: (neu: boolean, bereich: MixBereich) => void; aktiv: MixBereich | null;
}) {
  const [blatt, setBlatt] = useState(false);
  const [nur, setNur] = useState(nurLesen);
  const info = mixInfo({ sammlung, tag: tag?.id ?? null, ...nur }, noten, stellen, aktiv);
  const stand = !info.gesamt || !info.anzahl ? mixLeer(nur, mixTitel(sammlung, tag?.name ?? null), info.gesamt).kurz
    : info.fertig ? 'Runde geschafft'
    : info.laeuft ? `Weiter bei ${info.geuebt + 1} von ${info.anzahl}`
    : mixMenge(info.anzahl, nur, true);
  return (
    <>
      <button type="button" className={`mix-einstieg ${info.gesamt ? '' : 'ohne'}`} aria-haspopup="dialog" aria-expanded={blatt} onClick={() => setBlatt(true)}>
        <span className="mix-symbol klein"><MischSymbol /></span>
        <span className="mix-einstieg-titel">Stellen-Mix</span>
        <span className="mix-einstieg-stand">{stand}</span>
        <span className="bib-pfeil" aria-hidden="true">›</span>
      </button>
      {blatt && (
        <MixBlatt sammlung={sammlung} tag={tag} noten={noten} stellen={stellen} nur={nur} aktiv={aktiv}
          setNur={(n) => { setNur(n); nurMerken(n); }} starten={starten} schliessen={() => setBlatt(false)} />
      )}
    </>
  );
}

// Optionen des Mix: woraus (nur Anzeige — gewählt wird in der Bibliothek),
// nur offene, nur Favoriten, wie viele das sind, und los. Jede Kombination
// hat ihre eigene Runde — der Knopf zeigt ihren Stand.
export function MixBlatt({ sammlung, tag, noten, stellen, nur, setNur, aktiv, starten, schliessen }: {
  sammlung: string | null; tag: Tag | null; noten: Stueck[]; stellen: Stelle[];
  nur: Nur; setNur: (n: Nur) => void; aktiv: MixBereich | null;
  starten: (neu: boolean, bereich: MixBereich) => void; schliessen: () => void;
}) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const bereich: MixBereich = { sammlung, tag: tag?.id ?? null, ...nur };
  const info = mixInfo(bereich, noten, stellen, aktiv);
  const titel = mixTitel(sammlung, tag?.name ?? null);
  const los = (neu: boolean) => { starten(neu, bereich); schliessen(); };

  // Als Portal an der Seite: aus der Bibliothek heraus läge das Blatt sonst
  // unter der unteren Leiste.
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt mix-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <span className="mix-symbol"><MischSymbol /></span>
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Stellen-Mix</h2>
            <p className="gedaempft truncate text-sm">
              {sammlung ? `aus „${sammlung}“` : 'aus allen Noten'}
              {tag && <> · <span className="inline-flex items-center gap-1"><TagPunkt farbe={tag.farbe} klein />{tag.name}</span></>}
            </p>
          </div>
          <button type="button" className="panel-zu" onClick={schliessen} aria-label="Schließen">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        {info.gesamt ? (
          <>
            <ul className="mix-schalter">
              <li>
                <label>
                  <span className="min-w-0 flex-1">Nur offene Stellen<small>Ziel + Reserve noch nicht geschafft</small></span>
                  <input type="checkbox" role="switch" className="ios-schalter" checked={nur.offen} onChange={(e) => setNur({ ...nur, offen: e.target.checked })} />
                </label>
              </li>
              <li>
                <label>
                  <span className="min-w-0 flex-1">Nur Favoriten<small>Stellen mit <Stern an /></small></span>
                  <input type="checkbox" role="switch" className="ios-schalter" checked={nur.favoriten} onChange={(e) => setNur({ ...nur, favoriten: e.target.checked })} />
                </label>
              </li>
            </ul>
            <p className="mix-blatt-zahl" role="status">
              {info.anzahl ? `${mixMenge(info.anzahl, nur)} aus ${info.stuecke} ${info.stuecke === 1 ? 'Stück' : 'Stücken'}` : mixLeer(nur, titel, info.gesamt).lang}
            </p>
            <div className="mix-blatt-knoepfe">
              <button type="button" className="knopf mix-los" disabled={!info.anzahl} onClick={() => los(info.fertig)}>
                {info.fertig ? 'Neue Runde' : info.laeuft ? `Weiter bei ${info.geuebt + 1} von ${info.anzahl}` : 'Mix starten'}
              </button>
              {info.laeuft && <button type="button" className="knopf knopf-leise mix-neu-mischen" onClick={() => los(true)}>Neu mischen</button>}
            </div>
          </>
        ) : (
          <>
            <p>{mixLeer(nur, titel, 0).lang} Stück öffnen → Stift → Werkzeug „Stelle“ → Rahmen um die Takte ziehen.</p>
            <div className="mix-blatt-knoepfe">
              <button type="button" className="knopf mix-los" onClick={schliessen}>Verstanden</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Nach der letzten Stelle einer Runde. Die nächste Runde zählt neu — mit
// „nur offene“ wird sie kleiner, das ist Fortschritt.
export function MixFertig({ anzahl, bereich, tag, starten, zurueck, beenden }: {
  anzahl: number; bereich: MixBereich; tag: Tag | null;
  starten: (neu: boolean, bereich: MixBereich) => void; zurueck: () => void; beenden: () => void;
}) {
  const [daten, setDaten] = useState<{ noten: Stueck[]; stellen: Stelle[] } | null>(null);
  const [optionen, setOptionen] = useState<Nur | null>(null);
  useEffect(() => {
    let weg = false;
    Promise.all([alleStuecke(), alleStellen()]).then(([noten, stellen]) => { if (!weg) setDaten({ noten, stellen }); }, ladeFehler);
    return () => { weg = true; };
  }, []);
  const titel = mixTitel(bereich.sammlung, tag?.name ?? null);
  const naechste = daten ? bereichsStellen(bereich, daten.noten, daten.stellen).length : null;
  const gesamt = daten ? bereichsStellen({ ...bereich, offen: false, favoriten: false }, daten.noten, daten.stellen).length : 0;
  const alles = naechste === 0 && bereich.offen;
  const optionenKnopf = (
    <button type="button" className="knopf knopf-leise" aria-haspopup="dialog" disabled={!daten}
      onClick={() => setOptionen({ offen: bereich.offen, favoriten: bereich.favoriten })}>Optionen …</button>
  );
  return (
    <div className="leer">
      <span className="mix-symbol gross"><MischSymbol /></span>
      {anzahl ? (
        <>
          <p className="titel">{alles ? 'Alles mit Reserve geschafft' : 'Runde geschafft'}</p>
          <p className="gedaempft max-w-xs">{mixFertigText(anzahl, bereich, titel)}</p>
          <div className="mix-fertig-knoepfe">
            {naechste ? (
              <>
                <button type="button" className="knopf" onClick={() => starten(true, bereich)}>Neue Runde · {mixMenge(naechste, { offen: false, favoriten: false })}</button>
                <div className="mix-fertig-zeile">
                  {optionenKnopf}
                  <button type="button" className="knopf knopf-leise" onClick={beenden}>Fertig</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="knopf" onClick={beenden}>Fertig</button>
                {optionenKnopf}
              </>
            )}
            <button type="button" className="text-knopf gedaempft" onClick={zurueck}>‹ Letzte Stelle</button>
          </div>
        </>
      ) : (
        <>
          <p className="titel">Keine Stellen</p>
          <p className="gedaempft max-w-xs">
            {gesamt ? mixLeer(bereich, titel, gesamt).lang
              : `${mixLeer(bereich, titel, 0).lang} In den Noten mit dem Werkzeug „Stelle“ einen Rahmen um schwierige Takte ziehen — dann kommen sie hier in den Mix.`}
          </p>
          <div className="mix-fertig-knoepfe">
            <button type="button" className="knopf" onClick={beenden}>Fertig</button>
            {optionenKnopf}
          </div>
        </>
      )}
      {optionen && daten && (
        <MixBlatt sammlung={bereich.sammlung} tag={tag} noten={daten.noten} stellen={daten.stellen} nur={optionen} aktiv={null}
          setNur={(n) => { setOptionen(n); nurMerken(n); }} starten={starten} schliessen={() => setOptionen(null)} />
      )}
    </div>
  );
}
