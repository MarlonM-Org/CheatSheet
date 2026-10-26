// Notationsregeln fürs Komponieren (G-10): Was das Blatt nicht von selbst
// einhält, prüft `pruefen` und gibt kurze Hinweise zurück — pro Takt und
// Stimme, in der Sprache des Musikers („Takt 4: G6 liegt über dem
// Tonumfang“). Die Regeln, die das Blatt beim Legen selbst einhält
// (Notenwerte nach dem Schlag, Taktmitte im 4/4, keine punktierten Pausen,
// Triolen-Klammern), stehen in ./notensatz. Liste und Begründung: ROADMAP
// G-10. Rein, getestet.

import { leiter, TONARTEN, zellenJeSchlag, zellenJeTakt, type Raster, type Stimme, type Takt, type Tonart } from './notation';
import { tonName } from './tonprofil';

// `art`: lesbar (Notenbild), spielbar (fürs Instrument), form (Aufbau des Stücks).
export interface Hinweis { stimme: number | null; takt: number | null; text: string; art: 'lesbar' | 'spielbar' | 'form' }
export interface Pruefung {
  // Notierter Tonumfang des Instruments (midi), etwa aus dem Tonprofil; null = nicht prüfen.
  umfang?: { von: number; bis: number } | null;
}

const taktText = (t: number) => `Takt ${t + 1}`;
const stimmeText = (stimmen: readonly Stimme[], i: number) => (stimmen.length > 1 ? `${stimmen[i].name || `Stimme ${i + 1}`}, ` : '');

