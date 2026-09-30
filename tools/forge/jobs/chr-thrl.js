// THRL: the Thrall, a possessed Area 51 security guard. docs/ASSETS.md §1:
//   A-D walk (8), E aim (8), F fire with flash (8), G pain (8), H-L death (0), M-P gib (0)
import { buildThrall } from '../lib/chr/cast.js';
import { pistol } from '../lib/chr/guns.js';
import { walk, aim, pain, death, makeGibs, gib, ungib } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { mat, V3 } from '../lib/chr/core.js';
import { hat } from '../lib/chr/head.js';
import * as THREE from 'three';

export default async function (F, params = {}) {
  const R = buildThrall();
  const gun = pistol();
  R.rig.add(gun);
  const oil = pool(0.42, 0x08070a, 2, { sx: 1.4, sz: 0.9 }); oil.visible = false; R.root.add(oil);
  // gibs: the beret flies off with the chunks
  const beret = hat('beret'); beret.scale.setScalar(1);
  const G = makeGibs(R, { seed: 11, cloth: mat(0xffffff, { rough: 0.95, map: R.M.shirt.map }), extra: [{ m: beret, dir: V3(0.3, 1, 0.2).normalize(), sp: 1.1, y0: 1.7, land: V3(-0.5, -0.12, 0.3), spin: V3(0.3, 2, 0.2) }] });

  const poses = {
    A: () => walk(R, gun, 0, { style: 'shamble', carry: 'pistolLow' }),
    B: () => walk(R, gun, 1, { style: 'shamble', carry: 'pistolLow' }),
    C: () => walk(R, gun, 2, { style: 'shamble', carry: 'pistolLow' }),
    D: () => walk(R, gun, 3, { style: 'shamble', carry: 'pistolLow' }),
    E: () => aim(R, gun, 'pistol1'),
    F: () => aim(R, gun, 'pistol1', { fire: true }),
    G: () => pain(R, gun, 'pistol'),
  };
  for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => death(R, i, { gun, pool: oil });
  for (const [i, f] of [...'MNOP'].entries()) poses[f] = () => { gib(R, G, i); gun.visible = true; R.root.add(gun); gun.position.set(0.35, 0.02, 0.3); gun.quaternion.setFromEuler(new THREE.Euler(0, 0.8, Math.PI / 2)); };

  await renderChar(F, params, {
    prefix: 'THRL', dir: 'sprites/monsters', root: R.root,
    reset: () => { R.reset(); ungib(R, G); oil.visible = false; gun.flash.visible = false; },
    after: () => R.after(),
    poses, rot8: 'ABCDEFG', rot0: 'HIJKLMNOP',
    bounds: { w: 1.7, top: 2.0, bottom: -0.05 },
    bounds0: { w: 2.6, top: 2.2, bottom: -0.45 }, elev0: 18,
  });
}
