'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FARB_NAMEN, mitTag, ohneTag, TAG_FARBEN, tagName, tagsVon, VORSCHLAEGE, type Tag, type TagFarbe } from '@/domain/tags';
import { tagAendern, tagAnlegen, tagLoeschen, type Stueck } from './lokal';
import { speicherFehler } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';

// Tags (F-14): farbige Markierungen für Stücke. Ein Tag erscheint immer mit
// seinem Namen — die Farbe hilft beim Wiederfinden, trägt aber nie allein.

export const TagPunkt = ({ farbe, klein = false }: { farbe: TagFarbe; klein?: boolean }) =>
  <span className={`tag-punkt tag-${farbe}${klein ? ' klein' : ''}`} aria-hidden="true" />;

export function TagEtikett({ tag }: { tag: Tag }) {
  return <span className="tag-etikett"><TagPunkt farbe={tag.farbe} klein />{tag.name}</span>;
}

// Filterzeile der Bibliothek: ein Tag gewählt oder keiner.
export function TagFilter({ uebersicht, aktiv, waehlen }: {
  uebersicht: { tag: Tag; anzahl: number }[]; aktiv: string | null; waehlen: (id: string | null) => void;
}) {
  return (
    <div className="sammlungen" role="group" aria-label="Tags">
      {uebersicht.map(({ tag, anzahl }) => (
        <button key={tag.id} type="button" className="sammlung-chip tag-chip" aria-pressed={aktiv === tag.id}
          onClick={() => waehlen(aktiv === tag.id ? null : tag.id)}>
          <TagPunkt farbe={tag.farbe} />{tag.name}<span className="sammlung-zahl">{anzahl}</span>
        </button>
      ))}
    </div>
  );
}

function FarbWahl({ farbe, setFarbe }: { farbe: TagFarbe; setFarbe: (f: TagFarbe) => void }) {
  return (
    <div className="farb-wahl" role="radiogroup" aria-label="Farbe">
      {TAG_FARBEN.map((f) => (
        <button key={f} type="button" role="radio" aria-checked={farbe === f} aria-label={FARB_NAMEN[f]} title={FARB_NAMEN[f]}
          className={`farb-wahl-knopf tag-${f}`} onClick={() => setFarbe(f)} />
      ))}
    </div>
  );
}

// Neuer Tag oder Tag ändern: Name und Farbe.
function TagFormular({ start, knopf, fertig, abbrechen }: {
  start?: { name: string; farbe: TagFarbe }; knopf: string; fertig: (name: string, farbe: TagFarbe) => void; abbrechen?: () => void;
}) {
  const [text, setText] = useState(start?.name ?? '');
  const [farbe, setFarbe] = useState<TagFarbe>(start?.farbe ?? 'rot');
  const name = tagName(text);
  return (
    <form className="tag-formular" onSubmit={(e) => { e.preventDefault(); if (name) { fertig(name, farbe); if (!start) setText(''); } }}>
      <div className="sammlung-formular">
        <TagPunkt farbe={farbe} />
        <input className="feld" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, z. B. Wichtig üben" aria-label="Name des Tags" maxLength={40} />
      </div>
      <FarbWahl farbe={farbe} setFarbe={setFarbe} />
      <div className="flex gap-2">
        <button type="submit" className="knopf knopf-klein" disabled={!name}>{knopf}</button>
        {abbrechen && <button type="button" className="text-knopf bib-fertig" onClick={abbrechen}>Abbrechen</button>}
      </div>
    </form>
  );
}

