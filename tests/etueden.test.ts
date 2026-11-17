import { describe, expect, it } from 'vitest';
import abcjs from 'abcjs';
import { tonDeutsch, tonKlasse } from '@/domain/akkorde';
import {
  abschnitteAbc, abschnitteKlaenge, abschnittTakte, etuedeBauen, etuedenToene, grundFuer, lageWaehlen, MUSTER, OBERE_GRENZEN,
  REIHENFOLGEN, RHYTHMEN, TAKT, TICKS, tonartFolge, triolenFehler, UMFANG, type EtuedenWahl, type MusterId,
} from '@/domain/etueden';

const namen = (w: Partial<EtuedenWahl> & { muster: MusterId }, nr = 0) =>
  etuedeBauen({ reihenfolge: 'eine', start: 0, rhythmus: 'achtel', ...w }).abschnitte[nr].ereignisse.filter((e) => e.ton).map((e) => tonDeutsch(e.ton!));

describe('Tonarten-Folge', () => {
  it('Quintenzirkel, Quartenzirkel, chromatisch, eine', () => {
    expect(tonartFolge('quinten', 0)).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]);
    expect(tonartFolge('quarten', 0)).toEqual([0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7]);
    expect(tonartFolge('chromatisch', 10)).toEqual([10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tonartFolge('eine', 3)).toEqual([3]);
  });
  it('Grundton mit wenigen Vorzeichen, Gleichstand nach Vorliebe', () => {
    expect(tonDeutsch(grundFuer(1, false))).toBe('Des');
    expect(tonDeutsch(grundFuer(8, true))).toBe('Gis');
    expect(tonDeutsch(grundFuer(6, false, 'kreuz'))).toBe('Fis');
    expect(tonDeutsch(grundFuer(6, false, 'be'))).toBe('Ges');
    expect(tonDeutsch(grundFuer(10, false))).toBe('B');
  });
  it('Quintenzirkel schreibt Fis-Dur, Quartenzirkel Ges-Dur', () => {
    expect(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'quinten', start: 0, rhythmus: 'achtel' }).abschnitte[6].titel).toBe('Fis-Dur');
    expect(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'quarten', start: 0, rhythmus: 'achtel' }).abschnitte[6].titel).toBe('Ges-Dur');
  });
});

