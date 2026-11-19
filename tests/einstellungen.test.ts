import { describe, expect, it } from 'vitest';
import { DRONE_STANDARD } from '@/domain/drone';
import type { Grabstein } from '@/domain/einspielen';
import {
  EINSTELLUNG_STANDARD, EINSTELLUNGEN_STAND, einstellungenFuerSicherung, einstellungenLesen, einstellungenSammeln, GERAET,
  istAenderung, istLernstand, istMitreisend, LERNSTAND, LERNSTAND_LEER, lernstandHier, lernstandVereinigen, METRONOM_STANDARD,
  MITREISEND, neuerStand, standHier, standLesen, uebernehmen, VERALTET,
} from '@/domain/einstellungen';
import { ETUEDEN_STANDARD } from '@/domain/etueden';
import { LICKS_STANDARD, START_LICKS } from '@/domain/licks';
import { STIFT_STANDARD } from '@/domain/stift';
import { SWING_STANDARD } from '@/domain/swing';

// localStorage als einfache Tabelle (Werte als JSON-Text wie dort).
const speicher = (werte: Record<string, unknown>) => {
  const roh = new Map(Object.entries(werte).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('roh:') ? v.slice(4) : JSON.stringify(v)]));
  return (k: string) => roh.get(k) ?? null;
};

describe('Welche Einstellungen mitreisen', () => {
  it('Person und Instrument reisen mit', () => {
    for (const k of ['stimm:st', 'stimm:a', 'ueben:stift', 'ueben:marker', 'ueben:text', 'ueben:wisch-umkehren', 'ueben:zoom-immer',
      'ueben:tonprofil-umfang', 'ueben:sammlungen-reihenfolge']) {
      expect(istMitreisend(k), k).toBe(true);
    }
    expect(MITREISEND).toHaveLength(9);
  });
  it('Lernstand reist mit, aber nicht als Einstellung', () => {
    expect([...LERNSTAND].sort()).toEqual(['ueben:jamkarte', 'ueben:licks', 'ueben:skills']);
    for (const k of LERNSTAND) {
      expect(istLernstand(k), k).toBe(true);
      expect(istMitreisend(k), k).toBe(false);
    }
  });
  it('nur am Gerät oder gar nicht gespeichert: reist nicht mit (A-08)', () => {
    for (const k of [...GERAET, ...VERALTET]) {
      expect(istMitreisend(k), k).toBe(false);
      expect(istLernstand(k), k).toBe(false);
    }
    expect(VERALTET).toEqual(expect.arrayContaining(['metro:takt', 'metro:nenner', 'metro:akzente', 'metro:unter', 'metro:trainer', 'metro:swing', 'ueben:drone', 'ueben:etueden']));
    expect(GERAET).toEqual(expect.arrayContaining(['metro:klang', 'metro:laut', 'ueben:ohr', 'ueben:hoerquiz']));
    expect(GERAET.filter((k) => (VERALTET as readonly string[]).includes(k))).toEqual([]);
  });
  it('Gerät, Tempo und was eigene Felder hat, bleibt', () => {
    for (const k of ['ueben:modus', 'ueben:thema-hell', 'ueben:thema-dunkel', 'ueben:lage-metronom', 'metro:bpm', 'ueben:metronom-an',
      'ueben:offen', 'ueben:zuletzt', 'ueben:sort', 'ueben:sammlung', 'ueben:tag', 'ueben:mix', 'ueben:mix-an', 'ueben:mix-offen',
      'ueben:letzte-sicherung', 'ueben:sicherung-erinnern', 'ueben:geloescht', 'ueben:tags', 'ueben:tonprofile', 'ueben:ohr-verlauf', 'ueben:heute', 'ueben:tonleiter-grundton', 'ueben:tonleiter-art',
      EINSTELLUNGEN_STAND, 'toString', '__proto__', 'constructor']) {
      expect(istMitreisend(k), k).toBe(false);
      expect(istLernstand(k), k).toBe(false);
    }
  });
  it('Standard der Stifte ist der aus @/domain/stift', () => {
    expect(EINSTELLUNG_STANDARD['ueben:stift']).toEqual(STIFT_STANDARD.stift);
    expect(EINSTELLUNG_STANDARD['ueben:marker']).toEqual(STIFT_STANDARD.marker);
    expect(EINSTELLUNG_STANDARD['ueben:text']).toEqual(STIFT_STANDARD.text);
  });
  it('Metronom beginnt jede Sitzung mit 4/4, ohne Trainer und Swing', () => {
    expect(METRONOM_STANDARD).toMatchObject({ takt: 4, nenner: 4, unter: 1, akzente: ['betont', 'normal', 'normal', 'normal'] });
    expect(METRONOM_STANDARD.trainer.an).toBe(false);
    expect(METRONOM_STANDARD.swing).toEqual(SWING_STANDARD);
  });
});

