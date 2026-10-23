import { describe, expect, it } from 'vitest';
import type { Anmerkung } from '@/domain/notenpult';
import { getroffen, radierZug } from '@/domain/notenpult';
import {
  ABSTAND_MIN, aufsBlatt, dehnung, luecken, rechteckGedehnt, schnittEntfernen, schnittSetzen, schnitteVon, stickerAus, stickerBewegen, stickerGetroffen,
  stickerHoehe, stickerSkalieren, teilstuecke, zurSeite,
} from '@/domain/schnitte';

const s1 = { id: 'a', y: 0.4, abstand: 0.2 }, s2 = { id: 'b', y: 0.7, abstand: 0.1 };
const strich = (id: string, luecke?: string): Anmerkung => ({ id, art: 'stift', farbe: '#000', breite: 0.002, punkte: [0.1, 0.1, 0.2, 0.2], ...(luecke ? { luecke } : {}) });

describe('Schnitte: Teilstücke, Lücken, Dehnung', () => {
  it('sortiert nach Höhe, dehnt um die Summe der Abstände', () => {
    const s = schnitteVon([strich('x'), { art: 'schnitt', ...s2 }, { art: 'schnitt', ...s1 }]);
    expect(s.map((x) => x.id)).toEqual(['a', 'b']);
    expect(dehnung(s)).toBeCloseTo(1.3);
    expect(dehnung([])).toBe(1);
  });
  it('Teilstücke rücken um die Abstände über ihnen', () => {
    const n = (v: number) => expect.closeTo(v, 9);
    expect(teilstuecke([s1, s2])).toEqual([{ y0: 0, y1: 0.4, versatz: 0 }, { y0: 0.4, y1: 0.7, versatz: n(0.2) }, { y0: 0.7, y1: 1, versatz: n(0.3) }]);
    expect(teilstuecke([])).toEqual([{ y0: 0, y1: 1, versatz: 0 }]);
    expect(luecken([s1, s2])).toEqual([{ id: 'a', oben: 0.4, abstand: 0.2 }, { id: 'b', oben: n(0.9), abstand: 0.1 }]);
  });
});

describe('Vom Blatt auf die Seite und zurück', () => {
  const s = [s1, s2];
  it('über dem Schnitt unverändert, darunter um den Abstand verschoben', () => {
    expect(zurSeite(s, 0.3)).toEqual({ luecke: null, y: 0.3, bezug: 0 });
    expect(zurSeite(s, 0.65).y).toBeCloseTo(0.45);
    expect(zurSeite(s, 0.65).bezug).toBeCloseTo(0.2);
    expect(zurSeite(s, 1.2).y).toBeCloseTo(0.9);
  });
  it('in der Lücke: ab deren Oberkante', () => {
    expect(zurSeite(s, 0.5)).toEqual({ luecke: 'a', y: expect.closeTo(0.1, 9), bezug: expect.closeTo(0.4, 9) });
    expect(zurSeite(s, 0.95)).toEqual({ luecke: 'b', y: expect.closeTo(0.05, 9), bezug: expect.closeTo(0.9, 9) });
  });
  it('ein Rechteck über einen Schnitt hinweg wird um die Lücke länger', () => {
    expect(rechteckGedehnt(s, { x: 0.1, y: 0.3, b: 0.8, h: 0.3 })).toEqual({ x: 0.1, y: expect.closeTo(0.3 / 1.3, 9), b: 0.8, h: expect.closeTo(0.5 / 1.3, 9) });
    expect(rechteckGedehnt([], { x: 0, y: 0.2, b: 1, h: 0.5 })).toEqual({ x: 0, y: 0.2, b: 1, h: expect.closeTo(0.5, 9) });
  });
  it('aufsBlatt ist die Umkehrung', () => {
    for (const y of [0.1, 0.4, 0.45, 0.7, 0.95]) expect(zurSeite(s, aufsBlatt(s, y)).y).toBeCloseTo(y);
    expect(aufsBlatt(s, 0.1, 'a')).toBeCloseTo(0.5);
    expect(aufsBlatt(s, 0.05, 'b')).toBeCloseTo(0.95);
    expect(aufsBlatt([], 0.33)).toBe(0.33);
    // Genau auf dem Schnitt: gehört zum Teil darüber.
    expect(aufsBlatt(s, 0.4)).toBeCloseTo(0.4);
  });
});

