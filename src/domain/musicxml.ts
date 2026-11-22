// MusicXML lesen (G-11): Noten aus einer Erkennungs-App (PlayScore, Newzik,
// Audiveris …) oder einem Notensatz-Programm werden zu Stimmen und Takten
// fürs Notenblatt (G-01). Das Notenblatt kann weniger als MusicXML — je
// Stimme ein Ton zur Zeit, eine Taktart und Tonart fürs ganze Stück, keine
// Wiederholungen, keine Dynamik, kein Text. Was dabei wegfällt oder sich
// ändert, steht in `hinweise`, damit die Oberfläche es sagen kann.
//
// Rein und getestet: ein kleiner XML-Leser (kein DOMParser — die Tests
// laufen ohne Browser), das Entpacken von `.mxl` (ZIP, entpackt mit dem
// DecompressionStream des Browsers) und die Umwandlung.

import { TONARTEN, type Gelesen, type Note, type Schluessel, type Stimme, type Takt, type Tonart } from './notation';
import { BLATT } from './notensatz';
import { einheitenJeSchlag, istNenner, type Nenner } from './takt';

// ── XML ──

export interface XmlKnoten { name: string; attr: Record<string, string>; kinder: XmlKnoten[]; text: string }

const ENTITAETEN: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function entitaeten(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (m, e: string) => {
    if (e[0] !== '#') return ENTITAETEN[e] ?? m;
    const zahl = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(zahl) && zahl > 0 && zahl <= 0x10ffff ? String.fromCodePoint(zahl) : m;
  });
}

const NAME = /[^\s/>]+/y;
const ATTRIBUT = /\s*([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
const SCHLUSS = /\s*(\/?)>/y;

export class KeinXml extends Error {
  constructor(grund: string) { super(`Die Datei ist kein lesbares XML (${grund}).`); }
}

// Liest ein XML-Dokument und gibt das Wurzel-Element zurück. Kommentare,
// Verarbeitungsanweisungen und DOCTYPE werden überlesen; `text` ist der
// Text direkt im Element (ungetrimmt).
export function xmlLesen(quelle: string): XmlKnoten {
  const dokument: XmlKnoten = { name: '#dokument', attr: {}, kinder: [], text: '' };
  const stapel: XmlKnoten[] = [dokument];
  const n = quelle.length;
  let i = 0;
  while (i < n) {
    const lt = quelle.indexOf('<', i);
    const ende = lt < 0 ? n : lt;
    if (ende > i && stapel.length > 1) stapel[stapel.length - 1].text += entitaeten(quelle.slice(i, ende));
    if (lt < 0) break;
    if (quelle.startsWith('<!--', lt)) {
      const e = quelle.indexOf('-->', lt + 4);
      if (e < 0) throw new KeinXml('Kommentar ohne Ende');
      i = e + 3; continue;
    }
    if (quelle.startsWith('<![CDATA[', lt)) {
      const e = quelle.indexOf(']]>', lt + 9);
      if (e < 0) throw new KeinXml('CDATA ohne Ende');
      if (stapel.length > 1) stapel[stapel.length - 1].text += quelle.slice(lt + 9, e);
      i = e + 3; continue;
    }
    if (quelle.startsWith('<?', lt)) {
      const e = quelle.indexOf('?>', lt + 2);
      if (e < 0) throw new KeinXml('Anweisung ohne Ende');
      i = e + 2; continue;
    }
    if (quelle.startsWith('<!', lt)) {
      // DOCTYPE, auch mit innerer Teilmenge [ … ].
      let j = lt + 2, tiefe = 0;
      for (; j < n; j++) {
        const c = quelle[j];
        if (c === '[') tiefe++;
        else if (c === ']') tiefe--;
        else if (c === '>' && tiefe <= 0) break;
      }
      i = j + 1; continue;
    }
    if (quelle[lt + 1] === '/') {
      const e = quelle.indexOf('>', lt);
      if (e < 0) throw new KeinXml('Ende-Tag ohne >');
      const name = quelle.slice(lt + 2, e).trim();
      const oben = stapel.pop();
      if (!oben || stapel.length === 0 || oben.name !== name) throw new KeinXml(`</${name}> passt nicht`);
      i = e + 1; continue;
    }
    NAME.lastIndex = lt + 1;
    const m = NAME.exec(quelle);
    if (!m) throw new KeinXml('Tag ohne Namen');
    const knoten: XmlKnoten = { name: m[0], attr: {}, kinder: [], text: '' };
    let j = NAME.lastIndex, selbst = false;
    for (;;) {
      ATTRIBUT.lastIndex = j;
      const a = ATTRIBUT.exec(quelle);
      if (a) { knoten.attr[a[1]] = entitaeten(a[2] ?? a[3] ?? ''); j = ATTRIBUT.lastIndex; continue; }
      SCHLUSS.lastIndex = j;
      const s = SCHLUSS.exec(quelle);
      if (!s) throw new KeinXml(`<${knoten.name}> ohne Ende`);
      selbst = s[1] === '/';
      j = SCHLUSS.lastIndex;
      break;
    }
    if (stapel.length === 1 && dokument.kinder.length) throw new KeinXml('mehr als ein Wurzel-Element');
    stapel[stapel.length - 1].kinder.push(knoten);
    if (!selbst) stapel.push(knoten);
    i = j;
  }
  if (stapel.length !== 1) throw new KeinXml(`<${stapel[stapel.length - 1].name}> nicht geschlossen`);
  if (!dokument.kinder.length) throw new KeinXml('leer');
  return dokument.kinder[0];
}

const kind = (k: XmlKnoten | undefined, name: string) => k?.kinder.find((c) => c.name === name);
const alle = (k: XmlKnoten | undefined, name: string) => k?.kinder.filter((c) => c.name === name) ?? [];
const text = (k: XmlKnoten | undefined) => k?.text.trim() ?? '';
const zahl = (k: XmlKnoten | undefined): number | null => {
  const t = text(k);
  if (!t) return null;
  const z = Number(t);
  return Number.isFinite(z) ? z : null;
};

// ── Datei: .musicxml/.xml oder gepackt (.mxl) ──

// Text aus Bytes: BOM oder XML-Deklaration bestimmt die Kodierung, sonst UTF-8.
export function textDekodieren(b: Uint8Array): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  if (b[0] === 0x3c && b[1] === 0x00) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0x00 && b[1] === 0x3c) return new TextDecoder('utf-16be').decode(b);
  const kopf = String.fromCharCode(...b.subarray(0, 120));
  const kodierung = /^<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/.exec(kopf)?.[1]?.toLowerCase();
  if (kodierung && kodierung !== 'utf-8' && kodierung !== 'utf8') {
    try { return new TextDecoder(kodierung).decode(b); } catch { /* unbekannt: UTF-8 */ }
  }
  return new TextDecoder('utf-8').decode(b);
}

