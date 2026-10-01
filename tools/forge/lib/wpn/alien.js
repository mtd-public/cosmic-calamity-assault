// Alien weapons: bone + iridescent chrome + violet/teal energy, organic lofts.
// Gun space as for human guns: bore along -Z, +Y up, origin on the grip top.
import { THREE, mat, glow, lit, extrude, rbox, cylZ, latheZ, latheY, put, group, fillet, V3, torus, sphere } from './core.js';
import { loft, roundEnds } from './arm.js';
import { gripAnchor } from './pistol.js';
import { fistAnchor, basisQ, Q } from './vm.js';

export const VIOLET = 0xb070ff, TEAL = 0x50ffd8;
const A = () => ({ bone: mat('bone'), boneD: mat('boneDark'), chrome: mat('chromeViolet'), steel: mat('chrome'), shell: mat('alienShell'), flesh: mat('alienFlesh') });

// lofted organic body along -Z: list of [z, y, w, h] sections; r: radial modulation
function body(sec, m, { radial = 32, e = 2.2, r = null, ends = true } = {}) {
  const S = sec.map(([z, y, w, h, ee]) => ({ p: [0, y, z], w, h, e: ee ?? e }));
  return new THREE.Mesh(loft(ends ? roundEnds(S, { n: 4 }) : S, { radial, r }), m);
}
// bone grip with vertebra ridges on the back and finger grooves at the front
function alienGrip(root, m, gTop, gBot, { w = 0.03, d = 0.05 } = {}) {
  const sec = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, p = gTop.clone().lerp(gBot, t); sec.push({ p: [p.x, p.y, p.z], w: w + 0.004 * Math.sin(t * Math.PI), h: d - 0.008 * t, e: 2.3, off: [0, 0.0025 * Math.sin(t * Math.PI * 4)] }); }
  put(root, new THREE.Mesh(loft(sec, { radial: 32, up: [0, 0, -1], cap1: 'flat', r: (th) => 1 + 0.03 * Math.pow(Math.max(0, Math.cos(th * 2)), 4) }), m.bone));
  const ax = gBot.clone().sub(gTop).normalize();
  for (let i = 0; i < 6; i++) { const t = 0.08 + i * 0.16, p = gTop.clone().lerp(gBot, t); const v = put(root, new THREE.Mesh(sphere(0.0065, 12, 8), m.boneD), [0, p.y, p.z + d * 0.5 - 0.002]); v.scale.set(1.4, 0.8, 1); }
  put(root, new THREE.Mesh(sphere(0.018, 16, 12), m.chrome), [gBot.x, gBot.y - 0.002, gBot.z + 0.004]).scale.set(1.0, 0.45, 1.5);
  return ax;
}
function energyCore(len, r, color, ei = 1.2) {
  return new THREE.Mesh(latheZ([[0.0001, -len / 2], [r * 0.6, -len / 2 + r * 0.3], [r, -len / 2 + r], [r, len / 2 - r], [r * 0.6, len / 2 - r * 0.3], [0.0001, len / 2]], 24), glow(color, ei));
}
// an energy cell (the alien "magazine"): capsule, top at the origin, body down -Y
export function makeCell(len = 0.07, r = 0.011, color = TEAL) {
  const g = new THREE.Group(); const m = A();
  const c = put(g, energyCore(len * 0.8, r * 0.75, color, 1.1), [0, -len / 2, 0], [Math.PI / 2, 0, 0]); void c;
  put(g, new THREE.Mesh(latheY([[0.0001, 0], [r * 0.8, 0], [r, -0.006], [r, -0.012], [r * 0.9, -0.014]], 20), m.chrome));
  put(g, new THREE.Mesh(latheY([[r * 0.9, -len + 0.014], [r, -len + 0.012], [r * 1.05, -len + 0.004], [r * 0.7, -len], [0.0001, -len]], 20), m.chrome));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; put(g, new THREE.Mesh(rbox(0.003, len - 0.02, 0.003, 0.001), m.bone), [Math.cos(a) * r, -len / 2, Math.sin(a) * r]); }
  g.userData.len = len;
  return g;
}

