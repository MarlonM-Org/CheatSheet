# Roadmap & Backlog

Langfristige Planung für CheatSheet. Dieses Dokument ist die gemeinsame
Arbeitsgrundlage für alle Entwickler: Wer etwas anfängt, trägt sich hinter dem
Punkt ein; wer etwas fertigstellt, hakt ab und verschiebt den Punkt nach
„Erledigt“ (unten). Größere Richtungsentscheidungen bitte als kurzen Absatz
hier dokumentieren, nicht nur im Chat.

Stand: 2026-10-26.

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

*MIDI und Begleitung* stehen ebenfalls oben. Seit 2026-10-26 sind
**Vorspielen der eigenen Notation** (Instrumente, Begleitung, Einspielen
Takt für Takt) und **Song-Transkription** als Vision G-04…G-07
aufgenommen. Die App bleibt on-device; die schwere Song-Transkription
kann ein separates Werkzeug sein (Rechner oder Server), Schnittstelle ist
MusicXML — Einschätzung in G-08. Vor der Umsetzung entscheidet Marlon, ob
„MIDI, Audio-Begleitspuren, Soundbearbeitung“ dafür aus der Außen-vor-Liste
genommen wird.

## Meilensteine (Reihenfolge)

| # | Meilenstein | Inhalt | Backlog-Punkte |
|---|---|---|---|
| M1 | **Fundament aufräumen** | Datenmodell klären, Tests für die Speicherschicht (A-01 verworfen) — *erledigt 2026-10-12* | A-02, A-03 |
| M2 | **Noten im Zentrum** | UI-Neuaufbau: Noten vollflächig, Werkzeuge als Overlays, drei Knöpfe unten | B-01…B-03 |
| M3 | **Werkzeuge schärfen** | Stimmgerät- und Metronom-Verbesserungen, Stift-Ausbau | C-01…C-03, D-01, E-01…E-03 |
| M4 | **Notenmanagement I** | Metadaten, Flags, Drag & Drop (Sammlungen F-13, Lesezeichen/virtuelle Stücke F-03 und Kontext-Blatt F-08 erledigt) | F-01, F-04, F-09 |
| M5 | **Üben & Setlisten** | Setlisten (Stellen-Mix F-11, Tonprofil C-04, Sprünge F-05, Halbseiten-Blättern F-06, Blättern je Seite F-16 und Favoriten im Mix F-17 schon erledigt) — *zurückgestellt 2026-10-23: Marlon ordnet bisher über Dateinamen, Setlisten sind Zukunftsthema* | F-02 |
| M6 | **Extras** | Stempel/Formen (Kamera-Scan F-07, Themes B-04 und Design B-05 erledigt) — *vorgezogen 2026-10-23, vor M4 und M5* | E-04 |
| M7 | **Komponieren** (Vision) | Noteneingabe, Rhythmus-/Melodie-Transkription; Ausbau: Vorspielen, Einspielen Takt für Takt, Song-Transkription, Klänge; Ort offen: App oder separates Werkzeug (Wunsch 2026-10-26) | G-01…G-08 |
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

**Vorgezogen 2026-10-23 (Wunsch Marlon).** Bedienmuster: in der
Stiftpalette ein Werkzeug „Stempel“ → Palette mit Symbolen (Atemzeichen,
Fermate, Akzent, Staccato, Dynamik p/mp/mf/f/ff, Crescendo/Decrescendo-Keil,
Fingersätze 1–5, Bogen, Wiederholungs- und Sprungzeichen, Pfeil, Haken) →
antippen platziert das Symbol, ziehen verschiebt, Zwei-Finger skaliert;
gewähltes Symbol hat Rahmen wie der Sticker (E-12), Löschen über den
Rahmen. Farbe aus der Stiftpalette. Gespeichert als Anmerkung mit Art
`stempel` (Symbol-Kennung, Lage, Größe, Farbe) — Regeln in `src/domain/`,
Schema per Versionssprung mit Migrationstest. Dasselbe Muster soll später der
Komponier-Editor (G-01) nutzen.

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

*(F-03 Lesezeichen und virtuelle Stücke am 2026-10-23 erledigt, siehe unten.)*

### F-04 · Flags

Flüchtige Merker: Seite markieren, Liste aller Flags (je Stück und global),
alle auf einmal löschen. Bewusst leichtgewichtiger als Bookmarks.
Speicher steht (A-02): `merker`, einer je Seite.

*(F-05 Sprünge und F-06 Halbseiten-Umblättern am 2026-10-13 erledigt, siehe unten.)*

*(F-07 Kamera-Scan und Foto-Import am 2026-10-23 erledigt, siehe unten.)*

*(F-08 Kontext-Blatt am 2026-10-23 erledigt, siehe unten.)*

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

**Konkretisiert (2026-10-23, Wunsch Marlon):**

- **Einstieg über „+ Noten“:** neben „PDF-Dateien wählen“ und „Ordner
  wählen“ ein dritter Punkt „Neues Stück schreiben“. Ist eine Sammlung oder
  ein Tag gewählt, gilt dasselbe wie beim Import: das neue Stück wird dort
  einsortiert bzw. markiert.
- **Eigene Ansicht zum Komponieren:** ein Editor als eigener Bildschirm
  (nicht im Betrachter), mit Palette zum **Antippen und Platzieren** statt
  Tastatur-Syntax: Notenschlüssel (Violin, Bass, …), Taktart (Zähler und
  Nenner wie beim Metronom), Tonart/Vorzeichen, Noten in allen Werten,
  Pausen, Punktierung, Bindebögen, Taktstriche und Wiederholungszeichen.
  Elemente wählen, einfügen, verschieben, löschen — wie Stempel.
- **Speichern wie jedes andere Stück:** Das komponierte Stück landet als
  Stück in der Bibliothek (`Stueck` + Seiten) mit einer gerenderten PDF in
  `dateien`, damit Betrachter, Stift, Stellen, Metronom und Setlisten ohne
  Sonderweg funktionieren. **Zusätzlich** bleibt die Quelle (ABC oder
  MusicXML) am Stück gespeichert — nur so lässt es sich später wieder
  bearbeiten. Datenmodell: neues optionales Feld am `Stueck` (z. B.
  `quelle`-Text samt Format), Schema per Versionssprung mit Migrationstest;
  reist mit der Sicherung (`.uebe` bleibt Version 1, wer das Feld nicht
  kennt, überliest es). Nach dem Bearbeiten wird die PDF neu erzeugt, die
  alten Seiten-Anmerkungen bleiben erhalten (Seitenzahl kann sich ändern —
  Regel dafür in `src/domain/` zuerst als Test).
- **Nachträglich bearbeiten:** Stücke mit Quelle bekommen in der Bibliothek
  bzw. im Kontextmenü (F-08) einen Punkt „Bearbeiten“, der den Editor mit
  der gespeicherten Quelle öffnet. Stücke ohne Quelle (importierte PDFs)
  haben den Punkt nicht.
- **Export als Datei:** die PDF teilen/herunterladen wie andere Stücke, plus
  die Quelle (`.abc` bzw. `.musicxml`) als eigene Datei, damit sie in
  Notensatz-Programmen weiterlebt. Umgekehrt: eine `.abc`-/`.musicxml`-Datei
  über „+ Noten“ importieren → wird gerendert und ist bearbeitbar.
- **Sammlungen, Tags, Setlisten, Metadaten:** nichts Eigenes — ein
  komponiertes Stück ist ein Stück wie jedes andere.
- **Empfehlung Technik:** abcjs mit ABC als Quelle (Rendern als SVG, PDF
  daraus; Speichern, Sichern und Wiederbearbeiten sind dann Text). VexFlow
  nur, falls die Palette feinere Platzierung braucht, als ABC hergibt.
- **Reihenfolge:** G steht laut Leitbild hinter M2–M6; offen ist M6
  (Themes B-05, Stempel/Formen E-04, Kamera-Scan F-07) sowie aus M4/M5
  F-01…F-04, F-08, F-09. Ob G-01 vorgezogen wird, entscheidet Marlon. Die
  Stempel-Palette aus E-04 und der Editor sollten dasselbe
  Bedienmuster teilen (Element wählen → antippen/platzieren → verschieben).

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

### G-04 · Vorspielen: Noten hörbar machen (Instrumente, Begleitung)

