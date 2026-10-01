// Pickups (mod/sprites/items, rotation 0, seen from 25° above, Doom-style
// larger than life) and the thrown-grenade projectiles (mod/sprites/fx).
import { THREE, pickup } from '../lib/wpn/core.js';
import * as I from '../lib/wpn/items.js';
import { makePistolMag, makePistol } from '../lib/wpn/pistol.js';
import { makeShotgun } from '../lib/wpn/shotgun.js';
import { makeSMG, makeAR, makeBR } from '../lib/wpn/rifles.js';
import { makeFrag, makeDetonator } from '../lib/wpn/grenades.js';

// Larger than life, sized like Doom's pickups (clip ≈ 12 map units, shells ≈ 16,
// medkit ≈ 28, armour ≈ 31, shotgun ≈ 63) at 64 texels/m and the actors' Scale 0.5.
const SCALE = 3.5;
const SCALES = { KBLU: 5, KRED: 5, KYEL: 5, HIMP: 4.5, AKEV: 3, ATAC: 3, ODOS: 3, OCSF: 3, OHDD: 3.5, HMED: 3.4, A55B: 3, AENP: 3.5, GFRG: 4.5, GDET: 4.5, HSTM: 4.5, BATT: 4.5, A9MM: 4.2, ASHL: 4.2, A556: 3.6, A762: 3.6,
  WP9M: 3.2, WSHT: 3.0, WSMG: 3.0, WARF: 3.0, WBRF: 2.8 };
const BOUNDS = { w: 3.2, top: 1.6, bottom: -0.1 };
function lay(obj, { rx = 0, ry = 0, rz = 0, y = 0, x = 0, z = 0, order = 'YXZ' } = {}) {
  const g = new THREE.Group(); obj.rotation.set(rx, ry, rz, order); obj.position.set(x, y, z); g.add(obj); return g;
}
// a gun lying on its side, barrel to the left
// a gun shown side-on (Doom convention), barrel to the left, left side toward the viewer, resting on its lowest point
function gunOnFloor(gun) {
  const g = lay(gun.root, { ry: Math.PI / 2, rx: 0, rz: -0.08 });
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  gun.root.position.y -= box.min.y; gun.root.position.x -= (box.min.x + box.max.x) / 2;
  return g;
}

export default async function (F) {
  const items = {
    A9MM: () => { const g = new THREE.Group(); g.add(lay(makePistolMag(0.1), { rz: Math.PI / 2, ry: 0.5, y: 0.011, x: 0.03 })); g.add(lay(makePistolMag(0.1), { rz: Math.PI / 2, ry: 0.15, y: 0.011, x: -0.03, z: 0.03 })); return g; },
    A9BX: () => I.ammoBox9(),
    ASHL: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const s = I.shell(); s.position.set(-0.035 + i * 0.023, 0.0105, (i % 2) * 0.006); s.rotation.y = 0.25 + (i % 2) * 0.1; g.add(s); } return g; },
    ASHB: () => I.shellBox(),
    A556: () => lay(makeAR().makeMag(), { rz: Math.PI / 2, ry: 0.45, y: 0.012, x: 0.06 }),
    A55B: () => I.ammoCan('5.56MM'),
    A762: () => lay(makeBR().makeMag(), { rz: Math.PI / 2, ry: 0.45, y: 0.013, x: 0.05 }),
    AENC: (f) => I.energyCell(f === 'B' ? 1 : 0),
    AENP: (f) => I.energyCell(f === 'B' ? 1 : 0, true),
    GFRG: () => lay(makeFrag(), { rz: 1.2, ry: 0.4, y: 0.032 }),
    GDET: () => lay(makeDetonator(), { rx: -0.25, y: 0.022 }),
    HSTM: () => I.stim(),
    HMED: () => I.medkit(),
    HIMP: (f) => I.implant('ABCD'.indexOf(f)),
    AKEV: () => I.vest(false),
    ATAC: () => I.vest(true),
    BATT: () => I.battery(),
    KBLU: (f) => I.keycard('blue', f === 'B'),
    KRED: (f) => I.keycard('red', f === 'B'),
    KYEL: (f) => I.keycard('yellow', f === 'B'),
    ODOS: () => I.dossier(),
    OHDD: () => I.hddCase(),
    OCSF: () => I.caseFile(),
    OSHD: (f) => I.shard(f === 'B'),
    WP9M: () => gunOnFloor(makePistol()),
    WSHT: () => gunOnFloor(makeShotgun()),
    WSMG: () => gunOnFloor(makeSMG()),
    WARF: () => gunOnFloor(makeAR()),
    WBRF: () => gunOnFloor(makeBR()),
  };
  const frames = { HIMP: 'ABCD', AENC: 'AB', AENP: 'AB', KBLU: 'AB', KRED: 'AB', KYEL: 'AB', OSHD: 'AB' };
  const env = { AENC: 'alien', AENP: 'alien', HIMP: 'alien', OSHD: 'alien', GDET: 'alien' };
  const only = globalThis.ITM_ONLY;
  for (const [spr, build] of Object.entries(items)) {
    if (only && !only.includes(spr)) continue;
    for (const f of frames[spr] || 'A') {
      const inner = build(f);
      const root = new THREE.Group(); root.add(inner); root.scale.setScalar(SCALES[spr] ?? SCALE);
      await pickup(F, { prefix: spr, frames: [{ f, rot: 0, yaw: 0 }], model: { root, pose() {} }, bounds: BOUNDS, elev: 25, env: env[spr] || 'studio' });
    }
  }
  // thrown grenades (fx): centred, spinning
  for (const [spr, make] of [['FRAG', makeFrag], ['DETN', makeDetonator]]) {
    if (only && !only.includes(spr)) continue;
    const n = make();
    const root = new THREE.Group(); root.add(n);
    for (let i = 0; i < 4; i++) {
      n.rotation.set(i * 0.9, i * 0.5, i * Math.PI / 2);
      if (spr === 'DETN') n.userData.set(i % 2 === 0);
      await pickup(F, { prefix: spr, dir: 'sprites/fx', frames: [{ f: 'ABCD'[i], rot: 0, yaw: 0 }], model: { root, pose() {} }, bounds: { w: 0.16, top: 0.08, bottom: -0.08 }, elev: 0, pxPerM: 200, env: spr === 'DETN' ? 'alien' : 'studio', sink: 0 });
    }
  }
}
