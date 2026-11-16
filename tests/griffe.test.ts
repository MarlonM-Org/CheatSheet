import { describe, expect, it } from 'vitest';
import {
  alleGriffe, BEREICH, griffLesen, griffeFuer, lageVon, LAGE_NAMEN, standardGriff, TASTEN, tonAusName, trillerFuer, type Taste,
} from '@/domain/griffe';

const BEKANNT = new Set<string>(TASTEN.map((t) => t.id));

describe('Grifftabelle: Umfang', () => {
  it('jeder notierte Ton E3 bis C7 hat genau einen Standardgriff', () => {
    expect(BEREICH).toEqual({ von: 52, bis: 96 });
    for (let m = 52; m <= 96; m++) {
      const standard = griffeFuer(m).filter((g) => g.art === 'standard');
      expect(standard, `MIDI ${m}`).toHaveLength(1);
      expect(standardGriff(m)?.midi).toBe(m);
    }
  });
  it('außerhalb des Umfangs: nichts', () => {
    expect(griffeFuer(51)).toEqual([]);
    expect(griffeFuer(97)).toEqual([]);
    expect(standardGriff(40)).toBeNull();
  });
  it('Standard zuerst, dann Alternativen, dann Triller', () => {
    for (let m = 52; m <= 96; m++) {
      const arten = griffeFuer(m).map((g) => g.art);
      const rang = { standard: 0, alternative: 1, triller: 2 } as const;
      expect([...arten].sort((a, b) => rang[a] - rang[b])).toEqual(arten);
    }
  });
});

describe('Grifftabelle: gültige Daten', () => {
  it('nur bekannte Tasten, keine doppelt', () => {
    for (const g of alleGriffe()) {
      for (const t of g.tasten) expect(BEKANNT.has(t), `${g.wfg}: ${t}`).toBe(true);
      expect(new Set(g.tasten).size).toBe(g.tasten.length);
    }
  });
  it('keine Widersprüche: Sliver nur bei offenem Loch daneben', () => {
    for (const g of alleGriffe()) {
      const hat = (t: Taste) => g.tasten.includes(t);
      if (hat('esSliver')) expect(hat('l3'), g.wfg).toBe(false);
      if (hat('hSliver')) expect(hat('r2'), g.wfg).toBe(false);
    }
  });
  it('Überblasklappe genau ab dem Clarion (B4/H4), nie darunter', () => {
    for (const g of alleGriffe()) {
      if (g.midi < 70) expect(g.tasten.includes('register'), g.wfg).toBe(false);
      if (g.midi >= 71) expect(g.tasten.includes('register'), g.wfg).toBe(true);
    }
  });
  it('Triller: nennt Zielton darüber und bewegte Tasten', () => {
    const triller = alleGriffe().filter((g) => g.art === 'triller');
    expect(triller.length).toBeGreaterThanOrEqual(8);
    for (const g of triller) {
      expect(g.nach).toBeGreaterThan(g.midi);
      expect(g.nach! - g.midi).toBeLessThanOrEqual(2);
      expect(g.triller?.length).toBeGreaterThan(0);
      for (const t of g.triller!) expect(BEKANNT.has(t)).toBe(true);
    }
  });
  it('jede Alternative hat einen Hinweis', () => {
    for (const g of alleGriffe()) if (g.art !== 'standard') expect(g.hinweis, g.wfg).toBeTruthy();
  });
  it('kein Griff doppelt je Ton', () => {
    for (let m = 52; m <= 96; m++) {
      const schluessel = griffeFuer(m).map((g) => `${g.art}:${[...g.tasten].sort().join(',')}:${(g.triller ?? []).join(',')}`);
      expect(new Set(schluessel).size).toBe(schluessel.length);
    }
  });
});

describe('WFG-Schreibweise lesen', () => {
  it('Chalumeau und Kehltöne', () => {
    expect(griffLesen('T 123|123').sort()).toEqual(['daumen', 'l1', 'l2', 'l3', 'r1', 'r2', 'r3'].sort());
    expect(griffLesen('T 123E|123')).toContain('lE');
    expect(griffLesen('T 123|123E')).toContain('rE');
    expect(griffLesen('T 123F#|123')).toContain('lFis');
    expect(griffLesen('T 123|123G#')).toContain('rGis');
    expect(griffLesen('T 12-|4---').sort()).toEqual(['daumen', 'l1', 'l2', 's4'].sort());
    expect(griffLesen('T 12Eb-|---').sort()).toEqual(['daumen', 'l1', 'l2', 'esSliver'].sort());
    expect(griffLesen('R A---|---').sort()).toEqual(['a', 'register'].sort());
    expect(griffLesen('G#---|---')).toEqual(['gis']);
    expect(griffLesen('---|---')).toEqual([]);
    expect(griffLesen('T ---|34---').sort()).toEqual(['daumen', 's3', 's4'].sort());
  });
  it('Gabel- und Sliver-Griffe, Altissimo', () => {
    expect(griffLesen('RT 123|1-B-').sort()).toEqual(['daumen', 'register', 'l1', 'l2', 'l3', 'r1', 'hSliver'].sort());
    expect(griffLesen('RT -23C#|---G#').sort()).toEqual(['daumen', 'register', 'l2', 'l3', 'lCis', 'rGis'].sort());
    expect(griffLesen('RT G#12-|12-').sort()).toEqual(['daumen', 'register', 'gis', 'l1', 'l2', 'r1', 'r2'].sort());
    expect(griffLesen('RT 123|4123').sort()).toEqual(['daumen', 'register', 'l1', 'l2', 'l3', 's4', 'r1', 'r2', 'r3'].sort());
    expect(griffLesen('R ---|12-F#').sort()).toEqual(['register', 'r1', 'r2', 'rFis'].sort());
  });
  it('Unbekanntes wirft', () => {
    expect(() => griffLesen('T 12X|---')).toThrow();
    expect(() => griffLesen('T 123')).toThrow();
    expect(() => griffLesen('T 123G#|123')).toThrow(); // linke As/Es-Klappe hat das 17/6-Modell nicht
  });
});

