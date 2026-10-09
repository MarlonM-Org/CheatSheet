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
npm install          # kopiert auch den pdf.js-Worker nach public/ (mit Version im Namen)
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
  `out/` nach `out/precache.json` (ohne reine Fehlerseiten wie `404.html`,
  `_not-found*`) und setzt Version (Hash über Namen und Inhalt) und
  Build-Kennung in `out/sw.js` ein. Jeder Build ergibt so einen neuen Service
  Worker.
- Die Build-Kennung erzeugt `next.config.ts` einmal je Build: als Build-ID von
  Next und als `process.env.BUILD_KENNUNG` in der Seite. `precache.mjs` liest
  sie aus `.next/BUILD_ID` und bricht ab, wenn sie nicht im Code der Seite
  steckt.
- `public/sw.js` legt beim Installieren alle Dateien aus `precache.json` in
  einen versionierten Cache — alle oder keine: Fehlt eine oder gehört die
  Liste zu einem anderen Stand als `sw.js`, scheitert die Installation, die
  alte Version bleibt aktiv und der Browser versucht es später erneut. Ein
  dabei neu angelegter Cache wird wieder gelöscht, ein schon vorhandener
  (Rollback auf einen früheren Deploy) bleibt. Erst ein vollständiger Stand
  bekommt den Marker `/__fertig` mit Zeitpunkt.
- Beim Aktivieren fliegen Caches ohne Marker raus; von den übrigen bleiben der
  neue und der mit dem jüngsten Marker, damit eine noch offene alte Seite ihre
  Code-Stücke findet.
- Seitenaufrufe kommen zuerst aus dem Netz, nach spätestens 3 s aus dem Cache
  (schlechtes Netz im Proberaum). Seiten und Seitendaten werden nie zur
  Laufzeit gecacht, nur aus dem Vorab-Cache ihres Stands geliefert — sonst
  läge HTML eines neuen Deploys ohne seine Code-Stücke im alten Cache. Alles
  andere kommt zuerst aus dem Cache (über alle behaltenen Stände). Fremde
  Adressen werden nie gecacht.
- „Neue Version da — neu laden“ erscheint nur, wenn der steuernde Service
  Worker eine andere Build-Kennung meldet als die Seite (Frage per
  `postMessage({ frage: 'version' })`) — nicht, wenn die Seite schon frisch
  aus dem Netz den neuen Stand hat. Neu geladen wird nur auf Tipp, nie
  automatisch. Fehlt einer alten Seite trotzdem ein Code-Stück, meldet sie
  „Neue Version verfügbar — bitte neu laden“ statt eines technischen Fehlers.
- Kommt die App zurück in den Vordergrund, schaut sie höchstens alle 6 h nach
  einer neuen Version (Home-Bildschirm-Apps bleiben oft tagelang offen).
- Der pdf.js-Worker heißt `pdf.worker-<pdf.js-Version>.min.mjs`
  (`scripts/pdf-worker.mjs` legt ihn ab, `next.config.ts` gibt den Namen an
  `src/components/ueben/pdf.ts`). Nicht eingecheckt.
- Angemeldet wird der Service Worker nur im Produktions-Build
  (`src/components/Offline.tsx`), nicht bei `npm run dev`.

## Sicherheits-Header

`vercel.json` setzt `X-Content-Type-Options: nosniff`, `Referrer-Policy:
no-referrer` und `Permissions-Policy: microphone=(self), camera=(),
geolocation=()` (Mikrofon nur fürs Stimmgerät); `/sw.js` kommt mit
`Cache-Control: no-cache`, damit Updates sofort ankommen.

**Offene Frage: Content-Security-Policy.** Bewusst noch keine. Next.js
schreibt Inline-Skripte in die exportierten Seiten, pdf.js braucht seinen
Worker und erzeugt Schriften zur Laufzeit; eine zu strenge CSP legt im
schlimmsten Fall den Notenbetrachter still — und das erst auf dem Gerät.
Vor einer CSP: Inline-Skripte per Hash erfassen (oder `script-src 'self'
'unsafe-inline'`), `worker-src 'self'`, im Browser mit echten Noten prüfen.

Lokal prüfen: `npm run build`, dann `python3 -m http.server 3470 --directory out`.

## Sicherung (.uebe)

Unter **Noten → Sicherung**:

- **Sicherung vorbereiten** packt eine Datei `Uebe-Sicherung JJJJ-MM-TT.uebe`:
  alle Noten-PDFs, markierten Stellen mit Tempo-Verlauf und Anmerkungen
  dieses Geräts. Noten, deren PDF sich nicht lesen lässt („%PDF-“ nicht in den
  ersten 1024 Bytes), bleiben samt Stellen und Anmerkungen draußen und werden
  mit Titel gemeldet. Danach erscheinen ein echter Link „Herunterladen (x MB)“
  und — wo der Browser Dateien teilen kann (iPhone/iPad) — „Teilen / In
  Dateien sichern“. Zweistufig, weil Safari Download und Teilen nur aus einer
  frischen Berührung zulässt; als Home-Bildschirm-App steht Teilen vorn.
- **Sicherung laden** liest die Datei erst vollständig und prüft sie (jede
  Note mit Titel, Stimme und Datum; jede Stelle und Anmerkung einer Note
  zugeordnet — verwaiste werden übersprungen und gezählt). Laden führt
  zusammen: Bei gleicher id gewinnt die Sicherung, Stellen und Anmerkungen,
  die es nur auf dem Gerät gibt, bleiben. Würde etwas überschrieben, fragt die
  App vorher und nennt Noten, Stellen und Seiten mit Anmerkungen samt Datum der
  Sicherung; bei „Abbrechen“ bleibt alles, wie es war. Geschrieben wird in
  einer einzigen Transaktion — alles oder nichts. Zweimal laden verdoppelt
  nichts. Danach: „X Noten neu, Y aktualisiert; Z Stellen, K Seiten mit
  Anmerkungen“. Bei falscher Datei sagt die App, wo die .uebe-Datei liegt.
- Ist der Gerätespeicher blockiert (ein anderes CheatSheet-Fenster hält noch
  eine alte Version offen), sagt die App das, statt still zu hängen.

Das Format steht in `src/domain/sicherung.ts` und ist der Vertrag mit der
Registerführer-App — dort wird mit demselben Code gespeichert.

**Umzug aus der Registerführer-App:** dort auf der Übe-Seite „Sicherung
vorbereiten“ und herunterladen, hier unter Noten „Sicherung laden“ — bei leerer Liste steht der
Knopf direkt in der Hinweis-Karte. Wer zum ersten Mal kommt (kein gemerkter
Reiter) oder über `?reiter=noten` bzw. `#noten` kommt, startet gleich bei den
Noten; der Parameter verschwindet danach aus der Adresse. Danach dieselben
Noten, Stellen, Tempi und Anmerkungen. Auf jedem Gerät einzeln: Safari-Tab und
Home-Bildschirm-App haben getrennte Speicher. Einstellungen wie Metronom-Tempo
oder Klang kommen nicht mit (die liegen im `localStorage`, je Adresse
getrennt).

**Gegen Datenverlust:** Safari kann Gerätedaten einer Website löschen, die
lange nicht geöffnet wurde (als Home-Bildschirm-App seltener). Beim ersten
Hinzufügen oder Laden bittet die App den Browser still um dauerhaften Speicher
(`navigator.storage.persist`). Trotzdem gelegentlich eine Sicherung speichern.
