'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ausDateiname, nachTitel, zeitpunkt, zuordnen } from '@/domain/notenpult';
import { gespeichert, speichern } from './klang';
import { zuletztAus } from '@/domain/speicher';
import { alleNoten, alleStellen, alleUmziehen, notenAendern, notenAnlegen, notenLoeschen, zuletztListe, type LokaleNoten, type LokaleStelle } from './lokal';
import { useSicherungLaden } from './Sicherung';
import { MixKarte } from './StellenMix';
import { fehlerGrund } from './speicherfehler';
import { useEscape } from './tasten';

// Bibliothek (B-02): Overlay über den Noten — Stellen-Mix, Liste, Hinzufügen;
// Aktualisieren und Löschen im Auswahl-Modus. Tipp auf ein Stück öffnet es
// vollflächig.
export function Bibliothek({ offen, oeffnen, schliessen, einstellungen, offenEntfernt, aktualisiert, escapeAktiv, stand, mixStarten }: {
  offen: string | null;
  oeffnen: (id: string) => void;
  schliessen: () => void;
  einstellungen: () => void;
  offenEntfernt: () => void;
  aktualisiert: (ids: string[]) => void;
  escapeAktiv: boolean;
  // Ändert sich, wenn anderswo (Einstellungen) eine Sicherung geladen wurde.
  stand: number;
  mixStarten: (neu: boolean) => void;
}) {
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  useEscape(schliessen, escapeAktiv);

  return (
    <section className="bibliothek" role="region" aria-label="Bibliothek">
      <div className="panel-kopf mit-linie">
        <h2>Bibliothek</h2>
        {gewaehlt !== null ? <span className="bib-anzahl" role="status">· {gewaehlt} gewählt</span>
          : anzahl !== null && <span className="bib-anzahl">· {anzahl} {anzahl === 1 ? 'Stück' : 'Stücke'}</span>}
        <span className="flex-1" />
        <button type="button" className="panel-zu bib-zahnrad" onClick={einstellungen} aria-label="Einstellungen">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 19, height: 19 }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button type="button" className="panel-zu" onClick={schliessen} aria-label="Bibliothek schließen">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="bib-inhalt">
        <NotenListe offen={offen} oeffnen={oeffnen} anzahlMelden={setAnzahl} auswahlMelden={setGewaehlt} offenEntfernt={offenEntfernt} aktualisiert={aktualisiert} stand={stand} mixStarten={mixStarten} />
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

function NotenListe({ offen, oeffnen, anzahlMelden, auswahlMelden, offenEntfernt, aktualisiert, stand, mixStarten }: {
  offen: string | null; oeffnen: (id: string) => void; anzahlMelden: (n: number) => void;
  // Im Auswahl-Modus: wie viele gewählt sind (für den Kopf), sonst null.
  auswahlMelden: (n: number | null) => void;
  offenEntfernt: () => void; aktualisiert: (ids: string[]) => void; stand: number; mixStarten: (neu: boolean) => void;
}) {
  const [noten, setNoten] = useState<LokaleNoten[] | null>(null);
  const [stellen, setStellen] = useState<LokaleStelle[]>([]);
  const [fehler, setFehler] = useState('');
  const [meldung, setMeldung] = useState('');
  // Teilweise gescheitert (Gerätespeicher): was geklappt hat und was nicht.
  const [warnung, setWarnung] = useState('');
  // Auswahl-Modus (wie „Auswählen“ in der Dateien-App): erst dann Häkchen,
  // Aktualisieren und Löschen — sonst bleibt die Liste ruhig.
  const [auswaehlen, setAuswaehlen] = useState(false);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [sortierung, setSortierung] = useState<'zuletzt' | 'abc'>(() => gespeichert('ueben:sort', 'zuletzt'));
  const [laeuft, setLaeuft] = useState(false);
  const [zuletzt, setZuletzt] = useState<Record<string, number>>(() => zuletztListe());
  const laden = useCallback(() => {
    Promise.all([alleNoten(), alleStellen()]).then(([l, st]) => { setZuletzt(zuletztListe()); setNoten(l); setStellen(st); void alleUmziehen(); })
      .catch((e) => setFehler(`Gerätespeicher nicht verfügbar: ${(e as Error).message}`));
  }, []);
  useEffect(laden, [laden, stand]);
  useEffect(() => { if (noten) anzahlMelden(noten.length); }, [noten, anzahlMelden]);
  useEffect(() => { auswahlMelden(auswaehlen ? auswahl.size : null); }, [auswaehlen, auswahl, auswahlMelden]);
  const sicherung = useSicherungLaden(laden);

  const sortiert = useMemo(() => [...(noten ?? [])].sort((a, b) => sortierung === 'abc'
    ? nachTitel(a, b)
    : (zuletztAus(zuletzt, b) ?? b.erstellt) - (zuletztAus(zuletzt, a) ?? a.erstellt)), [noten, sortierung, zuletzt]);
  const alleGewaehlt = !!noten?.length && auswahl.size === noten.length;
  const stellenJe = useMemo(() => {
    const je: Record<string, number> = {};
    for (const s of stellen) je[s.notenId] = (je[s.notenId] ?? 0) + 1;
    return je;
  }, [stellen]);

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
      setAuswaehlen(false);
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
      setAuswaehlen(false);
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

  const auswahlEnde = () => { setAuswaehlen(false); setAuswahl(new Set()); };

  return (
    <div className="space-y-3">
      {fehler && <p className="karte warnung">{fehler}</p>}
      {meldung && <p className="karte" role="status">{meldung}</p>}
      {warnung && <p className="karte warnung" role="alert">{warnung}</p>}
      {sicherung.meldung && <p className="karte" role="status">{sicherung.meldung}</p>}
      {sicherung.fehler && <p className="karte warnung" role="alert">{sicherung.fehler}</p>}
      {sicherung.eingabe}

      {!!noten?.length && <MixKarte stellen={stellen} starten={mixStarten} />}

      {/* Leere Liste: Hinzufügen und Laden stehen in der Hinweis-Karte, Sortieren gibt es noch nichts. */}
      {!!noten?.length && (auswaehlen ? (
        <div className="bib-werkzeuge" role="toolbar" aria-label="Auswahl">
          <label className="alle-waehlen flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="auswahl-box" checked={alleGewaehlt}
              onChange={() => setAuswahl(alleGewaehlt ? new Set() : new Set(noten.map((n) => n.id)))} aria-label="Alle auswählen" />
            Alle
          </label>
          <span className="flex-1" />
          <button type="button" className="knopf knopf-leise knopf-klein" disabled={!auswahl.size || laeuft} onClick={() => void aktualisieren(gewaehlteNoten)}
            title="Die PDF-Dateien neu einlesen; Stellen und Anmerkungen bleiben">Aktualisieren</button>
          <button type="button" className="text-knopf bib-loeschen" disabled={!auswahl.size || laeuft} onClick={() => void loeschen()}>Löschen</button>
          <button type="button" className="text-knopf bib-fertig" onClick={auswahlEnde}>Fertig</button>
        </div>
      ) : (
        <div className="bib-werkzeuge">
          <button type="button" className="knopf knopf-klein" onClick={() => void hinzufuegen()} disabled={laeuft}>+ Noten</button>
          <span className="flex-1" />
          <div className="segment !mx-0" role="group" aria-label="Sortieren">
            <button type="button" aria-pressed={sortierung === 'zuletzt'} onClick={() => { setSortierung('zuletzt'); speichern('ueben:sort', 'zuletzt'); }}>Zuletzt</button>
            <button type="button" aria-pressed={sortierung === 'abc'} onClick={() => { setSortierung('abc'); speichern('ueben:sort', 'abc'); }}>A–Z</button>
          </div>
          <button type="button" className="text-knopf bib-auswaehlen" onClick={() => setAuswaehlen(true)}>Auswählen</button>
        </div>
      ))}
      {laeuft && <p className="gedaempft text-sm">Einen Moment …</p>}

      {noten?.length === 0 && (
        <div className="karte space-y-3">
          <p>Noch keine Noten auf diesem Gerät. Mit „+ Noten hinzufügen“ eine oder mehrere PDF-Dateien wählen.</p>
          <p>
            <strong>Noten von einem anderen Gerät?</strong> Dort in den Einstellungen (Zahnrad) „Sicherung erstellen“
            und die Datei speichern oder teilen, dann hier „Sicherung laden“. Das geht auch mit einer Sicherung aus der
            Registerführer-App. Safari-Tab und Home-Bildschirm-App haben getrennte Speicher.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="knopf" onClick={sicherung.waehlen} disabled={sicherung.laeuft || laeuft}>
              {sicherung.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
            </button>
            <button type="button" className="knopf knopf-leise" onClick={() => void hinzufuegen()} disabled={sicherung.laeuft || laeuft}>+ Noten hinzufügen</button>
          </div>
        </div>
      )}

      {!!sortiert.length && (
        <ul className="bib-liste">
          {sortiert.map((n) => {
            const z = zuletztAus(zuletzt, n);
            const anzahlStellen = stellenJe[n.id] ?? 0;
            return (
              <li key={n.id} className={`bib-zeile ${auswaehlen && auswahl.has(n.id) ? 'gewaehlt' : ''} ${offen === n.id ? 'offen-markiert' : ''}`}>
                {auswaehlen && (
                  <label className="auswahl-feld"><input type="checkbox" className="auswahl-box" checked={auswahl.has(n.id)} onChange={() => umschalten(n.id)} aria-label={`${n.titel} auswählen`} /></label>
                )}
                <button type="button" className="bib-stueck" onClick={() => (auswaehlen ? umschalten(n.id) : oeffnen(n.id))}>
                  <span className="bib-titel">{n.titel}</span>
                  <span className="bib-unterzeile">
                    {[n.stimme, z ? `zuletzt ${zeitpunkt(z)}` : 'noch nicht geöffnet',
                      anzahlStellen ? `${anzahlStellen} ${anzahlStellen === 1 ? 'Stelle' : 'Stellen'}` : '',
                      n.aktualisiert ? `aktualisiert ${datum(n.aktualisiert)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </button>
                {!auswaehlen && <span className="bib-pfeil" aria-hidden="true">›</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const datum = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
