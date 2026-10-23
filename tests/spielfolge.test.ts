import { describe, expect, it } from 'vitest';
import { ansichten, type Ansicht } from '@/domain/notenpult';
import {
  abschnitt, ankunftSchritt, automatischeReihenfolge, genommeneSpruenge, nachSprung, schrittUebertragen, schrittZu, spielfolge,
  spruengeLaden, sprungEinordnen, standUebertragen, standZu, weiterGehen, zurueckGehen, type Schritt,
} from '@/domain/spielfolge';
import { spruengeSchreiben, sprungVerschieben, type Sprung } from '@/domain/spruenge';

const p = (seite: number, x: number, y: number) => ({ seite, x, y });
const sprung = (id: string, von: ReturnType<typeof p>, nach: ReturnType<typeof p>, art: Sprung['art']): Sprung => ({ id, von, nach, art });

// Wie bisher: die Sprünge in der Reihenfolge, in der man sie spielt
// (automatischeReihenfolge) — so liest sie ein älterer Stand ein.
const gespielt = (liste: Ansicht[], spruenge: Sprung[]) => spielfolge(liste, automatischeReihenfolge(liste, spruenge));

// Lesbar: je Schritt die Seite (ganz) bzw. „unten→oben“ (halb), mit * und id bei Ankunft.
const zeige = (liste: Ansicht[], folge: Schritt[]) => folge.map((s) => {
  const a = liste[s.ansicht];
  const name = a.art === 'ganz' ? `${a.seite}` : a.art === 'halb' ? `${a.unten}→${a.oben}` : `${a.links}|${a.rechts}`;
  return s.ankunft ? `${name}*${s.ankunft}` : name;
});

// Die Probe: D.S. von S. 3 zurück nach S. 1, Coda von S. 2 nach S. 3.
const ds = sprung('ds', p(3, 0.5, 0.4), p(1, 0.1, 0.3), 'ds');
const coda = sprung('coda', p(2, 0.8, 0.9), p(3, 0.1, 0.75), 'coda');

