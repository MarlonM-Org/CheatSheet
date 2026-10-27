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

import { leiter, notenwerte, zellenDauer, zellenJeGruppe, zellenJeSchlag, zellenJeTakt, zerlegen, type Note, type Raster, type Stimme, type Takt, type Tonart } from './notation';
import { istZusammengesetzt } from './takt';

// Lage einer gezeichneten Note: Takt t, darin Note k (Pausen zählen mit).
export interface NotenPos { takt: number; note: number }

export const TON_MIN = 24, TON_MAX = 108; // C1 … C8

// Das Blatt rechnet mit 96 Zellen je ganzer Note: 32tel (3), Sechzehntel
// (6), Achtel (12) … und Triolen (Achteltriole 8, Sechzehnteltriole 4,
// Vierteltriole 16) bleiben ganze Zellen.
export const BLATT = 96;
export const aufBlatt = (r: Raster): Raster => ({ ...r, feinheit: BLATT });
// Takte eines gröberen Rasters (Transkription: 8 oder 16) aufs Blatt bringen.
export function skalieren(takte: readonly Takt[], von: number, nach = BLATT): Takt[] {
  if (von === nach) return [...takte];
  const f = nach / von;
  return takte.map((t) => ({ noten: t.noten.map((n) => ({ ...n, dauer: n.dauer * f })) }));
}
// Gelesene Takte (abcLesen) aufs Blatt: skaliert und jeder Takt neu gelegt
// (Werte, Bindungen, Triolen-Klammern wie das Blatt sie schreibt).
export function aufsBlatt(takte: readonly Takt[], von: number, r: Raster): Takt[] {
  const b = aufBlatt(r);
  return skalieren(takte, von).map((t) => legen(strecken(t), b));
}

interface Strecke { midi: number | null; dauer: number; bindung?: true; bogenAuf?: true; bogenZu?: true }

// Gebundene gleiche Noten eines Takts zu Strecken; `bindung` bleibt nur an
// der letzten Strecke (Bogen in den nächsten Takt).
export function strecken(t: Takt): Strecke[] {
  const liste: Strecke[] = [];
  let offen = false;
  for (const n of t.noten) {
    const s = liste[liste.length - 1];
    if (offen && s && s.midi !== null && s.midi === n.midi) { s.dauer += n.dauer; if (n.bogenZu) s.bogenZu = true; else delete s.bogenZu; }
    else liste.push({ midi: n.midi, dauer: n.dauer, ...(n.bogenAuf ? { bogenAuf: true as const } : {}), ...(n.bogenZu ? { bogenZu: true as const } : {}) });
    offen = !!n.bindung && n.midi !== null;
  }
  if (offen && liste.length) liste[liste.length - 1].bindung = true;
  return liste;
}

