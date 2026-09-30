// Pose library for armed humanoids (Thralls, Guard ally, Hybrid, Trooper) and
// shared death / gib sequences. All poses write rig space only.
import * as THREE from 'three';
import { handQ, stand, eulerQ } from './biped.js';
import { placeGun, gunInHand, aimQ, nodeRig } from './guns.js';
import { mesh, mat, glow, V3, mulberry32, ellipsoidGeo } from './core.js';
import { rockGeo } from '../gb.js';
import { pool } from './parts.js';

export const headTurn = (R, pitch, yaw, roll) => {
  R.neck.rotation.set(pitch * 0.45, yaw * 0.5, roll * 0.5);
  R.head.rotation.set(pitch * 0.55, yaw * 0.5, roll * 0.5);
};

// ------------------------------------------------------------------ walking
// style: 'shamble' (possessed), 'patrol' (alive soldier), 'stalk' (hybrid)
// carry: 'pistolLow' (hanging in the right hand), 'pistolReady' (two hands, low),
//        'longLow' (long gun at low ready across the body), 'longPort' (diagonal across the chest)
export function walk(R, gun, k, o = {}) {
  const ph = k * Math.PI / 2;
  const sh = o.style === 'shamble';
  R.gait(ph, {
    stride: o.stride ?? (sh ? 0.5 : 0.62), lift: o.lift ?? (sh ? 0.08 : 0.11), bob: o.bob ?? (sh ? 0.035 : 0.03),
    lean: o.lean ?? (sh ? 0.22 : 0.08), twist: sh ? 0.06 : 0.1, sway: sh ? 0.07 : 0.035, arms: false,
    pitchK: sh ? 0.7 : 1,
  });
  if (sh) {
    // the possessed lurch: one shoulder low, the head hung at a wrong angle, twitching per frame
    R.chest.rotation.x += 0.2; R.chest.rotation.z += 0.1; R.spine.rotation.x += 0.05;
    const J = o.jitter ?? [[0.15, 0.12, -0.38], [0.25, -0.05, -0.3], [0.1, 0.18, -0.45], [0.3, 0.02, -0.28]];
    const [p, y, r] = J[k];
    headTurn(R, p - 0.3, y, r);
  } else {
    const J = [[0.02, 0.1, 0], [0.0, 0.05, 0], [0.02, -0.08, 0], [0.0, -0.04, 0]];
    headTurn(R, -0.05 + J[k][0], J[k][1], J[k][2]);
  }
  const sw = Math.cos(ph);
  carry(R, gun, o.carry, { swing: sw, k, style: o.style });
}

export function carry(R, gun, kind, o = {}) {
  const sw = o.swing ?? 0;
  if (kind === 'pistolLow') {
    const s0 = R.shPos(0);
    R.arm(0, s0.clone().add(V3(0.02, -0.5, 0.1 - sw * 0.05)), { hand: handQ(V3(0.05, -1, 0.45), V3(1, 0.1, 0), 1), pole: V3(-0.3, 0, -1) });
    R.hands[0].pose(0.95, 0);
    gunInHand(R, gun, 0);
    R.armHang(1, sw * 0.3 * (o.style === 'shamble' ? 0.5 : 1), { reach: 0.95, out: 0.08 });
    R.hands[1].pose(o.style === 'shamble' ? 0.55 : 0.4, 0.1);
  } else if (kind === 'pistolReady') {
    const s0 = R.shPos(0);
    const p = s0.clone().add(V3(0.14, -0.32, 0.3));
    placeGun(R, gun, p, aimQ(V3(0, -0.55, 1)), {});
    R.hands[0].pose(0.95, 0); R.hands[1].pose(0.85, 0);
  } else if (kind === 'longLow' || kind === 'longPort') {
    const c = R.toRig(R.chest, V3(0, 0, 0));
    const port = kind === 'longPort';
    const p = c.clone().add(port ? V3(-0.12, -0.02, 0.2) : V3(-0.14, -0.1, 0.18));
    const dir = port ? V3(0.55, 0.35, 0.75) : V3(0.25, -0.45, 1);
    placeGun(R, gun, p.add(V3(0, 0.01 * sw, 0)), aimQ(dir, port ? -0.3 : 0), {});
    R.hands[0].pose(0.95, 0); R.hands[1].pose(0.85, 0);
  }
}

