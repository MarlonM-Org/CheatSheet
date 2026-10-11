// Kopiert den pdf.js-Worker und die Bild-Decoder nach public/, passend zur
// installierten Version. Läuft nach jedem npm install (postinstall), auch beim
// Deploy. Die Namen tragen die Version (pdf.worker-<version>.min.mjs,
// pdfjs-<version>/): So holt ein Gerät nach einem Update nie Alte aus dem
// Cache. Die Namen liest next.config.ts genauso aus und gibt sie an
// src/components/ueben/pdf.ts.
//
// Decoder (WebAssembly, mit Ersatz in JavaScript): pdf.js 6 braucht sie für
// JBIG2 (typisch für Schwarz-Weiß-Scans) und JPEG 2000 — ohne sie bleibt ein
// so gespeicherter Scan leer. qcms für Farbprofile. quickjs (Skripte in PDFs)
// bleibt draußen.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8'));
const name = `pdf.worker-${version}.min.mjs`;
const ordner = `pdfjs-${version}`;
const DECODER = ['jbig2.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg.wasm', 'openjpeg_nowasm_fallback.js', 'qcms_bg.wasm'];
mkdirSync('public', { recursive: true });
// Worker und Decoder anderer Versionen wegräumen, sonst landen sie im Vorab-Cache.
for (const alt of readdirSync('public')) {
  if (/^pdf\.worker.*\.min\.mjs$/.test(alt) && alt !== name) rmSync(`public/${alt}`);
  if (/^pdfjs-/.test(alt) && alt !== ordner) rmSync(`public/${alt}`, { recursive: true });
}
copyFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', `public/${name}`);
mkdirSync(`public/${ordner}`, { recursive: true });
for (const d of DECODER) copyFileSync(`node_modules/pdfjs-dist/wasm/${d}`, `public/${ordner}/${d}`);
console.log(`pdf-worker: public/${name}, public/${ordner}/ (${DECODER.length} Decoder)`);
