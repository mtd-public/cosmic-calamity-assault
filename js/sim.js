// The simulation. No DOM, no three.js, no audio: plain data in, plain data
// out, so tools/sim-check.mjs runs it in Node. The renderer, HUD and audio
// read `w` and drain `w.events` every frame.
//
//   createWorld(level, opts) → w
//   step(w, dt, input)          fixed 1/60 s steps
//   applyLook(w, dyaw, dpitch, assisted, dt)
//   restoreCheckpoint(w)
import { TUNING as T, DIFFICULTY } from './tuning.js';
import { WEAPONS, ENEMY_SHOTS, newWeaponState } from './weapons.js';
import { ENEMIES } from './enemies.js';
import { CollisionWorld, NavGrid, DEEP } from './world.js';
import { mulberry32 } from './utils.js';
import { VEHICLES, MOUNTED, ENEMY_VEHICLE_SHOTS } from './vehicles.js';

export const DT = 1 / 60;

// ------------------------------------------------------------ world
export function createWorld(level, opts = {}) {
  const geo = new CollisionWorld(level);
  const nav = new NavGrid(geo, level);
  const diff = DIFFICULTY.find((d) => d.id === opts.difficulty) || DIFFICULTY[1];
  const w = {
    level, geo, nav, diff, rng: mulberry32(opts.seed ?? 1234),
    t: 0, mode: 'play', deadT: 0, nextId: 1,
    player: null, enemies: [], shots: [], grenades: [], pickups: [], targets: [], respawns: [], vehicles: [],
    seq: { i: -1, used: false }, objective: '', waypoint: null, doorsOpen: [],
    stats: { kills: 0, shots: 0, hits: 0, heads: 0, deaths: 0, time: 0, score: 0 },
    ff: level.firefight ? { wave: 0, t: 5, pending: true } : null,
    flowT: 0, events: [], checkpoint: null, pendingCp: -1, assist: opts.assist !== false,
  };
  const ps = level.player;
  const p = w.player = {
    pos: { x: ps.pos[0], y: 0, z: ps.pos[1] }, prev: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: ps.yaw || 0, pitch: 0, kick: 0, onGround: true, crouch: 0,
    shield: T.shieldMax, health: T.healthMax, shieldT: 99, recharging: false,
    weapons: ps.loadout.map((id) => newWeaponState(id, level.infiniteReserve)), cur: 0,
    fireT: 0, burstLeft: 0, burstT: 0, reloadT: 0, switchT: 0.4, zoom: false, meleeT: 0, grenT: 0,
    gType: 'frag', grens: { frag: ps.frags ?? 2, plasma: ps.plasmas ?? 0 }, bloom: 0, charge: 0, chargeHeld: false,
    actT: 0, actLatched: false, aimId: 0, firedT: 9, hurtT: 9, needles: [], stuck: 0, deepT: 0, fallV: 0,
    prompt: null, moving: false, wadeT: 0, lastFire: false, vehicle: null, seat: null, rideT: 0,
  };
  p.pos.y = geo.groundAt(p.pos.x, p.pos.z, 200, T.radius, 400);
  p.prev = { ...p.pos };
  for (const pk of level.pickups || []) addPickup(w, pk);
  for (const v of level.vehicles || []) addVehicle(w, v);
  for (const tg of level.targets || []) {
    w.targets.push({ id: tg.id, pos: [...tg.pos], r: tg.r, h: tg.h, hp: tg.hp, maxHp: tg.hp, locked: !!tg.lockedBy, lockedBy: tg.lockedBy || null, dead: false, kind: tg.kind, splash: tg.splash || 6 });
  }
  startStep(w, 0);
  saveCheckpoint(w, true);
  return w;
}

function ev(w, type, data = {}) { w.events.push({ type, ...data }); }
const rnd = (w, a, b) => a + (b - a) * w.rng();
const irnd = (w, a, b) => Math.floor(rnd(w, a, b + 1));

export function aimDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}
export function eyePos(p) {
  const eye = T.eye + (T.crouchEye - T.eye) * p.crouch;
  return { x: p.pos.x, y: p.pos.y + eye, z: p.pos.z };
}
const pHeight = (p) => T.height + (T.crouchHeight - T.height) * p.crouch;

// ------------------------------------------------------------ pickups
function addPickup(w, pk) {
  const pos = { x: pk.pos[0], y: 0, z: pk.pos[pk.pos.length - 1] };
  pos.y = pk.pos.length === 3 ? pk.pos[1] : w.geo.groundAt(pos.x, pos.z, w.geo.terrainH(pos.x, pos.z) + 1.4, 0.2, 0);
  const o = { id: w.nextId++, type: pk.type, pos, respawn: pk.respawn || 0, spec: pk };
  if (pk.type === 'weapon') o.ws = pk.ws ? { ...pk.ws } : newWeaponState(pk.weapon, false);
  if (pk.type === 'grenade') { o.g = pk.g; o.n = pk.n || 2; }
  w.pickups.push(o);
  return o;
}

function dropWeapon(w, ws, x, y, z) {
  if (!ws) return;
  if (WEAPONS[ws.id].kind === 'plasma' && ws.battery <= 0) return;
  if (WEAPONS[ws.id].kind !== 'plasma' && ws.mag + ws.reserve <= 0) return;
  const pk = addPickup(w, { type: 'weapon', weapon: ws.id, ws, pos: [x, y, z] });
  pk.pos.y = w.geo.groundAt(x, z, y + 0.5, 0.2, 0.6);
  pk.dropped = true;
}

// ------------------------------------------------------------ enemies
function spawnEnemy(w, spec, group) {
  const d = ENEMIES[spec.t];
  const x = spec.p[0], z = spec.p[spec.p.length - 1];
  let y = spec.p.length === 3 ? spec.p[1] : w.geo.groundAt(x, z, w.geo.terrainH(x, z) + 1.35, d.radius, 0);
  if (d.fly) y = w.geo.terrainH(x, z) + (spec.p.length === 3 ? 0 : rnd(w, d.alt[0], d.alt[1]));
  if (spec.p.length === 3 && d.fly) y = spec.p[1];
  const hpMul = spec.t.startsWith('dummy') ? 1 : w.diff.hp;
  const e = {
    id: w.nextId++, type: spec.t, group, spec, x, y, z, vx: 0, vy: 0, vz: 0, yaw: spec.yaw ?? Math.PI, pitch: 0,
    hp: d.hp * hpMul, maxHp: d.hp * hpMul, shield: d.shield * hpMul, maxShield: d.shield * hpMul, shieldT: 99,
    weapon: spec.w || d.weapon, grenades: spec.g ?? (d.grenades || 0), perch: !!spec.perch || spec.p.length === 3,
    alert: false, sees: false, seeT: 0, lastSeen: null, reactT: 0, mode: 'idle', modeT: 0, moveDir: { x: 0, z: 0 },
    burstLeft: 0, fireT: 0, pauseT: rnd(w, 0.5, 1.5), meleeT: 0, windup: 0, dodgeT: 0, dodgeCd: 0, fleeT: 0,
    gCd: rnd(w, 4, 8), hideT: 0, dead: false, deadT: 0, dvx: 0, dvy: 0, dvz: 0, spin: 0, trackT: 9, hitT: 9,
    shieldHitT: 9, walk: 0, needles: [], stuck: 0, enrage: false, losT: 0, home: { x, z }, berserk: false, speedMul: 1,
    orbit: w.rng() < 0.5 ? 1 : -1, vx0: 0,
  };
  w.enemies.push(e);
  if (spec.ride && VEHICLES[spec.ride]) { // a Vyrr rider: spawn its bike under it
    const v = addVehicle(w, { type: spec.ride, pos: [x, z], yaw: e.yaw });
    v.occupant = e.id; v.seat = 'driver'; v.ai = { t: 0, orbit: w.rng() < 0.5 ? 1 : -1, mode: 'close' };
    e.riding = v.id; e.alert = true;
  }
  return e;
}

function spawnGroup(w, gid) {
  const g = w.level.groups?.[gid];
  if (!g) return;
  for (const spec of g) spawnEnemy(w, spec, gid);
}

function killEnemy(w, e, info) {
  e.dead = true; e.deadT = 0; e.hp = 0;
  const d = ENEMIES[e.type];
  const dir = info.dir || { x: 0, y: 0, z: 0 };
  const push = info.kind === 'explosion' ? 9 : info.kind === 'melee' ? 5 : 2.2;
  e.dvx = dir.x * push; e.dvz = dir.z * push; e.dvy = info.kind === 'explosion' ? 6 : 1.5;
  e.spin = (w.rng() - 0.5) * (info.kind === 'explosion' ? 10 : 3);
  w.stats.kills++;
  let pts = d.points;
  if (info.head) { w.stats.heads++; pts = Math.round(pts * 1.5); }
  w.stats.score += pts;
  ev(w, 'enemyDie', { id: e.id, etype: e.type, x: e.x, y: e.y, z: e.z, head: !!info.head, kind: info.kind, pts });
  if (e.riding) { const v = w.vehicles.find((q) => q.id === e.riding); if (v && v.occupant === e.id) { v.occupant = null; v.seat = null; v.ai = null; } e.riding = null; e.dvy = 3; }
  if (d.dummy) { w.respawns.push({ spec: e.spec, group: e.group, t: d.respawn }); return; }
  if (e.weapon && WEAPONS[e.weapon]) {
    const ws = newWeaponState(e.weapon);
    if (ws.battery !== undefined) ws.battery = Math.round(rnd(w, 25, 85));
    else { ws.mag = Math.ceil(ws.mag * rnd(w, 0.4, 1)); ws.reserve = Math.ceil(WEAPONS[e.weapon].mag * rnd(w, 0.5, 1.5)); }
    dropWeapon(w, ws, e.x + dir.x * 0.4, e.y + 0.3, e.z + dir.z * 0.4);
  }
  if (e.grenades > 0 && w.rng() < 0.6) addPickup(w, { type: 'grenade', g: 'plasma', n: 1, pos: [e.x + 0.4, e.y + 0.1, e.z - 0.3] });
  else if (e.type === 'skitter' && w.rng() < 0.35) addPickup(w, { type: 'grenade', g: 'plasma', n: 1, pos: [e.x - 0.3, e.y + 0.1, e.z + 0.3] });
  // A Trooper's death breaks nearby Skitters; a Bulwark's death enrages its partner.
  for (const o of w.enemies) {
    if (o.dead || o === e) continue;
    const dd = Math.hypot(o.x - e.x, o.z - e.z);
    if (e.type === 'trooper' && o.type === 'skitter' && dd < 14 && w.rng() < 0.75) { o.fleeT = rnd(w, 3, 5); ev(w, 'panic', { id: o.id, x: o.x, y: o.y, z: o.z }); }
    if (e.type === 'heavy' && o.type === 'heavy' && o.group === e.group && !o.enrage) { o.enrage = true; o.speedMul = 1.45; ev(w, 'enrage', { id: o.id, x: o.x, y: o.y, z: o.z }); }
  }
}

// dir: the direction the damage travels (from source toward the target).
export function damageEnemy(w, e, amount, o = {}) {
  if (e.dead) return false;
  const d = ENEMIES[e.type];
  e.alert = true; e.hitT = 0;
  if (!e.lastSeen) e.lastSeen = { x: w.player.pos.x, z: w.player.pos.z };
  let dmg = amount;
  if (e.shield > 0) {
    const s = dmg * (o.shieldMult ?? 1);
    e.shieldT = 0; e.shieldHitT = 0;
    if (s < e.shield) { e.shield -= s; ev(w, 'shieldHit', { id: e.id, x: o.px ?? e.x, y: o.py ?? e.y + 1, z: o.pz ?? e.z }); return false; }
    dmg = (s - e.shield) / (o.shieldMult ?? 1);
    e.shield = 0;
    ev(w, 'shieldPop', { id: e.id, x: e.x, y: e.y + d.height * 0.6, z: e.z });
    o.head = false; // the head shot that popped a shield does not also get the head bonus
  }
  e.shieldT = 0;
  if (o.head) dmg *= o.headMult ?? 1;
  if (d.armorFront && o.dir) {
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    const dot = -(o.dir.x * fx + o.dir.z * fz); // >0: the shot came from in front
    if (o.kind !== 'explosion') dmg *= dot > 0.35 ? d.armorFront : dot < -0.3 ? d.backMult : 1;
    if (dot > 0.35 && o.kind !== 'explosion') ev(w, 'armorHit', { id: e.id, x: o.px ?? e.x, y: o.py ?? e.y + 1.5, z: o.pz ?? e.z });
  }
  e.hp -= dmg;
  if (e.hp <= 0) { killEnemy(w, e, o); return true; }
  if (d.berserk && e.hp < e.maxHp * 0.3 && !e.berserk && w.rng() < 0.4) { e.berserk = true; ev(w, 'berserk', { id: e.id, x: e.x, y: e.y, z: e.z }); }
  return false;
}

function damageTarget(w, tg, amount) {
  if (tg.dead) return;
  if (tg.locked) { ev(w, 'shieldHit', { x: tg.pos[0], y: tg.pos[1] + tg.h * 0.5, z: tg.pos[2] }); return; }
  tg.hp -= amount;
  ev(w, 'targetHit', { id: tg.id });
  if (tg.hp <= 0) {
    tg.dead = true;
    ev(w, 'targetDestroyed', { id: tg.id, kind: tg.kind, x: tg.pos[0], y: tg.pos[1] + tg.h * 0.5, z: tg.pos[2] });
    explode(w, tg.pos[0], tg.pos[1] + tg.h * 0.5, tg.pos[2], tg.splash, 90, 'player', 'big');
    for (const o of w.targets) if (o.lockedBy && o.locked && o.lockedBy.every((id) => w.targets.find((q) => q.id === id)?.dead)) { o.locked = false; ev(w, 'targetUnlocked', { id: o.id }); }
  }
}