describe('Spielfolge: Weiterblättern folgt den Sprüngen', () => {
  it('ohne Sprünge genau die Ansichten', () => {
    for (const liste of [ansichten(3, 'ganz'), ansichten(3, 'halb'), ansichten(4, 'linie', { 2: 0.3 })]) {
      expect(gespielt(liste, [])).toEqual(liste.map((_, i) => ({ ansicht: i })));
    }
    expect(gespielt([], [ds])).toEqual([]);
  });

  it('D.S. zurück, im zweiten Durchgang zur Coda', () => {
    const liste = ansichten(3, 'ganz');
    expect(zeige(liste, gespielt(liste, [ds, coda]))).toEqual(['1', '2', '3', '1*ds', '2', '3*coda']);
  });

  it('ohne festgelegte Reihenfolge: Reihenfolge des Anlegens egal', () => {
    const liste = ansichten(3, 'ganz');
    expect(gespielt(liste, [coda, ds])).toEqual(gespielt(liste, [ds, coda]));
  });

  it('Coda erst nach D.S. oder D.C.; ohne beides übergangen', () => {
    const liste = ansichten(3, 'ganz');
    expect(zeige(liste, gespielt(liste, [coda]))).toEqual(['1', '2', '3']);
    const dc = sprung('dc', p(3, 0.9, 0.95), p(1, 0, 0), 'dc');
    expect(zeige(liste, gespielt(liste, [coda, dc]))).toEqual(['1', '2', '3', '1*dc', '2', '3*coda']);
  });

  it('Wiederholung innerhalb einer Seite: eigener Schritt auf derselben Ansicht', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.2), 'wdh');
    const folge = gespielt(liste, [wdh]);
    expect(zeige(liste, folge)).toEqual(['1', '2', '2*w', '3']);
    expect(folge[2]).toEqual({ ansicht: 1, ankunft: 'w' });
  });

  it('jeder Sprung höchstens einmal: Wiederholung im D.S.-Durchgang nicht nochmal', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(2, 0.9, 0.8), p(1, 0.1, 0.2), 'wdh');
    expect(zeige(liste, gespielt(liste, [ds, wdh]))).toEqual(['1', '2', '1*w', '2', '3', '1*ds', '2', '3']);
  });

  it('mehrere fällig auf einer Seite: in Lesereihenfolge', () => {
    const liste = ansichten(3, 'ganz');
    const wdh = sprung('w', p(3, 0.9, 0.3), p(3, 0.1, 0.05), 'wdh');
    const dsUnten = sprung('ds', p(3, 0.9, 0.9), p(1, 0, 0), 'ds');
    expect(zeige(liste, gespielt(liste, [dsUnten, wdh]))).toEqual(['1', '2', '3', '3*w', '1*ds', '2', '3']);
    // gleiche Höhe: links zuerst
    const a = sprung('a', p(1, 0.2, 0.5), p(1, 0, 0), 'wdh');
    const b = sprung('b', p(1, 0.7, 0.5), p(1, 0, 0), 'wdh');
    expect(zeige(liste, gespielt(liste, [b, a]))).toEqual(['1', '1*a', '1*b', '2', '3']);
  });

  it('Halb: Sprung aus der Halb-Ansicht zur ganzen Zielseite, danach weiter wie gewohnt', () => {
    const liste = ansichten(3, 'halb');
    // Das ⊕ (S. 2 unten) steht unter der Linie: erst in 2→3 fällig.
    expect(zeige(liste, gespielt(liste, [ds, coda]))).toEqual(['1', '1→2', '2', '2→3', '1*ds', '1→2', '2', '2→3', '3*coda']);
  });

  it('Halb/Linie: ein Zeichen unter der Linie ist erst in der Halb-Ansicht fällig', () => {
    // Auf der ganzen Seite blättert man an der Linie weiter — bis zum Zeichen
    // ist noch zu spielen; es steht danach unten in der Halb-Ansicht.
    const halb = ansichten(3, 'halb');
    const w = sprung('w', p(1, 0.9, 0.9), p(1, 0.1, 0.1), 'wdh');
    expect(zeige(halb, gespielt(halb, [w]))).toEqual(['1', '1→2', '1*w', '1→2', '2', '2→3', '3']);
    const dsMitte = sprung('ds', p(2, 0.9, 0.8), p(1, 0.1, 0.3), 'ds');
    expect(zeige(halb, gespielt(halb, [dsMitte]))).toEqual(['1', '1→2', '2', '2→3', '1*ds', '1→2', '2', '2→3', '3']);
    // Linie je Seite: maßgeblich ist die Linie dieser Seite.
    const linie = ansichten(3, 'linie', { 1: 0.7 });
    expect(zeige(linie, gespielt(linie, [sprung('w', p(1, 0.9, 0.8), p(1, 0.1, 0.1), 'wdh')])))
      .toEqual(['1', '1→2', '1*w', '1→2', '2', '2→3', '3']);
    // Über der Linie: schon auf der ganzen Seite.
    expect(zeige(linie, gespielt(linie, [sprung('w', p(1, 0.9, 0.6), p(1, 0.1, 0.1), 'wdh')])))
      .toEqual(['1', '1*w', '1→2', '2', '2→3', '3']);
    // Letzte Seite (keine Halb-Ansicht danach): dort fällig.
    const dc = sprung('dc', p(3, 0.9, 0.9), p(1, 0, 0), 'dc');
    expect(zeige(halb, gespielt(halb, [dc]))).toEqual(['1', '1→2', '2', '2→3', '3', '1*dc', '1→2', '2', '2→3', '3']);
    // Linie zu nah am Rand (keine Halb-Ansicht): auf der ganzen Seite.
    const rand = ansichten(3, 'linie', { 1: 0.97 });
    expect(zeige(rand, gespielt(rand, [sprung('w', p(1, 0.9, 0.98), p(1, 0, 0), 'wdh')]))).toEqual(['1', '1*w', '2', '2→3', '3']);
  });

  it('Halb: per Sprung unter der Linie angekommen — ein Zeichen darunter gilt schon auf der ganzen Seite', () => {
    const halb = ansichten(3, 'halb');
    const zuCoda = sprung('coda', p(1, 0.5, 0.9), p(3, 0.1, 0.1), 'coda');
    // Einstieg (0,7) unter der Linie: man liest von dort, ein Druck am ⊕ springt.
    const dsTief = sprung('ds', p(3, 0.5, 0.4), p(1, 0.1, 0.7), 'ds');
    expect(zeige(halb, gespielt(halb, [dsTief, zuCoda]))).toEqual(['1', '1→2', '2', '2→3', '1*ds', '3*coda']);
    // Einstieg über der Linie: erst an der Linie umblättern, dann am ⊕.
    const dsHoch = sprung('ds', p(3, 0.5, 0.4), p(1, 0.1, 0.3), 'ds');
    expect(zeige(halb, gespielt(halb, [dsHoch, zuCoda]))).toEqual(['1', '1→2', '2', '2→3', '1*ds', '1→2', '3*coda']);
  });

  it('Lesereihenfolge: in einer Zeile links vor rechts, auch wenn ein Zeichen etwas höher sitzt', () => {
    const liste = ansichten(3, 'ganz');
    // |: a :|: b :| in einem System; b ist beim Antippen 0,01 höher geraten.
    const a = sprung('a', p(1, 0.4, 0.5), p(1, 0.1, 0.5), 'wdh');
    const b = sprung('b', p(1, 0.9, 0.49), p(1, 0.4, 0.5), 'wdh');
    expect(zeige(liste, gespielt(liste, [b, a]))).toEqual(['1', '1*a', '1*b', '2', '3']);
    // Eine Zeile tiefer bleibt tiefer, auch weiter links.
    const c = sprung('c', p(1, 0.1, 0.6), p(1, 0, 0), 'wdh');
    const d = sprung('d', p(1, 0.9, 0.5), p(1, 0, 0), 'wdh');
    expect(zeige(liste, gespielt(liste, [c, d]))).toEqual(['1', '1*d', '1*c', '2', '3']);
  });

  it('Halb: in einer Ansicht erst die untere (alte) Seite, dann die obere', () => {
    const halb: Ansicht = { art: 'halb', oben: 2, unten: 1, schnitt: 0.5 };
    const liste: Ansicht[] = [halb, { art: 'ganz', seite: 1 }, { art: 'ganz', seite: 2 }];
    const oben = sprung('oben', p(2, 0.5, 0.1), p(2, 0, 0), 'wdh');
    const unten = sprung('unten', p(1, 0.5, 0.8), p(1, 0, 0), 'wdh');
    expect(zeige(liste, gespielt(liste, [oben, unten]))).toEqual(['1→2', '1*unten', '2', '2*oben']);
  });

  it('Ziel auf einer Seite, die es nicht gibt: Sprung übergangen', () => {
    const liste = ansichten(3, 'ganz');
    const weg = sprung('weg', p(2, 0.5, 0.5), p(7, 0, 0), 'wdh');
    expect(zeige(liste, gespielt(liste, [weg, coda]))).toEqual(['1', '2', '3']);
  });

  it('nach vorn: übersprungene Seiten fehlen', () => {
    const liste = ansichten(4, 'ganz');
    const vor = sprung('v', p(1, 0.9, 0.9), p(3, 0, 0), 'wdh');
    expect(zeige(liste, gespielt(liste, [vor]))).toEqual(['1', '3*v', '4']);
  });

  it('sicher endlich, auch bei vielen Sprüngen im Kreis', () => {
    const liste = ansichten(3, 'halb');
    const viele = Array.from({ length: 60 }, (_, i) => sprung(`s${i}`, p(1 + (i % 3), 0.5, (i % 10) / 10), p(1, 0, 0), (['wdh', 'ds', 'dc', 'coda'] as const)[i % 4]));
    const folge = gespielt(liste, viele);
    expect(folge.length).toBeGreaterThan(liste.length);
    expect(folge.length).toBeLessThanOrEqual(liste.length * (viele.length + 1) + viele.length);
    // jeder Sprung höchstens einmal
    const ank = folge.flatMap((s) => (s.ankunft ? [s.ankunft] : []));
    expect(new Set(ank).size).toBe(ank.length);
  });
});

