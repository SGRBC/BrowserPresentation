#!/usr/bin/env bash
# Starts the local web server for the presentation app and opens it in the browser.
# Works on macOS and Linux. Override the port with:  PORT=8080 ./start.sh
set -u

cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8000}"
URL="http://127.0.0.1:${PORT}/index.html"

# Find a working Python 3 (each candidate is actually run, not just looked up).
PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "Python 3 was not found."
  echo "  macOS:  brew install python   (or https://www.python.org/downloads/)"
  echo "  Debian/Ubuntu:  sudo apt install python3"
  echo "  Fedora:  sudo dnf install python3"
  exit 1
fi

# Open the default browser (macOS: open, Linux: xdg-open, Android/Termux: termux-open-url / am).
open_browser() {
  if command -v termux-open-url >/dev/null 2>&1; then
    termux-open-url "$URL" >/dev/null 2>&1
  elif command -v termux-open >/dev/null 2>&1; then
    termux-open "$URL" >/dev/null 2>&1
  elif command -v am >/dev/null 2>&1; then
    am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1
  else
    echo "Open this address in your browser: $URL"
  fi
}

# Starts the server as a background process (no terminal needed; it is bound to localhost only and returns once it
# answers, or immediately if one is already running), then opens the app. Log: presentation-server.log in the temp folder.
export PORT
if "$PY" server.py --background; then
  open_browser
else
  exit 1
fi
