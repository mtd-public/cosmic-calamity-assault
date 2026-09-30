// Magazine-fed long guns: SMG9 (MP5-style), ARFL (M4 with a red dot), BRFL
// (SR-25-style DMR with a 3-9x scope). Gun space: bore along -Z, +Y up,
// origin on the pistol-grip top (web of the hand). Profiles are (u = -z, v = y).
// Each returns { root, parts, anchors, sightY, makeMag(), magHold, set() }.
import { THREE, mat, glow, extrude, rbox, cylZ, latheZ, put, group, fillet, V3, torus, rrect, arc } from './core.js';
import { loft } from './arm.js';
import { gripAnchor } from './pistol.js';
import { fistAnchor, basisQ, Q } from './vm.js';

const M = () => ({
  upper: mat('slide', { c: 0x2c2f33, rough: 0.4 }),
  lower: mat('alloy', { c: 0x26282b }),
  parts: mat('darksteel'),
  steel: mat('steel'),
  poly: mat('polymer', { c: 0x17181a, rough: 0.55, env: 0.45 }),
  grip: mat('polymerGrip', { c: 0x18191b, env: 0.5 }),
  black: mat('black'),
});

// Picatinny rail along -Z from z0 to z1 at height y (top of the rail).
function rail(parent, m, y, z0, z1, w = 0.021) {
  put(parent, new THREE.Mesh(extrude([[-w / 2, -0.004], [w / 2, -0.004], [w / 2 + 0.002, -0.0015], [w / 2 - 0.001, 0.0], [-w / 2 + 0.001, 0.0], [-w / 2 - 0.002, -0.0015]], [z1, z0], { axis: 'z', bevel: 0.0004 }), m), [0, y, 0]);
  for (let z = z1 + 0.004; z < z0 - 0.003; z += 0.01) put(parent, new THREE.Mesh(rbox(w + 0.006, 0.0022, 0.005, 0.0005), mat('black')), [0, y - 0.0005, z + 0.0025]);
}
// Curved box magazine: top at the origin, body down -Y, curving toward -Z.
function curvedMag({ len = 0.19, w = 0.023, d = 0.062, curve = 0.035, ribs = true, base = 0.006, m, baseM }) {
  const g = new THREE.Group();
  const sec = [];
  const N = 12;
  const zc = (t) => -curve * t * t;
  for (let i = 0; i <= N; i++) { const t = i / N; sec.push({ p: [0, -len * t, zc(t)], w, h: d * (1 - 0.06 * t), e: 3.4, up: [0, 0, -1] }); }
  put(g, new THREE.Mesh(loft(sec, { radial: 32, up: [0, 0, -1] }), m));
  if (ribs) for (let i = 1; i < 5; i++) { const t = 0.15 + i * 0.16; put(g, new THREE.Mesh(loft([{ p: [0, -len * t, zc(t)], w: w + 0.0016, h: d * (1 - 0.06 * t) * 0.72, e: 3.4 }, { p: [0, -len * t - 0.004, zc(t + 0.02)], w: w + 0.0016, h: d * (1 - 0.06 * t) * 0.72, e: 3.4 }], { radial: 32, up: [0, 0, -1] }), m)); }
  // follower + top round (brass, bullet toward -Z)
  put(g, new THREE.Mesh(cylZ(0.0045, 0.0045, -d * 0.35, d * 0.3, 14), mat('brass')), [0, 0.003, 0]);
  put(g, new THREE.Mesh(latheZ([[0.0045, -d * 0.35], [0.003, -d * 0.45], [0.0005, -d * 0.52]], 14), mat('copper')), [0, 0.003, 0]);
  // baseplate
  const t = 1;
  put(g, new THREE.Mesh(rbox(w + 0.004, base, d * 0.98, 0.002), baseM || m), [0, -len - base / 2 + 0.001, zc(t)], [-Math.atan(2 * curve / len), 0, 0]);
  g.userData.len = len; g.userData.bottom = V3(0, -len - base, zc(1));
  return g;
}

