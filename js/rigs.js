// Character rigs: the player's arms and body, and the Vyrr. Built on rig.js
// (connected bones + IK) so every limb is one continuous chain from the
// torso to the fingertips, and animated procedurally: feet plant on the
// ground through leg IK, hands hold guns through arm IK, tails sway, jaws
// open. The sim never sees any of this; rigs read the sim's entity fields.
//
//   makePlayerArms()             first-person arms (shoulders → fingers)
//   makePlayerBody()             the full ECS cyborg (first-person legs, vehicles)
//   makeEnemy(type)              a rig with animate(e, ctx)
import * as THREE from 'three';
import { MAT, glowMat, basicGlow, emissiveMat } from './models.js';
import { makeWeapon } from './gunmodels.js';
import { bone, joint, ik2, ikHand, makeHand, K, bump } from './rig.js';
import { WEAPONS } from './weapons.js';

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const _p = V(), _p2 = V(), _q = Q(), _q2 = Q(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, typeof mat === 'string' ? MAT(mat) : mat); m.castShadow = true; return m; };
const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Pose of a node that is a direct child of `grp`, in grp.parent's space.
export function childPose(grp, nodeItem, outPos, outQuat) {
  grp.updateMatrix();
  outPos.copy(nodeItem.position).applyMatrix4(grp.matrix);
  if (outQuat) outQuat.copy(grp.quaternion).multiply(nodeItem.quaternion);
  return outPos;
}

// ======================================================================
// PLAYER ARMS (viewmodel)
// ======================================================================
// ECS cyborg: olive armour plates over gunmetal actuators, black gloves with
// articulated metal fingers. Shoulders sit at the bottom corners of the view.
export function makePlayerArms() {
  const mats = { glove: MAT('black'), skin: MAT('gunmetal') };
  const mk = (side) => {
    const holder = new THREE.Group(); // the shoulder joint IS the arm's root, so IK targets live in the viewmodel's space
    const L1 = 0.47, L2 = 0.45;
    const up = bone(holder, L1, 0.062, 0.052, MAT('gunmetal'), { seg: 10 });
    holder.remove(up.joint);
    const root = up.joint;
    // pauldron + upper-arm plate
    const pad = mesh(new THREE.SphereGeometry(0.095, 10, 8, 0, Math.PI * 2, 0, 1.5), 'ecsArmor'); pad.position.y = 0.01; pad.scale.set(1.1, 0.9, 1.1); up.joint.add(pad);
    const plate = mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.3, 8, 1, true, side > 0 ? -1.6 : 1.5, 3.1), 'ecsArmor'); plate.position.y = -0.24; up.joint.add(plate);
    const el = bone(up.end, L2, 0.052, 0.046, MAT('gunmetal'), { seg: 10 });
    // gauntlet: forearm plate, wrist ring, status light
    const gaunt = mesh(new THREE.CylinderGeometry(0.066, 0.06, 0.3, 8, 1, true, side > 0 ? -1.8 : 1.3, 3.4), 'ecsArmor'); gaunt.position.y = -0.24; el.joint.add(gaunt);
    const ring = mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), 'black'); ring.rotation.x = Math.PI / 2; ring.position.y = -L2 + 0.03; el.joint.add(ring);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), emissiveMat(0x4fe3ff, 2)); light.position.set(side * 0.06, -0.14, 0.0); el.joint.add(light);
    const hand = makeHand(mats, 1.15, side);
    el.end.add(hand);
    root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    return { root, sh: up.joint, el: el.joint, hand, L1, L2, side };
  };
  return { right: mk(1), left: mk(-1) };
}

// ======================================================================
// PLAYER BODY (first-person legs when you look down; the whole figure in vehicles)
// ======================================================================
export function makePlayerBody() {
  const spec = {
    type: 'anvil', bodyY: 1.0, skin: 'gunmetal', armor: 'ecsArmor',
    hip: { x: 0.14, y: -0.06, z: 0 }, thigh: { len: 0.44, r0: 0.09, r1: 0.075 }, shin: { len: 0.44, r0: 0.07, r1: 0.055 }, foot: { len: 0.14, r0: 0.05, r1: 0.04, angle: 0.95 },
    toe: [0.11, 0.05, 0.16], legPole: [0, -0.3, -1], stride: 0.42, lift: 0.14,
    shoulder: { x: 0.24, y: 0.5, z: 0 }, upper: { len: 0.32, r0: 0.062, r1: 0.052 }, fore: { len: 0.3, r0: 0.052, r1: 0.045 }, handScale: 1.15, hand: { glove: 'black', skin: 'gunmetal' },
    neck: { y: 0.6, len: 0.08, r: 0.06 }, head: 'helmet', tail: null,
  };
  const r = buildBiped(spec);
  const b = r.body;
  // torso: chest plate, abdomen, back unit
  const chest = mesh(lathe([[0.18, -0.15], [0.26, 0.05], [0.27, 0.35], [0.2, 0.55], [0.08, 0.62]], 10), 'ecsArmor'); chest.scale.set(1.15, 1, 0.8); r.chest.add(chest);
  const abd = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 10), 'gunmetal'); abd.position.y = -0.1; b.add(abd);
  const belt = mesh(new THREE.TorusGeometry(0.23, 0.035, 6, 12), 'black'); belt.rotation.x = Math.PI / 2; belt.position.y = -0.2; b.add(belt);
  const pelvis = mesh(new THREE.SphereGeometry(0.22, 10, 8), 'ecsArmor'); pelvis.scale.set(1.15, 0.6, 0.9); pelvis.position.y = -0.24; b.add(pelvis);
  const pack = mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), 'ecsArmor'); pack.position.set(0, 0.25, 0.22); r.chest.add(pack);
  for (const s of [-1, 1]) { const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.01), emissiveMat(0x4fe3ff, 1.6)); vent.position.set(s * 0.1, 0.25, 0.305); r.chest.add(vent); }
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.012), emissiveMat(0x4fe3ff, 1.6)); seam.position.set(0, 0.25, -0.22); r.chest.add(seam);
  // thigh + shin plates
  for (const L of r.legs) {
    const tp = mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.3, 8, 1, true, -1.2, 2.4), 'ecsArmor'); tp.position.y = -0.2; L.hip.add(tp);
    const sp = mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.3, 8, 1, true, -1.2, 2.4), 'ecsArmor'); sp.position.y = -0.2; L.knee.add(sp);
  }
  // helmet with an amber visor
  const helm = new THREE.Group(); r.head.add(helm);
  const dome = mesh(new THREE.SphereGeometry(0.14, 12, 10), 'ecsArmor'); dome.scale.set(1, 1.1, 1.1); dome.position.y = 0.12; helm.add(dome);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, Math.PI * 0.62, Math.PI * 0.76, 0.9, 1.0), new THREE.MeshPhongMaterial({ color: 0xffa030, emissive: 0xff8020, emissiveIntensity: 0.9, specular: 0xffffff, shininess: 90 }));
  visor.position.y = 0.11; visor.scale.set(1.05, 1.12, 1.12); helm.add(visor);
  const jawG = mesh(new THREE.BoxGeometry(0.2, 0.09, 0.14), 'gunmetal'); jawG.position.set(0, 0.0, -0.05); helm.add(jawG);
  r.helmet = helm;
  // chest rig pouches, knee pads, boots, jump-kit thrusters
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const pouch = mesh(new THREE.BoxGeometry(0.1, 0.11, 0.07), 'black'); pouch.position.set(s * (0.09 + i * 0.12), 0.15 - i * 0.02, -0.24); r.chest.add(pouch); }
  for (const L of r.legs) {
    const kp = mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, 1.4), 'black'); kp.position.set(0, -L.L1 + 0.02, -0.05); kp.rotation.x = -1.4; L.hip.add(kp);
    const boot = mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.22, 8, 1, true), 'black'); boot.position.y = -L.L2 + 0.13; L.knee.add(boot);
  }
  for (const s of [-1, 1]) { const thr = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), 'gunmetal'); thr.position.set(s * 0.12, 0.05, 0.26); thr.rotation.x = 0.3; r.chest.add(thr); }
  return r;
}

