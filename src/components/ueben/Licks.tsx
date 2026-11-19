'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { STIMMUNG_NAMEN, tonartAusKlasse, tonartLesen, tonartName, tonDeutsch } from '@/domain/akkorde';
import { abschnitteAbc, abschnitteKlaenge, ETUEDEN_TEMPO, UMFANG } from '@/domain/etueden';
import {
  BEWERTUNG_NAMEN, BEWERTUNGEN, faelligText, heuteFaellig, istStartLick, lickAbschnitt, lickAlle12, lickAlsEingabe, lickAusEingabe,
  lickBewerten, lickEntfernen, lickKlasse, lickLesen, lickSichern, lickSkills, licksAlle, licksLesen, lickTonart, LICKS_SCHLUESSEL,
  LICKS_STANDARD, STAERKE_MAX, startLicksZeigen, type Bewertung, type Lick, type LickEingabe, type LickSpeicher,
} from '@/domain/licks';
import { AbcZeile } from './AbcZeile';
import { takteFuer, useBreite } from './Etueden';
import { gespeichert, speichern, useEinstellungenGeladen } from './klang';
import { useKlickSpieler } from './klickspieler';
import { LautsprecherSchalter } from './lautsprecher';
import { skillGeuebt } from './skillspeicher';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';

// Lick-Sammlung (I-16): Licks relativ gespeichert, in jeder (notierten)
// Tonart oder allen zwölf gezeigt und vorgespielt (mit Klick und Vorzählen),
// nach dem Üben selbst eingeschätzt („sitzt / fast / noch nicht“) → „heute
// fällig“. Eigene Licks per Text oder Tipp-Tasten. Regeln in @/domain/licks;
// Speicher `ueben:licks` (reist mit der Sicherung).

