import { describe, expect, it } from 'vitest';
import {
  abcTon, alsAbc, einsaetze, glaetten, notationText, notenDateiname, notenwerte, rastern, tempoAusTipps, zellen, zellenDauer, zellenJeSchlag,
  zellenJeTakt, zerlegen, type Raster, type Tonrahmen,
} from '@/domain/notation';

const VIERVIERTEL: Raster = { bpm: 120, zaehler: 4, nenner: 4, feinheit: 16 };
const DREIVIERTEL_ACHTEL: Raster = { bpm: 90, zaehler: 3, nenner: 4, feinheit: 8 };
const SECHSACHTEL: Raster = { bpm: 60, zaehler: 6, nenner: 8, feinheit: 16 };

// Eine Spur aus Zellen bauen: je Zelle vier Rahmen mit diesem Ton.
function spur(z: (number | null)[], r: Raster, jeZelle = 4): Tonrahmen[] {
  const dz = zellenDauer(r);
  return z.flatMap((midi, i) => Array.from({ length: jeZelle }, (_, k) => ({ zeit: i * dz + (k + 0.5) * (dz / jeZelle), midi })));
}

describe('Raster', () => {
  it('zählt Zellen je Takt und je Schlag', () => {
    expect(zellenJeTakt(VIERVIERTEL)).toBe(16);
    expect(zellenJeSchlag(VIERVIERTEL)).toBe(4);
    expect(zellenJeTakt(DREIVIERTEL_ACHTEL)).toBe(6);
    expect(zellenJeSchlag(DREIVIERTEL_ACHTEL)).toBe(2);
    // 6/8: der Schlag ist die punktierte Viertel = sechs Sechzehntel
    expect(zellenJeTakt(SECHSACHTEL)).toBe(12);
    expect(zellenJeSchlag(SECHSACHTEL)).toBe(6);
  });
  it('rechnet die Zellendauer aus dem Tempo je Schlag', () => {
    expect(zellenDauer(VIERVIERTEL)).toBeCloseTo(0.125);
    expect(zellenDauer(SECHSACHTEL)).toBeCloseTo(1 / 6);
  });
  it('kennt die erlaubten Notenwerte', () => {
    expect(notenwerte(VIERVIERTEL)).toEqual([16, 12, 8, 6, 4, 3, 2, 1]);
    expect(notenwerte(DREIVIERTEL_ACHTEL)).toEqual([6, 4, 3, 2, 1]);
  });
});

describe('zellen', () => {
  it('nimmt je Zelle den Median der klaren Rahmen', () => {
    const r = spur([60, 62], VIERVIERTEL);
    r[1].midi = 72; // ein Ausreißer in der ersten Zelle
    expect(zellen(r, VIERVIERTEL)).toEqual([60, 62]);
  });
  it('macht aus überwiegend unklaren Zellen Pausen und aus Lücken auch', () => {
    const dz = zellenDauer(VIERVIERTEL);
    const r: Tonrahmen[] = [
      { zeit: 0.01, midi: 60 }, { zeit: 0.05, midi: null }, { zeit: 0.09, midi: null },
      { zeit: 2 * dz + 0.01, midi: 64 }, { zeit: 2 * dz + 0.05, midi: 64 },
    ];
    expect(zellen(r, VIERVIERTEL)).toEqual([null, null, 64]);
  });
  it('ignoriert Rahmen vor dem Taktanfang', () => {
    expect(zellen([{ zeit: -0.2, midi: 60 }, { zeit: 0.02, midi: 62 }], VIERVIERTEL)).toEqual([62]);
  });
});

describe('einsaetze', () => {
  it('findet den ersten Ton und jeden Ton nach einer Lücke', () => {
    const dz = zellenDauer(VIERVIERTEL);
    const r: Tonrahmen[] = [
      { zeit: 0.01, midi: 60 }, { zeit: 0.03, midi: 60 }, { zeit: 0.05, midi: null }, { zeit: 0.07, midi: null }, { zeit: 0.11, midi: 60 },
      { zeit: 2 * dz + 0.01, midi: 60 }, { zeit: 2 * dz + 0.03, midi: null }, { zeit: 2 * dz + 0.05, midi: 60 },
    ];
    // Der Einsatz bei 0,11 s rückt auf die Zellgrenze 1; die Ein-Rahmen-Lücke zählt erst mit luecke 1.
    expect([...einsaetze(r, VIERVIERTEL)]).toEqual([0, 1]);
    expect([...einsaetze(r, VIERVIERTEL, 1)]).toEqual([0, 1, 2]);
  });
});

