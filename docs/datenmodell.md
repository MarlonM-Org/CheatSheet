# Datenmodell (Gerätespeicher)

Stand 2026-10-12 · **Entwurf** für A-02. Entschieden (Leon, 2026-10-12):
neue Datenbank `cheatsheet` mit dem Stück als Grundbegriff, virtuelle
Stücke teilen Stellen und Anmerkungen mit der Quelle, Hinweis auf `ueben`
in der leeren Bibliothek, die Sicherung trägt zusätzlich Lesezeichen,
Merker, Setlisten und virtuelle Stücke. Keine offenen Fragen mehr.

Kurz: Die App bekommt eine **neue Datenbank `cheatsheet`** mit eigenem
Schema. Die alte Datenbank `ueben` wird nicht umgebaut, sondern bleibt
unangetastet liegen. Die Daten kommen über die **Sicherung (.uebe)**
herüber: Marlon, der einzige Nutzer mit Daten, erstellt sie direkt vor dem
Umstieg und lädt sie in der neuen Fassung.

## Warum neu statt umbauen

- **Freie Namen und Strukturen.** Ein Umbau von `ueben` müsste im Upgrade
  passieren. Diese Transaktion kann nichts Asynchrones abwarten, alte
  Blob-Stücke ließen sich darin nicht in Bytes umwandeln. Eine neue
  Datenbank braucht keinen Umbau.
- **Kein Ballast.** Blob-Felder in Datensätzen, der Umzug je Stück beim
  Lesen und die Spuren der Registerführer-App fallen weg.
- **Rückfall.** `ueben` bleibt vollständig erhalten. Fehlt nach dem Umstieg
  etwas, ist der alte Bestand noch auf dem Gerät.
- **Ein Weg statt zwei.** Den `.uebe`-Import braucht es ohnehin (Vertrag mit
  `registerfuehrer`, „Daten übertragen“). Er ist damit der einzige
  Migrationsweg. Eine automatische Übernahme aus `ueben` liefe genau einmal
  und lohnt bei einem Nutzer nicht.

## Neu: IndexedDB `cheatsheet`, Version 1

Name und Version stehen an genau einer Stelle (`lokal.ts`).

Grundbegriff ist das **Stück** (bisher „Noten“): ein Datensatz mit Titel,
Stimme und Metadaten, dazu genau eine PDF. Alles andere hängt über
`stueckId` daran.

| Store | Schlüssel | Index | Inhalt |
|---|---|---|---|
| `stuecke` | `id` (UUID) | — | siehe unten |
| `dateien` | `id` = `stueckId` | — | `daten: ArrayBuffer`, `typ`. Nie ein Blob. |
| `stellen` | `id` (UUID) | `stueckId` | `seite`, `x`, `y`, `b`, `h` (relativ zur Seite), `titel`, `notiz`, `zielTempo: number \| null`, `tempi: { tempo, am }[]` |
| `anmerkungen` | `id` = `<stueckId>:<seite>` | `stueckId` | `seite`, `objekte: Anmerkung[]` (Stift, Marker, Text, Radier-Spur). Ein Datensatz **je Seite**: Speichern schreibt nur die eine Seite. |
| `lesezeichen` | `id` (UUID) | `stueckId` | `seite`, `titel`, `erstellt` (F-03) |
| `merker` | `id` = `<stueckId>:<seite>` | `stueckId` | `seite`, `gesetzt` (F-04, „Flags“). Pro Seite höchstens einer. |
| `setlisten` | `id` (UUID) | — | `titel`, `erstellt`, `aktualisiert`, `eintraege` (F-02, siehe unten) |

### Stück (`stuecke`)

```ts
interface Stueck {
  id: string;
  titel: string;
  stimme: string;
  erstellt: number;
  aktualisiert?: number;
  dateiname?: string;
  handle?: FileSystemFileHandle;          // nur Chrome/Edge am Rechner
  blaettern?: { modus: Blaettermodus; linien: Record<number, number> };
  // F-01 Metadaten, alle optional
  komponist?: string;
  genre?: string;
  tags?: string[];
  tonart?: string;
  schwierigkeit?: 1 | 2 | 3 | 4 | 5;
  kennung?: string;
  // F-03 Ausbaustufe: virtuelles Stück = Seitenbereich eines anderen
  quelle?: { stueckId: string; von: number; bis: number };
}
```

Ein virtuelles Stück hat keinen eigenen Eintrag in `dateien`, es zeigt die
Seiten `von`–`bis` aus der PDF von `quelle.stueckId`.

