# CheatSheet

Noten, schwierige Stellen, Metronom und Stimmgerät in einer Web-App.

**https://cheat-sheet.ma-und-ma.de**

Kein Konto, kein Server: Deine Noten und Daten bleiben auf deinem Gerät. Die
App läuft im Browser, lässt sich zum Home-Bildschirm hinzufügen und
funktioniert danach auch offline.

## Funktionen

- **Noten:** PDFs hinzufügen (auch ganze Ordner), im Vollbild lesen, mit
  Stift, Marker und Text anmerken.
- **Blättern:** ganze oder halbe Seiten oder ab einer eigenen Linie — für
  alle Seiten gleich oder je Seite anders; per Wischen, Blätterpedal, Mausrad
  oder Bluetooth-Scroll-Ring. Je Seite ein Ausschnitt (z. B. ohne breite
  Ränder); die Leisten verschwinden mit einem Tipp in die Mitte.
- **Sprünge:** Wiederholung, D.S., D.C. und Coda als Marken; Weiterblättern
  folgt ihnen in der Reihenfolge der Liste (umstellbar), zurück geht
  denselben Weg.
- **Schwierige Stellen:** markieren, gezielt üben, Zieltempo setzen und den
  Fortschritt verfolgen. Der Stellen-Mix übt Stellen aus mehreren Stücken
  gemischt.
- **Ordnen:** Sammlungen und farbige Tags; Halten oder „⋯“ öffnet zu jedem
  Stück, jeder Sammlung, Stelle und jedem Lesezeichen ein Blatt mit allen
  Aktionen. Lesezeichen benennen Seiten (auch
  aus dem Inhaltsverzeichnis der PDF); ein Seitenbereich eines Sammelbands
  wird auf Wunsch ein eigenes Stück.
- **Einscannen:** Papiernoten mit der Kamera aufnehmen oder vorhandene Fotos
  wählen — Blattrand finden, entzerren, Schatten herausrechnen, als PDF in
  die Bibliothek.
- **Metronom:** Taktarten, Betonungen, Unterteilungen, Tempo-Trainer.
- **Stimmgerät:** über das Mikrofon, mit Referenztönen. Das Tonprofil zeigt,
  welche Töne auf deinem Instrument zu hoch oder zu tief liegen.
- **Sicherung:** alles in eine `.uebe`-Datei packen und auf einem anderen
  Gerät laden (Einstellungen → Daten übertragen). Stimmung, Metronom und
  Stiftfarben reisen mit, Hell/Dunkel bleibt je Gerät.

## Deine Daten

Alles liegt nur im Browser des Geräts. Safari-Tab und Home-Bildschirm-App
haben getrennte Speicher, und Browser können Daten von Websites löschen, die
lange nicht geöffnet wurden. Deshalb ab und zu eine Sicherung speichern — die
App erinnert daran.

**Noten aus der Vorgängerversion:** Seit Oktober 2026 hat die App einen
eigenen, neuen Speicher. Die Noten aus dem alten liegen weiter auf dem Gerät;
„Übernehmen“ (in der leeren Bibliothek oder unter Einstellungen → Daten
übertragen) holt sie samt Stellen und Anmerkungen herüber. Der alte Speicher
bleibt dabei unangetastet.

## Entwickeln

```
npm install
npm run dev
```

Vor jedem Push: `npm run typecheck && npm run lint && npm test && npm run build`.
`npm run build` legt die fertige, statische App in `out/` ab.

- Anforderungen und Planung: [ROADMAP.md](ROADMAP.md)
- Technik (Deploy, Offline, Sicherung): [docs/technik.md](docs/technik.md)
- Datenmodell (Gerätespeicher, Sicherungsformat): [docs/datenmodell.md](docs/datenmodell.md)
