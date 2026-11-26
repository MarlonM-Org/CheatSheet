import { describe, expect, it } from 'vitest';
import { abcLesen, alsAbc, einswingen, entswingen, type Raster, type Tonrahmen } from '../src/domain/notation';
import {
  einteilungLesen, einteilungMoeglich, erkennungsRaster, geswingt, swingAnteil, swingSchaetzen, transkribieren, wirksam, type Rhythmus,
} from '../src/domain/rhythmus';

// Eine künstliche Spur: Töne in weiten Sprüngen (kein Ton wirkt wie ein
// Ansatz zum nächsten), je Einsatz ein Anschlag im Pegel, Rahmen alle 10 ms,
// Zeit ab Schlag 1. `einsaetze` in Vierteln; `verspaetung` in Sekunden.
const TOENE = [60, 67, 64, 71, 62, 69, 65, 72];
function spur(einsaetze: readonly number[], bpm: number, verspaetung = 0, ende = Math.floor(einsaetze[einsaetze.length - 1]) + 1): Tonrahmen[] {
  const q = 60 / bpm;
  const zeiten = einsaetze.map((e) => e * q + verspaetung);
  const r: Tonrahmen[] = [];
  for (let t = 0; t < ende * q + verspaetung; t += 0.01) {
    let i = -1;
    for (let k = 0; k < zeiten.length && zeiten[k] <= t; k++) i = k;
    if (i < 0) { r.push({ zeit: t, midi: null, pegel: 0.001, mitte: 0.001 }); continue; }
    r.push({ zeit: t, midi: TOENE[i % TOENE.length], pegel: t - zeiten[i] < 0.03 ? 0.3 : 0.1, mitte: 0.1 });
  }
  return r;
}
// Geswingte Achtel: je Viertel ein Einsatz auf dem Schlag und einer beim Anteil (± schwanken, abwechselnd).
const swingAchtel = (viertel: number, anteil: number, schwanken = 0) =>
  Array.from({ length: viertel }, (_, k) => [k, k + anteil + (schwanken ? (k % 2 ? schwanken : -schwanken) : 0)]).flat();
const triolen = (viertel: number) => Array.from({ length: viertel }, (_, k) => [k, k + 1 / 3, k + 2 / 3]).flat();

const VIER = { bpm: 120, zaehler: 4, nenner: 4 as const };
const rh = (einteilung: Rhythmus['einteilung'], anteil = 60): Rhythmus => ({ einteilung, anteil });
const dauern = (takte: { noten: { dauer: number; midi: number | null }[] }[]) => takte.flatMap((t) => t.noten.filter((n) => n.midi !== null).map((n) => n.dauer));

describe('Einteilung lesen und prüfen', () => {
  it('liest die alte Feinheit und die neuen Namen', () => {
    expect(einteilungLesen(8)).toBe('achtel');
    expect(einteilungLesen(16)).toBe('sechzehntel');
    expect(einteilungLesen('triolen')).toBe('triolen');
    expect(einteilungLesen('swing')).toBe('swing');
    expect(einteilungLesen('quatsch')).toBe('sechzehntel');
    expect(einteilungLesen(undefined)).toBe('sechzehntel');
  });
  it('kennt Triolen und Swing nur in Taktarten mit Viertel', () => {
    expect(einteilungMoeglich('triolen', 4, 4)).toBe(true);
    expect(einteilungMoeglich('swing', 3, 4)).toBe(true);
    expect(einteilungMoeglich('swing', 2, 2)).toBe(true);
    expect(einteilungMoeglich('triolen', 6, 8)).toBe(false);
    expect(einteilungMoeglich('swing', 6, 8)).toBe(false);
    expect(einteilungMoeglich('swing', 3, 8)).toBe(false);
    expect(einteilungMoeglich('achtel', 6, 8)).toBe(true);
    expect(wirksam(rh('swing'), 6, 8).einteilung).toBe('sechzehntel');
    expect(swingAnteil(rh('swing', 64), 4, 4)).toBe(64);
    expect(swingAnteil(rh('swing', 64), 6, 8)).toBe(0);
    expect(swingAnteil(rh('swing', 50), 4, 4)).toBe(0);
    expect(swingAnteil(rh('achtel', 64), 4, 4)).toBe(0);
  });
  it('rundet je nach Einteilung auf Achtel, Sechzehntel oder Triolen-Achtel', () => {
    expect(erkennungsRaster(VIER, rh('achtel')).feinheit).toBe(8);
    expect(erkennungsRaster(VIER, rh('sechzehntel')).feinheit).toBe(16);
    expect(erkennungsRaster(VIER, rh('triolen')).feinheit).toBe(12);
    expect(erkennungsRaster(VIER, rh('swing')).feinheit).toBe(16);
    expect(erkennungsRaster({ bpm: 90, zaehler: 6, nenner: 8 }, rh('triolen')).feinheit).toBe(16);
  });
});

