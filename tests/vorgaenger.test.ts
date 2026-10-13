import { describe, expect, it } from 'vitest';
import { dateiQuelle, ohneDatei } from '@/domain/vorgaenger';

describe('Wo die PDF-Datei eines Stücks in „ueben“ liegt', () => {
  const bytes = { id: 'a', daten: new ArrayBuffer(8), typ: 'application/pdf' };
  it('erst im eigenen Speicher (Bytes), dann der alte Blob im Datensatz, sonst keine', () => {
    expect(dateiQuelle(bytes, { datei: new Blob(['x']) })).toBe('dateien');
    expect(dateiQuelle(undefined, { datei: new Blob(['x']) })).toBe('datensatz');
    expect(dateiQuelle(undefined, {})).toBe('keine');
    expect(dateiQuelle({ id: 'a' }, {})).toBe('keine'); // kaputter Eintrag ohne Bytes
  });
  it('Datensatz ohne Datei und Dateiverweis: alles andere bleibt', () => {
    const n = { id: 'a', titel: 'T', stimme: '', erstellt: 1, datei: new Blob(['x']), handle: { name: 'a.pdf' }, zuletzt: 5 };
    expect(ohneDatei(n)).toEqual({ id: 'a', titel: 'T', stimme: '', erstellt: 1, zuletzt: 5 });
    expect('datei' in ohneDatei(n)).toBe(false);
    expect('handle' in ohneDatei(n)).toBe(false);
  });
});
