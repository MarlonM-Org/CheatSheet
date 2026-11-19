import { describe, expect, it } from 'vitest';
import { BEREICHE, HOER_UEBUNGEN, SKILLS, skillFinden, skillFuerHoerUebung, skillFuerOhrStufe, type Skill } from '@/domain/skillkatalog';
import { STUFEN } from '@/domain/gehoer';
import {
  andererVorschlag, geuebtEintragen, heuteErledigen, heuteKandidaten, heuteLeer, heuteLesen, heuteVorschlag, hoechsteStufe, imFilter,
  istSicher, markieren, rundeEintragen, skillsGueltig, skillsLesen, skillsVereinigen, skillZeit, staerke, stufeAusRunden, tagSchluessel, tageSeit, uebersicht,
  verblasst, wirksameStufe, wocheEinheiten, zuletztText, type SkillSpeicher,
} from '@/domain/skills';

const TAG = 86_400_000;
// Mittwoch, 2026-11-18, 12:00 Ortszeit — mittags, damit Tagesgrenzen nicht stören.
const T0 = new Date(2026, 10, 18, 12).getTime();
const tag = (n: number) => T0 + n * TAG;

// Runden eintragen: [Quote, Tag-Versatz] …
function runden(id: string, liste: [number, number][], sp: SkillSpeicher = {}): SkillSpeicher {
  return liste.reduce((s, [q, t], i) => rundeEintragen(s, id, q, tag(t) + i * 1000), sp);
}
const gleich = (q: number, n: number, t = 0): [number, number][] => Array.from({ length: n }, () => [q, t]);

describe('Katalog', () => {
  it('hat rund 50 Skills in sechs Bereichen, eindeutige ids', () => {
    expect(BEREICHE.map((b) => b.name)).toEqual(['Gehör', 'Harmonie', 'Klarinette', 'Improvisation', 'Mitspielen & Begleiten', 'Repertoire']);
    expect(SKILLS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const b of BEREICHE) expect(SKILLS.some((s) => s.bereich === b.id), b.id).toBe(true);
  });
  it('jeder Skill: Texte, bekannte Voraussetzungen, Übung oder externer Hinweis', () => {
    for (const s of SKILLS) {
      expect(s.name && s.was && s.warum, s.id).toBeTruthy();
      for (const v of s.voraussetzungen) expect(skillFinden(v), `${s.id} → ${v}`).toBeDefined();
      expect(!!s.uebung || !!s.extern, s.id).toBe(true);
      expect(s.voraussetzungen).not.toContain(s.id);
    }
  });
  it('Voraussetzungen ohne Kreis', () => {
    const besucht = new Map<string, 'laeuft' | 'fertig'>();
    const tief = (id: string): void => {
      if (besucht.get(id) === 'fertig') return;
      expect(besucht.get(id), `Kreis bei ${id}`).not.toBe('laeuft');
      besucht.set(id, 'laeuft');
      for (const v of skillFinden(id)!.voraussetzungen) tief(v);
      besucht.set(id, 'fertig');
    };
    for (const s of SKILLS) tief(s.id);
  });
  it('Doppel- und Triolenzunge stehen unter Klarinette, die Triolenzunge baut auf der Doppelzunge auf', () => {
    const doppel = skillFinden('doppelzunge');
    const triole = skillFinden('triolenzunge');
    expect(doppel?.bereich).toBe('klarinette');
    expect(triole?.bereich).toBe('klarinette');
    expect(doppel?.name).toBe('Doppelzunge');
    expect(triole?.name).toBe('Triolenzunge');
    expect(triole?.voraussetzungen).toContain('doppelzunge');
    expect(doppel?.extern).toMatch(/Metronom/);
  });
  it('die sechs Ohr-Trainer-Stufen sind Gehör-Skills mit Übung', () => {
    for (const st of STUFEN) {
      const s = skillFinden(skillFuerOhrStufe(st.id));
      expect(s?.bereich).toBe('gehoer');
      expect(s?.uebung).toEqual({ art: 'ohr', stufe: st.id });
      expect(s?.name.startsWith('Melodie nachspielen')).toBe(true);
    }
  });
  it('Hör-Übungen: id → Skill, der die Übung auch trägt', () => {
    expect(skillFuerHoerUebung('intervalle')).toBe('intervalle');
    expect(skillFuerHoerUebung('dreiklaenge')).toBe('dur-moll');
    expect(skillFuerHoerUebung('septakkorde')).toBe('septakkorde');
    for (const h of HOER_UEBUNGEN) expect(skillFinden(skillFuerHoerUebung(h))?.uebung).toEqual({ art: 'hoer', id: h });
    expect(skillFinden('vermindert-uebermaessig')?.uebung).toEqual({ art: 'hoer', id: 'dreiklaenge' });
  });
});

