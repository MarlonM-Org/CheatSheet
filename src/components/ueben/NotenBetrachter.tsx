'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ansichten, ansichtVonSeite, getroffen, hauptseite, type Anmerkung, type Ansicht, type Blaettermodus } from '@/domain/notenpult';
import { mitRand, rechteckAus, type Rechteck } from '@/domain/ueben';
import {
  anmerkungenSpeichern, anmerkungenVon, notenAendern, stelleAnlegen, tempoGeschafft,
  type LokaleNoten, type LokaleStelle,
} from './lokal';
import { useMetronom } from './MetronomKontext';
import { MiniMetronom } from './MiniMetronom';
import { ladeFehler, speicherFehler } from './speicherfehler';
import { anmerkungenZeichnen, strichZeichnen } from './zeichnen';

type Werkzeug = 'stift' | 'marker' | 'text' | 'radierer' | 'stelle';
const STIFTFARBEN = ['#1b1b1b', '#d12d2d', '#1f5fd1'];
const MARKERFARBEN = ['rgba(255, 214, 0, 0.45)', 'rgba(80, 220, 120, 0.4)', 'rgba(255, 120, 200, 0.35)'];
const RAND = 0.06;
const MAX_PX = 2800;

interface Props {
  noten: LokaleNoten; pdf: PDFDocumentProxy; stellen: LokaleStelle[];
  start: { modus: 'lesen' | 'stellen'; stelle?: string };
  schliessen: () => void; geaendert: () => void;
}