describe('Reihenfolge der Liste: so wird gesprungen', () => {
  const liste = ansichten(3, 'ganz');
  // 1./2. Haus: S. 2 oben das 1. Haus mit :| zurück zum Anfang, beim zweiten
  // Mal vom Beginn des 1. Hauses ins 2. Haus auf S. 3.
  const zurueck = sprung('zurueck', p(2, 0.9, 0.5), p(1, 0.1, 0.1), 'wdh');
  const haus2 = sprung('haus2', p(2, 0.1, 0.3), p(3, 0.1, 0.1), 'wdh');

  it('der Reihe nach: erst der erste, dann der nächste', () => {
    expect(zeige(liste, spielfolge(liste, [ds, coda]))).toEqual(['1', '2', '3', '1*ds', '2', '3*coda']);
    // Wiederholung erst im D.S.-Durchgang: unter das D.S. geschoben
    const w = sprung('w', p(1, 0.9, 0.8), p(1, 0.1, 0.1), 'wdh');
    expect(zeige(liste, spielfolge(liste, [w, ds]))).toEqual(['1', '1*w', '2', '3', '1*ds', '2', '3']);
    expect(zeige(liste, spielfolge(liste, [ds, w]))).toEqual(['1', '2', '3', '1*ds', '1*w', '2', '3']);
  });

  it('1./2. Haus: der Sprung ins 2. Haus erst nach der Wiederholung', () => {
    // Ohne festgelegte Reihenfolge nähme man das 2. Haus gleich beim ersten Mal.
    expect(zeige(liste, gespielt(liste, [zurueck, haus2]))).toEqual(['1', '2', '3*haus2']);
    expect(zeige(liste, spielfolge(liste, [zurueck, haus2]))).toEqual(['1', '2', '1*zurueck', '2', '3*haus2']);
  });

  it('Coda vor dem D.S.: wartet — dahinter wird nichts genommen', () => {
    const f = spielfolge(liste, [coda, ds]);
    expect(zeige(liste, f)).toEqual(['1', '2', '3']);
    expect(genommeneSpruenge(f).size).toBe(0);
    expect(genommeneSpruenge(spielfolge(liste, [ds, coda]))).toEqual(new Set(['ds', 'coda']));
  });

  it('Ziel gibt es nicht: übergangen, der nächste ist dran', () => {
    const weg = sprung('weg', p(1, 0.5, 0.5), p(7, 0, 0), 'wdh');
    expect(zeige(liste, spielfolge(liste, [weg, ds]))).toEqual(['1', '2', '3', '1*ds', '2', '3']);
  });
});