describe('Muster und Schreibweise', () => {
  it('Dur-Tonleiter auf und ab', () => {
    expect(namen({ muster: 'tonleiter' })).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'H', 'C', 'H', 'A', 'G', 'F', 'E', 'D', 'C']);
    expect(namen({ muster: 'tonleiter', start: 6, reihenfolge: 'eine' })).toContain('Ces');
    expect(namen({ muster: 'tonleiter', start: 6, reihenfolge: 'quinten' })).toContain('Eis');
  });
  it('Arpeggien', () => {
    expect(namen({ muster: 'dreiklangDur', start: 3 })).toEqual(['Es', 'G', 'B', 'Es', 'B', 'G', 'Es']);
    expect(namen({ muster: 'dreiklangMoll', start: 8 })).toEqual(['Gis', 'H', 'Dis', 'Gis', 'Dis', 'H', 'Gis']);
    expect(namen({ muster: 'maj7', start: 5 })).toEqual(['F', 'A', 'C', 'E', 'F', 'E', 'C', 'A', 'F']);
    expect(namen({ muster: 'dom7', start: 7 })).toEqual(['G', 'H', 'D', 'F', 'G', 'F', 'D', 'H', 'G']);
    expect(namen({ muster: 'moll7', start: 2 })).toEqual(['D', 'F', 'A', 'C', 'D', 'C', 'A', 'F', 'D']);
    expect(namen({ muster: 'halbvermindert', start: 11 })).toEqual(['H', 'D', 'F', 'A', 'H', 'A', 'F', 'D', 'H']);
  });
  it('1-2-3-5', () => {
    expect(namen({ muster: 'muster1235', start: 2 })).toEqual(['D', 'E', 'Fis', 'A', 'D', 'A', 'Fis', 'E', 'D']);
  });
  it('Guide Tones: Terz → Septime → Terz und Septime → Terz → Septime auf der Eins', () => {
    const e = etuedeBauen({ muster: 'guideTones', reihenfolge: 'eine', start: 0, rhythmus: 'viertel' }).abschnitte[0];
    expect(e.ereignisse.map((x) => tonDeutsch(x.ton!))).toEqual(['F', 'A', 'C', 'E', 'F', 'D', 'H', 'G', 'E', 'C', 'A', 'F', 'D', 'H', 'D', 'F', 'A', 'H']);
    expect(e.ereignisse.filter((x) => x.akkord).map((x) => x.akkord)).toEqual(['Dm7', 'G7', 'Cmaj7', 'Dm7', 'G7', 'Cmaj7']);
    // Stimmführung: 9 → 7 Halbton aufwärts, 1 → 3 kleine Terz abwärts.
    const m = e.ereignisse.map((x) => x.midi);
    expect(m[4] - m[3]).toBe(1);
    expect(m[8] - m[7]).toBe(-3);
    expect(m[17] - m[16]).toBe(2);
    expect(namen({ muster: 'guideTones', start: 6, reihenfolge: 'quinten' })).toContain('Eis');
  });
  it('Umspielung: Leiterton darüber, Halbton darunter, Ziel', () => {
    const e = etuedeBauen({ muster: 'umspielung', reihenfolge: 'eine', start: 2, rhythmus: 'achtel' }).abschnitte[0].ereignisse;
    expect(e.slice(0, 6).map((x) => tonDeutsch(x.ton!))).toEqual(['E', 'Cis', 'D', 'G', 'Eis', 'Fis']);
    expect(e[0].midi - e[2].midi).toBe(2);
    expect(e[1].midi - e[2].midi).toBe(-1);
    expect(e[2].ticks).toBe(12);
    // Doppelkreuz wird schlicht: Ais in Fis-Dur von A umspielt.
    const fis = etuedeBauen({ muster: 'umspielung', reihenfolge: 'quinten', start: 6, rhythmus: 'triolen' }).abschnitte[0].ereignisse;
    expect(fis.slice(3, 6).map((x) => tonDeutsch(x.ton!))).toEqual(['H', 'A', 'Ais']);
    expect(fis[5].ticks).toBe(4);
  });
  it('Ton und MIDI passen zusammen', () => {
    for (const m of MUSTER) for (const s of [0, 1, 6, 8]) {
      for (const x of etuedenToene(etuedeBauen({ muster: m.id, reihenfolge: 'eine', start: s, rhythmus: 'achtel' }))) {
        expect(((x.midi % 12) + 12) % 12, `${m.id} ${s}`).toBe(tonKlasse(x.ton!));
      }
    }
  });
});

describe('Klarinetten-Umfang', () => {
  it('jeder Ton jedes Musters in allen 12 Tonarten liegt im Umfang (jede obere Grenze)', () => {
    for (const m of MUSTER) for (const r of REIHENFOLGEN) for (const { midi: ober } of OBERE_GRENZEN) for (const rh of RHYTHMEN) {
      const e = etuedeBauen({ muster: m.id, reihenfolge: r, start: 0, rhythmus: rh, ober });
      expect(e.abschnitte).toHaveLength(r === 'eine' ? 1 : 12);
      for (const x of etuedenToene(e)) {
        expect(x.midi, `${m.id} ${r} ${ober}`).toBeGreaterThanOrEqual(UMFANG.von);
        expect(x.midi, `${m.id} ${r} ${ober}`).toBeLessThanOrEqual(ober);
      }
    }
  });
  it('Lage: mittig im Umfang; zu weite Phrasen werden einzeln oktaviert', () => {
    expect(lageWaehlen([0, 4, 7, 12])).toEqual([60, 64, 67, 72]);
    expect(lageWaehlen([0, 30])).toEqual(lageWaehlen([0, 30]).map((x) => Math.min(81, Math.max(52, x))));
    for (const x of lageWaehlen([0, 40], 79)) { expect(x).toBeGreaterThanOrEqual(52); expect(x).toBeLessThanOrEqual(79); }
    // Grenzen sind geklemmt.
    for (const x of lageWaehlen([0, 7, 14], 200)) expect(x).toBeLessThanOrEqual(UMFANG.obenMax);
  });
  it('C-Dur-Tonleiter beginnt auf C4', () => {
    expect(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' }).abschnitte[0].ereignisse[0].midi).toBe(60);
  });
});

describe('Rhythmus und Takte', () => {
  it('jeder Abschnitt füllt ganze Takte; Schlusston füllt auf', () => {
    for (const m of MUSTER) for (const rh of RHYTHMEN) {
      const e = etuedeBauen({ muster: m.id, reihenfolge: 'eine', start: 0, rhythmus: rh });
      expect(triolenFehler(e.abschnitte[0].ereignisse), `${m.id} ${rh}`).toBeNull();
      expect(abschnittTakte(e.abschnitte[0])).toBeGreaterThan(0);
    }
    const t = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' });
    expect(abschnittTakte(t.abschnitte[0])).toBe(2);
    const v = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'viertel' });
    expect(abschnittTakte(v.abschnitte[0])).toBe(4);
  });
  it('Triolen müssen die Zählzeit füllen', () => {
    const c = { stamm: 0, vz: 0 };
    expect(triolenFehler([{ ton: c, midi: 60, ticks: 4 }, { ton: c, midi: 60, ticks: 4 }, { ton: c, midi: 60, ticks: 4 }])).toBeNull();
    expect(triolenFehler([{ ton: c, midi: 60, ticks: 4 }, { ton: c, midi: 60, ticks: 6 }])).not.toBeNull();
  });
});

