import { describe, expect, it } from 'vitest';
import { einspielenPlanen } from '@/domain/einspielen';
import { SicherungsFehler } from '@/domain/sicherung';

const note = (id: string, mehr: object = {}) => ({ id, titel: `Titel ${id}`, stimme: '', erstellt: 1, datei: new Blob(['%PDF']), ...mehr });
const stelle = (id: string, notenId: string) => ({ id, notenId, seite: 1, x: 0, y: 0, b: 1, h: 1, titel: '', notiz: '', zielTempo: null, tempi: [] });
const anm = (notenId: string, seite: number) => ({ id: `${notenId}:${seite}`, notenId, seite, objekte: [] });

describe('Sicherung einspielen planen', () => {
  it('trennt neue und schon vorhandene Noten', () => {
    const plan = einspielenPlanen({ noten: [note('a'), note('b'), note('c')], stellen: [stelle('s1', 'a')], anmerkungen: [anm('b', 1)] }, new Set(['b', 'x']));
    expect(plan.neu).toBe(2);
    expect(plan.ersetzt).toEqual(['b']);
    expect(plan.stellen).toHaveLength(1);
    expect(plan.anmerkungen).toHaveLength(1);
    expect(plan.uebersprungen).toBe(0);
  });

  it('überspringt Stellen und Anmerkungen ohne Noten und zählt sie', () => {
    const plan = einspielenPlanen({
      noten: [note('a')],
      stellen: [stelle('s1', 'a'), stelle('s2', 'weg'), stelle('s3', 'geraet')],
      anmerkungen: [anm('weg', 1), anm('a', 2)],
    }, new Set(['geraet']));
    expect(plan.stellen.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(plan.anmerkungen.map((a) => a.id)).toEqual(['a:2']);
    expect(plan.uebersprungen).toBe(2);
  });

  it('weist ungültige Noten ab', () => {
    const leer = { stellen: [], anmerkungen: [] };
    for (const kaputt of [note('a', { titel: 3 }), note('a', { stimme: null }), note('a', { erstellt: '1' }), note('a', { erstellt: Number.NaN })]) {
      expect(() => einspielenPlanen({ noten: [kaputt], ...leer }, new Set())).toThrow(SicherungsFehler);
    }
    expect(() => einspielenPlanen({ noten: [null as unknown as { id: string }], ...leer }, new Set())).toThrow(/Noteneintrag/);
  });

  it('weist Stellen und Anmerkungen ohne gültige Zuordnung ab', () => {
    const n = [note('a')];
    expect(() => einspielenPlanen({ noten: n, stellen: [{ id: 's', notenId: 7 }], anmerkungen: [] }, new Set())).toThrow(/Stelle/);
    expect(() => einspielenPlanen({ noten: n, stellen: ['s'], anmerkungen: [] }, new Set())).toThrow(/Stelle/);
    expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [null] }, new Set())).toThrow(/Anmerkung/);
    expect(() => einspielenPlanen({ noten: n, stellen: [], anmerkungen: [[]] }, new Set())).toThrow(/Anmerkung/);
  });

  it('geht ganz leer', () => {
    expect(einspielenPlanen({ noten: [], stellen: [], anmerkungen: [] }, new Set(['a']))).toMatchObject({ neu: 0, ersetzt: [], uebersprungen: 0 });
  });
});
