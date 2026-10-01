// GRNH: left hand with a frag (A pull pin, B cook hold, C-E throw).
// DETH: left hand with the alien detonator (A arm: glyphs light, B hold, C-E throw).
// Drawn on the grenade overlay layer while the right hand keeps its gun.
import { THREE, hud } from '../lib/wpn/core.js';
import { makeFrag, makeDetonator } from '../lib/wpn/grenades.js';
import { Viewmodel } from '../lib/wpn/vm.js';
import { FOV } from '../lib/wpn/common.js';

const PI = Math.PI;
export default async function (F) {
  for (const kind of ['GRNH', 'DETH']) {
    const vm = new Viewmodel({ right: false });
    const frag = kind === 'GRNH';
    const nade = frag ? makeFrag() : makeDetonator();
    vm.addProp('nade', nade);
    const pin = frag ? nade.userData.parts.pin : null;
    // in the palm: frag top toward the thumb; detonator face out of the palm
    const inHand = frag ? { hand: 'L', p: [0.004, -0.036, -0.072], r: [0, 0, -PI / 2] } : { hand: 'L', p: [0.0, -0.024, -0.07], r: [PI, 0, 0] };
    const lit = (o) => nade.userData.set?.(true);
    const L = (p, r, grip, elbow) => ({ at: { p, r }, grip, elbow });
    const P = {
      A: { L: L([-0.05, -0.13, -0.34], [0.35, -0.45, PI], 'ball', [-0.25, -0.5, 0.0]), props: { nade: { ...inHand, set: () => { if (pin) pin.position.set(-0.035, 0.01, 0.01); lit(); } } } },
      B: { L: L([-0.13, -0.07, -0.32], [0.55, 0.15, PI / 2], 'ball', [-0.32, -0.42, 0.02]), props: { nade: { ...inHand, set: () => { if (pin) pin.visible = false; lit(); } } } },
      C: { L: L([-0.12, -0.035, -0.38], [PI / 2 + 0.3, 0.3, 0.1], 'ball', [-0.3, -0.35, 0.05]), props: { nade: { ...inHand, set: () => { if (pin) pin.visible = false; lit(); } } } },
      D: { L: L([-0.06, -0.07, -0.4], [1.0, -0.15, 0.1], 'relaxed', [-0.28, -0.42, -0.08]), props: { nade: { p: [0.0, 0.01, -0.62], r: [0.9, 0.5, -0.4], set: () => { if (pin) pin.visible = false; lit(); } } } },
      E: { L: L([-0.02, -0.115, -0.4], [-0.35, -0.25, 0.25], 'relaxed', [-0.25, -0.52, -0.05]) },
    };
    const frames = [...'ABCDE'].map((f) => ({ name: `${kind}${f}0`, key: f }));
    await hud(F, { model: { root: vm.root, pose: (k) => { if (pin) { pin.visible = true; pin.position.set(0, 0, 0); } vm.pose(P[k]); } }, frames, fov: FOV, env: frag ? 'studio' : 'alien' });
  }
}
