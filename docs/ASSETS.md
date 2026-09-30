# Asset contract

Every name the ZScript, MAPINFO and maps expect. Generators (`tools/forge/jobs/*`, `tools/sfx.mjs`, `tools/mapc.mjs`) must produce exactly these names; `tools/build.mjs` fails the build if one is missing. Doom limits: lump and texture names are **8 characters max, upper case**. A sprite lump is `PPPP` + frame letter + rotation digit.

## Conventions (see `tools/forge/forge.js`)
- **World scale:** 1 m = 32 map units horizontally. GZDoom stretches the world ×1.2 vertically, so forge renders sprites at 1/1.2 of their height per metre. A 1.8 m human is about 96 texels tall.
- **Actor sprites** (`mod/sprites/<group>/`):
  - Rendered at 64 texels per metre (2 per map unit); the actor uses `Scale 0.5`. Camera-fixed lighting, hard alpha.
  - `grAb` offsets: x = the actor's centre, y = the feet (sunk 1 texel).
  - **8 rotations** for anything that moves or faces (1 = facing the viewer, 3 = facing screen-left, 5 = back, 7 = facing screen-right). **Rotation 0** for death frames, symmetric props and pickups.
- **HUD sprites** (`mod/graphics/hud/`):
  - The 320×200 screen at 3× (960×600, plus 40 virtual px below the screen), with a 90° horizontal FOV at 4:3.
  - `tools/build.mjs` writes a `TEXTURES` entry (`XScale 3`) for every PNG there, using the `grAb` offsets. Names end in `0`.
- **Wall textures** (`mod/textures/`) and **flats** (`mod/flats/`):
  - PNGs at 2 texels per map unit. `build.mjs` declares them with `XScale/YScale 2`, so a 256×256 PNG is a 128×128-unit texture.
  - Wall heights should suit 128-unit rooms: 256×256 or 512×256 PNGs. Flats are 128×128 PNGs (64×64 units).
- **Skies** (`mod/textures/SKY*.png`): 2048×512 PNGs, declared at scale 2.
- **Graphics** (`mod/graphics/`): HUD art such as the IRIS portrait frames, at 1:1 in HUD virtual pixels ×2.

## 1. Characters (`mod/sprites/monsters/`, `mod/sprites/npcs/`)
Frames are listed by letter. "8" means 8 rotations; "0" means one image for all angles.
| Prefix | Actor | Frames |
|---|---|---|
| `THRL` | Thrall: possessed Area 51 security, tan BDU, black beret, oil-black eyes, pistol | A-D walk (8), E aim (8), F fire with flash (8), G pain (8), H-L death (0), M-P gib (0) |
| `THRS` | Thrall Trooper: possessed soldier, woodland BDU, helmet, shotgun | as THRL |
| `GREY` | Grey (EBE), 1.2 m | A-D walk (8), E-F psychic-bolt cast (8), G claw (8), H pain (8), I-M death (0) |
| `HYBR` | Hybrid: pale, black sclera, black BDU and webbing, alien carbine | A-D walk (8), E aim (8), F fire (8), G pain (8), H-L death (0) |
| `STLK` | Stalker: long-limbed grey-green hunter, half-crouched | A-D run (8), E-G claw lunge (8), H pain (8), I-M death (0) |
| `PROB` | Probe: 1 m chrome-and-bone floating sphere, one lens, 3 antennae | A-B hover (8), C-D fire (8), E pain (8), F-J death/explode (0) |
| `OVSR` | Overseer: 2.4 m Grey elder, ribbed carapace mantle, floating, glowing cranium | A-D float (8), E-F raise hands (8), G-H lance (8), I pain (8), J-O death (0) |
| `HIVE` | Hive Mind: brain-coral mass in a ribbed cradle, 4 conduits, huge (≈4 m) | A-C pulse (0), D-E attack glow (0), F pain (0), G-L death (0) |
| `SCI1` | Scientist: white lab coat, tie, glasses, Half-Life | A-D run (8), E-F cower (8), G pain (8), H-L death (0) |
| `SCI2` | Lab tech: blue scrubs, cap | as SCI1 |
| `GRDW` | Downed guard sitting against a wall (tan BDU, bloodied) | A-B breathe (8), C wave/talk (8), D revive-rise (8), E-H death slump (0) |
| `GRDA` | Guard ally (revived guard, standing, pistol) | A-D walk (8), E aim (8), F fire (8), G pain (8), H-L death (0) |
| `DEDB` | Corpses | A dead guard, B dead scientist, C dead lab tech, D dead soldier (all 0) |

