# Roadmap & Backlog

Langfristige Planung für CheatSheet. Dieses Dokument ist die gemeinsame
Arbeitsgrundlage für alle Entwickler: Wer etwas anfängt, trägt sich hinter dem
Punkt ein; wer etwas fertigstellt, hakt ab und verschiebt den Punkt nach
„Erledigt“ (unten). Größere Richtungsentscheidungen bitte als kurzen Absatz
hier dokumentieren, nicht nur im Chat.

Stand: 2026-10-10.

## Leitbild

**Die Noten sind die App.** Alles andere (Metronom, Stimmgerät, Einstellungen)
sind Werkzeuge, die über den Noten schweben. Eine lokal laufende, statische
Web-App: alle Daten bleiben auf dem Gerät, kein Login, kein Server. Vorbild
für Notenmanagement und Übe-Komfort ist **forScore** (https://forscore.co) —
nicht in der Breite, aber in der Sorgfalt.

**Bewusst außen vor** (nicht bauen, auch nicht „mal eben“):

- MIDI, Audio-Begleitspuren, Soundbearbeitung
- Kollaboration/Mehrbenutzer, Cloud-Sync (iCloud o. Ä.)
- Server-Code, Konten, Datenbanken außerhalb des Geräts

## Meilensteine (Reihenfolge)

| # | Meilenstein | Inhalt | Backlog-Punkte |
|---|---|---|---|
| M1 | **Fundament aufräumen** | Sicherung raus, Datenmodell klären, Tests für die Speicherschicht | A-01…A-03 |
| M2 | **Noten im Zentrum** | UI-Neuaufbau: Noten vollflächig, Werkzeuge als Overlays, drei Knöpfe unten | B-01…B-03 |
| M3 | **Werkzeuge schärfen** | Stimmgerät- und Metronom-Verbesserungen, Stift-Ausbau | C-01…C-03, D-01, E-01…E-03 |
| M4 | **Notenmanagement I** | Metadaten, Bookmarks, Flags, Kontextmenüs, Drag & Drop | F-01, F-03, F-04, F-08, F-09 |
| M5 | **Üben & Setlisten** | Setlisten, Wiederholungs-Links, Halbseiten-Blättern, Intonations-Trainer | F-02, F-05, F-06, C-04 |
| M6 | **Design & Extras** | Themes, Stempel/Formen, Kamera-Scan | B-04, B-05, E-04, F-07 |

**Quick Wins** (klein, unabhängig, jederzeit zwischenschieben — guter
Einstieg): C-01, C-02, C-03, D-01.

M2 setzt Designvorschläge voraus (siehe B-05) — erst Richtung festlegen, dann
umbauen.

---

## A — Fundament & Datenmodell

### A-01 · Sicherung (.uebe) komplett entfernen

Das Sicherungs-/Lade-Feature war nur für den Umzug aus der Registerführer-App
da; der Umzug ist abgeschlossen, es gab genau einen Nutzer. Es fliegt
ersatzlos raus — damit entfällt auch der bisherige Format-Vertrag mit
`registerfuehrer`.

Entfernungsfläche (vollständig):

- Ganze Dateien: `src/domain/sicherung.ts`, `src/domain/einspielen.ts`,
  `src/domain/lesbar.ts`, `src/components/ueben/Sicherung.tsx`,
  `tests/sicherung.test.ts`, `tests/einspielen.test.ts`, `tests/lesbar.test.ts`
- `src/components/ueben/lokal.ts`: Abschnitt „Übe-Sicherung“ (ca. Z. 182–269)
  samt Imports aus `@/domain/einspielen|lesbar|sicherung`. **Achtung:** `ALLE`
  und `dauerhaftAnfragen()` werden auch von `notenAnlegen`/`notenLoeschen`
  gebraucht — die bleiben.
- `src/components/ueben/UebeZentrale.tsx`: Import und Hook
  `useSicherungLaden`, Sicherungs-Karte, „Sicherung laden“-Knopf im
  Leerzustand, Umzugs-Absätze. Die Deep-Link-Logik `?reiter=noten`/`#noten`
  existierte nur für den Umzug und kann mit weg.
- Doku: README-Abschnitt „Sicherung (.uebe)“, CLAUDE.md-Absatz zum
  `.uebe`-Vertrag.

### A-02 · Datenbank & Relationsmodell aufräumen

Ist-Zustand (alles in `src/components/ueben/lokal.ts`): IndexedDB `ueben`
Version 2, Stores `noten` (keyPath `id`), `stellen` (`notenId`-Index),
`anmerkungen` (ein Datensatz **pro Seite**, zusammengesetzter Schlüssel
`${notenId}:${seite}`, `notenId`-Index). Einstellungen verstreut in
localStorage (`ueben:*`, `metro:*`, `stimm:*`).

Aufgabe: Schema für das kommende Notenmanagement entwerfen (Version 3) —
Metadaten an Noten (F-01), Setlisten (F-02), Bookmarks (F-03), Flags (F-04)
brauchen Platz. Dabei:

- Migration nur additiv bzw. verlustfrei (Grundregel aus CLAUDE.md: nie Daten
  verwerfen, DB-Name `ueben` bleibt).
- Relationen und Schlüsselkonventionen einmal sauber dokumentieren (gern als
  Kommentarkopf in `lokal.ts` oder `docs/datenmodell.md`).
- Entscheiden, ob Einstellungen in einem `einstellungen`-Store statt
  localStorage liegen sollen (spätestens für Themes, B-04, sinnvoll).

### A-03 · Tests für die Speicherschicht

`lokal.ts` ist komplett ungetestet (Upgrade-Pfad, Kaskadenlöschung über drei
Stores, Transaktions-Wiederholung). Vor dem Schema-Sprung aus A-02 mit
`fake-indexeddb` absichern. Danach gilt: Schema-Änderungen nur mit
Migrationstest.

---

## B — UI-Neuaufbau: Noten im Zentrum

### B-01 · Kopfzeile weg, drei große Knöpfe unten

Die Kopfzeile („CheatSheet / METRONOM · STIMMGERÄT · NOTENPULT“ in
`src/app/layout.tsx`) verschwindet ersatzlos. Stattdessen eine untere Leiste
mit drei großen Knöpfen (Noten · Metronom · Stimmgerät). Start landet immer
direkt auf den Noten, ohne Zwischenschritt.

### B-02 · Noten immer vollflächig

Heute: Liste → NotenPult → Betrachter öffnet als Portal/Dialog
(`NotenBetrachter.tsx`, `position: fixed`). Ziel: Die Noten **sind** die
Hauptansicht und füllen immer das ganze Fenster; es gibt kein
„Öffnen-Popup“-Gefühl mehr. Liste/Bibliothek wird zum Overlay oder zur
Einstiegsansicht, nicht umgekehrt.

### B-03 · Metronom & Stimmgerät als Overlay-Widgets

Über die untere Leiste zuschaltbar, schweben als kompakte Widgets über den
Noten (das Mini-Metronom in `MiniMetronom.tsx` ist der Keim dafür). Metronom
läuft beim Ein-/Ausblenden weiter (`MetronomKontext` kann das schon). Das
Stimmgerät braucht eine kompakte Widget-Form.

### B-04 · Einstellungen mit Licht/Dunkel und Themes

Es gibt heute keinen manuellen Modus-Umschalter (nur
`prefers-color-scheme`). Ziel: Einstellungsbereich mit

- Hell / Dunkel / System
- Themes (Farbwelten auf Basis der bestehenden CSS-Tokens in `globals.css`):
  **Dunkelblau**, **Schwarz** (echtes OLED-Schwarz), **Weiß** (hell,
  neutral), **Sommer** (hell, fröhlich, Rosa-/Blumen-Akzente)

Technisch: `data-theme`-Attribut + Token-Sätze; Auswahl persistieren
(siehe A-02, Einstellungs-Store). `themeColor`/Manifest mitziehen.

### B-05 · Design-Überarbeitung (vor M2 entscheiden)

Das aktuelle UI wirkt generisch („generiert“): viele runde Ecken, Karten,
wenig eigene Handschrift. Ziel ist ein cleanes, hochwertiges, inhaltsfokussiertes
Design — Referenz sind die forScore-Screenshots: ruhige Flächen, dezentes
Chrome, die Noten dominieren.

Aufgabe: 2–3 ausgearbeitete Designvorschläge (HTML-Mockups) für
Noten-Vollansicht + untere Leiste + Overlays + je ein Theme aus B-04,
dann gemeinsam entscheiden. Erst danach B-01…B-03 umsetzen.

---

## C — Stimmgerät

### C-01 · Standard-Stimmung B ⚡

`STIMMUNGEN` (`src/domain/ueben.ts`) kann schon C/B/Es/F — aber der Standard
ist C. Neu: Standard **B** (deutsch, = internationales B♭). Gespeicherte
Auswahl (`stimm:st`) hat weiter Vorrang; nur der Erststart ändert sich.

### C-02 · Anzeige entschlacken: „+1 / −3“ statt „+3 Cent“ ⚡

In `Stimmgeraet.tsx` (Abweichungszeile): nur noch Vorzeichen + Zahl
(z. B. „+1“, „−3“), das Wort „Cent“ fällt weg. Insgesamt weniger Text in den
Zustandsmeldungen („Mikrofon starten…“, „Spiel einen langen Ton…“ kürzen).

### C-03 · Fußzeile straffen ⚡

`src/app/layout.tsx`: „Alles bleibt auf diesem Gerät — keine Anmeldung, kein
Konto, nichts auf einem Server.“ → kürzer und ohne Gedankenstrich, z. B.
„Alles bleibt auf diesem Gerät. Kein Konto, kein Server.“ Die gleichen
Em-Dash-Formulierungen in `layout.tsx` (Beschreibung), `manifest.ts` und
README bei der Gelegenheit mitziehen.

### C-04 · Intonations-Trainer (Name gesucht)

Das Bonus-Feature: sein Instrument kennenlernen. Ablauf:

1. Man spielt jeden Ton seines Instruments an (geführt, z. B. chromatisch
   oder als Tonleiter); die App misst je Ton die Abweichung (Median über die
   Messdauer — `grundfrequenz`/`median` aus `src/domain/ueben.ts` können das).
2. Ergebnis ist ein **Tonprofil**: welche Töne auf *meinem* Instrument zu
   hoch/zu tief sind, als übersichtliche Grafik je Ton.
3. Profile werden gespeichert und datiert — das macht man idealerweise
   wöchentlich und sieht die Entwicklung.
4. Darauf aufbauend: Hinweise, wie eine sauber intonierte Tonleiter gelingt
   (welche Töne ziehen, welche stützen).

**Fachliche Grundlage (recherchiert, reine Stimmung ggü. gleichstufig):**

| Intervall | rein (Cent) | gleichstufig | Differenz |
|---|---|---|---|
| große Terz (5:4) | 386 | 400 | **−14 — tiefer spielen** |
| kleine Terz (6:5) | 316 | 300 | **+16 — höher spielen** |
| Quarte (4:3) | 498 | 500 | −2 — praktisch rein |
| Quinte (3:2) | 702 | 700 | +2 — praktisch rein |

Die Terz-Regeln (Dur-Terz tiefer, Moll-Terz höher) stimmen also; die
Annahme „Quarte eher höher“ hat sich **nicht** bestätigt — Quarte und Quinte
sind nahezu rein. Im UI nur die Terz-Regeln hervorheben. (Gilt fürs
harmonische Spielen im Ensemble; der Trainer misst zuerst das Instrument
selbst, die reinen Intervalle sind Zielwerte für den Akkord-Kontext.)

**Namensvorschläge** (Entscheidung offen, muss als Knopf-Beschriftung
funktionieren): *Tonkompass* · *Tonprofil* · *Stimmbild* · *Tonleiter-Check*.

---

## D — Metronom

### D-01 · ±1-Knöpfe in der Schnellverstellung ⚡

Heute: ±5 %/±10 % in `Metronom.tsx`, ±10 % im `MiniMetronom.tsx` (beides
multiplikativ). Neu: zusätzlich **−1 / +1** als harte BPM-Schritte, auch im
Mini-Metronom auf den Noten — fürs Feinjustieren aufs Zieltempo. ±10 % bleibt,
der Schieberegler bleibt (große Sprünge). ±5 % kann zugunsten der ±1-Knöpfe
weichen, wenn es sonst zu voll wird.

---

## E — Stift & Anmerkungen

### E-01 · Stiftdicke einstellbar

Heute hart kodiert (`NotenBetrachter.tsx`: Stift 0.0025, Marker 0.014,
relativ zur Seitenbreite — an **zwei** Stellen: Live-Vorschau und
Speicherpfad). Neu: 3–4 Dickenstufen je Werkzeug, Auswahl wird gespeichert.
Das `Anmerkung`-Datenmodell (`src/domain/notenpult.ts`) braucht dafür ein
`breite`-Feld (alte Anmerkungen ohne Feld = bisherige Breite).

### E-02 · Mehr Farben

Heute je 3 feste Farben für Stift/Text und Marker. Neu: größere kuratierte
Palette (8–12) + zuletzt benutzte Farben; Auswahl wird gespeichert.

### E-03 · Stift-UI überarbeiten

Das schwebende Werkzeugfeld ist funktional, aber unansehnlich. Zusammen mit
B-05 neu gestalten. Zielbild forScore: speicherbare **Stift-Presets**
(Werkzeug + Farbe + Dicke als ein Antipp-Preset). Redo zusätzlich zu Undo.

### E-04 · Anmerkungen, Ausbaustufe (forScore-Niveau)

Später, nach E-01…E-03: Stempel (musikalische Symbole: Atemzeichen,
Fingersätze, Dynamik), Formen (Bindebögen, Crescendo-Keile), Auswahl-Werkzeug
(verschieben/löschen statt nur radieren), ggf. Anmerkungs-Ebenen.

---

## F — Notenmanagement (forScore als Vorbild)

### F-01 · Metadaten statt Dateiliste

Jede Note bekommt Metadaten: Komponist, Genre, Tags, Tonart,
Schwierigkeitsgrad, freie Kennung. Die Bibliothek wird darüber durchsuch-,
sortier- und filterbar; Menüs sind dynamisch (zeigen nur, was es gibt).
Mehrfachbearbeitung (mehrere Noten auswählen → Genre setzen). Beim
PDF-Import Standard-Metadaten (Titel, Autor) übernehmen. Braucht A-02.

### F-02 · Setlisten

Eigene Reihenfolgen aus Noten/Bookmarks: anlegen, umsortieren, Stücke mehrfach
erlaubt, Platzhalter („spiele ich auswendig“). Beim Durchspielen blättert man
über Stückgrenzen hinweg. Sortieransichten: Original, alphabetisch, zuletzt
gespielt, zufällig. Export als einfache Textliste (kein Sync, keine Freigabe).

### F-03 · Bookmarks

Seiten benennen und direkt anspringen. Ausbaustufe: Seitenbereich einer PDF
als **virtuelles Stück** mit eigenen Metadaten (für Sammelbände) — erscheint
in der Bibliothek wie eine eigene Note, kann in Setlisten. Wenn die PDF ein
Inhaltsverzeichnis hat: Bookmarks automatisch daraus erzeugen.

### F-04 · Flags

Flüchtige Merker: Seite markieren, Liste aller Flags (je Stück und global),
alle auf einmal löschen. Bewusst leichtgewichtiger als Bookmarks.

### F-05 · Wiederholungs-Links

Zwei Punkte im Stück verknüpfen (Wiederholung/Coda): Antippen springt zur
Zielseite, ein kurzes Blinksignal zeigt die Einstiegsstelle.

### F-06 · Halbseiten-Umblättern

Untere Hälfte der aktuellen + obere Hälfte der nächsten Seite gleichzeitig —
nahtlose Übergänge. Der Betrachter kennt schon Ganz-/Halb-/Linien-Ansichten
(`ansichten` in `src/domain/notenpult.ts`), das ist die Weiterführung.
Bluetooth-Pedale funktionieren bereits und bleiben erhalten.

### F-07 · Kamera-Scan

Papiernoten mit der Gerätekamera abfotografieren → zuschneiden/entzerren →
als PDF in die Bibliothek. Im Browser machbar (getUserMedia + Canvas), aber
aufwendig — bewusst spät in der Roadmap.

### F-08 · Kontextmenüs

Langdruck auf Note/Bookmark/Setliste: Vorschaubild + Aktionen (öffnen,
umbenennen, Metadaten, duplizieren, löschen). Ein Interaktionsmuster für die
ganze App.

### F-09 · Drag & Drop

PDFs aus dem Datei-Manager in die Bibliothek ziehen = Import. Noten in
Setlisten ziehen, Setlisten-Einträge umsortieren. (Desktop zuerst; Touch
soweit sinnvoll.)

---

## Erledigt

*(Abgeschlossene Punkte hierher verschieben, mit Datum und Commit.)*

- **A-04 · Anforderungsquelle geklärt** (2026-10-10): Diese ROADMAP.md ist
  die einzige Anforderungsliste; die Verweise auf
  `app-factory/apps/cheatsheet/` wurden aus CLAUDE.md und README entfernt.
  (Die alten Fabrik-Unterlagen liegen, falls je gebraucht, im app-factory-
  Branch `claude/peaceful-newton-k09fjl`.)
