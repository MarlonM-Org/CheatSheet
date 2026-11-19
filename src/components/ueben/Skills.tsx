'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StufenId } from '@/domain/gehoer';
import {
  BEREICHE, SKILLS, bereichFinden, skillFinden, type HoerUebungId, type Skill, type SkillUebung, type SkillWerkzeug,
} from '@/domain/skillkatalog';
import {
  andererVorschlag, BLOCK_MINUTEN, BLOECKE_MAX, FILTER, FILTER_NAMEN, heuteFestschreiben, heuteVorschlag, hoechsteStufe, imFilter,
  istAuffuellung, MARKIERUNG_NAMEN, MARKIERUNGEN, markierungVon, STUFE_MAX, STUFE_NAMEN, uebersicht, verblasst, wirksameStufe, WOCHENZIEL,
  wocheEinheiten, zuletztText, type Filter, type HeuteBlock, type HeuteStand, type Markierung, type SkillSpeicher, type SkillStand,
} from '@/domain/skills';
import { useEinstellungenGeladen } from './klang';
import { DroneBlatt } from './Drone';
import { EtuedenBlatt } from './Etueden';
import { GriffeBlatt } from './Griffe';
import { HoerUebungBlatt } from './HoerUebung';
import { JamKarteBlatt } from './JamKarte';
import { LicksBlatt } from './Licks';
import { OhrTrainerBlatt } from './OhrTrainer';
import { SpickzettelBlatt } from './Spickzettel';
import { TransponierBlatt } from './Transponieren';
import { heuteLaden, heuteSpeichern, SKILLS_GEAENDERT, skillErgebnis, skillGeuebt, skillMarkieren, skillsLaden } from './skillspeicher';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';

// Skill-Kartei (I-07): Gesamtsicht, was ich kann, was ich lernen will, was
// verblasst — und „Heute“ (I-09), das oben auf der Lernen-Seite steht (B-18).
// Regeln in @/domain/skills, Katalog in @/domain/skillkatalog. Auswahl,
// Detail und Übungen legen sich als Blatt über die Liste — nichts verschiebt sich.

export type HoerUebungStarten = (id: HoerUebungId, skillId: string) => void;

// Ein Block (Swing, Zunge) öffnet das volle Metronom: Es gehört der Zentrale
// (Widget und Dialog), darum ein Ereignis statt eines Blatts.
export const METRONOM_ZEIGEN = 'ueben:metronom-zeigen';

const WERKZEUG_NAMEN: Record<SkillWerkzeug['art'], string> = {
  etueden: 'Etüden', licks: 'Licks', jam: 'Jam-Karte', spick: 'Spickzettel', drone: 'Drone', griffe: 'Griffweisen', trans: 'Transponieren',
  metronom: 'Metronom',
};
const uebungName = (u: SkillUebung) => (u.art === 'ohr' ? 'Ohr-Trainer' : 'Hör-Übung');

// Das Werkzeug eines Skills, voreingestellt (Muster, Lick, Stück, Akkord, Ton).
function WerkzeugBlatt({ w, schliessen }: { w: SkillWerkzeug; schliessen: () => void }) {
  switch (w.art) {
    case 'etueden': return <EtuedenBlatt schliessen={schliessen} muster={w.muster} />;
    case 'licks': return <LicksBlatt schliessen={schliessen} lick={w.lick} />;
    case 'jam': return <JamKarteBlatt schliessen={schliessen} stueck={w.stueck} />;
    case 'spick': return <SpickzettelBlatt schliessen={schliessen} akkord={w.akkord} eingabe="notiert" />;
    case 'drone': return <DroneBlatt schliessen={schliessen} grundton={w.grundton} />;
    case 'griffe': return <GriffeBlatt schliessen={schliessen} midi={w.midi} />;
    case 'trans': return <TransponierBlatt schliessen={schliessen} />;
    case 'metronom': return null;
  }
}