// ------------------------------------------------------------ player damage
export function damagePlayer(w, amount, o = {}) {
  const p = w.player;
  if (w.mode !== 'play') return;
  let dmg = amount * (o.raw ? 1 : w.diff.dmg);
  p.shieldT = 0; p.recharging = false; p.hurtT = 0;
  const hadShield = p.shield > 0;
  if (p.shield > 0) {
    const s = Math.min(p.shield, dmg);
    p.shield -= s; dmg -= s;
    if (p.shield <= 0 && hadShield) ev(w, 'shieldDown');
  }
  if (dmg > 0) p.health -= dmg;
  ev(w, 'playerHit', { from: o.from || null, shield: p.shield > 0, amount });
  if (p.health <= 0) {
    p.health = 0;
    w.mode = 'dead'; w.deadT = 0; w.stats.deaths++;
    ev(w, 'playerDie', { kind: o.kind || 'hit' });
  }
}

// ------------------------------------------------------------ explosions
function explode(w, x, y, z, radius, dmg, owner, kind = 'frag') {
  ev(w, 'explosion', { x, y, z, radius, kind });
  const geo = w.geo, p = w.player;
  // player
  const pc = { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z };
  let d = Math.hypot(pc.x - x, pc.y - y, pc.z - z);
  if (d < radius && geo.clear(x, y + 0.2, z, pc.x, pc.y, pc.z)) {
    const k = 1 - d / radius;
    damagePlayer(w, dmg * k * (owner === 'player' ? 0.6 : 1), { kind: 'explosion', from: { x, z }, raw: owner === 'player' });
    const L = d || 1;
    p.vel.x += ((pc.x - x) / L) * 7 * k; p.vel.z += ((pc.z - z) / L) * 7 * k; p.vel.y += 4 * k; p.onGround = false;
  }
  for (const e of w.enemies) {
    const ec = { x: e.x, y: e.y + ENEMIES[e.type].height * 0.5, z: e.z };
    d = Math.hypot(ec.x - x, ec.y - y, ec.z - z);
    if (e.dead) {
      if (d < radius * 1.3) { const k = 1 - d / (radius * 1.3), L = d || 1; e.dvx += ((ec.x - x) / L) * 10 * k; e.dvz += ((ec.z - z) / L) * 10 * k; e.dvy += 6 * k; e.spin += (w.rng() - 0.5) * 8 * k; }
      continue;
    }
    if (d > radius || !geo.clear(x, y + 0.2, z, ec.x, ec.y, ec.z)) continue;
    const k = 1 - d / radius, L = d || 1;
    const dir = { x: (ec.x - x) / L, y: 0, z: (ec.z - z) / L };
    const killed = damageEnemy(w, e, dmg * k * (owner === 'player' ? 1 : 0.6), { kind: 'explosion', dir, shieldMult: 1 });
    if (killed && owner === 'player') w.stats.hits++;
    if (!ENEMIES[e.type].fly && !killed) { e.vx += dir.x * 5 * k; e.vz += dir.z * 5 * k; }
  }
  for (const v of w.vehicles) {
    if (v.dead) continue;
    const vd = VEHICLES[v.type];
    d = Math.hypot(v.x - x, v.y + vd.height * 0.5 - y, v.z - z) - vd.radius * 0.7;
    if (d < radius) damageVehicle(w, v, dmg * (1 - Math.max(0, d) / radius) * (owner === 'player' ? 1 : 0.7), { kind: 'explosion', x, z });
  }
  for (const tg of w.targets) {
    if (tg.dead) continue;
    d = Math.hypot(tg.pos[0] - x, tg.pos[1] + tg.h * 0.5 - y, tg.pos[2] - z) - tg.r;
    if (d < radius && owner === 'player') damageTarget(w, tg, dmg * (1 - Math.max(0, d) / radius));
  }
  for (const g of w.grenades) if (!g.done && Math.hypot(g.x - x, g.y - y, g.z - z) < radius * 0.7) g.fuse = Math.min(g.fuse, 0.08 + w.rng() * 0.12);
}

// ------------------------------------------------------------ geometry helpers
// Closest distance between segment p→q and vertical segment (x, y0..y1, z). Returns {d2, s} (s along p→q in 0..1).
function segVertical(px, py, pz, qx, qy, qz, x, y0, y1, z) {
  const dx = qx - px, dz = qz - pz, L2 = dx * dx + dz * dz;
  let s = L2 > 1e-9 ? ((x - px) * dx + (z - pz) * dz) / L2 : 0;
  s = Math.max(0, Math.min(1, s));
  const cx = px + dx * s, cy = py + (qy - py) * s, cz = pz + dz * s;
  const yy = Math.max(y0, Math.min(y1, cy));
  return { d2: (cx - x) ** 2 + (cy - yy) ** 2 + (cz - z) ** 2, s };
}
function segSphere(px, py, pz, qx, qy, qz, x, y, z) {
  const dx = qx - px, dy = qy - py, dz = qz - pz, L2 = dx * dx + dy * dy + dz * dz;
  let s = L2 > 1e-9 ? ((x - px) * dx + (y - py) * dy + (z - pz) * dz) / L2 : 0;
  s = Math.max(0, Math.min(1, s));
  return { d2: (px + dx * s - x) ** 2 + (py + dy * s - y) ** 2 + (pz + dz * s - z) ** 2, s };
}

// First enemy / target hit along a segment. Returns {e|tg, s, head} or null.
function hitAlong(w, px, py, pz, qx, qy, qz, pad = 0) {
  let best = null;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const d = ENEMIES[e.type];
    const r = d.radius * (d.fly ? 1 : 0.85) + pad;
    const y0 = d.fly ? e.y - 0.3 : e.y + 0.1, y1 = d.fly ? e.y + 0.3 : e.y + (d.head ? d.head.y - d.head.r : d.height - 0.3);
    if (d.head) {
      const h = segSphere(px, py, pz, qx, qy, qz, e.x, e.y + d.head.y, e.z);
      if (h.d2 < (d.head.r + pad * 0.5) ** 2 && (!best || h.s < best.s)) best = { e, s: h.s, head: true };
    }
    const b = segVertical(px, py, pz, qx, qy, qz, e.x, y0, y1, e.z);
    if (b.d2 < r * r && (!best || b.s < best.s - 0.002)) best = { e, s: b.s, head: false };
  }
  for (const tg of w.targets) {
    if (tg.dead) continue;
    const b = segVertical(px, py, pz, qx, qy, qz, tg.pos[0], tg.pos[1], tg.pos[1] + tg.h, tg.pos[2]);
    if (b.d2 < tg.r * tg.r && (!best || b.s < best.s)) best = { tg, s: b.s };
  }
  return best;
}

// ------------------------------------------------------------ look + aim assist
export function applyLook(w, dyaw, dpitch, assisted, dt) {
  const p = w.player;
  if (w.mode !== 'play') return;
  if (assisted && w.assist) {
    const t = assistTarget(w);
    if (t) {
      dyaw *= T.assistFriction; dpitch *= T.assistFriction;
      // Magnetism: while you strafe or turn, the view drifts to keep the target.
      if (p.moving || Math.abs(dyaw) > 1e-4) {
        const k = Math.min(1, T.assistPull * dt / Math.max(1e-3, t.ang));
        dyaw += wrap(t.yaw - p.yaw) * k * 0.6;
        dpitch += (t.pitch - p.pitch) * k * 0.4;
      }
    }
  }
  p.yaw = wrap(p.yaw + dyaw);
  p.pitch = Math.max(-T.pitchLimit, Math.min(T.pitchLimit, p.pitch + dpitch));
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function assistTarget(w) {
  const p = w.player, eye = eyePos(p), ad = aimDir(p.yaw, p.pitch + p.kick);
  const ws = p.weapons[p.cur], range = ws ? WEAPONS[ws.id].range : 40;
  let best = null;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const d = ENEMIES[e.type];
    const cy = e.y + (d.head ? d.head.y - 0.35 : d.fly ? 0 : d.height * 0.6);
    const dx = e.x - eye.x, dy = cy - eye.y, dz = e.z - eye.z, L = Math.hypot(dx, dy, dz);
    if (L > range * 1.1 || L < 0.5) continue;
    const dot = (dx * ad.x + dy * ad.y + dz * ad.z) / L;
    const ang = Math.acos(Math.min(1, dot));
    const cone = T.assistAngle + Math.atan2(d.radius, L) * 0.8;
    if (ang > cone || (best && ang > best.ang)) continue;
    if (!w.geo.clear(eye.x, eye.y, eye.z, e.x, cy, e.z)) continue;
    best = { e, ang, yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / L) };
  }
  return best;
}

// ------------------------------------------------------------ main step
export function step(w, dt, input) {
  w.events.length = w.events.length > 400 ? 0 : w.events.length; // safety if nobody drains
  const p = w.player;
  p.prev.x = p.pos.x; p.prev.y = p.pos.y; p.prev.z = p.pos.z;
  if (w.mode === 'play') {
    w.t += dt; w.stats.time += dt;
    if (p.vehicle) stepRiding(w, dt, input);
    else { stepPlayer(w, dt, input); stepWeapons(w, dt, input); }
    stepInteract(w, dt, input);
  } else if (w.mode === 'dead') {
    w.deadT += dt;
  }
  stepVehicles(w, dt, input);
  w.flowT -= dt;
  if (w.flowT <= 0) { w.flowT = T.flowEvery; w.nav.flowFrom(w.nav.nearestWalk(p.pos.x, p.pos.z, 6)); }
  for (const e of w.enemies) stepEnemy(w, e, dt);
  if (w.enemies.length > 60) w.enemies = w.enemies.filter((e) => !e.dead || e.deadT < 20);
  else w.enemies = w.enemies.filter((e) => !e.dead || e.deadT < 45);
  stepShots(w, dt);
  stepGrenades(w, dt);
  for (let i = w.respawns.length - 1; i >= 0; i--) {
    const r = w.respawns[i];
    if ((r.t -= dt) > 0) continue;
    w.respawns.splice(i, 1);
    if (r.spec.type) addPickup(w, r.spec); else spawnEnemy(w, r.spec, r.group);
  }
  if (w.mode === 'play') { stepSequence(w, dt); if (w.ff) stepFirefight(w, dt); }
}

// ------------------------------------------------------------ player
function stepPlayer(w, dt, inp) {
  const p = w.player, geo = w.geo;
  // crouch (can't stand under a low ceiling)
  const wantCrouch = !!inp.crouch;
  const ceil = geo.ceilingAt(p.pos.x, p.pos.z, p.pos.y, T.radius);
  const canStand = ceil - p.pos.y >= T.height;
  const target = wantCrouch || !canStand ? 1 : 0;
  p.crouch += Math.sign(target - p.crouch) * Math.min(Math.abs(target - p.crouch), dt * 7);

  // move
  let mx = inp.mx || 0, my = inp.my || 0;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const wx = -s * my + c * mx, wz = -c * my - s * mx;
  let speed = T.walkSpeed + (T.crouchSpeed - T.walkSpeed) * p.crouch;
  const water = waterAt(w, p.pos.x, p.pos.z);
  const depth = water ? water.y - p.pos.y : 0;
  if (depth > 0.3) speed *= depth > DEEP ? 0.45 : 0.72;
  p.moving = ml > 0.15;
  const acc = (p.onGround ? T.accel : T.accel * T.airControl) * dt;
  const k = Math.min(1, acc);
  if (p.onGround || ml > 0.05) {
    p.vel.x += (wx * speed - p.vel.x) * k;
    p.vel.z += (wz * speed - p.vel.z) * k;
  }
  if (inp.jump && p.onGround && p.crouch < 0.5) { p.vel.y = T.jumpVel * (depth > DEEP ? 0.6 : 1); p.onGround = false; ev(w, 'jump'); }

  // steep terrain: slide down
  const ox = p.pos.x, oz = p.pos.z, oy = p.pos.y;
  const tH = geo.terrainH(ox, oz);
  if (p.onGround && Math.abs(oy - tH) < 0.05) {
    const sl = geo.terrainSlope(ox, oz);
    if (sl.m > T.maxSlope) { p.vel.x -= sl.gx * 14 * dt; p.vel.z -= sl.gz * 14 * dt; }
  }

  // horizontal, then walls
  const np = { x: ox + p.vel.x * dt, z: oz + p.vel.z * dt };
  const head = oy + pHeight(p);
  geo.resolve(np, T.radius, oy, head);
  // terrain cliffs block like walls
  const nH = geo.terrainH(np.x, np.z);
  if (nH > oy + 0.02) {
    const sl = geo.terrainSlope(np.x, np.z);
    if (sl.m > T.maxSlope || nH > oy + T.stepHeight) {
      // try each axis alone so you slide along the cliff
      const hx = geo.terrainH(np.x, oz), hz = geo.terrainH(ox, np.z);
      const okX = hx <= oy + 0.02 || (geo.terrainSlope(np.x, oz).m <= T.maxSlope && hx <= oy + T.stepHeight);
      const okZ = hz <= oy + 0.02 || (geo.terrainSlope(ox, np.z).m <= T.maxSlope && hz <= oy + T.stepHeight);
      if (!okX) { np.x = ox; p.vel.x *= 0.2; }
      if (!okZ) { np.z = oz; p.vel.z *= 0.2; }
    }
  }
  p.pos.x = np.x; p.pos.z = np.z;

  // vertical
  p.vel.y -= T.gravity * dt;
  let ny = oy + p.vel.y * dt;
  const g = geo.groundAt(p.pos.x, p.pos.z, oy, T.radius);
  const wasGround = p.onGround;
  if (ny <= g) {
    if (!wasGround || p.vel.y < -3) {
      const impact = -p.vel.y;
      if (impact > T.fallKillSpeed) damagePlayer(w, 999, { raw: true, kind: 'fall' });
      else if (impact > T.fallDamageSpeed) damagePlayer(w, (impact - T.fallDamageSpeed) * 9, { raw: true, kind: 'fall' });
      if (impact > 4) ev(w, 'land', { v: impact });
    }
    ny = g; p.vel.y = 0; p.onGround = true;
  } else if (wasGround && p.vel.y <= 0 && oy - g <= T.stepHeight + 0.05) {
    ny = g; p.vel.y = 0; p.onGround = true; // walk down steps and slopes without hopping
  } else {
    p.onGround = false;
  }
  const c2 = geo.ceilingAt(p.pos.x, p.pos.z, ny, T.radius);
  if (ny + pHeight(p) > c2 && p.vel.y > 0) { p.vel.y = 0; ny = Math.max(g, c2 - pHeight(p)); }
  p.pos.y = ny;

  // water
  if (water && water.y - p.pos.y > DEEP) {
    p.deepT += dt;
    if (p.deepT > 0.6) { damagePlayer(w, 16 * dt, { raw: true, kind: 'drown' }); if (Math.floor(p.deepT * 2) !== Math.floor((p.deepT - dt) * 2)) ev(w, 'deepWater'); }
  } else p.deepT = 0;
  if (water && water.y > p.pos.y && ml > 0.2) { p.wadeT -= dt; if (p.wadeT <= 0) { p.wadeT = 0.35; ev(w, 'splash', { x: p.pos.x, y: water.y, z: p.pos.z, small: true }); } }
  if (p.pos.y < geo.killY) damagePlayer(w, 999, { raw: true, kind: 'fall' });

  // shield recharge
  p.shieldT += dt;
  if (p.shieldT > T.shieldDelay * w.diff.shieldDelay && p.shield < T.shieldMax) {
    if (!p.recharging) { p.recharging = true; ev(w, 'shieldRecharge'); }
    p.shield = Math.min(T.shieldMax, p.shield + T.shieldRate * dt);
  } else if (p.shield >= T.shieldMax) p.recharging = false;
  p.kick *= Math.exp(-9 * dt);
  p.hurtT += dt; p.firedT += dt;

  // stuck needles on the player
  p.needles = p.needles.filter((t) => w.t - t < 2);
}

