import { describe, expect, it } from 'vitest';
import { dateiQuelle, dateiVerloren, ohneDatei, speicherVoll, verbindungVerloren, zuletztAus } from '@/domain/speicher';

const fehler = (name: string) => Object.assign(new Error('x'), { name });

describe('Fehler des Gerätespeichers einordnen', () => {
  it('verlorene Verbindung lohnt einen neuen Versuch', () => {
    // Safari nach der Rückkehr aus dem Hintergrund: „Connection to Indexed Database server lost“
    expect(verbindungVerloren(fehler('UnknownError'))).toBe(true);
    // Transaktion auf einer schon geschlossenen Verbindung
    expect(verbindungVerloren(fehler('InvalidStateError'))).toBe(true);
  });
  it('andere Fehler nicht — der Vorgang selbst ist falsch oder der Speicher voll', () => {
    expect(verbindungVerloren(fehler('QuotaExceededError'))).toBe(false);
    expect(verbindungVerloren(fehler('ConstraintError'))).toBe(false);
    expect(verbindungVerloren(new Error('eigener Abbruch'))).toBe(false);
    expect(verbindungVerloren(null)).toBe(false);
    expect(verbindungVerloren('UnknownError')).toBe(false);
  });
  it('„voll“ nur, wenn der Speicher wirklich voll ist', () => {
    expect(speicherVoll(fehler('QuotaExceededError'))).toBe(true);
    expect(speicherVoll(fehler('UnknownError'))).toBe(false);
    expect(speicherVoll(undefined)).toBe(false);
  });
});

describe('Datei auf dem Gerät verloren', () => {
  it('Safari: „The object can not be found here“ bzw. nicht lesbar', () => {
    expect(dateiVerloren(fehler('NotFoundError'))).toBe(true);
    expect(dateiVerloren(fehler('NotReadableError'))).toBe(true);
    expect(dateiVerloren(fehler('UnknownError'))).toBe(false);
    expect(dateiVerloren(undefined)).toBe(false);
  });
});

describe('Zuletzt geöffnet', () => {
  it('nimmt den späteren Stand aus Liste und altem Datensatz', () => {
    expect(zuletztAus({ a: 200 }, { id: 'a', zuletzt: 100 })).toBe(200);
    expect(zuletztAus({ a: 50 }, { id: 'a', zuletzt: 100 })).toBe(100);
    expect(zuletztAus({}, { id: 'a' })).toBeUndefined();
    expect(zuletztAus({ b: 5 }, { id: 'a', zuletzt: 7 })).toBe(7);
  });
});

describe('Wo die PDF-Datei eines Stücks liegt', () => {
  const bytes = { id: 'a', daten: new ArrayBuffer(8), typ: 'application/pdf' };
  it('erst im eigenen Speicher (Bytes), dann der alte Blob im Datensatz, sonst keine', () => {
    expect(dateiQuelle(bytes, { datei: new Blob(['x']) })).toBe('dateien');
    expect(dateiQuelle(undefined, { datei: new Blob(['x']) })).toBe('datensatz');
    expect(dateiQuelle(undefined, {})).toBe('keine');
    expect(dateiQuelle({ id: 'a' }, {})).toBe('keine'); // kaputter Eintrag ohne Bytes
  });
  it('Datensatz ohne Datei: alles andere bleibt', () => {
    const n = { id: 'a', titel: 'T', stimme: '', erstellt: 1, datei: new Blob(['x']), zuletzt: 5 };
    expect(ohneDatei(n)).toEqual({ id: 'a', titel: 'T', stimme: '', erstellt: 1, zuletzt: 5 });
    expect('datei' in ohneDatei(n)).toBe(false);
  });
});