export function NotenBetrachter({ noten, pdf, stellen, start, schliessen, geaendert }: Props) {
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
    notenAendern(noten.id, { blaettern: b }).catch(speicherFehler);
  };

  // ── Modus: lesen oder Stelle für Stelle ──
  const [modus, setModus] = useState<'lesen' | 'stellen'>(start.modus === 'stellen' && stellen.length ? 'stellen' : 'lesen');
  const [stelleNr, setStelleNr] = useState(() => Math.max(0, stellen.findIndex((s) => s.id === start.stelle)));
  const stelle = modus === 'stellen' ? stellen[Math.min(stelleNr, stellen.length - 1)] : undefined;
  const [rand, setRand] = useState(true);
  const zumLesen = () => {
    if (stelle) setIndex(ansichtVonSeite(liste, stelle.seite));
    setModus('lesen');
  };
  const [zoom, setZoom] = useState(false);

  // ── Werkzeuge ──
  const [werkzeug, setWerkzeug] = useState<Werkzeug | null>(null);
  const [stiftfarbe, setStiftfarbe] = useState(STIFTFARBEN[0]);
  const [markerfarbe, setMarkerfarbe] = useState(MARKERFARBEN[0]);
  const [fingerZeichnen, setFingerZeichnen] = useState(false);
  const [leiste, setLeiste] = useState(true);
  const [metronomLeiste, setMetronomLeiste] = useState(true);
  const [anm, setAnm] = useState<Record<number, Anmerkung[]>>({});
  useEffect(() => {
    anmerkungenVon(noten.id).then((l) => setAnm(Object.fromEntries(l.map((x) => [x.seite, x.objekte])))).catch(ladeFehler);
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
  const cache = useRef(new Map<string, Promise<HTMLCanvasElement>>());
  const seiteBild = useCallback((s: number) => {
    const key = `${s}@${px}`;
    let p = cache.current.get(key);
    if (!p) {
      p = (async () => {
        const page = await pdf.getPage(s);
        const v1 = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: px / v1.width });
        const c = document.createElement('canvas');
        c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
        await page.render({ canvas: c, viewport }).promise;
        return c;
      })();
      cache.current.set(key, p);
      if (cache.current.size > 14) cache.current.delete(cache.current.keys().next().value!);
    }
    return p;
  }, [pdf, px]);

  const leinwand = useRef<HTMLCanvasElement>(null);
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
        ctx.drawImage(bilder[i], 0, 0, W, H);
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
    void zeichnen();
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
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      // Bluetooth-Blätterpedale senden meist Pfeil- oder Bild-Tasten.
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); weiter(); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); zurueck(); }
      if (e.key === 'Escape') { if (werkzeug) setWerkzeug(null); else schliessen(); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [weiter, zurueck, werkzeug, schliessen]);

  // Vollbild versuchen (iPad: Safari kann es nicht für Seiten, dann bleibt die Überlagerung).
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = vorher;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

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

  const relativ = (e: { clientX: number; clientY: number }) => {
    const r = blatt.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const darfZeichnen = (e: React.PointerEvent) =>
    werkzeug !== null && zeichenSeite !== null && (e.pointerType !== 'touch' || fingerZeichnen || werkzeug === 'stelle' || werkzeug === 'text');

  // Rückgängig nimmt die letzte Aktion zurück (auch Radieren), nicht nur die letzte Anmerkung.
  const verlaufAnm = useRef<{ seite: number; vorher: Anmerkung[] }[]>([]);
  function anmerkungenSetzen(seite: number, neu: Anmerkung[], merken = true) {
    if (merken) verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher: anm[seite] ?? [] }];
    setAnm((a) => ({ ...a, [seite]: neu }));
    anmerkungenSpeichern(noten.id, seite, neu).catch(speicherFehler);
  }

  function liveZeichnen() {
    const c = live.current, z = zug.current;
    if (!c || !z || !blatt.current) return;
    // offsetWidth ignoriert den Zoom (transform) — die Leinwand skaliert mit dem Blatt.
    c.width = Math.round(blatt.current.offsetWidth * dpr); c.height = Math.round(blatt.current.offsetHeight * dpr);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (werkzeug === 'stift') strichZeichnen(ctx, z.punkte, stiftfarbe, 0.0025 * c.width, 0, 0, c.width, c.height);
    if (werkzeug === 'marker') strichZeichnen(ctx, z.punkte, markerfarbe, 0.014 * c.width, 0, 0, c.width, c.height, true);
  }

  function runter(e: React.PointerEvent) {
    if (textEingabe) { textSpeichern(); return; } // Tippen daneben übernimmt den Text
    if (neueStelle) return;
    const p = relativ(e);
    radierZug.current = false;
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
    if (werkzeug === 'stift' || werkzeug === 'marker') {
      const neu: Anmerkung = werkzeug === 'stift'
        ? { id: crypto.randomUUID(), art: 'stift', farbe: stiftfarbe, breite: 0.0025, punkte: z.punkte }
        : { id: crypto.randomUUID(), art: 'marker', farbe: markerfarbe, breite: 0.014, punkte: z.punkte };
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
  function radieren(x: number, y: number) {
    const seite = zeichenSeite!;
    setAnm((alleAnm) => {
      const alt = alleAnm[seite] ?? [];
      const neu = alt.filter((a) => !getroffen(a, x, y, 0.012, format));
      if (neu.length === alt.length) return alleAnm;
      if (!radierZug.current) { verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher: alt }]; radierZug.current = true; }
      anmerkungenSpeichern(noten.id, seite, neu).catch(speicherFehler);
      return { ...alleAnm, [seite]: neu };
    });
  }
  function rueckgaengig() {
    const letzter = verlaufAnm.current.pop();
    if (letzter) anmerkungenSetzen(letzter.seite, letzter.vorher, false);
  }
  // Ein Radierer-Wisch ist eine Aktion: nur der Stand vor dem ersten Treffer wird gemerkt.
  const radierZug = useRef(false);
  async function stelleSpeichern() {
    if (!neueStelle || zeichenSeite === null) return;
    const r = neueStelle;
    try {
      await stelleAnlegen({ notenId: noten.id, seite: zeichenSeite, ...r, titel: stelleTitel.trim() });
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
        { id: crypto.randomUUID(), art: 'text', farbe: stiftfarbe, groesse: 0.024, x: textEingabe.x, y: textEingabe.y, text: textEingabe.text.trim() }]);
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
  const WERKZEUGE: [Werkzeug, string, string][] = [
    ['stift', '✎', 'Stift'], ['marker', '▮', 'Marker'], ['text', 'T', 'Text'], ['radierer', '⌫', 'Radierer'], ['stelle', '▢', 'Stelle'],
  ];
  const ladeTempo = stelle ? (zuletzt ?? stelle.zielTempo) : null;
  const hinweis = linieEinstellen && modus === 'lesen'
    ? (linienSeite ? `Goldene Linie auf Seite ${linienSeite} ziehen: bis hierhin lesen, dann zeigt Weiterblättern oben schon die nächste Seite.` : 'Auf der letzten Seite gibt es keine Blätterlinie — eine Seite zurückblättern.')
    : !werkzeug ? null
    : zeichenSeite === null ? null
    : werkzeug === 'stelle' ? 'Rahmen um die Takte ziehen.'
    : werkzeug === 'text' ? 'Auf die Stelle tippen, an der der Text stehen soll.'
    : werkzeug === 'radierer' ? 'Über Anmerkungen wischen, um sie zu löschen.'
    : fingerZeichnen ? 'Zeichnen mit Stift oder Finger.' : 'Mit dem Stift zeichnen — der Finger blättert weiter.';

  // Als eigenes Fenster über allem; der Rest der Seite ist solange nicht bedienbar.
  useEffect(() => {
    const main = document.querySelector('body > main, main');
    main?.setAttribute('inert', '');
    return () => main?.removeAttribute('inert');
  }, []);

  return createPortal(
    <div className="betrachter" role="dialog" aria-modal="true" aria-label={`Noten: ${noten.titel}`}>
      {leiste && (
        <div className="betrachter-leiste">
          <div className="betrachter-zeile">
            <button type="button" className="b-knopf" onClick={schliessen} aria-label="Schließen">✕</button>
            <span className="b-titel">{noten.titel}{noten.stimme && <span className="b-leise"> · {noten.stimme}</span>}</span>
            <span className="b-leise b-seite tabular-nums">{anzeige}</span>
            <span className="flex-1" />
            <div className="b-segment" role="group" aria-label="Modus">
              <button type="button" aria-pressed={modus === 'lesen'} onClick={zumLesen}>Lesen</button>
              <button type="button" aria-pressed={modus === 'stellen'} disabled={!stellen.length}
                onClick={() => { setModus('stellen'); setWerkzeug(null); setLinieEinstellen(false); }}>Stellen ({stellen.length})</button>
            </div>
            <button type="button" className="b-knopf b-nur-breit" aria-pressed={metronomLeiste} onClick={() => setMetronomLeiste(!metronomLeiste)} aria-label="Metronom-Leiste ein/aus">♩</button>
          </div>
          <div className="betrachter-zeile">
            {modus === 'lesen' && (
              <button type="button" className="b-knopf b-nur-schmal" aria-label="Blättermodus wechseln" onClick={() => {
                const m: Blaettermodus = blaettern.modus === 'ganz' ? 'halb' : blaettern.modus === 'halb' ? 'linie' : 'ganz';
                blaetternSpeichern({ ...blaettern, modus: m }); setLinieEinstellen(m === 'linie'); if (m === 'linie') setWerkzeug(null);
              }}>⇅ {blaettern.modus === 'ganz' ? 'Ganz' : blaettern.modus === 'halb' ? 'Halb' : 'Linie'}</button>
            )}
            {modus === 'lesen' && (
              <div className="b-segment b-nur-breit" role="group" aria-label="Blättern">
                {([['ganz', 'Ganz', 'Ganze Seite'], ['halb', 'Halb', 'Halbe Seite'], ['linie', 'Linie', 'Eigene Linie']] as const).map(([m, kurz, lang]) => (
                  <button key={m} type="button" aria-pressed={blaettern.modus === m} aria-label={`Blättern: ${lang}`}
                    onClick={() => { blaetternSpeichern({ ...blaettern, modus: m }); setLinieEinstellen(m === 'linie'); if (m === 'linie') setWerkzeug(null); }}>
                    <span className="b-kurz">{kurz}</span><span className="b-lang">{lang}</span>
                  </button>
                ))}
              </div>
            )}
            {modus === 'lesen' && blaettern.modus === 'linie' && (
              <button type="button" className="b-knopf" aria-pressed={linieEinstellen} onClick={() => { setLinieEinstellen(!linieEinstellen); setWerkzeug(null); }}>
                {linieEinstellen ? 'Fertig' : <>Linie<span className="b-lang"> einstellen</span></>}
              </button>
            )}
            {modus === 'stellen' && (
              <div className="b-segment" role="group" aria-label="Ansicht der Stelle">
                <button type="button" aria-pressed={rand} onClick={() => setRand(!rand)}>Rand</button>
                <button type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)} aria-label="Heranzoomen">Zoom</button>
              </div>
            )}
            <span className="flex-1" />
            <div className="b-segment" role="group" aria-label="Werkzeug">
              {WERKZEUGE.map(([w, zeichen, name]) => (
                <button key={w} type="button" aria-pressed={werkzeug === w} aria-label={name} title={name}
                  onClick={() => { setWerkzeug(werkzeug === w ? null : w); setLinieEinstellen(false); }}>
                  <span aria-hidden="true">{zeichen}</span><span className="b-lang"> {name}</span>
                </button>
              ))}
            </div>
            {werkzeug && <button type="button" className="b-knopf" onClick={rueckgaengig} aria-label="Rückgängig" title="Rückgängig">↶</button>}
          </div>
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
        {/* Schwebende Werkzeug-Optionen: verkleinern das Blatt nicht. */}
        {(hinweis || (werkzeug && werkzeug !== 'stelle') || (werkzeug && zeichenSeite === null)) && (
          <div className="b-schwebend">
            {werkzeug && zeichenSeite === null ? (
              <>
                <span>Anmerken geht auf einer ganzen Seite.</span>
                <button type="button" className="b-knopf b-greifbar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
                  onClick={() => setIndex(ansichtVonSeite(liste, hauptseite(ansicht)))}>Ganze Seite zeigen</button>
              </>
            ) : (
              <>
                {(werkzeug === 'stift' || werkzeug === 'text' || werkzeug === 'marker') && (werkzeug === 'marker' ? MARKERFARBEN : STIFTFARBEN).map((f) => (
                  <button key={f} type="button" className="b-farbe b-greifbar" style={{ background: f }}
                    onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} aria-pressed={(werkzeug === 'marker' ? markerfarbe : stiftfarbe) === f}
                    onClick={() => (werkzeug === 'marker' ? setMarkerfarbe(f) : setStiftfarbe(f))} aria-label="Farbe wählen" />
                ))}
                {(werkzeug === 'stift' || werkzeug === 'marker' || werkzeug === 'radierer') && (
                  <label className="b-schalter b-greifbar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}><input type="checkbox" checked={fingerZeichnen} onChange={(e) => setFingerZeichnen(e.target.checked)} /> auch mit dem Finger</label>
                )}
                {hinweis && <span key={hinweis} className="b-hinweis b-verblassen">{hinweis}</span>}
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
          <button type="button" className="knopf b-geschafft" onClick={() => void geschafft(stelle.id)} title="Dieses Tempo als geschafft speichern">✓ {bpm} geschafft</button>
          <button type="button" className="b-knopf gross" onClick={weiter} disabled={stelleNr >= stellen.length - 1} aria-label="Nächste Stelle">›</button>
        </div>
      )}

      {metronomLeiste && (
        <div className="b-metronom"><MiniMetronom dunkel /></div>
      )}
    </div>,
    document.body,
  );
}

const prozent = (r: Rechteck) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` });