Wunsch Marlon (2026-10-26): Was als Noten in der App liegt (G-01 geschrieben
oder G-02/G-03 transkribiert), soll die App **vorspielen** können — mit
wählbarem Instrument je Stimme, und so, dass man sich **begleiten lassen**
kann: eigene Stimme stumm, die anderen laufen, Tempo wie im Metronom.

**Einschätzung:** gut machbar, rein lokal. abcjs bringt einen Synth mit
(`abcjs/synth`), der ABC-Stimmen über General-MIDI-Instrumente abspielt;
die Instrumentklänge (Soundfont-Samples) liegen dann in `public/` und
kommen über den Vorab-Cache offline mit (je Instrument einige MB — nur die
gewählten laden, nicht alle 128). Instrumentwahl = MIDI-Programmnummer je
ABC-Stimme (`%%MIDI program`), reist in der Quelle mit. Stummschalten,
Lautstärke je Stimme, Metronom-Klick dazu und Einzählen sind Kleinkram
darauf. Grenze: ein Synth, keine „echten“ Aufnahmen — es klingt nach
Übe-Begleitung, nicht nach Band.

**Leitbild:** „MIDI, Audio-Begleitspuren“ stehen bewusst außen vor. Das hier
ist keine Begleitspur als Audio-Datei, sondern das Abspielen der eigenen
Notation — trotzdem entscheidet Marlon vor dem Start, ob das Leitbild dafür
geöffnet wird (dann dort anpassen).

### G-05 · Einspielen Takt für Takt (Aufnehmen → Transkribieren → Einfügen)

Wunsch Marlon (2026-10-26): Aus G-04 eine Art **Sampler/Backing-Track-Bauer**:
Stimmen zusammenstellen, darüber spielen oder singen, das Gespielte wird
aufgenommen und — wenn man es behalten will — transkribiert und als neue
Stimme bzw. als nächster Takt eingefügt. So entsteht ein Stück Takt für Takt.

**Einschätzung:** machbar als Verbund aus G-02, G-03 und G-04; der
Kreislauf ist der eigentliche Wert, nicht ein einzelnes Modell:

- Begleitung läuft (G-04), Mikrofon nimmt auf; Takt und Tempo sind bekannt,
  deshalb kann die App auf dem Metronom-Raster quantisieren (G-02) statt
  den Takt raten zu müssen. Latenz zwischen Abspielen und Aufnahme muss
  einmal gemessen und abgezogen werden (Einzähl-Klick als Referenz).
- Einstimmig (eine Stimme vorsingen, Trompete, Bass): Tonerkennung ist
  heute schon da (`grundfrequenz`/YIN im Stimmgerät); für saubere Noten
  braucht es Glätten, Oktav-Korrektur und Mindestdauer je Ton (G-03).
  Ergebnis immer als **Vorschlag** zeigen und im Editor (G-01) korrigieren
  lassen — Erkennung wird nie fehlerfrei sein, deshalb ist der Editor die
  Voraussetzung, nicht die Kür.
- Wiedergabe der eigenen Aufnahme bleibt Audio (Blob im Speicher, nicht in
  IndexedDB — s. CLAUDE.md); gespeichert wird nur die Transkription.

### G-06 · Ganze Songs transkribieren (Audio-Datei → Stimmen)

Wunsch Marlon (2026-10-26): einen Song als Datei hineinschieben (Beispiel:
Metallica) und Noten daraus bekommen, möglichst nach Stimmen getrennt.

**Einschätzung — ehrlich:** die „Endstufe“, und die mit dem größten
Abstand zwischen Wunsch und dem, was dabei herauskommt.

- **Technisch im Browser möglich:** Audio lokal dekodieren (Web Audio), dann
  *Quellentrennung* (Demucs läuft als WebAssembly komplett im Browser,
  Vorbild freemusicdemixer.com: Gesang, Bass, Schlagzeug, Rest) und je
  Stimme *Audio → MIDI* (Basic Pitch von Spotify, Apache-2.0, läuft mit
  TensorFlow.js im Browser, Vorbild basicpitch.io). Beides „on-device“,
  passt also ins Leitbild.
- **Kosten:** Modelle sind groß (Demucs ≈ 80 MB je Modell, Basic Pitch
  wenige MB) — nicht in den Vorab-Cache, sondern erst bei Bedarf laden und
  im Cache halten. Ein Song dauert auf dem Telefon Minuten und braucht viel
  Arbeitsspeicher; auf dem iPhone ist Scheitern wegen Speicher realistisch.
- **Qualität:** Einstimmiges (Gesangslinie, Basslinie) wird brauchbar grob.
  Verzerrte Gitarren, Akkorde, Schlagzeug: Basic Pitch liefert Notenwolken,
  kein spielbares Blatt. Realistisches Ziel ist ein **Lead Sheet als
  Rohfassung** (Melodie + Bass + Tempo/Taktgerüst), das man im Editor
  nachbessert — nicht „Metallica-Partitur auf Knopfdruck“. Das muss in der
  Oberfläche auch so heißen („Entwurf“).
- **Reihenfolge:** erst G-05 (einstimmig, mit bekanntem Takt) solide, dann
  G-06. Wer G-06 vorzieht, baut auf Sand: ohne Editor und Quantisierung ist
  die Rohfassung wertlos.
- **Recht:** Dateien bleiben auf dem Gerät, Transkription fürs eigene
  Üben. Die App teilt nichts — das bleibt so.

### G-07 · Klänge einstellen (Endstufe)

Wunsch Marlon (2026-10-26): die Instrumentklänge selbst einstellen.

**Einschätzung:** erst nach G-04 sinnvoll. Günstig: Instrument tauschen,
Lautstärke, Hall, Hüllkurve (Anschlag/Ausklingen) über Web Audio. Teuer
und laut Leitbild „Soundbearbeitung“ außen vor: eigene Samples, Effekte,
Mischpult. Vorschlag: nur die günstige Stufe, als Einstellung je Stimme in
der Quelle.

### G-08 · Wo läuft das? Offline-App, eigener Rechner oder Server (Einschätzung 2026-10-26)

Marlon (2026-10-26): Das muss nicht alles in der statischen Offline-App
passieren. Verwalten und Üben bleiben hier; Transkribieren und Komponieren
dürfen ein **separates Werkzeug** sein, auch mit Server, auch technisch ganz
neu. Bewertet werden soll, ob es überhaupt geht — und wenn es offline geht,
umso besser.

**Geht das überhaupt?** Ja, jeder Baustein existiert als freie Software oder
Produkt. Die Qualität hängt an der Quelle, nicht am Ort der Berechnung:

| Baustein | Stand der Technik | Qualität |
|---|---|---|
| Stimmen trennen (Gesang, Bass, Schlagzeug, Gitarre, Klavier, Rest) | Demucs (frei), Moises, LALAL.AI | Gesang, Bass, Schlagzeug sehr gut; Gitarre/Klavier brauchbar; „Rest“ ist Sammeltopf |
| Takt, Tempo, Tonart, Akkorde aus Audio | madmom, BeatNet, Chordify | gut — die Basis für sauberes Quantisieren |
| Gesang / einstimmiges Instrument → Noten | Basic Pitch, CREPE, Klangio „Sing2Notes“ | brauchbar; nachbessern nötig (Tonlängen, Oktaven) |
| Klavier → Noten | ByteDance-Modell, Onsets and Frames, Klangio „Piano2Notes“ | gut, praktisch gelöst |
| Bass (nach Trennung) → Noten | Basic Pitch | gut |
| Gitarre verzerrt, Riffs, Powerchords → Noten/Tabs | Forschung (TabCNN u. a.), Klangio „Guitar2Tabs“ | mäßig: Riffs ja, Akkordvoicings und Mehrstimmiges oft falsch |
| Schlagzeug → Noten | Drum-Transkription (ADT) | Kick/Snare/Hi-Hat gut, Becken/Toms schwach |
| Ganzer Mix → mehrstimmige Partitur in einem Schritt | MT3 / YourMT3+ (Google-Forschung) | Rohfassung, bei dichten Rock-Mixen deutlich fehlerhaft |
| Notation abspielen, Instrumente wählen, Stimmen stumm, Backing-Track | abcjs-Synth, Tone.js, Soundslice, Flat.io, BandLab | gelöst, läuft komplett im Browser |
| Aufnehmen über Begleitung → Noten → bearbeiten | ScoreCloud, Soundslice „record“ | existiert, einstimmig brauchbar |