describe('glaetten', () => {
  it('tilgt einzelne Ausreißer zwischen gleichen Nachbarn', () => {
    expect(glaetten([60, 72, 60, 60, null, 60, 62])).toEqual([60, 60, 60, 60, 60, 60, 62]);
  });
  it('lässt echte Wechsel stehen', () => {
    expect(glaetten([60, 62, 64, null, null, 60])).toEqual([60, 62, 64, null, null, 60]);
  });
});

describe('zerlegen', () => {
  it('nimmt auf dem Schlag den größten passenden Wert', () => {
    expect(zerlegen(0, 16, VIERVIERTEL)).toEqual([16]);
    expect(zerlegen(0, 6, VIERVIERTEL)).toEqual([6]);
    expect(zerlegen(0, 5, VIERVIERTEL)).toEqual([4, 1]);
    // Pausen ohne Punktierung
    expect(zerlegen(0, 12, VIERVIERTEL, false)).toEqual([8, 4]);
    // Die Takthälfte bleibt sichtbar: ab Schlag 2 erst bis zur Mitte
    expect(zerlegen(4, 12, VIERVIERTEL)).toEqual([4, 8]);
    expect(zerlegen(4, 12, VIERVIERTEL, false)).toEqual([4, 8]);
    expect(zerlegen(8, 8, VIERVIERTEL)).toEqual([8]);
  });
  it('füllt zwischen den Schlägen erst bis zur Schlaggrenze auf', () => {
    expect(zerlegen(2, 6, VIERVIERTEL)).toEqual([2, 4]);
    expect(zerlegen(3, 2, VIERVIERTEL)).toEqual([1, 1]);
  });
});

describe('rastern', () => {
  it('liefert ohne Ton keine Takte', () => {
    expect(rastern([], VIERVIERTEL)).toEqual([]);
    expect(rastern(spur([null, null], VIERVIERTEL), VIERVIERTEL)).toEqual([]);
  });
  it('macht aus vier gehaltenen Vierteln einen Takt', () => {
    const z = [60, 60, 60, 60, 62, 62, 62, 62, 64, 64, 64, 64, 65, 65, 65, 65];
    expect(rastern(spur(z, VIERVIERTEL), VIERVIERTEL)).toEqual([{ noten: [
      { midi: 60, dauer: 4 }, { midi: 62, dauer: 4 }, { midi: 64, dauer: 4 }, { midi: 65, dauer: 4 },
    ] }]);
  });
  it('füllt den letzten Takt mit Pausen und wirft Pausen am Ende weg', () => {
    const z = [60, 60, 60, 60, 60, 60, null, null, null];
    expect(rastern(spur(z, VIERVIERTEL), VIERVIERTEL)).toEqual([{ noten: [{ midi: 60, dauer: 6 }, { midi: null, dauer: 2 }, { midi: null, dauer: 8 }] }]);
  });
  it('bindet einen Ton über die Taktgrenze', () => {
    const z: (number | null)[] = [...Array<null>(12).fill(null), ...Array<number>(8).fill(60)];
    const takte = rastern(spur(z, VIERVIERTEL), VIERVIERTEL);
    expect(takte).toHaveLength(2);
    expect(takte[0].noten).toEqual([{ midi: null, dauer: 8 }, { midi: null, dauer: 4 }, { midi: 60, dauer: 4, bindung: true }]);
    expect(takte[1].noten).toEqual([{ midi: 60, dauer: 4 }, { midi: null, dauer: 4 }, { midi: null, dauer: 8 }]);
  });
  it('trennt zwei gleiche Töne an einer kurzen Lücke', () => {
    // Zwei Viertel A: am Ende der vierten Zelle zwei unklare Rahmen, dann setzt der Ton neu an.
    const r = spur(Array<number>(8).fill(69), VIERVIERTEL);
    r[14].midi = null; r[15].midi = null;
    expect(rastern(r, VIERVIERTEL)).toEqual([{ noten: [{ midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }, { midi: null, dauer: 8 }] }]);
    // ohne Lücke bleibt es eine Halbe
    expect(rastern(spur(Array<number>(8).fill(69), VIERVIERTEL), VIERVIERTEL)).toEqual([{ noten: [{ midi: 69, dauer: 8 }, { midi: null, dauer: 8 }] }]);
  });
  it('rechnet in 6/8 mit der punktierten Viertel als Schlag', () => {
    const z = [60, 60, 60, 60, 60, 60, 62, 62, 62, 62, 62, 62];
    expect(rastern(spur(z, SECHSACHTEL), SECHSACHTEL)).toEqual([{ noten: [{ midi: 60, dauer: 6 }, { midi: 62, dauer: 6 }] }]);
  });
});