// ======================================================================
// GENERIC BIPED
// ======================================================================
// spec: sizes and materials; returns { root, body, chest, head, neck, jaw?, legs:[{hip, knee, ankle, foot}], arms:[{sh, el, hand}], tail:[joints], spec }
export function buildBiped(spec) {
  const root = new THREE.Group();
  const body = joint(0, spec.bodyY, 0); root.add(body);
  const chest = joint(0, 0, 0); body.add(chest);
  const skin = MAT(spec.skin), armor = MAT(spec.armor);
  const legs = [];
  for (const s of [-1, 1]) {
    const th = bone(body, spec.thigh.len, spec.thigh.r0, spec.thigh.r1, spec.thighMat ? MAT(spec.thighMat) : armor, { x: s * spec.hip.x, y: spec.hip.y, z: spec.hip.z, seg: 10 });
    const sh = bone(th.end, spec.shin.len, spec.shin.r0, spec.shin.r1, skin, { seg: 9 });
    const ft = bone(sh.end, spec.foot.len, spec.foot.r0, spec.foot.r1, skin, { seg: 8, caps: 1 });
    const toe = mesh(new THREE.BoxGeometry(...spec.toe), armor); toe.position.set(0, -spec.foot.len + 0.02, -spec.toe[2] * 0.3); ft.joint.add(toe);
    legs.push({ hip: th.joint, knee: sh.joint, ankle: ft.joint, foot: ft, side: s, L1: spec.thigh.len, L2: spec.shin.len, target: V(), tgtQ: Q() });
  }
  const arms = [];
  const handMats = { glove: MAT(spec.hand?.glove || spec.skin), skin: MAT(spec.hand?.skin || spec.skin) };
  for (const s of [-1, 1]) {
    const up = bone(chest, spec.upper.len, spec.upper.r0, spec.upper.r1, skin, { x: s * spec.shoulder.x, y: spec.shoulder.y, z: spec.shoulder.z, seg: 9 });
    const fo = bone(up.end, spec.fore.len, spec.fore.r0, spec.fore.r1, spec.foreMat ? MAT(spec.foreMat) : armor, { seg: 9 });
    const hand = makeHand(handMats, spec.handScale, s);
    fo.end.add(hand);
    const hold = new THREE.Group(); fo.end.add(hold); // for things carried on the forearm (the Bulwark's slab + cannon)
    arms.push({ sh: up.joint, el: fo.joint, hand, hold, side: s, L1: spec.upper.len, L2: spec.fore.len, target: V(), tgtQ: Q() });
  }
  const neck = bone(chest, spec.neck.len, spec.neck.r, spec.neck.r * 0.9, skin, { y: spec.neck.y, z: spec.neck.z || 0, seg: 8 });
  neck.joint.rotation.x = Math.PI; // points up
  const head = joint(0, spec.neck.len + 0.02, 0); neck.joint.add(head); head.rotation.x = Math.PI; // undo: head frame upright
  const tail = [];
  if (spec.tail) {
    let parent = body;
    let prevJoint = null;
    for (let i = 0; i < spec.tail.n; i++) {
      const f = i / spec.tail.n;
      const b = bone(parent, spec.tail.len, spec.tail.r0 * (1 - f) + spec.tail.r1 * f, spec.tail.r0 * (1 - f - 1 / spec.tail.n) + spec.tail.r1 * (f + 1 / spec.tail.n), skin, { y: i === 0 ? spec.tail.y : 0, z: i === 0 ? spec.tail.z : 0, seg: 7 });
      if (i === 0) b.joint.rotation.x = -Math.PI / 2 + 0.3; // out the back, drooping
      tail.push(b.joint); parent = b.end; prevJoint = b.joint;
    }
    void prevJoint;
  }
  return { root, body, chest, head, neck: neck.joint, legs, arms, tail, spec, gaitPh: 0, gait: 0, lean: V(), fall: 0, spin: 0, twist: 0, headYaw: 0, headPitch: 0 };
}

// A Vyrr reptile head: skull, snout, hinged jaw, crest, eyes. Returns the group; group.jaw is the jaw joint.
function reptileHead(scale, crest, eyeColor = 0xffd040) {
  const h = new THREE.Group();
  const skull = mesh(new THREE.SphereGeometry(0.2 * scale, 12, 9), 'scales'); skull.scale.set(1, 0.85, 1.25); h.add(skull);
  const brow = mesh(new THREE.SphereGeometry(0.19 * scale, 10, 6, 0, Math.PI * 2, 0, 1.2), 'vyrr'); brow.position.set(0, 0.06 * scale, 0.02 * scale); brow.scale.set(1.02, 0.7, 1.2); h.add(brow);
  const snout = mesh(new THREE.CylinderGeometry(0.07 * scale, 0.16 * scale, 0.34 * scale, 8), 'scales');
  snout.rotation.x = -Math.PI / 2; snout.position.set(0, -0.03 * scale, -0.3 * scale); h.add(snout);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const tooth = mesh(new THREE.ConeGeometry(0.012 * scale, 0.04 * scale, 4), 'vyrrGold'); tooth.position.set(s * 0.06 * scale, -0.085 * scale, -0.22 * scale - i * 0.06 * scale); tooth.rotation.x = Math.PI; h.add(tooth); }
  const jaw = joint(0, -0.08 * scale, -0.08 * scale); h.add(jaw); h.jaw = jaw;
  const jawM = mesh(new THREE.CylinderGeometry(0.05 * scale, 0.11 * scale, 0.3 * scale, 8), 'scales'); jawM.rotation.x = -Math.PI / 2; jawM.position.set(0, -0.02 * scale, -0.14 * scale); jawM.scale.y = 0.6; jaw.add(jawM);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scale, 8, 6), emissiveMat(eyeColor, 2.4)); eye.position.set(s * 0.12 * scale, 0.05 * scale, -0.13 * scale); h.add(eye);
    const lid = mesh(new THREE.SphereGeometry(0.042 * scale, 8, 5, 0, Math.PI * 2, 0, 1.4), 'scales'); lid.position.copy(eye.position); lid.rotation.x = -0.6; h.add(lid);
  }
  if (crest) {
    for (let i = 0; i < 3; i++) { const c = mesh(lathe([[0.02, 0], [0.07, 0.1], [0.04, 0.32], [0, 0.4]], 5), 'vyrr'); c.rotation.x = 0.7 + i * 0.35; c.position.set(0, (0.12 - i * 0.04) * scale, (0.02 + i * 0.09) * scale); c.scale.setScalar(scale * (1 - i * 0.2)); h.add(c); }
  } else {
    for (const s of [-1, 1]) { const frill = mesh(new THREE.ConeGeometry(0.03 * scale, 0.16 * scale, 4), 'vyrr'); frill.position.set(s * 0.16 * scale, 0.02 * scale, 0.1 * scale); frill.rotation.set(-0.5, 0, s * 1.6); h.add(frill); }
  }
  return h;
}

