# Cosmic Calamity: Assault — Game Design Document

> *Halo: Combat Evolved / Halo 2*, first person, set six months after *Metal Snake: Cosmic Calamity*. The stealth is over: the Vyrr are landing on Earth's cities, and the Earth Cyborg Squad goes in loud.

Built from: `mstr-gme-dsgn-tmpt` house rules (sim / render / UI split, fixed step, Pointer-Events touch, touch-zoom-guard, synth audio, smoke tests), `mtd-public/dr-mow` (gamepad module, smoke test), and the story, cast and palette of `mtd-public/cosmic-calamity`.

## 1. Story
- **Before:** in *Cosmic Calamity*, the cyborg operative **Snake**, bonded to the AI **IRIS**, broke the **Lullaby Array** aboard the Vyrr mothership *Hollow Choir*. It was a weapon that would have put Earth's cities to sleep. The captive ship-mind **Threnody** leaked the location of every other Vyrr ship's core.
- **Now:** the truce is dead. Vyrr ships hang over forty cities and the landings have begun. Earth builds the **Earth Cyborg Squad (ECS)** on Snake's pattern. You are **ANVIL**, an ECS operative, with **IRIS-2**, a fork of IRIS ("all of her memories, none of her patience"). **Gen. Hale** commands and **Maj. Snake** leads the squad. **Condor-2** flies the dropship.
- **Missions:**
  1. **Fallen Hymn**, Tacoma. A downed assault carrier. Recover the Resonance Key, the map of the Vyrr fleet.
  2. **Cold Storage**, Rotterdam. A Vyrr depot in a seized warehouse. Destroy three Lullaby seed emitters, then kill the Bulwark pair.
  3. **Song of the Gorge**, Verdon Gorge. Cross the canyon, break the outpost, and destroy the Hymn Spire that powers every emitter in Europe.

## 2. Pillars
1. **The 30 seconds of fun.** Meet a group of enemies, strip shields with plasma, finish with bullets or a melee, throw a grenade to flush them out, and reposition while your shield recharges.
2. **Readable enemies.** Each Vyrr has a Halo role and a visible tell: Skitters panic, Troopers' shields flare, a Bulwark's glowing spine is its weak spot, and Drones hum.
3. **Two guns, two grenade types.** Swap weapons from the dead; ammo is always a decision.
4. **Early-Xbox look.** Smooth low-poly shapes, normal-mapped specular detail textures, emissive trims, fog and big skies. No raw boxes on screen.
5. **Tablet first, controller native.** Every mechanic works with thumbs; the Xbox pad plays like Halo 2.

## 3. Core loop
```
 objective marker → contact (motion tracker pings, callouts) → fight (shield / plasma / grenades)
   → loot (swap weapons, grenades, health packs) → "CHECKPOINT... DONE" → next set piece
 die → revert to the last checkpoint (Halo: no lives, no game over)
```

## 4. Controls
| Verb | Keyboard + mouse | Xbox controller (Classic / Halo 2) | Touch (tablet) |
|---|---|---|---|
| Move / look | WASD / mouse (pointer lock) | Left / right stick (curve + turn ramp) | Floating stick on the left 42% / drag anywhere else (or on FIRE) |
| Fire | Left click | RT | FIRE (hold; drag to aim while firing) |
| Grenade / type | G / T | LT / LB | NADE / G-TYPE |
| Jump / crouch | Space / hold C | A / L3 (toggle) | JUMP / CROUCH (toggle) |
| Melee | Q or V | B | MELEE |
| Reload / pick up | R / hold E | X tap / X hold (RB in the Recon preset) | ACTION tap / hold |
| Switch weapon | Tab, 1, wheel | Y | SWAP |
| Zoom | Right click / Shift | R3 | ZOOM |
| Pause / objective | Esc, P / O | Menu / View | ❚❚ |

- **Menus with a pad:** D-pad or left stick moves a focus ring, A presses, B goes back. This is dr-mow's `MenuNav`. Button names follow the controller family (Xbox, PlayStation or Switch).
- **Aim assist** (pad and touch only; toggle in Settings):
  - friction: look speed ×0.45 inside a cone around a target
  - magnetism: the view drifts to follow a target while you move
  - bullet magnetism: hitscan rounds bend onto a target within 0.035 rad of the ray
- **Rumble:** on firing, taking damage, melee and nearby explosions (`vibrationActuator`).

