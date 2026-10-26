'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AbcElem, ClickListenerDrag, TuneObject } from 'abcjs';
import { alsAbc, type Raster, type Takt, type Tonart } from '@/domain/notation';
import {
  angebunden, bogenUmschalten, dauerSetzen, einfuegen, entfernen, klaenge, leiterVerschieben, letzteHoehe, noteSchreiben, notenZeiten, paletteWerte,
  punktiert, taktEinfuegen, taktLoeschen, tonSetzen, triole, verschieben, type NotenPos,
} from '@/domain/notensatz';
import { audioSitzung, gespeichert, speichern } from './klang';
import { vorspielen, type Vorspiel } from './klavier';
import { useMetronom } from './MetronomKontext';
import { useStimmgeraetApi } from './StimmgeraetKontext';
import { fehlerGrund } from './speicherfehler';

// Notenblatt (G-01/G-04): abcjs zeichnet die Takte; eine Note antippen wählt
// sie, Ziehen (Maus) verschiebt sie auf der Leiter, die Palette setzt Höhe,
// Wert, Pause, Bogen, Takte — wie in MuseScore, nur das Nötigste. „Vorspielen“
// spielt die Noten mit Klavierklang (./klavier) ab, ab der gewählten Note,
// und zeigt mit, wo es ist. Rechnen in @/domain/notensatz.
//
// Auf Touch-Geräten verschiebt Ziehen nichts (es scrollt): dort tragen die
// Pfeile. Tastatur: ↑↓ Halbton, ⇧↑↓ Oktave, ←→ Note wechseln, Entf Pause.

const WERT_SCHLUESSEL = 'ueben:notensatz-wert';

// Ein auswählbares Element von abcjs mit dem, was wir davon brauchen.
interface Auswaehlbar { absEl: { abcelem: AbcElem; highlight?: (k?: string, farbe?: string) => void; unhighlight?: (k?: string, farbe?: string) => void }; svgEl: SVGElement }

