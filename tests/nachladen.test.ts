import { describe, expect, it } from 'vitest';
import { istNachladeFehler } from '@/domain/nachladen';

const fehler = (message: string, name = 'Error') => Object.assign(new Error(message), { name });

describe('Nachlade-Fehler erkennen', () => {
  it('erkennt fehlende Code-Stücke in allen Browsern', () => {
    expect(istNachladeFehler(fehler('irgendwas', 'ChunkLoadError'))).toBe(true);
    expect(istNachladeFehler(fehler('Loading chunk 412 failed.'))).toBe(true);
    expect(istNachladeFehler(fehler('Failed to load chunk /_next/static/chunks/abc.js from module 123'))).toBe(true);
    expect(istNachladeFehler(new TypeError('Failed to fetch dynamically imported module: https://x/_next/a.js'))).toBe(true);
    expect(istNachladeFehler(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(istNachladeFehler(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(istNachladeFehler(fehler('Setting up fake worker failed: "Failed to fetch".'))).toBe(true);
  });

  it('lässt andere Fehler durch', () => {
    expect(istNachladeFehler(fehler('Invalid PDF structure.', 'InvalidPDFException'))).toBe(false);
    expect(istNachladeFehler(fehler('nicht mehr auf diesem Gerät'))).toBe(false);
    expect(istNachladeFehler(null)).toBe(false);
    expect(istNachladeFehler('Loading chunk 1 failed')).toBe(false);
  });
});
