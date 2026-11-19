// Skill-Kartei (I-07) und „Heute“ (I-09): Regeln. Rein, getestet; die Zeit
// kommt immer als Parameter (`jetzt`, ms). Der Katalog steht in ./skillkatalog.
//
// Zwei Ebenen je Skill:
// 1. Markierung, von Hand gesetzt: offen · will (☆) · lerne · kann · pause.
//    Sie gilt immer — nichts blockiert (Tonerkennung kann sich verhören).
// 2. Gemessene Stufe 0–4 aus Übungen in der App, aus Runden mit Quote 0…1.
//    Gespeichert werden nur Zusammenfassungen: die letzten 10 Quoten mit
//    Zeitpunkt, zuletzt geübt, die Stufe beim letzten Messen, die höchste je
//    erreichte Stufe und (`ab`) seit wann die Runden zählen.
//
// Verblassen: ohne Übung verliert ein Skill je Halbwertszeit seiner Stufe eine
// Stufe (Stufe 1: 4 Tage, 2: 10, 3: 21, 4: 45). Skills ohne gemessene Runden
// verblassen nicht.

import { BEREICHE, SKILLS, type BereichId, type Skill } from './skillkatalog';

export const MARKIERUNGEN = ['offen', 'will', 'lerne', 'kann', 'pause'] as const;
export type Markierung = (typeof MARKIERUNGEN)[number];
export const MARKIERUNG_NAMEN: Record<Markierung, string> = {
  offen: 'Offen', will: '☆ Will ich', lerne: 'Lerne ich', kann: 'Kann ich', pause: 'Gerade nicht',
};

export interface Quote { q: number; am: number }
export interface SkillStand {
  markierung?: Markierung;
  // Letzte Runden (höchstens QUOTEN_MAX), älteste zuerst.
  quoten?: Quote[];
  // Gemessene Stufe beim letzten Messen (vor dem Verblassen).
  stufe?: number;
  // Höchste je erreichte Stufe.
  hoechste?: number;
  // Zuletzt geübt — gemessen oder „Heute geübt“.
  zuletzt?: number;
  // Runden ab diesem Zeitpunkt zählen für die Stufe (gesetzt beim Üben nach dem Verblassen).
  ab?: number;
  // Letzte Änderung (Runde, „geübt“, Markierung): Beim Laden einer
  // Sicherung gewinnt je Skill der neuere Stand (skillsVereinigen).
  geaendert?: number;
}
export type SkillSpeicher = Record<string, SkillStand>;

export const STUFE_NAMEN = ['neu', 'kennengelernt', 'vertraut', 'sicher', 'gemeistert'] as const;
export const STUFE_MAX = 4;
export const SICHER = 3;
export const QUOTEN_MAX = 10;
// Halbwertszeit in Tagen je Stufe (Index = Stufe).
export const HALBWERTSZEIT = [0, 4, 10, 21, 45] as const;
// Schwellen für den Durchschnitt: Stufe 1, 2, 3, 4.
export const SCHWELLEN = [0.6, 0.75, 0.85, 0.9] as const;
const TAG = 86_400_000;

const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const zeit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 8.64e15;
const stufeOk = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= STUFE_MAX;
const istMarkierung = (v: unknown): v is Markierung => typeof v === 'string' && (MARKIERUNGEN as readonly string[]).includes(v);
const quoteOk = (v: unknown): v is Quote => objekt(v) && typeof v.q === 'number' && v.q >= 0 && v.q <= 1 && zeit(v.am);
// Künftige Kataloge: jede vernünftige id bleibt erhalten, nur keine, die ein Objekt verbiegen.
const VERBOTEN = new Set(['__proto__', 'constructor', 'prototype']);
export const istSkillId = (k: string) => k.length > 0 && k.length <= 80 && !VERBOTEN.has(k);
export const SKILLS_MAX = 1000;

// ── Lesen und Prüfen ──

