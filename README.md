# COSMIC CALAMITY: ASSAULT

A **Halo 1/2-style first-person shooter prototype** set in the universe of [Metal Snake: Cosmic Calamity](https://github.com/mtd-public/cosmic-calamity).

Six months after Snake broke the Lullaby Array, the Vyrr have dropped the truce and are landing on Earth's cities. You are **ANVIL** of the **Earth Cyborg Squad**, sent on direct operations with IRIS-2 in your head.

- **3 missions:** a downed Vyrr carrier in Tacoma, an alien warehouse in Rotterdam, and the Verdon Gorge.
- **2 tablet test maps:** a weapons/movement range with enemy spawn pads, and an endless Firefight.
- **8 weapons:** 4 human, 4 Vyrr, each a real assembly with a magazine, slide or bolt, pump, sights and vents that the animations move.
- **4 enemy types:** Skitter, Trooper, Bulwark, Drone. Every one is a jointed skeleton: limbs are continuous bone chains, feet plant through leg IK, hands hold guns through arm IK. The ground Vyrr are humanoid fighter-pilots: quilted flight suits with harnesses and life-support packs, plate armour, and a hard-shell helmet with a lowered dark visor (the eyes glow through it) over a snouted breathing mask with cheek filter canisters and a hose to the chest pack, so they can breathe Earth's air.
- **2 vehicles:** the **M12 MULE** (a Warthog-shaped jeep with a driver seat and a rear rotary-chaingun turret; it steers toward where you look) and the **Vyrr SLIVER** (an anti-grav bike with twin plasma cannons and a boost). Vyrr riders patrol the gorge; kill the rider and the bike is yours. Third-person chase camera, splatters, vehicle damage and wrecks.
- **First-person arms:** shoulders-to-fingertips, driven by IK onto the gun's grip and foregrip, so every action is animated: magazine reloads (pull, drop, seat, rack the charging handle), shell-by-shell shotgun loading, pistol slide cycling, melee swings, grenade draw-and-throw with the grenade in hand, plasma vent flaps, walk bob, jumps and landings. Look down and you see your own legs.
- **Halo combat:** frag + sticky plasma grenades, melee with back-smacks, a recharging shield, checkpoints, 4 difficulties.
- **Early-Xbox look:** smooth low-poly models, normal-mapped specular textures and emissive alien tech, all generated in code. Titanfall / Black Ops silhouettes (chest rigs, knee pads, jump-kit packs, visor helmets) at original-Xbox polygon counts; the player wears a charcoal tactical suit with dark composite plates. Guns and vehicles use rounded cross-sections and curved profiles rather than boxes. There are no image, model or audio files.
- **Dressed levels:** rubble and rebar, wrecks, sandbags, drums, pallets, forklifts, cables, pipes, chains, Vyrr bio-growth, instanced swaying grass, bushes, logs, sun shafts, birds, river mist, puddles, ambient dust, banners and signs. Pines are trunks with whorls of alpha-card branches, broadleaf trees fork into branches under leaf cards, mountains are a ridged range with snow lines, and city skylines are towers with lit windows, set-backs and rooftop masts.
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
| Vehicle: enter / exit | Hold E | Hold X | Hold ACTION |
| Vehicle: drive | W / S (it steers toward where you look) | Left stick + right stick | Stick + drag |
| MULE: swap to the turret | Tab | Y | SWAP |
| SLIVER: boost | Hold C | L3 | CROUCH |

- **Menus with the controller:** D-pad or stick to move, A to select, B to go back.
- **Settings** has:
  - separate mouse, touch and controller sensitivity
  - invert look, aim assist, southpaw
  - a Halo 3-style "Recon" button layout (RB reload)
  - rumble, volumes, graphics quality

## Checks
```sh
node tools/check-levels.mjs     # every objective / pickup / enemy reachable; each map's sim runs 10 s
node tools/sim-check.mjs        # 49 headless mechanics checks (movement, weapons, AI, vehicles) + every mission's objective chain completes
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
| `js/render.js` | three.js view: sky + sun, triplanar terrain, merged static meshes, living dressing (grass, flags, birds, mist, puddles), vehicles, the third-person chase camera, water, waterfall |
| `js/models.js` | Procedural static models: geometry builder (chamfers, extrusions, world UVs), every collider "look", the prop catalog, the wreck hull, dropship, spire |
| `js/rig.js` | Rig toolkit: connected bones (joint spheres + tapered shafts), analytic two-bone IK, hands with curling fingers, keyframe helpers |
| `js/rigs.js` | Character rigs on the toolkit: the player's arms and body, the Vyrr (generic biped builder + per-type animation: gait, aim, flee, melee, death, riding) |
| `js/gunmodels.js` | The 8 weapons + the turret chaingun as assemblies with named animatable parts and hand attach nodes; pickups |
| `js/viewmodel.js` | First-person arms + gun: sway, bob, kick, and the action clips (reloads, shells, melee, throw, vent), brass ejection, muzzle flash |
| `js/vehicles.js`, `js/vehiclemodels.js` | Vehicle data (MULE, SLIVER, mounted guns) and their models |
| `js/textures.js` | Procedural diffuse / normal / emissive textures and sprites |
| `js/fx.js` | Instanced billboard particles (2 draw calls), decals, pooled lights |
| `js/hud.js` | Halo-style canvas HUD: shield, ammo, motion tracker, reticles, nav points, damage arcs, scope |
| `js/input.js` | Keyboard/mouse (pointer lock), touch stick + look + buttons, gamepad (curve, turn ramp, rumble) |
| `js/pad.js` | Controller presets, button names per family, D-pad menu navigation |
| `js/audio.js` | FPS sound set + monk-choir / percussion score on the template synth |
| `tools/` | Level validator, headless sim check, smoke test, tap-spam |

## Vehicles
- **Enter:** walk up to a seat and hold ACTION. Approach a MULE from behind for the turret. Hold ACTION again to get out.
- **MULE:** throttle with W/S (or the left stick); the nose chases where you look, Halo-style. Tab / Y / SWAP hops between the wheel and the turret. The turret is a hitscan rotary chaingun with a wide reticle. It climbs slopes a jeep would and splatters anything it hits at speed.
- **SLIVER:** FIRE shoots twin plasma bolts along your aim (up to 25° off the nose). Hold crouch for a boost that drains and refills. It drifts wide in the turns.
- **Vyrr riders** strafe past you, orbit and break off; the rider is a normal Trooper you can shoot off the bike. A bike whose rider is killed coasts to a stop and can be taken.
- Vehicles take damage from bolts, bullets and explosions; at 0 they blow up, throw you clear (at a cost) and stay as a smoking wreck.

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
`.github/workflows/pages.yml` runs the level and sim checks on every push. It publishes to GitHub Pages only from `main`: https://mtd-public.github.io/cosmic-calamity-assault/ On a new repo, set **Settings → Pages → Source: GitHub Actions** if it isn't enabled automatically.
