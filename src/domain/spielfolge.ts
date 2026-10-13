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

import type { Ansicht } from './notenpult';
import { ansichtFinden, punktSichtbar, vorher, zielAnsicht, type Sprung } from './spruenge';

// ansicht: Index in die Ansichten-Liste. ankunft: per Sprung (id) erreicht.
export interface Schritt { ansicht: number; ankunft?: string }

// Harte Obergrenze, falls die Regeln einmal anders kommen als gedacht.
const HOECHSTENS = 20000;

export function spielfolge(liste: Ansicht[], spruenge: Sprung[]): Schritt[] {
  if (!liste.length) return [];
  // Lesereihenfolge: Seite, Höhe, links vor rechts — in der Halb-Ansicht
  // damit erst die untere (alte) Seite, dann die obere (neue).
  const kandidaten = spruenge
    .map((s) => ({ s, ziel: zielAnsicht(liste, s.nach) }))
    .filter((k): k is { s: Sprung; ziel: number } => k.ziel !== null)
    .sort((a, b) => vorher(a.s, b.s));
  const verbraucht = new Set<string>();
  let nachDsDc = false;
  // Zwischen zwei Sprüngen geht es nur vorwärts: höchstens so viele Schritte.
  const grenze = Math.min(HOECHSTENS, liste.length * (kandidaten.length + 1) + kandidaten.length);
  const folge: Schritt[] = [{ ansicht: 0 }];
  let i = 0;
  while (folge.length < grenze) {
    const a = liste[i];
    const k = kandidaten.find(({ s }) => !verbraucht.has(s.id) && (s.art !== 'coda' || nachDsDc) && punktSichtbar(a, s.von));
    if (k) {
      verbraucht.add(k.s.id);
      if (k.s.art === 'ds' || k.s.art === 'dc') nachDsDc = true;
      i = k.ziel;
      folge.push({ ansicht: i, ankunft: k.s.id });
    } else if (i + 1 < liste.length) {
      i += 1;
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
export function abschnitt(folge: Schritt[], schritt: number): string | null {
  if (!folge.length) return null;
  for (let i = klemmen(folge, schritt); i >= 0; i--) if (folge[i].ankunft) return folge[i].ankunft!;
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
