// Aufnehmen in ein geschriebenes Stück (Aufnahmeleiste, G-05): Was mit den
// erkannten Takten geschieht, bevor sie ins Blatt kommen — Einfügen oder
// Ersetzen ab einem Zieltakt samt Bögen an den Nahtstellen, Nachklang am
// Ende weglassen, Abschnitt kürzen, die Vorgabe Einfügen/Ersetzen, die
// Klänge des Vorlaufs. Rein, getestet. Konzept: reports/Einspielen im Stück UX.md.

import type { Raster, Stimme, Takt, Tonrahmen } from './notation';
import { taktDauer, zellenJeSchlag } from './notation';
import { angleichen, bogenLoesen, klaengeAlle, leererTakt, legen, strecken, type Klang } from './notensatz';

export type EinsetzArt = 'einfuegen' | 'ersetzen';

// Löst eine Bindung am Ende von Takt i, wenn der Folgetakt nicht mit
// derselben Tonhöhe beginnt (oder es keinen gibt).
function nahtstelle(takte: Takt[], r: Raster, i: number): Takt[] {
  if (i < 0 || i >= takte.length) return takte;
  const vor = strecken(takte[i]), l = vor[vor.length - 1];
  if (!l?.bindung) return takte;
  const nach = takte[i + 1] ? strecken(takte[i + 1])[0] : null;
  return !nach || nach.midi !== l.midi ? bogenLoesen(takte, r, i) : takte;
}

// Erkannte Takte `neu` ab Takt `ab` in die Stimme `stimme` setzen.
// `ersetzen`: die Takte ab … ab+n−1 weichen; reicht `neu` über das Ende
// hinaus, wächst die Stimme. `einfuegen`: `neu` schiebt sich vor Takt `ab`,
// alle anderen Stimmen bekommen dort leere Takte, damit die Akkolade bündig
// bleibt. Anhängen (ab ≥ Länge) ist in beiden Arten dasselbe. Bögen an den
// Nahtstellen lösen sich, wenn die Tonhöhe nicht passt. `von`/`bis`: wo die
// neuen Takte danach liegen (bis ausschließlich).
export function takteEinsetzen(stimmen: readonly Stimme[], stimme: number, ab: number, neu: readonly Takt[], art: EinsetzArt, r: Raster): { stimmen: Stimme[]; von: number; bis: number } {
  const n = neu.length;
  const sauber = neu.map((t) => legen(strecken(t), r));
  const ergebnis = stimmen.map((s, k) => {
    const takte = [...s.takte];
    while (takte.length < ab) takte.push(leererTakt(r));
    if (k === stimme) {
      let t = art === 'einfuegen' ? [...takte.slice(0, ab), ...sauber, ...takte.slice(ab)] : [...takte.slice(0, ab), ...sauber, ...takte.slice(ab + n)];
      t = nahtstelle(t, r, ab - 1);
      t = nahtstelle(t, r, ab + n - 1);
      return { ...s, takte: t };
    }
    if (art === 'einfuegen' && ab < takte.length) return { ...s, takte: [...takte.slice(0, ab), ...Array.from({ length: n }, () => leererTakt(r)), ...takte.slice(ab)] };
    return { ...s, takte };
  });
  return { stimmen: angleichen(ergebnis, r), von: ab, bis: ab + n };
}

// Nachklang-Regel: Besteht der letzte Takt nur aus der Fortsetzung eines
// gebundenen Tons (höchstens eine halbe Schlaglänge) und sonst Pausen, war
// das der über den Taktstrich gehaltene Schlusston — der Takt fällt weg,
// die Bindung davor löst sich. Eine echte Überbindung (länger) bleibt.
export function nachlaufKuerzen(takte: readonly Takt[], r: Raster): Takt[] {
  if (takte.length < 2) return [...takte];
  const letzter = strecken(takte[takte.length - 1]);
  const davor = strecken(takte[takte.length - 2]);
  const l = davor[davor.length - 1], e = letzter[0];
  if (!l?.bindung || !e || e.midi === null || e.midi !== l.midi) return [...takte];
  if (e.dauer > zellenJeSchlag(r) / 2 || letzter.slice(1).some((s) => s.midi !== null)) return [...takte];
  return bogenLoesen(takte.slice(0, -1), r, takte.length - 2);
}

// Die ersten n Takte; eine Bindung am neuen Ende löst sich.
export function abschnittKuerzen(takte: readonly Takt[], n: number, r: Raster): Takt[] {
  const t = takte.slice(0, Math.max(0, n));
  return t.length ? bogenLoesen(t, r, t.length - 1) : t;
}

// Vorgabe nach der Aufnahme: Anhängen oder lauter leere Zieltakte →
// ersetzen; sonst einfügen (nichts Geschriebenes geht ungefragt verloren).
export function vorgabeArt(takte: readonly Takt[], ab: number, n: number): EinsetzArt {
  if (ab >= takte.length) return 'ersetzen';
  const ziel = takte.slice(ab, ab + n);
  return ziel.every((t) => t.noten.every((x) => x.midi === null)) ? 'ersetzen' : 'einfuegen';
}

// Klänge des Vorlaufs: die `vorlaufTakte` Takte vor Takt `ab` (alle nicht
// stummen Stimmen), `beginn` relativ zu Schlag 1 von Takt `ab` (negativ);
// Klänge, die vor dem Fenster beginnen, werden am Fensteranfang
// abgeschnitten, Klänge, die über den Zieltakt hinausklingen, dort. Mit
// `weiter` kommen die anderen Stimmen (nicht `aktiv`) ab Takt `ab` dazu —
// die Begleitung zum Mitsingen. Bei Takt 1 oder ohne Vorlauftakte leer.
export function vorlaufKlaenge(stimmen: readonly Stimme[], r: Raster, stumm: ReadonlySet<number>, aktiv: number, ab: number, vorlaufTakte: number, weiter: boolean): Klang[] {
  const td = taktDauer(r), bis = ab * td, von = Math.max(0, bis - vorlaufTakte * td);
  const liste: Klang[] = [];
  if (vorlaufTakte > 0 && ab > 0) {
    for (const k of klaengeAlle(stimmen, r, stumm)) {
      if (k.beginn >= bis || k.beginn + k.dauer <= von) continue;
      const start = Math.max(k.beginn, von), ende = Math.min(k.beginn + k.dauer, bis);
      liste.push({ beginn: start - bis, dauer: ende - start, midi: k.midi });
    }
  }
  if (weiter) {
    const ohneAktive = new Set([...stumm, aktiv]);
    for (const k of klaengeAlle(stimmen, r, ohneAktive)) {
      if (k.beginn + k.dauer <= bis) continue;
      const start = Math.max(k.beginn, bis);
      liste.push({ beginn: start - bis, dauer: k.beginn + k.dauer - start, midi: k.midi });
    }
  }
  return liste.sort((a, b) => a.beginn - b.beginn);
}

// Langsamer aufgenommen: die Zeiten der Spur strecken (Faktor < 1 staucht
// eine Aufnahme bei 75 % Tempo auf das notierte Tempo).
export const zeitStrecken = (rahmen: readonly Tonrahmen[], faktor: number): Tonrahmen[] =>
  rahmen.map((f) => ({ ...f, zeit: f.zeit * faktor }));