// ---------------------------------------------------------------- ASTG Stinger pistol
export function makeStinger() {
  const root = new THREE.Group(); root.name = 'ASTG'; const m = A();
  // carapace: a curved iridescent shell, rounded rear, tapering nose
  put(root, body([[0.04, 0.018, 0.026, 0.03], [0.015, 0.02, 0.036, 0.046], [-0.04, 0.02, 0.038, 0.048], [-0.1, 0.017, 0.032, 0.04], [-0.15, 0.014, 0.022, 0.028], [-0.175, 0.012, 0.012, 0.016]], m.chrome, { r: (th, i) => 1 + 0.06 * Math.pow(Math.max(0, Math.sin(th)), 12) }));
  // dorsal energy slot: glowing core under three bone ribs
  const core = put(root, energyCore(0.09, 0.006, VIOLET, 1.25), [0, 0.042, -0.055]);
  for (let i = 0; i < 4; i++) put(root, new THREE.Mesh(rbox(0.024, 0.007, 0.006, 0.0025), m.bone), [0, 0.044, -0.02 - i * 0.025]);
  // belly plates (bone)
  put(root, body([[0.03, -0.006, 0.022, 0.016], [-0.02, -0.008, 0.03, 0.02], [-0.09, -0.004, 0.024, 0.016], [-0.12, 0.0, 0.014, 0.01]], m.bone));
  // mandible prongs + emitter
  for (const s of [-1, 1]) {
    const pr = [0, 1, 2, 3, 4, 5].map((i) => { const t = i / 5; return { p: [s * (0.012 + 0.008 * Math.sin(t * Math.PI)), 0.01 - 0.004 * t, -0.13 - t * 0.075], w: 0.009 * (1 - t * 0.7), h: 0.012 * (1 - t * 0.75) }; });
    put(root, new THREE.Mesh(loft(roundEnds(pr, { start: false, n: 3 }), { radial: 12 }), m.bone));
  }
  const emit = put(root, new THREE.Mesh(torus(0.006, 0.0018, Math.PI * 2, 20, 8), glow(VIOLET, 1.2)), [0, 0.013, -0.178]);
  put(root, new THREE.Mesh(sphere(0.004, 12, 8), glow(0xf0d8ff, 1.3)), [0, 0.013, -0.178]);
  // sights: two bone horns at the rear, a glowing bead up front
  for (const s of [-1, 1]) put(root, new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.012, 8), m.boneD), [s * 0.005, 0.046, 0.02], [-0.3, 0, s * 0.15]);
  put(root, new THREE.Mesh(sphere(0.0022, 10, 8), glow(0x90ffe0, 1.2)), [0, 0.0405, -0.135]);
  // grip + claw trigger
  const gTop = V3(0, -0.012, 0.012), gBot = V3(0, -0.112, 0.046);
  const gAxis = alienGrip(root, m, gTop, gBot);
  const trigger = group(root, [0, -0.014, -0.03]);
  put(trigger, new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.02, 8), m.boneD), [0, -0.008, 0.004], [Math.PI - 0.4, 0, 0]);
  put(root, new THREE.Mesh(torus(0.022, 0.003, Math.PI * 1.1, 20, 6), m.bone), [0, -0.018, -0.03], [0, Math.PI / 2, Math.PI * 0.95]);
  // energy cell in the grip
  const makeMag = () => makeCell(0.07, 0.011);
  const mag = group(root); mag.name = 'mag';
  const cell = makeMag(); mag.add(cell);
  const magQ = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), gAxis);
  cell.quaternion.copy(magQ); cell.position.copy(gTop.clone().lerp(gBot, 0.28));
  const anchors = {};
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.25, halfW: 0.017, halfD: 0.025, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  anchors.Lsup = gripAnchor(root, gTop, gBot, { t: 0.62, halfW: 0.017, halfD: 0.025, roll: -0.15, palm: 0.0105, along: -0.075, sink: -0.012, side: -1, shift: [0, -0.006, -0.006] });
  anchors.muzzle = group(root, [0, 0.013, -0.182]);
  const bot = gTop.clone().lerp(gBot, 0.28 + 0.7);
  anchors.magwell = group(root, [gBot.x, gBot.y, gBot.z]); anchors.magwell.quaternion.copy(magQ);
  anchors.Lrack = group(root, [-0.07, 0.035, 0.0]); anchors.Lrack.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, -0.2, 'YXZ')));
  const gun = { root, parts: { mag, trigger, core }, anchors, gAxis, magQ, magLen: 0.07, sightY: 0.0465, name: 'ASTG', makeMag };
  const coreMat = [glow(VIOLET, 1.0), glow(0xe0c0ff, 1.35)];
  gun.set = (s = {}) => {
    mag.position.copy(gAxis).multiplyScalar((s.mag ?? 0)); mag.visible = s.magVis ?? true;
    trigger.rotation.x = -(s.trigger ?? 0) * 0.3;
    core.material = s.charge ? coreMat[1] : coreMat[0];
    core.scale.setScalar(s.charge ? 1.35 : 1);
    emit.material = s.charge ? glow(0xe8d0ff, 1.4) : glow(VIOLET, 1.2);
  };
  gun.set();
  return gun;
}

