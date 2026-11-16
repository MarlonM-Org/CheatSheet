'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StufenId } from '@/domain/gehoer';
import { BEREICHE, SKILLS, bereichFinden, skillFinden, skillFuerHoerUebung, type HoerUebungId, type Skill } from '@/domain/skillkatalog';
import {
  andererVorschlag, BLOCK_NAMEN, FILTER, FILTER_NAMEN, heuteErledigen, heuteVorschlag, hoechsteStufe, imFilter, MARKIERUNG_NAMEN, MARKIERUNGEN,
  markierungVon, STUFE_MAX, STUFE_NAMEN, uebersicht, verblasst, wirksameStufe, WOCHENZIEL, wocheEinheiten, zuletztText,
  type Block, type Filter, type HeuteStand, type Markierung, type SkillSpeicher, type SkillStand,
} from '@/domain/skills';
import { useEinstellungenGeladen } from './klang';
import { HoerUebungBlatt } from './HoerUebung';
import { OhrTrainerBlatt } from './OhrTrainer';
import { heuteLaden, heuteSpeichern, SKILLS_GEAENDERT, skillErgebnis, skillGeuebt, skillMarkieren, skillsLaden } from './skillspeicher';
import { useDialogFokus, useEscape } from './tasten';

// Skill-Kartei (I-07) mit „Heute“ (I-09): Gesamtsicht, was ich kann, was ich
// lernen will, was verblasst. Regeln in @/domain/skills, Katalog in
// @/domain/skillkatalog. Auswahl, Detail und Übungen legen sich als Blatt
// über die Liste — nichts verschiebt sich.

export type HoerUebungStarten = (id: HoerUebungId, skillId: string) => void;

function KarteiSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" />
    </svg>
  );
}

