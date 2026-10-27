@echo off
rem Einsingen zum Metronom, transkribieren, in MuseScore oeffnen.
rem   singen.cmd              (90 bpm, 8 Takte)
rem   singen.cmd 100 4        (Tempo, Takte)
rem   singen.cmd 90 8 C       (Tempo, Takte, Tonart: Toene auf die Leiter ziehen)
setlocal
cd /d "%~dp0"
set TF_CPP_MIN_LOG_LEVEL=2
set PYTHONUTF8=1

set TEMPO=%~1
if "%TEMPO%"=="" set TEMPO=90
set TAKTE=%~2
if "%TAKTE%"=="" set TAKTE=8
set TONART=
if not "%~3"=="" set TONART=--tonart %~3

for /f "tokens=1-3 delims=:., " %%a in ("%time%") do set STEMPEL=%%a%%b%%c
set STEMPEL=%STEMPEL: =0%
set NAME=aufnahmen\%date:~6,4%-%date:~3,2%-%date:~0,2%_%STEMPEL%
set WAV=%NAME%.wav
set MID=%NAME%-mono.mid

echo.
echo ==== Aufnahme: %TEMPO% bpm, %TAKTE% Takte ====
".venv\Scripts\python.exe" aufnehmen.py --tempo %TEMPO% --takte %TAKTE% --auf-eins --ausgabe "%WAV%"
if errorlevel 1 goto ende

echo.
echo ==== Transkription ====
".venv\Scripts\python.exe" monophon.py "%WAV%" --tempo %TEMPO% --versatz auto --von 80 --bis 1000 %TONART% --ziel "%MID%" 2>nul
if errorlevel 1 goto ende

echo.
echo ==== MuseScore ====
set XML=%NAME%-mono.musicxml
if exist "%XML%" (
    start "" "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" "%CD%\%XML%"
    echo Geoeffnet: %XML%
) else (
    start "" "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" "%CD%\%MID%"
    echo Geoeffnet: %MID%
)
echo Aufnahme zum Nachhoeren: %WAV%

:ende
echo.
echo Fenster mit beliebiger Taste schliessen.
pause >nul
