# Experiment: Song → Noten (Roadmap G-06 / G-08)

Prüfstand, kein Teil der App. Beantwortet eine Frage: **Hilft der
automatische Entwurf oder frustriert er?** Erst danach wird entschieden, ob
ein eigenes Werkzeug gebaut wird. Alles läuft auf dem eigenen Rechner,
nichts wird hochgeladen.

Pipeline: Demucs trennt den Song in Stimmen (Gesang, Bass, Schlagzeug,
Gitarre, Klavier, Rest) → Tempo aus dem Schlagzeug → Basic Pitch macht aus
jeder Stimme MIDI → eine mehrspurige MIDI-Datei → MusicXML (music21).

## Einrichten (einmalig, ca. 10 Minuten, ca. 3 GB)

Python **3.11** ist Pflicht: Basic Pitch hängt an TensorFlow 2.14, das es
für neuere Python-Versionen nicht gibt. Und TensorFlow 2.14 braucht
**NumPy < 2**, deshalb steht das in `requirements.txt` fest.

**Windows (so eingerichtet am 26.10.2026, läuft):** Python 3.11 muss nicht
systemweit installiert sein, `uv` lädt es selbst.

```powershell
winget install astral-sh.uv
winget install Gyan.FFmpeg          # mp3 lesen; neue Shell öffnen, damit der PATH stimmt
cd experimente\transkription
uv venv --python 3.11 .venv
uv pip install --python .venv -r requirements.txt
```

**Mac / Linux:**

```bash
cd experimente/transkription
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Mac mit Apple Silicon: zusätzlich `pip install basic-pitch[coreml]` und
später `--geraet mps`. Nvidia-Karte: `--geraet cuda` setzt ein Torch mit
CUDA voraus (`uv pip install --python .venv torch torchaudio --index-url
https://download.pytorch.org/whl/cu124`); das Standard-Torch ist CPU-only.
Beim ersten Lauf lädt Demucs das Modell (ca. 80 MB) nach `~/.cache`.

**Optional, HF-Token:** Demucs holt das Modell vom Hugging-Face-Hub und
warnt ohne Anmeldung (`unauthenticated requests to the HF Hub`). Das ist
harmlos, nach dem ersten Lauf kommt alles aus dem Cache. Wer die Warnung
loswerden will: auf <https://huggingface.co/settings/tokens> einen Token
mit Rolle *Read* anlegen, dann einmalig

```powershell
.venv\Scripts\hf.exe auth login      # Mac/Linux: .venv/bin/hf auth login
```

Der Token landet in `~/.cache/huggingface/token` und wird automatisch
benutzt. Nicht in `lauf.cmd` oder ins Repo schreiben.

## Ausprobieren

Audio-Datei in diesen Ordner legen (mp3, wav, flac, m4a). Audio, `ergebnis/`
und `.venv/` stehen in `.gitignore` und landen nicht im Repo.

**Windows:** `lauf.cmd` doppelklicken (fragt nach der Datei) oder im
Terminal:

```powershell
.\lauf.cmd "Song.mp3"
.\lauf.cmd "Gesang.wav" --ohne-trennung --tempo 96
```

`lauf.cmd` setzt ffmpeg in den PATH, unterdrückt das TensorFlow-Geplapper
und lässt das Fenster am Ende offen.

**Direkt:**

```bash
python transkribieren.py "Song.mp3"
python transkribieren.py song.mp3 --geraet cuda --modell htdemucs_ft   # genauer, ohne Gitarre/Klavier
python transkribieren.py gesang.wav --ohne-trennung --tempo 96         # eine Stimme
python transkribieren.py song.mp3 --nur-zusammenfuehren --tempo 66     # nur gesamt.mid neu bauen, ohne Neuberechnung
```

`--nur-zusammenfuehren` nimmt die vorhandenen `<stimme>.mid` aus dem
Ergebnisordner und baut daraus in Sekunden ein neues `gesamt.mid`. So lassen
sich Tempo, Instrumente und Reihenfolge ändern, ohne Demucs und Basic Pitch
noch einmal laufen zu lassen. Die Tempo-Schätzung verdoppelt bei langsamen
Songs gern (The Unforgiven II: geschätzt 132,5 statt 66 bpm), dann mit
`--tempo` nachhelfen.