describe('ABC', () => {
  it('schreibt Tonhöhen in ABC-Schreibweise', () => {
    expect(abcTon(60)).toBe('C');
    expect(abcTon(61)).toBe('^C');
    expect(abcTon(72)).toBe('c');
    expect(abcTon(84)).toBe("c'");
    expect(abcTon(48)).toBe('C,');
    expect(abcTon(70)).toBe('^A');
  });
  it('schreibt Kopf und Takte, mit Leerzeichen je Schlag und Bindebögen', () => {
    const abc = alsAbc([
      { noten: [{ midi: 60, dauer: 4 }, { midi: 62, dauer: 2 }, { midi: 64, dauer: 2 }, { midi: null, dauer: 4 }, { midi: 67, dauer: 4, bindung: true }] },
      { noten: [{ midi: 67, dauer: 16 }] },
    ], VIERVIERTEL, { titel: 'Probe' });
    expect(abc).toBe('X:1\nT:Probe\nM:4/4\nL:1/16\nQ:1/4=120\nK:C\nC4 D2E2 z4 G4- | G16 |]\n');
  });
  it('nennt in 6/8 die punktierte Viertel als Tempo-Einheit und bricht nach vier Takten um', () => {
    const takt = { noten: [{ midi: 60, dauer: 12 }] };
    const abc = alsAbc([takt, takt, takt, takt, takt], SECHSACHTEL, { titel: '' });
    expect(abc).toContain('M:6/8\nL:1/16\nQ:3/8=60\n');
    expect(abc).toContain('T:Ohne Titel');
    expect(abc).toContain('C12 |\nC12 |]');
  });
  it('schreibt ohne Takte eine Pause', () => {
    expect(alsAbc([], VIERVIERTEL, { titel: 'x' })).toContain('\nz |]\n');
  });
});

describe('Stück', () => {
  it('beschreibt die Herkunft', () => {
    expect(notationText(undefined)).toBe('');
    expect(notationText({ format: 'abc', text: '', art: 'eingesungen' })).toBe('eingesungen');
    expect(notationText({ format: 'abc', text: '', art: 'audio' })).toBe('aus Audio');
    expect(notationText({ format: 'abc', text: '', art: 'geschrieben' })).toBe('geschrieben');
  });
  it('baut einen Dateinamen mit Datum', () => {
    expect(notenDateiname('Mein: Lied', new Date(2026, 9, 26))).toBe('Mein Lied (Noten 2026-10-26).pdf');
    expect(notenDateiname('  ', new Date(2026, 0, 3))).toBe('Noten (Noten 2026-01-03).pdf');
  });
  it('misst das Tempo aus Tipps', () => {
    expect(tempoAusTipps([0, 500])).toBeNull();
    expect(tempoAusTipps([0, 500, 1000, 1500])).toBe(120);
    // alte Tipps (länger als 2,5 s her) zählen nicht
    expect(tempoAusTipps([0, 100, 5000, 5500, 6000])).toBe(120);
  });
});