// ---------------------------------------------------------------- common AR-style receiver set
function arBody(root, m, o) {
  const s = o.scale || 1;
  const S = (v) => v * s;
  // lower receiver (grip/trigger/magwell)
  const lower = fillet([[S(-0.058), S(0.0)], [S(0.175), S(0.0)], [S(0.178), S(-0.012)], [S(0.168), S(-0.05)], [S(0.106), S(-0.052)], [S(0.1), S(-0.022)], [S(0.02), S(-0.02)], [S(-0.02), S(-0.024)], [S(-0.05), S(-0.02)], [S(-0.06), S(-0.008)]], [0, 0.002, 0.004, 0.004, 0.003, 0.004, 0.004, 0.006, 0.006, 0.004], 3);
  put(root, new THREE.Mesh(extrude(lower, S(0.027), { bevel: 0.002 }), m.lower), [0, 0, 0]);
  // trigger guard (bar) + trigger
  put(root, new THREE.Mesh(extrude(fillet([[S(0.096), S(-0.022)], [S(0.1), S(-0.03)], [S(0.095), S(-0.043)], [S(0.02), S(-0.044)], [S(0.015), S(-0.038)], [S(0.02), S(-0.036)], [S(0.09), S(-0.035)], [S(0.092), S(-0.022)]], 0.003, 2), S(0.012), { bevel: 0.001 }), m.lower));
  const trigger = group(root, [0, S(-0.02), S(-0.058)]);
  put(trigger, new THREE.Mesh(extrude(fillet([[0, 0], [0.004, 0], [0.006, -0.01], [0.003, -0.016], [0, -0.015], [0.002, -0.009], [-0.002, -0.002]], 0.001, 2), 0.005, { bevel: 0.001 }), m.parts));
  // magwell flare + bolt catch + mag release + selector
  put(root, new THREE.Mesh(rbox(S(0.03), S(0.006), S(0.075), 0.002), m.lower), [0, S(-0.051), S(-0.137)]);
  put(root, new THREE.Mesh(rbox(0.003, S(0.012), S(0.016), 0.001), m.parts), [S(-0.0145), S(-0.006), S(-0.095)]);
  put(root, new THREE.Mesh(cylZ(0.004, 0.004, -0.002, 0.002, 12), m.parts), [S(0.0145), S(-0.012), S(-0.085)], [0, Math.PI / 2, 0]);
  put(root, new THREE.Mesh(extrude(fillet([[0, 0.003], [0.014, 0.001], [0.014, -0.002], [0, -0.004]], 0.001, 2), 0.003, { bevel: 0.0008 }), m.parts), [S(-0.0148), S(-0.008), S(-0.01)]);
  // upper receiver
  const upper = fillet([[S(-0.058), S(0.0)], [S(0.19), S(0.0)], [S(0.19), S(0.045)], [S(-0.058), S(0.045)]], [0.002, 0.002, 0.004, 0.004], 2);
  put(root, new THREE.Mesh(extrude(upper, S(0.026), { bevel: 0.003 }), m.upper));
  rail(root, m.upper, S(0.052), S(0.055), S(-0.19));
  put(root, new THREE.Mesh(rbox(S(0.018), S(0.008), S(0.245), 0.002), m.upper), [0, S(0.047), S(-0.066)]);
  // ejection port + dust cover + forward assist + brass deflector (right side)
  put(root, new THREE.Mesh(rbox(0.002, S(0.018), S(0.05), 0.001), m.black), [S(0.0132), S(0.028), S(-0.045)]);
  const bolt = put(root, new THREE.Mesh(rbox(0.003, S(0.014), S(0.03), 0.001), m.steel), [S(0.0125), S(0.028), S(-0.04)]);
  put(root, new THREE.Mesh(rbox(0.0015, S(0.017), S(0.052), 0.0008), m.upper), [S(0.0145), S(0.012), S(-0.045)]);
  put(root, new THREE.Mesh(cylZ(0.006, 0.006, S(0.0), S(0.03), 16), m.parts), [S(0.017), S(0.036), S(0.0)]);
  put(root, new THREE.Mesh(rbox(S(0.008), S(0.012), S(0.016), 0.003), m.upper), [S(0.015), S(0.042), S(0.02)]);
  // charging handle (rear top, slides +Z)
  const charge = group(root); charge.name = 'charge';
  put(charge, new THREE.Mesh(rbox(S(0.012), S(0.008), S(0.05), 0.002), m.parts), [0, S(0.049), S(0.05)]);
  put(charge, new THREE.Mesh(rbox(S(0.04), S(0.008), S(0.012), 0.003), m.parts), [0, S(0.049), S(0.075)]);
  // buffer tube (in line with the bore) + castle nut
  put(root, new THREE.Mesh(cylZ(S(0.0145), S(0.0145), S(0.058), S(0.058) + o.tube, 28), m.lower), [0, o.bore, 0]);
  put(root, new THREE.Mesh(cylZ(S(0.017), S(0.017), S(0.058), S(0.068), 12), m.parts), [0, o.bore, 0]);
  // pistol grip (A2, finger nub)
  const gTop = V3(0, S(-0.018), S(0.02)), gBot = V3(0, S(-0.112), S(0.052));
  const gs = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; const p = gTop.clone().lerp(gBot, t); gs.push({ p: [p.x, p.y, p.z], w: S(0.03) + 0.003 * Math.sin(t * Math.PI), h: S(0.047) - 0.004 * t, e: 2.4, off: [0, 0.004 * Math.exp(-((t - 0.45) ** 2) / 0.01)] }); }
  put(root, new THREE.Mesh(loft(gs, { radial: 32, up: [0, 0, -1], cap1: 'flat' }), m.grip));
  return { trigger, bolt, charge, gTop, gBot };
}

