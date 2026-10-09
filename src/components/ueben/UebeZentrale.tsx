'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ausDateiname, zuordnen } from '@/domain/notenpult';
import { gespeichert, speichern } from './klang';
import { alleNoten, notenAendern, notenAnlegen, notenLoeschen, type LokaleNoten } from './lokal';
import { Metronom } from './Metronom';
import { MetronomAnbieter } from './MetronomKontext';
import { NotenPult } from './NotenPult';
import { Sicherung, useSicherungLaden } from './Sicherung';
import { fehlerGrund, SpeicherHinweis } from './speicherfehler';
import { Stimmgeraet } from './Stimmgeraet';

type Reiter = 'metronom' | 'stimmgeraet' | 'noten';
const REITER: Reiter[] = ['metronom', 'stimmgeraet', 'noten'];

// Wer neu ist (nichts gemerkt) oder über einen Umzugs-Link kommt
// (?reiter=noten bzw. #noten), landet bei den Noten — dort liegt „Sicherung
// laden“. Sonst der zuletzt benutzte Reiter.
function startReiter(): Reiter {
  const url = new URL(location.href);
  if (url.searchParams.get('reiter') === 'noten' || url.hash === '#noten') return 'noten';
  const gemerkt = gespeichert<Reiter | null>('ueben:reiter', null);
  return gemerkt && REITER.includes(gemerkt) ? gemerkt : 'noten';
}

// Den Umzugs-Parameter nach dem Start aus der Adresse nehmen, damit Neuladen
// und Lesezeichen wieder den gemerkten Reiter zeigen.
function adresseAufraeumen() {
  const url = new URL(location.href);
  if (!url.searchParams.has('reiter') && url.hash !== '#noten') return;
  url.searchParams.delete('reiter');
  if (url.hash === '#noten') url.hash = '';
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

export function UebeZentrale() {
  return <MetronomAnbieter><Zentrale /></MetronomAnbieter>;
}

function Zentrale() {
  const [reiter, setReiter] = useState<Reiter>(startReiter);
  const [offen, setOffen] = useState<string | null>(null);
  useEffect(adresseAufraeumen, []);
  const wechseln = (k: Reiter) => { setReiter(k); speichern('ueben:reiter', k); if (k !== 'noten') setOffen(null); };

  return (
    <div className="space-y-5">
      <SpeicherHinweis />
      <div className="segment" role="tablist" aria-label="Werkzeug">
        {([['metronom', 'Metronom'], ['stimmgeraet', 'Stimmgerät'], ['noten', 'Noten']] as const).map(([k, name]) => (
          <button key={k} type="button" role="tab" aria-selected={reiter === k} onClick={() => wechseln(k)}>{name}</button>
        ))}
      </div>
      {reiter === 'metronom' && <div className="karte p-5"><Metronom /></div>}
      {reiter === 'stimmgeraet' && <div className="karte p-5"><Stimmgeraet /></div>}
      {reiter === 'noten' && (offen
        ? (
          <div className="space-y-3">
            <button type="button" className="text-knopf text-sm underline" onClick={() => setOffen(null)}>← Alle Noten</button>
            <NotenPult notenId={offen} />
          </div>
        )
        : <NotenListe oeffnen={setOffen} />)}
    </div>
  );
}

// ── Dateien wählen ──
type HandleFenster = Window & {
  showOpenFilePicker?: (o: object) => Promise<FileSystemFileHandle[]>;
};
type Recht = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
};
const kannVerweise = () => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

