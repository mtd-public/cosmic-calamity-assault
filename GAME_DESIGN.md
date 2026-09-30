# Cosmic Calamity: Assault — Case File 51 (GZDoom mod) — Game Design Document

> *DOOM II* with pre-rendered custom characters and modern weapon handling, played in **GZDoom**, the engine *Selaco* is built on. The tone is 1990s paranoid-conspiracy TV (a sardonic believer FBI agent, an AI in his ear, men in grey suits who knew all along) colliding with a full hostile alien invasion.

**Touchstones:**
- *The X-Files*: tone and protagonist archetype.
- *Half-Life*: Black Mesa-style labs with scientists and security.
- *Duke Nukem 3D*: a seedy late-90s city.
- *Independence Day* and *Perfect Dark*: the mothership.
- *Call of Duty*: gun handling, aim-down-sights, dual wield, grenade cooking.
- *Predator*: the alien detonator.
- *Jumping Flash!*: the little avatar on the HUD.

This branch (`doomlike`) replaces the custom three.js engine. That engine's final state is saved on the branch `final-halo-like` and snapshotted in `mstr-gme-dsgn-tmpt/reference/cosmic-calamity-assault`.

Built from: GZDoom 4.14 (ZScript, UDMF), the `mstr-gme-dsgn-tmpt` house rules (design doc first, a TUNING table with reasons, procedural assets, headless verification), and the three.js model and rig toolkit from `final-halo-like`. That toolkit now runs offline to pre-render sprites (see §8).

## 1. Story
- **1997.** Special Agent **Eli Marsh** of the FBI's Unexplained Phenomena Unit has spent six years in a basement office proving that the government made a deal with visitors from elsewhere. He was right about the deal. He was wrong about the visitors keeping it.
- **Cast:**
  - **Eli Marsh** (player): a believer, sardonic, stubborn. Charcoal suit, loosened tie, a long dark trench coat, a 9 mm service pistol and a heavy steel flashlight.
  - **IRIS** (the AI helper): a prototype intelligence grown at S-4 from recovered alien hardware, now living in Marsh's wrist unit. She *is* the HUD. She draws waypoints to the objective, explains the plot as it happens, and drops hints when a secret is near. Her little avatar sits in the HUD corner and reacts: it talks, glances toward threats and glitches when Marsh is hurt. It is Jumping Flash's portrait idea, not cute: a green CRT wireframe face behind scanlines, dry and slightly unsettling.
  - **Dr. Nora Kade** (radio, MAP02 on): Marsh's partner, an FBI forensic pathologist and a skeptic. She argues with IRIS and with the evidence.
  - **The Custodian** (antagonist): a quiet man in a grey suit with a lighter he never uses. He sits on the Committee that brokered the deal. He appears in radio intercepts and intermission texts.
  - **The Greys:** the government codename is **EBE** (extraterrestrial biological entity). Their telepathic hum can "drown" a human mind, which is how the base guards turned.
- **Missions** (one episode, *Case File 51*):
  1. **Groom Lake** (MAP01): Marsh is being held in an interrogation room under Area 51 when the containment wing breaks open.
     - To leave, he must retrieve two things: the **dossier** (the Committee's file on the deal) and the **HDD cache** (the alien experiment data, and IRIS's home).
     - Scientists and lab personnel flee and cower. Downed security guards lie in the corridors, some dead, some dying and still talking.
  2. **Night of the Harvest** (MAP02): Washington, D.C., during the invasion. He reaches Bureau HQ through the burning streets, the plaza and the subway. His case file holds the coordinates of the ship the Air Force shot down.
  3. **Crash Site** (MAP03): the Army cordon around the downed saucer has been overrun. He takes the navigational shard from inside the wreck, which is the key to the ship that launched it.
  4. **Mothership** (MAP04): abduction bays, organic corridors and the **Hive Mind**. Kill it and the hum stops.

