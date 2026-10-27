#!/usr/bin/env python3
"""Monophone Lesart: eine Stimme (Gesang, Bass, eingesungene Melodie) → MIDI.

pYIN verfolgt die eine stärkste Tonhöhe je Zeitpunkt. Daraus macht das
Noten-HMM aus pYIN/Tony (Mauch et al. 2015) Noten: je Tonhöhe drei Zustände
(Ansatz, Halten, Stille) und ein Viterbi-Pfad über die ganze Aufnahme — eine
Note läuft weiter, solange nicht viele Rahmen hintereinander dagegensprechen.
Danach die Regeln, die alle veröffentlichten Verfahren teilen: Noten kürzer
als 100 ms verwerfen, gleiche Töne über kurze Lücken verbinden, gleiche Töne
nur bei hörbarem Neuansatz trennen, Tonhöhe als Median ohne den Ansatz.
Zuletzt die Rasterung bei bekanntem Tempo: nur die Einsätze werden gerundet
(gemeinsam, mit Vorliebe für Schlag und Achtel), jede Note dauert bis zum
nächsten Einsatz — eine Pause entsteht nur, wenn die Stille davor länger ist
als `--pause` (Standard: ein Achtel). So zerfallen gehaltene Töne nicht mehr
in „Sechzehntel + Sechzehntelpause".

    python monophon.py gesang.wav --tempo 96
    python monophon.py gesang.wav --tempo 96 --raster 8 --tonart C --versatz auto
    python monophon.py stem-bass.wav --tempo 66 --von 30 --bis 400 --programm 33 --name Bass

Ergebnis: <datei>-mono.mid und .musicxml neben der Eingabe (oder --ziel).
Mehrere Dateien → eine gesamt-mono.mid mit einer Spur je Datei.
Hintergrund und Quellen: reports/Gesang zu Noten transkribieren.md.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SR = 22050          # reicht für Tonhöhe, halbiert die Rechenzeit
HOP = 256           # ≈ 11,6 ms je Rahmen
RAHMEN_S = HOP / SR
TONY_RAHMEN_S = 256 / 44100   # Rahmenabstand, für den die pYIN-Übergänge bestimmt wurden


@dataclass
class Parameter:
    """Alle Stellschrauben der Verarbeitung, unabhängig von der Kommandozeile."""
    tempo: float
    raster: int = 16            # Zellen je ganzer Note
    schlaege: int = 4
    von: float = 80.0           # Hz
    bis: float = 1000.0         # Hz
    leise: float = -40.0        # dB unter Maximum: Rahmen zählt als stumm
    mindest: float = 100.0      # ms: kürzere Noten verwerfen (pYIN prunethresh)
    luecke: float = 130.0       # ms: gleiche Töne über kürzere Lücken verbinden, wenn kein Anschlag dazwischen
    anschlag: float = 4.0       # dB: Pegelanstieg binnen 25 ms, der einen Neuansatz anzeigt (0 = aus)
    pause: float | None = None  # s: Stille ab dieser Länge wird Pause (None = ein Achtel, mindestens 0,15 s)
    ansatz: float = 60.0        # ms: Anfang einer Note, der beim Tonhöhen-Median ausgelassen wird
    tonart: str | None = None
    versatz: float = 0.0        # s: Lage des ersten Schlags
    nachbessern: bool = True

    def schritt(self) -> float:
        return 60.0 / self.tempo * 4 / self.raster

    def pause_s(self) -> float:
        return self.pause if self.pause is not None else max(0.15, 60.0 / self.tempo / 2)


# ── Tonhöhenspur ──

def tonhoehe_verfolgen(y: np.ndarray, von: float, bis: float):
    """pYIN je Rahmen: MIDI-Tonhöhe (immer gesetzt, bei stimmlosen Rahmen die
    beste Schätzung), Stimmhaftigkeits-Wahrscheinlichkeit 0–1, Pegel in dB."""
    import librosa

    f0, voiced, prob = librosa.pyin(y, fmin=von, fmax=bis, sr=SR, frame_length=2048, hop_length=HOP, fill_na=None)
    midi = librosa.hz_to_midi(f0)
    # Wie in Tony: stimmlose Rahmen haben keinen Kandidaten (prob 0) — das HMM
    # hält eine Note über kurze Aussetzer aus eigener Trägheit, nicht weil der
    # stimmlose Rahmen eine Tonhöhe behauptet.
    prob = np.where(voiced, np.nan_to_num(prob), 0.0)
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
    db = librosa.amplitude_to_db(rms, ref=np.max)
    n = min(len(midi), len(prob), len(db))
    return midi[:n], prob[:n], db[:n]


# ── Noten-HMM (pYIN/Tony) ──

def _gauss(x: np.ndarray, sigma: float) -> np.ndarray:
    return np.exp(-0.5 * (x / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi))


class NotenHMM:
    """Das Noten-HMM aus pYIN (MonoNoteHMM.cpp), Parameter 1:1 übernommen.

    Zustände je Tonhöhe (Drittel-Halbtöne): Ansatz, Halten, Stille. Erlaubte
    Übergänge: Ansatz→Ansatz 0,9, Ansatz→Halten 0,1, Halten→Halten 0,99,
    Halten→Stille 0,01, Stille→Stille 0,9999, Stille→Ansatz (Summe 10⁻⁴,
    verteilt nach Abstand mit σ 0,7 Halbton; nur Abstand 0 oder 0,5–13).
    Die Selbstübergänge sind für Tonys Rahmenabstand (5,8 ms) bestimmt und
    werden auf den hiesigen umgerechnet, damit die Trägheit in Sekunden
    gleich bleibt. Ein Notenwechsel kostet damit ~10⁶-mal mehr als das
    Weiterlaufen und gewinnt nur, wenn viele Rahmen dafür sprechen.
    """

    SIGMA_ANSATZ = 5.0      # Halbtöne: Tonhöhe streut am Notenanfang
    SIGMA_HALTEN = 0.8      # Halbtöne: weiche Toleranz für Vibrato und Drift
    SIGMA_ABSTAND = 0.7     # Halbtöne: Verteilung des Abstands zur nächsten Note
    MAX_SPRUNG = 13.0
    MIN_ABSTAND = 0.5
    PRIOR_GEPITCHT = 0.7
    PRIOR_GEWICHT = 0.5
    YIN_VERTRAUEN = 0.1

    def __init__(self, tief: float, hoch: float, rahmen_s: float = RAHMEN_S, schritte: int = 3):
        self.tonhoehen = np.arange(np.floor(tief), np.ceil(hoch) + 1e-9, 1.0 / schritte)
        p = len(self.tonhoehen)
        k = rahmen_s / TONY_RAHMEN_S
        p_ansatz, p_halten, p_stille = 0.9 ** k, 0.99 ** k, 0.9999 ** k
        t = np.zeros((3 * p, 3 * p))
        for i in range(p):
            a, h, s = 3 * i, 3 * i + 1, 3 * i + 2
            t[a, a], t[a, h] = p_ansatz, 1 - p_ansatz
            t[h, h], t[h, s] = p_halten, 1 - p_halten
            t[s, s] = p_stille
            d = np.abs(self.tonhoehen - self.tonhoehen[i])
            erlaubt = (d == 0) | ((d > self.MIN_ABSTAND) & (d < self.MAX_SPRUNG))
            w = _gauss(d, self.SIGMA_ABSTAND) * erlaubt
            w /= w.sum()
            t[s, 0::3] += (1 - p_stille) * w
        self.uebergang = t
        self.start = np.zeros(3 * p)
        self.start[2::3] = 1.0 / p

    def beobachtung(self, midi: np.ndarray, prob: np.ndarray) -> np.ndarray:
        """Je Rahmen eine Beobachtungswahrscheinlichkeit je Zustand (Zustände × Rahmen).

        Wie in pYIN: ein Kandidat je Rahmen (Tonhöhe, Wahrscheinlichkeit).
        Rahmen ohne Kandidat (prob 0) sind für alle Tonhöhen gleich plausibel
        und nur über den Prior zu 35 % „gepitcht" — ein kurzer Aussetzer kippt
        eine laufende Note deshalb nicht.
        """
        p = len(self.tonhoehen)
        gepitcht = prob * (1 - self.PRIOR_GEWICHT) + self.PRIOR_GEPITCHT * self.PRIOR_GEWICHT
        abstand = self.tonhoehen[:, None] - midi[None, :]
        vertrauen = np.where(prob > 0, np.power(np.maximum(prob, 1e-12), self.YIN_VERTRAUEN), 1.0)
        ansatz = np.where(prob > 0, _gauss(abstand, self.SIGMA_ANSATZ), 1.0) * vertrauen
        halten = np.where(prob > 0, _gauss(abstand, self.SIGMA_HALTEN), 1.0) * vertrauen
        summe = ansatz.sum(axis=0) + halten.sum(axis=0)
        summe[summe <= 0] = 1.0
        obs = np.empty((3 * p, len(midi)))
        obs[0::3] = ansatz / summe * gepitcht
        obs[1::3] = halten / summe * gepitcht
        obs[2::3] = (1 - gepitcht) / p
        return obs

    def dekodieren(self, midi: np.ndarray, prob: np.ndarray) -> np.ndarray:
        """Viterbi: je Rahmen der Index der Tonhöhe oder -1 für Stille."""
        import librosa

        obs = np.clip(self.beobachtung(midi, prob), 1e-300, 1.0)
        zustand = librosa.sequence.viterbi(obs, self.uebergang, p_init=self.start)
        return np.where(zustand % 3 == 2, -1, zustand // 3)


def bereiche_aus_zustaenden(index: np.ndarray) -> list[tuple[int, int]]:
    """Zusammenhängende Rahmen gleicher HMM-Tonhöhe → Rahmenbereiche [i, j)."""
    bereiche = []
    i, n = 0, len(index)
    while i < n:
        if index[i] < 0:
            i += 1
            continue
        j = i
        while j < n and index[j] == index[i]:
            j += 1
        bereiche.append((i, j))
        i = j
    return bereiche


def _median_stimmhaft(midi: np.ndarray, prob: np.ndarray, i: int, j: int) -> float:
    werte = midi[i:j][prob[i:j] > 0]
    return float(np.median(werte if len(werte) else midi[i:j]))


def an_tonwechseln_teilen(bereiche, midi: np.ndarray, prob: np.ndarray, mindest_rahmen: int,
                          ansatz_rahmen: int = 0, schwelle: float = 0.7):
    """Einen HMM-Bereich teilen, wo die Tonhöhe dauerhaft auf ein neues Plateau wechselt.

    Das Noten-HMM ist träge und zieht einen kurzen Ton (eine Achtel) gern mit
    dem Halbton daneben zusammen (bekannte Schwäche von Tony). Deshalb: Der
    Median der nächsten ~150 ms ab `k + ansatz_rahmen` weicht um mindestens
    `schwelle` Halbtöne vom Median des bisherigen Plateaus (ohne dessen
    Ansatz) ab → neue Note ab k. Einschleifen in den Ton, Vibrato (±50 Cent)
    und Drift bleiben darunter, weil die ersten Rahmen jeder Note nicht
    zählen und Mediane über mindestens eine Vibratoperiode verglichen werden.
    """
    # Fenster mindestens eine Vibratoperiode (5–7 Hz → ~150 ms), sonst liest
    # der Median einer Halbperiode ±30 Cent und zwei Fenster streiten sich.
    w = max(2, mindest_rahmen, int(round(0.15 / RAHMEN_S)))
    ab = max(0, ansatz_rahmen)
    ergebnis = []
    for i, j in bereiche:
        start = i
        while True:
            k, wechsel = start + max(2, mindest_rahmen), None
            while k + ab + w <= j:
                plateau_ab = start + ab if k - start > 2 * ab else start
                if abs(_median_stimmhaft(midi, prob, k + ab, k + ab + w) - _median_stimmhaft(midi, prob, plateau_ab, k)) >= schwelle:
                    wechsel = k
                    break
                k += 1
            if wechsel is None:
                ergebnis.append((start, j))
                break
            ergebnis.append((start, wechsel))
            start = wechsel
    return ergebnis


def noten_aus_bereichen(bereiche, midi: np.ndarray, prob: np.ndarray, ansatz_s: float):
    """Rahmenbereiche → Noten (start_s, ende_s, tonhöhe als Fließkomma).

    Die Tonhöhe ist der Median der stimmhaften Rahmen ohne die ersten
    `ansatz_s` Sekunden (Einschwingen, Einschleifen), sofern die Note lang
    genug ist (DTMST liest 96 ms nach dem Einsatz, pYIN streut im Ansatz mit σ 5).
    """
    ab = int(round(ansatz_s / RAHMEN_S))
    noten = []
    for i, j in bereiche:
        kern = (i + ab, j) if j - i > 2 * ab else (i, j)
        noten.append((i * RAHMEN_S, j * RAHMEN_S, _median_stimmhaft(midi, prob, *kern)))
    return noten


# ── Anschläge, Trennen, Verbinden ──

def anschlaege_finden(db: np.ndarray, anstieg_db: float, fenster_s: float = 0.025, abstand_s: float = 0.09) -> np.ndarray:
    """Rahmen, an denen der Pegel binnen `fenster_s` um mindestens `anstieg_db`
    steigt — ein Neuansatz (pYIN: Faktor 1/0,7 ≈ 3 dB in zwei Rahmen). Je
    Anstieg der Rahmen mit dem größten Sprung, höchstens einer je `abstand_s`
    (ROSVOT: 90 ms Mindestabstand von Notengrenzen). Der gemeldete Rahmen ist
    der Beginn des Anstiegs."""
    if anstieg_db <= 0 or len(db) < 3:
        return np.array([], dtype=int)
    w = max(1, int(round(fenster_s / RAHMEN_S)))
    frueher = np.concatenate([np.full(w, db[0]), db[:-w]])
    anstieg = db - frueher
    rahmen: list[int] = []
    i = 0
    while i < len(anstieg):
        if anstieg[i] < anstieg_db:
            i += 1
            continue
        j, best = i, i
        while j < len(anstieg) and anstieg[j] >= anstieg_db:
            if anstieg[j] > anstieg[best]:
                best = j
            j += 1
        r = max(0, best - w // 2)
        if not rahmen or (r - rahmen[-1]) * RAHMEN_S >= abstand_s:
            rahmen.append(r)
        i = j
    return np.array(rahmen, dtype=int)


def an_anschlaegen_teilen(bereiche, anschlaege: np.ndarray, mindest_rahmen: int):
    """Einen Bereich an Neuansätzen in seinem Inneren teilen (gleicher Ton, neu
    angesetzt — „schwim-men auf dem"). Schnitte, die ein Stück kürzer als
    `mindest_rahmen` ließen, werden ausgelassen."""
    ergebnis = []
    for i, j in bereiche:
        grenzen = [i]
        for x in sorted(int(x) for x in anschlaege if i + mindest_rahmen <= x <= j - mindest_rahmen):
            if x - grenzen[-1] >= mindest_rahmen:
                grenzen.append(x)
        grenzen.append(j)
        ergebnis.extend(zip(grenzen, grenzen[1:]))
    return ergebnis


def kurze_verwerfen(bereiche, mindest_rahmen: int):
    return [(i, j) for i, j in bereiche if j - i >= mindest_rahmen]


def gleiche_verbinden(noten, anschlaege_s: np.ndarray, luecke_s: float, vorher_s: float = 0.1, nachher_s: float = 0.03):
    """Aufeinanderfolgende gleiche Töne über eine Lücke bis `luecke_s`
    verschmelzen, wenn kein Anschlag in der Lücke liegt (sonst war es ein
    Neuansatz). Der Anschlag darf bis `vorher_s` vor dem Ende der Vornote
    liegen (der Konsonant beginnt vor der Stimmpause) und `nachher_s` danach."""
    ergebnis = []
    for s, e, t in noten:
        if ergebnis:
            vs, ve, vt = ergebnis[-1]
            neu = ((anschlaege_s >= ve - vorher_s) & (anschlaege_s <= s + nachher_s)).any() if len(anschlaege_s) else False
            if t == vt and 0 <= s - ve < luecke_s and not neu:
                ergebnis[-1] = (vs, e, vt)
                continue
        ergebnis.append((s, e, t))
    return ergebnis


# ── Tonart ──

TONNAMEN = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "H": 11, "B": 11}
DUR = (0, 2, 4, 5, 7, 9, 11)
MOLL = (0, 2, 3, 5, 7, 8, 10)


def _grund_und_moll(tonart: str) -> tuple[int, bool]:
    s = tonart.strip()
    moll = s.endswith("m") or s[0].islower()
    s = s.rstrip("m")
    grund = TONNAMEN[s[0].upper()]
    for z in s[1:]:
        grund += {"#": 1, "b": -1, "B": -1}.get(z, 0)
    return grund % 12, moll


def tonleiter(tonart: str | None) -> set[int] | None:
    """'C', 'F#', 'Bb' → Dur; 'a', 'f#m', 'Am' → Moll. Ergebnis: erlaubte Tonklassen 0–11."""
    if not tonart:
        return None
    grund, moll = _grund_und_moll(tonart)
    return {(grund + stufe) % 12 for stufe in (MOLL if moll else DUR)}


def auf_leiter(tonhoehe: float, leiter: set[int] | None) -> int:
    """Gemessene (Fließkomma-)Tonhöhe auf den nächsten Leiterton runden."""
    if leiter is None:
        return int(round(tonhoehe))
    kandidaten = [k for k in range(int(tonhoehe) - 1, int(tonhoehe) + 3) if k % 12 in leiter]
    return min(kandidaten, key=lambda k: abs(k - tonhoehe))


def tonart_nummer(tonart: str | None) -> int | None:
    """pretty_midi-Zählung: 0–11 Dur ab C, 12–23 Moll ab c."""
    if not tonart:
        return None
    grund, moll = _grund_und_moll(tonart)
    return grund + (12 if moll else 0)


# ── Nachbesserung ──

def nachbessern(noten, kurz_s: float):
    """Typische Gesangsartefakte: Eine kurze Note, die zu beiden Nachbarn etwa
    eine Oktave springt, ist ein Oktavfehler und rückt in deren Lage. Eine
    kurze Note direkt vor einer längeren, höchstens zwei Halbtöne entfernt,
    ist ein angeschliffener Ansatz und geht in diese auf."""
    noten = list(noten)
    for i, (s, e, t) in enumerate(noten):
        if e - s > kurz_s:
            continue
        nachbarn = [noten[j][2] for j in (i - 1, i + 1) if 0 <= j < len(noten)]
        if nachbarn and all(10 <= abs(t - n) <= 14 for n in nachbarn):
            noten[i] = (s, e, t + (12 if nachbarn[0] > t else -12))
    ergebnis = []
    i = 0
    while i < len(noten):
        s, e, t = noten[i]
        folgt = noten[i + 1] if i + 1 < len(noten) else None
        if folgt and e - s <= kurz_s and folgt[0] - e < kurz_s and abs(folgt[2] - t) <= 2 and folgt[1] - folgt[0] > e - s:
            ergebnis.append((s, folgt[1], folgt[2]))
            i += 2
            continue
        ergebnis.append((s, e, t))
        i += 1
    return ergebnis


# ── Versatz und Rasterung ──

def versatz_schaetzen(noten, tempo: float) -> float:
    """Gemeinsame Verspätung aller Einsätze gegen das Achtelraster (Latenz).

    Zirkulärer Mittelwert der Einsatzphasen; nur übernommen, wenn die
    Einsätze einigermaßen einheitlich liegen (sonst wäre es Synkopik).
    """
    if len(noten) < 4:
        return 0.0
    achtel = 60.0 / tempo / 2
    phasen = np.array([s % achtel for s, _, _ in noten]) / achtel * 2 * np.pi
    x, y = np.cos(phasen).mean(), np.sin(phasen).mean()
    konsistenz = float(np.hypot(x, y))
    mittel = (float(np.arctan2(y, x)) % (2 * np.pi)) / (2 * np.pi) * achtel
    if konsistenz < 0.4:
        print(f"→ Einsätze uneinheitlich (Konsistenz {konsistenz:.2f}), kein Versatz angenommen")
        return 0.0
    print(f"→ Einsätze liegen im Mittel {mittel*1000:.0f} ms hinter dem Achtelraster (Konsistenz {konsistenz:.2f}), Noten werden vorgezogen")
    return mittel


def _ebene(zelle: int, je_schlag: int) -> int:
    """Metrische Ebene einer Zelle: 0 Schlag, 1 Achtel, 2 feiner."""
    if zelle % je_schlag == 0:
        return 0
    if je_schlag % 2 == 0 and zelle % (je_schlag // 2) == 0:
        return 1
    return 2


def einsaetze_rastern(starts: list[float], schritt: float, je_schlag: int, strafe: float = 0.35) -> list[int]:
    """Alle Einsätze gemeinsam auf Zellen runden (dynamische Programmierung).

    Kandidaten je Einsatz: die Zelle davor und danach. Kosten: Abweichung in
    Zellen plus eine Strafe, wenn die Zelle metrisch feiner liegt, als der
    Abstand zur Nachbarnote nahelegt (MuseScore-Import: eine Note von
    Viertellänge gehört selten auf ein Sechzehntel-Offbeat). Zwei Einsätze
    teilen sich nie eine Zelle.
    """
    if not starts:
        return []
    kandidaten = []
    for i, s in enumerate(starts):
        x = s / schritt
        ioi = (starts[i + 1] - s) if i + 1 < len(starts) else (s - starts[i - 1] if i else schritt * je_schlag)
        ioi_z = ioi / schritt
        ebene_laenge = 0 if ioi_z >= 0.75 * je_schlag else 1 if ioi_z >= 0.375 * je_schlag else 2
        k = []
        for z in sorted({int(np.floor(x)), int(np.ceil(x))}):
            z = max(0, z)
            kosten = abs(x - z) + strafe * max(0, _ebene(z, je_schlag) - ebene_laenge)
            k.append((z, kosten))
        kandidaten.append(k)
    # DP mit Bedingung: Zellen streng aufsteigend
    beste: list[list[tuple[float, int]]] = []   # je Einsatz, je Kandidat: (Gesamtkosten, Vorgänger-Index)
    for i, k in enumerate(kandidaten):
        zeile = []
        for z, kosten in k:
            if i == 0:
                zeile.append((kosten, -1))
                continue
            optionen = [(beste[i - 1][j][0] + kosten, j) for j, (vz, _) in enumerate(kandidaten[i - 1]) if vz < z and beste[i - 1][j][0] < np.inf]
            zeile.append(min(optionen) if optionen else (np.inf, -1))
        beste.append(zeile)
    if all(k[0] == np.inf for k in beste[-1]):
        # Ausweg: nacheinander runden und Kollisionen nach hinten schieben
        zellen, letzte = [], -1
        for s in starts:
            z = max(int(round(s / schritt)), letzte + 1)
            zellen.append(z)
            letzte = z
        return zellen
    j = min(range(len(beste[-1])), key=lambda j: beste[-1][j][0])
    zellen = []
    for i in range(len(kandidaten) - 1, -1, -1):
        zellen.append(kandidaten[i][j][0])
        j = beste[i][j][1]
    return zellen[::-1]


def quantisieren(noten, p: Parameter):
    """Noten (s) → Noten auf dem Raster (s), Legato-Regel.

    Nur die Einsätze werden gerundet. Jede Note dauert bis zum nächsten
    Einsatz; nur wenn die Stille vor dem nächsten Einsatz mindestens
    `pause_s` lang ist, endet sie früher (gerundetes Ende, mindestens eine
    Zelle). Die letzte Note endet an ihrem gerundeten Ende.
    """
    if not noten:
        return []
    schritt = p.schritt()
    je_schlag = p.raster // 4 if p.raster % 4 == 0 else max(1, p.raster // 4)
    starts = [s - p.versatz for s, _, _ in noten]
    zellen = einsaetze_rastern(starts, schritt, je_schlag)
    pause = p.pause_s()
    ergebnis = []
    for i, ((s, e, t), z) in enumerate(zip(noten, zellen)):
        ende_z = max(z + 1, int(round((e - p.versatz) / schritt)))
        if i + 1 < len(noten):
            naechste = zellen[i + 1]
            stille = noten[i + 1][0] - e
            ende_z = min(naechste, ende_z) if stille >= pause else naechste
            ende_z = max(z + 1, min(ende_z, naechste))
        ergebnis.append((z * schritt + p.versatz, ende_z * schritt + p.versatz, t))
    return ergebnis


# ── Gesamtablauf ──

def segmentieren(midi: np.ndarray, prob: np.ndarray, db: np.ndarray, p: Parameter):
    """Tonhöhenspur → Noten in Sekunden (noch ohne Raster). Liefert auch die Zählung je Stufe."""
    import librosa

    prob = np.where(db < p.leise, 0.0, prob)
    hmm = NotenHMM(librosa.hz_to_midi(p.von), librosa.hz_to_midi(p.bis))
    mindest = max(1, int(round(p.mindest / 1000 / RAHMEN_S)))
    roh = bereiche_aus_zustaenden(hmm.dekodieren(midi, prob))
    wechsel = an_tonwechseln_teilen(roh, midi, prob, mindest, int(round(p.ansatz / 1000 / RAHMEN_S)))
    anschlaege = anschlaege_finden(db, p.anschlag)
    geteilt = kurze_verwerfen(an_anschlaegen_teilen(wechsel, anschlaege, mindest), mindest)
    noten = noten_aus_bereichen(geteilt, midi, prob, p.ansatz / 1000)
    leiter = tonleiter(p.tonart)
    gerundet = [(s, e, auf_leiter(t, leiter)) for s, e, t in noten]
    verbunden = gleiche_verbinden(gerundet, anschlaege * RAHMEN_S, p.luecke / 1000)
    # „kurz" = bis zu einer Rasterzelle: ein angeschliffener Ansatz samt Konsonant ist so lang.
    gebessert = nachbessern(verbunden, kurz_s=p.schritt() * 1.1) if p.nachbessern else verbunden
    zaehlung = f"{len(roh)} HMM-Noten, {len(wechsel)} nach Tonwechseln, {len(geteilt)} nach Anschlägen (≥ {p.mindest:.0f} ms), {len(verbunden)} nach Verbinden, {len(gebessert)} nach Nachbesserung"
    return gebessert, zaehlung


def noten_aus_signal(y: np.ndarray, p: Parameter, bericht: bool = True) -> list[tuple[float, float, int]]:
    """Audio → quantisierte Noten (start_s, ende_s, midi)."""
    midi, prob, db = tonhoehe_verfolgen(y, p.von, p.bis)
    gebessert, zaehlung = segmentieren(midi, prob, db, p)
    noten = quantisieren(gebessert, p)
    if bericht:
        print(f"→ {zaehlung}, {len(noten)} auf dem Raster")
    return noten


def taktversatz(schlagzeug: Path, tempo: float) -> float:
    """Wo liegt der erste Schlag? Aus dem Schlagzeug-Stem, damit das Raster auf dem Beat sitzt."""
    import librosa

    y, _ = librosa.load(schlagzeug, sr=SR, mono=True)
    _, beats = librosa.beat.beat_track(y=y, sr=SR, hop_length=HOP, start_bpm=tempo, tightness=400)
    zeiten = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)
    periode = 60.0 / tempo
    winkel = np.mod(zeiten, periode) / periode * 2 * np.pi
    mittel = np.arctan2(np.sin(winkel).mean(), np.cos(winkel).mean()) % (2 * np.pi)
    versatz = float(mittel / (2 * np.pi) * periode)
    print(f"→ Taktversatz aus {schlagzeug.name}: {versatz*1000:.0f} ms")
    return versatz


def spur_bauen(datei: Path, p: Parameter, versatz_auto: bool) -> list[tuple[float, float, int]]:
    import librosa

    y, _ = librosa.load(datei, sr=SR, mono=True)
    print(f"→ {datei.name}: pYIN {p.von:.0f}–{p.bis:.0f} Hz, Noten-HMM …")
    midi, prob, db = tonhoehe_verfolgen(y, p.von, p.bis)
    noten, zaehlung = segmentieren(midi, prob, db, p)
    if versatz_auto:
        # Latenz aus den Einsätzen schätzen und die Noten vorziehen; das Raster bleibt bei 0.
        spaet = versatz_schaetzen(noten, p.tempo)
        noten = [(max(0.0, s - spaet), max(0.0, e - spaet), t) for s, e, t in noten]
        p.versatz = 0.0
    gerastert = quantisieren(noten, p)
    print(f"→ {zaehlung}, {len(gerastert)} auf dem Raster")
    return gerastert


# ── Ausgabe ──

def midi_schreiben(spuren: list[tuple[str, int, list]], tempo: float, ziel: Path,
                   tonart: str | None = None, schlaege: int = 4) -> None:
    import pretty_midi

    pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    pm.time_signature_changes.append(pretty_midi.TimeSignature(schlaege, 4, 0.0))
    nummer = tonart_nummer(tonart)
    if nummer is not None:
        pm.key_signature_changes.append(pretty_midi.KeySignature(nummer, 0.0))
    for name, programm, noten in spuren:
        inst = pretty_midi.Instrument(program=programm, name=name)
        for start, ende, ton in noten:
            inst.notes.append(pretty_midi.Note(velocity=90, pitch=int(ton), start=start, end=ende))
        pm.instruments.append(inst)
    pm.write(str(ziel))
    print(f"→ {ziel}")


def musicxml_schreiben(spuren: list[tuple[str, int, list]], tempo: float, raster: int, ziel: Path,
                       tonart: str | None = None, schlaege: int = 4) -> None:
    """Noten direkt als Partitur (music21). Die Noten liegen schon auf dem
    Raster; hier werden nur Takte, Pausen und Haltebögen gesetzt."""
    from music21 import clef, instrument, key, meter, note, stream, tempo as m21tempo, metadata

    schritt_s = 60.0 / tempo * 4 / raster
    ql_je_schritt = 4.0 / raster

    partitur = stream.Score()
    partitur.metadata = metadata.Metadata(title=ziel.stem, composer="eingesungen")
    for name, _programm, noten in spuren:
        part = stream.Part()
        part.partName = name
        inst = instrument.Vocalist() if name.lower().startswith("gesang") else instrument.fromString(name) if name.lower() != "bass" else instrument.ElectricBass()
        inst.partName = name
        part.insert(0, inst)
        mittel = float(np.median([t for _, _, t in noten])) if noten else 60.0
        part.insert(0, clef.BassClef() if mittel < 50 else clef.Treble8vbClef() if mittel < 62 else clef.TrebleClef())
        part.insert(0, meter.TimeSignature(f"{schlaege}/4"))
        if tonart:
            s = tonart.strip()
            moll = s.endswith("m") or s[0].islower()
            part.insert(0, key.Key(s.rstrip("m").replace("H", "B"), "minor" if moll else "major"))
        part.insert(0, m21tempo.MetronomeMark(number=tempo))
        for start, ende, ton in noten:
            n = note.Note(int(ton))
            n.quarterLength = max(1, round((ende - start) / schritt_s)) * ql_je_schritt
            part.insert(round(start / schritt_s) * ql_je_schritt, n)
        part.makeMeasures(inPlace=True)
        part.makeRests(fillGaps=True, inPlace=True, timeRangeFromBarDuration=True)
        part.makeTies(inPlace=True)
        partitur.append(part)
    partitur.write("musicxml", fp=str(ziel))
    print(f"→ {ziel}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dateien", type=Path, nargs="+", help="Audio-Dateien, je eine Stimme")
    p.add_argument("--tempo", type=float, required=True, help="Tempo in bpm (Pflicht, Raster hängt daran)")
    p.add_argument("--raster", type=int, default=16, help="Rasterteilung je Takt: 8 (Achtel), 16 (Sechzehntel, Standard)")
    p.add_argument("--von", type=float, default=80.0, help="tiefste Frequenz in Hz (Gesang 80, Bass 30)")
    p.add_argument("--bis", type=float, default=1000.0, help="höchste Frequenz in Hz (Gesang 1000, Bass 400)")
    p.add_argument("--leise", type=float, default=-40.0, help="Rahmen leiser als x dB unter Maximum zählen als stumm (Standard -40)")
    p.add_argument("--mindest", type=float, default=100.0, help="Mindestlänge einer Note in ms (Standard 100, wie pYIN/Omnizart)")
    p.add_argument("--luecke", type=float, default=130.0, help="gleiche Töne über Lücken bis x ms verbinden, wenn kein Anschlag dazwischen liegt (Standard 130)")
    p.add_argument("--anschlag", type=float, default=4.0, help="Pegelanstieg in dB binnen 25 ms, der einen Neuansatz auf gleichem Ton anzeigt (Standard 4; 0 = aus)")
    p.add_argument("--pause", type=float, default=None, help="Stille ab x Sekunden wird als Pause notiert (Standard: ein Achtel beim Tempo, mindestens 0,15 s)")
    p.add_argument("--ansatz", type=float, default=60.0, help="ms am Notenanfang, die beim Tonhöhen-Median ausgelassen werden (Standard 60)")
    p.add_argument("--nachbessern", action=argparse.BooleanOptionalAction, default=True, help="Oktavfehler und angeschliffene Ansatztöne korrigieren (Standard an)")
    p.add_argument("--schlaege", type=int, default=4, help="Schläge je Takt (Standard 4)")
    p.add_argument("--musicxml", action=argparse.BooleanOptionalAction, default=True, help="zusätzlich MusicXML schreiben (Standard an)")
    p.add_argument("--tonart", help="Töne auf diese Leiter ziehen, z. B. C, G, F#, Bb (Dur) oder a, Am, f#m (Moll)")
    p.add_argument("--versatz", default=None, help="Zeit des ersten Schlags in s, oder 'auto': aus den Noteneinsätzen schätzen (sonst aus --schlagzeug oder 0)")
    p.add_argument("--schlagzeug", type=Path, help="Schlagzeug-Stem zur Bestimmung des Taktversatzes")
    p.add_argument("--programm", type=int, default=65, help="General-MIDI-Programm (65 Altsax, 33 E-Bass, 0 Klavier)")
    p.add_argument("--name", default="Gesang", help="Spurname")
    p.add_argument("--ziel", type=Path, help="Ziel-MIDI (Standard: <datei>-mono.mid bzw. gesamt-mono.mid)")
    args = p.parse_args()

    versatz_auto = args.versatz == "auto"
    if args.versatz is None:
        versatz = taktversatz(args.schlagzeug, args.tempo) if args.schlagzeug else 0.0
    else:
        versatz = 0.0 if versatz_auto else float(args.versatz)

    spuren = []
    for datei in args.dateien:
        param = Parameter(tempo=args.tempo, raster=args.raster, schlaege=args.schlaege, von=args.von, bis=args.bis,
                          leise=args.leise, mindest=args.mindest, luecke=args.luecke, anschlag=args.anschlag,
                          pause=args.pause, ansatz=args.ansatz, tonart=args.tonart, versatz=versatz,
                          nachbessern=args.nachbessern)
        noten = spur_bauen(datei, param, versatz_auto)
        name = args.name if len(args.dateien) == 1 else f"{args.name} {datei.stem}"
        spuren.append((name, args.programm, noten))

    if args.ziel:
        ziel = args.ziel
    elif len(args.dateien) == 1:
        ziel = args.dateien[0].with_name(args.dateien[0].stem + "-mono.mid")
    else:
        ziel = args.dateien[0].with_name("gesamt-mono.mid")
    ziel.parent.mkdir(parents=True, exist_ok=True)
    midi_schreiben(spuren, args.tempo, ziel, tonart=args.tonart, schlaege=args.schlaege)
    if args.musicxml:
        try:
            musicxml_schreiben(spuren, args.tempo, args.raster, ziel.with_suffix(".musicxml"),
                               tonart=args.tonart, schlaege=args.schlaege)
        except Exception as fehler:  # noqa: BLE001 — Experiment, alles zeigen
            print(f"! MusicXML fehlgeschlagen ({fehler}); MIDI bleibt.")


if __name__ == "__main__":
    main()
