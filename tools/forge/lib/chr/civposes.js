// Poses for the civilian / agent cast (rig space only, like poses.js):
//   agentAim(R, gun, { fire })   the Man in Black: one arm out, body bladed, two fingers to the earpiece
//   cowerUp(R)                   crouched, looking up, both hands raised palms-out ("don't shoot")
//   waveThanks(R)                standing, waving with an open hand, relieved
//   waveOn(R)                    pointing the player on ("go, that way"), looking where it points
//   pointHand(h)                 index finger out, the rest curled
//   groundTorso(R, parts) / settleLimb(R, joint, o) / settleBody(R, parts)
//                                lying bodies: the torso on the floor, then every limb swung down
//                                until it just touches (no hovering hands, no feet through the floor)
import * as THREE from 'three';
import { handQ, stand } from './biped.js';
import { placeGun, aimQ } from './guns.js';
import { headTurn } from './poses.js';
import { V3 } from './core.js';

export function pointHand(h) {
  h.pose(0.95, 0, 0.75);
  const idx = h.fingers.reduce((a, b) => (b.z > a.z ? b : a));
  idx.segs.forEach((j) => j.rotation.set(0, 0, 0));
}

export function agentAim(R, gun, o = {}) {
  const kick = o.fire ? 1 : 0;
  stand(R, { dz: [0.1, -0.12], wide: 1.45, crouch: 0.015 });
  R.pelvis.rotation.set(0, -0.22, 0);
  R.spine.rotation.set(0.02, -0.12, 0);
  R.chest.rotation.set(-kick * 0.04, -0.1, 0);
  headTurn(R, 0.03 + kick * 0.03, 0.42, 0.03);
  const s0 = R.shPos(0);
  const pos = s0.clone().add(V3(0.02, -0.01 + kick * 0.035, 0.55 - kick * 0.035));
  placeGun(R, gun, pos, aimQ(V3(0.0, kick * 0.3, 1)), { twoHand: false, pole0: V3(-0.6, -1, -0.1) });
  R.hands[0].pose(0.95, 0, 0.9);
  if (o.earHand === false) {
    R.armHang(1, 0.08, { reach: 0.95, out: 0.12 });
    R.hands[1].pose(0.5, 0.1);
  } else {
    // left hand up to the earpiece: wrist below and outside the ear, fingers to it
    R.sync();
    const ear = R.toRig(R.head, V3(0.088, 0.04, 0.012));
    const wrist = R.toRig(R.head, V3(0.135, -0.085, 0.05));
    R.arm(1, wrist, { pole: V3(0.35, -1, 0.55), hand: handQ(ear.clone().sub(wrist), V3(-1, 0, 0.1), -1) });
    R.hands[1].pose(0.3, 0.05, 0.3);
    const ix = R.hands[1].fingers.reduce((a, b) => (b.z > a.z ? b : a));
    ix.segs.forEach((j) => j.rotation.set(0, 0, 0));
  }
  gun.flash.visible = !!o.fire;
  if (o.fire) gun.flash.rotation.z = o.flashRot ?? 0.4;
}

export function cowerUp(R, o = {}) {
  const S = R.S;
  R.pelvis.position.set(0, S.hipY * 0.52, -0.1);
  R.pelvis.rotation.set(0.42, 0.06, 0.03);
  for (const L of R.legs) R.leg(L.i, { x: L.hx * 1.9, z: 0.05 + (L.i ? 0.06 : -0.03), pitch: 0.15, yaw: -L.side * 0.3, pole: V3(-L.side * 0.6, 0.2, 1) });
  R.spine.rotation.set(0.05, 0.05, 0); R.chest.rotation.set(-0.12, 0.03, 0.02);
  headTurn(R, -0.45, 0.08, 0.1);
  for (const A of R.arms) {
    const s = R.shPos(A.i);
    R.arm(A.i, s.clone().add(V3(-A.side * (0.17 + (A.i ? 0.02 : 0)), 0.2 + (A.i ? 0.04 : 0), 0.26)), { pole: V3(-A.side, -0.8, -0.1), hand: handQ(V3(-A.side * 0.18, 1, 0.12), V3(0, 0.15, 1), A.side) });
    R.hands[A.i].pose(0.06, 0.95, 0.15);
  }
}

export function waveThanks(R) {
  stand(R, { dz: [0.03, -0.05], wide: 1.25, crouch: 0.01 });
  R.pelvis.rotation.set(0, 0.06, 0.04);
  R.spine.rotation.set(-0.03, 0.05, -0.04); R.chest.rotation.set(-0.05, 0.05, -0.05);
  headTurn(R, -0.04, 0.0, 0.14);
  const s0 = R.shPos(0);
  R.arm(0, s0.clone().add(V3(-0.26, 0.4, 0.14)), { pole: V3(-1, -0.6, -0.2), hand: handQ(V3(-0.3, 1, 0.05), V3(0, 0.1, 1), 1) });
  R.hands[0].pose(0.04, 0.95, 0.1);
  R.armHang(1, 0.06, { reach: 0.95, out: 0.12 });
  R.hands[1].pose(0.45, 0.1);
}