export interface ZipEintrag { name: string; methode: number; gepackt: number; ab: number }

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

export const istZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

// Inhaltsverzeichnis einer ZIP-Datei (zentrales Verzeichnis am Ende).
export function zipVerzeichnis(b: Uint8Array): ZipEintrag[] {
  let ende = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new Error('Die gepackte Datei (.mxl) ist beschädigt.');
  const anzahl = u16(b, ende + 10);
  let p = u32(b, ende + 16);
  const liste: ZipEintrag[] = [];
  for (let k = 0; k < anzahl; k++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw new Error('Die gepackte Datei (.mxl) ist beschädigt.');
    const methode = u16(b, p + 10), gepackt = u32(b, p + 20);
    const nameLaenge = u16(b, p + 28), extra = u16(b, p + 30), kommentar = u16(b, p + 32);
    const lokal = u32(b, p + 42);
    const name = new TextDecoder('utf-8').decode(b.subarray(p + 46, p + 46 + nameLaenge));
    if (lokal + 30 > b.length || u32(b, lokal) !== 0x04034b50) throw new Error('Die gepackte Datei (.mxl) ist beschädigt.');
    const ab = lokal + 30 + u16(b, lokal + 26) + u16(b, lokal + 28);
    liste.push({ name, methode, gepackt, ab });
    p += 46 + nameLaenge + extra + kommentar;
  }
  return liste;
}

