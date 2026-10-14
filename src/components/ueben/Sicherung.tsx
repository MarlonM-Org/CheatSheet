'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { rueckfrage, ueberschreibt } from '@/domain/einspielen';
import { SicherungsFehler, sicherungsName } from '@/domain/sicherung';
import { zeitpunkt as kurzZeit } from '@/domain/notenpult';
import {
  letzteSicherung, sicherungErstellen, sicherungGespeichert, sicherungPruefen, sicherungSchreiben, vorgaengerDa, vorgaengerPruefen,
  type Einspielung,
} from './lokal';
import { fehlerGrund } from './speicherfehler';

type TeilenNavigator = Navigator & { canShare?: (d: { files: File[] }) => boolean };

export interface SicherungLaden {
  waehlen: () => void;
  // Die Noten aus der Vorgängerversion („ueben“) übernehmen — liest dort nur.
  uebernehmen: () => void;
  laeuft: boolean;
  uebernimmt: boolean;
  meldung: string;
  fehler: string;
  // Die versteckte Dateiauswahl; einmal irgendwo in die Seite setzen.
  eingabe: ReactNode;
}

// Sicherung laden — als Hook, damit die leere Notenliste denselben Ablauf
// anbieten kann wie die Sicherungs-Karte. Erst prüfen und abgleichen; gibt es
// schon etwas davon auf dem Gerät, nachfragen; dann alles auf einmal schreiben
// und dabei zusammenführen. Die Übernahme aus der Vorgängerversion läuft
// genauso, nur kommen die Daten aus „ueben“ statt aus einer Datei.
export function useSicherungLaden(geaendert: () => void): SicherungLaden {
  const [laeuft, setLaeuft] = useState(false);
  const [uebernimmt, setUebernimmt] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const auswahl = useRef<HTMLInputElement>(null);

  async function einspielen(woher: 'sicherung' | 'vorgaenger', pruefen: () => Promise<Einspielung>) {
    const vorgaenger = woher === 'vorgaenger';
    (vorgaenger ? setUebernimmt : setLaeuft)(true); setMeldung(''); setFehler('');
    try {
      const e = await pruefen();
      if (ueberschreibt(e) && !confirm(rueckfrage(e, zeitpunkt(e.erstellt), woher))) {
        setMeldung(`Nichts ${vorgaenger ? 'übernommen' : 'geladen'} — auf diesem Gerät ist alles wie vorher.`);
        return;
      }
      const n = await sicherungSchreiben(e);
      const dazu = [anzahl(n.lesezeichen, 'Lesezeichen', 'Lesezeichen'), anzahl(n.merker, 'Merker', 'Merker'), anzahl(n.setlisten, 'Setliste', 'Setlisten')].filter(Boolean);
      const ohnePdf = e.ohnePdf ?? [];
      setMeldung(`${vorgaenger ? 'Aus der Vorgängerversion übernommen' : 'Sicherung geladen'}: ${n.neu} Noten neu, ${n.aktualisiert} aktualisiert; `
        + `${anzahl(n.stellen, 'Stelle', 'Stellen', true)}, ${anzahl(n.anmerkungen, 'Seite', 'Seiten', true)} mit Anmerkungen`
        + (dazu.length ? `, ${dazu.join(', ')}.` : '.')
        + (n.geloescht ? ` ${anzahl(n.geloescht, 'Eintrag', 'Einträge')} gelöscht, weil auf dem anderen Gerät gelöscht.` : '')
        + (e.verworfen ? ` ${anzahl(e.verworfen, 'Eintrag', 'Einträge')} nicht wieder angelegt, weil hier gelöscht.` : '')
        + (n.uebersprungen ? ` ${anzahl(n.uebersprungen, 'Eintrag', 'Einträge')} ohne zugehörige Noten übersprungen.` : '')
        + (e.ungueltig ? ` ${anzahl(e.ungueltig, 'beschädigter Eintrag', 'beschädigte Einträge')} nicht übernommen.` : '')
        + (ohnePdf.length ? ` Ohne lesbare PDF (Stellen und Anmerkungen sind da): ${ohnePdf.join(', ')} — in der Bibliothek „Auswählen“, `
          + 'das Stück antippen, „Aktualisieren“ und die Datei neu wählen.' : '')
        + (n.einstellungen ? ' Einstellungen übernommen.' : ''));
      geaendert();
    } catch (x) {
      setFehler(x instanceof SicherungsFehler ? x.message
        : `${vorgaenger ? 'Die Übernahme' : 'Die Sicherung'} ließ sich nicht speichern: ${fehlerGrund(x)}`);
    } finally {
      (vorgaenger ? setUebernimmt : setLaeuft)(false);
    }
  }

  return {
    waehlen: () => auswahl.current?.click(),
    uebernehmen: () => void einspielen('vorgaenger', vorgaengerPruefen),
    laeuft,
    uebernimmt,
    meldung,
    fehler,
    // Bewusst ohne accept: iOS graut eigene Endungen wie .uebe sonst aus.
    eingabe: <input ref={auswahl} type="file" hidden onChange={(e) => {
      const d = e.target.files?.[0];
      e.target.value = '';
      if (d) void einspielen('sicherung', () => sicherungPruefen(d));
    }} />,
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

// Daten übertragen (in den Einstellungen): alle Noten, Stellen und Anmerkungen
// samt persönlichen Einstellungen als eine .uebe-Datei speichern und wieder laden — um auf ein anderes Gerät
// umzuziehen (auch aus der Registerführer-App) und als Schutz, falls der
// Browser die Gerätedaten löscht. Meldungen zum Laden zeigt, wer `laden` hält.
//
// Speichern geht in zwei Schritten: Erst packen, dann tippt die Person selbst
// auf einen echten Link bzw. „Teilen“. Safari auf iPad/iPhone lässt Download
// und Teilen nur aus einer frischen Berührung zu — nach dem Packen ist die
// erste Berührung längst verbraucht.
export function Sicherung({ laden }: { laden: SicherungLaden }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const [fertig, setFertig] = useState<Vorbereitet | null>(null);
  const [teilbar, setTeilbar] = useState(false);
  const [app, setApp] = useState(false);
  // Liegt noch die Datenbank der Vorgängerversion auf dem Gerät?
  const [vorgaenger, setVorgaenger] = useState(false);
  useEffect(() => { vorgaengerDa().then(setVorgaenger); }, []);
  // Wann zuletzt gespeichert (Herunterladen angetippt bzw. geteilt).
  const [letzte, setLetzte] = useState<number | null>(() => letzteSicherung());
  const gemerkt = () => { sicherungGespeichert(); setLetzte(letzteSicherung()); };
  // Objekt-URL erst beim nächsten Vorbereiten oder beim Verlassen freigeben:
  // Ein Timer kann einen langsamen Download (großes PDF, iPad) abschneiden.
  const aktuelleUrl = useRef<string | null>(null);
  useEffect(() => () => { if (aktuelleUrl.current) URL.revokeObjectURL(aktuelleUrl.current); }, []);

  async function vorbereiten() {
    setLaeuft(true); setFehler('');
    if (aktuelleUrl.current) { URL.revokeObjectURL(aktuelleUrl.current); aktuelleUrl.current = null; }
    setFertig(null);
    try {
      const s = await sicherungErstellen();
      const fehlen = s.fehlen.map((n) => n.titel + (n.stimme ? ` (${n.stimme})` : '')).join(', ');
      if (!s.noten) {
        setFehler(fehlen ? `Keine Noten lesbar, es gibt keine Sicherung. Nicht lesbar: ${fehlen}.` : 'Auf diesem Gerät sind keine Noten — es gibt nichts zu sichern.');
        return;
      }
      if (fehlen) setFehler(`Nicht in der Sicherung, weil die PDF auf diesem Gerät nicht mehr lesbar ist: ${fehlen}. `
        + 'Retten: in der Bibliothek „Auswählen“, das Stück antippen, „Aktualisieren“ und die Datei neu wählen — Stellen und Anmerkungen bleiben. Dann die Sicherung neu erstellen.');
      const datei = new File([s.datei], sicherungsName(new Date()), { type: 'application/octet-stream' });
      const url = URL.createObjectURL(datei);
      aktuelleUrl.current = url;
      const nav = navigator as TeilenNavigator;
      let kannTeilen = false;
      try { kannTeilen = 'share' in nav && !!nav.canShare?.({ files: [datei] }); } catch { /* kein Teilen */ }
      setTeilbar(kannTeilen);
      setApp(alsApp());
      setFertig({ url, datei });
    } catch (e) {
      setFehler(`Sicherung fehlgeschlagen: ${fehlerGrund(e)}`);
    } finally {
      setLaeuft(false);
    }
  }

  async function teilen() {
    if (!fertig) return;
    try {
      // Nur die Datei: Mit Titel oder Text legen manche Ziele (z. B. „In Dateien
      // sichern“) zusätzlich eine Textdatei an oder bieten sich gar nicht an.
      await navigator.share({ files: [fertig.datei] });
      gemerkt();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.name !== 'AbortError') setFehler(`Teilen ging nicht: ${err.message}`);
    }
  }

  const herunterladen = fertig && (
    <a key="laden" className={`knopf ${app && teilbar ? 'knopf-leise' : ''}`} href={fertig.url} download={fertig.datei.name} onClick={gemerkt}>
      Herunterladen ({groesse(fertig.datei.size)})
    </a>
  );
  const teilenKnopf = fertig && teilbar && (
    <button key="teilen" type="button" className={`knopf ${app ? '' : 'knopf-leise'}`} onClick={() => void teilen()}>
      Teilen / In Dateien sichern
    </button>
  );

  return (
    <section className="space-y-2" aria-label="Daten übertragen">
      <p className="text-sm font-semibold">Daten übertragen</p>
      <ul className="stichpunkte gedaempft text-sm">
        <li>Alle Noten mit Stellen, Tempi, Anmerkungen, Lesezeichen, Merkern und Setlisten in einer Datei</li>
        <li>Anderes Gerät: dort „Sicherung laden“</li>
        <li>Beim Laden gilt der neuere Stand, Gelöschtes wird auch dort gelöscht</li>
        <li>Stimmung, Metronom und Stiftfarben reisen mit, Hell/Dunkel bleibt je Gerät</li>
      </ul>
      <p className="text-sm" role="status">
        {letzte ? <>Letzte Sicherung: <strong>{kurzZeit(letzte)}</strong></> : <span className="gedaempft">Noch keine Sicherung gespeichert.</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`knopf ${fertig ? 'knopf-leise' : ''}`} onClick={() => void vorbereiten()} disabled={laeuft || laden.laeuft || laden.uebernimmt}>
          {laeuft ? 'Sicherung wird erstellt …' : fertig ? 'Neu erstellen' : 'Sicherung erstellen'}
        </button>
        <button type="button" className="knopf knopf-leise" onClick={laden.waehlen} disabled={laeuft || laden.laeuft || laden.uebernimmt}>
          {laden.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
        </button>
      </div>
      {vorgaenger && (
        <div className="space-y-2">
          <ul className="stichpunkte gedaempft text-sm">
            <li>Auf diesem Gerät liegen noch Noten aus der Vorgängerversion</li>
            <li>Übernehmen holt sie samt Stellen und Anmerkungen hierher, der alte Speicher bleibt unangetastet</li>
          </ul>
          <button type="button" className="knopf knopf-leise" onClick={laden.uebernehmen} disabled={laeuft || laden.laeuft || laden.uebernimmt}>
            {laden.uebernimmt ? 'Wird übernommen …' : 'Aus der Vorgängerversion übernehmen'}
          </button>
        </div>
      )}
      {fertig && (
        <div className="space-y-2" role="status">
          <p className="text-sm">„{fertig.datei.name}“ ist bereit. Jetzt speichern:</p>
          <div className="flex flex-wrap gap-2">{app ? [teilenKnopf, herunterladen] : [herunterladen, teilenKnopf]}</div>
          {teilbar ? (
            <ul className="stichpunkte gedaempft text-sm">
              <li>iPhone/iPad: „Teilen“ → „In Dateien sichern“ (z. B. iCloud Drive)</li>
              <li>Jede Sicherung enthält alle PDFs, alte kannst du löschen</li>
            </ul>
          ) : <p className="gedaempft text-sm">Die Datei landet bei den Downloads.</p>}
        </div>
      )}
      {fehler && <p className="warnung text-sm" role="alert">{fehler}</p>}
    </section>
  );
}

// „2 Noten“, „1 Stelle“; 0 nur mit `auchNull`, sonst leer (fällt aus Aufzählungen).
function anzahl(n: number, eins: string, mehr: string, auchNull = false): string {
  if (!n && !auchNull) return '';
  return `${n} ${n === 1 ? eins : mehr}`;
}

// Lesbarer Zeitpunkt der Sicherung; null, wenn der Kopf keinen brauchbaren hat.
const zeitpunkt = (t: unknown) => typeof t === 'number' && Number.isFinite(t)
  ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
  : null;

const groesse = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