## 5. Numbers (`js/tuning.js`, `js/weapons.js`, `js/enemies.js`)
| Parameter | Value | Why |
|---|---|---|
| Walk / crouch | 5.4 / 2.5 m/s | Halo's pace: strafing dodges plasma at 12 m |
| Jump | 5.9 m/s, gravity 13 | apex 1.3 m: clears a crate, not a wall; the floaty arc |
| Step height / max slope | 0.55 m / gradient 1.1 | stairs without jumping; canyon walls can't be climbed |
| Shield / health | 75 / 45 (three segments) | Halo 1: the shield regenerates, health needs packs |
| Shield delay / rate | 4.2 s / 42 per s | break contact for ~4 s and it refills in under 2 s |
| Melee | 75, 2.1 m + 4.5 m lunge, 0.75 s | pops a Trooper's shield; from behind it's an instant kill |
| Frag / plasma | 170 / 190 damage, 5.5 / 4.2 m, fuse 2.4 / 1.9 s | plasma sticks: a stuck Trooper is a dead Trooper |
| Assault rifle | 32 rounds, 7.5 dmg, 0.085 s, bloom to 0.055 rad | bursts at range, spray up close |
| Sidearm | 12, 22 dmg, ×3.2 head, 2× zoom | the Halo 1 magnum: head shots on unshielded targets kill |
| Battle rifle | 3-round burst, 11 dmg, ×2.5 head, 2.3× zoom | four bursts kill a Trooper |
| Shotgun | 9 × 14 dmg, falloff after 12 m, shell reload | close-quarters, interrupts its own reload |
| Plasma caster | bolts ×2.2 vs shields; 0.9 s overcharge = 70 dmg ×3 vs shields, homing | the "noob combo": overcharge strips, the sidearm finishes |
| Pulse carbine | auto plasma, heat 4.5% per shot, vent 2.6 s | watch the heat bar |
| Shard needler | homing shards, 7 in 2 s = 130 dmg supercombine | the pink mist |
| Fuel lance | arcing explosive, 120 splash | the Bulwark's gun, which you can take |
| Skitter | 32 HP, 3.3 m/s, 8 dmg bolts, flees if its Trooper dies | fodder with a morale break |
| Trooper | 60 shield + 58 HP, dodges when aimed at, berserks below 30% | the duel |
| Bulwark | 440 HP, front ×0.1, back ×2.6, 120 melee | get behind it; its partner enrages |
| Drone | 28 HP, flies 3–7 m up and circles | punishes standing still in the open |
| Difficulty | Easy / Normal / Heroic / Legendary: enemy damage 0.55 / 0.82 / 1.55 / 2.4 | Halo's four |

## 6. HUD (Halo 1/2)
- **Top right:** a 20-segment shield bar (red flashing with an alarm beep when empty) and three health segments.
- **Top left:** ammo readout.
  - Ballistic weapons: magazine count, rounds as ticks, reserve.
  - Plasma weapons: battery % and heat bar, plus the overcharge meter.
  - Frag and plasma grenade counts, with the selected type outlined.