// ======================================================================
// ENEMIES
// ======================================================================
export function makeEnemy(type) {
  if (type === 'drone') return droneRig();
  if (type === 'heavy') return heavyRig();
  if (type === 'skitter') return skitterRig();
  const holo = type === 'dummy' || type === 'dummyShield';
  return trooperRig(holo, type === 'dummyShield');
}

function skitterRig() {
  const r = buildBiped({
    type: 'skitter', bodyY: 0.58, skin: 'scales', armor: 'vyrr',
    hip: { x: 0.16, y: -0.12, z: 0.02 }, thigh: { len: 0.26, r0: 0.09, r1: 0.07 }, shin: { len: 0.24, r0: 0.065, r1: 0.05 }, foot: { len: 0.14, r0: 0.045, r1: 0.035, angle: 0.8 },
    toe: [0.12, 0.04, 0.2], legPole: [0, -0.3, 1], stride: 0.26, lift: 0.1,
    shoulder: { x: 0.3, y: 0.28, z: -0.02 }, upper: { len: 0.22, r0: 0.06, r1: 0.05 }, fore: { len: 0.22, r0: 0.05, r1: 0.04 }, handScale: 0.8,
    neck: { y: 0.42, len: 0.1, r: 0.07, z: -0.06 }, tail: { n: 4, len: 0.16, r0: 0.07, r1: 0.02, y: -0.18, z: 0.15 },
  });
  const b = r.body, c = r.chest;
  const torso = mesh(new THREE.SphereGeometry(0.36, 12, 9), 'scales'); torso.scale.set(1, 0.95, 0.85); torso.position.y = 0.18; c.add(torso);
  const armor = mesh(new THREE.SphereGeometry(0.38, 10, 6, 0, Math.PI * 2, 0, 1.3), 'vyrr'); armor.position.y = 0.24; armor.scale.set(1, 0.8, 0.9); c.add(armor);
  const belly = mesh(new THREE.SphereGeometry(0.3, 10, 8), 'scales'); belly.scale.set(1, 0.6, 0.8); belly.position.y = -0.1; b.add(belly);
  // methane-style breathing tank on the back, hoses to the mask
  const tank = mesh(lathe([[0.02, -0.28], [0.2, -0.22], [0.24, 0], [0.2, 0.26], [0.08, 0.34]], 8), 'pod'); tank.position.set(0, 0.28, 0.36); c.add(tank);
  const tg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), basicGlow(0x55ffe0, 0.8)); tg.position.set(0, 0.28, 0.36); c.add(tg);
  for (const s of [-1, 1]) { const hose = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 10, Math.PI * 0.9), 'black'); hose.position.set(s * 0.18, 0.4, 0.15); hose.rotation.set(0, s * 1.2, 1.5); c.add(hose); }
  const head = reptileHead(1.0, false, 0xffd040); r.head.add(head); r.jaw = head.jaw;
  const mask = mesh(new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, 1.6), 'pod'); mask.position.set(0, -0.06, -0.25); mask.rotation.x = -1.4; head.add(mask);
  r.gun = null; r.height = 1.3; r.type = 'skitter';
  r.gunPose = { aim: [0.12, 0.2, -0.28], idle: [0.2, -0.05, -0.15] };
  r.animate = (e, ctx) => animateBiped(r, e, ctx);
  return r;
}

function trooperRig(holo = false, shielded = false) {
  // Partially humanoid: an upright soldier with human proportions and forward
  // knees, in plate armour with a chest rig, knee pads and boots. The reptile
  // head, the tail and the four-fingered claws are what mark it as Vyrr.
  const r = buildBiped({
    type: 'trooper', bodyY: 1.14, skin: 'scales', armor: 'vyrr',
    hip: { x: 0.18, y: -0.18, z: 0 }, thigh: { len: 0.46, r0: 0.12, r1: 0.095 }, shin: { len: 0.46, r0: 0.09, r1: 0.07 }, foot: { len: 0.16, r0: 0.06, r1: 0.05, angle: 1.05 },
    toe: [0.15, 0.06, 0.24], legPole: [0, -0.3, -1], stride: 0.55, lift: 0.14, thighMat: 'vyrr',
    shoulder: { x: 0.34, y: 0.5, z: 0 }, upper: { len: 0.34, r0: 0.085, r1: 0.07 }, fore: { len: 0.32, r0: 0.07, r1: 0.06 }, handScale: 1.25, foreMat: 'vyrr',
    neck: { y: 0.66, len: 0.14, r: 0.08, z: -0.02 }, tail: { n: 5, len: 0.2, r0: 0.09, r1: 0.025, y: -0.22, z: 0.16 },
  });
  const b = r.body, c = r.chest;
  const chest = mesh(lathe([[0.2, -0.2], [0.3, -0.02], [0.34, 0.3], [0.28, 0.55], [0.12, 0.64]], 10), 'vyrr'); chest.scale.set(1.15, 1, 0.8); c.add(chest);
  const plate = mesh(new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI, 0.3, 1.6), 'vyrrGold'); plate.rotation.y = Math.PI; plate.position.set(0, 0.28, -0.05); plate.scale.set(1, 0.9, 0.6); c.add(plate);
  // chest rig: pouches and a collar, like a grunt's tactical vest
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const pouch = mesh(new THREE.BoxGeometry(0.11, 0.12, 0.08), 'black'); pouch.position.set(s * (0.1 + i * 0.13), 0.12 - i * 0.02, -0.3); c.add(pouch); }
  const collar = mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), 'vyrr'); collar.rotation.x = Math.PI / 2; collar.position.y = 0.62; c.add(collar);
  const spine = mesh(new THREE.BoxGeometry(0.12, 0.5, 0.08), 'vyrrGold'); spine.position.set(0, 0.25, 0.3); c.add(spine);
  const pack = mesh(new THREE.BoxGeometry(0.28, 0.32, 0.12), 'vyrr'); pack.position.set(0, 0.3, 0.32); c.add(pack);
  for (const s of [-1, 1]) { const pad = mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, 1.4), 'vyrr'); pad.position.set(s * 0.36, 0.56, 0); pad.rotation.z = -s * 0.5; pad.scale.set(1.2, 0.9, 1.1); c.add(pad); }
  const pelvis = mesh(new THREE.SphereGeometry(0.24, 10, 6), 'scales'); pelvis.scale.set(1.2, 0.6, 0.9); pelvis.position.y = -0.18; b.add(pelvis);
  const abd = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.24, 10), 'scales'); abd.position.y = -0.04; b.add(abd);
  const belt = mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 12), 'black'); belt.rotation.x = Math.PI / 2; belt.position.y = -0.14; b.add(belt);
  for (const L of r.legs) {
    const kp = mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, 1.4), 'vyrrGold'); kp.position.set(0, -L.L1 + 0.02, -0.06); kp.rotation.x = -1.4; L.hip.add(kp); // knee pad
    const boot = mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.24, 8, 1, true), 'vyrr'); boot.position.y = -L.L2 + 0.14; L.knee.add(boot);
  }
  const head = reptileHead(1.45, true, 0xffd040); r.head.add(head); r.jaw = head.jaw;
  r.gun = null; r.height = 2.25; r.type = 'trooper';
  r.gunPose = { aim: [0.18, 0.28, -0.42], idle: [0.3, -0.15, -0.22] };
  if (holo) {
    const hm = basicGlow(0x2fa8d8, 0.22).clone();
    r.root.traverse((o) => { if (o.isMesh) { o.material = hm; o.castShadow = false; } });
    r.holo = true; r.holoMat = hm;
  }
  if (!holo || shielded) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), shieldMat());
    sh.scale.set(0.95, 1.55, 0.9); sh.position.y = 1.15; r.root.add(sh); r.shield = sh;
  }
  r.animate = (e, ctx) => animateBiped(r, e, ctx);
  return r;
}

