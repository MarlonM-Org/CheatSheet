// Notensatz (G-01) und Vorspielen (G-04) auf den Takten aus ./notation: eine
// Stimme, Noten mit Dauer in Zellen (1/feinheit). Bearbeitet wird wie in
// MuseScore — eine Note antippen, Tonhöhe verschieben, Notenwert setzen,
// Pause, Bogen, Takte anhängen und löschen — und was dabei herauskommt, wird
// immer wieder in erlaubte Notenwerte zerlegt (zerlegen), damit abcjs es
// zeichnen kann. Rein, getestet.
//
// Innere Sicht: eine **Strecke** ist ein Ton (oder eine Pause) von seinem
// Einsatz bis zum nächsten — gebundene Noten im Takt sind eine Strecke; ein
// Bogen über den Taktstrich bleibt als `bindung` an der letzten Strecke des
// Takts. Die Oberfläche sieht die gezeichneten Noten (Note k im Takt t);
// jede Änderung trifft die Strecke, zu der die Note gehört.

import { leiter, notenwerte, zellenDauer, zellenJeTakt, zerlegen, type Note, type Raster, type Takt, type Tonart } from './notation';
import { istZusammengesetzt } from './takt';

// Lage einer gezeichneten Note: Takt t, darin Note k (Pausen zählen mit).
export interface NotenPos { takt: number; note: number }

export const TON_MIN = 24, TON_MAX = 108; // C1 … C8

interface Strecke { midi: number | null; dauer: number; bindung?: true }

// Gebundene gleiche Noten eines Takts zu Strecken; `bindung` bleibt nur an
// der letzten Strecke (Bogen in den nächsten Takt).
export function strecken(t: Takt): Strecke[] {
  const liste: Strecke[] = [];
  let offen = false;
  for (const n of t.noten) {
    const s = liste[liste.length - 1];
    if (offen && s && s.midi !== null && s.midi === n.midi) s.dauer += n.dauer;
    else liste.push({ midi: n.midi, dauer: n.dauer });
    offen = !!n.bindung && n.midi !== null;
  }
  if (offen && liste.length) liste[liste.length - 1].bindung = true;
  return liste;
}

// Strecken → Noten in erlaubten Werten, gebunden. Pausen ohne Punktierung —
// außer in zusammengesetzten Taktarten (6/8: der Schlag ist punktiert).
export function legen(liste: readonly Strecke[], r: Raster): Takt {
  const noten: Note[] = [];
  let ab = 0;
  const zusammengesetzt = istZusammengesetzt(r.zaehler, r.nenner);
  for (const s of liste) {
    const teile = zerlegen(ab, s.dauer, r, s.midi !== null || zusammengesetzt);
    teile.forEach((dauer, i) => {
      const letzter = i === teile.length - 1;
      const bindung = s.midi !== null && (!letzter || s.bindung);
      noten.push(bindung ? { midi: s.midi, dauer, bindung: true } : { midi: s.midi, dauer });
    });
    ab += s.dauer;
  }
  return { noten };
}

export const leererTakt = (r: Raster): Takt => legen([{ midi: null, dauer: zellenJeTakt(r) }], r);

// Index der Strecke zur Note k — über die schon zerlegten Noten des Takts.
function streckeDerNote(t: Takt, note: number): { strecke: number; erste: boolean } {
  let strecke = -1, offen = false, erste = true;
  for (let k = 0; k < t.noten.length && k <= note; k++) {
    const n = t.noten[k];
    const prev = t.noten[k - 1];
    const angebunden = offen && prev && prev.midi !== null && prev.midi === n.midi;
    if (!angebunden) { strecke++; erste = true; } else erste = false;
    offen = !!n.bindung && n.midi !== null;
  }
  return { strecke: Math.max(0, strecke), erste };
}

// Erste gezeichnete Note einer Strecke im (schon gelegten) Takt.
function ersteNote(t: Takt, strecke: number): number {
  let s = -1, offen = false;
  for (let k = 0; k < t.noten.length; k++) {
    const n = t.noten[k], prev = t.noten[k - 1];
    const angebunden = offen && prev && prev.midi !== null && prev.midi === n.midi;
    if (!angebunden) { s++; if (s === strecke) return k; }
    offen = !!n.bindung && n.midi !== null;
  }
  return Math.max(0, t.noten.length - 1);
}

const ersetzen = (takte: readonly Takt[], i: number, neu: Takt): Takt[] => takte.map((t, k) => (k === i ? neu : t));

// ── Tonhöhe ──

