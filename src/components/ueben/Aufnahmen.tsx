'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dauerText, tagebuch, wo } from '@/domain/aufnahmetagebuch';
import type { Aufnahme, Stelle, Stueck } from '@/domain/bestand';
import { zeitpunkt } from '@/domain/notenpult';
import { skillFinden } from '@/domain/skillkatalog';
import { aufnahmeAendern, aufnahmeAnlegen, aufnahmeDatei, aufnahmeLoeschen } from './lokal';
import { mikrofonWunsch } from '@/domain/lautsprecher';
import { mikrofonOffen, useBeimVerlassen, wachHalten, wiedergabeSitzung } from './klang';
import { lautsprecherAn, LautsprecherSchalter } from './lautsprecher';
import { fehlerGrund, speicherFehler } from './speicherfehler';

// Eigene Aufnahmen beim Üben (G-09, erste Stufe): Aus der Notenansicht
// aufnehmen (roter Knopf in der Leiste), während man spielt — mit Seite und,
// im Stellen-Modus, mit der Stelle. Im Stück-Blatt liegen die Aufnahmen als
// Versionen: anhören, benennen, löschen, und mehrere zugleich abspielen
// („übereinander“: etwa zwei Stimmen oder zwei Versionen vergleichen).
// Die Bytes liegen in IndexedDB („dateien“), komprimiert (AAC auf dem
// iPhone, Opus/WebM in Chrome): etwa 0,5–1 MB je Minute. Sie reisen nicht
// mit der Sicherung.

export interface AufnahmeLauf {
  laeuft: boolean; sekunden: number; fehler: string;
  // Startet bzw. stoppt (und speichert) — mit dem Zusammenhang beim Start.
  umschalten: (zusammenhang: { seite?: number; stelleId?: string; skillId?: string }) => void;
}

const mimeWahl = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
};

export function useAufnahme(stueckId: string, fertig: () => void): AufnahmeLauf {
  const [laeuft, setLaeuft] = useState(false);
  const [sekunden, setSekunden] = useState(0);
  const [fehler, setFehler] = useState('');
  const lauf = useRef<{ recorder: MediaRecorder; stream: MediaStream; stuecke: Blob[]; beginn: number; timer: number; freigeben: (() => void) | null; abmelden: () => void; zusammenhang: { seite?: number; stelleId?: string; skillId?: string } } | null>(null);

  const stoppen = useCallback(() => {
    const l = lauf.current;
    if (!l) return;
    lauf.current = null;
    window.clearInterval(l.timer);
    l.freigeben?.();
    const dauer = Math.round((performance.now() - l.beginn) / 100) / 10;
    const typ = l.recorder.mimeType || mimeWahl() || 'audio/mp4';
    const speichern = () => {
      l.stream.getTracks().forEach((t) => t.stop());
      l.abmelden();
      setLaeuft(false);
      const datei = new Blob(l.stuecke, { type: typ.split(';')[0] });
      if (!datei.size || dauer < 0.5) return;
      aufnahmeAnlegen(stueckId, datei, { am: Date.now(), dauer, ...l.zusammenhang }).then(fertig, speicherFehler);
    };
    if (l.recorder.state === 'inactive') speichern();
    else { l.recorder.onstop = speichern; try { l.recorder.stop(); } catch { speichern(); } }
  }, [stueckId, fertig]);

  const starten = useCallback(async (zusammenhang: { seite?: number; stelleId?: string; skillId?: string }) => {
    if (lauf.current) return;
    setFehler('');
    const mime = mimeWahl();
    if (!mime) { setFehler('Dieser Browser kann nicht aufnehmen.'); return; }
    // Angemeldet, solange die Aufnahme läuft: Startet währenddessen das
    // Metronom, bleibt die Sitzung bei „play-and-record“ (mit „playback“
    // stellte iOS das Mikrofon stumm).
    const abmelden = mikrofonOffen();
    try {
      // Verstärkung nie (Instrumente pumpen sonst). Lautsprecher an (B-20):
      // Echo-Unterdrückung — der Metronom-Klick bleibt draußen, iOS nimmt
      // über Freisprechen auf. Aus: rohes Mikrofon, für Kopfhörer.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: mikrofonWunsch(lautsprecherAn(), 'aufnehmen') });
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 96000 });
      const l = { recorder, stream, stuecke: [] as Blob[], beginn: performance.now(), timer: 0, freigeben: null as (() => void) | null, abmelden, zusammenhang };
      recorder.ondataavailable = (e) => { if (e.data.size) l.stuecke.push(e.data); };
      recorder.start(1000);
      l.timer = window.setInterval(() => setSekunden(Math.floor((performance.now() - l.beginn) / 1000)), 250);
      lauf.current = l;
      setSekunden(0);
      setLaeuft(true);
      const freigeben = await wachHalten();
      if (lauf.current === l) l.freigeben = freigeben; else freigeben?.();
    } catch (e) {
      abmelden();
      setFehler((e as Error).name === 'NotAllowedError'
        ? 'Das Mikrofon ist nicht erlaubt. In den Einstellungen des Browsers für diese Seite erlauben.'
        : `Aufnehmen geht nicht: ${fehlerGrund(e)}`);
    }
  }, []);

  // App verlassen (Anruf, Home-Bildschirm): die Aufnahme endet und wird gesichert.
  useBeimVerlassen(stoppen);
  useEffect(() => () => { if (lauf.current) stoppen(); }, [stoppen]);

  return { laeuft, sekunden, fehler, umschalten: (z) => { if (lauf.current) stoppen(); else void starten(z); } };
}

