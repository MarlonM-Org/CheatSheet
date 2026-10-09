'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ausDateiname, zuordnen } from '@/domain/notenpult';
import { gespeichert, speichern } from './klang';
import { alleNoten, notenAendern, notenAnlegen, notenLoeschen, type LokaleNoten } from './lokal';
import { Metronom } from './Metronom';
import { MetronomAnbieter } from './MetronomKontext';
import { NotenPult } from './NotenPult';
import { Sicherung } from './Sicherung';
import { Stimmgeraet } from './Stimmgeraet';

type Reiter = 'metronom' | 'stimmgeraet' | 'noten';

export function UebeZentrale() {
  return <MetronomAnbieter><Zentrale /></MetronomAnbieter>;
}

function Zentrale() {
  const [reiter, setReiter] = useState<Reiter>(() => gespeichert('ueben:reiter', 'metronom'));
  const [offen, setOffen] = useState<string | null>(null);
  const wechseln = (k: Reiter) => { setReiter(k); speichern('ueben:reiter', k); if (k !== 'noten') setOffen(null); };

  return (
    <div className="space-y-5">
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
            <button type="button" className="text-sm underline" onClick={() => setOffen(null)}>← Alle Noten</button>
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
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [sortierung, setSortierung] = useState<'zuletzt' | 'abc'>(() => gespeichert('ueben:sort', 'zuletzt'));
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(() => { alleNoten().then(setNoten).catch((e) => setFehler(`Gerätespeicher nicht verfügbar: ${(e as Error).message}`)); }, []);
  useEffect(laden, [laden]);

  const sortiert = useMemo(() => [...(noten ?? [])].sort((a, b) => sortierung === 'abc'
    ? a.titel.localeCompare(b.titel, 'de') || a.stimme.localeCompare(b.stimme, 'de')
    : (b.zuletzt ?? b.erstellt) - (a.zuletzt ?? a.erstellt)), [noten, sortierung]);
  const alleGewaehlt = !!noten?.length && auswahl.size === noten.length;

  async function hinzufuegen() {
    const gewaehlt = await dateienWaehlen();
    if (!gewaehlt.length) return;
    setLaeuft(true);
    for (const { datei, handle } of gewaehlt) {
      const { titel, stimme } = ausDateiname(datei.name);
      await notenAnlegen({ titel, stimme, datei, dateiname: datei.name, handle });
    }
    setLaeuft(false);
    setMeldung(`${gewaehlt.length} ${gewaehlt.length === 1 ? 'Datei' : 'Dateien'} hinzugefügt. Titel und Stimme stammen aus dem Dateinamen.`);
    laden();
  }

  // Dieselben Dateien neu einlesen; markierte Stellen und Anmerkungen bleiben.
  async function aktualisieren(ziel: LokaleNoten[]) {
    if (!ziel.length) return;
    setMeldung(''); setLaeuft(true);
    let fertig = 0;
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
      if (!gewaehlt.length && !fertig) { setLaeuft(false); return; } // abgebrochen: keine Meldung
      const r = zuordnen(offen, gewaehlt.map((g) => g.datei.name));
      for (const p of r.paare) {
        const g = gewaehlt[p.datei];
        await notenAendern(p.notenId, { datei: g.datei, dateiname: g.datei.name, aktualisiert: Date.now(), ...(g.handle ? { handle: g.handle } : {}) });
        fertig++;
      }
      fehlen = r.ohneDatei;
      uebrig = r.ohneNoten.length;
    }
    setLaeuft(false);
    setMeldung([
      fertig ? `${fertig} von ${ziel.length} aktualisiert — markierte Stellen und Anmerkungen sind erhalten.` : 'Nichts aktualisiert.',
      fehlen.length ? `Keine passende Datei für: ${fehlen.map((n) => n.titel + (n.stimme ? ` (${n.stimme})` : '')).join(', ')}.` : '',
      uebrig ? `${uebrig} gewählte ${uebrig === 1 ? 'Datei passte' : 'Dateien passten'} zu keinen Noten (über „Noten hinzufügen“ neu anlegen).` : '',
    ].filter(Boolean).join(' '));
    setAuswahl(new Set());
    laden();
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

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="knopf" onClick={() => void hinzufuegen()} disabled={laeuft}>+ Noten hinzufügen</button>
        <span className="flex-1" />
        <div className="segment !mx-0" role="group" aria-label="Sortieren">
          <button type="button" aria-pressed={sortierung === 'zuletzt'} onClick={() => { setSortierung('zuletzt'); speichern('ueben:sort', 'zuletzt'); }}>Zuletzt genutzt</button>
          <button type="button" aria-pressed={sortierung === 'abc'} onClick={() => { setSortierung('abc'); speichern('ueben:sort', 'abc'); }}>A–Z</button>
        </div>
      </div>

      {!!noten?.length && (
        <div className="karte flex flex-wrap items-center gap-2 !py-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
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
            <button type="button" className="gedaempft text-sm underline" disabled={laeuft} onClick={async () => {
              if (!confirm(`${auswahl.size} Noten mit allen Stellen und Anmerkungen von diesem Gerät löschen?`)) return;
              for (const id of auswahl) await notenLoeschen(id);
              setAuswahl(new Set()); laden();
            }}>löschen</button>
          )}
        </div>
      )}
      {laeuft && <p className="gedaempft text-sm">Einen Moment …</p>}

      <ul className="space-y-2">
        {noten?.length === 0 && (
          <li className="karte space-y-2">
            <p>Noch keine Noten auf diesem Gerät. Mit „+ Noten hinzufügen“ eine oder mehrere PDF-Dateien wählen.</p>
            <p className="font-bold">Umzug aus der Registerführer-App? Dort unter Admin → Üben ‚Sicherung speichern‘, dann hier ‚Sicherung laden‘.</p>
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

      {noten && <Sicherung leer={noten.length === 0} geaendert={laden} />}
    </div>
  );
}

const datum = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