describe('Gemessene Stufe', () => {
  const r = (qs: number[], tage: number[] = qs.map(() => 0)) => qs.map((q, i) => ({ q, am: tag(tage[i]) + i }));
  it('keine Runde: 0; eine gute Runde: kennengelernt', () => {
    expect(stufeAusRunden([])).toBe(0);
    expect(stufeAusRunden(r([0.6]))).toBe(1);
    expect(stufeAusRunden(r([0.59]))).toBe(0);
    expect(stufeAusRunden(r([1, 1, 1, 1]))).toBe(1); // 2 und 3 brauchen 5 Runden
  });
  it('Durchschnitt der letzten 5: ≥ 0,75 → 2, ≥ 0,85 → 3', () => {
    expect(stufeAusRunden(r([0.75, 0.75, 0.75, 0.75, 0.75]))).toBe(2);
    expect(stufeAusRunden(r([0.85, 0.85, 0.85, 0.85, 0.85]))).toBe(3);
    expect(stufeAusRunden(r([0, 0, 0.85, 0.85, 0.85, 0.85, 0.85]))).toBe(3); // nur die letzten 5
    expect(stufeAusRunden(r([0.7, 0.7, 0.7, 0.7, 0.7]))).toBe(1);
    expect(stufeAusRunden(r([0.3, 0.3, 0.3, 0.3, 0.3]))).toBe(0);
  });
  it('4 nur mit 10 Runden ≥ 0,9 an ≥ 3 Tagen', () => {
    const zehn = Array(10).fill(0.95);
    expect(stufeAusRunden(r(zehn))).toBe(3); // alles an einem Tag
    expect(stufeAusRunden(r(zehn, [0, 0, 0, 1, 1, 1, 2, 2, 2, 2]))).toBe(4);
    expect(stufeAusRunden(r(zehn, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]))).toBe(3); // zwei Tage
    expect(stufeAusRunden(r(Array(9).fill(0.95), [0, 0, 0, 1, 1, 1, 2, 2, 2]))).toBe(3);
  });
  it('Wiederauffrischen: bis zur höchsten je erreichten Stufe genügen 3 Runden', () => {
    expect(stufeAusRunden(r([0.9, 0.9, 0.9]), 3)).toBe(3);
    expect(stufeAusRunden(r([0.9, 0.9, 0.9]), 2)).toBe(2); // nicht über die höchste hinaus
    expect(stufeAusRunden(r([0.95, 0.95, 0.95]), 4)).toBe(4);
    expect(stufeAusRunden(r([0.9, 0.9]), 3)).toBe(1);
  });
});

describe('Runden eintragen', () => {
  it('fünf gute Runden: sicher; höchste und zuletzt gemerkt; nur 10 Quoten', () => {
    let sp = runden('intervalle', gleich(0.9, 5));
    expect(sp.intervalle.stufe).toBe(3);
    expect(sp.intervalle.hoechste).toBe(3);
    expect(sp.intervalle.zuletzt).toBe(tag(0) + 4000);
    sp = runden('intervalle', gleich(0.9, 12), sp);
    expect(sp.intervalle.quoten).toHaveLength(10);
  });
  it('Quote wird auf 0…1 begrenzt, Unsinn ignoriert', () => {
    const sp = rundeEintragen({}, 'x', 1.7, T0);
    expect(sp.x.quoten![0].q).toBe(1);
    expect(rundeEintragen(sp, 'x', Number.NaN, T0)).toBe(sp);
    expect(rundeEintragen(sp, '__proto__', 1, T0)).toBe(sp);
  });
  it('andere Felder (Markierung) bleiben', () => {
    const sp = rundeEintragen(markieren({}, 'x', 'lerne'), 'x', 0.8, T0);
    expect(sp.x.markierung).toBe('lerne');
  });
  it('schlechte Runden senken die gemessene Stufe, die höchste bleibt', () => {
    let sp = runden('x', gleich(0.9, 5));
    sp = runden('x', gleich(0.2, 3), sp);
    expect(sp.x.stufe ?? 0).toBeLessThan(3);
    expect(sp.x.hoechste).toBe(3);
  });
});

