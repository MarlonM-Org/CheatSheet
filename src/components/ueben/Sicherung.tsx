'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SicherungsFehler, sicherungsName } from '@/domain/sicherung';
import { sicherungErstellen, sicherungPruefen, sicherungSchreiben } from './lokal';

type TeilenNavigator = Navigator & { canShare?: (d: { files: File[] }) => boolean };

export interface SicherungLaden {
  waehlen: () => void;
  laeuft: boolean;
  meldung: string;
  fehler: string;
  // Die versteckte Dateiauswahl; einmal irgendwo in die Seite setzen.
  eingabe: ReactNode;
}

// Sicherung laden — als Hook, damit die leere Notenliste denselben Ablauf
// anbieten kann wie die Sicherungs-Karte. Erst prüfen und abgleichen, bei
// Überschneidungen nachfragen, dann alles auf einmal schreiben.
export function useSicherungLaden(geaendert: () => void): SicherungLaden {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const auswahl = useRef<HTMLInputElement>(null);

  async function laden(datei: File | undefined) {
    if (!datei) return;
    setLaeuft(true); setMeldung(''); setFehler('');
    try {
      const e = await sicherungPruefen(datei);
      if (e.ersetzt.length && !confirm(
        `${e.ersetzt.length} Noten (mit ihren Stellen und Anmerkungen) gibt es schon auf diesem Gerät. `
        + `Durch den Stand der Sicherung vom ${zeitpunkt(e.erstellt)} ersetzen?`,
      )) {
        setMeldung('Nichts geladen — auf diesem Gerät ist alles wie vorher.');
        return;
      }
      const n = await sicherungSchreiben(e);
      setMeldung(`Sicherung geladen: ${n.neu} neu, ${n.ersetzt} ersetzt; ${n.stellen} ${n.stellen === 1 ? 'Stelle' : 'Stellen'}, `
        + `${n.anmerkungen} ${n.anmerkungen === 1 ? 'Seite' : 'Seiten'} mit Anmerkungen.`
        + (n.uebersprungen ? ` ${n.uebersprungen} ${n.uebersprungen === 1 ? 'Eintrag' : 'Einträge'} ohne zugehörige Noten übersprungen.` : ''));
      geaendert();
    } catch (x) {
      const err = x as Error;
      setFehler(x instanceof SicherungsFehler
        ? err.message
        : `Die Sicherung ließ sich nicht speichern: ${err.message}${err.name === 'QuotaExceededError' ? ' (Gerätespeicher voll)' : ''}`);
    } finally {
      setLaeuft(false);
    }
  }

  return {
    waehlen: () => auswahl.current?.click(),
    laeuft,
    meldung,
    fehler,
    // Bewusst ohne accept: iOS graut eigene Endungen wie .uebe sonst aus.
    eingabe: <input ref={auswahl} type="file" hidden onChange={(e) => { const d = e.target.files?.[0]; e.target.value = ''; void laden(d); }} />,
  };
}

interface Vorbereitet { url: string; datei: File }

