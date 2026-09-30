// Levels, story and scripting.
//
// Each level is DATA: a terrain function, axis-aligned collision boxes (with a
// `look` telling the renderer what shaped mesh to dress them in: bevelled
// panel, rock, container, pod, barrier...), render-only dressing (`deco`),
// enemy groups, pickups, destructible targets and a linear `sequence` of
// objectives. The sim never sees the art; the renderer never sees the AI.
//
// Axes: x east, y up, z south. Missions run north (toward -z). yaw 0 faces -z.
import { mulberry32 } from './utils.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

class LB {
  constructor() { this.boxes = []; this.deco = []; this.lights = []; }
  box(x0, y0, z0, x1, y1, z1, mat = 'metal', o = {}) {
    const b = { min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], mat, ...o };
    this.boxes.push(b);
    return b;
  }
  // footprint centre (cx, cz), size w × d, from y0 up h
  at(cx, cz, w, d, y0, h, mat, o) { return this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, mat, o); }
  // stairs rising along dir from (x0,z0)-(x1,z1) footprint, y0 → y1
  stairs(x0, z0, x1, z1, dir, y0, y1, n, mat = 'metal', o = {}) {
    const rise = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const top = y0 + rise * (i + 1);
      const f0 = i / n, f1 = (i + 1) / n;
      if (dir === '+x') this.box(lerp(x0, x1, f0), y0 - 0.2, z0, x1, top, z1, mat, { look: 'step', ...o });
      if (dir === '-x') this.box(x0, y0 - 0.2, z0, lerp(x1, x0, f0), top, z1, mat, { look: 'step', ...o });
      if (dir === '+z') this.box(x0, y0 - 0.2, lerp(z0, z1, f0), x1, top, z1, mat, { look: 'step', ...o });
      if (dir === '-z') this.box(x0, y0 - 0.2, z0, x1, top, lerp(z1, z0, f0), mat, { look: 'step', ...o });
      void f1;
    }
  }
  deco1(kind, x, y, z, o = {}) { this.deco.push({ kind, p: [x, y, z], ...o }); }
  light(x, y, z, color, intensity = 1, dist = 18) { this.lights.push({ p: [x, y, z], color, intensity, dist }); }
}