function waterAt(w, x, z) {
  for (const wt of w.level.water || []) if (x > wt.x0 && x < wt.x1 && z > wt.z0 && z < wt.z1) return wt;
  return null;
}

// ------------------------------------------------------------ player weapons
function stepWeapons(w, dt, inp) {
  const p = w.player;
  const ws = p.weapons[p.cur];
  p.fireT -= dt; p.meleeT -= dt; p.grenT -= dt; p.switchT -= dt;
  p.bloom = Math.max(0, p.bloom - dt * 0.09);
  if (inp.zoom) {
    if (ws && WEAPONS[ws.id].zoom) { p.zoom = !p.zoom; ev(w, 'zoom', { on: p.zoom }); }
  }
  if (p.hurtT < 0.05 && p.zoom && p.shield <= 0) p.zoom = false; // Halo: taking damage knocks you out of scope

  // switch weapons (Y / Tab / 1-2 / wheel)
  if (inp.swap && p.weapons.length > 1 && p.meleeT < 0.4) {
    p.cur = (p.cur + 1) % p.weapons.length;
    p.switchT = 0.45; p.reloadT = 0; p.zoom = false; p.burstLeft = 0; p.charge = 0;
    ev(w, 'switch', { id: p.weapons[p.cur].id });
    return;
  }
  // grenade type
  if (inp.gswitch) {
    const other = p.gType === 'frag' ? 'plasma' : 'frag';
    if (p.grens[other] > 0 || p.grens[p.gType] === 0) { p.gType = other; ev(w, 'gswitch', { g: other }); }
  }
  // grenade throw
  if (inp.grenade && p.grenT <= 0 && p.meleeT <= 0.3) {
    if (p.grens[p.gType] <= 0) { const other = p.gType === 'frag' ? 'plasma' : 'frag'; if (p.grens[other] > 0) p.gType = other; }
    if (p.grens[p.gType] > 0) {
      p.grens[p.gType]--; p.grenT = T.grenadeCooldown; p.fireT = Math.max(p.fireT, 0.45); p.zoom = false;
      const eye = eyePos(p), d = aimDir(p.yaw, p.pitch + 0.12);
      w.grenades.push({ id: w.nextId++, g: p.gType, owner: 'player', x: eye.x + d.x * 0.6, y: eye.y + d.y * 0.6 - 0.1, z: eye.z + d.z * 0.6,
        vx: d.x * T.throwSpeed + p.vel.x * 0.5, vy: d.y * T.throwSpeed + T.throwUp, vz: d.z * T.throwSpeed + p.vel.z * 0.5,
        fuse: p.gType === 'frag' ? T.fragFuse : T.plasmaFuse, stuck: null, lit: p.gType === 'plasma', done: false, bounces: 0 });
      ev(w, 'throw', { g: p.gType });
    }
  }
  // melee
  if (inp.melee && p.meleeT <= 0) { doMelee(w); return; }
  if (!ws) return;
  const d = WEAPONS[ws.id];
  const busy = p.switchT > 0 || p.meleeT > T.meleeCooldown - 0.35 || p.grenT > T.grenadeCooldown - 0.35;

  if (d.kind === 'plasma') {
    ws.vent = Math.max(0, ws.vent - dt);
    if (p.firedT > 0.18 && !ws.vent) ws.heat = Math.max(0, ws.heat - d.cool * dt);
    if (ws.vent > 0) { p.charge = 0; return; }
    const ready = p.fireT <= 0 && !busy && ws.battery > 0;
    if (d.charge) {
      if (inp.fireEdge && ready) { firePlasma(w, ws, d, false); p.chargeHeld = true; p.charge = 0; }
      if (inp.fire && p.chargeHeld && ws.battery > 0) {
        p.charge += dt;
        if (p.charge > d.charge.time && !p.chargeFull) { p.chargeFull = true; ev(w, 'charged'); }
      }
      if (!inp.fire && p.chargeHeld) {
        if (p.charge >= d.charge.time && !busy) firePlasma(w, ws, d, true);
        p.chargeHeld = false; p.charge = 0; p.chargeFull = false;
      }
    } else if ((inp.fire || inp.fireEdge) && (d.auto || inp.fireEdge) && ready) firePlasma(w, ws, d, false);
    if (ws.battery <= 0 && inp.fireEdge) ev(w, 'dry');
    return;
  }

  // ballistic
  if (p.reloadT > 0) {
    if (d.shellReload && inp.fireEdge && ws.mag > 0) { p.reloadT = 0; ev(w, 'reloadCancel'); }
    else {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        if (d.shellReload) {
          if (ws.reserve > 0 && ws.mag < d.mag) { ws.mag++; if (!w.level.infiniteReserve) ws.reserve--; ev(w, 'shell'); }
          if (ws.mag < d.mag && ws.reserve > 0) p.reloadT = d.reload;
          else p.reloadT = 0;
        } else {
          const need = d.mag - ws.mag, take = Math.min(need, ws.reserve);
          ws.mag += take; if (!w.level.infiniteReserve) ws.reserve -= take;
          p.reloadT = 0;
        }
      }
      if (p.reloadT > 0 || !d.shellReload) return;
    }
  }
  const wantReload = inp.reload || (ws.mag === 0 && ws.reserve > 0 && p.fireT <= 0 && p.burstLeft <= 0);
  if (wantReload && ws.mag < d.mag && ws.reserve > 0 && !busy) {
    p.reloadT = d.shellReload ? d.reload + 0.25 : d.reload; p.zoom = false; p.burstLeft = 0;
    ev(w, 'reload', { id: ws.id });
    return;
  }
  // bursts continue on their own
  if (p.burstLeft > 0) {
    p.burstT -= dt;
    if (p.burstT <= 0 && ws.mag > 0) { fireBallistic(w, ws, d); p.burstLeft--; p.burstT = d.burstGap; }
    if (ws.mag <= 0) p.burstLeft = 0;
    return;
  }
  if ((inp.fire || inp.fireEdge) && (d.auto || inp.fireEdge) && p.fireT <= 0 && !busy) {
    if (ws.mag > 0) {
      p.fireT = d.rate;
      if (d.burst) { p.burstLeft = d.burst - 1; p.burstT = d.burstGap; fireBallistic(w, ws, d); }
      else fireBallistic(w, ws, d);
    } else if (inp.fireEdge) ev(w, 'dry');
  }
}

function spreadDir(w, base, cone) {
  if (cone <= 0) return base;
  // random point in a cone: an orthonormal basis (u, v) around the aim
  const up = Math.abs(base.y) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let ux = base.y * up[2] - base.z * up[1], uy = base.z * up[0] - base.x * up[2], uz = base.x * up[1] - base.y * up[0];
  const uL = Math.hypot(ux, uy, uz) || 1; ux /= uL; uy /= uL; uz /= uL;
  const vx = uy * base.z - uz * base.y, vy = uz * base.x - ux * base.z, vz = ux * base.y - uy * base.x;
  const a = w.rng() * Math.PI * 2, r = Math.sqrt(w.rng()) * cone;
  const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
  const dx = base.x + ux * cx + vx * cy, dy = base.y + uy * cx + vy * cy, dz = base.z + uz * cx + vz * cy, L = Math.hypot(dx, dy, dz);
  return { x: dx / L, y: dy / L, z: dz / L };
}

function fireBallistic(w, ws, d) {
  const p = w.player;
  ws.mag--; w.stats.shots++;
  p.firedT = 0;
  const eye = eyePos(p), base = aimDir(p.yaw, p.pitch + p.kick);
  const cone = (d.spread + p.bloom) * (p.zoom ? 0.5 : 1) * (p.crouch > 0.5 ? 0.8 : 1);
  p.bloom = Math.min(d.bloomMax || 0, p.bloom + (d.bloom || 0));
  p.kick += d.recoil;
  ev(w, 'fire', { id: ws.id });
  alertByNoise(w, eye.x, eye.z, T.hearRange);
  if (d.projectile) {
    const dir = spreadDir(w, base, cone);
    const homing = d.homing ? findHomingTarget(w, eye, dir, 0.35) : null;
    w.shots.push(makeShot(w, 'player', ws.id, eye, dir, d.speed, d.damage, { color: d.color, homing: d.homing || 0, target: homing, gravity: d.gravity || 0, splash: d.splash, shieldMult: d.shieldMult, needle: !!d.supercombine, size: ws.id === 'lance' ? 0.35 : 0.13 }));
    return;
  }
  let anyHit = false;
  for (let i = 0; i < d.pellets; i++) {
    let dir = spreadDir(w, base, cone);
    // bullet magnetism (gamepad/touch): bend a near-miss onto the target
    if (w.assist && p.assisted && d.pellets === 1) {
      const t = assistTarget(w);
      if (t && t.ang < T.magnetism + Math.atan2(ENEMIES[t.e.type].radius, 20) * 0.3) {
        const ed = ENEMIES[t.e.type];
        const ty = t.e.y + (ed.head ? ed.head.y - 0.35 : ed.fly ? 0 : ed.height * 0.55);
        const dx = t.e.x - eye.x, dy = ty - eye.y, dz = t.e.z - eye.z, L = Math.hypot(dx, dy, dz);
        const want = { x: dx / L, y: dy / L, z: dz / L };
        dir = spreadDir(w, want, cone * 0.35);
      }
    }
    if (hitscan(w, eye, dir, d, i === 0)) anyHit = true;
  }
  if (anyHit) w.stats.hits++;
}

const dmg0 = (d, endT) => (d.falloff && endT > d.falloff ? d.damage * Math.max(0.15, 1 - (endT - d.falloff) / (d.range - d.falloff)) : d.damage);
// First vehicle (other than `skip`) hit along a segment: {v, s} or null.
function vehicleAlong(w, px, py, pz, qx, qy, qz, skip) {
  let best = null;
  for (const v of w.vehicles) {
    if (v.dead || v.id === skip) continue;
    const vd = VEHICLES[v.type];
    const b = segSphere(px, py, pz, qx, qy, qz, v.x, v.y + vd.height * 0.5, v.z);
    if (b.d2 < (vd.radius * 0.95) ** 2 && (!best || b.s < best.s)) best = { v, s: b.s };
  }
  return best;
}
function hitscan(w, eye, dir, d, tracer) {
  const wh = w.geo.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, d.range);
  const maxT = wh ? wh.t : d.range;
  const qx = eye.x + dir.x * maxT, qy = eye.y + dir.y * maxT, qz = eye.z + dir.z * maxT;
  let h = hitAlong(w, eye.x, eye.y, eye.z, qx, qy, qz);
  const vh = vehicleAlong(w, eye.x, eye.y, eye.z, qx, qy, qz, w.player.vehicle);
  if (vh && (!h || vh.s < h.s)) h = vh;
  const endT = h ? h.s * maxT : maxT;
  const hx = eye.x + dir.x * endT, hy = eye.y + dir.y * endT, hz = eye.z + dir.z * endT;
  if (tracer) ev(w, 'tracer', { x0: eye.x, y0: eye.y, z0: eye.z, x: hx, y: hy, z: hz, weapon: d.sound });
  if (h && h.v) { damageVehicle(w, h.v, dmg0(d, endT), { kind: 'bullet' }); ev(w, 'impact', { x: hx, y: hy, z: hz, surface: 'armor', n: [0, 1, 0] }); return true; }
  if (h) {
    let dmg = d.damage;
    if (d.falloff && endT > d.falloff) dmg *= Math.max(0.15, 1 - (endT - d.falloff) / (d.range - d.falloff));
    if (h.e) {
      const wasShield = h.e.shield > 0;
      damageEnemy(w, h.e, dmg, { dir, head: h.head, headMult: d.headMult, shieldMult: d.shieldMult, kind: 'bullet', px: hx, py: hy, pz: hz });
      ev(w, 'impact', { x: hx, y: hy, z: hz, surface: wasShield ? 'shield' : ENEMIES[h.e.type].armorFront ? 'armor' : 'flesh', etype: h.e.type, dir });
    } else if (h.tg) { damageTarget(w, h.tg, dmg); ev(w, 'impact', { x: hx, y: hy, z: hz, surface: 'alien' }); }
    return true;
  }
  if (wh) ev(w, 'impact', { x: hx, y: hy, z: hz, n: wh.n, surface: wh.terrain ? 'dirt' : wh.box?.mat || 'metal', decal: true });
  return false;
}

