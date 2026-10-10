import { describe, expect, it } from 'vitest';
import { aufloesen, istDunkel, STANDARD_DUNKEL, STANDARD_HELL } from '@/domain/thema';

describe('Thema auflösen', () => {
  it('Modus hell/dunkel schlägt das System', () => {
    expect(aufloesen('hell', 'sommer', 'schwarz', true)).toBe('sommer');
    expect(aufloesen('dunkel', 'sommer', 'schwarz', false)).toBe('schwarz');
  });
  it('Modus system folgt der Systemeinstellung', () => {
    expect(aufloesen('system', 'weiss', 'dunkelblau', false)).toBe('weiss');
    expect(aufloesen('system', 'weiss', 'dunkelblau', true)).toBe('dunkelblau');
  });
  it('fehlende oder ungültige Werte fallen auf Standards zurück', () => {
    expect(aufloesen(null, null, null, false)).toBe(STANDARD_HELL);
    expect(aufloesen(undefined, undefined, undefined, true)).toBe(STANDARD_DUNKEL);
    expect(aufloesen('quatsch', 'lila', 'neongruen', true)).toBe(STANDARD_DUNKEL);
    // Ein dunkles Thema im Hell-Platz zählt nicht — die Plätze sind getrennt.
    expect(aufloesen('hell', 'schwarz', 'schwarz', false)).toBe(STANDARD_HELL);
  });
  it('kennt die Helligkeit der Themen', () => {
    expect(istDunkel('schwarz')).toBe(true);
    expect(istDunkel('dunkelblau')).toBe(true);
    expect(istDunkel('weiss')).toBe(false);
    expect(istDunkel('sommer')).toBe(false);
  });
});
