# Map sources

`maps-src/mapNN.txt` are the maps. `node tools/mapc.mjs` compiles them into `mod/maps/MAPNN.wad`
(UDMF, namespace `zdoom`, ZNODES built by `zdbsp`). It proves that each map can be finished, and it
draws a top-down review image in `shots/maps/MAPNN.png`. `iris_lines.txt` lists every IrisTrigger id
with where it is and what it should say.

```
node tools/mapc.mjs                 # all maps
node tools/mapc.mjs map03           # one map
node tools/mapc.mjs path/to/x.txt   # any source file
  --no-nodes  --no-preview  --quiet  --unreached (list unreached areas)  --out DIR
```
The exit status is 1 if any map fails.

## The grid
One character is one **32×32-unit cell**. Row 0 is north, and columns grow east. The player is 32
units wide and 56 tall, so corridors should be at least 3 cells wide and doors 2-4 cells.

- A cell's character picks its **legend** entry.
- Each **connected region** of the same character becomes one sector. To make all regions of a
  character one sector, give the entry `merge`.
- `' '` is void (outside the map). `'#'` is a plain wall; its faces take the adjoining room's `wall=`.
- `/` and `\` are **diagonal half-cells**. Each half takes the sector (or wall) of the two orthogonal
  neighbours it touches, so `/` at a room's NW corner cuts the corner off. Runs of diagonals make
  45° walls. A diagonal can also split two sectors.
- **Marks** are single characters that stamp a thing (the floor under it is inferred from its
  neighbours, or forced with `on=X`) or turn a wall cell into a **switch**.
- Things can also be listed in a `things` block by cell coordinate. Fractions are allowed: `12.5,8`.
- Lines starting with `;` inside the grid are comments, which the files use for column rulers.

## Directives and blocks
```
map MAP01 "Groom Lake"            ; lump name, title (MAPINFO owns the real name)
sky SKYA51                        ; informational (MAPINFO sets the sky)
defaults k=v ...                  ; merged into every non-solid legend entry
tag @vault 101                    ; pin a symbolic tag (otherwise @names get 100, 101, ...)
legend ... end                    ; <char> <kind> [key=value | flag]...
marks ... end                     ; <char> <Class> [keys] | <char> switch Special(args) [keys]
grid ... end
things ... end                    ; <Class> <col>,<row> [keys]
```
Outside the grid, `;` and `//` start comments.

