// P9MM: 9 mm pistol HUD frames (docs/ASSETS.md §2): A hip idle, B-C hip fire,
// D-K reload, L ADS, M-N ADS fire, O hip↔ADS, P lowered, X/Y muzzle flashes.
import { THREE, hud, worldPos } from '../lib/wpn/core.js';
import { makePistol, makePistolMag } from '../lib/wpn/pistol.js';
import { Viewmodel, Q, basisQ } from '../lib/wpn/vm.js';
import { makeCasing, flashFrame, FOV } from '../lib/wpn/common.js';

globalThis.WPN_ONLY = null;
export default async function (F) {
  const gun = makePistol();
  const vm = new Viewmodel({ gun });
  vm.addProp('newMag', makePistolMag(gun.magLen));
  vm.addProp('oldMag', makePistolMag(gun.magLen));
  vm.addProp('brass', makeCasing(0.0098, 0.019));
  const L = gun.magLen;

  // ---- placements (camera space: +X right, +Y up, -Z ahead; metres, radians YXZ)
  const HIP = { p: [0.1, -0.06, -0.4], r: [0.05, 0.3, 0.14] };
  const ADS = { p: [0, -0.0242, -0.35], r: [0, 0, 0] };
  const Rh = { at: 'R', grip: 'pistol', elbow: [0.3, -0.5, -0.1] };
  const Rads = { at: 'R', grip: 'pistol', elbow: [0.19, -0.42, -0.12] };
  const Lads = { at: 'Lsup', grip: 'support', elbow: [-0.19, -0.42, -0.12] };
  // left hand on a loose magazine (mag frame: top at origin, body -Y, front -Z)
  const holdMag = (prop, grip = 'pinch') => ({ at: { prop }, off: { p: [-0.02, -0.074, 0.058], q: Q(0, 0, Math.PI / 2) }, grip, elbow: [-0.15, -0.5, -0.1] });
  const slap = { at: { prop: 'newMag' }, off: { p: [-0.05, -L - 0.02, 0.008], q: basisQ([0, 0, -1], [0, -1, 0], [-1, 0, 0]) }, grip: 'cup', elbow: [-0.2, -0.45, -0.1] };
  const REL = { p: [0.055, 0.005, -0.42], r: [0.5, 0.05, -0.72] };   // reload hold: rolled right, nose up, magwell toward the left hand
  const RACK = { p: [0.04, -0.055, -0.4], r: [0.22, 0.22, 0.5] };  // rolled left (slide toward the left hand) to rack
  const magAt = (d) => ({ at: 'magwell', off: { p: [0, d, 0] } }); // mag top relative to the grip bottom (d = L: seated)
  const P = {
    A: { gun: HIP, state: { slide: 0, hammer: 1 }, R: Rh },
    B: { gun: { p: [0.1, -0.052, -0.37], r: [0.24, 0.29, 0.1] }, state: { slide: 0.028, hammer: 1.15, trigger: 1 }, R: { ...Rh, grip: 'pistolFire' },
      props: { brass: { gun: true, p: [0.045, 0.045, -0.005], r: [0.6, 0.2, 1.2] } }, light: 1 },
    C: { gun: { p: [0.1, -0.057, -0.39], r: [0.1, 0.3, 0.125] }, state: { slide: 0.006, hammer: 1 }, R: Rh,
      props: { brass: { gun: true, p: [0.09, 0.1, 0.02], r: [1.8, 0.5, 2.4] } } },
    // reload: tilt, drop the old mag, fetch a new one, seat it, rack
    D: { gun: { p: [0.08, -0.03, -0.41], r: [0.3, 0.18, -0.35] }, state: { slide: 0.03, mag: 0.012 }, R: Rh },
    E: { gun: REL, state: { slide: 0.03, magVis: false }, R: Rh,
      props: { oldMag: { ...magAt(-0.035), set: (o) => o.rotateX(0.25) }, newMag: { at: { cam: 'magwell', dp: [-0.07, -0.1, 0.05] }, set: (o) => o.rotateZ(0.4) } }, L: holdMag('newMag') },
    F: { gun: REL, state: { slide: 0.03, magVis: false }, R: Rh,
      props: { newMag: { ...magAt(-0.04), set: (o) => o.rotateX(-0.1) } }, L: holdMag('newMag') },
    G: { gun: { ...REL, p: [0.055, 0.008, -0.42] }, state: { slide: 0.03, magVis: false }, R: Rh,
      props: { newMag: magAt(L * 0.55) }, L: holdMag('newMag') },
    H: { gun: { p: [0.056, 0.016, -0.42], r: [0.56, 0.05, -0.74] }, state: { slide: 0.03, magVis: false }, R: Rh,
      props: { newMag: magAt(L) }, L: slap },
    I: { gun: RACK, state: { slide: 0.03 }, R: Rh, L: { at: 'Lrack', off: { p: [0, -0.004, 0.02] }, grip: 'rack', elbow: [-0.25, -0.35, -0.05] } },
    J: { gun: { p: [0.07, -0.055, -0.38], r: [0.08, 0.32, -0.05] }, state: { slide: 0 }, R: Rh, L: { at: { cam: 'Lrack', dp: [-0.1, -0.13, 0.07], dr: [0.3, 0.2, 0.3] }, grip: 'relaxed', elbow: [-0.25, -0.45, 0.0] } },
    K: { gun: { p: [0.095, -0.06, -0.395], r: [0.03, 0.3, 0.1] }, state: { slide: 0 }, R: Rh },
    L: { gun: ADS, state: { slide: 0 }, R: Rads, L: Lads },
    M: { gun: { p: [0, -0.02, -0.325], r: [0.13, 0, 0.02] }, state: { slide: 0.028, trigger: 1 }, R: { ...Rads, grip: 'pistolFire' }, L: Lads, light: 1 },
    N: { gun: { p: [0, -0.023, -0.343], r: [0.035, 0, 0.005] }, state: { slide: 0.006 }, R: Rads, L: Lads },
    O: { gun: { p: [0.045, -0.035, -0.38], r: [0.03, 0.15, 0.07] }, state: { slide: 0 }, R: { at: 'R', grip: 'pistol', elbow: [0.25, -0.48, -0.1] },
      L: { at: { mix: [{ cam: 'Lsup', dp: [-0.06, -0.07, 0.04] }, 'Lsup', 0.55] }, grip: { mix: ['relaxed', 'support', 0.6] }, elbow: [-0.2, -0.45, -0.1] } },
    P: { gun: { p: [0.1, -0.1, -0.38], r: [-0.55, 0.65, 0.5] }, state: { slide: 0 }, R: { at: 'R', grip: 'pistol', elbow: [0.3, -0.45, 0.0] } },
  };
  const muzzleLight = new THREE.PointLight(0xffc27a, 0, 0.6, 2);
  vm.root.add(muzzleLight);
  const pose = (k) => {
    const p = P[k];
    vm.pose(p);
    muzzleLight.intensity = p.light ? 1.2 : 0;
    muzzleLight.position.copy(worldPos(gun.anchors.muzzle)).add(new THREE.Vector3(0, 0.03, 0.02));
  };
  const frames = [...'ABCDEFGHIJKLMNOP'].map((f) => ({ name: `P9MM${f}0`, key: f }));
  frames.push(flashFrame('P9MMX0', () => pose('B'), gun, { len: 150, width: 70, seed: 3 }));
  frames.push(flashFrame('P9MMY0', () => pose('M'), gun, { len: 60, width: 90, endOn: 1, seed: 5 }));
  const ONLY = globalThis.WPN_ONLY || null;
  await hud(F, { model: { root: vm.root, pose }, frames: ONLY ? frames.filter((f) => ONLY.includes(f.name[4])) : frames, fov: FOV });
}
