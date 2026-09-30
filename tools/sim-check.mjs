// Headless mechanics check: runs the real sim in Node (no browser).
// Usage: node tools/sim-check.mjs
import { LEVELS } from '../js/levels.js';
import { createWorld, step, DT, applyLook, eyePos, damageEnemy, restoreCheckpoint } from '../js/sim.js';
import { ENEMIES } from '../js/enemies.js';
import { TUNING as T } from '../js/tuning.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const L = (id) => LEVELS.find((l) => l.id === id);
const run = (w, sec, inp = {}) => { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) { step(w, DT, typeof inp === 'function' ? inp(i) : inp); } };
const clearEnemies = (w) => { w.enemies = []; };
const place = (w, x, z, yaw = 0) => { const p = w.player; p.pos.x = x; p.pos.z = z; p.pos.y = w.geo.groundAt(x, z, w.geo.terrainH(x, z) + 1.3, T.radius, 0); p.vel = { x: 0, y: 0, z: 0 }; p.yaw = yaw; p.pitch = 0; };
const aimAt = (w, x, y, z) => { const e = eyePos(w.player); const dx = x - e.x, dy = y - e.y, dz = z - e.z; w.player.yaw = Math.atan2(-dx, -dz); w.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
const spawn = (w, t, x, z, extra = {}) => { const d = ENEMIES[t]; const e = { id: w.nextId++, type: t, group: 'test', spec: { t, p: [x, z] }, x, y: w.geo.terrainH(x, z) + (d.fly ? 4 : 0), z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: d.hp, maxHp: d.hp, shield: d.shield, maxShield: d.shield, shieldT: 99, weapon: d.weapon, grenades: 0, perch: false, alert: false, sees: false, seeT: 0, lastSeen: null, reactT: 99, mode: 'idle', modeT: 9, moveDir: { x: 0, z: 0 }, burstLeft: 0, fireT: 0, pauseT: 99, meleeT: 0, windup: 0, dodgeT: 0, dodgeCd: 99, fleeT: 0, gCd: 99, hideT: 0, dead: false, deadT: 0, dvx: 0, dvy: 0, dvz: 0, spin: 0, trackT: 9, hitT: 9, shieldHitT: 9, walk: 0, needles: [], stuck: 0, enrage: false, losT: 99, home: { x, z }, berserk: false, speedMul: 1, orbit: 1, ...extra }; w.enemies.push(e); return e; };

// ---------------------------------------------------------------- movement
{
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 0, 16);
  const z0 = w.player.pos.z;
  run(w, 2, { my: 1 });
  const v = (z0 - w.player.pos.z) / 2;
  ok('walk speed ≈ 5.4 m/s (after spin-up)', v > 4.6 && v < 5.6, `${v.toFixed(2)} m/s`);
  place(w, 0, 16);
  let apex = 0; const y0 = w.player.pos.y;
  run(w, 1.2, (i) => { apex = Math.max(apex, w.player.pos.y - y0); return { jump: i === 0 }; });
  ok('jump apex ≈ 1.3 m (clears a crate, not a wall)', apex > 1.15 && apex < 1.5, `${apex.toFixed(2)} m`);
  // stairs to the platform (24..30, -16..-6 at y 2)
  place(w, 27, 1, 0);
  run(w, 3, { my: 1 });
  ok('walks up stairs onto a 2 m platform', Math.abs(w.player.pos.y - 2) < 0.1, `y=${w.player.pos.y.toFixed(2)} z=${w.player.pos.z.toFixed(1)}`);
  // crouch tunnel (33..41, -40..-34 roof at 1.35)
  place(w, 37, -30, 0);
  run(w, 3, { my: 1 });
  ok('standing: blocked by the low tunnel roof', w.player.pos.z > -34.2, `z=${w.player.pos.z.toFixed(2)}`);
  place(w, 37, -30, 0);
  run(w, 3, { my: 1, crouch: true });
  ok('crouched: passes through the tunnel', w.player.pos.z < -36, `z=${w.player.pos.z.toFixed(2)}`);
  run(w, 1, { my: 0, crouch: false });
  ok('stays crouched under the roof when crouch is released', w.player.crouch > 0.9 || w.player.pos.z < -40);
}
{
  const w = createWorld(L('gorge'), {}); clearEnemies(w);
  const p = w.player;
  const cx = p.pos.x;
  run(w, 5, { mx: 1 }); // strafe east into the canyon wall
  ok('canyon walls cannot be climbed', p.pos.y < 8, `y=${p.pos.y.toFixed(1)} dx=${(p.pos.x - cx).toFixed(1)}`);
}

