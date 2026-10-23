import { describe, expect, it } from 'vitest';
import {
  EINSTELLUNG_STANDARD, EINSTELLUNGEN_STAND, einstellungenFuerSicherung, einstellungenLesen, einstellungenSammeln,
  istAenderung, istMitreisend, MITREISEND, neuerStand, standHier, standLesen, uebernehmen,
} from '@/domain/einstellungen';
import { STIFT_STANDARD } from '@/domain/stift';

// localStorage als einfache Tabelle (Werte als JSON-Text wie dort).
const speicher = (werte: Record<string, unknown>) => {
  const roh = new Map(Object.entries(werte).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('roh:') ? v.slice(4) : JSON.stringify(v)]));
  return (k: string) => roh.get(k) ?? null;
};

describe('Welche Einstellungen mitreisen', () => {
  it('Person und Instrument reisen mit', () => {
    for (const k of ['stimm:st', 'stimm:a', 'metro:klang', 'metro:laut', 'metro:takt', 'metro:akzente', 'metro:unter', 'metro:trainer',
      'ueben:stift', 'ueben:marker', 'ueben:text', 'ueben:wisch-umkehren', 'ueben:zoom-immer', 'ueben:tonprofil-umfang']) {
      expect(istMitreisend(k), k).toBe(true);
    }
    expect(MITREISEND).toHaveLength(14);
  });
  it('Gerät, Tempo und was eigene Felder hat, bleibt', () => {
    for (const k of ['ueben:modus', 'ueben:thema-hell', 'ueben:thema-dunkel', 'ueben:lage-metronom', 'metro:bpm', 'ueben:metronom-an',
      'ueben:offen', 'ueben:zuletzt', 'ueben:sort', 'ueben:sammlung', 'ueben:tag', 'ueben:mix', 'ueben:mix-an', 'ueben:mix-offen',
      'ueben:letzte-sicherung', 'ueben:geloescht', 'ueben:tags', 'ueben:tonprofile', 'ueben:tonleiter-grundton', 'ueben:tonleiter-art',
      EINSTELLUNGEN_STAND, 'toString', '__proto__', 'constructor']) {
      expect(istMitreisend(k), k).toBe(false);
    }
  });
  it('Standard der Stifte ist der aus @/domain/stift', () => {
    expect(EINSTELLUNG_STANDARD['ueben:stift']).toEqual(STIFT_STANDARD.stift);
    expect(EINSTELLUNG_STANDARD['ueben:marker']).toEqual(STIFT_STANDARD.marker);
    expect(EINSTELLUNG_STANDARD['ueben:text']).toEqual(STIFT_STANDARD.text);
  });
});

describe('Sammeln auf dem Gerät', () => {
  it('nimmt nur mitreisende, lesbare Werte passender Art', () => {
    const werte = einstellungenSammeln(speicher({
      'stimm:st': 'Es', 'stimm:a': 443, 'metro:klang': 'glocke', 'ueben:wisch-umkehren': true,
      'ueben:stift': { farbe: '#d12d2d', breite: 0.004 },
      'ueben:modus': 'dunkel', 'metro:bpm': 132, // bleiben am Gerät
      'metro:laut': 'roh:{kaputt', // kein JSON
      'metro:unter': 0, // würde den Taktgeber lahmlegen
      'metro:takt': 'vier',
    }));
    expect(werte).toEqual({ 'stimm:st': 'Es', 'stimm:a': 443, 'metro:klang': 'glocke', 'ueben:wisch-umkehren': true, 'ueben:stift': { farbe: '#d12d2d', breite: 0.004 } });
  });
  it('leerer Speicher: nichts', () => {
    expect(einstellungenSammeln(() => null)).toEqual({});
  });
});

