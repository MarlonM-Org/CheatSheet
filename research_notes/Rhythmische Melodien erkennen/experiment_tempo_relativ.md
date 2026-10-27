# Eigenes Experiment (27.10.2026): rhythmische Phrase im Python-Prüfstand

Quelle: `experimente/transkription/pruefen.py` (künstliche Laienstimme) und `monophon.py`, Stand Commit c1203f0. Keine Literatur, eigene Messung.

## Aufbau
Rhythmische Phrase (22 Noten, 4 Takte 4/4): Sechzehntel und Achtel, Tonwiederholungen auf gleicher Höhe (67 67 67), eine punktierte Viertel, zwei Pausen (Achtel, Sechzehntel). Zwei Stimmarten: „silben" (stimmloser Konsonant vor jeder Note: 10 ms Stille + 30 ms Rauschen bei kurzen, 20 + 50 ms bei langen Noten) und „weich" (durchklingend, am „l" 100 ms lang Obertöne −20 dB, Gesamtpegel −1,5 dB). Vibrato 45 Cent, Drift, Einschleifen 1,5 Halbtöne, Tremolo 2 dB. Treffer = Tonhöhe richtig und Einsatz innerhalb ±1/8 Viertel (halbe Sechzehntel).

## Presets
- standard: Mindestdauer 100 ms, Lückenfüllung 130 ms, Tonwechsel-Fenster 150 ms, Ansatz-Ausschluss 60 ms (alles fest in ms).
- rhythmisch 0,5: Mindestdauer und Lückenfüllung 0,5 Zellen (Zelle = Sechzehntel = 15000/bpm ms), Tonwechsel-Fenster max(60 ms, 0,8 Zellen), Ansatz min(60 ms, 0,3 Zellen).
- rhythmisch 0,4: 0,4 Zellen, Fenster max(50 ms, 0,6 Zellen), Ansatz min(50 ms, 0,25 Zellen).

## Ergebnis (getroffen von 22 / Dauer passend / überzählig)
| Tempo | Stimme | standard | rhythmisch 0,5 | rhythmisch 0,4 |
|---|---|---|---|---|
| 100 bpm (Zelle 150 ms) | silben | 13 / 8 / 3 | 12 / 9 / 9 | **18 / 13 / 2** |
| 100 bpm | weich | 11 / 5 / 5 | 15 / 8 / 4 | **19 / 12 / 2** |
| 120 bpm (Zelle 125 ms) | silben | 15 / 10 / 2 | 15 / 9 / 4 | **20 / 16 / 0** |
| 120 bpm | weich | 12 / 6 / 4 | 11 / 6 / 8 | **18 / 12 / 5** |
| 140 bpm (Zelle 107 ms) | silben | 11 / 5 / 3 | 14 / 12 / 6 | 13 / 11 / 7 |
| 140 bpm | weich | 8 / 2 / 2 | 9 / 4 / 4 | 11 / 6 / 4 |
| Gegenprobe „Alle meine Entchen" 90 bpm, silben und weich | | 27/27 | 27/27 | 27/27 (rhythmisch 0,5) |

## Beobachtungen aus den Rahmen
- Bei 120 bpm sind zwei Sechzehntel auf gleichem Ton mit 70 ms Konsonant nur 55 ms stimmhaft; pYIN (Fenster 2048 Samples = 93 ms bei 22,05 kHz) erreicht darin Stimmhaftigkeits-Wahrscheinlichkeiten von nur 0,2–0,7. Ein kürzeres pYIN-Fenster (1024 = 46 ms) änderte die Trefferzahl nicht nennenswert (19 statt 19 Noten nach Nachbesserung), verschob aber einzelne Grenzen.
- Kaskadenfehler: Wird die erste Sechzehntel mit der zweiten verschmolzen, rastert die gemeinsame Rundung alles Folgende eine Zelle versetzt; ein Fehler kostet mehrere Treffer.
- Die Kunststimme war anfangs unfair: kurze Noten wurden durch 40 ms Anschwellen + 60 ms Abschwellen 13 dB leiser als lange. Nach der Korrektur (An-/Abschwellen ≤ 20 %/25 % der Notenlänge, kürzere Konsonanten) gelten die Zahlen oben.
- Ab 140 bpm (Sechzehntel 107 ms) wird das 93-ms-Analysefenster und die HMM-Trägheit selbst zur Grenze; dort helfen Schwellen allein nicht mehr.

## Folgerung für den Bericht
Ein tempo-relatives Preset („rhythmisch") hebt die Trefferquote bei 100–120 bpm von ~50 % auf ~85–90 %, ohne das langsame Lied zu verschlechtern. Was fehlt: schnelle Tonwiederholungen oberhalb ~130 bpm, und die Kaskade nach einem verschmolzenen Paar.
