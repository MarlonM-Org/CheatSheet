'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BEREICH, griffeFuer, LAGE_NAMEN, lageVon, tastenName, type Griff, type Taste } from '@/domain/griffe';
import { tonName } from '@/domain/tonprofil';
import { STIMMUNGEN, type Ton } from '@/domain/ueben';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { skillGeuebt } from './skillspeicher';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { useDialogFokus, useEscape } from './tasten';

// Griffweisen (I-13): Grifftabelle der B-Klarinette (Böhm 17/6) als
// Zeichnung. Ton wählen (Schritt, Duodezime, kleine Klaviatur) oder per
// Mikrofon: das Stimmgerät erkennt den gespielten Ton (notiert in der
// gewählten Stimmung), das Blatt zeigt seinen Griff. Daten und Quellen in
// @/domain/griffe.

const DUODEZIME = 19; // Überblasen: Chalumeau → Clarion
const klemmen = (m: number) => Math.max(BEREICH.von, Math.min(BEREICH.bis, m));
const SKILL = 'clarion-altissimo';

// ── Zeichnung ── senkrecht, Mundstück oben. Gefüllt = drücken/schließen,
// leer = offen; Triller-Tasten mit Messing-Rand. Farben aus den Theme-Variablen.
type Form = { art: 'loch'; x: number; y: number; r: number } | { art: 'klappe'; x: number; y: number; b: number; h: number; text?: string };
const FORMEN: Record<Taste, Form> = {
  register: { art: 'klappe', x: 6, y: 30, b: 16, h: 8, text: 'R' },
  daumen: { art: 'loch', x: 14, y: 54, r: 7 },
  a: { art: 'klappe', x: 43, y: 12, b: 14, h: 8, text: 'A' },
  gis: { art: 'klappe', x: 64, y: 30, b: 13, h: 15, text: 'Gis' },
  l1: { art: 'loch', x: 50, y: 50, r: 8.5 },
  l2: { art: 'loch', x: 50, y: 74, r: 8.5 },
  esSliver: { art: 'klappe', x: 62, y: 81, b: 5, h: 12 },
  l3: { art: 'loch', x: 50, y: 98, r: 8.5 },
  lCis: { art: 'klappe', x: 22, y: 91, b: 13, h: 15, text: 'Cis' },
  s1: { art: 'klappe', x: 69, y: 126, b: 11, h: 9, text: '1' },
  s2: { art: 'klappe', x: 69, y: 138, b: 11, h: 9, text: '2' },
  s3: { art: 'klappe', x: 69, y: 150, b: 11, h: 9, text: '3' },
  s4: { art: 'klappe', x: 69, y: 162, b: 11, h: 11, text: 'Es' },
  r1: { art: 'loch', x: 50, y: 136, r: 8.5 },
  r2: { art: 'loch', x: 50, y: 160, r: 8.5 },
  hSliver: { art: 'klappe', x: 62, y: 167, b: 5, h: 12 },
  r3: { art: 'loch', x: 50, y: 184, r: 8.5 },
  lFis: { art: 'klappe', x: 8, y: 204, b: 22, h: 13, text: 'Fis' },
  lE: { art: 'klappe', x: 8, y: 219, b: 22, h: 13, text: 'E' },
  lF: { art: 'klappe', x: 8, y: 234, b: 22, h: 13, text: 'F' },
  rGis: { art: 'klappe', x: 70, y: 200, b: 22, h: 13, text: 'As' },
  rFis: { art: 'klappe', x: 70, y: 215, b: 22, h: 13, text: 'Fis' },
  rF: { art: 'klappe', x: 70, y: 230, b: 22, h: 13, text: 'F' },
  rE: { art: 'klappe', x: 70, y: 245, b: 22, h: 13, text: 'E' },
};
const REIHENFOLGE = Object.keys(FORMEN) as Taste[];