// Strecken → Noten in erlaubten Werten, gebunden. Pausen ohne Punktierung —
// außer in zusammengesetzten Taktarten (6/8: der Schlag ist punktiert).
//
// Triolen: Ein Schlag, dessen Einsätze nicht aufs binäre Raster (32tel)
// fallen, aber auf Zwölftel des Schlags, ist ein Triolen-Schlag — seine
// Noten werden anderthalbfach geschrieben und mit `(3:2:k` geklammert.
// Fallen die Einsätze einer Takthälfte (4/4) auf deren Drittel, ist es eine
// Vierteltriole über die Hälfte. Nur in einfachen Taktarten.
export function legen(roh: readonly Strecke[], r: Raster): Takt {
  const zusammengesetzt = istZusammengesetzt(r.zaehler, r.nenner);
  const liste = bereinigen(roh, r);
  const bereiche = triolenBereiche(liste, r);
  const noten: Note[] = [];
  let ab = 0;
  for (const s of liste) {
    const punktiert = s.midi !== null || zusammengesetzt;
    // Die Strecke in Stücke je Bereich (binär oder Triole) schneiden.
    const stuecke: { ab: number; dauer: number; triole: boolean }[] = [];
    let pos = ab;
    const ende = ab + s.dauer;
    while (pos < ende) {
      const b = bereiche.find((x) => x.von <= pos && pos < x.bis)!;
      const bis = Math.min(ende, b.bis);
      stuecke.push({ ab: pos, dauer: bis - pos, triole: b.triole });
      pos = bis;
    }
    const werte = notenwerte(r, punktiert);
    stuecke.forEach((st, si) => {
      // Binär: zerlegen kennt Schlag- und Gruppengrenzen. Triole: die
      // geschriebene Länge (anderthalbfach) gierig in erlaubte Werte.
      const teile = st.triole ? gierig((st.dauer * 3) / 2, werte).map((w) => (w * 2) / 3) : zerlegen(st.ab, st.dauer, r, punktiert);
      teile.forEach((dauer, i) => {
        const letzter = si === stuecke.length - 1 && i === teile.length - 1;
        const erster = si === 0 && i === 0;
        const n: Note = { midi: s.midi, dauer };
        if (s.midi !== null && (!letzter || s.bindung)) n.bindung = true;
        if (st.triole) n.triole = true;
        if (erster && s.bogenAuf && s.midi !== null) n.bogenAuf = true;
        if (letzter && s.bogenZu && s.midi !== null) n.bogenZu = true;
        noten.push(n);
      });
    });
    ab += s.dauer;
  }
  // Je Triolen-Bereich: die Klammer an die erste Note, mit der Anzahl.
  const anfaenge: number[] = [];
  let von = 0;
  for (const n of noten) { anfaenge.push(von); von += n.dauer; }
  for (const b of bereiche.filter((x) => x.triole)) {
    const drin = noten.filter((_, k) => anfaenge[k] >= b.von && anfaenge[k] < b.bis);
    if (drin.length) drin[0].gruppe = drin.length;
  }
  return { noten };
}

// Gierig in Werte zerlegen (größter zuerst); was nicht aufgeht, bleibt in
// kleinsten Werten (sollte nicht vorkommen — die Palette gibt nur Werte her,
// die aufgehen).
function gierig(dauer: number, werte: readonly number[]): number[] {
  const teile: number[] = [];
  let rest = dauer;
  while (rest > 0) { const w = werte.find((x) => x <= rest) ?? werte[werte.length - 1]; teile.push(w); rest -= w; }
  return teile;
}

// Was sich nicht notieren lässt (ein Schlag, dessen Einsätze weder aufs
// binäre noch aufs Triolen-Raster fallen — etwa eine Triole, vor die ein
// 32tel geschoben wurde), wird in diesem Schlag aufs binäre Raster gerundet;
// die anderen Schläge bleiben, wie sie sind. Das ändert den Rhythmus dort
// hörbar — aber eine lesbare Note ist besser als ein Haufen 1/96.
function bereinigen(liste: readonly Strecke[], r: Raster): Strecke[] {
  const jt = zellenJeTakt(r), js = zellenJeSchlag(r);
  const kleinste = Math.min(...notenwerte(r, false));
  const grenzen: number[] = [];
  let pos = 0;
  for (const s of liste) { pos += s.dauer; grenzen.push(pos); }
  const bereiche = triolenBereiche(liste, r);
  const kaputt = (g: number) => {
    const b = bereiche.find((x) => x.von <= g && g < x.bis);
    if (!b || b.triole || g % kleinste === 0) return false;
    // Im binären Bereich, aber nicht auf dem Raster: der Schlag ist kaputt.
    void js; void jt;
    return true;
  };
  if (!grenzen.some(kaputt)) return [...liste];
  const neu: Strecke[] = [];
  let von = 0;
  liste.forEach((s, i) => {
    let bis = grenzen[i];
    if (kaputt(bis)) bis = Math.round(bis / kleinste) * kleinste;
    if (i === liste.length - 1) bis = grenzen[i];
    if (bis > von) neu.push({ ...s, dauer: bis - von });
    von = Math.max(von, bis);
  });
  return neu;
}