Kurz: **Melodie, Bass, Klavier, Grundgerüst (Takt/Akkorde): ja.** Ein
komplettes Metallica-Stück in alle Stimmen zerlegt als spielbare Noten:
**nirgends, auch nicht mit Server** — das Beste ist ein korrigierbarer
Entwurf. Wer heute dafür Geld nimmt (Klangio, AnthemScore, Moises), nennt
es genau so.

**Drei Orte, drei Preise:**

1. **In der Offline-App.** Vorspielen (G-04), Einspielen einstimmig (G-05),
   Melodie-Transkription (G-03) laufen vollständig im Browser, auch auf dem
   iPhone. Stimmen-Trennung ginge als WebAssembly, ist aber langsam (Minuten),
   speicherhungrig (iPhone bricht ab) und lädt ~80 MB Modell. Deshalb: alles
   außer G-06 hierhin.
2. **Auf dem eigenen Rechner, ohne Hosting.** Ein kleines Werkzeug (Python,
   Kommandozeile oder lokale Oberfläche), das Demucs, Takt-Erkennung und
   Basic Pitch hintereinanderschaltet und **MusicXML** ausgibt. Auf einem
   Laptop ein paar Minuten je Song, mit Grafikkarte Sekunden. Keine
   Cloud-Kosten, Songs verlassen das Gerät nicht, keine Rechtsfragen.
   Ergebnis geht über den geplanten MusicXML-Import (G-01) in CheatSheet.
3. **Als Server-Dienst.** Technisch identisch zu 2, nur gehostet (GPU bei
   Modal, RunPod, Hetzner; Vercel kann das nicht). Vorteil: vom Telefon aus.
   Nachteile: laufende Kosten, fremde Musik wird hochgeladen
   (Urheberrecht, Datenschutz), und ein zweites System ist zu betreiben.
   Lohnt erst, wenn 2 zeigt, dass die Ergebnisse den Aufwand wert sind.

**Empfehlung:**

- CheatSheet bleibt statisch. Die Grenze ist eine Datei: **MusicXML (oder
  ABC) rein, PDF plus Quelle raus.** G-01 plant den Import ohnehin; er ist
  die einzige Schnittstelle, die beide Seiten brauchen.
- G-04, G-05, G-03 kommen in die App, G-06 in ein separates Werkzeug
  (zuerst Variante 2, Server nur bei Bedarf). So bleibt das Leitbild
  unangetastet bis auf das Abspielen der eigenen Notation.
- **Vor jeder Zeile Code: ein Nachmittag Experiment.** Demucs + Basic Pitch
  gibt es fertig — Prüfstand mit Anleitung in
  `experimente/transkription/`; einen Song durchjagen, das MusicXML in MuseScore öffnen
  und ehrlich schauen, ob der Entwurf hilft oder frustriert. Alternativ
  Moises (Stems) und Klangio (Noten) mit demselben Song testen — wenn ein
  fertiges Produkt reicht, braucht es nur den Import in CheatSheet, kein
  eigenes Werkzeug. Das Ergebnis entscheidet, ob G-06 überhaupt gebaut
  wird.

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

- **B-15 · Doppeltipp in die Mitte: spielbereit** (2026-10-23): Wunsch
  Marlon. Ein Tipp in die Mitte blendet wie bisher die Leisten oben und
  unten aus und ein; ein **Doppeltipp** (zwei Tipps binnen 350 ms, nah
  beieinander) blendet die Leisten aus **und** stellt den Zoom: eine
  einzelne Seite wird auf die **Bildschirmbreite** gezogen (Oberkante oben,
  im Querformat also der obere Notenausschnitt, dann schieben), im
  Stellen-Modus liegt die **Mitte der Stelle** in der Bildschirmmitte; auf
  der **Doppelseite** geht der Zoom zurück auf ganz. Metronom- und
  Stimmgerät-Widgets bleiben. Im Hochformat füllt die Seite die Breite
  schon — dann nur Leisten weg. Danach sind Schieben und Zwei-Finger-Zoom
  auf dieser Seite erlaubt, auch ohne „Immer zoomen“; mit der nächsten
  Seite ist es vorbei. **Noch ein Doppeltipp** führt zurück zur ganzen
  Seite (Rückmeldung Marlon: nach dem Doppeltipp kam er auf dem iPad nicht
  mehr heraus) — der sichere Weg ohne Zwei-Finger-Geste; Erkennung mit
  450 ms und 60 px, eigene Uhr statt `e.timeStamp`. Regeln `anBreite` und
  `istDoppeltipp` in `src/domain/zoom.ts`, getestet; im Browser (Querformat,
  Touch, Maus) durchgespielt.
- **F-08 · Kontext-Blatt: ein Menü für alles, was ein Ding kann**
  (2026-10-23): Bestandsaufnahme (Vorschlag mit Mockups, von Marlon
  angenommen): Die Aktionen zu einem Stück lagen an drei Orten mit drei
  Mustern — Löschen und Datei neu wählen nur im Auswahl-Modus, Umbenennen
  nur im geöffneten Stück, Sammlungen und Tags doppelt. Jetzt **ein
  Kontext-Blatt** (`Kontext.tsx`), das überall gleich aufgeht: **Halten**
  (Langdruck, 450 ms, Bewegung bricht ab), **„⋯“** am Zeilenrand oder
  **Rechtsklick**; der Klick danach wird geschluckt (`useHalten`).
  Vorschaubild, Name, eine Zeile Fakten, darunter die Aktionen; Formulare
  (Umbenennen) erscheinen im selben Blatt.
  - **Stück** (Bibliothek: Zeile halten oder ⋯ statt „›“; Stück-Blatt: ⋯
    im Kopf): Öffnen, Umbenennen (Titel und Stimme), Sammlungen …, Tags …,
    Lesezeichen und Stellen … (öffnet das Stück mit Stück-Blatt), Eigene
    Stücke daraus … (öffnet den Abschnitt im Stück-Blatt), Datei neu wählen
    (nicht bei virtuellen), Löschen … mit derselben Rückfrage wie im
    Auswahl-Modus. Vorschaubild: erste Seite (bei virtuellen Stücken die
    Seite `von`) klein über pdf.js, danach wieder freigegeben.
  - **Stück-Blatt schlanker:** Zeilen „umbenennen“, „Sammlungen ändern“,
    „Tags ändern“ und der Abschnitt „Eigene Stücke aus diesem“ sind raus;
    eine Fakten-Zeile (Quelle, Sammlungen, Tags) und ⋯ ersetzen sie. Es
    zeigt, was man liest und übt: Lesezeichen und Stellen.
  - **Sammlung** (Chip halten, ⋯ im Sammlungs-Kopf statt „bearbeiten“):
    Nur diese Sammlung zeigen, Umbenennen, Stücke auswählen … (Auswahl-Modus
    mit Filter), Auflösen …
  - **Stelle:** ein Blatt für beide Orte. Das Stellen-Blatt (Stellen-Leiste:
    Name antippen; Stück-Blatt: Karte halten oder ⋯) hat jetzt oben die
    Aktionen (In den Noten zeigen, ♩ auf …, ✓ Geschafft bei …) und **„Name
    und Notiz …“**; das zweite Formular hinter „bearbeiten“ auf der Karte
    ist weg.
  - **Lesezeichen** (Stück-Blatt: Zeile halten oder ⋯): Zur Seite,
    Umbenennen oder Seite ändern, **Ab hier als eigenes Stück …** (bis vor
    das nächste Lesezeichen), Entfernen. Die Liste im Ansicht-Menü bleibt
    (Setzen braucht die aktuelle Seite).
  - **Bleibt:** der Auswahl-Modus für mehrere Stücke (Aktualisieren,
    Löschen, In Sammlung, Tags) — unverändert. Tags haben weiter ihr eigenes
    Tag-Blatt. Entscheidungen aus dem Vorschlag: Vorschaubild ja, Auswählen
    bleibt, Duplizieren kommt mit F-01 (Metadaten bekommen dann im
    Kontext-Blatt ihren Platz).
  - Nur Oberfläche, kein Schema-Sprung. Im Browser durchgespielt: ⋯ und
    Halten in der Bibliothek, Umbenennen, Lesezeichen → eigenes Stück,
    Sammlung halten → umbenennen, Löschen.
