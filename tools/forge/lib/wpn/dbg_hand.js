import { THREE } from './core.js';
import { makeArm, GRIPS, Q } from './arm.js';
import { views } from './views.js';
export default async function (F) {
  const a = makeArm(1); a.hand.pose(GRIPS.relaxed); a.place(new THREE.Vector3(0, 0, 0), Q(0, 0, 0), { elbow: 'hand' });
  a.upper.visible = false;
  const g = new THREE.Group(); g.add(a.root);
  await views(F, g, { name: 'hand1', list: ['top', 'left', 'right', 'bottom', 'q1', 'q2'], size: 400 });
  a.fore.visible = false;
  await views(F, g, { name: 'hand2', list: ['top', 'left', 'right', 'bottom', 'q1', 'q2'], size: 400 });
}
