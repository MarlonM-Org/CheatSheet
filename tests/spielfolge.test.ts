import { describe, expect, it } from 'vitest';
import { ansichten, type Ansicht } from '@/domain/notenpult';
import { abschnitt, ankunftSchritt, schrittUebertragen, schrittZu, spielfolge, type Schritt } from '@/domain/spielfolge';
import type { Sprung } from '@/domain/spruenge';

const p = (seite: number, x: number, y: number) => ({ seite, x, y });
const sprung = (id: string, von: ReturnType<typeof p>, nach: ReturnType<typeof p>, art: Sprung['art']): Sprung => ({ id, von, nach, art });

// Lesbar: je Schritt die Seite (ganz) bzw. „unten→oben“ (halb), mit * und id bei Ankunft.
const zeige = (liste: Ansicht[], folge: Schritt[]) => folge.map((s) => {
  const a = liste[s.ansicht];
  const name = a.art === 'ganz' ? `${a.seite}` : `${a.unten}→${a.oben}`;
  return s.ankunft ? `${name}*${s.ankunft}` : name;
});

// Die Probe: D.S. von S. 3 zurück nach S. 1, Coda von S. 2 nach S. 3.
const ds = sprung('ds', p(3, 0.5, 0.4), p(1, 0.1, 0.3), 'ds');
const coda = sprung('coda', p(2, 0.8, 0.9), p(3, 0.1, 0.75), 'coda');

describe('Spielfolge: Weiterblättern folgt den Sprüngen', () => {
  it('ohne Sprünge genau die Ansichten', () => {
    for (const liste of [ansichten(3, 'ganz'), ansichten(3, 'halb'), ansichten(4, 'linie', { 2: 0.3 })]) {
      expect(spielfolge(liste, [])).toEqual(liste.map((_, i) => ({ ansicht: i })));
    }
    expect(spielfolge([], [ds])).toEqual([]);
  });

  it('D.S. zurück, im zweiten Durchgang zur Coda', () => {
    const liste = ansichten(3, 'ganz');
    expect(zeige(liste, spielfolge(liste, [ds, coda]))).toEqual(['1', '2', '3', '1*ds', '2', '3*coda']);
  });

  it('Reihenfolge des Anlegens egal', () => {
    const liste = ansichten(3, 'ganz');
    expect(spielfolge(liste, [coda, ds])).toEqual(spielfolge(liste, [ds, coda]));
  });

  it('Coda erst nach D.S. oder D.C.; ohne beides übergangen', () => {
    const liste = ansichten(3, 'ganz');
    expect(zeige(liste, spielfolge(liste, [coda]))).toEqual(['1', '2', '3']);
    const dc = sprung('dc', p(3, 0.9, 0.95), p(1, 0, 0), 'dc');
    expect(zeige(liste, spielfolge(liste, [coda, dc]))).toEqual(['1', '2', '3', '1*dc', '2', '3*coda']);
  });

  it('Wiederholung innerhalb einer Seite: eigener Schritt auf derselben Ansicht', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.2), 'wdh');
    const folge = spielfolge(liste, [wdh]);
    expect(zeige(liste, folge)).toEqual(['1', '2', '2*w', '3']);
    expect(folge[2]).toEqual({ ansicht: 1, ankunft: 'w' });
  });

  it('jeder Sprung höchstens einmal: Wiederholung im D.S.-Durchgang nicht nochmal', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(2, 0.9, 0.8), p(1, 0.1, 0.2), 'wdh');
    expect(zeige(liste, spielfolge(liste, [ds, wdh]))).toEqual(['1', '2', '1*w', '2', '3', '1*ds', '2', '3']);
  });

  it('mehrere fällig auf einer Seite: in Lesereihenfolge', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(3, 0.9, 0.3), p(3, 0.1, 0.05), 'wdh');
    const dsUnten = sprung('ds', p(3, 0.9, 0.9), p(1, 0, 0), 'ds');
    expect(zeige(liste, spielfolge(liste, [dsUnten, wdh]))).toEqual(['1', '2', '3', '3*w', '1*ds', '2', '3']);
    // gleiche Höhe: links zuerst
    const a = sprung('a', p(1, 0.2, 0.5), p(1, 0, 0), 'wdh');
    const b = sprung('b', p(1, 0.7, 0.5), p(1, 0, 0), 'wdh');
    expect(zeige(liste, spielfolge(liste, [b, a]))).toEqual(['1', '1*a', '1*b', '2', '3']);
  });

  it('Halb: Sprung aus der Halb-Ansicht zur ganzen Zielseite, danach weiter wie gewohnt', () => {
    const liste = ansichten(3, 'halb');
    expect(zeige(liste, spielfolge(liste, [ds, coda]))).toEqual(['1', '1→2', '2', '2→3', '1*ds', '1→2', '2', '3*coda']);
  });

  it('Halb: in einer Ansicht erst die untere (alte) Seite, dann die obere', () => {
    const halb: Ansicht = { art: 'halb', oben: 2, unten: 1, schnitt: 0.5 };
    const liste: Ansicht[] = [halb, { art: 'ganz', seite: 1 }, { art: 'ganz', seite: 2 }];
    const oben = sprung('oben', p(2, 0.5, 0.1), p(2, 0, 0), 'wdh');
    const unten = sprung('unten', p(1, 0.5, 0.8), p(1, 0, 0), 'wdh');
    expect(zeige(liste, spielfolge(liste, [oben, unten]))).toEqual(['1→2', '1*unten', '2', '2*oben']);
  });

  it('Ziel auf einer Seite, die es nicht gibt: Sprung übergangen', () => {
    const liste = ansichten(3, 'ganz');
    const weg = sprung('weg', p(2, 0.5, 0.5), p(7, 0, 0), 'wdh');
    expect(zeige(liste, spielfolge(liste, [weg, coda]))).toEqual(['1', '2', '3']);
  });

  it('nach vorn: übersprungene Seiten fehlen', () => {
    const liste = ansichten(4, 'ganz');
    const vor = sprung('v', p(1, 0.9, 0.9), p(3, 0, 0), 'wdh');
    expect(zeige(liste, spielfolge(liste, [vor]))).toEqual(['1', '3*v', '4']);
  });

  it('sicher endlich, auch bei vielen Sprüngen im Kreis', () => {
    const liste = ansichten(3, 'halb');
    const viele = Array.from({ length: 60 }, (_, i) => sprung(`s${i}`, p(1 + (i % 3), 0.5, (i % 10) / 10), p(1, 0, 0), (['wdh', 'ds', 'dc', 'coda'] as const)[i % 4]));
    const folge = spielfolge(liste, viele);
    expect(folge.length).toBeGreaterThan(liste.length);
    expect(folge.length).toBeLessThanOrEqual(liste.length * (viele.length + 1) + viele.length);
    // jeder Sprung höchstens einmal
    const ank = folge.flatMap((s) => (s.ankunft ? [s.ankunft] : []));
    expect(new Set(ank).size).toBe(ank.length);
  });
});