describe('Verblassen', () => {
  const sicher = () => runden('x', gleich(0.9, 5));
  it('je Halbwertszeit eine Stufe weniger (Stufe 3: 21 Tage)', () => {
    const sp = sicher();
    expect(wirksameStufe(sp.x, tag(20))).toBe(3);
    expect(verblasst(sp.x, tag(20))).toBe(false);
    expect(wirksameStufe(sp.x, tag(22))).toBe(2);
    expect(verblasst(sp.x, tag(22))).toBe(true);
    expect(wirksameStufe(sp.x, tag(43))).toBe(1);
    expect(wirksameStufe(sp.x, tag(100))).toBe(0);
  });
  it('Halbwertszeit wächst mit der Stufe', () => {
    const eins = runden('x', [[0.7, 0]]);
    expect(eins.x.stufe).toBe(1);
    expect(wirksameStufe(eins.x, tag(3.9))).toBe(1);
    expect(wirksameStufe(eins.x, tag(4.1))).toBe(0);
    const zwei = runden('x', gleich(0.8, 5));
    expect(zwei.x.stufe).toBe(2);
    expect(wirksameStufe(zwei.x, tag(9.9))).toBe(2);
    expect(wirksameStufe(zwei.x, tag(10.1))).toBe(1);
    const vier = runden('x', Array.from({ length: 10 }, (_, i): [number, number] => [0.95, Math.floor(i / 4)]));
    expect(vier.x.stufe).toBe(4);
    expect(wirksameStufe(vier.x, tag(2 + 44))).toBe(4);
    expect(wirksameStufe(vier.x, tag(2 + 46))).toBe(3);
  });
  it('Stärke sinkt stetig; ohne Messung 1', () => {
    const sp = sicher();
    expect(staerke(sp.x, tag(0))).toBeCloseTo(1, 3);
    expect(staerke(sp.x, tag(21))).toBeCloseTo(0.5, 2);
    expect(staerke(undefined, tag(5))).toBe(1);
  });
  it('nur markierte oder „Heute geübt“ ohne Messung verblassen nicht', () => {
    let sp = markieren({}, 'blues-in-b', 'kann');
    sp = geuebtEintragen(sp, 'blues-in-b', T0);
    expect(verblasst(sp['blues-in-b'], tag(400))).toBe(false);
    expect(istSicher(sp['blues-in-b'], tag(400))).toBe(true);
  });
  it('höchste je erreichte Stufe bleibt sichtbar über der wirksamen', () => {
    const sp = sicher();
    expect(wirksameStufe(sp.x, tag(30))).toBe(2);
    expect(hoechsteStufe(sp.x)).toBe(3);
  });
  it('Wiederauffrischen: nach dem Verblassen zurück mit 3 guten Runden statt 5', () => {
    let sp = sicher();
    // 45 Tage später: wirksam 1.
    expect(wirksameStufe(sp.x, tag(45))).toBe(1);
    sp = rundeEintragen(sp, 'x', 0.9, tag(45));
    expect(sp.x.stufe).toBe(1); // verblasste Stufe bleibt stehen, sinkt nicht
    expect(sp.x.ab).toBe(tag(45));
    sp = rundeEintragen(sp, 'x', 0.9, tag(45) + 1);
    expect(sp.x.stufe).toBe(1);
    sp = rundeEintragen(sp, 'x', 0.9, tag(45) + 2);
    expect(sp.x.stufe).toBe(3);
    expect(wirksameStufe(sp.x, tag(46))).toBe(3);
  });
  it('erstes Lernen braucht 5 Runden, auch wenn sie gut sind', () => {
    let sp: SkillSpeicher = {};
    for (let i = 0; i < 4; i++) sp = rundeEintragen(sp, 'x', 0.9, T0 + i);
    expect(sp.x.stufe).toBe(1);
    sp = rundeEintragen(sp, 'x', 0.9, T0 + 5);
    expect(sp.x.stufe).toBe(3);
  });
  it('nach dem Verblassen zählen alte Runden nicht mehr mit', () => {
    let sp = sicher();
    sp = rundeEintragen(sp, 'x', 0.3, tag(30)); // wirksam war 2
    sp = rundeEintragen(sp, 'x', 0.3, tag(30) + 1);
    expect(sp.x.stufe).toBe(2); // unter 3 Runden bleibt die verblasste Stufe
    sp = rundeEintragen(sp, 'x', 0.3, tag(30) + 2);
    expect(sp.x.stufe ?? 0).toBe(0);
    expect(sp.x.hoechste).toBe(3);
  });
});