export function makeAR() {
  const root = new THREE.Group(); root.name = 'ARFL';
  const m = M();
  const bore = 0.03;
  const b = arBody(root, m, { tube: 0.2, bore });
  // M4 handguard (round, ribbed, vented) + delta ring + gas block/front sight base (cut for the optic: low gas block)
  put(root, new THREE.Mesh(latheZ([[0.017, -0.19], [0.022, -0.196], [0.022, -0.2]], 32), m.upper), [0, bore, 0]);
  const hg = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; hg.push({ p: [0, bore - 0.002, -0.2 - t * 0.17], w: 0.046, h: 0.048, e: 2.1 }); }
  put(root, new THREE.Mesh(loft(hg, { radial: 36, r: (th, i) => 1 + 0.04 * Math.max(0, Math.cos(th * 6)) * (i % 2 ? 1 : 0.4) }), m.poly));
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0028, 10), m.black), [sx * 0.0232, bore + 0.006, -0.215 - i * 0.026], [0, sx * Math.PI / 2, 0]);
  put(root, new THREE.Mesh(cylZ(0.0095, 0.0095, -0.37, -0.53, 24), m.parts), [0, bore, 0]);
  put(root, new THREE.Mesh(rbox(0.024, 0.026, 0.028, 0.003), m.parts), [0, bore + 0.004, -0.39]);
  // A2 front sight post
  put(root, new THREE.Mesh(extrude([[0.38, 0.012], [0.4, 0.012], [0.396, 0.058], [0.386, 0.058]], 0.012, { bevel: 0.001 }), m.parts), [0, bore, 0]);
  put(root, new THREE.Mesh(rbox(0.003, 0.012, 0.003, 0.0006), m.parts), [0, bore + 0.064, -0.391]);
  // birdcage flash hider
  put(root, new THREE.Mesh(latheZ([[0.0095, -0.53], [0.0112, -0.535], [0.0112, -0.585], [0.0105, -0.587]], 24), m.parts), [0, bore, 0]);
  for (let i = 0; i < 5; i++) put(root, new THREE.Mesh(rbox(0.0025, 0.0232, 0.03, 0.0008), m.black), [0, bore, -0.566], [0, 0, i * 0.63]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0062, 16), m.bore || mat('bore')), [0, bore, -0.5872], [0, Math.PI, 0]);
  // collapsible stock (M4, extended two notches)
  const st = fillet([[-0.165, 0.052], [-0.26, 0.05], [-0.268, 0.042], [-0.268, -0.055], [-0.255, -0.062], [-0.2, -0.02], [-0.165, 0.01]], [0, 0.004, 0.004, 0.004, 0.01, 0.01, 0.004], 3);
  const stH = fillet([[-0.2, 0.012], [-0.245, 0.014], [-0.245, -0.03], [-0.235, -0.036]], 0.006, 2);
  put(root, new THREE.Mesh(extrude(st, 0.038, { bevel: 0.004, holes: [stH] }), m.poly));
  put(root, new THREE.Mesh(rbox(0.04, 0.12, 0.012, 0.004), mat('rubber')), [0, -0.005, 0.27]);
  // red dot (Aimpoint-style tube on a riser)
  const dotY = 0.098;
  put(root, new THREE.Mesh(rbox(0.024, 0.026, 0.05, 0.003), m.parts), [0, 0.066, -0.055]);
  put(root, new THREE.Mesh(latheZ([[0.0185, -0.12], [0.02, -0.114], [0.02, -0.02], [0.0175, -0.012], [0.0175, -0.004]], 40, 0, Math.PI * 2), m.upper), [0, dotY, 0]);
  put(root, new THREE.Mesh(latheZ([[0.0158, -0.12], [0.0158, -0.004]], 40), mat('black', { side: 'double' })), [0, dotY, 0]);
  put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.01, 16), m.upper), [0.02, dotY, -0.07], [0, 0, Math.PI / 2]);
  put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.01, 16), m.upper), [0, dotY + 0.02, -0.07]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0156, 32), mat('lensBlue', { opacity: 0.35 })), [0, dotY, -0.1]);
  const dot = put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0012, 16), glow(0xff2a1a, 1.6)), [0, dotY, -0.098]);
  // magazine (STANAG, curved)
  const makeMag = () => curvedMag({ len: 0.19, w: 0.024, d: 0.062, curve: 0.03, m: mat('alloy', { c: 0x33352f }), baseM: m.poly });
  const mag = group(root); mag.name = 'mag';
  const magBody = makeMag(); mag.add(magBody);
  const magTop = V3(0, 0.004, -0.135);
  magBody.position.copy(magTop);
  const anchors = commonAnchors(root, b, { magTop, fore: [0, bore - 0.004, -0.29], foreR: 0.024, muzzle: -0.588, bore, eject: [0.02, 0.03, -0.04], chargeAt: [-0.0155, -0.004, -0.095] });
  const gun = { root, parts: { mag, charge: b.charge, trigger: b.trigger, bolt: b.bolt }, anchors, sightY: dotY, name: 'ARFL', makeMag, magLen: 0.19, magHold: { p: [-0.024, -0.13, 0.078], q: Q(0, 0, Math.PI / 2) } };
  gun.set = stdSet(gun, magTop);
  gun.set();
  return gun;
}

