'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ausschnitteLesen, ausschnittFuer, ausschnittSetzen, darstellung, fuerAlleSeiten, VOLL } from '@/domain/ausschnitt';
import { RAD_ANFANG, radGeste, radWeg, tastenAktion, WISCH_UMKEHREN, zeigerGeste, type Blaetter } from '@/domain/geste';
import { ansichten, ansichtVonSeite, hauptseite, radierZug, type Anmerkung, type Ansicht, type Blaettermodus } from '@/domain/notenpult';
import { abschnitt, ankunftSchritt, schrittUebertragen, schrittZu, spielfolge } from '@/domain/spielfolge';
import {
  artWaehlen, einpassen, KUERZEL, punktSichtbar, seiteAn, setzenTippen, sichtbareMarken, spruengeLesen,
  spruengeSchreiben, sprungHinzufuegen, sprungLoeschen, sprungText, SPRUNG_ARTEN, zielAnsicht, type Punkt, type Setzen, type Sprung,
} from '@/domain/spruenge';
import { tempoStand, zielAusText, zielStand } from '@/domain/stellen';
import { einstellungPruefen, TEXT_GROESSE, type StiftEinstellung, type ZeichenWerkzeug } from '@/domain/stift';
import { mitRand, rechteckAus, type Rechteck } from '@/domain/ueben';
import { AusschnittRahmen } from './Ausschnitt';
import { gespeichert as gespeicherterWert, speichern } from './klang';
import {
  anmerkungenSpeichern, anmerkungenVon, notenAendern, stelleAnlegen, tempoGeschafft,
  type LokaleNoten, type LokaleStelle,
} from './lokal';
import { useMetronom } from './MetronomKontext';
import { ladeFehler, speicherFehler } from './speicherfehler';
import { StiftPalette, type Werkzeug } from './StiftPalette';
import { seiteMitEbene, type SeitenBild } from './pdf';
import { StelleBlatt } from './StelleBlatt';
import { StellenInfo } from './StellenInfo';
import type { MixSteuerung } from './StellenMix';
import { anmerkungenZeichnen, ebeneZeichnen, strichZeichnen } from './zeichnen';

const RAND = 0.06;
const MAX_PX = 2800;

interface Props {
  noten: LokaleNoten; pdf: PDFDocumentProxy; stellen: LokaleStelle[];
  geaendert: () => void;
  // Tasten blättern nur, wenn kein Overlay über den Noten liegt.
  tastenAktiv: boolean;
  // Sprung aus der Stellen-Übersicht: in den Stellen-Modus zu dieser Stelle.
  sprung: { stelle: string; n: number } | null;
  titelTipp: () => void;
  // Stellen-Mix (F-11): genau diese Stelle, ‹ › gehen durch die Runde.
  mix: MixSteuerung | null;
  // Leisten (oben hier, unten die Werkzeug-Leiste) liegen über den Noten;
  // Tippen in die Mitte blendet beide aus und ein. navDa: die untere ist zu sehen.
  leisteWeg: boolean; setLeisteWeg: (weg: boolean) => void; navDa: boolean;
}