function heavyRig() {
  const r = buildBiped({
    type: 'heavy', bodyY: 1.55, skin: 'scales', armor: 'vyrr',
    hip: { x: 0.42, y: -0.5, z: 0.05 }, thigh: { len: 0.5, r0: 0.24, r1: 0.19 }, shin: { len: 0.45, r0: 0.18, r1: 0.15 }, foot: { len: 0.28, r0: 0.14, r1: 0.16, angle: 0.5 },
    toe: [0.36, 0.1, 0.36], legPole: [0, -0.3, 1], stride: 0.55, lift: 0.14, thighMat: 'vyrr',
    shoulder: { x: 0.88, y: 0.6, z: 0 }, upper: { len: 0.5, r0: 0.2, r1: 0.16 }, fore: { len: 0.46, r0: 0.16, r1: 0.13 }, handScale: 2.2,
    neck: { y: 0.95, len: 0.2, r: 0.16, z: -0.3 }, tail: { n: 5, len: 0.3, r0: 0.16, r1: 0.04, y: -0.5, z: 0.5 },
  });
  const b = r.body, c = r.chest;
  const torso = mesh(lathe([[0.42, -0.6], [0.78, -0.2], [0.88, 0.4], [0.72, 0.9], [0.3, 1.1]], 10), 'vyrr'); torso.scale.set(1.15, 1, 0.9); c.add(torso);
  const hump = mesh(new THREE.SphereGeometry(0.72, 10, 8), 'scales'); hump.position.set(0, 0.7, 0.4); hump.scale.set(1.1, 0.8, 0.9); c.add(hump);
  const pelvis = mesh(new THREE.SphereGeometry(0.5, 10, 6), 'scales'); pelvis.scale.set(1.2, 0.6, 0.9); pelvis.position.y = -0.5; b.add(pelvis);
  // the soft back: glowing spine segments (the weak spot)
  r.spine = [];
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.13 - i * 0.015, 8, 6), emissiveMat(0xffa040, 2.2)); sp.position.set(0, 0.95 - i * 0.3, 0.78 - i * 0.06); c.add(sp); r.spine.push(sp); }
  for (const s of [-1, 1]) { const pad = mesh(new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, 1.4), 'vyrrGold'); pad.position.set(s * 0.9, 0.72, 0); pad.rotation.z = -s * 0.4; pad.scale.set(1.2, 0.8, 1.1); c.add(pad); }
  const head = reptileHead(1.7, true, 0xff8040); r.head.add(head); r.jaw = head.jaw;
  // left forearm: the slab shield; right forearm: the fuel-lance cannon (both ride the hold frames, which follow the hand targets)
  const L = r.arms[0], R = r.arms[1];
  const slab = mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.3, 10, 1, false, -0.6, 1.2), 'vyrrGold');
  slab.position.set(0.1, -0.1, 0.8); slab.rotation.set(0, Math.PI, 0); L.hold.add(slab); r.slab = slab;
  for (let i = 0; i < 3; i++) { const a = -0.4 + i * 0.4; const rib = mesh(new THREE.BoxGeometry(0.1, 2.1, 0.12), 'vyrr'); rib.position.set(0.1 - Math.sin(a) * 1.32, -0.1, 0.8 - Math.cos(a) * 1.32); rib.rotation.y = -a; L.hold.add(rib); }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emissiveMat(0xffa040, 1.6)); boss.position.set(0.1, -0.1, -0.52); L.hold.add(boss);
  L.hand.visible = false;
  const cannon = mesh(lathe([[0.2, 0], [0.3, 0.3], [0.28, 1.3], [0.18, 1.6]], 10), 'vyrr'); cannon.position.set(0, -0.15, 0.1); cannon.rotation.x = -Math.PI / 2; R.hold.add(cannon);
  for (let i = 0; i < 4; i++) { const ring = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 10), 'vyrrGold'); ring.position.set(0, -0.15, -0.4 - i * 0.3); R.hold.add(ring); }
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 8), emissiveMat(0x7dff4f, 2.5)); bore.rotation.x = Math.PI / 2; bore.position.set(0, -0.15, -1.52); R.hold.add(bore); r.bore = bore;
  R.hand.visible = false;
  r.gun = null; r.height = 2.9; r.type = 'heavy';
  r.animate = (e, ctx) => animateBiped(r, e, ctx);
  return r;
}