describe('Schnitt setzen und entfernen', () => {
  it('legt an, verändert, entfernt unter dem Mindestabstand — samt Lücken-Anmerkungen', () => {
    let o: Anmerkung[] = [strich('x')];
    o = schnittSetzen(o, 'a', 0.4, 0.2);
    expect(o).toHaveLength(2);
    o = [...o, strich('inLuecke', 'a')];
    o = schnittSetzen(o, 'a', 0.45, 0.3);
    expect(schnitteVon(o)).toEqual([{ id: 'a', y: 0.45, abstand: 0.3 }]);
    o = schnittSetzen(o, 'a', 0.45, ABSTAND_MIN / 2);
    expect(o.map((x) => x.id)).toEqual(['x']);
    expect(schnittEntfernen([strich('x'), strich('y', 'a'), { id: 'a', art: 'schnitt', y: 0.4, abstand: 0.2 }], 'a').map((x) => x.id)).toEqual(['x']);
  });
  it('Höhe bleibt im Blatt, Abstand höchstens eine Seite', () => {
    const o = schnittSetzen([], 'a', 1.5, 9);
    expect(schnitteVon(o)).toEqual([{ id: 'a', y: 0.98, abstand: 1 }]);
  });
  it('Radierer lässt Schnitte und Sticker in Ruhe', () => {
    const schnitt: Anmerkung = { id: 'a', art: 'schnitt', y: 0.4, abstand: 0.2 };
    const sticker: Anmerkung = { id: 's', art: 'sticker', von: { seite: 1, x: 0, y: 0, b: 0.5, h: 0.2 }, x: 0.1, y: 0.1, b: 0.5 };
    expect(getroffen(schnitt, 0.5, 0.4, 0.1)).toBe(false);
    expect(getroffen(sticker, 0.2, 0.15, 0.1)).toBe(false);
    const r = radierZug([schnitt, sticker], 0.2, 0.15, 0.1, 1.414, null, false, () => 'n');
    expect(r.geaendert).toBe(false);
    expect(r.objekte).toEqual([schnitt, sticker]);
  });
});

describe('Sticker', () => {
  const st = stickerAus('s', 2, { x: 0.1, y: 0.2, b: 0.5, h: 0.1 });
  it('liegt etwas versetzt über dem Ausschnitt, Höhe folgt dem Seitenverhältnis', () => {
    expect(st.von).toEqual({ seite: 2, x: 0.1, y: 0.2, b: 0.5, h: 0.1 });
    expect(st.x).toBeCloseTo(0.14); expect(st.y).toBeCloseTo(0.24); expect(st.b).toBe(0.5);
    expect(stickerHoehe(st)).toBeCloseTo(0.1);
    expect(stickerHoehe(stickerSkalieren(st, 0.25))).toBeCloseTo(0.05);
    expect(stickerAus('s', 1, { x: 0.8, y: 0.95, b: 0.2, h: 0.05 })).toMatchObject({ x: 0.8, y: 0.95 });
  });
  it('bleibt mit einem Viertel im Bild, Breite zwischen 5 % und ganz', () => {
    expect(stickerBewegen(st, -5, 0).x).toBeCloseTo(-0.375);
    expect(stickerBewegen(st, 5, 5)).toMatchObject({ x: expect.closeTo(0.875, 9), y: expect.closeTo(0.975, 9) });
    expect(stickerSkalieren(st, 0.01).b).toBe(0.05);
    expect(stickerSkalieren(st, 3).b).toBe(1);
  });
  it('getroffen innerhalb des Rechtecks', () => {
    expect(stickerGetroffen(st, 0.3, 0.3)).toBe(true);
    expect(stickerGetroffen(st, 0.3, 0.5)).toBe(false);
  });
});
