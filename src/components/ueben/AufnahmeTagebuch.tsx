'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  aufnahmeNameAufbereiten, dauerText, nachTagen, stueckeMitAufnahmen, tagebuch, tagebuchFiltern, umschaltZeit, vergleichbar, vergleichsPaar, wo,
  type TagebuchEintrag,
} from '@/domain/aufnahmetagebuch';
import { nachTitel } from '@/domain/notenpult';
import { BEREICHE, SKILLS, skillFinden } from '@/domain/skillkatalog';
import { useAufnahme } from './Aufnahmen';
import { wiedergabeSitzung } from './klang';
import { LautsprecherSchalter } from './lautsprecher';
import { alleStellen, alleStuecke, aufnahmeAendern, aufnahmeDatei, aufnahmeLoeschen, type Stelle, type Stueck } from './lokal';
import { skillGeuebt } from './skillspeicher';
import { fehlerGrund, speicherFehler } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';

// Aufnahme-Tagebuch (I-20): alle eigenen Aufnahmen (G-09) über alle Stücke,
// neueste zuerst und nach Tagen; filtern nach Stück, anhören, umbenennen,
// löschen (mit Rückfrage); „Vergleichen“: zwei Aufnahmen desselben Stücks
// bzw. derselben Stelle wählen, dann A, danach B — oder während des
// Hörens zwischen A und B umschalten (an derselben Stelle weiter).
// Neue Aufnahme: zu einem Stück, optional mit einem Skill aus der Kartei.
// Eine Aufnahme ohne Stück gibt es nicht — sie liegt am Stück (Datenmodell).
// Nur aufnehmen und abspielen, keine Bearbeitung (Leitbild). Die Aufnahmen
// bleiben auf dem Gerät und reisen nicht mit der Sicherung (Hinweis oben).
// Regeln in @/domain/aufnahmetagebuch.

const uhrzeit = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const anzeigeName = (e: TagebuchEintrag) => e.aufnahme.titel || `Aufnahme ${uhrzeit(e.aufnahme.am)}`;
const datumKurz = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

// Ein Abspieler für das ganze Blatt: immer nur eine Aufnahme zugleich.
function useAbspieler() {
  const [spielt, setSpielt] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');
  const jetzt = useRef<{ id: string; audio: HTMLAudioElement; url: string } | null>(null);
  const aus = useCallback(() => {
    const j = jetzt.current;
    jetzt.current = null;
    if (j) { j.audio.pause(); j.audio.src = ''; URL.revokeObjectURL(j.url); }
    setSpielt(null);
  }, []);
  useEffect(() => aus, [aus]);
  const umschalten = async (e: TagebuchEintrag) => {
    const war = jetzt.current?.id;
    aus();
    if (war === e.aufnahme.id) return;
    setFehler('');
    wiedergabeSitzung();
    try {
      const url = URL.createObjectURL(await aufnahmeDatei(e.aufnahme));
      const audio = new Audio(url);
      audio.onended = () => { if (jetzt.current?.audio === audio) aus(); };
      jetzt.current = { id: e.aufnahme.id, audio, url };
      setSpielt(e.aufnahme.id);
      await audio.play();
    } catch (x) { aus(); setFehler(`Abspielen geht nicht: ${fehlerGrund(x)}`); }
  };
  return { spielt, fehler, umschalten, aus };
}

