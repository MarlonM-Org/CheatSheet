'use client';

import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  akkordAbc, akkordKlaenge, akkordName, akkordPruefen, akkordText, akkordTransponieren, akkordUndLeiterKlaenge, istAkkord, leiterKlaenge,
  leiterVorschlaege, SCHNELLWAHL, STIMMUNG_NAMEN, tonAusKlasse, tonDeutsch, tonSymbol, type Akkord,
} from '@/domain/akkorde';
import { AbcZeile } from './AbcZeile';
import { useDialogFokus, useEscape } from './tasten';
import { useVorspieler } from './vorspieler';

// Akkord-Spickzettel (I-11): Akkordsymbol eingeben oder antippen, wahlweise
// klingend („der Gitarrist sagt E7“) oder notiert. Gezeigt wird immer der
// notierte Akkord für die Stimmung aus dem Stimmgerät (daneben klingend):
// Töne mit Funktion, Guide Tones hervorgehoben, passende Leitern mit Grund,
// Notenzeile, Anhören. Regeln in @/domain/akkorde.
// Akkordsymbole international (B♭7, B = H), einzelne Töne deutsch (B, H, Es).

export type Eingabe = 'klingend' | 'notiert';

// Grundtöne zum Antippen: die übliche Leadsheet-Schreibweise je Taste.
const GRUNDTOENE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => tonAusKlasse(k, k === 6 ? 'kreuz' : 'be'));

