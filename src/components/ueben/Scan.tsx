'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  aufbereiten, blattrand, drehen, eckeSetzen, entzerren, pdfBauen, scanDateiname, STUFEN, zielmass,
  type Bild, type Ecken, type Punkt, type Seitenbild, type Stufe,
} from '@/domain/scan';
import { gespeichert, speichern } from './klang';
import { stueckAnlegen } from './lokal';
import { fehlerGrund } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';

// Kamera-Scan und Foto-Import (F-07): Fotos von Papiernoten werden Seiten
// eines neuen Stücks. Je Seite: Blattrand (automatisch, Ecken ziehbar),
// entzerren, Licht und Schatten ausgleichen (Stufe Foto/Scan/Schwarz-Weiß),
// drehen. „Fertig“ baut eine PDF (ein JPEG je Seite) und legt das Stück an —
// wie jeder Import: Bytes in `dateien`, kein Server. Rechnen in @/domain/scan.

// Lange Seite des gespeicherten Bilds und der Vorschau (Gerätepixel).
const ERGEBNIS_PX = 2000;
const VORSCHAU_PX = 900;
// Eine Seite soll als JPEG etwa darunter bleiben.
const ZIEL_BYTES = 500_000;
const STUFE_SCHLUESSEL = 'ueben:scan-stufe';

export type ScanArt = 'kamera' | 'fotos';

interface Seite { id: string; quelle: Bild; ecken: Ecken; drehung: number; name: string }

// Grobe Zeiger: Telefon oder Tablet — dort öffnet `capture` die Kamera direkt.
export const istTouchGeraet = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
// Am Rechner statt `capture` eine Live-Kamera über getUserMedia.
const kannLiveKamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !istTouchGeraet();

// Bilder wählen: Kamera (capture) oder Fotos aus der Mediathek. Mehrere Fotos
// auf einmal; die Kamera liefert je Aufnahme eine Datei.
export function bilderWaehlen(art: ScanArt): Promise<File[]> {
  return new Promise((ok) => {
    let fertig = false;
    const ende = (liste: File[]) => { if (!fertig) { fertig = true; ok(liste); } };
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (art === 'kamera') input.setAttribute('capture', 'environment'); else input.multiple = true;
    input.onchange = () => ende([...(input.files ?? [])]);
    input.oncancel = () => ende([]);
    window.addEventListener('focus', () => window.setTimeout(() => { if (!input.files?.length) ende([]); }, 1500), { once: true });
    input.click();
  });
}

