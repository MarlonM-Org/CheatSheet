// Skill-Kartei (I-07): der Katalog aller Musik-Skills fürs freie Spielen —
// fest im Code, erweiterbar. Je Skill: id, Name, ein Satz „was ist das“, ein
// Satz „warum fürs freie Spielen“, Voraussetzungen (ids) und, falls es eine
// gibt, die Übung in der App; sonst ein Hinweis, wo man extern übt. Die
// Regeln (Stufen, Verblassen, „Heute“) stehen in ./skills.

import type { StufenId } from './gehoer';

export type BereichId = 'gehoer' | 'harmonie' | 'klarinette' | 'impro' | 'mitspielen' | 'repertoire';
export interface Bereich { id: BereichId; name: string }

export const BEREICHE: readonly Bereich[] = [
  { id: 'gehoer', name: 'Gehör' },
  { id: 'harmonie', name: 'Harmonie' },
  { id: 'klarinette', name: 'Klarinette' },
  { id: 'impro', name: 'Improvisation' },
  { id: 'mitspielen', name: 'Mitspielen & Begleiten' },
  { id: 'repertoire', name: 'Repertoire' },
];

// Hör-Übungen per Antippen (I-08) — ids wie in @/domain/hoerquiz.
export type HoerUebungId = 'intervalle' | 'dreiklaenge' | 'septakkorde';
export const HOER_UEBUNGEN: readonly HoerUebungId[] = ['intervalle', 'dreiklaenge', 'septakkorde'];

// Übung in der App: eine Stufe des Ohr-Trainers (I-01) oder eine Hör-Übung (I-08).
export type SkillUebung = { art: 'ohr'; stufe: StufenId } | { art: 'hoer'; id: HoerUebungId };

export interface Skill {
  id: string;
  bereich: BereichId;
  name: string;
  was: string;
  warum: string;
  voraussetzungen: readonly string[];
  uebung?: SkillUebung;
  // Ohne Übung in der App: womit man extern übt.
  extern?: string;
}

const IREAL = 'Extern üben: iReal Pro oder ein Backing-Track von YouTube.';
const MOISES = 'Extern üben: den Song in Moises laden (Stimmen stumm, langsamer, Tonart).';
const NOTEN = 'Extern üben: mit Noten oder Leadsheet, Metronom aus der App.';

