'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ausschnitteLesen, ausschnittFuer, ausschnittSetzen, darstellung, doppelDarstellung, fuerAlleSeiten, VOLL, type SeitenLage } from '@/domain/ausschnitt';
import { pipettenPunkt } from '@/domain/farbe';
import { RAD_ANFANG, radGeste, radWeg, tastenAktion, WISCH_UMKEHREN, zeigerGeste, type Blaetter } from '@/domain/geste';
import { ansichten, ansichtVonSeite, blaetternLesen, einheitlich, hauptseite, modusSetzen, radierWeg, radierZug, seitenModus, seitenVon, ZWEI_SEITEN, type Anmerkung, type Ansicht, type Blaettermodus, type Blaettern } from '@/domain/notenpult';
import {
  ankunftSchritt, genommeneSpruenge, nachSprung, spielfolge, spruengeLaden, sprungEinordnen, standUebertragen, standZu,
  weiterGehen, zurueckGehen, type Stand,
} from '@/domain/spielfolge';
import {
  artWaehlen, einpassen, KUERZEL, punktSichtbar, setzenTippen, sichtbareMarken, spruengeSchreiben, sprungLoeschen,
  sprungNeu, sprungText, sprungVerschieben, SPRUNG_ARTEN, zielAnsicht, type Punkt as SprungPunkt, type Setzen, type Sprung,
} from '@/domain/spruenge';
import { mixKopf, stelleFavorit, tempoStand, zielAusText, zielStand } from '@/domain/stellen';
import {
  einstellungPruefen, pipettenFarbe, pipettenPruefen, radiererPruefen, TEXT_GROESSE,
  type Pipetten, type StiftEinstellung, type ZeichenWerkzeug,
} from '@/domain/stift';
import {
  dehnung, istSticker, luecken, rechteckGedehnt, schnittEntfernen, schnittSetzen, schnitteVon, stickerAus,
  stickerGetroffen, stickerHoehe, stickerRechteck, stickerSkalieren, teilstuecke, type Schnitt, type Sticker,
} from '@/domain/schnitte';
import { mitRand, rechteckAus, type Rechteck } from '@/domain/ueben';
import {
  begrenzen, einrasten, OHNE_ZOOM, sichtbarerTeil, ZOOM_IMMER, ZOOM_MAX, zoomenUm, zweiFinger, type Punkt, type Zoom,
} from '@/domain/zoom';
import { AusschnittRahmen } from './Ausschnitt';
import { gespeichert as gespeicherterWert, speichern, useEinstellungenGeladen } from './klang';
import {
  anmerkungenSpeichern, anmerkungenVon, stelleAendern, stueckAendern, stelleAnlegen, tempoGeschafft,
  type Stueck, type Stelle,
} from './lokal';
import { useMetronom } from './MetronomKontext';
import { ladeFehler, speicherFehler } from './speicherfehler';
import { StiftPalette, type SchereModus, type Werkzeug } from './StiftPalette';
import { ausschnittRendern, seiteMitEbene, type SeitenBild } from './pdf';
import { StelleBlatt } from './StelleBlatt';
import { StellenInfo } from './StellenInfo';
import { SprungZeichen } from './SprungZeichen';
import type { MixSteuerung } from './StellenMix';
import { SternKnopf } from './Stern';
import { anmerkungenZeichnen, blattZeichnen, stickerZeichnen, strichZeichnen, type BlattTeil } from './zeichnen';

const RAND = 0.06;
const MAX_PX = 2800;
// Beim Zoomen (E-06): größte scharfe Leinwand in Pixeln (Safari: 16,7 Mio.).
const MAX_NAH = 12e6;
// Ein Wisch mit dem Mausrad oder Trackpad zoomt um höchstens so viel.
const RAD_ZOOM = 50;

const stiftEinstellungen = (): Record<ZeichenWerkzeug, StiftEinstellung> => ({
  stift: einstellungPruefen('stift', gespeicherterWert('ueben:stift', null)),
  marker: einstellungPruefen('marker', gespeicherterWert('ueben:marker', null)),
  text: einstellungPruefen('text', gespeicherterWert('ueben:text', null)),
});

interface Props {
  noten: Stueck; pdf: PDFDocumentProxy; stellen: Stelle[];
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
  const [blaettern, setBlaettern] = useState<Blaettern>(() => blaetternLesen(noten.blaettern, seiten));
  // Im Mix immer die Stelle der Runde (siehe unten).
  const [eigenerModus, setModus] = useState<'lesen' | 'stellen'>(mix ? 'stellen' : 'lesen');
  const modus = mix ? 'stellen' : eigenerModus;
  const [paletteOffen, setPaletteOffen] = useState(false);
  // Freier Platz für die Seite (Innenmaß der Fläche, siehe unten).
  const [platz, setPlatz] = useState({ b: 0, h: 0 });
  // Blättern einstellen (Leiste unten, Blätterlinie zum Ziehen)
  const [linieEinstellen, setLinieEinstellen] = useState(false);
  // Zwei Seiten nebeneinander (B-13): je Gerät, wirkt im Querformat beim
  // Lesen; Anmerken und Blättern-Einstellen zeigen weiter eine Seite.
  const [zweiSeiten, setZweiSeiten] = useState(() => gespeicherterWert(ZWEI_SEITEN, false));
  const zweiSeitenSetzen = (an: boolean) => { setZweiSeiten(an); speichern(ZWEI_SEITEN, an); };
  const quer = platz.b > platz.h;
  const doppel = zweiSeiten && quer && !linieEinstellen && modus === 'lesen';
  const liste = useMemo(() => ansichten(seiten, blaettern.modus, blaettern.linien, blaettern.jeSeite, doppel), [seiten, blaettern, doppel]);
  // Sprünge (F-05): Marke am Sprungzeichen, Weiterblättern und Antippen führen
  // zur Einstiegsstelle — in der Reihenfolge der Liste.
  const [spruenge, setSpruenge] = useState(() => spruengeLaden(noten.spruenge, liste));
  const folge = useMemo(() => spielfolge(liste, spruenge), [liste, spruenge]);
  // Sprung setzen: geführt in drei Schritten (Zeile unten). Dabei blättert man
  // durch die Ansichten selbst (frei: zeige wandert), nicht durch die Spielfolge.
  const [setzen, setSetzen] = useState<Setzen | null>(null);
  const setzenAktiv = setzen !== null;
  // zeige: eine Ansicht außer der Reihe (siehe Stand in spielfolge.ts).
  const [pos, setPos] = useState(() => ({ schritt: 0, zeige: null as number | null, frei: false, liste, folge }));
  // Zustand im Rendern nachziehen (React-Muster): Sprünge oder Blättern
  // geändert, Setzen vorbei → dieselbe Ansicht im selben Durchgang; hat er
  // sie nicht, bleibt sie außer der Reihe zu sehen.
  const folgeNeu = pos.folge !== folge, setzenVorbei = pos.frei && !setzen;
  const nachgezogen: Stand = folgeNeu || setzenVorbei ? standUebertragen(pos.liste, pos.folge, pos, liste, folge) : pos;
  const frei = pos.frei && !setzenVorbei;
  if (folgeNeu || setzenVorbei) setPos({ schritt: nachgezogen.schritt, zeige: nachgezogen.zeige, frei, liste, folge });
  const schritt = Math.max(0, Math.min(nachgezogen.schritt, folge.length - 1));
  const zeige = nachgezogen.zeige === null ? null : Math.min(nachgezogen.zeige, liste.length - 1);
  const ansichtNr = zeige ?? folge[schritt]?.ansicht ?? 0;
  const ansicht: Ansicht = liste[ansichtNr];
  const zuStand = (st: Stand) => setPos({ schritt: st.schritt, zeige: st.zeige, frei: false, liste, folge });
  // Ganze Seite zeigen (zum Anmerken): im selben Durchgang, sonst außer der Reihe.
  const ganzeSeite = () => zuStand(standUebertragen(liste, folge, { schritt, zeige }, liste, folge, ansichtVonSeite(liste, hauptseite(ansicht))));
  const blaetternSpeichern = (b: Blaettern, seite = hauptseite(ansicht)) => {
    // Auf die ganze Seite, die gerade gilt (oder die eingestellte) — im selben
    // Durchgang; hat er sie nicht, bleibt sie außer der Reihe zu sehen (z. B. zum Linie-Ziehen).
    const l = ansichten(seiten, b.modus, b.linien, b.jeSeite, doppel), f = spielfolge(l, spruenge);
    const st = standUebertragen(liste, folge, { schritt, zeige }, l, f, ansichtVonSeite(l, seite));
    setPos({ schritt: st.schritt, zeige: st.zeige, frei, liste: l, folge: f });
    setBlaettern(b);
    stueckAendern(noten.id, { blaettern: b }).catch(speicherFehler);
  };

  // ── Modus: lesen oder Stelle für Stelle ── Im Mix immer die Stelle der Runde.
  const [stelleNr, setStelleNr] = useState(0);
  const stelle = mix ? stellen.find((s) => s.id === mix.stelle)
    : modus === 'stellen' ? stellen[Math.min(stelleNr, stellen.length - 1)] : undefined;
  const zumLesen = () => {
    // Die Seite der Stelle: der nächstliegende Schritt mit ihr.
    if (stelle) zuStand(standZu(folge, ansichtVonSeite(liste, stelle.seite), schritt));
    setModus('lesen');
  };

  // ── Werkzeuge ──
  const [werkzeug, setWerkzeug] = useState<Werkzeug | null>(null);
  // Jedes Werkzeug merkt sich Farbe und Dicke (E-01/E-02, Pencil-Muster).
  const [einst, setEinst] = useState<Record<ZeichenWerkzeug, StiftEinstellung>>(stiftEinstellungen);
  // Aus einer Sicherung übernommen, während das Stück offen ist.
  useEinstellungenGeladen(useCallback(() => setEinst(stiftEinstellungen()), []));
  const einstellen = (w: ZeichenWerkzeug, e: StiftEinstellung) => {
    setEinst((s) => ({ ...s, [w]: e }));
    speichern(`ueben:${w}`, e);
  };
  // Radierer-Breite (E-07) und die zuletzt mit der Pipette aufgenommenen
  // Farben (E-08) — je Gerät gemerkt wie Farbe und Dicke.
  const [radierBreite, setRadierBreite] = useState(() => radiererPruefen(gespeicherterWert('ueben:radierer', null)));
  const radiererEinstellen = (b: number) => { setRadierBreite(b); speichern('ueben:radierer', b); };
  const [pipetten, setPipetten] = useState<Pipetten>(() => pipettenPruefen(gespeicherterWert('ueben:pipette', null)));
  // Pipette an: Der nächste Tipp aufs Blatt nimmt die Farbe auf, statt zu zeichnen.
  const [farbeAufnehmen, setFarbeAufnehmen] = useState(false);
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
  // Anmerken und Zoomen gehen auf ganzen Seiten — auch auf der Doppelseite
  // (B-13): jeder Strich gehört der Seite, auf der er beginnt.
  const zeichenbar = zeichenSeite !== null || ansicht.art === 'doppel';

