'use client';
// Die Aufnahmeleiste (G-05): in ein geschriebenes Stück hinein aufnehmen.
// Schwebt unten über dem Notenblatt (Portal), das Blatt bleibt sichtbar.
// Ablauf je Abschnitt: scharf (Zieltakt, Lesart, Vorlauf) → ● → Vorlauf
// (Takte davor vorgespielt, Klick läuft; bei Takt 1 ein Einzähltakt) →
// Aufnahme → ■ → prüfen (die erkannten Takte liegen als Vorschau im Blatt,
// Einfügen oder Ersetzen, − +, Lesart umlegbar) → Übernehmen schreibt sie
// als einen Rückgängig-Schritt; die Leiste steht danach auf dem Folgetakt.
// Konzept und Begründungen: reports/Einspielen im Stück UX.md.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LESARTEN, rastern, versatzSchaetzen, type Lesart, type Raster, type Stimme, type Takt, type Tonart, type Tonrahmen } from '@/domain/notation';
import { leererTakt, skalieren } from '@/domain/notensatz';
import { abschnittKuerzen, nachlaufKuerzen, takteEinsetzen, vorgabeArt, vorlaufKlaenge, type EinsetzArt } from '@/domain/taktaufnahme';
import { schlaegeJeTakt, taktartText } from '@/domain/takt';
import type { Stimmung } from '@/domain/ueben';
import { gespeichert, speichern, type Klang as MetronomKlang } from './klang';
import { useMikrofonSpur } from './mikrofonspur';

const VORLAUF_SCHLUESSEL = 'ueben:einspiel-vorlauf';
const BEGLEITUNG_SCHLUESSEL = 'ueben:einspiel-begleitung';
// Längste Aufnahme je Abschnitt in Takten.
const MAX_TAKTE = 32;

export type LeistenZustand = 'scharf' | 'zaehlt' | 'nimmt' | 'pruefen';
export interface Vorschau { stimmen: Stimme[]; von: number; bis: number }

