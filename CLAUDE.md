# CheatSheet

Übe-Werkzeug: Noten, schwierige Stellen, Metronom, Stimmgerät. Repo
`MarlonM-Org/CheatSheet` (öffentlich — keine Secrets, keine privaten Daten
einchecken), Adresse https://cheat-sheet.ma-und-ma.de, Vercel-Projekt
`cheat-sheet`. **Die Anforderungen liegen nicht hier**, sondern in
`MarlonM-Org/app-factory` unter `apps/cheatsheet/`. Was dort steht, gilt; was
hier im Code anders ist, ist ein Fehler oder gehört dort nachgetragen.

- Statische App (`output: 'export'`): kein Server-Code, keine API-Routen, keine
  Server Actions, kein Login, keine Datenbank. Wer etwas davon braucht, klärt
  das zuerst in den Anforderungen.
- Alle Daten liegen nur auf dem Gerät (IndexedDB `ueben`, Version 2, Stores
  `noten`/`stellen`/`anmerkungen` — Schema wie in der Registerführer-App).
  Der Name `ueben` bleibt trotz Umbenennung (Vertrag). Schema nur per
  Versionssprung ändern, nie Daten verwerfen.
- Das Sicherungsformat `.uebe` (`src/domain/sicherung.ts`) ist der Vertrag mit
  `registerfuehrer`: Dateien von dort müssen hier ladbar bleiben. Nicht
  ändern; eine neue Version nur mit Lesen der alten.
- Fachlogik rein und getestet in `src/domain/` — neue Regeln dort zuerst als Test.
- Die Adresse steht nur in `src/adresse.ts`.
- Offline: `public/sw.js` + `scripts/precache.mjs`. Neue statische Dateien
  landen automatisch im Vorab-Cache. Der pdf.js-Worker liegt versioniert in
  `public/pdf.worker-<version>.min.mjs` (erzeugt, nicht eingecheckt).
- Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
- Deutsch in Oberfläche, Code-Bezeichnern und Commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
