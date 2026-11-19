import { describe, expect, it } from 'vitest';
import {
  HINTERGRUND_SCHLUESSEL, HINTERGRUND_STANDARD, imHintergrundWeiter, jetztLaeuft, taktgeberPlanen, taktgeberStart,
  VERSPAETET, vorlauf, VORLAUF_HINTEN, VORLAUF_VORN, zurueckAb, type GeplanterKlick, type TaktgeberStand, type TaktgeberWerte,
} from '@/domain/taktgeber';
import { istMitreisend } from '@/domain/einstellungen';
import { SWING_STANDARD } from '@/domain/swing';

// Metronom im Hintergrund (D-08): Der Taktgeber plant Klicks auf der
// Audio-Uhr voraus — im Vordergrund 0,12 s, im Hintergrund mehrere Sekunden
// (iOS weckt verborgene Seiten nur etwa einmal je Sekunde). Zurück in der App
// wird das weit Vorausgeplante zurückgeholt, damit Tempo- und Taktwechsel
// sofort gelten.

const VIER: TaktgeberWerte = {
  takt: 4, nenner: 4, unter: 1, akzente: ['betont', 'normal', 'normal', 'normal'],
  swing: SWING_STANDARD, trainer: { an: false, schritt: 4, takte: 4, ziel: 120 }, startBpm: 120,
};
const rund = (k: GeplanterKlick[]) => k.map((x) => ({ zeit: Math.round(x.zeit * 1e6) / 1e6, art: x.art, schlag: x.schlag, sub: x.sub, tempo: x.tempo }));
const abstaende = (k: GeplanterKlick[]) => k.slice(1).map((x, i) => Math.round((x.zeit - k[i].zeit) * 1e6) / 1e6);

// In kleinen Schritten planen, wie der Takt-Timer es tut.
function schrittweise(stand: TaktgeberStand, werte: TaktgeberWerte, von: number, bis: number, schritt: number, vor: number) {
  const alle: GeplanterKlick[] = [];
  let s = stand;
  for (let t = von; t < bis; t += schritt) {
    const r = taktgeberPlanen(s, werte, t + vor, t);
    alle.push(...r.klicks);
    s = r.stand;
  }
  return { klicks: alle, stand: s };
}

describe('Taktgeber: plant Klicks auf der Audio-Uhr', () => {
  it('4/4 bei 120: alle 0,5 s ein Klick, die Eins betont; geplant wird bis vor „bis“', () => {
    const r = taktgeberPlanen(taktgeberStart(1, 120), VIER, 3, 1);
    expect(rund(r.klicks)).toEqual([
      { zeit: 1, art: 'betont', schlag: 0, sub: 0, tempo: undefined },
      { zeit: 1.5, art: 'normal', schlag: 1, sub: 0, tempo: undefined },
      { zeit: 2, art: 'normal', schlag: 2, sub: 0, tempo: undefined },
      { zeit: 2.5, art: 'normal', schlag: 3, sub: 0, tempo: undefined },
    ]);
    expect(r.stand).toMatchObject({ naechster: 3, pos: 0, taktNr: 0, bpm: 120 });
  });

  it('ändert den übergebenen Stand nicht', () => {
    const s = taktgeberStart(0, 120);
    const kopie = { ...s };
    taktgeberPlanen(s, VIER, 2, 0);
    expect(s).toEqual(kopie);
  });

  it('ein stummer Schlag bleibt stumm, läuft aber in der Anzeige mit', () => {
    const r = taktgeberPlanen(taktgeberStart(0, 60), { ...VIER, akzente: ['betont', 'stumm', 'normal', 'normal'] }, 4, 0);
    expect(r.klicks.map((k) => k.art)).toEqual(['betont', null, 'normal', 'normal']);
    expect(r.klicks.map((k) => k.schlag)).toEqual([0, 1, 2, 3]);
  });

  it('in kleinen Schritten (Vordergrund) geplant = in großen (Hintergrund) geplant — auch mit Swing und 6/8', () => {
    for (const werte of [
      VIER,
      { ...VIER, swing: { zweiVier: true, achtel: true, anteil: 67 } },
      { ...VIER, takt: 6, nenner: 8 as const, unter: 2, akzente: ['betont', 'normal', 'normal', 'betont', 'normal', 'normal'] as const },
    ]) {
      const klein = schrittweise(taktgeberStart(0.08, 97), werte, 0, 20, 0.025, VORLAUF_VORN);
      const gross = schrittweise(taktgeberStart(0.08, 97), werte, 0, 20, 1, VORLAUF_HINTEN);
      const n = klein.klicks.length;
      expect(n).toBeGreaterThan(30);
      expect(rund(gross.klicks.slice(0, n))).toEqual(rund(klein.klicks));
    }
  });
});