describe('Zuletzt', () => {
  it('Kalendertage, nicht 24-Stunden-Blöcke', () => {
    const abends = new Date(2026, 10, 18, 23).getTime();
    const morgens = new Date(2026, 10, 19, 7).getTime();
    expect(tageSeit(abends, morgens)).toBe(1);
    expect(tageSeit(T0, tag(23))).toBe(23);
  });
  it('Text', () => {
    const sp = geuebtEintragen({}, 'x', T0);
    expect(zuletztText(sp.x, T0)).toBe('heute geübt');
    expect(zuletztText(sp.x, tag(1))).toBe('gestern geübt');
    expect(zuletztText(sp.x, tag(23))).toBe('zuletzt vor 23 Tagen');
    expect(zuletztText(undefined, T0)).toBeNull();
  });
});

describe('Markieren', () => {
  it('setzt und löscht; leerer Eintrag verschwindet', () => {
    let sp = markieren({}, 'x', 'will');
    expect(sp.x).toEqual({ markierung: 'will' });
    sp = markieren(sp, 'x', 'offen');
    expect(sp).toEqual({});
  });
  it('„kann“ zählt als sicher, auch ohne Messung', () => {
    expect(istSicher(markieren({}, 'x', 'kann').x, T0)).toBe(true);
    expect(istSicher(undefined, T0)).toBe(false);
  });
});

describe('Lesen und Prüfen', () => {
  it('unbekannte ids bleiben erhalten (künftige Kartei)', () => {
    const sp = skillsLesen({ 'gibt-es-noch-nicht': { markierung: 'will' }, intervalle: { stufe: 2, hoechste: 3 } });
    expect(sp['gibt-es-noch-nicht']).toEqual({ markierung: 'will' });
    expect(sp.intervalle).toEqual({ stufe: 2, hoechste: 3 });
  });
  it('nachsichtig: unbrauchbare Felder fallen weg, leere Einträge auch', () => {
    const sp = skillsLesen({
      a: { markierung: 'vielleicht', stufe: 9, zuletzt: 'gestern', quoten: [{ q: 2, am: T0 }, { q: 0.5, am: T0 }, 'x'] },
      b: { markierung: 'offen' },
      c: 'kaputt',
      __proto__: { markierung: 'will' },
      constructor: { markierung: 'will' },
    });
    expect(sp).toEqual({ a: { quoten: [{ q: 0.5, am: T0 }] } });
    expect(Object.getPrototypeOf(sp)).toBe(Object.prototype);
  });
  it('höchste nie unter der gemessenen; Quoten sortiert und auf 10 gekürzt', () => {
    const qs = Array.from({ length: 14 }, (_, i) => ({ q: 0.5, am: T0 + (14 - i) }));
    const sp = skillsLesen({ a: { stufe: 3, hoechste: 1, quoten: qs } });
    expect(sp.a.hoechste).toBe(3);
    expect(sp.a.quoten).toHaveLength(10);
    expect(sp.a.quoten![0].am).toBeLessThan(sp.a.quoten![9].am);
  });
  it('kein Objekt: leer', () => {
    expect(skillsLesen(null)).toEqual({});
    expect(skillsLesen([1, 2])).toEqual({});
    expect(skillsLesen('x')).toEqual({});
  });
  it('streng für die Sicherung', () => {
    const gut = runden('intervalle', gleich(0.9, 5), markieren({}, 'zukunft', 'lerne'));
    expect(skillsGueltig(gut)).toBe(true);
    expect(skillsGueltig(JSON.parse(JSON.stringify(gut)))).toBe(true);
    expect(skillsGueltig({ a: { quoten: Array(11).fill({ q: 0.5, am: T0 }) } })).toBe(false);
    expect(skillsGueltig({ a: { zuletzt: -1 } })).toBe(false);
    expect(skillsGueltig({ a: null })).toBe(false);
    expect(skillsGueltig(null)).toBe(false);
  });
});