// Die Bereiche des Takts: binär oder Triole, lückenlos von 0 bis Taktende.
function triolenBereiche(liste: readonly Strecke[], r: Raster): { von: number; bis: number; triole: boolean }[] {
  // Ein Takt darf beim Bearbeiten länger sein als die Taktart (rot markiert): die Bereiche reichen bis zu seinem Ende.
  const jt = Math.max(zellenJeTakt(r), liste.reduce((a, s) => a + s.dauer, 0)), js = zellenJeSchlag(r), jg = zellenJeGruppe(r);
  const grenzen = new Set<number>();
  let pos = 0;
  for (const s of liste) { grenzen.add(pos); pos += s.dauer; grenzen.add(pos); }
  const kleinste = Math.min(...notenwerte(r, false));
  const innen = (von: number, bis: number) => [...grenzen].filter((g) => von < g && g < bis).map((g) => g - von);
  const binaer = (von: number, bis: number) => innen(von, bis).every((g) => g % kleinste === 0);
  const auf = (von: number, bis: number, einheit: number) => Number.isInteger(einheit) && innen(von, bis).every((g) => g % einheit === 0);
  const bereiche: { von: number; bis: number; triole: boolean }[] = [];
  const einfach = !istZusammengesetzt(r.zaehler, r.nenner);
  for (let von = 0; von < jt; ) {
    // Takthälfte als Vierteltriole?
    if (einfach && jg === 2 * js && von % jg === 0 && !binaer(von, von + jg) && auf(von, von + jg, jg / 3)) {
      bereiche.push({ von, bis: von + jg, triole: true }); von += jg; continue;
    }
    const bis = Math.min(jt, von + js);
    bereiche.push({ von, bis, triole: einfach && !binaer(von, bis) && auf(von, bis, js / 12) });
    von = bis;
  }
  // Benachbarte binäre Bereiche verschmelzen (zerlegen sieht dann die ganze Strecke).
  const verschmolzen: typeof bereiche = [];
  for (const b of bereiche) {
    const v = verschmolzen[verschmolzen.length - 1];
    if (v && !v.triole && !b.triole) v.bis = b.bis; else verschmolzen.push({ ...b });
  }
  return verschmolzen;
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

export function bogenLoesen(takte: readonly Takt[], r: Raster, i: number): Takt[] {
  const liste = strecken(takte[i]);
  if (!liste.length || !liste[liste.length - 1].bindung) return [...takte];
  const { bindung: _weg, ...rest } = liste[liste.length - 1]; void _weg;
  liste[liste.length - 1] = rest;
  return ersetzen(takte, i, legen(liste, r));
}

// ── Notenwert ──

// Den Notenwert setzen — nur diese Note: nichts wird aufgefüllt, nichts
// gefressen. Stimmt die Taktlänge danach nicht mehr, zeigt das Blatt den
// Takt rot (taktLaenge); so lässt sich ein bestehender Satz aufräumen, ohne
// dass Nachbarn verrutschen. Ein Bogen in den nächsten Takt bleibt nur an
// der letzten Strecke.
export function dauerSetzen(takte: readonly Takt[], r: Raster, pos: NotenPos, dauer: number): Takt[] {
  const t = takte[pos.takt];
  if (!t || dauer < 1) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s || s.dauer === dauer) return [...takte];
  liste[strecke] = { ...s, dauer };
  return ersetzen(takte, pos.takt, legen(liste, r));
}

// Palettenwert auf die gewählte Stelle: Eine Note bekommt den Wert
// (dauerSetzen); eine Pause wird geteilt — vorn der Wert, hinten der Rest —
// damit „Note“ danach genau diesen Wert schreibt und der Takt stimmt.
export function wertSetzen(takte: readonly Takt[], r: Raster, pos: NotenPos, dauer: number): Takt[] {
  const t = takte[pos.takt];
  if (!t || dauer < 1) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s) return [...takte];
  if (s.midi !== null) return dauerSetzen(takte, r, pos, dauer);
  if (dauer >= s.dauer) return [...takte];
  liste.splice(strecke, 1, { midi: null, dauer }, { midi: null, dauer: s.dauer - dauer });
  return ersetzen(takte, pos.takt, legen(liste, r));
}