// Als Home-Bildschirm-App gibt es keine Download-Leiste; Teilen ist dort der
// verlässliche Weg, die Datei in „Dateien“ abzulegen.
function alsApp(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

// Alle Noten, Stellen und Anmerkungen als eine .uebe-Datei speichern und wieder
// laden — zum Umzug aus der Registerführer-App und als Schutz, falls der
// Browser die Gerätedaten löscht. Meldungen zum Laden zeigt die Notenliste.
//
// Speichern geht in zwei Schritten: Erst packen, dann tippt die Person selbst
// auf einen echten Link bzw. „Teilen“. Safari auf iPad/iPhone lässt Download
// und Teilen nur aus einer frischen Berührung zu — nach dem Packen ist die
// erste Berührung längst verbraucht.
export function Sicherung({ leer, laden }: { leer: boolean; laden: SicherungLaden }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const [fertig, setFertig] = useState<Vorbereitet | null>(null);
  const [teilbar, setTeilbar] = useState(false);
  const [app, setApp] = useState(false);
  // Objekt-URL erst beim nächsten Vorbereiten oder beim Verlassen freigeben:
  // Ein Timer kann einen langsamen Download (großes PDF, iPad) abschneiden.
  const aktuelleUrl = useRef<string | null>(null);
  useEffect(() => () => { if (aktuelleUrl.current) URL.revokeObjectURL(aktuelleUrl.current); }, []);

  async function vorbereiten() {
    setLaeuft(true); setFehler('');
    if (aktuelleUrl.current) { URL.revokeObjectURL(aktuelleUrl.current); aktuelleUrl.current = null; }
    setFertig(null);
    try {
      const inhalt = await sicherungErstellen();
      const datei = new File([inhalt], sicherungsName(new Date()), { type: 'application/octet-stream' });
      const url = URL.createObjectURL(datei);
      aktuelleUrl.current = url;
      const nav = navigator as TeilenNavigator;
      let kannTeilen = false;
      try { kannTeilen = 'share' in nav && !!nav.canShare?.({ files: [datei] }); } catch { /* kein Teilen */ }
      setTeilbar(kannTeilen);
      setApp(alsApp());
      setFertig({ url, datei });
    } catch (e) {
      setFehler(`Sicherung fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setLaeuft(false);
    }
  }

  async function teilen() {
    if (!fertig) return;
    try {
      await navigator.share({ files: [fertig.datei], title: fertig.datei.name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setFehler(`Teilen ging nicht: ${(e as Error).message}`);
    }
  }

  const herunterladen = fertig && (
    <a key="laden" className={`knopf ${app && teilbar ? 'knopf-leise' : ''}`} href={fertig.url} download={fertig.datei.name}>
      Herunterladen ({groesse(fertig.datei.size)})
    </a>
  );
  const teilenKnopf = fertig && teilbar && (
    <button key="teilen" type="button" className={`knopf ${app ? '' : 'knopf-leise'}`} onClick={() => void teilen()}>
      Teilen / In Dateien sichern
    </button>
  );

  return (
    <section className="karte space-y-3" aria-label="Sicherung">
      <h2 className="abschnitt-titel">Sicherung</h2>
      <p className="gedaempft text-sm">
        Eine Datei mit allen Noten, markierten Stellen, Tempi und Anmerkungen dieses Geräts. Laden ergänzt die Liste;
        Noten, die es schon gibt, werden nach Rückfrage samt Stellen und Anmerkungen durch den Stand der Sicherung ersetzt,
        alle anderen bleiben.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`knopf ${fertig ? 'knopf-leise' : ''}`} onClick={() => void vorbereiten()} disabled={leer || laeuft || laden.laeuft}>
          {laeuft ? 'Sicherung wird gepackt …' : fertig ? 'Neu vorbereiten' : 'Sicherung vorbereiten'}
        </button>
        <button type="button" className="knopf knopf-leise" onClick={laden.waehlen} disabled={laeuft || laden.laeuft}>
          {laden.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
        </button>
      </div>
      {fertig && (
        <div className="space-y-2" role="status">
          <p className="text-sm">„{fertig.datei.name}“ ist bereit. Jetzt speichern:</p>
          <div className="flex flex-wrap gap-2">{app ? [teilenKnopf, herunterladen] : [herunterladen, teilenKnopf]}</div>
          <p className="gedaempft text-sm">
            {teilbar
              ? 'Auf iPad/iPhone: „Teilen“ → „In Dateien sichern“ legt sie in die Dateien-App; AirDrop und Mail gehen auch.'
              : 'Die Datei landet bei den Downloads.'}
          </p>
        </div>
      )}
      {fehler && <p className="warnung text-sm" role="alert">{fehler}</p>}
    </section>
  );
}

const zeitpunkt = (t: number) => Number.isFinite(t)
  ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
  : 'unbekanntem Datum';

const groesse = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
