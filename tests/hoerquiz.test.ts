import { describe, expect, it } from 'vitest';
import {
  antwortKlaenge, antwortName, bewerten, frageKlaenge, FRAGEN_JE_RUNDE, HOER_STANDARD, hoerEinstellungLesen, istHoerEinstellung, optionen,
  rundeErzeugen, stufenAnzahl, stufeKlemmen, TIEFSTER, type Frage, type HoerUebungId,
} from '@/domain/hoerquiz';

const ids = (u: HoerUebungId, s: number) => optionen(u, s).map((a) => a.id);

describe('Antwortoptionen je Stufe', () => {
  it('Intervalle: 4, 8, 13', () => {
    expect(ids('intervalle', 1)).toEqual(['prime', 'quarte', 'quinte', 'oktave']);
    expect(ids('intervalle', 2)).toEqual(['prime', 'kl3', 'gr3', 'quarte', 'quinte', 'kl6', 'gr6', 'oktave']);
    expect(optionen('intervalle', 3)).toHaveLength(13);
    expect(ids('intervalle', 3)).toContain('tritonus');
  });
  it('Dreiklänge und Septakkorde', () => {
    expect(ids('dreiklaenge', 1)).toEqual(['dur', 'moll']);
    expect(ids('dreiklaenge', 2)).toEqual(['dur', 'moll', 'vermindert', 'uebermaessig']);
    expect(ids('septakkorde', 1)).toEqual(['maj7', 'dom7', 'm7']);
    expect(ids('septakkorde', 2)).toEqual(['maj7', 'dom7', 'm7', 'm7b5', 'dim7']);
  });
  it('Stufenzahl und Klemmen', () => {
    expect([stufenAnzahl('intervalle'), stufenAnzahl('dreiklaenge'), stufenAnzahl('septakkorde')]).toEqual([3, 2, 2]);
    expect(stufeKlemmen('dreiklaenge', 9)).toBe(2);
    expect(stufeKlemmen('dreiklaenge', 0)).toBe(1);
    expect(stufeKlemmen('dreiklaenge', NaN)).toBe(1);
    expect(ids('dreiklaenge', 99)).toHaveLength(4);
  });
  it('deutsche Namen', () => {
    expect(antwortName('intervalle', 'kl3')).toBe('kleine Terz');
    expect(antwortName('intervalle', 'tritonus')).toBe('Tritonus');
    expect(antwortName('dreiklaenge', 'vermindert')).toBe('vermindert');
    expect(antwortName('dreiklaenge', 'uebermaessig')).toBe('übermäßig');
    expect(antwortName('septakkorde', 'dom7')).toBe('Dominantsept (7)');
    expect(antwortName('septakkorde', 'm7b5')).toBe('halbvermindert (m7♭5)');
    expect(antwortName('septakkorde', 'dim7')).toBe('vermindert (dim7)');
  });
});