// ---------------------------------------------------------------- ASCT Scatter shotgun
export function makeScatter() {
  const root = new THREE.Group(); root.name = 'ASCT'; const m = A();
  // broad flattened carapace widening to a fan muzzle
  put(root, body([[0.05, 0.022, 0.03, 0.036], [0.0, 0.026, 0.05, 0.05], [-0.12, 0.024, 0.06, 0.05], [-0.28, 0.02, 0.085, 0.04, 2.8], [-0.4, 0.018, 0.12, 0.034, 3.2], [-0.43, 0.018, 0.12, 0.03, 3.2]], m.chrome, { radial: 40, r: (th) => 1 + 0.05 * Math.pow(Math.max(0, Math.sin(th)), 10) }));
  // bone ribs over the top
  for (let i = 0; i < 7; i++) { const z = -0.02 - i * 0.05, w = 0.052 + i * 0.0105; const rib = put(root, new THREE.Mesh(torus(w * 0.5, 0.0045, Math.PI, 24, 6), m.bone), [0, 0.022, z], [0, 0, 0]); rib.scale.set(1, 0.5 - i * 0.02, 1); }
  // five emitters in a fan, teal glow
  const emitters = [];
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.022, a = (i - 2) * 0.12; const e = put(root, new THREE.Mesh(torus(0.0075, 0.0022, Math.PI * 2, 18, 8), glow(TEAL, 1.15)), [x, 0.018, -0.432], [0, a, 0]); emitters.push(e); put(root, new THREE.Mesh(sphere(0.0045, 10, 8), glow(0xd0fff4, 1.3)), [x, 0.018, -0.43]); }
  // bead sight + top channel
  put(root, new THREE.Mesh(sphere(0.003, 10, 8), glow(0x90ffe0, 1.25)), [0, 0.048, -0.38]);
  // under-sleeve "pump" (ribbed bone, slides +Z)
  const pump = group(root); pump.name = 'pump';
  const ps = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; ps.push({ p: [0, -0.012, -0.12 - t * 0.17], w: 0.05, h: 0.04 + 0.006 * Math.sin(t * Math.PI), e: 2.4 }); }
  put(pump, new THREE.Mesh(loft(ps, { radial: 32, r: (th, i) => 1 + (i % 2 ? 0.05 : 0) }), m.bone));
  put(root, new THREE.Mesh(cylZ(0.012, 0.012, -0.1, -0.33, 16), m.flesh), [0, -0.012, 0]);
  // grip
  const gTop = V3(0, -0.01, 0.025), gBot = V3(0, -0.11, 0.06);
  alienGrip(root, m, gTop, gBot);
  const trigger = group(root, [0, -0.012, -0.02]);
  put(trigger, new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.02, 8), m.boneD), [0, -0.008, 0.004], [Math.PI - 0.4, 0, 0]);
  put(root, new THREE.Mesh(torus(0.022, 0.003, Math.PI * 1.1, 20, 6), m.bone), [0, -0.016, -0.02], [0, Math.PI / 2, Math.PI * 0.95]);
  const anchors = {};
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.25, halfW: 0.017, halfD: 0.025, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  anchors.L = fistAnchor(pump, { at: [0, -0.012, -0.21], axis: [0, 0, -1], back: [-0.45, -0.9, 0], side: -1, tunnel: [0, -0.042, -0.088] });
  anchors.port = group(root, [0, -0.03, -0.06]);
  anchors.muzzle = group(root, [0, 0.018, -0.44]);
  anchors.eject = group(root, [0.03, 0.03, -0.05]);
  const gun = { root, parts: { pump, trigger }, anchors, sightY: 0.051, name: 'ASCT' };
  gun.set = (s = {}) => { pump.position.z = (s.pump ?? 0) * 0.07; trigger.rotation.x = -(s.trigger ?? 0) * 0.3; };
  gun.set();
  return gun;
}

