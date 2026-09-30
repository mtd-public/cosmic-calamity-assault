// Weapon models (world pickups, enemy hands and the first-person viewmodel).
//
// Every gun is built at real scale pointing down -z with the top of the pistol
// grip at the origin. Besides the meshes it returns named parts the animation
// system moves (magazine, slide, bolt, pump, charging handle, vent flaps) and
// attach nodes the IK hands follow:
//   grip   right hand (wrist position + palm orientation)
//   fore   left hand (foregrip / cupping the right hand)
//   mag    the detachable magazine, with mag.home = its seated position
//   port   ejection port (brass flies from here)
//   muzzle flash + tracer origin
import * as THREE from 'three';
import { GB, MAT, glowMat, basicGlow, emissiveMat, cboxGeo as cboxGeoM } from './models.js';
import { labelTex } from './textures.js';

const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, typeof mat === 'string' ? MAT(mat) : mat); m.castShadow = true; return m; };
function cboxGeo(mat, w, h, d, c = 0.05, uv = 'local') { const g = new GB(); g.cbox(mat, [-w / 2, -h / 2, -d / 2], [w / 2, h / 2, d / 2], c, uv); const m = g.meshes()[0]; m.matrixAutoUpdate = true; return m; }
const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const node = (x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

// Hand attach orientations (see rig.js makeHand for the hand's local frame):
//   right hand on a vertical grip: fingers forward, palm to the left
//   left hand under a handguard: palm up, fingers to the right
const R_GRIP = [Math.PI / 2 + 0.25, 0, 0];
const L_FORE = [0.25, -0.35, Math.PI / 2 + 0.1];
const L_CUP = [Math.PI / 2 + 0.1, 0.1, 0.4];

export function makeWeapon(id) {
  const g = new THREE.Group();
  const r = { group: g, muzzle: new THREE.Object3D(), parts: {} };
  const add = (m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  const box = (mat, w, h, d, x, y, z, c = 0.006, rx = 0, ry = 0, rz = 0, parent = g) => add(cboxGeo(mat, w, h, d, c), x, y, z, rx, ry, rz, parent);
  const tube = (mat, r0, r1, len, x, y, z, seg = 10, parent = g) => add(mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat), x, y, z, Math.PI / 2, 0, 0, parent);
  const side = (pts, width, mat, x = 0, y = 0, z = 0, parent = g) => { const gb = new GB(); gb.extrude(mat, pts, 'x', -width / 2, width / 2); const m = gb.meshes()[0]; m.matrixAutoUpdate = true; return add(m, x, y, z, 0, 0, 0, parent); };
  const grip = (x, y, z, rot = R_GRIP) => { r.grip = node(x, y, z, ...rot); g.add(r.grip); };
  const fore = (x, y, z, rot = L_FORE) => { r.fore = node(x, y, z, ...rot); g.add(r.fore); };
  const glowDot = (color, rad, x, y, z) => add(new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 6), emissiveMat(color, 2.5)), x, y, z);

  switch (id) {
    // ------------------------------------------------------------ M6-K sidearm
    case 'sidearm': {
      // lower frame + rail, angled grip with finger grooves, trigger guard
      box('gunmetal', 0.03, 0.03, 0.15, 0, 0.012, -0.075, 0.005);
      const gp = add(cboxGeo('black', 0.03, 0.115, 0.04, 0.008), 0, -0.058, 0.03, 0.22, 0, 0);
      for (let i = 0; i < 3; i++) box('gunmetal', 0.031, 0.006, 0.01, 0, -0.03 - i * 0.03, 0.012, 0.002, 0.22, 0, 0, gp.parent);
      box('gunmetal', 0.006, 0.006, 0.05, 0, -0.045, -0.045, 0.002); // guard bottom
      box('gunmetal', 0.006, 0.05, 0.006, 0, -0.022, -0.07, 0.002);
      box('black', 0.006, 0.03, 0.006, 0, -0.03, -0.045, 0.002, 0.3); // trigger
      // slide with serrations, port on the right, front + rear sights
      const slide = new THREE.Group(); g.add(slide); r.parts.slide = slide; slide.home = 0;
      box('gunmetal', 0.032, 0.034, 0.2, 0, 0.033, -0.09, 0.006, 0, 0, 0, slide);
      for (let i = 0; i < 5; i++) box('black', 0.034, 0.02, 0.003, 0, 0.033, 0.0 - i * 0.008, 0.001, 0, 0, 0, slide);
      box('black', 0.004, 0.012, 0.03, 0.016, 0.036, -0.06, 0.001, 0, 0, 0, slide); // ejection port
      box('black', 0.006, 0.01, 0.006, 0, 0.054, -0.18, 0.001, 0, 0, 0, slide); // front post
      box('black', 0.02, 0.008, 0.006, 0, 0.053, 0.0, 0.001, 0, 0, 0, slide); // rear sight
      tube('black', 0.011, 0.011, 0.04, 0, 0.026, -0.2, 8, slide); // barrel crown
      // 2x optic: a small reflex block on the slide with a lit lens
      box('gunmetal', 0.026, 0.02, 0.05, 0, 0.06, -0.02, 0.004, 0, 0, 0, slide);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), basicGlow(0x8fe0ff, 0.75)), 0, 0.06, 0.006, 0, 0, 0, slide);
      // magazine + baseplate
      const mag = new THREE.Group(); g.add(mag); r.mag = mag;
      box('black', 0.022, 0.1, 0.03, 0, 0, 0, 0.003, 0, 0, 0, mag);
      box('gunmetal', 0.026, 0.008, 0.036, 0, -0.052, 0.002, 0.002, 0, 0, 0, mag);
      mag.position.set(0, -0.06, 0.03); mag.rotation.x = 0.22; mag.home = mag.position.clone();
      r.port = node(0.02, 0.04, -0.06); g.add(r.port);
      r.muzzle.position.set(0, 0.026, -0.22);
      grip(0.012, -0.03, 0.055, [Math.PI / 2 + 0.2, 0, 0]);
      fore(-0.03, -0.055, 0.03, L_CUP);
      r.vm = { pos: [0.2, -0.3, -0.6], rot: [0, 0.04, 0], left: 'cup', kind: 'pistol' };
      break;
    }
    // ------------------------------------------------------------ MA7 assault rifle (bullpup)
    case 'rifle': {
      // receiver: side profile, stock behind the grip, carry handle on top
      side([[0.24, 0.0], [0.26, 0.09], [0.14, 0.13], [-0.02, 0.13], [-0.36, 0.11], [-0.4, 0.08], [-0.4, 0.02], [-0.3, 0.0], [0.06, 0.02]], 0.07, 'gunOlive', 0, 0.02, 0);
      side([[-0.02, 0.14], [0.04, 0.2], [0.18, 0.2], [0.2, 0.14]], 0.04, 'gunmetal', 0, 0.02, 0); // carry handle
      box('black', 0.05, 0.03, 0.34, 0, 0.19, -0.16, 0.006); // top rail
      for (let i = 0; i < 9; i++) box('gunmetal', 0.052, 0.006, 0.012, 0, 0.207, -0.02 - i * 0.034, 0.001);
      // ammo counter screen on the left of the handle
      const ct = labelTex('32', { w: 64, h: 32, bg: '#031014', fg: '#4fe3ff', font: 'bold 26px Oxanium, monospace' });
      const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.026), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false })), -0.021, 0.18, 0.1, 0, -Math.PI / 2, 0);
      scr.rotation.set(0, -Math.PI / 2, 0); r.counter = ct;
      // pistol grip + trigger guard + trigger
      add(cboxGeo('black', 0.034, 0.12, 0.045, 0.008), 0, -0.05, 0.02, 0.2, 0, 0);
      box('gunmetal', 0.008, 0.008, 0.07, 0, -0.045, -0.04, 0.002);
      box('black', 0.006, 0.03, 0.006, 0, -0.025, -0.045, 0.002, 0.3);
      // magazine behind the grip (bullpup), angled
      const mag = new THREE.Group(); g.add(mag); r.mag = mag;
      box('gunmetal', 0.04, 0.17, 0.06, 0, 0, 0, 0.005, 0, 0, 0, mag);
      for (let i = 0; i < 4; i++) box('black', 0.042, 0.004, 0.062, 0, -0.06 + i * 0.03, 0, 0.001, 0, 0, 0, mag);
      mag.position.set(0, -0.06, 0.13); mag.rotation.x = 0.12; mag.home = mag.position.clone();
      // barrel shroud with cooling slots, foregrip block, muzzle brake, flashlight
      tube('gunmetal', 0.032, 0.036, 0.3, 0, 0.1, -0.53, 10);
      for (let i = 0; i < 6; i++) box('black', 0.068, 0.006, 0.02, 0, 0.1, -0.42 - i * 0.03, 0.001);
      box('gunOlive', 0.064, 0.07, 0.16, 0, 0.06, -0.36, 0.01);
      tube('black', 0.014, 0.016, 0.06, 0, 0.1, -0.7, 8);
      for (let i = 0; i < 3; i++) box('black', 0.036, 0.004, 0.012, 0, 0.1, -0.69 + i * 0.016, 0.001);
      tube('gunmetal', 0.014, 0.014, 0.08, 0, 0.03, -0.42, 8);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), basicGlow(0xd8f0ff, 0.9)), 0, 0.03, -0.461);
      // charging handle (left side) + ejection port (right side)
      const charge = box('black', 0.03, 0.014, 0.03, -0.045, 0.12, -0.06, 0.003); r.parts.charge = charge; charge.home = charge.position.z;
      box('black', 0.004, 0.02, 0.05, 0.036, 0.11, 0.0, 0.001);
      r.port = node(0.04, 0.12, 0.0); g.add(r.port);
      // front sight post, sling loop
      box('black', 0.006, 0.02, 0.006, 0, 0.145, -0.6, 0.001);
      r.muzzle.position.set(0, 0.1, -0.74);
      grip(0.012, -0.03, 0.045);
      fore(-0.005, 0.005, -0.33);
      r.vm = { pos: [0.22, -0.33, -0.6], rot: [0, 0.1, 0], left: 'fore', kind: 'rifle' };
      break;
    }
    // ------------------------------------------------------------ BR-9 battle rifle
    case 'burst': {
      side([[0.3, 0.0], [0.32, 0.1], [0.2, 0.12], [0.02, 0.12], [-0.02, 0.05], [-0.34, 0.05], [-0.36, 0.11], [-0.2, 0.13], [0.0, 0.14], [0.06, 0.03]], 0.062, 'gunmetal', 0, 0.02, 0);
      box('black', 0.05, 0.03, 0.62, 0, 0.16, -0.06, 0.006); // full-length rail
      for (let i = 0; i < 14; i++) box('gunmetal', 0.052, 0.006, 0.012, 0, 0.177, 0.2 - i * 0.04, 0.001);
      add(cboxGeo('black', 0.034, 0.12, 0.045, 0.008), 0, -0.05, 0.02, 0.2, 0, 0);
      box('gunmetal', 0.008, 0.008, 0.07, 0, -0.045, -0.04, 0.002);
      box('black', 0.006, 0.03, 0.006, 0, -0.025, -0.045, 0.002, 0.3);
      // curved magazine in front of the grip
      const mag = new THREE.Group(); g.add(mag); r.mag = mag;
      box('gunmetal', 0.036, 0.15, 0.06, 0, 0, 0, 0.004, 0, 0, 0, mag);
      box('black', 0.038, 0.01, 0.062, 0, -0.078, 0.004, 0.001, 0, 0, 0, mag);
      mag.position.set(0, -0.05, -0.13); mag.rotation.x = -0.18; mag.home = mag.position.clone();
      // handguard + barrel + brake
      box('gunmetal', 0.06, 0.07, 0.24, 0, 0.07, -0.42, 0.01);
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) box('black', 0.004, 0.04, 0.03, sx * 0.03, 0.07, -0.34 - i * 0.05, 0.001);
      tube('black', 0.018, 0.02, 0.24, 0, 0.09, -0.66, 8);
      box('black', 0.03, 0.03, 0.05, 0, 0.09, -0.78, 0.004);
      // scope: tube, front + rear lenses, rings, side windage knob
      const sc = new THREE.Group(); g.add(sc); sc.position.set(0, 0.22, -0.06); r.scope = sc;
      tube('black', 0.024, 0.024, 0.2, 0, 0, 0, 12, sc);
      tube('black', 0.03, 0.026, 0.05, 0, 0, -0.12, 12, sc); tube('black', 0.028, 0.026, 0.04, 0, 0, 0.11, 12, sc);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), basicGlow(0x7fd8ff, 0.7)), 0, 0, 0.131, 0, 0, 0, sc);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.026, 14), basicGlow(0x7fd8ff, 0.35)), 0, 0, -0.146, Math.PI, 0, 0, sc);
      box('gunmetal', 0.02, 0.014, 0.014, 0.03, 0, -0.02, 0.002, 0, 0, 0, sc);
      for (const z of [-0.06, 0.06]) box('gunmetal', 0.04, 0.05, 0.016, 0, -0.03, z, 0.003, 0, 0, 0, sc);
      const charge = box('black', 0.024, 0.012, 0.03, -0.04, 0.1, -0.02, 0.003); r.parts.charge = charge; charge.home = charge.position.z;
      box('black', 0.004, 0.02, 0.05, 0.033, 0.1, 0.02, 0.001);
      r.port = node(0.04, 0.11, 0.02); g.add(r.port);
      r.muzzle.position.set(0, 0.09, -0.81);
      grip(0.012, -0.03, 0.045);
      fore(-0.005, 0.02, -0.4);
      r.vm = { pos: [0.22, -0.33, -0.58], rot: [0, 0.1, 0], left: 'fore', kind: 'rifle' };
      break;
    }
    // ------------------------------------------------------------ SG-12 breacher (pump shotgun)
    case 'shotgun': {
      side([[0.32, -0.08], [0.34, 0.06], [0.2, 0.1], [0.06, 0.1], [0.0, 0.12], [-0.18, 0.12], [-0.18, 0.04], [0.02, 0.02], [0.12, -0.02]], 0.058, 'gunmetal', 0, 0.02, 0);
      box('gunOlive', 0.06, 0.05, 0.14, 0, 0.09, -0.1, 0.008); // receiver top
      add(cboxGeo('black', 0.034, 0.11, 0.045, 0.008), 0, -0.045, 0.03, 0.25, 0, 0);
      box('gunmetal', 0.008, 0.008, 0.07, 0, -0.04, -0.04, 0.002);
      box('black', 0.006, 0.03, 0.006, 0, -0.022, -0.045, 0.002, 0.3);
      tube('gunmetal', 0.03, 0.03, 0.62, 0, 0.11, -0.5, 10); // barrel
      for (let i = 0; i < 7; i++) add(mesh(new THREE.TorusGeometry(0.032, 0.004, 4, 10), 'black'), 0, 0.11, -0.3 - i * 0.05); // heat shield rings
      tube('black', 0.022, 0.022, 0.56, 0, 0.055, -0.45, 8); // magazine tube
      const pump = new THREE.Group(); g.add(pump); r.parts.pump = pump; pump.position.set(0, 0.055, -0.36); pump.home = pump.position.z;
      tube('black', 0.04, 0.04, 0.16, 0, 0, 0, 10, pump);
      for (let i = 0; i < 5; i++) add(mesh(new THREE.TorusGeometry(0.041, 0.004, 4, 10), 'gunmetal'), 0, 0, -0.06 + i * 0.03, 0, 0, 0, pump);
      // shell saddle on the receiver's right, loading port underneath, bead
      for (let i = 0; i < 4; i++) tube('c_red', 0.01, 0.01, 0.06, 0.038, 0.09, -0.15 + i * 0.026, 6);
      for (let i = 0; i < 4; i++) tube('gunmetal', 0.011, 0.011, 0.012, 0.038, 0.09, -0.126 + i * 0.026, 6);
      r.port = node(0, 0.03, -0.08); g.add(r.port);
      r.eject = node(0.035, 0.1, -0.05); g.add(r.eject);
      glowDot(0xffd080, 0.005, 0, 0.145, -0.79);
      r.muzzle.position.set(0, 0.11, -0.82);
      grip(0.012, -0.03, 0.05);
      fore(-0.005, 0.02, -0.36);
      r.vm = { pos: [0.22, -0.33, -0.54], rot: [0, 0.1, 0], left: 'pump', kind: 'rifle' };
      break;
    }
    // ------------------------------------------------------------ Vyrr plasma caster
    case 'caster': {
      const body = add(mesh(lathe([[0.02, -0.2], [0.075, -0.13], [0.095, 0.0], [0.08, 0.12], [0.03, 0.2], [0.0, 0.22]], 12), 'vyrr'), 0, 0.06, -0.1, Math.PI / 2, 0, 0);
      body.scale.set(1, 1, 0.75);
      for (const s of [-1, 1]) add(mesh(new THREE.ConeGeometry(0.022, 0.2, 6), 'vyrr'), s * 0.05, 0.05, -0.3, -Math.PI / 2 + 0.1, 0, s * 0.25); // claws
      add(mesh(new THREE.ConeGeometry(0.018, 0.16, 6), 'vyrr'), 0, 0.11, -0.28, -Math.PI / 2 - 0.2, 0, 0);
      r.glow = glowDot(0x6cff9a, 0.03, 0, 0.065, -0.25);
      for (const s of [-1, 1]) { const v = box('vyrrGold', 0.03, 0.006, 0.09, s * 0.075, 0.09, -0.08, 0.002, 0, 0, s * 0.3); (r.vents ||= []).push({ m: v, side: s }); }
      add(mesh(lathe([[0.03, 0], [0.035, 0.04], [0.025, 0.11], [0.02, 0.13]], 8), 'scales'), 0, -0.07, 0.02, 0.3, 0, 0); // grip
      box('vyrrGold', 0.008, 0.028, 0.006, 0, -0.03, -0.04, 0.002, 0.3); // trigger spine
      r.muzzle.position.set(0, 0.065, -0.34);
      grip(0.012, -0.03, 0.05);
      fore(-0.05, -0.15, -0.05, L_CUP);
      r.vm = { pos: [0.21, -0.3, -0.58], rot: [0, 0.04, 0], left: 'rest', kind: 'pistol' };
      break;
    }
    // ------------------------------------------------------------ Vyrr pulse carbine
    case 'carbine': {
      const body = add(mesh(lathe([[0.02, -0.38], [0.07, -0.28], [0.085, 0.05], [0.06, 0.28], [0.02, 0.38]], 12), 'vyrr'), 0, 0.08, -0.2, Math.PI / 2, 0, 0);
      body.scale.set(1, 1, 0.8);
      for (const s of [-1, 1]) add(mesh(new THREE.ConeGeometry(0.028, 0.28, 6), 'vyrr'), s * 0.06, 0.08, -0.58, -Math.PI / 2, 0, 0);
      add(mesh(new THREE.ConeGeometry(0.02, 0.2, 6), 'vyrrGold'), 0, 0.14, -0.52, -Math.PI / 2, 0, 0);
      r.glow = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), emissiveMat(0x9b6bff, 3)), 0, 0.15, -0.2, Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const v = box('vyrrGold', 0.012, 0.03, 0.02, s * 0.08, 0.09, -0.05 - i * 0.06, 0.002); (r.vents ||= []).push({ m: v, side: s }); }
      add(mesh(lathe([[0.03, 0], [0.036, 0.04], [0.026, 0.12], [0.02, 0.14]], 8), 'scales'), 0, -0.08, 0.02, 0.3, 0, 0);
      add(mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10), 'vyrr'), 0, 0.02, -0.34, 0, 0, 0); // hand loop (foregrip)
      add(mesh(lathe([[0.04, 0], [0.05, 0.08], [0.03, 0.16]], 8), 'vyrrGold'), 0, 0.06, 0.2, -Math.PI / 2, 0, 0); // stock bulb
      r.muzzle.position.set(0, 0.08, -0.66);
      grip(0.012, -0.03, 0.05);
      fore(-0.005, 0.0, -0.34, [0.25, -0.2, Math.PI / 2 + 0.1]);
      r.vm = { pos: [0.22, -0.33, -0.6], rot: [0, 0.1, 0], left: 'fore', kind: 'rifle' };
      break;
    }
    // ------------------------------------------------------------ Vyrr shard needler
    case 'needler': {
      add(mesh(lathe([[0.02, -0.28], [0.09, -0.18], [0.1, 0.06], [0.06, 0.2], [0.02, 0.26]], 12), 'vyrr'), 0, 0.08, -0.12, Math.PI / 2, 0, 0);
      for (const s of [-1, 1]) add(mesh(new THREE.ConeGeometry(0.016, 0.14, 5), 'vyrrGold'), s * 0.04, 0.06, -0.36, -Math.PI / 2, 0, s * 0.3);
      const rack = new THREE.Group(); g.add(rack); r.mag = rack; rack.position.set(0, 0.16, -0.04); rack.home = rack.position.clone();
      box('vyrr', 0.06, 0.02, 0.24, 0, 0, 0, 0.004, 0, 0, 0, rack);
      const crystals = [];
      for (let i = 0; i < 10; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.09, 5), emissiveMat(0xff5fd2, 2));
        c.position.set(((i % 2) - 0.5) * 0.036, 0.04, 0.09 - Math.floor(i / 2) * 0.045); c.rotation.x = -0.35; rack.add(c); crystals.push(c);
      }
      r.crystals = crystals;
      add(mesh(lathe([[0.03, 0], [0.036, 0.04], [0.026, 0.12], [0.02, 0.14]], 8), 'scales'), 0, -0.07, 0.02, 0.3, 0, 0);
      box('vyrrGold', 0.008, 0.028, 0.006, 0, -0.03, -0.04, 0.002, 0.3);
      r.muzzle.position.set(0, 0.08, -0.42);
      grip(0.012, -0.03, 0.05);
      fore(-0.05, -0.15, -0.05, L_CUP);
      r.vm = { pos: [0.21, -0.3, -0.58], rot: [0, 0.04, 0], left: 'rest', kind: 'pistol' };
      break;
    }
    // ------------------------------------------------------------ Vyrr fuel lance
    case 'lance': {
      add(mesh(lathe([[0.05, -0.6], [0.1, -0.45], [0.115, 0.3], [0.08, 0.5], [0.04, 0.58]], 12), 'vyrr'), 0, 0.1, -0.2, Math.PI / 2, 0, 0);
      r.glow = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10, 1, true), basicGlow(0x7dff4f, 0.85)), 0, 0.18, -0.15, Math.PI / 2, 0, 0);
      for (let i = 0; i < 5; i++) add(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 10), 'vyrrGold'), 0, 0.1, -0.5 - i * 0.07); // muzzle cage
      for (let i = 0; i < 3; i++) add(mesh(new THREE.ConeGeometry(0.025, 0.2, 5), 'vyrr'), Math.cos(i * 2.1) * 0.09, 0.1 + Math.sin(i * 2.1) * 0.09, -0.85, -Math.PI / 2, 0, 0);
      const mag = new THREE.Group(); g.add(mag); r.mag = mag; mag.position.set(-0.11, 0.1, 0.05); mag.home = mag.position.clone();
      add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 10), 'vyrrGold'), 0, 0, 0, Math.PI / 2, 0, 0, mag);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.19, 8), emissiveMat(0x7dff4f, 2)), 0, 0, 0, Math.PI / 2, 0, 0, mag);
      add(mesh(lathe([[0.03, 0], [0.036, 0.04], [0.026, 0.12], [0.02, 0.14]], 8), 'scales'), 0, -0.07, 0.02, 0.3, 0, 0);
      add(mesh(lathe([[0.05, 0], [0.07, 0.12], [0.04, 0.24]], 8), 'vyrr'), 0, 0.06, 0.3, -Math.PI / 2, 0, 0); // shoulder rest
      add(mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10), 'vyrr'), 0, 0.0, -0.45);
      r.muzzle.position.set(0, 0.1, -0.9);
      grip(0.012, -0.03, 0.05);
      fore(-0.005, -0.02, -0.45, [0.25, -0.2, Math.PI / 2 + 0.1]);
      r.vm = { pos: [0.2, -0.33, -0.52], rot: [0, 0.1, 0], left: 'fore', kind: 'rifle' };
      break;
    }
    // ------------------------------------------------------------ MULE rotary chaingun (turret)
    case 'chaingun': {
      const barrels = new THREE.Group(); g.add(barrels); r.parts.barrels = barrels; barrels.position.set(0, 0.1, -0.5);
      for (let i = 0; i < 3; i++) tube('gunmetal', 0.02, 0.02, 0.8, Math.cos(i * 2.094) * 0.045, Math.sin(i * 2.094) * 0.045, 0, 8, barrels);
      tube('black', 0.075, 0.075, 0.06, 0, 0, 0.3, 10, barrels); tube('black', 0.075, 0.075, 0.06, 0, 0, -0.3, 10, barrels);
      box('gunOlive', 0.18, 0.2, 0.5, 0, 0.1, 0.1, 0.02);
      box('gunmetal', 0.22, 0.14, 0.2, 0.2, 0.06, 0.12, 0.015); // ammo can
      box('black', 0.03, 0.06, 0.16, 0, 0.16, 0.45, 0.005); // spade grips
      for (const s of [-1, 1]) tube('black', 0.014, 0.014, 0.12, s * 0.1, 0.18, 0.42, 8);
      r.muzzle.position.set(0, 0.1, -0.92);
      r.vm = null;
      break;
    }
    default: box('gunmetal', 0.06, 0.08, 0.5, 0, 0, 0);
  }
  if (!r.grip) grip(0.012, -0.03, 0.05);
  if (!r.fore) fore(0, 0, -0.3);
  g.add(r.muzzle);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return r;
}