describe('Runde erzeugen', () => {
  const alle: [HoerUebungId, number][] = [['intervalle', 1], ['intervalle', 2], ['intervalle', 3], ['dreiklaenge', 1], ['dreiklaenge', 2], ['septakkorde', 1], ['septakkorde', 2]];
  it('zehn Fragen, nur erlaubte Antworten, nie zweimal dieselbe hintereinander', () => {
    for (const [u, s] of alle) {
      for (let seed = 1; seed <= 40; seed++) {
        const r = rundeErzeugen(u, s, 'gemischt', seed);
        expect(r).toHaveLength(FRAGEN_JE_RUNDE);
        const erlaubt = new Set(ids(u, s));
        r.forEach((f, i) => {
          expect(erlaubt.has(f.antwort)).toBe(true);
          if (i) { expect(f.antwort).not.toBe(r[i - 1].antwort); expect(f.tiefster).not.toBe(r[i - 1].tiefster); }
          expect(f.tiefster).toBeGreaterThanOrEqual(TIEFSTER.von);
          expect(f.tiefster).toBeLessThanOrEqual(TIEFSTER.bis);
        });
      }
    }
  });
  it('gleicher Startwert, gleiche Runde; anderer Startwert, andere', () => {
    expect(rundeErzeugen('intervalle', 3, 'gemischt', 7)).toEqual(rundeErzeugen('intervalle', 3, 'gemischt', 7));
    expect(rundeErzeugen('intervalle', 3, 'gemischt', 7)).not.toEqual(rundeErzeugen('intervalle', 3, 'gemischt', 8));
  });
  it('mit zwei Optionen wechselt es jedes Mal', () => {
    const r = rundeErzeugen('dreiklaenge', 1, 'auf', 3, 20);
    r.forEach((f, i) => i && expect(f.antwort).not.toBe(r[i - 1].antwort));
  });
  it('alle Antworten kommen über viele Runden vor', () => {
    const gesehen = new Set(Array.from({ length: 30 }, (_, s) => rundeErzeugen('intervalle', 3, 'auf', s + 1)).flat().map((f) => f.antwort));
    expect(gesehen.size).toBe(13);
  });
  it('Richtung: feste Richtung bleibt, gemischt nutzt alle drei, Akkorde stets zusammen', () => {
    expect(new Set(rundeErzeugen('intervalle', 2, 'ab', 5, 50).map((f) => f.wiedergabe))).toEqual(new Set(['ab']));
    expect(new Set(rundeErzeugen('intervalle', 2, 'gemischt', 5, 60).map((f) => f.wiedergabe))).toEqual(new Set(['auf', 'ab', 'zusammen']));
    expect(new Set(rundeErzeugen('septakkorde', 2, 'ab', 5, 30).map((f) => f.wiedergabe))).toEqual(new Set(['zusammen']));
  });
});

describe('Klänge', () => {
  const f = (uebung: HoerUebungId, antwort: string, wiedergabe: Frage['wiedergabe'], tiefster = 60): Frage => ({ uebung, antwort, tiefster, wiedergabe });
  it('Intervall aufwärts nacheinander, abwärts umgekehrt, zusammen gleichzeitig', () => {
    const auf = frageKlaenge(f('intervalle', 'quinte', 'auf'));
    expect(auf.map((k) => k.midi)).toEqual([60, 67]);
    expect(auf[1].beginn).toBeGreaterThan(auf[0].beginn);
    const ab = frageKlaenge(f('intervalle', 'quinte', 'ab'));
    expect(ab.map((k) => k.midi)).toEqual([67, 60]);
    expect(ab[1].beginn).toBeGreaterThan(ab[0].beginn);
    const z = frageKlaenge(f('intervalle', 'quinte', 'zusammen'));
    expect(z.map((k) => k.midi).sort()).toEqual([60, 67]);
    expect(new Set(z.map((k) => k.beginn))).toEqual(new Set([0]));
  });
  it('Prime ist ein Ton', () => {
    expect(frageKlaenge(f('intervalle', 'prime', 'auf'))).toHaveLength(1);
  });
  it('Akkorde: Töne gleichzeitig, richtige Abstände', () => {
    const erwartet: Record<string, number[]> = {
      dur: [0, 4, 7], moll: [0, 3, 7], vermindert: [0, 3, 6], uebermaessig: [0, 4, 8],
    };
    for (const [id, t] of Object.entries(erwartet)) {
      const k = frageKlaenge(f('dreiklaenge', id, 'zusammen', 58));
      expect(k.map((x) => x.midi - 58)).toEqual(t);
      expect(new Set(k.map((x) => x.beginn)).size).toBe(1);
    }
    const sept: Record<string, number[]> = { maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9] };
    for (const [id, t] of Object.entries(sept)) expect(frageKlaenge(f('septakkorde', id, 'zusammen', 58)).map((x) => x.midi - 58)).toEqual(t);
  });
  it('Intervalle haben die richtige Größe', () => {
    const halbtoene: Record<string, number> = { kl2: 1, gr2: 2, kl3: 3, gr3: 4, quarte: 5, tritonus: 6, quinte: 7, kl6: 8, gr6: 9, kl7: 10, gr7: 11, oktave: 12 };
    for (const [id, n] of Object.entries(halbtoene)) {
      const k = frageKlaenge(f('intervalle', id, 'auf'));
      expect(k[1].midi - k[0].midi).toBe(n);
    }
  });
  it('„So klingt deine Antwort“ nutzt Lage und Art der Frage', () => {
    const frage = f('intervalle', 'gr3', 'ab', 62);
    expect(antwortKlaenge(frage, 'kl3').map((k) => k.midi)).toEqual([65, 62]);
  });
  it('alle Klänge einer Runde liegen im Klarinettenumfang', () => {
    for (const u of ['intervalle', 'dreiklaenge', 'septakkorde'] as const) {
      for (let seed = 1; seed < 30; seed++) {
        for (const fr of rundeErzeugen(u, stufenAnzahl(u), 'gemischt', seed)) {
          for (const k of frageKlaenge(fr)) { expect(k.midi).toBeGreaterThanOrEqual(52); expect(k.midi).toBeLessThanOrEqual(81); expect(k.dauer).toBeGreaterThan(0); }
        }
      }
    }
  });
});