// ======================================================================
// MISSION 1 — FALLEN HYMN (downed ship)
// ======================================================================
function fallenHymn() {
  const b = new LB();
  const terrain = (x, z) => {
    const ax = Math.abs(x);
    let h = 0.9 * Math.sin(x * 0.06 + 1) * Math.cos(z * 0.045) + 0.5 * Math.sin(x * 0.15 + z * 0.11) + 0.3 * Math.sin(z * 0.2 - x * 0.05);
    h -= 1.6 * Math.exp(-((x + 18) ** 2 + (z + 8) ** 2) / 30); // crater
    h -= 1.1 * Math.exp(-((x - 16) ** 2 + (z + 40) ** 2) / 22);
    // the road deck at the start
    h = lerp(h, 0, 1 - ss(4, 10, Math.abs(z - 13)));
    // the crash trench: the ship ploughed in from the south
    const k = ss(-30, -42, z) * (1 - ss(-80, -86, z));
    if (k > 0) {
      const trench = ax < 9 ? -1.1 + ax * 0.08 : ax < 15 ? 1.8 * Math.sin(Math.PI * (ax - 9) / 6) : 0;
      h = lerp(h, trench + (ax < 15 ? 0 : h), k * (ax < 15 ? 1 : 0.2));
    }
    // flatten under the ship and the east basin, then the ridge of ploughed
    // earth + hills that pen the ship in (the only way past is through it)
    const inShipZ = ss(-78, -86, z);
    if (inShipZ > 0 && ax < 22) h = lerp(h, 0, inShipZ * (1 - ss(16.5, 22, ax)));
    if (z < -86 && x > 14) h = lerp(h, 0.2 * Math.sin(x * 0.2) * Math.cos(z * 0.13), ss(-86, -92, z) * (1 - ss(50, 58, x)));
    if (x > 15) h += 9 * Math.exp(-((z + 81) ** 2) / 9) * ss(15.5, 17, x);
    if (x < -15) h += 11 * inShipZ * ss(-16, -24, x) + 3 * Math.sin(z * 0.08) * inShipZ * ss(-20, -30, x);
    // world edges
    h += Math.max(0, ax - 44) ** 1.4 * 0.55 + Math.max(0, z - 26) ** 1.4 * 0.6 + Math.max(0, -154 - z) ** 1.4 * 0.9;
    return h;
  };

  // --- the broken overpass at the start
  for (const px of [-24, -8, 8, 24]) { b.at(px, 13, 1.4, 1.4, -0.5, 5.6, 'concrete', { look: 'pillar' }); }
  b.box(-34, 5, 9, -2, 5.9, 17, 'concrete', { look: 'deck' });
  b.box(6, 5, 9, 34, 5.9, 17, 'concrete', { look: 'deck' });
  b.deco1('slab', 2, 0, 12, { w: 7, d: 8, rotZ: -0.5, rotY: 0.2 }); // the fallen span leaning into the gap
  b.at(2.5, 12.5, 4, 5, -0.5, 1.6, 'concrete', { look: 'none' });
  for (const [x, z, w] of [[-17, 4, 6], [-4, 4, 4], [13, 4, 6], [-26, -2, 5]]) b.at(x, z, w, 0.7, -0.3, 1.2, 'concrete', { look: 'barrier' });
  b.at(-12, 7, 2.0, 4.4, -0.2, 1.5, 'wreck', { look: 'car', burning: true });
  b.at(15, -2, 2.0, 4.4, -0.2, 1.5, 'wreck', { look: 'car', rotY: 0.4 });
  b.at(-28, 9, 2.0, 4.4, -0.2, 1.5, 'wreck', { look: 'car' });
  b.deco1('streetlight', -30, 0, 6); b.deco1('streetlight', 30, 0, 6, { broken: true });
  b.deco1('fire', -12, 1.4, 7, { s: 1.2 }); b.deco1('smoke', -12, 2, 7);

  // --- debris field (hull chunks torn off in the crash)
  const chunk = (x, z, w, d, h, o = {}) => b.at(x, z, w, d, terrain(x, z) - 0.6, h + 0.6, 'hull', { look: 'chunk', ...o });
  chunk(-16, -18, 4, 6, 3); chunk(12, -24, 5, 3, 2.5); chunk(-4, -32, 3, 3, 1.6); chunk(22, -10, 3, 3, 4);
  b.at(6, -6, 2.2, 2.2, terrain(6, -6) - 0.3, 1.4, 'ecs', { look: 'droppod' });
  chunk(-6, -50, 3, 5, 2); chunk(5, -58, 4, 4, 3.5); chunk(-4, -70, 6, 2, 1.2); chunk(7, -76, 2, 2, 2);
  b.deco1('fire', 16, terrain(16, -40), -40, { s: 1.6 }); b.deco1('smoke', 16, terrain(16, -40) + 2, -40, { big: true });
  b.deco1('fire', -20, terrain(-20, -60), -60); b.deco1('smoke', -2, 14, -118, { big: true });

  // --- the ship: "HYMN OF ASH", a Vyrr assault carrier, nose torn open
  // Colliders reach out to the curved outer shell (x ±16.5); the room inside is x ±12.5.
  const X0 = -16.5, X1 = 16.5, XI = 12.5, Z0 = -152, Z1 = -82, H = 11, F = 0.25;
  b.deco1('hull', 0, 0, 0, { x0: X0, x1: X1, z0: Z0, z1: Z1, door: [-133, -125] });
  b.box(X0, 0, Z0, -XI, H, Z1, 'hullIn', { look: 'wall' });
  b.box(XI, 0, Z0, X1, H, -133, 'hullIn', { look: 'wall' });
  b.box(XI, 0, -125, X1, H, Z1, 'hullIn', { look: 'wall' });
  b.box(XI, 4.2, -133, X1, H, -125, 'hullIn', { look: 'wall' });
  b.box(XI, F, -133, XI + 0.6, 4.2, -125, 'door', { look: 'door', door: 'd2' });
  b.box(X0, 0, Z1 - 1.5, -3.5, H, Z1, 'hullIn', { look: 'wall' });
  b.box(3.5, 0, Z1 - 1.5, X1, H, Z1, 'hullIn', { look: 'wall' });
  b.box(-3.5, 5, Z1 - 1.5, 3.5, H, Z1, 'hullIn', { look: 'wall' });
  b.box(X0, 0, Z0, X1, H, Z0 + 1.5, 'hullIn', { look: 'wall' });
  b.box(X0, H - 1, Z0, X1, H, Z1, 'hullIn', { look: 'ceiling' });
  b.box(-XI, 0, Z0 + 1.5, XI, F, Z1 - 1.5, 'alienFloor', { look: 'floor' });
  b.box(XI, 0, -133, X1, F, -125, 'alienFloor', { look: 'floor' }); // the breach tunnel floor
  // the torn nose overhangs the breach: invisible side walls under it
  b.box(X0 - 1.2, 0, Z1, X0, 12, Z1 + 7, 'hull', { look: 'none' });
  b.box(X1, 0, Z1, X1 + 1.2, 12, Z1 + 7, 'hull', { look: 'none' });
  // entry hall → bulkhead 1 (door d1)
  b.box(-12.5, F, -101, -2, 10, -100, 'hullIn', { look: 'bulkhead' });
  b.box(2, F, -101, 12.5, 10, -100, 'hullIn', { look: 'bulkhead' });
  b.box(-2, 4, -101, 2, 10, -100, 'hullIn', { look: 'bulkhead' });
  b.box(-2, F, -101, 2, 4, -100, 'door', { look: 'door', door: 'd1' });
  for (const [x, z] of [[-7, -89], [6, -91], [-2, -95], [9, -97], [-9, -97]]) b.at(x, z, 2.2, 1.2, F, 1.15, 'alien', { look: 'console' });
  b.deco1('hullRibs', 0, 0, 0, { x0: -XI, x1: XI, z0: Z0 + 1.5, z1: Z1 - 1.5, h: H - 1, every: 6 });
  // corridor with side bays
  for (const sx of [-1, 1]) {
    b.box(sx * 3, F, -118, sx * 3.5, 6, -112, 'hullIn', { look: 'wall' });
    b.box(sx * 3, F, -108, sx * 3.5, 6, -101, 'hullIn', { look: 'wall' });
  }
  for (const [x, z, w, d, h] of [[-8, -105, 2, 2, 1.4], [-9, -115, 1.6, 1.6, 2.4], [8, -106, 2, 2, 1.4], [9, -114, 2, 1.6, 2]]) b.at(x, z, w, d, F, h, 'pod', { look: 'pod' });
  // bulkhead 2 (open arch)
  b.box(-12.5, F, -119, -3, 10, -118, 'hullIn', { look: 'bulkhead' });
  b.box(3, F, -119, 12.5, 10, -118, 'hullIn', { look: 'bulkhead' });
  b.box(-3, 6, -119, 3, 10, -118, 'hullIn', { look: 'bulkhead' });
  // reactor chamber
  b.at(0, -135, 3, 3, F, 9.75, 'core', { look: 'core' });
  b.at(0, -131, 2.4, 1.0, F, 1.1, 'alien', { look: 'console', key: true });
  for (const [x, z] of [[-7, -125], [7, -125], [-7, -143], [7, -143]]) b.at(x, z, 2, 2, F, 1.5, 'pod', { look: 'pod' });
  for (const sx of [-1, 1]) {
    const xi = sx * 9.5, xo = sx * 12.5;
    b.box(xi, 3.8, -148, xo, 4.1, -121, 'grate', { look: 'catwalk' });
    b.box(xi, 4.1, -144, xi - sx * 0.12, 5.0, -121, 'grate', { look: 'rail' });
    b.stairs(sx > 0 ? 3.5 : -9.5, -148, sx > 0 ? 9.5 : -3.5, -146, sx > 0 ? '+x' : '-x', F, 4.1, 12, 'grate');
  }
  b.light(0, 6, -135, 0x66ff99, 2.2, 26); b.light(0, 7, -92, 0xb070ff, 1.3, 22); b.light(0, 5, -110, 0x66ff99, 1.0, 18);

  // exterior east basin + LZ
  const rock = (x, z, w, d, h) => b.at(x, z, w, d, terrain(x, z) - 0.6, h + 0.6, 'rock', { look: 'rock' });
  chunk(24, -120, 3, 3, 2); rock(30, -138, 4, 2, 1.5); chunk(44, -116, 2, 2, 3); rock(46, -140, 3, 3, 2); rock(20, -142, 2.5, 2.5, 1.3);
  b.deco1('condor', 38, 7, -128, { hover: true });
  b.deco1('smoke', 40, 20, -60, { big: true }); b.deco1('smoke', -40, 18, -110, { big: true });

  const groups = {
    a1: [{ t: 'skitter', p: [-10, -20] }, { t: 'skitter', p: [-14, -23] }, { t: 'skitter', p: [4, -27] },
      { t: 'trooper', p: [-2, -30], w: 'carbine' }, { t: 'skitter', p: [22, terrain(22, -10) + 4, -10], w: 'needler' }],
    a2: [{ t: 'drone', p: [0, 9, -60] }, { t: 'drone', p: [-6, 10, -62] }, { t: 'drone', p: [6, 9, -58] }],
    b1: [{ t: 'trooper', p: [-6, -63], w: 'needler' }, { t: 'skitter', p: [5, terrain(5, -58) + 3.5, -58] },
      { t: 'skitter', p: [-2, -66] }, { t: 'skitter', p: [8, -68] }, { t: 'skitter', p: [0, -79] }],
    c1: [{ t: 'trooper', p: [-6, -94], w: 'carbine' }, { t: 'trooper', p: [6, -96], w: 'caster', g: 2 }, { t: 'skitter', p: [-9, -90] }, { t: 'skitter', p: [9, -88] }],
    c2: [{ t: 'skitter', p: [-8, -110] }, { t: 'skitter', p: [8, -111] }, { t: 'trooper', p: [0, -114], w: 'needler' }, { t: 'drone', p: [0, 6, -110] }],
    c3: [{ t: 'skitter', p: [-11, 4.1, -130], w: 'needler' }, { t: 'skitter', p: [11, 4.1, -138] }, { t: 'trooper', p: [-6, -140], w: 'carbine' },
      { t: 'trooper', p: [6, -128] }, { t: 'skitter', p: [0, -146] }],
    c4: [{ t: 'heavy', p: [0, -147.5] }, { t: 'trooper', p: [6, -146], w: 'carbine', g: 2 }, { t: 'skitter', p: [9, -147] }],
    e1: [{ t: 'trooper', p: [30, -119], w: 'carbine' }, { t: 'trooper', p: [42, -134], w: 'needler', g: 1 }, { t: 'skitter', p: [26, -133] },
      { t: 'skitter', p: [36, -112] }, { t: 'skitter', p: [47, -126] }, { t: 'drone', p: [40, 8, -140] }, { t: 'drone', p: [34, 9, -118] }],
  };

  return {
    id: 'fallen-hymn', name: 'FALLEN HYMN', loc: 'PUGET SOUND INDUSTRIAL ZONE // TACOMA, EARTH', theme: 'dusk',
    bounds: { x0: -60, z0: -170, x1: 60, z1: 34 }, terrain: { res: 1.5, fn: terrain, ground: 'scorched' },
    boxes: b.boxes, deco: b.deco, lights: b.lights, water: [],
    sky: { top: 0x2b2f52, horizon: 0xe88a4a, bottom: 0x3a2a2a, sun: [0.55, 0.18, -0.8], sunColor: 0xffb070, fog: 0x8a5a48, fogDensity: 0.0105,
      hemiSky: 0xffc8a0, hemiGround: 0x3a3040, sunIntensity: 2.2, skyline: 'city', ships: true, stars: false },
    player: { pos: [0, 26], yaw: 0, loadout: ['rifle', 'sidearm'], frags: 2, plasmas: 0 },
    pickups: [
      { type: 'health', pos: [-19, -16] }, { type: 'weapon', weapon: 'burst', pos: [7.5, -4.2] }, { type: 'grenade', g: 'frag', n: 2, pos: [4.5, -4.5] },
      { type: 'health', pos: [-10, -74] }, { type: 'health', pos: [10, -104] }, { type: 'grenade', g: 'plasma', n: 2, pos: [-10, -117] },
      { type: 'weapon', weapon: 'shotgun', pos: [-11, -86] }, { type: 'health', pos: [-11, -121] }, { type: 'health', pos: [24, -124] },
      { type: 'weapon', weapon: 'rifle', pos: [22, -130] }, { type: 'grenade', g: 'frag', n: 2, pos: [21, -131] },
    ],
    groups,
    sequence: [
      { obj: 'Reach the crash site', wp: [0, 1, -40], start: { spawn: ['a1'], say: [
        ['hale', 'Anvil, this is Hale. Ground batteries brought down a Vyrr assault carrier, the HYMN OF ASH, on the Tacoma flats.'],
        ['hale', 'Its navigation core carries a Resonance Key: the map to every Vyrr ship over Earth. Get it before they scuttle her.'],
        ['iris', 'IRIS-2 online. I am a fork of the IRIS that rode with Snake. All of her memories, none of her patience.'],
        ['iris', 'Your shield recharges if you stop taking hits. Your health does not. Look for medical packs.'],
      ] }, until: { type: 'reach', pos: [0, -36], r: 14 }, checkpoint: true },
      { obj: 'Push down the crash trench to the hull breach', wp: [0, 1.5, -84], start: { spawn: ['a2', 'b1'], say: [
        ['iris', 'Drones inbound from the wreck. They are fragile. Knock them out of the air.'],
      ] }, until: { type: 'reach', pos: [0, -88], r: 5 }, checkpoint: true },
      { obj: 'Clear the entry hall', wp: null, start: { spawn: ['c1'], say: [
        ['snake', 'Anvil, Snake. I walked the Hollow Choir alone. You have a squad of one and a better gun. Kept it quiet then. Not today.'],
      ] }, until: { type: 'clear', groups: ['c1'] }, done: { open: ['d1'], say: [['iris', 'Bulkhead unlocked. The reactor chamber is aft.']] }, checkpoint: true },
      { obj: 'Find the reactor chamber', wp: [0, 1, -120], start: { spawn: ['c2', 'c3'] }, until: { type: 'reach', pos: [0, -122], r: 5 } },
      { obj: 'Extract the Resonance Key', wp: [0, 1.4, -131], start: { say: [['iris', 'The key is seated in the console at the base of the core. Clear the room and hold ACTION there.']] },
        until: { type: 'use', pos: [0, -131.2], r: 2.4, label: 'EXTRACT RESONANCE KEY' },
        done: { spawn: ['c4'], open: ['d2'], say: [
          ['iris', 'Key extracted. And... the reactor is venting. Bulwark signature, aft bay. Two tonnes of armour. Its back is soft.'],
          ['hale', 'Condor-2 is inbound east of the wreck. There is a hull breach on the starboard side. Move.'],
        ] }, checkpoint: true },
      { obj: 'Escape through the starboard breach', wp: [13, 1.5, -129], until: { type: 'reach', pos: [18, -129], r: 4 }, checkpoint: true },
      { obj: 'Reach Condor-2 at the LZ', wp: [38, 1, -128], start: { spawn: ['e1'], say: [['condor', 'Condor-2 on station. LZ is hot. Clear it and I will put down.']] },
        until: { type: 'reach', pos: [38, -128], r: 7, needClear: ['e1'] }, end: true },
    ],
    debrief: [['hale', 'The Resonance Key is ours. Every Vyrr ship on Earth just showed up on our board.'], ['iris', 'And one of them is not a ship. It is a warehouse in Rotterdam.']],
  };
}