// ---------------------------------------------------------------- APSM plasma SMG
export function makePlasmaSMG() {
  const root = new THREE.Group(); root.name = 'APSM'; const m = A();
  put(root, body([[0.12, 0.02, 0.03, 0.04], [0.06, 0.024, 0.04, 0.05], [-0.05, 0.026, 0.044, 0.056], [-0.2, 0.022, 0.04, 0.046], [-0.3, 0.018, 0.026, 0.03], [-0.34, 0.016, 0.016, 0.02]], m.chrome, { radial: 36, r: (th) => 1 + 0.05 * Math.pow(Math.max(0, Math.sin(th)), 10) }));
  // glowing coil along both sides (heat)
  const coils = [];
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const c = put(root, new THREE.Mesh(torus(0.009, 0.0022, Math.PI * 2, 14, 6), glow(VIOLET, 1.1)), [s * 0.021, 0.022, 0.03 - i * 0.03], [0, Math.PI / 2, 0]); coils.push(c); }
  // spine of bone vertebrae on top
  for (let i = 0; i < 9; i++) put(root, new THREE.Mesh(sphere(0.008, 12, 8), m.bone), [0, 0.052, 0.07 - i * 0.035]).scale.set(1.2, 0.7, 1.4);
  // vent panels (left/right), hinged at the top edge, open outward
  const vents = [];
  for (const s of [-1, 1]) {
    const hinge = group(root, [s * 0.022, 0.04, -0.09]);
    put(hinge, new THREE.Mesh(rbox(0.004, 0.032, 0.09, 0.0015), m.bone), [s * 0.002, -0.016, 0]);
    for (let i = 0; i < 4; i++) put(hinge, new THREE.Mesh(rbox(0.005, 0.004, 0.08, 0.001), m.boneD), [s * 0.003, -0.006 - i * 0.007, 0]);
    vents.push({ hinge, s });
  }
  const hot = put(root, new THREE.Mesh(rbox(0.036, 0.026, 0.085, 0.004), glow(0xff8a50, 1.0)), [0, 0.022, -0.09]);
  // emitter + claw foregrip
  put(root, new THREE.Mesh(torus(0.008, 0.0022, Math.PI * 2, 20, 8), glow(VIOLET, 1.2)), [0, 0.016, -0.342]);
  put(root, new THREE.Mesh(sphere(0.005, 12, 8), glow(0xf0d8ff, 1.3)), [0, 0.016, -0.34]);
  const fg = [0, 1, 2, 3, 4].map((i) => { const t = i / 4; return { p: [0, -0.005 - t * 0.075, -0.2 + t * 0.012], w: 0.028 - t * 0.006, h: 0.034 - t * 0.008 }; });
  put(root, new THREE.Mesh(loft(roundEnds(fg, { start: false, n: 3 }), { radial: 20, up: [0, 0, -1] }), m.bone));
  const gTop = V3(0, -0.01, 0.025), gBot = V3(0, -0.108, 0.058);
  alienGrip(root, m, gTop, gBot);
  const trigger = group(root, [0, -0.012, -0.02]);
  put(trigger, new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.02, 8), m.boneD), [0, -0.008, 0.004], [Math.PI - 0.4, 0, 0]);
  // sight: a glowing ring at the rear, bead at the front
  put(root, new THREE.Mesh(torus(0.006, 0.0015, Math.PI * 2, 20, 6), glow(TEAL, 1.1)), [0, 0.068, 0.04]);
  put(root, new THREE.Mesh(rbox(0.004, 0.012, 0.004, 0.001), m.boneD), [0, 0.06, 0.04]);
  put(root, new THREE.Mesh(sphere(0.0025, 10, 8), glow(0x90ffe0, 1.25)), [0, 0.068, -0.25]);
  put(root, new THREE.Mesh(rbox(0.003, 0.03, 0.003, 0.001), m.boneD), [0, 0.052, -0.25]);
  const anchors = {};
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.25, halfW: 0.017, halfD: 0.025, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  anchors.L = fistAnchor(root, { at: [0, -0.045, -0.194], axis: [0, 1, 0.12], back: [-1, 0, 0.4], side: -1, tunnel: [0, -0.034, -0.09] });
  anchors.muzzle = group(root, [0, 0.016, -0.346]);
  anchors.eject = group(root, [0.03, 0.03, -0.05]);
  anchors.magwell = group(root, [0, -0.02, -0.09]);
  anchors.Lcharge = group(root, [-0.06, 0.03, -0.0]); anchors.Lcharge.quaternion.copy(basisQ([0, 1, 0], [-1, 0, 0], [0, 0, 1]));
  const gun = { root, parts: { trigger, vents, hot, coils }, anchors, sightY: 0.068, name: 'APSM' };
  gun.set = (s = {}) => {
    trigger.rotation.x = -(s.trigger ?? 0) * 0.3;
    const v = s.vent ?? 0;
    for (const { hinge, s: sd } of vents) hinge.rotation.z = sd * v * 1.2;
    hot.visible = v > 0.05;
    for (const c of coils) c.material = glow(v > 0.05 ? 0xff9a60 : VIOLET, 1.1);
  };
  gun.set();
  return gun;
}

