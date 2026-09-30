import { THREE } from './core.js';
import { makeMaglite } from './flashlight.js';
import { Viewmodel } from './vm.js';
import { views } from './views.js';
import { dumpHand } from './dbg_pistol.js';
export default async function (F) {
  const fl = makeMaglite();
  const vm = new Viewmodel({ gun: fl, right: false });
  vm.pose({ gun: { p: [0, 0, 0], r: [0, 0, 0] }, L: { at: 'L', grip: 'torch', elbow: 'hand' } });
  vm.L.upper.visible = false; dumpHand(vm, fl, vm.L);
  await views(F, vm.root, { name: 'maglite', list: ['left', 'right', 'top', 'front', 'q1', [-0.6, 0.6, 1]], size: 420 });
}
