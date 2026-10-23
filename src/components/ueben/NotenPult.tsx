'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { dateiVon, istVirtuell, type Lesezeichen } from '@/domain/bestand';
import { istNachladeFehler } from '@/domain/nachladen';
import type { Anmerkung } from '@/domain/notenpult';
import { sammlungenVon } from '@/domain/sammlungen';
import { bereichLesen, inSicht, neueLesezeichen, quellenText, stueckeAusLesezeichen, zurPdf } from '@/domain/sicht';
import { tagsVon, type Tag } from '@/domain/tags';
import { stelleFavorit, tempoStand } from '@/domain/stellen';
import { mitRand } from '@/domain/ueben';
import { NeueVersion } from '@/components/NeueVersion';
import {
  alleStuecke, anmerkungenVon, lesezeichenAendern, lesezeichenAnlegen, lesezeichenLoeschen, lesezeichenVon, stueckDatei, stueckHolen,
  stelleAendern, zuletztMerken, stellenVon, tagsLaden, tempoGeschafft, virtuellesAnlegen,
  type Stueck, type Stelle,
} from './lokal';
import { LesezeichenKontext, MehrKnopf, StueckKontext, useHalten } from './Kontext';
import { TagEtikett } from './Tags';
import { useMetronom } from './MetronomKontext';
import { NotenBetrachter, type Ziel } from './NotenBetrachter';
import { gliederungLesen, NeueVersionFehler, pdfLaden, seiteMitEbene, seitenFenster, type Dokument } from './pdf';
import { fehlerGrund, ladeFehler, speicherFehler } from './speicherfehler';
import type { MixSteuerung } from './StellenMix';
import { StelleBlatt } from './StelleBlatt';
import { SternKnopf } from './Stern';
import { TempoKurve } from './TempoKurve';
import { useDialogFokus, useEscape } from './tasten';
import { anmerkungenZeichnen, ebeneZeichnen } from './zeichnen';

const RAND = 0.06;