function firePlasma(w, ws, d, charged) {
  const p = w.player;
  const c = charged ? d.charge : null;
  p.fireT = charged ? 0.5 : d.rate;
  ws.battery = Math.max(0, ws.battery - (c ? c.perShot : d.perShot));
  ws.heat += charged ? 0.35 : d.heatPerShot;
  if (ws.heat >= 1) { ws.heat = 1; ws.vent = d.ventTime; ev(w, 'overheat', { id: ws.id }); }
  p.firedT = 0; w.stats.shots++; p.kick += d.recoil * (charged ? 3 : 1);
  const eye = eyePos(p), base = aimDir(p.yaw, p.pitch + p.kick);
  const dir = spreadDir(w, base, d.spread * (p.zoom ? 0.5 : 1));
  const target = charged ? findHomingTarget(w, eye, dir, 0.5) : null;
  w.shots.push(makeShot(w, 'player', ws.id, eye, dir, c ? c.speed : d.speed, c ? c.damage : d.damage, { color: d.color, homing: c ? c.homing : 0, target, shieldMult: c ? c.shieldMult : d.shieldMult, charged, size: charged ? 0.45 : 0.16 }));
  ev(w, 'fire', { id: ws.id, charged });
  alertByNoise(w, eye.x, eye.z, T.hearRange * 0.8);
}

function findHomingTarget(w, eye, dir, cone) {
  let best = null, ba = cone;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const ed = ENEMIES[e.type];
    const cy = e.y + (ed.fly ? 0 : ed.height * 0.55);
    const dx = e.x - eye.x, dy = cy - eye.y, dz = e.z - eye.z, L = Math.hypot(dx, dy, dz);
    if (L > 45) continue;
    const a = Math.acos(Math.min(1, (dx * dir.x + dy * dir.y + dz * dir.z) / L));
    if (a < ba && w.geo.clear(eye.x, eye.y, eye.z, e.x, cy, e.z)) { ba = a; best = e.id; }
  }
  return best;
}

function makeShot(w, owner, wid, from, dir, speed, dmg, o = {}) {
  return { id: w.nextId++, owner, wid, x: from.x + dir.x * 0.5, y: from.y + dir.y * 0.5 - 0.08, z: from.z + dir.z * 0.5,
    vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed, speed, dmg, life: 3.5, ...o };
}

function doMelee(w) {
  const p = w.player;
  p.meleeT = T.meleeCooldown; p.reloadT = 0; p.zoom = false; p.burstLeft = 0;
  const eye = eyePos(p), fwd = aimDir(p.yaw, 0);
  let best = null, bd = T.meleeRange + T.meleeLunge;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const ed = ENEMIES[e.type];
    const dx = e.x - p.pos.x, dz = e.z - p.pos.z, dy = (e.y + (ed.fly ? 0 : ed.height * 0.5)) - eye.y;
    const L = Math.hypot(dx, dz) - ed.radius;
    if (L > bd || Math.abs(dy) > 2.2) continue;
    const dot = (dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1);
    if (dot < 0.8) continue;
    if (!w.geo.clear(eye.x, eye.y, eye.z, e.x, e.y + (ed.fly ? 0 : ed.height * 0.6), e.z)) continue;
    bd = L; best = e;
  }
  if (!best) {
    for (const tg of w.targets) {
      if (tg.dead) continue;
      const dx = tg.pos[0] - p.pos.x, dz = tg.pos[2] - p.pos.z, L = Math.hypot(dx, dz) - tg.r;
      if (L < T.meleeRange && (dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1) > 0.7) { damageTarget(w, tg, T.meleeDamage * 0.5); ev(w, 'melee', { hit: true }); return; }
    }
    ev(w, 'melee', { hit: false });
    return;
  }
  const ed = ENEMIES[best.type];
  if (bd > T.meleeRange) { // lunge
    const dx = best.x - p.pos.x, dz = best.z - p.pos.z, L = Math.hypot(dx, dz) || 1;
    p.vel.x = (dx / L) * 14; p.vel.z = (dz / L) * 14;
  }
  const dir = { x: fwd.x, y: 0, z: fwd.z };
  // from behind = assassination (Halo 2 back-smack)
  const bx = -Math.sin(best.yaw), bz = -Math.cos(best.yaw);
  const behind = bx * dir.x + bz * dir.z > 0.55 && !ed.armorFront;
  const amount = behind ? 999 : T.meleeDamage;
  const wasShield = best.shield > 0;
  if (behind) best.shield = 0;
  damageEnemy(w, best, amount, { dir, kind: 'melee', shieldMult: 1 });
  ev(w, 'melee', { hit: true, behind, x: best.x, y: best.y + ed.height * 0.6, z: best.z, shield: wasShield });
}

function alertByNoise(w, x, z, r) {
  for (const e of w.enemies) {
    if (e.dead || e.alert || ENEMIES[e.type].dummy) continue;
    if (Math.hypot(e.x - x, e.z - z) < r) alertEnemy(w, e);
  }
}

function alertEnemy(w, e) {
  if (e.alert) return;
  e.alert = true;
  e.reactT = rnd(w, ...(ENEMIES[e.type].react || [0.5, 1]));
  e.lastSeen = { x: w.player.pos.x, z: w.player.pos.z };
  ev(w, 'alert', { id: e.id, etype: e.type, x: e.x, y: e.y, z: e.z });
  for (const o of w.enemies) if (!o.dead && !o.alert && !ENEMIES[o.type].dummy && Math.hypot(o.x - e.x, o.z - e.z) < T.alertShare) {
    o.alert = true; o.reactT = rnd(w, 0.6, 1.4); o.lastSeen = { ...e.lastSeen };
  }
}

// ------------------------------------------------------------ pickups + use
function stepInteract(w, dt, inp) {
  const p = w.player;
  p.prompt = null;
  let swapTarget = null, sd = 1.6;
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const pk = w.pickups[i];
    const d = Math.hypot(pk.pos.x - p.pos.x, pk.pos.z - p.pos.z);
    if (d > 1.7 || Math.abs(pk.pos.y - p.pos.y) > 1.6) continue;
    if (pk.type === 'health') {
      if (d < 1.2 && p.health < T.healthMax) { p.health = T.healthMax; takePickup(w, i); ev(w, 'pickup', { what: 'health' }); }
      continue;
    }
    if (pk.type === 'grenade') {
      if (d < 1.2 && p.grens[pk.g] < T.gMaxEach) {
        const n = Math.min(pk.n, T.gMaxEach - p.grens[pk.g]);
        p.grens[pk.g] += n; pk.n -= n;
        ev(w, 'pickup', { what: pk.g === 'frag' ? 'frag grenade' : 'plasma grenade', n });
        if (pk.n <= 0) takePickup(w, i);
      }
      continue;
    }
    // weapons
    const def = WEAPONS[pk.ws.id];
    const have = p.weapons.find((x) => x.id === pk.ws.id);
    if (have) {
      if (def.kind !== 'plasma' && d < 1.3 && have.reserve < def.reserveMax) {
        const pool = pk.ws.mag + pk.ws.reserve, take = Math.min(pool, def.reserveMax - have.reserve);
        if (take > 0) {
          have.reserve += take;
          let left = take;
          const fromRes = Math.min(pk.ws.reserve, left); pk.ws.reserve -= fromRes; left -= fromRes; pk.ws.mag -= left;
          ev(w, 'pickup', { what: `${def.short} ammo`, ammo: true });
          if (pk.ws.mag + pk.ws.reserve <= 0) takePickup(w, i);
        }
      }
      continue;
    }
    if (p.weapons.length < 2) {
      p.weapons.push({ ...pk.ws }); takePickup(w, i);
      ev(w, 'pickup', { what: def.short, weapon: true });
      continue;
    }
    if (d < sd) { sd = d; swapTarget = pk; }
  }
  // use points: the current sequence step's 'use', and test-map spawn pads
  let useTarget = null;
  const st = w.level.sequence?.[w.seq.i];
  if (st?.until?.type === 'use' && !w.seq.used) {
    const u = st.until;
    if (Math.hypot(p.pos.x - u.pos[0], p.pos.z - u.pos[1]) < (u.r || 2)) useTarget = { label: u.label, fn: () => { w.seq.used = true; ev(w, 'use', { label: u.label }); } };
  }
  for (const pad of w.level.spawnPads || []) {
    if (Math.hypot(p.pos.x - pad.pos[0], p.pos.z - pad.pos[1]) < 1.8) {
      useTarget = { label: pad.label, fn: () => { for (const s of pad.spawn) spawnEnemy(w, s, 'pad').alert = true; ev(w, 'use', { label: pad.label }); } };
    }
  }
  // vehicles: the nearest free seat, or the exit when riding
  if (p.vehicle) {
    useTarget = { label: 'EXIT', fn: () => exitVehicle(w) };
    swapTarget = null;
  } else {
    let bv = null, bd = 99;
    for (const v of w.vehicles) {
      if (v.dead || typeof v.occupant === 'number') continue;
      const vd = VEHICLES[v.type];
      const dd = Math.hypot(v.x - p.pos.x, v.z - p.pos.z) - vd.radius;
      if (dd < 1.8 && dd < bd && Math.abs(v.y - p.pos.y) < 2.5) { bd = dd; bv = v; }
    }
    if (bv) {
      const vd = VEHICLES[bv.type];
      const seat = bv.occupant === 'player' ? null : (vd.seats.driver && !(bv.occupant === 'player' && bv.seat === 'driver') ? 'driver' : 'gunner');
      // prefer the turret when you approach the back of a MULE
      const bx = -Math.sin(bv.yaw), bz = -Math.cos(bv.yaw), behind = (p.pos.x - bv.x) * bx + (p.pos.z - bv.z) * bz < -0.8;
      const pick = vd.seats.gunner && behind ? 'gunner' : seat;
      if (pick) { useTarget = { label: vd.seats[pick].label, fn: () => enterVehicle(w, bv, pick) }; swapTarget = null; }
    }
  }
  const held = !!inp.action;
  if (useTarget) p.prompt = { verb: 'hold', label: useTarget.label };
  else if (swapTarget) p.prompt = { verb: 'hold', label: `PICK UP ${WEAPONS[swapTarget.ws.id].short}` };
  if (held) p.actT += dt; else { p.actT = 0; p.actLatched = false; }
  if (held && p.actT > 0.18 && !p.actLatched) {
    if (useTarget) { p.actLatched = true; useTarget.fn(); }
    else if (swapTarget) {
      p.actLatched = true;
      const cur = p.weapons[p.cur];
      p.weapons[p.cur] = { ...swapTarget.ws };
      w.pickups.splice(w.pickups.indexOf(swapTarget), 1);
      dropWeapon(w, cur, p.pos.x, p.pos.y + 0.5, p.pos.z);
      p.switchT = 0.5; p.reloadT = 0; p.zoom = false; p.burstLeft = 0;
      ev(w, 'pickup', { what: WEAPONS[swapTarget.ws.id].short, weapon: true, swap: true });
    }
  }
}

function takePickup(w, i) {
  const pk = w.pickups[i];
  w.pickups.splice(i, 1);
  if (pk.respawn) w.respawns.push({ spec: { ...pk.spec, type: pk.type }, t: pk.respawn });
}

