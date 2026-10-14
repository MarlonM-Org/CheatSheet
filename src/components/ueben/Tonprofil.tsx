'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EINSTELLUNG_STANDARD, type Tonumfang } from '@/domain/einstellungen';
import { zeitpunkt } from '@/domain/notenpult';
import {
  kennzahlen, MESS_ANZAHL, messen, neigung, SAUBER, tonleiterHinweise, tonName, tonReihe, vergleich, type ProfilTon, type Tonprofil,
} from '@/domain/tonprofil';
import { gespeichert, speichern } from './klang';
import { tonprofilAnlegen, tonprofileLaden, tonprofilLoeschen } from './lokal';
import { speicherFehler } from './speicherfehler';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

// Tonprofil (C-04): Ton für Ton messen, welche Töne auf dem eigenen
// Instrument zu hoch oder zu tief liegen; datiert speichern und vergleichen;
// Hinweise für eine sauber intonierte Tonleiter. Regeln in @/domain/tonprofil.

const NAMEN = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
const STAMM = new Set([0, 2, 4, 5, 7, 9, 11]);
// „12.10., 18:30“ — mehrere Messungen am selben Tag bleiben unterscheidbar.
const datum = (t: number) => zeitpunkt(t);
const zahl = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}`;
const richtung = (c: number) => (Math.abs(c) <= SAUBER ? 'sauber' : c > 0 ? 'zu hoch' : 'zu tief');

type Umfang = Tonumfang;
const UMFANG = 'ueben:tonprofil-umfang';

export function TonprofilBlatt({ schliessen }: { schliessen: () => void }) {
  const api = useStimmgeraetApi();
  const fokus = useDialogFokus<HTMLDivElement>();
  const [profile, setProfile] = useState<Tonprofil[]>(() => tonprofileLaden());
  const [ansicht, setAnsicht] = useState<'start' | 'messen' | 'ergebnis'>(() => (tonprofileLaden().length ? 'ergebnis' : 'start'));
  const [gewaehlt, setGewaehlt] = useState<string | null>(() => tonprofileLaden()[0]?.id ?? null);
  const [umfang, setUmfang] = useState<Umfang>(() => gespeichert<Umfang>(UMFANG, EINSTELLUNG_STANDARD[UMFANG]));
  // Mikrofon nur für die Messung eingeschaltet? Dann danach wieder aus.
  const selbstGestartet = useRef(false);
  const reihe = tonReihe(umfang.von, umfang.bis).filter((m) => !umfang.stamm || STAMM.has(((m % 12) + 12) % 12));

  const zu = () => { if (selbstGestartet.current) api.stopp(); schliessen(); };
  useEscape(zu);

  const umfangSetzen = (u: Umfang) => { setUmfang(u); speichern(UMFANG, u); };
  const starten = () => {
    if (!api.an) { selbstGestartet.current = true; void api.start(); }
    setAnsicht('messen');
  };
  const messungFertig = (toene: ProfilTon[]) => {
    if (selbstGestartet.current) { api.stopp(); selbstGestartet.current = false; }
    if (!toene.length) { setAnsicht(profile.length ? 'ergebnis' : 'start'); return; }
    try {
      const p = tonprofilAnlegen({ am: Date.now(), stimmung: api.stimmung, kammerton: api.kammerton, toene: [...toene].sort((a, b) => a.midi - b.midi) });
      setProfile(tonprofileLaden()); setGewaehlt(p.id); setAnsicht('ergebnis');
    } catch (x) { speicherFehler(x); }
  };

  return createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Tonprofil" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Tonprofil</h2>
            <p className="gedaempft text-sm">Welche Töne auf deinem Instrument zu hoch oder zu tief liegen.</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        {ansicht === 'start' && (
          <div className="space-y-3">
            <p className="text-sm">Du spielst Ton für Ton, die App misst jeden etwa eine Sekunde lang und merkt sich die Abweichung. Am besten
              eingespielt, in normaler Lautstärke und ohne Vibrato — und regelmäßig wiederholen, dann siehst du die Entwicklung.</p>
            <div className="umfang">
              <TonStepper titel="Tiefster Ton" wert={umfang.von} setzen={(v) => umfangSetzen({ ...umfang, von: Math.min(v, umfang.bis) })} />
              <TonStepper titel="Höchster Ton" wert={umfang.bis} setzen={(v) => umfangSetzen({ ...umfang, bis: Math.max(v, umfang.von) })} />
            </div>
            <div className="segment !mx-0" role="group" aria-label="Töne">
              <button type="button" aria-pressed={!umfang.stamm} onClick={() => umfangSetzen({ ...umfang, stamm: false })}>Chromatisch</button>
              <button type="button" aria-pressed={umfang.stamm} onClick={() => umfangSetzen({ ...umfang, stamm: true })}>Ohne Vorzeichen</button>
            </div>
            <p className="gedaempft text-sm">{reihe.length} Töne, notiert für ein Instrument in {api.stimmung} bei a′ = {api.kammerton} Hz (im Stimmgerät einstellbar).</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="knopf" onClick={starten} disabled={!reihe.length}>Messung starten</button>
              {profile.length > 0 && <button type="button" className="knopf knopf-leise" onClick={() => setAnsicht('ergebnis')}>Zurück zum Ergebnis</button>}
            </div>
          </div>
        )}

        {ansicht === 'messen' && <Messen reihe={reihe} fertig={messungFertig} />}

        {ansicht === 'ergebnis' && profile.length > 0 && (
          <Ergebnis profile={profile} gewaehlt={gewaehlt} waehlen={setGewaehlt} neu={() => setAnsicht('start')}
            loeschen={(id) => {
              tonprofilLoeschen(id);
              const rest = tonprofileLaden();
              setProfile(rest); setGewaehlt(rest[0]?.id ?? null);
              if (!rest.length) setAnsicht('start');
            }} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function TonStepper({ titel, wert, setzen }: { titel: string; wert: number; setzen: (v: number) => void }) {
  return (
    <div className="ton-stepper">
      <span className="kennzahl-label">{titel}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="rund-knopf klein" onClick={() => setzen(wert - 1)} aria-label={`${titel} tiefer`}>−</button>
        <strong className="min-w-[3.2rem] text-center tabular-nums">{tonName(wert)}</strong>
        <button type="button" className="rund-knopf klein" onClick={() => setzen(wert + 1)} aria-label={`${titel} höher`}>+</button>
      </span>
    </div>
  );
}

// Geführte Messung: Ziel-Ton anzeigen, ruhige Ablesungen sammeln, weiter.
function Messen({ reihe, fertig }: { reihe: number[]; fertig: (toene: ProfilTon[]) => void }) {
  const { ablesungen, an, fehler } = useStimmgeraetApi();
  const [i, setI] = useState(0);
  const [anzahl, setAnzahl] = useState(0);
  const [live, setLive] = useState<ProfilTon | null>(null);
  const [zuletzt, setZuletzt] = useState<ProfilTon | null>(null);
  const [gemessen, setGemessen] = useState(0);
  // Der Stand läuft in einer Referenz mit: Ablesungen kommen außerhalb von React.
  const stand = useRef({ i: 0, werte: [] as number[], toene: [] as ProfilTon[] });
  const fertigRef = useRef(fertig);
  useEffect(() => { fertigRef.current = fertig; }, [fertig]);

  useEffect(() => ablesungen((ton) => {
    const s = stand.current;
    const ziel = reihe[s.i];
    if (ziel === undefined) return;
    setLive({ midi: ton.midi, cent: ton.cent });
    const r = messen(s.werte, { midi: ton.midi, cent: ton.cent }, ziel);
    s.werte = r.werte;
    if (r.ergebnis === null) { setAnzahl(r.werte.length); return; }
    s.toene = [...s.toene.filter((t) => t.midi !== ziel), { midi: ziel, cent: r.ergebnis }];
    s.werte = []; s.i++;
    setAnzahl(0); setI(s.i); setZuletzt({ midi: ziel, cent: r.ergebnis }); setGemessen(s.toene.length);
    if (s.i >= reihe.length) fertigRef.current(s.toene);
  }), [ablesungen, reihe]);

  const gehen = (d: number) => {
    const s = stand.current;
    s.i = Math.max(0, Math.min(reihe.length - 1, s.i + d)); s.werte = [];
    setI(s.i); setAnzahl(0);
  };
  const ziel = reihe[Math.min(i, reihe.length - 1)];
  const anderer = live && live.midi !== ziel;

  return (
    <div className="space-y-3">
      <p className="gedaempft text-sm tabular-nums">Ton {Math.min(i + 1, reihe.length)} von {reihe.length}</p>
      <div className="mess-ziel" aria-live="polite">
        <span className="kennzahl-label">Spiel</span>
        <span className="mess-ton">{tonName(ziel)}</span>
        <div className="mess-balken" role="progressbar" aria-valuemin={0} aria-valuemax={MESS_ANZAHL} aria-valuenow={anzahl} aria-label="Messung">
          <span style={{ width: `${(anzahl / MESS_ANZAHL) * 100}%` }} />
        </div>
        <span className="gedaempft text-sm">
          {!an ? 'Mikrofon wird gestartet …'
            : !live ? 'Ton ruhig halten, bis der Balken voll ist.'
            : anderer ? `Du spielst ${tonName(live.midi)} — gesucht ist ${tonName(ziel)}.`
            : `${zahl(live.cent)} Cent · ${richtung(live.cent)}`}
        </span>
      </div>
      {fehler && <p className="warnung text-sm">{fehler}</p>}
      {zuletzt && <p className="text-sm" role="status">{tonName(zuletzt.midi)} gemessen: <strong>{zahl(zuletzt.cent)}</strong> ({richtung(zuletzt.cent)})</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => gehen(-1)} disabled={i === 0}>‹ Zurück</button>
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => gehen(1)} disabled={i >= reihe.length - 1}>Überspringen</button>
        <span className="flex-1" />
        <button type="button" className="knopf knopf-klein" onClick={() => fertig(stand.current.toene)}>
          {gemessen ? `Fertig (${gemessen} ${gemessen === 1 ? 'Ton' : 'Töne'})` : 'Abbrechen'}
        </button>
      </div>
    </div>
  );
}

function Ergebnis({ profile, gewaehlt, waehlen, neu, loeschen }: {
  profile: Tonprofil[]; gewaehlt: string | null; waehlen: (id: string) => void; neu: () => void; loeschen: (id: string) => void;
}) {
  const p = profile.find((x) => x.id === gewaehlt) ?? profile[0];
  const aelter = profile.filter((x) => x.am < p.am);
  const [vergleichId, setVergleichId] = useState<string | null>(null);
  const alt = aelter.find((x) => x.id === vergleichId) ?? (vergleichId === null ? aelter[0] ?? null : null);
  const k = kennzahlen(p);
  const kAlt = alt ? kennzahlen(alt) : null;
  const v = alt ? vergleich(p, alt) : [];
  const [grundton, setGrundton] = useState(() => gespeichert('ueben:tonleiter-grundton', 0));
  const [art, setArt] = useState<'dur' | 'moll'>(() => gespeichert<'dur' | 'moll'>('ueben:tonleiter-art', 'dur'));
  const leiter = tonleiterHinweise(p, grundton, art);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold">Messung
          <select className="feld feld-schmal ml-2 !min-h-[38px]" value={p.id} onChange={(e) => { waehlen(e.target.value); setVergleichId(null); }}>
            {profile.map((x) => <option key={x.id} value={x.id}>{datum(x.am)} · {x.toene.length} Töne</option>)}
          </select>
        </label>
        <span className="flex-1" />
        <button type="button" className="knopf knopf-klein" onClick={neu}>Neu messen</button>
      </div>

      <div className="kennzahlen">
        <div className="kennzahl">
          <span className="kennzahl-label">Ø Abweichung</span>
          <span className="kennzahl-wert">{k.mittel} ct</span>
          <span className="kennzahl-unter">{kAlt ? `vorher ${kAlt.mittel} ct` : 'Betrag, alle Töne'}</span>
        </div>
        <div className="kennzahl">
          <span className="kennzahl-label">Sauber</span>
          <span className="kennzahl-wert">{k.sauber}/{k.anzahl}</span>
          <span className="kennzahl-unter">±{SAUBER} Cent{kAlt ? ` · vorher ${kAlt.sauber}/${kAlt.anzahl}` : ''}</span>
        </div>
        <div className="kennzahl">
          <span className="kennzahl-label">Am stärksten</span>
          <span className="kennzahl-wert">{k.auffaellig[0] ? tonName(k.auffaellig[0].midi) : '–'}</span>
          <span className="kennzahl-unter">{k.auffaellig[0] ? `${zahl(k.auffaellig[0].cent)} · ${richtung(k.auffaellig[0].cent)}` : 'alles sauber'}</span>
        </div>
      </div>

      {aelter.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">Vergleich mit
          <select className="feld feld-schmal !min-h-[38px]" value={alt?.id ?? ''} onChange={(e) => setVergleichId(e.target.value || '')}>
            <option value="">–</option>
            {aelter.map((x) => <option key={x.id} value={x.id}>{datum(x.am)}</option>)}
          </select>
          {alt && v.length > 0 && <span className="gedaempft">{v.filter((x) => x.besser).length} von {v.length} Tönen näher an sauber</span>}
        </label>
      )}

      <ProfilDiagramm p={p} alt={alt} />

      {k.auffaellig.length > 0 && (
        <div className="space-y-1">
          <p className="abschnitt-titel !text-base">Darauf achten</p>
          <ul className="space-y-1 text-sm">
            {k.auffaellig.map((t) => <li key={t.midi}><strong className="tabular-nums">{tonName(t.midi)}</strong> — {neigung(t.cent)}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="abschnitt-titel !text-base">Tonleiter sauber spielen</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="feld feld-schmal !min-h-[38px]" value={grundton} aria-label="Grundton"
            onChange={(e) => { const g = Number(e.target.value); setGrundton(g); speichern('ueben:tonleiter-grundton', g); }}>
            {NAMEN.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          <div className="segment !mx-0" role="group" aria-label="Tongeschlecht">
            {(['dur', 'moll'] as const).map((a) => (
              <button key={a} type="button" aria-pressed={art === a} onClick={() => { setArt(a); speichern('ueben:tonleiter-art', a); }}>{a === 'dur' ? 'Dur' : 'Moll'}</button>
            ))}
          </div>
        </div>
        {leiter.length ? (
          <ol className="tonleiter">
            {leiter.map((h) => (
              <li key={h.stufe}>
                <span className="tonleiter-stufe">{h.stufe}</span>
                <strong className="tonleiter-ton">{h.name}</strong>
                <span className="min-w-0 flex-1 text-sm">{h.hinweis}{h.akkord && <span className="block gedaempft">{h.akkord}</span>}</span>
              </li>
            ))}
          </ol>
        ) : <p className="gedaempft text-sm">Der Grundton {NAMEN[grundton]} liegt nicht im gemessenen Umfang.</p>}
        <p className="gedaempft text-xs">Im Zusammenspiel: Die große Terz eines Dur-Akkords klingt rein etwa 14 Cent tiefer, die kleine Terz eines Moll-Akkords etwa 16 Cent höher, als das Stimmgerät zeigt; Quinte und Quarte bleiben praktisch, wie angezeigt.</p>
      </div>

      <details>
        <summary className="text-sm font-semibold">Alle Töne dieser Messung</summary>
        <table className="uebetage">
          <thead><tr><th>Ton</th><th>Abweichung</th>{alt && <th>{datum(alt.am)}</th>}</tr></thead>
          <tbody>
            {p.toene.map((t) => {
              const vorher = alt?.toene.find((x) => x.midi === t.midi);
              return <tr key={t.midi}><td>{tonName(t.midi)}</td><td>{zahl(t.cent)} · {richtung(t.cent)}</td>{alt && <td>{vorher ? zahl(vorher.cent) : '–'}</td>}</tr>;
            })}
          </tbody>
        </table>
      </details>
      <button type="button" className="text-knopf bib-loeschen" onClick={() => { if (confirm(`Messung vom ${datum(p.am)} löschen?`)) loeschen(p.id); }}>Diese Messung löschen</button>
    </div>
  );
}

// Abweichung je Ton als Balken um die Null: nach oben zu hoch (warm), nach
// unten zu tief (kühl), im Band ±5 sauber (grau). Ein älteres Profil als
// Ringe zum Vergleich. Antippen zeigt den Ton in der Zeile darüber.
function ProfilDiagramm({ p, alt }: { p: Tonprofil; alt: Tonprofil | null }) {
  const huelle = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [aktiv, setAktiv] = useState<number | null>(null);
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cent = new Map(p.toene.map((t) => [t.midi, t.cent]));
  const vorher = new Map((alt?.toene ?? []).map((t) => [t.midi, t.cent]));
  const midis = p.toene.length ? tonReihe(Math.min(...p.toene.map((t) => t.midi)), Math.max(...p.toene.map((t) => t.midi))) : [];
  const groesste = Math.max(15, ...p.toene.map((t) => Math.abs(t.cent)), ...(alt?.toene ?? []).map((t) => Math.abs(t.cent)));
  const yMax = Math.ceil((groesste + 3) / 10) * 10;
  const H = 210, L = 32, R = 6, O = 10, U = 24;
  const y = (c: number) => O + ((yMax - c) / (2 * yMax)) * (H - O - U);
  const slot = midis.length ? (W - L - R) / midis.length : 0;
  const x = (i: number) => L + slot * (i + 0.5);
  const bw = Math.max(3, Math.min(14, slot * 0.7));
  const schritt = yMax > 40 ? 20 : 10;
  const striche: number[] = [];
  for (let c = -yMax; c <= yMax; c += schritt) striche.push(c);
  const zeiger = aktiv === null ? null : midis[aktiv];

  const naechster = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    setAktiv(Math.max(0, Math.min(midis.length - 1, Math.floor((e.clientX - r.left - L) / slot))));
  };

  return (
    <div ref={huelle} className="kurve">
      <p className="kurve-tipp" aria-live="polite">
        {zeiger !== null && zeiger !== undefined ? (
          cent.has(zeiger)
            ? <><strong>{tonName(zeiger)} {zahl(cent.get(zeiger)!)}</strong> · {richtung(cent.get(zeiger)!)}{vorher.has(zeiger) ? ` · vorher ${zahl(vorher.get(zeiger)!)}` : ''}</>
            : <><strong>{tonName(zeiger)}</strong> · nicht gemessen</>
        ) : <span className="kurve-tipp-leer">Tippe auf einen Ton</span>}
      </p>
      {W > 0 && (
        <svg width={W} height={H} role="img" className="kurve-svg"
          aria-label={`Tonprofil: ${p.toene.length} Töne, ${p.toene.filter((t) => Math.abs(t.cent) <= SAUBER).length} sauber.`}>
          {striche.map((c) => (
            <g key={c}>
              <line x1={L} x2={W - R} y1={y(c)} y2={y(c)} className={c === 0 ? 'profil-null' : 'kurve-gitter'} />
              <text x={L - 5} y={y(c) + 3.5} textAnchor="end" className="kurve-achse">{zahl(c)}</text>
            </g>
          ))}
          <rect x={L} width={W - L - R} y={y(SAUBER)} height={y(-SAUBER) - y(SAUBER)} className="profil-sauber" />
          {zeiger !== null && zeiger !== undefined && <rect x={x(aktiv!) - slot / 2} width={slot} y={O} height={H - O - U} className="profil-zeiger" />}
          {midis.map((m, i) => {
            if (!cent.has(m)) return null;
            const c = cent.get(m)!;
            const klasse = Math.abs(c) <= SAUBER ? 'profil-sauber-balken' : c > 0 ? 'profil-hoch' : 'profil-tief';
            const oben = Math.min(y(0), y(c)), hoehe = Math.max(1.5, Math.abs(y(c) - y(0)));
            return <rect key={m} x={x(i) - bw / 2} width={bw} y={oben} height={hoehe} rx={Math.min(2, bw / 3)} className={klasse} />;
          })}
          {midis.map((m, i) => vorher.has(m) && <circle key={`v${m}`} cx={x(i)} cy={y(vorher.get(m)!)} r={3.5} className="profil-vorher" />)}
          {midis.map((m, i) => (slot >= 26 || ((m % 12) + 12) % 12 === 0 || i === 0) && (
            <text key={`t${m}`} x={x(i)} y={H - 7} textAnchor="middle" className="kurve-achse">{tonName(m)}</text>
          ))}
          <rect x={L} y={0} width={Math.max(0, W - L - R)} height={H} fill="transparent" className="kurve-fang"
            onPointerDown={naechster} onPointerMove={naechster} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAktiv(null); }} />
        </svg>
      )}
      <div className="kurve-legende" aria-hidden="true">
        <span><i className="schluessel-balken profil-hoch" />zu hoch</span>
        <span><i className="schluessel-balken profil-tief" />zu tief</span>
        <span><i className="schluessel-balken profil-sauber-balken" />sauber (±{SAUBER})</span>
        {alt && <span><i className="schluessel-ring" />{datum(alt.am)}</span>}
      </div>
    </div>
  );
}
