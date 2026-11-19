'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { akkordText, STIMMUNG_NAMEN, tonartName, tonartSymbol, tonartTransponieren, vorzeichen, vorzeichenText } from '@/domain/akkorde';
import {
  JAM_SCHLUESSEL, jamAlle, jamAlsEingabe, jamAusEingabe, jamEntfernen, jamLesen, jamNotiert, jamSpeichern, jamStueckeLesen, zeilen,
  type JamEingabe, type JamStueck,
} from '@/domain/jamkarte';
import { skillFinden } from '@/domain/skillkatalog';
import type { Stimmung } from '@/domain/ueben';
import { gespeichert, speichern, useEinstellungenGeladen } from './klang';
import { begraben } from './lokal';
import { skillGeuebt } from './skillspeicher';
import { SpickzettelBlatt, type Eingabe } from './Spickzettel';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';

// Jam-Karte (I-19): Session-Stücke mit Form, Tonart und Akkorden je Takt —
// klingend gespeichert, für dich notiert gezeigt (Stimmung aus dem
// Stimmgerät), umschaltbar auf klingend. Ein Tipp auf einen Akkord öffnet
// den Spickzettel. Eigene Stücke: `ueben:jamkarte` (reist mit der
// Sicherung). „Heute gespielt“ zählt auf den Repertoire-Skill, wo es einen gibt.
// Regeln in @/domain/jamkarte.

