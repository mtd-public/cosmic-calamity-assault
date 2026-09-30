// SHOT: an 870-style pump shotgun in black synthetic furniture: pistol grip
// only (no stock: reads one-handed and mirrored), ribbed pump, bead sight,
// extended magazine tube.
// Gun space: bore along -Z, +Y up, origin on the grip top (web of the hand).
// Profiles are (u = forward = -z, v = y).
import { THREE, mat, glow, extrude, rbox, cylZ, latheZ, put, group, fillet, V3, torus } from './core.js';
import { loft } from './arm.js';
import { gripAnchor } from './pistol.js';
import { fistAnchor } from './vm.js';
import { makeCasing } from './common.js';

export const SHOT_SIGHT_Y = 0.0355; // the sight line (receiver-top groove to the bead)
export function makeShotgun() {
  const root = new THREE.Group(); root.name = 'SHOT';
  const blued = mat('slide', { c: 0x2f3236, rough: 0.34 });
  const poly = mat('polymer', { c: 0x161718, rough: 0.55, env: 0.45 });
  const grip = mat('polymerGrip', { c: 0x18191b, env: 0.5 });
  const steel = mat('steel');
  // receiver: side profile with a rounded top and a tapered rear
  const rec = fillet([[-0.045, -0.022], [0.175, -0.022], [0.178, -0.016], [0.178, 0.024], [0.172, 0.031], [-0.02, 0.031], [-0.045, 0.012]], [0.002, 0.002, 0.002, 0.004, 0.003, 0.008, 0.004], 3);
  put(root, new THREE.Mesh(extrude(rec, 0.031, { bevel: 0.0035, seg: 3 }), blued));
  // top groove (sight channel) and receiver flats
  put(root, new THREE.Mesh(rbox(0.004, 0.0015, 0.19, 0.0006), mat('black')), [0, 0.0312, -0.075]);
  // ejection port (right) with the bolt face visible
  put(root, new THREE.Mesh(rbox(0.0025, 0.022, 0.062, 0.001), mat('black')), [0.0152, 0.012, -0.075]);
  const bolt = put(root, new THREE.Mesh(rbox(0.004, 0.016, 0.03, 0.001), steel), [0.0132, 0.012, -0.055]); bolt.name = 'bolt';
  // loading port (bottom) and the shell lifter
  put(root, new THREE.Mesh(rbox(0.024, 0.002, 0.075, 0.001), mat('black')), [0, -0.0228, -0.085]);
  put(root, new THREE.Mesh(rbox(0.018, 0.0015, 0.06, 0.0006), mat('darksteel')), [0, -0.021, -0.085]);
  // trigger plate + guard (a profile with a hole)
  const tg = fillet([[-0.006, -0.02], [0.082, -0.02], [0.082, -0.028], [0.07, -0.05], [0.028, -0.052], [0.012, -0.046], [0.0, -0.04]], [0, 0, 0.004, 0.008, 0.006, 0.004, 0.002], 3);
  const tgHole = fillet([[0.064, -0.029], [0.057, -0.045], [0.03, -0.046], [0.02, -0.04], [0.02, -0.029]], 0.004, 3);
  put(root, new THREE.Mesh(extrude(tg, 0.018, { bevel: 0.0015, holes: [tgHole] }), mat('alloy')));
  const trigger = group(root, [0, -0.026, -0.045]);
  put(trigger, new THREE.Mesh(extrude(fillet([[0, 0], [0.004, 0], [0.006, -0.01], [0.003, -0.018], [0.0, -0.017], [0.002, -0.01], [-0.002, -0.002]], 0.001, 2), 0.005, { bevel: 0.001 }), mat('darksteel')));
  // safety (cross-bolt, rear of the guard) + slide release (front, left)
  put(root, new THREE.Mesh(cylZ(0.0035, 0.0035, -0.012, 0.012, 12), mat('darksteel')), [0, -0.024, -0.004], [0, Math.PI / 2, 0]);
  put(root, new THREE.Mesh(rbox(0.003, 0.004, 0.012, 0.001), mat('darksteel')), [-0.0095, -0.03, -0.07]);
  // barrel with a bead, magazine tube with a cap and swivel
  put(root, new THREE.Mesh(cylZ(0.0118, 0.0112, -0.176, -0.64, 32), blued), [0, 0.012, 0]);
  put(root, new THREE.Mesh(latheZ([[0.0112, -0.64], [0.0116, -0.641], [0.0116, -0.644], [0.0092, -0.645]], 32), steel), [0, 0.012, 0]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0093, 24), mat('bore')), [0, 0.012, -0.6452], [0, Math.PI, 0]);
  put(root, new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), mat('brass', { rough: 0.2 })), [0, SHOT_SIGHT_Y - 0.0018, -0.632]);
  put(root, new THREE.Mesh(rbox(0.003, 0.004, 0.012, 0.001), blued), [0, 0.0245, -0.632]);
  put(root, new THREE.Mesh(cylZ(0.0118, 0.0118, -0.176, -0.6, 28), blued), [0, -0.0118, 0]);
  put(root, new THREE.Mesh(latheZ([[0.012, -0.6], [0.013, -0.602], [0.013, -0.618], [0.009, -0.622], [0.0001, -0.622]], 28), mat('darksteel')), [0, -0.0118, 0]);
  put(root, new THREE.Mesh(torus(0.006, 0.0015, Math.PI * 2, 16, 6), mat('darksteel')), [0, -0.026, -0.61], [0, Math.PI / 2, 0]);
  // barrel clamp band
  put(root, new THREE.Mesh(rbox(0.028, 0.05, 0.012, 0.004), blued), [0, 0.0, -0.585]);
  // action bars (visible when the pump is back)
  for (const s of [-1, 1]) put(root, new THREE.Mesh(rbox(0.002, 0.005, 0.2, 0.0006), steel), [s * 0.0125, -0.006, -0.25]);
  // ---- pump (slides back along +Z)
  const pump = group(root); pump.name = 'pump';
  const ps = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, z = -0.235 - t * 0.16; ps.push({ p: [0, -0.012, z], w: 0.048 + 0.004 * Math.sin(t * Math.PI), h: 0.046 + 0.003 * Math.sin(t * Math.PI), e: 2.6 }); }
  put(pump, new THREE.Mesh(loft(ps, { radial: 36 }), poly));
  for (let i = 0; i < 9; i++) put(pump, new THREE.Mesh(loft([{ p: [0, -0.012, -0.262 - i * 0.012], w: 0.0535, h: 0.05, e: 2.6 }, { p: [0, -0.012, -0.267 - i * 0.012], w: 0.0535, h: 0.05, e: 2.6 }], { radial: 36 }), poly));
  put(pump, new THREE.Mesh(loft([{ p: [0, -0.012, -0.232], w: 0.05, h: 0.047, e: 2.6 }, { p: [0, -0.012, -0.229], w: 0.044, h: 0.041, e: 2.6 }], { radial: 36 }), poly));
  // ---- pistol grip (rubber, finger grooves) and short ribbed stock
  const gTop = V3(0, -0.02, 0.028), gBot = V3(0, -0.118, 0.06);
  const gs = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; const p = gTop.clone().lerp(gBot, t); gs.push({ p: [p.x, p.y, p.z], w: 0.031 + 0.004 * Math.sin(t * Math.PI), h: 0.052 - 0.004 * t + 0.003 * Math.sin(t * Math.PI * 3), e: 2.5, off: [0, 0.002 * Math.sin(t * Math.PI * 3)] }); }
  put(root, new THREE.Mesh(loft(gs, { radial: 36, up: [0, 0, -1], cap1: 'flat' }), grip));
  put(root, new THREE.Mesh(rbox(0.036, 0.008, 0.058, 0.003), poly), [0, gBot.y - 0.002, gBot.z + 0.002], [Math.atan2(-(gBot.z - gTop.z), -(gBot.y - gTop.y)) * -1, 0, 0]);
  // rear cap (pistol-grip-only receiver end)
  put(root, new THREE.Mesh(rbox(0.03, 0.03, 0.014, 0.006), poly), [0, 0.012, 0.047]);
  // ---- anchors
  const gAxis = gBot.clone().sub(gTop).normalize();
  const anchors = {};
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.3, halfW: 0.0175, halfD: 0.026, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  anchors.L = fistAnchor(pump, { at: [0, -0.012, -0.31], axis: [0, 0, -1], back: [-0.45, -0.9, 0], side: -1, tunnel: [0, -0.042, -0.088] });
  anchors.port = group(root, [0, -0.024, -0.085]);
  anchors.muzzle = group(root, [0, 0.012, -0.646]);
  anchors.eject = group(root, [0.02, 0.014, -0.075]);
  const gun = { root, parts: { pump, trigger, bolt }, anchors, gAxis, name: 'SHOT' };
  gun.set = (s = {}) => {
    pump.position.z = (s.pump ?? 0) * 0.085;
    bolt.position.z = -0.055 + (s.pump ?? 0) * 0.07;
    trigger.rotation.x = -(s.trigger ?? 0) * 0.25;
  };
  gun.set();
  return gun;
}
export const makeShell = () => makeCasing(0.0205, 0.066, 'shell');
