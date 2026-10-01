// Standard frame set for magazine long guns (docs/ASSETS.md §2): A hip idle,
// B-C hip fire, D tilt, E mag out, F mag gone (new one coming), G new mag in,
// H seat (palm slap), I bolt catch / cocking handle, J-K return, L ADS,
// M-N ADS fire, O hip↔ADS, P lowered, X/Y muzzle flashes.
import { THREE, hud, worldPos } from './core.js';
import { Viewmodel, Q, basisQ } from './vm.js';
import { flashFrame, makeCasing, FOV } from './common.js';

const add = (a, b) => a.map((x, i) => x + (b[i] ?? 0));
export async function renderRifle(F, gun, o) {
  const vm = new Viewmodel({ gun });
  if (gun.makeMag) { vm.addProp('newMag', gun.makeMag()); vm.addProp('oldMag', gun.makeMag()); }
  vm.addProp('brass', makeCasing(o.caseD ?? 0.0095, o.caseL ?? 0.045));
  const HIP = o.hip;
  const ADS = o.ads ?? { p: [0, -gun.sightY, -(o.adsDist ?? 0.3)], r: [0, 0, 0] };
  const Rh = { at: 'R', grip: 'pistol', elbow: o.elbowHip ?? [0.3, -0.5, -0.1] };
  const Ra = { at: 'R', grip: 'pistol', elbow: o.elbowAdsR ?? [0.2, -0.4, 0.0] };
  const La = { at: 'L', grip: 'pump', elbow: o.elbowAdsL ?? [-0.18, -0.42, -0.28] };
  const REL = o.rel ?? { p: [0.07, -0.05, -0.45], r: [0.3, 0.15, -0.8] };
  const hold = (prop) => ({ at: { prop }, off: gun.magHold, grip: 'pinch', elbow: [-0.2, -0.5, -0.1] });
  const magAt = (d, dp) => (dp ? { at: { cam: { mix: ['magwell', 'magwell', 0], }, dp } } : { at: 'magwell', off: { p: [0, -d, 0] } });
  const slap = { at: { prop: 'newMag' }, off: { p: [-0.05, -(gun.magLen ?? 0.1) - 0.022, 0.012], q: basisQ([0, 0, -1], [0, -1, 0], [-1, 0, 0]) }, grip: 'cup', elbow: [-0.2, -0.45, -0.1] };
  const kick = o.kick ?? 1;
  const P = {
    A: { gun: HIP, R: Rh },
    B: { gun: { p: add(HIP.p, [0, 0.008 * kick, 0.028 * kick]), r: add(HIP.r, [0.11 * kick, -0.01, -0.02]) }, state: { trigger: 1, bolt: 1 }, R: { ...Rh, grip: 'pistolFire' },
      props: { brass: { gun: true, p: add(o.eject ?? [0.03, 0.04, -0.04], [0.02, 0.02, 0.01]), r: [0.5, 0.3, 1.2] } }, light: 1 },
    C: { gun: { p: add(HIP.p, [0, 0.003 * kick, 0.01 * kick]), r: add(HIP.r, [0.04 * kick, 0, -0.005]) }, state: { bolt: 0.3 }, R: Rh,
      props: { brass: { gun: true, p: add(o.eject ?? [0.03, 0.04, -0.04], [0.07, 0.07, 0.03]), r: [1.6, 0.8, 2.2] } } },
    D: { gun: { p: add(HIP.p, [-0.02, 0.02, 0.0]), r: [(HIP.r[0] + REL.r[0]) / 2, (HIP.r[1] + REL.r[1]) / 2, REL.r[2] * 0.5] }, state: { mag: 0.004 }, R: Rh },
    E: { gun: REL, state: { magVis: false }, R: Rh, props: { oldMag: { at: 'magwell', off: { p: [0, -0.06, 0] }, set: (m) => m.rotateX(0.15) } }, L: hold('oldMag') },
    F: { gun: REL, state: { magVis: false }, R: Rh, props: { newMag: { at: 'magwell', off: { p: [-0.02, -0.13, 0.03] }, set: (m) => m.rotateZ(-0.2) } }, L: hold('newMag') },
    G: { gun: { ...REL, p: add(REL.p, [0, 0.004, 0]) }, state: { magVis: false }, R: Rh, props: { newMag: { at: 'magwell', off: { p: [0, -0.035, 0] } } }, L: hold('newMag') },
    H: { gun: { p: add(REL.p, [0, 0.012, 0]), r: add(REL.r, [0.06, 0, -0.03]) }, state: { magVis: false }, R: Rh, props: { newMag: { at: 'magwell', off: { p: [0, 0, 0] } } }, L: slap },
    I: { gun: { p: add(REL.p, [0.01, 0.0, 0.0]), r: add(REL.r, [-0.05, 0.05, 0.25]) }, state: { charge: o.chargePull ?? 0 }, R: Rh, L: { at: 'Lcharge', grip: 'flat', elbow: [-0.25, -0.45, -0.1] } },
    J: { gun: { p: add(HIP.p, [-0.015, 0.015, 0.0]), r: add(HIP.r, [0.08, 0.02, -0.25]) }, R: Rh, L: { at: { cam: 'Lcharge', dp: [-0.08, -0.12, 0.06], dr: [0.3, 0.3, 0.2] }, grip: 'relaxed', elbow: [-0.3, -0.5, 0.0] } },
    K: { gun: { p: add(HIP.p, [-0.005, 0.004, 0]), r: add(HIP.r, [0.02, 0, -0.06]) }, R: Rh },
    L: { gun: ADS, state: { scoped: !!o.scope }, R: Ra, L: La },
    M: { gun: { p: add(ADS.p, [0, 0.003, 0.02 * kick]), r: add(ADS.r, [0.05 * kick, 0, 0.01]) }, state: { trigger: 1, bolt: 1, scoped: !!o.scope }, R: { ...Ra, grip: 'pistolFire' }, L: La, light: 1 },
    N: { gun: { p: add(ADS.p, [0, 0.001, 0.007 * kick]), r: add(ADS.r, [0.015 * kick, 0, 0.003]) }, state: { bolt: 0.3, scoped: !!o.scope }, R: Ra, L: La },
    O: { gun: o.mid ?? { p: [HIP.p[0] * 0.45, (HIP.p[1] + ADS.p[1]) / 2, (HIP.p[2] + ADS.p[2]) / 2], r: [HIP.r[0] * 0.5, HIP.r[1] * 0.45, HIP.r[2] * 0.5] }, R: Rh,
      L: { at: { mix: [{ cam: 'L', dp: [-0.04, -0.08, 0.04] }, 'L', 0.65] }, grip: 'pump', elbow: [-0.22, -0.48, -0.22] } },
    P: { gun: o.low ?? { p: add(HIP.p, [0.03, -0.07, 0.03]), r: [-0.5, HIP.r[1] + 0.4, 0.45] }, R: { ...Rh, elbow: [0.32, -0.45, 0.0] } },
  };
  if (o.override) o.override(P, { HIP, ADS, REL, Rh, Ra, La, add });
  if (!o.brass) { /* keep */ }
  if (o.scope) {
    // scoped ADS: the eye right behind the eyepiece; only the eyepiece ring shows (clear aperture)
    const eye = { p: [0, -gun.sightY, -(gun.eyeZ + (o.eyeDist ?? 0.052))], r: [0, 0, 0] };
    P.L.gun = eye; P.M.gun = { p: add(eye.p, [0, -0.002, 0.004]), r: [0.015, 0, 0.004] }; P.N.gun = { p: add(eye.p, [0, -0.001, 0.0015]), r: [0.005, 0, 0.001] };
    P.L.R = P.M.R = P.N.R = null; P.L.L = P.M.L = P.N.L = null; P.M.light = 0;
  }
  const muzzleLight = new THREE.PointLight(o.lightColor ?? 0xffc27a, 0, 0.8, 2);
  vm.root.add(muzzleLight);
  const pose = (k) => {
    const p = P[k];
    vm.pose(p);
    muzzleLight.intensity = p.light ? (o.lightK ?? 1.3) : 0;
    muzzleLight.position.copy(worldPos(gun.anchors.muzzle)).add(new THREE.Vector3(0, 0.04, 0.05));
  };
  const N = gun.name;
  const frames = [...'ABCDEFGHIJKLMNOP'].map((f) => ({ name: `${N}${f}0`, key: f }));
  frames.push(flashFrame(`${N}X0`, () => pose('B'), gun, { len: o.flashLen ?? 170, width: o.flashW ?? 80, seed: 11, prongs: 5, color: o.flashColor, core: o.flashCore }));
  frames.push(flashFrame(`${N}Y0`, () => pose('M'), gun, o.scope ? { len: 40, width: 260, endOn: 1, seed: 13, prongs: 7 } : { len: 70, width: 110, endOn: 1, seed: 13, prongs: 6, color: o.flashColor, core: o.flashCore }));
  const only = o.only;
  return hud(F, { model: { root: vm.root, pose }, frames: only ? frames.filter((f) => only.includes(f.name[4])) : frames, fov: FOV, env: o.env ?? 'studio' });
}
