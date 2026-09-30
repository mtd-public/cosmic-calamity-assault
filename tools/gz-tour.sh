#!/usr/bin/env bash
# WIP screenshot tour: for each map, CCATour visits objectives, IRIS beats,
# terminals and one of each monster type and screenshots them.
#   tools/gz-tour.sh MAP01 [MAP02 ...]      → shots/tour/<MAP>-NN.png
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GZDOOM="${GZDOOM:-$(command -v gzdoom || echo /home/user/tools-build/gzdoom/build/gzdoom)}"
IWAD="${IWAD:-$(ls /usr/share/games/doom/freedoom2.wad 2>/dev/null || echo freedoom2.wad)}"
OUT="${OUT:-$ROOT/shots/tour}"
SKIPBUILD="${SKIPBUILD:-0}"
[ "$SKIPBUILD" = 1 ] || node "$ROOT/tools/build.mjs" >/dev/null || exit 1
export HOME="$ROOT/.gz/home"; mkdir -p "$OUT"
for MAP in "$@"; do
  rm -rf "$OUT/raw"; mkdir -p "$OUT/raw"
  timeout -s INT 900 xvfb-run -a -s "-screen 0 1280x800x24" "$GZDOOM" -iwad "$IWAD" -file "$ROOT/dist/cosmic-calamity-assault.pk3" -nosound \
    +logfile "$OUT/$MAP.log" +screenshot_dir "$OUT/raw" +cca_tour 1 +enablescriptscreenshot 1 +r_drawfuzz 0 \
    +"wait 30; map $MAP; wait 5; god; wait 1800; quit" >/dev/null 2>&1
  i=0; for s in $(ls "$OUT/raw"/*.png 2>/dev/null | sort); do i=$((i+1)); mv "$s" "$OUT/$MAP-$(printf %02d $i).png"; done
  echo "$MAP: $i shots → $OUT"
done