describe('entswingen und einswingen', () => {
  it('zieht den Nachschlag auf die Mitte, Schläge bleiben', () => {
    expect(entswingen(0.6, 1, 60)).toBeCloseTo(0.5);
    expect(entswingen(2.6, 1, 60)).toBeCloseTo(2.5);
    expect(entswingen(1, 1, 60)).toBeCloseTo(1);
    expect(entswingen(0.3, 0.5, 60)).toBeCloseTo(0.25); // Viertel = 0,5 s
    expect(entswingen(0.67, 1, 50)).toBe(0.67); // gerade: nichts
  });
  it('einswingen kehrt es um', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.7, 1.33, 3.9]) expect(einswingen(entswingen(t, 0.5, 66), 0.5, 66)).toBeCloseTo(t);
    expect(einswingen(0.5, 1, 67)).toBeCloseTo(0.67);
  });
  it('swingt Klänge beim Vorspielen', () => {
    const r: Raster = { ...VIER, feinheit: 96 };
    const k = geswingt([{ beginn: 0, dauer: 0.25 }, { beginn: 0.25, dauer: 0.25 }], r, 60); // 120 bpm: Achtel = 0,25 s
    expect(k[0].beginn).toBeCloseTo(0); expect(k[0].dauer).toBeCloseTo(0.3);
    expect(k[1].beginn).toBeCloseTo(0.3); expect(k[1].dauer).toBeCloseTo(0.2);
    expect(geswingt(k, { bpm: 90, zaehler: 6, nenner: 8, feinheit: 96 }, 60)).toEqual(k);
  });
});

describe('transkribieren mit Swing', () => {
  it('mischt mit Sechzehnteln gerade und punktierte Achtel — der Fehler, um den es geht', () => {
    const { takte } = transkribieren(spur(swingAchtel(8, 0.64, 0.04), 120), VIER, rh('sechzehntel'));
    const d = dauern(takte);
    expect(d).toContain(12); // Achtel (96 je Ganze)
    expect(d).toContain(18); // punktierte Achtel
  });
  it('schreibt geswingte Achtel als gerade Achtel, auch wenn der Swing schwankt', () => {
    for (const [anteil, schwanken, einstellung] of [[0.62, 0, 62], [0.67, 0, 67], [0.64, 0.04, 64], [0.58, 0.03, 60]] as const) {
      const { takte } = transkribieren(spur(swingAchtel(8, anteil, schwanken), 120), VIER, rh('swing', einstellung));
      expect(takte).toHaveLength(2);
      expect(dauern(takte)).toEqual(Array(16).fill(12));
    }
  });
  it('findet die Latenz auch bei geswingten Achteln', () => {
    const t = transkribieren(spur(swingAchtel(8, 0.66), 120, 0.08), VIER, rh('swing', 66));
    expect(t.versatz).toBeGreaterThan(0.06);
    expect(t.versatz).toBeLessThan(0.1);
    expect(dauern(t.takte)).toEqual(Array(16).fill(12));
  });
  it('lässt Viertel und Halbe im Swing in Ruhe', () => {
    const { takte } = transkribieren(spur([0, 1, 2, 2.66, 3, 4], 120, 0, 8), VIER, rh('swing', 66));
    expect(dauern(takte).slice(0, 4)).toEqual([24, 24, 12, 12]);
  });
});

