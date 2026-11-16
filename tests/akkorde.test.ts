import { describe, expect, it } from 'vitest';
import {
  A_KLARINETTE, akkordAbc, akkordKlaenge, akkordLesen, akkordMidi, akkordName, akkordPruefen, akkordText, akkordTransponieren, akkordUndLeiterKlaenge,
  akkordVersetzen, enharmonisch, folgeBequem, folgeLesen, folgeText, folgeTextTransponieren, funktion, guideTones, klarinettenSchwierigkeit, LEITERN,
  leiterAbc, leiterBauen, leiterKlaenge, leiterMidi, leiterVorschlaege, SCHNELLWAHL, STIMMUNG_INTERVALL, STIMMUNGEN, tonartAusKlasse, tonartBequem,
  tonartEnharmonisch, tonartLesen, tonartName, tonartSymbol, tonartTransponieren, tonAusKlasse, tonDeutsch, tonDeutschMitOktave, tonKlasse, tonLesen,
  tonSymbol, tonTransponieren, tonVersetzen, vorzeichen, vorzeichenText, type Akkord, type Ton,
} from '@/domain/akkorde';
import { tonName } from '@/domain/tonprofil';

const a = (s: string): Akkord => {
  const x = akkordLesen(s);
  if (!x) throw new Error(`nicht lesbar: ${s}`);
  return x;
};
const ton = (s: string): Ton => tonLesen(s)!;
const deutsch = (x: Akkord) => x.toene.map((t) => tonDeutsch(t.ton)).join(' ');
const funktionen = (x: Akkord) => x.toene.map((t) => t.funktion).join(' ');
const guide = (x: Akkord) => guideTones(x).map((t) => t.funktion).join(' ');
const leiterText = (id: keyof typeof LEITERN, grund: string) => leiterBauen(id, ton(grund)).toene.map((t) => tonSymbol(t.ton)).join(' ');

describe('Töne: Namen und Schreibweise', () => {
  it('deutsch wie in der App (B = B♭, H = B)', () => {
    expect(['C', 'C#', 'Db', 'Eb', 'E', 'F#', 'Ab', 'Bb', 'B', 'H'].map((s) => tonDeutsch(ton(s)))).toEqual(['C', 'Cis', 'Des', 'Es', 'E', 'Fis', 'As', 'B', 'H', 'H']);
    expect(['Cb', 'E#', 'B#', 'Fb', 'Bbb', 'Ebb', 'Abb', 'F##', 'Gb'].map((s) => tonDeutsch(ton(s)))).toEqual(['Ces', 'Eis', 'His', 'Fes', 'Heses', 'Eses', 'Asas', 'Fisis', 'Ges']);
  });
  it('stimmt mit tonName überein, wo tonName schreibt (Cis, Es, Fis, As, B)', () => {
    for (let m = 60; m < 72; m++) {
      const pc = m % 12;
      const t = [1, 6].includes(pc) ? tonAusKlasse(pc, 'kreuz') : tonAusKlasse(pc, 'be');
      expect(tonDeutschMitOktave(t, m)).toBe(tonName(m));
    }
  });
  it('Oktave folgt dem Stammton (Ces5 = H4 klingend, His3 = C4)', () => {
    expect(tonDeutschMitOktave(ton('Cb'), 71)).toBe('Ces5');
    expect(tonDeutschMitOktave(ton('B#'), 60)).toBe('His3');
  });
  it('international mit ♭/♯ oder ASCII', () => {
    expect(tonSymbol(ton('Bb'))).toBe('B♭');
    expect(tonSymbol(ton('F#'), true)).toBe('F#');
    expect(tonSymbol(ton('H'))).toBe('B');
    expect(tonLesen('E♭')).toEqual({ stamm: 2, vz: -1 });
    expect(tonLesen('X')).toBeNull();
  });
  it('Tonklasse, enharmonisch', () => {
    expect(tonKlasse(ton('Cb'))).toBe(11);
    expect(tonKlasse(ton('B#'))).toBe(0);
    expect(enharmonisch(ton('C#'), 1)).toEqual(ton('Db'));
    expect(enharmonisch(ton('Db'), -1)).toEqual(ton('C#'));
    expect(enharmonisch(ton('F#'), 1)).toEqual(ton('Gb'));
    expect(enharmonisch(ton('Bb'), -1)).toEqual(ton('A#'));
  });
  it('Versetzen über Intervalle schreibt richtig', () => {
    expect(tonVersetzen(ton('Bb'), { stufen: 1, halbtoene: 2 })).toEqual(ton('C'));
    expect(tonVersetzen(ton('E'), { stufen: 1, halbtoene: 2 })).toEqual(ton('F#'));
    expect(tonVersetzen(ton('C'), { stufen: 2, halbtoene: 3 })).toEqual(ton('Eb'));
    expect(tonVersetzen(ton('F#'), { stufen: 1, halbtoene: 2 }, -1)).toEqual(ton('E'));
  });
  it('Funktionen', () => {
    expect(funktion({ zahl: 3, halbtoene: 3 })).toBe('♭3');
    expect(funktion({ zahl: 7, halbtoene: 9 })).toBe('𝄫7');
    expect(funktion({ zahl: 11, halbtoene: 6 })).toBe('♯11');
    expect(funktion({ zahl: 13, halbtoene: 8 })).toBe('♭13');
    expect(funktion({ zahl: 9, halbtoene: 1 })).toBe('♭9');
  });
});

