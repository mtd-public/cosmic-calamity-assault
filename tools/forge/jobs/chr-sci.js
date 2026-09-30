// SCI1 (scientist: white lab coat, blue shirt, tie, glasses, receding grey hair) and
// SCI2 (lab tech: blue scrubs and cap, mask round the neck). docs/ASSETS.md §1:
//   A-D run (8), E-F cower (8), G pain (8), H-L death (0)
import { buildSci } from '../lib/chr/cast.js';
import { panicRun, cower, painCiv, death } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';

export default async function (F, params = {}) {
  for (const prefix of ['SCI1', 'SCI2']) {
    const R = buildSci(prefix);
    const blood = pool(0.4, 0x5c0907, 4, { sx: 1.3, sz: 0.9 }); blood.visible = false; R.root.add(blood);
    const scream = () => R.headMesh.setFace({ mouth: 'open' });
    const poses = {
      A: () => { panicRun(R, 0); scream(); }, B: () => { panicRun(R, 1); scream(); },
      C: () => { panicRun(R, 2); scream(); }, D: () => { panicRun(R, 3); scream(); },
      E: () => { cower(R, 0); R.coatK = 0.15; R.coatFlare = 0.3; }, F: () => { cower(R, 1); R.coatK = 0.15; R.coatFlare = 0.3; R.headMesh.setFace({ mouth: 'open' }); },
      G: () => { painCiv(R); R.headMesh.setFace({ mouth: 'open', eyes: 'closed' }); },
    };
    for (const [i, f] of [...'HIJKL'].entries()) poses[f] = () => { death(R, i, { pool: blood }); if (i >= 3) R.headMesh.setFace({ eyes: 'closed', mouth: 'open' }); };
    await renderChar(F, params, {
      prefix, dir: 'sprites/npcs', root: R.root, R,
      reset: () => { R.reset(); blood.visible = false; R.headMesh.setFace(null); R.coatK = R.coatCap = R.coatFlare = undefined; },
      after: () => R.after(),
      poses, rot8: 'ABCDEFG', rot0: 'HIJKL',
      bounds: { w: 1.9, top: 2.3, bottom: -0.05 },
      bounds0: { w: 3.1, top: 2.2, bottom: -0.5 }, elev0: 18,
    });
  }
}
