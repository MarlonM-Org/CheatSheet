'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AbcElem, ClickListenerDrag, TuneObject } from 'abcjs';
import { alsAbcStimmen, SCHLUESSEL, type Raster, type Stimme, type Takt, type Tonart, tonartTransponieren,
} from '@/domain/notation';
import {
  alleNoten, angebunden, bindebogenUmschalten, danachEinfuegen, haltebogenViele, inAllen, inStimme, klaengeAlle, leiterVerschieben, leiterVerschiebenViele,
  letzteHoehe, loeschenViele, noteSchreiben, notenZeiten, paletteWerte, pausenViele, punktiert, stimmeAendern, stimmeHinzu, stimmeWeg, taktEinfuegen,
  taktLoeschen, taktStimmt, transponieren, triole, verschiebenViele, wertSetzen, type NotenPos,
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
// Mit der Maus verschiebt Ziehen eine Note; auf Touch scrollt Ziehen. Für
// Finger und Stift gibt es „Markieren“: dann zieht ein Rahmen über Noten
// alle hinein (Mehrfachauswahl), Ziehen an einer gewählten Note verschiebt
// alle gewählten auf der Leiter, und ▲▼, Pause, Löschen wirken auf alle.
// Tastatur: ↑↓ Halbton, ⇧↑↓ Oktave, ←→ Note wechseln, Entf Pause,
// Rückschritt löscht.

const WERT_SCHLUESSEL = 'ueben:notensatz-wert';

// Lage einer gezeichneten Note: Stimme, darin Takt und Note.
export interface BlattPos extends NotenPos { stimme: number }

// Ein auswählbares Element von abcjs mit dem, was wir davon brauchen.
interface Auswaehlbar { absEl: { abcelem: AbcElem; highlight?: (k?: string, farbe?: string) => void; unhighlight?: (k?: string, farbe?: string) => void }; svgEl: SVGElement }
// Je Stimme die Noten-Elemente in Lesereihenfolge.
type Elemente = Auswaehlbar[][];

const lagenVon = (s: Stimme) => s.takte.flatMap((t, takt) => t.noten.map((_, note) => ({ takt, note })));

// Hervorgehobene Takte einer Stimme (Aufnahmeleiste: Zieltakt, Vorschau).
export interface Hervorgehoben { stimme: number; von: number; bis: number; farbe: 'messing' | 'warnung' }
export interface BlattStand { auswahl: BlattPos | null; aktiv: number; stumm: number[]; takte: number }

export function Notenblatt({ stimmen, raster, tonart, titel, aendern, tonartAendern, verlauf, hervorgehoben, aufnehmen, beiStand, auswahlVorgabe }: {
  stimmen: Stimme[]; raster: Raster; tonart: Tonart | null; titel: string;
  // Ohne `aendern` nur ansehen und vorspielen.
  aendern?: (stimmen: Stimme[]) => void;
  // Beim Transponieren folgt die Tonart (wer sie hält, setzt sie neu).
  tonartAendern?: (tonart: Tonart | null) => void;
  // Rückgängig/Wiederherstellen (null: gerade nicht möglich).
  verlauf?: { zurueck: (() => void) | null; vor: (() => void) | null };
  hervorgehoben?: Hervorgehoben | null;
  // ● in der Palette: ab dem gewählten Takt aufnehmen (Aufnahmeleiste).
  aufnehmen?: () => void;
  // Wer draußen mitlesen will, wo gerade gearbeitet wird (Auswahl, Stimme, stumme Stimmen, Taktzahl).
  beiStand?: (stand: BlattStand) => void;
  // Auswahl von außen setzen (nach dem Übernehmen einer Aufnahme: der nächste Takt).
  auswahlVorgabe?: BlattPos | null;
}) {
  const metro = useMetronom();
  const stimm = useStimmgeraetApi();
  const abc = useMemo(() => alsAbcStimmen(stimmen, raster, { titel }, tonart), [stimmen, raster, titel, tonart]);
  const bild = useRef<HTMLDivElement>(null);
  const tune = useRef<TuneObject | null>(null);
  const elemente = useRef<Elemente>([]);
  const [auswahlRoh, setAuswahl] = useState<BlattPos | null>(null);
  // Weitere gewählte Noten (Mehrfachauswahl), auch in anderen Stimmen.
  const [mehr, setMehr] = useState<BlattPos[]>([]);
  // Auswahl von außen (neue Vorgabe → übernehmen; abgeleiteter Zustand, kein Effekt).
  const [letzteVorgabe, setLetzteVorgabe] = useState(auswahlVorgabe ?? null);
  if ((auswahlVorgabe ?? null) !== letzteVorgabe) { setLetzteVorgabe(auswahlVorgabe ?? null); if (auswahlVorgabe) { setAuswahl(auswahlVorgabe); setMehr([]); } }
  const [markieren, setMarkieren] = useState(false);
  // Hinweis zu transponierenden Instrumenten im Mehr-Menü.
  const [transponierInfo, setTransponierInfo] = useState(false);
  // Offenes Menü der Palette: „Mehr“ oder „Stimme“.
  const [menue, setMenue] = useState<'mehr' | 'stimme' | null>(null);
  const [rahmen, setRahmen] = useState<{ x: number; y: number; b: number; h: number } | null>(null);
  const lasso = useRef<{ x0: number; y0: number; ziehen: { lagen: BlattPos[]; schritt: number; schritte: number } | null } | null>(null);
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
        setAuswahl(p); setMehr([]);
        // Ziehen nur mit der Maus: Schritte auf der Leiter, nach unten positiv.
        // Bei Touch reicht abcjs hier keinen Event durch, sondern den
        // Berührungspunkt — und das Scrollen zählte sonst als Ziehen.
        const s = stand.current;
        if (s.aendern && drag.step && typeof MouseEvent !== 'undefined' && ev instanceof MouseEvent) {
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

  // Takte, deren Länge nicht zur Taktart passt, rot (nach jedem Zeichnen neu).
  useEffect(() => {
    const rot = farbe('--warnung', '#b42318');
    const liste: [number, number][] = [];
    stimmen.forEach((s, st) => { let k = 0; s.takte.forEach((t) => { const falsch = !taktStimmt(t, raster); t.noten.forEach(() => { if (falsch) liste.push([st, k]); k++; }); }); });
    for (const [st, i] of liste) faerben(st, i, rot);
    return () => { if (!vorspiel.current) for (const [st, i] of liste) faerben(st, i, null); };
  }, [stimmen, raster, gezeichnet, faerben, farbe]);

  // Auswahl färben (nach jedem Zeichnen neu) — die Hauptnote und die weiteren.
  useEffect(() => {
    const alle = (auswahl ? [auswahl, ...mehr] : mehr).map((p) => [p.stimme, index(p)] as const).filter(([, i]) => i >= 0);
    for (const [st, i] of alle) faerben(st, i, farbe('--messing', '#a8781f'));
    return () => { if (!vorspiel.current) for (const [st, i] of alle) faerben(st, i, null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, mehr, gezeichnet, faerben, farbe]);

  // Hervorgehobene Takte färben (nach jedem Zeichnen neu).
  useEffect(() => {
    if (!hervorgehoben) return;
    const f = farbe(hervorgehoben.farbe === 'warnung' ? '--warnung' : '--messing', hervorgehoben.farbe === 'warnung' ? '#b42318' : '#a8781f');
    const st = hervorgehoben.stimme;
    const liste = (lagen[st] ?? []).map((l, i) => (l.takt >= hervorgehoben.von && l.takt < hervorgehoben.bis ? i : -1)).filter((i) => i >= 0);
    for (const i of liste) faerben(st, i, f);
    return () => { if (!vorspiel.current) for (const i of liste) faerben(st, i, null); };
  }, [hervorgehoben, lagen, gezeichnet, faerben, farbe]);
  // Stand nach außen melden.
  useEffect(() => { beiStand?.({ auswahl, aktiv, stumm: [...stumm], takte: takte.length }); }, [beiStand, auswahl, aktiv, stumm, takte.length]);

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
  const setWert = (z: number) => { setWertRoh(z); speichern(WERT_SCHLUESSEL, z); if (auswahl) { const p = auswahl; inAktiver((t) => wertSetzen(t, raster, p, dauerAus(z, punkt, tri))); } };
  const setPunktUnd = (p: boolean) => { setPunkt(p); if (p) setTri(false); if (auswahl) { const a = auswahl; inAktiver((t) => wertSetzen(t, raster, a, dauerAus(wert, p, false))); } };
  const setTriUnd = (t: boolean) => { setTri(t); if (t) setPunkt(false); if (auswahl) { const a = auswahl; inAktiver((x) => wertSetzen(x, raster, a, dauerAus(wert, false, t))); } };
  const note = auswahl ? takte[auswahl.takt]?.noten[auswahl.note] : undefined;
  const schreiben = () => {
    if (!aendern) return;
    const p: NotenPos = auswahl ?? { takt: 0, note: 0 };
    const hoehe = takte[p.takt]?.noten[p.note]?.midi ?? letzteHoehe(takte, p);
    const { takte: neu, naechste } = noteSchreiben(takte, raster, p, hoehe, dauerAus(wert, punkt, tri));
    aendern(inStimme(stimmen, aktiv, neu, raster));
    setAuswahl({ stimme: aktiv, ...(naechste ?? p) });
  };
  const bewegen = (schritt: number) => { if (auswahl) { const i = index(auswahl) + schritt; const l = lagen[auswahl.stimme]?.[i]; if (l) { setAuswahl({ stimme: auswahl.stimme, ...l }); setMehr([]); } } };
  // Alle gewählten Noten, je Stimme — eine Änderung trifft sie alle.
  const gewaehlt = useMemo(() => (auswahl ? [auswahl, ...mehr.filter((m) => !(m.stimme === auswahl.stimme && m.takt === auswahl.takt && m.note === auswahl.note))] : mehr), [auswahl, mehr]);
  const aufAlle = (f: (t: Takt[], lagen: NotenPos[]) => Takt[]) => {
    if (!aendern || !gewaehlt.length) return;
    let st = stimmen;
    const je = new Map<number, NotenPos[]>();
    for (const g of gewaehlt) je.set(g.stimme, [...(je.get(g.stimme) ?? []), { takt: g.takt, note: g.note }]);
    for (const [stimme, l] of je) st = inStimme(st, stimme, f(st[stimme].takte, l), raster);
    aendern(st);
  };
  const tasten = (e: React.KeyboardEvent) => {
    if (!aendern || (e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); aufAlle((t, l) => verschiebenViele(t, raster, l, (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1))); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); bewegen(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === 'Delete') { e.preventDefault(); aufAlle((t, l) => pausenViele(t, raster, l)); }
    else if (e.key === 'Backspace') { e.preventDefault(); aufAlle((t, l) => loeschenViele(t, raster, l)); setMehr([]); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (e.shiftKey) verlauf?.vor?.(); else verlauf?.zurueck?.(); }
    else if (e.key === 'y' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); verlauf?.vor?.(); }
    else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); alleWaehlen(); }
  };
  const stimmeWaehlen = (i: number) => { setAktiv(i); setAuswahl(null); setMehr([]); };
  const alleWaehlen = () => {
    const l = alleNoten(takte).map((p) => ({ stimme: aktiv, ...p }));
    setAuswahl(l[0] ?? null); setMehr(l.slice(1));
  };

  // ── Markieren: Rahmen ziehen oder gewählte Noten mit Finger/Stift verschieben ──
  const lage = (e: React.PointerEvent) => { const r = bild.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  // Alle gezeichneten Noten mit ihrem Rechteck (relativ zum Blatt).
  const kaestchen = () => {
    const r = bild.current!.getBoundingClientRect();
    return elemente.current.flatMap((liste, stimme) => liste.map((e, i) => {
      const b = e.svgEl.getBoundingClientRect();
      const l = lagen[stimme]?.[i];
      return l ? { pos: { stimme, ...l } as BlattPos, el: e.svgEl as unknown as HTMLElement, x: b.left - r.left, y: b.top - r.top, b: b.width, h: b.height } : null;
    }).filter((k): k is NonNullable<typeof k> => !!k));
  };
  const gleich = (a: BlattPos, b: BlattPos) => a.stimme === b.stimme && a.takt === b.takt && a.note === b.note;
  // Ein Leiterschritt in Bildschirm-Pixeln: der halbe Linienabstand des ersten Systems.
  const schrittPx = () => { const st = bild.current?.querySelector('.abcjs-staff'); return st ? Math.max(2, st.getBoundingClientRect().height / 8) : 6; };
  const lassoStart = (e: React.PointerEvent) => {
    if (!markieren || !aendern) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = lage(e);
    const treffer = kaestchen().find((k) => x >= k.x - 6 && x <= k.x + k.b + 6 && y >= k.y - 6 && y <= k.y + k.h + 6);
    if (treffer) {
      const drin = gewaehlt.some((g) => gleich(g, treffer.pos));
      if (!drin) { setAuswahl(treffer.pos); setMehr([]); }
      lasso.current = { x0: x, y0: y, ziehen: { lagen: drin ? gewaehlt : [treffer.pos], schritt: schrittPx(), schritte: 0 } };
    } else {
      lasso.current = { x0: x, y0: y, ziehen: null };
      setRahmen({ x, y, b: 0, h: 0 });
    }
  };
  const lassoBewegen = (e: React.PointerEvent) => {
    const l = lasso.current;
    if (!l) return;
    const { x, y } = lage(e);
    if (l.ziehen) {
      const schritte = Math.round((y - l.y0) / l.ziehen.schritt);
      if (schritte !== l.ziehen.schritte) {
        l.ziehen.schritte = schritte;
        const k = kaestchen();
        for (const g of l.ziehen.lagen) { const el = k.find((x2) => gleich(x2.pos, g))?.el; if (el) el.style.transform = `translate(0, ${schritte * l.ziehen.schritt}px)`; }
      }
    } else setRahmen({ x: Math.min(x, l.x0), y: Math.min(y, l.y0), b: Math.abs(x - l.x0), h: Math.abs(y - l.y0) });
  };
  const lassoEnde = () => {
    const l = lasso.current;
    lasso.current = null;
    if (!l) return;
    if (l.ziehen) {
      const k = kaestchen();
      for (const g of l.ziehen.lagen) { const el = k.find((x2) => gleich(x2.pos, g))?.el; if (el) el.style.transform = ''; }
      if (l.ziehen.schritte && aendern) {
        let st = stimmen;
        const je = new Map<number, NotenPos[]>();
        for (const g of l.ziehen.lagen) je.set(g.stimme, [...(je.get(g.stimme) ?? []), { takt: g.takt, note: g.note }]);
        for (const [stimme, lagen2] of je) st = inStimme(st, stimme, leiterVerschiebenViele(st[stimme].takte, raster, lagen2, -l.ziehen.schritte, tonart), raster);
        aendern(st);
      }
      return;
    }
    const r = rahmen;
    setRahmen(null);
    if (!r || (r.b < 4 && r.h < 4)) { setAuswahl(null); setMehr([]); return; }
    const drin = kaestchen().filter((k) => k.x + k.b / 2 >= r.x && k.x + k.b / 2 <= r.x + r.b && k.y + k.h / 2 >= r.y && k.y + k.h / 2 <= r.y + r.h)
      .map((k) => k.pos).filter((p) => stimmen[p.stimme]?.takte[p.takt]?.noten[p.note]?.midi !== null);
    setAuswahl(drin[0] ?? null); setMehr(drin.slice(1));
  };
  const stummSchalten = (i: number, an: boolean) => setStumm((alt) => { const neu = new Set(alt); if (an) neu.add(i); else neu.delete(i); return neu; });
  const hatNoten = lagen.some((l) => l.length);
  // Alle Noten aller Stimmen um Halbtöne versetzen; die Tonart zieht mit (ein Rückgängig-Schritt).
  const transponierenUm = (halbtoene: number) => { if (!aendern) return; aendern(transponieren(stimmen, raster, halbtoene)); tonartAendern?.(tonartTransponieren(tonart, halbtoene)); };
  const viele = gewaehlt.length > 1 ? ` (${gewaehlt.length})` : '';
  // Hinter der gewählten Note einfügen: Note (Höhe der gewählten) oder Pause, im Palettenwert.
  const danach = (midi: 'note' | null) => {
    if (!aendern || !auswahl) return;
    const p = auswahl;
    const hoehe = midi === null ? null : takte[p.takt]?.noten[p.note]?.midi ?? letzteHoehe(takte, p);
    const { takte: neu, neu: lage2 } = danachEinfuegen(takte, raster, p, hoehe, dauerAus(wert, punkt, tri));
    aendern(inStimme(stimmen, aktiv, neu, raster));
    setAuswahl({ stimme: aktiv, ...lage2 }); setMehr([]);
  };

  const stimmeName = (i: number) => stimmen[i]?.name || `Stimme ${i + 1}`;
  const schluesselJetzt = SCHLUESSEL.find((s) => s.art === (stimmen[aktiv]?.schluessel ?? 'violin')) ?? SCHLUESSEL[0];
  const hatBogen = !!auswahl && angebunden(takte, auswahl);
  // Bindebogen: liegt genau über der Auswahl (erste Note Anfang, letzte Ende)?
  const hatBinde = (() => {
    if (gewaehlt.length < 2) return false;
    const l = [...gewaehlt].sort((a, b) => a.stimme - b.stimme || a.takt - b.takt || a.note - b.note);
    const a = stimmen[l[0].stimme]?.takte[l[0].takt]?.noten[l[0].note], z = stimmen[l[l.length - 1].stimme]?.takte[l[l.length - 1].takt]?.noten[l[l.length - 1].note];
    return !!a?.bogenAuf && !!z?.bogenZu;
  })();
  // Die Hauptzeile zeigt 1/1 … 1/16, das Seltene (1/32) steht im Menü „Mehr“.
  const werteHaupt = werte.filter((w) => w.kurz !== '1/32');
  const werteMehr = werte.filter((w) => w.kurz === '1/32');
  const wertKnopf = (w: { zellen: number; name: string; kurz: string }) => (
    <button key={w.zellen} type="button" aria-pressed={wert === w.zellen} onClick={() => setWert(w.zellen)} aria-label={w.name} title={w.name}>{w.kurz}</button>
  );
  const menueTasten = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenue(null); } };

  return (
    <div className="notensatz" onKeyDown={tasten}>
      {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
      {/* Palette: eine Hauptzeile mit dem Meistgenutzten als Knopfblöcke
          (gleiche Höhe, Symbolknöpfe quadratisch) — Vorspielen, Verlauf,
          Halbton, Note/Pause/Löschen, Bögen, Notenwert. Das Seltenere steht
          rechts in zwei Menüs: „Mehr“ (Oktave, Einfügen, 1/32, punktiert,
          Triole, Takt, Auswahl) und „Stimme“ (Stimmen, Name, Schlüssel,
          stumm). Tooltip und aria-label erklären jeden Knopf. */}
      <div className="notensatz-palette" role="group" aria-label="Werkzeuge">
        <div className="notensatz-block">
          <button type="button" className="symbol pfeil" onClick={abspielen} aria-pressed={spielt} disabled={!hatNoten}
            aria-label={spielt ? 'Anhalten' : auswahl && index(auswahl) > 0 ? 'Ab der gewählten Note vorspielen' : 'Vorspielen'}
            title={spielt ? 'Anhalten' : auswahl && index(auswahl) > 0 ? 'Ab der gewählten Note vorspielen' : 'Vorspielen (alle Stimmen, Klavierklang)'}>
            {spielt ? '■' : '▶'}
          </button>
          {aendern && aufnehmen && (
            <button type="button" className="symbol aufnahme-punkt" onClick={aufnehmen} aria-label="Ab dem gewählten Takt aufnehmen" title="Aufnehmen: ab dem gewählten Takt einsingen, dann einfügen oder ersetzen">●</button>
          )}
        </div>
        {aendern && verlauf && (
          <div className="notensatz-block">
            <button type="button" className="symbol" onClick={() => verlauf.zurueck?.()} disabled={!verlauf.zurueck} aria-label="Rückgängig" title="Rückgängig (⌘Z)">↶</button>
            <button type="button" className="symbol" onClick={() => verlauf.vor?.()} disabled={!verlauf.vor} aria-label="Wiederherstellen" title="Wiederherstellen (⇧⌘Z)">↷</button>
          </div>
        )}
        {aendern && (
          <>
            <div className="notensatz-block">
              <button type="button" className="symbol pfeil" onClick={() => aufAlle((t, l) => verschiebenViele(t, raster, l, 1))} disabled={!gewaehlt.length} aria-label={`Halbton höher${viele}`} title={`Halbton höher${viele} (↑)`}>▲</button>
              <button type="button" className="symbol pfeil" onClick={() => aufAlle((t, l) => verschiebenViele(t, raster, l, -1))} disabled={!gewaehlt.length} aria-label={`Halbton tiefer${viele}`} title={`Halbton tiefer${viele} (↓)`}>▼</button>
            </div>
            <div className="notensatz-block">
              <button type="button" className="symbol" onClick={schreiben} disabled={!takte.length} aria-label="Note schreiben" title="Note schreiben: die gewählte Pause wird zur Note im Palettenwert"><SymbolNote /></button>
              <button type="button" className="symbol" onClick={() => aufAlle((t, l) => pausenViele(t, raster, l))} disabled={!gewaehlt.length} aria-label={`Zur Pause machen${viele}`} title={`Zur Pause machen${viele} (Entf)`}><SymbolPause /></button>
              <button type="button" className="symbol" onClick={() => { aufAlle((t, l) => loeschenViele(t, raster, l)); setMehr([]); }} disabled={!gewaehlt.length} aria-label={`Löschen${viele}`}
                title={`Löschen${viele} (⌫): Noten aus dem Takt nehmen — die anderen Takte bleiben; der Takt ist dann zu kurz (rot), bis er stimmt`}><SymbolKreuz /></button>
            </div>
            {/* Haltebogen (gleiche Höhe, Dauern addieren sich) über alle gewählten
                Paare; Bindebogen (Phrasierung) von der ersten zur letzten gewählten Note. */}
            <div className="notensatz-block">
              <button type="button" className="symbol" onClick={() => aufAlle((t, l) => haltebogenViele(t, raster, l))} disabled={!gewaehlt.length || (gewaehlt.length === 1 && (!note || note.midi === null))} aria-pressed={hatBogen}
                aria-label={`Haltebogen${viele}`} title={gewaehlt.length > 1 ? 'Haltebogen: gewählte Noten gleicher Höhe nacheinander binden' : hatBogen ? 'Haltebogen lösen — die Note wird ein eigener Einsatz' : 'Haltebogen: an die vorige Note binden (gleiche Höhe, Dauern addieren sich)'}><SymbolHaltebogen /></button>
              <button type="button" className="symbol" onClick={() => aufAlle((t, l) => bindebogenUmschalten(t, raster, l))} disabled={gewaehlt.length < 2} aria-pressed={hatBinde}
                aria-label={`Bindebogen${viele}`} title={hatBinde ? 'Bindebogen über die Auswahl entfernen' : 'Bindebogen: von der ersten zur letzten gewählten Note (Phrasierung) — erst Noten markieren'}><SymbolBindebogen /></button>
            </div>
            <div className="notensatz-block" role="group" aria-label="Notenwert">
              {werteHaupt.map(wertKnopf)}
            </div>
          </>
        )}
        {(aendern || stimmen.length > 1) && (
          <div className="notensatz-menues">
            {aendern && (
              <div className="notensatz-menue" onKeyDown={menueTasten}>
                <button type="button" className="notensatz-menue-knopf" aria-expanded={menue === 'mehr'} aria-haspopup="true" onClick={() => setMenue(menue === 'mehr' ? null : 'mehr')}
                  title="Mehr: Oktave, Transponieren, Einfügen, 1/32, punktiert, Triole, Takt, Auswahl">
                  Mehr<SymbolPfeil />{(markieren || punkt || tri) && <span className="ziel-punkt" aria-hidden="true" />}
                </button>
                {menue === 'mehr' && (
                  <>
                    <button type="button" className="nav-fang" aria-label="Menü schließen" onClick={() => setMenue(null)} />
                    <div className="notensatz-blase" role="group" aria-label="Mehr">
                      <div className="notensatz-gruppe">
                        <span>Oktave{viele}</span>
                        <div className="notensatz-block">
                          <button type="button" onClick={() => aufAlle((t, l) => verschiebenViele(t, raster, l, 12))} disabled={!gewaehlt.length} aria-label={`Oktave höher${viele}`} title="Oktave höher (⇧↑)">▲ höher</button>
                          <button type="button" onClick={() => aufAlle((t, l) => verschiebenViele(t, raster, l, -12))} disabled={!gewaehlt.length} aria-label={`Oktave tiefer${viele}`} title="Oktave tiefer (⇧↓)">▼ tiefer</button>
                        </div>
                      </div>
                      <div className="notensatz-gruppe">
                        <span>Transponieren · alle Stimmen</span>
                        <div className="notensatz-block">
                          <button type="button" onClick={() => transponierenUm(-1)} disabled={!hatNoten} aria-label="Alles einen Halbton tiefer" title="Alle Noten aller Stimmen einen Halbton tiefer; die Tonart zieht mit">−1</button>
                          <button type="button" onClick={() => transponierenUm(1)} disabled={!hatNoten} aria-label="Alles einen Halbton höher" title="Alle Noten aller Stimmen einen Halbton höher; die Tonart zieht mit">+1</button>
                          <button type="button" className="symbol" aria-pressed={transponierInfo} onClick={() => setTransponierInfo(!transponierInfo)} aria-label="Hinweis zu transponierenden Instrumenten" title="Wie weit für B-, Es- und F-Instrumente?">ⓘ</button>
                        </div>
                        {transponierInfo && (
                          <p className="gedaempft text-xs" style={{ maxWidth: '22rem' }}>
                            Transponierende Instrumente lesen andere Noten, als sie klingen. Klingende Noten für ein <b>B-Instrument</b> (Klarinette, Trompete, Tenorsax) einen Ganzton höher schreiben: <b>+2</b>.
                            <b> Es-Instrument</b> (Altsax, Baritonsax): <b>+9</b>, oder <b>−3</b> eine Oktave tiefer. <b>F-Instrument</b> (Horn, Englischhorn): <b>+7</b>, oder <b>−5</b>. Umgekehrt (vom Instrument zu klingend) mit dem Vorzeichen andersherum.
                            Eingesungene oder eingespielte Noten sind schon für die Stimmung des Stimmgeräts notiert. Fehlt die Zieltonart in der Liste, bekommen die Noten einzelne Vorzeichen.
                          </p>
                        )}
                      </div>
                      <div className="notensatz-gruppe">
                        <span>Dahinter einfügen</span>
                        <div className="notensatz-block">
                          <button type="button" onClick={() => danach('note')} disabled={!auswahl} aria-label="Note dahinter einfügen" title="Hinter der gewählten Note eine Note im Palettenwert einfügen (nur in diesem Takt)"><SymbolNote /> Note</button>
                          <button type="button" onClick={() => danach(null)} disabled={!auswahl} aria-label="Pause dahinter einfügen" title="Hinter der gewählten Note eine Pause im Palettenwert einfügen (nur in diesem Takt)"><SymbolPause /> Pause</button>
                        </div>
                      </div>
                      <div className="notensatz-gruppe">
                        <span>Notenwert</span>
                        <div className="notensatz-block">
                          {werteMehr.map(wertKnopf)}
                          <button type="button" aria-pressed={punkt} onClick={() => setPunktUnd(!punkt)} disabled={punktiert(wert, raster) === null} aria-label="Punktiert" title="Punktiert: anderthalbfacher Wert">punktiert</button>
                          <button type="button" aria-pressed={tri} onClick={() => setTriUnd(!tri)} disabled={triole(wert, raster) === null} aria-label="Triole" title="Triole: drei auf zwei">Triole</button>
                        </div>
                      </div>
                      <div className="notensatz-gruppe">
                        <span>Takt</span>
                        <div className="notensatz-block">
                          <button type="button" onClick={() => { const nach = auswahl ? auswahl.takt : takte.length - 1; aendern(inAllen(stimmen, (t) => taktEinfuegen(t, raster, nach))); setAuswahl({ stimme: aktiv, takt: nach + 1, note: 0 }); }}
                            aria-label="Takt einfügen" title="Takt einfügen: hinter dem gewählten, in allen Stimmen">+ Takt</button>
                          <button type="button" onClick={() => aendern(inAllen(stimmen, (t) => taktLoeschen(t, raster, auswahl ? auswahl.takt : takte.length - 1)))} disabled={!takte.length}
                            aria-label="Takt löschen" title="Takt löschen: den gewählten, in allen Stimmen">− Takt</button>
                        </div>
                      </div>
                      <div className="notensatz-gruppe">
                        <span>Auswahl{gewaehlt.length > 1 ? ` · ${gewaehlt.length} Noten` : ''}</span>
                        <div className="notensatz-block">
                          <button type="button" aria-pressed={markieren} onClick={() => { setMarkieren(!markieren); setRahmen(null); lasso.current = null; }} aria-label="Markieren"
                            title="Markieren: mit Finger oder Stift einen Rahmen um Noten ziehen; gewählte Noten ziehen verschiebt sie alle"><SymbolRahmen /> Markieren</button>
                          <button type="button" onClick={alleWaehlen} disabled={!hatNoten} aria-label="Alle Noten der Stimme wählen" title="Alle Noten der Stimme wählen (⌘A)">Alle</button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="notensatz-menue" onKeyDown={menueTasten}>
              <button type="button" className="notensatz-menue-knopf" aria-expanded={menue === 'stimme'} aria-haspopup="true" onClick={() => setMenue(menue === 'stimme' ? null : 'stimme')}
                title={`Stimme: ${stimmeName(aktiv)}, ${schluesselJetzt.name}${stumm.has(aktiv) ? ', stumm' : ''}`}>
                <span className="notensatz-schluessel" aria-hidden="true">{schluesselJetzt.zeichen}</span>
                <span className="notensatz-menue-text">{stimmeName(aktiv)}{stumm.has(aktiv) ? ' ·' : ''}</span><SymbolPfeil />
              </button>
              {menue === 'stimme' && (
                <>
                  <button type="button" className="nav-fang" aria-label="Menü schließen" onClick={() => setMenue(null)} />
                  <div className="notensatz-blase" role="group" aria-label="Stimme">
                    <div className="notensatz-gruppe breit">
                      <span>Stimme</span>
                      <div className="notensatz-reihe">
                        <div className="notensatz-block" role="group" aria-label="Stimme wählen">
                          {stimmen.map((s, i) => <button key={i} type="button" aria-pressed={aktiv === i} onClick={() => stimmeWaehlen(i)} title={stumm.has(i) ? `${stimmeName(i)} (stumm)` : stimmeName(i)}>{s.name || (stimmen.length > 1 ? `Stimme ${i + 1}` : 'Stimme')}{stumm.has(i) ? ' ·' : ''}</button>)}
                        </div>
                        {aendern && (
                          <div className="notensatz-block">
                            <button type="button" className="symbol" onClick={() => { aendern(stimmeHinzu(stimmen, raster)); stimmeWaehlen(stimmen.length); }} aria-label="Stimme hinzufügen" title="Stimme hinzufügen: darunter, gleiche Takte">+</button>
                            <button type="button" className="symbol" onClick={() => { aendern(stimmeWeg(stimmen, aktiv)); stimmeWaehlen(Math.max(0, aktiv - 1)); }} disabled={stimmen.length < 2} aria-label="Stimme entfernen" title="Diese Stimme entfernen">−</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {aendern && (
                      <>
                        <label className="notensatz-gruppe"><span>Name</span>
                          <input className="feld notensatz-feld" value={stimmen[aktiv]?.name ?? ''} placeholder={`Stimme ${aktiv + 1}`} aria-label="Name der Stimme"
                            onChange={(e) => aendern(stimmeAendern(stimmen, aktiv, { name: e.target.value }))} />
                        </label>
                        <div className="notensatz-gruppe breit">
                          <span>Schlüssel</span>
                          <div className="notensatz-block" role="group" aria-label="Schlüssel">
                            {SCHLUESSEL.map((s) => (
                              <button key={s.art} type="button" aria-pressed={schluesselJetzt.art === s.art} onClick={() => aendern(stimmeAendern(stimmen, aktiv, { schluessel: s.art }))} aria-label={s.name} title={s.name}>
                                <span className="notensatz-schluessel" aria-hidden="true">{s.zeichen}</span>{s.name.replace(/schlüssel.*$/, '')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {stimmen.length > 1 && (
                      <div className="notensatz-gruppe">
                        <span>Vorspielen</span>
                        <div className="notensatz-block">
                          <button type="button" aria-pressed={stumm.has(aktiv)} onClick={() => stummSchalten(aktiv, !stumm.has(aktiv))} aria-label={`${stimmeName(aktiv)} stumm`} title="Stumm: diese Stimme beim Vorspielen auslassen"><SymbolStumm /> stumm</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className={`notensatz-blatt ${markieren ? 'markieren' : ''}`}>
        <div ref={bild} className={`einspiel-noten ${aendern ? 'bearbeitbar' : ''}`} aria-label="Noten" tabIndex={aendern ? 0 : undefined} />
        {markieren && aendern && (
          <div className="lasso-flaeche" onPointerDown={lassoStart} onPointerMove={lassoBewegen} onPointerUp={lassoEnde} onPointerCancel={lassoEnde} aria-hidden="true">
            {rahmen && <div className="lasso-rahmen" style={{ left: rahmen.x, top: rahmen.y, width: rahmen.b, height: rahmen.h }} />}
          </div>
        )}
      </div>
      {markieren && aendern && <p className="gedaempft text-xs">Markieren: Rahmen um Noten ziehen; an einer gewählten Note ziehen verschiebt alle gewählten. Tippen daneben hebt die Auswahl auf.</p>}
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

// Strichsymbole der Palette (wie die nav-rund-Knöpfe im Betrachter).
const symbol = (inhalt: React.ReactNode, breit = false) => (
  <svg className={`notensatz-symbol${breit ? ' breit' : ''}`} viewBox={breit ? '0 0 36 24' : '0 0 24 24'} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{inhalt}</svg>
);
// Viertelnote und Viertelpause.
const SymbolNote = () => symbol(<><ellipse cx="10" cy="17.5" rx="3.6" ry="2.5" transform="rotate(-20 10 17.5)" fill="currentColor" stroke="none" /><path d="M13.2 16.5V4" /></>);
const SymbolPause = () => symbol(<path d="M9 3l5 6.5-5 6 5 5.5c-3-2-6-.5-4 3" />);
const SymbolKreuz = () => symbol(<path d="M6 6l12 12M18 6L6 18" />);
// Haltebogen: zwei Notenköpfe gleicher Höhe, Bogen darunter.
const SymbolHaltebogen = () => symbol(<><ellipse cx="9" cy="10" rx="3" ry="2.2" fill="currentColor" stroke="none" /><ellipse cx="27" cy="10" rx="3" ry="2.2" fill="currentColor" stroke="none" /><path d="M9 14c4 5 14 5 18 0" /></>, true);
// Bindebogen: zwei verschiedene Notenköpfe, Bogen darüber.
const SymbolBindebogen = () => symbol(<><ellipse cx="9" cy="17" rx="3" ry="2.2" fill="currentColor" stroke="none" /><ellipse cx="27" cy="12" rx="3" ry="2.2" fill="currentColor" stroke="none" /><path d="M8 11c5-7 15-8 20-3" /></>, true);
const SymbolRahmen = () => symbol(<><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2.5" /><path d="M13 13l6 2-2.5 1-1 2.5z" fill="currentColor" /></>);
const SymbolStumm = () => symbol(<><path d="M4 10v4h3l4 3V7L7 10zM16 9l5 6M21 9l-5 6" /></>);
const SymbolPfeil = () => <svg className="notensatz-pfeil" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3" /></svg>;
