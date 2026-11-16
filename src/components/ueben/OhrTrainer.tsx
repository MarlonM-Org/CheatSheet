'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EINSTELLUNG_STANDARD, type OhrEinstellung } from '@/domain/einstellungen';
import {
  bewerten, empfehlung, GRUNDTOENE, hinweis, nachbarStufe, naechsterGrundton, phraseErzeugen, phraseKlaenge,
  rundeMerken, STUFEN, vorlaufFuerRunde, stufeFinden, tonBezeichnung, verlaufLesen, zufall, type Ergebnis, type Phrase, type Runde, type StufenId,
} from '@/domain/gehoer';
import { segmentieren, segmentOptionen, type Raster } from '@/domain/notation';
import { GriffeBlatt } from './Griffe';
import { gespeichert, speichern } from './klang';
import { skillErgebnis, skillFuerOhrStufe } from './skillspeicher';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useMikrofonSpur } from './mikrofonspur';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

// Ohr-Trainer (I-01): Die App zählt einen Takt ein und spielt eine kurze
// Phrase vor, dann spielt man sie nach (der Klick läuft weiter), das Mikrofon
// hört zu. Danach: richtig / falsch / fehlt je Ton, im Takt, ein Hinweis.
// Die Noten zeigt erst das Ergebnis — Gehörbildung, kein Vom-Blatt-Spielen.
// Regeln in @/domain/gehoer.

const EINSTELLUNG = 'ueben:ohr';
const VERLAUF = 'ueben:ohr-verlauf';

const verlaufLaden = () => verlaufLesen(gespeichert<unknown>(VERLAUF, []));
const startwert = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
const prozent = (q: number) => `${Math.round(q * 100)} %`;

function OhrSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8.5a6 6 0 1 1 12 0c0 3.5-3 4.5-3 7.5a3.5 3.5 0 0 1-6.5 1.8" />
      <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5" />
    </svg>
  );
}

// Einstieg in der Bibliothek, unter dem Stellen-Mix.
function standText(): string {
  const ein = gespeichert<OhrEinstellung>(EINSTELLUNG, EINSTELLUNG_STANDARD[EINSTELLUNG]);
  const letzte = verlaufLaden().filter((r) => r.stufe === ein.stufe).slice(-5);
  const name = stufeFinden(ein.stufe).name;
  return letzte.length ? `${name} · zuletzt ${prozent(letzte.reduce((s, r) => s + r.quote, 0) / letzte.length)}` : name;
}

// `offenMelden`: die Bibliothek lässt Escape dem offenen Blatt.
export function OhrTrainerZeile({ offenMelden }: { offenMelden?: (offen: boolean) => void }) {
  const [offen, setOffenRoh] = useState(false);
  const setOffen = (o: boolean) => { setOffenRoh(o); offenMelden?.(o); };
  const [stand, setStand] = useState(standText);
  return (
    <>
      <button type="button" className="mix-einstieg" aria-haspopup="dialog" aria-expanded={offen} onClick={() => setOffen(true)}>
        <span className="mix-symbol klein"><OhrSymbol /></span>
        <span className="mix-einstieg-titel">Ohr-Trainer</span>
        <span className="mix-einstieg-stand">{stand}</span>
        <span className="bib-pfeil" aria-hidden="true">›</span>
      </button>
      {offen && <OhrTrainerBlatt schliessen={() => { setOffen(false); setStand(standText()); }} />}
    </>
  );
}

type Ansicht = 'bereit' | 'laeuft' | 'ergebnis';

