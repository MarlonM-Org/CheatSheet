'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Stueck } from '@/domain/bestand';
import { KeineNoten, KeinXml, musicXmlLesen, musicXmlText, type Umwandlung } from '@/domain/musicxml';
import { sammlungenVon } from '@/domain/sammlungen';
import { taktartText } from '@/domain/takt';
import { ohneCancelAbbrechen } from './dateiwahl';
import { EinspielenDialog } from './Einspielen';
import { stueckDatei } from './lokal';
import { fehlerGrund } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';

// Zum Bearbeiten umwandeln (G-11): Noten auf einem Bild (PDF, Foto, Scan)
// liest eine Erkennungs-App auf dem iPad (PlayScore 2, Newzik …) — die App
// hier kann das nicht selbst. Das Blatt führt durch die drei Schritte: PDF
// an die App geben, dort erkennen lassen und als MusicXML sichern, die Datei
// hier wählen. Dann öffnet das Notenblatt den Entwurf; „Als Stück speichern“
// legt ein neues Stück an (gleiche Sammlungen und Tags), das Original bleibt.
// Das „i“ neben der Überschrift erklärt, warum es eine zweite App braucht und
// welche (Wunsch Marlon 2026-11-22: „warum man was tut“).

type TeilenNavigator = Navigator & { canShare?: (d: { files: File[] }) => boolean };

// Ohne `accept`: iOS graut Dateien aus, deren Endung es keiner App zuordnet
// (.musicxml, .mxl ohne installiertes Notenprogramm). Geprüft wird nach der Wahl.
function dateiWaehlen(): Promise<File | null> {
  return new Promise((ok) => {
    let fertig = false;
    const ende = (f: File | null) => { if (!fertig) { fertig = true; ok(f); } };
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => ende(input.files?.[0] ?? null);
    input.oncancel = () => ende(null);
    ohneCancelAbbrechen(input, () => ende(null));
    input.click();
  });
}

const pdfName = (s: Stueck) => (s.dateiname?.toLowerCase().endsWith('.pdf') ? s.dateiname : `${s.titel.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Noten'}.pdf`);

function zusammenfassung({ gelesen }: Umwandlung): string {
  const s = gelesen.stimmen.length, t = gelesen.takte.length, r = gelesen.raster;
  return [
    `${s} ${s === 1 ? 'Stimme' : 'Stimmen'}`,
    `${t} ${t === 1 ? 'Takt' : 'Takte'}`,
    taktartText(r.zaehler, r.nenner),
    gelesen.tonart?.name ?? 'ohne Tonart',
    `Tempo ${r.bpm}`,
  ].join(' · ');
}

