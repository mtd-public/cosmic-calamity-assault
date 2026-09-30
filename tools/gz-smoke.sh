#!/usr/bin/env bash
# Headless GZDoom smoke test. Builds the pk3, then for each map: boots GZDoom
# under Xvfb with Freedoom 2, runs the in-mod self-test (MAP01), takes
# screenshots (view, automap, later view), and fails on script/actor/map
# errors in the log.
#
#   tools/gz-smoke.sh [MAP01 MAP02 ...]     (default: every map in mod/maps, else MAP01)
# Env: GZDOOM (binary), IWAD (default freedoom2.wad), OUT (shots dir), WAIT (tics per map)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GZDOOM="${GZDOOM:-$(command -v gzdoom || echo /home/user/tools-build/gzdoom/build/gzdoom)}"
IWAD="${IWAD:-$(ls /usr/share/games/doom/freedoom2.wad 2>/dev/null || echo freedoom2.wad)}"
OUT="${OUT:-$ROOT/shots}"
WAIT="${WAIT:-140}"
PK3="$ROOT/dist/cosmic-calamity-assault.pk3"

node "$ROOT/tools/build.mjs" || { echo "build failed"; exit 1; }

export HOME="$ROOT/.gz/home"
INI="$HOME/.config/gzdoom/gzdoom.ini"
mkdir -p "$HOME/.config/gzdoom" "$OUT"
# GZDoom only renders in the background with these (and never start a map
# with +map on the command line: that path renders black headless).
if [ ! -f "$INI" ]; then
  timeout -s INT 60 xvfb-run -a -s "-screen 0 1280x800x24" "$GZDOOM" -iwad "$IWAD" -nosound +"wait 5; quit" >/dev/null 2>&1
fi
sed -i 's/^vid_fullscreen=.*/vid_fullscreen=false/; s/^vid_activeinbackground=.*/vid_activeinbackground=true/; s/^vid_defwidth=.*/vid_defwidth=1280/; s/^vid_defheight=.*/vid_defheight=720/' "$INI"

MAPS=("$@")
if [ ${#MAPS[@]} -eq 0 ]; then
  for f in "$ROOT"/mod/maps/*.wad; do [ -f "$f" ] && MAPS+=("$(basename "${f%.*}" | tr a-z A-Z)"); done
  [ ${#MAPS[@]} -eq 0 ] && MAPS=(MAP01)
fi

fail=0
for MAP in "${MAPS[@]}"; do
  LOG="$OUT/$MAP.log"
  rm -f "$LOG"
  rm -rf "$OUT/raw" && mkdir -p "$OUT/raw"
  timeout -s INT 240 xvfb-run -a -s "-screen 0 1280x800x24" "$GZDOOM" -iwad "$IWAD" -file "$PK3" -nosound \
    +logfile "$LOG" +screenshot_dir "$OUT/raw" +cca_selftest 1 +am_textured 1 +am_cheat 3 \
    +"wait 40; map $MAP; wait 70; god; screenshot; togglemap; wait 3; screenshot; togglemap; wait $WAIT; screenshot; wait 5; quit" \
    >/dev/null 2>&1
  rc=$?
  i=0
  for s in $(ls "$OUT/raw"/*.png 2>/dev/null | sort); do
    i=$((i+1)); mv "$s" "$OUT/$MAP-$i.png"
  done
  errs=$(grep -E "Script error|Execution could not continue|ZScript|Unknown actor|Unknown sprite|R_InstallSprite|not found|Could not find|Bad |Invalid |Tried to register|CCA-SELFTEST FAIL|unexpected" "$LOG" 2>/dev/null | grep -v "^GL_EXTENSIONS" | head -40)
  st=$(grep -E "CCA-SELFTEST (PASS|FAIL)" "$LOG" 2>/dev/null | tail -1)
  if [ -n "$errs" ] || [ $i -lt 3 ]; then
    echo "FAIL $MAP (exit $rc, $i shots) $st"; echo "$errs" | sed 's/^/    /'; fail=1
  else
    echo "PASS $MAP ($i shots) $st"
  fi
done
exit $fail
