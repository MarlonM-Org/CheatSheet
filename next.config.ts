import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Name des pdf.js-Workers mit Version, wie ihn scripts/pdf-worker.mjs ablegt.
const pdfjs = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8')) as { version: string };
const PDF_WORKER = `/pdf.worker-${pdfjs.version}.min.mjs`;
if (!existsSync(`public${PDF_WORKER}`)) {
  throw new Error(`public${PDF_WORKER} fehlt — erst „node scripts/pdf-worker.mjs“ ausführen.`);
}

// Kennung dieses Builds: Seite und Service Worker kennen beide dieselbe, so
// meldet die Seite eine neue Version nur bei echtem Unterschied. Einmal beim
// Laden der Konfiguration erzeugt und in die Umgebung gelegt — Next lädt die
// Konfiguration in Hilfsprozessen erneut, die erben dann dieselbe Kennung.
// scripts/precache.mjs liest sie aus .next/BUILD_ID und setzt sie in sw.js ein.
const BUILD_KENNUNG = (process.env.BUILD_KENNUNG ||= randomBytes(9).toString('base64url'));

// Statische App: kein Server, alles läuft im Browser und bleibt auf dem Gerät.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  generateBuildId: () => BUILD_KENNUNG,
  // Wird beim Build fest in den Code geschrieben (process.env.…).
  env: { PDF_WORKER, BUILD_KENNUNG },
};

export default nextConfig;
