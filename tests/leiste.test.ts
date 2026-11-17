import { describe, expect, it } from 'vitest';
import { ortTippen, ortUmschalten } from '@/domain/leiste';

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

// Auf dem iPad liegen Werkzeuge als ganze Seite über Lernen, die Leiste
// bleibt bedienbar. Ein Tipp auf den offenen Ort führt dann zu seiner
// Übersicht zurück (wie ein Tab auf dem iPhone), statt alles zu schließen.
describe('ortTippen', () => {
  it('Unterseite offen: zurück zur Übersicht, der Ort bleibt', () => {
    expect(ortTippen('lernen', 'lernen', true)).toEqual({ ort: 'lernen', zurUebersicht: true });
  });
  it('ohne Unterseite: wie ortUmschalten', () => {
    expect(ortTippen('lernen', 'lernen', false)).toEqual({ ort: null, zurUebersicht: false });
    expect(ortTippen(null, 'lernen', false)).toEqual({ ort: 'lernen', zurUebersicht: false });
  });
  it('der andere Ort ersetzt die Unterseite samt Ort', () => {
    expect(ortTippen('lernen', 'bibliothek', true)).toEqual({ ort: 'bibliothek', zurUebersicht: false });
  });
});