describe('Akkordsymbole lesen', () => {
  const faelle: [string, string, string, string][] = [
    // Eingabe, Anzeige, Töne deutsch, Funktionen
    ['C', 'C', 'C E G', '1 3 5'],
    ['Cm', 'Cm', 'C Es G', '1 ♭3 5'],
    ['C-', 'Cm', 'C Es G', '1 ♭3 5'],
    ['C7', 'C7', 'C E G B', '1 3 5 ♭7'],
    ['Cmaj7', 'Cmaj7', 'C E G H', '1 3 5 7'],
    ['CΔ', 'Cmaj7', 'C E G H', '1 3 5 7'],
    ['CΔ7', 'Cmaj7', 'C E G H', '1 3 5 7'],
    ['CM7', 'Cmaj7', 'C E G H', '1 3 5 7'],
    ['Cma7', 'Cmaj7', 'C E G H', '1 3 5 7'],
    ['Cm7', 'Cm7', 'C Es G B', '1 ♭3 5 ♭7'],
    ['C-7', 'Cm7', 'C Es G B', '1 ♭3 5 ♭7'],
    ['Cmi7', 'Cm7', 'C Es G B', '1 ♭3 5 ♭7'],
    ['Cm7b5', 'Cm7♭5', 'C Es Ges B', '1 ♭3 ♭5 ♭7'],
    ['Cm7♭5', 'Cm7♭5', 'C Es Ges B', '1 ♭3 ♭5 ♭7'],
    ['Cø', 'Cm7♭5', 'C Es Ges B', '1 ♭3 ♭5 ♭7'],
    ['Cø7', 'Cm7♭5', 'C Es Ges B', '1 ♭3 ♭5 ♭7'],
    ['Cdim', 'C°', 'C Es Ges', '1 ♭3 ♭5'],
    ['C°', 'C°', 'C Es Ges', '1 ♭3 ♭5'],
    ['Cdim7', 'C°7', 'C Es Ges A', '1 ♭3 ♭5 𝄫7'],
    ['C°7', 'C°7', 'C Es Ges A', '1 ♭3 ♭5 𝄫7'],
    ['C6', 'C6', 'C E G A', '1 3 5 6'],
    ['Cm6', 'Cm6', 'C Es G A', '1 ♭3 5 6'],
    ['C6/9', 'C6/9', 'C E G A D', '1 3 5 6 9'],
    ['C69', 'C6/9', 'C E G A D', '1 3 5 6 9'],
    ['C9', 'C9', 'C E G B D', '1 3 5 ♭7 9'],
    ['Cmaj9', 'Cmaj9', 'C E G H D', '1 3 5 7 9'],
    ['Cm9', 'Cm9', 'C Es G B D', '1 ♭3 5 ♭7 9'],
    ['C7b9', 'C7♭9', 'C E G B Des', '1 3 5 ♭7 ♭9'],
    ['C7♭9', 'C7♭9', 'C E G B Des', '1 3 5 ♭7 ♭9'],
    ['C7#9', 'C7♯9', 'C E G B Dis', '1 3 5 ♭7 ♯9'],
    ['C7♯11', 'C7♯11', 'C E G B Fis', '1 3 5 ♭7 ♯11'],
    ['C7b13', 'C7♭13', 'C E G B As', '1 3 5 ♭7 ♭13'],
    ['C7alt', '7alt', 'C E B Des Dis Fis As', '1 3 ♭7 ♭9 ♯9 ♯11 ♭13'],
    ['C13', 'C13', 'C E G B D A', '1 3 5 ♭7 9 13'],
    ['Csus4', 'Csus4', 'C F G', '1 4 5'],
    ['Csus', 'Csus4', 'C F G', '1 4 5'],
    ['C7sus4', 'C7sus4', 'C F G B', '1 4 5 ♭7'],
    ['C9sus4', 'C9sus4', 'C F G B D', '1 4 5 ♭7 9'],
    ['C11', 'C9sus4', 'C F G B D', '1 4 5 ♭7 9'],
    ['C+', 'C+', 'C E Gis', '1 3 ♯5'],
    ['Caug', 'C+', 'C E Gis', '1 3 ♯5'],
    ['C+7', 'C7♯5', 'C E Gis B', '1 3 ♯5 ♭7'],
    ['C7#5', 'C7♯5', 'C E Gis B', '1 3 ♯5 ♭7'],
    ['Cm(maj7)', 'Cm(maj7)', 'C Es G H', '1 ♭3 5 7'],
    ['C-Δ7', 'Cm(maj7)', 'C Es G H', '1 ♭3 5 7'],
    ['Cadd9', 'Cadd9', 'C E G D', '1 3 5 9'],
    ['Cm11', 'Cm11', 'C Es G B D F', '1 ♭3 5 ♭7 9 11'],
    ['C7(b9,#11)', 'C7♭9♯11', 'C E G B Des Fis', '1 3 5 ♭7 ♭9 ♯11'],
    ['C7b9b13', 'C7♭9♭13', 'C E G B Des As', '1 3 5 ♭7 ♭9 ♭13'],
    ['C13b9', 'C13♭9', 'C E G B Des A', '1 3 5 ♭7 ♭9 13'],
  ];
  for (const [ein, anzeige, toene, fkt] of faelle) {
    it(`${ein} → ${anzeige}`, () => {
      const x = a(ein);
      expect(akkordText(x).replace(/^C/, '')).toBe(anzeige.replace(/^C/, ''));
      expect(deutsch(x)).toBe(toene);
      expect(funktionen(x)).toBe(fkt);
    });
  }

  it('Grundtöne mit Vorzeichen, b/# und ♭/♯', () => {
    expect(deutsch(a('Bb7'))).toBe('B D F As');
    expect(deutsch(a('B♭7'))).toBe('B D F As');
    expect(deutsch(a('F#m7'))).toBe('Fis A Cis E');
    expect(deutsch(a('Ebmaj7'))).toBe('Es G B D');
    expect(deutsch(a('Abm'))).toBe('As Ces Es');
    expect(deutsch(a('C#7'))).toBe('Cis Eis Gis H');
    expect(deutsch(a('Gbmaj7'))).toBe('Ges B Des F');
  });
  it('B ist international (= H), H geht auch', () => {
    expect(deutsch(a('B7'))).toBe('H Dis Fis A');
    expect(deutsch(a('H7'))).toBe('H Dis Fis A');
    expect(akkordText(a('H7'))).toBe('B7');
  });
  it('Schreibweise folgt der Stufe (nicht der Taste)', () => {
    expect(deutsch(a('F#'))).toBe('Fis Ais Cis');
    expect(deutsch(a('Ebm'))).toBe('Es Ges B');
    expect(deutsch(a('Bbm7b5'))).toBe('B Des Fes As');
    expect(deutsch(a('G#°7'))).toBe('Gis H D F');
  });
  it('Doppelvorzeichen werden schlicht (wie auf Leadsheets)', () => {
    expect(deutsch(a('Ebm7b5'))).toBe('Es Ges A Des');
    expect(deutsch(a('Db7b9'))).toBe('Des F As Ces D');
  });
  it('Slash-Akkorde', () => {
    const x = a('C/E');
    expect(x.bass).toEqual(ton('E'));
    expect(akkordText(x)).toBe('C/E');
    expect(akkordText(a('Bb/D'))).toBe('B♭/D');
    expect(akkordText(a('Fmaj7/A'))).toBe('Fmaj7/A');
    expect(akkordText(a('Am7/G'), { ascii: true })).toBe('Am7/G');
    // Bass gleich Grundton: kein Slash.
    expect(a('C/C').bass).toBeNull();
  });
  it('Fehler mit Grund', () => {
    expect(akkordPruefen('')).toEqual({ fehler: 'Leer' });
    expect(akkordPruefen('X7')).toHaveProperty('fehler');
    expect(akkordPruefen('Cxyz')).toHaveProperty('fehler');
    expect(akkordPruefen('C7b10')).toHaveProperty('fehler');
    expect(akkordPruefen('Cmalt')).toHaveProperty('fehler');
    expect(akkordLesen('Q')).toBeNull();
  });
  it('ASCII-Text liest sich zurück (Speichern)', () => {
    for (const s of ['C', 'Cm', 'Bb7', 'F#m7b5', 'Ebmaj7', 'Ab13', 'Db7#11', 'G7alt', 'E7b9', 'Cdim7', 'Cdim', 'C+', 'C7#5', 'Fm6', 'Bb6/9', 'Dm(maj7)', 'C/E', 'Gsus4', 'D7sus4', 'Cadd9', 'A7#9', 'Bm11', 'E7b9b13']) {
      const x = a(s);
      const zurueck = a(akkordText(x, { ascii: true }));
      expect(zurueck.struktur, s).toEqual(x.struktur);
      expect(zurueck.grund).toEqual(x.grund);
      expect(akkordText(a(akkordText(x)))).toBe(akkordText(x));
    }
  });
  it('Schnellwahl: jede Endung ist lesbar', () => {
    for (const s of SCHNELLWAHL) expect(akkordLesen(`F${s.endung}`), s.endung).not.toBeNull();
  });
});