// Diatonischer Schritt: zum nächsten Leiterton (ohne Tonart: C-Dur), wie
// Ziehen einer Note im Notenbild; ein Ton außerhalb der Leiter landet beim
// ersten Schritt auf dem nächsten Leiterton in dieser Richtung.
export function leiterSchritt(midi: number, schritte: number, tonart: Tonart | null | undefined): number {
  const stufen = leiter(tonart) ?? new Set([0, 2, 4, 5, 7, 9, 11]);
  let m = midi;
  const richtung = Math.sign(schritte);
  for (let i = 0; i < Math.abs(schritte); i++) {
    do m += richtung; while (!stufen.has(((m % 12) + 12) % 12));
  }
  return m;
}

// Die Strecken, die mit Strecke `s` in Takt `i` über Bögen zusammenhängen
// (davor und danach), als [takt, strecke].
function kette(takte: readonly Takt[], i: number, s: number): [number, number][] {
  const alle = takte.map(strecken);
  const liste: [number, number][] = [[i, s]];
  let t = i, k = s;
  while (k === 0 && t > 0) {
    const vor = alle[t - 1], l = vor[vor.length - 1];
    if (!l?.bindung || l.midi !== alle[t][0]?.midi) break;
    t--; k = vor.length - 1; liste.unshift([t, k]);
  }
  t = i; k = s;
  while (t + 1 < takte.length && k === alle[t].length - 1 && alle[t][k]?.bindung) {
    const nach = alle[t + 1];
    if (!nach.length || nach[0].midi !== alle[t][k].midi) break;
    t++; k = 0; liste.push([t, k]);
  }
  return liste;
}

function tonAendern(takte: readonly Takt[], r: Raster, pos: NotenPos, neu: (midi: number) => number): Takt[] {
  const t = takte[pos.takt];
  if (!t) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const alt = strecken(t)[strecke]?.midi;
  if (alt === null || alt === undefined) return [...takte];
  const ziel = neu(alt);
  if (ziel < TON_MIN || ziel > TON_MAX || ziel === alt) return [...takte];
  let ergebnis = [...takte];
  for (const [ti, si] of kette(takte, pos.takt, strecke)) {
    const liste = strecken(ergebnis[ti]);
    liste[si] = { ...liste[si], midi: ziel };
    ergebnis = ersetzen(ergebnis, ti, legen(liste, r));
  }
  return ergebnis;
}

// Halbtonschritte (auch Oktaven: ±12); gebundene Noten wandern mit.
export const verschieben = (takte: readonly Takt[], r: Raster, pos: NotenPos, halbtoene: number) =>
  tonAendern(takte, r, pos, (m) => m + halbtoene);
// Leiterschritte (Ziehen im Notenbild).
export const leiterVerschieben = (takte: readonly Takt[], r: Raster, pos: NotenPos, schritte: number, tonart: Tonart | null | undefined) =>
  tonAendern(takte, r, pos, (m) => leiterSchritt(m, schritte, tonart));

// Tonhöhe setzen oder Pause (null). Eine Pause löst Bögen zu ihr hin und
// von ihr weg; eine neue Höhe wandert über Bögen mit.
export function tonSetzen(takte: readonly Takt[], r: Raster, pos: NotenPos, midi: number | null): Takt[] {
  const t = takte[pos.takt];
  if (!t) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s) return [...takte];
  if (midi !== null && s.midi !== null) return tonAendern(takte, r, pos, () => midi);
  if (midi !== null) { liste[strecke] = { midi, dauer: s.dauer }; return ersetzen(takte, pos.takt, legen(liste, r)); }
  liste[strecke] = { midi: null, dauer: s.dauer };
  const ergebnis = ersetzen(takte, pos.takt, legen(liste, r));
  return strecke === 0 && pos.takt > 0 ? bogenLoesen(ergebnis, r, pos.takt - 1) : ergebnis;
}

function bogenLoesen(takte: readonly Takt[], r: Raster, i: number): Takt[] {
  const liste = strecken(takte[i]);
  if (!liste.length || !liste[liste.length - 1].bindung) return [...takte];
  const { bindung: _weg, ...rest } = liste[liste.length - 1]; void _weg;
  liste[liste.length - 1] = rest;
  return ersetzen(takte, i, legen(liste, r));
}

// ── Notenwert ──

