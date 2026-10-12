# CheatSheet

Noten, schwierige Stellen, Metronom und Stimmgerät. Alles auf deinem Gerät.
Eine eigene, statische Web-App unter https://cheat-sheet.ma-und-ma.de.
Früher unter Admin → „Üben (Prototyp)“ in der Registerführer-App.

- **Repo:** `MarlonM-Org/CheatSheet`, öffentlich. Deshalb nie Secrets, Tokens
  oder echte Noten einchecken.
- **Roadmap, Backlog und Anforderungen:** [ROADMAP.md](ROADMAP.md) in diesem
  Repo — die einzige Anforderungsliste.
- Die Icons (Viertelnote) sind vorläufig, ein eigenes Logo kommt später.

## Was sie kann

- **Metronom** mit Taktarten, Betonungen, Unterteilungen und Tempo-Trainer;
  eine Mini-Leiste läuft im Notenbetrachter weiter.
- **Stimmgerät** (YIN-Tonerkennung über das Mikrofon) und Referenztöne.
- **Noten:** PDF-Dateien hinzufügen, im Vollbild lesen, blättern (ganz, halb,
  eigene Linie), mit Stift, Marker und Text anmerken, Stellen markieren und
  Stelle für Stelle mit Tempo-Verlauf üben — das Metronom springt dabei auf
  das zuletzt geschaffte Tempo der Stelle.
- **Stellen-Mix:** markierte Stellen aus allen Stücken bunt gemischt üben,
  Runde für Runde jede genau einmal.

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

`vercel.json` setzt `"framework": null` und `"outputDirectory": "out"`: Vercel
liefert genau den Ordner `out/` aus, wie er lokal entsteht. Mit der
automatisch erkannten Next.js-Voreinstellung baut Vercel mit eigenem Builder,
und was `scripts/precache.mjs` nach `next build` in `out/` schreibt
(`precache.json`, Version und Kennung in `sw.js`), käme nie an — so geschehen
beim ersten Deploy.

Nach jedem Deploy prüft `.github/workflows/auslieferung.yml` die echte Domain
(`scripts/auslieferung.mjs`): `sw.js` mit eingesetzter Version, jede Datei aus
`precache.json` erreichbar und aus demselben Stand, Module mit JavaScript-Typ,
Header aus `vercel.json`. Die `*.vercel.app`-Adressen sind per Vercel-Anmeldung
geschützt und lassen sich so nicht prüfen.

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
  Next und als `process.env.__CHEATSHEET_BUILD_KENNUNG` in der Seite (per
  `compiler.define`). Die Variable gilt nur innerhalb desselben Builds — von
  außen gesetzt wird sie nicht übernommen, sonst hätten alle Builds dieselbe
  Kennung. `precache.mjs` liest sie aus `.next/BUILD_ID` und bricht ab, wenn
  sie nicht im Code der Seite, in `index.html` oder in den Seitendaten
  (`.txt`) steckt.
- `public/sw.js` legt beim Installieren alle Dateien aus `precache.json` in
  einen versionierten Cache — alle oder keine: Fehlt eine oder gehört die
  Liste zu einem anderen Stand als `sw.js`, scheitert die Installation, die
  alte Version bleibt aktiv und der Browser versucht es später erneut. Ein
  dabei neu angelegter Cache wird wieder gelöscht, ein schon vorhandener
  (Rollback auf einen früheren Deploy) bleibt. Vor dem Marker liest der
  Service Worker `/` und alle gelisteten `.txt` aus dem neuen Cache und prüft,
  dass seine Kennung darin steht; kam unterwegs ein anderer Stand an, scheitert
  die Installation genauso. Erst ein vollständiger, geprüfter Stand bekommt den
  Marker `/__fertig` mit Zeitpunkt.
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
  automatisch. Nach einem Wechsel des Service Workers ruft die Seite erst
  selbst `registration.update()` auf und meldet sich nur, wenn danach kein
  weiterer Stand mehr installiert wird oder wartet und die Kennungen
  abweichen. Fehlt einer alten Seite trotzdem ein Code-Stück, meldet sie
  „Neue Version verfügbar — bitte neu laden“ statt eines technischen Fehlers.
- **Grenze:** Behalten werden nur zwei Stände. Ist eine Seite über ZWEI
  Updates hinweg offen (alte Seite A, inzwischen B und C), ist ihr Cache
  weg; Code-Stücke, die sie noch nicht geladen hatte, fehlen ihr dann
  womöglich — offline sicher, online, sobald der Server nur noch den neuen
  Stand ausliefert. Sie zeigt dann „Neue Version verfügbar — bitte neu laden“; Neuladen holt
  den aktuellen Stand.
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
`Cache-Control: no-cache`, damit Updates sofort ankommen. Die Code-Stücke unter
`/_next/static/` tragen einen Inhalts-Hash im Namen und dürfen deshalb ein Jahr
lang unverändert im Browser bleiben (`immutable`).