const laden = (): LickSpeicher => licksLesen(gespeichert<unknown>(LICKS_SCHLUESSEL, LICKS_STANDARD));
const neueId = () => `eigen-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

function Staerke({ wert }: { wert: number }) {
  return (
    <span className="lk-staerke" aria-label={`Stärke ${wert} von ${STAERKE_MAX}`}>
      {Array.from({ length: STAERKE_MAX }, (_, i) => <span key={i} className={i < wert ? 'an' : ''} />)}
    </span>
  );
}

// `lick`: gleich diesen Lick zeigen (aus „Heute“, I-09), sonst die Liste.
export function LicksBlatt({ schliessen, lick: anfang }: { schliessen: () => void; lick?: string }) {
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { spielen, stopp, laeuft, stimmung } = useKlickSpieler();
  const [sp, setSpRoh] = useState<LickSpeicher>(laden);
  const [gewaehlt, setGewaehlt] = useState<string | null>(anfang ?? null);
  const [formular, setFormular] = useState<{ lick: Lick | null } | null>(null);
  const [jetzt] = useState(() => Date.now());
  useEinstellungenGeladen(useCallback(() => setSpRoh(laden()), []));

  const setSp = (neu: LickSpeicher) => { setSpRoh(neu); speichern(LICKS_SCHLUESSEL, neu); };
  const alle = useMemo(() => licksAlle(sp), [sp]);
  const faellige = useMemo(() => heuteFaellig(alle, sp.stand, jetzt), [alle, sp.stand, jetzt]);
  const lick = gewaehlt ? alle.find((l) => l.id === gewaehlt) ?? null : null;

  const zurueck = () => { stopp(); setGewaehlt(null); };
  const zu = () => { stopp(); schliessen(); };
  useEscape(() => (lick ? zurueck() : zu()), !formular);

  const zeile = (l: Lick) => {
    const st = sp.stand[l.id];
    return (
      <li key={l.id}>
        <button type="button" onClick={() => setGewaehlt(l.id)}>
          <span className="jam-zeile-text">
            <span className="jam-titel">{l.name}{!istStartLick(l.id) && <span className="jam-eigen">eigen</span>}</span>
            <span className="gedaempft text-xs">{[l.ueber, tonartName(lickTonart(l, lickKlasse(l)))].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="lk-zeile-stand">
            <Staerke wert={st?.staerke ?? 0} />
            <small>{faelligText(st, jetzt)}</small>
          </span>
        </button>
      </li>
    );
  };

  return (<>{createPortal(
    <div className={`blatt-hintergrund${seite.klasse}`} onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt lk-blatt" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          {lick && <button type="button" className="knopf knopf-leise knopf-klein" onClick={zurueck} aria-label="Zurück zur Liste">‹ Alle</button>}
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold leading-tight">{lick ? lick.name : 'Licks'}</h2>
            <p className="gedaempft text-sm">
              {lick ? (lick.ueber || 'Lick')
                : faellige.length ? `${faellige.length} heute fällig` : 'Heute ist nichts fällig'}
            </p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        {lick ? (
          <LickAnsicht key={lick.id} lick={lick} sp={sp} jetzt={jetzt} laeuft={laeuft} spielen={spielen} stopp={stopp}
            bewerten={(b) => { setSp(lickBewerten(sp, lick.id, b, Date.now())); for (const s of lickSkills(lick)) skillGeuebt(s); }}
            bearbeiten={istStartLick(lick.id) ? null : () => setFormular({ lick })}
            entfernen={() => { setSp(lickEntfernen(sp, lick.id)); zurueck(); }} />
        ) : (
          <>
            <button type="button" className="knopf knopf-leise w-full" onClick={() => setFormular({ lick: null })}>＋ Eigener Lick</button>
            {faellige.length > 0 && (
              <section className="space-y-1">
                <span className="kennzahl-label">Heute fällig</span>
                <ul className="jam-liste" aria-label="Heute fällig">{faellige.map(zeile)}</ul>
              </section>
            )}
            {alle.length > faellige.length && (
              <section className="space-y-1">
                <span className="kennzahl-label">{faellige.length ? 'Später' : 'Alle Licks'}</span>
                <ul className="jam-liste" aria-label="Später fällig">{alle.filter((l) => !faellige.includes(l)).map(zeile)}</ul>
              </section>
            )}
            <p className="gedaempft text-xs">Tonarten notiert für {STIMMUNG_NAMEN[stimmung]}.</p>
            {sp.aus.length > 0 && (
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setSp(startLicksZeigen(sp))}>
                {sp.aus.length} ausgeblendete Start-Licks wieder zeigen
              </button>
            )}
            <p className="gedaempft text-xs">Nach dem Üben einschätzen: Was sitzt, kommt seltener wieder (1, 2, 4, 8, 16 Tage), was noch nicht sitzt, morgen.</p>
          </>
        )}
      </div>
    </div>,
    seite.ziel,
  )}
  {formular && (
    <LickFormular lick={formular.lick} schliessen={() => setFormular(null)}
      sichern={(l) => { setSp(lickSichern(sp, l)); setFormular(null); setGewaehlt(l.id); }} />
  )}
  </>);
}

function LickAnsicht({ lick, sp, jetzt, laeuft, spielen, stopp, bewerten, bearbeiten, entfernen }: {
  lick: Lick; sp: LickSpeicher; jetzt: number; laeuft: boolean;
  spielen: ReturnType<typeof useKlickSpieler>['spielen']; stopp: () => void;
  bewerten: (b: Bewertung) => void; bearbeiten: (() => void) | null; entfernen: () => void;
}) {
  const [klasse, setKlasse] = useState<number | 'alle'>(() => lickKlasse(lick));
  const [bpm, setBpm] = useState(90);
  const [klick, setKlick] = useState(true);
  const [bewertet, setBewertet] = useState<Bewertung | null>(null);
  const [fragen, setFragen] = useState(false);
  const { ref, breite } = useBreite<HTMLDivElement>();
  const abschnitte = useMemo(() => (klasse === 'alle' ? lickAlle12(lick) : [lickAbschnitt(lick, klasse)]), [lick, klasse]);
  const abc = useMemo(() => abschnitteAbc(abschnitte, { takteJeZeile: takteFuer(breite, 6) }), [abschnitte, breite]);
  const st = sp.stand[lick.id];
  const waehlen = (k: number | 'alle') => { stopp(); setKlasse(k); };

  return (
    <>
      <div className="harmonie-grundtoene" role="group" aria-label="Tonart (notiert)">
        {Array.from({ length: 12 }, (_, k) => (
          <button key={k} type="button" aria-pressed={klasse === k} onClick={() => waehlen(k)}>
            {lick.moll ? tonDeutsch(tonartAusKlasse(k, true).grund).toLowerCase() : tonDeutsch(tonartAusKlasse(k, false).grund)}
          </button>
        ))}
      </div>
      <div className="hoer-gruppe et-segment" role="group" aria-label="Umfang">
        <button type="button" aria-pressed={klasse !== 'alle'} onClick={() => waehlen(klasse === 'alle' ? lickKlasse(lick) : klasse)}>Eine Tonart</button>
        <button type="button" aria-pressed={klasse === 'alle'} onClick={() => waehlen('alle')}>Alle 12 (Quarten)</button>
      </div>

      <div className="et-tempo">
        <span className="et-tempo-zahl"><strong>{bpm}</strong><span>BPM</span></span>
        <input type="range" min={ETUEDEN_TEMPO.von} max={ETUEDEN_TEMPO.bis} step={2} value={bpm} aria-label="Tempo"
          onChange={(e) => { stopp(); setBpm(Number(e.target.value)); }} />
        <button type="button" className="swing-chip" aria-pressed={klick} onClick={() => { stopp(); setKlick(!klick); }}>Klick</button>
      </div>
      {laeuft
        ? <button type="button" className="knopf w-full" onClick={stopp}>■ Stopp</button>
        : <button type="button" className="knopf w-full" onClick={() => spielen(abschnitteKlaenge(abschnitte, bpm, { klick, vorzaehlen: klick ? 4 : 0 }))}>▶ Vorspielen</button>}
      <LautsprecherSchalter />

      <div ref={ref} className="et-noten">
        {breite > 0 && <AbcZeile abc={abc} hoehe={klasse === 'alle' ? 900 : 110} umbrechen={false} label={`${lick.name}, Noten`} />}
      </div>

      <section className="lk-bewerten">
        <div className="lk-bewerten-kopf">
          <span className="kennzahl-label">Wie sitzt er?</span>
          <span className="gedaempft text-xs"><Staerke wert={st?.staerke ?? 0} /> {faelligText(st, jetzt)}</span>
        </div>
        <div className="hoer-gruppe et-segment" role="group" aria-label="Einschätzen">
          {BEWERTUNGEN.map((b) => (
            <button key={b} type="button" aria-pressed={bewertet === b} onClick={() => { setBewertet(b); bewerten(b); }}>{BEWERTUNG_NAMEN[b]}</button>
          ))}
        </div>
        <p className="gedaempft text-xs lk-hinweis">
          {bewertet ? 'Gespeichert — zählt auf „Licks lernen und transponieren“.' : 'Erst in ein paar Tonarten spielen, dann ehrlich einschätzen.'}
        </p>
      </section>

      <div className="hoer-aktionen">
        {bearbeiten && <button type="button" className="knopf knopf-leise" onClick={bearbeiten}>Bearbeiten</button>}
        {fragen
          ? <button type="button" className={`knopf knopf-gefahr${bearbeiten ? '' : ' breit'}`} onClick={entfernen}>{bearbeiten ? 'Wirklich löschen' : 'Wirklich ausblenden'}</button>
          : <button type="button" className={`knopf knopf-leise${bearbeiten ? '' : ' breit'}`} onClick={() => setFragen(true)}>{bearbeiten ? 'Löschen' : 'Ausblenden'}</button>}
      </div>
    </>
  );
}

// ── Eingabe ──

const TONTASTEN = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
const ZUSATZ: { zeichen: string; text: string; name: string }[] = [
  { zeichen: 'b', text: '♭', name: 'erniedrigt' }, { zeichen: '#', text: '♯', name: 'erhöht' },
  { zeichen: "'", text: '↑', name: 'Oktave höher' }, { zeichen: ',', text: '↓', name: 'Oktave tiefer' },
];
const DAUERN: { zeichen: string; text: string; name: string }[] = [
  { zeichen: '1', text: '1', name: 'Ganze' }, { zeichen: '2', text: '2', name: 'Halbe' }, { zeichen: '4', text: '4', name: 'Viertel' },
  { zeichen: '8', text: '8', name: 'Achtel' }, { zeichen: '16', text: '16', name: 'Sechzehntel' }, { zeichen: '.', text: '·', name: 'punktiert' },
  { zeichen: 't', text: '3er', name: 'triolisch' },
];
const LEER: LickEingabe = { name: '', ueber: '', tonart: 'C', text: '' };

function LickFormular({ lick, schliessen, sichern }: { lick: Lick | null; schliessen: () => void; sichern: (l: Lick) => void }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const [e, setE] = useState<LickEingabe>(() => (lick ? lickAlsEingabe(lick) : LEER));
  const [fehler, setFehler] = useState<string[]>([]);
  useEscape(schliessen);
  const { ref, breite } = useBreite<HTMLDivElement>();

  const tonart = tonartLesen(e.tonart);
  const vorschau = useMemo(() => {
    if (!tonart || !e.text.trim()) return null;
    const g = lickLesen(e.text, tonart);
    if (g.fehler.length) return { fehler: g.fehler, abc: null };
    const l: Lick = { id: 'vorschau', name: 'x', ueber: '', moll: tonart.moll, noten: g.noten, akkorde: g.akkorde, text: e.text, tonart: e.tonart };
    return { fehler: [], abc: abschnitteAbc([lickAbschnitt(l, lickKlasse(l), UMFANG.obenMax)], { takteJeZeile: takteFuer(breite, 6) }) };
  }, [e.text, e.tonart, tonart, breite]);

  const tippen = (z: string, neuerTon: boolean) => setE((x) => ({ ...x, text: neuerTon ? `${x.text.trimEnd()}${x.text.trim() ? ' ' : ''}${z}` : `${x.text.trimEnd()}${z}` }));
  const zurueck = () => setE((x) => ({ ...x, text: x.text.trimEnd().replace(/\s*\S+$/, '') }));
  const speichernKlick = () => {
    const r = lickAusEingabe(e, lick?.id ?? neueId());
    if (r.lick) sichern(r.lick); else setFehler(r.fehler);
  };

  return createPortal(
    <div className="blatt-hintergrund harmonie-ueber" onClick={(ev) => { ev.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt jam-formular" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(ev) => ev.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <h2 id={kopf} className="min-w-0 flex-1 text-xl font-extrabold">{lick ? 'Lick bearbeiten' : 'Eigener Lick'}</h2>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Abbrechen</button>
        </div>
        <label className="jam-feld"><span className="kennzahl-label">Name</span>
          <input className="feld" value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} maxLength={80} /></label>
        <div className="jam-zwei">
          <label className="jam-feld"><span className="kennzahl-label">Tonart (notiert)</span>
            <input className="feld" value={e.tonart} onChange={(ev) => setE({ ...e, tonart: ev.target.value })} placeholder="C, Bb, Am" maxLength={8}
              autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
          <label className="jam-feld"><span className="kennzahl-label">Über (optional)</span>
            <input className="feld" value={e.ueber} onChange={(ev) => setE({ ...e, ueber: ev.target.value })} placeholder="Blues, ii–V–I, m7" maxLength={40} /></label>
        </div>
        <label className="jam-feld"><span className="kennzahl-label">Töne</span>
          <textarea className="feld lk-text" rows={3} value={e.text} onChange={(ev) => setE({ ...e, text: ev.target.value })}
            placeholder={'"Dm7" D8 E8 F8 A8 | C4'} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} /></label>

        <div className="lk-tasten" role="group" aria-label="Tipp-Tasten">
          <div className="lk-reihe lk-reihe-7">
            {TONTASTEN.map((t) => <button key={t} type="button" onClick={() => tippen(t, true)}>{t}</button>)}
          </div>
          <div className="lk-reihe lk-reihe-7">
            {ZUSATZ.map((z) => <button key={z.zeichen} type="button" aria-label={z.name} onClick={() => tippen(z.zeichen, false)}>{z.text}</button>)}
            <button type="button" onClick={() => tippen('z', true)} aria-label="Pause">z</button>
            <button type="button" onClick={() => tippen('|', true)} aria-label="Taktstrich">|</button>
            <button type="button" onClick={zurueck} aria-label="Letztes löschen">⌫</button>
          </div>
          <div className="lk-reihe lk-reihe-7">
            {DAUERN.map((d) => <button key={d.zeichen} type="button" aria-label={d.name} onClick={() => tippen(d.zeichen, false)}>{d.text}</button>)}
          </div>
        </div>
        <p className="gedaempft text-xs">B = H, Bb = B♭. Dauer 1 2 4 8 16 (Ganze … Sechzehntel), „.“ punktiert, „t“ Triole, „z“ Pause; ohne Dauer gilt die vorige. Jeder Ton liegt dem vorigen am nächsten; ↑ (&apos;) höher, ↓ (,) tiefer. Akkord in Anführungszeichen: &quot;G7&quot;.</p>

        <div ref={ref} className="lk-vorschau">
          {vorschau?.abc && breite > 0 && <AbcZeile abc={vorschau.abc} hoehe={100} umbrechen={false} label="Vorschau" />}
          {(vorschau?.fehler.length || fehler.length) ? <p className="warnung text-sm">{[...new Set([...(vorschau?.fehler ?? []), ...fehler])].join(' · ')}</p> : null}
          {!vorschau && <p className="gedaempft text-sm">Vorschau erscheint beim Tippen.</p>}
        </div>
        <button type="button" className="knopf w-full" onClick={speichernKlick}>Speichern</button>
      </div>
    </div>,
    document.body,
  );
}
