'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { akkordText, STIMMUNG_NAMEN, tonDeutsch, tonKlasse } from '@/domain/akkorde';
import {
  akkordeAufbereiten, akkordeLesen, droneFarbeFuer, schrittText, schrittWeiter, spielhilfeSchritte, type AkkordEingabe,
} from '@/domain/spielhilfe';
import { useDrone } from './Drone';
import { stelleAendern, type Stelle } from './lokal';
import { speicherFehler } from './speicherfehler';
import { SpickzettelBlatt } from './Spickzettel';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

// Spielhilfe in deinen Noten (I-15). Zwei Teile:
//  • SpielhilfeStreifen — beim Üben einer Stelle mit Akkorden ein kleiner
//    Streifen über der Stellen-Leiste (liegt über den Noten, verschiebt
//    nichts): Akkord groß, notiert für die Stimmung aus dem Stimmgerät,
//    Akkordtöne mit Guide Tones, ‹ › Akkord für Akkord (rundherum, zum
//    Loopen — welcher Takt gerade klingt, weiß die App nicht), Drone auf dem
//    Grundton (nur per Tipp), Tipp auf den Akkord öffnet den Spickzettel.
//  • AkkordeBlatt — Akkorde der Stelle eintragen (klingend oder notiert),
//    liegt über dem Stellen-Blatt.
// Keine Begleitspur (Leitbild). Regeln in @/domain/spielhilfe.

export function SpielhilfeStreifen({ stelle }: { stelle: Pick<Stelle, 'akkorde'> }) {
  const { stimmung } = useStimmgeraetApi();
  const schritte = useMemo(() => spielhilfeSchritte(akkordeLesen(stelle.akkorde), stimmung), [stelle.akkorde, stimmung]);
  const [pos, setPos] = useState(0);
  const [klein, setKlein] = useState(false);
  const [spick, setSpick] = useState(false);
  const drone = useDrone();
  // Ändern sich die Akkorde (Stellen-Blatt), folgt eine laufende Drone dem gezeigten Akkord.
  const aktuell = schritte.length ? schritte[Math.min(pos, schritte.length - 1)].notiert : null;
  const droneGrund = aktuell ? tonKlasse(aktuell.grund) : null, droneFarbe = aktuell ? droneFarbeFuer(aktuell) : null;
  const { laeuft: droneLaeuft, aendern: droneAendern } = drone;
  useEffect(() => {
    if (droneLaeuft && droneGrund !== null && droneFarbe) droneAendern({ grundton: droneGrund, farbe: droneFarbe });
  }, [droneLaeuft, droneGrund, droneFarbe, droneAendern]);
  if (!schritte.length) return null;
  const nr = Math.min(pos, schritte.length - 1);
  const s = schritte[nr];
  const takte = schritte[schritte.length - 1].takt;
  const zweiStimmungen = stimmung !== 'C';
  const droneFuer = (i: number) => ({ grundton: tonKlasse(schritte[i].notiert.grund), farbe: droneFarbeFuer(schritte[i].notiert) });

  const gehen = (richtung: 1 | -1) => {
    const neu = schrittWeiter(nr, schritte.length, richtung);
    setPos(neu);
    if (drone.laeuft) drone.aendern(droneFuer(neu));
  };
  const droneUmschalten = () => (drone.laeuft ? drone.stoppen() : drone.starten(droneFuer(nr)));

  return (
    <>
      {klein ? (
        <button type="button" className="sh-klein" onClick={() => setKlein(false)} aria-label={`Spielhilfe zeigen (${akkordText(s.notiert)})`}>
          <span aria-hidden="true">♪</span> {akkordText(s.notiert)}{drone.laeuft && <span className="sh-punkt" aria-hidden="true" />}
        </button>
      ) : (
        <div className="sh-streifen" role="group" aria-label="Spielhilfe: Akkorde der Stelle">
          <button type="button" className="sh-pfeil" onClick={() => gehen(-1)} aria-label="Voriger Akkord" disabled={schritte.length < 2}>‹</button>
          <button type="button" className="sh-akkord" onClick={() => setSpick(true)} title="Im Akkord-Spickzettel öffnen">
            <span className="sh-kopf">
              <strong className="sh-symbol">{akkordText(s.notiert)}</strong>
              <span className="sh-takt tabular-nums">
                <span>{schrittText(s, takte)}</span>
                {zweiStimmungen && <span>klingend {akkordText(s.klingend)}</span>}
              </span>
            </span>
            <span className="sh-toene" aria-label="Akkordtöne, Guide Tones hervorgehoben">
              {s.notiert.toene.map((t) => <span key={t.funktion} className={t.guide ? 'guide' : ''}>{tonDeutsch(t.ton)}</span>)}
            </span>
          </button>
          <div className="sh-rechts">
            <button type="button" className="sh-drone" aria-pressed={drone.laeuft} onClick={droneUmschalten}
              aria-label={drone.laeuft ? 'Drone aus' : `Drone auf ${tonDeutsch(s.notiert.grund)}`} title="Liegeton auf dem Grundton">∿</button>
            <button type="button" className="sh-zu" onClick={() => setKlein(true)} aria-label="Spielhilfe verkleinern">–</button>
          </div>
          <button type="button" className="sh-pfeil" onClick={() => gehen(1)} aria-label="Nächster Akkord" disabled={schritte.length < 2}>›</button>
        </div>
      )}
      {spick && <SpickzettelBlatt schliessen={() => setSpick(false)} akkord={akkordText(s.notiert, { ascii: true })} eingabe="notiert" />}
    </>
  );
}