const laden = () => jamStueckeLesen(gespeichert<unknown>(JAM_SCHLUESSEL, []));
const neueId = () => `eigen-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function JamKarteBlatt({ schliessen }: { schliessen: () => void }) {
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { stimmung } = useStimmgeraetApi();
  const [eigene, setEigeneRoh] = useState<JamStueck[]>(laden);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [klingendZeigen, setKlingendZeigen] = useState(false);
  const [spick, setSpick] = useState<{ akkord: string; eingabe: Eingabe } | null>(null);
  const [formular, setFormular] = useState<{ stueck: JamStueck | null } | null>(null);
  const [gespielt, setGespielt] = useState<Set<string>>(() => new Set());
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  useEinstellungenGeladen(useCallback(() => setEigeneRoh(laden()), []));

  const setEigene = (neu: JamStueck[]) => { setEigeneRoh(neu); speichern(JAM_SCHLUESSEL, neu); };
  const alle = useMemo(() => jamAlle(eigene), [eigene]);
  const stueck = gewaehlt ? alle.find((s) => s.id === gewaehlt) ?? null : null;
  const notiertZeigen = stimmung !== 'C' && !klingendZeigen;

  const zurueck = () => { setGewaehlt(null); setLoeschenFragen(false); };
  const zu = () => (stueck ? zurueck() : schliessen());
  useEscape(zu, !spick && !formular);

  const oeffnen = (id: string) => { setGewaehlt(id); setLoeschenFragen(false); };
  const heuteGespielt = (s: JamStueck) => {
    if (!s.skill) return;
    skillGeuebt(s.skill);
    setGespielt((g) => new Set(g).add(s.id));
  };

  return (<>{createPortal(
    <div className={`blatt-hintergrund${seite.klasse}`} onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt jam-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          {stueck && <button type="button" className="knopf knopf-leise knopf-klein" onClick={zurueck} aria-label="Zurück zur Liste">‹ Alle</button>}
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold leading-tight">{stueck ? stueck.titel : 'Jam-Karte'}</h2>
            <p className="gedaempft text-sm">
              {stueck ? [stueck.komponist, stueck.form].filter(Boolean).join(' · ') : `Session-Stücke — Akkorde notiert für ${STIMMUNG_NAMEN[stimmung]}`}
            </p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        {!stueck ? (
          <>
            <button type="button" className="knopf knopf-leise w-full" onClick={() => setFormular({ stueck: null })}>＋ Eigenes Stück</button>
            <ul className="jam-liste" aria-label="Stücke">
              {alle.map((s) => {
                const g = jamLesen(s);
                const n = g.tonart && stimmung !== 'C' ? tonartTransponieren(g.tonart, stimmung, 'zuNotiert') : g.tonart;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => oeffnen(s.id)}>
                      <span className="jam-zeile-text">
                        <span className="jam-titel">{s.titel}{s.eigen && <small className="jam-eigen">eigen</small>}</span>
                        <span className="gedaempft text-xs">{[s.komponist, s.form, s.gefuehl].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="jam-zeile-tonart">
                        <strong>{n ? tonartSymbol(n) : s.tonart}</strong>
                        {stimmung !== 'C' && g.tonart && <small>klingend {tonartSymbol(g.tonart)}</small>}
                      </span>
                      <span className="bib-pfeil" aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="gedaempft text-xs">Akkordfolgen wie bei Sessions üblich (Real Book/iReal) — Varianten gibt es überall; spielt deine Session anders, leg ein eigenes Stück an.</p>
          </>
        ) : (
          <StueckAnsicht stueck={stueck} notiertZeigen={notiertZeigen} stimmung={stimmung}
            umschalten={stimmung !== 'C' ? () => setKlingendZeigen((k) => !k) : undefined}
            akkordTippen={(a) => setSpick({ akkord: a, eingabe: notiertZeigen ? 'notiert' : 'klingend' })}
            gespielt={gespielt.has(stueck.id)} heuteGespielt={() => heuteGespielt(stueck)}
            bearbeiten={stueck.eigen ? () => setFormular({ stueck }) : undefined}
            loeschenFragen={loeschenFragen} setLoeschenFragen={setLoeschenFragen}
            loeschen={stueck.eigen ? () => { setEigene(jamEntfernen(eigene, stueck.id)); begraben('jamstueck', [stueck.id]); zurueck(); } : undefined} />
        )}
      </div>
    </div>,
    seite.ziel,
  )}
  {spick && <SpickzettelBlatt akkord={spick.akkord} eingabe={spick.eingabe} ueber schliessen={() => setSpick(null)} />}
  {formular && (
    <JamFormular stueck={formular.stueck} stimmung={stimmung} schliessen={() => setFormular(null)}
      sichern={(s) => { setEigene(jamSpeichern(eigene, s, Date.now())); setFormular(null); setGewaehlt(s.id); setLoeschenFragen(false); }} />
  )}
  </>);
}

function StueckAnsicht({ stueck, notiertZeigen, stimmung, umschalten, akkordTippen, gespielt, heuteGespielt, bearbeiten, loeschen, loeschenFragen, setLoeschenFragen }: {
  stueck: JamStueck; notiertZeigen: boolean; stimmung: Stimmung;
  umschalten?: () => void; akkordTippen: (ascii: string) => void;
  gespielt: boolean; heuteGespielt: () => void;
  bearbeiten?: () => void; loeschen?: () => void; loeschenFragen: boolean; setLoeschenFragen: (b: boolean) => void;
}) {
  const klingend = useMemo(() => jamLesen(stueck), [stueck]);
  const g = useMemo(() => (notiertZeigen ? jamNotiert(klingend, stimmung) : klingend), [klingend, notiertZeigen, stimmung]);
  const skill = stueck.skill ? skillFinden(stueck.skill) : undefined;
  // Taktnummer am Anfang jeder Zeile, über die Teile durchgezählt.
  const beginn = g.teile.map((_, i) => g.teile.slice(0, i).reduce((n, t) => n + t.folge.takte.length, 0));
  return (
    <div className="space-y-3">
      <div className="jam-info">
        <div>
          <span className="kennzahl-label">Tonart {notiertZeigen ? 'notiert' : 'klingend'}</span>
          <strong>{g.tonart ? tonartName(g.tonart) : stueck.tonart}</strong>
          <span className="gedaempft text-xs">{g.tonart ? vorzeichenText(vorzeichen(g.tonart)) : ''}{notiertZeigen && klingend.tonart ? ` · klingend ${tonartName(klingend.tonart)}` : ''}</span>
        </div>
        {umschalten && (
          <div className="hoer-gruppe" role="group" aria-label="Anzeige">
            <button type="button" aria-pressed={notiertZeigen} onClick={() => !notiertZeigen && umschalten()}>notiert</button>
            <button type="button" aria-pressed={!notiertZeigen} onClick={() => notiertZeigen && umschalten()}>klingend</button>
          </div>
        )}
      </div>
      {stueck.gefuehl && <p className="gedaempft text-sm">{stueck.gefuehl}</p>}

      <div className="jam-teile">
        {g.teile.map((t, ti) => (
          <section key={ti} className="jam-teil" aria-label={`Teil ${t.name}`}>
            <span className="jam-teil-name">{t.name}</span>
            <div className="jam-raster">
              {zeilen(t.folge.takte, 4).map((zeile, zi) => zeile.map((takt, i) => {
                return (
                  <div key={`${zi}-${i}`} className="jam-takt">
                    {i === 0 && <span className="jam-taktnr">{beginn[ti] + zi * 4 + 1}</span>}
                    {takt.akkorde.map((a, ai) => (
                      <button key={ai} type="button" className={takt.akkorde.length > 1 ? 'klein' : ''} onClick={() => akkordTippen(akkordText(a, { ascii: true }))}>
                        {akkordText(a)}
                      </button>
                    ))}
                  </div>
                );
              }))}
            </div>
          </section>
        ))}
      </div>
      {g.fehler.length > 0 && <p className="warnung text-sm">Nicht lesbar: {g.fehler.join(' · ')}</p>}
      {stueck.notiz && <p className="jam-notiz text-sm">{stueck.notiz}</p>}
      <p className="gedaempft text-xs">Tipp auf einen Akkord: Töne, Guide Tones, Leitern.</p>

      {skill && (
        <button type="button" className="knopf w-full" disabled={gespielt} onClick={heuteGespielt}>
          {gespielt ? `✓ Heute gespielt — zählt für „${skill.name}“` : 'Heute gespielt'}
        </button>
      )}
      {bearbeiten && loeschen && (
        <div className="hoer-aktionen">
          <button type="button" className="knopf knopf-leise" onClick={bearbeiten}>Bearbeiten</button>
          {loeschenFragen
            ? <button type="button" className="knopf knopf-gefahr" onClick={loeschen}>Wirklich löschen</button>
            : <button type="button" className="knopf knopf-leise" onClick={() => setLoeschenFragen(true)}>Löschen</button>}
        </div>
      )}
    </div>
  );
}

const LEER: JamEingabe = { titel: '', komponist: '', form: '', tonart: '', gefuehl: '', akkorde: '', notiz: '' };

function JamFormular({ stueck, stimmung, schliessen, sichern }: {
  stueck: JamStueck | null; stimmung: Stimmung;
  schliessen: () => void; sichern: (s: JamStueck) => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const [e, setE] = useState<JamEingabe>(() => (stueck ? jamAlsEingabe(stueck) : LEER));
  const [richtung, setRichtung] = useState<'klingend' | 'notiert'>('klingend');
  const [fehler, setFehler] = useState<string[]>([]);
  useEscape(schliessen);
  const feld = (k: keyof JamEingabe) => ({ value: e[k], onChange: (ev: { target: { value: string } }) => setE({ ...e, [k]: ev.target.value }) });
  const speichernKlick = () => {
    const r = jamAusEingabe(e, stueck?.id ?? neueId(), { richtung, stimmung });
    if (r.stueck) sichern(stueck?.skill ? { ...r.stueck, skill: stueck.skill } : r.stueck); else setFehler(r.fehler);
  };
  return createPortal(
    <div className="blatt-hintergrund harmonie-ueber" onClick={(ev) => { ev.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt jam-formular" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(ev) => ev.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <h2 id={kopf} className="min-w-0 flex-1 text-xl font-extrabold">{stueck ? 'Stück bearbeiten' : 'Eigenes Stück'}</h2>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Abbrechen</button>
        </div>
        <label className="jam-feld"><span className="kennzahl-label">Titel</span><input className="feld" {...feld('titel')} maxLength={120} /></label>
        <label className="jam-feld"><span className="kennzahl-label">Komponist (optional)</span><input className="feld" {...feld('komponist')} maxLength={120} /></label>
        <div className="jam-zwei">
          <label className="jam-feld"><span className="kennzahl-label">Tonart</span><input className="feld" {...feld('tonart')} placeholder="F, Bb, Cm" maxLength={12} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
          <label className="jam-feld"><span className="kennzahl-label">Form (optional)</span><input className="feld" {...feld('form')} placeholder="AABA" maxLength={80} /></label>
        </div>
        <label className="jam-feld"><span className="kennzahl-label">Gefühl, Tempo (optional)</span><input className="feld" {...feld('gefuehl')} placeholder="Medium Swing" maxLength={80} /></label>
        {stimmung !== 'C' && (
          <div className="space-y-1">
            <span className="kennzahl-label">Tonart und Akkorde sind</span>
            <div className="hoer-gruppe" role="group" aria-label="Eingabe">
              <button type="button" aria-pressed={richtung === 'klingend'} onClick={() => setRichtung('klingend')}>klingend</button>
              <button type="button" aria-pressed={richtung === 'notiert'} onClick={() => setRichtung('notiert')}>notiert ({STIMMUNG_NAMEN[stimmung]})</button>
            </div>
          </div>
        )}
        <label className="jam-feld">
          <span className="kennzahl-label">Akkorde — je Teil eine Zeile</span>
          <textarea className="feld jam-akkorde" rows={5} {...feld('akkorde')} placeholder={'A: | Cm7 | F7 | Bbmaj7 | Ebmaj7 |\nB: | Am7b5 | D7 | Gm6 | % |'} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        <label className="jam-feld"><span className="kennzahl-label">Notiz (optional)</span><input className="feld" {...feld('notiz')} maxLength={1000} /></label>
        <div className="harmonie-fehlerzeile text-sm" aria-live="polite">
          {fehler.length ? <span className="warnung">{fehler.join(' · ')}</span> : <span className="gedaempft">Gespeichert wird klingend; gezeigt notiert für dein Instrument.</span>}
        </div>
        <button type="button" className="knopf w-full" onClick={speichernKlick}>Speichern</button>
      </div>
    </div>,
    document.body,
  );
}
