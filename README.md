# CheatSheet

Noten, schwierige Stellen, Metronom und Stimmgerät in einer Web-App.

**https://cheat-sheet.ma-und-ma.de**

Kein Konto, kein Server: Deine Noten und Daten bleiben auf deinem Gerät. Die
App läuft im Browser, lässt sich zum Home-Bildschirm hinzufügen und
funktioniert danach auch offline.

## Funktionen

- **Noten:** PDFs hinzufügen (auch ganze Ordner), im Vollbild lesen, mit
  Stift, Marker und Text anmerken.
- **Blättern:** ganze oder halbe Seiten, per Wischen, Blätterpedal, Mausrad
  oder Bluetooth-Scroll-Ring.
- **Schwierige Stellen:** markieren, gezielt üben, Zieltempo setzen und den
  Fortschritt verfolgen. Der Stellen-Mix übt Stellen aus mehreren Stücken
  gemischt.
- **Ordnen:** Sammlungen und farbige Tags.
- **Metronom:** Taktarten, Betonungen, Unterteilungen, Tempo-Trainer.
- **Stimmgerät:** über das Mikrofon, mit Referenztönen. Das Tonprofil zeigt,
  welche Töne auf deinem Instrument zu hoch oder zu tief liegen.
- **Sicherung:** alles in eine `.uebe`-Datei packen und auf einem anderen
  Gerät laden (Einstellungen → Daten übertragen).

## Deine Daten

Alles liegt nur im Browser des Geräts. Safari-Tab und Home-Bildschirm-App
haben getrennte Speicher, und Browser können Daten von Websites löschen, die
lange nicht geöffnet wurden. Deshalb ab und zu eine Sicherung speichern — die
App erinnert daran.

## Entwickeln

```
npm install
npm run dev
```

Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
`npm run build` legt die fertige, statische App in `out/` ab.

- Anforderungen und Planung: [ROADMAP.md](ROADMAP.md)
- Technik (Deploy, Offline, Sicherung): [docs/technik.md](docs/technik.md)