describe('Zurückholen: zurück in der App gilt jede Änderung sofort', () => {
  // Im Hintergrund 5 s voraus geplant, bei 1,2 s kommt man zurück.
  const imHintergrund = () => taktgeberPlanen(taktgeberStart(0, 120), VIER, VORLAUF_HINTEN, 0);

  it('zurueckAb: der erste Klick ab der Grenze; keiner → Länge der Liste', () => {
    const r = imHintergrund();
    const i = zurueckAb(r.klicks, 1.2 + VORLAUF_VORN);
    expect(r.klicks[i].zeit).toBe(1.5);
    expect(r.klicks[i - 1].zeit).toBeLessThan(1.32);
    expect(zurueckAb(r.klicks, 99)).toBe(r.klicks.length);
    expect(zurueckAb([], 1)).toBe(0);
  });

  it('ohne Änderung: zurückholen und neu planen ergibt genau dieselben Klicks', () => {
    const r = imHintergrund();
    const i = zurueckAb(r.klicks, 1.2 + VORLAUF_VORN);
    const neu = taktgeberPlanen(r.klicks[i].vorher, VIER, VORLAUF_HINTEN, 1.2);
    expect(rund([...r.klicks.slice(0, i), ...neu.klicks])).toEqual(rund(r.klicks));
    expect(neu.stand).toEqual(r.stand);
  });

  it('Tempo geändert: die schon gehörten Klicks bleiben, ab der Grenze gilt das neue Tempo im selben Raster', () => {
    const r = imHintergrund();
    const i = zurueckAb(r.klicks, 1.2 + VORLAUF_VORN);
    const neu = taktgeberPlanen({ ...r.klicks[i].vorher, bpm: 60 }, VIER, 6, 1.2);
    expect(neu.klicks[0].zeit).toBe(1.5);
    expect(abstaende(neu.klicks)).toEqual(Array(neu.klicks.length - 1).fill(1));
    expect(neu.klicks[0].art).toBe('normal'); // Schlag 4 des ersten Takts
    expect(neu.klicks[1].art).toBe('betont');
  });

  it('Taktart gewechselt: der Takt läuft in der neuen Art weiter, ein zu großer Platz fängt bei der Eins an', () => {
    const r = imHintergrund();
    const i = zurueckAb(r.klicks, 1.2 + VORLAUF_VORN); // Schlag 4 (pos 3)
    expect(r.klicks[i].vorher.pos).toBe(3);
    const drei = { ...VIER, takt: 3, akzente: ['betont', 'normal', 'normal'] as const };
    const neu = taktgeberPlanen(r.klicks[i].vorher, drei, 5, 1.2);
    expect(neu.klicks.slice(0, 6).map((k) => k.art)).toEqual(['betont', 'normal', 'normal', 'betont', 'normal', 'normal']);
  });

  it('Akzent geändert: gilt ab der Grenze', () => {
    const r = imHintergrund();
    const i = zurueckAb(r.klicks, 1.2 + VORLAUF_VORN);
    const neu = taktgeberPlanen(r.klicks[i].vorher, { ...VIER, akzente: ['betont', 'normal', 'normal', 'betont'] }, 4, 1.2);
    expect(neu.klicks.slice(0, 5).map((k) => k.art)).toEqual(['betont', 'betont', 'normal', 'normal', 'betont']);
  });
});