- **Stellen und Anmerkungen teilt es mit der Quelle.** Eine Seite hat
  überall dieselben Striche und Stellen. Gespeichert wird immer unter der
  Quelle: `stueckId` der Quelle, `seite` als Seite der PDF (nicht als
  Seite im virtuellen Stück). Das virtuelle Stück zeigt die Stellen der
  Quelle im Bereich `von`–`bis`.
- **Die Quelle ist immer ein echtes Stück** mit eigener PDF, nie selbst
  virtuell. Keine Ketten.
- Lesezeichen und Merker gehören zu dem Stück, an dem sie gesetzt wurden.
  Seitenangaben beziehen sich auch hier auf die PDF.

### Setliste (`setlisten`)

Die Einträge liegen im Datensatz der Setliste. Die Reihenfolge ist das
Array, Stücke dürfen mehrfach vorkommen, Umsortieren ist ein `put`.

```ts
type Eintrag =
  | { id: string; art: 'stueck'; stueckId: string }
  | { id: string; art: 'lesezeichen'; lesezeichenId: string }
  | { id: string; art: 'platzhalter'; titel: string };   // „spiele ich auswendig“
```

### Beziehungen und Löschen

- `dateien`, `stellen`, `anmerkungen`, `lesezeichen` und `merker` gehören
  zu einem Stück. `stueckLoeschen` löscht alles davon in **einer**
  Transaktion.
- Einträge in Setlisten, die auf das gelöschte Stück oder seine
  Lesezeichen zeigen, werden **entfernt**, in derselben Transaktion. Nichts
  verschwindet still: Steht das Stück in Setlisten, nennt der Lösch-Dialog
  sie vorher, etwa „‚Pomp‘ löschen? Es steht in 2 Setlisten (Konzert Mai,
  Probe 14.10.) und wird dort entfernt.“ Welche Setlisten betroffen sind,
  ist eine reine Regel in `src/domain/`, getestet. Platzhalter bleiben
  dem gewollten Eintrag vorbehalten („spiele ich auswendig“). Ein Rest
  eines gelöschten Stücks wäre davon nicht zu unterscheiden und bliebe
  liegen, wenn niemand ihn ersetzt.
- Dasselbe gilt für ein einzeln gelöschtes Lesezeichen.
- **Wird die Quelle gelöscht, werden ihre virtuellen Stücke mitgelöscht**,
  samt deren Lesezeichen, Merkern und Setlisten-Einträgen, in derselben
  Transaktion. Der Lösch-Dialog nennt sie mit, etwa „‚Sammelband‘ löschen?
  Damit fallen auch 3 Stücke daraus weg (Marsch, Polka, Choral); 2 davon
  stehen in Setlisten.“
- Ein virtuelles Stück zu löschen, lässt die Quelle und die geteilten
  Stellen und Anmerkungen unberührt.
- Ids bleiben beim Umstieg gleich: Die `id` eines Stücks in `cheatsheet` ist
  die `id` der Noten in `ueben`. Damit gilt `ueben:zuletzt` im localStorage
  weiter.

### Bewusst nicht in der Datenbank

- **Keine Indizes auf Metadaten.** Die Bibliothek lädt ohnehin alle Stücke.
  Suchen, Filtern und Sortieren laufen rein in `src/domain/` und sind dort
  testbar. Für ein paar hundert Stücke reicht das, Indizes kann eine
  spätere Version nachziehen.
- **Keine Einstellungen.** Sie gehören zum Gerät, nicht zu den Daten, und
  das Thema muss `layout.tsx` synchron vor dem ersten Bild lesen. Das kann
  nur localStorage. Die Schlüssel (`ueben:*`, `metro:*`, `stimm:*`)
  bleiben, wie sie sind.

## Sicherung (.uebe)

Das Format bleibt **Version 1**. Es muss Dateien aus `registerfuehrer` und
aus der heutigen CheatSheet-Fassung laden können.

Übersetzung beim Laden (rein, in `src/domain/`):

| .uebe v1 | `cheatsheet` |
|---|---|
| `noten[]` samt PDF-Teil | `stuecke` + `dateien` (Bytes) |
| `notenId` in Stellen und Anmerkungen | `stueckId` |
| Anmerkungs-`id` `<notenId>:<seite>` | `<stueckId>:<seite>`, also unverändert |
| weitere Felder an Noten (Metadaten) | übernommen |
| `handle` | gibt es in der Datei nicht, entfällt |

