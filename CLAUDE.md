# CheatSheet

Übe-Werkzeug: Noten, schwierige Stellen, Metronom, Stimmgerät. Repo
`MarlonM-Org/CheatSheet` (öffentlich — keine Secrets, keine privaten Daten
einchecken), Adresse https://cheat-sheet.ma-und-ma.de, Vercel-Projekt
`cheat-sheet`. **Die Anforderungen stehen in `ROADMAP.md`** in diesem Repo —
das ist die einzige Anforderungsliste. Was dort steht, gilt; was im Code
anders ist, ist ein Fehler oder gehört dort nachgetragen.

- Statische App (`output: 'export'`): kein Server-Code, keine API-Routen, keine
  Server Actions, kein Login, keine Datenbank. Wer etwas davon braucht, klärt
  das zuerst in den Anforderungen.
- Alle Daten liegen nur auf dem Gerät: IndexedDB `cheatsheet`, Version 1,
  Schema und Beziehungen in `docs/datenmodell.md` (Typen und Regeln in
  `src/domain/bestand.ts`). Schema nur per Versionssprung mit Migrationstest
  ändern, nie Daten verwerfen. Die Vorgängerin `ueben` (bis Schema 3) wird nie
  geändert, nie umgebaut, nie gelöscht. Gelesen wird sie nur für
  „Übernehmen“ (`vorgaengerPruefen`: ohne Versionsangabe, `readonly`) und nur,
  wenn `indexedDB.databases()` sie nennt — ein blindes Öffnen legte sie an.
- Das Sicherungsformat `.uebe` (`src/domain/sicherung.ts`) ist der Vertrag mit
  `registerfuehrer`: Dateien von dort müssen hier ladbar bleiben. Version 1;
  `noten`/`stellen`/`anmerkungen` im Registerführer-Zuschnitt (`notenId`).
  Einzige Ergänzungen (weiter Version 1, wer sie nicht kennt, überliest sie):
  optionale Kopf-Felder `geloescht` (Grabsteine), `tags` (Tag-Definitionen,
  sonst im localStorage `ueben:tags`), `tonprofile` (sonst
  `ueben:tonprofile`) und, im Zuschnitt des Geräts (`stueckId`), `virtuelle`,
  `lesezeichen`, `merker`, `setlisten`. Zusätzliche Felder an
  Noten/Stellen/Seiten (`sammlungen`, `tags`, `geaendert`, `entfernt`,
  `groesse`, `ausschnitte`, Metadaten) reisen ohnehin mit. Nicht weiter
  ändern; eine neue Version nur mit Lesen der alten.
- Fachlogik rein und getestet in `src/domain/` — neue Regeln dort zuerst als Test.
- Die Adresse steht nur in `src/adresse.ts`.
- Offline: `public/sw.js` + `scripts/precache.mjs`. Neue statische Dateien
  landen automatisch im Vorab-Cache. Der pdf.js-Worker liegt versioniert in
  `public/pdf.worker-<version>.min.mjs`, die Bild-Decoder (JBIG2, JPEG 2000;
  ohne sie bleiben solche Scans leer) in `public/pdfjs-<version>/` — beides
  erzeugt von `scripts/pdf-worker.mjs`, nicht eingecheckt.
- PDF-Dateien nie als Blob in IndexedDB schreiben (Safari verliert sie
  mitunter) — Bytes in `dateien`, Datensätze ohne Blob (`lokal.ts`).
  Öffnen schreibt nichts in die Datenbank.
- Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
- Deutsch in Oberfläche, Code-Bezeichnern und Commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