// Eine Bilddatei als Pixel, auf die lange Seite ERGEBNIS_PX verkleinert. Der
// Browser dreht nach EXIF (image-orientation: from-image ist Standard).
async function bildLaden(datei: Blob): Promise<Bild> {
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return vonElement(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}

function vonElement(quelle: CanvasImageSource, qb: number, qh: number): Bild {
  const f = Math.min(1, ERGEBNIS_PX / Math.max(qb, qh));
  const b = Math.max(1, Math.round(qb * f)), h = Math.max(1, Math.round(qh * f));
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(quelle, 0, 0, b, h);
  const d = ctx.getImageData(0, 0, b, h);
  return { daten: d.data, b, h };
}

function aufLeinwand(bild: Bild, c: HTMLCanvasElement) {
  c.width = bild.b; c.height = bild.h;
  c.getContext('2d')!.putImageData(new ImageData(bild.daten, bild.b, bild.h), 0, 0);
}

// Das fertige Blatt einer Seite: entzerrt, aufbereitet, gedreht.
function seiteRechnen(s: Seite, stufe: Stufe, maxLang: number): Bild {
  const entzerrt = entzerren(s.quelle, s.ecken, zielmass(s.ecken, s.quelle.b, s.quelle.h, maxLang));
  return drehen(aufbereiten(entzerrt, stufe), s.drehung);
}

// JPEG mit so viel Qualität, wie unter ZIEL_BYTES passt (nicht unter 0,5).
async function alsJpeg(bild: Bild): Promise<Seitenbild> {
  const c = document.createElement('canvas');
  aufLeinwand(bild, c);
  const blob = (q: number) => new Promise<Blob>((ok, fehler) => c.toBlob((b) => (b ? ok(b) : fehler(new Error('Das Bild ließ sich nicht als JPEG speichern.'))), 'image/jpeg', q));
  let q = 0.85, datei = await blob(q);
  while (datei.size > ZIEL_BYTES && q > 0.5) { q -= 0.1; datei = await blob(q); }
  return { jpeg: new Uint8Array(await datei.arrayBuffer()), b: bild.b, h: bild.h };
}

// Dem Hauptfaden Luft lassen, damit Fortschritt und Hinweise gezeichnet werden.
const luft = () => new Promise<void>((ok) => setTimeout(ok, 0));

export function ScanDialog({ art, start, sammlungen, tags, fertig, schliessen }: {
  art: ScanArt;
  // Die zuerst gewählten Bilder (Kamera: eine Aufnahme; Fotos: mehrere).
  start: File[];
  sammlungen: string[]; tags: string[];
  fertig: (meldung: string) => void;
  schliessen: () => void;
}) {
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [stufe, setStufe] = useState<Stufe>(() => { const s = gespeichert<string>(STUFE_SCHLUESSEL, 'scan'); return STUFEN.some((x) => x.stufe === s) ? (s as Stufe) : 'scan'; });
  const stufeSetzen = (s: Stufe) => { setStufe(s); speichern(STUFE_SCHLUESSEL, s); };
  const [titel, setTitel] = useState('');
  const [rand, setRand] = useState(false); // Ecken ziehen statt Ergebnis
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');
  const [kamera, setKamera] = useState(false);
  const fokus = useDialogFokus<HTMLDivElement>();
  useEscape(() => { if (!laeuft && !kamera) schliessen(); });

  // Bilder aufnehmen: laden, Blattrand suchen, anhängen.
  const aufnehmen = useCallback(async (dateien: File[]) => {
    if (!dateien.length) return;
    setLaeuft(`${dateien.length === 1 ? 'Bild' : `${dateien.length} Bilder`} werden gelesen …`);
    setFehler('');
    const neue: Seite[] = [];
    const kaputt: string[] = [];
    for (const d of dateien) {
      try {
        const quelle = await bildLaden(d);
        await luft();
        neue.push({ id: crypto.randomUUID(), quelle, ecken: blattrand(quelle), drehung: 0, name: d.name });
      } catch { kaputt.push(d.name || 'Bild'); }
      await luft();
    }
    setSeiten((alt) => { const l = [...alt, ...neue]; setAktiv(Math.max(0, l.length - neue.length)); return l; });
    if (kaputt.length) setFehler(`Nicht lesbar: ${kaputt.join(', ')}. HEIC-Fotos kann dieser Browser womöglich nicht öffnen — in der Fotos-App als JPEG teilen.`);
    setLaeuft(null);
  }, []);
  const gestartet = useRef(false);
  useEffect(() => { if (!gestartet.current) { gestartet.current = true; void aufnehmen(start); } }, [start, aufnehmen]);

  const weitere = () => {
    if (art === 'kamera' && kannLiveKamera()) { setKamera(true); return; }
    void bilderWaehlen(art).then(aufnehmen);
  };

  const seite = seiten[aktiv] as Seite | undefined;
  const aendern = (f: (s: Seite) => Seite) => setSeiten((l) => l.map((s, i) => (i === aktiv ? f(s) : s)));
  const entfernen = () => { setSeiten((l) => l.filter((_, i) => i !== aktiv)); setAktiv((a) => Math.max(0, a - 1)); };
  const schieben = (d: number) => {
    const ziel = aktiv + d;
    if (ziel < 0 || ziel >= seiten.length) return;
    setSeiten((l) => { const n = [...l]; [n[aktiv], n[ziel]] = [n[ziel], n[aktiv]]; return n; });
    setAktiv(ziel);
  };

  async function speichernUndSchliessen() {
    if (!seiten.length) return;
    setFehler('');
    try {
      const bilder: Seitenbild[] = [];
      for (let i = 0; i < seiten.length; i++) {
        setLaeuft(`Seite ${i + 1} von ${seiten.length} wird aufbereitet …`);
        await luft();
        bilder.push(await alsJpeg(seiteRechnen(seiten[i], stufe, ERGEBNIS_PX)));
      }
      setLaeuft('PDF wird geschrieben …');
      await luft();
      const name = titel.trim() || 'Scan';
      const pdf = pdfBauen(bilder, name);
      const datei = new Blob([pdf], { type: 'application/pdf' });
      await stueckAnlegen({
        titel: name, stimme: '', datei, dateiname: scanDateiname(name, new Date()),
        ...(sammlungen.length ? { sammlungen } : {}), ...(tags.length ? { tags } : {}),
      });
      const kb = Math.round(datei.size / 1024);
      fertig(`„${name}“ mit ${seiten.length} ${seiten.length === 1 ? 'Seite' : 'Seiten'} angelegt (${kb} KB)${sammlungen.length ? `, in „${sammlungen.join(', ')}“` : ''}.`);
    } catch (x) {
      setFehler(`Speichern ging nicht: ${fehlerGrund(x)}`);
      setLaeuft(null);
    }
  }

  // Über allem (auch der unteren Leiste): am body, nicht im Bibliothek-Overlay.
  return createPortal(
    <div className="scan-dialog" role="dialog" aria-modal="true" aria-label="Noten einscannen" ref={fokus} tabIndex={-1}>
      <div className="panel-kopf mit-linie">
        <h2>{art === 'kamera' ? 'Einscannen' : 'Fotos als Noten'}</h2>
        <span className="bib-anzahl">{seiten.length ? `· ${seiten.length} ${seiten.length === 1 ? 'Seite' : 'Seiten'}` : ''}</span>
        <span className="flex-1" />
        <button type="button" className="panel-zu" onClick={schliessen} disabled={!!laeuft} aria-label="Abbrechen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>

      <div className="scan-inhalt">
        {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
        {!seiten.length && !laeuft && (
          <div className="karte space-y-3">
            <p>{art === 'kamera' ? 'Jede Seite einzeln aufnehmen: Blatt möglichst ganz im Bild, dunkler Untergrund hilft beim Finden des Rands.' : 'Fotos von Noten wählen — je Foto eine Seite. Schatten und schiefes Licht werden herausgerechnet.'}</p>
            <button type="button" className="knopf" onClick={weitere}>{art === 'kamera' ? 'Aufnehmen' : 'Fotos wählen'}</button>
          </div>
        )}
        {seite && (
          <Blatt seite={seite} stufe={stufe} rand={rand} aendern={aendern} />
        )}
        {seite && (
          <div className="scan-werkzeuge">
            <div className="segment !mx-0" role="group" aria-label="Aufbereitung">
              {STUFEN.map((s) => (
                <button key={s.stufe} type="button" aria-pressed={stufe === s.stufe} onClick={() => stufeSetzen(s.stufe)} title={s.hinweis}>{s.name}</button>
              ))}
            </div>
            <button type="button" className={`knopf knopf-klein ${rand ? '' : 'knopf-leise'}`} aria-pressed={rand} onClick={() => setRand(!rand)}>{rand ? 'Rand fertig' : 'Rand anpassen'}</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => aendern((s) => ({ ...s, drehung: (s.drehung + 1) % 4 }))} aria-label="Um 90° drehen">↻ Drehen</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={entfernen}>Seite entfernen</button>
          </div>
        )}
        <p className="gedaempft text-xs">{STUFEN.find((s) => s.stufe === stufe)?.hinweis}{rand ? ' · Ecken ziehen, bis der Rahmen auf dem Blattrand liegt.' : ''}</p>

        {seiten.length > 0 && (
          <ol className="scan-seiten" aria-label="Seiten">
            {seiten.map((s, i) => (
              <li key={s.id} className={i === aktiv ? 'aktiv' : undefined}>
                <button type="button" onClick={() => setAktiv(i)} aria-label={`Seite ${i + 1}`} aria-current={i === aktiv ? 'true' : undefined}>
                  <Daumen seite={s} stufe={stufe} />
                  <span className="tabular-nums">{i + 1}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="scan-plus" onClick={weitere} aria-label={art === 'kamera' ? 'Weitere Seite aufnehmen' : 'Weitere Fotos wählen'} disabled={!!laeuft}>
                <span aria-hidden="true">+</span><span>{art === 'kamera' ? 'Aufnehmen' : 'Fotos'}</span>
              </button>
            </li>
          </ol>
        )}
        {seiten.length > 1 && (
          <div className="flex gap-2 text-sm">
            <button type="button" className="knopf knopf-leise knopf-klein" disabled={aktiv === 0} onClick={() => schieben(-1)}>← nach vorn</button>
            <button type="button" className="knopf knopf-leise knopf-klein" disabled={aktiv === seiten.length - 1} onClick={() => schieben(1)}>nach hinten →</button>
          </div>
        )}
      </div>

      <form className="scan-fuss" onSubmit={(e) => { e.preventDefault(); void speichernUndSchliessen(); }}>
        <input className="feld" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel des Stücks" aria-label="Titel" disabled={!!laeuft} />
        <button type="submit" className="knopf" disabled={!seiten.length || !!laeuft}>{laeuft ?? `Fertig${seiten.length ? ` (${seiten.length})` : ''}`}</button>
      </form>
      {kamera && <LiveKamera aufgenommen={(d) => { setKamera(false); void aufnehmen(d ? [d] : []); }} />}
    </div>,
    document.body,
  );
}

// ── Die aktive Seite: Ergebnis-Vorschau oder Quelle mit ziehbaren Ecken ──

function Blatt({ seite, stufe, rand, aendern }: { seite: Seite; stufe: Stufe; rand: boolean; aendern: (f: (s: Seite) => Seite) => void }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  // Vorschau in Bildschirmgröße, nach kurzer Ruhe (Ecken ziehen, Stufe
  // wechseln); solange steht „wird aufbereitet“ über dem alten Bild.
  const hinweis = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    if (rand) { aufLeinwand(seite.quelle, c); return; }
    if (hinweis.current) hinweis.current.hidden = false;
    const t = window.setTimeout(() => {
      aufLeinwand(seiteRechnen(seite, stufe, VORSCHAU_PX), c);
      if (hinweis.current) hinweis.current.hidden = true;
    }, 30);
    return () => window.clearTimeout(t);
  }, [seite, stufe, rand]);

  // Ecken ziehen: Zeiger auf der Fläche, Anteile des Bilds.
  const flaeche = useRef<HTMLDivElement>(null);
  const zieht = useRef<number | null>(null);
  const anteil = (e: React.PointerEvent): Punkt => {
    const r = flaeche.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const naechsteEcke = (p: Punkt) => {
    let best = 0, d = Infinity;
    seite.ecken.forEach((e, i) => { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < d) { d = dd; best = i; } });
    return d < 0.2 ? best : null;
  };
  const ab = (e: React.PointerEvent) => {
    const i = naechsteEcke(anteil(e));
    if (i === null) return;
    zieht.current = i; (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const zu = (e: React.PointerEvent) => {
    if (zieht.current === null) return;
    const i = zieht.current, p = anteil(e);
    aendern((s) => ({ ...s, ecken: eckeSetzen(s.ecken, i, p) }));
  };
  const los = () => { zieht.current = null; };

  const pfad = useMemo(() => seite.ecken.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(2)} ${(p.y * 100).toFixed(2)}`).join(' ') + ' Z', [seite.ecken]);
  const format = rand ? seite.quelle.h / seite.quelle.b : (() => { const z = zielmass(seite.ecken, seite.quelle.b, seite.quelle.h, 100); return seite.drehung % 2 ? z.b / z.h : z.h / z.b; })();

  return (
    <div className="scan-blatt" style={{ aspectRatio: `1 / ${format}` }}>
      <div ref={flaeche} className={`scan-flaeche ${rand ? 'rand' : ''}`} onPointerDown={rand ? ab : undefined} onPointerMove={rand ? zu : undefined} onPointerUp={los} onPointerCancel={los}>
        <canvas ref={leinwand} />
        {rand && (
          <svg className="scan-rahmen" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={`M0 0H100V100H0Z ${pfad}`} fillRule="evenodd" className="scan-dunkel" />
            <path d={pfad} className="scan-kante" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {rand && seite.ecken.map((p, i) => (
          <span key={i} className="scan-griff" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} aria-hidden="true" />
        ))}
        {!rand && <span ref={hinweis} className="scan-rechnet" hidden>wird aufbereitet …</span>}
      </div>
    </div>
  );
}

// Kleines Vorschaubild je Seite (aus der verkleinerten Quelle, mit Rahmen).
function Daumen({ seite, stufe }: { seite: Seite; stufe: Stufe }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = c.current;
    if (!el) return;
    const t = window.setTimeout(() => aufLeinwand(seiteRechnen(seite, stufe, 160), el), 50);
    return () => window.clearTimeout(t);
  }, [seite, stufe]);
  return <canvas ref={c} className="scan-daumen" />;
}

// ── Live-Kamera am Rechner (getUserMedia) ──

function LiveKamera({ aufgenommen }: { aufgenommen: (datei: File | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    let strom: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 3000 }, height: { ideal: 2000 } }, audio: false })
      .then((s) => { strom = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } })
      .catch((x) => setFehler(`Kamera nicht verfügbar: ${(x as Error).message}`));
    return () => { strom?.getTracks().forEach((t) => t.stop()); };
  }, []);
  const ausloesen = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => aufgenommen(b ? new File([b], 'Aufnahme.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.95);
  };
  return (
    <div className="scan-kamera" role="dialog" aria-label="Kamera">
      {fehler ? <p className="karte warnung">{fehler}</p> : <video ref={video} playsInline muted />}
      <div className="flex justify-center gap-3 p-3">
        <button type="button" className="knopf knopf-leise" onClick={() => aufgenommen(null)}>Abbrechen</button>
        <button type="button" className="knopf" onClick={ausloesen} disabled={!!fehler}>Auslösen</button>
      </div>
    </div>
  );
}