describe('Tempo-Trainer über den langen Vorlauf hinweg', () => {
  const TRAINER: TaktgeberWerte = { ...VIER, trainer: { an: true, schritt: 4, takte: 2, ziel: 128 } };

  it('alle 2 Takte +4 bis 128 — die Stufen sitzen auf der Eins und melden das neue Tempo', () => {
    const r = taktgeberPlanen(taktgeberStart(0, 120), TRAINER, 30, 0);
    const a = abstaende(r.klicks);
    expect(a.slice(0, 8)).toEqual(Array(8).fill(0.5));
    expect(a.slice(8, 16)).toEqual(Array(8).fill(Math.round(60 / 124 * 1e6) / 1e6));
    expect(a.slice(16, 40)).toEqual(Array(24).fill(Math.round(60 / 128 * 1e6) / 1e6));
    const stufen = r.klicks.flatMap((k, i) => (k.tempo === undefined ? [] : [{ i, tempo: k.tempo, art: k.art }]));
    expect(stufen).toEqual([{ i: 8, tempo: 124, art: 'betont' }, { i: 16, tempo: 128, art: 'betont' }]);
    expect(r.stand.bpm).toBe(128);
  });

  it('zurückgeholt mitten in der zweiten Stufe: neu geplant stimmt Takt für Takt', () => {
    const r = taktgeberPlanen(taktgeberStart(0, 120), TRAINER, 30, 0);
    const i = zurueckAb(r.klicks, 5.1);
    expect(r.klicks[i].vorher.bpm).toBe(124);
    const neu = taktgeberPlanen(r.klicks[i].vorher, TRAINER, 30, 5);
    expect(rund([...r.klicks.slice(0, i), ...neu.klicks])).toEqual(rund(r.klicks));
  });
});

describe('Verpasste Klicks: kein Schwall nach einer Pause', () => {
  it('stand das Planen still, schweigen die verpassten Klicks; das Raster läuft weiter', () => {
    const s = taktgeberStart(1, 120);
    const r = taktgeberPlanen(s, VIER, 3 + VORLAUF_VORN, 3);
    expect(rund(r.klicks).map((k) => [k.zeit, k.art])).toEqual([[1, null], [1.5, null], [2, null], [2.5, null], [3, 'betont']]);
    expect(r.klicks.map((k) => k.schlag)).toEqual([0, 1, 2, 3, 0]);
  });
  it('ein knapp verspäteter Klick klingt noch (sofort), ein deutlich verspäteter nicht', () => {
    expect(VERSPAETET).toBeGreaterThan(0.01);
    expect(VERSPAETET).toBeLessThanOrEqual(0.1);
    const knapp = taktgeberPlanen(taktgeberStart(1, 120), VIER, 1.1, 1 + VERSPAETET / 2);
    expect(knapp.klicks[0].art).toBe('betont');
    const spaet = taktgeberPlanen(taktgeberStart(1, 120), VIER, 1.2, 1 + VERSPAETET * 2);
    expect(spaet.klicks[0].art).toBeNull();
  });
});

describe('Vorlauf je nach Sichtbarkeit', () => {
  it('vorn kurz, damit Tempo-Tipps sofort wirken', () => {
    expect(vorlauf(true)).toBe(VORLAUF_VORN);
    expect(VORLAUF_VORN).toBeLessThanOrEqual(0.15);
  });
  it('im Hintergrund mehrere Sekunden — verborgene Seiten wecken ihre Timer nur etwa einmal je Sekunde', () => {
    expect(vorlauf(false)).toBe(VORLAUF_HINTEN);
    expect(VORLAUF_HINTEN).toBeGreaterThanOrEqual(3);
    expect(VORLAUF_HINTEN).toBeLessThanOrEqual(10);
  });
});

describe('Weiter im Hintergrund? (Gerät, reist nicht mit)', () => {
  it('Vorgabe an', () => {
    expect(HINTERGRUND_SCHLUESSEL).toBe('ueben:metronom-hintergrund');
    expect(HINTERGRUND_STANDARD).toBe(true);
  });
  it('nur ohne „Mit anderen Apps mischen“ — gemischt (ambient) hält iOS den Ton im Hintergrund an', () => {
    expect(imHintergrundWeiter({ hintergrund: true, mischen: false })).toBe(true);
    expect(imHintergrundWeiter({ hintergrund: true, mischen: true })).toBe(false);
    expect(imHintergrundWeiter({ hintergrund: false, mischen: false })).toBe(false);
    expect(imHintergrundWeiter({ hintergrund: false, mischen: true })).toBe(false);
  });
  it('liegt am Gerät', () => {
    expect(istMitreisend(HINTERGRUND_SCHLUESSEL)).toBe(false);
  });
});

describe('Sperrbildschirm (Media Session)', () => {
  it('Titel „Metronom“, darunter Tempo und Taktart', () => {
    expect(jetztLaeuft(96, 4, 4)).toEqual({ titel: 'Metronom', unter: '96 BPM · 4/4' });
    expect(jetztLaeuft(60, 6, 8)).toEqual({ titel: 'Metronom', unter: '60 BPM · 6/8' });
  });
});