export function GriffBild({ griff, klein = false }: { griff: Griff; klein?: boolean }) {
  const zu = new Set(griff.tasten);
  const triller = new Set(griff.triller ?? []);
  const beschreibung = griff.tasten.length ? griff.tasten.map(tastenName).join(', ') : 'alles offen';
  return (
    <svg viewBox="0 0 100 266" className={`griff-bild${klein ? ' klein' : ''}`} role="img"
      aria-label={`Griff: ${beschreibung}${triller.size ? `; trillern: ${[...triller].map(tastenName).join(', ')}` : ''}`}>
      {/* Korpus mit Zapfen zwischen Ober- und Unterstück */}
      <rect x="38" y="6" width="24" height="258" rx="10" className="griff-korpus" />
      <line x1="38" y1="117" x2="62" y2="117" className="griff-fuge" />
      <line x1="38" y1="196" x2="62" y2="196" className="griff-fuge" />
      {REIHENFOLGE.map((t) => {
        const f = FORMEN[t];
        const klasse = `griff-taste${zu.has(t) ? ' zu' : ''}${triller.has(t) ? ' triller' : ''}`;
        if (f.art === 'loch') return <circle key={t} cx={f.x} cy={f.y} r={f.r} className={klasse} />;
        return (
          <g key={t}>
            <rect x={f.x} y={f.y} width={f.b} height={f.h} rx={Math.min(4, f.b / 2)} className={klasse} />
            {f.text && !klein && <text x={f.x + f.b / 2} y={f.y + f.h / 2 + 2.6} className={`griff-text${zu.has(t) ? ' zu' : ''}`}>{f.text}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Kleine Klaviatur einer Oktave (C…H) ──
const SCHWARZ = new Set([1, 3, 6, 8, 10]);
function Klaviatur({ midi, waehlen }: { midi: number; waehlen: (m: number) => void }) {
  const c = midi - (((midi % 12) + 12) % 12);
  const weisse = [0, 2, 4, 5, 7, 9, 11];
  const ton = (s: number) => {
    const m = c + s, aus = m < BEREICH.von || m > BEREICH.bis;
    return (
      <button key={s} type="button" className={`griff-klavier-taste${SCHWARZ.has(s) ? ' schwarz' : ''}`} disabled={aus}
        aria-pressed={m === midi} aria-label={tonName(m)} onClick={() => waehlen(m)}
        style={SCHWARZ.has(s) ? { left: `calc(${(weisse.filter((w) => w < s).length) * (100 / 7)}% - 5.5%)` } : undefined} />
    );
  };
  return (
    <div className="griff-klavier" role="group" aria-label={`Oktave ${tonName(c)}`}>
      {weisse.map(ton)}
      {[1, 3, 6, 8, 10].map(ton)}
    </div>
  );
}

export function GriffeBlatt({ schliessen, midi: anfang }: { schliessen: () => void; midi?: number }) {
  const fokus = useDialogFokus<HTMLDivElement>();
  const stimm = useStimmgeraetApi();
  const metro = useMetronom();
  const [midi, setMidi] = useState(() => klemmen(anfang ?? 72));
  const [hoeren, setHoeren] = useState(false);
  const [gehoert, setGehoert] = useState<Ton | null>(null);
  const [geuebt, setGeuebt] = useState(false);
  const selbstGestartet = useRef(false);
  const vorspiel = useRef<Vorspiel | null>(null);

  const anhoerenStopp = () => { vorspiel.current?.stopp(); vorspiel.current = null; };
  const mikroAus = () => { if (selbstGestartet.current) { stimm.stopp(); selbstGestartet.current = false; } };
  const zu = () => { anhoerenStopp(); mikroAus(); schliessen(); };
  useEscape(zu);
  useEffect(() => () => anhoerenStopp(), []);

  // Mikrofon: jede klare Ablesung des Stimmgeräts wählt den Ton.
  const { ablesungen } = stimm;
  useEffect(() => {
    if (!hoeren) return;
    return ablesungen((t) => {
      setGehoert(t);
      if (t.midi >= BEREICH.von && t.midi <= BEREICH.bis) setMidi(t.midi);
    });
  }, [hoeren, ablesungen]);

  const hoerenUmschalten = () => {
    if (hoeren) { setHoeren(false); setGehoert(null); mikroAus(); return; }
    anhoerenStopp();
    if (!stimm.an) { selbstGestartet.current = true; void stimm.start(); }
    setHoeren(true);
  };

  const waehlen = (m: number) => { setMidi(klemmen(m)); setGeuebt(false); };
  const anhoeren = () => {
    anhoerenStopp();
    // Lautsprecher und Mikrofon zugleich: das Klavier würde sich selbst wählen.
    if (hoeren) { setHoeren(false); setGehoert(null); mikroAus(); }
    vorspiel.current = vorspielen([{ midi, beginn: 0, dauer: 1.4 }], stimm.stimmung, stimm.kammerton, metro.laut);
  };

  const griffe = griffeFuer(midi);
  const standard = griffe.find((g) => g.art === 'standard');
  const alternativen = griffe.filter((g) => g.art === 'alternative');
  const triller = griffe.filter((g) => g.art === 'triller');
  const lage = lageVon(midi);
  const klingt = midi - STIMMUNGEN[stimm.stimmung];
  const hoeheLage = lage === 'clarion' || lage === 'altissimo';
  const knopf = (text: string, ziel: number, label: string) => (
    <button type="button" className="rund-knopf klein" disabled={ziel < BEREICH.von || ziel > BEREICH.bis} onClick={() => waehlen(ziel)} aria-label={label}>{text}</button>
  );

  return createPortal(
    <div className="blatt-hintergrund" onClick={zu}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Griffweisen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Griffweisen</h2>
            <p className="gedaempft text-sm">B-Klarinette, Böhm-System · notiert</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={zu}>Fertig</button>
        </div>

        <div className="griff-wahl">
          <div className="griff-schritte">
            {knopf('⇊', midi - DUODEZIME, 'Duodezime tiefer (Register)')}
            {knopf('−', midi - 1, 'Halbton tiefer')}
            <div className="griff-ton" aria-live="polite">
              <strong>{tonName(midi)}</strong>
              <span>{LAGE_NAMEN[lage]}{stimm.stimmung !== 'C' ? ` · klingt ${tonName(klingt)}` : ''}</span>
            </div>
            {knopf('+', midi + 1, 'Halbton höher')}
            {knopf('⇈', midi + DUODEZIME, 'Duodezime höher (Register)')}
          </div>
          <Klaviatur midi={midi} waehlen={waehlen} />
          <div className="griff-aktionen">
            <button type="button" className="knopf knopf-leise" onClick={anhoeren}>▶ Anhören</button>
            <button type="button" className="knopf knopf-leise" aria-pressed={hoeren} onClick={hoerenUmschalten}>
              {hoeren ? '● Hört zu' : 'Mikrofon'}
            </button>
          </div>
          <p className="griff-hoert gedaempft text-sm" aria-live="polite">
            {stimm.fehler && hoeren ? <span style={{ color: 'var(--warnung)' }}>{stimm.fehler}</span>
              : hoeren ? (gehoert ? `Gehört: ${tonName(gehoert.midi)} ${gehoert.cent >= 0 ? '+' : '−'}${Math.abs(gehoert.cent)} ct${gehoert.midi < BEREICH.von || gehoert.midi > BEREICH.bis ? ' — außerhalb der Tabelle' : ''}` : 'Spiel einen Ton …')
                : 'Ton wählen oder Mikrofon einschalten und spielen.'}
          </p>
        </div>

        {standard && (
          <div className="griff-standard">
            <GriffBild griff={standard} />
            <div className="griff-legende text-sm">
              <span className="kennzahl-label">Standardgriff</span>
              <p><i className="griff-punkt zu" /> drücken / schließen</p>
              <p><i className="griff-punkt" /> offen</p>
              <p className="gedaempft">Links: Daumen (T) und Überblasklappe (R) hinten. Rechts am Korpus: Seitenklappen 1–4.</p>
              {lage === 'altissimo' && <p className="gedaempft">Altissimo: Griffe je nach Instrument und Blatt ausprobieren.</p>}
              {hoeheLage && (
                <div className="griff-skill">
                  <span className="gedaempft">Skill „Sauberes Clarion und Altissimo“</span>
                  <button type="button" className="knopf knopf-leise knopf-klein" disabled={geuebt} onClick={() => { skillGeuebt(SKILL); setGeuebt(true); }}>
                    {geuebt ? '✓ Eingetragen' : 'Heute geübt'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {alternativen.length > 0 && (
          <section className="space-y-2">
            <span className="kennzahl-label">Alternativen</span>
            <div className="griff-karten">
              {alternativen.map((g) => (
                <div key={g.wfg} className="griff-karte">
                  <GriffBild griff={g} klein />
                  <p>{g.hinweis}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {triller.length > 0 && (
          <section className="space-y-2">
            <span className="kennzahl-label">Triller</span>
            <div className="griff-karten">
              {triller.map((g) => (
                <div key={g.wfg + g.nach} className="griff-karte">
                  <GriffBild griff={g} klein />
                  <p><strong>{tonName(g.midi)}–{tonName(g.nach!)}</strong> {g.hinweis?.replace(/^Triller [^:]*: /, '')}</p>
                </div>
              ))}
            </div>
            <p className="gedaempft text-xs"><i className="griff-punkt triller" /> Messing-Rand: diese Taste trillern</p>
          </section>
        )}

        <p className="gedaempft text-xs">Quelle: The Woodwind Fingering Guide (wfg.woodwind.org), Böhm-Klarinette 17 Klappen / 6 Ringe.</p>
      </div>
    </div>,
    document.body,
  );
}