describe('Guide Tones', () => {
  it('Terz und Septime', () => {
    expect(guide(a('C7'))).toBe('3 ♭7');
    expect(guide(a('Cmaj7'))).toBe('3 7');
    expect(guide(a('Cm7'))).toBe('♭3 ♭7');
    expect(guide(a('Cm7b5'))).toBe('♭3 ♭7');
    expect(guide(a('Cdim7'))).toBe('♭3 𝄫7');
    expect(guide(a('C13'))).toBe('3 ♭7');
  });
  it('6-Akkorde: Terz und Sexte; sus: Quarte; Dreiklang: Terz', () => {
    expect(guide(a('C6'))).toBe('3 6');
    expect(guide(a('Cm6'))).toBe('♭3 6');
    expect(guide(a('C7sus4'))).toBe('4 ♭7');
    expect(guide(a('C'))).toBe('3');
  });
  it('ii–V–I: Guide Tones bewegen sich in kleinen Schritten', () => {
    const tg = (s: string) => guideTones(a(s)).map((t) => tonDeutsch(t.ton));
    expect(tg('Dm7')).toEqual(['F', 'C']);
    expect(tg('G7')).toEqual(['H', 'F']);
    expect(tg('Cmaj7')).toEqual(['E', 'H']);
  });
});