// Note schreiben (MuseScore-Eingabe): In eine Pause gesetzt, nimmt die Note
// den Palettenwert, der Rest der Pause bleibt Pause; auf einer Note ändert
// sich nur deren Wert und Höhe. Dazu die Stelle der nächsten gezeichneten
// Note, damit die Auswahl weiterrückt.
export function noteSchreiben(takte: readonly Takt[], r: Raster, pos: NotenPos, midi: number, dauer: number): { takte: Takt[]; naechste: NotenPos | null } {
  const t = takte[pos.takt];
  if (!t) return { takte: [...takte], naechste: null };
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s) return { takte: [...takte], naechste: null };
  if (s.midi === null) {
    const rest = s.dauer - dauer;
    liste.splice(strecke, 1, { midi, dauer }, ...(rest > 0 ? [{ midi: null, dauer: rest }] : []));
  } else liste[strecke] = { ...s, midi, dauer };
  let ergebnis = ersetzen(takte, pos.takt, legen(liste, r));
  if (s.midi !== null && s.midi !== midi) ergebnis = tonSetzen(ergebnis, r, { takt: pos.takt, note: ersteNote(ergebnis[pos.takt], strecke) }, midi);
  const fertig = ergebnis[pos.takt];
  const weiter = strecken(fertig).length > strecke + 1 ? { takt: pos.takt, note: ersteNote(fertig, strecke + 1) }
    : ergebnis[pos.takt + 1] ? { takt: pos.takt + 1, note: 0 } : null;
  return { takte: ergebnis, naechste: weiter };
}

// Hinter der gewählten Note eine Note (Höhe `midi`) oder Pause (null)
// einfügen — nur in diesem Takt, der dann länger ist (rot, bis er stimmt).
// Liefert die Lage der neuen Note.
export function danachEinfuegen(takte: readonly Takt[], r: Raster, pos: NotenPos, midi: number | null, dauer: number): { takte: Takt[]; neu: NotenPos } {
  const t = takte[pos.takt];
  if (!t) return { takte: [...takte], neu: pos };
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  const s = liste[strecke];
  if (!s) return { takte: [...takte], neu: pos };
  // Ein Bogen von dieser Note in den nächsten Takt zielte an der Einfügung vorbei: lösen.
  const { bindung: _b, ...ohne } = s; void _b;
  liste.splice(strecke, 1, ohne, { midi, dauer });
  const ergebnis = ersetzen(takte, pos.takt, legen(liste, r));
  return { takte: ergebnis, neu: { takt: pos.takt, note: ersteNote(ergebnis[pos.takt], strecke + 1) } };
}

// Note aus dem Takt nehmen — nur hier, die anderen Takte bleiben, wie sie
// sind; der Takt ist dann kürzer (rot, bis er stimmt). Ein leerer Takt wird
// eine ganze Pause.
export function loeschenImTakt(takte: readonly Takt[], r: Raster, pos: NotenPos): Takt[] {
  const t = takte[pos.takt];
  if (!t) return [...takte];
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = strecken(t);
  if (!liste[strecke]) return [...takte];
  liste.splice(strecke, 1);
  let ergebnis = ersetzen(takte, pos.takt, liste.length ? legen(liste, r) : leererTakt(r));
  if (strecke === 0 && pos.takt > 0) ergebnis = bogenLoesen(ergebnis, r, pos.takt - 1);
  if (!liste.length || !liste[liste.length - 1].bindung) ergebnis = bogenLoesen(ergebnis, r, pos.takt);
  return ergebnis;
}
export const loeschenViele = (takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[]) =>
  nacheinander(takte, lagen, (t, p) => loeschenImTakt(t, r, p));

// Länge eines Takts in Zellen und ob sie zur Taktart passt.
export const taktLaenge = (t: Takt) => t.noten.reduce((a, n) => a + n.dauer, 0);
export const taktStimmt = (t: Takt, r: Raster) => taktLaenge(t) === zellenJeTakt(r);

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

// ── Löschen und Einfügen: alles rückt nach ──