export function Notenblatt({ takte, raster, tonart, titel, aendern }: {
  takte: Takt[]; raster: Raster; tonart: Tonart | null; titel: string;
  // Ohne `aendern` nur ansehen und vorspielen.
  aendern?: (takte: Takt[]) => void;
}) {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  const abc = useMemo(() => alsAbc(takte, raster, { titel }, tonart), [takte, raster, titel, tonart]);
  const bild = useRef<HTMLDivElement>(null);
  const tune = useRef<TuneObject | null>(null);
  const elemente = useRef<Auswaehlbar[]>([]);
  const [auswahlRoh, setAuswahl] = useState<NotenPos | null>(null);
  // Auswahl verfällt auf die nächste Note, wenn es die gewählte nicht mehr gibt.
  const auswahl = useMemo<NotenPos | null>(() => {
    if (!auswahlRoh || takte[auswahlRoh.takt]?.noten[auswahlRoh.note]) return auswahlRoh;
    const t = Math.min(auswahlRoh.takt, takte.length - 1);
    return t >= 0 ? { takt: t, note: Math.max(0, Math.min(auswahlRoh.note, takte[t].noten.length - 1)) } : null;
  }, [auswahlRoh, takte]);
  const [wert, setWertRoh] = useState(() => gespeichert<number>(WERT_SCHLUESSEL, 4));
  const [punkt, setPunkt] = useState(false);
  const [tri, setTri] = useState(false);
  const [fehler, setFehler] = useState('');
  const [spielt, setSpielt] = useState(false);
  const vorspiel = useRef<(Vorspiel & { zeit: () => number; raf: number; zeiger: number }) | null>(null);
  // Die Rückrufe von abcjs sehen immer den aktuellen Stand.
  const stand = useRef({ takte, raster, tonart, aendern });
  useEffect(() => { stand.current = { takte, raster, tonart, aendern }; }, [takte, raster, tonart, aendern]);

  // Gezeichnete Noten in Lesereihenfolge ↔ Lage im Takt.
  const lagen = useMemo(() => takte.flatMap((t, takt) => t.noten.map((_, note) => ({ takt, note }))), [takte]);
  const index = (p: NotenPos) => lagen.findIndex((l) => l.takt === p.takt && l.note === p.note);
  const werte = useMemo(() => paletteWerte(raster), [raster]);
  const zeiten = useMemo(() => notenZeiten(takte, raster), [takte, raster]);

  const farbe = useCallback((name: string, sonst: string) => (bild.current ? getComputedStyle(bild.current).getPropertyValue(name).trim() || sonst : sonst), []);
  const faerben = useCallback((i: number, f: string | null) => {
    const e = elemente.current[i];
    if (!e) return;
    if (f) e.absEl.highlight?.(undefined, f); else e.absEl.unhighlight?.(undefined, farbe('--tinte', '#222'));
  }, [farbe]);

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
        const i = elemente.current.findIndex((e) => e.absEl.abcelem === abcElem);
        if (i < 0) return;
        const s = stand.current;
        const pos = s.takte.flatMap((t, takt) => t.noten.map((_, note) => ({ takt, note })))[i];
        if (!pos) return;
        setAuswahl(pos);
        // Ziehen (nur mit der Maus — auf Touch wäre es das Scrollen): Schritte auf der Leiter, nach unten positiv.
        if (s.aendern && drag.step && ev && ev.type !== 'touchend') s.aendern(leiterVerschieben(s.takte, s.raster, pos, -drag.step, s.tonart));
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
      elemente.current = (t.getSelectableArray() as unknown as Auswaehlbar[]).filter((e) => e.absEl?.abcelem?.el_type === 'note');
      setGezeichnet((n) => n + 1);
    }).catch((x) => setFehler(`Die Noten ließen sich nicht zeichnen: ${fehlerGrund(x)}`));
    return () => { aktuell = false; };
  }, [abc, breite, farbe]);

  // Auswahl färben (nach jedem Zeichnen neu).
  useEffect(() => {
    const i = auswahl ? index(auswahl) : -1;
    if (i >= 0) faerben(i, farbe('--messing', '#a8781f'));
    return () => { if (i >= 0 && !vorspiel.current) faerben(i, null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, gezeichnet, faerben, farbe]);

  // ── Vorspielen ──
  const anhalten = useCallback(() => {
    const v = vorspiel.current;
    if (!v) return;
    cancelAnimationFrame(v.raf);
    v.stopp();
    if (v.zeiger >= 0) faerben(v.zeiger, null);
    vorspiel.current = null;
    setSpielt(false);
    setAuswahl((a) => a); // Auswahl neu färben
    setGezeichnet((n) => n + 1);
  }, [faerben]);
  const abspielen = useCallback(() => {
    if (vorspiel.current) return anhalten();
    const ab = auswahl ? zeiten.zeiten[index(auswahl)] ?? 0 : 0;
    const liste = klaenge(takte, raster).filter((k) => k.beginn + k.dauer > ab + 1e-6)
      .map((k) => (k.beginn < ab ? { ...k, dauer: k.dauer - (ab - k.beginn), beginn: 0 } : { ...k, beginn: k.beginn - ab }));
    if (!liste.length) return;
    audioSitzung('playback');
    const v = { ...vorspielen(liste, stimm.stimmung, stimm.kammerton, metro.laut), raf: 0, zeiger: -1 };
    vorspiel.current = v;
    setSpielt(true);
    const gruen = farbe('--gut', '#1f7a43');
    const schleife = () => {
      if (vorspiel.current !== v) return;
      const t = v.zeit() + ab;
      if (t > zeiten.gesamt + 0.3) { anhalten(); return; }
      let i = -1;
      for (let k = 0; k < zeiten.zeiten.length && zeiten.zeiten[k] <= t; k++) i = k;
      if (i !== v.zeiger) {
        if (v.zeiger >= 0) faerben(v.zeiger, null);
        v.zeiger = i;
        if (i >= 0) faerben(i, gruen);
      }
      v.raf = requestAnimationFrame(schleife);
    };
    v.raf = requestAnimationFrame(schleife);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anhalten, auswahl, takte, raster, zeiten, stimm.stimmung, stimm.kammerton, metro.laut, farbe, faerben]);
  useEffect(() => () => { vorspiel.current?.stopp(); cancelAnimationFrame(vorspiel.current?.raf ?? 0); }, []);
  useEffect(() => { if (vorspiel.current) anhalten(); }, [takte, anhalten]);

  // ── Palette ──
  // Der Wert aus der Palette: Triole (zwei Drittel) oder punktiert (anderthalb).
  const dauerAus = (z: number, p: boolean, t: boolean) => (t ? triole(z, raster) ?? z : p ? punktiert(z, raster) ?? z : z);
  const setWert = (z: number) => { setWertRoh(z); speichern(WERT_SCHLUESSEL, z); if (auswahl && aendern) aendern(dauerSetzen(takte, raster, auswahl, dauerAus(z, punkt, tri))); };
  const setPunktUnd = (p: boolean) => { setPunkt(p); if (p) setTri(false); if (auswahl && aendern) aendern(dauerSetzen(takte, raster, auswahl, dauerAus(wert, p, false))); };
  const setTriUnd = (t: boolean) => { setTri(t); if (t) setPunkt(false); if (auswahl && aendern) aendern(dauerSetzen(takte, raster, auswahl, dauerAus(wert, false, t))); };
  const note = auswahl ? takte[auswahl.takt]?.noten[auswahl.note] : undefined;
  const schreiben = () => {
    if (!aendern) return;
    const pos = auswahl ?? { takt: 0, note: 0 };
    const hoehe = takte[pos.takt]?.noten[pos.note]?.midi ?? letzteHoehe(takte, pos);
    const { takte: neu, naechste } = noteSchreiben(takte, raster, pos, hoehe, dauerAus(wert, punkt, tri));
    aendern(neu);
    setAuswahl(naechste ?? pos);
  };
  const bewegen = (schritt: number) => { if (auswahl) { const i = index(auswahl) + schritt; if (lagen[i]) setAuswahl(lagen[i]); } };
  const tasten = (e: React.KeyboardEvent) => {
    if (!aendern || (e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (auswahl) aendern(verschieben(takte, raster, auswahl, (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1))); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); bewegen(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === 'Delete') { e.preventDefault(); if (auswahl) aendern(tonSetzen(takte, raster, auswahl, null)); }
    else if (e.key === 'Backspace') { e.preventDefault(); if (auswahl) aendern(entfernen(takte, raster, auswahl)); }
  };

  return (
    <div className="notensatz" onKeyDown={tasten}>
      {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
      <div className="notensatz-zeile">
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={abspielen} aria-pressed={spielt} disabled={!lagen.length}>
          {spielt ? '■ Anhalten' : auswahl && index(auswahl) > 0 ? '▶ Ab hier' : '▶ Vorspielen'}
        </button>
        {aendern && (
          <>
            <span className="notensatz-trenner" aria-hidden="true" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(verschieben(takte, raster, auswahl, 1))} disabled={!note || note.midi === null} aria-label="Halbton höher">▲</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(verschieben(takte, raster, auswahl, -1))} disabled={!note || note.midi === null} aria-label="Halbton tiefer">▼</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(verschieben(takte, raster, auswahl, 12))} disabled={!note || note.midi === null} aria-label="Oktave höher">▲8</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(verschieben(takte, raster, auswahl, -12))} disabled={!note || note.midi === null} aria-label="Oktave tiefer">▼8</button>
            <span className="notensatz-trenner" aria-hidden="true" />
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={schreiben} disabled={!lagen.length}>Note</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(einfuegen(takte, raster, auswahl, dauerAus(wert, punkt, tri)))} disabled={!auswahl} title="Vor der gewählten Note Platz einfügen — alles danach rückt weiter">Einfügen</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(tonSetzen(takte, raster, auswahl, null))} disabled={!note || note.midi === null}>Pause</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(entfernen(takte, raster, auswahl))} disabled={!auswahl} title="Note herausnehmen — alles danach rückt nach">Löschen</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => auswahl && aendern(bogenUmschalten(takte, raster, auswahl))} disabled={!note || note.midi === null}>
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
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { const nach = auswahl ? auswahl.takt : takte.length - 1; aendern(taktEinfuegen(takte, raster, nach)); setAuswahl({ takt: nach + 1, note: 0 }); }}>Takt +</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aendern(taktLoeschen(takte, raster, auswahl ? auswahl.takt : takte.length - 1))} disabled={!takte.length}>Takt −</button>
        </div>
      )}
      <div ref={bild} className={`einspiel-noten ${aendern ? 'bearbeitbar' : ''}`} aria-label="Noten" tabIndex={aendern ? 0 : undefined} />
    </div>
  );
}
