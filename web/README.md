# Browser build (`/play/`)

The Pages site runs the mod in the browser: GZDoom compiled to WebAssembly, in a Web Worker on an OffscreenCanvas (WebGL2, JSPI). It needs **Chrome or Edge 137+**. Other browsers, including Safari and iPad, get a "download the pk3 instead" message.

| Path | What |
|---|---|
| `web/engine/` | The engine: `gzdoom.js`, `gzdoom.wasm` and GZDoom's own `gzdoom.pk3`, `game_support.pk3`, `game_widescreen_gfx.pk3`. These are prebuilt **GZDoom g4.11.3** with tomb-engine's WebAssembly patches, vendored unmodified from [mungus43/tomb-engine](https://github.com/mungus43/tomb-engine) `demo/` at commit `6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c`, with `SHA256SUMS` and the `LICENSE` (GPLv3). |
| `site/play/` | The page: `index.html` and `play.js` (download progress, input, pointer lock, audio), `gamepad.js` (controller to keyboard/mouse bridge) and `engine.worker.js` (adapted from tomb-engine's worker; it also persists savegames in IndexedDB). |
| `tools/web-assemble.mjs` | Called by CI (`pages.yml`). It copies the engine into `_site/play/engine/`, adds `freedoom2.wad` (apt `freedoom`) and writes `manifest.json`, which holds the sizes for the progress bar and a version for cache busting. The mod is the site's own `../cosmic-calamity-assault.pk3`. It checks that every file is under 100 MB. |
| `tools/web-smoke.mjs` | Headless Chromium (Playwright, SwiftShader). It checks that the game boots, shows the title, and that a new game reaches MAP01. It also checks keyboard input and a synthetic gamepad, and that a save survives a reload and loads. Screenshots go to `shots/web/`. |
| `tools/web-pad-test.mjs` | Unit test: every pad input must map to the keys that `KEYCONF`'s `cca_kbmlayout` binds. |

Local run: `node tools/build.mjs && node tools/web-smoke.mjs`. To play it locally, serve `.gz/web-site/` with any static server and open `/play/` (add `?dev=1` for the log and FPS).

**The ZScript must compile on GZDoom 4.11.** That is why `mod/zscript.zs` says `version "4.11"`. Newer API, such as `FindStateByString` (4.12), breaks the browser build. `tools/gz-smoke.sh` checks native 4.14. `web-smoke` checks 4.11.

**At assembly time,** `web-assemble` blanks the engine's porting debug traces in `gzdoom.wasm` (`[trace] ...`). They are format strings that GZDoom would print on screen; each one's first two bytes become `"\n\0"`. Only bytes change, and the vendored file stays pristine.

**Updating the engine:** copy the five files from a newer tomb-engine `demo/`, then regenerate `SHA256SUMS` (`sha256sum gzdoom.js gzdoom.wasm *.pk3 > SHA256SUMS`) and rerun `web-smoke`.

**License:** GZDoom and the tomb-engine port are GPLv3 (`engine/LICENSE` is served next to the engine files). Source:
- [GZDoom g4.11.3](https://github.com/ZDoom/gzdoom/tree/g4.11.3)
- the port's build scripts and patch list: [tomb-engine](https://github.com/mungus43/tomb-engine), see `PATCH_INVENTORY.md`

The patched engine tree itself is not published in tomb-engine's repository (it says the tree lives in a separate fork). Freedoom is BSD-licensed (`play/FREEDOOM-LICENSE.txt`).