// Übung (Ohr-Trainer, Hör-Übung) oder Werkzeug eines Skills öffnen — für
// Kartei und „Heute“ gleich. Jede Runde und jedes „Geübt“ im Werkzeug zählt
// auf den Skill; damit ist auch sein Block in „Heute“ erledigt.
function useUeben(hoerUebungStarten?: HoerUebungStarten) {
  const [ohr, setOhr] = useState<StufenId | null>(null);
  const [hoer, setHoer] = useState<{ id: HoerUebungId; skillId: string } | null>(null);
  const [werkzeug, setWerkzeug] = useState<SkillWerkzeug | null>(null);
  const ueben = (s: Skill) => {
    if (s.uebung?.art === 'ohr') setOhr(s.uebung.stufe);
    else if (s.uebung) (hoerUebungStarten ?? ((id, skillId) => setHoer({ id, skillId })))(s.uebung.id, s.id);
  };
  const oeffnen = (w: SkillWerkzeug) => {
    if (w.art === 'metronom') window.dispatchEvent(new Event(METRONOM_ZEIGEN));
    else setWerkzeug(w);
  };
  const blaetter = (<>
    {ohr && <OhrTrainerBlatt stufe={ohr} schliessen={() => setOhr(null)} />}
    {hoer && <HoerUebungBlatt uebung={hoer.id} schliessen={() => setHoer(null)} beiErgebnis={(r) => skillErgebnis(hoer.skillId, r.quote)} />}
    {werkzeug && <WerkzeugBlatt w={werkzeug} schliessen={() => setWerkzeug(null)} />}
  </>);
  return { ueben, oeffnen, offen: ohr !== null || hoer !== null || werkzeug !== null, blaetter };
}

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

// Einstieg auf der Lernen-Seite unter „Mein Stand“. `offenMelden`: die
// Seite lässt Escape dem offenen Blatt.
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
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { sp, jetzt } = useSkillDaten();
  const [filter, setFilter] = useState<Filter>('alle');
  const [detail, setDetail] = useState<string | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  // Übung oder Werkzeug (Hör-Übung von außen, falls jemand eine Startfunktion mitgibt).
  const uebung = useUeben(hoerUebungStarten);

  const zu = () => schliessen();
  useEscape(zu, !detail && !wahl && !uebung.offen);

  const u = uebersicht(sp, jetzt);
  const anzahl = (f: Filter) => SKILLS.filter((s) => imFilter(sp[s.id], f, jetzt)).length;

  // Detail, Auswahl und Übung liegen neben (nicht in) dem Hintergrund: React
  // reicht Klicks durch Portale an die Eltern weiter — ein Tipp dort schlösse sonst alles.
  return (<>{createPortal(
    <div className={`blatt-hintergrund${seite.klasse}`} onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt skill-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <span className="mix-symbol"><KarteiSymbol /></span>
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">Skills</h2>
            <p className="gedaempft text-sm"><strong className="skill-sicher-zahl">{u.sicher} von {u.gesamt}</strong> sicher</p>
          </div>
          <button type="button" className="panel-zu" onClick={zu} aria-label="Schließen"><ZuSymbol /></button>
        </div>

        <BereichsBalken bereiche={u.bereiche} />

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
    seite.ziel,
  )}
      {detail && (
        <SkillDetail id={detail} sp={sp} jetzt={jetzt} aktiv={!wahl} schliessen={() => setDetail(null)} wechseln={setDetail}
          markierungAendern={() => setWahl(detail)} ueben={uebung.ueben} oeffnen={uebung.oeffnen} />
      )}
      {wahl && <MarkierungsWahl id={wahl} m={markierungVon(sp[wahl])} schliessen={() => setWahl(null)} />}
      {uebung.blaetter}
  </>);
}

