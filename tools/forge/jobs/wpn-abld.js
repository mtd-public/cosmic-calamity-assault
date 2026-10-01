// ABLD: the Harvester blade, a bone-and-energy blade on a gauntlet over the
// right forearm. A idle, B-G a two-hit combo (B wind-up, C-D slash right→left,
// E raise, F overhead chop, G recover). No ADS/reload frames.
import { THREE, hud } from '../lib/wpn/core.js';
import { makeBlade } from '../lib/wpn/alien.js';
import { Viewmodel, aimQ } from '../lib/wpn/vm.js';
import { FOV } from '../lib/wpn/common.js';

export default async function (F) {
  const vm = new Viewmodel({ left: false });
  vm.addProp('blade', makeBlade());
  // wrist position, blade direction (= the forearm's line), back-of-hand hint
  const P = {
    A: [[0.14, -0.12, -0.38], [-0.35, 0.55, -0.75], [0.6, 0.4, 0.7]],
    B: [[0.17, 0.03, -0.35], [-0.8, 0.35, -0.5], [0.2, 0.8, 0.5]],
    C: [[0.02, -0.04, -0.42], [-0.95, 0.02, -0.3], [0, 1, 0.3]],
    D: [[-0.1, -0.13, -0.52], [-0.85, -0.2, -0.5], [-0.2, 0.95, 0.2]],
    E: [[0.1, 0.05, -0.34], [-0.2, 0.9, -0.4], [0.3, 0.2, 0.9]],
    F: [[0.04, -0.16, -0.48], [-0.2, 0.15, -0.95], [0.3, 0.9, 0.1]],
    G: [[0.13, -0.13, -0.38], [-0.3, 0.5, -0.8], [0.6, 0.4, 0.7]],
  };
  const pose = (k) => {
    const [w, d, b] = P[k];
    const dn = new THREE.Vector3(...d).normalize();
    const elbow = new THREE.Vector3(...w).addScaledVector(dn, -0.3).toArray();
    vm.pose({ R: { at: { p: w, q: aimQ(d, b) }, grip: 'knife', elbow }, props: { blade: { hand: 'R', fore: true, p: [0, 0, 0], r: [0, 0, 0] } } });
  };
  const frames = [...'ABCDEFG'].map((f) => ({ name: `ABLD${f}0`, key: f }));
  await hud(F, { model: { root: vm.root, pose }, frames, fov: FOV, env: 'alien' });
}
