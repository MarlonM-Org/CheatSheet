#!/usr/bin/env python3
"""Monophone Lesart: eine Stimme (Gesang, Bass, eingesungene Melodie) → MIDI.

Statt des polyphonen Basic Pitch verfolgt pYIN die eine stärkste Tonhöhe je
Zeitpunkt. Hall, Obertöne und Begleitreste fallen damit von selbst weg, weil
immer nur ein Ton gilt. Danach wird auf ein Taktraster gerundet.

    python monophon.py ergebnis/<song>/stem-vocals.wav --tempo 66
    python monophon.py gesang.wav --tempo 96 --von 80 --bis 1000 --raster 8
    python monophon.py stem-bass.wav --tempo 66 --von 30 --bis 400 --programm 33 --name Bass

Ergebnis: <datei>-mono.mid neben der Eingabe (oder --ziel). Mehrere Ergebnisse
führt transkribieren.py --nur-zusammenfuehren NICHT ein (eigener Ordner), dafür
gibt es hier --zusammen: alle angegebenen Dateien in eine gesamt-mono.mid.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

SR = 22050          # reicht für Tonhöhe, halbiert die Rechenzeit
HOP = 256           # ≈ 11,6 ms je Rahmen


def tonhoehe_verfolgen(y: np.ndarray, von: float, bis: float, sicher: float):
    """pYIN: je Rahmen MIDI-Tonhöhe (float) oder NaN, dazu Lautstärke in dB."""
    import librosa

    f0, voiced, prob = librosa.pyin(y, fmin=von, fmax=bis, sr=SR, frame_length=2048, hop_length=HOP)
    midi = librosa.hz_to_midi(f0)
    midi[~voiced] = np.nan
    midi[prob < sicher] = np.nan
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
    db = librosa.amplitude_to_db(rms, ref=np.max)
    n = min(len(midi), len(db))
    return midi[:n], db[:n]


def glaetten(midi: np.ndarray, fenster: int = 7) -> np.ndarray:
    """Medianfilter über die Tonhöhe, damit Vibrato und Ausreißer keine Noten bilden."""
    from scipy.ndimage import median_filter

    gefuellt = np.where(np.isnan(midi), -1000.0, midi)
    geglaettet = median_filter(gefuellt, size=fenster, mode="nearest")
    geglaettet[np.isnan(midi)] = np.nan
    geglaettet[geglaettet < -500] = np.nan
    return geglaettet


def luecken_fuellen(midi: np.ndarray, db: np.ndarray, leise_db: float, max_rahmen: int, sprung: float = 0.75) -> np.ndarray:
    """Kurze Aussetzer von pYIN innerhalb eines klingenden Tons überbrücken.

    Ist ein Loch höchstens `max_rahmen` lang, bleibt der Klang laut und liegt die
    Tonhöhe davor und danach nah beieinander, wird der Ton durchgehalten.
    """
    m = midi.copy()
    n = len(m)
    i = 0
    while i < n:
        if not np.isnan(m[i]):
            i += 1
            continue
        j = i
        while j < n and np.isnan(m[j]):
            j += 1
        laenge = j - i
        if 0 < i and j < n and laenge <= max_rahmen and abs(m[i - 1] - m[j]) < sprung and (db[i:j] >= leise_db).all():
            m[i:j] = np.linspace(m[i - 1], m[j], laenge + 2)[1:-1]
        i = j
    return m


def onsets_finden(y: np.ndarray, staerke: float = 0.07) -> np.ndarray:
    """Anschlagzeiten in Sekunden; entscheiden, ob gleiche Töne hintereinander neu angesetzt wurden.

    `staerke`: Mindesthöhe eines Anschlags relativ zum stärksten (0–1). Höher =
    weniger, aber deutlichere Anschläge; schützt lange Töne vor Zerstückelung.
    """
    import librosa

    return librosa.onset.onset_detect(y=y, sr=SR, hop_length=HOP, units="time", backtrack=False, delta=staerke)


def senken_finden(db: np.ndarray, tiefe_db: float, vorher_s: float = 0.3, nachher_s: float = 0.12) -> np.ndarray:
    """Silbengrenzen als Lautstärke-Einbrüche: lokales Minimum, das mindestens
    `tiefe_db` unter dem Maximum der letzten `vorher_s` (langsames Ausklingen
    erlaubt) und unter dem Maximum der nächsten `nachher_s` (rascher Neuansatz) liegt."""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d

    r_vor = max(1, int(vorher_s * SR / HOP))
    r_nach = max(1, int(nachher_s * SR / HOP))
    links = maximum_filter1d(db, size=r_vor, origin=(r_vor - 1) // 2)    # Maximum der letzten r_vor Rahmen
    rechts = maximum_filter1d(db, size=r_nach, origin=-(r_nach // 2))    # Maximum der nächsten r_nach Rahmen
    minima = db == minimum_filter1d(db, size=r_nach)
    senken = np.flatnonzero(minima & (links - db >= tiefe_db) & (rechts - db >= tiefe_db))
    return senken * HOP / SR


def silben_teilen(noten, grenzen_s: np.ndarray, mindest_s: float):
    """Eine Note an Anschlägen oder Lautstärke-Senken in ihrem Inneren teilen
    (gleicher Ton, neu angesetzt). Schnitte dichter als `mindest_s` werden ausgelassen."""
    ergebnis = []
    for s, e, t in noten:
        grenzen = [s]
        for x in sorted(float(x) for x in grenzen_s if s + mindest_s <= x <= e - mindest_s):
            if x - grenzen[-1] >= mindest_s:
                grenzen.append(x)
        grenzen.append(e)
        for a, b in zip(grenzen, grenzen[1:]):
            ergebnis.append((a, b, t))
    return ergebnis


def gleiche_toene_verbinden(noten, onsets: np.ndarray, max_luecke_s: float, toleranz_s: float = 0.06):
    """Aufeinanderfolgende gleiche Töne verschmelzen, wenn dazwischen kein Anschlag liegt."""
    ergebnis = []
    for n in noten:
        if ergebnis:
            v = ergebnis[-1]
            luecke = n[0] - v[1]
            neu_angesetzt = ((onsets >= v[1] - toleranz_s) & (onsets <= n[0] + toleranz_s)).any()
            if n[2] == v[2] and luecke < max_luecke_s and not neu_angesetzt:
                ergebnis[-1] = (v[0], n[1], v[2])
                continue
        ergebnis.append(n)
    return ergebnis


TONNAMEN = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "H": 11, "B": 11}
DUR = (0, 2, 4, 5, 7, 9, 11)
MOLL = (0, 2, 3, 5, 7, 8, 10)


def tonleiter(tonart: str | None) -> set[int] | None:
    """'C', 'F#', 'Bb' → Dur; 'a', 'f#m', 'Am' → Moll. Ergebnis: erlaubte Tonklassen 0–11."""
    if not tonart:
        return None
    s = tonart.strip()
    moll = s.endswith("m") or s[0].islower()
    s = s.rstrip("m")
    grund = TONNAMEN[s[0].upper()]
    for z in s[1:]:
        grund += {"#": 1, "b": -1, "B": -1}.get(z, 0)
    return {(grund + stufe) % 12 for stufe in (MOLL if moll else DUR)}


def auf_leiter(tonhoehe: float, leiter: set[int] | None) -> int:
    """Gemessene (Fließkomma-)Tonhöhe auf den nächsten Leiterton runden."""
    if leiter is None:
        return int(round(tonhoehe))
    kandidaten = [k for k in range(int(tonhoehe) - 1, int(tonhoehe) + 3) if k % 12 in leiter]
    return min(kandidaten, key=lambda k: abs(k - tonhoehe))


def segmentieren(midi: np.ndarray, db: np.ndarray, leise_db: float, mindest_s: float, luecke_s: float,
                 sprung: float = 0.75, leiter: set[int] | None = None):
    """Rahmen → Noten (start, ende, tonhöhe).

    Eine Note läuft weiter, solange die Tonhöhe weniger als `sprung` Halbtöne von
    ihrem Mittel abweicht (Hysterese: Vibrato um die Halbtongrenze zerhackt so
    keine langen Töne). Die Tonhöhe der Note ist der Median ihrer Rahmen.
    """
    dauer = HOP / SR
    noten = []
    aktuell = None  # [start, ende, [rahmen-tonhöhen]]

    def abschliessen():
        if aktuell:
            noten.append((aktuell[0], aktuell[1], auf_leiter(float(np.median(aktuell[2])), leiter)))

    for i, (m, lautstaerke) in enumerate(zip(midi, db)):
        t = i * dauer
        stumm = np.isnan(m) or lautstaerke < leise_db
        if stumm:
            abschliessen()
            aktuell = None
            continue
        # Vergleich mit dem Median der ganzen Note, nicht der letzten Rahmen:
        # sonst wandert die Hysterese mit einem langsamen Gleiten (Portamento) mit.
        if aktuell and abs(m - np.median(aktuell[2])) < sprung:
            aktuell[1] = t + dauer
            aktuell[2].append(m)
            continue
        abschliessen()
        aktuell = [t, t + dauer, [m]]
    abschliessen()

    # kurze Lücken zwischen gleichen Tönen schließen (Atmer, Konsonanten)
    verbunden = []
    for n in noten:
        if verbunden and n[2] == verbunden[-1][2] and n[0] - verbunden[-1][1] < luecke_s:
            verbunden[-1] = (verbunden[-1][0], n[1], n[2])
        else:
            verbunden.append(n)
    return [n for n in verbunden if n[1] - n[0] >= mindest_s]


def anfang_auf_anschlag(noten, onsets: np.ndarray, max_s: float = 0.18):
    """Notenanfang auf den akustischen Anschlag kurz davor ziehen.

    pYIN rastet erst ein, wenn der Vokal klingt; der Konsonant davor gehört aber
    zur Note. Liegt ein Anschlag bis `max_s` vor dem erkannten Beginn (und nach
    dem Ende der Vornote), beginnt die Note dort.
    """
    ergebnis = []
    for i, (s, e, t) in enumerate(noten):
        untergrenze = ergebnis[-1][1] if ergebnis else -1.0
        kandidaten = onsets[(onsets < s) & (onsets >= max(s - max_s, untergrenze))]
        if len(kandidaten):
            s = float(kandidaten.max())
        ergebnis.append((s, e, t))
    return ergebnis


def nachbessern(noten, kurz_s: float):
    """Typische Gesangsartefakte entfernen.

    Oktavfehler: kurze Note, die zu beiden Nachbarn etwa eine Oktave springt,
    wird in deren Lage geschoben. Ansatz: kurze Note, die direkt vor einer
    längeren Note liegt und höchstens zwei Halbtöne von ihr entfernt ist, geht
    in diese auf (der Ton wurde „angeschliffen", nicht gemeint).
    """
    noten = list(noten)
    for i, (s, e, t) in enumerate(noten):
        if e - s > kurz_s:
            continue
        nachbarn = [noten[j][2] for j in (i - 1, i + 1) if 0 <= j < len(noten)]
        if nachbarn and all(10 <= abs(t - n) <= 14 for n in nachbarn):
            richtung = 12 if nachbarn[0] > t else -12
            noten[i] = (s, e, t + richtung)
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


def versatz_schaetzen(noten, tempo: float) -> float:
    """Gemeinsame Verschiebung aller Noteneinsätze gegen das Achtelraster (Latenz, spätes Einsetzen).

    Zirkulärer Mittelwert der Einsatzphasen. Nur übernommen, wenn die Einsätze
    einigermaßen einheitlich liegen (sonst wäre es Synkopik, keine Latenz).
    """
    if len(noten) < 4:
        return 0.0
    achtel = 60.0 / tempo / 2
    phasen = np.array([s % achtel for s, _, _ in noten]) / achtel * 2 * np.pi
    x, y = np.cos(phasen).mean(), np.sin(phasen).mean()
    konsistenz = float(np.hypot(x, y))
    # Latenz macht Einsätze nur später, nie früher: Phase in [0, achtel) lesen.
    mittel = (float(np.arctan2(y, x)) % (2 * np.pi)) / (2 * np.pi) * achtel
    if konsistenz < 0.4:
        print(f"→ Einsätze uneinheitlich (Konsistenz {konsistenz:.2f}), kein Versatz angenommen")
        return 0.0
    print(f"→ Einsätze liegen im Mittel {mittel*1000:.0f} ms hinter dem Achtelraster (Konsistenz {konsistenz:.2f}), Noten werden vorgezogen")
    return mittel


def quantisieren(noten, tempo: float, raster: int, versatz: float):
    """Start und Ende auf das Raster runden (raster=16: Sechzehntel). Mindestens eine Rastereinheit."""
    schritt = 60.0 / tempo * 4 / raster
    ergebnis = []
    for start, ende, ton in noten:
        s = round((start - versatz) / schritt)
        e = round((ende - versatz) / schritt)
        if e <= s:
            e = s + 1
        ergebnis.append((s * schritt + versatz, e * schritt + versatz, ton))
    # Überlappungen nach dem Runden: vorherige Note kürzen
    for i in range(1, len(ergebnis)):
        if ergebnis[i - 1][1] > ergebnis[i][0]:
            ergebnis[i - 1] = (ergebnis[i - 1][0], ergebnis[i][0], ergebnis[i - 1][2])
    return [n for n in ergebnis if n[1] > n[0]]


def taktversatz(schlagzeug: Path, tempo: float) -> float:
    """Wo liegt der erste Schlag? Aus dem Schlagzeug-Stem, damit das Raster auf dem Beat sitzt."""
    import librosa

    y, _ = librosa.load(schlagzeug, sr=SR, mono=True)
    _, beats = librosa.beat.beat_track(y=y, sr=SR, hop_length=HOP, start_bpm=tempo, tightness=400)
    zeiten = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)
    periode = 60.0 / tempo
    phasen = np.mod(zeiten, periode)
    # zirkulärer Mittelwert der Phase
    winkel = phasen / periode * 2 * np.pi
    mittel = np.arctan2(np.sin(winkel).mean(), np.cos(winkel).mean()) % (2 * np.pi)
    versatz = float(mittel / (2 * np.pi) * periode)
    print(f"→ Taktversatz aus {schlagzeug.name}: {versatz*1000:.0f} ms")
    return versatz


def spur_bauen(datei: Path, args) -> tuple[list, int]:
    import librosa

    y, _ = librosa.load(datei, sr=SR, mono=True)
    print(f"→ {datei.name}: pYIN {args.von:.0f}–{args.bis:.0f} Hz …")
    midi, db = tonhoehe_verfolgen(y, args.von, args.bis, args.sicher)
    midi = glaetten(midi)
    midi = luecken_fuellen(midi, db, args.leise, max_rahmen=int(args.aussetzer / 1000 * SR / HOP))
    roh = segmentieren(midi, db, args.leise, args.mindest / 1000, args.luecke / 1000, leiter=tonleiter(args.tonart))
    onsets = onsets_finden(y, args.anschlag)
    # Versatz (Latenz) aus den Tonwechseln schätzen, bevor Silben geteilt werden:
    # Tonwechsel sind robust, Fragmente würden die Schätzung verzerren.
    spaet = versatz_schaetzen(roh, args.tempo) if args.versatz == "auto" else 0.0
    if args.senke > 0:
        # Neuansatz auf gleichem Ton = Anschlag UND Lautstärke-Senke dicht beieinander.
        senken = senken_finden(db, args.senke)
        teilpunkte = np.array([o for o in onsets if len(senken) and np.abs(senken - o).min() <= 0.12])
    else:
        teilpunkte = onsets
    roh = silben_teilen(roh, teilpunkte, args.mindest / 1000)
    verbunden = gleiche_toene_verbinden(roh, teilpunkte, args.verbinden / 1000)
    schritt = 60.0 / args.tempo * 4 / args.raster
    gebessert = nachbessern(verbunden, kurz_s=schritt * 0.75) if args.nachbessern else verbunden
    if args.nachbessern:
        gebessert = anfang_auf_anschlag(gebessert, onsets)
    if args.versatz == "auto":
        # Latenz: die Noten selbst nach vorn schieben, das Raster bleibt bei 0.
        gebessert = [(max(0.0, s - spaet), max(0.0, e - spaet), t) for s, e, t in gebessert]
        versatz = 0.0
    else:
        versatz = float(args.versatz)
    noten = quantisieren(gebessert, args.tempo, args.raster, versatz)
    print(f"→ {len(roh)} Segmente, {len(verbunden)} nach Anschlag-Prüfung, {len(gebessert)} nach Oktav/Ansatz-Korrektur, {len(noten)} nach Quantisierung")
    return noten, len(roh)


def tonart_nummer(tonart: str | None) -> int | None:
    """pretty_midi-Zählung: 0–11 Dur ab C, 12–23 Moll ab c."""
    if not tonart:
        return None
    s = tonart.strip()
    moll = s.endswith("m") or s[0].islower()
    s = s.rstrip("m")
    grund = TONNAMEN[s[0].upper()]
    for z in s[1:]:
        grund += {"#": 1, "b": -1, "B": -1}.get(z, 0)
    return grund % 12 + (12 if moll else 0)


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
    """Noten direkt als Partitur (music21), ohne MIDI-Import-Raterei.

    Schlüssel nach Stimmlage: Violinschlüssel, oktaviert für tiefe Männerstimme,
    Bassschlüssel für Bass. Tonart und Taktart stehen fest in der Datei.
    """
    from music21 import clef, instrument, key, meter, note, stream, tempo as m21tempo, metadata

    schritt_s = 60.0 / tempo * 4 / raster  # Sekunden je Rastereinheit
    ql_je_schritt = 4.0 / raster           # Viertel je Rastereinheit

    partitur = stream.Score()
    partitur.metadata = metadata.Metadata(title=ziel.stem, composer="eingesungen")
    for name, _programm, noten in spuren:
        part = stream.Part()
        part.partName = name
        inst = instrument.Vocalist() if name.lower().startswith("gesang") else instrument.fromString(name) if name.lower() != "bass" else instrument.ElectricBass()
        inst.partName = name
        part.insert(0, inst)
        mittel = float(np.median([t for _, _, t in noten])) if noten else 60.0
        if mittel < 50:
            part.insert(0, clef.BassClef())
        elif mittel < 62:
            part.insert(0, clef.Treble8vbClef())
        else:
            part.insert(0, clef.TrebleClef())
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
    p.add_argument("--raster", type=int, default=16, help="Rasterteilung je Takt: 8, 16 (Standard), 12 (Triolen-Achtel)")
    p.add_argument("--von", type=float, default=80.0, help="tiefste Frequenz in Hz (Gesang 80, Bass 30)")
    p.add_argument("--bis", type=float, default=1000.0, help="höchste Frequenz in Hz (Gesang 1000, Bass 400)")
    p.add_argument("--leise", type=float, default=-35.0, help="Rahmen leiser als x dB unter Maximum zählen nicht (Standard -35)")
    p.add_argument("--sicher", type=float, default=0.3, help="Mindest-Sicherheit von pYIN je Rahmen, 0–1 (Standard 0.3; Bass liegt oft nur bei 0.3–0.4)")
    p.add_argument("--mindest", type=float, default=80.0, help="Mindestlänge einer Note in ms vor der Quantisierung")
    p.add_argument("--luecke", type=float, default=60.0, help="Lücken bis x ms zwischen gleichen Tönen schließen")
    p.add_argument("--anschlag", type=float, default=0.18, help="Empfindlichkeit des Anschlag-Detektors, 0–1 relativ zum stärksten Anschlag (Standard 0.18, an Referenz abgeglichen; höher = nur deutliche Anschläge)")
    p.add_argument("--senke", type=float, default=0.0, help="wenn > 0: Neuansatz nur, wenn zum Anschlag auch ein Lautstärke-Einbruch von x dB gehört (Standard aus; hat im Abgleich Treffer gekostet)")
    p.add_argument("--aussetzer", type=float, default=150.0, help="pYIN-Aussetzer bis x ms innerhalb eines klingenden Tons überbrücken")
    p.add_argument("--verbinden", type=float, default=300.0, help="gleiche Töne mit Lücke bis x ms verschmelzen, wenn kein Anschlag dazwischen liegt")
    p.add_argument("--nachbessern", action=argparse.BooleanOptionalAction, default=True, help="Oktavfehler und angeschliffene Ansatztöne korrigieren (Standard an)")
    p.add_argument("--schlaege", type=int, default=4, help="Schläge je Takt für die Taktart in der MIDI-Datei (Standard 4)")
    p.add_argument("--musicxml", action=argparse.BooleanOptionalAction, default=True, help="zusätzlich MusicXML mit Schlüssel, Tonart, Taktart schreiben (Standard an)")
    p.add_argument("--tonart", help="Töne auf diese Leiter ziehen, z. B. C, G, F#, Bb (Dur) oder a, Am, f#m (Moll). Gleicht Intonationsdrift aus, bügelt aber echte Chromatik glatt.")
    p.add_argument("--versatz", default=None, help="Zeit des ersten Schlags in s, oder 'auto': aus den Noteneinsätzen schätzen (sonst aus --schlagzeug oder 0)")
    p.add_argument("--schlagzeug", type=Path, help="Schlagzeug-Stem zur Bestimmung des Taktversatzes")
    p.add_argument("--programm", type=int, default=65, help="General-MIDI-Programm (65 Altsax, 33 E-Bass, 0 Klavier)")
    p.add_argument("--name", default="Gesang", help="Spurname")
    p.add_argument("--ziel", type=Path, help="Ziel-MIDI (Standard: <datei>-mono.mid bzw. gesamt-mono.mid)")
    args = p.parse_args()

    if args.versatz is None:
        args.versatz = taktversatz(args.schlagzeug, args.tempo) if args.schlagzeug else 0.0

    spuren = []
    for datei in args.dateien:
        noten, _ = spur_bauen(datei, args)
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
