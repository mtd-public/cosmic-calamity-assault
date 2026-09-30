// THRS: the Thrall Trooper, a possessed soldier (woodland BDU, PASGT helmet, shotgun).
//   A-D walk (8), E aim (8), F fire with flash (8), G pain (8), H-L death (0), M-P gib (0)
import * as THREE from 'three';
import { buildSoldier } from '../lib/chr/cast.js';
import { shotgun } from '../lib/chr/guns.js';
import { walk, aim, pain, death, makeGibs, gib, ungib } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { mat, camo, V3 } from '../lib/chr/core.js';
import { hat } from '../lib/chr/head.js';

export default async function (F, params = {}) {
  const R = buildSoldier({ possessed: true, skin: 0xbf9a86 });
  const gun = shotgun({ wood: 0x5a3a22 });
  R.rig.add(gun);
  const oil = pool(0.45, 0x08070a, 7, { sx: 1.4, sz: 0.9 }); oil.visible = false; R.root.add(oil);
  const helmet = hat('pasgt', 1, { camo: camo('woodland', 0.5) });
  const G = makeGibs(R, { seed: 23, cloth: mat(0xffffff, { rough: 0.95, map: camo('woodland', 0.5) }), extra: [{ m: helmet, dir: V3(-0.3, 1, 0.3).normalize(), sp: 1.0, y0: 1.72, land: V3(0.55, -0.1, 0.25), spin: V3(0.4, 2.5, 0.3) }] });

  // the possessed soldier's head hangs to the other side from the guard's
  const J = [[0.1, -0.1, 0.4], [0.22, 0.05, 0.3], [0.08, -0.16, 0.46], [0.26, 0.0, 0.32]];
  const poses = {
    E: () => aim(R, gun, 'long'),
    F: () => { aim(R, gun, 'long', { fire: true }); },
    G: () => pain(R, gun, 'long'),
  };
  for (let k = 0; k < 4; k++) poses['ABCD'[k]] = () => walk(R, gun, k, { style: 'shamble', carry: 'longLow', jitter: J, stride: 0.52 });
  for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => death(R, i, { gun, pool: oil, forward: true, yaw: -1.15, shift: [0, 0, 0.3, 0.6, 0.7], dropWorld: V3(-0.1, 0.03, 0.45) });
  for (const [i, f] of [...'MNOP'].entries()) poses[f] = () => { gib(R, G, i, { yaw: -1.1 }); R.root.add(gun); gun.position.set(-0.4, 0.03, 0.35); gun.quaternion.setFromEuler(new THREE.Euler(0, -0.5, Math.PI / 2)); };

  await renderChar(F, params, {
    prefix: 'THRS', dir: 'sprites/monsters', root: R.root, R,
    reset: () => { R.reset(); ungib(R, G); oil.visible = false; gun.flash.visible = false; },
    after: () => R.after(),
    poses, rot8: 'ABCDEFG', rot0: 'HIJKLMNOP',
    bounds: { w: 3.2, top: 2.05, bottom: -0.05 },
    bounds0: { w: 3.3, top: 2.2, bottom: -0.5 }, elev0: 18,
  });
}
