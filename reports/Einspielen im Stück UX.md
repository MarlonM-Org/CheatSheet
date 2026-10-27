# Einspielen im Stück — UX-Konzept (G-05, erste Stufe)

Stand 2026-10-27. Für Marlon. Grundlage: ROADMAP (Leitbild, G-01…G-05,
G-09, Reifegrad), `Einspielen.tsx`, `Notensatz.tsx`, `notation.ts`,
`notensatz.ts`, `klavier.ts`, `Aufnahmen.tsx`. Kein Code geändert; das hier
ist die Vorlage für die Umsetzung.

Der Wunsch im Wortlaut: *„Ich möchte in einem geschriebenen Stück in einen
Takt klicken und dann aufnehmen können, und dann einen Takt einfügen oder
ersetzen. Außerdem Aufnahmestopp, umschalten (z. B. zwischen rhythmisch und
melodisch), dann weiter aufnehmen.“*

## 0 · Kurzfassung

- **Empfehlung: die „Aufnahmeleiste“** — Modell B (in den gewählten Takt
  aufnehmen, Ergebnis prüfen, dann Einfügen oder Ersetzen) mit der
  Fortsetzung aus Modell D (nach dem Übernehmen steht die Leiste schon auf
  dem nächsten Takt; Lesart umschalten; weiter). Kein zweiter Dialog: die
  Leiste schwebt unten über dem Notenblatt wie das Metronom-Widget, das
  Blatt bleibt sichtbar und wird nicht verschoben.
- **Ablauf je Abschnitt:** Note oder Pause im Zieltakt antippen → ● in der
  Palette → Leiste öffnet „scharf“ (ab Takt 5, Lesart, Vorlauf) → ● →
  Vorlauf (ein Takt des Stücks vorgespielt, Klick läuft; bei Takt 1 der
  Einzähler) → Aufnahme (Taktzähler, gehörter Ton, kleine Tonspur) → ■ →
  **Prüfen:** die erkannten Takte liegen als Vorschau messingfarben im
  Blatt, Leiste zeigt „3 Takte · Einfügen | Ersetzen · − + · Verwerfen ·
  Übernehmen“ → Übernehmen schreibt sie als **einen** Rückgängig-Schritt in
  die Stimme; Leiste steht auf Takt 8, ● wartet.
- **Lesart (rhythmisch / melodisch)** ist ein Schalter der Leiste; er wirkt
  auf den aktuellen Abschnitt und lässt sich **auch nach dem Stopp noch
  umlegen** — die Spur wird nur neu gerastert, nicht neu gesungen. Ein
  Wechsel mitten im Lauf heißt: ■, umlegen, ●.
- **Einfügen oder Ersetzen** wird **nach** der Aufnahme entschieden, mit
  einer Vorgabe aus dem Blatt (Zieltakt leer → Ersetzen; Stückende →
  Anhängen; sonst Einfügen). Vorher weiß man nicht, wie viele Takte es
  werden.
- **Neu in `src/domain/`** (rein, getestet): `taktaufnahme.ts` mit
  `takteEinsetzen` (Einfügen/Ersetzen samt Bögen an den Nahtstellen),
  `nachlaufKuerzen`, `vorgabeArt`, `vorlaufKlaenge`, `abschnittKuerzen`;
  in `notation.ts` die Option `lesart` für `rastern`. Oberfläche: Hook
  `useMikrofonSpur` (aus `Einspielen.tsx` herausgelöst), Komponente
  `Aufnahmeleiste`, ein Knopf und zwei Props im `Notenblatt`.
- **Größe:** drei kleine bis mittlere Schritte (Domain · Hook · Leiste),
  zusammen ein mittelgroßes Vorhaben; nichts am Schema, nichts an `.uebe`.

## 1 · Problem, Ziele, Leitplanken

### 1.1 Was heute geht

- **Einsingen** (`Einspielen.tsx`) ist ein Vollbild-Dialog mit drei
  Quellen (Mikrofon, Audio-Datei, Schreiben). Mikrofon: ein Takt
  Einzähler, dann bis zu 64 Takte Aufnahme, Stopp → die ganze Spur wird
  mit `rastern` zu Takten → ein **neues Stück**. Phasen: `bereit · zaehlt ·
  nimmt · rechnet · vorschlag`.
- **Komponieren** öffnet denselben Dialog mit `vorlage` (gespeichertes
  Stück, `abcLesen`), aber **ohne** Mikrofon-Quelle — das Quellen-Segment
  ist bei einer Vorlage ausgeblendet. Wer in ein bestehendes Stück singen
  will, kann es heute nicht.
- Das **Notenblatt** (`Notensatz.tsx`) kennt die Auswahl `BlattPos
  {stimme, takt, note}`, bearbeitet nur den Takt der Auswahl (rote Takte,
  bis sie stimmen), hat Rückgängig (200 Schritte, im Dialog gehalten),
  Vorspielen ab der gewählten Note (`klaengeAlle` → `vorspielen`), Menüs
  als Popover (`notensatz-blase` + `nav-fang`).
- Die Transkription ist eine reine Funktion: `Tonrahmen[]` (Zeit ab
  Schlag 1, Tonhöhe, Pegel, Mittenband) → `segmentieren` → `rastern` →
  `Takt[]`, dann `skalieren` aufs Blattraster 96. Bögen über Taktstriche
  entstehen dabei als `bindung`.

### 1.2 Marlons Wunsch, zerlegt

| Satzteil | Heißt für die Oberfläche | Heißt für die Fachlogik |
|---|---|---|
| „in einen Takt klicken“ | Der Zieltakt ist die Auswahl des Blatts (Note oder Pause antippen); die Leiste zeigt ihn und lässt ihn mit − / + nachstellen | `zielTakt = auswahl.takt`, Stimme = `aktiv` |
| „dann aufnehmen“ | Ein Knopf startet Vorlauf und Aufnahme, man hört, wo man ist | Spur mit `zeit = 0` auf Schlag 1 des Zieltakts |
| „einen Takt einfügen oder ersetzen“ | Beides als Wahl mit Vorschau, nicht als Modus vorab | `takteEinsetzen(…, 'einfuegen' \| 'ersetzen')` |
| „Aufnahmestopp“ | ■ hält an und zeigt den Vorschlag; nichts wird von selbst geschrieben | Rastern erst beim Stopp |
| „umschalten (rhythmisch/melodisch)“ | Ein Zwei-Zustands-Schalter in der Leiste, auch nach dem Stopp wirksam | `rastern(…, { lesart })` auf derselben Spur |
| „dann weiter aufnehmen“ | Nach Übernehmen steht die Leiste auf dem Folgetakt | Zieltakt rückt um die übernommenen Takte vor |

### 1.3 Ziele und Nicht-Ziele