describe('Prüfen der Werte', () => {
  const gilt = (k: string, v: unknown) => Object.keys(einstellungenLesen({ stand: 5, werte: { [k]: v } })?.werte ?? {}).length === 1;
  it('Stimmgerät', () => {
    for (const s of ['C', 'B', 'Es', 'F']) expect(gilt('stimm:st', s)).toBe(true);
    expect(gilt('stimm:st', 'H')).toBe(false);
    expect(gilt('stimm:st', 'toString')).toBe(false);
    expect(gilt('stimm:a', 430)).toBe(true);
    expect(gilt('stimm:a', 450)).toBe(true);
    expect(gilt('stimm:a', 451)).toBe(false);
    expect(gilt('stimm:a', '443')).toBe(false);
  });
  it('Metronom', () => {
    expect(gilt('metro:klang', 'klick')).toBe(true);
    expect(gilt('metro:klang', 'trommel')).toBe(false);
    expect(gilt('metro:laut', 0)).toBe(true);
    expect(gilt('metro:laut', 1.5)).toBe(false);
    expect(gilt('metro:takt', 12)).toBe(true);
    expect(gilt('metro:takt', 0)).toBe(false);
    expect(gilt('metro:takt', 3.5)).toBe(false);
    expect(gilt('metro:unter', 4)).toBe(true);
    expect(gilt('metro:unter', 0)).toBe(false);
    expect(gilt('metro:akzente', ['betont', 'stumm', 'normal'])).toBe(true);
    expect(gilt('metro:akzente', ['betont', 'laut'])).toBe(false);
    expect(gilt('metro:akzente', 'betont')).toBe(false);
    expect(gilt('metro:trainer', { an: true, schritt: 2, takte: 8, ziel: 132 })).toBe(true);
    expect(gilt('metro:trainer', { an: 'ja', schritt: 2, takte: 8, ziel: 132 })).toBe(false);
    expect(gilt('metro:trainer', { an: true, schritt: 0, takte: 8, ziel: 132 })).toBe(false);
    expect(gilt('metro:trainer', null)).toBe(false);
  });
  it('Stifte, Wischen, Tonumfang', () => {
    expect(gilt('ueben:marker', { farbe: 'rgba(80, 220, 120, 0.4)', breite: 0.022 })).toBe(true);
    expect(gilt('ueben:text', { farbe: '#1f5fd1', breite: 0.024 })).toBe(true);
    expect(gilt('ueben:stift', { farbe: 7, breite: 0.004 })).toBe(false);
    expect(gilt('ueben:stift', { farbe: '#000', breite: -1 })).toBe(false);
    expect(gilt('ueben:stift', [])).toBe(false);
    expect(gilt('ueben:wisch-umkehren', false)).toBe(true);
    expect(gilt('ueben:wisch-umkehren', 'false')).toBe(false);
    expect(gilt('ueben:zoom-immer', true)).toBe(true);
    expect(gilt('ueben:zoom-immer', 1)).toBe(false);
    expect(gilt('ueben:tonprofil-umfang', { von: 50, bis: 84, stamm: true })).toBe(true);
    expect(gilt('ueben:tonprofil-umfang', { von: 84, bis: 50, stamm: true })).toBe(false);
    expect(gilt('ueben:tonprofil-umfang', { von: 50, bis: 84 })).toBe(false);
  });
});

describe('Lesen aus der Sicherung', () => {
  it('fehlt das Feld (alte Datei, Registerführer): nichts', () => {
    expect(einstellungenLesen(undefined)).toBeNull();
  });
  it('kaputt oder fremd: nichts, ohne Fehler', () => {
    for (const roh of [null, 5, 'x', [], { werte: { 'stimm:a': 443 } }, { stand: 'gestern', werte: { 'stimm:a': 443 } },
      { stand: Infinity, werte: { 'stimm:a': 443 } }, { stand: 0, werte: { 'stimm:a': 443 } }, { stand: 9, werte: [443] },
      { stand: 9, werte: null }, { stand: 9, werte: { 'ueben:modus': 'dunkel' } }]) {
      expect(einstellungenLesen(roh), JSON.stringify(roh)).toBeNull();
    }
  });
  it('nur bekannte Schlüssel mit passenden Werten', () => {
    const e = einstellungenLesen({ stand: 7, werte: { 'stimm:st': 'Es', 'stimm:a': 'hoch', 'ueben:thema-dunkel': 'schwarz', 'metro:bpm': 200, __proto__: { x: 1 } } });
    expect(e).toEqual({ stand: 7, werte: { 'stimm:st': 'Es' } });
  });
});

