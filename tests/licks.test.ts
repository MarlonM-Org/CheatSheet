import { describe, expect, it } from 'vitest';
import abcjs from 'abcjs';
import { tonartLesen, tonDeutsch, tonKlasse } from '@/domain/akkorde';
import { abschnitteAbc, abschnitteKlaenge, OBERE_GRENZEN, UMFANG } from '@/domain/etueden';
import {
  bewerten, faellig, faelligIn, faelligText, heuteFaellig, istPause, lickAbschnitt, lickAlle12, lickAusEingabe, lickBewerten, lickEntfernen,
  lickLesen, licksAlle, licksGueltig, licksLesen, lickSichern, lickSkills, LICKS_STANDARD, START_LICKS, startLicksZeigen, type Lick, type LickSpeicher,
} from '@/domain/licks';

const TAG = 86_400_000;
const jetzt = new Date(2026, 10, 16, 12).getTime();
const lick = (text: string, tonart = 'C', name = 'Test'): Lick => {
  const r = lickAusEingabe({ name, ueber: '', tonart, text }, 'eigen-1');
  if (!r.lick) throw new Error(r.fehler.join(' '));
  return r.lick;
};
const namen = (l: Lick, klasse: number) => lickAbschnitt(l, klasse).ereignisse.filter((e) => e.ton).map((e) => tonDeutsch(e.ton!));

describe('Eingabe lesen', () => {
  it('Tonnamen, Dauern, Pausen, Akkorde', () => {
    const g = lickLesen('"Dm7" D8 E8 F8 A8 | C4 z4', tonartLesen('Dm')!);
    expect(g.fehler).toEqual([]);
    expect(g.noten.map((n) => n.t)).toEqual([6, 6, 6, 6, 12, 12]);
    expect(istPause(g.noten[5])).toBe(true);
    // D = Grundton; C liegt der A am nächsten: darüber (kleine Septime über D).
    expect(g.noten.slice(0, 5)).toEqual([{ s: 0, h: 0, t: 6 }, { s: 1, h: 2, t: 6 }, { s: 2, h: 3, t: 6 }, { s: 4, h: 7, t: 6 }, { s: 6, h: 10, t: 12 }]);
    expect(g.akkorde).toEqual([{ ab: 0, s: 0, h: 0, endung: 'm7' }]);
  });
  it('ohne Dauer gilt die vorige; punktiert, triolisch', () => {
    const g = lickLesen('C4. D8 E4 F8t G A', tonartLesen('C')!);
    expect(g.noten.map((n) => n.t)).toEqual([18, 6, 12, 4, 4, 4]);
    expect(g.fehler).toEqual([]);
  });
  it("Oktave: nächstgelegen, ' höher, , tiefer; H = B", () => {
    const g = lickLesen("C E' G, H", tonartLesen('C')!);
    expect(g.noten.map((n) => ('h' in n ? n.h : null))).toEqual([0, 16, 7, 11]);
  });
  it('Smart Punctuation vom iPhone', () => {
    const g = lickLesen('„Cmaj7“ C8 E’8', tonartLesen('C')!);
    expect(g.fehler).toEqual([]);
    expect(g.akkorde[0].endung).toBe('maj7');
    expect(g.noten.map((n) => ('h' in n ? n.h : null))).toEqual([0, 16]);
  });
  it('Fehler', () => {
    expect(lickLesen('C8 X8', tonartLesen('C')!).fehler[0]).toContain('X8');
    expect(lickLesen('C16.', tonartLesen('C')!).fehler[0]).toContain('Dauer');
    expect(lickLesen('', tonartLesen('C')!).fehler).toContain('Noch keine Töne.');
    expect(lickLesen('C8t D8', tonartLesen('C')!).fehler[0]).toContain('Triolen');
    expect(lickLesen('C1 C1 C1 C1 C1 C1 C1 C1 C1', tonartLesen('C')!).fehler[0]).toContain('Takte');
    expect(lickAusEingabe({ name: '', ueber: '', tonart: 'Q', text: 'C' }, 'x').fehler).toHaveLength(2);
  });
});

