// ASCT: alien Scatter shotgun HUD frames (same map as SHOT: D tilt, E-F energy
// pellets in (loop pair), G-H one-hand flick of the bone sleeve, I-K return).
// A hip, B-C fire, L-N ADS, O, P, X/Y (teal) as for the human guns.
import { THREE, hud, worldPos } from '../lib/wpn/core.js';
import { makeScatter, makeCell } from '../lib/wpn/alien.js';
import { Viewmodel, Q, basisQ } from '../lib/wpn/vm.js';
import { flashFrame, FOV } from '../lib/wpn/common.js';

export default async function (F) {
  const gun = makeScatter(); const SHOT_SIGHT_Y = gun.sightY;
  const vm = new Viewmodel({ gun });
  vm.addProp('shell', (() => { const c = makeCell(0.045, 0.009); c.rotation.x = 0; const g = new THREE.Group(); c.position.y = 0.0225; c.rotation.x = Math.PI / 2; g.add(c); return g; })());
  vm.addProp('hull', (() => { const g = new THREE.Group(); return g; })());
  const HIP = { p: [0.105, -0.08, -0.5], r: [0.05, 0.2, 0.1] };
  const ADS = { p: [0, -SHOT_SIGHT_Y, -0.3], r: [0, 0, 0] };
  const Rh = { at: 'R', grip: 'pistol', elbow: [0.3, -0.5, -0.1] };
  const Ra = { at: 'R', grip: 'pistol', elbow: [0.2, -0.4, -0.02] };
  const La = { at: 'L', grip: 'pump', elbow: [-0.16, -0.42, -0.3] };
  // shell load: the gun rolled right so the loading port faces the left hand
  const TILT = { p: [0.06, -0.06, -0.44], r: [0.25, 0.25, -0.95] };
  // left hand under the port, thumb pushing the shell up into it
  const loadHand = (push) => ({ at: 'port', off: { p: [-0.02 + push * 0.0, -0.075 + push * 0.02, 0.055], q: basisQ([0, 0, -1], [-1, 0, 0], [0, -1, 0]) }, grip: 'pinch', elbow: [-0.2, -0.5, -0.1] });
  const shellAt = (push) => ({ at: 'port', off: { p: [0, -0.028 + push * 0.02, 0.01 - push * 0.03], q: Q(0.35 * (1 - push), 0, 0) } });
  const P = {
    A: { gun: HIP, state: {}, R: Rh },
    B: { gun: { p: [0.105, -0.07, -0.41], r: [0.26, 0.19, 0.06] }, state: { trigger: 1 }, R: { ...Rh, grip: 'pistolFire' }, light: 1 },
    C: { gun: { p: [0.105, -0.08, -0.445], r: [0.11, 0.2, 0.09] }, state: {}, R: Rh },
    D: { gun: { p: [0.085, -0.07, -0.45], r: [0.18, 0.22, -0.45] }, state: {}, R: Rh },
    E: { gun: TILT, state: {}, R: Rh, props: { shell: shellAt(0) }, L: loadHand(0) },
    F: { gun: { ...TILT, p: [0.06, -0.058, -0.44] }, state: {}, R: Rh, props: { shell: shellAt(1) }, L: loadHand(1) },
    // one-hand pump flick: snap the gun down so the pump slides back, then up
    G: { gun: { p: [0.11, -0.11, -0.44], r: [-0.3, 0.22, 0.14] }, state: { pump: 1 }, R: Rh,
      props: { hull: { gun: true, p: [0.05, 0.05, -0.07], r: [0.4, 1.2, 0.8] } } },
    H: { gun: { p: [0.105, -0.075, -0.45], r: [0.16, 0.2, 0.08] }, state: { pump: 0 }, R: Rh,
      props: { hull: { gun: true, p: [0.14, 0.12, -0.03], r: [1.4, 2.0, 1.6] } } },
    I: { gun: { p: [0.09, -0.075, -0.45], r: [0.12, 0.22, -0.2] }, state: {}, R: Rh },
    J: { gun: { p: [0.1, -0.08, -0.455], r: [0.08, 0.21, 0.0] }, state: {}, R: Rh },
    K: { gun: { p: [0.105, -0.084, -0.46], r: [0.06, 0.2, 0.08] }, state: {}, R: Rh },
    L: { gun: ADS, state: {}, R: Ra, L: La },
    M: { gun: { p: [0, -SHOT_SIGHT_Y + 0.004, -0.27], r: [0.12, 0, 0.02] }, state: { trigger: 1 }, R: { ...Ra, grip: 'pistolFire' }, L: La, light: 1 },
    N: { gun: { p: [0, -SHOT_SIGHT_Y + 0.001, -0.29], r: [0.035, 0, 0.005] }, state: {}, R: Ra, L: La },
    O: { gun: { p: [0.05, -0.06, -0.38], r: [0.03, 0.1, 0.05] }, state: {}, R: Rh, L: { at: { mix: [{ cam: 'L', dp: [-0.04, -0.07, 0.04] }, 'L', 0.7] }, grip: 'pump', elbow: [-0.2, -0.46, -0.25] } },
    P: { gun: { p: [0.13, -0.15, -0.42], r: [-0.55, 0.55, 0.45] }, state: {}, R: { at: 'R', grip: 'pistol', elbow: [0.32, -0.45, 0.0] } },
  };
  const muzzleLight = new THREE.PointLight(0x90ffe8, 0, 0.8, 2);
  vm.root.add(muzzleLight);
  const pose = (k) => {
    const p = P[k];
    vm.pose(p);
    muzzleLight.intensity = p.light ? 0.6 : 0;
    muzzleLight.position.copy(worldPos(gun.anchors.muzzle)).add(new THREE.Vector3(0, 0.04, 0.05));
  };
  const frames = [...'ABCDEFGHIJKLMNOP'].map((f) => ({ name: `ASCT${f}0`, key: f }));
  frames.push(flashFrame('ASCTX0', () => pose('B'), gun, { len: 160, width: 140, seed: 27, prongs: 7, color: [90, 255, 220], core: [230, 255, 250] }));
  frames.push(flashFrame('ASCTY0', () => pose('M'), gun, { len: 70, width: 170, endOn: 1, seed: 29, prongs: 8, color: [90, 255, 220], core: [230, 255, 250] }));
  const ONLY = null;
  await hud(F, { model: { root: vm.root, pose }, frames: ONLY ? frames.filter((f) => ONLY.includes(f.name[4])) : frames, fov: FOV, env: 'alien' });
}