export function Aufnahmeleiste({ stimmen, aktiv, stumm, auswahlTakt, raster, blattRaster, tonart, lesart, setLesart, lautsprecher, setLautsprecher,
  metro, stimmung, kammerton, vorschauAendern, zustandAendern, uebernehmen, schliessen }: {
  stimmen: Stimme[]; aktiv: number; stumm: number[]; auswahlTakt: number | null;
  raster: Raster; blattRaster: Raster; tonart: Tonart | null;
  lesart: Lesart; setLesart: (l: Lesart) => void;
  lautsprecher: boolean; setLautsprecher: (an: boolean) => void;
  metro: { klang: MetronomKlang; laut: number }; stimmung: Stimmung; kammerton: number;
  // Die Vorschau fürs Blatt (null: keine) und der Zustand (zum Sperren der Palette).
  vorschauAendern: (v: Vorschau | null) => void;
  zustandAendern: (z: LeistenZustand) => void;
  // Übernehmen: die neuen Stimmen und der Takt, auf dem die Leiste danach steht.
  uebernehmen: (stimmen: Stimme[], naechsterTakt: number) => void;
  schliessen: () => void;
}) {
  const takte = stimmen[aktiv]?.takte ?? [];
  const [zustand, setZustand] = useState<LeistenZustand>('scharf');
  const [zielTakt, setZielTakt] = useState(() => auswahlTakt ?? takte.length);
  // Antippen im Blatt setzt den Zieltakt, solange nichts läuft (abgeleitet, kein Effekt).
  const [letzteAuswahl, setLetzteAuswahl] = useState(auswahlTakt);
  if (auswahlTakt !== letzteAuswahl) { setLetzteAuswahl(auswahlTakt); if (zustand === 'scharf' && auswahlTakt !== null) setZielTakt(auswahlTakt); }
  const [vorlauf, setVorlaufRoh] = useState(() => { const v = gespeichert<number>(VORLAUF_SCHLUESSEL, 1); return v === 0 || v === 2 ? v : 1; });
  const setVorlauf = (v: number) => { setVorlaufRoh(v); speichern(VORLAUF_SCHLUESSEL, v); };
  const [begleitung, setBegleitungRoh] = useState(() => gespeichert(BEGLEITUNG_SCHLUESSEL, false));
  const setBegleitung = (an: boolean) => { setBegleitungRoh(an); speichern(BEGLEITUNG_SCHLUESSEL, an); };
  const [menue, setMenue] = useState(false);
  const [fehler, setFehler] = useState('');
  // Die Spur des Abschnitts, schon um die Latenz vorgezogen.
  const [spur, setSpur] = useState<Tonrahmen[]>([]);
  const [artWahl, setArtWahl] = useState<EinsetzArt | null>(null); // null: Vorgabe aus dem Blatt
  const [anzahl, setAnzahl] = useState<number | null>(null); // null: alle erkannten
  const [gesperrt, setGesperrt] = useState(false);          // Entprellen nach ■
  // Latenz der Sitzung: bei kurzen Abschnitten (wenige Tonwechsel) gilt der letzte gemessene Wert.
  const [letzterVersatz, setLetzterVersatz] = useState(0);

  const mikrofon = useMikrofonSpur();
  useEffect(() => { zustandAendern(zustand); }, [zustand, zustandAendern]);

  // ── Vorschlag aus der Spur ──
  const erkannt = useMemo<{ takte: Takt[]; nachklangWeg: boolean }>(() => {
    if (zustand !== 'pruefen' || !spur.length) return { takte: [], nachklangWeg: false };
    const roh = skalieren(rastern(spur, raster, { tonart, lesart }), raster.feinheit);
    const gekuerzt = nachlaufKuerzen(roh, blattRaster);
    return { takte: gekuerzt, nachklangWeg: gekuerzt.length < roh.length };
  }, [zustand, spur, raster, blattRaster, tonart, lesart]);
  const n = Math.min(anzahl ?? erkannt.takte.length, erkannt.takte.length);
  const art: EinsetzArt = artWahl ?? vorgabeArt(takte, zielTakt, erkannt.takte.length || 1);
  const setArt = setArtWahl;
  const vorschau = useMemo<Vorschau | null>(() => {
    if (zustand !== 'pruefen' || !n) return null;
    const e = takteEinsetzen(stimmen, aktiv, zielTakt, abschnittKuerzen(erkannt.takte, n, blattRaster), art, blattRaster);
    return { stimmen: e.stimmen, von: e.von, bis: e.bis };
  }, [zustand, n, stimmen, aktiv, zielTakt, erkannt.takte, art, blattRaster]);
  useEffect(() => { vorschauAendern(vorschau); }, [vorschau, vorschauAendern]);

  // ── Aufnehmen ──
  const starten = useCallback(() => {
    setFehler('');
    const vorlaufTakte = Math.min(vorlauf, zielTakt);
    const klaenge = vorlaufKlaenge(stimmen, blattRaster, new Set(stumm), aktiv, zielTakt, vorlaufTakte, begleitung);
    void mikrofon.starten({
      raster, lautsprecher, klickWeiter: true, metro, stimmung, kammerton,
      einzaehlTakte: vorlaufTakte ? 0 : 1,
      vorlauf: vorlaufTakte ? { klaenge, takte: vorlaufTakte } : null,
      maxTakte: MAX_TAKTE,
      beiPhase: setZustand,
      beiEnde: (liste, ok) => {
        if (ok) {
          const gemessen = versatzSchaetzen(liste, raster);
          const versatz = gemessen || letzterVersatz;
          if (gemessen) setLetzterVersatz(gemessen);
          setSpur(versatz ? liste.map((f) => ({ ...f, zeit: f.zeit - versatz })) : liste);
          setArtWahl(null); setAnzahl(null);
          setZustand('pruefen');
          setGesperrt(true); window.setTimeout(() => setGesperrt(false), 500);
        } else setZustand('scharf');
      },
      beiFehler: (t) => { setFehler(t); setZustand('scharf'); },
    });
  }, [vorlauf, zielTakt, stimmen, blattRaster, stumm, aktiv, begleitung, mikrofon, raster, lautsprecher, metro, stimmung, kammerton, letzterVersatz]);
  const stoppen = () => mikrofon.stoppen(zustand === 'nimmt');
  const verwerfen = () => { setSpur([]); setZustand('scharf'); };
  const nochmal = () => { setSpur([]); setZustand('scharf'); starten(); };
  const fertig = () => {
    if (!vorschau) return;
    const weiter = zielTakt + n;
    uebernehmen(vorschau.stimmen, weiter);
    setSpur([]); setZielTakt(weiter); setZustand('scharf');
  };
  // Ohne Ton: einen leeren Takt einsetzen, zum Schreiben von Hand.
  const leerenTakt = () => {
    const e = takteEinsetzen(stimmen, aktiv, zielTakt, [leererTakt(blattRaster)], 'einfuegen', blattRaster);
    uebernehmen(e.stimmen, zielTakt + 1);
    setSpur([]); setZielTakt(zielTakt + 1); setZustand('scharf');
  };
  useEffect(() => () => vorschauAendern(null), [vorschauAendern]);

  const anhaengen = zielTakt >= takte.length;
  const taktText = anhaengen ? 'Anhängen' : `Takt ${zielTakt + 1}`;
  const jeTakt = schlaegeJeTakt(raster.zaehler, raster.nenner);
  const stimmeText = stimmen.length > 1 ? ` · ${stimmen[aktiv]?.name || `Stimme ${aktiv + 1}`}` : '';
  const vorlaufText = zielTakt === 0 || vorlauf === 0 ? 'Einzähler, dann singen' : `Vorlauf: ${vorlauf === 1 ? `Takt ${zielTakt}` : `Takte ${Math.max(1, zielTakt - 1)}–${zielTakt}`} wird vorgespielt, dann singen`;
  const a = mikrofon.anzeige;
  const laeuft = zustand === 'zaehlt' || zustand === 'nimmt';

  return createPortal(
    <div className="aufnahme-leiste" role="region" aria-label="Aufnehmen im Stück">
      <div className="aufnahme-kopf">
        {zustand === 'pruefen'
          ? <button type="button" className="einspiel-aufnahme klein" onClick={nochmal} disabled={gesperrt} aria-label="Nochmal aufnehmen" title="Nochmal: gleicher Zieltakt, der Vorschlag verfällt"><span className="aufnahme-nochmal" aria-hidden="true">↻</span></button>
          : laeuft
            ? <button type="button" className={`einspiel-aufnahme klein ${zustand === 'nimmt' ? 'nimmt' : ''}`} onClick={stoppen} aria-label={zustand === 'nimmt' ? 'Aufnahme beenden' : 'Vorlauf abbrechen'}><span className="einspiel-stopp" aria-hidden="true" /></button>
            : <button type="button" className="einspiel-aufnahme klein" onClick={starten} aria-label="Aufnahme starten"><span className="einspiel-punkt" aria-hidden="true" /></button>}
        <div className="aufnahme-stand" role="status" aria-live="polite">
          {zustand === 'scharf' && <><strong>Aufnehmen ab {taktText}</strong>{stimmeText} · {raster.bpm} bpm · {taktartText(raster.zaehler, raster.nenner)}<span className="gedaempft text-xs">{fehler || vorlaufText}</span></>}
          {zustand === 'zaehlt' && <><strong>{a.vor ? `Vorlauf · Takt ${zielTakt - a.vor + 1}` : 'Einzähler'}</strong> · {a.zaehlt ?? jeTakt}<span className="gedaempft text-xs">Einsatz auf der Eins von {taktText}</span></>}
          {zustand === 'nimmt' && <><strong>Takt {zielTakt + (a.takt ?? 1)} · Schlag {a.schlag ?? 1}</strong> <span className="einspiel-ton">{a.ton || ''}</span><span className="gedaempft text-xs">Aufnahme läuft — ■, wenn der Abschnitt zu Ende ist</span></>}
          {zustand === 'pruefen' && (erkannt.takte.length
            ? <><strong>{n} {n === 1 ? 'Takt' : 'Takte'} erkannt</strong> · ab {taktText}<span className="gedaempft text-xs">{art === 'einfuegen' && !anhaengen ? `Einfügen schiebt ab Takt ${zielTakt + 1} nach hinten` : anhaengen ? 'wird angehängt' : `Ersetzen überschreibt Takt ${zielTakt + 1}–${zielTakt + n}`}{erkannt.nachklangWeg ? ' · letzter Takt weggelassen (Nachklang)' : ''}</span></>
            : <><strong>Kein Ton erkannt</strong><span className="gedaempft text-xs">Näher ans Mikrofon oder lauter; der Klick bleibt draußen</span></>)}
        </div>
        <button type="button" className="panel-zu" onClick={schliessen} disabled={laeuft} aria-label="Aufnahmeleiste schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="aufnahme-steuer">
        {zustand === 'scharf' && (
          <>
            <div className="notensatz-block">
              <button type="button" onClick={() => setZielTakt(Math.max(0, zielTakt - 1))} disabled={zielTakt === 0} aria-label="Zieltakt zurück">−</button>
              <button type="button" disabled aria-label="Zieltakt">{taktText}</button>
              <button type="button" onClick={() => setZielTakt(Math.min(takte.length, zielTakt + 1))} disabled={anhaengen} aria-label="Zieltakt vor">+</button>
            </div>
            <div className="notensatz-block" role="group" aria-label="Lesart">
              {LESARTEN.map((l) => <button key={l.lesart} type="button" aria-pressed={lesart === l.lesart} onClick={() => setLesart(l.lesart)} title={l.hinweis}>{l.name}</button>)}
            </div>
            <div className="notensatz-menue">
              <button type="button" className="notensatz-menue-knopf" aria-expanded={menue} aria-haspopup="true" onClick={() => setMenue(!menue)}>Vorlauf ▾</button>
              {menue && (
                <>
                  <button type="button" className="nav-fang" aria-label="Menü schließen" onClick={() => setMenue(false)} />
                  <div className="notensatz-blase oben" role="group" aria-label="Vorlauf">
                    <div className="notensatz-gruppe">
                      <span>Vor dem Einsatz</span>
                      <div className="notensatz-block">
                        <button type="button" aria-pressed={vorlauf === 0} onClick={() => setVorlauf(0)}>Einzähler</button>
                        <button type="button" aria-pressed={vorlauf === 1} onClick={() => setVorlauf(1)}>1 Takt vorspielen</button>
                        <button type="button" aria-pressed={vorlauf === 2} onClick={() => setVorlauf(2)}>2 Takte</button>
                      </div>
                    </div>
                    {stimmen.length > 1 && (
                      <label className="notensatz-gruppe">
                        <span>Begleitung ab dem Zieltakt weiter hören</span>
                        <span className="notensatz-reihe"><input type="checkbox" role="switch" className="ios-schalter" checked={begleitung} onChange={(e) => setBegleitung(e.target.checked)} /><span className="gedaempft text-xs">mit Kopfhörer — sonst hört das Mikrofon das Klavier mit</span></span>
                      </label>
                    )}
                    <label className="notensatz-gruppe">
                      <span>Lautsprecher</span>
                      <span className="notensatz-reihe"><input type="checkbox" role="switch" className="ios-schalter" checked={lautsprecher} onChange={(e) => setLautsprecher(e.target.checked)} /><span className="gedaempft text-xs">{lautsprecher ? 'wie Freisprechen, Klick bleibt draußen' : 'rohes Mikrofon, nah am Mund'}</span></span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {laeuft && <span className="gedaempft text-xs">{zustand === 'zaehlt' ? 'Vorlauf läuft — ■ bricht ab' : `höchstens ${MAX_TAKTE} Takte, dann hält die Aufnahme von selbst`}</span>}
        {zustand === 'pruefen' && erkannt.takte.length > 0 && (
          <>
            <div className="notensatz-block" role="group" aria-label="Einfügen oder Ersetzen">
              <button type="button" aria-pressed={art === 'einfuegen'} onClick={() => setArt('einfuegen')} disabled={anhaengen}>Einfügen</button>
              <button type="button" aria-pressed={art === 'ersetzen'} onClick={() => setArt('ersetzen')}>{anhaengen ? 'Anhängen' : 'Ersetzen'}</button>
            </div>
            <div className="notensatz-block">
              <button type="button" onClick={() => setAnzahl(Math.max(1, n - 1))} disabled={n <= 1} aria-label="Einen Takt weniger">−</button>
              <button type="button" disabled>{n} {n === 1 ? 'Takt' : 'Takte'}</button>
              <button type="button" onClick={() => setAnzahl(Math.min(erkannt.takte.length, n + 1))} disabled={n >= erkannt.takte.length} aria-label="Einen Takt mehr">+</button>
            </div>
            <div className="notensatz-block" role="group" aria-label="Lesart">
              {LESARTEN.map((l) => <button key={l.lesart} type="button" aria-pressed={lesart === l.lesart} onClick={() => setLesart(l.lesart)} title={l.hinweis}>{l.name}</button>)}
            </div>
            <span className="flex-1" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={verwerfen}>Verwerfen</button>
            <button type="button" className="knopf knopf-klein" onClick={fertig}>Übernehmen</button>
          </>
        )}
        {zustand === 'pruefen' && !erkannt.takte.length && (
          <>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={leerenTakt}>Leeren Takt einfügen</button>
            <span className="flex-1" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={verwerfen}>Verwerfen</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
