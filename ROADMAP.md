# Roadmap & Backlog

Langfristige Planung für CheatSheet. Dieses Dokument ist die gemeinsame
Arbeitsgrundlage für alle Entwickler: Wer etwas anfängt, trägt sich hinter dem
Punkt ein; wer etwas fertigstellt, hakt ab und verschiebt den Punkt nach
„Erledigt“ (unten). Größere Richtungsentscheidungen bitte als kurzen Absatz
hier dokumentieren, nicht nur im Chat.

Stand: 2026-10-18.

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
| M7 | **Komponieren** (Vision) | Noteneingabe, Noten-Erkennung aus PDF/Foto, Rhythmus-/Melodie-Transkription | G-01…G-05 |

**Quick Wins** (klein, unabhängig, jederzeit zwischenschieben — guter
Einstieg): C-01, C-02, C-03, D-01 — *alle am 2026-10-10 erledigt.*

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

*(komplett umgesetzt am 2026-10-10 — alle Punkte unter „Erledigt“;
Branch `feature/ui-noten-im-zentrum`, PR #1)*

---

## C — Stimmgerät

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

*(derzeit keine offenen Punkte — D-01 erledigt, siehe unten)*

---

## E — Stift & Anmerkungen

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
als PDF in die Bibliothek. Im Browser machbar (getUserMedia + Canvas,
Entzerrung mit jscanify/OpenCV.js), aber aufwendig — bewusst spät in der
Roadmap. Einstieg über den Datei-Dialog mit `capture` (native Kamera-App)
ist robuster als eine Live-Vorschau in der Home-Screen-App. Liefert zugleich
das Foto für G-05.

### F-08 · Kontextmenüs

Langdruck auf Note/Bookmark/Setliste: Vorschaubild + Aktionen (öffnen,
umbenennen, Metadaten, duplizieren, löschen). Ein Interaktionsmuster für die
ganze App.

### F-09 · Drag & Drop

PDFs aus dem Datei-Manager in die Bibliothek ziehen = Import. Noten in
Setlisten ziehen, Setlisten-Einträge umsortieren. (Desktop zuerst; Touch
soweit sinnvoll.)

---

## G — Komponieren (Vision, langfristig)

Langfristperspektive: CheatSheet nicht nur zum Lesen und Üben, sondern auch
zum **Schreiben** von Musik. Bewusst als Vision hinter M1–M6 — nichts davon
anfangen, bevor die Noten-Grundpfeiler stehen. Und es gilt weiterhin: alles
lokal, kein Server. „KI“ heißt hier on-device (Modelle, die im Browser
laufen), kein Cloud-Dienst. Reihenfolge innerhalb von G: erst G-01, dann
G-04 (braucht kein Modell), dann G-05 — ohne Editor ist jede Erkennung
nutzlos.

### G-01 · Noteneingabe

Ein cleanes, interaktives Eingabe-UI, um Noten direkt einzutippen: Tonhöhe,
Notenwert, Pausen, Taktart, Vorzeichen — gedacht fürs schnelle Festhalten
von Ideen und Stimmen, kein Notensatz-Programm-Ersatz. Technik-Kandidaten
fürs Rendern: VexFlow, abcjs oder Verovio (alle rein lokal lauffähig;
Verovio liest MusicXML, schreibt es aber nicht, und seine Editor-API ist
experimentell — Bearbeiten deshalb in einer eigenen Schicht kapseln). Als
Speicherformat etwas Offenes, nichts Eigenes — MusicXML liegt nahe, weil
G-04/G-05 es liefern; Entscheidung vor dem Start, dann gilt sie für G-01
bis G-05. Der Editor ist zugleich die Korrekturwerkstatt für G-04/G-05
(Muster ScanScore, Soundslice): Originalseite und erkannte Notation
untereinander, Takte mit falscher Notenwert-Summe markiert, nicht Gelesenes
sichtbar als „fehlt“, Rückfragen nur bei wenigen klaren Unsicherheiten
(Schlüssel, Tonart, Taktart) statt stillem Raten. Abhören als Fehlerfinder
ist bei allen Vorbildern Standard, kollidiert aber mit „MIDI/Audio außen
vor“ — Entscheidung offen. Export als PDF in die eigene Bibliothek — damit
schließt sich der Kreis: komponieren → üben, erkennen → korrigieren → üben.

### G-02 · Rhythmus-Transkription

Einsingen oder klatschen → die App erkennt die Einsätze (Onset-Erkennung)
und quantisiert sie am Metronom-Raster zu Notenwerten. Rein lokal
realistisch machbar: Mikrofon-Pipeline und Tonerkennung
(`grundfrequenz`/YIN) existieren schon, das Metronom gibt den Takt vor, die
App schreibt den Rhythmus mit. Bewusst der erste Transkriptions-Schritt,
weil deutlich robuster als Tonhöhen-Erkennung von Gesang.

### G-03 · Melodie-Transkription

Ausbaustufe von G-02: zusätzlich die Tonhöhen erkennen → gesungene Melodie
wird vollständige Notation. Deutlich schwerer (Gesang schwankt,
Oktavfehler, Übergänge); Kandidat wäre ein On-Device-Modell im Browser
(ONNX/WASM, Richtung Basic Pitch). Eigenes Forschungsthema, bewusst von
G-02 getrennt — Rhythmus zuerst, Töne später.

### G-04 · Noten aus Notensatz-PDFs (PDF-nativ)

PDFs direkt aus MuseScore, Dorico oder LilyPond tragen die Notensymbole als
Schrift-Glyphen (SMuFL-Codepoints bzw. Emmentaler-Glyphnamen) und die
Notenlinien als Vektorpfade; das vorhandene pdfjs-dist liefert beides
(`getTextContent`, `getOperatorList`). Daraus Schlüssel, Taktart, Tonhöhen,
Notenwerte und Takte rekonstruieren — ohne Modell, offline, fürs iPad
unkritisch. Die Symbole selbst sind praktisch fehlerfrei, Fehler entstehen
beim Zusammensetzen (Hals vs. Taktstrich, Balken, Triolen, Stimmen); das
Grundprinzip ist in einem kurzen Versuch mit pdf.js belegt. Zuerst
einstimmig und nur SMuFL/Emmentaler, mit Takt-Summen-Prüfung und sichtbarer
Markierung des nicht Gelesenen; Legacy-Schriften (Sibelius Opus, altes
Finale Maestro) nur mit echten Testdateien nachrüsten. Eine Heuristik über
die Operatorliste erkennt Scans und geflattete „Drucken als PDF“-Dateien
und reicht sie an G-05. Nichts Fertiges vorhanden (PDFtoMusic ist
kommerziell und Desktop), also Eigenbau auf pdfjs. Vorher messen, wie viele
PDFs der eigenen Bibliothek so lesbar sind — Scans und Kopien sind es nicht.
Ausgabe MusicXML. Braucht G-01, A-02.

### G-05 · Noten aus Foto und Scan (Bild-OMR, experimentell)

Kamerafoto (F-07) oder gerasterte Scan-PDF → On-Device-Modell im Browser
(onnxruntime-web) → MusicXML → Korrektur in G-01. Kandidaten: homr-web
(TypeScript-Port von homr; läuft als Prototyp, aber AGPL, Lizenz der
Trainingsdaten unklar, 134–189 MB Modelle, Ein-Personen-Projekt),
copista-2m (Apache-2.0, 16 MB, beste gemeldete Werte, aber von niemandem
nachgerechnet und ohne ONNX-Export), oemer (MIT, 109 MB, Modelle von 2021).
Ehrliche Erwartung: ein Rohentwurf zum Korrigieren — selbst die besten
Systeme machen auf echten Scans 10–50 % Fehler; brauchbar nur sauberer
Druck mit ein bis zwei Systemen und gerade, scharfe Fotos; Liedtext liest
kein Kandidat, Dynamik, Stichnoten und Sprunganweisungen bleiben Handarbeit.
Auf dem iPad läuft nur der reine WASM-Pfad stabil (WebGPU über
onnxruntime-web sprengt in Safari 26 den Speicher), bisher auf keinem iPad
gemessen — eher Minuten als Sekunden pro Seite. Modelle erst beim ersten
Scan laden (Cache Storage, nicht Vorab-Cache); was das Gerät nicht schafft,
heißt ehrlich „nicht verfügbar“. Vor dem Start: Spike mit fünf eigenen
Seiten auf dem iPad, und die Lizenz des Repos festlegen (es gibt noch
keine; AGPL wäre bindend). **Bewusst ausgeschlossen:** Handschrift (bester
Forschungswert 33 % Fehler, alle Anbieter schließen sie aus), dichte
Partituren vom Handyfoto, Cloud-OMR, Audiveris im Browser (braucht JDK 25,
CheerpJ kann Java 17), große End-to-End-Transformer (Legato, rokot, Clarity,
Transcoda: zu groß oder ohne ONNX). Braucht F-07, G-01, A-02.

---

## Erledigt

*(Abgeschlossene Punkte hierher verschieben, mit Datum und Commit.)*

- **B-01 · Kopfzeile weg, drei große Knöpfe unten** (2026-10-10, `9b36fcc`):
  Kopf- und Fußzeile ersatzlos entfernt; untere Leiste mit Noten · Metronom ·
  Stimmgerät (`UntereLeiste.tsx`); Start landet direkt auf den Noten
  (zuletzt geöffnetes Stück, sonst Bibliothek).
- **B-02 · Noten immer vollflächig** (2026-10-10, `9b36fcc`): Der Betrachter
  ist die Hauptansicht (kein Portal/Dialog mehr) und folgt dem Thema; die
  Bibliothek ist ein angedocktes Overlay (`Bibliothek.tsx`); Stück-Details
  samt Stellen-Übersicht liegen im Stück-Blatt hinter dem Titel. Der
  Umzugs-Deep-Link `?reiter=noten` entfiel mit der Reiter-Architektur.
- **B-03 · Metronom & Stimmgerät als Overlay-Widgets** (2026-10-10,
  `9b36fcc`): `MetronomWidget` (Start/Stopp, Tempo tippbar, −1/+1, ±10 %,
  Regler, Taktpunkte; läuft beim Ausblenden weiter) und `StimmgeraetWidget`
  (Ton, Skala, Abweichung „+2“; Ausblenden stoppt das Mikrofon) docken über
  der Leiste; „alles“ öffnet jeweils die große Ansicht. Auf Marlons Wunsch
  sind beide Widgets **frei über den ganzen Bildschirm schiebbar** (am Kopf
  anfassen; Position wird gemerkt, Ablegen an der Leiste dockt wieder an),
  damit die Noten lesbar bleiben. Der MiniMetronom ging im Widget auf; die
  Stimmgerät-Logik liegt im `StimmgeraetKontext`.
- **B-04 · Einstellungen mit Licht/Dunkel und Themes** (2026-10-10):
  Einstellungsbereich (Zahnrad in der Bibliothek) mit Hell/Dunkel/System
  und je einer hellen (**Weiß**, **Sommer**) und dunklen (**Dunkelblau**,
  **Schwarz** als echtes OLED-Schwarz) Farbwelt; „System“ wechselt zwischen
  den beiden gewählten. Technik: `data-thema` am `<html>` vor dem ersten
  Bild (Inline-Script), Auflösung in `src/domain/thema.ts` (getestet),
  Token-Sätze je Welt in `globals.css` (No-JS-Fallback nur ohne Attribut),
  `themeColor` je Welt, Manifest hell. Auswahl liegt in localStorage
  (`ueben:modus`, `ueben:thema-hell`, `ueben:thema-dunkel`) — Umzug in den
  Einstellungs-Store bleibt Thema von A-02.
- **E-01 · Stiftdicke einstellbar** (2026-10-10): 4 Stift- und 3
  Marker-Dicken (`src/domain/stift.ts`, getestet), je Werkzeug gemerkt
  (`ueben:stift|marker|text`); Live-Vorschau und Speicherpfad nutzen
  dieselbe Einstellung. Das `breite`-Feld je Anmerkung gab es schon —
  alte Anmerkungen bleiben unverändert.
- **E-02 · Mehr Farben** (2026-10-10): Kuratierte Palette (9 Stift-/
  Textfarben, 6 Markerfarben), die alten Standardfarben sind enthalten.
  Statt einer „Zuletzt“-Reihe merkt sich jedes Werkzeug Farbe + Dicke —
  das Muster von Apples Pencil-Palette, auf Marlons Wunsch iOS-orientiert.
- **E-03 · Stift-UI überarbeitet** (2026-10-10): Neue schwebende, frei
  verschiebbare Werkzeug-Palette nach dem Vorbild von Apples
  Pencil-Palette (Studio-Skin): Rückgängig **und neu Wiederholen**,
  Werkzeuge mit angehobenem Aktiv-Zustand, Dicken-Punkte, Farb-Swatches,
  Finger-Schalter; Einstieg über den Stift-Knopf in der Betrachter-Leiste.
  **Doppeltipp auf die Werkzeug-Reihe wechselt Radierer ↔ voriges
  Werkzeug** — der Hardware-Doppeltipp des Apple Pencil kommt in
  Safari-Webinhalten nicht an (`UIPencilInteraction` ist nativen Apps
  vorbehalten), deshalb als Bildschirm-Geste. Statt forScore-Presets gilt
  das Pencil-Muster „jedes Werkzeug merkt sich seine Einstellung“.
- **C-01 · Standard-Stimmung B** (2026-10-10): Erststart startet „in B“
  (deutsch, = internationales B♭); gespeicherte Auswahl `stimm:st` hat
  weiter Vorrang (`StimmgeraetKontext.tsx`).
- **C-02 · Anzeige entschlackt** (2026-10-10): Abweichung nur noch als
  „+1“/„−3“ ohne das Wort „Cent“ (Widget hatte das schon, jetzt auch die
  große Ansicht); Meldungen gekürzt („Mikrofon starten“, „Spiel einen
  Ton …“).
- **C-03 · Formulierungen gestrafft** (2026-10-10): Die Fußzeile selbst
  entfiel mit B-01; der Gedankenstrich-Satz in Beschreibung (`layout.tsx`),
  `manifest.ts`, README und Leerzustand heißt jetzt „… Metronom und
  Stimmgerät. Alles auf deinem Gerät.“ Der Datenschutz-Satz steht kurz im
  Bibliotheks-Fuß und in den Einstellungen.
- **D-01 · ±1-Knöpfe in der Schnellverstellung** (2026-10-10): Große
  Metronom-Ansicht hat −1/+1 als harte BPM-Schritte (±5 % wich dafür,
  ±10 % und Regler bleiben); das Metronom-Widget auf den Noten hatte
  −1/+1, ±10 % und Regler schon seit B-03.
- **D-02 · Ton nach App-Wechsel** (2026-10-11): Auf dem iPhone (vor allem
  als Home-Bildschirm-App) blieb das Metronom stumm, wenn man die App kurz
  verließ und zurückkam — iOS unterbricht dabei den AudioContext, und der
  alte Kontext wurde weiterverwendet. Jetzt halten Metronom und Stimmgerät
  (Mikrofon, Referenzton) beim Verlassen der App an und schließen ihren
  Kontext; ein unterbrochener Kontext wird nie weiterverwendet, der nächste
  Tipp legt einen frischen an (`verwerfen`, `useBeimVerlassen` in
  `klang.ts`). Folge: Auch am Rechner läuft das Metronom in einem
  Hintergrund-Tab nicht mehr weiter.
- **B-05 · Design-Überarbeitung** (2026-10-10): **Entscheidung Marlon:
  Studio.** Drei helle Entwürfe (Blatt · Studio · Galerie, identischer
  Funktionsumfang) liegen als antippbare HTML-Mockups in `docs/design/` und
  bleiben als Referenz. Studio — helles Studio-Weiß, warm abgestufte
  Neutrale, Haarlinien statt Schatten, kleine Radien, Messing nur an
  Aktivem — ist als Standard-Design umgesetzt (Tokens in `globals.css`,
  `5be6bba` ff.). Farbwelten/Themes werden bewusst nachgezogen (B-04).

- **A-04 · Anforderungsquelle geklärt** (2026-10-10): Diese ROADMAP.md ist
  die einzige Anforderungsliste; die Verweise auf
  `app-factory/apps/cheatsheet/` wurden aus CLAUDE.md und README entfernt.
  (Die alten Fabrik-Unterlagen liegen, falls je gebraucht, im app-factory-
  Branch `claude/peaceful-newton-k09fjl`.)