describe('Reihenfolge von selbst: so, wie man spielt', () => {
  const liste = ansichten(2, 'ganz');
  // Der Fall aus der Probe: D.S. auf S. 2 zurück nach S. 1, ⊕ auf S. 1 in die Coda auf S. 2.
  const ds2 = sprung('ds', p(2, 0.5, 0.6), p(1, 0.1, 0.3), 'ds');
  const coda2 = sprung('coda', p(1, 0.8, 0.9), p(2, 0.1, 0.75), 'coda');

  it('erst das D.S., dann die Coda — egal, in welcher Reihenfolge angelegt', () => {
    expect(automatischeReihenfolge(liste, [coda2, ds2]).map((s) => s.id)).toEqual(['ds', 'coda']);
    expect(automatischeReihenfolge(liste, [ds2, coda2]).map((s) => s.id)).toEqual(['ds', 'coda']);
    expect(zeige(liste, spielfolge(liste, [ds2, coda2]))).toEqual(['1', '2', '1*ds', '2*coda']);
  });

  it('nie genommene ans Ende, in Lesereihenfolge', () => {
    const w = sprung('w', p(1, 0.5, 0.2), p(1, 0, 0), 'wdh');
    const weg = sprung('weg', p(1, 0.5, 0.1), p(9, 0, 0), 'wdh');
    expect(automatischeReihenfolge(liste, [coda2, weg, w]).map((s) => s.id)).toEqual(['w', 'weg', 'coda']);
    expect(automatischeReihenfolge(liste, [])).toEqual([]);
  });

  it('älterer Stand (ohne nr): in der Reihenfolge, in der man spielt; sonst wie gespeichert', () => {
    expect(spruengeLaden([coda2, ds2], liste).map((s) => s.id)).toEqual(['ds', 'coda']);
    expect(spruengeLaden(spruengeSchreiben([coda2, ds2], undefined), liste).map((s) => s.id)).toEqual(['coda', 'ds']);
    expect(spruengeLaden(undefined, liste)).toEqual([]);
  });
});