export function NotenBetrachter({ noten, pdf, stellen, geaendert, tastenAktiv, sprung, titelTipp, mix, leisteWeg, setLeisteWeg, navDa }: Props) {
  const seiten = pdf.numPages;
  const { bpm, setBpm } = useMetronom();

  // ── Blättern ── Die Position ist ein Schritt der Spielfolge: Weiterblättern
  // (Pedal, Ring, Tasten, Rand-Tippen) folgt den Sprüngen, zurück denselben Weg.
  const [blaettern, setBlaettern] = useState(noten.blaettern ?? { modus: 'ganz' as Blaettermodus, linien: {} as Record<number, number> });
  const liste = useMemo(() => ansichten(seiten, blaettern.modus, blaettern.linien), [seiten, blaettern]);
  // Sprünge (F-05): Marke am Sprungzeichen, Weiterblättern und Antippen führen zur Einstiegsstelle.
  const [spruenge, setSpruenge] = useState(() => spruengeLesen(noten.spruenge));
  const folge = useMemo(() => spielfolge(liste, spruenge), [liste, spruenge]);
  // Sprung setzen: geführt in drei Schritten (Zeile unten). Dabei blättert man
  // durch die Ansichten selbst (frei), nicht durch die Spielfolge.
  const [setzen, setSetzen] = useState<Setzen | null>(null);
  const setzenAktiv = setzen !== null;
  const [pos, setPos] = useState(() => ({ schritt: 0, frei: null as number | null, liste, folge }));
  // Zustand im Rendern nachziehen (React-Muster): Sprünge oder Blättern
  // geändert → dieselbe Ansicht im selben Abschnitt; Setzen vorbei → der
  // Schritt mit der zuletzt gezeigten Ansicht, der am nächsten liegt.
  const folgeNeu = pos.folge !== folge, setzenVorbei = pos.frei !== null && !setzen;
  const uebertragen = folgeNeu ? schrittUebertragen(pos.liste, pos.folge, pos.schritt, liste, folge) : pos.schritt;
  const nachgezogen = setzenVorbei ? schrittZu(folge, Math.min(pos.frei ?? 0, liste.length - 1), uebertragen) : uebertragen;
  const frei = setzenVorbei ? null : pos.frei;
  if (folgeNeu || setzenVorbei) setPos({ schritt: nachgezogen, frei, liste, folge });
  const schritt = Math.max(0, Math.min(nachgezogen, folge.length - 1));
  const ansichtNr = frei !== null ? Math.min(frei, liste.length - 1) : (folge[schritt]?.ansicht ?? 0);
  const ansicht: Ansicht = liste[ansichtNr];
  const zuSchritt = (s: number) => setPos({ schritt: s, frei: null, liste, folge });
  // Eine Ansicht zeigen (Stelle → Lesen, ganze Seite …): der nächstliegende Schritt mit ihr.
  const zuAnsicht = (v: number) => zuSchritt(schrittZu(folge, v, schritt));
  const blaetternSpeichern = (b: typeof blaettern) => {
    // Auf die ganze Seite, die gerade gilt — im selben Abschnitt.
    const l = ansichten(seiten, b.modus, b.linien), f = spielfolge(l, spruenge);
    const ziel = ansichtVonSeite(l, hauptseite(ansicht));
    let s = schrittUebertragen(liste, folge, schritt, l, f, ziel);
    // Die Blätterlinie zieht man auf der ganzen Seite, notfalls in einem anderen Durchgang.
    if (b.modus === 'linie' && f[s]?.ansicht !== ziel) s = schrittZu(f, ziel, s);
    setPos({ schritt: s, frei: null, liste: l, folge: f });
    setBlaettern(b);
    notenAendern(noten.id, { blaettern: b }).catch(speicherFehler);
  };

  // ── Modus: lesen oder Stelle für Stelle ── Im Mix immer die Stelle der Runde.
  const [eigenerModus, setModus] = useState<'lesen' | 'stellen'>(mix ? 'stellen' : 'lesen');
  const modus = mix ? 'stellen' : eigenerModus;
  const [stelleNr, setStelleNr] = useState(0);
  const stelle = mix ? stellen.find((s) => s.id === mix.stelle)
    : modus === 'stellen' ? stellen[Math.min(stelleNr, stellen.length - 1)] : undefined;
  const zumLesen = () => {
    if (stelle) zuAnsicht(ansichtVonSeite(liste, stelle.seite));
    setModus('lesen');
  };

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
  const leiste = !leisteWeg;
  // Stück verlassen: Leisten wieder zeigen (sonst fehlt die untere ohne Noten).
  useEffect(() => () => setLeisteWeg(false), [setLeisteWeg]);
  // Was Stellen sind: „i“ neben dem Schalter, oder beim Einschalten ohne Stellen.
  const [stellenInfo, setStellenInfo] = useState<'info' | 'leer' | null>(null);
  const schalterId = useId();
  // Ansicht-Menü (Blättern, Ausschnitt) als Popover unter der Leiste.
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
    // Innenmaß: ohne den Abstand zu Notch und Home-Leiste.
    const ro = new ResizeObserver(([e]) => setPlatz({ b: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Ausschnitt je Seite: der eingestellte Bereich füllt den Platz ──
  const [ausschnitte, setAusschnitte] = useState(() => ausschnitteLesen(noten.ausschnitte));
  const [bearbeiten, setBearbeiten] = useState<{ seite: number; r: Rechteck; alle: boolean } | null>(null);
  const bearbeitenSeite = bearbeiten?.seite ?? null;
  const ausschnitt = useMemo(() => bearbeitenSeite !== null ? VOLL
    : ausschnittFuer(ausschnitte, stelle ? [stelle.seite] : ansicht.art === 'ganz' ? [ansicht.seite] : [ansicht.oben, ansicht.unten]),
  [ausschnitte, bearbeitenSeite, stelle, ansicht]);
  // Beim Einstellen etwas kleiner: die Griffe an den Ecken bleiben greifbar.
  const darst = useMemo(() => {
    if (!platz.b || !platz.h) return null;
    const rand = bearbeitenSeite !== null ? 40 : 0;
    return darstellung({ b: platz.b - rand, h: platz.h - rand }, format, ausschnitt);
  }, [platz, format, ausschnitt, bearbeitenSeite]);
  const rahmen = darst?.rahmen ?? null;

  // ── Sprünge ── Gespeichert am Stück; die Spielfolge rechnet sich neu.
  const spruengeSpeichern = (neu: Sprung[]) => {
    setSpruenge(neu);
    // Einträge einer neueren Version (unbekannte Art) reisen unverändert mit.
    notenAendern(noten.id, { spruenge: spruengeSchreiben(neu, noten.spruenge) }).catch(speicherFehler);
  };
  // Ring an der Einstiegsstelle nach einem Sprung (am Sprungzeichen, wenn es zurückgeht).
  const [blink, setBlink] = useState<(Punkt & { n: number }) | null>(null);
  // n zählt hoch: ein neuer Ring beginnt sein Blinken von vorn.
  const blinken = useCallback((p: Punkt) => setBlink((b) => ({ ...p, n: (b?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!blink) return;
    const t = window.setTimeout(() => setBlink(null), 1600);
    return () => window.clearTimeout(t);
  }, [blink]);
  // Marke antippen: zur Ankunft dieses Sprungs in der Spielfolge (die nächste
  // ab hier, sonst die erste); nimmt die Folge ihn nie (Coda ohne D.S.), zur
  // Zielseite.
  function springen(s: Sprung) {
    const ziel = zielAnsicht(liste, s.nach);
    if (ziel === null) return;
    zuSchritt(ankunftSchritt(folge, s.id, schritt) ?? schrittZu(folge, ziel, schritt));
    blinken(s.nach);
  }
  function setzenStarten() {
    setSetzen({ schritt: 'von' });
    setPos({ schritt, frei: ansichtNr, liste, folge });
    setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); setAnsichtOffen(false);
    // Leisten weg: die ganze Seite ist antippbar, auch ganz oben.
    setLeisteWeg(true);
  }
  // Danach zurück in die Spielfolge (siehe oben, im Rendern).
  const setzenEnde = () => { setSetzen(null); setLeisteWeg(false); };
  function sprungSpeichern() {
    if (setzen?.schritt !== 'art') return;
    const { von, nach, art } = setzen;
    spruengeSpeichern(sprungHinzufuegen(spruenge, { von, nach, art }, crypto.randomUUID()));
    // Zurück zum Sprungzeichen: die neue Marke blinkt kurz.
    if (!punktSichtbar(ansicht, von)) setPos({ schritt, frei: ansichtVonSeite(liste, von.seite), liste, folge });
    setzenEnde();
    blinken(von);
  }

  // ── Seiten einmal rendern, dann aus dem Zwischenspeicher zusammensetzen ──
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2.5);
  // Gerendert wird die ganze Seite in Blattgröße (beim Ausschnitt größer als der Rahmen).
  const px = darst ? Math.min(MAX_PX, Math.round(darst.blatt.b * dpr)) : 0;
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
      const teile: { seite: number; y0: number; y1: number }[] = bearbeitenSeite !== null
        ? [{ seite: bearbeitenSeite, y0: 0, y1: 1 }]
        : stelle ? [{ seite: stelle.seite, y0: 0, y1: 1 }]
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
      if (stelle && bearbeitenSeite === null) {
        const r = mitRand(stelle, RAND);
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
  }, [ansicht, stelle, bearbeitenSeite, anm, stellen, rahmen, px, format, seiteBild]);

  // Nachbarseiten vorab rendern: Blättern ohne Wartezeit — auch die Zielseite,
  // wenn Weiterblättern als Nächstes springt.
  const naechster = folge[schritt + 1];
  const sprungSeite = naechster?.ankunft ? hauptseite(liste[naechster.ansicht]) : 0;
  useEffect(() => {
    if (!px) return;
    const s = sichtbareSeite;
    for (const n of [s + 1, s + 2, s - 1, sprungSeite]) if (n >= 1 && n <= seiten) void seiteBild(n);
  }, [sichtbareSeite, sprungSeite, seiten, px, seiteBild]);

  // ── Navigation ── Lesen: Schritt für Schritt durch die Spielfolge; beim
  // Sprung-Setzen durch die Ansichten selbst.
  const weiter = useCallback(() => {
    if (mix) mix.weiter();
    else if (modus === 'stellen') setStelleNr((n) => Math.min(stellen.length - 1, n + 1));
    else if (frei !== null) setPos({ schritt, frei: Math.min(liste.length - 1, frei + 1), liste, folge });
    else if (schritt < folge.length - 1) {
      setPos({ schritt: schritt + 1, frei: null, liste, folge });
      // Per Sprung angekommen: Ring an der Einstiegsstelle.
      const s = spruenge.find((x) => x.id === folge[schritt + 1].ankunft);
      if (s) blinken(s.nach);
    }
  }, [mix, modus, stellen.length, frei, schritt, liste, folge, spruenge, blinken]);
  const zurueck = useCallback(() => {
    if (mix) { if (mix.nr > 1) mix.zurueck(); }
    else if (modus === 'stellen') setStelleNr((n) => Math.max(0, n - 1));
    else if (frei !== null) setPos({ schritt, frei: Math.max(0, frei - 1), liste, folge });
    else if (schritt > 0) {
      setPos({ schritt: schritt - 1, frei: null, liste, folge });
      // Über den Sprung zurück: Ring am Sprungzeichen.
      const s = spruenge.find((x) => x.id === folge[schritt].ankunft);
      if (s) blinken(s.von);
    }
  }, [mix, modus, frei, schritt, liste, folge, spruenge, blinken]);

  const blaetternNach = useCallback((a: Blaetter) => { if (a === 'weiter') weiter(); else zurueck(); }, [weiter, zurueck]);
  // Wischrichtung (Einstellungen): beim Wischen frisch gelesen, ändert sich selten.
  const umkehren = () => gespeicherterWert(WISCH_UMKEHREN, false);
  // Mausrad / Trackpad: eine Bewegung blättert einmal.
  const rad = useRef(RAD_ANFANG);
  function radDrehen(e: React.WheelEvent) {
    if (e.ctrlKey || neueStelle || textEingabe || bearbeiten) return; // Strg+Rad = Zoomen
    const f = (d: number) => radWeg(d, e.deltaMode, window.innerHeight);
    const r = radGeste(rad.current, f(e.deltaX), f(e.deltaY), e.timeStamp, umkehren());
    rad.current = r.z;
    if (r.aktion) blaetternNach(r.aktion);
  }

  // Stellen-Blatt (Ziel, Verlauf) der aktuellen Stelle
  const [stelleBlatt, setStelleBlatt] = useState(false);

  useEffect(() => {
    if (!tastenAktiv || stelleBlatt || bearbeitenSeite !== null) return;
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      // Leertaste auf einem Bedienelement aktiviert es, statt zu blättern.
      if (e.key === ' ' && (e.target as HTMLElement).closest('button, a, select, summary, [role="dialog"]')) return;
      // Bluetooth-Blätterpedale senden meist Pfeil- oder Bild-Tasten.
      const a = tastenAktion(e.key);
      if (a) { e.preventDefault(); blaetternNach(a); }
      if (e.key === 'Escape' && werkzeug) setWerkzeug(null);
      if (e.key === 'Escape' && setzenAktiv) { setSetzen(null); setLeisteWeg(false); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [blaetternNach, werkzeug, tastenAktiv, stelleBlatt, bearbeitenSeite, setzenAktiv, setLeisteWeg]);

  // ── Zeiger: zeichnen oder blättern ──
  const blatt = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  // marke: der Zug begann auf der Marke dieses Sprungs (Tippen springt, Wischen blättert).
  const zug = useRef<{ art: 'zeichnen' | 'tippen'; punkte: number[]; x: number; y: number; t: number; id: number; marke?: string | null } | null>(null);
  const [rechteckEntwurf, setRechteckEntwurf] = useState<Rechteck | null>(null);
  // Nach einem Tipp, den die Fläche selbst ausführt (Sprung, Punkt setzen,
  // Blättern, Leisten), schickt der Browser noch mousedown und click an die
  // Stelle unter dem Finger. Dort liegt jetzt womöglich eine Marke oder ein
  // Knopf der Setzen-Zeile: diesen Nachzügler schlucken. Der nächste Druck
  // (pointerdown) gehört zu einem neuen Zug und hebt das auf.
  const nachzueglerBis = useRef(0);
  useEffect(() => {
    const druck = () => { nachzueglerBis.current = 0; };
    const maus = (e: MouseEvent) => {
      if (e.detail === 0 || performance.now() > nachzueglerBis.current) return; // Tastatur nie
      e.preventDefault(); // kein Fokus auf dem Knopf darunter
      if (e.type === 'click') { e.stopPropagation(); nachzueglerBis.current = 0; }
    };
    document.addEventListener('pointerdown', druck, true);
    document.addEventListener('mousedown', maus, true);
    document.addEventListener('click', maus, true);
    return () => {
      document.removeEventListener('pointerdown', druck, true);
      document.removeEventListener('mousedown', maus, true);
      document.removeEventListener('click', maus, true);
    };
  }, []);
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
    const amZiel = zielStand(bpm, stellen.find((s) => s.id === id)?.zielTempo ?? null)?.stufe;
    setGespeichert(`Gespeichert: ${bpm} geschafft${amZiel === 'reserve' ? ' — Ziel mit Reserve!' : amZiel === 'ziel' ? ' — Ziel erreicht!' : ''}`);
    window.setTimeout(() => setGespeichert(null), 1600);
  }
  const [neueStelle, setNeueStelle] = useState<Rechteck | null>(null);
  const [stelleTitel, setStelleTitel] = useState('');
  const [stelleZiel, setStelleZiel] = useState('');
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
    // Blattgröße: beim Ausschnitt größer als der sichtbare Rahmen.
    c.width = Math.round(blatt.current.offsetWidth * dpr); c.height = Math.round(blatt.current.offsetHeight * dpr);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (werkzeug === 'stift') strichZeichnen(ctx, z.punkte, einst.stift.farbe, einst.stift.breite * c.width, 0, 0, c.width, c.height);
    if (werkzeug === 'marker') strichZeichnen(ctx, z.punkte, einst.marker.farbe, einst.marker.breite * c.width, 0, 0, c.width, c.height, true);
  }

  function runter(e: React.PointerEvent) {
    if (textEingabe) { textSpeichern(); return; } // Tippen daneben übernimmt den Text
    if (neueStelle || bearbeiten) return;
    const p = relativ(e);
    radierWisch.current = false;
    radierSpur.current = null;
    if (darfZeichnen(e)) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      zug.current = { art: 'zeichnen', punkte: [p.x, p.y], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      if (werkzeug === 'radierer') radieren(p.x, p.y);
    } else {
      // Festhalten: Auch ein Wisch als Maus-Zeiger (Scroll-Ring über
      // AssistiveTouch), der über den Rand hinausläuft, endet hier.
      e.currentTarget.setPointerCapture(e.pointerId);
      const marke = (e.target as Element).closest?.('[data-sprung]')?.getAttribute('data-sprung') ?? null;
      zug.current = { art: 'tippen', punkte: [], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, marke };
    }
  }
  // Liegt der Punkt im sichtbaren Rahmen (beim Ausschnitt ragt das Blatt darüber hinaus)?
  const imRahmen = (x: number, y: number) => {
    const r = blatt.current?.parentElement?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
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
      // Wischen (Finger oder Scroll-Ring): nach oben/links weiter, nach unten/rechts zurück.
      const g = zeigerGeste(e.clientX - z.x, e.clientY - z.y, e.timeStamp - z.t, umkehren());
      if (g.art === 'wisch') { blaetternNach(g.aktion); return; }
      if (g.art !== 'tippen') return;
      nachzueglerBis.current = performance.now() + 1000;
      // Sprung setzen: Tippen setzt den Punkt, auch am Rand (blättern per Wischen, Tasten, ‹ ›).
      if (setzen) {
        if (!imRahmen(z.x, z.y)) return;
        const q = relativ({ clientX: z.x, clientY: z.y });
        setSetzen(setzenTippen(setzen, { seite: seiteAn(ansicht, q.y), x: q.x, y: q.y }));
        return;
      }
      const sprungHier = z.marke && modus === 'lesen' ? spruenge.find((s) => s.id === z.marke) : undefined;
      if (sprungHier) { springen(sprungHier); return; }
      const b = window.innerWidth, x = e.clientX;
      if (x < b * 0.3) zurueck(); else if (x > b * 0.7) weiter(); else { setAnsichtOffen(false); setLeisteWeg(leiste); }
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
      if (r.b > 0.02 && r.h > 0.01) { setNeueStelle(r); setStelleTitel(''); setStelleZiel(''); }
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
      await stelleAnlegen({ notenId: noten.id, seite: zeichenSeite, ...r, titel: stelleTitel.trim() }, zielAusText(stelleZiel));
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

  // Ausschnitt einstellen: zeigt die ganze Seite mit Rahmen; Fertig speichert
  // für diese Seite oder für alle.
  const seiteJetzt = stelle ? stelle.seite : hauptseite(ansicht);
  function ausschnittStarten() {
    setBearbeiten({ seite: seiteJetzt, r: ausschnitte[seiteJetzt] ?? VOLL, alle: false });
    setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); setAnsichtOffen(false);
    // Leisten weg: die ganze Seite samt Griffen bleibt frei.
    setLeisteWeg(true);
  }
  const ausschnittEnde = () => { setBearbeiten(null); setLeisteWeg(false); };
  function ausschnittSpeichern() {
    if (!bearbeiten) return;
    const neu = bearbeiten.alle ? fuerAlleSeiten(seiten, bearbeiten.r) : ausschnittSetzen(ausschnitte, bearbeiten.seite, bearbeiten.r);
    setAusschnitte(neu);
    ausschnittEnde();
    notenAendern(noten.id, { ausschnitte: neu }).catch(speicherFehler);
  }

  const { zuletzt, bestes } = tempoStand(stelle?.tempi ?? []);
  // Metronom folgt der Stelle (D-04): Kommt eine Stelle dran — beim Blättern,
  // im Mix, beim Einschalten —, steht es auf ihrem zuletzt geschafften Tempo.
  // Nur beim Wechsel: −1/+1 und „geschafft“ bleiben, wie sie sind.
  const tempoFuer = useRef<string | null>(null);
  useEffect(() => {
    const id = stelle?.id ?? null;
    if (id === tempoFuer.current) return;
    tempoFuer.current = id;
    if (zuletzt) setBpm(zuletzt);
  }, [stelle?.id, zuletzt, setBpm]);
  const seitenText = ansicht.art === 'ganz' ? `${ansicht.seite}` : `${ansicht.unten} → ${ansicht.oben}`;
  const anzeige = mix ? `Mix${mix.titel ? ` ${mix.titel}` : ''} · ${mix.nr} von ${mix.anzahl}`
    : modus === 'stellen'
    ? `Stelle ${stelleNr + 1} von ${stellen.length}`
    : `Seite ${seitenText} von ${seiten}`;
  // Per Sprung erreichter Abschnitt (nicht beim Setzen): „S. 1 · nach D.S.“ —
  // kurz, und „nach D.S.“ bleibt neben den Knöpfen immer ganz zu sehen.
  const seit = !mix && modus === 'lesen' && frei === null ? abschnitt(folge, schritt) : null;
  const seitArt = seit ? spruenge.find((s) => s.id === seit)?.art : undefined;
  const ladeTempo = stelle ? (zuletzt ?? stelle.zielTempo) : null;
  // Linien-Hinweis schwebt über dem Blatt; Werkzeug-Hinweise stehen in der Palette.
  const linieHinweis = linieEinstellen && modus === 'lesen'
    ? (linienSeite ? `Goldene Linie auf Seite ${linienSeite} ziehen: bis hierhin lesen, dann zeigt Weiterblättern oben schon die nächste Seite.` : 'Auf der letzten Seite gibt es keine Blätterlinie — eine Seite zurückblättern.')
    : null;
  const werkzeugHinweis = !werkzeug || zeichenSeite === null ? null
    : werkzeug === 'stelle' ? 'Rahmen um die Takte ziehen.'
    : werkzeug === 'text' ? 'Auf die Stelle tippen, an der der Text stehen soll.'
    : null;
  // Höhe der oberen Leiste: Hinweise schweben darunter, solange sie zu sehen ist.
  const oben = useRef<HTMLDivElement>(null);
  const [obenHoehe, setObenHoehe] = useState(0);
  useEffect(() => {
    const el = oben.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setObenHoehe(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Unten eine Zeile der Noten selbst (Stelle, neue Stelle, Ausschnitt)?
  const zeileUnten = !!(neueStelle || stelle || bearbeiten || setzen);
  // Marken der Sprünge: nur beim Lesen, nicht beim Zuschneiden und nicht beim
  // Ziehen der Blätterlinie. Außerhalb des Ausschnitts rücken sie an dessen
  // Rand (sichtbar und antippbar).
  const marken = modus === 'lesen' && !bearbeiten && !linieEinstellen ? sichtbareMarken(spruenge, ansicht) : [];
  const lage = (p: { x: number; y: number }) => {
    const q = einpassen(p, ausschnitt);
    return { left: `${q.x * 100}%`, top: `${q.y * 100}%` };
  };
  const paletteWechsel = (offen: boolean) => {
    setPaletteOffen(offen);
    setWerkzeug(offen ? 'stift' : null);
    if (offen) setLinieEinstellen(false);
  };

  return (
    <div className={`betrachter ${navDa ? 'nav-da' : ''}`} role="region" aria-label={`Noten: ${noten.titel}`}>
      <div ref={oben} className={`betrachter-leiste ${leiste ? '' : 'weg'}`} inert={!leiste}>
        <div className="nav-zeile">
          <button type="button" className="nav-titel" onClick={titelTipp} title="Stück-Details und Stellen-Übersicht">
            <span className="nav-titel-text">
              <span className="nav-titel-schnitt">{noten.titel}{noten.stimme && <span className="b-leise"> · {noten.stimme}</span>}</span>
              <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {seitArt ? (
              <span className="nav-untertitel nav-abschnitt tabular-nums">
                <span>S. {seitenText}</span><span> · nach {KUERZEL[seitArt]}</span>
              </span>
            ) : <span className="nav-untertitel tabular-nums">{anzeige}</span>}
          </button>
          <span className="flex-1" />
          {/* Immer da, auch ohne Stellen: so findet man sie. Das „i“ erklärt sie. */}
          <div className="nav-schalter">
            <label htmlFor={schalterId} className="nav-schalter-label" title="Stelle für Stelle üben">Stellen</label>
            <button type="button" className="nav-info" onClick={() => { setAnsichtOffen(false); setStellenInfo('info'); }}
              aria-label="Was sind Stellen?" title="Was sind Stellen?">i</button>
            <input id={schalterId} type="checkbox" role="switch" className="ios-schalter" checked={modus === 'stellen' || stellenInfo === 'leer'}
              onChange={(e) => {
                setAnsichtOffen(false);
                // Noch keine Stellen: erklären, der Schalter geht beim Schließen wieder aus.
                if (e.target.checked && !stellen.length) { setStellenInfo('leer'); return; }
                if (e.target.checked) { setModus('stellen'); setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); setBearbeiten(null); }
                else { zumLesen(); mix?.beenden(); }
              }} />
          </div>
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
              {modus === 'lesen' && (
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
              )}
              <p className="nav-blase-titel">Ausschnitt</p>
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={ausschnittStarten}>
                Seite {seiteJetzt} {ausschnitte[seiteJetzt] ? 'anders zuschneiden' : 'zuschneiden'}
              </button>
              <p className="gedaempft text-xs">Nur den Bereich zeigen, den du brauchst — z. B. ohne breite Ränder. Gilt künftig für diese Seite.</p>
              {modus === 'lesen' && (
                <>
                  <p className="nav-blase-titel">Sprünge</p>
                  <button type="button" className="knopf knopf-leise knopf-klein" onClick={setzenStarten} disabled={!!neueStelle}>Sprung setzen</button>
                  <p className="gedaempft text-xs">Weiterblättern folgt den Sprüngen.</p>
                  {spruenge.length > 0 && (
                    <ul className="nav-spruenge" aria-label="Sprünge">
                      {spruenge.map((s) => (
                        <li key={s.id}>
                          <span className="tabular-nums">{sprungText(s)}</span>
                          <button type="button" className="nav-loeschen" aria-label={`Sprung ${sprungText(s)} löschen`}
                            onClick={() => spruengeSpeichern(sprungLoeschen(spruenge, s.id))}>Löschen</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Zeiger auf der ganzen Fläche: auch Tippen neben das Blatt blättert. */}
      <div ref={flaeche} className={`betrachter-flaeche ${zeileUnten ? '' : 'unten-frei'}`}
        style={{ '--oben': `${leiste ? obenHoehe : 0}px` } as React.CSSProperties}
        onPointerDown={runter} onPointerMove={(e) => { bewegen(e); linieBewegen(e); }} onPointerUp={(e) => { hoch(e); linieLoslassen(); }}
        onPointerCancel={() => { zug.current = null; setRechteckEntwurf(null); }} onWheel={radDrehen}
        onMouseDown={(e) => { if (werkzeug) e.preventDefault(); }}>
        {darst && (
          <div className={`betrachter-rahmen ${bearbeiten ? 'einstellen' : ''}`} style={{ width: darst.rahmen.b, height: darst.rahmen.h }}>
            <div ref={blatt} className="betrachter-blatt" style={{ width: darst.blatt.b, height: darst.blatt.h, left: darst.blatt.x, top: darst.blatt.y }}>
              <canvas ref={leinwand} className="betrachter-leinwand" />
              <canvas ref={live} className="betrachter-leinwand betrachter-live" />
              {marken.map((s) => (
                <button key={s.id} type="button" data-sprung={s.id} className={`b-marke ${setzen ? 'leise' : ''}`} style={lage(s.von)}
                  tabIndex={setzen ? -1 : undefined} aria-label={`${KUERZEL[s.art]}: zu Seite ${s.nach.seite}`} title={`${KUERZEL[s.art]} → Seite ${s.nach.seite}`}
                  // Finger und Zeiger laufen über die Fläche (hoch); hier nur Tastatur (detail 0).
                  onClick={(e) => { if (e.detail === 0) springen(s); }}>
                  <span>{KUERZEL[s.art]}</span>
                </button>
              ))}
              {setzen && setzen.schritt !== 'von' && punktSichtbar(ansicht, setzen.von) && (
                <span className="b-marke vorschau" style={lage(setzen.von)} aria-hidden="true">
                  <span>{setzen.schritt === 'art' ? KUERZEL[setzen.art] : '?'}</span>
                </span>
              )}
              {setzen?.schritt === 'art' && punktSichtbar(ansicht, setzen.nach) && (
                <span className="b-zielring" style={lage(setzen.nach)} aria-hidden="true" />
              )}
              {blink && modus === 'lesen' && !bearbeiten && punktSichtbar(ansicht, blink) && (
                <span key={blink.n} className="b-zielring b-blink" style={lage(blink)} aria-hidden="true" />
              )}
              {rechteckEntwurf && <span className="b-rechteck" style={prozent(rechteckEntwurf)} />}
              {bearbeiten && <AusschnittRahmen r={bearbeiten.r} blatt={blatt} setzen={(r) => setBearbeiten({ ...bearbeiten, r })} />}
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
        {!werkzeug && !linieEinstellen && !bearbeiten && !setzen && (
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
                  onClick={() => zuAnsicht(ansichtVonSeite(liste, hauptseite(ansicht)))}>Ganze Seite zeigen</button>
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
          <input className="feld feld-zahl b-ziel" inputMode="numeric" value={stelleZiel} onChange={(e) => setStelleZiel(e.target.value)}
            placeholder="Ziel ♩" aria-label="Zieltempo (optional)" onKeyDown={(e) => { if (e.key === 'Enter') void stelleSpeichern(); }} />
          <button className="knopf knopf-klein" type="button" onClick={() => void stelleSpeichern()} aria-label="Stelle speichern">Speichern</button>
          <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setNeueStelle(null)}>Verwerfen</button>
        </div>
      )}

      {bearbeiten && (
        <div className="b-unten b-umbruch b-ausschnitt-leiste" role="group" aria-label="Ausschnitt einstellen">
          <p className="b-aus-hinweis">
            <strong>Seite {bearbeiten.seite} zuschneiden:</strong> Ecken und Kanten ziehen. Was im Rahmen liegt, füllt künftig den Bildschirm.
          </p>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setBearbeiten({ ...bearbeiten, r: VOLL })}>Ganze Seite</button>
          {seiten > 1 && (
            <label className="b-schalter">
              <input type="checkbox" role="switch" className="ios-schalter" checked={bearbeiten.alle}
                onChange={(e) => setBearbeiten({ ...bearbeiten, alle: e.target.checked })} />
              Für alle {seiten} Seiten
            </label>
          )}
          <span className="flex-1" />
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={ausschnittEnde}>Abbrechen</button>
          <button type="button" className="knopf knopf-klein" onClick={ausschnittSpeichern}>Fertig</button>
        </div>
      )}

      {setzen && (
        <div className="b-unten b-sprung" role="group" aria-label="Sprung setzen">
          <div className="b-sprung-zeile">
            <p className="b-sprung-hinweis">
              {setzen.schritt === 'von' ? 'Tippe auf das Sprungzeichen'
                : setzen.schritt === 'nach' ? 'Zum Ziel blättern und antippen'
                : <><strong className="tabular-nums">S. {setzen.von.seite} → S. {setzen.nach.seite}</strong> · Art wählen</>}
            </p>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={setzenEnde}>Abbrechen</button>
          </div>
          {/* Zweite Zeile in jedem Schritt gleich hoch: das Blatt bleibt stehen,
              nichts rutscht unter den Finger. */}
          {setzen.schritt !== 'art' ? (
            <div className="b-sprung-zeile b-sprung-zwei b-sprung-blaettern">
              <button type="button" className="b-knopf gross" onClick={zurueck} disabled={ansichtNr === 0} aria-label="Seite zurück">‹</button>
              <span className="b-sprung-seite tabular-nums">{anzeige}</span>
              <button type="button" className="b-knopf gross" onClick={weiter} disabled={ansichtNr >= liste.length - 1} aria-label="Seite weiter">›</button>
            </div>
          ) : (
            <div className="b-sprung-zeile b-sprung-zwei">
              <div className="b-segment b-sprung-arten" role="group" aria-label="Art des Sprungs">
                {SPRUNG_ARTEN.map((a) => (
                  <button key={a} type="button" aria-pressed={setzen.art === a} onClick={() => setSetzen(artWaehlen(setzen, a))}>{KUERZEL[a]}</button>
                ))}
              </div>
              <button type="button" className="knopf knopf-klein" onClick={sprungSpeichern}>Speichern</button>
            </div>
          )}
        </div>
      )}

      {stelle && !neueStelle && !bearbeiten && (
        <div className="b-unten b-stellenleiste">
          <button type="button" className="b-knopf gross" onClick={zurueck} disabled={mix ? mix.nr <= 1 : stelleNr === 0} aria-label="Vorige Stelle">‹</button>
          <button type="button" className="b-stelleninfo min-w-0 flex-1" onClick={() => setStelleBlatt(true)} title="Ziel und Tempo-Verlauf der Stelle">
            <span className="b-stellentitel">
              <span className="truncate font-bold">{stelle.titel || `Stelle auf Seite ${stelle.seite}`}</span>
              <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="b-leise block truncate text-xs tabular-nums">
              {gespeichert ?? <>
                {zuletzt ? `zuletzt geschafft ${zuletzt}` : 'noch kein Tempo geschafft'}{bestes && bestes !== zuletzt ? ` · bestes ${bestes}` : ''}{stelle.zielTempo ? ` · Ziel ${stelle.zielTempo}` : ' · Ziel setzen'}
                {stelle.notiz ? ` · ${stelle.notiz}` : ''}
              </>}
            </span>
          </button>
          {ladeTempo && ladeTempo !== bpm && (
            <button type="button" className="mini-knopf" onClick={() => setBpm(ladeTempo)} title="Metronom auf das zuletzt geschaffte Tempo stellen">♩ {ladeTempo}<span className="b-lang"> laden</span></button>
          )}
          <div className="gruppe b-schritte" role="group" aria-label="Tempo">
            <button type="button" onClick={() => setBpm(bpm - 1)} aria-label="Ein Schlag langsamer">−1</button>
            <button type="button" onClick={() => setBpm(bpm + 1)} aria-label="Ein Schlag schneller">+1</button>
          </div>
          <button type="button" className="knopf b-geschafft" onClick={() => void geschafft(stelle.id)} title="Dieses Tempo als geschafft speichern">✓ {bpm} geschafft</button>
          <button type="button" className="b-knopf gross" onClick={weiter} disabled={!mix && stelleNr >= stellen.length - 1} aria-label="Nächste Stelle">›</button>
        </div>
      )}

      {stellenInfo && <StellenInfo leer={stellenInfo === 'leer'} schliessen={() => setStellenInfo(null)} />}

      {stelleBlatt && stelle && (
        <StelleBlatt stelle={stelle} stueck={noten.titel} geaendert={geaendert} schliessen={() => setStelleBlatt(false)} />
      )}

      {/* Beim Benennen einer neuen Stelle weicht die Palette der Eingabezeile. */}
      {paletteOffen && !neueStelle && !bearbeiten && (
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