Ziele: (1) Ein Stück Takt für Takt zusammensingen, ohne den Dialog zu
wechseln. (2) Eine falsche Stelle neu einsingen, ohne den Rest anzufassen.
(3) Jeder Abschnitt ist ein Vorschlag, den man vor dem Übernehmen sieht und
danach mit einem ↶ wieder los wird. (4) Mit dem Finger auf dem iPhone
bedienbar, offline, nichts Neues im Speicher.

Nicht-Ziele dieser Stufe: Noten erscheinen nicht live während des Singens
(abcjs müsste ständig neu zeichnen, das Blatt würde springen); keine
Aufnahme als Audio gespeichert (G-09 bleibt getrennt); kein Auftakt im
Datenmodell; keine Mehrstimmigkeit in einer Aufnahme; kein Umschalten der
Lesart mitten im laufenden Abschnitt.

### 1.4 Leitplanken

- **Bedienregel:** Ein Tipp tut nur, was auf ihm steht. ■ stoppt — es
  übernimmt nicht. „Übernehmen“ schreibt — es startet nicht die nächste
  Aufnahme. Die Leiste **legt sich über** das Blatt (`position: fixed`,
  wie das Metronom-Widget), sie drückt nichts nach oben; ihre Höhe ist in
  jedem Zustand gleich, nur der Inhalt der Felder wechselt.
- **Vorschau darf das Blatt ändern:** Neue Takte im Blatt sind die
  erwartete Folge von „Aufnehmen“ — das ist eine Inhaltsänderung, keine
  Verschiebung durch ein Menü. Gescrollt wird nur, um den Zieltakt über der
  Leiste sichtbar zu halten.
- **Finger:** Zielgrößen wie die Palette (quadratische Symbolknöpfe), ●/■
  deutlich größer (56 px), genug Abstand zwischen ■ und dem nächsten
  Schreibknopf (siehe Entprellen in 4.2).
- **Offline, lokal:** nur Web Audio, keine neuen Dateien im Vorab-Cache.
- **Domain zuerst:** Einsetzen, Kürzen, Vorgabe, Vorlauf-Klänge als reine
  Funktionen mit Tests; die Komponente ruft sie nur.
- **Speicher unverändert:** Übernehmen ändert nur `stimmen` im Dialog;
  „Speichern“ geht den bestehenden Weg (`alsAbcStimmen` → `notationPdf` →
  `stueckNeuSchreiben`, Stellen bleiben auf ihrer Seite, `ueberzaehlig`).
  Die ABC-Quelle reist wie bisher in der `.uebe`.

## 2 · Vier Bedienmodelle

Alle vier nehmen an: Das Stück liegt im Komponieren-Dialog (`vorlage`) oder
ist gerade geschrieben (`quelle: 'leer'`); Tempo, Taktart, Tonart sind die
des Blatts; die Erkennung läuft wie heute (`useMikrofonSpur`, siehe 6).

### 2.1 Modell A · Punch-in wie in der DAW

Idee: Man wählt den Takt, drückt ●, das Stück spielt **ab zwei Takten
davor** mit Klavier und Klick; am Zieltakt schaltet die App um („punch
in“): die eigene Stimme verstummt, das Mikrofon schreibt mit, die anderen
Stimmen laufen weiter. ■ ist der „punch out“. Was zwischen Ein- und
Ausstieg lag, wird **ersetzt**.

Ablauf: Takt antippen → ● → Blatt-Zeiger (grün, wie beim Vorspielen) läuft
durch die Vortakte → am Zieltakt wird der Zeiger rot, Zähler „Takt 5 ·
Schlag 2 · g'“ → ■ → die ersetzten Takte stehen sofort im Blatt (ein
Rückgängig-Schritt).

- *Einzählen/Vorlauf:* immer Vorspiel + Klick; bei Takt 1 ein Einzähltakt.
- *Bögen:* Ein Bogen aus Takt 4 in Takt 5 wird am Einstieg gelöst; am
  Ausstieg ebenso. Eine Note, die über den Ausstieg hinaus gehalten wurde,
  wird am Ausstieg abgeschnitten (DAW-Verhalten).
- *Auftakt:* nicht vorgesehen; der Zeiger definiert Schlag 1.
- *Stimmen:* ersetzt nur die aktive Stimme; die anderen klingen weiter —
  genau Marlons G-05-Bild „über die Begleitung singen“.
- *Rückgängig:* ↶ nimmt den Abschnitt zurück.
- *Fehlerfälle:* Nichts erkannt → die Takte sind Pausen geworden
  (destruktiv, nur ↶ rettet). Zu viele Takte → gibt es nicht, es wird bis
  zum Ausstieg ersetzt — dafür verschwindet alles Alte zwischen Ein- und
  Ausstieg, auch wenn man eigentlich nur einfügen wollte. Tempo daneben →
  man merkt es erst im Ergebnis.

Bewertung: Am dichtesten am Musizieren, am wenigsten Tipps, aber ohne
Vorschau und ohne „Einfügen“: ■ schreibt ins Blatt — ein Tipp mit
Nebenwirkung, die man nicht gesehen hat. Für Marlons Hauptfall (Melodie
Takt für Takt aufbauen) fehlt das Einfügen.

### 2.2 Modell B · In den Takt aufnehmen, dann Ergebnis prüfen

Idee: Aufnahme wie heute, aber **ab einem Takt des Blatts** statt ab einem
leeren Blatt. Nach ■ erscheint das Erkannte als Vorschau im Blatt, und
erst dann wählt man **Einfügen** oder **Ersetzen** (oder verwirft).

Ablauf: Takt antippen → ● in der Palette (Leiste öffnet, zeigt „ab Takt 5“)
→ ● → Vorlauf → Aufnahme → ■ → Vorschau (neue Takte messingfarben; bei
„Ersetzen“ sind die alten Takte 5–7 weg, bei „Einfügen“ rutschen sie nach
hinten; Umschalten zeichnet um) → Übernehmen.

- *Einzählen/Vorlauf:* wählbar: Einzähler (nur Klick) oder 1–2 Takte des
  Stücks vorgespielt. Vorgabe: ein Takt Vorspiel, bei Takt 1 Einzähler.
- *Bögen:* `takteEinsetzen` löst den Bogen aus dem Vortakt in den
  Zieltakt, wenn der neue erste Takt ihn nicht fortsetzt, und den Bogen
  aus dem letzten ersetzten Takt in den Folgetakt. Innerhalb des
  Abschnitts entstehen Bögen wie bisher in `rastern`.
- *Auftakt:* nicht vorgesehen (siehe 4.5 Nr. 8).
- *Stimmen:* Ersetzen trifft nur die aktive Stimme; Einfügen schiebt in
  allen anderen Stimmen leere Takte ein (wie heute „+ Takt“ über
  `inAllen`), damit die Akkolade bündig bleibt. Begleitung hören ab dem
  Zieltakt ist ein Schalter (Vorgabe aus, Grund in 4.5 Nr. 3).
