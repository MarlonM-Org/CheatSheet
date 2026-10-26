'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AbcElem, ClickListenerDrag, TuneObject } from 'abcjs';
import { alsAbcStimmen, type Raster, type Stimme, type Takt, type Tonart } from '@/domain/notation';
import {
  angebunden, bogenUmschalten, dauerSetzen, einfuegen, entfernen, inAllen, inStimme, klaengeAlle, leiterVerschieben, letzteHoehe, noteSchreiben,
  notenZeiten, paletteWerte, punktiert, stimmeAendern, stimmeHinzu, stimmeWeg, taktEinfuegen, taktLoeschen, tonSetzen, triole, verschieben, type NotenPos,
} from '@/domain/notensatz';
import { pruefen } from '@/domain/notenregeln';
import { EINSTELLUNG_STANDARD } from '@/domain/einstellungen';
import { audioSitzung, gespeichert, speichern } from './klang';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { fehlerGrund } from './speicherfehler';

// Notenblatt (G-01/G-04): abcjs zeichnet die Stimmen als Akkolade; eine Note
// antippen wählt sie (und ihre Stimme), Ziehen (Maus) verschiebt sie auf der
// Leiter, die Palette setzt Höhe, Wert, Pause, Bogen, Takte — wie in
// MuseScore, nur das Nötigste. „+ Stimme“ legt eine Stimme darunter an
// (dieselben Werkzeuge), je Stimme Name, Schlüssel und „stumm“.
// „Vorspielen“ spielt alle (nicht stummen) Stimmen mit Klavierklang
// (./klavier) ab, ab der gewählten Note, und zeigt je Stimme mit, wo es ist.
// Rechnen in @/domain/notensatz.
//
// Auf Touch-Geräten verschiebt Ziehen nichts (es scrollt): dort tragen die
// Pfeile. Tastatur: ↑↓ Halbton, ⇧↑↓ Oktave, ←→ Note wechseln, Entf Pause,
// Rückschritt löscht.

const WERT_SCHLUESSEL = 'ueben:notensatz-wert';

// Lage einer gezeichneten Note: Stimme, darin Takt und Note.
export interface BlattPos extends NotenPos { stimme: number }

// Ein auswählbares Element von abcjs mit dem, was wir davon brauchen.
interface Auswaehlbar { absEl: { abcelem: AbcElem; highlight?: (k?: string, farbe?: string) => void; unhighlight?: (k?: string, farbe?: string) => void }; svgEl: SVGElement }
// Je Stimme die Noten-Elemente in Lesereihenfolge.
type Elemente = Auswaehlbar[][];

const lagenVon = (s: Stimme) => s.takte.flatMap((t, takt) => t.noten.map((_, note) => ({ takt, note })));