  // ── Größe: Seite so groß wie möglich in den freien Platz ──
  const flaeche = useRef<HTMLDivElement>(null);
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
    : ausschnittFuer(ausschnitte, stelle ? [stelle.seite] : seitenVon(ansicht)),
  [ausschnitte, bearbeitenSeite, stelle, ansicht]);
  // Beim Einstellen etwas kleiner: die Griffe an den Ecken bleiben greifbar.
  // Schnitte (E-12) gelten auf einer einzeln gezeigten ganzen Seite: Das Blatt
  // wird um die Lücken länger, die Seite behält ihre Koordinaten.
  const schnitteRoh = useMemo(() => (zeichenSeite !== null && bearbeitenSeite === null ? schnitteVon(anm[zeichenSeite] ?? []) : []), [zeichenSeite, bearbeitenSeite, anm]);
  // Dieselbe Liste behalten, solange sich nichts ändert: Teilstücke und
  // Darstellung bleiben dann dieselben Objekte, und ein neuer Strich kann
  // nachgezeichnet werden, statt das Blatt neu zu setzen (gleicheSchnitte).
  const [schnitteStabil, setSchnitteStabil] = useState(schnitteRoh);
  const schnitte = gleicheSchnitte(schnitteStabil, schnitteRoh) ? schnitteStabil : schnitteRoh;
  if (schnitte !== schnitteStabil) setSchnitteStabil(schnitte);
  const dehn = dehnung(schnitte);
  // Doppelseite (B-13): beide Seiten nebeneinander auf einem Blatt, lagen sagt, wo jede liegt.
  const darst = useMemo(() => {
    if (!platz.b || !platz.h) return null;
    const rand = bearbeitenSeite !== null ? 40 : 0;
    const p = { b: platz.b - rand, h: platz.h - rand };
    if (ansicht.art === 'doppel' && !stelle && bearbeitenSeite === null) return doppelDarstellung(p, format, ausschnitt);
    return { ...darstellung(p, format * dehn, schnitte.length ? rechteckGedehnt(schnitte, ausschnitt) : ausschnitt), lagen: null, luecke: null };
  }, [platz, format, ausschnitt, bearbeitenSeite, ansicht, stelle, schnitte, dehn]);
  const rahmen = darst?.rahmen ?? null;

  // ── Teilstücke des Blatts ── Jedes weiß, welche Seite (oder welche Lücke
  // eines Schnitts) es zeigt, welchen Höhenbereich davon, und wo die ganze
  // Seite auf dem Blatt läge (lage, Anteile des Blatts) bzw. wo es selbst zu
  // sehen ist (sicht). Zeichnen, Tippen, Marken — alles rechnet nur darüber.
  const stuecke = useMemo((): BlattStueck[] => {
    if (!darst) return [];
    const ganz = GANZES_BLATT;
    if (bearbeitenSeite !== null) return [{ seite: bearbeitenSeite, luecke: null, y0: 0, y1: 1, lage: ganz, sicht: ganz }];
    if (zeichenSeite !== null) {
      const seite = zeichenSeite, liste: BlattStueck[] = [];
      for (const t of teilstuecke(schnitte)) {
        liste.push({ seite, luecke: null, y0: t.y0, y1: t.y1, lage: { x: 0, y: t.versatz / dehn, b: 1, h: 1 / dehn }, sicht: { x: 0, y: (t.y0 + t.versatz) / dehn, b: 1, h: (t.y1 - t.y0) / dehn } });
      }
      for (const l of luecken(schnitte)) {
        liste.push({ seite, luecke: l.id, y0: 0, y1: l.abstand, lage: { x: 0, y: l.oben / dehn, b: 1, h: 1 / dehn }, sicht: { x: 0, y: l.oben / dehn, b: 1, h: l.abstand / dehn } });
      }
      return liste;
    }
    if (ansicht.art === 'doppel' && darst.lagen) {
      return [{ seite: ansicht.links, luecke: null, y0: 0, y1: 1, lage: darst.lagen.links, sicht: darst.lagen.links },
        { seite: ansicht.rechts, luecke: null, y0: 0, y1: 1, lage: darst.lagen.rechts, sicht: darst.lagen.rechts }];
    }
    if (ansicht.art === 'halb') {
      return [{ seite: ansicht.oben, luecke: null, y0: 0, y1: ansicht.schnitt, lage: ganz, sicht: { x: 0, y: 0, b: 1, h: ansicht.schnitt } },
        { seite: ansicht.unten, luecke: null, y0: ansicht.schnitt, y1: 1, lage: ganz, sicht: { x: 0, y: ansicht.schnitt, b: 1, h: 1 - ansicht.schnitt } }];
    }
    return [];
  }, [darst, bearbeitenSeite, zeichenSeite, schnitte, dehn, ansicht]);
  const hauptLage = stuecke[0]?.lage ?? GANZES_BLATT;
  // Ein Punkt des Blatts (Anteile) → Seite und Koordinaten dort (bzw. in der Lücke).
  const ortVon = useCallback((p: { x: number; y: number }): Ort | null => {
    const st = stuecke.find((q) => p.x >= q.sicht.x && p.x <= q.sicht.x + q.sicht.b && p.y >= q.sicht.y && p.y <= q.sicht.y + q.sicht.h);
    return st ? { stueck: st, seite: st.seite, luecke: st.luecke, x: (p.x - st.lage.x) / st.lage.b, y: (p.y - st.lage.y) / st.lage.h } : null;
  }, [stuecke]);
  // Umgekehrt: ein Punkt einer Seite (oder einer Lücke) aufs Blatt. Ein Punkt
  // genau auf einem Schnitt gehört zum Teil darüber.
  const stueckFuer = useCallback((seite: number, y: number, luecke: string | null) =>
    stuecke.find((q) => q.seite === seite && q.luecke === luecke && (luecke !== null || (y >= q.y0 && y <= q.y1)))
    ?? stuecke.find((q) => q.seite === seite && q.luecke === luecke), [stuecke]);
  const aufBlatt = useCallback((seite: number, x: number, y: number, luecke: string | null = null) => {
    const q = stueckFuer(seite, y, luecke);
    return q ? { x: q.lage.x + x * q.lage.b, y: q.lage.y + y * q.lage.h } : null;
  }, [stueckFuer]);
  const rechteckAufBlatt = useCallback((seite: number, r: Rechteck, luecke: string | null = null): Rechteck | null => {
    const q = stueckFuer(seite, r.y, luecke);
    return q ? blattRechteck(q.lage, r) : null;
  }, [stueckFuer]);

  // ── Sprünge ── Gespeichert am Stück; die Spielfolge rechnet sich neu.
  const spruengeSpeichern = (neu: Sprung[]) => {
    setSpruenge(neu);
    // Einträge einer neueren Version (unbekannte Art) reisen unverändert mit.
    stueckAendern(noten.id, { spruenge: spruengeSchreiben(neu, noten.spruenge) }).catch(speicherFehler);
  };
  // Welche der Weg nimmt — die übrigen stehen in der Liste grau.
  const genommen = useMemo(() => genommeneSpruenge(folge), [folge]);
  // Ring an der Einstiegsstelle nach einem Sprung (am Sprungzeichen, wenn es zurückgeht).
  const [blink, setBlink] = useState<(SprungPunkt & { n: number }) | null>(null);
  // n zählt hoch: ein neuer Ring beginnt sein Blinken von vorn.
  const blinken = useCallback((p: SprungPunkt) => setBlink((b) => ({ ...p, n: (b?.n ?? 0) + 1 })), []);
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
    const ankunft = ankunftSchritt(folge, s.id, schritt);
    zuStand(ankunft !== null ? { schritt: ankunft, zeige: null } : standZu(folge, ziel, schritt));
    blinken(s.nach);
  }
  function setzenStarten() {
    setSetzen({ schritt: 'von' });
    setPos({ schritt, zeige: ansichtNr, frei: true, liste, folge });
    setWerkzeug(null); setPaletteOffen(false); setLinieEinstellen(false); setAnsichtOffen(false);
    // Leisten weg: die ganze Seite ist antippbar, auch ganz oben.
    setLeisteWeg(true);
  }
  // Danach zurück in die Spielfolge (siehe oben, im Rendern).
  const setzenEnde = () => { setSetzen(null); setLeisteWeg(false); };
  function sprungSpeichern() {
    if (setzen?.schritt !== 'art') return;
    const { von, nach, art } = setzen;
    // Eingereiht, wo man ihn spielt (verschieben geht im Ansicht-Menü).
    spruengeSpeichern(sprungEinordnen(liste, spruenge, sprungNeu({ von, nach, art }, crypto.randomUUID())));
    // Zurück zum Sprungzeichen: die neue Marke blinkt kurz.
    if (!punktSichtbar(ansicht, von)) setPos({ schritt, zeige: ansichtVonSeite(liste, von.seite), frei: true, liste, folge });
    setzenEnde();
    blinken(von);
  }

  // ── Seiten einmal rendern, dann aus dem Zwischenspeicher zusammensetzen ──
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2.5);
  // Gerendert wird die ganze Seite in Blattgröße (beim Ausschnitt größer als der Rahmen).
  const px = darst ? Math.min(MAX_PX, Math.round(darst.blatt.b * dpr)) : 0;
  // Doppelseite: jede Seite nur so breit wie ihre Hälfte.
  const seitenBreite = Math.round(hauptLage.b * px);
  // Je Seite die nackte Seite und, stecken Markierungen im PDF, deren Ebene
  // (seiteMitEbene). Welche Seiten eine Ebene haben, merkt sich mitEbene —
  // nur dort hinterlässt der Radierer eine Radier-Spur.
  const cache = useRef(new Map<string, Promise<SeitenBild>>());
  const mitEbene = useRef(new Set<number>());
  const seiteBild = useCallback((s: number, breite = px) => {
    const key = `${s}@${breite}`;
    let p = cache.current.get(key);
    if (!p) {
      p = seiteMitEbene(pdf, s, breite).then((b) => { if (b.ebene) mitEbene.current.add(s); return b; });
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
  // Was außer Seiten und Anmerkungen aufs Blatt kommt — für das ganze Blatt
  // und den scharfen Ausschnitt beim Zoomen gleich.
  const extras = useMemo(() => ({
    // Rahmen der Stellen nur bei offener Stift-Palette (B-11): beim Lesen stören sie.
    stellen: !stelle && paletteOffen ? stellen : [],
    schnitt: ansicht.art === 'halb' && !stelle ? ansicht.schnitt : null,
    hervor: stelle && bearbeitenSeite === null ? (rechteckAufBlatt(stelle.seite, mitRand(stelle, RAND)) ?? mitRand(stelle, RAND)) : null,
    // Palette offen: Lücken und Sticker mit Rand (zum Anfassen).
    bearbeitbar: paletteOffen,
  }), [stelle, paletteOffen, stellen, ansicht, bearbeitenSeite, rechteckAufBlatt]);
  // Quellbilder der Sticker (je Quellseite), auch für den scharfen Ausschnitt beim Zoomen.
  const quellenRef = useRef<Map<number, SeitenBild>>(new Map());
  // Was die Leinwand gerade zeigt — für das Nachzeichnen einzelner Striche.
  const gezeichnet = useRef<{ stuecke: BlattStueck[]; extras: unknown; darst: unknown; px: number; anm: Record<number, Anmerkung[]> } | null>(null);
  const nahGezeichnet = useRef<{ nah: unknown; extras: unknown; anm: Record<number, Anmerkung[]> } | null>(null);
  useEffect(() => {
    const c = leinwand.current;
    if (!c || !rahmen || !px || !darst || !stuecke.length) return;
    let weg = false;
    const W = px, H = Math.round(px * darst.blatt.h / darst.blatt.b);
    const inPx = (l: SeitenLage) => ({ x: Math.round(l.x * W), y: Math.round(l.y * H), b: Math.round(l.b * W), h: Math.round(l.h * H) });
    // Nur ein Strich (Text) dazugekommen, sonst alles gleich: ihn nachzeichnen
    // statt das ganze Blatt neu zu setzen — das hielt das Schreiben auf.
    const g = gezeichnet.current;
    if (g && g.stuecke === stuecke && g.extras === extras && g.darst === darst && g.px === px && c.width === W && c.height === H) {
      const dazu = nurAngehaengt(g.anm, anm);
      if (dazu) {
        const ctx = c.getContext('2d')!;
        for (const q of stuecke) {
          const neu = dazu.get(q.seite);
          if (!neu?.length) continue;
          const S = inPx(q.lage);
          ctx.save();
          ctx.beginPath(); ctx.rect(S.x, S.y + q.y0 * S.h, S.b, (q.y1 - q.y0) * S.h); ctx.clip();
          anmerkungenZeichnen(ctx, neu, S.x, S.y, S.b, S.h, q.luecke);
          ctx.restore();
        }
        gezeichnet.current = { ...g, anm };
        return;
      }
    }
    const zeichnen = async () => {
      const ganz = { x: 0, y: 0, b: W, h: H };
      // Je Teilstück: Seite oder Lücke, Höhenbereich, wo die ganze Seite liegt (dort auch ihr Bild).
      const teile = stuecke.map((q) => ({ seite: q.seite, luecke: q.luecke, y0: q.y0, y1: q.y1, lage: inPx(q.lage), blattLage: inPx(q.lage) }));
      const bilder = await Promise.all(teile.map((t) => (t.luecke ? null : seiteBild(t.seite, t.lage.b))));
      // Sticker holen ihr Bild von der Quellseite (in der Breite der gezeigten Seiten).
      const quellSeiten = new Set(stuecke.flatMap((q) => (anm[q.seite] ?? []).filter(istSticker).map((st) => st.von.seite)));
      const quellen = new Map(await Promise.all([...quellSeiten].map(async (n) => [n, await seiteBild(n, Math.round(hauptLage.b * W))] as const)));
      if (weg) return;
      quellenRef.current = quellen;
      // Nur bei anderer Größe neu anlegen — jedes Setzen leert und reserviert die Leinwand neu.
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      blattZeichnen(c.getContext('2d')!, ganz,
        teile.map((t, i): BlattTeil => ({ ...t, bild: bilder[i]?.seite ?? null, ebene: bilder[i]?.ebene ?? null })),
        anm, { ...extras, luecke: darst.lagen ? inPx(darst.luecke) : null, quellen }, () => (hilfe.current ??= document.createElement('canvas')));
      gezeichnet.current = { stuecke, extras, darst, px, anm };
    };
    gezeichnet.current = null;
    zeichnen().catch((e) => { if (!weg) console.error('Seite ließ sich nicht zeichnen', e); });
    return () => { weg = true; };
  }, [stuecke, anm, extras, rahmen, px, seiteBild, darst, hauptLage]);

  // ── Zoom beim Anmerken (E-06) ── Bei offener Stift-Palette auf einer ganzen
  // Seite — oder immer (E-10, Ansicht → „Immer zoomen“), auch beim Lesen.
  // Zwei Finger zoomen und schieben, ein Finger schiebt, solange gezoomt ist;
  // am Rechner Strg + Rad bzw. Trackpad und die Knöpfe. Andere Seite,
  // Palette zu (ohne „Immer zoomen“), andere Fenstergröße: wieder ganz.
  const rahmenEl = useRef<HTMLDivElement>(null);
  const [zoomImmer, setZoomImmer] = useState(() => gespeicherterWert(ZOOM_IMMER, false));
  useEinstellungenGeladen(useCallback(() => setZoomImmer(gespeicherterWert(ZOOM_IMMER, false)), []));
  const zoomImmerSetzen = (an: boolean) => { setZoomImmer(an); speichern(ZOOM_IMMER, an); };
  const zoomSchluessel = (paletteOffen || zoomImmer) && zeichenbar && bearbeitenSeite === null && rahmen
    ? `${stelle?.seite ?? hauptseite(ansicht)}:${stelle?.id ?? ''}:${rahmen.b}x${rahmen.h}` : null;
  const zoomAktiv = zoomSchluessel !== null;
  const [zoom, setZoom] = useState<Zoom>(OHNE_ZOOM);
  const [zoomFuer, setZoomFuer] = useState(zoomSchluessel);
  if (zoomSchluessel !== zoomFuer) { setZoomFuer(zoomSchluessel); setZoom(OHNE_ZOOM); }
  // Während einer Geste läuft der Zoom an React vorbei (flüssig); festgelegt
  // wird er am Ende (zoom), dann folgt der scharfe Ausschnitt.
  const zoomLive = useRef<Zoom>(OHNE_ZOOM);
  const zoomZeigen = useCallback((z: Zoom) => {
    zoomLive.current = z;
    const el = rahmenEl.current;
    if (el) el.style.transform = z.z === 1 && !z.x && !z.y ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.z})`;
  }, []);
  useLayoutEffect(() => { zoomZeigen(zoom); }, [zoom, rahmen, zoomZeigen]);
  // Mitte des Rahmens in Ruhelage (Bildschirm): Bezugspunkt aller Zoom-Rechnungen.
  const rahmenMitte = useCallback((): Punkt => {
    const f = flaeche.current!.getBoundingClientRect(), r = rahmenEl.current!;
    return { x: f.left + r.offsetLeft + r.offsetWidth / 2, y: f.top + r.offsetTop + r.offsetHeight / 2 };
  }, []);
  const zoomKnopf = (mal: number) => setZoom(rahmen ? zoomenUm(zoomLive.current, mal, { x: 0, y: 0 }, rahmen) : OHNE_ZOOM);

  // Mausrad und Trackpad: Strg (Mac: auch Zwei-Finger-Zoom) zoomt um den
  // Zeiger, ohne Strg schiebt es das gezoomte Blatt — statt zu blättern.
  // Eigener Hörer: React meldet Rad-Ereignisse passiv, die Seite würde sonst
  // mitzoomen. Safari am Mac schickt Zwei-Finger-Zoom als „gesture“-Ereignisse.
  const zoomRef = useRef({ aktiv: false, rahmen: null as typeof rahmen });
  useEffect(() => { zoomRef.current = { aktiv: zoomAktiv, rahmen }; });
  const finger = useRef(new Map<number, Punkt>());
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    let festlegen = 0;
    const spaeterFestlegen = () => {
      window.clearTimeout(festlegen);
      festlegen = window.setTimeout(() => setZoom(einrasten(zoomLive.current)), 160);
    };
    const rad = (e: WheelEvent) => {
      const { aktiv, rahmen: r } = zoomRef.current;
      if (!aktiv || !r) return;
      const z = zoomLive.current, weg = (d: number) => radWeg(d, e.deltaMode, window.innerHeight);
      if (e.ctrlKey || e.metaKey) {
        const m = rahmenMitte(), d = Math.max(-RAD_ZOOM, Math.min(RAD_ZOOM, weg(e.deltaY)));
        zoomZeigen(zoomenUm(z, Math.exp(-d / 100), { x: e.clientX - m.x, y: e.clientY - m.y }, r));
      } else if (z.z > 1) {
        zoomZeigen(begrenzen({ ...z, x: z.x - weg(e.deltaX), y: z.y - weg(e.deltaY) }, r));
      } else return;
      e.preventDefault();
      e.stopPropagation();
      spaeterFestlegen();
    };
    let gesteStart = OHNE_ZOOM;
    const geste = (e: Event) => {
      const { aktiv, rahmen: r } = zoomRef.current;
      if (!aktiv || !r) return;
      e.preventDefault();
      // iPad: Finger kommen als Zeiger-Ereignisse (unten), hier nichts doppelt.
      if (finger.current.size) return;
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      if (e.type === 'gesturestart') gesteStart = zoomLive.current;
      else if (e.type === 'gesturechange') {
        const m = rahmenMitte();
        zoomZeigen(zoomenUm(gesteStart, g.scale, { x: g.clientX - m.x, y: g.clientY - m.y }, r));
      } else setZoom(einrasten(zoomLive.current));
    };
    el.addEventListener('wheel', rad, { passive: false });
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(t, geste);
    return () => {
      window.clearTimeout(festlegen);
      el.removeEventListener('wheel', rad);
      for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.removeEventListener(t, geste);
    };
  }, [rahmenMitte, zoomZeigen]);

  // Scharfer Ausschnitt: Gezoomt wäre das Blatt nur vergrößert und unscharf.
  // Kurz nach dem Zoomen wird der sichtbare Teil (mit etwas Rand) in
  // Bildschirmschärfe gerendert und über das Blatt gelegt.
  const [nah, setNah] = useState<{ seite: number; r: Rechteck; bild: SeitenBild } | null>(null);
  // Nur für eine einzelne Seite ohne Schnitte (Doppelseite und Lücken bleiben in Blattschärfe).
  const nahGilt = !!nah && zoomAktiv && zoom.z > 1 && nah.seite === zeichenSeite && !schnitte.length;
  if (nah && !nahGilt) setNah(null);
  useEffect(() => () => {
    // Abgelöst oder nicht mehr gebraucht: Leinwand-Speicher gleich freigeben (Safari).
    if (nah) for (const c of [nah.bild.seite, nah.bild.ebene]) if (c) { c.width = 0; c.height = 0; }
  }, [nah]);
  useEffect(() => {
    if (!zoomAktiv || zoom.z <= 1 || !darst || zeichenSeite === null || !px || schnitte.length) return;
    const r = sichtbarerTeil(zoom, platz, darst.rahmen, darst.blatt, 0.15);
    if (!r) return;
    let seitenPx = darst.blatt.b * zoom.z * Math.min(dpr, 2);
    // Schärfer als das ganze Blatt ohnehin ist? Sonst lohnt es nicht.
    if (seitenPx <= px * 1.1) return;
    const groesse = r.b * r.h * seitenPx * seitenPx * format;
    if (groesse > MAX_NAH) seitenPx *= Math.sqrt(MAX_NAH / groesse);
    let weg = false, abbrechen = () => {};
    const t = window.setTimeout(() => {
      const auftrag = ausschnittRendern(pdf, zeichenSeite, seitenPx, r);
      abbrechen = auftrag.abbrechen;
      auftrag.bild.then((bild) => {
        if (weg) { for (const c of [bild.seite, bild.ebene]) if (c) { c.width = 0; c.height = 0; } return; }
        setNah({ seite: zeichenSeite, r, bild });
      }, (x) => { if (!weg) console.error('Ausschnitt ließ sich nicht schärfen', x); });
    }, 120);
    return () => { weg = true; window.clearTimeout(t); abbrechen(); };
  }, [zoomAktiv, zoom, platz, darst, zeichenSeite, px, dpr, format, pdf, schnitte]);
  const nahLeinwand = useRef<HTMLCanvasElement>(null);
  const nahHilfe = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    // Ganz herausgezoomt: auch die Leinwand des Ausschnitts gleich freigeben.
    const c = nahLeinwand.current;
    return () => { for (const x of [c, nahHilfe.current]) if (x) { x.width = 0; x.height = 0; } };
  }, [nahGilt]);
  useEffect(() => {
    const c = nahLeinwand.current;
    if (!c || !nah || !nahGilt) return;
    const { seite, ebene } = nah.bild, r = nah.r;
    const W = seite.width / r.b, H = seite.height / r.h;
    const g = nahGezeichnet.current;
    if (g && g.nah === nah && g.extras === extras && c.width === seite.width && c.height === seite.height) {
      const dazu = nurAngehaengt(g.anm, anm)?.get(nah.seite);
      if (dazu) {
        if (dazu.length) anmerkungenZeichnen(c.getContext('2d')!, dazu, -r.x * W, -r.y * H, W, H);
        nahGezeichnet.current = { ...g, anm };
        return;
      }
    }
    c.width = seite.width; c.height = seite.height;
    blattZeichnen(c.getContext('2d')!, { x: -r.x * W, y: -r.y * H, b: W, h: H },
      [{ seite: nah.seite, y0: 0, y1: 1, bild: seite, ebene, lage: { x: 0, y: 0, b: seite.width, h: seite.height } }],
      anm, { ...extras, quellen: quellenRef.current }, () => (nahHilfe.current ??= document.createElement('canvas')));
    nahGezeichnet.current = { nah, extras, anm };
  }, [nah, nahGilt, anm, extras]);

  // Nachbarseiten vorab rendern: Blättern ohne Wartezeit — auch die Zielseite,
  // wenn Weiterblättern als Nächstes springt.
  const naechster = folge[schritt + 1];
  const sprungSeite = naechster?.ankunft ? hauptseite(liste[naechster.ansicht]) : 0;
  useEffect(() => {
    if (!px) return;
    const s = sichtbareSeite;
    for (const n of [s + 1, s + 2, s - 1, sprungSeite]) if (n >= 1 && n <= seiten) void seiteBild(n, seitenBreite || px);
  }, [sichtbareSeite, sprungSeite, seiten, px, seitenBreite, seiteBild]);

  // ── Navigation ── Lesen: Schritt für Schritt durch die Spielfolge; beim
  // Sprung-Setzen durch die Ansichten selbst.
  const weiter = useCallback(() => {
    if (mix) mix.weiter();
    else if (modus === 'stellen') setStelleNr((n) => Math.min(stellen.length - 1, n + 1));
    else if (frei) setPos({ schritt, zeige: Math.min(liste.length - 1, ansichtNr + 1), frei, liste, folge });
    else {
      const neu = weiterGehen(folge, { schritt, zeige });
      if (neu.schritt === schritt && neu.zeige === zeige) return;
      setPos({ schritt: neu.schritt, zeige: neu.zeige, frei, liste, folge });
      // Per Sprung angekommen: Ring an der Einstiegsstelle.
      const s = neu.schritt > schritt ? spruenge.find((x) => x.id === folge[neu.schritt].ankunft) : undefined;
      if (s) blinken(s.nach);
    }
  }, [mix, modus, stellen.length, frei, schritt, zeige, ansichtNr, liste, folge, spruenge, blinken]);
  const zurueck = useCallback(() => {
    if (mix) { if (mix.nr > 1) mix.zurueck(); }
    else if (modus === 'stellen') setStelleNr((n) => Math.max(0, n - 1));
    else if (frei) setPos({ schritt, zeige: Math.max(0, ansichtNr - 1), frei, liste, folge });
    else {
      const neu = zurueckGehen(folge, { schritt, zeige });
      if (neu.schritt === schritt && neu.zeige === zeige) return;
      setPos({ schritt: neu.schritt, zeige: neu.zeige, frei, liste, folge });
      // Über den Sprung zurück: Ring am Sprungzeichen.
      const s = neu.schritt < schritt ? spruenge.find((x) => x.id === folge[schritt].ankunft) : undefined;
      if (s) blinken(s.von);
    }
  }, [mix, modus, frei, schritt, zeige, ansichtNr, liste, folge, spruenge, blinken]);

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
  // Blättern Seite für Seite einstellen (Leiste unten, Blätterlinie zum Ziehen)
  // „Für alle n Seiten“ beim Blättern: an, solange alle gleich blättern (gesetzt beim Öffnen des Menüs).
  const [fuerAlle, setFuerAlle] = useState(true);

  useEffect(() => {
    if (!tastenAktiv || stelleBlatt || bearbeitenSeite !== null) return;
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      // Leertaste auf einem Bedienelement aktiviert es, statt zu blättern.
      if (e.key === ' ' && (e.target as HTMLElement).closest('button, a, select, summary, [role="dialog"]')) return;
      // Bluetooth-Blätterpedale senden meist Pfeil- oder Bild-Tasten.
      const a = tastenAktion(e.key);
      if (a) { e.preventDefault(); blaetternNach(a); }
      if (e.key === 'Escape' && farbeAufnehmen) setFarbeAufnehmen(false);
      else if (e.key === 'Escape' && werkzeug) setWerkzeug(null);
      if (e.key === 'Escape' && setzenAktiv) { setSetzen(null); setLeisteWeg(false); }
      if (e.key === 'Escape' && linieEinstellen) { setLinieEinstellen(false); setLeisteWeg(false); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [blaetternNach, werkzeug, farbeAufnehmen, tastenAktiv, stelleBlatt, bearbeitenSeite, setzenAktiv, linieEinstellen, setLeisteWeg]);

  // ── Zeiger: zeichnen oder blättern ──
  const blatt = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  // zeichnen, tippen/wischen (blättern) oder — gezoomt — das Blatt schieben.
  // marke: der Zug begann auf der Marke dieses Sprungs (Tippen springt, Wischen blättert).
  // seite/luecke/lage: wo ein Strich begann — alle seine Punkte werden darüber umgerechnet.
  // schnitt/sticker (Schere, E-12): vorher = Stand der Seite vor dem Zug (für Rückgängig).
  const zug = useRef<{
    art: 'zeichnen' | 'tippen' | 'schieben' | 'schnitt' | 'sticker'; punkte: number[]; x: number; y: number; t: number; id: number; start: Zoom; marke?: string | null;
    seite?: number; luecke?: string | null; lage?: SeitenLage; vorher?: Anmerkung[]; objektId?: string; abstand0?: number; jetzt?: Anmerkung[];
    sticker?: Sticker; griff?: 'bewegen' | 'groesse'; blattStart?: { x: number; y: number }; abstandJetzt?: number;
  } | null>(null);
  // Schnitt ziehen (E-12): nur eine Vorschau — gerendert wird erst beim Loslassen.
  const [schnittVorschau, setSchnittVorschau] = useState<{ seite: number; y: number; abstand: number } | null>(null);
  // Sticker ziehen: ebenso nur eine Vorschau (Bild des Stickers, einmal beim
  // Anfassen gezeichnet) — das Blatt wird erst beim Loslassen neu gezeichnet.
  // Die Lage läuft an React vorbei (Ref), damit jede Bewegung billig ist.
  const [stickerVorschau, setStickerVorschau] = useState<{ bild: string; rahmen: Rechteck } | null>(null);
  const stickerVorschauEl = useRef<HTMLDivElement>(null);
  // Zwei Finger beim Zoomen: wo sie aufsetzten (von der Rahmenmitte aus).
  const zweiGriff = useRef<{ ids: [number, number]; a: Punkt; b: Punkt; start: Zoom; mitte: Punkt } | null>(null);
  // Die Leinwand des laufenden Strichs: gezoomt nur der sichtbare Teil, in
  // Bildschirmschärfe (r: Teil der Seite, W: Seitenbreite in Pixeln).
  const liveLage = useRef<{ r: Rechteck; W: number }>({ r: VOLL, W: 0 });
  const liveGezeichnet = useRef(0);
  // Radierer als Kreis unter Stift oder Maus, in seiner Breite.
  const radierKreis = useRef<HTMLSpanElement>(null);
  const [rechteckEntwurf, setRechteckEntwurf] = useState<Rechteck | null>(null);
  // Nach einem Tipp, den die Fläche selbst ausführt (Sprung, Punkt setzen,
  // Blättern, Leisten), schickt der Browser noch mousedown und click an die
  // Stelle unter dem Finger. Dort liegt jetzt womöglich eine Marke oder ein
  // Knopf der Setzen-Zeile: diesen Nachzügler schlucken. Der nächste Druck
  // (pointerdown) gehört zu einem neuen Zug und hebt das auf.
  const nachzueglerBis = useRef(0);
  const nachzueglerSchlucken = useCallback(() => { nachzueglerBis.current = performance.now() + 1000; }, []);
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
  // Kurze Rückmeldung in der Unterzeile der Stellen-Leiste.
  const meldungsUhr = useRef(0);
  const melden = (text: string, dauer = 1600) => {
    setGespeichert(text);
    window.clearTimeout(meldungsUhr.current);
    meldungsUhr.current = window.setTimeout(() => setGespeichert(null), dauer);
  };
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
    melden(`Gespeichert: ${bpm} geschafft${amZiel === 'reserve' ? ' — Ziel mit Reserve!' : amZiel === 'ziel' ? ' — Ziel erreicht!' : ''}`);
  }
  // Favorit (★) setzen oder nehmen. Abgewählt bleibt `false` stehen (siehe
  // stelleFavorit). Im Mix mit „nur Favoriten“ bleibt die Stelle in der Runde.
  async function favoritUmschalten(s: Stelle) {
    const an = !stelleFavorit(s);
    try { await stelleAendern(s.id, { favorit: an }); } catch (x) { speicherFehler(x); return; }
    geaendert();
    // Kurz genug für die Unterzeile auf dem iPhone (höchstens 30 Zeichen).
    melden(an ? '★ Favorit gesetzt' : mix?.bereich.favoriten ? 'Ab nächster Runde nicht dabei' : 'Kein Favorit mehr', 2500);
  }
  const [neueStelle, setNeueStelle] = useState<(Rechteck & { seite: number }) | null>(null);
  // Schere (E-12): Sticker oder Schnitt; der gewählte Sticker (zum Verschieben, Größe, Löschen, Seite wechseln).
  const [schereModus, setSchereModus] = useState<SchereModus>('sticker');
  const [stickerWahlRoh, setStickerWahl] = useState<{ seite: number; id: string } | null>(null);
  // Gewählt nur, solange die Schere das Werkzeug ist.
  const stickerWahl = werkzeug === 'schere' ? stickerWahlRoh : null;
  const gewaehlterSticker = stickerWahl ? (anm[stickerWahl.seite] ?? []).find((o): o is Sticker => o.id === stickerWahl.id && o.art === 'sticker') : undefined;
  const [stelleTitel, setStelleTitel] = useState('');
  const [stelleZiel, setStelleZiel] = useState('');
  const [textEingabe, setTextEingabe] = useState<{ seite: number; luecke: string | null; x: number; y: number; text: string; seit: number } | null>(null);
  const [linieZiehen, setLinieZiehen] = useState(false);

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
    werkzeug !== null && zeichenbar && (e.pointerType !== 'touch' || fingerZeichnen || werkzeug === 'stelle' || werkzeug === 'text' || werkzeug === 'schere');

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

  function liveVorbereiten() {
    const c = live.current, el = blatt.current;
    if (!c || !el) return;
    const z = zoomLive.current;
    const r = z.z > 1 && darst ? sichtbarerTeil(z, platz, darst.rahmen, darst.blatt) ?? VOLL : VOLL;
    // Blattgröße: beim Ausschnitt größer als der sichtbare Rahmen.
    let W = el.offsetWidth * z.z * dpr;
    const groesse = r.b * r.h * W * W * (el.offsetHeight / el.offsetWidth);
    if (groesse > MAX_NAH) W *= Math.sqrt(MAX_NAH / groesse);
    liveLage.current = { r, W };
    Object.assign(c.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` });
    // Einmal je Strich anlegen — jedes Setzen von width/height legt die Leinwand neu an und ist auf dem iPad teuer.
    const H = W * (el.offsetHeight / el.offsetWidth);
    c.width = Math.round(r.b * W); c.height = Math.round(r.h * H);
    liveGezeichnet.current = 0;
  }
  // Stift: nur die neuen Punkte nachzeichnen (deckend, Überlappung unsichtbar);
  // Marker: halbtransparent, darum ganz neu — seine Striche sind kurz.
  function liveZeichnen() {
    const c = live.current, z = zug.current, el = blatt.current;
    if (!c || !z || !el) return;
    const { r, W } = liveLage.current, H = W * (el.offsetHeight / el.offsetWidth);
    const ctx = c.getContext('2d')!;
    // Die Seite des Strichs liegt bei z.lage auf dem Blatt (Doppelseite, Teilstück, Lücke).
    const L = z.lage ?? GANZES_BLATT, b = W * L.b, h = H * L.h, x0 = -r.x * W + L.x * W, y0 = -r.y * H + L.y * H;
    if (werkzeug === 'stift') {
      const ab = Math.max(0, liveGezeichnet.current - 4);
      strichZeichnen(ctx, ab ? z.punkte.slice(ab) : z.punkte, einst.stift.farbe, einst.stift.breite * b, x0, y0, b, h);
      liveGezeichnet.current = z.punkte.length;
    }
    if (werkzeug === 'marker') {
      ctx.clearRect(0, 0, c.width, c.height);
      strichZeichnen(ctx, z.punkte, einst.marker.farbe, einst.marker.breite * b, x0, y0, b, h, true);
    }
  }
  const liveLeeren = () => { const c = live.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); };

  function kreisZeigen(e: React.PointerEvent | null) {
    const k = radierKreis.current;
    if (!k) return;
    if (!e || werkzeug !== 'radierer' || !zeichenbar) { k.style.display = 'none'; return; }
    const p = relativ(e);
    Object.assign(k.style, { display: 'block', left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${radierBreite * hauptLage.b * 100}%` });
  }

  // Pipette (E-08): die Farbe unter dem Finger aus der schärfsten Leinwand —
  // beim Zoomen dem Ausschnitt, sonst dem Blatt —, samt PDF und Markierungen.
  function farbeNehmen(e: React.PointerEvent) {
    const w = werkzeug;
    if (w !== 'stift' && w !== 'marker' && w !== 'text') { setFarbeAufnehmen(false); return; }
    const p = relativ(e);
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return; // neben der Seite: nichts aufzunehmen
    let c = leinwand.current, x = p.x, y = p.y;
    if (nahGilt && nah && nahLeinwand.current && p.x >= nah.r.x && p.x <= nah.r.x + nah.r.b && p.y >= nah.r.y && p.y <= nah.r.y + nah.r.h) {
      c = nahLeinwand.current; x = (p.x - nah.r.x) / nah.r.b; y = (p.y - nah.r.y) / nah.r.h;
    }
    if (!c) return;
    // Über eine kleine eigene Leinwand gelesen: Das Blatt selbst bleibt fürs
    // Zeichnen eingerichtet (kein Zurücklesen aus seinem Speicher).
    const kante = 5, probe = document.createElement('canvas');
    probe.width = kante; probe.height = kante;
    const pc = probe.getContext('2d')!;
    pc.drawImage(c, Math.round(x * c.width) - 2, Math.round(y * c.height) - 2, kante, kante, 0, 0, kante, kante);
    const daten = pc.getImageData(0, 0, kante, kante).data;
    const punkt = pipettenPunkt(daten, kante);
    if (!punkt) return;
    const farbe = pipettenFarbe(w, punkt);
    einstellen(w, { ...einst[w], farbe });
    const neu = { ...pipetten, [w]: farbe };
    setPipetten(neu);
    speichern('ueben:pipette', neu);
    setFarbeAufnehmen(false);
  }

  // Zwei Finger setzen auf: zoomen. Was der erste angefangen hatte, endet —
  // ein Strich verfällt, ein Radier-Wisch wird gespeichert.
  function zweiFingerAnfangen() {
    const [[ia, a], [ib, b]] = [...finger.current.entries()];
    zugAbbrechen();
    const m = rahmenMitte();
    zweiGriff.current = { ids: [ia, ib], a: { x: a.x - m.x, y: a.y - m.y }, b: { x: b.x - m.x, y: b.y - m.y }, start: zoomLive.current, mitte: m };
  }
  function zugAbbrechen() {
    const z = zug.current;
    zug.current = null;
    if (z?.art === 'zeichnen' && werkzeug === 'radierer' && z.seite !== undefined) radierEnde(z.seite);
    if (z?.art === 'schnitt') setSchnittVorschau(null);
    if (z?.art === 'sticker') setStickerVorschau(null);
    if (z?.art === 'schieben') setZoom(einrasten(zoomLive.current));
    liveLeeren();
    setRechteckEntwurf(null);
  }

  function runter(e: React.PointerEvent) {
    if (textEingabe) { textSpeichern(); return; } // Tippen daneben übernimmt den Text
    if (neueStelle || bearbeiten) return;
    if (zoomAktiv && e.pointerType === 'touch') {
      finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (finger.current.size >= 2) {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (finger.current.size === 2) zweiFingerAnfangen();
        return;
      }
    }
    if (farbeAufnehmen) { e.preventDefault(); farbeNehmen(e); return; }
    const p = relativ(e);
    radierWisch.current = false;
    radierSpur.current = null;
    radierLetzter.current = null;
    const o = darfZeichnen(e) ? ortVon(p) : null;
    if (o && werkzeug === 'schere') {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, start: zoomLive.current, seite: o.seite, lage: o.stueck.lage, vorher: anm[o.seite] ?? [] };
      // Auf einen Sticker getippt: anfassen und verschieben.
      const getroffen = (anm[o.seite] ?? []).filter(istSticker).find((st) => (st.luecke ?? null) === o.luecke && stickerGetroffen(st, o.x, o.y));
      if (getroffen) {
        setStickerWahl({ seite: o.seite, id: getroffen.id });
        const r0 = rechteckAufBlatt(o.seite, stickerRechteck(getroffen), getroffen.luecke ?? null);
        zug.current = { ...start, art: 'sticker', punkte: [], objektId: getroffen.id, sticker: getroffen, griff: 'bewegen', blattStart: r0 ? { x: r0.x, y: r0.y } : undefined };
        stickerVorschauStarten(o.seite, getroffen);
      } else if (schereModus === 'sticker') {
        setStickerWahl(null);
        if (!o.luecke) zug.current = { ...start, art: 'zeichnen', punkte: [o.x, o.y], luecke: null };
      } else {
        // Schnitt: in einer Lücke deren Abstand ziehen, sonst einen neuen Schnitt setzen.
        setStickerWahl(null);
        const schnitt = o.luecke ? schnitte.find((x) => x.id === o.luecke) : undefined;
        zug.current = { ...start, art: 'schnitt', punkte: [o.x, schnitt ? schnitt.y : o.y], objektId: schnitt?.id ?? crypto.randomUUID(), abstand0: schnitt?.abstand ?? 0 };
      }
    } else if (o && !(werkzeug === 'stelle' && o.luecke)) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      zug.current = { art: 'zeichnen', punkte: [o.x, o.y], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, start: zoomLive.current, seite: o.seite, luecke: o.luecke, lage: o.stueck.lage };
      if (werkzeug === 'stift' || werkzeug === 'marker') liveVorbereiten();
      if (werkzeug === 'radierer') { kreisZeigen(e); radieren(o.seite, o.luecke, o.x, o.y); }
    } else {
      if (werkzeug === 'schere') setStickerWahl(null);
      // Festhalten: Auch ein Wisch als Maus-Zeiger (Scroll-Ring über
      // AssistiveTouch), der über den Rand hinausläuft, endet hier.
      e.currentTarget.setPointerCapture(e.pointerId);
      // Gezoomt schiebt der Finger das Blatt, statt zu blättern.
      const art = zoomAktiv && zoomLive.current.z > 1 ? 'schieben' : 'tippen';
      const marke = (e.target as Element).closest?.('[data-sprung]')?.getAttribute('data-sprung') ?? null;
      zug.current = { art, punkte: [], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, start: zoomLive.current, marke };
    }
  }
  // Liegt der Punkt im sichtbaren Rahmen (beim Ausschnitt ragt das Blatt darüber hinaus)?
  const imRahmen = (x: number, y: number) => {
    const r = blatt.current?.parentElement?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  function bewegen(e: React.PointerEvent) {
    if (finger.current.has(e.pointerId)) {
      finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = zweiGriff.current;
      if (g) {
        const a = finger.current.get(g.ids[0]), b = finger.current.get(g.ids[1]);
        if (a && b && rahmen) {
          const rel = (q: Punkt) => ({ x: q.x - g.mitte.x, y: q.y - g.mitte.y });
          zoomZeigen(zweiFinger(g.start, g.a, g.b, rel(a), rel(b), rahmen));
        }
        return;
      }
    }
    const z = zug.current;
    if (!z || e.pointerId !== z.id) { if (e.pointerType !== 'touch') kreisZeigen(e); return; }
    if (z.art === 'schieben') {
      if (rahmen) zoomZeigen(begrenzen({ ...z.start, x: z.start.x + e.clientX - z.x, y: z.start.y + e.clientY - z.y }, rahmen));
      return;
    }
    if (z.art === 'schnitt') { schnittZiehen(z, e.clientY); return; }
    if (z.art === 'sticker') { stickerZiehen(z, e.clientX, e.clientY); return; }
    if (z.art !== 'zeichnen') return;
    const ereignisse = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of ereignisse) {
      const p = aufSeiteVon(z.lage ?? GANZES_BLATT, relativ(ev));
      if (werkzeug === 'radierer') radieren(z.seite!, z.luecke ?? null, p.x, p.y);
      else if (werkzeug === 'stelle' || werkzeug === 'schere') setRechteckEntwurf(blattRechteck(z.lage ?? GANZES_BLATT, rechteckAus(z.punkte[0], z.punkte[1], p.x, p.y)));
      else z.punkte.push(p.x, p.y);
    }
    if (werkzeug === 'radierer') kreisZeigen(e);
    if (werkzeug === 'stift' || werkzeug === 'marker') liveZeichnen();
  }
  function hoch(e: React.PointerEvent) {
    if (finger.current.delete(e.pointerId) && zweiGriff.current) {
      // Ein Finger hebt ab: der Zoom steht. Der andere tut danach nichts mehr.
      if (finger.current.size < 2) { zweiGriff.current = null; setZoom(einrasten(zoomLive.current)); }
      return;
    }
    const z = zug.current;
    zug.current = null;
    if (e.pointerType === 'touch') kreisZeigen(null);
    if (!z) return;
    if (z.art === 'schieben') {
      setZoom(einrasten(zoomLive.current));
      // Gezoomt schiebt der Finger; nur ein Tipp blättert am Rand bzw. zeigt
      // die Leisten — sonst käme man beim Lesen (E-10) nicht mehr weiter.
      if (zeigerGeste(e.clientX - z.x, e.clientY - z.y, e.timeStamp - z.t).art !== 'tippen') return;
    }
    if (z.art === 'tippen' || z.art === 'schieben') {
      // Wischen (Finger oder Scroll-Ring): nach oben/links weiter, nach unten/rechts zurück.
      const g = z.art === 'tippen' ? zeigerGeste(e.clientX - z.x, e.clientY - z.y, e.timeStamp - z.t, umkehren()) : { art: 'tippen' as const };
      if (g.art === 'wisch') { blaetternNach(g.aktion); return; }
      if (g.art !== 'tippen') return;
      nachzueglerSchlucken();
      // Sprung setzen: Tippen setzt den Punkt, auch am Rand (blättern per Wischen, Tasten, ‹ ›).
      if (setzen) {
        if (!imRahmen(z.x, z.y)) return;
        const o = ortVon(relativ({ clientX: z.x, clientY: z.y }));
        if (!o || o.luecke) return;
        const k = (v: number) => Math.max(0, Math.min(1, v));
        setSetzen(setzenTippen(setzen, { seite: o.seite, x: k(o.x), y: k(o.y) }));
        return;
      }
      const sprungHier = z.marke && modus === 'lesen' ? spruenge.find((s) => s.id === z.marke) : undefined;
      if (sprungHier) { springen(sprungHier); return; }
      const b = window.innerWidth, x = e.clientX;
      if (x < b * 0.3) zurueck(); else if (x > b * 0.7) weiter(); else { setAnsichtOffen(false); setLeisteWeg(leiste); }
      return;
    }
    const seite = z.seite!;
    if (z.art === 'schnitt') {
      // Erst jetzt rendern: ein Schnitt mit dem gezogenen Abstand, als eine Aktion.
      setSchnittVorschau(null);
      const vorher = z.vorher ?? [];
      const neu = schnittSetzen(vorher, z.objektId!, z.punkte[1], z.abstandJetzt ?? z.abstand0 ?? 0);
      if (JSON.stringify(neu) !== JSON.stringify(vorher)) festlegen(seite, vorher, neu);
      return;
    }
    if (z.art === 'sticker') {
      // Erst jetzt rendern: der Sticker an seiner neuen Lage, als eine Aktion.
      setStickerVorschau(null);
      if (z.jetzt && z.vorher && JSON.stringify(z.jetzt) !== JSON.stringify(z.vorher)) festlegen(seite, z.vorher, z.jetzt);
      return;
    }
    if (werkzeug === 'radierer') radierEnde(seite);
    if (werkzeug === 'stift' || werkzeug === 'marker') {
      const luecke = z.luecke ? { luecke: z.luecke } : {};
      const neu: Anmerkung = werkzeug === 'stift'
        ? { id: crypto.randomUUID(), art: 'stift', farbe: einst.stift.farbe, breite: einst.stift.breite, punkte: z.punkte, ...luecke }
        : { id: crypto.randomUUID(), art: 'marker', farbe: einst.marker.farbe, breite: einst.marker.breite, punkte: z.punkte, ...luecke };
      anmerkungenSetzen(seite, [...(anm[seite] ?? []), neu]);
      liveLeeren();
    }
    if (werkzeug === 'text') {
      setTextEingabe({ seite, luecke: z.luecke ?? null, x: z.punkte[0], y: z.punkte[1], text: '', seit: e.timeStamp });
    }
    if (werkzeug === 'stelle' || werkzeug === 'schere') {
      const p = aufSeiteVon(z.lage ?? GANZES_BLATT, relativ(e));
      const r = rechteckAus(z.punkte[0], z.punkte[1], p.x, p.y);
      setRechteckEntwurf(null);
      if (r.b > 0.02 && r.h > 0.01) {
        if (werkzeug === 'stelle') { setNeueStelle({ seite, ...r }); setStelleTitel(''); setStelleZiel(''); }
        else {
          // Sticker aus dem Ausschnitt: liegt etwas versetzt darüber und ist gewählt.
          const st = stickerAus(crypto.randomUUID(), seite, r);
          anmerkungenSetzen(seite, [...(anm[seite] ?? []), st]);
          setStickerWahl({ seite, id: st.id });
        }
      }
    }
  }
  function abgebrochen(e: React.PointerEvent) {
    finger.current.delete(e.pointerId);
    if (zweiGriff.current) { zweiGriff.current = null; setZoom(einrasten(zoomLive.current)); }
    if (zug.current?.id === e.pointerId) zugAbbrechen();
    kreisZeigen(null);
  }
  // Ein Radier-Wisch schneidet eigene Striche (E-07) und — auf Seiten mit
  // Markierungen aus dem PDF — radiert diese Ebene entlang einer Radier-Spur.
  // Schnelle Wische werden lückenlos nachgezogen (radierWeg).
  const radierSpur = useRef<string | null>(null);
  const radierLetzter = useRef<{ x: number; y: number } | null>(null);
  // luecke: Der Wisch läuft in der Lücke eines Schnitts — dann trifft er nur,
  // was darin steht (Koordinaten ab Oberkante), sonst nur die Seite selbst.
  function radieren(seite: number, luecke: string | null, x: number, y: number) {
    const ebene = mitEbene.current.has(seite) && luecke === null;
    const radius = radierBreite / 2;
    const punkte = radierWeg(radierLetzter.current, x, y, radius, format);
    radierLetzter.current = { x, y };
    setAnm((alleAnm) => {
      const alt = alleAnm[seite] ?? [];
      const drin = (o: Anmerkung) => ('luecke' in o && o.luecke ? o.luecke : null) === luecke;
      let objekte = alt.filter(drin), geaendert = false;
      for (const q of punkte) {
        const r = radierZug(objekte, q.x, q.y, radius, format, radierSpur.current, ebene, () => crypto.randomUUID());
        radierSpur.current = r.spur;
        if (r.geaendert) { objekte = r.objekte; geaendert = true; }
      }
      if (!geaendert) return alleAnm;
      if (!radierWisch.current) { verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher: alt }]; wiederholenAnm.current = []; radierWisch.current = true; }
      return { ...alleAnm, [seite]: [...alt.filter((o) => !drin(o)), ...objekte] };
    });
  }
  // Eine Änderung der Schere als eine Aktion: Rückgängig geht auf `vorher`.
  function festlegen(seite: number, vorher: Anmerkung[], neu: Anmerkung[]) {
    verlaufAnm.current = [...verlaufAnm.current.slice(-49), { seite, vorher }];
    wiederholenAnm.current = [];
    anmerkungenSetzen(seite, neu, false);
  }
  // Schnitt ziehen (E-12): Der Abstand folgt dem Finger, in Seitenhöhen.
  function schnittZiehen(z: NonNullable<typeof zug.current>, clientY: number) {
    const L = z.lage ?? GANZES_BLATT, seitenHoehe = (blatt.current?.offsetWidth ?? 1) * L.b * format;
    const abstand = Math.min(1, Math.max(0, (z.abstand0 ?? 0) + (clientY - z.y) / seitenHoehe));
    z.abstandJetzt = abstand;
    setSchnittVorschau({ seite: z.seite!, y: z.punkte[1], abstand });
  }
  // Beim Anfassen eines Stickers: sein Bild einmal zeichnen (klein, nur fürs Mitführen).
  function stickerVorschauStarten(seite: number, st: Sticker) {
    const r = rechteckAufBlatt(seite, stickerRechteck(st), st.luecke ?? null), el = blatt.current;
    if (!r || !el) return;
    const c = document.createElement('canvas');
    const cw = Math.max(1, Math.round(r.b * el.offsetWidth * Math.min(dpr, 2))), ch = Math.max(1, Math.round(r.h * el.offsetHeight * Math.min(dpr, 2)));
    c.width = cw; c.height = ch;
    const W = cw / st.b, H = ch / stickerHoehe(st);
    stickerZeichnen(c.getContext('2d')!, st, { x: -st.x * W, y: -st.y * H, b: W, h: H }, quellenRef.current.get(st.von.seite) ?? null, anm[st.von.seite] ?? [], true);
    setStickerVorschau({ bild: c.toDataURL(), rahmen: r });
    c.width = 0; c.height = 0;
  }
  const stickerVorschauLegen = (r: Rechteck) => {
    const el = stickerVorschauEl.current;
    if (el) Object.assign(el.style, prozent(r));
  };
  // Sticker verschieben (über Teilstücke und Lücken derselben Seite hinweg)
  // oder an der Ecke in der Größe ziehen — nur die Vorschau bewegt sich.
  function stickerZiehen(z: NonNullable<typeof zug.current>, clientX: number, clientY: number) {
    const el = blatt.current;
    if (!el) return;
    const st = z.sticker!, seite = z.seite!, L = z.lage ?? GANZES_BLATT;
    let neu: Sticker;
    if (z.griff === 'groesse') {
      neu = stickerSkalieren(st, st.b + (clientX - z.x) / (el.offsetWidth * L.b));
    } else {
      // Linke obere Ecke auf dem Blatt mitführen; das Teilstück darunter bestimmt Seite-oder-Lücke und Koordinaten.
      const s0 = z.blattStart;
      if (!s0) return;
      const bb = st.b * L.b, hb = stickerHoehe(st) * L.h;
      const k = (v: number, von: number, bis: number) => Math.max(von, Math.min(bis, v));
      const nx = k(s0.x + (clientX - z.x) / el.offsetWidth, -bb * 0.75, 1 - bb * 0.25), ny = k(s0.y + (clientY - z.y) / el.offsetHeight, -hb * 0.75, 1 - hb * 0.25);
      const px = k(nx, 0, 1), py = k(ny, 0, 0.9999);
      const q = stuecke.find((s) => s.seite === seite && px >= s.sicht.x && px <= s.sicht.x + s.sicht.b && py >= s.sicht.y && py <= s.sicht.y + s.sicht.h);
      if (!q) return;
      neu = { ...st, x: (nx - q.lage.x) / q.lage.b, y: (ny - q.lage.y) / q.lage.h };
      if (q.luecke) neu.luecke = q.luecke; else delete neu.luecke;
    }
    z.jetzt = (z.vorher ?? []).map((o) => (o.id === st.id ? neu : o));
    const r = rechteckAufBlatt(seite, stickerRechteck(neu), neu.luecke ?? null);
    if (r) stickerVorschauLegen(r);
  }
  // Ecke des gewählten Stickers anfassen (Größe) — die Fläche bekommt den Zug nicht.
  function griffAnfassen(e: React.PointerEvent) {
    const st = gewaehlterSticker, seite = stickerWahl?.seite;
    if (!st || seite === undefined) return;
    e.stopPropagation(); e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const q = stueckFuer(seite, st.y, st.luecke ?? null);
    zug.current = { art: 'sticker', punkte: [], x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, start: zoomLive.current, seite, lage: q?.lage ?? GANZES_BLATT, vorher: anm[seite] ?? [], objektId: st.id, sticker: st, griff: 'groesse' };
    stickerVorschauStarten(seite, st);
  }
  function lueckeKnopf(e: React.MouseEvent<HTMLButtonElement>) {
    const { seite, luecke } = e.currentTarget.dataset;
    if (seite && luecke) lueckeEntfernen(Number(seite), luecke);
  }
  // Fürs Rendern vorbereitet: Rahmen des gewählten Stickers, Knöpfe der Lücken.
  const stickerRahmen = stickerWahl && gewaehlterSticker ? rechteckAufBlatt(stickerWahl.seite, stickerRechteck(gewaehlterSticker), gewaehlterSticker.luecke ?? null) : null;
  // Vorschau des Schnitts: Band ab der Schnitthöhe (bei einer bestehenden Lücke ab deren Oberkante).
  const vorschauBand = schnittVorschau ? (() => {
    const o = aufBlatt(schnittVorschau.seite, 0, schnittVorschau.y), q = stueckFuer(schnittVorschau.seite, schnittVorschau.y, null);
    return o && q ? { top: o.y, h: schnittVorschau.abstand * q.lage.h } : null;
  })() : null;
  const lueckenKnoepfe = stuecke.filter((q) => q.luecke).map((q) => ({ id: q.luecke!, seite: q.seite, mitte: q.sicht.y + q.sicht.h / 2 }));
  function stickerLoeschen() {
    if (!stickerWahl) return;
    const { seite, id } = stickerWahl;
    anmerkungenSetzen(seite, (anm[seite] ?? []).filter((o) => o.id !== id));
    setStickerWahl(null);
  }
  // Sticker auf die vorige/nächste Seite legen (gleiche Lage) und dorthin blättern.
  function stickerAufSeite(richtung: -1 | 1) {
    const st = gewaehlterSticker;
    if (!stickerWahl || !st) return;
    const von = stickerWahl.seite, nach = von + richtung;
    if (nach < 1 || nach > seiten) return;
    // Auf der anderen Seite gibt es diese Lücke nicht: dort auf die Seite selbst.
    const ohne: Sticker = { ...st };
    delete ohne.luecke;
    anmerkungenSetzen(von, (anm[von] ?? []).filter((o) => o.id !== st.id));
    anmerkungenSetzen(nach, [...(anm[nach] ?? []), ohne]);
    setStickerWahl({ seite: nach, id: st.id });
    zuStand(standUebertragen(liste, folge, { schritt, zeige }, liste, folge, ansichtVonSeite(liste, nach)));
  }
  function lueckeEntfernen(seite: number, id: string) {
    anmerkungenSetzen(seite, schnittEntfernen(anm[seite] ?? [], id));
  }
  // Radier-Wisch zu Ende: einmal speichern — im Updater, der nach allen
  // Updatern des Wischs läuft — und den Verlaufszähler nachziehen (der
  // Verlauf wird in den Updatern geschrieben, die bis hierhin gelaufen sind).
  function radierEnde(seite: number) {
    setAnm((a) => {
      if (radierWisch.current) anmerkungenSpeichern(noten.id, seite, a[seite] ?? []).catch(speicherFehler);
      return a;
    });
    staendeAktualisieren();
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
    if (!neueStelle) return;
    const r = neueStelle;
    try {
      await stelleAnlegen({ stueckId: noten.id, ...r, titel: stelleTitel.trim() }, zielAusText(stelleZiel));
    } catch (x) {
      // Rahmen bleibt stehen: nach dem Neuladen ist er weg, aber bis dahin sichtbar.
      speicherFehler(x);
      return;
    }
    setNeueStelle(null);
    neueStelleMerken.current = { seite: r.seite, y: r.y, x: r.x };
    geaendert();
  }
  function textSpeichern(e?: React.FocusEvent) {
    if (!textEingabe) return;
    // Direkt nach dem Antippen feuern Browser noch Maus-Ereignisse nach — die
    // dürfen das frische Feld nicht schließen.
    if (e && e.timeStamp - textEingabe.seit < 400) { (e.target as HTMLInputElement).focus(); return; }
    if (textEingabe.text.trim()) {
      const { seite, luecke } = textEingabe;
      anmerkungenSetzen(seite, [...(anm[seite] ?? []),
        { id: crypto.randomUUID(), art: 'text', farbe: einst.text.farbe, groesse: TEXT_GROESSE, x: textEingabe.x, y: textEingabe.y, text: textEingabe.text.trim(), ...(luecke ? { luecke } : {}) }]);
    }
    setTextEingabe(null);
  }

  // ── Blättern je Seite (F-16) ── Eingestellt wird die Seite, deren
  // Umblättern man sieht (in der Halb-Ansicht die untere); die letzte blättert nicht.
  const blaetterSeite = ansicht.art === 'ganz' ? ansicht.seite : ansicht.art === 'halb' ? ansicht.unten : ansicht.links;
  const letzteSeite = blaetterSeite >= seiten;
  const blaetterModus = letzteSeite ? blaettern.modus : seitenModus(blaettern, blaetterSeite);
  // Danach zu sehen: beim Einstellen (und für die Linie) die eingestellte Seite,
  // sonst die, an der man gerade liest.
  const nachWahl = (m: Blaettermodus) => (linieEinstellen || m === 'linie' ? blaetterSeite : hauptseite(ansicht));
  function modusWaehlen(m: Blaettermodus) {
    const neu = modusSetzen(blaettern, seiten, fuerAlle ? 'alle' : blaetterSeite, m);
    if (JSON.stringify(neu) !== JSON.stringify(blaettern)) blaetternSpeichern(neu, nachWahl(m));
  }
  // Im Ansicht-Menü gilt die Wahl für alle Seiten (B-14); je Seite geht es
  // in der Leiste „Blättern einstellen“.
  const alleGleich = einheitlich(blaettern, seiten);
  function alleWaehlen(m: Blaettermodus) {
    const neu = modusSetzen(blaettern, seiten, 'alle', m);
    if (JSON.stringify(neu) !== JSON.stringify(blaettern)) blaetternSpeichern(neu, nachWahl(m));
    setFuerAlle(true);
  }
  function fuerAlleWechseln(an: boolean) {
    setFuerAlle(an);
    // Einschalten: alle Seiten blättern wie diese.
    if (an && !einheitlich(blaettern, seiten)) blaetternSpeichern(modusSetzen(blaettern, seiten, 'alle', blaetterModus), nachWahl(blaetterModus));
  }
  function linieStarten() {
    setFuerAlle(einheitlich(blaettern, seiten));
    setLinieEinstellen(true); setWerkzeug(null); setPaletteOffen(false); setAnsichtOffen(false);
    // Leisten weg: die Seite bleibt frei, auch für Linien ganz oben oder unten.
    setLeisteWeg(true);
  }
  const linieEnde = () => { setLinieEinstellen(false); setLeisteWeg(false); };
  // Seite für Seite: ‹ › zeigen die vorige bzw. nächste ganze Seite.
  function seiteZeigen(r: -1 | 1) {
    const ziel = ansicht.art === 'ganz' ? ansicht.seite + r : ansicht.art === 'halb' ? (r < 0 ? ansicht.unten : ansicht.oben) : r < 0 ? ansicht.links - 1 : ansicht.rechts + 1;
    if (ziel >= 1 && ziel <= seiten) zuStand(standUebertragen(liste, folge, { schritt, zeige }, liste, folge, ansichtVonSeite(liste, ziel)));
  }
  const blaetterKopf = ansicht.art === 'ganz' ? `Seite ${ansicht.seite}:` : ansicht.art === 'halb' ? `Seite ${ansicht.unten} → ${ansicht.oben}:` : `Seiten ${ansicht.links}–${ansicht.rechts}:`;
  const blaetterHinweis = ansicht.art === 'halb'
    ? `So blättert es: oben schon Seite ${ansicht.oben}, unten noch Seite ${ansicht.unten}.${blaetterModus === 'linie' ? ' Die Linie ziehst du auf der ganzen Seite (‹).' : ''}`
    : letzteSeite ? 'Letzte Seite — hier wird nicht geblättert.'
    : blaetterModus === 'linie' ? `Goldene Linie ziehen: bis hierhin lesen, dann zeigt Weiterblättern oben schon Seite ${blaetterSeite + 1}.`
    : blaetterModus === 'halb' ? `Weiterblättern teilt in der Mitte: oben schon Seite ${blaetterSeite + 1}, unten noch diese.`
    : `Weiterblättern zeigt gleich die ganze Seite ${blaetterSeite + 1}.`;

  // Blätterlinie ziehen (nur auf ganzen Seiten, die mit Linie blättern)
  const linienSeite = ansicht.art === 'ganz' && ansicht.seite < seiten && seitenModus(blaettern, ansicht.seite) === 'linie' ? ansicht.seite : null;
  const linieWert = linienSeite ? (blaettern.linien[linienSeite] ?? 0.5) : 0.5;
  function linieBewegen(e: React.PointerEvent) {
    if (!linieZiehen || !linienSeite) return;
    const o = ortVon(relativ(e));
    if (!o || o.seite !== linienSeite) return;
    // In einer Lücke: die Linie liegt auf dem Schnitt.
    const roh = o.luecke ? (schnitte.find((x) => x.id === o.luecke)?.y ?? 0.5) : o.y;
    const y = Math.max(0.02, Math.min(0.98, roh));
    setBlaettern((b) => ({ ...b, linien: { ...b.linien, [linienSeite]: Math.round(y * 1000) / 1000 } }));
  }
  function linieLoslassen() {
    if (!linieZiehen) return;
    setLinieZiehen(false);
    blaetternSpeichern(blaettern);
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
    stueckAendern(noten.id, { ausschnitte: neu }).catch(speicherFehler);
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
  const seitenText = ansicht.art === 'ganz' ? `${ansicht.seite}` : ansicht.art === 'halb' ? `${ansicht.unten} → ${ansicht.oben}` : `${ansicht.links}–${ansicht.rechts}`;
  // Im Mix: „Mix 2026 · ★ offen · 3 von 9“, wird es eng, kürzer (mixKopf).
  const kopf = mix ? mixKopf(mix.titel, mix.bereich, mix.nr, mix.anzahl) : null;
  const anzeige = kopf ? kopf.formen[0]
    : modus === 'stellen'
    ? `Stelle ${stelleNr + 1} von ${stellen.length}`
    : `Seite${ansicht.art === 'doppel' ? 'n' : ''} ${seitenText} von ${seiten}`;
  // Per Sprung erreichter Teil (nicht beim Setzen): „Seite 1 von 3 · nach D.S.“,
  // wird es eng „S. 1 · nach D.S.“, dann „S. 1 · D.S.“ — die längste Form,
  // die neben den Knöpfen ganz passt (gemessen: Schrift und Knöpfe je Gerät).
  const seit = !mix && modus === 'lesen' && !frei ? nachSprung(folge, schritt, spruenge, zeige) : null;
  const formen = kopf ? (kopf.formen.length > 1 ? kopf.formen : null) : seit ? [
    `Seite ${seitenText} von ${seiten} · nach ${KUERZEL[seit.art]}`,
    `S. ${seitenText} · nach ${KUERZEL[seit.art]}`,
    `S. ${seitenText} · ${KUERZEL[seit.art]}`,
  ] : null;
  const titelPlatz = useRef<HTMLDivElement>(null);
  const formMessung = useRef<HTMLSpanElement>(null);
  const [formNr, setFormNr] = useState(1);
  const mitFormen = formen !== null;
  useEffect(() => {
    const platz = titelPlatz.current, messung = formMessung.current, knopf = platz?.firstElementChild;
    if (!platz || !messung || !knopf) return;
    const ro = new ResizeObserver(() => {
      const k = getComputedStyle(knopf);
      const raum = platz.clientWidth - parseFloat(k.paddingLeft) - parseFloat(k.paddingRight) - parseFloat(k.marginLeft) - parseFloat(k.marginRight);
      const breiten = [...messung.children].map((e) => e.getBoundingClientRect().width);
      const i = breiten.findIndex((b) => b <= raum + 0.5);
      setFormNr(i < 0 ? breiten.length - 1 : i);
    });
    ro.observe(platz);
    for (const e of messung.children) ro.observe(e);
    return () => ro.disconnect();
  }, [mitFormen]);
  const ladeTempo = stelle ? (zuletzt ?? stelle.zielTempo) : null;
  // Werkzeug-Hinweise bleiben stehen, solange sie gelten (B-11): beim Benennen
  // der Stelle bzw. Schreiben des Texts sind sie erledigt.
  const werkzeugHinweis = farbeAufnehmen ? 'Auf die Farbe tippen, die du übernehmen willst.'
    : !werkzeug || !zeichenbar ? null
    : werkzeug === 'stelle' ? (neueStelle ? null : 'Rahmen um die Takte ziehen.')
    : werkzeug === 'schere' ? (stickerWahl ? 'Sticker ziehen, Ecke: Größe. Leiste: Seite wechseln, löschen.'
      : schereModus === 'sticker' ? 'Rahmen um die Takte ziehen — wird ein Sticker.' : 'Antippen und nach unten ziehen: schneidet die Seite auf. In der Lücke ziehen: Abstand ändern.')
    : werkzeug === 'text' ? (textEingabe ? null : 'Auf die Stelle tippen, an der der Text stehen soll.')
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
  // Unten eine Zeile der Noten selbst (Stelle, neue Stelle, Ausschnitt, Blättern)?
  const blaetternLeiste = linieEinstellen && modus === 'lesen';
  const zeileUnten = !!(neueStelle || stelle || bearbeiten || setzen || blaetternLeiste);
  // Marken der Sprünge: nur beim Lesen, nicht beim Zuschneiden und nicht beim
  // Ziehen der Blätterlinie. Außerhalb des Ausschnitts rücken sie an dessen
  // Rand (sichtbar und antippbar).
  const marken = modus === 'lesen' && !bearbeiten && !linieEinstellen ? sichtbareMarken(spruenge, ansicht) : [];
  // Punkt einer Seite aufs Blatt: innerhalb des Ausschnitts, auf der Doppelseite in ihrer Hälfte.
  const lage = (p: { seite: number; x: number; y: number }) => {
    const q = einpassen(p, ausschnitt), b = aufBlatt(p.seite, q.x, q.y) ?? q;
    return { left: `${b.x * 100}%`, top: `${b.y * 100}%` };
  };
  // Beim Öffnen steht wieder das zuletzt gewählte Werkzeug bereit (E-11) —
  // solange die App läuft, über Stückwechsel hinweg.
  useEffect(() => { if (werkzeug) werkzeugZuletzt = werkzeug; }, [werkzeug]);
  const paletteWechsel = (offen: boolean) => {
    setPaletteOffen(offen);
    setWerkzeug(offen ? werkzeugZuletzt : null);
    setFarbeAufnehmen(false);
    if (offen) setLinieEinstellen(false);
  };
  // Knöpfe über dem Blatt: Tippen darauf zeichnet und blättert nicht.
  const greifbar = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onPointerUp: (e: React.PointerEvent) => e.stopPropagation() };

  return (
    <div className={`betrachter ${navDa ? 'nav-da' : ''}`} role="region" aria-label={`Noten: ${noten.titel}`}>
      <div ref={oben} className={`betrachter-leiste ${leiste ? '' : 'weg'}`} inert={!leiste}>
        <div className="nav-zeile">
          <div ref={titelPlatz} className="nav-titel-platz">
            <button type="button" className="nav-titel" onClick={titelTipp} title="Stück-Details und Stellen-Übersicht">
              <span className="nav-titel-text">
                <span className="nav-titel-schnitt">{noten.titel}{noten.stimme && <span className="b-leise"> · {noten.stimme}</span>}</span>
                <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="nav-untertitel tabular-nums" aria-hidden={kopf ? true : undefined}>{formen ? formen[Math.min(formNr, formen.length - 1)] : anzeige}</span>
              {kopf && <span className="sr-only">{kopf.aria}</span>}
            </button>
            {formen && (
              <span ref={formMessung} className="nav-messung tabular-nums" aria-hidden="true">
                {formen.map((f, i) => <span key={i}>{f}</span>)}
              </span>
            )}
          </div>
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
          <button type="button" className="nav-rund" aria-pressed={ansichtOffen}
            onClick={() => { if (!ansichtOffen) setFuerAlle(einheitlich(blaettern, seiten)); setAnsichtOffen(!ansichtOffen); }}
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
              {/* Ansicht-Menü (B-14): Zeilen mit Symbol — Schalter oben, dann
                  Blättern, Zuschneiden, Sprünge. Je Seite einstellen geht in der
                  Leiste unten („Blättern einstellen“). */}
              <p className="nav-blase-titel">Ansicht</p>
              <label className="nav-punkt">
                <SymbolZweiSeiten />
                <span className="nav-punkt-text">Zwei Seiten<small>{quer ? 'Nebeneinander wie im Heft' : 'Nebeneinander, sobald der Bildschirm quer ist'}</small></span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={zweiSeiten} onChange={(e) => zweiSeitenSetzen(e.target.checked)} />
              </label>
              <label className="nav-punkt">
                <SymbolZoom />
                <span className="nav-punkt-text">Immer zoomen<small>{zoomImmer ? 'Zwei Finger zoomen auch beim Lesen' : 'Nur bei offener Stift-Palette'}</small></span>
                <input type="checkbox" role="switch" className="ios-schalter" checked={zoomImmer} onChange={(e) => zoomImmerSetzen(e.target.checked)} />
              </label>
              {modus === 'lesen' && (
                <>
                  <p className="nav-blase-titel">Blättern</p>
                  <div className="segment nav-segment" role="group" aria-label="Blättern auf allen Seiten">
                    {BLAETTER_MODI.map(([m, name]) => (
                      <button key={m} type="button" aria-pressed={alleGleich && blaettern.modus === m} disabled={seiten < 2}
                        onClick={() => { alleWaehlen(m); if (m === 'linie') linieStarten(); }}>
                        {name}
                      </button>
                    ))}
                  </div>
                  <p className="nav-hinweis">
                    {seiten < 2 ? 'Eine Seite — hier wird nicht geblättert.'
                      : !alleGleich ? 'Je Seite verschieden. Hier wählen gilt wieder für alle.'
                      : blaettern.modus === 'ganz' ? 'Ganze Seite für Seite.'
                      : blaettern.modus === 'halb' ? 'Oben schon die nächste, unten noch diese Seite.'
                      : 'Ab der Linie oben schon die nächste Seite.'}
                  </p>
                  {seiten > 1 && (
                    <button type="button" className="nav-punkt" onClick={linieStarten}>
                      <SymbolBlaettern />
                      <span className="nav-punkt-text">Blättern einstellen<small>Seite für Seite: Ganz, Halb oder Linie ziehen</small></span>
                      <NavPfeil />
                    </button>
                  )}
                </>
              )}
              <p className="nav-blase-titel">Seite</p>
              <button type="button" className="nav-punkt" onClick={ausschnittStarten}>
                <SymbolZuschneiden />
                <span className="nav-punkt-text">Seite {seiteJetzt} zuschneiden<small>{ausschnitte[seiteJetzt] ? 'Ausschnitt ändern oder ganze Seite' : 'Nur den Bereich zeigen, den du brauchst'}</small></span>
                <NavPfeil />
              </button>
              {modus === 'lesen' && (
                <>
                  <p className="nav-blase-titel">Sprünge</p>
                  <button type="button" className="nav-punkt" onClick={setzenStarten} disabled={!!neueStelle}>
                    <SymbolSprung />
                    <span className="nav-punkt-text">Sprung setzen<small>Wiederholung, D.S., D.C., Coda — Weiterblättern folgt</small></span>
                    <NavPfeil />
                  </button>
                  {spruenge.length > 1 && <p className="nav-hinweis">In dieser Reihenfolge wird gesprungen — mit ↑ ↓ umstellen.</p>}
                  {spruenge.length > 0 && (
                    <ol className="nav-spruenge" aria-label="Sprünge in Spielreihenfolge">
                      {spruenge.map((s, i) => (
                        <li key={s.id} className={genommen.has(s.id) ? undefined : 'aus'}>
                          <span className="nav-sprung-nr tabular-nums" aria-hidden="true">{i + 1}</span>
                          <span className="nav-sprung" title={genommen.has(s.id) ? undefined : 'Wird beim Weiterblättern nicht erreicht'}>
                            <span className="nav-sprung-art"><SprungZeichen art={s.art} />{KUERZEL[s.art]}</span>
                            <span className="nav-sprung-weg tabular-nums">S. {s.von.seite} → {s.nach.seite}</span>
                          </span>
                          <button type="button" className="nav-schieben" aria-label={`Sprung ${sprungText(s)} nach oben`} disabled={i === 0}
                            onClick={() => spruengeSpeichern(sprungVerschieben(spruenge, s.id, -1))}>
                            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5l3-3 3 3" /></svg>
                          </button>
                          <button type="button" className="nav-schieben" aria-label={`Sprung ${sprungText(s)} nach unten`} disabled={i === spruenge.length - 1}
                            onClick={() => spruengeSpeichern(sprungVerschieben(spruenge, s.id, 1))}>
                            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
                          </button>
                          <button type="button" className="nav-loeschen" aria-label={`Sprung ${sprungText(s)} löschen`}
                            onClick={() => spruengeSpeichern(sprungLoeschen(spruenge, s.id))}>Löschen</button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {spruenge.some((s) => !genommen.has(s.id)) && (
                    <p className="nav-hinweis">
                      Grau: wird beim Weiterblättern nicht erreicht.
                      {spruenge.some((s) => s.art === 'coda' && !genommen.has(s.id)) && ' Eine Coda kommt erst nach einem D.S. oder D.C.'}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Zeiger auf der ganzen Fläche: auch Tippen neben das Blatt blättert. */}
      <div ref={flaeche} className={`betrachter-flaeche ${zeileUnten ? '' : 'unten-frei'} ${farbeAufnehmen ? 'pipette' : ''}`}
        style={{ '--oben': `${leiste ? obenHoehe : 0}px` } as React.CSSProperties}
        onPointerDown={runter} onPointerMove={(e) => { bewegen(e); linieBewegen(e); }} onPointerUp={(e) => { hoch(e); linieLoslassen(); }}
        onPointerCancel={abgebrochen} onPointerLeave={() => kreisZeigen(null)}
        onWheel={radDrehen}
        onMouseDown={(e) => { if (werkzeug) e.preventDefault(); }}>
        {darst && (
          <div ref={rahmenEl} className={`betrachter-rahmen ${bearbeiten ? 'einstellen' : ''} ${zoomAktiv ? 'zoombar' : ''}`} style={{ width: darst.rahmen.b, height: darst.rahmen.h }}>
            <div ref={blatt} className="betrachter-blatt" style={{ width: darst.blatt.b, height: darst.blatt.h, left: darst.blatt.x, top: darst.blatt.y }}>
              <canvas ref={leinwand} className="betrachter-leinwand" />
              {nahGilt && nah && <canvas ref={nahLeinwand} className="betrachter-nah" style={prozent(nah.r)} />}
              <canvas ref={live} className="betrachter-leinwand betrachter-live" />
              {werkzeug === 'radierer' && <span ref={radierKreis} className="b-radierer" aria-hidden="true" />}
              {marken.map((s) => (
                <button key={s.id} type="button" data-sprung={s.id} className={`b-marke ${setzen ? 'leise' : ''}`} style={lage(s.von)}
                  tabIndex={setzen ? -1 : undefined} aria-label={`${KUERZEL[s.art]}: zu Seite ${s.nach.seite}`} title={`${KUERZEL[s.art]} → Seite ${s.nach.seite}`}
                  // Finger und Zeiger laufen über die Fläche (hoch); hier nur Tastatur (detail 0).
                  onClick={(e) => { if (e.detail === 0) springen(s); }}>
                  <span><SprungZeichen art={s.art} />{KUERZEL[s.art]}</span>
                </button>
              ))}
              {setzen && setzen.schritt !== 'von' && punktSichtbar(ansicht, setzen.von) && (
                <span className="b-marke vorschau" style={lage(setzen.von)} aria-hidden="true">
                  <span>{setzen.schritt === 'art' ? <><SprungZeichen art={setzen.art} />{KUERZEL[setzen.art]}</> : '?'}</span>
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
              {neueStelle && <span className="b-rechteck fest" style={prozent(rechteckAufBlatt(neueStelle.seite, neueStelle) ?? neueStelle)} />}
              {linieEinstellen && modus === 'lesen' && linienSeite && (
                <div className="b-linie" style={{ top: `${(aufBlatt(linienSeite, 0, linieWert)?.y ?? linieWert) * 100}%` }}
                  onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setLinieZiehen(true); }}>
                  <span>Blättern ab hier · {Math.round(linieWert * 100)} %</span>
                </div>
              )}
              {textEingabe && (
                <input className="b-texteingabe" autoFocus value={textEingabe.text} placeholder="Text …"
                  style={(() => { const b = aufBlatt(textEingabe.seite, textEingabe.x, textEingabe.y, textEingabe.luecke) ?? textEingabe; return { left: `${b.x * 100}%`, top: `${b.y * 100}%` }; })()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setTextEingabe({ ...textEingabe, text: e.target.value })}
                  onBlur={(e) => textSpeichern(e)} onKeyDown={(e) => { if (e.key === 'Enter') textSpeichern(); if (e.key === 'Escape') setTextEingabe(null); }} />
              )}
              {/* Schere (E-12): Lücken lassen sich entfernen, der gewählte Sticker hat Leiste und Griff. */}
              {werkzeug === 'schere' && lueckenKnoepfe.map((q) => (
                <button key={q.id} type="button" className="b-luecke-weg" style={{ top: `${q.mitte * 100}%` }} data-seite={q.seite} data-luecke={q.id} {...greifbar}
                  onClick={lueckeKnopf} aria-label="Schnitt entfernen" title="Schnitt entfernen — samt Lücke und dem, was darin steht">×</button>
              ))}
              {vorschauBand && (
                <div className="b-schnitt-vorschau" style={{ top: `${vorschauBand.top * 100}%`, height: `${vorschauBand.h * 100}%` }} aria-hidden="true" />
              )}
              {stickerVorschau && (
                <div ref={stickerVorschauEl} className="b-sticker-vorschau" style={prozent(stickerVorschau.rahmen)} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Datenbild einer Leinwand, kein Bild aus dem Netz */}
                  <img src={stickerVorschau.bild} alt="" draggable={false} />
                </div>
              )}
              {stickerRahmen && stickerWahl && !stickerVorschau && (
                <div className="b-sticker-wahl" style={prozent(stickerRahmen)}>
                  <div className="b-sticker-leiste" {...greifbar}>
                    <button type="button" onClick={() => stickerAufSeite(-1)} disabled={stickerWahl.seite <= 1} aria-label="Sticker auf die vorige Seite">‹ Seite</button>
                    <button type="button" onClick={() => stickerAufSeite(1)} disabled={stickerWahl.seite >= seiten} aria-label="Sticker auf die nächste Seite">Seite ›</button>
                    <button type="button" className="weg" onClick={stickerLoeschen} aria-label="Sticker löschen">Löschen</button>
                  </div>
                  <span className="b-sticker-griff" role="presentation" onPointerDown={griffAnfassen}
                    onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={abgebrochen} />
                </div>
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
        {zoomAktiv && (paletteOffen || zoom.z > 1) && (
          <div className="b-zoom" role="group" aria-label="Zoom" {...greifbar}>
            <button type="button" onClick={() => zoomKnopf(1 / 1.5)} disabled={zoom.z <= 1} aria-label="Verkleinern" title="Verkleinern">−</button>
            <button type="button" className="b-zoom-wert tabular-nums" onClick={() => setZoom(OHNE_ZOOM)} disabled={zoom.z <= 1}
              title="Ganze Seite zeigen" aria-label={`Zoom ${Math.round(zoom.z * 100)} %, ganze Seite zeigen`}>{Math.round(zoom.z * 100)} %</button>
            <button type="button" onClick={() => zoomKnopf(1.5)} disabled={zoom.z >= ZOOM_MAX} aria-label="Vergrößern" title="Vergrößern (auch mit zwei Fingern)">+</button>
          </div>
        )}
        {/* Schwebende Hinweise: verkleinern das Blatt nicht. */}
        {(werkzeugHinweis || (werkzeug && !zeichenbar)) && (
          <div className="b-schwebend">
            {werkzeug && !zeichenbar ? (
              <>
                <span>Anmerken geht auf einer ganzen Seite.</span>
                <button type="button" className="b-knopf b-greifbar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
                  onClick={ganzeSeite}>Ganze Seite zeigen</button>
              </>
            ) : (
              <span className="b-hinweis">{werkzeugHinweis}</span>
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

      {blaetternLeiste && (
        <div className="b-unten b-umbruch" role="group" aria-label="Blättern einstellen">
          <p className="b-aus-hinweis"><strong className="tabular-nums">{blaetterKopf}</strong> {blaetterHinweis}</p>
          <button type="button" className="b-knopf gross" onClick={() => seiteZeigen(-1)} disabled={ansicht.art === 'ganz' && ansicht.seite <= 1} aria-label="Vorige Seite">‹</button>
          <button type="button" className="b-knopf gross" onClick={() => seiteZeigen(1)} disabled={ansicht.art === 'ganz' && ansicht.seite >= seiten} aria-label="Nächste Seite">›</button>
          <div className="b-segment" role="group" aria-label={fuerAlle ? 'Blättern auf allen Seiten' : `Blättern auf Seite ${blaetterSeite}`}>
            {BLAETTER_MODI.map(([m, name]) => (
              <button key={m} type="button" aria-pressed={blaetterModus === m} disabled={!fuerAlle && letzteSeite} onClick={() => modusWaehlen(m)}>{name}</button>
            ))}
          </div>
          {seiten > 2 && (
            <label className="b-schalter">
              <input type="checkbox" role="switch" className="ios-schalter" checked={fuerAlle} onChange={(e) => fuerAlleWechseln(e.target.checked)} />
              Für alle {seiten} Seiten
            </label>
          )}
          <span className="flex-1" />
          <button type="button" className="knopf knopf-klein" onClick={linieEnde}>Fertig</button>
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
                  <button key={a} type="button" aria-pressed={setzen.art === a} onClick={() => setSetzen(artWaehlen(setzen, a))}>
                    <SprungZeichen art={a} />{KUERZEL[a]}
                  </button>
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
          <SternKnopf an={stelleFavorit(stelle)} umschalten={() => void favoritUmschalten(stelle)} className="b-stern" />
          <button type="button" className="b-stelleninfo min-w-0 flex-1" onClick={() => setStelleBlatt(true)} title="Ziel und Tempo-Verlauf der Stelle">
            <span className="b-stellentitel">
              <span className="truncate font-bold">{stelle.titel || `Stelle auf Seite ${stelle.seite}`}</span>
              <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="b-leise block truncate text-xs tabular-nums" aria-live="polite">
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
        <StelleBlatt stelle={stelle} stueck={noten.titel} geaendert={geaendert} schliessen={() => setStelleBlatt(false)}
          geloescht={() => {
            setStelleBlatt(false);
            // War es die letzte Stelle, geht es zurück zum Lesen (im Mix rückt die Runde nach).
            if (!mix && stellen.length <= 1) setModus('lesen');
            geaendert();
          }} />
      )}

      {/* Beim Benennen einer neuen Stelle weicht die Palette der Eingabezeile. */}
      {paletteOffen && !neueStelle && !bearbeiten && (
        <StiftPalette werkzeug={werkzeug}
          wechseln={(w) => { setWerkzeug(w); setLinieEinstellen(false); setFarbeAufnehmen(false); }}
          einst={einst} einstellen={einstellen}
          radierBreite={radierBreite} radiererEinstellen={radiererEinstellen}
          pipetten={pipetten} farbeAufnehmen={farbeAufnehmen} setFarbeAufnehmen={setFarbeAufnehmen}
          fingerZeichnen={fingerZeichnen} setFingerZeichnen={setFingerZeichnen}
          rueckgaengig={rueckgaengig} wiederholen={wiederholen}
          kannRueck={staende.rueck > 0} kannWieder={staende.wieder > 0}
          schereModus={schereModus} schereEinstellen={setSchereModus} />
      )}
    </div>
  );
}

const BLAETTER_MODI = [['ganz', 'Ganz'], ['halb', 'Halb'], ['linie', 'Linie']] as const;
const GANZES_BLATT: SeitenLage = { x: 0, y: 0, b: 1, h: 1 };
const gleicheSchnitte = (a: readonly Schnitt[], b: readonly Schnitt[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id && x.y === b[i].y && x.abstand === b[i].abstand);
// Sind in `neu` gegenüber `alt` nur Striche oder Texte hinten angehängt (je
// Seite)? Dann je Seite die neuen — sonst null (Radieren, Rückgängig,
// Schnitte, Sticker: neu zeichnen).
function nurAngehaengt(alt: Record<number, Anmerkung[]>, neu: Record<number, Anmerkung[]>): Map<number, Anmerkung[]> | null {
  if (alt === neu) return new Map();
  const dazu = new Map<number, Anmerkung[]>();
  for (const k of new Set([...Object.keys(alt), ...Object.keys(neu)])) {
    const a = alt[Number(k)] ?? [], n = neu[Number(k)] ?? [];
    if (a === n) continue;
    if (n.length < a.length || a.some((o, i) => o !== n[i])) return null;
    const rest = n.slice(a.length);
    if (rest.some((o) => o.art !== 'stift' && o.art !== 'marker' && o.art !== 'text')) return null;
    dazu.set(Number(k), rest);
  }
  return dazu;
}
// Ein Teilstück des Blatts (siehe `stuecke` im Betrachter).
interface BlattStueck { seite: number; luecke: string | null; y0: number; y1: number; lage: SeitenLage; sicht: SeitenLage }
interface Ort { stueck: BlattStueck; seite: number; luecke: string | null; x: number; y: number }
// Blatt-Punkt → Seiten-Koordinaten über die Lage der Seite; Seiten-Rechteck → Blatt.
const aufSeiteVon = (L: SeitenLage, p: { x: number; y: number }) => ({ x: (p.x - L.x) / L.b, y: (p.y - L.y) / L.h });
const blattRechteck = (L: SeitenLage, r: Rechteck): Rechteck => ({ x: L.x + r.x * L.b, y: L.y + r.y * L.h, b: r.b * L.b, h: r.h * L.h });
// Zuletzt gewähltes Werkzeug der Palette (E-11): nur im Arbeitsspeicher, bis
// die App neu lädt — dann wieder der Stift.
let werkzeugZuletzt: Werkzeug = 'stift';
const prozent = (r: Rechteck) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%` });

// ── Symbole des Ansicht-Menüs (B-14) ──
const NavPfeil = () => (
  <svg className="nav-pfeil" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SymbolZweiSeiten = () => (
  <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="8" height="14" rx="1.2" /><rect x="13" y="5" width="8" height="14" rx="1.2" /><path d="M5.5 9h3M5.5 12h3M15.5 9h3M15.5 12h3" /></svg>
);
const SymbolZoom = () => (
  <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" /></svg>
);
// Blatt mit umgeklappter Ecke unten rechts.
const SymbolBlaettern = () => (
  <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12A1.5 1.5 0 0 1 19.5 5v8.5L13 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" /><path d="M19.5 13.5H15a2 2 0 0 0-2 2v5" /><path d="M8 8.5h8M8 12h5" /></svg>
);
// Zuschneiden wie beim Bearbeiten von Fotos.
const SymbolZuschneiden = () => (
  <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2.5V15a2 2 0 0 0 2 2h12.5" /><path d="M2.5 7H15a2 2 0 0 1 2 2v12.5" /></svg>
);
// Sprung zurück (Wiederholung, D.S.).
const SymbolSprung = () => (
  <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 11h11a4 4 0 0 1 0 8H10" /><path d="M8 7.5L4.5 11 8 14.5" /><path d="M4.5 4.5h15" strokeDasharray="2 2.5" /></svg>
);