// Mit Dateiverweis (Chrome/Edge am Rechner) — sonst klassische Auswahl.
async function dateienWaehlen(): Promise<{ datei: File; handle?: FileSystemFileHandle }[]> {
  const w = window as HandleFenster;
  if (w.showOpenFilePicker) {
    try {
      const handles = await w.showOpenFilePicker({ multiple: true, types: [{ description: 'Noten (PDF)', accept: { 'application/pdf': ['.pdf'] } }] });
      return Promise.all(handles.map(async (h) => ({ datei: await h.getFile(), handle: h })));
    } catch (e) {
      if ((e as Error).name === 'AbortError') return [];
    }
  }
  return new Promise((ok) => {
    let fertig = false;
    const ende = (liste: { datei: File }[]) => { if (!fertig) { fertig = true; ok(liste); } };
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf,.pdf'; input.multiple = true;
    input.onchange = () => ende([...(input.files ?? [])].map((datei) => ({ datei })));
    input.oncancel = () => ende([]);
    // Ältere Browser kennen kein „cancel“: kommt das Fenster zurück ohne Auswahl, abbrechen.
    window.addEventListener('focus', () => window.setTimeout(() => { if (!input.files?.length) ende([]); }, 1200), { once: true });
    input.click();
  });
}

async function ausVerweis(n: LokaleNoten): Promise<File | null> {
  const h = n.handle as Recht | undefined;
  if (!h) return null;
  try {
    let recht = await h.queryPermission?.({ mode: 'read' });
    if (recht !== 'granted') recht = await h.requestPermission?.({ mode: 'read' });
    return recht === 'granted' ? await h.getFile() : null;
  } catch { return null; }
}