- **F-07 · Kamera-Scan und Foto-Import** (2026-10-23): Wunsch Marlon,
  vorgezogen. Unter „+ Noten“ zwei neue Punkte: **„Einscannen“** (Kamera,
  Seite für Seite) und **„Fotos wählen“** (vorhandene Bilder, mehrere auf
  einmal); auch in der leeren Bibliothek. Sammlung und Tag gelten wie beim
  Import.
  - **Dialog** (`Scan.tsx`, am body, über allem): große Vorschau der
    aktiven Seite, Stufe **Foto / Scan / Schwarz-Weiß** (je Gerät gemerkt,
    `ueben:scan-stufe`), **„Rand anpassen“** zeigt das Foto mit Viereck und
    vier ziehbaren Ecken, **Drehen** in 90°-Schritten, Seite entfernen,
    Reihenfolge ändern, Streifen mit Vorschaubildern, „+“ für weitere
    Aufnahmen; unten Titel und **„Fertig (n)“**.
  - **Kamera:** auf Touch-Geräten `<input type="file" accept="image/*"
    capture="environment">` (öffnet die Kamera direkt, eine Aufnahme je
    Durchgang); am Rechner eine Live-Kamera über `getUserMedia` mit
    „Auslösen“.
  - **Aufbereitung** rein in `src/domain/scan.ts` (getestet,
    `tests/scan.test.ts`), auf Pixelfeldern ohne Canvas und ohne
    Bibliothek: Bild auf lange Seite 2000 px verkleinern (EXIF-Drehung macht
    der Browser); **Blattrand** als größte helle Fläche nach Otsu-Schwelle,
    vier äußerste Punkte als Ecken, bei kräftigem Schatten zweite tiefere
    Schwelle und das Viereck mit den ähnlicheren Gegenkanten, 1 % Luft;
    **Entzerren** per Homographie (Heckbert) mit bilinearer Interpolation
    auf die gemessenen Kantenlängen; **Licht ausgleichen**: Hintergrund als
    Blockmaximum (nimmt das Papier, nicht die Note) zweifach weichgezeichnet
    und hochgezogen, Original durch Hintergrund geteilt — Schatten
    verschwinden, Farben (Marker, Bleistift) bleiben; Stufe „Scan“ streckt
    die Pegel (25 % → schwarz, 86 % → weiß), „Schwarz-Weiß“ schwellt bei
    62 %.
  - **PDF** selbst geschrieben (`pdfBauen`): ein JPEG je Seite (DCTDecode),
    Qualität ab 0,85 abwärts bis unter ~500 KB je Seite, Seitenmaß A4-Breite
    im Bildverhältnis, Titel im Info-Objekt; Struktur (xref-Offsets) im
    Test geprüft, im Browser mit pdf.js geöffnet. Gespeichert wie jeder
    Import (`stueckAnlegen`): Bytes in `dateien`, Dateiname
    „Titel (Scan 2026-10-23).pdf“.
  - **Nicht gemacht:** automatisches Begradigen kleiner Schieflagen an den
    Notenlinien (das Entzerren über die Ecken deckt das ab), A4-Format
    erzwingen, Seiten an ein bestehendes Stück anhängen. Grenzen: iOS reicht
    Fotos nicht per Teilen-Blatt an Web-Apps; HEIC öffnet nur Safari; auf
    hellem Tisch findet die App keinen Blattrand und nimmt das ganze Bild —
    die Ecken lassen sich dann von Hand setzen.
- **F-03 · Lesezeichen und virtuelle Stücke** (2026-10-23): Wunsch Marlon.
  Speicher und Regeln gab es seit A-02, jetzt die Oberfläche.
  - **Lesezeichen:** im Ansicht-Menü (⋯) der Noten „Lesezeichen auf Seite n“
    — benennen, Setzen; darunter die Liste aller Lesezeichen des Stücks,
    Antippen springt zur Seite, „Entfernen“ löscht. Im Stück-Blatt (Tipp auf
    den Titel) dieselbe Liste mit Umbenennen und Seite ändern, dazu **„Aus
    dem Inhaltsverzeichnis der PDF“**: Die Gliederung der PDF (Outline) wird
    flach gelesen, nur noch fehlende Punkte werden Lesezeichen (gleiche Seite
    und gleicher Titel gilt als vorhanden; `neueLesezeichen` in
    `src/domain/sicht.ts`).
  - **Virtuelle Stücke** im Stück-Blatt unter „Eigene Stücke aus diesem“:
    „Seiten von–bis als Stück …“ (Bereich geprüft: ganze Zahlen, innerhalb der
    PDF, nicht alle Seiten — `bereichLesen`) und **„Je Lesezeichen ein Stück“**
    (vom Lesezeichen bis vor das nächste, das letzte bis zum Ende; schon
    vorhandene Bereiche werden ausgelassen — `stueckeAusLesezeichen`). Das
    neue Stück erbt Stimme, Sammlungen und Tags der Quelle. In der Bibliothek
    steht es mit „Seiten 3–5 aus „Band““ in der Unterzeile; „Aktualisieren“
    überspringt es (keine eigene Datei).
  - **Betrachter:** Ein virtuelles Stück sieht ein **Fenster** auf die PDF der
    Quelle (`seitenFenster` in `pdf.ts`: `numPages` = Bereich, `getPage`
    verschoben) — Blättern, Zoom, Ausschnitte, Sprünge, Lesezeichen und
    Merker zählen in Sicht-Seiten ab 1. Stellen und Anmerkungen liegen bei
    der Quelle in PDF-Seiten: gelesen über `dateiVon` + `inSicht`, geschrieben
    über `ablage` (Betrachter, Stück-Blatt, Stellen-Übersicht). Der
    Stellen-Mix einer Sammlung nimmt die Stellen mit, die ein virtuelles
    Stück der Sammlung zeigt (`stueckeMitSeite`; `mixAuswahl` sieht jetzt
    die ganze Stelle); die Stellen-Zahl in der Bibliothek zählt ebenso
    (`stellenJeStueck`). Reicht die PDF nicht mehr bis `bis`, zeigt das
    Stück, was da ist; liegt `von` hinter dem Ende, eine klare Meldung.
  - Kein Schema-Sprung: `lesezeichen` und `quelle` gab es schon; Sicherung
    unverändert. Regeln in `src/domain/sicht.ts`, getestet
    (`tests/sicht.test.ts`); im Browser durchgespielt (Inhaltsverzeichnis →
    Lesezeichen → Stücke → öffnen → Lesezeichen setzen).
- **F-20 · Bibliothek: Tags je Sammlung, Kopfzeile der Sammlung weg**
  (2026-10-23): Wunsch Marlon. Die Zeile „Sammlung „2026“ · 17 Stücke ·
  ⋯“ entfällt — der gewählte Chip zeigt es schon. Umbenennen, Auswählen und
  Auflösen stehen im Kontext-Blatt (F-08): Halten auf den Chip oder ein
  zweiter Tipp auf den gewählten Chip. Die
  Tag-Zeile zeigt in einer Sammlung nur die Tags, die dort vorkommen, mit
  der Zahl in dieser Sammlung; unter „Alle“ alle Tags mit der Summe. Ein
  gemerkter Tag-Filter, den es in der Sammlung nicht gibt, ruht, bis er
  wieder vorkommt. Regel `tagUebersicht(…, nurVorhandene)` in
  `src/domain/tags.ts` (getestet).

- **F-19 · Stellen-Modus: Umgebung hell oder abgedunkelt** (2026-10-23):
  Wunsch Marlon: im Stellen-Modus auch davor und danach mitspielen, ohne die
  Stellen-Leiste („geschafft“) zu verlieren — und nicht versteckt im Menü,
  sondern direkt in der Leiste. Links neben dem Namen der Stelle steht eine
  **Sonne** (Umgebung ist abgedunkelt, Tipp hellt auf) bzw. ein **Mond**
  (Umgebung ist hell, Tipp dunkelt ab). Der Rahmen um die Stelle bleibt
  immer. Gilt auch im Stellen-Mix, gemerkt je Gerät (`ueben:stelle-hell`).

- **E-03 (Nachbesserung) · Werkzeuge erkennbar** (2026-10-23): Wunsch
  Marlon: Marker sah aus wie ein Block, Radierer und Stempel waren nicht
  zu erkennen. Jetzt: Textmarker mit Keilspitze, dunklem Kragen und Etikett;
  Radierer als klassischer gelber Bleistift mit rosa Radiergummi und
  Zwinge (Radierseite oben, zur Seite hin); Schere mit zwei Klingen,
  Schraube und Griffösen; Stempel mit Gummiplatte oben, Hals und rundem
  Holzgriff. Breite und Stil wie die übrigen Werkzeuge.