describe('transkribieren mit Triolen', () => {
  it('schreibt Achteltriolen mit Klammer', () => {
    const { takte } = transkribieren(spur(triolen(8), 100), { ...VIER, bpm: 100 }, rh('triolen'));
    expect(takte).toHaveLength(2);
    const noten = takte.flatMap((t) => t.noten);
    expect(noten).toHaveLength(24);
    expect(noten.every((n) => n.triole && n.dauer === 8)).toBe(true);
    expect(noten.filter((n) => n.gruppe === 3)).toHaveLength(8);
  });
  it('liest dieselben Triolen mit Sechzehnteln falsch', () => {
    const { takte } = transkribieren(spur(triolen(8), 100), { ...VIER, bpm: 100 }, rh('sechzehntel'));
    expect(takte.flatMap((t) => t.noten).some((n) => n.triole)).toBe(false);
  });
  it('lässt ganze Viertel binär und findet die Latenz', () => {
    const t = transkribieren(spur([0, 1 / 3, 2 / 3, 1, 2, 7 / 3, 8 / 3, 3, 4], 100, 0.06, 8), { ...VIER, bpm: 100 }, rh('triolen'));
    expect(t.versatz).toBeGreaterThan(0.04);
    expect(t.versatz).toBeLessThan(0.08);
    const erster = t.takte[0].noten;
    expect(erster.slice(0, 3).every((n) => n.triole)).toBe(true);
    expect(erster[3]).toMatchObject({ dauer: 24 });
    expect(erster[3].triole).toBeUndefined();
  });
});

describe('Swing-Anteil aus der Aufnahme schätzen', () => {
  it('liest den Anteil aus dem Gesamtbild', () => {
    expect(swingSchaetzen(spur(swingAchtel(8, 0.62), 120), VIER)).toBeGreaterThanOrEqual(61);
    expect(swingSchaetzen(spur(swingAchtel(8, 0.62), 120), VIER)).toBeLessThanOrEqual(63);
    expect(swingSchaetzen(spur(swingAchtel(8, 0.67), 120, 0.09), VIER)).toBeGreaterThanOrEqual(66);
    expect(swingSchaetzen(spur(swingAchtel(8, 0.5), 120), VIER)).toBeLessThanOrEqual(51);
    // schwankend: der Median
    const s = swingSchaetzen(spur(swingAchtel(8, 0.63, 0.04), 120), VIER)!;
    expect(Math.abs(s - 63)).toBeLessThanOrEqual(2);
  });
  it('sagt nichts, wenn es keine Achtelpaare gibt', () => {
    expect(swingSchaetzen(spur([0, 1, 2, 3, 4, 5, 6, 7], 120), VIER)).toBeNull(); // Viertel
    expect(swingSchaetzen(spur(triolen(6), 100), { ...VIER, bpm: 100 })).toBeNull();
    expect(swingSchaetzen(spur(swingAchtel(8, 0.6), 120), { bpm: 120, zaehler: 6, nenner: 8 })).toBeNull();
  });
});

describe('Swing im ABC-Kopf', () => {
  it('schreibt „Swing“ vor das Tempo und den Anteil als Kommentar, und liest ihn wieder', () => {
    const r: Raster = { ...VIER, feinheit: 8 };
    const text = alsAbc([{ noten: [{ midi: 60, dauer: 8 }] }], r, { titel: 'Blues', swing: 64 });
    expect(text).toContain('Q:"Swing" 1/4=120');
    expect(text).toContain('% swing: 64');
    const g = abcLesen(text)!;
    expect(g.swing).toBe(64);
    expect(g.raster.bpm).toBe(120);
    expect(abcLesen(alsAbc([{ noten: [{ midi: 60, dauer: 8 }] }], r, { titel: 'Gerade' }))!.swing).toBeUndefined();
  });
});
