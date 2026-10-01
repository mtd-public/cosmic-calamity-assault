// OFC1 (office worker, man: white shirt, rolled sleeves, loosened tie, grey slacks, lanyard badge,
// curtains) and OFC2 (office worker, woman: navy 90s pantsuit with shoulder pads, ivory blouse,
// low heels, shoulder-length hair). Chicago, 1997. docs/ASSETS.md §1:
//   A-D run (8), E-F cower / hands up (8), G pain (8), H-L death (0), M-N thank you / wave on (8)
import { buildOfficeMan, buildOfficeWoman } from '../lib/chr/civ.js';
import { panicRun, cower, painCiv, death } from '../lib/chr/poses.js';
import { cowerUp, waveThanks, waveOn } from '../lib/chr/civposes.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';

export default async function (F, params = {}) {
  for (const prefix of ['OFC1', 'OFC2']) {
    const woman = prefix === 'OFC2';
    const R = woman ? buildOfficeWoman() : buildOfficeMan();
    const blood = pool(0.4, 0x5c0907, woman ? 8 : 5, { sx: 1.3, sz: 0.9 }); blood.visible = false; R.root.add(blood);
    const scream = () => R.headMesh.setFace({ mouth: 'open' });
    const poses = {
      E: () => { cower(R, 0); R.coatK = 0.95; R.coatCap = 1.6; R.coatFlare = -0.2; },
      F: () => { cowerUp(R); R.coatK = 0.95; R.coatCap = 1.6; R.coatFlare = -0.2; scream(); },
      G: () => { painCiv(R); R.headMesh.setFace({ mouth: 'open', eyes: 'closed' }); },
      M: () => { waveThanks(R); R.headMesh.setFace({ mouth: 'open' }); },
      N: () => { waveOn(R); R.headMesh.setFace({ smile: true }); },
    };
    for (let k = 0; k < 4; k++) poses['ABCD'[k]] = () => { panicRun(R, k, { stride: woman ? 0.78 : 0.85 }); scream(); };
    for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => { death(R, i, { pool: blood, yaw: woman ? -1.15 : 1.15, shift: woman ? [0, 0, -0.3, -0.55, -0.62] : undefined }); if (i >= 3) R.headMesh.setFace({ eyes: 'closed', mouth: 'open' }); };
    await renderChar(F, params, {
      prefix, dir: 'sprites/npcs', root: R.root, R,
      reset: () => { R.reset(); blood.visible = false; R.headMesh.setFace(null); R.coatK = R.coatCap = R.coatFlare = undefined; },
      after: () => R.after(),
      poses, rot8: 'ABCDEFGMN', rot0: 'HIJKL',
      bounds: { w: 1.9, top: 2.3, bottom: -0.05 },
      bounds0: { w: 3.1, top: 2.2, bottom: -0.5 }, elev0: 18,
    });
  }
}
