'use client';

import { useState } from 'react';
import { reserveVon, steigerung, tagesbeste, tempoStand, zielAusText, zielStand } from '@/domain/stellen';
import { stelleAendern, type LokaleStelle } from './lokal';
import { speicherFehler } from './speicherfehler';
import { useDialogFokus, useEscape } from './tasten';
import { TempoKurve } from './TempoKurve';

const datum = (t: number) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Eine Stelle im Blick (F-12): Zieltempo setzen, Stand zum Ziel, Steigerung
// der letzten drei Wochen und der Tempo-Verlauf als Kurve. Geöffnet aus der
// Stellen-Leiste (Tipp auf den Namen der Stelle).
export function StelleBlatt({ stelle, stueck, geaendert, schliessen }: {
  stelle: LokaleStelle; stueck: string; geaendert: () => void; schliessen: () => void;
}) {
  useEscape(schliessen);
  const fokus = useDialogFokus<HTMLDivElement>();
  const [jetzt] = useState(() => Date.now());
  const [eingabe, setEingabe] = useState(stelle.zielTempo ? String(stelle.zielTempo) : '');
  const [hinweis, setHinweis] = useState('');

  const { bestes } = tempoStand(stelle.tempi);
  const ziel = stelle.zielTempo;
  const stand = zielStand(bestes, ziel);
  const plus = steigerung(stelle.tempi, jetzt);
  const tage = tagesbeste(stelle.tempi);
  const titel = stelle.titel || `Stelle auf Seite ${stelle.seite}`;

  async function zielSpeichern(e: React.FormEvent) {
    e.preventDefault();
    const neu = eingabe.trim() ? zielAusText(eingabe) : null;
    if (eingabe.trim() && neu === null) { setHinweis('Bitte ein Tempo zwischen 20 und 400 eingeben.'); return; }
    if (neu === ziel) { setHinweis(''); return; }
    try { await stelleAendern(stelle.id, { zielTempo: neu }); } catch (x) { speicherFehler(x); return; }
    setHinweis(neu ? `Ziel ${neu} gespeichert.` : 'Ziel entfernt.');
    geaendert();
  }

  return (
    <div className="blatt-hintergrund" onClick={schliessen}>
      <div ref={fokus} tabIndex={-1} className="blatt space-y-4" role="dialog" aria-modal="true" aria-label={`Stelle: ${titel}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold">{titel}</h2>
            <p className="gedaempft truncate text-sm">{stueck} · Seite {stelle.seite}</p>
          </div>
          <button type="button" className="knopf knopf-leise knopf-klein" onClick={schliessen}>Fertig</button>
        </div>

        <form className="ziel-zeile" onSubmit={(e) => void zielSpeichern(e)}>
          <label className="ziel-label" htmlFor="ziel-tempo">Zieltempo</label>
          <input id="ziel-tempo" className="feld feld-zahl" inputMode="numeric" value={eingabe} placeholder="z. B. 120"
            onChange={(e) => { setEingabe(e.target.value); setHinweis(''); }} />
          <button type="submit" className="knopf knopf-klein">Speichern</button>
        </form>
        <p className="gedaempft -mt-2 text-sm" role="status">
          {hinweis || (ziel ? `Mit Reserve (+10 %): ${reserveVon(ziel)} — so sitzt die Stelle, auch wenn es im Konzert flotter wird.`
            : 'Das Tempo, bei dem die Stelle sitzen soll (Schläge pro Minute wie im Metronom).')}
        </p>

        <div className="kennzahlen">
          <div className="kennzahl">
            <span className="kennzahl-label">Bestes</span>
            <span className="kennzahl-wert">{bestes ?? '–'}</span>
            <span className="kennzahl-unter">{tage.length ? `an ${tage.length} ${tage.length === 1 ? 'Tag' : 'Tagen'} geübt` : 'noch nichts geschafft'}</span>
          </div>
          <div className="kennzahl">
            <span className="kennzahl-label">Zum Ziel</span>
            <span className="kennzahl-wert">{stand ? `${Math.min(999, Math.round(stand.anteil * 100))} %` : '–'}</span>
            <span className="kennzahl-unter">
              {!stand ? 'kein Ziel gesetzt' : stand.stufe === 'reserve' ? '✓ mit Reserve' : stand.stufe === 'ziel' ? `✓ erreicht · Reserve ${reserveVon(ziel!)}` : `noch ${stand.fehlt}`}
            </span>
          </div>
          <div className="kennzahl">
            <span className="kennzahl-label">{plus && !plus.seitBeginn ? '3 Wochen' : 'Seit Beginn'}</span>
            <span className="kennzahl-wert">{plus ? `${plus.prozent > 0 ? '+' : ''}${plus.prozent} %` : '–'}</span>
            <span className="kennzahl-unter">{plus ? `${plus.von} → ${plus.bis}${plus.seitBeginn ? ` seit ${datum(plus.seit)}` : ''}` : 'ab dem zweiten Übetag'}</span>
          </div>
        </div>

        <TempoKurve tempi={stelle.tempi} ziel={ziel} />

        {tage.length > 0 && (
          <details>
            <summary className="text-sm font-semibold">Alle Übetage</summary>
            <table className="uebetage">
              <thead><tr><th>Tag</th><th>Bestes</th><th>geschafft</th></tr></thead>
              <tbody>
                {[...tage].reverse().map((t) => (
                  <tr key={t.tag}><td>{datum(t.tag)}</td><td>{t.tempo}</td><td>{t.alle.join(' · ')}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
        {stelle.notiz && <p className="text-sm">{stelle.notiz}</p>}
      </div>
    </div>
  );
}
