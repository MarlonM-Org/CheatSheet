import { describe, expect, it } from 'vitest';
import {
  abcLesen, abcMitTitel, abcTon, alsAbc, anschlaege, aufLeiter, effektivwert, einsaetze, glaetten, hysterese, nachbessern, notationText, notenDateiname, notenwerte,
  rastern, tempoAusTipps, tonartFinden, ueberzaehlig, versatzSchaetzen, zellen, zellenDauer, zellenJeSchlag, zellenJeTakt, zerlegen,
  type Raster, type Takt, type Tonrahmen,
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

// ── Monophone Lesart (aus experimente/transkription/monophon.py übertragen) ──

const NEUNZIG: Raster = { bpm: 90, zaehler: 4, nenner: 4, feinheit: 16 };

// Eine gespielte oder gesungene Melodie als Spur: je Note [midi, Dauer in
// Vierteln]; Rahmen alle 11,6 ms mit Vibrato (±0,3 Halbton) und Pegel —
// Klavier: Anschlag und Ausklingen je Note; legato: gleichmäßig mit leichtem
// Tremolo, ohne Lücke zwischen den Noten.
function gespielt(melodie: [number, number][], r: Raster, art: 'klavier' | 'legato', spaet = 0): Tonrahmen[] {
  const dt = 0.0116, schlag = 60 / r.bpm;
  const f: Tonrahmen[] = [];
  let t0 = 0;
  for (const [midi, viertel] of melodie) {
    const dauer = viertel * schlag;
    for (let t = 0; t < dauer - 1e-9; t += dt) {
      const vibrato = 0.3 * Math.sin(2 * Math.PI * 5.5 * (t0 + t));
      const pegel = art === 'klavier' ? 0.5 * Math.exp(-3 * t) + 0.01 : 0.3 + 0.03 * Math.sin(2 * Math.PI * 6 * (t0 + t));
      f.push({ zeit: t0 + t + spaet, midi: midi + vibrato, pegel });
    }
    t0 += dauer;
  }
  return f;
}

// „Alle meine Entchen“ in C-Dur, 4/4 — die Referenz aus dem Experiment.
const ENTCHEN: [number, number][] = [
  [60, 1], [62, 1], [64, 1], [65, 1], [67, 2], [67, 2],
  [69, 1], [69, 1], [69, 1], [69, 1], [67, 4],
  [69, 1], [69, 1], [69, 1], [69, 1], [67, 4],
  [65, 1], [65, 1], [65, 1], [65, 1], [64, 2], [64, 2],
  [62, 1], [62, 1], [62, 1], [62, 1], [60, 4],
];
const ENTCHEN_TAKTE = [
  [{ midi: 60, dauer: 4 }, { midi: 62, dauer: 4 }, { midi: 64, dauer: 4 }, { midi: 65, dauer: 4 }],
  [{ midi: 67, dauer: 8 }, { midi: 67, dauer: 8 }],
  [{ midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }],
  [{ midi: 67, dauer: 16 }],
  [{ midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }, { midi: 69, dauer: 4 }],
  [{ midi: 67, dauer: 16 }],
  [{ midi: 65, dauer: 4 }, { midi: 65, dauer: 4 }, { midi: 65, dauer: 4 }, { midi: 65, dauer: 4 }],
  [{ midi: 64, dauer: 8 }, { midi: 64, dauer: 8 }],
  [{ midi: 62, dauer: 4 }, { midi: 62, dauer: 4 }, { midi: 62, dauer: 4 }, { midi: 62, dauer: 4 }],
  [{ midi: 60, dauer: 16 }],
].map((noten) => ({ noten }));

describe('Tonart', () => {
  it('rundet gemessene Tonhöhen auf die Leiter', () => {
    const c = tonartFinden('C'), f = tonartFinden('F'), am = tonartFinden('Am');
    expect(aufLeiter(60.4, null)).toBe(60);
    expect(aufLeiter(60.6, null)).toBe(61);
    expect(aufLeiter(60.6, c)).toBe(60);   // Cis gibt es in C-Dur nicht
    expect(aufLeiter(61.4, c)).toBe(62);   // zu tiefes D
    expect(aufLeiter(64.6, c)).toBe(65);
    expect(aufLeiter(70.4, f)).toBe(70);   // B in F-Dur
    expect(aufLeiter(70.4, c)).toBe(71);   // in C-Dur das H
    expect(aufLeiter(68.5, am)).toBe(69);
    expect(tonartFinden('')).toBeNull();
    expect(tonartFinden('Xy')).toBeNull();
  });
  it('misst den Effektivwert', () => {
    expect(effektivwert([0, 0, 0])).toBe(0);
    expect(effektivwert([1, -1, 1, -1])).toBe(1);
    expect(effektivwert(new Float32Array(0))).toBe(0);
  });
});

describe('hysterese', () => {
  it('hält einen Ton trotz Vibrato um die Halbtongrenze zusammen', () => {
    const r: Tonrahmen[] = Array.from({ length: 40 }, (_, i) => ({ zeit: i * 0.01, midi: 60.5 + 0.4 * Math.sin(i) }));
    const g = hysterese(r);
    const toene = new Set(g.map((f) => f.midi));
    expect(toene.size).toBe(1);
    expect([...toene][0]).toBeCloseTo(60.5, 0);
  });
  it('trennt bei einem echten Sprung und bleibt beim Gleiten am Anfang verankert', () => {
    // Langsames Gleiten von 60 nach 62: ohne Verankerung am Median der ganzen Strecke würde alles ein Ton.
    const r: Tonrahmen[] = Array.from({ length: 60 }, (_, i) => ({ zeit: i * 0.01, midi: 60 + (2 * i) / 59 }));
    const g = hysterese(r);
    expect(new Set(g.map((f) => f.midi)).size).toBeGreaterThanOrEqual(2);
    expect(g[0].midi!).toBeLessThan(61);
    expect(g[59].midi!).toBeGreaterThan(61.5);
  });
  it('überbrückt kurze Aussetzer, lässt Pausen stehen', () => {
    const r: Tonrahmen[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ zeit: i * 0.01, midi: 64 })),
      { zeit: 0.1, midi: null }, { zeit: 0.11, midi: null },
      ...Array.from({ length: 10 }, (_, i) => ({ zeit: 0.12 + i * 0.01, midi: 64 })),
      ...Array.from({ length: 30 }, (_, i) => ({ zeit: 0.22 + i * 0.01, midi: null })),
      ...Array.from({ length: 10 }, (_, i) => ({ zeit: 0.52 + i * 0.01, midi: 64 })),
    ];
    const g = hysterese(r);
    expect(g[10].midi).toBe(64);
    expect(g[11].midi).toBe(64);
    expect(g[25].midi).toBeNull();
  });
});

