'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  antwortKlaenge, antwortName, bewerten, frageKlaenge, HOER_STANDARD, HOER_UEBUNGEN, hoerEinstellungLesen, optionen, RICHTUNGEN, rundeErzeugen,
  STUFEN_HINWEIS, stufenAnzahl, UEBUNG_NAMEN, wiedergabeText, type Frage, type HoerEinstellung, type HoerUebungId, type Richtung,
} from '@/domain/hoerquiz';
import { gespeichert, speichern } from './klang';
import { skillErgebnis, skillFuerHoerUebung } from './skillspeicher';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';
import type { Klang } from '@/domain/notensatz';

// Hör-Übungen per Antippen (I-08): Intervalle, Dreiklänge, Septakkorde.
// Stufe wählen → Runde mit 10 Fragen: die App spielt, man tippt die Antwort,
// sofort steht da, was es war. Regeln in @/domain/hoerquiz.

const SCHLUESSEL = 'ueben:hoerquiz';
const startwert = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
const prozent = (q: number) => `${Math.round(q * 100)} %`;

const UNTERTITEL: Record<HoerUebungId, string> = {
  intervalle: 'Zwei Töne — wie weit liegen sie auseinander?',
  dreiklaenge: 'Drei Töne zusammen — welcher Dreiklang?',
  septakkorde: 'Vier Töne zusammen — welcher Septakkord?',
};

type Ansicht = 'start' | 'frage' | 'ergebnis';