function droneRig() {
  const root = new THREE.Group(), body = joint(0, 0, 0); root.add(body);
  const pod = mesh(lathe([[0.02, -0.42], [0.3, -0.26], [0.42, 0.05], [0.3, 0.3], [0.05, 0.4]], 12), 'vyrr'); pod.rotation.x = Math.PI / 2; body.add(pod);
  const band = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 14), 'vyrrGold'); band.position.z = 0.02; body.add(band);
  // gimballed eye
  const gimbal = joint(0, 0, -0.34); body.add(gimbal);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), emissiveMat(0xffb040, 3)); gimbal.add(eye);
  const iris = mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), 'black'); iris.position.z = -0.05; gimbal.add(iris);
  // two counter-rotating gyro rings and three fins
  const ring1 = mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 20), 'vyrr'); body.add(ring1);
  const ring2 = mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 20), 'vyrrGold'); ring2.rotation.x = Math.PI / 2; body.add(ring2);
  const fins = [];
  for (let i = 0; i < 3; i++) {
    const f = joint(0, 0, 0.1); f.rotation.z = (i / 3) * Math.PI * 2; body.add(f);
    const blade = mesh(new THREE.BoxGeometry(0.06, 0.6, 0.36), 'vyrr'); blade.position.y = 0.5; blade.rotation.x = 0.25; f.add(blade);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.3), emissiveMat(0x9b6bff, 2)); tip.position.y = 0.82; tip.rotation.x = 0.25; f.add(tip);
    fins.push(f);
  }
  // two grabber arms dangling underneath
  const arms = [];
  for (const s of [-1, 1]) {
    const a0 = bone(body, 0.22, 0.05, 0.04, MAT('scales'), { x: s * 0.18, y: -0.3, z: 0.05, seg: 6 });
    const a1 = bone(a0.end, 0.2, 0.04, 0.03, MAT('scales'), { seg: 6 });
    const claw = mesh(new THREE.ConeGeometry(0.035, 0.12, 4), 'vyrrGold'); claw.position.y = -0.24; claw.rotation.x = Math.PI; a1.joint.add(claw);
    arms.push({ a: a0.joint, b: a1.joint, s });
  }
  const jet = new THREE.Sprite(glowMat(0xffb040, 0.9)); jet.scale.set(0.9, 0.9, 1); jet.position.z = 0.48; body.add(jet);
  const r = { root, body, head: null, legs: [], arms: [], fins, ring1, ring2, gimbal, jet, drArms: arms, gun: null, height: 0.8, type: 'drone', fall: 0, spin: 0 };
  r.animate = (e, ctx) => animateDrone(r, e, ctx);
  return r;
}

// Halo-style personal shield: invisible until hit, then a fresnel shimmer.
function shieldMat() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0x9b6bff) }, amount: { value: 0 }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float amount; uniform float time;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float hex = 0.7 + 0.3 * step(0.5, fract(vP.y * 9.0 + sin(vP.x * 12.0 + time * 2.0) * 0.5));
        float bands = 0.6 + 0.4 * sin(vP.y * 22.0 + time * 9.0);
        gl_FragColor = vec4(color * (f * 1.6 + 0.12) * bands * hex, (f + 0.15) * amount);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

// ======================================================================
// ANIMATION
// ======================================================================
// ctx: { dt, t, px, py, pz (player), fx, quality }
const FWD = new THREE.Vector3(0, 0, -1);
const _pole = V(), _tgt = V(), _tq = Q(), _gq = Q(), _gp = V();

