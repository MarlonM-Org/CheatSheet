'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mitRand } from '@/domain/ueben';
import { notenAendern, notenHolen, stelleAendern, stelleLoeschen, stellenVon, tempoGeschafft, type LokaleNoten, type LokaleStelle as Stelle } from './lokal';
import { useMetronom } from './MetronomKontext';
import { MiniMetronom } from './MiniMetronom';
import { NotenBetrachter } from './NotenBetrachter';
import { pdfLaden, seiteZeichnen } from './pdf';

const RAND = 0.06;

// Ein Stück: Noten groß öffnen, Stelle für Stelle üben, Übersicht der Stellen.
export function NotenPult({ notenId }: { notenId: string }) {
  const { bpm, setBpm } = useMetronom();
  const [noten, setNoten] = useState<LokaleNoten | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fehler, setFehler] = useState('');
  const [stellen, setStellen] = useState<Stelle[]>([]);
  const [offen, setOffen] = useState<{ modus: 'lesen' | 'stellen'; stelle?: string } | null>(null);
  const [umbenennen, setUmbenennen] = useState(false);
  const neuLaden = useCallback(() => { void stellenVon(notenId).then(setStellen); }, [notenId]);

  useEffect(() => {
    let weg = false;
    (async () => {
      const n = await notenHolen(notenId);
      if (!n) throw new Error('nicht mehr auf diesem Gerät');
      void notenAendern(notenId, { zuletzt: Date.now() });
      const [d, st] = await Promise.all([pdfLaden(n.datei), stellenVon(notenId)]);
      if (weg) return;
      setNoten(n); setPdf(d); setStellen(st);
    })().catch((e) => { if (!weg) setFehler(`Noten lassen sich nicht öffnen: ${(e as Error).message}`); });
    return () => { weg = true; };
  }, [notenId]);

  if (fehler) return <p className="karte warnung">{fehler}</p>;
  if (!noten || !pdf) return <p className="gedaempft">Noten werden geladen …</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-xl font-extrabold">{noten.titel}</h2>
        {noten.stimme && <span className="gedaempft">{noten.stimme}</span>}
        <button type="button" className="gedaempft text-sm underline" onClick={() => setUmbenennen(!umbenennen)}>umbenennen</button>
      </div>
      {umbenennen && (
        <form className="karte grid gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const neu = { titel: String(f.get('titel') || noten.titel), stimme: String(f.get('stimme') ?? '') };
          await notenAendern(noten.id, neu); setNoten({ ...noten, ...neu }); setUmbenennen(false);
        }}>
          <input className="feld" name="titel" defaultValue={noten.titel} aria-label="Titel" />
          <input className="feld" name="stimme" defaultValue={noten.stimme} placeholder="Stimme" aria-label="Stimme" />
          <button className="knopf knopf-klein" type="submit">Speichern</button>
        </form>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="knopf" onClick={() => setOffen({ modus: 'lesen' })}>Noten öffnen</button>
        <button type="button" className="knopf knopf-leise" disabled={!stellen.length} onClick={() => setOffen({ modus: 'stellen' })}>
          Stelle für Stelle üben ({stellen.length})
        </button>
      </div>
      <div className="sticky top-2 z-10"><MiniMetronom /></div>
      <h3 className="abschnitt-titel">Stellen</h3>
      <UebeAnsicht pdf={pdf} stellen={stellen} bpm={bpm} neuLaden={neuLaden} tempoSetzen={setBpm} zeigen={(id) => setOffen({ modus: 'stellen', stelle: id })} />
      {offen && (
        <NotenBetrachter noten={noten} pdf={pdf} stellen={stellen} start={offen} geaendert={neuLaden}
          schliessen={() => { setOffen(null); void notenHolen(notenId).then((n) => n && setNoten(n)); }} />
      )}
    </div>
  );
}

// ── Nur die markierten Stellen üben ─────────────────────────────────────

function UebeAnsicht({ pdf, stellen, bpm, tempoSetzen, neuLaden, zeigen }: {
  pdf: PDFDocumentProxy; stellen: Stelle[]; bpm: number; tempoSetzen: (n: number) => void; neuLaden: () => void; zeigen: (id: string) => void;
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

  // Jede Seite einmal groß rendern, Ausschnitte daraus schneiden.
  const seiteHolen = useCallback((nr: number) => {
    let p = seiten.current.get(nr);
    if (!p) {
      const c = document.createElement('canvas');
      p = seiteZeichnen(pdf, nr, c, 1400).then(() => c);
      seiten.current.set(nr, p);
    }
    return p;
  }, [pdf]);

  if (stellen.length === 0) return <p className="karte">Noch keine Stellen markiert. „Noten öffnen“, dann das Werkzeug „▢ Stelle“ wählen und einen Rahmen um die Takte ziehen.</p>;

  return (
    <div ref={huelle} className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rand} onChange={(e) => setRand(e.target.checked)} /> etwas Rand davor und danach zeigen
      </label>
      {breite > 0 && stellen.map((s) => (
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
  const verlauf = [...stelle.tempi].sort((a, b) => a.am - b.am);
  const zuletzt = verlauf.at(-1)?.tempo ?? null;
  const bestes = verlauf.reduce((m, t) => Math.max(m, t.tempo), 0) || null;

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
      {verlauf.length > 1 && (
        <p className="gedaempft text-xs tabular-nums">Verlauf: {verlauf.slice(-8).map((t) => t.tempo).join(' → ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => tempoSetzen(zuletzt ?? stelle.zielTempo ?? 60)}>
          ♩ auf {zuletzt ?? stelle.zielTempo ?? 60}
        </button>
        <button className="knopf knopf-klein" type="button" onClick={async () => { await tempoGeschafft(stelle.id, bpm); neuLaden(); }}>
          ✓ Geschafft bei {bpm}
        </button>
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={zeigen}>In den Noten</button>
        <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setBearbeiten(!bearbeiten)}>bearbeiten</button>
      </div>
      {bearbeiten && (
        <form className="grid gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const z = Number(String(f.get('ziel')).replace(/\D/g, ''));
          await stelleAendern(stelle.id, { titel: String(f.get('titel') ?? ''), notiz: String(f.get('notiz') ?? ''), zielTempo: z >= 20 && z <= 400 ? z : null });
          setBearbeiten(false); neuLaden();
        }}>
          <input className="feld" name="titel" defaultValue={stelle.titel} placeholder="Takte, z. B. T. 32–48" aria-label="Bezeichnung" />
          <input className="feld" name="ziel" inputMode="numeric" defaultValue={stelle.zielTempo ?? ''} placeholder="Zieltempo, z. B. 120" aria-label="Zieltempo" />
          <input className="feld" name="notiz" defaultValue={stelle.notiz ?? ''} placeholder="Notiz, z. B. Atmung nach Takt 34" aria-label="Notiz" />
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit">Speichern</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={async () => { await stelleLoeschen(stelle.id); neuLaden(); }}>Stelle löschen</button>
          </div>
        </form>
      )}
    </div>
  );
}