// ======================================================================
// MISSION 2 — COLD STORAGE (alien warehouse)
// ======================================================================
function coldStorage() {
  const b = new LB();
  const rng = mulberry32(21);
  const terrain = (x, z) => (x > 44 ? -3 : 0) + 0.02 * Math.sin(x * 0.7) * Math.sin(z * 0.6);
  const colors = ['c_red', 'c_blue', 'c_orange', 'c_green', 'c_grey'];
  const cont = (x, z, along, stack = 1) => {
    for (let s = 0; s < stack; s++) {
      const [w, d] = along === 'z' ? [2.5, 6] : [6, 2.5];
      b.at(x, z, w, d, s * 2.6, 2.6, colors[Math.floor(rng() * colors.length)], { look: 'container', along });
    }
  };
  // container yard
  cont(-20, 22, 'z', 2); cont(-8, 18, 'z'); cont(10, 20, 'z', 2); cont(22, 14, 'z'); cont(-26, 2, 'z'); cont(-14, 4, 'x'); cont(0, 7, 'z');
  cont(14, 2, 'x'); cont(26, -4, 'z', 2); cont(-22, -12, 'x'); cont(-6, -12, 'z'); cont(8, -15, 'x'); cont(20, -18, 'z'); cont(-32, -20, 'z', 2); cont(34, 18, 'x');
  b.deco1('crane', 40, 0, 0); b.deco1('quay', 44, 0, 0);
  for (const z of [26, 8, -10]) b.deco1('streetlight', -38, 0, z, { color: 0xffd7a0 });
  // fences that force the way through the warehouse
  b.box(-50, 0, -31, -32, 4, -30, 'fence', { look: 'fence' });
  b.box(32, 0, -31, 50, 4, -30, 'fence', { look: 'fence' });
  // the warehouse shell
  const WX = 32, WZ0 = -125, WZ1 = -30, WH = 12;
  b.deco1('warehouse', 0, 0, 0, { x0: -WX, x1: WX, z0: WZ0, z1: WZ1, h: WH });
  b.box(-WX, 0, WZ1 - 1, -7, WH, WZ1, 'brick', { look: 'wall' });
  b.box(7, 0, WZ1 - 1, WX, WH, WZ1, 'brick', { look: 'wall' });
  b.box(-7, 8, WZ1 - 1, 7, WH, WZ1, 'brick', { look: 'wall' });
  b.box(-WX, 0, WZ0, -5, WH, WZ0 + 1, 'brick', { look: 'wall' });
  b.box(5, 0, WZ0, WX, WH, WZ0 + 1, 'brick', { look: 'wall' });
  b.box(-5, 7, WZ0, 5, WH, WZ0 + 1, 'brick', { look: 'wall' });
  b.box(-5, 0, WZ0, 5, 7, WZ0 + 1, 'shutter', { look: 'shutter', door: 'dBack' });
  b.box(-WX, 0, WZ0, -WX + 1, WH, WZ1, 'brick', { look: 'wall' });
  b.box(WX - 1, 0, WZ0, WX, WH, WZ1, 'brick', { look: 'wall' });
  b.box(-WX, WH, WZ0, WX, WH + 0.6, WZ1, 'roof', { look: 'roof' });
  // catwalks + stairs
  for (const sx of [-1, 1]) {
    const xo = sx * (WX - 1), xi = sx * 27;
    b.box(xi, 5, -122, xo, 5.3, -34, 'grate', { look: 'catwalk' });
    b.box(xi, 5.3, -122, xi - sx * 0.12, 6.3, -64, 'grate', { look: 'rail' });
    b.box(xi, 5.3, -48, xi - sx * 0.12, 6.3, -34, 'grate', { look: 'rail' });
    b.stairs(sx > 0 ? 25 : -27, -50, sx > 0 ? 27 : -25, -63, '-z', 0, 5.3, 15, 'grate');
  }
  // aisles of Vyrr cargo pods
  for (const ax of [-18, -8, 8, 18]) {
    for (const [z, stack] of [[-41, 2], [-45.4, 1], [-53, 1], [-57.4, 2], [-65, 1]]) {
      for (let s = 0; s < stack; s++) b.at(ax, z, 2.2, 2.2, s * 2.6, 2.6, 'pod', { look: 'pod' });
    }
  }
  // middle hall cover
  for (const [x, z] of [[-6, -80], [6, -80], [-16, -97], [16, -97], [0, -103]]) b.at(x, z, 2.4, 1.4, 0, 1.2, 'crate', { look: 'crate' });
  b.at(-14, -110, 4, 2.5, 0, 1.6, 'alien', { look: 'sled' }); b.at(14, -112, 4, 2.5, 0, 1.6, 'alien', { look: 'sled' });
  b.at(-24, -116, 2.2, 2.2, 0, 2.6, 'pod', { look: 'pod' }); b.at(-24, -116, 2.2, 2.2, 2.6, 2.6, 'pod', { look: 'pod' });
  b.at(24, -104, 2.2, 2.2, 0, 2.6, 'pod', { look: 'pod' });
  for (let z = -40; z >= -118; z -= 13) { b.light(-14, 10, z, 0xdde6ff, 0.8, 20); b.light(14, 10, z, 0xdde6ff, 0.8, 20); }
  b.light(0, 5, -88, 0xb070ff, 1.6, 24);
  b.deco1('rain', 0, 0, 0);

  const targets = [
    { id: 'em1', pos: [-12, 0, -86], r: 1.2, h: 5, hp: 160, kind: 'emitter' },
    { id: 'em2', pos: [0, 0, -92], r: 1.2, h: 5, hp: 160, kind: 'emitter' },
    { id: 'em3', pos: [12, 0, -86], r: 1.2, h: 5, hp: 160, kind: 'emitter' },
  ];
  for (const t of targets) b.at(t.pos[0], t.pos[2], 1.8, 1.8, 0, 4.6, 'alien', { look: 'none', target: t.id });

  const groups = {
    a1: [{ t: 'skitter', p: [-6, 0] }, { t: 'skitter', p: [8, -6] }, { t: 'trooper', p: [2, -20], w: 'carbine' },
      { t: 'skitter', p: [-20, 5.2, 22], w: 'needler', yaw: 0.3 }, { t: 'drone', p: [0, 6, -24] }],
    b1: [{ t: 'trooper', p: [-10, -47], w: 'caster', g: 2 }, { t: 'skitter', p: [-4, -42] }, { t: 'skitter', p: [4, -44] },
      { t: 'skitter', p: [-29, 5.3, -50] }, { t: 'skitter', p: [29, 5.3, -58], w: 'needler' }, { t: 'trooper', p: [12, -61], w: 'needler' }],
    b2: [{ t: 'skitter', p: [-13, -60] }, { t: 'skitter', p: [13, -66] }, { t: 'drone', p: [-6, 7, -70] }, { t: 'drone', p: [6, 7, -72] }],
    c1: [{ t: 'trooper', p: [-4, -96], w: 'carbine' }, { t: 'trooper', p: [8, -99], w: 'needler', g: 1 }, { t: 'skitter', p: [-14, -92] },
      { t: 'skitter', p: [14, -91] }, { t: 'skitter', p: [-29, 5.3, -92] }, { t: 'skitter', p: [29, 5.3, -100], w: 'needler' }],
    c2: [{ t: 'heavy', p: [-3, -130] }, { t: 'heavy', p: [3, -130] }, { t: 'skitter', p: [-9, -129] }, { t: 'skitter', p: [9, -129] }],
  };
  return {
    id: 'cold-storage', name: 'COLD STORAGE', loc: 'MAASVLAKTE CONTAINER PORT // ROTTERDAM, EARTH', theme: 'night',
    bounds: { x0: -50, z0: -135, x1: 44, z1: 32 }, terrain: { res: 2, fn: terrain, ground: 'asphalt' },
    boxes: b.boxes, deco: b.deco, lights: b.lights, water: [{ x0: 44, z0: -200, x1: 200, z1: 200, y: -1.2 }],
    sky: { top: 0x05070f, horizon: 0x1c2a3a, bottom: 0x05060a, sun: [-0.3, 0.6, 0.5], sunColor: 0x9fb8ff, fog: 0x121a24, fogDensity: 0.02,
      hemiSky: 0x5a6a90, hemiGround: 0x151515, sunIntensity: 0.9, skyline: 'port', ships: true, stars: true, rain: true },
    player: { pos: [0, 28], yaw: 0, loadout: ['rifle', 'sidearm'], frags: 2, plasmas: 1 },
    pickups: [
      { type: 'health', pos: [-24, -20] }, { type: 'grenade', g: 'frag', n: 2, pos: [-3, 12] }, { type: 'weapon', weapon: 'shotgun', pos: [-2, -36] },
      { type: 'health', pos: [0, -74] }, { type: 'health', pos: [-22, -104] }, { type: 'weapon', weapon: 'rifle', pos: [20, -104] },
      { type: 'weapon', weapon: 'burst', pos: [29, 5.3, -110] }, { type: 'grenade', g: 'plasma', n: 2, pos: [-29, 5.3, -80] }, { type: 'health', pos: [22, -60] },
    ],
    targets, groups,
    sequence: [
      { obj: 'Get into the Vyrr depot', wp: [0, 1, -30], start: { spawn: ['a1'], say: [
        ['hale', 'The Resonance Key flagged this warehouse. The Vyrr are not storing cargo in Rotterdam. They are growing something.'],
        ['iris', 'Lullaby seed emitters. Small copies of the array that put the Hollow Choir\'s cities to sleep. Planted here, they would cover half of Europe.'],
      ] }, until: { type: 'reach', pos: [0, -36], r: 7 }, checkpoint: true },
      { obj: 'Find the seed emitters', wp: [0, 1, -74], start: { spawn: ['b1', 'b2'], say: [['iris', 'Hostiles on the catwalks. Mind your flanks, and the high ground.']] },
        until: { type: 'reach', pos: [0, -76], r: 9 }, checkpoint: true },
      { obj: 'Destroy the seed emitters', objCount: true, wp: null, start: { spawn: ['c1'], say: [['iris', 'Three emitters. Bullets will do it. Grenades will do it faster.']] },
        until: { type: 'destroy', targets: ['em1', 'em2', 'em3'] },
        done: { open: ['dBack'], spawn: ['c2'], say: [
          ['iris', 'Emitters down. Something is coming through the rear shutter. Two of them.'],
          ['snake', 'Bulwarks. They fight as a pair. Kill one and the other goes berserk. Get behind them.'],
        ] }, checkpoint: true },
      { obj: 'Defeat the Bulwark pair', wp: null, until: { type: 'clear', groups: ['c2'] }, checkpoint: true },
      { obj: 'Reach the rear dock for extraction', wp: [0, 1, -130], start: { say: [['condor', 'Condor-2, rear dock in thirty. Do not keep me waiting in the rain.']] },
        until: { type: 'reach', pos: [0, -130], r: 5 }, end: true },
    ],
    debrief: [['iris', 'The seed emitters were drawing power from a relay in the French Alps. A spire, deep in the Verdon Gorge.'], ['hale', 'Then that is where you go next.']],
  };
}

