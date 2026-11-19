'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bibliothek } from './Bibliothek';
import { Einstellungen } from './Einstellungen';
import { gespeichert, speichern } from './klang';
import { Lernen } from './Lernen';
import { MetronomAnbieter } from './MetronomKontext';
import { MetronomWidget } from './MetronomWidget';
import { speicherBehalten, tagsLaden } from './lokal';
import { NotenPult } from './NotenPult';
import { METRONOM_ZEIGEN } from './Skills';
import { ladeFehler, SpeicherHinweis } from './speicherfehler';
import { ortSprung, ortTippen } from '@/domain/leiste';
import { mixBereichLesen, type MixBereich } from '@/domain/stellen';
import { MixFertig, mixLaden, mixTitel, rundeSpeichern, type MixStand, type MixSteuerung } from './StellenMix';
import { StimmgeraetAnbieter, useStimmgeraetApi } from './StimmgeraetKontext';
import { StimmgeraetWidget } from './StimmgeraetWidget';
import { UntereLeiste } from './UntereLeiste';

// Die Noten sind die App (B-01/B-02): Das zuletzt geöffnete Stück füllt die
// Bühne, Bibliothek und Lernen (B-18) sind Overlays — höchstens eins zugleich —,
// Metronom und Stimmgerät schweben als Widgets. Ohne gemerktes Stück startet
// die Bibliothek geöffnet.
export function UebeZentrale() {
  return <MetronomAnbieter><StimmgeraetAnbieter><Zentrale /></StimmgeraetAnbieter></MetronomAnbieter>;
}