describe('Namen deutsch', () => {
  it('Grundarten', () => {
    expect(akkordName(a('Eb'))).toBe('Es-Dur');
    expect(akkordName(a('F#m'))).toBe('fis-Moll');
    expect(akkordName(a('Bb7'))).toBe('B-Dominantseptakkord');
    expect(akkordName(a('Cmaj7'))).toBe('C-Dur mit großer Septime');
    expect(akkordName(a('Dm7'))).toBe('d-Moll-Septakkord');
    expect(akkordName(a('Bm7b5'))).toBe('H halbvermindert');
    expect(akkordName(a('Bdim7'))).toBe('H vermindert (Septakkord)');
    expect(akkordName(a('G7alt'))).toBe('G-Dominantseptakkord, alteriert');
    expect(akkordName(a('C/E'))).toBe('C-Dur über E');
  });
  it('mit Optionen', () => {
    expect(akkordName(a('C7b9'))).toBe('C-Dominantseptakkord mit ♭9');
    expect(akkordName(a('C13'))).toBe('C-Dominantseptakkord mit 9 und 13');
    expect(akkordName(a('Cmaj9'))).toBe('C-Dur mit großer Septime und 9');
    expect(akkordName(a('C7#5'))).toBe('C-Dominantseptakkord, übermäßige Quinte');
    expect(akkordName(a('C6/9'))).toBe('C-Dur mit Sexte und None');
  });
});

