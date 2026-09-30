// FLHL: the left hand holding the steel Maglite low-left, beam end forward.
// A = on (lens glowing warm white), B = off. Drawn on its own psprite layer
// beside the right-hand hip gun.
import { THREE, hud } from '../lib/wpn/core.js';
import { makeMaglite } from '../lib/wpn/flashlight.js';
import { Viewmodel } from '../lib/wpn/vm.js';
import { FOV } from '../lib/wpn/common.js';

export default async function (F) {
  const fl = makeMaglite();
  const vm = new Viewmodel({ gun: fl, right: false });
  const HOLD = { p: [-0.215, -0.14, -0.5], r: [0.16, -0.28, 0.55] };
  const L = { at: 'L', grip: 'torch', elbow: [-0.42, -0.6, -0.2] };
  const P = { A: { gun: HOLD, state: { on: true }, L }, B: { gun: HOLD, state: { on: false }, L } };
  await hud(F, { model: { root: vm.root, pose: (k) => vm.pose(P[k]) }, frames: [{ name: 'FLHLA0', key: 'A' }, { name: 'FLHLB0', key: 'B' }], fov: FOV });
}
