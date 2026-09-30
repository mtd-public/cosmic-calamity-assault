// Weapons held by characters, built in gun space: barrel along +Z, up +Y, the
// origin at the top of the pistol grip. Nodes (in gun space):
//   grip   where the right wrist goes, with the hand's orientation (quaternion)
//   fore   where the left wrist goes (support hand)
//   muzzle flash origin, pointing +Z
//   butt   stock butt (shouldering), when there is one
// placeGun(R, gun, pos, quat) puts the gun in rig space and IKs both hands onto it.
// gunInHand(R, gun, arm) attaches the gun to a posed hand instead.
import * as THREE from 'three';
import { handQ } from './biped.js';
import { mesh, mat, glow, rboxGeo, cyl, sph, profileGeo, ellipsoidGeo, loftGeo, V3 } from './core.js';
import { muzzleFlash } from './parts.js';

const node = (x, y, z, q) => { const o = new THREE.Object3D(); o.position.set(x, y, z); if (q) o.quaternion.copy(q); return o; };

export function pistol(o = {}) {
  const g = new THREE.Group();
  const blk = mat(o.color ?? 0x2a2c30, { rough: 0.35, metal: 0.6, env: true, envI: 0.6 });
  const grip = mat(0x121212, { rough: 0.8 });
  g.add(mesh(rboxGeo(0.03, 0.034, 0.2, 0.005), blk, 0, 0.026, 0.065));        // slide
  g.add(mesh(rboxGeo(0.027, 0.022, 0.15, 0.004), blk, 0, 0.0, 0.05));         // frame
  g.add(mesh(cyl(0.007, 0.007, 0.02, 8), blk, 0, 0.028, 0.17, Math.PI / 2, 0, 0)); // muzzle
  const gr = mesh(rboxGeo(0.03, 0.11, 0.046, 0.008), grip, 0, -0.05, -0.018, -0.28, 0, 0); g.add(gr);
  g.add(mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 10, Math.PI), blk, 0, -0.012, 0.035, 0, Math.PI / 2, Math.PI));
  g.nodes = {
    grip: node(-0.004, -0.028, -0.072, handQ(V3(0, -0.45, 1), V3(1, 0, 0.05), 1)),
    fore: node(0.035, -0.07, -0.03, handQ(V3(-0.6, 0.2, 1), V3(-0.8, 0.5, 0), -1)),
    muzzle: node(0, 0.028, 0.18),
  };
  for (const n of Object.values(g.nodes)) g.add(n);
  addFlash(g, 0.2);
  return g;
}

export function shotgun(o = {}) {
  const g = new THREE.Group();
  const blk = mat(0x2a2c30, { rough: 0.35, metal: 0.6, env: true, envI: 0.6 });
  const wood = mat(o.wood ?? 0x6a4226, { rough: 0.6 });
  g.add(mesh(rboxGeo(0.044, 0.068, 0.21, 0.008), blk, 0, 0.03, 0.06));               // receiver
  g.add(mesh(cyl(0.012, 0.012, 0.52, 10), blk, 0, 0.052, 0.42, Math.PI / 2, 0, 0));    // barrel
  g.add(mesh(cyl(0.013, 0.013, 0.44, 10), blk, 0, 0.022, 0.38, Math.PI / 2, 0, 0));    // magazine tube
  g.add(mesh(sph(0.006, 6, 4), mat(0xd0c8b0, { rough: 0.3, metal: 0.7 }), 0, 0.068, 0.675)); // bead
  const pump = new THREE.Group(); pump.position.set(0, 0.024, 0.34); g.add(pump); g.pump = pump;
  pump.add(mesh(rboxGeo(0.05, 0.048, 0.2, 0.014), wood, 0, 0, 0));
  for (let i = 0; i < 5; i++) pump.add(mesh(new THREE.BoxGeometry(0.052, 0.004, 0.006), mat(0x3e2616), 0, 0.0, -0.07 + i * 0.035));
  // stock with pistol-grip wrist and a butt pad
  g.add(mesh(profileGeo([[-0.04, 0.06], [-0.04, -0.005], [-0.1, -0.05], [-0.2, -0.07], [-0.4, -0.1], [-0.42, -0.1], [-0.42, 0.04], [-0.2, 0.052], [-0.06, 0.062]], 0.042, 0.008), wood));
  g.add(mesh(rboxGeo(0.046, 0.15, 0.022, 0.006), mat(0x111111, { rough: 0.9 }), 0, -0.025, -0.428));
  g.add(mesh(new THREE.TorusGeometry(0.022, 0.003, 4, 10, Math.PI), blk, 0, -0.006, 0.0, 0, Math.PI / 2, Math.PI));
  g.nodes = {
    grip: node(-0.006, -0.012, -0.1, handQ(V3(0, -0.4, 1), V3(1, 0, 0), 1)),
    fore: node(0.042, -0.035, 0.3, handQ(V3(-0.75, 0.45, 0.45), V3(-0.55, 1, 0), -1)),
    muzzle: node(0, 0.052, 0.69),
    butt: node(0, 0.0, -0.43),
  };
  for (const n of Object.values(g.nodes)) g.add(n);
  addFlash(g, 0.32);
  return g;
}