describe('Lagen (Register)', () => {
  it('Chalumeau, Kehltöne, Clarion, Altissimo', () => {
    expect(lageVon(52)).toBe('chalumeau');
    expect(lageVon(66)).toBe('chalumeau');
    expect(lageVon(67)).toBe('kehltoene');
    expect(lageVon(70)).toBe('kehltoene');
    expect(lageVon(71)).toBe('clarion');
    expect(lageVon(84)).toBe('clarion');
    expect(lageVon(85)).toBe('altissimo');
    expect(lageVon(96)).toBe('altissimo');
    expect(LAGE_NAMEN.kehltoene).toBe('Kehltöne');
  });
});

describe('Ton aus Namen (enharmonisch)', () => {
  it('deutsche Namen', () => {
    expect(tonAusName('E3')).toBe(52);
    expect(tonAusName('Fis4')).toBe(66);
    expect(tonAusName('Ges4')).toBe(66);
    expect(tonAusName('B4')).toBe(70);
    expect(tonAusName('Ais4')).toBe(70);
    expect(tonAusName('H4')).toBe(71);
    expect(tonAusName('Ces5')).toBe(71);
    expect(tonAusName('His4')).toBe(72);
    expect(tonAusName('Es5')).toBe(75);
    expect(tonAusName('Dis5')).toBe(75);
    expect(tonAusName('As6')).toBe(92);
    expect(tonAusName('Gis6')).toBe(92);
    expect(tonAusName('c7')).toBe(96);
  });
  it('englische Vorzeichen', () => {
    expect(tonAusName('F#4')).toBe(66);
    expect(tonAusName('Gb4')).toBe(66);
    expect(tonAusName('B♭4')).toBe(70);
    expect(tonAusName('A♯4')).toBe(70);
    expect(tonAusName('Eb5')).toBe(75);
  });
  it('Unsinn: null', () => {
    expect(tonAusName('X4')).toBeNull();
    expect(tonAusName('Fis')).toBeNull();
    expect(tonAusName('')).toBeNull();
  });
  it('enharmonisch gleiche Namen liefern dieselben Griffe', () => {
    expect(griffeFuer(tonAusName('Fis4')!)).toEqual(griffeFuer(tonAusName('Ges4')!));
    expect(standardGriff(tonAusName('Gis3')!)).toEqual(standardGriff(tonAusName('As3')!));
  });
});

describe('Bekannte Griffe (Stichproben gegen WFG)', () => {
  const standard = (m: number) => [...standardGriff(m)!.tasten].sort();
  it('Chalumeau und Kehltöne', () => {
    expect(standard(55)).toEqual(['daumen', 'l1', 'l2', 'l3', 'r1', 'r2', 'r3'].sort()); // G3
    expect(standard(65)).toEqual(['daumen']); // F4
    expect(standard(66)).toEqual(['l1']); // Fis4
    expect(standard(67)).toEqual([]); // G4 offen
    expect(standard(69)).toEqual(['a']); // A4
    expect(standard(70)).toEqual(['a', 'register'].sort()); // B4
  });
  it('Clarion: Duodezime über dem Chalumeau', () => {
    for (let m = 52; m <= 63; m++) {
      const unten = standard(m);
      const oben = standard(m + 19);
      expect(oben, `MIDI ${m + 19}`).toEqual([...unten, 'register'].sort());
    }
  });
  it('Altissimo', () => {
    expect(standard(85)).toEqual(['daumen', 'register', 'l2', 'l3', 'r1', 'r2'].sort()); // Cis6
    expect(standard(88)).toEqual(['daumen', 'register', 'l2', 'l3', 'rGis'].sort()); // E6
    expect(standard(89)).toEqual(['daumen', 'register', 'l2', 'l3', 'lCis', 'rGis'].sort()); // F6
  });
  it('Triller A–H im Übergang: A-Klappe, Seitenklappe 1', () => {
    const t = trillerFuer(69).find((g) => g.nach === 71);
    expect(t?.tasten.sort()).toEqual(['a', 's1']);
    expect(t?.triller).toEqual(['s1']);
  });
  it('Seitenklappen-B als Alternative', () => {
    expect(griffeFuer(70).some((g) => g.art === 'alternative' && g.tasten.includes('s2') && g.tasten.includes('a'))).toBe(true);
  });
});
