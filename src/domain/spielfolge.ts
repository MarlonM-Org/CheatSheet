// Spielfolge (F-05): Weiterblättern folgt den Sprüngen. Aus den Ansichten
// (Seiten, Halb-Ansichten) und den Sprüngen wird die Reihenfolge, in der man
// das Stück spielt — Pedal, Ring, Tasten und Rand-Tippen gehen sie Schritt für
// Schritt, vor und zurück. Rein, getestet.
//
// Regeln: Start bei der ersten Ansicht, sonst immer eine weiter. Zeigt die
// Ansicht das Sprungzeichen eines fälligen Sprungs, führt „weiter“ zur ganzen
// Zielseite (Schritt mit Ankunft); mehrere fällige: der in Lesereihenfolge
// erste. Jeder Sprung höchstens einmal. Coda ist erst nach einem D.S. oder
// D.C. fällig (im ersten Durchgang übergeht man das ⊕).
// Halb/Linie: Auf der ganzen Seite blättert man an der Linie weiter; ein
// Zeichen darunter ist erst in der Halb-Ansicht danach fällig (dort steht der
// Rest der Seite noch) — außer man ist per Sprung schon unter der Linie
// eingestiegen.

import type { Ansicht } from './notenpult';
import { ansichtFinden, lesereihenfolge, punktSichtbar, zielAnsicht, type Punkt, type Sprung } from './spruenge';

// ansicht: Index in die Ansichten-Liste. ankunft: per Sprung (id) erreicht.
export interface Schritt { ansicht: number; ankunft?: string }

// Harte Obergrenze, falls die Regeln einmal anders kommen als gedacht.
const HOECHSTENS = 20000;

// Ist das Zeichen auf Ansicht i schon dran? einstieg: Höhe, an der man per
// Sprung auf dieser (ganzen) Seite eingestiegen ist.
function erreicht(liste: Ansicht[], i: number, p: Punkt, einstieg: number | null): boolean {
  const a = liste[i], n = liste[i + 1];
  if (!punktSichtbar(a, p)) return false;
  if (a.art !== 'ganz' || n?.art !== 'halb' || n.unten !== a.seite) return true;
  return p.y < n.schnitt || (einstieg !== null && einstieg >= n.schnitt);
}

export function spielfolge(liste: Ansicht[], spruenge: Sprung[]): Schritt[] {
  if (!liste.length) return [];
  // Lesereihenfolge: Seite, Zeile, links vor rechts — in der Halb-Ansicht
  // damit erst die untere (alte) Seite, dann die obere (neue).
  const kandidaten = lesereihenfolge(spruenge)
    .map((s) => ({ s, ziel: zielAnsicht(liste, s.nach) }))
    .filter((k): k is { s: Sprung; ziel: number } => k.ziel !== null);
  const verbraucht = new Set<string>();
  let nachDsDc = false;
  // Zwischen zwei Sprüngen geht es nur vorwärts: höchstens so viele Schritte.
  const grenze = Math.min(HOECHSTENS, liste.length * (kandidaten.length + 1) + kandidaten.length);
  const folge: Schritt[] = [{ ansicht: 0 }];
  let i = 0, einstieg: number | null = null;
  while (folge.length < grenze) {
    const k = kandidaten.find(({ s }) => !verbraucht.has(s.id) && (s.art !== 'coda' || nachDsDc) && erreicht(liste, i, s.von, einstieg));
    if (k) {
      verbraucht.add(k.s.id);
      if (k.s.art === 'ds' || k.s.art === 'dc') nachDsDc = true;
      i = k.ziel;
      einstieg = k.s.nach.y;
      folge.push({ ansicht: i, ankunft: k.s.id });
    } else if (i + 1 < liste.length) {
      i += 1;
      einstieg = null;
      folge.push({ ansicht: i });
    } else break;
  }
  return folge;
}

const klemmen = (folge: Schritt[], s: number) => Math.max(0, Math.min(folge.length - 1, Math.round(s) || 0));

// Der Schritt, der diese Ansicht zeigt und `nahe` am nächsten liegt (gleich
// weit: der frühere). Zeigt sie keiner (übersprungen), der mit der
// nächstgelegenen Ansicht.
export function schrittZu(folge: Schritt[], ansicht: number, nahe: number): number {
  let best = 0, bestA = Infinity, bestS = Infinity;
  folge.forEach((s, i) => {
    const da = Math.abs(s.ansicht - ansicht), ds = Math.abs(i - nahe);
    if (da < bestA || (da === bestA && ds < bestS)) { best = i; bestA = da; bestS = ds; }
  });
  return best;
}

// Wo man über diesen Sprung ankommt: die nächste Ankunft ab `ab`, sonst die
// erste; nimmt die Folge ihn nie (Coda ohne D.S.), null.
export function ankunftSchritt(folge: Schritt[], id: string, ab: number): number | null {
  let erste: number | null = null;
  for (let i = 0; i < folge.length; i++) {
    if (folge[i].ankunft !== id) continue;
    if (i >= ab) return i;
    erste ??= i;
  }
  return erste;
}

// Seit welchem Sprung (id) man hier ist — der zuletzt genommene bis hierhin.
// Kennzeichnet den Durchgang (Abschnitt), etwa beim Moduswechsel.
export function abschnitt(folge: Schritt[], schritt: number): string | null {
  if (!folge.length) return null;
  for (let i = klemmen(folge, schritt); i >= 0; i--) if (folge[i].ankunft) return folge[i].ankunft!;
  return null;
}