- **E-04 (Teil 1) · Stempel; Sprungmarken nur mit Symbol, D.C. weg**
  (2026-10-23): Wunsch Marlon. Neues Werkzeug **Stempel** in der Palette:
  Tipp aufs aktive Werkzeug öffnet das Raster — Segno, Coda, Fermate,
  Atemzeichen, Zäsur, pp bis ff, Fingersätze 1–5; Antippen setzt das Zeichen
  mit der Mitte auf die Stelle, in Stiftfarbe, auch in Lücken. Der Radierer
  nimmt einen Stempel ganz weg; Rückgängig wie gewohnt. Größen nach dem
  Druckbild (Notensystem ≈ 4 % der Seitenbreite: Segno 6,2 %, Coda 5,2 %,
  Dynamik 5 %, Fingersatz 2,8 %), dazu im Raster **Klein / Mittel / Groß**
  (×0,7 / ×1 / ×1,4, je Gerät `ueben:stempel-groesse`) — Rückmeldung Marlon,
  die ersten waren viel zu klein. Das Segno ist jetzt
  hoch und schlank (S mit Schrägstrich und zwei Punkten), Sprungzeichen und
  Stempel teilen sich die Pfade (`src/domain/stempel.ts`, getestet).
  **Sprünge:** Die Marke auf der Seite zeigt nur noch das Symbol (ohne
  „Coda“/„D.S.“-Text); beim Speichern eines D.S. oder Coda kommt das
  Zeichen als Stempel an die Einstiegsstelle — eine normale Anmerkung, die
  man verschieben (radieren und neu setzen) oder löschen kann; ein gelöschter
  Sprung nimmt sie nicht mit. D.C. steht nicht mehr zur Wahl (vorhandene
  D.C.-Sprünge funktionieren weiter). Daten: Anmerkungsart `stempel`
  (`zeichen`, `x`, `y`, `groesse`, `farbe`, optional `luecke`), kein
  Schema-Sprung. Offen aus E-04: Formen (Bindebögen, Crescendo-Keile),
  Auswahl-Werkzeug.

- **E-14 · Stift-Vorrang (Handballen)** (2026-10-23): Rückmeldung Marlon:
  Beim Neuansetzen wurde ein Strich manchmal nicht erfasst. Ursache: Eine
  Berührung der Hand während eines Stift-Strichs überschrieb den laufenden
  Zug — der Strich ging verloren oder endete, sobald die Hand abhob; zwei
  Auflagepunkte der Hand starteten sogar den Zwei-Finger-Zoom und brachen
  den Strich ab. Jetzt gilt: Solange der Stift schreibt und 700 ms danach
  zählen Berührungen nicht (Zeichnen, Blättern, Zoom), und nur der Zeiger,
  der einen Zug begonnen hat, darf ihn beenden. „Auch mit dem Finger“
  zeichnet weiter, sobald kein Stift im Spiel ist.

- **E-13 · Schreiben ohne Hänger: Striche nachzeichnen statt Blatt neu
  setzen** (2026-10-23): Rückmeldung Marlon, das Schreiben hakt nach dem
  Absetzen. Analyse (gemessen mit einem Skript, das 60 kurze Striche in
  Schreibgeschwindigkeit setzt, CPU sechsfach gedrosselt): kein
  Netzproblem — nach jedem Strich wurde das ganze Blatt neu zusammengesetzt
  (Seitenbild, Markierungs-Ebene, alle Anmerkungen, Sticker auf einer
  Leinwand bis 11 Millionen Pixel; beim Zoomen zusätzlich der scharfe
  Ausschnitt). Jetzt merkt sich der Betrachter, was die Leinwand zeigt, und
  zeichnet einen neuen Strich oder Text nur nach (`nurAngehaengt`); Radieren,
  Rückgängig, Schnitte und Sticker setzen weiter das ganze Blatt. Dafür
  bleibt die Schnitt-Liste dasselbe Objekt, solange sie sich nicht ändert.
  Messung: lange Frames (über 50 ms) von 9 auf 2, längster von 117 auf 67 ms;
  Vollbilder von 60 auf 3. Weitere Hebel, falls nötig: Speichern in die
  Datenbank bündeln, Leinwand-Obergrenze auf dem iPad senken.
- **D-05 (Nachbesserung):** Schnellwahl der Taktart nur noch 4/4, 3/4, 6/8,
  2/4 (Wunsch Marlon), alles andere über − / +.

- **D-07 · Tempo je Schlag, nicht je Nenner-Note** (2026-10-23): Rückmeldung
  Marlon: 6/8 bei 120 müsste 360 Achtel in der Minute geben (zwei Schläge je
  Takt, drei Achtel je Schlag), die App klickte aber 120 Achtel. Jetzt gilt
  das Tempo je **Schlag**, dem gefühlten Puls: 4/4 die Viertel, 2/2 die
  Halbe, 6/8, 9/8, 12/8 die punktierte Viertel (drei Einheiten je Schlag);
  3/8, 5/8, 7/8 zählen in Achteln. Die Taktpunkte bleiben je Einheit (6/8:
  sechs Punkte, 1 und 4 betont, betonte Punkte leuchten in Messing). Die
  Unterteilung richtet sich nach dem Nenner: in 4/4 Viertel/Achtel/Triolen/
  Sechzehntel, in 2/2 Halbe/Viertel/Triolen/Achtel, bei Achtel-Nenner
  Achtel/Sechzehntel; eine gespeicherte, die es dort nicht gibt, fällt auf
  die erste zurück. Anzeige „Andante · je punktierte Viertel“ und unter der
  Taktart „Das Tempo gilt je punktierte Viertel: 2 Schläge je Takt, je 3
  Achtel.“ Regeln `einheitenJeSchlag`, `schlaegeJeTakt`, `schlagName`,
  `unterteilungen`, `klickDauer` in `src/domain/takt.ts` (getestet).
  Ersetzt die Regel aus D-05 („Tempo je Nenner-Note“).

- **E-12 (Nachbesserung) · Sticker in der Lücke, Schnitt als Vorschau,
  flüssiger schreiben** (2026-10-23): Rückmeldung Marlon vom iPad.
  - **Sticker in die Lücke:** Beim Ziehen folgt der Sticker dem Finger über
    Teilstücke und Lücken derselben Seite; landet er in einer Lücke, gehört
    er zu ihr (`luecke` am Sticker, Lage ab Oberkante) und geht mit dem
    Schnitt. Auf eine andere Seite gelegt liegt er wieder auf der Seite.
    Ob Seite oder Lücke, entscheidet die **Mitte** des Stickers beim
    Loslassen (die linke obere Ecke ließ ihn an der Seite hängen und am
    Schnitt teilen — Video Marlon); Sticker einer Lücke dürfen über deren
    Rand hinausragen, Sticker der Seite enden am Schnitt.
  - **Schnitt ziehen ohne Ruckeln:** Das Blatt wurde bei jeder Bewegung neu
    gerendert (auf dem iPad ruckelig, einmal abgestürzt). Jetzt zeigt ein
    Band nur die Vorschau; gerendert wird einmal beim Loslassen.
  - **Sticker ziehen ohne Ruckeln:** dasselbe Muster — beim Anfassen wird
    das Bild des Stickers einmal klein gezeichnet und als Vorschau
    mitgeführt (Lage an React vorbei), das Blatt wird einmal beim Loslassen
    neu gezeichnet. Vorher je Bewegung ein ganzes Blatt (ruckelig, auf dem
    iPad Absturz beim Schieben in die Lücke). Die Leinwand wird außerdem nur
    noch bei anderer Größe neu angelegt.
  - **Schreiben:** Die Live-Leinwand des laufenden Strichs wurde bei jeder
    Bewegung neu angelegt; jetzt einmal je Strich, und der Stift zeichnet
    nur die neuen Punkte nach (der Marker wird wegen seiner Transparenz
    weiter ganz gezeichnet).
  - **Keine Textauswahl:** Beim schnellen Schreiben mit dem Pencil markierte
    iOS Beschriftungen der Leisten („Stimmgerät“). Text ist in der App jetzt
    nirgends markierbar, außer in Eingabefeldern.