// Ein geöffnetes Stück (B-02): Die Noten füllen die Bühne sofort. Tipp auf
// den Titel öffnet das Stück-Blatt mit Umbenennen und der Stellen-Übersicht.
// Im Stellen-Mix (mix) zeigt es eine Stelle der Runde.
// Ein virtuelles Stück (F-03) zeigt die Seiten von–bis der PDF seiner Quelle:
// Betrachter und Blatt sehen ein Fenster darauf (seitenFenster), Stellen und
// Anmerkungen der Quelle in Sicht-Seiten (inSicht), gespeichert wird bei der
// Quelle (ablage).
export function NotenPult({ notenId, tastenAktiv, verschwunden, mix = null, leisten, blattAnfang = false }: {
  notenId: string; tastenAktiv: boolean; verschwunden: () => void; mix?: MixSteuerung | null;
  // Gleich mit offenem Stück-Blatt starten (aus dem Kontext-Blatt der Bibliothek).
  blattAnfang?: boolean | 'teilen';
  leisten: { leisteWeg: boolean; setLeisteWeg: (weg: boolean) => void; navDa: boolean };
}) {
  const { bpm, setBpm } = useMetronom();
  const [noten, setNoten] = useState<Stueck | null>(null);
  // Die Quelle eines virtuellen Stücks (für „Seiten 3–5 aus …“), sonst null.
  const [quelle, setQuelle] = useState<Stueck | null>(null);
  const [pdf, setPdf] = useState<Dokument | null>(null);
  const [fehler, setFehler] = useState('');
  const [neueVersion, setNeueVersion] = useState(false);
  const [stellen, setStellen] = useState<Stelle[]>([]);
  const [lesezeichen, setLesezeichen] = useState<Lesezeichen[]>([]);
  const [blatt, setBlatt] = useState(!!blattAnfang);
  const [sprung, setSprung] = useState<Ziel | null>(null);
  const mixAbgleichen = mix?.abgleichen;
  const neuLaden = useCallback(() => {
    if (!noten) return;
    stellenVon(dateiVon(noten)).then((l) => setStellen(inSicht(noten, l))).catch(ladeFehler);
    // Neue oder gelöschte Stellen gehören in die laufende Runde.
    mixAbgleichen?.();
  }, [noten, mixAbgleichen]);
  const lesezeichenLaden = useCallback(() => {
    if (!noten) return;
    lesezeichenVon(noten.id).then((l) => setLesezeichen(inSicht(noten, l))).catch(ladeFehler);
  }, [noten]);

  useEffect(() => {
    let weg = false;
    let dokument: Promise<PDFDocumentProxy> | null = null;
    (async () => {
      const n = await stueckHolen(notenId);
      if (!n) { verschwunden(); return; }
      zuletztMerken(notenId);
      dokument = stueckDatei(n).then(pdfLaden);
      const [d, st, lz, q] = await Promise.all([dokument, stellenVon(dateiVon(n)), lesezeichenVon(n.id), n.quelle ? stueckHolen(n.quelle.stueckId) : undefined]);
      if (weg) return;
      const fenster = seitenFenster(d, n.quelle);
      if (fenster.numPages < 1) throw new Error(n.quelle ? `Die PDF von „${q?.titel ?? 'der Quelle'}“ hat die Seiten ${n.quelle.von}–${n.quelle.bis} nicht mehr.` : 'Die PDF hat keine Seiten.');
      setNoten(n); setQuelle(q ?? null); setPdf(fenster); setStellen(inSicht(n, st)); setLesezeichen(inSicht(n, lz));
    })().catch((e) => {
      if (weg) return;
      if (e instanceof NeueVersionFehler || istNachladeFehler(e)) setNeueVersion(true);
      else setFehler(`Noten lassen sich nicht öffnen: ${(e as Error).message}`);
    });
    // Stück verlassen (anderes Stück, neu aufbauen): PDF samt pdf.js-Worker
    // freigeben — sonst bleibt jedes je geöffnete Stück im Speicher, bis
    // iOS die App wegen Speichermangels hakeln lässt.
    return () => { weg = true; dokument?.then((d) => d.loadingTask.destroy(), () => { /* nie geladen */ }); };
    // verschwunden ändert sich nicht fachlich — nur die Noten-ID zählt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notenId]);

  if (neueVersion) return <div className="leer"><NeueVersion /></div>;
  if (fehler) return (
    <div className="leer">
      <p className="karte warnung">{fehler}</p>
      {mix && (
        <div className="flex gap-2">
          <button type="button" className="knopf knopf-klein" onClick={mix.weiter}>Nächste Stelle</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={mix.beenden}>Mix beenden</button>
        </div>
      )}
    </div>
  );
  if (!noten || !pdf) return <div className="leer"><p className="gedaempft">Noten werden geladen …</p></div>;

  return (
    <>
      <NotenBetrachter noten={noten} pdf={pdf} stellen={stellen} lesezeichen={lesezeichen} lesezeichenGeaendert={lesezeichenLaden}
        geaendert={neuLaden} mix={mix} {...leisten}
        tastenAktiv={tastenAktiv && !blatt} sprung={sprung} titelTipp={() => setBlatt(true)} />
      {blatt && (
        <StueckBlatt noten={noten} quelle={quelle} pdf={pdf} stellen={stellen} lesezeichen={lesezeichen} lesezeichenGeaendert={lesezeichenLaden}
          bpm={bpm} tempoSetzen={setBpm} neuLaden={neuLaden} geloescht={verschwunden} teilenAnfang={blattAnfang === 'teilen'}
          umbenannt={(neu) => setNoten({ ...noten, ...neu })}
          zeigen={(id) => { mix?.beenden(); setSprung({ stelle: id, n: Date.now() }); setBlatt(false); }}
          seiteZeigen={(seite) => { mix?.beenden(); setSprung({ seite, n: Date.now() }); setBlatt(false); }}
          schliessen={() => setBlatt(false)} />
      )}
    </>
  );
}

// ── Stück-Blatt: Umbenennen und Stellen-Übersicht ───────────────────────

function StueckBlatt({ noten, quelle, pdf, stellen, lesezeichen, lesezeichenGeaendert, bpm, tempoSetzen, neuLaden, umbenannt, geloescht, zeigen, seiteZeigen, schliessen, teilenAnfang = false }: {
  noten: Stueck; quelle: Stueck | null; pdf: Dokument; stellen: Stelle[]; lesezeichen: Lesezeichen[]; lesezeichenGeaendert: () => void;
  bpm: number; tempoSetzen: (n: number) => void;
  neuLaden: () => void; umbenannt: (neu: Partial<Stueck>) => void; geloescht: () => void;
  zeigen: (id: string) => void; seiteZeigen: (seite: number) => void; schliessen: () => void; teilenAnfang?: boolean;
}) {
  // Aktionen am Stück (umbenennen, Sammlungen, Tags, löschen) im Kontext-Blatt (F-08).
  const [kontext, setKontext] = useState(false);
  const [stuecke, setStuecke] = useState<Stueck[] | null>(null);
  const kontextOeffnen = () => { alleStuecke().then((l) => { setStuecke(l); setKontext(true); }, speicherFehler); };
  // „Eigene Stücke daraus“: der Abschnitt erscheint auf Wunsch.
  const [teilen, setTeilen] = useState(teilenAnfang);
  const [tags] = useState<Tag[]>(() => tagsLaden());
  useEscape(schliessen, !kontext);
  const fokus = useDialogFokus<HTMLDivElement>();

  return (
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label={`Stück: ${noten.titel}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-xl font-extrabold">{noten.titel}</h2>
          {noten.stimme && <span className="gedaempft">{noten.stimme}</span>}
          <span className="flex-1" />
          <MehrKnopf tun={kontextOeffnen} aria={`Mehr zu „${noten.titel}“`} />
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm gedaempft">
          {noten.quelle && <span>{quellenText(noten.quelle, quelle?.titel)} · teilt Stellen und Anmerkungen mit der Quelle</span>}
          {sammlungenVon(noten).length > 0 && <span>{sammlungenVon(noten).join(', ')}</span>}
          {tagsVon(noten, tags).map((id) => <TagEtikett key={id} tag={tags.find((t) => t.id === id)!} />)}
          {!noten.quelle && !sammlungenVon(noten).length && !tagsVon(noten, tags).length && <span>In keiner Sammlung, keine Tags — über ⋯ ändern.</span>}
        </p>
        {kontext && stuecke && (
          <StueckKontext stueck={noten} stuecke={stuecke} anzahlStellen={stellen.length} schliessen={() => setKontext(false)}
            teilen={() => { setKontext(false); setTeilen(true); }}
            geaendert={(neu) => umbenannt(neu)}
            geloescht={() => { setKontext(false); geloescht(); }} />
        )}
        <h3 className="abschnitt-titel">Lesezeichen</h3>
        <LesezeichenListe noten={noten} pdf={pdf} lesezeichen={lesezeichen} geaendert={lesezeichenGeaendert} seiteZeigen={seiteZeigen} />
        {teilen && !istVirtuell(noten) && (
          <>
            <h3 className="abschnitt-titel">Eigene Stücke aus diesem</h3>
            <TeilStuecke noten={noten} pdf={pdf} lesezeichen={lesezeichen} />
          </>
        )}
        <h3 className="abschnitt-titel">Stellen</h3>
        <UebeAnsicht pdf={pdf} noten={noten} stellen={stellen} bpm={bpm} neuLaden={neuLaden} tempoSetzen={tempoSetzen} zeigen={zeigen} />
      </div>
    </div>
  );
}

// ── Lesezeichen (F-03): Seiten benennen und anspringen ──────────────────

function LesezeichenListe({ noten, pdf, lesezeichen, geaendert, seiteZeigen }: {
  noten: Stueck; pdf: Dokument; lesezeichen: Lesezeichen[]; geaendert: () => void; seiteZeigen: (seite: number) => void;
}) {
  // Kontext-Blatt (F-08) für ein Lesezeichen: zur Seite, bearbeiten, als Stück, entfernen.
  const [kontext, setKontext] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  // „Ab hier als eigenes Stück“: bis vor das nächste Lesezeichen (Regel in sicht.ts).
  async function alsStueck(l: Lesezeichen) {
    const vorhandene = (await alleStuecke()).filter((s) => s.quelle?.stueckId === noten.id).map((s) => s.quelle!);
    const t = stueckeAusLesezeichen(lesezeichen, pdf.numPages, vorhandene).find((x) => x.von === l.seite);
    if (!t) { setMeldung('Diesen Bereich gibt es schon als Stück.'); return; }
    try {
      await virtuellesAnlegen({
        titel: t.titel, stimme: noten.stimme, quelle: { stueckId: noten.id, von: t.von, bis: t.bis },
        ...(noten.sammlungen?.length ? { sammlungen: noten.sammlungen } : {}), ...(noten.tags?.length ? { tags: noten.tags } : {}),
      });
      setMeldung(`„${t.titel}“ (Seiten ${t.von}–${t.bis}) steht jetzt als Stück in der Bibliothek.`);
    } catch (x) { setMeldung(`Das ging nicht: ${fehlerGrund(x)}`); }
  }
  // Aus dem Inhaltsverzeichnis der PDF (nur, was noch fehlt).
  async function ausGliederung() {
    setLaeuft(true); setMeldung('');
    try {
      const alle = inSicht(noten, await gliederungLesen(pdf as PDFDocumentProxy));
      const neu = neueLesezeichen(alle, lesezeichen, pdf.numPages);
      for (const g of neu) await lesezeichenAnlegen({ stueckId: noten.id, seite: zurPdf(noten, g.seite), titel: g.titel });
      setMeldung(!alle.length ? 'Die PDF hat kein Inhaltsverzeichnis.' : !neu.length ? 'Alle Punkte des Inhaltsverzeichnisses sind schon Lesezeichen.'
        : `${neu.length} ${neu.length === 1 ? 'Lesezeichen' : 'Lesezeichen'} aus dem Inhaltsverzeichnis übernommen.`);
      geaendert();
    } catch (x) { setMeldung(`Das ging nicht: ${fehlerGrund(x)}`); } finally { setLaeuft(false); }
  }
  return (
    <div className="space-y-2">
      {lesezeichen.length === 0 && <p className="karte text-sm">Noch keine Lesezeichen. In den Noten im Ansicht-Menü (⋯) „Lesezeichen auf Seite …“ wählen — oder unten aus dem Inhaltsverzeichnis der PDF übernehmen.</p>}
      {lesezeichen.length > 0 && (
        <ul className="lz-liste">
          {lesezeichen.map((l) => <LesezeichenZeile key={l.id} l={l} zeigen={() => seiteZeigen(l.seite)} mehr={() => setKontext(l.id)} />)}
        </ul>
      )}
      {kontext && (() => {
        const l = lesezeichen.find((x) => x.id === kontext);
        if (!l) return null;
        return (
          <LesezeichenKontext lesezeichen={l} seiten={pdf.numPages} schliessen={() => setKontext(null)}
            zurSeite={() => seiteZeigen(l.seite)}
            speichern={async (titel, seite) => { await lesezeichenAendern(l.id, { titel, seite: zurPdf(noten, seite) }); geaendert(); }}
            alsStueck={istVirtuell(noten) ? null : () => void alsStueck(l)}
            entfernen={async () => { await lesezeichenLoeschen(l.id); geaendert(); }} />
        );
      })()}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="knopf knopf-leise knopf-klein" disabled={laeuft} onClick={() => void ausGliederung()}>Aus dem Inhaltsverzeichnis der PDF</button>
        {meldung && <span className="text-sm" role="status">{meldung}</span>}
      </div>
    </div>
  );
}

function LesezeichenZeile({ l, zeigen, mehr }: { l: Lesezeichen; zeigen: () => void; mehr: () => void }) {
  const halten = useHalten(mehr);
  return (
    <li className="lz-zeile haltbar">
      <button type="button" className="lz-ziel" onClick={zeigen} title="In den Noten zeigen" {...halten}>
        <span className="lz-titel">{l.titel}</span>
        <span className="gedaempft tabular-nums text-sm">Seite {l.seite}</span>
      </button>
      <MehrKnopf tun={mehr} aria={`Mehr zu „${l.titel}“`} />
    </li>
  );
}

// ── Virtuelle Stücke (F-03): Seitenbereiche als eigene Stücke ───────────

function TeilStuecke({ noten, pdf, lesezeichen }: { noten: Stueck; pdf: Dokument; lesezeichen: Lesezeichen[] }) {
  const [offen, setOffen] = useState(false);
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [titel, setTitel] = useState('');
  const [meldung, setMeldung] = useState('');
  const [vorhandene, setVorhandene] = useState<Stueck[] | null>(null);
  const seiten = pdf.numPages;
  useEffect(() => {
    let weg = false;
    alleStuecke().then((l) => { if (!weg) setVorhandene(l.filter((s) => s.quelle?.stueckId === noten.id).sort((x, y) => x.quelle!.von - y.quelle!.von)); }, ladeFehler);
    return () => { weg = true; };
  }, [noten.id, meldung]);
  const ausLesezeichen = stueckeAusLesezeichen(lesezeichen, seiten, (vorhandene ?? []).map((s) => s.quelle!));
  async function anlegen(liste: { titel: string; von: number; bis: number }[]) {
    let n = 0;
    try {
      for (const t of liste) {
        await virtuellesAnlegen({
          titel: t.titel, stimme: noten.stimme, quelle: { stueckId: noten.id, von: t.von, bis: t.bis },
          ...(noten.sammlungen?.length ? { sammlungen: noten.sammlungen } : {}), ...(noten.tags?.length ? { tags: noten.tags } : {}),
        });
        n++;
      }
      setMeldung(`${n} ${n === 1 ? 'Stück' : 'Stücke'} angelegt — ${n === 1 ? 'es steht' : 'sie stehen'} jetzt in der Bibliothek${noten.sammlungen?.length ? ` (${noten.sammlungen.join(', ')})` : ''}.`);
      setOffen(false); setVon(''); setBis(''); setTitel('');
    } catch (x) { setMeldung(`${n ? `${n} angelegt, dann ging es nicht weiter` : 'Das ging nicht'}: ${fehlerGrund(x)}`); }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm gedaempft">Ein Seitenbereich wird ein eigenes Stück in der Bibliothek — mit eigenem Namen, in Sammlungen und Setlisten. Stellen und Anmerkungen teilt es mit diesem Stück.</p>
      {vorhandene && vorhandene.length > 0 && (
        <p className="text-sm"><span className="gedaempft">Schon angelegt: </span>{vorhandene.map((s) => `${s.titel} (${quellenText(s.quelle!, undefined)})`).join(', ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setOffen(!offen)} disabled={seiten < 2}>Seiten von–bis als Stück …</button>
        {ausLesezeichen.length > 0 && (
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => {
            if (!confirm(`${ausLesezeichen.length} ${ausLesezeichen.length === 1 ? 'Stück' : 'Stücke'} anlegen? ${ausLesezeichen.map((t) => `${t.titel} (S. ${t.von}–${t.bis})`).join(', ')}`)) return;
            void anlegen(ausLesezeichen);
          }}>Je Lesezeichen ein Stück ({ausLesezeichen.length})</button>
        )}
      </div>
      {seiten < 2 && <p className="text-sm gedaempft">Eine Seite lässt sich nicht teilen.</p>}
      {offen && (
        <form className="karte grid gap-2" onSubmit={(e) => {
          e.preventDefault();
          const b = bereichLesen(von, bis, seiten);
          if (typeof b === 'string') { setMeldung(b); return; }
          void anlegen([{ titel: titel.trim() || `${noten.titel} S. ${b.von}${b.bis !== b.von ? `–${b.bis}` : ''}`, ...b }]);
        }}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Seiten</span>
            <input className="feld feld-zahl" inputMode="numeric" value={von} onChange={(e) => setVon(e.target.value)} placeholder="von" aria-label="Erste Seite" />
            <span>bis</span>
            <input className="feld feld-zahl" inputMode="numeric" value={bis} onChange={(e) => setBis(e.target.value)} placeholder="bis" aria-label="Letzte Seite" />
            <span className="gedaempft">von {seiten}</span>
          </div>
          <input className="feld" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={`Titel, z. B. „Marsch“ (sonst „${noten.titel} S. …“)`} aria-label="Titel" />
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit">Anlegen</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </form>
      )}
      {meldung && <p className="text-sm" role="status">{meldung}</p>}
    </div>
  );
}

// ── Nur die markierten Stellen üben ─────────────────────────────────────

function UebeAnsicht({ pdf, noten, stellen, bpm, tempoSetzen, neuLaden, zeigen }: {
  pdf: Dokument; noten: Stueck; stellen: Stelle[]; bpm: number; tempoSetzen: (n: number) => void; neuLaden: () => void; zeigen: (id: string) => void;
}) {
  const [rand, setRand] = useState(true);
  const huelle = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  const seiten = useRef(new Map<number, Promise<HTMLCanvasElement>>());

  const leer = stellen.length === 0;
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [leer]);

  // Was der Betrachter zeigt, zeigen auch die Ausschnitte: Markierungen aus
  // dem PDF (an den Radier-Spuren ausgestanzt) und eigene Anmerkungen.
  const [anm, setAnm] = useState<Record<number, Anmerkung[]> | null>(null);
  useEffect(() => {
    let weg = false;
    anmerkungenVon(dateiVon(noten)).then(
      (l) => { if (!weg) setAnm(Object.fromEntries(inSicht(noten, l).map((x) => [x.seite, x.objekte]))); },
      (x) => { ladeFehler(x); if (!weg) setAnm({}); },
    );
    return () => { weg = true; };
  }, [noten]);

  // Jede Seite einmal groß rendern, Ausschnitte daraus schneiden.
  const seiteHolen = useCallback((nr: number) => {
    let p = seiten.current.get(nr);
    if (!p) {
      const objekte = anm?.[nr] ?? [];
      p = seiteMitEbene(pdf, nr, 1400).then(({ seite, ebene }) => {
        const ctx = seite.getContext('2d')!;
        if (ebene) {
          ebeneZeichnen(ctx, ebene, { x: 0, y: 0, b: seite.width, h: seite.height }, objekte, { x: 0, y: 0, b: seite.width, h: seite.height }, document.createElement('canvas'));
          ebene.width = 0; ebene.height = 0;
        }
        anmerkungenZeichnen(ctx, objekte, 0, 0, seite.width, seite.height);
        return seite;
      });
      seiten.current.set(nr, p);
    }
    return p;
  }, [pdf, anm]);

  if (stellen.length === 0) return <p className="karte">Noch keine Stellen markiert. In den Noten das Werkzeug „▢ Stelle“ wählen und einen Rahmen um die Takte ziehen.</p>;

  return (
    <div ref={huelle} className="space-y-4">
      <label className="schalter-zeile flex items-center gap-2 text-sm">
        <input type="checkbox" className="auswahl-box" checked={rand} onChange={(e) => setRand(e.target.checked)} /> etwas Rand davor und danach zeigen
      </label>
      {breite > 0 && anm && stellen.map((s) => (
        <UebeStelle key={s.id} stelle={s} stueck={noten.titel} breite={breite} rand={rand} seiteHolen={seiteHolen} bpm={bpm} tempoSetzen={tempoSetzen} neuLaden={neuLaden} zeigen={() => zeigen(s.id)} />
      ))}
    </div>
  );
}

function UebeStelle({ stelle, stueck, breite, rand, seiteHolen, bpm, tempoSetzen, neuLaden, zeigen }: {
  stelle: Stelle; stueck: string; breite: number; rand: boolean; seiteHolen: (n: number) => Promise<HTMLCanvasElement>;
  bpm: number; tempoSetzen: (n: number) => void; neuLaden: () => void; zeigen: () => void;
}) {
  const ziel = useRef<HTMLCanvasElement>(null);
  // ⋯ oder Halten: das Stellen-Blatt (Ziel, Verlauf, Name, Notiz, löschen — F-08).
  const [blatt, setBlatt] = useState(false);
  const halten = useHalten(() => setBlatt(true));
  const { zuletzt, bestes } = tempoStand(stelle.tempi);

  useEffect(() => {
    let weg = false;
    seiteHolen(stelle.seite).then((quelle) => {
      const c = ziel.current;
      if (weg || !c) return;
      const r = rand ? mitRand(stelle, RAND) : stelle;
      const sx = r.x * quelle.width, sy = r.y * quelle.height, sb = r.b * quelle.width, sh = r.h * quelle.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const anzeigeBreite = Math.min(breite, sb / dpr * 1.6);
      c.width = Math.round(anzeigeBreite * dpr);
      c.height = Math.round((sh / sb) * anzeigeBreite * dpr);
      c.style.width = `${anzeigeBreite}px`;
      c.getContext('2d')!.drawImage(quelle, sx, sy, sb, sh, 0, 0, c.width, c.height);
    });
    return () => { weg = true; };
  }, [stelle, rand, breite, seiteHolen]);

  return (
    <div className="karte haltbar space-y-3" {...halten}>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <p className="flex min-w-0 items-center gap-1 font-bold">
          <SternKnopf an={stelleFavorit(stelle)} className="-my-2 -ml-3"
            umschalten={() => { stelleAendern(stelle.id, { favorit: !stelleFavorit(stelle) }).then(neuLaden, speicherFehler); }} />
          <span className="min-w-0">{stelle.titel || `Stelle auf Seite ${stelle.seite}`}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1 gedaempft text-sm tabular-nums">
          <span>{zuletzt ? `zuletzt ${zuletzt}` : 'noch kein Tempo'}{bestes && bestes !== zuletzt ? ` · bestes ${bestes}` : ''}{stelle.zielTempo ? ` · Ziel ${stelle.zielTempo}` : ''}</span>
          <MehrKnopf tun={() => setBlatt(true)} aria={`Mehr zur Stelle „${stelle.titel || `Seite ${stelle.seite}`}“`} />
        </p>
      </div>
      <div className="overflow-hidden rounded bg-white"><canvas ref={ziel} className="mx-auto block" /></div>
      {stelle.notiz && <p className="text-sm">{stelle.notiz}</p>}
      {stelle.tempi.length > 0 && <TempoKurve tempi={stelle.tempi} ziel={stelle.zielTempo} kompakt />}
      <div className="flex flex-wrap gap-2">
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => tempoSetzen(zuletzt ?? stelle.zielTempo ?? 60)}>
          ♩ auf {zuletzt ?? stelle.zielTempo ?? 60}
        </button>
        <button className="knopf knopf-klein" type="button" onClick={() => { tempoGeschafft(stelle.id, bpm).then(neuLaden, speicherFehler); }}>
          ✓ Geschafft bei {bpm}
        </button>
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={zeigen}>In den Noten</button>
      </div>
      {blatt && (
        <StelleBlatt stelle={stelle} stueck={stueck} geaendert={neuLaden} schliessen={() => setBlatt(false)}
          geloescht={() => { setBlatt(false); neuLaden(); }}
          aktionen={[
            { name: 'In den Noten zeigen', tun: () => { setBlatt(false); zeigen(); } },
            { name: `♩ auf ${zuletzt ?? stelle.zielTempo ?? 60}`, tun: () => tempoSetzen(zuletzt ?? stelle.zielTempo ?? 60) },
            { name: `✓ Geschafft bei ${bpm}`, tun: () => { tempoGeschafft(stelle.id, bpm).then(neuLaden, speicherFehler); } },
          ]} />
      )}
    </div>
  );
}
