// Skill-Kartei (I-07): der Katalog aller Musik-Skills fürs freie Spielen —
// fest im Code, erweiterbar. Je Skill: id, Name, ein Satz „was ist das“, ein
// Satz „warum fürs freie Spielen“, Voraussetzungen (ids) und, falls es eine
// gibt, die Übung in der App; sonst ein Hinweis, wo man extern übt. Die
// Regeln (Stufen, Verblassen, „Heute“) stehen in ./skills.
//
// `aufgabe` (seit 2026-11-19, für „Heute“): was in einem Block von 10 Minuten
// konkret zu tun ist — Tonhöhen notiert für die B-Klarinette (Blues in B♭
// klingend = C notiert). `werkzeug`: das Werkzeug der App, das offensichtlich
// passt; „Heute“ öffnet es voreingestellt. Fachlich nachgeschlagen:
// • Swing-Artikulation (Off-Beat anstoßen, in die Zählzeit binden):
//   jazzadvice.com, „The Beginner's Guide to Jazz Articulation“.
// • Über den Bruch (A–H binden, rechte Hand liegen lassen): DANSR,
//   „Mind the Gap: Crossing the Clarinet Break Demystified“ und
//   „Right Hand Down (or not) on Clarinet“.
// • Doppelzunge (erst ohne Mundstück sprechen, mit Metronom langsam steigern):
//   Robert Spring, „Multiple Articulation for Clarinet“ (bandworld.org).
// • Guide Tones (die Septime fällt zur Terz des nächsten Akkords):
//   learnjazzstandards.com, „How to Use Guide-Tones to Navigate Chord Changes“.
// • Chromatische Annäherung, Umspielung (Ziel auf der Zählzeit):
//   fundamental-changes.com, „Chromatic Approach Notes“;
//   jazz-guitar-licks.com, „Target Tones and Enclosures“.
// • Stufen, Modi der ii–V–I: Mark Levine, „The Jazz Theory Book“ (1995).

import type { MusterId } from './etueden';
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
import type { HoerUebungId } from './hoerquiz';
export type { HoerUebungId } from './hoerquiz';
export { HOER_UEBUNGEN } from './hoerquiz';

// Übung in der App: eine Stufe des Ohr-Trainers (I-01) oder eine Hör-Übung (I-08).
export type SkillUebung = { art: 'ohr'; stufe: StufenId } | { art: 'hoer'; id: HoerUebungId };

// Werkzeug (I-11…I-19), das zu einem Skill passt — „Heute“ und die Kartei
// öffnen es so voreingestellt: Etüden mit Muster, Licks mit einem Lick,
// Jam-Karte mit einem Stück, Spickzettel mit einem Akkord (notiert), Drone
// auf einem Grundton (Tonklasse, notiert), Griffweisen auf einem Ton
// (notiert, MIDI), Transponieren, das volle Metronom (Swing, Zunge).
export type SkillWerkzeug =
  | { art: 'etueden'; muster: MusterId }
  | { art: 'licks'; lick?: string }
  | { art: 'jam'; stueck: string }
  | { art: 'spick'; akkord: string }
  | { art: 'drone'; grundton: number }
  | { art: 'griffe'; midi: number }
  | { art: 'trans' }
  | { art: 'metronom' };

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
  // Was in einem Block von 10 Minuten zu tun ist — konkret, höchstens 150 Zeichen.
  aufgabe: string;
  // Werkzeug der App, das dazu passt (nie zugleich mit `uebung`).
  werkzeug?: SkillWerkzeug;
}

const IREAL = 'Extern üben: iReal Pro oder ein Backing-Track von YouTube.';
const MOISES = 'Extern üben: den Song in Moises laden (Stimmen stumm, langsamer, Tonart).';
const NOTEN = 'Extern üben: mit Noten oder Leadsheet, Metronom aus der App.';
const ZUNGE = 'Extern üben: erst ohne Instrument sprechen, dann auf einem Ton mit dem Metronom aus der App — langsam beginnen, das Tempo in kleinen Schritten steigern.';

