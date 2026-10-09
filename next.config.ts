import { existsSync, readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Name des pdf.js-Workers mit Version, wie ihn scripts/pdf-worker.mjs ablegt.
const pdfjs = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8')) as { version: string };
const PDF_WORKER = `/pdf.worker-${pdfjs.version}.min.mjs`;
if (!existsSync(`public${PDF_WORKER}`)) {
  throw new Error(`public${PDF_WORKER} fehlt — erst „node scripts/pdf-worker.mjs“ ausführen.`);
}

// Statische App: kein Server, alles läuft im Browser und bleibt auf dem Gerät.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Wird beim Build fest in den Code geschrieben (process.env.PDF_WORKER).
  env: { PDF_WORKER },
};

export default nextConfig;