function animateBiped(r, e, ctx) {
  const { dt, t } = ctx, s = r.spec;
  const d = r.height;
  r.root.position.set(e.x, e.y, e.z);
  // ---------------------------------------------------------- death: the body drops, limbs go slack
  if (e.dead) {
    r.fall = Math.min(1, r.fall + dt * 2.4);
    r.spin += e.spin * dt;
    const k = r.fall, kk = k * k * (3 - 2 * k);
    const back = e.dvz * Math.cos(e.yaw) + e.dvx * Math.sin(e.yaw) > 0 ? -1 : 1;
    r.root.rotation.set(0, e.yaw + r.spin, 0);
    r.root.rotateX(kk * Math.PI * 0.47 * back);
    r.root.position.y += 0.22 * kk;
    r.body.position.y = s.bodyY - kk * 0.1;
    r.body.rotation.set(-back * kk * 0.2, 0, kk * 0.15);
    r.chest.rotation.set(0, 0, 0);
    // legs: knees fold, feet trail
    for (const L of r.legs) {
      L.hip.rotation.set(-0.3 * kk * back + (L.side > 0 ? 0.2 : -0.1) * kk, 0, L.side * 0.25 * kk);
      L.knee.rotation.set(0.9 * kk, 0, 0); L.ankle.rotation.set(0.6, 0, 0);
    }
    // arms: fall outward and down
    for (const A of r.arms) { A.sh.rotation.set(0.3 + kk * 0.9, 0, A.side * (1.6 - kk * 0.4)); A.el.rotation.set(0, 0, A.side * (0.5 + kk * 0.6)); A.hand.grip?.(0.2); }
    r.neck.rotation.set(Math.PI + 0.4 * kk * back, 0.5 * kk, 0);
    if (r.jaw) r.jaw.rotation.x = 0.35 * kk;
    if (r.tail) r.tail.forEach((j, i) => { j.rotation.z = Math.sin(i + r.spin) * 0.2 * (1 - kk); if (i === 0) j.rotation.x = -Math.PI / 2 + 0.3 + kk * 0.6; });
    if (r.shield) r.shield.visible = false;
    if (r.gun) { r.gun.group.visible = e.deadT < 0.05 && false; }
    return;
  }
  r.root.rotation.set(0, e.yaw, 0);
  if (e.riding) { animateRider(r, e, ctx); return; }
  // ---------------------------------------------------------- locomotion
  const speed = Math.hypot(e.vx, e.vz);
  const moving = speed > 0.3 ? Math.min(1, speed / 3) : 0;
  r.gait += (moving - r.gait) * Math.min(1, dt * 8);
  const freq = s.type === 'heavy' ? 1.3 : s.type === 'skitter' ? 3.0 : 2.0;
  const ph = e.walk * freq;
  const flee = e.mode === 'flee' || e.mode === 'panic';
  const charge = e.mode === 'charge' || e.berserk;
  // local movement direction (forward = -z): strafing legs swing sideways a little
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  const along = (e.vx * fx + e.vz * fz) / (speed || 1), across = (e.vx * -fz + e.vz * fx) / (speed || 1);
  const bobY = Math.abs(Math.sin(ph)) * (s.type === 'heavy' ? 0.08 : 0.05) * r.gait;
  r.body.position.y = s.bodyY + bobY - (e.type === 'skitter' && !e.alert ? 0.04 : 0);
  // lean into the run, sway with the gait
  const leanX = r.gait * along * (flee ? 0.35 : charge ? 0.4 : 0.15) + (s.type === 'skitter' ? 0.2 : 0);
  r.body.rotation.set(leanX, 0, -across * r.gait * 0.12 + Math.sin(ph) * 0.04 * r.gait);
  // hit flinch, dodge lean
  const flinch = e.hitT < 0.25 ? bump(e.hitT / 0.25) * 0.25 : 0;
  const dodge = e.dodgeT > 0 ? e.orbit * 0.35 : 0;
  r.body.rotation.x += flinch;
  r.body.rotation.z += dodge;
  // ---------------------------------------------------------- legs: feet plant via IK
  const groundY = -r.body.position.y;
  for (let i = 0; i < r.legs.length; i++) {
    const L = r.legs[i], p = ph + i * Math.PI;
    const swing = Math.sin(p), lift = Math.max(0, swing) * s.lift * r.gait;
    const zt = Math.cos(p) * s.stride * 0.5 * r.gait * (along >= 0 ? 1 : -1);
    const xt = L.side * s.hip.x + Math.cos(p) * s.stride * 0.35 * r.gait * across;
    const ankleH = s.foot.len * Math.cos(s.foot.angle) + 0.02;
    L.target.set(xt, groundY + ankleH + lift, zt + s.hip.z + (s.type === 'skitter' ? -0.05 : 0.02));
    // counter the body's lean so the feet stay on the ground: express the target in body space
    _e.set(-r.body.rotation.x, 0, -r.body.rotation.z); L.target.applyEuler(_e);
    _pole.set(0, s.legPole[1], s.legPole[2]);
    ik2(L.hip, L.knee, L.L1, L.L2, L.target, _pole);
    // foot: fixed world pitch (down-forward), toes dip during the swing
    _e.set(s.foot.angle + Math.max(0, swing) * 0.4 * r.gait, 0, 0); _tq.setFromEuler(_e);
    ikHand(L.hip, L.knee, L.ankle, _tq);
  }
  // ---------------------------------------------------------- upper body: twist toward the aim
  const px = ctx.px, pz = ctx.pz;
  const dx = px - e.x, dz = pz - e.z, dh = Math.hypot(dx, dz) || 1;
  const dy = (ctx.py + 1.2) - (e.y + d * 0.7);
  const wantYaw = e.alert && !flee ? clamp(wrap(Math.atan2(-dx, -dz) - e.yaw), -0.7, 0.7) : 0;
  const wantPitch = e.alert && !flee ? clamp(Math.atan2(dy, dh), -0.7, 0.7) : 0;
  r.twist += (wantYaw - r.twist) * Math.min(1, dt * 6);
  r.chest.rotation.set(wantPitch * 0.25, r.twist * 0.6, 0);
  // head: looks at you when alert, scans when idle; jaw opens on the roar / windup
  const idleScan = e.alert ? 0 : Math.sin(t * 0.7 + e.id) * 0.5;
  r.headYaw += ((e.alert ? clamp(wantYaw - r.twist * 0.6, -0.8, 0.8) : idleScan) - r.headYaw) * Math.min(1, dt * 7);
  r.headPitch += ((e.alert ? wantPitch * 0.7 : Math.sin(t * 0.5 + e.id) * 0.1) - r.headPitch) * Math.min(1, dt * 7);
  r.neck.rotation.set(Math.PI - r.headPitch * 0.3 + (s.type === 'skitter' ? -0.3 : 0), r.headYaw, 0);
  r.head.rotation.set(Math.PI + r.headPitch * 0.7 + (s.type === 'skitter' ? 0.25 : 0), 0, 0);
  if (r.jaw) {
    const roar = (e.reactT > 0 && e.alert ? 1 : 0) + (e.windup > 0 ? 1 : 0) + (charge ? 0.6 : 0) + (flee ? 0.4 + 0.3 * Math.sin(t * 20) : 0);
    r.jaw.rotation.x += (Math.min(0.55, roar * 0.4 + Math.max(0, Math.sin(t * 3 + e.id)) * 0.05) - r.jaw.rotation.x) * Math.min(1, dt * 10);
  }
  // tail: sways with the gait and the turn
  if (r.tail) r.tail.forEach((j, i) => { j.rotation.z = Math.sin(t * 2.2 + i * 0.7 + e.id) * 0.18 + Math.sin(ph + i * 0.5) * 0.15 * r.gait; if (i === 0) j.rotation.x = -Math.PI / 2 + 0.3 + (flee ? 0.4 : 0); else j.rotation.x = 0.12 + Math.sin(t * 1.5 + i) * 0.05; });
  // ---------------------------------------------------------- arms
  if (s.type === 'heavy') animateHeavyArms(r, e, ctx, wantPitch, ph);
  else animateArmedArms(r, e, ctx, wantPitch, ph, flee, charge);
  // ---------------------------------------------------------- shield + holo + stuck sparkle
  if (r.shield) {
    const k = Math.max(0, 1 - e.shieldHitT * 2.5) * (e.shield > 0 ? 1 : 0) + (e.shield > 0 && e.shield < e.maxShield && e.shieldT > 3 ? 0.25 : 0);
    r.shield.material.uniforms.amount.value = k; r.shield.material.uniforms.time.value = t; r.shield.visible = k > 0.01;
  }
  if (r.holo) r.holoMat.opacity = 0.2 + Math.max(0, 1 - e.hitT * 3) * 0.5;
  if (r.spine) r.spine.forEach((sp, i) => { sp.material = emissiveMat(0xffa040, 1.8 + Math.sin(t * 4 + i) * 0.6 + (e.enrage ? 1.5 : 0)); });
  if (e.stuck && Math.random() < 0.5) ctx.fx.spawn({ p: [e.x, e.y + d * 0.6, e.z], life: 0.1, size: 0.6, color: 0x6fc8ff });
}

// A Vyrr on a Sliver: crouched over the bars, tail out behind, head tracking you.
function animateRider(r, e, ctx) {
  const { dt, t } = ctx, s = r.spec;
  r.body.position.y = s.bodyY - 0.55; r.body.rotation.set(0.35, 0, 0); r.chest.rotation.set(0.3, 0, 0);
  const groundY = -r.body.position.y;
  for (const L of r.legs) {
    L.target.set(L.side * (s.hip.x + 0.25), groundY + 0.55, -0.35 + L.side * 0.05);
    _pole.set(L.side * 0.4, 0.4, -1); ik2(L.hip, L.knee, L.L1, L.L2, L.target, _pole);
    _e.set(0.9, 0, 0); _tq.setFromEuler(_e); ikHand(L.hip, L.knee, L.ankle, _tq);
  }
  for (const A of r.arms) {
    A.target.set(A.side * 0.45, s.shoulder.y - 0.35, -0.75);
    _e.set(-0.5, 0, A.side * 0.5); A.tgtQ.setFromEuler(_e);
    _pole.set(A.side * 0.7, -0.6, 0.2); ik2(A.sh, A.el, A.L1, A.L2, A.target, _pole); ikHand(A.sh, A.el, A.hand, A.tgtQ);
    A.hand.grip?.(0.9);
  }
  if (r.gun) r.gun.group.visible = false;
  const dx = ctx.px - e.x, dz = ctx.pz - e.z;
  const wantYaw = clamp(wrap(Math.atan2(-dx, -dz) - e.yaw), -0.9, 0.9);
  r.headYaw += (wantYaw - r.headYaw) * Math.min(1, dt * 6);
  r.neck.rotation.set(Math.PI - 0.5, r.headYaw, 0); r.head.rotation.set(Math.PI + 0.2, 0, 0);
  if (r.jaw) r.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(t * 6 + e.id)) * 0.1;
  if (r.tail) r.tail.forEach((j, i) => { j.rotation.z = Math.sin(t * 6 + i) * 0.12; j.rotation.x = i === 0 ? -Math.PI / 2 - 0.1 : 0.1; });
  if (r.shield) { const k = Math.max(0, 1 - e.shieldHitT * 2.5) * (e.shield > 0 ? 1 : 0); r.shield.material.uniforms.amount.value = k; r.shield.material.uniforms.time.value = t; r.shield.visible = k > 0.01; }
}