function UhrSymbol() {
  return (
    <svg className="skill-uhr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ZuSymbol() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>;
}

// Liest Skills und Tagesstand und hält sie aktuell (eigene Änderungen, Übungen, Sicherung).
function useSkillDaten() {
  const [sp, setSp] = useState<SkillSpeicher>(skillsLaden);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const neu = useCallback(() => { setSp(skillsLaden()); setJetzt(Date.now()); }, []);
  useEffect(() => {
    window.addEventListener(SKILLS_GEAENDERT, neu);
    return () => window.removeEventListener(SKILLS_GEAENDERT, neu);
  }, [neu]);
  useEinstellungenGeladen(neu);
  return { sp, jetzt };
}

const standText = () => { const u = uebersicht(skillsLaden(), Date.now()); return `${u.sicher} von ${u.gesamt} sicher`; };

// Einstieg in der Bibliothek, über dem Ohr-Trainer. `offenMelden`: die
// Bibliothek lässt Escape dem offenen Blatt.
export function SkillsZeile({ hoerUebungStarten, offenMelden }: { hoerUebungStarten?: HoerUebungStarten; offenMelden?: (offen: boolean) => void }) {
  const [offen, setOffenRoh] = useState(false);
  const setOffen = (o: boolean) => { setOffenRoh(o); offenMelden?.(o); };
  const [stand, setStand] = useState(standText);
  useEffect(() => {
    const neu = () => setStand(standText());
    window.addEventListener(SKILLS_GEAENDERT, neu);
    return () => window.removeEventListener(SKILLS_GEAENDERT, neu);
  }, []);
  return (
    <>
      <button type="button" className="mix-einstieg" aria-haspopup="dialog" aria-expanded={offen} onClick={() => setOffen(true)}>
        <span className="mix-symbol klein"><KarteiSymbol /></span>
        <span className="mix-einstieg-titel">Skills</span>
        <span className="mix-einstieg-stand">{stand}</span>
        <span className="bib-pfeil" aria-hidden="true">›</span>
      </button>
      {offen && <SkillsBlatt schliessen={() => { setOffen(false); setStand(standText()); }} hoerUebungStarten={hoerUebungStarten} />}
    </>
  );
}

// Punkte 0–4: voll = wirksame Stufe, hohl = höchste je erreichte darüber.
function Punkte({ s, jetzt }: { s: SkillStand | undefined; jetzt: number }) {
  const w = wirksameStufe(s, jetzt);
  const h = hoechsteStufe(s);
  const text = h > w ? `Stufe ${w} von ${STUFE_MAX}, war schon ${h}` : `Stufe ${w} von ${STUFE_MAX}`;
  return (
    <span className="skill-punkte" role="img" aria-label={text} title={text}>
      {Array.from({ length: STUFE_MAX }, (_, i) => <span key={i} className={i < w ? 'voll' : i < h ? 'hohl' : ''} />)}
    </span>
  );
}

function MarkierungsChip({ m, tippen }: { m: Markierung; tippen: () => void }) {
  return (
    <button type="button" className={`skill-chip ${m}`} onClick={(e) => { e.stopPropagation(); tippen(); }} aria-haspopup="dialog" aria-label={`Markierung: ${MARKIERUNG_NAMEN[m]} — ändern`}>
      {m === 'offen' ? '+ markieren' : MARKIERUNG_NAMEN[m]}
    </button>
  );
}

// Stufe in Worten, mit „war schon …“ und „zuletzt …“.
function stufenZeile(s: SkillStand | undefined, jetzt: number): string {
  const w = wirksameStufe(s, jetzt);
  const h = hoechsteStufe(s);
  const teile: string[] = [];
  if (s?.quoten?.length) teile.push(h > w ? `${STUFE_NAMEN[w]} · war ${STUFE_NAMEN[h]}` : STUFE_NAMEN[w]);
  const z = zuletztText(s, jetzt);
  if (z) teile.push(z);
  return teile.join(' · ');
}

export function SkillsBlatt({ schliessen, hoerUebungStarten }: { schliessen: () => void; hoerUebungStarten?: HoerUebungStarten }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { sp, jetzt } = useSkillDaten();
  const [heute, setHeuteRoh] = useState<HeuteStand>(() => heuteLaden());
  const [filter, setFilter] = useState<Filter>('alle');
  const [detail, setDetail] = useState<string | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  const [ohr, setOhr] = useState<StufenId | null>(null);
  // Hör-Übung (I-08), wenn niemand von außen eine eigene Startfunktion mitgibt.
  const [hoer, setHoer] = useState<{ id: HoerUebungId; skillId: string } | null>(null);
  const hoerStarten: HoerUebungStarten = hoerUebungStarten ?? ((id, skillId) => setHoer({ id, skillId }));
  // Aus „Heute“ gestartete Übung: meldet sie eine Runde, ist der Block erledigt.
  const laeuft = useRef<{ block: Block; skillId: string; seit: number } | null>(null);

  const setHeute = (h: HeuteStand) => { setHeuteRoh(h); heuteSpeichern(h); };
  // Alle Übungen sind eingebaut (Ohr-Trainer, Hör-Übungen) — nichts ist gesperrt.
  const verfuegbar = useCallback((s: Skill) => s !== undefined, []);
  const bloecke = useMemo(() => heuteVorschlag(heute, sp, jetzt, verfuegbar), [heute, sp, jetzt, verfuegbar]);
  const noetig = bloecke.filter((b) => b.skill).map((b) => b.block);
  const noetigRef = useRef(noetig);
  useEffect(() => { noetigRef.current = noetig; });
  const erledigen = (b: Block, skillId: string) => setHeute(heuteErledigen(heuteLaden(), b, skillId, Date.now(), noetig));

  useEffect(() => {
    const pruefen = () => {
      const l = laeuft.current;
      if (!l) return;
      const jetztSp = skillsLaden();
      const skill = skillFinden(l.skillId);
      const gemeldet = [l.skillId, skill?.uebung?.art === 'hoer' ? skillFuerHoerUebung(skill.uebung.id) : null];
      if (!gemeldet.some((id) => id && (jetztSp[id]?.zuletzt ?? 0) >= l.seit)) return;
      laeuft.current = null;
      const h = heuteErledigen(heuteLaden(), l.block, l.skillId, Date.now(), noetigRef.current);
      setHeuteRoh(h);
      heuteSpeichern(h);
    };
    window.addEventListener(SKILLS_GEAENDERT, pruefen);
    return () => window.removeEventListener(SKILLS_GEAENDERT, pruefen);
  }, []);

  const kannUeben = (s: Skill) => !!s.uebung && verfuegbar(s);
  const ueben = (s: Skill, block?: Block) => {
    if (!s.uebung || !verfuegbar(s)) return;
    laeuft.current = block ? { block, skillId: s.id, seit: Date.now() } : null;
    if (s.uebung.art === 'ohr') setOhr(s.uebung.stufe);
    else hoerStarten(s.uebung.id, s.id);
  };

  const zu = () => schliessen();
  useEscape(zu, !detail && !wahl && !ohr && !hoer);

  const u = uebersicht(sp, jetzt);
  const woche = wocheEinheiten(heute, jetzt);
  const alleFertig = noetig.length > 0 && noetig.every((b) => heute.erledigt[b]);
  const anzahl = (f: Filter) => SKILLS.filter((s) => imFilter(sp[s.id], f, jetzt)).length;

  // Detail, Auswahl und Übung liegen neben (nicht in) dem Hintergrund: React
  // reicht Klicks durch Portale an die Eltern weiter — ein Tipp dort schlösse sonst alles.
  return (<>{createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt skill-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <span className="mix-symbol"><KarteiSymbol /></span>
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Skills</h2>
            <p className="gedaempft text-sm"><strong className="skill-sicher-zahl">{u.sicher} von {u.gesamt}</strong> sicher</p>
          </div>
          <button type="button" className="panel-zu" onClick={zu} aria-label="Schließen"><ZuSymbol /></button>
        </div>

        <ul className="skill-bereiche" aria-label="Je Bereich">
          {u.bereiche.map((b) => (
            <li key={b.bereich}>
              <span className="skill-bereich-name">{b.name}</span>
              <span className="skill-bereich-zahl">{b.sicher}/{b.gesamt}</span>
              <span className="skill-balken" aria-hidden="true"><span style={{ width: `${(b.sicher / b.gesamt) * 100}%` }} /></span>
            </li>
          ))}
        </ul>

        <section className="skill-heute" aria-label="Heute">
          <div className="skill-heute-kopf">
            <strong>Heute · 30 Min.</strong>
            <span className={alleFertig ? 'skill-woche fertig' : 'skill-woche'}>{alleFertig ? '✓ geschafft · ' : ''}{woche} von {WOCHENZIEL} Einheiten</span>
          </div>
          <ol className="skill-heute-bloecke">
            {bloecke.map((b) => (
              <li key={b.block} className={b.erledigt ? 'erledigt' : ''}>
                <div className="skill-heute-text">
                  <span className="kennzahl-label">{BLOCK_NAMEN[b.block]}</span>
                  {b.skill ? (
                    <button type="button" className="skill-heute-name" onClick={() => setDetail(b.skill!.id)}>{b.skill.name}</button>
                  ) : <span className="gedaempft text-sm">Nichts vorzuschlagen — alles pausiert oder sicher.</span>}
                </div>
                <div className="skill-heute-knoepfe">
                  <button type="button" className="skill-anderer" onClick={() => setHeute(andererVorschlag(heute, b.block))}
                    aria-label={`Anderer Vorschlag für ${BLOCK_NAMEN[b.block]}`} title="Anderer Vorschlag"
                    style={{ visibility: !b.erledigt && b.anzahl > 1 ? 'visible' : 'hidden' }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15M21 20v-5h-5" /></svg>
                  </button>
                  {b.erledigt ? (
                    <span className="skill-heute-fertig">✓ Erledigt</span>
                  ) : b.skill && kannUeben(b.skill) ? (
                    <button type="button" className="knopf knopf-klein skill-heute-los" onClick={() => ueben(b.skill!, b.block)}>▶ Üben</button>
                  ) : (
                    <button type="button" className="knopf knopf-leise knopf-klein skill-heute-los" disabled={!b.skill}
                      onClick={() => { if (b.skill) { skillGeuebt(b.skill.id); erledigen(b.block, b.skill.id); } }}>Erledigt</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="skill-filter" role="group" aria-label="Filter">
          {FILTER.map((f) => (
            <button key={f} type="button" className="sammlung-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTER_NAMEN[f]}{f !== 'alle' && <span className="sammlung-zahl">{anzahl(f)}</span>}
            </button>
          ))}
        </div>

        <div className="skill-listen">
          {BEREICHE.map((b) => {
            const liste = SKILLS.filter((s) => s.bereich === b.id && imFilter(sp[s.id], filter, jetzt));
            if (!liste.length) return null;
            return (
              <section key={b.id} aria-label={b.name}>
                <h3 className="skill-bereich-titel">{b.name}</h3>
                <ul className="bib-liste">
                  {liste.map((s) => {
                    const st = sp[s.id];
                    const unter = stufenZeile(st, jetzt);
                    return (
                      <li key={s.id} className="skill-zeile">
                        <button type="button" className="skill-zeile-text" onClick={() => setDetail(s.id)} aria-haspopup="dialog">
                          <span className="skill-name">{s.name}</span>
                          {unter && <span className="bib-unterzeile">{unter}</span>}
                        </button>
                        <span className="skill-zeile-rechts">
                          <span className="skill-zeile-stand">
                            {verblasst(st, jetzt) && <UhrSymbol />}
                            <Punkte s={st} jetzt={jetzt} />
                          </span>
                          <MarkierungsChip m={markierungVon(st)} tippen={() => setWahl(s.id)} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {SKILLS.every((s) => !imFilter(sp[s.id], filter, jetzt)) && (
            <p className="gedaempft py-6 text-center text-sm">Hier ist noch nichts — „{FILTER_NAMEN[filter]}“ ist leer.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )}
      {detail && (
        <SkillDetail id={detail} sp={sp} jetzt={jetzt} aktiv={!wahl && !ohr && !hoer} schliessen={() => setDetail(null)} wechseln={setDetail}
          markierungAendern={() => setWahl(detail)} kannUeben={kannUeben} ueben={(s) => ueben(s)} />
      )}
      {wahl && <MarkierungsWahl id={wahl} m={markierungVon(sp[wahl])} schliessen={() => setWahl(null)} />}
      {ohr && <OhrTrainerBlatt stufe={ohr} schliessen={() => { setOhr(null); laeuft.current = null; }} />}
      {hoer && <HoerUebungBlatt uebung={hoer.id} schliessen={() => { setHoer(null); laeuft.current = null; }}
        beiErgebnis={(r) => skillErgebnis(hoer.skillId, r.quote)} />}
  </>);
}

function SkillDetail({ id, sp, jetzt, aktiv, schliessen, wechseln, markierungAendern, kannUeben, ueben }: {
  id: string; sp: SkillSpeicher; jetzt: number; aktiv: boolean;
  schliessen: () => void; wechseln: (id: string) => void; markierungAendern: () => void;
  kannUeben: (s: Skill) => boolean; ueben: (s: Skill) => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  useEscape(schliessen, aktiv);
  const s = skillFinden(id);
  if (!s) return null;
  const st = sp[id];
  const quoten = (st?.quoten ?? []).slice(-10);
  const heuteGeuebt = zuletztText(st, jetzt) === 'heute geübt';
  const w = wirksameStufe(st, jetzt);
  const h = hoechsteStufe(st);

  return createPortal(
    <div className="blatt-hintergrund" onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt skill-detail" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <span className="kennzahl-label">{bereichFinden(s.bereich).name}</span>
            <h2 id={kopf} className="text-xl font-extrabold leading-tight">{s.name}</h2>
          </div>
          <button type="button" className="panel-zu" onClick={schliessen} aria-label="Schließen"><ZuSymbol /></button>
        </div>

        <div className="skill-detail-stand">
          <Punkte s={st} jetzt={jetzt} />
          <span className="min-w-0 flex-1 text-sm">
            <strong>{STUFE_NAMEN[w]}</strong>
            {h > w && <span className="gedaempft"> · war schon {STUFE_NAMEN[h]}</span>}
            {verblasst(st, jetzt) && <span className="skill-verblasst"> · verblasst</span>}
            {zuletztText(st, jetzt) && <span className="gedaempft block text-xs">{zuletztText(st, jetzt)}</span>}
          </span>
          <MarkierungsChip m={markierungVon(st)} tippen={markierungAendern} />
        </div>

        <div className="skill-absatz">
          <span className="kennzahl-label">Was ist das</span>
          <p>{s.was}</p>
        </div>
        <div className="skill-absatz">
          <span className="kennzahl-label">Warum fürs freie Spielen</span>
          <p>{s.warum}</p>
        </div>
        {s.voraussetzungen.length > 0 && (
          <div className="skill-absatz">
            <span className="kennzahl-label">Voraussetzungen</span>
            <div className="skill-voraus">
              {s.voraussetzungen.map((v) => {
                const vs = skillFinden(v);
                return vs ? (
                  <button key={v} type="button" className="skill-voraus-knopf" onClick={() => wechseln(v)}>
                    <Punkte s={sp[v]} jetzt={jetzt} /> {vs.name}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        )}
        {quoten.length > 0 && (
          <div className="skill-absatz">
            <span className="kennzahl-label">Letzte Runden</span>
            <ol className="skill-verlauf" aria-label="Letzte Quoten">
              {quoten.map((q, i) => (
                <li key={i} title={`${Math.round(q.q * 100)} %`}>
                  <span className="skill-verlauf-saeule" style={{ height: `${Math.max(4, q.q * 100)}%` }} />
                  <span className="skill-verlauf-zahl">{Math.round(q.q * 100)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!s.uebung && s.extern && <p className="skill-extern text-sm">{s.extern}</p>}

        {s.uebung ? (
          kannUeben(s)
            ? <button type="button" className="knopf w-full" onClick={() => ueben(s)}>▶ Üben</button>
            : <button type="button" className="knopf knopf-leise w-full" disabled>Üben — kommt gleich</button>
        ) : (
          <button type="button" className="knopf knopf-leise w-full" aria-pressed={heuteGeuebt} disabled={heuteGeuebt} onClick={() => skillGeuebt(s.id)}>
            {heuteGeuebt ? '✓ Heute geübt' : 'Heute geübt'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function MarkierungsWahl({ id, m, schliessen }: { id: string; m: Markierung; schliessen: () => void }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  useEscape(schliessen);
  const s = skillFinden(id);
  const waehlen = (neu: Markierung) => { skillMarkieren(id, neu); schliessen(); };
  const ERKLAERUNG: Record<Markierung, string> = {
    offen: 'nicht markiert', will: 'auf die Liste für später', lerne: 'gerade dran — kommt in „Heute“ zuerst',
    kann: 'selbst eingeschätzt — zählt als sicher', pause: 'gerade nicht — nie in „Heute“',
  };
  return createPortal(
    <div className="blatt-hintergrund skill-wahl-hintergrund" onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt skill-wahl" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <span className="kennzahl-label">Markierung</span>
            <h2 id={kopf} className="truncate text-base font-bold">{s?.name ?? id}</h2>
          </div>
          <button type="button" className="panel-zu" onClick={schliessen} aria-label="Schließen"><ZuSymbol /></button>
        </div>
        <ul className="skill-wahl-liste" role="radiogroup" aria-labelledby={kopf}>
          {MARKIERUNGEN.map((x) => (
            <li key={x}>
              <button type="button" role="radio" aria-checked={x === m} onClick={() => waehlen(x)}>
                <span className={`skill-chip ${x}`}>{x === 'offen' ? 'Offen' : MARKIERUNG_NAMEN[x]}</span>
                <span className="skill-wahl-text">{ERKLAERUNG[x]}</span>
                <span className="skill-wahl-haken" aria-hidden="true">{x === m ? '✓' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
