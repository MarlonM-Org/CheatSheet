// Drone (I-18): welche Töne der Liegeklang hat. Rein, getestet.
//
// Töne sind **notiert** (MIDI-Zahl, wie sie auf dem Blatt der Klarinette
// stehen); die Umrechnung in klingende Frequenzen macht der Klang
// (klavier.ts: klingend()). Der Grundton wird in eine ruhige tiefe Mitte
// gelegt — notiert C3 bis H3 (auf der B-Klarinette klingend A♯2 bis A3, also
// ~115–220 Hz): tief genug für einen Teppich, hoch genug, dass ihn auch
// Telefon-Lautsprecher bringen.
//
// Farben (alle mit Grundton, Quinte und Oktave als Grund):
//  - grundton: Grundton und Oktave (reiner Liegeton)
//  - quinte:   Grundton, Quinte, Oktave (leer, ohne Terz)
//  - dur / moll: dazu die Terz oberhalb der Oktave
//  - dorisch / mixolydisch: Hinweis statt Akkord — Grundton, Quinte, Oktave
//    und der Charaktereton der Skala: große Sexte (dorisch, das Moll mit
//    hellem Sechsten) bzw. kleine Septime (mixolydisch, das Dur mit dunklem
//    Siebten). Die Terz fehlt bewusst: Der Teppich lässt offen, ob Dur oder
//    Moll, und man spielt die Skala gegen den Klang.

export const FARBEN = ['grundton', 'quinte', 'dur', 'moll', 'dorisch', 'mixolydisch'] as const;
export type DroneFarbe = (typeof FARBEN)[number];
export const FARBE_STANDARD: DroneFarbe = 'quinte';

export const FARBE_NAME: Record<DroneFarbe, string> = {
  grundton: 'Grundton', quinte: 'Quinte', dur: 'Dur', moll: 'Moll', dorisch: 'Dorisch', mixolydisch: 'Mixolydisch',
};
export const FARBE_HINWEIS: Record<DroneFarbe, string> = {
  grundton: 'Grundton und Oktave',
  quinte: 'Grundton, Quinte und Oktave',
  dur: 'Grundton, Quinte, Oktave, große Terz',
  moll: 'Grundton, Quinte, Oktave, kleine Terz',
  dorisch: 'Grundton, Quinte, Oktave, große Sexte — Dorisch klingt nach Moll mit hellem Sechsten',
  mixolydisch: 'Grundton, Quinte, Oktave, kleine Septime — Mixolydisch klingt nach Dur mit dunklem Siebten',
};

export const istFarbe = (v: unknown): v is DroneFarbe => FARBEN.includes(v as DroneFarbe);

// Lage des Grundtons (notiert, MIDI): C3 … H3.
export const DRONE_LAGE = { von: 48, bis: 59 } as const;

const NAMEN = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
export const tonklasse = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;
/** Deutscher Name der Tonklasse (0–11, 0 = C): C Cis D Es E F Fis G As A B H. */
export const klasseName = (klasse: number) => NAMEN[tonklasse(klasse)];

/** Grundton in die Lage der Drone legen; `grundton` ist eine MIDI-Zahl (beliebige Oktave) oder eine Tonklasse 0–11. */
export const droneGrundton = (grundton: number): number => DRONE_LAGE.von + ((tonklasse(grundton) - DRONE_LAGE.von) % 12 + 12) % 12;

// Abstände zum Grundton und Gewicht (Lautstärkeanteil) je Stimme.
const AUFBAU: Record<DroneFarbe, readonly (readonly [number, number])[]> = {
  grundton: [[0, 1], [12, 0.45]],
  quinte: [[0, 1], [7, 0.7], [12, 0.45]],
  dur: [[0, 1], [7, 0.7], [12, 0.45], [16, 0.3]],
  moll: [[0, 1], [7, 0.7], [12, 0.45], [15, 0.3]],
  dorisch: [[0, 1], [7, 0.7], [12, 0.45], [21, 0.3]],
  mixolydisch: [[0, 1], [7, 0.7], [12, 0.45], [22, 0.3]],
};

export interface DroneStimme { midi: number; gewicht: number }
export function droneStimmen(grundton: number, farbe: DroneFarbe): DroneStimme[] {
  const g = droneGrundton(grundton);
  return AUFBAU[farbe].map(([abstand, gewicht]) => ({ midi: g + abstand, gewicht }));
}
/** Die notierten Töne, tief nach hoch. */
export const droneToene = (grundton: number, farbe: DroneFarbe): number[] => droneStimmen(grundton, farbe).map((s) => s.midi);

export const droneLautPruefen = (v: unknown, standard = 0.5): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : standard;

// Gespeicherte Wahl (Sicherung, localStorage).
export interface DroneEinstellung { grundton: number; farbe: DroneFarbe; laut: number }
export const DRONE_STANDARD: DroneEinstellung = { grundton: 10, farbe: FARBE_STANDARD, laut: 0.5 };
export function istDroneEinstellung(v: unknown): v is DroneEinstellung {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  return Number.isInteger(e.grundton) && (e.grundton as number) >= 0 && (e.grundton as number) <= 11
    && istFarbe(e.farbe) && typeof e.laut === 'number' && e.laut >= 0 && e.laut <= 1;
}

// Pegel je Stimme: tiefe Töne tragen auf kleinen Lautsprechern weniger —
// leicht anheben, Summe auf 1 normieren.
export function stimmenPegel(stimmen: readonly DroneStimme[], frequenzen: readonly number[]): number[] {
  const roh = stimmen.map((s, i) => s.gewicht * Math.min(1.6, Math.max(0.7, Math.pow(220 / frequenzen[i], 0.3))));
  const summe = roh.reduce((a, b) => a + b, 0) || 1;
  return roh.map((r) => r / summe);
}