describe('Spielfolge: Position', () => {
  const liste = ansichten(3, 'ganz');
  const folge = spielfolge(liste, [ds, coda]); // 1 2 3 1* 2 3*

  it('Schritt zu einer Ansicht: der nächstliegende', () => {
    expect(schrittZu(folge, 0, 0)).toBe(0);
    expect(schrittZu(folge, 0, 4)).toBe(3);
    expect(schrittZu(folge, 2, 4)).toBe(5);
    // gleich weit: der frühere
    const w = spielfolge(liste, [sprung('w', p(2, 0.9, 0.8), p(1, 0, 0), 'wdh')]); // 1 2 1* 2 3
    expect(schrittZu(w, 0, 1)).toBe(0);
    // nicht in der Folge (übersprungen): die nächstgelegene Ansicht
    const vor = spielfolge(ansichten(4, 'ganz'), [sprung('v', p(1, 0.9, 0.9), p(3, 0, 0), 'wdh')]); // 1 3* 4
    expect(schrittZu(vor, 1, 0)).toBe(0);
    expect(schrittZu(vor, 1, 2)).toBe(1);
    expect(schrittZu([], 3, 1)).toBe(0);
  });

  it('Ankunft eines Sprungs: die nächste ab hier, sonst die erste, sonst keine', () => {
    const wdh = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.2), 'wdh');
    const f = spielfolge(liste, [wdh, ds]); // 1 2 2*w 3 1*ds 2 3
    expect(ankunftSchritt(f, 'w', 0)).toBe(2);
    expect(ankunftSchritt(f, 'w', 2)).toBe(2);
    expect(ankunftSchritt(f, 'w', 5)).toBe(2);
    expect(ankunftSchritt(f, 'ds', 1)).toBe(4);
    expect(ankunftSchritt(spielfolge(liste, [coda]), 'coda', 0)).toBeNull();
  });

  it('Abschnitt: seit welchem Sprung man hier ist', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => abschnitt(folge, i))).toEqual([null, null, null, 'ds', 'ds', 'coda']);
    expect(abschnitt(folge, 99)).toBe('coda');
    expect(abschnitt([], 0)).toBeNull();
  });
});