export const SKILLS: readonly Skill[] = [
  // ── Gehör ──
  { id: 'melodie-drei', bereich: 'gehoer', name: 'Melodie nachspielen: drei Töne', uebung: { art: 'ohr', stufe: 'drei' }, voraussetzungen: [],
    aufgabe: 'Ohr-Trainer, Stufe „Drei Töne“: Phrase erst summen, dann ohne Suchen spielen; Fehler im nächsten Durchgang korrigieren.',
    was: 'Eine Phrase aus Grundton, 2. und 3. Stufe hören und ohne Ausprobieren nachspielen.',
    warum: 'Der erste Schritt vom Hören zum Greifen — Richtung und kleine Abstände sicher treffen.' },
  { id: 'melodie-fuenf', bereich: 'gehoer', name: 'Melodie nachspielen: fünf Töne', uebung: { art: 'ohr', stufe: 'fuenf' }, voraussetzungen: ['melodie-drei'],
    aufgabe: 'Ohr-Trainer, Stufe „Fünf Töne“: summen, den Abstand zum Grundton benennen, dann ohne Ausprobieren spielen.',
    was: 'Phrasen im Raum Grundton bis Quinte, mit Schritten und Terzen.',
    warum: 'Die meisten Liedanfänge liegen in diesen fünf Tönen.' },
  { id: 'melodie-leiter', bereich: 'gehoer', name: 'Melodie nachspielen: Dur-Tonleiter', uebung: { art: 'ohr', stufe: 'leiter' }, voraussetzungen: ['melodie-fuenf'],
    aufgabe: 'Ohr-Trainer, Stufe „Dur-Tonleiter“: vor jedem Sprung den Zielton innerlich hören, dann greifen.',
    was: 'Phrasen über die ganze Oktave mit Sprüngen bis zur Quinte.',
    warum: 'Damit lassen sich ganze Melodien heraushören, nicht nur Anfänge.' },
  { id: 'melodie-dreiklang', bereich: 'gehoer', name: 'Melodie nachspielen: Dreiklänge', uebung: { art: 'ohr', stufe: 'dreiklang' }, voraussetzungen: ['melodie-leiter'],
    aufgabe: 'Ohr-Trainer, Stufe „Dreiklänge“: Sprünge als Akkordtöne hören (1, 3, 5, 8), dann nachspielen.',
    was: 'Akkordtöne und Oktave, große Sprünge.',
    warum: 'Akkordtöne geben einer Improvisation Halt — man muss sie hören, bevor man sie spielt.' },
  { id: 'melodie-rhythmus', bereich: 'gehoer', name: 'Melodie nachspielen: mit Rhythmus', uebung: { art: 'ohr', stufe: 'rhythmus' }, voraussetzungen: ['melodie-leiter'],
    aufgabe: 'Ohr-Trainer, Stufe „Mit Rhythmus“: den Rhythmus erst mitklatschen, dann Töne und Rhythmus zusammen nachspielen.',
    was: 'Dur-Tonleiter mit Achteln — Tonhöhe und Rhythmus zugleich.',
    warum: 'Echte Melodien haben Rhythmus; im Takt bleiben zählt in der Session mehr als jeder Ton.' },
  { id: 'melodie-chromatisch', bereich: 'gehoer', name: 'Melodie nachspielen: chromatisch', uebung: { art: 'ohr', stufe: 'chromatisch' }, voraussetzungen: ['melodie-rhythmus'],
    aufgabe: 'Ohr-Trainer, Stufe „Chromatisch“: leiterfremde Töne als Halbtonschritt zum Nachbarn hören und so greifen.',
    was: 'Durchgangstöne zwischen den Leitertönen.',
    warum: 'Jazz- und Pop-Melodien leben von leiterfremden Tönen.' },
  { id: 'intervalle', bereich: 'gehoer', name: 'Intervalle hören', uebung: { art: 'hoer', id: 'intervalle' }, voraussetzungen: [],
    aufgabe: 'Hör-Übung Intervalle: eine Runde; bei jedem Fehler „so klingt deine Antwort“ vergleichen und das richtige Intervall nachsingen.',
    was: 'Sekunde bis Oktave, klein und groß — aufwärts, abwärts, zusammen.',
    warum: 'Wer den Abstand hört, greift den nächsten Ton, ohne zu suchen.' },
  { id: 'dur-moll', bereich: 'gehoer', name: 'Dur und Moll hören', uebung: { art: 'hoer', id: 'dreiklaenge' }, voraussetzungen: [],
    aufgabe: 'Hör-Übung Dreiklänge: vor dem Tippen die Terz summen — die große Terz klingt hell (Dur), die kleine dunkel (Moll).',
    was: 'Einen Dreiklang als Dur oder Moll erkennen.',
    warum: 'Das Tongeschlecht sagt, welche Terz passt — die wichtigste Entscheidung beim Mitspielen.' },
  { id: 'vermindert-uebermaessig', bereich: 'gehoer', name: 'Vermindert und übermäßig hören', uebung: { art: 'hoer', id: 'dreiklaenge' }, voraussetzungen: ['dur-moll'],
    aufgabe: 'Hör-Übung Dreiklänge, zweite Stufe: vermindert = zwei kleine Terzen (eng), übermäßig = zwei große Terzen (schwebend).',
    was: 'Die zwei spannungsreichen Dreiklänge von Dur und Moll unterscheiden.',
    warum: 'Sie kündigen Auflösungen an — wer sie hört, weiß, wohin es geht.' },
  { id: 'septakkorde', bereich: 'gehoer', name: 'Septakkorde hören', uebung: { art: 'hoer', id: 'septakkorde' }, voraussetzungen: ['dur-moll'],
    aufgabe: 'Hör-Übung Septakkorde: auf die Septime achten — maj7 weich (große Septime), 7 drängt weiter, m7 ruhig, m7♭5 düster.',
    was: 'maj7, 7, m7, m7♭5 und dim7 am Klang erkennen.',
    warum: 'Jazz-Harmonik besteht aus Septakkorden; ihr Klang zeigt die Funktion im Stück.' },
  { id: 'optionstoene', bereich: 'gehoer', name: 'Optionstöne hören (9/11/13)', voraussetzungen: ['septakkorde'],
    extern: 'Extern üben: Akkorde in iReal Pro mit Optionen abspielen und mitsingen.',
    aufgabe: 'Spickzettel: C9, dann C7♭9 und C7♯11 anhören, die Option heraussingen und auf der Klarinette suchen.',
    werkzeug: { art: 'spick', akkord: 'C9' },
    was: 'Farbtöne über dem Septakkord heraushören.',
    warum: 'Sie machen den typischen Jazz- und City-Pop-Klang aus — und sind gute Zieltöne.' },
  { id: 'akkordfolgen', bereich: 'gehoer', name: 'Akkordfolgen hören', voraussetzungen: ['dur-moll'],
    extern: 'Extern üben: I–IV–V, ii–V–I und Blues in iReal Pro hören und mitsprechen.',
    aufgabe: 'In iReal Pro einen Blues und eine ii–V–I laufen lassen; bei jedem Wechsel die Stufe mitsprechen (I, IV, V bzw. ii, V, I).',
    was: 'I–IV–V, ii–V–I und das Blues-Schema am Klang erkennen.',
    warum: 'Wer die Folge erkennt, weiß in der Session ohne Leadsheet, wo er ist.' },
  { id: 'grundton-finden', bereich: 'gehoer', name: 'Grundton eines Songs finden', voraussetzungen: ['melodie-fuenf'],
    extern: 'Extern üben: einen Song laufen lassen und den Ton suchen, auf dem alles zur Ruhe kommt.',
    aufgabe: 'Drei Songs anspielen: den Ton suchen, auf dem die Melodie zur Ruhe kommt, und ihn lange dazu halten — passt er am Schluss?',
    was: 'Den Ton finden, auf dem der Song „zu Hause“ ist.',
    warum: 'Der erste Schritt beim Mitspielen eines unbekannten Songs.' },

  // ── Harmonie ──
  { id: 'stufen-funktionen', bereich: 'harmonie', name: 'Stufen und Funktionen', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    aufgabe: 'In einer Tonart die sieben Septakkorde spielen (Imaj7, ii m7 … vii m7♭5), dann die Akkorde eines Standards als Stufen lesen.',
    was: 'Akkorde als Stufen einer Tonart lesen (I, ii, V …) und ihre Rolle kennen.',
    warum: 'In Stufen denken heißt: ein Stück in jeder Tonart spielen können.' },
  { id: 'ii-v-i-tonarten', bereich: 'harmonie', name: 'ii–V–I in allen Tonarten', voraussetzungen: ['stufen-funktionen', 'akkordaufbau'], extern: IREAL,
    aufgabe: 'Im Quintenzirkel je Tonart die ii–V–I sagen, notiert für dich (C: Dm7–G7–Cmaj7); Zeit stoppen, morgen schneller.',
    was: 'Die wichtigste Jazz-Kadenz in allen zwölf Tonarten benennen — notiert für B-Klarinette.',
    warum: 'Fast jeder Standard ist eine Kette von ii–V–Is.' },
  { id: 'akkordaufbau', bereich: 'harmonie', name: 'Akkordaufbau', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    aufgabe: 'Spickzettel: ein Akkordsymbol lesen, die Töne erst selbst nennen (1-3-5-7), dann prüfen — je Akkordart drei Grundtöne.',
    werkzeug: { art: 'spick', akkord: 'C7' },
    was: 'Vom Dreiklang zum Septakkord zu den Optionen — Töne eines Akkordsymbols nennen.',
    warum: 'Ein Akkordsymbol lesen und sofort die Zieltöne kennen.' },
  { id: 'dur-tonleitern-vorzeichen', bereich: 'harmonie', name: 'Dur-Tonleitern und Vorzeichen', voraussetzungen: [], extern: NOTEN,
    aufgabe: 'Etüden, Tonleiter im Quintenzirkel: vor jeder Tonart die Vorzeichen laut nennen, dann erst spielen.',
    werkzeug: { art: 'etueden', muster: 'tonleiter' },
    was: 'Zu jeder Tonart die Vorzeichen kennen, im Quintenzirkel denken.',
    warum: 'Das Gerüst für alles Weitere — Stufen, Akkorde, Transponieren.' },
  { id: 'pentatonik', bereich: 'harmonie', name: 'Pentatonik (Dur/Moll)', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: IREAL,
    aufgabe: 'Dur-Pentatonik (1 2 3 5 6) in drei Tonarten auf und ab; dieselben Töne ab der 6. Stufe sind die Moll-Pentatonik.',
    was: 'Die Fünfton-Leitern in Dur und Moll und ihre Verwandtschaft.',
    warum: 'Klingt fast immer passend — der schnellste Weg zum ersten Solo.' },
  { id: 'blues-tonleiter', bereich: 'harmonie', name: 'Blues-Tonleiter', voraussetzungen: ['pentatonik'], extern: IREAL,
    aufgabe: 'Blues in B♭ liegt für dich in C: Blues-Tonleiter C Es F Fis G B auf und ab, dann nur mit ihr über einen Blues spielen.',
    was: 'Moll-Pentatonik plus „Blue Note“.',
    warum: 'Der Klang des Blues — und die Leiter für den ersten Jam.' },
  { id: 'modi-ii-v-i', bereich: 'harmonie', name: 'Modi der ii–V–I', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    aufgabe: 'Spickzettel: Dm7 → Dorisch, G7 → Mixolydisch, Cmaj7 → Ionisch anhören — dieselben sieben Töne ab anderem Grundton.',
    werkzeug: { art: 'spick', akkord: 'Dm7' },
    was: 'Ionisch, Dorisch und Mixolydisch als Leitern über I, ii und V.',
    warum: 'Zeigt, welche Töne über welchen Akkord passen.' },
  { id: 'modi-weitere', bereich: 'harmonie', name: 'Weitere Modi (optional)', voraussetzungen: ['modi-ii-v-i'], extern: IREAL,
    aufgabe: 'Drone auf C, Farbe „Grundton“: je Modus eine Tonleiter, auf den Farbton achten — Lydisch ♯4, Phrygisch ♭2, Äolisch ♭6, Lokrisch ♭5.',
    werkzeug: { art: 'drone', grundton: 0 },
    was: 'Lydisch, Phrygisch, Äolisch, Lokrisch.',
    warum: 'Mehr Farben für Modal-Jazz und Filmmusik — kein Muss für den Anfang.' },
  { id: 'leadsheet-lesen', bereich: 'harmonie', name: 'Leadsheet lesen', voraussetzungen: ['akkordaufbau'], extern: NOTEN,
    aufgabe: 'Ein Leadsheet aus deiner Bibliothek: Form markieren (A, B, Wiederholungen), Akkorde je Takt laut lesen, dann die Melodie spielen.',
    was: 'Melodie plus Akkordsymbole, Form und Wiederholungen (Real-Book-Stil).',
    warum: 'Das Format jeder Jam-Session.' },

  // ── Klarinette ──
  { id: 'tonleitern-12', bereich: 'klarinette', name: 'Dur-Tonleitern in 12 Tonarten', voraussetzungen: ['dur-tonleitern-vorzeichen'], extern: NOTEN,
    aufgabe: 'Etüden, Dur-Tonleiter im Quintenzirkel: Tempo so, dass alle zwölf Tonarten fehlerfrei laufen; erst dann schneller.',
    werkzeug: { art: 'etueden', muster: 'tonleiter' },
    was: 'Alle Dur-Tonleitern auswendig über den bequemen Umfang.',
    warum: 'Die Finger müssen wissen, was das Ohr will — in jeder Tonart.' },
  { id: 'dreiklang-arpeggien', bereich: 'klarinette', name: 'Dreiklang-Arpeggien', voraussetzungen: ['tonleitern-12'], extern: NOTEN,
    aufgabe: 'Etüden, Dur-Dreiklang (danach Moll) durch den Quintenzirkel: gleichmäßig, über den Registerwechsel ohne Lücke.',
    werkzeug: { art: 'etueden', muster: 'dreiklangDur' },
    was: 'Dur- und Moll-Dreiklänge gebrochen, in allen Tonarten.',
    warum: 'Akkordtöne ohne Nachdenken greifen.' },
  { id: 'septakkord-arpeggien', bereich: 'klarinette', name: 'Septakkord-Arpeggien', voraussetzungen: ['dreiklang-arpeggien', 'akkordaufbau'], extern: NOTEN,
    aufgabe: 'Etüden, Septakkord-Arpeggien: je Tag eine Art (maj7, 7, m7, m7♭5) durch alle zwölf Tonarten.',
    werkzeug: { art: 'etueden', muster: 'maj7' },
    was: 'maj7, 7, m7 und m7♭5 gebrochen spielen.',
    warum: 'Das Material, aus dem Jazz-Linien gebaut sind.' },
  { id: 'guide-tones', bereich: 'klarinette', name: 'Guide Tones durch die ii–V–I', voraussetzungen: ['septakkord-arpeggien', 'ii-v-i-tonarten'], extern: IREAL,
    aufgabe: 'Etüden, Guide Tones ii–V–I: Terzen und Septimen im kleinsten Schritt verbinden (die Septime fällt zur Terz), den Akkord mitdenken.',
    werkzeug: { art: 'etueden', muster: 'guideTones' },
    was: 'Terzen und Septimen von Akkord zu Akkord mit kleinsten Schritten verbinden.',
    warum: 'Die einfachste Linie, die die Harmonie hörbar macht.' },
  { id: 'swing-artikulation', bereich: 'klarinette', name: 'Swing-Achtel und Artikulation', voraussetzungen: [], extern: IREAL,
    aufgabe: 'Metronom auf 2 und 4, Swing-Achtel an: Tonleiter in Achteln, Off-Beats anstoßen und in die nächste Zählzeit binden.',
    werkzeug: { art: 'metronom' },
    was: 'Ternär phrasieren, Off-Beats betonen, legato mit Akzenten.',
    warum: 'Ohne Swing-Feeling klingt auch die richtige Note falsch.' },
  { id: 'clarion-altissimo', bereich: 'klarinette', name: 'Sauberes Clarion und Altissimo', voraussetzungen: [], extern: NOTEN,
    aufgabe: 'Griffweisen ab H, dem ersten Clarion-Ton: A–H langsam binden (rechte Hand liegen lassen), dann lange Töne bis C6, Klang gleich rund.',
    werkzeug: { art: 'griffe', midi: 71 },
    was: 'Über den Registerwechsel und in die hohe Lage ohne Bruch.',
    warum: 'Soli steigen gern nach oben — die Höhe muss sicher ansprechen.' },
  { id: 'doppelzunge', bereich: 'klarinette', name: 'Doppelzunge', voraussetzungen: [], extern: ZUNGE,
    aufgabe: '„ta-ka“ erst ohne Klarinette sprechen, dann auf einem Ton: Sechzehntel ab 60 BPM, beide Silben gleich laut, langsam steigern.',
    werkzeug: { art: 'metronom' },
    was: 'Abwechselnd vorn und hinten anstoßen („ta-ka“, weicher „da-ga“), beide Silben gleich laut und gleich lang.',
    warum: 'Schnelle Tonwiederholungen und Läufe bleiben artikuliert, wenn die einfache Zunge nicht mehr mitkommt.' },
  { id: 'triolenzunge', bereich: 'klarinette', name: 'Triolenzunge', voraussetzungen: ['doppelzunge'], extern: ZUNGE,
    aufgabe: '„ta-ka-ta ta-ka-ta“ sprechen, dann auf einem Ton Achteltriolen mit dem Metronom — Betonung auf dem ersten Ton jeder Gruppe.',
    werkzeug: { art: 'metronom' },
    was: 'Dreiergruppen gleichmäßig stoßen („ta-ka-ta ta-ka-ta“ oder „ta-ta-ka“), die Betonung auf dem ersten Ton.',
    warum: 'Schnelle Triolen — in Swing-Linien, Fanfaren und Licks — klingen klar statt verschluckt.' },

  // ── Improvisation ──
  { id: 'frage-antwort', bereich: 'impro', name: 'Frage und Antwort', voraussetzungen: ['melodie-fuenf'], extern: IREAL,
    aufgabe: 'Über der Drone: zwei Takte Frage, zwei Takte Antwort — die Antwort greift Rhythmus oder Schlusston der Frage auf.',
    werkzeug: { art: 'drone', grundton: 0 },
    was: 'Eine kurze Phrase spielen und mit einer zweiten darauf antworten.',
    warum: 'Macht aus Tönen ein Gespräch — die Grundform jedes Solos.' },
  { id: 'drei-toene-impro', bereich: 'impro', name: 'Mit 3 Tönen improvisieren', voraussetzungen: [], extern: IREAL,
    aufgabe: 'Drone an, nur drei Töne (Grundton, 2., 3. Stufe): erst nur den Rhythmus verändern, nach fünf Minuten fünf Töne.',
    werkzeug: { art: 'drone', grundton: 0 },
    was: 'Über einen Backing-Track nur mit drei Tönen spielen, dann mit fünf.',
    warum: 'Weniger Töne, mehr Rhythmus und Ausdruck — nimmt die Angst vor falschen Tönen.' },
  { id: 'motiv-entwickeln', bereich: 'impro', name: 'Motiv entwickeln', voraussetzungen: ['frage-antwort'], extern: IREAL,
    aufgabe: 'Ein Motiv aus drei, vier Tönen: wiederholen, versetzen, rhythmisch verändern, umkehren — einen Chorus lang nur dieses Motiv.',
    was: 'Ein kleines Motiv wiederholen, versetzen, verändern.',
    warum: 'So entsteht ein Solo mit rotem Faden statt einer Tonfolge.' },
  { id: 'akkordtoene-zaehlzeiten', bereich: 'impro', name: 'Akkordtöne auf Zählzeiten', voraussetzungen: ['dreiklang-arpeggien'], extern: IREAL,
    aufgabe: 'Jam-Karte, Blues in B♭ (einfach): auf 1 und 3 ein Akkordton (Tipp auf den Akkord zeigt die Töne), dazwischen frei.',
    werkzeug: { art: 'jam', stueck: 'blues-b-einfach' },
    was: 'Auf 1 und 3 einen Akkordton treffen, dazwischen frei.',
    warum: 'Klingt sofort nach „die Harmonie verstanden“.' },
  { id: 'chromatische-annaeherung', bereich: 'impro', name: 'Chromatische Annäherung', voraussetzungen: ['akkordtoene-zaehlzeiten'], extern: IREAL,
    aufgabe: 'Zielton (Terz oder Grundton des nächsten Akkords) vom Halbton darunter ansteuern, später von darüber — das Ziel fällt auf die Zählzeit.',
    was: 'Einen Zielton von einem Halbton darunter oder darüber ansteuern.',
    warum: 'Der einfachste Jazz-Klang — Spannung, die sich auflöst.' },
  { id: 'enclosure', bereich: 'impro', name: 'Umspielung (Enclosure)', voraussetzungen: ['chromatische-annaeherung'], extern: IREAL,
    aufgabe: 'Etüden, Umspielung: jeden Dreiklangton von oben (Leiterton) und unten (Halbton) einkreisen; danach eigene Umspielungen.',
    werkzeug: { art: 'etueden', muster: 'umspielung' },
    was: 'Einen Zielton von oben und unten einkreisen.',
    warum: 'Typische Bebop-Figur, mit der Linien elegant auf Akkordtöne landen.' },
  { id: 'blues-phrasen', bereich: 'impro', name: 'Blues-Phrasen', voraussetzungen: ['blues-tonleiter'], extern: IREAL,
    aufgabe: 'Licks: die Blues-Wendung in drei Tonarten, dann frei in einen Blues einbauen (Jam-Karte oder iReal Pro).',
    werkzeug: { art: 'licks', lick: 'start-blues' },
    was: 'Typische Blues-Wendungen über die zwölf Takte.',
    warum: 'Der Blues ist das erste Stück jeder Session.' },
  { id: 'licks-transponieren', bereich: 'impro', name: 'Licks lernen und transponieren', voraussetzungen: ['tonleitern-12'], extern: IREAL,
    aufgabe: 'Licks: einen fälligen Lick auswendig, dann im Quintenzirkel weiter — erst singen, dann spielen; danach ehrlich einschätzen.',
    werkzeug: { art: 'licks' },
    was: 'Eine Phrase auswendig lernen und in andere Tonarten bringen.',
    warum: 'Vokabeln für die Jazz-Sprache — und Transponier-Training fürs Ohr.' },
  { id: 'pausen-phrasierung', bereich: 'impro', name: 'Pausen und Phrasierung', voraussetzungen: ['frage-antwort'], extern: IREAL,
    aufgabe: 'Über einen Backing-Track abwechselnd zwei Takte spielen, zwei Takte Pause; Phrasen bewusst auf anderen Zählzeiten beginnen.',
    was: 'Bewusst Luft lassen, Phrasen atmen lassen.',
    warum: 'Pausen geben den anderen Raum — und dem Solo Wirkung.' },
  { id: 'solo-transkribieren', bereich: 'impro', name: 'Solo heraushören (Transkribieren)', voraussetzungen: ['melodie-chromatisch'], extern: MOISES,
    aufgabe: 'In Moises vier bis acht Takte eines Solos langsamer stellen: erst mitsingen, dann Ton für Ton auf der Klarinette finden.',
    was: 'Ein aufgenommenes Solo nach Gehör nachspielen.',
    warum: 'So haben alle großen Jazzer gelernt — Ohr, Sprache und Technik zugleich.' },

  // ── Mitspielen & Begleiten ──
  { id: 'song-nach-gehoer', bereich: 'mitspielen', name: 'Song nach Gehör mitspielen', voraussetzungen: ['melodie-leiter', 'grundton-finden'], extern: MOISES,
    aufgabe: 'Bekannten Song in Moises auf 75 %: Melodie singen, Grundton finden, dann Phrase für Phrase mitspielen.',
    was: 'Die Melodie eines bekannten Songs ohne Noten mitspielen.',
    warum: 'Genau das, was mit Freunden und in der Session gefragt ist.' },
  { id: 'tonart-finden', bereich: 'mitspielen', name: 'Tonart eines Songs finden', voraussetzungen: ['grundton-finden', 'dur-moll'], extern: MOISES,
    aufgabe: 'Grundton und Dur/Moll eines Songs heraushören, dann im Transponier-Helfer umrechnen: klingend C-Dur ist für dich D-Dur.',
    werkzeug: { art: 'trans' },
    was: 'Grundton und Tongeschlecht hören und für die Klarinette umrechnen.',
    warum: 'Ohne Tonart kein Mitspielen — und sie ändert sich von Song zu Song.' },
  { id: 'haltetoene', bereich: 'mitspielen', name: 'Haltetöne als Begleitung', voraussetzungen: ['akkordfolgen'], extern: MOISES,
    aufgabe: 'Zu einem Song in Moises lange Töne aus dem jeweiligen Akkord halten (Grundton oder Terz), leise, mit dem Akkord wechseln.',
    was: 'Lange Töne aus dem Akkord unter eine Melodie legen.',
    warum: 'Begleiten statt schweigen, wenn jemand anderes die Melodie hat.' },
  { id: 'gegenstimme-fills', bereich: 'mitspielen', name: 'Gegenstimme und Fills', voraussetzungen: ['haltetoene', 'frage-antwort'], extern: MOISES,
    aufgabe: 'Zu einem Song nur in den Pausen der Gesangsmelodie kurze Antworten spielen (zwei bis vier Töne), sonst schweigen oder halten.',
    was: 'In die Lücken der Melodie kurze Antworten spielen.',
    warum: 'Macht aus Begleitung Musik — ohne der Melodie im Weg zu sein.' },

  // ── Repertoire ──
  { id: 'blues-in-b', bereich: 'repertoire', name: 'Blues in B', voraussetzungen: ['blues-tonleiter'], extern: IREAL,
    aufgabe: 'Jam-Karte, Blues in B♭: die zwölf Takte mitzählen, Grundtöne je Takt spielen, dann Thema und ein Chorus mit der Blues-Tonleiter.',
    werkzeug: { art: 'jam', stueck: 'blues-b' },
    was: 'Zwölftaktiger Blues: Thema, Form, ein Chorus Impro.',
    warum: 'Läuft in jeder Session als Erstes.' },
  { id: 'blue-bossa', bereich: 'repertoire', name: 'Blue Bossa', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    aufgabe: 'Jam-Karte, Blue Bossa: Grundtöne und Terzen je Takt durchspielen, die Moll-ii–V finden, dann das Thema.',
    werkzeug: { art: 'jam', stueck: 'blue-bossa' },
    was: 'Thema und Form des Bossa-Standards, Moll-ii–V–I.',
    warum: 'Ein Beginner-Standard mit überschaubarer Harmonik.' },
  { id: 'autumn-leaves', bereich: 'repertoire', name: 'Autumn Leaves', voraussetzungen: ['ii-v-i-tonarten'], extern: IREAL,
    aufgabe: 'Jam-Karte, Autumn Leaves: ii–V–I in Dur und Moll finden, Guide Tones durch die A-Teile, dann das Thema.',
    werkzeug: { art: 'jam', stueck: 'autumn-leaves' },
    was: 'Thema und Form, ii–V–I in Dur und Moll.',
    warum: 'Der Lehrbuch-Standard für ii–V–I.' },
  { id: 'summertime', bereich: 'repertoire', name: 'Summertime', voraussetzungen: ['pentatonik'], extern: IREAL,
    aufgabe: 'Jam-Karte, Summertime: Thema nach Gehör, dann mit der Moll-Pentatonik darüber spielen — mit Ausdruck und Pausen.',
    werkzeug: { art: 'jam', stueck: 'summertime' },
    was: 'Thema in Moll, viel Platz für Ausdruck.',
    warum: 'Kurz, bekannt, dankbar für die erste eigene Gestaltung.' },
  { id: 'lieblingssong', bereich: 'repertoire', name: 'Eigener Lieblingssong', voraussetzungen: ['song-nach-gehoer'], extern: MOISES,
    aufgabe: 'Song in Moises langsamer: Melodie Phrase für Phrase nach Gehör, schwierige Stellen loopen, am Ende einmal ganz mitspielen.',
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