// ------------------------------------------------------------------ aiming / firing
// kind: 'pistol1' (one hand, canted: the Thrall), 'pistol2' (two-hand isosceles), 'long' (shouldered)
export function aim(R, gun, kind, o = {}) {
  const fire = !!o.fire;
  const kick = fire ? 1 : 0;
  if (kind === 'long') {
    stand(R, { dz: [-0.16, 0.14], wide: 1.5, crouch: 0.03 });
    R.pelvis.rotation.set(0, 0.35, 0);
    R.spine.rotation.set(0.04 - kick * 0.05, 0.15, 0);
    R.chest.rotation.set(0.02 - kick * 0.06, 0.12, 0.02);
    headTurn(R, 0.12, -0.45, 0.12);
    R.sync();
    // the stock in the right shoulder pocket, the barrel level
    const shp = R.shPos(0);
    const dir = V3(0, 0.02 + kick * 0.12, 1).normalize();
    const q = aimQ(dir, o.roll ?? 0);
    const butt = gun.nodes.butt.position.clone();
    const pos = shp.clone().add(V3(0.07, -0.05, 0.08 - kick * 0.05)).sub(butt.applyQuaternion(q));
    placeGun(R, gun, pos, q, { pole0: V3(-0.6, -1, -0.3), pole1: V3(0.5, -1, 0) });
  } else if (kind === 'pistol2') {
    stand(R, { dz: [-0.08, 0.1], wide: 1.45, crouch: 0.03 });
    R.spine.rotation.set(0.05 - kick * 0.04, 0.04, 0); R.chest.rotation.set(0.03, 0.03, 0);
    headTurn(R, 0.08, -0.05, 0.05);
    const c = R.toRig(R.chest, V3(0, 0.17, 0));
    const pos = c.clone().add(V3(0.0, -0.03 + kick * 0.03, 0.5));
    placeGun(R, gun, pos, aimQ(V3(0, kick * 0.25, 1)), { pole0: V3(-0.8, -1, -0.2), pole1: V3(0.8, -1, -0.2) });
  } else { // pistol1: the arm straight out, the gun canted, the body turned side-on
    stand(R, { dz: [0.06, -0.08], wide: 1.4, crouch: 0.02 });
    R.pelvis.rotation.set(0, -0.2, 0);
    R.spine.rotation.set(0.08, -0.2, 0.04); R.chest.rotation.set(0.1, -0.15, 0.12);
    headTurn(R, 0.1 + (o.headP ?? 0), 0.25, o.headRoll ?? -0.4);
    const s0 = R.shPos(0);
    const pos = s0.clone().add(V3(0.1, -0.03 + kick * 0.06, 0.5 - kick * 0.03));
    placeGun(R, gun, pos, aimQ(V3(0.05, kick * 0.3, 1), o.cant ?? -0.6), { twoHand: false, pole0: V3(-0.5, -1, 0) });
    R.armHang(1, 0.1, { reach: 0.95, out: 0.1 });
    R.hands[1].pose(0.6, 0.2);
  }
  R.hands[0].pose(0.95, 0, 0.9);
  if (kind !== 'pistol1') R.hands[1].pose(0.85, 0);
  gun.flash.visible = fire;
  if (fire) gun.flash.rotation.z = (o.flashRot ?? 0.4);
}