export function AkkordeBlatt({ stelle, schliessen, gespeichert }: {
  stelle: Pick<Stelle, 'id' | 'akkorde' | 'titel' | 'seite'>; schliessen: () => void; gespeichert: () => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { stimmung } = useStimmgeraetApi();
  const bisher = akkordeLesen(stelle.akkorde);
  const [text, setText] = useState(bisher?.text ?? '');
  const [eingabe, setEingabe] = useState<AkkordEingabe>(bisher?.eingabe ?? (stimmung === 'C' ? 'notiert' : 'klingend'));
  const [hinweis, setHinweis] = useState('');
  useEscape(schliessen);

  const ergebnis = akkordeAufbereiten(text, eingabe);
  const vorschau = ergebnis.wert ? spielhilfeSchritte(ergebnis.wert, stimmung) : [];
  const zweiStimmungen = stimmung !== 'C';

  async function sichern(wert: { text: string; eingabe: AkkordEingabe }) {
    try { await stelleAendern(stelle.id, { akkorde: wert }); } catch (x) { speicherFehler(x); return; }
    gespeichert();
    schliessen();
  }
  const speichern = () => {
    if (!ergebnis.wert) { setHinweis('Erst die unlesbaren Akkorde korrigieren.'); return; }
    void sichern(ergebnis.wert);
  };

  return createPortal(
    <div className="blatt-hintergrund harmonie-ueber" onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt sh-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Akkorde</h2>
            <p className="gedaempft truncate text-sm">{stelle.titel || `Stelle auf Seite ${stelle.seite}`} · Spielhilfe, Akkorde je Takt</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Abbrechen</button>
        </div>
        {zweiStimmungen && (
          <div className="hoer-gruppe" role="group" aria-label="Ich gebe ein">
            <button type="button" aria-pressed={eingabe === 'klingend'} onClick={() => setEingabe('klingend')}>klingend</button>
            <button type="button" aria-pressed={eingabe === 'notiert'} onClick={() => setEingabe('notiert')}>notiert ({STIMMUNG_NAMEN[stimmung]})</button>
          </div>
        )}
        <textarea className="feld sh-eingabe" value={text} rows={3} onChange={(e) => { setText(e.target.value); setHinweis(''); }}
          aria-label="Akkorde je Takt" placeholder="| Cm7 F7 | Bbmaj7 | % |" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
        <p className="gedaempft text-xs">Takte mit | trennen, Akkorde im Takt mit Leerzeichen, % wiederholt den Takt. Ohne | ist jeder Akkord ein Takt. B = H, B♭ als „Bb“.</p>
        <div className="sh-vorschau" aria-live="polite">
          {ergebnis.fehler.length ? (
            <p className="sh-fehler text-sm"><strong>Nicht lesbar:</strong> {ergebnis.fehler.join(' · ')}</p>
          ) : vorschau.length ? (
            <>
              <span className="kennzahl-label">Für dich notiert{zweiStimmungen ? ` (${STIMMUNG_NAMEN[stimmung]})` : ''} · {ergebnis.takte} {ergebnis.takte === 1 ? 'Takt' : 'Takte'}</span>
              <p className="sh-folge">| {takteText(vorschau).join(' | ')} |</p>
            </>
          ) : (
            <p className="gedaempft text-sm">{bisher?.text ? 'Leer speichern entfernt die Akkorde.' : 'Noch keine Akkorde.'}</p>
          )}
        </div>
        {hinweis && <p className="text-sm" role="alert">{hinweis}</p>}
        <div className="flex gap-2">
          <button type="button" className="knopf flex-1" onClick={speichern} disabled={!!ergebnis.fehler.length}>Speichern</button>
          {bisher?.text && <button type="button" className="knopf knopf-leise" onClick={() => void sichern({ text: '', eingabe })}>Entfernen</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Notierte Akkorde je Takt als Text („Dm7 G7“).
function takteText(schritte: ReturnType<typeof spielhilfeSchritte>): string[] {
  const takte: string[][] = [];
  for (const s of schritte) (takte[s.takt - 1] ??= []).push(akkordText(s.notiert));
  return takte.map((t) => t.join(' '));
}
