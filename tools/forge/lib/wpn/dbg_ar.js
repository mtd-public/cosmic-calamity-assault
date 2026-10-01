import { THREE } from './core.js';
import { makeAR } from './rifles.js';
import { Viewmodel } from './vm.js';
import { dumpHand } from './dbg_pistol.js';
import { views } from './views.js';
export default async function (F) {
  const gun = makeAR();
  const vm = new Viewmodel({ gun });
  vm.pose({ gun: { p: [0, 0, 0], r: [0, 0, 0] }, R: { at: 'R', grip: 'pistol' }, L: { at: 'L', grip: 'pump', elbow: 'hand' } });
  dumpHand(vm, gun, vm.L);
  vm.R.root.visible = false; vm.L.upper.visible = false; vm.L.fore.visible = false;
  await views(F, vm.root, { name: 'arfore', list: ['left', 'front', 'bottom', [-0.3, 0.3, 1]], size: 400 });
}
