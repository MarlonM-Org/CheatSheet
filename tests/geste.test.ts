import { describe, expect, it } from 'vitest';
import { RAD_ANFANG, RAD_PAUSE, radGeste, radWeg, tastenAktion, WISCH_MIN, zeigerGeste, type Rad } from '@/domain/geste';

describe('Wischen: Finger oder Scroll-Ring', () => {
  it('nach oben oder links blättert weiter, nach unten oder rechts zurück', () => {
    expect(zeigerGeste(0, -120, 150)).toEqual({ art: 'wisch', richtung: 'hoch', weg: 120, aktion: 'weiter' });
    expect(zeigerGeste(5, 90, 150)).toEqual({ art: 'wisch', richtung: 'runter', weg: 90, aktion: 'zurueck' });
    expect(zeigerGeste(-80, 10, 150)).toMatchObject({ richtung: 'links', aktion: 'weiter' });
    expect(zeigerGeste(80, -10, 150)).toMatchObject({ richtung: 'rechts', aktion: 'zurueck' });
  });
  it('umgekehrt: nur hoch/runter tauschen, links/rechts bleibt', () => {
    expect(zeigerGeste(0, -120, 150, true)).toMatchObject({ richtung: 'hoch', aktion: 'zurueck' });
    expect(zeigerGeste(0, 120, 150, true)).toMatchObject({ richtung: 'runter', aktion: 'weiter' });
    expect(zeigerGeste(-80, 0, 150, true)).toMatchObject({ richtung: 'links', aktion: 'weiter' });
  });
  it('ab WISCH_MIN ein Wisch, auch langsam', () => {
    expect(zeigerGeste(0, -WISCH_MIN, 2000)).toMatchObject({ art: 'wisch' });
    expect(zeigerGeste(0, -(WISCH_MIN - 1), 100)).toEqual({ art: 'nichts', weg: WISCH_MIN - 1 });
  });
  it('kurz und kaum bewegt ist Tippen; lang gedrückt nichts', () => {
    expect(zeigerGeste(3, -4, 120)).toEqual({ art: 'tippen' });
    expect(zeigerGeste(3, -4, 900)).toEqual({ art: 'nichts', weg: 4 });
  });
});

describe('Mausrad: eine Bewegung blättert einmal', () => {
  const folge = (deltas: [number, number, number][], umkehren = false) => {
    let z: Rad = RAD_ANFANG;
    const aktionen: string[] = [];
    for (const [dx, dy, t] of deltas) {
      const r = radGeste(z, dx, dy, t, umkehren);
      z = r.z;
      if (r.aktion) aktionen.push(r.aktion);
    }
    return aktionen;
  };
  it('runter drehen blättert weiter, hoch zurück', () => {
    expect(folge([[0, 100, 0]])).toEqual(['weiter']);
    expect(folge([[0, -100, 0]])).toEqual(['zurueck']);
  });
  it('Trackpad mit Nachlauf: viele kleine Schritte ohne Pause → einmal', () => {
    const nachlauf: [number, number, number][] = Array.from({ length: 60 }, (_, i) => [0, 12, i * 16]);
    expect(folge(nachlauf)).toEqual(['weiter']);
  });
  it('nach einer Pause blättert die nächste Bewegung wieder', () => {
    expect(folge([[0, 100, 0], [0, 100, 50], [0, 100, 50 + RAD_PAUSE + 1]])).toEqual(['weiter', 'weiter']);
  });
  it('kleine Zuckungen blättern nicht', () => {
    expect(folge([[0, 10, 0], [0, 10, 400], [0, 10, 800]])).toEqual([]);
  });
  it('seitwärts: rechts weiter; umkehren betrifft nur hoch/runter', () => {
    expect(folge([[100, 0, 0]], true)).toEqual(['weiter']);
    expect(folge([[0, 100, 0]], true)).toEqual(['zurueck']);
  });
  it('Zeilen und Seiten in Pixel umrechnen', () => {
    expect(radWeg(3, 1, 800)).toBe(48);
    expect(radWeg(1, 2, 800)).toBe(800);
    expect(radWeg(42, 0, 800)).toBe(42);
  });
});

describe('Tasten: Blätterpedal und Tastatur', () => {
  it('Pfeile, Bild-Tasten, Leertaste', () => {
    expect(['ArrowRight', 'ArrowDown', 'PageDown', ' '].map(tastenAktion)).toEqual(['weiter', 'weiter', 'weiter', 'weiter']);
    expect(['ArrowLeft', 'ArrowUp', 'PageUp'].map(tastenAktion)).toEqual(['zurueck', 'zurueck', 'zurueck']);
    expect(tastenAktion('a')).toBeNull();
  });
});
