# Datenmodell (Gerätespeicher)

Stand 2026-10-13 · **Umgesetzt** (A-02), zusammengeführt mit Marlons
Sammlungen, Tags, Tonprofil und „neuer gewinnt“ (Regeln dort gelten). Entschieden (Leon, 2026-10-12):
neue Datenbank `cheatsheet` mit dem Stück als Grundbegriff, virtuelle
Stücke teilen Stellen und Anmerkungen mit der Quelle, Hinweis auf `ueben`
in der leeren Bibliothek, die Sicherung trägt zusätzlich Lesezeichen,
Merker, Setlisten und virtuelle Stücke. Keine offenen Fragen mehr.
Ergänzt (2026-10-13): **Übernahme direkt aus `ueben`**, nur lesend — der
Umstieg hängt nicht mehr an einer Sicherung, die vor dem Update erstellt
sein muss (siehe Umstieg).

Kurz: Die App bekommt eine **neue Datenbank `cheatsheet`** mit eigenem
Schema. Die alte Datenbank `ueben` wird nicht umgebaut, sondern bleibt
unangetastet liegen. Die Daten kommen per Knopf „Übernehmen“ herüber: Die
App liest `ueben` (nur lesend) und spielt den Inhalt ein wie eine
Sicherung. Eine Sicherung (.uebe) vor dem Update bleibt als zweiter Weg
und als Schutz.

## Warum neu statt umbauen

- **Freie Namen und Strukturen.** Ein Umbau von `ueben` müsste im Upgrade
  passieren. Diese Transaktion kann nichts Asynchrones abwarten, alte
  Blob-Stücke ließen sich darin nicht in Bytes umwandeln. Eine neue
  Datenbank braucht keinen Umbau.
- **Kein Ballast.** Blob-Felder in Datensätzen, der Umzug je Stück beim
  Lesen und die Spuren der Registerführer-App fallen weg.
- **Rückfall.** `ueben` bleibt vollständig erhalten. Fehlt nach dem Umstieg
  etwas, ist der alte Bestand noch auf dem Gerät.
- **Ein Einspielen für beides.** Den `.uebe`-Import braucht es ohnehin
  (Vertrag mit `registerfuehrer`, „Daten übertragen“). Die Übernahme aus
  `ueben` liest nur und gibt den Inhalt an genau dieses Einspielen
  (`planen` und `sicherungSchreiben` in `lokal.ts`) — dieselben Regeln,
  dieselben Tests. Ursprünglich war die Sicherung der einzige Weg; dann
  hätte ein Gerät, das die neue Fassung vor der Sicherung bekommt (der
  Service Worker aktualisiert von selbst), seine Daten nur über ein
  Zurückrollen des Deployments erreicht.

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
  blaettern?: { modus: Blaettermodus; linien: Record<number, number>; jeSeite?: Record<number, Blaettermodus> };
                                          // modus für alle Seiten, jeSeite weicht ab (F-16)
  ausschnitte?: Record<number, Rechteck>; // angezeigter Bereich je Seite
  // F-05 Sprünge, in der Reihenfolge, in der gesprungen wird (nr ab 1; ältere
  // Stände ohne nr: Reihenfolge wie gespielt, src/domain/spielfolge.ts); x, y in Anteilen der Seite
  spruenge?: { id: string; von: { seite: number; x: number; y: number }; nach: { seite: number; x: number; y: number }; art: 'wdh' | 'ds' | 'dc' | 'coda'; nr: number }[];
  groesse?: number;                       // Bytes der PDF (Doppelte beim Ordner-Import)
  geaendert?: number;                     // letzte Änderung: beim Laden gilt der neuere Stand
  sammlungen?: string[];                  // F-13: Namen
  tags?: string[];                        // F-14: ids der Tag-Definitionen (localStorage)
  // F-01 Metadaten, alle optional
  komponist?: string;
  genre?: string;
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
- **Grabsteine:** Jedes Löschen (Stück, auch virtuell; Stelle; Lesezeichen;
  Merker; Setliste) hinterlässt einen Grabstein im localStorage
  (`ueben:geloescht`). Er reist mit der Sicherung, damit Gelöschtes nicht
  zurückkehrt (siehe unten). Jede Änderung setzt `geaendert`; Anmerkungen
  merken sich wegradierte Striche in `entfernt`. Radiert man nur ein Stück
  eines Strichs weg (E-07), ersetzen ihn die übrigen Stücke mit neuen ids —
  die alte id landet ebenso in `entfernt`, eine Sicherung bringt den ganzen
  Strich also nicht zurück.
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
- **Ebenfalls im localStorage, aber Daten** (Entscheidung Marlon, reisen im
  Kopf der Sicherung mit): Tag-Definitionen (`ueben:tags`), Tonprofile
  (`ueben:tonprofile`), Grabsteine (`ueben:geloescht`). Dazu der Zeitpunkt
  der letzten Sicherung (`ueben:letzte-sicherung`). Ein Umzug in die
  Datenbank wäre ein eigener Versionssprung.

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

