// Biped skeleton for sprite characters, posed per frame in "rig space" (the
// character's own frame: feet at the origin, forward +Z, up +Y, its right side
// -X). spriteSet owns root.rotation.y, so every pose writes only `rig` and below.
//
//   R = makeBiped(spec)       joints: rig → pelvis → spine → chest → neck → head,
//                             legs[0/1] (right/left: hip, knee, ankle), arms[0/1] (sh, el, wrist)
//   R.reset()                 rest pose
//   R.leg(i, o)               plant/lift a foot by IK: { x, z, y?, lift, pitch, yaw, pole }
//   R.arm(i, target, o)       reach a wrist target (rig space) by IK: { pole, hand: quaternion | null }
//   R.gait(ph, o)             walk/run cycle: 4 frames = ph 0, π/2, π, 3π/2 (contact, passing, contact, passing)
//   R.ground(eps)             drop/raise the rig so its lowest vertex touches the floor
//   handQ(fingerDir, palmDir, side)   rig-space hand orientation from where fingers point and palm faces
import * as THREE from 'three';
import { ik2 } from '../rig.js';
import { limb, joint, V3, clamp } from './core.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _e = new THREE.Euler();

export function handQ(finger, palm, side) {
  const y = V3().copy(finger).normalize().multiplyScalar(-1);
  const x = V3().copy(palm).addScaledVector(y, -palm.dot(y)).normalize().multiplyScalar(side);
  const z = V3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
}
export const eulerQ = (x, y, z, order = 'XYZ') => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, order));

// Foot pitch through a step cycle (q in [0, 2π)): heel strike, flat, toe-off, swing.
const PITCH = [[0, -0.28], [0.22, 0], [0.4, 0.06], [0.5, 0.5], [0.6, 0.55], [0.72, 0.2], [0.9, -0.2], [1, -0.28]];
function kInterp(k, stops) {
  if (k <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) {
    const [t0, a] = stops[i - 1], [t1, b] = stops[i];
    let u = (k - t0) / (t1 - t0 || 1); u = u * u * (3 - 2 * u);
    return a + (b - a) * u;
  }
  return stops[stops.length - 1][1];
}