describe('Leiter-Vorschläge', () => {
  const erste = (s: string) => leiterVorschlaege(a(s)).map((v) => v.leiter.id);
  it('Standardwahl je Akkord (ROADMAP I-11)', () => {
    expect(erste('C')[0]).toBe('ionisch');
    expect(erste('Cmaj7')).toEqual(['ionisch', 'lydisch', 'durPentatonik']);
    expect(erste('Dm7')[0]).toBe('dorisch');
    expect(erste('G7')[0]).toBe('mixolydisch');
    expect(erste('Bm7b5')[0]).toBe('lokrisch');
    expect(erste('Bdim7')[0]).toBe('ganztonHalbton');
    expect(erste('G7alt')[0]).toBe('alteriert');
    expect(erste('G7b9')[0]).toBe('halbtonGanzton');
    expect(erste('G7#11')[0]).toBe('lydischDominant');
    expect(erste('G7b13')[0]).toBe('mixolydischB13');
    expect(erste('G7#9')[0]).toBe('alteriert');
    expect(erste('G7b9b13')[0]).toBe('alteriert');
    expect(erste('C+')[0]).toBe('ganzton');
    expect(erste('Cm6')[0]).toBe('melodischMoll');
    expect(erste('C7sus4')[0]).toBe('mixolydisch');
    expect(erste('Cmaj7#11')[0]).toBe('lydisch');
  });
  it('jeder Vorschlag hat einen Satz warum', () => {
    for (const s of SCHNELLWAHL) for (const v of leiterVorschlaege(a(`E${s.endung}`))) expect(v.warum.length).toBeGreaterThan(10);
  });
  it('Leitern richtig geschrieben (Tonart-Schreibweise)', () => {
    expect(leiterText('ionisch', 'F#')).toBe('F♯ G♯ A♯ B C♯ D♯ E♯');
    expect(leiterText('ionisch', 'Gb')).toBe('G♭ A♭ B♭ C♭ D♭ E♭ F');
    expect(leiterText('dorisch', 'D')).toBe('D E F G A B C');
    expect(leiterText('mixolydisch', 'Bb')).toBe('B♭ C D E♭ F G A♭');
    expect(leiterText('lokrisch', 'B')).toBe('B C D E F G A');
    expect(leiterText('alteriert', 'G')).toBe('G A♭ A♯ B C♯ E♭ F');
    expect(leiterText('halbtonGanzton', 'G')).toBe('G A♭ A♯ B C♯ D E F');
    expect(leiterText('ganztonHalbton', 'C')).toBe('C D E♭ F G♭ A♭ A B');
    expect(leiterText('ganzton', 'C')).toBe('C D E F♯ G♯ B♭');
    expect(leiterText('blues', 'Bb')).toBe('B♭ D♭ E♭ E F A♭');
    expect(leiterText('mollPentatonik', 'A')).toBe('A C D E G');
    expect(leiterText('melodischMoll', 'C')).toBe('C D E♭ F G A B');
  });
  it('jede Leiter hat ihre Stufen genau einmal und aufsteigend', () => {
    for (const [id, l] of Object.entries(LEITERN)) {
      const h = l.stufen.map((s) => s.halbtoene);
      expect(h[0], id).toBe(0);
      for (let i = 1; i < h.length; i++) expect(h[i], id).toBeGreaterThan(h[i - 1]);
    }
  });
});