// ------------------------------------------------------------------ pain
export function pain(R, gun, kind) {
  stand(R, { dz: [-0.1, 0.06], wide: 1.4, crouch: 0.06 });
  R.leg(1, { x: R.legs[1].hx * 1.5, z: 0.12, lift: 0.1, pitch: 0.4 });
  R.pelvis.position.z -= 0.04;
  R.pelvis.rotation.set(-0.12, 0.2, -0.08);
  R.spine.rotation.set(-0.22, 0.15, -0.06); R.chest.rotation.set(-0.15, 0.2, -0.1);
  headTurn(R, -0.5, -0.35, 0.35);
  const s0 = R.shPos(0), s1 = R.shPos(1);
  if (kind === 'long') {
    const c = R.toRig(R.chest, V3(0, 0, 0));
    placeGun(R, gun, c.add(V3(-0.1, -0.1, 0.3)), aimQ(V3(0.4, 0.6, 0.7)), {});
  } else {
    R.arm(0, s0.clone().add(V3(-0.28, 0.02, 0.18)), { hand: handQ(V3(-0.5, 0.4, 0.7), V3(0.3, 1, 0), 1), pole: V3(0, -1, -0.5) });
    gunInHand(R, gun, 0);
    R.arm(1, s1.clone().add(V3(0.28, -0.12, 0.25)), { pole: V3(0, -1, -0.5) });
    R.hands[1].pose(0.1, 0.9);
  }
  R.hands[0].pose(0.95, 0);
  gun.flash.visible = false;
}

// ------------------------------------------------------------------ death: 5 frames, falling backwards to a corpse
// o: { yaw (display), shift [x per frame], gun, dropAt: rig-space pos for the dropped gun, pool }
export function death(R, k, o = {}) {
  if (o.forward) return deathForward(R, k, o);
  const { rig, pelvis, spine, chest, legs, arms, hands } = R;
  rig.rotation.y = o.yaw ?? 1.15;
  const gun = o.gun;
  if (k === 0) {
    stand(R, { dz: [-0.05, 0.05], wide: 1.3 });
    R.leg(0, { x: legs[0].hx * 1.3, z: 0.14, lift: 0.08, pitch: -0.2 });
    pelvis.position.z -= 0.06; pelvis.position.y += 0.01;
    pelvis.rotation.set(-0.15, 0, 0);
    spine.rotation.set(-0.25, 0.05, 0.05); chest.rotation.set(-0.2, 0, 0);
    headTurn(R, -0.6, 0.2, 0.15);
    const s0 = R.shPos(0), s1 = R.shPos(1);
    R.arm(0, s0.clone().add(V3(-0.2, 0.18, 0.36)), { pole: V3(0, -1, 0) });
    R.arm(1, s1.clone().add(V3(0.22, 0.12, 0.38)), { pole: V3(0, -1, 0) });
    hands[0].pose(0.2, 0.8); hands[1].pose(0.2, 0.8);
    if (gun) { gunInHand(R, gun, 0); }
  } else if (k === 1) {
    pelvis.position.set(0, R.S.hipY * 0.6, -0.06);
    pelvis.rotation.set(0.1, 0.1, 0.06);
    R.leg(0, { x: legs[0].hx * 1.4, z: -0.3, y: 0.04, pitch: 1.2, pole: V3(0, -0.3, 1) });
    R.leg(1, { x: legs[1].hx * 1.6, z: 0.1, pitch: 0.1, pole: V3(0.2, 0, 1) });
    spine.rotation.set(0.28, 0.1, 0.1); chest.rotation.set(0.2, 0.05, 0.05);
    headTurn(R, 0.8, -0.25, 0.35);
    R.armHang(0, 0.2, { reach: 0.97, out: 0.12 }); R.armHang(1, 0.3, { reach: 0.97, out: 0.2 });
    hands[0].pose(0.4, 0.3); hands[1].pose(0.5, 0.2);
    if (gun) { gun.position.copy(o.dropAt ?? V3(-0.35, 0.02, 0.25)); gun.quaternion.copy(eulerQ(0, 0.8, Math.PI / 2)); R.rig.add(gun); }
  } else {
    const fall = [0, 0, -0.8, -1.42, -1.56][k];
    rig.rotation.x = fall;
    rig.position.x = (o.shift ?? [0, 0, 0.3, 0.55, 0.62])[k];
    pelvis.position.set(0, R.S.hipY, 0);
    const kb = [0, 0, 1.0, 0.6, 0.3][k];
    for (const L of legs) {
      L.hip.rotation.set(-kb * 0.8 + (L.i ? 0.25 : 0) * (k === 4 ? 1 : 0), 0, -L.side * [0, 0, 0.12, 0.2, 0.16][k]);
      L.knee.rotation.set(kb * 1.3 + (L.i && k === 4 ? 0.5 : 0), 0, 0);
      L.ankle.rotation.set(0.35 + (k === 4 ? 0.4 : 0), 0, -L.side * 0.2);
    }
    if (k === 4) legs[1].hip.rotation.x = -0.5; // one knee drawn up
    spine.rotation.set(-0.08, 0, 0.04); chest.rotation.set(-0.04, 0.05, 0);
    headTurn(R, [0, 0, 0.35, 0.1, 0.25][k], [0, 0, -0.3, -0.6, -1.0][k], [0, 0, 0.15, -0.1, -0.2][k]);
    const up = [0, 0, 2.3, 1.6, 1.25][k], fwd = [0, 0, 0.5, 0.35, 0.12][k];
    for (const A of arms) {
      A.sh.rotation.set(-fwd + (A.i ? 0.12 : -0.08), 0, -A.side * up * (A.i ? 0.85 : 1));
      A.el.rotation.set(0, 0, -A.side * [0, 0, 0.5, 0.45, 0.4][k]);
      A.wrist.rotation.set(0, 0, 0);
    }
    hands[0].pose(0.45, 0.3); hands[1].pose(0.35, 0.4);
    if (gun) { R.rig.remove(gun); R.root.add(gun); gun.position.copy(o.dropWorld ?? V3(0.25, 0.02, 0.35)); gun.quaternion.copy(eulerQ(0, 0.8, Math.PI / 2)); }
    if (R.coat) R.coatFlare = k >= 3 ? -0.12 : 0;
    R.noHemClamp = true; R.after?.(); R.noHemClamp = false;
    R.ground();
    if (k === 4 && o.pool) {
      o.pool.visible = true;
      R.sync();
      const cp = R.chest.getWorldPosition(V3()); R.root.worldToLocal(cp);
      o.pool.position.set(cp.x, 0.004, cp.z);
    }
  }
}

