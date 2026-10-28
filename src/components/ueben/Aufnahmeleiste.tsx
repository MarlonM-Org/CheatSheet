'use client';
// Die Aufnahmeleiste (G-05): in ein geschriebenes Stück hinein aufnehmen.
// Liegt unten über dem Notenblatt, oberhalb des Dialog-Fußes („Speichern“
// bleibt frei); am Griff lässt sie sich überallhin schieben, die Lage wird
// gemerkt (useSchiebbar). Ablauf je Abschnitt: scharf (Zieltakt, auf Wunsch
// ein Endtakt, Lesart, Vorlauf) → ● → Vorlauf (Takte davor vorgespielt,
// Klick läuft; bei Takt 1 ein Einzähltakt) → Aufnahme (mit Endtakt hält sie
// dort von selbst) → ■ → prüfen (die erkannten Takte liegen als Vorschau im
// Blatt, Einfügen oder Ersetzen, − +, Lesart umlegbar) → Übernehmen schreibt
// sie als einen Rückgängig-Schritt; die Leiste steht danach auf dem Folgetakt.
// Konzept und Begründungen: reports/Einspielen im Stück UX.md.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LESARTEN, rastern, versatzSchaetzen, type Lesart, type Raster, type Stimme, type Takt, type Tonart, type Tonrahmen } from '@/domain/notation';
import { leererTakt, skalieren } from '@/domain/notensatz';
import { abschnittKuerzen, bereichSetzen, bereichTakte, nachlaufKuerzen, takteEinsetzen, vorgabeArt, vorlaufKlaenge, type Bereich, type EinsetzArt } from '@/domain/taktaufnahme';
import { schlaegeJeTakt, taktartText } from '@/domain/takt';
import type { Stimmung } from '@/domain/ueben';
import { gespeichert, speichern, type Klang as MetronomKlang } from './klang';
import { useMikrofonSpur } from './mikrofonspur';
import { useSchiebbar } from './schiebbar';

