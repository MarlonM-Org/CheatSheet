#!/usr/bin/env python3
"""Experiment zu Roadmap G-06/G-08: Song-Datei → Stimmen → MIDI → MusicXML.

Läuft auf dem eigenen Rechner, nichts verlässt das Gerät. Kein Teil der
App — nur ein Prüfstand, ob der Entwurf hilft oder frustriert.

    python transkribieren.py song.mp3
    python transkribieren.py song.mp3 --ausgabe ergebnis --geraet cuda
    python transkribieren.py stimme.wav --ohne-trennung     # eine Stimme, z. B. Gesang

Ergebnis in <ausgabe>/<songname>/: Stems (wav), je Stimme eine MIDI-Datei,
gesamt.mid (alle Stimmen, Tempo gesetzt) und gesamt.musicxml.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Je Stem: General-MIDI-Programm, Frequenzgrenzen (Hz) und Mindestlänge (ms).
# Bass eng begrenzen (sonst Obertöne als Noten), Gesang nach oben offen.
STIMMEN = {
    "vocals": dict(programm=52, von=80.0, bis=1200.0, mindest=80, name="Gesang"),
    "bass": dict(programm=33, von=30.0, bis=400.0, mindest=100, name="Bass"),
    "guitar": dict(programm=29, von=70.0, bis=1500.0, mindest=60, name="Gitarre"),
    "piano": dict(programm=0, von=27.0, bis=4200.0, mindest=60, name="Klavier"),
    "other": dict(programm=48, von=60.0, bis=2000.0, mindest=80, name="Rest"),
    "mix": dict(programm=0, von=30.0, bis=4200.0, mindest=60, name="Mix"),
}


def stimmen_trennen(datei: Path, ziel: Path, modell: str, geraet: str) -> dict[str, Path]:
    """Ruft Demucs auf und gibt die Stem-Dateien je Stimme zurück."""
    befehl = [sys.executable, "-m", "demucs", "-n", modell, "-d", geraet, "-o", str(ziel), str(datei)]
    print("→ Stimmen trennen:", " ".join(befehl))
    subprocess.run(befehl, check=True)
    ordner = ziel / modell / datei.stem
    stems = {w.stem: w for w in sorted(ordner.glob("*.wav"))}
    if not stems:
        sys.exit(f"Keine Stems gefunden in {ordner}")
    return stems


def tempo_schaetzen(audio: Path) -> float:
    """Tempo in Schlägen pro Minute, am liebsten aus dem Schlagzeug-Stem."""
    import librosa

    y, sr = librosa.load(audio, sr=None, mono=True)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    wert = float(tempo if not hasattr(tempo, "__len__") else tempo[0])
    print(f"→ Tempo geschätzt: {wert:.1f} bpm (aus {audio.name})")
    return wert


def noten_erkennen(audio: Path, regeln: dict, ziel: Path):
    """Basic Pitch: Audio → pretty_midi.PrettyMIDI mit einer Spur."""
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict

    _, midi, _ = predict(
        str(audio),
        ICASSP_2022_MODEL_PATH,
        onset_threshold=0.5,
        frame_threshold=0.3,
        minimum_note_length=regeln["mindest"],
        minimum_frequency=regeln["von"],
        maximum_frequency=regeln["bis"],
        multiple_pitch_bends=False,
        melodia_trick=True,
    )
    midi.write(str(ziel))
    anzahl = sum(len(i.notes) for i in midi.instruments)
    print(f"→ {regeln['name']}: {anzahl} Noten → {ziel.name}")
    return midi


def zusammenfuehren(teile: list[tuple[dict, object]], tempo: float, ziel: Path) -> None:
    """Alle Stimmen in eine mehrspurige MIDI-Datei mit Tempo."""
    import pretty_midi

    gesamt = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    for regeln, midi in teile:
        spur = pretty_midi.Instrument(program=regeln["programm"], name=regeln["name"])
        for instrument in midi.instruments:
            spur.notes.extend(instrument.notes)
        spur.notes.sort(key=lambda n: n.start)
        gesamt.instruments.append(spur)
    gesamt.write(str(ziel))
    print(f"→ Gesamt: {len(gesamt.instruments)} Spuren → {ziel.name}")


def musicxml_schreiben(midi: Path, ziel: Path) -> None:
    """MIDI → MusicXML mit music21; quantisiert auf Sechzehntel und Triolen."""
    try:
        from music21 import converter
    except ImportError:
        print("! music21 fehlt — MusicXML übersprungen (MIDI in MuseScore öffnen geht auch).")
        return
    try:
        partitur = converter.parse(str(midi), quantizePost=True, quarterLengthDivisors=(4, 3))
        partitur.write("musicxml", fp=str(ziel))
        print(f"→ MusicXML → {ziel.name}")
    except Exception as fehler:  # noqa: BLE001 — Experiment, alles zeigen
        print(f"! MusicXML fehlgeschlagen ({fehler}); MIDI in MuseScore importieren.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("datei", type=Path, help="Audio-Datei (mp3, wav, flac, m4a …)")
    p.add_argument("--ausgabe", type=Path, default=Path("ergebnis"), help="Zielordner (Standard: ergebnis)")
    p.add_argument("--modell", default="htdemucs_6s", help="Demucs-Modell (htdemucs_6s hat Gitarre und Klavier; htdemucs_ft ist genauer, aber ohne)")
    p.add_argument("--geraet", default="cpu", help="cpu, cuda (Nvidia) oder mps (Apple)")
    p.add_argument("--ohne-trennung", action="store_true", help="keine Stems, Datei direkt transkribieren (für eine einzelne Stimme)")
    p.add_argument("--tempo", type=float, help="Tempo vorgeben statt schätzen")
    args = p.parse_args()

    if not args.datei.is_file():
        sys.exit(f"Datei nicht gefunden: {args.datei}")
    ordner = args.ausgabe / args.datei.stem
    ordner.mkdir(parents=True, exist_ok=True)

    if args.ohne_trennung:
        quellen = {"mix": args.datei}
    else:
        quellen = stimmen_trennen(args.datei, args.ausgabe / "stems", args.modell, args.geraet)
        for name, pfad in quellen.items():
            shutil.copy(pfad, ordner / f"stem-{name}.wav")

    tempo = args.tempo or tempo_schaetzen(quellen.get("drums", next(iter(quellen.values()))))

    teile = []
    for name, pfad in quellen.items():
        if name == "drums":
            continue  # Schlagzeug: keine Tonhöhen, eigenes Thema (ADT)
        regeln = STIMMEN.get(name, STIMMEN["other"] | {"name": name})
        teile.append((regeln, noten_erkennen(pfad, regeln, ordner / f"{name}.mid")))

    gesamt = ordner / "gesamt.mid"
    zusammenfuehren(teile, tempo, gesamt)
    musicxml_schreiben(gesamt, ordner / "gesamt.musicxml")
    print(f"\nFertig: {ordner}/ — gesamt.musicxml oder gesamt.mid in MuseScore öffnen.")


if __name__ == "__main__":
    main()
