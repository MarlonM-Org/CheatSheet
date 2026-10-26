# Experiment: Song → Noten (Roadmap G-06 / G-08)

Prüfstand, kein Teil der App. Beantwortet eine Frage: **Hilft der
automatische Entwurf oder frustriert er?** Erst danach wird entschieden, ob
ein eigenes Werkzeug gebaut wird. Alles läuft auf dem eigenen Rechner,
nichts wird hochgeladen.

Pipeline: Demucs trennt den Song in Stimmen (Gesang, Bass, Schlagzeug,
Gitarre, Klavier, Rest) → Tempo aus dem Schlagzeug → Basic Pitch macht aus
jeder Stimme MIDI → eine mehrspurige MIDI-Datei → MusicXML (music21).

## Einrichten (einmalig, ca. 10 Minuten, ca. 3 GB)

Python **3.11** ist Pflicht: Basic Pitch hängt an TensorFlow < 2.15.1, das es
für neuere Python-Versionen nicht gibt.

```bash
cd experimente/transkription
python3.11 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install demucs basic-pitch music21 librosa
```

Mac mit Apple Silicon: `pip install demucs basic-pitch[coreml] music21 librosa`
und später `--geraet mps`. Nvidia-Karte: `--geraet cuda` (Torch mit CUDA
installieren, siehe pytorch.org). Beim ersten Lauf lädt Demucs das Modell
(ca. 80 MB) nach `~/.cache`.

## Ausprobieren

```bash
python transkribieren.py "Metallica - Nothing Else Matters.mp3"
python transkribieren.py song.mp3 --geraet cuda --modell htdemucs_ft   # genauer, ohne Gitarre/Klavier
python transkribieren.py gesang.wav --ohne-trennung --tempo 96         # eine Stimme
```

Dauer am Laptop (CPU): Demucs 3–8 Minuten je Song, Basic Pitch unter einer
Minute je Stimme. Mit Grafikkarte: Sekunden.

Ergebnis in `ergebnis/<songname>/`:

| Datei | Inhalt |
|---|---|
| `stem-*.wav` | die getrennten Stimmen — zum Anhören, lohnt sich |
| `vocals.mid`, `bass.mid`, … | je Stimme ein MIDI |
| `gesamt.mid` | alle Stimmen, Tempo gesetzt |
| `gesamt.musicxml` | dasselbe als Notation |

## Ehrlich bewerten

In **MuseScore** (kostenlos) `gesamt.musicxml` öffnen, oder `gesamt.mid`
importieren (MuseScore quantisiert beim Import selbst und oft besser als
music21 — beides probieren). Dann je Stimme fragen:

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

## Schalter zum Spielen

Die Tabelle `STIMMEN` oben im Skript: Frequenzgrenzen und Mindestlänge je
Stimme. Enger (Bass bis 400 Hz) heißt weniger Geisternoten, weiter heißt
mehr Treffer. `onset_threshold`/`frame_threshold` in `noten_erkennen`:
höher = weniger, aber sicherere Noten.