// Forward collapse, like cut strings (the possessed): the head drops, the knees go,
// the body pitches onto its face.
export function deathForward(R, k, o = {}) {
  const { rig, pelvis, spine, chest, legs, arms, hands } = R;
  rig.rotation.y = o.yaw ?? 1.15;
  const gun = o.gun;
  if (k === 0) {
    stand(R, { dz: [0.04, -0.04], wide: 1.3, crouch: 0.08 });
    pelvis.rotation.set(0.1, 0, 0.05);
    spine.rotation.set(0.2, -0.1, 0.05); chest.rotation.set(0.15, 0, 0.1);
    headTurn(R, 1.0, 0.25, 0.4);
    R.armHang(0, 0.25, { reach: 0.97, out: 0.1, hand: null }); R.armHang(1, 0.15, { reach: 0.97, out: 0.15 });
    hands[0].pose(0.8, 0); hands[1].pose(0.3, 0.2);
    if (gun) gunInHand(R, gun, 0);
  } else if (k === 1) {
    // on its knees, slumped, arms hanging
    pelvis.position.set(0, 0.62, -0.02);
    pelvis.rotation.set(0.1, 0.05, 0.06);
    R.leg(0, { x: legs[0].hx * 1.3, z: -0.42, y: 0.05, pitch: 1.35, pole: V3(0, -0.3, 1) });
    R.leg(1, { x: legs[1].hx * 1.5, z: -0.38, y: 0.05, pitch: 1.35, pole: V3(0, -0.3, 1) });
    spine.rotation.set(0.35, 0.1, 0.08); chest.rotation.set(0.3, 0.05, 0.05);
    headTurn(R, 1.1, -0.2, 0.3);
    R.armHang(0, 0.15, { reach: 0.98, out: 0.1 }); R.armHang(1, 0.1, { reach: 0.98, out: 0.15 });
    hands[0].pose(0.4, 0.2); hands[1].pose(0.4, 0.2);
    if (gun) { R.rig.add(gun); gun.position.copy(o.dropAt ?? V3(-0.3, 0.02, 0.35)); gun.quaternion.copy(eulerQ(0, 0.8, Math.PI / 2)); }
  } else {
    const fall = [0, 0, 0.75, 1.38, 1.55][k];
    rig.rotation.x = fall;
    rig.position.x = (o.shift ?? [0, 0, -0.3, -0.6, -0.7])[k];
    pelvis.position.set(0, R.S.hipY, 0);
    const kb = [0, 0, 1.3, 0.3, 0.05][k];
    for (const L of legs) {
      L.hip.rotation.set(kb * 0.5 - (k >= 3 ? 0.08 : 0), 0, -L.side * [0, 0, 0.1, 0.15, 0.2][k]);
      L.knee.rotation.set(kb * 1.6, 0, 0);
      L.ankle.rotation.set(k >= 3 ? 0.15 : 0.4, 0, L.side * 0.4);
    }
    spine.rotation.set(0.05, 0, 0.04); chest.rotation.set(0.02, 0.05, 0);
    headTurn(R, [0, 0, 0.4, -0.2, -0.1][k], [0, 0, 0.3, 0.9, 1.35][k], [0, 0, 0.1, 0.2, 0.3][k]);
    // arms: forward to break the fall, then out on the floor (face down: frontal-plane rotations)
    const AX = [[0, 0], [0, 0], [-1.3, -1.1], [-0.3, -0.2], [-0.1, -0.08]][k], AZ = [[0, 0], [0, 0], [0.3, 0.3], [1.9, 0.9], [2.5, 0.45]][k];
    for (const A of arms) { A.sh.rotation.set(AX[A.i], 0, -A.side * AZ[A.i]); A.el.rotation.set(0, 0, -A.side * (k === 4 && A.i ? 0.7 : 0.3)); A.wrist.rotation.set(0, 0, 0); }
    hands[0].pose(0.45, 0.3); hands[1].pose(0.35, 0.4);
    if (gun) { R.rig.remove(gun); R.root.add(gun); gun.position.copy(o.dropWorld ?? V3(0.25, 0.02, 0.35)); gun.quaternion.copy(eulerQ(0, 0.8, Math.PI / 2)); }
    R.noHemClamp = true; R.after?.(); R.noHemClamp = false;
    R.ground();
    if (k === 4 && o.pool) {
      o.pool.visible = true;
      R.sync();
      const cp = R.chest.getWorldPosition(V3()); R.root.worldToLocal(cp);
      o.pool.position.set(cp.x, 0.004, cp.z);
    }
  }
}