## 2. Pillars
1. **Doom's speed, modded-weapon feel.** Fast movement, big rooms, circle-strafing. Every weapon has real reload, pump and slide animations, the way high-effort Doom mods do them.
2. **Custom characters that read at a glance.** Each alien has one silhouette, one colour cue and one sound. Their sprites are pre-rendered from 3D models in 8 rotations, like Doom's clay models and *Blood*'s renders.
3. **The flashlight.** The game is darker than Doom. Marsh's flashlight (F) is a real GZDoom spotlight, and the Maglite (slot 1) is a club that is also a light.
4. **Conspiracy flavour, invasion scale.** Files, intercepts and a skeptic on the radio for tone; beams over the city and a mothership for scale.
5. **Everything generated, everything verified.** Sprites, textures, sounds and music are built by code in `tools/`. Maps are compiled from text. Headless GZDoom proves the mod loads and every map runs.

## 3. Core loop
```
 enter area → radio line / sight sound → fight (strafe, pick the weapon for the enemy)
   → loot (ammo, armour, keycards) → door / lift / switch opens the next area → exit switch
 death → reload the last save (GZDoom autosaves at each map start; quicksave anywhere)
```

## 4. Controls (full Xbox controller support; keyboard + mouse; every menu works with the pad)
| Verb | Xbox controller | Keyboard + mouse |
|---|---|---|
| Move / look (free vertical and horizontal aim, no autoaim) | Left / right stick | WASD / mouse |
| Fire (right-hand gun) | RT | Left click |
| Aim down sights; with two guns, fire the left gun | LT | Right click |
| Jump | A | Space |
| Crouch; **hold in the air to dolphin-dive** | B | C / Ctrl |
| Reload + use (doors, switches, NPCs) | X | R / E |
| Next weapon (tap) / previous weapon | Y / D-pad left | wheel, 1-7 |
| Grenade: hold to cook, release to throw | LB | G |
| Melee (quick knife or alien blade) | RB | Q |
| Run | L3 | Shift |
| Dual wield toggle (with two of the gun) | R3 | V |
| Flashlight | D-pad up | F |
| Grenade type (frag / alien detonator) | D-pad right | T |
| IRIS: repeat the objective and waypoint | D-pad down | H |
| Map / menu | View / Menu | Tab / Esc |

- The bindings ship as defaults (`KEYCONF` `defaultbind`).
- **Options → Controller Layout** shows this table in the game and has an "Apply Xbox layout" command that rebinds everything.
- GZDoom's own menus work with the D-pad and A/B.
- Stick sensitivity and inversion live in GZDoom's controller options, which the layout page links to.

## 5. Numbers (`mod/zscript/*.zs`, each with its reason in a comment)
Damage uses Doom's `N*random(a,b)` form so balance can be compared directly with the original monster.

### 5.1 Weapons: Call of Duty handling on Doom's arsenal
**Handling:**
- **Hip:** the gun is held one-handed, low and to the **right** of the screen. At night the left hand holds the flashlight.
- **ADS (LT / right click):** the gun comes to the centre in a two-hand grip with the sights on the reticle. The view zooms ×1.35 (×2.3 on the battle rifle), spread tightens, and move speed drops to 60%.
- **Dual wield:** pick up a second copy of a gun, then toggle (R3 / V). The left gun is the right one mirrored. RT fires right and LT fires left; each has its own magazine and reload. This works on every gun, **shotguns included** (one-hand pump flick).
- **Reticle:** drawn by the HUD, shaped per weapon. It opens with spread and movement, turns red over a hostile, hides in ADS, and becomes two small carets when dual wielding.
- **Aim:** true pitch and yaw; shots go exactly where the reticle is (no Doom autoaim).