The IRIS avatar goes in `mod/graphics/iris/`, at 64×64 PNGs: a green CRT wireframe face with scanlines, not cute.
| Lump | State |
|---|---|
| `IRISI0`-`IRISI3` | idle (breathing flicker) |
| `IRIST0`-`IRIST3` | talking (mouth/eye bars move) |
| `IRISL0`, `IRISR0` | glancing left / right |
| `IRISA0`, `IRISA1` | alarm (red tint) |
| `IRISG0`-`IRISG2` | glitch (player hurt) |

## 2. Weapons, HUD (`mod/graphics/hud/`, all rotation `0`)
Per gun, the right-hand viewmodel. Hip is **off to the right, one-handed**. The left hand is out of frame or holds the flashlight (`FLHL`). ADS is **centred, two-handed**, sights on the screen centre. The left-hand dual-wield gun is the same frame mirrored by the engine (`PSPF_MIRROR`), so hip frames must look right when mirrored.
| Frame letters | Meaning |
|---|---|
| A | hip idle |
| B, C | hip fire (recoil peak, recover) |
| D-K | reload: D lower/tilt, E mag out, F mag gone, G new mag in, H seat, I rack/slide, J-K return. For shotguns: D tilt, E-F shell in (loop pair), G-H pump |
| L | ADS idle |
| M, N | ADS fire (peak, recover) |
| O | half-way between hip and ADS (transition) |
| P | lowered (sprint / dive / switching) |
| X | muzzle flash for hip (drawn on the flash layer at the same offsets; bright, additive-looking) |
| Y | muzzle flash for ADS |

| Prefix | Gun |
|---|---|
| `KNIF` | combat knife (A idle, B-E slash, F-H stab lunge; no ADS/reload frames) |
| `P9MM` | 9 mm pistol (a SIG-style pistol, gunmetal) |
| `SHOT` | pump shotgun (Remington 870-ish; the one-hand pistol-grip look works mirrored) |
| `SMG9` | SMG (MP5-ish) |
| `ARFL` | assault rifle (M4-ish, carry handle or red dot) |
| `BRFL` | battle rifle (DMR, 3-round burst). L-N are the scoped ADS view (the HUD draws the scope surround) |
| `ABLD` | alien Harvester blade (A idle, B-G two-hit combo) |
| `ASTG` | alien Stinger pistol (L-N ADS; C = charged glow) |
| `ASCT` | alien Scatter shotgun |
| `APSM` | alien plasma SMG (no magazine: D-K is a vent: panels open and steam) |
| `SNGL` | the Singularity (A idle, B-F charge, G fire, H-I recover; no reload) |
| `FLHL` | the left hand holding the flashlight low-left (A on, B off) |
| `GRNH` | left hand grenade: A pull pin, B cook hold, C-E throw |
| `DETH` | left hand alien detonator: A arm (glyphs light), B hold, C-E throw |
| `MELE` | quick melee overlay from any gun (knife from the bottom-left): A-D |

## 3. Items, projectiles, FX (`mod/sprites/items/`, `mod/sprites/fx/`, rotation `0`)
**Weapon pickups:** `WP9M` `WSHT` `WSMG` `WARF` `WBRF` `WABL` `WAST` `WASC` `WAPS` `WSNG`, frame A.

**Ammo:**
| Lump | Item |
|---|---|
| `A9MM` | 9 mm magazine |
| `A9BX` | 9 mm box |
| `ASHL` | 4 shells |
| `ASHB` | shell box |
| `A556` | 5.56 magazine |
| `A55B` | 5.56 box |
| `A762` | 7.62 magazine |
| `AENC` | alien energy cell (A-B pulse) |
| `AENP` | alien energy pod (large, A-B pulse) |
| `GFRG` | frag grenade |
| `GDET` | alien detonator |