- *Rückgängig:* Übernehmen ist genau ein `aendern`-Aufruf → ein ↶.
- *Fehlerfälle:* Nichts erkannt → Leiste sagt es, Blatt unverändert,
  Knöpfe „Nochmal“ und „Leeren Takt einfügen“. Zu viele Takte → Zahl steht
  in der Leiste, − / + beschneidet den Abschnitt hinten, ein fast leerer
  Schlusstakt wird mit der Nachlauf-Regel von selbst weggelassen (4.4).
  Tempo daneben → man sieht es in der Vorschau, verwirft, stellt das
  Tempo des Blatts um (Feld oben) oder singt langsamer.

Bewertung: Klar, sicher, passt zum heutigen Bild „Ergebnis ist ein
Vorschlag“. Kostet zwei Tipps mehr als A (Prüfen und Übernehmen), bringt
dafür Einfügen und Sichtkontrolle. Allein genommen fehlt die Fortsetzung:
nach jedem Takt müsste man neu antippen und neu scharf schalten.

### 2.3 Modell C · Schleife über einen Takt

Idee: Der Zieltakt (oder ein Bereich) läuft in Schleife: ein Takt Vorlauf,
dann der Zieltakt, dann wieder Vorlauf … Jeder Durchlauf ist ein „Take“;
der letzte (oder ein ausgewählter) wird übernommen. Üben und Aufnehmen in
einem — wie Cycle-Recording in Logic.

Ablauf: Takt antippen → ● → Schleife läuft; die Leiste zeigt „Durchlauf 3“
und je Durchlauf eine Mini-Vorschau (Anzahl erkannter Noten) → ■ → Liste
der Takes (3 Zeilen) → einen antippen → Vorschau → Übernehmen.

- *Einzählen/Vorlauf:* in der Schleife eingebaut (der Vortakt ist der
  Vorlauf). Bei Takt 1: ein Einzähltakt.
- *Bögen:* wie B. Ein Ton, der in den Vorlauf des nächsten Durchlaufs
  hinein gehalten wird, muss abgeschnitten werden (sonst landet er im
  nächsten Take).
- *Auftakt:* nicht vorgesehen.
- *Stimmen:* wie B; Begleitung in der Schleife ist sinnvoll, aber mit
  Lautsprecher kommt der Klavierklang ins Mikrofon (Echo-Unterdrückung
  hilft, YIN hört den Ton trotzdem) — Kopfhörer nötig.
- *Rückgängig:* wie B.
- *Fehlerfälle:* Nichts erkannt → Durchlauf wird als leer gelistet. Zu
  viele Takte → Schleife ist fest lang, Überhang wird abgeschnitten (bei
  Melodien, die über den Bereich hinausgehen, ärgerlich). Tempo daneben →
  wie B.

Bewertung: Stark fürs Üben einer schweren Stelle, aber für „Stück Takt
für Takt aufbauen“ umständlich: Bereich festlegen, Takes vergleichen,
wählen. Mehr Zustände, mehr Oberfläche, und das „Abschneiden am
Schleifenende“ ist genau das, was Sänger stört. Als **Ausbaustufe** denkbar
(Schalter „Schleife“ in der Leiste), nicht als Grundmodell.

### 2.4 Modell D · Abschnitte: Stopp, umschalten, weiter

Idee: Eine **Sitzung** aus mehreren Abschnitten. Man schaltet einmal
scharf, singt, ■, legt die Lesart um, ●, singt weiter; jeder Abschnitt
hängt sich hinten an den vorigen. Am Ende (oder je Abschnitt) wird
übernommen.

Ablauf: Takt antippen → ● → Vorlauf → Abschnitt 1 → ■ (Abschnitt 1 steht
als Vorschau) → Schalter „rhythmisch“ → ● (Vorlauf jetzt = Abschnitt 1
vorgespielt) → Abschnitt 2 → ■ → Übernehmen (alles) oder je Abschnitt.

- *Einzählen/Vorlauf:* Der Vorlauf ist, was man gerade gesungen hat — das
  ist der beste Einsatz-Hinweis, den es gibt.
- *Bögen:* Zwischen zwei Abschnitten gibt es keinen Bogen (jeder beginnt
  mit einem Einsatz). Will man einen Ton über die Naht halten, bindet man
  nachher mit dem Haltebogen.
- *Auftakt:* nicht vorgesehen.
- *Stimmen:* wie B.
- *Rückgängig:* je Abschnitt ein Schritt (wenn je Abschnitt übernommen
  wird) — das ist besser als ein Schritt für die ganze Sitzung.
- *Fehlerfälle:* wie B, je Abschnitt. Dazu: Nach einem leeren Abschnitt
  bleibt der Zieltakt stehen (nichts rückt vor).

Bewertung: Genau Marlons Satz „Stopp, umschalten, weiter“. Allein genommen
beantwortet D nicht, **wohin** die Takte kommen (Einfügen/Ersetzen) — das
liefert B.

## 3 · Vergleich und Empfehlung

| | A Punch-in | B Takt + Prüfen | C Schleife | D Abschnitte |
|---|---|---|---|---|
| Klarheit (was passiert mit meinen Takten?) | mittel: ■ schreibt sofort | **hoch**: Vorschau, dann Wahl | mittel: Takes vergleichen | hoch, wenn mit B kombiniert |
| Tipps bis zum ersten übernommenen Takt | 3 (Takt, ●, ■) | 5 (Takt, ●, ●, ■, Übernehmen) | 6+ | 5, dann **3 je weiterem Abschnitt** (●, ■, Übernehmen) |
| Gefahr, Vorhandenes ungewollt zu zerstören | **hoch** (immer Ersetzen, keine Sicht) | niedrig (Vorgabe Einfügen, Vorschau, ein ↶) | niedrig | niedrig |
| Rhythmisch/melodisch umschalten | nur vor dem Start | auch nach dem Stopp (neu rastern) | je Take | je Abschnitt, auch nach dem Stopp |
| Aufwand | mittel (Live-Umschaltung, Begleitung mischen) | mittel | groß (Takes, Listen, Schleifenlogik) | klein zusätzlich zu B |
| Passung zum Code | `vorspielen` + Mikrofon in einem Kontext nötig; sonst gut | sehr gut: `rastern` → `Takt[]` → `inStimme`/`inAllen`, Verlauf wie heute | neue Zustandsmenge | sehr gut: nur Zieltakt vorrücken |
| Passt zur Bedienregel | nein (■ mit Nebenwirkung) | ja | ja | ja |