// ---------------------------------------------------------------- ABLD Harvester blade (forearm-mounted)
// Built in the right hand's frame (wrist origin, fingers -Z, back of the hand +Y):
// a bone gauntlet over the wrist and a long curved blade over the back of the fist.
export function makeBlade() {
  const g = new THREE.Group(); g.name = 'ABLD'; const m = A();
  // gauntlet: bone plates wrapping the forearm behind the wrist
  const gs = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; gs.push({ p: [0, 0.006, 0.01 + t * 0.15], w: 0.072 + 0.012 * t, h: 0.056 + 0.01 * t, e: 2.2 }); }
  put(g, new THREE.Mesh(loft(gs, { radial: 36, r: (th, i) => 1 + 0.06 * Math.max(0, Math.sin(th)) + (i % 2 ? 0.025 : 0) }), m.bone));
  for (let i = 0; i < 4; i++) put(g, new THREE.Mesh(rbox(0.05, 0.012, 0.024, 0.005), m.chrome), [0, 0.034 + i * 0.001, 0.03 + i * 0.033], [0.1, 0, 0]);
  // glowing seams between plates
  for (let i = 0; i < 3; i++) put(g, new THREE.Mesh(torus(0.037 + i * 0.002, 0.0016, Math.PI * 1.2, 24, 6), glow(VIOLET, 1.1)), [0, 0.008, 0.05 + i * 0.033], [0, 0, Math.PI * -0.1 + Math.PI * 0.0]);
  // blade: a curved bone spine with a glowing energy edge, springing from the back of the wrist
  const bladeRoot = group(g, [0, 0.038, 0.02], [-0.12, 0, 0]);
  const prof = fillet([[0.0, 0.012], [0.06, 0.016], [0.16, 0.026], [0.25, 0.04], [0.32, 0.062], [0.27, 0.03], [0.18, -0.004], [0.08, -0.028], [0.0, -0.03]], [0, 0.02, 0.03, 0.02, 0, 0.02, 0.02, 0.01, 0], 4);
  put(bladeRoot, new THREE.Mesh(extrude(prof, 0.01, { bevel: 0.0025 }), m.bone));
  const edge = fillet([[0.02, -0.0315], [0.08, -0.0295], [0.18, -0.0055], [0.27, 0.0285], [0.322, 0.0625], [0.268, 0.038], [0.176, 0.006], [0.078, -0.018], [0.02, -0.02]], [0, 0.01, 0.03, 0.02, 0, 0.02, 0.02, 0.01, 0], 4);
  const edgeM = put(bladeRoot, new THREE.Mesh(extrude(edge, 0.005, { bevel: 0.0012 }), glow(0xd8a8ff, 1.2)));
  // bone barbs along the spine
  for (let i = 0; i < 4; i++) put(bladeRoot, new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.018, 8), m.boneD), [0, 0.006 + i * 0.006, -(0.06 + i * 0.05)], [-1.2, 0, 0]);
  g.userData.edge = edgeM;
  return g;
}