**Health and armour:**
| Lump | Item |
|---|---|
| `HSTM` | stim syringe |
| `HMED` | medkit |
| `HIMP` | alien implant, soulsphere-like (A-D pulse) |
| `AKEV` | Kevlar vest |
| `ATAC` | tactical armour |
| `BATT` | flashlight battery |

**Keys and objectives:**
| Lump | Item |
|---|---|
| `KBLU` `KRED` `KYEL` | keycards (A-B blink) |
| `ODOS` | the dossier (manila folder, TOP SECRET stamp) |
| `OHDD` | HDD cache (a 90s drive in a rugged case with an alien glyph) |
| `OCSF` | case file |
| `OSHD` | navigation shard (violet crystal, A-B glow) |

**Projectiles and FX:**
| Lump | Effect |
|---|---|
| `PBLT` | Grey psychic bolt (A-B fly, C-E hit) |
| `HPLS` | Hybrid plasma (A-B, C-E) |
| `PPLS` | Probe pulse ball (A-B, C-E) |
| `APLS` | player alien plasma (A-B, C-E) |
| `ASTB` | Stinger bolt (A-B, C-E) |
| `ASCP` | Scatter pellet (A, B-C) |
| `SNGB` | Singularity ball (A-B, C-H) |
| `FRAG` | thrown frag (A-D spin) |
| `DETN` | detonator stuck/flying (A-D glyph blink) |
| `EXPL` | explosion (A-H) |
| `PUFF` | bullet puff (A-D) |
| `SPRK` | sparks (A-D) |
| `BLDG` | green alien blood (A-C) |
| `BLDR` | red blood (A-C) |
| `OILB` | black oil (A-C) |
| `SMOK` | smoke (A-E) |
| `FIRE` | fire, looping (A-H) |
| `GLAS` | glass shards (A-D) |
| `CASE` | brass (A-D) |
| `SHEL` | red shotgun shell (A-D) |
| `TELF` | teleport fog / alien warp-in (A-F) |

## 4. Props (`mod/sprites/props/`, rotation `0` unless noted)
**Lab:**
| Lump | Prop |
|---|---|
| `DDSK` | desk with papers |
| `DCHR` | office chair |
| `DMON` | CRT monitor on a desk (A-B flicker) |
| `DTRM` | freestanding computer console (A-B) |
| `DHCK` | hackable alien-tech terminal (A idle, B-C active, D done) |
| `DTNK` | specimen tank with a Grey inside (A-B bubbles) |
| `DTNB` | smashed tank |
| `DAUT` | autopsy table with an alien under a sheet |
| `DCAB` | filing cabinet |
| `DSRV` | server rack (A-B blink) |
| `DLMP` | lab floor lamp |
| `DCYL` | gas cylinders |
| `DGEN` | generator |
| `DCRT` | crate |
| `DBAR` | explosive fuel drum (A-B, then C-G burst) |
| `DPAP` | scattered papers |
| `DBLD` | blood pool |
| `DGLS` | broken glass on the floor |
| `DALN` | alien conduit growth (A-B pulse) |

**City:**
| Lump | Prop |
|---|---|
| `DCAR` | burning car wreck (A-C flames) |
| `DHYD` | hydrant |
| `DLPT` | sodium streetlamp (tall) |
| `DDMP` | dumpster |
| `DTRS` | trash bags |
| `DBNC` | bench |
| `DPHN` | phone booth |
| `DTRF` | traffic light (A-C cycle) |
| `DNWS` | newspaper box |
| `DBRL` | burning barrel (A-D) |

**Crash site:**
| Lump | Prop |
|---|---|
| `DTRE` | pine tree (tall) |
| `DBSH` | bush |
| `DTNT` | army tent |
| `DFLD` | floodlight on a tripod |
| `DJEP` | army jeep wreck |
| `DRCK` | rocks |
| `DSBG` | sandbags |
| `DDBR` | glowing hull debris (A-B) |

**Mothership:**
| Lump | Prop |
|---|---|
| `DATK` | attack craft on a rack (large, ID4) |
| `DPOD` | abduction pod with a human (A-B glow) |
| `DCNS` | alien console (A-B) |
| `DPLR` | alien pillar |
| `DHVC` | hive conduit (A-C pulse) |