// Die ganze Stimme als eine Folge von Strecken, Bögen über Taktstriche
// verschmolzen; `teile` sagt, aus welchen [takt, strecke] eine Folge-Strecke besteht.
interface Folge { midi: number | null; dauer: number; teile: [number, number][] }
// Benachbarte Pausen werden dabei eine (Stille hat keinen Einsatz) — sonst
// sammelten sich beim Löschen die Füllpausen am Ende.
function folge(takte: readonly Takt[]): Folge[] {
  const liste: Folge[] = [];
  let offen = false;
  takte.forEach((t, ti) => {
    strecken(t).forEach((s, si) => {
      const l = liste[liste.length - 1];
      if (l && ((si === 0 && offen && l.midi !== null && l.midi === s.midi) || (l.midi === null && s.midi === null))) { l.dauer += s.dauer; l.teile.push([ti, si]); }
      else liste.push({ midi: s.midi, dauer: s.dauer, teile: [[ti, si]] });
      offen = !!s.bindung;
    });
  });
  return liste;
}

// Die Folge wieder in Takte schneiden: an Taktgrenzen geteilt und gebunden,
// der letzte Takt mit Pause gefüllt, mindestens ein Takt.
function schneiden(liste: readonly Folge[], r: Raster): Takt[] {
  const jt = zellenJeTakt(r);
  const gesamt = liste.reduce((a, s) => a + s.dauer, 0);
  const anzahl = Math.max(1, Math.ceil(gesamt / jt));
  const takte: Strecke[][] = Array.from({ length: anzahl }, () => []);
  let ab = 0;
  for (const s of liste) {
    let rest = s.dauer;
    while (rest > 0) {
      const takt = Math.floor(ab / jt), imTakt = ab % jt;
      const hier = Math.min(rest, jt - imTakt);
      takte[takt].push(hier < rest && s.midi !== null ? { midi: s.midi, dauer: hier, bindung: true } : { midi: s.midi, dauer: hier });
      ab += hier; rest -= hier;
    }
  }
  const frei = anzahl * jt - gesamt;
  if (frei > 0) {
    const letzter = takte[anzahl - 1], l = letzter[letzter.length - 1];
    if (l && l.midi === null) l.dauer += frei; else letzter.push({ midi: null, dauer: frei });
  }
  return takte.map((l) => legen(l, r));
}

function folgeDerNote(takte: readonly Takt[], pos: NotenPos): { liste: Folge[]; i: number } | null {
  const t = takte[pos.takt];
  if (!t) return null;
  const { strecke } = streckeDerNote(t, pos.note);
  const liste = folge(takte);
  const i = liste.findIndex((f) => f.teile.some(([ti, si]) => ti === pos.takt && si === strecke));
  return i < 0 ? null : { liste, i };
}

// Note (oder Pause) herausnehmen — alles danach rückt nach, auch über
// Taktstriche; der letzte Takt füllt sich mit Pause.
export function entfernen(takte: readonly Takt[], r: Raster, pos: NotenPos): Takt[] {
  const f = folgeDerNote(takte, pos);
  if (!f) return [...takte];
  return schneiden(f.liste.filter((_, k) => k !== f.i), r);
}

// Vor der Note eine Pause dieser Dauer einfügen — alles danach rückt weiter
// (wird der Platz knapp, wächst ein Takt dazu).
export function einfuegen(takte: readonly Takt[], r: Raster, pos: NotenPos, dauer: number): Takt[] {
  const f = folgeDerNote(takte, pos);
  if (!f || dauer < 1) return [...takte];
  const liste = [...f.liste];
  liste.splice(f.i, 0, { midi: null, dauer, teile: [] });
  return schneiden(liste, r);
}

// Haltebögen über eine Auswahl: jedes Paar aufeinanderfolgender gewählter
// Noten gleicher Höhe, die direkt nacheinander stehen, wird gebunden (die
// zweite hängt an die erste). Eine einzelne Note: wie bogenUmschalten.
export function haltebogenViele(takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[]): Takt[] {
  if (lagen.length < 2) return lagen.length ? bogenUmschalten(takte, r, lagen[0]) : [...takte];
  const sortiert = [...lagen].sort((a, b) => a.takt - b.takt || a.note - b.note);
  let t = [...takte];
  // Von hinten nach vorn: Binden verschmilzt Strecken, davorliegende Lagen bleiben gültig.
  for (let k = sortiert.length - 1; k >= 1; k--) {
    const a = sortiert[k - 1], b = sortiert[k];
    const na = t[a.takt]?.noten[a.note], nb = t[b.takt]?.noten[b.note];
    if (!na || !nb || na.midi === null || na.midi !== nb.midi) continue;
    // Direkt nacheinander? Zwischen a und b darf nichts liegen (außer dem Rest von a).
    const dazwischen = a.takt === b.takt ? t[a.takt].noten.slice(a.note + 1, b.note) : [...t[a.takt].noten.slice(a.note + 1), ...t[b.takt].noten.slice(0, b.note)];
    if (dazwischen.some((n) => n.midi !== na.midi || !n.bindung) || (a.takt !== b.takt && b.takt !== a.takt + 1)) continue;
    if (!angebunden(t, b)) t = bogenUmschalten(t, r, b);
  }
  return t;
}

