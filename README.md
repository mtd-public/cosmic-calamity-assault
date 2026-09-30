# COSMIC CALAMITY: ASSAULT — Case File 51

A **GZDoom mod**: 1997, an FBI agent who was right all along, his AI **IRIS**, and a hostile alien invasion. It has pre-rendered custom characters, Call of Duty-style gun handling, and four maps: Area 51 under siege, a seedy late-90s Washington, a crash site, and the mothership.

- **Play:** download the `.pk3` from the [GitHub Pages site](https://mtd-public.github.io/cosmic-calamity-assault/). It runs in **GZDoom 4.14** or **UZDoom**, with **Freedoom: Phase 2** (free) or **DOOM II**.
- **Design:** [GAME_DESIGN.md](GAME_DESIGN.md). **Asset contract:** [docs/ASSETS.md](docs/ASSETS.md).
- **The previous direction:** a three.js Halo 1/2-style FPS. It is preserved on the branch [`final-halo-like`](https://github.com/mtd-public/cosmic-calamity-assault/tree/final-halo-like) and still playable in the browser at `/halo-like/` on the Pages site.

## Play
```sh
gzdoom -iwad freedoom2.wad -file cosmic-calamity-assault.pk3
```
On first run, open **Options → Controller Layout (Xbox)** (or **Keyboard & Mouse Layout**) and choose **Apply**. The full control table is in GAME_DESIGN §4.

## What's in it
- **Weapons:**
  - Hip fire is one-handed on the right; aim down sights with LT or right click.
  - Dual wield any gun you have two of, shotguns included.
  - Frag grenades you can cook, and sticky alien detonators.
  - Human: knife, 9 mm, pump shotgun, SMG, assault rifle, 3-round battle rifle.
  - Alien (one universal energy ammo): Harvester blade, Stinger, Scatter, plasma SMG, the Singularity.
- **Movement:** dolphin-dive (hold crouch in the air) and keep shooting; clamber onto ledges and sills (jump again in the air).
- **IRIS:**
  - An animated portrait on the HUD, with subtitles.
  - Waypoints to the current objective.
  - A list of current and completed objectives.
  - Hints when a secret is close.
- **People:**
  - Scientists and lab techs flee and cower.
  - Downed guards can be revived (hold use) and fight beside you.
- **Missions:** hack terminals and defend them for 60-90 s while waves arrive; objectives gate the exits; it autosaves after each objective.

## Build from source
Everything is generated. The only binary inputs are the tools themselves.
| Command | Does |
|---|---|
| `node tools/forge/run.mjs [job...]` | Renders sprites, HUD weapons, textures and props from procedural three.js models in headless Chromium (`tools/forge/jobs/*`), with Doom `grAb` offsets |
| `node tools/sfx.mjs` | Synthesises all sound effects into `mod/sounds/` and writes `SNDINFO` |
| `node tools/music.mjs` | Generates the MIDI score |
| `node tools/gfx.mjs` | Title, menu and intermission graphics, and the scope mask |
| `node tools/mapc.mjs` | Compiles `maps-src/*.txt` (ASCII on a 32-unit grid) to UDMF with zdbsp nodes. It fails if the exit, a key, an objective or a monster is unreachable |
| `node tools/build.mjs [--strict]` | Generates `TEXTURES` and `DoomEdNums`, checks the asset contract, and writes `dist/cosmic-calamity-assault.pk3` |
| `tools/gz-smoke.sh [MAP01 ...]` | Runs real GZDoom headless (Xvfb). For each map it runs the in-mod self-test, takes screenshots, and fails on any script or actor error |
| `node tools/contact.mjs out.png "title" sprites/monsters ...` | Contact sheets for art review |

The **headless GZDoom** setup:
- GZDoom 4.14.2 built from source (`cmake -S gzdoom -B build -G Ninja`, with ZMusic).
- Freedoom 2 from apt.
- `vid_activeinbackground=true` and `vid_fullscreen=false` in the ini.
- The map must be started from a console chain *after* startup: `+"wait 40; map MAP01; ..."`. Using `+map` on the command line renders black.

## Layout
```
mod/            the pk3 source tree: zscript/cca (gameplay), MAPINFO, LANGUAGE, KEYCONF, MENUDEF, LOCKDEFS,
                SNDINFO, sprites/, graphics/, textures/, flats/, sounds/, music/, maps/
maps-src/       map sources (the DSL is documented at the top of tools/mapc.mjs)
tools/          forge (sprites/textures), mapc (maps), sfx, music, gfx, build, gz-smoke, contact sheets
site/           the GitHub Pages landing page
```

## Deploy
`.github/workflows/pages.yml` compiles and validates the maps and builds the pk3 on every push. It publishes the site, the `.pk3` and the old Halo-like prototype to GitHub Pages **only from `main`**.
