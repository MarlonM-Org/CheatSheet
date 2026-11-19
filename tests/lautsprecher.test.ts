import { describe, expect, it } from 'vitest';
import {
  FRUEHERE_SCHALTER, LAUTSPRECHER_SCHLUESSEL, LAUTSPRECHER_STANDARD, lautsprecherAnfang, mikrofonWunsch, sitzungFuer,
} from '@/domain/lautsprecher';
import { istMitreisend } from '@/domain/einstellungen';

// localStorage als Tabelle: Werte als JSON-Text, `roh:` für kaputten Text.
const speicher = (werte: Record<string, unknown>) => (k: string) => {
  if (!(k in werte)) return null;
  const v = werte[k];
  return typeof v === 'string' && v.startsWith('roh:') ? v.slice(4) : JSON.stringify(v);
};

describe('Mikrofon je nach Lautsprecher (B-20)', () => {
  it('Lautsprecher an, Töne erkennen: Echo-Unterdrückung und Verstärkung (iPhone: Freisprechen, Ton aus dem Lautsprecher)', () => {
    expect(mikrofonWunsch(true, 'erkennen')).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: true });
  });
  it('Lautsprecher an, aufnehmen: Echo-Unterdrückung, aber keine Verstärkung (Instrumente pumpen sonst)', () => {
    expect(mikrofonWunsch(true, 'aufnehmen')).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: false });
  });
  it('Lautsprecher aus: rohes Mikrofon, gleich wofür (Kopfhörer; ohne kommt der Ton aus dem Hörer)', () => {
    const roh = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    expect(mikrofonWunsch(false, 'erkennen')).toEqual(roh);
    expect(mikrofonWunsch(false, 'aufnehmen')).toEqual(roh);
  });
  it('Rauschunterdrückung nie — sie nimmt gehaltene Töne als Dauergeräusch', () => {
    for (const an of [true, false]) for (const z of ['erkennen', 'aufnehmen'] as const) expect(mikrofonWunsch(an, z).noiseSuppression).toBe(false);
  });
});

describe('Audio-Sitzung (navigator.audioSession.type)', () => {
  it('ohne offenes Mikrofon: Wiedergabe — auch nach dem Mikrofon, sonst bliebe der Ton in Telefon-Lautstärke', () => {
    expect(sitzungFuer(0)).toBe('playback');
  });
  it('solange ein Mikrofon offen ist: Wiedergabe und Aufnahme (mit „playback“ stellte iOS das Mikrofon stumm)', () => {
    expect(sitzungFuer(1)).toBe('play-and-record');
    expect(sitzungFuer(3)).toBe('play-and-record');
  });
  it('ein verzählter Zähler fällt auf Wiedergabe zurück', () => {
    expect(sitzungFuer(-1)).toBe('playback');
    expect(sitzungFuer(Number.NaN)).toBe('playback');
  });
});

describe('Gemerkte Wahl (Gerät, reist nicht mit)', () => {
  it('Standard: Lautsprecher an', () => {
    expect(LAUTSPRECHER_STANDARD).toBe(true);
    expect(lautsprecherAnfang(speicher({}))).toBe(true);
  });
  it('die eigene Einstellung gilt', () => {
    expect(lautsprecherAnfang(speicher({ [LAUTSPRECHER_SCHLUESSEL]: false }))).toBe(false);
    expect(lautsprecherAnfang(speicher({ [LAUTSPRECHER_SCHLUESSEL]: true, 'ueben:einspiel-lautsprecher': false }))).toBe(true);
  });
  it('noch nichts gewählt: der Schalter beim Einsingen, dann „Mikrofon verstärken“ im Stimmgerät', () => {
    expect(FRUEHERE_SCHALTER).toEqual(['ueben:einspiel-lautsprecher', 'ueben:stimm-verstaerken']);
    expect(lautsprecherAnfang(speicher({ 'ueben:einspiel-lautsprecher': false }))).toBe(false);
    expect(lautsprecherAnfang(speicher({ 'ueben:stimm-verstaerken': false }))).toBe(false);
    expect(lautsprecherAnfang(speicher({ 'ueben:einspiel-lautsprecher': true, 'ueben:stimm-verstaerken': false }))).toBe(true);
    expect(lautsprecherAnfang(speicher({ 'ueben:einspiel-lautsprecher': false, 'ueben:stimm-verstaerken': true }))).toBe(false);
  });
  it('Unlesbares und Unpassendes zählt nicht', () => {
    expect(lautsprecherAnfang(speicher({ [LAUTSPRECHER_SCHLUESSEL]: 'roh:{kaputt', 'ueben:stimm-verstaerken': false }))).toBe(false);
    expect(lautsprecherAnfang(speicher({ [LAUTSPRECHER_SCHLUESSEL]: 'nein', 'ueben:einspiel-lautsprecher': 0 }))).toBe(true);
  });
  it('liegt am Gerät: reist nicht mit der Sicherung (Kopfhörer hat man am Gerät, nicht als Person)', () => {
    expect(istMitreisend(LAUTSPRECHER_SCHLUESSEL)).toBe(false);
    for (const k of FRUEHERE_SCHALTER) expect(istMitreisend(k)).toBe(false);
  });
});
