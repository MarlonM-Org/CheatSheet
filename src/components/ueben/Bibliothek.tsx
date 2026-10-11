'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ausDateiname, nachTitel, zeitpunkt, zuordnen } from '@/domain/notenpult';
import { gespeichert, speichern } from './klang';
import { zuletztAus } from '@/domain/speicher';
import { alleNoten, notenAendern, notenAnlegen, notenLoeschen, zuletztListe, type LokaleNoten } from './lokal';
import { Sicherung, useSicherungLaden } from './Sicherung';
import { fehlerGrund } from './speicherfehler';
import { useEscape } from './tasten';

// Bibliothek (B-02): Overlay über den Noten — Liste, Hinzufügen, Aktualisieren,
// Löschen, Sicherung. Tipp auf ein Stück öffnet es vollflächig.
export function Bibliothek({ offen, oeffnen, schliessen, einstellungen, offenEntfernt, aktualisiert, escapeAktiv }: {
  offen: string | null;
  oeffnen: (id: string) => void;
  schliessen: () => void;
  einstellungen: () => void;
  offenEntfernt: () => void;
  aktualisiert: (ids: string[]) => void;
  escapeAktiv: boolean;
}) {
  const [anzahl, setAnzahl] = useState<number | null>(null);
  useEscape(schliessen, escapeAktiv);

  return (
    <section className="bibliothek" role="region" aria-label="Bibliothek">
      <div className="panel-kopf mit-linie">
        <h2>Bibliothek</h2>
        {anzahl !== null && <span className="bib-anzahl">{anzahl} {anzahl === 1 ? 'Stück' : 'Stücke'}</span>}
        <button type="button" className="panel-zu" onClick={einstellungen} aria-label="Einstellungen">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" />
          </svg>
        </button>
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Bibliothek schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="bib-inhalt">
        <NotenListe offen={offen} oeffnen={oeffnen} anzahlMelden={setAnzahl} offenEntfernt={offenEntfernt} aktualisiert={aktualisiert} />
      </div>
      <div className="bib-fuss">Alles bleibt auf diesem Gerät. Kein Konto, kein Server.</div>
    </section>
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

function NotenListe({ offen, oeffnen, anzahlMelden, offenEntfernt, aktualisiert }: {
  offen: string | null; oeffnen: (id: string) => void; anzahlMelden: (n: number) => void;
  offenEntfernt: () => void; aktualisiert: (ids: string[]) => void;
}) {
  const [noten, setNoten] = useState<LokaleNoten[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState('');
  // Teilweise gescheitert (Gerätespeicher): was geklappt hat und was nicht.
  const [warnung, setWarnung] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [sortierung, setSortierung] = useState<'zuletzt' | 'abc'>(() => gespeichert('ueben:sort', 'zuletzt'));
  const [laeuft, setLaeuft] = useState(false);
  const [zuletzt, setZuletzt] = useState<Record<string, number>>(() => zuletztListe());
  const laden = useCallback(() => {
    alleNoten().then((l) => { setZuletzt(zuletztListe()); setNoten(l); })
      .catch((e) => setFehler(`Gerätespeicher nicht verfügbar: ${(e as Error).message}`));
  }, []);
  useEffect(laden, [laden]);
  useEffect(() => { if (noten) anzahlMelden(noten.length); }, [noten, anzahlMelden]);
  const sicherung = useSicherungLaden(laden);

  const sortiert = useMemo(() => [...(noten ?? [])].sort((a, b) => sortierung === 'abc'
    ? nachTitel(a, b)
    : (zuletztAus(zuletzt, b) ?? b.erstellt) - (zuletztAus(zuletzt, a) ?? a.erstellt)), [noten, sortierung, zuletzt]);
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
    const geaendert: string[] = [];
    try {
      const offenOhne: LokaleNoten[] = [];
      if (kannVerweise()) {
        for (const n of ziel) {
          const datei = await ausVerweis(n);
          if (datei) { await notenAendern(n.id, { datei, aktualisiert: Date.now() }); fertig++; geaendert.push(n.id); } else offenOhne.push(n);
        }
      } else offenOhne.push(...ziel);

      let fehlen: LokaleNoten[] = [];
      let uebrig = 0;
      if (offenOhne.length) {
        // Ohne Dateiverweis (iPad/iPhone): einmal die Dateien wählen, Zuordnung über den Namen.
        const gewaehlt = await dateienWaehlen();
        if (!gewaehlt.length && !fertig) return; // abgebrochen: keine Meldung
        const r = zuordnen(offenOhne, gewaehlt.map((g) => g.datei.name));
        for (const p of r.paare) {
          const g = gewaehlt[p.datei];
          await notenAendern(p.notenId, { datei: g.datei, dateiname: g.datei.name, aktualisiert: Date.now(), ...(g.handle ? { handle: g.handle } : {}) });
          fertig++;
          geaendert.push(p.notenId);
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
      // Offenes Stück ggf. mit der frischen Datei neu aufbauen.
      if (geaendert.length) aktualisiert(geaendert);
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
      if (offen && geloescht.has(offen)) offenEntfernt();
    }
  }

  const umschalten = (id: string) => setAuswahl((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const gewaehlteNoten = sortiert.filter((n) => auswahl.has(n.id));

  return (
    <div className="space-y-4">
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
          <li key={n.id} className={`karte flex items-center gap-3 !py-3 ${auswahl.has(n.id) ? 'gewaehlt' : ''} ${offen === n.id ? 'offen-markiert' : ''}`}>
            <label className="auswahl-feld"><input type="checkbox" className="auswahl-box" checked={auswahl.has(n.id)} onChange={() => umschalten(n.id)} aria-label={`${n.titel} auswählen`} /></label>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => oeffnen(n.id)}>
              <span className="block truncate font-bold">{n.titel}</span>
              <span className="gedaempft block truncate text-sm">
                {[n.stimme, zuletztAus(zuletzt, n) ? `zuletzt ${zeitpunkt(zuletztAus(zuletzt, n)!)}` : 'noch nicht geöffnet', n.aktualisiert ? `aktualisiert ${datum(n.aktualisiert)}` : ''].filter(Boolean).join(' · ')}
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