// The Hybrid's carbine: a curved bone body over a chrome spine, a teal cell in the side.
export function alienCarbine(o = {}) {
  const g = new THREE.Group();
  const bone = mat(0xd9ccb0, { rough: 0.55 });
  const boneD = mat(0xb3a283, { rough: 0.6 });
  const chrome = mat(0xd8e0e8, { rough: 0.15, metal: 1.0, env: true });
  const dark = mat(0x23232a, { rough: 0.4, metal: 0.4 });
  // main body: swept side profile (organic hump over the receiver, tapering to a snout)
  g.add(mesh(profileGeo([[-0.3, 0.02], [-0.26, -0.06], [-0.12, -0.03], [-0.02, 0.0], [0.12, 0.0], [0.3, 0.02], [0.44, 0.035], [0.46, 0.06], [0.36, 0.085], [0.18, 0.105], [0.02, 0.11], [-0.14, 0.095], [-0.26, 0.07]], 0.05, 0.012), bone));
  // chrome spine along the top and chrome bands
  g.add(mesh(rboxGeo(0.02, 0.018, 0.5, 0.006), chrome, 0, 0.112, 0.08));
  for (const z of [-0.12, 0.04, 0.2, 0.34]) g.add(mesh(new THREE.TorusGeometry(0.036, 0.006, 5, 12), chrome, 0, 0.055, z, 0, 0, 0).rotateY(0));
  // bone ribs along the underside
  for (let i = 0; i < 4; i++) g.add(mesh(ellipsoidGeo(0.03, 0.012, 0.018, 8, 5), boneD, 0, -0.004 - i * 0.002, 0.14 + i * 0.07));
  // emitter prongs
  for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.01, 0.09, 6), chrome, s * 0.022, 0.05, 0.5, Math.PI / 2, 0, 0));
  g.add(mesh(cyl(0.016, 0.016, 0.03, 10), glow(0x3ff0d0, 1), 0, 0.05, 0.465, Math.PI / 2, 0, 0));
  // the energy cell: a glowing teal capsule set into the left side
  const cell = new THREE.Group(); cell.position.set(0.028, 0.06, 0.02); g.add(cell);
  cell.add(mesh(cyl(0.02, 0.02, 0.11, 10), glow(0x35e8c8, 1), 0, 0, 0, Math.PI / 2, 0, 0));
  cell.add(mesh(new THREE.TorusGeometry(0.022, 0.005, 5, 10), chrome, 0, 0, -0.055));
  cell.add(mesh(new THREE.TorusGeometry(0.022, 0.005, 5, 10), chrome, 0, 0, 0.055));
  const cell2 = mesh(cyl(0.012, 0.012, 0.1, 8), glow(0x35e8c8, 1), -0.027, 0.06, 0.02, Math.PI / 2, 0, 0); g.add(cell2);
  // grip: a bone hook
  g.add(mesh(rboxGeo(0.034, 0.11, 0.045, 0.012), boneD, 0, -0.05, -0.03, -0.3, 0, 0));
  g.add(mesh(rboxGeo(0.03, 0.02, 0.06, 0.006), dark, 0, -0.01, 0.03));
  g.nodes = {
    grip: node(-0.006, -0.025, -0.088, handQ(V3(0, -0.45, 1), V3(1, 0, 0), 1)),
    fore: node(0.045, -0.02, 0.24, handQ(V3(-0.75, 0.45, 0.45), V3(-0.55, 1, 0), -1)),
    muzzle: node(0, 0.05, 0.5),
    butt: node(0, 0.02, -0.3),
  };
  for (const n of Object.values(g.nodes)) g.add(n);
  addFlash(g, 0.3, 'plasma');
  return g;
}