export const SKILLS: readonly Skill[] = [
  // ── Gehör ──
  { id: 'melodie-drei', bereich: 'gehoer', name: 'Melodie nachspielen: drei Töne', uebung: { art: 'ohr', stufe: 'drei' }, voraussetzungen: [],
    was: 'Eine Phrase aus Grundton, 2. und 3. Stufe hören und ohne Ausprobieren nachspielen.',
    warum: 'Der erste Schritt vom Hören zum Greifen — Richtung und kleine Abstände sicher treffen.' },
  { id: 'melodie-fuenf', bereich: 'gehoer', name: 'Melodie nachspielen: fünf Töne', uebung: { art: 'ohr', stufe: 'fuenf' }, voraussetzungen: ['melodie-drei'],
    was: 'Phrasen im Raum Grundton bis Quinte, mit Schritten und Terzen.',
    warum: 'Die meisten Liedanfänge liegen in diesen fünf Tönen.' },
  { id: 'melodie-leiter', bereich: 'gehoer', name: 'Melodie nachspielen: Dur-Tonleiter', uebung: { art: 'ohr', stufe: 'leiter' }, voraussetzungen: ['melodie-fuenf'],
    was: 'Phrasen über die ganze Oktave mit Sprüngen bis zur Quinte.',
    warum: 'Damit lassen sich ganze Melodien heraushören, nicht nur Anfänge.' },
  { id: 'melodie-dreiklang', bereich: 'gehoer', name: 'Melodie nachspielen: Dreiklänge', uebung: { art: 'ohr', stufe: 'dreiklang' }, voraussetzungen: ['melodie-leiter'],
    was: 'Akkordtöne und Oktave, große Sprünge.',
    warum: 'Akkordtöne geben einer Improvisation Halt — man muss sie hören, bevor man sie spielt.' },
  { id: 'melodie-rhythmus', bereich: 'gehoer', name: 'Melodie nachspielen: mit Rhythmus', uebung: { art: 'ohr', stufe: 'rhythmus' }, voraussetzungen: ['melodie-leiter'],
    was: 'Dur-Tonleiter mit Achteln — Tonhöhe und Rhythmus zugleich.',
    warum: 'Echte Melodien haben Rhythmus; im Takt bleiben zählt in der Session mehr als jeder Ton.' },
  { id: 'melodie-chromatisch', bereich: 'gehoer', name: 'Melodie nachspielen: chromatisch', uebung: { art: 'ohr', stufe: 'chromatisch' }, voraussetzungen: ['melodie-rhythmus'],
    was: 'Durchgangstöne zwischen den Leitertönen.',
    warum: 'Jazz- und Pop-Melodien leben von leiterfremden Tönen.' },
  { id: 'intervalle', bereich: 'gehoer', name: 'Intervalle hören', uebung: { art: 'hoer', id: 'intervalle' }, voraussetzungen: [],
    was: 'Sekunde bis Oktave, klein und groß — aufwärts, abwärts, zusammen.',
    warum: 'Wer den Abstand hört, greift den nächsten Ton, ohne zu suchen.' },
  { id: 'dur-moll', bereich: 'gehoer', name: 'Dur und Moll hören', uebung: { art: 'hoer', id: 'dreiklaenge' }, voraussetzungen: [],
    was: 'Einen Dreiklang als Dur oder Moll erkennen.',
    warum: 'Das Tongeschlecht sagt, welche Terz passt — die wichtigste Entscheidung beim Mitspielen.' },
  { id: 'vermindert-uebermaessig', bereich: 'gehoer', name: 'Vermindert und übermäßig hören', uebung: { art: 'hoer', id: 'dreiklaenge' }, voraussetzungen: ['dur-moll'],
    was: 'Die zwei spannungsreichen Dreiklänge von Dur und Moll unterscheiden.',
    warum: 'Sie kündigen Auflösungen an — wer sie hört, weiß, wohin es geht.' },
  { id: 'septakkorde', bereich: 'gehoer', name: 'Septakkorde hören', uebung: { art: 'hoer', id: 'septakkorde' }, voraussetzungen: ['dur-moll'],
    was: 'maj7, 7, m7, m7♭5 und dim7 am Klang erkennen.',
    warum: 'Jazz-Harmonik besteht aus Septakkorden; ihr Klang zeigt die Funktion im Stück.' },
  { id: 'optionstoene', bereich: 'gehoer', name: 'Optionstöne hören (9/11/13)', voraussetzungen: ['septakkorde'],
    extern: 'Extern üben: Akkorde in iReal Pro mit Optionen abspielen und mitsingen.',
    was: 'Farbtöne über dem Septakkord heraushören.',
    warum: 'Sie machen den typischen Jazz- und City-Pop-Klang aus — und sind gute Zieltöne.' },
  { id: 'akkordfolgen', bereich: 'gehoer', name: 'Akkordfolgen hören', voraussetzungen: ['dur-moll'],
    extern: 'Extern üben: I–IV–V, ii–V–I und Blues in iReal Pro hören und mitsprechen.',
    was: 'I–IV–V, ii–V–I und das Blues-Schema am Klang erkennen.',
    warum: 'Wer die Folge erkennt, weiß in der Session ohne Leadsheet, wo er ist.' },
  { id: 'grundton-finden', bereich: 'gehoer', name: 'Grundton eines Songs finden', voraussetzungen: ['melodie-fuenf'],
    extern: 'Extern üben: einen Song laufen lassen und den Ton suchen, auf dem alles zur Ruhe kommt.',
    was: 'Den Ton finden, auf dem der Song „zu Hause“ ist.',
    warum: 'Der erste Schritt beim Mitspielen eines unbekannten Songs.' },

  // ── Harmonie ──
  { id: 'stufen-funktionen', bereich: 'harmonie', name: 'Stufen und Funktionen', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    was: 'Akkorde als Stufen einer Tonart lesen (I, ii, V …) und ihre Rolle kennen.',
    warum: 'In Stufen denken heißt: ein Stück in jeder Tonart spielen können.' },
  { id: 'ii-v-i-tonarten', bereich: 'harmonie', name: 'ii–V–I in allen Tonarten', voraussetzungen: ['stufen-funktionen', 'akkordaufbau'], extern: IREAL,
    was: 'Die wichtigste Jazz-Kadenz in allen zwölf Tonarten benennen — notiert für B-Klarinette.',
    warum: 'Fast jeder Standard ist eine Kette von ii–V–Is.' },
  { id: 'akkordaufbau', bereich: 'harmonie', name: 'Akkordaufbau', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    was: 'Vom Dreiklang zum Septakkord zu den Optionen — Töne eines Akkordsymbols nennen.',
    warum: 'Ein Akkordsymbol lesen und sofort die Zieltöne kennen.' },
  { id: 'dur-tonleitern-vorzeichen', bereich: 'harmonie', name: 'Dur-Tonleitern und Vorzeichen', voraussetzungen: [], extern: NOTEN,
    was: 'Zu jeder Tonart die Vorzeichen kennen, im Quintenzirkel denken.',
    warum: 'Das Gerüst für alles Weitere — Stufen, Akkorde, Transponieren.' },
  { id: 'pentatonik', bereich: 'harmonie', name: 'Pentatonik (Dur/Moll)', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: IREAL,
    was: 'Die Fünfton-Leitern in Dur und Moll und ihre Verwandtschaft.',
    warum: 'Klingt fast immer passend — der schnellste Weg zum ersten Solo.' },
  { id: 'blues-tonleiter', bereich: 'harmonie', name: 'Blues-Tonleiter', voraussetzungen: ['pentatonik'], extern: IREAL,
    was: 'Moll-Pentatonik plus „Blue Note“.',
    warum: 'Der Klang des Blues — und die Leiter für den ersten Jam.' },
  { id: 'modi-ii-v-i', bereich: 'harmonie', name: 'Modi der ii–V–I', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    was: 'Ionisch, Dorisch und Mixolydisch als Leitern über I, ii und V.',
    warum: 'Zeigt, welche Töne über welchen Akkord passen.' },
  { id: 'modi-weitere', bereich: 'harmonie', name: 'Weitere Modi (optional)', voraussetzungen: ['modi-ii-v-i'], extern: IREAL,
    was: 'Lydisch, Phrygisch, Äolisch, Lokrisch.',
    warum: 'Mehr Farben für Modal-Jazz und Filmmusik — kein Muss für den Anfang.' },
  { id: 'leadsheet-lesen', bereich: 'harmonie', name: 'Leadsheet lesen', voraussetzungen: ['akkordaufbau'], extern: NOTEN,
    was: 'Melodie plus Akkordsymbole, Form und Wiederholungen (Real-Book-Stil).',
    warum: 'Das Format jeder Jam-Session.' },

  // ── Klarinette ──
  { id: 'tonleitern-12', bereich: 'klarinette', name: 'Dur-Tonleitern in 12 Tonarten', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    was: 'Alle Dur-Tonleitern auswendig über den bequemen Umfang.',
    warum: 'Die Finger müssen wissen, was das Ohr will — in jeder Tonart.' },
  { id: 'dreiklang-arpeggien', bereich: 'klarinette', name: 'Dreiklang-Arpeggien', voraussetzungen: ['tonleitern-12'], extern: NOTEN,
    was: 'Dur- und Moll-Dreiklänge gebrochen, in allen Tonarten.',
    warum: 'Akkordtöne ohne Nachdenken greifen.' },
  { id: 'septakkord-arpeggien', bereich: 'klarinette', name: 'Septakkord-Arpeggien', voraussetzungen: ['dreiklang-arpeggien', 'akkordaufbau'], extern: NOTEN,
    was: 'maj7, 7, m7 und m7♭5 gebrochen spielen.',
    warum: 'Das Material, aus dem Jazz-Linien gebaut sind.' },
  { id: 'guide-tones', bereich: 'klarinette', name: 'Guide Tones durch die ii–V–I', voraussetzungen: ['septakkord-arpeggien', 'ii-v-i-tonarten'], extern: IREAL,
    was: 'Terzen und Septimen von Akkord zu Akkord mit kleinsten Schritten verbinden.',
    warum: 'Die einfachste Linie, die die Harmonie hörbar macht.' },
  { id: 'swing-artikulation', bereich: 'klarinette', name: 'Swing-Achtel und Artikulation', voraussetzungen: [], extern: IREAL,
    was: 'Ternär phrasieren, Off-Beats betonen, legato mit Akzenten.',
    warum: 'Ohne Swing-Feeling klingt auch die richtige Note falsch.' },
  { id: 'clarion-altissimo', bereich: 'klarinette', name: 'Sauberes Clarion und Altissimo', voraussetzungen: [], extern: NOTEN,
    was: 'Über den Registerwechsel und in die hohe Lage ohne Bruch.',
    warum: 'Soli steigen gern nach oben — die Höhe muss sicher ansprechen.' },

  // ── Improvisation ──
  { id: 'frage-antwort', bereich: 'impro', name: 'Frage und Antwort', voraussetzungen: ['melodie-fuenf'], extern: IREAL,
    was: 'Eine kurze Phrase spielen und mit einer zweiten darauf antworten.',
    warum: 'Macht aus Tönen ein Gespräch — die Grundform jedes Solos.' },
  { id: 'drei-toene-impro', bereich: 'impro', name: 'Mit 3 Tönen improvisieren', voraussetzungen: [], extern: IREAL,
    was: 'Über einen Backing-Track nur mit drei Tönen spielen, dann mit fünf.',
    warum: 'Weniger Töne, mehr Rhythmus und Ausdruck — nimmt die Angst vor falschen Tönen.' },
  { id: 'motiv-entwickeln', bereich: 'impro', name: 'Motiv entwickeln', voraussetzungen: ['frage-antwort'], extern: IREAL,
    was: 'Ein kleines Motiv wiederholen, versetzen, verändern.',
    warum: 'So entsteht ein Solo mit rotem Faden statt einer Tonfolge.' },
  { id: 'akkordtoene-zaehlzeiten', bereich: 'impro', name: 'Akkordtöne auf Zählzeiten', voraussetzungen: ['dreiklang-arpeggien'], extern: IREAL,
    was: 'Auf 1 und 3 einen Akkordton treffen, dazwischen frei.',
    warum: 'Klingt sofort nach „die Harmonie verstanden“.' },
  { id: 'chromatische-annaeherung', bereich: 'impro', name: 'Chromatische Annäherung', voraussetzungen: ['akkordtoene-zaehlzeiten'], extern: IREAL,
    was: 'Einen Zielton von einem Halbton darunter oder darüber ansteuern.',
    warum: 'Der einfachste Jazz-Klang — Spannung, die sich auflöst.' },
  { id: 'enclosure', bereich: 'impro', name: 'Umspielung (Enclosure)', voraussetzungen: ['chromatische-annaeherung'], extern: IREAL,
    was: 'Einen Zielton von oben und unten einkreisen.',
    warum: 'Typische Bebop-Figur, mit der Linien elegant auf Akkordtöne landen.' },
  { id: 'blues-phrasen', bereich: 'impro', name: 'Blues-Phrasen', voraussetzungen: ['blues-tonleiter'], extern: IREAL,
    was: 'Typische Blues-Wendungen über die zwölf Takte.',
    warum: 'Der Blues ist das erste Stück jeder Session.' },
  { id: 'licks-transponieren', bereich: 'impro', name: 'Licks lernen und transponieren', voraussetzungen: ['tonleitern-12'], extern: IREAL,
    was: 'Eine Phrase auswendig lernen und in andere Tonarten bringen.',
    warum: 'Vokabeln für die Jazz-Sprache — und Transponier-Training fürs Ohr.' },
  { id: 'pausen-phrasierung', bereich: 'impro', name: 'Pausen und Phrasierung', voraussetzungen: ['frage-antwort'], extern: IREAL,
    was: 'Bewusst Luft lassen, Phrasen atmen lassen.',
    warum: 'Pausen geben den anderen Raum — und dem Solo Wirkung.' },
  { id: 'solo-transkribieren', bereich: 'impro', name: 'Solo heraushören (Transkribieren)', voraussetzungen: ['melodie-chromatisch'], extern: MOISES,
    was: 'Ein aufgenommenes Solo nach Gehör nachspielen.',
    warum: 'So haben alle großen Jazzer gelernt — Ohr, Sprache und Technik zugleich.' },

  // ── Mitspielen & Begleiten ──
  { id: 'song-nach-gehoer', bereich: 'mitspielen', name: 'Song nach Gehör mitspielen', voraussetzungen: ['melodie-leiter', 'grundton-finden'], extern: MOISES,
    was: 'Die Melodie eines bekannten Songs ohne Noten mitspielen.',
    warum: 'Genau das, was mit Freunden und in der Session gefragt ist.' },
  { id: 'tonart-finden', bereich: 'mitspielen', name: 'Tonart eines Songs finden', voraussetzungen: ['grundton-finden', 'dur-moll'], extern: MOISES,
    was: 'Grundton und Tongeschlecht hören und für die Klarinette umrechnen.',
    warum: 'Ohne Tonart kein Mitspielen — und sie ändert sich von Song zu Song.' },
  { id: 'haltetoene', bereich: 'mitspielen', name: 'Haltetöne als Begleitung', voraussetzungen: ['akkordfolgen'], extern: MOISES,
    was: 'Lange Töne aus dem Akkord unter eine Melodie legen.',
    warum: 'Begleiten statt schweigen, wenn jemand anderes die Melodie hat.' },
  { id: 'gegenstimme-fills', bereich: 'mitspielen', name: 'Gegenstimme und Fills', voraussetzungen: ['haltetoene', 'frage-antwort'], extern: MOISES,
    was: 'In die Lücken der Melodie kurze Antworten spielen.',
    warum: 'Macht aus Begleitung Musik — ohne der Melodie im Weg zu sein.' },

  // ── Repertoire ──
  { id: 'blues-in-b', bereich: 'repertoire', name: 'Blues in B', voraussetzungen: ['blues-tonleiter'], extern: IREAL,
    was: 'Zwölftaktiger Blues: Thema, Form, ein Chorus Impro.',
    warum: 'Läuft in jeder Session als Erstes.' },
  { id: 'blue-bossa', bereich: 'repertoire', name: 'Blue Bossa', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    was: 'Thema und Form des Bossa-Standards, Moll-ii–V–I.',
    warum: 'Ein Beginner-Standard mit überschaubarer Harmonik.' },
  { id: 'autumn-leaves', bereich: 'repertoire', name: 'Autumn Leaves', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    was: 'Thema und Form, ii–V–I in Dur und Moll.',
    warum: 'Der Lehrbuch-Standard für ii–V–I.' },
  { id: 'summertime', bereich: 'repertoire', name: 'Summertime', voraussetzungen: ['pentatonik'], extern: IREAL,
    was: 'Thema in Moll, viel Platz für Ausdruck.',
    warum: 'Kurz, bekannt, dankbar für die erste eigene Gestaltung.' },
  { id: 'lieblingssong', bereich: 'repertoire', name: 'Eigener Lieblingssong', voraussetzungen: ['song-nach-gehoer'], extern: MOISES,
    was: 'Ein Song, den du liebst — z. B. Ashe „Stop The Wedding!“ oder City Pop.',
    warum: 'Motivation: das Stück, für das man das alles lernt.' },
];

const NACH_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const skillFinden = (id: string): Skill | undefined => NACH_ID.get(id);
export const bereichFinden = (id: BereichId): Bereich => BEREICHE.find((b) => b.id === id) ?? BEREICHE[0];

// Ohr-Trainer-Stufe → Skill.
export const skillFuerOhrStufe = (stufe: StufenId): string => `melodie-${stufe}`;

// Hör-Übung (I-08) → Skill, an den das Ergebnis einer Runde geht.
const HOER_SKILL: Record<HoerUebungId, string> = { intervalle: 'intervalle', dreiklaenge: 'dur-moll', septakkorde: 'septakkorde' };
export const skillFuerHoerUebung = (id: HoerUebungId): string => HOER_SKILL[id];