Dauer auf CPU (Ryzen-Desktop, 26.10.2026): 35-Sekunden-Stück komplett in
etwa einer Minute; Demucs braucht rund die Hälfte der Songlänge, Basic
Pitch wenige Sekunden je Stimme. Mit Grafikkarte: Sekunden.

Ergebnis in `ergebnis/<songname>/`:

| Datei | Inhalt |
|---|---|
| `stem-*.wav` | die getrennten Stimmen — zum Anhören, lohnt sich |
| `vocals.mid`, `bass.mid`, … | je Stimme ein MIDI |
| `gesamt.mid` | alle Stimmen, Tempo gesetzt |
| `gesamt.musicxml` | dasselbe als Notation |

## Ehrlich bewerten

In **MuseScore** (kostenlos) `gesamt.mid` öffnen. MuseScore quantisiert
beim Import selbst, das Import-Panel oben erlaubt Raster und Stimmen zu
wählen. **Achtung:** `gesamt.musicxml` aus music21 bringt MuseScore Studio
4.7.6 unter Windows zum Absturz (Access Violation, bei beiden Testsongs,
26.10.2026). Ursache offen, bis dahin MIDI nehmen. Dann je Stimme fragen:

- **Gesang:** stimmt die Melodie in Tonhöhe und Rhythmus? Oktavsprünge?
  Vibrato als Notenwolke?
- **Bass:** meist die beste Spur — spielbar?
- **Gitarre:** Riffs erkennbar? Powerchords als Cluster? Verzerrung → Müll?
- **Rest:** was landet da, und ist es verwertbar?
- **Takt:** sitzt das Tempo, liegt die Eins richtig? Wenn nicht, mit
  `--tempo` nachhelfen und noch einmal schauen.

Maßstab: *Wäre es schneller, das von Hand zu schreiben, als das hier zu
korrigieren?* Lautet die Antwort für Gesang und Bass „nein“, lohnt sich
ein Werkzeug (G-08, Variante 2). Lautet sie überall „ja“, bleibt G-06 eine
Vision.

Zum Vergleich denselben Song durch **Moises** (Stems, Akkorde) und
**Klangio** (Sing2Notes, Guitar2Tabs) schicken. Reicht ein fertiges Produkt,
braucht CheatSheet nur den MusicXML-Import aus G-01.

## Monophone Lesart (`monophon.py`)

