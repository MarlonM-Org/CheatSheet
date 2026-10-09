# Übe-App

Metronom, Stimmgerät und Notenpult zum Üben — als eigene, statische Web-App.
Früher unter Admin → „Üben (Prototyp)“ in der Registerführer-App.

**Anforderungen und Entscheidungen:** `apps/uebe-app/` in
`MarlonM-Org/app-factory`.

## Was sie kann

- **Metronom** mit Taktarten, Betonungen, Unterteilungen und Tempo-Trainer;
  eine Mini-Leiste läuft im Notenbetrachter weiter.
- **Stimmgerät** (YIN-Tonerkennung über das Mikrofon) und Referenztöne.
- **Noten:** PDF-Dateien hinzufügen, im Vollbild lesen, blättern (ganz, halb,
  eigene Linie), mit Stift, Marker und Text anmerken, Stellen markieren und
  Stelle für Stelle mit Tempo-Verlauf üben.

## Entwickeln

```
npm install          # kopiert auch den pdf.js-Worker nach public/
npm test
npm run typecheck && npm run lint && npm run build
npm run dev
```

`npm run build` erzeugt die fertige App in `out/` (nur statische Dateien).

## Deploy

Vercel Hobby, über die Vercel-CLI aus GitHub Actions (`.github/workflows/vercel.yml`),
weil die Git-Anbindung von Vercel für Repos einer GitHub-Organisation Pro
verlangt. Läuft, wenn CI auf `main` grün ist. Einmalig nötig: Repo-Secret
`VERCEL_TOKEN`. Das Vercel-Projekt heißt `uebe-app` und wird beim ersten Lauf
angelegt; die eigene Domain danach in Vercel unter Project → Settings → Domains
eintragen und beim DNS-Anbieter den angezeigten CNAME setzen. Die Adresse steht
im Code nur in `src/adresse.ts`.

## Datenhaltung

Kein Login, kein Konto, kein Server: Noten-PDFs, markierte Stellen, Tempi und
Anmerkungen liegen nur im Browser dieses Geräts (IndexedDB `ueben`).
Einstellungen wie Tempo und Reiter liegen im `localStorage`. Beides ist je
Adresse getrennt — eine andere Adresse sieht diese Daten nicht.

## Home-Bildschirm und offline

Die App lässt sich zum Home-Bildschirm hinzufügen (`src/app/manifest.ts`,
Icons in `public/`). Nach einem Besuch mit Netz läuft sie auch ohne Netz,
samt Notenbetrachter:

- `scripts/precache.mjs` läuft nach `next build`, schreibt alle Dateien aus
  `out/` nach `out/precache.json` und setzt eine Version (Hash über Namen und
  Inhalt) in `out/sw.js` ein. Jeder Build ergibt so einen neuen Service Worker.
- `public/sw.js` legt beim Installieren alle Dateien in einen versionierten
  Cache und räumt alte Caches beim Aktivieren weg. Seitenaufrufe kommen zuerst
  aus dem Netz (online immer der neueste Stand), alles andere zuerst aus dem
  Cache. Fremde Adressen werden nie gecacht.
- Angemeldet wird der Service Worker nur im Produktions-Build
  (`src/components/Offline.tsx`), nicht bei `npm run dev`.

Lokal prüfen: `npm run build`, dann `python3 -m http.server 3470 --directory out`.