// ======================================================================
// MISSION 3 — SONG OF THE GORGE (scenic canyon)
// ======================================================================
export const riverX = (z) => 10 * Math.sin(z * 0.018) + 4 * Math.sin(z * 0.047 + 1);
function songOfTheGorge() {
  const b = new LB();
  const rng = mulberry32(77);
  const ford = (z) => 1 - 0.8 * Math.exp(-((z - 10) ** 2) / 500) - 0.85 * Math.exp(-((z + 196) ** 2) / 260);
  const SZ = -228, SX = riverX(SZ) + 17; // spire plateau
  const BZ = -62, BX = riverX(BZ); // bridge
  const terrain = (x, z) => {
    const d = x - riverX(z), ad = Math.abs(d);
    const n = 0.7 * Math.sin(x * 0.13 + z * 0.07) + 0.5 * Math.sin(z * 0.19 - x * 0.05) + 0.3 * Math.sin(x * 0.31 + z * 0.23);
    let h;
    if (ad < 6) h = 0.35 - 1.9 * ford(z) * (1 - (ad / 6) ** 2);
    else h = 0.35 + (ad - 6) * 0.07 + n * 0.55 * Math.min(1, (ad - 6) / 4);
    const wall = 27 + 4 * Math.sin(z * 0.031) + 2 * Math.sin(z * 0.11);
    if (ad > wall) h += (ad - wall) ** 1.45 * 1.15 + n * 0.8;
    // bridge approach mounds
    h = Math.max(h, 3.45 * Math.exp(-((ad - 10.5) ** 2) / 14 - ((z - BZ) ** 2) / 50));
    // spire plateau (flat top at 5.5) with a gentle ramp on its west side
    const pd = Math.hypot(x - SX, (z - SZ) * 0.85);
    h = Math.max(h, 5.5 * (1 - ss(9, 17, pd)) * (x < SX ? 1 : 1) );
    if (pd < 9) h = 5.5 + 0.1 * n;
    // the ends of the gorge
    h += Math.max(0, z - 26) ** 1.5 * 0.8 + Math.max(0, -246 - z) ** 1.55 * 1.3;
    return h;
  };
  // stone bridge
  b.box(BX - 11.5, 3.35, BZ - 2.2, BX + 11.5, 3.75, BZ + 2.2, 'stone', { look: 'bridge' });
  // rockfall that closes the east bank north of the bridge
  const rf = riverX(-76);
  for (let i = 0; i < 7; i++) {
    const x = rf + 4 + i * 4.2, z = -76 + (rng() - 0.5) * 3;
    b.at(x, z, 4 + rng() * 2, 4 + rng() * 2, terrain(x, z) - 1, 4.5 + rng() * 3, 'rock', { look: 'rock' });
  }
  // west-bank outpost (barricades and pylons)
  for (const [dz, dd, w, h] of [[-86, -14, 4, 1.3], [-94, -22, 1.2, 1.3], [-102, -12, 3, 1.3], [-110, -24, 4, 1.3], [-118, -16, 1.2, 1.3], [-98, -30, 1.2, 1.3]]) {
    const x = riverX(dz) + dd;
    b.at(x, dz, w, w === 1.2 ? 3.5 : 1.0, terrain(x, dz) - 0.3, h + 0.3, 'alien', { look: 'barricade' });
  }
  for (const dz of [-90, -114]) { const x = riverX(dz) - 27; b.deco1('pylon', x, terrain(x, dz), dz); }
  // ambush perches on the east bank
  const perch = (dz, dd, h) => { const x = riverX(dz) + dd; const g = terrain(x, dz); b.at(x, dz, 3.2, 3.2, g - 1, h + 1, 'rock', { look: 'rock' }); return [x, g + h, dz]; };
  const p1 = perch(-148, 14, 4), p2 = perch(-164, 17, 5), p3 = perch(-178, 12, 3.5);
  // scattered boulders for cover
  for (const [dz, dd] of [[-14, 12], [-28, 16], [-36, 9], [-44, 18], [-96, -8], [-104, -18], [-128, -13], [-140, -18], [-156, -10], [-172, -16], [-186, -9], [-210, 14], [-222, 8], [-236, 12]]) {
    const x = riverX(dz) + dd, s = 1.6 + rng() * 1.6;
    b.at(x, dz, s, s * (0.8 + rng() * 0.4), terrain(x, dz) - 0.5, s * 0.8 + 0.5, 'rock', { look: 'rock' });
  }
  // pines on the banks (trunk colliders)
  const trees = [];
  for (let i = 0; i < 150; i++) {
    const z = 20 - rng() * 268, side = rng() < 0.5 ? -1 : 1, dd = side * (8 + rng() * 22);
    const x = riverX(z) + dd;
    if (Math.abs(z - BZ) < 12 && Math.abs(dd) < 16) continue;
    if (Math.hypot(x - SX, z - SZ) < 18) continue;
    if (Math.abs(z + 196) < 10 && Math.abs(dd) < 14) continue;
    if (z > 5 && Math.abs(x - (riverX(28) + 12)) < 6) continue;
    const g = terrain(x, z);
    const d = x - riverX(z);
    if (Math.abs(d) > 27 + 4 * Math.sin(z * 0.031)) continue;
    const s = 0.8 + rng() * 0.7;
    trees.push([x, g, z, s]);
    b.at(x, z, 0.5 * s, 0.5 * s, g - 0.5, 6 * s, 'wood', { look: 'none' });
  }
  b.deco1('pines', 0, 0, 0, { trees });
  // spire
  b.deco1('spire', SX, 5.5, SZ);
  b.at(SX, SZ, 3, 3, 5.4, 8, 'alien', { look: 'none' });
  b.deco1('waterfall', riverX(-252), 0, -252, { w: 16, h: 38 });
  b.deco1('mountains', 0, 0, 0);
  b.deco1('condor', riverX(-192) + 1, 6, -192, { hover: true, late: true });
  const targets = [
    { id: 'cond1', pos: [SX - 6, 5.45, SZ + 1], r: 0.9, h: 3.2, hp: 180, kind: 'conduit' },
    { id: 'cond2', pos: [SX + 6, 5.45, SZ - 1], r: 0.9, h: 3.2, hp: 180, kind: 'conduit' },
    { id: 'core', pos: [SX, 13.4, SZ], r: 1.4, h: 2.4, hp: 220, kind: 'spirecore', lockedBy: ['cond1', 'cond2'], splash: 9 },
  ];
  for (const t of targets.slice(0, 2)) b.at(t.pos[0], t.pos[2], 1.4, 1.4, 5.4, 3.2, 'alien', { look: 'none' });
  const R = (dz, dd) => [riverX(dz) + dd, dz];
  const groups = {
    a1: [{ t: 'skitter', p: R(-24, 10) }, { t: 'skitter', p: R(-30, 16) }, { t: 'skitter', p: R(-37, 8) }, { t: 'trooper', p: R(-42, 13), w: 'carbine' }, { t: 'drone', p: [riverX(-46) + 12, 8, -46] }],
    a2: [{ t: 'trooper', p: R(-68, -14), w: 'needler' }, { t: 'skitter', p: R(-72, -9) }, { t: 'skitter', p: R(-58, -15) }, { t: 'skitter', p: [BX - 6, 3.75, BZ] }],
    b1: [{ t: 'trooper', p: R(-92, -18), w: 'carbine' }, { t: 'trooper', p: R(-108, -22), w: 'caster', g: 2 }, { t: 'skitter', p: R(-88, -12) },
      { t: 'skitter', p: R(-100, -20) }, { t: 'skitter', p: R(-96, -26) }, { t: 'skitter', p: R(-112, -14) }, { t: 'heavy', p: R(-120, -19) }],
    c1: [{ t: 'skitter', p: p1, w: 'needler' }, { t: 'skitter', p: p2, w: 'needler' }, { t: 'skitter', p: p3 }, { t: 'trooper', p: R(-176, -14), w: 'carbine', g: 1 },
      { t: 'drone', p: [riverX(-168), 9, -168] }, { t: 'drone', p: [riverX(-172) - 5, 10, -172] }, { t: 'drone', p: [riverX(-170) + 5, 8, -170] }],
    d1: [{ t: 'trooper', p: [SX - 6, 5.6, SZ + 6], w: 'carbine' }, { t: 'trooper', p: [SX + 6, 5.6, SZ - 7], w: 'needler', g: 1 }, { t: 'skitter', p: [SX - 3, 5.6, SZ + 8] },
      { t: 'skitter', p: [SX + 4, 5.6, SZ + 6] }, { t: 'skitter', p: R(-212, 12) }, { t: 'heavy', p: R(-214, 6) }],
    e1: [{ t: 'drone', p: [riverX(-200) - 8, 10, -200] }, { t: 'drone', p: [riverX(-205), 11, -205] }, { t: 'drone', p: [riverX(-195) + 8, 9, -195] },
      { t: 'trooper', p: R(-182, -10), w: 'carbine' }, { t: 'trooper', p: R(-206, 10), w: 'needler' }],
  };
  return {
    id: 'gorge', name: 'SONG OF THE GORGE', loc: 'VERDON GORGE // PROVENCE, EARTH', theme: 'day',
    bounds: { x0: -75, z0: -262, x1: 75, z1: 36 }, terrain: { res: 1.5, fn: terrain, ground: 'meadow', river: true },
    boxes: b.boxes, deco: b.deco, lights: b.lights, water: [{ x0: -75, z0: -262, x1: 75, z1: 36, y: 0.15, river: true }],
    sky: { top: 0x3f7fd0, horizon: 0xcfe4f4, bottom: 0x6a8a6a, sun: [0.4, 0.7, -0.35], sunColor: 0xfff2d8, fog: 0xb8cee0, fogDensity: 0.0062,
      hemiSky: 0xcfe6ff, hemiGround: 0x5b6a3a, sunIntensity: 2.6, skyline: null, ships: true, stars: false, clouds: true },
    player: { pos: [riverX(24) + 12, 24], yaw: 0.15, loadout: ['burst', 'rifle'], frags: 2, plasmas: 1 },
    pickups: [
      { type: 'health', pos: R(-50, 20) }, { type: 'grenade', g: 'frag', n: 2, pos: R(-54, 16) }, { type: 'weapon', weapon: 'sidearm', pos: R(-8, 14) },
      { type: 'health', pos: R(-80, -20) }, { type: 'weapon', weapon: 'lance', pos: R(-105, -29) }, { type: 'health', pos: R(-130, -20) },
      { type: 'grenade', g: 'plasma', n: 2, pos: R(-132, -22) }, { type: 'health', pos: R(-190, -6) }, { type: 'weapon', weapon: 'shotgun', pos: R(-192, -8) },
      { type: 'health', pos: [SX - 11, SZ + 10] }, { type: 'grenade', g: 'frag', n: 2, pos: R(-200, 8) },
    ],
    targets, groups,
    sequence: [
      { obj: 'Follow the gorge north', wp: [riverX(-45) + 12, 1, -45], start: { spawn: ['a1'], say: [
        ['condor', 'Anvil is on the ground. Condor-2 pulling out; that spire\'s guns are painting me.'],
        ['iris', 'The Hymn Spire is eight hundred metres up the gorge. It relays power to every seed emitter on the continent.'],
        ['iris', 'The river is deep in the middle. In that armour you will sink. Use the bridge.'],
      ] }, until: { type: 'reach', pos: [riverX(-45) + 12, -45], r: 12 }, checkpoint: true },
      { obj: 'Cross the stone bridge', wp: [BX, 4.5, BZ], start: { spawn: ['a2'] }, until: { type: 'reach', pos: [BX - 13, BZ - 2], r: 6 }, checkpoint: true },
      { obj: 'Break the Vyrr outpost', wp: [riverX(-100) - 18, 1.5, -100], start: { spawn: ['b1'], say: [['snake', 'Outpost on the west bank. There is a Bulwark in there. Do not trade shots with its shield.']] },
        until: { type: 'clear', groups: ['b1'] }, checkpoint: true },
      { obj: 'Continue north along the west bank', wp: [riverX(-195), 1, -195], start: { spawn: ['c1'], say: [['iris', 'Shard needlers on the far cliffs. Keep moving, and use the trees.']] },
        until: { type: 'reach', pos: [riverX(-195), -195], r: 10 }, checkpoint: true },
      { obj: 'Destroy the spire conduits', objCount: true, wp: null, start: { spawn: ['d1'], say: [['iris', 'Two power conduits on the plateau feed the spire core. Break them and the core is exposed.']] },
        until: { type: 'destroy', targets: ['cond1', 'cond2'] }, done: { say: [['iris', 'Conduits down. The core shield is failing. Hit the core at the top of the spire.']] }, checkpoint: true },
      { obj: 'Destroy the spire core', wp: null, until: { type: 'destroy', targets: ['core'] },
        done: { spawn: ['e1'], say: [['hale', 'Spire down! Every emitter in Europe just went dark.'], ['condor', 'Condor-2 inbound to the sandbar. Clear me a patch of sky.']] }, checkpoint: true },
      { obj: 'Get to Condor-2 on the sandbar', wp: [riverX(-192) + 1, 1, -192], until: { type: 'reach', pos: [riverX(-192) + 1, -192], r: 8, needClear: ['e1'] }, end: true },
    ],
    debrief: [['snake', 'Three missions, three cities breathing easier. The Vyrr will not make that mistake twice.'], ['iris', 'Neither will we. The key shows forty more ships, Anvil.']],
  };
}