describe('nachbessern', () => {
  it('schiebt einen Oktavfehler in die Lage der Nachbarn', () => {
    expect(nachbessern([69, 69, 57, 69, 69])).toEqual([69, 69, 69, 69, 69]);
    expect(nachbessern([60, 72, 62])).toEqual([60, 60, 62]);
    // zwei Zellen tief sind kein Fehler mehr; am Rand fehlt ein Nachbar
    expect(nachbessern([69, 57, 57, 69])).toEqual([69, 57, 57, 69]);
    expect(nachbessern([57, 69, 69])).toEqual([57, 69, 69]);
  });
  it('lässt einen angeschliffenen Ansatz im folgenden Ton aufgehen', () => {
    expect(nachbessern([64, 65, 65, 65])).toEqual([65, 65, 65, 65]);
    expect(nachbessern([null, 63, 65, 65, 65])).toEqual([null, 65, 65, 65, 65]);
    // ein echter Vorschlag drei Halbtöne tiefer bleibt
    expect(nachbessern([62, 65, 65, 65])).toEqual([62, 65, 65, 65]);
    // vor einer ebenso kurzen Note bleibt er auch
    expect(nachbessern([64, 65, 67, 69])).toEqual([64, 65, 67, 69]);
  });
});

describe('anschlaege', () => {
  it('findet Anstiege im Pegel und keine im Tremolo', () => {
    // Der allererste Anschlag hat keinen leiseren Vorgänger und zählt hier nicht
    // (der erste Ton ist ohnehin ein Einsatz); die beiden Neuansätze schon.
    const klavier = gespielt([[69, 1], [69, 1], [69, 1]], NEUNZIG, 'klavier');
    const a = anschlaege(klavier);
    expect(a).toHaveLength(2);
    expect(a[0]).toBeCloseTo(60 / 90, 1);
    expect(a[1]).toBeCloseTo(120 / 90, 1);
    expect(anschlaege(gespielt([[69, 3]], NEUNZIG, 'legato'))).toEqual([]);
    expect(anschlaege(gespielt([[69, 3]], NEUNZIG, 'legato').map((f) => ({ zeit: f.zeit, midi: f.midi })))).toEqual([]);
  });
  it('zählt Anschläge als Einsätze, wenn danach ein Ton klingt', () => {
    const klavier = gespielt([[69, 1], [69, 1]], NEUNZIG, 'klavier');
    expect([...einsaetze(klavier, NEUNZIG)]).toEqual([0, 4]);
  });
});