describe('Neuer Sprung: dort eingereiht, wo man ihn spielt', () => {
  const liste = ansichten(3, 'ganz');

  it('nicht verschoben: die ganze Liste in Spielreihenfolge', () => {
    expect(sprungEinordnen(liste, [coda], ds).map((s) => s.id)).toEqual(['ds', 'coda']);
    expect(sprungEinordnen(liste, [ds], coda).map((s) => s.id)).toEqual(['ds', 'coda']);
    const w = sprung('w', p(1, 0.9, 0.8), p(1, 0.1, 0.1), 'wdh');
    expect(sprungEinordnen(liste, [ds, coda], w).map((s) => s.id)).toEqual(['w', 'ds', 'coda']);
    expect(sprungEinordnen(liste, [], w)).toEqual([w]);
  });

  // Verschoben: 1./2. Haus wie oben, das 2. Haus unter die Wiederholung.
  const zurueck = sprung('zurueck', p(2, 0.9, 0.5), p(1, 0.1, 0.1), 'wdh');
  const haus2 = sprung('haus2', p(2, 0.1, 0.3), p(3, 0.1, 0.1), 'wdh');
  const verschoben = sprungVerschieben([haus2, zurueck], 'zurueck', -1);

  it('verschoben: die übrigen bleiben, wie sie stehen', () => {
    expect(verschoben.map((s) => s.id)).toEqual(['zurueck', 'haus2']);
    // D.S. am Ende von S. 3: nach dem 2. Haus
    const ds3 = sprung('ds', p(3, 0.9, 0.9), p(1, 0, 0), 'ds');
    const mitDs = sprungEinordnen(liste, verschoben, ds3);
    expect(mitDs.map((s) => s.id)).toEqual(['zurueck', 'haus2', 'ds']);
    expect(zeige(liste, spielfolge(liste, mitDs))).toEqual(['1', '2', '1*zurueck', '2', '3*haus2', '1*ds', '2', '3']);
    // Wiederholung auf S. 1: gleich beim ersten Mal, also ganz nach oben
    const w = sprung('w', p(1, 0.9, 0.8), p(1, 0.1, 0.5), 'wdh');
    expect(sprungEinordnen(liste, verschoben, w).map((s) => s.id)).toEqual(['w', 'zurueck', 'haus2']);
  });

  it('verschoben: auf derselben Ansicht wie der nächste — in Lesereihenfolge', () => {
    const davor = sprung('davor', p(2, 0.5, 0.2), p(2, 0, 0.1), 'wdh');
    const danach = sprung('danach', p(2, 0.95, 0.5), p(1, 0, 0), 'wdh');
    expect(sprungEinordnen(liste, verschoben, davor).map((s) => s.id)).toEqual(['davor', 'zurueck', 'haus2']);
    // rechts neben dem :| — beim ersten Mal springt man vorher zurück, beim
    // zweiten Mal vorher ins 2. Haus: nie erreicht
    expect(sprungEinordnen(liste, verschoben, danach).map((s) => s.id)).toEqual(['zurueck', 'haus2', 'danach']);
    // im 2. Haus auf S. 3: danach
    const imHaus = sprung('imHaus', p(3, 0.5, 0.5), p(3, 0, 0.1), 'wdh');
    expect(sprungEinordnen(liste, verschoben, imHaus).map((s) => s.id)).toEqual(['zurueck', 'haus2', 'imHaus']);
  });

  it('verschoben: Coda erst nach einem D.S./D.C.; nie erreicht oder ohne Ziel ans Ende', () => {
    const zuCoda = sprung('coda', p(1, 0.5, 0.9), p(3, 0, 0.5), 'coda');
    expect(sprungEinordnen(liste, verschoben, zuCoda).map((s) => s.id)).toEqual(['zurueck', 'haus2', 'coda']);
    const weg = sprung('weg', p(1, 0.5, 0.5), p(8, 0, 0), 'wdh');
    expect(sprungEinordnen(liste, verschoben, weg).map((s) => s.id)).toEqual(['zurueck', 'haus2', 'weg']);
  });
});