const VORLAUF_SCHLUESSEL = 'ueben:einspiel-vorlauf';
const BEGLEITUNG_SCHLUESSEL = 'ueben:einspiel-begleitung';
// Längste Aufnahme je Abschnitt in Takten (ohne Endtakt).
const MAX_TAKTE = 32;
const LAGE_SCHLUESSEL = 'ueben:lage-aufnahme';

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
  // Aufnahmebereich: Zieltakt und auf Wunsch ein Endtakt (Regeln in taktaufnahme.ts).
  const [bereichRoh, setBereich] = useState<Bereich>(() => ({ von: auswahlTakt ?? takte.length, bis: null }));
  const { von: zielTakt, bis } = bereichSetzen(bereichRoh, {}, takte.length);
  const bereichAendern = (neu: Partial<Bereich>) => setBereich((b) => bereichSetzen(b, neu, takte.length));
  // Antippen im Blatt setzt den Zieltakt, solange nichts läuft (abgeleitet, kein Effekt).
  const [letzteAuswahl, setLetzteAuswahl] = useState(auswahlTakt);
  if (auswahlTakt !== letzteAuswahl) { setLetzteAuswahl(auswahlTakt); if (zustand === 'scharf' && auswahlTakt !== null) bereichAendern({ von: auswahlTakt }); }
  const { panel, lage, anfassen, bewegen, loslassen } = useSchiebbar<HTMLDivElement>(LAGE_SCHLUESSEL, { grenze: '.scan-fuss', schwebBreite: null });
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
  const mikrofonStarten = mikrofon.starten, mikrofonStoppen = mikrofon.stoppen;
  useEffect(() => { zustandAendern(zustand); }, [zustand, zustandAendern]);

  // ── Vorschlag aus der Spur ──
  const erkannt = useMemo<{ takte: Takt[]; nachklangWeg: boolean }>(() => {
    if (zustand !== 'pruefen' || !spur.length) return { takte: [], nachklangWeg: false };
    const roh = skalieren(rastern(spur, raster, { tonart, lesart }), raster.feinheit);
    const gekuerzt = nachlaufKuerzen(roh, blattRaster);
    return { takte: gekuerzt, nachklangWeg: gekuerzt.length < roh.length };
  }, [zustand, spur, raster, blattRaster, tonart, lesart]);
  const n = Math.min(anzahl ?? erkannt.takte.length, erkannt.takte.length);
  const art: EinsetzArt = artWahl ?? vorgabeArt(takte, zielTakt, erkannt.takte.length || 1, bis !== null);
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
    void mikrofonStarten({
      raster, lautsprecher, klickWeiter: true, metro, stimmung, kammerton,
      einzaehlTakte: vorlaufTakte ? 0 : 1,
      vorlauf: vorlaufTakte ? { klaenge, takte: vorlaufTakte } : null,
      maxTakte: bereichTakte({ von: zielTakt, bis }, MAX_TAKTE),
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
  }, [vorlauf, zielTakt, bis, stimmen, blattRaster, stumm, aktiv, begleitung, mikrofonStarten, raster, lautsprecher, metro, stimmung, kammerton, letzterVersatz]);
  const stoppen = () => mikrofonStoppen(zustand === 'nimmt');
  const verwerfen = () => { setSpur([]); setZustand('scharf'); };
  const nochmal = () => { setSpur([]); setZustand('scharf'); starten(); };
  const fertig = () => {
    if (!vorschau) return;
    const weiter = zielTakt + n;
    uebernehmen(vorschau.stimmen, weiter);
    // Weiter auf dem Folgetakt, wieder offen — der Endtakt galt für diesen Abschnitt.
    setSpur([]); setBereich({ von: weiter, bis: null }); setZustand('scharf');
  };
  // Ohne Ton: einen leeren Takt einsetzen, zum Schreiben von Hand.
  const leerenTakt = () => {
    const e = takteEinsetzen(stimmen, aktiv, zielTakt, [leererTakt(blattRaster)], 'einfuegen', blattRaster);
    uebernehmen(e.stimmen, zielTakt + 1);
    setSpur([]); setBereich({ von: zielTakt + 1, bis: null }); setZustand('scharf');
  };
  useEffect(() => () => vorschauAendern(null), [vorschauAendern]);

  const anhaengen = zielTakt >= takte.length;
  const taktText = anhaengen ? 'Anhängen' : `Takt ${zielTakt + 1}`;
  // „Takt 4“ oder „Takt 4–6“ (mit Endtakt).
  const bereichText = bis === null || bis === zielTakt ? taktText : `Takt ${zielTakt + 1}–${bis + 1}`;
  const bisText = bis === null ? 'offen' : bis === zielTakt ? 'nur diesen' : `bis Takt ${bis + 1}`;
  const jeTakt = schlaegeJeTakt(raster.zaehler, raster.nenner);
  const stimmeText = stimmen.length > 1 ? ` · ${stimmen[aktiv]?.name || `Stimme ${aktiv + 1}`}` : '';
  const vorlaufText = zielTakt === 0 || vorlauf === 0 ? 'Einzähler, dann singen' : `Vorlauf: ${vorlauf === 1 ? `Takt ${zielTakt}` : `Takte ${Math.max(1, zielTakt - 1)}–${zielTakt}`} wird vorgespielt, dann singen`;
  const a = mikrofon.anzeige;
  const laeuft = zustand === 'zaehlt' || zustand === 'nimmt';

  return (
    <div ref={panel} className={`aufnahme-leiste ${lage ? 'schwebt' : ''}`} style={lage ? { left: lage.x, top: lage.y } : undefined} role="region" aria-label="Aufnehmen im Stück">
      {/* Am Kopf anfassen und schieben; Knöpfe darin bleiben Knöpfe. */}
      <div className="aufnahme-kopf anfasser" onPointerDown={anfassen} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
        <svg className="griff" viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" /><circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" /></svg>
        {zustand === 'pruefen'
          ? <button type="button" className="einspiel-aufnahme klein" onClick={nochmal} disabled={gesperrt} aria-label="Nochmal aufnehmen" title="Nochmal: gleicher Zieltakt, der Vorschlag verfällt"><span className="aufnahme-nochmal" aria-hidden="true">↻</span></button>
          : laeuft
            ? <button type="button" className={`einspiel-aufnahme klein ${zustand === 'nimmt' ? 'nimmt' : ''}`} onClick={stoppen} aria-label={zustand === 'nimmt' ? 'Aufnahme beenden' : 'Vorlauf abbrechen'}><span className="einspiel-stopp" aria-hidden="true" /></button>
            : <button type="button" className="einspiel-aufnahme klein" onClick={starten} aria-label="Aufnahme starten"><span className="einspiel-punkt" aria-hidden="true" /></button>}
        <div className="aufnahme-stand" role="status" aria-live="polite">
          {zustand === 'scharf' && <><strong>{anhaengen ? 'Anhängen' : bis === null ? `Aufnehmen ab ${taktText}` : `Aufnehmen ${bereichText}`}</strong>{stimmeText} · {raster.bpm} bpm · {taktartText(raster.zaehler, raster.nenner)}<span className="gedaempft text-xs">{fehler || vorlaufText}</span></>}
          {zustand === 'zaehlt' && <><strong>{a.vor ? `Vorlauf · Takt ${zielTakt - a.vor + 1}` : 'Einzähler'}</strong> · {a.zaehlt ?? jeTakt}<span className="gedaempft text-xs">Einsatz auf der Eins von {taktText}</span></>}
          {zustand === 'nimmt' && <><strong>Takt {zielTakt + (a.takt ?? 1)} · Schlag {a.schlag ?? 1}</strong> <span className="einspiel-ton">{a.ton || ''}</span><span className="gedaempft text-xs">{bis === null ? 'Aufnahme läuft — ■, wenn der Abschnitt zu Ende ist' : `Aufnahme läuft bis Takt ${bis + 1}, dann hält sie von selbst`}</span></>}
          {zustand === 'pruefen' && (erkannt.takte.length
            ? <><strong>{n} {n === 1 ? 'Takt' : 'Takte'} erkannt</strong> · ab {taktText}<span className="gedaempft text-xs">{art === 'einfuegen' && !anhaengen ? `Einfügen schiebt ab Takt ${zielTakt + 1} nach hinten` : anhaengen ? 'wird angehängt' : n === 1 ? `Ersetzen überschreibt Takt ${zielTakt + 1}` : `Ersetzen überschreibt Takt ${zielTakt + 1}–${zielTakt + n}`}{erkannt.nachklangWeg ? ' · letzter Takt weggelassen (Nachklang)' : ''}</span></>
            : <><strong>Kein Ton erkannt</strong><span className="gedaempft text-xs">Näher ans Mikrofon oder lauter; der Klick bleibt draußen</span></>)}
        </div>
        <button type="button" className="panel-zu" onClick={schliessen} disabled={laeuft} aria-label="Aufnahmeleiste schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="aufnahme-steuer">
        {zustand === 'scharf' && (
          <>
            <div className="notensatz-block" role="group" aria-label="Zieltakt">
              <button type="button" onClick={() => bereichAendern({ von: zielTakt - 1 })} disabled={zielTakt === 0} aria-label="Zieltakt zurück">−</button>
              <button type="button" disabled aria-label="Zieltakt" title="Ab hier wird aufgenommen; eine Note im Blatt antippen setzt ihn">{taktText}</button>
              <button type="button" onClick={() => bereichAendern({ von: zielTakt + 1 })} disabled={anhaengen} aria-label="Zieltakt vor">+</button>
            </div>
            {/* Endtakt: offen (bis ■) oder bis zu einem Takt — dann hält die
                Aufnahme dort und nur diese Takte werden ersetzt. */}
            {!anhaengen && (
              <div className="notensatz-block" role="group" aria-label="Endtakt">
                <button type="button" onClick={() => bereichAendern({ bis: bis === null ? zielTakt : bis - 1 })} disabled={bis === null || bis === zielTakt} aria-label="Endtakt zurück">−</button>
                <button type="button" aria-pressed={bis !== null} onClick={() => bereichAendern({ bis: bis === null ? zielTakt : null })} aria-label={bis === null ? 'Endtakt setzen' : 'Endtakt aufheben'}
                  title={bis === null ? `Offen: Aufnahme läuft bis ■ (höchstens ${MAX_TAKTE} Takte). Antippen: nur den Zieltakt aufnehmen` : 'Die Aufnahme hält am Endtakt von selbst; nur diese Takte werden ersetzt. Antippen: wieder offen'}>
                  {bisText}
                </button>
                <button type="button" onClick={() => bereichAendern({ bis: bis === null ? zielTakt : bis + 1 })} disabled={bis !== null && bis >= takte.length - 1} aria-label="Endtakt vor">+</button>
              </div>
            )}
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
        {laeuft && <span className="gedaempft text-xs">{zustand === 'zaehlt' ? 'Vorlauf läuft — ■ bricht ab' : bis === null ? `höchstens ${MAX_TAKTE} Takte, dann hält die Aufnahme von selbst` : `${bereichTakte({ von: zielTakt, bis }, MAX_TAKTE)} ${bis === zielTakt ? 'Takt' : 'Takte'}, dann hält die Aufnahme von selbst — ■ vorher, wenn es reicht`}</span>}
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
            {/* Die Entscheidung in einer eigenen Zeile, rechts — nichts scrollt. */}
            <div className="aufnahme-aktionen">
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={verwerfen}>Verwerfen</button>
              <button type="button" className="knopf knopf-klein" onClick={fertig}>Übernehmen</button>
            </div>
          </>
        )}
        {zustand === 'pruefen' && !erkannt.takte.length && (
          <>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={leerenTakt}>Leeren Takt einfügen</button>
            <div className="aufnahme-aktionen">
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={verwerfen}>Verwerfen</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
