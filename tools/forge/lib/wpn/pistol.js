// P9MM: a SIG-style 9 mm service pistol (gunmetal slide, black alloy frame,
// stippled polymer grips, exposed hammer, decocker). Real scale, metres.
// Gun space: bore along -Z, +Y up, origin on the bore axis above the grip.
// Profiles are (u = forward = -z, v = y).
import { THREE, mat, glow, extrude, rbox, cylZ, latheZ, put, group, fillet, arc, sphere, V3 } from './core.js';
import { loft } from './arm.js';

export function makePistol(o = {}) {
  const root = new THREE.Group(); root.name = 'P9MM';
  const M = { slide: mat('slide', { c: 0x41454c }), frame: mat('alloy'), ctrl: mat('darksteel'), grip: mat('polymerGrip'), steel: mat('steel'), black: mat('black'), bore: mat('bore') };

  // ---------------------------------------------------------------- slide (moves along +Z)
  const slide = group(root); slide.name = 'slide';
  const sp = fillet([[-0.029, -0.0105], [0.148, -0.0105], [0.1625, -0.002], [0.1625, 0.0135], [0.159, 0.0175], [-0.024, 0.0175], [-0.029, 0.013]], [0.001, 0.004, 0.002, 0.002, 0.002, 0.003, 0.001], 3);
  put(slide, new THREE.Mesh(extrude(sp, 0.0255, { bevel: 0.0026, seg: 3 }), M.slide));
  // front bevel band (a lighter chamfer near the muzzle reads the nose shape)
  // rear serrations: shallow ridges on both sides
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) {
    const r = new THREE.Mesh(rbox(0.0009, 0.021, 0.0016, 0.0004, 1), M.slide);
    put(slide, r, [s * 0.01285, 0.0035, 0.024 - i * 0.0029], [0, 0, 0]);
  }
  // front serrations (short)
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) put(slide, new THREE.Mesh(rbox(0.0008, 0.014, 0.0014, 0.0004, 1), M.slide), [s * 0.0128, 0.006, -0.128 - i * 0.0027]);
  // ejection port (right side + top): dark recess, barrel hood inside
  put(slide, new THREE.Mesh(rbox(0.012, 0.0032, 0.036, 0.0008), M.black), [0.0055, 0.0162, -0.018]);
  put(slide, new THREE.Mesh(rbox(0.0028, 0.013, 0.036, 0.0008), M.black), [0.0118, 0.0105, -0.018]);
  const hood = put(root, new THREE.Mesh(rbox(0.011, 0.012, 0.033, 0.0015), M.steel), [0.004, 0.009, -0.017]); hood.name = 'hood';
  // extractor (right)
  put(slide, new THREE.Mesh(rbox(0.0012, 0.004, 0.022, 0.0005), M.ctrl), [0.0131, 0.011, 0.008]);
  // sights: rear notch with two white dots, front post with a dot (tritium green)
  const rear = group(slide, [0, 0.0175, 0.016]);
  for (const s of [-1, 1]) put(rear, new THREE.Mesh(rbox(0.0062, 0.0068, 0.009, 0.0008), M.black), [s * 0.0052, 0.0034, 0]);
  put(rear, new THREE.Mesh(rbox(0.0176, 0.0022, 0.009, 0.0006), M.black), [0, 0.0011, 0]);
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.00125, 16), glow(0xc8ffb0, 1.0)); put(rear, d, [s * 0.0055, 0.0042, 0.00455]); }
  const front = group(slide, [0, 0.0175, -0.151]);
  put(front, new THREE.Mesh(rbox(0.0034, 0.0062, 0.0075, 0.0007), M.black), [0, 0.0031, 0]);
  put(front, new THREE.Mesh(rbox(0.009, 0.0016, 0.009, 0.0005), M.black), [0, 0.0006, 0]);
  { const d = new THREE.Mesh(new THREE.CircleGeometry(0.00115, 16), glow(0xb0ff9a, 1.1)); put(front, d, [0, 0.0041, 0.0038]); }
  // muzzle: barrel crown + bore, recoil spring guide rod end below
  put(root, new THREE.Mesh(latheZ([[0.0001, -0.1638], [0.0038, -0.1638], [0.0062, -0.1634], [0.0066, -0.1625], [0.0066, -0.150]], 32), M.steel), [0, 0, 0]);
  put(root, new THREE.Mesh(new THREE.CircleGeometry(0.0043, 24), M.bore), [0, 0, -0.1639], [0, Math.PI, 0]);
  put(slide, new THREE.Mesh(cylZ(0.0046, 0.0046, -0.1640, -0.160, 20), M.ctrl), [0, -0.0075, 0]);
  // cocking slide top flat line (subtle dark groove along the top edges)
  // ---------------------------------------------------------------- frame
  const frameOutline = fillet([
    [-0.041, -0.0118], [0.150, -0.0118], [0.150, -0.029], [0.089, -0.0295], [0.081, -0.036], [0.0795, -0.055], [0.072, -0.0615],
    [0.022, -0.0615], [0.013, -0.056], [0.009, -0.046], [-0.006, -0.050], [-0.030, -0.046], [-0.043, -0.032], [-0.047, -0.021], [-0.045, -0.0118],
  ], [0.001, 0.001, 0.002, 0.004, 0.003, 0.003, 0.006, 0.006, 0.004, 0.002, 0.002, 0.004, 0.004, 0.004, 0.002], 3);
  const guardHole = fillet([[0.0745, -0.0335], [0.0735, -0.0535], [0.068, -0.0575], [0.023, -0.0575], [0.0165, -0.0525], [0.0155, -0.036], [0.021, -0.0315], [0.066, -0.0315]], 0.004, 3);
  put(root, new THREE.Mesh(extrude(frameOutline, 0.0215, { bevel: 0.0018, seg: 2, holes: [guardHole] }), M.frame));
  // accessory rail slots under the dust cover
  for (let i = 0; i < 3; i++) put(root, new THREE.Mesh(rbox(0.018, 0.0018, 0.0035, 0.0005), M.black), [0, -0.0292, -0.105 - i * 0.012]);
  put(root, new THREE.Mesh(rbox(0.0232, 0.0035, 0.056, 0.0012), M.frame), [0, -0.0285, -0.118]);
  // trigger guard front serrations
  for (let i = 0; i < 5; i++) put(root, new THREE.Mesh(rbox(0.012, 0.0009, 0.0012, 0.0003), M.frame), [0, -0.039 - i * 0.003, -0.0805]);
  // ---------------------------------------------------------------- grip
  // centreline from under the frame down and back (16° rake)
  const gTop = V3(0, -0.036, 0.012), gBot = V3(0, -0.131, 0.041);
  const gAxis = gBot.clone().sub(gTop).normalize();
  const gsec = (t, w, h, e = 2.4, off = 0) => { const p = gTop.clone().lerp(gBot, t); return { p: [p.x, p.y, p.z], w, h, e, off: [0, off] }; };
  // frame core (front + back straps, alloy)
  put(root, new THREE.Mesh(loft([gsec(-0.05, 0.026, 0.05), gsec(0.3, 0.027, 0.053), gsec(0.7, 0.027, 0.052), gsec(1.0, 0.026, 0.05)], { radial: 32, up: [0, 0, -1] }), M.frame));
  // grip panels (wider, stippled polymer; they stop short of the front strap)
  const panel = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; panel.push(gsec(lerp(0.02, 0.985, t), 0.0325 + 0.0025 * Math.sin(t * Math.PI), 0.049 - 0.004 * t, 2.8, -0.0012)); }
  put(root, new THREE.Mesh(loft(panel, { radial: 40, up: [0, 0, -1] }), M.grip));
  // grip screws
  for (const s of [-1, 1]) for (const t of [0.18, 0.82]) {
    const p = gTop.clone().lerp(gBot, t);
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0012, 14), M.ctrl); sc.rotation.z = Math.PI / 2;
    put(root, sc, [s * 0.0175, p.y, p.z + 0.004], [0, 0, Math.PI / 2]);
  }
  // beavertail / tang highlight
  // ---------------------------------------------------------------- controls (left side)
  const L = -0.0118;
  // slide catch: a lever along the frame with a thumb pad
  put(root, new THREE.Mesh(extrude(fillet([[0.035, -0.0135], [0.068, -0.0135], [0.068, -0.0175], [0.012, -0.0205], [0.008, -0.017], [0.012, -0.0135]], 0.001, 2), 0.0022, { bevel: 0.0006 }), M.ctrl), [L - 0.001, 0, 0]);
  // decocker: lever below the slide catch, behind the trigger
  put(root, new THREE.Mesh(extrude(fillet([[0.004, -0.021], [0.016, -0.023], [0.018, -0.028], [0.003, -0.029], [-0.004, -0.026]], 0.0012, 2), 0.0024, { bevel: 0.0006 }), M.ctrl), [L - 0.0012, 0, 0]);
  // takedown lever (front)
  put(root, new THREE.Mesh(extrude(fillet([[0.078, -0.016], [0.090, -0.0165], [0.091, -0.021], [0.08, -0.023]], 0.001, 2), 0.002, { bevel: 0.0005 }), M.ctrl), [L - 0.001, 0, 0]);
  // magazine release button (behind the guard)
  put(root, new THREE.Mesh(rbox(0.004, 0.0085, 0.0075, 0.0015), M.ctrl), [L - 0.0006, -0.045, -0.006]);
  // pins
  for (const [z, y] of [[-0.058, -0.021], [-0.004, -0.018], [0.03, -0.022]]) put(root, new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.0226, 10), M.steel), [0, y, z], [0, 0, Math.PI / 2]);
  // ---------------------------------------------------------------- trigger
  const trigger = group(root, [0, -0.0305, -0.041]); trigger.name = 'trigger';
  put(trigger, new THREE.Mesh(extrude(fillet([[0.0, 0.0], [0.004, 0.0], [0.0075, -0.009], [0.006, -0.019], [0.001, -0.0235], [-0.0015, -0.0225], [0.002, -0.017], [0.0025, -0.009], [-0.002, -0.002]], 0.0012, 2), 0.0062, { bevel: 0.0012 }), M.ctrl));
  // ---------------------------------------------------------------- hammer (pivot at the rear of the frame)
  const hammer = group(root, [0, -0.0105, 0.0335]); hammer.name = 'hammer';
  put(hammer, new THREE.Mesh(extrude(fillet([[0.004, -0.004], [0.004, 0.012], [0.002, 0.0185], [-0.006, 0.020], [-0.0085, 0.017], [-0.004, 0.0145], [-0.004, -0.004]], 0.0012, 2), 0.009, { bevel: 0.001 }), M.ctrl));
  for (let i = 0; i < 3; i++) put(hammer, new THREE.Mesh(rbox(0.0094, 0.0008, 0.0026, 0.0003), M.black), [0, 0.0145 + i * 0.0018, 0.0068 - i * 0.0006]);
  // ---------------------------------------------------------------- magazine (slides along the grip axis)
  const MAGLEN = gBot.distanceTo(gTop) + 0.003;
  const mag = group(root); mag.name = 'mag';
  const magBody = makePistolMag(MAGLEN); mag.add(magBody);
  const magQ = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), gAxis);
  magBody.quaternion.copy(magQ); magBody.position.copy(gTop);
  mag.userData.axis = gAxis.clone();
  // ---------------------------------------------------------------- anchors
  const anchors = {};
  // right hand on the grip (see makeGripAnchor for the basis)
  anchors.R = gripAnchor(root, gTop, gBot, { t: 0.25, halfW: 0.0165, halfD: 0.025, roll: o.gripRoll ?? 0.2, palm: 0.0105, along: -0.078, sink: 0.002, shift: [0, 0, 0.004] });
  // left hand support (ADS): palm on the left of the grip over the right fingertips
  anchors.Lsup = gripAnchor(root, gTop, gBot, { t: 0.62, halfW: 0.0165, halfD: 0.025, roll: -0.15, palm: 0.0105, along: -0.075, sink: -0.012, side: -1, shift: [0, -0.006, -0.006] });
  // left hand racking the slide overhand (fingers over the top to the right side, heel on the left)
  anchors.Lrack = group(root, [-0.07, 0.03, 0.024]); anchors.Lrack.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, -0.2, 'YXZ')));
  anchors.muzzle = group(root, [0, 0, -0.166]);
  anchors.port = group(root, [0.012, 0.012, -0.018]);
  anchors.rearSight = group(root, [0, 0.0175 + 0.0062, 0.016]);
  anchors.frontSight = group(root, [0, 0.0175 + 0.0062, -0.151]);
  anchors.magBase = group(mag, [gBot.x, gBot.y - 0.004, gBot.z]);
  anchors.magwell = group(root, [gBot.x, gBot.y, gBot.z]); anchors.magwell.quaternion.copy(magQ);
  const parts = { slide, hammer, trigger, mag };
  const gun = { root, parts, anchors, gAxis, magQ, magLen: MAGLEN, name: 'P9MM' };
  // state setters
  gun.set = (s = {}) => {
    slide.position.z = s.slide ?? 0; hood.position.z = -0.017 + (s.slide ?? 0) * 0.9; hood.position.y = 0.009 - (s.slide ?? 0) * 0.08;
    hammer.rotation.x = (s.hammer ?? 1) * 0.72; // 1 = cocked (spur back)
    trigger.rotation.x = -(s.trigger ?? 0) * 0.25;
    const mo = s.mag ?? 0; mag.position.copy(gAxis).multiplyScalar(mo);
    mag.visible = s.magVis ?? true;
  };
  gun.set();
  return gun;
}
const lerp = (a, b, t) => a + (b - a) * t;