- **D-06 (Nachbesserung):** Die Tempo-Knöpfe der schmalen Säule sind doppelt
  so hoch (Wunsch Marlon: lang darf sie sein, breit nicht).

- **A-07 · Dauerhafter Speicher** (2026-10-23): Frage Marlon, ob sich das
  Löschen der Browser-Daten durch das iPad verhindern lässt. Die App bittet
  den Browser jetzt beim Start, ihre Daten zu behalten
  (`navigator.storage.persist`); Einstellungen → Daten übertragen zeigt die
  Antwort („Dauerhaft“ / „Nicht zugesagt“ / „Keine Angabe“, Texte in
  `src/domain/speicher.ts`, getestet). Was sonst gilt: Als
  Home-Bildschirm-App fällt Safaris Sieben-Tage-Regel weg; bei Speichermangel
  darf iOS trotzdem aufräumen, Website-Daten löschen oder das App-Symbol
  entfernen löscht alles. Die Sicherung bleibt die einzige Kopie außerhalb
  des Browsers.

- **E-12 · Schere: Sticker und Schnitt mit Lücke** (2026-10-23): Wunsch
  Marlon: ein Segment der Noten ausschneiden und wie einen Sticker woanders
  hinlegen (die halbe Coda-Zeile ans Ende, die nächste Zeile vor eine
  schwere Blätterstelle) — und eine Seite aufschneiden, alles darunter
  hinunterschieben und in der Lücke Notizen oder eine Zeile Noten
  unterbringen. Neues Werkzeug **Schere** in der Palette; Tipp aufs aktive
  Werkzeug wählt **Sticker** oder **Schnitt**. Regeln in
  `src/domain/schnitte.ts` (getestet).
  - **Sticker:** Rahmen um die Takte ziehen — der Ausschnitt liegt als
    Sticker etwas versetzt darüber und ist gewählt: ziehen verschiebt, der
    Griff an der Ecke ändert die Größe, die Leiste darüber legt ihn auf die
    vorige/nächste Seite (die App blättert mit) oder löscht ihn. Gespeichert
    wird nur die Quelle (Seite, Rechteck) und die Lage; das Bild entsteht
    beim Öffnen frisch aus dem PDF samt Markierungen und Anmerkungen der
    Quelle. Beim Lesen ein feiner Rand, bei offener Palette gestrichelt.
  - **Schnitt:** Antippen und nach unten ziehen — die Seite teilt sich in
    dieser Höhe, alles darunter rückt um den Abstand hinunter, dazwischen
    ist Papier. In der Lücke ziehen ändert den Abstand, auf unter 1,5 %
    ziehen oder das × am Rand entfernt den Schnitt samt dem, was in der
    Lücke stand. Das Blatt wird um die Lücken länger, der Ausschnitt gilt
    weiter. Schnitte wirken auf einzeln gezeigten ganzen Seiten (auch im
    Stellen-Modus); Halb, Linie und Doppelseite zeigen die Seite original.
  - **Entscheidung (Marlon):** Keine Umrechnung der Anmerkungen. Alles
    bleibt in den Koordinaten der ursprünglichen Seite; gerechnet wird nur
    ein Versatz je Teilstück — beim Zeichnen (jedes Teilstück kennt seine
    Lage auf dem Blatt) und beim Tippen (Blatt-Punkt → Teilstück → Seite).
    Was in einer Lücke steht, gehört zum Schnitt (`luecke` = seine id, y ab
    Oberkante der Lücke, sonst dieselben Einheiten) und geht mit ihm.
  - **Daten:** zwei neue Anmerkungsarten je Seite — `schnitt` (`y`,
    `abstand` in Seitenhöhen) und `sticker` (`von {seite, x, y, b, h}`, `x`,
    `y`, `b`) — sowie das optionale Feld `luecke` an Stift, Marker, Text.
    Reisen mit der Sicherung, Rückgängig/Wiederholen wie gewohnt, der
    Radierer nimmt Schnitte und Sticker nicht weg. Kein Schema-Sprung.
    Ältere App-Stände kennen die Arten nicht — erst nach dem Update laden.
  - **Offen:** Der scharfe Ausschnitt beim Zoomen (E-06) gilt für einzelne
    Seiten ohne Schnitte; mit Schnitten und auf der Doppelseite bleibt es
    beim Zoomen bei der Schärfe des ganzen Blatts.
- **B-13 (Ergänzung) · Anmerken und Zoomen auf der Doppelseite**
  (2026-10-23): Wunsch Marlon: Die Palette ließ die Doppelseite nicht mehr
  zu, und Zoomen ging dort nicht. Jetzt bleibt die Doppelseite bei offener
  Palette; Stift, Marker, Text, Radierer, Stelle und Schere gehen direkt
  auf beiden Seiten (jeder Strich gehört der Seite, auf der er beginnt), und
  Zoomen geht mit „Immer zoomen“ oder offener Palette auch hier.

- **B-13 · Zwei Seiten nebeneinander** (2026-10-23): Wunsch Marlon. Ansicht →
  „Zwei Seiten“ (je Gerät, `ueben:zwei-seiten`): Im Querformat stehen die
  Seiten paarweise nebeneinander (1–2, 3–4 …, eine übrige letzte allein),
  mit schmaler Lücke; der Ausschnitt gilt für beide Seiten gleich. Geblättert
  wird je Doppelseite — Pedal, Ring, Tasten, Rand-Tippen, auch über Sprünge
  (eine Marke liegt auf ihrer Seite, das Ziel ist die Doppelseite, die die
  Seite zeigt). Kopf „Seiten 1–2 von 4“. Hochkant, beim Anmerken (offene
  Palette), im Stellen-Modus und beim Blättern-Einstellen zeigt der
  Betrachter weiter eine Seite; Halb und Linie gelten in der Doppelseite
  nicht. *(Seit der Ergänzung unten auch zum Anmerken und Zoomen.)* Neue Ansicht-Art `doppel` in `src/domain/notenpult.ts`, Sprünge in
  `spruenge.ts`, Geometrie `doppelDarstellung` in `ausschnitt.ts` (alles
  getestet). Kein Schema-Sprung.
- **B-14 · Ansicht-Menü aufgeräumt** (2026-10-23): Wunsch Marlon: „Seite für
  Seite einstellen“ und „Seite 2 zuschneiden“ waren nicht unterscheidbar
  genug. Das Menü hat jetzt Zeilen mit Symbol und Unterzeile: **Ansicht**
  (Zwei Seiten, Immer zoomen als Schalter), **Blättern** (Ganz | Halb | Linie
  gilt hier für alle Seiten, darunter „Blättern einstellen ›“ mit
  Blatt-Symbol — die Leiste unten für Seite für Seite, Linie ziehen, „Für
  alle“), **Seite** („Seite n zuschneiden ›“ mit Zuschneide-Symbol wie beim
  Foto-Bearbeiten) und **Sprünge** („Sprung setzen ›“, Liste). Blättern
  alle Seiten verschieden, steht das dabei; die Wahl im Menü setzt wieder
  alle gleich.

- **B-12 · Bibliothek immer in voller Höhe, Erinnerung abschaltbar**
  (2026-10-23): Wunsch Marlon: Die Höhe der Bibliothek hing davon ab, wie
  viele Stücke es gab. Jetzt setzt sie immer ganz oben an (Kopf „Bibliothek“
  mit Zahnrad und Schließen), die Liste rollt, darunter bleibt Papier. Die
  Erinnerung „Letzte Sicherung vor n Tagen“ lässt sich mit „ausblenden“ an
  der Meldung oder in Einstellungen → Daten übertragen („In der Bibliothek
  erinnern“) abschalten (je Gerät, `ueben:sicherung-erinnern`). Zur Frage,
  ob Sicherungen wichtig sind: Die Daten liegen nur im Browser-Speicher
  dieses Geräts (IndexedDB, localStorage) — sie werden nicht automatisch
  woanders gespeichert. Löscht man Website-Daten, wechselt das Gerät oder
  räumt iOS bei Speichermangel auf, sind sie weg. Die Sicherung ist die
  einzige Kopie außerhalb des Browsers; darum erinnert die App.