describe('ABC', () => {
  const pruefen = (abc: string) => {
    const [tune] = abcjs.parseOnly(abc);
    expect(tune.warnings ?? [], abc).toEqual([]);
    return tune;
  };
  it('C-Dur in Achteln: eine Zeile, Titel darüber, Schlusston Viertel', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('L:1/16');
    expect(abc).toContain('"^C-Dur"C2D2E2F2 G2A2B2c2 | B2A2G2F2 E2D2 C4 |]');
    pruefen(abc);
  });
  it('Vorzeichen ausgeschrieben, gelten bis zum Taktstrich', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 2, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('"^D-Dur"D2E2^F2G2 A2B2^c2d2 | ^c2B2A2G2 ^F2E2 D4 |]');
  });
  it('Triolen und gebundener Schlusston', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'triolen' }).abschnitte);
    expect(abc).toContain('(3:2:3');
    expect(abc).toMatch(/C2-\s*C12/);
    pruefen(abc);
  });
  it('alle Muster, Rhythmen und Tonarten ergeben gültiges ABC; ein Abschnitt je Zeile oder umbrochen', () => {
    for (const m of MUSTER) for (const rh of RHYTHMEN) {
      const e = etuedeBauen({ muster: m.id, reihenfolge: 'quinten', start: 0, rhythmus: rh });
      const abc = abschnitteAbc(e.abschnitte);
      for (const t of abcjs.parseOnly(abc)) expect(t.warnings ?? [], abc).toEqual([]);
      // Je Tonart ein Notenbild mit genau einer Notenzeile.
      expect(abc.trim().split('\n').filter((z) => z && !/^[A-Z]:/.test(z)).length).toBe(12);
      for (const t of abcjs.parseOnly(abschnitteAbc(e.abschnitte, { takteJeZeile: 2 }))) expect(t.warnings ?? []).toEqual([]);
    }
  });
  it('Akkordsymbole über den Guide Tones', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'guideTones', reihenfolge: 'eine', start: 10, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('"Cm7"');
    expect(abc).toContain('"F7"');
    expect(abc).toContain('"Bbmaj7"');
  });
});

describe('Klänge', () => {
  it('Vorzählen, Tempo, Klick je Viertel', () => {
    const e = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' });
    const v = abschnitteKlaenge(e.abschnitte, 120);
    expect(v.klaenge).toHaveLength(15);
    expect(v.klaenge[0]).toMatchObject({ beginn: 2, midi: 60 });
    expect(v.klaenge[1].beginn).toBeCloseTo(2.25);
    expect(v.klicks).toHaveLength(4 + 8);
    expect(v.klicks.filter((k) => k.betont).map((k) => k.zeit)).toEqual([0, 2, 4]);
    expect(v.dauer).toBeCloseTo(2 + 4);
    expect(v.klaenge[14].dauer).toBeCloseTo(0.5 * 0.92);
    expect(abschnitteKlaenge(e.abschnitte, 120, { vorzaehlen: 0, klick: false }).klicks).toEqual([]);
  });
  it('mehrere Tonarten hintereinander', () => {
    const e = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'quinten', start: 0, rhythmus: 'achtel' });
    const v = abschnitteKlaenge(e.abschnitte, 60, { vorzaehlen: 0 });
    expect(v.klaenge[15].beginn).toBeCloseTo((2 * TAKT) / TICKS);
  });
});

