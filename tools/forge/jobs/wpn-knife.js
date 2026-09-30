// KNIF: combat knife, slot 1 (A idle low right, B-E slash across right→left,
// F-H stab lunge). MELE: the quick-melee knife overlay from the bottom-left,
// left hand (A-D), drawn over any gun.
import { THREE, hud } from '../lib/wpn/core.js';
import { makeKnife } from '../lib/wpn/knife.js';
import { Viewmodel } from '../lib/wpn/vm.js';
import { FOV } from '../lib/wpn/common.js';

export default async function (F) {
  // ---- KNIF (right hand)
  {
    const knife = makeKnife();
    const vm = new Viewmodel({ gun: knife, left: false });
    const R = (elbow, grip = 'knife') => ({ at: 'R', grip, elbow });
    const P = {
      A: { gun: { p: [0.13, -0.1, -0.36], r: [0.35, 0.35, -0.5] }, R: R([0.3, -0.5, -0.05]) },
      // slash: wind up high right → sweep across the centre → finish low left → recover
      B: { gun: { p: [0.19, -0.02, -0.33], r: [0.5, -0.5, -1.2] }, R: R([0.38, -0.3, 0.02]) },
      C: { gun: { p: [0.03, -0.05, -0.36], r: [0.15, 0.7, -1.45] }, R: R([0.25, -0.4, -0.1]) },
      D: { gun: { p: [-0.13, -0.12, -0.33], r: [-0.2, 1.3, -1.6] }, R: R([0.1, -0.45, -0.12]) },
      E: { gun: { p: [0.06, -0.16, -0.34], r: [0.1, 0.6, -0.8] }, R: R([0.28, -0.52, -0.05]) },
      // stab: draw back → lunge to the centre → pull back
      F: { gun: { p: [0.14, -0.13, -0.26], r: [0.2, 0.25, -0.35] }, R: R([0.3, -0.45, 0.08]) },
      G: { gun: { p: [0.045, -0.06, -0.47], r: [0.1, 0.08, -0.25] }, R: R([0.2, -0.36, -0.22]) },
      H: { gun: { p: [0.11, -0.1, -0.36], r: [0.28, 0.25, -0.4] }, R: R([0.3, -0.48, -0.05]) },
    };
    const frames = [...'ABCDEFGH'].map((f) => ({ name: `KNIF${f}0`, key: f }));
    await hud(F, { model: { root: vm.root, pose: (k) => vm.pose(P[k]) }, frames, fov: FOV });
  }
  // ---- MELE (left hand, from the bottom-left)
  {
    const knife = makeKnife();
    const vm = new Viewmodel({ gun: knife, right: false });
    const L = (elbow) => ({ at: 'L', grip: 'knife', elbow });
    const P = {
      A: { gun: { p: [-0.2, -0.2, -0.3], r: [0.6, 0.2, 1.2] }, L: L([-0.35, -0.5, 0.05]) },
      B: { gun: { p: [-0.12, -0.04, -0.34], r: [0.4, 0.5, 1.3] }, L: L([-0.35, -0.35, 0.0]) },
      C: { gun: { p: [0.08, -0.06, -0.36], r: [0.1, -0.7, 1.5] }, L: L([-0.2, -0.42, -0.1]) },
      D: { gun: { p: [-0.05, -0.2, -0.32], r: [0.2, -0.3, 1.1] }, L: L([-0.32, -0.55, -0.02]) },
    };
    const frames = [...'ABCD'].map((f) => ({ name: `MELE${f}0`, key: f }));
    await hud(F, { model: { root: vm.root, pose: (k) => vm.pose(P[k]) }, frames, fov: FOV });
  }
}