**Dynamic:**
- `CURT` (curtain, A-F flowing in and out) is a wall sprite placed in a window.
- `FIRE` is shared with FX.

## 5. Textures (`mod/textures/`) and flats (`mod/flats/`)
**Lab / Area 51 (Half-Life):**
- Walls:
  - `LABWALL1` (beige panels), `LABWALL2` (panels with an orange stripe), `LABBASE` (dark lower trim)
  - `LABDOOR` (sliding door), `BLSTDOOR` (blast door with hazard edges)
  - `LABCOMP` (computer bank wall), `CONCWALL`, `METLWALL`, `METLPANL`
  - `HAZSTRIP` (trim), `VENTWALL`, `PIPEWALL`, `SUPPORT` (steel beam), `ELEVDOOR`
  - `EXITSIGN`, `SW1LAB`/`SW2LAB` (switch off/on), `WINFRAME` (window frame edge)
  - `GLASS1` (intact glass, alpha, mid), `GLASSBRK` (broken glass, alpha, mid), `FENCEMID` (mesh, alpha, mid)
  - `ALNHULL1` (alien hull grown into the wall), `ALNVEIN` (teal veins)
  - `LABSIGN1` (a department sign), `POSTER1` (a "THEY'RE ALREADY HERE" style poster)
- Flats: `LABTILE`, `LABTIL2`, `LABCEIL`, `LABLITE`, `CONCFLR`, `METLFLR`, `GRATEFLR`, `ALNFLR1`, `STEPTOP`.

**City (Duke-seedy):**
- Walls:
  - `BRICKRED`, `BRICKDRK`, `STOREFR1`, `STOREFR2`, `OFFICEWN` (tower windows), `MARBLE`, `WOODPANL`
  - `SUBWAYTL`, `SUBWAYSN`, `ROLLDOOR`, `GRAFFIT1`, `GRAFFIT2`
  - neon signs: `NEONBAR`, `NEONPAWN`, `NEONLIQ`, `NEONMOTL`, `NEONARCD`, `NEONSHOW` (a "LATE SHOW" cinema marquee)
  - `POSTERS`, `SW1CITY`/`SW2CITY`
- Flats: `ASPHALT`, `ASPHLINE`, `SIDEWALK`, `CARPETR`, `MARBFLR`, `SUBFLR`, `ROOFTAR`.

**Crash site:**
- Walls: `ROCKWAL1`, `DIRTWALL`, `TENTCANV`, `HULLEXT` (violet saucer hull), `HULLBRN` (burnt hull), `HULLIN1` (interior).
- Flats: `DIRTFLR`, `GRASSFLR`, `MUDFLR`, `ROCKFLR`, `HULLFLR`.

**Mothership (ID4 + Perfect Dark):**
- Walls: `SHIPRIB1`, `SHIPRIB2` (organic-mechanical ribs), `SHIPPNL1`, `SHIPPNL2` (sleek dark panels with cyan strips), `SHIPGLOW` (light strip), `SHIPDOOR`, `SHIPCONS`, `SHIPPOD`, `SW1SHIP`/`SW2SHIP`.
- Flats: `SHIPFLR1`, `SHIPFLR2`, `SHIPCEIL`, `SHIPGRAT`, `SHIPLITE`, and animated goo `GOO1`-`GOO4`.

**Skies:** `SKYA51` (desert night, stars, distant lights and a hovering craft), `SKYCITY` (burning skyline, a mothership with a beam), `SKYFRST` (night sky with smoke and treeline glow), `SKYSPACE` (space with Earth below).

## 6. Sounds
`mod/sounds/*.wav`, made by `tools/sfx.mjs`. Logical names are in `SNDINFO`, grouped `weapons/*`, `monsters/*`, `npc/*`, `iris/*`, `items/*` and `world/*`.

## 7. Editor numbers (map things)
The single source of truth is `tools/data/things.json`: class → DoomEdNum, plus the args each thing reads. `mapc.mjs` emits these numbers, and `build.mjs` writes the MAPINFO `DoomEdNums` block from the same file.
