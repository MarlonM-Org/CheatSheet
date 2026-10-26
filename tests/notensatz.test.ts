import { describe, expect, it } from 'vitest';
import { tonartFinden, type Raster, type Takt } from '@/domain/notation';
import {
  angebunden, bogenUmschalten, dauerSetzen, klaenge, leererTakt, leeresBlatt, legen, leiterSchritt, leiterVerschieben, letzteHoehe, noteSchreiben,
  notenZeiten, paletteWerte, punktiert, strecken, taktEinfuegen, taktLoeschen, tonSetzen, verschieben,
} from '@/domain/notensatz';

const R: Raster = { bpm: 120, zaehler: 4, nenner: 4, feinheit: 16 };
const SECHSACHTEL: Raster = { bpm: 60, zaehler: 6, nenner: 8, feinheit: 16 };
const takt = (...noten: [number | null, number, boolean?][]): Takt => ({ noten: noten.map(([midi, dauer, b]) => (b ? { midi, dauer, bindung: true } : { midi, dauer })) });
const kurz = (t: Takt) => t.noten.map((n) => `${n.midi ?? 'z'}/${n.dauer}${n.bindung ? '-' : ''}`).join(' ');

describe('Strecken und Legen', () => {
  it('fasst gebundene gleiche Noten zu einer Strecke zusammen, Bogen über den Taktstrich bleibt', () => {
    const t = takt([60, 4, true], [60, 2], [null, 2], [62, 8, true]);
    expect(strecken(t)).toEqual([{ midi: 60, dauer: 6 }, { midi: null, dauer: 2 }, { midi: 62, dauer: 8, bindung: true }]);
    expect(kurz(legen(strecken(t), R))).toBe('60/6 z/2 62/8-');
  });
  it('legt eine Strecke in erlaubte Werte, Pausen ohne Punktierung', () => {
    expect(kurz(legen([{ midi: 60, dauer: 12 }, { midi: null, dauer: 4 }], R))).toBe('60/12 z/4');
    expect(kurz(legen([{ midi: null, dauer: 6 }, { midi: 60, dauer: 10 }], R))).toBe('z/4 z/2 60/2- 60/8');
  });
  it('leerer Takt ist eine ganze Pause', () => {
    expect(kurz(leererTakt(R))).toBe('z/16');
    expect(kurz(leererTakt(SECHSACHTEL))).toBe('z/12');
    expect(leeresBlatt(R)).toHaveLength(1);
  });
});