- **D-05 · Taktart mit Zähler und Nenner** (2026-10-23): Wunsch Marlon: 3/4,
  6/8, 12/8 statt nur „Schläge je Takt“, und ohne System-Auswahlfeld. Im
  großen Metronom steht die Taktart als Bruch wie in den Noten (Zähler über
  Nenner, je − / +; Nenner 2, 4, 8, 16), daneben die Schnellwahl 2/4 · 3/4 ·
  4/4 · 6/8 · 9/8 · 12/8. Das Tempo gilt je Nenner-Note („Andante · je
  Achtel“), wie bei einem Metronom „♪ = 120“. Zusammengesetzte Takte (6/8,
  9/8, 12/8) betonen jede Dreiergruppe; bei gleichem Nenner bleiben gesetzte
  Akzente Schlag für Schlag. Das Widget zeigt „Takt 6/8“. Regeln in
  `src/domain/takt.ts` (getestet). Daten: `metro:nenner` (reist mit der
  Sicherung), `metro:takt` bleibt der Zähler.
- **D-06 · Schmales Metronom-Widget, gleichmäßigere Größen** (2026-10-23):
  Wunsch Marlon. Im Kopf des Widgets schaltet ⇥⇤ auf eine **schmale Säule**,
  nur so breit wie der Start-Knopf: Start, Tempo (antippen zum Eingeben),
  +10 % · +1 · −1 · −10 % übereinander, Taktart und Taktpunkte, „alles“; ohne
  Regler. Angedockt sitzt sie rechts an der Leiste, frei geschoben wie
  gehabt. Gemerkt je Gerät (`ueben:metronom-schmal`). In der breiten Ansicht
  sind Start-Knopf und Tempozahl jetzt gleich groß (vorher war der Knopf
  größer als die Zahl).
- **E-11 · Palette merkt sich das Werkzeug** (2026-10-23): Wunsch Marlon.
  Öffnet man die Stift-Palette wieder, steht das zuletzt gewählte Werkzeug
  bereit (Marker, Stelle, Radierer, Text …) samt dessen Farbe und Dicke —
  über Stückwechsel hinweg, solange die App läuft; nach einem Neustart
  wieder der Stift.

- **F-18 · Stelle löschen aus der Stellen-Leiste** (2026-10-23): Wunsch
  Marlon: eine Option, Stellen zu löschen. Bisher ging das nur im Stück-Blatt
  hinter „bearbeiten“. Jetzt steht **„Stelle löschen“** unten im Stellen-Blatt
  (Tipp auf den Namen in der Stellen-Leiste) — mit Rückfrage, die nennt, wie
  viele geschaffte Tempi mitgehen („Die Noten bleiben.“); dieselbe Rückfrage
  jetzt auch im Stück-Blatt. War es die letzte Stelle, geht es zurück zum
  Lesen; im Mix rückt die Runde nach (gelöschte fallen weg, wie gehabt).
  Grabstein wie bisher (`stelleLoeschen`), kein Schema-Sprung.
- **E-10 · Immer zoomen** (2026-10-23): Wunsch Marlon: zoomen nicht nur beim
  Anmerken. **Ansicht → Zoom → „Immer zoomen“**: dann zoomen zwei Finger (am
  Rechner Strg + Mausrad bzw. Trackpad) auch beim Lesen und im Stellen-Modus;
  ein Finger schiebt das gezoomte Blatt, ein **Tipp** blättert weiter am Rand
  bzw. zeigt die Leisten in der Mitte (vorher tat ein Tipp gezoomt nichts).
  Die Knöpfe − / % / + erscheinen beim Lesen erst, sobald gezoomt ist; der
  Zoom überlebt das Öffnen und Schließen der Palette, nicht aber Blättern
  (E-06-Regel). Nur auf ganzen Seiten (Halb/Linie wie bisher nicht). Aus:
  wie bisher nur bei offener Palette. Gemerkt als `ueben:zoom-immer`, reist
  als persönliche Einstellung mit der Sicherung (`src/domain/einstellungen.ts`,
  getestet).