export function AufnahmeTagebuchBlatt({ schliessen }: { schliessen: () => void }) {
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const [daten, setDaten] = useState<{ stuecke: Stueck[]; stellen: Stelle[]; jetzt: number } | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [waehlen, setWaehlen] = useState<{ erste: string | null } | null>(null);
  const [paar, setPaar] = useState<{ a: TagebuchEintrag; b: TagebuchEintrag } | null>(null);
  const [neu, setNeu] = useState(false);
  const spieler = useAbspieler();

  const laden = useCallback(() => {
    Promise.all([alleStuecke(), alleStellen()])
      .then(([stuecke, stellen]) => { setDaten({ stuecke, stellen, jetzt: Date.now() }); setLadeFehler(''); })
      .catch((x) => setLadeFehler(`Die Aufnahmen ließen sich nicht laden: ${fehlerGrund(x)}`));
  }, []);
  useEffect(laden, [laden]);

  const alle = useMemo(() => (daten ? tagebuch(daten.stuecke, daten.stellen) : []), [daten]);
  const stuecke = useMemo(() => stueckeMitAufnahmen(alle), [alle]);
  const filterGilt = filter !== null && stuecke.some((s) => s.id === filter) ? filter : null;
  const gezeigt = tagebuchFiltern(alle, filterGilt);
  const tage = nachTagen(gezeigt, daten?.jetzt ?? 0);
  const erste = waehlen?.erste ? alle.find((e) => e.aufnahme.id === waehlen.erste) ?? null : null;

  const zu = () => {
    if (paar) { setPaar(null); return; }
    if (waehlen) { setWaehlen(null); return; }
    spieler.aus(); schliessen();
  };
  useEscape(zu, !neu);

  const zeileTippen = (e: TagebuchEintrag) => {
    if (!waehlen) { void spieler.umschalten(e); return; }
    if (!erste) { setWaehlen({ erste: e.aufnahme.id }); return; }
    if (e.aufnahme.id === erste.aufnahme.id) { setWaehlen({ erste: null }); return; }
    const p = vergleichsPaar(alle, erste.aufnahme.id, e.aufnahme.id);
    if (!p) return;
    spieler.aus();
    setPaar(p);
    setWaehlen(null);
  };
  const benennen = async (e: TagebuchEintrag) => {
    const roh = prompt('Name der Aufnahme', e.aufnahme.titel ?? '');
    if (roh === null) return;
    try { await aufnahmeAendern(e.stueckId, e.aufnahme.id, { titel: aufnahmeNameAufbereiten(roh) }); } catch (x) { speicherFehler(x); return; }
    laden();
  };
  const loeschen = async (e: TagebuchEintrag) => {
    if (!confirm(`Aufnahme „${anzeigeName(e)}“ (${e.stueckTitel}, ${datumKurz(e.aufnahme.am)}) löschen? Sie ist danach weg — es gibt keine Kopie in der Sicherung.`)) return;
    if (spieler.spielt === e.aufnahme.id) spieler.aus();
    if (paar && (paar.a.aufnahme.id === e.aufnahme.id || paar.b.aufnahme.id === e.aufnahme.id)) setPaar(null);
    try { await aufnahmeLoeschen(e.stueckId, e.aufnahme.id); } catch (x) { speicherFehler(x); return; }
    laden();
  };

  const hinweis = waehlen
    ? (erste ? `Zweite Aufnahme wählen — gleiche${erste.aufnahme.stelleId ? ' Stelle' : 's Stück'} wie „${anzeigeName(erste)}“` : 'Erste Aufnahme zum Vergleichen wählen')
    : 'Aufnahmen bleiben auf diesem Gerät und reisen nicht mit der Sicherung.';

  return (<>{createPortal(
    <div className={`blatt-hintergrund${seite.klasse}`} onClick={(e) => { e.stopPropagation(); zu(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt tb-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Aufnahme-Tagebuch</h2>
            <p className="gedaempft text-sm tabular-nums">{daten ? `${alle.length} ${alle.length === 1 ? 'Aufnahme' : 'Aufnahmen'}` : 'wird geladen …'}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { spieler.aus(); schliessen(); }}>Fertig</button>
        </div>

        <p className={`tb-hinweis text-sm ${waehlen ? 'waehlen' : ''}`} role="status">{hinweis}</p>

        <div className="tb-werkzeuge">
          <select className="feld tb-filter" value={filterGilt ?? ''} onChange={(e) => setFilter(e.target.value || null)} aria-label="Nach Stück filtern">
            <option value="">Alle Stücke</option>
            {stuecke.map((s) => <option key={s.id} value={s.id}>{s.titel} ({s.anzahl})</option>)}
          </select>
          <button type="button" className="knopf knopf-leise knopf-klein" aria-pressed={!!waehlen} disabled={alle.length < 2}
            onClick={() => { spieler.aus(); setPaar(null); setWaehlen(waehlen ? null : { erste: null }); }}>{waehlen ? 'Abbrechen' : 'Vergleichen'}</button>
          <button type="button" className="knopf knopf-klein tb-neu" onClick={() => { spieler.aus(); setNeu(true); }} disabled={!daten}>
            <span className="nav-aufnahme-punkt" aria-hidden="true" /> Neu
          </button>
        </div>

        <div className="tb-liste" aria-label="Aufnahmen">
          {(ladeFehler || spieler.fehler) && <p className="karte warnung" role="alert">{ladeFehler || spieler.fehler}</p>}
          {daten && !alle.length && (
            <div className="tb-leer">
              <strong>Noch keine Aufnahme.</strong>
              <span className="gedaempft text-sm">„Neu“ nimmt zu einem Stück auf, auf Wunsch mit einem Skill. Oder in den Noten: der rote Knopf in der Leiste nimmt auf, während du spielst.</span>
            </div>
          )}
          {tage.map((t) => (
            <section key={t.tag} className="tb-tag">
              <h3 className="kennzahl-label">{t.titel}</h3>
              <ul>
                {t.eintraege.map((e) => {
                  const id = e.aufnahme.id;
                  const nichtWaehlbar = !!erste && id !== erste.aufnahme.id && !vergleichbar(erste, e);
                  const gewaehlt = erste?.aufnahme.id === id;
                  const skill = e.skillId ? skillFinden(e.skillId)?.name ?? e.skillId : null;
                  return (
                    <li key={id} className={`tb-zeile${gewaehlt ? ' gewaehlt' : ''}${nichtWaehlbar ? ' aus' : ''}`}>
                      <button type="button" className={`aufnahme-spielen ${spieler.spielt === id ? 'an' : ''}`} disabled={!!waehlen}
                        onClick={() => void spieler.umschalten(e)} aria-label={spieler.spielt === id ? 'Anhalten' : `„${anzeigeName(e)}“ abspielen`} aria-pressed={spieler.spielt === id}>
                        {spieler.spielt === id ? '■' : '▶'}
                      </button>
                      <button type="button" className="tb-text" onClick={() => zeileTippen(e)} disabled={nichtWaehlbar}
                        aria-pressed={waehlen ? gewaehlt : undefined}>
                        <strong>{anzeigeName(e)}</strong>
                        <span className="gedaempft tb-wo text-xs">
                          {e.stueckTitel}{wo(e) ? ` · ${wo(e)}` : ''}{skill ? ` · ${skill}` : ''}
                        </span>
                        <span className="gedaempft text-xs tabular-nums">{dauerText(e.aufnahme.dauer)}{e.aufnahme.titel ? ` · ${uhrzeit(e.aufnahme.am)}` : ''}</span>
                      </button>
                      <button type="button" className="knopf knopf-leise knopf-klein" disabled={!!waehlen} onClick={() => void benennen(e)} aria-label={`„${anzeigeName(e)}“ umbenennen`}>Name</button>
                      <button type="button" className="knopf knopf-leise knopf-klein" disabled={!!waehlen} onClick={() => void loeschen(e)} aria-label={`„${anzeigeName(e)}“ löschen`}>×</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {paar && <Vergleich key={`${paar.a.aufnahme.id}-${paar.b.aufnahme.id}`} paar={paar} schliessen={() => setPaar(null)} />}
      </div>
    </div>,
    seite.ziel,
  )}
  {neu && daten && (
    <NeueAufnahme stuecke={daten.stuecke} vorwahl={filterGilt ?? alle[0]?.stueckId ?? null}
      schliessen={() => setNeu(false)} gespeichert={() => { laden(); setNeu(false); }} />
  )}
  </>);
}

// ── Vergleichen: A (älter) und B (neuer) ── liegt unten über der Liste.
function Vergleich({ paar, schliessen }: { paar: { a: TagebuchEintrag; b: TagebuchEintrag }; schliessen: () => void }) {
  const [aktiv, setAktiv] = useState<'a' | 'b' | null>(null);
  const [folge, setFolge] = useState(false);
  const [fehler, setFehler] = useState('');
  const spur = useRef<{ a: HTMLAudioElement; b: HTMLAudioElement; urls: string[] } | null>(null);

  const anhalten = useCallback(() => {
    const s = spur.current;
    if (s) { s.a.pause(); s.b.pause(); }
    setAktiv(null); setFolge(false);
  }, []);
  useEffect(() => () => {
    const s = spur.current;
    spur.current = null;
    if (s) { s.a.pause(); s.b.pause(); s.a.src = ''; s.b.src = ''; s.urls.forEach((u) => URL.revokeObjectURL(u)); }
  }, []);

  // Beide laden (einmal), danach sofort abspielbar — wichtig fürs Umschalten.
  const bereit = async () => {
    if (spur.current) return spur.current;
    const [da, db] = await Promise.all([aufnahmeDatei(paar.a.aufnahme), aufnahmeDatei(paar.b.aufnahme)]);
    const urls = [URL.createObjectURL(da), URL.createObjectURL(db)];
    const s = { a: new Audio(urls[0]), b: new Audio(urls[1]), urls };
    s.a.preload = 'auto'; s.b.preload = 'auto';
    spur.current = s;
    return s;
  };
  const spielen = async (welche: 'a' | 'b', ab: number, nachher: boolean) => {
    setFehler('');
    wiedergabeSitzung();
    try {
      const s = await bereit();
      const an = s[welche], andere = s[welche === 'a' ? 'b' : 'a'];
      andere.pause();
      an.currentTime = ab;
      an.onended = () => {
        if (nachher && welche === 'a') void spielen('b', 0, false);
        else { setAktiv(null); setFolge(false); }
      };
      andere.onended = null;
      setAktiv(welche); setFolge(nachher);
      await an.play();
    } catch (x) { anhalten(); setFehler(`Abspielen geht nicht: ${fehlerGrund(x)}`); }
  };
  const nacheinander = () => (aktiv && folge ? anhalten() : void spielen('a', 0, true));
  const umschalten = () => {
    const s = spur.current;
    if (!aktiv || !s) { void spielen('a', 0, false); return; }
    const ziel = aktiv === 'a' ? 'b' : 'a';
    void spielen(ziel, umschaltZeit(s[aktiv].currentTime, s[ziel].duration), false);
  };
  const zeile = (k: 'a' | 'b', e: TagebuchEintrag) => (
    <div className={`tb-vergleich-zeile${aktiv === k ? ' an' : ''}`}>
      <span className="tb-marke" aria-hidden="true">{k.toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{anzeigeName(e)}</strong>
        <span className="gedaempft block truncate text-xs tabular-nums">{datumKurz(e.aufnahme.am)} · {dauerText(e.aufnahme.dauer)}{k === 'a' ? ' · älter' : ' · neuer'}</span>
      </span>
    </div>
  );

  return (
    <div className="tb-vergleich" role="group" aria-label="Vergleichen">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{paar.a.stueckTitel}{wo(paar.a) ? ` · ${wo(paar.a)}` : ''}</span>
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { anhalten(); schliessen(); }}>Schließen</button>
      </div>
      {zeile('a', paar.a)}
      {zeile('b', paar.b)}
      <p className="tb-vergleich-fehler text-xs" role="alert">{fehler}</p>
      <div className="tb-vergleich-knoepfe">
        <button type="button" className="knopf knopf-leise" onClick={nacheinander}>{aktiv && folge ? '■ Anhalten' : '▶ A, dann B'}</button>
        <button type="button" className="knopf" onClick={umschalten} aria-label={aktiv ? `Umschalten auf ${aktiv === 'a' ? 'B' : 'A'}` : 'A abspielen, dann umschalten'}>
          {aktiv ? `⇄ zu ${aktiv === 'a' ? 'B' : 'A'}` : '⇄ A/B umschalten'}
        </button>
      </div>
    </div>
  );
}

// ── Neue Aufnahme: zu einem Stück, optional ein Skill ── liegt über dem Tagebuch.
function NeueAufnahme({ stuecke, vorwahl, schliessen, gespeichert }: {
  stuecke: Stueck[]; vorwahl: string | null; schliessen: () => void; gespeichert: () => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const sortiert = useMemo(() => [...stuecke].sort(nachTitel), [stuecke]);
  const [stueckId, setStueckId] = useState(() => (vorwahl && stuecke.some((s) => s.id === vorwahl) ? vorwahl : sortiert[0]?.id ?? ''));
  const [skillId, setSkillId] = useState('');
  // `fertig` muss gleich bleiben: Ein neues `fertig` gäbe useAufnahme ein
  // neues Stoppen — dessen Aufräumen beendete eine laufende Aufnahme.
  const merk = useRef({ skillId, gespeichert });
  useEffect(() => { merk.current = { skillId, gespeichert }; }, [skillId, gespeichert]);
  const fertig = useCallback(() => {
    if (merk.current.skillId) skillGeuebt(merk.current.skillId);
    merk.current.gespeichert();
  }, []);
  const aufnahme = useAufnahme(stueckId, fertig);
  const zu = () => { if (!aufnahme.laeuft) schliessen(); };
  useEscape(zu);

  return createPortal(
    <div className="blatt-hintergrund harmonie-ueber" onClick={(e) => { e.stopPropagation(); zu(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt sh-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Neue Aufnahme</h2>
            <p className="gedaempft text-sm">Nur aufnehmen und anhören — bleibt auf diesem Gerät.</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu} disabled={aufnahme.laeuft}>Abbrechen</button>
        </div>
        {!sortiert.length ? (
          <p className="text-sm">Eine Aufnahme gehört zu einem Stück. Füge zuerst Noten hinzu — dann lässt sich hier dazu aufnehmen.</p>
        ) : (
          <>
            <label className="tb-feld">
              <span className="kennzahl-label">Stück</span>
              <select className="feld" value={stueckId} onChange={(e) => setStueckId(e.target.value)} disabled={aufnahme.laeuft}>
                {sortiert.map((s) => <option key={s.id} value={s.id}>{s.titel}{s.stimme ? ` (${s.stimme})` : ''}</option>)}
              </select>
            </label>
            <label className="tb-feld">
              <span className="kennzahl-label">Skill (optional)</span>
              <select className="feld" value={skillId} onChange={(e) => setSkillId(e.target.value)} disabled={aufnahme.laeuft}>
                <option value="">— ohne Skill —</option>
                {BEREICHE.map((b) => (
                  <optgroup key={b.id} label={b.name}>
                    {SKILLS.filter((s) => s.bereich === b.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="gedaempft min-h-[2.5em] text-xs">{skillId ? 'Mit Skill zählt die Aufnahme dort als heute geübt.' : 'Mit Skill findest du sie später beim Skill wieder und er zählt als heute geübt.'}</p>
            <LautsprecherSchalter gesperrt={aufnahme.laeuft} className="mb-3" hinweis="An: Metronom aus dem Lautsprecher, es bleibt aus der Aufnahme draußen. Aus: für Kopfhörer — rohes Mikrofon, unverfälscht." />
            <button type="button" className={`tb-aufnehmen${aufnahme.laeuft ? ' laeuft' : ''}`} aria-pressed={aufnahme.laeuft}
              onClick={() => aufnahme.umschalten(skillId ? { skillId } : {})}>
              {aufnahme.laeuft
                ? <><span className="tb-stopp" aria-hidden="true" /> <span className="tabular-nums">{dauerText(aufnahme.sekunden)}</span> · Beenden und sichern</>
                : <><span className="nav-aufnahme-punkt" aria-hidden="true" /> Aufnehmen</>}
            </button>
            <p className="tb-vergleich-fehler text-sm" role="alert">{aufnahme.fehler}</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