**Arsenal:**
| Slot | Human | Alien | Doom analog | Why |
|---|---|---|---|---|
| 1 | Combat knife (fast slash, lunge) | Harvester blade (bone and energy, a heavy two-hit combo) | Fist / chainsaw | Melee is also on RB from any weapon |
| 2 | 9 mm pistol (15-round magazine) | Stinger (alien pistol, charged shot) | Pistol | Accurate; dual 9 mm is the classic |
| 3 | Pump shotgun (7 shells) | Scatter (alien shotgun, plasma pellets that stagger) | Shotgun / SSG | Close quarters; dual shotguns for the power fantasy |
| 4 | SMG (32-round magazine) | Plasma SMG (heat instead of a magazine) | Chaingun | Spray |
| 5 | Assault rifle (30 rounds, full auto) | — | Chaingun+ | All-rounder |
| 6 | Battle rifle (20 rounds, **3-round burst**, marksman scope) | — | — | Precise mid/long range |
| 7 | — | The Singularity (alien superweapon, MAP04) | BFG9000 | The finale |

**Ammo:**
- **Human guns** use real calibres: 9 mm (pistol, SMG), 12 gauge (shotgun), 5.56 (assault rifle), 7.62 (battle rifle).
- **All alien weapons** share one universal ammo, **Alien Energy** (cells from dead Hybrids, energy pods).
- Doors, switches, keycards, health (stim, medkit, implant) and armour (Kevlar, tactical) work as in Doom.

**Grenades:**
- **Frag:** hold to cook on a 4 s fuse; it explodes in your hand at 0.
- **Alien detonator:** Predator-style. It sticks to whatever it hits, counts down in glowing red glyphs for 3 s, and has a bigger blast.

Damage uses Doom's `N*random(a,b)` form so balance can be compared with the original weapon:
| Weapon | Damage | Rate | Magazine / ammo |
|---|---|---|---|
| Knife / blade | 3×random(4,10) / 5×random(4,10) | 12 / 20 tics | — |
| 9 mm / Stinger | 5×random(2,3) / 6×random(2,4), charge ×3 | 7 / 10 tics | 15 / cell 1 |
| Pump / Scatter | 8 × 5×random(1,3) / 10 × 4×random(1,3) + stagger | 28 / 24 tics | 7 shells / cell 4 |
| SMG / Plasma SMG | 4×random(1,3) / 5×random(1,3) | 3 / 3 tics | 32 / heat |
| Assault rifle | 5×random(2,3) | 4 tics | 30 |
| Battle rifle | 3 × 6×random(2,4), burst 2 tics apart | 16 tics per burst | 20 |
| Frag / detonator | 128 / 200 splash | — | carry 4 / 3 |