describe('versatzSchaetzen', () => {
  it('erkennt eine gleichmäßige Verspätung aller Einsätze', () => {
    expect(versatzSchaetzen(gespielt(ENTCHEN, NEUNZIG, 'klavier', 0.1), NEUNZIG)).toBeCloseTo(0.1, 1);
    expect(versatzSchaetzen(gespielt(ENTCHEN, NEUNZIG, 'klavier'), NEUNZIG)).toBe(0);
  });
  it('nimmt bei zu wenigen Tonwechseln nichts an', () => {
    expect(versatzSchaetzen(gespielt([[60, 1], [62, 1]], NEUNZIG, 'klavier', 0.1), NEUNZIG)).toBe(0);
  });
});

describe('rastern, monophone Lesart', () => {
  it('liest „Alle meine Entchen“ vom Klavier Note für Note', () => {
    expect(rastern(gespielt(ENTCHEN, NEUNZIG, 'klavier'), NEUNZIG, { tonart: tonartFinden('C') })).toEqual(ENTCHEN_TAKTE);
  });
  it('liest es auch ohne Tonart und mit Verspätung', () => {
    expect(rastern(gespielt(ENTCHEN, NEUNZIG, 'klavier'), NEUNZIG)).toEqual(ENTCHEN_TAKTE);
    const spaet = gespielt(ENTCHEN, NEUNZIG, 'klavier', 0.12);
    const v = versatzSchaetzen(spaet, NEUNZIG);
    expect(rastern(spaet.map((f) => ({ ...f, zeit: f.zeit - v })), NEUNZIG)).toEqual(ENTCHEN_TAKTE);
  });
  it('bindet legato gesungene gleiche Töne ohne Neuansatz zusammen', () => {
    expect(rastern(gespielt([[69, 1], [69, 1], [69, 1], [69, 1]], NEUNZIG, 'legato'), NEUNZIG)).toEqual([{ noten: [{ midi: 69, dauer: 16 }] }]);
  });
  it('zieht zu tief gesungene Töne mit Tonart auf die Leiter', () => {
    // F um 60 Cent zu hoch gesungen: ohne Tonart ein Fis, mit C-Dur das F.
    const hoch = gespielt([[62, 1], [65.6, 1], [67, 2]], NEUNZIG, 'klavier');
    expect(rastern(hoch, NEUNZIG)[0].noten.map((n) => n.midi)).toEqual([62, 66, 67]);
    expect(rastern(hoch, NEUNZIG, { tonart: tonartFinden('C') })[0].noten.map((n) => n.midi)).toEqual([62, 65, 67]);
    // H um 40 Cent zu tief: ohne Tonart das H, in F-Dur das B.
    const tief = gespielt([[69, 1], [70.6, 1], [72, 2]], NEUNZIG, 'klavier');
    expect(rastern(tief, NEUNZIG)[0].noten.map((n) => n.midi)).toEqual([69, 71, 72]);
    expect(rastern(tief, NEUNZIG, { tonart: tonartFinden('F') })[0].noten.map((n) => n.midi)).toEqual([69, 70, 72]);
  });
});

describe('ABC mit Tonart', () => {
  it('schreibt die Tonart in den Kopf und lässt Leitertöne ohne Vorzeichen', () => {
    const abc = alsAbc([{ noten: [{ midi: 70, dauer: 4 }, { midi: 71, dauer: 4 }, { midi: 70, dauer: 4 }, { midi: 65, dauer: 4 }] }], VIERVIERTEL, { titel: 'F' }, tonartFinden('F'));
    expect(abc).toContain('K:F\n');
    expect(abc).toContain('B4 =B4 _B4 F4 |]');
  });
  it('setzt ein Vorzeichen nur, wenn es im Takt noch nicht gilt', () => {
    const abc = alsAbc([
      { noten: [{ midi: 61, dauer: 4 }, { midi: 60, dauer: 4 }, { midi: 61, dauer: 4 }, { midi: 61, dauer: 4 }] },
      { noten: [{ midi: 61, dauer: 16 }] },
    ], VIERVIERTEL, { titel: 'x' });
    expect(abc).toContain('^C4 =C4 ^C4 C4 | ^C16 |]');
  });
  it('schreibt in Kreuz-Tonarten Kreuze, in B-Tonarten Bs, über Oktaven hinweg', () => {
    const g = alsAbc([{ noten: [{ midi: 66, dauer: 4 }, { midi: 78, dauer: 4 }, { midi: 65, dauer: 4 }, { midi: 66, dauer: 4 }] }], VIERVIERTEL, { titel: 'G' }, tonartFinden('G'));
    expect(g).toContain('K:G\n');
    // Nach dem Auflösungszeichen braucht das Fis im selben Takt sein Kreuz wieder.
    expect(g).toContain('F4 f4 =F4 ^F4 |]');
    const bb = alsAbc([{ noten: [{ midi: 63, dauer: 8 }, { midi: 61, dauer: 8 }] }], VIERVIERTEL, { titel: 'B' }, tonartFinden('Bb'));
    expect(bb).toContain('E8 _D8 |]');
  });
});