describe('Zeitstempel', () => {
  it('Start schreibt dieselben Werte: keine Änderung', () => {
    expect(istAenderung('stimm:a', '443', 443)).toBe(false);
    expect(istAenderung('metro:trainer', JSON.stringify({ an: false, schritt: 4, takte: 4, ziel: 120 }), { ziel: 120, takte: 4, schritt: 4, an: false })).toBe(false);
  });
  it('frisches Gerät schreibt den Standard: keine Änderung', () => {
    for (const k of MITREISEND) expect(istAenderung(k, null, EINSTELLUNG_STANDARD[k]), k).toBe(false);
    // unlesbarer alter Wert zählt wie keiner
    expect(istAenderung('stimm:a', '{kaputt', 442)).toBe(false);
  });
  it('echte Änderung', () => {
    expect(istAenderung('stimm:a', '443', 441)).toBe(true);
    expect(istAenderung('stimm:st', null, 'Es')).toBe(true);
    expect(istAenderung('ueben:stift', null, { farbe: '#d12d2d', breite: 0.0025 })).toBe(true);
  });
  it('Werte, die am Gerät bleiben, bewegen ihn nie', () => {
    expect(istAenderung('metro:bpm', '80', 120)).toBe(false);
    expect(istAenderung('ueben:modus', '"hell"', 'dunkel')).toBe(false);
  });
  it('steigt nur, auch wenn die Uhr nachgeht', () => {
    expect(neuerStand(0, 1000)).toBe(1000);
    expect(neuerStand(5000, 1000)).toBe(5001);
  });
  it('gespeicherter Stand: nur positive Zahlen', () => {
    expect(standLesen('1700000000000')).toBe(1700000000000);
    expect(standLesen(null)).toBe(0);
    expect(standLesen('abc')).toBe(0);
    expect(standLesen('-5')).toBe(0);
  });
  it('ohne Zeitstempel: 1, wenn etwas vom Standard abweicht (Einstellungen von früher), sonst 0', () => {
    expect(standHier(null, {})).toBe(0);
    expect(standHier(null, { 'stimm:a': 442, 'metro:klang': 'holz' })).toBe(0);
    expect(standHier(null, { 'stimm:a': 443 })).toBe(1);
    expect(standHier('1234', { 'stimm:a': 442 })).toBe(1234);
  });
});

describe('Neuerer Stand gewinnt', () => {
  const datei = { stand: 2000, werte: { 'stimm:a': 443 } };
  it('Datei neuer: übernehmen', () => {
    expect(uebernehmen(0, datei)).toBe(true);
    expect(uebernehmen(1999, datei)).toBe(true);
  });
  it('hier gleich alt oder neuer: nichts', () => {
    expect(uebernehmen(2000, datei)).toBe(false);
    expect(uebernehmen(3000, datei)).toBe(false);
    expect(uebernehmen(0, null)).toBe(false);
  });
  it('Einstellungen von früher (Stand 1) verlieren gegen jede datierte Änderung', () => {
    expect(uebernehmen(1, datei)).toBe(true);
    expect(uebernehmen(2000, { stand: 1, werte: { 'stimm:a': 443 } })).toBe(false);
  });
});

describe('Für die Sicherung', () => {
  it('mit Stand und Werten', () => {
    const e = einstellungenFuerSicherung(speicher({ [EINSTELLUNGEN_STAND]: 1234, 'stimm:a': 443, 'ueben:modus': 'dunkel' }));
    expect(e).toEqual({ stand: 1234, werte: { 'stimm:a': 443 } });
  });
  it('nur Standard und nie geändert: nichts mitgeben', () => {
    expect(einstellungenFuerSicherung(speicher({ 'stimm:a': 442 }))).toBeUndefined();
    expect(einstellungenFuerSicherung(() => null)).toBeUndefined();
  });
  it('was die Sicherung mitgibt, liest die andere Seite genauso', () => {
    const e = einstellungenFuerSicherung(speicher({ [EINSTELLUNGEN_STAND]: 99, 'stimm:st': 'F', 'metro:akzente': ['betont', 'stumm'] }));
    expect(einstellungenLesen(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});
