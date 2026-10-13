'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { istNachladeFehler } from '@/domain/nachladen';
import type { Anmerkung } from '@/domain/notenpult';
import { sammlungenUebersicht, sammlungenVon } from '@/domain/sammlungen';
import { tagsVon, type Tag } from '@/domain/tags';
import { tempoStand, zielAusText } from '@/domain/stellen';
import { mitRand } from '@/domain/ueben';
import { NeueVersion } from '@/components/NeueVersion';
import {
  alleStuecke, anmerkungenVon, stueckAendern, stueckDatei, stueckHolen, sammlungenSetzen, stelleAendern, zuletztMerken, stelleLoeschen, stellenVon,
  tagsLaden, tagsSetzen, tempoGeschafft, type Stueck, type Stelle,
} from './lokal';
import { SammlungWahl } from './Sammlungen';
import { TagEtikett, TagWahl } from './Tags';
import { useMetronom } from './MetronomKontext';
import { NotenBetrachter } from './NotenBetrachter';
import { NeueVersionFehler, pdfLaden, seiteMitEbene } from './pdf';
import { ladeFehler, speicherFehler } from './speicherfehler';
import type { MixSteuerung } from './StellenMix';
import { TempoKurve } from './TempoKurve';
import { useDialogFokus, useEscape } from './tasten';
import { anmerkungenZeichnen, ebeneZeichnen } from './zeichnen';

const RAND = 0.06;

