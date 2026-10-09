'use client';

import { useRef, useState, type ReactNode } from 'react';
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

// Alle Noten, Stellen und Anmerkungen als eine .uebe-Datei speichern und wieder
// laden — zum Umzug aus der Registerführer-App und als Schutz, falls der
// Browser die Gerätedaten löscht. Meldungen zum Laden zeigt die Notenliste.
export function Sicherung({ leer, laden }: { leer: boolean; laden: SicherungLaden }) {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const [teilbar, setTeilbar] = useState<File | null>(null);

  async function speichern() {
    setLaeuft(true); setMeldung(''); setFehler(''); setTeilbar(null);
    try {
      const inhalt = await sicherungErstellen();
      const name = sicherungsName(new Date());
      const url = URL.createObjectURL(inhalt);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Etwas warten, sonst bricht der Download in manchen Browsern (Safari) ab.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMeldung(`Sicherung gespeichert: „${name}“ (${groesse(inhalt.size)}). Sie liegt bei den Downloads bzw. in der Dateien-App.`);
      // Teilen (AirDrop, Mail, „In Dateien sichern“) erst auf eigenen Tipp:
      // Der Browser verlangt dafür eine frische Berührung.
      const datei = new File([inhalt], name, { type: 'application/octet-stream' });
      const nav = navigator as TeilenNavigator;
      try { if ('share' in nav && nav.canShare?.({ files: [datei] })) setTeilbar(datei); } catch { /* kein Teilen */ }
    } catch (e) {
      setFehler(`Sicherung fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setLaeuft(false);
    }
  }

  async function teilen() {
    if (!teilbar) return;
    try {
      await navigator.share({ files: [teilbar], title: teilbar.name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setFehler(`Teilen ging nicht: ${(e as Error).message}`);
    }
  }

  return (
    <section className="karte space-y-3" aria-label="Sicherung">
      <h2 className="abschnitt-titel">Sicherung</h2>
      <p className="gedaempft text-sm">
        Eine Datei mit allen Noten, markierten Stellen, Tempi und Anmerkungen dieses Geräts. Laden ergänzt die Liste;
        Noten, die es schon gibt, werden nach Rückfrage samt Stellen und Anmerkungen durch den Stand der Sicherung ersetzt,
        alle anderen bleiben.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf" onClick={() => void speichern()} disabled={leer || laeuft || laden.laeuft}>
          {laeuft ? 'Sicherung wird erstellt …' : 'Sicherung speichern'}
        </button>
        {teilbar && <button type="button" className="knopf knopf-leise" onClick={() => void teilen()}>Teilen …</button>}
        <button type="button" className="knopf knopf-leise" onClick={laden.waehlen} disabled={laeuft || laden.laeuft}>
          {laden.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
        </button>
      </div>
      {meldung && <p className="text-sm" role="status">{meldung}</p>}
      {fehler && <p className="warnung text-sm" role="alert">{fehler}</p>}
    </section>
  );
}

const zeitpunkt = (t: number) => Number.isFinite(t)
  ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
  : 'unbekanntem Datum';

const groesse = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