// ======================================================================
// TEST MAP 1 — PROVING GROUNDS (weapons, movement, spawn pads)
// ======================================================================
function provingGrounds() {
  const b = new LB();
  const terrain = (x, z) => 0.0 + Math.max(0, Math.abs(x) - 42) * 2 + Math.max(0, -82 - z) * 2 + Math.max(0, z - 22) * 2;
  // weapon pedestals
  const ids = ['sidearm', 'rifle', 'burst', 'shotgun', 'caster', 'carbine', 'needler', 'lance'];
  const pickups = [];
  ids.forEach((id, i) => {
    const x = -14 + i * 4;
    b.at(x, 4, 1.4, 1.0, 0, 0.9, 'ecs', { look: 'pedestal' });
    pickups.push({ type: 'weapon', weapon: id, pos: [x, 0.95, 4], respawn: 4 });
  });
  pickups.push({ type: 'grenade', g: 'frag', n: 4, pos: [-19, 4], respawn: 4 }, { type: 'grenade', g: 'plasma', n: 4, pos: [19, 4], respawn: 4 }, { type: 'health', pos: [-19, 10], respawn: 5 });
  // firing lanes
  for (const x of [-12, 0, 12]) b.box(x - 0.3, 0, -60, x + 0.3, 1.0, -8, 'concrete', { look: 'barrier' });
  for (const z of [-12, -30, -55]) b.deco1('distanceSign', -17, 0, z, { text: `${Math.round(10 - z)} M` });
  // movement course (east)
  b.stairs(24, -6, 30, -2, '-z', 0, 2, 5, 'grate'); // hmm: rises toward -z
  b.box(24, 0, -16, 30, 2, -6, 'concrete', { look: 'platform' });
  b.at(27, -20, 2, 2, 0, 0.6, 'crate', { look: 'crate' }); b.at(27, -24, 2, 2, 0, 1.2, 'crate', { look: 'crate' }); b.at(27, -28, 2, 2, 0, 1.2, 'crate', { look: 'crate' });
  b.box(33, 1.35, -40, 41, 3, -34, 'concrete', { look: 'wall' }); // crouch tunnel roof
  b.box(33, 0, -40, 34, 1.35, -34, 'concrete', { look: 'wall' }); b.box(40, 0, -40, 41, 1.35, -34, 'concrete', { look: 'wall' });
  b.stairs(34, -50, 40, -46, '-z', 0, 4, 12, 'grate');
  b.box(34, 3.7, -70, 40, 4, -50, 'grate', { look: 'catwalk' });
  b.box(24, 0, -76, 42, 0.5, -72, 'concrete', { look: 'platform' });
  // arena (west) with spawn pads
  for (const [x, z] of [[-30, -52], [-36, -60], [-26, -64], [-33, -70]]) b.at(x, z, 2.4, 1.4, 0, 1.2, 'crate', { look: 'crate' });
  b.box(-42, 0, -46, -22, 1.0, -45.5, 'concrete', { look: 'barrier' });
  const spawnPads = [
    { pos: [-38, -8], label: 'SPAWN 3 SKITTERS', spawn: [{ t: 'skitter', p: [-30, -66] }, { t: 'skitter', p: [-34, -68] }, { t: 'skitter', p: [-26, -70] }] },
    { pos: [-34, -8], label: 'SPAWN A TROOPER', spawn: [{ t: 'trooper', p: [-32, -68], w: 'carbine' }] },
    { pos: [-30, -8], label: 'SPAWN A BULWARK', spawn: [{ t: 'heavy', p: [-32, -72] }] },
    { pos: [-26, -8], label: 'SPAWN 3 DRONES', spawn: [{ t: 'drone', p: [-32, 6, -70] }, { t: 'drone', p: [-28, 7, -72] }, { t: 'drone', p: [-36, 6, -72] }] },
  ];
  for (const sp of spawnPads) b.deco1('pad', sp.pos[0], 0.02, sp.pos[1], { label: sp.label });
  b.deco1('hangar', 0, 0, 0);
  const groups = {
    dummies: [{ t: 'dummy', p: [-6, -12] }, { t: 'dummy', p: [6, -12] }, { t: 'dummyShield', p: [-6, -30] }, { t: 'dummy', p: [6, -30] }, { t: 'dummy', p: [-6, -55] }, { t: 'dummyShield', p: [6, -55] }],
  };
  return {
    id: 'proving', name: 'PROVING GROUNDS', loc: 'ECS TRAINING RANGE // NEVADA TEST SITE', theme: 'test', test: true, infiniteReserve: true,
    bounds: { x0: -44, z0: -84, x1: 44, z1: 24 }, terrain: { res: 2, fn: terrain, ground: 'grid' },
    boxes: b.boxes, deco: b.deco, lights: b.lights, water: [],
    sky: { top: 0x3a6ab0, horizon: 0xe8d8c0, bottom: 0x8a7a60, sun: [0.3, 0.8, 0.4], sunColor: 0xfff4e0, fog: 0xd8cbb8, fogDensity: 0.006,
      hemiSky: 0xdde8ff, hemiGround: 0x7a6a50, sunIntensity: 2.4, skyline: 'mesa', ships: false, stars: false, clouds: true },
    player: { pos: [0, 16], yaw: 0, loadout: ['rifle', 'sidearm'], frags: 4, plasmas: 4 },
    pickups, groups, spawnPads,
    sequence: [
      { obj: 'Free practice: weapons on the pedestals, targets downrange, course to the east, spawn pads to the west', wp: null,
        start: { spawn: ['dummies'], say: [['iris', 'Proving Grounds. Ammunition is unlimited here. Hold ACTION on a pad to spawn live hostiles.']] }, until: { type: 'never' } },
    ],
  };
}

