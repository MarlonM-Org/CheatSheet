#!/usr/bin/env python3
"""Referenz-Partitur: „Alle meine Entchen", C-Dur, 4/4, 90 bpm, mit Text.

Erzeugt alle-meine-entchen.musicxml als klare Erwartung für den Abgleich:
Partitur → MuseScore → MP3 → monophon.py → Vergleich mit dieser Partitur.

    python alle_meine_entchen.py            # schreibt neben dieses Skript
"""

from pathlib import Path

from music21 import clef, instrument, key, metadata, meter, note, stream, tempo

# (Tonhöhe, Dauer in Vierteln, Silbe)
MELODIE = [
    ("C4", 1, "Al-"), ("D4", 1, "le"), ("E4", 1, "mei-"), ("F4", 1, "ne"),
    ("G4", 2, "Ent-"), ("G4", 2, "chen"),
    ("A4", 1, "schwim-"), ("A4", 1, "men"), ("A4", 1, "auf"), ("A4", 1, "dem"),
    ("G4", 4, "See,"),
    ("A4", 1, "schwim-"), ("A4", 1, "men"), ("A4", 1, "auf"), ("A4", 1, "dem"),
    ("G4", 4, "See."),
    ("F4", 1, "Köpf-"), ("F4", 1, "chen"), ("F4", 1, "in"), ("F4", 1, "das"),
    ("E4", 2, "Was-"), ("E4", 2, "ser,"),
    ("D4", 1, "Schwänz-"), ("D4", 1, "chen"), ("D4", 1, "in"), ("D4", 1, "die"),
    ("C4", 4, "Höh'."),
]


def partitur(klavier: bool = False) -> stream.Score:
    s = stream.Score()
    s.metadata = metadata.Metadata(title="Alle meine Entchen", composer="Volkslied")
    p = stream.Part()
    p.partName = "Klavier" if klavier else "Gesang"
    p.insert(0, instrument.Piano() if klavier else instrument.Vocalist())
    p.insert(0, clef.TrebleClef())
    p.insert(0, key.Key("C"))
    p.insert(0, meter.TimeSignature("4/4"))
    p.insert(0, tempo.MetronomeMark(number=90))
    for ton, dauer, silbe in MELODIE:
        n = note.Note(ton, quarterLength=dauer)
        n.lyric = silbe
        p.append(n)
    p.makeMeasures(inPlace=True)
    s.append(p)
    return s


if __name__ == "__main__":
    ziel = Path(__file__).with_name("alle-meine-entchen.musicxml")
    partitur().write("musicxml", fp=str(ziel))
    print(f"→ {ziel}")
    # Gleiche Noten, aber Klavier als Klang: klare Anschläge, kein Portamento
    # (der MuseScore-Gesangsklang gleitet zwischen den Tönen und trennt keine Silben).
    ziel_klavier = Path(__file__).with_name("alle-meine-entchen-klavier.musicxml")
    partitur(klavier=True).write("musicxml", fp=str(ziel_klavier))
    print(f"→ {ziel_klavier}")