async function entpacken(b: Uint8Array, e: ZipEintrag): Promise<Uint8Array> {
  const daten = b.slice(e.ab, e.ab + e.gepackt);
  if (e.methode === 0) return daten;
  if (e.methode !== 8) throw new Error('Die gepackte Datei (.mxl) nutzt ein unbekanntes Packverfahren.');
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

// Der MusicXML-Text einer Datei: ungepackt direkt, `.mxl` über
// META-INF/container.xml (sonst die erste .xml/.musicxml außerhalb META-INF).
export async function musicXmlText(b: Uint8Array): Promise<string> {
  if (!istZip(b)) return textDekodieren(b);
  const eintraege = zipVerzeichnis(b);
  let pfad: string | undefined;
  const container = eintraege.find((e) => e.name === 'META-INF/container.xml');
  if (container) {
    const c = xmlLesen(textDekodieren(await entpacken(b, container)));
    pfad = alle(kind(c, 'rootfiles'), 'rootfile').find((r) => !r.attr['media-type'] || /musicxml|xml$/.test(r.attr['media-type']))?.attr['full-path'];
  }
  const eintrag = eintraege.find((e) => e.name === pfad)
    ?? eintraege.find((e) => !e.name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(e.name));
  if (!eintrag) throw new Error('In der gepackten Datei (.mxl) liegen keine Noten.');
  return textDekodieren(await entpacken(b, eintrag));
}

// ── Umwandeln ──

export interface Umwandlung {
  gelesen: Gelesen;
  /** Was wegfällt oder sich ändert — für die Oberfläche, je ein Satz. */
  hinweise: string[];
}

export class KeineNoten extends Error {}

const STUFEN: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Viertel = 24 Zellen des Blatts.
const ZELLEN_JE_VIERTEL = BLATT / 4;

interface Ereignis { ab: number; bis: number; midi: number | null; bindung: boolean; bogenAuf: boolean; bogenZu: boolean }
interface Spur { teil: number; stimme: string; name: string; schluessel: Schluessel; oktave: number; takte: Map<number, Ereignis[]> }

// Schlüssel aus <clef>: Violin (G2), Bass (F4), Alt (C3), Tenor (C4). Was es
// im Notenblatt nicht gibt, wird zum nächsten (und gemeldet).
function schluesselVon(c: XmlKnoten): { art: Schluessel; genau: boolean; oktave: number } {
  const zeichen = text(kind(c, 'sign')).toUpperCase(), linie = zahl(kind(c, 'line'));
  const oktave = zahl(kind(c, 'clef-octave-change')) ?? 0;
  if (zeichen === 'G') return { art: 'violin', genau: (linie ?? 2) === 2 && oktave === 0, oktave };
  if (zeichen === 'F') return { art: 'bass', genau: (linie ?? 4) === 4 && oktave === 0, oktave };
  if (zeichen === 'C' && linie === 4) return { art: 'tenor', genau: oktave === 0, oktave };
  if (zeichen === 'C') return { art: 'alt', genau: (linie ?? 3) === 3 && oktave === 0, oktave };
  return { art: 'violin', genau: false, oktave: 0 };
}

function tonartVon(k: XmlKnoten): { tonart: Tonart | null; kreuze: number } {
  const kreuze = zahl(kind(k, 'fifths')) ?? 0;
  const moll = text(kind(k, 'mode')).toLowerCase() === 'minor';
  return { tonart: TONARTEN.find((t) => t.kreuze === kreuze && t.moll === moll) ?? null, kreuze };
}

function taktartVon(t: XmlKnoten): { zaehler: number; nenner: number; summe: boolean } | null {
  if (kind(t, 'senza-misura')) return null;
  const schlaege = alle(t, 'beats').map(text), arten = alle(t, 'beat-type').map((x) => Number(text(x)));
  if (!schlaege.length || !arten.length) return null;
  // „3+2“ oder mehrere Paare: zusammenzählen (auf den letzten Nenner).
  const nenner = arten[arten.length - 1];
  let zaehler = 0;
  schlaege.forEach((s, i) => {
    const teil = s.split('+').reduce((a, x) => a + (Number(x) || 0), 0);
    zaehler += (teil * nenner) / (arten[i] ?? nenner);
  });
  return { zaehler, nenner, summe: schlaege.length > 1 || schlaege.some((s) => s.includes('+')) };
}

const NOTENWERTE: Record<string, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125 };

// Tempo aus <sound tempo> (Viertel je Minute) oder <metronome>.
function tempoVon(richtung: XmlKnoten): number | null {
  const klang = kind(richtung, 'sound');
  const t = klang?.attr.tempo ? Number(klang.attr.tempo) : NaN;
  if (Number.isFinite(t) && t > 0) return t;
  for (const art of alle(richtung, 'direction-type')) {
    const m = kind(art, 'metronome');
    const wert = NOTENWERTE[text(kind(m, 'beat-unit'))], proMinute = zahl(kind(m, 'per-minute'));
    if (m && wert && proMinute) return proMinute * wert * (kind(m, 'beat-unit-dot') ? 1.5 : 1);
  }
  return null;
}

