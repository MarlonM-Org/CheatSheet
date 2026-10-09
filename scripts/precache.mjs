// Läuft nach `next build`: schreibt alle Dateien aus out/ als out/precache.json
// und setzt Version und Build-Kennung in out/sw.js ein. Die Version ist ein
// Hash über Namen und Inhalt aller Dateien — jeder neue Stand bekommt einen
// neuen Cache. Die Build-Kennung ist dieselbe, die next.config.ts der Seite
// mitgibt (process.env.BUILD_KENNUNG).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
const AUSLASSEN = new Set(['sw.js', 'precache.json']);
// Reine Fehlerseiten: Offline fällt jede Navigation ohnehin auf / zurück.
const FEHLERSEITE = /^(404\.html|_not-found\.(html|txt)|_not-found\/.*)$/;

function alle(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? alle(join(ordner, e.name)) : [join(ordner, e.name)]);
}

const kennung = readFileSync(join('.next', 'BUILD_ID'), 'utf8').trim();
if (!/^[\w-]+$/.test(kennung) || !existsSync(join(OUT, '_next', 'static', kennung))) {
  throw new Error(`precache: Build-Kennung „${kennung}“ passt nicht zu out/_next/static/`);
}

const dateien = alle(OUT)
  .map((d) => relative(OUT, d).split(sep).join('/'))
  .filter((d) => !AUSLASSEN.has(d) && !FEHLERSEITE.test(d))
  .sort();

// Die Seite muss dieselbe Kennung im Code tragen, sonst käme nach jedem
// Update ein falscher oder gar kein Hinweis.
const alsText = new RegExp(`["'\`]${kennung}["'\`]`);
if (!dateien.some((d) => d.startsWith('_next/static/chunks/') && d.endsWith('.js') && alsText.test(readFileSync(join(OUT, d), 'utf8')))) {
  throw new Error(`precache: Kennung „${kennung}“ steckt in keinem Code-Stück der Seite`);
}

const hash = createHash('sha256');
for (const d of dateien) hash.update(d).update('\0').update(readFileSync(join(OUT, d))).update('\0');
const version = hash.digest('hex').slice(0, 16);

// Die Startseite unter ihrer Adresse vorhalten (/ statt /index.html).
const pfade = dateien.map((d) => (d === 'index.html' ? '/' : '/' + d));

writeFileSync(join(OUT, 'precache.json'), JSON.stringify({ version, kennung, dateien: pfade }, null, 1));

function einsetzen(text, name, wert) {
  const muster = new RegExp(`const ${name} = '[^']*';`);
  if (!muster.test(text)) throw new Error(`precache: Zeile „const ${name}“ in out/sw.js nicht gefunden`);
  return text.replace(muster, `const ${name} = '${wert}';`);
}
const sw = readFileSync(join(OUT, 'sw.js'), 'utf8');
writeFileSync(join(OUT, 'sw.js'), einsetzen(einsetzen(sw, 'VERSION', version), 'KENNUNG', kennung));

console.log(`precache: ${pfade.length} Dateien, Version ${version}, Kennung ${kennung}`);