// A grenade in a hand (the throw animation) and on the belt.
export function makeHeldGrenade(kind) {
  if (kind === 'frag') {
    const grp = new THREE.Group();
    const m = mesh(new THREE.SphereGeometry(0.06, 10, 8), 'gunOlive'); m.scale.y = 1.25; grp.add(m);
    for (let i = 0; i < 3; i++) { const band = mesh(new THREE.TorusGeometry(0.055, 0.006, 4, 12), 'black'); band.rotation.x = Math.PI / 2; band.position.y = -0.03 + i * 0.03; grp.add(band); }
    const cap = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 8), 'gunmetal'); cap.position.y = 0.085; grp.add(cap);
    const lever = mesh(new THREE.BoxGeometry(0.012, 0.09, 0.008), 'gunmetal'); lever.position.set(0.05, 0.04, 0); lever.rotation.z = 0.2; grp.add(lever);
    return grp;
  }
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), emissiveMat(0x4fb8ff, 2.2)));
  const sh = mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, 1.3), 'vyrr'); sh.position.y = -0.03; grp.add(sh);
  const halo = new THREE.Sprite(glowMat(0x4fb8ff, 0.8)); halo.scale.set(0.5, 0.5, 1); grp.add(halo);
  return grp;
}

// ---- pickups ---------------------------------------------------------------
export function makePickup(pk) {
  if (pk.type === 'weapon') return makeWeapon(pk.ws.id).group;
  const g = new THREE.Group();
  if (pk.type === 'health') {
    const box = cboxGeoM('ecs', 0.5, 0.26, 0.34, 0.05); box.position.y = 0.13; g.add(box);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: labelTex('+', { w: 64, h: 64, bg: '#d8d8d0', fg: '#c02020', font: 'bold 60px sans-serif' }) }));
    cross.rotation.x = -Math.PI / 2; cross.position.y = 0.265; g.add(cross);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), emissiveMat(0x40ff80, 2)); lamp.position.set(0.2, 0.2, 0.17); g.add(lamp);
    return g;
  }
  for (let i = 0; i < Math.min(pk.n, 3); i++) { const gr = makeHeldGrenade(pk.g); gr.position.set(i * 0.18 - 0.18, 0.08, 0); gr.rotation.z = (i - 1) * 0.3; g.add(gr); }
  return g;
}
export function makeGrenade(g) {
  const m = makeHeldGrenade(g);
  if (g === 'plasma') { const halo = new THREE.Sprite(glowMat(0x4fb8ff, 0.9)); halo.scale.set(0.8, 0.8, 1); m.add(halo); }
  return m;
}
