// GRDW (downed guard sitting against a wall, bloodied) and GRDA (the same guard
// revived and fighting, Half-Life's security guard: helmet and vest over the tan BDU).
//   GRDW: A-B breathe (8), C wave/talk (8), D revive-rise (8), E-H death slump (0)
//   GRDA: A-D walk (8), E aim (8), F fire (8), G pain (8), H-L death (0)
import { buildGuard } from '../lib/chr/cast.js';
import { pistol } from '../lib/chr/guns.js';
import { walk, aim, pain, death, headTurn } from '../lib/chr/poses.js';
import { handQ } from '../lib/chr/biped.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { V3 } from '../lib/chr/core.js';

// Sitting against a wall: pelvis on the floor, back reclined, legs out (left knee up).
function sit(R, o = {}) {
  const { pelvis, spine, chest, legs } = R;
  pelvis.position.set(0, 0.13, 0);
  pelvis.rotation.set(-0.42 + (o.pelvisX ?? 0), 0, o.roll ?? 0);
  spine.rotation.set(-0.02 + (o.spineX ?? 0), 0.05, o.roll ? o.roll * 0.5 : 0);
  chest.rotation.set(o.chestX ?? -0.04, 0.05, 0);
  R.leg(0, { x: legs[0].hx * 1.5, z: 0.82, y: 0.08, pitch: -1.2, pole: V3(0, 1, 0.3), yaw: 0.25 });
  R.leg(1, { x: legs[1].hx * 1.6, z: 0.45, pitch: 0.0, pole: V3(0.2, 1, 0.4), yaw: -0.2 });
}