// Armed bipeds (Skitter, Trooper): the gun is a child of the chest; both hands IK onto it.
function animateArmedArms(r, e, ctx, aimPitch, ph, flee, charge) {
  const { dt, t } = ctx, s = r.spec;
  const g = r.gun;
  const windup = e.windup > 0, strike = e.meleeT > 1.0; // meleeT is set to 1.2 at the strike
  const raise = e.alert && !flee && !charge ? 1 : 0;
  r.raise = (r.raise ?? raise) + (raise - (r.raise ?? raise)) * Math.min(1, dt * 5);
  const sc = r.type === 'skitter' ? 1.1 : 1.45;
  if (g && !flee && !charge) {
    g.group.visible = true;
    const a = r.gunPose.aim, i = r.gunPose.idle, k = r.raise;
    g.group.position.set(a[0] * k + i[0] * (1 - k), a[1] * k + i[1] * (1 - k), a[2] * k + i[2] * (1 - k));
    g.group.rotation.set(-aimPitch * 0.75 * k - 0.45 * (1 - k), -0.05, 0);
    // recoil kick right after a shot
    if (e.fireT > 0 && e.burstLeft > 0) g.group.position.z += 0.03;
    if (windup) { g.group.rotation.x -= 0.6; g.group.position.x += 0.15; }
    g.group.scale.setScalar(sc);
    childPose(g.group, g.grip, _gp, _gq);
    r.arms[1].target.copy(_gp); r.arms[1].tgtQ.copy(_gq);
    childPose(g.group, g.fore, _gp, _gq);
    r.arms[0].target.copy(_gp); r.arms[0].tgtQ.copy(_gq);
    r.arms[1].hand.grip?.(0.9, e.burstLeft > 0 ? 1 : 0.6); r.arms[0].hand.grip?.(0.75);
  } else {
    if (g) g.group.visible = false;
    for (const A of r.arms) {
      const sd = A.side;
      if (flee) { // arms up, waving
        A.target.set(sd * s.shoulder.x * 1.3 + Math.sin(t * 16 + sd) * 0.1, s.shoulder.y + 0.5 + Math.sin(t * 12 + sd * 2) * 0.1, -0.2);
        _e.set(-1.2, 0, sd * 0.6); A.tgtQ.setFromEuler(_e);
        A.hand.grip?.(0.1);
      } else if (charge) { // berserk: arms out, claws open
        A.target.set(sd * s.shoulder.x * 1.5, s.shoulder.y - 0.2 + Math.sin(ph + sd) * 0.15, -0.45);
        _e.set(-0.6, 0, sd * 0.3); A.tgtQ.setFromEuler(_e);
        A.hand.grip?.(0.05);
      } else { // unarmed idle: arms at the sides, swinging with the gait
        A.target.set(sd * (s.shoulder.x + 0.05), s.shoulder.y - s.upper.len - s.fore.len * 0.8, Math.sin(ph + sd * Math.PI) * 0.25 * r.gait);
        _e.set(0.2, 0, sd * 0.1); A.tgtQ.setFromEuler(_e);
        A.hand.grip?.(0.4);
      }
    }
  }
  // melee: the right arm swings through (gun or claw)
  if (windup || strike) {
    const A = r.arms[1];
    const kw = windup ? 1 - Math.min(1, e.windup / 0.35) : 0;
    const ks = strike ? 1 - (e.meleeT - 1.0) / 0.2 : 0;
    A.target.set(0.5 + kw * 0.2, s.shoulder.y + 0.3 * kw - ks * 0.3, 0.1 - ks * 0.9);
    if (ks > 0) r.chest.rotation.y -= 0.5 * bump(ks);
    if (kw > 0) r.chest.rotation.y += 0.4 * kw;
  }
  for (const A of r.arms) {
    _pole.set(A.side * 0.5, -0.6, 0.35);
    ik2(A.sh, A.el, A.L1, A.L2, A.target, _pole);
    ikHand(A.sh, A.el, A.hand, A.tgtQ);
  }
}

// The Bulwark: shield arm forward, cannon arm tracks you, overhead slam.
function animateHeavyArms(r, e, ctx, aimPitch, ph) {
  const { t } = ctx, s = r.spec;
  const L = r.arms[0], R = r.arms[1];
  const windup = e.windup > 0, strike = e.meleeT > 1.0;
  const kw = windup ? 1 - Math.min(1, e.windup / 0.6) : 0, ks = strike ? 1 - (e.meleeT - 1.0) / 0.2 : 0;
  // shield arm: forearm vertical in front of the body, raised for the slam
  L.target.set(-0.55, s.shoulder.y - 0.55 + kw * 0.9 - ks * 1.0, -0.55 - ks * 0.4);
  _e.set(-0.15 + kw * 0.6 - ks * 0.8, 0.25, 0.1); L.tgtQ.setFromEuler(_e);
  // cannon arm: aims at you
  R.target.set(0.85, s.shoulder.y - 0.35 + Math.sin(aimPitch) * 0.4, -0.5 - Math.cos(aimPitch) * 0.2);
  _e.set(-aimPitch + (e.fireT > 0 && e.burstLeft > 0 ? 0.2 : 0), 0, 0); R.tgtQ.setFromEuler(_e);
  if (e.enrage) { R.target.y += Math.sin(t * 9) * 0.05; }
  for (const A of r.arms) {
    _pole.set(A.side * 0.9, -0.4, 0.2);
    ik2(A.sh, A.el, A.L1, A.L2, A.target, _pole);
    ikHand(A.sh, A.el, A.hand, A.tgtQ);
    A.hold.quaternion.copy(A.hand.quaternion);
  }
  // stomp: the body drops with each step
  r.body.position.y -= Math.max(0, -Math.sin(ph * 2)) * 0.03 * r.gait;
  if (ks > 0) r.body.rotation.x += 0.35 * bump(ks);
  if (r.bore) r.bore.material = emissiveMat(0x7dff4f, e.burstLeft > 0 ? 4 : 2.5);
}