// Text zerlegen in Grundton (wie getippt) und Rest — für die Schnellwahl.
const teile = (text: string) => {
  const m = /^\s*([A-Ha-h](?:bb|b|♭|##|#|♯)?)(.*)$/.exec(text);
  return m ? { grund: m[1], rest: m[2].trim() } : { grund: '', rest: text.trim() };
};

export function SpickzettelBlatt({ schliessen, akkord: anfang, eingabe: anfangsEingabe = 'klingend', ueber = false }: {
  schliessen: () => void;
  /** Akkordsymbol zum Öffnen (ASCII oder mit ♭/♯). */
  akkord?: string;
  /** Wie `akkord` gemeint ist (Standard: klingend). */
  eingabe?: Eingabe;
  /** Liegt über einem anderen Blatt (Jam-Karte): eine Ebene höher. */
  ueber?: boolean;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { spielen, stopp, stimmung } = useVorspieler();
  const [text, setText] = useState(anfang ?? 'C7');
  const [eingabe, setEingabe] = useState<Eingabe>(stimmung === 'C' ? 'notiert' : anfangsEingabe);
  const [leiterNr, setLeiterNr] = useState(0);

  const zu = () => { stopp(); schliessen(); };
  useEscape(zu);

  const gelesen = useMemo(() => akkordPruefen(text), [text]);
  const ok = istAkkord(gelesen) ? gelesen : null;
  const notiert: Akkord | null = ok ? (eingabe === 'notiert' ? ok : akkordTransponieren(ok, stimmung, 'zuNotiert')) : null;
  const klingend: Akkord | null = ok ? (eingabe === 'klingend' ? ok : akkordTransponieren(ok, stimmung, 'zuKlingend')) : null;
  const vorschlaege = notiert ? leiterVorschlaege(notiert) : [];
  const leiter = vorschlaege[Math.min(leiterNr, vorschlaege.length - 1)]?.leiter ?? null;
  const abc = notiert ? akkordAbc(notiert, leiter) : null;
  const hBHinweis = /^\s*B(?![b♭#♯])/.test(text);

  const setzen = (neu: string) => { setText(neu); setLeiterNr(0); };
  const grundWaehlen = (g: string) => setzen(`${g}${teile(text).rest}`);
  const endungWaehlen = (e: string) => {
    const t = teile(text);
    const bass = /\/[A-Ha-h](?:bb|b|♭|##|#|♯)?$/.exec(t.rest)?.[0] ?? '';
    setzen(`${t.grund || 'C'}${e}${bass}`);
  };
  const aktiveEndung = ok ? SCHNELLWAHL.find((s) => {
    const x = akkordPruefen(`C${s.endung}`);
    return istAkkord(x) && JSON.stringify(x.struktur) === JSON.stringify(ok.struktur);
  })?.endung : undefined;
  const aktiverGrund = ok ? teile(text).grund : '';

  const zweiStimmungen = stimmung !== 'C';

  return createPortal(
    <div className={`blatt-hintergrund${ueber ? ' harmonie-ueber' : ''}`} onClick={(e) => { e.stopPropagation(); zu(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Akkord-Spickzettel</h2>
            <p className="gedaempft text-sm">Töne, Guide Tones, Leitern — notiert für {STIMMUNG_NAMEN[stimmung]}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        <div className="harmonie-eingabe">
          {zweiStimmungen && (
            <div className="hoer-gruppe" role="group" aria-label="Ich gebe ein">
              <button type="button" aria-pressed={eingabe === 'klingend'} onClick={() => setEingabe('klingend')}>klingend</button>
              <button type="button" aria-pressed={eingabe === 'notiert'} onClick={() => setEingabe('notiert')}>notiert</button>
            </div>
          )}
          <input className="feld harmonie-feld" value={text} onChange={(e) => setzen(e.target.value)} aria-label="Akkordsymbol"
            placeholder="z. B. Bb7, F#m7, C/E" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
        </div>

        <div className="harmonie-grundtoene" role="group" aria-label="Grundton">
          {GRUNDTOENE.map((g) => {
            const s = tonSymbol(g, true);
            return <button key={s} type="button" aria-pressed={aktiverGrund === s} onClick={() => grundWaehlen(s)}>{tonSymbol(g)}</button>;
          })}
        </div>
        <div className="harmonie-arten" role="group" aria-label="Art">
          {SCHNELLWAHL.map((s) => (
            <button key={s.endung || 'dur'} type="button" aria-pressed={aktiveEndung === s.endung} onClick={() => endungWaehlen(s.endung)}>{s.name}</button>
          ))}
        </div>

        <div className="harmonie-ergebnis" aria-live="polite">
          {notiert && klingend ? (
            <>
              <div className="harmonie-kopfzeile">
                <div>
                  <strong className="harmonie-symbol">{akkordText(notiert)}</strong>
                  {zweiStimmungen && <span className="kennzahl-label">notiert</span>}
                </div>
                {zweiStimmungen && (
                  <div className="harmonie-klingend">
                    <span>{akkordText(klingend)}</span>
                    <span className="kennzahl-label">klingend</span>
                  </div>
                )}
              </div>
              <p className="text-sm">{akkordName(notiert)}</p>
              <ul className="harmonie-toene" aria-label="Akkordtöne">
                {notiert.bass && (
                  <li className="bass"><strong>{tonDeutsch(notiert.bass)}</strong><span>Bass</span></li>
                )}
                {notiert.toene.map((t) => (
                  <li key={t.funktion} className={t.guide ? 'guide' : ''}>
                    <strong>{tonDeutsch(t.ton)}</strong><span>{t.funktion}</span>
                  </li>
                ))}
              </ul>
              <p className="gedaempft text-xs"><span className="harmonie-legende" aria-hidden="true" /> Guide Tones — {notiert.toene.filter((t) => t.guide).map((t) => tonDeutsch(t.ton)).join(' und ')}: sie sagen, welcher Akkord es ist.</p>
            </>
          ) : (
            <div className="harmonie-fehler">
              <strong>{text.trim() ? 'Das verstehe ich nicht.' : 'Akkord eingeben oder antippen.'}</strong>
              {!istAkkord(gelesen) && text.trim() && <span className="text-sm">{gelesen.fehler}</span>}
            </div>
          )}
          {hBHinweis && <p className="harmonie-hinweis text-xs">B im Akkordsymbol ist international = H. Für B♭ (deutsch B) tippe „Bb“.</p>}
        </div>

        {abc && <AbcZeile abc={abc} hoehe={92} label={`Notenzeile ${notiert ? akkordText(notiert) : ''}`} />}

        <div className="hoer-aktionen harmonie-knoepfe">
          <button type="button" className="knopf knopf-leise" disabled={!notiert} onClick={() => notiert && spielen(akkordKlaenge(notiert))}>▶ Akkord</button>
          <button type="button" className="knopf knopf-leise" disabled={!leiter} onClick={() => leiter && spielen(leiterKlaenge(leiter))}>▶ Leiter</button>
          <button type="button" className="knopf breit" disabled={!notiert || !leiter} onClick={() => notiert && leiter && spielen(akkordUndLeiterKlaenge(notiert, leiter))}>▶ Akkord, dann Leiter</button>
        </div>

        {vorschlaege.length > 0 && (
          <div className="space-y-2">
            <span className="kennzahl-label">Passende Leitern</span>
            <ul className="harmonie-leitern" role="radiogroup" aria-label="Leiter">
              {vorschlaege.map((v, i) => (
                <li key={v.leiter.id}>
                  <button type="button" role="radio" aria-checked={leiter?.id === v.leiter.id} onClick={() => setLeiterNr(i)}>
                    <span className="harmonie-leiter-name">{v.leiter.name}{i === 0 && <small> · erste Wahl</small>}</span>
                    <span className="harmonie-leiter-toene">{v.leiter.toene.map((t) => tonDeutsch(t.ton)).join(' ')}</span>
                    <span className="harmonie-leiter-warum">{v.warum}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