// ------------------------------------------------------------ enemy AI
function stepEnemy(w, e, dt) {
  const d = ENEMIES[e.type], geo = w.geo, p = w.player;
  if (e.dead) {
    e.deadT += dt;
    if (d.fly) { e.dvy -= 14 * dt; }
    else e.dvy -= 16 * dt;
    e.x += e.dvx * dt; e.z += e.dvz * dt; e.y += e.dvy * dt;
    const g = geo.groundAt(e.x, e.z, e.y + 0.3, 0.3, 0.6);
    if (e.y <= g) { e.y = g; e.dvy = 0; e.dvx *= Math.exp(-6 * dt); e.dvz *= Math.exp(-6 * dt); e.spin *= Math.exp(-5 * dt); }
    const q = { x: e.x, z: e.z };
    geo.resolve(q, 0.3, e.y, e.y + 0.4, 0.2);
    e.x = q.x; e.z = q.z;
    return;
  }
  e.hitT += dt; e.shieldHitT += dt; e.trackT += dt;
  if (e.riding) { // a rider: the bike carries it (stepVehicleAI drives, the seat sync is in stepVehicles)
    e.needles = e.needles.filter((t) => w.t - t < 2);
    if (d.shield) { e.shieldT += dt; if (e.shieldT > d.shieldDelay && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + d.shieldRate * dt); }
    const v = w.vehicles.find((q) => q.id === e.riding);
    if (!v || v.dead) { e.riding = null; return; }
    e.alert = true; e.sees = Math.hypot(p.pos.x - e.x, p.pos.z - e.z) < 60 && w.mode === 'play';
    if (e.sees) e.lastSeen = { x: p.pos.x, z: p.pos.z };
    e.trackT = 0;
    return;
  }
  // shield recharge
  if (d.shield) { e.shieldT += dt; if (e.shieldT > d.shieldDelay && e.shield < e.maxShield) { if (e.shield === 0) ev(w, 'enemyShieldUp', { id: e.id }); e.shield = Math.min(e.maxShield, e.shield + d.shieldRate * dt); } }
  e.needles = e.needles.filter((t) => w.t - t < 2);
  if (d.dummy) { faceToward(e, p.pos.x, p.pos.z, dt, 2); return; }
  if (w.mode !== 'play') { e.alert = e.alert && w.mode !== 'won'; }

  // perception (every ~0.15 s)
  const ey = e.y + (d.fly ? 0 : d.height * 0.85);
  const pe = eyePos(p);
  const dx = p.pos.x - e.x, dz = p.pos.z - e.z, dist = Math.hypot(dx, dz);
  e.losT -= dt;
  if (e.losT <= 0) {
    e.losT = 0.15 + w.rng() * 0.08;
    const inRange = dist < T.sightRange * (e.alert ? 1.3 : 1);
    let see = false;
    if (inRange && w.mode === 'play') {
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      const facing = (dx * fx + dz * fz) / (dist || 1);
      const crouchMul = p.crouch > 0.5 && !e.alert ? 0.55 : 1;
      if ((facing > -0.2 || e.alert || dist < 5) && dist < T.sightRange * crouchMul * (e.alert ? 1.3 : 1)) see = geo.clear(e.x, ey, e.z, pe.x, pe.y - 0.2, pe.z);
    }
    e.sees = see;
    if (see) { e.lastSeen = { x: p.pos.x, z: p.pos.z }; if (!e.alert) alertEnemy(w, e); }
  }
  if (e.sees) e.seeT += dt; else e.seeT = 0;
  if (!e.alert) { idleMove(w, e, d, dt); return; }
  if (e.reactT > 0) { e.reactT -= dt; faceToward(e, p.pos.x, p.pos.z, dt, 4); settle(w, e, d, dt, 0, 0); return; }

  // choose a movement mode
  e.modeT -= dt; e.dodgeT -= dt; e.dodgeCd -= dt; e.fleeT -= dt; e.meleeT -= dt; e.gCd -= dt;
  let mode = e.mode;
  const danger = w.grenades.find((g) => !g.done && g.owner === 'player' && Math.hypot(g.x - e.x, g.z - e.z) < (g.g === 'frag' ? T.fragRadius : T.plasmaRadius) + 1 && g.stuck !== e.id);
  if (e.stuck) mode = 'panic';
  else if (danger && !d.armorFront) { mode = 'evade'; e.evadeFrom = { x: danger.x, z: danger.z }; }
  else if (e.fleeT > 0 && d.flee) mode = 'flee';
  else if (e.berserk) mode = 'charge';
  else if (e.modeT <= 0 || mode === 'evade' || mode === 'flee' || mode === 'idle') {
    const [r0, r1] = d.range;
    const shieldDown = d.shield && e.shield <= 0;
    if (!e.sees && e.lastSeen) mode = 'hunt';
    else if (shieldDown && w.rng() < 0.55) mode = 'retreat';
    else if (dist > r1) mode = 'advance';
    else if (dist < r0) mode = w.rng() < 0.7 ? 'retreat' : 'strafe';
    else mode = ['strafe', 'strafe', 'hold', 'advance'][Math.floor(w.rng() * 4)];
    if (mode === 'strafe' && w.rng() < 0.5) e.orbit *= -1;
    e.modeT = rnd(w, 1.0, 2.4);
  }
  // Troopers dodge when you aim at them and fire (Halo Elites' side-step)
  if (d.dodge && e.dodgeCd <= 0 && p.firedT < 0.2 && e.sees) {
    const ad = aimDir(p.yaw, p.pitch);
    const tx = e.x - pe.x, ty = e.y + 1.2 - pe.y, tz = e.z - pe.z, L = Math.hypot(tx, ty, tz);
    if ((tx * ad.x + ty * ad.y + tz * ad.z) / L > 0.995 && w.rng() < d.dodge) { e.dodgeT = 0.35; e.orbit = w.rng() < 0.5 ? 1 : -1; ev(w, 'dodge', { id: e.id }); }
    e.dodgeCd = 0.9;
  }
  e.mode = mode;

  // movement vector
  let mx = 0, mz = 0, spd = d.speed * e.speedMul;
  const toP = { x: dx / (dist || 1), z: dz / (dist || 1) };
  const flow = (sign) => w.nav.stepDir(e.x, e.z, sign) || (sign < 0 ? toP : { x: -toP.x, z: -toP.z });
  if (d.fly) {
    stepDrone(w, e, d, dt, dist, toP);
  } else {
    if (e.dodgeT > 0) { mx = -toP.z * e.orbit; mz = toP.x * e.orbit; spd = 9; }
    else if (mode === 'advance' || mode === 'hunt' || mode === 'charge') {
      const f = e.sees && dist < 10 ? toP : flow(-1);
      mx = f.x; mz = f.z;
      if (mode === 'charge') spd *= 1.6;
      if (mode === 'hunt' && e.lastSeen && Math.hypot(e.lastSeen.x - e.x, e.lastSeen.z - e.z) < 2 && !e.sees) { e.lastSeen = null; e.modeT = 0; }
    } else if (mode === 'retreat') { const f = flow(1); mx = f.x; mz = f.z; spd *= 0.85; }
    else if (mode === 'strafe') { mx = -toP.z * e.orbit; mz = toP.x * e.orbit; spd *= 0.7; }
    else if (mode === 'flee' || mode === 'panic') {
      const f = mode === 'panic' ? { x: Math.sin(w.t * 3 + e.id), z: Math.cos(w.t * 2.3 + e.id) } : flow(1);
      mx = f.x; mz = f.z; spd *= 1.25;
    } else if (mode === 'evade') {
      const ax = e.x - e.evadeFrom.x, az = e.z - e.evadeFrom.z, L = Math.hypot(ax, az) || 1;
      mx = ax / L; mz = az / L; spd *= 1.3;
    }
    if (d.melee && dist < d.melee.range + 0.4 && mode !== 'flee' && w.mode === 'play') { mx = 0; mz = 0; }
    settle(w, e, d, dt, mx * spd, mz * spd);
    if (e.sees || mode === 'charge') faceToward(e, p.pos.x, p.pos.z, dt, 6);
    else if (Math.hypot(mx, mz) > 0.1) faceToward(e, e.x + mx, e.z + mz, dt, 5);
  }

  // melee
  if (d.melee && w.mode === 'play' && !e.stuck) {
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        e.meleeT = 1.2;
        if (dist < d.melee.range + 0.5 && Math.abs(p.pos.y - e.y) < 1.8) {
          damagePlayer(w, d.melee.dmg, { kind: 'melee', from: { x: e.x, z: e.z } });
          if (d.melee.knock) { p.vel.x += toP.x * d.melee.knock; p.vel.z += toP.z * d.melee.knock; p.vel.y = 4; p.onGround = false; }
          ev(w, 'enemyMelee', { id: e.id, hit: true, etype: e.type });
        } else ev(w, 'enemyMelee', { id: e.id, hit: false, etype: e.type });
      }
    } else if (dist < d.melee.range && e.meleeT <= 0 && mode !== 'flee' && Math.abs(p.pos.y - e.y) < 1.8) {
      e.windup = d.melee.windup;
      ev(w, 'enemyWindup', { id: e.id, etype: e.type });
    }
  }

  // shooting
  if (e.weapon && e.sees && mode !== 'flee' && mode !== 'panic' && e.windup <= 0 && w.mode === 'play' && dist > 1.5) {
    if (e.burstLeft > 0) {
      e.fireT -= dt;
      if (e.fireT <= 0) { enemyFire(w, e, d, dist); e.burstLeft--; e.fireT = d.burstGap; }
    } else {
      e.pauseT -= dt * w.diff.rof;
      if (e.pauseT <= 0) { e.burstLeft = irnd(w, d.burst[0], d.burst[1]); e.pauseT = rnd(w, d.pause[0], d.pause[1]); e.fireT = 0; }
    }
  }
  // grenades: flush you out of cover
  if (e.grenades > 0 && e.gCd <= 0 && dist > 6 && dist < 22 && e.lastSeen && w.mode === 'play' && (!e.sees || w.rng() < 0.15)) {
    e.gCd = rnd(w, 7, 12);
    if (w.rng() < 0.55) enemyThrow(w, e, d);
  }
}

function idleMove(w, e, d, dt) {
  if (d.fly) {
    const g = w.geo.terrainH(e.x, e.z);
    e.y += (g + (d.alt[0] + d.alt[1]) / 2 - e.y) * Math.min(1, dt) + Math.sin(w.t * 2 + e.id) * 0.01;
    e.yaw += dt * 0.4;
    return;
  }
  // idle: look around, shuffle a little on the spot
  e.yaw += Math.sin(w.t * 0.4 + e.id) * dt * 0.5;
  settle(w, e, d, dt, 0, 0);
}

function faceToward(e, x, z, dt, rate) {
  const want = Math.atan2(-(x - e.x), -(z - e.z));
  e.yaw += wrap(want - e.yaw) * Math.min(1, rate * dt);
}

// Move a walking enemy with walls, ledges and nav bounds.
function settle(w, e, d, dt, tvx, tvz) {
  const geo = w.geo;
  const k = Math.min(1, 8 * dt);
  e.vx += (tvx - e.vx) * k; e.vz += (tvz - e.vz) * k;
  const np = { x: e.x + e.vx * dt, z: e.z + e.vz * dt };
  geo.resolve(np, d.radius, e.y, e.y + d.height);
  // separation from other enemies
  for (const o of w.enemies) {
    if (o === e || o.dead || ENEMIES[o.type].fly) continue;
    const ox = np.x - o.x, oz = np.z - o.z, L = Math.hypot(ox, oz), min = d.radius + ENEMIES[o.type].radius;
    if (L < min && L > 1e-4) { np.x += (ox / L) * (min - L) * 0.5; np.z += (oz / L) * (min - L) * 0.5; }
  }
  // separation from vehicles (parked or moving)
  for (const v of w.vehicles) {
    if (e.riding === v.id) continue;
    const ox = np.x - v.x, oz = np.z - v.z, L = Math.hypot(ox, oz), min = d.radius + VEHICLES[v.type].radius * 0.9;
    if (L < min && L > 1e-4 && Math.abs(v.y - e.y) < 2) { np.x += (ox / L) * (min - L); np.z += (oz / L) * (min - L); }
  }
  // separation from the player
  const px = np.x - w.player.pos.x, pz = np.z - w.player.pos.z, pL = Math.hypot(px, pz), pmin = d.radius + T.radius;
  if (pL < pmin && pL > 1e-4 && Math.abs(w.player.pos.y - e.y) < 1.5) { np.x += (px / pL) * (pmin - pL); np.z += (pz / pL) * (pmin - pL); }
  const g = geo.groundAt(np.x, np.z, e.y, d.radius);
  const ok = e.perch ? g > e.y - 0.6 : (w.nav.walkableAt(np.x, np.z) || !w.nav.walkableAt(e.x, e.z)) && g > e.y - 1.2;
  const slope = geo.terrainSlope(np.x, np.z).m;
  if (ok && (slope < T.maxSlope || g > geo.terrainH(np.x, np.z) + 0.05)) {
    const moved = Math.hypot(np.x - e.x, np.z - e.z);
    e.walk += moved;
    if (moved > 0.01) e.trackT = 0;
    e.x = np.x; e.z = np.z;
  } else { e.vx *= -0.3; e.vz *= -0.3; e.modeT = 0; }
  const g2 = geo.groundAt(e.x, e.z, e.y, d.radius);
  e.vy -= T.gravity * dt;
  e.y += e.vy * dt;
  if (e.y <= g2 || e.y - g2 < T.stepHeight + 0.05) { e.y = g2; e.vy = 0; }
}

function stepDrone(w, e, d, dt, dist, toP) {
  const geo = w.geo, p = w.player;
  const want = (d.range[0] + d.range[1]) / 2;
  let tx = -toP.z * e.orbit * 0.8, tz = toP.x * e.orbit * 0.8;
  if (dist > want + 3) { tx += toP.x; tz += toP.z; } else if (dist < want - 3) { tx -= toP.x; tz -= toP.z; }
  if (e.modeT <= 0.05) e.orbit *= w.rng() < 0.3 ? -1 : 1;
  const L = Math.hypot(tx, tz) || 1;
  const spd = d.speed * (e.dodgeT > 0 ? 1.6 : 1);
  const k = Math.min(1, 3 * dt);
  e.vx += ((tx / L) * spd - e.vx) * k; e.vz += ((tz / L) * spd - e.vz) * k;
  const g = geo.terrainH(e.x, e.z);
  const alt = Math.max(g + d.alt[0], Math.min(g + d.alt[1], p.pos.y + 3 + Math.sin(w.t * 1.3 + e.id) * 1.5));
  e.vy += ((alt - e.y) * 2 - e.vy) * Math.min(1, 2 * dt);
  const np = { x: e.x + e.vx * dt, z: e.z + e.vz * dt };
  geo.resolve(np, d.radius, e.y - 0.4, e.y + 0.4, 0);
  e.x = np.x; e.z = np.z;
  let ny = e.y + e.vy * dt;
  const ceil = geo.ceilingAt(e.x, e.z, e.y - 0.3, d.radius);
  if (ny > ceil - 0.6) { ny = ceil - 0.6; e.vy = 0; }
  const gg = geo.groundAt(e.x, e.z, e.y, d.radius, 0.2);
  if (ny < gg + 1) { ny = gg + 1; e.vy = Math.max(0, e.vy); }
  e.y = ny;
  e.trackT = 0; e.walk += Math.hypot(e.vx, e.vz) * dt;
  faceToward(e, p.pos.x, p.pos.z, dt, 5);
}

