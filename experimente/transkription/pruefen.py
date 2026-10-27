#!/usr/bin/env python3
"""Prüfstand für monophon.py ohne Mikrofon: eine künstliche Singstimme.

    .venv/bin/python pruefen.py            # alle Fälle
    .venv/bin/python pruefen.py --wav      # schreibt die Signale nach aufnahmen/pruef-*.wav

Die Stimme hat, was echte Laienstimmen haben und was die Erkennung bisher
zerhackt hat: Vibrato, das die Halbtongrenze überschreitet, Drift,
Einschleifen in den Ton, Konsonanten als stimmlose Rauschstöße mit
Pegeleinbruch, Tremolo, Atmer. Erwartet wird, was die Partitur sagt:
keine Note zerfällt, Pausen nur, wo die Partitur welche hat, und gleiche
Töne hintereinander bleiben getrennt, wenn sie neu angesetzt wurden.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import monophon  # noqa: E402
from monophon import SR, Parameter, noten_aus_signal  # noqa: E402

RNG = np.random.default_rng(7)


def _midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def stimme(noten: list[tuple[int | None, float]], tempo: float, konsonant: bool = True,
           vibrato_cent: float = 45.0, drift_cent: float = 25.0, tremolo_db: float = 2.0,
           einschleifen: float = 1.5, kratzer: bool = True, weich: bool = False) -> np.ndarray:
    """Noten (midi oder None für Pause, Dauer in Vierteln) → Signal bei SR.

    Jede Note: 20 ms Stille + 50 ms stimmloser Konsonant (gefiltertes Rauschen,
    −18 dB), dann der Ton mit 40 ms Einschwingen, Einschleifen von unten
    (`einschleifen` Halbtöne über 90 ms), Vibrato (5,5 Hz, ab 200 ms voll),
    langsamer Drift, Tremolo (ca. 6 Hz) und ein leiser Pegeleinbruch mitten in
    langen Tönen (Stütze lässt nach), der die Note NICHT beenden darf.
    `weich`: statt des stimmlosen Konsonanten ein weiches „l": 100 ms lang
    klingt der Grundton weiter, die Obertöne sind um 20 dB leiser (der
    Gesamtpegel sinkt nur 1–2 dB, das Mittenband 600–1500 Hz bricht ein).
    """
    viertel = 60.0 / tempo
    teile = []
    for midi, dauer in noten:
        n = int(round(dauer * viertel * SR))
        if midi is None:
            teile.append(RNG.normal(0, 10 ** (-50 / 20), n).astype(np.float32))
            continue
        seg = np.zeros(n, dtype=np.float64)
        k0 = int(0.02 * SR) if konsonant and not weich else 0
        k1 = k0 + (int(0.05 * SR) if konsonant and not weich else 0)
        if konsonant and not weich:
            rausch = RNG.normal(0, 1, k1 - k0)
            rausch = np.convolve(rausch, np.ones(8) / 8, mode="same")   # dumpfer machen
            seg[k0:k1] = rausch / (np.abs(rausch).max() + 1e-9) * 10 ** (-18 / 20)
        t = np.arange(n - k1) / SR
        if len(t) == 0:
            teile.append(seg.astype(np.float32))
            continue
        cent = np.zeros_like(t)
        cent += -einschleifen * 100 * np.exp(-t / 0.03) * (t < 0.09)                     # von unten einschleifen
        cent += vibrato_cent * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.2, 0, 1)      # Vibrato baut sich auf
        cent += drift_cent * (t / max(t[-1], 1e-3)) - drift_cent / 2                     # Drift
        cent += RNG.normal(0, 4, len(t)).cumsum() * 0.02                                  # Zittern
        f = _midi_hz(midi) * 2 ** (cent / 1200)
        phase = 2 * np.pi * np.cumsum(f) / SR
        ton = np.zeros_like(t)
        daempfung = np.where(t < 0.1, 0.1, 1.0) if weich else 1.0                        # das „l": alle Obertöne 100 ms lang leise
        for h in range(1, 12):
            ton += np.sin(h * phase + RNG.uniform(0, 2 * np.pi)) / h ** 1.3 * (1 if h < 6 else 0.5) * (daempfung if h >= 2 else 1.0)
        huelle = np.clip(t / 0.04, 0, 1) * np.clip((t[-1] - t) / 0.06, 0, 1)             # an- und abschwellen
        if weich:
            huelle = np.clip(t / 0.01, 0, 1) * np.clip((t[-1] - t) / 0.03, 0, 1) * np.where(t < 0.1, 0.85, 1.0)   # kaum Pegelbewegung
        huelle *= 10 ** (tremolo_db * np.sin(2 * np.pi * 6.3 * t) / 20)                  # Tremolo
        if kratzer and t[-1] > 0.9:
            mitte = t[-1] / 2
            huelle *= 10 ** (-7 * np.exp(-((t - mitte) / 0.05) ** 2) / 20)              # 7-dB-Einbruch, 100 ms
        seg[k1:] = ton / np.abs(ton).max() * 0.4 * huelle
        teile.append(seg.astype(np.float32))
    y = np.concatenate(teile)
    y += RNG.normal(0, 10 ** (-48 / 20), len(y)).astype(np.float32)   # Raumrauschen
    return y


def viertel(noten, tempo: float):
    """Quantisierte Noten (s) → (einsatz in Vierteln, dauer in Vierteln, midi)."""
    f = tempo / 60.0
    return sorted((round(s * f, 3), round((e - s) * f, 3), t) for s, e, t in noten)


def vergleichen(referenz, ergebnis, toleranz: float = 0.25):
    """Wie vergleichen.py: Treffer (Ton + Einsatz), Dauer passend, fehlend, überzählig."""
    offen = list(range(len(ergebnis)))
    treffer, dauer_ok, fehlend = 0, 0, []
    for r_start, r_dauer, r_ton in referenz:
        k = [j for j in offen if ergebnis[j][2] == r_ton and abs(ergebnis[j][0] - r_start) <= toleranz]
        if k:
            j = min(k, key=lambda j: abs(ergebnis[j][0] - r_start))
            offen.remove(j)
            treffer += 1
            if abs(ergebnis[j][1] - r_dauer) <= toleranz:
                dauer_ok += 1
        else:
            fehlend.append((r_start, r_dauer, r_ton))
    return treffer, dauer_ok, fehlend, [ergebnis[j] for j in offen]


ENTCHEN = [(60, 1), (62, 1), (64, 1), (65, 1), (67, 2), (67, 2),
           (69, 1), (69, 1), (69, 1), (69, 1), (67, 4),
           (69, 1), (69, 1), (69, 1), (69, 1), (67, 4),
           (65, 1), (65, 1), (65, 1), (65, 1), (64, 2), (64, 2),
           (62, 1), (62, 1), (62, 1), (62, 1), (60, 4)]


def fall(name: str, noten, tempo: float, p: Parameter, wav: bool, **stimm) -> bool:
    y = stimme(noten, tempo, **stimm)
    if wav:
        import soundfile  # type: ignore
        Path("aufnahmen").mkdir(exist_ok=True)
        soundfile.write(f"aufnahmen/pruef-{name}.wav", y, SR)
    print(f"\n== {name} ({tempo:g} bpm) ==")
    erg = viertel(noten_aus_signal(y, p), tempo)
    ref, pos = [], 0.0
    for midi, dauer in noten:
        if midi is not None:
            ref.append((pos, float(dauer), midi))
        pos += dauer
    treffer, dauer_ok, fehlend, zuviel = vergleichen(ref, erg)
    print(f"   getroffen {treffer}/{len(ref)}, Dauer passend {dauer_ok}, fehlend {len(fehlend)}, überzählig {len(zuviel)}")
    if fehlend:
        print("   fehlend:", fehlend)
    if zuviel:
        print("   überzählig:", zuviel)
    ok = treffer == len(ref) and not zuviel and dauer_ok >= len(ref) - 1
    print("   " + ("OK" if ok else "FEHLER"))
    if not ok:
        print("   Ergebnis:", erg)
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wav", action="store_true", help="Signale als WAV ablegen (zum Anhören)")
    args = ap.parse_args()
    ergebnisse = []

    # 1. Ein gehaltener Ton, 4 Viertel, mit Pegeleinbruch und Vibrato über die Halbtongrenze.
    p = Parameter(tempo=90)
    ergebnisse.append(fall("halteton", [(67, 4)], 90, p, args.wav, vibrato_cent=60))

    # 2. Alle meine Entchen mit Konsonanten (gleiche Töne hintereinander müssen getrennt bleiben).
    ergebnisse.append(fall("entchen", ENTCHEN, 90, Parameter(tempo=90), args.wav))

    # 3. Dasselbe in C-Dur gezogen, mit mehr Drift und tiefer eingeschliffen (zu tief gesungenes F).
    ergebnisse.append(fall("entchen-tonart", ENTCHEN, 90, Parameter(tempo=90, tonart="C"), args.wav, drift_cent=45, einschleifen=2.5))

    # 4. Schneller, Achtel, mit echten Pausen (Atmer von einem Viertel) — Pausen müssen bleiben.
    phrase = [(64, 0.5), (66, 0.5), (67, 1), (None, 1), (67, 0.5), (66, 0.5), (64, 1), (None, 1), (62, 2), (64, 2)]
    ergebnisse.append(fall("pausen", phrase, 120, Parameter(tempo=120), args.wav))

    # 5. Weiches „la la la" ohne Absetzen: die Stimme klingt durch, nur das „l" dämpft die Obertöne.
    ergebnisse.append(fall("entchen-weich", ENTCHEN, 90, Parameter(tempo=90), args.wav, weich=True))

    # 6. Ohne Konsonanten gesungen („aah"), nur Tonwechsel — darf nichts zerhacken.
    legato = [(60, 1), (62, 1), (64, 2), (65, 1), (67, 3), (65, 1), (64, 1), (62, 2)]
    ergebnisse.append(fall("legato", legato, 80, Parameter(tempo=80), args.wav, konsonant=False))

    print("\n" + ("Alle Fälle bestanden." if all(ergebnisse) else f"{ergebnisse.count(False)} Fall/Fälle fehlgeschlagen."))
    sys.exit(0 if all(ergebnisse) else 1)


if __name__ == "__main__":
    main()
