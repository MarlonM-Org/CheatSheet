import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Name des pdf.js-Workers mit Version, wie ihn scripts/pdf-worker.mjs ablegt.
const pdfjs = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8')) as { version: string };
const PDF_WORKER = `/pdf.worker-${pdfjs.version}.min.mjs`;
// Ordner der Bild-Decoder (JBIG2, JPEG 2000), ebenfalls von dort abgelegt.
const PDF_WASM = `/pdfjs-${pdfjs.version}/`;
for (const pfad of [PDF_WORKER, `${PDF_WASM}openjpeg.wasm`]) {
  if (!existsSync(`public${pfad}`)) throw new Error(`public${pfad} fehlt — erst „node scripts/pdf-worker.mjs“ ausführen.`);
}

// Kennung dieses Builds: Seite und Service Worker kennen beide dieselbe, so
// meldet die Seite eine neue Version nur bei echtem Unterschied. Einmal beim
// Laden der Konfiguration erzeugt; Next lädt die Konfiguration mehrmals (und
// womöglich in Hilfsprozessen), alle sollen dieselbe Kennung bekommen. Dafür
// liegt sie in einer eigenen Variable, zusammen mit der Nummer des Prozesses,
// der sie erzeugt hat — übernommen wird sie nur im selben Prozess oder in
// einem direkten Kindprozess. Von außen (CI, Hosting) gesetzt, gilt sie nicht:
// Sonst hätten alle Builds dieselbe Kennung und es käme nie ein Hinweis.
// scripts/precache.mjs liest sie aus .next/BUILD_ID und setzt sie in sw.js ein.
const NAME = '__CHEATSHEET_BUILD_KENNUNG';
function kennung(): string {
  const [pid, wert] = (process.env[NAME] ?? '').split(':');
  if (wert && /^[\w-]{12}$/.test(wert) && (pid === String(process.pid) || pid === String(process.ppid))) return wert;
  const neu = randomBytes(9).toString('base64url');
  process.env[NAME] = `${process.pid}:${neu}`;
  return neu;
}
const BUILD_KENNUNG = kennung();

// Statische App: kein Server, alles läuft im Browser und bleibt auf dem Gerät.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  generateBuildId: () => BUILD_KENNUNG,
  // Wird beim Build fest in den Code geschrieben (process.env.…).
  env: { PDF_WORKER, PDF_WASM },
  // Namen mit __ nimmt `env` nicht an; define schreibt sie genauso fest ein
  // (der Wert ist der Text selbst, Next setzt die Anführungszeichen).
  compiler: { define: { [`process.env.${NAME}`]: BUILD_KENNUNG } },
};

export default nextConfig;
