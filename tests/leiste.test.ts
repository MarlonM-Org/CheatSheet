import { describe, expect, it } from 'vitest';
import { ortUmschalten } from '@/domain/leiste';

// Untere Leiste (B-18): Lernen und Noten sind Orte — ein Tipp zeigt den Ort,
// noch einer schließt ihn; der andere Ort weicht (ganzer Seitenwechsel).
describe('ortUmschalten', () => {
  it('öffnet den getippten Ort, wenn keiner offen ist', () => {
    expect(ortUmschalten(null, 'lernen')).toBe('lernen');
    expect(ortUmschalten(null, 'bibliothek')).toBe('bibliothek');
  });
  it('schließt den Ort, der schon offen ist', () => {
    expect(ortUmschalten('lernen', 'lernen')).toBeNull();
    expect(ortUmschalten('bibliothek', 'bibliothek')).toBeNull();
  });
  it('wechselt vom einen Ort zum anderen, statt zu schließen', () => {
    expect(ortUmschalten('lernen', 'bibliothek')).toBe('bibliothek');
    expect(ortUmschalten('bibliothek', 'lernen')).toBe('lernen');
  });
});
