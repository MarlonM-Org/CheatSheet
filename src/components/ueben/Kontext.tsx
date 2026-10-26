'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loeschHinweis, type Lesezeichen } from '@/domain/bestand';
import { sammlungenUebersicht, sammlungenVon } from '@/domain/sammlungen';
import { quellenText } from '@/domain/sicht';
import { tagsVon, type Tag } from '@/domain/tags';
import { abcMitTitel, notenDateiname } from '@/domain/notation';
import { loeschVorschau, stueckAendern, stueckDatei, stueckeLoeschen, stueckNeuSchreiben, sammlungenSetzen, tagsLaden, tagsSetzen, type Stueck } from './lokal';
import { notationPdf } from './notenpdf';
import { pdfLaden, seiteMitEbene } from './pdf';
import { SammlungWahl } from './Sammlungen';
import { fehlerGrund, speicherFehler } from './speicherfehler';
import { TagEtikett, TagWahl } from './Tags';
import { useDialogFokus, useEscape } from './tasten';

// Kontext-Blatt (F-08): ein Muster für alles, was ein Ding kann. Öffnet sich
// per Halten, „⋯“ oder Rechtsklick — in der Bibliothek, im Stück-Blatt, an
// Sammlungen, Stellen und Lesezeichen. Oben Vorschaubild, Name und eine
// Zeile Fakten, darunter die Aktionen. Was mehrere Dinge auf einmal betrifft,
// bleibt im Auswahl-Modus; was die aktuelle Seite braucht, im Ansicht-Menü.

export interface Aktion {
  name: string; hinweis?: string; art?: 'prim' | 'warn'; tun: () => void; aus?: boolean;
}

export function KontextBlatt({ titel, untertitel, bild, aktionen, inhalt, oben, schliessen, aria }: {
  titel: string; untertitel?: ReactNode; bild?: ReactNode;
  aktionen: Aktion[];
  // Statt der Aktionen: ein Formular (Umbenennen, Bearbeiten) im selben Blatt.
  inhalt?: ReactNode;
  // Zwischen Kopf und Aktionen (Reihenfolge der Sammlung).
  oben?: ReactNode;
  schliessen: () => void; aria: string;
}) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt kontext" role="dialog" aria-modal="true" aria-label={aria} onClick={(e) => e.stopPropagation()}>
        <div className="kontext-kopf">
          {bild}
          <div className="min-w-0 flex-1">
            <h2 className="kontext-titel">{titel}</h2>
            {untertitel && <p className="gedaempft text-sm">{untertitel}</p>}
          </div>
        </div>
        {oben}
        {inhalt ?? (
          <ul className="kontext-aktionen">
            {aktionen.filter((a) => !a.aus).map((a) => (
              <li key={a.name}>
                <button type="button" className={`kontext-aktion ${a.art ?? ''}`} onClick={a.tun}>
                  <span>{a.name}</span>
                  {a.hinweis && <small>{a.hinweis}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="kontext-abbrechen" onClick={schliessen}>Abbrechen</button>
      </div>
    </div>,
    document.body,
  );
}

// ── Halten (Langdruck) und Rechtsklick ──

const HALTEN_MS = 450;
const HALTEN_WEG = 8;

// Zeiger-Handler für ein Element: Halten oder Rechtsklick ruft `tun`; der
// Klick danach wird geschluckt. Bewegung bricht das Halten ab (Scrollen).
export function useHalten(tun: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ausgeloest = useRef(false);
  const ende = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } start.current = null; };
  useEffect(() => ende, []);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      ausgeloest.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { timer.current = null; ausgeloest.current = true; tun(); }, HALTEN_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HALTEN_WEG) ende();
    },
    onPointerUp: ende,
    onPointerCancel: ende,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); ende(); ausgeloest.current = true; tun(); },
    onClickCapture: (e: React.MouseEvent) => { if (ausgeloest.current) { e.preventDefault(); e.stopPropagation(); ausgeloest.current = false; } },
  };
}

// „⋯“ am Rand einer Zeile.
export function MehrKnopf({ tun, aria }: { tun: () => void; aria: string }) {
  return (
    <button type="button" className="mehr-knopf" onClick={(e) => { e.stopPropagation(); tun(); }} aria-label={aria} title="Mehr">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.7" /><circle cx="10" cy="10" r="1.7" /><circle cx="16" cy="10" r="1.7" /></svg>
    </button>
  );
}

// ── Vorschaubild: erste Seite des Stücks, klein ──