export function HoerUebungBlatt({ uebung, schliessen, beiErgebnis }: {
  uebung: HoerUebungId;
  schliessen: () => void;
  beiErgebnis?: (r: { uebung: HoerUebungId; stufe: number; quote: number }) => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const stimm = useStimmgeraetApi();
  const metro = useMetronom();
  const [einst, setEinstRoh] = useState<HoerEinstellung>(() => hoerEinstellungLesen(gespeichert<unknown>(SCHLUESSEL, HOER_STANDARD)));
  const [ansicht, setAnsicht] = useState<Ansicht>('start');
  const [fragen, setFragen] = useState<Frage[]>([]);
  const [antworten, setAntworten] = useState<(string | null)[]>([]);
  const [nr, setNr] = useState(0);
  const [hoert, setHoert] = useState<string | null>(null);
  const [rundeStufe, setRundeStufe] = useState(1);
  const vorspiel = useRef<Vorspiel | null>(null);
  const gemeldet = useRef(false);
  const klang = useRef({ st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut });
  useEffect(() => { klang.current = { st: stimm.stimmung, a: stimm.kammerton, laut: metro.laut }; }, [stimm.stimmung, stimm.kammerton, metro.laut]);

  const stufe = einst[uebung].stufe;
  const richtung: Richtung = uebung === 'intervalle' ? einst.intervalle.richtung : 'zusammen';
  const setEin = (neu: HoerEinstellung) => { setEinstRoh(neu); speichern(SCHLUESSEL, neu); };

  const stopp = () => { vorspiel.current?.stopp(); vorspiel.current = null; };
  useEffect(() => () => stopp(), []);
  const spielen = useCallback((k: readonly Klang[]) => {
    stopp();
    vorspiel.current = vorspielen(k, klang.current.st, klang.current.a, klang.current.laut);
  }, []);

  const zu = () => { stopp(); schliessen(); };
  useEscape(zu);

  const frage = fragen[nr];
  const gewaehlt = antworten[nr] ?? null;

  // Jede neue Frage spielt sich selbst.
  useEffect(() => {
    if (ansicht === 'frage' && fragen[nr]) spielen(frageKlaenge(fragen[nr]));
  }, [ansicht, fragen, nr, spielen]);

  const starten = () => {
    const r = rundeErzeugen(uebung, stufe, richtung, startwert());
    gemeldet.current = false;
    setFragen(r);
    setAntworten(r.map(() => null));
    setNr(0);
    setHoert(null);
    setRundeStufe(stufe);
    setAnsicht('frage');
  };

  const antworten_ = (id: string) => {
    if (gewaehlt !== null) return;
    setAntworten((a) => a.map((x, i) => (i === nr ? id : x)));
    setHoert(null);
  };

  const weiter = () => {
    stopp();
    setHoert(null);
    if (nr + 1 < fragen.length) { setNr(nr + 1); return; }
    setAnsicht('ergebnis');
    if (!gemeldet.current) {
      gemeldet.current = true;
      beiErgebnis?.({ uebung, stufe: rundeStufe, quote: bewerten(fragen, antworten).quote });
    }
  };

  const ops = optionen(uebung, ansicht === 'start' ? stufe : rundeStufe);
  const richtigGewaehlt = frage && gewaehlt === frage.antwort;
  const auswertung = ansicht === 'ergebnis' ? bewerten(fragen, antworten) : null;
  const wiederholt = (id: string) => { if (frage) { setHoert(id); spielen(antwortKlaenge(frage, id)); } };

  return createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label={UEBUNG_NAMEN[uebung]} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">{UEBUNG_NAMEN[uebung]}</h2>
            <p className="gedaempft text-sm">{UNTERTITEL[uebung]}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        {ansicht === 'start' && (
          <div className="space-y-4">
            <p className="text-sm">Die App spielt, du tippst, was du hörst. Zehn Fragen pro Runde; nach jeder Antwort siehst du sofort, was es war, und kannst deine Antwort zum Vergleich anhören.</p>
            <div className="space-y-2">
              <span className="kennzahl-label">Stufe</span>
              <div className="ohr-stufen" role="group" aria-label="Stufe">
                {Array.from({ length: stufenAnzahl(uebung) }, (_, i) => i + 1).map((s) => (
                  <button key={s} type="button" aria-pressed={s === stufe}
                    onClick={() => setEin({ ...einst, [uebung]: { ...einst[uebung], stufe: s } } as HoerEinstellung)}>
                    <strong>Stufe {s}</strong>
                    <span>{STUFEN_HINWEIS[uebung][s - 1]}</span>
                  </button>
                ))}
              </div>
            </div>
            {uebung === 'intervalle' && (
              <div className="space-y-2">
                <span className="kennzahl-label">Richtung</span>
                <div className="hoer-gruppe" role="group" aria-label="Richtung">
                  {RICHTUNGEN.map((r) => (
                    <button key={r.id} type="button" aria-pressed={r.id === einst.intervalle.richtung}
                      onClick={() => setEin({ ...einst, intervalle: { ...einst.intervalle, richtung: r.id } })}>{r.name}</button>
                  ))}
                </div>
              </div>
            )}
            <p className="gedaempft text-sm">Zur Wahl: {optionen(uebung, stufe).map((a) => a.name).join(', ')}.</p>
            <button type="button" className="knopf w-full" onClick={starten}>▶ Los</button>
          </div>
        )}

        {ansicht === 'frage' && frage && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <strong>Frage {nr + 1} von {fragen.length}</strong>
              {uebung === 'intervalle' && <span className="gedaempft text-sm">{wiedergabeText(frage.wiedergabe)}</span>}
            </div>
            <div className="hoer-fortschritt" aria-hidden="true">
              {fragen.map((f, i) => (
                <i key={i} className={antworten[i] === null ? (i === nr ? 'jetzt' : '') : antworten[i] === f.antwort ? 'richtig' : 'falsch'} />
              ))}
            </div>
            <div className="hoer-antworten" role="group" aria-label="Antwort">
              {ops.map((a) => {
                const klasse = gewaehlt === null ? '' : a.id === frage.antwort ? 'richtig' : a.id === gewaehlt ? 'falsch' : '';
                return (
                  <button key={a.id} type="button"
                    className={`${klasse}${hoert === a.id ? ' hoert' : ''}`}
                    aria-pressed={gewaehlt === a.id}
                    onClick={() => (gewaehlt === null ? antworten_(a.id) : wiederholt(a.id))}>
                    {a.name}
                    {uebung !== 'dreiklaenge' && a.kurz !== a.name && <small>{a.kurz}</small>}
                  </button>
                );
              })}
            </div>
            <div className={`hoer-rueckmeldung ${gewaehlt === null ? '' : richtigGewaehlt ? 'richtig' : 'falsch'}`} aria-live="polite">
              {gewaehlt === null ? (
                <span className="gedaempft text-sm">Hör zu und tippe, was du hörst.</span>
              ) : richtigGewaehlt ? (
                <strong>Richtig: {antwortName(uebung, frage.antwort)}</strong>
              ) : (
                <>
                  <strong>Es war: {antwortName(uebung, frage.antwort)}</strong>
                  <span className="text-sm">Du hast {antwortName(uebung, gewaehlt)} getippt.</span>
                </>
              )}
            </div>
            <div className="hoer-aktionen">
              <button type="button" className="knopf knopf-leise" onClick={() => spielen(frageKlaenge(frage))}>↻ Nochmal anhören</button>
              <button type="button" className="knopf knopf-leise" disabled={gewaehlt === null || richtigGewaehlt === true}
                onClick={() => gewaehlt && wiederholt(gewaehlt)}>So klingt deine Antwort</button>
              <button type="button" className="knopf breit" disabled={gewaehlt === null} onClick={weiter}>
                {nr + 1 < fragen.length ? 'Weiter' : 'Ergebnis'}
              </button>
            </div>
          </div>
        )}

        {ansicht === 'ergebnis' && auswertung && (
          <div className="space-y-4">
            <div>
              <strong className="ohr-gross">{auswertung.richtig} von {auswertung.gesamt}</strong>
              <p className="gedaempft text-sm">richtig · {prozent(auswertung.quote)} · Stufe {rundeStufe}</p>
            </div>
            <div className="hoer-fortschritt" aria-hidden="true">
              {auswertung.je.map((ok, i) => <i key={i} className={ok ? 'richtig' : 'falsch'} />)}
            </div>
            {auswertung.texte.length > 0 ? (
              <div className="space-y-1">
                <span className="kennzahl-label">Verwechslungen</span>
                <ul className="text-sm space-y-1">
                  {auswertung.texte.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ) : (
              <p className="text-sm">Alles richtig — nichts verwechselt.</p>
            )}
            <div className="hoer-aktionen">
              <button type="button" className="knopf knopf-leise" onClick={() => setAnsicht('start')}>Stufe ändern</button>
              <button type="button" className="knopf" onClick={starten}>Neue Runde</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function HoerSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

// Einstieg auf der Lernen-Seite (B-18): bisher nur über die Skill-Kartei
// erreichbar. Tippen öffnet die Auswahl (Intervalle, Dreiklänge,
// Septakkorde), die Wahl die Übung — jede Runde zählt auf ihren Skill.
// `offenMelden`: die Seite lässt Escape dem offenen Blatt.
export function HoerUebungenZeile({ offenMelden }: { offenMelden?: (offen: boolean) => void }) {
  const [wahl, setWahl] = useState(false);
  const [uebung, setUebung] = useState<HoerUebungId | null>(null);
  const offen = wahl || uebung !== null;
  useEffect(() => { offenMelden?.(offen); }, [offen, offenMelden]);
  return (
    <>
      <button type="button" className="mix-einstieg" aria-haspopup="dialog" aria-expanded={offen} onClick={() => setWahl(true)}>
        <span className="mix-symbol klein"><HoerSymbol /></span>
        <span className="mix-einstieg-titel">Hör-Übungen</span>
        <span className="mix-einstieg-stand">Intervalle · Akkorde</span>
        <span className="bib-pfeil" aria-hidden="true">›</span>
      </button>
      {wahl && <HoerWahlBlatt schliessen={() => setWahl(false)} waehlen={(id) => { setWahl(false); setUebung(id); }} />}
      {uebung && (
        <HoerUebungBlatt uebung={uebung} schliessen={() => setUebung(null)}
          beiErgebnis={(r) => skillErgebnis(skillFuerHoerUebung(r.uebung), r.quote)} />
      )}
    </>
  );
}

function HoerWahlBlatt({ schliessen, waehlen }: { schliessen: () => void; waehlen: (id: HoerUebungId) => void }) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const einst = hoerEinstellungLesen(gespeichert<unknown>(SCHLUESSEL, HOER_STANDARD));
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt mix-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <span className="mix-symbol"><HoerSymbol /></span>
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Hör-Übungen</h2>
            <p className="gedaempft text-sm">Die App spielt, du tippst die Antwort.</p>
          </div>
          <button type="button" className="panel-zu" onClick={schliessen} aria-label="Schließen">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <ul className="hoer-wahl">
          {HOER_UEBUNGEN.map((id) => (
            <li key={id}>
              <button type="button" className="mix-einstieg" onClick={() => waehlen(id)}>
                <span className="min-w-0 flex-1">
                  <span className="mix-einstieg-titel block">{UEBUNG_NAMEN[id]}</span>
                  <span className="bib-unterzeile block">{UNTERTITEL[id]}</span>
                </span>
                <span className="mix-einstieg-stand !flex-none">Stufe {einst[id].stufe} von {stufenAnzahl(id)}</span>
                <span className="bib-pfeil" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