### 5.2 Enemies
| Enemy | Doom analog | HP | Speed | Attack | Telegraph (what you see/hear) | Counter |
|---|---|---|---|---|---|---|
| **Thrall** (possessed guard, pistol) | Zombieman | 20 | 8 | hitscan 3×random(1,5) | black-oil eyes, a wet gurgle | pistol |
| **Thrall Trooper** (possessed soldier, shotgun) | Shotgun guy | 30 | 8 | 3 pellets × 3×random(1,5) | the rack of a shotgun | shotgun; take its shells |
| **Grey** (EBE) | Imp | 60 | 8 | psychic bolt 3×random(1,8), claw 3×random(1,8) | eyes flare white, click-chatter | anything; dodge the slow bolts |
| **Hybrid** (human-alien soldier) | Chaingunner | 70 | 8 | 3-bolt plasma bursts, 3×random(1,5) each | pale face, black eyes, a rising carbine whine | shotgun up close; drops a carbine |
| **Stalker** (clawed hunter) | Demon | 150 | 12 | claw 4×random(1,10) | low snarl, a fast lope | shotgun at the doorway; M79 in the open |
| **Probe** (floating drone) | Cacodemon | 200 | 8, flies | pulse ball 5×random(1,8) | a humming sweep light | SMG or pulse carbine |
| **Overseer** (Grey elder) | Arch-vile | 700 | 15 | psychic lance (Doom's vile attack); raises dead aliens | the cranium glows; a rising choir | break line of sight; kill it first |
| **Hive Mind** (boss, MAP04) | Icon of Sin + Spider Mastermind | 4000 | stationary | beam salvos, spawns Greys and Probes | a pulsing core, a roar before spawns | four conduits expose the core; Singularity |

### 5.3 Terminal hacks (defend the point)
- **Start:** use a hackable terminal (X / E). IRIS starts a download or upload, and a **gauge** appears on the HUD (percent plus time left).
- **Duration:** 60-90 s, set per terminal (`args[0]` = seconds).
- **Waves:** they spawn from the terminal's spawn spots (actors `CCAWaveSpot` with a matching group number). Every 12-15 s the next wave comes, and the waves escalate.
- **Leaving the area:** progress **pauses** while Marsh is more than 8 m (256 units) from the terminal, and IRIS nags.
- **Finish:** the terminal runs its line special (opens the exit, lowers a shield) and gives the objective item.
- **Uses:**
  - MAP01: download the HDD cache, 75 s (IRIS wakes up properly afterwards).
  - MAP02: upload the case file from the Bureau basement, 60 s.
  - MAP04: upload the virus to the mothership's core, 90 s. This is the *Independence Day* moment: IRIS: "*It's a Mac joke, Marsh. You wouldn't get it.*" The Hive Mind's shield drops when the upload finishes.

**Non-hostile NPCs** (MAP01 mostly; aliens can kill them):
| NPC | Behaviour |
|---|---|
| Scientist (lab coat) | flees from aliens, cowers when cornered, a line when used ("*They were never supposed to wake up!*") |
| Lab tech (scrubs) | same, a different look |
| Downed guard (wounded) | sits against the wall, calling for help. **Revive** him by holding use (X / E) for 3 s, with a gauge on the HUD; being hit cancels it. He stands up as a **Guard ally** (Half-Life's security guard): a +FRIENDLY fighter with a pistol or rifle who follows Marsh and shoots aliens. Some carry an item they hand over when revived (the blue card). A guard left alone for too long in a fight dies |
| Guard ally (revived) | 60 HP, 9 mm hitscan 3×random(1,5), follows within ~5 m, takes cover behind the player's line of fire, and calls out ("*Behind you!*") through IRIS subtitles |
| Dead guard / dead scientist | set dressing, with a blood pool |

Difficulty follows Doom's skills (ITYTD to Nightmare), via MAPINFO `skill` defaults.

### 5.4 Player
| Parameter | Value | Why |
|---|---|---|
| Health / max from Implant | 100 / 200 | Doom's |
| Armour | Kevlar Vest 100 (1/3 absorb), Tactical Armour 200 (1/2 absorb) | green and blue armour |
| Flashlight | spotlight, radius 640, inner 12°, outer 28°, warm white | lights a corridor, not a room |
| View height / jump | 41 / 8 | Doom defaults; jumping is optional |
| **Dolphin dive** | hold crouch while airborne and moving: +9 forward impulse, prone view height 16, 0.5 s slide on landing, then stand | Max Payne / Black Ops dive; you can fire, aim and reload throughout |

## 6. HUD (IRIS)
A ZScript `BaseStatusBar` (`CCAStatusBar`), drawn as IRIS's overlay: thin green-and-amber CRT lines, typewriter labels.
- **Top left:** the IRIS avatar portrait (animated frames: idle, talk, look left/right, alarm, glitch) plus her subtitle line.
- **Bottom left:** health, armour, flashlight battery and grenades (type + count).
- **Bottom right:** magazine / reserve for the right gun, and the left gun's when dual wielding. It shows heat for plasma weapons, then keys.
- **Centre:** the per-weapon reticle (§5.1) and a hit marker.
- **World:** a waypoint diamond projected onto the current objective with a distance in metres. It clamps to the screen edge when the objective is off-screen.
- **Objectives:** the current objective sits under the IRIS portrait, and completed ones tick off with a strike-through. The full list (current plus completed, with ✓) shows on the automap and in the pause overlay (Back / Tab).
- **Map:** GZDoom's automap (View / Tab) in a textured overlay style, with 3D-floor levels drawn. Objectives and the waypoint are marked on it.
- **Saving:** quicksave F6 / quickload F9 (GZDoom). On the controller, Menu → Save/Load. It **autosaves** at each map start and after each objective completes.
- **Secrets:** when the player comes within 6 m of an undiscovered secret, IRIS pings: "*Wall's hollow here, Marsh.*" (at most once per secret).

## 7. Art direction
- **Palette:** night blues and sodium orange for the human maps; bruised violet, bone and bioluminescent teal for the alien ones. Aliens bleed luminous green; Thralls bleed black oil.
- **Marsh:** in first person, dark wool trench-coat sleeves over charcoal suit cuffs, white shirt cuffs and a wristwatch. The pistol is held in a two-handed grip with the flashlight crossed underneath (the "Harries" hold) whenever the flashlight is on.
- **Greys:** 1.2 m tall, grey-blue skin, huge head, black almond eyes, three long fingers, a thin neck and a pot belly. They move with a jittery gait.
- **Hybrids:** human proportions, hairless and pale, black sclera, black BDUs with webbing, and an alien carbine (a curved bone-and-chrome body with a teal cell).
- **Thralls:** Area 51 security in tan desert BDUs and black berets, or soldiers in woodland BDUs and helmets. Their eyes are black and oil veins show on their faces.
- **Stalker:** a long-limbed grey-green hunter that runs half-crouched, with a ridged skull and blade claws.
- **Probe:** a 1 m chrome-and-bone sphere with a single lens and three trailing antennae. It casts a sweeping light.
- **Overseer:** a 2.4 m Grey elder in a ribbed carapace mantle, floating a hand's breadth above the floor. Its cranium glows when it attacks.
- **Hive Mind:** a brain-coral mass in a ribbed cradle, fed by four glowing conduits, with teal veins pulsing.
- **NPCs:** scientists in white lab coats, ties and glasses (Half-Life); lab techs in scrubs; Area 51 security in tan BDUs. Downed security lie against walls, some wounded and talking, some dead.
- **Levels:**
  - **Area 51** is Black Mesa gone wrong: beige and white lab panels, observation windows (many smashed), experiment rooms (specimen tanks, a dissection theatre, a containment cell, a lab rebuilding a saucer's drive), red emergency lights and blast doors. Alien technology has grown into parts of the lab (violet hull plates, teal conduits). Curtains blow in and out of broken windows, and fires burn at random.
  - **D.C. at night** is seedy and late-90s, like Duke Nukem 3D: neon bars, a pawn shop, a liquor store, an adult cinema marquee (implied, PG-13), a sleazy motel, an arcade, graffiti alleys and a subway, with beams from the ships overhead and burning cars.
  - **The crash site** is night forest and floodlights around a violet hull.
  - **The mothership** has *Independence Day* scale (a vast ribbed organic-mechanical interior, hangar racks of attack craft, the central chamber) and *Perfect Dark* sleekness (dark alien panels with cyan light strips, alien consoles).

## 8. Tech
- **Engine:** GZDoom 4.14 (or UZDoom, its 2025 community fork). Both run the same ZScript and UDMF. The mod is one `.pk3` (a zip of `mod/`).
- **Base IWAD:** **Freedoom: Phase 2** (BSD licence, free, used in CI) or *DOOM II*. The pk3 brings every monster, weapon, texture and sound its maps use. It borrows only menus, fonts and door and switch sounds from the IWAD. A standalone IPK3 (no IWAD, as *Selaco* ships) is a later milestone.
- **Maps:** UDMF (`TEXTMAP`), compiled from text by `tools/mapc.mjs`. Multi-storey areas use `Sector_Set3DFloor` from auto-generated control sectors. Rooms are drawn as ASCII on a 32-unit grid, with a legend of sector types (heights, textures, light, specials). The compiler emits one sector per connected region, merges collinear walls, assigns door, lift and lock specials, and places things. It **refuses** a map whose exit, keys or monsters can't be reached from the start. Nodes are built by `zdbsp` at build time. The output is ordinary UDMF, so a human can open it in Ultimate Doom Builder.
- **Sprites:** `tools/forge/` loads the three.js r160 kit (rig toolkit with bones and two-bone IK, chamfer/extrude/lathe geometry builder, procedural textures) in headless Chromium.
  - It poses each character for every frame, renders **8 rotations** with a camera-fixed key light, and writes PNGs with Doom `grAb` offsets.
  - Monsters render at 2× resolution and use `Scale 0.5`. HUD weapons render at 3× and are declared in `TEXTURES` with `XScale/YScale 3`.
- **Textures, sounds, music:**
  - Textures are painted procedurally in the same page.
  - Sounds are synthesised offline into WAV (`tools/sfx.mjs`).
  - Music is generated as MIDI, with original motifs (`tools/music.mjs`).
- **Verification:** see §11.

## 9. Levels
Map sources are in `maps-src/*.txt`. A cell is 32×32 map units. The player is 32 wide and 56 tall, so corridors are at least 3 cells (96 units) and doors 2-4 cells.

| # | Map | Space | Set pieces | Keys |
|---|---|---|---|---|
| MAP01 | Groom Lake (Area 51, S-4) | interrogation room → detention block → security office (blue card) → lab corridor with smashed observation windows → experiment rooms (specimen tanks, dissection theatre, containment cell) → records office (**dossier**) → alien-tech lab where the hull has grown into the walls (**HDD cache**, red card) → hangar with the back-engineered saucer → surface lift (exit opens only with the dossier and HDD) | lights die at the start, and the flashlight is the first lesson; scientists run past screaming; a dying guard hands over the blue card; the containment wing opens behind you; a Stalker in the hangar | blue card, red card; objectives: dossier + HDD cache |
| MAP02 | Night of the Harvest (Washington, D.C.) | neon strip (bar, pawn shop, adult cinema marquee, motel) → back alleys → the plaza under the beams (a full-level version of the Firefight arena) → subway station and tunnel → Bureau HQ lobby → the basement office → rooftop | the plaza holdout; the first Overseer in the subway; the case file in the basement | blue card (subway), yellow card (HQ lobby) |
| MAP03 | Crash Site | overrun Army cordon (tents, floodlights, trucks) → forest ridge → impact trench → inside the saucer | the wreck's interior is the first alien architecture; the Singularity is in its cockpit | red card (command tent), blue glyph (wreck) |
| MAP04 | Mothership | docking bay with racks of attack craft (ID4) → abduction bays with pods → sleek cyan-lit corridors and consoles (Perfect Dark) → gravity lift → conduit ring → Hive Mind chamber | four conduits drop the Hive Mind's shield; the ship shakes after the kill | yellow glyph, red glyph |

**Geometry goals** (what the map compiler must support, §8):
- multi-storey spaces via GZDoom **3D floors**: bridges over drops, catwalks, balconies and room-over-room
- windows (sills + lintels with glass or broken-glass mid-textures)
- stairs, lifts, doors (plain, locked, blast)
- pits and hazard floors (goo)
- secret doors
- sky openings
- height variety everywhere

The episode ends with intermission text (MAPINFO clusters). There are field-journal texts between maps.

## 10. Audio
- **Weapons:** layered synth transients with a noise body: the pistol crack, the shotgun boom and pump, the SMG rattle, the M79 thunk, the pulse carbine's rising chirp, the Singularity's charge swell.
- **Monsters:** Greys click and chatter (FM); Thralls gurgle wetly; Hybrids breathe through filters; Stalkers snarl in low noise; Probes hum with a Doppler whine; the Overseer's choir rises.
- **Music:** generated MIDI in the minor key with a whistled-synth lead over analog pads (original motifs). The tension tracks are slow; the combat tracks add a drum machine.

## 11. Build and verification
| Tool | What it proves |
|---|---|
| `node tools/mapc.mjs` | Every map compiles. Exit, keys and every monster are reachable from the start, considering doors, locks (keys picked up before their doors), lifts and step heights (≤ 24). No unclosed sectors. Every texture and thing type exists in the mod. |
| `node tools/build.mjs` | Builds the maps (zdbsp nodes), checks every sprite frame and texture referenced by the ZScript/MAPINFO/maps exists in `mod/`, and zips `dist/cosmic-calamity-assault.pk3`. |
| `tools/gz-smoke.sh` | Runs real GZDoom under Xvfb with Freedoom 2. It fails on any ZScript, MAPINFO, sprite or texture error in the log. It loads each map, runs the in-mod self-test (`cca_selftest`: spawns every monster, gives and fires every weapon, reports PASS/FAIL), and takes a screenshot per map. |
| CI (`.github/workflows/pages.yml`) | Runs the map compiler and build on every push. It publishes the landing page (`site/`) and the `.pk3` to GitHub Pages **only from `main`**. |

## 12. Repo layout
```
mod/            the pk3 source tree (MAPINFO, LANGUAGE, SNDINFO, KEYCONF, TEXTURES, ANIMDEFS, GLDEFS, zscript/, sprites/, textures/, flats/, sounds/, music/, graphics/)
maps-src/       ASCII map sources + legends
tools/          mapc (maps), forge (sprites and textures via headless three.js), sfx, music, build, gz-smoke
site/           the GitHub Pages landing page (download, screenshots, how to play)
docs/ASSETS.md  the asset contract: every sprite, texture, sound and editor number the code expects
```

## 13. Open questions (defaults chosen)
- **Doom or Quake?** GZDoom:
  - ZScript is a real language.
  - UDMF maps can be written by tools and opened in Ultimate Doom Builder.
  - Sprites let the existing three.js models be reused through pre-rendering.
  - It is *Selaco*'s engine.
  - A Quake mod would need QuakeC, BSP compiling and MDL models for every character.
- **Playable in a browser?** No. GZDoom has no web build, so Pages hosts the download, screenshots and instructions. The previous three.js game stays playable there under `/halo-like/`, built from `final-halo-like`.
- **IWAD?** Freedoom 2 by default; *DOOM II* also works. Standalone later.
- **Name and likeness:** Marsh, Kade and the Custodian are original characters. No show names, likenesses, logos or theme music are used; the influence is the era and the tone.
- **Models instead of sprites (MD3/IQM)?** Not for v1. Pre-rendered sprites are the Doom look, and they cost nothing at runtime.

## 14. Lineage
- **`final-halo-like` (this repo):** the rig toolkit (`rig.js`, connected bones, analytic two-bone IK, fingers), the geometry builder (`models.js`: chamfers, extrusions, lathes), `gunmodels.js` assemblies with animatable parts, procedural texture painters (`textures.js`) and the synth (`sfx-synth.js`). All of these now run offline in `tools/forge` and `tools/sfx.mjs`.
- **`mstr-gme-dsgn-tmpt`:** house rules (design doc first, reasons next to numbers, generated assets, headless verification before every push, deploy only from `main`); the ASCII level builder with a provability check (labyrinth-larry); three.js r160 vendor.

---

## Delta log
### doomlike (branch `doomlike`, from `main` @ 43538cd)
- Pivot from the custom three.js engine to a GZDoom mod. The Halo-like game is preserved on `final-halo-like`.