// A basis for a hand wrapped on a pistol grip whose axis (pointing down) is gAxis:
// the hand's X (toward the little finger) runs down the grip, its Y (back of
// the hand) faces right/back, its fingers (-Z) wrap forward. roll turns the
// back of the hand from facing right (0) toward facing back (π/2).
export function gripBasis(gAxis, roll = 0.6, side = 1) {
  const X = gAxis.clone().normalize().multiplyScalar(side);
  const right = V3(side, 0, 0), back = V3(0, 0, 1);
  let Y = right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(back, Math.sin(roll));
  Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z);
}
export function anchor(parent, p, basis) {
  const a = new THREE.Group(); a.position.set(...p);
  if (basis) a.quaternion.setFromRotationMatrix(basis);
  parent.add(a); return a;
}

// Place a wrist so a (flat-palmed) hand wraps a grip: the grip runs from gTop
// to gBot with an elliptical section (halfW across, halfD front-back). t: where
// along the grip the palm centre sits; roll: back of the hand from facing right
// (0) toward facing back; palm: palm half-thickness; along: palm centre offset
// from the wrist along the hand (-Z); sink: how far the palm presses in.
export function gripAnchor(parent, gTop, gBot, { t = 0.4, halfW = 0.016, halfD = 0.025, roll = 0.3, palm = 0.011, along = -0.05, sink = 0.003, fingerX = -0.008, side = 1, shift = [0, 0, 0] } = {}) {
  const gAxis = gBot.clone().sub(gTop).normalize();
  const B = gripBasis(gAxis, roll, side);
  const X = V3(), Y = V3(), Z = V3(); B.extractBasis(X, Y, Z);
  const c = gTop.clone().lerp(gBot, t);
  const sup = Math.hypot(halfW * Y.x, halfD * Y.z) ;
  const P = c.clone().addScaledVector(Y, sup + palm - sink);
  const wrist = P.clone().addScaledVector(X, -fingerX * side).addScaledVector(Z, -along).add(V3(...shift));
  return anchor(parent, [wrist.x, wrist.y, wrist.z], B);
}