- **Bottom left** (under the ammo panel on touch): a 25 m motion tracker.
  - Shows only moving or firing hostiles, so crouching or still enemies are invisible (Halo's rule).
  - Dots above or below you are dimmed.
- **Centre:**
  - A reticle per weapon that turns red over a hostile in range.
  - Scope overlay with a range readout when zoomed.
  - Red damage-direction arcs.
- **World markers:** a Halo 2 nav diamond with distance; red diamonds on destructible objectives.
- **Text:** "CHECKPOINT... DONE", objective line, pickup toasts, comms subtitles (speaker colours per the Cosmic Calamity cast), and the context prompt "HOLD X TO PICK UP BATTLE RIFLE".
- **The first-person rifle** has a live ammo counter on the gun, as in Halo.

## 7. Art direction: early Xbox
- **Characters** are jointed skeletons built from "bones": one mesh per limb segment with a sphere at each joint and a tapered shaft between, so a chain of them reads as one continuous limb at any bend (Halo 1's Elites were capsules on a skeleton). Legs plant their feet through two-bone IK, arms hold guns through IK onto the gun's grip and foregrip nodes, tails are bone chains that sway, jaws hinge. Silhouettes borrow from Titanfall pilots and Black Ops operators (chest rigs, pouches, knee pads, jump-kit packs, visor helmets) at original-Xbox polygon counts.
- **The Vyrr** are humanoid fighter-pilots. Their atmosphere is not ours, so every one wears a hard-shell helmet with a lowered dark visor and a snouted breathing mask (filter canisters on the cheeks, a hose to the life-support pack on the chest) over a quilted flight suit with harness straps, pouches, knee pads and boots. The Trooper is tall with human proportions and plate armour; the Skitter is short, like a child in an oversized helmet with the tank on its back; the Bulwark is a hulking pressure suit with twin tanks, the glowing coolant spine down the pack as its weak spot, and the slab shield and cannon on its forearms. The reptile shows only in the muzzle shape under the mask, the scaled neck and the claws.
- **The player's suit** is charcoal ripstop with dark composite plates (pauldrons, gauntlets, thigh and shin plates), harness straps and a wrist computer: grey and black, not olive.
- **Guns and vehicles** are built from rounded cross-sections (`rrect` profiles extruded along the barrel), swept side profiles with arcs for stocks and receivers, ring trigger guards and many-segment cylinders; the MULE's hood, cab and bed are one curved profile with rounded wheel arches and torus tyres; the Sliver's wings are curved.
- **Backdrops:** pines are a trunk with seven whorls of drooping branch cards (an alpha-tested needle texture) so they read as foliage from any angle; broadleaf trees fork into branches under leaf cards; distant mountains are a ridged annulus with a snow line; city skylines are towers with a lit-window facade texture, set-back upper floors, rooftop tanks and masts.
- **The player's arms** run from shoulders at the bottom corners of the view to articulated hands; IK keeps them on the gun through every clip, so a reload is the left hand actually pulling the magazine, dropping it, seating a fresh one and racking the charging handle.
- **Shapes:**
  - Chamfered boxes, so the bevels catch specular.
  - Lathes (pods, the spire, the reactor), extrusions (barriers, consoles, the bridge arch, car wrecks) and noise-displaced icosahedra for rocks.
  - The downed carrier is a teardrop profile extruded along its length. Its nose is torn open and it is rolled 3° in the dirt.
- **Materials:** Phong with procedural diffuse + normal (+ emissive) maps, painted at load (`js/textures.js`).
  - Human: olive drab, gunmetal, concrete, containers.
  - Vyrr: violet plating with soft iridescence and green bioluminescent seams (Cosmic Calamity's palette).
- **Terrain:** one heightfield with a triplanar rock/ground blend by slope, sand below the waterline, and baked AO.
- **Light:** hemisphere + sun (shadows on High only), a pool of 2–3 re-aimed point lights for the nearest lamps, and 2–3 flash lights for muzzle, plasma and explosions (no per-projectile lights).
- **Sky:** a gradient dome with sun glow, stars at night, distant skylines, and Vyrr capital ships with beams hanging over the horizon.
- **FX:** all particles are instances of two billboard meshes (additive glow and alpha smoke) from one atlas, so all FX cost two draw calls. There are also pooled decals for bullet holes and scorches.

| Colour | Use |
|---|---|
| `#6ec3ff` | HUD (Halo blue) |
| `#ffbe5a` | objectives, nav points, selected items |
| `#ff463c` | danger: low shield, hostile reticle, damage |
| `#3affc8` | Vyrr blood |
| `#6effa0` / `#9b6bff` / `#d35bff` | Vyrr tech: seams, plasma, emitters / spire |

## 8. Levels
| # | Map | Space | Set pieces |
|---|---|---|---|
| 1 | Fallen Hymn | dusk; broken overpass → debris field → crash trench → carrier interior (hall, bulkhead, side bays, reactor with catwalks) → starboard breach → LZ basin | drones out of the wreck; the key extraction triggers a Bulwark; defend the LZ |
| 2 | Cold Storage | night rain; container yard → warehouse (catwalks, cargo-pod aisles) → emitter hall → rear dock | three destructible emitters; the Bulwark pair through the rear shutter |
| 3 | Song of the Gorge | bright day; canyon with a deep river (armour sinks: 16 dmg/s), pines, waterfall | stone bridge crossing, west-bank outpost, needler snipers across the river, spire conduits then the core, Condor pickup on the sandbar |
| T1 | Proving Grounds | tablet test map | all 8 weapons on respawning pedestals, holo-targets at 10 / 25 / 50 m, a movement course (stairs, crates, crouch tunnel, catwalk), spawn pads for each enemy type, unlimited ammo |
| T2 | Firefight: Plaza | tablet test map | endless escalating waves, respawning supplies, score |

Layouts are axis-aligned colliders on a heightfield. The renderer dresses every collider in a shaped mesh. `tools/check-levels.mjs` proves on the nav grid that every objective, pickup and ground enemy is reachable.

## 9. Performance budget (tablet)
- **Quality presets:**
  - Low: DPR 1, no AA, no normal maps, 2+2 lights.
  - Medium (the default on touch devices): DPR 1.5, AA, normal maps.
  - High (the default on desktop): DPR 2 and sun shadows.
- **Draw calls:** static level geometry is merged per material (≈15–25 meshes), pines are instanced, and FX are two instanced meshes.
- **AI:** one shared flow field toward the player, rebuilt every 0.35 s (Dial's algorithm on a 1 m grid). LOS checks run every ~0.17 s per enemy.

## 10. Open questions (defaults chosen)
- **Vehicles (Warthog / Ghost)?** Added: the M12 MULE and the Vyrr SLIVER (section 11).
- **Health model?** Halo 1: non-regenerating health plus packs. Halo 2's full regen would be a one-line change in `stepPlayer`.
- **Dual wielding (Halo 2)?** Not yet: two weapons plus grenades already fill the touch layout.
- **Co-op?** Out of scope.

## 11. Vehicles
| | M12 MULE | Vyrr SLIVER |
|---|---|---|
| Role | Warthog: two seats, driver + rotary chaingun turret | Ghost: one seat, twin plasma cannons, boost |
| Speed | 17 m/s (7 reverse), accel 9, brake 14 | 20 m/s, 31 boosting (2.8 s of boost, 5 s to refill), accel 13 |
| Steering | toward the look direction (Halo), + stick; turns only while rolling | same, wider drift (grip 3.2 vs 6), banks into turns |
| Ground | four sampled wheel points give pitch and roll; jumps and lands; climbs slopes up to 1.25× the walk limit | hovers 0.75 m on a spring; no terrain pitch |
| HP | 900 | 420 |
| Ram | 70 × speed/10 (kills a Skitter at 5 m/s, a Trooper at 12) | 50 × speed/10 |
| Guns | chaingun: hitscan, 9 dmg at 15 rounds/s from the seat's eye | bolts: 12 dmg ×1.7 vs shields, 58 m/s, alternate wings, up to 25° off the nose |
| Camera | third person: 8.5 m back, 3.2 m up, orbits with the look, pulled in by walls | 8 m / 3.4 m |
| AI | none | riders strafe past, orbit at ~1.25 rad off, break away under 9 m, fire when the nose is within 0.35 rad |

Riders are ordinary Troopers whose position is bound to the seat; shooting the rider frees the bike. Vehicle damage comes from bolts (×1.6 from the Vyrr), bullets, explosions and hard collisions (2.5 × speed). A destroyed vehicle explodes (110 splash), ejects the player with 40 raw damage, kills its rider and stays as a wreck.

---

## Delta log
### art pass 2 (branch `claude/loving-hypatia-y0lqd9`)
- Vyrr as humanoid fighter-pilots in atmosphere masks (helmet + visor + snouted mask, flight suits, harnesses, life-support packs); tails dropped.
- Player suit recoloured to charcoal and dark grey composite; guns in gunmetal instead of olive.
- Human weapons rebuilt with rounded cross-sections and curved profiles; MULE and Sliver smoothed.
- Pines as branch-card trees, branching broadleaf trees, ridged mountain range, lit-window skylines.
- Verification: check-levels OK; sim-check 49/49; smoke: 5 profiles PASS.

### graphics / art rework (branch `claude/loving-hypatia-y0lqd9`)
- Rig toolkit (`js/rig.js`): connected bones, analytic two-bone IK, hands with curling fingers.
- Player: full IK arms in first person; procedural clips for magazine reloads, shell loading, slide/bolt/pump cycling, melee, grenade throw (with the grenade in hand), weapon switch, plasma vent; brass ejection; a full-body cyborg seen when looking down and in vehicles.
- Enemies rebuilt on the toolkit with walk cycles that plant feet, aim twist, head tracking, roars, flee/berserk/melee/dodge/flinch/death poses; the Trooper made partially humanoid.
- All 8 weapons remodelled as assemblies with named parts; the turret chaingun added.
- Vehicles: MULE + SLIVER, seats, turret, Halo steering, splatters, vehicle HP and wrecks, Vyrr riders with AI, third-person camera, engine audio, HUD panel, placements in Fallen Hymn, the Gorge, Proving Grounds and the Plaza.
- Environments: prop catalog + dressing pass on every map, sun disc, grass, flags, birds, sun shafts, puddles, mist, dust.
- Scope: the surround is a translucent blue-grey with a lens edge and corner brackets instead of 92 % black.
- Verification: `check-levels` OK (vehicles and riders reachable); `sim-check` 49/49 (17 new vehicle checks); smoke: all 5 profiles PASS with 0 errors and 0 scroll; tap-spam PASS.
### initial prototype (branch `claude/cool-carson-fgvmn2`)
- 3 missions and 2 tablet test maps.
- 8 weapons and 4 enemy types (plus holo-targets).
- Frag and plasma grenades, melee with back-smack, checkpoints, 4 difficulties.
- Halo HUD, Xbox controller support, a tablet touch scheme, and keyboard/mouse.
- Verification:
  - `check-levels` OK.
  - `sim-check`: 32/32 PASS.
  - `smoke`: desktop, iPad landscape, iPad portrait, iPhone landscape and an emulated Xbox pad all PASS, with 0 errors and 0 scroll.
  - tap-spam: PASS on iPad and iPhone.