// Eine MusicXML-Partitur (partwise oder timewise) in Stimmen fürs Notenblatt.
// Je Teil und <voice> eine Stimme (ein Klavier mit zwei Systemen wird so zu
// zwei oder mehr Stimmen); Akkorde behalten den obersten Ton.
export function musicXmlLesen(quelle: string): Umwandlung {
  const wurzel = xmlLesen(quelle);
  const teile = teileVon(wurzel);
  const titel = text(kind(kind(wurzel, 'work'), 'work-title')) || text(kind(wurzel, 'movement-title'));
  const namen = new Map<string, string>();
  for (const sp of alle(kind(wurzel, 'part-list'), 'score-part')) namen.set(sp.attr.id ?? '', text(kind(sp, 'part-name')) || text(kind(sp, 'part-abbreviation')));

  // Was der erste Takt festlegt (Tonart, Taktart, Tempo) — als Objekt, weil
  // es in den Schleifen unten gesetzt wird.
  const kopf: { tonart: Tonart | null; kreuze: number | null; taktart: { zaehler: number; nenner: number; summe: boolean } | null; tempo: number | null } =
    { tonart: null, kreuze: null, taktart: null, tempo: null };
  const zaehlen = { akkorde: 0, vorschlaege: 0, stich: 0, wiederholungen: 0, spruenge: 0, zeichen: 0, text: 0, symbole: 0, gerundet: 0, schluesselWechsel: 0, ohneHoehe: 0 };
  const wechsel = { tonart: 0, taktart: 0 };
  const schluesselUngenau = new Set<string>();
  let oktavSchluessel = false;
  const spuren: Spur[] = [];
  // Länge jedes Takts in Zellen (größte über alle Teile).
  const laengen: number[] = [];

  teile.forEach(({ id, takte }, teilNr) => {
    let teiler = 1;
    const schluessel = new Map<number, { art: Schluessel; genau: boolean; oktave: number }>();
    const gesetzt = new Set<number>();
    const spurVon = (stimme: string, system: number): Spur => {
      let s = spuren.find((x) => x.teil === teilNr && x.stimme === stimme);
      if (!s) {
        const sl = schluessel.get(system) ?? { art: 'violin' as Schluessel, genau: true, oktave: 0 };
        s = { teil: teilNr, stimme, name: namen.get(id) ?? '', schluessel: sl.art, oktave: sl.oktave, takte: new Map() };
        spuren.push(s);
      }
      return s;
    };
    takte.forEach((takt, t) => {
      let pos = 0, weit = 0, letzterAnfang = 0;
      // Zellen aus Teilern: am Einsatz gerundet, damit sich nichts aufsummiert.
      const zelle = (x: number) => {
        const z = (x * ZELLEN_JE_VIERTEL) / teiler;
        if (Math.abs(z - Math.round(z)) > 1e-6) zaehlen.gerundet++;
        return Math.round(z);
      };
      const letzte = new Map<string, Ereignis>();
      for (const k of takt.kinder) {
        if (k.name === 'attributes') {
          teiler = zahl(kind(k, 'divisions')) ?? teiler;
          const ta = kind(k, 'key');
          if (ta && !kind(ta, 'key-step')) {
            const neu = tonartVon(ta);
            if (kopf.kreuze === null) { kopf.kreuze = neu.kreuze; kopf.tonart = neu.tonart; }
            else if (neu.kreuze !== kopf.kreuze && t > 0) wechsel.tonart++;
          }
          const zeit = kind(k, 'time');
          if (zeit) {
            const neu = taktartVon(zeit);
            const alt = kopf.taktart;
            if (!alt && neu) kopf.taktart = neu;
            else if (neu && alt && neu.zaehler * alt.nenner !== alt.zaehler * neu.nenner && t > 0) wechsel.taktart++;
          }
          for (const c of alle(k, 'clef')) {
            const nr = Number(c.attr.number ?? '1') || 1;
            const sl = schluesselVon(c);
            if (gesetzt.has(nr) && t > 0) { if (schluessel.get(nr)?.art !== sl.art) zaehlen.schluesselWechsel++; continue; }
            gesetzt.add(nr);
            schluessel.set(nr, sl);
            if (sl.oktave) oktavSchluessel = true;
            else if (!sl.genau) schluesselUngenau.add(`${text(kind(c, 'sign')) || '?'}${text(kind(c, 'line')) ? ` auf Linie ${text(kind(c, 'line'))}` : ''}`);
          }
        } else if (k.name === 'note') {
          if (kind(k, 'grace')) { zaehlen.vorschlaege++; continue; }
          const akkord = !!kind(k, 'chord');
          const dauer = zahl(kind(k, 'duration')) ?? 0;
          const stimme = text(kind(k, 'voice')) || '1';
          const system = zahl(kind(k, 'staff')) ?? 1;
          const ab = akkord ? letzterAnfang : pos;
          const abZelle = zelle(ab);
          const p = kind(k, 'pitch'), ohne = kind(k, 'unpitched');
          let midi: number | null = null;
          if (kind(k, 'cue')) zaehlen.stich++;
          else if (p) midi = (Number(text(kind(p, 'octave'))) + 1) * 12 + (STUFEN[text(kind(p, 'step')).toUpperCase()] ?? 0) + Math.round(zahl(kind(p, 'alter')) ?? 0);
          else if (ohne) { zaehlen.ohneHoehe++; midi = (Number(text(kind(ohne, 'display-octave'))) + 1) * 12 + (STUFEN[text(kind(ohne, 'display-step')).toUpperCase()] ?? 0); }
          if (midi !== null && !Number.isFinite(midi)) midi = null;
          const spur = spurVon(stimme, system);
          if (midi !== null && spur.oktave) midi -= spur.oktave * 12;
          const notationen = alle(k, 'notations');
          const boegen = notationen.flatMap((x) => alle(x, 'slur'));
          const bindung = alle(k, 'tie').some((x) => x.attr.type === 'start') || notationen.some((x) => alle(x, 'tied').some((y) => y.attr.type === 'start'));
          if (notationen.some((x) => kind(x, 'articulations') || kind(x, 'ornaments') || kind(x, 'dynamics') || kind(x, 'fermata'))) zaehlen.zeichen++;
          if (alle(k, 'lyric').length) zaehlen.text++;
          const vorher = akkord ? letzte.get(stimme) : undefined;
          if (vorher && vorher.ab === abZelle) {
            // Akkord: der oberste Ton bleibt.
            zaehlen.akkorde++;
            if (midi !== null && (vorher.midi === null || midi > vorher.midi)) { vorher.midi = midi; vorher.bindung = bindung; }
          } else {
            const e: Ereignis = {
              ab: abZelle, bis: zelle(ab + dauer), midi, bindung: midi !== null && bindung,
              bogenAuf: boegen.some((x) => x.attr.type === 'start'), bogenZu: boegen.some((x) => x.attr.type === 'stop'),
            };
            const liste = spur.takte.get(t) ?? [];
            liste.push(e);
            spur.takte.set(t, liste);
            letzte.set(stimme, e);
          }
          if (!akkord) { letzterAnfang = pos; pos += dauer; }
        } else if (k.name === 'backup') pos -= zahl(kind(k, 'duration')) ?? 0;
        else if (k.name === 'forward') pos += zahl(kind(k, 'duration')) ?? 0;
        else if (k.name === 'direction') {
          kopf.tempo ??= tempoVon(k);
          for (const art of alle(k, 'direction-type')) {
            if (kind(art, 'dynamics') || kind(art, 'wedge')) zaehlen.zeichen++;
            if (kind(art, 'segno') || kind(art, 'coda') || /\b(d\.?\s?c\.?|d\.?\s?s\.?|da capo|dal segno|fine|coda)\b/i.test(text(kind(art, 'words')))) zaehlen.spruenge++;
          }
        } else if (k.name === 'sound') {
          const tp = Number(k.attr.tempo);
          if (Number.isFinite(tp) && tp > 0) kopf.tempo ??= tp;
          if (k.attr.dacapo || k.attr.dalsegno || k.attr.tocoda || k.attr.fine) zaehlen.spruenge++;
        } else if (k.name === 'harmony') zaehlen.symbole++;
        else if (k.name === 'barline') {
          if (kind(k, 'repeat') || kind(k, 'ending')) zaehlen.wiederholungen++;
          if (kind(k, 'segno') || kind(k, 'coda')) zaehlen.spruenge++;
        }
        weit = Math.max(weit, pos);
      }
      laengen[t] = Math.max(laengen[t] ?? 0, zelle(weit));
    });
  });

  // Stimmen ohne einen einzigen Ton fallen weg.
  const klingend = spuren.filter((s) => [...s.takte.values()].some((l) => l.some((e) => e.midi !== null)));
  if (!klingend.length) throw new KeineNoten('In der Datei stehen keine Noten.');

  const hinweise: string[] = [];
  const ta = kopf.taktart;
  let zaehler = 4, nenner: Nenner = 4;
  if (ta && istNenner(ta.nenner) && Number.isInteger(ta.zaehler) && ta.zaehler >= 1 && ta.zaehler <= 16) {
    zaehler = ta.zaehler; nenner = ta.nenner;
    if (ta.summe) hinweise.push(`Zusammengesetzte Taktart als ${zaehler}/${nenner} geschrieben.`);
  } else hinweise.push(ta ? `Die Taktart ${ta.zaehler}/${ta.nenner} kennt das Notenblatt nicht — 4/4 angenommen.` : 'Keine Taktart in der Datei — 4/4 angenommen.');
  const soll = (zaehler * BLATT) / nenner;

  // Auftakt: der erste Takt ist kürzer — vorn mit Pausen auffüllen, damit
  // die Noten auf ihren Schlägen stehen; der Schlusstakt ergänzt ihn meist.
  const anzahl = laengen.length;
  const auftakt = anzahl > 1 && laengen[0] > 0 && laengen[0] < soll;
  const zielLaenge = laengen.map((l, t) => (l === 0 || (auftakt && (t === 0 || (t === anzahl - 1 && l < soll))) ? soll : l));
  const vorn = (t: number) => (auftakt && t === 0 ? soll - laengen[0] : 0);
  if (auftakt) hinweise.push('Auftakt: vorn mit Pausen auf einen ganzen Takt aufgefüllt.');
  const schief = zielLaenge.filter((l) => l !== soll).length;

  const stimmen: Stimme[] = klingend.map((s, i) => {
    const gleichesTeil = klingend.filter((x) => x.teil === s.teil);
    const nr = gleichesTeil.indexOf(s) + 1;
    const name = s.name ? (gleichesTeil.length > 1 ? `${s.name} ${nr}` : s.name) : klingend.length > 1 ? `Stimme ${i + 1}` : '';
    const takte: Takt[] = zielLaenge.map((ziel, t) => taktBauen(s.takte.get(t) ?? [], vorn(t), ziel));
    return { name, schluessel: s.schluessel, takte };
  });
  // Eine einzige Stimme im Violinschlüssel bleibt namenlos (wie geschrieben).
  if (stimmen.length === 1 && stimmen[0].schluessel === 'violin') stimmen[0] = { ...stimmen[0], name: '' };

  if (kopf.kreuze !== null && !kopf.tonart) hinweise.push(`Die Tonart mit ${Math.abs(kopf.kreuze)} ${kopf.kreuze > 0 ? 'Kreuzen' : 'Bs'} kennt das Notenblatt nicht — die Vorzeichen stehen an den Noten.`);
  if (wechsel.tonart) hinweise.push('Tonartwechsel im Stück: Die Töne stimmen, die neuen Vorzeichen stehen an den Noten.');
  if (wechsel.taktart) hinweise.push(`Taktwechsel im Stück: Das Notenblatt kennt nur eine Taktart (${zaehler}/${nenner}).`);
  if (schief) hinweise.push(`${schief} ${schief === 1 ? 'Takt passt' : 'Takte passen'} nicht zur Taktart und ${schief === 1 ? 'ist' : 'sind'} rot — dort hat die Erkennung wohl etwas verpasst.`);
  if (klingend.length < spuren.length) hinweise.push(`${spuren.length - klingend.length} leere ${spuren.length - klingend.length === 1 ? 'Stimme' : 'Stimmen'} weggelassen.`);
  if (zaehlen.akkorde) hinweise.push(`Akkorde in einer Stimme (${zaehlen.akkorde}×): nur der oberste Ton.`);
  if (zaehlen.vorschlaege) hinweise.push(`Vorschlagsnoten (${zaehlen.vorschlaege}) weggelassen.`);
  if (zaehlen.stich) hinweise.push(`Stichnoten (${zaehlen.stich}) als Pausen.`);
  if (zaehlen.wiederholungen) hinweise.push('Wiederholungszeichen und Volten fehlen — die Takte stehen einmal da.');
  if (zaehlen.spruenge) hinweise.push('Sprungzeichen (D.C., D.S., Coda, Fine) fehlen.');
  if (zaehlen.zeichen) hinweise.push('Dynamik, Artikulation und Verzierungen fallen weg.');
  if (zaehlen.text) hinweise.push('Liedtext fällt weg.');
  if (zaehlen.symbole) hinweise.push(`Akkordsymbole (${zaehlen.symbole}) fallen weg.`);
  if (zaehlen.schluesselWechsel) hinweise.push('Schlüsselwechsel im Stück: Jede Stimme behält ihren ersten Schlüssel.');
  if (oktavSchluessel) hinweise.push('Oktav-Schlüssel: Die Noten stehen um die Oktave versetzt im gewöhnlichen Schlüssel, wie sie im Original aussehen.');
  if (schluesselUngenau.size) hinweise.push(`Schlüssel ${[...schluesselUngenau].join(', ')} gibt es im Notenblatt nicht — als nächster passender geschrieben.`);
  if (zaehlen.ohneHoehe) hinweise.push('Schlagzeug-Noten auf ihrer Linie als Töne gelesen.');
  if (zaehlen.gerundet) hinweise.push(`Rhythmen an ${zaehlen.gerundet} ${zaehlen.gerundet === 1 ? 'Stelle' : 'Stellen'} gerundet.`);

  // Tempo je Schlag (wie das Metronom): Viertel je Minute auf den Schlag umrechnen.
  const proSchlag = kopf.tempo ? (kopf.tempo * nenner) / 4 / einheitenJeSchlag(zaehler, nenner) : 80;
  const bpm = Math.min(300, Math.max(20, Math.round(proSchlag)));

  return {
    gelesen: { takte: stimmen[0].takte, stimmen, raster: { bpm, zaehler, nenner, feinheit: BLATT }, tonart: kopf.tonart, titel, akkorde: [] },
    hinweise,
  };
}