Beim Erstellen gilt dieselbe Übersetzung rückwärts. Metadaten reisen als
zusätzliche Felder an den Noten mit, das kann v1 schon heute. Die
Zusammenführ-Regeln beim Laden auf ein Gerät mit Daten bleiben
(`src/domain/einspielen.ts`).

### Erweiterung: vier optionale Listen im Kopf

Ohne Erweiterung kämen Lesezeichen, Merker und Setlisten im Format nicht
vor, „Daten übertragen“ würde sie verlieren. Virtuelle Stücke fielen schon
beim Erstellen heraus: Jedes Stück unter `noten` bringt seine eigene PDF
mit, ein virtuelles hat keine und sähe für die Prüfung aus wie ein Stück
mit verlorener PDF.

Deshalb bekommt der Kopf vier **optionale** Listen. Die Version bleibt 1.

| Liste im Kopf | Inhalt | wie im Store |
|---|---|---|
| `virtuelle` | virtuelle Stücke, **ohne PDF-Teil**, mit `quelle` | `stuecke` |
| `lesezeichen` | mit `stueckId` | `lesezeichen` |
| `merker` | mit `stueckId` | `merker` |
| `setlisten` | samt `eintraege` | `setlisten` |

Die PDFs hinter dem Kopf gehören weiter genau zu den Einträgen unter
`noten`, in derselben Reihenfolge. `virtuelle` trägt nichts dazu bei.

Verträglichkeit:

- **Ältere Dateien** (aus `registerfuehrer`, Marlons Export) haben die
  Listen nicht. Fehlt eine, gilt sie als leer. Sie laden wie bisher.
- **Ältere CheatSheet-Fassungen** lesen nur `noten`, `stellen` und
  `anmerkungen` und ignorieren den Rest. Sie laden eine neue Datei ohne
  Fehler, nur eben ohne die vier Listen.
- Ist eine der Listen da, aber kein Array, ist die Sicherung beschädigt
  (wie heute bei den drei alten).

Regeln beim Erstellen:

- Wird ein echtes Stück aussortiert (PDF nicht lesbar), fallen seine
  virtuellen Stücke mit heraus und werden in `fehlen` mit genannt. Ebenso
  die Lesezeichen und Merker der aussortierten Stücke. Setlisten bleiben,
  ihnen fehlen nur diese Einträge.

Regeln beim Laden (rein in `src/domain/einspielen.ts`, wie die
bestehenden):

- Gleiche `id` auf dem Gerät: Die Sicherung gewinnt. Bei Setlisten gilt das
  für die ganze Liste samt Reihenfolge, Einträge werden nicht gemischt.
- Ein virtuelles Stück, dessen Quelle weder in der Datei noch auf dem Gerät
  liegt, wird übersprungen und gezählt (wie heute unlesbare Noten).
- Lesezeichen, Merker und Setlisten-Einträge, die auf ein Stück zeigen,
  das es danach nicht gibt, werden weggelassen und gezählt. Eine
  Setliste selbst bleibt immer, notfalls leer.

## Umstieg

1. Die neue Fassung liest `ueben` nicht mehr und schreibt nie hinein.
2. **Marlon erstellt direkt vor dem Update eine Sicherung**, auf jedem
   Gerät mit eigenen Daten. Was nach der Sicherung noch geändert wird,
   kommt nicht mit.
3. Zeigt die Sicherung beim Erstellen fehlende Stücke an (PDF nicht
   lesbar), diese vorher neu wählen. Sonst bleiben sie samt Stellen und
   Anmerkungen draußen.
4. Nach dem Update ist die Bibliothek leer. Liegt auf dem Gerät noch
   `ueben`, steht dort ein Hinweis (siehe unten). „Sicherung laden“ holt
   alles herüber.
5. `ueben` bleibt auf dem Gerät. Gelöscht wird sie frühestens, wenn der
   Umstieg sich bewährt hat, und dann als eigener Roadmap-Punkt.

### Hinweis in der leeren Bibliothek

Ist die Bibliothek leer und liegt auf dem Gerät noch `ueben`, zeigt sie
einen Satz neben „Sicherung laden“, etwa: „Deine Noten aus der
Vorgängerversion: dort eine Sicherung erstellen und hier laden.“ Nur ein
Hinweis, keine Übernahme. Sobald ein Stück da ist, verschwindet er.