export function makeBiped(S) {
  const root = new THREE.Group();
  const rig = joint(); rig.rotation.order = 'YXZ'; root.add(rig);
  const pelvis = joint(0, S.hipY, 0); rig.add(pelvis);
  const spine = joint(0, S.waistY, S.waistZ || 0); pelvis.add(spine);
  const chest = joint(0, S.chestY, S.chestZ || 0); spine.add(chest);
  const neck = joint(0, S.neckY, S.neckZ || 0); chest.add(neck);
  const head = joint(0, S.neckLen, S.headZ || 0); neck.add(head);
  const M = S.mats;
  const legs = [], arms = [];
  for (const side of [1, -1]) {
    const x = -side * S.hipX;
    const th = limb(pelvis, S.thigh[0], S.thigh[1], S.thigh[2], M.thigh, { x, y: S.hipDY || 0, rm: S.thigh[3], tm: 0.3, sx: S.thighSX, seg: S.seg || 10 });
    const sh = limb(th.end, S.shin[0], S.shin[1], S.shin[2], M.shin || M.thigh, { rm: S.shin[3], tm: 0.28, seg: S.seg || 10 });
    const ankle = joint(); sh.end.add(ankle);
    legs.push({ i: legs.length, side, hip: th.joint, knee: sh.joint, ankle, thigh: th, shin: sh, L1: S.thigh[0], L2: S.shin[0], hx: x });
  }
  for (const side of [1, -1]) {
    const x = -side * S.shX;
    const up = limb(chest, S.upper[0], S.upper[1], S.upper[2], M.upper, { x, y: S.shY, z: S.shZ || 0, rm: S.upper[3], tm: 0.35, seg: S.seg || 10 });
    const fo = limb(up.end, S.fore[0], S.fore[1], S.fore[2], M.fore || M.upper, { rm: S.fore[3], tm: 0.3, sx: S.foreSX, seg: S.seg || 10 });
    const wrist = joint(); fo.end.add(wrist);
    arms.push({ i: arms.length, side, sh: up.joint, el: fo.joint, wrist, upper: up, fore: fo, L1: S.upper[0], L2: S.fore[0], sx: x });
  }
  const R = { root, rig, pelvis, spine, chest, neck, head, legs, arms, S };
  const foot = S.foot || { h: 0.07, heel: 0.05, toe: 0.17 };

  R.sync = () => root.updateMatrixWorld(true);
  // rig-space point → obj-local
  R.toLocal = (obj, p) => { R.sync(); return obj.worldToLocal(_v.copy(p).applyMatrix4(rig.matrixWorld)).clone(); };
  R.toRig = (obj, p = V3()) => { R.sync(); return rig.worldToLocal(obj.localToWorld(p.clone())); };
  R.dirToLocal = (obj, d) => {
    R.sync();
    rig.getWorldQuaternion(_q); obj.getWorldQuaternion(_q2);
    return d.clone().applyQuaternion(_q).applyQuaternion(_q2.invert());
  };
  // make obj's orientation in rig space equal q
  R.setRigQuat = (obj, q) => {
    R.sync();
    obj.parent.getWorldQuaternion(_q); rig.getWorldQuaternion(_q2);
    obj.quaternion.copy(_q.invert().multiply(_q2).multiply(q));
  };
  R.ankleH = (pitch) => {
    const c = Math.cos(pitch), s = Math.sin(pitch);
    return Math.max(foot.h * c - foot.heel * s, foot.h * c + foot.toe * s);
  };
  R.reset = () => {
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    pelvis.position.set(0, S.hipY, 0); pelvis.rotation.set(0, 0, 0);
    spine.rotation.set(0, 0, 0); chest.rotation.set(0, 0, 0);
    neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
    for (const L of legs) { L.hip.quaternion.identity(); L.knee.quaternion.identity(); L.ankle.quaternion.identity(); }
    for (const A of arms) { A.sh.quaternion.identity(); A.el.quaternion.identity(); A.wrist.quaternion.identity(); }
    R.onReset?.();
  };
  // hip joint position in rig space
  R.hipPos = (i) => R.toRig(legs[i].hip);
  R.shPos = (i) => R.toRig(arms[i].sh);

  // o: { x, z, y (ankle height; default from pitch), lift, pitch, yaw, roll, pole (rig dir) }
  R.leg = (i, o = {}) => {
    const L = legs[i];
    const pitch = o.pitch ?? 0;
    const hp = R.hipPos(i);
    const x = o.x ?? hp.x, z = o.z ?? 0;
    const y = (o.y ?? R.ankleH(pitch)) + (o.lift ?? 0);
    const t = R.toLocal(pelvis, V3(x, y, z));
    // hip.position is in pelvis space; ik2 wants target in hip.parent (= pelvis) space
    const pole = R.dirToLocal(pelvis, o.pole ?? V3(-L.side * 0.12, 0, 1));
    ik2(L.hip, L.knee, L.L1, L.L2, t, pole, o.stretch ?? 0.999);
    R.setRigQuat(L.ankle, eulerQ(pitch, o.yaw ?? 0, o.roll ?? 0, 'YXZ'));
  };
  // raw: wrist target (rig space); o.hand: rig-space quaternion for the hand
  R.arm = (i, target, o = {}) => {
    const A = arms[i];
    const t = R.toLocal(chest, target);
    const pole = R.dirToLocal(chest, o.pole ?? V3(-A.side * 0.4, -0.2, -1));
    ik2(A.sh, A.el, A.L1, A.L2, t, pole, o.stretch ?? 0.999);
    if (o.hand) R.setRigQuat(A.wrist, o.hand);
    else A.wrist.quaternion.identity();
  };
  // Arm hanging and swinging by `swing` radians (forward +), elbow bent `bend` (0..1).
  R.armHang = (i, swing = 0, o = {}) => {
    const A = arms[i];
    const s = R.shPos(i);
    const reach = (A.L1 + A.L2) * (o.reach ?? 0.96);
    const out = o.out ?? 0.12;
    const d = V3(-A.side * Math.sin(out), -Math.cos(swing) * Math.cos(out), Math.sin(swing)).normalize();
    R.arm(i, s.clone().addScaledVector(d, reach), { pole: o.pole ?? V3(-A.side * 0.3, 0, -1), hand: o.hand });
  };

  // Walk / run cycle. o: stride, lift, bob, width, lean, twist, sway, armSwing, armBend, crouch, zOff
  R.gait = (ph, o = {}) => {
    const stride = o.stride ?? 0.55, liftH = o.lift ?? 0.12, bob = o.bob ?? 0.03;
    const width = o.width ?? 0;
    pelvis.rotation.set(o.pelvisPitch ?? 0, (o.twist ?? 0.12) * Math.cos(ph), (o.sway ?? 0.04) * Math.sin(ph));
    spine.rotation.set((o.lean ?? 0.05) * 0.6, -(o.twist ?? 0.12) * Math.cos(ph) * 0.6, -(o.sway ?? 0.04) * Math.sin(ph) * 0.6);
    chest.rotation.set((o.lean ?? 0.05) * 0.4, -(o.twist ?? 0.12) * Math.cos(ph) * 0.8, 0);
    const feet = [];
    for (const L of legs) {
      const q = ((ph + (L.i === 0 ? 0 : Math.PI)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const z = Math.cos(q) * stride / 2 + (o.zOff ?? 0);
      const swing = Math.sin(q) < 0;
      const lift = swing ? -Math.sin(q) * liftH : 0;
      const pitch = kInterp(q / (2 * Math.PI), o.pitchStops || PITCH) * (o.pitchK ?? 1) + (o.pitchAdd ?? 0);
      feet.push({ L, z, lift, pitch, swing, x: L.hx * (1 + width) });
    }
    // pelvis height: as high as the stance feet allow (planted feet never float)
    let py = S.hipY + bob * Math.abs(Math.sin(ph)) - bob - (o.crouch ?? 0);
    for (const f of feet) {
      if (f.swing) continue;
      const ay = R.ankleH(f.pitch);
      const reach = (f.L.L1 + f.L.L2) * 0.985;
      const dz = f.z - (o.hipZ ?? 0), dx = 0.0;
      const maxY = ay + Math.sqrt(Math.max(0, reach * reach - dz * dz - dx * dx)) - (S.hipDY || 0);
      py = Math.min(py, maxY);
    }
    pelvis.position.set(0, py, o.hipZ ?? 0);
    for (const f of feet) R.leg(f.L.i, { x: f.x, z: f.z, lift: f.lift, pitch: f.pitch });
    if (o.arms !== false) {
      const sw = o.armSwing ?? 0.35;
      for (const A of arms) {
        const s = A.i === 0 ? -Math.cos(ph) : Math.cos(ph);
        R.armHang(A.i, s * sw + (o.armFwd ?? 0), { reach: o.armReach ?? 0.94, out: o.armOut ?? 0.1 });
      }
    }
    return feet;
  };

  // Bring the lowest point of the model to y = eps (for lying / kneeling poses).
  const _box = new THREE.Box3();
  R.lowest = () => {
    R.sync();
    let min = Infinity;
    rig.traverseVisible((o) => {
      if (!o.isMesh || o.userData.noGround) return;
      const p = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(p.count / 400));
      for (let k = 0; k < p.count; k += step) {
        _v2.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld);
        root.worldToLocal(_v2);
        if (_v2.y < min) { min = _v2.y; R._low = o; }
      }
    });
    return min;
  };
  R.lowestOf = (obj) => {
    R.sync();
    let min = Infinity;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        _v2.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld);
        root.worldToLocal(_v2);
        if (_v2.y < min) min = _v2.y;
      }
    });
    return min;
  };
  R.ground = (eps = 0.005) => { const m = R.lowest(); rig.position.y += eps - m; R.sync(); };
  R.reset();
  return R;
}

// Standing idle: feet planted a little apart, knees soft.
export function stand(R, o = {}) {
  const S = R.S;
  R.pelvis.position.set(0, S.hipY - (o.crouch ?? 0.01), o.hipZ ?? 0);
  for (const L of R.legs) R.leg(L.i, { x: L.hx * (o.wide ?? 1.3) + (o.dx?.[L.i] ?? 0), z: (o.dz?.[L.i] ?? 0), pitch: 0, yaw: -L.side * 0.12 });
}
