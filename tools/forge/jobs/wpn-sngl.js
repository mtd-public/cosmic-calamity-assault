// SNGL: the Singularity, a two-handed alien device. A idle, B-F charge (the
// black-violet core grows), G fire, H-I recover.
import { THREE, hud, worldPos } from '../lib/wpn/core.js';
import { makeSingularity } from '../lib/wpn/alien.js';
import { Viewmodel } from '../lib/wpn/vm.js';
import { FOV } from '../lib/wpn/common.js';

export default async function (F) {
  const gun = makeSingularity();
  const vm = new Viewmodel({ gun });
  const base = [0.075, -0.175, -0.64], rot = [0.14, 0.12, 0.04];
  const R = { at: 'R', grip: 'pistol', elbow: [0.28, -0.55, -0.25] };
  const L = { at: 'L', grip: 'torch', elbow: [-0.3, -0.55, -0.3] };
  const shake = (k) => [Math.sin(k * 7) * 0.003 * k, Math.cos(k * 5) * 0.003 * k, 0];
  const P = {
    A: { c: 0.25 },
    B: { c: 0.4, d: shake(1) }, C: { c: 0.55, d: shake(2) }, D: { c: 0.7, d: shake(3) }, E: { c: 0.85, d: shake(4) }, F: { c: 1.0, d: shake(5) },
    G: { c: 1.3, d: [0, 0.02, 0.05], r: [0.2, 0, 0] , light: 1 },
    H: { c: 0.05, d: [0, 0.01, 0.025], r: [0.09, 0, 0] },
    I: { c: 0.15, d: [0, 0.003, 0.008], r: [0.03, 0, 0] },
  };
  const glowL = new THREE.PointLight(0xb070ff, 0, 0.9, 1.5); vm.root.add(glowL);
  const pose = (k) => {
    const p = P[k], d = p.d || [0, 0, 0], dr = p.r || [0, 0, 0];
    vm.pose({ gun: { p: base.map((x, i) => x + d[i]), r: rot.map((x, i) => x + dr[i]) }, state: { charge: p.c }, R, L });
    glowL.intensity = 0.3 + p.c * 0.8 + (p.light ? 1.5 : 0);
    glowL.position.copy(worldPos(gun.anchors.muzzle)).add(new THREE.Vector3(0, 0.05, 0.08));
  };
  const frames = [...'ABCDEFGHI'].map((f) => ({ name: `SNGL${f}0`, key: f }));
  await hud(F, { model: { root: vm.root, pose }, frames, fov: FOV, env: 'alien' });
}