describe('Transponieren mit richtiger Schreibweise', () => {
  it('ii–V–I-Lick in B und Fis', () => {
    const l = START_LICKS.find((x) => x.id === 'start-251-chromatisch')!;
    expect(namen(l, 0)).toEqual(['D', 'F', 'A', 'C', 'H', 'B', 'A', 'As', 'G']);
    expect(namen(l, 10)).toEqual(['C', 'Es', 'G', 'B', 'A', 'As', 'G', 'Ges', 'F']);
    const ab = lickAbschnitt(l, 10);
    expect(ab.titel).toBe('B-Dur');
    expect(ab.ereignisse.filter((e) => e.akkord).map((e) => e.akkord)).toEqual(['Cm7', 'F7', 'Bbmaj7']);
    expect(lickAbschnitt(l, 6).titel).toBe('Ges-Dur');
  });
  it('Moll-Licks in Moll-Schreibweise (gis-Moll, nicht as-Moll)', () => {
    const l = START_LICKS.find((x) => x.id === 'start-moll-penta')!;
    expect(lickAbschnitt(l, 8).titel).toBe('gis-Moll');
    expect(namen(l, 8)).toEqual(['Dis', 'Fis', 'Gis', 'H', 'Cis', 'H', 'Gis', 'Fis', 'Gis']);
  });
  it('Umspielung: leitereigene und chromatische Töne folgen dem Intervall', () => {
    const l = START_LICKS.find((x) => x.id === 'start-umspielung')!;
    expect(namen(l, 3).slice(0, 6)).toEqual(['As', 'Fis', 'G', 'C', 'A', 'B']);
  });
  it('Klasse und MIDI stimmen überein; alle Töne im Umfang', () => {
    for (const l of START_LICKS) for (const { midi: ober } of OBERE_GRENZEN) for (const a of lickAlle12(l, ober)) {
      for (const e of a.ereignisse) if (e.ton) {
        expect(((e.midi % 12) + 12) % 12).toBe(tonKlasse(e.ton));
        expect(e.midi).toBeGreaterThanOrEqual(UMFANG.von);
        expect(e.midi).toBeLessThanOrEqual(ober);
      }
    }
  });
  it('Gestalt bleibt: Abstände in jeder Tonart gleich', () => {
    for (const l of START_LICKS) {
      const ab = (k: number) => { const m = lickAbschnitt(l, k).ereignisse.filter((e) => e.ton).map((e) => e.midi); return m.map((x) => x - m[0]); };
      for (let k = 1; k < 12; k++) expect(ab(k), l.id).toEqual(ab(0));
    }
  });
  it('alle 12 Tonarten im Quartenzirkel ab der Eingabe-Tonart; gültiges ABC', () => {
    for (const l of START_LICKS) {
      const alle = lickAlle12(l);
      expect(alle).toHaveLength(12);
      const [tune] = abcjs.parseOnly(abschnitteAbc(alle));
      expect(tune.warnings ?? [], l.id).toEqual([]);
      expect(abschnitteKlaenge([alle[0]], 100).klaenge.length).toBe(l.noten.filter((n) => !istPause(n)).length);
    }
    expect(lickAlle12(START_LICKS[0]).map((a) => a.titel).slice(0, 3)).toEqual(['C-Dur', 'F-Dur', 'B-Dur']);
  });
});

describe('Start-Licks', () => {
  it('acht eigene Formulierungen, alle gültig', () => {
    expect(START_LICKS).toHaveLength(8);
    for (const l of START_LICKS) expect(licksGueltig({ eigene: [l], stand: {}, aus: [] }), l.id).toBe(true);
    expect(new Set(START_LICKS.map((l) => l.id)).size).toBe(8);
  });
  it('Skills: Licks transponieren, Blues zählt auch auf Blues-Phrasen', () => {
    expect(lickSkills(START_LICKS[0])).toEqual(['licks-transponieren', 'blues-phrasen']);
    expect(lickSkills(START_LICKS[1])).toEqual(['licks-transponieren']);
  });
});

