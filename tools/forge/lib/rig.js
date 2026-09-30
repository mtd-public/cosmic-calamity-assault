// Rig toolkit: connected limbs and analytic IK. No game state.
//
// A "bone" is one mesh: a sphere at the joint, a tapered cylinder to the next
// joint, and a sphere there too. Because the joint spheres overlap whatever
// bends around them, a chain of bones reads as one continuous limb at any
// angle (the early-Xbox trick: Halo 1's Elites are exactly this, capsules on a
// skeleton). Every rig in the game (player arms, the player body, the Vyrr,
// the vehicle drivers) is built from these.
//
//   bone(len, r0, r1, mat)        → { joint, mesh, end }   joint at the top, `end` at (0,-len,0)
//   ik2(root, elbow, L1, L2, target, pole)   two-bone analytic IK in root.parent space
//   ikHand(root, elbow, hand, q)             point a hand (child of elbow.end) at a world-ish quaternion
//   makeHand(mats, scale, side)              palm + 4 curling fingers + thumb; hand.grip(k)
//   K(k, stops)                              keyframe interpolation with smoothstep
import * as THREE from 'three';
import { mergeGeometries } from './addons/BufferGeometryUtils.js';

const NEG_Y = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

const geoCache = new Map();
// A joint sphere (r0) + tapered shaft down to a joint sphere (r1) at -len, merged into one geometry.
export function boneGeo(len, r0, r1, seg = 8, caps = 3) {
  const key = `${len.toFixed(3)}|${r0.toFixed(3)}|${r1.toFixed(3)}|${seg}|${caps}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const parts = [];
  const shaft = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  shaft.translate(0, -len / 2, 0);
  parts.push(shaft.toNonIndexed());
  if (caps & 1) { const s0 = new THREE.SphereGeometry(r0, seg, Math.max(4, seg >> 1)); parts.push(s0.toNonIndexed()); }
  if (caps & 2) { const s1 = new THREE.SphereGeometry(r1, seg, Math.max(4, seg >> 1)); s1.translate(0, -len, 0); parts.push(s1.toNonIndexed()); }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  geoCache.set(key, g);
  return g;
}

export function joint(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

// Build a bone under `parent`. Returns { joint, mesh, end }: attach the next bone to `end`.
export function bone(parent, len, r0, r1, mat, o = {}) {
  const j = joint(o.x || 0, o.y || 0, o.z || 0);
  const m = new THREE.Mesh(boneGeo(len, r0, r1, o.seg || 8, o.caps ?? 3), mat);
  m.castShadow = true;
  j.add(m);
  const end = joint(0, -len, 0);
  j.add(end);
  parent.add(j);
  return { joint: j, mesh: m, end, len };
}

// Two-bone IK. root and elbow are joint Groups; elbow is a child of root's bone
// end (so it sits at (0,-L1,0) in root space). target and pole are Vector3s in
// root.parent's space: the target is where the end of the second bone should
// be, the pole is the direction the elbow bends toward. Bones point down -Y.
export function ik2(root, elbow, L1, L2, target, pole, stretch = 0.995) {
  const S = root.position;
  _a.subVectors(target, S);
  let dist = _a.length();
  const max = (L1 + L2) * stretch;
  if (dist < 1e-5) { _a.set(0, -1, 0); dist = 1e-5; }
  if (dist > max) dist = max;
  _a.normalize();
  // bend direction: the pole with its along-bone component removed
  _b.copy(pole).addScaledVector(_a, -pole.dot(_a));
  if (_b.lengthSq() < 1e-6) { _b.set(0, 0, -1).addScaledVector(_a, _a.z); if (_b.lengthSq() < 1e-6) _b.set(1, 0, 0); }
  _b.normalize();
  let cos1 = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
  cos1 = Math.max(-1, Math.min(1, cos1));
  const sin1 = Math.sqrt(1 - cos1 * cos1);
  // elbow position in parent space
  _c.copy(S).addScaledVector(_a, L1 * cos1).addScaledVector(_b, L1 * sin1);
  _d.subVectors(_c, S).normalize();
  root.quaternion.setFromUnitVectors(NEG_Y, _d);
  // forearm direction, expressed in root space
  _d.copy(S).addScaledVector(_a, dist).sub(_c).normalize();
  _q.copy(root.quaternion).invert();
  _d.applyQuaternion(_q);
  elbow.quaternion.setFromUnitVectors(NEG_Y, _d);
}

// Orient `hand` (a child of the elbow's end joint) so that its rotation in
// root.parent space equals q. Call after ik2.
export function ikHand(root, elbow, hand, q) {
  _q.copy(root.quaternion).multiply(elbow.quaternion).invert();
  hand.quaternion.copy(_q).multiply(q);
}

// Simple keyframe interpolation. stops: [[t, v], ...] where v is a number or an
// array; smoothstep between neighbours, clamped at the ends.
export function K(k, stops) {
  if (k <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) {
      const [t0, a] = stops[i - 1], [t1, b] = stops[i];
      let u = (k - t0) / (t1 - t0 || 1); u = u * u * (3 - 2 * u);
      if (Array.isArray(a)) return a.map((x, j) => x + (b[j] - x) * u);
      return a + (b - a) * u;
    }
  }
  return stops[stops.length - 1][1];
}
export const bump = (k) => Math.sin(Math.min(1, Math.max(0, k)) * Math.PI); // 0 → 1 → 0

// A hand: palm block, four two-segment fingers, a two-segment thumb.
// side = +1 right hand, -1 left. grip(k): 0 open, 1 closed fist.
// Built with the wrist at the origin, fingers pointing -Y (along the arm),
// palm facing -X for the right hand (so the gun grip sits in the palm).
export function makeHand(mats, s = 1, side = 1) {
  const h = new THREE.Group();
  const palmMat = mats.glove, skinMat = mats.skin || mats.glove;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.085 * s, 0.075 * s), palmMat);
  palm.position.set(0, -0.045 * s, 0); palm.castShadow = true; h.add(palm);
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.075 * s, 6), palmMat);
  knuckle.rotation.x = Math.PI / 2; knuckle.position.set(0, -0.085 * s, 0); h.add(knuckle);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * 0.019 * s;
    const f0 = bone(h, 0.032 * s, 0.009 * s, 0.008 * s, skinMat, { x: 0, y: -0.085 * s, z, seg: 6 });
    const f1 = bone(f0.end, 0.028 * s, 0.008 * s, 0.007 * s, skinMat, { seg: 6 });
    fingers.push({ a: f0.joint, b: f1.joint, i });
  }
  const t0 = bone(h, 0.03 * s, 0.011 * s, 0.009 * s, skinMat, { x: 0, y: -0.03 * s, z: side * 0.04 * s, seg: 6 });
  const t1 = bone(t0.end, 0.026 * s, 0.009 * s, 0.007 * s, skinMat, { seg: 6 });
  t0.joint.rotation.set(0, 0, 0); t0.joint.rotation.z = side * -0.4; t0.joint.rotation.x = side * 0.6;
  h.fingers = fingers; h.thumb = { a: t0.joint, b: t1.joint };
  h.side = side;
  // k: 0 open, 1 fist; spread lets the trigger finger differ (index = fingers[3] on the right)
  h.grip = (k, index = k) => {
    for (const f of fingers) {
      const kk = f.i === 3 ? index : k;
      // curl toward the palm side (-X for the right hand): rotate about the hand's Z
      f.a.rotation.set(0, (f.i - 1.5) * 0.06 * (1 - kk), -side * (0.25 + 1.2 * kk));
      f.b.rotation.set(0, 0, -side * (0.2 + 1.3 * kk));
    }
    t0.joint.rotation.set(-0.9 * side, 0, -side * (0.35 + 0.5 * k));
    t1.joint.rotation.set(0, 0, -side * (0.2 + 0.9 * k));
  };
  h.grip(0.6);
  return h;
}

// Get an Object3D's position and quaternion in `space`'s local frame.
export function localPose(obj, space, outPos, outQuat) {
  obj.getWorldPosition(outPos);
  space.worldToLocal(outPos);
  if (outQuat) { obj.getWorldQuaternion(outQuat); space.getWorldQuaternion(_q2).invert(); outQuat.premultiply(_q2); }
  return outPos;
}

// Smoothly drive a Vector3 / Quaternion toward a target (frame-rate independent).
export const ease = (cur, tgt, rate, dt) => cur.lerp(tgt, 1 - Math.exp(-rate * dt));
export const easeQ = (cur, tgt, rate, dt) => cur.slerp(tgt, 1 - Math.exp(-rate * dt));
