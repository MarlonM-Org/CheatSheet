#!/usr/bin/env python3
"""Erkanntes Ergebnis Note für Note gegen eine Referenz-Partitur halten.

    python vergleichen.py referenz/alle-meine-entchen.musicxml ergebnis.mid --tempo 90

Eine Referenznote gilt als getroffen, wenn im Ergebnis eine Note gleicher
Tonhöhe beginnt, die höchstens --toleranz Viertel (Standard 0.25 = eine
Sechzehntel) daneben liegt. Ausgegeben werden Treffer, Fehlende, Überzählige,
Dauerabweichungen und eine Gegenüberstellung je Takt.
"""

from __future__ import annotations

import argparse
from pathlib import Path

NAMEN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def name(p: int) -> str:
    return f"{NAMEN[p % 12]}{p // 12 - 1}"


def referenz_laden(pfad: Path) -> list[tuple[float, float, int]]:
    from music21 import converter

    s = converter.parse(str(pfad))
    noten = []
    for n in s.flatten().notes:
        if n.isNote:
            noten.append((float(n.offset), float(n.quarterLength), n.pitch.midi))
    return sorted(noten)


def ergebnis_laden(pfad: Path, tempo: float) -> list[tuple[float, float, int]]:
    if pfad.suffix.lower() in (".musicxml", ".xml", ".mxl"):
        return referenz_laden(pfad)
    import pretty_midi

    pm = pretty_midi.PrettyMIDI(str(pfad))
    faktor = tempo / 60.0
    return sorted((n.start * faktor, (n.end - n.start) * faktor, n.pitch) for i in pm.instruments for n in i.notes)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("referenz", type=Path)
    p.add_argument("ergebnis", type=Path)
    p.add_argument("--tempo", type=float, default=90.0, help="Tempo des Ergebnisses in bpm (für MIDI-Zeiten)")
    p.add_argument("--toleranz", type=float, default=0.25, help="erlaubte Einsatz-Abweichung in Vierteln")
    p.add_argument("--schlaege", type=int, default=4)
    p.add_argument("--oktave", type=int, default=0, help="Referenz um n Oktaven versetzen (z. B. -1, wenn tiefer gesungen wurde)")
    p.add_argument("--kurz", action="store_true", help="nur die Kennzahlen in einer Zeile")
    args = p.parse_args()

    ref = [(s, d, t + 12 * args.oktave) for s, d, t in referenz_laden(args.referenz)]
    erg = [(round(s, 3), round(d, 3), t) for s, d, t in ergebnis_laden(args.ergebnis, args.tempo)]
    offen = list(range(len(erg)))
    treffer, fehlend, dauer_ok = [], [], 0
    for r_start, r_dauer, r_ton in ref:
        kandidaten = [j for j in offen if erg[j][2] == r_ton and abs(erg[j][0] - r_start) <= args.toleranz]
        if kandidaten:
            j = min(kandidaten, key=lambda j: abs(erg[j][0] - r_start))
            offen.remove(j)
            treffer.append((r_start, r_dauer, r_ton, erg[j]))
            if abs(erg[j][1] - r_dauer) <= args.toleranz:
                dauer_ok += 1
        else:
            fehlend.append((r_start, r_dauer, r_ton))
    ueberzaehlig = [erg[j] for j in offen]

    if args.kurz:
        print(f"getroffen {len(treffer)}/{len(ref)}, Dauer passend {dauer_ok}, fehlend {len(fehlend)}, überzählig {len(ueberzaehlig)}")
        return
    print(f"Referenz {len(ref)} Noten, Ergebnis {len(erg)} Noten")
    print(f"  getroffen (Ton + Einsatz): {len(treffer)}/{len(ref)}  ({100*len(treffer)/len(ref):.0f} %)")
    print(f"  davon Dauer passend:       {dauer_ok}/{len(ref)}")
    print(f"  fehlend:                   {len(fehlend)}")
    print(f"  überzählig:                {len(ueberzaehlig)}")

    takt = args.schlaege
    print("\nJe Takt (Referenz | Ergebnis), Einsatz in Schlägen:")
    takte = int(max([n[0] + n[1] for n in ref + erg] + [0]) // takt) + 1
    for t in range(takte):
        a, b = t * takt, (t + 1) * takt
        links = " ".join(f"{name(n[2])}@{n[0]-a+1:g}×{n[1]:g}" for n in ref if a <= n[0] < b)
        rechts = " ".join(f"{name(n[2])}@{n[0]-a+1:g}×{n[1]:g}" for n in erg if a <= n[0] < b)
        print(f"  Takt {t+1:2d}: {links:42s} | {rechts}")

    if fehlend:
        print("\nFehlend:", ", ".join(f"{name(n[2])} Takt {int(n[0]//takt)+1} Schlag {n[0]%takt+1:g}" for n in fehlend))
    if ueberzaehlig:
        print("Überzählig:", ", ".join(f"{name(n[2])} Takt {int(n[0]//takt)+1} Schlag {n[0]%takt+1:.2g}×{n[1]:.2g}" for n in ueberzaehlig))


if __name__ == "__main__":
    main()