// Bindebogen (Phrasierung) über die Auswahl: von der ersten zur letzten
// gewählten Note; liegt genau dieser Bogen schon, wird er entfernt.
export function bindebogenUmschalten(takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[]): Takt[] {
  const noten = [...lagen].sort((a, b) => a.takt - b.takt || a.note - b.note).filter((p) => takte[p.takt]?.noten[p.note]?.midi !== null);
  if (noten.length < 2) return [...takte];
  const a = noten[0], z = noten[noten.length - 1];
  const setzen = (t: readonly Takt[], p: NotenPos, feld: 'bogenAuf' | 'bogenZu', an: boolean) => {
    const liste = strecken(t[p.takt]);
    const { strecke } = streckeDerNote(t[p.takt], p.note);
    const s = liste[strecke];
    if (!s) return [...t];
    liste[strecke] = an ? { ...s, [feld]: true } : (({ [feld]: _w, ...rest }) => { void _w; return rest as Strecke; })(s);
    return ersetzen(t, p.takt, legen(liste, r));
  };
  const schon = !!takte[a.takt].noten[a.note].bogenAuf && !!takte[z.takt].noten[z.note].bogenZu;
  return setzen(setzen(takte, a, 'bogenAuf', !schon), z, 'bogenZu', !schon);
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
// sie in den Takt passt) bis zum kleinsten ganzzahligen (Blatt: 32tel),
// ohne Punktierungen; `kurz` als Bruch für schmale Bildschirme.
export function paletteWerte(r: Raster): { zellen: number; name: string; kurz: string }[] {
  const namen: Record<number, string> = { 1: 'Ganze', 2: 'Halbe', 4: 'Viertel', 8: 'Achtel', 16: 'Sechzehntel', 32: 'Zweiunddreißigstel' };
  const jt = zellenJeTakt(r);
  const liste: { zellen: number; name: string; kurz: string }[] = [];
  for (let wert = 1; wert <= 32; wert *= 2) {
    const zellen = r.feinheit / wert;
    if (!Number.isInteger(zellen)) break;
    if (zellen <= jt) liste.push({ zellen, name: namen[wert], kurz: `1/${wert}` });
  }
  return liste;
}
// Punktiert = anderthalbfach, wenn das ein erlaubter Wert ist.
export const punktiert = (zellen: number, r: Raster) => (notenwerte(r).includes(zellen * 1.5) ? zellen * 1.5 : null);
// Triole = zwei Drittel, wenn das ganze Zellen sind (und die Taktart einfach ist).
export const triole = (zellen: number, r: Raster) => (Number.isInteger((zellen * 2) / 3) && !istZusammengesetzt(r.zaehler, r.nenner) ? (zellen * 2) / 3 : null);

// ── Mehrere Noten auf einmal ──
// Von hinten nach vorn angewendet, damit frühere Lagen gültig bleiben, wenn
// eine Änderung die Noten eines Takts neu zerlegt (Pause, Löschen).
export function nacheinander(takte: readonly Takt[], lagen: readonly NotenPos[], f: (t: Takt[], p: NotenPos) => Takt[]): Takt[] {
  const sortiert = [...lagen].sort((a, b) => b.takt - a.takt || b.note - a.note);
  return sortiert.reduce<Takt[]>((t, p) => f(t, p), [...takte]);
}
export const verschiebenViele = (takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[], halbtoene: number) =>
  nacheinander(takte, lagen, (t, p) => verschieben(t, r, p, halbtoene));
export const leiterVerschiebenViele = (takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[], schritte: number, tonart: Tonart | null | undefined) =>
  nacheinander(takte, lagen, (t, p) => leiterVerschieben(t, r, p, schritte, tonart));
export const pausenViele = (takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[]) =>
  nacheinander(takte, lagen, (t, p) => tonSetzen(t, r, p, null));
export const entfernenViele = (takte: readonly Takt[], r: Raster, lagen: readonly NotenPos[]) =>
  nacheinander(takte, lagen, (t, p) => entfernen(t, r, p));
// Alle Noten (keine Pausen) einer Stimme.
export const alleNoten = (takte: readonly Takt[]): NotenPos[] =>
  takte.flatMap((t, takt) => t.noten.map((n, note) => (n.midi === null ? null : { takt, note })).filter((p): p is NotenPos => !!p));

// Alle Noten aller Stimmen um Halbtöne versetzen (Transponieren, z. B. für
// ein B-Instrument +2). Noten, die den Tonumfang verließen, bleiben stehen.
export const transponieren = (stimmen: readonly Stimme[], r: Raster, halbtoene: number): Stimme[] =>
  stimmen.map((s) => ({ ...s, takte: verschiebenViele(s.takte, r, alleNoten(s.takte), halbtoene) }));

// ── Stimmen (mehrstimmig) ──

export const einstimmig = (takte: readonly Takt[]): Stimme[] => [{ name: '', schluessel: 'violin', takte: [...takte] }];
// Alle Stimmen gleich lang: kürzere bekommen leere Takte hinten dran.
export function angleichen(stimmen: readonly Stimme[], r: Raster): Stimme[] {
  const n = Math.max(1, ...stimmen.map((s) => s.takte.length));
  return stimmen.map((s) => (s.takte.length === n ? s : { ...s, takte: [...s.takte, ...Array.from({ length: n - s.takte.length }, () => leererTakt(r))] }));
}
// Die Takte einer Stimme ersetzen (nach einer Änderung dort).
export const inStimme = (stimmen: readonly Stimme[], i: number, takte: Takt[], r: Raster): Stimme[] =>
  angleichen(stimmen.map((s, k) => (k === i ? { ...s, takte } : s)), r);
// Dieselbe Takt-Änderung in allen Stimmen (Takt anhängen, Takt löschen).
export const inAllen = (stimmen: readonly Stimme[], f: (takte: Takt[]) => Takt[]): Stimme[] =>
  stimmen.map((s) => ({ ...s, takte: f(s.takte) }));
export function stimmeHinzu(stimmen: readonly Stimme[], r: Raster): Stimme[] {
  const n = Math.max(1, ...stimmen.map((s) => s.takte.length));
  const nummer = stimmen.length + 1;
  return [...stimmen, { name: `Stimme ${nummer}`, schluessel: nummer === 2 ? 'bass' : 'violin', takte: Array.from({ length: n }, () => leererTakt(r)) }];
}
export const stimmeWeg = (stimmen: readonly Stimme[], i: number): Stimme[] => (stimmen.length > 1 ? stimmen.filter((_, k) => k !== i) : [...stimmen]);
export const stimmeAendern = (stimmen: readonly Stimme[], i: number, neu: Partial<Pick<Stimme, 'name' | 'schluessel'>>): Stimme[] =>
  stimmen.map((s, k) => (k === i ? { ...s, ...neu } : s));
// Gelesene Stimmen (abcLesen) aufs Blatt.
export const aufsBlattStimmen = (stimmen: readonly Stimme[], von: number, r: Raster): Stimme[] =>
  angleichen(stimmen.map((s) => ({ ...s, takte: aufsBlatt(s.takte, von, r) })), aufBlatt(r));

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

// Alle Stimmen zusammen, nach Beginn sortiert; stumme Stimmen fehlen.
export function klaengeAlle(stimmen: readonly Stimme[], r: Raster, stumm: ReadonlySet<number> = new Set()): Klang[] {
  return stimmen.flatMap((s, i) => (stumm.has(i) ? [] : klaenge(s.takte, r))).sort((a, b) => a.beginn - b.beginn);
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