// Ein geöffnetes Stück (B-02): Die Noten füllen die Bühne sofort. Tipp auf
// den Titel öffnet das Stück-Blatt mit Umbenennen und der Stellen-Übersicht.
// Im Stellen-Mix (mix) zeigt es eine Stelle der Runde.
export function NotenPult({ notenId, tastenAktiv, verschwunden, mix = null, leisten }: {
  notenId: string; tastenAktiv: boolean; verschwunden: () => void; mix?: MixSteuerung | null;
  leisten: { leisteWeg: boolean; setLeisteWeg: (weg: boolean) => void; navDa: boolean };
}) {
  const { bpm, setBpm } = useMetronom();
  const [noten, setNoten] = useState<Stueck | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fehler, setFehler] = useState('');
  const [neueVersion, setNeueVersion] = useState(false);
  const [stellen, setStellen] = useState<Stelle[]>([]);
  const [blatt, setBlatt] = useState(false);
  const [sprung, setSprung] = useState<{ stelle: string; n: number } | null>(null);
  const mixAbgleichen = mix?.abgleichen;
  const neuLaden = useCallback(() => {
    stellenVon(notenId).then(setStellen).catch(ladeFehler);
    // Neue oder gelöschte Stellen gehören in die laufende Runde.
    mixAbgleichen?.();
  }, [notenId, mixAbgleichen]);

  useEffect(() => {
    let weg = false;
    let dokument: Promise<PDFDocumentProxy> | null = null;
    (async () => {
      const n = await stueckHolen(notenId);
      if (!n) { verschwunden(); return; }
      zuletztMerken(notenId);
      dokument = stueckDatei(n).then(pdfLaden);
      const [d, st] = await Promise.all([dokument, stellenVon(notenId)]);
      if (weg) return;
      setNoten(n); setPdf(d); setStellen(st);
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
      <NotenBetrachter noten={noten} pdf={pdf} stellen={stellen} geaendert={neuLaden} mix={mix} {...leisten}
        tastenAktiv={tastenAktiv && !blatt} sprung={sprung} titelTipp={() => setBlatt(true)} />
      {blatt && (
        <StueckBlatt noten={noten} pdf={pdf} stellen={stellen} bpm={bpm} tempoSetzen={setBpm} neuLaden={neuLaden}
          umbenannt={(neu) => setNoten({ ...noten, ...neu })}
          zeigen={(id) => { mix?.beenden(); setSprung({ stelle: id, n: Date.now() }); setBlatt(false); }}
          schliessen={() => setBlatt(false)} />
      )}
    </>
  );
}

// ── Stück-Blatt: Umbenennen und Stellen-Übersicht ───────────────────────

function StueckBlatt({ noten, pdf, stellen, bpm, tempoSetzen, neuLaden, umbenannt, zeigen, schliessen }: {
  noten: Stueck; pdf: PDFDocumentProxy; stellen: Stelle[]; bpm: number; tempoSetzen: (n: number) => void;
  neuLaden: () => void; umbenannt: (neu: Partial<Stueck>) => void; zeigen: (id: string) => void; schliessen: () => void;
}) {
  const [umbenennen, setUmbenennen] = useState(false);
  // Sammlungen des Stücks ändern: alle vorhandenen zur Auswahl (F-13).
  const [wahl, setWahl] = useState<{ name: string; anzahl: number }[] | null>(null);
  // Tags des Stücks (F-14)
  const [tags, setTags] = useState<Tag[]>(() => tagsLaden());
  const [tagWahl, setTagWahl] = useState(false);
  useEscape(schliessen, !wahl && !tagWahl);
  const fokus = useDialogFokus<HTMLDivElement>();

  return (
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label={`Stück: ${noten.titel}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-xl font-extrabold">{noten.titel}</h2>
          {noten.stimme && <span className="gedaempft">{noten.stimme}</span>}
          <button type="button" className="text-knopf gedaempft text-sm underline" onClick={() => setUmbenennen(!umbenennen)}>umbenennen</button>
          <span className="flex-1" />
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>
        {umbenennen && (
          <form className="karte grid gap-2" onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const neu = { titel: String(f.get('titel') || noten.titel), stimme: String(f.get('stimme') ?? '') };
            try { await stueckAendern(noten.id, neu); } catch (x) { speicherFehler(x); return; }
            umbenannt(neu); setUmbenennen(false);
          }}>
            <input className="feld" name="titel" defaultValue={noten.titel} aria-label="Titel" />
            <input className="feld" name="stimme" defaultValue={noten.stimme} placeholder="Stimme" aria-label="Stimme" />
            <button className="knopf knopf-klein" type="submit">Speichern</button>
          </form>
        )}
        <p className="text-sm">
          <span className="gedaempft">Sammlungen: </span>{sammlungenVon(noten).join(', ') || <span className="gedaempft">keine</span>}
          <button type="button" className="text-knopf gedaempft ml-2 text-sm underline"
            onClick={() => { alleStuecke().then((l) => setWahl(sammlungenUebersicht(l)), (x) => speicherFehler(x)); }}>ändern</button>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="gedaempft">Tags:</span>
          {tagsVon(noten, tags).length ? tagsVon(noten, tags).map((id) => <TagEtikett key={id} tag={tags.find((t) => t.id === id)!} />) : <span className="gedaempft">keine</span>}
          <button type="button" className="text-knopf gedaempft text-sm underline" onClick={() => setTagWahl(true)}>ändern</button>
        </p>
        {tagWahl && (
          <TagWahl noten={[noten]} tags={tags} schliessen={() => { setTagWahl(false); setTags(tagsLaden()); }}
            speichern={(a) => {
              setTagWahl(false); setTags(tagsLaden());
              if (!a.length) return;
              tagsSetzen(a).then(() => umbenannt({ tags: a[0].tags }), speicherFehler);
            }} />
        )}
        {wahl && (
          <SammlungWahl noten={[noten]} uebersicht={wahl} schliessen={() => setWahl(null)}
            speichern={(a) => {
              setWahl(null);
              if (!a.length) return;
              sammlungenSetzen(a).then(() => umbenannt({ sammlungen: a[0].sammlungen }), speicherFehler);
            }} />
        )}
        <h3 className="abschnitt-titel">Stellen</h3>
        <UebeAnsicht pdf={pdf} notenId={noten.id} stellen={stellen} bpm={bpm} neuLaden={neuLaden} tempoSetzen={tempoSetzen} zeigen={zeigen} />
      </div>
    </div>
  );
}

// ── Nur die markierten Stellen üben ─────────────────────────────────────

function UebeAnsicht({ pdf, notenId, stellen, bpm, tempoSetzen, neuLaden, zeigen }: {
  pdf: PDFDocumentProxy; notenId: string; stellen: Stelle[]; bpm: number; tempoSetzen: (n: number) => void; neuLaden: () => void; zeigen: (id: string) => void;
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
    anmerkungenVon(notenId).then(
      (l) => { if (!weg) setAnm(Object.fromEntries(l.map((x) => [x.seite, x.objekte]))); },
      (x) => { ladeFehler(x); if (!weg) setAnm({}); },
    );
    return () => { weg = true; };
  }, [notenId]);

  // Jede Seite einmal groß rendern, Ausschnitte daraus schneiden.
  const seiteHolen = useCallback((nr: number) => {
    let p = seiten.current.get(nr);
    if (!p) {
      const objekte = anm?.[nr] ?? [];
      p = seiteMitEbene(pdf, nr, 1400).then(({ seite, ebene }) => {
        const ctx = seite.getContext('2d')!;
        if (ebene) {
          ebeneZeichnen(ctx, ebene, objekte, 0, 0, seite.width, seite.height, document.createElement('canvas'));
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
        <UebeStelle key={s.id} stelle={s} breite={breite} rand={rand} seiteHolen={seiteHolen} bpm={bpm} tempoSetzen={tempoSetzen} neuLaden={neuLaden} zeigen={() => zeigen(s.id)} />
      ))}
    </div>
  );
}

function UebeStelle({ stelle, breite, rand, seiteHolen, bpm, tempoSetzen, neuLaden, zeigen }: {
  stelle: Stelle; breite: number; rand: boolean; seiteHolen: (n: number) => Promise<HTMLCanvasElement>;
  bpm: number; tempoSetzen: (n: number) => void; neuLaden: () => void; zeigen: () => void;
}) {
  const ziel = useRef<HTMLCanvasElement>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
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
    <div className="karte space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{stelle.titel || `Stelle auf Seite ${stelle.seite}`}</p>
        <p className="gedaempft text-sm tabular-nums">
          {zuletzt ? `zuletzt ${zuletzt}` : 'noch kein Tempo'}{bestes && bestes !== zuletzt ? ` · bestes ${bestes}` : ''}{stelle.zielTempo ? ` · Ziel ${stelle.zielTempo}` : ''}
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
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setBearbeiten(!bearbeiten)}>bearbeiten</button>
      </div>
      {bearbeiten && (
        <form className="grid gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await stelleAendern(stelle.id, { titel: String(f.get('titel') ?? ''), notiz: String(f.get('notiz') ?? ''), zielTempo: zielAusText(String(f.get('ziel') ?? '')) });
          } catch (x) { speicherFehler(x); return; }
          setBearbeiten(false); neuLaden();
        }}>
          <input className="feld" name="titel" defaultValue={stelle.titel} placeholder="Takte, z. B. T. 32–48" aria-label="Bezeichnung" />
          <input className="feld" name="ziel" inputMode="numeric" defaultValue={stelle.zielTempo ?? ''} placeholder="Zieltempo, z. B. 120" aria-label="Zieltempo" />
          <input className="feld" name="notiz" defaultValue={stelle.notiz ?? ''} placeholder="Notiz, z. B. Atmung nach Takt 34" aria-label="Notiz" />
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit">Speichern</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => { stelleLoeschen(stelle.id).then(neuLaden, speicherFehler); }}>Stelle löschen</button>
          </div>
        </form>
      )}
    </div>
  );
}
