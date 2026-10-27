import { describe, expect, it } from 'vitest';
import { tonartFinden, type Raster, type Takt } from '@/domain/notation';
import {
  angebunden, aufBlatt, bogenUmschalten, dauerSetzen, klaenge, leererTakt, leeresBlatt, legen, leiterSchritt, leiterVerschieben, letzteHoehe, noteSchreiben,
  alleNoten, angleichen, aufsBlattStimmen, danachEinfuegen, einfuegen, einstimmig, entfernen, entfernenViele, leiterVerschiebenViele, loeschenImTakt, pausenViele, taktLaenge, taktStimmt, verschiebenViele, wertSetzen, inAllen, inStimme, klaengeAlle, notenZeiten, paletteWerte, punktiert, skalieren, stimmeAendern, stimmeHinzu, stimmeWeg, strecken, taktEinfuegen, taktLoeschen, tonSetzen, triole, verschieben,
} from '@/domain/notensatz';
import { abcLesen, alsAbc, alsAbcStimmen, notenwerte } from '@/domain/notation';

const R: Raster = { bpm: 120, zaehler: 4, nenner: 4, feinheit: 16 };
const SECHSACHTEL: Raster = { bpm: 60, zaehler: 6, nenner: 8, feinheit: 16 };
const takt = (...noten: [number | null, number, boolean?][]): Takt => ({ noten: noten.map(([midi, dauer, b]) => (b ? { midi, dauer, bindung: true } : { midi, dauer })) });
const kurz = (t: Takt) => t.noten.map((n) => `${n.gruppe ? `(${n.gruppe}` : ''}${n.midi ?? 'z'}/${n.dauer}${n.triole ? 't' : ''}${n.bindung ? '-' : ''}`).join(' ');

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
  it('setzt nur diesen Wert — der Takt darf dabei zu kurz oder zu lang werden', () => {
    const kurzer = dauerSetzen([takt([60, 16])], R, { takt: 0, note: 0 }, 4);
    expect(kurz(kurzer[0])).toBe('60/4');
    expect(taktStimmt(kurzer[0], R)).toBe(false);
    const t = [takt([60, 4], [62, 4], [64, 8])];
    expect(kurz(dauerSetzen(t, R, { takt: 0, note: 0 }, 8)[0])).toBe('60/8 62/4 64/4- 64/4');
    expect(taktLaenge(dauerSetzen(t, R, { takt: 0, note: 0 }, 8)[0])).toBe(20);
    expect(taktStimmt(t[0], R)).toBe(true);
  });
  it('lässt den Nachbartakt in Ruhe; ein Bogen bleibt nur an der letzten Note', () => {
    const t = [takt([60, 8], [62, 8, true]), takt([62, 16])];
    const neu = dauerSetzen(t, R, { takt: 0, note: 0 }, 16);
    expect(kurz(neu[0])).toBe('60/16 62/8-');
    expect(kurz(neu[1])).toBe('62/16');
    // Zwei getrennte Einsätze derselben Höhe: nur der erste wird länger, der Bogen am zweiten bleibt.
    const gleich = dauerSetzen([takt([62, 8], [62, 8, true]), takt([62, 16])], R, { takt: 0, note: 0 }, 16);
    expect(kurz(gleich[0])).toBe('62/16 62/8-');
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
    // Auf einer Note: nur Wert und Höhe dieser Note, der Takt wird kürzer (rot).
    const d = noteSchreiben(taktEinfuegen(c.takte, R, 0), R, { takt: 0, note: 2 }, 65, 4);
    expect(kurz(d.takte[0])).toBe('60/4 62/4 65/4');
    expect(d.naechste).toEqual({ takt: 1, note: 0 });
  });
  it('Palettenwert auf eine Pause teilt sie, auf eine Note setzt er nur deren Wert', () => {
    expect(kurz(wertSetzen([takt([null, 16])], R, { takt: 0, note: 0 }, 4)[0])).toBe('z/4 z/4 z/8');
    expect(kurz(wertSetzen([takt([null, 4], [60, 12])], R, { takt: 0, note: 0 }, 8)[0])).toBe('z/4 60/12');
    expect(kurz(wertSetzen([takt([60, 16])], R, { takt: 0, note: 0 }, 4)[0])).toBe('60/4');
  });
  it('Note + und Pause + hinter der gewählten, nur in diesem Takt; Löschen nur hier', () => {
    const t = [takt([60, 8], [62, 8]), takt([64, 16])];
    const p = danachEinfuegen(t, R, { takt: 0, note: 0 }, null, 4);
    expect(p.takte.map(kurz)).toEqual(['60/8 z/4 62/4- 62/4', '64/16']); // 62 beginnt jetzt vor der Takthälfte: gebunden darüber
    expect(p.neu).toEqual({ takt: 0, note: 1 });
    const n = danachEinfuegen(t, R, { takt: 0, note: 1 }, 62, 4);
    expect(n.takte.map(kurz)).toEqual(['60/8 62/8 62/4', '64/16']);
    expect(taktStimmt(n.takte[0], R)).toBe(false);
    expect(loeschenImTakt(t, R, { takt: 0, note: 0 }).map(kurz)).toEqual(['62/8', '64/16']);
    expect(loeschenImTakt(t, R, { takt: 1, note: 0 }).map(kurz)).toEqual(['60/8 62/8', 'z/16']);
    // Bogen in den nächsten Takt: Einfügen dahinter löst ihn; Löschen der ersten Note löst den Bogen davor.
    const b = [takt([60, 8], [62, 8, true]), takt([62, 16])];
    expect(danachEinfuegen(b, R, { takt: 0, note: 1 }, null, 4).takte.map(kurz)).toEqual(['60/8 62/8 z/4', '62/16']);
    expect(loeschenImTakt(b, R, { takt: 1, note: 0 }).map(kurz)).toEqual(['60/8 62/8', 'z/16']);
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

describe('Löschen und Einfügen', () => {
  it('nimmt eine Note heraus, alles rückt nach — auch über den Taktstrich', () => {
    const t = [takt([60, 4], [62, 4], [64, 8]), takt([65, 8], [67, 8])];
    expect(entfernen(t, R, { takt: 0, note: 1 }).map(kurz)).toEqual(['60/4 64/4- 64/4 65/4-', '65/4 67/4- 67/4 z/4']);
    expect(entfernen(t, R, { takt: 1, note: 1 }).map(kurz)).toEqual(['60/4 62/4 64/8', '65/8 z/8']);
  });
  it('nimmt eine gebundene Note ganz heraus und lässt einen Takt übrig', () => {
    const t = [takt([60, 8], [62, 8, true]), takt([62, 8], [64, 8])];
    expect(entfernen(t, R, { takt: 1, note: 0 }).map(kurz)).toEqual(['60/8 64/8']);
    expect(entfernen([takt([60, 16])], R, { takt: 0, note: 0 }).map(kurz)).toEqual(['z/16']);
  });
  it('fügt vor der Note eine Pause ein, der Rest rückt weiter und ein Takt wächst dazu', () => {
    const t = [takt([60, 8], [62, 8])];
    expect(einfuegen(t, R, { takt: 0, note: 1 }, 4).map(kurz)).toEqual(['60/8 z/4 62/4-', '62/4 z/4 z/8']);
    expect(einfuegen(t, R, { takt: 0, note: 0 }, 16).map(kurz)).toEqual(['z/16', '60/8 62/8']);
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

describe('Blatt mit 96 Zellen: 32tel und Triolen', () => {
  const B = aufBlatt(R); // 4/4, 96 Zellen je Takt, 24 je Schlag
  it('kennt die Werte bis zum 32tel und skaliert Takte aufs Blatt', () => {
    expect(notenwerte(B)).toEqual([96, 72, 48, 36, 24, 18, 12, 9, 6, 3]);
    expect(paletteWerte(B).map((w) => w.kurz)).toEqual(['1/1', '1/2', '1/4', '1/8', '1/16', '1/32']);
    expect(punktiert(24, B)).toBe(36);
    expect(punktiert(3, B)).toBeNull();
    expect(triole(24, B)).toBe(16);
    expect(triole(12, B)).toBe(8);
    expect(triole(3, B)).toBe(2);
    expect(triole(12, aufBlatt(SECHSACHTEL))).toBeNull();
    expect(kurz(skalieren([takt([60, 4], [null, 12])], 16)[0])).toBe('60/24 z/72');
    expect(kurz(leererTakt(B))).toBe('z/96');
  });
  it('schreibt eine Achteltriole im Schlag mit Klammer, der Rest bleibt binär', () => {
    const t = legen([{ midi: 60, dauer: 24 }, { midi: 62, dauer: 8 }, { midi: 64, dauer: 8 }, { midi: 65, dauer: 8 }, { midi: 67, dauer: 48 }], B);
    expect(kurz(t)).toBe('60/24 (362/8t 64/8t 65/8t 67/48');
    expect(alsAbc([t], B, { titel: 'T' })).toContain('C24 (3:2:3D12E12F12 G48 |]');
  });
  it('erkennt Sechzehnteltriolen und gemischte Triolen-Schläge', () => {
    const t = legen([{ midi: 60, dauer: 4 }, { midi: 62, dauer: 4 }, { midi: 64, dauer: 4 }, { midi: 65, dauer: 12 }, { midi: null, dauer: 72 }], B);
    expect(kurz(t)).toBe('(460/4t 62/4t 64/4t 65/12t z/24 z/48');
    expect(alsAbc([t], B, { titel: 'T' })).toContain('(3:2:4C6D6E6F18 z24 z48 |]');
  });
  it('erkennt eine Vierteltriole über die Takthälfte', () => {
    const t = legen([{ midi: 60, dauer: 16 }, { midi: 62, dauer: 16 }, { midi: 64, dauer: 16 }, { midi: 65, dauer: 48 }], B);
    expect(kurz(t)).toBe('(360/16t 62/16t 64/16t 65/48');
    expect(alsAbc([t], B, { titel: 'T' })).toContain('(3:2:3C24D24E24 F48 |]');
  });
  it('teilt eine Strecke am Rand eines Triolen-Schlags und bindet', () => {
    const t = legen([{ midi: 60, dauer: 32 }, { midi: 62, dauer: 8 }, { midi: 64, dauer: 8 }, { midi: null, dauer: 48 }], B);
    expect(kurz(t)).toBe('60/24- (360/8t 62/8t 64/8t z/48');
  });
  it('32tel bleiben binär, Pausen füllen mit 32teln auf', () => {
    const t = legen([{ midi: 60, dauer: 3 }, { midi: 62, dauer: 3 }, { midi: 64, dauer: 6 }, { midi: null, dauer: 84 }], B);
    expect(kurz(t)).toBe('60/3 62/3 64/6 z/12 z/24 z/48');
    expect(kurz(noteSchreiben([leererTakt(B)], B, { takt: 0, note: 0 }, 60, 2).takte[0])).toBe('(460/2t z/16t z/4t z/2t z/24 z/48');
  });
  it('rundet, was sich nicht notieren lässt, im betroffenen Schlag aufs binäre Raster', () => {
    // Ein 32tel vor eine Achteltriole geschoben: die Triole liegt schief — der Schlag wird binär.
    const t = legen([{ midi: 60, dauer: 3 }, { midi: 62, dauer: 8 }, { midi: 64, dauer: 8 }, { midi: 65, dauer: 8 }, { midi: 67, dauer: 69 }], B);
    expect(t.noten.every((n) => n.dauer % 3 === 0)).toBe(true);
    expect(t.noten.reduce((a, n) => a + n.dauer, 0)).toBe(96);
    expect(strecken(t).filter((n) => n.midi === 62 || n.midi === 64 || n.midi === 65)).toHaveLength(3);
    // Eine saubere Triole im nächsten Schlag bleibt.
    const u = legen([{ midi: 60, dauer: 3 }, { midi: 62, dauer: 21 }, { midi: 64, dauer: 8 }, { midi: 65, dauer: 8 }, { midi: 67, dauer: 8 }, { midi: null, dauer: 48 }], B);
    expect(u.noten.filter((n) => n.triole)).toHaveLength(3);
  });
  it('spielt Triolen in echter Zeit', () => {
    const t = legen([{ midi: 60, dauer: 8 }, { midi: 62, dauer: 8 }, { midi: 64, dauer: 8 }, { midi: null, dauer: 72 }], B);
    expect(klaenge([t], B).map((k) => [k.beginn, k.dauer])).toEqual([[0, 1 / 6], [1 / 6, 1 / 6], [1 / 3, 1 / 6]]);
  });
});

describe('Mehrstimmig', () => {
  const B = aufBlatt(R);
  it('legt Stimmen an, gleicht Takte an, ändert eine oder alle', () => {
    const eine = einstimmig([takt([60, 48], [62, 48])]);
    const zwei = stimmeHinzu(eine, B);
    expect(zwei).toHaveLength(2);
    expect(zwei[1].name).toBe('Stimme 2');
    expect(zwei[1].schluessel).toBe('bass');
    expect(zwei[1].takte.map(kurz)).toEqual(['z/96']);
    const laenger = inStimme(zwei, 1, [takt([48, 96]), takt([50, 96])], B);
    expect(laenger.map((s) => s.takte.length)).toEqual([2, 2]);
    expect(kurz(laenger[0].takte[1])).toBe('z/96');
    const mehr = inAllen(laenger, (t) => taktEinfuegen(t, B, 1));
    expect(mehr.map((s) => s.takte.length)).toEqual([3, 3]);
    expect(stimmeWeg(mehr, 0).map((s) => s.name)).toEqual(['Stimme 2']);
    expect(stimmeWeg(eine, 0)).toHaveLength(1);
    expect(stimmeAendern(zwei, 1, { name: 'Bass', schluessel: 'violin' })[1]).toMatchObject({ name: 'Bass', schluessel: 'violin' });
    expect(angleichen([{ name: '', schluessel: 'violin', takte: [] }], B)[0].takte).toHaveLength(1);
  });
  it('schreibt Stimmen als ABC mit V: und liest sie zurück; eine namenlose bleibt wie bisher', () => {
    const stimmen = [
      { name: 'Melodie', schluessel: 'violin' as const, takte: [takt([67, 48], [69, 48]), takt([71, 96])] },
      { name: 'Bass', schluessel: 'bass' as const, takte: [takt([43, 96]), takt([40, 48], [null, 48])] },
    ];
    const abc = alsAbcStimmen(stimmen, B, { titel: 'Duo' }, null);
    expect(abc).toContain('V:1 name="Melodie" clef=treble\nV:2 name="Bass" clef=bass\nK:C\nV:1\nG48 A48 | B96 |]\nV:2\nG,,96 | E,,48 z48 |]');
    const g = abcLesen(abc)!;
    expect(g.stimmen.map((s) => ({ name: s.name, schluessel: s.schluessel, takte: s.takte.map(kurz) })))
      .toEqual(stimmen.map((s) => ({ name: s.name, schluessel: s.schluessel, takte: s.takte.map(kurz) })));
    expect(g.takte.map(kurz)).toEqual(stimmen[0].takte.map(kurz));
    const einzeln = alsAbc([takt([60, 96])], B, { titel: 'Solo' });
    expect(einzeln).not.toContain('V:');
    expect(abcLesen(einzeln)!.stimmen).toHaveLength(1);
    const bass = alsAbcStimmen([{ name: '', schluessel: 'bass', takte: [takt([43, 96])] }], B, { titel: 'B' });
    expect(bass).toContain('V:1 name="" clef=bass');
    expect(abcLesen(bass)!.stimmen[0].schluessel).toBe('bass');
    const alt = alsAbcStimmen([{ name: 'Bratsche', schluessel: 'alt', takte: [takt([60, 96])] }, { name: 'T', schluessel: 'tenor', takte: [takt([55, 96])] }], B, { titel: 'A' });
    expect(alt).toContain('clef=alto');
    expect(alt).toContain('clef=tenor');
    expect(abcLesen(alt)!.stimmen.map((s) => s.schluessel)).toEqual(['alt', 'tenor']);
  });
  it('spielt alle Stimmen zusammen, stumme nicht, und bringt gelesene Stimmen aufs Blatt', () => {
    const stimmen = [einstimmig([takt([60, 48], [62, 48])])[0], { name: 'B', schluessel: 'bass' as const, takte: [takt([48, 96])] }];
    expect(klaengeAlle(stimmen, B).map((k) => k.midi)).toEqual([60, 48, 62]);
    expect(klaengeAlle(stimmen, B, new Set([1])).map((k) => k.midi)).toEqual([60, 62]);
    const alt = [{ name: '', schluessel: 'violin' as const, takte: [takt([60, 8], [62, 8])] }, { name: 'B', schluessel: 'bass' as const, takte: [] }];
    const blatt = aufsBlattStimmen(alt, 16, R);
    expect(blatt[0].takte.map(kurz)).toEqual(['60/48 62/48']);
    expect(blatt[1].takte.map(kurz)).toEqual(['z/96']);
  });
});

describe('Mehrere Noten auf einmal', () => {
  const B = aufBlatt(R);
  const t = [takt([60, 24], [62, 24], [null, 24], [64, 24]), takt([65, 96])];
  it('verschiebt alle gewählten, Pausen bleiben', () => {
    const alle = alleNoten(t);
    expect(alle).toEqual([{ takt: 0, note: 0 }, { takt: 0, note: 1 }, { takt: 0, note: 3 }, { takt: 1, note: 0 }]);
    expect(verschiebenViele(t, B, alle, 12).map(kurz)).toEqual(['72/24 74/24 z/24 76/24', '77/96']);
    expect(leiterVerschiebenViele(t, B, [{ takt: 0, note: 0 }, { takt: 1, note: 0 }], 1, null).map(kurz)).toEqual(['62/24 62/24 z/24 64/24', '67/96']);
  });
  it('macht viele zu Pausen und löscht viele, von hinten nach vorn', () => {
    expect(pausenViele(t, B, [{ takt: 0, note: 0 }, { takt: 0, note: 3 }]).map(kurz)).toEqual(['z/24 62/24 z/24 z/24', '65/96']);
    expect(entfernenViele(t, B, [{ takt: 0, note: 0 }, { takt: 0, note: 1 }]).map(kurz)).toEqual(['z/24 64/24 65/48-', '65/48 z/48']);
  });
});