// Takte eines Teils, auch aus der zeitweisen Form (score-timewise).
function teileVon(wurzel: XmlKnoten): { id: string; takte: XmlKnoten[] }[] {
  if (wurzel.name === 'score-partwise') return alle(wurzel, 'part').map((p) => ({ id: p.attr.id ?? '', takte: alle(p, 'measure') }));
  if (wurzel.name === 'score-timewise') {
    const teile = new Map<string, XmlKnoten[]>();
    for (const m of alle(wurzel, 'measure')) {
      for (const p of alle(m, 'part')) {
        const id = p.attr.id ?? '';
        if (!teile.has(id)) teile.set(id, []);
        teile.get(id)!.push({ ...p, name: 'measure', attr: { ...m.attr } });
      }
    }
    return [...teile].map(([id, takte]) => ({ id, takte }));
  }
  throw new KeineNoten('Das ist keine MusicXML-Partitur.');
}

// Ereignisse eines Takts (Einsatz/Ende in Zellen) zu Noten: Lücken werden
// Pausen, Überlappungen (in einer Stimme unmöglich, bei Erkennungsfehlern
// möglich) gekürzt; `vorn` schiebt alles nach hinten (Auftakt).
function taktBauen(ereignisse: readonly Ereignis[], vorn: number, ziel: number): Takt {
  const noten: Note[] = [];
  let pos = 0;
  const pause = (d: number) => { if (d > 0) noten.push({ midi: null, dauer: d }); };
  for (const e of [...ereignisse].sort((a, b) => a.ab - b.ab)) {
    const ab = Math.max(e.ab + vorn, pos), bis = e.bis + vorn;
    if (bis <= ab) continue;
    pause(ab - pos);
    const n: Note = { midi: e.midi, dauer: bis - ab };
    if (e.midi !== null) {
      if (e.bindung) n.bindung = true;
      if (e.bogenAuf) n.bogenAuf = true;
      if (e.bogenZu) n.bogenZu = true;
    }
    noten.push(n);
    pos = bis;
  }
  pause(ziel - pos);
  // Pausen hintereinander zusammenlegen (das Blatt legt sie neu in Werte).
  const zusammen: Note[] = [];
  for (const n of noten) {
    const v = zusammen[zusammen.length - 1];
    if (v && v.midi === null && n.midi === null) v.dauer += n.dauer;
    else zusammen.push(n);
  }
  return { noten: zusammen.length ? zusammen : [{ midi: null, dauer: ziel }] };
}
