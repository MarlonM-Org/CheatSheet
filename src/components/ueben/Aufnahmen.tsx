'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Aufnahme, Stelle, Stueck } from '@/domain/bestand';
import { zeitpunkt } from '@/domain/notenpult';
import { aufnahmeAendern, aufnahmeAnlegen, aufnahmeDatei, aufnahmeLoeschen } from './lokal';
import { audioSitzung, useBeimVerlassen, wachHalten } from './klang';
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
  umschalten: (zusammenhang: { seite?: number; stelleId?: string }) => void;
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
  const lauf = useRef<{ recorder: MediaRecorder; stream: MediaStream; stuecke: Blob[]; beginn: number; timer: number; freigeben: (() => void) | null; zusammenhang: { seite?: number; stelleId?: string } } | null>(null);

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
      audioSitzung('playback');
      setLaeuft(false);
      const datei = new Blob(l.stuecke, { type: typ.split(';')[0] });
      if (!datei.size || dauer < 0.5) return;
      aufnahmeAnlegen(stueckId, datei, { am: Date.now(), dauer, ...l.zusammenhang }).then(fertig, speicherFehler);
    };
    if (l.recorder.state === 'inactive') speichern();
    else { l.recorder.onstop = speichern; try { l.recorder.stop(); } catch { speichern(); } }
  }, [stueckId, fertig]);

  const starten = useCallback(async (zusammenhang: { seite?: number; stelleId?: string }) => {
    if (lauf.current) return;
    setFehler('');
    const mime = mimeWahl();
    if (!mime) { setFehler('Dieser Browser kann nicht aufnehmen.'); return; }
    try {
      audioSitzung('play-and-record');
      // Verstärkung aus (Instrumente pumpen sonst), Echo-Unterdrückung an —
      // so bleibt der Metronom-Klick draußen; iOS nimmt dann über Freisprechen auf.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 96000 });
      const l = { recorder, stream, stuecke: [] as Blob[], beginn: performance.now(), timer: 0, freigeben: null as (() => void) | null, zusammenhang };
      recorder.ondataavailable = (e) => { if (e.data.size) l.stuecke.push(e.data); };
      recorder.start(1000);
      l.timer = window.setInterval(() => setSekunden(Math.floor((performance.now() - l.beginn) / 1000)), 250);
      lauf.current = l;
      setSekunden(0);
      setLaeuft(true);
      const freigeben = await wachHalten();
      if (lauf.current === l) l.freigeben = freigeben; else freigeben?.();
    } catch (e) {
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

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Die Aufnahmen eines Stücks im Stück-Blatt.
export function AufnahmenListe({ stueck, stellen, geaendert }: { stueck: Stueck; stellen: Stelle[]; geaendert: () => void }) {
  const liste = [...(stueck.aufnahmen ?? [])].sort((a, b) => b.am - a.am);
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
    audioSitzung('playback');
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
  const wo = (a: Aufnahme) => {
    const st = a.stelleId ? stellen.find((s) => s.id === a.stelleId) : null;
    return st ? `Stelle „${st.titel || `Seite ${st.seite}`}“` : a.seite ? `Seite ${a.seite}` : '';
  };
  const gewaehlt = liste.filter((a) => zusammen.has(a.id));

  if (!liste.length) return <p className="gedaempft text-sm">Noch keine Aufnahme. Der rote Knopf in der Notenansicht nimmt auf, während du spielst.</p>;
  return (
    <div className="aufnahmen">
      {fehler && <p className="karte warnung" role="alert">{fehler}</p>}
      <ul className="aufnahmen-liste">
        {liste.map((a) => (
          <li key={a.id} className="aufnahme">
            <button type="button" className={`aufnahme-spielen ${spielt.has(a.id) ? 'an' : ''}`} onClick={() => umschalten(a)} aria-label={spielt.has(a.id) ? 'Anhalten' : 'Abspielen'} aria-pressed={spielt.has(a.id)}>
              {spielt.has(a.id) ? '■' : '▶'}
            </button>
            <span className="aufnahme-text">
              <strong>{name(a)}</strong>
              <span className="gedaempft text-xs">{mmss(a.dauer)}{wo(a) ? ` · ${wo(a)}` : ''}{a.titel ? ` · ${zeitpunkt(a.am)}` : ''}</span>
            </span>
            <label className="aufnahme-zusammen" title="Zum Übereinander-Abspielen wählen">
              <input type="checkbox" checked={zusammen.has(a.id)} onChange={(e) => setZusammen((alt) => { const neu = new Set(alt); if (e.target.checked) neu.add(a.id); else neu.delete(a.id); return neu; })} aria-label={`„${name(a)}“ zum gemeinsamen Abspielen wählen`} />
              <span className="text-xs gedaempft">zusammen</span>
            </label>
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
    </div>
  );
}