// Für den Untertitel („nach D.S.“): über welchen Sprung man in diesen Teil
// kam. Eine Wiederholung nur, solange man in ihr ist — bis zur Ansicht, an der
// gesprungen wurde; danach gilt wieder, was davor galt (z. B. „nach D.S.“).
// zeige: Ansicht außer der Reihe (siehe Stand), liegt sie dahinter, ist die
// Wiederholung vorbei.
export function nachSprung(folge: Schritt[], schritt: number, spruenge: Sprung[], zeige: number | null = null): Sprung | null {
  if (!folge.length) return null;
  const s = klemmen(folge, schritt);
  for (let i = s; i > 0; i--) {
    const sp = spruenge.find((x) => x.id === folge[i].ankunft);
    if (!sp) continue;
    if (sp.art !== 'wdh') return sp;
    // Ende der Wiederholung: wieder die Ansicht, aus der gesprungen wurde.
    const dort = folge[i - 1].ansicht;
    let ende = i;
    while (ende < folge.length - 1 && folge[ende].ansicht !== dort) ende++;
    if (s < ende || (s === ende && (zeige === null || zeige <= folge[ende].ansicht))) return sp;
  }
  return null;
}

// Sprünge oder Blätter-Modus geändert: dieselbe Ansicht (sonst die ganze
// Seite, die dort galt; oder die vorgegebene `ziel`) im selben Abschnitt.
// Kommt sie dort nicht vor, die nächstgelegene Ansicht des Abschnitts (man
// bleibt im Durchgang); gibt es den Abschnitt nicht mehr, der nächstgelegene
// Schritt mit dieser Ansicht.
export function schrittUebertragen(
  altListe: Ansicht[], altFolge: Schritt[], schritt: number, neuListe: Ansicht[], neuFolge: Schritt[], ziel?: number,
): number {
  if (!altFolge.length || !neuFolge.length) return 0;
  const s = klemmen(altFolge, schritt);
  const alt = altListe[altFolge[s].ansicht];
  const v = ziel ?? (alt ? ansichtFinden(neuListe, alt) : 0);
  const seit = abschnitt(altFolge, s);
  let hier: string | null = null, naechster = -1, abstand = Infinity;
  for (let i = 0; i < neuFolge.length; i++) {
    hier = neuFolge[i].ankunft ?? hier;
    if (hier !== seit) continue;
    const d = Math.abs(neuFolge[i].ansicht - v);
    if (d === 0) return i;
    if (d < abstand) { abstand = d; naechster = i; }
  }
  return naechster >= 0 ? naechster : schrittZu(neuFolge, v, s);
}

// ── Stand im Betrachter: der Schritt in der Folge; zeige: statt seiner steht
// diese Ansicht auf dem Schirm, weil der Durchgang sie nicht hat (Halb
// eingeschaltet auf einer Seite, die Halb überspringt; ganze Seite zum
// Anmerken). Weiter und zurück gehen von ihr aus im selben Durchgang.
export interface Stand { schritt: number; zeige: number | null }

// Sprünge oder Blättern geändert, Setzen vorbei, ganze Seite gezeigt:
// dieselbe Ansicht (oder `ziel`) im selben Durchgang (schrittUebertragen).
// Hat der Durchgang sie nicht, bleibt sie trotzdem zu sehen.
export function standUebertragen(
  altListe: Ansicht[], altFolge: Schritt[], alt: Stand, neuListe: Ansicht[], neuFolge: Schritt[], ziel?: number,
): Stand {
  if (!altFolge.length || !neuFolge.length) return { schritt: 0, zeige: null };
  const gezeigt = altListe[alt.zeige ?? altFolge[klemmen(altFolge, alt.schritt)].ansicht];
  const v = ziel ?? (gezeigt ? ansichtFinden(neuListe, gezeigt) : 0);
  const s = schrittUebertragen(altListe, altFolge, alt.schritt, neuListe, neuFolge, v);
  return { schritt: s, zeige: neuFolge[s].ansicht === v ? null : v };
}

// Eine Ansicht zeigen (Stelle → Lesen, Marke ohne Ankunft): der nächstliegende
// Schritt mit ihr; hat die Folge sie gar nicht (übersprungen), außer der Reihe.
export function standZu(folge: Schritt[], ansicht: number, nahe: number): Stand {
  const s = schrittZu(folge, ansicht, nahe);
  return { schritt: s, zeige: folge[s]?.ansicht === ansicht ? null : ansicht };
}

// Ein Schritt weiter. Außer der Reihe: liegt der Schritt hinter der gezeigten
// Ansicht, zu ihm, sonst zum nächsten. Am Ende derselbe Stand.
export function weiterGehen(folge: Schritt[], st: Stand): Stand {
  if (!folge.length) return st;
  const s = klemmen(folge, st.schritt);
  if (st.zeige !== null && folge[s].ansicht > st.zeige) return { schritt: s, zeige: null };
  return s + 1 < folge.length ? { schritt: s + 1, zeige: null } : st;
}

// Ein Schritt zurück, spiegelbildlich. Am Anfang derselbe Stand.
export function zurueckGehen(folge: Schritt[], st: Stand): Stand {
  if (!folge.length) return st;
  const s = klemmen(folge, st.schritt);
  if (st.zeige !== null && folge[s].ansicht < st.zeige) return { schritt: s, zeige: null };
  return s > 0 ? { schritt: s - 1, zeige: null } : st;
}
