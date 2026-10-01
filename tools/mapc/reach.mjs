// Provability check: can the level be finished from the player start?
//
// Model: the map is sampled on a 16-unit sub-grid. The player is the real 32x32 box (2x2 sub-cells,
// positions on the 16-unit lattice) standing at a feet height z. (1-cell-wide squeezes are legal in
// the engine but awful to play; mapc lints them separately.) A move of 16 units lands on the highest surface <= z + STEP in every sub-cell under
// the box (floors, lift platforms, 3D-floor tops); it needs 56 units of headroom there (and at
// the old z if the player drops) and no 3D slab cutting through the body. Any drop is allowed.
// Doors are open once their key is held, remote doors/floors/lifts once their trigger fired;
// lifts carry the player between their low and high positions. The world state (keys,
// objectives, fired triggers) grows to a fixpoint: collect everything reachable, apply it, repeat.
// Then: every forward-reachable position must still be able to reach an exit (no softlocks).
import { CELL } from './geometry.mjs';
import { SPECIAL_NAMES, LOCKS } from './specials.mjs';
import { MONSTERS, FLYERS, NPCS, KEYS, isPickup } from './assets.mjs';

const SUB = 16, STEP = 24, CLAMBER = 64, HEIGHT = 56;
const ZOFF = 8192, ZMUL = 16384;

