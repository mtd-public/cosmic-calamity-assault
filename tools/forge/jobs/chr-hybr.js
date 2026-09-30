// HYBR: the Hybrid, a human-alien soldier: tall, pale and hairless, black sclera,
// black BDU and webbing, an alien carbine (curved bone and chrome, a glowing teal cell).
//   A-D walk (8), E aim (8), F fire (8), G pain (8), H-L death (0)
import * as THREE from 'three';
import { buildHuman, pouches, webBelt } from '../lib/chr/human.js';
import { alienCarbine } from '../lib/chr/guns.js';
import { walk, aim, pain, death } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { mat, mesh, ellipsoidGeo, rboxGeo, V3 } from '../lib/chr/core.js';

export function buildHybrid() {
  const R = buildHuman({
    outfit: 'bdu-black', h: 1.06, girth: 0.94, skin: 0xe4dfe0, gloves: 0x18181a, beltColor: 0x57594e,
    face: { eyes: 'black', mouth: 'line', hairStyle: 'none' },
  });
  // a slightly long skull, and wet black eyes that catch the light
  R.headMesh.scale.set(0.98, 1.08, 1.02);
  const eyeM = mat(0x050506, { rough: 0.08 });
  for (const s of [-1, 1]) R.headMesh.add(mesh(ellipsoidGeo(0.021, 0.012, 0.009, 10, 6), eyeM, s * 0.033, 0.058, 0.093, 0, s * 0.38, s * 0.22));
  // chest rig: magazine pouches across the chest, harness straps, an X across the back
  const web = mat(0x57594e, { rough: 0.85 });
  R.stick(1.25, 0, [0.26, 0.15, 0.02], web, 'spine', { grow: 0.004 });
  for (const a of [-0.4, 0, 0.4]) R.stick(1.25, a, [0.065, 0.11, 0.04], web, 'spine', { grow: 0.02 });
  for (const s of [-1, 1]) R.stick(1.38, s * 0.55, [0.05, 0.26, 0.012], web, 'chest', { grow: 0.004, rz: s * 0.1 });
  for (const s of [-1, 1]) R.stick(1.3, Math.PI, [0.05, 0.4, 0.012], web, 'chest', { grow: 0.006, rz: s * 0.6 });
  pouches(R, [[1.05, -0.9, 0.07, 0.08, 0.04], [1.05, 0.9, 0.07, 0.08, 0.04], [1.05, 2.5, 0.08, 0.07, 0.04]], 0x57594e);
  // knee pads
  for (const L of R.legs) L.knee.add(mesh(ellipsoidGeo(0.06, 0.07, 0.04, 10, 6), web, 0, -0.02, 0.05));
  return R;
}

export default async function (F, params = {}) {
  const R = buildHybrid();
  const gun = alienCarbine(); R.rig.add(gun);
  const ichor = pool(0.42, 0x2fb862, 9, { sx: 1.4, sz: 0.9, glow: true }); ichor.visible = false; R.root.add(ichor);
  const poses = {
    E: () => aim(R, gun, 'long'),
    F: () => aim(R, gun, 'long', { fire: true }),
    G: () => pain(R, gun, 'long'),
  };
  for (let k = 0; k < 4; k++) poses['ABCD'[k]] = () => walk(R, gun, k, { style: 'patrol', carry: 'longLow', stride: 0.66, lean: 0.1 });
  for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => death(R, i, { gun, pool: ichor, dropWorld: V3(0.2, 0.03, 0.45) });
  await renderChar(F, params, {
    prefix: 'HYBR', dir: 'sprites/monsters', root: R.root, R,
    reset: () => { R.reset(); ichor.visible = false; gun.flash.visible = false; },
    after: () => R.after(),
    poses, rot8: 'ABCDEFG', rot0: 'HIJKL',
    bounds: { w: 2.5, top: 2.15, bottom: -0.05 },
    bounds0: { w: 3.3, top: 2.3, bottom: -0.45 }, elev0: 18,
  });
}