// ---------------------------------------------------------------- weapons
{
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 6, 0);
  const e = spawn(w, 'skitter', 6, -10);
  aimAt(w, e.x, e.y + 0.7, e.z);
  const mag0 = w.player.weapons[0].mag;
  run(w, 1.2, { fire: true });
  ok('assault rifle kills a skitter at 10 m in < 1.2 s', e.dead, `hp=${e.hp.toFixed(0)}`);
  ok('rifle spends ammo', w.player.weapons[0].mag < mag0);
  w.player.weapons[0].mag = 0;
  run(w, 2.4, {});
  ok('empty magazine auto-reloads', w.player.weapons[0].mag === 32);
  // pistol head shot
  w.player.cur = 1;
  run(w, 0.6, {});
  const s2 = spawn(w, 'skitter', 6, -14);
  aimAt(w, s2.x, s2.y + ENEMIES.skitter.head.y, s2.z);
  run(w, 0.1, (i) => ({ fire: i === 0, fireEdge: i === 0 }));
  ok('sidearm: one head shot kills an unshielded skitter', s2.dead);
}
{
  // plasma strips shields faster than bullets
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  const a = spawn(w, 'trooper', 0, -10), b = spawn(w, 'trooper', 3, -10);
  damageEnemy(w, a, 30, { shieldMult: 0.8 });
  damageEnemy(w, b, 30, { shieldMult: 2.2 });
  ok('plasma strips a shield faster than bullets', b.shield < a.shield, `bullet→${a.shield.toFixed(0)} plasma→${b.shield.toFixed(0)}`);
  const c = spawn(w, 'trooper', 6, -10);
  damageEnemy(w, c, 20, { head: true, headMult: 3 });
  ok('head shot does not bypass a raised shield', c.hp === c.maxHp);
  // bulwark armour
  const h = spawn(w, 'heavy', 0, -20);
  h.yaw = 0; // faces -z
  const front = h.hp; damageEnemy(w, h, 50, { dir: { x: 0, y: 0, z: 1 } }); const df = front - h.hp;
  const back = h.hp; damageEnemy(w, h, 50, { dir: { x: 0, y: 0, z: -1 } }); const db = back - h.hp;
  ok('bulwark: back takes >10x the front', db > df * 10, `front ${df.toFixed(1)} back ${db.toFixed(1)}`);
}
{
  // frag grenade + plasma stick
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 6, 0);
  const g1 = spawn(w, 'skitter', 5, -13), g2 = spawn(w, 'skitter', 7, -13);
  aimAt(w, 6, 0.3, -13);
  w.player.pitch -= 0.1; // lob short: the throw adds its own arc
  let thrown = false;
  run(w, 4, (i) => ({ grenade: i === 0 }));
  thrown = true;
  ok('frag grenade kills a pair of skitters', thrown && g1.dead && g2.dead, `hp ${g1.hp.toFixed(0)}, ${g2.hp.toFixed(0)}`);
  w.player.gType = 'plasma'; w.player.grens.plasma = 2;
  place(w, 6, 0);
  const t = spawn(w, 'trooper', 6, -8);
  aimAt(w, t.x, t.y + 1.2, t.z);
  w.player.pitch += 0.04;
  let stuck = false;
  run(w, 3, (i) => { if (t.stuck) stuck = true; return { grenade: i === 0 }; });
  ok('plasma grenade sticks to a trooper and kills it', stuck && t.dead);
}
{
  // melee from behind = assassination; from the front = shield damage only
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 6, 0, 0);
  const t = spawn(w, 'trooper', 6, -1.6);
  t.yaw = 0; // facing away from the player (faces -z)
  run(w, 0.1, (i) => ({ melee: i === 0 }));
  ok('melee from behind kills a shielded trooper outright', t.dead);
  run(w, 1, {}); // melee cooldown
  const u = spawn(w, 'trooper', 6, -3.2);
  u.yaw = Math.PI; // facing the player
  aimAt(w, u.x, u.y + 1.2, u.z);
  run(w, 1, (i) => ({ melee: i === 0 }));
  ok('melee from the front pops the shield but does not kill', !u.dead && u.shield === 0, `dead=${u.dead} shield=${u.shield.toFixed(0)} hp=${u.hp.toFixed(0)}`);
}
{
  // weapon swap by holding ACTION
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, -14, 4.9);
  run(w, 0.6, { action: true });
  ok('hold ACTION on a pedestal swaps weapons', w.player.weapons.some((x) => x.id === 'sidearm') && w.player.weapons.length === 2);
}
{
  // shield recharges, health does not
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  w.player.shield = 0; w.player.health = 30; w.player.shieldT = 0;
  run(w, 3, {});
  ok('shield waits before recharging', w.player.shield === 0);
  run(w, 4, {});
  ok('shield recharges fully', w.player.shield === T.shieldMax);
  ok('health does not regenerate (Halo 1)', w.player.health === 30);
}
{
  // AI: an alerted skitter shoots at the player; death reverts to the checkpoint
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 6, 0);
  spawn(w, 'skitter', 6, -12, { reactT: 0, pauseT: 0, losT: 0, yaw: Math.PI });
  run(w, 6, {});
  ok('enemies see and damage the player', w.player.shield < T.shieldMax || w.player.health < T.healthMax);
  w.player.health = 1; w.player.shield = 0;
  run(w, 6, {});
  ok('the player can die', w.mode === 'dead');
  restoreCheckpoint(w);
  ok('revert to checkpoint restores play', w.mode === 'play' && w.player.health === T.healthMax);
}
{
  // needler supercombine
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 6, 0);
  w.player.weapons[0] = { id: 'needler', mag: 20, reserve: 40 };
  w.player.cur = 0;
  const t = spawn(w, 'trooper', 6, -8);
  aimAt(w, t.x, t.y + 1.2, t.z);
  let sc = false;
  run(w, 2, (i) => { for (const e of w.events) if (e.type === 'supercombine') sc = true; w.events.length = 0; return { fire: true, fireEdge: i === 0 }; });
  ok('shard needler supercombines on 7 shards', sc && t.dead);
}

