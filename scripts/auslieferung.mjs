// Prüft die ausgelieferte App: Passt alles, was der Service Worker beim
// Installieren holt, zu genau diesem Stand? Fehlt eine Datei oder kommt sie
// aus einem anderen Stand, scheitert jede Installation — und die App ginge
// offline nicht. Aufruf: node scripts/auslieferung.mjs [adresse]
const ADRESSE = (process.argv[2] || 'https://cheat-sheet.ma-und-ma.de').replace(/\/$/, '');
const fehler = [];
const holen = async (pfad) => {
  const antwort = await fetch(ADRESSE + pfad, { cache: 'no-store', redirect: 'manual' });
  return { antwort, text: antwort.ok ? await antwort.text() : '' };
};

const sw = await holen('/sw.js');
if (!sw.antwort.ok) throw new Error(`/sw.js: ${sw.antwort.status}`);
const wert = (name) => sw.text.match(new RegExp(`const ${name} = '([^']*)';`))?.[1];
const version = wert('VERSION');
const kennung = wert('KENNUNG');
if (!version || version === 'entwicklung') fehler.push(`sw.js ohne eingesetzte Version (${version})`);
if (!/no-cache/.test(sw.antwort.headers.get('cache-control') ?? '')) fehler.push(`sw.js Cache-Control: ${sw.antwort.headers.get('cache-control')}`);

const liste = await holen('/precache.json');
if (!liste.antwort.ok) throw new Error(`/precache.json: ${liste.antwort.status}`);
const { version: listenVersion, dateien } = JSON.parse(liste.text);
if (listenVersion !== version) fehler.push(`precache.json gehört zu ${listenVersion}, sw.js zu ${version}`);

// Derselbe Filter wie in public/sw.js (kennungPruefen).
const seitendaten = (pfad) => pfad === '/' || pfad === '/index.txt' || /\/__next\.[^/]*\.txt$/.test(pfad);
for (const pfad of dateien) {
  const { antwort, text } = await holen(pfad);
  if (!antwort.ok) { fehler.push(`${pfad}: ${antwort.status}`); continue; }
  if (seitendaten(pfad) && !text.includes(kennung)) fehler.push(`${pfad} ohne Kennung ${kennung}`);
}

const start = await holen('/');
const erlaubt = start.antwort.headers.get('permissions-policy') ?? '';
if (!erlaubt.includes('microphone=(self)')) fehler.push(`Permissions-Policy ohne Mikrofon: „${erlaubt}“`);

console.log(`${ADRESSE}: ${dateien.length} Dateien, Version ${version}, Kennung ${kennung}`);
if (fehler.length) {
  for (const f of fehler) console.error('FEHLT: ' + f);
  process.exit(1);
}
console.log('Alles da, alles aus demselben Stand.');