function animateDrone(r, e, ctx) {
  const { dt, t } = ctx;
  r.root.position.set(e.x, e.y + Math.sin(t * 5 + e.id) * 0.05, e.z);
  const speed = Math.hypot(e.vx, e.vz);
  if (e.dead) {
    r.spin += dt * 6;
    r.root.rotation.set(r.spin, e.yaw, r.spin * 0.7);
    for (const f of r.fins) f.rotation.z += dt * 1;
    if (Math.random() < 0.3) ctx.fx.puff([e.x, e.y, e.z], 1, 0x333333, 0.3);
    r.root.visible = e.deadT < 6;
    return;
  }
  // bank into the turn, pitch into the move
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  const along = (e.vx * fx + e.vz * fz), across = (e.vx * -fz + e.vz * fx);
  r.root.rotation.set(-along * 0.06, e.yaw, across * 0.1 + Math.sin(t * 3 + e.id) * 0.08);
  for (const f of r.fins) f.rotation.z += dt * 14;
  r.ring1.rotation.x += dt * 2.2; r.ring1.rotation.y += dt * 1.1;
  r.ring2.rotation.y -= dt * 1.7;
  // eye tracks you
  const dx = ctx.px - e.x, dz = ctx.pz - e.z, dy = ctx.py + 1.2 - e.y;
  const wy = e.alert ? clamp(wrap(Math.atan2(-dx, -dz) - e.yaw), -0.6, 0.6) : Math.sin(t * 0.9 + e.id) * 0.4;
  const wp = e.alert ? clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.6) : 0;
  r.gimbal.rotation.set(-wp, wy, 0);
  // grabber arms twitch, drift with the motion
  r.drArms.forEach((A, i) => { A.a.rotation.set(0.3 + Math.sin(t * 2 + i) * 0.2 + along * 0.05, 0, A.s * (0.3 + Math.sin(t * 1.3 + i * 2) * 0.15)); A.b.rotation.set(0.6 + Math.sin(t * 2.6 + i) * 0.3, 0, 0); });
  r.jet.material.opacity = 0.6 + Math.min(1, speed / 6) * 0.4;
}

// ======================================================================
// PLAYER BODY ANIMATION (first person legs / vehicle seat)
// ======================================================================
// pose: 'walk' (feet track the ground under the camera) or 'seat' (sitting, hands on controls)
export function animatePlayerBody(r, p, ctx, pose = 'walk', seat = null) {
  const { dt, t } = ctx, s = r.spec;
  const speed = Math.hypot(p.vel.x, p.vel.z);
  const armsTo = (hands, rot) => {
    r.arms.forEach((A) => {
      const h = hands[A.side > 0 ? 1 : 0];
      A.target.set(h[0], h[1] - r.body.position.y, h[2]);
      _e.set(rot?.[0] ?? -0.5, 0, A.side * (rot?.[2] ?? 0.45)); A.tgtQ.setFromEuler(_e);
      _pole.set(A.side * 0.7, -0.8, 0.15); ik2(A.sh, A.el, A.L1, A.L2, A.target, _pole); ikHand(A.sh, A.el, A.hand, A.tgtQ);
      A.hand.grip?.(0.9);
    });
  };
  if (pose === 'seat') {
    // sitting: pelvis dropped, thighs forward, feet on the floorboard, hands on the wheel / bars
    r.body.position.y = s.bodyY - 0.6; r.body.rotation.set(-0.18, 0, 0); r.chest.rotation.set(seat?.lean ?? 0.25, 0, 0);
    const legY = seat?.legY ?? -0.55;
    r.legs.forEach((L) => {
      L.target.set(L.side * (s.hip.x + 0.06), legY - r.body.position.y, -0.62);
      _pole.set(0, 1, -0.6); ik2(L.hip, L.knee, L.L1, L.L2, L.target, _pole);
      _e.set(0.35, 0, 0); _tq.setFromEuler(_e); ikHand(L.hip, L.knee, L.ankle, _tq);
    });
    if (seat?.hands) armsTo(seat.hands, seat.handRot);
    r.neck.rotation.set(Math.PI - 0.15, seat?.headYaw || 0, 0); r.head.rotation.set(Math.PI + (seat?.headPitch || 0), 0, 0);
    return;
  }
  if (pose === 'stand') { // standing at the turret
    r.gait += (0 - r.gait) * Math.min(1, dt * 8);
    r.body.position.y = s.bodyY - 0.05; r.body.rotation.set(0.05, 0, 0); r.chest.rotation.set(0.15, 0, 0);
    const groundY = -r.body.position.y, ankleH = s.foot.len * Math.cos(s.foot.angle) + 0.02;
    r.legs.forEach((L) => {
      L.target.set(L.side * (s.hip.x + 0.08), groundY + ankleH, L.side * 0.08);
      _pole.set(0, -0.3, -1); ik2(L.hip, L.knee, L.L1, L.L2, L.target, _pole);
      _e.set(s.foot.angle, 0, 0); _tq.setFromEuler(_e); ikHand(L.hip, L.knee, L.ankle, _tq);
    });
    if (seat?.hands) armsTo(seat.hands, seat.handRot);
    r.neck.rotation.set(Math.PI, 0, 0); r.head.rotation.set(Math.PI + (seat?.headPitch || 0), 0, 0);
    return;
  }
  // walk: gait phase from distance; crouch folds the legs
  const moving = p.onGround ? Math.min(1, speed / 4) : 0;
  r.gait += (moving - r.gait) * Math.min(1, dt * 8);
  r.gaitPh += dt * speed * 1.9;
  const crouch = p.crouch;
  const bodyY = s.bodyY - crouch * 0.55;
  r.body.position.y = bodyY + Math.abs(Math.sin(r.gaitPh)) * 0.03 * r.gait;
  r.body.rotation.set(crouch * 0.35 + (p.onGround ? 0 : -0.15), 0, 0);
  const groundY = -r.body.position.y;
  const yaw = p.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const along = (p.vel.x * fx + p.vel.z * fz) / (speed || 1), across = (p.vel.x * -fz + p.vel.z * fx) / (speed || 1);
  r.legs.forEach((L, i) => {
    const ph = r.gaitPh + i * Math.PI, swing = Math.sin(ph), lift = Math.max(0, swing) * s.lift * r.gait;
    const zt = Math.cos(ph) * s.stride * 0.5 * r.gait * along, xt = L.side * s.hip.x + Math.cos(ph) * s.stride * 0.4 * r.gait * across;
    const ankleH = s.foot.len * Math.cos(s.foot.angle) + 0.02;
    L.target.set(xt, groundY + ankleH + lift + (p.onGround ? 0 : 0.25), zt - crouch * 0.1);
    _e.set(-r.body.rotation.x, 0, 0); L.target.applyEuler(_e);
    _pole.set(0, -0.3, -1); ik2(L.hip, L.knee, L.L1, L.L2, L.target, _pole);
    _e.set(s.foot.angle + Math.max(0, swing) * 0.5 * r.gait, 0, 0); _tq.setFromEuler(_e); ikHand(L.hip, L.knee, L.ankle, _tq);
  });
  r.chest.rotation.set(-crouch * 0.1, 0, 0);
  r.neck.rotation.set(Math.PI, 0, 0); r.head.rotation.set(Math.PI + p.pitch * 0.5, 0, 0);
}