**Empfehlung: B als Kern, D als Fortsetzung — zusammen „die
Aufnahmeleiste“.** Begründung: Marlon will beides, aufbauen (Einfügen,
Anhängen) und ausbessern (Ersetzen); nur B macht beide Fälle sichtbar,
bevor etwas geschrieben wird, und nur B kann die Lesart nachträglich
umlegen, weil die Spur bis zum Übernehmen erhalten bleibt. D kostet darauf
fast nichts (nach Übernehmen den Zieltakt um n vorrücken, den Vorlauf aus
dem Blatt nehmen) und liefert den Rhythmus „●, singen, ■, Übernehmen, ●
…“, der sich beim Stückbau einschleift. A ist als späterer Schalter
„Begleitung weiter hören“ enthalten; C als späterer Schalter „Schleife“
möglich, wenn das Grundmodell auf dem Gerät taugt.

## 4 · Das empfohlene Modell im Detail

### 4.1 Bildschirme

Ort: der Komponieren-Dialog (`EinspielenDialog` mit `vorlage` oder
`quelle: 'leer'`). Das Notenblatt behält Palette und Blatt; neu ist ein
Knopf ● in der Palette (erster Block neben ▶, nur mit `aendern` und nur,
wenn `navigator.mediaDevices` da ist) und die **Aufnahmeleiste** als
`createPortal` unten über dem Dialog. Die Leiste hat in jedem Zustand
dieselbe Höhe (zwei Zeilen, etwa 104 px plus `safe-area-inset-bottom`)
und dieselben drei Felder: links der **Rundknopf** (56 px), in der Mitte
der **Stand** (zwei Textzeilen), rechts die **Schalter**. Zeile 2 ist die
Steuerzeile; ihr Inhalt wechselt mit dem Zustand, ihre Höhe nicht.

**Zustand „scharf“** (nach ● in der Palette; nichts läuft):

```
┌────────────────────────────────────────────────────────────────┐
│ (●)  Aufnehmen ab Takt 5 · Stimme 1 · 90 bpm · 4/4       [×]   │
│      Vorlauf: Takt 4 wird vorgespielt, dann singen             │
│ [ −  Takt 5  + ]   [ melodisch | rhythmisch ]   [ Vorlauf ▾ ]  │
└────────────────────────────────────────────────────────────────┘
```

- − / + verschiebt den Zieltakt (für den Finger, wenn eine Pause schwer zu
  treffen ist); Antippen einer Note im Blatt setzt ihn ebenfalls. Der
  Zieltakt ist im Blatt **messingfarben umrandet** (alle Noten des Takts
  gefärbt, wie die Auswahl heute). Zieltakt = `takte.length` heißt
  „Anhängen“.
- „Vorlauf ▾“ öffnet ein Popover (wie `notensatz-blase`): *Einzähler
  (nur Klick) · 1 Takt vorspielen · 2 Takte vorspielen* und darunter den
  Schalter *Begleitung ab dem Zieltakt weiter hören* (nur bei ≥ 2
  Stimmen) und *Lautsprecher* (wie heute). Alles persönliche
  Einstellungen (6.4).
- × schließt die Leiste; Palette und Blatt sind wie vorher.
- Palette und Blatt bleiben bedienbar (man darf noch eine Note ändern),
  Vorspielen ▶ ist erlaubt.

**Zustand „zählt“** (Vorlauf läuft):

```
│ (■)  Vorlauf · Takt 4                                           │
│      4 · 3 · 2 · 1  (Einzähler)  bzw.  grüner Zeiger läuft im Blatt
│ ▂▃▅▂▁▁▂▃  (Tonspur, letzte 8 s, leer)                            │
```

Im Blatt läuft der grüne Zeiger des Vorspielens über die Vortakte (gleiche
Färbung wie `abspielen`), damit man den Einsatz **sieht**; beim reinen
Einzähler steht die Zahl groß in der Leiste wie heute. ■ bricht ab (zurück
zu „scharf“, nichts aufgenommen).

**Zustand „nimmt“**:

```
│ (■)  Takt 6 · Schlag 3                    g'                     │
│      Aufnahme läuft — ■, wenn der Abschnitt zu Ende ist          │
│ ▂▃▅▂▁▁▂▃▅▆▅▃▂  (Tonspur mit Taktstrichen, wie heute `zeichnen`)  │
```

Im Blatt wandert ein **roter Rahmen** von Takt zu Takt (Takte, die es
noch nicht gibt, bekommen keinen Rahmen — der Zähler in der Leiste reicht).
Keine Noten live. Nach `MAX` Takten (Vorgabe 32) hält die App von selbst
an. App-Wechsel (`useBeimVerlassen`) hält an und behält die Spur.

**Zustand „prüfen“** (nach ■):

```
│ (↻)  3 Takte erkannt · ab Takt 5                                 │
│      Vorschau im Blatt — Einfügen schiebt Takt 5–9 nach hinten   │
│ [ Einfügen | Ersetzen ]  [ − 3 Takte + ]  [ melodisch | rhythm. ]  [Verwerfen]  [ Übernehmen ] │
```

- Im Blatt stehen die neuen Takte **messingfarben** an Ort und Stelle;
  „Ersetzen“ zeigt sie anstelle von Takt 5–7, „Einfügen“ vor dem alten
  Takt 5. Das Blatt scrollt so, dass der erste neue Takt sichtbar ist.
- − / + schneidet hinten Takte weg bzw. holt sie zurück (bis zur
  erkannten Zahl). Die Lesart-Umschaltung rastert die Spur neu und
  zeichnet die Vorschau um.
- Der Rundknopf ist nach ■ **500 ms lang leer und inaktiv** (Entprellen:
  ein Doppeltipp auf ■ darf nichts auslösen), dann ↻ „Nochmal“ (gleicher
  Zieltakt, Vorschlag weg — die Leiste fragt nicht, ↶ gibt es hier nicht,
  darum der Abstand).
- ▶ in der Palette spielt die Vorschau ab (Blatt mit Vorschau =
  `stimmen`-Prop), nützlich zum Kontrollieren.
- „Übernehmen“ ist der einzige Knopf, der das Blatt wirklich ändert.
- Sonderfall **nichts erkannt**:

```
│ (↻)  Kein Ton erkannt                                            │
│      Näher ans Mikrofon oder lauter; der Klick bleibt draußen    │
│ [ Leeren Takt einfügen ]                          [ Verwerfen ]  │
```

**Zustand „übernommen“** (sofort wieder „scharf“):

```
│ (●)  Aufnehmen ab Takt 8 · Stimme 1                              │
│      3 Takte übernommen (↶ nimmt sie zurück) · Vorlauf: Takt 7  │
│ [ −  Takt 8  + ]   [ melodisch | rhythmisch ]   [ Vorlauf ▾ ]    │
```

Der Zieltakt ist um die übernommenen Takte vorgerückt; die Auswahl des
Blatts steht auf der ersten Note des neuen Zieltakts (oder „Anhängen“).
Hinweise (G-10) rechnen wie immer nach.

**iPhone hochkant:** Zeile 2 wird zu einer waagerecht scrollbaren Reihe
(wie die Palette), „Übernehmen“ bleibt rechts fest. Die Leiste deckt etwa
ein Viertel des Bildschirms; das Blatt darunter scrollt. **iPad:** alles
in einer Reihe, Leiste maximal 42 rem breit, mittig (wie `.mix-blatt`).

