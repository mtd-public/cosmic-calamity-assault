// APSM: alien plasma SMG. No magazine: D-K is the heat vent (the side panels
// swing open on a glowing-hot core, then close). Other frames as the rifles.
import { makePlasmaSMG } from '../lib/wpn/alien.js';
import { renderRifle } from '../lib/wpn/riflepose.js';
export default async function (F) {
  const gun = makePlasmaSMG();
  await renderRifle(F, gun, {
    hip: { p: [0.1, -0.082, -0.46], r: [0.05, 0.18, 0.09] }, adsDist: 0.4, kick: 0.6, env: 'alien', supportGrip: 'wrap',
    lightColor: 0xc890ff, lightK: 0.5, flashLen: 120, flashW: 70, flashColor: [190, 120, 255], flashCore: [245, 225, 255],
    override(P, { HIP, Rh, add }) {
      const vent = (v, dp, dr) => ({ gun: { p: add(HIP.p, dp), r: add(HIP.r, dr) }, state: { vent: v }, R: Rh });
      P.D = vent(0.35, [-0.02, 0.02, 0], [0.15, 0.05, -0.35]);
      P.E = vent(1, [-0.035, 0.035, 0.0], [0.25, 0.08, -0.7]);
      P.F = vent(1, [-0.033, 0.038, 0.004], [0.28, 0.1, -0.74]);
      P.G = vent(1, [-0.036, 0.034, -0.002], [0.24, 0.07, -0.68]);
      P.H = vent(1, [-0.034, 0.036, 0.002], [0.27, 0.09, -0.72]);
      P.I = { ...vent(0.5, [-0.025, 0.03, 0], [0.2, 0.06, -0.5]), L: { at: 'Lcharge', grip: 'flat', elbow: [-0.25, -0.45, -0.1] } };
      P.J = vent(0, [-0.012, 0.015, 0], [0.1, 0.03, -0.25]);
      P.K = vent(0, [-0.004, 0.004, 0], [0.02, 0, -0.06]);
      delete P.B.props; delete P.C.props; // plasma: no brass
    },
  });
}