describe('ABC zurücklesen', () => {
  const B: Raster = { bpm: 92, zaehler: 4, nenner: 4, feinheit: 96 };
  const ohne = (takte: Takt[]) => takte.map((t) => ({ noten: t.noten.map(({ gruppe: _g, triole: _t, ...n }) => { void _g; void _t; return n; }) }));
  it('liest zurück, was alsAbc schreibt — Vorzeichen, Oktaven, Bindungen, Pausen, Triolen', () => {
    const takte: Takt[] = [
      { noten: [{ midi: 61, dauer: 24 }, { midi: 61, dauer: 12 }, { midi: 73, dauer: 12 }, { midi: 48, dauer: 24, bindung: true }, { midi: 48, dauer: 24 }] },
      { noten: [{ midi: null, dauer: 24 }, { midi: 62, dauer: 8, triole: true, gruppe: 3 }, { midi: 64, dauer: 8, triole: true }, { midi: 66, dauer: 8, triole: true }, { midi: 84, dauer: 48 }] },
      { noten: [{ midi: 70, dauer: 96, bindung: true }] },
      { noten: [{ midi: 70, dauer: 48 }, { midi: null, dauer: 24 }, { midi: null, dauer: 24 }] },
    ];
    const abc = alsAbc(takte, B, { titel: 'Rundreise' }, tonartFinden('D'));
    const g = abcLesen(abc)!;
    expect(g.titel).toBe('Rundreise');
    expect(g.raster).toEqual(B);
    expect(g.tonart?.abc).toBe('D');
    expect(g.takte).toEqual(takte);
  });
  it('liest B-Tonarten und Auflösungszeichen, ohne Tonart C-Dur', () => {
    const takte: Takt[] = [{ noten: [{ midi: 70, dauer: 24 }, { midi: 71, dauer: 24 }, { midi: 70, dauer: 24 }, { midi: 63, dauer: 24 }] }];
    const abc = alsAbc(takte, B, { titel: '' }, tonartFinden('F'));
    expect(abc).toContain('B24 =B24 _B24 _E24 |]');
    expect(ohne(abcLesen(abc)!.takte)).toEqual(takte);
    const c = abcLesen(alsAbc(takte, B, { titel: '' }, null))!;
    expect(c.tonart?.abc).toBe('C');
    expect(ohne(c.takte)).toEqual(takte);
  });
  it('liest ältere Stücke mit L:1/16 und 6/8', () => {
    const takte: Takt[] = [{ noten: [{ midi: 60, dauer: 3 }, { midi: 62, dauer: 3 }, { midi: null, dauer: 6 }] }];
    const g = abcLesen(alsAbc(takte, { bpm: 60, zaehler: 6, nenner: 8, feinheit: 16 }, { titel: 'Alt' }))!;
    expect(g.raster).toEqual({ bpm: 60, zaehler: 6, nenner: 8, feinheit: 16 });
    expect(ohne(g.takte)).toEqual(takte);
  });
  it('weist Fremdes ab', () => {
    expect(abcLesen('')).toBeNull();
    expect(abcLesen('X:1\nT:Nur Kopf\n')).toBeNull();
    expect(abcLesen('X:1\nM:4/4\nL:1/16\nK:C\n[CEG]4 |]')).toBeNull();
  });
});

describe('Seiten nach dem Neuschreiben', () => {
  it('lässt wegfallen, was über der neuen Seitenzahl liegt', () => {
    const l = (ids: [string, number][]) => ids.map(([id, seite]) => ({ id, seite }));
    expect(ueberzaehlig(2, { stellen: l([['s1', 1], ['s2', 2], ['s3', 3]]), anmerkungen: l([['a2', 2], ['a4', 4]]), lesezeichen: l([['l5', 5]]), merker: l([['m1', 1]]) }))
      .toEqual({ stellen: ['s3'], anmerkungen: ['a4'], lesezeichen: ['l5'], merker: [] });
  });
});

describe('Titel im ABC', () => {
  it('tauscht die T:-Zeile oder setzt sie hinter X:', () => {
    expect(abcMitTitel('X:1\nT:Alt\nK:C\nC4 |]', 'Neu')).toBe('X:1\nT:Neu\nK:C\nC4 |]');
    expect(abcMitTitel('X:1\nK:C\nC4 |]', ' Neu ')).toBe('X:1\nT:Neu\nK:C\nC4 |]');
    expect(abcMitTitel('X:1\nT:Alt\nK:C\nC4 |]', '')).toContain('T:Ohne Titel');
  });
});