export function waveOn(R) {
  stand(R, { dz: [0.06, -0.08], wide: 1.3, crouch: 0.015 });
  R.pelvis.rotation.set(0, -0.12, 0);
  R.spine.rotation.set(0.02, -0.12, 0); R.chest.rotation.set(0.0, -0.16, 0);
  headTurn(R, 0.02, -0.55, 0.0);
  const s0 = R.shPos(0);
  const d = V3(-0.78, 0.12, 0.6).normalize();
  R.arm(0, s0.clone().addScaledVector(d, 0.53), { pole: V3(0.2, -1, -0.4), hand: handQ(d, V3(0, -1, 0), 1) });
  pointHand(R.hands[0]);
  // the other hand beckons forward, palm up
  const s1 = R.shPos(1);
  R.arm(1, s1.clone().add(V3(0.08, -0.3, 0.3)), { pole: V3(0.6, -1, -0.4), hand: handQ(V3(-0.2, 0.2, 1), V3(0, 1, 0), -1) });
  R.hands[1].pose(0.25, 0.4);
}

// ------------------------------------------------------------------ lying bodies
const _q = new THREE.Quaternion();
// Drop the rig so the lowest of the given torso meshes rests on the floor.
export function groundTorso(R, parts, eps = 0.005) {
  const m = Math.min(...parts.filter(Boolean).map((p) => R.lowestOf(p)));
  R.rig.position.y += eps - m; R.sync();
}
// Swing a joint (in its parent's frame) about the axis that carries its bone toward the floor,
// until the lowest point of the distal part (o.measure: the next joint down, so the cap at the
// pivot, which no swing can lift, never counts) sits at `target`. o.dir: the bone direction.
export function settleLimb(R, obj, o = {}) {
  const target = o.target ?? 0.012, meas = o.measure ?? obj, max = o.max ?? 1.2;
  const base = obj.quaternion.clone();
  obj.parent.getWorldQuaternion(_q).invert();
  const down = V3(0, -1, 0).applyQuaternion(_q);
  const dir = (o.dir ?? V3(0, -1, 0)).clone().applyQuaternion(base);
  const axis = V3().crossVectors(dir, down);
  if (axis.lengthSq() < 1e-6) return;
  axis.normalize();
  const rot = new THREE.Quaternion();
  const f = (t) => { obj.quaternion.copy(rot.setFromAxisAngle(axis, t)).multiply(base); return R.lowestOf(meas); };
  const f0 = f(0);
  let lo = null, hi = null;
  if (f0 > target) { lo = 0; for (let t = 0.04; t <= max; t += 0.04) { if (f(t) <= target) { hi = t; break; } lo = t; } if (hi === null) { f(lo); return; } }
  else {
    hi = 0;
    if (f(-0.04) <= f0 + 0.001) { f(0); return; } // swinging up does not lift it: leave it be
    for (let t = -0.04; t >= -max; t -= 0.04) { if (f(t) > target) { lo = t; break; } hi = t; }
    if (lo === null) { f(hi); return; }
  }
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (f(m) > target) lo = m; else hi = m; }
  f(hi);
}
// Skirt / coat panels out of the floor, swung whichever way clears it first (the upright hem
// clamp only swings one way, which is wrong face down).
export function clampPanels(R) {
  if (!R.coat) return;
  for (const pv of Object.values(R.coat)) {
    if (R.lowestOf(pv) >= -0.002) continue;
    const x0 = pv.rotation.x;
    let ok = false;
    for (let k = 1; k <= 30 && !ok; k++) for (const sg of [1, -1]) { pv.rotation.x = x0 + sg * k * 0.05; if (R.lowestOf(pv) >= -0.002) { ok = true; break; } }
    if (!ok) pv.rotation.x = x0;
  }
}
// Torso down, then the head (at the neck), arms (shoulder, then elbow) and legs (hip, then knee),
// then the coat panels re-follow the legs and are kept out of the floor.
export function settleBody(R, parts) {
  groundTorso(R, parts);
  settleLimb(R, R.neck, { dir: V3(0, 1, 0), measure: R.head, target: 0.01, max: 0.5 });
  for (const A of R.arms) { settleLimb(R, A.sh, { measure: A.el }); settleLimb(R, A.el, { measure: A.wrist, max: 0.6 }); }
  for (const L of R.legs) { settleLimb(R, L.hip, { measure: L.knee }); settleLimb(R, L.knee, { measure: L.ankle, max: 0.6 }); }
  R.noHemClamp = true; R.after?.(); R.noHemClamp = false;
  clampPanels(R);
  R.sync();
}