export function makeBR() {
  const root = new THREE.Group(); root.name = 'BRFL';
  const m = M();
  const s = 1.08, bore = 0.032;
  const b = arBody(root, m, { tube: 0.2, bore, scale: s });
  // free-float handguard: long, octagonal-ish with slots, full-length top rail
  const hgP = rrect(0.05, 0.052, 0.012, 0, 0, 3);
  put(root, new THREE.Mesh(extrude(hgP, [-0.52, -0.205], { axis: 'z', bevel: 0.002 }), m.upper), [0, bore - 0.004, 0]);
  rail(root, m.upper, 0.058, -0.2, -0.5);
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.002, 0.009, 0.026, 0.001), m.black), [sx * 0.0252, bore - 0.004, -0.235 - i * 0.04]);
  put(root, new THREE.Mesh(cylZ(0.0118, 0.0105, -0.52, -0.72, 24), m.parts), [0, bore, 0]);
  // muzzle brake
  put(root, new THREE.Mesh(latheZ([[0.0105, -0.72], [0.0135, -0.722], [0.0135, -0.775], [0.012, -0.778]], 24), m.parts), [0, bore, 0]);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.004, 0.012, 0.008, 0.001), m.black), [sx * 0.012, bore, -0.735 - i * 0.014]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0072, 16), mat('bore')), [0, bore, -0.7782], [0, Math.PI, 0]);
  // fixed A2-style stock
  const st = fillet([[-0.06, 0.05], [-0.33, 0.056], [-0.345, 0.05], [-0.345, -0.08], [-0.33, -0.088], [-0.12, -0.02], [-0.06, -0.008]], [0, 0.006, 0.004, 0.004, 0.012, 0.03, 0.006], 3);
  put(root, new THREE.Mesh(extrude(st, 0.04, { bevel: 0.005, seg: 3 }), m.poly));
  put(root, new THREE.Mesh(rbox(0.042, 0.142, 0.014, 0.005), mat('rubber')), [0, -0.013, 0.352]);
  // scope: 30 mm tube, objective + eyepiece bells, turrets, rings
  const sY = 0.105;
  const sc = group(root, [0, sY, 0]);
  put(sc, new THREE.Mesh(latheZ([[0.021, 0.05], [0.0215, 0.044], [0.0215, 0.012], [0.019, 0.004], [0.0152, -0.012], [0.0152, -0.17], [0.019, -0.19], [0.026, -0.22], [0.027, -0.255], [0.0255, -0.262]], 48), m.upper));
  const cup1 = put(sc, new THREE.Mesh(latheZ([[0.021, 0.05], [0.0175, 0.05], [0.0175, 0.02]], 48), mat('rubber', { side: 'double' })));
  const glass = [put(sc, new THREE.Mesh(latheZ([[0.024, -0.262], [0.024, -0.2]], 48), mat('black', { side: 'double' }))),
    put(sc, new THREE.Mesh(new THREE.CircleGeometry(0.024, 40), mat('lensBlue')), [0, 0, -0.258], [0, Math.PI, 0]),
    put(sc, new THREE.Mesh(new THREE.CircleGeometry(0.0172, 40), mat('lensBlue')), [0, 0, 0.045])];
  const cup2 = put(sc, new THREE.Mesh(cylZ(0.0215, 0.0215, 0.018, 0.04, 48, true), mat('rubber', { side: 'double' })));
  cup1.userData.eyecup = cup2.userData.eyecup = true;
  for (const [x, y, rz] of [[0, 0.02, 0], [0.02, 0, -Math.PI / 2]]) {
    const t = group(sc, [x, y, -0.085], [0, 0, rz]);
    put(t, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 20), m.upper), [0, 0.0, 0]);
    put(t, new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.01, 24), mat('aluKnurl', { c: 0x2a2c30, rep: [4, 1] })), [0, 0.01, 0]);
  }
  put(sc, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 20), m.upper), [-0.02, 0, -0.085], [0, 0, Math.PI / 2]);
  for (const z of [-0.02, -0.14]) { put(sc, new THREE.Mesh(torus(0.0165, 0.004, Math.PI * 2, 32, 8), m.parts), [0, 0, z]); put(root, new THREE.Mesh(rbox(0.022, sY - 0.058 - 0.012, 0.014, 0.002), m.parts), [0, 0.058 + (sY - 0.058 - 0.012) / 2, z]); }
  // magazine (7.62, 20 rounds, nearly straight)
  const makeMag = () => curvedMag({ len: 0.15, w: 0.026, d: 0.074, curve: 0.012, m: mat('darksteel', { c: 0x2b2d30, rough: 0.4 }), baseM: m.poly });
  const mag = group(root); mag.name = 'mag';
  const magBody = makeMag(); mag.add(magBody);
  const magTop = V3(0, 0.004, -0.137 * s);
  magBody.position.copy(magTop);
  const anchors = commonAnchors(root, b, { magTop, fore: [0, bore - 0.004, -0.33], foreR: 0.027, muzzle: -0.779, bore, eject: [0.022, 0.032, -0.045], chargeAt: [-0.0165, -0.005, -0.1], scale: s });
  anchors.eyepiece = group(root, [0, sY, 0.05]);
  const gun = { root, parts: { mag, charge: b.charge, trigger: b.trigger, bolt: b.bolt, glass }, anchors, sightY: sY, eyeZ: 0.05, name: 'BRFL', makeMag, magLen: 0.15, magHold: { p: [-0.026, -0.115, 0.08], q: Q(0, 0, Math.PI / 2) } };
  gun.set = stdSet(gun, magTop);
  gun.set();
  return gun;
}