// ---------------------------------------------------------------- vehicles
{
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  const mule = w.vehicles.find((v) => v.type === 'mule'), sliver = w.vehicles.find((v) => v.type === 'sliver');
  ok('proving grounds has a MULE and a SLIVER', !!mule && !!sliver);
  place(w, mule.x - 2.6, mule.z, 0);
  run(w, 0.5, { action: true });
  ok('hold ACTION beside the MULE takes the wheel', w.player.vehicle === mule.id && w.player.seat === 'driver', `vehicle=${w.player.vehicle} seat=${w.player.seat}`);
  const x0 = mule.x, z0 = mule.z;
  mule.yaw = Math.PI / 2; w.player.yaw = mule.yaw; // west: 80 m of open range
  run(w, 3, { my: 1 });
  const moved = Math.hypot(mule.x - x0, mule.z - z0);
  ok('the MULE drives forward (> 15 m in 3 s)', moved > 15, `${moved.toFixed(1)} m, speed ${mule.speed.toFixed(1)}`);
  ok('the player rides in the seat', Math.hypot(w.player.pos.x - mule.x, w.player.pos.z - mule.z) < 2.5);
  // Halo steering: look right, the nose follows
  const yaw0 = mule.yaw; w.player.yaw = mule.yaw - 1.2;
  run(w, 1.5, { my: 1 });
  ok('the MULE steers toward where you look', Math.abs(Math.atan2(Math.sin(mule.yaw - yaw0), Math.cos(mule.yaw - yaw0))) > 0.4, `turned ${(mule.yaw - yaw0).toFixed(2)} rad`);
  // splatter: line the MULE up on open ground, a skitter 12 m ahead
  mule.speed = 0; mule.vx = mule.vz = 0; mule.x = 10; mule.z = 14; mule.yaw = Math.PI / 2; mule.y = w.geo.terrainH(10, 14);
  w.player.yaw = mule.yaw;
  const fx = -Math.sin(mule.yaw), fz = -Math.cos(mule.yaw);
  const victim = spawn(w, 'skitter', mule.x + fx * 12, mule.z + fz * 12);
  run(w, 2.5, { my: 1 });
  ok('ramming a skitter at speed splatters it', victim.dead, `hp=${victim.hp.toFixed(0)} speed=${mule.speed.toFixed(1)} at (${mule.x.toFixed(1)}, ${mule.z.toFixed(1)}) victim (${victim.x.toFixed(1)}, ${victim.z.toFixed(1)})`);
  // gunner seat
  run(w, 1, { my: -1 }); mule.speed = 0; mule.vx = mule.vz = 0;
  run(w, 0.1, (i) => ({ swap: i === 0 }));
  ok('SWAP hops to the turret', w.player.seat === 'gunner');
  const tgt = spawn(w, 'skitter', mule.x + fx * 10, mule.z + fz * 10);
  aimAt(w, tgt.x, tgt.y + 0.7, tgt.z);
  run(w, 1.0, { fire: true });
  ok('the turret chaingun kills a skitter at 10 m', tgt.dead, `hp=${tgt.hp.toFixed(0)}`);
  run(w, 0.3, {}); run(w, 0.5, { action: true });
  ok('hold ACTION dismounts beside the vehicle', w.player.vehicle === null && Math.hypot(w.player.pos.x - mule.x, w.player.pos.z - mule.z) > 1.5 && Math.hypot(w.player.pos.x - mule.x, w.player.pos.z - mule.z) < 5, `d=${Math.hypot(w.player.pos.x - mule.x, w.player.pos.z - mule.z).toFixed(1)}`);
  // sliver: boost and cannons
  run(w, 0.3, {});
  place(w, sliver.x - 2.2, sliver.z, 0);
  run(w, 0.5, { action: true });
  ok('the SLIVER can be ridden', w.player.vehicle === sliver.id, `vehicle=${w.player.vehicle} prompt=${JSON.stringify(w.player.prompt)}`);
  sliver.yaw = Math.PI / 2; w.player.yaw = sliver.yaw;
  run(w, 1.6, { my: 1 });
  const v1 = sliver.speed;
  run(w, 1.2, { my: 1, crouch: true });
  ok('boost pushes the SLIVER past its normal top speed', sliver.speed > v1 + 3 && sliver.boost < 1, `${v1.toFixed(1)} → ${sliver.speed.toFixed(1)} m/s, meter ${sliver.boost.toFixed(2)}`);
  const shots0 = w.shots.length;
  run(w, 0.3, { fire: true });
  ok('the SLIVER fires plasma bolts', w.shots.length > shots0 || w.stats.shots > 0);
  ok('the SLIVER hovers above the ground', sliver.y > w.geo.terrainH(sliver.x, sliver.z) + 0.3, `h=${(sliver.y - w.geo.terrainH(sliver.x, sliver.z)).toFixed(2)}`);
  // vehicle death ejects the player
  sliver.hp = 1;
  const g0 = w.grenades.length; void g0;
  damageEnemy; // (keep the import used)
  sliver.hp = 0; run(w, 0.05, {});
  ok('a destroyed vehicle throws the rider clear', w.player.vehicle === null && sliver.dead);
}
{
  // Vyrr riders: the gorge's a1 group spawns a Sliver under a trooper; killing the rider frees the bike
  const w = createWorld(L('gorge'), { difficulty: 'easy' });
  const rider = w.enemies.find((e) => e.riding);
  const bike = rider && w.vehicles.find((v) => v.id === rider.riding);
  ok('a Vyrr rider spawns on a Sliver', !!rider && !!bike && bike.occupant === rider.id);
  place(w, rider.x + 6, rider.z + 6);
  run(w, 3, {});
  ok('the AI bike moves on its own', Math.hypot(bike.vx, bike.vz) > 1 || Math.abs(bike.speed) > 1, `speed ${bike.speed.toFixed(1)}`);
  damageEnemy(w, rider, 9999, { kind: 'bullet', shieldMult: 1 });
  run(w, 2, {});
  ok('killing the rider leaves the bike free to take', rider.dead && bike.occupant === null && !bike.dead && Math.abs(bike.speed) < 1.5, `speed ${bike.speed.toFixed(1)}`);
}