export function StueckDaumen({ stueck }: { stueck: Stueck }) {
  const c = useRef<HTMLCanvasElement>(null);
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => {
    let weg = false;
    let dokument: PDFDocumentProxy | null = null;
    (async () => {
      dokument = await pdfLaden(await stueckDatei(stueck));
      if (weg) return;
      const seite = stueck.quelle ? Math.min(stueck.quelle.von, dokument.numPages) : 1;
      const { seite: bild, ebene } = await seiteMitEbene(dokument, seite, 180);
      ebene?.remove();
      const el = c.current;
      if (weg || !el) return;
      el.width = bild.width; el.height = bild.height;
      el.getContext('2d')!.drawImage(bild, 0, 0);
    })().catch(() => { if (!weg) setFehlt(true); });
    return () => { weg = true; dokument?.loadingTask.destroy().catch(() => {}); };
  }, [stueck]);
  return <div className={`kontext-daumen ${fehlt ? 'fehlt' : ''}`} aria-hidden="true">{fehlt ? '?' : <canvas ref={c} />}</div>;
}

// ── Stück ──

export function StueckKontext({ stueck, stuecke, anzahlStellen, oeffnen, dateiNeu, teilen, geaendert, geloescht, schliessen }: {
  stueck: Stueck;
  // Alle Stücke (für Quellen-Titel, Sammlungen zur Auswahl).
  stuecke: Stueck[];
  anzahlStellen?: number;
  // Aus der Bibliothek: Stück öffnen (auf Wunsch gleich mit Stück-Blatt).
  oeffnen?: (blatt: boolean) => void;
  // Aus der Bibliothek: die PDF-Datei neu wählen (nicht bei virtuellen Stücken).
  dateiNeu?: () => void;
  // „Eigene Stücke daraus“: zeigt das Formular (im Stück-Blatt) oder öffnet das Stück dort.
  teilen?: () => void;
  geaendert: (neu: Partial<Stueck>) => void;
  geloescht: (ids: string[]) => void;
  schliessen: () => void;
}) {
  const [modus, setModus] = useState<'aktionen' | 'umbenennen' | 'sammlungen' | 'tags'>('aktionen');
  const [fehler, setFehler] = useState('');
  const [tags, setTags] = useState<Tag[]>(() => tagsLaden());
  const quelle = stueck.quelle ? stuecke.find((s) => s.id === stueck.quelle!.stueckId) : undefined;
  const fakten = [
    stueck.stimme,
    stueck.quelle ? quellenText(stueck.quelle, quelle?.titel) : '',
    anzahlStellen ? `${anzahlStellen} ${anzahlStellen === 1 ? 'Stelle' : 'Stellen'}` : '',
    sammlungenVon(stueck).join(', '),
  ].filter(Boolean).join(' · ');
  const tagListe = tagsVon(stueck, tags);

  async function loeschen() {
    try {
      const hinweis = loeschHinweis(await loeschVorschau([stueck.id]));
      if (!confirm(`„${stueck.titel}“ mit allen Stellen und Anmerkungen von diesem Gerät löschen?${hinweis ? ` ${hinweis}` : ''}`)) return;
      const { stuecke: weg } = await stueckeLoeschen([stueck.id]);
      geloescht(weg);
    } catch (x) { setFehler(`Löschen ging nicht: ${fehlerGrund(x)}`); }
  }

  const aktionen: Aktion[] = [
    { name: 'Öffnen', art: 'prim', tun: () => oeffnen!(false), aus: !oeffnen },
    { name: 'Umbenennen', hinweis: stueck.stimme ? `${stueck.titel} · ${stueck.stimme}` : undefined, tun: () => setModus('umbenennen') },
    { name: 'Sammlungen …', hinweis: sammlungenVon(stueck).join(', ') || 'in keiner', tun: () => setModus('sammlungen') },
    { name: 'Tags …', hinweis: tagListe.length ? `${tagListe.length} gesetzt` : 'keine', tun: () => setModus('tags') },
    { name: 'Lesezeichen und Stellen …', hinweis: 'Im Stück-Blatt', tun: () => oeffnen!(true), aus: !oeffnen },
    { name: 'Eigene Stücke daraus …', hinweis: 'Seitenbereich oder je Lesezeichen ein Stück', tun: () => teilen!(), aus: !teilen || !!stueck.quelle },
    { name: 'Datei neu wählen', hinweis: 'Dieselbe PDF neu einlesen, Stellen und Anmerkungen bleiben', tun: () => dateiNeu!(), aus: !dateiNeu || !!stueck.quelle },
    { name: 'Löschen …', art: 'warn', hinweis: stueck.quelle ? 'Nur dieses Stück; die Quelle bleibt' : 'Mit Stellen und Anmerkungen', tun: () => void loeschen() },
  ];

  if (modus === 'sammlungen') {
    return (
      <SammlungWahl noten={[stueck]} uebersicht={sammlungenUebersicht(stuecke)} schliessen={() => setModus('aktionen')}
        speichern={(a) => {
          schliessen();
          if (!a.length) return;
          sammlungenSetzen(a).then(() => geaendert({ sammlungen: a[0].sammlungen }), speicherFehler);
        }} />
    );
  }
  if (modus === 'tags') {
    return (
      <TagWahl noten={[stueck]} tags={tags} schliessen={() => { setModus('aktionen'); setTags(tagsLaden()); }}
        speichern={(a) => {
          schliessen();
          if (!a.length) return;
          tagsSetzen(a).then(() => geaendert({ tags: a[0].tags }), speicherFehler);
        }} />
    );
  }
  return (
    <KontextBlatt aria={`Stück: ${stueck.titel}`} titel={stueck.titel} schliessen={schliessen}
      bild={<StueckDaumen stueck={stueck} />}
      untertitel={<>
        {fakten || 'Stück'}
        {tagListe.length > 0 && <span className="bib-tags ml-1">{tagListe.map((id) => <TagEtikett key={id} tag={tags.find((t) => t.id === id)!} />)}</span>}
        {fehler && <span className="block text-sm" style={{ color: 'var(--warnung)' }} role="alert">{fehler}</span>}
      </>}
      aktionen={aktionen}
      inhalt={modus === 'umbenennen' ? (
        <form className="kontext-formular" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const neu = { titel: String(f.get('titel') || stueck.titel).trim() || stueck.titel, stimme: String(f.get('stimme') ?? '').trim() };
          try {
            // Ein geschriebenes Stück trägt den Titel auf dem Blatt: PDF und Quelle neu.
            if (stueck.notation && !stueck.quelle && neu.titel !== stueck.titel) {
              const text = abcMitTitel(stueck.notation.text, neu.titel);
              const { datei, seiten } = await notationPdf(text, neu.titel);
              await stueckNeuSchreiben(stueck.id, { datei, dateiname: notenDateiname(neu.titel, new Date()), titel: neu.titel, seiten, notation: { ...stueck.notation, text } });
              await stueckAendern(stueck.id, { stimme: neu.stimme });
              geaendert({ ...neu, notation: { ...stueck.notation, text } }); schliessen();
              return;
            }
            await stueckAendern(stueck.id, neu);
          } catch (x) { speicherFehler(x); return; }
          geaendert(neu); schliessen();
        }}>
          <input className="feld" name="titel" defaultValue={stueck.titel} aria-label="Titel" autoFocus />
          <input className="feld" name="stimme" defaultValue={stueck.stimme} placeholder="Stimme, z. B. 1. Klarinette" aria-label="Stimme" />
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit">Speichern</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setModus('aktionen')}>Zurück</button>
          </div>
        </form>
      ) : undefined} />
  );
}