describe('Spielfolge: Position', () => {
  const liste = ansichten(3, 'ganz');
  const folge = gespielt(liste, [ds, coda]); // 1 2 3 1* 2 3*

  it('Schritt zu einer Ansicht: der nächstliegende', () => {
    expect(schrittZu(folge, 0, 0)).toBe(0);
    expect(schrittZu(folge, 0, 4)).toBe(3);
    expect(schrittZu(folge, 2, 4)).toBe(5);
    // gleich weit: der frühere
    const w = gespielt(liste, [sprung('w', p(2, 0.9, 0.8), p(1, 0, 0), 'wdh')]); // 1 2 1* 2 3
    expect(schrittZu(w, 0, 1)).toBe(0);
    // nicht in der Folge (übersprungen): die nächstgelegene Ansicht
    const vor = gespielt(ansichten(4, 'ganz'), [sprung('v', p(1, 0.9, 0.9), p(3, 0, 0), 'wdh')]); // 1 3* 4
    expect(schrittZu(vor, 1, 0)).toBe(0);
    expect(schrittZu(vor, 1, 2)).toBe(1);
    expect(schrittZu([], 3, 1)).toBe(0);
  });

  it('Ankunft eines Sprungs: die nächste ab hier, sonst die erste, sonst keine', () => {
    const wdh = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.2), 'wdh');
    const f = gespielt(liste, [wdh, ds]); // 1 2 2*w 3 1*ds 2 3
    expect(ankunftSchritt(f, 'w', 0)).toBe(2);
    expect(ankunftSchritt(f, 'w', 2)).toBe(2);
    expect(ankunftSchritt(f, 'w', 5)).toBe(2);
    expect(ankunftSchritt(f, 'ds', 1)).toBe(4);
    expect(ankunftSchritt(gespielt(liste, [coda]), 'coda', 0)).toBeNull();
  });

  it('Untertitel „nach …“: der Sprung, über den man in diesen Teil kam', () => {
    const id = (f: Schritt[], spr: Sprung[]) => f.map((_, i) => nachSprung(f, i, spr)?.id ?? null);
    expect(id(folge, [ds, coda])).toEqual([null, null, null, 'ds', 'ds', 'coda']);
    expect(nachSprung([], 0, [ds])).toBeNull();
    // Wiederholung: nur solange man in ihr ist — bis zur Ansicht, an der gesprungen wurde.
    const wSeite = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.2), 'wdh');
    const f1 = gespielt(liste, [wSeite]); // 1 2 2*w 3
    expect(id(f1, [wSeite])).toEqual([null, null, 'w', null]);
    const wZurueck = sprung('w', p(2, 0.9, 0.8), p(1, 0.1, 0.2), 'wdh');
    const f2 = gespielt(liste, [wZurueck, ds]); // 1 2 1*w 2 3 1*ds 2 3
    expect(id(f2, [wZurueck, ds])).toEqual([null, null, 'w', 'w', null, 'ds', 'ds', 'ds']);
    // Halb: gesprungen aus 2→3 — die Wiederholung reicht bis 2→3.
    const halb = ansichten(3, 'halb');
    const wHalb = sprung('w', p(2, 0.9, 0.8), p(2, 0.1, 0.1), 'wdh');
    const f3 = gespielt(halb, [wHalb]);
    expect(zeige(halb, f3)).toEqual(['1', '1→2', '2', '2→3', '2*w', '2→3', '3']);
    expect(id(f3, [wHalb])).toEqual([null, null, null, null, 'w', 'w', null]);
    // Außer der Reihe hinter dem Ende der Wiederholung (ganze S. 3, Halb springt schon aus 2→3): vorbei.
    const f4 = gespielt(halb, [wHalb, ds]); // 1 1→2 2 2→3 2*w 2→3 1*ds …
    expect(nachSprung(f4, 5, [wHalb, ds])?.id).toBe('w');
    expect(nachSprung(f4, 5, [wHalb, ds], 4)).toBeNull();
    expect(nachSprung(f4, 5, [wHalb, ds], 3)?.id).toBe('w');
    // Wiederholung in der Coda: danach wieder „nach Coda“.
    const fuenf = ansichten(5, 'ganz');
    const ds5 = sprung('ds', p(3, 0.5, 0.5), p(1, 0, 0), 'ds');
    const coda5 = sprung('coda', p(2, 0.5, 0.9), p(4, 0, 0), 'coda');
    const w5 = sprung('w', p(4, 0.9, 0.9), p(4, 0.1, 0.1), 'wdh');
    const f5 = gespielt(fuenf, [ds5, coda5, w5]);
    expect(zeige(fuenf, f5)).toEqual(['1', '2', '3', '1*ds', '2', '4*coda', '4*w', '5']);
    expect(id(f5, [ds5, coda5, w5])).toEqual([null, null, null, 'ds', 'ds', 'coda', 'w', 'coda']);
  });

  it('Abschnitt: seit welchem Sprung man hier ist', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => abschnitt(folge, i))).toEqual([null, null, null, 'ds', 'ds', 'coda']);
    expect(abschnitt(folge, 99)).toBe('coda');
    expect(abschnitt([], 0)).toBeNull();
  });
});