function enemyFire(w, e, d, dist) {
  const p = w.player;
  const sh = ENEMY_SHOTS[e.weapon] || ENEMY_SHOTS.caster;
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  const from = { x: e.x + fx * (d.radius + 0.2), y: e.y + (d.fly ? 0 : d.height * 0.62), z: e.z + fz * (d.radius + 0.2) };
  // lead the target a little, then miss by the difficulty's aim error
  const tt = dist / sh.speed;
  const lead = 0.35 + w.rng() * 0.4;
  const tx = p.pos.x + p.vel.x * tt * lead, ty = p.pos.y + 1.15 - p.crouch * 0.5, tz = p.pos.z + p.vel.z * tt * lead;
  let dx = tx - from.x, dy = ty - from.y, dz = tz - from.z;
  if (sh.gravity) dy += 0.5 * sh.gravity * tt * tt;
  const L = Math.hypot(dx, dy, dz) || 1;
  const err = d.accuracy * w.diff.aim * (p.moving ? 1.2 : 0.8);
  const dir = spreadDir(w, { x: dx / L, y: dy / L, z: dz / L }, err);
  w.shots.push(makeShot(w, 'enemy', e.weapon, { x: from.x - dir.x * 0.5, y: from.y - dir.y * 0.5 + 0.08, z: from.z - dir.z * 0.5 }, dir, sh.speed, sh.damage,
    { color: sh.color, homing: sh.homing || 0, target: sh.homing ? 'player' : null, gravity: sh.gravity || 0, splash: sh.splash, size: sh.size, needle: e.weapon === 'needler' }));
  e.trackT = 0;
  ev(w, 'enemyFire', { id: e.id, weapon: e.weapon, x: from.x, y: from.y, z: from.z });
}

function enemyThrow(w, e, d) {
  const p = w.player, tgt = e.sees ? p.pos : e.lastSeen;
  if (!tgt) return;
  e.grenades--;
  const from = { x: e.x, y: e.y + d.height * 0.9, z: e.z };
  const dx = tgt.x - from.x, dz = tgt.z - from.z, L = Math.hypot(dx, dz);
  const tt = Math.max(0.6, L / 13);
  const vy = ((p.pos.y - from.y) + 0.5 * T.gravity * tt * tt) / tt;
  w.grenades.push({ id: w.nextId++, g: 'plasma', owner: 'enemy', x: from.x, y: from.y, z: from.z, vx: dx / tt, vy, vz: dz / tt,
    fuse: T.plasmaFuse + 0.4, stuck: null, lit: true, done: false, bounces: 0 });
  ev(w, 'enemyThrow', { id: e.id, x: e.x, y: e.y, z: e.z });
}

// ------------------------------------------------------------ projectiles
function stepShots(w, dt) {
  const geo = w.geo, p = w.player;
  for (const s of w.shots) {
    s.life -= dt;
    if (s.life <= 0) { s.dead = true; continue; }
    if (s.homing) {
      let tx, ty, tz;
      if (s.target === 'player') { tx = p.pos.x; ty = p.pos.y + 1.1; tz = p.pos.z; }
      else { const e = w.enemies.find((q) => q.id === s.target && !q.dead); if (e) { tx = e.x; ty = e.y + (ENEMIES[e.type].fly ? 0 : ENEMIES[e.type].height * 0.55); tz = e.z; } }
      if (tx !== undefined) {
        const dx = tx - s.x, dy = ty - s.y, dz = tz - s.z, L = Math.hypot(dx, dy, dz) || 1;
        const v = Math.hypot(s.vx, s.vy, s.vz) || 1;
        const k = Math.min(1, s.homing * dt);
        let nx = s.vx / v + (dx / L - s.vx / v) * k, ny = s.vy / v + (dy / L - s.vy / v) * k, nz = s.vz / v + (dz / L - s.vz / v) * k;
        const nL = Math.hypot(nx, ny, nz) || 1;
        s.vx = (nx / nL) * s.speed; s.vy = (ny / nL) * s.speed; s.vz = (nz / nL) * s.speed;
      }
    }
    if (s.gravity) s.vy -= s.gravity * dt;
    const px = s.x, py = s.y, pz = s.z;
    const qx = px + s.vx * dt, qy = py + s.vy * dt, qz = pz + s.vz * dt;
    const L = Math.hypot(qx - px, qy - py, qz - pz);
    const wh = geo.raycast(px, py, pz, (qx - px) / L, (qy - py) / L, (qz - pz) / L, L);
    const segT = wh ? wh.t / L : 1;
    const ex = px + (qx - px) * segT, ey = py + (qy - py) * segT, ez = pz + (qz - pz) * segT;
    const vh = vehicleAlong(w, px, py, pz, ex, ey, ez, s.owner === 'enemy' ? (s.vehicle ?? -1) : p.vehicle);
    if (vh && (s.owner === 'enemy' ? vh.v.occupant !== 'player' || true : true)) {
      // enemy fire hits the player's ride; player fire hits enemy bikes and empty wrecks-to-be
      const hitOwnSide = s.owner === 'enemy' ? (typeof vh.v.occupant === 'number') : vh.v.occupant === 'player';
      if (!hitOwnSide) {
        const hx = px + (ex - px) * vh.s, hy = py + (ey - py) * vh.s, hz = pz + (ez - pz) * vh.s;
        if (s.splash) explode(w, hx, hy, hz, s.splash.radius, s.splash.damage, s.owner, 'lance');
        else damageVehicle(w, vh.v, s.dmg * (s.owner === 'enemy' ? 1.6 : 1), { kind: 'plasma', x: px, z: pz });
        ev(w, 'shotHit', { x: hx, y: hy, z: hz, color: s.color, surface: 'armor' });
        s.dead = true; continue;
      }
    }
    if (s.owner === 'enemy') {
      const b = segVertical(px, py, pz, ex, ey, ez, p.pos.x, p.pos.y + 0.2, p.pos.y + pHeight(p) - 0.15, p.pos.z);
      if (w.mode === 'play' && b.d2 < (T.radius + (s.size || 0.15) * 0.6) ** 2) {
        const hx = px + (ex - px) * b.s, hy = py + (ey - py) * b.s, hz = pz + (ez - pz) * b.s;
        if (s.splash) explode(w, hx, hy, hz, s.splash.radius, s.splash.damage, 'enemy', 'lance');
        else damagePlayer(w, s.dmg, { kind: 'plasma', from: { x: px - s.vx, z: pz - s.vz } });
        if (s.needle) { p.needles.push(w.t); if (p.needles.length >= 7) { p.needles = []; explode(w, p.pos.x, p.pos.y + 1, p.pos.z, 2.2, 90, 'enemy', 'needle'); } }
        ev(w, 'shotHit', { x: hx, y: hy, z: hz, color: s.color, player: true });
        s.dead = true; continue;
      }
    } else {
      const h = hitAlong(w, px, py, pz, ex, ey, ez, (s.size || 0.15) * 0.5);
      if (h) {
        const hx = px + (ex - px) * h.s, hy = py + (ey - py) * h.s, hz = pz + (ez - pz) * h.s;
        const dir = { x: s.vx / s.speed, y: 0, z: s.vz / s.speed };
        if (s.splash) explode(w, hx, hy, hz, s.splash.radius, s.splash.damage, 'player', 'lance');
        if (h.e) {
          const d = WEAPONS[s.wid];
          const wasShield = h.e.shield > 0;
          damageEnemy(w, h.e, s.dmg, { dir, head: h.head, headMult: d?.headMult || 1, shieldMult: s.shieldMult ?? 1, kind: 'plasma', px: hx, py: hy, pz: hz });
          w.stats.hits++;
          if (s.needle && !h.e.dead) {
            h.e.needles.push(w.t);
            const sc = WEAPONS.needler.supercombine;
            if (h.e.needles.length >= sc.count) { h.e.needles = []; ev(w, 'supercombine', { x: h.e.x, y: h.e.y + 1, z: h.e.z }); explode(w, h.e.x, h.e.y + 1, h.e.z, sc.radius, sc.damage, 'player', 'needle'); }
          }
          ev(w, 'shotHit', { x: hx, y: hy, z: hz, color: s.color, surface: wasShield ? 'shield' : 'flesh', charged: s.charged });
        } else if (h.tg) { damageTarget(w, h.tg, s.dmg); ev(w, 'shotHit', { x: hx, y: hy, z: hz, color: s.color }); }
        s.dead = true; continue;
      }
    }
    if (wh) {
      if (s.splash) explode(w, ex, ey, ez, s.splash.radius, s.splash.damage, s.owner, 'lance');
      ev(w, 'shotHit', { x: ex, y: ey, z: ez, color: s.color, n: wh.n, world: true, needle: s.needle });
      s.dead = true; continue;
    }
    s.x = qx; s.y = qy; s.z = qz;
  }
  w.shots = w.shots.filter((s) => !s.dead);
}

// ------------------------------------------------------------ grenades
function stepGrenades(w, dt) {
  const geo = w.geo, p = w.player;
  for (const g of w.grenades) {
    if (g.done) continue;
    g.fuse -= dt;
    if (g.stuck) {
      if (g.stuck === 'player') { g.x = p.pos.x; g.y = p.pos.y + 1.1; g.z = p.pos.z; }
      else if (typeof g.stuck === 'number') { const e = w.enemies.find((q) => q.id === g.stuck); if (e) { g.x = e.x; g.y = e.y + ENEMIES[e.type].height * 0.6; g.z = e.z; } }
    } else {
      g.vy -= T.gravity * dt;
      const px = g.x, py = g.y, pz = g.z;
      const qx = px + g.vx * dt, qy = py + g.vy * dt, qz = pz + g.vz * dt;
      const L = Math.hypot(qx - px, qy - py, qz - pz);
      // plasma sticks to people
      if (g.g === 'plasma' && L > 0) {
        if (g.owner === 'player') {
          for (const e of w.enemies) {
            if (e.dead) continue;
            const ed = ENEMIES[e.type];
            const b = segVertical(px, py, pz, qx, qy, qz, e.x, e.y, e.y + (ed.fly ? 0.3 : ed.height), e.z);
            if (b.d2 < (ed.radius + T.stickRadius * 0.5) ** 2) {
              g.stuck = e.id; e.stuck = 1; g.fuse = Math.max(g.fuse, 1.2);
              ev(w, 'stuck', { id: e.id, x: e.x, y: e.y, z: e.z, etype: e.type });
              break;
            }
          }
        } else if (w.mode === 'play') {
          const b = segVertical(px, py, pz, qx, qy, qz, p.pos.x, p.pos.y, p.pos.y + pHeight(p), p.pos.z);
          if (b.d2 < (T.radius + 0.25) ** 2) { g.stuck = 'player'; g.fuse = Math.max(g.fuse, 1.2); ev(w, 'stuckPlayer'); }
        }
        if (g.stuck) continue;
      }
      const wh = L > 1e-6 ? geo.raycast(px, py, pz, (qx - px) / L, (qy - py) / L, (qz - pz) / L, L + 0.08) : null;
      if (wh) {
        const n = wh.n;
        g.x = px + ((qx - px) / L) * Math.max(0, wh.t - 0.08); g.y = py + ((qy - py) / L) * Math.max(0, wh.t - 0.08) + n[1] * 0.02; g.z = pz + ((qz - pz) / L) * Math.max(0, wh.t - 0.08);
        if (g.g === 'plasma') { g.stuck = 'world'; g.vx = g.vy = g.vz = 0; ev(w, 'grenadeBounce', { g: 'plasma' }); }
        else {
          const vn = g.vx * n[0] + g.vy * n[1] + g.vz * n[2];
          g.vx = (g.vx - 2 * vn * n[0]) * 0.45; g.vy = (g.vy - 2 * vn * n[1]) * 0.35; g.vz = (g.vz - 2 * vn * n[2]) * 0.45;
          if (Math.abs(vn) > 2) ev(w, 'grenadeBounce', { g: 'frag' });
          g.bounces++;
        }
      } else { g.x = qx; g.y = qy; g.z = qz; }
      const gh = geo.groundAt(g.x, g.z, g.y + 0.1, 0.05, 0.1);
      if (g.y < gh + 0.06) { g.y = gh + 0.06; if (g.vy < 0) g.vy = -g.vy * 0.3; g.vx *= 0.9; g.vz *= 0.9; }
    }
    if (g.fuse <= 0) {
      g.done = true;
      if (typeof g.stuck === 'number') { const e = w.enemies.find((q) => q.id === g.stuck); if (e) e.stuck = 0; }
      const r = g.g === 'frag' ? T.fragRadius : T.plasmaRadius, dmg = g.g === 'frag' ? T.fragDamage : T.plasmaDamage;
      explode(w, g.x, g.y + 0.1, g.z, r, dmg, g.owner, g.g);
      if (typeof g.stuck === 'number') { const e = w.enemies.find((q) => q.id === g.stuck); if (e && !e.dead) damageEnemy(w, e, 999, { kind: 'explosion', shieldMult: 1 }); }
    }
  }
  w.grenades = w.grenades.filter((g) => !g.done);
}