// ------------------------------------------------------------------ gibs: 4 frames (burst, falling, landing, remains)
// A set of meat/cloth/oil chunks animated procedurally; the upper body is hidden.
export function makeGibs(R, o = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(o.seed ?? 7);
  const flesh = mat(o.flesh ?? 0x8a1c16, { rough: 0.5 }), fleshD = mat(0x5a0e0c, { rough: 0.45 });
  const cloth = o.cloth || mat(0xb8a27a, { rough: 0.95 });
  const bone = mat(0xe0d6c0, { rough: 0.6 });
  const fluid = o.fluid || mat(0x080709, { rough: 0.1 });
  const skin = R.M.skin;
  const chunks = [];
  const mats = [flesh, fleshD, cloth, cloth, skin, bone, flesh, fleshD];
  for (let i = 0; i < (o.n ?? 22); i++) {
    const s = 0.035 + rnd() * 0.07;
    const m = mesh(rockGeo(i * 3.1, 1, 0.45), mats[i % mats.length]);
    m.scale.set(s, s * (0.6 + rnd() * 0.6), s * (0.7 + rnd() * 0.5));
    const dir = V3(rnd() * 2 - 1, rnd() * 1.2 - 0.2, rnd() * 2 - 1).normalize();
    chunks.push({ m, dir, sp: 0.6 + rnd() * 0.9, y0: 1.05 + rnd() * 0.5, spin: V3(rnd() * 6, rnd() * 6, rnd() * 6), s, land: V3(dir.x * (0.3 + rnd() * 0.7), 0, dir.z * (0.3 + rnd() * 0.7)) });
    g.add(m);
  }
  const splats = [];
  for (let i = 0; i < 18; i++) {
    const m = mesh(ellipsoidGeo(0.075, 0.04, 0.04, 8, 6), fluid);
    const dir = V3(rnd() * 2 - 1, rnd() * 1.4, rnd() * 2 - 1).normalize();
    splats.push({ m, dir, sp: 0.5 + rnd(), y0: 1.2 + rnd() * 0.3 });
    g.add(m);
  }
  if (o.extra) for (const e of o.extra) { g.add(e.m); chunks.push({ ...e, land: e.land ?? V3(0.3, 0, 0.2), spin: e.spin ?? V3(2, 3, 1), s: 0.1 }); }
  const puddle = pool(0.45, o.poolColor ?? 0x09080b, 5, { sx: 1.3, sz: 0.9 }); g.add(puddle);
  const stump = mesh(ellipsoidGeo(0.14, 0.07, 0.1, 10, 6), fleshD, 0, 0.12, 0); stump.visible = false;
  R.pelvis.add(stump);
  g.visible = false; R.root.add(g);
  return { g, chunks, splats, puddle, stump };
}
export function gib(R, G, k, o = {}) {
  const { rig, pelvis, legs } = R;
  G.g.visible = true;
  R.spine.visible = false; G.stump.visible = true;
  rig.rotation.y = o.yaw ?? 1.15;
  const t = [0.2, 0.42, 0.7, 1][k];
  // legs: standing → buckling → collapsed → lying
  if (k <= 1) {
    pelvis.position.set(0, R.S.hipY * (k === 0 ? 0.98 : 0.62), 0);
    for (const L of legs) R.leg(L.i, k === 0 ? { x: L.hx * 1.3, z: L.i ? 0.05 : -0.05, pitch: 0 } : { x: L.hx * 1.6, z: L.i ? 0.12 : -0.2, pitch: 0.2, pole: V3(-L.side * 0.4, 0, 1) });
    pelvis.rotation.set(k ? 0.2 : 0, 0, k ? 0.1 : 0);
  } else {
    rig.rotation.x = -1.5; rig.position.x = 0.2;
    pelvis.position.set(0, R.S.hipY, 0);
    for (const L of legs) { L.hip.rotation.set(-0.3 - (L.i ? 0.4 : 0), 0, -L.side * 0.25); L.knee.rotation.set(0.6 + (L.i ? 0.5 : 0), 0, 0); L.ankle.rotation.set(0.5, 0, 0); }
    R.ground();
  }
  // chunks: ballistic arcs out of the torso, landing and scattering on the floor
  for (const c of G.chunks) {
    const h = c.dir.clone().multiplyScalar(c.sp * t);
    let y = c.y0 + c.dir.y * c.sp * t * 1.2 - 2.2 * t * t;
    const floorY = c.s * 0.5;
    const landed = k >= 2 && y < floorY + 0.15;
    if (k === 3 || landed) { c.m.position.set(c.land.x + h.x * 0.2, floorY, c.land.z + h.z * 0.2); c.m.rotation.set(c.spin.x, c.spin.y, 0); }
    else { c.m.position.set(h.x, Math.max(floorY, y), h.z); c.m.rotation.set(c.spin.x * t, c.spin.y * t, c.spin.z * t); }
  }
  for (const s of G.splats) {
    const h = s.dir.clone().multiplyScalar(s.sp * t * 1.3);
    const y = s.y0 + s.dir.y * s.sp * t - 2.5 * t * t;
    s.m.visible = k < 2 || y > 0.05;
    s.m.position.set(h.x, Math.max(0.03, y), h.z);
    s.m.scale.set(1 + t * 1.5, 1, 1);
    s.m.lookAt(s.m.position.clone().add(s.dir));
  }
  G.puddle.visible = k >= 1;
  G.puddle.scale.setScalar([0.3, 0.45, 0.8, 1][k]);
}
export function ungib(R, G) { G.g.visible = false; R.spine.visible = true; G.stump.visible = false; }

