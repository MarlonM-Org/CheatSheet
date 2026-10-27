# Apps und Produkte: gesungene/gesummte Melodie → Noten oder MIDI (Stand Oktober 2026)

Recherche-Hinweis: Die Hersteller-Websites scorecloud.com, klangio.com/klang.io, imitone.com und lunaverus.com waren aus dieser Umgebung nicht direkt abrufbar (Proxy blockiert); Preise und Details stammen daher aus Suchmaschinen-Auszügen, App-Store-Listings, Fachpresse und Drittseiten und sind entsprechend gekennzeichnet. Alle Preise ohne „€" sind US-Dollar bzw. Pfund, wie in der Quelle angegeben.

## Frage 1: Welche Apps/Produkte gibt es 2026, die Gesang/Summen in Noten oder MIDI verwandeln – und was können sie?

### Takeaway
Es gibt 2026 drei brauchbare Produktfamilien für „singen → lesbare Noten mit MusicXML-Export": **ScoreCloud** (Studio Win/Mac, Express iOS, Songwriter), **Klangio** (Sing2Notes/Melody Scanner/Transcription Studio; Web, iOS, Android, VST3/AU) und Web-Dienste wie **Songscription** und **SingConvert**; dazu **MuseScores eigenes Audio-to-Score (Beta, kostenlos, direkt als MSCZ)**. Alle arbeiten in der Cloud. Die Audio-zu-MIDI-Funktionen der DAWs (Ableton, Logic, Cubase Pro, Melodyne, Studio One Pro, FL Studio, Reaper) und das kostenlose Open-Source-Plugin **NeuralNote** liefern MIDI, keine fertigen Noten. Echtzeit-Voice-to-MIDI-Instrumente (**imitone**, **Vochlea Dubler 2**) sind für Live-Spiel gedacht, nicht für Notendruck. Vieles aus der Anfrageliste ist kein Transkriptionswerkzeug (Soundslice, Notion, Symphony Pro, Dorico, Hookpad, Transcribe!, Google/SoundHound) oder eingestellt (Music Memos, Songsmith, Hum On!, AudioScore faktisch).

### Cited Findings

#### Übersichtstabelle

