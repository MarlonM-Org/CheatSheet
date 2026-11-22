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
  useEscape(schliessen, !notenblatt);
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
                <h2 className="text-xl font-extrabold">Zum Bearbeiten umwandeln</h2>
                <p className="gedaempft">{stueck.titel}</p>
              </div>
              <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>{fertigMeldung ? 'Fertig' : 'Abbrechen'}</button>
            </div>
            <p className="text-sm">
              Noten auf einem Bild kann CheatSheet nicht selbst lesen. Das übernimmt eine Noten-Erkennungs-App auf dem iPad, etwa
              PlayScore 2 oder Newzik (der Export als MusicXML gehört dort meist zum Abo). Aus ihrer MusicXML-Datei wird hier ein
              neues Stück, das sich im Notenblatt bearbeiten, vorspielen und transponieren lässt. Das Original bleibt, wie es ist.
            </p>
            <ol className="umwandeln-schritte">
              <li>
                <strong>PDF an die Erkennungs-App geben.</strong>
                <span className="gedaempft text-sm"> Im Teilen-Menü die App wählen — oder „In Dateien sichern“ und die Datei dort öffnen.{ausschnitt}</span>
                <div>
                  {!pdf ? <button type="button" className="knopf knopf-leise knopf-klein" disabled>PDF teilen …</button>
                    : pdf.teilbar ? <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => void teilen()}>PDF teilen …</button>
                      : <a className="knopf knopf-leise knopf-klein" href={pdf.url} download={pdf.datei.name}>PDF sichern</a>}
                </div>
              </li>
              <li>
                <strong>Erkennen lassen und prüfen.</strong>
                <span className="gedaempft text-sm"> Grobe Fehler gleich dort korrigieren, dann als MusicXML exportieren und „In Dateien sichern“.</span>
              </li>
              <li>
                <strong>Hier übernehmen.</strong>
                <span className="gedaempft text-sm"> Die Datei (.musicxml, .mxl oder .xml) aus „Dateien“ wählen.</span>
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
