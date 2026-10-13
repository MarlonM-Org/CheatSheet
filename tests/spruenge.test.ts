import { describe, expect, it } from 'vitest';
import { ansichten, type Ansicht } from '@/domain/notenpult';
import {
  ansichtFinden, artVorschlag, einpassen, KUERZEL, punktSichtbar, seiteAn, setzenTippen, sichtbareMarken, spruengeLesen,
  sprungHinzufuegen, sprungLoeschen, sprungText, SPRUNG_ARTEN, zielAnsicht, type Sprung,
} from '@/domain/spruenge';

const p = (seite: number, x: number, y: number) => ({ seite, x, y });
const sprung = (id: string, von: ReturnType<typeof p>, nach: ReturnType<typeof p>, art: Sprung['art'] = 'ds'): Sprung => ({ id, von, nach, art });

describe('Sprünge lesen (Sicherung, ältere Stände)', () => {
  it('ohne Feld oder kaputt: leer', () => {
    expect(spruengeLesen(undefined)).toEqual([]);
    expect(spruengeLesen(null)).toEqual([]);
    expect(spruengeLesen({ a: 1 })).toEqual([]);
    expect(spruengeLesen('x')).toEqual([]);
  });
  it('behält stimmige, verwirft kaputte', () => {
    const gut = sprung('a', p(3, 0.5, 0.4), p(1, 0.1, 0.3));
    const liste = spruengeLesen([
      gut,
      { ...gut, id: '' },
      { ...gut, id: 'b', art: 'fine' },
      { ...gut, id: 'c', von: { seite: 0, x: 0.5, y: 0.5 } },
      { ...gut, id: 'd', von: { seite: 1.5, x: 0.5, y: 0.5 } },
      { ...gut, id: 'e', nach: { seite: 1, x: 'a', y: 0.5 } },
      { ...gut, id: 'f', nach: { seite: 1, x: Number.NaN, y: 0.5 } },
      { ...gut, id: 'g', nach: null },
      42,
    ]);
    expect(liste).toEqual([gut]);
  });
  it('säubert: Anteile in 0..1, gerundet, unbekannte Felder weg, doppelte ids einmal', () => {
    const liste = spruengeLesen([
      { id: 'a', von: { seite: 2, x: 1.2, y: -0.1, z: 9 }, nach: { seite: 1, x: 0.123456, y: 0.5 }, art: 'wdh', extra: true },
      { id: 'a', von: { seite: 3, x: 0.5, y: 0.5 }, nach: { seite: 1, x: 0.1, y: 0.1 }, art: 'dc' },
    ]);
    expect(liste).toEqual([sprung('a', p(2, 1, 0), p(1, 0.1235, 0.5), 'wdh')]);
  });
  it('sortiert nach Seite und Lage des Sprungzeichens', () => {
    const liste = spruengeLesen([
      sprung('c', p(3, 0.5, 0.2), p(1, 0, 0)),
      sprung('a', p(1, 0.5, 0.9), p(2, 0, 0), 'coda'),
      sprung('b', p(3, 0.5, 0.1), p(1, 0, 0)),
    ]);
    expect(liste.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Arten', () => {
  it('Kürzel für die Marke', () => {
    expect(SPRUNG_ARTEN).toEqual(['wdh', 'ds', 'dc', 'coda']);
    expect(SPRUNG_ARTEN.map((a) => KUERZEL[a])).toEqual(['Wdh.', 'D.S.', 'D.C.', 'Coda']);
  });
  it('Vorschlag: nach vorn Coda, zurück Wiederholung', () => {
    expect(artVorschlag(p(3, 0.5, 0.4), p(1, 0.1, 0.3))).toBe('wdh');
    expect(artVorschlag(p(2, 0.5, 0.4), p(2, 0.1, 0.3))).toBe('wdh');
    expect(artVorschlag(p(2, 0.5, 0.4), p(2, 0.1, 0.6))).toBe('coda');
    expect(artVorschlag(p(1, 0.5, 0.9), p(3, 0.1, 0.1))).toBe('coda');
  });
  it('Text für die Liste', () => {
    expect(sprungText(sprung('a', p(3, 0.5, 0.4), p(1, 0.1, 0.3)))).toBe('S. 3 → S. 1 · D.S.');
    expect(sprungText(sprung('a', p(2, 0.5, 0.4), p(4, 0.1, 0.3), 'coda'))).toBe('S. 2 → S. 4 · Coda');
  });
});

describe('Hinzufügen und Löschen', () => {
  const a = sprung('a', p(3, 0.5, 0.4), p(1, 0.1, 0.3));
  it('hängt an, rundet, hält die Liste sortiert', () => {
    const neu = sprungHinzufuegen([a], { von: p(1, 0.333333, 0.5), nach: p(3, 0.2, 0.1), art: 'coda' }, 'b');
    expect(neu).toEqual([sprung('b', p(1, 0.3333, 0.5), p(3, 0.2, 0.1), 'coda'), a]);
  });
  it('löscht nach id, andere bleiben', () => {
    const b = sprung('b', p(1, 0.5, 0.5), p(2, 0.5, 0.5), 'coda');
    expect(sprungLoeschen([a, b], 'a')).toEqual([b]);
    expect(sprungLoeschen([a, b], 'x')).toEqual([a, b]);
  });
});

describe('Welche Marken eine Ansicht zeigt', () => {
  const s1 = sprung('s1', p(3, 0.5, 0.4), p(1, 0.1, 0.3));
  const s2 = sprung('s2', p(3, 0.5, 0.75), p(2, 0.1, 0.1), 'coda');
  const s3 = sprung('s3', p(2, 0.5, 0.75), p(1, 0.1, 0.1), 'wdh');
  const alle = [s1, s2, s3];
  it('ganze Seite: alle Marken der Seite', () => {
    expect(sichtbareMarken(alle, { art: 'ganz', seite: 3 }).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(sichtbareMarken(alle, { art: 'ganz', seite: 1 })).toEqual([]);
  });
  it('halb: oben die nächste Seite bis zum Schnitt, darunter der Rest der aktuellen', () => {
    const halb: Ansicht = { art: 'halb', oben: 3, unten: 2, schnitt: 0.5 };
    expect(sichtbareMarken(alle, halb).map((s) => s.id)).toEqual(['s1', 's3']);
    expect(sichtbareMarken(alle, { ...halb, schnitt: 0.3 }).map((s) => s.id)).toEqual(['s3']);
    expect(sichtbareMarken(alle, { ...halb, schnitt: 0.8 }).map((s) => s.id)).toEqual(['s1', 's2']);
  });
  it('genau auf dem Schnitt gehört zur unteren Seite', () => {
    const halb: Ansicht = { art: 'halb', oben: 2, unten: 1, schnitt: 0.5 };
    expect(punktSichtbar(halb, p(2, 0.5, 0.5))).toBe(false);
    expect(punktSichtbar(halb, p(1, 0.5, 0.5))).toBe(true);
    expect(punktSichtbar(halb, p(2, 0.5, 0.4999))).toBe(true);
  });
  it('Seite unter dem Finger', () => {
    expect(seiteAn({ art: 'ganz', seite: 4 }, 0.9)).toBe(4);
    expect(seiteAn({ art: 'halb', oben: 3, unten: 2, schnitt: 0.6 }, 0.59)).toBe(3);
    expect(seiteAn({ art: 'halb', oben: 3, unten: 2, schnitt: 0.6 }, 0.6)).toBe(2);
  });
});

describe('Springen', () => {
  const s = sprung('s', p(3, 0.5, 0.4), p(1, 0.1, 0.3));
  it('Ziel-Ansicht: die ganze Zielseite, auch beim Halbseiten-Blättern', () => {
    expect(zielAnsicht(ansichten(3, 'ganz'), s.nach)).toBe(0);
    const halb = ansichten(3, 'halb');
    expect(halb[zielAnsicht(halb, p(2, 0.1, 0.9))!]).toEqual({ art: 'ganz', seite: 2 });
    expect(zielAnsicht(ansichten(3, 'linie', { 1: 0.4 }), p(3, 0, 0))).toBe(4);
  });
  it('Zielseite gibt es nicht (mehr): kein Sprung', () => {
    expect(zielAnsicht(ansichten(2, 'ganz'), p(5, 0.1, 0.1))).toBeNull();
  });
  it('zurück: dieselbe Ansicht wiederfinden, sonst die ganze Seite', () => {
    const halb = ansichten(3, 'halb');
    expect(ansichtFinden(halb, { art: 'halb', oben: 3, unten: 2, schnitt: 0.5 })).toBe(3);
    expect(ansichtFinden(halb, { art: 'ganz', seite: 3 })).toBe(4);
    // Inzwischen auf „ganz“ umgestellt: die obere Seite der Halb-Ansicht.
    expect(ansichtFinden(ansichten(3, 'ganz'), { art: 'halb', oben: 3, unten: 2, schnitt: 0.5 })).toBe(2);
  });
});

describe('Lage im Ausschnitt', () => {
  it('innen bleibt, außen rückt an den Rand des sichtbaren Bereichs', () => {
    const r = { x: 0.1, y: 0.2, b: 0.8, h: 0.6 };
    expect(einpassen({ x: 0.5, y: 0.5 }, r)).toEqual({ x: 0.5, y: 0.5 });
    expect(einpassen({ x: 0.05, y: 0.9 }, r)).toEqual({ x: 0.1, y: 0.8 });
    expect(einpassen({ x: 0.95, y: 0.1 }, r)).toEqual({ x: 0.9, y: 0.2 });
  });
});

describe('Sprung setzen: Schritt für Schritt', () => {
  it('erst das Sprungzeichen, dann das Ziel; erneutes Tippen versetzt das Ziel', () => {
    const z1 = setzenTippen({ schritt: 'von' }, p(3, 0.5, 0.4));
    expect(z1).toEqual({ schritt: 'nach', von: p(3, 0.5, 0.4) });
    const z2 = setzenTippen(z1, p(1, 0.1, 0.3));
    expect(z2).toEqual({ schritt: 'art', von: p(3, 0.5, 0.4), nach: p(1, 0.1, 0.3), art: 'wdh' });
    const z3 = setzenTippen({ ...z2, art: 'ds' } as typeof z2, p(1, 0.2, 0.35));
    expect(z3).toEqual({ schritt: 'art', von: p(3, 0.5, 0.4), nach: p(1, 0.2, 0.35), art: 'ds' });
  });
  it('Tippen neben die Seite zählt nicht', () => {
    const z = { schritt: 'von' } as const;
    expect(setzenTippen(z, p(1, -0.01, 0.5))).toBe(z);
    expect(setzenTippen(z, p(1, 0.5, 1.02))).toBe(z);
  });
});