describe('Tonarten und Vorzeichen', () => {
  const t = (s: string) => tonartLesen(s)!;
  it('Vorzeichen zählen', () => {
    expect([t('C'), t('G'), t('F#'), t('C#'), t('F'), t('Bb'), t('Gb'), t('Cb')].map(vorzeichen)).toEqual([0, 1, 6, 7, -1, -2, -6, -7]);
    expect([t('Am'), t('Dm'), t('F#m'), t('Ebm'), t('Cm')].map(vorzeichen)).toEqual([0, -1, 3, -6, -3]);
    expect(vorzeichenText(3)).toBe('3 ♯');
    expect(vorzeichenText(-2)).toBe('2 ♭');
    expect(vorzeichenText(0)).toBe('keine Vorzeichen');
  });
  it('lesen: Leadsheet und deutsch', () => {
    expect(tonartName(t('Bb'))).toBe('B-Dur');
    expect(tonartName(t('Gm'))).toBe('g-Moll');
    expect(tonartName(t('Es-Dur'))).toBe('Es-Dur');
    expect(tonartName(t('fis-Moll'))).toBe('fis-Moll');
    expect(tonartName(t('B-Dur'))).toBe('B-Dur');
    expect(tonartName(t('H-Dur'))).toBe('H-Dur');
    expect(tonartName(t('As-Dur'))).toBe('As-Dur');
    expect(tonartSymbol(t('Es-Dur'))).toBe('E♭');
    expect(tonartSymbol(t('fis-Moll'), true)).toBe('F#m');
    expect(tonartLesen('Q-Dur')).toBeNull();
  });
  it('bequemste Schreibweise: höchstens 6 Vorzeichen', () => {
    expect(tonartName(tonartBequem(t('C#')))).toBe('Des-Dur');
    expect(tonartName(tonartBequem(t('Cb')))).toBe('H-Dur');
    expect(tonartName(tonartBequem(t('F#')))).toBe('Fis-Dur');
    expect(tonartName(tonartBequem(t('Gb')))).toBe('Ges-Dur');
    expect(tonartName(tonartBequem(t('D#m')))).toBe('dis-Moll');
    expect(tonartName(tonartBequem(t('A#m')))).toBe('b-Moll');
    expect(tonartName(tonartBequem({ grund: ton('G#'), moll: false }))).toBe('As-Dur');
  });
  it('aus Tonklasse: weniger Vorzeichen, bei 6 die Bs', () => {
    expect(tonartName(tonartAusKlasse(1, false))).toBe('Des-Dur');
    expect(tonartName(tonartAusKlasse(6, false))).toBe('Ges-Dur');
    expect(tonartName(tonartAusKlasse(8, true))).toBe('gis-Moll');
    expect(tonartName(tonartAusKlasse(3, true))).toBe('es-Moll');
    expect(tonartName(tonartAusKlasse(11, false))).toBe('H-Dur');
  });
  it('enharmonische Alternative', () => {
    expect(tonartName(tonartEnharmonisch(t('F#'))!)).toBe('Ges-Dur');
    expect(tonartName(tonartEnharmonisch(t('Db'))!)).toBe('Cis-Dur');
  });
  it('Klarinette: was liegt bequem', () => {
    expect(klarinettenSchwierigkeit(t('C')).stufe).toBe('leicht');
    expect(klarinettenSchwierigkeit(t('F')).stufe).toBe('leicht');
    expect(klarinettenSchwierigkeit(t('A')).stufe).toBe('mittel');
    expect(klarinettenSchwierigkeit(t('Ab')).stufe).toBe('mittel');
    expect(klarinettenSchwierigkeit(t('E')).unbequem).toBe(true);
    expect(klarinettenSchwierigkeit(t('Db')).unbequem).toBe(true);
    const fis = klarinettenSchwierigkeit(t('F#'));
    expect(fis.stufe).toBe('sehr schwer');
    expect(fis.hinweis).toContain('Ges-Dur');
  });
});