describe('Einstellung', () => {
  it('Prüfen', async () => {
    const { ETUEDEN_STANDARD, istEtuedenEinstellung } = await import('@/domain/etueden');
    expect(istEtuedenEinstellung(ETUEDEN_STANDARD)).toBe(true);
    expect(istEtuedenEinstellung({ ...ETUEDEN_STANDARD, muster: 'walzer' })).toBe(false);
    expect(istEtuedenEinstellung({ ...ETUEDEN_STANDARD, start: 12 })).toBe(false);
    expect(istEtuedenEinstellung({ ...ETUEDEN_STANDARD, bpm: 20 })).toBe(false);
    expect(istEtuedenEinstellung({ ...ETUEDEN_STANDARD, ober: 96 })).toBe(false);
    expect(istEtuedenEinstellung({ ...ETUEDEN_STANDARD, rhythmus: 'sechzehntel' })).toBe(false);
    expect(istEtuedenEinstellung(null)).toBe(false);
  });
});

// Wunsch Marlon (2026-11-17): Vorzeichen vorne hinter dem Schlüssel — jede
// Tonart ein eigenes Notenbild, damit abcjs keine Auflösungszeichen und keine
// Vorschau-Tonart am Zeilenende setzt —, die Vorzeichen vor den Noten bleiben
// zusätzlich stehen; darüber die klingende Tonart.
describe('Vorzeichen vorne und klingende Tonart', () => {
  const alle = (abc: string) => {
    const tunes = abcjs.parseOnly(abc);
    for (const t of tunes) expect(t.warnings ?? [], abc).toEqual([]);
    return tunes;
  };
  it('jede Tonart ein eigenes Notenbild mit ihrer Tonart; Takt nur beim ersten', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'quinten', start: 0, rhythmus: 'achtel' }).abschnitte);
    expect(alle(abc)).toHaveLength(12);
    expect(abc).toContain('K:C clef=treble');
    expect(abc).toContain('K:A clef=treble');
    expect(abc).toContain('K:Db clef=treble');
    expect(abc.match(/^M:4\/4$/gm)).toHaveLength(1);
    expect(abc.match(/^M:none$/gm)).toHaveLength(11);
    expect(abc.trim().endsWith('|]')).toBe(true);
  });
  it('die Vorzeichen vor den Noten bleiben zusätzlich stehen', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 9, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('K:A clef=treble');
    expect(abc).toMatch(/"\^A-Dur"A,2B,2\^C2D2 E2\^F2\^G2A2/);
  });
  it('ein Stammton, den die Tonart erhöht oder erniedrigt, bekommt ein Auflösungszeichen', () => {
    // F-Dur, Umspielung von C: Halbton darunter ist H — gegen das B der Tonart.
    const abc = abschnitteAbc(etuedeBauen({ muster: 'umspielung', reihenfolge: 'eine', start: 5, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('K:F clef=treble');
    expect(abc).toMatch(/=B|=b/);
    alle(abc);
    // In C-Dur gibt es nichts aufzulösen.
    expect(abschnitteAbc(etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' }).abschnitte)).not.toMatch(/=[A-Ga-g]/);
  });
  it('Moll-Tonarten mit m', () => {
    const abc = abschnitteAbc(etuedeBauen({ muster: 'dreiklangMoll', reihenfolge: 'eine', start: 0, rhythmus: 'achtel' }).abschnitte);
    expect(abc).toContain('K:Cm clef=treble');
  });
  it('über jeder Tonart die klingende — B-Klarinette: notiert E-Dur klingt D-Dur', () => {
    const e = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'eine', start: 4, rhythmus: 'achtel' });
    expect(abschnitteAbc(e.abschnitte, { stimmung: 'B' })).toContain('"^E-Dur · klingt D-Dur"');
    expect(abschnitteAbc(e.abschnitte, { stimmung: 'Es' })).toContain('"^E-Dur · klingt G-Dur"');
    expect(abschnitteAbc(e.abschnitte, { stimmung: 'C' })).toContain('"^E-Dur"E');
    expect(abschnitteAbc(e.abschnitte)).toContain('"^E-Dur"E');
  });
  it('ohne Tonart (Licks) bleibt es ein Notenbild in C', () => {
    const e = etuedeBauen({ muster: 'tonleiter', reihenfolge: 'quinten', start: 0, rhythmus: 'achtel' });
    const abc = abschnitteAbc(e.abschnitte.map((a) => ({ titel: a.titel, ereignisse: a.ereignisse })));
    expect(abcjs.parseOnly(abc)).toHaveLength(1);
    expect(abc).toContain('K:C clef=treble');
    expect(abc).not.toContain('M:none');
  });
});
