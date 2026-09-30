// ARFL: M4-style assault rifle with a red dot (see lib/wpn/riflepose.js for the frame map).
import { makeAR } from '../lib/wpn/rifles.js';
import { renderRifle } from '../lib/wpn/riflepose.js';
export default async function (F) {
  const gun = makeAR();
  await renderRifle(F, gun, { hip: { p: [0.105, -0.1, -0.44], r: [0.05, 0.17, 0.09] }, adsDist: 0.28, eject: [0.03, 0.035, -0.045], caseL: 0.045, kick: 0.8, flashLen: 170, flashW: 80 });
}