// ------------------------------------------------------------ vehicles
const clampV = (v, a, b) => (v < a ? a : v > b ? b : v);
// local (right, up, back) → world, for a vehicle heading `yaw`
export function vehicleLocal(v, lx, ly, lz) {
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  return { x: v.x + c * lx + s * lz, y: v.y + ly, z: v.z - s * lx + c * lz };
}
function addVehicle(w, spec) {
  const d = VEHICLES[spec.type];
  const x = spec.pos[0], z = spec.pos[spec.pos.length - 1];
  const y = w.geo.groundAt(x, z, w.geo.terrainH(x, z) + 1.5, d.radius * 0.5, 0);
  const v = { id: w.nextId++, type: spec.type, x, y, z, yaw: spec.yaw ?? 0, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, speed: 0, steer: 0, throttle: 0,
    hp: d.hp, maxHp: d.hp, occupant: null, seat: null, turretYaw: 0, turretPitch: 0, fireT: 0, gunSide: 1, onGround: true, dead: false, deadT: 0,
    boost: 1, boosting: false, wheel: 0, ai: null, hitT: 9, bumpT: 9, airT: 0 };
  w.vehicles.push(v);
  return v;
}
function enterVehicle(w, v, seat) {
  const p = w.player;
  if (v.occupant === 'player') { if (v.seat !== seat) { v.seat = seat; p.seat = seat; ev(w, 'seat', { seat, vtype: v.type }); } return; }
  v.occupant = 'player'; v.seat = seat;
  p.vehicle = v.id; p.seat = seat; p.rideT = 0; p.zoom = false; p.reloadT = 0; p.charge = 0; p.chargeHeld = false; p.burstLeft = 0;
  p.vel.x = p.vel.y = p.vel.z = 0;
  ev(w, 'vehicleEnter', { id: v.id, vtype: v.type, seat });
}
function exitVehicle(w, dead = false) {
  const p = w.player;
  const v = w.vehicles.find((q) => q.id === p.vehicle);
  if (v && v.occupant === 'player') { v.occupant = null; v.seat = null; }
  p.vehicle = null; p.seat = null;
  if (v) {
    // step out on the clearer side
    const d = VEHICLES[v.type];
    for (const side of [-1, 1, 0]) {
      const o = vehicleLocal(v, side * (d.width / 2 + 0.8), 0, side === 0 ? d.length / 2 + 1 : 0);
      const q = { x: o.x, z: o.z };
      w.geo.resolve(q, T.radius, v.y + 0.3, v.y + 1.9);
      if (Math.hypot(q.x - v.x, q.z - v.z) > d.radius * 0.6) { p.pos.x = q.x; p.pos.z = q.z; break; }
    }
    p.pos.y = w.geo.groundAt(p.pos.x, p.pos.z, v.y + 1.2, T.radius, 1.5);
    p.vel.x = v.vx * 0.5; p.vel.z = v.vz * 0.5; p.vel.y = dead ? 5 : 1;
    p.onGround = false;
    p.switchT = 0.45;
  }
  ev(w, 'vehicleExit', { dead });
}
function damageVehicle(w, v, amount, o = {}) {
  if (v.dead) return;
  v.hp -= amount; v.hitT = 0;
  ev(w, 'vehicleHit', { id: v.id, amount, vtype: v.type, player: v.occupant === 'player' });
  if (v.occupant === 'player' && o.x !== undefined) ev(w, 'playerHit', { from: { x: o.x, z: o.z }, shield: true, amount: 0, vehicle: true });
  if (v.hp <= 0) killVehicle(w, v);
}
function killVehicle(w, v) {
  v.dead = true; v.deadT = 0; v.hp = 0; v.speed *= 0.3; v.ai = null;
  const d = VEHICLES[v.type];
  if (v.occupant === 'player') { exitVehicle(w, true); damagePlayer(w, 40, { raw: true, kind: 'explosion', from: { x: v.x, z: v.z } }); }
  else if (typeof v.occupant === 'number') { const e = w.enemies.find((q) => q.id === v.occupant); if (e && !e.dead) { e.riding = null; damageEnemy(w, e, 9999, { kind: 'explosion', shieldMult: 1, dir: { x: 0, y: 0, z: 0 } }); } }
  v.occupant = null; v.seat = null;
  ev(w, 'vehicleDie', { id: v.id, vtype: v.type, x: v.x, y: v.y, z: v.z });
  explode(w, v.x, v.y + d.height * 0.5, v.z, 7, 110, 'enemy', d.side === 'vyrr' ? 'plasma' : 'big');
}

// The player's turn in a seat: sync the body to the seat, drive or shoot.
function stepRiding(w, dt, inp) {
  const p = w.player;
  const v = w.vehicles.find((q) => q.id === p.vehicle);
  if (!v || v.dead || v.occupant !== 'player') { p.vehicle = null; p.seat = null; return; }
  const d = VEHICLES[v.type];
  p.rideT += dt;
  // seat swap (MULE): Y / Tab / SWAP hops between the wheel and the turret
  if (inp.swap && d.seats.gunner && p.rideT > 0.3) { const other = v.seat === 'driver' ? 'gunner' : 'driver'; v.seat = other; p.seat = other; p.rideT = 0; ev(w, 'seat', { seat: other, vtype: v.type }); }
  // vitals keep ticking
  p.shieldT += dt;
  if (p.shieldT > T.shieldDelay * w.diff.shieldDelay && p.shield < T.shieldMax) { if (!p.recharging) { p.recharging = true; ev(w, 'shieldRecharge'); } p.shield = Math.min(T.shieldMax, p.shield + T.shieldRate * dt); }
  else if (p.shield >= T.shieldMax) p.recharging = false;
  p.kick *= Math.exp(-9 * dt); p.hurtT += dt; p.firedT += dt; p.fireT -= dt; p.switchT -= dt; p.meleeT -= dt; p.grenT -= dt;
  p.needles = p.needles.filter((t) => w.t - t < 2);
  p.crouch += (0 - p.crouch) * Math.min(1, dt * 7);
  // the turret: hitscan chaingun along the aim
  const seat = d.seats[v.seat];
  if (seat.weapon === 'chaingun') {
    const g = MOUNTED.chaingun;
    if (inp.fire && p.fireT <= 0) {
      p.fireT = g.rate; p.firedT = 0; w.stats.shots++;
      const eye = eyePos(p), base = aimDir(p.yaw, p.pitch);
      if (hitscan(w, eye, spreadDir(w, base, g.spread), g, true)) w.stats.hits++;
      p.kick += g.recoil;
      ev(w, 'fire', { id: 'chaingun' });
      alertByNoise(w, eye.x, eye.z, T.hearRange);
    }
    v.turretYaw = wrap(p.yaw - v.yaw); v.turretPitch = p.pitch;
  }
  p.moving = Math.abs(v.speed) > 1;
}

function stepVehicles(w, dt, inp) {
  const p = w.player, geo = w.geo;
  for (const v of w.vehicles) {
    const d = VEHICLES[v.type];
    v.hitT += dt; v.bumpT += dt;
    if (v.dead) { v.deadT += dt; v.speed *= Math.exp(-2 * dt); v.vx *= Math.exp(-2 * dt); v.vz *= Math.exp(-2 * dt); v.x += v.vx * dt; v.z += v.vz * dt; v.y = geo.groundAt(v.x, v.z, v.y + 0.5, d.radius * 0.5, 0.8); continue; }
    let throttle = 0, steer = 0, fire = false, boost = false;
    const driven = v.occupant === 'player' && v.seat === 'driver' && w.mode === 'play';
    if (driven) {
      throttle = clampV(inp.my || 0, -1, 1);
      // Halo steering: the nose chases where you look; the stick's x adds direct steering
      const look = wrap(p.yaw - v.yaw);
      steer = clampV(look * 1.7, -1, 1) * (Math.abs(throttle) > 0.05 ? 1 : 0.7) + clampV(inp.mx || 0, -1, 1) * 0.6;
      steer = clampV(steer, -1, 1);
      boost = !!d.boost && !!inp.crouch;
      fire = !!d.seats.driver.weapon && !!(inp.fire || inp.fireEdge);
    } else if (typeof v.occupant === 'number' && v.ai) {
      const a = stepVehicleAI(w, v, d, dt);
      throttle = a.throttle; steer = a.steer; fire = a.fire; boost = a.boost;
    }
    v.throttle = throttle;
    // ---- longitudinal
    const maxS = boost && v.boost > 0.03 ? d.boostSpeed : d.maxSpeed;
    if (throttle > 0.05) v.speed += d.accel * throttle * dt * (v.speed < 0 ? 1.8 : 1) * (boost ? 1.5 : 1);
    else if (throttle < -0.05) v.speed += (v.speed > 0.5 ? -d.brake : d.accel * throttle * 0.6) * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), d.drag * dt);
    if (v.speed > maxS) v.speed -= Math.min(v.speed - maxS, d.brake * 0.6 * dt);
    if (v.speed < -d.reverseMax) v.speed = -d.reverseMax;
    if (boost && v.boost > 0) { v.boost = Math.max(0, v.boost - dt / 2.8); if (!v.boosting) ev(w, 'boost', { id: v.id }); v.boosting = true; }
    else { v.boosting = false; v.boost = Math.min(1, v.boost + dt / 5); }
    // ---- steering (only bites while rolling; hover bikes drift wide)
    v.steer += (steer - v.steer) * Math.min(1, dt * 7);
    const turn = v.steer * d.turnRate * clampV(v.speed / 7, -1, 1);
    v.yaw = wrap(v.yaw + turn * dt);
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    const gripK = Math.min(1, d.grip * dt * (v.onGround ? 1 : 0.15));
    v.vx += (fx * v.speed - v.vx) * gripK; v.vz += (fz * v.speed - v.vz) * gripK;
    // ---- move, walls, cliffs
    const ox = v.x, oz = v.z;
    const np = { x: v.x + v.vx * dt, z: v.z + v.vz * dt };
    const wantX = np.x, wantZ = np.z;
    const hit = geo.resolve(np, d.radius, v.y, v.y + d.height, 0.65);
    const sl = geo.terrainSlope(np.x, np.z), nH = geo.terrainH(np.x, np.z);
    if (nH > v.y + 0.02 && (sl.m > T.maxSlope * 1.25 || nH > v.y + 1.0)) {
      const hx = geo.terrainH(np.x, oz), hz = geo.terrainH(ox, np.z);
      if (!(hx <= v.y + 0.02 || (geo.terrainSlope(np.x, oz).m <= T.maxSlope * 1.25 && hx <= v.y + 1.0))) np.x = ox;
      if (!(hz <= v.y + 0.02 || (geo.terrainSlope(ox, np.z).m <= T.maxSlope * 1.25 && hz <= v.y + 1.0))) np.z = oz;
    }
    const pushed = Math.hypot(np.x - wantX, np.z - wantZ);
    if ((hit || pushed > 0.001) && pushed > 0.01) {
      const hard = Math.abs(v.speed) > 6;
      if (hard) { damageVehicle(w, v, Math.abs(v.speed) * 2.5, { kind: 'bump' }); if (v.bumpT > 0.4) { ev(w, 'vehicleBump', { id: v.id, v: Math.abs(v.speed), x: v.x, y: v.y, z: v.z }); v.bumpT = 0; } }
      v.speed *= hard ? -0.25 : 0.3; v.vx *= 0.2; v.vz *= 0.2;
    }
    v.x = np.x; v.z = np.z;
    // ---- ground follow
    const g = geo.groundAt(v.x, v.z, v.y + 0.4, d.radius * 0.55, 0.9);
    if (d.kind === 'hover') {
      const target = g + d.hover;
      v.vy += ((target - v.y) * 16 - v.vy * 5) * dt;
      v.y += v.vy * dt;
      if (v.y < g) { v.y = g; v.vy = Math.max(0, v.vy); }
      v.onGround = v.y - g < d.hover + 0.6;
      // lean: bank into the turn, nose down under braking
      v.roll += ((-v.steer * 0.42 * clampV(v.speed / 10, -1, 1)) - v.roll) * Math.min(1, dt * 5);
      v.pitch += ((throttle > 0 ? -0.06 : throttle < 0 ? 0.08 : 0) - v.pitch) * Math.min(1, dt * 4);
    } else {
      v.vy -= T.gravity * dt;
      let ny = v.y + v.vy * dt;
      if (ny <= g) { if (v.vy < -5) ev(w, 'vehicleLand', { id: v.id, v: -v.vy, x: v.x, y: v.y, z: v.z }); ny = g; v.vy = 0; v.onGround = true; v.airT = 0; }
      else if (v.onGround && v.y - g < 0.6) { ny = g; v.vy = 0; }
      else { v.onGround = false; v.airT += dt; }
      v.y = ny;
      // pitch and roll from the ground under the wheels
      const f = vehicleLocal(v, 0, 0, -d.wheelbase / 2), b = vehicleLocal(v, 0, 0, d.wheelbase / 2), l = vehicleLocal(v, -d.track / 2, 0, 0), r = vehicleLocal(v, d.track / 2, 0, 0);
      const hf = geo.groundAt(f.x, f.z, v.y + 0.6, 0.4, 0.9), hb = geo.groundAt(b.x, b.z, v.y + 0.6, 0.4, 0.9), hl = geo.groundAt(l.x, l.z, v.y + 0.6, 0.4, 0.9), hr = geo.groundAt(r.x, r.z, v.y + 0.6, 0.4, 0.9);
      const wantPitch = v.onGround ? Math.atan2(hf - hb, d.wheelbase) : clampV(-v.vy * 0.03, -0.35, 0.35);
      const wantRoll = v.onGround ? Math.atan2(hr - hl, d.track) : 0;
      v.pitch += (wantPitch - v.pitch) * Math.min(1, dt * 6);
      v.roll += (wantRoll - v.steer * 0.06 * clampV(v.speed / 10, -1, 1) - v.roll) * Math.min(1, dt * 6);
      v.wheel += v.speed * dt / d.wheelR;
    }
    // ---- splatter
    if (Math.abs(v.speed) > 5 && !v.dead) {
      const nose = vehicleLocal(v, 0, 0, -Math.sign(v.speed) * d.length * 0.35);
      for (const e of w.enemies) {
        if (e.dead || e.riding) continue;
        const ed = ENEMIES[e.type];
        if (ed.fly && e.y > v.y + d.height + 0.5) continue;
        if (Math.hypot(e.x - nose.x, e.z - nose.z) < ed.radius + d.radius * 0.7 && Math.abs(e.y - v.y) < 2.2) {
          const L = Math.hypot(e.x - v.x, e.z - v.z) || 1;
          const dir = { x: (e.x - v.x) / L, y: 0, z: (e.z - v.z) / L };
          const killed = damageEnemy(w, e, d.ram * Math.abs(v.speed) / 10, { kind: 'explosion', dir, shieldMult: 1.5 });
          ev(w, 'splatter', { id: e.id, x: e.x, y: e.y + 1, z: e.z, killed, player: v.occupant === 'player' });
          if (killed && v.occupant === 'player') w.stats.hits++;
          if (!killed) { e.vx += dir.x * 8; e.vz += dir.z * 8; }
          v.speed *= ed.armorFront ? 0.5 : 0.9;
        }
      }
      if (v.occupant === 'player' && w.mode === 'play') alertByNoise(w, v.x, v.z, 18);
    }
    // ---- the Sliver's cannons (player or AI): twin bolts from the wing muzzles
    v.fireT -= dt;
    if (fire && v.fireT <= 0) {
      const g = MOUNTED.sliverGun;
      v.fireT = g.rate; v.gunSide *= -1;
      const m = d.guns[v.gunSide > 0 ? 1 : 0];
      const from = vehicleLocal(v, m[0], m[1], m[2]);
      if (driven) {
        // along the aim, but no more than 25° off the nose
        let aim = aimDir(p.yaw, p.pitch);
        const off = wrap(p.yaw - v.yaw);
        if (Math.abs(off) > 0.45) aim = aimDir(v.yaw + Math.sign(off) * 0.45, p.pitch);
        const dir = spreadDir(w, aim, g.spread);
        w.shots.push(makeShot(w, 'player', 'sliverGun', from, dir, g.speed, g.damage, { color: g.color, shieldMult: g.shieldMult, size: 0.18, vehicle: v.id }));
        p.firedT = 0; w.stats.shots++;
        ev(w, 'fire', { id: 'sliverGun' });
        alertByNoise(w, v.x, v.z, T.hearRange * 0.8);
      } else {
        const sh = ENEMY_VEHICLE_SHOTS.sliverGun;
        const tt = Math.hypot(p.pos.x - from.x, p.pos.z - from.z) / sh.speed;
        const tx = p.pos.x + p.vel.x * tt * 0.6, ty = p.pos.y + 1.1, tz = p.pos.z + p.vel.z * tt * 0.6;
        const dx = tx - from.x, dy = ty - from.y, dz = tz - from.z, L = Math.hypot(dx, dy, dz) || 1;
        const dir = spreadDir(w, { x: dx / L, y: dy / L, z: dz / L }, 0.06 * w.diff.aim);
        w.shots.push(makeShot(w, 'enemy', 'sliverGun', from, dir, sh.speed, sh.damage, { color: sh.color, size: sh.size, vehicle: v.id }));
        ev(w, 'enemyFire', { id: v.occupant, weapon: 'carbine', x: from.x, y: from.y, z: from.z });
      }
    }
    // ---- riders follow their seats
    if (v.occupant === 'player') {
      const seat = d.seats[v.seat];
      const o = vehicleLocal(v, seat.pos[0], seat.pos[1], seat.pos[2]);
      p.pos.x = o.x; p.pos.z = o.z; p.pos.y = o.y - 0.78;
      p.vel.x = v.vx; p.vel.z = v.vz; p.vel.y = 0; p.onGround = true;
    } else if (typeof v.occupant === 'number') {
      const e = w.enemies.find((q) => q.id === v.occupant);
      if (e && !e.dead) { const seat = d.seats.driver; const o = vehicleLocal(v, seat.pos[0], seat.pos[1], seat.pos[2]); e.x = o.x; e.z = o.z; e.y = o.y - 0.95; e.yaw = v.yaw; e.vx = v.vx; e.vz = v.vz; }
      else { v.occupant = null; v.seat = null; v.ai = null; }
    }
    if ((v.y < geo.killY || v.hp <= 0) && !v.dead) killVehicle(w, v);
  }
}