// ------------------------------------------------------------------ civilians
// Panicked run: long strides, leaning in, arms flailing up and open.
export function panicRun(R, k, o = {}) {
  const ph = k * Math.PI / 2;
  R.gait(ph, { stride: o.stride ?? 0.85, lift: 0.2, bob: 0.05, lean: 0.22, twist: 0.16, sway: 0.05, arms: false, crouch: 0.04 });
  // [right, left] wrist offsets from the shoulders: one arm high, the other flung forward, alternating
  const F = [
    [[-0.16, 0.44, 0.08], [0.26, -0.06, 0.34]],
    [[-0.36, 0.2, 0.1], [0.3, 0.3, -0.04]],
    [[-0.24, -0.08, 0.34], [0.14, 0.46, 0.08]],
    [[-0.3, 0.3, -0.04], [0.36, 0.16, 0.12]],
  ][k];
  for (const A of R.arms) {
    const s = R.shPos(A.i), f = F[A.i];
    R.arm(A.i, s.clone().add(V3(f[0], f[1], f[2])), { pole: V3(-A.side * 1, -0.5, -0.2), hand: handQ(V3(-A.side * 0.3, 1, 0.2), V3(0, 0.1, 1), A.side) });
    R.hands[A.i].pose(0.1 + 0.15 * ((k + A.i) % 2), 0.8);
  }
  // looking back over the shoulder on the passing frames
  const H = [[0.0, 0.3, 0.1], [-0.15, 0.7, 0.05], [0.0, -0.25, -0.1], [-0.1, -0.6, -0.05]][k];
  headTurn(R, H[0] - 0.2, H[1], H[2]);
}
// Cowering: squatting down, hands clamped over the head.
export function cower(R, k) {
  const sq = k === 0 ? 0.5 : 0.46;
  R.pelvis.position.set(0, sq, -0.12);
  R.pelvis.rotation.set(0.5, 0, k ? 0.05 : -0.04);
  for (const L of R.legs) R.leg(L.i, { x: L.hx * 1.9, z: 0.05 + (L.i ? 0.04 : -0.02), pitch: 0.15, yaw: -L.side * 0.3, pole: V3(-L.side * 0.6, 0.2, 1) });
  R.spine.rotation.set(0.35, k ? 0.1 : -0.05, 0); R.chest.rotation.set(0.3, k ? 0.1 : 0, 0);
  headTurn(R, k ? 0.5 : 0.9, k ? 0.6 : 0, k ? 0.2 : 0);
  R.sync();
  for (const A of R.arms) {
    const t = R.toRig(R.head, V3(-A.side * 0.05, 0.19, 0.03));
    // one hand drops to shield the face when peeking
    if (k === 1 && A.i === 1) t.copy(R.toRig(R.head, V3(0.02, 0.06, 0.16)));
    R.arm(A.i, t, { pole: V3(-A.side * 1, -0.4, 0.4), hand: handQ(V3(A.side * 0.9, 0.3, 0.2), V3(0, -1, -0.2), A.side) });
    R.hands[A.i].pose(0.35, 0.3);
  }
}
// Unarmed pain flinch.
export function painCiv(R) {
  stand(R, { dz: [-0.1, 0.06], wide: 1.4, crouch: 0.06 });
  R.leg(1, { x: R.legs[1].hx * 1.5, z: 0.12, lift: 0.1, pitch: 0.4 });
  R.pelvis.position.z -= 0.04;
  R.pelvis.rotation.set(-0.12, 0.2, -0.08);
  R.spine.rotation.set(0.05, 0.15, -0.06); R.chest.rotation.set(0.1, 0.2, -0.1);
  headTurn(R, 0.3, -0.35, 0.35);
  // clutching the stomach with one hand, the other thrown out
  const s1 = R.shPos(1);
  R.arm(0, R.toRig(R.spine, V3(0.03, 0.1, 0.16)), { pole: V3(-1, -0.3, -0.3), hand: handQ(V3(1, -0.2, 0.2), V3(0, 0, -1), 1) });
  R.arm(1, s1.clone().add(V3(0.3, -0.05, 0.22)), { pole: V3(0, -1, -0.5) });
  R.hands[0].pose(0.6, 0.2); R.hands[1].pose(0.1, 0.9);
}
