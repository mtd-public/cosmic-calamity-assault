// SMG9: MP5-style submachine gun HUD frames (see lib/wpn/riflepose.js for the frame map).
import { makeSMG } from '../lib/wpn/rifles.js';
import { renderRifle } from '../lib/wpn/riflepose.js';
export default async function (F) {
  const gun = makeSMG();
  await renderRifle(F, gun, { hip: { p: [0.1, -0.085, -0.42], r: [0.05, 0.18, 0.09] }, adsDist: 0.26, eject: [0.03, 0.03, -0.04], caseL: 0.019, chargePull: 1, kick: 0.7, flashLen: 130, flashW: 65 });
}
