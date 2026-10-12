'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ansichten, ansichtVonSeite, hauptseite, radierZug, type Anmerkung, type Ansicht, type Blaettermodus } from '@/domain/notenpult';
import { einstellungPruefen, TEXT_GROESSE, type StiftEinstellung, type ZeichenWerkzeug } from '@/domain/stift';
import { mitRand, rechteckAus, type Rechteck } from '@/domain/ueben';
import { gespeichert as gespeicherterWert, speichern } from './klang';
import {
  anmerkungenSpeichern, anmerkungenVon, stueckAendern, stelleAnlegen, tempoGeschafft,
  type Stueck, type Stelle,
} from './lokal';
import { useMetronom } from './MetronomKontext';
import { ladeFehler, speicherFehler } from './speicherfehler';
import { StiftPalette, type Werkzeug } from './StiftPalette';
import { seiteMitEbene, type SeitenBild } from './pdf';
import { anmerkungenZeichnen, ebeneZeichnen, strichZeichnen } from './zeichnen';

const RAND = 0.06;
const MAX_PX = 2800;

interface Props {
  noten: Stueck; pdf: PDFDocumentProxy; stellen: Stelle[];
  geaendert: () => void;
  // Tasten blättern nur, wenn kein Overlay über den Noten liegt.
  tastenAktiv: boolean;
  // Sprung aus der Stellen-Übersicht: in den Stellen-Modus zu dieser Stelle.
  sprung: { stelle: string; n: number } | null;
  titelTipp: () => void;
}