// Wie in MuseScore: Der neue Wert gilt ab dem Einsatz der Note; wird sie
// kürzer, füllt eine Pause auf, wird sie länger, frisst sie die folgenden
// Noten des Takts (eine angeschnittene behält ihren Rest). Über den
// Taktstrich geht nichts — der Wert wird am Taktende gekappt.
export function dauerSetzen(takte: readonly Takt[], r: Raster, pos: NotenPos, dauer: number): Takt[] {
  const t = takte[pos.takt];
  if (!t || dauer < 1) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s) return [...takte];
  const ab = liste.slice(0, strecke).reduce((a, x) => a + x.dauer, 0);
  const jt = zellenJeTakt(r);
  const neu = Math.min(dauer, jt - ab);
  if (neu === s.dauer) return [...takte];
  const vorher = liste.slice(0, strecke);
  const nachher: Strecke[] = [];
  if (neu < s.dauer) {
    nachher.push({ midi: s.midi, dauer: neu }, { midi: null, dauer: s.dauer - neu }, ...liste.slice(strecke + 1));
  } else {
    let frei = neu - s.dauer;
    nachher.push({ midi: s.midi, dauer: neu });
    for (const x of liste.slice(strecke + 1)) {
      if (frei >= x.dauer) { frei -= x.dauer; continue; }
      if (frei > 0) { nachher.push({ ...x, dauer: x.dauer - frei }); frei = 0; } else nachher.push(x);
    }
  }
  // Ein Bogen in den nächsten Takt hing an der letzten Strecke: er bleibt
  // nur, wenn die letzte Strecke weiterhin eine Note derselben Höhe ist.
  const alteLetzte = liste[liste.length - 1];
  const neu2 = [...vorher, ...nachher].map(({ bindung: _b, ...x }) => { void _b; return x as Strecke; });
  const letzte = neu2[neu2.length - 1];
  if (alteLetzte.bindung && letzte.midi !== null && letzte.midi === alteLetzte.midi) neu2[neu2.length - 1] = { ...letzte, bindung: true };
  return ersetzen(takte, pos.takt, legen(neu2, r));
}

// Note schreiben: an der Stelle eine Note mit diesem Wert und dieser Höhe
// (MuseScore-Eingabe: der Rest bleibt Pause); dazu die Stelle der nächsten
// gezeichneten Note, damit die Auswahl weiterrückt.
export function noteSchreiben(takte: readonly Takt[], r: Raster, pos: NotenPos, midi: number, dauer: number): { takte: Takt[]; naechste: NotenPos | null } {
  const mitDauer = dauerSetzen(takte, r, pos, dauer);
  const t = mitDauer[pos.takt];
  if (!t) return { takte: mitDauer, naechste: null };
  const { strecke } = streckeDerNote(t, pos.note);
  const ergebnis = tonSetzen(mitDauer, r, { takt: pos.takt, note: ersteNote(t, strecke) }, midi);
  const fertig = ergebnis[pos.takt];
  const weiter = strecken(fertig).length > strecke + 1 ? { takt: pos.takt, note: ersteNote(fertig, strecke + 1) }
    : ergebnis[pos.takt + 1] ? { takt: pos.takt + 1, note: 0 } : null;
  return { takte: ergebnis, naechste: weiter };
}

// Tonhöhe, die eine neue Note bekommt: die der vorigen Note, sonst C4.
export function letzteHoehe(takte: readonly Takt[], pos: NotenPos): number {
  for (let t = pos.takt; t >= 0; t--) {
    const noten = takte[t]?.noten ?? [];
    for (let k = (t === pos.takt ? pos.note : noten.length) - 1; k >= 0; k--) { const m = noten[k].midi; if (m !== null) return m; }
  }
  for (let t = pos.takt; t < takte.length; t++) for (const n of takte[t].noten) if (n.midi !== null) return n.midi;
  return 60;
}

// ── Bogen ──

// Ist die Note angebunden (Bogen von der vorigen Note her)?
export function angebunden(takte: readonly Takt[], pos: NotenPos): boolean {
  const t = takte[pos.takt];
  if (!t) return false;
  const { strecke, erste } = streckeDerNote(t, pos.note);
  if (!erste) return true;
  if (strecke === 0 && pos.takt > 0) {
    const vor = strecken(takte[pos.takt - 1]);
    const l = vor[vor.length - 1];
    return !!l?.bindung && l.midi === strecken(t)[0]?.midi;
  }
  return false;
}

