// Erkennt Fehler beim Nachladen von Code-Stücken. Typischer Fall: Eine alte
// Seite ist noch offen, inzwischen ist eine neue Version ausgeliefert, und ein
// Stück der alten gibt es weder im Netz noch im Cache. Dann hilft nur neu laden —
// das soll die Person so lesen, nicht als technische Meldung. Rein, getestet.

const MUSTER = [
  /loading chunk .* failed/i, // webpack
  /failed to load chunk/i, // Turbopack
  /dynamically imported module/i, // Chrome, Firefox
  /importing a module script failed/i, // Safari
  /setting up fake worker failed/i, // pdf.js: Worker-Datei nicht ladbar
];

export function istNachladeFehler(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  if (name === 'ChunkLoadError') return true;
  return typeof message === 'string' && MUSTER.some((m) => m.test(message));
}
