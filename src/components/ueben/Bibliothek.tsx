'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loeschHinweis } from '@/domain/bestand';
import { stand } from '@/domain/einspielen';
import { ausDateiname, nachTitel, zeitpunkt, zuordnen } from '@/domain/notenpult';
import {
  dateiSchluessel, gleicheSammlung, imFilter, mitSammlung, ohneSammlung, ordnerPlanen, sammlungenUebersicht, sammlungenVon,
  sammlungUmbenennen, sicherungFaellig,
} from '@/domain/sammlungen';
import { quellenText, stellenJeStueck } from '@/domain/sicht';
import type { MixBereich } from '@/domain/stellen';
import { imTagFilter, mitTag, tagsVon, tagUebersicht, type Tag } from '@/domain/tags';
import { gespeichert, speichern } from './klang';
import { zuletztAus } from '@/domain/speicher';
import {
  alleStellen, alleStuecke, dateiGroessen, DateiNichtLesbar, letzteSicherung, loeschVorschau, sammlungenSetzen, stueckAendern, stueckAnlegen,
  stueckeLoeschen, tagsLaden, tagsSetzen, vorgaengerDa, zuletztListe, type Stelle, type Stueck,
  SICHERUNG_ERINNERN,
} from './lokal';
import { HinzufuegenMenue, SammlungenLeiste, SammlungKopf, SammlungWahl } from './Sammlungen';
import { bilderWaehlen, ScanDialog, type ScanArt } from './Scan';
import { useSicherungLaden } from './Sicherung';
import { MixZeile } from './StellenMix';
import { TagEtikett, TagFilter, TagWahl } from './Tags';
import { fehlerGrund } from './speicherfehler';
import { useEscape } from './tasten';