describe('Übersicht und Filter', () => {
  it('„X von Y sicher“ und je Bereich', () => {
    let sp = markieren({}, 'blues-in-b', 'kann');
    sp = runden('intervalle', gleich(0.9, 5), sp);
    sp = runden('dur-moll', gleich(0.8, 5), sp); // vertraut, nicht sicher
    const u = uebersicht(sp, T0);
    expect(u.gesamt).toBe(SKILLS.length);
    expect(u.sicher).toBe(2);
    expect(u.bereiche.find((b) => b.bereich === 'gehoer')?.sicher).toBe(1);
    expect(u.bereiche.find((b) => b.bereich === 'repertoire')?.sicher).toBe(1);
    expect(uebersicht(sp, tag(60)).sicher).toBe(1); // intervalle verblasst
  });
  it('Filter', () => {
    let sp = markieren({}, 'a', 'will');
    sp = markieren(sp, 'p', 'pause');
    sp = runden('v', gleich(0.9, 5), sp);
    expect(imFilter(sp.a, 'will', T0)).toBe(true);
    expect(imFilter(sp.a, 'lerne', T0)).toBe(false);
    expect(imFilter(sp.p, 'pause', T0)).toBe(true);
    expect(imFilter(sp.v, 'kann', T0)).toBe(true);
    expect(imFilter(sp.v, 'verblasst', T0)).toBe(false);
    expect(imFilter(sp.v, 'verblasst', tag(30))).toBe(true);
    expect(imFilter(undefined, 'alle', T0)).toBe(true);
  });
});

