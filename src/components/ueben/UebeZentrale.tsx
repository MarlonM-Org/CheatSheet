'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bibliothek } from './Bibliothek';
import { Einstellungen } from './Einstellungen';
import { gespeichert, speichern } from './klang';
import { MetronomAnbieter } from './MetronomKontext';
import { MetronomWidget } from './MetronomWidget';
import { NotenPult } from './NotenPult';
import { ladeFehler, SpeicherHinweis } from './speicherfehler';
import { MixFertig, mixLaden, rundeSpeichern, type MixStand, type MixSteuerung } from './StellenMix';
import { StimmgeraetAnbieter, useStimmgeraetApi } from './StimmgeraetKontext';
import { StimmgeraetWidget } from './StimmgeraetWidget';
import { UntereLeiste } from './UntereLeiste';

// Die Noten sind die App (B-01/B-02): Das zuletzt geöffnete Stück füllt die
// Bühne, die Bibliothek ist ein Overlay, Metronom und Stimmgerät schweben
// als Widgets. Ohne gemerktes Stück startet die Bibliothek geöffnet.
export function UebeZentrale() {
  return <MetronomAnbieter><StimmgeraetAnbieter><Zentrale /></StimmgeraetAnbieter></MetronomAnbieter>;
}

function Zentrale() {
  const { stopp: stimmStopp } = useStimmgeraetApi();
  const [offen, setOffen] = useState<string | null>(() => gespeichert('ueben:offen', null));
  // Fassung erzwingt einen Neuaufbau desselben Stücks (nach „aktualisieren"
  // oder erneutem Antippen) — zusammen mit `offen` der key des NotenPults.
  const [fassung, setFassung] = useState(0);
  // Stellen-Mix (F-11): an, bis man ihn verlässt — auch über einen Neustart der App.
  const [mixAn, setMixAn] = useState(() => gespeichert('ueben:mix-an', false));
  const [mix, setMix] = useState<MixStand | null>(null);
  const [bibliothek, setBibliothek] = useState(() => gespeichert<string | null>('ueben:offen', null) === null && !gespeichert('ueben:mix-an', false));
  const [einstellungen, setEinstellungen] = useState(false);
  // Zählt hoch, wenn in den Einstellungen eine Sicherung geladen wurde —
  // die Bibliothek liest ihre Liste dann neu.
  const [bibStand, setBibStand] = useState(0);
  const [metroAn, setMetroAn] = useState(() => gespeichert('ueben:metronom-an', false));
  const [stimmAn, setStimmAn] = useState(false); // Mikrofon nie von allein
  // Die „alles"-Dialoge der Widgets liegen hier, damit tastenAktiv sie kennt.
  const [metroVoll, setMetroVoll] = useState(false);
  const [stimmVoll, setStimmVoll] = useState(false);

  // ── Stellen-Mix ──
  const mixAus = useCallback(() => { setMixAn(false); speichern('ueben:mix-an', false); setMix(null); }, []);
  const mixAbgleichen = useCallback(() => {
    mixLaden().then(setMix, (x) => { ladeFehler(x); setMixAn(false); speichern('ueben:mix-an', false); });
  }, []);
  // Nach einem Neustart im Mix: Runde laden.
  useEffect(() => { if (mixAn && !mix) mixAbgleichen(); }, [mixAn, mix, mixAbgleichen]);
  const mixStelle = mix ? mix.runde.reihe[mix.runde.pos] : undefined;
  const mixNoten = mixStelle ? mix?.stueckVon[mixStelle] : undefined;
  const mixStarten = (neu: boolean) => {
    mixLaden(neu).then((m) => { setMix(m); setMixAn(true); speichern('ueben:mix-an', true); setBibliothek(false); }, ladeFehler);
  };
  const mixSteuerung = useMemo<MixSteuerung | null>(() => {
    if (!mix || !mixStelle) return null;
    const gehen = (d: number) => {
      const runde = { ...mix.runde, pos: Math.max(0, Math.min(mix.runde.reihe.length, mix.runde.pos + d)) };
      rundeSpeichern(runde);
      setMix({ ...mix, runde });
    };
    return {
      stelle: mixStelle, nr: mix.runde.pos + 1, anzahl: mix.runde.reihe.length,
      weiter: () => gehen(1), zurueck: () => gehen(-1),
      // Das Stück der Stelle bleibt offen, zum Weiterlesen.
      beenden: () => { mixAus(); if (mixNoten) { setOffen(mixNoten); speichern('ueben:offen', mixNoten); } },
      abgleichen: mixAbgleichen,
    };
  }, [mix, mixStelle, mixNoten, mixAus, mixAbgleichen]);
  // Was gerade auf der Bühne liegt.
  const angezeigt = mixAn ? (mixNoten ?? null) : offen;

  const oeffnen = (id: string) => {
    // Aus dem Mix heraus immer frisch aufbauen: zum Lesen, von Seite 1.
    if (mixAn) mixAus();
    if (mixAn || id === offen) setFassung((f) => f + 1);
    else { setOffen(id); speichern('ueben:offen', id); }
    setBibliothek(false);
  };
  const offenWeg = () => { setOffen(null); speichern('ueben:offen', null); setBibliothek(true); };
  // Gelöscht, während der Mix es zeigt: Runde ohne seine Stellen weiter.
  const angezeigtWeg = () => { if (mixAn) mixAbgleichen(); else offenWeg(); };
  // Nach „aktualisieren" in der Bibliothek: offenes Stück neu aufbauen.
  const aktualisiert = (ids: string[]) => { if (angezeigt && ids.includes(angezeigt)) setFassung((f) => f + 1); };
  const metroUmschalten = (an: boolean) => { setMetroAn(an); speichern('ueben:metronom-an', an); if (!an) setMetroVoll(false); };
  const stimmUmschalten = (an: boolean) => { setStimmAn(an); if (!an) { stimmStopp(); setStimmVoll(false); } };

  const umschalten = (ziel: 'bibliothek' | 'metronom' | 'stimmgeraet') => {
    if (ziel === 'bibliothek') setBibliothek(!bibliothek);
    if (ziel === 'metronom') metroUmschalten(!metroAn);
    if (ziel === 'stimmgeraet') stimmUmschalten(!stimmAn);
  };

  const dialogOffen = einstellungen || metroVoll || stimmVoll;

  return (
    <div className="app-schale">
      <SpeicherHinweis />
      <main className="buehne">
        {mixAn ? (
          !mix ? <div className="leer"><p className="gedaempft">Stellen werden gemischt …</p></div>
          : mixSteuerung && mixNoten ? (
            <NotenPult key={`${mixNoten}:${fassung}`} notenId={mixNoten} mix={mixSteuerung}
              tastenAktiv={!bibliothek && !dialogOffen} verschwunden={mixAbgleichen} />
          ) : (
            <MixFertig anzahl={mix.runde.reihe.length} neu={() => mixStarten(true)} beenden={mixAus}
              zurueck={() => { const runde = { ...mix.runde, pos: Math.max(0, mix.runde.reihe.length - 1) }; rundeSpeichern(runde); setMix({ ...mix, runde }); }} />
          )
        ) : offen ? (
          <NotenPult key={`${offen}:${fassung}`} notenId={offen}
            tastenAktiv={!bibliothek && !dialogOffen} verschwunden={offenWeg} />
        ) : (
          <div className="leer">
            <p className="titel">CheatSheet</p>
            <p className="gedaempft max-w-xs">Noten, schwierige Stellen, Metronom und Stimmgerät. Alles auf diesem Gerät.</p>
            <button type="button" className="knopf" onClick={() => setBibliothek(true)}>Bibliothek öffnen</button>
          </div>
        )}
      </main>

      <div className="dock">
        {stimmAn && <StimmgeraetWidget schliessen={() => stimmUmschalten(false)} voll={stimmVoll} vollSetzen={setStimmVoll} />}
        {metroAn && <MetronomWidget schliessen={() => metroUmschalten(false)} voll={metroVoll} vollSetzen={setMetroVoll} />}
      </div>

      {bibliothek && (
        <Bibliothek offen={angezeigt} oeffnen={oeffnen} schliessen={() => setBibliothek(false)}
          einstellungen={() => setEinstellungen(true)} offenEntfernt={angezeigtWeg}
          aktualisiert={aktualisiert} escapeAktiv={!dialogOffen} stand={bibStand} mixStarten={mixStarten} />
      )}
      {einstellungen && <Einstellungen schliessen={() => setEinstellungen(false)} geaendert={() => setBibStand((n) => n + 1)} />}

      <UntereLeiste bibliothekOffen={bibliothek} metroAn={metroAn} stimmAn={stimmAn} umschalten={umschalten} />
    </div>
  );
}
