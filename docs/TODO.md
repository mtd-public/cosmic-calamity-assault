# Deferred work

What's left after the six-map alpha and the browser build, roughly in priority order.

## iPad / browser play
- **Test on a real iPad running iPadOS 27.**
  - Safari 27 (iOS/iPadOS 27, released 2026-09-14) added WebAssembly JSPI, according to Apple's Safari 27 release notes and MDN browser-compat-data.
  - Safari 17+ already supports WebGL2 in an OffscreenCanvas worker.
  - The vendored tomb-engine build (`web/engine/`) needs only those, plus older wasm features, so `/play/` may run unchanged on iPadOS 27.
  - Pair an Xbox controller. Pointer Lock doesn't exist on iPad.
  - Start with a tap: a gamepad button isn't a user gesture in Safari.
  - Watch memory: the download is about 70 MB and the wasm heap can grow to 2 GB.
- **Touch controls.**
  - Port the MIT-licensed `touch-input.js` from github.com/joeheyming/joeheyming.github.com (doom/). It only synthesises keyboard events.
  - Inside our worker setup, forward those events through `site/play/play.js`'s existing `post()` instead of dispatching them on a canvas.
- **Older iPads (stuck on iPadOS 26 or earlier) need a non-JSPI build.**
  - The best candidate is github.com/BurkeStrang/gzdoomwebassembly: GZDoom 4.15pre, Asyncify, single-threaded, no SharedArrayBuffer, GPLv3, with a ready GitHub Pages CI.
  - Estimate: 4-6 h, plus a smoke test of our ZScript on 4.15.
- **Right-stick look tuning** in the gamepad bridge (`site/play/gamepad.js`). The page slider defaults to 900 px/s.
- **Capture signal:** under heavy machine load the browser smoke test once missed the engine's "mouse captured" signal (the right stick needs it). The page now drops mouse-look deltas while unlocked and the spike right after a pointer-lock change, which had snapped the view to the ceiling.
- **Settings:** GZDoom writes its ini only on quit, so browser settings don't persist yet.
- **GPL:** tomb-engine publishes build scripts and a patch list, but not the patched engine source. Ask the author for it, or move to a 4.14 web build when one exists.
- **Audio:** the web build stubs 3D positional audio (stereo only).
- **Rejected:** porting to a Quake engine.
  - FTEQW's web build is the only Quake-family engine with an iPad Safari report (NZ:P on iPadOS 17).
  - It would be a full rewrite (QuakeC/CSQC, a new map pipeline, models), estimated at 18-30 agent-days.

## Art
- A second pass on the Stalker (`STLK`), the weakest of the characters.
- **Battle-rifle scope:**
  - The BRFL L-N frames draw only a thin eyepiece rim, leaving a clear circle about 90% of the screen half-height.
  - Match `SCOPEMSK` (tools/gfx.mjs) to it; the tour shows two rings today.
- **`forge.js hudFrames()`:**
  - `setViewOffset()` resets the camera aspect to 1.6, so HUD art made with it ends up about 20% too tall in GZDoom.
  - The weapon art uses its own renderer (`lib/wpn/core.js hud()`), which is correct.
  - Fix `hudFrames()` before anyone else uses it.
- Weakest weapon frames: the P9MM slide rack (I) and the extremes of the knife and blade swings.
- `LTRACK`'s top 16 units are solid deck edge, for MAP04's 3D-floor sides. Check that it doesn't look odd anywhere it's used as a plain mid-texture.

## Maps and gameplay
- `GuardAlly` has no DoomEdNum. MAP04 uses `DownedGuard` with arg1 = 1 (a rifle ally once revived). Give it a number if a standing ally is wanted.
- IrisTrigger arg2 only pulses the waypoint; it completes nothing (MAP04 uses a 20 s terminal for objective 1). A "reach this place" objective trigger would make that cleaner.
- Doors and lifts are silent: MAPINFO has `NoAutoSequences`, so sectors need `seq=` names in the map sources.
- Switch textures need ANIMDEFS entries (SW1x ↔ SW2x) to animate.

## Tooling and process
- Pages deploys right after the build job. `engine-tests` (cached GZDoom: smoke + walkthrough of every map) runs alongside as a check, not a gate. Gate the deploy again once iteration slows down.
- **Template repo** (`mtd-public/mstr-gme-dsgn-tmpt`): extend `plans/2026-09-30-cosmic-calamity-assault.md` with the GZDoom learnings:
  - headless GZDoom: Xvfb, `vid_activeinbackground`, and starting the map from a console chain;
  - the forge sprite pipeline;
  - the ASCII→UDMF compiler with its provability check;
  - the in-engine self-test and walkthrough;
  - palette and OGG packing;
  - the WebAssembly port.