function addFlash(g, L, kind) {
  const f = kind === 'plasma' ? plasmaFlash(L) : muzzleFlash(L);
  f.position.copy(g.nodes.muzzle.position);
  f.visible = false;
  g.add(f); g.flash = f;
}
export function plasmaFlash(L = 0.3) {
  const g = new THREE.Group();
  g.add(mesh(sph(L * 0.3, 12, 8), glow(0xffffff, 1), 0, 0, L * 0.15));
  const halo = new THREE.MeshBasicMaterial({ color: 0x60ffe0, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
  g.add(mesh(sph(L * 0.5, 12, 8), halo, 0, 0, L * 0.2));
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(L * 0.12, L * 0.9, 5), glow(0x7affe6, 1), 0, 0, L * 0.45, Math.PI / 2, 0, 0); c.rotation.z = i; g.add(c); }
  return g;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
// Node pose in rig space.
export function nodeRig(R, gun, name) {
  R.sync();
  const n = gun.nodes[name];
  const p = n.getWorldPosition(new THREE.Vector3());
  R.rig.worldToLocal(p);
  const q = n.getWorldQuaternion(new THREE.Quaternion());
  R.rig.getWorldQuaternion(_q);
  q.premultiply(_q.invert());
  return { p, q };
}
// Put the gun (a child of R.rig) at pos/quat in rig space and IK the hands onto it.
export function placeGun(R, gun, pos, quat, o = {}) {
  if (gun.parent !== R.rig) R.rig.add(gun);
  gun.position.copy(pos); gun.quaternion.copy(quat);
  const g = nodeRig(R, gun, 'grip');
  R.arm(0, g.p, { hand: g.q, pole: o.pole0 ?? V3(0.2, -0.5, -1) });
  if (o.twoHand !== false) {
    const f = nodeRig(R, gun, 'fore');
    R.arm(1, f.p, { hand: f.q, pole: o.pole1 ?? V3(0.8, -0.6, -0.3) });
  }
}
// Attach the gun so its grip node matches arm i's wrist (arm already posed).
export function gunInHand(R, gun, i = 0) {
  if (gun.parent !== R.rig) R.rig.add(gun);
  R.sync();
  const w = R.arms[i].wrist;
  const wp = w.getWorldPosition(new THREE.Vector3()); R.rig.worldToLocal(wp);
  const wq = w.getWorldQuaternion(new THREE.Quaternion()); R.rig.getWorldQuaternion(_q); wq.premultiply(_q.clone().invert());
  // gun = wrist * inverse(gripLocal)
  const gl = gun.nodes.grip;
  const inv = new THREE.Matrix4().compose(gl.position, gl.quaternion, new THREE.Vector3(1, 1, 1)).invert();
  const m = new THREE.Matrix4().compose(wp, wq, new THREE.Vector3(1, 1, 1)).multiply(inv);
  m.decompose(gun.position, gun.quaternion, _s);
}
// A rig-space quaternion aiming the gun's +Z along dir, with up roughly +Y (roll radians about the barrel).
export function aimQ(dir, roll = 0) {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return q;
}