export function checkLevel(lv) {
  const W = lv.W * 2, H = lv.H * 2, N = W * H;
  const rep = { errors: [], warnings: [], info: [] };
  const fail = (m) => rep.errors.push(m), warn = (m) => rep.warnings.push(m);

  // ---- sub-cell -> sector(s)
  const subSec = new Array(N);
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const cell = lv.cells[sy >> 1][sx >> 1];
    const q = (sy & 1 ? 'L' : 'U') + (sx & 1 ? 'R' : 'L');
    let list = [];
    if (cell.pieces && cell.pieces.F) list = [cell.pieces.F.sector];
    else if (cell.kind === 'diag') {
      const P = cell.pieces;
      const halves = cell.ch === '/' ? ['UL', 'LR'] : ['UR', 'LL'];
      if (P[q]) list = [P[q].sector];
      else if (!halves.includes(q)) list = P[halves[0]] && P[halves[1]] ? [P[halves[0]].sector, P[halves[1]].sector] : [];
    }
    subSec[sy * W + sx] = list;
  }
  const secById = lv.sectors;
  const tagged = (tag) => secById.filter((s) => s.tags.includes(tag));

  // ---- columns for a world state
  function sectorColumn(s, st) {
    if (s.kind === 'window' || s.p.block) return null;
    let floor = s.floor, ceil = s.ceil;
    const fx = st.floorFx.get(s.id); if (fx !== undefined) floor = fx;
    const cx = st.ceilFx.get(s.id); if (cx !== undefined) ceil = cx;
    if (s.kind === 'door') {
      const open = (!s.remote && (!s.lock || st.keys.has(s.lock))) || st.opened.has(s.id);
      if (!open) return null;
      ceil = Math.max(ceil, s.openCeil);
    }
    let lift = null;
    if (s.kind === 'lift' && (!s.remote || st.lifts.has(s.id))) { lift = s.id; floor = s.low; }
    const surf = [floor];
    if (lift !== null) surf.push(s.top);
    const slabs = [];
    for (const sl of s.slabs || []) { slabs.push([sl.z0, sl.z1]); surf.push(sl.z1); }
    surf.sort((a, b) => a - b);
    return { floor, ceil, surf, slabs, lift, damage: !!s.p.damage, scenery: !!s.p.scenery, sid: s.id };
  }
  function buildColumns(st) {
    const cache = new Map();
    const colOf = (s) => { if (!cache.has(s.id)) cache.set(s.id, sectorColumn(s, st)); return cache.get(s.id); };
    const cols = new Array(N);
    for (let k = 0; k < N; k++) {
      const list = subSec[k];
      if (!list.length) { cols[k] = null; continue; }
      if (list.length === 1) { cols[k] = colOf(list[0]); continue; }
      const a = colOf(list[0]), b = colOf(list[1]);
      if (!a || !b) { cols[k] = null; continue; }
      const floor = Math.max(a.floor, b.floor), ceil = Math.min(a.ceil, b.ceil);
      const slabs = [...a.slabs, ...b.slabs];
      const surf = [...new Set([...a.surf, ...b.surf].filter((z) => z >= floor))].sort((x, y) => x - y);
      cols[k] = { floor, ceil, surf, slabs, lift: null, damage: a.damage || b.damage, sid: a.sid };
    }
    return cols;
  }

  // ---- movement
  function makeMover(cols, step) {
    const landing = (k, z) => {
      const c = cols[k]; if (!c) return null;
      let best = null;
      for (const s of c.surf) if (s <= z + step) best = s; else break;
      return best;
    };
    const clear = (sx, sy, z) => {
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const c = cols[(sy + dy) * W + sx + dx];
        if (!c || z + HEIGHT > c.ceil || z < c.floor) return false;
        for (const [z0, z1] of c.slabs) if (z0 < z + HEIGHT && z1 > z) return false;
      }
      return true;
    };
    const standAt = (sx, sy, z) => { // landing height of the box at (sx,sy) for feet z, or null
      if (sx < 1 || sy < 1 || sx >= W || sy >= H) return null;
      let zl = -Infinity;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const l = landing((sy + dy) * W + sx + dx, z);
        if (l === null) return null;
        if (l > zl) zl = l;
      }
      if (zl < z && !clear(sx, sy, z)) return null;
      return clear(sx, sy, zl) ? zl : null;
    };
    const liftAt = (sx, sy) => {
      let id = null;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const c = cols[(sy + dy) * W + sx + dx];
        if (!c || c.lift === null) return null;
        if (id === null) id = c.lift; else if (id !== c.lift) return null;
      }
      return id;
    };
    return { standAt, liftAt, clear };
  }
  const key = (sx, sy, z) => (sy * W + sx) * ZMUL + (z + ZOFF);
  const unkey = (s) => { const kz = s % ZMUL, k = (s - kz) / ZMUL; return [k % W, Math.floor(k / W), kz - ZOFF]; };

  function bfs(starts, cols, step, wantEdges) {
    const mv = makeMover(cols, step);
    const seen = new Set(), queue = [], edges = wantEdges ? new Map() : null;
    for (const s of starts) if (!seen.has(s)) { seen.add(s); queue.push(s); }
    const nbr = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let qi = 0; qi < queue.length; qi++) {
      const s = queue[qi];
      const [sx, sy, z] = unkey(s);
      const outs = [];
      for (const [dx, dy] of nbr) {
        const zl = mv.standAt(sx + dx, sy + dy, z);
        if (zl === null) continue;
        outs.push(key(sx + dx, sy + dy, zl));
      }
      const L = mv.liftAt(sx, sy);
      if (L !== null) {
        const ls = secById[L];
        for (const z2 of [ls.low, ls.top]) if (z2 !== z && mv.clear(sx, sy, z2)) outs.push(key(sx, sy, z2));
      }
      for (const o of outs) { if (!seen.has(o)) { seen.add(o); queue.push(o); } }
      if (edges) edges.set(s, outs);
    }
    return { seen, edges, mv };
  }

  // index of reached (sub-cell -> z values)
  function indexStates(seen) {
    const at = new Map();
    for (const s of seen) {
      const [sx, sy, z] = unkey(s);
      const k = sy * W + sx;
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(z);
    }
    return at;
  }
  // is some reached box centre within `rad` units (Chebyshev) of (x,y) with z in [zlo, zhi] (relative to target z)?
  function near(at, x, y, tz, rad, zlo, zhi) {
    const cx = x / SUB, cy = -y / SUB;
    const r = rad / SUB;
    for (let sy = Math.floor(cy - r - 1); sy <= Math.ceil(cy + r); sy++) for (let sx = Math.floor(cx - r - 1); sx <= Math.ceil(cx + r); sx++) {
      if (Math.abs(sx - cx) * SUB > rad || Math.abs(sy - cy) * SUB > rad) continue;
      const zs = at.get(sy * W + sx);
      if (!zs) continue;
      for (const z of zs) if (tz - z >= zlo && tz - z <= zhi) return true;
    }
    return false;
  }

  // ---- start
  const start = lv.things.find((t) => t.cls === 'PlayerStart');
  if (!start) { fail('no PlayerStart'); return rep; }

  // ---- triggers
  const triggers = [];
  for (const t of lv.things) {
    const m = t.meta;
    const base = { thing: t, x: t.x, y: t.y, z: t.z, name: `${t.cls}@${t.col},${t.row}` };
    if (m.key && KEYS[t.cls]) triggers.push({ ...base, kind: 'item', key: m.key });
    else if (m.key) triggers.push({ ...base, kind: 'use', key: m.key });
    if (m.objective && t.cls !== 'HackTerminal') triggers.push({ ...base, kind: 'item', objective: m.objective });
    if (t.cls === 'HackTerminal') triggers.push({ ...base, kind: 'use', rad: 64, effect: m.effect, objective: m.objective });
    if (m.gate) triggers.push({ ...base, kind: 'use', rad: 128, gate: m.gate });
    if (m.heli) triggers.push({ ...base, kind: 'use', rad: 128, needMask: m.heli.mask, objective: m.heli.obj, effect: { special: 243, args: [0] } });
    if ((m.effect || m.deathObj) && t.cls !== 'HackTerminal') {
      const boss = t.cls === 'HiveMind';
      triggers.push({ ...base, kind: 'monster', effect: m.effect || null, rad: boss ? 320 : 128, requires: m.shieldObj || 0, objective: m.deathObj || 0 });
    }
  }
  for (const sw of lv.switches) triggers.push({ kind: 'use', rad: 40, x: sw.pos[0], y: sw.pos[1], z: sw.sector.floor + 32, effect: { special: sw.line.special, args: sw.args }, needKey: sw.line.lockKey || null, name: `switch '${sw.mark.char}'@${sw.cell.c},${sw.cell.r}` });
  const enterSectors = new Map();
  for (const l of lv.lines) if (l.role === 'trigger') enterSectors.set(l.trigger.id, l);
  for (const [sid, l] of enterSectors) triggers.push({ kind: 'enter', sid, effect: { special: l.special, args: l.args }, name: `enter '${secById[sid].char}'@${secById[sid].pieces[0].c},${secById[sid].pieces[0].r}` });
  const exits = triggers.filter((t) => t.effect && /^Exit_/.test(SPECIAL_NAMES[t.effect.special] || ''));
  if (!exits.length) fail('no exit (an Exit_Normal switch or enter= region)');

  function newState() { return { keys: new Set(), objectives: new Set(), fired: new Set(), opened: new Set(), lifts: new Set(), floorFx: new Map(), ceilFx: new Map(), exit: false }; }
  function cloneState(s) { return { keys: new Set(s.keys), objectives: new Set(s.objectives), fired: new Set(s.fired), opened: new Set(s.opened), lifts: new Set(s.lifts), floorFx: new Map(s.floorFx), ceilFx: new Map(s.ceilFx), exit: s.exit }; }
  function applyEffect(st, eff) {
    const name = SPECIAL_NAMES[eff.special] || String(eff.special);
    const tag = eff.args[0] | 0;
    const secs = tag ? tagged(tag) : [];
    const nbFloors = (s) => [...s.neighbours].map((n) => n.floor);
    switch (name) {
      case 'Exit_Normal': case 'Exit_Secret': st.exit = true; return;
      case 'Door_Open': case 'Door_Raise': case 'Door_LockedRaise': case 'Door_WaitRaise':
        for (const s of secs) { st.opened.add(s.id); if (s.kind !== 'door') st.ceilFx.set(s.id, Math.max(...[...s.neighbours].map((n) => n.ceil)) - 4); }
        break;
      case 'Floor_LowerToLowest': for (const s of secs) st.floorFx.set(s.id, Math.min(s.floor, ...nbFloors(s))); break;
      case 'Floor_LowerToNearest': for (const s of secs) { const lower = nbFloors(s).filter((f) => f < s.floor); if (lower.length) st.floorFx.set(s.id, Math.max(...lower)); } break;
      case 'Floor_LowerByValue': for (const s of secs) st.floorFx.set(s.id, s.floor - (eff.args[2] | 0)); break;
      case 'Floor_RaiseByValue': for (const s of secs) st.floorFx.set(s.id, s.floor + (eff.args[2] | 0)); break;
      case 'Ceiling_RaiseToHighest': for (const s of secs) st.ceilFx.set(s.id, Math.max(s.ceil, ...[...s.neighbours].map((n) => n.ceil))); break;
      case 'Plat_DownWaitUpStay': case 'Plat_DownWaitUpStayLip': for (const s of secs) st.lifts.add(s.id); break;
      default: break; // lights, colours, etc. change nothing the checker cares about
    }
    if (tag && !secs.length && !/^(Light_|Sector_Set|Thing_)/.test(name)) warn(`${name}(${tag}) targets a tag no sector has`);
  }

  function startStates(cols) {
    const mv = makeMover(cols, STEP);
    const sx0 = Math.round(start.x / SUB), sy0 = Math.round(-start.y / SUB);
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const zl = mv.standAt(sx0 + dx, sy0 + dy, start.z);
      if (zl !== null) return [key(sx0 + dx, sy0 + dy, zl)];
    }
    return [];
  }

  function reachedTrigger(tr, at, seen, st) {
    if (tr.kind === 'item') return near(at, tr.x, tr.y, tr.z, 24, -16, 56);
    if (tr.kind === 'use') {
      if (tr.needKey && !st.keys.has(tr.needKey)) return false;
      if (tr.needMask) { for (let b = 0; b < 16; b++) if ((tr.needMask >> b) & 1 && !st.objectives.has(b + 1)) return false; }
      if (tr.gate) { const need = tr.gate.mask; for (let b = 0; b < 16; b++) if ((need >> b) & 1 && !st.objectives.has(b + 1)) return false; }
      return near(at, tr.x, tr.y, tr.z, tr.rad || 48, -24, 72);
    }
    if (tr.kind === 'monster') {
      if (tr.requires && !st.objectives.has(tr.requires)) return false;
      return near(at, tr.x, tr.y, tr.z, tr.rad || 128, -128, 128);
    }
    if (tr.kind === 'enter') {
      for (const [k] of at) if (subSec[k].some((s) => s.id === tr.sid)) return true;
      return false;
    }
    return false;
  }

  // run the fixpoint from given start states and world state. Returns the final state + per-iteration history.
  function solve(starts0, st0, wantHistory) {
    const st = cloneState(st0);
    const history = [];
    let res, cols;
    for (let iter = 0; iter < 64; iter++) {
      cols = buildColumns(st);
      const starts = starts0 || startStates(cols);
      res = bfs(starts, cols, STEP, wantHistory);
      const at = indexStates(res.seen);
      if (wantHistory) history.push({ state: cloneState(st), res, cols, starts });
      let changed = false;
      for (let i = 0; i < triggers.length; i++) {
        if (st.fired.has(i)) continue;
        const tr = triggers[i];
        if (!reachedTrigger(tr, at, res.seen, st)) continue;
        st.fired.add(i); changed = true;
        if (tr.key) st.keys.add(tr.key);
        if (tr.objective) st.objectives.add(tr.objective);
        if (tr.effect) applyEffect(st, tr.effect);
        if (tr.gate) applyEffect(st, { special: 11, args: [tr.gate.tag, 16] });
      }
      if (!changed) break;
    }
    return { st, res, cols, history, at: indexStates(res.seen) };
  }

  const main = solve(null, newState(), true);
  const { st, res, cols, at } = main;
  if (!main.history[0].starts.length) { fail(`player start at (${start.x},${start.y}) is not a valid standing position`); return rep; }

  // ---- results
  if (exits.length && !st.exit) fail('the exit is NOT reachable');
  const pos = (t) => `col ${t.col} row ${t.row}`;
  const clamber = bfs(res.seen, cols, CLAMBER, false);
  const atC = indexStates(clamber.seen);
  const monsters = {}, unreachable = [];
  for (const t of lv.things) {
    const k = Math.floor(-t.y / SUB) * W + Math.floor(t.x / SUB);
    if (!cols[k] && t.cls !== 'Curtain') {
      const s = subSec[k];
      if (!(s.length && s[0].kind === 'window')) warn(`${t.cls} at ${pos(t)} sits in a wall or a closed door`);
    }
    if (MONSTERS.has(t.cls)) monsters[t.cls] = (monsters[t.cls] || 0) + 1;
    let ok = true, need = false, clamberOnly = false;
    if (MONSTERS.has(t.cls) || NPCS.has(t.cls)) {
      need = true;
      const fly = FLYERS.has(t.cls);
      ok = near(at, t.x, t.y, t.z, t.cls === 'HiveMind' ? 256 : 96, fly ? -512 : -96, fly ? 512 : 96);
      if (!ok && near(atC, t.x, t.y, t.z, 96, -96, 96)) { ok = true; clamberOnly = true; }
    } else if (t.meta.key || t.meta.objective || t.cls === 'HackTerminal' || t.cls === 'ExitGate' || t.cls === 'Helicopter') {
      need = true;
      ok = near(at, t.x, t.y, t.z, t.cls === 'HackTerminal' ? 64 : (t.cls === 'ExitGate' || t.cls === 'Helicopter') ? 128 : 48, -24, 72);
    } else if (t.cls === 'SafeZone') {
      ok = near(at, t.x, t.y, t.z, 64, -64, 96);
      if (!ok) warn(`SafeZone at ${pos(t)} is unreachable`);
    } else if (isPickup(t.cls)) {
      ok = near(at, t.x, t.y, t.z, 24, -16, 56);
      if (!ok && near(atC, t.x, t.y, t.z, 24, -16, 56)) { ok = true; clamberOnly = true; }
      if (!ok) warn(`pickup ${t.cls} at ${pos(t)} is unreachable`);
    }
    if (clamberOnly) rep.info.push(`${t.cls} at ${pos(t)} needs a clamber`);
    if (need && !ok) { fail(`${t.cls} at ${pos(t)} is unreachable`); unreachable.push(t); }
  }
  for (const [i, tr] of triggers.entries()) {
    if (!st.fired.has(i) && (tr.kind === 'use' || tr.kind === 'enter') && !tr.thing) warn(`trigger ${tr.name} never fires`);
  }
  for (const k of ['blue', 'red', 'yellow']) {
    const doors = lv.sectors.filter((s) => s.kind === 'door' && s.lock === k);
    if (doors.length && !st.keys.has(k)) fail(`${k} door(s) at ${doors.map((d) => d.pieces[0].c + ',' + d.pieces[0].r).join(' ')} but the ${k} key is never obtainable`);
  }

  // ---- softlocks: every reachable position must still reach an exit
  const exitStatesOf = (h) => {
    const set = [];
    const atH = indexStates(h.res.seen);
    for (const s of h.res.seen) {
      const [sx, sy, z] = unkey(s);
      const one = new Map([[sy * W + sx, [z]]]);
      for (const ex of exits) {
        if (ex.kind === 'enter') { if (subSec[sy * W + sx].some((q) => q.id === ex.sid)) set.push(s); }
        else if (near(one, ex.x, ex.y, ex.z, ex.rad || 48, -24, 72)) set.push(s);
      }
    }
    return set;
  };
  const reverseReach = (edges, targets) => {
    const rev = new Map();
    for (const [a, outs] of edges) for (const b of outs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
    const seen = new Set(targets), q = [...targets];
    for (let i = 0; i < q.length; i++) for (const p of rev.get(q[i]) || []) if (!seen.has(p)) { seen.add(p); q.push(p); }
    return seen;
  };
  let softlocks = 0;
  if (st.exit) {
    // final state: must be able to get from anywhere reachable to an exit
    const last = main.history[main.history.length - 1];
    const good = reverseReach(last.res.edges, exitStatesOf(last));
    const bad = [...last.res.seen].filter((s) => !good.has(s));
    if (bad.length) {
      softlocks++;
      const [sx, sy, z] = unkey(bad[0]);
      fail(`softlock: ${bad.length} reachable positions cannot reach the exit (e.g. col ${(sx / 2) | 0} row ${(sy / 2) | 0} z ${z})`);
    }
    // earlier states: positions that cannot return to the start must be able to finish from there
    const reported = new Set();
    for (const h of main.history.slice(0, -1)) {
      const back = reverseReach(h.res.edges, h.starts);
      const oneWay = [...h.res.seen].filter((s) => !back.has(s));
      const done = new Set();
      for (const s of oneWay) {
        if (done.has(s)) continue;
        const sub = solve([s], h.state, false);
        for (const t of sub.res.seen) done.add(t);
        if (!sub.st.exit) {
          const [sx, sy, z] = unkey(s);
          const where = `col ${(sx / 2) | 0} row ${(sy / 2) | 0} z ${z}`;
          if (!bad.length && !reported.has(where)) { softlocks++; fail(`softlock: from ${where} (a one-way drop) the level cannot be finished`); }
          reported.add(where);
          break;
        }
      }
    }
  }

  // ---- coverage stats
  const walk = new Uint8Array(N), reached = new Uint8Array(N);
  const mv = makeMover(cols, STEP);
  for (let sy = 1; sy < H; sy++) for (let sx = 1; sx < W; sx++) {
    const c = cols[sy * W + sx];
    if (!c || c.scenery) continue;
    let ok = false;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      for (const z of c.surf) if (mv.clear(sx + ox, sy + oy, z)) { ok = true; break; }
      if (ok) break;
    }
    if (ok) walk[sy * W + sx] = 1;
  }
  let dmg = 0;
  for (const s of res.seen) {
    const [sx, sy] = unkey(s);
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) reached[(sy + dy) * W + sx + dx] = 1;
  }
  let nWalk = 0, nReach = 0;
  for (let k = 0; k < N; k++) {
    if (walk[k]) { nWalk++; if (reached[k]) nReach++; }
    if (reached[k] && cols[k] && cols[k].damage) dmg++;
  }
  // ---- lint: 1-cell-wide passages (legal in the engine, miserable to walk through)
  {
    const secAt = (r, c) => { const cell = lv.cells[r] && lv.cells[r][c]; if (cell && cell.kind === 'diag') return { kind: 'door', p: {} }; return cell && cell.pieces && cell.pieces.F ? cell.pieces.F.sector : null; };
    const surfs = (x) => [x.floor, ...(x.slabs || []).map((sl) => sl.z1)];
    const open = (a, b) => b && (b.kind === 'door' || b.kind === 'lift' || (b.kind !== 'window' && !b.p.block && surfs(a).some((fa) => surfs(b).some((fb) => Math.abs(fb - fa) <= 24))));
    const squeezes = [];
    for (let r = 1; r < lv.H - 1; r++) for (let c = 1; c < lv.W - 1; c++) {
      const S = secAt(r, c);
      if (!reached[(r * 2) * W + c * 2] && !reached[(r * 2 + 1) * W + c * 2 + 1]) continue;
      if (!S || S.kind === 'door' || S.kind === 'window' || S.kind === 'stairs' || S.ceil - S.floor < 56 || S.p.scenery) continue;
      const w = open(S, secAt(r, c - 1)), e = open(S, secAt(r, c + 1)), n = open(S, secAt(r - 1, c)), so = open(S, secAt(r + 1, c));
      if ((!w && !e && n && so) || (!n && !so && w && e)) squeezes.push(`col ${c} row ${r}`);
    }
    if (squeezes.length) warn(`${squeezes.length} one-cell-wide squeeze(s), e.g. ${squeezes.slice(0, process.env.MAPC_DEBUG ? 999 : 4).join("; ")}`);
  }

  if (dmg) rep.info.push(`the reachable area includes ${dmg * 256} sq units of damaging floor`);
  const secrets = lv.sectors.filter((s) => s.p && s.p.secret && s.kind !== 'door');
  const reachedC = new Uint8Array(N);
  for (const s of clamber.seen) { const [sx, sy] = unkey(s); for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) reachedC[(sy + dy) * W + sx + dx] = 1; }
  const hit = (arr, s) => s.pieces.some((p) => arr[(p.r * 2) * W + p.c * 2] || arr[(p.r * 2 + 1) * W + p.c * 2 + 1] || arr[(p.r * 2) * W + p.c * 2 + 1] || arr[(p.r * 2 + 1) * W + p.c * 2]);
  for (const s of secrets) {
    if (hit(reached, s)) continue;
    if (hit(reachedC, s)) rep.info.push(`secret '${s.char}' at col ${s.pieces[0].c} row ${s.pieces[0].r} needs a clamber`);
    else warn(`secret '${s.char}' at col ${s.pieces[0].c} row ${s.pieces[0].r} is unreachable`);
  }
  rep.stats = {
    reachablePct: nWalk ? (100 * nReach / nWalk) : 0, walkSub: nWalk, reachSub: nReach,
    monsters, secrets: secrets.length, keys: [...st.keys], objectives: [...st.objectives].sort(), exit: st.exit,
    iterations: main.history.length, softlocks, clamberExtra: clamber.seen.size - res.seen.size,
  };
  rep.walk = walk; rep.reached = reached; rep.W = W; rep.H = H;
  return rep;
}
