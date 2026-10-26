@echo off
rem Startet die Transkription in einem eigenen Fenster. Aufruf:
rem   lauf.cmd "Song.mp3"                       (Stimmen trennen, dann transkribieren)
rem   lauf.cmd "Stimme.wav" --ohne-trennung     (eine einzelne Stimme)
rem Weitere Schalter gehen an transkribieren.py durch (--geraet cuda, --tempo 120 ...).
rem Doppelklick ohne Argument: fragt nach der Datei.
setlocal
cd /d "%~dp0"

rem ffmpeg aus der winget-Installation, falls nicht ohnehin im PATH
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*") do (
    for /d %%B in ("%%D\ffmpeg-*") do set "PATH=%%B\bin;%PATH%"
)

rem TensorFlow-Geplapper unterdruecken
set TF_CPP_MIN_LOG_LEVEL=2
set PYTHONUTF8=1

if not exist ".venv\Scripts\python.exe" (
    echo Keine .venv gefunden. Siehe README.md, Abschnitt Einrichten.
    pause
    exit /b 1
)

if "%~1"=="" (
    set /p DATEI=Audio-Datei:
    call ".venv\Scripts\python.exe" transkribieren.py "%DATEI%"
) else (
    ".venv\Scripts\python.exe" transkribieren.py %*
)

echo.
echo Fenster mit beliebiger Taste schliessen.
pause >nul