export function makeSMG() {
  const root = new THREE.Group(); root.name = 'SMG9';
  const m = M();
  const bore = 0.022;
  // receiver: stamped steel tube, rounded top, welded rail grooves
  const rP = [[-0.013, -0.004], [0.013, -0.004], [0.0135, 0.03], ...arc(0, 0.03, 0.0135, 0, Math.PI, 8), [-0.0135, 0.03]];
  put(root, new THREE.Mesh(extrude(rP, [-0.2, 0.06], { axis: 'z', bevel: 0.0015 }), m.upper));
  for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.0015, 0.004, 0.24, 0.0006), m.black), [sx * 0.0135, 0.036, -0.07]);
  // cocking tube over the barrel (front) + end cap
  put(root, new THREE.Mesh(cylZ(0.0115, 0.0115, -0.2, -0.33, 28), m.upper), [0, 0.034, 0]);
  put(root, new THREE.Mesh(latheZ([[0.0115, -0.33], [0.009, -0.336], [0.0001, -0.337]], 28), m.upper), [0, 0.034, 0]);
  // hooded front sight
  const fs = group(root, [0, 0.048, -0.305]);
  put(fs, new THREE.Mesh(extrude([...arc(0, 0.012, 0.012, 0, Math.PI, 10), [-0.012, 0.0], [-0.008, 0.0], ...arc(0, 0.012, 0.008, Math.PI, 0, 10), [0.008, 0.0], [0.012, 0.0]], [-0.01, 0.01], { axis: 'z', bevel: 0.0008 }), m.upper));
  put(fs, new THREE.Mesh(rbox(0.0025, 0.012, 0.004, 0.0006), m.parts), [0, 0.006, 0]);
  // drum rear sight
  const rs = group(root, [0, 0.052, 0.035]);
  put(rs, new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 24), m.parts), [0, 0, 0], [0, 0, Math.PI / 2]);
  put(rs, new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), m.black), [0, 0.0005, -0.0112], [0, Math.PI, 0]);
  put(rs, new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), m.black), [0, 0.0005, 0.0112]);
  for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.004, 0.02, 0.022, 0.001), m.upper), [sx * 0.012, 0.043, 0.035]);
  // barrel + 3-lug
  put(root, new THREE.Mesh(cylZ(0.0085, 0.0085, -0.33, -0.36, 20), m.parts), [0, bore - 0.014, 0]);
  put(root, new THREE.Mesh(latheZ([[0.0085, -0.36], [0.0105, -0.362], [0.0105, -0.38], [0.0075, -0.382]], 20), m.parts), [0, bore - 0.014, 0]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0048, 14), mat('bore')), [0, bore - 0.014, -0.3822], [0, Math.PI, 0]);
  // slim handguard under the tube
  const hs = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; hs.push({ p: [0, 0.004 - 0.006 * Math.sin(t * Math.PI), -0.2 - t * 0.125], w: 0.038, h: 0.036 + 0.01 * Math.sin(t * Math.PI), e: 2.3 }); }
  put(root, new THREE.Mesh(loft(hs, { radial: 32 }), m.poly));
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.002, 0.012, 0.016, 0.001), m.black), [sx * 0.0192, 0.004, -0.225 - i * 0.025]);
  // trigger group housing + pistol grip (polymer, one piece)
  const tgp = fillet([[-0.04, -0.004], [0.075, -0.004], [0.08, -0.018], [0.065, -0.04], [0.02, -0.042], [0.0, -0.022], [-0.04, -0.018]], [0, 0.003, 0.006, 0.006, 0.004, 0.006, 0.004], 3);
  const tgH = fillet([[0.058, -0.02], [0.05, -0.034], [0.025, -0.035], [0.015, -0.022]], 0.003, 2);
  put(root, new THREE.Mesh(extrude(tgp, 0.026, { bevel: 0.002, holes: [tgH] }), m.poly));
  const gTop = V3(0, -0.018, 0.022), gBot = V3(0, -0.108, 0.05);
  const gs = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; const p = gTop.clone().lerp(gBot, t); gs.push({ p: [p.x, p.y, p.z], w: 0.031 + 0.003 * Math.sin(t * Math.PI), h: 0.048 - 0.004 * t, e: 2.4 }); }
  put(root, new THREE.Mesh(loft(gs, { radial: 32, up: [0, 0, -1], cap1: 'flat' }), m.grip));
  const trigger = group(root, [0, -0.012, -0.04]);
  put(trigger, new THREE.Mesh(extrude(fillet([[0, 0], [0.004, 0], [0.006, -0.01], [0.003, -0.016], [0, -0.015], [0.002, -0.009], [-0.002, -0.002]], 0.001, 2), 0.005, { bevel: 0.001 }), m.parts));
  // selector (left) + mag release paddle
  put(root, new THREE.Mesh(extrude(fillet([[0, 0.004], [0.018, 0.001], [0.018, -0.003], [0, -0.005]], 0.001, 2), 0.003, { bevel: 0.0008 }), m.parts), [-0.0145, -0.012, 0.01]);
  put(root, new THREE.Mesh(rbox(0.014, 0.004, 0.01, 0.002), m.parts), [0, -0.02, -0.085]);
  // ejection port (right)
  put(root, new THREE.Mesh(rbox(0.002, 0.014, 0.034, 0.001), m.black), [0.0138, 0.022, -0.04]);
  const bolt = put(root, new THREE.Mesh(rbox(0.003, 0.01, 0.02, 0.001), m.steel), [0.0128, 0.022, -0.035]);
  // cocking handle (left, front; slides +Z)
  const charge = group(root); charge.name = 'charge';
  put(charge, new THREE.Mesh(rbox(0.024, 0.006, 0.008, 0.002), m.parts), [-0.022, 0.036, -0.27], [0, 0.35, 0]);
  put(charge, new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), m.parts), [-0.034, 0.036, -0.266]);
  // collapsed retractable stock: two rails along the receiver sides + butt plate
  // extended retractable stock: two rails from the receiver back to a curved butt plate
  for (const sx of [-1, 1]) put(root, new THREE.Mesh(rbox(0.004, 0.008, 0.32, 0.0015), m.parts), [sx * 0.017, 0.02, 0.13]);
  put(root, new THREE.Mesh(extrude(fillet([[-0.285, 0.045], [-0.3, 0.045], [-0.305, 0.0], [-0.3, -0.045], [-0.285, -0.045]], 0.006, 3), 0.046, { bevel: 0.003 }), mat('rubber')));
  // magazine (curved 9 mm)
  const makeMag = () => curvedMag({ len: 0.17, w: 0.021, d: 0.034, curve: 0.05, ribs: false, m: mat('darksteel', { c: 0x2a2c30 }), baseM: m.parts });
  const mag = group(root); mag.name = 'mag';
  const magBody = makeMag(); mag.add(magBody);
  const magTop = V3(0, -0.002, -0.11);
  magBody.position.copy(magTop);
  put(root, new THREE.Mesh(rbox(0.027, 0.03, 0.046, 0.004), m.upper), [0, -0.012, -0.108]);
  const b = { gTop, gBot, charge };
  const anchors = commonAnchors(root, b, { magTop, fore: [0, 0.004, -0.265], foreR: 0.021, muzzle: -0.383, bore: bore - 0.014, eject: [0.02, 0.022, -0.04], chargeAt: [-0.036, 0.036, -0.268] });
  const gun = { root, parts: { mag, charge, trigger, bolt }, anchors, sightY: 0.0525, name: 'SMG9', makeMag, magLen: 0.17, magHold: { p: [-0.02, -0.12, 0.062], q: Q(0, 0, Math.PI / 2) } };
  gun.set = stdSet(gun, magTop);
  gun.set();
  return gun;
}

