// Level validator (Node, no browser): for every level
//   * the player start is on open ground, not inside a box
//   * every objective point, pickup and ground enemy is reachable on the nav grid
//     from the start, allowing for scripted doors being opened
//   * enemies and pickups do not spawn inside solid geometry
//   * the sim runs 10 s with no exceptions
// Usage: node tools/check-levels.mjs
import { LEVELS } from '../js/levels.js';
import { CollisionWorld, NavGrid } from '../js/world.js';
import { ENEMIES } from '../js/enemies.js';
import { createWorld, step, DT } from '../js/sim.js';

let fails = 0;
const bad = (lv, msg) => { fails++; console.log(`  FAIL [${lv.id}] ${msg}`); };

for (const lv of LEVELS) {
  console.log(`${lv.name} (${lv.id}): ${lv.boxes.length} boxes, ${Object.values(lv.groups || {}).flat().length} enemies, ${(lv.vehicles || []).length} vehicles, ${lv.sequence.length} steps`);
  const geo = new CollisionWorld(lv);
  // open every door so reachability ignores the script order
  geo.boxes.forEach((b, i) => { if (b.door) geo.off.add(i); });
  const nav = new NavGrid(geo, lv);
  const [sx, sz] = lv.player.pos;
  const start = nav.nearestWalk(sx, sz, 2);
  if (start < 0) { bad(lv, `start (${sx}, ${sz}) not on walkable ground`); continue; }
  const reach = nav.reachable(start);
  const walkCount = nav.walk.reduce((a, b) => a + b, 0), reachCount = reach.reduce((a, b) => a + b, 0);
  console.log(`  nav ${nav.nx}x${nav.nz}: ${walkCount} walkable, ${reachCount} reachable from start`);
  const reachable = (x, z, rad = 3) => {
    const k = nav.nearestWalk(x, z, rad);
    return k >= 0 && reach[k] === 1;
  };
  for (const [i, st] of lv.sequence.entries()) {
    const u = st.until;
    if ((u.type === 'reach' || u.type === 'use') && !reachable(u.pos[0], u.pos[1], 4)) bad(lv, `step ${i} "${st.obj}" point (${u.pos}) unreachable`);
  }
  for (const pk of lv.pickups || []) {
    if (pk.pos.length === 3) continue; // placed on a catwalk / pedestal
    if (!reachable(pk.pos[0], pk.pos[1], 2)) bad(lv, `pickup ${pk.weapon || pk.type} at (${pk.pos}) unreachable`);
  }
  for (const [gid, g] of Object.entries(lv.groups || {})) {
    for (const s of g) {
      const d = ENEMIES[s.t];
      const x = s.p[0], z = s.p[s.p.length - 1];
      if (s.p.length === 3) {
        const y = s.p[1];
        if (!d.fly && Math.abs(geo.groundAt(x, z, y + 0.1, d.radius) - y) > 0.3) bad(lv, `${gid} ${s.t} perched at (${s.p}) has no floor under it (got ${geo.groundAt(x, z, y + 0.1, d.radius).toFixed(2)})`);
        if (d.fly && geo.solidAt(x, y, z)) bad(lv, `${gid} drone at (${s.p}) inside solid`);
        continue;
      }
      if (!reachable(x, z, 2)) bad(lv, `${gid} ${s.t} at (${x.toFixed(1)}, ${z.toFixed(1)}) not on reachable ground`);
    }
  }
  for (const pad of lv.spawnPads || []) if (!reachable(pad.pos[0], pad.pos[1], 2)) bad(lv, `spawn pad ${pad.label} unreachable`);
  for (const v of lv.vehicles || []) if (!reachable(v.pos[0], v.pos[1], 3)) bad(lv, `vehicle ${v.type} at (${v.pos.map((n) => n.toFixed(1))}) unreachable`);
  for (const [gid, g] of Object.entries(lv.groups || {})) for (const sp of g) if (sp.ride && !reachable(sp.p[0], sp.p[sp.p.length - 1], 3)) bad(lv, `${gid} rider unreachable`);
  // run the sim for 10 s, standing still, to shake out exceptions
  try {
    const w = createWorld(lv, { difficulty: 'normal' });
    for (let i = 0; i < 600; i++) { step(w, DT, {}); w.events.length = 0; }
    console.log(`  sim 10 s OK: mode=${w.mode}, hp=${w.player.health.toFixed(0)}, shield=${w.player.shield.toFixed(0)}, alive=${w.enemies.filter((e) => !e.dead).length}, y=${w.player.pos.y.toFixed(2)}`);
  } catch (e) { bad(lv, `sim threw: ${e.stack}`); }
}
console.log(fails ? `${fails} problem(s)` : 'LEVELS OK');
process.exit(fails ? 1 : 0);
