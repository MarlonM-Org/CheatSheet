'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { akkordLesen, akkordText, akkordTransponieren, akkordKlaenge, STIMMUNG_NAMEN, tonartName, tonartSymbol, tonartTransponieren, vorzeichen, vorzeichenText, type Akkord } from '@/domain/akkorde';
import { beispielAbc, jamRahmen, jamTakteNotiert, notationsTonart } from '@/domain/akkordrahmen';
import {
  BEGLEIT_STILE, begleitKlicks, begleitungBauen, BEISPIEL_NAMEN, beispielLinie, folgeAlsSymbole, STIL_NAMEN, stilAusGefuehl, tempoAusGefuehl,
  type BegleitStil, type BeispielArt,
} from '@/domain/begleitung';
import {
  entwurfAlsText, entwurfAusText, JAM_SCHLUESSEL, jamAlle, jamAlsEingabe, jamAusEingabe, jamEntfernen, jamLesen, jamNotiert, jamSpeichern, jamStueckeLesen,
  naechsterTeilName, zeilen, type JamEingabe, type JamStueck, type TeilEntwurf,
} from '@/domain/jamkarte';
import { skillFinden } from '@/domain/skillkatalog';
import type { Stimmung } from '@/domain/ueben';
import { AbcZeile } from './AbcZeile';
import { AkkordWahl } from './AkkordWahl';
import { useBegleiter } from './begleiter';
import { LautsprecherSchalter } from './lautsprecher';
import { EinspielenDialog } from './Einspielen';
import { gespeichert, speichern, useEinstellungenGeladen } from './klang';
import { skillGeuebt } from './skillspeicher';
import { SpickzettelBlatt, type Eingabe } from './Spickzettel';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';
import { useSeite } from './seite';
import { useVorspieler } from './vorspieler';

// Jam-Karte (I-19): Session-Stücke mit Form, Tonart und Akkorden je Takt —
// klingend gespeichert, für dich notiert gezeigt (Stimmung aus dem
// Stimmgerät), umschaltbar auf klingend. Ein Tipp auf einen Akkord öffnet
// den Spickzettel. Eigene Stücke: `ueben:jamkarte` (reist mit der
// Sicherung). „Heute gespielt“ zählt auf den Repertoire-Skill, wo es einen gibt.
// Regeln in @/domain/jamkarte.
//
// Seit 2026-11-19 (I-04): Begleitung zum Mitspielen (Bass, Klavier, Klick —
// Tempo, Klang und Lautstärke des Metronoms; ./begleiter), der klingende
// Takt leuchtet; „So übst du damit“ mit Hörbeispielen über der Begleitung;
// „Komponieren“ öffnet die Akkorde als leeres Notenblatt (Akkordrahmen);
// eigene Stücke lassen sich antippen statt tippen (./AkkordWahl).

