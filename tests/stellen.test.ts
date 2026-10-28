import { describe, expect, it } from 'vitest';
import {
  mischen, mixAuswahl, mixBereichLesen, mixSchluessel, neueRunde, reserveVon, rundeAbgleichen, rundeLesen, rundeStand, steigerung, stelleFavorit, stelleOffen,
  mixMenge, mixLeer, mixFertigText, mixKopf, stelleZurSeite,
  tagesbeste, tempoAchse, tempoStand, zielAusText, zielStand, type MixStelle,
} from '@/domain/stellen';

// Wiederholbarer Zufall für die Tests.
function zufall(saat = 1) {
  let s = saat;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const stellen = (je: Record<string, number>): MixStelle[] =>
  Object.entries(je).flatMap(([stueckId, n]) => Array.from({ length: n }, (_, i) => ({ id: `${stueckId}${i + 1}`, stueckId })));
const stueck = (id: string) => id.replace(/\d+$/, '');
const nebeneinander = (reihe: string[]) => reihe.filter((id, i) => i > 0 && stueck(reihe[i - 1]) === stueck(id)).length;

describe('Tempo einer Stelle', () => {
  it('zuletzt nach Datum, bestes über alle', () => {
    expect(tempoStand([{ tempo: 90, am: 3 }, { tempo: 100, am: 1 }, { tempo: 84, am: 2 }])).toEqual({ zuletzt: 90, bestes: 100 });
  });
  it('noch keins geschafft', () => {
    expect(tempoStand([])).toEqual({ zuletzt: null, bestes: null });
  });
  it('gleicher Zeitpunkt: der später eingetragene gilt', () => {
    expect(tempoStand([{ tempo: 80, am: 5 }, { tempo: 82, am: 5 }]).zuletzt).toBe(82);
  });
});

describe('Stellen-Modus einschalten: Stelle zur Seite', () => {
  const liste = [{ seite: 1 }, { seite: 2 }, { seite: 4 }, { seite: 4 }, { seite: 7 }];
  it('die erste Stelle auf der Seite', () => {
    expect(stelleZurSeite(liste, 4)).toBe(2);
    expect(stelleZurSeite(liste, 1)).toBe(0);
  });
  it('ohne Stelle auf der Seite: die erste danach', () => {
    expect(stelleZurSeite(liste, 3)).toBe(2);
    expect(stelleZurSeite(liste, 5)).toBe(4);
  });
  it('nichts mehr danach: die letzte davor', () => {
    expect(stelleZurSeite(liste, 9)).toBe(4);
  });
  it('ohne Stellen', () => {
    expect(stelleZurSeite([], 3)).toBe(-1);
  });
});

describe('Stellen-Mix: mischen', () => {
  it('jede Stelle genau einmal', () => {
    const alle = stellen({ a: 4, b: 3, c: 2, d: 1 });
    for (let saat = 1; saat <= 30; saat++) {
      const reihe = mischen(alle, zufall(saat));
      expect([...reihe].sort()).toEqual(alle.map((s) => s.id).sort());
    }
  });
  it('nie zwei Stellen desselben Stücks hintereinander, solange es anders geht', () => {
    for (let saat = 1; saat <= 50; saat++) {
      expect(nebeneinander(mischen(stellen({ a: 3, b: 3, c: 2 }), zufall(saat)))).toBe(0);
      // Knapp: a hat mehr als die Hälfte — geht nur als a b a c a
      const knapp = mischen(stellen({ a: 3, b: 1, c: 1 }), zufall(saat));
      expect(nebeneinander(knapp)).toBe(0);
      expect(knapp.map(stueck)).toEqual(['a', expect.any(String), 'a', expect.any(String), 'a']);
    }
  });
  it('geht es nicht anders, stehen die übrigen eben beieinander', () => {
    const reihe = mischen(stellen({ a: 4, b: 1 }), zufall(3));
    expect(reihe).toHaveLength(5);
    expect(nebeneinander(reihe)).toBe(2); // a b a a a: das Beste, was geht
  });
  it('beginnt nicht mit dem Stück, das gerade davor dran war', () => {
    for (let saat = 1; saat <= 20; saat++) expect(stueck(mischen(stellen({ a: 2, b: 2 }), zufall(saat), 'a')[0])).toBe('b');
  });
  it('wirklich gemischt: nicht jedes Mal dieselbe Reihenfolge', () => {
    const alle = stellen({ a: 3, b: 3, c: 3 });
    const verschieden = new Set(Array.from({ length: 20 }, (_, i) => mischen(alle, zufall(i + 1)).join()));
    expect(verschieden.size).toBeGreaterThan(10);
  });
  it('leer bleibt leer', () => {
    expect(mischen([], zufall())).toEqual([]);
  });
});

describe('Stellen-Mix: Runde an den Bestand angleichen', () => {
  const alle = stellen({ a: 2, b: 2, c: 1 });
  const runde = { reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 2 };

  it('nichts geändert: Runde bleibt, wie sie ist', () => {
    expect(rundeAbgleichen(runde, alle, zufall())).toEqual(runde);
  });
  it('gelöschte Stellen fallen weg, die aktuelle bleibt die aktuelle', () => {
    const ohne = alle.filter((s) => s.id !== 'a1' && s.id !== 'b2');
    expect(rundeAbgleichen(runde, ohne, zufall())).toEqual({ reihe: ['b1', 'c1', 'a2'], pos: 1 });
  });
  it('die aktuelle Stelle gelöscht: die nächste rückt an ihren Platz', () => {
    const ohne = alle.filter((s) => s.id !== 'c1');
    expect(rundeAbgleichen(runde, ohne, zufall())).toEqual({ reihe: ['a1', 'b1', 'a2', 'b2'], pos: 2 });
  });
  it('neue Stellen kommen in den noch offenen Teil, die geübten bleiben vorn', () => {
    const mehr = [...alle, { id: 'd1', stueckId: 'd' }, { id: 'd2', stueckId: 'd' }];
    const neu = rundeAbgleichen(runde, mehr, zufall(7));
    expect(neu.pos).toBe(2);
    expect(neu.reihe.slice(0, 3)).toEqual(['a1', 'b1', 'c1']);
    expect([...neu.reihe.slice(3)].sort()).toEqual(['a2', 'b2', 'd1', 'd2']);
  });
  it('Runde geschafft und neue Stellen dazu: es geht mit den neuen weiter', () => {
    const fertig = { reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 5 };
    const neu = rundeAbgleichen(fertig, [...alle, { id: 'e1', stueckId: 'e' }], zufall());
    expect(neu).toEqual({ reihe: ['a1', 'b1', 'c1', 'a2', 'b2', 'e1'], pos: 5 });
  });
  it('neue Runde: alle Stellen, vorn beginnend', () => {
    const r = neueRunde(alle, zufall());
    expect(r.pos).toBe(0);
    expect([...r.reihe].sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1']);
  });
});

describe('Stellen-Mix: Stand für die Bibliothek', () => {
  const alle = stellen({ a: 2, b: 2, c: 1 });
  it('ohne Runde: alles offen', () => {
    expect(rundeStand(null, alle)).toEqual({ anzahl: 5, stuecke: 3, geuebt: 0, fertig: false });
  });
  it('mitten drin: was schon dran war und noch da ist', () => {
    expect(rundeStand({ reihe: ['a1', 'x9', 'b1', 'c1', 'a2', 'b2'], pos: 3 }, alle)).toEqual({ anzahl: 5, stuecke: 3, geuebt: 2, fertig: false });
  });
  it('alle dran gewesen: Runde geschafft', () => {
    expect(rundeStand({ reihe: ['a1', 'b1', 'c1', 'a2', 'b2'], pos: 5 }, alle).fertig).toBe(true);
  });
  it('ohne Stellen nie „geschafft“', () => {
    expect(rundeStand({ reihe: [], pos: 0 }, []).fertig).toBe(false);
  });
});

describe('Stellen-Mix: gespeicherte Runde lesen', () => {
  it('nimmt nur eine stimmige Runde', () => {
    expect(rundeLesen({ reihe: ['a', 'b'], pos: 1 })).toEqual({ reihe: ['a', 'b'], pos: 1 });
    expect(rundeLesen(null)).toBeNull();
    expect(rundeLesen({ reihe: 'a', pos: 0 })).toBeNull();
    expect(rundeLesen({ reihe: ['a', 3], pos: 0 })).toBeNull();
    expect(rundeLesen({ reihe: ['a'], pos: -1 })).toBeNull();
  });
  it('doppelte Einträge zählen einmal, pos bleibt im Rahmen', () => {
    expect(rundeLesen({ reihe: ['a', 'b', 'a'], pos: 9 })).toEqual({ reihe: ['a', 'b'], pos: 2 });
  });
});

// ── Ziel und Tempo-Verlauf ──
const am = (tag: number, stunde = 18, minute = 0) => new Date(2026, 9, tag, stunde, minute).getTime(); // Oktober 2026, Ortszeit

describe('Tagesbestes: je Übetag das schnellste Tempo', () => {
  it('Aufwärmen zieht den Tag nicht runter', () => {
    const tempi = [{ tempo: 80, am: am(1, 18) }, { tempo: 92, am: am(1, 18, 20) }, { tempo: 88, am: am(1, 18, 30) }, { tempo: 84, am: am(3, 9) }, { tempo: 96, am: am(3, 9, 15) }];
    expect(tagesbeste(tempi)).toEqual([
      { tag: am(1, 0), tempo: 92, alle: [80, 92, 88] },
      { tag: am(3, 0), tempo: 96, alle: [84, 96] },
    ]);
  });
  it('kurz vor und nach Mitternacht sind zwei Tage; Reihenfolge nach Zeit', () => {
    const tempi = [{ tempo: 100, am: am(2, 0, 5) }, { tempo: 90, am: am(1, 23, 55) }];
    expect(tagesbeste(tempi).map((t) => t.tempo)).toEqual([90, 100]);
  });
  it('ohne Tempi leer', () => {
    expect(tagesbeste([])).toEqual([]);
  });
});

describe('Steigerung: bestes jetzt gegenüber dem besten vor drei Wochen', () => {
  const jetzt = am(30, 20);
  it('mit Übetagen vor der Grenze: deren Bestes ist der Ausgangspunkt', () => {
    const tempi = [{ tempo: 80, am: am(2) }, { tempo: 92, am: am(8) }, { tempo: 100, am: am(20) }, { tempo: 110, am: am(29) }, { tempo: 96, am: am(30) }];
    expect(steigerung(tempi, jetzt)).toEqual({ von: 92, bis: 110, prozent: 20, seit: jetzt - 21 * 86_400_000, seitBeginn: false });
  });
  it('alles jünger als drei Wochen: seit dem ersten Übetag', () => {
    const tempi = [{ tempo: 70, am: am(20, 18) }, { tempo: 80, am: am(20, 19) }, { tempo: 100, am: am(28) }];
    expect(steigerung(tempi, jetzt)).toEqual({ von: 80, bis: 100, prozent: 25, seit: am(20, 0), seitBeginn: true });
  });
  it('nur ein Übetag: noch nichts zu vergleichen', () => {
    expect(steigerung([{ tempo: 70, am: am(29) }, { tempo: 90, am: am(29, 19) }], jetzt)).toBeNull();
    expect(steigerung([], jetzt)).toBeNull();
  });
  it('drei Wochen nicht geübt: gehalten, 0 %', () => {
    expect(steigerung([{ tempo: 90, am: am(1) }, { tempo: 100, am: am(3) }], jetzt)?.prozent).toBe(0);
  });
});

describe('Ziel und Reserve', () => {
  it('Reserve: 10 % über dem Ziel, gerundet', () => {
    expect(reserveVon(120)).toBe(132);
    expect(reserveVon(96)).toBe(106);
  });
  it('Stand zum Ziel: Anteil, was fehlt, Stufe', () => {
    expect(zielStand(108, 120)).toEqual({ anteil: 0.9, fehlt: 12, stufe: 'offen' });
    expect(zielStand(124, 120)).toEqual({ anteil: 124 / 120, fehlt: 0, stufe: 'ziel' });
    expect(zielStand(132, 120)).toEqual({ anteil: 1.1, fehlt: 0, stufe: 'reserve' });
    expect(zielStand(null, 120)).toEqual({ anteil: 0, fehlt: 120, stufe: 'offen' });
    expect(zielStand(100, null)).toBeNull();
  });
  it('Ziel aus der Eingabe: Schläge pro Minute 20–400, sonst keins', () => {
    expect(zielAusText('120')).toBe(120);
    expect(zielAusText(' ♩ = 96 ')).toBe(96);
    expect(zielAusText('')).toBeNull();
    expect(zielAusText('5')).toBeNull();
    expect(zielAusText('999')).toBeNull();
  });
});

describe('Achse der Tempo-Kurve', () => {
  it('runde Striche, Platz über dem Höchsten (Deckel) und unter dem Tiefsten', () => {
    expect(tempoAchse([72, 96, 120, 132])).toEqual({ min: 60, max: 140, striche: [60, 80, 100, 120, 140] });
  });
  it('ein einzelner Wert steht in der Mitte', () => {
    expect(tempoAchse([100])).toEqual({ min: 95, max: 105, striche: [95, 100, 105] });
  });
  it('enge Spanne: feinere Striche', () => {
    expect(tempoAchse([84, 92])).toEqual({ min: 80, max: 95, striche: [80, 85, 90, 95] });
  });
});

describe('Stellen-Mix: Bereich (Sammlung, nur offene, nur Favoriten)', () => {
  const s = (id: string, stueckId: string, zielTempo: number | null = null, tempi: { tempo: number; am: number }[] = [], favorit?: boolean) =>
    ({ id, stueckId, zielTempo, tempi, ...(favorit === undefined ? {} : { favorit }) });
  const alle = { offen: false, favoriten: false };
  const offen = { offen: true, favoriten: false };
  it('offen: ohne Ziel, oder Ziel samt Reserve noch nicht geschafft', () => {
    expect(stelleOffen(s('a', 'n'))).toBe(true);
    expect(stelleOffen(s('a', 'n', 120, [{ tempo: 125, am: 1 }]))).toBe(true);
    expect(stelleOffen(s('a', 'n', 120, [{ tempo: 132, am: 1 }]))).toBe(false);
  });
  it('Favorit: nur wer ausdrücklich markiert ist', () => {
    expect(stelleFavorit(s('a', 'n', null, [], true))).toBe(true);
    expect(stelleFavorit(s('a', 'n', null, [], false))).toBe(false);
    expect(stelleFavorit(s('a', 'n'))).toBe(false);
  });
  it('wählt die Stellen der Sammlung, auf Wunsch nur offene — Behaltenes bleibt drin', () => {
    const liste = [s('a1', 'A'), s('a2', 'A', 100, [{ tempo: 110, am: 1 }]), s('b1', 'B'), s('c1', 'C', 100, [{ tempo: 111, am: 1 }])];
    const inSammlung = (x: { stueckId: string }) => x.stueckId !== 'B';
    expect(mixAuswahl(liste, inSammlung, alle).map((x) => x.id)).toEqual(['a1', 'a2', 'c1']);
    expect(mixAuswahl(liste, inSammlung, offen).map((x) => x.id)).toEqual(['a1']);
    // schon geübt bzw. gerade dran: bleibt in der Runde, auch wenn jetzt geschafft
    expect(mixAuswahl(liste, inSammlung, offen, new Set(['c1'])).map((x) => x.id)).toEqual(['a1', 'c1']);
  });
  it('nur Favoriten, auch zusammen mit nur offenen — Behaltenes bleibt drin', () => {
    const liste = [
      s('a1', 'A', null, [], true), s('a2', 'A', 100, [{ tempo: 110, am: 1 }], true), s('a3', 'A'),
      s('b1', 'B', null, [], true), s('c1', 'C', null, [], false),
    ];
    const inSammlung = (x: { stueckId: string }) => x.stueckId !== 'B';
    expect(mixAuswahl(liste, inSammlung, { offen: false, favoriten: true }).map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(mixAuswahl(liste, inSammlung, { offen: true, favoriten: true }).map((x) => x.id)).toEqual(['a1']);
    // Stern inzwischen weg, aber schon dran gewesen: bleibt in der Runde
    expect(mixAuswahl(liste, inSammlung, { offen: false, favoriten: true }, new Set(['a3'])).map((x) => x.id)).toEqual(['a1', 'a2', 'a3']);
  });
  it('jeder Bereich hat seine eigene Runde; „alle“ behält den bisherigen Speicherplatz', () => {
    const b = (sammlung: string | null, tag: string | null, offen: boolean, favoriten = false) => ({ sammlung, tag, offen, favoriten });
    expect(mixSchluessel(b(null, null, false))).toBe('ueben:mix');
    expect(mixSchluessel(b('Märsche', null, false))).toBe('ueben:mix:Märsche');
    expect(mixSchluessel(b(null, null, true))).toBe('ueben:mix:offen:*');
    expect(mixSchluessel(b('Märsche', 't1', false))).toBe('ueben:mix:Märsche#t1');
    // Favoriten: eigener Platz, die bisherigen bleiben unverändert
    expect(mixSchluessel(b(null, null, false, true))).toBe('ueben:mix:fav:*');
    expect(mixSchluessel(b('2026', null, true, true))).toBe('ueben:mix:offen:fav:2026');
    expect(mixSchluessel(b('2026', 't1', false, true))).toBe('ueben:mix:fav:2026#t1');
  });
  it('gespeicherter Bereich: alt „true“ heißt alle, ohne Tag heißt kein Tag, ohne Favoriten heißt alle Stellen', () => {
    expect(mixBereichLesen(true)).toEqual({ sammlung: null, tag: null, offen: false, favoriten: false });
    expect(mixBereichLesen({ sammlung: 'Jazz', offen: true })).toEqual({ sammlung: 'Jazz', tag: null, offen: true, favoriten: false });
    expect(mixBereichLesen({ sammlung: null, tag: 't1', offen: false })).toEqual({ sammlung: null, tag: 't1', offen: false, favoriten: false });
    expect(mixBereichLesen({ sammlung: '2026', favoriten: true })).toEqual({ sammlung: '2026', tag: null, offen: false, favoriten: true });
    expect(mixBereichLesen(false)).toBeNull();
    expect(mixBereichLesen({ sammlung: 3, favoriten: 'ja' })).toEqual({ sammlung: null, tag: null, offen: false, favoriten: false });
  });
});

describe('Stellen-Mix: Texte je Auswahl', () => {
  const alle = { offen: false, favoriten: false };
  const offen = { offen: true, favoriten: false };
  const fav = { offen: false, favoriten: true };
  const beide = { offen: true, favoriten: true };
  it('Menge: Stellen, offene, Favoriten — Einzahl und kurz', () => {
    expect(mixMenge(9, alle)).toBe('9 Stellen');
    expect(mixMenge(1, alle)).toBe('1 Stelle');
    expect(mixMenge(5, offen)).toBe('5 offene Stellen');
    expect(mixMenge(4, fav)).toBe('4 Favoriten');
    expect(mixMenge(1, fav)).toBe('1 Favorit');
    expect(mixMenge(3, beide)).toBe('3 offene Favoriten');
    expect(mixMenge(1, beide)).toBe('1 offener Favorit');
    // kurz (Zeile in der Bibliothek): „Stellen“ darf bei „offene“ fehlen
    expect(mixMenge(5, offen, true)).toBe('5 offene');
    expect(mixMenge(9, alle, true)).toBe('9 Stellen');
    expect(mixMenge(3, beide, true)).toBe('3 offene Favoriten');
  });
  it('leer: was fehlt, kurz und mit Hinweis', () => {
    expect(mixLeer(alle, '2026', 0)).toEqual({ kurz: 'noch keine Stellen', lang: 'In „2026“ sind noch keine Stellen markiert.' });
    expect(mixLeer(fav, null, 0).lang).toBe('In deinen Noten sind noch keine Stellen markiert.');
    expect(mixLeer(fav, '2026', 6)).toEqual({ kurz: 'keine Favoriten', lang: 'Keine Favoriten in „2026“. Beim Üben auf ☆ vor dem Namen der Stelle tippen.' });
    expect(mixLeer(offen, '2026', 6)).toEqual({ kurz: 'keine offenen', lang: 'Keine offenen Stellen in „2026“ – alles mit Reserve geschafft.' });
    expect(mixLeer(beide, null, 6)).toEqual({ kurz: 'keine offenen Favoriten', lang: 'Keine offenen Favoriten.' });
  });
  it('fertig: wer einmal dran war', () => {
    expect(mixFertigText(4, fav, '2026')).toBe('Alle 4 Favoriten aus „2026“ waren einmal dran.');
    expect(mixFertigText(5, offen, null)).toBe('Alle 5 offenen Stellen waren einmal dran.');
    expect(mixFertigText(3, beide, '2026')).toBe('Alle 3 offenen Favoriten aus „2026“ waren einmal dran.');
    expect(mixFertigText(1, alle, '2026')).toBe('Die eine Stelle aus „2026“ war einmal dran.');
    expect(mixFertigText(1, beide, null)).toBe('Der eine offene Favorit war einmal dran.');
  });
  it('Kopf beim Üben: Kürzel vor der Zählung, wird es eng, fällt erst der Bereich, dann „offen“, dann der Stern', () => {
    expect(mixKopf('2026', alle, 3, 9)).toEqual({ formen: ['Mix 2026 · 3 von 9', 'Mix · 3 von 9'], aria: 'Stellen-Mix aus 2026, Stelle 3 von 9' });
    expect(mixKopf('2026', beide, 3, 9)).toEqual({
      formen: ['Mix 2026 · ★ offen · 3 von 9', 'Mix ★ offen · 3 von 9', 'Mix ★ · 3 von 9', 'Mix ★ 3 von 9', 'Mix · 3 von 9'],
      aria: 'Stellen-Mix aus 2026, nur offene Favoriten, Stelle 3 von 9',
    });
    expect(mixKopf(null, fav, 1, 4)).toEqual({ formen: ['Mix ★ · 1 von 4', 'Mix ★ 1 von 4', 'Mix · 1 von 4'], aria: 'Stellen-Mix, nur Favoriten, Stelle 1 von 4' });
    expect(mixKopf('2026', offen, 2, 5).formen).toEqual(['Mix 2026 · offen · 2 von 5', 'Mix offen · 2 von 5', 'Mix · 2 von 5']);
    expect(mixKopf(null, alle, 2, 5)).toEqual({ formen: ['Mix · 2 von 5'], aria: 'Stellen-Mix, Stelle 2 von 5' });
  });
});
