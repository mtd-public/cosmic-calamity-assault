// Debug: the arm rig from several angles.
import { THREE } from './core.js';
import { makeArm, GRIPS, Q } from './arm.js';
import { views } from './views.js';

export default async function (F) {
  const root = new THREE.Group();
  const R = makeArm(1), L = makeArm(-1);
  root.add(R.root, L.root);
  R.hand.pose(GRIPS.relaxed); L.hand.pose(GRIPS.fist); nanCheck(root);
  R.place(new THREE.Vector3(0.12, 0, 0), Q(0, 0, 0));
  L.place(new THREE.Vector3(-0.12, 0, 0), Q(0, 0, 0));
  await views(F, root, { name: 'arm', list: ['top', 'left', 'q1', 'front', 'q2', 'bottom'] });
  const h = makeArm(1); h.hand.pose(GRIPS.pistol); h.place(new THREE.Vector3(0, 0, 0), Q(0, 0, 0));
  const g2 = new THREE.Group(); g2.add(h.hand.root);
  await views(F, g2, { name: 'hand', list: ['top', 'left', 'right', 'front', 'q1', 'bottom'] });
}
export function nanCheck(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position; let bad = 0;
    for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) bad++;
    if (bad) { let path = []; let q = o; while (q) { path.push(q.name || q.type); q = q.parent; } console.warn('NaN mesh', bad, p.count, path.join('<'), o.geometry.type, o.material.type); }
  });
}
