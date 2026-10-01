import { THREE } from './core.js';
import * as AL from './alien.js';
import { views } from './views.js';
export default async function (F) {
  for (const [n, mk] of [['stinger', AL.makeStinger], ['scatter', AL.makeScatter], ['psmg', AL.makePlasmaSMG], ['sngl', AL.makeSingularity]]) {
    const g = mk(); const r = new THREE.Group(); r.add(g.root);
    await views(F, r, { name: n, list: ['left', [-1, 0.5, 0.8], 'top', 'back'], size: 360 });
  }
  const b = AL.makeBlade(); const r = new THREE.Group(); r.add(b);
  await views(F, r, { name: 'blade', list: ['left', [-1, 0.5, 0.8], 'top', 'front'], size: 360 });
}