### 4.2 Zustandsautomat

```
                 ● Palette                 ● Leiste
  ruhe ───────────────────► scharf ───────────────────► zaehlt
   ▲                         ▲   ▲                        │ t ≥ t0
   │ ×                       │   │ ■ (Abbruch)            ▼
   │                         │   └─────────────────────── nimmt
   │                         │                            │ ■ · MAX · App-Wechsel
   │                    Übernehmen                        ▼
   │                         │                         pruefen ──┐ Lesart / − + / Einfügen|Ersetzen
   │                         │                          │  ▲      │ (Vorschau neu)
   │                         └───── (Zieltakt += n) ◄───┘  └──────┘
   │                                  Verwerfen → scharf (gleicher Zieltakt)
   │                                  ↻ Nochmal  → zaehlt
   └──── jeder Zustand: Fehler (Mikrofon verweigert) → scharf mit Meldung
```

| Zustand | Was gilt | Verlässt man mit |
|---|---|---|
| `ruhe` | Blatt wie heute | ● Palette → `scharf` (Zieltakt = Auswahl, sonst Anhängen) |
| `scharf` | Leiste offen, Zieltakt umrandet, Blatt bedienbar | ● → `zaehlt`; × → `ruhe`; − / + / Antippen ändert Zieltakt |
| `zaehlt` | Klicks und Vorlauf-Klänge geplant, Mikrofon offen, `t < t0` | `t ≥ t0` → `nimmt`; ■ → `scharf` |
| `nimmt` | Rahmen sammeln (`zeit = t − versatz − t0`), roter Rahmen wandert | ■ / MAX / `hidden` → `pruefen` |
| `pruefen` | Spur eingefroren; `vorschlag = rastern(spur, lesart)`; `vorschau = takteEinsetzen(stimmen, …)` als Prop ans Blatt, **nicht** über `aendern` | Übernehmen → `aendern(vorschau)` → `scharf` (Zieltakt + n); Verwerfen → `scharf`; ↻ → `zaehlt` |
| Fehler | Meldung in Zeile 2 der Leiste (rot), kein eigener Zustand | nächster Tipp |

Während `zaehlt`/`nimmt` ist die Palette gesperrt (ein Tipp auf „Löschen“
mitten im Lauf wäre eine Nebenwirkung auf die Vorschau), × der Leiste
und ⌫ des Dialogs ebenfalls (`beschaeftigt` wie heute).

### 4.3 Datenfluss

1. **Scharf schalten.** `zielTakt` (0-basiert) aus `auswahl.takt` der
   aktiven Stimme; `raster` = Erkennungsraster des Dialogs (`bpm`,
   Taktart, `feinheit` 8/16 aus `ueben:einspiel-feinheit`), `blattRaster`
   = `aufBlatt(raster)`.
2. **Vorlauf planen.** `vorlaufKlaenge(stimmen, blattRaster, stumm,
   aktiv, zielTakt, vorlaufTakte, begleitungWeiter)` liefert `Klang[]` mit
   `beginn` relativ zu Schlag 1 des Zieltakts (negativ = Vorlauf). Der
   Hook legt **einen** `AudioContext` an (wie `aufnehmen` heute), plant
   die Klicks ab `beginn` (Vorlauf-Takte + ggf. Einzähltakt) und die
   Klavier-Klänge mit `klavierTon(ctx, gain, klingend(midi, stimmung,
   kammerton), beginn + vorlaufDauer + k.beginn, k.dauer)`;
   `t0 = beginn + vorlaufDauer`. Alles in demselben Kontext, damit
   Vorspiel, Klick und Spur dieselbe Uhr haben (heute: `vorspielen` macht
   einen eigenen Kontext — für den Vorlauf nicht nutzbar, darum
   `klavierTon` direkt).
3. **Aufnehmen.** Rahmen wie heute: `grundfrequenz` → `frequenzZuTon`,
   `effektivwert`, `bandpegel`; `zeit = jetzt − versatz − t0`, Rahmen ab
   `−0,05 s`. Unverändert aus `Einspielen.tsx`, nur in den Hook gezogen.
4. **Stopp → Vorschlag.** `versatz = versatzSchaetzen(spur, raster)`; bei
   `0` (zu wenige Tonwechsel, typisch bei einem Takt) der zuletzt in
   dieser Sitzung gemessene Wert (4.5 Nr. 10). `takte = skalieren(
   rastern(spurVorgezogen, raster, { tonart, lesart }), raster.feinheit)`
   → `nachlaufKuerzen(takte, blattRaster)` → `abschnittKuerzen(takte, n)`
   (wenn − gedrückt).
5. **Vorschau.** `art = vorgabeArt(stimmen[aktiv].takte, zielTakt,
   takte.length)` beim ersten Mal, danach die Wahl des Nutzers.
   `vorschau = takteEinsetzen(stimmen, aktiv, zielTakt, takte, art,
   blattRaster)` → ans `Notenblatt` als `stimmen={vorschau.stimmen}` mit
   `hervorgehoben={{ stimme: aktiv, von: zielTakt, bis: zielTakt +
   takte.length }}` (messing). `aendern` bleibt in diesem Zustand
   `undefined` (Blatt nur ansehen, ▶ geht).
6. **Übernehmen.** `aendern(vorschau.stimmen)` — ein Eintrag im Verlauf
   des Dialogs, ↶ holt das ganze Paket zurück. `zielTakt += takte.length`,
   Auswahl auf `{ stimme: aktiv, takt: zielTakt, note: 0 }` (oder
   Anhängen). Spur verwerfen (nicht behalten — kein Audio im Speicher).
7. **Speichern** wie heute; nichts Neues: `alsAbcStimmen(stimmen,
   blattRaster, { titel }, tonart)` → PDF → `stueckNeuSchreiben` bzw.
   `stueckAnlegen` mit `art` unverändert (`geschrieben` bleibt
   `geschrieben`; ein per Leiste erweitertes Stück ist weiter
   „geschrieben“ — eine neue `art` lohnt nicht).

Nummerierung: Takte sind positionsbestimmt (kein Feld „Nummer“). Nach
Einfügen heißt der alte Takt 5 „Takt 8“; Stellen und Anmerkungen hängen an
Seiten, nicht an Takten, und bleiben beim Speichern auf ihrer Seite — wie
bei jeder anderen Änderung im Notenblatt.

### 4.4 Fachregeln (neu in `src/domain/taktaufnahme.ts`, alle mit Test)

Hinweis zum Namen: `src/domain/einspielen.ts` gibt es schon (Sicherung
laden); darum `taktaufnahme.ts`.