function commonAnchors(root, b, o) {
  const s = o.scale || 1;
  const a = {};
  a.R = gripAnchor(root, b.gTop, b.gBot, { t: 0.3, halfW: 0.017 * s, halfD: 0.025 * s, roll: 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  const tun = [0, -0.0165 - o.foreR, -0.088];
  a.L = fistAnchor(root, { at: o.fore, axis: [0, 0, -1], back: [-0.45, -0.9, 0], side: -1, tunnel: tun });
  a.magwell = group(root, [o.magTop.x, o.magTop.y, o.magTop.z]);
  a.muzzle = group(root, [0, o.bore, o.muzzle]);
  a.eject = group(root, o.eject);
  // left palm flat on the gun's left side at chargeAt (bolt catch / cocking handle), fingers forward
  a.Lcharge = group(root, [o.chargeAt[0] - 0.012, o.chargeAt[1] - 0.004, o.chargeAt[2] + 0.062]);
  a.Lcharge.quaternion.copy(basisQ([0, 1, 0], [-1, 0, 0], [0, 0, 1]));
  return a;
}
function stdSet(gun, magTop) {
  return (s = {}) => {
    const { mag, charge, trigger, bolt } = gun.parts;
    mag.position.set(0, -(s.mag ?? 0), 0);
    mag.visible = s.magVis ?? true;
    charge.position.z = (s.charge ?? 0) * 0.06;
    trigger.rotation.x = -(s.trigger ?? 0) * 0.25;
    if (bolt) { if (bolt.userData.z0 == null) bolt.userData.z0 = bolt.position.z; bolt.position.z = bolt.userData.z0 + (s.bolt ?? 0) * 0.02; }
    if (gun.parts.glass) { gun.root.traverse((o) => { if (o.isMesh) o.visible = !s.scoped || !!o.userData.eyecup; }); for (const g of gun.parts.glass) g.visible = !s.scoped; if (!s.scoped) mag.visible = s.magVis ?? true; }
  };
}