describe('Transponieren klingend ↔ notiert', () => {
  it('Intervalle passen zum Stimmgerät', () => {
    for (const [st, iv] of Object.entries(STIMMUNG_INTERVALL)) expect(iv.halbtoene, st).toBe(STIMMUNGEN[st as keyof typeof STIMMUNGEN]);
  });
  it('Töne', () => {
    expect(tonTransponieren(ton('Bb'), 'B', 'zuNotiert')).toEqual(ton('C'));
    expect(tonTransponieren(ton('Eb'), 'Es', 'zuNotiert')).toEqual(ton('C'));
    expect(tonTransponieren(ton('F'), 'F', 'zuNotiert')).toEqual(ton('C'));
    expect(tonTransponieren(ton('C'), 'C', 'zuNotiert')).toEqual(ton('C'));
    expect(tonTransponieren(ton('C'), A_KLARINETTE, 'zuNotiert')).toEqual(ton('Eb'));
    expect(tonTransponieren(ton('D'), 'B', 'zuKlingend')).toEqual(ton('C'));
  });
  it('Tonarten für die B-Klarinette, bequem geschrieben', () => {
    const n = (s: string) => tonartName(tonartTransponieren(tonartLesen(s)!, 'B', 'zuNotiert'));
    expect(n('Bb')).toBe('C-Dur');
    expect(n('Eb')).toBe('F-Dur');
    expect(n('F')).toBe('G-Dur');
    expect(n('E')).toBe('Fis-Dur');
    expect(n('B')).toBe('Des-Dur');
    expect(n('Gm')).toBe('a-Moll');
    expect(n('Ab')).toBe('B-Dur');
    expect(n('Db')).toBe('Es-Dur');
    expect(n('Gb')).toBe('As-Dur');
  });
  it('Tonarten für Es und F und zurück', () => {
    expect(tonartName(tonartTransponieren(tonartLesen('Bb')!, 'Es', 'zuNotiert'))).toBe('G-Dur');
    expect(tonartName(tonartTransponieren(tonartLesen('C')!, 'Es', 'zuNotiert'))).toBe('A-Dur');
    expect(tonartName(tonartTransponieren(tonartLesen('C')!, 'F', 'zuNotiert'))).toBe('G-Dur');
    expect(tonartName(tonartTransponieren(tonartLesen('G')!, 'F', 'zuKlingend'))).toBe('C-Dur');
    expect(tonartName(tonartTransponieren(tonartLesen('D')!, 'B', 'zuKlingend'))).toBe('C-Dur');
  });
  it('Akkorde behalten ihre Art', () => {
    const x = akkordTransponieren(a('Bb7b9/D'), 'B', 'zuNotiert');
    expect(akkordText(x)).toBe('C7♭9/E');
    expect(akkordText(akkordTransponieren(a('Ebm7b5'), 'B', 'zuNotiert'))).toBe('Fm7♭5');
    expect(akkordText(akkordTransponieren(a('C7alt'), 'B', 'zuNotiert'))).toBe('D7alt');
    // Doppelvorzeichen am Grundton werden schlicht.
    expect(akkordText(akkordTransponieren(a('F#'), { stufen: 1, halbtoene: 3 }, 'zuNotiert'))).toBe('A');
  });
  it('hin und zurück ergibt dasselbe', () => {
    for (const s of ['Bb7', 'F#m7', 'Ebmaj7', 'Ab13', 'C/E', 'Dbm7b5']) for (const st of ['B', 'Es', 'F', 'C'] as const) {
      const z = akkordTransponieren(akkordTransponieren(a(s), st, 'zuNotiert'), st, 'zuKlingend');
      expect(akkordText(z), `${s} ${st}`).toBe(akkordText(a(s)));
    }
  });
  it('Versetzen beliebig (Etüden)', () => {
    expect(akkordText(akkordVersetzen(a('Dm7'), { stufen: 4, halbtoene: 7 }))).toBe('Am7');
    expect(akkordText(akkordVersetzen(a('G7'), { stufen: 3, halbtoene: 5 }, -1))).toBe('D7');
  });
});

describe('Akkordfolgen', () => {
  it('ohne Taktstriche: jeder Akkord ein Takt', () => {
    const f = folgeLesen('E A B7 E');
    expect(f.takte.map((t) => t.akkorde.map((x) => akkordText(x)))).toEqual([['E'], ['A'], ['B7'], ['E']]);
    expect(f.fehler).toEqual([]);
  });
  it('mit Taktstrichen: mehrere Akkorde je Takt, % wiederholt, Zeilen trennen', () => {
    const f = folgeLesen('| Cm7 F7 | Bbmaj7 | % |\n| Am7b5 D7 ||');
    expect(f.takte.map((t) => t.akkorde.map((x) => akkordText(x)).join(' '))).toEqual(['Cm7 F7', 'B♭maj7', 'B♭maj7', 'Am7♭5 D7']);
  });
  it('Wiederholungszeichen und Klammern als Taktstriche', () => {
    expect(folgeLesen('|: C | G7 :|').takte).toHaveLength(2);
    expect(folgeLesen('[ C | G7 ]').takte).toHaveLength(2);
  });
  it('Fehler werden gesammelt, der Rest bleibt', () => {
    const f = folgeLesen('| C | Xq | G7 |');
    expect(f.takte).toHaveLength(2);
    expect(f.fehler).toHaveLength(1);
    expect(folgeLesen('% C').fehler).toHaveLength(1);
  });
  it('als Text', () => {
    expect(folgeText(folgeLesen('E A B7 E'))).toBe('| E | A | B7 | E |');
    expect(folgeText(folgeLesen('Bb Eb F7 Bb'), { ascii: true, jeZeile: 2 })).toBe('| Bb | Eb |\n| F7 | Bb |');
    expect(folgeText(folgeLesen(''))).toBe('');
  });
  it('„Gitarrist sagt E A B7 E“ → B-Klarinette', () => {
    expect(folgeTextTransponieren('E A B7 E', 'B', 'zuNotiert').text).toBe('| F♯ | B | C♯7 | F♯ |');
  });
  it('bequemste Schreibweise der ganzen Folge', () => {
    // H-Dur klingend wäre Cis-Dur notiert (7 ♯) → Des-Dur.
    expect(folgeTextTransponieren('B E F#7 B', 'B', 'zuNotiert').text).toBe('| D♭ | G♭ | A♭7 | D♭ |');
    expect(folgeTextTransponieren('| Cm7 F7 | Bbmaj7 |', 'B', 'zuNotiert').text).toBe('| Dm7 G7 | Cmaj7 |');
    expect(folgeTextTransponieren('| Cm7 F7 | Bbmaj7 |', 'Es', 'zuNotiert').text).toBe('| Am7 D7 | Gmaj7 |');
    expect(folgeText(folgeBequem(folgeLesen('C# F# G#7 C#')))).toBe('| D♭ | G♭ | A♭7 | D♭ |');
    expect(folgeText(folgeBequem(folgeLesen('F# B C#7 F#')))).toBe('| F♯ | B | C♯7 | F♯ |');
  });
  it('zurück nach klingend', () => {
    expect(folgeTextTransponieren('| Dm7 G7 | Cmaj7 |', 'B', 'zuKlingend', { ascii: true }).text).toBe('| Cm7 F7 | Bbmaj7 |');
  });
});