describe('Heute (I-09)', () => {
  const ids = (l: Skill[]) => l.map((s) => s.id);
  it('Ohr: nur Skills mit Übung in der App; Stück: Repertoire/Mitspielen; Impro: Improvisation', () => {
    const ohr = heuteKandidaten('ohr', {}, T0);
    expect(ohr.every((s) => s.uebung)).toBe(true);
    expect(heuteKandidaten('stueck', {}, T0).every((s) => !s.uebung && (s.bereich === 'repertoire' || s.bereich === 'mitspielen'))).toBe(true);
    expect(heuteKandidaten('impro', {}, T0).every((s) => s.bereich === 'impro')).toBe(true);
  });
  it('ohne Markierungen: zuerst, wofür die Voraussetzungen erfüllt sind', () => {
    const ohr = heuteKandidaten('ohr', {}, T0);
    expect(ohr[0].id).toBe('melodie-drei');
    expect(ohr.findIndex((s) => s.id === 'melodie-fuenf')).toBeGreaterThan(ohr.findIndex((s) => s.id === 'intervalle'));
  });
  it('lerne vor will vor verblasst vor offen', () => {
    let sp = markieren({}, 'septakkorde', 'will');
    sp = markieren(sp, 'melodie-leiter', 'lerne');
    sp = runden('intervalle', gleich(0.9, 5), sp); // verblasst an Tag 30
    const l = ids(heuteKandidaten('ohr', sp, tag(30)));
    expect(l.slice(0, 3)).toEqual(['melodie-leiter', 'septakkorde', 'intervalle']);
  });
  it('pausierte nie; „kann“ nur, wenn verblasst', () => {
    let sp = markieren({}, 'melodie-drei', 'pause');
    sp = markieren(sp, 'intervalle', 'kann');
    expect(ids(heuteKandidaten('ohr', sp, T0))).not.toContain('melodie-drei');
    expect(ids(heuteKandidaten('ohr', sp, T0))).not.toContain('intervalle');
    sp = runden('intervalle', gleich(0.9, 5), sp);
    expect(ids(heuteKandidaten('ohr', sp, tag(1)))).not.toContain('intervalle');
    expect(ids(heuteKandidaten('ohr', sp, tag(25)))[0]).toBe('intervalle');
    // auch verblasst nie, wenn pausiert
    sp = markieren(sp, 'intervalle', 'pause');
    expect(ids(heuteKandidaten('ohr', sp, tag(25)))).not.toContain('intervalle');
  });
  it('am stärksten verblasst zuerst', () => {
    let sp = runden('intervalle', gleich(0.9, 5));
    sp = runden('dur-moll', gleich(0.9, 5).map(([q]): [number, number] => [q, 10]), sp);
    expect(ids(heuteKandidaten('ohr', sp, tag(40))).slice(0, 2)).toEqual(['intervalle', 'dur-moll']);
  });
  it('bei mehreren „lerne“ zuerst, was am längsten nicht geübt wurde', () => {
    let sp = markieren(markieren({}, 'blue-bossa', 'lerne'), 'autumn-leaves', 'lerne');
    expect(ids(heuteKandidaten('stueck', sp, T0)).slice(0, 2)).toEqual(['blue-bossa', 'autumn-leaves']);
    sp = geuebtEintragen(sp, 'blue-bossa', T0);
    expect(ids(heuteKandidaten('stueck', sp, tag(1))).slice(0, 2)).toEqual(['autumn-leaves', 'blue-bossa']);
  });
  it('nicht verfügbare Übungen fallen weg', () => {
    const ohne = heuteKandidaten('ohr', {}, T0, (s) => s.uebung?.art !== 'hoer');
    expect(ohne.some((s) => s.uebung?.art === 'hoer')).toBe(false);
    expect(ohne.length).toBe(6);
  });
  it('deterministisch: gleiche Eingabe, gleicher Vorschlag', () => {
    const sp = markieren(runden('intervalle', gleich(0.9, 5)), 'blues-phrasen', 'will');
    const h = heuteLeer(tag(3));
    expect(heuteVorschlag(h, sp, tag(3))).toEqual(heuteVorschlag(h, sp, tag(3)));
    expect(heuteVorschlag(h, sp, tag(3)).find((b) => b.block === 'impro')?.skill?.id).toBe('blues-phrasen');
  });
  it('„Anderer Vorschlag“ tauscht nur diesen Block, reihum', () => {
    const sp: SkillSpeicher = {};
    let h = heuteLeer(T0);
    const vorher = heuteVorschlag(h, sp, T0);
    h = andererVorschlag(h, 'stueck');
    const nachher = heuteVorschlag(h, sp, T0);
    expect(nachher[0].skill?.id).toBe(vorher[0].skill?.id);
    expect(nachher[1].skill?.id).not.toBe(vorher[1].skill?.id);
    expect(nachher[2].skill?.id).toBe(vorher[2].skill?.id);
    for (let i = 1; i < nachher[1].anzahl; i++) h = andererVorschlag(h, 'stueck');
    expect(heuteVorschlag(h, sp, T0)[1].skill?.id).toBe(vorher[1].skill?.id);
  });
  it('erledigte Blöcke behalten ihren Skill; alle drei = eine Einheit', () => {
    let h = heuteLeer(T0);
    h = heuteErledigen(h, 'ohr', 'intervalle', T0);
    h = heuteErledigen(h, 'stueck', 'blue-bossa', T0);
    expect(h.einheiten).toEqual([]);
    const v = heuteVorschlag(h, {}, T0);
    expect(v[0]).toMatchObject({ erledigt: true, skill: { id: 'intervalle' } });
    h = heuteErledigen(h, 'impro', 'frage-antwort', T0);
    expect(h.einheiten).toEqual([tagSchluessel(T0)]);
    h = heuteErledigen(h, 'impro', 'frage-antwort', T0 + 1000);
    expect(h.einheiten).toHaveLength(1);
  });
  it('Block ohne Vorschlag zählt nicht mit', () => {
    let h = heuteLeer(T0);
    h = heuteErledigen(h, 'ohr', 'intervalle', T0, ['ohr', 'stueck']);
    h = heuteErledigen(h, 'stueck', 'blue-bossa', T0, ['ohr', 'stueck']);
    expect(h.einheiten).toHaveLength(1);
  });
  it('neuer Tag: frische Einheit, Einheiten bleiben; Woche ab Montag', () => {
    let h = heuteLeer(T0);
    for (const b of ['ohr', 'stueck', 'impro'] as const) h = heuteErledigen(h, b, 'x', T0);
    const gelesen = heuteLesen(JSON.parse(JSON.stringify(h)), tag(1));
    expect(gelesen.erledigt).toEqual({});
    expect(gelesen.einheiten).toEqual([tagSchluessel(T0)]);
    expect(heuteLesen(h, T0).erledigt.ohr).toBe('x');
    // T0 ist Mittwoch: Montag davor zählt, Sonntag davor nicht.
    const mehr = { ...h, einheiten: [tagSchluessel(tag(-3)), tagSchluessel(tag(-2)), tagSchluessel(T0)] };
    expect(wocheEinheiten(mehr, T0)).toBe(2);
    expect(wocheEinheiten(mehr, tag(4))).toBe(2); // Sonntag
    expect(wocheEinheiten(mehr, tag(5))).toBe(0); // nächster Montag
  });
  it('Lesen ist nachsichtig', () => {
    const h = heuteLesen({ tag: tagSchluessel(T0), wechsel: { ohr: 2, quatsch: 3, impro: -1 }, erledigt: { stueck: 'blue-bossa', ohr: 5 }, einheiten: ['2026-11-17', 'kaputt', '2026-11-17'] }, T0);
    expect(h).toEqual({ tag: tagSchluessel(T0), wechsel: { ohr: 2 }, erledigt: { stueck: 'blue-bossa' }, einheiten: ['2026-11-17'] });
    expect(heuteLesen(null, T0)).toEqual(heuteLeer(T0));
  });
});