export function Notenblatt({ stimmen, raster, tonart, titel, aendern }: {
  stimmen: Stimme[]; raster: Raster; tonart: Tonart | null; titel: string;
  // Ohne `aendern` nur ansehen und vorspielen.
  aendern?: (stimmen: Stimme[]) => void;
}) {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  const abc = useMemo(() => alsAbcStimmen(stimmen, raster, { titel }, tonart), [stimmen, raster, titel, tonart]);
  const bild = useRef<HTMLDivElement>(null);
  const tune = useRef<TuneObject | null>(null);
  const elemente = useRef<Elemente>([]);
  const [auswahlRoh, setAuswahl] = useState<BlattPos | null>(null);
  const [aktivRoh, setAktiv] = useState(0);
  // Auswahl verfällt auf die nächste Note, wenn es die gewählte nicht mehr gibt.
  const auswahl = useMemo<BlattPos | null>(() => {
    if (!auswahlRoh) return null;
    const s = stimmen[auswahlRoh.stimme];
    if (!s) return null;
    if (s.takte[auswahlRoh.takt]?.noten[auswahlRoh.note]) return auswahlRoh;
    const t = Math.min(auswahlRoh.takt, s.takte.length - 1);
    return t >= 0 ? { stimme: auswahlRoh.stimme, takt: t, note: Math.max(0, Math.min(auswahlRoh.note, s.takte[t].noten.length - 1)) } : null;
  }, [auswahlRoh, stimmen]);
  // Die Stimme, in der geschrieben wird: die der Auswahl, sonst die gewählte.
  const aktiv = auswahl ? auswahl.stimme : Math.max(0, Math.min(aktivRoh, stimmen.length - 1));
  const takte = stimmen[aktiv]?.takte ?? [];
  const [wert, setWertRoh] = useState(() => gespeichert<number>(WERT_SCHLUESSEL, 24));
  const [punkt, setPunkt] = useState(false);
  const [tri, setTri] = useState(false);
  const [stumm, setStumm] = useState<ReadonlySet<number>>(() => new Set());
  const [fehler, setFehler] = useState('');
  const [spielt, setSpielt] = useState(false);
  const vorspiel = useRef<(Vorspiel & { zeit: () => number; raf: number; zeiger: number[] }) | null>(null);
  // Die Rückrufe von abcjs sehen immer den aktuellen Stand.
  const stand = useRef({ stimmen, raster, tonart, aendern });
  useEffect(() => { stand.current = { stimmen, raster, tonart, aendern }; }, [stimmen, raster, tonart, aendern]);

  // Gezeichnete Noten in Lesereihenfolge ↔ Lage im Takt, je Stimme.
  const lagen = useMemo(() => stimmen.map(lagenVon), [stimmen]);
  const index = (p: BlattPos) => lagen[p.stimme]?.findIndex((l) => l.takt === p.takt && l.note === p.note) ?? -1;
  const werte = useMemo(() => paletteWerte(raster), [raster]);
  // Hinweise nach den Notationsregeln (G-10); der Tonumfang kommt aus dem Tonprofil.
  const [umfang] = useState(() => gespeichert('ueben:tonprofil-umfang', EINSTELLUNG_STANDARD['ueben:tonprofil-umfang']));
  const hinweise = useMemo(() => pruefen(stimmen, raster, tonart, { umfang: { von: umfang.von, bis: umfang.bis } }), [stimmen, raster, tonart, umfang]);
  const [alleHinweise, setAlleHinweise] = useState(false);
  const zeiten = useMemo(() => stimmen.map((s) => notenZeiten(s.takte, raster)), [stimmen, raster]);
  const gesamt = Math.max(0, ...zeiten.map((z) => z.gesamt));

  const farbe = useCallback((name: string, sonst: string) => (bild.current ? getComputedStyle(bild.current).getPropertyValue(name).trim() || sonst : sonst), []);
  const faerben = useCallback((stimme: number, i: number, f: string | null) => {
    const e = elemente.current[stimme]?.[i];
    if (!e) return;
    if (f) e.absEl.highlight?.(undefined, f); else e.absEl.unhighlight?.(undefined, farbe('--tinte', '#222'));
  }, [farbe]);

  // Änderung in der aktiven Stimme.
  const inAktiver = (f: (takte: Takt[]) => Takt[]) => { if (aendern) aendern(inStimme(stimmen, aktiv, f(takte), raster)); };

  // ── Zeichnen ──
  const [gezeichnet, setGezeichnet] = useState(0);
  // Breite des Blatts: die Zeilen werden darauf umbrochen (auf dem Handy
  // zwei Takte je Zeile statt vier), damit die Noten lesbar bleiben.
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    const el = bild.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = bild.current;
    if (!el || !breite) return;
    const skala = breite >= 700 ? 1.4 : 1.15;
    let aktuell = true;
    void import('abcjs').then((m) => {
      if (!aktuell || !bild.current) return;
      const klick = (abcElem: AbcElem, _n: number, _k: string, _a: unknown, drag: ClickListenerDrag, ev?: Event) => {
        let gewaehlt: BlattPos | null = null;
        elemente.current.forEach((liste, stimme) => {
          const i = liste.findIndex((e) => e.absEl.abcelem === abcElem);
          if (i >= 0) { const l = lagenVon(stand.current.stimmen[stimme])[i]; if (l) gewaehlt = { stimme, ...l }; }
        });
        if (!gewaehlt) return;
        const p: BlattPos = gewaehlt;
        setAuswahl(p);
        // Ziehen (nur mit der Maus — auf Touch wäre es das Scrollen): Schritte auf der Leiter, nach unten positiv.
        const s = stand.current;
        if (s.aendern && drag.step && ev && ev.type !== 'touchend') {
          s.aendern(inStimme(s.stimmen, p.stimme, leiterVerschieben(s.stimmen[p.stimme].takte, s.raster, p, -drag.step, s.tonart), s.raster));
        }
      };
      const [t] = m.renderAbc(bild.current, abc, {
        responsive: 'resize', add_classes: true, paddingtop: 0, paddingbottom: 0, paddingleft: 0, paddingright: 0,
        // Größer gezeichnet auf breiten Bildschirmen (iPad): die Zeile füllt
        // die Breite, die Noten sind gut zu treffen.
        scale: skala, staffwidth: (breite - 4) / skala, wrap: { minSpacing: 1.6, maxSpacing: 2.7, preferredMeasuresPerLine: breite < 560 ? 2 : 4 },
        foregroundColor: farbe('--tinte', '#222'), selectionColor: farbe('--messing', '#a8781f'), dragColor: farbe('--messing', '#a8781f'),
        dragging: !!stand.current.aendern, clickListener: klick as unknown as import('abcjs').ClickListener,
      });
      tune.current = t;
      // Welche Note gehört zu welcher Stimme? Über die Zeilen: je Zeile ein
      // System, darin je Stimme ein Notensystem (staff), in Lesereihenfolge.
      const alle = (t.getSelectableArray() as unknown as Auswaehlbar[]).filter((e) => e.absEl?.abcelem?.el_type === 'note');
      const vonElem = new Map<AbcElem, Auswaehlbar>(alle.map((e) => [e.absEl.abcelem, e]));
      const je: Elemente = stand.current.stimmen.map(() => []);
      for (const zeile of t.lines) {
        (zeile.staff ?? []).forEach((staff, s) => {
          for (const voice of staff.voices ?? []) for (const el of voice) {
            if (el.el_type !== 'note') continue;
            const a = vonElem.get(el as unknown as AbcElem);
            if (a && je[s]) je[s].push(a);
          }
        });
      }
      elemente.current = je;
      setGezeichnet((n) => n + 1);
    }).catch((x) => setFehler(`Die Noten ließen sich nicht zeichnen: ${fehlerGrund(x)}`));
    return () => { aktuell = false; };
  }, [abc, breite, farbe]);

  // Auswahl färben (nach jedem Zeichnen neu).
  useEffect(() => {
    const i = auswahl ? index(auswahl) : -1;
    if (auswahl && i >= 0) faerben(auswahl.stimme, i, farbe('--messing', '#a8781f'));
    return () => { if (auswahl && i >= 0 && !vorspiel.current) faerben(auswahl.stimme, i, null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, gezeichnet, faerben, farbe]);

  // ── Vorspielen ──
  const anhalten = useCallback(() => {
    const v = vorspiel.current;
    if (!v) return;
    cancelAnimationFrame(v.raf);
    v.stopp();
    v.zeiger.forEach((i, s) => { if (i >= 0) faerben(s, i, null); });
    vorspiel.current = null;
    setSpielt(false);
    setAuswahl((a) => a); // Auswahl neu färben
    setGezeichnet((n) => n + 1);
  }, [faerben]);
  const abspielen = useCallback(() => {
    if (vorspiel.current) return anhalten();
    const ab = auswahl ? zeiten[auswahl.stimme]?.zeiten[index(auswahl)] ?? 0 : 0;
    const liste = klaengeAlle(stimmen, raster, stumm).filter((k) => k.beginn + k.dauer > ab + 1e-6)
      .map((k) => (k.beginn < ab ? { ...k, dauer: k.dauer - (ab - k.beginn), beginn: 0 } : { ...k, beginn: k.beginn - ab }));
    if (!liste.length) return;
    audioSitzung('playback');
    const v = { ...vorspielen(liste, stimm.stimmung, stimm.kammerton, metro.laut), raf: 0, zeiger: stimmen.map(() => -1) };
    vorspiel.current = v;
    setSpielt(true);
    const gruen = farbe('--gut', '#1f7a43');
    const schleife = () => {
      if (vorspiel.current !== v) return;
      const t = v.zeit() + ab;
      if (t > gesamt + 0.3) { anhalten(); return; }
      zeiten.forEach((z, s) => {
        let i = -1;
        for (let k = 0; k < z.zeiten.length && z.zeiten[k] <= t; k++) i = k;
        if (i !== v.zeiger[s]) {
          if (v.zeiger[s] >= 0) faerben(s, v.zeiger[s], null);
          v.zeiger[s] = i;
          if (i >= 0) faerben(s, i, gruen);
        }
      });
      v.raf = requestAnimationFrame(schleife);
    };
    v.raf = requestAnimationFrame(schleife);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anhalten, auswahl, stimmen, raster, stumm, zeiten, gesamt, stimm.stimmung, stimm.kammerton, metro.laut, farbe, faerben]);
  useEffect(() => () => { vorspiel.current?.stopp(); cancelAnimationFrame(vorspiel.current?.raf ?? 0); }, []);
  useEffect(() => { if (vorspiel.current) anhalten(); }, [stimmen, anhalten]);

  // ── Palette ──
  // Der Wert aus der Palette: Triole (zwei Drittel) oder punktiert (anderthalb).
  const dauerAus = (z: number, p: boolean, t: boolean) => (t ? triole(z, raster) ?? z : p ? punktiert(z, raster) ?? z : z);
  const setWert = (z: number) => { setWertRoh(z); speichern(WERT_SCHLUESSEL, z); if (auswahl) { const p = auswahl; inAktiver((t) => dauerSetzen(t, raster, p, dauerAus(z, punkt, tri))); } };
  const setPunktUnd = (p: boolean) => { setPunkt(p); if (p) setTri(false); if (auswahl) { const a = auswahl; inAktiver((t) => dauerSetzen(t, raster, a, dauerAus(wert, p, false))); } };
  const setTriUnd = (t: boolean) => { setTri(t); if (t) setPunkt(false); if (auswahl) { const a = auswahl; inAktiver((x) => dauerSetzen(x, raster, a, dauerAus(wert, false, t))); } };
  const note = auswahl ? takte[auswahl.takt]?.noten[auswahl.note] : undefined;
  const schreiben = () => {
    if (!aendern) return;
    const p: NotenPos = auswahl ?? { takt: 0, note: 0 };
    const hoehe = takte[p.takt]?.noten[p.note]?.midi ?? letzteHoehe(takte, p);
    const { takte: neu, naechste } = noteSchreiben(takte, raster, p, hoehe, dauerAus(wert, punkt, tri));
    aendern(inStimme(stimmen, aktiv, neu, raster));
    setAuswahl({ stimme: aktiv, ...(naechste ?? p) });
  };
  const bewegen = (schritt: number) => { if (auswahl) { const i = index(auswahl) + schritt; const l = lagen[auswahl.stimme]?.[i]; if (l) setAuswahl({ stimme: auswahl.stimme, ...l }); } };
  const tasten = (e: React.KeyboardEvent) => {
    if (!aendern || (e.target as HTMLElement).closest('input, select, textarea')) return;
    const p = auswahl;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (p) inAktiver((t) => verschieben(t, raster, p, (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1))); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); bewegen(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === 'Delete') { e.preventDefault(); if (p) inAktiver((t) => tonSetzen(t, raster, p, null)); }
    else if (e.key === 'Backspace') { e.preventDefault(); if (p) inAktiver((t) => entfernen(t, raster, p)); }
  };
  const stimmeWaehlen = (i: number) => { setAktiv(i); setAuswahl(null); };
  const stummSchalten = (i: number, an: boolean) => setStumm((alt) => { const neu = new Set(alt); if (an) neu.add(i); else neu.delete(i); return neu; });
  const hatNoten = lagen.some((l) => l.length);
  const mitAuswahl = (f: (t: Takt[], p: NotenPos) => Takt[]) => () => { if (auswahl) { const p = auswahl; inAktiver((t) => f(t, p)); } };

  return (
    <div className="notensatz" onKeyDown={tasten}>
      {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
      <div className="notensatz-zeile">
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={abspielen} aria-pressed={spielt} disabled={!hatNoten}>
          {spielt ? '■ Anhalten' : auswahl && index(auswahl) > 0 ? '▶ Ab hier' : '▶ Vorspielen'}
        </button>
        {aendern && (
          <>
            <span className="notensatz-trenner" aria-hidden="true" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => verschieben(t, raster, p, 1))} disabled={!note || note.midi === null} aria-label="Halbton höher">▲</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => verschieben(t, raster, p, -1))} disabled={!note || note.midi === null} aria-label="Halbton tiefer">▼</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => verschieben(t, raster, p, 12))} disabled={!note || note.midi === null} aria-label="Oktave höher">▲8</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => verschieben(t, raster, p, -12))} disabled={!note || note.midi === null} aria-label="Oktave tiefer">▼8</button>
            <span className="notensatz-trenner" aria-hidden="true" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={schreiben} disabled={!takte.length}>Note</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => einfuegen(t, raster, p, dauerAus(wert, punkt, tri)))} disabled={!auswahl} title="Vor der gewählten Note Platz einfügen — alles danach rückt weiter">Einfügen</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => tonSetzen(t, raster, p, null))} disabled={!note || note.midi === null}>Pause</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => entfernen(t, raster, p))} disabled={!auswahl} title="Note herausnehmen — alles danach rückt nach">Löschen</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={mitAuswahl((t, p) => bogenUmschalten(t, raster, p))} disabled={!note || note.midi === null}>
              {auswahl && angebunden(takte, auswahl) ? 'Bogen lösen' : 'Bogen'}
            </button>
          </>
        )}
      </div>
      {aendern && (
        <div className="notensatz-zeile">
          <div className="segment !mx-0" role="group" aria-label="Notenwert">
            {werte.map((w) => <button key={w.zellen} type="button" aria-pressed={wert === w.zellen} onClick={() => setWert(w.zellen)} aria-label={w.name}>{w.kurz}</button>)}
          </div>
          <label className="einspiel-feld"><span>punktiert</span>
            <input type="checkbox" role="switch" className="ios-schalter" checked={punkt} onChange={(e) => setPunktUnd(e.target.checked)} disabled={punktiert(wert, raster) === null} />
          </label>
          <label className="einspiel-feld"><span>Triole</span>
            <input type="checkbox" role="switch" className="ios-schalter" checked={tri} onChange={(e) => setTriUnd(e.target.checked)} disabled={triole(wert, raster) === null} />
          </label>
          <span className="notensatz-trenner" aria-hidden="true" />
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { const nach = auswahl ? auswahl.takt : takte.length - 1; aendern(inAllen(stimmen, (t) => taktEinfuegen(t, raster, nach))); setAuswahl({ stimme: aktiv, takt: nach + 1, note: 0 }); }}>Takt +</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aendern(inAllen(stimmen, (t) => taktLoeschen(t, raster, auswahl ? auswahl.takt : takte.length - 1)))} disabled={!takte.length}>Takt −</button>
        </div>
      )}
      {(aendern || stimmen.length > 1) && (
        <div className="notensatz-zeile">
          <div className="segment !mx-0" role="group" aria-label="Stimme">
            {stimmen.map((s, i) => <button key={i} type="button" aria-pressed={aktiv === i} onClick={() => stimmeWaehlen(i)}>{s.name || (stimmen.length > 1 ? `Stimme ${i + 1}` : 'Stimme')}{stumm.has(i) ? ' ·' : ''}</button>)}
          </div>
          {aendern && (
            <>
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { aendern(stimmeHinzu(stimmen, raster)); stimmeWaehlen(stimmen.length); }}>+ Stimme</button>
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { aendern(stimmeWeg(stimmen, aktiv)); stimmeWaehlen(Math.max(0, aktiv - 1)); }} disabled={stimmen.length < 2}>− Stimme</button>
              <input className="feld feld-zahl" value={stimmen[aktiv]?.name ?? ''} placeholder={`Stimme ${aktiv + 1}`} aria-label="Name der Stimme"
                onChange={(e) => aendern(stimmeAendern(stimmen, aktiv, { name: e.target.value }))} />
              <div className="segment !mx-0" role="group" aria-label="Schlüssel">
                <button type="button" aria-pressed={stimmen[aktiv]?.schluessel !== 'bass'} onClick={() => aendern(stimmeAendern(stimmen, aktiv, { schluessel: 'violin' }))} aria-label="Violinschlüssel">𝄞</button>
                <button type="button" aria-pressed={stimmen[aktiv]?.schluessel === 'bass'} onClick={() => aendern(stimmeAendern(stimmen, aktiv, { schluessel: 'bass' }))} aria-label="Bassschlüssel">𝄢</button>
              </div>
            </>
          )}
          {stimmen.length > 1 && (
            <label className="einspiel-feld"><span>stumm</span>
              <input type="checkbox" role="switch" className="ios-schalter" checked={stumm.has(aktiv)} onChange={(e) => stummSchalten(aktiv, e.target.checked)} />
            </label>
          )}
        </div>
      )}
      <div ref={bild} className={`einspiel-noten ${aendern ? 'bearbeitbar' : ''}`} aria-label="Noten" tabIndex={aendern ? 0 : undefined} />
      {hinweise.length > 0 && (
        <ul className="hinweise" aria-label="Hinweise zur Notation">
          {(alleHinweise ? hinweise : hinweise.slice(0, 6)).map((h, i) => (
            <li key={i}>
              <button type="button" className={`hinweis ${h.art}`} title="Zur Stelle springen"
                onClick={() => { if (h.takt !== null) setAuswahl({ stimme: h.stimme ?? aktiv, takt: h.takt, note: 0 }); }}>{h.text}</button>
            </li>
          ))}
          {hinweise.length > 6 && !alleHinweise && <li><button type="button" className="hinweis" onClick={() => setAlleHinweise(true)}>… und {hinweise.length - 6} weitere</button></li>}
        </ul>
      )}
    </div>
  );
}
