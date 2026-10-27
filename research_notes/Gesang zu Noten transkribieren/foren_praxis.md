# Gesang/Summen zu Noten: Was Praktiker in Foren, Issues und Blogs berichten (Fokus: zerhackte Haltetöne)

Recherchestand: 27.10.2026. Methodische Einschränkung vorweg: Aus dieser Umgebung heraus waren **reddit.com, kvraudio.com, gearspace.com, vi-control.net, musescore.org, logicprohelp.com, elektronauts.com, motunation.com, dev.to, imitone.com, vochlea.com, essentia.upf.edu, arxiv.org und code.soundsoftware.ac.uk per Direktabruf gesperrt** (Proxy-Policy 403). Zitate aus diesen Quellen stammen deshalb aus Suchmaschinen-Snippets und -Zusammenfassungen, nicht aus dem vollständigen Thread; die URLs sind jeweils angegeben, damit der Leser nachprüfen kann. **Reddit-Threads tauchten in keiner einzigen Suche auf** (weder mit `site:` noch mit „reddit" im Text) — zu den gewünschten Subreddits liegt daher nichts Zitierfähiges vor (siehe Lücken). GitHub-Seiten konnten vollständig gelesen werden. Das Suchbudget war am Ende aufgebraucht.

Kennzeichnung: **[Experte]** = Entwickler/Maintainer/Forschung/Herstellerdoku; **[Anekdote]** = einzelne Nutzerstimme; **[Marketing]** = Hersteller- oder Konverter-Seite mit Eigeninteresse.

---

## Frage 1: Was berichten Communities über Fragmentierung, Oktavsprünge, Vibrato und Konsonanten – und was hat geholfen?

### Takeaway
Das Muster „Halteton → viele kurze Noten mit Pausen" ist in Hobby-Projekten und Issues ein Dauerbrenner; die Ursache ist fast immer dieselbe: Noten werden rahmenweise aus einem flackernden Voicing-/Pitch-Track gebildet, und ein Energie-Onset oder ein pYIN-Aussetzer von 1–3 Frames reißt die Note auseinander. Als wirksam gelten übereinstimmend: Lücken < ~50–150 ms zwischen gleich hohen Noten schließen, Mindestdauer 50–150 ms, Onsets nur zählen, wenn die Energie deutlich steigt, Pitch-Hysterese (> ½ Halbton), und beim Singen: ein Vokal („la"/„da"/„aah"), kein Vibrato, kein „mmm", keine Slides, trockener Raum.

### Cited Findings