// A loose 9 mm magazine: top (feed lips) at the origin, body down -Y, front
// (bullet noses) toward -Z. userData.anchors.hold = where a left wrist goes to
// hold it from below (index finger along the front), .slap = a flat palm under the baseplate.
export function makePistolMag(len = 0.102) {
  const g = new THREE.Group(); g.name = 'mag9';
  const steel = mat('darksteel', { c: 0x2b2d31, rough: 0.35 });
  const sec = (y, w, h, off = 0) => ({ p: [0, y, 0], w, h, e: 3.2, off: [0, off] });
  put(g, new THREE.Mesh(loft([sec(-0.001, 0.0205, 0.033, 0.0035), sec(-len, 0.0205, 0.033, 0.0035)], { radial: 28, up: [0, 0, -1] }), steel));
  // witness holes (left side)
  for (let i = 0; i < 5; i++) put(g, new THREE.Mesh(new THREE.CircleGeometry(0.0014, 10), mat('black')), [-0.0104, -0.028 - i * 0.013, 0.004], [0, -Math.PI / 2, 0]);
  for (let i = 0; i < 5; i++) put(g, new THREE.Mesh(new THREE.CircleGeometry(0.0014, 10), mat('black')), [0.0104, -0.028 - i * 0.013, 0.004], [0, Math.PI / 2, 0]);
  // feed lips + top round (copper nose toward -Z)
  put(g, new THREE.Mesh(rbox(0.0205, 0.004, 0.03, 0.001), steel), [0, -0.002, 0.002]);
  const round = group(g, [0, 0.0035, -0.004], [0.05, 0, 0]);
  put(round, new THREE.Mesh(latheZ([[0.0001, -0.029], [0.002, -0.027], [0.0035, -0.022], [0.0045, -0.017], [0.0048, -0.012], [0.0048, 0.0]], 16), mat('copper')), [0, 0, 0.012]);
  put(round, new THREE.Mesh(cylZ(0.0049, 0.0049, 0.0, 0.004, 16), mat('brass')), [0, 0, 0.012]);
  // baseplate (polymer, slightly wider, flared at the front)
  put(g, new THREE.Mesh(rbox(0.026, 0.0065, 0.049, 0.0022), mat('polymer')), [0, -len - 0.001, 0.0005]);
  const an = {};
  an.base = group(g, [0, -len - 0.005, 0]);
  g.userData.anchors = an; g.userData.len = len;
  return g;
}