- **`takteEinsetzen(stimmen, stimme, ab, neu, art, r): { stimmen, von,
  bis }`**
  - `'ersetzen'`: Takte `ab … ab+n−1` der Stimme werden durch `neu`
    ersetzt; reicht `neu` über das Ende hinaus, wächst die Stimme, alle
    anderen Stimmen bekommen hinten leere Takte (`angleichen`).
  - `'einfuegen'`: `neu` wird vor Takt `ab` eingeschoben; alle anderen
    Stimmen bekommen an derselben Stelle `n` leere Takte (`leererTakt`),
    damit die Akkolade bündig bleibt (wie „+ Takt“ heute).
  - `ab === takte.length` (Anhängen) verhält sich in beiden Arten gleich.
  - **Nahtstellen:** Endet Takt `ab−1` mit `bindung` und beginnt `neu[0]`
    nicht mit derselben Tonhöhe, wird der Bogen gelöst (Regel wie in
    `taktLoeschen`). Endet der letzte ersetzte Takt mit `bindung` in den
    Folgetakt, wird sie am Ende von `neu` nur gesetzt, wenn `neu` selbst
    dort bindet — sonst gelöst. `neu` wird je Takt durch `legen(strecken(
    t), r)` geschickt, damit Werte und Triolen wie das Blatt sie schreibt
    dastehen.
  - Tests: Einfügen mitten drin (andere Stimme bekommt leere Takte an
    derselben Stelle), Ersetzen über das Ende hinaus, Anhängen, Bogen in
    den Zieltakt wird gelöst / bleibt bei gleicher Höhe, Bogen aus dem
    letzten ersetzten Takt.
- **`nachlaufKuerzen(takte, r): Takt[]`** — Nachklang-Regel: Besteht der
  letzte Takt nur aus der Fortsetzung eines gebundenen Tons (erste Note
  hat `angebunden`, Rest Pausen) und ist dieser Rest höchstens eine halbe
  Schlaglänge lang, fällt der Takt weg und die Bindung davor wird
  gelöst. Deckt den typischen Fall „Schlusston über den Taktstrich
  gehalten“ ab, ohne eine echte Überbindung (länger als ein halber
  Schlag) anzutasten. Tests: Sechzehntel-Nachklang fällt weg, halbe Note
  im Folgetakt bleibt, ein Takt mit eigenem Einsatz bleibt.
- **`abschnittKuerzen(takte, n, r): Takt[]`** — die ersten `n` Takte;
  eine Bindung am neuen Ende wird gelöst. Test: `bindung` am Schnitt weg.
- **`vorgabeArt(takte, ab, n): 'einfuegen' | 'ersetzen'`** — `ab ≥
  takte.length` → `'ersetzen'` (Anhängen); sind die Takte `ab … ab+n−1`
  alle reine Pausen → `'ersetzen'`; sonst `'einfuegen'`. Tests: leerer
  Zieltakt, halbvoller Zieltakt, Stückende.
- **`vorlaufKlaenge(stimmen, r, stumm, aktiv, ab, vorlaufTakte, weiter):
  Klang[]`** — `klaengeAlle` auf das Fenster `[ab − vorlaufTakte, ab)` in
  Sekunden, `beginn` relativ zu Schlag 1 von Takt `ab` (negativ); Klänge,
  die vor dem Fenster beginnen, werden am Fensteranfang abgeschnitten
  (wie `abspielen` es heute für „ab hier“ tut); bei `weiter` zusätzlich
  die Klänge aller Stimmen außer `aktiv` ab `ab` bis zum Ende. Bei `ab ===
  0` oder `vorlaufTakte === 0` leer — dann zählt nur der Klick ein.
  Tests: Fenster, Abschneiden, aktive Stimme stumm ab `ab`, Takt 1.
- **`rastern(…, { lesart })`** in `notation.ts` (kommt aus der parallelen
  Untersuchung; hier nur die Schnittstelle): `'melodisch'` = heute;
  `'rhythmisch'` = Einsätze und Dauern wie heute, Tonhöhe fest. Vorgabe
  für die feste Höhe: die letzte Note der Stimme vor dem Zieltakt
  (`letzteHoehe`), sonst h' (71, Mittellinie im Violinschlüssel). Die
  Leiste reicht die Höhe als Option durch (`festeHoehe`), damit
  `notation.ts` nichts vom Blatt wissen muss.
- **`zeitStrecken(rahmen, faktor)`** (optional, für „langsamer
  aufnehmen“, 4.5 Nr. 11): `zeit * faktor` — trivial, aber als Funktion
  mit Test, damit die Leiste nur rechnet, was getestet ist.

### 4.5 Offene Entscheidungen (mit Vorgabe)

1. **Einfügen/Ersetzen nachher statt vorher.** Vorgabe: nachher, mit
   `vorgabeArt`. Alternative: Wahl vorab als Modus — spart einen Blick,
   kostet Sicherheit, weil man die Taktzahl vorher nicht kennt.
2. **Vorlauf.** Vorgabe: ein Takt des Stücks vorgespielt + Klick; bei
   Takt 1 ein Einzähltakt. Zur Wahl im Popover: Einzähler · 1 · 2 Takte.
3. **Begleitung ab dem Zieltakt weiter hören** (andere Stimmen). Vorgabe
   **aus**: Mit Lautsprecher kommt der Klavierklang ins Mikrofon; die
   Echo-Unterdrückung ist auf Sprache gebaut, YIN rastet gern auf dem
   lauteren Klavierton ein. An ist richtig mit Kopfhörer — der Schalter
   sagt das im Text. Mit Einfügen passt die gehörte Begleitung ohnehin
   nicht zu dem, was eingefügt wird (die anderen Stimmen bekommen leere
   Takte); der Hinweis steht im Prüfen-Zustand.
4. **Lesart-Umschalten im Lauf.** Vorgabe: nicht; ■ → umlegen → ●.
   Alternative: Umschaltzeitpunkte merken und die Spur stückweise
   rastern — technisch machbar (`rastern` je Teilspur, am Taktstrich
   geschnitten), aber ein Schalter mitten im Singen ist auf dem iPhone
   unrealistisch.
5. **Feste Tonhöhe bei „rhythmisch“.** Vorgabe: letzte Note davor, sonst
   h'. Alternative: Kreuz-Köpfe (ABC `!style=x!` je Note oder
   `K:perc`) — abcjs kann das, aber das Blatt müsste ein weiteres
   Notenattribut tragen und `abcLesen` es lesen. Später, wenn Rhythmus-
   Stimmen (Klatschen, Schlagzeug) wirklich gebraucht werden.
6. **Nachklang-Regel** (`nachlaufKuerzen`). Vorgabe: an, Schwelle halbe
   Schlaglänge; die Leiste zeigt „letzter Takt weggelassen (Nachklang)“
   als Zeile-2-Text, + holt ihn zurück.
7. **Längste Aufnahme je Abschnitt.** Vorgabe 32 Takte (heute 64 für ein
   ganzes Stück). Danach Stopp von selbst → Prüfen.
