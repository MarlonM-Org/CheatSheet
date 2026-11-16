import { describe, expect, it } from 'vitest';
import { akkordText, tonDeutsch } from '@/domain/akkorde';
import {
  akkordeAufbereiten, akkordeLesen, droneFarbeFuer, hatAkkorde, schrittWeiter, spielhilfeSchritte, schrittText,
} from '@/domain/spielhilfe';

describe('Akkorde an der Stelle lesen (I-15)', () => {
  it('nimmt ein gültiges Feld', () => {
    expect(akkordeLesen({ text: '| Cm7 F7 | Bbmaj7 |', eingabe: 'notiert' })).toEqual({ text: '| Cm7 F7 | Bbmaj7 |', eingabe: 'notiert' });
  });
  it('fehlt die Eingabeart oder ist sie unbekannt, gilt klingend', () => {
    expect(akkordeLesen({ text: 'C' })).toEqual({ text: 'C', eingabe: 'klingend' });
    expect(akkordeLesen({ text: 'C', eingabe: 'quer' })).toEqual({ text: 'C', eingabe: 'klingend' });
  });
  it('Unbrauchbares ergibt null (die Stelle selbst bleibt unberührt)', () => {
    for (const roh of [undefined, null, 5, 'C F G', [], { text: 3 }, { eingabe: 'notiert' }]) expect(akkordeLesen(roh)).toBeNull();
  });
  it('hatAkkorde: nur mit mindestens einem lesbaren Akkord', () => {
    expect(hatAkkorde({ akkorde: { text: 'C', eingabe: 'klingend' } })).toBe(true);
    expect(hatAkkorde({ akkorde: { text: '', eingabe: 'klingend' } })).toBe(false);
    expect(hatAkkorde({ akkorde: { text: 'xyz', eingabe: 'klingend' } })).toBe(false);
    expect(hatAkkorde({})).toBe(false);
    expect(hatAkkorde({ akkorde: 'C' as unknown })).toBe(false);
  });
});

describe('Eingabe aufbereiten (Speichern)', () => {
  it('schreibt einheitlich mit Taktstrichen und ASCII', () => {
    expect(akkordeAufbereiten('E A B7 E', 'klingend')).toEqual({ wert: { text: '| E | A | B7 | E |', eingabe: 'klingend' }, fehler: [], takte: 4 });
    expect(akkordeAufbereiten('| Cm7 F7 | B♭maj7 | % |', 'notiert').wert).toEqual({ text: '| Cm7 F7 | Bbmaj7 | Bbmaj7 |', eingabe: 'notiert' });
  });
  it('leer heißt: Akkorde entfernt — gespeichert als leerer Text, damit eine ältere Sicherung sie nicht zurückbringt', () => {
    expect(akkordeAufbereiten('   ', 'notiert')).toEqual({ wert: { text: '', eingabe: 'notiert' }, fehler: [], takte: 0 });
  });
  it('Unlesbares meldet Fehler und speichert nichts', () => {
    const r = akkordeAufbereiten('C Xm7 G', 'klingend');
    expect(r.wert).toBeNull();
    expect(r.fehler.length).toBe(1);
  });
});

describe('Schritte: Akkord für Akkord, notiert für die Stimmung', () => {
  it('klingend eingegeben → für die B-Klarinette notiert, klingend daneben', () => {
    const s = spielhilfeSchritte({ text: '| Cm7 F7 | Bbmaj7 |', eingabe: 'klingend' }, 'B');
    expect(s.map((x) => [x.takt, x.nr, x.imTakt, akkordText(x.notiert, { ascii: true }), akkordText(x.klingend, { ascii: true })])).toEqual([
      [1, 1, 2, 'Dm7', 'Cm7'], [1, 2, 2, 'G7', 'F7'], [2, 1, 1, 'Cmaj7', 'Bbmaj7'],
    ]);
  });
  it('notiert eingegeben bleibt, wie es dasteht; klingend wird zurückgerechnet', () => {
    const s = spielhilfeSchritte({ text: 'D G', eingabe: 'notiert' }, 'B');
    expect(s.map((x) => [akkordText(x.notiert), akkordText(x.klingend)])).toEqual([['D', 'C'], ['G', 'F']]);
  });
  it('C-Instrument: notiert = klingend', () => {
    const s = spielhilfeSchritte({ text: 'Bb7', eingabe: 'klingend' }, 'C');
    expect(akkordText(s[0].notiert)).toBe('B♭7');
    expect(akkordText(s[0].klingend)).toBe('B♭7');
  });
  it('Akkordtöne und Guide Tones kommen aus dem notierten Akkord', () => {
    const [s] = spielhilfeSchritte({ text: 'Bb7', eingabe: 'klingend' }, 'B');
    expect(s.notiert.toene.map((t) => tonDeutsch(t.ton))).toEqual(['C', 'E', 'G', 'B']);
    expect(s.notiert.toene.filter((t) => t.guide).map((t) => tonDeutsch(t.ton))).toEqual(['E', 'B']);
  });
  it('unlesbar oder leer: keine Schritte', () => {
    expect(spielhilfeSchritte({ text: '', eingabe: 'klingend' }, 'B')).toEqual([]);
    expect(spielhilfeSchritte(null, 'B')).toEqual([]);
  });
  it('Beschriftung: Takt und, bei mehreren, welcher Akkord im Takt', () => {
    const s = spielhilfeSchritte({ text: '| Cm7 F7 | Bbmaj7 |', eingabe: 'klingend' }, 'B');
    expect(s.map((x) => schrittText(x, 2))).toEqual(['T. 1 · 1/2 von 2', 'T. 1 · 2/2 von 2', 'T. 2 von 2']);
  });
});

describe('Weiterschalten zum Loopen', () => {
  it('läuft rundherum', () => {
    expect(schrittWeiter(0, 3, 1)).toBe(1);
    expect(schrittWeiter(2, 3, 1)).toBe(0);
    expect(schrittWeiter(0, 3, -1)).toBe(2);
  });
  it('bleibt bei null Schritten auf 0 und klemmt Unsinn', () => {
    expect(schrittWeiter(0, 0, 1)).toBe(0);
    expect(schrittWeiter(9, 3, 1)).toBe(0);
  });
});

describe('Drone-Farbe passend zum Akkord', () => {
  const farbe = (t: string) => droneFarbeFuer(spielhilfeSchritte({ text: t, eingabe: 'notiert' }, 'C')[0].notiert);
  it('Dur, Moll, Dominante, Moll-Sept; verminderte nur Grundton (die reine Quinte rieb), sus leer', () => {
    expect(farbe('C')).toBe('dur');
    expect(farbe('Cmaj7')).toBe('dur');
    expect(farbe('Cm')).toBe('moll');
    expect(farbe('C7')).toBe('mixolydisch');
    expect(farbe('Cm7')).toBe('dorisch');
    expect(farbe('Cm7b5')).toBe('grundton');
    expect(farbe('Cdim7')).toBe('grundton');
    expect(farbe('Csus4')).toBe('quinte');
  });
});
