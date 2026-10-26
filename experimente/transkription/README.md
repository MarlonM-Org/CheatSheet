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

## Monophone Lesart (zweiter Versuch, 26.10.2026)

Basic Pitch liefert auf den Stems eines ganzen Songs zu viele Noten (The
Unforgiven II: 4215 „Gitarrennoten", Gesang und Bass kaum lesbar). Für
Stimmen, die ohnehin nur einen Ton zur Zeit spielen, gibt es deshalb
`monophon.py`: pYIN verfolgt die eine stärkste Tonhöhe, Hysterese hält Töne
trotz Vibrato zusammen, kurze Aussetzer werden überbrückt, gleiche Töne
hintereinander nur dann getrennt, wenn ein Anschlag dazwischen liegt. Dann
Rundung auf ein Sechzehntelraster bei bekanntem Tempo.

```powershell
$o = "ergebnis\Metallica - The Unforgiven II"
.venv\Scripts\python monophon.py "$o\stem-vocals.wav" --tempo 66 --schlagzeug "$o\stem-drums.wav" --sicher 0.15 --ziel "$o\monophon\gesang-mono.mid"
.venv\Scripts\python monophon.py "$o\stem-bass.wav" --tempo 66 --von 30 --bis 200 --sicher 0 --mindest 100 --programm 33 --name Bass --ziel "$o\monophon\bass-mono.mid"
```

Ergebnis an The Unforgiven II: Bass 318 statt 1821 Noten, die Intro-Linie
G#–B–F#–D# als Halbe sauber erkannt. Gesang 262 statt 1227 Noten, viele
Sechzehntel-Silben in enger Lage, Bewertung in MuseScore offen
(`monophon/vergleich.mid` enthält beide Lesarten nebeneinander). Das Tempo
muss stimmen, sonst stimmt das Raster nicht; `--schlagzeug` bestimmt die Lage
des ersten Schlags.

Für eingesungene Einzelstimmen (ohne Demucs) direkt die Aufnahme angeben:
`monophon.py aufnahme.wav --tempo 96`. Am besten zum Metronom singen, dann
ist das Tempo bekannt und `--versatz 0`.

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

Ergebnis mit den heutigen Standardwerten (Anschlag 0.18, Senke aus):

| Material | getroffen | Dauer passend | überzählig |
|---|---|---|---|
| Klavier-Rendering | 27/27 | 27 | 0 |
| eigene Aufnahme (8 Takte, also 22 Noten möglich) | 19/22 | 12 | 4 |
| MuseScore-Gesangsklang | 25/27 | 11 | 34 |

Der MuseScore-Gesangsklang gleitet zwischen den Tönen und hat ein starkes
Tremolo, das als Anschläge gelesen wird; als Referenz taugt das Klavier,
realistischer ist die eigene Stimme. Was bei echter Stimme noch fehlt: ein
zu tief gesungenes F wird zum E (Tonart-Korrektur greift erst nach der
Segmentierung), und einzelne Wiederholungen ohne hörbaren Neuansatz
verschmelzen. Die Senken-Regel (`--senke`) hat im Abgleich mehr gekostet als
gebracht und ist deshalb aus.

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