// In den Einstellungen: Tags anlegen, umbenennen, umfärben, löschen.
export function TagVerwaltung({ tags, geaendert }: { tags: Tag[]; geaendert: () => void }) {
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  return (
    <section className="space-y-2" aria-label="Tags">
      <p className="text-sm font-semibold">Tags</p>
      <p className="gedaempft text-sm">Farbige Markierungen für Stücke, z. B. „Wichtig üben“ oder „Kann ich“. Ein Stück kann mehrere tragen; in der Bibliothek nach Tag filtern und gezielt mischen.</p>
      {tags.length > 0 && (
        <ul className="sammlung-wahl">
          {tags.map((t) => (
            <li key={t.id}>
              {bearbeiten === t.id ? (
                <div className="p-3 space-y-2">
                  <TagFormular start={t} knopf="Speichern" abbrechen={() => setBearbeiten(null)}
                    fertig={(name, farbe) => { tagAendern(t.id, { name, farbe }); setBearbeiten(null); geaendert(); }} />
                  <button type="button" className="text-knopf bib-loeschen" onClick={() => {
                    if (!confirm(`Tag „${t.name}“ löschen? Die Stücke bleiben, nur die Markierung verschwindet.`)) return;
                    tagLoeschen(t.id).then(() => { setBearbeiten(null); geaendert(); }, speicherFehler);
                  }}>Tag löschen</button>
                </div>
              ) : (
                <button type="button" className="tag-zeile" onClick={() => setBearbeiten(t.id)}>
                  <TagEtikett tag={t} /><span className="flex-1" /><span className="bib-fertig text-sm">bearbeiten</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {tags.length === 0 && (
        <div className="karte space-y-2 !py-3">
          <p className="text-sm">Vorschlag zum Start:</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">{VORSCHLAEGE.map((v) => <TagEtikett key={v.name} tag={{ id: v.name, name: v.name, farbe: v.farbe, geaendert: 0 }} />)}</p>
          <button type="button" className="knopf knopf-klein" onClick={() => { for (const v of VORSCHLAEGE) tagAnlegen(v.name, v.farbe); geaendert(); }}>Diese vier anlegen</button>
        </div>
      )}
      {neu ? (
        <TagFormular knopf="Tag anlegen" abbrechen={() => setNeu(false)} fertig={(name, farbe) => { tagAnlegen(name, farbe); setNeu(false); geaendert(); }} />
      ) : (
        <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setNeu(true)}>+ Tag</button>
      )}
    </section>
  );
}

// Markieren: für die gewählten Stücke jeden Tag an/aus (halb: nur manche).
// Neue Tags lassen sich hier gleich anlegen.
export function TagWahl({ noten, tags: start, speichern, schliessen }: {
  noten: Stueck[]; tags: Tag[];
  speichern: (aenderungen: { id: string; tags: string[] }[]) => void; schliessen: () => void;
}) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  type Zustand = 'alle' | 'teils' | 'keine';
  const [tags, setTags] = useState(start);
  const [stand, setStand] = useState<Record<string, Zustand>>(() => Object.fromEntries(start.map((t) => {
    const drin = noten.filter((n) => tagsVon(n).includes(t.id)).length;
    return [t.id, drin === 0 ? 'keine' : drin === noten.length ? 'alle' : 'teils'];
  })));
  const [neu, setNeu] = useState(false);

  function uebernehmen() {
    const aenderungen = noten.map((n) => {
      let l = tagsVon(n, tags);
      for (const t of tags) {
        if (stand[t.id] === 'alle') l = mitTag(l, t.id);
        if (stand[t.id] === 'keine') l = ohneTag(l, t.id);
      }
      return { id: n.id, tags: l, vorher: tagsVon(n, tags) };
    }).filter((a) => a.tags.join('\u0000') !== a.vorher.join('\u0000')).map(({ id, tags: l }) => ({ id, tags: l }));
    speichern(aenderungen);
  }
  const titel = noten.length === 1 ? noten[0].titel : `${noten.length} Stücke`;

  return createPortal(
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label="Tags setzen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Tags</h2>
            <p className="gedaempft truncate text-sm">{titel}</p>
          </div>
          <button type="button" className="knopf knopf-klein" onClick={uebernehmen}>Fertig</button>
        </div>
        {tags.length === 0 && <p className="gedaempft text-sm">Noch keine Tags — unten den ersten anlegen.</p>}
        <ul className="sammlung-wahl">
          {tags.map((t) => (
            <li key={t.id}>
              <label>
                <input type="checkbox" className="auswahl-box" checked={stand[t.id] === 'alle'}
                  ref={(el) => { if (el) el.indeterminate = stand[t.id] === 'teils'; }}
                  onChange={() => setStand({ ...stand, [t.id]: stand[t.id] === 'alle' ? 'keine' : 'alle' })} />
                <TagEtikett tag={t} />
                <span className="flex-1" />
                {stand[t.id] === 'teils' && <span className="gedaempft text-xs">bei manchen</span>}
              </label>
            </li>
          ))}
        </ul>
        {neu ? (
          <TagFormular knopf="Anlegen" abbrechen={() => setNeu(false)} fertig={(name, farbe) => {
            const t = tagAnlegen(name, farbe);
            setTags([...tags, t]); setStand({ ...stand, [t.id]: 'alle' }); setNeu(false);
          }} />
        ) : (
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={() => setNeu(true)}>+ Neuer Tag</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