// ---------------------------------------------------------------- SNGL Singularity
export function makeSingularity() {
  const root = new THREE.Group(); root.name = 'SNGL'; const m = A();
  // heavy bone-and-chrome housing
  put(root, body([[0.16, 0.03, 0.08, 0.08], [0.08, 0.035, 0.11, 0.11], [-0.04, 0.035, 0.12, 0.12], [-0.12, 0.03, 0.1, 0.1], [-0.17, 0.03, 0.07, 0.07]], m.shell, { radial: 40 }));
  for (let i = 0; i < 6; i++) put(root, new THREE.Mesh(torus(0.058 + 0.004 * Math.sin(i), 0.006, Math.PI * 2, 32, 8), m.bone), [0, 0.035, 0.1 - i * 0.045]);
  // claw cradle: four curved prongs reaching forward around the core
  const prongs = [];
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => { const t = i / 6, r = 0.05 + 0.07 * Math.sin(t * Math.PI * 0.9); return { p: [Math.cos(a) * r, 0.035 + Math.sin(a) * r, -0.15 - t * 0.2], w: 0.018 * (1 - t * 0.6), h: 0.014 * (1 - t * 0.6) }; });
    prongs.push(put(root, new THREE.Mesh(loft(roundEnds(pts, { start: false, n: 3 }), { radial: 12 }), m.bone)));
  }
  // the core: black sphere with a violet event-horizon rim, scaled by charge
  const coreG = group(root, [0, 0.035, -0.26]);
  const core = put(coreG, new THREE.Mesh(sphere(0.03, 32, 24), new THREE.MeshBasicMaterial({ color: 0x050008 })));
  const rim = put(coreG, new THREE.Mesh(torus(0.034, 0.005, Math.PI * 2, 48, 12), glow(VIOLET, 1.3)), [0, 0, 0], [0, 0, 0]);
  const halo = put(coreG, new THREE.Mesh(torus(0.042, 0.002, Math.PI * 2, 48, 8), glow(0xe8d0ff, 1.4)), [0, 0, 0], [0.4, 0.3, 0]);
  // lit channels along the housing
  for (const s of [-1, 1]) put(root, new THREE.Mesh(rbox(0.004, 0.01, 0.22, 0.002), glow(VIOLET, 1.1)), [s * 0.061, 0.035, 0.0]);
  // rear grip (right) and side handle (left)
  const gTop = V3(0, -0.02, 0.1), gBot = V3(0, -0.12, 0.13);
  alienGrip(root, m, gTop, gBot);
  const hand = [0, 1, 2, 3, 4].map((i) => { const t = i / 4; return { p: [-0.06 - 0.04 * Math.sin(t * Math.PI), 0.0 - t * 0.02, -0.02 - t * 0.12], w: 0.022, h: 0.022 }; });
  put(root, new THREE.Mesh(loft(hand, { radial: 16 }), m.bone));
  const anchors = {};
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.25, halfW: 0.017, halfD: 0.025, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  anchors.L = fistAnchor(root, { at: [-0.1, -0.012, -0.08], axis: [0, 0.15, -1], back: [-1, 0.2, 0], side: -1, tunnel: [0, -0.026, -0.089] });
  anchors.muzzle = group(root, [0, 0.035, -0.3]);
  const gun = { root, parts: { coreG, core, rim, halo, prongs }, anchors, name: 'SNGL' };
  gun.set = (s = {}) => {
    const c = s.charge ?? 0.3;
    coreG.scale.setScalar(0.5 + c * 1.3);
    rim.material = glow(c > 0.85 ? 0xf0e0ff : VIOLET, 1.1 + c * 0.4);
    halo.visible = c > 0.4; halo.rotation.set(0.4 + c, 0.3 + c * 2, 0);
    for (const [k, p] of prongs.entries()) p.rotation.z = 0;
  };
  gun.set();
  return gun;
}