function Zentrale() {
  const { start: stimmStart, stopp: stimmStopp } = useStimmgeraetApi();
  const [offen, setOffen] = useState<string | null>(() => gespeichert('ueben:offen', null));
  // Fassung erzwingt einen Neuaufbau desselben Stücks (nach „aktualisieren"
  // oder erneutem Antippen) — zusammen mit `offen` der key des NotenPults.
  const [fassung, setFassung] = useState(0);
  // Stellen-Mix (F-11): an, bis man ihn verlässt — auch über einen Neustart
  // der App. Gemerkt wird der Bereich (alle oder eine Sammlung, nur offene).
  // Gestartet wird er in der Bibliothek (B-19).
  const [mixBereich, setMixBereich] = useState<MixBereich | null>(() => mixBereichLesen(gespeichert<unknown>('ueben:mix-an', false)));
  const mixAn = mixBereich !== null;
  const [mix, setMix] = useState<MixStand | null>(null);
  const [bibliothek, setBibliothek] = useState(() => gespeichert<string | null>('ueben:offen', null) === null && !mixBereichLesen(gespeichert<unknown>('ueben:mix-an', false)));
  // Lernen (B-18): der zweite Ort neben der Bibliothek, nie mit ihr zugleich.
  const [lernen, setLernen] = useState(false);
  // Liegt ein Werkzeug darauf (iPad: ganze Seite, Leiste bedienbar)? Dann
  // führt ein Tipp auf „Lernen“ zur Übersicht: Lernen baut sich neu auf.
  const [lernenTief, setLernenTief] = useState(false);
  const [lernenFassung, setLernenFassung] = useState(0);
  // Die Bibliothek gleich mit den Aufnahmen öffnen (Kachel „Aufnahme-Tagebuch“
  // in Lernen, I-20); gilt nur für das eine Öffnen.
  const [bibAufnahmen, setBibAufnahmen] = useState(false);
  const [einstellungen, setEinstellungen] = useState(false);
  // Zählt hoch, wenn in den Einstellungen eine Sicherung geladen wurde —
  // die Bibliothek liest ihre Liste dann neu.
  const [bibStand, setBibStand] = useState(0);
  const [metroAn, setMetroAn] = useState(() => gespeichert('ueben:metronom-an', false));
  // Nicht gemerkt: Das Mikrofon geht nur auf einen Tipp an, nie beim Start der App.
  const [stimmAn, setStimmAn] = useState(false);
  // Die „alles"-Dialoge der Widgets liegen hier, damit tastenAktiv sie kennt.
  const [metroVoll, setMetroVoll] = useState(false);
  const [stimmVoll, setStimmVoll] = useState(false);

  // ── Stellen-Mix ──
  const mixAus = useCallback(() => { setMixBereich(null); speichern('ueben:mix-an', false); setMix(null); }, []);
  const mixAbgleichen = useCallback(() => {
    if (!mixBereich) return;
    mixLaden(mixBereich).then(setMix, (x) => { ladeFehler(x); setMixBereich(null); speichern('ueben:mix-an', false); });
  }, [mixBereich]);
  // Nach einem Neustart im Mix: Runde laden.
  useEffect(() => { if (mixAn && !mix) mixAbgleichen(); }, [mixAn, mix, mixAbgleichen]);
  // Dauerhafter Speicher (A-07): den Browser einmal bitten, die Daten zu behalten.
  useEffect(() => { void speicherBehalten(); }, []);
  const mixStelle = mix ? mix.runde.reihe[mix.runde.pos] : undefined;
  const mixNoten = mixStelle ? mix?.stueckVon[mixStelle] : undefined;
  const mixStarten = (neu: boolean, bereich: MixBereich) => {
    mixLaden(bereich, neu).then((m) => { setMix(m); setMixBereich(bereich); speichern('ueben:mix-an', bereich); setBibliothek(false); setLernen(false); }, ladeFehler);
  };
  // „Märsche · Wichtig üben“: Sammlung und Tag, aus denen gemischt wird.
  const mixTag = mix?.bereich.tag ? tagsLaden().find((t) => t.id === mix.bereich.tag) ?? null : null;
  const titel = mix ? mixTitel(mix.bereich.sammlung, mixTag?.name ?? null) : null;
  const mixSteuerung = useMemo<MixSteuerung | null>(() => {
    if (!mix || !mixStelle) return null;
    const gehen = (d: number) => {
      const runde = { ...mix.runde, pos: Math.max(0, Math.min(mix.runde.reihe.length, mix.runde.pos + d)) };
      rundeSpeichern(mix.bereich, runde);
      setMix({ ...mix, runde });
    };
    return {
      stelle: mixStelle, nr: mix.runde.pos + 1, anzahl: mix.runde.reihe.length, titel, bereich: mix.bereich,
      weiter: () => gehen(1), zurueck: () => gehen(-1),
      // Das Stück der Stelle bleibt offen, zum Weiterlesen.
      beenden: () => { mixAus(); if (mixNoten) { setOffen(mixNoten); speichern('ueben:offen', mixNoten); } },
      abgleichen: mixAbgleichen,
    };
  }, [mix, mixStelle, mixNoten, titel, mixAus, mixAbgleichen]);
  // Was gerade auf der Bühne liegt.
  const angezeigt = mixAn ? (mixNoten ?? null) : offen;

  // Aus der Bibliothek (F-08): auf Wunsch gleich mit dem Stück-Blatt.
  const [blattAnfang, setBlattAnfang] = useState<boolean | 'teilen'>(false);
  const oeffnen = (id: string, blatt: boolean | 'teilen' = false) => {
    // Aus dem Mix heraus immer frisch aufbauen: zum Lesen, von Seite 1.
    if (mixAn) mixAus();
    setBlattAnfang(blatt);
    if (mixAn || id === offen) setFassung((f) => f + 1);
    else { setOffen(id); speichern('ueben:offen', id); }
    setBibliothek(false); setLernen(false);
  };
  const offenWeg = () => { setOffen(null); speichern('ueben:offen', null); setLernen(false); setBibAufnahmen(false); setBibliothek(true); };
  // Gelöscht, während der Mix es zeigt: Runde ohne seine Stellen weiter.
  const angezeigtWeg = () => { if (mixAn) mixAbgleichen(); else offenWeg(); };
  // Nach „aktualisieren" in der Bibliothek: offenes Stück neu aufbauen.
  const aktualisiert = (ids: string[]) => { if (angezeigt && ids.includes(angezeigt)) setFassung((f) => f + 1); };
  const metroUmschalten = (an: boolean) => { setMetroAn(an); speichern('ueben:metronom-an', an); if (!an) setMetroVoll(false); };
  // „Heute“ (I-09): Ein Block (Swing, Zunge) öffnet das volle Metronom über Lernen.
  useEffect(() => {
    const zeigen = () => { setMetroAn(true); speichern('ueben:metronom-an', true); setMetroVoll(true); };
    window.addEventListener(METRONOM_ZEIGEN, zeigen);
    return () => window.removeEventListener(METRONOM_ZEIGEN, zeigen);
  }, []);
  // Einblenden startet das Mikrofon gleich mit — der Tipp auf „Stimmgerät" ist
  // die Geste dafür, ein zweiter Tipp im Widget entfällt (C-05).
  const stimmUmschalten = (an: boolean) => { setStimmAn(an); if (an) void stimmStart(); else { stimmStopp(); setStimmVoll(false); } };

  const umschalten = (ziel: 'lernen' | 'bibliothek' | 'metronom' | 'stimmgeraet') => {
    if (ziel === 'lernen' || ziel === 'bibliothek') {
      const { ort, zurUebersicht } = ortTippen(lernen ? 'lernen' : bibliothek ? 'bibliothek' : null, ziel, lernen && lernenTief);
      if (zurUebersicht) setLernenFassung((f) => f + 1);
      else { setLernen(ort === 'lernen'); setBibliothek(ort === 'bibliothek'); setBibAufnahmen(false); }
    }
    if (ziel === 'metronom') metroUmschalten(!metroAn);
    if (ziel === 'stimmgeraet') stimmUmschalten(!stimmAn);
  };

  // Aus Lernen zu den Aufnahmen: ganzer Seitenwechsel in die Bibliothek, dort
  // liegt gleich das Tagebuch über der Liste (Rückmeldung Marlon 2026-11-19).
  const zuAufnahmen = () => {
    const ort = ortSprung(lernen ? 'lernen' : bibliothek ? 'bibliothek' : null, 'bibliothek');
    setBibAufnahmen(true); setLernen(ort === 'lernen'); setBibliothek(ort === 'bibliothek');
  };

  const dialogOffen = einstellungen || metroVoll || stimmVoll;
  // Leisten über den Noten: Tippen in die Mitte blendet oben und unten aus.
  // Die untere bleibt, solange Bibliothek, Lernen oder ein Dialog offen ist.
  const [leisteWeg, setLeisteWeg] = useState(false);
  const ortOffen = bibliothek || lernen;
  const navWeg = leisteWeg && !ortOffen && !dialogOffen;
  const leisten = { leisteWeg, setLeisteWeg, navDa: !navWeg };

  return (
    <div className={`app-schale ${navWeg ? 'nav-weg' : ''} ${lernen ? 'lernen-offen' : ''}`}>
      <SpeicherHinweis />
      <main className="buehne">
        {mixAn ? (
          !mix ? <div className="leer"><p className="gedaempft">Stellen werden gemischt …</p></div>
          : mixSteuerung && mixNoten ? (
            <NotenPult key={`${mixNoten}:${fassung}`} notenId={mixNoten} mix={mixSteuerung} leisten={leisten}
              tastenAktiv={!ortOffen && !dialogOffen} verschwunden={mixAbgleichen} />
          ) : (
            <MixFertig anzahl={mix.runde.reihe.length} bereich={mix.bereich} tag={mixTag} starten={mixStarten} beenden={mixAus}
              zurueck={() => { const runde = { ...mix.runde, pos: Math.max(0, mix.runde.reihe.length - 1) }; rundeSpeichern(mix.bereich, runde); setMix({ ...mix, runde }); }} />
          )
        ) : offen ? (
          <NotenPult key={`${offen}:${fassung}`} notenId={offen} leisten={leisten} blattAnfang={blattAnfang}
            tastenAktiv={!ortOffen && !dialogOffen} verschwunden={offenWeg} />
        ) : (
          <div className="leer">
            <p className="titel">CheatSheet</p>
            <p className="gedaempft max-w-xs">Noten, schwierige Stellen, Metronom und Stimmgerät. Alles auf diesem Gerät.</p>
            <button type="button" className="knopf" onClick={() => { setLernen(false); setBibAufnahmen(false); setBibliothek(true); }}>Bibliothek öffnen</button>
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
          aktualisiert={aktualisiert} escapeAktiv={!dialogOffen} stand={bibStand} mixStarten={mixStarten} mixAktiv={mixBereich}
          aufnahmenAnfang={bibAufnahmen} />
      )}
      {lernen && (
        <Lernen key={lernenFassung} schliessen={() => setLernen(false)} escapeAktiv={!dialogOffen} tiefMelden={setLernenTief} zuAufnahmen={zuAufnahmen} />
      )}
      {einstellungen && <Einstellungen schliessen={() => setEinstellungen(false)} geaendert={() => setBibStand((n) => n + 1)} />}

      <UntereLeiste weg={navWeg} lernenOffen={lernen} bibliothekOffen={bibliothek} mixLaeuft={mixAn} metroAn={metroAn} stimmAn={stimmAn} umschalten={umschalten} />
    </div>
  );
}
