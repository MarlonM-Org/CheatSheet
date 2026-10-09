# CheatSheet

Noten, schwierige Stellen, Metronom und Stimmgerät — alles auf deinem Gerät.
Eine eigene, statische Web-App unter https://cheat-sheet.ma-und-ma.de.
Früher unter Admin → „Üben (Prototyp)“ in der Registerführer-App.

- **Repo:** `MarlonM-Org/CheatSheet`, öffentlich. Deshalb nie Secrets, Tokens
  oder echte Noten einchecken.
- **Anforderungen und Entscheidungen:** `apps/cheatsheet/` in
  `MarlonM-Org/app-factory`.
- Die Icons (Viertelnote) sind vorläufig, ein eigenes Logo kommt später.

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
`VERCEL_TOKEN`. Das Vercel-Projekt heißt `cheat-sheet` und wird beim ersten Lauf
angelegt; die eigene Domain danach in Vercel unter Project → Settings → Domains
eintragen und beim DNS-Anbieter den angezeigten CNAME setzen. Die Adresse steht
im Code nur in `src/adresse.ts` (und als Link zum Umzug in der
Registerführer-App, `src/components/ueben/umzug.ts`). Die Vercel-CLI ist im
Workflow fest auf eine Version gesetzt.

## Datenhaltung

Kein Login, kein Konto, kein Server: Noten-PDFs, markierte Stellen, Tempi und
Anmerkungen liegen nur im Browser dieses Geräts (IndexedDB `ueben` — der
Name bleibt aus der Übe-App, damit Sicherungen und Schema passen).
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

## Sicherung (.uebe)

Unter **Noten → Sicherung**:

- **Sicherung speichern** lädt eine Datei `Uebe-Sicherung JJJJ-MM-TT.uebe`
  herunter: alle Noten-PDFs, markierten Stellen mit Tempo-Verlauf und
  Anmerkungen dieses Geräts. Wo der Browser Dateien teilen kann (iPhone/iPad),
  kommt danach zusätzlich „Teilen …“ (AirDrop, Mail, „In Dateien sichern“).
- **Sicherung laden** liest die Datei erst vollständig und prüft sie; erst dann
  wird alles in einem Schritt gespeichert. Gleiche Einträge (gleiche id) werden
  ersetzt, alle anderen bleiben. Zweimal laden verdoppelt nichts.

Das Format steht in `src/domain/sicherung.ts` und ist der Vertrag mit der
Registerführer-App — dort wird mit demselben Code gespeichert.

**Umzug aus der Registerführer-App:** dort unter Admin → Üben „Sicherung
speichern“, hier unter Noten „Sicherung laden“. Danach dieselben Noten, Stellen,
Tempi und Anmerkungen. Einstellungen wie Metronom-Tempo oder Klang kommen nicht
mit (die liegen im `localStorage`, je Adresse getrennt).

**Gegen Datenverlust:** Safari kann Gerätedaten einer Website löschen, die
lange nicht geöffnet wurde (als Home-Bildschirm-App seltener). Beim ersten
Hinzufügen oder Laden bittet die App den Browser still um dauerhaften Speicher
(`navigator.storage.persist`). Trotzdem gelegentlich eine Sicherung speichern.