describe('Bewertung', () => {
  const q = (antwort: string): Frage => ({ uebung: 'dreiklaenge', antwort, tiefster: 60, wiedergabe: 'zusammen' });
  it('Quote, je Antwort, Verwechslungen', () => {
    const fragen = [q('dur'), q('moll'), q('dur'), q('moll'), q('dur')];
    const e = bewerten(fragen, ['dur', 'dur', 'moll', 'dur', 'dur']);
    expect(e.richtig).toBe(2);
    expect(e.gesamt).toBe(5);
    expect(e.quote).toBeCloseTo(0.4);
    expect(e.je).toEqual([true, false, false, false, true]);
    expect(e.verwechslungen).toEqual([{ soll: 'moll', gegeben: 'dur', anzahl: 2 }, { soll: 'dur', gegeben: 'moll', anzahl: 1 }]);
    expect(e.texte).toEqual(['Moll mit Dur verwechselt: 2×', 'Dur mit Moll verwechselt: 1×']);
  });
  it('alles richtig: keine Verwechslungen', () => {
    const e = bewerten([q('dur'), q('moll')], ['dur', 'moll']);
    expect(e.quote).toBe(1);
    expect(e.texte).toEqual([]);
  });
  it('unbeantwortet zählt falsch, aber ohne Verwechslung; leere Runde = 0', () => {
    const e = bewerten([q('dur'), q('moll')], [null, 'moll']);
    expect(e.richtig).toBe(1);
    expect(e.verwechslungen).toEqual([]);
    expect(bewerten([], []).quote).toBe(0);
  });
  it('Text mit Intervallnamen', () => {
    const fragen: Frage[] = [{ uebung: 'intervalle', antwort: 'kl3', tiefster: 60, wiedergabe: 'auf' }];
    expect(bewerten(fragen, ['gr3']).texte).toEqual(['kleine Terz mit großer Terz verwechselt: 1×']);
  });
});

describe('Gespeicherte Stufe', () => {
  it('Standard ist gültig', () => { expect(istHoerEinstellung(HOER_STANDARD)).toBe(true); });
  it('prüft Stufen und Richtung', () => {
    expect(istHoerEinstellung({ ...HOER_STANDARD, intervalle: { stufe: 3, richtung: 'gemischt' } })).toBe(true);
    expect(istHoerEinstellung({ ...HOER_STANDARD, intervalle: { stufe: 4, richtung: 'auf' } })).toBe(false);
    expect(istHoerEinstellung({ ...HOER_STANDARD, intervalle: { stufe: 1, richtung: 'quer' } })).toBe(false);
    expect(istHoerEinstellung({ ...HOER_STANDARD, dreiklaenge: { stufe: 3 } })).toBe(false);
    expect(istHoerEinstellung(null)).toBe(false);
  });
  it('Lesen rettet Gültiges, ersetzt Kaputtes', () => {
    expect(hoerEinstellungLesen(null)).toEqual(HOER_STANDARD);
    expect(hoerEinstellungLesen({ intervalle: { stufe: 2, richtung: 'quer' }, dreiklaenge: { stufe: 2 }, septakkorde: { stufe: 7 } }))
      .toEqual({ intervalle: { stufe: 2, richtung: 'auf' }, dreiklaenge: { stufe: 2 }, septakkorde: { stufe: 1 } });
  });
});