export function UmwandelnBlatt({ stueck, angelegt, schliessen }: {
  stueck: Stueck;
  // Ein neues Stück liegt in der Bibliothek (Liste neu laden).
  angelegt?: () => void;
  schliessen: () => void;
}) {
  const [pdf, setPdf] = useState<{ datei: File; url: string; teilbar: boolean } | null>(null);
  const [ergebnis, setErgebnis] = useState<{ umwandlung: Umwandlung; name: string } | null>(null);
  const [fehler, setFehler] = useState('');
  const [liest, setLiest] = useState(false);
  const [notenblatt, setNotenblatt] = useState(false);
  const [fertigMeldung, setFertigMeldung] = useState('');
  const [info, setInfo] = useState(false);
  useEscape(schliessen, !notenblatt && !info);
  const fokus = useDialogFokus<HTMLDivElement>();
  // Auf dem Telefon liegt das Ergebnis unter dem Knopf außer Sicht: nur dann hinscrollen.
  const ergebnisKarte = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ergebnis) ergebnisKarte.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [ergebnis]);

  // Die PDF schon beim Öffnen holen: Teilen muss direkt im Tipp passieren
  // (iOS lässt es sonst nicht zu).
  useEffect(() => {
    let weg = false, url: string | null = null;
    stueckDatei(stueck).then((b) => {
      if (weg) return;
      const datei = new File([b], pdfName(stueck), { type: 'application/pdf' });
      url = URL.createObjectURL(datei);
      let teilbar = false;
      try { teilbar = 'share' in navigator && !!(navigator as TeilenNavigator).canShare?.({ files: [datei] }); } catch { /* kein Teilen */ }
      setPdf({ datei, url, teilbar });
    }, () => { if (!weg) setFehler('Die PDF dieses Stücks ist auf diesem Gerät nicht lesbar — „Datei neu wählen“ im ⋯-Menü holt sie zurück.'); });
    return () => { weg = true; if (url) URL.revokeObjectURL(url); };
  }, [stueck]);

  async function teilen() {
    if (!pdf) return;
    try {
      // Nur die Datei: mit Titel oder Text bieten sich manche Ziele nicht an.
      await navigator.share({ files: [pdf.datei] });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.name !== 'AbortError') setFehler(`Teilen ging nicht: ${err.message}`);
    }
  }

  async function waehlen() {
    const f = await dateiWaehlen();
    if (!f) return;
    setFehler(''); setErgebnis(null); setFertigMeldung(''); setLiest(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        throw new KeineNoten(`„${f.name}“ ist eine PDF — gebraucht wird die MusicXML-Datei, die die Erkennungs-App exportiert (.musicxml, .mxl oder .xml).`);
      }
      setErgebnis({ umwandlung: musicXmlLesen(await musicXmlText(bytes)), name: f.name });
    } catch (x) {
      setFehler(x instanceof KeineNoten ? x.message
        : x instanceof KeinXml ? `„${f.name}“ ist keine MusicXML-Datei. Gebraucht wird der Export der Erkennungs-App als MusicXML (.musicxml, .mxl oder .xml).`
          : `„${f.name}“ lässt sich nicht lesen: ${fehlerGrund(x)}`);
    } finally {
      setLiest(false);
    }
  }

  const ausschnitt = stueck.quelle ? ` Dieses Stück sind die Seiten ${stueck.quelle.von}–${stueck.quelle.bis} einer größeren PDF; geteilt wird die ganze.` : '';

  return (
    <>
      {createPortal(
        <div className="blatt-hintergrund" onClick={schliessen}>
          <div ref={fokus} tabIndex={-1} className="blatt umwandeln space-y-4" role="dialog" aria-modal="true" aria-label={`Zum Bearbeiten umwandeln: ${stueck.titel}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold">Zum Bearbeiten umwandeln</h2>
                  <button type="button" className="nav-info" onClick={() => setInfo(true)} aria-label="Warum eine zweite App, und welche?" title="Warum eine zweite App, und welche?">i</button>
                </div>
                <p className="gedaempft">{stueck.titel}</p>
              </div>
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>{fertigMeldung ? 'Fertig' : 'Abbrechen'}</button>
            </div>
            <p className="text-sm">
              Zum Bearbeiten, Transponieren und Vorspielen braucht CheatSheet jede Note einzeln. Auf einer PDF oder einem Foto
              sind die Noten aber nur ein Bild. Herauslesen muss sie eine Noten-Erkennungs-App auf dem iPad, etwa PlayScore 2
              oder Newzik — warum und welche, steht hinter dem „i“.
            </p>
            <ol className="umwandeln-schritte">
              <li>
                <strong>PDF an die Erkennungs-App geben.</strong>
                <span className="gedaempft text-sm"> Dort werden die Noten gelesen. Im Teilen-Menü die App wählen — oder „In Dateien sichern“ und die PDF in der App öffnen.{ausschnitt}</span>
                <div>
                  {!pdf ? <button type="button" className="knopf knopf-leise knopf-klein" disabled>PDF teilen …</button>
                    : pdf.teilbar ? <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => void teilen()}>PDF teilen …</button>
                      : <a className="knopf knopf-leise knopf-klein" href={pdf.url} download={pdf.datei.name}>PDF sichern</a>}
                </div>
              </li>
              <li>
                <strong>Erkennen lassen, prüfen, als MusicXML sichern.</strong>
                <span className="gedaempft text-sm"> Was dort schon stimmt, musst du hier nicht mehr korrigieren. MusicXML ist das Austauschformat, das Notenprogramme verstehen — auch CheatSheet. In der App exportieren und „In Dateien sichern“.</span>
              </li>
              <li>
                <strong>Hier übernehmen.</strong>
                <span className="gedaempft text-sm"> Die Datei (.musicxml, .mxl oder .xml) aus „Dateien“ wählen. Daraus wird ein neues Stück zum Bearbeiten; das Original bleibt mit Stellen und Anmerkungen.</span>
                <div>
                  <button type="button" className="knopf knopf-klein" onClick={() => void waehlen()} disabled={liest}>{liest ? 'Wird gelesen …' : 'MusicXML-Datei wählen …'}</button>
                </div>
              </li>
            </ol>
            {fehler && <p className="karte warnung text-sm" role="alert">{fehler}</p>}
            {fertigMeldung && <p className="karte text-sm" role="status">{fertigMeldung} Das Original bleibt daneben in der Bibliothek.</p>}
            {ergebnis && !fertigMeldung && (
              <div ref={ergebnisKarte} className="karte space-y-2">
                <p className="text-sm"><strong>{ergebnis.name}</strong></p>
                <p className="text-sm">{zusammenfassung(ergebnis.umwandlung)}</p>
                {ergebnis.umwandlung.hinweise.length > 0 && (
                  <>
                    <p className="text-sm font-semibold">Beim Umwandeln:</p>
                    <ul className="umwandeln-hinweise text-sm">
                      {ergebnis.umwandlung.hinweise.map((h) => <li key={h}>{h}</li>)}
                    </ul>
                  </>
                )}
                <p className="gedaempft text-xs">Ein Entwurf — keine Erkennung ist fehlerfrei. Im Notenblatt mit dem Original vergleichen und nachbessern.</p>
                <button type="button" className="knopf" onClick={() => setNotenblatt(true)}>Im Notenblatt öffnen</button>
              </div>
            )}
            {info && <UmwandelnInfo schliessen={() => setInfo(false)} />}
          </div>
        </div>,
        document.body,
      )}
      {notenblatt && ergebnis && (
        <EinspielenDialog quelle="leer" entwurf={{ gelesen: ergebnis.umwandlung.gelesen, titel: stueck.titel }}
          sammlungen={sammlungenVon(stueck)} tags={stueck.tags ?? []}
          fertig={(m) => { setNotenblatt(false); setFertigMeldung(m); angelegt?.(); }}
          schliessen={() => setNotenblatt(false)} />
      )}
    </>
  );
}

// Hinter dem „i“: warum eine zweite App, welche, warum MusicXML, was danach
// passiert. Liegt über dem Blatt; Tippen irgendwo schließt (wie bei den Stellen).
function UmwandelnInfo({ schliessen }: { schliessen: () => void }) {
  useEscape(schliessen);
  return createPortal(
    <div className="stellen-info" role="dialog" aria-modal="true" aria-label="Warum eine zweite App?" onClick={schliessen}>
      <div className="stellen-info-karte">
        <p className="abschnitt-titel !text-lg">Warum eine zweite App?</p>
        <ul className="stichpunkte text-sm">
          <li>Eine PDF oder ein Foto ist für CheatSheet ein Bild aus Punkten. Welche Note wo steht, weiß die App nicht.</li>
          <li>Bearbeiten, transponieren und vorspielen geht nur, wenn jede Note als Tonhöhe und Dauer vorliegt — wie bei selbst geschriebenen Stücken.</li>
          <li>Noten aus einem Bild zu lesen heißt Notenerkennung. Dafür braucht es große, trainierte Erkennungsprogramme. CheatSheet läuft ohne Server und ohne Konto ganz auf deinem Gerät und hat so etwas nicht eingebaut.</li>
        </ul>
        <p className="text-sm font-semibold">Welche App?</p>
        <ul className="stichpunkte text-sm">
          <li><strong>PlayScore 2</strong>: liest Fotos und PDFs, auch mehrere Seiten.</li>
          <li><strong>Newzik</strong>: Notenleser, macht aus PDFs bearbeitbare Noten.</li>
          <li>Den Export als MusicXML gibt es bei beiden meist nur im Abo. Jede andere App, die MusicXML exportiert, geht auch. Mit CheatSheet ausprobiert ist noch keine davon.</li>
        </ul>
        <p className="text-sm font-semibold">Warum MusicXML?</p>
        <ul className="stichpunkte text-sm">
          <li>Das gemeinsame Format für Noten: Notenprogramme schreiben und lesen es, CheatSheet liest es ein.</li>
        </ul>
        <p className="text-sm font-semibold">Was danach passiert</p>
        <ul className="stichpunkte text-sm">
          <li>Aus der Datei wird ein neues Stück in denselben Sammlungen, mit denselben Tags. Das Original bleibt mit Stellen und Anmerkungen.</li>
          <li>Keine Erkennung ist fehlerfrei: Takte, die nicht aufgehen, sind im Notenblatt rot. Wiederholungen, Dynamik und Liedtext fallen weg — was genau, sagt CheatSheet vor dem Öffnen.</li>
        </ul>
        <p className="text-sm font-semibold">Deine Noten</p>
        <ul className="stichpunkte text-sm">
          <li>Die Erkennungs-App bekommt die PDF, die du ihr gibst. Ob sie auf dem iPad rechnet oder hochlädt, steht in ihrer Beschreibung. CheatSheet selbst schickt nichts weg.</li>
        </ul>
        <p className="gedaempft text-xs">Tippen schließt</p>
      </div>
    </div>,
    document.body,
  );
}