// Bibliothek (B-02): Overlay über den Noten — Sammlungen (F-13), Stellen-Mix,
// Liste, Hinzufügen (Dateien oder Ordner); Einsortieren, Aktualisieren und
// Löschen im Auswahl-Modus. Tipp auf ein Stück öffnet es vollflächig.
export function Bibliothek({ offen, oeffnen, schliessen, einstellungen, offenEntfernt, aktualisiert, escapeAktiv, stand, mixStarten, mixAktiv }: {
  offen: string | null;
  oeffnen: (id: string) => void;
  schliessen: () => void;
  einstellungen: () => void;
  offenEntfernt: () => void;
  aktualisiert: (ids: string[]) => void;
  escapeAktiv: boolean;
  // Ändert sich, wenn anderswo (Einstellungen) eine Sicherung geladen wurde.
  stand: number;
  mixStarten: (neu: boolean, bereich: MixBereich) => void;
  // Der gerade laufende Mix (null: keiner) — seine Runde heißt „Weiter bei …“.
  mixAktiv: MixBereich | null;
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
        <NotenListe offen={offen} oeffnen={oeffnen} anzahlMelden={setAnzahl} auswahlMelden={setGewaehlt} offenEntfernt={offenEntfernt} aktualisiert={aktualisiert} stand={stand} mixStarten={mixStarten} mixAktiv={mixAktiv} einstellungen={einstellungen} />
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

// Einen ganzen Ordner wählen (auf dem iPhone ab iOS 18.4): alle Dateien darin
// samt Unterordnern, jede mit ihrem Pfad (webkitRelativePath). Einmal gelesen
// — die App merkt sich den Ordner nicht (das kann Safari nicht).
function ordnerWaehlen(): Promise<File[]> {
  return new Promise((ok) => {
    let fertig = false;
    const ende = (liste: File[]) => { if (!fertig) { fertig = true; ok(liste); } };
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.webkitdirectory = true;
    input.onchange = () => ende([...(input.files ?? [])]);
    input.oncancel = () => ende([]);
    window.addEventListener('focus', () => window.setTimeout(() => { if (!input.files?.length) ende([]); }, 1200), { once: true });
    input.click();
  });
}

async function ausVerweis(n: Stueck): Promise<File | null> {
  const h = n.handle as Recht | undefined;
  if (!h) return null;
  try {
    let recht = await h.queryPermission?.({ mode: 'read' });
    if (recht !== 'granted') recht = await h.requestPermission?.({ mode: 'read' });
    return recht === 'granted' ? await h.getFile() : null;
  } catch { return null; }
}

function NotenListe({ offen, oeffnen, anzahlMelden, auswahlMelden, offenEntfernt, aktualisiert, stand: bibStand, mixStarten, mixAktiv, einstellungen }: {
  offen: string | null; oeffnen: (id: string) => void; anzahlMelden: (n: number) => void;
  // Im Auswahl-Modus: wie viele gewählt sind (für den Kopf), sonst null.
  auswahlMelden: (n: number | null) => void;
  offenEntfernt: () => void; aktualisiert: (ids: string[]) => void; stand: number;
  mixStarten: (neu: boolean, bereich: MixBereich) => void; mixAktiv: MixBereich | null; einstellungen: () => void;
}) {
  const [noten, setNoten] = useState<Stueck[] | null>(null);
  const [stellen, setStellen] = useState<Stelle[]>([]);
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
  // Sammlungen (F-13): gewählter Filter (gemerkt), eine gerade angelegte,
  // noch leere Sammlung, und ob neue Stücke in die gewählte kommen.
  const [sammlung, setSammlung] = useState<string | null>(() => gespeichert<string | null>('ueben:sammlung', null));
  const [sammlungNeu, setSammlungNeu] = useState<string | null>(null);
  const [einsortieren, setEinsortieren] = useState(true);
  const [sammlungBlatt, setSammlungBlatt] = useState<string[] | null>(null);
  // Tags (F-14): Definitionen, gewählter Tag-Filter (gemerkt), ob neue
  // Stücke damit markiert werden, Markier-Blatt.
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(() => gespeichert<string | null>('ueben:tag', null));
  const [markieren, setMarkieren] = useState(true);
  const [tagBlatt, setTagBlatt] = useState<string[] | null>(null);
  const [fortschritt, setFortschritt] = useState('');
  // Kamera-Scan / Foto-Import (F-07): offener Dialog mit den zuerst gewählten Bildern.
  const [scan, setScan] = useState<{ art: ScanArt; start: File[] } | null>(null);
  // Erinnerung an die Sicherung (H-01)
  const [erinnerung, setErinnerung] = useState<{ faellig: boolean; tage: number | null } | null>(null);
  // Abschaltbar in den Einstellungen (je Gerät); „ausblenden“ hier tut dasselbe.
  const [erinnern, setErinnern] = useState(() => gespeichert(SICHERUNG_ERINNERN, true));
  const erinnerungAus = () => { setErinnern(false); speichern(SICHERUNG_ERINNERN, false); };
  const laden = useCallback(() => {
    Promise.all([alleStuecke(), alleStellen()]).then(([l, st]) => {
      setZuletzt(zuletztListe()); setNoten(l); setStellen(st); setTags(tagsLaden());
      // Der gemerkte Tag-Filter (nach dem Zusammenlegen Doppelter womöglich umgestellt).
      setTagFilter(gespeichert<string | null>('ueben:tag', null));
      const aenderung = Math.max(0, ...l.map((n) => stand(n as unknown as Record<string, unknown>)), ...st.map((x) => stand(x as unknown as Record<string, unknown>)));
      const erste = l.length ? Math.min(...l.map((n) => n.erstellt)) : null;
      setErinnerung(sicherungFaellig(letzteSicherung(), aenderung, erste, Date.now()));
    }).catch((e) => setFehler(`Gerätespeicher nicht verfügbar: ${(e as Error).message}`));
  }, []);
  useEffect(laden, [laden, bibStand]);
  useEffect(() => { if (noten) anzahlMelden(noten.length); }, [noten, anzahlMelden]);
  useEffect(() => { auswahlMelden(auswaehlen ? auswahl.size : null); }, [auswaehlen, auswahl, auswahlMelden]);
  const sicherung = useSicherungLaden(laden);
  // Leere Bibliothek, aber die Datenbank der Vorgängerversion liegt noch auf
  // dem Gerät: Hinweis samt „Übernehmen“ (docs/datenmodell.md, Umstieg).
  const [vorgaenger, setVorgaenger] = useState(false);
  const leer = noten?.length === 0;
  useEffect(() => { if (leer) vorgaengerDa().then(setVorgaenger); }, [leer]);

  const sortiert = useMemo(() => [...(noten ?? [])].sort((a, b) => sortierung === 'abc'
    ? nachTitel(a, b)
    : (zuletztAus(zuletzt, b) ?? b.erstellt) - (zuletztAus(zuletzt, a) ?? a.erstellt)), [noten, sortierung, zuletzt]);
  const uebersicht = useMemo(() => sammlungenUebersicht(noten ?? []), [noten]);
  // Gewählt ist eine Sammlung, die es gibt — oder die gerade angelegte.
  const aktiv = sammlung !== null && (uebersicht.some((x) => gleicheSammlung(x.name, sammlung)) || (sammlungNeu !== null && gleicheSammlung(sammlungNeu, sammlung))) ? sammlung : null;
  const sammlungWaehlen = (name: string | null) => {
    setSammlung(name); speichern('ueben:sammlung', name); setEinsortieren(true);
    if (name && !uebersicht.some((x) => gleicheSammlung(x.name, name))) setSammlungNeu(name);
  };
  const aktivTag = tagFilter !== null && tags.some((t) => t.id === tagFilter) ? tagFilter : null;
  const zielTag = tags.find((t) => t.id === aktivTag) ?? null;
  const tagWaehlen = (id: string | null) => { setTagFilter(id); speichern('ueben:tag', id); setMarkieren(true); };
  const tagUeber = useMemo(() => tagUebersicht(tags, noten ?? []), [tags, noten]);
  const gefiltert = useMemo(() => sortiert.filter((n) => imFilter(n, aktiv) && imTagFilter(n, aktivTag)), [sortiert, aktiv, aktivTag]);
  const alleGewaehlt = gefiltert.length > 0 && gefiltert.every((n) => auswahl.has(n.id));
  // Ein virtuelles Stück zählt die Stellen seiner Quelle in seinem Bereich (F-03).
  const stellenJe = useMemo(() => stellenJeStueck(noten ?? [], stellen), [noten, stellen]);
  const titelVon = (id: string) => noten?.find((x) => x.id === id)?.titel;

  // Dateien oder einen Ordner hinzufügen. Was schon in der Bibliothek liegt
  // (gleicher Dateiname, gleiche Größe), wird nicht doppelt angelegt, nur
  // einsortiert; dieselbe Datei in mehreren Unterordnern wird ein Stück in
  // mehreren Sammlungen (ordnerPlanen). Ist eine Sammlung gewählt und
  // „einsortieren“ an, kommen die Stücke auch dort hinein.
  async function hinzufuegen(art: 'dateien' | 'ordner') {
    const gewaehlt: { datei: File; handle?: FileSystemFileHandle }[] = art === 'ordner'
      ? (await ordnerWaehlen()).map((datei) => ({ datei }))
      : await dateienWaehlen();
    if (!gewaehlt.length) return;
    const ziel = aktiv && einsortieren ? aktiv : null;
    const tagZiel = zielTag && markieren ? zielTag : null;
    setLaeuft(true); setMeldung(''); setWarnung('');
    let fertig = 0;
    try {
      const liste = noten ?? [];
      const pfade = gewaehlt.map(({ datei }) => ({ pfad: datei.webkitRelativePath || datei.name, groesse: datei.size }));
      const namen = new Set(gewaehlt.map(({ datei }) => dateiSchluessel(datei.name)));
      const kandidaten = liste.filter((n) => n.dateiname && namen.has(dateiSchluessel(n.dateiname)));
      const groessen = await dateiGroessen(kandidaten);
      const plan = ordnerPlanen(pfade, kandidaten.map((n) => ({ id: n.id, dateiname: n.dateiname, groesse: groessen.get(n.id) })), ziel);
      // Eine nicht lesbare Datei (z. B. nur in iCloud) wird übersprungen und
      // genannt; scheitert der Gerätespeicher, geht es nicht weiter.
      const nichtLesbar: string[] = [];
      for (const p of plan.neu) {
        const { datei, handle } = gewaehlt[p.index];
        setFortschritt(`${fertig + nichtLesbar.length + 1} von ${plan.neu.length} …`);
        const { titel, stimme } = ausDateiname(datei.name);
        try {
          await stueckAnlegen({ titel, stimme, datei, dateiname: datei.name, handle, ...(p.sammlungen.length ? { sammlungen: p.sammlungen } : {}), ...(tagZiel ? { tags: [tagZiel.id] } : {}) });
          fertig++;
        } catch (x) {
          if (!(x instanceof DateiNichtLesbar)) throw x;
          nichtLesbar.push(datei.name);
        }
      }
      const einsortiert = plan.bekannt.map((b) => {
        const n = liste.find((x) => x.id === b.notenId)!;
        return { id: b.notenId, sammlungen: b.sammlungen.reduce(mitSammlung, sammlungenVon(n)), vorher: sammlungenVon(n) };
      }).filter((a) => a.sammlungen.length !== a.vorher.length);
      if (einsortiert.length) await sammlungenSetzen(einsortiert);
      // Schon vorhandene auch markieren, wenn ein Tag gewählt ist.
      if (tagZiel && plan.bekannt.length) {
        await tagsSetzen(plan.bekannt.map((b) => ({ id: b.notenId, tags: mitTag(tagsVon(liste.find((x) => x.id === b.notenId)!), tagZiel.id) })));
      }
      const neueSammlungen = [...new Set(plan.neu.concat(plan.bekannt.map((b) => ({ index: -1, name: '', sammlungen: b.sammlungen }))).flatMap((p) => p.sammlungen))]
        .filter((x) => !ziel || !gleicheSammlung(x, ziel));
      const stueck = (z: number) => `${z} ${z === 1 ? 'Stück' : 'Stücke'}`;
      setMeldung([
        fertig ? `${stueck(fertig)} hinzugefügt (Titel und Stimme aus dem Dateinamen).` : 'Nichts Neues hinzugefügt.',
        plan.bekannt.length ? `${stueck(plan.bekannt.length)} lag${plan.bekannt.length === 1 ? '' : 'en'} schon in der Bibliothek — nicht doppelt angelegt${ziel || neueSammlungen.length ? ', nur einsortiert' : ''}.` : '',
        ziel ? `Alles in die Sammlung „${ziel}“ einsortiert.` : '',
        tagZiel ? `Alles mit „${tagZiel.name}“ markiert.` : '',
        neueSammlungen.length ? `Sammlungen aus den Ordnern: ${neueSammlungen.join(', ')}.` : '',
        plan.doppelt ? `${plan.doppelt} ${plan.doppelt === 1 ? 'Datei lag' : 'Dateien lagen'} mehrfach im Ordner — einmal übernommen.` : '',
        plan.ohnePdf ? `${plan.ohnePdf} ${plan.ohnePdf === 1 ? 'andere Datei' : 'andere Dateien'} (keine PDF) übersprungen.` : '',
        art === 'ordner' && !plan.neu.length && !plan.bekannt.length ? 'Im gewählten Ordner lagen keine PDF-Dateien.' : '',
      ].filter(Boolean).join(' '));
      if (nichtLesbar.length) setWarnung(`Nicht lesbar und deshalb nicht übernommen: ${nichtLesbar.join(', ')}. Liegen sie nur in iCloud? In der Dateien-App einmal öffnen (lädt sie aufs Gerät), dann noch einmal wählen — Vorhandenes wird dabei nicht doppelt angelegt.`);
      if (ziel && sammlungNeu && gleicheSammlung(ziel, sammlungNeu)) setSammlungNeu(null);
    } catch (x) {
      setWarnung(`${fertig} ${fertig === 1 ? 'Datei' : 'Dateien'} hinzugefügt, dann ging es nicht weiter: ${fehlerGrund(x)}`);
    } finally {
      setLaeuft(false); setFortschritt('');
      laden();
    }
  }

  // Einscannen oder Fotos wählen: erst die Bilder, dann der Dialog (F-07).
  // Ohne Bild (abgebrochen) öffnet der Dialog trotzdem — mit „Aufnehmen“ —
  // nur, wenn die Kamera am Rechner live läuft; sonst passiert nichts.
  async function scannen(art: ScanArt) {
    const bilder = await bilderWaehlen(art);
    if (!bilder.length) return;
    setMeldung(''); setWarnung('');
    setScan({ art, start: bilder });
  }

  // Alle Stücke einer Sammlung umsortieren (Umbenennen, Auflösen).
  async function sammlungAendern(name: string, neu: (liste: string[]) => string[]) {
    const betroffen = (noten ?? []).filter((n) => imFilter(n, name)).map((n) => ({ id: n.id, sammlungen: neu(sammlungenVon(n)) }));
    try { await sammlungenSetzen(betroffen); } catch (x) { setWarnung(`Die Sammlung ließ sich nicht ändern: ${fehlerGrund(x)}`); }
    laden();
  }

  // Dieselben Dateien neu einlesen; markierte Stellen und Anmerkungen bleiben.
  // Virtuelle Stücke haben keine eigene Datei — sie zeigen die ihrer Quelle.
  async function aktualisieren(alle: Stueck[]) {
    const ziel = alle.filter((n) => !n.quelle);
    if (!ziel.length) return;
    setMeldung(''); setWarnung(''); setLaeuft(true);
    let fertig = 0;
    const geaendert: string[] = [];
    try {
      const offenOhne: Stueck[] = [];
      if (kannVerweise()) {
        for (const n of ziel) {
          const datei = await ausVerweis(n);
          if (datei) { await stueckAendern(n.id, { datei, aktualisiert: Date.now() }); fertig++; geaendert.push(n.id); } else offenOhne.push(n);
        }
      } else offenOhne.push(...ziel);

      let fehlen: Stueck[] = [];
      let uebrig = 0;
      if (offenOhne.length) {
        // Ohne Dateiverweis (iPad/iPhone): einmal die Dateien wählen, Zuordnung über den Namen.
        const gewaehlt = await dateienWaehlen();
        if (!gewaehlt.length && !fertig) return; // abgebrochen: keine Meldung
        const r = zuordnen(offenOhne, gewaehlt.map((g) => g.datei.name));
        for (const p of r.paare) {
          const g = gewaehlt[p.datei];
          await stueckAendern(p.notenId, { datei: g.datei, dateiname: g.datei.name, aktualisiert: Date.now(), ...(g.handle ? { handle: g.handle } : {}) });
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
  // Alles in einem Schritt: die Stücke samt allem, was an ihnen hängt —
  // auch virtuelle Stücke aus ihnen und ihre Einträge in Setlisten (Regeln in
  // @/domain/bestand). Die Rückfrage nennt vorher, was mit wegfällt.
  async function loeschen() {
    const ids = [...auswahl];
    setMeldung(''); setWarnung('');
    try {
      const hinweis = loeschHinweis(await loeschVorschau(ids));
      if (!confirm(`${ids.length} Noten mit allen Stellen und Anmerkungen von diesem Gerät löschen?${hinweis ? ` ${hinweis}` : ''}`)) return;
      setLaeuft(true);
      const { stuecke } = await stueckeLoeschen(ids);
      setAuswahl(new Set());
      setAuswaehlen(false);
      if (offen && stuecke.includes(offen)) offenEntfernt();
    } catch (x) {
      setWarnung(`Nichts gelöscht, die Auswahl ist noch da: ${fehlerGrund(x)}`);
    } finally {
      setLaeuft(false);
      laden();
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

      {erinnerung?.faellig && erinnern && (
        <div className="sicherung-erinnerung">
          <button type="button" className="sicherung-erinnerung-text" onClick={einstellungen}>
            <span>{erinnerung.tage === null ? 'Noch keine Sicherung gemacht' : `Letzte Sicherung vor ${erinnerung.tage} Tagen`} — seitdem hat sich etwas geändert.</span>
            <strong>Sichern ›</strong>
          </button>
          <button type="button" className="text-knopf gedaempft text-xs underline" onClick={erinnerungAus} title="Nicht mehr erinnern (in den Einstellungen wieder einschaltbar)">ausblenden</button>
        </div>
      )}

      {!!noten?.length && <SammlungenLeiste uebersicht={uebersicht} aktiv={aktiv} waehlen={sammlungWaehlen} />}
      {aktiv && (
        <SammlungKopf name={aktiv} anzahl={gefiltert.length}
          umbenennen={(neu) => { void sammlungAendern(aktiv, (l) => sammlungUmbenennen(l, aktiv, neu)).then(() => sammlungWaehlen(neu)); }}
          aufloesen={() => {
            if (!confirm(`Sammlung „${aktiv}“ auflösen? Die ${gefiltert.length} Stücke bleiben in der Bibliothek, nur die Sammlung verschwindet.`)) return;
            void sammlungAendern(aktiv, (l) => ohneSammlung(l, aktiv)).then(() => sammlungWaehlen(null));
          }} />
      )}

      {!!noten?.length && tags.length > 0 && <TagFilter uebersicht={tagUeber} aktiv={aktivTag} waehlen={tagWaehlen} />}

      {!!noten?.length && (
        <MixZeile sammlung={aktiv} tag={zielTag} noten={noten} stellen={stellen} starten={mixStarten} aktiv={mixAktiv} />
      )}

      {/* Leere Liste: Hinzufügen und Laden stehen in der Hinweis-Karte, Sortieren gibt es noch nichts. */}
      {!!noten?.length && (auswaehlen ? (
        <div className="space-y-2" role="toolbar" aria-label="Auswahl">
          <div className="bib-werkzeuge">
            <label className="alle-waehlen flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="auswahl-box" checked={alleGewaehlt}
                onChange={() => setAuswahl(alleGewaehlt ? new Set() : new Set(gefiltert.map((n) => n.id)))} aria-label="Alle auswählen" />
              Alle
            </label>
            <span className="flex-1" />
            <button type="button" className="text-knopf bib-fertig" disabled={!auswahl.size || laeuft} onClick={() => void aktualisieren(gewaehlteNoten)}
              title="Die PDF-Dateien neu einlesen; Stellen und Anmerkungen bleiben">Aktualisieren</button>
            <button type="button" className="text-knopf bib-loeschen" disabled={!auswahl.size || laeuft} onClick={() => void loeschen()}>Löschen</button>
            <button type="button" className="text-knopf bib-fertig" onClick={auswahlEnde}>Fertig</button>
          </div>
          <div className="bib-werkzeuge">
            <button type="button" className="knopf knopf-leise knopf-klein" disabled={!auswahl.size || laeuft} onClick={() => setSammlungBlatt([...auswahl])}>In Sammlung …</button>
            <button type="button" className="knopf knopf-leise knopf-klein" disabled={!auswahl.size || laeuft} onClick={() => setTagBlatt([...auswahl])}>Tags …</button>
          </div>
        </div>
      ) : (
        <div className="bib-werkzeuge">
          <HinzufuegenMenue ziel={aktiv} einsortieren={einsortieren} setEinsortieren={setEinsortieren} gesperrt={laeuft}
            tagZiel={zielTag} markieren={markieren} setMarkieren={setMarkieren}
            dateien={() => void hinzufuegen('dateien')} ordner={() => void hinzufuegen('ordner')}
            scannen={() => void scannen('kamera')} fotos={() => void scannen('fotos')} />
          <span className="flex-1" />
          <div className="segment !mx-0" role="group" aria-label="Sortieren">
            <button type="button" aria-pressed={sortierung === 'zuletzt'} onClick={() => { setSortierung('zuletzt'); speichern('ueben:sort', 'zuletzt'); }}>Zuletzt</button>
            <button type="button" aria-pressed={sortierung === 'abc'} onClick={() => { setSortierung('abc'); speichern('ueben:sort', 'abc'); }}>A–Z</button>
          </div>
          <button type="button" className="text-knopf bib-auswaehlen" onClick={() => setAuswaehlen(true)}>Auswählen</button>
        </div>
      ))}
      {laeuft && <p className="gedaempft text-sm">Einen Moment … {fortschritt}</p>}

      {leer && (
        <div className="karte space-y-3">
          {vorgaenger && (
            <div className="space-y-2">
              <p>
                <strong>Deine Noten aus der Vorgängerversion</strong> liegen noch auf diesem Gerät, in einem älteren
                Speicher. „Übernehmen“ holt sie samt Stellen und Anmerkungen hierher; der alte Speicher bleibt dabei
                unangetastet.
              </p>
              <button type="button" className="knopf" onClick={sicherung.uebernehmen} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>
                {sicherung.uebernimmt ? 'Wird übernommen …' : 'Übernehmen'}
              </button>
            </div>
          )}
          <p>Noch keine Noten auf diesem Gerät. PDF-Dateien wählen — oder gleich einen ganzen Ordner: Seine Unterordner werden Sammlungen (z. B. „Märsche“, „Orchester A“).</p>
          <p>
            <strong>Noten von einem anderen Gerät?</strong> Dort in den Einstellungen (Zahnrad) „Sicherung erstellen“
            und die Datei speichern oder teilen, dann hier „Sicherung laden“. Das geht auch mit einer Sicherung aus der
            Registerführer-App. Safari-Tab und Home-Bildschirm-App haben getrennte Speicher.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`knopf ${vorgaenger ? 'knopf-leise' : ''}`} onClick={sicherung.waehlen} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>
              {sicherung.laeuft ? 'Sicherung wird geladen …' : 'Sicherung laden'}
            </button>
            <button type="button" className="knopf knopf-leise" onClick={() => void hinzufuegen('dateien')} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>+ Noten hinzufügen</button>
            <button type="button" className="knopf knopf-leise" onClick={() => void hinzufuegen('ordner')} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>Ordner wählen</button>
            <button type="button" className="knopf knopf-leise" onClick={() => void scannen('kamera')} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>Einscannen</button>
            <button type="button" className="knopf knopf-leise" onClick={() => void scannen('fotos')} disabled={sicherung.laeuft || sicherung.uebernimmt || laeuft}>Fotos wählen</button>
          </div>
        </div>
      )}

      {!!noten?.length && aktiv && !aktivTag && !gefiltert.length && (
        <p className="karte text-sm">
          Noch keine Stücke in „{aktiv}“. Über „+ Noten“ hinzufügen — sie kommen dann direkt hierher —, oder unter „Alle“
          Stücke auswählen und „In Sammlung …“ wählen.
        </p>
      )}
      {!!noten?.length && aktivTag && !gefiltert.length && (
        <p className="karte text-sm">
          Kein Stück{aktiv ? ` in „${aktiv}“` : ''} trägt „{zielTag?.name}“. Stücke auswählen und „Tags …“ wählen — oder den Tag-Filter
          noch einmal antippen, um ihn aufzuheben.
        </p>
      )}

      {scan && (
        <ScanDialog art={scan.art} start={scan.start}
          sammlungen={aktiv && einsortieren ? [aktiv] : []} tags={zielTag && markieren ? [zielTag.id] : []}
          fertig={(m) => { setScan(null); setMeldung(m); if (aktiv && einsortieren && sammlungNeu && gleicheSammlung(aktiv, sammlungNeu)) setSammlungNeu(null); laden(); }}
          schliessen={() => setScan(null)} />
      )}

      {tagBlatt && noten && (
        <TagWahl noten={noten.filter((n) => tagBlatt.includes(n.id))} tags={tags}
          schliessen={() => { setTagBlatt(null); setTags(tagsLaden()); }}
          speichern={(aenderungen) => {
            setTagBlatt(null);
            tagsSetzen(aenderungen).then(() => { setMeldung(aenderungen.length ? `${aenderungen.length} ${aenderungen.length === 1 ? 'Stück' : 'Stücke'} markiert.` : ''); auswahlEnde(); },
              (x) => setWarnung(`Markieren ging nicht: ${fehlerGrund(x)}`)).finally(laden);
          }} />
      )}

      {sammlungBlatt && noten && (
        <SammlungWahl noten={noten.filter((n) => sammlungBlatt.includes(n.id))}
          uebersicht={sammlungNeu && !uebersicht.some((x) => gleicheSammlung(x.name, sammlungNeu)) ? [...uebersicht, { name: sammlungNeu, anzahl: 0 }] : uebersicht}
          schliessen={() => setSammlungBlatt(null)}
          speichern={(aenderungen) => {
            setSammlungBlatt(null);
            sammlungenSetzen(aenderungen).then(() => { setMeldung(aenderungen.length ? `${aenderungen.length} ${aenderungen.length === 1 ? 'Stück' : 'Stücke'} einsortiert.` : ''); auswahlEnde(); },
              (x) => setWarnung(`Einsortieren ging nicht: ${fehlerGrund(x)}`)).finally(laden);
          }} />
      )}

      {!!gefiltert.length && (
        <ul className="bib-liste">
          {gefiltert.map((n) => {
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
                    {[n.stimme, n.quelle ? quellenText(n.quelle, titelVon(n.quelle.stueckId)) : '', z ? `zuletzt ${zeitpunkt(z)}` : 'noch nicht geöffnet',
                      anzahlStellen ? `${anzahlStellen} ${anzahlStellen === 1 ? 'Stelle' : 'Stellen'}` : '',
                      !aktiv ? sammlungenVon(n).join(', ') : '',
                      n.aktualisiert ? `aktualisiert ${datum(n.aktualisiert)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                  {tagsVon(n, tags).length > 0 && (
                    <span className="bib-tags">{tagsVon(n, tags).map((id) => <TagEtikett key={id} tag={tags.find((t) => t.id === id)!} />)}</span>
                  )}
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
