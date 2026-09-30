# COSMIC CALAMITY: ASSAULT

A **Halo 1/2-style first-person shooter prototype** set in the universe of [Metal Snake: Cosmic Calamity](https://github.com/mtd-public/cosmic-calamity).

Six months after Snake broke the Lullaby Array, the Vyrr have dropped the truce and are landing on Earth's cities. You are **ANVIL** of the **Earth Cyborg Squad**, sent on direct operations with IRIS-2 in your head.

- **3 missions:** a downed Vyrr carrier in Tacoma, an alien warehouse in Rotterdam, and the Verdon Gorge.
- **2 tablet test maps:** a weapons/movement range with enemy spawn pads, and an endless Firefight.
- **8 weapons:** 4 human, 4 Vyrr.
- **4 enemy types:** Skitter, Trooper, Bulwark, Drone.
- **Halo combat:** frag + sticky plasma grenades, melee with back-smacks, a recharging shield, checkpoints, 4 difficulties.
- **Early-Xbox look:** smooth low-poly models, normal-mapped specular textures and emissive alien tech, all generated in code. There are no image, model or audio files.
- **Plays with** keyboard + mouse, **touch (tablet)** and **Xbox controller**, in menus and in game.

Design doc: [GAME_DESIGN.md](GAME_DESIGN.md).

## Run
There is no build step. Serve the folder:
```sh
python3 -m http.server 4180     # open http://localhost:4180/
```

URL flags:
- `?level=fallen-hymn|cold-storage|gorge|proving|plaza` jumps straight into a map.
- `&diff=easy|normal|heroic|legendary` sets the difficulty.
- `?quality=low|med|high` overrides the graphics preset.

## Controls
| Action | Keyboard + mouse | Xbox controller | Touch |
|---|---|---|---|
| Move / look | WASD / mouse | Left / right stick | Left-side floating stick / drag on the right |
| Fire | Left click | RT | FIRE (drag on it to aim while firing) |
| Grenade (type) | G (T) | LT (LB) | NADE (G-TYPE) |
| Jump / crouch | Space / C | A / L3 | JUMP / CROUCH |
| Melee | Q | B | MELEE |
| Reload / pick up, use | R / hold E | tap X / hold X | tap / hold ACTION |
| Switch weapon | Tab, wheel | Y | SWAP |
| Zoom | Right click | R3 | ZOOM |
| Pause | Esc | Menu | ❚❚ |

- **Menus with the controller:** D-pad or stick to move, A to select, B to go back.
- **Settings** has:
  - separate mouse, touch and controller sensitivity
  - invert look, aim assist, southpaw
  - a Halo 3-style "Recon" button layout (RB reload)
  - rumble, volumes, graphics quality

## Checks
```sh
node tools/check-levels.mjs     # every objective / pickup / enemy reachable; each map's sim runs 10 s
node tools/sim-check.mjs        # 32 headless mechanics checks + every mission's objective chain completes
python3 -m http.server 4180 &
BASE=http://localhost:4180/ CHROMIUM=/opt/pw-browsers/chromium node tools/smoke.mjs
#   desktop, iPad landscape + portrait, iPhone landscape, and an emulated Xbox pad: 0 errors, 0 scroll
CHROMIUM=/opt/pw-browsers/chromium node tools/tap-spam.mjs 'http://localhost:4180/?quality=low&level=proving' --buttons '[data-btn=fire],[data-btn=jump],[data-btn=action]' --menu '#pausebtn'
```

## Code map
| File | What |
|---|---|
| `index.html`, `css/style.css` | Shell, screens, HUD text, tablet buttons |
| `js/main.js` | Boot, screens, fixed-step loop, event → audio/HUD/rumble glue, attract mode, `window.GAME` test hooks |
| `js/sim.js` | Simulation (no DOM, no three.js): player, weapons, projectiles, grenades, enemy AI, pickups, scripting, checkpoints, Firefight |
| `js/world.js` | Collision world (heightfield + AABBs, spatial hash, DDA ray casts) and the nav grid / flow field |
| `js/levels.js` | The five maps: terrain functions, colliders with render "looks", dressing, enemy groups, objectives, dialogue |
| `js/tuning.js`, `js/weapons.js`, `js/enemies.js` | Every number, with the reason for it |
| `js/render.js` | three.js view: sky, triplanar terrain, merged static meshes, enemy rigs + animation, viewmodel, water, waterfall |
| `js/models.js` | Procedural models: geometry builder (chamfers, extrusions, world UVs), props, Vyrr rigs, weapons, arms, dropship, spire |
| `js/textures.js` | Procedural diffuse / normal / emissive textures and sprites |
| `js/fx.js` | Instanced billboard particles (2 draw calls), decals, pooled lights |
| `js/hud.js` | Halo-style canvas HUD: shield, ammo, motion tracker, reticles, nav points, damage arcs, scope |
| `js/input.js` | Keyboard/mouse (pointer lock), touch stick + look + buttons, gamepad (curve, turn ramp, rumble) |
| `js/pad.js` | Controller presets, button names per family, D-pad menu navigation |
| `js/audio.js` | FPS sound set + monk-choir / percussion score on the template synth |
| `tools/` | Level validator, headless sim check, smoke test, tap-spam |

## Lineage (what was reused)
- **`mtd-public/mstr-gme-dsgn-tmpt`:**
  - House rules: sim / render / UI split, dt clamp, fixed step, Pointer Events, auto-pause on blur, visibility and zoom, namespaced `localStorage`, deploy only from main.
  - `touch-zoom-guard/`: kit, verbatim.
  - `js/sfx-synth.js`: consolidated synth kit, verbatim.
  - `js/utils.js`, and three.js r160 + `BufferGeometryUtils` from `kits/vendor`.
  - The vanilla-three starter's floating-stick maths (`docs/04`).
- **`mtd-public/dr-mow`:**
  - `js/pad.js`: `MenuNav` (D-pad / stick menu focus, A / B), controller family names, and the gamepad polling pattern with radial dead zones.
  - `tools/smoke.mjs` pattern.
- **`mtd-public/cosmic-calamity`:**
  - The Vyrr, IRIS, Hale, Snake, Threnody and the Lullaby Array; the speaker colours and alien palette; the motion-sensor idea.
  - The `sw.js` / manifest / Pages workflow shape.

## Deploy
`.github/workflows/pages.yml` runs the level and sim checks on every push. It publishes to GitHub Pages only from `main`. On a new repo, set **Settings → Pages → Source: GitHub Actions** if it isn't enabled automatically.
