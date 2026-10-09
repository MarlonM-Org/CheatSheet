# Übe-App

Persönliches Übe-Werkzeug: Metronom, Stimmgerät, Notenpult. **Die Anforderungen
liegen nicht hier**, sondern in `MarlonM-Org/app-factory` unter
`apps/uebe-app/`. Was dort steht, gilt; was hier im Code anders ist, ist ein
Fehler oder gehört dort nachgetragen.

- Statische App (`output: 'export'`): kein Server-Code, keine API-Routen, keine
  Server Actions, kein Login, keine Datenbank. Wer etwas davon braucht, klärt
  das zuerst in den Anforderungen.
- Alle Daten liegen nur auf dem Gerät (IndexedDB `ueben`, Version 2, Stores
  `noten`/`stellen`/`anmerkungen` — Schema wie in der Registerführer-App).
  Schema nur per Versionssprung ändern, nie Daten verwerfen.
- Das Sicherungsformat `.uebe` (`src/domain/sicherung.ts`) ist der Vertrag mit
  `registerfuehrer`: Dateien von dort müssen hier ladbar bleiben. Nicht
  ändern; eine neue Version nur mit Lesen der alten.
- Fachlogik rein und getestet in `src/domain/` — neue Regeln dort zuerst als Test.
- Die Adresse steht nur in `src/adresse.ts`.
- Offline: `public/sw.js` + `scripts/precache.mjs`. Neue statische Dateien
  landen automatisch im Vorab-Cache.
- Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
- Deutsch in Oberfläche, Code-Bezeichnern und Commits.
