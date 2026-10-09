'use client';

import { useRef, useState } from 'react';
import { SicherungsFehler, sicherungsName } from '@/domain/sicherung';
import { sicherungEinspielen, sicherungErstellen } from './lokal';

type TeilenNavigator = Navigator & { canShare?: (d: { files: File[] }) => boolean };

// Alle Noten, Stellen und Anmerkungen als eine .uebe-Datei speichern und wieder
// laden — zum Umzug aus der Registerführer-App und als Schutz, falls der
// Browser die Gerätedaten löscht.
export function Sicherung({ leer, geaendert }: { leer: boolean; geaendert: () => void }) {
  const [laeuft, setLaeuft] = useState<'' | 'speichern' | 'laden'>('');
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const [teilbar, setTeilbar] = useState<File | null>(null);
  const auswahl = useRef<HTMLInputElement>(null);

  async function speichern() {
    setLaeuft('speichern'); setMeldung(''); setFehler(''); setTeilbar(null);
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
      setLaeuft('');
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

  async function laden(datei: File | undefined) {
    if (!datei) return;
    setLaeuft('laden'); setMeldung(''); setFehler(''); setTeilbar(null);
    try {
      const n = await sicherungEinspielen(datei);
      setMeldung(`${n.noten} Noten, ${n.stellen} Stellen, ${n.anmerkungen} Seiten mit Anmerkungen übernommen.`);
      geaendert();
    } catch (e) {
      setFehler(e instanceof SicherungsFehler
        ? e.message
        : `Die Sicherung ließ sich nicht speichern: ${(e as Error).message}${(e as Error).name === 'QuotaExceededError' ? ' (Gerätespeicher voll)' : ''}`);
    } finally {
      setLaeuft('');
    }
  }

  return (
    <section className="karte space-y-3" aria-label="Sicherung">
      <h2 className="abschnitt-titel">Sicherung</h2>
      <p className="gedaempft text-sm">
        Eine Datei mit allen Noten, markierten Stellen, Tempi und Anmerkungen dieses Geräts. Laden ergänzt die Liste;
        dieselben Noten werden durch den Stand aus der Sicherung ersetzt, alle anderen bleiben.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf" onClick={() => void speichern()} disabled={leer || !!laeuft}>
          {laeuft === 'speichern' ? 'Sicherung wird erstellt …' : 'Sicherung speichern'}
        </button>
        {teilbar && <button type="button" className="knopf knopf-leise" onClick={() => void teilen()}>Teilen …</button>}
        <button type="button" className="knopf knopf-leise" onClick={() => auswahl.current?.click()} disabled={!!laeuft}>
          {laeuft === 'laden' ? 'Sicherung wird geladen …' : 'Sicherung laden'}
        </button>
        {/* Bewusst ohne accept: iOS graut eigene Endungen wie .uebe sonst aus. */}
        <input ref={auswahl} type="file" hidden onChange={(e) => { const d = e.target.files?.[0]; e.target.value = ''; void laden(d); }} />
      </div>
      {meldung && <p className="text-sm" role="status">{meldung}</p>}
      {fehler && <p className="warnung text-sm" role="alert">{fehler}</p>}
    </section>
  );
}

const groesse = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
