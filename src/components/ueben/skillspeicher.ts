'use client';

import { geuebtEintragen, heuteLesen, markieren, rundeEintragen, skillsLesen, type HeuteStand, type Markierung, type SkillSpeicher } from '@/domain/skills';
import { gespeichert, speichern } from './klang';

// Skill-Kartei (I-07) auf dem Gerät: `ueben:skills` reist mit der Sicherung
// (@/domain/einstellungen), `ueben:heute` (Tagesstand der Einheit, I-09)
// bleibt am Gerät. Jede Änderung meldet SKILLS_GEAENDERT am window, damit
// offene Ansichten neu lesen.

export { skillFuerHoerUebung, skillFuerOhrStufe } from '@/domain/skillkatalog';

export const SKILLS_SCHLUESSEL = 'ueben:skills';
export const HEUTE_SCHLUESSEL = 'ueben:heute';
export const SKILLS_GEAENDERT = 'ueben:skills-geaendert';

export const skillsLaden = (): SkillSpeicher => skillsLesen(gespeichert<unknown>(SKILLS_SCHLUESSEL, {}));

function aendern(f: (sp: SkillSpeicher) => SkillSpeicher): SkillSpeicher {
  const neu = f(skillsLaden());
  speichern(SKILLS_SCHLUESSEL, neu);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SKILLS_GEAENDERT));
  return neu;
}

// Ergebnis einer Runde einer Übung in der App (Quote 0…1) an den Skill melden.
export const skillErgebnis = (skillId: string, quote: number, jetzt = Date.now()) => aendern((sp) => rundeEintragen(sp, skillId, quote, jetzt));
// „Heute geübt“ ohne Messung (extern geübt, „Erledigt“).
export const skillGeuebt = (skillId: string, jetzt = Date.now()) => aendern((sp) => geuebtEintragen(sp, skillId, jetzt));
export const skillMarkieren = (skillId: string, m: Markierung) => aendern((sp) => markieren(sp, skillId, m));

export const heuteLaden = (jetzt = Date.now()): HeuteStand => heuteLesen(gespeichert<unknown>(HEUTE_SCHLUESSEL, null), jetzt);
export const heuteSpeichern = (h: HeuteStand) => speichern(HEUTE_SCHLUESSEL, h);