export function NotenBetrachter({ noten, pdf, stellen, geaendert, tastenAktiv, sprung, titelTipp }: Props) {
  const seiten = pdf.numPages;
  const { bpm, setBpm } = useMetronom();

  // ── Blättern ──
  const [blaettern, setBlaettern] = useState(noten.blaettern ?? { modus: 'ganz' as Blaettermodus, linien: {} as Record<number, number> });
  const liste = useMemo(() => ansichten(seiten, blaettern.modus, blaettern.linien), [seiten, blaettern]);
  const [index, setIndex] = useState(0);
  const ansicht: Ansicht = liste[Math.min(index, liste.length - 1)];
  const blaetternSpeichern = (b: typeof blaettern) => {
    const seite = hauptseite(ansicht);
    setBlaettern(b);
    setIndex(ansichtVonSeite(ansichten(seiten, b.modus, b.linien), seite));
    stueckAendern(noten.id, { blaettern: b }).catch(speicherFehler);
  };

  // ── Modus: lesen oder Stelle für Stelle ──
  const [modus, setModus] = useState<'lesen' | 'stellen'>('lesen');
  const [stelleNr, setStelleNr] = useState(0);
  const stelle = modus === 'stellen' ? stellen[Math.min(stelleNr, stellen.length - 1)] : undefined;
  const [rand, setRand] = useState(true);
  const zumLesen = () => {
    if (stelle) setIndex(ansichtVonSeite(liste, stelle.seite));
    setModus('lesen');
  };
  const [zoom, setZoom] = useState(false);

  // ── Werkzeuge ──
  const [werkzeug, setWerkzeug] = useState<Werkzeug | null>(null);
  const [paletteOffen, setPaletteOffen] = useState(false);
  // Jedes Werkzeug merkt sich Farbe und Dicke (E-01/E-02, Pencil-Muster).
  const [einst, setEinst] = useState<Record<ZeichenWerkzeug, StiftEinstellung>>(() => ({
    stift: einstellungPruefen('stift', gespeicherterWert('ueben:stift', null)),
    marker: einstellungPruefen('marker', gespeicherterWert('ueben:marker', null)),
    text: einstellungPruefen('text', gespeicherterWert('ueben:text', null)),
  }));
  const einstellen = (w: ZeichenWerkzeug, e: StiftEinstellung) => {
    setEinst((s) => ({ ...s, [w]: e }));
    speichern(`ueben:${w}`, e);
  };
  const [fingerZeichnen, setFingerZeichnen] = useState(false);
  const [leiste, setLeiste] = useState(true);
  // Ansicht-Menü (Blättern bzw. Rand/Zoom) als Popover unter der Leiste.
  const [ansichtOffen, setAnsichtOffen] = useState(false);

  // Vollbild als bewusster Knopf (der automatische Versuch beim Öffnen
  // entfiel mit dem Portal). iPad-Safari kann kein Seiten-Vollbild — dann
  // erscheint der Knopf gar nicht. (Rendert nur im Browser, ssr: false.)
  const [kannVollbild] = useState(() => typeof document !== 'undefined' && !!document.fullscreenEnabled);
  const [vollbild, setVollbild] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const auf = () => setVollbild(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', auf);
    return () => document.removeEventListener('fullscreenchange', auf);
  }, []);
  const vollbildWechseln = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  const [anm, setAnm] = useState<Record<number, Anmerkung[]>>({});
  useEffect(() => {
    let weg = false;
    anmerkungenVon(noten.id).then((l) => { if (!weg) setAnm(Object.fromEntries(l.map((x) => [x.seite, x.objekte]))); }).catch(ladeFehler);
    return () => { weg = true; };
  }, [noten.id]);

  const sichtbareSeite = stelle ? stelle.seite : hauptseite(ansicht);
  // Zeichnen geht nur auf einer ganz sichtbaren Seite.
  const zeichenSeite = stelle ? stelle.seite : ansicht.art === 'ganz' ? ansicht.seite : null;

  // ── Größe: Seite so groß wie möglich in den freien Platz ──
  const flaeche = useRef<HTMLDivElement>(null);
  const [platz, setPlatz] = useState({ b: 0, h: 0 });
  const [format, setFormat] = useState(1.414);
  useEffect(() => { void pdf.getPage(1).then((p) => { const v = p.getViewport({ scale: 1 }); setFormat(v.height / v.width); }); }, [pdf]);
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPlatz({ b: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rahmen = useMemo(() => {
    if (!platz.b || !platz.h) return null;
    const b = Math.min(platz.b - 8, (platz.h - 8) / format);
    return { b: Math.floor(b), h: Math.floor(b * format) };
  }, [platz, format]);

  // ── Seiten einmal rendern, dann aus dem Zwischenspeicher zusammensetzen ──
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2.5);
  const zoomFaktor = useMemo(() => {
    if (!stelle || !zoom || !rahmen) return 1;
    const r = rand ? mitRand(stelle, RAND) : stelle;
    return Math.max(1, Math.min(3, Math.min(1 / r.b, 1 / r.h) * 0.95));
  }, [stelle, zoom, rand, rahmen]);
  const px = rahmen ? Math.min(MAX_PX, Math.round(rahmen.b * dpr * Math.min(zoomFaktor, 2))) : 0;
  // Je Seite die nackte Seite und, stecken Markierungen im PDF, deren Ebene
  // (seiteMitEbene). Welche Seiten eine Ebene haben, merkt sich mitEbene —
  // nur dort hinterlässt der Radierer eine Radier-Spur.
  const cache = useRef(new Map<string, Promise<SeitenBild>>());
  const mitEbene = useRef(new Set<number>());
  const seiteBild = useCallback((s: number) => {
    const key = `${s}@${px}`;
    let p = cache.current.get(key);
    if (!p) {
      p = seiteMitEbene(pdf, s, px).then((b) => { if (b.ebene) mitEbene.current.add(s); return b; });
      cache.current.set(key, p);
      // Gescheitert (Speicherdruck, Stück schon verlassen): nicht als kaputt
      // merken — der nächste Blick auf die Seite versucht es neu.
      p.catch(() => { if (cache.current.get(key) === p) cache.current.delete(key); });
      if (cache.current.size > 14) cache.current.delete(cache.current.keys().next().value!);
    }
    return p;
  }, [pdf, px]);
  // Stück verlassen: Seitenbilder sofort freigeben (Safari gibt Leinwand-
  // Speicher sonst erst spät zurück, und er ist auf iPhone/iPad knapp).
  useEffect(() => {
    const bilder = cache.current;
    return () => {
      const frei = (c: HTMLCanvasElement | null) => { if (c) { c.width = 0; c.height = 0; } };
      for (const p of bilder.values()) p.then((b) => { frei(b.seite); frei(b.ebene); }, () => { /* nie fertig */ });
      bilder.clear();
    };
  }, []);

  const leinwand = useRef<HTMLCanvasElement>(null);
  // Hilfsleinwand zum Ausstanzen der Radier-Spuren (ebeneZeichnen), einmal je Betrachter.
  const hilfe = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = leinwand.current;
    if (!c || !rahmen || !px) return;
    let weg = false;
    const W = px, H = Math.round(px * format);
    const zeichnen = async () => {
      const teile: { seite: number; y0: number; y1: number }[] = stelle
        ? [{ seite: stelle.seite, y0: 0, y1: 1 }]
        : ansicht.art === 'ganz' ? [{ seite: ansicht.seite, y0: 0, y1: 1 }]
          : [{ seite: ansicht.oben, y0: 0, y1: ansicht.schnitt }, { seite: ansicht.unten, y0: ansicht.schnitt, y1: 1 }];
      const bilder = await Promise.all(teile.map((t) => seiteBild(t.seite)));
      if (weg) return;
      c.width = W; c.height = H;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      teile.forEach((t, i) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, t.y0 * H, W, (t.y1 - t.y0) * H); ctx.clip();
        ctx.drawImage(bilder[i].seite, 0, 0, W, H);
        const ebene = bilder[i].ebene;
        if (ebene) ebeneZeichnen(ctx, ebene, anm[t.seite] ?? [], 0, 0, W, H, hilfe.current ??= document.createElement('canvas'));
        anmerkungenZeichnen(ctx, anm[t.seite] ?? [], 0, 0, W, H);
        if (!stelle) for (const st of stellen.filter((x) => x.seite === t.seite)) {
          ctx.strokeStyle = 'rgba(168, 120, 31, 0.55)'; ctx.lineWidth = Math.max(1, W / 600);
          ctx.setLineDash([W / 120, W / 160]); ctx.strokeRect(st.x * W, st.y * H, st.b * W, st.h * H); ctx.setLineDash([]);
        }
        ctx.restore();
      });
      if (ansicht.art === 'halb' && !stelle) {
        // Übergangskante: hier endet die neue Seite, darunter steht noch die alte.
        const y = ansicht.schnitt * H;
        ctx.fillStyle = 'rgba(168, 120, 31, 0.9)';
        ctx.fillRect(0, y - Math.max(1.5, H / 500), W, Math.max(3, H / 250));
      }
      if (stelle) {
        const r = rand ? mitRand(stelle, RAND) : stelle;
        ctx.fillStyle = 'rgba(20, 20, 20, 0.5)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(r.x * W, r.y * H, r.b * W, r.h * H);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#a8781f'; ctx.lineWidth = Math.max(2, W / 350);
        ctx.strokeRect(r.x * W, r.y * H, r.b * W, r.h * H);
      }
    };
    zeichnen().catch((e) => { if (!weg) console.error('Seite ließ sich nicht zeichnen', e); });
    return () => { weg = true; };
  }, [ansicht, stelle, rand, anm, stellen, rahmen, px, format, seiteBild]);

  // Nachbarseiten vorab rendern: Blättern ohne Wartezeit.
  useEffect(() => {
    if (!px) return;
    const s = sichtbareSeite;
    for (const n of [s + 1, s + 2, s - 1]) if (n >= 1 && n <= seiten) void seiteBild(n);
  }, [sichtbareSeite, seiten, px, seiteBild]);

  // ── Navigation ──
  const weiter = useCallback(() => {
    if (modus === 'stellen') setStelleNr((n) => Math.min(stellen.length - 1, n + 1));
    else setIndex((i) => Math.min(liste.length - 1, i + 1));
  }, [modus, stellen.length, liste.length]);
  const zurueck = useCallback(() => {
    if (modus === 'stellen') setStelleNr((n) => Math.max(0, n - 1));
    else setIndex((i) => Math.max(0, i - 1));
  }, [modus]);

  useEffect(() => {
    if (!tastenAktiv) return;
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      // Leertaste auf einem Bedienelement aktiviert es, statt zu blättern.
      if (e.key === ' ' && (e.target as HTMLElement).closest('button, a, select, summary, [role="dialog"]')) return;
      // Bluetooth-Blätterpedale senden meist Pfeil- oder Bild-Tasten.
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); weiter(); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); zurueck(); }
      if (e.key === 'Escape' && werkzeug) setWerkzeug(null);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [weiter, zurueck, werkzeug, tastenAktiv]);

  // ── Zeiger: zeichnen oder blättern ──
  const blatt = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const zug = useRef<{ art: 'zeichnen' | 'tippen'; punkte: number[]; x: number; y: number; t: number; id: number } | null>(null);
  const [rechteckEntwurf, setRechteckEntwurf] = useState<Rechteck | null>(null);
  const neueStelleMerken = useRef<{ seite: number; x: number; y: number } | null>(null);
  // Nach dem Neuladen die gerade angelegte Stelle wählen (Liste ist nach Seite sortiert).
  useEffect(() => {
    const m = neueStelleMerken.current;
    if (!m) return;
    const i = stellen.findIndex((x) => x.seite === m.seite && Math.abs(x.y - m.y) < 1e-6 && Math.abs(x.x - m.x) < 1e-6);
    if (i >= 0) { neueStelleMerken.current = null; if (modus === 'stellen') setStelleNr(i); }
  }, [stellen, modus]);
  const [gespeichert, setGespeichert] = useState<string | null>(null);
  const zuletztGespeichert = useRef<{ id: string; tempo: number; t: number } | null>(null);
  async function geschafft(id: string) {
    const jetzt = performance.now(), z = zuletztGespeichert.current;
    if (!(z && z.id === id && z.tempo === bpm && jetzt - z.t < 10000)) {
      try {
        await tempoGeschafft(id, bpm);
      } catch (x) {
        speicherFehler(x);
        return;
      }
      zuletztGespeichert.current = { id, tempo: bpm, t: jetzt };
      geaendert();
    }
    setGespeichert(`Gespeichert: ${bpm} geschafft`);
    window.setTimeout(() => setGespeichert(null), 1600);
  }
  const [neueStelle, setNeueStelle] = useState<Rechteck | null>(null);
  const [stelleTitel, setStelleTitel] = useState('');
  const [textEingabe, setTextEingabe] = useState<{ x: number; y: number; text: string; seit: number } | null>(null);
  const [linieZiehen, setLinieZiehen] = useState(false);
  const [linieEinstellen, setLinieEinstellen] = useState(false);

  // Sprung aus der Stellen-Übersicht (Stück-Blatt): Zustand noch im Rendern
  // anpassen (React-Muster), kein Effekt nötig.
  const [letzterSprung, setLetzterSprung] = useState<typeof sprung>(null);
  if (sprung !== letzterSprung) {
    setLetzterSprung(sprung);
    const i = sprung ? stellen.findIndex((s) => s.id === sprung.stelle) : -1;
    if (i >= 0) { setStelleNr(i); setModus('stellen'); setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); }
  }

  const relativ = (e: { clientX: number; clientY: number }) => {
    const r = blatt.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const darfZeichnen = (e: React.PointerEvent) =>
    werkzeug !== null && zeichenSeite !== null && (e.pointerType !== 'touch' || fingerZeichnen || werkzeug === 'stelle' || werkzeug === 'text');

  // Rückgängig/Wiederholen je Aktion (auch Radier-Wische), nicht je Strich.
  const verlaufAnm = useRef<{ seite: number; vorher: Anmerkung[] }[]>([]);
  const wiederholenAnm = useRef<{ seite: number; vorher: Anmerkung[] }[]>([]);
  // Für die Knopf-Zustände: Stack-Längen als State (Refs sind im Rendern tabu).
  const [staende, setStaende] = useState({ rueck: 0, wieder: 0 });
  const staendeAktualisieren = () => setStaende({ rueck: verlaufAnm.current.length, wieder: wiederholenAnm.current.length });
  function anmerkungenSetzen(seite: number, neu: Anmerkung[], merken = true) {
    if (merken) { verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher: anm[seite] ?? [] }]; wiederholenAnm.current = []; }
    setAnm((a) => ({ ...a, [seite]: neu }));
    anmerkungenSpeichern(noten.id, seite, neu).catch(speicherFehler);
    staendeAktualisieren();
  }

  function liveZeichnen() {
    const c = live.current, z = zug.current;
    if (!c || !z || !blatt.current) return;
    // offsetWidth ignoriert den Zoom (transform) — die Leinwand skaliert mit dem Blatt.
    c.width = Math.round(blatt.current.offsetWidth * dpr); c.height = Math.round(blatt.current.offsetHeight * dpr);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (werkzeug === 'stift') strichZeichnen(ctx, z.punkte, einst.stift.farbe, einst.stift.breite * c.width, 0, 0, c.width, c.height);
    if (werkzeug === 'marker') strichZeichnen(ctx, z.punkte, einst.marker.farbe, einst.marker.breite * c.width, 0, 0, c.width, c.height, true);
  }

  function runter(e: React.PointerEvent) {
    if (textEingabe) { textSpeichern(); return; } // Tippen daneben übernimmt den Text
    if (neueStelle) return;
    const p = relativ(e);
    radierWisch.current = false;
    radierSpur.current = null;
    if (darfZeichnen(e)) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      zug.current = { art: 'zeichnen', punkte: [p.x, p.y], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      if (werkzeug === 'radierer') radieren(p.x, p.y);
    } else {
      zug.current = { art: 'tippen', punkte: [], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    }
  }
  function bewegen(e: React.PointerEvent) {
    const z = zug.current;
    if (!z || z.art !== 'zeichnen' || e.pointerId !== z.id) return;
    const ereignisse = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of ereignisse) {
      const p = relativ(ev);
      if (werkzeug === 'radierer') radieren(p.x, p.y);
      else if (werkzeug === 'stelle') setRechteckEntwurf(rechteckAus(z.punkte[0], z.punkte[1], p.x, p.y));
      else z.punkte.push(p.x, p.y);
    }
    if (werkzeug === 'stift' || werkzeug === 'marker') liveZeichnen();
  }
  function hoch(e: React.PointerEvent) {
    const z = zug.current;
    zug.current = null;
    if (!z) return;
    if (z.art === 'tippen') {
      const dx = e.clientX - z.x, dy = e.clientY - z.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) weiter(); else zurueck(); return; }
      if (Math.hypot(dx, dy) > 12 || e.timeStamp - z.t > 600) return;
      const b = window.innerWidth, x = e.clientX;
      if (x < b * 0.3) zurueck(); else if (x > b * 0.7) weiter(); else setLeiste((l) => !l);
      return;
    }
    const seite = zeichenSeite!;
    // Radier-Wisch zu Ende: einmal speichern — im Updater, der nach allen
    // Updatern des Wischs läuft — und den Verlaufszähler nachziehen (der
    // Verlauf wird in den Updatern geschrieben, die bis hierhin gelaufen sind).
    if (werkzeug === 'radierer') {
      setAnm((a) => {
        if (radierWisch.current) anmerkungenSpeichern(noten.id, seite, a[seite] ?? []).catch(speicherFehler);
        return a;
      });
      staendeAktualisieren();
    }
    if (werkzeug === 'stift' || werkzeug === 'marker') {
      const neu: Anmerkung = werkzeug === 'stift'
        ? { id: crypto.randomUUID(), art: 'stift', farbe: einst.stift.farbe, breite: einst.stift.breite, punkte: z.punkte }
        : { id: crypto.randomUUID(), art: 'marker', farbe: einst.marker.farbe, breite: einst.marker.breite, punkte: z.punkte };
      anmerkungenSetzen(seite, [...(anm[seite] ?? []), neu]);
      const c = live.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    }
    if (werkzeug === 'text') {
      setTextEingabe({ x: z.punkte[0], y: z.punkte[1], text: '', seit: e.timeStamp });
    }
    if (werkzeug === 'stelle') {
      const p = relativ(e);
      const r = rechteckAus(z.punkte[0], z.punkte[1], p.x, p.y);
      setRechteckEntwurf(null);
      if (r.b > 0.02 && r.h > 0.01) { setNeueStelle(r); setStelleTitel(''); }
    }
  }
  // Ein Radier-Wisch nimmt getroffene eigene Striche weg und — auf Seiten mit
  // Markierungen aus dem PDF — radiert diese Ebene entlang einer Radier-Spur.
  // Gespeichert wird einmal am Ende des Wischs (hoch).
  const radierSpur = useRef<string | null>(null);
  function radieren(x: number, y: number) {
    const seite = zeichenSeite!;
    const ebene = mitEbene.current.has(seite);
    setAnm((alleAnm) => {
      const alt = alleAnm[seite] ?? [];
      const r = radierZug(alt, x, y, 0.012, format, radierSpur.current, ebene, () => crypto.randomUUID());
      radierSpur.current = r.spur;
      if (!r.geaendert) return alleAnm;
      if (!radierWisch.current) { verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher: alt }]; wiederholenAnm.current = []; radierWisch.current = true; }
      return { ...alleAnm, [seite]: r.objekte };
    });
  }
  function rueckgaengig() {
    const letzter = verlaufAnm.current.pop();
    if (!letzter) return;
    wiederholenAnm.current = [...wiederholenAnm.current.slice(-49), { seite: letzter.seite, vorher: anm[letzter.seite] ?? [] }];
    anmerkungenSetzen(letzter.seite, letzter.vorher, false);
  }
  function wiederholen() {
    const naechster = wiederholenAnm.current.pop();
    if (!naechster) return;
    verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite: naechster.seite, vorher: anm[naechster.seite] ?? [] }];
    anmerkungenSetzen(naechster.seite, naechster.vorher, false);
  }
  // Ein Radierer-Wisch ist eine Aktion: nur der Stand vor dem ersten Treffer wird gemerkt.
  const radierWisch = useRef(false);
  async function stelleSpeichern() {
    if (!neueStelle || zeichenSeite === null) return;
    const r = neueStelle;
    try {
      await stelleAnlegen({ stueckId: noten.id, seite: zeichenSeite, ...r, titel: stelleTitel.trim() });
    } catch (x) {
      // Rahmen bleibt stehen: nach dem Neuladen ist er weg, aber bis dahin sichtbar.
      speicherFehler(x);
      return;
    }
    setNeueStelle(null);
    neueStelleMerken.current = { seite: zeichenSeite, y: r.y, x: r.x };
    geaendert();
  }
  function textSpeichern(e?: React.FocusEvent) {
    if (!textEingabe || zeichenSeite === null) return;
    // Direkt nach dem Antippen feuern Browser noch Maus-Ereignisse nach — die
    // dürfen das frische Feld nicht schließen.
    if (e && e.timeStamp - textEingabe.seit < 400) { (e.target as HTMLInputElement).focus(); return; }
    if (textEingabe.text.trim()) {
      anmerkungenSetzen(zeichenSeite, [...(anm[zeichenSeite] ?? []),
        { id: crypto.randomUUID(), art: 'text', farbe: einst.text.farbe, groesse: TEXT_GROESSE, x: textEingabe.x, y: textEingabe.y, text: textEingabe.text.trim() }]);
    }
    setTextEingabe(null);
  }

  // Blätterlinie ziehen (nur in ganzer Ansicht, nicht auf der letzten Seite)
  const linienSeite = ansicht.art === 'ganz' && ansicht.seite < seiten ? ansicht.seite : null;
  const linieWert = linienSeite ? (blaettern.linien[linienSeite] ?? 0.5) : 0.5;
  function linieBewegen(e: React.PointerEvent) {
    if (!linieZiehen || !linienSeite) return;
    const y = Math.max(0.02, Math.min(0.98, relativ(e).y));
    setBlaettern((b) => ({ ...b, linien: { ...b.linien, [linienSeite]: Math.round(y * 1000) / 1000 } }));
  }
  function linieLoslassen() {
    if (!linieZiehen) return;
    setLinieZiehen(false);
    blaetternSpeichern({ modus: 'linie', linien: blaettern.linien });
  }

  // Zoom auf die Stelle: Blatt so verschieben und vergrößern, dass sie mittig steht.
  const transform = useMemo(() => {
    if (!stelle || !rahmen || zoomFaktor === 1) return undefined;
    const r = rand ? mitRand(stelle, RAND) : stelle;
    const cx = (r.x + r.b / 2) * rahmen.b, cy = (r.y + r.h / 2) * rahmen.h;
    // Mittig auf die Stelle, aber nie über den Blattrand hinaus (kein leerer Streifen).
    const klemmen = (v: number, min: number) => Math.min(0, Math.max(min, v));
    const tx = klemmen(rahmen.b / 2 - cx * zoomFaktor, rahmen.b * (1 - zoomFaktor));
    const ty = klemmen(rahmen.h / 2 - cy * zoomFaktor, rahmen.h * (1 - zoomFaktor));
    return `translate(${tx}px, ${ty}px) scale(${zoomFaktor})`;
  }, [stelle, rahmen, zoomFaktor, rand]);

  const verlauf = stelle ? [...stelle.tempi].sort((a, b) => a.am - b.am) : [];
  const zuletzt = verlauf.at(-1)?.tempo ?? null;
  const bestes = verlauf.reduce((m, t) => Math.max(m, t.tempo), 0) || null;
  const anzeige = modus === 'stellen'
    ? `Stelle ${stelleNr + 1} von ${stellen.length}`
    : ansicht.art === 'ganz' ? `Seite ${ansicht.seite} von ${seiten}` : `Seite ${ansicht.unten} → ${ansicht.oben} von ${seiten}`;
  const ladeTempo = stelle ? (zuletzt ?? stelle.zielTempo) : null;
  // Linien-Hinweis schwebt über dem Blatt; Werkzeug-Hinweise stehen in der Palette.
  const linieHinweis = linieEinstellen && modus === 'lesen'
    ? (linienSeite ? `Goldene Linie auf Seite ${linienSeite} ziehen: bis hierhin lesen, dann zeigt Weiterblättern oben schon die nächste Seite.` : 'Auf der letzten Seite gibt es keine Blätterlinie — eine Seite zurückblättern.')
    : null;
  const werkzeugHinweis = !werkzeug || zeichenSeite === null ? null
    : werkzeug === 'stelle' ? 'Rahmen um die Takte ziehen.'
    : werkzeug === 'text' ? 'Auf die Stelle tippen, an der der Text stehen soll.'
    : null;
  const paletteWechsel = (offen: boolean) => {
    setPaletteOffen(offen);
    setWerkzeug(offen ? 'stift' : null);
    if (offen) setLinieEinstellen(false);
  };

  return (
    <div className="betrachter" role="region" aria-label={`Noten: ${noten.titel}`}>
      {leiste && (
        <div className="betrachter-leiste">
          <div className="nav-zeile">
            <button type="button" className="nav-titel" onClick={titelTipp} title="Stück-Details und Stellen-Übersicht">
              <span className="nav-titel-text">
                <span className="nav-titel-schnitt">{noten.titel}{noten.stimme && <span className="b-leise"> · {noten.stimme}</span>}</span>
                <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="nav-untertitel tabular-nums">{anzeige}</span>
            </button>
            <span className="flex-1" />
            {stellen.length > 0 && (
              <label className="nav-schalter" title="Stelle für Stelle üben">
                <span className="nav-schalter-label">Stellen</span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={modus === 'stellen'}
                  onChange={(e) => {
                    if (e.target.checked) { setModus('stellen'); setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); setAnsichtOffen(false); }
                    else { zumLesen(); setAnsichtOffen(false); }
                  }} />
              </label>
            )}
            <button type="button" className="nav-rund" aria-pressed={ansichtOffen} onClick={() => setAnsichtOffen(!ansichtOffen)}
              aria-label="Ansicht" title="Ansicht">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M9.5 9L12 6.5 14.5 9M14.5 15L12 17.5 9.5 15" /></svg>
            </button>
            {kannVollbild && (
              <button type="button" className="nav-rund" aria-pressed={vollbild} onClick={vollbildWechseln}
                aria-label={vollbild ? 'Vollbild verlassen' : 'Vollbild'} title={vollbild ? 'Vollbild verlassen' : 'Vollbild'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5H6A1.5 1.5 0 0 0 4.5 6v3M15 4.5h3A1.5 1.5 0 0 1 19.5 6v3M9 19.5H6A1.5 1.5 0 0 1 4.5 18v-3M15 19.5h3a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>
              </button>
            )}
            <button type="button" className="nav-rund" aria-pressed={paletteOffen} onClick={() => paletteWechsel(!paletteOffen)}
              aria-label="Zeichenwerkzeuge" title="Zeichenwerkzeuge">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.2L16.6 4.4a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.2 18.8 4 20z" /></svg>
            </button>
          </div>
          {ansichtOffen && (
            <>
              <button type="button" className="nav-fang" aria-label="Menü schließen" onClick={() => setAnsichtOffen(false)} />
              <div className="nav-blase" role="group" aria-label="Ansicht">
                {modus === 'lesen' ? (
                  <>
                    <p className="nav-blase-titel">Blättern</p>
                    <div className="segment nav-segment" role="group" aria-label="Blättern">
                      {([['ganz', 'Ganz'], ['halb', 'Halb'], ['linie', 'Linie']] as const).map(([m, name]) => (
                        <button key={m} type="button" aria-pressed={blaettern.modus === m}
                          onClick={() => { blaetternSpeichern({ ...blaettern, modus: m }); setLinieEinstellen(m === 'linie'); if (m === 'linie') { setWerkzeug(null); setAnsichtOffen(false); } }}>
                          {name}
                        </button>
                      ))}
                    </div>
                    {blaettern.modus === 'linie' && (
                      <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => { setLinieEinstellen(true); setWerkzeug(null); setAnsichtOffen(false); }}>
                        Blätterlinie einstellen
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="nav-blase-titel">Ansicht der Stelle</p>
                    <label className="nav-blase-reihe">Etwas Rand zeigen
                      <input type="checkbox" role="switch" className="ios-schalter" checked={rand} onChange={(e) => setRand(e.target.checked)} />
                    </label>
                    <label className="nav-blase-reihe">Heranzoomen
                      <input type="checkbox" role="switch" className="ios-schalter" checked={zoom} onChange={(e) => setZoom(e.target.checked)} />
                    </label>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Zeiger auf der ganzen Fläche: auch Tippen neben das Blatt blättert. */}
      <div ref={flaeche} className="betrachter-flaeche"
        onPointerDown={runter} onPointerMove={(e) => { bewegen(e); linieBewegen(e); }} onPointerUp={(e) => { hoch(e); linieLoslassen(); }}
        onPointerCancel={() => { zug.current = null; setRechteckEntwurf(null); }}
        onMouseDown={(e) => { if (werkzeug) e.preventDefault(); }}>
        {rahmen && (
          <div className="betrachter-rahmen" style={{ width: rahmen.b, height: rahmen.h }}>
            <div ref={blatt} className="betrachter-blatt" style={{ transform }}>
              <canvas ref={leinwand} className="betrachter-leinwand" />
              <canvas ref={live} className="betrachter-leinwand betrachter-live" />
              {rechteckEntwurf && <span className="b-rechteck" style={prozent(rechteckEntwurf)} />}
              {neueStelle && <span className="b-rechteck fest" style={prozent(neueStelle)} />}
              {linieEinstellen && modus === 'lesen' && linienSeite && (
                <div className="b-linie" style={{ top: `${linieWert * 100}%` }}
                  onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setLinieZiehen(true); }}>
                  <span>Blättern ab hier · {Math.round(linieWert * 100)} %</span>
                </div>
              )}
              {textEingabe && (
                <input className="b-texteingabe" autoFocus value={textEingabe.text} placeholder="Text …"
                  style={{ left: `${textEingabe.x * 100}%`, top: `${textEingabe.y * 100}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setTextEingabe({ ...textEingabe, text: e.target.value })}
                  onBlur={(e) => textSpeichern(e)} onKeyDown={(e) => { if (e.key === 'Enter') textSpeichern(); if (e.key === 'Escape') setTextEingabe(null); }} />
              )}
            </div>
          </div>
        )}
        {!werkzeug && !linieEinstellen && (
          <>
            <span className="b-tippzone links" aria-hidden="true">‹</span>
            <span className="b-tippzone rechts" aria-hidden="true">›</span>
          </>
        )}
        {/* Schwebende Hinweise: verkleinern das Blatt nicht. */}
        {(linieHinweis || werkzeugHinweis || (werkzeug && zeichenSeite === null)) && (
          <div className="b-schwebend">
            {werkzeug && zeichenSeite === null ? (
              <>
                <span>Anmerken geht auf einer ganzen Seite.</span>
                <button type="button" className="b-knopf b-greifbar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
                  onClick={() => setIndex(ansichtVonSeite(liste, hauptseite(ansicht)))}>Ganze Seite zeigen</button>
              </>
            ) : (
              <>
                {(linieHinweis || werkzeugHinweis) && (
                  <span key={linieHinweis ?? werkzeugHinweis} className="b-hinweis b-verblassen">{linieHinweis ?? werkzeugHinweis}</span>
                )}
                {linieEinstellen && (
                  <button type="button" className="b-knopf b-greifbar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
                    onClick={() => setLinieEinstellen(false)}>Fertig</button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {neueStelle && (
        <div className="b-unten b-umbruch">
          <input className="feld b-feld" autoFocus value={stelleTitel} onChange={(e) => setStelleTitel(e.target.value)} placeholder="Takte, z. B. T. 32–48" aria-label="Bezeichnung der Stelle"
            onKeyDown={(e) => { if (e.key === 'Enter') void stelleSpeichern(); }} />
          <button className="knopf knopf-klein" type="button" onClick={() => void stelleSpeichern()}>Stelle speichern</button>
          <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setNeueStelle(null)}>Verwerfen</button>
        </div>
      )}

      {stelle && !neueStelle && (
        <div className="b-unten b-stellenleiste">
          <button type="button" className="b-knopf gross" onClick={zurueck} disabled={stelleNr === 0} aria-label="Vorige Stelle">‹</button>
          <div className="b-stelleninfo min-w-0 flex-1">
            <p className="truncate font-bold">{stelle.titel || `Stelle auf Seite ${stelle.seite}`}</p>
            <p className="b-leise truncate text-xs tabular-nums">
              {gespeichert ?? <>
                {zuletzt ? `zuletzt geschafft ${zuletzt}` : 'noch kein Tempo geschafft'}{bestes && bestes !== zuletzt ? ` · bestes ${bestes}` : ''}{stelle.zielTempo ? ` · Ziel ${stelle.zielTempo}` : ''}
                {stelle.notiz ? ` · ${stelle.notiz}` : ''}
              </>}
            </p>
          </div>
          {ladeTempo && ladeTempo !== bpm && (
            <button type="button" className="mini-knopf" onClick={() => setBpm(ladeTempo)} title="Metronom auf das zuletzt geschaffte Tempo stellen">♩ {ladeTempo}<span className="b-lang"> laden</span></button>
          )}
          <div className="gruppe b-schritte" role="group" aria-label="Tempo">
            <button type="button" onClick={() => setBpm(bpm - 1)} aria-label="Ein Schlag langsamer">−1</button>
            <button type="button" onClick={() => setBpm(bpm + 1)} aria-label="Ein Schlag schneller">+1</button>
          </div>
          <button type="button" className="knopf b-geschafft" onClick={() => void geschafft(stelle.id)} title="Dieses Tempo als geschafft speichern">✓ {bpm} geschafft</button>
          <button type="button" className="b-knopf gross" onClick={weiter} disabled={stelleNr >= stellen.length - 1} aria-label="Nächste Stelle">›</button>
        </div>
      )}

      {/* Beim Benennen einer neuen Stelle weicht die Palette der Eingabezeile. */}
      {paletteOffen && !neueStelle && (
        <StiftPalette werkzeug={werkzeug}
          wechseln={(w) => { setWerkzeug(w); setLinieEinstellen(false); }}
          einst={einst} einstellen={einstellen}
          fingerZeichnen={fingerZeichnen} setFingerZeichnen={setFingerZeichnen}
          rueckgaengig={rueckgaengig} wiederholen={wiederholen}
          kannRueck={staende.rueck > 0} kannWieder={staende.wieder > 0} />
      )}
    </div>
  );
}

const prozent = (r: Rechteck) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` });
