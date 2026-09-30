// STLK: the Stalker, a long-limbed grey-green hunter that runs half-crouched.
//   A-D run (8), E-G claw lunge (8), H pain (8), I-M death (0)
import { buildStalker } from '../lib/chr/aliens.js';
import { handQ, stand } from '../lib/chr/biped.js';
import { headTurn } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { V3 } from '../lib/chr/core.js';

export default async function (F, params = {}) {
  const R = buildStalker();
  const { rig, pelvis, spine, chest, legs, arms, hands, jaw } = R;
  const ichor = pool(0.5, 0x4cf07a, 12, { glow: true, sx: 1.4, sz: 0.9 }); ichor.visible = false; R.root.add(ichor);
  const toeStance = (o = {}) => { // standing on the toes: feet pitched steeply
    R.pelvis.position.set(0, o.y ?? 1.07, o.z ?? 0);
    for (const L of legs) R.leg(L.i, { x: L.hx * (o.wide ?? 1.4), z: (o.dz?.[L.i] ?? 0), pitch: 0.95, yaw: -L.side * 0.15, pole: V3(-L.side * 0.25, 0, 1) });
  };
  const hunch = (p, s, c) => { pelvis.rotation.x += p; spine.rotation.x += s; chest.rotation.x += c; };
  const run = (k) => {
    const ph = k * Math.PI / 2;
    R.gait(ph, { stride: 0.95, lift: 0.2, bob: 0.06, lean: 0.0, crouch: 0.1, pitchAdd: 0.9, pitchK: 0.5, twist: 0.12, sway: 0.05, arms: false, pelvisPitch: 0.7 });
    spine.rotation.x += 0.45; chest.rotation.x += 0.25;
    headTurn(R, -1.45, [0.12, 0, -0.12, 0][k], [0.08, 0, -0.08, 0][k]);
    for (const A of arms) {
      const s = A.i === 0 ? -Math.cos(ph) : Math.cos(ph);
      R.armHang(A.i, s * 0.6 + 0.15, { reach: 0.9, out: 0.22, pole: V3(-A.side * 0.3, 0.3, -1) });
      hands[A.i].pose(0.25, 0.6);
    }
    jaw.rotation.x = [0.15, 0.35, 0.15, 0.35][k];
  };
  const poses = {
    A: () => run(0), B: () => run(1), C: () => run(2), D: () => run(3),
    // wind-up: sunk low, claws spread wide and back, jaws open
    E: () => {
      hunch(0.5, 0.3, 0.05);
      toeStance({ y: 0.92, dz: [-0.25, 0.2], wide: 1.6 });
      headTurn(R, -1.1, 0, 0);
      for (const A of arms) {
        const s = R.shPos(A.i);
        R.arm(A.i, s.clone().add(V3(-A.side * 0.5, -0.12, 0.12)), { pole: V3(-A.side * 0.2, 0.6, -1), hand: handQ(V3(-A.side * 0.4, -0.2, 1), V3(A.side * 0.5, -0.8, 0), A.side) });
        hands[A.i].pose(0.15, 1);
      }
      jaw.rotation.x = 0.65;
    },
    // lunge: thrown forward, the right claws slashing down through the target
    F: () => {
      hunch(0.62, 0.45, 0.25);
      toeStance({ y: 0.86, z: 0.15, dz: [0.4, -0.38], wide: 1.3 });
      pelvis.rotation.y = 0.2; chest.rotation.y = 0.35;
      headTurn(R, -1.3, -0.1, 0.1);
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(0, s0.clone().add(V3(0.18, -0.35, 0.66)), { pole: V3(-1, 0.4, -0.2), hand: handQ(V3(0.3, -0.6, 1), V3(0.8, 0, -0.1), 1) });
      R.arm(1, s1.clone().add(V3(0.22, 0.05, -0.48)), { pole: V3(1, -0.6, 0.2) });
      hands[0].pose(0.35, 0.9); hands[1].pose(0.2, 0.8);
      jaw.rotation.x = 0.55;
    },
    // follow-through: the left claws come across, the right swept back
    G: () => {
      hunch(0.6, 0.42, 0.25);
      toeStance({ y: 0.88, z: 0.12, dz: [0.36, -0.34], wide: 1.3 });
      pelvis.rotation.y = -0.15; chest.rotation.y = -0.4;
      headTurn(R, -1.25, 0.15, -0.1);
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(1, s1.clone().add(V3(-0.3, -0.32, 0.55)), { pole: V3(1, 0.4, -0.2), hand: handQ(V3(-0.6, -0.5, 0.8), V3(-0.5, 0, -0.5), -1) });
      R.arm(0, s0.clone().add(V3(-0.28, 0.05, -0.45)), { pole: V3(-1, -0.6, 0.2) });
      hands[1].pose(0.35, 0.9); hands[0].pose(0.2, 0.8);
      jaw.rotation.x = 0.45;
    },
    // pain: rearing back, head snapped up, claws drawn in
    H: () => {
      hunch(0.15, 0.0, -0.15);
      toeStance({ y: 1.04, z: -0.1, dz: [-0.25, 0.15] });
      headTurn(R, -1.3, 0.35, 0.35);
      for (const A of arms) {
        const s = R.shPos(A.i);
        R.arm(A.i, s.clone().add(V3(A.side * 0.02, -0.3, 0.3)), { pole: V3(-A.side, -0.5, -0.4) });
        hands[A.i].pose(0.7, 0.3);
      }
      jaw.rotation.x = 0.75;
    },
  };
  // death: rears up, drops to its knees, pitches forward onto its face
  const death = (k) => {
    rig.rotation.y = 1.2;
    if (k === 0) {
      hunch(-0.05, -0.2, -0.25);
      toeStance({ y: 1.17, dz: [-0.05, 0.05] });
      headTurn(R, -1.1, 0.2, 0.2);
      for (const A of arms) { const s = R.shPos(A.i); R.arm(A.i, s.clone().add(V3(-A.side * 0.4, 0.45, 0.1)), { pole: V3(0, -1, 0) }); hands[A.i].pose(0.1, 1); }
      jaw.rotation.x = 0.75;
    } else if (k === 1) {
      pelvis.position.set(0, 0.55, -0.1);
      pelvis.rotation.set(0.35, 0, 0.05);
      R.leg(0, { x: legs[0].hx * 1.5, z: -0.45, y: 0.05, pitch: 1.4, pole: V3(0, -0.3, 1) });
      R.leg(1, { x: legs[1].hx * 1.6, z: -0.38, y: 0.05, pitch: 1.4, pole: V3(0, -0.3, 1) });
      spine.rotation.set(0.35, 0, 0.08); chest.rotation.set(0.3, 0, 0.05);
      headTurn(R, 0.6, -0.2, 0.3);
      R.armHang(0, 0.2, { reach: 0.98, out: 0.15 }); R.armHang(1, 0.35, { reach: 0.98, out: 0.2 });
      jaw.rotation.x = 0.4;
    } else {
      const fall = [0, 0, 0.8, 1.4, 1.54][k];
      rig.rotation.x = fall;
      rig.position.x = [0, 0, -0.4, -0.75, -0.9][k];
      pelvis.position.set(0, R.S.hipY, 0);
      const kb = [0, 0, 1.2, 0.5, 0.2][k];
      for (const L of legs) { L.hip.rotation.set(kb * 0.4, 0, -L.side * 0.2); L.knee.rotation.set(kb * 1.5, 0, 0); L.ankle.rotation.set(0.6, 0, 0); }
      legs[1].hip.rotation.x -= 0.3 * (k === 4 ? 1 : 0);
      spine.rotation.set(0.1, 0, 0.05); chest.rotation.set(0.05, 0.1, 0);
      headTurn(R, [0, 0, -0.6, -0.5, -0.05][k], [0, 0, 0.3, 0.8, 1.3][k], [0, 0, 0.2, 0.2, 0.5][k]);
      // arms thrown forward to break the fall, then flung out on the floor (face down: the frontal plane is the floor)
      const AX = [[0, 0], [0, 0], [-1.3, -1.5], [-0.35, -0.3], [-0.14, -0.1]][k], AZ = [[0, 0], [0, 0], [0.35, 0.3], [2.1, 1.7], [2.55, 0.55]][k];
      for (const A of arms) { A.sh.rotation.set(AX[A.i], 0, -A.side * AZ[A.i]); A.el.rotation.set(0, 0, -A.side * (k === 4 && A.i ? 0.9 : 0.35)); A.wrist.rotation.set(0, 0, 0); }
      for (const h of hands) h.pose(0.5, 0.6);
      jaw.rotation.x = [0, 0, 0.5, 0.35, 0.3][k];
      R.ground();
      if (k === 4) { ichor.visible = true; R.sync(); const p = R.chest.getWorldPosition(V3()); R.root.worldToLocal(p); ichor.position.set(p.x, 0.004, p.z); }
    }
  };
  for (const [i, f] of [...'IJKLM'].entries()) poses[f] = () => death(i);
  await renderChar(F, params, {
    prefix: 'STLK', dir: 'sprites/monsters', root: R.root, R,
    reset: () => { R.reset(); ichor.visible = false; },
    poses, rot8: 'ABCDEFGH', rot0: 'IJKLM',
    bounds: { w: 3.3, top: 2.1, bottom: -0.1 },
    bounds0: { w: 3.3, top: 2.9, bottom: -0.5 }, elev0: 18,
  });
}
