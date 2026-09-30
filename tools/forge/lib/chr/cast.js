// The human cast, shared by the sprite jobs (living frames, deaths, corpses).
import * as THREE from 'three';
import { buildHuman, tacVest, radio, holster, pouches, webBelt } from './human.js';
import { mat, mesh, loftGeo, ellipsoidGeo, camo, rboxGeo, V3 } from './core.js';

// Area 51 security guard (tan BDU, navy helmet and vest). eyes: 'human' | 'closed'
export function buildGuard(o = {}) {
  const R = buildHuman({
    outfit: 'bdu-desert', skin: 0xd6a47f, hat: 'helmet', noChestPockets: true,
    face: { eyes: o.eyes ?? 'human', iris: '#4a3524', hair: 0x4a3322, hairStyle: 'short', brow: 0x3a2618, stubble: 0.45, blood: !!o.blood, mouth: 'grim' },
  });
  tacVest(R, 0x2b3a5c, { badge: true });
  radio(R, 1.38, 0.6, 'chest', 0.022);
  holster(R, 1);
  if (o.blood) bloodStains(R);
  return R;
}
export function bloodStains(R) {
  const bm = mat(0x5e0b09, { rough: 0.35 });
  R.spine.add(mesh(ellipsoidGeo(0.09, 0.08, 0.02, 10, 6), bm, 0.03, 0.02, 0.118, -0.1, 0, 0));
  R.pelvis.add(mesh(ellipsoidGeo(0.07, 0.05, 0.02, 10, 6), bm, 0.05, 0.04, 0.12, 0, 0.3, 0));
  R.legs[1].hip.add(mesh(ellipsoidGeo(0.06, 0.12, 0.02, 10, 6), bm, 0.0, -0.12, 0.07, 0.1, 0, 0));
  R.arms[0].el.add(mesh(ellipsoidGeo(0.045, 0.07, 0.02, 10, 6), bm, 0.0, -0.1, 0.04));
}

// The Thrall: a possessed guard in the tan BDU and black beret, oil-black eyes.
export function buildThrall() {
  const R = buildHuman({
    outfit: 'bdu-desert', skin: 0xc49c86, hat: 'beret',
    face: { eyes: 'oil', veins: true, hair: 0x2b221b, hairStyle: 'buzz', brow: 0x2b221b, stubble: 0.7, mouth: 'line' },
  });
  radio(R, 1.36, 0.55);
  holster(R, 1);
  pouches(R, [[1.055, -0.9, 0.06, 0.07, 0.035], [1.055, 1.1, 0.07, 0.07, 0.035], [1.055, 2.4, 0.06, 0.06, 0.03]], 0x2b2a22);
  return R;
}

// A soldier in woodland BDU, PASGT helmet and ALICE load-bearing gear.
// possessed: oil eyes + veins (the Thrall Trooper); else a dead soldier.
export function buildSoldier(o = {}) {
  const camoTex = camo('woodland', 0.5);
  const R = buildHuman({
    outfit: 'bdu-woodland', skin: o.skin ?? 0xc9a088, hat: 'pasgt', hatOpts: { camo: camoTex }, beltColor: 0x3e4428,
    face: o.possessed ? { eyes: 'oil', veins: true, hair: 0x3a2a1c, hairStyle: 'buzz', brow: 0x3a2a1c, stubble: 0.5 } : { eyes: o.eyes ?? 'closed', hair: 0x3a2a1c, hairStyle: 'buzz', brow: 0x3a2a1c, stubble: 0.4, blood: true, mouth: 'open' },
  });
  // ALICE suspenders + ammo pouches + canteen
  const web = mat(0x3e4428, { rough: 0.85 });
  for (const s of [-1, 1]) {
    R.stick(1.33, s * 0.5, [0.045, 0.3, 0.012], web, 'chest', { grow: 0.004, rz: s * 0.08 });
    R.stick(1.33, Math.PI - s * 0.5, [0.045, 0.3, 0.012], web, 'chest', { grow: 0.004, rz: -s * 0.08 });
  }
  pouches(R, [[1.02, -0.45, 0.08, 0.09, 0.05], [1.02, 0.45, 0.08, 0.09, 0.05], [1.0, 2.1, 0.09, 0.1, 0.06], [1.0, -2.1, 0.07, 0.08, 0.05]], 0x3e4428);
  return R;
}

// SCI1 scientist and SCI2 lab tech.
export function buildSci(kind) {
  if (kind === 'SCI1') {
    return buildHuman({
      outfit: 'labcoat', skin: 0xe2b69c, girth: 1.03, glasses: true,
      face: { eyes: 'human', iris: '#4a5a6a', hair: 0x9d9a94, hairStyle: 'receding', brow: 0x8a8580, browW: 3.6, mouth: 'line' },
      hairVolume: 0.007, hairA0: 1.25, hairA1: 2 * Math.PI - 1.25, hairY: [-0.02, 0.15],
    });
  }
  const R = buildHuman({
    outfit: 'scrubs', skin: 0x9a6a4a, girth: 0.96, hat: 'scrubcap',
    face: { eyes: 'human', hair: 0x1c1512, hairStyle: 'short', brow: 0x1c1512, mouth: 'line' },
  });
  // surgical mask pulled down round the neck
  const mask = mesh(loftGeo([{ y: -0.12, rx: 0.07, rz: 0.075, cz: 0.02 }, { y: -0.075, rx: 0.075, rz: 0.085, cz: 0.03 }], { seg: 12, a0: -1.5, a1: 1.5 }), mat(0x9fd0e8, { rough: 0.9, side: THREE.DoubleSide }));
  R.headMesh.add(mask);
  return R;
}