- **E-09 · Weiß statt Grau in der Stiftpalette** (2026-10-23): Wunsch Marlon.
  Das Grau (#5f5b53) ist aus der Stift-/Textpalette heraus, an seiner Stelle
  steht **Weiß** (#ffffff) — zum Abdecken auf dem Blatt. Ein früher gewähltes
  Grau bleibt gültig (gilt als eigene Farbe, `einstellungPruefen`); die
  Werkzeug-Vorschau in der Palette hat eine feine Kontur, damit Weiß zu sehen
  ist. Marker unverändert. Regeln in `src/domain/stift.ts` (getestet).

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
  Tempo und Farbwelt bleiben je Gerät (seit 2026-10-13 reisen Stimmung,
  Metronom und Stiftfarben mit). Beim Laden gehen die
  PDFs nie als Blob in die Datenbank: erst einzeln als Bytes vorläufig in
  `dateien`, dann zieht eine Transaktion sie an ihren Platz (alles oder
  nichts). Vor jeder Sicherung — und still im Hintergrund nach dem Laden der
  Bibliothek — ziehen alle Stücke, die ihre PDF noch als alten Blob tragen,
  in `dateien` um: Safari las solche Blobs beim Prüfen mitunter nicht,
  obwohl sich das Stück öffnen ließ („Nicht lesbar, nicht in der
  Sicherung“). Ist eine PDF wirklich verloren, nennt die Meldung den Weg
  zur Rettung. Ersetzt A-01.
- **F-05 · Sprünge (Wiederholung, D.S., D.C., Coda)** (2026-10-13): Wunsch
  Marlon: „Teils keine Pause bei solchen Übergängen und kann nicht besonders
  wo hinklicken — einfach ‚weiter‘ blättern.“ Regeln in
  `src/domain/spruenge.ts` und `src/domain/spielfolge.ts` (getestet).
  - **Setzen:** Ansicht → Sprünge → „Sprung setzen“: Sprungzeichen antippen,
    zum Ziel blättern und antippen, Art wählen (Wdh., D.S., D.C., Coda). Am
    Sprungzeichen sitzt eine Marke. Liste mit Löschen im Ansicht-Menü.
  - **Weiterblättern folgt den Sprüngen (Spielfolge):** Pedal, Scroll-Ring,
    Tasten, Mausrad und Rand-Tippen gehen das Stück in Spielreihenfolge
    durch. Wo ein fälliger Sprung zu sehen ist, führt „weiter“ zur
    Einstiegsstelle (ein Ring blinkt), „zurück“ geht denselben Weg rückwärts.
    Jeder Sprung einmal; Wdh., D.S., D.C. beim ersten Erreichen, die Coda erst
    nach einem D.S./D.C.; Wdh. auf derselben Seite ist ein eigener Schritt.
    Bei Halb/Linie gilt ein Zeichen unter der Linie erst in der Halb-Ansicht
    (dort wird es gelesen).
  - **Reihenfolge verschieben** (2026-10-14, Wunsch Marlon: „Ich möchte die
    Sprünge in ihrer Reihenfolge auch schieben können“ — die Liste stand nach
    Seiten, Coda S. 1→2 vor D.S. S. 2→1): Die Liste im Ansicht-Menü ist die
    Reihenfolge, in der gesprungen wird, nummeriert, mit ↑ ↓ umzustellen.
    Dran ist immer der erste noch nicht genommene; eine Coda wartet auf ein
    D.S./D.C. über ihr. Was der Weg nicht erreicht, steht grau (mit Hinweis).
    Ein neuer Sprung reiht sich dort ein, wo man ihn spielt — solange nichts
    verschoben ist, ordnet sich die ganze Liste so (dann gelten genau die
    Regeln oben, Reihenfolge des Anlegens egal). Verschieben macht z. B.
    1./2. Haus möglich: Sprung ins 2. Haus unter die Wiederholung, dann erst
    beim zweiten Mal.
  - **Notenzeichen** (2026-10-14, Wunsch Marlon): neben dem Kürzel das Segno
    (D.S.), das Coda-Zeichen und das Wiederholungszeichen — auf den
    Art-Knöpfen, den Marken und in der Liste (D.C. hat keins). Als SVG, die
    Unicode-Zeichen fehlen vielen Schriften. Auf schmalen Telefonen steht das
    Zeichen auf den Art-Knöpfen über dem Kürzel.
  - Untertitel zeigt den Abschnitt („Seite 1 von 3 · nach D.S.“, schmal
    kürzer). Marke antippen springt direkt. Geht mit Ausschnitt je Seite;
    im Stellen-Modus keine Marken.
  - **Daten:** am Stück `spruenge` (`{id, von {seite,x,y}, nach {seite,x,y},
    art, nr}`), reist in der Sicherung mit. `nr` (ab 1) ist der Platz in der
    Reihenfolge; ältere Stände ohne `nr` bekommen beim Öffnen die
    Reihenfolge, in der man sie spielt (geschrieben erst beim nächsten
    Ändern). Kein Schema-Sprung.
- **Tags: keine Doppelten** (2026-10-13): Wunsch Marlon. Auf zwei Geräten
  getrennt angelegte Tags (z. B. beide „Diese vier anlegen“) standen nach
  „Sicherung laden“ doppelt da. Jetzt gilt: gleicher Name (Groß/klein egal,
  Leerraum zusammengefasst) = derselbe Tag. Beim Laden bleibt die hiesige id,
  Name und Farbe vom neueren Stand; die Tag-Listen der Stücke werden in
  derselben Transaktion umgeschrieben (`geaendert` der Stücke bleibt). Jeder
  Tag merkt sich die ids, unter denen er auf anderen Geräten läuft (`auch`),
  damit Umbenennen und Löschen weiter ankommen. Schon vorhandene Doppelte legt
  das nächste Laden zusammen (es bleibt die id mit den meisten Stücken), ohne
  Sicherung per „Doppelte zusammenführen“ in Einstellungen → Tags. Anlegen
  oder Umbenennen auf einen vorhandenen Namen zeigt „Gibt es schon“; beim
  Markieren wird stattdessen der vorhandene Tag gewählt. Regeln in
  `src/domain/tags.ts` (`tagsAbgleichen`, getestet). Kein Schema-Sprung.
- **Einstellungen reisen mit der Sicherung** (2026-10-13): Wunsch Marlon.
  Stimmung und Kammerton, Metronom (Klang, Lautstärke, Takt, Akzente,
  Unterteilung, Trainer), Stift-, Marker- und Textfarbe, Wischrichtung und
  Tonumfang stehen im Kopf der Sicherung (`einstellungen = { stand, werte }`).
  Beim Laden gilt der neuere Stand als Ganzes; was der Datei fehlt, bleibt.
  Wirkt sofort (Metronom und Stimmgerät lesen neu), Meldung „Einstellungen
  übernommen.“ Hell/Dunkel, Farbwelt, Tempo, Lage der Fenster und Filter
  bleiben je Gerät. Der Zeitstempel rückt nur bei echten Änderungen vor.
  Regeln in `src/domain/einstellungen.ts` (getestet).
- **F-16 · Blättern je Seite** (2026-10-14): Wunsch Marlon: Die eigene
  Blätterlinie ist gut, aber nicht jede Seite will sie — mal ganz blättern,
  mal ab der Linie, je nach Seite. Jetzt blättert jede Seite **Ganz**,
  **Halb** oder mit **Linie**, oder alle gleich. Regeln in `src/domain/notenpult.ts`
  (`modusSetzen`, `einheitlich`, `blaetternLesen`; getestet).
  - **Ansicht → Blättern:** Ganz | Halb | Linie zeigt, wie die Seite blättert,
    die man sieht (in der Halb-Ansicht die untere). Darunter der Schalter
    **„Für alle n Seiten“** (ab drei Seiten): an, solange alle gleich blättern
    — dann gilt die Wahl für alle (wie bisher). Aus: nur für diese Seite.
    Wieder einschalten lässt alle Seiten wie diese blättern. Auf der letzten
    Seite wird nicht geblättert; bei ausgeschaltetem Schalter ist die Wahl
    dort gesperrt.
  - **„Seite für Seite einstellen“** (ersetzt „Blätterlinie einstellen“):
    Leiste unten mit ‹ › (vorige/nächste ganze Seite), Ganz | Halb | Linie,
    demselben Schalter und „Fertig“; auf Linie-Seiten die goldene Linie zum
    Ziehen. Die Leisten weichen, solange man einstellt. Der verblassende
    Hinweis oben (B-11) ist dafür entfallen. „Linie“ wählen öffnet sie
    weiterhin direkt.
  - **Linien bleiben:** Blättert eine Seite ganz oder halb, behält sie ihre
    Linie; zurück auf Linie ist sie wieder da. „Für alle“ setzt nur die Art,
    nie die Linien der anderen Seiten.
  - **Daten:** am Stück `blaettern.jeSeite` (je Seitennummer der abweichende
    Modus; nur Seiten, die anders als `modus` blättern — blättern alle
    gleich, gibt es kein `jeSeite`). Alte Stände ohne `jeSeite` gelten
    unverändert; ältere App-Stände überlesen es (blättern dann überall nach
    `modus`). Reist in der Sicherung mit. Kein Schema-Sprung.
- **F-06 · Halbseiten-Umblättern** (2026-10-13): von Marlon abgehakt („klappt
  gut“). Im Ansicht-Menü unter „Blättern“: **Ganz**, **Halb** (unten noch die
  aktuelle, oben schon die nächste Seite) und **Linie** (eigene Blätterlinie
  je Seite); Regeln in `ansichten` (`src/domain/notenpult.ts`). Pedale,
  Scroll-Ring und Mausrad blättern durch dieselben Ansichten.
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
  dort bleibt „Fertig“ im Kästchen. *(Seit F-16 steht beides in der Leiste
  unten.)*
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
    *(Seit E-10 wahlweise auch beim Lesen, siehe unten.)*
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
- **F-17 · Stellen als Favorit, Stellen-Mix mit Optionen** (2026-10-14):
  Wunsch Marlon: Stellen als Favoriten markieren und im Mix einer Sammlung
  (z. B. „2026“, „Deutsche Märchen“) nur Favoriten und/oder nur offene
  Stellen üben; die große Mix-Karte war ihm zu groß — erst antippen, dann
  Optionen, dann starten. Entwurf und Abnahme durch einen UI/UX-Agenten.
  Regeln in `src/domain/stellen.ts` (getestet).
  - **Favorit (★):** Stern links neben dem Namen in der Stellen-Leiste (ein
    Tipp, Rückmeldung „★ Favorit gesetzt“ / „Kein Favorit mehr“, im
    Favoriten-Mix „Ab nächster Runde nicht dabei“), Schalterzeile „Favorit“
    im Stellen-Blatt, Stern vor jeder Stelle in der Übersicht des
    Stück-Blatts. Gefüllt in Messing = Favorit, Umriss = keiner.
  - **Einstieg in der Bibliothek:** statt der Karte eine Zeile „Stellen-Mix ·
    9 Stellen ›“ (bzw. „Weiter bei 4 von 9“, „Runde geschafft“, „keine
    Favoriten“, „noch keine Stellen“). Tippen öffnet ein Blatt: woraus
    gemischt wird (nur Anzeige — gewählt wird über Sammlung und Tag der
    Bibliothek), Schalter **„Nur offene Stellen“** und **„Nur Favoriten“**
    (kombinierbar, gemerkt je Gerät: `ueben:mix-offen`,
    `ueben:mix-favoriten`), die Zahl der passenden Stellen und „Mix starten“ /
    „Weiter bei …“ / „Neue Runde“, dazu „Neu mischen“. Ohne Treffer ein
    Hinweis, wie man Favoriten bzw. Stellen setzt. Jede Kombination hat ihre
    eigene Runde; der gerade laufende Mix heißt immer „Weiter bei …“.
  - **Beim Üben:** Kopf „Mix 2026 · ★ offen · 3 von 9“; wird es eng, fällt
    erst der Bereich weg, dann „offen“, dann der Stern („Mix ★ 1 von 3“ passt
    aufs iPhone). Eine Stelle, die ihren Stern verliert oder geschafft wird,
    bleibt in der laufenden Runde. Der Fertig-Bildschirm nennt die Auswahl
    („Alle 4 Favoriten aus „2026“ waren einmal dran.“) und die Größe der
    nächsten Runde; „Optionen …“ öffnet dasselbe Blatt.
  - **Daten:** an der Stelle `favorit` (Boolean); abgewählt bleibt `false`
    stehen, damit eine ältere Sicherung den Stern nicht zurückbringt (beim
    Laden gilt der neuere Stand). Reist in der Sicherung mit, kein
    Schema-Sprung.
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
  - **Daten:** Definitionen `{id, name, farbe, geaendert, auch?}` im localStorage
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