describe('Klänge und Notenzeile', () => {
  it('Akkord eng geschichtet, Grundton in der Lage', () => {
    expect(akkordMidi(a('C7'), 'klavier')).toEqual([48, 52, 55, 58]);
    expect(akkordMidi(a('Bb7'), 'klavier')).toEqual([58, 62, 65, 68]);
    expect(akkordMidi(a('C/E'), 'klavier')).toEqual([52, 60, 64, 67]);
    for (const s of SCHNELLWAHL) {
      const m = akkordMidi(a(`B${s.endung}`), 'klarinette');
      expect(Math.min(...m), s.endung).toBeGreaterThanOrEqual(52);
      expect(Math.max(...m), s.endung).toBeLessThanOrEqual(84);
    }
    expect(Math.max(...akkordMidi(a('Eb13'), 'klarinette'))).toBeLessThanOrEqual(84);
  });
  it('Leiter aufwärts mit Oktave', () => {
    expect(leiterMidi(leiterBauen('dorisch', ton('D')), 'klarinette')).toEqual([62, 64, 65, 67, 69, 71, 72, 74]);
  });
  it('Klänge: erst gebrochen, dann zusammen; Leiter auf und ab', () => {
    const k = akkordKlaenge(a('C'), { bpm: 120 });
    expect(k).toHaveLength(6);
    expect(k.slice(0, 3).map((x) => x.beginn)).toEqual([0, 0.25, 0.5]);
    expect(new Set(k.slice(3).map((x) => x.beginn)).size).toBe(1);
    const l = leiterKlaenge(leiterBauen('ionisch', ton('C')), { bpm: 120 });
    expect(l.map((x) => x.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60]);
    const beides = akkordUndLeiterKlaenge(a('C'), leiterBauen('ionisch', ton('C')));
    expect(beides).toHaveLength(6 + 15);
    expect(beides[6].beginn).toBeGreaterThan(beides[5].beginn);
  });
  it('ABC mit ausgeschriebenen Vorzeichen, je Takt neu', () => {
    const x = a('Bb7');
    const abc = akkordAbc(x, leiterBauen('mixolydisch', x.grund));
    expect(abc).toContain('K:C');
    expect(abc).toContain('"Bb7"[_B,DF_A]8');
    expect(abc).toContain('| _B,2 D2 F2 _A2 |');
    expect(abc).toContain('_B,CD_EFG_A_B');
  });
  it('ABC: Auflösungszeichen und Doppelvorzeichen', () => {
    expect(leiterAbc(leiterBauen('halbtonGanzton', ton('G')))).toContain('G_A^AB^cdefg');
    expect(leiterAbc(leiterBauen('ganztonHalbton', ton('C')))).toContain('CD_EF_G_A=AB');
    expect(akkordAbc(a('F#'))).toContain('[^F^A^c]8');
  });
});