const laden = () => jamStueckeLesen(gespeichert<unknown>(JAM_SCHLUESSEL, []));
const neueId = () => `eigen-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

// `stueck`: gleich dieses Stück zeigen (aus „Heute“, I-09), sonst die Liste.
export function JamKarteBlatt({ schliessen, stueck: anfang }: { schliessen: () => void; stueck?: string }) {
  const seite = useSeite();
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const { stimmung } = useStimmgeraetApi();
  const [eigene, setEigeneRoh] = useState<JamStueck[]>(laden);
  const [gewaehlt, setGewaehlt] = useState<string | null>(anfang ?? null);
  const [klingendZeigen, setKlingendZeigen] = useState(false);
  const [spick, setSpick] = useState<{ akkord: string; eingabe: Eingabe } | null>(null);
  const [formular, setFormular] = useState<{ stueck: JamStueck | null } | null>(null);
  const [gespielt, setGespielt] = useState<Set<string>>(() => new Set());
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const [anleitung, setAnleitung] = useState(false);
  const [komponieren, setKomponieren] = useState(false);
  const [meldung, setMeldung] = useState('');
  useEinstellungenGeladen(useCallback(() => setEigeneRoh(laden()), []));
  // Eine Begleitung für die ganze Jam-Karte: läuft weiter, wenn sich ein Blatt darüberlegt.
  const begleiter = useBegleiter();

  const setEigene = (neu: JamStueck[]) => { setEigeneRoh(neu); speichern(JAM_SCHLUESSEL, neu); };
  const alle = useMemo(() => jamAlle(eigene), [eigene]);
  const stueck = gewaehlt ? alle.find((s) => s.id === gewaehlt) ?? null : null;
  const notiertZeigen = stimmung !== 'C' && !klingendZeigen;

  const zurueck = () => { begleiter.stoppen(); setGewaehlt(null); setLoeschenFragen(false); setMeldung(''); };
  const zu = () => (stueck ? zurueck() : schliessen());
  useEscape(zu, !spick && !formular && !anleitung && !komponieren);

  const oeffnen = (id: string) => { setGewaehlt(id); setLoeschenFragen(false); setMeldung(''); };
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
          <StueckAnsicht key={stueck.id} stueck={stueck} notiertZeigen={notiertZeigen} stimmung={stimmung} begleiter={begleiter}
            umschalten={stimmung !== 'C' ? () => setKlingendZeigen((k) => !k) : undefined}
            akkordTippen={(a) => setSpick({ akkord: a, eingabe: notiertZeigen ? 'notiert' : 'klingend' })}
            anleitung={() => setAnleitung(true)}
            komponieren={() => { begleiter.stoppen(); setMeldung(''); setKomponieren(true); }}
            meldung={meldung}
            gespielt={gespielt.has(stueck.id)} heuteGespielt={() => heuteGespielt(stueck)}
            bearbeiten={stueck.eigen ? () => setFormular({ stueck }) : undefined}
            loeschenFragen={loeschenFragen} setLoeschenFragen={setLoeschenFragen}
            loeschen={stueck.eigen ? () => { setEigene(jamEntfernen(eigene, stueck.id)); zurueck(); } : undefined} />
        )}
      </div>
    </div>,
    seite.ziel,
  )}
  {spick && <SpickzettelBlatt akkord={spick.akkord} eingabe={spick.eingabe} ueber schliessen={() => setSpick(null)} />}
  {anleitung && stueck && (
    <JamAnleitung stueck={stueck} stimmung={stimmung} begleiter={begleiter} schliessen={() => setAnleitung(false)}
      komponieren={() => { setAnleitung(false); begleiter.stoppen(); setMeldung(''); setKomponieren(true); }} />
  )}
  {komponieren && stueck && (
    <EinspielenDialog quelle="leer" rahmen={jamRahmen(stueck, stimmung)} sammlungen={[]} tags={[]}
      fertig={(m) => { setKomponieren(false); setMeldung(`${m} Es liegt in der Bibliothek.`); }}
      schliessen={() => setKomponieren(false)} />
  )}
  {formular && (
    <JamFormular stueck={formular.stueck} stimmung={stimmung} schliessen={() => setFormular(null)}
      sichern={(s) => { setEigene(jamSpeichern(eigene, s)); setFormular(null); begleiter.stoppen(); setGewaehlt(s.id); setLoeschenFragen(false); }} />
  )}
  </>);
}

type Begleiter = ReturnType<typeof useBegleiter>;

// Ungefähre Breite eines Akkordsymbols in em (fett): schmale Zeichen schmal, m breit.
const breiteEm = (t: string) => [...t].reduce((s, c) => s + (/[mMW]/.test(c) ? 0.92 : /[0-9]/.test(c) ? 0.62 : /[♭♯°ø+/()]/.test(c) ? 0.52 : /[a-z]/.test(c) ? 0.58 : 0.74), 0);

function StueckAnsicht({ stueck, notiertZeigen, stimmung, begleiter, umschalten, akkordTippen, anleitung, komponieren, meldung, gespielt, heuteGespielt, bearbeiten, loeschen, loeschenFragen, setLoeschenFragen }: {
  stueck: JamStueck; notiertZeigen: boolean; stimmung: Stimmung; begleiter: Begleiter;
  umschalten?: () => void; akkordTippen: (ascii: string) => void;
  anleitung: () => void; komponieren: () => void; meldung: string;
  gespielt: boolean; heuteGespielt: () => void;
  bearbeiten?: () => void; loeschen?: () => void; loeschenFragen: boolean; setLoeschenFragen: (b: boolean) => void;
}) {
  const klingend = useMemo(() => jamLesen(stueck), [stueck]);
  const g = useMemo(() => (notiertZeigen ? jamNotiert(klingend, stimmung) : klingend), [klingend, notiertZeigen, stimmung]);
  const skill = stueck.skill ? skillFinden(stueck.skill) : undefined;
  // Taktnummer am Anfang jeder Zeile, über die Teile durchgezählt.
  const beginn = g.teile.map((_, i) => g.teile.slice(0, i).reduce((n, t) => n + t.folge.takte.length, 0));
  // Gleich große Akkorde im ganzen Stück: die Schrift richtet sich nach dem vollsten Takt (Akkorde × längstes Symbol).
  const em = useMemo(() => Math.max(2.4, ...g.teile.flatMap((t) => t.folge.takte).map((t) =>
    t.akkorde.length * (Math.max(...t.akkorde.map((a) => breiteEm(akkordText(a)))) + 0.3))), [g]);
  // Teilnamen: mehrere kurze links neben dem Raster, lange darüber, ein einziger Teil ohne Namen (die Form steht im Kopf).
  const mehrere = g.teile.length > 1;
  const seitlich = mehrere && g.teile.every((t) => t.name.length <= 2);

  // Begleitung: aus den notierten Akkorden, gespielt mit der Stimmung (klingt richtig, egal was angezeigt wird).
  const [stil, setStilRoh] = useState<BegleitStil>(() => stilAusGefuehl(stueck.gefuehl));
  const [klick, setKlickRoh] = useState(true);
  const takteNotiert = useMemo(() => jamTakteNotiert(stueck, stimmung), [stueck, stimmung]);
  const begleitung = useMemo(() => begleitungBauen(takteNotiert, stil), [takteNotiert, stil]);
  const sessionTempo = tempoAusGefuehl(stueck.gefuehl);
  const start = () => begleiter.starten({ takte: begleitung, klicks: klick ? begleitKlicks(stil) : null, schlaege: 4, stimmung, schleife: true, einzaehlen: true });
  const setStil = (s: BegleitStil) => { setStilRoh(s); if (begleiter.laeuft) begleiter.tauschen({ takte: begleitungBauen(takteNotiert, s), klicks: klick ? begleitKlicks(s) : null }); };
  const setKlick = (an: boolean) => { setKlickRoh(an); if (begleiter.laeuft) begleiter.tauschen({ takte: begleitung, klicks: an ? begleitKlicks(stil) : null }); };
  const jetzt = begleiter.laeuft ? begleiter.takt : null;

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

      {/* Begleitung: feste Höhe, beim Abspielen wechseln nur die Beschriftungen. */}
      <div className="jam-begleitung" role="group" aria-label="Begleitung">
        <div className="et-tempo">
          <button type="button" className={`jam-start ${begleiter.laeuft ? 'laeuft' : ''}`} onClick={begleiter.laeuft ? begleiter.stoppen : start}
            aria-label={begleiter.laeuft ? 'Begleitung anhalten' : 'Begleitung abspielen'}>
            {begleiter.laeuft
              ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
          </button>
          <span className="et-tempo-zahl"><strong>{begleiter.bpm}</strong><span>BPM</span></span>
          <input type="range" min={40} max={240} step={2} value={begleiter.bpm} onChange={(e) => begleiter.setBpm(Number(e.target.value))} aria-label="Tempo (wie im Metronom)" />
          <button type="button" className="swing-chip" aria-pressed={klick} onClick={() => setKlick(!klick)} title={stil === 'swing' || stil === 'ballade' ? 'Klick auf 2 und 4' : 'Klick auf jedem Schlag'}>Klick</button>
        </div>
        <div className="hoer-gruppe jam-stile" role="group" aria-label="Stil der Begleitung">
          {BEGLEIT_STILE.map((s) => <button key={s} type="button" aria-pressed={stil === s} onClick={() => setStil(s)}>{STIL_NAMEN[s]}</button>)}
        </div>
        <p className="gedaempft text-xs jam-begleitung-stand" aria-live="polite">
          {jetzt === -1 ? 'Einzähler …'
            : jetzt !== null ? `Takt ${jetzt + 1} von ${takteNotiert.length} — läuft im Kreis`
              : `${stueck.gefuehl ? `${stueck.gefuehl}, ` : ''}Session etwa ${sessionTempo} — zum Üben gern langsamer. Tempo wie im Metronom.`}
        </p>
        {/* B-20: seit I-04 klingt die Jam-Karte selbst — dieselbe Wahl wie überall. */}
        <LautsprecherSchalter />
      </div>

      <div className={`jam-teile ${seitlich ? 'seitlich' : ''}`} style={{ ['--akkord-em' as string]: em.toFixed(2) }}>
        {g.teile.map((t, ti) => (
          <section key={ti} className="jam-teil" aria-label={`Teil ${t.name}`}>
            {mehrere && <span className="jam-teil-name">{t.name}</span>}
            <div className="jam-raster">
              {zeilen(t.folge.takte, 4).map((zeile, zi) => zeile.map((takt, i) => {
                const nr = beginn[ti] + zi * 4 + i;
                return (
                  <div key={`${zi}-${i}`} className={`jam-takt${jetzt === nr ? ' jetzt' : ''}`}>
                    {i === 0 && <span className="jam-taktnr">{nr + 1}</span>}
                    {takt.akkorde.map((a, ai) => (
                      <button key={ai} type="button" onClick={() => akkordTippen(akkordText(a, { ascii: true }))}>
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
      <p className={`text-xs ${meldung ? 'jam-meldung' : 'gedaempft'}`} role="status">{meldung || 'Tipp auf einen Akkord: Töne, Guide Tones, Leitern.'}</p>

      <div className="hoer-aktionen">
        <button type="button" className="knopf knopf-leise" onClick={anleitung}>So übst du damit</button>
        <button type="button" className="knopf knopf-leise" onClick={komponieren} title="Die Akkorde als leeres Notenblatt: schreiben oder aufnehmen, mit Begleitung">Komponieren</button>
      </div>
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

// ── So übst du damit (Übe-Anleitung mit Hörbeispielen) ──

const BEISPIEL_ARTEN: readonly BeispielArt[] = ['grundtoene', 'guidetones', 'arpeggien'];
const BEISPIEL_HINWEIS: Record<BeispielArt, string> = {
  grundtoene: 'Auf jede Eins der Grundton, so lang wie der Akkord.',
  guidetones: 'Terz oder Septime, immer die nächstliegende — die Linie bewegt sich kaum.',
  arpeggien: '1 – 3 – 5 – 7 in Vierteln, je Akkord aufwärts.',
};

function JamAnleitung({ stueck, stimmung, begleiter, schliessen, komponieren }: {
  stueck: JamStueck; stimmung: Stimmung; begleiter: Begleiter; schliessen: () => void; komponieren: () => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  useEscape(schliessen);
  const [art, setArt] = useState<BeispielArt>('guidetones');
  const [beispiel, setBeispiel] = useState<BeispielArt | null>(null);
  const stil = stilAusGefuehl(stueck.gefuehl);
  const takte = useMemo(() => jamTakteNotiert(stueck, stimmung), [stueck, stimmung]);
  const tonart = useMemo(() => notationsTonart(jamNotiert(jamLesen(stueck), stimmung).tonart), [stueck, stimmung]);
  const linie = useMemo(() => beispielLinie(takte, art), [takte, art]);
  // In der Notenzeile: kurze Formen ganz, lange die ersten acht Takte.
  const n = takte.length <= 16 ? takte.length : 8;
  const abc = useMemo(() => beispielAbc(linie.slice(0, n), folgeAlsSymbole(takte.slice(0, n)), tonart), [linie, takte, n, tonart]);
  const spielt = begleiter.laeuft && beispiel === art;
  const vorspielen = () => {
    if (spielt) { begleiter.stoppen(); return; }
    const band = begleitungBauen(takte, stil, { schleife: false });
    setBeispiel(art);
    begleiter.starten({ takte: band.map((t, i) => [...t, ...(linie[i] ?? [])]), klicks: begleitKlicks(stil), schlaege: 4, stimmung, schleife: false, einzaehlen: true });
  };
  const tempo = tempoAusGefuehl(stueck.gefuehl);

  return createPortal(
    <div className="blatt-hintergrund harmonie-ueber" onClick={(e) => { e.stopPropagation(); schliessen(); }}>
      <div ref={fokus} tabIndex={-1} className="blatt harmonie-blatt jam-anleitung" role="dialog" aria-modal="true" aria-labelledby={kopf} onClick={(e) => e.stopPropagation()}>
        <div className="mix-blatt-kopf">
          <div className="min-w-0 flex-1">
            <h2 id={kopf} className="text-xl font-extrabold">So übst du damit</h2>
            <p className="gedaempft text-sm">{stueck.titel} · mit Begleitung</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        <p className="text-sm">
          Die Begleitung spielt Bass, Klavier und Klick{stil === 'swing' || stil === 'ballade' ? ' (auf 2 und 4)' : ''} im Kreis — wie eine kleine Band.
          Fang langsam an, etwa bei zwei Dritteln des Session-Tempos ({Math.round((tempo * 2) / 3)} statt {tempo}). Jede Stufe ein paar
          Durchgänge, bis sie ohne Nachdenken geht — dann die nächste.
        </p>
        <ol className="jam-schritte">
          <li><strong>Form hören.</strong> Begleitung laufen lassen und mitlesen — der Takt, der klingt, leuchtet. Mitzählen, den Anfang der Form spüren. Noch nicht spielen.</li>
          <li><strong>Grundtöne.</strong> Auf jede Eins den Grundton des Akkords, lang ausgehalten. Dann dasselbe auswendig.</li>
          <li><strong>Guide Tones.</strong> Terz und Septime sagen, welcher Akkord es ist. Nimm jeweils den, der dem vorigen Ton am nächsten liegt: Aus der Septime wird oft die Terz des nächsten Akkords.</li>
          <li><strong>Arpeggien.</strong> 1–3–5–7 in Vierteln, je Akkord. Später abwärts oder ab der Terz.</li>
          <li><strong>Mit drei Tönen improvisieren.</strong> Drei Töne (etwa die Guide Tones des ersten Akkords) und nur Rhythmus damit. Weniger Töne, mehr Ausdruck.</li>
          <li><strong>Frage und Antwort.</strong> Zwei Takte spielen, zwei Takte Pause — in der Pause hörst du, wo die Form gerade ist.</li>
          <li><strong>Festhalten.</strong> „Komponieren“ öffnet die Akkorde als leeres Notenblatt mit Begleitung: einspielen oder einsingen, die App schreibt mit.</li>
        </ol>

        <div className="jam-beispiele">
          <span className="kennzahl-label">Hörbeispiele über der Begleitung</span>
          <div className="hoer-gruppe" role="group" aria-label="Hörbeispiel">
            {BEISPIEL_ARTEN.map((a) => <button key={a} type="button" aria-pressed={art === a} onClick={() => { if (spielt) begleiter.stoppen(); setArt(a); }}>{BEISPIEL_NAMEN[a]}</button>)}
          </div>
          <p className="gedaempft text-xs">{BEISPIEL_HINWEIS[art]} Notiert für {STIMMUNG_NAMEN[stimmung]}{n < takte.length ? ` · Takt 1–${n} von ${takte.length}` : ''}.</p>
          <AbcZeile abc={abc} hoehe={Math.ceil(n / 2) * 72} label={`${BEISPIEL_NAMEN[art]}: ${stueck.titel}`} />
          <div className="hoer-aktionen">
            <button type="button" className="knopf" onClick={vorspielen}>{spielt ? '■ Anhalten' : '▶ Anhören'}</button>
            <button type="button" className="knopf knopf-leise" onClick={komponieren}>Komponieren</button>
          </div>
          <p className="gedaempft text-xs jam-begleitung-stand" aria-live="polite">
            {spielt ? (begleiter.takt === -1 ? 'Einzähler …' : `Takt ${(begleiter.takt ?? 0) + 1} von ${takte.length}`) : `Einmal durch die Form, mit Einzähler, Tempo ${begleiter.bpm}.`}
          </p>
        </div>
        <p className="gedaempft text-xs">Ein Akkord ist unklar? In der Jam-Karte antippen: Töne, Guide Tones und passende Leiter.</p>
      </div>
    </div>,
    document.body,
  );
}

// ── Eigenes Stück ──

const LEER: JamEingabe = { titel: '', komponist: '', form: '', tonart: '', gefuehl: '', akkorde: 'A: ', notiz: '' };

function JamFormular({ stueck, stimmung, schliessen, sichern }: {
  stueck: JamStueck | null; stimmung: Stimmung;
  schliessen: () => void; sichern: (s: JamStueck) => void;
}) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const kopf = useId();
  const [e, setE] = useState<JamEingabe>(() => (stueck ? jamAlsEingabe(stueck) : LEER));
  const [richtung, setRichtung] = useState<'klingend' | 'notiert'>('klingend');
  const [fehler, setFehler] = useState<string[]>([]);
  // Akkorde antippen (Standard) oder als Text tippen.
  const [alsText, setAlsText] = useState(false);
  const [wahl, setWahl] = useState<{ teil: number; takt: number } | null>(null);
  const { spielen } = useVorspieler();
  useEscape(schliessen, !wahl);
  const feld = (k: keyof JamEingabe) => ({ value: e[k], onChange: (ev: { target: { value: string } }) => setE({ ...e, [k]: ev.target.value }) });
  const speichernKlick = () => {
    const r = jamAusEingabe(e, stueck?.id ?? neueId(), { richtung, stimmung });
    if (r.stueck) sichern(stueck?.skill ? { ...r.stueck, skill: stueck.skill } : r.stueck); else setFehler(r.fehler);
  };
  const teile = useMemo(() => entwurfAusText(e.akkorde), [e.akkorde]);
  const setTeile = (neu: TeilEntwurf[]) => setE((x) => ({ ...x, akkorde: entwurfAlsText(neu) }));
  const teilAendern = (i: number, t: Partial<TeilEntwurf>) => setTeile(teile.map((x, k) => (k === i ? { ...x, ...t } : x)));
  // Anhören: wie eingegeben — klingend wird für das Vorspielen notiert (der Vorspieler rechnet mit der Stimmung).
  const hoeren = (symbol: string) => {
    const a = akkordLesen(symbol);
    if (!a) return;
    const notiert: Akkord = richtung === 'klingend' && stimmung !== 'C' ? akkordTransponieren(a, stimmung, 'zuNotiert') : a;
    spielen(akkordKlaenge(notiert, { bpm: 140 }));
  };
  const zeige = (s: string) => { const a = akkordLesen(s); return a ? akkordText(a) : s; };

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
        <label className="jam-feld"><span className="kennzahl-label">Gefühl, Tempo (optional)</span><input className="feld" {...feld('gefuehl')} placeholder="Medium Swing, Bossa Nova" maxLength={80} /></label>
        {stimmung !== 'C' && (
          <div className="space-y-1">
            <span className="kennzahl-label">Tonart und Akkorde sind</span>
            <div className="hoer-gruppe" role="group" aria-label="Eingabe">
              <button type="button" aria-pressed={richtung === 'klingend'} onClick={() => setRichtung('klingend')}>klingend</button>
              <button type="button" aria-pressed={richtung === 'notiert'} onClick={() => setRichtung('notiert')}>notiert ({STIMMUNG_NAMEN[stimmung]})</button>
            </div>
          </div>
        )}

        <div className="jam-feld">
          <div className="jam-akkorde-kopf">
            <span className="kennzahl-label">Akkorde</span>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setAlsText(!alsText)}>{alsText ? 'Antippen' : 'Als Text'}</button>
          </div>
          {alsText ? (
            <textarea className="feld jam-akkorde" rows={5} {...feld('akkorde')} aria-label="Akkorde — je Teil eine Zeile"
              placeholder={'A: | Cm7 | F7 | Bbmaj7 | Ebmaj7 |\nB: | Am7b5 | D7 | Gm6 | % |'} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          ) : (
            <div className="jam-entwurf">
              {teile.map((t, ti) => (
                <section key={ti} className="jam-entwurf-teil" aria-label={`Teil ${t.name}`}>
                  <div className="jam-entwurf-kopf">
                    <input className="feld jam-teil-feld" value={t.name} maxLength={12} aria-label="Name des Teils"
                      onChange={(ev) => teilAendern(ti, { name: ev.target.value.replace(/[:\s]/g, '') || t.name })} />
                    <span className="gedaempft text-xs">{t.takte.length} {t.takte.length === 1 ? 'Takt' : 'Takte'}</span>
                    {teile.length > 1 && <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setTeile(teile.filter((_, k) => k !== ti))} aria-label={`Teil ${t.name} entfernen`}>✕</button>}
                  </div>
                  <div className="jam-raster jam-entwurf-raster">
                    {t.takte.map((takt, k) => (
                      <button key={k} type="button" className="jam-takt" onClick={() => setWahl({ teil: ti, takt: k })} aria-label={`Takt ${k + 1}: ${takt.join(' ')}`}>
                        {k % 4 === 0 && <span className="jam-taktnr">{k + 1}</span>}
                        {takt.map((s, si) => <span key={si} className={akkordLesen(s) ? '' : 'warnung'}>{zeige(s)}</span>)}
                      </button>
                    ))}
                    <button type="button" className="jam-takt jam-takt-neu" onClick={() => setWahl({ teil: ti, takt: t.takte.length })} aria-label="Takt anhängen">＋</button>
                  </div>
                </section>
              ))}
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setTeile([...teile, { name: naechsterTeilName(teile), takte: [] }])}>＋ Teil</button>
            </div>
          )}
        </div>
        <label className="jam-feld"><span className="kennzahl-label">Notiz (optional)</span><input className="feld" {...feld('notiz')} maxLength={1000} /></label>
        <div className="harmonie-fehlerzeile text-sm" aria-live="polite">
          {fehler.length ? <span className="warnung">{fehler.join(' · ')}</span> : <span className="gedaempft">Gespeichert wird klingend; gezeigt notiert für dein Instrument.</span>}
        </div>
        <button type="button" className="knopf w-full" onClick={speichernKlick}>Speichern</button>
      </div>
      {wahl && teile[wahl.teil] && (
        <AkkordWahl titel={`Teil ${teile[wahl.teil].name}${stimmung !== 'C' ? ` · ${richtung}` : ''}`} takte={teile[wahl.teil].takte} start={wahl.takt}
          aendern={(takte) => teilAendern(wahl.teil, { takte })} hoeren={hoeren} schliessen={() => setWahl(null)} />
      )}
    </div>,
    document.body,
  );
}