// `stufe`: mit dieser Stufe öffnen (aus der Skill-Kartei, I-07).
export function OhrTrainerBlatt({ schliessen, stufe: anfangsStufe }: { schliessen: () => void; stufe?: StufenId }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const stimm = useStimmgeraetApi();
  const metro = useMetronom();
  const spur = useMikrofonSpur();
  const [ein, setEinRoh] = useState<OhrEinstellung>(() => {
    const e = gespeichert<OhrEinstellung>(EINSTELLUNG, EINSTELLUNG_STANDARD[EINSTELLUNG]);
    return anfangsStufe ? { ...e, stufe: anfangsStufe } : e;
  });
  const [verlauf, setVerlauf] = useState<Runde[]>(verlaufLaden);
  const [ansicht, setAnsicht] = useState<Ansicht>('bereit');
  const [phrase, setPhrase] = useState<Phrase | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [kopfhoerer, setKopfhoerer] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Griff zu einer Note im Ergebnis (I-13), als Blatt über dem Blatt.
  const [griff, setGriff] = useState<number | null>(null);
  const vorspiel = useRef<Vorspiel | null>(null);
  const stufe = stufeFinden(ein.stufe);

  const setEin = (neu: Partial<OhrEinstellung>) => { const e = { ...ein, ...neu }; setEinRoh(e); speichern(EINSTELLUNG, e); };
  const anhoerenStopp = () => { vorspiel.current?.stopp(); vorspiel.current = null; };
  useEffect(() => () => anhoerenStopp(), []);
  // Eine vorgegebene Stufe gilt auch fürs nächste Öffnen über die Bibliothek.
  useEffect(() => { if (anfangsStufe) speichern(EINSTELLUNG, { ...gespeichert<OhrEinstellung>(EINSTELLUNG, EINSTELLUNG_STANDARD[EINSTELLUNG]), stufe: anfangsStufe }); }, [anfangsStufe]);

  const zu = () => { anhoerenStopp(); if (spur.aktiv) spur.stoppen(false); schliessen(); };
  useEscape(zu, griff === null);

  const runde = (p: Phrase) => {
    anhoerenStopp();
    setFehler(null);
    setPhrase(p);
    setErgebnis(null);
    setAnsicht('laeuft');
    const bpm = ein.bpm;
    const raster: Raster = { bpm, zaehler: 4, nenner: 4, feinheit: 16 };
    void spur.starten({
      raster, lautsprecher: !kopfhoerer, klickWeiter: true,
      metro: { klang: metro.klang, laut: metro.laut },
      stimmung: stimm.stimmung, kammerton: stimm.kammerton,
      einzaehlTakte: 1,
      // Phrase, dann ein Takt Einzählen für die Antwort.
      vorlauf: vorlaufFuerRunde(p, bpm),
      // Ein Takt Luft, falls man spät einsetzt; „Fertig" beendet früher.
      maxTakte: p.takte + 1,
      beiEnde: (rahmen, behalten) => {
        if (!behalten) { setAnsicht('bereit'); return; }
        const st = stufeFinden(p.stufe);
        const stuecke = segmentieren(rahmen, segmentOptionen(st.achtel ? 'rhythmisch' : 'melodisch', raster));
        const e = bewerten(p, stuecke, bpm);
        setErgebnis(e);
        // Skill-Kartei (I-07): die Runde zählt für den Skill dieser Stufe.
        skillErgebnis(skillFuerOhrStufe(p.stufe), e.quote);
        setVerlauf((v) => {
          const neu = rundeMerken(v, { am: Date.now(), stufe: p.stufe, grundton: p.grundton, quote: e.quote });
          speichern(VERLAUF, neu);
          return neu;
        });
        setAnsicht('ergebnis');
      },
      beiFehler: (text) => { setFehler(text); setAnsicht('bereit'); },
    });
  };

  const neuePhrase = () => {
    const s = startwert();
    const grundton = naechsterGrundton(phrase?.grundton ?? ein.grundton, ein.wechseln, zufall(s ^ 0x9e3779b9));
    runde(phraseErzeugen(ein.stufe, ein.wechseln ? grundton : ein.grundton, s));
  };

  const anhoeren = () => {
    if (!phrase) return;
    anhoerenStopp();
    vorspiel.current = vorspielen(phraseKlaenge(phrase, ein.bpm), stimm.stimmung, stimm.kammerton, metro.laut);
  };

  const rat = ansicht === 'ergebnis' ? empfehlung(verlauf, ein.stufe) : null;
  const letzte = verlauf.filter((r) => r.stufe === ein.stufe).slice(-8);

  return createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Ohr-Trainer" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Ohr-Trainer</h2>
            <p className="gedaempft text-sm">Zuhören, nachspielen — ohne Noten, ohne Herumprobieren.</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        {ansicht === 'bereit' && (
          <div className="space-y-4">
            <p className="text-sm">Ein Takt wird eingezählt, dann spielt die App eine kurze Phrase. Danach zählt sie noch einmal ein, und du
              spielst nach — der Klick läuft weiter. Erst innerlich mitsingen, dann spielen und dazu stehen: Fehler korrigierst du in der nächsten Runde.</p>
            <div className="space-y-2">
              <span className="kennzahl-label">Stufe</span>
              <div className="ohr-stufen" role="group" aria-label="Stufe">
                {STUFEN.map((s, i) => (
                  <button key={s.id} type="button" aria-pressed={s.id === ein.stufe} onClick={() => setEin({ stufe: s.id })}>
                    <strong>{i + 1}. {s.name}</strong>
                    <span>{s.hinweis}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="umfang">
              <Stepper titel="Grundton (notiert)" text={tonBezeichnung(ein.grundton)} kleiner={() => setEin({ grundton: Math.max(GRUNDTOENE.von, ein.grundton - 1) })}
                groesser={() => setEin({ grundton: Math.min(GRUNDTOENE.bis, ein.grundton + 1) })} />
              <Stepper titel="Tempo" text={`${ein.bpm}`} kleiner={() => setEin({ bpm: Math.max(40, ein.bpm - 5) })} groesser={() => setEin({ bpm: Math.min(160, ein.bpm + 5) })} />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={ein.wechseln} onChange={(e) => setEin({ wechseln: e.target.checked })} />
              Grundton jede Runde wechseln (transponieren nach Gehör)
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={kopfhoerer} onChange={(e) => setKopfhoerer(e.target.checked)} />
              Mit Kopfhörer (rohes Mikrofon)
            </label>
            {fehler && <p className="text-sm" style={{ color: 'var(--warnung)' }}>{fehler}</p>}
            {letzte.length > 0 && <p className="gedaempft text-sm">Zuletzt auf dieser Stufe: {letzte.map((r) => prozent(r.quote)).join(' · ')}</p>}
            <button type="button" className="knopf w-full" onClick={neuePhrase}>▶ Los</button>
          </div>
        )}

        {ansicht === 'laeuft' && (
          <div className="ohr-lauf" aria-live="polite">
            {spur.phase === 'nimmt' ? (
              <>
                <strong className="ohr-gross">Jetzt du!</strong>
                <span className="gedaempft">Takt {spur.anzeige.takt ?? 1} · {spur.anzeige.ton || '…'}</span>
              </>
            ) : spur.anzeige.vor === 1 ? (
              <>
                <strong className="ohr-gross">{4 + 1 - (spur.anzeige.zaehlt ?? 4)}</strong>
                <span className="gedaempft">Gleich du — mitzählen, auf 1 einsetzen</span>
              </>
            ) : spur.anzeige.vor ? (
              <>
                <strong className="ohr-gross">Hör zu …</strong>
                <span className="gedaempft">dann ein Takt Einzählen</span>
              </>
            ) : (
              <>
                <strong className="ohr-gross">{spur.anzeige.zaehlt ?? ''}</strong>
                <span className="gedaempft">Einzählen</span>
              </>
            )}
            <div className="flex gap-2">
              <button type="button" className="knopf knopf-leise" onClick={() => spur.stoppen(false)}>Abbrechen</button>
              {spur.phase === 'nimmt' && <button type="button" className="knopf" onClick={() => spur.stoppen(true)}>Fertig gespielt</button>}
            </div>
          </div>
        )}

        {ansicht === 'ergebnis' && ergebnis && phrase && (
          <div className="space-y-4">
            <div>
              <strong className="ohr-gross">{ergebnis.richtig} von {ergebnis.noten.length}</strong>
              <p className="gedaempft text-sm">
                richtig · {ergebnis.imTakt} im Takt{ergebnis.zuviel ? ` · ${ergebnis.zuviel} zu viel` : ''} · {stufe.name}, Grundton {tonBezeichnung(phrase.grundton)}
              </p>
            </div>
            <ol className="ohr-noten" aria-label="Töne">
              {ergebnis.noten.map((b, i) => (
                <li key={i}>
                  <button type="button" className={`ohr-note ${b.art}`} aria-haspopup="dialog" onClick={() => setGriff(b.ziel)}
                    aria-label={`${tonBezeichnung(b.ziel)} ${b.art} — Griff zeigen`} title="Griff zeigen">
                    <strong>{tonBezeichnung(b.ziel)}</strong>
                    <span>{b.gespielt === null ? '—' : b.art === 'richtig' ? (b.oktave ? '8va' : '✓') : tonBezeichnung(b.gespielt)}</span>
                    {b.art === 'richtig' && !b.imTakt && <em>Takt</em>}
                  </button>
                </li>
              ))}
            </ol>
            <p className="text-sm">{hinweis(ergebnis)}</p>
            {rat && (
              <div className="ohr-rat">
                <span className="text-sm">{rat === 'hoch' ? 'Fünf starke Runden — weiter zur nächsten Stufe?' : 'Gerade zäh — eine Stufe zurück festigt das Gehör.'}</span>
                <button type="button" className="knopf knopf-klein" onClick={() => setEin({ stufe: nachbarStufe(ein.stufe, rat) })}>
                  {stufeFinden(nachbarStufe(ein.stufe, rat)).name}
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="knopf knopf-leise" onClick={anhoeren}>▶ Anhören</button>
              <button type="button" className="knopf knopf-leise" onClick={() => runde(phrase)}>↻ Nochmal</button>
              <button type="button" className="knopf" onClick={neuePhrase}>Neue Phrase</button>
            </div>
            <button type="button" className="knopf knopf-leise knopf-klein w-full" onClick={() => setAnsicht('bereit')}>Stufe und Tempo</button>
          </div>
        )}
        {griff !== null && <GriffeBlatt midi={griff} schliessen={() => setGriff(null)} />}
      </div>
    </div>,
    document.body,
  );
}

function Stepper({ titel, text, kleiner, groesser }: { titel: string; text: string; kleiner: () => void; groesser: () => void }) {
  return (
    <div className="ton-stepper">
      <span className="kennzahl-label">{titel}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="rund-knopf klein" onClick={kleiner} aria-label={`${titel} kleiner`}>−</button>
        <strong className="min-w-[3.2rem] text-center tabular-nums">{text}</strong>
        <button type="button" className="rund-knopf klein" onClick={groesser} aria-label={`${titel} größer`}>+</button>
      </span>
    </div>
  );
}