8. **Auftakt.** Vorgabe: nicht in dieser Stufe; Schlag 1 des Zieltakts
   ist der Nullpunkt. Wer einen Auftakt braucht, nimmt ab dem Takt davor
   auf oder schreibt die Auftaktnote von Hand. Ausbaustufe: Rahmen im
   letzten Vorlauftakt behalten und `rastern` eine negative Startzelle
   erlauben — dafür braucht das Datenmodell einen kurzen ersten Takt,
   den `taktStimmt` heute rot färbt.
9. **Erster Tipp auf ● in der Palette.** Vorgabe: öffnet die Leiste
   scharf (zweiter Tipp startet). Alternative: startet sofort mit den
   gemerkten Einstellungen — ein Tipp weniger, aber beim ersten Mal
   (Mikrofon-Frage, Zieltakt prüfen) überraschend; die Leiste muss ja
   sowieso erscheinen.
10. **Latenz bei kurzen Abschnitten.** `versatzSchaetzen` braucht ≥ 4
    Tonwechsel und liefert bei einem Takt oft 0. Vorgabe: den letzten
    gemessenen Wert der Sitzung weiterverwenden, sonst 0. Ausbaustufe: ein
    Kalibrier-Knopf im Vorlauf-Popover („vier Klicks mitklatschen“) →
    Geräteeinstellung `ueben:einspiel-latenz` (Gerät, reist nicht).
11. **Langsamer aufnehmen** (75 % / 50 %, Spur danach gestaucht). Vorgabe:
    nicht in der ersten Stufe, aber `zeitStrecken` ist billig und für
    schnelle Stellen Gold wert — als zweiter Schritt in das
    Vorlauf-Popover.
12. **App-Wechsel während der Aufnahme.** Vorgabe: anhalten und in
    „prüfen“ gehen (Spur bleibt). Heute im Einsingen: Aufnahme läuft
    weiter, bis der Dialog zu ist.
13. **Der Mikrofon-Reiter im Einsingen-Dialog.** Bleibt vorerst. Wenn die
    Leiste auf dem Gerät taugt, kann „Einsingen“ = „Schreiben (leeres
    Blatt) + Leiste ab Takt 1“ werden und der Reiter fällt weg — ein
    Weg weniger, derselbe Hook. Entscheidung nach dem Gerätetest.
14. **Takt antippen ohne Note treffen.** Vorgabe: Note oder Pause
    antippen (jeder Takt hat mindestens eine Pause) plus − / + in der
    Leiste. Ausbaustufe: Tipp in die leere Fläche eines Takts wählt den
    Takt (abcjs liefert Taktpositionen über `tune.lines[].staff[]
    .voices[]` — zu prüfen, ob die x-Lagen der Taktstriche zugänglich
    sind).

## 5 · Vorbilder

Nur, soweit verlässlich bekannt; Unsicheres ist markiert.

- **Logic Pro (DAW):** Punch-in/out über einen Autopunch-Bereich, Count-in
  einstellbar (Takte), Cycle-Aufnahme legt je Durchlauf einen Take in
  einem Take-Ordner an, „Comping“ wählt per Wisch je Abschnitt den besten
  Take. Vorbild für A und C; die Erkenntnis fürs Konzept: DAWs trennen
  **Aufnehmen** (destruktiv erst beim Commit) von **Auswählen**, und der
  Vorlauf (Pre-Roll) spielt immer das vorhandene Material.
- **Ableton Live:** Count-in als Metronom-Einstellung (1/2/4 Takte),
  Overdub in der Arrangement-Ansicht, Loop-Aufnahme in Session-Clips;
  „Capture MIDI“ holt rückwirkend, was man gerade gespielt hat, ohne dass
  Aufnahme lief. Letzteres ist für eine spätere Stufe interessant
  („Das war gut — behalten“): technisch ein Ringpuffer der Tonrahmen.
- **Sibelius Flexi-time:** Echtzeit-Eingabe über MIDI ab der gewählten
  Stelle, mit Klick und Einzähler; Quantisierung über „kleinster
  Notenwert“, das Tempo kann dem Spieler folgen („Flexi“). Audio statt
  MIDI geht nur über das Zusatzprodukt AudioScore (unsicher, wie eng das
  heute integriert ist). Vorbild für „ab Takt n, mit Einzähler,
  kleinster Wert“ — das haben wir schon.
- **Dorico:** Echtzeit-MIDI-Aufnahme ab der Eingabemarke, Einzähler und
  Klick, Quantisierung nachträglich änderbar (unsicher: ob die
  Rohdaten dafür erhalten bleiben oder nur die Notenwerte neu
  gerundet werden). Dorico hat einen allgemeinen **Einfüge-Modus**, der
  entscheidet, ob Eingaben schieben oder überschreiben — genau unsere
  Frage Einfügen/Ersetzen, bei Dorico als Modus vorab (unsere Vorgabe:
  nachher).
- **MuseScore (3, nach meinem Stand auch 4):** „Echtzeit (automatisch)“
  mit Metronom und Einzähler bzw. „Echtzeit (manuell)“ per Pedal; nur
  MIDI, kein Mikrofon; schreibt direkt ins Blatt, überschreibt ab der
  Eingabemarke (unsicher bei Details in MuseScore 4). Der MIDI-Import
  mit „Legato erhalten“ war das Vorbild für unsere Rasterung.
- **StaffPad:** Handschrift mit Stift; eine Aufnahme ins Blatt ist mir
  nicht bekannt (unsicher). Nicht einschlägig.
- **Notion (PreSonus):** Echtzeit-MIDI-Aufnahme ab der Marke mit Klick
  (unsicher bei der Mobil-Version). Nicht einschlägig für Audio.
- **ScoreCloud (Studio / Express):** Singt oder spielt man ein, entsteht
  ein **neues** Blatt je Aufnahme (mit oder ohne Klick, „Flex“ folgt dem
  Tempo); ein Einfügen in ein bestehendes Blatt ist mir nicht bekannt
  (unsicher). Interessant: ScoreCloud lässt die **Analyse nachträglich
  umstellen** (Tempo, Taktart, Quantisierung) und rechnet dieselbe
  Aufnahme neu — das ist unser „Lesart nach dem Stopp umlegen“.
- **Klangio Sing2Notes:** Datei oder Aufnahme → neues Blatt, kein
  Einfügen (unsicher).

Fazit aus den Vorbildern: Niemand lässt eine Mikrofon-Aufnahme in ein
bestehendes Blatt an einen Takt einfügen; die MIDI-Welt tut es ab der
Marke, als Modus (Überschreiben/Einfügen) und schreibt sofort. Unsere
Kombination — ab Takt, Vorschau, Wahl danach, Lesart nachträglich — ist
konsequent, weil die Erkennung aus Gesang unsicherer ist als MIDI: Was
unsicher ist, zeigt man, bevor man es schreibt.