describe('Sammeln auf dem Gerät', () => {
  it('nimmt nur mitreisende, lesbare Werte passender Art', () => {
    const werte = einstellungenSammeln(speicher({
      'stimm:st': 'Es', 'stimm:a': 443, 'ueben:wisch-umkehren': true,
      'ueben:stift': { farbe: '#d12d2d', breite: 0.004 },
      'ueben:modus': 'dunkel', 'metro:bpm': 132, 'metro:klang': 'glocke', // bleiben am Gerät
      'metro:takt': 3, // nur für die Sitzung
      'ueben:skills': { intervalle: { markierung: 'will' } }, // Lernstand, eigenes Sammeln
      'ueben:text': 'roh:{kaputt', // kein JSON
      'ueben:marker': { farbe: '#000', breite: 0 }, // würde unsichtbar zeichnen
    }));
    expect(werte).toEqual({ 'stimm:st': 'Es', 'stimm:a': 443, 'ueben:wisch-umkehren': true, 'ueben:stift': { farbe: '#d12d2d', breite: 0.004 } });
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
  it('was früher mitreiste (Metronom, Etüden …), gilt nicht mehr', () => {
    expect(gilt('metro:klang', 'klick')).toBe(false);
    expect(gilt('metro:takt', 3)).toBe(false);
    expect(gilt('metro:swing', SWING_STANDARD)).toBe(false);
    expect(gilt('ueben:ohr', { stufe: 'leiter', grundton: 62, bpm: 90, wechseln: true })).toBe(false);
    expect(gilt('ueben:hoerquiz', { intervalle: { stufe: 3, richtung: 'gemischt' }, dreiklaenge: { stufe: 2 }, septakkorde: { stufe: 1 } })).toBe(false);
    expect(gilt('ueben:etueden', ETUEDEN_STANDARD)).toBe(false);
    expect(gilt('ueben:drone', DRONE_STANDARD)).toBe(false);
  });
  it('Stifte, Wischen, Tonumfang, Sammlungen', () => {
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
    expect(gilt('ueben:sammlungen-reihenfolge', ['Märsche', 'Polkas'])).toBe(true);
    expect(gilt('ueben:sammlungen-reihenfolge', ['', 'Polkas'])).toBe(false);
  });
});

describe('Lernstand prüfen', () => {
  const gilt = (k: string, v: unknown) => Object.keys(einstellungenLesen({ stand: 5, werte: { [k]: v } })?.lernstand ?? {}).length === 1;
  it('Licks', () => {
    expect(gilt('ueben:licks', LICKS_STANDARD)).toBe(true);
    expect(gilt('ueben:licks', { ...LICKS_STANDARD, ausAm: 1_700_000_000_000 })).toBe(true);
    expect(gilt('ueben:licks', { ...LICKS_STANDARD, ausAm: 'gestern' })).toBe(false);
    expect(gilt('ueben:licks', { eigene: 'nein', stand: {}, aus: [] })).toBe(false);
  });
  it('Jam-Stücke', () => {
    expect(gilt('ueben:jamkarte', [])).toBe(true);
    expect(gilt('ueben:jamkarte', [{ id: 'x', titel: 'Mein Blues', form: '12 Takte', tonart: 'G', teile: [{ name: 'A', akkorde: '| G7 | C7 |' }], eigen: true, geaendert: 5 }])).toBe(true);
    expect(gilt('ueben:jamkarte', [{ id: 'x', titel: 'Mein Blues', form: '12 Takte', tonart: 'G', teile: [{ name: 'A', akkorde: '| G7 |' }], geaendert: 'neu' }])).toBe(false);
    expect(gilt('ueben:jamkarte', [{ id: 'x', titel: '', form: '', tonart: 'G', teile: [] }])).toBe(false);
    expect(gilt('ueben:jamkarte', { id: 'x' })).toBe(false);
  });
  it('Skills', () => {
    expect(gilt('ueben:skills', {})).toBe(true);
    expect(gilt('ueben:skills', { intervalle: { markierung: 'will', geaendert: 1_700_000_000_000 }, 'kuenftig-unbekannt': { stufe: 2, hoechste: 3, quoten: [{ q: 0.8, am: 1_700_000_000_000 }], zuletzt: 1_700_000_000_000 } })).toBe(true);
    expect(gilt('ueben:skills', { intervalle: { markierung: 'vielleicht' } })).toBe(false);
    expect(gilt('ueben:skills', { intervalle: { stufe: 7 } })).toBe(false);
    expect(gilt('ueben:skills', { intervalle: { geaendert: -1 } })).toBe(false);
    expect(gilt('ueben:skills', [])).toBe(false);
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
    expect(e).toEqual({ stand: 7, werte: { 'stimm:st': 'Es' }, lernstand: {} });
  });
  it('Lernstand für sich', () => {
    const skills = { intervalle: { markierung: 'will', geaendert: 1_700_000_000_000 } };
    expect(einstellungenLesen({ stand: 1, werte: { 'ueben:skills': skills } })).toEqual({ stand: 1, werte: {}, lernstand: { 'ueben:skills': skills } });
  });
  it('ältere Sicherung mit Metronom und Lernstand: Metronom übergangen, Lernstand bleibt', () => {
    const e = einstellungenLesen({ stand: 9, werte: { 'metro:takt': 3, 'metro:klang': 'glocke', 'stimm:st': 'Es', 'ueben:jamkarte': [] } });
    expect(e).toEqual({ stand: 9, werte: { 'stimm:st': 'Es' }, lernstand: { 'ueben:jamkarte': [] } });
  });
});

describe('Zeitstempel', () => {
  it('Start schreibt dieselben Werte: keine Änderung', () => {
    expect(istAenderung('stimm:a', '443', 443)).toBe(false);
    expect(istAenderung('ueben:tonprofil-umfang', JSON.stringify({ von: 55, bis: 79, stamm: false }), { stamm: false, bis: 79, von: 55 })).toBe(false);
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
    expect(istAenderung('metro:klang', '"holz"', 'glocke')).toBe(false);
    expect(istAenderung('ueben:ohr', null, { stufe: 'leiter', grundton: 62, bpm: 90, wechseln: true })).toBe(false);
  });
  it('Lernstand bewegt ihn nicht: Er wird je Eintrag zusammengeführt', () => {
    expect(istAenderung('ueben:skills', '{}', { intervalle: { markierung: 'will' } })).toBe(false);
    expect(istAenderung('ueben:licks', null, { eigene: [], stand: { x: { zuletzt: 5, staerke: 1 } }, aus: [] })).toBe(false);
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
    expect(standHier(null, { 'stimm:a': 442, 'ueben:zoom-immer': false })).toBe(0);
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
  it('Datei nur mit Lernstand: Einstellungen und Stand bleiben, wie sie sind', () => {
    expect(uebernehmen(0, { stand: 5000, werte: {} })).toBe(false);
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
  it('was nicht mitreist, bleibt draußen', () => {
    const e = einstellungenFuerSicherung(speicher({
      [EINSTELLUNGEN_STAND]: 99, 'stimm:st': 'F', 'metro:akzente': ['betont', 'stumm'], 'metro:klang': 'glocke', 'ueben:ohr': { stufe: 'leiter', grundton: 62, bpm: 90, wechseln: true },
    }));
    expect(e).toEqual({ stand: 99, werte: { 'stimm:st': 'F' } });
  });
  it('Lernstand reist mit; leerer nicht', () => {
    const skills = { intervalle: { markierung: 'will', geaendert: 1_700_000_000_000 } };
    expect(einstellungenFuerSicherung(speicher({ [EINSTELLUNGEN_STAND]: 99, 'stimm:st': 'F', 'ueben:skills': skills, 'ueben:licks': LICKS_STANDARD, 'ueben:jamkarte': [] })))
      .toEqual({ stand: 99, werte: { 'stimm:st': 'F', 'ueben:skills': skills } });
  });
  it('nie etwas eingestellt, aber Lernstand: nur der Lernstand, Stand 1', () => {
    const skills = { intervalle: { markierung: 'will' } };
    expect(einstellungenFuerSicherung(speicher({ 'stimm:a': 442, 'ueben:skills': skills }))).toEqual({ stand: 1, werte: { 'ueben:skills': skills } });
  });
  it('was die Sicherung mitgibt, liest die andere Seite genauso', () => {
    const skills = { intervalle: { markierung: 'will', geaendert: 1_700_000_000_000 } };
    const e = einstellungenFuerSicherung(speicher({ [EINSTELLUNGEN_STAND]: 99, 'stimm:st': 'F', 'ueben:skills': skills }));
    expect(einstellungenLesen(JSON.parse(JSON.stringify(e)))).toEqual({ stand: 99, werte: { 'stimm:st': 'F' }, lernstand: { 'ueben:skills': skills } });
  });
});

describe('Lernstand zusammenführen (A-08)', () => {
  const T = 1_700_000_000_000;
  const lick = (id: string, geaendert?: number) => ({ ...START_LICKS[0], id, name: `Lick ${id}`, ...(geaendert ? { geaendert } : {}) });
  const jam = (id: string, geaendert?: number) => ({ id, titel: `Stück ${id}`, form: 'AABA', tonart: 'F', teile: [{ name: 'A', akkorde: '| F |' }], eigen: true, ...(geaendert ? { geaendert } : {}) });

  it('liest den Lernstand des Geräts nachsichtig, Fehlendes ist leer', () => {
    const hier = lernstandHier(speicher({ 'ueben:skills': { intervalle: { markierung: 'will' }, kaputt: { stufe: 99 } }, 'ueben:licks': 'roh:{kaputt' }));
    expect(hier['ueben:skills']).toEqual({ intervalle: { markierung: 'will' } });
    expect(hier['ueben:licks']).toEqual(LICKS_STANDARD);
    expect(hier['ueben:jamkarte']).toEqual([]);
  });
  it('eine geänderte Einstellung überschreibt den Lernstand nicht mehr: je Skill gewinnt der neuere', () => {
    const hier = { ...LERNSTAND_LEER, 'ueben:skills': { a: { stufe: 3, zuletzt: T + 500, geaendert: T + 500 }, b: { markierung: 'will' as const, geaendert: T } } };
    const dort = { 'ueben:skills': { a: { stufe: 1, zuletzt: T + 100, geaendert: T + 100 }, b: { markierung: 'kann' as const, geaendert: T + 900 }, c: { markierung: 'lerne' as const, geaendert: T } } };
    expect(lernstandVereinigen(hier, dort, [])).toEqual({ 'ueben:skills': {
      a: { stufe: 3, zuletzt: T + 500, geaendert: T + 500 }, b: { markierung: 'kann', geaendert: T + 900 }, c: { markierung: 'lerne', geaendert: T },
    } });
  });
  it('liefert nur, was sich ändert', () => {
    const hier = { ...LERNSTAND_LEER, 'ueben:skills': { a: { markierung: 'will' as const, geaendert: T } } };
    expect(lernstandVereinigen(hier, { 'ueben:skills': { a: { markierung: 'kann' as const, geaendert: T - 1 } } }, [])).toEqual({});
    expect(lernstandVereinigen(hier, {}, [])).toEqual({});
  });
  it('Grabsteine gelten auch ohne den Schlüssel in der Datei (letzter Lick gelöscht)', () => {
    const hier = { ...LERNSTAND_LEER, 'ueben:licks': { eigene: [lick('l1', T)], stand: {}, aus: [] }, 'ueben:jamkarte': [jam('j1', T)] };
    const grabsteine: Grabstein[] = [{ art: 'lick', id: 'l1', am: T + 10 }, { art: 'jamstueck', id: 'j1', am: T + 10 }];
    expect(lernstandVereinigen(hier, {}, grabsteine)).toEqual({ 'ueben:licks': { eigene: [], stand: {}, aus: [] }, 'ueben:jamkarte': [] });
  });
});