Erkennen nur über `indexedDB.databases()`, **nie** über
`indexedDB.open('ueben')`: Das Öffnen würde eine leere `ueben` anlegen, wo
keine war. Kennt der Browser `databases()` nicht, gibt es keinen Hinweis.

### Was beim Umstieg verloren geht

Nicht im Export und deshalb nach dem Umstieg weg: Dateiverweise (`handle`,
nur Chrome/Edge am Rechner, die Datei lässt sich neu wählen).
„Zuletzt geöffnet“ und alle Einstellungen bleiben, weil sie im
localStorage liegen.

## Absicherung

1. **Verhalten übernehmen:** Die Ist-Tests (`tests/lokal.test.ts`)
   beschreiben, was die Speicherschicht können muss. Sie ziehen auf
   `cheatsheet` um. Weg fallen nur, was es nicht mehr gibt: Upgrades
   v1–v3 und der Umzug alter Blob-Stücke.
2. **Laden der Sicherung:** Testdateien im heutigen Format (gebaut mit
   `sicherungPacken` aus Daten im alten Zuschnitt, auch mit Quelle
   `registerfuehrer`) landen vollständig im neuen Schema:
   - gleiche Anzahl Stücke, Stellen und Anmerkungen
   - jede PDF bytegleich
   - alle Felder übersetzt
3. **Rundlauf:** `cheatsheet` → `.uebe` → leeres Gerät ergibt denselben
   Bestand, samt Metadaten.
4. **`ueben` bleibt unberührt:** Ein Gerät mit befüllter `ueben` (aus den
   eingefrorenen Schemata in `tests/hilfen/geraet.ts`) wird mit der neuen
   Fassung benutzt, danach ist `ueben` bytegleich.
5. **Neue Stores:** Lesezeichen, Merker, Setlisten und die Kaskade beim
   Löschen, zuerst als Test (CLAUDE.md). Dazu: Ein gelöschtes Stück
   verschwindet aus allen Setlisten, andere Einträge bleiben in ihrer
   Reihenfolge, und die Rückfrage nennt genau die betroffenen Setlisten.
6. **Virtuelle Stücke:** Stellen und Anmerkungen aus dem virtuellen Stück
   landen bei der Quelle (Seite der PDF) und erscheinen in beiden; Löschen
   der Quelle nimmt die virtuellen samt Lesezeichen, Merkern und
   Setlisten-Einträgen mit; Löschen eines virtuellen lässt die Quelle
   unberührt; eine virtuelle Quelle wird abgelehnt.
7. **Sicherung, Erweiterung:**
   - Rundlauf mit allen vier Listen ergibt denselben Bestand.
   - Eine Datei ohne die Listen (heutiges Format, `registerfuehrer`) lädt
     wie bisher.
   - Ein Kopf mit `virtuelle: 5` statt Array gilt als beschädigt.
   - Ein aussortiertes Stück nimmt seine virtuellen Stücke, Lesezeichen
     und Merker mit, die Setliste bleibt.
   - Ein virtuelles Stück ohne Quelle wird beim Laden übersprungen.
   - Verwaiste Einträge werden weggelassen.
8. **Hinweis:** erscheint nur bei leerer Bibliothek und vorhandener
   `ueben`; die Prüfung legt keine Datenbank an.
9. **Echte Daten:** Marlons Export lokal gegen die Übersetzung laufen
   lassen. Die Datei liegt **außerhalb des Repos** (öffentlich), der Test
   läuft nur, wenn ihr Pfad gesetzt ist.
10. **Gerät:** `fake-indexeddb` ist nicht Safari. Den Umstieg einmal auf dem
   iPhone durchspielen, bevor Marlon ihn macht.

## Regeln, die sich ändern (CLAUDE.md)

- „IndexedDB `ueben`, Version 3 … Der Name `ueben` bleibt (Vertrag)“
  wird zu: IndexedDB `cheatsheet` (Schema hier). `ueben` ist die
  Vorgängerin, bleibt liegen und wird nicht gelesen.
- „Schema nur per Versionssprung ändern, nie Daten verwerfen“ gilt ab dann
  für `cheatsheet`, mit Migrationstest.
- „Ältere Stücke tragen noch einen Blob in `noten`“ entfällt.
- Der `.uebe`-Vertrag bleibt Version 1, erweitert um die vier optionalen
  Listen im Kopf (`src/domain/sicherung.ts` beschreibt sie). Dateien ohne
  sie müssen ladbar bleiben.