describe('Tonhöhe', () => {
  it('Leiterschritte ohne Tonart in C-Dur, mit Tonart auf deren Leiter', () => {
    expect(leiterSchritt(60, 1, null)).toBe(62);
    expect(leiterSchritt(64, 1, null)).toBe(65);
    expect(leiterSchritt(60, -1, null)).toBe(59);
    expect(leiterSchritt(61, 1, null)).toBe(62); // Cis: zum nächsten Leiterton
    expect(leiterSchritt(61, -1, null)).toBe(60);
    expect(leiterSchritt(60, 7, null)).toBe(72);
    expect(leiterSchritt(62, 1, tonartFinden('D'))).toBe(64);
    expect(leiterSchritt(64, 1, tonartFinden('D'))).toBe(66);
  });
  it('verschiebt um Halbtöne und Oktaven, Pausen nicht, nicht aus dem Umfang', () => {
    const t = [takt([60, 8], [null, 8])];
    expect(kurz(verschieben(t, R, { takt: 0, note: 0 }, 1)[0])).toBe('61/8 z/8');
    expect(kurz(verschieben(t, R, { takt: 0, note: 0 }, 12)[0])).toBe('72/8 z/8');
    expect(kurz(verschieben(t, R, { takt: 0, note: 1 }, 1)[0])).toBe('60/8 z/8');
    expect(kurz(verschieben([takt([107, 16])], R, { takt: 0, note: 0 }, 12)[0])).toBe('107/16');
  });
  it('nimmt gebundene Noten mit — auch über den Taktstrich', () => {
    const t = [takt([null, 8], [60, 8, true]), takt([60, 4], [62, 12])];
    const neu = verschieben(t, R, { takt: 1, note: 0 }, 2);
    expect(kurz(neu[0])).toBe('z/8 62/8-');
    expect(kurz(neu[1])).toBe('62/4 62/4- 62/8'); // zwei Einsätze, keine Bindung
    const diatonisch = leiterVerschieben(t, R, { takt: 0, note: 1 }, -1, null);
    expect(kurz(diatonisch[0])).toBe('z/8 59/8-');
    expect(kurz(diatonisch[1])).toBe('59/4 62/4- 62/8');
  });
  it('setzt eine Höhe, macht Pausen zu Noten und Noten zu Pausen (Bögen lösen sich)', () => {
    const t = [takt([60, 16, true]), takt([60, 8], [64, 8])];
    expect(kurz(tonSetzen(t, R, { takt: 0, note: 0 }, 67)[1])).toBe('67/8 64/8');
    const pause = tonSetzen(t, R, { takt: 1, note: 0 }, null);
    expect(kurz(pause[0])).toBe('60/16');
    expect(kurz(pause[1])).toBe('z/8 64/8');
    expect(kurz(tonSetzen([takt([null, 16])], R, { takt: 0, note: 0 }, 65)[0])).toBe('65/16');
  });
  it('Höhe für eine neue Note: die vorige, sonst die nächste, sonst C4', () => {
    const t = [takt([null, 8], [67, 8]), takt([null, 16])];
    expect(letzteHoehe(t, { takt: 1, note: 0 })).toBe(67);
    expect(letzteHoehe(t, { takt: 0, note: 0 })).toBe(67);
    expect(letzteHoehe([takt([null, 16])], { takt: 0, note: 0 })).toBe(60);
  });
});

describe('Notenwert', () => {
  it('kürzer: eine Pause füllt auf', () => {
    expect(kurz(dauerSetzen([takt([60, 16])], R, { takt: 0, note: 0 }, 4)[0])).toBe('60/4 z/4 z/8');
  });
  it('länger: frisst die folgenden Noten, eine angeschnittene behält ihren Rest', () => {
    const t = [takt([60, 4], [62, 4], [64, 8])];
    expect(kurz(dauerSetzen(t, R, { takt: 0, note: 0 }, 8)[0])).toBe('60/8 64/8');
    expect(kurz(dauerSetzen(t, R, { takt: 0, note: 0 }, 12)[0])).toBe('60/12 64/4');
  });
  it('geht nicht über den Taktstrich, löst einen Bogen, der nicht mehr passt', () => {
    const t = [takt([60, 8], [62, 8, true]), takt([62, 16])];
    const neu = dauerSetzen(t, R, { takt: 0, note: 0 }, 16);
    expect(kurz(neu[0])).toBe('60/16');
    expect(kurz(neu[1])).toBe('62/16');
    const gleich = dauerSetzen([takt([62, 8], [62, 8, true]), takt([62, 16])], R, { takt: 0, note: 0 }, 16);
    expect(kurz(gleich[0])).toBe('62/16-');
  });
  it('Note schreiben: Wert und Höhe an der Stelle, Auswahl rückt zur nächsten Note', () => {
    const blatt = leeresBlatt(R);
    const a = noteSchreiben(blatt, R, { takt: 0, note: 0 }, 60, 4);
    expect(kurz(a.takte[0])).toBe('60/4 z/4 z/8');
    expect(a.naechste).toEqual({ takt: 0, note: 1 });
    const b = noteSchreiben(a.takte, R, a.naechste!, 62, 4);
    expect(kurz(b.takte[0])).toBe('60/4 62/4 z/8');
    const c = noteSchreiben(b.takte, R, b.naechste!, 64, 8);
    expect(kurz(c.takte[0])).toBe('60/4 62/4 64/8');
    expect(c.naechste).toBeNull();
    const d = noteSchreiben(taktEinfuegen(c.takte, R, 0), R, { takt: 0, note: 2 }, 65, 4);
    expect(kurz(d.takte[0])).toBe('60/4 62/4 65/4 z/4');
    expect(d.naechste).toEqual({ takt: 0, note: 3 });
  });
  it('Palette: Werte, die in den Takt passen, und Punktierung', () => {
    expect(paletteWerte(R).map((w) => w.name)).toEqual(['Ganze', 'Halbe', 'Viertel', 'Achtel', 'Sechzehntel']);
    expect(paletteWerte(SECHSACHTEL).map((w) => w.zellen)).toEqual([8, 4, 2, 1]);
    expect(paletteWerte({ ...R, feinheit: 8 }).map((w) => w.zellen)).toEqual([8, 4, 2, 1]);
    expect(punktiert(4, R)).toBe(6);
    expect(punktiert(1, R)).toBeNull();
  });
});

