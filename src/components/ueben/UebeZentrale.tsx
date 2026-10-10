'use client';

import { useState } from 'react';
import { Bibliothek } from './Bibliothek';
import { Einstellungen } from './Einstellungen';
import { gespeichert, speichern } from './klang';
import { MetronomAnbieter } from './MetronomKontext';
import { MetronomWidget } from './MetronomWidget';
import { NotenPult } from './NotenPult';
import { SpeicherHinweis } from './speicherfehler';
import { StimmgeraetAnbieter, useStimmgeraet } from './StimmgeraetKontext';
import { StimmgeraetWidget } from './StimmgeraetWidget';
import { UntereLeiste } from './UntereLeiste';

// Die Noten sind die App (B-01/B-02): Das zuletzt geöffnete Stück füllt die
// Bühne, die Bibliothek ist ein Overlay, Metronom und Stimmgerät schweben
// als Widgets. Ohne gemerktes Stück startet die Bibliothek geöffnet.
export function UebeZentrale() {
  return <MetronomAnbieter><StimmgeraetAnbieter><Zentrale /></StimmgeraetAnbieter></MetronomAnbieter>;
}

function Zentrale() {
  const { stopp: stimmStopp } = useStimmgeraet();
  const [offen, setOffen] = useState<string | null>(() => gespeichert('ueben:offen', null));
  const [bibliothek, setBibliothek] = useState(() => gespeichert<string | null>('ueben:offen', null) === null);
  const [einstellungen, setEinstellungen] = useState(false);
  const [metroAn, setMetroAn] = useState(() => gespeichert('ueben:metronom-an', false));
  const [stimmAn, setStimmAn] = useState(false); // Mikrofon nie von allein

  const oeffnen = (id: string) => { setOffen(id); speichern('ueben:offen', id); setBibliothek(false); };
  const offenWeg = () => { setOffen(null); speichern('ueben:offen', null); setBibliothek(true); };
  const metroUmschalten = (an: boolean) => { setMetroAn(an); speichern('ueben:metronom-an', an); };
  const stimmUmschalten = (an: boolean) => { setStimmAn(an); if (!an) stimmStopp(); };

  const umschalten = (ziel: 'bibliothek' | 'metronom' | 'stimmgeraet') => {
    if (ziel === 'bibliothek') setBibliothek(!bibliothek);
    if (ziel === 'metronom') metroUmschalten(!metroAn);
    if (ziel === 'stimmgeraet') stimmUmschalten(!stimmAn);
  };

  return (
    <div className="app-schale">
      <SpeicherHinweis />
      <main className="buehne">
        {offen ? (
          <NotenPult notenId={offen} tastenAktiv={!bibliothek && !einstellungen} verschwunden={offenWeg} />
        ) : (
          <div className="leer">
            <p className="titel">CheatSheet</p>
            <p className="gedaempft max-w-xs">Noten, schwierige Stellen, Metronom und Stimmgerät — alles auf diesem Gerät.</p>
            <button type="button" className="knopf" onClick={() => setBibliothek(true)}>Bibliothek öffnen</button>
          </div>
        )}
      </main>

      <div className="dock">
        {stimmAn && <StimmgeraetWidget schliessen={() => stimmUmschalten(false)} />}
        {metroAn && <MetronomWidget schliessen={() => metroUmschalten(false)} />}
      </div>

      {bibliothek && (
        <Bibliothek offen={offen} oeffnen={oeffnen} schliessen={() => setBibliothek(false)}
          einstellungen={() => setEinstellungen(true)} offenEntfernt={offenWeg} />
      )}
      {einstellungen && <Einstellungen schliessen={() => setEinstellungen(false)} />}

      <UntereLeiste bibliothekOffen={bibliothek} metroAn={metroAn} stimmAn={stimmAn} umschalten={umschalten} />
    </div>
  );
}