// Ein Eintrag, nachsichtig: Unbrauchbare Felder fallen weg. null, wenn nichts bleibt.
export function skillStandLesen(v: unknown): SkillStand | null {
  if (!objekt(v)) return null;
  const s: SkillStand = {};
  if (istMarkierung(v.markierung) && v.markierung !== 'offen') s.markierung = v.markierung;
  if (Array.isArray(v.quoten)) {
    const q = v.quoten.filter(quoteOk).map((x) => ({ q: x.q, am: x.am })).sort((a, b) => a.am - b.am).slice(-QUOTEN_MAX);
    if (q.length) s.quoten = q;
  }
  if (stufeOk(v.stufe) && v.stufe > 0) s.stufe = v.stufe;
  if (stufeOk(v.hoechste) && v.hoechste > 0) s.hoechste = v.hoechste;
  if ((s.stufe ?? 0) > (s.hoechste ?? 0)) s.hoechste = s.stufe;
  if (zeit(v.zuletzt)) s.zuletzt = v.zuletzt;
  if (zeit(v.ab)) s.ab = v.ab;
  if (zeit(v.geaendert)) s.geaendert = v.geaendert;
  return Object.keys(s).length ? s : null;
}

// Der ganze Speicher (`ueben:skills`), nachsichtig. Unbekannte ids bleiben.
export function skillsLesen(roh: unknown): SkillSpeicher {
  const aus: SkillSpeicher = {};
  if (!objekt(roh)) return aus;
  let n = 0;
  for (const [k, v] of Object.entries(roh)) {
    if (n >= SKILLS_MAX) break;
    if (!istSkillId(k)) continue;
    const s = skillStandLesen(v);
    if (s) { aus[k] = s; n++; }
  }
  return aus;
}

// Streng, für die Sicherung (`einstellungen.ts`): passt alles, oder der Wert gilt nicht.
export function skillsGueltig(v: unknown): boolean {
  if (!objekt(v)) return false;
  const eintraege = Object.entries(v);
  if (eintraege.length > SKILLS_MAX) return false;
  return eintraege.every(([k, s]) => istSkillId(k) && objekt(s)
    && (s.markierung === undefined || istMarkierung(s.markierung))
    && (s.quoten === undefined || (Array.isArray(s.quoten) && s.quoten.length <= QUOTEN_MAX && s.quoten.every(quoteOk)))
    && (s.stufe === undefined || stufeOk(s.stufe))
    && (s.hoechste === undefined || stufeOk(s.hoechste))
    && (s.zuletzt === undefined || zeit(s.zuletzt))
    && (s.ab === undefined || zeit(s.ab))
    && (s.geaendert === undefined || zeit(s.geaendert)));
}

// ── Zwei Geräte ──

// Wie neu ist der Stand eines Skills? `geaendert`, bei älteren Einträgen die
// letzte Übung (zuletzt, letzte Runde).
export const skillZeit = (s: SkillStand): number => s.geaendert ?? Math.max(0, s.zuletzt ?? 0, ...(s.quoten ?? []).map((q) => q.am));

// Beim Laden einer Sicherung (A-08): je Skill gewinnt der neuere Stand als
// Ganzes, bei Gleichstand der hiesige. Skills, die nur eine Seite kennt,
// bleiben. Über SKILLS_MAX hinaus fallen die am längsten unveränderten weg.
export function skillsVereinigen(hier: SkillSpeicher, dort: SkillSpeicher): SkillSpeicher {
  const neu: SkillSpeicher = { ...hier };
  for (const [id, s] of Object.entries(dort)) {
    if (!istSkillId(id)) continue;
    const h = Object.prototype.hasOwnProperty.call(hier, id) ? hier[id] : undefined;
    if (!h || skillZeit(s) > skillZeit(h)) neu[id] = s;
  }
  const ids = Object.keys(neu);
  if (ids.length <= SKILLS_MAX) return neu;
  const bleiben = new Set(ids.sort((a, b) => skillZeit(neu[b]) - skillZeit(neu[a])).slice(0, SKILLS_MAX));
  return Object.fromEntries(Object.entries(neu).filter(([id]) => bleiben.has(id)));
}

// ── Stufen ──

const schnitt = (r: readonly Quote[]) => r.reduce((s, x) => s + x.q, 0) / r.length;
const stufeAusSchnitt = (s: number) => SCHWELLEN.reduce((st, grenze, i) => (s >= grenze ? i + 1 : st), 0);