// Stand je Bereich: ein Balken je Bereich, „sicher von gesamt“.
function BereichsBalken({ bereiche }: { bereiche: ReturnType<typeof uebersicht>['bereiche'] }) {
  return (
    <ul className="skill-bereiche" aria-label="Je Bereich">
      {bereiche.map((b) => (
        <li key={b.bereich}>
          <span className="skill-bereich-name">{b.name}</span>
          <span className="skill-bereich-zahl">{b.sicher}/{b.gesamt}</span>
          <span className="skill-balken" aria-hidden="true"><span style={{ width: `${(b.sicher / b.gesamt) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

// „Mein Stand“ auf der Lernen-Seite: die Balken der Kartei, ohne sie zu öffnen.
export function SkillStand() {
  const { sp, jetzt } = useSkillDaten();
  return <BereichsBalken bereiche={uebersicht(sp, jetzt).bereiche} />;
}

// „Heute“ (I-09) oben auf der Lernen-Seite (B-18): bis zu drei Blöcke à 10
// Minuten aus den „Lerne ich“-Skills (Regeln in @/domain/skills), Wochenstand,
// „Anderer Vorschlag“. Jeder Block sagt, was zu tun ist, und öffnet die
// Übung oder das passende Werkzeug; ohne beides „Erledigt“. Erledigt ist ein
// Block, sobald sein Skill heute geübt wurde (Runde, „Geübt“ im Werkzeug,
// „Erledigt“). Der gezeigte Plan wird festgehalten — Üben verschiebt nichts;
// jeder Block hat eine feste Höhe, Tauschen ändert nur seinen Inhalt.
// `blattMelden`: die Seite lässt Escape dem offenen Blatt.
export function HeuteAbschnitt({ blattMelden }: { blattMelden?: (offen: boolean) => void }) {
  const { sp, jetzt } = useSkillDaten();
  const [heute, setHeute] = useState<HeuteStand>(() => heuteLaden());
  const [detail, setDetail] = useState<string | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  const [kartei, setKartei] = useState(false);
  const uebung = useUeben();
  const offen = detail !== null || wahl !== null || kartei || uebung.offen;
  useEffect(() => { blattMelden?.(offen); }, [offen, blattMelden]);

  const v = useMemo(() => heuteVorschlag(heute, sp, jetzt), [heute, sp, jetzt]);
  // Gezeigt heißt festgehalten: der Plan des Tages, und ist alles erledigt, die
  // Einheit. Gleich im Rendern übernommen (festschreiben ist idempotent), am Gerät gespeichert.
  const fest = heuteFestschreiben(heute, v, jetzt);
  if (fest !== heute) setHeute(fest);
  useEffect(() => { heuteSpeichern(heute); }, [heute]);

  const woche = wocheEinheiten(heute, jetzt);
  const n = v.bloecke.length;
  const kartenKnopf = (leise: boolean) => (
    <button type="button" className={`knopf knopf-klein${leise ? ' knopf-leise' : ''}`} aria-haspopup="dialog" onClick={() => setKartei(true)}>Skills ›</button>
  );

  return (<>
    <section className="skill-heute" aria-label="Heute">
      <div className="skill-heute-kopf">
        <strong>{v.lerne && n ? `Heute · ${n * BLOCK_MINUTEN} Min.` : 'Heute'}</strong>
        <span className={v.fertig ? 'skill-woche fertig' : 'skill-woche'}>{v.fertig ? '✓ geschafft · ' : ''}{woche} von {WOCHENZIEL} Einheiten</span>
      </div>
      {n > 0 && (
        <ol className="skill-heute-bloecke" style={{ ['--bloecke' as string]: n }}>
          {v.bloecke.map((b, i) => (
            <HeuteBlockZeile key={i} b={b} detail={() => setDetail(b.skill.id)} ueben={() => uebung.ueben(b.skill)}
              oeffnen={uebung.oeffnen} erledigen={() => skillGeuebt(b.skill.id)}
              anderer={() => setHeute(andererVorschlag(heute, i, sp, jetzt))} />
          ))}
        </ol>
      )}
      {!v.lerne ? (
        <div className="skill-heute-hinweis">
          <p>Markiere in der Skill-Kartei, was du gerade lernst („Lerne ich“). Daraus stellt „Heute“ bis zu drei Blöcke à 10 Minuten zusammen.</p>
          {kartenKnopf(false)}
        </div>
      ) : n < BLOECKE_MAX && (
        <div className="skill-heute-hinweis">
          <p>Nur {n === 1 ? 'ein Block' : `${n} Blöcke`}: Markiere mehr Skills mit „Lerne ich“ oder ☆, dann sind es 30 Minuten.</p>
          {kartenKnopf(true)}
        </div>
      )}
    </section>

      {detail && (
        <SkillDetail id={detail} sp={sp} jetzt={jetzt} aktiv={!wahl} schliessen={() => setDetail(null)} wechseln={setDetail}
          markierungAendern={() => setWahl(detail)} ueben={uebung.ueben} oeffnen={uebung.oeffnen} />
      )}
      {wahl && <MarkierungsWahl id={wahl} m={markierungVon(sp[wahl])} schliessen={() => setWahl(null)} />}
      {kartei && <SkillsBlatt schliessen={() => setKartei(false)} />}
      {uebung.blaetter}
  </>);
}

// Ein Block: warum er da ist, Skill (oben rechts „Anderer Vorschlag“), Aufgabe,
// unten Übung/Werkzeug links und „Erledigt“ rechts. Unsichtbares behält seinen Platz.
function HeuteBlockZeile({ b, detail, ueben, oeffnen, erledigen, anderer }: {
  b: HeuteBlock; detail: () => void; ueben: () => void; oeffnen: (w: SkillWerkzeug) => void; erledigen: () => void; anderer: () => void;
}) {
  const s = b.skill;
  const art = b.art === 'lerne' ? `Lerne ich · ${bereichFinden(s.bereich).name}`
    : b.art === 'will' ? 'Aufgefüllt · ☆ Will ich'
      : b.art === 'verblasst' ? 'Aufgefüllt · verblasst'
        : bereichFinden(s.bereich).name;
  return (
    <li className={b.erledigt ? 'erledigt' : ''}>
      <div className="skill-heute-oben">
        <span className={`kennzahl-label skill-heute-art${istAuffuellung(b.art) ? ' aufgefuellt' : ''}`}>{art}</span>
        <button type="button" className="skill-heute-name" aria-haspopup="dialog" onClick={detail}><span>{s.name}</span></button>
        <button type="button" className="skill-anderer" onClick={anderer} aria-label={`Anderer Vorschlag statt „${s.name}“`} title="Anderer Vorschlag"
          style={{ visibility: b.tauschbar ? 'visible' : 'hidden' }} tabIndex={b.tauschbar ? 0 : -1}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15M21 20v-5h-5" /></svg>
        </button>
      </div>
      <p className="skill-heute-aufgabe">{s.aufgabe}</p>
      <div className="skill-heute-knoepfe">
        {s.uebung ? (
          <button type="button" className="knopf knopf-klein skill-heute-werkzeug" onClick={ueben}>▶ {uebungName(s.uebung)}</button>
        ) : s.werkzeug ? (
          <button type="button" className={`knopf knopf-klein skill-heute-werkzeug${b.erledigt ? ' knopf-leise' : ''}`} onClick={() => oeffnen(s.werkzeug!)}>
            ▶ {WERKZEUG_NAMEN[s.werkzeug.art]}
          </button>
        ) : null}
        {b.erledigt ? <span className="skill-heute-fertig">✓ Erledigt</span>
          : !s.uebung && <button type="button" className="knopf knopf-leise knopf-klein skill-heute-los" onClick={erledigen}>Erledigt</button>}
      </div>
    </li>
  );
}

// Detail eines Skills. „Üben“ und das Werkzeug schließen erst das Detail: Auf
// dem iPad liegen Übungen und Werkzeuge als Seite unter den kleinen Blättern.
function SkillDetail({ id, sp, jetzt, aktiv, schliessen, wechseln, markierungAendern, ueben, oeffnen }: {
  id: string; sp: SkillSpeicher; jetzt: number; aktiv: boolean;
  schliessen: () => void; wechseln: (id: string) => void; markierungAendern: () => void;
  ueben: (s: Skill) => void; oeffnen: (w: SkillWerkzeug) => void;
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
        <div className="skill-absatz">
          <span className="kennzahl-label">So übst du · {BLOCK_MINUTEN} Min.</span>
          <p>{s.aufgabe}</p>
        </div>
        {!s.uebung && !s.werkzeug && s.extern && <p className="skill-extern text-sm">{s.extern}</p>}

        {s.uebung ? (
          <button type="button" className="knopf w-full" onClick={() => { schliessen(); ueben(s); }}>▶ {uebungName(s.uebung)}</button>
        ) : (<>
          {s.werkzeug && (
            <button type="button" className="knopf w-full" onClick={() => { schliessen(); oeffnen(s.werkzeug!); }}>▶ {WERKZEUG_NAMEN[s.werkzeug.art]}</button>
          )}
          <button type="button" className="knopf knopf-leise w-full" aria-pressed={heuteGeuebt} disabled={heuteGeuebt} onClick={() => skillGeuebt(s.id)}>
            {heuteGeuebt ? '✓ Heute geübt' : 'Heute geübt'}
          </button>
        </>)}
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
    offen: 'nicht markiert', will: 'für später — füllt „Heute“ auf, solange weniger als drei „Lerne ich“',
    lerne: 'gerade dran — steht in „Heute“', kann: 'selbst eingeschätzt — zählt als sicher', pause: 'gerade nicht — nie in „Heute“',
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