Basic Pitch liefert auf den Stems eines ganzen Songs zu viele Noten (The
Unforgiven II: 4215 „Gitarrennoten", Gesang und Bass kaum lesbar). Für
Stimmen, die ohnehin nur einen Ton zur Zeit spielen, gibt es deshalb
`monophon.py`. Der zweite Versuch (26.10.) arbeitete mit einer Hysterese je
Rahmen, Anschlag-Splits und unabhängiger Rundung von Anfang und Ende — und
zerlegte gehaltene Töne in „Sechzehntel + Sechzehntelpause". Die Recherche
dazu steht in `reports/Gesang zu Noten transkribieren.md`; der dritte Versuch
(27.10.2026) setzt sie um:

1. **Noten-HMM aus pYIN/Tony** statt Hysterese: je Drittel-Halbton die
   Zustände Ansatz, Halten, Stille, Viterbi über die ganze Aufnahme, Parameter
   1:1 aus `MonoNoteParameters.cpp` (auf unseren Rahmenabstand umgerechnet).
   Ein Notenwechsel kostet ~10⁶-mal mehr als das Weiterlaufen — Vibrato,
   Drift und kurze Aussetzer kippen eine Note nicht mehr. `librosa.pyin`
   enthält nur das Tonhöhen-HMM, dieser Schritt fehlte bisher ganz.
2. **Tonwechsel-Teilung**: Das HMM ist träge und zieht eine kurze Achtel gern
   mit dem Halbton daneben zusammen (Tonys bekannte Schwäche). Ein Bereich
   wird geteilt, wenn der Median der nächsten ~150 ms (eine Vibratoperiode)
   um ≥ 0,7 Halbton vom bisherigen Plateau abweicht — ohne die ersten 60 ms
   jeder Note (Einschleifen).
3. **Anschläge nur zum Trennen gleicher Töne** („schwim-men auf dem"):
   Pegelanstieg ≥ 4 dB binnen 25 ms, höchstens einer je 90 ms. Kein
   Spektralfluss-Onset-Detektor mehr als allgemeiner Trenner. Dazu seit dem
   27.10. abends **Silbengrenzen aus dem Mittenband**: Ein weich gesungenes
   „la la la" ohne Absetzen senkt den Gesamtpegel nur um 1–2 dB, das Band
   600–1500 Hz (zweiter Formant) am „l" aber um 15–25 dB — gemessen an einer
   echten Aufnahme von Marlon, in der vier weiche „la" eine 2,3-s-Note
   geworden waren. Ein Einbruch ≥ 10 dB (`--senke`) gegen die letzten 150 ms
   und die nächsten 80 ms gilt als Silbengrenze; die Note beginnt, wo das
   Band wieder steigt (Vokalbeginn). Mit 6, 8, 10 und 12 dB fand der
   Detektor in der Aufnahme dieselben sieben Grenzen.
4. **Mindestdauer 100 ms**, gleiche Töne über Lücken ≤ 130 ms verbinden,
   wenn kein Anschlag in der Lücke liegt; Tonhöhe = Median ohne den Ansatz.
5. **Legato-Regel beim Rastern**: Nur die Einsätze werden gerundet, und zwar
   gemeinsam (dynamische Programmierung mit Vorliebe für Schlag und Achtel,
   zwei Einsätze teilen sich nie eine Zelle). Jede Note dauert bis zum
   nächsten Einsatz; eine Pause entsteht nur, wenn die Stille davor mindestens
   `--pause` lang ist (Standard: ein Achtel, mindestens 150 ms). So macht es
   auch Klangios offener Gesangscode (Offset = nächster Onset).

```powershell
.venv\Scripts\python monophon.py aufnahme.wav --tempo 90 --versatz auto --tonart C
.venv\Scripts\python monophon.py aufnahme.wav --tempo 120 --raster 8          # nur Achtel
$o = "ergebnis\Metallica - The Unforgiven II"
.venv\Scripts\python monophon.py "$o\stem-vocals.wav" --tempo 66 --schlagzeug "$o\stem-drums.wav" --ziel "$o\monophon\gesang-mono.mid"
.venv\Scripts\python monophon.py "$o\stem-bass.wav" --tempo 66 --von 30 --bis 200 --programm 33 --name Bass --ziel "$o\monophon\bass-mono.mid"
```

Schalter: `--lesart rhythmisch` (kurze Töne, Tonwiederholungen: Schwellen
folgen der Rasterzelle, siehe `Parameter.rhythmisch()`; Messung in
`reports/Rhythmische Melodien erkennen.md`), `--mindest` (ms), `--luecke` (ms), `--anschlag` (dB, 0 = aus),
`--pause` (s), `--ansatz` (ms), `--leise` (dB unter Maximum), `--tonart`,
`--versatz auto|<s>`, `--schlagzeug`. Das Tempo muss stimmen, sonst stimmt das
Raster nicht. Wer stark in die Töne schleift (mehr als zwei Halbtöne von
unten), bekommt noch vereinzelt Sechzehntel-Vorschläge vor der Note — die
sind im Editor schneller gelöscht als zehn Pausen.

### Prüfstand ohne Mikrofon: `pruefen.py`

`pruefen.py` erzeugt eine künstliche Laienstimme (Obertöne, Vibrato 45 Cent
über die Halbtongrenze, Drift, Einschleifen von unten, Konsonanten als
Rauschstöße mit Pegeleinbruch, Tremolo, 7-dB-Einbruch in langen Tönen) und
lässt sechs Fälle durch die ganze Kette: Halteton, „Alle meine Entchen" (mit
und ohne Tonart-Korrektur), Achtelphrase mit echten Pausen bei 120 bpm,
„Alle meine Entchen" weich ohne Absetzen (das „l" dämpft nur die Obertöne),
Legato ohne Konsonanten. Erwartung: jede Note getroffen, jede Dauer passend,
nichts überzählig.

```powershell
.venv\Scripts\python pruefen.py          # ca. 30 s auf der CPU
.venv\Scripts\python pruefen.py --wav    # legt die Signale in aufnahmen\pruef-*.wav ab
```