export default async function (F, params = {}) {
  // ------------------------------------------------------------ GRDW
  {
    const R = buildGuard({ blood: true });
    const blood = pool(0.35, 0x5c0907, 6, { sx: 1.2, sz: 1.0 }); R.root.add(blood);
    const { arms, hands, legs } = R;
    const pressWound = () => {
      R.arm(0, R.toRig(R.spine, V3(0.03, 0.04, 0.2)), { pole: V3(-1, -0.2, -0.2), hand: handQ(V3(1, -0.3, 0.1), V3(0, 0, -1), 1) });
      hands[0].pose(0.35, 0.3);
    };
    const restHand = (lift = 0) => {
      R.arm(1, V3(0.38, 0.05 + lift, 0.18), { pole: V3(1, 0.3, -0.5), hand: handQ(V3(0.3, -0.2, 1), V3(0, -1, 0), -1) });
      hands[1].pose(0.3, 0.2);
    };
    const poses = {
      A: () => { sit(R, { chestX: -0.02 }); headTurn(R, 0.55, 0.15, 0.25); pressWound(); restHand(); },
      B: () => { sit(R, { chestX: -0.12, spineX: -0.03 }); headTurn(R, 0.35, 0.1, 0.18); pressWound(); restHand(0.02); R.headMesh.setFace({ mouth: 'open' }); },
      // wave the player over, calling out
      C: () => {
        sit(R, { chestX: -0.08 }); headTurn(R, -0.05, -0.1, 0.05); pressWound();
        const s1 = R.shPos(1);
        R.arm(1, s1.clone().add(V3(0.1, 0.34, 0.26)), { pole: V3(1, -0.5, -0.2), hand: handQ(V3(0.1, 1, 0.2), V3(0, 0, 1), -1) });
        hands[1].pose(0.05, 0.7);
        R.headMesh.setFace({ mouth: 'open' });
      },
      // getting up: on one knee, a hand pushing off the other knee
      D: () => {
        R.pelvis.position.set(0, 0.52, 0.1);
        R.pelvis.rotation.set(0.25, 0.15, 0);
        R.leg(0, { x: legs[0].hx * 1.3, z: -0.32, y: 0.05, pitch: 1.3, pole: V3(0, -0.4, 1) });
        R.leg(1, { x: legs[1].hx * 1.5, z: 0.42, pitch: 0.0, pole: V3(0.1, 0.4, 1) });
        R.spine.rotation.set(0.25, 0, 0); R.chest.rotation.set(0.15, -0.1, 0);
        headTurn(R, -0.1, 0, 0.1);
        pressWound();
        R.sync();
        const knee = R.toRig(legs[1].knee, V3(0, 0, 0));
        R.arm(1, knee.clone().add(V3(0.03, 0.08, 0.02)), { pole: V3(1, 0, -0.4), hand: handQ(V3(-0.2, -1, 0.4), V3(0, -0.3, -1), -1) });
        hands[1].pose(0.6, 0.1);
      },
    };
    // death slump: the head drops, the body tips sideways down the wall onto the floor
    const slump = (k) => {
      R.rig.rotation.y = 0.6;
      const roll = [0.0, 0.35, 0.85, 1.35][k];
      sit(R, { chestX: 0.15 + k * 0.05, roll: 0 });
      R.pelvis.rotation.z = roll * 0.55;
      R.spine.rotation.z = roll * 0.3; R.chest.rotation.z = roll * 0.2;
      R.pelvis.position.y = 0.13 + [0, 0.03, 0.06, 0.02][k];
      R.pelvis.position.x = [0, -0.05, -0.1, -0.12][k];
      headTurn(R, [0.9, 0.8, 0.5, 0.2][k], 0.2, [0.3, 0.5, 0.7, 0.9][k]);
      // arms go limp: hands slide off the wound into the lap / onto the floor
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(0, [R.toRig(R.spine, V3(0.02, -0.08, 0.2)), V3(-0.1, 0.12, 0.35), V3(-0.3, 0.05, 0.3), V3(-0.55, 0.04, 0.2)][k], { pole: V3(-1, -0.3, -0.3) });
      R.arm(1, [V3(0.36, 0.05, 0.2), V3(0.35, 0.05, 0.25), V3(0.2, 0.05, 0.4), s1.clone().add(V3(0.25, -0.25, 0.35))][k], { pole: V3(1, 0.3, -0.5) });
      hands[0].pose(0.3, 0.2); hands[1].pose(0.3, 0.2);
      void s0;
      R.ground();
      blood.scale.setScalar([1, 1.15, 1.3, 1.5][k]);
      R.headMesh.setFace({ eyes: k >= 1 ? 'closed' : 'human', mouth: 'open' });
    };
    for (const [i, f] of [...'EFGH'].entries()) poses[f] = () => slump(i);
    await renderChar(F, params, {
      prefix: 'GRDW', dir: 'sprites/npcs', root: R.root, R,
      reset: () => { R.reset(); R.headMesh.setFace(null); blood.position.set(-0.05, 0.004, 0.15); blood.scale.setScalar(1); },
      poses, rot8: 'ABCD', rot0: 'EFGH',
      bounds: { w: 2.3, top: 1.6, bottom: -0.45 }, elev: 10,
      bounds0: { w: 2.2, top: 1.4, bottom: -0.35 }, elev0: 18,
    });
  }
  // ------------------------------------------------------------ GRDA
  {
    const R = buildGuard({});
    const gun = pistol(); R.rig.add(gun);
    const blood = pool(0.4, 0x5c0907, 4, { sx: 1.3, sz: 0.9 }); blood.visible = false; R.root.add(blood);
    const poses = {
      E: () => aim(R, gun, 'pistol2'),
      F: () => aim(R, gun, 'pistol2', { fire: true }),
      G: () => { pain(R, gun, 'pistol'); R.headMesh.setFace({ mouth: 'open', eyes: 'closed' }); },
    };
    for (let k = 0; k < 4; k++) poses['ABCD'[k]] = () => walk(R, gun, k, { style: 'patrol', carry: 'pistolReady' });
    for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => { death(R, i, { gun, pool: blood }); if (i >= 2) R.headMesh.setFace({ eyes: 'closed', mouth: 'open' }); };
    await renderChar(F, params, {
      prefix: 'GRDA', dir: 'sprites/npcs', root: R.root, R,
      reset: () => { R.reset(); blood.visible = false; gun.flash.visible = false; R.headMesh.setFace(null); },
      poses, rot8: 'ABCDEFG', rot0: 'HIJKL',
      bounds: { w: 1.9, top: 2.05, bottom: -0.05 },
      bounds0: { w: 3.1, top: 2.2, bottom: -0.5 }, elev0: 18,
    });
  }
}
