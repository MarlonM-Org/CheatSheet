# Roadmap & Backlog

Langfristige Planung für CheatSheet. Dieses Dokument ist die gemeinsame
Arbeitsgrundlage für alle Entwickler: Wer etwas anfängt, trägt sich hinter dem
Punkt ein; wer etwas fertigstellt, hakt ab und verschiebt den Punkt nach
„Erledigt“ (unten). Größere Richtungsentscheidungen bitte als kurzen Absatz
hier dokumentieren, nicht nur im Chat.

Stand: 2026-10-13.

## Leitbild

**Die Noten sind die App.** Alles andere (Metronom, Stimmgerät, Einstellungen)
sind Werkzeuge, die über den Noten schweben. Eine lokal laufende, statische
Web-App: alle Daten bleiben auf dem Gerät, kein Login, kein Server. Vorbild
für Notenmanagement und Übe-Komfort ist **forScore** (https://forscore.co) —
nicht in der Breite, aber in der Sorgfalt.

**Bewusst außen vor** (nicht bauen, auch nicht „mal eben“):

- MIDI, Audio-Begleitspuren, Soundbearbeitung
- Kollaboration/Mehrbenutzer
- Server-Code, eigene Konten, Datenbanken außerhalb des Geräts

*Cloud-Sync* stand hier ebenfalls. Seit 2026-10-12 ist er als **Vision H**
aufgenommen — ausschließlich über die eigene Cloud der Nutzer (iCloud,
OneDrive, Google Drive), ohne eigenen Server, ohne eigene Konten. Das heißt
aber: Anmelden beim Cloud-Anbieter. Vor der Umsetzung entscheidet Marlon,
ob das ins Leitbild passt (dann auch CLAUDE.md anpassen: „kein Login“).

## Meilensteine (Reihenfolge)

| # | Meilenstein | Inhalt | Backlog-Punkte |
|---|---|---|---|
| M1 | **Fundament aufräumen** | Datenmodell klären, Tests für die Speicherschicht (A-01 verworfen) — *erledigt 2026-10-12* | A-02, A-03 |
| M2 | **Noten im Zentrum** | UI-Neuaufbau: Noten vollflächig, Werkzeuge als Overlays, drei Knöpfe unten | B-01…B-03 |
| M3 | **Werkzeuge schärfen** | Stimmgerät- und Metronom-Verbesserungen, Stift-Ausbau | C-01…C-03, D-01, E-01…E-03 |
| M4 | **Notenmanagement I** | Metadaten, Bookmarks, Flags, Kontextmenüs, Drag & Drop (Sammlungen F-13 erledigt) | F-01, F-03, F-04, F-08, F-09 |
| M5 | **Üben & Setlisten** | Setlisten, Wiederholungs-Links, Halbseiten-Blättern (Stellen-Mix F-11 und Tonprofil C-04 schon erledigt) | F-02, F-05, F-06 |
| M6 | **Design & Extras** | Themes, Stempel/Formen, Kamera-Scan | B-04, B-05, E-04, F-07 |
| M7 | **Komponieren** (Vision) | Noteneingabe, Rhythmus-/Melodie-Transkription | G-01…G-03 |
| M8 | **Geräteübergreifend** (Vision, Entscheidung offen) | Noten und Übe-Daten über die eigene Cloud auf mehreren Geräten | H-01…H-05 |

**Quick Wins** (klein, unabhängig, jederzeit zwischenschieben — guter
Einstieg): C-01, C-02, C-03, D-01 — *alle am 2026-10-10 erledigt.*

M2 setzt Designvorschläge voraus (siehe B-05) — erst Richtung festlegen, dann
umbauen.

---

## A — Fundament & Datenmodell

### A-01 · ~~Sicherung (.uebe) komplett entfernen~~ — verworfen

**Entscheidung Marlon (2026-10-11):** Die Sicherung bleibt — als „Daten
übertragen“ in den Einstellungen, um den aktuellen Stand auf ein anderes
Gerät zu bringen (nicht nur aus der Registerführer-App) und als Schutz.
Umgesetzt in B-06 (siehe Erledigt). Der `.uebe`-Vertrag mit `registerfuehrer`
bleibt damit bestehen.

*(A-02 und A-03 erledigt am 2026-10-12 — siehe unten.)*

---

## B — UI-Neuaufbau: Noten im Zentrum

*(komplett umgesetzt am 2026-10-10 — alle Punkte unter „Erledigt“;
Branch `feature/ui-noten-im-zentrum`, PR #1)*

---

## C — Stimmgerät

*(C-04 Tonprofil am 2026-10-12 erledigt, siehe unten.)*

---

## D — Metronom

*(derzeit keine offenen Punkte — D-01…D-04 erledigt, siehe unten)*

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
PDF-Import Standard-Metadaten (Titel, Autor) übernehmen. Speicher steht
(A-02): die Felder am `Stueck`, reisen mit der Sicherung. Suchen und Filtern
rein in `src/domain/` (keine Indizes, siehe `docs/datenmodell.md`).

### F-02 · Setlisten

Eigene Reihenfolgen aus Noten/Bookmarks: anlegen, umsortieren, Stücke mehrfach
erlaubt, Platzhalter („spiele ich auswendig“). Beim Durchspielen blättert man
über Stückgrenzen hinweg. Sortieransichten: Original, alphabetisch, zuletzt
gespielt, zufällig. Export als einfache Textliste (kein Sync, keine Freigabe).
Speicher steht (A-02): `setlisten` mit `eintraege` in Reihenfolge; gelöschte
Stücke verschwinden daraus, die Lösch-Rückfrage nennt die Setlisten.

### F-03 · Bookmarks

Seiten benennen und direkt anspringen. Ausbaustufe: Seitenbereich einer PDF
als **virtuelles Stück** mit eigenen Metadaten (für Sammelbände) — erscheint
in der Bibliothek wie eine eigene Note, kann in Setlisten. Wenn die PDF ein
Inhaltsverzeichnis hat: Bookmarks automatisch daraus erzeugen.
Speicher steht (A-02): `lesezeichen` und virtuelle Stücke (`quelle`), samt
Kaskade und Sicherung. **Offen in der Oberfläche:** Der Betrachter zeigt ein
virtuelles Stück noch als ganze PDF der Quelle — er muss die Seiten von–bis
zeigen und Stellen/Anmerkungen über `ablage()` (`src/domain/bestand.ts`) bei
der Quelle lesen und schreiben. Anlegen geht bisher nur über `lokal.ts`.

### F-04 · Flags

Flüchtige Merker: Seite markieren, Liste aller Flags (je Stück und global),
alle auf einmal löschen. Bewusst leichtgewichtiger als Bookmarks.
Speicher steht (A-02): `merker`, einer je Seite.

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

## G — Komponieren (Vision, langfristig)

Langfristperspektive: CheatSheet nicht nur zum Lesen und Üben, sondern auch
zum **Schreiben** von Musik. Bewusst als Vision hinter M1–M6 — nichts davon
anfangen, bevor die Noten-Grundpfeiler stehen. Und es gilt weiterhin: alles
lokal, kein Server. „KI“ heißt hier on-device (Modelle, die im Browser
laufen), kein Cloud-Dienst.

### G-01 · Noteneingabe

Ein cleanes, interaktives Eingabe-UI, um Noten direkt einzutippen: Tonhöhe,
Notenwert, Pausen, Taktart, Vorzeichen — gedacht fürs schnelle Festhalten
von Ideen und Stimmen, kein Notensatz-Programm-Ersatz. Technik-Kandidaten
fürs Rendern: VexFlow oder abcjs (beides rein lokal lauffähig); als
Speicherformat etwas Offenes (ABC-Notation oder MusicXML), nichts Eigenes.
Export als PDF in die eigene Bibliothek — damit schließt sich der Kreis:
komponieren → üben.

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

---

## H — Geräteübergreifend: Noten und Daten in der eigenen Cloud (Vision)

Wunsch Marlon (2026-10-12): auf einem Gerät einmal einen Cloud-Ordner
festlegen (iCloud, OneDrive, Google Drive), in dem die Noten liegen; die App
merkt sich den Ordner, holt die Noten daraus und legt auch ihre Daten
(Stellen, Tempi, Anmerkungen) dort ab. Ein zweites Gerät mit demselben
Ordner hat denselben Stand. Die Daten bleiben bei den Nutzern — auf dem
Gerät bzw. in *ihrer* Cloud —, nie bei uns.

**Machbarkeit (Stand 2026-10-12, recherchiert):**

| Weg | iPhone/iPad (Safari, Home-Bildschirm) | Rechner (Chrome/Edge) | Aufwand / Haken |
|---|---|---|---|
| Ordner direkt wählen (File System Access, `showDirectoryPicker`) | **nein** — Safari hat die Ordner-Auswahl nicht, nur den abgeschotteten App-Speicher (OPFS) | ja, mit dauerhafter Erlaubnis; geht mit dem iCloud-, OneDrive- oder Drive-Ordner auf dem Rechner | klein; hilft aber nicht auf dem iPhone |
| **OneDrive** (Microsoft Graph, Anmeldung im Browser per MSAL, eigener App-Ordner `Apps/CheatSheet`) | ja | ja | kostenlose App-Registrierung bei Microsoft; im Browser läuft die Anmeldung nach höchstens 24 h ab → etwa täglich neu anmelden |
| **Google Drive** (Google Identity Services, Scope `drive.file` + Google Picker) | ja | ja | Google-Cloud-Projekt und Zustimmungsseite; Zugriffs-Token kurzlebig (eine Stunde), danach erneute Bestätigung; mit `drive.file` sieht die App nur selbst angelegte oder im Picker gewählte Dateien |
| **iCloud** per CloudKit JS | ja | ja | Apple Developer Program (kostenpflichtig, jährlich), Anmeldung mit Apple-ID in der Web-App; Daten liegen in der privaten iCloud-Datenbank der Nutzer, **nicht** als sichtbarer Ordner in der Dateien-App |
| iCloud-Ordner wie in der Dateien-App | nur als **eigene App** (App Store, z. B. per Capacitor) | — | großer Schritt: Entwicklerkonto, Prüfung durch Apple |

Fazit: Einen festen iCloud-Ordner merken kann eine Web-App auf dem iPhone
nicht. OneDrive und Google Drive gehen ohne eigenen Server, aber mit
Anmelden beim Anbieter, das regelmäßig erneuert werden muss.

**Vorgeschlagene Stufen:**

- **H-01 · Übertragen per Sicherung (ohne Login)** — *erster Teil erledigt
  (2026-10-12, siehe unten)*: Uhrzeit im Dateinamen, Erinnerung, neuerer
  Stand gewinnt, Gelöschtes und Wegradiertes reisen mit. Offen: **Sicherung
  ohne PDFs** — liegen die Noten ohnehin in einem iCloud-Ordner (auf beiden
  Geräten per Ordner-Import übernommen), reicht eine kleine Datei mit
  Stellen, Tempi und Anmerkungen; zugeordnet über Dateiname und Größe statt
  über die id. Braucht eine neue Format-Version (die alte bleibt lesbar).
  Danach: nur Änderungen seit der letzten Sicherung.
- **H-02 · Ordner am Rechner** (Chrome/Edge): Noten-Ordner wählen, die App
  liest neue/geänderte PDFs und schreibt `cheatsheet-daten.json` daneben.
- **H-03 · OneDrive** und **H-04 · Google Drive**: Anmelden, App-Ordner,
  dort PDFs und eine Daten-Datei; beim Start abgleichen.
- **H-05 · iCloud** über CloudKit JS oder als eigene App — erst entscheiden,
  ob Kosten und Apple-Anmeldung es wert sind.

**Was für alle Stufen gilt:** Abgleich mit den Regeln aus
`src/domain/einspielen.ts` (Tempi vereinigen, sonst gewinnt der neuere
Stand; Löschen braucht Grabsteine, sonst kehrt Gelöschtes zurück). Ein
Datenformat für die Cloud: PDFs als Dateien plus eine JSON-Datei, kein
Eigenformat. Keine Secrets im Repo — Client-IDs sind öffentlich, Anmeldung
per PKCE im Browser. Vor dem Bau: Entscheidung zum Leitbild (oben).

## Erledigt

*(Abgeschlossene Punkte hierher verschieben, mit Datum und Commit.)*

- **A-03 · Tests für die Speicherschicht** (2026-10-12, Branch
  `feature/speicher-tests`): `tests/lokal.test.ts` gegen einen echten
  Gerätespeicher (`fake-indexeddb`), Hilfen in `tests/hilfen/geraet.ts` mit
  den eingefrorenen Schemata v1–v3 von `ueben`. Erst den Ist-Zustand
  (Schema 3) festgehalten, dann mit A-02 auf `cheatsheet` umgezogen. Alle
  Tests gegen absichtlich eingebaute Fehler geprüft. Ein optionaler Test lädt
  einen echten Export (`CHEATSHEET_EXPORT=data-export/….uebe npm test`; die
  Datei nie ins Repo).
- **A-02 · Datenbank & Relationsmodell neu** (2026-10-12, Branch
  `feature/speicher-tests`): **Entscheidung Leon:** neue Datenbank
  `cheatsheet` statt Umbau von `ueben`; Grundbegriff „Stück“ (`stuecke`,
  `stueckId`); neu `lesezeichen`, `merker`, `setlisten` und virtuelle Stücke
  (teilen Stellen/Anmerkungen mit der Quelle, fallen mit ihr weg); gelöschte
  Stücke verschwinden aus Setlisten, die Rückfrage nennt sie; Einstellungen
  bleiben im localStorage. Umstieg per „Übernehmen“ (liest `ueben` nur,
  ergänzt 2026-10-13) oder über eine Sicherung — `ueben` bleibt unangetastet
  liegen. Die Sicherung
  bleibt Version 1 und trägt vier optionale Listen. Alles in
  `docs/datenmodell.md`; CLAUDE.md und README nachgezogen. **Am 2026-10-13
  mit Marlons Stand zusammengeführt** (Sammlungen, Tags, Stellen-Mix,
  Tonprofil, H-01): seine Regeln gelten — Tags als ids mit Farbe
  (Definitionen im localStorage), beim Laden gewinnt der neuere Stand,
  Grabsteine; Lesezeichen, Merker, Setlisten und virtuelle Stücke folgen
  denselben Regeln. Der Hintergrund-Umzug alter Blobs entfällt (die neue
  Datenbank kennt keine). **Vor dem Deploy:** auf jedem Gerät mit Daten
  eine Sicherung erstellen und aufheben — als Schutz; der Umstieg selbst
  geht nach dem Update per „Übernehmen“.

- **B-01 · Kopfzeile weg, drei große Knöpfe unten** (2026-10-10, `9b36fcc`):
  Kopf- und Fußzeile ersatzlos entfernt; untere Leiste mit Noten · Metronom ·
  Stimmgerät (`UntereLeiste.tsx`; seit B-06 Stimmgerät · Noten · Metronom); Start landet direkt auf den Noten
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
  (`ueben:modus`, `ueben:thema-hell`, `ueben:thema-dunkel`) — A-02 hat
  entschieden: Einstellungen bleiben im localStorage (das Thema muss vor dem
  ersten Bild synchron lesbar sein).
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
- **D-03 · −1/+1 in der Stellen-Leiste** (2026-10-11): Beim Üben von
  Stellen lässt sich das Metronom-Tempo direkt neben „✓ … geschafft“ um
  einen Schlag verstellen, ohne das Metronom zu öffnen. Auf dem iPhone
  stehen −1/+1 rechts neben dem Stellen-Titel, direkt über „geschafft“;
  auf breiten Bildschirmen in derselben Zeile.
- **A-05 · Zuverlässig laden und speichern, auch nach App-Wechsel**
  (2026-10-11): Auf dem iPhone kamen sporadisch „Gerätespeicher voll“-
  Meldungen, die Stift-Palette erschien manchmal nicht, und nach dem
  Zurückkehren in die App hakte es. Behoben:
  - Gerätespeicher (`lokal.ts`): Nach jeder Rückkehr in die App wird die
    Verbindung frisch geöffnet; bricht ein Vorgang wegen verlorener
    Verbindung ab, folgt ein neuer Versuch (Regel getestet in
    `src/domain/speicher.ts`); das Öffnen hat eine Zeitgrenze statt ewig
    „wird geladen“. Neue Dateien werden vor dem Speichern in den
    Arbeitsspeicher kopiert (Safari scheitert sonst mitunter an Dateien
    direkt aus der Dateiauswahl).
  - Meldung: „Gerätespeicher voll“ nur noch, wenn er wirklich voll ist;
    sonst „Verbindung zum Gerätespeicher war unterbrochen“.
  - Speicherleck: Beim Stückwechsel wird das PDF samt pdf.js-Worker
    freigegeben, die Seitenbilder ebenso; eine gescheiterte Seite wird beim
    nächsten Blick neu gezeichnet.
  - Schwebende Panels (Stift-Palette, Widgets): Eine gemerkte Lage aus
    einem anderen Format (iPad, quer) wird beim Erscheinen ins Bild geholt,
    über die untere Leiste (Regel getestet in `src/domain/lage.ts`). Beim
    Wechsel in den Stellen-Modus schließt die Palette, damit sie die
    Stellen-Leiste nicht verdeckt.
- **E-05 · Markierungen aus dem PDF radieren** (2026-10-11): Markierungen,
  die schon im PDF stecken (etwa mit Apples „Markieren“ in der Dateien-App
  gezeichnet — dort als ein Stempel je Seite mit Pixelbild), lassen sich mit
  dem Radierer wegwischen wie auf Papier; darunter erscheinen die sauberen
  Noten. Technik (`src/domain/ebene.ts`, getestet): Die Seite wird ohne die
  PDF-Anmerkungen gezeichnet, die Anmerkungen allein (pdf.js
  `operationsFilter`) auf eine durchsichtige Markierungs-Ebene, die
  multipliziert darübergelegt wird. (Erst per Vergleich zweier Durchgänge
  gebaut — auf dem iPhone fehlte im zweiten der Scan, die Ebene deckte die
  Noten weiß zu; behoben am selben Tag.) Sie entsteht beim Öffnen immer
  frisch aus dem PDF;
  gespeichert werden nur Radier-Spuren (neue Anmerkungsart `radiert`), das
  PDF bleibt unverändert. Rückgängig/Wiederholen wie gewohnt je Wisch; die
  Stellen-Ausschnitte im Stück-Blatt zeigen dasselbe (jetzt auch mit eigenen
  Anmerkungen). Einzelne Striche aus Apples PencilKit-Format zu lesen bleibt
  bewusst außen vor (undokumentiert, ändert sich mit iOS).
- **F-10 · Bibliothek: A–Z mit Zahlen, Uhrzeit bei „zuletzt“**
  (2026-10-11): A–Z sortiert Zahlen als Zahlen („2 …“ vor „10 …“, wie im
  Finder; Groß/klein egal, bei gleichem Titel nach Stimme). „zuletzt“
  zeigt Tag, Monat und Uhrzeit („11.10., 18:48“), aus einem anderen Jahr
  mit Jahreszahl. Regeln getestet in `src/domain/notenpult.ts`
  (`nachTitel`, `zeitpunkt`).
- **A-06 · Scans als JBIG2/JPEG 2000, verlorene PDF-Dateien** (2026-10-11):
  Manche Stücke zeigten nur die Markierungen, nicht die Noten: pdf.js 6
  braucht für JBIG2 (typisch für Schwarz-Weiß-Scans) und JPEG 2000 eigene
  Decoder (`wasmUrl`), die fehlten — der Scan blieb leer. Jetzt liegen sie
  versioniert in `public/pdfjs-<version>/` (scripts/pdf-worker.mjs), auch
  offline. Außerdem schrieb jedes Öffnen „zuletzt“ samt PDF-Datei in den
  Datensatz zurück; Safari scheiterte daran mitunter („Error preparing
  Blob/File data …“) und verlor die Datei („The object can not be found
  here“). Jetzt: **Schema 3** mit eigenem Speicher `dateien` — die PDFs
  als reine Bytes (ArrayBuffer), nie mehr als Blob; Noten-Datensätze ohne
  Datei. Ältere Stücke ziehen beim ersten Öffnen um (Bytes gelesen, dann in
  einem Schritt abgelegt und Datensatz ohne Blob geschrieben). Öffnen
  schreibt sonst nichts (zuletzt im localStorage `ueben:zuletzt`), eine
  verlorene Datei bekommt eine klare Meldung mit dem Weg zur Rettung
  („Auswahl aktualisieren“; Stellen und Anmerkungen bleiben). Die
  Sicherung (.uebe) bleibt im Format gleich und holt die Dateien aus
  `dateien`.
- **B-06 · Einstellungen: Zahnrad, Daten übertragen; Leiste neu sortiert**
  (2026-10-11): Untere Leiste jetzt **Stimmgerät · Noten · Metronom** (Noten
  in der Mitte). In der Bibliothek öffnet ein Zahnrad (statt der Sonne) die
  Einstellungen; dort steht unter „Daten übertragen“ die Sicherung: alle
  Noten samt Stellen, Tempi, Anmerkungen und Radier-Spuren als eine
  `.uebe`-Datei erstellen (herunterladen oder teilen) und auf dem anderen
  Gerät laden — in den Einstellungen oder direkt in der leeren Bibliothek.
  Einstellungen (Tempo, Farbwelt …) reisen nicht mit. Beim Laden gehen die
  PDFs nie als Blob in die Datenbank: erst einzeln als Bytes vorläufig in
  `dateien`, dann zieht eine Transaktion sie an ihren Platz (alles oder
  nichts). Vor jeder Sicherung — und still im Hintergrund nach dem Laden der
  Bibliothek — ziehen alle Stücke, die ihre PDF noch als alten Blob tragen,
  in `dateien` um: Safari las solche Blobs beim Prüfen mitunter nicht,
  obwohl sich das Stück öffnen ließ („Nicht lesbar, nicht in der
  Sicherung“). Ist eine PDF wirklich verloren, nennt die Meldung den Weg
  zur Rettung. Ersetzt A-01.
- **B-09 · Leisten liegen über den Noten** (2026-10-13): Wunsch Marlon: Die
  Noten nutzen immer den ganzen Bildschirm (nur Notch und Home-Leiste
  bleiben frei); obere Leiste (Titel, Stellen, Ansicht, Stift) und untere
  Werkzeug-Leiste legen sich darüber, statt die Seite kleiner zu machen.
  Tippen in die Mitte schiebt **beide** hinaus und wieder herein — die Seite
  behält ihre Größe. Bibliothek und Dialoge holen die untere Leiste zurück;
  wer das Stück verlässt, hat beide wieder. Die Stellen-Zeile (‹ geschafft ›)
  bleibt im Stellen-Modus stehen und rückt über die Werkzeug-Leiste, solange
  die zu sehen ist.
- **B-10 · Stellen auffindbar** (2026-10-13): Wunsch Marlon: Neue Nutzer
  sahen nicht, wie man Stellen markiert. Der Schalter „Stellen“ steht jetzt
  bei jedem Stück, auch ohne Stellen; daneben ein „i“ mit der Erklärung (was
  Stellen können, wie man eine markiert: Stift → Werkzeug „Stelle“ → Rahmen
  um die Takte → Namen, Speichern). Dieselbe Erklärung erscheint, wenn man
  Stellen ohne eine einzige einschaltet; Tippen irgendwo schließt sie, der
  Schalter geht wieder aus. Die „Ansicht der Stelle“ ist entfallen: Etwas
  Rand ist immer an, „Heranzoomen“ ist weg (zoomte bei breiten Stellen kaum
  und war unnötig — geübt wird im großen Notenbild).
- **B-11 · Stellen markieren: Rahmen und Hinweis** (2026-10-13): Wunsch
  Marlon: Beim Lesen (Schalter „Stellen“ aus) störten die gestrichelten
  Rahmen der Stellen. Sie erscheinen jetzt nur, solange die Stift-Palette
  offen ist — dort braucht man sie, um neue Stellen zu setzen. Im
  Stellen-Modus zeigt ohnehin der helle Ausschnitt die Stelle. Der Hinweis
  „Rahmen um die Takte ziehen.“ (ebenso der zum Werkzeug „Text“) verblasste
  nach drei Sekunden und ließ ein leeres Kästchen zurück; er bleibt jetzt
  stehen, bis man die Stelle benennt bzw. den Text schreibt oder das
  Werkzeug wechselt. Nur der Hinweis zur Blätterlinie verblasst weiter —
  dort bleibt „Fertig“ im Kästchen.
- **E-06 · Zoomen beim Anmerken** (2026-10-13): Wunsch Marlon: Notizen
  mit dem Stift fielen schwer — bei offener Stift-Palette lässt sich jetzt
  heranzoomen. Regeln in `src/domain/zoom.ts` (getestet).
  - **Bedienung:** Zwei Finger zoomen und schieben (bis 600 %), ein Finger
    schiebt, solange gezoomt ist (statt zu blättern); mit „auch mit dem
    Finger“ zeichnet ein Finger, zwei zoomen. Am Rechner Strg + Mausrad bzw.
    Zwei-Finger-Zoom am Trackpad, das Rad schiebt; dazu oben rechts − / % / +
    (Tipp auf die Prozentzahl: ganze Seite).
  - **Über den Rand hinaus:** Verschieben geht so weit, dass jeder Punkt der
    Seite in die Bildschirmmitte kommt — auch der Rand; daneben bleibt leere
    Fläche. So lässt sich am Rand bequem schreiben.
  - **Scharf:** Kurz nach dem Zoomen rendert die App den sichtbaren Teil
    (mit etwas Rand) in Bildschirmschärfe nach, samt Markierungen und
    Anmerkungen; auch der laufende Strich ist scharf.
  - **Zurück auf ganz:** Palette zu, andere Seite oder Stelle, andere
    Fenstergröße. Kaum gezoomt (unter 108 %) rastet beim Loslassen ein.
- **E-07 · Radierer schneidet, Breite wählbar** (2026-10-13): Wunsch Marlon:
  Der Radierer nahm ganze Striche weg. Jetzt verschwindet nur, worüber er
  fährt — eine lange Linie, in der Mitte radiert, wird zu zwei. Texte gehen
  weiterhin ganz weg. Schnelle Wische werden lückenlos nachgezogen.
  Tipp auf den aktiven Radierer: vier Breiten (Fein, Mittel = bisher,
  Breit, Sehr breit), gemerkt im localStorage (`ueben:radierer`); unter
  Stift oder Maus zeigt ein Kreis die Breite. Die Stücke eines Strichs
  bekommen neue ids, die alte landet in `entfernt` — eine Sicherung bringt
  den ganzen Strich nicht zurück. Regeln in `strichKappen`/`radierZug`
  (`src/domain/notenpult.ts`, getestet).
- **E-08 · Pipette und Farbwähler** (2026-10-13): Wunsch Marlon: In der
  Farb-Blase fällt Gold (oben rechts) weg; die rechte Spalte hat oben die
  **Pipette**, unten den **Farbwähler**.
  - **Pipette:** antippen, dann aufs Blatt tippen — die Farbe an der Stelle
    (PDF, Markierungen, eigene Anmerkungen; neben einem dünnen Strich zählt
    der Strich) gilt fürs Werkzeug. Die Pipette trägt danach diese Farbe
    und den Auswahlring. Beim Marker rechnet sie so zurück, dass er auf
    weißem Papier genau den angetippten Ton ergibt. Gemerkt je Werkzeug
    (`ueben:pipette`).
  - **Farbwähler:** Feld für Sättigung und Helligkeit, Farbton-Leiste,
    Regler R/G/B, Hex-Feld; die Spitze des Werkzeugs zeigt die Farbe
    sofort. Selbst gebaut im Stil der Palette (keine neue Abhängigkeit).
  - **Daten:** Stift und Text speichern eigene Farben als `#rrggbb`, der
    Marker als `rgba(r, g, b, 0.4)`. Gespeicherte Einstellungen in Gold
    bleiben gültig (gelten als eigene Farbe). Regeln in `src/domain/farbe.ts`
    und `src/domain/stift.ts` (getestet).
- **F-15 · Ausschnitt je Seite** (2026-10-13): Wunsch Marlon: je Seite
  einstellen, welcher Bereich angezeigt wird, und das behalten — z. B. ohne
  die breiten Ränder eines Scans. Regeln in `src/domain/ausschnitt.ts`
  (getestet).
  - **Einstellen:** Ansicht → „Seite n zuschneiden“. Die ganze Seite mit einem
    Rahmen; an Ecken und Kanten ziehen, in der Mitte verschieben, daneben neu
    aufziehen (mindestens 15 % der Seite). „Ganze Seite“ setzt zurück, „Für
    alle n Seiten“ übernimmt den Rahmen für jede Seite. Die Leisten weichen,
    solange man einstellt.
  - **Anzeige:** Der Ausschnitt füllt den Platz, die Seite wird dafür
    entsprechend schärfer gerendert. Beim Halbseiten-Blättern gilt der
    Bereich, der beide Ausschnitte umfasst. Stellen, Anmerkungen und Linien
    bleiben in Seiten-Koordinaten — Zeichnen trifft auch im Ausschnitt genau.
  - **Daten:** am Stück `ausschnitte` (je Seitennummer `{x, y, b, h}` in
    Anteilen der Seite; ganze Seite = kein Eintrag), reist in der Sicherung
    mit. Kein Schema-Sprung.
- **B-08 · Blättern mit Scroll-Ring** (2026-10-13): Wunsch Marlon: mit einem
  Bluetooth-Scroll-Ring („TikTok-Ring“, z. B. ZL-03) die Noten blättern, ohne
  die Hände vom Instrument zu nehmen. Am iPhone läuft so ein Ring über
  AssistiveTouch und wischt wie ein Finger — je nach Modus hoch/runter
  (Video) oder links/rechts (Lesen). Regeln in `src/domain/geste.ts`
  (getestet).
  - **Auf den Noten:** Wischen nach oben oder links blättert weiter, nach
    unten oder rechts zurück (ab 40 px; vorher nur waagrecht ab 60 px). Ein
    Wisch, der als Maus-Zeiger über den Rand der Noten hinausläuft, zählt
    trotzdem. Mausrad und Trackpad: eine Bewegung blättert genau eine Seite
    (Nachlauf zählt nicht). Pedale wie bisher (Pfeil-, Bild-Tasten,
    Leertaste). Im Stellen-Modus und im Mix geht es Stelle für Stelle.
    Tippen bleibt: Rand blättert, Mitte blendet die Leiste aus und ein.
  - **Einstellungen → „Blättern mit Scroll-Ring oder Pedal“:** Schalter
    „Hoch und runter tauschen“ (localStorage `ueben:wisch-umkehren`),
    Anleitung fürs iPhone (AssistiveTouch, Zeiger-Punkt mitten auf die
    Noten) und ein Feld zum Ausprobieren, das zeigt, was ankommt (Richtung,
    Weg in px, als Berührung oder Zeiger, Taste, Mausrad) und bei zu kurzen
    Wischen rät, die Zeiger-Geschwindigkeit am iPhone höher zu stellen.
  - Ring-Modi, die nur Lautstärke- oder Kamera-Tasten senden, kommen bei
    einer Web-App nicht an.
- **C-04 · Tonprofil** (2026-10-12): Wunsch Marlon: die Töne des eigenen
  Instruments kennenlernen — welche zu hoch, welche zu tief liegen. Name
  entschieden: **Tonprofil** (aus den Vorschlägen; funktioniert als Knopf).
  Regeln in `src/domain/tonprofil.ts` (getestet).
  - **Einstieg:** Stimmgerät → „alles“ → „Tonprofil — Ton für Ton messen“.
    Tiefster und höchster Ton wählbar (gemerkt), chromatisch oder ohne
    Vorzeichen; notiert wie im Stimmgerät (Stimmung, Kammerton).
  - **Messen, geführt:** Die App nennt den Ton, man hält ihn gut eine Sekunde;
    nur dieser Ton zählt (Stille, andere Töne nicht), Ergebnis ist der Median
    von 20 Ablesungen — Ansatz und Ausreißer fallen kaum ins Gewicht. Zurück,
    Überspringen, vorzeitig fertig. Das Mikrofon geht von selbst an und, wenn
    die App es selbst eingeschaltet hat, danach wieder aus.
  - **Ergebnis:** Kennzahlen (Ø Abweichung, wie viele sauber ±5, am
    stärksten daneben — je mit dem Wert der vorigen Messung), Diagramm mit
    Balken je Ton nach oben (zu hoch) bzw. unten (zu tief) um ein
    Sauber-Band, die vorige Messung als Ringe; antippen zeigt den Wert.
    „Darauf achten“ listet die auffälligsten Töne mit Tipp (tiefer ansetzen /
    höher ansetzen, gut stützen), dazu eine Tabelle aller Töne.
  - **Entwicklung:** Jede Messung wird datiert gespeichert (ideal
    wöchentlich); Vergleich mit einer frei wählbaren älteren („x von y Tönen
    näher an sauber“). Einzelne Messungen lassen sich löschen.
  - **Tonleiter sauber spielen:** Grundton + Dur/Moll → je Stufe die Neigung
    des eigenen Instruments; die Terz mit der Regel aus der Recherche
    verrechnet (rein: Dur-Terz 386 statt 400 Cent → etwa 14 tiefer,
    Moll-Terz 316 statt 300 → etwa 16 höher; Quarte und Quinte praktisch
    rein), z. B. „mit deinen −20 also etwa 6 höher ansetzen“.
  - **Daten:** im localStorage `ueben:tonprofile` (`{id, am, stimmung,
    kammerton, toene: [{midi, cent}]}`, Töne notiert als MIDI-Zahl); in der
    Sicherung als optionales Kopf-Feld `tonprofile`, beim Laden vereinigt,
    gelöschte reisen als Grabstein mit. Kein Schema-Sprung.
- **F-14 · Tags** (2026-10-12): Wunsch Marlon: Stücke mit eigenen, farbigen
  Tags markieren — anders als Sammlungen: „Wichtig üben — kann noch wenig“
  (rot), „Mein Solo“ (blau), „Wenige Stellen“ (gelb), „Kann ich“ (grün).
  Regeln in `src/domain/tags.ts` (getestet).
  - **Tags anlegen** in den Einstellungen (Name + eine von 9 Farben;
    umbenennen, umfärben, löschen — die Stücke bleiben). Ohne Tags bietet die
    App Marlons vier als Vorschlag an („Diese vier anlegen“). Neue Tags auch
    direkt beim Markieren.
  - **Markieren** im Auswahl-Modus („Tags …“, mehrere Stücke auf einmal, Häkchen
    halb bei „manche“) und im Stück-Blatt („Tags: … ändern“). Ein Stück kann
    mehrere Tags tragen.
  - **Anzeige:** Jede Zeile der Bibliothek zeigt ihre Tags als Punkt + Name
    (nie Farbe allein); eigene Filterzeile unter den Sammlungen (ein Tag oder
    keiner, mit Sammlung kombinierbar).
  - **Stellen-Mix je Tag** (auch mit Sammlung: „Mix Märsche · Wichtig üben“),
    eigene Runde je Bereich.
  - **Hinzufügen bei gewähltem Tag** genauso deutlich wie bei Sammlungen:
    Abzeichen auf „+ Noten“, im Menü hervorgehoben „Mit ● „Wichtig üben“
    markieren“ mit Schalter, Meldung danach.
  - **Daten:** Definitionen `{id, name, farbe, geaendert}` im localStorage
    `ueben:tags` (ein Tag gibt es auch, solange kein Stück ihn trägt), an den
    Stücken nur die ids (`tags`). In der Sicherung als optionales Kopf-Feld
    `tags`; beim Laden je Tag der neuere Stand, gelöschte Tags reisen als
    Grabstein mit. Kein Schema-Sprung.
  - **Farben:** aus der geprüften Diagramm-Palette (Farbsehschwäche,
    Kontrast); für dunkle Welten eigene Stufen (Gelb dunkler, damit es sich
    von Rot abhebt).
- **F-13 · Sammlungen — und Stellen-Mix je Sammlung** (2026-10-12): Wunsch
  Marlon: Stücke einordnen („Orchester A“, „Märsche“, „Jazz“ …) und gezielt
  in einer Sammlung Stellen üben. Regeln in `src/domain/sammlungen.ts`
  (getestet).
  - **Sammlungen statt Ordner:** Jedes Stück trägt eine Liste von Namen
    (`sammlungen`), ein Stück kann in mehreren sein und liegt trotzdem nur
    einmal auf dem Gerät. Eine Sammlung gibt es, solange ein Stück sie trägt.
    Kein Schema-Sprung (Feld am Noten-Datensatz), reist in der Sicherung mit.
  - **Bibliothek:** Filterzeile „Alle · Jazz 2 · Märsche 5 · … · + Sammlung“;
    die gewählte Sammlung steht darunter („Sammlung „Märsche“ · 5 Stücke ·
    bearbeiten“: umbenennen, auflösen — die Stücke bleiben). Einsortieren im
    Auswahl-Modus („In Sammlung …“, Häkchen halb bei „manche“) und im
    Stück-Blatt („Sammlungen: … ändern“).
  - **Hinzufügen bei gewählter Sammlung — deutlich gekennzeichnet:** „+ Noten“
    trägt dann ein Messing-Abzeichen, das Menü zeigt oben hervorgehoben „In
    „Märsche“ einsortieren“ mit Schalter (bei jeder Filterwahl wieder an), die
    Meldung danach sagt es noch einmal.
  - **Ordner übernehmen** („+ Noten → Ordner wählen“, auch in der leeren
    Bibliothek; auf dem iPhone ab iOS 18.4 laut Kompatibilitätstabelle, auf
    dem Gerät noch zu prüfen): alle PDFs samt Unterordnern; Unterordner
    werden Sammlungen, der gewählte Ordner nur, wenn die PDFs direkt darin
    liegen. Einmal gelesen, kein dauerhafter Ordnerzugriff (kann Safari nicht).
  - **Nichts doppelt:** Beim Hinzufügen (Dateien wie Ordner) wird eine Datei,
    die schon in der Bibliothek liegt (gleicher Name und gleiche Größe — neu
    gespeichert als `groesse`), nicht noch einmal angelegt, nur einsortiert;
    dieselbe Datei in mehreren Unterordnern wird ein Stück in mehreren
    Sammlungen; gleicher Name mit anderer Größe (etwa „Klarinette 1.pdf“ je
    Stück-Ordner) bleiben verschiedene Stücke. Nicht lesbare Dateien (nur in
    iCloud) werden übersprungen und genannt. Die PDF liegt auf dem iPhone
    zwangsläufig einmal in der App und einmal in iCloud — Safari kann sich
    keinen Verweis auf eine iCloud-Datei merken.
  - **Stellen-Mix je Sammlung:** Die Mix-Karte mischt, was gefiltert ist
    („Stellen-Mix · Märsche“, Kopf „Mix Märsche · 3 von 14“); jede Sammlung
    hat ihre eigene Runde. Schalter **„Nur offene Stellen“**: nur Stellen ohne
    Ziel oder mit Ziel + Reserve noch nicht geschafft; schon geübte und die
    aktuelle bleiben in der laufenden Runde.
- **H-01 (erster Teil) · Sicherung: Uhrzeit, Erinnerung, neuer gewinnt,
  Gelöschtes reist mit** (2026-10-12): Dateiname `Uebe-Sicherung 2026-10-12
  18.30.uebe`. Die Einstellungen zeigen „Letzte Sicherung: …“ (gemerkt beim
  Herunterladen bzw. Teilen, `ueben:letzte-sicherung`); die Bibliothek
  erinnert, wenn sie älter als 7 Tage ist und sich seitdem etwas geändert
  hat. Beim Laden gilt bei gleicher id der **neuere Stand** (neues Feld
  `geaendert` an Noten, Stellen und Seiten); Tempi werden weiter vereinigt;
  die PDF kommt aus der Sicherung, wenn sie dort nicht älter ist.
  **Wegradiertes bleibt weg** (Seiten merken `entfernt`), **Gelöschtes reist
  mit** (Grabsteine in `ueben:geloescht`, im Sicherungskopf `geloescht`, ein
  Jahr lang): dort gelöscht und hier unverändert → hier gelöscht (die
  Rückfrage nennt es); hier gelöscht → eine ältere Sicherung legt es nicht
  wieder an. Getestet in `src/domain/einspielen.ts`, dazu ein Durchlauf mit
  zwei Geräten im Browser.
- **F-12 · Zieltempo und Tempo-Verlauf je Stelle** (2026-10-12): Wunsch
  Marlon: jeder Stelle ein Endziel geben („120 auf Viertel“) und sehen, wie
  sich das Tempo entwickelt — „die letzten drei Wochen +20 %“ —, mit dem Ziel
  als Deckel und einer Reserve darüber (Stellen 10 % schneller üben, als sie
  müssen, falls der Dirigent im Konzert flotter wird).
  - Tipp auf den Namen der Stelle in der Stellen-Leiste öffnet das
    Stellen-Blatt: Zieltempo setzen (Schläge pro Minute wie im Metronom,
    20–400), Kennzahlen **Bestes** · **Zum Ziel** (% und was fehlt, „✓ mit
    Reserve“) · **3 Wochen** (Bestes heute gegenüber dem Besten bis vor drei
    Wochen; ist alles jünger, seit dem ersten Übetag), die Kurve und eine
    Tabelle aller Übetage. Beim Anlegen einer Stelle gibt es ein optionales
    Feld „Ziel ♩“. „Geschafft“ meldet „Ziel erreicht!“ bzw. „Ziel mit
    Reserve!“.
  - Kurve (`TempoKurve.tsx`): je Übetag das Beste als Linie, alle geschafften
    Tempi als leise Punkte — Aufwärmen bleibt sichtbar, zieht die Linie aber
    nicht runter —, Ziel gestrichelt, Reserve (+10 %) als Band darüber.
    Antippen zeigt den Tag in einer Ablesezeile darüber. Kurvenfarbe als
    eigenes Token `--kurve` je Farbwelt (dunkel eine Stufe tiefer, geprüft).
    Im Stück-Blatt hat jede geübte Stelle eine kleine Kurve (statt der
    Textzeile „Verlauf: …“).
  - Regeln getestet in `src/domain/stellen.ts` (`tagesbeste`, `steigerung`,
    `zielStand`, `reserveVon`, `zielAusText`, `tempoAchse`). Daten: das
    Feld `zielTempo` gab es schon — kein Schema-Sprung, die Sicherung trägt
    Ziel und alle Tempi wie bisher.
  - Offen, falls gewünscht: Notenwert des Ziels (etwa „𝅗𝅥 = 60“ bei Alla
    breve) — derzeit gilt die Einheit des Metronoms; Reserve fest 10 %.
- **F-11 · Stellen-Mix** (2026-10-12): Wunsch Marlon: Stellen aus *allen*
  Stücken üben, ohne erst ein Stück auszusuchen — mit Abwechslung, und so,
  dass keine Stelle übersehen wird. Einstieg oben in der Bibliothek (Karte
  „Stellen-Mix“, zeigt „6 Stellen aus 3 Stücken“ bzw. „Weiter bei 4 von 6“
  und „Neu mischen“). Regeln (`src/domain/stellen.ts`, getestet):
  - Eine **Runde** enthält jede markierte Stelle genau einmal, gemischt; nie
    zwei Stellen desselben Stücks hintereinander, solange es anders geht
    (gewichtet nach offenen Stellen je Stück, damit sich große Stücke über
    die Runde verteilen).
  - Neue Stellen kommen gemischt in den noch offenen Teil der Runde,
    gelöschte fallen weg; Geübtes bleibt vorn. Nach der letzten Stelle:
    „Runde geschafft“ → neue Runde.
  - Geübt wird im gewohnten Stellen-Modus des Notenbetrachters (‹ › gehen
    durch die Runde, über Stückgrenzen hinweg; Kopf „Mix · 4 von 27“).
    Stellen-Schalter aus = Mix verlassen, das Stück bleibt zum Lesen offen.
  - Die Runde liegt auf dem Gerät (localStorage `ueben:mix`, an/aus in
    `ueben:mix-an`) — nach einem App-Wechsel oder Neustart geht es an
    derselben Stelle weiter. Sie reist nicht mit der Sicherung.
- **D-04 · Metronom folgt der Stelle** (2026-10-12): Kommt beim Üben eine
  Stelle dran (Blättern, Stellen-Modus einschalten, Stellen-Mix), steht das
  Metronom automatisch auf dem Tempo, bei dem sie **zuletzt geschafft** wurde.
  Nur beim Wechsel — −1/+1 und „geschafft“ bleiben, wie sie sind. Ist noch
  kein Tempo geschafft, bleibt das Metronom stehen; „♩ … laden“ (zuletzt
  geschafft, sonst Zieltempo) bleibt als Knopf. Regel `tempoStand` in
  `src/domain/stellen.ts`.
- **B-07 · Bibliothek aufgeräumt** (2026-10-12): Statt großer, teils
  zweizeiliger Knöpfe eine Werkzeugzeile **+ Noten · Zuletzt/A–Z ·
  Auswählen**; die Stücke als ruhige Liste mit Haarlinien (Titel, Stimme,
  zuletzt, Zahl der Stellen). Häkchen, Aktualisieren und Löschen erst im
  Auswahl-Modus (wie „Auswählen“ in der Dateien-App; Tipp auf die Zeile
  wählt aus, „Fertig“ beendet) — „Alle aktualisieren“ ist jetzt „Auswählen →
  Alle → Aktualisieren“. Kopf „Bibliothek · 9 Stücke“ bzw. „· 2 gewählt“,
  Zahnrad und Schließen rechts beisammen.
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
