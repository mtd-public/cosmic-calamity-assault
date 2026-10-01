// ASTG: alien Stinger pistol HUD frames. Same map as P9MM (A hip, B-C fire,
// D-K reload = energy-cell swap, L-N ADS, O, P, X/Y), and C is the charged
// glow per the contract (the core swells and brightens).
import { THREE, hud, worldPos } from '../lib/wpn/core.js';
import { makeStinger, makeCell, VIOLET } from '../lib/wpn/alien.js';
import { Viewmodel, Q, basisQ } from '../lib/wpn/vm.js';
import { flashFrame, FOV } from '../lib/wpn/common.js';

export default async function (F) {
  const gun = makeStinger();
  const vm = new Viewmodel({ gun });
  vm.addProp('newMag', makeCell(0.07, 0.011));
  vm.addProp('oldMag', makeCell(0.07, 0.011));
  const L = gun.magLen;
  const HIP = { p: [0.1, -0.062, -0.42], r: [0.05, 0.3, 0.14] };
  const ADS = { p: [0, -gun.sightY, -0.38], r: [0, 0, 0] };
  const Rh = { at: 'R', grip: 'pistol', elbow: [0.3, -0.5, -0.1] };
  const Rads = { at: 'R', grip: 'pistol', elbow: [0.19, -0.42, -0.12] };
  const Lads = { at: 'Lsup', grip: 'support', elbow: [-0.19, -0.42, -0.12] };
  const holdMag = (prop) => ({ at: { prop }, off: { p: [-0.02, -0.06, 0.055], q: Q(0, 0, Math.PI / 2) }, grip: 'pinch', elbow: [-0.15, -0.5, -0.1] });
  const slap = { at: { prop: 'newMag' }, off: { p: [-0.05, -L - 0.02, 0.008], q: basisQ([0, 0, -1], [0, -1, 0], [-1, 0, 0]) }, grip: 'cup', elbow: [-0.2, -0.45, -0.1] };
  const REL = { p: [0.055, 0.005, -0.42], r: [0.5, 0.05, -0.72] };
  const magAt = (d) => ({ at: 'magwell', off: { p: [0, d, 0] } });
  const P = {
    A: { gun: HIP, R: Rh },
    B: { gun: { p: [0.1, -0.05, -0.37], r: [0.22, 0.29, 0.1] }, state: { trigger: 1, charge: 0 }, R: { ...Rh, grip: 'pistolFire' }, light: 1 },
    C: { gun: { p: [0.1, -0.055, -0.39], r: [0.08, 0.3, 0.125] }, state: { charge: 1 }, R: Rh, light: 0.6 },
    D: { gun: { p: [0.08, -0.03, -0.41], r: [0.3, 0.18, -0.35] }, state: { mag: 0.012 }, R: Rh },
    E: { gun: REL, state: { magVis: false }, R: Rh, props: { oldMag: { ...magAt(-0.03), set: (o) => o.rotateX(0.3) }, newMag: { at: { cam: 'magwell', dp: [-0.07, -0.1, 0.05] }, set: (o) => o.rotateZ(0.4) } }, L: holdMag('newMag') },
    F: { gun: REL, state: { magVis: false }, R: Rh, props: { newMag: { ...magAt(-0.035), set: (o) => o.rotateX(-0.1) } }, L: holdMag('newMag') },
    G: { gun: { ...REL, p: [0.055, 0.008, -0.42] }, state: { magVis: false }, R: Rh, props: { newMag: magAt(L * 0.55) }, L: holdMag('newMag') },
    H: { gun: { p: [0.056, 0.016, -0.42], r: [0.56, 0.05, -0.74] }, state: { magVis: false, charge: 1 }, R: Rh, props: { newMag: magAt(L) }, L: slap },
    I: { gun: { p: [0.04, -0.055, -0.4], r: [0.22, 0.22, 0.5] }, state: { charge: 1 }, R: Rh, L: { at: 'Lrack', off: { p: [0, -0.004, 0.02] }, grip: 'rack', elbow: [-0.25, -0.35, -0.05] } },
    J: { gun: { p: [0.07, -0.055, -0.38], r: [0.08, 0.32, -0.05] }, R: Rh, L: { at: { cam: 'Lrack', dp: [-0.1, -0.13, 0.07], dr: [0.3, 0.2, 0.3] }, grip: 'relaxed', elbow: [-0.25, -0.45, 0.0] } },
    K: { gun: { p: [0.095, -0.058, -0.395], r: [0.03, 0.3, 0.1] }, R: Rh },
    L: { gun: ADS, R: Rads, L: Lads },
    M: { gun: { p: [0, -gun.sightY + 0.004, -0.335], r: [0.12, 0, 0.02] }, state: { trigger: 1 }, R: { ...Rads, grip: 'pistolFire' }, L: Lads, light: 1 },
    N: { gun: { p: [0, -gun.sightY + 0.001, -0.355], r: [0.03, 0, 0.005] }, R: Rads, L: Lads },
    O: { gun: { p: [0.045, -0.035, -0.38], r: [0.03, 0.15, 0.07] }, R: { at: 'R', grip: 'pistol', elbow: [0.25, -0.48, -0.1] },
      L: { at: { mix: [{ cam: 'Lsup', dp: [-0.06, -0.07, 0.04] }, 'Lsup', 0.55] }, grip: { mix: ['relaxed', 'support', 0.6] }, elbow: [-0.2, -0.45, -0.1] } },
    P: { gun: { p: [0.1, -0.1, -0.38], r: [-0.55, 0.65, 0.5] }, R: { at: 'R', grip: 'pistol', elbow: [0.3, -0.45, 0.0] } },
  };
  const light = new THREE.PointLight(0xc890ff, 0, 0.6, 2);
  vm.root.add(light);
  const pose = (k) => { const p = P[k]; vm.pose(p); light.intensity = (p.light ?? 0) * 0.45; light.position.copy(worldPos(gun.anchors.muzzle)).add(new THREE.Vector3(0, 0.03, 0.03)); };
  const frames = [...'ABCDEFGHIJKLMNOP'].map((f) => ({ name: `ASTG${f}0`, key: f }));
  const purple = { color: [190, 120, 255], core: [245, 225, 255] };
  frames.push(flashFrame('ASTGX0', () => pose('B'), gun, { len: 110, width: 70, seed: 21, prongs: 4, ...purple }));
  frames.push(flashFrame('ASTGY0', () => pose('M'), gun, { len: 50, width: 90, endOn: 1, seed: 23, prongs: 6, ...purple }));
  await hud(F, { model: { root: vm.root, pose }, frames, fov: FOV, env: 'alien' });
}
