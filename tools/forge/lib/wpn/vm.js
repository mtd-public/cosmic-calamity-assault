// Viewmodel assembly: a gun and the agent's two arms in camera space.
// Poses are plain objects so frames read as data:
//   { gun: { p:[x,y,z], r:[rx,ry,rz] }, state: {...gun.set args},
//     R: { at: 'R' | Object3D | { p, q }, grip: 'pistol' | {curl, thumb}, bend },
//     L: { ... } | null (hidden), props: { name: { p, r, vis } } }
import { THREE, V3 } from './core.js';
import { makeArm, GRIPS, mixGrip, Q } from './arm.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class Viewmodel {
  constructor({ gun = null, right = true, left = true, armOpts = {} } = {}) {
    this.root = new THREE.Group();
    this.gunHolder = new THREE.Group(); this.root.add(this.gunHolder);
    this.gun = gun; if (gun) this.gunHolder.add(gun.root);
    this.R = right ? makeArm(1, armOpts.R || {}) : null;
    this.L = left ? makeArm(-1, armOpts.L || {}) : null;
    if (this.R) this.root.add(this.R.root);
    if (this.L) this.root.add(this.L.root);
    this.props = {};
  }
  addProp(name, obj, parent = this.root) { this.props[name] = obj; parent.add(obj); return obj; }
  // world transform of an Object3D → { p, q } in root space
  poseOf(obj, offset = null) {
    this.root.updateMatrixWorld(true);
    _m.copy(this.root.matrixWorld).invert().multiply(obj.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    _m.decompose(p, q, s);
    if (offset) {
      if (offset.p) p.add(V3(...offset.p).applyQuaternion(q));
      if (offset.q) q.multiply(offset.q);
    }
    return { p, q };
  }
  resolve(at, off) {
    if (!at) return null;
    if (at.mix) { // blend two placements: { mix: [a, b, t], lift }
      const A = this.resolve(at.mix[0]), B = this.resolve(at.mix[1]), t = at.mix[2];
      const p = A.p.clone().lerp(B.p, t); p.y += Math.sin(t * Math.PI) * (at.lift ?? 0);
      const q = A.q.clone().slerp(B.q, t);
      if (off?.p) p.add(V3(...off.p).applyQuaternion(q));
      if (off?.q) q.multiply(off.q);
      return { p, q };
    }
    if (at.prop) return this.poseOf(at.anchor ? this.props[at.prop].userData.anchors[at.anchor] : this.props[at.prop], at.off || off);
    if (at.cam) { // camera-space placement with a local offset/rotation from another anchor
      const r = this.resolve(at.cam);
      return { p: r.p.add(V3(...(at.dp || [0, 0, 0]))), q: at.dr ? r.q.multiply(Q(...at.dr)) : r.q };
    }
    if (typeof at === 'string') return this.poseOf(this.gun.anchors[at], off);
    if (at.isObject3D) return this.poseOf(at, off);
    // explicit: { p, r } (Euler YXZ) or { p, q }
    const p = V3(...at.p), q = at.q ? at.q.clone() : Q(...(at.r || [0, 0, 0]));
    return { p, q };
  }
  pose(P) {
    const g = P.gun || {};
    this.gunHolder.position.set(...(g.p || [0, 0, -0.4]));
    this.gunHolder.rotation.set(...(g.r || [0, 0, 0]), 'YXZ');
    this.gunHolder.visible = g.visible ?? true;
    if (this.gun?.set) this.gun.set(P.state || {});
    // props: hidden unless listed in the pose (hand-attached props are placed after the arms)
    for (const [k, o] of Object.entries(this.props)) {
      const v = (P.props || {})[k];
      if (!v) { o.visible = false; continue; }
      if (v.hand) continue;
      o.visible = v.vis ?? true;
      this.root.updateMatrixWorld(true);
      if (v.at) { const r = this.resolve(v.at, v.off); if (o.parent !== this.root) this.root.add(o); o.position.copy(r.p); o.quaternion.copy(r.q); }
      else if (v.gun) { if (o.parent !== this.gun.root) this.gun.root.add(o); o.position.set(...(v.p || [0, 0, 0])); o.rotation.set(...(v.r || [0, 0, 0]), 'YXZ'); }
      else { if (o.parent !== this.root) this.root.add(o); if (v.p) o.position.set(...v.p); if (v.r) o.rotation.set(...v.r, 'YXZ'); }
      if (v.s) o.scale.setScalar(v.s);
      if (v.set) v.set(o);
    }
    for (const side of ['R', 'L']) {
      const arm = this[side]; if (!arm) continue;
      const a = P[side];
      if (!a) { arm.show(false); continue; }
      arm.show(true);
      this.root.updateMatrixWorld(true);
      const r = this.resolve(a.at, a.off);
      const grip = typeof a.grip === 'string' ? GRIPS[a.grip] : a.grip ? (a.grip.mix ? mixGrip(a.grip.mix[0], a.grip.mix[1], a.grip.mix[2]) : a.grip) : GRIPS.relaxed;
      arm.hand.pose(grip);
      arm.place(r.p, r.q, { bend: a.bend || [0, 0], shoulder: a.shoulder || null, roll: a.roll || 0, elbow: a.elbow || null, twist: a.twist || 0 });
    }
    this.root.updateMatrixWorld(true);
    for (const [k, v] of Object.entries(P.props || {})) {
      if (!v.hand) continue;
      const o = this.props[k], h = v.fore ? this[v.hand].fore : this[v.hand].hand.root;
      o.visible = v.vis ?? true;
      if (o.parent !== this.root) this.root.add(o);
      const q = Q(...(v.r || [0, 0, 0]), v.order || 'XYZ');
      o.position.copy(V3(...(v.p || [0, 0, 0])).applyQuaternion(h.quaternion).add(h.position));
      o.quaternion.copy(h.quaternion).multiply(q);
      if (v.set) v.set(o);
    }
    this.root.updateMatrixWorld(true);
  }
}
export { Q, GRIPS };
// Quaternion from the hand's axes expressed in the target frame (columns X, Y, Z).
export function basisQ(X, Y, Z) { return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(...X), V3(...Y), V3(...Z))); }
// A wrist anchor for a fist wrapped around a bar (handle, flashlight barrel,
// grenade body). at: where the bar passes through the fist (parent space);
// axis: the direction the thumb side points along the bar; back: roughly where
// the back of the hand faces. tunnel: the fist's bar centre in hand space
// (calibrated for a ~4 cm bar with the 'torch' grip).
export function fistAnchor(parent, { at = [0, 0, 0], axis = [0, 0, -1], back = [0, -1, 0], side = 1, tunnel = [0, -0.0295, -0.0915] } = {}) {
  const X = V3(...axis).normalize().multiplyScalar(-side);
  const Y = V3(...back); Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const R = new THREE.Matrix4().makeBasis(X, Y, Z);
  const c = V3(...tunnel).applyMatrix4(R);
  const a = new THREE.Group(); a.position.set(at[0] - c.x, at[1] - c.y, at[2] - c.z);
  a.quaternion.setFromRotationMatrix(R);
  parent.add(a); return a;
}

// Hand orientation from a pointing direction (the fingers / a forearm blade
// along dir) and a hint for where the back of the hand faces.
export function aimQ(dir, backHint = [0, 1, 0]) {
  const Zm = V3(...dir).normalize().negate(); // hand +Z points back along the arm
  const Y = V3(...backHint); Y.addScaledVector(Zm, -Y.dot(Zm)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Zm);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Zm));
}