**Offene Frage: Content-Security-Policy.** Bewusst noch keine. Next.js
schreibt Inline-Skripte in die exportierten Seiten, pdf.js braucht seinen
Worker und erzeugt Schriften zur Laufzeit; eine zu strenge CSP legt im
schlimmsten Fall den Notenbetrachter still — und das erst auf dem Gerät.
Vor einer CSP: Inline-Skripte per Hash erfassen (oder `script-src 'self'
'unsafe-inline'`), `worker-src 'self'`, im Browser mit echten Noten prüfen.

Lokal prüfen: `npm run build`, dann `python3 -m http.server 3470 --directory out`.

## Sicherung (.uebe)

Unter **Einstellungen (Zahnrad in der Bibliothek) → Daten übertragen** — um
den Stand auf ein anderes Gerät zu bringen oder als Schutz. Auf einem neuen,
leeren Gerät steht „Sicherung laden“ auch direkt in der Bibliothek.
Einstellungen (Tempo, Farbwelt …) reisen nicht mit.

- **Sicherung erstellen** packt eine Datei `Uebe-Sicherung JJJJ-MM-TT.uebe`:
  alle Noten-PDFs, markierten Stellen mit Tempo-Verlauf und Anmerkungen
  dieses Geräts. Jede PDF wird dafür einmal komplett gelesen (als Strom, ohne
  den Inhalt zu behalten) und die Bytes werden gegen die gespeicherte Größe
  gezählt. Noten, deren PDF sich nicht lesen lässt („%PDF-“ nicht in den
  ersten 1024 Bytes, Lesefehler oder zu wenige bzw. zu viele Bytes), bleiben
  samt Stellen und Anmerkungen draußen und werden mit Titel gemeldet. Danach
  erscheinen ein echter Link „Herunterladen (x MB)“ und — wo der Browser
  Dateien teilen kann (iPhone/iPad) — „Teilen / In Dateien sichern“. Zweistufig, weil Safari Download und Teilen nur aus einer
  frischen Berührung zulässt; als Home-Bildschirm-App steht Teilen vorn.
- **Sicherung laden** liest die Datei erst vollständig und prüft sie (jede
  Note mit Titel, Stimme und Datum; jede Stelle mit Seite ab 1, Rahmen und
  Tempo-Verlauf; jede Seite mit Anmerkungen mit Seite, Objekten und der id
  „notenId:seite“; alles einer Note zugeordnet — verwaiste werden übersprungen
  und gezählt). Laden führt ohne Verlust zusammen
  (`src/domain/einspielen.ts`): Was es nur auf dem Gerät gibt, bleibt. Bei
  gleicher id kommen Titel, Notizen, Zieltempo und Rahmen aus der Sicherung,
  aber Tempo-Verläufe werden vereinigt (jeder Eintrag einmal, nach Zeit
  sortiert) und Striche/Texte einer Seite nach ihrer id (bei gleicher id gilt
  die Sicherung). Bei Noten kommt auch die Datei aus der Sicherung, der
  Dateiverweis des Geräts bleibt. Die PDFs gehen dabei nie als Blob in die
  Datenbank (Safari verliert sie mitunter): erst einzeln als Bytes vorläufig
  in `dateien`, dann zieht die eine Transaktion sie an ihren Platz. Gibt es schon etwas davon auf dem Gerät,
  fragt die App vorher („Die Sicherung vom … aktualisiert auf diesem Gerät N
  Noten, M Stellen und K Seiten mit Anmerkungen …“); bei „Abbrechen“ bleibt
  alles, wie es war. Gelesen und geschrieben wird in einer einzigen
  readwrite-Transaktion — alles oder nichts, und nichts kann dazwischenfallen
  (vorläufige Reste eines abgebrochenen Laufs räumt der nächste weg).
  Zweimal laden verdoppelt nichts. Danach: „X Noten neu, Y aktualisiert; Z Stellen, K Seiten mit
  Anmerkungen“. Bei falscher Datei sagt die App, wo die .uebe-Datei liegt.
- Ist der Gerätespeicher blockiert (ein anderes CheatSheet-Fenster hält noch
  eine alte Version offen), sagt die App das, statt still zu hängen.
- Scheitert irgendein Speichern (Striche, Blätterlinie, Stellen, Tempi,
  Umbenennen, Hinzufügen, Löschen), erscheint oben über allem „Nicht
  gespeichert — Gerätespeicher voll oder blockiert. Bitte neu laden.“ mit dem
  Grund. Löschen mehrerer Noten sagt, wie weit es kam („X von Y gelöscht …“).
  Hat der Browser die Verbindung zum Gerätespeicher von selbst geschlossen
  (Safari), öffnet die App sie neu und versucht es einmal erneut.

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