// Bogen setzen oder lösen: angebunden → die Note wird ein eigener Einsatz;
// sonst wird sie an die vorige Note gehängt (nimmt deren Höhe an). Vor einer
// Pause oder ganz am Anfang passiert nichts.
export function bogenUmschalten(takte: readonly Takt[], r: Raster, pos: NotenPos): Takt[] {
  const t = takte[pos.takt];
  if (!t) return [...takte];
  const { strecke, erste } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  if (!erste) {
    // Strecke vor dieser Note teilen: Dauer bis zur Note bleibt, der Rest wird eigener Einsatz.
    let davor = 0;
    for (let k = ersteNote(t, strecke); k < pos.note; k++) davor += t.noten[k].dauer;
    const s = liste[strecke];
    const { bindung: _b, ...kopf } = s; void _b;
    liste.splice(strecke, 1, { ...kopf, dauer: davor }, { ...s, dauer: s.dauer - davor });
    return ersetzen(takte, pos.takt, legen(liste, r));
  }
  if (strecke === 0) {
    if (pos.takt === 0) return [...takte];
    const vor = strecken(takte[pos.takt - 1]);
    const l = vor[vor.length - 1];
    if (!l || l.midi === null || liste[0].midi === null) return [...takte];
    if (l.bindung && l.midi === liste[0].midi) return bogenLoesen(takte, r, pos.takt - 1);
    vor[vor.length - 1] = { ...l, bindung: true };
    liste[0] = { ...liste[0], midi: l.midi };
    return ersetzen(ersetzen(takte, pos.takt - 1, legen(vor, r)), pos.takt, legen(liste, r));
  }
  const vor = liste[strecke - 1], s = liste[strecke];
  if (vor.midi === null || s.midi === null) return [...takte];
  liste.splice(strecke - 1, 2, { midi: vor.midi, dauer: vor.dauer + s.dauer, ...(s.bindung ? { bindung: true as const } : {}) });
  return ersetzen(takte, pos.takt, legen(liste, r));
}

// ── Takte ──

export const taktEinfuegen = (takte: readonly Takt[], r: Raster, nach: number): Takt[] =>
  [...takte.slice(0, nach + 1), leererTakt(r), ...takte.slice(nach + 1)];

export function taktLoeschen(takte: readonly Takt[], r: Raster, i: number): Takt[] {
  if (!takte[i]) return [...takte];
  const rest = takte.filter((_, k) => k !== i);
  if (!rest.length) return [leererTakt(r)];
  // Ein Bogen aus dem Vortakt zielte auf den gelöschten Takt: passt der
  // Nachfolger nicht, löst er sich.
  if (i > 0) {
    const vor = strecken(rest[i - 1]), l = vor[vor.length - 1];
    const nach = rest[i] ? strecken(rest[i])[0] : null;
    if (l?.bindung && (!nach || nach.midi !== l.midi)) return bogenLoesen(rest, r, i - 1);
  }
  return rest;
}

// Leeres Blatt zum Schreiben.
export const leeresBlatt = (r: Raster): Takt[] => [leererTakt(r)];

// Notenwerte für die Palette: Zellen je Wert, vom größten (ganze Note, soweit
// sie in den Takt passt) bis zur Zelle, ohne Punktierungen; `kurz` als
// Bruch für schmale Bildschirme.
export function paletteWerte(r: Raster): { zellen: number; name: string; kurz: string }[] {
  const namen: Record<number, string> = { 1: 'Ganze', 2: 'Halbe', 4: 'Viertel', 8: 'Achtel', 16: 'Sechzehntel' };
  const jt = zellenJeTakt(r);
  const liste: { zellen: number; name: string; kurz: string }[] = [];
  for (let wert = 1; wert <= r.feinheit; wert *= 2) {
    const zellen = r.feinheit / wert;
    if (zellen <= jt) liste.push({ zellen, name: namen[wert], kurz: `1/${wert}` });
  }
  return liste;
}
// Punktiert = anderthalbfach, wenn das ein erlaubter Wert ist.
export const punktiert = (zellen: number, r: Raster) => (notenwerte(r).includes(zellen * 1.5) ? zellen * 1.5 : null);

// ── Vorspielen ──

// Ein Klang: Beginn und Dauer in Sekunden, notierte Tonhöhe. Gebundene Noten
// (auch über Taktstriche) sind ein Klang; Pausen klingen nicht.
export interface Klang { beginn: number; dauer: number; midi: number }
export function klaenge(takte: readonly Takt[], r: Raster): Klang[] {
  const zd = zellenDauer(r);
  const liste: Klang[] = [];
  let zeit = 0, offen: Klang | null = null, bogen = false;
  for (const t of takte) {
    for (const n of t.noten) {
      const dauer = n.dauer * zd;
      if (n.midi !== null && bogen && offen && offen.midi === n.midi) offen.dauer += dauer;
      else if (n.midi !== null) { offen = { beginn: zeit, dauer, midi: n.midi }; liste.push(offen); }
      else offen = null;
      bogen = !!n.bindung && n.midi !== null;
      zeit += dauer;
    }
  }
  return liste;
}

// Beginn jeder gezeichneten Note in Sekunden (für den Abspiel-Zeiger), in
// Lesereihenfolge, dazu die Gesamtdauer.
export function notenZeiten(takte: readonly Takt[], r: Raster): { zeiten: number[]; gesamt: number } {
  const zd = zellenDauer(r);
  const zeiten: number[] = [];
  let zeit = 0;
  for (const t of takte) for (const n of t.noten) { zeiten.push(zeit); zeit += n.dauer * zd; }
  return { zeiten, gesamt: zeit };
}