## 6 · Umsetzungsskizze

Reihenfolge so, dass jeder Schritt für sich grün ist und pushbar
(`typecheck && lint && test && build`).

### 6.1 Domain (klein–mittel, zuerst)

- **Neu `src/domain/taktaufnahme.ts`** mit `takteEinsetzen`,
  `nachlaufKuerzen`, `abschnittKuerzen`, `vorgabeArt`, `vorlaufKlaenge`,
  `zeitStrecken` (4.4) und **`tests/taktaufnahme.test.ts`** (Takt-
  Schreibweise `kurz()` wie in `notensatz.test.ts`). Baut auf `strecken`,
  `legen`, `leererTakt`, `angleichen`, `klaengeAlle`, `taktDauer`.
  `bogenLoesen` in `notensatz.ts` ist privat — exportieren (ein Wort).
- **`notation.ts`:** `RasterOptionen` um `lesart?: 'melodisch' |
  'rhythmisch'` und `festeHoehe?: number` erweitern; `rastern` setzt bei
  `rhythmisch` jede Tonhöhe auf `festeHoehe` (nach `segmentieren`, damit
  die Silbentrennung erhalten bleibt). Kommt zusammen mit der parallelen
  Schwellen-Untersuchung; ein Test „rhythmisch liefert dieselben Werte
  mit einer Höhe“.
- **`einstellungen.ts`:** neue Schlüssel `ueben:einspiel-lesart`
  (Person, reist mit), `ueben:einspiel-vorlauf` (Person),
  `ueben:einspiel-begleitung` (Person); Prüfregeln dazu; geschrieben über
  `speichern()` aus `klang.ts`.

Größe: **klein–mittel** (ein Nachmittag Domain + Tests).

### 6.2 Hook `useMikrofonSpur` (mittel)

- Aus `Einspielen.tsx` den Mikrofon-Teil herauslösen (`aufnehmen`,
  `stoppen`, Analyser-Schleife, Klick-Planung, `wachHalten`,
  `mikrofonOffen`, Fehlertexte) in `src/components/ueben/mikrofonspur.ts`:
  `useMikrofonSpur({ raster, lautsprecher, klickWeiter, metro, einst })`
  → `{ phase, anzeige, starten({ vorlaufTakte, einzaehlen, klaenge,
  maxTakte }), stoppen(behalten), spur }`. Neu gegenüber heute: `t0 =
  beginn + vorlaufDauer`, Klavier-Klänge im selben Kontext
  (`klavierTon`), Stopp beim App-Wechsel über `useBeimVerlassen` aus `klang.ts` (Metronom und Stimmgerät nutzen es schon).
- `Einspielen.tsx` (Mikrofon-Quelle) benutzt den Hook mit
  `vorlaufTakte = 0, einzaehlen = true` — Verhalten unverändert, der
  Dialog wird kürzer.
- Die Tonspur-Zeichnung (`zeichnen`) wird eine kleine Komponente
  `Tonspur` (Canvas, feste Höhe), die Dialog und Leiste teilen.

Größe: **mittel** (Umbau ohne neue Fachlogik, auf dem Gerät gegen die
Einsingen-Checkliste prüfen).

### 6.3 Notenblatt (klein)

- Neue Props: `hervorgehoben?: { stimme: number; von: number; bis:
  number; farbe: 'messing' | 'warnung' }` (Takte färben über `faerben`
  je Note, nach jedem Zeichnen neu — wie die roten Takte heute);
  `zusatz?: React.ReactNode` für den ●-Knopf im ersten Palettenblock
  (oder direkt eine Prop `aufnehmen?: () => void` mit Symbol
  `SymbolPunkt`). `taktWaehlen(stimme, takt)` als Rückruf, damit die
  Leiste die Auswahl setzen kann (Übernehmen → nächster Takt).
- Während `zaehlt`/`nimmt`: der grüne Zeiger des Vorspielens für den
  Vorlauf — `faerben` ist da; die Leiste liefert `zeigerZeit()` wie
  `vorspiel.current.zeit()`. Einfacher Weg: das Blatt bekommt
  `laufzeit?: () => number | null` und färbt selbst.

Größe: **klein**.

### 6.4 Aufnahmeleiste (mittel)

- **Neu `src/components/ueben/Aufnahmeleiste.tsx`:** Zustände aus 4.2,
  Felder aus 4.1, `createPortal` nach `document.body`, CSS
  `.aufnahme-leiste` (fixed, unten, `env(safe-area-inset-bottom)`,
  z-Index über `.scan-dialog` (90), feste Höhe, Zeile 2 als Reihe mit
  `overflow-x: auto` auf schmalen Bildschirmen). Popover „Vorlauf ▾“
  mit `notensatz-blase` + `nav-fang`.
- **`Einspielen.tsx`** hält `leiste: null | { zielTakt, … }` und
  `vorschau`; reicht dem `Notenblatt` `stimmen={vorschau?.stimmen ??
  stimmen}`, `aendern={vorschau ? undefined : aendern}`,
  `hervorgehoben`; Übernehmen ruft `aendern(vorschau.stimmen)`. Der
  Palette-Knopf ● erscheint bei `vorlage` oder `quelle === 'leer'`
  (Schreiben).
- Texte und `aria-label` je Zustand; `role="status"` für Zeile 1 im
  Lauf; Escape schließt die Leiste nur in `scharf`/`pruefen`.

Größe: **mittel**.

### 6.5 Drumherum (klein)

- ROADMAP: G-05 von „nur Einschätzung“ auf „begonnen“ mit Verweis auf
  dieses Papier; Prüfliste fürs Gerät unter „Zu prüfen“ (unten).
- Kein Schema, keine `.uebe`-Änderung, kein neuer Vorab-Cache-Eintrag.

### 6.6 Prüfliste fürs Gerät (iPhone und iPad)

- Zieltakt per Tipp auf eine Pause treffen; − / + in der Leiste.
- Vorlauf: ein Takt Klavier + Klick, Einsatz am Zieltakt sitzt (Vergleich:
  „Alle meine Entchen“ in zwei Abschnitten à vier Takte, zweiter
  Abschnitt ohne verschobene Einsätze).
- Lautsprecher an: Klavier des Vorlaufs taucht nicht als Noten im
  Vorschlag auf (der Vorlauf endet vor `t0`, aber Nachhall + Latenz).
- ■ → Vorschau; Einfügen ↔ Ersetzen umschalten, Lesart umschalten, − / +;
  ↻ Nochmal; Übernehmen; ↶ holt den ganzen Abschnitt zurück.
- Zweite Stimme: Einfügen schiebt dort leere Takte ein; Ersetzen lässt
  sie in Ruhe; „Begleitung weiter“ mit Kopfhörer.
- App-Wechsel im Lauf → Prüfen-Zustand mit Spur.
- Speichern: Stellen bleiben auf ihrer Seite, Titel bleibt, PDF stimmt.
