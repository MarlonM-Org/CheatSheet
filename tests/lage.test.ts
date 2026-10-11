import { describe, expect, it } from 'vitest';
import { insBild } from '@/domain/lage';

describe('Gemerkte Lage ins Bild holen', () => {
  const fenster = { b: 393, h: 852 };
  const panel = { b: 300, h: 120 };
  it('eine sichtbare Lage bleibt, wie sie ist', () => {
    expect(insBild({ x: 40, y: 200 }, panel, fenster)).toEqual({ x: 40, y: 200 });
  });
  it('eine Lage aus einem breiteren Format (iPad, quer) rückt ins Bild', () => {
    expect(insBild({ x: 900, y: 1500 }, panel, fenster)).toEqual({ x: 393 - 300 - 4, y: 852 - 120 - 4 });
    expect(insBild({ x: -50, y: -20 }, panel, fenster)).toEqual({ x: 4, y: 4 });
  });
  it('ist das Panel breiter als das Fenster, bleibt der linke Rand sichtbar', () => {
    expect(insBild({ x: 100, y: 10 }, { b: 500, h: 120 }, fenster)).toEqual({ x: 4, y: 10 });
  });
});
