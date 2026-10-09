// Fachlogik der Übe-App: Stimmgerät und Ausschnitte. Rein, getestet.

const NAMEN = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];

// Transponierende Instrumente: so viele Halbtöne liegt die notierte Note über
// dem klingenden Ton (B-Klarinette/Trompete: große Sekunde, Es-Altsax: große
// Sexte, F-Horn: Quinte).
export const STIMMUNGEN = { C: 0, B: 2, Es: 9, F: 7 } as const;
export type Stimmung = keyof typeof STIMMUNGEN;

export interface Ton { name: string; oktave: number; cent: number; frequenz: number }

export function frequenzZuTon(frequenz: number, kammerton = 442, stimmung: Stimmung = 'C'): Ton | null {
  if (!(frequenz > 20 && frequenz < 5000)) return null;
  const halbtoene = 12 * Math.log2(frequenz / kammerton) + 69;
  const gerundet = Math.round(halbtoene);
  const cent = Math.round((halbtoene - gerundet) * 100);
  const notiert = gerundet + STIMMUNGEN[stimmung];
  return { name: NAMEN[((notiert % 12) + 12) % 12], oktave: Math.floor(notiert / 12) - 1, cent, frequenz };
}

// Grundfrequenz nach dem YIN-Verfahren (de Cheveigné & Kawahara, 2002):
// robuster gegen Oktavfehler als einfache Autokorrelation, gut für Blasinstrumente.
// Liefert Frequenz und Klarheit (0..1) oder null bei Stille/Geräusch.
export function grundfrequenz(puffer: Float32Array, abtastrate: number, schwelle = 0.15): { frequenz: number; klarheit: number } | null {
  const n = puffer.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += puffer[i] * puffer[i];
  if (Math.sqrt(rms / n) < 0.008) return null;

  const haelfte = Math.floor(n / 2);
  const minTau = Math.max(2, Math.floor(abtastrate / 2500));
  const d = new Float32Array(haelfte);
  for (let tau = 1; tau < haelfte; tau++) {
    let s = 0;
    for (let i = 0; i < haelfte; i++) { const x = puffer[i] - puffer[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // kumulativ normierte Differenz
  const cmnd = new Float32Array(haelfte);
  cmnd[0] = 1;
  let summe = 0;
  for (let tau = 1; tau < haelfte; tau++) { summe += d[tau]; cmnd[tau] = summe ? (d[tau] * tau) / summe : 1; }

  let tau = -1;
  for (let t = minTau; t < haelfte - 1; t++) {
    if (cmnd[t] < schwelle) {
      while (t + 1 < haelfte && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1] ?? b;
  const nenner = a - 2 * b + c;
  const genau = nenner ? tau + (a - c) / (2 * nenner) : tau;
  return { frequenz: abtastrate / genau, klarheit: Math.max(0, Math.min(1, 1 - b)) };
}

export function median(werte: number[]): number {
  const s = [...werte].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Klingender Ton (Halbtonnummer, MIDI) zu notiertem Ton für ein Instrument und
// zurück — für den Referenzton.
export function tonFrequenz(midi: number, kammerton = 442): number {
  return kammerton * 2 ** ((midi - 69) / 12);
}

const BEZEICHNUNGEN: [number, string][] = [
  [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'],
  [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [Infinity, 'Prestissimo'],
];
// Übliche Richtwerte; die Grenzen sind fließend.
export function tempoBezeichnung(bpm: number): string {
  return BEZEICHNUNGEN.find(([grenze]) => bpm < grenze)?.[1] ?? 'Prestissimo';
}

// Tempo-Trainer: Start-Tempo, alle `takte` Takte um `schritt` schneller, bis `ziel`.
export function trainerTempo(start: number, schritt: number, takte: number, ziel: number, taktNr: number): number {
  if (schritt <= 0 || takte <= 0) return start;
  const t = start + Math.floor(taktNr / takte) * schritt;
  return ziel >= start ? Math.min(t, ziel) : start;
}

export interface Rechteck { x: number; y: number; b: number; h: number }

// Ausschnitt mit etwas Rand (für „einen Takt davor und danach“). Takte
// erkennt die App auf eingescannten Noten nicht — der Rand ist ein fester
// Anteil der Seitenbreite, beim Markieren also großzügig ziehen.
export function mitRand(r: Rechteck, rand: number): Rechteck {
  const x = Math.max(0, r.x - rand);
  const y = Math.max(0, r.y - rand / 4);
  const rechts = Math.min(1, r.x + r.b + rand);
  const unten = Math.min(1, r.y + r.h + rand / 4);
  return { x, y, b: rechts - x, h: unten - y };
}

// Rechteck aus zwei Punkten (Ziehen in beliebige Richtung), auf die Seite begrenzt.
export function rechteckAus(x1: number, y1: number, x2: number, y2: number): Rechteck {
  const k = (v: number) => Math.min(1, Math.max(0, v));
  const [a, b] = [k(Math.min(x1, x2)), k(Math.max(x1, x2))];
  const [c, d] = [k(Math.min(y1, y2)), k(Math.max(y1, y2))];
  return { x: a, y: c, b: b - a, h: d - c };
}
