#!/usr/bin/env bash
# In-engine walkthrough: for each map, CCASelfTest (cca_selftest 2) collects
# the objective items, runs every hack terminal, kills the boss, checks the exit
# gate opened and activates the exit line; passes when the level exits.
#   tools/gz-walk.sh MAP01 [MAP02 ...]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GZDOOM="${GZDOOM:-$(command -v gzdoom || echo /home/user/tools-build/gzdoom/build/gzdoom)}"
IWAD="${IWAD:-$(ls /usr/share/games/doom/freedoom2.wad 2>/dev/null || echo freedoom2.wad)}"
OUT="${OUT:-$ROOT/shots/walk}"; mkdir -p "$OUT"
[ "${SKIPBUILD:-0}" = 1 ] || node "$ROOT/tools/build.mjs" >/dev/null || exit 1
export HOME="$ROOT/.gz/home"
fail=0
for MAP in "$@"; do
  timeout -s INT 300 xvfb-run -a -s "-screen 0 800x600x24" "$GZDOOM" -iwad "$IWAD" -file "$ROOT/dist/cosmic-calamity-assault.pk3" -nosound \
    +logfile "$OUT/$MAP.log" +cca_selftest 2 +"wait 30; map $MAP; wait 1400; quit" >/dev/null 2>&1
  if grep -q "CCA-WALK PASS" "$OUT/$MAP.log"; then echo "PASS $MAP"; else echo "FAIL $MAP"; fail=1; fi
  grep "CCA-WALK" "$OUT/$MAP.log" | sed 's/^/    /'
done
exit $fail
