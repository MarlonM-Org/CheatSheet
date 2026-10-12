import { describe, expect, it } from 'vitest';
import { mischen, neueRunde, rundeAbgleichen, rundeLesen, rundeStand, tempoStand, type MixStelle } from '@/domain/stellen';

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
