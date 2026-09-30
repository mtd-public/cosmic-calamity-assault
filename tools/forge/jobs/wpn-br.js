// BRFL: DMR battle rifle with a 3-9x scope; L-N are the scoped view (only the
// eyepiece ring is drawn: its clear aperture is a circle ~90% of the screen half-height,
// centred, so the HUD's scope surround can match). See lib/wpn/riflepose.js.
import { makeBR } from '../lib/wpn/rifles.js';
import { renderRifle } from '../lib/wpn/riflepose.js';
export default async function (F) {
  const gun = makeBR();
  await renderRifle(F, gun, { hip: { p: [0.11, -0.11, -0.46], r: [0.05, 0.16, 0.09] }, scope: true, eyeDist: 0.045, eject: [0.035, 0.04, -0.05], caseD: 0.012, caseL: 0.051, kick: 1.1, flashLen: 200, flashW: 95 });
}