describe('Spielfolge geändert: auf derselben Ansicht bleiben', () => {
  const ganz = ansichten(3, 'ganz'), halb = ansichten(3, 'halb');
  const ohne = spielfolge(ganz, []);
  const mitDs = spielfolge(ganz, [ds]); // 1 2 3 1* 2 3
  const mitBeiden = spielfolge(ganz, [ds, coda]); // 1 2 3 1* 2 3*

  it('Sprung angelegt: im selben Durchgang', () => {
    expect(schrittUebertragen(ganz, ohne, 2, ganz, mitDs)).toBe(2);
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, mitBeiden)).toBe(4);
    // Wiederholung auf S. 1 angelegt, während man im D.S.-Durchgang auf S. 2 ist
    const wdh = sprung('w', p(1, 0.9, 0.8), p(1, 0, 0), 'wdh');
    const neu = spielfolge(ganz, [ds, wdh]); // 1 1*w 2 3 1*ds 2 3
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, neu)).toBe(5);
  });

  it('Sprung gelöscht: dieselbe Seite', () => {
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, ohne)).toBe(1);
    expect(schrittUebertragen(ganz, mitBeiden, 5, ganz, mitDs)).toBe(5);
    expect(schrittUebertragen(ganz, mitBeiden, 5, ganz, ohne)).toBe(2);
  });

  it('Blätter-Modus gewechselt: dieselbe Seite im selben Durchgang', () => {
    const halbDs = spielfolge(halb, [ds]); // 1 1→2 2 2→3 1* 1→2 2 2→3 3
    expect(zeige(halb, halbDs)).toEqual(['1', '1→2', '2', '2→3', '1*ds', '1→2', '2', '2→3', '3']);
    // ganz → halb, S. 2 im D.S.-Durchgang
    expect(schrittUebertragen(ganz, mitDs, 4, halb, halbDs)).toBe(6);
    // halb → ganz aus der Halb-Ansicht 2→3 im D.S.-Durchgang: die obere Seite ganz
    expect(schrittUebertragen(halb, halbDs, 7, ganz, mitDs)).toBe(5);
    // halb → ganz: S. 3 (nur im D.S.-Durchgang zu sehen)
    expect(schrittUebertragen(halb, halbDs, 8, ganz, mitDs)).toBe(5);
    // Ziel vorgegeben (ganze Seite 3 statt Halb-Ansicht 2→3), Abschnitt bleibt
    expect(schrittUebertragen(halb, halbDs, 7, halb, halbDs, 4)).toBe(8);
  });

  it('Ansicht kommt im Abschnitt nicht vor: dort die nächstgelegene Ansicht', () => {
    const halbDs = spielfolge(halb, [ds]); // 1 1→2 2 2→3 | 1* 1→2 2 2→3 3
    // ganz → halb auf S. 3 im ersten Durchgang: halb springt schon aus 2→3
    expect(schrittUebertragen(ganz, mitDs, 2, halb, halbDs)).toBe(3);
    expect(schrittUebertragen(halb, halbDs, 3, halb, halbDs, 4)).toBe(3);
    // Abschnitt gibt es nicht mehr: der nächstgelegene Schritt mit der Ansicht
    expect(schrittUebertragen(ganz, mitBeiden, 5, halb, halbDs)).toBe(8);
  });

  it('Unsinniger Stand: nichts geht kaputt', () => {
    expect(schrittUebertragen(ganz, mitDs, 99, ganz, ohne)).toBe(2);
    expect(schrittUebertragen(ganz, [], 0, ganz, ohne)).toBe(0);
  });
});