## Legend kinds
| kind | keys |
|---|---|
| `solid` / `void` | `tex=`: the face texture. Without it, faces use the room's `wall=`. |
| `room` | `floor ceil ff cf wall upper lower light color=#RRGGBB fade=#RRGGBB sky` (sets `cf=F_SKY1`; a `sky` in `defaults` only applies to entries without their own `cf=`, and `nosky` cancels it), `damage= dmgtype= dmginterval=`, `secret`, `tag=N\|@name[,..]`, `merge`, `block` (impassable boundary), `scenery` (never entered; left out of the coverage stat), `lowerself=` (texture for this sector's own lower walls, for pits), `enter=Special(args)` (walk-over trigger on every line into or out of the region; add `enterrepeat` to repeat it), `seq=` (sound sequence) |
| 3D floor (on a room) | `slab=z0..z1 slabtop= slabbot= slabside= slablight= slabtype= slabalpha=`. mapc builds the control sector below the map and gives the region a `Sector_Set3DFloor` tag.  Stacked storeys: up to six slabs per region, `slab=`, `slab2=` ... `slab6=` (each takes the same keys with its number, e.g. `slab2top=`, falling back to the unnumbered key); a wall that exists on one storey only is a region whose slabs merge through that storey (MAP04 Merchant Tower). |
| `door` | `tex=` (face), `track=` (jambs, lower-unpegged), `lock=blue\|red\|yellow`, `speed= delay=`, `stay` (Door_Open), `blast` (slow), `secret` (looks like its `tex=`, a secret line, stays open; put `secret` on the room behind it), `remote` + `tag=` (no use special; opened by a switch, terminal or gate), `open`, `floor=` |
| `lift` | `top=` (up position), `tex=` (its side face), `wall=` (the shaft), `speed= delay=`, `remote` + `tag=` |
| `stairs` | `dir=N\|S\|E\|W` (the direction they rise), `floor=` (the level below the first step), `top=` (the last step), `riser=`, `headroom=` (the ceiling follows the steps) or `ceil=`. Each row or column is one step, and each rise must be 24 or less. |
| `window` | `floor=` (sill), `ceil=` (lintel), `glass=GLASS1\|GLASSBRK\|FENCEMID`, `frame=`, `pane=both\|N\|S\|E\|W`, `broken` (hitscan and projectiles pass), `nowrap`, `pegbottom` (fences: drawn once, from the floor up) |

What mapc generates:
- **Doors:** `Door_Raise(0,32,150)` on use, monsters can use them, and the door is always the back
  sector. Locked doors get `Door_LockedRaise(0,..,lock)`. The lock numbers follow `mod/LOCKDEFS.txt`:
  **1 blue, 2 red, 3 yellow**.
- **Lifts:** `Plat_DownWaitUpStay(0,32,105)`. The low sides get use lines and the high sides get
  walk-over lines.
- **Windows:** always impassable. Intact glass also blocks hitscan and projectiles.
- **Two-sided walls:** the side facing A shows B's `upper=`/`lower=` where B steps. Otherwise it
  shows A's `wall=` (or `lowerself=` for lower parts). Collinear lines with the same sides are merged.
- **Texture offsets:** horizontal offsets are world-aligned.

## Thing keys
- `angle=E|N|W|S|NE..|degrees`
- `args=a,b,c,d,e`: each can be a number, `@tag`, special name or `IRIS_nnn`. `a0=` .. `a4=` set one.
- `skill=12345`, `ambush`, `dormant`
- `dx= dy=` (offset in units)
- `z=top` (stand on the region's lowest 3D slab), `z=top2` ... `z=top6` (the Nth slab up), or `z=N`
- Checker-only:
  - `obj=N`: this item completes objective N.
  - `ondeath=Special(args)`: what this actor's death does.

Class names and DoomEdNums come from `tools/data/things.json`.

## The provability check
The map is sampled on a 16-unit grid with the real 32×32 player box.
- **Movement:** the player steps up at most 24 units, can drop any distance, needs 56 units of
  headroom, and treats 3D-floor tops as surfaces.
- **Doors:** a door opens once its key is held. Remote doors, floors and lifts change once their
  trigger fires. Lifts carry the player between their two heights.
- **Fixpoint:** the checker collects every reachable key, objective, switch, walk-over line,
  terminal (`HackTerminal` args 2-4), `ExitGate` (objective mask → `Door_Open(tag)`) and boss death
  (`HiveMind`: args[0] is the shield objective, args[1] is the death objective, and its death runs
  `ondeath=`), `InvasionPlans` (completes objective args[0], default 1) and the `Helicopter` (an exit:
  boarding needs objective mask args[0] and completes objective args[1]). It applies what they do and
  repeats until nothing changes. `IrisTrigger` args[2] only points the waypoint, so it completes nothing.

The compile **fails** if:
- the exit, any key, objective item, terminal, gate, monster or NPC can't be reached;
- a reachable position can no longer reach an exit (a softlock, including one-way drops taken early);
- a texture name isn't in `docs/ASSETS.md` §5, or a thing class isn't in `things.json`;
- a sector boundary isn't closed;
- a stair rise is over 24, or a door opens less than 56 high.

It **warns** about:
- textures that aren't painted yet;
- one-cell-wide squeezes;
- doors whose texture would repeat above the doorway;
- unreachable pickups or secrets.

It also reports pickups and secrets that are reachable only by **clambering** (ledges up to 64; see
GAME_DESIGN §5.4), and damaging floor on the route.

## Authoring rules learned the hard way
- **Door frames.** A door rises to its lowest neighbour's ceiling minus 4. If the room on the other
  side is taller, the door texture repeats above the doorway. Put a 1-cell frame with a low ceiling
  (about 128) on that side; mapc warns when you forget. Never put a door between two sky sectors,
  because it would open into the sky.
- **Outdoor buildings.** A solid wall cell next to a sky sector rises all the way to the sky ceiling.
  That is fine for city blocks and perimeter walls, but it makes a tent or shed look like a tower.
  Build small structures from *roof blocks*: raised-floor sectors at the roof height with the
  facade texture as their `lower=`, and mark them `scenery`. Give the interior a sky ceiling plus a
  3D-slab roof, and use open doorways, not doors (MAP01 shed and hut, MAP05 tents and cabin).
- **Facades with signs.** Sign textures are 64-128 units tall. Stack raised blocks so that each
  texture is exactly one block's lower face (MAP03: storefront block at 136 → neon block at 200).
- **Windows.** The player's eye is 41 units above the floor, so keep sills at about 24, not 40.
- **Looking out into space.** A sector with `ff=F_SKY1 cf=F_SKY1`, ringed by a zero-height
  `F_SKY1` sector, shows sky on every side through a window (MAP06 observation gallery).
- **Pits.** Anything more than 24 units below its surroundings needs steps out, or the softlock
  check fails (MAP03 subway track bed).

## Tags reserved
- MAP06 tag **666**: the exit barrier. The Hive Mind's death runs `Floor_LowerToLowest(666,16)`.
- Symbolic `@tags` are numbered from 100. 3D-floor control tags start at 900.