describe('Zwei Geräte (A-08)', () => {
  it('jede Änderung datiert den Skill', () => {
    expect(rundeEintragen({}, 'x', 0.8, T0).x.geaendert).toBe(T0);
    expect(geuebtEintragen({}, 'x', T0).x.geaendert).toBe(T0);
    expect(markieren({}, 'x', 'will', T0).x.geaendert).toBe(T0);
    // Auch „offen“ bleibt als datierter Eintrag stehen.
    expect(markieren(markieren({}, 'x', 'will', T0), 'x', 'offen', tag(1))).toEqual({ x: { geaendert: tag(1) } });
  });
  it('Zeit eines Skills: geaendert, sonst die letzte Übung', () => {
    expect(skillZeit({ geaendert: 5, zuletzt: 9 })).toBe(5);
    expect(skillZeit({ zuletzt: 9, quoten: [{ q: 1, am: 12 }] })).toBe(12);
    expect(skillZeit({ markierung: 'will' })).toBe(0);
  });
  it('je Skill gewinnt der neuere Stand als Ganzes; bei Gleichstand der hiesige', () => {
    const hier: SkillSpeicher = { a: { stufe: 3, hoechste: 3, geaendert: tag(5) }, b: { markierung: 'will', geaendert: tag(1) }, gleich: { markierung: 'lerne', geaendert: tag(2) } };
    const dort: SkillSpeicher = { a: { stufe: 1, hoechste: 1, geaendert: tag(2) }, b: { markierung: 'kann', geaendert: tag(3) }, c: { markierung: 'pause' }, gleich: { markierung: 'kann', geaendert: tag(2) } };
    expect(skillsVereinigen(hier, dort)).toEqual({
      a: { stufe: 3, hoechste: 3, geaendert: tag(5) }, b: { markierung: 'kann', geaendert: tag(3) }, c: { markierung: 'pause' }, gleich: { markierung: 'lerne', geaendert: tag(2) },
    });
  });
  it('„offen“ auf einem Gerät schlägt eine ältere Markierung vom anderen', () => {
    const hier = markieren(markieren({}, 'x', 'will', T0), 'x', 'offen', tag(2));
    expect(skillsVereinigen(hier, markieren({}, 'x', 'kann', tag(1))).x.markierung).toBeUndefined();
  });
  it('lesen und prüfen behalten geaendert', () => {
    expect(skillsLesen({ x: { markierung: 'will', geaendert: T0 } })).toEqual({ x: { markierung: 'will', geaendert: T0 } });
    expect(skillsGueltig({ x: { geaendert: T0 } })).toBe(true);
    expect(skillsGueltig({ x: { geaendert: 'gestern' } })).toBe(false);
  });
});
