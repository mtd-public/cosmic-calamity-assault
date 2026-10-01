// DEDB E-F: more corpses for set dressing (rotation 0, seen from above like chr-dedb.js; A-D are
// rendered there and untouched here). docs/ASSETS.md §1:
//   E dead office worker, man (on his back, arms flung out, tie askew, badge on his chest)
//   F dead office worker, woman (face down, hair spread, one pump lost beside her)
import * as THREE from 'three';
import { buildOfficeMan, buildOfficeWoman } from '../lib/chr/civ.js';
import { headTurn } from '../lib/chr/poses.js';
import { settleBody } from '../lib/chr/civposes.js';
import { eulerQ } from '../lib/chr/biped.js';
import { renderChar } from '../lib/chr/job.js';
import { pool, shoe } from '../lib/chr/parts.js';
import { mat, V3 } from '../lib/chr/core.js';

const B = { w: 2.9, top: 1.1, bottom: -0.8 };
const ELEV = 30;

function setArm(A, x, z, ex = 0, ez = 0) { A.sh.rotation.set(x, 0, -A.side * z); A.el.rotation.set(ex, 0, -A.side * ez); }
function setLeg(L, x, z, knee, ankle = 0.3, y = 0) { L.hip.rotation.set(x, y, -L.side * z); L.knee.rotation.set(knee, 0, 0); L.ankle.rotation.set(ankle, 0, 0); }
// A knee fallen outward with the shin flat on the floor: the thigh turned out about its own axis,
// then abducted, then dipped toward the floor (drop: + on the back, - face down).
function frogLeg(L, abduct, knee, drop, ankle = 0.4) { L.hip.rotation.set(drop, -L.side * 1.45, -L.side * abduct, 'XZY'); L.knee.rotation.set(knee, 0, 0); L.ankle.rotation.set(ankle, 0, 0); }
function blood(R, part, r = 0.45, off = V3(), seed = 1) {
  R.sync();
  const p = R[part].getWorldPosition(V3()); R.root.worldToLocal(p);
  const b = pool(r, 0x5a0907, seed, { sx: 1.4, sz: 1.0 });
  b.position.set(p.x + off.x, 0.004, p.z + off.z);
  R.root.add(b);
}

export default async function (F, params = {}) {
  // E: the office man on his back, one arm flung over his head, the other out, a knee fallen sideways
  {
    const R = buildOfficeMan();
    R.headMesh.setFace({ eyes: 'closed', mouth: 'open' });
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'E',
      reset: () => R.reset(),
      poses: { E: () => {
        R.rig.rotation.set(-Math.PI / 2 + 0.03, -1.3, 0);
        R.rig.position.x = -0.72;
        R.spine.rotation.set(-0.04, 0.06, 0.08); R.chest.rotation.set(-0.02, 0.05, 0.04);
        headTurn(R, -0.12, 1.0, 0.1);
        setArm(R.arms[0], -0.2, 2.3, 0, 0.55);
        setArm(R.arms[1], 0.14, 0.85, 0, 0.35);
        setLeg(R.legs[0], 0.08, 0.1, 0.12, 0.5);
        frogLeg(R.legs[1], 0.45, 1.3, 0.1);
        R.hands[0].pose(0.35, 0.4); R.hands[1].pose(0.55, 0.2);
        settleBody(R);
        blood(R, 'chest', 0.5, V3(0.05, 0, -0.08), 41);
      } },
    });
  }
  // F: the office woman face down, an arm bent up by her head, hair spread, a pump lost by her feet
  {
    const R = buildOfficeWoman();
    R.headMesh.setFace({ eyes: 'closed', mouth: 'open' });
    // her left foot is out of its shoe: a stockinged foot, the pump on the floor
    const L1 = R.legs[1];
    const pump = L1.ankle.children[0];
    L1.ankle.remove(pump);
    L1.ankle.add(shoe(mat(0xd9b8a0, { rough: 0.6 }), { h: 0.05, heel: 0.045, toe: 0.15, w: 0.034 }));
    R.root.add(pump);
    await renderChar(F, params, {
      prefix: 'DEDB', dir: 'sprites/npcs', root: R.root, bounds0: B, elev0: ELEV, rot0: 'F',
      reset: () => R.reset(),
      poses: { F: () => {
        R.rig.rotation.set(Math.PI / 2 - 0.03, -1.3, 0);
        R.rig.position.x = 0.68;
        R.spine.rotation.set(0.02, -0.08, 0.06); R.chest.rotation.set(0, -0.05, 0.05);
        headTurn(R, -0.15, 1.5, -0.1);
        setArm(R.arms[0], 0.15, 1.6, 0, 1.4);
        setArm(R.arms[1], -0.18, 0.3, 0, 0.3);
        setLeg(R.legs[0], -0.1, 0.08, 0.1, 0.9);
        frogLeg(R.legs[1], 0.55, 1.4, -0.1, 0.6);
        R.hands[0].pose(0.4, 0.4); R.hands[1].pose(0.5, 0.2);
        R.coatK = 0.8; R.coatFlare = 0;
        settleBody(R);
        R.sync();
        const fp = L1.ankle.getWorldPosition(V3()); R.root.worldToLocal(fp);
        pump.position.set(fp.x + 0.28, 0.035, fp.z + 0.22);
        pump.quaternion.copy(eulerQ(0, 2.2, Math.PI / 2 - 0.15));
        blood(R, 'spine', 0.48, V3(-0.04, 0, 0.06), 57);
      } },
    });
  }
}