// ── Sammlung ──

export function SammlungKontext({ name, anzahl, aktiv, platz, waehlen, umbenennen, verschieben, auswaehlen, aufloesen, schliessen }: {
  name: string; anzahl: number; aktiv: boolean;
  // Platz in der Leiste (0-basiert) und wie viele es gibt — für „Nach vorn / hinten“.
  platz: { i: number; von: number };
  waehlen: () => void; umbenennen: (neu: string) => void;
  verschieben: (wohin: 'anfang' | 'vor' | 'zurueck' | 'ende') => void;
  auswaehlen: () => void; aufloesen: () => void; schliessen: () => void;
}) {
  const [modus, setModus] = useState<'aktionen' | 'umbenennen'>('aktionen');
  const [text, setText] = useState(name);
  const aktionen: Aktion[] = [
    { name: 'Nur diese Sammlung zeigen', art: 'prim', hinweis: 'Als Filter in der Bibliothek', tun: () => { waehlen(); schliessen(); }, aus: aktiv },
    { name: 'Umbenennen', tun: () => setModus('umbenennen') },
    { name: 'Stücke auswählen …', hinweis: 'Mehrere auf einmal einsortieren, markieren, löschen', tun: () => { auswaehlen(); schliessen(); }, aus: !anzahl },
    { name: 'Auflösen …', art: 'warn', hinweis: `Die ${anzahl} ${anzahl === 1 ? 'Stück bleibt' : 'Stücke bleiben'} in der Bibliothek`, tun: () => { aufloesen(); schliessen(); }, aus: !anzahl },
  ];
  return (
    <KontextBlatt aria={`Sammlung: ${name}`} titel={name} untertitel={`Sammlung · ${anzahl} ${anzahl === 1 ? 'Stück' : 'Stücke'}`} schliessen={schliessen}
      bild={<div className="kontext-daumen symbol" aria-hidden="true">▤</div>}
      aktionen={aktionen}
      // Reihenfolge in der Leiste: ganz nach vorn, eins vor, eins zurück — das
      // Blatt bleibt offen, man sieht die Leiste dahinter umsortieren.
      oben={platz.von > 1 ? (
        <div className="kontext-reihe" role="group" aria-label="Platz in der Leiste">
          <span className="gedaempft text-sm">Platz {platz.i + 1} von {platz.von}</span>
          <span className="flex-1" />
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => verschieben('anfang')} disabled={platz.i === 0} aria-label="Ganz nach vorn" title="Ganz nach vorn">⇤</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => verschieben('vor')} disabled={platz.i === 0} aria-label="Nach vorn" title="Nach vorn (links)">←</button>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => verschieben('zurueck')} disabled={platz.i >= platz.von - 1} aria-label="Nach hinten" title="Nach hinten (rechts)">→</button>
        </div>
      ) : undefined}
      inhalt={modus === 'umbenennen' ? (
        <form className="kontext-formular" onSubmit={(e) => { e.preventDefault(); const neu = text.trim(); if (neu && neu !== name) umbenennen(neu); schliessen(); }}>
          <input className="feld" value={text} onChange={(e) => setText(e.target.value)} aria-label="Name der Sammlung" maxLength={60} autoFocus />
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit" disabled={!text.trim()}>Umbenennen</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setModus('aktionen')}>Zurück</button>
          </div>
        </form>
      ) : undefined} />
  );
}

