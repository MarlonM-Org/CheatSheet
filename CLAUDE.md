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
- Alle Daten liegen nur auf dem Gerät (IndexedDB `ueben`, Version 3, Stores
  `noten`/`stellen`/`anmerkungen` wie in der Registerführer-App, dazu
  `dateien`: die PDFs als reine Bytes, getrennt von den Noten). Der Name
  `ueben` bleibt trotz Umbenennung (Vertrag). Schema nur per Versionssprung
  ändern, nie Daten verwerfen.
- Das Sicherungsformat `.uebe` (`src/domain/sicherung.ts`) ist der Vertrag mit
  `registerfuehrer`: Dateien von dort müssen hier ladbar bleiben. Nicht
  ändern; eine neue Version nur mit Lesen der alten. Einzige Ergänzungen (weiter
  Version 1, wer sie nicht kennt, überliest sie): optionale Kopf-Felder
  `geloescht` (Grabsteine), `tags` (Tag-Definitionen, sonst im localStorage
  `ueben:tags`; optional `auch` = weitere ids desselben Tags), `tonprofile`
  (Tonprofil-Messungen, sonst `ueben:tonprofile`) und `einstellungen`
  (`{stand, werte}`: persönliche Einstellungen; Liste und Regeln in
  `src/domain/einstellungen.ts`). Neuer localStorage-Schlüssel: dort
  entscheiden, ob er mitreist (Person/Instrument ja, Gerät nein), und über
  `speichern()` aus `klang.ts` schreiben, sonst rückt der Stand nicht vor. Zusätzliche Felder an Noten/Stellen/Seiten (`sammlungen`,
  `tags`, `geaendert`, `entfernt`, `groesse`, `ausschnitte`, `spruenge`) reisen ohnehin mit.
- Fachlogik rein und getestet in `src/domain/` — neue Regeln dort zuerst als Test.
- Die Adresse steht nur in `src/adresse.ts`.
- Offline: `public/sw.js` + `scripts/precache.mjs`. Neue statische Dateien
  landen automatisch im Vorab-Cache. Der pdf.js-Worker liegt versioniert in
  `public/pdf.worker-<version>.min.mjs`, die Bild-Decoder (JBIG2, JPEG 2000;
  ohne sie bleiben solche Scans leer) in `public/pdfjs-<version>/` — beides
  erzeugt von `scripts/pdf-worker.mjs`, nicht eingecheckt.
- PDF-Dateien nie als Blob in IndexedDB schreiben (Safari verliert sie
  mitunter) — Bytes in `dateien`, Datensätze ohne Blob (`lokal.ts`). Ältere
  Stücke tragen noch einen Blob in `noten` und ziehen beim Lesen um.
  Öffnen schreibt nichts in die Datenbank.
- Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
- Deutsch in Oberfläche, Code-Bezeichnern und Commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