// Kalendertag (lokal) als 'JJJJ-MM-TT'.
export function tagSchluessel(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Stufe aus den zählenden Runden (älteste zuerst):
// - 1 („kennengelernt“): schon ab einer Runde, Durchschnitt der letzten (bis zu) 5 ≥ 0,6;
// - 2 und 3: Durchschnitt der letzten 5 Runden ≥ 0,75 bzw. ≥ 0,85;
// - 4: Durchschnitt der letzten 10 ≥ 0,9 an ≥ 3 verschiedenen Tagen.
// Wiederauffrischen: Bis zur höchsten je erreichten Stufe genügen die letzten
// 3 Runden (Stufe 4 dann ohne die Tage-Regel).
export function stufeAusRunden(runden: readonly Quote[], hoechste = 0): number {
  const n = runden.length;
  if (!n) return 0;
  const s5 = schnitt(runden.slice(-5));
  let stufe = s5 >= SCHWELLEN[0] ? 1 : 0;
  if (n >= 5) stufe = Math.max(stufe, Math.min(3, stufeAusSchnitt(s5)));
  const r10 = runden.slice(-10);
  if (r10.length >= 10 && schnitt(r10) >= SCHWELLEN[3] && new Set(r10.map((r) => tagSchluessel(r.am))).size >= 3) stufe = 4;
  if (hoechste > stufe && n >= 3) stufe = Math.max(stufe, Math.min(hoechste, stufeAusSchnitt(schnitt(runden.slice(-3)))));
  return stufe;
}

const letzteRunde = (s: SkillStand) => s.quoten?.[s.quoten.length - 1]?.am;

// Wirksame Stufe: je abgelaufene Halbwertszeit (seit der letzten gemessenen Runde) eine Stufe weniger.
export function wirksameStufe(s: SkillStand | undefined, jetzt: number): number {
  const stufe = s?.stufe ?? 0;
  const am = s && letzteRunde(s);
  if (!stufe || am === undefined) return stufe;
  const tage = Math.max(0, jetzt - am) / TAG;
  return Math.max(0, stufe - Math.floor(tage / HALBWERTSZEIT[stufe]));
}

export const verblasst = (s: SkillStand | undefined, jetzt: number) => wirksameStufe(s, jetzt) < (s?.stufe ?? 0);

// Frische 0…1 (1 = gerade geübt), für die Auswahl „am stärksten verblasst“.
export function staerke(s: SkillStand | undefined, jetzt: number): number {
  const stufe = s?.stufe ?? 0;
  const am = s && letzteRunde(s);
  if (!stufe || am === undefined) return 1;
  return 2 ** (-Math.max(0, jetzt - am) / TAG / HALBWERTSZEIT[stufe]);
}

// Höchste je erreichte Stufe — angezeigt (hohl), sobald sie über der wirksamen liegt.
export const hoechsteStufe = (s: SkillStand | undefined) => Math.max(s?.hoechste ?? 0, s?.stufe ?? 0);

// Sicher: wirksame Stufe ≥ 3 oder selbst als „kann“ markiert.
export const istSicher = (s: SkillStand | undefined, jetzt: number) => s?.markierung === 'kann' || wirksameStufe(s, jetzt) >= SICHER;

export const markierungVon = (s: SkillStand | undefined): Markierung => s?.markierung ?? 'offen';

// Ganze Kalendertage seit `von` (lokal).
export function tageSeit(von: number, jetzt: number): number {
  const a = new Date(von); const b = new Date(jetzt);
  const t0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const t1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((t1 - t0) / TAG);
}

export function zuletztText(s: SkillStand | undefined, jetzt: number): string | null {
  if (!s?.zuletzt) return null;
  const t = tageSeit(s.zuletzt, jetzt);
  return t <= 0 ? 'heute geübt' : t === 1 ? 'gestern geübt' : `zuletzt vor ${t} Tagen`;
}

// ── Ändern ──

const setzen = (sp: SkillSpeicher, id: string, s: SkillStand): SkillSpeicher => {
  const neu = { ...sp };
  if (Object.keys(s).length) neu[id] = s; else delete neu[id];
  return neu;
};

// Eine Runde mit Quote q (0…1) eintragen. Nach dem Verblassen zählen nur noch
// die neuen Runden; bis drei beisammen sind, bleibt die verblasste Stufe stehen.
export function rundeEintragen(sp: SkillSpeicher, id: string, quote: number, jetzt: number): SkillSpeicher {
  if (!istSkillId(id) || !Number.isFinite(quote)) return sp;
  const alt = sp[id] ?? {};
  const q = Math.min(1, Math.max(0, quote));
  const vorher = wirksameStufe(alt, jetzt);
  const ab = vorher < (alt.stufe ?? 0) ? jetzt : alt.ab;
  const quoten = [...(alt.quoten ?? []), { q, am: jetzt }].slice(-QUOTEN_MAX);
  const zaehlen = ab === undefined ? quoten : quoten.filter((r) => r.am >= ab);
  const gemessen = stufeAusRunden(zaehlen, alt.hoechste ?? 0);
  const stufe = ab !== undefined && zaehlen.length < 3 ? Math.max(vorher, gemessen) : gemessen;
  const neu: SkillStand = { ...alt, quoten, zuletzt: jetzt, geaendert: jetzt };
  if (stufe > 0) neu.stufe = stufe; else delete neu.stufe;
  const hoechste = Math.max(alt.hoechste ?? 0, stufe);
  if (hoechste > 0) neu.hoechste = hoechste;
  if (ab !== undefined) neu.ab = ab;
  return setzen(sp, id, neu);
}

// „Heute geübt“ (extern oder „Erledigt“): nur der Zeitpunkt, keine Messung.
export function geuebtEintragen(sp: SkillSpeicher, id: string, jetzt: number): SkillSpeicher {
  if (!istSkillId(id)) return sp;
  return setzen(sp, id, { ...(sp[id] ?? {}), zuletzt: jetzt, geaendert: jetzt });
}

// Mit `jetzt` datiert (für den Abgleich zweier Geräte): Auch „offen“ bleibt
// dann als Eintrag stehen, damit eine ältere Sicherung die alte Markierung
// nicht zurückbringt.
export function markieren(sp: SkillSpeicher, id: string, m: Markierung, jetzt?: number): SkillSpeicher {
  if (!istSkillId(id)) return sp;
  const s: SkillStand = { ...(sp[id] ?? {}) };
  if (m === 'offen') delete s.markierung; else s.markierung = m;
  if (jetzt !== undefined) s.geaendert = jetzt;
  return setzen(sp, id, s);
}

// ── Übersicht und Filter ──

export interface BereichsStand { bereich: BereichId; name: string; sicher: number; gesamt: number }
export interface Uebersicht { sicher: number; gesamt: number; bereiche: BereichsStand[] }

export function uebersicht(sp: SkillSpeicher, jetzt: number, katalog: readonly Skill[] = SKILLS): Uebersicht {
  const bereiche = BEREICHE.map((b) => {
    const liste = katalog.filter((s) => s.bereich === b.id);
    return { bereich: b.id, name: b.name, gesamt: liste.length, sicher: liste.filter((s) => istSicher(sp[s.id], jetzt)).length };
  }).filter((b) => b.gesamt > 0);
  return { bereiche, gesamt: katalog.length, sicher: bereiche.reduce((n, b) => n + b.sicher, 0) };
}

export const FILTER = ['alle', 'will', 'lerne', 'kann', 'verblasst', 'pause'] as const;
export type Filter = (typeof FILTER)[number];
export const FILTER_NAMEN: Record<Filter, string> = {
  alle: 'Alle', will: '☆ Will ich', lerne: 'Lerne ich', kann: 'Kann ich', verblasst: 'Verblasst', pause: 'Gerade nicht',
};

// „Kann ich“: selbst markiert oder gemessen sicher.
export function imFilter(s: SkillStand | undefined, f: Filter, jetzt: number): boolean {
  switch (f) {
    case 'alle': return true;
    case 'kann': return istSicher(s, jetzt);
    case 'verblasst': return verblasst(s, jetzt);
    default: return markierungVon(s) === f;
  }
}

// ── „Heute“ (I-09): Blöcke aus den „Lerne ich“-Skills ──
//
// Umbau 2026-11-19 (Wunsch Marlon: „in ‚Heute‘ stecken die Skills, die ich
// als ‚Ich lerne‘ markiert habe“). Keine festen Fächer Ohr/Stück/Impro mehr.
// • Rahmen (Leitlinie I): bis zu drei Blöcke à 10 Minuten, Wochenziel 4 Einheiten.
// • Blöcke kommen aus „Lerne ich“, aus allen Bereichen — zuerst, was am
//   längsten nicht geübt wurde. Bei mehr als drei rotiert es so über die Tage:
//   Geübtes rückt nach hinten.
// • Weniger als drei „Lerne ich“: aufgefüllt mit ☆ „Will ich“ (am längsten
//   nicht geübt zuerst), dann mit Verblasstem (am stärksten zuerst, auch
//   „kann“) — der Block sagt, dass er aufgefüllt ist. Reicht auch das nicht,
//   gibt es weniger Blöcke. Nie: „Gerade nicht“, Sicheres, Unberührtes.
// • Kein „Lerne ich“: keine Blöcke (die Ansicht zeigt den Weg zur Kartei).
// • Ein Block ist erledigt, sobald sein Skill heute geübt wurde — gleich wo:
//   Runde einer Übung, „Geübt“ in einem Werkzeug, „Erledigt“ im Block.
//   Sind alle erledigt, zählt der Tag als Einheit.
// • Der Tagesplan (Skill-ids je Block) wird festgehalten, sobald er gezeigt
//   wurde: Üben verschiebt nichts. Er ändert sich nur, wenn ein Block nicht
//   mehr passt (Markierung geändert → Ersatz an derselben Stelle), wenn ein
//   neues „Lerne ich“ eine offene Auffüllung verdrängt (an ihrer Stelle) oder
//   durch „Anderer Vorschlag“ (nur dieser Block).

export const BLOECKE_MAX = 3;
export const BLOCK_MINUTEN = 10;
export const WOCHENZIEL = 4;

/** Warum ein Skill in „Heute“ steht: gerade dran, oder Auffüllung (☆ oder verblasst). */
export type HeuteArt = 'lerne' | 'will' | 'verblasst';
export const istAuffuellung = (a: HeuteArt | null | undefined) => a === 'will' || a === 'verblasst';

// Kommt der Skill in „Heute“ vor, und als was? null: nie (pausiert, sicher, unberührt).
export function heuteArt(s: SkillStand | undefined, jetzt: number): HeuteArt | null {
  const m = markierungVon(s);
  if (m === 'pause') return null;
  if (m === 'lerne' || m === 'will') return m;
  return verblasst(s, jetzt) ? 'verblasst' : null;
}

// Heute (Kalendertag) schon geübt — in „Heute“ oder anderswo.
export const heuteGeuebt = (s: SkillStand | undefined, jetzt: number) => s?.zuletzt !== undefined && tageSeit(s.zuletzt, jetzt) <= 0;

export interface HeuteKandidat { skill: Skill; art: HeuteArt }

// Alle Kandidaten, beste zuerst: „Lerne ich“, dann ☆ (je am längsten nicht
// geübt zuerst), dann Verblasstes (am stärksten zuerst); bei Gleichstand
// die Reihenfolge des Katalogs.
export function heuteKandidaten(sp: SkillSpeicher, jetzt: number, verfuegbar: (s: Skill) => boolean = () => true,
  katalog: readonly Skill[] = SKILLS): HeuteKandidat[] {
  const KLASSE: Record<HeuteArt, number> = { lerne: 0, will: 1, verblasst: 2 };
  const bewertet: { k: HeuteKandidat; klasse: number; wert: number; i: number }[] = [];
  katalog.forEach((skill, i) => {
    if (!verfuegbar(skill)) return;
    const st = sp[skill.id];
    const art = heuteArt(st, jetzt);
    if (!art) return;
    bewertet.push({ k: { skill, art }, klasse: KLASSE[art], wert: art === 'verblasst' ? staerke(st, jetzt) : (st?.zuletzt ?? 0), i });
  });
  return bewertet.sort((x, y) => x.klasse - y.klasse || x.wert - y.wert || x.i - y.i).map((x) => x.k);
}

// Tagesstand (am Gerät, `ueben:heute`): der Plan des Tages (Skill-ids je
// Block, höchstens drei) und die Tage, an denen eine ganze Einheit geschafft wurde.
export interface HeuteStand { tag: string; plan: string[]; einheiten: string[] }
const EINHEITEN_MAX = 60;
const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
// Blöcke des Stands bis 2026-11-19, in ihrer Reihenfolge.
const ALTE_BLOECKE = ['ohr', 'stueck', 'impro'] as const;

export const heuteLeer = (jetzt: number): HeuteStand => ({ tag: tagSchluessel(jetzt), plan: [], einheiten: [] });

// Gespeicherten Stand lesen, nachsichtig. An einem neuen Tag beginnt der Plan
// frisch (die Einheiten bleiben). Ein Stand der alten Form (Blöcke
// ohr/stueck/impro mit `wechsel` und `erledigt`) vom selben Tag: Was dort
// erledigt war, wird zu den ersten Blöcken des Plans — sein Skill ist heute
// geübt, also gilt der Block als erledigt. Die Vorschlags-Wechsel entfallen.
export function heuteLesen(roh: unknown, jetzt: number): HeuteStand {
  const leer = heuteLeer(jetzt);
  if (!objekt(roh)) return leer;
  const einheiten = Array.isArray(roh.einheiten)
    ? [...new Set(roh.einheiten.filter((t): t is string => typeof t === 'string' && TAG_MUSTER.test(t)))].sort().slice(-EINHEITEN_MAX) : [];
  if (roh.tag !== leer.tag) return { ...leer, einheiten };
  const alt = objekt(roh.erledigt) ? roh.erledigt : null;
  const roheIds: unknown[] = Array.isArray(roh.plan) ? roh.plan : alt ? ALTE_BLOECKE.map((b) => alt[b]) : [];
  const plan = [...new Set(roheIds.filter((v): v is string => typeof v === 'string' && istSkillId(v)))].slice(0, BLOECKE_MAX);
  return { tag: leer.tag, plan, einheiten };
}

export interface HeuteBlock {
  skill: Skill;
  // null: weder „Lerne ich“ noch Auffüllung — nur ein heute schon erledigter Block.
  art: HeuteArt | null;
  erledigt: boolean;
  // „Anderer Vorschlag“ möglich: „Lerne ich“ gegen „Lerne ich“, Auffüllung gegen Auffüllung.
  tauschbar: boolean;
}
export interface HeuteVorschlag { bloecke: HeuteBlock[]; plan: string[]; lerne: number; fertig: boolean }

// Wogegen sich der Block an Stelle i tauschen lässt, in Kandidaten-Reihenfolge
// (er selbst eingeschlossen): gleiche Gruppe, nicht in einem anderen Block,
// heute noch nicht geübt.
function tauschKreis(plan: readonly string[], i: number, kandidaten: readonly HeuteKandidat[], sp: SkillSpeicher, jetzt: number): string[] {
  const eigene = kandidaten.find((k) => k.skill.id === plan[i])?.art;
  if (!eigene) return [];
  return kandidaten
    .filter((k) => istAuffuellung(k.art) === istAuffuellung(eigene)
      && (k.skill.id === plan[i] || (!plan.includes(k.skill.id) && !heuteGeuebt(sp[k.skill.id], jetzt))))
    .map((k) => k.skill.id);
}

// Der Vorschlag für heute — aus dem festgehaltenen Plan (`h.plan`, wenn er von
// heute ist), ergänzt und geprüft nach den Regeln oben. Rein; festgehalten
// wird er mit `heuteFestschreiben`.
export function heuteVorschlag(h: HeuteStand, sp: SkillSpeicher, jetzt: number, verfuegbar?: (s: Skill) => boolean,
  katalog: readonly Skill[] = SKILLS): HeuteVorschlag {
  const kandidaten = heuteKandidaten(sp, jetzt, verfuegbar, katalog);
  const art = new Map(kandidaten.map((k) => [k.skill.id, k.art]));
  const lerne = kandidaten.filter((k) => k.art === 'lerne').length;
  const finden = (id: string) => katalog.find((s) => s.id === id);
  const geuebt = (id: string) => heuteGeuebt(sp[id], jetzt);
  const alt = h.tag === tagSchluessel(jetzt) ? h.plan.slice(0, BLOECKE_MAX) : [];

  // 1. Behalten: Erledigtes immer, sonst was noch Kandidat ist; der Rest wird eine Lücke.
  const gerade: (string | null)[] = alt.map((id) => (finden(id) && (geuebt(id) || art.has(id)) ? id : null));
  let plan: string[];
  if (!lerne) {
    // Kein „Lerne ich“: nur heute schon Erledigtes bleibt stehen, nichts wird aufgefüllt.
    plan = gerade.filter((id): id is string => id !== null && geuebt(id));
  } else {
    const naechster = (passt: (k: HeuteKandidat) => boolean = () => true) =>
      kandidaten.find((k) => !gerade.includes(k.skill.id) && passt(k))?.skill.id ?? null;
    // 2. Lücken an derselben Stelle füllen.
    gerade.forEach((id, i) => { if (id === null) gerade[i] = naechster(); });
    // 3. Ein fehlendes „Lerne ich“ verdrängt eine offene Auffüllung, an ihrer Stelle.
    gerade.forEach((id, i) => {
      if (id === null || geuebt(id) || !istAuffuellung(art.get(id))) return;
      const l = naechster((k) => k.art === 'lerne');
      if (l) gerade[i] = l;
    });
    // 4. Bis zu drei Blöcke auffüllen.
    while (gerade.length < BLOECKE_MAX) {
      const n = naechster();
      if (!n) break;
      gerade.push(n);
    }
    plan = gerade.filter((id): id is string => id !== null);
  }

  const bloecke: HeuteBlock[] = plan.map((id, i) => {
    const erledigt = geuebt(id);
    return { skill: finden(id)!, art: art.get(id) ?? null, erledigt, tauschbar: !erledigt && tauschKreis(plan, i, kandidaten, sp, jetzt).length > 1 };
  });
  return { bloecke, plan, lerne, fertig: lerne > 0 && bloecke.length > 0 && bloecke.every((b) => b.erledigt) };
}

const gleicheListe = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// Den gezeigten Vorschlag festhalten: Plan des Tages, und ist alles erledigt,
// der Tag als Einheit. Unverändert → derselbe Stand (nichts zu speichern).
export function heuteFestschreiben(h: HeuteStand, v: HeuteVorschlag, jetzt: number): HeuteStand {
  const tag = tagSchluessel(jetzt);
  const einheiten = v.fertig && !h.einheiten.includes(tag) ? [...h.einheiten, tag].sort().slice(-EINHEITEN_MAX) : h.einheiten;
  if (h.tag === tag && gleicheListe(h.plan, v.plan) && einheiten === h.einheiten) return h;
  return { tag, plan: [...v.plan], einheiten };
}

// „Anderer Vorschlag“ für den Block an Stelle i: der nächste Kandidat seiner
// Gruppe („Lerne ich“ bzw. Auffüllung), der in keinem anderen Block steht und
// heute noch nicht geübt ist — reihum. Die anderen Blöcke bleiben, wie sie sind.
export function andererVorschlag(h: HeuteStand, i: number, sp: SkillSpeicher, jetzt: number, verfuegbar?: (s: Skill) => boolean,
  katalog: readonly Skill[] = SKILLS): HeuteStand {
  const v = heuteVorschlag(h, sp, jetzt, verfuegbar, katalog);
  const basis = heuteFestschreiben(h, v, jetzt);
  if (!v.bloecke[i]?.tauschbar) return basis;
  const kreis = tauschKreis(v.plan, i, heuteKandidaten(sp, jetzt, verfuegbar, katalog), sp, jetzt);
  const plan = [...v.plan];
  plan[i] = kreis[(kreis.indexOf(plan[i]) + 1) % kreis.length];
  return { ...basis, plan };
}

// Montag (lokal) der Woche von `jetzt`.
function wochenAnfang(jetzt: number): string {
  const d = new Date(jetzt);
  const wochentag = (d.getDay() + 6) % 7; // Montag = 0
  return tagSchluessel(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wochentag, 12).getTime());
}

// Einheiten dieser Woche (Montag bis heute).
export function wocheEinheiten(h: HeuteStand, jetzt: number): number {
  const von = wochenAnfang(jetzt);
  const bis = tagSchluessel(jetzt);
  return h.einheiten.filter((t) => t >= von && t <= bis).length;
}
