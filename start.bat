@echo off
setlocal
cd /d "%~dp0"

set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%/index.html"

rem Find a working Python. Each candidate is actually run, because "python" on Windows
rem is often the Microsoft Store placeholder, which exists but does not work.
set "PY="
py --version >nul 2>nul && set "PY=py"
if not defined PY python --version >nul 2>nul && set "PY=python"
if not defined PY goto :nopython

rem Start the server as a hidden background process (bound to localhost only). This returns once the server
rem answers, or immediately if one is already running. Log: presentation-server.log in the temp folder.
%PY% server.py --background
if errorlevel 1 (
  pause
  goto :eof
)
start "" "%URL%"
goto :eof

:nopython
echo Python was not found.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
pause
