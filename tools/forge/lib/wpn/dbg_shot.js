import { THREE } from './core.js';
import { makeShotgun } from './shotgun.js';
import { Viewmodel } from './vm.js';
import { dumpHand } from './dbg_pistol.js';
import { views } from './views.js';
export default async function (F) {
  const gun = makeShotgun();
  const vm = new Viewmodel({ gun });
  vm.pose({ gun: { p: [0, 0, 0], r: [0, 0, 0] }, R: { at: 'R', grip: 'pistol' }, L: { at: 'L', grip: 'pump', elbow: 'hand' } });
  dumpHand(vm, gun, vm.L);
  vm.R.root.visible = false; vm.L.upper.visible = false; vm.L.fore.visible = false;
  await views(F, vm.root, { name: 'pump', list: ['left', 'front', 'bottom', 'right'], size: 400 });
}