function NotenListe({ oeffnen }: { oeffnen: (id: string) => void }) {
  const [noten, setNoten] = useState<LokaleNoten[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState('');
  // Teilweise gescheitert (Gerätespeicher): was geklappt hat und was nicht.
  const [warnung, setWarnung] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [sortierung, setSortierung] = useState<'zuletzt' | 'abc'>(() => gespeichert('ueben:sort', 'zuletzt'));
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(() => { alleNoten().then(setNoten).catch((e) => setFehler(`Gerätespeicher nicht verfügbar: ${(e as Error).message}`)); }, []);
  useEffect(laden, [laden]);
  const sicherung = useSicherungLaden(laden);

  const sortiert = useMemo(() => [...(noten ?? [])].sort((a, b) => sortierung === 'abc'
    ? a.titel.localeCompare(b.titel, 'de') || a.stimme.localeCompare(b.stimme, 'de')
    : (b.zuletzt ?? b.erstellt) - (a.zuletzt ?? a.erstellt)), [noten, sortierung]);
  const alleGewaehlt = !!noten?.length && auswahl.size === noten.length;

  async function hinzufuegen() {
    const gewaehlt = await dateienWaehlen();
    if (!gewaehlt.length) return;
    setLaeuft(true); setMeldung(''); setWarnung('');
    let fertig = 0;
    try {
      for (const { datei, handle } of gewaehlt) {
        const { titel, stimme } = ausDateiname(datei.name);
        await notenAnlegen({ titel, stimme, datei, dateiname: datei.name, handle });
        fertig++;
      }
      setMeldung(`${gewaehlt.length} ${gewaehlt.length === 1 ? 'Datei' : 'Dateien'} hinzugefügt. Titel und Stimme stammen aus dem Dateinamen.`);
    } catch (x) {
      setWarnung(`${fertig} von ${gewaehlt.length} ${gewaehlt.length === 1 ? 'Datei' : 'Dateien'} hinzugefügt, dann ging es nicht weiter: ${fehlerGrund(x)}`);
    } finally {
      setLaeuft(false);
      laden();
    }
  }

  // Dieselben Dateien neu einlesen; markierte Stellen und Anmerkungen bleiben.
  async function aktualisieren(ziel: LokaleNoten[]) {
    if (!ziel.length) return;
    setMeldung(''); setWarnung(''); setLaeuft(true);
    let fertig = 0;
    try {
      const offen: LokaleNoten[] = [];
      if (kannVerweise()) {
        for (const n of ziel) {
          const datei = await ausVerweis(n);
          if (datei) { await notenAendern(n.id, { datei, aktualisiert: Date.now() }); fertig++; } else offen.push(n);
        }
      } else offen.push(...ziel);

      let fehlen: LokaleNoten[] = [];
      let uebrig = 0;
      if (offen.length) {
        // Ohne Dateiverweis (iPad/iPhone): einmal die Dateien wählen, Zuordnung über den Namen.
        const gewaehlt = await dateienWaehlen();
        if (!gewaehlt.length && !fertig) return; // abgebrochen: keine Meldung
        const r = zuordnen(offen, gewaehlt.map((g) => g.datei.name));
        for (const p of r.paare) {
          const g = gewaehlt[p.datei];
          await notenAendern(p.notenId, { datei: g.datei, dateiname: g.datei.name, aktualisiert: Date.now(), ...(g.handle ? { handle: g.handle } : {}) });
          fertig++;
        }
        fehlen = r.ohneDatei;
        uebrig = r.ohneNoten.length;
      }
      setMeldung([
        fertig ? `${fertig} von ${ziel.length} aktualisiert — markierte Stellen und Anmerkungen sind erhalten.` : 'Nichts aktualisiert.',
        fehlen.length ? `Keine passende Datei für: ${fehlen.map((n) => n.titel + (n.stimme ? ` (${n.stimme})` : '')).join(', ')}.` : '',
        uebrig ? `${uebrig} gewählte ${uebrig === 1 ? 'Datei passte' : 'Dateien passten'} zu keinen Noten (über „Noten hinzufügen“ neu anlegen).` : '',
      ].filter(Boolean).join(' '));
      setAuswahl(new Set());
    } catch (x) {
      setWarnung(`${fertig} von ${ziel.length} aktualisiert, dann ging es nicht weiter: ${fehlerGrund(x)}`);
    } finally {
      setLaeuft(false);
      laden();
    }
  }

  // Einzeln nacheinander (jede Note samt Stellen und Anmerkungen in einer
  // Transaktion). Scheitert eine, sagt die Meldung, wie weit es kam.
  async function loeschen() {
    const ids = [...auswahl];
    if (!confirm(`${ids.length} Noten mit allen Stellen und Anmerkungen von diesem Gerät löschen?`)) return;
    setMeldung(''); setWarnung(''); setLaeuft(true);
    const geloescht = new Set<string>();
    try {
      for (const id of ids) { await notenLoeschen(id); geloescht.add(id); }
      setAuswahl(new Set());
    } catch (x) {
      setWarnung(`${geloescht.size} von ${ids.length} gelöscht, der Rest ist noch da und weiter ausgewählt: ${fehlerGrund(x)}`);
      setAuswahl(new Set(ids.filter((id) => !geloescht.has(id))));
    } finally {
      setLaeuft(false);
      laden();
    }
  }

  const umschalten = (id: string) => setAuswahl((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const gewaehlteNoten = sortiert.filter((n) => auswahl.has(n.id));

  return (
    <div className="space-y-4">
      <p className="gedaempft text-sm">
        Die Noten bleiben nur auf diesem Gerät, nichts geht auf den Server. Dateinamen wie „Titel - Stimme.pdf“ werden automatisch aufgeteilt.
      </p>
      {fehler && <p className="karte warnung">{fehler}</p>}
      {meldung && <p className="karte" role="status">{meldung}</p>}
      {warnung && <p className="karte warnung" role="alert">{warnung}</p>}
      {sicherung.meldung && <p className="karte" role="status">{sicherung.meldung}</p>}
      {sicherung.fehler && <p className="karte warnung" role="alert">{sicherung.fehler}</p>}
      {sicherung.eingabe}

      {/* Leere Liste: Hinzufügen und Laden stehen in der Hinweis-Karte, Sortieren gibt es noch nichts. */}
      {!!noten?.length && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="knopf" onClick={() => void hinzufuegen()} disabled={laeuft}>+ Noten hinzufügen</button>
          <span className="flex-1" />
          <div className="segment !mx-0" role="group" aria-label="Sortieren">
            <button type="button" aria-pressed={sortierung === 'zuletzt'} onClick={() => { setSortierung('zuletzt'); speichern('ueben:sort', 'zuletzt'); }}>Zuletzt genutzt</button>
            <button type="button" aria-pressed={sortierung === 'abc'} onClick={() => { setSortierung('abc'); speichern('ueben:sort', 'abc'); }}>A–Z</button>
          </div>
        </div>
      )}

      {!!noten?.length && (
        <div className="karte flex flex-wrap items-center gap-2 !py-2">
          <label className="alle-waehlen flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="auswahl-box" checked={alleGewaehlt}
              onChange={() => setAuswahl(alleGewaehlt ? new Set() : new Set(noten.map((n) => n.id)))} aria-label="Alle auswählen" />
            {auswahl.size ? `${auswahl.size} ausgewählt` : 'Auswählen'}
          </label>
          <span className="flex-1" />
          <button type="button" className="knopf knopf-leise knopf-klein" disabled={!auswahl.size || laeuft} onClick={() => void aktualisieren(gewaehlteNoten)}>
            Auswahl aktualisieren
          </button>
          <button type="button" className="knopf knopf-leise knopf-klein" disabled={laeuft} onClick={() => void aktualisieren(sortiert)}>
            Alle aktualisieren
          </button>
          {!!auswahl.size && (
            <button type="button" className="text-knopf gedaempft text-sm underline" disabled={laeuft} onClick={() => void loeschen()}>löschen</button>
          )}
        </div>
      )}
      {laeuft && <p className="gedaempft text-sm">Einen Moment …</p>}

      <ul className="space-y-2">
        {noten?.length === 0 && (
          <li className="karte space-y-3">
            <p>Noch keine Noten auf diesem Gerät. Mit „+ Noten hinzufügen“ eine oder mehrere PDF-Dateien wählen.</p>
            <p>
              <strong>Umzug aus der Registerführer-App?</strong> Dort auf der Übe-Seite „Sicherung vorbereiten“ und
              herunterladen, dann hier „Sicherung laden“. Auf jedem Gerät einzeln — Safari-Tab und Home-Bildschirm-App
              haben getrennte Speicher. Metronom-Einstellungen bitte neu setzen.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="knopf" onClick={sicherung.waehlen} disabled={sicherung.laeuft || laeuft}>
                {sicherung.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
              </button>
              <button type="button" className="knopf knopf-leise" onClick={() => void hinzufuegen()} disabled={sicherung.laeuft || laeuft}>+ Noten hinzufügen</button>
            </div>
          </li>
        )}
        {sortiert.map((n) => (
          <li key={n.id} className={`karte flex items-center gap-3 !py-3 ${auswahl.has(n.id) ? 'gewaehlt' : ''}`}>
            <label className="auswahl-feld"><input type="checkbox" className="auswahl-box" checked={auswahl.has(n.id)} onChange={() => umschalten(n.id)} aria-label={`${n.titel} auswählen`} /></label>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => oeffnen(n.id)}>
              <span className="block truncate font-bold">{n.titel}</span>
              <span className="gedaempft block truncate text-sm">
                {[n.stimme, n.zuletzt ? `zuletzt ${datum(n.zuletzt)}` : 'noch nicht geöffnet', n.aktualisiert ? `aktualisiert ${datum(n.aktualisiert)}` : ''].filter(Boolean).join(' · ')}
              </span>
            </button>
            <span className="gedaempft" aria-hidden="true">›</span>
          </li>
        ))}
      </ul>

      {/* Bei leerer Liste steht „Sicherung laden“ schon in der Hinweis-Karte, speichern gibt es nichts. */}
      {!!noten?.length && <Sicherung laden={sicherung} />}
    </div>
  );
}

const datum = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
