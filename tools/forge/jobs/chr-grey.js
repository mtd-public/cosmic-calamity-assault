// GREY: the Grey (EBE), 1.2 m. docs/ASSETS.md §1:
//   A-D walk (8), E-F psychic-bolt cast (8), G claw (8), H pain (8), I-M death (0)
import { buildGrey } from '../lib/chr/aliens.js';
import { handQ, stand } from '../lib/chr/biped.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { V3 } from '../lib/chr/core.js';

export default async function (F, params = {}) {
  const R = buildGrey();
  const { rig, pelvis, spine, chest, neck, head, arms, legs, hands } = R;
  const eyes = R.headMesh.eyes;
  const ichor = pool(0.2, 0x5dff7a, 3, { glow: true, sx: 1.2, sz: 0.8 });
  ichor.visible = false; R.root.add(ichor);

  const headTurn = (pitch, yaw, roll) => { neck.rotation.set(pitch * 0.5, yaw * 0.5, roll * 0.5); head.rotation.set(pitch * 0.5, yaw * 0.5, roll * 0.5); };
  // jittery walk: small quick steps, hunched, the head twitching to a new angle every frame
  const JIT = [[0.1, 0.2, 0.22], [0.2, -0.12, -0.2], [0.05, -0.28, 0.12], [0.22, 0.14, -0.28]];
  const walk = (k) => {
    const ph = k * Math.PI / 2;
    R.gait(ph, { stride: 0.3, lift: 0.075, bob: 0.02, lean: 0.14, twist: 0.12, sway: 0.07, armSwing: 0.3, armFwd: 0.22, armReach: 0.82, armOut: 0.2 });
    chest.rotation.x += 0.08;
    const [p, y, r] = JIT[k];
    headTurn(0.05 + p, y, r);
    hands[0].pose(0.25 + 0.2 * (k % 2), 0.5); hands[1].pose(0.45 - 0.2 * (k % 2), 0.4);
  };
  const flare = (on) => { for (const e of eyes) e.flare.visible = on; };

  const poses = {
    A: () => walk(0), B: () => walk(1), C: () => walk(2), D: () => walk(3),
    // cast wind-up: the right hand rises beside the head, palm out, a pale light gathering in it
    E: () => {
      stand(R, { dz: [-0.09, 0.07], wide: 1.5, crouch: 0.02 });
      spine.rotation.set(-0.06, -0.15, 0.04); chest.rotation.set(-0.08, -0.22, 0);
      headTurn(-0.12, 0.2, -0.1);
      const s = R.shPos(0);
      R.arm(0, s.clone().add(V3(-0.1, 0.24, -0.02)), { pole: V3(-1, -0.3, -0.3), hand: handQ(V3(0.1, 1, 0.15), V3(0, 0, 1), 1) });
      hands[0].pose(0.12, 0.9);
      R.armHang(1, -0.25, { reach: 0.9, out: 0.35 });
      hands[1].pose(0.5, 0.6);
      R.orb.visible = true; R.orb.scale.setScalar(0.85);
      flare(true);
    },
    // release: the arm thrusts forward and the bolt leaves the palm
    F: () => {
      stand(R, { dz: [-0.12, 0.1], wide: 1.5, crouch: 0.03 });
      pelvis.rotation.set(0.05, 0.12, 0);
      spine.rotation.set(0.12, 0.14, 0); chest.rotation.set(0.08, 0.18, 0);
      headTurn(0.08, -0.25, 0.08);
      const s = R.shPos(0);
      const t = s.clone().add(V3(0.04, 0.05, 0.4));
      R.arm(0, t, { pole: V3(-1, -0.4, -0.2), hand: handQ(V3(0, 0.75, 0.6), V3(0, -0.25, 1), 1) });
      hands[0].pose(0.05, 1);
      R.armHang(1, -0.5, { reach: 0.9, out: 0.3 });
      hands[1].pose(0.5, 0.5);
      R.orb.visible = true; R.orb.scale.setScalar(1.1);
      R.orb2.visible = true; R.orb2.position.copy(t).add(V3(0, 0.03, 0.14));
      flare(true);
    },
    // claw: a lunging swipe, fingers hooked
    G: () => {
      stand(R, { dz: [0.14, -0.1], wide: 1.4, crouch: 0.05 });
      pelvis.position.z = 0.03;
      pelvis.rotation.set(0.1, 0.25, 0);
      spine.rotation.set(0.22, 0.2, 0); chest.rotation.set(0.12, 0.25, -0.05);
      headTurn(0.1, -0.3, 0.15);
      const s = R.shPos(0);
      R.arm(0, s.clone().add(V3(0.2, -0.06, 0.36)), { pole: V3(-0.6, 0.6, -0.4), hand: handQ(V3(0.5, -0.15, 1), V3(0.6, -0.8, 0), 1) });
      hands[0].pose(0.95, 0.85);
      const s1 = R.shPos(1);
      R.arm(1, s1.clone().add(V3(0.16, 0.05, -0.2)), { pole: V3(0.5, -0.3, -1) });
      hands[1].pose(0.6, 0.6);
    },
    // pain: jerked backwards, head thrown aside, arms flung out
    H: () => {
      stand(R, { dz: [-0.05, 0.08], wide: 1.3, crouch: 0.03 });
      R.leg(1, { x: legs[1].hx * 1.4, z: 0.1, lift: 0.07, pitch: 0.3 });
      pelvis.rotation.set(-0.1, -0.1, 0.08);
      spine.rotation.set(-0.2, 0, 0.05); chest.rotation.set(-0.15, -0.1, 0.1);
      headTurn(-0.08, 0.35, 0.4);
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(0, s0.clone().add(V3(-0.3, 0.12, 0.12)), { pole: V3(0, -1, -0.5) });
      R.arm(1, s1.clone().add(V3(0.26, -0.05, 0.2)), { pole: V3(0, -1, -0.5) });
      hands[0].pose(0.1, 1); hands[1].pose(0.2, 1);
    },
    // death: a jolt, the knees go, a fall backwards, the impact, the corpse
    I: () => death(0), J: () => death(1), K: () => death(2), L: () => death(3), M: () => death(4),
  };

  const YAW = 1.2;
  function death(k) {
    rig.rotation.y = YAW;
    if (k === 0) {
      R.pelvis.position.y += 0.03;
      for (const L of legs) R.leg(L.i, { x: L.hx * 1.3, z: L.i ? 0.06 : -0.06, pitch: 0.55 });
      spine.rotation.set(-0.3, 0, 0.05); chest.rotation.set(-0.25, 0, 0);
      headTurn(-0.4, 0.2, 0.25);
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(0, s0.clone().add(V3(-0.28, 0.3, -0.05)), { pole: V3(0, -1, 0) });
      R.arm(1, s1.clone().add(V3(0.28, 0.26, 0.02)), { pole: V3(0, -1, 0) });
      hands[0].pose(0.05, 1); hands[1].pose(0.1, 1);
      flare(true);
    } else if (k === 1) {
      // knees buckle: kneeling, slumped
      R.pelvis.position.set(0, 0.3, -0.05);
      pelvis.rotation.set(0.15, 0, 0.05);
      R.leg(0, { x: legs[0].hx * 1.5, z: -0.2, y: 0.03, pitch: 1.2, pole: V3(0, -0.2, 1) });
      R.leg(1, { x: legs[1].hx * 1.6, z: -0.16, y: 0.03, pitch: 1.1, pole: V3(0, -0.2, 1) });
      spine.rotation.set(0.3, 0.1, 0.1); chest.rotation.set(0.25, 0, 0.05);
      headTurn(0.8, -0.2, 0.4);
      R.armHang(0, 0.35, { reach: 0.97, out: 0.1 }); R.armHang(1, 0.1, { reach: 0.97, out: 0.2 });
      hands[0].pose(0.5, 0.3); hands[1].pose(0.6, 0.2);
    } else {
      const fall = [0, 0, -0.85, -1.42, -1.57][k];
      rig.rotation.x = fall;
      rig.position.x = [0, 0, 0.2, 0.38, 0.42][k];
      pelvis.position.set(0, R.S.hipY, 0);
      // legs: bent, then out straight
      const kb = [0, 0, 1.1, 0.7, 0.25][k];
      for (const L of legs) {
        L.hip.rotation.set(-kb * 0.8, 0, -L.side * [0, 0, 0.15, 0.25, 0.22][k]);
        L.knee.rotation.set(kb * 1.2, 0, 0);
        L.ankle.rotation.set(0.5, 0, 0);
      }
      legs[1].hip.rotation.x += [0, 0, -0.3, 0.2, 0.05][k];
      spine.rotation.set(-0.1, 0, 0.05); chest.rotation.set(-0.05, 0, 0);
      headTurn([0, 0, 0.3, 0.2, 0.75][k], [0, 0, -0.3, -0.6, -0.9][k], [0, 0, 0.2, -0.2, -0.3][k]);
      // arms: flung up by the fall, then limp on the floor
      const up = [0, 0, 2.4, 1.9, 1.35][k], fwd = [0, 0, 0.4, 0.5, 0.25][k];
      for (const A of arms) {
        A.sh.rotation.set(-fwd + (A.i ? 0.1 : -0.1), 0, -A.side * up * (A.i ? 0.9 : 1));
        A.el.rotation.set(0, 0, -A.side * [0, 0, 0.6, 0.4, 0.35][k]);
      }
      hands[0].pose(0.5, 0.4); hands[1].pose(0.35, 0.5);
      R.ground();
      if (k === 4) {
        ichor.visible = true;
        R.sync();
        const hp = R.head.getWorldPosition(V3());
        R.root.worldToLocal(hp);
        ichor.position.set(hp.x + 0.05, 0.004, hp.z + 0.05);
      }
    }
  }

  await renderChar(F, params, {
    prefix: 'GREY', dir: 'sprites/monsters', root: R.root,
    reset: () => { R.reset(); ichor.visible = false; },
    poses, rot8: 'ABCDEFGH', rot0: 'IJKLM',
    bounds: { w: 1.5, top: 1.45, bottom: -0.05 },
    bounds0: { w: 2.2, top: 1.45, bottom: -0.3 }, elev0: 18,
  });
}