// A Vyrr rider: strafing runs past you, wide orbits, breaks off when it gets close.
function stepVehicleAI(w, v, d, dt) {
  const p = w.player, ai = v.ai;
  const dx = p.pos.x - v.x, dz = p.pos.z - v.z, dist = Math.hypot(dx, dz);
  const toAng = Math.atan2(-dx, -dz);
  ai.t -= dt;
  if (ai.t <= 0) {
    ai.t = rnd(w, 1.8, 3.5);
    if (w.rng() < 0.35) ai.orbit *= -1;
    ai.mode = dist > 30 ? 'close' : w.rng() < 0.5 ? 'orbit' : 'run';
  }
  let wantYaw = toAng;
  if (ai.mode === 'orbit') wantYaw = toAng + ai.orbit * 1.25;
  else if (ai.mode === 'run') wantYaw = toAng + ai.orbit * 0.5;
  if (dist < 9) wantYaw = toAng + ai.orbit * 2.2; // veer off before a collision
  const off = wrap(wantYaw - v.yaw);
  const facing = Math.abs(wrap(toAng - v.yaw));
  const fire = w.mode === 'play' && facing < 0.35 && dist < 48 && dist > 5 && w.geo.clear(v.x, v.y + 1, v.z, p.pos.x, p.pos.y + 1, p.pos.z);
  return { throttle: 0.7 + (ai.mode === 'close' ? 0.3 : 0), steer: clampV(off * 1.6, -1, 1), fire, boost: ai.mode === 'close' && dist > 40 };
}

// ------------------------------------------------------------ script
function startStep(w, i) {
  const seq = w.level.sequence || [];
  w.seq.i = i; w.seq.used = false; w.seq.t = 0;
  const st = seq[i];
  if (!st) return;
  w.objective = st.obj || '';
  w.waypoint = st.wp ? [...st.wp] : null;
  doActions(w, st.start);
  ev(w, 'objective', { text: w.objective, index: i });
}

function doActions(w, a) {
  if (!a) return;
  for (const g of a.spawn || []) spawnGroup(w, g);
  for (const id of a.open || []) openDoor(w, id);
  if (a.say) ev(w, 'say', { lines: a.say });
  if (a.alert) for (const e of w.enemies) if (!e.dead && a.alert.includes(e.group)) { e.alert = true; e.lastSeen = { x: w.player.pos.x, z: w.player.pos.z }; }
}

function openDoor(w, id) {
  if (w.doorsOpen.includes(id)) return;
  w.doorsOpen.push(id);
  syncDoors(w);
  ev(w, 'door', { id });
}

function syncDoors(w) {
  w.geo.off.clear();
  w.geo.boxes.forEach((b, idx) => { if (b.door && w.doorsOpen.includes(b.door)) w.geo.off.add(idx); });
}

function groupsClear(w, groups) {
  return groups.every((g) => !w.enemies.some((e) => e.group === g && !e.dead));
}

function stepSequence(w, dt) {
  const seq = w.level.sequence || [];
  const st = seq[w.seq.i];
  if (w.pendingCp >= 0) {
    w.pendingCp -= dt;
    const safe = !w.enemies.some((e) => !e.dead && e.sees && Math.hypot(e.x - w.player.pos.x, e.z - w.player.pos.z) < 18);
    if (w.pendingCp <= 0 && safe && w.player.onGround && !w.grenades.length) { w.pendingCp = -1; saveCheckpoint(w); }
  }
  if (!st) return;
  w.seq.t += dt;
  const u = st.until || { type: 'never' };
  const p = w.player;
  let done = false;
  if (u.type === 'reach') done = Math.hypot(p.pos.x - u.pos[0], p.pos.z - u.pos[1]) < (u.r || 4) && (!u.needClear || groupsClear(w, u.needClear));
  else if (u.type === 'clear') done = groupsClear(w, u.groups);
  else if (u.type === 'use') done = w.seq.used;
  else if (u.type === 'destroy') { done = u.targets.every((id) => w.targets.find((t) => t.id === id)?.dead); w.objectiveProgress = u.targets.filter((id) => w.targets.find((t) => t.id === id)?.dead).length; }
  else if (u.type === 'timer') done = w.seq.t > u.t;
  if (u.type === 'destroy' && st.objCount) w.objective = `${st.obj} (${w.objectiveProgress}/${u.targets.length})`;
  if (!done) return;
  doActions(w, st.done);
  if (st.end) { w.mode = 'won'; ev(w, 'levelComplete'); return; }
  if (st.checkpoint) w.pendingCp = T.checkpointPause;
  startStep(w, w.seq.i + 1);
}

// ------------------------------------------------------------ firefight
const WAVES = [
  [['skitter', 4]],
  [['skitter', 3], ['trooper', 1]],
  [['skitter', 3], ['drone', 3]],
  [['trooper', 2], ['skitter', 3]],
  [['heavy', 1], ['skitter', 3]],
  [['trooper', 3], ['drone', 2], ['skitter', 2]],
  [['heavy', 2], ['trooper', 1]],
];
function stepFirefight(w, dt) {
  const ff = w.ff, lv = w.level.firefight;
  const alive = w.enemies.some((e) => !e.dead && e.group === 'ff');
  if (!ff.pending && !alive) {
    ff.pending = true; ff.t = 6;
    w.stats.score += 50 * ff.wave;
    ev(w, 'waveClear', { wave: ff.wave });
    w.player.grens.frag = Math.min(T.gMaxEach, w.player.grens.frag + 1);
  }
  if (!ff.pending) return;
  ff.t -= dt;
  if (ff.t > 0) return;
  ff.pending = false; ff.wave++;
  const base = WAVES[(ff.wave - 1) % WAVES.length], extra = Math.floor((ff.wave - 1) / WAVES.length);
  const p = w.player;
  const spots = lv.spawns.slice().sort((a, b) => Math.hypot(b[0] - p.pos.x, b[1] - p.pos.z) - Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z)).slice(0, 2);
  let n = 0;
  for (const [t, c] of base) {
    for (let i = 0; i < c + extra; i++, n++) {
      const s = spots[n % spots.length];
      const e = spawnEnemy(w, { t, p: [s[0] + (w.rng() - 0.5) * 6, s[1] + (w.rng() - 0.5) * 6], w: t === 'trooper' && w.rng() < 0.4 ? 'needler' : undefined }, 'ff');
      e.alert = true; e.lastSeen = { x: p.pos.x, z: p.pos.z }; e.reactT = 1;
    }
  }
  w.objective = `WAVE ${ff.wave}: SURVIVE`;
  ev(w, 'wave', { wave: ff.wave });
  saveCheckpoint(w);
}

// ------------------------------------------------------------ checkpoints
const SNAP = ['t', 'player', 'enemies', 'pickups', 'targets', 'respawns', 'seq', 'objective', 'waypoint', 'doorsOpen', 'stats', 'ff', 'nextId', 'vehicles'];
function saveCheckpoint(w, silent = false) {
  const s = {};
  for (const k of SNAP) s[k] = structuredClone(w[k]);
  w.checkpoint = s;
  if (!silent) ev(w, 'checkpoint');
}

export function restoreCheckpoint(w) {
  const s = w.checkpoint;
  const deaths = w.stats.deaths;
  for (const k of SNAP) w[k] = structuredClone(s[k]);
  w.stats.deaths = deaths;
  w.shots = []; w.grenades = []; w.mode = 'play'; w.deadT = 0; w.pendingCp = -1;
  const p = w.player;
  if (p.health <= 0) p.health = T.healthMax;
  p.shield = T.shieldMax; p.vel = { x: 0, y: 0, z: 0 }; p.stuck = 0;
  syncDoors(w);
  w.flowT = 0;
  ev(w, 'restored');
}

// What the reticle is over (HUD: the reticle turns red on an enemy in range).
export function aimInfo(w) {
  const p = w.player, eye = eyePos(p), d = aimDir(p.yaw, p.pitch + p.kick);
  const ws = p.weapons[p.cur], range = ws ? WEAPONS[ws.id].range : 40;
  const wh = w.geo.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, range);
  const maxT = wh ? wh.t : range;
  const h = hitAlong(w, eye.x, eye.y, eye.z, eye.x + d.x * maxT, eye.y + d.y * maxT, eye.z + d.z * maxT, 0.15);
  return { enemy: !!h?.e, target: !!h?.tg, dist: h ? h.s * maxT : maxT };
}

// For HUD/debug: a compact snapshot of the interesting numbers.
export function summary(w) {
  const p = w.player;
  return { mode: w.mode, step: w.seq.i, obj: w.objective, hp: +p.health.toFixed(1), sh: +p.shield.toFixed(1),
    x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), enemies: w.enemies.filter((e) => !e.dead).length, kills: w.stats.kills, vehicle: p.vehicle ? `${w.vehicles.find((v) => v.id === p.vehicle)?.type}:${p.seat}` : null };
}