export function pruefen(stimmen: readonly Stimme[], r: Raster, tonart: Tonart | null, p: Pruefung = {}): Hinweis[] {
  const liste: Hinweis[] = [];
  const jt = zellenJeTakt(r), js = zellenJeSchlag(r);
  const dotted = new Set([72, 36, 18, 9].map((w) => (w * 2) / 3));

  stimmen.forEach((s, si) => {
    const wo = (t: number) => `${stimmeText(stimmen, si)}${taktText(t)}`;
    let vorige: number | null = null;
    let ohnePauseSeit: number | null = null;
    s.takte.forEach((t, ti) => {
      let umfangGemeldet = false, sprungGemeldet = false, triolePunkt = false;
      for (const n of t.noten) {
        if (n.midi === null) { vorige = null; ohnePauseSeit = null; continue; }
        if (ohnePauseSeit === null) ohnePauseSeit = ti;
        // Tonumfang (spielbar).
        if (p.umfang && !umfangGemeldet && (n.midi < p.umfang.von || n.midi > p.umfang.bis)) {
          umfangGemeldet = true;
          liste.push({ stimme: si, takt: ti, art: 'spielbar', text: n.midi > p.umfang.bis
            ? `${wo(ti)}: ${tonName(n.midi)} liegt über dem Tonumfang (bis ${tonName(p.umfang.bis)}).`
            : `${wo(ti)}: ${tonName(n.midi)} liegt unter dem Tonumfang (ab ${tonName(p.umfang.von)}).` });
        }
        // Großer Sprung (spielbar).
        if (vorige !== null && !sprungGemeldet && Math.abs(n.midi - vorige) > 12) {
          sprungGemeldet = true;
          liste.push({ stimme: si, takt: ti, art: 'spielbar', text: `${wo(ti)}: Sprung ${tonName(vorige)} → ${tonName(n.midi)} (${Math.abs(n.midi - vorige)} Halbtöne) — schwer zu treffen.` });
        }
        vorige = n.midi;
        // Punktierter Wert in einer Triole (lesbar).
        if (n.triole && !triolePunkt && dotted.has(n.dauer)) {
          triolePunkt = true;
          liste.push({ stimme: si, takt: ti, art: 'lesbar', text: `${wo(ti)}: punktierter Wert in einer Triole — schwer zu lesen; lieber zwei gebundene Noten.` });
        }
      }
      // Lange Strecke ohne Pause (spielbar, Atmen).
      const letzterTakt = ti === s.takte.length - 1;
      if (ohnePauseSeit !== null && (letzterTakt || t.noten[t.noten.length - 1].midi === null)) { /* Ende der Strecke: unten gezählt */ }
    });
    // Atmen: längste Folge von Takten ohne eine einzige Pause.
    let anfang = -1;
    const melden = (von: number, bis: number) => {
      if (von >= 0 && bis - von + 1 >= 8) liste.push({ stimme: si, takt: von, art: 'spielbar', text: `${wo(von)}–${bis + 1}: keine Pause zum Atmen.` });
    };
    s.takte.forEach((t, ti) => {
      const pause = t.noten.some((n) => n.midi === null);
      const leer = t.noten.every((n) => n.midi === null);
      if (!pause && !leer) { if (anfang < 0) anfang = ti; }
      else { melden(anfang, ti - 1); anfang = -1; }
    });
    melden(anfang, s.takte.length - 1);
  });

  // Stimmen kreuzen sich (lesbar): je Zelle die klingende Höhe vergleichen.
  if (stimmen.length > 1) {
    const hoehen = (t: Takt | undefined) => {
      const h: (number | null)[] = [];
      for (const n of t?.noten ?? []) for (let k = 0; k < n.dauer; k++) h.push(n.midi);
      return h;
    };
    const takte = Math.max(...stimmen.map((s) => s.takte.length));
    for (let ti = 0; ti < takte; ti++) {
      for (let o = 0; o < stimmen.length - 1; o++) {
        const oben = hoehen(stimmen[o].takte[ti]), unten = hoehen(stimmen[o + 1].takte[ti]);
        if (oben.some((h, k) => h !== null && unten[k] !== null && unten[k]! > h)) {
          liste.push({ stimme: o + 1, takt: ti, art: 'lesbar', text: `${taktText(ti)}: ${stimmen[o + 1].name || `Stimme ${o + 2}`} liegt über ${stimmen[o].name || `Stimme ${o + 1}`}.` });
        }
      }
    }
  }

  // Tonart (lesbar): passt eine andere besser? Zählt Töne außerhalb der Leiter.
  const toene = stimmen.flatMap((s) => s.takte.flatMap((t) => t.noten.map((n) => n.midi).filter((m): m is number => m !== null)));
  if (toene.length >= 8) {
    const fremd = (t: Tonart | null) => { const l = leiter(t) ?? new Set([0, 2, 4, 5, 7, 9, 11]); return toene.filter((m) => !l.has(((m % 12) + 12) % 12)).length; };
    const hier = fremd(tonart);
    if (hier >= 3) {
      const beste = TONARTEN.filter((t) => !t.moll).map((t) => ({ t, n: fremd(t) })).sort((a, b) => a.n - b.n)[0];
      if (beste && beste.n + 3 <= hier) {
        liste.push({ stimme: null, takt: null, art: 'lesbar', text: `${hier} Töne liegen außerhalb von ${tonart?.name ?? 'C-Dur'} — in ${beste.t.name} wären es ${beste.n}. Tonart prüfen.` });
      }
    }
  }

  // Aufbau: Auftakt und leere Takte am Ende.
  const erste = stimmen[0]?.takte[0];
  if (erste) {
    let pause = 0;
    for (const n of erste.noten) { if (n.midi !== null) break; pause += n.dauer; }
    if (pause >= jt / 2 && pause < jt && stimmen.every((s) => { let p2 = 0; for (const n of s.takte[0]?.noten ?? []) { if (n.midi !== null) break; p2 += n.dauer; } return p2 >= pause; })) {
      liste.push({ stimme: null, takt: 0, art: 'form', text: `Takt 1 beginnt mit ${Math.round(pause / js)} Schlägen Pause — ein Auftakt wäre üblich.` });
    }
  }
  const anzahl = Math.max(0, ...stimmen.map((s) => s.takte.length));
  let leerAb = anzahl;
  while (leerAb > 1 && stimmen.every((s) => !s.takte[leerAb - 1] || s.takte[leerAb - 1].noten.every((n) => n.midi === null))) leerAb--;
  if (leerAb < anzahl) {
    liste.push({ stimme: null, takt: leerAb, art: 'form', text: leerAb === anzahl - 1 ? `Takt ${anzahl} ist leer — „Takt −“ nimmt ihn weg.` : `Takt ${leerAb + 1}–${anzahl} sind leer — „Takt −“ nimmt sie weg.` });
  }

  return liste.sort((a, b) => (a.takt ?? -1) - (b.takt ?? -1) || (a.stimme ?? -1) - (b.stimme ?? -1));
}
