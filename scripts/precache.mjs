// Läuft nach `next build`: schreibt alle Dateien aus out/ als out/precache.json
// und setzt die Version in out/sw.js ein. Die Version ist ein Hash über Namen
// und Inhalt aller Dateien — jeder neue Stand bekommt einen neuen Cache.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const AUSLASSEN = new Set(['sw.js', 'precache.json']);

function alle(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? alle(join(ordner, e.name)) : [join(ordner, e.name)]);
}

const dateien = alle(OUT)
  .map((d) => relative(OUT, d).split(sep).join('/'))
  .filter((d) => !AUSLASSEN.has(d))
  .sort();

const hash = createHash('sha256');
for (const d of dateien) hash.update(d).update('\0').update(readFileSync(join(OUT, d))).update('\0');
const version = hash.digest('hex').slice(0, 16);

// Die Startseite unter ihrer Adresse vorhalten (/ statt /index.html).
const pfade = dateien.map((d) => (d === 'index.html' ? '/' : '/' + d));

writeFileSync(join(OUT, 'precache.json'), JSON.stringify({ version, dateien: pfade }, null, 1));

const sw = readFileSync(join(OUT, 'sw.js'), 'utf8');
const ersetzt = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
if (ersetzt === sw) throw new Error('precache: Versionszeile in out/sw.js nicht gefunden');
writeFileSync(join(OUT, 'sw.js'), ersetzt);

console.log(`precache: ${pfade.length} Dateien, Version ${version}`);
