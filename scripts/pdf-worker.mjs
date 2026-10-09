// Kopiert den pdf.js-Worker nach public/, passend zur installierten Version.
// Läuft nach jedem npm install (postinstall), auch beim Deploy.
// Der Name trägt die Version (pdf.worker-<version>.min.mjs): So holt ein Gerät
// nach einem Update nie einen alten Worker aus dem Cache. Den Namen liest
// next.config.ts genauso aus und gibt ihn an src/components/ueben/pdf.ts.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8'));
const name = `pdf.worker-${version}.min.mjs`;
mkdirSync('public', { recursive: true });
// Worker anderer Versionen wegräumen, sonst landen sie im Vorab-Cache.
for (const alt of readdirSync('public')) {
  if (/^pdf\.worker.*\.min\.mjs$/.test(alt) && alt !== name) rmSync(`public/${alt}`);
}
copyFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', `public/${name}`);
console.log(`pdf-worker: public/${name}`);
