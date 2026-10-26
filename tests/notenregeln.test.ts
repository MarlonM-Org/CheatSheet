import { describe, expect, it } from 'vitest';
import { tonartFinden, type Raster, type Stimme, type Takt } from '@/domain/notation';
import { pruefen } from '@/domain/notenregeln';
import { aufBlatt, leererTakt } from '@/domain/notensatz';

const B: Raster = aufBlatt({ bpm: 100, zaehler: 4, nenner: 4, feinheit: 16 }); // 96 Zellen je Takt
const takt = (...noten: [number | null, number, boolean?][]): Takt => ({ noten: noten.map(([midi, dauer, b]) => (b ? { midi, dauer, bindung: true } : { midi, dauer })) });
const stimme = (takte: Takt[], name = '', schluessel: 'violin' | 'bass' = 'violin'): Stimme => ({ name, schluessel, takte });
const texte = (h: ReturnType<typeof pruefen>) => h.map((x) => x.text);

describe('Notationsregeln', () => {
  it('meldet nichts bei einem sauberen Takt', () => {
    expect(pruefen([stimme([takt([60, 24], [62, 24], [64, 24], [null, 24])])], B, null, { umfang: { von: 55, bis: 79 } })).toEqual([]);
  });
  it('Tonumfang: einmal je Takt, mit Richtung', () => {
    const h = pruefen([stimme([takt([84, 24], [86, 24], [null, 48]), takt([50, 96])])], B, null, { umfang: { von: 55, bis: 79 } });
    expect(texte(h)).toEqual(['Takt 1: C6 liegt über dem Tonumfang (bis G5).', 'Takt 2: D3 liegt unter dem Tonumfang (ab G3).']);
    expect(h[0]).toMatchObject({ stimme: 0, takt: 0, art: 'spielbar' });
    expect(pruefen([stimme([takt([84, 96])])], B, null, {})).toEqual([]);
  });
  it('großer Sprung über eine Oktave, Pausen dazwischen zählen nicht als Sprung', () => {
    expect(texte(pruefen([stimme([takt([60, 24], [76, 24], [null, 48])])], B, null))).toEqual(['Takt 1: Sprung C4 → E5 (16 Halbtöne) — schwer zu treffen.']);
    expect(pruefen([stimme([takt([60, 24], [null, 24], [76, 48])])], B, null)).toEqual([]);
    expect(pruefen([stimme([takt([60, 24], [72, 72])])], B, null)).toEqual([]);
  });
  it('punktierter Wert in einer Triole', () => {
    const t: Takt = { noten: [{ midi: 60, dauer: 12, triole: true, gruppe: 2 }, { midi: 62, dauer: 4, triole: true }, { midi: null, dauer: 72 }] };
    expect(texte(pruefen([stimme([t])], B, null))).toEqual(['Takt 1: punktierter Wert in einer Triole — schwer zu lesen; lieber zwei gebundene Noten.']);
  });
  it('keine Pause zum Atmen ab acht Takten', () => {
    const voll = takt([60, 48], [62, 48]);
    expect(pruefen([stimme(Array.from({ length: 7 }, () => voll))], B, null)).toEqual([]);
    expect(texte(pruefen([stimme(Array.from({ length: 8 }, () => voll))], B, null))).toEqual(['Takt 1–8: keine Pause zum Atmen.']);
    const mitPause = [...Array.from({ length: 5 }, () => voll), takt([60, 48], [null, 48]), ...Array.from({ length: 9 }, () => voll)];
    expect(texte(pruefen([stimme(mitPause)], B, null))).toEqual(['Takt 7–15: keine Pause zum Atmen.']);
  });
  it('Stimmen, die sich kreuzen, mit Namen', () => {
    const h = pruefen([stimme([takt([60, 48], [64, 48])], 'Melodie'), stimme([takt([55, 48], [67, 48])], 'Bass', 'bass')], B, null);
    expect(texte(h)).toEqual(['Takt 1: Bass liegt über Melodie.']);
    expect(h[0]).toMatchObject({ stimme: 1, takt: 0 });
  });
  it('schlägt eine passendere Tonart vor', () => {
    // Dreimal die G-Dur-Leiter (mit Fis) bei eingestelltem C-Dur: 3 Fremde hier, 0 in G.
    const t = takt([67, 12], [69, 12], [71, 12], [72, 12], [74, 12], [76, 12], [78, 12], [79, 12]);
    const h = pruefen([stimme([t, t, t])], B, tonartFinden('C'));
    expect(texte(h)).toEqual(['3 Töne liegen außerhalb von C-Dur — in G-Dur wären es 0. Tonart prüfen.']);
    expect(pruefen([stimme([t, t, t])], B, tonartFinden('G'))).toEqual([]);
  });
  it('Aufbau: Auftakt-Hinweis und leere Takte am Ende', () => {
    expect(texte(pruefen([stimme([takt([null, 72], [60, 24]), takt([62, 96])])], B, null))).toEqual(['Takt 1 beginnt mit 3 Schlägen Pause — ein Auftakt wäre üblich.']);
    expect(texte(pruefen([stimme([takt([60, 96]), leererTakt(B), leererTakt(B)])], B, null))).toEqual(['Takt 2–3 sind leer — „Takt −“ nimmt sie weg.']);
    expect(texte(pruefen([stimme([takt([60, 96]), leererTakt(B)])], B, null))).toEqual(['Takt 2 ist leer — „Takt −“ nimmt ihn weg.']);
    expect(pruefen([stimme([leererTakt(B)])], B, null)).toEqual([]);
  });
  it('sortiert nach Takt, Allgemeines zuerst', () => {
    const h = pruefen([stimme([takt([60, 96]), takt([84, 96]), leererTakt(B)])], B, null, { umfang: { von: 55, bis: 79 } });
    expect(h.map((x) => x.takt)).toEqual([1, 1, 2]); // Umfang und Sprung in Takt 2, leerer Takt 3
  });
});
