// Kopiert den pdf.js-Worker nach public/, passend zur installierten Version.
// Läuft nach jedem npm install (postinstall), auch beim Deploy.
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
copyFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'public/pdf.worker.min.mjs');