// ---------------------------------------------------------------- every mission's script can finish
for (const id of ['fallen-hymn', 'cold-storage', 'gorge']) {
  const lv = L(id);
  const w = createWorld(lv, { difficulty: 'easy' });
  let steps = 0;
  for (let guard = 0; guard < 60 && w.mode !== 'won'; guard++) {
    const st = lv.sequence[w.seq.i];
    const u = st.until;
    // kill everything alive (a tester with god mode), then satisfy the step
    for (const e of w.enemies) if (!e.dead) damageEnemy(w, e, 9999, { kind: 'explosion', shieldMult: 1 });
    if (u.type === 'reach' || u.type === 'use') place(w, u.pos[0], u.pos[1]);
    if (u.type === 'destroy') for (const tid of u.targets) { const tg = w.targets.find((q) => q.id === tid); if (tg && !tg.locked) { tg.hp = 0; tg.dead = true; } for (const o of w.targets) if (o.lockedBy && o.lockedBy.every((q) => w.targets.find((z) => z.id === q)?.dead)) o.locked = false; }
    w.player.health = T.healthMax; w.player.shield = T.shieldMax;
    run(w, 0.5, { action: u.type === 'use' });
    steps++;
  }
  ok(`${lv.name}: the whole objective chain completes`, w.mode === 'won', `${w.seq.i + 1}/${lv.sequence.length} steps, ${steps} passes`);
}
{
  const w = createWorld(L('plaza'), {});
  run(w, 8, {});
  ok('firefight: wave 1 spawns', w.ff.wave === 1 && w.enemies.some((e) => e.group === 'ff'));
  for (const e of w.enemies) damageEnemy(w, e, 9999, { shieldMult: 1 });
  run(w, 8, {});
  ok('firefight: clearing a wave starts the next', w.ff.wave === 2);
}
{
  // look + aim assist: friction slows the stick over a target
  const w = createWorld(L('proving'), {}); clearEnemies(w);
  place(w, 0, 0);
  const t = spawn(w, 'trooper', 0, -15);
  aimAt(w, t.x, t.y + 1.4, t.z);
  const y0 = w.player.yaw;
  applyLook(w, 0.01, 0, true, DT);
  const assisted = Math.abs(w.player.yaw - y0);
  w.player.yaw = y0;
  applyLook(w, 0.01, 0, false, DT);
  const raw = Math.abs(w.player.yaw - y0);
  ok('aim assist friction slows the reticle over a target', assisted < raw * 0.8, `${assisted.toFixed(4)} vs ${raw.toFixed(4)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
