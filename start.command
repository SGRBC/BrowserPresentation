#!/usr/bin/env bash
# macOS: double-click this file in Finder to start the app.
# It runs start.sh (the server runs in the background), then closes the Terminal window it opened.
cd "$(dirname "$0")" || exit 1
if bash ./start.sh; then
  # Close this Terminal window once the shell has exited. Only matters when launched by double-click.
  if [ "${TERM_PROGRAM:-}" = "Apple_Terminal" ]; then
    ( sleep 1; osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 ) &
  fi
  exit 0
fi
echo "Press Enter to close."
read -r _
