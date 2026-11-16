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
    && (s.ab === undefined || zeit(s.ab)));
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
  const neu: SkillStand = { ...alt, quoten, zuletzt: jetzt };
  if (stufe > 0) neu.stufe = stufe; else delete neu.stufe;
  const hoechste = Math.max(alt.hoechste ?? 0, stufe);
  if (hoechste > 0) neu.hoechste = hoechste;
  if (ab !== undefined) neu.ab = ab;
  return setzen(sp, id, neu);
}

// „Heute geübt“ (extern oder „Erledigt“): nur der Zeitpunkt, keine Messung.
export function geuebtEintragen(sp: SkillSpeicher, id: string, jetzt: number): SkillSpeicher {
  if (!istSkillId(id)) return sp;
  return setzen(sp, id, { ...(sp[id] ?? {}), zuletzt: jetzt });
}

export function markieren(sp: SkillSpeicher, id: string, m: Markierung): SkillSpeicher {
  if (!istSkillId(id)) return sp;
  const s: SkillStand = { ...(sp[id] ?? {}) };
  if (m === 'offen') delete s.markierung; else s.markierung = m;
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

// ── „Heute“ (I-09): drei Blöcke à 10 Minuten ──

export const BLOECKE = ['ohr', 'stueck', 'impro'] as const;
export type Block = (typeof BLOECKE)[number];
export const BLOCK_NAMEN: Record<Block, string> = { ohr: 'Ohr', stueck: 'Stück · Mitspielen', impro: 'Impro' };
export const WOCHENZIEL = 4;

const imBlock = (b: Block, s: Skill) => (b === 'ohr' ? !!s.uebung
  : b === 'stueck' ? !s.uebung && (s.bereich === 'repertoire' || s.bereich === 'mitspielen')
    : !s.uebung && s.bereich === 'impro');

// Voraussetzungen erfüllt: jede sicher oder wenigstens vertraut (wirksam ≥ 2).
export const voraussetzungenErfuellt = (s: Skill, sp: SkillSpeicher, jetzt: number) =>
  s.voraussetzungen.every((v) => istSicher(sp[v], jetzt) || wirksameStufe(sp[v], jetzt) >= 2);

// Kandidaten eines Blocks, beste zuerst. Reihenfolge:
// 1. „lerne“, 2. „will“ (je zuerst, was am längsten nicht geübt wurde),
// 3. Verblasstes (am stärksten verblasst zuerst; auch „kann“ — nur so kommt es vor),
// 4. Offenes, noch nicht Sicheres (Voraussetzungen erfüllt zuerst, dann Katalog-Reihenfolge),
// 5. Offenes, schon Sicheres (nur, wenn sonst nichts bleibt).
// Nie: „pause“; „kann“, solange nicht verblasst.
export function heuteKandidaten(b: Block, sp: SkillSpeicher, jetzt: number, verfuegbar: (s: Skill) => boolean = () => true,
  katalog: readonly Skill[] = SKILLS): Skill[] {
  const bewertet: { s: Skill; klasse: number; wert: number; i: number }[] = [];
  katalog.forEach((s, i) => {
    if (!imBlock(b, s) || !verfuegbar(s)) return;
    const st = sp[s.id];
    const m = markierungVon(st);
    const welk = verblasst(st, jetzt);
    if (m === 'pause' || (m === 'kann' && !welk)) return;
    const zuletzt = st?.zuletzt ?? 0;
    if (m === 'lerne') bewertet.push({ s, klasse: 0, wert: zuletzt, i });
    else if (m === 'will') bewertet.push({ s, klasse: 1, wert: zuletzt, i });
    else if (welk) bewertet.push({ s, klasse: 2, wert: staerke(st, jetzt), i });
    else if (!istSicher(st, jetzt)) bewertet.push({ s, klasse: 3, wert: voraussetzungenErfuellt(s, sp, jetzt) ? 0 : 1, i });
    else bewertet.push({ s, klasse: 4, wert: zuletzt, i });
  });
  return bewertet.sort((x, y) => x.klasse - y.klasse || x.wert - y.wert || x.i - y.i).map((x) => x.s);
}

// Tagesstand der Einheit (am Gerät): „Anderer Vorschlag“ je Block, Erledigtes
// (Block → Skill-id) und die Tage, an denen eine ganze Einheit geschafft wurde.
export interface HeuteStand { tag: string; wechsel: Partial<Record<Block, number>>; erledigt: Partial<Record<Block, string>>; einheiten: string[] }
const EINHEITEN_MAX = 60;
const istBlock = (k: string): k is Block => (BLOECKE as readonly string[]).includes(k);
const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/;

export const heuteLeer = (jetzt: number): HeuteStand => ({ tag: tagSchluessel(jetzt), wechsel: {}, erledigt: {}, einheiten: [] });

// Gespeicherten Stand lesen; an einem neuen Tag beginnt die Einheit frisch (die Einheiten bleiben).
export function heuteLesen(roh: unknown, jetzt: number): HeuteStand {
  const leer = heuteLeer(jetzt);
  if (!objekt(roh)) return leer;
  const einheiten = Array.isArray(roh.einheiten)
    ? [...new Set(roh.einheiten.filter((t): t is string => typeof t === 'string' && TAG_MUSTER.test(t)))].sort().slice(-EINHEITEN_MAX) : [];
  if (roh.tag !== leer.tag) return { ...leer, einheiten };
  const wechsel: HeuteStand['wechsel'] = {};
  const erledigt: HeuteStand['erledigt'] = {};
  if (objekt(roh.wechsel)) for (const [k, v] of Object.entries(roh.wechsel)) if (istBlock(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1000) wechsel[k] = v as number;
  if (objekt(roh.erledigt)) for (const [k, v] of Object.entries(roh.erledigt)) if (istBlock(k) && typeof v === 'string' && istSkillId(v)) erledigt[k] = v;
  return { tag: leer.tag, wechsel, erledigt, einheiten };
}

export interface HeuteBlock { block: Block; skill: Skill | null; erledigt: boolean; anzahl: number }

// Der Vorschlag: je Block der Kandidat an der Stelle „wechsel“ (reihum);
// ein erledigter Block zeigt den Skill, mit dem er erledigt wurde.
export function heuteVorschlag(h: HeuteStand, sp: SkillSpeicher, jetzt: number, verfuegbar?: (s: Skill) => boolean,
  katalog: readonly Skill[] = SKILLS): HeuteBlock[] {
  return BLOECKE.map((block) => {
    const kandidaten = heuteKandidaten(block, sp, jetzt, verfuegbar, katalog);
    const fertig = h.erledigt[block];
    if (fertig) return { block, skill: katalog.find((s) => s.id === fertig) ?? null, erledigt: true, anzahl: kandidaten.length };
    const skill = kandidaten.length ? kandidaten[(h.wechsel[block] ?? 0) % kandidaten.length] : null;
    return { block, skill, erledigt: false, anzahl: kandidaten.length };
  });
}

export const andererVorschlag = (h: HeuteStand, b: Block): HeuteStand => ({ ...h, wechsel: { ...h.wechsel, [b]: ((h.wechsel[b] ?? 0) + 1) % 1000 } });

// Block erledigt. Sind alle Blöcke mit Vorschlag erledigt (`noetig`), zählt der Tag als Einheit.
export function heuteErledigen(h: HeuteStand, b: Block, skillId: string, jetzt: number, noetig: readonly Block[] = BLOECKE): HeuteStand {
  const tag = tagSchluessel(jetzt);
  const basis = h.tag === tag ? h : { ...heuteLeer(jetzt), einheiten: h.einheiten };
  const erledigt = { ...basis.erledigt, [b]: skillId };
  const fertig = noetig.every((x) => erledigt[x]);
  const einheiten = fertig && !basis.einheiten.includes(tag) ? [...basis.einheiten, tag].slice(-EINHEITEN_MAX) : basis.einheiten;
  return { ...basis, erledigt, einheiten };
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
