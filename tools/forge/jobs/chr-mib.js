// MIBK: the Man in Black, a human agent collaborating with the aliens (MAP02 Dulce, MAP04):
// black suit, white shirt, thin black tie, sunglasses, earpiece, a suppressed pistol.
// docs/ASSETS.md §1 (as THRL):
//   A-D walk (8), E aim (8), F fire with a small flash (8), G pain (8), H-L death (0), M-P gib (0)
import * as THREE from 'three';
import { buildMIB, silencedPistol, sunglasses } from '../lib/chr/civ.js';
import { walk, pain, death, makeGibs, gib, ungib } from '../lib/chr/poses.js';
import { agentAim } from '../lib/chr/civposes.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { mat, mesh, rboxGeo, V3 } from '../lib/chr/core.js';

export default async function (F, params = {}) {
  const R = buildMIB();
  const gun = silencedPistol();
  R.rig.add(gun);
  const blood = pool(0.42, 0x5c0907, 3, { sx: 1.35, sz: 0.9 }); blood.visible = false; R.root.add(blood);
  // the shades come off in the fall and land by his head
  const shades = new THREE.Group(); const sg = sunglasses(); sg.glint.visible = false; sg.position.set(0, -0.065, -0.08); shades.add(sg);
  shades.visible = false; R.root.add(shades);
  // gibs: suit cloth, a scrap of white shirt, the shades
  const flying = new THREE.Group(); const fs = sunglasses(); fs.glint.visible = false; fs.position.set(0, -0.09, -0.08); flying.add(fs);
  const scrap = mesh(rboxGeo(0.12, 0.1, 0.02, 0.006), R.M.shirtW);
  const G = makeGibs(R, {
    seed: 31, cloth: R.M.suit,
    extra: [
      { m: flying, dir: V3(-0.2, 1, 0.35).normalize(), sp: 1.1, y0: 1.66, land: V3(0.45, 0, 0.35), spin: V3(0, 2.4, 0) },
      { m: scrap, dir: V3(0.5, 0.8, -0.2).normalize(), sp: 0.9, y0: 1.3, land: V3(-0.5, 0, -0.15), spin: V3(0.3, 1.2, 0.2) },
    ],
  });

  const poses = {
    E: () => agentAim(R, gun),
    F: () => agentAim(R, gun, { fire: true }),
    G: () => { pain(R, gun, 'pistol'); R.headMesh.setFace({ mouth: 'open' }); },
  };
  for (let k = 0; k < 4; k++) poses['ABCD'[k]] = () => walk(R, gun, k, { style: 'patrol', carry: 'pistolLow', stride: 0.64, lean: 0.06 });
  for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => {
    death(R, i, { gun, pool: blood, yaw: 1.1, dropWorld: V3(0.3, 0.02, 0.42) });
    R.headMesh.setFace({ mouth: 'open', eyes: i >= 3 ? 'closed' : 'human' });
    if (i === 2) { R.glasses.rotation.set(-0.35, 0, 0.25); R.glasses.position.set(0, 0.035, 0.02); }
    if (i >= 3) {
      R.glasses.visible = false;
      R.sync();
      const hp = R.head.getWorldPosition(V3()); R.root.worldToLocal(hp);
      shades.visible = true;
      shades.position.set(hp.x - 0.05, 0.012, hp.z + 0.26);
      shades.rotation.set(-Math.PI / 2 + 0.2, 0, 0.9);
    }
  };
  for (const [i, f] of [...'MNOP'].entries()) poses[f] = () => {
    gib(R, G, i, { yaw: 1.1 });
    R.root.add(gun); gun.position.set(0.38, 0.02, 0.3); gun.quaternion.setFromEuler(new THREE.Euler(0, 0.9, Math.PI / 2));
  };

  await renderChar(F, params, {
    prefix: 'MIBK', dir: 'sprites/monsters', root: R.root, R,
    reset: () => {
      R.reset(); ungib(R, G); blood.visible = false; gun.flash.visible = false; R.headMesh.setFace(null);
      R.glasses.visible = true; R.glasses.position.set(0, 0, 0); R.glasses.rotation.set(0, 0, 0); shades.visible = false;
      R.rig.add(gun);
    },
    after: () => R.after(),
    poses, rot8: 'ABCDEFG', rot0: 'HIJKLMNOP',
    bounds: { w: 2.4, top: 2.05, bottom: -0.05 },
    bounds0: { w: 3.2, top: 2.2, bottom: -0.5 }, elev0: 18,
  });
}
