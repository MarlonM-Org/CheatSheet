import { describe, expect, it } from 'vitest';
import {
  mischen, mixAuswahl, mixBereichLesen, mixSchluessel, neueRunde, reserveVon, rundeAbgleichen, rundeLesen, rundeStand, steigerung, stelleOffen,
  tagesbeste, tempoAchse, tempoStand, zielAusText, zielStand, type MixStelle,
} from '@/domain/stellen';

// Wiederholbarer Zufall für die Tests.
function zufall(saat = 1) {
  let s = saat;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const stellen = (je: Record<string, number>): MixStelle[] =>
  Object.entries(je).flatMap(([notenId, n]) => Array.from({ length: n }, (_, i) => ({ id: `${notenId}${i + 1}`, notenId })));
const stueck = (id: string) => id.replace(/\d+$/, '');
const nebeneinander = (reihe: string[]) => reihe.filter((id, i) => i > 0 && stueck(reihe[i - 1]) === stueck(id)).length;

describe('Tempo einer Stelle', () => {
  it('zuletzt nach Datum, bestes über alle', () => {
    expect(tempoStand([{ tempo: 90, am: 3 }, { tempo: 100, am: 1 }, { tempo: 84, am: 2 }])).toEqual({ zuletzt: 90, bestes: 100 });
  });
  it('noch keins geschafft', () => {
    expect(tempoStand([])).toEqual({ zuletzt: null, bestes: null });
  });
  it('gleicher Zeitpunkt: der später eingetragene gilt', () => {
    expect(tempoStand([{ tempo: 80, am: 5 }, { tempo: 82, am: 5 }]).zuletzt).toBe(82);
  });
});

describe('Stellen-Mix: mischen', () => {
  it('jede Stelle genau einmal', () => {
    const alle = stellen({ a: 4, b: 3, c: 2, d: 1 });
    for (let saat = 1; saat <= 30; saat++) {
      const reihe = mischen(alle, zufall(saat));
      expect([...reihe].sort()).toEqual(alle.map((s) => s.id).sort());
    }
  });
  it('nie zwei Stellen desselben Stücks hintereinander, solange es anders geht', () => {
    for (let saat = 1; saat <= 50; saat++) {
      expect(nebeneinander(mischen(stellen({ a: 3, b: 3, c: 2 }), zufall(saat)))).toBe(0);
      // Knapp: a hat mehr als die Hälfte — geht nur als a b a c a
      const knapp = mischen(stellen({ a: 3, b: 1, c: 1 }), zufall(saat));
      expect(nebeneinander(knapp)).toBe(0);
      expect(knapp.map(stueck)).toEqual(['a', expect.any(String), 'a', expect.any(String), 'a']);
    }
  });
  it('geht es nicht anders, stehen die übrigen eben beieinander', () => {
    const reihe = mischen(stellen({ a: 4, b: 1 }), zufall(3));
    expect(reihe).toHaveLength(5);
    expect(nebeneinander(reihe)).toBe(2); // a b a a a: das Beste, was geht
  });
  it('beginnt nicht mit dem Stück, das gerade davor dran war', () => {
    for (let saat = 1; saat <= 20; saat++) expect(stueck(mischen(stellen({ a: 2, b: 2 }), zufall(saat), 'a')[0])).toBe('b');
  });
  it('wirklich gemischt: nicht jedes Mal dieselbe Reihenfolge', () => {
    const alle = stellen({ a: 3, b: 3, c: 3 });
    const verschieden = new Set(Array.from({ length: 20 }, (_, i) => mischen(alle, zufall(i + 1)).join()));
    expect(verschieden.size).toBeGreaterThan(10);
  });
  it('leer bleibt leer', () => {
    expect(mischen([], zufall())).toEqual([]);
  });
});

describe('Stellen-Mix: Runde an den Bestand angleichen', () => {
  const alle = stellen({ a: 2, b: 2, c: 1 });
  const runde = { reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 2 };

  it('nichts geändert: Runde bleibt, wie sie ist', () => {
    expect(rundeAbgleichen(runde, alle, zufall())).toEqual(runde);
  });
  it('gelöschte Stellen fallen weg, die aktuelle bleibt die aktuelle', () => {
    const ohne = alle.filter((s) => s.id !== 'a1' && s.id !== 'b2');
    expect(rundeAbgleichen(runde, ohne, zufall())).toEqual({ reihe: ['b1', 'c1', 'a2'], pos: 1 });
  });
  it('die aktuelle Stelle gelöscht: die nächste rückt an ihren Platz', () => {
    const ohne = alle.filter((s) => s.id !== 'c1');
    expect(rundeAbgleichen(runde, ohne, zufall())).toEqual({ reihe: ['a1', 'b1', 'a2', 'b2'], pos: 2 });
  });
  it('neue Stellen kommen in den noch offenen Teil, die geübten bleiben vorn', () => {
    const mehr = [...alle, { id: 'd1', notenId: 'd' }, { id: 'd2', notenId: 'd' }];
    const neu = rundeAbgleichen(runde, mehr, zufall(7));
    expect(neu.pos).toBe(2);
    expect(neu.reihe.slice(0, 3)).toEqual(['a1', 'b1', 'c1']);
    expect([...neu.reihe.slice(3)].sort()).toEqual(['a2', 'b2', 'd1', 'd2']);
  });
  it('Runde geschafft und neue Stellen dazu: es geht mit den neuen weiter', () => {
    const fertig = { reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 5 };
    const neu = rundeAbgleichen(fertig, [...alle, { id: 'e1', notenId: 'e' }], zufall());
    expect(neu).toEqual({ reihe: ['a1', 'b1', 'c1', 'a2', 'b2', 'e1'], pos: 5 });
  });
  it('neue Runde: alle Stellen, vorn beginnend', () => {
    const r = neueRunde(alle, zufall());
    expect(r.pos).toBe(0);
    expect([...r.reihe].sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1']);
  });
});

describe('Stellen-Mix: Stand für die Bibliothek', () => {
  const alle = stellen({ a: 2, b: 2, c: 1 });
  it('ohne Runde: alles offen', () => {
    expect(rundeStand(null, alle)).toEqual({ anzahl: 5, stuecke: 3, geuebt: 0, fertig: false });
  });
  it('mitten drin: was schon dran war und noch da ist', () => {
    expect(rundeStand({ reihe: ['a1', 'x9', 'b1', 'c1', 'a2', 'b2'], pos: 3 }, alle)).toEqual({ anzahl: 5, stuecke: 3, geuebt: 2, fertig: false });
  });
  it('alle dran gewesen: Runde geschafft', () => {
    expect(rundeStand({ reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 5 }, alle).fertig).toBe(true);
  });
  it('ohne Stellen nie „geschafft“', () => {
    expect(rundeStand({ reihe: [], pos: 0 }, []).fertig).toBe(false);
  });
});

describe('Stellen-Mix: gespeicherte Runde lesen', () => {
  it('nimmt nur eine stimmige Runde', () => {
    expect(rundeLesen({ reihe: ['a', 'b'], pos: 1 })).toEqual({ reihe: ['a', 'b'], pos: 1 });
    expect(rundeLesen(null)).toBeNull();
    expect(rundeLesen({ reihe: 'a', pos: 0 })).toBeNull();
    expect(rundeLesen({ reihe: ['a', 3], pos: 0 })).toBeNull();
    expect(rundeLesen({ reihe: ['a'], pos: -1 })).toBeNull();
  });
  it('doppelte Einträge zählen einmal, pos bleibt im Rahmen', () => {
    expect(rundeLesen({ reihe: ['a', 'b', 'a'], pos: 9 })).toEqual({ reihe: ['a', 'b'], pos: 2 });
  });
});

// ── Ziel und Tempo-Verlauf ──
const am = (tag: number, stunde = 18, minute = 0) => new Date(2026, 9, tag, stunde, minute).getTime(); // Oktober 2026, Ortszeit

describe('Tagesbestes: je Übetag das schnellste Tempo', () => {
  it('Aufwärmen zieht den Tag nicht runter', () => {
    const tempi = [{ tempo: 80, am: am(1, 18) }, { tempo: 92, am: am(1, 18, 20) }, { tempo: 88, am: am(1, 18, 30) }, { tempo: 84, am: am(3, 9) }, { tempo: 96, am: am(3, 9, 15) }];
    expect(tagesbeste(tempi)).toEqual([
      { tag: am(1, 0), tempo: 92, alle: [80, 92, 88] },
      { tag: am(3, 0), tempo: 96, alle: [84, 96] },
    ]);
  });
  it('kurz vor und nach Mitternacht sind zwei Tage; Reihenfolge nach Zeit', () => {
    const tempi = [{ tempo: 100, am: am(2, 0, 5) }, { tempo: 90, am: am(1, 23, 55) }];
    expect(tagesbeste(tempi).map((t) => t.tempo)).toEqual([90, 100]);
  });
  it('ohne Tempi leer', () => {
    expect(tagesbeste([])).toEqual([]);
  });
});

describe('Steigerung: bestes jetzt gegenüber dem besten vor drei Wochen', () => {
  const jetzt = am(30, 20);
  it('mit Übetagen vor der Grenze: deren Bestes ist der Ausgangspunkt', () => {
    const tempi = [{ tempo: 80, am: am(2) }, { tempo: 92, am: am(8) }, { tempo: 100, am: am(20) }, { tempo: 110, am: am(29) }, { tempo: 96, am: am(30) }];
    expect(steigerung(tempi, jetzt)).toEqual({ von: 92, bis: 110, prozent: 20, seit: jetzt - 21 * 86_400_000, seitBeginn: false });
  });
  it('alles jünger als drei Wochen: seit dem ersten Übetag', () => {
    const tempi = [{ tempo: 70, am: am(20, 18) }, { tempo: 80, am: am(20, 19) }, { tempo: 100, am: am(28) }];
    expect(steigerung(tempi, jetzt)).toEqual({ von: 80, bis: 100, prozent: 25, seit: am(20, 0), seitBeginn: true });
  });
  it('nur ein Übetag: noch nichts zu vergleichen', () => {
    expect(steigerung([{ tempo: 70, am: am(29) }, { tempo: 90, am: am(29, 19) }], jetzt)).toBeNull();
    expect(steigerung([], jetzt)).toBeNull();
  });
  it('drei Wochen nicht geübt: gehalten, 0 %', () => {
    expect(steigerung([{ tempo: 90, am: am(1) }, { tempo: 100, am: am(3) }], jetzt)?.prozent).toBe(0);
  });
});

describe('Ziel und Reserve', () => {
  it('Reserve: 10 % über dem Ziel, gerundet', () => {
    expect(reserveVon(120)).toBe(132);
    expect(reserveVon(96)).toBe(106);
  });
  it('Stand zum Ziel: Anteil, was fehlt, Stufe', () => {
    expect(zielStand(108, 120)).toEqual({ anteil: 0.9, fehlt: 12, stufe: 'offen' });
    expect(zielStand(124, 120)).toEqual({ anteil: 124 / 120, fehlt: 0, stufe: 'ziel' });
    expect(zielStand(132, 120)).toEqual({ anteil: 1.1, fehlt: 0, stufe: 'reserve' });
    expect(zielStand(null, 120)).toEqual({ anteil: 0, fehlt: 120, stufe: 'offen' });
    expect(zielStand(100, null)).toBeNull();
  });
  it('Ziel aus der Eingabe: Schläge pro Minute 20–400, sonst keins', () => {
    expect(zielAusText('120')).toBe(120);
    expect(zielAusText(' ♩ = 96 ')).toBe(96);
    expect(zielAusText('')).toBeNull();
    expect(zielAusText('5')).toBeNull();
    expect(zielAusText('999')).toBeNull();
  });
});

describe('Achse der Tempo-Kurve', () => {
  it('runde Striche, Platz über dem Höchsten (Deckel) und unter dem Tiefsten', () => {
    expect(tempoAchse([72, 96, 120, 132])).toEqual({ min: 60, max: 140, striche: [60, 80, 100, 120, 140] });
  });
  it('ein einzelner Wert steht in der Mitte', () => {
    expect(tempoAchse([100])).toEqual({ min: 95, max: 105, striche: [95, 100, 105] });
  });
  it('enge Spanne: feinere Striche', () => {
    expect(tempoAchse([84, 92])).toEqual({ min: 80, max: 95, striche: [80, 85, 90, 95] });
  });
});

describe('Stellen-Mix: Bereich (Sammlung, nur offene)', () => {
  const s = (id: string, notenId: string, zielTempo: number | null = null, tempi: { tempo: number; am: number }[] = []) => ({ id, notenId, zielTempo, tempi });
  it('offen: ohne Ziel, oder Ziel samt Reserve noch nicht geschafft', () => {
    expect(stelleOffen(s('a', 'n'))).toBe(true);
    expect(stelleOffen(s('a', 'n', 120, [{ tempo: 125, am: 1 }]))).toBe(true);
    expect(stelleOffen(s('a', 'n', 120, [{ tempo: 132, am: 1 }]))).toBe(false);
  });
  it('wählt die Stellen der Sammlung, auf Wunsch nur offene — Behaltenes bleibt drin', () => {
    const alle = [s('a1', 'A'), s('a2', 'A', 100, [{ tempo: 110, am: 1 }]), s('b1', 'B'), s('c1', 'C', 100, [{ tempo: 111, am: 1 }])];
    const inSammlung = (notenId: string) => notenId !== 'B';
    expect(mixAuswahl(alle, inSammlung, false).map((x) => x.id)).toEqual(['a1', 'a2', 'c1']);
    expect(mixAuswahl(alle, inSammlung, true).map((x) => x.id)).toEqual(['a1']);
    // schon geübt bzw. gerade dran: bleibt in der Runde, auch wenn jetzt geschafft
    expect(mixAuswahl(alle, inSammlung, true, new Set(['c1'])).map((x) => x.id)).toEqual(['a1', 'c1']);
  });
  it('jeder Bereich hat seine eigene Runde; „alle“ behält den bisherigen Speicherplatz', () => {
    expect(mixSchluessel({ sammlung: null, tag: null, offen: false })).toBe('ueben:mix');
    expect(mixSchluessel({ sammlung: 'Märsche', tag: null, offen: false })).toBe('ueben:mix:Märsche');
    expect(mixSchluessel({ sammlung: null, tag: null, offen: true })).toBe('ueben:mix:offen:*');
    expect(mixSchluessel({ sammlung: 'Märsche', tag: 't1', offen: false })).toBe('ueben:mix:Märsche#t1');
  });
  it('gespeicherter Bereich: alt „true“ heißt alle, ohne Tag heißt kein Tag', () => {
    expect(mixBereichLesen(true)).toEqual({ sammlung: null, tag: null, offen: false });
    expect(mixBereichLesen({ sammlung: 'Jazz', offen: true })).toEqual({ sammlung: 'Jazz', tag: null, offen: true });
    expect(mixBereichLesen({ sammlung: null, tag: 't1', offen: false })).toEqual({ sammlung: null, tag: 't1', offen: false });
    expect(mixBereichLesen(false)).toBeNull();
    expect(mixBereichLesen({ sammlung: 3 })).toEqual({ sammlung: null, tag: null, offen: false });
  });
});