| Produkt | Kategorie | Plattform | Preis (lt. Quelle) | Verarbeitung | Eingabe | Export | Metronom / Quantisierung | Status 2026 | Quelle |
|---|---|---|---|---|---|---|---|---|---|
| ScoreCloud Studio | Notensatz mit Audio-Eingang | Windows, macOS | Free (bis 10 Songs), Plus 4,99 $/Mon., Songwriter 10,99 $/Mon., Pro 19,99 $/Mon. | Cloud-Konto, Pro: lokales Speichern | Mikrofon live (Voice-/Instrument-Modus), Audio-Import, MIDI | MusicXML, MIDI, PDF (Free: kein MIDI-Export) | Eingebauter Klick, externer Klick, Fußtippen, nachträgliches „Tap Beat"; 2 Takte Einzähler beim Overdub | aktiv | [scorecloud.com](https://scorecloud.com/), [Handbuch Recording](https://scorecloud.com/support/manual/recording-audio/), [Slant](https://www.slant.co/options/12705/~scorecloud-review) |
| ScoreCloud Express (HD) | Mobil-App singen → Noten | iOS/iPadOS | gratis + In-App-Käufe | Cloud (Konto + Internet nötig) | Mikrofon, einstimmig | (App Store: Teilen; Details s. Steckbrief) | k. A. | Version 2.5.5, Bewertung 1,8–2,0 ★, Stabilitäts-/Login-Klagen | [App Store](https://apps.apple.com/app/id566535238), [Aggregator](https://marlvel.ai/api/llm/apps/music/com-doremir-scorecleaner-notes) |
| ScoreCloud Songwriter | Singen + Spielen → Leadsheet | Teil des ScoreCloud-Abos (10,99 $/Mon.) | s. links | Cloud | Ein Mikrofon, Gesang + Begleitung, YouTube-Import | wie Studio | k. A. | aktiv | [Songwriter vs Studio](https://scorecloud.com/learn/songwriter-vs-studio/) |
| Klangio Sing2Notes | Mobil/Web-App Gesang → Noten | iOS, Android, Browser | gratis (Demo) + Pro 9,99 $/Mon. bzw. 99,99 $/Jahr; Universe 24,99 $/Mon. bzw. 249 $/Jahr | Cloud, keine Registrierung nötig | Mikrofon-Aufnahme, MP3-Datei | PDF, MIDI, MusicXML | k. A. (keine Metronom-Angabe gefunden) | aktiv; App Store 3,7 ★ (73) | [App Store](https://apps.apple.com/app/id1588721118), [brutkasten](https://brutkasten.com/artikel/klangio-app-verwandelt-mittels-ki-musik-in-noten/2) |
| Klangio Melody Scanner | Web/App, Solo-Instrumente | Browser, iOS, Android | Free bis 40 Takte, Premium | Cloud | Mikrofon, Datei, YouTube | PDF, MIDI, MusicXML | keine Live-Erkennung | aktiv; Gesang nicht in der Instrumentenliste | [App Store](https://apps.apple.com/us/app/-/id6472921068) |
| Klangio Transcription Studio | Plugin + Standalone, Mehrinstrument | Windows, macOS; VST3, AU | ab 4 £/Mon. inkl. MwSt. (SOS, März 2026), Demo gratis | Cloud (Internet nötig) | Audiodatei/DAW-Spur | Noten, Tab, MIDI (unquantisiert je Instrument) | k. A. | neu, März 2026 | [Sound On Sound](https://www.soundonsound.com/news/klangio-launch-transcription-studio), [Pressemeldung](https://news.hummingbirdmedia.com/unlock-the-power-of-music-transcription-with-klangio-transcription-studio-the-first-ai-suite-for-multiple-instruments) |
| Songscription | Web-Dienst | Browser | 30 s gratis ohne Anmeldung; MIDI/MusicXML nur bezahlt; max. 15 Min. (Drittquelle) | Cloud | Summen im Browser, MP3/WAV/M4A, YouTube | PDF, MIDI, MusicXML | k. A. | aktiv (Review 2026) | [songscription.ai](https://www.songscription.ai/sheet-music-maker), [itechguides](https://www.itechguides.com/compare/songscription-vs-melody-scanner/) |
| SingConvert (La Touche Musicale) | Web-Dienst speziell Gesang | Browser | Free eingeschränkt; 9–29 $/Mon. (Drittquelle) | Cloud | Sprachaufnahme, YouTube | PDF, MIDI, MusicXML | k. A. | aktiv | [Hilfe-Center](https://latouchemusicale.crunch.help/en/sing-convert/what-is-sing-convert), [AlternativeTo](https://alternativeto.net/software/singconvert/about/) |
| MuseScore Audio-to-Score (Beta) | Web-Dienst von Muse Group | musescore.com Web/Desktop | kostenlos | Cloud | MP3 bis 30 MB (~3 Min.), YouTube-/Audio.com-Link | MSCZ (öffnet in MuseScore Studio) | k. A. | Beta, aktiv | [mu.se](https://www.mu.se/posts/musescore-audio-score-features) |
| AnthemScore 5 (Lunaverus) | Desktop, polyphon, Einmalkauf | Windows, macOS, Linux | Drittquellen: Lite ~31 $, Professional ~42 $, Studio ~107 $ | lokal/offline | Audiodatei | PDF, MusicXML, MIDI, ASDT (lt. Hersteller in allen Editionen) | Takt/Tempo-Erkennung, Nachbearbeitung | aktiv | [Editionsvergleich](https://www.lunaverus.com/compareEditions), [similarlabs](https://similarlabs.com/de/p/anthemscore) |
| Neuratron AudioScore Ultimate 8 / AudioScore Lite | Desktop; Lite liegt Sibelius bei | Windows, macOS | 249 $ (Avid) | lokal | Mikrofon, CD, MP3, MIDI | MusicXML, an Sibelius senden | k. A. | **faktisch unmaintained**: Version 8 von 2015, Website zuletzt 2019 geändert | [Avid](https://www.avid.com/plugins/audioscore-ultimate), [Neuratron About](https://neuratron.com/about.htm) |
| capella audio2score pro 5 | Desktop (deutscher Hersteller) | Windows | Kauf oder Monats-/Jahresabo; 15 Tage Test | lokal | Audiodatei | capella/… (MusicXML nicht bestätigt) | Nachbearbeitung nur in „pro" | aktiv; **„Gesang wird noch nicht unterstützt"** (Klassik-Modus) | [Produktseite](https://www.capella-software.com/index.cfm/us/products/capella-audio2score-pro/), [Feature-Liste](https://capella-software.com/us/index.cfm/products/capella-audio2score-pro/feature-list) |
| StaffPad | Notensatz mit „Piano Capture" | iPadOS, Windows | App-Kauf | **on-device ML** | Klavier über Mikrofon, Audio-Import, MIDI | StaffPad-Score, MusicXML | Aufnahme mit Metronom empfohlen | aktiv (Muse Group) | [Autumn 2023 Update](https://www.staffpad.net/autumn-2023-update), [Scoring Notes](https://www.scoringnotes.com/news/staffpad-acquired-by-muse-group-audio-support-planned/) |
| Melodyne 5 (Celemony) | Audio-zu-MIDI im DAW | Win/Mac, Plugin/Standalone | essential ~99 € (Händler), Upgrade essential→assistant 145 € (Thomann) | lokal | Audiospur | MIDI-Datei (Atemgeräusche werden ausgelassen) | Export übernimmt Position/Länge/Tonhöhe je Note | aktiv | [Celemony Hilfe](https://helpcenter.celemony.com/M5/doc/melodyneAssistant5/en/M5tour_ExportMIDI_otherDAWs), [Thomann](https://www.thomann.de/be/celemony_melodyne_5_assistant_ug_essent.htm), [Muziker](https://www.muziker.al/celemony-melodyne-5-essential) |
| Ableton Live 12 | DAW „Convert Melody to New MIDI Track" | Win/Mac | Standard/Suite (Live 9: nicht in Intro) | lokal | Audiospur, Gesang/Pfeifen ausdrücklich genannt | MIDI | DAW-Klick/Quantisierung | aktiv | [Live-Manual 12](https://www.ableton.com/en/live-manual/12/converting-audio-to-midi/), [Scan TekSpek](https://www.scan.co.uk/tekspek/pro-audio/ableton-live-9-version-comparison) |
| Logic Pro (Mac) | DAW, Flex Pitch → „Create MIDI Track from Flex Pitch Data" | macOS | im Logic-Preis | lokal | Audiospur (monophon) | MIDI | DAW-Klick/Quantisierung | aktiv; **iPad-Version kann Flex-Pitch nur abspielen, nicht bearbeiten** | [musicgurus](https://www.musicgurus.com/courses/logic-pro-x-audio-recording-sampling-effects/lessons/how-to-converti-pitch-to-midi-data-in-logic-pro-x/), [Logic Pro iPad Guide](https://support.apple.com/guide/logicpro-ipad/lpipd075115b/ipados) |
| Cubase (VariAudio „Extract MIDI") | DAW | Win/Mac | nur Cubase Pro (Artist strittig, Elements nein) | lokal | Audiospur, monophon | MIDI | DAW | aktiv | [steinberg.help](https://steinberg.help/cubase_pro/v10/en/cubase_nuendo/topics/sample_editor_variaudio/sample_editor_variaudio_c.html), [Steinberg-Forum](https://forums.steinberg.net/t/audio-to-midi-in-cubase-elements-8/660328) |
| Studio One Pro 7 | DAW mit Melodyne essential | Win/Mac | im Pro-Preis | lokal | Audio-Event auf Instrumentenspur ziehen | MIDI | DAW | aktiv | [Sound On Sound](https://www.soundonsound.com/techniques/studio-one-melodyne-essential) |
| FL Studio (Edison) | DAW „Convert to score and dump to piano roll" | Win/Mac | im FL-Preis | lokal | Audio-Clip | Piano-Roll/MIDI | DAW | aktiv, „basic" | [Image-Line-Forum](https://forum.image-line.com/viewtopic.php?p=2035119) |
| Reaper (ReaTune) | DAW, „Send MIDI events when pitch changes" | Win/Mac/Linux | im Reaper-Preis | lokal | Audiospur | MIDI | DAW | aktiv | [Cockos-Wiki](https://www.cockos.com/wiki/index.php/Use_Reatune_to_write_audio_to_midi) |
| BandLab | Web/Mobile-DAW mit Audio-to-MIDI (Stimme/Instrument/Drums) | Browser, iOS, Android | **nur im Membership-Abo** | Cloud | Audio-Region | MIDI (Web) | DAW-Klick | aktiv | [BandLab-Hilfe](https://help.bandlab.com/hc/en-us/articles/37575596722329-Converting-Audio-to-MIDI) |
| ACE Studio 2 | KI-Vocal-Workstation mit „Vocal to MIDI + Lyrics" | Win/Mac | Artist 398 $, Artist Pro 528 $ (lifetime + Credits) | teils Cloud-Credits | Singen in die App | MIDI, Lyrics | k. A. | aktiv (2.0) | [Sound On Sound](https://www.soundonsound.com/news/ace-studio-20-timedomain), [MusicTech Review](https://musictech.com/reviews/digital-audio-workstations/ace-studio-2-review/) |
| NeuralNote | Open-Source-Plugin (Basic Pitch) | Win, macOS, Linux; Standalone, VST3, AU | kostenlos, Apache-2.0 | **lokal/offline** | WAV/AIFF/FLAC bis 3 Min., Mikrofon im Standalone | MIDI | Skalen- und Zeit-Quantisierung im Plugin | v1.0.0 Nov 2024 | [KVR](https://www.kvraudio.com/news-print.php?id=62123), [GitHub via AlternativeTo](https://alternativeto.net/software/neuralnote/about) |
| Basic Pitch (Spotify) | Open-Source-Modell / Web-Demo | Browser, Python | kostenlos | lokal im Browser | Datei | MIDI | – | Web-Demo laut Nutzern teils hängend | [Spotify Engineering](https://engineering.atspotify.com/meet-basic-pitch/), [hunted.space](https://hunted.space/product/midiflow) |
| Samplab 2 | Audio-zu-MIDI-Plugin | Win/Mac, VST/AU | Basic gratis (10 s), Premium ~9,99 $/Mon. | Cloud | Sample | MIDI | – | aktiv | [Magnetic Mag](https://magneticmag.com/2023/01/samplab-2-review/), [SoundCloud-Hilfe](https://help.soundcloud.com/hc/en-us/articles/31509632447899-Samplab) |
| imitone | Echtzeit Stimme → MIDI | Win/Mac | ab 29 $ (itch.io); ursprünglich 25 $/Prime 60 $ | lokal | Mikrofon live | MIDI an DAW | – | letzter Changelog v0.13.1b Mai 2024 | [imitone itch.io](https://imitone.itch.io/imitone), [AlternativeTo](https://alternativeto.net/software/imitone/about) |
| Vochlea Dubler 2 / Studio Kit 2 | Echtzeit Stimme → MIDI (+USB-Mikro) | Win/Mac | Software UVP ~98 £ (Bax) bzw. 249 $ (MusicTech); Kit 245,99 £ / Sale 179 £ | lokal | Mikrofon live | MIDI-Noten + Velocity | – | aktiv; kein Dubler 3 gefunden, neu: DubBox | [MusicTech Review](https://musictech.net/reviews/software-instruments/vochlea-dubler-2-review/), [Vochlea Shop](https://shop.vochlea.com/products/dubler-studio-kit-3), [SOS DubBox](https://www.soundonsound.com/news/vochlea-announce-dubbox) |
| Jam Origin MIDI Guitar 3 | Gitarre → MIDI (nicht Stimme) | Win/Mac | k. A. | lokal | Gitarrensignal | MIDI/MPE | – | aktiv (v3) | [VI-Control](https://vi-control.net/community/threads/midi-guitar-3-on-the-way-looks-absolutely-incredible.148271/) |
| Hum2MIDI | iOS-App Summen → MIDI (jap. Entwickler) | iPadOS/iOS | gratis (3 Aufnahmen), MIDI-Export als Einmalkauf | lokal (Echtzeit) | Mikrofon live | MIDI via Share-Sheet | Quantisierung 1/4, 1/8, 1/16 | neu (2026) | [App Store](https://apps.apple.com/tt/app/id6786317080) |
| HumTrack: Hum to MIDI DAW | iPhone-App | iOS | k. A. | k. A. | Summen/Singen | MIDI, WAV | Tonhöhe/Rhythmus/Akkord-Erkennung | neu | [mwm.ai](https://mwm.ai/apps/app/6775845423) |
| AnySing – Music Notes Studio | iOS-App Stimme → Noten + MIDI | iOS | gratis | k. A. | Mikrofon live | MIDI, WAV | Piano-Roll | neu (Jan 2026), wenige Bewertungen | [App Store](https://apps.apple.com/us/app/-/id6747541661) |
| ToneScribe Pro: Audio to MIDI | iOS/macOS-App | iOS 18+, macOS 15+ | k. A. | **on-device** | Audio | MIDI | – | neu, 2 Bewertungen | [App Store](https://apps.apple.com/app/id6760222673) |
| Note Recognition: Sheet Music (mystage.fm) | Android-App singen/summen → Noten | Android 6+ | 6,99 $ (AppBrain) bzw. „Free" (Similarweb) | k. A. | Mikrofon | MIDI | monophon, Noten einzeln korrigierbar | aktiv, 4,2 ★ | [AppBrain](https://www.appbrain.com/app/note-recognition-sheet-music/fm.mystage.note_recognition) |
| AI Note Recognition & Tuner | Android-App | Android | k. A. | k. A. | Mikrofon, WAV/MP3/M4A/AAC-Import | Noten/MIDI | Tuner, Metronom | aktiv | [Similarweb](https://www.similarweb.com/app/google/com.note_recognition.sheet_music_ai/) |
| ハミングノート (Humming Note) | iPhone-App (Japan), Summen → MIDI-Noten | iOS | kostenlos | k. A. | Mikrofon | MIDI | transponiert automatisch nach C-Dur | 2,8 ★ (162) | [App Store JP](https://apps.apple.com/jp/app/id1575316445) |
| Frettable | Web-Dienst Audio → Noten (polyphon), Noteflight-Anbindung | Browser | k. A. | Cloud | Einzelinstrument-Aufnahme | Noteflight-Score | – | Status unklar | [Noteflight-Blog](https://notes.noteflight.com/frettable-adds-noteflight-integration/) |
| Transcribe! (Seventh String) | Hör-/Loop-Werkzeug, **keine Automatik** | Win/Mac/Linux | 39 $ | lokal | Audio | – | – | aktiv | [seventhstring.com](https://seventhstring.com/xscribe/buy.html) |
| Soundslice | Notensatz-Editor mit synchronisiertem Audio, **manuelles Transkribieren** | Browser | Editor gratis | Cloud | Audio/YouTube zum Mitlesen | MusicXML | – | aktiv | [soundslice.com/transcribe](https://www.soundslice.com/transcribe/) |
| Music Memos (Apple) | eingestellt | iOS | – | – | – | – | – | **eingestellt 1. März 2021**, Ersatz: Sprachmemos + GarageBand | [9to5mac](https://9to5mac.com/2021/03/02/apple-music-memos-voice-memos-integration/) |
| Microsoft Songsmith | historisch (Begleitung zum Gesang) | Windows | 29,95 $ (2009) | – | – | – | – | letzte Version 1.03 (Sept 2012) | [Wikipedia](https://en.wikipedia.org/wiki/Microsoft_Research_Songsmith) |
| Hum On! (Samsung C-Lab) | Summen → Noten + Begleitung | Android | – | – | – | – | – | 2016 vorgestellt, keine Belege für Veröffentlichung/Status | [Limelight](https://limelight-arts.com.au/news/samsung-launches-app-that-turns-singing-into-sheet-music/) |

#### Steckbriefe (ergänzende Fakten je Produkt)

**ScoreCloud (DoReMIR, Schweden)**
- ScoreCloud Studio: Free bis 10 gespeicherte Songs; Plus 4,99 $/Monat (unbegrenzt, mehr Import/Export); Songwriter 10,99 $/Monat („sing and play", YouTube-Import); Pro 19,99 $/Monat (lokales Speichern, Batch-MIDI, alle Formate) — [scorecloud.com](https://scorecloud.com/); eine Drittseite nennt 20,99 $ für Pro — [similarlabs](https://similarlabs.com/de/p/scorecloud)
- Aufnahme-Dialog mit Metronom-Auswahl: eingebauter Klick (Kopfhörer empfohlen), „External Metronome" (Drumcomputer/Klatschen), Fußtippen; nachträglich „Tap Beat"; Modus „Voice Recording" für einstimmige Linien wie Gesang; Overdub mit zwei Takten Einzähler — [Handbuch](https://scorecloud.com/support/manual/recording-audio/)
- Free-Plan: kein MIDI-Export, Drucke mit Wasserzeichen, 15-Minuten-Limit (Drittquelle) — [Slant](https://www.slant.co/options/12705/~scorecloud-review), [itechguides](https://www.itechguides.com/compare/scorecloud-vs-piano2notes/)
- Eigene Guides des Herstellers: bei klarer Solo-Stimme ist die Tonhöhe meist richtig, die Rhythmus-Quantisierung die Hauptbaustelle; Glissandi erzeugen Extra-Noten; Tipp: auf „la"/„da" singen, kurze Phrasen — [Voice to Sheet Music](https://scorecloud.com/learn/voice-to-sheet-music/), [Humming to Sheet Music](https://scorecloud.com/learn/humming-to-sheet-music/)
- ScoreCloud Express (iOS): „Play, sing or whistle any monophonic melody"; Analyse in der Cloud, kostenloses Konto + Internet nötig — [App Store](https://apps.apple.com/ru/app/id566535238); Version 2.5.5, Bewertung 1,8 ★ (44) bzw. 2,0 ★ (252), aktuelle Kritik an Stabilität und Kontoanmeldung — [Aggregator](https://marlvel.ai/api/llm/apps/music/com-doremir-scorecleaner-notes)
- Songwriter: ein Mikrofon für Gesang + Begleitung → Leadsheet mit Text und Akkorden; regelbasiertes Musik-Kognitionsmodell — [LispWorks](https://lispworks.com/success-stories/scorecloud-songwriter.html); Hacker-News-Nutzer: „it does work", Editor schwach, deshalb Export nach Finale/MuseScore — [saashub](https://www.saashub.com/scorecloud)
- Sound On Sound: Studio erzeugt Noten aus monophonem Audio und Echtzeit-MIDI — [SOS](https://www.soundonsound.com/node/4910661)

**Klangio (Karlsruhe)**
- Sing2Notes: „Transkription von Solo-Gesang in Notenblätter, Export als PDF, MIDI oder MusicXML"; App Store 3,7 ★ bei 73 Bewertungen; In-App: Pro 9,99 $/Monat, 99,99 $/Jahr; Universe 24,99 $/Monat, 249 $/Jahr — [App Store](https://apps.apple.com/app/id1588721118)
- Kostenlose Demo-Transkriptionen auf 20 Sekunden begrenzt (Drittquelle) — [moge.ai](https://moge.ai/de/product/klangio)
- Keine Registrierung nötig, läuft auch im Browser — [brutkasten](https://brutkasten.com/artikel/klangio-app-verwandelt-mittels-ki-musik-in-noten/2)
- Automatisierte Review-Auswertung (73 Reviews) stuft ca. zwei Drittel negativ ein; ein Nutzer (Dez 2024) bekam trotz mehrerer Versuche keine verwertbare Transkription — [justuseapp](https://justuseapp.com/en/app/1588721118/sing2notes/reviews) (geringe Belastbarkeit)
- Melody Scanner: Mikrofon, Datei oder YouTube; Instrumente Klavier, Flöte, Violine (Beta), Gitarre (Beta); nur Solo-Instrumente; keine Live-Erkennung; Free bis 40 Takte; PDF/MIDI/MusicXML — [App Store](https://apps.apple.com/us/app/-/id6472921068)
- Transcription Studio (18. März 2026): VST3/AU/Standalone für Win/Mac, Cloud-Verarbeitung, ab 4 £/Monat, Demo gratis — [SOS](https://www.soundonsound.com/news/klangio-launch-transcription-studio); bis zu 8 Instrumente, je ein unquantisiertes MIDI — [inkl](https://www.inkl.com/news/klang-io-says-transcription-studio-is-the-world-s-first-ai-music-tool-that-can-transcribe-multiple-instruments-simultaneously); Frühjahrs-Sale 40 % auf Jahresabos bis 6. April 2026 — [Pressemeldung](https://news.hummingbirdmedia.com/klangio-announces-spring-sale-40-off-transcription-studio-and-universe-subscriptions); Pro-Plan ca. 8,49 $/Monat jährlich bzw. 19,99 $ monatlich (Konkurrenz-Blog, befangen) — [Songscription-Blog](https://www.songscription.ai/blog/songscription-vs-klangio)

**Songscription (Web)**
- Summen direkt im Browser aufnehmen oder MP3/WAV/M4A hochladen oder YouTube-Link; Ergebnis in ca. einer Minute; Download PDF, MIDI, MusicXML; Clips bis 30 s gratis ohne Anmeldung — [songscription.ai](https://www.songscription.ai/sheet-music-maker)
- MIDI/MusicXML nur im Bezahlabo; max. 15 Minuten (Drittquelle) — [itechguides](https://www.itechguides.com/compare/songscription-vs-melody-scanner/)
- Unabhängige Review 2026: Export als „Rekonstruktion" betrachten, die geprüft werden muss — [jackrighteous](https://jackrighteous.com/en-gb/blogs/ai-creator-tools/songscription-review-2026-ai-music-sheet-music-midi)
- MIDI Innovation Award-Eintrag — [midi.org](https://midi.org/innovation-award/songscription-ai)

**SingConvert / PianoConvert (La Touche Musicale, Frankreich)**
- SingConvert: „up to 93 %" Genauigkeit (Herstellerangabe), PDF/MIDI/MusicXML; Solo-Gesang empfohlen — [Hilfe](https://latouchemusicale.crunch.help/en/sing-convert/what-is-sing-convert), [Empfehlungen](https://latouchemusicale.crunch.help/en/sing-convert/improving-transcription-quality-our-recommendations-for-sing-convert); Abo 9–29 $/Monat + eingeschränkte Gratisversion — [AlternativeTo](https://alternativeto.net/software/singconvert/about/)
- PianoConvert: nur Klavier, MIDI/MusicXML, „bis 98 %" (Herstellerangabe), 9–29 $/Monat — [AlternativeTo](https://alternativeto.net/software/pianoconvert/about)
- Kein Beleg, dass PianoConvert auf dem ByteDance-Piano-Transcription-Modell aufbaut; das ist ein separates Forschungssystem — [Hugging Face](https://huggingface.co/Lisztomaniaaa/piano_trans)

**MuseScore / Muse Group**
- Audio-to-Score (Beta) auf musescore.com: kostenlos, MP3 bis 30 MB (~3 Min.) oder YouTube-/Audio.com-Link, Ausgabe MSCZ für MuseScore Studio — [mu.se](https://www.mu.se/posts/musescore-audio-score-features)
- MuseScore Studio (Desktop) selbst hat keine Audio-Transkription; Forum verweist auf Drittprogramme — [musescore.org](https://musescore.org/en/node/366908)
- StaffPad (zu Muse Group gehörend): „Piano Capture" mit On-Device-ML für Klavierspiel; Aufnahme mit Metronom empfohlen; Audio-Import; Gesang nicht erwähnt — [StaffPad](https://www.staffpad.net/autumn-2023-update), [SOS](https://www.soundonsound.com/news/staffpads-new-ai-powered-piano-capture)

**AnthemScore (Lunaverus)**
- Editionsvergleich des Herstellers: „Save as PDF, musicXML, MIDI, or ASDT" in Lite, Professional und Studio; Upgrade = Preisdifferenz + ca. 3 $ — [lunaverus.com](https://www.lunaverus.com/compareEditions); eine französische Seite behauptet, Lite habe kein MIDI/XML (Widerspruch) — [comparateur-ia](https://comparateur-ia.com/?p=41494)
- Preise nur über Dritte: 31 $ / 42 $ / 107 $ — [similarlabs](https://similarlabs.com/es/p/anthemscore); Einmalkauf, 30-Tage-Test — [LogicWeb](https://www.logicweb.com/?p=45614)

**Neuratron AudioScore / NotateMe / PhotoScore**
- AudioScore Ultimate 8 = Vollversion des Sibelius beiliegenden AudioScore Lite, 249 $ — [Avid](https://www.avid.com/plugins/audioscore-ultimate)
- Neuratron-„About"-Seite: Copyright 1999–2019, zuletzt 17.12.2019 geändert; Version 8 erschien 11.06.2015 — [Neuratron](https://neuratron.com/about.htm)
- NotateMe = Handschrift-Erkennung, PhotoScore = Notenscan (OMR), keine Audioeingabe — [NotateMe](https://neuratron.com/notateme_i.htm)

**capella audio2score pro 5 (capella-software, Deutschland)**
- Klassik: Streicher, Bläser, Klavier werden per KI getrennt; „singing is not supported here yet"; seit April 2024 auch Pop-Songs — [Produktseite](https://www.capella-software.com/index.cfm/us/products/capella-audio2score-pro/), [News](https://www.capella-software.com/us/index.cfm/news/recent/capella-audio2score-pro-5)
- Kauf oder Monats-/Jahresabo; 15 Tage kostenlos; „start"-Version ohne Nachbearbeitung — [Abo-Meldung](https://www.capella-software.com/index.cfm/us/news/recent/capella-audio2score-pro-subscription/), [Feature-Liste](https://capella-software.com/us/index.cfm/products/capella-audio2score-pro/feature-list)
- Sound-On-Sound-Test existiert (Urteil nicht im Auszug) — [SOS](https://www.soundonsound.com/reviews/capella-audio2score-pro-5?amp)

**Melodyne (Celemony)**
- Export: pro Audionote eine MIDI-Note mit gleicher Position, Länge, Tonhöhe; Atemgeräusche werden nicht exportiert — [Celemony Hilfe](https://helpcenter.celemony.com/M5/doc/melodyneAssistant5/en/M5tour_ExportMIDI_otherDAWs)
- essential nur monophon, Slides werden nicht in Pitch-Bend übersetzt — [SOS „Taking Notes"](https://www.soundonsound.com/techniques/taking-notes)
- Händler ordnet „Audio-to-MIDI" den assistant-Funktionen zu — [Moog Audio](https://fr.moogaudio.com/products/melodyne-5-assist-essential); Thomann nennt für das assistant-Upgrade „Audio-to-MIDI function and MIDI file export", 145 € — [Thomann](https://www.thomann.de/be/celemony_melodyne_5_assistant_ug_essent.htm); essential 99 € (Sale 71,10 €) — [Muziker](https://www.muziker.al/celemony-melodyne-5-essential)
- Studio One Pro: Melodyne essential liegt bei; Audio-Event auf Instrumentenspur ziehen → Noten — [SOS](https://www.soundonsound.com/techniques/studio-one-melodyne-essential)

**DAWs**
- Ableton Live: Handbuch nennt ausdrücklich „record yourself singing, whistling" für „Convert Melody" — [Live 12 Manual](https://www.ableton.com/en/live-manual/12/converting-audio-to-midi/); Live 9: Audio-to-MIDI nur Standard/Suite, nicht Intro — [Scan](https://www.scan.co.uk/tekspek/pro-audio/ableton-live-9-version-comparison); zu erwartende Fehler: verpasste Einsätze, falsche Noten, Oktavfehler, Längen, Timing — [MusicTech-Tutorial](https://musictech.com/tutorials/ableton-pu-6/)
- Logic Pro (Mac): Edit → „Create MIDI Track from Flex Pitch Data"; Ergebnis „hit and miss" — [Attack Magazine](https://attackmagazine.com/reviews/gear-software/apple-logic-pro-x/5); SOS empfiehlt erst Tonhöhe zur Tonart quantisieren, dann exportieren — [SOS Perfect Harmony](https://www.soundonsound.com/techniques/perfect-harmony); Logic Pro für iPad spielt importierte Flex-Pitch-Bearbeitungen nur ab, Flex-Marker nicht editierbar — [Apple Guide](https://support.apple.com/guide/logicpro-ipad/lpipd075115b/ipados)
- Cubase: VariAudio „Extract MIDI" für monophone Gesangsaufnahmen; Cubase Pro — [steinberg.help](https://steinberg.help/cubase_pro/v10/en/cubase_nuendo/topics/sample_editor_variaudio/sample_editor_variaudio_c.html); Elements hat kein VariAudio — [Forum](https://forums.steinberg.net/t/audio-to-midi-in-cubase-elements-8/660328)
- FL Studio: Edison → Tools → „Convert to score and dump to piano roll"; Nutzer nennen es „basic" — [Image-Line-Forum](https://forum.image-line.com/viewtopic.php?p=2035119); Newtone-Handbuch beschreibt keine Score-Konvertierung — [Newtone-Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Newtone.htm)
- Reaper: ReaTune „Send MIDI events when pitch changes" + Lookahead; Alternative „Apply track/take FX to items as new take (MIDI output)"; Vibrato ergibt „a mess of notes" — [Cockos-Wiki](https://www.cockos.com/wiki/index.php/Use_Reatune_to_write_audio_to_midi), [Obsidian-Notiz](https://publish.obsidian.md/arendleejessurun/Atlas/Music+production/Reaper/Audio+to+MIDI+in+Reaper)
- BandLab: Audio-to-MIDI für Stimme/Instrument/Drums, nur im Membership-Plan — [BandLab-Hilfe](https://help.bandlab.com/hc/en-us/articles/37575596722329-Converting-Audio-to-MIDI)
- Dorico 5: keine Funktion zum Anhängen/Transkribieren von Audio; Audio-Playback „für künftige Versionen geplant" — [Steinberg-Forum](https://forums.steinberg.net/t/transcribing-audio-and-video-files/905182)

**Open Source / Plugins**
- NeuralNote v1.0.0 (Nov 2024): Standalone + VST3 (Win), + AU (Mac); jedes tonale Instrument inkl. Stimme; polyphon; Pitch-Bend; Skalen- und Zeitquantisierung im Plugin — [KVR](https://www.kvraudio.com/news-print.php?id=62123); nur WAV/AIFF/FLAC, 3-Minuten-Limit (Nutzerreview) — [AlternativeTo](https://alternativeto.net/software/neuralnote/about); basiert auf Spotify Basic Pitch — [Gigazine](https://gigazine.net/gsc_news/en/20230515-neuralnote/)
- Basic Pitch: Apache 2.0, github.com/spotify/basic-pitch — [Spotify Engineering](https://engineering.atspotify.com/meet-basic-pitch/); Web-Demo laut Nutzern monatelang bei „Loading file…" hängend; MIDIFLOW als Browser-Alternative (lokal, kein Upload; unverifiziert) — [hunted.space](https://hunted.space/product/midiflow)
- Samplab 2: Basic gratis (10 s pro Sample), Premium ~9,99 $/Monat; Win/Mac, VST/AU — [Magnetic Mag](https://magneticmag.com/2023/01/samplab-2-review/)

**Echtzeit-Instrumente**
- imitone: itch.io verlangt mindestens 29 $; Changelog bis v0.13.1b (Mai 2024) — [itch.io](https://imitone.itch.io/imitone); Kickstarter-Ära: 25 $ Basis / 60 $ Prime — [Ask.Audio](https://ask.audio/articles/review-imitone---mind-to-melody-software)
- Dubler 2: MusicTech-Fazit „still better for beats than pitch"; 249 $/189 £ Software, Kit 329 $/249 £ — [MusicTech](https://musictech.net/reviews/software-instruments/vochlea-dubler-2-review/); Bax: UVP 98 £ — [Bax](https://www.bax-shop.co.uk/audio-software/vochlea-dubler-2); Vochlea-Shop Kit 179 £ statt 245,99 £ — [Shop](https://shop.vochlea.com/products/dubler-studio-kit-3); funktioniert mit jedem dynamischen Mikro — [Attack Magazine](https://www.attackmagazine.com/news/vochlea-black-friday-sale-for-updated-dubler-2/)
- ACE Studio 2.0: „convert vocals into MIDI and lyrics"; Artist 398 $, Artist Pro 528 $; Credits 2.500/5.000 pro Monat für zwei Jahre, danach Abo — [SOS](https://www.soundonsound.com/news/ace-studio-20-timedomain), [MusicTech](https://musictech.com/reviews/digital-audio-workstations/ace-studio-2-review/)
- Jam Origin MIDI Guitar 3: polyphon, MPE oder Standard-MIDI, aus dem normalen Gitarrensignal; Ghost-Notes/Nacharbeit üblich — [KVR-Forum](https://www.kvraudio.com/forum/viewtopic.php?p=9218305)

**Kleine iOS-/Android-Apps (2025/2026)**
- Hum2MIDI (Entwickler Matsumoto Shigekazu): Echtzeit-Pitch → Piano-Roll, Noten hinzufügen/verschieben/löschen, Undo, Quantisierung 1/4–1/16; Free: 3 gespeicherte Aufnahmen; MIDI-Export als Pro-Einmalkauf; Share-Sheet an DAW; „designed for iPad" — [App Store](https://apps.apple.com/tt/app/id6786317080), [AppGoblin](https://appgoblin.info/apps/6786317080)
- AnySing: „converts your voice to sheet music and MIDI notes in real-time", Export MIDI/WAV, gratis; Erscheinen Jan 2026, wenige Bewertungen — [App Store](https://apps.apple.com/us/app/-/id6747541661), [AppGoblin](https://www.appgoblin.info/apps/6747541661)
- HumTrack: Hum to MIDI DAW: Pitch/Rhythmus/Akkord-Erkennung aus Gesang/Summen, Export MIDI/WAV — [mwm.ai](https://mwm.ai/apps/app/6775845423)
- Melody Sketch (Okt 2025): „sketch, hum, tap, tilt, or AI suggestions", MIDI-Export; eher Melodie-Generator — [mwm.ai](https://mwm.ai/apps/draw-melody/6748230892)
- ToneScribe Pro: Audio → MIDI, Verarbeitung auf dem Gerät, iOS 18+/macOS 15+, nur 2 Bewertungen — [App Store](https://apps.apple.com/app/id6760222673)
- Nada: Melodie in gewählter Tonart/Skala singen oder summen — [App Store](https://apps.apple.com/app/id6670599599)
- iComposer (alt, 8,99 $): „iPhone app turns hummed audio into MIDI"; aktueller Status unklar — [MusicRadar](https://musicradar.com/news/tech/iphone-app-turns-hummed-audio-into-midi-208047)
- ハミングノート (Japan, iPhone, gratis): Summen → MIDI-Noten, automatisch nach C-Dur transponiert; Tipps: Töne klar trennen, kein Vibrato; 2,8 ★ (162) — [App Store JP](https://apps.apple.com/jp/app/id1575316445)
- Note Recognition: Sheet Music (Android, mystage.fm): „sing, hum, or play a melody", Vergleich Original vs. erkanntes MIDI, Einzelnoten korrigieren, MIDI-Export; monophon, keine Akkorde; 6,99 $ (AppBrain, 4,21 ★) bzw. „Free" (Similarweb) — [AppBrain](https://www.appbrain.com/app/note-recognition-sheet-music/fm.mystage.note_recognition), [Similarweb](https://www.similarweb.com/app/google/com.note_recognition.sheet_music_ai/)
- AI Note Recognition & Tuner (Android): zusätzlich Tuner, Metronom, Import WAV/MP3/M4A/AAC — [chrome-stats](https://chrome-stats.com/d/com.note_recognition.sheet_music_ai)
- Note a note (iPhone, gratis): zeigt die gesungene Note live im Notensystem, noch zu wenige Bewertungen — [App Store](https://apps.apple.com/om/app/note-a-note/id6667036962)

**Keine Transkription (zur Abgrenzung)**
- Soundslice: Transkription bleibt manuell („makes it very easy to transcribe it yourself"), Editor + synchronisiertes Audio; Notenscanner nur für PDF/Fotos — [Soundslice Transcribe](https://www.soundslice.com/transcribe/), [Blog-Kommentar 2018](https://www.soundslice.com/blog/55/introducing-the-soundslice-notationtab-editor/)
- Notion Mobile (PreSonus): Eingabe per Bildschirm-Klaviatur, Griffbrett, Handschrift; keine Audio-Transkription — [MusicRadar](https://www.musicradar.com/news/presonus-free-notion-mobile-app)
- Symphony Pro 6 (iPad, 14,99 $): Aufnahme nur über Bildschirminstrumente/Core-MIDI — [App Store](https://apps.apple.com/app/id412380315)
- Noteflight: nimmt Audio auf eine Notenzeile auf (Premium/Learn, nur Chrome/Firefox), transkribiert aber nicht; Transkription über Frettable — [Noteflight-Blog](https://notes.noteflight.com/frettable-adds-noteflight-integration/)
- Hookpad: FAQ „does not currently have the ability to automatically detect … melody from audio"; Audio-Upload nur als Referenzspur — [Hooktheory FAQ](https://www.hooktheory.com/faq), [Audio-Uploads](https://www.hooktheory.com/blog/introducing-audio-track-uploads/index.html)
- Transcribe!: 39 $, „specialised player program optimized for transcription", keine Automatik — [Seventh String](https://seventhstring.com/xscribe/buy.html)
- Google Hum to Search (seit Okt 2020) und SoundHound/Midomi: nur Song-Identifikation — [Android Authority](https://androidauthority.com/google-hum-to-search-1169186), [Guiding Tech](https://www.guidingtech.com/identify-song-by-humming-tune-using-3-web-apps)
- Chordify: Akkorderkennung, MIDI-Export der Akkordfolge (Forum-Bericht) — [PSR-Tutorial-Forum](https://forum.psrtutorial.com/index.php?msg=530864); Moises: Export nur Audio-Stems/Mixes, kein MIDI gefunden — [APKMirror-Changelog](https://www.apkmirror.com/apk/moises-systems/moises-the-musicians-app/moises-the-musicians-ai-app-2-93-0-release/)
- Singscope (iOS): Tonhöhen-Graph über Zeit, nur eine Stimme; OnPitch zeigt Notenname/Cent/Hz; Singing Carrots Pitch Monitor (Web, gratis) — [Singscope](https://apps.apple.com/us/app/singscope/id944309175), [OnPitch](https://apps.apple.com/app/id1212118228), [Singing Carrots](https://singingcarrots.com/docs/singing-carrots-pitch-monitor)
- Score Creator (iOS, 3,5 ★/491): Noteneingabe per Tasten, MIDI/MusicXML-Import/-Export, keine Audioeingabe — [App Store](https://apps.apple.com/us/app/-/id627486149), [Music Teacher Review 2021](https://www.musicteachermagazine.co.uk/articles/tech-reviews-score-creator); Maestro – Music Composer (iPad, gratis): nur Eingabe/Playback — [App Store](https://apps.apple.com/us/app/maestro-music-composer/id1579863714?uo=4)
- Antares Auto-Tune Pro: MIDI nur als Eingang (Zielnoten), kein MIDI-Export der erkannten Noten gefunden — [Attack Magazine](https://www.attackmagazine.com/technique/tutorials/twisting-up-a-synth-drone-with-antares-auto-tune-pro/)
- Hum2Song (GitHub/Hugging Face) und HumToSong (iOS): erzeugen Begleitung/Instrumental zum Summen, keine Notenausgabe — [GitHub](https://github.com/toxtli/hum2song), [mwm.ai](https://mwm.ai/apps/humtosong/6755473455)
- Songify (Smule): macht aus Sprache Songs, keine Noten — [TechCrunch](https://techcrunch.com/2012/05/15/smule-finally-makes-their-android-debut-with-the-auto-tuning-songify-app/)

**Eingestellt / historisch**
- Apple Music Memos: eingestellt zum 1. März 2021, letztes Update exportierte in Sprachmemos; Apple verwies auf Sprachmemos + GarageBand — [9to5mac](https://9to5mac.com/2021/03/02/apple-music-memos-voice-memos-integration/), [Digital Music News](https://www.digitalmusicnews.com/2021/03/02/apple-retires-music-memos/)
- Microsoft Songsmith: CES Januar 2009, 29,95 $, letzte Version 1.03 September 2012 — [Wikipedia](https://en.wikipedia.org/wiki/Microsoft_Research_Songsmith)
- Samsung Hum On! (C-Lab, SXSW März 2016): Summen → Notation + Begleitung, damals Beta für Android; keine Quelle zu Veröffentlichung oder Einstellung — [Limelight](https://limelight-arts.com.au/news/samsung-launches-app-that-turns-singing-into-sheet-music/), [mobiFlip](https://www.mobiflip.de/?p=263540); koreanisches HumOn (COOLJAMM) als Verwandter — [KOCCA](https://welcon.kocca.kr/en/directory/content/humon--466)
- Humtap: Dealroom „closed", CB Insights „alive" (Widerspruch), letzte Erwähnung Jan 2023 — [Dealroom](https://app.dealroom.co/companies/humtap), [CB Insights](https://www.cbinsights.com/company/humtap)
- Akoff Music Composer: nur Quellen aus 2000–2004, aktueller Status unbekannt — [Steel Guitar Forum](https://bb.steelguitarforum.com/viewtopic.php?p=576139)
- WIDI Recognition System: heise-Download-Eintrag (Win/Mac) zuletzt August 2024 aktualisiert; intelliScore nur Presse 2004–2006 — [heise](https://www.heise.de/download/product/widi-recognition-system-standard-65192), [Synthtopia](https://www.synthtopia.com/content/tag/intelliscore)

#### Namensliste (zum schnellen Durchsehen)

**(a) Mobile Apps: summen/singen → Noten**
- ScoreCloud Express (iOS) — https://apps.apple.com/app/id566535238
- Klangio Sing2Notes (iOS/Android/Web) — https://apps.apple.com/app/id1588721118
- Klangio Melody Scanner (iOS/Android/Web) — https://apps.apple.com/us/app/-/id6472921068
- Hum2MIDI (iOS/iPadOS, MIDI) — https://apps.apple.com/tt/app/id6786317080
- AnySing – Music Notes Studio (iOS) — https://apps.apple.com/us/app/-/id6747541661
- HumTrack: Hum to MIDI DAW (iOS) — https://mwm.ai/apps/app/6775845423
- ToneScribe Pro: Audio to MIDI (iOS/macOS, on-device) — https://apps.apple.com/app/id6760222673
- Nada (iOS) — https://apps.apple.com/app/id6670599599
- Melody Sketch (iOS) — https://mwm.ai/apps/draw-melody/6748230892
- ハミングノート / Humming Note (iOS, Japan) — https://apps.apple.com/jp/app/id1575316445
- Note Recognition: Sheet Music (Android) — https://www.appbrain.com/app/note-recognition-sheet-music/fm.mystage.note_recognition
- AI Note Recognition & Tuner (Android) — https://www.similarweb.com/app/google/com.note_recognition.sheet_music_ai/
- BandLab (iOS/Android/Web, Audio-to-MIDI im Abo) — https://help.bandlab.com/hc/en-us/articles/37575596722329-Converting-Audio-to-MIDI
- iComposer (iOS, alt, Status unklar) — https://musicradar.com/news/tech/iphone-app-turns-hummed-audio-into-midi-208047

**(b) Desktop-Notensatz/Transkription mit Audio-Eingang**
- ScoreCloud Studio (Win/Mac) — https://scorecloud.com/
- ScoreCloud Songwriter — https://scorecloud.com/learn/songwriter-vs-studio/
- AnthemScore (Win/Mac/Linux) — https://www.lunaverus.com/compareEditions
- capella audio2score pro 5 (Win; Gesang laut Hersteller noch nicht) — https://www.capella-software.com/index.cfm/us/products/capella-audio2score-pro/
- StaffPad Piano Capture (iPad/Win; Klavier) — https://www.staffpad.net/autumn-2023-update
- Neuratron AudioScore Ultimate 8 / Lite in Sibelius (unmaintained) — https://www.avid.com/plugins/audioscore-ultimate

**(c) Web-Dienste**
- Songscription — https://www.songscription.ai/sheet-music-maker
- SingConvert (La Touche Musicale) — https://latouchemusicale.crunch.help/en/sing-convert/what-is-sing-convert
- PianoConvert (La Touche Musicale, nur Klavier) — https://alternativeto.net/software/pianoconvert/about
- MuseScore Audio-to-Score (Beta, kostenlos) — https://www.mu.se/posts/musescore-audio-score-features
- Klangio Web (Sing2Notes/Melody Scanner im Browser) — https://brutkasten.com/artikel/klangio-app-verwandelt-mittels-ki-musik-in-noten/2
- Frettable (Audio → Noten, Noteflight-Anbindung) — https://notes.noteflight.com/frettable-adds-noteflight-integration/
- MIDIFLOW (Basic Pitch im Browser, unverifiziert) — https://hunted.space/product/midiflow
- Hum2Song (Begleitung, keine Noten) — https://github.com/toxtli/hum2song

**(d) DAWs / Plugins: Stimme → MIDI**
- Melodyne 5 (essential/assistant/editor/studio) — https://helpcenter.celemony.com/M5/doc/melodyneAssistant5/en/M5tour_ExportMIDI_otherDAWs
- Ableton Live 12 Standard/Suite „Convert Melody to New MIDI Track" — https://www.ableton.com/en/live-manual/12/converting-audio-to-midi/
- Logic Pro (Mac) „Create MIDI Track from Flex Pitch Data" — https://www.musicgurus.com/courses/logic-pro-x-audio-recording-sampling-effects/lessons/how-to-converti-pitch-to-midi-data-in-logic-pro-x/
- Cubase Pro VariAudio „Extract MIDI" — https://steinberg.help/cubase_pro/v10/en/cubase_nuendo/topics/sample_editor_variaudio/sample_editor_variaudio_c.html
- Studio One Pro 7 (Melodyne essential) — https://www.soundonsound.com/techniques/studio-one-melodyne-essential
- FL Studio Edison „Convert to score" — https://forum.image-line.com/viewtopic.php?p=2035119
- Reaper ReaTune — https://www.cockos.com/wiki/index.php/Use_Reatune_to_write_audio_to_midi
- NeuralNote (kostenlos, Open Source, offline) — https://www.kvraudio.com/news-print.php?id=62123
- Spotify Basic Pitch (Open Source) — https://engineering.atspotify.com/meet-basic-pitch/
- Klangio Transcription Studio (VST3/AU, Cloud) — https://www.soundonsound.com/news/klangio-launch-transcription-studio
- Samplab 2 — https://magneticmag.com/2023/01/samplab-2-review/
- ACE Studio 2 (Vocal to MIDI + Lyrics) — https://www.soundonsound.com/news/ace-studio-20-timedomain

**(e) Echtzeit-Voice-to-MIDI-Instrumente**
- imitone — https://imitone.itch.io/imitone
- Vochlea Dubler 2 / Dubler Studio Kit 2 — https://musictech.net/reviews/software-instruments/vochlea-dubler-2-review/
- Jam Origin MIDI Guitar 3 (Gitarre, nicht Stimme) — https://vi-control.net/community/threads/midi-guitar-3-on-the-way-looks-absolutely-incredible.148271/

**(f) Eingestellt / nicht empfehlenswert / keine Transkription**
- Apple Music Memos (eingestellt 2021) — https://9to5mac.com/2021/03/02/apple-music-memos-voice-memos-integration/
- Microsoft Songsmith (letzte Version 2012) — https://en.wikipedia.org/wiki/Microsoft_Research_Songsmith
- Samsung Hum On! (2016, Verbleib unklar) — https://limelight-arts.com.au/news/samsung-launches-app-that-turns-singing-into-sheet-music/
- Humtap (Firma lt. Dealroom geschlossen) — https://app.dealroom.co/companies/humtap
- Neuratron AudioScore/PhotoScore/NotateMe (seit 2015/2019 ohne Entwicklung) — https://neuratron.com/about.htm
- Akoff Music Composer, WIDI, intelliScore (Altsoftware) — https://www.heise.de/download/product/widi-recognition-system-standard-65192
- Soundslice, Notion Mobile/Notion 6, Symphony Pro, Dorico, Noteflight, Flat.io, Hookpad, Score Creator, Maestro (keine Audio-Transkription) — s. Steckbriefe
- Transcribe!, Chordify, Moises, Lalal.ai, Google Hum to Search, SoundHound, Singscope/Vocal Pitch Monitor/OnPitch, Songify, Auto-Tune (andere Aufgabe) — s. Steckbriefe

### Inferences
- Für „singen zum Klick → lesbare Noten → MusicXML" sind nur wenige Produkte wirklich auf diesen Fall zugeschnitten: ScoreCloud Studio (einziges mit dokumentiertem eingebauten Klick, Fußtipp-Option und Voice-Modus), Sing2Notes/Songscription/SingConvert (nur Datei oder Browser-Aufnahme, kein Metronom dokumentiert) und MuseScores Audio-to-Score (nur Datei-Upload).
- Alle noten-erzeugenden Dienste außer AnthemScore, NeuralNote, StaffPad und ToneScribe laden Audio in die Cloud; wer das nicht will, landet bei AnthemScore oder NeuralNote (dann aber mit Nachbearbeitung in MuseScore).
- Die Bewertungslage spricht gegen ScoreCloud Express (2 ★) und ist bei Sing2Notes gemischt (3,7 ★); keine der Mobil-Apps hat eine breite, positive Nutzerbasis für Gesang.
- Die vielen neuen Kleinst-Apps (Hum2MIDI, AnySing, HumTrack, ToneScribe) sind 2025/2026 erschienen und haben kaum Bewertungen; sie sind Experimente, keine erprobten Werkzeuge.

### Gaps
- Offizielle Preisseiten von ScoreCloud, Klangio, imitone, Lunaverus waren nicht abrufbar; Euro-Preise für Sing2Notes/Universe und AnthemScore konnten nicht bestätigt werden.
- Ob Melodyne **essential** (nicht nur assistant) MIDI exportieren kann, ist nach den Quellen widersprüchlich.
- Ob capella audio2score pro MusicXML exportiert und was der Pop-Modus mit Gesang macht, blieb offen.
- GarageBand: kein Beleg gefunden, dass eine Audio-zu-MIDI-Funktion existiert oder fehlt (sehr wahrscheinlich fehlt sie, aber unbelegt).
- Lalal.ai, Waves (OVox), Pitch Lab, Tunely, Melodist, Humtap-App-Status, Hum On!-Verbleib, Frettable-Preise, Jam-Origin-Preis: keine verwertbaren Quellen.
- Keine der Quellen dokumentiert für Sing2Notes, Songscription oder SingConvert einen Einzähler/Metronom bei der Browser-Aufnahme oder ein Tempo-Feld zur Quantisierung.
- Keine Belege zu nennenswerten chinesischen Hum-to-Score-Apps; auf Japanisch nur ハミングノート und Hum2MIDI gefunden.

## Frage 2: Welche gelten als die besten für gesungene einstimmige Melodien? Gibt es Vergleichstests?

### Takeaway
Es gibt keinen unabhängigen Head-to-Head-Test speziell für gesungene Melodien aus Scoring Notes, Sound On Sound, MusicRadar, heise/c't, Bonedo, Amazona oder delamar. Die vorhandenen „Best of"-Listen sind herstellernah oder affiliate-getrieben; Konsens darin: Melodyne für präzise Einzelnoten-Kontrolle, Basic Pitch/NeuralNote als kostenlose Option, ScoreCloud als dediziertes Notationswerkzeug — und überall gilt: Tonhöhe meist gut, Rhythmus/Notenlängen müssen nachbearbeitet werden.

### Cited Findings
- Ranking 2026 (Future Proof Music School, redaktionell/affiliate): Melodyne „strongest choice for surgical, note-by-note control"; Basic Pitch als kostenlose Schnelllösung; imitone für Live-Performance; ACE Studio „sing directly into the app"; Logic-Audio-to-MIDI für Gesang in einem Forum kritisiert; kein gemessener Vergleich — [futureproofmusicschool](https://futureproofmusicschool.com/blog/best-audio-to-midi-converters)
- VI-Control-Thread „what is the best most accurate program that can convert audio into midi" — Community-Diskussion, kein Test — [vi-control](https://vi-control.net/community/threads/what-is-the-best-most-accurate-program-that-can-convert-audio-into-midi.134036/)
- Songscription-Blogs „Songscription vs Klangio", „vs Moises", „best audio-to-MIDI converters" — Herstellerquelle, befangen — [vs Klangio](https://www.songscription.ai/blog/songscription-vs-klangio), [Best Converters](https://www.songscription.ai/blog/best-audio-to-midi-converters)
- ScoreCloud-Guides (Hersteller): „pitch accuracy is typically high for a clear, solo vocal recording, and rhythm quantization is the main area that needs editing"; Summen ist leichter als polyphon, Timing „more rubato than metronomic"; Slides erzeugen Extra-Noten — [Voice to Sheet Music](https://scorecloud.com/learn/voice-to-sheet-music/), [Humming](https://scorecloud.com/learn/humming-to-sheet-music/)
- Songscription-Guide „Hum to sheet music" (Hersteller) — [songscription.ai](https://www.songscription.ai/blog/hum-to-sheet-music)
- MusicTech zu Dubler 2: „live audio-to-MIDI solution is still better for beats than pitch" — [MusicTech](https://musictech.net/reviews/software-instruments/vochlea-dubler-2-review/)
- Attack Magazine zu Logic Flex-Pitch-Konvertierung: „hit and miss" — [Attack](https://attackmagazine.com/reviews/gear-software/apple-logic-pro-x/5)
- Reaper/ReaTune: Vibrato → „a mess of notes" (Forum) — [rhythmgamingworld](https://rhythmgamingworld.com/?p=396789)
- Ableton: Fehlerarten verpasste Einsätze, Fehlnoten, Oktavsprünge, Längen, Timing; Legato-Phrasen brauchen manuelle Notengrenzen — [MusicTech Ableton-Tutorial](https://musictech.com/tutorials/ableton-pu-6/), [Aulart](https://www.aulart.com/blog/audio-to-midi-conversion/)
- Slant zu ScoreCloud: Lob für Audio-Transkription und MusicXML; Kritik: „results aren't always exact", Free ohne MIDI-Export — [Slant](https://www.slant.co/options/12705/~scorecloud-review)
- Sing2Notes-Nutzer (Dez 2024): keine brauchbare Transkription trotz Tempo-/Abstandsvariation — [justuseapp](https://justuseapp.com/en/app/1588721118/sing2notes/reviews)
- Hacker-News-Nutzer zu ScoreCloud Songwriter: „it does work", Editor schwach → Export nach MuseScore — [saashub](https://www.saashub.com/scorecloud)
- Sound On Sound hat capella audio2score pro 5 getestet („how good are the results?"), Urteil im Auszug nicht enthalten — [SOS](https://www.soundonsound.com/reviews/capella-audio2score-pro-5?amp)
- Scoring Notes berichtete 2023/2024 über StaffPads Piano Capture, nicht über Gesangstranskription — [Scoring Notes](https://www.scoringnotes.com/news/staffpad-captures-the-imagination/)
- Deutsche Fachpresse: heise-Download listet nur Melodyne (c't 6/2010), capella-scan, touchAble; kein c't-Test zu Gesang→Noten gefunden — [heise](https://www.heise.de/download/products/windows/audio/midi/midi-tools); Bonedo hat einen Vochlea-Artikel (Inhalt nicht einsehbar) — [bonedo](https://www.bonedo.de/?p=151116); mobiFlip nur zu Hum On! 2016 — [mobiFlip](https://www.mobiflip.de/?p=263540)
- Gitnux-„Top 10 Voice to MIDI 2026" — generierte Liste ohne Testbasis — [gitnux](https://gitnux.org/best/voice-to-midi-software/)

### Inferences
- Da niemand gemessene Vergleiche veröffentlicht hat, ist der eigene Test mit einer kurzen, zum Klick gesungenen Phrase der einzige verlässliche Weg; die kostenlosen Einstiege (ScoreCloud Free, Sing2Notes-Demo 20 s, Songscription 30 s, MuseScore Audio-to-Score, NeuralNote) erlauben das ohne Kosten.
- Das Problem des eigenen Prototyps (lange Töne zerfallen) ist laut Herstellerguides und DAW-Tutorials genau die bekannte Schwachstelle aller Systeme (Vibrato, Legato, Glissando → Extra-Noten); Lösungen in den Produkten: Tonart-Quantisierung vor Export (Logic/SOS), Skalen- und Zeitquantisierung im Plugin (NeuralNote), nachträgliches „Tap Beat" (ScoreCloud).

### Gaps
- Kein unabhängiger Vergleichstest für gesungene Monophonie gefunden; auch keine YouTube-Vergleiche mit belastbaren Beschreibungen in den Suchergebnissen.
- Das Urteil des SOS-Tests zu capella audio2score pro 5 und ggf. SOS-Tests zu ScoreCloud Studio konnten nicht gelesen werden.

## Frage 3: Welche Produkte passen in den Workflow „Export MusicXML/MIDI → MuseScore / eigene App"?

### Takeaway
MusicXML liefern ScoreCloud (ab Plus), Klangio (Sing2Notes, Melody Scanner, Transcription Studio; bezahlt), Songscription (bezahlt), SingConvert, AnthemScore und AudioScore; MuseScores Audio-to-Score liefert direkt MSCZ. Nur-MIDI liefern alle DAW-Wege, NeuralNote, Hum2MIDI, HumTrack, AnySing, Note Recognition; MIDI lässt sich in MuseScore importieren, verliert aber Notation (Enharmonik, Balken, Pausenlogik) und hängt an der Quantisierung des Exporteurs.

### Cited Findings
- ScoreCloud: MusicXML-Import/-Export; Free-Plan ohne MIDI-Export; Pro „all import & export formats" — [Slant](https://www.slant.co/options/12705/~scorecloud-review), [scorecloud.com](https://scorecloud.com/)
- Sing2Notes: „Download sheet as PDF, MIDI, or MusicXML" — [App Store](https://apps.apple.com/app/id1588721118); Melody Scanner: PDF/MIDI/MusicXML, MIDI/MusicXML nur im Abo — [App Store](https://apps.apple.com/us/app/-/id6472921068); Transcription Studio: pro Instrument eine unquantisierte MIDI-Datei — [inkl](https://www.inkl.com/news/klang-io-says-transcription-studio-is-the-world-s-first-ai-music-tool-that-can-transcribe-multiple-instruments-simultaneously)
- Songscription: „MusicXML for notation software", MIDI/MusicXML nur bezahlt — [songscription.ai](https://www.songscription.ai/sheet-music-maker), [itechguides](https://www.itechguides.com/compare/songscription-vs-melody-scanner/); eigener Guide „Audio to MusicXML" nennt MuseScore als Ziel — [songscription.ai](https://www.songscription.ai/audio-to-musicxml)
- SingConvert: PDF, MIDI, MusicXML — [Hilfe](https://latouchemusicale.crunch.help/en/sing-convert/what-is-sing-convert)
- AnthemScore: PDF/MusicXML/MIDI/ASDT (alle Editionen lt. Hersteller) — [lunaverus.com](https://www.lunaverus.com/compareEditions)
- AudioScore: „Send to Sibelius"-Button, MusicXML — [Neuratron-Kompatibilität](https://neuratron.com/compatibility_sib_as.htm)
- MuseScore Audio-to-Score: Ausgabe MSCZ, „open and edit in MuseScore Studio" — [mu.se](https://www.mu.se/posts/musescore-audio-score-features)
- Melodyne: MIDI-Datei-Export mit Position/Länge/Tonhöhe je Note — [Celemony](https://helpcenter.celemony.com/M5/doc/melodyneAssistant5/en/M5tour_ExportMIDI_otherDAWs)
- NeuralNote: MIDI mit optionaler Skalen-/Zeitquantisierung im Plugin — [KVR](https://www.kvraudio.com/news-print.php?id=62123)
- Hum2MIDI: Standard-MIDI via iOS-Share-Sheet, Quantisierung 1/4–1/16 — [App Store](https://apps.apple.com/tt/app/id6786317080); Note Recognition (Android): MIDI-Export — [AppBrain](https://www.appbrain.com/app/note-recognition-sheet-music/fm.mystage.note_recognition)
- Noteflight ↔ Flat: Austausch per MusicXML empfohlen — [Flat-Hilfe](https://help.flat.io/en/music-notation-software/import-sheet-music-from-noteflight/)
- Score Creator (iOS) importiert/exportiert MIDI und MusicXML und könnte als mobiler Zwischenschritt dienen — [appfollow](https://apps.appfollow.io/ios/score-creator-compose-music/627486149?country=us)

### Inferences
- Für den iPhone/iPad-Alltag mit MusicXML-Ziel bleiben realistisch Sing2Notes (App) und Songscription/SingConvert (Safari); für den Windows-PC ScoreCloud Studio (mit Klick) oder AnthemScore (offline, Datei-basiert, MusicXML).
- Wer nur MIDI bekommt (NeuralNote, Hum2MIDI, DAWs), sollte beim Import in MuseScore die kleinste Notenwert-Quantisierung setzen; die Produkte selbst bieten dafür teils Schalter (NeuralNote, Hum2MIDI), ScoreCloud/Klangio quantisieren intern.
- Für die eigene App ist das Datenformat der Dienste (MusicXML mit vorab quantisierten Dauern) direkt übernehmbar; MIDI-Exporte bräuchten eigene Quantisierung — genau die Stelle, an der der Prototyp derzeit lange Töne fragmentiert.

### Gaps
- Ob Sing2Notes/Songscription im MusicXML Liedtext-Silben oder nur Noten liefern, wurde nicht belegt.
- MusicXML-Export von capella audio2score pro und ACE Studio nicht bestätigt.
- Keine Quelle beschreibt die Qualität der MusicXML-Dateien (Balkung, Pausen, Auftakte) der einzelnen Dienste beim Import in MuseScore.

## Frage 4: Klangio im Detail (Sing2Notes, Melody Scanner, Transcription Studio, API, Technik, Team)

Recherche-Hinweis: Dieser Abschnitt wurde auf Nachfrage ergänzt, nachdem das Such-Budget dieser Sitzung aufgebraucht war; direkte Abrufe von klang.io, klangio.com, apps.apple.com, dblp.org, arxiv.org, api.semanticscholar.org, runpod.io, brutkasten.com, soundonsound.com und justuseapp.com wurden vom Proxy abgewiesen. Es konnten also **keine** neuen Quellen zu Team-Publikationen, Patenten, Stellenanzeigen, API-Dokumentation oder Hilfe-Center gelesen werden. Unten steht, was aus den bereits gesammelten Quellen belegbar ist; alles andere steht unter „Gaps" mit konkreten Suchvorschlägen.

### Takeaway
Belegt ist: Klangio GmbH sitzt in Karlsruhe, verarbeitet in der Cloud (GPU-Partnerschaft mit Runpod, Internet-Pflicht beim Plugin), bietet Sing2Notes als App/Web ohne Registrierung mit 20-Sekunden-Demo, Pro ab ca. 8,49–9,99 $/Monat, Export PDF/MIDI/MusicXML, und seit März 2026 ein VST3/AU-Plugin „Transcription Studio", das pro Instrument **unquantisiertes** MIDI ausgibt (die Notenansicht ist also eine separat quantisierte Darstellung). Zu Tempo-/Taktart-Eingabe, Metronom, kleinstem Notenwert, API-Preisen und den wissenschaftlichen Veröffentlichungen des Gründers konnte in dieser Sitzung nichts belegt werden.

### Cited Findings

**Firma, Herkunft, Infrastruktur**
- „Klang.io is an AI-focused music software company based in Karlsruhe, Germany" — [Pressemeldung Hummingbird Media](https://news.hummingbirdmedia.com/klangio-announces-spring-sale-40-off-transcription-studio-and-universe-subscriptions)
- Klangio tritt als Aussteller im deutschen Pavillon der NAMM auf (Bundesministerium für Wirtschaft) — [German Pavilion NAMM](https://namm.german-pavilion.com/en/sites/exhibitors/130332)
- Runpod (GPU-Cloud-Anbieter) veröffentlichte einen Partnerschafts-Blogbeitrag „Klangio AI music transcription partnership" — die Verarbeitung läuft demnach auf gemieteten Cloud-GPUs; Inhalt nicht lesbar, nur Titel/URL — [Runpod-Blog](https://www.runpod.io/blog/klangio-ai-music-transcription-partnership)
- Klangio sponsert die Podiumsdiskussion „Tune the Future of Music" der Munich Music Labs — [Hummingbird/Klang.io-Newsroom](https://klang-io.hummingbirdmedia.com/)
- brutkasten (2023): Sing2Notes gehört zu einer Klangio-Reihe, die KI-gestützt Gesang und Instrumente in Noten überträgt; **keine Registrierung nötig**, funktioniert **auch im Browser** — [brutkasten](https://brutkasten.com/artikel/klangio-app-verwandelt-mittels-ki-musik-in-noten/2)
- Klangio GmbH ist als Entwickler im Google Play Store gelistet (mehrere Apps) — [AppBrain Entwicklerseite](https://www.appbrain.com/dev/Klangio+GmbH/)
- Weitere Produkte derselben Firma: Drum2Notes („Transcribe Drums") im App Store — [App Store](https://apps.apple.com/hn/app/drum2notes-transcribe-drums/id6717586517?l=en-GB); Piano2Notes und Guitar2Tabs in Vergleichslisten — [itechguides scorecloud vs piano2notes](https://www.itechguides.com/compare/scorecloud-vs-piano2notes/), [scorecloud vs guitar2tabs](https://www.itechguides.com/compare/scorecloud-vs-guitar2tabs/)

**Sing2Notes: Produktverhalten, soweit belegt**
- App-Store-Beschreibung: „Transkription von Solo-Gesang in Notenblätter", Eingabe Solo-Gesangsaufnahme oder MP3-Datei, „Download sheet as PDF, MIDI, or MusicXML"; kostenlos mit In-App-Käufen — [App Store](https://apps.apple.com/app/id1588721118), [App Store (HN, en)](https://apps.apple.com/hn/app/sing2notes/id1588721118?l=en-GB)
- In-App-Käufe lt. Store-Liste: Pro 9,99 $/Monat, 99,99 $/Jahr; Klangio Universe 24,99 $/Monat, 249 $/Jahr (Währung in der Liste USD; Euro-Preise nicht bestätigt) — [App Store](https://apps.apple.com/us/app/-/id1588721118)
- Gratis-Kontingent: „unlimited free demo transcriptions capped at 20 seconds", volle Transkriptionen im Abo (Drittquelle) — [moge.ai](https://moge.ai/de/product/klangio)
- Konkurrenz-Blog (befangen): Transcription-Studio-Pro ca. 8,49 $/Monat jährlich bzw. 19,99 $ monatlich; Klangio fährt häufige Rabattaktionen — [Songscription-Blog](https://www.songscription.ai/blog/songscription-vs-klangio); Frühjahrs-Sale 40 % auf Jahresabos bis 6. April 2026 — [Pressemeldung](https://news.hummingbirdmedia.com/klangio-announces-spring-sale-40-off-transcription-studio-and-universe-subscriptions)
- Melody Scanner (Schwesterprodukt, gleiche Engine-Familie): Eingabe Mikrofon-Aufnahme, Audiodatei oder YouTube-Link; Ansichten Noten, Piano-Roll, Tab; **keine Live-Notenerkennung** (also Nachverarbeitung der ganzen Aufnahme, nicht Echtzeit); nur Solo-Instrumente, mehrere gleichzeitig ergibt schlechte Ergebnisse; Free bis 40 Takte (~2 Min.); Desktop-Browser-Version hat mehr Editierfunktionen; Sync über Konto — [App Store Melody Scanner](https://apps.apple.com/us/app/-/id6472921068)
- Transcription Studio (18. März 2026): VST3/AU-Plugin und Standalone für Windows/macOS; „cloud processing means an internet connection is required"; Abos ab 4 £/Monat inkl. MwSt.; Demo gratis — [Sound On Sound](https://www.soundonsound.com/news/klangio-launch-transcription-studio); Pressemeldung aus Karlsruhe: „available both as an online tool and a DAW plugin" — [Pressemeldung](https://news.hummingbirdmedia.com/unlock-the-power-of-music-transcription-with-klangio-transcription-studio-the-first-ai-suite-for-multiple-instruments); „in under 30 seconds" Noten, Tabs oder MIDI — [Mixdown](https://mixdownmag.com.au/news/klang-ios-transcription-studio-can-turn-any-audio-into-sheet-music-tabs-or-midi-in-under-30-seconds/)
- Das Plugin trennt bis zu acht Instrumente und erzeugt **je Instrument eine separate, unquantisierte MIDI-Datei** (Aggregator-Meldung, Herstellerangabe) — [inkl](https://www.inkl.com/news/klang-io-says-transcription-studio-is-the-world-s-first-ai-music-tool-that-can-transcribe-multiple-instruments-simultaneously); dieselbe Acht-Instrumente-Angabe in einem privaten Blog-Review 2026 — [imseankim](https://blog.imseankim.com/klangio-transcription-studio-ai-multi-instrument-transcription-review-2026/)

**Nutzerstimmen speziell zu gesungenen Melodien**
- App Store: 3,7 ★ bei 73 Bewertungen (andere Abrufe: 71 bzw. 78 Bewertungen, 3,6 ★) — [App Store](https://apps.apple.com/app/id1588721118), [appshunter](https://appshunter.io/ios/app/guitar-bass-and-ukulele-tuner/id1221945088/similar)
- justuseapp (automatische NLP-Auswertung von 73 Reviews, geringe Belastbarkeit): rund zwei Drittel negativ; ein Nutzer (Dezember 2024) erhielt trotz mehrerer Versuche mit verschiedenen Tempi und Mikrofonabständen keine verwertbare Transkription — [justuseapp](https://justuseapp.com/en/app/1588721118/sing2notes/reviews)
- Nutzerbericht des Auftraggebers dieser Recherche (nicht veröffentlicht, Stand Okt 2026): Sing2Notes liefert deutlich weniger Lücken/Fragmentierung als der eigene Prototyp; Tonhöhen gelegentlich falsch, Rhythmus liest sich „glatt". — Eigenbericht, keine externe Quelle.
- Vergleichsseite (Drittquelle): bei Melody Scanner sind MIDI/MusicXML-Export nur im Bezahlabo — [itechguides](https://www.itechguides.com/compare/songscription-vs-melody-scanner/)

### Inferences
- Die Kombination „unquantisiertes MIDI je Instrument" (Plugin) plus Notenansicht legt nahe, dass Klangio zwei Stufen trennt: eine Notenerkennung mit freien Onsets/Offsets und eine separate rhythmische Quantisierung/Tempo-Schätzung für die Notendarstellung. Das würde den Eindruck des Nutzers erklären (Rhythmus „glatt", Tonhöhen gelegentlich daneben): die Quantisierung glättet, die Tonhöhenerkennung bleibt roh.
- „Keine Live-Notenerkennung" (Melody Scanner) deutet darauf hin, dass die ganze Aufnahme offline analysiert wird — das erlaubt Verfahren, die über die gesamte Phrase hinweg Onsets zusammenfassen (z. B. Tempo-Schätzung über das ganze Stück und Verschmelzen kurzer Fragmente), was ein Echtzeit-Prototyp mit frame-weiser Entscheidung nicht kann. Das ist eine Vermutung aus dem Produktverhalten, kein belegtes Verfahren.
- Da das Gratis-Kontingent 20 Sekunden beträgt und keine Registrierung nötig ist, lässt sich die Qualität bei kurzen Phrasen zum Klick kostenlos systematisch mit dem eigenen Prototyp vergleichen (gleiche Aufnahme, MusicXML beider Seiten in MuseScore nebeneinander).
- Für eine Anbindung der eigenen App wäre nur eine Entwickler-API sinnvoll; ob und zu welchen Konditionen Klangio eine anbietet, ist offen (s. Gaps). Die Cloud-Pflicht widerspräche zudem dem Offline-/„alle Daten auf dem Gerät"-Prinzip der CheatSheet-App.

### Gaps (in dieser Sitzung nicht recherchierbar — Suchvorschläge)
- **Technik-Selbstdarstellung**: klang.io-Website, Blog, Hilfe-Center/FAQ, Stellenanzeigen, Patente wurden nicht gelesen. Suchvorschläge: „klang.io blog transcription model", „Klangio FAQ tempo time signature", „Klangio Stellenangebot Machine Learning Karlsruhe", DPMA-/Espacenet-Suche nach Anmelder „Klangio GmbH".
- **Publikationen des Teams**: Gründer Sebastian Murgul (KIT, Gruppe Michael Heizmann) — ISMIR/ICASSP/DAFx-Paper 2021–2026 zu Gesangstranskription, Gitarren-Tabulatur, Notensegmentierung, Quantisierung sowie veröffentlichte Datensätze konnten nicht abgerufen werden (dblp, arXiv, Semantic Scholar blockiert). Suchvorschläge: dblp „Sebastian Murgul", arXiv-Autorensuche „Murgul", ISMIR-Proceedings 2022–2025 Volltextsuche „Klangio", KIT-Publikationsserver „Murgul Heizmann". Hinweis: Aus dem Gedächtnis des Rechercheurs existieren Arbeiten dieses Teams zu Gitarren-Tabulatur-Transkription und zu Gesangs-/Notenquantisierung; da nicht verifiziert, hier bewusst **nicht** als Fakt aufgeführt.
- **Konkretes Produktverhalten** (Sing2Notes): ob Tempo/Taktart vorab abgefragt oder geschätzt werden, ob ein Raster/kleinster Notenwert einstellbar ist, ob es Metronom/Einzähler bei der In-App-Aufnahme gibt, ob die Tonart erkannt oder gesetzt wird — keine Quelle gefunden. Am schnellsten durch eigenen Test im Browser (klang.io, 20-Sekunden-Demo) zu klären.
- **API**: Existenz, Dokumentation, Preise einer Klangio-Entwickler-API — nicht belegt. Suchvorschläge: „klang.io API", „Klangio developer API pricing", „api.klang.io".
- **Euro-Preise** und aktuelles Gratis-Kontingent (20 s vs. 40 Takte je nach Produkt) — nur Drittquellen bzw. USD-Store-Liste.
- **Reviews zu Gesang**: nur eine konkrete Negativmeldung (Dez 2024) und die automatisierte justuseapp-Auswertung; keine Reddit-/Forum-Threads mit Beispielen gefunden (Suche nicht mehr möglich). Suchvorschläge: „Sing2Notes reddit", „Klangio Gesang Erfahrung", „Sing2Notes MusicXML MuseScore".