describe('Wiederholen', () => {
  it('sitzt → stärker, fast → bleibt (mind. 1), noch nicht → 0', () => {
    expect(bewerten(undefined, 'sitzt', jetzt)).toEqual({ zuletzt: jetzt, staerke: 1 });
    expect(bewerten({ zuletzt: 1, staerke: 4 }, 'sitzt', jetzt).staerke).toBe(4);
    expect(bewerten(undefined, 'fast', jetzt).staerke).toBe(1);
    expect(bewerten({ zuletzt: 1, staerke: 3 }, 'fast', jetzt).staerke).toBe(3);
    expect(bewerten({ zuletzt: 1, staerke: 3 }, 'nochNicht', jetzt).staerke).toBe(0);
  });
  it('fällig nach Abstand je Stärke (1, 2, 4, 8, 16 Tage)', () => {
    expect(faellig(undefined, jetzt)).toBe(true);
    expect(faellig({ zuletzt: jetzt, staerke: 0 }, jetzt)).toBe(false);
    expect(faellig({ zuletzt: jetzt - TAG, staerke: 0 }, jetzt)).toBe(true);
    expect(faellig({ zuletzt: jetzt - 3 * TAG, staerke: 2 }, jetzt)).toBe(false);
    expect(faellig({ zuletzt: jetzt - 4 * TAG, staerke: 2 }, jetzt)).toBe(true);
    expect(faelligIn({ zuletzt: jetzt, staerke: 4 }, jetzt)).toBe(16);
    expect(faelligText({ zuletzt: jetzt, staerke: 0 }, jetzt)).toBe('morgen');
    expect(faelligText({ zuletzt: jetzt, staerke: 2 }, jetzt)).toBe('in 4 Tagen');
    expect(faelligText(undefined, jetzt)).toBe('neu');
  });
  it('heute fällig: überfällige zuerst, nie geübte danach', () => {
    const [a, b, c, d] = START_LICKS;
    const stand = {
      [a.id]: { zuletzt: jetzt - 2 * TAG, staerke: 0 }, // 1 Tag über
      [b.id]: { zuletzt: jetzt - 10 * TAG, staerke: 1 }, // 8 Tage über
      [c.id]: { zuletzt: jetzt, staerke: 2 }, // nicht fällig
    };
    expect(heuteFaellig([a, b, c, d], stand, jetzt).map((l) => l.id)).toEqual([b.id, a.id, d.id]);
  });
});

describe('Speicher', () => {
  const eigen = lick('C8 D8 E4', 'C', 'Mein Lick');
  it('sichern, ausblenden, löschen, wieder zeigen', () => {
    let sp: LickSpeicher = LICKS_STANDARD;
    sp = lickSichern(sp, eigen);
    expect(licksAlle(sp)).toHaveLength(9);
    sp = lickSichern(sp, { ...eigen, name: 'Neu' });
    expect(sp.eigene).toHaveLength(1);
    expect(sp.eigene[0].name).toBe('Neu');
    sp = lickBewerten(sp, START_LICKS[0].id, 'sitzt', jetzt);
    sp = lickEntfernen(sp, START_LICKS[0].id);
    expect(sp.aus).toEqual([START_LICKS[0].id]);
    expect(sp.stand).toEqual({});
    expect(licksAlle(sp)).toHaveLength(8);
    sp = lickEntfernen(sp, eigen.id);
    expect(sp.eigene).toEqual([]);
    expect(licksAlle(startLicksZeigen(sp))).toHaveLength(8);
    expect(LICKS_STANDARD).toEqual({ eigene: [], stand: {}, aus: [] });
  });
  it('Validator streng, Lesen tolerant', () => {
    const gut = { eigene: [eigen], stand: { [eigen.id]: { zuletzt: jetzt, staerke: 2 } }, aus: ['start-blues'] };
    expect(licksGueltig(gut)).toBe(true);
    expect(licksGueltig(LICKS_STANDARD)).toBe(true);
    expect(licksGueltig({ ...gut, stand: { x: { zuletzt: jetzt, staerke: 5 } } })).toBe(false);
    expect(licksGueltig({ ...gut, eigene: [{ ...eigen, noten: [] }] })).toBe(false);
    expect(licksGueltig({ ...gut, eigene: [{ ...eigen, noten: [{ s: 0.5, h: 0, t: 6 }] }] })).toBe(false);
    expect(licksGueltig({ ...gut, aus: ['__proto__'] })).toBe(false);
    expect(licksGueltig([])).toBe(false);
    expect(licksLesen({ eigene: [eigen, { kaputt: 1 }], stand: { a: { zuletzt: jetzt, staerke: 9 }, b: { zuletzt: jetzt, staerke: 1 } }, aus: [3, 'x'] }))
      .toEqual({ eigene: [eigen], stand: { b: { zuletzt: jetzt, staerke: 1 } }, aus: ['x'] });
    expect(licksLesen(null)).toEqual(LICKS_STANDARD);
  });
});
