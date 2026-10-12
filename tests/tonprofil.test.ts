import { describe, expect, it } from 'vitest';
import {
  kennzahlen, MESS_ANZAHL, messen, profileLesen, profileVereinigen, tonleiterHinweise, tonName, tonReihe, vergleich, type Tonprofil,
} from '@/domain/tonprofil';
import { frequenzZuTon } from '@/domain/ueben';

const profil = (toene: [number, number][], mehr: Partial<Tonprofil> = {}): Tonprofil =>
  ({ id: 'p', am: 1, stimmung: 'B', kammerton: 442, toene: toene.map(([midi, cent]) => ({ midi, cent })), ...mehr });

describe('Töne benennen und auflisten', () => {
  it('Name mit Oktave wie im Stimmgerät', () => {
    expect(tonName(60)).toBe('C4');
    expect(tonName(66)).toBe('Fis4');
    expect(tonName(70)).toBe('B4');
    expect(tonName(71)).toBe('H4');
  });
  it('chromatische Reihe vom tiefsten bis zum höchsten Ton', () => {
    expect(tonReihe(60, 64)).toEqual([60, 61, 62, 63, 64]);
    expect(tonReihe(64, 60)).toEqual([60, 61, 62, 63, 64]);
  });
  it('das Stimmgerät liefert den notierten Ton als Zahl', () => {
    expect(frequenzZuTon(442 * 2 ** (1 / 12), 442, 'B')?.midi).toBe(72); // klingendes B4 = notiert C5 auf der B-Klarinette
  });
});

describe('Messen: genug ruhige Werte des gesuchten Tons, dann der Median', () => {
  it('sammelt nur den gesuchten Ton, Stille und andere Töne zählen nicht', () => {
    let w: number[] = [];
    let r = messen(w, { midi: 61, cent: 30 }, 60); w = r.werte;
    r = messen(w, null, 60); w = r.werte;
    r = messen(w, { midi: 60, cent: 8 }, 60); w = r.werte;
    expect(w).toEqual([8]);
    expect(r.ergebnis).toBeNull();
  });
  it('nach MESS_ANZAHL Werten: Median (Ansatz und Ausreißer zählen kaum)', () => {
    let w: number[] = [];
    let ergebnis: number | null = null;
    const werte = [-30, 12, 11, 13, 12, 40, ...Array(MESS_ANZAHL).fill(12)];
    for (const cent of werte) {
      const r = messen(w, { midi: 60, cent }, 60);
      w = r.werte;
      if (r.ergebnis !== null) { ergebnis = r.ergebnis; break; }
    }
    expect(ergebnis).toBe(12);
  });
});

describe('Auswerten', () => {
  const p = profil([[60, 2], [61, 18], [62, -4], [63, -12], [64, 6], [65, 0]]);
  it('Kennzahlen: mittlere Abweichung, wie viele sauber (±5), die auffälligsten zuerst', () => {
    expect(kennzahlen(p)).toEqual({
      anzahl: 6, mittel: 7, sauber: 3,
      auffaellig: [{ midi: 61, cent: 18 }, { midi: 63, cent: -12 }, { midi: 64, cent: 6 }],
    });
  });
  it('Vergleich mit einem älteren Profil: je gemeinsamem Ton, besser = näher an 0', () => {
    const alt = profil([[60, 10], [61, 12], [66, 5]]);
    expect(vergleich(p, alt)).toEqual([
      { midi: 60, neu: 2, alt: 10, besser: true },
      { midi: 61, neu: 18, alt: 12, besser: false },
    ]);
  });
});

describe('Tonleiter sauber spielen', () => {
  // Klarinette notiert ab E3 (52) bis C6 (84); F-Dur (Grundton F = 5)
  const p = profil([[53, 8], [55, -2], [57, 3], [58, -9], [60, 0], [62, 4], [64, 12], [65, 1]]);
  it('je Stufe die Neigung des Instruments und die Terz-Regel im Akkord', () => {
    const h = tonleiterHinweise(p, 5, 'dur');
    expect(h.map((x) => x.name)).toEqual(['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4']);
    expect(h[0]).toMatchObject({ stufe: 1, cent: 8, hinweis: 'neigt zu hoch (+8) — tiefer ansetzen' });
    expect(h[1]).toMatchObject({ stufe: 2, cent: -2, hinweis: 'sitzt' });
    // A3 liegt bei +3, als Dur-Terz soll er −14 klingen: etwa 17 tiefer
    expect(h[2]).toMatchObject({ stufe: 3, akkord: 'als Terz im Dur-Akkord etwa 14 Cent tiefer als angezeigt — mit deinen +3 also etwa 17 tiefer ansetzen' });
    expect(h[3]).toMatchObject({ stufe: 4, hinweis: 'neigt zu tief (−9) — höher ansetzen, gut stützen' });
    expect(h[4]).toMatchObject({ stufe: 5, akkord: 'als Quinte praktisch wie angezeigt' });
  });
  it('Moll: Terz höher; Töne außerhalb des Profils ohne Neigung', () => {
    const h = tonleiterHinweise(p, 9, 'moll'); // a-Moll ab A3
    expect(h[0].name).toBe('A3');
    expect(h[2]).toMatchObject({ stufe: 3, name: 'C4', akkord: 'als Terz im Moll-Akkord etwa 16 Cent höher als angezeigt — mit deinen 0 also etwa 16 höher ansetzen' });
    expect(h[7]).toMatchObject({ name: 'A4', cent: null, hinweis: 'noch nicht gemessen' });
  });
  it('Terz, die schon passt bzw. noch nicht gemessen ist', () => {
    expect(tonleiterHinweise(profil([[60, 0], [64, -12]]), 0, 'dur')[2].akkord).toBe('als Terz im Dur-Akkord etwa 14 Cent tiefer als angezeigt — mit deinen −12 passt das schon');
    expect(tonleiterHinweise(profil([[60, 0]]), 0, 'dur')[2].akkord).toBe('als Terz im Dur-Akkord etwa 14 Cent tiefer als angezeigt');
  });
  it('Grundton nicht im Profil: leer', () => {
    expect(tonleiterHinweise(profil([[60, 0]]), 6, 'dur')).toEqual([]);
  });
});

describe('Profile speichern und übertragen', () => {
  it('liest nur stimmige Profile, neueste zuerst', () => {
    const gut = profil([[60, 2]], { id: 'a', am: 5 });
    const neuer = profil([[61, 3]], { id: 'b', am: 9 });
    expect(profileLesen([gut, { id: 'x' }, neuer, { ...gut, toene: [{ midi: 'C', cent: 1 }] }, null]).map((x) => x.id)).toEqual(['b', 'a']);
    expect(profileLesen('kaputt')).toEqual([]);
  });
  it('vereinigt nach id; gelöschte bleiben weg', () => {
    const a = profil([], { id: 'a', am: 1 }), b = profil([], { id: 'b', am: 2 }), c = profil([], { id: 'c', am: 3 });
    expect(profileVereinigen([a, b], [b, c], [{ art: 'tonprofil', id: 'a', am: 9 }]).map((x) => x.id)).toEqual(['c', 'b']);
  });
});