// Die Aufnahmen eines Stücks im Stück-Blatt (G-09): je Stück eine oder
// mehrere, neueste zuerst; anhören, „zusammen“ übereinander, benennen, löschen.
// Abgestimmt mit dem Aufnahme-Tagebuch (I-20): dieselben Angaben je Zeile
// (Stelle oder Seite, Skill, Dauer — Regeln in @/domain/aufnahmetagebuch);
// dort, auf dieses Stück gefiltert, das Vergleichen A/B und „Neu“ samt Skill.
export function AufnahmenListe({ stueck, stellen, geaendert, zumTagebuch }: {
  stueck: Stueck; stellen: Stelle[]; geaendert: () => void;
  // Das Tagebuch auf dieses Stück gefiltert öffnen.
  zumTagebuch?: () => void;
}) {
  const liste = [...(stueck.aufnahmen ?? [])].sort((a, b) => b.am - a.am);
  const angaben = new Map(tagebuch([stueck], stellen).map((e) => [e.aufnahme.id, e]));
  const [spielt, setSpielt] = useState<Set<string>>(() => new Set());
  const [zusammen, setZusammen] = useState<Set<string>>(() => new Set());
  const [fehler, setFehler] = useState('');
  const spieler = useRef(new Map<string, { audio: HTMLAudioElement; url: string }>());

  const aus = useCallback((id?: string) => {
    for (const [k, s] of spieler.current) {
      if (id && k !== id) continue;
      s.audio.pause(); s.audio.src = ''; URL.revokeObjectURL(s.url); spieler.current.delete(k);
    }
    setSpielt((alt) => { const neu = new Set(alt); if (id) neu.delete(id); else neu.clear(); return neu; });
  }, []);
  useEffect(() => () => aus(), [aus]);

  const abspielen = async (ids: string[]) => {
    setFehler('');
    wiedergabeSitzung();
    try {
      const geladen = await Promise.all(ids.map(async (id) => {
        const a = liste.find((x) => x.id === id)!;
        const url = URL.createObjectURL(await aufnahmeDatei(a));
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.onended = () => aus(id);
        return { id, audio, url };
      }));
      for (const g of geladen) spieler.current.set(g.id, { audio: g.audio, url: g.url });
      await Promise.all(geladen.map((g) => g.audio.play()));
      setSpielt((alt) => new Set([...alt, ...ids]));
    } catch (x) { setFehler(`Abspielen geht nicht: ${fehlerGrund(x)}`); aus(); }
  };
  const umschalten = (a: Aufnahme) => { if (spielt.has(a.id)) aus(a.id); else void abspielen([a.id]); };
  const benennen = async (a: Aufnahme) => {
    const neu = prompt('Name der Aufnahme', a.titel ?? '');
    if (neu === null) return;
    try { await aufnahmeAendern(stueck.id, a.id, { titel: neu.trim() }); geaendert(); } catch (x) { speicherFehler(x); }
  };
  const loeschen = async (a: Aufnahme) => {
    if (!confirm(`Aufnahme „${name(a)}“ löschen?`)) return;
    aus(a.id);
    try { await aufnahmeLoeschen(stueck.id, a.id); geaendert(); } catch (x) { speicherFehler(x); }
  };
  const name = (a: Aufnahme) => a.titel || zeitpunkt(a.am);
  // Wo und wozu: „Stelle „T. 32–48““ oder „Seite 2“, dazu der Skill — wie im Tagebuch.
  const zusatz = (a: Aufnahme) => {
    const e = angaben.get(a.id);
    const skill = a.skillId ? skillFinden(a.skillId)?.name ?? a.skillId : '';
    return [e ? wo(e) : '', skill].filter(Boolean).join(' · ');
  };
  const gewaehlt = liste.filter((a) => zusammen.has(a.id));

  // B-20: Der rote Knopf hat keinen Platz für einen Schalter — hier, eine Zeile unter den Aufnahmen.
  const schalter = <LautsprecherSchalter className="mt-3" hinweis="Beim Aufnehmen — an: Metronom aus dem Lautsprecher, bleibt draußen. Aus: für Kopfhörer, rohes Mikrofon." />;
  const tagebuchKnopf = zumTagebuch && (
    <button type="button" className="knopf knopf-leise knopf-klein" onClick={zumTagebuch}>
      {liste.length > 1 ? 'Vergleichen und neu aufnehmen im Tagebuch ›' : 'Im Tagebuch aufnehmen ›'}
    </button>
  );
  if (!liste.length) return (
    <>
      <p className="gedaempft text-sm">Noch keine Aufnahme. Der rote Knopf in der Notenansicht nimmt auf, während du spielst — oder „Neu“ im Aufnahme-Tagebuch, auf Wunsch mit einem Skill.</p>
      {tagebuchKnopf && <div className="mt-2">{tagebuchKnopf}</div>}
      {schalter}
    </>
  );
  return (
    <div className="aufnahmen">
      {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
      <ul className="aufnahmen-liste">
        {liste.map((a) => (
          <li key={a.id} className="aufnahme">
            <button type="button" className={`aufnahme-spielen ${spielt.has(a.id) ? 'an' : ''}`} onClick={() => umschalten(a)} aria-label={spielt.has(a.id) ? 'Anhalten' : 'Abspielen'} aria-pressed={spielt.has(a.id)}>
              {spielt.has(a.id) ? '■' : '▶'}
            </button>
            {/* Wie eine Zeile im Tagebuch: Name, darunter wo und wozu, dann Dauer und Zeit; „zusammen“ als dritte Zeile. */}
            <span className="aufnahme-text">
              <strong>{name(a)}</strong>
              {zusatz(a) && <span className="gedaempft text-xs">{zusatz(a)}</span>}
              <span className="gedaempft text-xs tabular-nums">{dauerText(a.dauer)}{a.titel ? ` · ${zeitpunkt(a.am)}` : ''}</span>
              <label className="aufnahme-zusammen" title="Zum Übereinander-Abspielen wählen">
                <input type="checkbox" checked={zusammen.has(a.id)} onChange={(e) => setZusammen((alt) => { const neu = new Set(alt); if (e.target.checked) neu.add(a.id); else neu.delete(a.id); return neu; })} aria-label={`„${name(a)}“ zum gemeinsamen Abspielen wählen`} />
                <span className="text-xs gedaempft">zusammen</span>
              </label>
            </span>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => void benennen(a)} aria-label="Umbenennen">Name</button>
            <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => void loeschen(a)} aria-label="Löschen">×</button>
          </li>
        ))}
      </ul>
      <div className="einspiel-zeile !justify-start">
        <button type="button" className="knopf knopf-leise knopf-klein" disabled={gewaehlt.length < 2 && !spielt.size} onClick={() => (spielt.size ? aus() : void abspielen(gewaehlt.map((a) => a.id)))}>
          {spielt.size ? '■ Alles anhalten' : `▶ ${gewaehlt.length} übereinander abspielen`}
        </button>
        <span className="gedaempft text-xs">„zusammen“ ankreuzen und übereinander abspielen — Versionen vergleichen oder Stimmen schichten.</span>
      </div>
      {tagebuchKnopf && <div className="mt-2">{tagebuchKnopf}</div>}
      {schalter}
    </div>
  );
}