Stand 27.10.2026: alle sechs Fälle bestanden; „Alle meine Entchen" mit vier
Zufallsseeds und normaler Stimme 27/27 Noten, 27 Dauern, 0 überzählig (der
zweite Versuch kam mit eigener Stimme auf 19/22). Extremstimme (70 Cent
Vibrato, 3 Halbtöne Einschleifen): 27/27 getroffen, 2–3 überzählige
Sechzehntel. Das ist ein synthetischer Maßstab; die echte Stimme entscheidet
(`singen.cmd`, dann `vergleichen.py`).

## Einsingen zum Metronom (Windows)

`singen.cmd` spielt den Klick in den Kopfhörer, nimmt gleichzeitig das
Mikrofon auf, transkribiert und öffnet das Ergebnis in MuseScore:

```powershell
.\singen.cmd            # 90 bpm, 8 Takte
.\singen.cmd 90 8 C     # Tempo, Takte, Tonart (Töne auf die Leiter ziehen)
```

Enter drücken, vier Klicks Vorzähler, auf die Eins einsetzen. Aufnahmen
landen in `aufnahmen/` (nicht im Repo). Latenz wird automatisch aus den
Noteneinsätzen geschätzt (`--versatz auto`), Tonart und Taktart stehen in der
MusicXML, MuseScore muss nichts mehr raten.

## Referenz-Abgleich (26.10.2026)

`referenz/alle_meine_entchen.py` erzeugt „Alle meine Entchen" (C-Dur, 4/4,
90 bpm, 27 Noten) als MusicXML, einmal als Gesang, einmal als Klavier. Über
die MuseScore-Kommandozeile wird daraus Audio, das durch `monophon.py` läuft;
`vergleichen.py` hält das Ergebnis Note für Note gegen die Partitur:

```powershell
& "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" -o referenz\alle-meine-entchen-klavier.wav referenz\alle-meine-entchen-klavier.musicxml
.venv\Scripts\python monophon.py referenz\alle-meine-entchen-klavier.wav --tempo 90 --versatz 0 --ziel referenz\ergebnis\klavier.mid
.venv\Scripts\python vergleichen.py referenz\alle-meine-entchen.musicxml referenz\ergebnis\klavier.mid --tempo 90
.venv\Scripts\python vergleichen.py referenz\alle-meine-entchen.musicxml aufnahmen\<aufnahme>-mono.mid --tempo 90 --oktave -1
```

Ergebnis des zweiten Versuchs (26.10., Hysterese + Spektralfluss-Onsets):

| Material | getroffen | Dauer passend | überzählig |
|---|---|---|---|
| Klavier-Rendering | 27/27 | 27 | 0 |
| eigene Aufnahme (8 Takte, also 22 Noten möglich) | 19/22 | 12 | 4 |
| MuseScore-Gesangsklang | 25/27 | 11 | 34 |

Der MuseScore-Gesangsklang gleitet zwischen den Tönen und hat ein starkes
Tremolo, das als Anschläge gelesen wird; als Referenz taugt das Klavier,
realistischer ist die eigene Stimme. Die Schwächen von damals (zu tief
gesungenes F wird zum E, Wiederholungen ohne Neuansatz verschmelzen, lange
Töne zerfallen) adressiert der dritte Versuch, siehe oben; der Abgleich mit
der eigenen Stimme steht noch aus.

**MusicXML aus `monophon.py` öffnet MuseScore stabil.** Der Absturz betrifft
nur die music21-Konvertierung aus MIDI in `transkribieren.py`.

## Schalter zum Spielen

Die Tabelle `STIMMEN` oben im Skript: Frequenzgrenzen und Mindestlänge je
Stimme. Enger (Bass bis 400 Hz) heißt weniger Geisternoten, weiter heißt
mehr Treffer. `onset_threshold`/`frame_threshold` in `noten_erkennen`:
höher = weniger, aber sicherere Noten.

`programm` in `STIMMEN` ist die General-MIDI-Nummer und bestimmt, welches
Instrument MuseScore beim Import anlegt (Gesang → Altsaxophon, weil General
MIDI keine Solostimme hat; Rest → E-Piano). `REIHENFOLGE` legt die Reihenfolge
der Spuren in der Partitur fest: Melodie oben, Bass unten. Nach Änderungen
reicht `--nur-zusammenfuehren`.