describe('Spielfolge geändert: auf derselben Ansicht bleiben', () => {
  const ganz = ansichten(3, 'ganz'), halb = ansichten(3, 'halb');
  const ohne = gespielt(ganz, []);
  const mitDs = gespielt(ganz, [ds]); // 1 2 3 1* 2 3
  const mitBeiden = gespielt(ganz, [ds, coda]); // 1 2 3 1* 2 3*

  it('Sprung angelegt: im selben Durchgang', () => {
    expect(schrittUebertragen(ganz, ohne, 2, ganz, mitDs)).toBe(2);
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, mitBeiden)).toBe(4);
    // Wiederholung auf S. 1 angelegt, während man im D.S.-Durchgang auf S. 2 ist
    const wdh = sprung('w', p(1, 0.9, 0.8), p(1, 0, 0), 'wdh');
    const neu = gespielt(ganz, [ds, wdh]); // 1 1*w 2 3 1*ds 2 3
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, neu)).toBe(5);
  });

  it('Sprung gelöscht: dieselbe Seite', () => {
    expect(schrittUebertragen(ganz, mitDs, 4, ganz, ohne)).toBe(1);
    expect(schrittUebertragen(ganz, mitBeiden, 5, ganz, mitDs)).toBe(5);
    expect(schrittUebertragen(ganz, mitBeiden, 5, ganz, ohne)).toBe(2);
  });

  it('Blätter-Modus gewechselt: dieselbe Seite im selben Durchgang', () => {
    const halbDs = gespielt(halb, [ds]); // 1 1→2 2 2→3 1* 1→2 2 2→3 3
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
    const halbDs = gespielt(halb, [ds]); // 1 1→2 2 2→3 | 1* 1→2 2 2→3 3
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

describe('Ansicht außer der Reihe (zeige): weiter im selben Durchgang', () => {
  const ganz = ansichten(3, 'ganz'), halb = ansichten(3, 'halb');
  const mitDs = gespielt(ganz, [ds]); // 1 2 3 1* 2 3
  const halbDs = gespielt(halb, [ds]); // 1 1→2 2 2→3 | 1* 1→2 2 2→3 3

  it('Moduswechsel: dieselbe Ansicht; hat der Durchgang sie nicht, bleibt sie zu sehen', () => {
    // Ganz S. 3 im ersten Durchgang → Halb: dort springt man schon aus 2→3.
    const h = standUebertragen(ganz, mitDs, { schritt: 2, zeige: null }, halb, halbDs);
    expect(h).toEqual({ schritt: 3, zeige: 4 });
    // … und zurück auf Ganz: wieder S. 3 im ersten Durchgang.
    expect(standUebertragen(halb, halbDs, h, ganz, mitDs)).toEqual({ schritt: 2, zeige: null });
    // Linie wie Halb.
    const linie = ansichten(3, 'linie'), linieDs = gespielt(linie, [ds]);
    expect(standUebertragen(ganz, mitDs, { schritt: 2, zeige: null }, linie, linieDs)).toEqual({ schritt: 3, zeige: 4 });
    // Kommt die Ansicht im Durchgang vor: ganz normal ein Schritt.
    expect(standUebertragen(ganz, mitDs, { schritt: 4, zeige: null }, halb, halbDs)).toEqual({ schritt: 6, zeige: null });
    expect(standUebertragen(ganz, [], { schritt: 0, zeige: null }, halb, halbDs)).toEqual({ schritt: 0, zeige: null });
  });

  it('ganze Seite zeigen (ziel): im Durchgang, sonst außer der Reihe', () => {
    // Halb 2→3 im ersten Durchgang → ganze S. 3 (kommt dort nicht vor).
    expect(standUebertragen(halb, halbDs, { schritt: 3, zeige: null }, halb, halbDs, 4)).toEqual({ schritt: 3, zeige: 4 });
    // Halb 2→3 im D.S.-Durchgang → ganze S. 3 ist der nächste Schritt.
    expect(standUebertragen(halb, halbDs, { schritt: 7, zeige: null }, halb, halbDs, 4)).toEqual({ schritt: 8, zeige: null });
  });

  it('weiter und zurück von einer Ansicht außer der Reihe', () => {
    // ganze S. 3 außer der Reihe, Schritt 2→3: weiter springt (D.S.), zurück ist 2→3.
    expect(weiterGehen(halbDs, { schritt: 3, zeige: 4 })).toEqual({ schritt: 4, zeige: null });
    expect(zurueckGehen(halbDs, { schritt: 3, zeige: 4 })).toEqual({ schritt: 3, zeige: null });
    // Schritt liegt hinter der gezeigten Ansicht: weiter zu ihm, zurück davor.
    expect(weiterGehen(halbDs, { schritt: 6, zeige: 1 })).toEqual({ schritt: 6, zeige: null });
    expect(zurueckGehen(halbDs, { schritt: 6, zeige: 1 })).toEqual({ schritt: 5, zeige: null });
    // gewöhnlich: ein Schritt; am Ende und am Anfang bleibt alles.
    expect(weiterGehen(mitDs, { schritt: 1, zeige: null })).toEqual({ schritt: 2, zeige: null });
    expect(zurueckGehen(mitDs, { schritt: 1, zeige: null })).toEqual({ schritt: 0, zeige: null });
    const ende = { schritt: 5, zeige: null };
    expect(weiterGehen(mitDs, ende)).toBe(ende);
    const anfang = { schritt: 0, zeige: null };
    expect(zurueckGehen(mitDs, anfang)).toBe(anfang);
    const fern = { schritt: 3, zeige: 4 };
    expect(weiterGehen(halbDs.slice(0, 4), fern)).toBe(fern);
    expect(weiterGehen([], anfang)).toBe(anfang);
  });

  it('eine Ansicht zeigen: der nächstliegende Schritt mit ihr; fehlt sie in der Folge, außer der Reihe', () => {
    expect(standZu(mitDs, 0, 4)).toEqual({ schritt: 3, zeige: null });
    const vier = ansichten(4, 'ganz');
    const vor = gespielt(vier, [sprung('v', p(1, 0.9, 0.9), p(3, 0, 0), 'wdh')]); // 1 3* 4
    expect(standZu(vor, 1, 0)).toEqual({ schritt: 0, zeige: 1 });
    expect(standZu(vor, 3, 0)).toEqual({ schritt: 2, zeige: null });
  });
});

describe('Doppelseite (B-13)', () => {
  it('Weiterblättern geht Doppelseite für Doppelseite, ein Sprung führt auf die Doppelseite mit dem Ziel', () => {
    const liste = ansichten(5, 'ganz', {}, {}, true);
    const ds = { id: 'ds', art: 'ds' as const, von: { seite: 4, x: 0.5, y: 0.9 }, nach: { seite: 1, x: 0.1, y: 0.1 }, nr: 1 };
    expect(zeige(liste, spielfolge(liste, [ds]))).toEqual(['1|2', '3|4', '1|2*ds', '3|4', '5']);
  });
});