**Fragmentierung durch Onsets in pYIN-Aussetzern (direkt das Problem des Entwicklers)**
- **[Experte/Entwickler-Issue, Okt. 2026]** In einem librosa-pYIN-basierten Gitarren-Transkriber wird genau der Fall beschrieben: „A held note can be split into two same-pitch notes." Ursache: Ein Onset innerhalb der ~80 ms-Rückschau vor Notenbeginn setzt `from_onset=True`, und das Gap-Merging greift nicht mehr — „Merging only joins gaps up to 50 ms, which is shorter than that window." Typischer Auslöser: „a 2–3 frame pyin dropout" mit einem Onset in der Lücke. Bisherige Abhilfe: Onsets zählen nur, wenn die RMS um mindestens 10 % steigt (`min_rise=1.1`), „which removes onsets from vibrato, bends, and note releases". Vorgeschlagene Verbesserung: jedem Onset eine Stärke geben und in der Aussetzer-Rückschau nur Onsets akzeptieren, die „strong relative to the note's own attack" sind; außerdem „tune on real recordings … not just the synthetic reference songs, because they don't contain this case." — [GitHub yaronsha/ai-agents-apps #23](https://github.com/yaronsha/ai-agents-apps/issues/23)
- **[Experte/Projekt]** Ein pYIN-Backend eines Transkriptionsprojekts „merges runs split by a single unvoiced frame (tracker dropout)", lässt „unvoiced gap frames (NaN f0) inside merged runs borrow the nearest voiced neighbour" und verwirft Läufe unter 70 ms. — [GitHub HornScribe PR #179](https://github.com/bolph71656-ai/HornScribe/pull/179) (Direktabruf gab 404; Angaben aus Suchzusammenfassung)
- **[Experte/Projekt]** hum2tune (Summen → MIDI, Python): 40-ms-Fenster bei 10 ms Hop; „A single unvoiced frame between matching notes is filled"; gleich hohe Läufe mit Lücken bis 0,15 s werden verschmolzen, „events shorter than 0.15 seconds are dropped"; die Werte „are configurable to balance fragmentation against preserving repeated notes". Einschränkung: Grenzen „can be early by several tens of milliseconds", getestet nur an einer synthetischen Melodie mit Stille zwischen den Tönen. — [GitHub joyfranky2309/hum2tune](https://github.com/joyfranky2309/hum2tune)
- **[Experte/Projekt]** hum2hendrix PR #1 zeigt eine typische Falle: Der Konverter hatte Basic-Pitch-Notenereignisse „to their centre times" kollabiert und „re-segmented them as a frame contour", was Notenlängen löschte, „absorbed rests into the previous note, and dropped the final note" (drei 0,5-s-Noten wurden zwei 1,0-s-Noten). Fix: Notenereignisse diskret belassen, „splits notes on silence gaps", letzte Note behalten, Velocity aus der mittleren Konfidenz der eigenen Note. — [GitHub toneron2/hum2hendrix PR #1](https://github.com/toneron2/hum2hendrix/pull/1)
- **[Experte]** Die librosa-Doku: unvoiced Frames bekommen standardmäßig `np.nan` (`fill_na`), Voicing und F0 werden per Viterbi geschätzt, `switch_prob` ist die Wahrscheinlichkeit des Wechsels voiced↔unvoiced — der Hebel gegen kurzes Voicing-Flackern. — [librosa.pyin Doku](https://librosa.org/doc/main/api/generated/librosa.pyin.html)
- **[Experte]** librosa-Maintainer Brian McFee auf der Mailingliste: pYIN-Ausgabe ist „continuous(ish) frequency and not midi" — Umrechnung über `hz_to_midi`. — [librosa Google Group](https://groups.google.com/g/librosa/c/CEItlaz5UCU)
- **[Experte/Beispielcode]** Ein verbreitetes Minimalskript bildet Noten rahmenweise (Note-on/-off bei jeder Änderung der gerundeten MIDI-Nummer oder bei NaN) — ohne Dauerfilter; genau dieses Muster erzeugt aus Jitter und Voicing-Lücken viele Kurznoten. — [myCompiler „Audio To MIDI (Python)"](https://www.mycompiler.io/view/JN0Olar30OX)

**Oktavfehler**
- **[Experte]** librosa-Issue #1437 (Jan. 2022): gesungenes E3 wurde als E4 getrackt; bmcfee: „The pyin method is not perfect, and octave errors are the most common kind of mistake that it makes." — als `wontfix` geschlossen. — [GitHub librosa #1437](https://github.com/librosa/librosa/issues/1437)
- **[Marketing/Blog]** Allgemeiner Rat nach DAW-Konvertierung: „Octave errors first. A note detected an octave too high or low usually comes from a strong overtone being read instead of the fundamental." — [songcage.com](https://songcage.com/blog/audio-to-midi/)
- **[Experte/Projekt]** HUM-TO-SING: „short uncertain voiced sections and returning octave errors are repaired using surrounding evidence; true rests remain separate." — [GitHub Emmynado9/HUM-TO-SING](https://github.com/Emmynado9/HUM-TO-SING)

**Vibrato zerteilt Noten**
- **[Anekdote, vi-control]** Zu Gesang/Pfeifen → MIDI: Vibrato „really mess[es] it up", man räumt viele Noten auf; Melodyne gilt im Thread als am genauesten. — [vi-control: Singing/whistling to MIDI..all AI revolution and still not there?](https://vi-control.net/community/threads/singing-whistling-to-midi-all-ai-revolution-and-still-not-there.147326/)
- **[Anekdote, Vergleichsblog]** Ableton „Convert Melody" „split vibrato into many tiny notes"; Logic Flex Pitch lieferte „fewer micro-note artifacts for a monophonic vocal". — [futureproofmusicschool.com](https://futureproofmusicschool.com/blog/best-audio-to-midi-converters)
- **[Experte/Hersteller]** Melodyne hat sogar eine Funktion, die Vibrato absichtlich zerteilt („Separate Notes as Trill"): sie fügt Trennungen „into the slopes of the pitch curve so each hill and valley of a vibrato becomes a separate note" ein — nur bei ausgeprägtem Vibrato und Melodic-Algorithmus. Umgekehrt bedeutet das: Standard-Melodyne hält ein Vibrato normalerweise als eine Note zusammen. — [Celemony Hilfe: Tools for note assignment](https://helpcenter.celemony.com/M5/doc/melodyneStudio5/en/M5tour_NA_Mode_Tools?env=standAlone)
- **[Anekdote, KVR]** „Melodyne accounts for vocal vibrato and even being off key." — [KVR: Plugin that turns my humming … into MIDI notes?](https://www.kvraudio.com/forum/viewtopic.php?t=501573&start=15)
- **[Anekdote, PG Music]** Gesang mit Slides und Melisma gibt „a very messy file in MIDI which Melodyne will move every note to the nearest note it thinks it is, based on a 12-tone scale"; ein anderer rät, „slurs or vibrato" zu vermeiden, „as conversion software has a problem with them". — [PG Music: Vocal to Midi](https://www.pgmusic.com/forums/ubbthreads.php?ubb=showflat&Number=481123)
- **[Experte/Forschung]** Die klassische Arbeit zur Pitch-Track-Segmentierung nennt als Hauptprobleme „segmentation of pitch tracks with extreme vibrato, such as in opera pieces, and … accurate segmentation of consecutive notes at the same pitch". — [Paiva et al., From Pitches to Notes (ResearchGate)](https://www.researchgate.net/publication/248906447_From_Pitches_to_Notes_Creation_and_Segmentation_of_Pitch_Tracks_for_Melody_Detection_in_Polyphonic_Audio)
- **[Experte/Projekt]** crepe_notes-README: „If the source material has an unstable pitch profile which results in a lot of short notes either side of a longer target note, increasing the sensitivity to 0.002 may help." — [GitHub xavriley/crepe_notes](https://github.com/xavriley/crepe_notes)

**Konsonanten, Atem, Silbenwahl**
- **[Anekdote, MOTUnation]** „an unpitched consonant will throw off its interpretation of subsequent (or even sometimes preceding) sounds"; Rat: eine Silbe wählen, die die Software am zuverlässigsten trackt, und dabei bleiben. — [MOTUnation: accurate pitch to MIDI conversion?](https://motunation.com/forum/viewtopic.php?t=8167)
- **[Anekdote, PG Music]** Vor der Konvertierung Audio pitch-korrigieren, keine Effekte wie Reverb/Delay, eine Silbe wie „la" singen. — [PG Music: Vocal to Midi](https://www.pgmusic.com/forums/ubbthreads.php?ubb=showflat&Number=481123); ähnlich [PG Music: Vocals to midi converter?](https://www.pgmusic.com/forums/ubbthreads.php?ubb=showflat&Number=838562)
- **[Experte/Hersteller]** imitone-Handbuch: „Make clear sounds with an open mouth. Try 'ooh', 'aah' or 'dah'"; für stetige Laute („ooh/aah/mmm") Sustain-Modus, für perkussive („bah/dah") Attack-Modus. — [imitone manual](https://imitone.com/manual/)
- **[Marketing]** MelodyTrace: auf einem stetigen Vokal wie „la" oder „da" singen gibt sauberere Onsets als hauchige/geflüsterte Töne; „breath noise, reverb, and heavy vibrato" als häufigste Ursachen für Extra-/Falschnoten. — [melodytrace.com](https://melodytrace.com/voice-to-midi)
- **[Marketing]** Dreamtonics: klassische Pitch-Tracker „misinterpret breaths and expressive singing techniques as melodic details". — [dreamtonics.com/voice-to-midi](https://dreamtonics.com/voice-to-midi/)
- **[Tutorial]** Ableton: Vor dem Konvertieren ein Gate setzen, „so that when we breathe or stop singing extra notes aren't generated", dann Freeze/Flatten und erneut konvertieren. — [Aulart](https://www.aulart.com/blog/audio-to-midi-conversion/)
- **[Anekdote, Forum, Zuordnung unsicher]** Ein Forenbeitrag (in den Suchergebnissen neben [Mod Wiggler](https://www.modwiggler.com/forum/viewtopic.php?t=189661) und [Elektronauts](https://www.elektronauts.com/t/sing-humming-melodies-and-extract-notes-scale/136940)) empfiehlt Hochpass bei 80–100 Hz und Tiefpass bei 2 kHz, „since you're tracking pitch, not harmonics". Welcher der beiden Threads das enthält, konnte nicht verifiziert werden.
- **[Marketing/Blogs]** Mehrere Konverter-/Blogseiten geben gleichlautend: gerade Töne ohne Vibrato („to an analyser it reads as several notes fighting"), kleine Pausen zwischen Tönen, keine Slides, und eine „merge repeated notes"-Option gegen durch Vibrato zerhackte Haltetöne. Quellen aus derselben Suche, Einzelzuordnung nicht geprüft: [la-studio.cc](https://la-studio.cc/en/blog/how-to-turn-humming-into-midi-melody), [veena.studio](https://veena.studio/blog/how-to-turn-humming-into-a-melody), [mididraft.com](https://mididraft.com/), [soundtools.io](https://soundtools.io/voice-to-instrument/), [soundtomidi.com](https://soundtomidi.com/humming-to-midi/).

### Inferences
- Das „16tel–Pause–16tel–Pause"-Muster des Entwicklers entspricht exakt dem in #23 beschriebenen Mechanismus: Onset-Splitting plus zu kleines Gap-Merging (50 ms) relativ zur Onset-Rückschau (80 ms). Beim Raster von 16teln (bei 100 bpm = 150 ms) reicht jede Lücke > halbes 16tel, um eine Pause zu erzeugen; die Community-Werte (Gap-Merge 50–150 ms, Mindestdauer 50–150 ms) liegen genau in dieser Größenordnung und sollten vor der Rasterung angewendet werden.
- Der Konsens „Onset nur bei deutlichem Energieanstieg" und „Onset-Stärke relativ zum eigenen Attack" ist die direkte Antwort auf „onset-based splitting" im Pipeline-Design des Entwicklers.

### Gaps
- Keine Reddit-Threads (r/DSP, r/ableton, r/musictheory, r/learnpython, r/singing …) auffindbar – Reddit war in Suche und Abruf nicht erreichbar.
- Keine dsp.stackexchange- oder music.stackexchange-Threads in den Suchergebnissen; auch stackoverflow-Treffer zu pyin→MIDI fehlten.
- Keine Lines-(llllllll)-, Cycling-'74- oder SuperCollider-Threads zur Note-on/-off-Hysterese gefunden.

---

## Frage 2: Welche Einstellungen nutzen DAW-Anwender für Stimme→MIDI, welche Grenzen melden sie, gibt es Vergleiche?

### Takeaway
Alle vier DAW-Wege (Ableton Convert Melody, Logic Flex Pitch → MIDI, Melodyne → MIDI, Cubase VariAudio Extract MIDI) liefern bei Gesang „eine Transkription, keine Performance-Kopie": Nutzer berichten Mikro-Noten durch Vibrato, Oktavfehler, Atem-/Konsonanten-Noten. Die bewährten Workflows lauten: Material vorher säubern (Gate, EQ, kein Hall), Segment-/Transientengrenzen vor der Konvertierung korrigieren, nach der Konvertierung Kurznoten per Filter löschen und Fragmente zusammenkleben. Vergleiche (Blogs, Foren) sehen Melodyne vorn, Logic als sauberste Bordlösung, Ableton als schnell aber am zerhacktesten.

### Cited Findings

**Logic Pro (Flex Pitch → „Create MIDI Track from Flex Pitch Data")**
- **[Anekdote]** Nutzer mit „800+ notes" aus einer Gesangsspur fragt: „is there a way I can have it give me a simpler midi or be able to delete short notes automatically?" — [Logic Pro Help: How do I use Flex-Pitch effectively?](https://www.logicprohelp.com/forums/topic/164026-how-do-i-use-flex-pitch-effectively/)
- **[Anekdote]** Vorgeschlagene Abhilfe im Forum: Piano Roll → Window → Open MIDI Transform, Noten mit Länge ≤ 50 Ticks löschen („Select and Operate"); außerdem mit der Schere nachtrennen, wenn Flex Pitch schnelle Töne „may perceive as vibrato". — [Logic Pro Help: Convert Voice to MIDI notes?](https://www.logicprohelp.com/forums/topic/145650-convert-voice-to-midi-notes/) (Snippet-Zuordnung zwischen den Threads 145650/164026 nicht sicher)
- **[Anekdote]** Workflow-Fallen: Flex Pitch „on the track, not in the file" einschalten; ist der Menüpunkt grau, hat Flex Pitch kein tonales Material erkannt. — [Logic Pro Help: Converting audio track to MIDI notes is not working](https://www.logicprohelp.com/forums/topic/159888-converting-audio-track-to-midi-notes-is-not-working/)
- **[Experte/Tutorial]** Umgekehrtes Problem — Zusammenziehen: „the initial notes, including a G and C, have been identified as one long note." — [macProVideo](https://www.macprovideo.com/article/logic-pro/doubling-effects-using-flex-pitch-in-logic-pro-x)
- **[Tutorial]** Scissors-Tool zum Trennen, Join-Tool zum Verschmelzen von Fragmenten; Flex Pitch arbeitet am besten mit einer einzelnen Tonlinie. — [logicpros.net](https://logicpros.net/convert-audio-to-midi-logic-pro/); offizielle Schritte: [Apple Support](https://support.apple.com/guide/logicpro/create-midi-from-audio-recordings-lgcpe2fd1b83/mac)

**Ableton Live („Convert Melody to New MIDI Track")**
- **[Experte/Fachzeitschrift]** „Live uses the transient markers in the original audio clip to determine the divisions between notes in the converted MIDI clip … you can 'tune' the results of the conversion by adding, moving, or deleting transient markers in the audio clip before running any of the Convert commands." Ableton empfiehlt isolierte, unkomprimierte Aufnahmen. — [Sound On Sound: Ableton Live – MIDI From Audio](https://www.soundonsound.com/techniques/ableton-live-midi-audio)
- **[Tutorial]** Gate vor der Konvertierung, dann Freeze/Flatten; Marker mit Shift verschieben, mit Alt+Doppelklick setzen. — [Aulart](https://www.aulart.com/blog/audio-to-midi-conversion/), [MusicTech](https://musictech.com/tutorials/ableton-pu-6/)
- **[Blog]** Leise/anschwellende Töne werden oft gar nicht erkannt, „because most converters use the attack transient to decide a note has begun". — [songcage.com](https://songcage.com/blog/audio-to-midi/)
- **[Blog]** Hummed melody: „record one clear pitch at a time"; Ergebnis ist „a transcription, not a perfect performance capture", Oktaven/Attacks/Längen müssen nach Gehör korrigiert werden. — [itechguides.com](https://www.itechguides.com/turn-a-hummed-melody-into-editable-midi-notes/)

**Melodyne („Save as MIDI")**
- **[Experte/Fachzeitschrift]** Zur MIDI-Ausgabe: „the results aren't always satisfactory". — [Sound On Sound: Celemony Melodyne](https://www.soundonsound.com/reviews/celemony-melodyne)
- **[Experte/Hersteller]** Melodyne trennt automatisch, aber „it doesn't always divide them correctly"; Trennungen lassen sich per Doppelklick mit dem Note-Separation-Tool entfernen — weniger Blobs = weniger Noten im Export. — [Celemony: Note separations](https://helpcenter.celemony.com/M5/doc/melodyneStudio5Training/en/HC2-Training_R2T3_Notentrennungen_M5?env=standAlone), [producerhive](https://producerhive.com/music-production-recording-tips/how-to-use-melodyne-vocal-pitch-correction/)
- **[Blog]** Melodyne Essential (99 $) exportiert kein MIDI; erst Assistant. — [futureproofmusicschool.com](https://futureproofmusicschool.com/blog/best-audio-to-midi-converters)
- **[Anekdote]** Frage, ob Melodyne-MIDI-Export Pitch-Bend mitführt, blieb im Snippet unbeantwortet. — [Gearspace: Melodyne 4 Midi Pitch Bend](https://gearspace.com/board/music-computers/1181835-melodyne-4-midi-pitch-bend.html)

**Cubase (VariAudio → „Extract MIDI")**
- **[Experte/Fachzeitschrift]** MIDI entsteht „based on the pitch segments and pitch curve"; Empfehlung: „removing most of the very short segments, since many are gutturals or sibilants … Many of these very short segments show extreme detected pitches, well out of the normal sustained vocal range." Scoops: „Cubase may detect the note start and sustained portion as separate segments, in which case remove the first segment." — [Sound On Sound: VariAudio – Extracting MIDI From Audio Files](https://www.soundonsound.com/techniques/variaudio-extracting-midi-audio-files)
- **[Experte/Hersteller]** Segmente per Alt-Klick kleben, am unteren Rand schneiden; sehr kurze Segmente lassen sich nicht schneiden. — [Steinberg Help: Extracting MIDI from Audio](https://www.steinberg.help/r/cubase-artist/15.0/en/cubase_nuendo/topics/sample_editor_variaudio/sample_editor_variaudio_midi_extract_from_audio_t.html), [Changing the Length of Segments](https://archive.steinberg.help/cubase_pro_artist/v9/en/cubase_nuendo/topics/sample_editor_variaudio/sample_editor_variaudio_segments_changing_length_t.html)

**Vergleiche / Alternativen**
- **[Blog]** Melodyne „most usable output with the fewest wrong notes"; Ableton „split vibrato into many tiny notes"; Logic „cleaner with fewer micro-note artifacts"; VariAudio „best built-in option for monophonic material". — [futureproofmusicschool.com](https://futureproofmusicschool.com/blog/best-audio-to-midi-converters); ähnlich [musgen.ai](https://www.musgen.ai/blog/audio-to-midi-comparison)
- **[Anekdote]** NeuralNote (Basic Pitch) schlug bei einem Gitarrensolo Melodyne. — [vi-control: What is the best (most accurate) program …](https://vi-control.net/community/threads/what-is-the-best-most-accurate-program-that-can-convert-audio-into-midi.134036/page-2)
- **[Experte/Release Notes]** NeuralNote 2 hat Basic Pitch durch „MuScriptor" ersetzt; die v1-Regler „note sensitivity, split sensitivity, minimum note duration, pitch bend, scale quantize and time quantize" sind entfallen — wer sie braucht, bleibt bei v1. — [GitHub DamRsn/NeuralNote Releases](https://github.com/DamRsn/NeuralNote/releases), [Ardour-Forum](https://discourse.ardour.org/t/neuralnote-state-of-the-art-audio-to-midi-conversion/111343)
- **[Anekdote]** Dubler 2 und imitone seien „still not effective … in terms of latency and clean note capture". — [vi-control: Are there any Vochlea Dubler users here?](https://vi-control.net/community/threads/are-there-any-vochlea-dubler-users-here.103151/)

**Nachbearbeitung im MIDI-Editor („Legato", Lücken füllen)**
- **[Blog]** FL Studio Ctrl+L „Quick legato" zieht jede Note bis zur nächsten — „great on a smooth melody, wrong on a choppy one". — [mixelite.com](https://mixelite.com/blog/audio-to-midi-in-fl-studio/)
- **[Experte/Hersteller]** Dorico: Write → Edit Duration → Shorten to Next Note gegen Überlappungen nach MIDI-Import. — [Dorico-Blog](https://blog.dorico.com/2021/03/tip-shorten-note-durations-to-remove-overlaps-in-midi-imports/)
- **[Blog]** Reihenfolge: erst Oktaven/Streunoten, dann Längen/Timing — „doing pitch correction before quantization avoids making the wrong notes look tidy." — [songcage.com](https://songcage.com/blog/audio-to-midi/)

### Inferences
- Jede DAW hat denselben zweistufigen Ablauf: Grenzen (Transienten/Segmente) *vor* der Konvertierung reparieren, Kurznoten *nach* der Konvertierung filtern. Für die eigene Pipeline heißt das: Mindestdauer-Filter und Gap-Merge sind kein Hack, sondern Branchenstandard; und Onsets sollten nur „Vorschläge" sein, die durch den Pitch-Track bestätigt werden müssen.

### Gaps
- Keine KVR-/Gearspace-/SOS-Forum-Threads mit konkreten Ableton-/Logic-Settings für Gesang auffindbar; die Vergleiche stammen aus Blogs mit Affiliate-Charakter.
- Logic-„MIDI Transform ≤ 50 Ticks"-Tipp: Zuordnung zum exakten Thread nur per Snippet.

---

## Frage 3: Was sagen ScoreCloud-, Klangio- (Sing2Notes/Melody Scanner), Soundslice-Nutzer zur Qualität bei gesungenen Melodien?

### Takeaway
ScoreCloud bekommt Lob für saubere Monophonie (SOS: „extremely effective"), aber Nutzer in Foren nennen die Mikrofon-/Gesangseingabe schwach und „not very forgiving". Sing2Notes-Rezensionen (App Store 3,6/5, Play ~3,4/5) klagen über fehlende Noten, falsche Tonart und — wörtlich das Problem des Entwicklers — dass Haltetöne wiederholt statt verlängert/gebunden werden. Soundslice transkribiert nach eigener Aussage gar nicht automatisch.

### Cited Findings
- **[Experte/Fachzeitschrift, ~2018]** ScoreCloud „given a suitably clear monophonic signal, will notate it as a melodic line … I tried it on a variety of sources — singing, electric guitar and synthesizer — and it was extremely effective." — [Sound On Sound: DoReMIR ScoreCloud](https://www.soundonsound.com/reviews/doremir-scorecloud)
- **[Anekdote]** Trompete „pretty accurate", aber beim Singen „either the app was not very forgiving or I was really out of tune"; DoReMIR-Mitarbeiter: „you have to play one note at a time". — [Banjo Hangout](https://www.banjohangout.org/archive/294370)
- **[Anekdote, MuseScore-Forum]** Zu ScoreCloud: „the microphone translation messes up way too much", während MIDI-Eingabe „quite good" sei. — [musescore.org: singing to score](https://musescore.org/en/node/73446)
- **[Experte/Entwickler, MuseScore-Forum]** MuseScore hat keine Audio-Eingabe; Workaround: Melodyne → MIDI → Import, „not an integrated solution but should work". — [musescore.org: „sing your melody"](https://musescore.org/en/node/298657)
- **[Experte/Hersteller]** ScoreCloud erkennt erst Onsets und Dauern, leitet daraus Tempo/Takt ab; Noten werden „split, tied, and beamed automatically based on the time signature", Rhythmen lassen sich auf eine Unterteilung snappen, Bindungen manuell setzen. — [ScoreCloud: audio-to-score](https://scorecloud.com/learn/audio-to-score-transcription/), [Songwriter Quick-start](https://scorecloud.com/songwriter/tutorials/quick-start-guide/)
- **[Experte/Forschung]** Nutzerstudie (ISMIR 2019, Ethnomusikologie): häufigste Beschwerden über automatische Transkription sind Rhythmusprobleme und hinzugefügte/fehlende Noten; ScoreCloud hatte im Vergleich weniger Extra-/Fehlnoten. — [Holzapfel et al., ISMIR 2019](https://archives.ismir.net/ismir2019/paper/000082.pdf)
- **[Anekdote, App-Rezension]** Sing2Notes (App Store 3,6/5, 79 Bewertungen): langsame Melodie, sauber gesungen → „a bit of a mess with many missed notes, even on a slow melody song", Tonart falsch. — [App Store: Sing2Notes](https://apps.apple.com/us/app/sing2notes/id1588721118)
- **[Anekdote, App-Rezension]** Google Play: flache und fehlende Noten; die App „could not sustain held notes, repeating them instead of extending or tying them"; As-Dur-Lied als gis-Moll notiert. — [Google Play: Sing2Notes](https://play.google.com/store/apps/details?id=com.sing2notes&hl=en_US)
- **[Marketing]** Klangio selbst: „if a professional transcriber will have a hard time to transcribe a certain part of your vocals, then so will Sing2Notes"; Ergebnisse „not 100% perfect – results depend on recording quality". — [klang.io/sing2notes](https://klang.io/sing2notes/)
- **[Marketing]** Melody Scanner: „Currently only solo instruments are supported". — [klang.io/melodyscanner](https://klang.io/melodyscanner/)
- **[Experte/Hersteller]** Soundslice: „Does Soundslice transcribe automatically? No. No software in the world does that with any reasonable degree of accuracy." — [soundslice.com/transcribe](https://www.soundslice.com/transcribe/)
- **[Marketing, Konkurrent]** Songscription behauptet, ScoreCloud sei bei Audio-Import „not where it is strongest". Eigeninteresse. — [songscription.ai](https://www.songscription.ai/blog/songscription-vs-scorecloud)

**MuseScore-Import audio-abgeleiteter MIDI-Dateien (Pausen/Bindebögen)**
- **[Experte/Forum]** „In import, MuseScore tries to simplify durations of notes for legibility, a form of quantization. If you prefer a more exact but less readable result, turn off the 'Simply durations' option in the MIDI import panel and hit the Apply button." — [musescore.org node/42841](https://musescore.org/en/node/42841)
- **[Anekdote/Forum]** Tuplet-Erkennung abschalten, Max voices auf 2 reduzieren; „is human performance" ankreuzen half bei falsch erkannten 16teln; der Import sei beim Binden „a bit over-aggressive". — [node/277414](https://musescore.org/en/node/277414), [node/335191](https://musescore.org/en/node/335191), [node/24960](https://musescore.org/en/node/24960)

### Inferences
- Die Play-Store-Klage „repeating held notes instead of tying them" zeigt, dass selbst kommerzielle Gesangs-Transkriber dasselbe Symptom produzieren — es liegt nicht an einem Anfängerfehler des Entwicklers, sondern ist das Kernproblem der Notensegmentierung bei Stimme.
- Für MusicXML-Export lohnt sich, die Rasterung selbst sauber zu machen (Bindebögen über Taktgrenzen selbst erzeugen), statt MuseScores Import-Heuristik darauf loszulassen.

### Gaps
- Keine ScoreCloud-Support-/Forum-Threads zu „held notes split"; nur Herstellerdoku.
- Keine Klangio-Forum-Threads (es gibt offenbar keins), nur Store-Rezensionen ohne Datum.

---

## Frage 4: Welche Architektur empfehlen MIR-Leute/erfahrene Transkribierer für Hobby-Gesangstranskription?

### Takeaway
Der Stand der Technik vor Deep Learning – und die Referenz für Hobbyprojekte – ist Tonys Zwei-HMM-Ansatz (pYIN-Pitch-HMM + Noten-HMM mit 3 Zuständen je Note), ergänzt um Dauer-Pruning und Onset-Sensitivität als einzige Nutzerregler. Neuere leichte Ansätze (CREPE Notes, Essentia PitchContourSegmentation/Pitch2Midi) kombinieren Pitch-Gradient, Konfidenz und RMS mit Mindestdauer, Halbton-Schwelle und Abstimm-Puffern. Niemand in den gefundenen Quellen empfiehlt reine Energie-Onsets für Stimme.

### Cited Findings
- **[Experte/Forschung]** Tony (Mauch et al., TENOR 2015): pYIN liefert Pitch-Kandidaten mit Wahrscheinlichkeiten → HMM → Viterbi. Danach „a second, independent HMM takes that pitch track and outputs discrete notes"; jede Note hat „a three-state left-to-right structure", und das Modell „allows more variation in pitch at note beginnings than in stable regions". Erste wissenschaftliche Evaluation der pYIN-Notentranskription, „state-of-the-art" rahmen- und notenbasiert. — [Mauch et al. 2015 (PDF)](https://www.tenor-conference.org/proceedings/2015/04-Mauch-Tony.pdf), [Tony auf GitHub](https://github.com/sonic-visualiser/tony)
- **[Experte/Projektdoku]** Tonys einzige Noten-Regler: „High Onset Sensitivity" = pYIN-`onsetsensitivity` 0,7; „Drop Short Notes" = `prunethresh` (Duration pruning threshold) 0,1 s; `precisetime` aus. Die Plugin-Defaults (RDF) sind 0,5 bzw. 0,05 s. — [Tony-Wiki: PYIN Parameters](https://code.soundsoftware.ac.uk/projects/tony/wiki/PYIN_Parameters), [pyin.n3](https://www.vamp-plugins.org/rdf/plugins/pyin.n3)
- **[Experte/Forschung]** Kritik an Tony: „Tony tends to under-segment successive notes that have steady, continuous pitch tracks" (gleiche Tonhöhe hintereinander); Lösung dort: Phonem-Grenzen plus Tonys HMM innerhalb von Vokalregionen. — [Li et al., NLP4MusA 2021](https://aclanthology.org/2021.nlp4musa-1.4.pdf)
- **[Experte/Forschung]** CREPE Notes (Riley & Dixon, SMC 2023): Pitch-Tracking gilt als „close to solved", die Segmentierung nicht. Methode: Gradient des Pitch-Verlaufs + inverse Pitch-Konfidenz ergeben „a new signal which is a reliable indicator of note onsets"; Grundannahme „a pitch change of more than a semitone usually marks a note boundary"; Median-f0 je Segment „more robust to short-term pitch errors"; wiederholte gleiche Tonhöhen fallen auf madmoms Onset-Detektor zurück. — [arXiv 2311.08884](https://arxiv.org/abs/2311.08884), [GitHub crepe_notes](https://github.com/xavriley/crepe_notes)
- **[Experte/Bibliothek]** Essentia `PitchContourSegmentation`: Segmentierung „based on pitch contour characteristics and signal RMS"; Defaults `minDuration` 0,1 s, `pitchDistanceThreshold` 60 Cent, `rmsThreshold` −2 (z-Score), `hopSize` 128. — [Essentia Referenz](https://essentia.upf.edu/reference/std_PitchContourSegmentation.html), [Melody-Tutorial](https://essentia.upf.edu/tutorial_pitch_melody.html)
- **[Experte/Bibliothek]** Essentia `Pitch2Midi` (Echtzeit): Abstimm-Puffer für Note-Toggles (`midiBufferDuration`), „minimum time to wait until a note change is detected" (`minNoteChangePeriod`) und getrennte Mindestwartezeiten vor Onset und Offset. — [Essentia Pitch2Midi](https://essentia.upf.edu/reference/std_Pitch2Midi.html)
- **[Experte/Forschung]** Paiva et al.: Tracking mit minimaler Trajektoriendauer und maximaler Inaktivitätslücke — Lücke 62,5 ms passend zu 125 ms Mindestnote; zweistufig: erst Frequenzsprünge, dann Salienz-Minima/Onsets für gleich hohe Folgetöne. — [ResearchGate](https://www.researchgate.net/publication/248906447_From_Pitches_to_Notes_Creation_and_Segmentation_of_Pitch_Tracks_for_Melody_Detection_in_Polyphonic_Audio)
- **[Experte/Forschung]** HMM-Notensegmentierung: der übliche Ansatz ist „simple thresholding followed by pruning runs shorter than a set duration" — dort 50 ms. — [arXiv 1704.03711](https://arxiv.org/pdf/1704.03711)
- **[Experte/Forschung]** Flamenco: Ornamente erzeugen Sprünge > 1 Halbton ohne neue Note; Glättung des Pitch-Tracks reduziert falsche Sprünge, verwischt aber echte Notenwechsel. — [arXiv 1510.04039](https://arxiv.org/pdf/1510.04039)
- **[Experte/Forschung]** Für Gesang: „dynamic averaging of the pitch curve after the beginning of a note … Deviations of the actual pitch curve with respect to this average are measured to determine the next note change" — also Hysterese um den laufenden Mittelwert statt um den gerundeten Halbton. — [ResearchGate: Vocal pitch detection for musical transcription](https://www.researchgate.net/publication/252045562_Vocal_pitch_detection_for_musical_transcription)
- **[Experte/Forschung]** Stimm-Onsets sind „poorly captured by amplitude alone", deshalb bei Monophonie Pitch-Analyse zur Onset-Erkennung. — [arXiv 2111.03895](https://arxiv.org/pdf/2111.03895)
- **[Experte/Werkzeug]** aubionotes: `-s` Silence-Schwelle (dB, Default −90; „-20.0 would eliminate most onsets but the loudest ones"), `-t` Onset-Schwelle („Try 0.5 in case of over-detections"), `-M` minimaler Inter-Onset-Abstand; Note-off, wenn der Pegel seit Notenbeginn um einen festen Betrag fällt. — [aubionotes man page](https://aubio.org/manpages/latest/aubionotes.1.html)
- **[Experte/Mailingliste]** ChucK-Liste (Gitarre→MIDI): Note-on sofort beim Attack mit grober Tonhöhe senden, dann per Pitch-Bend korrigieren, „sidesteps the latency of pitch detection". — [chuck-users](https://lists.cs.princeton.edu/hyperkitty/list/chuck-users@lists.cs.princeton.edu/message/G3II3GPJTHL3D4LYAOYJWBOQ5XC5ILHW/attachment/0/attachment.html)
- **[Experte/Patent]** Mehrere aufeinanderfolgende Frames gleicher Tonhöhe verlangen, bevor eine Note gilt, weil Einzelframe-Entscheidungen „may result in the detection of incorrect pitches". — [US 6627806](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6627806)
- **[Experte/Projekt]** Basic Pitch standardisierte seine Mindestnotenlänge 2023 auf 127,7 ms (11 Frames), nachdem CLI (58 ms/5 Frames) und `predict` auseinanderliefen. — [GitHub basic-pitch #93](https://github.com/spotify/basic-pitch/issues/93); Spotify zur Stimm-Demo: „we turned down the Model Confidence Threshold, shortened the Minimum Note Length, and adjusted the Minimum/Maximum Pitch". — [basicpitch.spotify.com/about](https://basicpitch.spotify.com/about); Vocals im Web-Demo „misses almost all of the notes I sing" (offen). — [#103](https://github.com/spotify/basic-pitch/issues/103)

### Inferences
- Architektur-Empfehlung, die sich aus den Quellen ableitet: (1) pYIN mit `fill_na=None` oder nachträglichem Brücken kurzer NaN-Lücken, (2) Zustandsautomat/HMM mit *Eintritts*-Toleranz (am Notenanfang mehr Pitch-Schwankung erlauben – Tony) und Hysterese um den laufenden Median, (3) Grenze nur bei > ~60–100 Cent *anhaltender* Abweichung oder bei bestätigtem Energie-Onset (RMS-Anstieg ≥ 10 %, Stärke relativ zum eigenen Attack), (4) Pruning < 100–130 ms und Gap-Merge gleich hoher Noten < ~1/2 Rasterschritt, (5) erst dann Rasterung mit bekanntem Click; Offsets an den nächsten Onset snappen („legato"), weil Stimme ohnehin keine sauberen Note-offs hat.
- Für „einfache Melodien" (Ziel des Entwicklers) ist Tonys Ansatz mit `prunethresh` 0,1 s und niedriger Onset-Sensitivität die konservativste Referenz; das Unter-Segmentieren gleicher Töne (Li 2021) ist der Preis, den man bewusst zahlt.

### Gaps
- Kein Forenthread, in dem ein MIR-Experte einem Hobbyisten explizit eine Architektur empfiehlt — die Empfehlungen stammen aus Papern, READMEs und Toolkits.
- Die Beschreibung der pYIN-Vamp-„Notes"-Ausgabe (interne Logik) wurde nicht gefunden.

---

## Frage 5: Blogposts/Tutorials/Notebooks zu „hum to MIDI in Python/Browser" – welches Post-Processing und welche Gotchas?

### Takeaway
Die Tutorials, die funktionieren, haben alle dieselben vier Bausteine: Median-Filter über den F0-Track (Fenster ~11 Frames bzw. 0,25 s), NaN/Voicing-Lücken brücken, Mindestnotenlänge 100–150 ms (Basic Pitch 127,7 ms, Browser-Tools 120–130 ms, crepe_notes für Gesang ≥ 50 ms), gleich hohe Noten über kleine Lücken verschmelzen. Die meisten Minimal-Skripte lassen genau diese Schritte weg und erzeugen deshalb Fragmentierung.

### Cited Findings
- **[Tutorial/Blog]** Browser-Walkthrough (YIN → Zustandsautomat → MIDI): Standard „Minimum Note Length" 120 ms; Rat: anheben, um „flutter" zu entfernen, absenken, wenn schnelle Passagen verschwinden; eine Einstellung nach der anderen ändern; Summen mit gleichmäßiger Lautstärke, kein Raumrauschen; Oktavversatz nachträglich prüfen. — [DEV Community](https://dev.to/robert_053e1d7054bda7d838/turning-a-hummed-melody-into-midi-in-the-browser-a-step-by-step-walkthrough-4i69)
- **[Tutorial/Blog]** Basic Pitch im Web Worker: Mindestnotenlänge als Frames `Math.max(1, Math.round(0.130 * (22050 / 256)))` ≈ 130 ms. — [DEV Community (lucaswhite)](https://dev.to/lucaswhite/humming-to-midi-in-the-browser-with-basic-pitch-and-web-workers-eji)
- **[Tutorial/Blog]** pYIN-Autotune-Beispiel: Median-Filter über den Pitch-Track mit Kernel 11, NaN-Frames danach aus dem ungefilterten Track wiederhergestellt. — [Medium (rachaelwei)](https://medium.com/@rachaelwei/autotuning-with-python-33929140cf67); verwandt [WolfSound](https://thewolfsound.com/how-to-auto-tune-your-voice-with-python/)
- **[Experte/Projekt]** audio_to_midi_melodia (Salamon): `--smooth` = Median-Filterdauer in Sekunden, `--minduration` = Mindestnote; Beispiel `--smooth 0.25 --minduration 0.1`; Rasterung per übergebenem BPM; Autor warnt, die Segmentierung sei „written in a single day" und „as simple as possible". — [GitHub justinsalamon/audio_to_midi_melodia](https://github.com/justinsalamon/audio_to_midi_melodia)
- **[Experte/Projekt]** crepe_notes: `--min-duration` 0,03 s Default („for things like vocals and double bass lines a longer min duration (50ms or higher) may reduce the number of errors"), `--min-velocity` 6, `--sensitivity` 0,001 (→ 0,002 bei Kurznoten um eine lange Zielnote); geplant: „edge-preserving smoothing to reduce spurious grace notes and glissandi". — [GitHub crepe_notes](https://github.com/xavriley/crepe_notes)
- **[Experte/Projekt]** hum2tune: 40 ms Fenster / 10 ms Hop, Ein-Frame-Lücken füllen, Gap-Merge und Mindestdauer je 0,15 s, Median-Glättung der Pitch-Labels. — [GitHub hum2tune](https://github.com/joyfranky2309/hum2tune)
- **[Experte/Projekt]** hum2hendrix PR #1 (Gotcha): Noten nicht auf Mittelzeiten kollabieren und neu segmentieren – Dauern gehen verloren, Pausen verschwinden, letzte Note fällt weg. — [GitHub hum2hendrix PR #1](https://github.com/toneron2/hum2hendrix/pull/1)
- **[Blog/Tool]** Browser-Hum-to-MIDI: „a small state machine then watches the stream of pitches and decides where one note ends and the next begins, ignoring blips that are too short or too quiet to be real." — [hammyasf.github.io/hum-to-midi](https://hammyasf.github.io/hum-to-midi.html)
- **[Experte/Projekt]** tiagoft/audio_to_midi: monophoner librosa-Konverter („tunes played one note at a time"). — [GitHub tiagoft/audio_to_midi](https://github.com/tiagoft/audio_to_midi)
- **[Show HN, 2026]** „Voice Composer": CREPE (tf.js), YIN, HPS, AMDF client-seitig; Autor: „CREPE is most accurate but computationally expensive; YIN is fast and works well for clean monophonic input." Wie Noten getrennt werden, steht nicht im Snippet. — [news.ycombinator.com/item?id=46581431](https://news.ycombinator.com/item?id=46581431)
- **[Experte/Forschung]** CREPE-basierte Pipeline (HumTrans-Umfeld): Schwellwert + Median-Filter auf die Konfidenz, dann jede Pitch-Region auf mindestens 0,04 s gezwungen. — [arXiv 2410.05455 (Dynamic HumTrans)](https://arxiv.org/pdf/2410.05455)
- **[Experte/Bibliothek]** Essentia-Melody-Tutorial: `PitchContourSegmentation` liefert Onsets, Dauern, MIDI-Nummern → MIDI-Datei; „tune the parameters for better note estimation". — [essentia.upf.edu](https://essentia.upf.edu/tutorial_pitch_melody.html)
- **[Experte/Projekt]** Basic-Pitch-Wrapper (skitz PR): Mindestnotenlänge „¾ of a step (at most its own 127.7 ms)"; Noten kürzer als ½ Rasterschritt werden verworfen. — [GitHub nschlaepfer/skitz PR #20](https://github.com/nschlaepfer/skitz/pull/20); Vorschlag, die Mindestlänge aus dem BPM abzuleiten: [sound-to-serum #59](https://github.com/Akurganow/sound-to-serum/issues/59)

### Inferences
- Für ein 16tel-Raster bei bekanntem Tempo ist die Kopplung „Mindestnote ≈ ¾ Rasterschritt, verwerfen < ½ Rasterschritt, Gap-Merge < ½ Rasterschritt" (skitz) der direkt übertragbare Vorschlag; sie verhindert per Konstruktion „16tel–16tel-Pause–16tel".
- Keines der Tutorials nutzt Energie-Onsets zum *Zerteilen* gesungener Töne; wo Onsets vorkommen (crepe_notes/madmom), dienen sie nur dem Sonderfall gleicher Tonhöhe.

### Gaps
- Kein Jupyter-Notebook und kein Medium-Artikel, der pYIN + Median + Mindestdauer + Rasterung vollständig vorführt; die Bausteine liegen verteilt in READMEs.
- Die dev.to-Seite konnte nicht direkt gelesen werden; Details (Hop/Frame-Länge) fehlen.

---

## Frage 6: Wie vermeiden Echtzeit-Tools (Google Hum to Search, imitone, Dubler) Fragmentierung?

### Takeaway
Echtzeit-Tools lösen das Problem mit expliziter Hysterese/Haltelogik: imitone bietet „hold" (neue Note erst, wenn das Gleiten aufhört) und „lock" (Notenwechsel vermeiden, mehr Latenz), Dubler einen „Stickiness"-Regler (Halteton leichter zu halten, schwerer zu verlassen). Google Hum to Search umgeht Notensegmentierung komplett und bettet den Pitch-Verlauf direkt ein — für Notation also kein Vorbild.

### Cited Findings
- **[Experte/Hersteller]** imitone-Handbuch: „if the notes are messy, try tidier settings, like hold mode and classic tech"; Folgemodi: „hold — play new notes when you stop sliding. (tidier notes)", „lock — … tries to avoid changing notes (tidiest notes, but adds some delay)"; Trigger „sustain — for instruments that make steady sounds … sing 'aah'", „attack — for instruments that make sudden sounds". — [imitone manual](https://imitone.com/manual/); Troubleshooting: Streunoten → hold mode, falsche Noten → Tonart/Skala setzen, Hintergrundgeräusche → ruhiger Raum und Gate. — [imitone Troubleshooting](https://imitone.com/blog/index.php/2022/07/12/basic-imitone-troubleshooting/), [Key & Scale](https://imitone.com/blog/index.php/2022/06/14/imitone-tips-tricks-choosing-and-setting-a-key-and-scale/)
- **[Experte/Hersteller]** imitone: Latenz „under 30 milliseconds for notes in the low tenor range"; Kern ist ein Harmonik-Isolator („SAHIR"), der seine Grundfrequenz verschiebt, um Töne zu „locken"; da periodizitätsbasiert, trackt „inharmonic vocal fry … does not and probably never will … well". — [midi.org: imitone](https://midi.org/midi-partner/imitone), [imitone 0.11.1 Blog](https://imitone.com/blog/index.php/2022/04/12/updates-for-live-music-and-recording-imitone-0-11-1/)
- **[Experte/Hersteller]** Dubler 2 „Stickiness": höherer Wert macht gehaltene Noten „easier to sustain but also harder to change from"; IntelliBend „anchors you to a note while you are close to it" (Stärke über Stickiness); Skalenbegrenzung gegen leicht zu tiefe Töne; Input Level gegen Rauschen. — [Vochlea: Using pitch](https://vochlea.com/learn/using-pitch)
- **[Experte/Fachzeitschrift]** SOS zu Dubler 2: Stickiness „smooths the transition between detected notes, reducing the likelihood of errors"; „slightly pitchy efforts too often triggered bum notes or unwanted bends". — [Sound On Sound: Vochlea Dubler 2](https://www.soundonsound.com/reviews/vochlea-dubler-2)
- **[Experte/Doku]** Daqarta „Pitch Hysteresis": große Hysterese-Bereiche halten eine Note trotz Tracking-Fehlern stabil. — [daqarta.com](https://www.daqarta.com/dw_qqhh.htm); „snap hysteresis" = Abstand über den Mittelpunkt hinaus, bevor auf den Nachbarton gesprungen wird. — [GitHub JuniperusMusic/PitchToMIDI](https://github.com/JuniperusMusic/PitchToMIDI)
- **[Experte/Google]** Hum to Search erzeugt „an embedding of a melody from a spectrogram of a song without generating an intermediate representation"; SPICE diente nur dazu, aus Pitch-Werten synthetische Summ-Trainingsdaten zu bauen; Suche = Nearest-Neighbour im Embedding-Raum. — [Google Research Blog 2020](https://research.google/blog/the-machine-learning-behind-hum-to-search/)
- **[Experte/Bibliothek]** Essentia `Pitch2Midi` (Echtzeit): Voting-Puffer und Mindestwartezeiten für Notenwechsel, Onset und Offset — die Bibliotheksform derselben Haltelogik. — [Essentia Pitch2Midi](https://essentia.upf.edu/reference/std_Pitch2Midi.html)
- **[Anekdote]** KVR-Megathread zu imitone (27+ Seiten) existiert, konnte aber nicht abgerufen werden. — [KVR t=408173](https://www.kvraudio.com/forum/viewtopic.php?t=408173&start=375)

### Inferences
- „hold"/„lock"/„Stickiness" sind nichts anderes als Hysterese + Haltezeit im Zustandsautomaten – genau das, was der Entwickler offline mit Gap-Merge und Mindestdauer nachbauen kann, ohne Latenzdruck.
- Hum to Search ist kein Vorbild für Notation: Es löst Wiedererkennung, nicht Segmentierung.

### Gaps
- Keine technischen Zahlen zu imitones Hold-Zeit oder Dublers Stickiness-Zeitkonstante gefunden.
- Keine Entwickler-Erläuterung von imitone/Vochlea zu Hysterese-Werten; nur Handbuch-Prosa.
