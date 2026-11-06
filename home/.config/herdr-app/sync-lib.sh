#!/usr/bin/env bash
# Herdr mods cannot import outside their own folder, so the shared helper is copied into each mod.
# Edit lib/pi-session.js, run this, commit the copies. `sync-lib.sh --check` fails if a copy drifted.
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
rc=0
for mod in session-card session-header quota-bar; do
  if [ "${1:-}" = "--check" ]; then
    cmp -s "$dir/lib/pi-session.js" "$dir/mods/$mod/pi-session.js" || { echo "drift: mods/$mod/pi-session.js"; rc=1; }
  else
    cp "$dir/lib/pi-session.js" "$dir/mods/$mod/pi-session.js"
  fi
done
exit $rc
