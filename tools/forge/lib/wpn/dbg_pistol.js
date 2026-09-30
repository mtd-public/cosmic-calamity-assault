// Debug: pistol + hands from several angles.
import { THREE } from './core.js';
import { makePistol } from './pistol.js';
import { Viewmodel } from './vm.js';
import { views } from './views.js';

export default async function (F) {
  const gun = makePistol();
  const vm = new Viewmodel({ gun });
  vm.pose({ gun: { p: [0, 0, 0], r: [0, 0, 0] }, R: { at: 'R', grip: 'pistol', elbow: [0.15, -0.25, 0.3] }, L: { at: 'Lsup', grip: 'support', elbow: [-0.15, -0.25, 0.3] } });
  dumpHand(vm, gun, vm.L); vm.R.upper.visible = false; vm.L.upper.visible = false;
  for (const a of [vm.R, vm.L]) a.fore.children[0].children.forEach((c, i) => { if (i > 0) c.visible = false; });
  await views(F, vm.root, { name: 'pistol2', list: ['left', 'right', 'front', 'bottom', 'back', [0.15, 0.5, 1]], size: 440 });
}
export function dumpHand(vm, gun, arm) {
  const inv = new THREE.Matrix4().copy(gun.root.matrixWorld).invert();
  const P = (o) => { const v = new THREE.Vector3(); o.getWorldPosition(v); v.applyMatrix4(inv); return v.toArray().map((x) => x.toFixed(3)).join(','); };
  for (const f of arm.hand.fingers) {
    const tip = new THREE.Object3D(); tip.position.set(0, 0, -f.L[2]); f.joints[2].add(tip); f.joints[2].updateMatrixWorld(true);
    console.warn(f.name, 'MCP', P(f.joints[0]), 'PIP', P(f.joints[1]), 'DIP', P(f.joints[2]), 'TIP', P(tip));
  }
  const t0 = arm.hand.thumb; const tip = new THREE.Object3D(); tip.position.set(0, 0, -0.027); t0[2].add(tip); t0[2].updateMatrixWorld(true);
  console.warn('thumb', P(t0[0]), P(t0[1]), P(t0[2]), 'TIP', P(tip), 'wrist', P(arm.hand.root));
}