Beim Erstellen gilt dieselbe Übersetzung rückwärts. Metadaten, Sammlungen,
Tags, Ausschnitte, `geaendert`, `entfernt` und `groesse` reisen als zusätzliche Felder
mit, das kann v1 schon heute. Im Kopf stehen außerdem `geloescht`
(Grabsteine), `tags` (Tag-Definitionen) und `tonprofile`.

Beim Laden auf ein Gerät mit Daten (`src/domain/einspielen.ts`, Regeln von
Marlon): Bei gleicher id gilt der **neuere Stand** (`geaendert`);
Tempo-Verläufe und Striche werden vereinigt, Wegradiertes bleibt weg; die
PDF kommt nur, wenn sie dort nicht älter ist. Was auf dem anderen Gerät
gelöscht und hier seitdem unverändert ist, wird hier gelöscht; was hier
gelöscht wurde, legt eine ältere Sicherung nicht wieder an.

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

Die vier neuen Listen tragen die Einträge **so, wie sie im Gerätespeicher
liegen** (`stueckId`). Übersetzt werden nur die drei alten Listen
(`src/domain/uebersetzen.ts`), weil ihr Zuschnitt Vertrag ist.

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

- Gleiche `id` auf dem Gerät: der neuere Stand gewinnt, wie bei Noten und
  Stellen. Bei Setlisten gilt das für die ganze Liste samt Reihenfolge,
  Einträge werden nicht gemischt.
- Grabsteine gelten auch hier (Arten `lesezeichen`, `merker`, `setliste`;
  virtuelle Stücke als `noten`). Löscht die Sicherung ein Stück, nimmt es
  hier alles mit, was daran hängt (virtuelle Stücke, Lesezeichen, Merker,
  Setlisten-Einträge).
- Ein virtuelles Stück, dessen Quelle weder in der Datei noch auf dem Gerät
  liegt, wird übersprungen und gezählt (wie heute unlesbare Noten).
- Lesezeichen, Merker und Setlisten-Einträge, die auf ein Stück zeigen,
  das es danach nicht gibt, werden weggelassen und gezählt. Eine
  Setliste selbst bleibt immer, notfalls leer.

## Umstieg

1. **Vorher, als Schutz:** auf jedem Gerät mit Daten mit der alten Fassung
   eine Sicherung erstellen und aufheben. Nötig ist sie für den Umstieg
   nicht mehr, aber sie ist der einzige Schutz, falls etwas schiefgeht
   (oder Safari den Speicher räumt).
2. Nach dem Update ist die Bibliothek leer. Liegt auf dem Gerät noch
   `ueben`, steht dort ein Hinweis mit dem Knopf **„Übernehmen“** (siehe
   unten); dasselbe gibt es in den Einstellungen unter „Daten übertragen“,
   solange `ueben` da ist.