describe('Bogen', () => {
  it('erkennt angebundene Noten im Takt und über den Taktstrich', () => {
    const t = [takt([60, 8, true], [60, 8, true]), takt([60, 4], [62, 12])];
    expect(angebunden(t, { takt: 0, note: 0 })).toBe(false);
    expect(angebunden(t, { takt: 0, note: 1 })).toBe(true);
    expect(angebunden(t, { takt: 1, note: 0 })).toBe(true);
    expect(angebunden(t, { takt: 1, note: 1 })).toBe(false);
  });
  it('löst: die Note wird ein eigener Einsatz', () => {
    const t = [takt([60, 8, true], [60, 8, true]), takt([60, 4], [62, 12])];
    expect(kurz(bogenUmschalten(t, R, { takt: 0, note: 1 })[0])).toBe('60/8 60/8-');
    const neu = bogenUmschalten(t, R, { takt: 1, note: 0 });
    expect(kurz(neu[0])).toBe('60/16');
    expect(kurz(neu[1])).toBe('60/4 62/12');
  });
  it('bindet an die vorige Note (nimmt deren Höhe), nicht an Pausen', () => {
    const t = [takt([60, 8], [62, 8]), takt([64, 16])];
    expect(kurz(bogenUmschalten(t, R, { takt: 0, note: 1 })[0])).toBe('60/16');
    const ueber = bogenUmschalten(t, R, { takt: 1, note: 0 });
    expect(kurz(ueber[0])).toBe('60/8 62/8-');
    expect(kurz(ueber[1])).toBe('62/16');
    const pause = [takt([null, 8], [62, 8])];
    expect(kurz(bogenUmschalten(pause, R, { takt: 0, note: 1 })[0])).toBe('z/8 62/8');
    expect(kurz(bogenUmschalten(pause, R, { takt: 0, note: 0 })[0])).toBe('z/8 62/8');
  });
});

describe('Takte', () => {
  it('fügt leere Takte ein und löscht; der letzte wird leer, Bögen ins Gelöschte lösen sich', () => {
    const t = [takt([60, 16, true]), takt([60, 16]), takt([62, 16])];
    expect(taktEinfuegen(t, R, 0).map(kurz)).toEqual(['60/16-', 'z/16', '60/16', '62/16']);
    expect(taktLoeschen(t, R, 1).map(kurz)).toEqual(['60/16', '62/16']);
    expect(taktLoeschen(t, R, 2).map(kurz)).toEqual(['60/16-', '60/16']);
    expect(taktLoeschen([takt([60, 16])], R, 0).map(kurz)).toEqual(['z/16']);
  });
});

describe('Vorspielen', () => {
  it('macht aus Noten Klänge in Sekunden, gebundene Noten als einen, Pausen stumm', () => {
    const t = [takt([60, 4], [null, 4], [62, 8, true]), takt([62, 8], [64, 8])];
    expect(klaenge(t, R)).toEqual([
      { beginn: 0, dauer: 0.5, midi: 60 },
      { beginn: 1, dauer: 2, midi: 62 },
      { beginn: 3, dauer: 1, midi: 64 },
    ]);
    const z = notenZeiten(t, R);
    expect(z.zeiten).toEqual([0, 0.5, 1, 2, 3]);
    expect(z.gesamt).toBe(4);
  });
});
