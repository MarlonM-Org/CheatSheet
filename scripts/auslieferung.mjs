// Prüft die ausgelieferte App: Passt alles, was der Service Worker beim
// Installieren holt, zu genau diesem Stand? Fehlt eine Datei oder kommt sie
// aus einem anderen Stand, scheitert jede Installation — und die App ginge
// offline nicht. Aufruf: node scripts/auslieferung.mjs [adresse]
const ADRESSE = (process.argv[2] || 'https://cheat-sheet.ma-und-ma.de').replace(/\/$/, '');
const fehler = [];
const holen = async (pfad) => {
  const antwort = await fetch(ADRESSE + pfad, { cache: 'no-store', redirect: 'manual' });
  return { antwort, text: await antwort.text() };
};
const kopf = (a, name) => a.headers.get(name) ?? '–';

const sw = await holen('/sw.js');
console.log(`/sw.js: ${sw.antwort.status}, server ${kopf(sw.antwort, 'server')}, cache-control ${kopf(sw.antwort, 'cache-control')}`);
const wert = (name) => sw.text.match(new RegExp(`const ${name} = '([^']*)';`))?.[1];
const version = wert('VERSION');
const kennung = wert('KENNUNG');
console.log(`sw.js: VERSION ${version}, KENNUNG ${kennung}`);
if (!sw.antwort.ok) fehler.push(`/sw.js: ${sw.antwort.status}`);
if (!version || version === 'entwicklung') fehler.push(`sw.js ohne eingesetzte Version (${version}) — scripts/precache.mjs ist nicht in der Auslieferung angekommen`);
if (!/no-cache/.test(sw.antwort.headers.get('cache-control') ?? '')) fehler.push(`sw.js Cache-Control: ${kopf(sw.antwort, 'cache-control')}`);

const liste = await holen('/precache.json');
let dateien = [];
if (!liste.antwort.ok) fehler.push(`/precache.json: ${liste.antwort.status}`);
else {
  const inhalt = JSON.parse(liste.text);
  dateien = inhalt.dateien;
  if (inhalt.version !== version) fehler.push(`precache.json gehört zu ${inhalt.version}, sw.js zu ${version}`);
}

// Derselbe Filter wie in public/sw.js (kennungPruefen).
const seitendaten = (pfad) => pfad === '/' || pfad === '/index.txt' || /\/__next\.[^/]*\.txt$/.test(pfad);
for (const pfad of dateien) {
  const { antwort, text } = await holen(pfad);
  if (!antwort.ok) { fehler.push(`${pfad}: ${antwort.status}`); continue; }
  if (seitendaten(pfad) && !text.includes(kennung)) fehler.push(`${pfad} ohne Kennung ${kennung}`);
  // Module (auch der pdf.js-Worker) lädt der Browser nur mit JavaScript-Typ.
  if (/\.m?js$/.test(pfad) && !/javascript/.test(kopf(antwort, 'content-type'))) fehler.push(`${pfad}: content-type ${kopf(antwort, 'content-type')}`);
}

const start = await holen('/');
console.log(`/: ${start.antwort.status}, ${start.text.length} Zeichen, Kennung ${kennung && start.text.includes(kennung) ? 'drin' : 'fehlt'}`);
const erlaubt = start.antwort.headers.get('permissions-policy') ?? '';
if (!erlaubt.includes('microphone=(self)')) fehler.push(`Permissions-Policy ohne Mikrofon: „${erlaubt}“`);

console.log(`${ADRESSE}: ${dateien.length} Dateien geprüft`);
if (fehler.length) {
  for (const f of fehler) console.error('FEHLT: ' + f);
  process.exit(1);
}
console.log('Alles da, alles aus demselben Stand.');
