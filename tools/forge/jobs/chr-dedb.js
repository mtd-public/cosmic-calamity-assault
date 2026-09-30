// DEDB: corpses for set dressing (all rotation 0), seen from above so they read on the floor.
//   A dead guard (face down, reaching), B dead scientist (on his back, coat spread),
//   C dead lab tech (on her side, curled), D dead soldier (on his back, knee up)
import * as THREE from 'three';
import { buildGuard, buildSci, buildSoldier } from '../lib/chr/cast.js';
import { pistol } from '../lib/chr/guns.js';
import { headTurn } from '../lib/chr/poses.js';
import { eulerQ } from '../lib/chr/biped.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { V3 } from '../lib/chr/core.js';

const B = { w: 2.5, top: 1.1, bottom: -0.75 };
const ELEV = 30;

function setArm(A, x, z, ex = 0, ez = 0) { A.sh.rotation.set(x, 0, -A.side * z); A.el.rotation.set(ex, 0, -A.side * ez); }
function setLeg(L, x, z, knee, ankle = 0.3) { L.hip.rotation.set(x, 0, -L.side * z); L.knee.rotation.set(knee, 0, 0); L.ankle.rotation.set(ankle, 0, 0); }
function blood(R, part, r = 0.45, off = V3()) {
  R.sync();
  const p = R[part].getWorldPosition(V3()); R.root.worldToLocal(p);
  const b = pool(r, 0x5a0907, (r * 100) | 0, { sx: 1.4, sz: 1.0 });
  b.position.set(p.x + off.x, 0.004, p.z + off.z);
  R.root.add(b);
}

export default async function (F, params = {}) {
  // A: dead guard, face down, one arm reaching out, his pistol just out of reach
  {
    const R = buildGuard({ eyes: 'closed', blood: true });
    const gun = pistol(); R.root.add(gun);
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'A',
      reset: () => R.reset(),
      poses: { A: () => {
        R.rig.rotation.set(Math.PI / 2 - 0.03, 1.35, 0);
        R.rig.position.x = -0.75;
        R.spine.rotation.set(0, 0.1, 0.05);
        headTurn(R, -0.3, 1.5, 0);
        setArm(R.arms[0], -2.7, 0.35, 0, 0.3);
        setArm(R.arms[1], 0.15, 0.25, 0, 0.7);
        setLeg(R.legs[0], 0.0, 0.08, 0.1, 0.9);
        setLeg(R.legs[1], -0.6, 0.45, 1.2, 0.8);
        R.hands[0].pose(0.2, 0.4); R.hands[1].pose(0.5, 0.2);
        R.ground();
        R.sync();
        const hp = R.hands[0].getWorldPosition(V3()); R.root.worldToLocal(hp);
        gun.position.set(hp.x - 0.18, 0.02, hp.z + 0.12); gun.quaternion.copy(eulerQ(0, 2.2, Math.PI / 2));
        blood(R, 'chest', 0.5, V3(0.05, 0, 0.05));
      } },
    });
  }
  // B: dead scientist on his back, coat splayed, one hand on his chest
  {
    const R = buildSci('SCI1');
    R.headMesh.setFace({ eyes: 'closed', mouth: 'open' });
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'B',
      reset: () => R.reset(),
      poses: { B: () => {
        R.rig.rotation.set(-Math.PI / 2 + 0.02, 1.25, 0);
        R.rig.position.x = 0.75;
        R.spine.rotation.set(-0.05, 0, -0.05);
        headTurn(R, 0.3, -0.9, -0.2);
        setArm(R.arms[0], -0.3, 1.2, 0, 0.5);
        setArm(R.arms[1], -0.9, -0.1, -1.6, 0.0);
        setLeg(R.legs[0], -0.1, 0.12, 0.15, 0.5);
        setLeg(R.legs[1], -0.05, 0.2, 0.1, 0.6);
        R.hands[0].pose(0.4, 0.3); R.hands[1].pose(0.5, 0.1);
        R.coatFlare = -0.1; R.coatK = 0.3;
        R.noHemClamp = true; R.after(); R.noHemClamp = false;
        // the coat's front panels fall open to the sides
        R.coat.rf.rotation.z = 0.5; R.coat.lf.rotation.z = -0.5;
        R.ground();
        blood(R, 'spine', 0.55, V3(0.1, 0, -0.05));
      } },
    });
  }
  // C: dead lab tech, on her side, curled up
  {
    const R = buildSci('SCI2');
    R.headMesh.setFace({ eyes: 'closed', mouth: 'line' });
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'C',
      reset: () => R.reset(),
      poses: { C: () => {
        R.rig.rotation.set(0, 0.25, Math.PI / 2 - 0.05);
        R.rig.position.x = 0.7;
        R.spine.rotation.set(0.35, 0, 0); R.chest.rotation.set(0.2, 0, 0);
        headTurn(R, 0.5, 0.2, 0.2);
        setArm(R.arms[0], -1.0, 0.1, -1.4, 0);
        setArm(R.arms[1], -0.7, 0.4, -1.1, 0.2);
        setLeg(R.legs[0], -1.1, 0.05, 1.6, 0.4);
        setLeg(R.legs[1], -0.7, -0.05, 1.2, 0.4);
        R.hands[0].pose(0.6, 0.1); R.hands[1].pose(0.5, 0.2);
        R.ground();
        blood(R, 'pelvis', 0.45, V3(0.1, 0, 0.1));
      } },
    });
  }
  // D: dead soldier on his back, one knee up, rifle-less, helmet still on
  {
    const R = buildSoldier({ eyes: 'closed' });
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'D',
      reset: () => R.reset(),
      poses: { D: () => {
        R.rig.rotation.set(-Math.PI / 2 + 0.02, -1.3, 0);
        R.rig.position.x = -0.75;
        R.spine.rotation.set(-0.05, 0, 0.05);
        headTurn(R, 0.2, 0.9, 0.1);
        setArm(R.arms[0], -0.2, 0.3, 0, 0.3);
        setArm(R.arms[1], -1.2, 1.3, 0, 0.8);
        setLeg(R.legs[0], -0.8, 0.25, 1.5, 0.3);
        setLeg(R.legs[1], -0.05, 0.12, 0.1, 0.6);
        R.hands[0].pose(0.5, 0.2); R.hands[1].pose(0.3, 0.3);
        R.ground();
        blood(R, 'chest', 0.5, V3(-0.05, 0, 0.0));
      } },
    });
  }
}