3. „Übernehmen“ liest `ueben` und spielt alles ein wie eine Sicherung:
   Stücke samt PDF, Stellen, Anmerkungen. Zweimal übernehmen schadet
   nicht (gleiche ids, neuerer Stand gewinnt, hier Gelöschtes kommt nicht
   wieder).
4. `ueben` bleibt auf dem Gerät. Gelöscht wird sie frühestens, wenn der
   Umstieg sich bewährt hat, und dann als eigener Roadmap-Punkt.

### Übernahme aus `ueben` (nur lesend)

- **Erkennen** nur über `indexedDB.databases()`, **nie** über ein
  blindes `indexedDB.open('ueben')`: Das würde eine leere `ueben` anlegen,
  wo keine war. Kennt der Browser `databases()` nicht, gibt es keinen
  Knopf — dann bleibt der Weg über eine Sicherung.
- **Öffnen** ohne Versionsangabe (kein Umbau) und lesen in einer
  `readonly`-Transaktion. Verschwindet `ueben` genau zwischen Nachfrage und
  Öffnen, bricht das Anlegen ab (getestet).
- **PDF:** aus `dateien` (Schema 3) oder, bei älteren Stücken, aus dem
  Blob im Datensatz (`dateiQuelle` in `src/domain/vorgaenger.ts`). Ist
  keine lesbar, kommt das Stück trotzdem, samt Stellen und Anmerkungen,
  nur ohne Datei; die Meldung nennt es, die Datei lässt sich neu wählen.
  (Eine Sicherung ließe solche Stücke samt Stellen draußen.)
- **Kaputte Einträge** fallen weg und werden gezählt (`nurGueltige` in
  `src/domain/einspielen.ts`), statt die ganze Übernahme aufzuhalten.
- **Dateiverweise** (`handle`, Chrome/Edge am Rechner) gehören zu diesem
  Gerät und kommen mit — anders als über die Sicherung.
- Im Browser (Chromium) einmal durchgespielt: Schema 3 mit Bytes-Stück und
  altem Blob-Stück, danach ist `ueben` unverändert.

### Was beim Umstieg verloren geht

Über „Übernehmen“: nichts aus der Datenbank. Über eine Sicherung: die
Dateiverweise (`handle`) und Stücke ohne lesbare PDF samt ihren Stellen.
„Zuletzt geöffnet“, Tags, Tonprofile, Grabsteine und alle Einstellungen
bleiben ohnehin, weil sie im localStorage liegen.

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
8. **Hinweis und Übernahme:** erscheint nur bei vorhandener `ueben`; die
   Prüfung legt keine Datenbank an. Übernahme aus Schema 1, 2 und 3,
   ältere Blob-Stücke, Stück ohne lesbare PDF, Dateiverweis, zweimal
   übernehmen, kaputter Eintrag — danach ist `ueben` bytegleich.
9. **Echte Daten:** Marlons Export lokal gegen die Übersetzung laufen
   lassen. Die Datei liegt **außerhalb des Repos** (öffentlich), der Test
   läuft nur, wenn ihr Pfad gesetzt ist.
10. **Gerät:** `fake-indexeddb` ist nicht Safari. In Chromium ist die
   Übernahme durchgespielt; auf dem iPhone noch einmal, bevor Marlon den
   Umstieg macht.

## Regeln, die sich ändern (CLAUDE.md)

- „IndexedDB `ueben`, Version 3 … Der Name `ueben` bleibt (Vertrag)“
  wird zu: IndexedDB `cheatsheet` (Schema hier). `ueben` ist die
  Vorgängerin, bleibt liegen und wird nur für „Übernehmen“ gelesen.
- „Schema nur per Versionssprung ändern, nie Daten verwerfen“ gilt ab dann
  für `cheatsheet`, mit Migrationstest.
- „Ältere Stücke tragen noch einen Blob in `noten`“ entfällt.
- Der `.uebe`-Vertrag bleibt Version 1, erweitert um die vier optionalen
  Listen im Kopf (`src/domain/sicherung.ts` beschreibt sie). Dateien ohne
  sie müssen ladbar bleiben.
