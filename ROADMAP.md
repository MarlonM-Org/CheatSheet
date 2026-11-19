# Roadmap & Backlog

Langfristige Planung für CheatSheet. Dieses Dokument ist die gemeinsame
Arbeitsgrundlage für alle Entwickler: Wer etwas anfängt, trägt sich hinter dem
Punkt ein; wer etwas fertigstellt, hakt ab und verschiebt den Punkt nach
„Erledigt“ (unten). Größere Richtungsentscheidungen bitte als kurzen Absatz
hier dokumentieren, nicht nur im Chat.

Stand: 2026-11-16.

## Leitbild

**Die Noten sind die App.** Alles andere (Metronom, Stimmgerät, Einstellungen)
sind Werkzeuge, die über den Noten schweben. Lernen (B-18) ist neben der
Bibliothek der zweite Ort, der sich als Seite über die Noten legt — für
grundlegende musikalische Fähigkeiten (Gehör, Harmonie, Technik,
Improvisation), nicht für die Arbeit an den eigenen Stücken: Die bleibt in
der Bibliothek, samt Stellen-Mix (B-19). Eine lokal laufende, statische
Web-App: alle Daten bleiben auf dem Gerät, kein Login, kein Server. Vorbild
für Notenmanagement und Übe-Komfort ist **forScore** (https://forscore.co) —
nicht in der Breite, aber in der Sorgfalt.

**Bedienregel (Marlon, 2026-10-27): Ein Tipp tut nur das Erwartete.**
Ein Knopf löst genau das aus, was auf ihm steht — ohne Nebenwirkungen auf
dem Rest der Seite. Vor allem **verschiebt sich nichts**, was gerade zu
sehen ist, solange nicht die ganze Seite wechselt: Menüs, Blätter und
Formulare legen sich als Popover oder Blatt **über** den Inhalt (wie das
„+ Noten“-Menü seit 2026-10-27), statt ihn nach unten zu drücken; Listen
springen nicht, Leisten rücken nicht nach. Was sich an anderer Stelle
ändern muss (eine Meldung, ein Zähler), erscheint dort, ohne das Umliegende
umzuordnen. Ein ganzer Seitenwechsel (Stück öffnen, Bibliothek, große
Ansicht) darf alles neu zeichnen — das ist erwartet. Wer gegen die Regel
verstoßen muss, trägt es hier als Entscheidung ein.

**Bewusst außen vor** (nicht bauen, auch nicht „mal eben“):

- MIDI, Audio-Begleitspuren, Soundbearbeitung
  (Entscheidung Marlon 2026-11-16: eigene **Aufnahmen zum Vergleichen**
  — nur aufnehmen und abspielen — sind erlaubt, I-20; erzeugte Liegetöne
  wie Klick und Klavier ebenfalls, I-18.)
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
MusicXML — Einschätzung in G-08. Entschieden (Marlon, 2026-10-26): Das
**Vorspielen der eigenen Notation** gehört in die App (begonnen, G-04);
außen vor bleiben MIDI-Dateien, Audio-Begleitspuren als Dateien und
Soundbearbeitung.

## Meilensteine (Reihenfolge)

| # | Meilenstein | Inhalt | Backlog-Punkte |
|---|---|---|---|
| M1 | **Fundament aufräumen** | Datenmodell klären, Tests für die Speicherschicht (A-01 verworfen) — *erledigt 2026-10-12* | A-02, A-03 |
| M2 | **Noten im Zentrum** | UI-Neuaufbau: Noten vollflächig, Werkzeuge als Overlays, drei Knöpfe unten (seit B-18 vier: Lernen · Noten · Stimmgerät · Metronom) | B-01…B-03 |
| M3 | **Werkzeuge schärfen** | Stimmgerät- und Metronom-Verbesserungen, Stift-Ausbau | C-01…C-03, D-01, E-01…E-03 |
| M4 | **Notenmanagement I** | Metadaten, Flags, Drag & Drop (Sammlungen F-13, Lesezeichen/virtuelle Stücke F-03 und Kontext-Blatt F-08 erledigt) | F-01, F-04, F-09 |
| M5 | **Üben & Setlisten** | Setlisten (Stellen-Mix F-11, Tonprofil C-04, Sprünge F-05, Halbseiten-Blättern F-06, Blättern je Seite F-16 und Favoriten im Mix F-17 schon erledigt) — *zurückgestellt 2026-10-23: Marlon ordnet bisher über Dateinamen, Setlisten sind Zukunftsthema* | F-02 |
| M6 | **Extras** | Stempel/Formen (Kamera-Scan F-07, Themes B-04 und Design B-05 erledigt) — *vorgezogen 2026-10-23, vor M4 und M5* | E-04 |
| M7 | **Komponieren** (Vision) | Noteneingabe, Rhythmus-/Melodie-Transkription; Ausbau: Vorspielen, Einspielen Takt für Takt, Song-Transkription, Klänge; Ort offen: App oder separates Werkzeug (Wunsch 2026-10-26) | G-01…G-08 |
| M8 | **Geräteübergreifend** (Vision, Entscheidung offen) | Noten und Übe-Daten über die eigene Cloud auf mehreren Geräten | H-01…H-05 |
| M9 | **Freies Spielen** (Vision, begonnen 2026-11-16) | Nach Gehör mitspielen, improvisieren, begleiten: Ohr-Trainer zuerst, dann Lernpfad, Song-Liste, Begleitung aus Akkorden, Impro-Feedback | I-01…I-20 |

**Quick Wins** (klein, unabhängig, jederzeit zwischenschieben — guter
Einstieg): C-01, C-02, C-03, D-01 — *alle am 2026-10-10 erledigt.*

M2 setzt Designvorschläge voraus (siehe B-05) — erst Richtung festlegen, dann
umbauen.

---

## Reifegrad (Stand 2026-10-26)

Drei Stufen, damit klar ist, was wirklich fertig ist: **Reif** heißt
umgesetzt, Fachlogik in `tests/` abgedeckt (35 Dateien, 585 Tests, alle
grün) und von Marlon im Alltag auf iPhone/iPad genutzt — Rückmeldungen vom
Gerät sind eingearbeitet. **Zu prüfen** heißt Code und Tests sind da, aber
der Punkt ist neu oder lief noch nie bzw. nur einmal auf dem Gerät — er gilt
erst als reif, wenn die Checkliste durch ist; **Offen** heißt angefangen
oder nur geplant. Stand: Alles bis einschließlich 2026-10-26 abends
(Triolen, Komponieren am Stück, mehrere Stimmen, Aufnahmen, Titel-Abgleich)
ist auf `main` und damit auf cheat-sheet.ma-und-ma.de.

### Reif — umgesetzt, getestet, im Alltag bewährt

- A-02/A-03/A-05/A-06 · Datenbank `cheatsheet`, Speicherschicht, PDFs als Bytes · `tests/lokal.test.ts` gegen echten Gerätespeicher; die iPhone-Fehler (Speicher voll, verlorene Datei, leere Scans) sind seit 2026-10-11 weg.
- A-07 · Dauerhafter Speicher · klein, nur Anfrage und Anzeige; was das iPad antwortet, steht in Einstellungen → Daten übertragen.
- B-01…B-03, B-06, B-07, B-09, B-12 · Noten vollflächig, drei Knöpfe, schwebende Widgets, Bibliothek, Leisten über den Noten · seit 2026-10-10 die tägliche Oberfläche.
- B-04/B-05 · Studio-Design, Farbwelten · entschieden, `thema.ts` getestet.
- B-10/B-11 · Stellen auffindbar, Rahmen nur bei offener Palette · Rückmeldung Marlon eingearbeitet.
- B-13/B-14 · Zwei Seiten, Ansicht-Menü · Rückmeldung (Anmerken und Zoomen auf der Doppelseite) eingearbeitet, `ausschnitt.ts`/`notenpult.ts`/`spielfolge.ts` getestet.
- B-15 · Doppeltipp in die Mitte · zweite Runde nach Rückmeldung vom iPad (kam nicht mehr heraus), `zoom.ts` getestet.
- C-01…C-03 · Stimmgerät: Stimmung B, Anzeige, Texte · Quick Wins, Stimmgerät täglich in Gebrauch.
- D-01…D-07 · Metronom: ±1, Ton nach App-Wechsel, −1/+1 in der Stellen-Leiste, folgt der Stelle, Taktart als Bruch, schmale Säule, Tempo je Schlag · alle aus Rückmeldungen vom Gerät (6/8-Fehler behoben), `takt.ts` getestet.
- E-01…E-03, E-05…E-11, E-13, E-14 · Stift, Marker, Text, Radierer (schneidet), Pipette und Farbwähler, Zoomen beim Anmerken, Immer zoomen, Palette merkt sich das Werkzeug, flüssig schreiben, Stift-Vorrang, PDF-Markierungen radieren · viele Nachbesserungen vom iPad; Marlon: „funktioniert schon gut“.
- E-04 (Teil 1) · Stempel · Rückmeldung (zu klein) eingearbeitet, drei Größen, `stempel.ts` getestet.
- E-12 · Schere: Sticker und Schnitt mit Lücke · zwei Runden nach iPad-Rückmeldung (Ruckeln, Absturz, Sticker in der Lücke), `schnitte.ts` getestet.
- F-05/F-06/F-16 · Sprünge mit Spielfolge, Halb/Linie, Blättern je Seite · F-06 von Marlon abgehakt, Reihenfolge-Verschieben nach Rückmeldung; `spielfolge.ts` und `spruenge.ts` sind die größten Testdateien.
- F-10/F-15 · A–Z mit Zahlen, Ausschnitt je Seite · klein, getestet, seit Mitte Oktober im Gebrauch.
- F-11/F-12/F-17/F-18/F-19 · Stellen-Mix, Zieltempo und Verlauf, Favoriten, Stelle löschen, Umgebung hell/dunkel · Marlon: „super“; `stellen.ts` getestet, Mix nach UX-Abnahme nachgebessert.
- F-13/F-14 · Sammlungen (ohne Ordner-Import, s. u.) und Tags, Mix je Sammlung/Tag, keine Doppelten · `sammlungen.ts`/`tags.ts` getestet, Doppelte-Tags-Fehler aus dem Zwei-Geräte-Betrieb behoben.
- H-01 (Teil 1), B-06 · Sicherung `.uebe`: neuerer Stand gewinnt, Grabsteine, Einstellungen reisen mit · `einspielen.ts`, `sicherung.ts`, `lokal-abgleich.test.ts`; Durchlauf mit zwei Geräten; einzige Kopie außerhalb des Browsers.

### Umgesetzt, auf dem Gerät zu prüfen

Alles hier hat Code und Tests; was fehlt, ist der Praxisbeweis auf iPhone
oder iPad. Vorher auf jedem Gerät eine Sicherung erstellen.

- I-09 · „Heute“ aus den „Lerne ich“-Skills aller Bereiche (Umbau 2026-11-19): bis drei Blöcke à 10 Minuten, aufgefüllt mit ☆/Verblasstem, Aufgabe je Skill, Etüden/Licks/Jam-Karte/Spickzettel/Drone/Griffweisen/Transponieren/Metronom voreingestellt, Plan des Tages fest · Regeln und alter Tagesstand in `tests/skills.test.ts`, im Browser (iPhone 390 × 844, iPad 820 × 1180) mit 0, 1, 3 und 5 markierten Skills durchgespielt. Prüfen: Checkliste in I-09.
- B-19 · Stellen-Mix zurück in der Bibliothek (Zeile unter den Sammlungen, Punkt an „Noten“), Lernen nur für Grundlagen; „Woraus“, `ueben:mix-woraus` und `mixQuelle` entfernt · Laden alter Sicherungen getestet, im Browser (iPhone und iPad hoch/quer) durchgespielt. Prüfen: Checkliste in B-19.
- B-18 · Ort „Lernen“ und vier Knöpfe unten (Lernen · Noten | Stimmgerät · Metronom) · `ortUmschalten` getestet (`mixQuelle` mit B-19 entfernt), im Browser (iPhone-Ansicht) durchgespielt. Prüfen: Checkliste in B-18.
- B-17 · Bibliothek öffnet beim offenen Stück · `zumOffenen` getestet. Prüfen: in A–Z ein Stück weit unten öffnen, „Noten“ tippen — offenes und nächstes Stück sichtbar, ohne Ruckeln; danach Sortieren oder Filtern springt nicht.
- B-16 · Doppeltipp auf eine Stelle: heran und Schreibmodus, noch einer zurück in den Spielmodus · `aufStelle` in `zoom.ts` getestet; vom iPad bestätigt („funktioniert gut“). Beim Lesen zoomt der Doppeltipp auf 300 % um den Tipp (`umPunkt`, Faktor vom iPad bestätigt) und schaltet ebenfalls den Schreibmodus ein; der zweite Doppeltipp schaltet beides aus.
- G-02/G-03 · Einsingen oder Audio laden (`Einspielen.tsx`, `notation.ts` mit synthetischer Messlatte „Alle meine Entchen“) · einmal auf dem iPhone probiert (Mund dicht am Mikrofon), seitdem Lesart, Tonart, Anschläge, Latenz und Pegel umgebaut — echte Stimme noch nie gegen den neuen Stand.
  - Lesart 27.10.2026 nach der Recherche (`reports/Gesang zu Noten transkribieren.md`) umgebaut: erst Tonstücke in Sekunden (`segmentieren`: Mindestdauer 100 ms, Lücken bis 130 ms überbrücken, Anschläge nur zum Trennen gleicher Töne, Tonhöhe ohne den Ansatz), dann Legato-Rasterung (nur Einsätze gerundet, Note dauert bis zum nächsten Einsatz, Pause erst ab einer halben Schlaglänge Stille). Prüfen: Ein lang gehaltener Ton bleibt eine Note statt „Sechzehntel, Pause, Sechzehntel“; „schwim-men auf dem“ bleiben vier Viertel; Atempausen zwischen Phrasen werden Pausen.
  - Rückmeldung Marlon 27.10. abends: abgesetztes „la la la“ wird getrennt, weich gesungenes nicht (vier „la“ wurden eine 2,3-s-Note). Aus seiner Aufnahme gemessen: Das weiche „l“ senkt den Gesamtpegel nur 1–2 dB, das Band 600–1500 Hz aber 15–25 dB. Seitdem trägt jeder Rahmen `mitte` (`bandpegel`, Goertzel über 600–1500 Hz) und `silbengrenzen` trennt gleiche Töne an einem Einbruch ≥ 10 dB; an der Aufnahme werden daraus vier Viertel. Prüfen: weiches „la la la la“ auf einem Ton → vier Noten; gehaltener Ton mit Vibrato → eine Note; Mikrofon-Pfad (Analyser 4096) und Datei-Pfad (Fenster 1024) verhalten sich gleich.
  - Lesart (27.10. nachts): Schalter „melodisch / rhythmisch“ im Einsing-Dialog (`ueben:einspiel-lesart`, Gerät). Rhythmisch setzt die Schwellen in Rasterzellen (Mindestdauer und Lückenfüllung 0,4 Zellen, Trennabstand 0,6 Zellen, kürzere Glättung), nach `reports/Rhythmische Melodien erkennen.md`. Prüfstand: Sechzehntelphrase bei 120 bpm ≥ 18 von 22 statt 12–15, „Alle meine Entchen“ unverändert; Grenze bei etwa 130 bpm (Sechzehntel kürzer als das Analysefenster). Prüfen: rhythmisches Stück auf „da“ bei 100–120 bpm singen — Tonwiederholungen getrennt, Sechzehntel da? Dasselbe Stück melodisch: schlechter? Langsames Lied rhythmisch: gleich gut?
  - Mikrofon: „Alle meine Entchen“ bei 90 bpm, 4/4, Tonart C, mit Einzähler singen — kommen 27 Noten, stimmen Höhen und Werte, bleiben wiederholte Töne getrennt, ist nichts um einen Schlag verschoben (Latenz)?
  - Audio-Datei: Sprachmemo (m4a) aus der Dateien-App laden — dekodiert iOS sie, Anhören, Tempo tippen, Taktanfang per Tipp in die Spur?
  - „Als Stück speichern“: Stück steht mit „eingesungen“ in der Bibliothek, PDF öffnet, Stift und Stellen gehen; Sicherung erstellen und auf dem zweiten Gerät laden — bleibt `notation` erhalten?
  - Home-Bildschirm-App und Safari: Mikrofon-Erlaubnis, Verhalten nach App-Wechsel während der Aufnahme.
- Lautsprecher-Schalter (G-03, Commit `bb2c1cf`) · iOS-Verhalten nur aus der Doku abgeleitet, nicht beobachtet.
  - An: Klick kommt aus dem Lautsprecher, Singen aus 30–50 cm Abstand wird erkannt, der Klick taucht nicht als Noten in der Spur auf.
  - Aus: Klick aus dem Hörer, nah am Mund singen — erkennt die Spur dasselbe?
  - Schalter bleibt nach Neustart (`ueben:einspiel-lautsprecher`); Pegelschwelle −50 dBFS: leises Singen kommt an, Raumgeräusche werden nicht zu Noten.
- B-20 · Lautsprecher für alle Klänge: eine Geräte-Einstellung (`ueben:lautsprecher`) statt drei Schaltern, Audio-Sitzung nach dem Mikrofon zurück auf Wiedergabe · `lautsprecher.ts` getestet, im Browser (iPhone- und iPad-Größe) an neun Orten umgeschaltet, nichts verschiebt sich; iOS-Verhalten nur aus WebKit-Quelltext und Fehlerberichten. Prüfen: Checkliste in B-20 (sie ersetzt die Punkte zum Lautsprecher-Schalter direkt darüber).
- G-01 · Notenblatt (`Notensatz.tsx`, `notensatz.ts` getestet) — Schreiben, Noten setzen und verschieben, Palette, Bogen, Takt +/−; seit `08f426e` auch 32tel, Triolen, Löschen/Einfügen · brandneu, nur im Browser gesehen.
  - iPad: Noten mit dem Finger treffen (Skala 1,4 ab 700 px); Ziehen scrollt, ▲▼ und ▲8 ▼8 verschieben; iPhone hochkant: zwei Takte je Zeile lesbar?
  - Notenwert: kürzer (Pause füllt auf), länger (frisst bis zum Taktstrich), punktiert, Achtel-/Sechzehntel-/Vierteltriole, 32tel — zeichnet abcjs alles sauber?
  - Löschen und Einfügen über Taktstriche hinweg; Rückschritt/Entf mit externer iPad-Tastatur, ←→ ↑↓.
  - Mikrofon → „Schreiben“ nimmt den Vorschlag mit; beim Schreiben sind Taktart und kleinster Wert fest, sobald etwas steht.
  - „Als Stück speichern“ mit vielen Takten: Seitenumbruch der PDF, Marker „geschrieben“.
- G-04 · Vorspielen mit Klavierklang (`klavier.ts`, `klaenge` getestet) · Web Audio auf iOS ist eigen; `klavier.ts` legt je Vorspiel einen frischen AudioContext an, hat aber kein `useBeimVerlassen` wie Metronom und Stimmgerät.
  - ▶ Vorspielen und „▶ Ab hier“ starten nach dem Tipp, Ton auch als Home-Bildschirm-App und bei Stumm-Schalter (iOS behandelt Web Audio wie Medien).
  - Lautstärke wie das Metronom, gebundene Noten verschmelzen, Pausen still, grüne Note läuft mit, Stimmung/Kammerton stimmen (in B klingt c als B♭).
  - App-Wechsel oder Dialog schließen während des Vorspielens: Ton stoppt, kein hängender Kontext, nächster Start geht.
- Komponieren am gespeicherten Stück (G-01, `08f426e`, nicht in `main`) · Knopf in der Betrachter-Leiste und im Stück-Blatt nur bei Stücken mit `notation`; `abcLesen` Round-trip und `ueberzaehlig` getestet.
  - Ein eingesungenes Stück mit Stellen und Anmerkungen öffnen → Noten ändern → Speichern: PDF und Titel neu, Stellen/Anmerkungen/Lesezeichen bleiben auf ihrer Seite.
  - Takte löschen, bis eine Seite wegfällt: überzählige Stellen verfallen, Sicherung laden bringt sie nicht zurück (Grabsteine).
  - Importierte oder gescannte PDFs zeigen den Knopf nicht; ein früher eingesungenes Stück (`L:1/16`) lässt sich lesen.
- G-01 (mehrstimmig) · „+ Stimme“ im Notenblatt: je Stimme Name, Violin-/Bassschlüssel, „stumm“ beim Vorspielen; dieselbe Palette; ABC mit `V:`, Round-trip getestet · nur im Browser gesehen.
  - Zwei Stimmen schreiben (Melodie oben, Bass im Bassschlüssel unten), Noten in der zweiten antippen und verschieben — trifft die Auswahl die richtige Stimme?
  - Vorspielen: beide Stimmen zugleich, eine stumm; „▶ Ab hier“ aus der zweiten Stimme.
  - Speichern, öffnen, Komponieren: beide Stimmen kommen zurück; die PDF zeigt die Akkolade auf dem iPad lesbar.
- Titel-Abgleich (G-01) · Umbenennen eines geschriebenen Stücks (⋯ → Umbenennen) schreibt PDF und Quelle neu, der Titel auf dem Blatt folgt · nur im Browser gesehen.
  - Umbenennen → Notenansicht zeigt die neue PDF mit neuem Titel; Stellen und Anmerkungen bleiben.
- G-01 (Markieren) · Rahmen mit Finger/Stift, mehrere Noten verschieben, „Alle“ · nur im Browser mit Maus-Pointer geprüft.
  - iPad mit Stift: „Markieren“ an, Rahmen über drei Noten, ▲8 — alle drei hoch? An einer gewählten Note ziehen: Vorschau folgt dem Stift, Loslassen setzt alle um; das Blatt scrollt dabei nicht.
  - Ohne „Markieren“: Tippen wählt, Ziehen scrollt und ändert keine Höhe mehr.
- G-01 (Bearbeiten, 27.10.) · Rückgängig/Wiederherstellen, Löschen nur im Takt, rote Takte, Note +/Pause +, Schlüsselwahl, geordnete Palette · nur im Browser geprüft.
- G-05 · Aufnehmen in ein geschriebenes Stück (Aufnahmeleiste, 28.10.) · ● in der Palette (nur beim Schreiben/Komponieren) öffnet unten eine schwebende Leiste, scharf am gewählten Takt; ● startet Vorlauf (Takte davor vorgespielt, Klick läuft; bei Takt 1 Einzähler) → Aufnahme → ■ → Vorschau messingfarben im Blatt mit Einfügen/Ersetzen (Vorgabe: leere Zieltakte und Stückende → Ersetzen), − +, Lesart umlegbar; Übernehmen = ein ↶-Schritt, danach steht die Leiste auf dem Folgetakt. Fachregeln in `taktaufnahme.ts` getestet (Nahtstellen-Bögen, Nachklang-Regel, Vorgabe, Vorlaufklänge); Konzept `reports/Einspielen im Stück UX.md`; Mikrofon-Aufnahme jetzt im Hook `mikrofonspur.ts`, den auch der Einsing-Dialog nutzt · nur im Browser gebaut, nie auf dem Gerät.
  - iPhone: Pause im Zieltakt antippen, ● → Leiste zeigt „Aufnehmen ab Takt n“; ● → ein Takt Klavier + Klick, Einsatz sitzt; ■ → Vorschau; Einfügen ↔ Ersetzen, − +, Lesart; ↻ Nochmal; Übernehmen; ↶ holt den ganzen Abschnitt zurück.
  - Lautsprecher an: der Klavier-Vorlauf taucht nicht als Noten im Vorschlag auf. Zweite Stimme: Einfügen schiebt dort leere Takte ein; „Begleitung weiter“ nur mit Kopfhörer.
  - App-Wechsel im Lauf → Prüfen-Zustand mit Spur (gilt jetzt auch im Einsing-Dialog). Palette ist während Vorlauf/Aufnahme/Prüfen schreibgeschützt (sie schrumpft dabei — bewusste Abweichung vom Leitbild, bis eine Sperre ohne Layoutwechsel da ist).
  - Nicht gebaut (siehe Konzept 4.5): Auftakt, „langsamer aufnehmen“ (zeitStrecken liegt bereit), Kalibrier-Knopf für die Latenz, Tipp in die leere Taktfläche, „nur Rhythmus“ als dritte Lesart.
- G-01 (Transponieren, 27.10. nachts) · Mehr → „Transponieren · alle Stimmen“: −1/+1 Halbton für alle Noten aller Stimmen, die Tonart zieht mit (fehlt die Zieltonart in der Liste, bekommen die Noten einzelne Vorzeichen), ein Rückgängig-Schritt; ⓘ erklärt B (+2), Es (+9 oder −3) und F (+7 oder −5) · `transponieren`/`tonartTransponieren` getestet, nur im Browser gesehen.
  - Ein eingesungenes Stück zweimal +1: Noten und Vorzeichen stimmen, ↶ holt beides zurück; nach dem Speichern steht die neue Tonart in der PDF und im ABC.
  - Eine Sechzehntelpause kurz vor Taktende löschen: nur dieser Takt wird rot und kürzer, die Takte danach bleiben; „Pause +“ im passenden Wert macht ihn wieder grün. ↶ holt den Schritt zurück.
  - Palette auf dem iPad hochkant: alles sichtbar, nichts läuft über, Gruppen lesbar; Schlüssel-Knopf öffnet die Auswahl, Alt-/Tenorschlüssel werden gezeichnet und in der PDF.
- G-10 · Notationsregeln mit Hinweisen (`notenregeln.ts` getestet) · Chips unter dem Blatt; Regeln und Vorschläge zum Bearbeiten in G-10.
  - Einen Ton über den Tonumfang schieben, einen Oktavsprung schreiben, Takte leer lassen: kommen die Hinweise, springt Antippen hin? Stimmt der Tonumfang aus dem Tonprofil für dein Instrument?
- G-09 · Aufnahmen beim Üben (`Aufnahmen.tsx`, `lokal.ts` getestet) · MediaRecorder auf iOS (AAC in `audio/mp4`) ist nur aus der Doku bekannt.
  - Roter Knopf in der Notenansicht: Aufnahme startet (Erlaubnis), Zeit läuft, Metronom hörbar? Stopp speichert; im Stück-Blatt erscheint die Aufnahme mit Seite bzw. Stelle (im Stellen-Modus).
  - Abspielen auf dem iPhone bei Stummschalter; zwei Aufnahmen „zusammen“ übereinander; Name, Löschen.
  - App-Wechsel während der Aufnahme: sie endet und ist gespeichert. Speicherverbrauch nach zehn Aufnahmen (Einstellungen → Daten).
- F-07 · Kamera-Scan und Foto-Import (`scan.ts` getestet, PDF selbst geschrieben) · kein Gerätetest notiert; iOS-Grenzen (HEIC, kein Teilen-Blatt) nur aus der Doku.
  - „Einscannen“ öffnet die Kamera direkt, mehrere Seiten nacheinander, Reihenfolge ändern, Drehen.
  - Blattrand auf dunkler und auf heller Unterlage; „Rand anpassen“ mit vier Ecken; Stufen Foto/Scan/Schwarz-Weiß.
  - „Fotos wählen“ mit HEIC aus der Fotos-App; Dauer und Speicher auf dem iPhone bei 5+ Seiten; die PDF öffnet, Dateigröße je Seite unter ~500 KB.
- F-03/F-08/F-20 · Lesezeichen, virtuelle Stücke, Kontext-Blatt, Tags je Sammlung · nur „im Browser durchgespielt“ (2026-10-23), keine Gerät-Rückmeldung notiert.
  - Halten (450 ms) auf iPad/iPhone öffnet das Blatt, ohne dass iOS Text markiert oder sein Kontextmenü zeigt; ⋯ ist mit dem Finger zu treffen.
  - PDF mit Inhaltsverzeichnis → Lesezeichen → „Je Lesezeichen ein Stück“ → öffnen, Stellen setzen, im Mix einer Sammlung mitgenommen.
  - Sicherung mit virtuellen Stücken auf das zweite Gerät laden.
- F-13 (Teil) · „Ordner wählen“ auf dem iPhone · ROADMAP selbst: „auf dem Gerät noch zu prüfen“ (iOS ≥ 18.4).
  - iCloud-Ordner mit Unterordnern wählen → Unterordner werden Sammlungen, nicht geladene iCloud-Dateien werden genannt, nichts doppelt.
- F-23 · Stückauswahl nach Sammlungen und durchsuchbar (Aufnahme-Tagebuch: Filter und „Neu“ → Stück; seit 2026-11-19 Start bei der Sammlung der Bibliothek, Suchfeld, Vorwahl des offenen Stücks, Kontext-Blatt „Sammlungen …“ in Bibliotheks-Reihenfolge) · `stueckAuswahl`, `wahlStart`, Suche und `neueAufnahmeVorwahl` getestet, im Browser durchgespielt (iPhone 390 × 844, iPad 820 × 1180); die Bildschirmtastatur nur auf dem Gerät. Prüfen: Checklisten in F-23.
- I-20 · Aufnahmen über die Bibliothek (Zeile „Aufnahmen“ unter dem Stellen-Mix, eingegrenzt auf Sammlung/Tag, „Alle“; ⋯ → „Aufnahmen …“ je Stück; Stück-Blatt abgestimmt; Kachel in Lernen führt in die Bibliothek) · `tagebuchBereich`, `aufnahmenStand`, `ortSprung` getestet, im Browser mit Fake-Mikrofon durchgespielt (iPhone und iPad). Prüfen: Checkliste in I-20.
- B-08 · Scroll-Ring/Pedal · `geste.ts` getestet, keine Rückmeldung mit echtem Ring notiert.
  - Ring über AssistiveTouch: Probefeld in den Einstellungen zeigt Richtung und Weg; blättert auf den Noten, im Mix Stelle für Stelle; „Hoch und runter tauschen“.
- C-04 · Tonprofil · `tonprofil.ts` getestet, Mikrofon-Pipeline des Stimmgeräts; keine Rückmeldung notiert.
  - Eine Messung über eine Oktave durchführen, Mikrofon geht danach aus, Vergleich mit einer zweiten Messung, Profil reist mit der Sicherung.

### Offen oder im Ausbau

- E-04 (Rest) · Formen (Bindebögen, Crescendo-Keile), Auswahl-Werkzeug (verschieben statt radieren und neu setzen), Ebenen.
- E-12 (Rest) · scharfer Zoom-Ausschnitt mit Schnitten und auf der Doppelseite.
- F-01 · Metadaten · nur Speicher (A-02), keine Oberfläche, keine Suche/Filter, kein Duplizieren.
- F-02 · Setlisten · Speicher da, keine Oberfläche; zurückgestellt (2026-10-23).
- F-04 · Flags/Merker · Speicher `merker` da, keine Oberfläche.
- F-09 · Drag & Drop · nichts begonnen.
- F-12 (Rest) · Notenwert des Zieltempos, Reserve fest 10 %.
- G-01 (Rest) · Vorzeichen direkt setzen, Wiederholungszeichen, Phrasierungsbögen, weitere Schlüssel (Alt, Tenor), Import/Export `.abc`/MusicXML, Filter „nur Geschriebene“.
- G-02/G-03 (Rest) · Triolen in der Erkennung; legato gesungene gleiche Töne bleiben eine Note (Grenze des Verfahrens).
- G-04 (Rest) · Klick dazu, Einzählen, Soundfonts mit Instrumentwahl je Stimme.
- G-09 (Rest) · Aufnahmen je Stelle aus dem Stellen-Blatt starten, Aufnahme neben dem Vorspielen laufen lassen, Vergleich mit Zeitversatz, Speicherübersicht je Stück, Aufnahmen in der Sicherung (optional, groß).
- G-06 · Ganze Songs · bleibt Vision; Experiment (G-08) sagt: nichts bauen.
- G-07 · Klänge einstellen · erst nach G-04.
- I-01 · Ohr-Trainer · erste Fassung im Browser gebaut (2026-11-16), nie auf dem Gerät.
- I-02…I-06 · Lernpfad, Song-Liste, Akkordblatt mit Begleitung, Impro-Feedback, Mitspielen nach Gehör · Vision.
- I-07…I-09 · Skill-Kartei, Hör-Übungen per Antippen, „Heute“-Einheit · im Bau (2026-11-16). I-10 · Vision.
- I-11…I-20 · Werkzeuge (Spickzettel, Transponieren, Griffe, Etüden, Spielhilfe, Licks, Swing-Metronom, Drone, Jam-Karte, Aufnahme-Tagebuch) · erste Fassung im Browser gebaut (2026-11-16), nie auf dem Gerät. Das Tagebuch liegt seit 2026-11-19 über der Bibliothek (oben, „zu prüfen“).
- I-20 (Rest) · „Ein neues Stück aufnehmen“ (ohne vorhandene Noten) · geprüft, nicht gebaut: Ein Stück ohne PDF passt nicht in die Regel „genau eine PDF“ und nicht in `.uebe` v1. Optionen A–D in I-20, Empfehlung A (erzeugte Titelseite); Entscheidung Marlon.
- H-01 (Rest), H-02…H-05 · Sicherung ohne PDFs, Ordner am Rechner, OneDrive/Drive/iCloud · Entscheidung zum Leitbild („kein Login“) offen.

### Was Marlon jetzt tun sollte

1. Auf iPhone und iPad die neue Version laden (Home-Bildschirm-App einmal neu öffnen) und auf jedem Gerät eine Sicherung erstellen, bevor das Komponieren am gespeicherten Stück PDF und Quelle neu schreibt.
2. Aufnehmen einmal ausprobieren (roter Knopf) — geht das Mikrofon auf dem iPhone an, speichert der Stopp, spielt die Aufnahme ab? Das ist der jüngste Code.
3. Einsingen am iPhone mit Lautsprecher an und aus durchspielen (Checkliste oben) — daran ist der letzte Versuch gescheitert, und es ist der Einstieg in alles Weitere.
4. Notenblatt auf dem iPad: Schreiben, Notenwerte samt Triolen, Löschen/Einfügen, Vorspielen; dabei auf Treffsicherheit mit dem Finger achten.
5. Komponieren an einem eingesungenen Stück mit Stellen: ändern, speichern, prüfen, dass Stellen und Anmerkungen bleiben.
6. Kamera-Scan mit einem echten Notenblatt auf dem iPhone (dunkle und helle Unterlage, HEIC-Foto).
7. Im Alltag beobachten statt gezielt prüfen: Kontext-Blatt per Halten, Lesezeichen → virtuelle Stücke, Ordner-Import auf dem iPhone, Scroll-Ring, Tonprofil — und Auffälliges als Rückmeldung hier eintragen.
8. Danach entscheiden, was als Nächstes zählt: Notenmanagement (F-01, F-02, F-04) oder der G-Ausbau (Schlüssel, Vorzeichen, Klick und Einzählen beim Vorspielen).

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

### B-18 · Ort „Lernen“, vier Knöpfe unten — umgesetzt 2026-11-16, zu prüfen

Wunsch Marlon (2026-11-16): Stellen-Mix, Skills und Ohr-Trainer standen als
drei Zeilen in der Bibliothek; mit I-02…I-10 kommt mehr dazu. All das
gehört unter einen eigenen Ort **„Lernen“**. Drei Entwürfe (antippbar in
`docs/design/entwurf-lernen.html`): (A) vier Knöpfe in zwei Gruppen,
(B) Reiter „Noten | Lernen“ oben in der Bibliothek, (C) eine Zeile
„Lernen“ in der Bibliothek. Verworfen: Halten auf „Noten“, Wischen vom
Rand, schwebender Knopf über den Noten, Lernen als Startseite, Knopf in der
Kopfleiste des Stücks.

**Entscheidung Marlon (2026-11-16): A — vier Knöpfe.** Die untere Leiste
ist jetzt **Lernen · Noten | Stimmgerät · Metronom**: links die Orte (ein
Tipp legt ihre Seite über die Noten, noch einer schließt sie, der andere
Ort weicht — ganzer Seitenwechsel, kein Stapel), rechts die Werkzeuge
(Widgets wie bisher), eine Haarlinie dazwischen. Beim Lernen leuchtet
„Lernen“. Damit ändert sich „drei Knöpfe unten“ aus M2; das Stimmgerät
steht nicht mehr ganz links.

**Umgesetzt** (`UntereLeiste.tsx`, `Lernen.tsx`, Regel `ortUmschalten` in
`src/domain/leiste.ts`, getestet):
- **Symbol** Treppe mit Fahne (Stufen, Lernpfad). **Punkt** am Lernen-Knopf
  nur, solange ein Stellen-Mix läuft — wie „läuft“ am Metronom, keine
  Erinnerung an offene Einheiten. *(Seit B-19 sitzt der Punkt am
  Noten-Knopf: Der Mix wird wieder in der Bibliothek gestartet.)*
- **Lernen-Seite** (wie die Bibliothek über den Noten, öffnet immer oben):
  „Heute · 30 Min.“ (I-09, aus der Skill-Kartei hierher gezogen) · „Üben“
  mit Ohr-Trainer und Hör-Übungen (bis B-19 auch Stellen-Mix; neu direkt: Auswahl-Blatt
  Intervalle/Dreiklänge/Septakkorde mit Stufe, jede Runde zählt auf ihren
  Skill) · „Mein Stand“ mit Skills und den Balken je Bereich. Was aus
  I-02…I-10 kommt, erscheint dort, sobald es gebaut ist — vorher nichts
  Ausgegrautes.
- **Bibliothek** ohne die drei Zeilen: nur noch Sammlungen, Tags, Liste.
  *(Seit B-19 ist die Zeile „Stellen-Mix“ zurück; Skills und Ohr-Trainer
  bleiben in Lernen.)*
- ~~**Stellen-Mix „Woraus“**~~ — *mit B-19 entfernt:* Das Mix-Blatt wählte
  selbst — alle Noten oder eine Sammlung, dazu alle Tags —, gemerkt am Gerät
  in `ueben:mix-woraus` (Regel `mixQuelle`). Seit B-19 mischt der Mix
  wieder, was die Bibliothek zeigt.
- Escape schließt erst ein offenes Blatt, dann die Seite. Auf 320 px Breite
  (iPhone SE) passen alle vier Beschriftungen (dort weniger gesperrt).
- **Rückmeldung iPad (2026-11-17):** Als Leiste links (460 px wie die
  Bibliothek) liefen die Texte der Werkzeug-Kacheln über — die Kacheln
  nahmen ab 700 px *Bildschirm*breite drei Spalten. Wunsch Marlon: Lernen
  über die ganze Seite. Seitdem ist Lernen auf dem iPad bildschirmfüllend
  (die Bibliothek bleibt die Leiste links), der Inhalt steht in einer
  mittigen Spalte bis 1040 px. Die Raster richten sich nach der Breite der
  Spalte (Container-Queries): ab 640 px stehen die drei „Heute“-Blöcke
  nebeneinander, ab 680 px Stellen-Mix · Ohr-Trainer · Hör-Übungen (seit
  B-19 ohne Mix: Ohr-Trainer · Hör-Übungen in zwei Spalten) und vier
  Werkzeug-Spalten; schmaler bleibt alles wie auf dem iPhone. Lange Namen
  der Werkzeuge werden getrennt statt abgeschnitten. Geprüft im Browser bei
  820 × 1180, 1180 × 820 und 390 × 844: nichts läuft über.
- **Rückmeldung iPad, zweite Runde (2026-11-17):** „Die Noten können ruhig
  auf dem großen Bildschirm wie meine normalen Stücke angezeigt werden —
  ich hätte gerne mein ganzes iPad in Funktion.“ Seitdem werden die
  Arbeits-Blätter aus Lernen auf dem iPad (ab 740 px) zur **ganzen Seite**
  über der Leiste: alle Werkzeuge, Ohr-Trainer, Hör-Übung und Skill-Kartei;
  der Inhalt in derselben mittigen Spalte wie Lernen, „Fertig“ führt zur
  Übersicht zurück. Auswahl- und Rückfrage-Blätter (Hör-Auswahl,
  Markierung, Skill-Detail, Formulare; bis B-19 die Mix-Optionen) bleiben klein; über den
  Noten (Spickzettel aus der Spielhilfe) und auf dem Handy bleibt alles
  ein Blatt (`seite.tsx`: Kontext `GrosseSeiten` aus Lernen).
  - **Leiste bleibt bedienbar:** Die Seiten liegen in der App-Schale unter
    Widgets und Leiste. Metronom und Stimmgerät schweben darüber — auch
    über der Lernen-Übersicht selbst; vorher lag das Widget *unter* Lernen,
    obwohl der Knopf leuchtete (Fehler aus dem ersten Umbau, behoben).
  - **Tipp auf „Lernen“** bei offenem Werkzeug führt zur Lernen-Übersicht
    zurück wie ein Tab auf dem iPhone; erst der nächste Tipp schließt
    Lernen (`ortTippen` in `src/domain/leiste.ts`, getestet).
  - **Etüden quer** (ab 1000 px): Einstellungen links, bleiben beim Scrollen
    stehen, die Noten rechts über die volle Höhe — sieben Tonarten auf
    einen Blick statt einer. Hochkant untereinander, Noten in voller Breite
    (Notensystem etwa so groß wie in einer Stimme, die die Breite füllt).
  - **Griffweisen** als Seite: Griffbild und Klaviatur größer.
  - Grenze: Wechselt die Breite über 740 px, während ein Werkzeug offen ist
    (Split View), wechselt nur das Aussehen — der Inhalt bleibt.

**Auf dem Gerät prüfen:**
- iPad hoch und quer: Lernen füllt den Bildschirm, alle Kachel-Texte bleiben
  in ihren Kacheln, „Heute“ in drei Spalten.
- iPad: Etüden öffnen → ganze Seite, Leiste unten sichtbar; Metronom an →
  Widget schwebt über den Etüden; Tipp auf „Lernen“ → Übersicht, noch einer →
  Noten. Quer: Einstellungen links, Noten rechts, Scrollen lässt die
  Einstellungen stehen. Ohr-Trainer als Seite: Mikrofon und Klick wie vorher.
- iPhone: Werkzeuge bleiben Blätter von unten wie bisher.
- iPhone hochkant: vier Knöpfe gut zu treffen, nichts abgeschnitten; Lernen
  → Lernen leuchtet; noch ein Tipp → zurück zu den Noten; Noten bei offenem
  Lernen → Bibliothek ersetzt Lernen.
- Metronom und Stimmgerät bei offenem Lernen: Widget schwebt darüber, der
  Ohr-Trainer hört trotzdem richtig.
- ~~Stellen-Mix aus Lernen starten, Punkt am Lernen-Knopf, „Woraus“
  wechseln~~ — entfällt mit B-19 (Mix in der Bibliothek, Checkliste dort).
- „Heute“ → Üben → Runde: Block erledigt, Ohr-Trainer-Zeile zeigt den neuen Stand.

### B-19 · Stellen-Mix zurück in die Bibliothek, Lernen nur für Grundlagen — umgesetzt 2026-11-19, zu prüfen

**Entscheidung Marlon (2026-11-19):** „Der Stellen-Mix soll wieder zurück
über die PDFs einer Sammlung. Dort ist er sinnvoll aufgehoben. Bei Lernen
soll es nicht um Stückarbeit, sondern um grundlegende musikalische Skills
gehen.“ Damit gilt: **Lernen** ist der Ort für grundlegende musikalische
Fähigkeiten (Gehör, Harmonie, Klarinetten-Technik, Improvisation,
Mitspielen nach Gehör); was an den eigenen Noten arbeitet (PDFs, Stellen),
gehört in die **Bibliothek**.

**Umgesetzt** (`Bibliothek.tsx`, `StellenMix.tsx`, `Lernen.tsx`,
`UntereLeiste.tsx`, `UebeZentrale.tsx`):
- **Bibliothek:** Zeile „Stellen-Mix“ direkt unter den Sammlungen, über
  Tags, Werkzeugzeile und Liste. Sie mischt, was die Bibliothek gerade
  zeigt — gewählte Sammlung und Tag (ein gemerkter Tag, den es in der
  Sammlung nicht gibt, ruht wie in F-20). Tippen öffnet die Mix-Optionen wie
  vor B-18: woraus (nur Anzeige: „aus „Märsche“ · Tag“), nur offene, nur
  Favoriten, Zahl, „Mix starten“ / „Weiter bei n von m“ / „Neu mischen“.
  Ein laufender Mix heißt in seiner Zeile „Weiter bei …“.
- **Bedienregel:** Die Zeile steht *über* den Tags, weil deren Zeile je
  Sammlung kommt und geht (F-20). Beim Wechsel der Sammlung oder des Tags
  ändern sich nur Zahl und Text, die Zeile bleibt gleich hoch an ihrem
  Platz. Beim Öffnen kommt sie im selben Lesevorgang wie Sammlungen und
  Liste — vorher ist die Bibliothek leer, nichts rückt nach. (Ein eigener
  Platzhalter wäre selbst gerutscht, sobald die Sicherungs-Erinnerung
  darüber erscheint; darum keiner.) Escape schließt erst die Mix-Optionen,
  dann die Bibliothek.
- **Punkt** in der unteren Leiste, solange ein Mix läuft: jetzt am
  **Noten**-Knopf — dort startet man den Mix und findet „Weiter bei …“ —,
  nicht mehr an „Lernen“.
- **Lernen** ohne Stellen-Mix: „Heute“, Üben (Ohr-Trainer, Hör-Übungen; ab
  680 px Spaltenbreite zwei nebeneinander statt drei, keine leere Spalte),
  Werkzeuge, Mein Stand. Lernen liest keine Stücke und Stellen mehr.
- **Entfernt:** die Wahl „Woraus“ im Mix-Blatt, der Geräte-Schlüssel
  `ueben:mix-woraus` und die Regel `mixQuelle` (`src/domain/stellen.ts`,
  samt Tests). Der Schlüssel war ein Filter am Gerät und reiste nie mit;
  ältere Sicherungen laden unverändert, und steht er doch in einer Datei,
  wird er überlesen (`einstellungen.test.ts`, `sicherung.test.ts`). Ein
  Rest im Speicher eines Geräts wird nicht mehr gelesen und stört nicht.
  Unverändert bleiben die Runden je Bereich (`ueben:mix…`), die Schalter
  `ueben:mix-offen`/`ueben:mix-favoriten` und der laufende Mix
  (`ueben:mix-an`): Ein Mix, der beim Update läuft, läuft weiter, und eine
  Runde aus „Woraus“ geht weiter, sobald die Bibliothek dieselbe Sammlung
  und denselben Tag zeigt.
- **Frage an Marlon, erledigt (2026-11-19):** Den Block
  „Stück/Mitspielen“ in „Heute“ gibt es nicht mehr — erledigt durch den
  Umbau von I-09 („Heute“ aus den „Lerne ich“-Skills aller Bereiche). Die
  Repertoire-Skills (I-07) bleiben in der Kartei (Marlon, 2026-11-19: „ja“):
  Mitspielen und Repertoire nach Gehör, keine PDF-Stückarbeit.
- **Bleibt vorerst in Lernen — Frage an Marlon:** die
  Jam-Karte (I-19, Akkordfolgen, keine PDFs) und das Aufnahme-Tagebuch
  (I-20): Es dient dem Üben mit Aufnahmen (auch zu einem Skill), legt die
  Aufnahmen aber an einem Stück der Bibliothek ab.
  - **Antwort Marlon (2026-11-19), Jam-Karte:** bleibt in Lernen — „ja,
    warum nicht“.
  - **Antwort Marlon (2026-11-19), Aufnahme-Tagebuch:** „Die Aufnahmen
    sollten über die Bibliothek abrufbar sein. Also sollte der Button für
    das Aufnahme-Tagebuch zur Bibliothek leiten, oder? Und da dann ein neues
    Stück aufnehmen, basically, oder pro Stück eine Aufnahme oder mehrere.“
    Umgesetzt in I-20: Zeile „Aufnahmen“ unter dem Stellen-Mix, die Kachel in
    Lernen führt dorthin; „ein neues Stück aufnehmen“ ist geprüft, aber nicht
    gebaut (Optionen in I-20, Entscheidung offen).
- **Geprüft im Browser** (Chromium, iPhone 390 × 844, iPad 820 × 1180 und
  1180 × 820, acht Stücke in drei Sammlungen, zwei Tags, sieben Stellen):
  Zeile über der Liste; Sammlung mit und ohne Tags gewechselt und Tag
  gewählt — Zeile bleibt auf demselben Pixel, 48 px hoch; Optionen ohne
  „Woraus“, Escape schließt nur sie; Mix starten → Punkt an „Noten“,
  „Weiter bei 2 von 4“; Schalter „Stellen“ aus → Punkt weg; Lernen auf
  allen drei Größen ohne Lücke, nichts läuft über.

**Auf dem Gerät prüfen:**
- iPhone und iPad: „Noten“ → Zeile „Stellen-Mix“ unter den Sammlungen.
  Sammlung wechseln (eine mit Tags, eine ohne) und einen Tag antippen: nur
  Zahl und Text ändern sich, die Zeile springt nicht.
- Mix starten: Bibliothek schließt, Stelle auf dem Pult, Punkt an „Noten“.
  Eine Stelle weiter, „Noten“ → „Weiter bei 2 von …“. Schalter „Stellen“ aus
  oder „Fertig“ nach der Runde → Punkt weg.
- Mix-Optionen: „nur offene“ und „nur Favoriten“ wie gewohnt; die Anzeige
  „aus „…“ · Tag“ stimmt mit der Bibliothek überein.
- Lief beim Update ein Mix (aus Lernen gestartet), läuft er weiter; der
  Punkt sitzt jetzt an „Noten“.
- Lernen auf iPhone und iPad hoch/quer: kein Stellen-Mix mehr, Ohr-Trainer
  und Hör-Übungen auf dem iPad nebeneinander, keine Lücke.

### B-20 · Lautsprecher für alle Klänge — umgesetzt 2026-11-19, zu prüfen

Wunsch Marlon (2026-11-19): „Es sollte für alle Feature mit Sound Ausgabe
die Möglichkeit geben, das mit dem Lautsprecher zu machen. Also nicht nur
normaler Gerät Sound.“ Gelesen als: der Schalter „Lautsprecher“ aus G-03
(Einsingen) für jede Funktion, die Ton ausgibt. Eine externe Box ist damit
vermutlich nicht gemeint (offene Frage unten).

**Bestand — wo klingt etwas, wo hört zugleich das Mikrofon:**

| Klang | Mikrofon zugleich |
|---|---|
| Metronom samt Swing (I-17) | wenn Stimmgerät oder Aufnahme (G-09, I-20) laufen |
| Drone (I-18), auch in der Spielhilfe (I-15) | beim Intonieren mit dem Stimmgerät |
| Einsingen, Aufnahmeleiste (G-03, G-05), Ohr-Trainer (I-01): Klick und Klavier-Vorlauf | immer (eigener Mikrofon-Lauf) |
| Vorspielen mit Klavierklang: Notenblatt (G-04), Etüden, Licks, Spickzettel (auch aus der Jam-Karte), Hör-Übungen, Griffe, „Anhören“ im Ohr-Trainer | nur, wenn nebenbei das Stimmgerät läuft (Griffe schaltet sein Mikrofon vorher ab) |
| Referenzton des Stimmgeräts | nie (schaltet das Mikrofon ab) |
| Aufnahmen abspielen (G-09, Tagebuch I-20), Audio-Datei anhören beim Einsingen | nie |

**Was iOS macht (Recherche 2026-11-19):**
- Ohne Mikrofon kommt Web Audio aus dem Lautsprecher bzw. dem im
  Kontrollzentrum gewählten Ausgang (Kopfhörer, Bluetooth, AirPlay). Ohne
  Vorgabe behandelt WebKit reines Web Audio als „ambient“ (stumm beim
  Stummschalter); `navigator.audioSession.type = 'playback'` (ab iOS 16.4,
  laut WebKit-Entwickler zuverlässig ab iOS 17) klingt trotzdem.
- Mit Mikrofon gilt „play-and-record“. WebKit setzt dafür „DefaultToSpeaker“,
  solange die Seite nicht den Hörer als Ausgang gewählt hat. Mit
  Sprachverarbeitung (Echo-Unterdrückung) läuft es wie Freisprechen: laut
  aus dem Lautsprecher. Ohne kommt der Ton aus dem Hörer, viel leiser — so
  am 26.10. beobachtet und so in WebKit-Fehler 326286 (iOS 26/27)
  beschrieben. Rohes Mikrofon und Lautsprecher zugleich gibt es im Browser
  nicht. Ob man den Ausgang wählen darf, ist in der Audio-Session-
  Spezifikation noch offen (Issue #6).
- Nach dem Mikrofon kann der Ton leiser bleiben (Telefon-Lautstärke) oder im
  Hörer hängen (WebKit 236219, 271305, 295889). Abhilfe laut den Berichten:
  die Sitzung wieder auf „playback“ setzen.
- iOS 26.2 bis 27: Solange das Mikrofon mit Echo-Unterdrückung offen ist,
  knackt die Wiedergabe (WebKit 326286, offen).
- Externe Ausgänge: `AudioContext.setSinkId` und `selectAudioOutput` kann
  Safari auf iOS nicht, `HTMLMediaElement.setSinkId` erst ab iOS 26. Die
  AirPlay-Auswahl (`webkitShowPlaybackTargetPicker`) gibt es nur für
  Medien-Elemente, nicht für Web Audio. Box oder AirPods wählt man im
  Kontrollzentrum, und die App spielt dorthin.

**Entscheidung (2026-11-19): eine Geräte-Einstellung „Lautsprecher“, keine
Schalter je Funktion.** (1) Ob der Ton aus dem Lautsprecher soll, hängt an
der Lage (Kopfhörer auf oder nicht), nicht am Werkzeug. Stimmgerät, Drone
und Metronom laufen zugleich, und das offene Mikrofon bestimmt den Weg für
alle Klänge. (2) Der Browser kennt nur einen Hebel: die Sprachverarbeitung
des Mikrofons. Ohne Mikrofon kommt jeder Klang ohnehin aus dem
Lautsprecher. Der Schalter wirkt also genau dann, wenn irgendwo das
Mikrofon hört. (3) Die bisherigen Schalter waren dieselbe Wahl unter drei
Namen: „Lautsprecher“ beim Einsingen, „Mikrofon verstärken“ im Stimmgerät
und „Mit Kopfhörer“ im Ohr-Trainer (nicht gemerkt). Dass „verstärken aus“
beim Stimmgerät auch die Drone in den Hörer legt, sah man nirgends.
**Schnelle Schalter** liegen dort, wo Mikrofon und Ton zusammenkommen. Alle
zeigen und ändern dieselbe Wahl:
- Stimmgerät (statt „Mikrofon verstärken“) und Metronom (unter „Klang,
  Lautstärke, Lautsprecher …“)
- Drone
- Einsingen und Aufnahmeleiste (wie bisher)
- Ohr-Trainer (statt „Mit Kopfhörer“)
- „Neue Aufnahme“ im Tagebuch und das Stück-Blatt unter „Aufnahmen“. Der
  rote Knopf in der Leiste hat ohne Verschieben keinen Platz dafür.

Zentral: Einstellungen → „Ton und Mikrofon“ mit Erklärung. Werkzeuge ohne
eigenes Mikrofon (Etüden, Licks, Spickzettel, Hör-Übungen, Griffe,
Notenblatt) bekommen keinen Schalter. Bedienregel: Der Hinweis neben jedem
Schalter hängt nicht vom Zustand ab, darum verschiebt Umschalten nichts.
Beim Einsingen war der Text vorher je nach Zustand verschieden lang.

**Umgesetzt** (Regeln in `src/domain/lautsprecher.ts`, getestet in
`tests/lautsprecher.test.ts`; Schalter und Speicher in
`src/components/ueben/lautsprecher.tsx`):
- `mikrofonWunsch(lautsprecher, zweck)`: Bei „an“ läuft die
  Echo-Unterdrückung; die Verstärkung nur zum Erkennen (Stimmgerät,
  Einsingen, Ohr-Trainer), beim Aufnehmen nie, sonst pumpen Instrumente.
  Bei „aus“ das rohe Mikrofon. Rauschunterdrückung nie.
  `sitzungFuer(offeneMikrofone)`: „play-and-record“, solange ein Mikrofon
  offen ist, sonst „playback“.
- Gemerkt am Gerät unter `ueben:lautsprecher` (reist nicht mit,
  `einstellungen.ts`). Ist dort noch nichts, gilt `ueben:einspiel-lautsprecher`
  (der Schalter, der schon „Lautsprecher“ hieß), dann
  `ueben:stimm-verstaerken`, sonst „an“. Weichen die beiden alten
  voneinander ab, gewinnt der Einsing-Schalter. Die alten Schlüssel bleiben
  stehen, geschrieben wird nur der neue.
- Audio-Sitzung an einer Stelle (`klang.ts`): Jedes Mikrofon meldet sich
  vor `getUserMedia` an (`mikrofonOffen`) und danach ab. Jeder Klang setzt
  vorher die Sitzung (`wiedergabeSitzung`, für alles Vorspielen in
  `vorspielen`). **Behoben:** Nach Stimmgerät, Einsingen oder Ohr-Trainer
  blieb „play-and-record“ stehen, bis zufällig Metronom oder Drone
  starteten. So lange spielten Hör-Übungen, Spickzettel, Griffe und
  „Anhören“ im Ohr-Trainer in dieser Sitzung, womöglich leiser. Außerdem
  meldete die Aufnahme (G-09) ihr Mikrofon nicht an: Startete währenddessen
  das Metronom, stellte es die Sitzung auf „playback“, und das Mikrofon
  konnte verstummen.
- Aufnahmen (G-09, I-20) folgen der Einstellung. „Aus“ heißt rohes Mikrofon:
  mit Kopfhörer der beste Klang, und der Klick kommt nicht in die Aufnahme.
  Bisher lief die Aufnahme immer mit Echo-Unterdrückung.
- Läuft das Stimmgerät, öffnet Umschalten das Mikrofon sofort neu, noch in
  der Tipp-Geste. Einsingen, Ohr-Trainer und Aufnahme übernehmen die Wahl
  beim nächsten Start; während einer Aufnahme ist der Schalter dort gesperrt.

**Auf dem Gerät prüfen** (iPhone, in Safari und als Home-Bildschirm-App;
vorher eine Sicherung):
- Übernahme: War beim Einsingen „Lautsprecher“ aus, steht der Schalter in
  den Einstellungen auf aus. Alle Schalter zeigen dieselbe Stellung, auch
  nach einem Neustart.
- Ohne Kopfhörer, Lautsprecher an: Stimmgerät und Drone zugleich → die Drone
  kommt laut aus dem Lautsprecher, und das Stimmgerät zeigt die Klarinette,
  nicht die Drone. Mit dem Metronom ebenso. Roter Knopf und Metronom: Der
  Klick ist laut zu hören und in der Aufnahme kaum.
- Ohne Kopfhörer, Lautsprecher aus: derselbe Ablauf → Drone und Klick leise
  aus dem Hörer (so erwartet). Umschalten bei laufendem Stimmgerät macht sie
  sofort wieder laut.
- Mit Kopfhörer, Lautsprecher aus (Kabel und AirPods): Der Ton kommt im
  Kopfhörer. Hört das Stimmgerät über das iPhone-Mikrofon, oder schaltet iOS
  bei AirPods auf deren Mikrofon (Freisprech-Profil, dumpfer Ton)? Bei einer
  Aufnahme mit Klick im Kopfhörer ist der Klick nicht in der Aufnahme.
- Nach dem Mikrofon: Stimmgerät stoppen, dann Hör-Übung, Spickzettel und
  Griffe-„Anhören“ → volle Lautstärke aus dem Lautsprecher.
- Erst die Aufnahme, dann das Metronom starten: Die Aufnahme enthält das
  Spiel.
- Stummschalter an: Metronom, Drone, Vorspielen und Aufnahmen klingen
  trotzdem, ob mit oder ohne Mikrofon.
- iOS 26.2 und neuer: Knackt der Klick, solange das Mikrofon mit
  Lautsprecher an läuft (WebKit 326286)? Wenn ja, ist der Ausweg Kopfhörer
  und Lautsprecher aus.
- Bluetooth-Box über das Kontrollzentrum: Spielt das Metronom ohne Mikrofon
  dort? Bleibt es dort, wenn das Stimmgerät angeht, oder springt iOS um?

**Offen, Fragen an Marlon:**
- War mit „Lautsprecher“ doch eine externe Box gemeint (Bluetooth,
  AirPlay)? Wählen lässt sie sich nur im Kontrollzentrum. Die App könnte
  einen Ausgang höchstens fürs Abspielen von Aufnahmen anbieten
  (`HTMLMediaElement.setSinkId`, ab iOS 26). Das ist nicht gebaut.
- Soll der Schalter auch bei Etüden, Licks und Hör-Übungen stehen? Dort
  wirkt er nur, wenn nebenbei das Stimmgerät läuft.
- Mit Musik aus anderen Apps mischen (Sitzung „ambient“, etwa Metronom zu
  Spotify) ginge auch. Dann wäre der Ton beim Stummschalter aber stumm.
  Gewünscht?

Quellen: WebKit-Quelltext `AudioSessionIOS.mm` und
`MediaSessionManagerCocoa.mm`; WebKit-Fehler 326286, 282939, 295889,
236219, 271305, 264473; W3C Audio Session (w3.org/TR/audio-session);
MDN `AudioSession.type`; caniuse `AudioContext.setSinkId`; LiveKit
client-sdk-js PR 1635 (`HTMLMediaElement.setSinkId` ab iOS 26).

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
soweit sinnvoll.) Auch Sammlungen in der Leiste und in der großen Ansicht
ziehen statt der Pfeile (F-21).

### F-22 · Sammlungen: eine Farbe je Sammlung

Wunsch Marlon (2026-10-26, „muss nicht sofort sein“): Einer Sammlung eine
Farbe geben — wie bei den Tags aus einer kleinen Palette —, sichtbar am Chip
in der Leiste und am Abschnitt in der großen Ansicht. **Kein Icon** je
Sammlung (bewusst weggelassen: nervt mehr, als es hilft). Speicher: Farben
je Name, persönlich (reisen mit der Sicherung wie die Reihenfolge,
`ueben:sammlungen-reihenfolge`), beim Umbenennen mitnehmen.

### F-23 · Stückauswahl nach Sammlungen — umgesetzt 2026-11-19, zu prüfen

Wunsch Marlon (2026-11-19): „Bei Aufnahme-Tagebuch sollte die Stückauswahl
nach den Sammlungen strukturierbar sein. Das gilt für jede Stelle in der
App, bei der die Stücke zur Auswahl stehen.“

**Regel: Wo Stücke zur Auswahl stehen, sind sie nach Sammlungen geordnet
und durchsuchbar.** Jede Stückauswahl — auch jede künftige — nimmt
`StueckWahl.tsx` (gleiches Aussehen, gleiches Verhalten), kein eigenes
`<select>`. Wo Sammlungen zur Wahl stehen, stehen sie in der Reihenfolge der
Bibliothek (seit 2026-11-19 auch „Sammlungen …“ im Kontext-Blatt).

**Entscheidung:**
- **Eigenes Auswahl-Blatt statt `<select>` mit `<optgroup>`.** Im Feld steht
  ein Knopf wie ein Auswahlfeld (gewähltes Stück, ▾); ein Tipp legt ein
  Blatt darüber (iPhone von unten, iPad mittig), darunter rückt nichts.
  Gegen das native Auswahlrad sprach: Dort lässt sich weder auf eine
  Sammlung eingrenzen noch die Ansicht wechseln; ein Stück in zwei
  Sammlungen stünde zweimal ohne Hinweis da; es gibt keine Unterzeile
  (Stimme, Aufnahmen, „auch in …“); auf dem iPhone heißt es drehen und
  „Fertig“ statt zweier Tipps; iPhone und iPad sähen verschieden aus. Das
  Blatt spricht die Sprache der Bibliothek (Chips, Zeilen, Haken).
- **Aufbau:** oben „Sammlungen | A–Z“, darunter die Chips „Alle · die
  Sammlungen in der Reihenfolge der Bibliothek · Ohne Sammlung“ mit Zahl
  (seitlich schiebbar), darunter die Liste. *Sammlungen:* je Sammlung eine
  Gruppe mit Überschrift (bleibt beim Scrollen oben stehen), darin A–Z wie
  in der Bibliothek (Zahlen als Zahlen, gleicher Titel nach Stimme), zuletzt
  „Ohne Sammlung“. *A–Z:* eine Liste, jedes Stück einmal, seine Sammlungen in
  der Unterzeile. Ein Chip grenzt in beiden Ansichten auf eine Sammlung bzw.
  auf „Ohne Sammlung“ ein. Gezählt und gezeigt wird nur, was zur Wahl steht
  (im Tagebuch-Filter: Stücke mit Aufnahmen); hat davon keines eine
  Sammlung, fehlen Umschalter und Chips — eine Liste A–Z.
- **Stücke in mehreren Sammlungen stehen in jeder davon**, mit „auch in …“ —
  wie in der großen Ansicht (F-21). Man sucht ein Stück dort, wo man es
  einsortiert hat; stünde es nur in der ersten Sammlung, fände man es in der
  zweiten nicht. Das gewählte Stück trägt an jeder Stelle den Haken.
- **Bedienregel:** Das Blatt hat eine feste Höhe; Umschalter und Chips
  wechseln nur die Liste (sie beginnt dann oben). Tipp auf ein Stück wählt
  und schließt; ✕, Tipp daneben oder Escape schließt nur das Blatt. Die
  Wahl ändert den Bibliotheks-Filter nicht.
- ~~**Vorwahl:** Ansicht und Eingrenzung sind am Gerät gemerkt, für alle
  Auswahlen gemeinsam (`ueben:stueckwahl`). Noch keine Sammlung getippt →
  die zuletzt in der Bibliothek gewählte (`ueben:sammlung`).~~ — *seit der
  Rückmeldung vom 2026-11-19 (unten): immer die Sammlung der Bibliothek,
  gemerkt ist nur die Ansicht.* Was es nicht mehr gibt, wird „Alle“; liegt
  das gewählte Stück nicht in der Sammlung, ebenfalls „Alle“ — die Wahl
  bleibt sichtbar und rückt beim Öffnen ins Bild.

**Umsetzung** (`stueckAuswahl`, `wahlStart` in `src/domain/sammlungen.ts`,
getestet; `src/components/ueben/StueckWahl.tsx`). Bestand vom 2026-11-19 —
umgestellt:
- Aufnahme-Tagebuch, Filter (bisher „Alle Stücke“ als `<select>`): Stücke
  mit Aufnahmen und ihre Zahl, „Alle Stücke“ als erste Zeile.
- Aufnahme-Tagebuch, „Neu“ → Stück (bisher `<select>` A–Z): alle Stücke,
  in der Unterzeile die Zahl ihrer Aufnahmen.

Durchgesehen, ohne Auswahl aus den eigenen Stücken (nichts umzustellen):
Spielhilfe (hängt an der Stelle), Jam-Karte (eigene Session-Stücke, nicht
die Bibliothek), Licks, Etüden, Skill-Kartei und „Heute“ (ohne Stückbezug),
Sprünge (innerhalb eines Stücks), Kontext-Blatt (wirkt auf ein Stück;
„Eigene Stücke daraus“ wählt Seiten), Sicherung und Übernehmen (alles auf
einmal), Stellen-Mix „Woraus“ (wählt Sammlung und Tag, nicht Stücke —
schon in der Reihenfolge der Bibliothek), Notenblatt/Einsingen und Scan
(„Als Stück speichern“ legt ein neues an), Aufnehmen in den Noten (das
offene Stück). Die Bibliothek selbst hat ihre Sammlungen schon.

**Auf dem Gerät prüfen:**
- iPhone: Tagebuch → Filter tippen: Blatt von unten, darunter rückt nichts;
  der Chip der Bibliotheks-Sammlung ist vorgewählt; Chips seitlich schieben;
  ein Stück tippen → Filter gesetzt, Blatt zu.
- Ein Stück in zwei Sammlungen steht in beiden Gruppen mit „auch in …“,
  gewählt mit Haken an beiden Stellen.
- „A–Z“ ↔ „Sammlungen“ und Chips: nur die Liste wechselt, Kopf und Chips
  bleiben stehen; nach dem Neustart der App dieselbe Ansicht (die Sammlung kommt seit 2026-11-19 von der Bibliothek).
- „Neu“ → Stück: Blatt liegt über „Neue Aufnahme“; während der Aufnahme
  lässt sich das Stück nicht wechseln.
- iPad hoch und quer: Blatt mittig über dem Tagebuch (seit 2026-11-19 aus der Bibliothek, selbst ein Blatt); nach dem
  Schließen sind Leiste und Widgets bedienbar wie vorher.
- 30+ Stücke: Liste scrollt flüssig, Überschrift der Gruppe bleibt oben;
  lange Titel brechen um.
- VoiceOver: Der Knopf nennt „Stück wählen (…): Titel“, die Zeilen sind
  Auswahlpunkte mit „ausgewählt“.

**Rückmeldung Marlon (2026-11-19):**
- Das Blatt soll immer bei der Sammlung starten, die gerade in der
  Bibliothek gewählt ist, statt sich die eigene letzte Wahl zu merken: „ja“.
- Suchfeld im Auswahl-Blatt: „wäre gut, ja“.
- „Neue Aufnahme“ soll das gerade offene Stück vorwählen: „ja“.
- „Sammlungen ändern“ im Kontext-Blatt in Bibliotheks-Reihenfolge statt
  A–Z: „ja“.

**Umsetzung (2026-11-19)** (`wahlStart`, `stueckAuswahl` mit Suche,
`suchForm`/`suchWoerter`/`passtZurSuche`, `reihenfolgeLesen` in
`src/domain/sammlungen.ts`; `neueAufnahmeVorwahl` in
`src/domain/aufnahmetagebuch.ts` — alle zuerst als Test):
- **Start bei der Bibliothek:** Jede Auswahl beginnt bei `ueben:sammlung`.
  `ueben:stueckwahl` trägt nur noch `{ ansicht }` (Sammlungen | A–Z bleibt
  gemerkt — das ist eine Vorliebe wie „A–Z | Zuletzt“ in der Bibliothek,
  keine Eingrenzung). Ein älterer Stand mit `sammlung` darin wird
  überlesen; der Schlüssel bleibt am Gerät und reist nicht mit
  (`einstellungen.test.ts`).
- **Suchfeld** oben im Blatt, unter „Stück wählen“, über den Chips: Titel,
  Stimme, Komponist; Groß/klein, Akzente und ß egal („fucik“ findet
  „Fučík“, „marsch“ findet „Märsche“), mehrere Wörter müssen alle
  vorkommen. Gesucht wird in der gewählten Sammlung; die Chips bleiben
  dieselben (nichts rückt), ihre Zahl nennt die Treffer, Chips ohne Treffer
  sind blass. Nichts in der Sammlung, aber anderswo: „Nichts in „Märsche“
  gefunden · In allen suchen · 2 Treffer“. Beim Suchen steht auch der
  Komponist in der Unterzeile, die Zeile „Alle Stücke“ (Filter) ruht.
  Escape leert erst die Suche, dann schließt es das Blatt. Kein Autofokus
  (die Tastatur käme ungefragt).
- **Tastatur (iPhone):** Das Blatt behält seine Höhe; das Suchfeld liegt im
  oberen Drittel, die Tastatur deckt nur das untere Ende der Liste. Die
  Liste bekommt unten so viel Platz, wie die Tastatur hoch ist
  (`visualViewport`), damit jeder Treffer darüber scrollen kann. 16 px
  Schrift im Feld, damit iOS beim Antippen nicht hineinzoomt.
- **Chips brachen um** (Fehler aus dem Zusammenführen mit B-19: F-23 nutzte
  die Klasse `mix-woraus-chips`, die B-19 entfernt hatte): Sie stehen
  wieder in einer Zeile und lassen sich seitlich schieben (`.sw-chips`).
- **„Neue Aufnahme“:** vorgewählt ist das im Tagebuch gefilterte Stück
  (ausdrücklich gewählt), sonst das offene Stück (`UebeZentrale` gibt es
  über die Bibliothek bzw. das Stück-Blatt weiter), sonst das der neuesten
  Aufnahme, sonst A–Z das erste. Der Filter geht vor, weil „Aufnahmen …“ im
  Kontext-Blatt eines anderen Stücks sonst das offene vorwählen würde.
- **Kontext-Blatt „Sammlungen …“** in der Reihenfolge der Bibliothek
  (`sammlungenOrdnen`, `ueben:sammlungen-reihenfolge`); `REIHENFOLGE` liegt
  jetzt in `src/domain/sammlungen.ts`.
- **Geprüft im Browser** (Chromium, iPhone 390 × 844, iPad 820 × 1180, acht
  Stücke in drei Sammlungen, ein Tag, sieben Aufnahmen, ein alter
  `ueben:stueckwahl` mit „Jazz“): Blatt startet bei „Märsche“ (Bibliothek),
  nicht bei „Jazz“; „blue“ in Märsche → Hinweis, „In allen suchen“ → Blue
  Bossa; „MARSCH“ und „fucik“ finden; Blatt und Liste vor und nach dem
  Tippen auf demselben Pixel (iPhone 101/743 und 323/521 px); Escape leert,
  zweites Escape schließt nur das Blatt; „Neu“ wählt Radetzky-Marsch (offen)
  vor; Kontext-Blatt: Märsche · Orchester A · Jazz (Bibliothek) statt A–Z.
  Die echte Bildschirmtastatur gibt es im Browser nicht.

**Auf dem Gerät prüfen (Nachtrag 2026-11-19):**
- iPhone: Bibliothek auf „Jazz“, dann Tagebuch → Neu → Stück: Das Blatt
  steht auf „Jazz“; Bibliothek auf „Alle“ → Blatt auf „Alle“.
- Suchfeld antippen: Tastatur kommt, das Blatt bleibt, wo es ist, nichts
  zoomt; Treffer stehen über der Tastatur, der letzte lässt sich darüber
  scrollen; ein Treffer-Tipp wählt und schließt (Tastatur geht mit).
- Chips seitlich schieben, auch während der Suche; „Ohne Sammlung“ ganz
  rechts erreichbar.
- Ein Stück offen, Bibliothek → Aufnahmen → Neu: das offene Stück ist
  vorgewählt.
- ⋯ an einem Stück → Sammlungen …: Reihenfolge wie die Leiste der
  Bibliothek (vorher eine Sammlung nach vorn schieben).

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
  wählen“ ein dritter Punkt „Neues Stück schreiben“ (seit 2026-10-26 heißt
  der Punkt „Selbst schreiben“ und ist zugleich der Einstieg zum Einsingen
  und Audio laden, siehe Erledigt). Ist eine Sammlung oder
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

**Begonnen (2026-10-26, Wunsch Marlon: „wie in MuseScore selber Noten
schreiben und die Töne in der Höhe verschieben“):**

- **Notenblatt** (`src/components/ueben/Notensatz.tsx`) im Einsingen-Dialog
  — für den Vorschlag aus Mikrofon oder Datei und für die dritte Quelle
  **„Schreiben“** (leerer Takt; in der Bibliothek „+ Noten → Selbst
  schreiben“ und im Leerzustand „Selbst schreiben“; `art: geschrieben`). Eine
  Stimme, Violinschlüssel.
- **Bedienung:** Note antippen wählt sie (Messing). ▲▼ Halbton, ▲8 ▼8
  Oktave; mit der Maus ziehen = Schritt auf der Leiter (Tonart, sonst
  C-Dur). Auf Touch verschiebt Ziehen nichts (es scrollt) — dort die
  Pfeile. Palette: Notenwert (ganze bis kleinster Wert, punktiert) ändert
  die gewählte Note wie in MuseScore (kürzer: Pause füllt auf; länger:
  frisst die folgenden Noten des Takts, nie über den Taktstrich); „Note“
  schreibt mit dem Palettenwert in die gewählte Stelle (Höhe der vorigen
  Note) und rückt zur nächsten; „Pause“; „Bogen“ bindet an die vorige Note
  (gleiche Höhe, auch über den Taktstrich) bzw. löst; „Takt +“/„Takt −“.
  Tastatur: ↑↓ Halbton, ⇧↑↓ Oktave, ←→ Note, Entf Pause.
- **Rechnen rein in `src/domain/notensatz.ts`** (getestet): Takte als
  Strecken (gebundene gleiche Noten = eine Strecke, Bogen über den
  Taktstrich als Flag), jede Änderung legt den Takt neu in erlaubte Werte
  (`zerlegen`); Bögen wandern beim Verschieben mit, Pausen lösen sie.
- **Raster beim Schreiben:** Taktart und kleinster Wert sind fest, sobald
  etwas auf dem Blatt steht (sonst wäre es weg); Tempo und Tonart bleiben
  frei. Bei Mikrofon/Datei verfällt die Bearbeitung mit neuer Aufnahme oder
  neuem Raster (die Grundlage ist dann eine andere).
- **Zweite Runde (2026-10-26, Wunsch Marlon):**
  - **Blattraster 96 Zellen je Ganze** (`BLATT` in notensatz.ts): 32tel und
    Triolen (Achtel-, Sechzehntel-, Vierteltriole) sind ganze Zellen. Die
    Transkription rundet weiter auf Achtel/Sechzehntel und wird aufs Blatt
    skaliert; „Kleinster Wert“ ist nur noch eine Einstellung der Erkennung.
    `legen` erkennt Triolen-Schläge (Einsätze auf Zwölfteln des Schlags
    statt auf 32teln) und Vierteltriolen über die Takthälfte, schreibt sie
    anderthalbfach mit `(3:2:k`; was sich nicht notieren lässt (etwa eine
    um ein 32tel verschobene Triole), wird in diesem Schlag aufs binäre
    Raster gerundet. Palette: 1/1 … 1/32, Schalter „punktiert“ und „Triole“.
  - **Löschen** (Note raus, alles rückt nach — auch über Taktstriche, der
    letzte Takt füllt sich mit Pause) und **Einfügen** (Platz im
    Palettenwert vor der Note, alles rückt weiter; ein Takt wächst dazu).
    Tastatur: Rückschritt löscht, Entf macht eine Pause.
  - **Mikrofon → Schreiben** nimmt den Vorschlag mit (vorher war er weg).
  - **Komponieren am gespeicherten Stück:** Knopf (Notensymbol) in der Leiste
    der Notenansicht und im Stück-Blatt, nur bei Stücken mit Quelle (nicht
    bei importierten oder gescannten PDFs — die haben keine Noten als
    Daten, bleiben außen vor). `abcLesen` (notation.ts, Round-trip
    getestet) liest die ABC-Quelle zurück, auch ältere mit `L:1/16`; der
    Dialog öffnet als „Komponieren“ mit Vorspielen und Palette; Speichern
    schreibt PDF, Quelle und Titel neu (`stueckNeuSchreiben`, lokal.ts).
    Stellen, Anmerkungen, Lesezeichen und Merker bleiben auf ihrer Seite;
    was über der neuen Seitenzahl liegt, verfällt (`ueberzaehlig`, mit
    Grabsteinen für die Sicherung — Regel als Test).
- **Dritte Runde (2026-10-26 abends, Wunsch Marlon):**
  - **Mehrstimmig:** „+ Stimme“ legt eine Stimme darunter an (die zweite im
    Bassschlüssel), „− Stimme“ nimmt die gewählte weg; je Stimme Name,
    Schlüssel (Violin/Bass) und „stumm“ fürs Vorspielen. Eine Note
    antippen wählt ihre Stimme, die Palette gilt dort; Takt +/− wirkt auf
    alle Stimmen, Löschen/Einfügen nur in der gewählten (kürzere Stimmen
    bekommen leere Takte hinten dran, `angleichen`). ABC mit `V:n name=…
    clef=…` im Kopf und `V:n` vor den Takten; eine namenlose Stimme im
    Violinschlüssel bleibt ohne V: — jedes bisher gespeicherte Stück liest
    sich unverändert. Das Vorspielen mischt alle Stimmen (`klaengeAlle`).
  - **Titel-Abgleich:** Umbenennen (⋯ → Umbenennen) eines geschriebenen
    Stücks tauscht die `T:`-Zeile (`abcMitTitel`) und schreibt PDF und
    Quelle neu (`notenpdf.ts`), die Notenansicht lädt neu.
- **Vierte Runde (2026-10-27, Rückmeldung Marlon vom iPad):**
  - **Ziehen auf Touch repariert:** abcjs reicht bei Touch keinen Event,
    sondern den Berührungspunkt durch — der Scroll zählte als Ziehen, mal in
    die eine, mal in die andere Richtung. Ziehen ändert jetzt nur noch mit
    der Maus die Höhe.
  - **Markieren** (Knopf in der Palette): Finger oder Stift ziehen einen
    Rahmen über Noten — Mehrfachauswahl, auch über Stimmen; an einer
    gewählten Note ziehen verschiebt alle gewählten auf der Leiter (mit
    Vorschau); Tippen daneben hebt auf. ▲▼ ▲8 ▼8, Pause, Löschen wirken auf
    alle gewählten („Löschen (3)“), „Alle“ wählt alle Noten der Stimme,
    ⌘A/Strg+A ebenso. Fachlogik: `verschiebenViele`, `pausenViele`,
    `entfernenViele` (von hinten nach vorn, damit Lagen gültig bleiben).
  - **Titel-Abgleich** lädt die Notenansicht auch dann neu, wenn aus der
    Bibliothek umbenannt wird, während das Stück offen ist (Ereignis
    `ueben:stueck-neu` aus `stueckNeuSchreiben`).
- **Fünfte Runde (2026-10-27, Rückmeldung Marlon):**
  - **Rückgängig / Wiederherstellen:** ↶ ↷ in der Palette, ⌘Z / ⇧⌘Z / ⌘Y;
    Verlauf im Dialog bis 200 Schritte, je Grundlage (eine neue Aufnahme
    hat ihren eigenen).
  - **Bearbeiten lässt die Nachbartakte in Ruhe.** Löschen nimmt die Note
    nur aus ihrem Takt; den Notenwert setzen füllt nichts auf und frisst
    nichts mehr. Ein Takt darf dabei zu kurz oder zu lang sein: er wird
    **rot** gezeichnet, mit Hinweis „Takt 3: 3½ statt 4 Schläge — Pause oder
    Note einfügen“, bis er stimmt. So lässt sich ein bestehender Satz
    aufräumen, ohne dass alles verrutscht (vorher schob Löschen die Noten
    der folgenden Takte nach — „wilde Sachen“).
  - **Hinter der gewählten Note einfügen:** „Note +“ (Höhe der gewählten)
    und „Pause +“, jeweils im Palettenwert, nur in diesem Takt. Der
    Palettenwert auf einer Pause teilt sie (vorn der Wert), auf einer Note
    setzt er nur deren Wert. „Note“ schreibt wie bisher in die gewählte
    Pause. Das Verschieben über Taktgrenzen („Einfügen“ alt) ist aus der
    Palette raus; die Fachlogik dafür bleibt getestet liegen.
  - **Schlüssel je Stimme:** Violin, Bass, Alt (Bratsche), Tenor — als
    Knopf mit Auswahl; ABC `clef=treble|bass|alto|tenor`, gelesen und
    geschrieben.
  - **Palette** vom UI/UX-Durchgang geordnet: eine Hauptzeile gleich hoher
    Symbolblöcke (▶ · ↶ ↷ · ▲ ▼ · Note/Pause/Löschen · Haltebogen/Bindebogen
    · 1/1–1/16) und rechts zwei Menüs: „Mehr“ (Oktave, dahinter einfügen,
    1/32/punktiert/Triole, Takt +/−, Markieren/Alle) und „Stimme“ (Stimmen,
    Name, Schlüssel-Auswahl, stumm). Schnellabruf fürs Häufige, der Rest
    aufklappbar — so wie Marlon es wollte.
  - **Zwei Bögen:** *Haltebogen* (gleiche Höhe, Dauern addieren sich) bindet
    über die ganze Auswahl jedes Paar aufeinanderfolgender gleicher Töne;
    *Bindebogen* (Phrasierung, ABC `(` … `)`) spannt von der ersten zur
    letzten gewählten Note, nochmal entfernt ihn. Vorher gab es nur den
    Haltebogen zur vorigen Note.
- **Noch offen aus der Liste oben:** Vorzeichen setzen (heute über
  Halbtonschritte), Wiederholungszeichen, Bindebögen als Phrasierung,
  weitere Schlüssel, Import/Export `.abc`, Triolen auch in der Erkennung,
  Noten aus einer gescannten PDF (wäre Notenerkennung aus Bildern — eigenes
  Thema, nicht kurzfristig).

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

**Konkretisiert und begonnen (2026-10-26, Branch `feature/einspielen-ui`):**

- **Einstieg über „+ Noten“:** fünfter Punkt „Einsingen oder Audio laden“
  (neben dem Leerzustand-Knopf „Einsingen“; seit 2026-10-26 beides über
  „Selbst schreiben“ — der Dialog öffnet mit der Quelle „Schreiben“, oben
  wechselt man zu Mikrofon oder Audio-Datei). Ein eigener Vollbild-Dialog
  wie beim Scan: Quelle Mikrofon oder Audio-Datei (Sprachmemo m4a, mp3,
  wav — eine Stimme, kein ganzer Song), Tempo (Feld, Tippen), Taktart,
  kleinster Notenwert (Achtel/Sechzehntel), beim Mikrofon ein Takt
  Einzähler und Klick während der Aufnahme. Tonhöhenspur als Bild, bei der
  Datei mit Anhören, Tempo mittippen und Taktanfang per Tipp in die Spur.
- **Ergebnis ist ein Vorschlag** (abcjs zeichnet ihn). „Als Stück
  speichern“ legt ein normales Stück an: PDF (aus den Notenzeilen auf
  A4-Seiten verteilt) in `dateien`, dazu das neue optionale Feld
  `notation` am `Stueck` (`format: abc`, `text`, `art: geschrieben |
  eingesungen | audio`). Sammlung/Tag wie beim Import. Audio wird nicht
  gespeichert.
- **Bibliothek:** Marker als Unterzeile („eingesungen“, „aus Audio“,
  „geschrieben“), keine Sonder-Sammlung; ein Filter „nur Geschriebene“
  später. „Bearbeiten“ im Kontext-Blatt kommt mit dem Editor (G-01).
- **Nach dem Bearbeiten** (G-01): Stellen und Anmerkungen bleiben auf ihrer
  Seitennummer, überzählige verfallen — Regel zuerst als Test.
- **Rechnen in `src/domain/notation.ts`** (getestet): Rahmen (Tonhöhe mit
  Cent, Pegel) → Hysterese (ein Ton läuft weiter, solange die Tonhöhe
  weniger als einen Dreiviertel-Halbton vom Median der ganzen Strecke
  abweicht: Vibrato zerhackt nichts, Gleiten wandert nicht mit; kurze
  Aussetzer überbrückt) → Zellen (Median je Zelle, Mindestanteil klarer
  Rahmen, mit **Tonart** auf den nächsten Leiterton gerundet) → Glätten
  einzelner Ausreißer → Oktav-/Ansatz-Korrektur → Strecken (ein Einsatz
  nach einer kurzen Lücke **oder ein Anschlag im Pegel**, Anstieg ≥ 6 dB in
  50 ms, trennt auch gleiche Töne) → Notenwerte (auf dem Schlag bis zur
  Takthälfte, dazwischen bis zur Schlaggrenze; Pausen ohne Punktierung) →
  Bindebögen über Taktgrenzen → ABC mit Tonart und Vorzeichen nach
  Notationsregel (gilt bis zum Taktstrich). Vorher wird die **Latenz** aus
  der Lage aller Tonwechsel gegen das Achtelraster geschätzt und die Spur
  vorgezogen. Die Tonerkennung ist die des Stimmgeräts (YIN), notiert fürs
  Instrument; die Tonart ist in notierter Lage gemeint.
- **Herkunft der Lesart (2026-10-26):** aus dem Prüfstand
  `experimente/transkription/monophon.py` übertragen (siehe G-08,
  Ergebnis des Experiments). Messlatte: „Alle meine Entchen“ (27 Noten,
  90 bpm) als synthetische Spur mit Vibrato und Klavier-Pegel wird in
  `tests/notation.test.ts` Note für Note richtig gelesen, auch um 120 ms
  verspätet und ohne Tonart; legato gesungene gleiche Töne ohne Neuansatz
  bleiben eine Note (das bleibt die Grenze des Verfahrens). Zur
  Tonart-Auswahl im Dialog gehört „keine“ (Töne bleiben, wie gehört).
- **Lautsprecher und Anhören (2026-10-26, Wunsch Marlon):** Auf dem iPhone
  musste man mit dem Mund dicht ans Mikrofon. Zwei Gründe: Die Aufnahme lief
  mit rohem Mikrofon (ohne Sprachverarbeitung — iOS schaltet dann auf den
  Hörer um, verstärkt nichts), und die Tonerkennung galt erst ab −42 dBFS
  (Stimmgerät am Instrument). Jetzt: Schalter **„Lautsprecher“** im Dialog
  (Vorgabe an, Gerät-Einstellung `ueben:einspiel-lautsprecher`): Echo-
  Unterdrückung und Verstärkung des Browsers, auf dem iPhone dasselbe wie
  Freisprechen beim Telefonieren — Klick aus dem Lautsprecher, Mikrofon hört
  auch aus Abstand, der Klick bleibt aus der Aufnahme draußen.
  Rauschunterdrückung bleibt immer aus (nimmt gehaltene Töne als
  Dauergeräusch). Aus = rohes Mikrofon, nah am Mund, unverfälscht. Die
  Pegelschwelle fürs Einsingen liegt bei −50 dBFS (`grundfrequenz`,
  Parameter `mindestPegel`; das Stimmgerät behält −42). Mehr geht im Browser
  nicht: iOS kennt keinen Weg, Lautsprecher und rohes Mikrofon zu
  kombinieren. Die eigene Aufnahme wird nicht behalten — angehört wird das
  Transkribierte (G-04), korrigiert im Notensatz (G-01).

**Lesart (27.10.2026):** Die erste Fassung rundete Anfang und Ende jeder
Note unabhängig auf das Raster und ließ Pegel-Anschläge jede Note teilen;
gehaltene Töne zerfielen in „Sechzehntel + Sechzehntelpause“. Die Recherche
(`reports/Gesang zu Noten transkribieren.md`) zeigt, dass kein
veröffentlichtes Verfahren so arbeitet. Seitdem gilt in `notation.ts`:
Tonstücke in Sekunden (Hysterese mit Bestätigung über mehrere Rahmen,
Mindestdauer 100 ms, Lücken bis 130 ms, Anschläge nur zum Trennen gleicher
Töne, weiche Silbengrenzen aus dem Mittenband 600–1500 Hz), dann die
Legato-Regel beim Rastern (Einsätze gemeinsam gerundet mit
Vorliebe für Schlag und Achtel, Dauer bis zum nächsten Einsatz, Pause erst
ab einer halben Schlaglänge Stille). Dasselbe im Python-Prüfstand
(`experimente/transkription/monophon.py`, dort zusätzlich mit dem
Noten-HMM aus pYIN/Tony). Nicht gebaut: KI-Nachbearbeitung — Claude nimmt
kein Audio an, Audio-LLMs hören Tonhöhen schlecht; wenn überhaupt, später als
persönliche Geräte-Einstellung mit eigenem API-Schlüssel über ABC-Text.

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
Notation — Marlon hat es 2026-10-26 ins Leitbild genommen (s. dort).

**Begonnen (2026-10-26):** „▶ Vorspielen“ im Notenblatt (G-01) spielt die
Takte — ab der gewählten Note („▶ Ab hier“) — mit einem **Klavier-ähnlichen
Ton aus Web Audio** (`src/components/ueben/klavier.ts`: Obertonwelle,
Tiefpass, der nach dem Anschlag zugeht, Hüllkurve; zwei leicht verstimmte
Oszillatoren), klingend fürs Instrument (Stimmung und Kammerton des
Stimmgeräts), Lautstärke wie das Metronom. Die gerade klingende Note wird
grün markiert. Kein Soundfont nötig — läuft offline und wiegt nichts; echte
Instrumentklänge (Soundfonts in `public/`, wie oben eingeschätzt) bleiben
die Ausbaustufe, dann mit Instrumentwahl je Stimme (G-07). Die Klänge
(`klaenge` in `src/domain/notensatz.ts`, getestet) verschmelzen gebundene
Noten; Pausen klingen nicht. Noch nicht: Klick dazu, Einzählen, mehrere
Stimmen, Stummschalten.

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

### G-09 · Aufnahmen beim Üben: Versionen anhören, vergleichen, übereinander

Wunsch Marlon (2026-10-26): Beim Üben eines Stücks oder einer Stelle die
eigene Stimme **aufnehmen**, Versionen vergleichen, mehrere Aufnahmen
**übereinander** abspielen (zwei Stimmen schichten, zwei Versionen hören).
Sorge: der Speicher.

**Erste Stufe gebaut (2026-10-26):**

- **Aufnehmen aus der Notenansicht:** roter Knopf in der Leiste, läuft mit
  Zeitanzeige, Stopp speichert (`Aufnahmen.tsx`, `useAufnahme`). Mit
  Seite, im Stellen-Modus mit der Stelle. Mikrofon mit Echo-Unterdrückung
  (der Metronom-Klick bleibt draußen), ohne Verstärkung (Instrumente
  pumpen sonst). App-Wechsel beendet und sichert die Aufnahme.
- **Im Stück-Blatt** der Abschnitt „Aufnahmen“: neueste zuerst, Name oder
  Zeitpunkt, Dauer, Seite/Stelle; ▶ anhören, „zusammen“ ankreuzen und
  **übereinander abspielen**, umbenennen, löschen. *Seit 2026-11-19 mit dem
  Aufnahme-Tagebuch abgestimmt (I-20): dieselben Angaben je Zeile (auch der
  Skill), „zusammen“ unter dem Namen, und der Weg ins Tagebuch auf dieses
  Stück gefiltert (Vergleichen A/B, „Neu“ mit Skill). Über die Bibliothek:
  ⋯ an einem Stück → „Aufnahmen …“.*
- **Speicher:** `MediaRecorder`, komprimiert (AAC `audio/mp4` auf iPhone
  und iPad, Opus/WebM in Chrome, 96 kbit/s): **etwa 0,7 MB je Minute**.
  Hundert Aufnahmen à zwei Minuten sind ~150 MB — das ist für IndexedDB
  auf dem iPhone in Ordnung (Safari erlaubt je Seite im Regelfall mehrere
  GB, abhängig vom freien Platz), aber nicht nichts; der Speicherstand
  steht unter Einstellungen → Daten. Datenmodell: Angaben am Stück
  (`aufnahmen`), Bytes in `dateien` unter der id der Aufnahme — kein neuer
  Speicher, keine Schema-Version (docs/datenmodell.md). Löschen des
  Stücks räumt sie mit weg (`lokal.test.ts`).
- **Sicherung:** Aufnahmen reisen **nicht** mit (die `.uebe` würde um
  hunderte MB wachsen und der Registerführer kennt das Feld nicht); beim
  Laden einer Sicherung bleiben die Aufnahmen des Geräts stehen. Wer sie
  auf ein anderes Gerät will, braucht einen eigenen Weg (s. u.).

**Gedanken für morgen (Marlon liest):**

- **Was fehlt für „Stellen aufnehmen“ im engen Sinn:** Heute startet die
  Aufnahme in der Notenansicht und merkt sich die Stelle nur, wenn der
  Stellen-Modus läuft. Nächster Schritt: ein Aufnahmeknopf im Stellen-Blatt
  und in der Übe-Ansicht, der die Stelle direkt zuordnet, und im
  Stellen-Blatt die Liste nur dieser Stelle — dann wird aus den Versionen
  ein Verlauf („Takt 12 am 3. Mai / am 10. Mai“), parallel zur Tempo-Kurve.
- **Übereinander spielen, musikalisch brauchbar:** Zwei Aufnahmen starten
  heute im selben Moment. Für „zwei Stimmen schichten“ muss das zweite
  Spiel zur ersten Aufnahme eingezählt sein — also: beim Aufnehmen
  wahlweise eine vorhandene Aufnahme (oder das Vorspielen der Noten, G-04)
  mitlaufen lassen, über Kopfhörer, mit demselben Einzähler. Technisch
  bereit (Web Audio, `MediaRecorder`), fehlt nur der Dialog. Ohne Kopfhörer
  nimmt das Mikrofon die laufende Aufnahme mit auf; die Echo-Unterdrückung
  hilft, ersetzt aber keinen Kopfhörer.
- **Vergleichen:** Nacheinander anhören geht; nützlicher wäre ein
  Umschalten im laufenden Abspielen (A/B an derselben Stelle) und eine
  Wellenform/Pegelspur je Aufnahme, in der man tippen kann. Beides ist
  Oberfläche, keine neue Technik.
- **Speicher im Griff behalten:** je Stück die Summe anzeigen, alte
  Aufnahmen mit einem Tipp löschen („alle außer den markierten“), und
  eine Obergrenze pro Aufnahme (heute keine — eine vergessene Aufnahme
  läuft, bis die App verlassen wird; Vorschlag: nach 20 Minuten von
  selbst stoppen). Export einer Aufnahme als Datei (Teilen-Blatt) wäre
  billig und löst auch „auf ein anderes Gerät“.
- **Grenzen auf iOS:** Mikrofon und Lautsprecher zugleich schaltet iOS in
  den Freisprech-Modus (leiser, Klick aus dem Lautsprecher, siehe G-03);
  Aufnahme im Hintergrund (Bildschirm aus) hält Safari nicht durch —
  dafür der Wach-Halter, solange die App vorn ist.

### G-10 · Notationsregeln fürs Komponieren

Wunsch Marlon (2026-10-26): feste Regeln, nach denen das Blatt notiert —
etwa Töne und Pausen so, dass der Schlag sichtbar bleibt — und kurze
Hinweise im Notenblatt, wo etwas für den Musiker schlecht lesbar ist. Diese
Liste ist zum Bearbeiten gedacht: Regeln streichen, ergänzen, umformulieren
— der Code folgt der Liste (`src/domain/notensatz.ts` hält A ein,
`src/domain/notenregeln.ts` prüft B; beides getestet).

**Quellen:** Elaine Gould, *Behind Bars* (Faber; die
[General-Conventions-Ausgabe](https://www.fabermusic.com/news/new-behind-bars-general-conventions-published-22062023)
mit Ground Rules, Dotted Notes and Ties, Accidentals, Metre and Tuplets);
die Pausen-Regeln daraus zusammengefasst im
[CPDL-Forum](https://forums1.cpdl.org/phpBB3/viewtopic.php?p=19653); die
Unterlagen des Steirischen Blasmusikverbands
([MHV 1](https://verwaltung.steiermark.at/cms/dokumente/11720609_76976100/4a0482b8/MHV%201%20Unterlagen_2022.pdf):
im 3/4 jeder Schlag sichtbar, im 4/4 die Taktmitte); das
[MuseScore-Handbuch](https://musescore.org/de/print/book/export/html/278600)
(Balken nach Taktart) und [bonedo, Rhythmik-Grundlagen](https://www.bonedo.de/artikel/basics-grundlagenforschung-rhythmik-1/3).

**A · Regeln, die das Blatt von selbst einhält (nichts zu tun):**

1. **Der Schlag bleibt sichtbar.** Jede Note und Pause wird an Schlag- und
   Gruppengrenzen geteilt und gebunden: zwischen den Schlägen bis zur
   nächsten Schlaggrenze, auf dem Schlag bis zur Gruppengrenze. Im 4/4 ist
   die Gruppe die Takthälfte („gedachter Taktstrich“), im 3/4 der Schlag,
   im 6/8 der punktierte Schlag.
2. **Gebundene gleiche Noten werden eine** (punktiert, wo es geht); nichts
   wird in kleinere Werte zerhackt als nötig.
3. **Pausen ohne Punktierung** in geraden Taktarten; im 6/8 ist die
   punktierte Viertelpause der Schlag und erlaubt. Ein leerer Takt ist eine
   ganze Pause.
4. **Balken je Schlag** (abcjs balkt, was ohne Leerzeichen steht; das Blatt
   setzt an jeder Schlaggrenze eines), Fähnchen bleiben einzeln.
5. **Vorzeichen nach Notationsregel:** die Tonart setzt sie, ein gesetztes
   Vorzeichen gilt bis zum Taktstrich für diesen Ton, Auflösungszeichen wo
   nötig; in B-Tonarten mit Bs, sonst mit Kreuzen.
6. **Triolen geklammert** (`3`), Achtel-, Sechzehntel- und Vierteltriolen;
   gemischte Werte in der Klammer sind erlaubt. Was sich nicht notieren
   lässt, wird im betroffenen Schlag aufs binäre Raster gerundet.
7. **Mehrere Stimmen** teilen Taktart, Tonart und Taktzahl; die zweite
   bekommt den Bassschlüssel.

**B · Regeln mit Hinweis (Chips unter dem Blatt, Antippen springt hin):**

| Regel | Hinweis | Art |
|---|---|---|
| Taktlänge passt nicht zur Taktart (beim Bearbeiten erlaubt, muss aber korrigiert werden; Takt rot) | „Takt 3: 3½ statt 4 Schläge — Pause oder Note einfügen.“ / „5 statt 4 Schläge — Note kürzen oder löschen.“ | takt |
| Ton außerhalb des Tonumfangs (notiert; Umfang aus dem Tonprofil, Stimmgerät → Tonprofil) | „Takt 4: C6 liegt über dem Tonumfang (bis G5).“ | spielbar |
| Sprung über eine Oktave zwischen zwei Tönen (Pause dazwischen zählt nicht) | „Takt 2: Sprung C4 → E5 (16 Halbtöne) — schwer zu treffen.“ | spielbar |
| Acht und mehr Takte ohne eine Pause | „Takt 1–8: keine Pause zum Atmen.“ | spielbar |
| Punktierter Wert in einer Triole | „Takt 3: punktierter Wert in einer Triole — schwer zu lesen; lieber zwei gebundene Noten.“ | lesbar |
| Stimmen kreuzen sich (untere liegt über der oberen) | „Takt 5: Bass liegt über Melodie.“ | lesbar |
| Viele Töne außerhalb der Tonart, eine andere passt deutlich besser (ab 8 Tönen, 3 fremde, 3 weniger) | „4 Töne liegen außerhalb von C-Dur — in G-Dur wären es 0. Tonart prüfen.“ | lesbar |
| Takt 1 beginnt mit mindestens einem halben Takt Pause | „Takt 1 beginnt mit 3 Schlägen Pause — ein Auftakt wäre üblich.“ | form |
| Leere Takte am Ende | „Takt 7–8 sind leer — „Takt −“ nimmt sie weg.“ | form |

Höchstens ein Hinweis je Regel und Takt; mehr als sechs werden eingeklappt.

**C · Vorschläge für weitere Regeln (Marlon entscheidet, dann bauen):**

- **Auftakt** wirklich notieren (unvollständiger erster Takt, der letzte
  ergänzt ihn) statt nur hinweisen.
- **Schlüssel nach Lage:** viele Hilfslinien über oder unter dem System →
  „anderer Schlüssel oder Oktavierung“ (ab vier Hilfslinien).
- **Pausen zusammenfassen:** zwei Achtelpausen auf dem Schlag → eine
  Viertelpause (Gould: zusammengefasste Pausen zeigen den Schlag besser);
  heute entsteht das durch das Legen meist von selbst.
- **Atemzeichen und Phrasierung:** Bindebögen über Phrasen, Komma als
  Atemzeichen — braucht neue Zeichen im Datenmodell.
- **Wiederholungen statt Kopien:** gleiche Taktfolge zweimal → „Wiederholung
  mit Wiederholungszeichen schreiben“ (G-01 Rest).
- **Tempo und Notenwerte:** viele 32tel bei langsamem Tempo → „doppeltes
  Tempo, halbe Werte“; umgekehrt viele ganze Noten bei schnellem Tempo.
- **Synkopen:** heute bindet das Blatt streng an jeder Schlaggrenze; die
  übliche Synkope Achtel–Viertel–Achtel innerhalb einer Takthälfte darf
  laut Gould ungebunden stehen. Wäre eine Ausnahme in Regel A1.
- **Instrumentumfang je Instrument** (Trompete, Klarinette, Posaune …)
  statt nur aus dem Tonprofil; dazu Warnung vor unbequemen Lagen (hohe
  Töne über längere Strecken).
- **Dynamik und Artikulation** als Zeichen — und die Regel, dass jede
  Stimme am Anfang eine Dynamik trägt.

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

**Ergebnis des Experiments (2026-10-26, Windows-Rechner, CPU):**

- **Ganze Songs (G-06): bleibt Vision.** Demucs + Basic Pitch an Metallica
  „The Unforgiven II“: Stems brauchbar, Noten nicht — 4215 „Gitarrennoten“
  aus Verzerrung und Obertönen, Gesang und Bass kaum lesbar. Die Tempo-
  Schätzung verdoppelt bei langsamen Songs. Korrigieren wäre langsamer als
  Abschreiben. Kommerzielle Werkzeuge (Klangio, ScoreCloud, Moises) sind
  besser, aber auch dort bleibt viel Nacharbeit. Keine Zeile dafür bauen.
- **Einzelne Stimme monophon (G-03/G-05): funktioniert.** `monophon.py`
  (pYIN statt Basic Pitch, Hysterese gegen Vibrato, Teilen an Anschlägen,
  Oktav-/Ansatz-Korrektur, Tonart-Rundung, Latenz aus den Einsätzen,
  Sechzehntelraster, MusicXML mit Schlüssel/Tonart/Taktart) gegen eine
  Referenz-Partitur „Alle meine Entchen“ (`referenz/`, `vergleichen.py`):
  Klavier-Rendering 27/27 Noten exakt; eigene Stimme zum Metronom 19 von 22
  Noten getroffen, 4 überzählige Fragmente. Rest sind Sänger-Fehler (zu
  tief, zu spät) und Wiederholungen ohne hörbaren Neuansatz.
- **Folgerung:** G-05/G-03 in die App, ohne Modelle — die Kette ist reines
  Rechnen und läuft im Browser mit der Tonerkennung des Stimmgeräts.
  Übertragen nach `src/domain/notation.ts` (Branch `feature/einspielen-ui`);
  `monophon.py` bleibt als Referenz, `vergleichen.py` als Messlatte.
  Bass-Stems aus Demucs lassen sich mit derselben monophonen Lesart lesen
  (318 statt 1821 Noten, Intro-Linie sauber) — ein Nebenweg für später.

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

## I — Freies Spielen: nach Gehör mitspielen, improvisieren, begleiten (Vision)

Wunsch Marlon (2026-11-16): Nach zwölf Jahren Klarinette nach Noten soll
**spontanes Musizieren** dazukommen — Lieder, die er hört, mitspielen, weil
er die Melodie kennt; improvisieren, Soli spielen, begleiten; Pop, City Pop,
Jazz. Erste Situation: mit Freunden und bei Jam-Sessions (Düsseldorf:
Jazz-Schmiede dienstags, „JamSession für Beginner“ in den Schwanenhöfen).
Rahmen: 4 × 30 Minuten pro Woche, allein, kostenlose Angebote.

**Warum in CheatSheet:** Was im Chat steht, geht verloren; die App wird
täglich geöffnet. Der Plan und die Übungen leben deshalb hier.

**Stand und größte Baustelle:** Noten lesen und Stücke erarbeiten: sicher.
2-5-1 benennen: ja, mit Nachdenken. Eine gesummte Melodie ohne Ausprobieren
greifen: noch nicht — die Richtung des nächsten Tons stimmt grob, die
Abstände nicht. **Das Gehör ist der Engpass**, darum kommt I-01 zuerst.

**Übe-Aufbau (Leitlinie für I-02):** Jede Einheit 3 × 10 Minuten —
(1) Ohr ohne Playback: singen, dann *ohne Herumprobieren* spielen, Fehler im
nächsten Durchgang korrigieren; (2) Stück: Blues in B/F, Blue Bossa, Autumn
Leaves, Summertime, dazwischen ein Lieblingssong nach Gehör (z. B. Ashe
„Stop The Wedding!“, City Pop wie „Plastic Love“) — echte Songs mit Moises
(Stimmen stumm, langsamer, Tonart); (3) Impro über Backing-Track (iReal Pro
oder YouTube) mit 3, dann 5 Tönen, Frage–Antwort. Ziel nach etwa drei
Monaten: bei der Beginner-Session einen Blues und einen Standard mitspielen,
einen Chorus improvisieren. „Heute“ (I-09) übernimmt davon seit 2026-11-19
nur den Rahmen — 3 × 10 Minuten, 4 Einheiten pro Woche —; welche Blöcke es
sind, bestimmen die Skills, die Marlon als „Lerne ich“ markiert. Die drei
Felder oben sind eine Empfehlung, was man markiert, keine festen Fächer.

**Abgrenzung:** Stimmen trennen, Songs transkribieren und Begleitspuren als
Dateien bleiben bei fertigen Werkzeugen (Moises, iReal Pro) — passt zu G-06
und G-08. In die App kommt, was mit vorhandenem Code im Browser geht:
Vorspielen (G-04), Tonerkennung (Stimmgerät, G-03/G-05).

**KI-Modell? Nein — bewusst.** Für eine einstimmige Klarinette reicht die
vorhandene Tonerkennung (Autokorrelation wie im Stimmgerät, Segmentierung
aus `notation.ts`). Das Experiment in G-08 hat gezeigt: pYIN-artiges Rechnen
schlägt Basic Pitch bei einer Stimme, und es läuft offline auf dem iPhone,
ohne 10–80 MB Modell. Falls die Erkennung im hohen Register (Clarion,
Altissimo) oder leise schwächelt, ist der nächste Schritt ein kleines
Tonhöhenmodell im Browser (CREPE tiny oder SPICE, ONNX/TF.js, ~2–5 MB) als
zweite Meinung — erst messen, dann bauen.

### I-01 · Ohr-Trainer: hören, nachspielen, Rückmeldung — erste Fassung 2026-11-16

Frage–Antwort wie in der Session: Die App zählt einen Takt ein, spielt eine
kurze Phrase (Klavierklang, `klavier.ts`), **zählt noch einen Takt ein**
(2026-11-16: direkt anschließen war zu knapp — man hört, sortiert kurz, und
lag dann immer daneben), dann spielt man sie nach — der Klick läuft weiter, das Mikrofon hört zu (`mikrofonspur.ts`, dieselbe Uhr).
Danach: jede Zielnote richtig / falsch / fehlt, im Takt oder nicht, Quote und
ein Hinweis (Anfang, Richtung, Abstände, Anhalten). Die Noten sind erst nach
dem Versuch zu sehen — es ist Gehörbildung, kein Vom-Blatt-Spielen.

- **Stufen** (Fachlogik `src/domain/gehoer.ts`, getestet): drei Töne in
  Schritten → fünf Töne → Dur-Tonleiter mit Sprüngen bis zur Quinte →
  Dreiklänge und Oktave → Achtel-Rhythmus → chromatische Durchgänge. Jede
  Phrase beginnt und endet auf Grundton, Terz oder Quinte (klingt fertig),
  ohne Tonwiederholungen (die verschluckt die Erkennung), im bequemen
  Klarinetten-Umfang (notiert E3–A5).
- **Grundton** wählbar (notiert, Stimmung aus dem Stimmgerät) oder **wechselt
  jede Runde** — Transponieren nach Gehör.
- **Bewertung:** Ausrichtung Ziel ↔ gespielt (Editierdistanz), Oktave egal
  (Registerfehler zählen als richtig, werden markiert); im Takt = Einsatz
  höchstens ein Drittel Schlag daneben.
- **Steigerung:** fünf Runden einer Stufe im Schnitt ≥ 80 % → „Nächste Stufe?“;
  drei Runden < 40 % → „Eine Stufe zurück?“. Vorschlag, kein Zwang.
- Einstellungen (`ueben:ohr`: Stufe, Grundton, Tempo, Wechseln) reisen mit
  der Sicherung; der Verlauf (`ueben:ohr-verlauf`, letzte 200 Runden) bleibt
  vorerst auf dem Gerät.
- Einstieg: Zeile „Ohr-Trainer“ auf der Lernen-Seite unter „Üben“
  (seit B-18; vorher in der Bibliothek; seit B-19 ohne Stellen-Mix davor).
- **Geprüft im Browser** (Chrome, künstliches Mikrofon mit einer
  synthetischen Klarinette, 2026-11-16): Einzählen, Vorspiel, Aufnahme,
  Bewertung laufen durch; ein falsch gespielter Ton (Es statt D) wird als
  falsch erkannt, die anderen als richtig und im Takt.
- **Auf dem Gerät prüfen:** iPhone mit Lautsprecher — taucht das
  Klavier-Vorspiel als gespielte Töne auf? Klarinette im Clarion (über B4)
  richtig erkannt? Einsatz-Toleranz zu streng oder zu lasch?

### I-02 · Lernpfad und Übe-Plan

Der Plan oben als Ansicht: Phasen (Ohr → Harmonie → Repertoire → Jam), je
Woche die Übungen der drei Blöcke, Abhaken je Einheit, Zähler „diese Woche
2 von 4“. Ohr-Block startet I-01 auf passender Stufe. Daten lokal.

### I-03 · Song-Liste „kann ich mitspielen“

Je Song: Titel, Interpret, Tonart klingend und notiert (Rechnung aus der
Stimmung), Stand (Melodie / Begleitung / Impro), Link (Moises, Streaming),
Notiz. Getrennt von den Noten-Stücken oder als Metadaten (F-01)? Vor dem Bau
entscheiden.

### I-04 · Akkordblatt mit erzeugter Begleitung

Akkorde je Takt eingeben (oder Standard-Formen: Blues, 2-5-1, Blue Bossa),
die App spielt Bass, Akkorde und Klick aus Web Audio — wie iReal Pro, nur
minimal. Darüber: welche Töne passen (Akkordtöne, Leiter). **Berührt das
Leitbild** („keine Audio-Begleitspuren“): erzeugt wird nichts als Datei, es
ist Vorspielen wie G-04 — Marlon entscheidet vor dem Bau.

### I-05 · Impro-Feedback

Über I-04 improvisieren, aufnehmen, transkribieren (G-03); jede Note
eingefärbt: Akkordton, Leiterton, Spannung. Dazu Kennzahlen, die beim
Improvisieren helfen: Pausen-Anteil, Tonumfang, wiederkehrende Motive.

### I-06 · Mitspielen nach Gehör mit eigenen Songs

Einen Song-Ausschnitt (eigene Audio-Datei, z. B. aus Moises ohne Gesang)
loopen, langsamer stellen, darüber spielen; die App hört mit und zeigt die
gespielten Töne als Noten (G-03) — als Gedächtnisstütze, nicht als Vorlage.
Dateien nur abspielen, nicht bearbeiten (Leitbild).

### I-07 · Skill-Kartei: was ich kann, was ich lernen will — Bau 2026-11-16

Wunsch Marlon (2026-11-16): eine geführte Übe-Erfahrung mit Gesamtsicht.
Simply Piano führt gut, zeigt aber nicht, welche Skills man in Summe kann,
wohin man sich entwickeln kann und was man lange nicht geübt hat. Gewünscht:
eine große Kartei aller Musik-Skills (Intervalle, Dur/Moll, Septakkorde,
komplexere Akkorde, Modi …), Skills selbst markieren (lernen will ich / kann
ich / gerade nicht), eine Favoritenliste für die Zukunft, und sichtbar, was
schon geschafft ist.

Vorbilder (Recherche 2026-11-16): Complete Ear Trainer (Kapitel, erst
beherrschen, dann weiter — aber wer hängt, bleibt hängen), Duolingo
(Stärke je Skill, verblasst nach Übungsabstand), Khan Academy (feste
Stufen, Kurs-Fortschritt = Anteil Skills ab „sicher“). Gelernt: Tonerkennung
kann sich verhören — **nichts blockiert**, die eigene Markierung gilt immer.

**Zwei Ebenen je Skill**
1. **Markierung** (von Marlon gesetzt): `offen` (Standard) · `will` (☆, die
   Favoritenliste) · `lerne` (gerade dran) · `kann` (selbst eingeschätzt) ·
   `pause` (gerade nicht). Ein Tipp auf den Chip öffnet die Auswahl.
2. **Gemessene Stufe 0–4** aus Übungen in der App: 0 neu · 1 kennengelernt ·
   2 vertraut · 3 sicher · 4 gemeistert. Eine Runde mit Quote q zählt;
   Aufstieg: Durchschnitt der letzten 5 Runden ≥ 0,6 → mind. 1, ≥ 0,75 → 2,
   ≥ 0,85 → 3, ≥ 0,9 über 10 Runden an ≥ 3 verschiedenen Tagen → 4.
   Gespeichert werden je Skill nur Zusammenfassungen (letzte 10 Quoten mit
   Tag, zuletzt geübt, **höchste Stufe je erreicht**), nicht jede Runde.
3. **Verblassen**: Die aktuelle Stufe sinkt ohne Übung — Halbwertszeit wächst
   mit der Stufe (Stufe 1: 4 Tage, 2: 10, 3: 21, 4: 45). Angezeigt wird die
   *wirksame* Stufe (gemessene Stufe, abgerundet nach Verblassen) und
   **zusätzlich die höchste je erreichte Stufe**, sobald sie darüber liegt
   (z. B. zwei volle Punkte, ein hohler Punkt = „war schon 3“), dazu
   „zuletzt vor 23 Tagen“. Eine gute Runde bringt die Stufe schneller
   zurück als beim ersten Mal (Wiederauffrischen: ab 3 guten Runden).
   Skills ohne Übung in der App (nur Markierung) verblassen nicht.

**Kartei (Katalog, fest im Code, erweiterbar)** — Bereiche und Skills, je
Skill: id, Name, ein Satz „was ist das“, ein Satz „warum fürs freie
Spielen“, Voraussetzungen (ids), Übung in der App (falls es eine gibt),
sonst Hinweis „extern üben“ (iReal Pro, Moises) mit „Heute geübt“-Knopf.
- **Gehör:** Melodie nachspielen (Ohr-Trainer-Stufen 1–6 als eigene Skills:
  drei Töne … chromatisch), Intervalle (klein/groß, Sekunde bis Oktave;
  aufwärts, abwärts, zusammen), Dur und Moll hören, vermindert und
  übermäßig, Septakkorde (maj7, 7, m7, m7♭5, dim7), Optionstöne (9/11/13),
  Akkordfolgen (I–IV–V, ii–V–I, Blues-Schema), Grundton eines Songs finden.
- **Harmonie:** Stufen und Funktionen, ii–V–I in allen Tonarten (notiert für
  B-Klarinette), Akkordaufbau (Dreiklang → Septakkord → Optionen), Dur-
  Tonleitern und Vorzeichen, Pentatonik (Dur/Moll), Blues-Tonleiter, Modi
  der ii–V–I (Ionisch, Dorisch, Mixolydisch), weitere Modi (Lydisch,
  Phrygisch, Äolisch, Lokrisch — optional), Leadsheet lesen.
- **Klarinette:** Dur-Tonleitern in 12 Tonarten, Dreiklang-Arpeggien,
  Septakkord-Arpeggien, Guide Tones (3 und 7 durch die ii–V–I), Swing-
  Achtel und Artikulation, sauberes Clarion/Altissimo, Doppelzunge,
  Triolenzunge (baut auf der Doppelzunge auf; Wunsch Marlon 2026-11-16).
- **Improvisation:** Frage–Antwort, mit 3 Tönen improvisieren, Motiv
  entwickeln, Akkordtöne auf Zählzeiten, chromatische Annäherung,
  Umspielung (Enclosure), Blues-Phrasen, Licks lernen und transponieren,
  Pausen und Phrasierung, Solo heraushören (Transkribieren).
- **Mitspielen & Begleiten:** Song nach Gehör mitspielen, Tonart eines
  Songs finden, Haltetöne als Begleitung, Gegenstimme und Fills.
- **Repertoire:** Blues in B, Blue Bossa, Autumn Leaves, Summertime, eigener
  Lieblingssong (z. B. Ashe „Stop The Wedding!“).

**Übersicht (Blatt von der Lernen-Seite, Zeile „Skills“ unter „Mein Stand“ — seit B-18)**
- Kopf: „9 von 48 sicher“ (wirksame Stufe ≥ 3 oder Markierung `kann`), je
  Bereich ein Balken.
- Filter-Chips: Alle · ☆ Will ich · Lerne ich · Kann ich · Verblasst ·
  Gerade nicht.
- Liste je Bereich: Name, Punkte 0–4 (wirksam voll, höchste je hohl),
  Uhr-Symbol bei verblasst, Markierungs-Chip. Tipp auf die Zeile: Detail
  mit Erklärung, Voraussetzungen, Verlauf (letzte Quoten), „Üben“-Knopf.
- Bedienregel: Auswahl und Detail legen sich als Blatt/Popover über die
  Liste, nichts verschiebt sich.

**Speicher:** `ueben:skills` (Markierungen + Zusammenfassungen je Skill)
ist persönlich und reist mit der Sicherung (`einstellungen.ts`). Prüfung
beim Lesen, unbekannte Skill-ids bleiben erhalten (künftige Kartei).

**Umgesetzt 2026-11-16** (Regeln `src/domain/skills.ts`, Katalog
`src/domain/skillkatalog.ts` mit 47 Skills, seit 2026-11-16 abends 49 mit
Doppel- und Triolenzunge, Ansicht `Skills.tsx`). Festgelegt
beim Bau: Stufe 1 schon ab einer Runde (≥ 0,6), Stufe 2 und 3 brauchen 5
Runden. Verblassen = je abgelaufene Halbwertszeit der gemessenen Stufe eine
Stufe weniger (Stufe 3 → nach 21 Tagen 2, nach 42 Tagen 1). Nach dem
Verblassen zählen nur die neuen Runden; bis drei beisammen sind, bleibt die
verblasste Stufe stehen, mit drei guten Runden ist die alte Stufe zurück.
„Kann ich“-Filter = sicher (markiert oder gemessen). „Heute geübt“ setzt nur
„zuletzt“, misst nichts. Die Ohr-Trainer-Stufen melden jede Runde an ihren
Skill; „Üben“ öffnet den Ohr-Trainer auf dieser Stufe.

### I-08 · Hör-Übungen per Antippen — Bau 2026-11-16

Die App spielt, man tippt die Antwort (kein Mikrofon nötig): **Intervalle**
(Auswahl je Stufe: erst Prime/Quinte/Oktave, dann Terzen, dann alle;
aufwärts, abwärts, zusammen), **Dreiklänge** (Dur/Moll, dann +vermindert/
übermäßig), **Septakkorde** (maj7/7/m7, dann +m7♭5/dim7). Runde = 10
Fragen, sofortige Rückmeldung (richtig / was es war), Nochmal anhören,
Vergleich „so klingt deine Antwort“. Ergebnis einer Runde (Quote) geht an
den passenden Skill (I-07). Klang aus `klavier.ts` (Akkorde: Töne
gleichzeitig, Tonhöhe klingend wie im Stimmgerät gewählt). Fachlogik
(Fragen erzeugen mit Startwert, Antwortoptionen je Stufe, Bewertung) rein
und getestet in `src/domain/`.

**Umgesetzt 2026-11-16:** `src/domain/hoerquiz.ts` (Stufen: Intervalle 3,
Dreiklänge 2, Septakkorde 2; Richtung bei Intervallen), Blatt
`HoerUebung.tsx`. Start aus der Skill-Kartei („Üben“), aus „Heute“ und seit
B-18 direkt über die Zeile „Hör-Übungen“ auf der Lernen-Seite, jede
Runde zählt auf den Skill (Dreiklänge → „Dur und Moll hören“). Nach dem
Antworten spielt ein Tipp auf jede Antwort deren Klang (Vergleich). Letzte
Stufe je Übung in `ueben:hoerquiz` (reist mit der Sicherung).

### I-09 · „Heute“: geführte Einheit — Bau 2026-11-16, Umbau 2026-11-19, zu prüfen

**Wunsch Marlon (2026-11-19):** „Ich dachte, in ‚Heute‘ stecken irgendwie
alle Skills, die ich mir als ‚Ich lerne‘ markiert habe. … Dann gerne ändern
zu Übungen von Skills, die ich dafür markiert hab.“ Bis dahin hatte „Heute“
drei feste Fächer — Ohr (nur Skills mit App-Übung), Stück/Mitspielen, Impro
—; ein „Lerne ich“ aus Klarinette, Technik oder Theorie kam nie vor.

**Regel (seit 2026-11-19):**
- **Rahmen** nach der Leitlinie (I): bis zu drei Blöcke à 10 Minuten,
  Wochenziel 4 Einheiten. Eine Einheit = ein Tag, an dem alle Blöcke
  erledigt sind; Woche ab Montag.
- **Blöcke aus „Lerne ich“**, aus allen Bereichen, keine festen Fächer.
  Zuerst, was am längsten nicht geübt wurde (bei Gleichstand die
  Reihenfolge der Kartei). Bei mehr als drei rotiert es so über die Tage:
  Was geübt ist, rückt nach hinten.
- **Weniger als drei „Lerne ich“ (Entscheidung beim Bau):** bis drei
  auffüllen, erst mit ☆ „Will ich“ (am längsten nicht geübt zuerst), dann
  mit Verblasstem (am stärksten zuerst, auch „Kann ich“); der Block heißt
  dann „Aufgefüllt · ☆ Will ich“ bzw. „Aufgefüllt · verblasst“ (grau statt
  messingfarben). Reicht auch das nicht, gibt es weniger Blöcke („Heute ·
  10 Min.“ bzw. „20 Min.“) und darunter einen Satz mit „Skills ›“. Warum so:
  Die Leitlinie rechnet in Einheiten von 30 Minuten; ☆ ist Marlons eigene
  Liste fürs Nächste, Verblasstes braucht Auffrischen (Prinzip der Kartei)
  — beides hat er selbst gewählt oder schon geübt, Unberührtes wird nie
  untergeschoben. Nie in „Heute“: „Gerade nicht“; ohne „Lerne ich“ oder ☆
  nur, was verblasst ist.
- **Nichts als „Lerne ich“ markiert:** keine Blöcke, nur der Satz
  „Markiere in der Skill-Kartei, was du gerade lernst …“ mit „Skills ›“
  (öffnet die Kartei darüber). Nichts Ausgegrautes.
- **Erledigt** ist ein Block, sobald sein Skill heute geübt wurde — gleich
  wo: eine Runde in Ohr-Trainer oder Hör-Übung, „Geübt“ in den Etüden,
  Einschätzen eines Licks, „Heute gespielt“ in der Jam-Karte, „Heute geübt“
  in Griffweisen oder Kartei, ein Metronom mit Swing-Achteln, „Erledigt“ im
  Block. Erledigtes bleibt stehen, auch wenn sich die Markierung danach
  ändert.
- **Nichts verschiebt sich:** Der Plan des Tages wird festgehalten, sobald
  er gezeigt wird; Üben (auch anderswo) ändert ihn nicht. Er ändert sich
  nur, wenn ein Block nicht mehr passt (Markierung geändert → Ersatz an
  derselben Stelle), wenn ein neues „Lerne ich“ eine offene Auffüllung
  verdrängt (an ihrer Stelle) — oder durch „Anderer Vorschlag“. Jeder Block
  hat eine feste Höhe (Name eine Zeile, Aufgabe drei; auf dem iPad zwei und
  fünf, der volle Text steht im Detail).
- **„Anderer Vorschlag“** (↻ oben rechts im Block) tauscht nur diesen Block
  gegen den nächsten „Lerne ich“, der in keinem Block steht und heute noch
  nicht geübt ist — reihum, nach dem letzten wieder der erste.
  Auffüllungen tauschen untereinander. Stehen alle „Lerne ich“ schon da,
  gibt es nichts zu tauschen: ↻ ist unsichtbar, sein Platz bleibt.

**Übungen von Skills:** Jeder Block nennt, warum er da ist („Lerne ich ·
Klarinette“), den Skill und eine **Aufgabe** für 10 Minuten — neu im
Katalog für alle 49 Skills (`aufgabe`, höchstens 150 Zeichen, Tonhöhen
notiert für B-Klarinette, z. B. „Blues in B♭ liegt für dich in C“). Darunter,
womit:
- **App-Übung** (Ohr-Trainer-Stufen, Hör-Übungen): „▶ Ohr-Trainer“ bzw.
  „▶ Hör-Übung“ wie bisher; erledigt nach einer Runde.
- **Werkzeug**, voreingestellt (`werkzeug` im Katalog):

  | Werkzeug | Skills | geöffnet mit | meldet selbst |
  |---|---|---|---|
  | Etüden (I-14) | Dur-Tonleitern in 12 Tonarten · Dur-Tonleitern und Vorzeichen · Dreiklang- · Septakkord-Arpeggien · Guide Tones · Umspielung | Muster Tonleiter · Tonleiter · Dur-Dreiklang · maj7 · Guide Tones · Umspielung | „Geübt“ (nicht für Vorzeichen) |
  | Licks (I-16) | Licks lernen und transponieren · Blues-Phrasen | Liste · „Blues-Wendung abwärts“ | Einschätzen |
  | Jam-Karte (I-19) | Blues in B · Blue Bossa · Autumn Leaves · Summertime · Akkordtöne auf Zählzeiten | dem Stück · Blues in B♭ (einfach) | „Heute gespielt“ (nicht für Akkordtöne) |
  | Spickzettel (I-11) | Akkordaufbau · Optionstöne · Modi der ii–V–I | C7 · C9 · Dm7 (notiert) | — |
  | Drone (I-18) | Mit 3 Tönen improvisieren · Frage und Antwort · Weitere Modi | Grundton C (notiert) | — |
  | Griffweisen (I-13) | Sauberes Clarion und Altissimo | H (erster Clarion-Ton) | „Heute geübt“ |
  | Transponieren (I-12) | Tonart eines Songs finden | — | — |
  | Metronom (I-17) | Swing-Achtel und Artikulation · Doppelzunge · Triolenzunge | volles Metronom über Lernen | Swing: sobald Swing-Achtel klingen |

  Ohne Selbstmeldung bleibt „Erledigt“ im Block. Je eine Vorbelegung als
  Prop: `muster` (Etüden), `lick` (Licks), `stueck` (Jam-Karte); Spickzettel,
  Drone und Griffweisen hatten sie schon. Das Metronom gehört der Zentrale:
  Der Block schickt `ueben:metronom-zeigen`, die Zentrale blendet das Widget
  ein und öffnet „alles“. Bewusst **nicht** voreingestellt: Swing
  einzuschalten änderte die gespeicherte Metronom-Einstellung auch für die
  Noten (Nebenwirkung, Bedienregel).
- **Sonst** (extern: iReal Pro, Moises, eigene Noten): die Aufgabe und
  „Erledigt“.
- Das **Detail** eines Skills (in Kartei und „Heute“) zeigt die Aufgabe
  („So übst du · 10 Min.“) und denselben Knopf. Üben und Werkzeug schließen
  erst das Detail — auf dem iPad läge die Übung nach der Stapelordnung
  (Seite z 46, Blatt z 80) sonst *unter* dem Detail-Blatt.
- **Fachlich nachgeschlagen** (auch im Kopf von `skillkatalog.ts`):
  Swing-Artikulation (Off-Beat anstoßen, in die Zählzeit binden) —
  jazzadvice.com, „The Beginner's Guide to Jazz Articulation“; über den Bruch
  (A–H binden, rechte Hand liegen lassen) — DANSR, „Mind the Gap: Crossing
  the Clarinet Break Demystified“ und „Right Hand Down (or not) on
  Clarinet“; Doppelzunge (erst ohne Mundstück sprechen, mit Metronom langsam
  steigern) — Robert Spring, „Multiple Articulation for Clarinet“
  (bandworld.org); Guide Tones (Septime fällt zur Terz) —
  learnjazzstandards.com; chromatische Annäherung und Umspielung (Ziel auf
  der Zählzeit) — fundamental-changes.com, „Chromatic Approach Notes“,
  jazz-guitar-licks.com, „Target Tones and Enclosures“; Stufen und Modi —
  Mark Levine, „The Jazz Theory Book“.

**Tagesstand `ueben:heute` (Gerät, reist nicht mit):** jetzt `{ tag, plan,
einheiten }`, `plan` = Skill-ids der Blöcke. Ein Stand der alten Form
(`wechsel`, `erledigt` je ohr/stueck/impro) vom selben Tag: Das dort
Erledigte wird zu den ersten Blöcken (Reihenfolge ohr, stueck, impro) und
gilt als erledigt — die alte Fassung hatte beim Erledigen „heute geübt“
eingetragen —, der Rest kommt nach der neuen Regel dazu; die
Vorschlags-Wechsel entfallen. Stimmt das nicht (Skill heute nicht geübt),
wird der Block an derselben Stelle ersetzt. Alter Stand von gestern oder
kaputte Werte: sauber neu. Die Einheiten bleiben immer. Gespeichert wird
danach nur noch die neue Form. Kein Eingriff in IndexedDB oder Sicherung.

**Umgesetzt 2026-11-19:** Regeln `heuteArt`, `heuteKandidaten`,
`heuteVorschlag`, `heuteFestschreiben`, `andererVorschlag`, `heuteLesen`
in `src/domain/skills.ts` (zuerst als Test, `tests/skills.test.ts`, samt
altem Tagesstand); `aufgabe`/`werkzeug` in `src/domain/skillkatalog.ts`
(getestet: jede Verknüpfung zeigt auf ein Muster, einen Lick, ein Stück,
einen lesbaren Akkord, einen greifbaren Ton); Ansicht `HeuteAbschnitt` in
`Skills.tsx`. **Geprüft im Browser** (Chromium, iPhone 390 × 844 und iPad
820 × 1180): 0 markiert → nur der Satz, „Skills ›“ öffnet die Kartei; 1 →
ein Block, „10 Min.“; 1 + ☆ → „Aufgefüllt · ☆ Will ich“, „20 Min.“; 3
(Klarinette, Technik, Harmonie) → genau diese, kein ↻; 5 → drei Blöcke, ↻
dreimal: nur dieser Block wechselt, alle Blöcke und die Überschrift „Üben“
bleiben auf dem Pixel, nach dem dritten wieder der erste. „▶ Etüden“ öffnet
mit Muster Tonleiter, „Geübt“ → Block ✓; „Erledigt“ verschiebt nichts;
„▶ Hör-Übung“ (Intervalle), „▶ Metronom“ (volles Metronom über Lernen),
„▶ Jam-Karte“ (Blues in B♭); alter Tagesstand übernommen und in neuer Form
gespeichert; nichts läuft über.

**Auf dem Gerät prüfen:**
- iPhone und iPad: in der Kartei nacheinander 0, 1, 3 und 5 Skills aus
  verschiedenen Bereichen als „Lerne ich“ markieren — stimmen Blöcke,
  Minuten und „Aufgefüllt“? Bei 0: nur der Satz, „Skills ›“ öffnet die
  Kartei.
- ↻ bei fünf „Lerne ich“: nur dieser Block wechselt, nichts darunter rückt;
  nach dem Durchlauf wieder der erste. Auf dem iPhone ↻ gut zu treffen?
- Jeden Knopf einmal: Etüden (richtiges Muster), Licks (Blues-Wendung),
  Jam-Karte (das Stück), Spickzettel (Akkord notiert), Drone (C),
  Griffweisen (H), Transponieren, Metronom (Widget und „alles“ über Lernen;
  Swing-Achtel an und starten → Block ✓). Fertig/Schließen führt zurück zu
  „Heute“.
- Ohr-Trainer und Hör-Übung aus dem Block: nach einer Runde ✓; Mikrofon und
  Klang wie vorher.
- Blöcke über den Tag verteilt erledigen, App dazwischen schließen: Der Plan
  bleibt derselbe; alle erledigt → „✓ geschafft“, Wochenzähler +1.
- Am nächsten Tag (mehr als drei „Lerne ich“): die gestern geübten stehen
  hinten, andere vorn.
- Gleich nach dem Update, wenn die alte Einheit von heute halb erledigt
  war: das Erledigte steht als ✓ vorn, nichts ist kaputt.

**Offene Fragen an Marlon:**
- Ein Block gilt als erledigt, sobald der Skill heute irgendwo geübt wurde
  (auch über die Ohr-Trainer-Zeile oder ein Werkzeug ohne „Heute“). Passt
  das, oder soll nur zählen, was aus „Heute“ gestartet wurde?
- Zählt eine kürzere Einheit (ein oder zwei Blöcke, weil nichts zum
  Auffüllen da ist) für das Wochenziel? Derzeit ja.
- Soll der Swing-Block das Metronom gleich auf Swing stellen? Das änderte
  die gespeicherte Einstellung auch für die Noten — derzeit nein, er öffnet
  nur das Metronom.
- Passen die Aufgaben-Texte (Tempo-Angaben, „Blues in B♭ = C notiert“) zu
  deinem Stand, und fehlt eine Verknüpfung, die du erwartest (z. B.
  Pentatonik → Licks, Akkordfolgen → Jam-Karte)?

### I-10 · Später: Klarinetten-Checks, Akkordfolgen, Modi-Klang

Tonleitern und Arpeggien per Mikrofon prüfen (Stimmgerät-Erkennung),
Akkordfolgen hören (ii–V–I erkennen), Modi als Vamp hören und darüber
spielen (braucht I-04).

### I-11…I-20 · Werkzeuge fürs freie Spielen — Bau ab 2026-11-16

Marlon 2026-11-16: „Bau alles“ — zehn Ideen aus der Recherche. Alle
Werkzeuge erreicht man auf der Seite **Lernen** (B-18) im Abschnitt **Werkzeuge**
(Kacheln, je ein Blatt; die Kachel „Aufnahme-Tagebuch“ führt seit 2026-11-19
in die Bibliothek, I-20). Tonhöhen immer **notiert für die gewählte Stimmung**
(Stimmgerät), daneben klingend, wo es hilft.

- **I-11 · Akkord-Spickzettel.** Akkordsymbol eingeben oder antippen (C,
  Cm, C7, Cmaj7, Cm7, Cm7♭5, Cdim7, C6, Cm6, C9, C7♭9, C7♯11, Csus4, C+,
  Slash-Akkorde C/E). Anzeige: Akkordtöne mit Funktion (1–3–5–7, Optionen),
  Guide Tones (3 und 7), passende Tonleiter(n) mit kurzem Satz warum (Dur →
  Ionisch/Lydisch, m7 → Dorisch, 7 → Mixolydisch, m7♭5 → Lokrisch, dim7 →
  Ganzton-Halbton, alteriert → alteriert), als Notenzeile (abcjs) und zum
  Anhören (Akkord, dann Leiter). Eingabe wahlweise **klingend** („Gitarrist
  sagt E7“) oder **notiert**. Fachlogik `src/domain/akkorde.ts`.
- **I-12 · Transponier-Helfer.** Tonart klingend → notiert (und zurück) mit
  Vorzeichen, Akkordfolge einfügen („E A B7 E“) → für dich notiert, bequemste
  enharmonische Schreibweise. Hinweis bei unbequemen Tonarten.
- **I-13 · Griffweisen.** Grifftabelle der B-Klarinette (Böhm), notiert E3
  bis C7: Standardgriff plus gängige Alternativen, Triller-Griffe für
  häufige Fälle, Altissimo; Zeichnung als SVG. Ton wählbar per Tippen auf
  eine kleine Klaviatur/Notenzeile oder per Mikrofon (Stimmgerät-Erkennung
  zeigt den Griff zum gespielten Ton). Im Ohr-Trainer-Ergebnis: Tipp auf
  eine Note zeigt den Griff. Daten sorgfältig gegen verlässliche Quellen
  (z. B. The Woodwind Fingering Guide) geprüft; Quelle im Code nennen.
  **Rückmeldung 2026-11-17:** Auf der Klaviatur allein ist nicht zu
  erkennen, welcher Ton gemeint ist — der gewählte Ton steht jetzt auch im
  **Notenbild** (Violinschlüssel, ganze Note, Hilfslinien), geschrieben wie
  der Name daneben (Cis, Es, Fis, As, B, H; `tonAbc`/`griffNotenbild` in
  `src/domain/griffe.ts`, getestet E3…C7). Feste Box, damit beim Wechsel
  nichts springt; auf dem iPad als Seite größer.
- **I-14 · Generierte Etüden.** Muster durch alle 12 Tonarten (Quintenzirkel
  oder chromatisch): Dur-Tonleiter, Dreiklang- und Septakkord-Arpeggien,
  Guide-Tone-Linien durch ii–V–I, 1-2-3-5-Muster, Umspielungen. Notenzeile
  (abcjs), Tempo, Vorspielen mit Klick, Umfang auf den Klarinetten-Umfang
  geklemmt (Oktavlage je Tonart wählen). Zählt auf die Klarinetten-Skills.
  **Rückmeldung 2026-11-17:** (1) Vorzeichen **vorne hinter dem Schlüssel**
  („A-Dur hat 3 Kreuze“ auf einen Blick) — die Vorzeichen vor den Noten
  bleiben zusätzlich stehen (beim ersten Mal im Takt); ein Stammton, den die
  Tonart verändert, bekommt ein Auflösungszeichen (F-Dur: H als `=B`). Jede
  Tonart ist ein eigenes Notenbild: In *einem* Notenbild setzte abcjs beim
  Tonartwechsel Vorschau-Vorzeichen ans Zeilenende und Auflösungszeichen an
  den Zeilenanfang (ausprobiert, zu unruhig). Takt 4/4 nur beim ersten.
  (2) Über jeder Tonart die **klingende** nach der Stimmung aus dem
  Stimmgerät: „E-Dur · klingt D-Dur“ (B), „E-Dur · klingt G-Dur“ (Es); bei C
  nichts. Regeln in `abschnitteAbc` (`src/domain/etueden.ts`, getestet);
  Licks ohne Tonart bleiben ein Notenbild in C wie bisher.
- **I-15 · Spielhilfe in deinen Noten.** Zu einer Stelle Akkordsymbole je
  Takt eintragen (klingend oder notiert). In der Stelle: Akkord des
  aktuellen Takts groß, Akkordtöne, Guide Tones; Drone (I-18) auf dem
  Grundton zum Loopen. **Keine Begleitspur** (Leitbild) — I-04 bleibt offen.
  Speicherung als zusätzliches Feld an der Stelle (reist ohnehin mit).
  **Umgesetzt 2026-11-16:** Feld `akkorde` an der Stelle (`src/domain/spielhilfe.ts`),
  eingetragen im Stellen-Blatt („Akkorde (Spielhilfe)“, Blatt darüber), im
  Stellen-Modus ein Streifen über der Stellen-Leiste (liegt über den Noten):
  Akkord notiert groß, klingend daneben, Töne mit Guide Tones, ‹ › Akkord für
  Akkord rundherum (welcher Takt gerade klingt, weiß die App nicht), Drone
  passend zur Akkordart, Tipp öffnet den Spickzettel; „–“ verkleinert.
- **I-16 · Lick-Sammlung.** Licks notieren (Tasten-Eingabe oder per
  Einspielen G-05), in 12 Tonarten anzeigen und vorspielen, Wiederholen nach
  dem Prinzip der Skill-Kartei (verblassen, „heute fällig“). Start-Licks
  mitgeliefert (eigene Formulierungen, keine Transkriptionen geschützter
  Soli).
- **I-17 · Swing-Metronom.** Im Metronom: Klick nur auf 2 und 4, Swing-Anteil
  (gerade … triolisch) für hörbare Achtel, Akzent-Optionen.
- **I-18 · Drone.** Liegeton oder Akkord (Grundton, Quinte, Dur/Moll/Modus-
  Farbe) als ruhiger Klangteppich, Tonart wählbar (notiert), Lautstärke;
  zum Improvisieren und Intonieren. Wie Klick und Klavier: erzeugt, keine
  Datei.
- **I-19 · Jam-Karte.** Die typischen Session-Stücke (Blues in B und F,
  Blue Bossa, Autumn Leaves, Summertime, Fly Me to the Moon, All the Things
  You Are, Take the A Train, So What, Cantaloupe Island, Watermelon Man …)
  mit Form, Tonart und Akkorden je Takt — klingend gespeichert, für dich
  notiert angezeigt; Tipp auf einen Akkord öffnet den Spickzettel. Nur
  Akkordfolgen und Form (keine Melodien, keine Texte). Eigene Stücke
  hinzufügbar. Zählt auf die Repertoire-Skills.
- **I-20 · Aufnahme-Tagebuch.** Eine Übung oder ein Stück aufnehmen, mit
  Datum und Skill/Stück verknüpft, später alt gegen neu anhören. Nur
  aufnehmen und abspielen (keine Bearbeitung). Speicher ohne Blob in
  IndexedDB (Regel aus `CLAUDE.md`), Schemaänderung nur per Versionssprung
  mit Migrationstest; Aufnahmen reisen nicht mit der Sicherung (zu groß),
  Hinweis darauf in der Oberfläche.
  **Umgesetzt 2026-11-16** auf den Aufnahmen aus G-09 (ohne Schemaänderung,
  `src/domain/aufnahmetagebuch.ts`, Kachel „Aufnahme-Tagebuch“): alle
  Aufnahmen nach Tagen, Filter nach Stück, anhören, umbenennen, löschen;
  Vergleichen zweier Aufnahmen desselben Stücks bzw. derselben Stelle (A,
  dann B, oder A/B umschalten an derselben Stelle). Neue Aufnahme zu einem
  Stück, optional mit Skill (`skillId` an der Aufnahme, zählt als heute
  geübt). Eine Aufnahme **ohne Stück** gibt es nicht: Sie liegt im
  Datensatz eines Stücks, ein verstecktes Übungs-Stück sähe das Datenmodell
  nicht vor (bräuchte eine PDF, erschiene in der Bibliothek) — offen.

  **Rückmeldung Marlon (2026-11-19):** „Die Aufnahmen sollten über die
  Bibliothek abrufbar sein. Also sollte der Button für das Aufnahme-Tagebuch
  zur Bibliothek leiten, oder? Und da dann ein neues Stück aufnehmen,
  basically, oder pro Stück eine Aufnahme oder mehrere.“ Dazu (F-23): „Neue
  Aufnahme“ wählt das offene Stück vor — „ja“.

  **Umsetzung (2026-11-19)** — Aufnahmen über die Bibliothek
  (`AufnahmeTagebuch.tsx`, `Bibliothek.tsx`, `Kontext.tsx`, `NotenPult.tsx`,
  `Aufnahmen.tsx`, `Werkzeuge.tsx`, `UebeZentrale.tsx`; Regeln
  `tagebuchBereich`, `imBereich`, `aufnahmenStand`, `zuletztKurz`,
  `neueAufnahmeVorwahl` in `src/domain/aufnahmetagebuch.ts`, `ortSprung` in
  `src/domain/leiste.ts`, zuerst als Test):
  - **Zeile „Aufnahmen“** in der Bibliothek direkt unter dem Stellen-Mix,
    über den Tags: roter Punkt, „Aufnahmen“, rechts „4 · zuletzt heute“,
    „keine in „Orchester A · Wichtig üben““ oder „noch keine“. Sie zählt, was
    die Bibliothek zeigt (Sammlung und Tag). **Bedienregel:** gleich gebaut
    und gleich hoch wie die Mix-Zeile (48 px), immer da, sobald es Stücke
    gibt; beim Wechsel der Sammlung oder des Tags ändert sich nur der Text.
    Sie kommt im selben Lesen wie Sammlungen, Mix und Liste — nichts rückt
    nach.
  - **Tagebuch aus der Bibliothek** (Blatt über der Bibliothek, iPad mittig):
    eingegrenzt auf deren Sammlung und Tag; oben „Märsche 4 | Alle 7“ (nur,
    wenn die Bibliothek eingegrenzt ist — steht beim Öffnen fest, kommt und
    geht nicht). Liegt außerhalb noch etwas, sagt es die Statuszeile:
    „Unter „Alle“ noch 3 Aufnahmen, davon 2 mit Skill.“ — so bleiben
    Aufnahmen zu Skills auffindbar, deren Stück woanders liegt; der Hinweis
    „bleiben auf diesem Gerät“ steht dann am Ende der Liste. Filter je Stück
    (F-23-Auswahl, nur Stücke mit Aufnahmen im Bereich), Vergleichen,
    Abspielen, Name, Löschen wie bisher. Neue Aufnahmen, Umbenennen und
    Löschen zählen gleich in der Zeile mit.
  - **Je Stück eine oder mehrere:** ⋯ (oder Halten) an einem Stück →
    „Aufnahmen …“ („2 · anhören, vergleichen, neu aufnehmen“ bzw. „Noch
    keine — hier aufnehmen“) öffnet das Tagebuch auf dieses Stück gefiltert;
    „Neu“ wählt es vor, auch ohne bisherige Aufnahme. In der Liste der
    Bibliothek steht „2 Aufnahmen“ in der Unterzeile wie „3 Stellen“.
  - **Stück-Blatt (G-09) abgestimmt:** Die Zeilen zeigen dieselben Angaben
    wie das Tagebuch (Stelle oder Seite, Skill, Dauer; dieselben Regeln
    `wo`/`dauerText`), „zusammen“ als eigene Zeile darunter (vorher drückte
    es den Namen auf „Trio s…“). Darunter „Vergleichen und neu aufnehmen im
    Tagebuch ›“ — das Tagebuch auf dieses Stück gefiltert, über dem
    Stück-Blatt; Escape schließt erst das Tagebuch. Ohne Aufnahme: „Im
    Tagebuch aufnehmen ›“.
  - **Kachel in Lernen** „Aufnahme-Tagebuch · In der Bibliothek: alt gegen
    neu ›“ (roter Punkt, Pfeil): ganzer Seitenwechsel in die Bibliothek
    (`ortSprung`: das Ziel öffnet, Lernen weicht samt Unterseite; ein Sprung
    schließt nie), dort liegt gleich das Tagebuch über der Liste. Danach gilt
    die Leiste wie immer: „Lernen“ führt zurück, „Noten“ schließt die
    Bibliothek. Die Aufnahme mit Skill („Neu“ → Skill) bleibt, wie sie war.
  - **Geprüft im Browser** (Chromium mit Fake-Mikrofon, iPhone 390 × 844 und
    iPad 820 × 1180; acht Stücke in Märsche/Orchester A/Jazz/ohne, ein Tag,
    sechs Aufnahmen, zwei mit Skill): Zeile bei Märsche, Jazz, Alle,
    Orchester A und Orchester A + Tag auf demselben Pixel (iPhone y 284,
    48 px hoch); Tagebuch „3 Aufnahmen aus „Märsche““ mit Hinweis auf 3
    weitere, 2 mit Skill; „Alle“ zeigt 6; „Neu“ wählt das offene
    Radetzky-Marsch vor, Aufnahme 2 s mit Fake-Mikrofon gespeichert, Zeile
    zählt danach 4; Kontext → „Aufnahmen …“ an „Take Five“ (ohne Aufnahme)
    → leer, „Neu“ wählt Take Five; Kachel in Lernen → Bibliothek mit
    Tagebuch, „Lernen“ zurück; Stück-Blatt → Tagebuch gefiltert, Escape
    schließt nur das Tagebuch. Keine Fehler in der Konsole.

  **„Ein neues Stück aufnehmen“ — geprüft, nicht gebaut (2026-11-19).**
  Gemeint: etwas aufnehmen, für das es noch keine Noten (keine PDF) gibt, und
  es landet als Stück in der Bibliothek. Ergebnis der Prüfung:
  - *Datenbank:* Ein Datensatz in `stuecke` ohne Eintrag in `dateien` ginge
    ohne Versionssprung — es gibt ihn heute schon als Fehlerfall (Übernahme
    aus `ueben`, PDF verloren). Aber das Datenmodell sagt „Stück = Datensatz
    und **genau eine PDF**“, und daran hängt viel:
  - *Öffnen:* `NotenPult` liest `stueckDatei` → `DateiVerloren` („Die
    PDF-Datei dieses Stücks ist auf dem Gerät nicht mehr lesbar …“), der
    `NotenBetrachter` braucht ein geladenes PDF. Es bräuchte eine eigene
    Ansicht ohne Noten. Ebenso Sonderwege für das Vorschaubild im
    Kontext-Blatt, „Eigene Stücke daraus“, die Quelle virtueller Stücke und
    die Doppelten-Erkennung beim Ordner-Import (Größe der PDF).
  - *Sicherung (`sicherung.ts`, `lesbar.ts`):* `sicherungErstellen` prüft
    jede PDF (`nurLesbare`); so ein Stück fiele heraus und stünde bei jeder
    Sicherung unter „nicht lesbar“. Mitnehmen lässt es sich in `.uebe` v1
    nicht: Jeder Eintrag unter `noten` bringt genau einen PDF-Teil mit (ein
    leerer Teil wäre im Registerführer ein Stück mit kaputter PDF),
    `virtuelle` verlangt eine `quelle`, und eine weitere Liste im Kopf
    schließt CLAUDE.md aus („Nicht weiter ändern“). Der
    Registerführer-Zuschnitt (`notenId` an Stellen und Anmerkungen) wäre
    nicht das Problem — so ein Stück hätte keine —, sondern der Noten-Eintrag
    selbst. Alte Dateien blieben ladbar, aber „Daten übertragen“ ließe ein
    Stück der Bibliothek weg.
  - *Darum nicht gebaut:* Es ginge nur, wenn die Regel „genau eine PDF“
    fällt und das Stück bewusst nur auf dem Gerät bleibt — eine Entscheidung
    über das Datenmodell, die Marlon treffen soll.

  **Optionen — Entscheidung Marlon offen:**
  - **A · Erzeugte Titelseite als PDF** (wie bei geschriebenen/eingesungenen
    Stücken; die App schreibt PDFs schon selbst, `notenpdf.ts`, Scan F-07).
    „Neu“ im Tagebuch bekommt „Neues Stück …“: Titel, Sammlung (die der
    Bibliothek), dann aufnehmen. Angelegt wird ein gewöhnliches Stück mit
    einer schlichten Seite (Titel, Stimme, „Noten folgen“, leere
    Notenzeilen). *Für:* nichts an Datenbank oder Format; reist mit der
    Sicherung (wenige KB); der Registerführer liest es wie jedes Stück; es
    öffnet in den Noten, roter Knopf, Kontext-Blatt, Sammlungen, Tags wie
    gewohnt; später ersetzt „Datei neu wählen“ die Seite durch die echten
    Noten, die Aufnahmen bleiben. *Gegen:* eine Seite ohne Inhalt in der
    Bibliothek (und nach einer Übertragung im Registerführer); auf dem
    anderen Gerät kommt das Stück ohne seine Aufnahmen an (die reisen nie
    mit). **Empfehlung**, weil alle Verträge bleiben.
  - **B · Stück ohne PDF, nur auf diesem Gerät:** ein Merkmal am Stück (etwa
    `nurAufnahmen`, kein neuer Speicher, keine Version — wie `aufnahmen` in
    G-09), eine eigene Ansicht statt der Noten, die Sicherung lässt es
    bewusst weg (mit eigener Meldung). *Für:* keine Schein-Seite. *Gegen:*
    „genau eine PDF“ fällt (datenmodell.md ändern), jede Stelle, die eine
    PDF erwartet, braucht einen Sonderweg — auch künftige; „Daten
    übertragen“ nimmt ein Stück der Bibliothek nicht mit.
  - **C · Format erweitern** (eigene Liste im Kopf der Sicherung): nach
    CLAUDE.md nur mit neuer Version des `.uebe`-Formats samt Lesen der alten;
    der Registerführer kennt sie nicht. Nicht empfohlen.
  - **D · Ohne neues Stück:** an ein vorhandenes Stück aufnehmen (etwa eines
    „Übungen“). Geht heute; trifft den Wunsch nur halb.

  **Auf dem Gerät prüfen:**
  - iPhone und iPad: „Noten“ → Zeile „Aufnahmen“ unter dem Stellen-Mix.
    Sammlung wechseln (mit und ohne Tags) und einen Tag tippen: nur der Text
    rechts ändert sich, die Zeile springt nicht.
  - Zeile tippen: Tagebuch über der Bibliothek, „Märsche n | Alle m“; die
    Statuszeile nennt, was unter „Alle“ noch liegt (mit Skill); „Alle“
    zeigt es. Fertig → zurück in der Bibliothek, an derselben Stelle.
  - Ein Stück offen, Tagebuch → Neu: das offene Stück ist vorgewählt;
    aufnehmen (Mikrofon-Erlaubnis), beenden → die Aufnahme steht oben, die
    Zeile zählt eine mehr.
  - ⋯ an einem Stück → „Aufnahmen …“: Tagebuch nur mit diesem Stück; ohne
    Aufnahme leer mit Hinweis, „Neu“ wählt das Stück vor.
  - Stück öffnen, Titel tippen → Stück-Blatt → Aufnahmen: Name ganz
    lesbar, „zusammen“ darunter; „… im Tagebuch ›“ → Vergleichen A/B geht.
  - Lernen → Kachel „Aufnahme-Tagebuch“: Bibliothek mit Tagebuch; nach
    „Fertig“ „Lernen“ tippen → Lernen-Übersicht; „Noten“ → Bibliothek zu.
  - Eine Aufnahme mit Skill zu einem Stück außerhalb der gewählten Sammlung:
    über „Alle“ auffindbar.

## Erledigt

*(Abgeschlossene Punkte hierher verschieben, mit Datum und Commit.)*

- **B-17 · Bibliothek öffnet beim offenen Stück** (2026-11-14): Wunsch
  Marlon: Der Knopf „Noten“ öffnete die Bibliothek immer ganz oben — das
  gerade offene Stück war oft nicht zu sehen, das nächste auch nicht.
  Jetzt steht die Liste beim Öffnen so, dass das offene Stück (Messing-
  Strich) im Bild ist **und das nächste darunter**, zum direkten
  Weitertippen. Liegen beide schon im Bild, bleibt die Liste oben stehen
  (Sammlungen, Tags, Mix und Werkzeuge bleiben sichtbar); sonst rückt das
  offene Stück ins obere Drittel, davor eins zur Orientierung, darunter
  die folgenden. Das geschieht einmal beim Öffnen, vor dem ersten Bild —
  kein sichtbares Springen. Sortieren, Filtern und Neuladen danach lassen
  die Liste stehen (Bedienregel). Zeigt der Filter (Sammlung, Tag) das
  offene Stück nicht, bleibt die Liste oben; der Filter wird nicht
  umgestellt. Im Stellen-Mix gilt das Stück der gezeigten Stelle. Regel
  `zumOffenen` in `src/domain/notenpult.ts`, getestet in
  `tests/bibliothek.test.ts`; Verdrahtung in `Bibliothek.tsx`.

- **B-16 · Doppeltipp auf eine Stelle: heran und schreiben** (2026-10-31):
  Wunsch Marlon: Doppeltipp auf eine Stelle soll an sie heranzoomen und
  gleich den Schreibmodus einschalten; noch ein Doppeltipp zurück in den
  Spielmodus (Schreibmodus aus, ganze Seite). Im **Stellen-Modus** meint
  jeder Doppeltipp in die Mitte die gezeigte Stelle; auf der Stelle selbst
  gilt das auch am Rand (dort blättert sonst ein Tipp — daneben weiterhin).
  Beim **Lesen** mit offener Palette treffen Doppeltipps die gestrichelten
  Stellen-Rahmen (B-11); unsichtbare Stellen sind nichts zu treffen, dort
  bleibt es beim Breiten-Zoom (B-15). Der Zoom füllt den Platz mit der
  Stelle samt Rand (Breite oder Höhe, was zuerst anstößt, 8 % Luft, bis
  600 %), ihre Mitte in der Bildschirmmitte. Die Palette öffnet mit dem
  zuletzt gewählten Zeichenwerkzeug (Stift, Marker, Radierer) — Text,
  Stelle, Schere und Stempel nähmen den Finger-Tipp selbst, dann käme man
  nicht mehr heraus. Der zweite Doppeltipp nach einem Doppeltipp-Zoom
  schließt die Palette (Spielmodus); ein von Hand gezoomtes Blatt geht nur
  zurück auf ganz, wie B-15. Mit dem Weiterblättern zur nächsten Stelle
  ist der Zoom vorbei, die Palette bleibt. **Beim Lesen** (Rückmeldung
  Marlon vom iPad, 2026-10-31: „passt einfach an die PDF-Breite an, sollte
  deutlich mehr reinzoomen“) zoomt der Doppeltipp fest auf **300 %**, der
  getippte Punkt in die Bildschirmmitte (`umPunkt`, `DOPPELTIPP_ZOOM`;
  Faktor bestätigt), und schaltet — zweite Rückmeldung — ebenso den
  **Schreibmodus** ein; der Breiten-Zoom `anBreite` aus B-15 ist weg. Grenze: Mit „auch mit dem Finger“ zeichnet der Finger-Doppeltipp,
  ebenso ein Maus-Doppelklick bei offener Palette — heraus dann über den
  Stift-Knopf oder „%“. Regel `aufStelle` in `src/domain/zoom.ts`,
  getestet; Verdrahtung in `NotenBetrachter.tsx` (`stelleUnter`,
  `tippZoom`).

- **G-01/G-05 · Komponieren: Markieren immer da, Aufnahmebereich, Leiste
  und Mehr-Menü schiebbar** (2026-10-28): Rückmeldung Marlon („die Buttons
  sind noch ein bisschen ass“).
  - **Markieren** ist ein eigener Knopf in der Palette (Rahmen-Symbol,
    neben Rückgängig) — ein Tipp, dann Töne auswählen; nicht mehr im
    Mehr-Menü versteckt. Dort bleibt „Alle“.
  - **Aufnahmebereich:** neben dem Zieltakt ein **Endtakt** (offen · nur
    diesen · bis Takt n). Mit Endtakt hält die Aufnahme dort von selbst,
    und nur diese Takte werden ersetzt — wer einen Takt nachbessern will,
    nimmt genau den auf, nichts dahinter wird überschrieben. Vorgabe dann
    „Ersetzen“. Nach Übernehmen steht die Leiste wieder offen auf dem
    Folgetakt. Regeln `bereichSetzen`, `bereichTakte`, `vorgabeArt(…,
    geschlossen)` in `src/domain/taktaufnahme.ts`, getestet.
  - **Aufnahmeleiste überarbeitet:** liegt im Dialog oberhalb des Fußes,
    „Als Stück speichern“ steht nicht mehr halb verdeckt dahinter. Die
    Steuerzeile bricht um statt zu scrollen; Verwerfen/Übernehmen stehen
    in einer eigenen Zeile rechts.
  - **Schiebbar mit Gedächtnis:** Aufnahmeleiste (Griff im Kopf) und das
    Mehr-Menü der Palette (Griffzeile oben) lassen sich überallhin ziehen;
    die Lage wird je Gerät gemerkt (`ueben:lage-aufnahme`,
    `ueben:lage-notensatz-mehr`) und beim nächsten Öffnen wieder
    eingenommen. Ablegen nahe des Dialog-Fußes dockt wieder an.
    `useSchiebbar` kennt dafür die Grenze (`.scan-fuss`) und darf die
    Breite behalten. Im Browser (Tablet- und Telefonbreite, Aufnahme mit
    Endtakt bis „Übernehmen“) durchgespielt, nie auf dem Gerät.

- **Stellen-Modus: auf der Seite bleiben** (2026-10-28): Rückmeldung
  Marlon: Wer auf Seite 4 den Stellen-Schalter umlegt, landete bei der
  ersten Stelle des Stücks auf Seite 1. Jetzt gilt die erste Stelle der
  Seite, auf der man gerade ist; hat die Seite keine, die nächste danach,
  und erst ganz hinten die letzte davor. Regel `stelleZurSeite` in
  `src/domain/stellen.ts`, getestet.

- **F-21 · Sammlungen sortieren und große Ansicht** (2026-10-26): Wunsch
  Marlon: Manche Sammlungen immer vorn auf Abruf, andere hinten; und bei
  vielen Sammlungen eine Ansicht, die alle mit ihren Stücken zeigt.
  - **Reihenfolge:** Im Kontext-Blatt der Sammlung (Chip halten oder zweiter
    Tipp, in der großen Ansicht „⋯“) eine Zeile „Platz 2 von 5“ mit **⇤ ganz
    nach vorn, ← nach vorn, → nach hinten**; das Blatt bleibt offen, die
    Leiste sortiert sich dahinter um. Gemerkt als Namensliste im
    localStorage `ueben:sammlungen-reihenfolge` — persönlich, **reist mit der
    Sicherung** (Einstellung in `src/domain/einstellungen.ts`). Sammlungen,
    die in der Liste fehlen (neu angelegt, aus einem Ordner), kommen
    dahinter A–Z; Umbenennen behält den Platz, Zusammenlegen den Platz des
    Ziels. Regeln `sammlungenOrdnen`, `reihenfolgeVerschieben`,
    `reihenfolgeUmbenennen` in `src/domain/sammlungen.ts`, getestet.
  - **Große Ansicht** (`SammlungenAnsicht.tsx`): rechts an der Leiste ein
    fester Pfeil „›“ (scrollt nicht mit). Vollflächig über der Bibliothek:
    jede Sammlung als Abschnitt in der gemerkten Reihenfolge, darunter ihre
    Stücke A–Z (Stimme, Stellen, „auch in 2 weiteren Sammlungen“); Tipp auf
    den Kopf klappt zu oder auf (je Gerät gemerkt, `ueben:sammlungen-zu`),
    „⋯“ oder Halten öffnet das Kontext-Blatt der Sammlung (umbenennen,
    verschieben, nur diese zeigen, Stücke auswählen, auflösen), Tipp auf
    ein Stück öffnet es, „⋯“ am Stück sein Blatt (dort auch Sammlungen
    ändern). Zuletzt „Ohne Sammlung“; unten „+ Sammlung“ und „Alle Stücke
    zeigen“. Escape schließt erst die Ansicht, dann die Bibliothek.
  - Farbe je Sammlung als F-22 notiert, kein Icon.

- **D-07 · Taktart im Metronom-Widget, schmale Säule aufgeräumt**
  (2026-10-26): Wunsch Marlon. In beiden Widget-Ansichten sind **Taktart
  und Taktpunkte ein Knopf**: Antippen klappt ein kleines **Popover** mit den
  üblichen Taktarten (4/4 · 3/4 · 6/8 · 2/4, die Schnellwahl aus D-05) auf —
  es schwebt unter dem Knopf über dem Widget, nichts rückt (Rückmeldung
  Marlon: die erste Fassung schob die Knopfzeile nach unten). Antippen
  wählt und schließt; **jeder Tipp woanders schließt es sofort**, und der
  Tipp geht durch (kein Fang) — so stehen nie zwei Aufklapper. In der
  schmalen Säule klappt es links daneben auf (2 × 2). Zähler/Nenner frei
  weiter nur in der großen Ansicht („alles“). Die **schmale Säule** hat nur
  noch **+1 und −1** (±10 % entfallen dort; die Knöpfe sind so hoch wie der
  Start-Knopf, 46 px — ersetzt die Nachbesserung zu D-06), Reihenfolge:
  Start → Taktart mit Punkten → Tempo → +1 / −1 → „alles“.
- **C-05 · Stimmgerät sofort an, hört auch aus Abstand** (2026-10-26):
  Wunsch Marlon (iPad als Home-Bildschirm-App): Der Tipp auf „Stimmgerät“
  in der unteren Leiste **startet das Mikrofon gleich mit** — er ist die
  Geste, die der Browser für Mikrofon und Ton verlangt; der zweite Tipp im
  Widget entfällt (Pause/Weiter bleibt dort). Beim Start der App geht das
  Mikrofon weiterhin nie von allein an. Ob der Browser die Mikrofon-Erlaubnis
  behält, entscheidet er selbst: Home-Bildschirm-App auf iPhone/iPad ab
  iOS 17 und Chrome merken sich „Erlauben“, Safari im Tab fragt je Sitzung
  (Safari am Mac: Einstellungen für diese Website → Mikrofon → Erlauben).
  Dazu zwei Gründe, warum das Stimmgerät gesungene Töne nicht hörte:
  - Es lief mit **rohem Mikrofon** ohne Verstärkung (wie das Einsingen vor
    dem Lautsprecher-Schalter, G-03): aus Abstand blieb der Pegel unter der
    Schwelle. Jetzt Schalter **„Mikrofon verstärken“** in der großen Ansicht
    (Vorgabe an, Gerät-Einstellung `ueben:stimm-verstaerken`): Echo-
    Unterdrückung und Verstärkung des Browsers, hört Singen und Instrument
    auch aus Abstand; aus = rohes Mikrofon, nah ans Instrument. Umschalten
    startet ein laufendes Mikrofon neu. Die Pegelschwelle bleibt −42 dBFS.
    Mikrofon-Wunsch für Stimmgerät und Einsingen gemeinsam in
    `klang.ts` (`mikrofonWunsch`).
  - Lief das Metronom neben dem Stimmgerät an, setzte es die Audio-Sitzung
    auf „playback“ — damit **stellt iOS das Mikrofon stumm**. Jetzt gilt,
    solange ein Mikrofon offen ist (`mikrofonOffen` in `klang.ts`), immer
    „play-and-record“; die Wiedergabe-Wahl greift wieder, wenn das letzte
    Mikrofon zu ist.
  - Reihenfolge bleibt: erst `getUserMedia`, dann der `AudioContext` — iOS
    stellt mit dem Mikrofon die Abtastrate um, ein vorher angelegter Kontext
    passte nicht mehr. WebKit lässt einen Kontext bei laufender Aufnahme
    auch ohne Geste laufen (deshalb geht das Tonprofil von allein an).
- **„+ Noten“ aufgeräumt** (2026-10-26): Wunsch Marlon. Aus sechs Punkten
  mit Erklärzeilen werden fünf untereinander, nur Symbol und Name:
  **PDF-Dateien**, **Ordner**, **Einscannen**, **Fotos**, **Selbst
  schreiben** (ein erster Wurf mit zwei Punkten je Zeile gefiel nicht —
  untereinander bleibt es). Das Menü legt sich als **Popover** über die
  Liste (2026-10-27), statt sie nach unten zu schieben. Der letzte ersetzt
  „Einsingen oder Audio laden“ und „Neues Stück schreiben“ — beide führten in
  denselben Dialog, der öffnet jetzt mit „Schreiben“ und hat oben weiter die
  Quellen Mikrofon und Audio-Datei. Der Leerzustand bietet dieselben fünf
  Knöpfe mit denselben Namen (ohne eigenes „Einsingen“).
  - **PDF-Dateien und Ordner bleiben zwei Punkte** (Wunsch war einer, in dem
    man wahlweise Dateien oder einen Ordner öffnet): Der Browser hat zwei
    getrennte Dialoge (Dateiwahl und Ordnerwahl, auf dem iPhone
    `webkitdirectory` ab iOS 18.4). Im WebKit-Quelltext
    (`WKFileUploadPanel.mm`, `showFilePickerMenu`) nachgesehen: Mit
    Ordner-Erlaubnis bekommt der Dialog nur `UTTypeFolder`, sonst nur die
    Dateitypen — nie beides. Aus der Dateiwahl heraus lässt sich darum kein
    Ordner „öffnen“ (die Schaltfläche oben rechts tut ohne gewählte Datei
    nichts, das ist der Dialog des Systems), und in der Ordnerwahl sind
    Dateien ausgegraut. Ein einzelner Punkt müsste in der App erst fragen
    „Dateien oder Ordner?“ — ein Tipp mehr, nicht weniger. Am Rechner
    könnte Drag & Drop beides auf einmal (F-09). Einscannen und Fotos
    genauso: Ein einzelner Knopf ohne `capture` zeigte auf dem iPhone erst
    das Systemblatt „Fotomediathek / Foto aufnehmen / Datei auswählen“.
  - **Verlorene Aufnahmen behoben:** Jede Dateiwahl hatte einen Behelf für
    Browser ohne „cancel“-Ereignis — kam das Fenster zurück und nach 1,2–1,5 s
    lag keine Datei an, galt die Wahl als abgebrochen. Nach der Kamera kommt
    das Bild auf dem Telefon mitunter später: Der Behelf hatte die Wahl schon
    verworfen, es „passierte nichts“ (Rückmeldung Marlon, mal ja, mal nein).
    Jetzt nur noch in Browsern ohne `oncancel` (`dateiwahl.ts`), für alle
    Dateiwahlen (PDF, Ordner, Bilder, Audio).

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
  Touch, Maus) durchgespielt. *Seit B-16 (2026-10-31) zoomt der Doppeltipp
  beim Lesen auf 300 % um den Tipp statt auf die Breite (`umPunkt`).*
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
  einmal; seit 2026-10-26 „Fotos“, in einer Zeile mit „Einscannen“); auch
  in der leeren Bibliothek. Sammlung und Tag gelten wie beim Import.
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
  - **Nachbesserung (2026-10-31):** Rückmeldung Marlon: Im frisch geöffneten
    Stück tat der Doppeltipp mit dem Finger gar nichts, erst nach Zoomen von
    Hand ging es. Verdacht: Das **Schweben des Pencil** (iPad Pro ab M2
    meldet es als Zeigerbewegung ohne Druck) zählte als Stift-Ereignis und
    hielt die Schonzeit dauernd offen — mit dem Pencil in der Hand war jeder
    Finger-Tipp ein „Handballen“; Zwei-Finger-Zoom ging trotzdem (Safari-
    Gesten-Ereignisse). Jetzt zählt nur die Berührung des Pencil (Aufsetzen,
    Bewegung mit Druck, Abheben), nicht das Schweben. Auf dem iPad prüfen:
    Doppeltipp mit dem Finger, während der Pencil in der Hand über dem
    Display schwebt.

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
  Zahnrad und Schließen rechts beisammen. **Nachtrag 2026-10-27 (Wunsch
  Marlon):** Der Auswahl-Modus bleibt in derselben einen Zeile — **Alle ·
  Aktualisieren ↻ · In Sammlung (Ordner mit Pfeil) · Tags (Etikett) ·
  Papierkorb (rot) · Fertig** —, gleich hoch wie „+ Noten · A–Z/Zuletzt ·
  Auswählen“, damit die Liste beim Umschalten nicht nach unten rutscht.
  Sortierung seit 2026-10-26 in der Reihenfolge A–Z, Zuletzt.
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