// ======================================================================
// TEST MAP 2 — FIREFIGHT: PLAZA (endless waves)
// ======================================================================
function firefightPlaza() {
  const b = new LB();
  const terrain = (x, z) => -0.25 * Math.exp(-(x * x + z * z) / 400) + Math.max(0, Math.abs(x) - 34) * 3 + Math.max(0, Math.abs(z) - 34) * 3;
  b.at(0, 0, 6, 6, -0.3, 1.0, 'stone', { look: 'fountain' });
  for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) b.at(x, z, 1.6, 1.6, -0.2, 6.5, 'stone', { look: 'column' });
  for (const [x, z] of [[-6, -18], [6, -18], [-18, 4], [18, -4], [-8, 16], [8, 16], [-22, -20], [22, 20]]) b.at(x, z, 2.2, 2.2, -0.2, 1.1, 'stone', { look: 'planter' });
  b.box(-8, 0, -30, 8, 1.2, -24, 'stone', { look: 'platform' });
  b.stairs(-3, -24, 3, -21, '-z', 0, 1.2, 3, 'stone');
  b.at(-24, 6, 3, 3, 0, 2.6, 'metal', { look: 'kiosk' }); b.at(24, -8, 3, 3, 0, 2.6, 'metal', { look: 'kiosk' });
  b.at(-18, 24, 6, 1.2, 0, 2.4, 'glass', { look: 'busstop' });
  b.at(14, 26, 2, 4.4, -0.2, 1.5, 'wreck', { look: 'car', burning: true }); b.at(-26, -26, 2, 4.4, -0.2, 1.5, 'wreck', { look: 'car' });
  b.deco1('fire', 14, 1.4, 26); b.deco1('smoke', 14, 2, 26);
  for (const [x, z] of [[-30, 30], [30, 30], [-30, -30], [30, -30], [0, 32], [0, -33]]) b.deco1('streetlight', x, 0, z, { color: 0xffc080 });
  b.deco1('plazaBuildings', 0, 0, 0);
  return {
    id: 'plaza', name: 'FIREFIGHT: PLAZA', loc: 'PLAZA DE LA CIUDAD // ENDLESS WAVES', theme: 'night', test: true, firefight: { spawns: [[0, -32], [0, 31], [-31, 0], [31, 0]] },
    bounds: { x0: -38, z0: -38, x1: 38, z1: 38 }, terrain: { res: 2, fn: terrain, ground: 'plaza' },
    boxes: b.boxes, deco: b.deco, lights: [{ p: [0, 6, 0], color: 0xffb070, intensity: 1.2, dist: 26 }], water: [],
    sky: { top: 0x0a0a1a, horizon: 0x6a2a20, bottom: 0x100808, sun: [-0.4, 0.5, -0.6], sunColor: 0xff9a6a, fog: 0x2a1a1a, fogDensity: 0.018,
      hemiSky: 0x806070, hemiGround: 0x201818, sunIntensity: 1.1, skyline: 'city', ships: true, stars: true },
    player: { pos: [0, 20], yaw: 0, loadout: ['rifle', 'sidearm'], frags: 2, plasmas: 2 },
    pickups: [
      { type: 'health', pos: [-10, 0], respawn: 30 }, { type: 'health', pos: [10, 0], respawn: 30 }, { type: 'grenade', g: 'frag', n: 2, pos: [0, -27], respawn: 25 },
      { type: 'weapon', weapon: 'shotgun', pos: [-22, 6], respawn: 30 }, { type: 'weapon', weapon: 'burst', pos: [22, -6], respawn: 30 },
      { type: 'weapon', weapon: 'rifle', pos: [0, 24], respawn: 20 }, { type: 'grenade', g: 'plasma', n: 2, pos: [0, 10], respawn: 25 },
    ],
    groups: {},
    sequence: [{ obj: 'Survive', wp: null, start: { say: [['iris', 'Firefight. They will keep coming. Supplies respawn between waves.']] }, until: { type: 'never' } }],
  };
}

export const LEVELS = [fallenHymn(), coldStorage(), songOfTheGorge(), provingGrounds(), firefightPlaza()];
export const CAMPAIGN = ['fallen-hymn', 'cold-storage', 'gorge'];
export const TEST_MAPS = ['proving', 'plaza'];

export const SPEAKERS = {
  hale: { name: 'GEN. HALE', color: '#ffb347' },
  iris: { name: 'IRIS-2', color: '#4fe3ff' },
  snake: { name: 'MAJ. SNAKE', color: '#7dff9a' },
  condor: { name: 'CONDOR-2', color: '#d8e0ea' },
  threnody: { name: 'THRENODY', color: '#d35bff' },
};

export const PROLOGUE = [
  'Six months ago a cyborg called Snake walked into the Vyrr mothership HOLLOW CHOIR and broke the Lullaby Array: the weapon built to put Earth to sleep.',
  'The truce died with it. Vyrr ships now hang over forty cities, and the landings have begun.',
  'Earth answered with the EARTH CYBORG SQUAD: operatives built on Snake\'s pattern, sent in where armies cannot go.',
  'You are ANVIL. Direct operations. Go loud.',
];