// ── Lesezeichen ──

export function LesezeichenKontext({ lesezeichen, seiten, zurSeite, speichern, alsStueck, entfernen, schliessen }: {
  lesezeichen: Lesezeichen; seiten: number;
  zurSeite: () => void;
  speichern: (titel: string, seite: number) => Promise<void>;
  // „Ab hier als eigenes Stück“ (bis vor das nächste Lesezeichen); null bei virtuellen Stücken.
  alsStueck: (() => void) | null;
  entfernen: () => Promise<void>;
  schliessen: () => void;
}) {
  const [modus, setModus] = useState<'aktionen' | 'bearbeiten'>('aktionen');
  const [hinweis, setHinweis] = useState('');
  const aktionen: Aktion[] = [
    { name: 'Zur Seite', art: 'prim', hinweis: `Seite ${lesezeichen.seite} in den Noten zeigen`, tun: () => { zurSeite(); schliessen(); } },
    { name: 'Umbenennen oder Seite ändern', tun: () => setModus('bearbeiten') },
    { name: 'Ab hier als eigenes Stück …', hinweis: 'Bis vor das nächste Lesezeichen', tun: () => { alsStueck!(); schliessen(); }, aus: !alsStueck },
    { name: 'Entfernen', art: 'warn', tun: () => { if (confirm(`Lesezeichen „${lesezeichen.titel}“ entfernen?`)) void entfernen().then(schliessen, speicherFehler); } },
  ];
  return (
    <KontextBlatt aria={`Lesezeichen: ${lesezeichen.titel}`} titel={lesezeichen.titel} untertitel={`Lesezeichen · Seite ${lesezeichen.seite}`} schliessen={schliessen}
      bild={<div className="kontext-daumen symbol" aria-hidden="true">⌖</div>}
      aktionen={aktionen}
      inhalt={modus === 'bearbeiten' ? (
        <form className="kontext-formular" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const seite = Number(f.get('seite'));
          if (!Number.isInteger(seite) || seite < 1 || seite > seiten) { setHinweis(`Seite 1 bis ${seiten}.`); return; }
          try { await speichern(String(f.get('titel') ?? '').trim() || `Seite ${seite}`, seite); } catch (x) { speicherFehler(x); return; }
          schliessen();
        }}>
          <input className="feld" name="titel" defaultValue={lesezeichen.titel} aria-label="Name" autoFocus />
          <label className="flex items-center gap-2 text-sm">Seite <input className="feld feld-zahl" name="seite" inputMode="numeric" defaultValue={lesezeichen.seite} aria-label="Seite" /> von {seiten}</label>
          {hinweis && <p className="text-sm" role="alert">{hinweis}</p>}
          <div className="flex gap-2">
            <button className="knopf knopf-klein" type="submit">Speichern</button>
            <button className="knopf knopf-leise knopf-klein" type="button" onClick={() => setModus('aktionen')}>Zurück</button>
          </div>
        </form>
      ) : undefined} />
  );
}
