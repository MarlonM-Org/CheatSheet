import { describe, expect, it } from 'vitest';
import { akkordPruefen, istAkkord } from '@/domain/akkorde';
import { MUSTER, musterVon } from '@/domain/etueden';
import { BEREICH as GRIFF_BEREICH } from '@/domain/griffe';
import { JAM_STUECKE } from '@/domain/jamkarte';
import { lickSkills, START_LICKS } from '@/domain/licks';
import { BEREICHE, HOER_UEBUNGEN, SKILLS, skillFinden, skillFuerHoerUebung, skillFuerOhrStufe, type Skill } from '@/domain/skillkatalog';
import { STUFEN } from '@/domain/gehoer';
import {
  andererVorschlag, BLOECKE_MAX, geuebtEintragen, heuteArt, heuteFestschreiben, heuteKandidaten, heuteLeer, heuteLesen, heuteVorschlag,
  hoechsteStufe, imFilter, istSicher, markieren, rundeEintragen, skillsGueltig, skillsLesen, skillsVereinigen, skillZeit, staerke, stufeAusRunden, tagSchluessel, tageSeit,
  uebersicht, verblasst, wirksameStufe, wocheEinheiten, zuletztText, type HeuteStand, type SkillSpeicher,
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
  it('jeder Skill sagt in einer Aufgabe, was in zehn Minuten zu tun ist (kurz genug für den Block)', () => {
    for (const s of SKILLS) {
      expect(s.aufgabe, s.id).toBeTruthy();
      expect(s.aufgabe.length, s.id).toBeLessThanOrEqual(150);
      expect(s.aufgabe, s.id).not.toMatch(/^Extern üben/);
    }
  });
  it('Werkzeug-Verknüpfungen zeigen auf etwas, das es gibt; nie zugleich mit einer App-Übung', () => {
    const mit = SKILLS.filter((s) => s.werkzeug);
    expect(mit.length).toBeGreaterThanOrEqual(15);
    for (const s of mit) {
      const w = s.werkzeug!;
      expect(s.uebung, s.id).toBeUndefined();
      if (w.art === 'etueden') expect(MUSTER.some((m) => m.id === w.muster), s.id).toBe(true);
      if (w.art === 'licks' && w.lick) expect(START_LICKS.some((l) => l.id === w.lick), s.id).toBe(true);
      if (w.art === 'jam') expect(JAM_STUECKE.some((j) => j.id === w.stueck), s.id).toBe(true);
      if (w.art === 'spick') expect(istAkkord(akkordPruefen(w.akkord)), s.id).toBe(true);
      if (w.art === 'griffe') expect(w.midi >= GRIFF_BEREICH.von && w.midi <= GRIFF_BEREICH.bis, s.id).toBe(true);
      if (w.art === 'drone') expect(Number.isInteger(w.grundton) && w.grundton >= 0 && w.grundton < 12, s.id).toBe(true);
    }
  });
  it('wo das Werkzeug selbst „geübt“ meldet, meldet es auf den verknüpften Skill', () => {
    const werkzeug = (id: string) => skillFinden(id)?.werkzeug;
    // Etüden: „Geübt“ zählt für die Skills des Musters.
    for (const id of ['tonleitern-12', 'dreiklang-arpeggien', 'septakkord-arpeggien', 'guide-tones', 'enclosure']) {
      const w = werkzeug(id);
      expect(w?.art, id).toBe('etueden');
      if (w?.art === 'etueden') expect(musterVon(w.muster).skills, id).toContain(id);
    }
    // Jam-Karte: „Heute gespielt“ zählt auf den Repertoire-Skill des Stücks.
    for (const id of ['blues-in-b', 'blue-bossa', 'autumn-leaves', 'summertime']) {
      const w = werkzeug(id);
      expect(w?.art, id).toBe('jam');
      if (w?.art === 'jam') expect(JAM_STUECKE.find((j) => j.id === w.stueck)?.skill, id).toBe(id);
    }
    // Licks: Bewerten zählt auf „Licks“, ein Blues-Lick auch auf „Blues-Phrasen“.
    const blues = werkzeug('blues-phrasen');
    expect(blues?.art).toBe('licks');
    if (blues?.art === 'licks') expect(lickSkills(START_LICKS.find((l) => l.id === blues.lick)!)).toContain('blues-phrasen');
    expect(werkzeug('licks-transponieren')?.art).toBe('licks');
    // Griffweisen: „Heute geübt“ erst ab dem Clarion.
    expect(werkzeug('clarion-altissimo')).toEqual({ art: 'griffe', midi: 71 });
    expect(werkzeug('swing-artikulation')?.art).toBe('metronom');
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

describe('Heute (I-09): Blöcke aus den „Lerne ich“-Skills', () => {
  const ids = (v: { bloecke: { skill: Skill }[] }) => v.bloecke.map((b) => b.skill.id);
  const lerne = (...liste: string[]) => liste.reduce<SkillSpeicher>((sp, id) => markieren(sp, id, 'lerne'), {});
  // Wie die Ansicht: Vorschlag zeigen und den Tagesplan festhalten.
  const ansehen = (h: HeuteStand, sp: SkillSpeicher, jetzt: number) => {
    const v = heuteVorschlag(h, sp, jetzt);
    return { v, h: heuteFestschreiben(h, v, jetzt) };
  };
  // Fünf „Lerne ich“ aus vier Bereichen, in Katalog-Reihenfolge.
  const FUENF = ['intervalle', 'stufen-funktionen', 'tonleitern-12', 'doppelzunge', 'frage-antwort'];

  it('kein „Lerne ich“: keine Blöcke — auch nicht mit ☆ oder Verblasstem', () => {
    let sp = markieren({}, 'pentatonik', 'will');
    sp = runden('intervalle', gleich(0.9, 5), sp);
    const v = heuteVorschlag(heuteLeer(tag(30)), sp, tag(30));
    expect(v).toEqual({ bloecke: [], plan: [], lerne: 0, fertig: false });
  });

  it('Kandidaten aus allen Bereichen: „Lerne ich“ zuerst, darin am längsten nicht geübt zuerst', () => {
    let sp = lerne('doppelzunge', 'stufen-funktionen', 'tonleitern-12', 'intervalle');
    sp = geuebtEintragen(sp, 'doppelzunge', tag(-1));
    sp = geuebtEintragen(sp, 'tonleitern-12', tag(-5));
    sp = markieren(sp, 'pentatonik', 'will');
    const k = heuteKandidaten(sp, T0);
    expect(k.map((x) => x.skill.id)).toEqual(['intervalle', 'stufen-funktionen', 'tonleitern-12', 'doppelzunge', 'pentatonik']);
    expect(k.map((x) => x.art)).toEqual(['lerne', 'lerne', 'lerne', 'lerne', 'will']);
  });

  it('drei „Lerne ich“ aus Klarinette, Technik und Theorie: genau diese drei Blöcke, nichts zu tauschen', () => {
    const v = heuteVorschlag(heuteLeer(T0), lerne('doppelzunge', 'stufen-funktionen', 'tonleitern-12'), T0);
    expect(ids(v)).toEqual(['stufen-funktionen', 'tonleitern-12', 'doppelzunge']);
    expect(v.bloecke.map((b) => b.art)).toEqual(['lerne', 'lerne', 'lerne']);
    expect(v.bloecke.some((b) => b.erledigt || b.tauschbar)).toBe(false);
    expect(v.lerne).toBe(3);
  });

  it('mehr als drei: die am längsten nicht geübten — reihum über die Tage', () => {
    let sp = lerne(...FUENF);
    let h = heuteLeer(T0);
    const tage: string[][] = [];
    for (let t = 0; t < 3; t++) {
      const gezeigt = ansehen(heuteLesen(JSON.parse(JSON.stringify(h)), tag(t)), sp, tag(t));
      const v = gezeigt.v;
      h = gezeigt.h;
      expect(v.bloecke).toHaveLength(BLOECKE_MAX);
      tage.push(ids(v));
      ids(v).forEach((id, i) => { sp = geuebtEintragen(sp, id, tag(t) + 1000 * (i + 1)); });
      h = ansehen(h, sp, tag(t) + 5000).h;
    }
    expect(tage[0]).toEqual(['intervalle', 'stufen-funktionen', 'tonleitern-12']);
    expect(tage[1]).toEqual(['doppelzunge', 'frage-antwort', 'intervalle']);
    expect(tage[2]).toEqual(['stufen-funktionen', 'tonleitern-12', 'doppelzunge']);
    expect(new Set(tage.slice(0, 2).flat()).size).toBe(5);
    expect(h.einheiten).toEqual([tagSchluessel(tag(0)), tagSchluessel(tag(1)), tagSchluessel(tag(2))]);
  });

  it('Üben verschiebt nichts: der Plan des Tages steht, sobald er gezeigt wurde', () => {
    let sp = lerne(...FUENF);
    const { h } = ansehen(heuteLeer(T0), sp, T0);
    expect(h.plan).toEqual(['intervalle', 'stufen-funktionen', 'tonleitern-12']);
    sp = geuebtEintragen(sp, 'stufen-funktionen', T0 + 1000); // Block 2 erledigt
    sp = geuebtEintragen(sp, 'doppelzunge', T0 + 2000); // außerhalb von „Heute“ geübt
    const v = heuteVorschlag(h, sp, T0 + 3000);
    expect(ids(v)).toEqual(h.plan);
    expect(v.bloecke.map((b) => b.erledigt)).toEqual([false, true, false]);
    // Ohne festgehaltenen Plan sähe es jetzt anders aus — darum wird er festgehalten.
    expect(ids(heuteVorschlag(heuteLeer(T0), sp, T0 + 3000))).not.toEqual(h.plan);
  });

  it('„Anderer Vorschlag“ tauscht nur diesen Block gegen den nächsten „Lerne ich“, reihum', () => {
    let sp = lerne(...FUENF);
    let { h } = ansehen(heuteLeer(T0), sp, T0);
    h = andererVorschlag(h, 1, sp, T0);
    expect(h.plan).toEqual(['intervalle', 'doppelzunge', 'tonleitern-12']);
    h = andererVorschlag(h, 1, sp, T0);
    expect(h.plan).toEqual(['intervalle', 'frage-antwort', 'tonleitern-12']);
    h = andererVorschlag(h, 1, sp, T0);
    expect(h.plan).toEqual(['intervalle', 'stufen-funktionen', 'tonleitern-12']);
    // Erledigtes ist nicht tauschbar; heute schon Geübtes kommt nicht als Tausch.
    sp = geuebtEintragen(sp, 'intervalle', T0 + 1000);
    sp = geuebtEintragen(sp, 'doppelzunge', T0 + 1000);
    const v = heuteVorschlag(h, sp, T0 + 2000);
    expect(v.bloecke.map((b) => b.tauschbar)).toEqual([false, true, true]);
    expect(andererVorschlag(h, 0, sp, T0 + 2000).plan).toEqual(h.plan);
    expect(andererVorschlag(h, 2, sp, T0 + 2000).plan).toEqual(['intervalle', 'stufen-funktionen', 'frage-antwort']);
    expect(andererVorschlag(h, 7, sp, T0 + 2000).plan).toEqual(h.plan);
  });

  it('weniger als drei: aufgefüllt mit ☆ „Will ich“, dann Verblasstem — als Auffüllung gekennzeichnet', () => {
    let sp = lerne('tonleitern-12');
    sp = markieren(sp, 'pentatonik', 'will');
    sp = runden('intervalle', gleich(0.9, 5), sp); // an Tag 30 verblasst
    sp = markieren(sp, 'blue-bossa', 'pause');
    sp = markieren(sp, 'dur-moll', 'kann');
    const v = heuteVorschlag(heuteLeer(tag(30)), sp, tag(30));
    expect(ids(v)).toEqual(['tonleitern-12', 'pentatonik', 'intervalle']);
    expect(v.bloecke.map((b) => b.art)).toEqual(['lerne', 'will', 'verblasst']);
    expect(v.lerne).toBe(1);
    expect(v.bloecke.map((b) => b.tauschbar)).toEqual([false, false, false]);
    // Auffüllungen tauschen untereinander, nie gegen ein „Lerne ich“.
    const h = heuteFestschreiben(heuteLeer(tag(30)), v, tag(30));
    sp = markieren(sp, 'blues-tonleiter', 'will');
    expect(heuteVorschlag(h, sp, tag(30)).bloecke.map((b) => b.tauschbar)).toEqual([false, true, true]);
    expect(andererVorschlag(h, 1, sp, tag(30)).plan).toEqual(['tonleitern-12', 'blues-tonleiter', 'intervalle']);
    expect(andererVorschlag(h, 2, sp, tag(30)).plan).toEqual(['tonleitern-12', 'pentatonik', 'blues-tonleiter']);
  });

  it('was zum Auffüllen taugt: ☆ und Verblasstes (auch „kann“), nie „Gerade nicht“, nie Sicheres oder Unberührtes', () => {
    let sp = runden('septakkorde', gleich(0.9, 5));
    sp = markieren(sp, 'septakkorde', 'kann');
    expect(heuteArt(sp.septakkorde, tag(1))).toBeNull();
    expect(heuteArt(sp.septakkorde, tag(30))).toBe('verblasst');
    sp = markieren(sp, 'septakkorde', 'pause');
    expect(heuteArt(sp.septakkorde, tag(30))).toBeNull();
    expect(heuteArt(undefined, T0)).toBeNull();
    expect(heuteArt(markieren({}, 'x', 'will').x, T0)).toBe('will');
    expect(heuteArt(markieren({}, 'x', 'lerne').x, T0)).toBe('lerne');
  });

  it('Auffüllung: ☆ am längsten nicht geübt zuerst, dann am stärksten verblasst zuerst', () => {
    let sp = lerne('tonleitern-12');
    sp = runden('intervalle', gleich(0.9, 5), sp);
    sp = runden('dur-moll', gleich(0.9, 5).map(([q]): [number, number] => [q, 10]), sp);
    expect(ids(heuteVorschlag(heuteLeer(tag(40)), sp, tag(40)))).toEqual(['tonleitern-12', 'intervalle', 'dur-moll']);
    sp = geuebtEintragen(markieren(sp, 'pentatonik', 'will'), 'pentatonik', tag(39));
    sp = markieren(sp, 'blues-tonleiter', 'will');
    expect(heuteKandidaten(sp, tag(40)).map((k) => k.skill.id)).toEqual(['tonleitern-12', 'blues-tonleiter', 'pentatonik', 'intervalle', 'dur-moll']);
  });

  it('nicht genug zum Auffüllen: weniger Blöcke, die Einheit braucht nur sie', () => {
    let sp = lerne('doppelzunge', 'tonleitern-12');
    let r = ansehen(heuteLeer(T0), sp, T0);
    expect(ids(r.v)).toEqual(['tonleitern-12', 'doppelzunge']);
    sp = geuebtEintragen(sp, 'doppelzunge', T0 + 1);
    sp = geuebtEintragen(sp, 'tonleitern-12', T0 + 2);
    r = ansehen(r.h, sp, T0 + 3);
    expect(r.v.fertig).toBe(true);
    expect(r.h.einheiten).toEqual([tagSchluessel(T0)]);
  });

  it('neues „Lerne ich“ verdrängt eine offene Auffüllung an ihrer Stelle; was nicht mehr passt, wird an derselben Stelle ersetzt', () => {
    let sp = lerne('tonleitern-12');
    sp = markieren(sp, 'pentatonik', 'will');
    sp = markieren(sp, 'blues-tonleiter', 'will');
    let { h } = ansehen(heuteLeer(T0), sp, T0);
    expect(h.plan).toEqual(['tonleitern-12', 'pentatonik', 'blues-tonleiter']);
    sp = markieren(sp, 'doppelzunge', 'lerne');
    ({ h } = ansehen(h, sp, T0));
    expect(h.plan).toEqual(['tonleitern-12', 'doppelzunge', 'blues-tonleiter']);
    sp = markieren(sp, 'tonleitern-12', 'pause');
    ({ h } = ansehen(h, sp, T0));
    expect(h.plan).toEqual(['pentatonik', 'doppelzunge', 'blues-tonleiter']);
  });

  it('erledigt, sobald der Skill heute geübt ist — gleich wo; alle erledigt = eine Einheit', () => {
    let sp = lerne('intervalle', 'tonleitern-12', 'blues-in-b');
    let r = ansehen(heuteLeer(T0), sp, T0);
    expect(r.v.bloecke.some((b) => b.erledigt)).toBe(false);
    sp = rundeEintragen(sp, 'intervalle', 0.8, T0 + 1000); // Runde der Hör-Übung
    sp = geuebtEintragen(sp, 'tonleitern-12', T0 + 2000); // „Geübt“ in den Etüden
    r = ansehen(r.h, sp, T0 + 3000);
    expect(r.v.bloecke.map((b) => b.erledigt)).toEqual([true, true, false]);
    expect(r.v.fertig).toBe(false);
    expect(r.h.einheiten).toEqual([]);
    sp = geuebtEintragen(sp, 'blues-in-b', T0 + 4000); // „Erledigt“ im Block
    r = ansehen(r.h, sp, T0 + 5000);
    expect(r.v.fertig).toBe(true);
    expect(r.h.einheiten).toEqual([tagSchluessel(T0)]);
    expect(heuteFestschreiben(r.h, heuteVorschlag(r.h, sp, T0 + 6000), T0 + 6000)).toBe(r.h); // nichts doppelt
    // Erledigtes bleibt stehen, auch wenn die Markierung danach wechselt.
    sp = markieren(sp, 'tonleitern-12', 'kann');
    expect(ids(heuteVorschlag(r.h, sp, T0 + 7000))).toEqual(['intervalle', 'tonleitern-12', 'blues-in-b']);
    // Gestern Geübtes zählt heute nicht.
    expect(heuteVorschlag(heuteLeer(tag(1)), sp, tag(1)).bloecke.some((b) => b.erledigt)).toBe(false);
  });

  it('kein „Lerne ich“ mehr, aber heute schon erledigt: bleibt sichtbar, ohne Auffüllung und ohne neue Einheit', () => {
    let sp = lerne('intervalle', 'tonleitern-12');
    sp = markieren(sp, 'pentatonik', 'will');
    const { h } = ansehen(heuteLeer(T0), sp, T0);
    expect(h.plan).toEqual(['intervalle', 'tonleitern-12', 'pentatonik']);
    sp = geuebtEintragen(sp, 'intervalle', T0 + 1);
    sp = markieren(markieren(sp, 'intervalle', 'kann'), 'tonleitern-12', 'offen');
    const v = heuteVorschlag(h, sp, T0 + 2);
    expect(v.lerne).toBe(0);
    expect(ids(v)).toEqual(['intervalle']);
    expect(v.bloecke[0].erledigt).toBe(true);
    expect(v.fertig).toBe(false);
  });

  it('nicht verfügbare Übungen fallen weg', () => {
    const v = heuteVorschlag(heuteLeer(T0), lerne('intervalle', 'melodie-drei', 'tonleitern-12'), T0, (s) => s.uebung?.art !== 'hoer');
    expect(ids(v)).toEqual(['melodie-drei', 'tonleitern-12']);
  });

  it('deterministisch: gleiche Eingabe, gleicher Vorschlag', () => {
    const sp = markieren(runden('intervalle', gleich(0.9, 5)), 'blues-phrasen', 'lerne');
    const h = heuteLeer(tag(30));
    expect(heuteVorschlag(h, sp, tag(30))).toEqual(heuteVorschlag(h, sp, tag(30)));
    expect(ids(heuteVorschlag(h, sp, tag(30)))).toEqual(['blues-phrasen', 'intervalle']);
  });

  it('neuer Tag: frischer Plan, Einheiten bleiben; Woche ab Montag', () => {
    const h: HeuteStand = { tag: tagSchluessel(T0), plan: ['intervalle'], einheiten: [tagSchluessel(T0)] };
    expect(heuteLesen(JSON.parse(JSON.stringify(h)), tag(1))).toEqual({ tag: tagSchluessel(tag(1)), plan: [], einheiten: [tagSchluessel(T0)] });
    expect(heuteLesen(h, T0).plan).toEqual(['intervalle']);
    // Ein liegengebliebener Stand von gestern gilt heute nicht als Plan.
    expect(ids(heuteVorschlag(h, lerne('tonleitern-12'), tag(1)))).toEqual(['tonleitern-12']);
    // T0 ist Mittwoch: Montag davor zählt, Sonntag davor nicht.
    const mehr = { ...h, einheiten: [tagSchluessel(tag(-3)), tagSchluessel(tag(-2)), tagSchluessel(T0)] };
    expect(wocheEinheiten(mehr, T0)).toBe(2);
    expect(wocheEinheiten(mehr, tag(4))).toBe(2); // Sonntag
    expect(wocheEinheiten(mehr, tag(5))).toBe(0); // nächster Montag
  });

  it('Lesen ist nachsichtig', () => {
    const h = heuteLesen({ tag: tagSchluessel(T0), plan: ['intervalle', 5, '__proto__', 'intervalle', 'a', 'b', 'c'], einheiten: ['2026-11-17', 'kaputt', '2026-11-17'] }, T0);
    expect(h).toEqual({ tag: tagSchluessel(T0), plan: ['intervalle', 'a', 'b'], einheiten: ['2026-11-17'] });
    expect(heuteLesen(null, T0)).toEqual(heuteLeer(T0));
    expect(heuteLesen('kaputt', T0)).toEqual(heuteLeer(T0));
    expect(heuteLesen({ tag: tagSchluessel(T0), plan: 'x', einheiten: 'y' }, T0)).toEqual(heuteLeer(T0));
    // Unbekannte ids im Plan stören den Vorschlag nicht: Ersatz an derselben Stelle.
    expect(ids(heuteVorschlag(h, lerne('tonleitern-12', 'doppelzunge'), T0))).toEqual(['tonleitern-12', 'doppelzunge']);
  });

  it('alter Stand (Blöcke ohr/stueck/impro) vom selben Tag: Erledigtes wird übernommen, der Rest kommt neu dazu', () => {
    const alt = { tag: tagSchluessel(T0), wechsel: { ohr: 2, stueck: 1 }, erledigt: { ohr: 'intervalle', stueck: 'blue-bossa' }, einheiten: ['2026-11-16'] };
    const h = heuteLesen(JSON.parse(JSON.stringify(alt)), T0 + 1000);
    expect(h).toEqual({ tag: tagSchluessel(T0), plan: ['intervalle', 'blue-bossa'], einheiten: ['2026-11-16'] });
    // Die alte Fassung hatte beim Erledigen „heute geübt“ eingetragen.
    let sp = geuebtEintragen(rundeEintragen({}, 'intervalle', 0.9, T0 - 2000), 'blue-bossa', T0 - 1000);
    sp = markieren(sp, 'tonleitern-12', 'lerne');
    let r = ansehen(h, sp, T0 + 1000);
    expect(ids(r.v)).toEqual(['intervalle', 'blue-bossa', 'tonleitern-12']);
    expect(r.v.bloecke.map((b) => b.erledigt)).toEqual([true, true, false]);
    sp = geuebtEintragen(sp, 'tonleitern-12', T0 + 2000);
    r = ansehen(r.h, sp, T0 + 3000);
    expect(r.h.einheiten).toEqual(['2026-11-16', tagSchluessel(T0)]);
    // Der gespeicherte Stand hat danach die neue Form.
    expect(Object.keys(r.h).sort()).toEqual(['einheiten', 'plan', 'tag']);
  });

  it('alter Stand von gestern, kaputt oder unstimmig: sauber neu, Einheiten bleiben', () => {
    expect(heuteLesen({ tag: tagSchluessel(tag(-1)), wechsel: { ohr: 1 }, erledigt: { ohr: 'intervalle' }, einheiten: [tagSchluessel(tag(-1))] }, T0))
      .toEqual({ tag: tagSchluessel(T0), plan: [], einheiten: [tagSchluessel(tag(-1))] });
    expect(heuteLesen({ tag: tagSchluessel(T0), wechsel: 'x', erledigt: { ohr: 5, impro: '__proto__', quatsch: 'intervalle', stueck: 'blue-bossa' } }, T0))
      .toEqual({ tag: tagSchluessel(T0), plan: ['blue-bossa'], einheiten: [] });
    expect(heuteLesen({ tag: tagSchluessel(T0), erledigt: [] }, T0)).toEqual(heuteLeer(T0));
    // „Erledigt“ laut altem Stand, aber heute gar nicht geübt: wird an derselben Stelle ersetzt.
    const h = heuteLesen({ tag: tagSchluessel(T0), erledigt: { ohr: 'intervalle' }, einheiten: [] }, T0);
    expect(ids(heuteVorschlag(h, lerne('tonleitern-12'), T0))).toEqual(['tonleitern-12']);
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
