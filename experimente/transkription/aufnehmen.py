#!/usr/bin/env python3
"""Zum Metronom einsingen: spielt den Klick, nimmt gleichzeitig das Mikrofon auf.

    python aufnehmen.py --tempo 90 --takte 8 --ausgabe aufnahme.wav

Ablauf: ein Takt Vorzähler (nur Klick), dann `--takte` Takte singen. Die
Datei beginnt exakt auf der Eins des ersten gesungenen Takts, der Vorzähler
wird abgeschnitten. Damit gilt für monophon.py: --tempo gleich, --versatz 0.

Kopfhörer tragen, sonst landet der Klick in der Aufnahme.
"""

from __future__ import annotations

import argparse
import sys
import threading
import time
from pathlib import Path

import numpy as np

SR = 44100


def klick(freq: float, dauer_s: float = 0.04) -> np.ndarray:
    t = np.arange(int(SR * dauer_s)) / SR
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t * 60)).astype(np.float32)


def klickspur(tempo: float, takte: int, schlaege: int) -> np.ndarray:
    schlag_s = 60.0 / tempo
    gesamt = np.zeros(int(SR * schlag_s * schlaege * takte) + SR // 10, dtype=np.float32)
    for i in range(takte * schlaege):
        start = int(i * schlag_s * SR)
        ton = klick(1200.0 if i % schlaege == 0 else 800.0)
        gesamt[start:start + len(ton)] += ton * (0.8 if i % schlaege == 0 else 0.5)
    return gesamt


def anzeige(tempo: float, vorzaehler: int, takte: int, schlaege: int, stop: threading.Event) -> None:
    """Zählt im Terminal mit: Vorzähler, dann Takt/Schlag."""
    schlag_s = 60.0 / tempo
    start = time.perf_counter()
    letzter = -1
    while not stop.is_set():
        i = int((time.perf_counter() - start) / schlag_s)
        if i != letzter:
            letzter = i
            takt, schlag = divmod(i, schlaege)
            if takt < vorzaehler:
                text = f"   Vorzähler  {schlag + 1}"
            elif takt < vorzaehler + takte:
                text = f"   SINGEN  Takt {takt - vorzaehler + 1}/{takte}  Schlag {schlag + 1}"
            else:
                break
            print("\r" + text.ljust(50), end="", flush=True)
        time.sleep(0.005)
    print()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--tempo", type=float, default=90.0, help="Schläge pro Minute (Standard 90)")
    p.add_argument("--takte", type=int, default=8, help="Anzahl Takte zum Singen (Standard 8)")
    p.add_argument("--schlaege", type=int, default=4, help="Schläge je Takt (Standard 4)")
    p.add_argument("--vorzaehler", type=int, default=1, help="Takte Vorzähler (Standard 1)")
    p.add_argument("--ausgabe", type=Path, default=Path("aufnahme.wav"))
    p.add_argument("--geraete", action="store_true", help="nur Audiogeräte auflisten")
    p.add_argument("--auf-eins", action="store_true", help="erster Einsatz wird auf die Eins gelegt (klar auf 1 beginnen, gleicht Latenz aus)")
    args = p.parse_args()

    import sounddevice as sd
    import soundfile as sf

    if args.geraete:
        print(sd.query_devices())
        return

    sd.default.latency = "low"
    ein, aus = sd.default.device
    geraete = sd.query_devices()
    print(f"Mikrofon:  {geraete[ein]['name']}")
    print(f"Kopfhörer: {geraete[aus]['name']}")
    print(f"Tempo {args.tempo:.0f} bpm, {args.vorzaehler} Takt Vorzähler, dann {args.takte} Takte singen.")
    print("Kopfhörer auf. Melodie im Kopf? Dann Enter drücken, der Vorzähler beginnt sofort.")
    input("[Enter] ")

    spur = klickspur(args.tempo, args.vorzaehler + args.takte, args.schlaege)
    stop = threading.Event()
    zaehler = threading.Thread(target=anzeige, args=(args.tempo, args.vorzaehler, args.takte, args.schlaege, stop), daemon=True)
    zaehler.start()
    aufnahme = sd.playrec(spur, samplerate=SR, channels=1, dtype="float32")
    sd.wait()
    stop.set()
    zaehler.join(timeout=1)

    schnitt = int(SR * 60.0 / args.tempo * args.schlaege * args.vorzaehler)
    gesang = aufnahme[schnitt:, 0]
    pegel = float(np.abs(gesang).max())
    if pegel < 0.01:
        sys.exit("Aufnahme ist praktisch stumm. Mikrofon prüfen (python aufnehmen.py --geraete).")
    gesang = gesang / pegel * 0.9  # normalisieren

    if args.auf_eins:
        # Der erste Einsatz gilt als die Eins: so fällt die Gerätelatenz heraus.
        fenster = int(SR * 0.02)
        huellkurve = np.sqrt(np.convolve(gesang**2, np.ones(fenster) / fenster, mode="same"))
        schwelle = huellkurve.max() * 0.15
        maximal = int(SR * 60.0 / args.tempo * 0.6)  # höchstens gut einen halben Schlag suchen
        treffer = np.flatnonzero(huellkurve[:maximal] > schwelle)
        if len(treffer):
            einsatz = int(treffer[0])
            gesang = gesang[einsatz:]
            print(f"→ Erster Einsatz {einsatz / SR * 1000:.0f} ms nach der Eins, Aufnahme darauf ausgerichtet (Latenz).")
        else:
            print("! Kein Einsatz nahe der Eins gefunden, Aufnahme bleibt ungeschoben.")

    args.ausgabe.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.ausgabe), gesang, SR, subtype="PCM_16")
    print(f"→ {args.ausgabe}  ({len(gesang) / SR:.1f} s, Spitzenpegel vor Normalisierung {20 * np.log10(pegel):.0f} dBFS)")


if __name__ == "__main__":
    main()
