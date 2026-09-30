// Alien bodies: the Grey (EBE) and the pieces the Overseer reuses.
import * as THREE from 'three';
import { makeBiped } from './biped.js';
import { makeHand, shoe, glowOrb } from './parts.js';
import { loftGeo, ellipsoidGeo, sliceGeo, limbGeo, mesh, mat, glow, camo, sph, cyl, V3, limb, canvasTex, mulberry32 } from './core.js';

// Grey head: an inverted teardrop cranium, huge glossy black almond eyes that
// wrap round the face, two nose slits, a lipless mouth. Built from the neck
// top; the chin sits forward of the neck. s scales everything.
export function greyHead(skin, o = {}) {
  const s = o.s ?? 1;
  const g = new THREE.Group();
  const secs = [
    [-0.06, 0, 0, 0.078], [-0.056, 0.012, 0.01, 0.077], [-0.045, 0.026, 0.022, 0.072], [-0.02, 0.048, 0.042, 0.062],
    [0.015, 0.074, 0.068, 0.047], [0.05, 0.1, 0.094, 0.032], [0.09, 0.126, 0.118, 0.014], [0.135, 0.148, 0.14, -0.004],
    [0.185, 0.162, 0.156, -0.022], [0.235, 0.166, 0.162, -0.034], [0.28, 0.156, 0.155, -0.044], [0.315, 0.13, 0.133, -0.048],
    [0.34, 0.092, 0.096, -0.05], [0.355, 0.05, 0.052, -0.05], [0.361, 0, 0, -0.05],
  ].map(([y, rx, rz, cz]) => {
    // elder crania: everything above the brow stretched upward and swept back
    const k = Math.max(0, y - 0.11), tall = o.tall ?? 1, back = o.back ?? 0;
    return [(y + k * (tall - 1)) * s, rx * s * (o.wide ?? 1), rz * s * (o.deep ?? 1), (cz - k * back) * s];
  });
  const cranium = mesh(loftGeo(secs, { seg: 28 }), o.craniumMat || skin);
  g.add(cranium);
  g.cranium = cranium;
  // eyes: glossy black almonds on the face surface, outer corners up
  const eyeMat = o.eyeMat || mat(0x06070a, { rough: 0.1, metal: 0.0 });
  const eyes = [];
  for (const side of [1, -1]) {
    const x = -side * 0.052 * s;
    const e = new THREE.Group();
    e.position.set(x, 0.075 * s, 0.099 * s);
    e.rotation.set(-0.1, -side * 0.48, -side * 0.4, 'YXZ');
    const ball = mesh(ellipsoidGeo(0.06 * s, 0.03 * s, 0.024 * s, 18, 10), eyeMat);
    e.add(ball);
    // flare (hidden unless casting): a pale inner light
    const flare = mesh(ellipsoidGeo(0.036 * s, 0.014 * s, 0.01 * s, 12, 6), glow(0xeaf6ff, 1), 0, 0, 0.016 * s);
    flare.visible = false; e.add(flare); e.flare = flare;
    // brow ridge above the eye, a soft fold
    const brow = mesh(ellipsoidGeo(0.06 * s, 0.012 * s, 0.018 * s, 12, 6), skin, 0, 0.031 * s, -0.008 * s, 0, 0, 0);
    e.add(brow);
    g.add(e); eyes.push(e);
  }
  g.eyes = eyes;
  // nose: two slits on a faint bump; mouth: a thin dark line
  const dark = mat(0x23262d, { rough: 0.9 });
  g.add(mesh(ellipsoidGeo(0.011 * s, 0.018 * s, 0.01 * s, 8, 6), skin, 0, 0.018 * s, 0.108 * s));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.004 * s, 0.008 * s, 0.006 * s), dark, sx * 0.006 * s, 0.008 * s, 0.114 * s, 0, 0, sx * 0.3));
  g.add(mesh(new THREE.BoxGeometry(0.028 * s, 0.004 * s, 0.006 * s), dark, 0, -0.018 * s, 0.1 * s, 0.3, 0, 0));
  return g;
}

// The Grey: 1.2 m, spindly limbs, slight pot belly, long three-fingered hands.
export function buildGrey(o = {}) {
  const skin = o.skin || mat(0x9eabc4, { rough: 0.5, map: camo('alien', 0.35) });
  const skinD = o.skinD || mat(0x8e9aae, { rough: 0.6, map: camo('alien', 0.35) });
  const R = makeBiped({
    hipY: 0.5, hipX: 0.052, hipDY: -0.01,
    thigh: [0.225, 0.034, 0.024, 0.036], shin: [0.225, 0.025, 0.017, 0.028],
    foot: { h: 0.042, heel: 0.03, toe: 0.095 },
    waistY: 0.075, chestY: 0.13, shX: 0.092, shY: 0.13, shZ: -0.005,
    upper: [0.215, 0.026, 0.019, 0.027], fore: [0.205, 0.02, 0.014, 0.022],
    neckY: 0.165, neckZ: -0.004, neckLen: 0.085, headZ: 0.0,
    mats: { thigh: skin, shin: skin, upper: skin, fore: skin },
  });
  // torso: one profile (rest heights) cut into pelvis / belly / chest pieces
  const T = [
    [0.43, 0.035, 0.03, 0], [0.45, 0.058, 0.045, 0], [0.49, 0.074, 0.057, -0.004], [0.54, 0.076, 0.062, 0.004],
    [0.59, 0.075, 0.07, 0.016], [0.63, 0.078, 0.076, 0.025], [0.67, 0.074, 0.068, 0.02], [0.71, 0.066, 0.055, 0.006],
    [0.76, 0.072, 0.053, 0.0], [0.8, 0.078, 0.05, -0.002], [0.83, 0.078, 0.045, -0.004], [0.855, 0.056, 0.036, -0.004], [0.872, 0.026, 0.024, -0.004],
  ];
  const pY = 0.5, sY = pY + 0.075, cY = sY + 0.13;
  R.pelvis.add(mesh(sliceGeo(T, 0.43, 0.6, pY), skin));
  R.spine.add(mesh(sliceGeo(T, 0.56, 0.735, sY), skin));
  R.chest.add(mesh(sliceGeo(T, 0.69, 0.872, cY, { openTop: false }), skin));
  // collarbones / shoulder knobs
  for (const s of [-1, 1]) R.chest.add(mesh(ellipsoidGeo(0.028, 0.02, 0.026), skin, s * 0.084, 0.128, -0.004));
  // neck: thin, slightly forward, ending under the skull
  const neck = limb(R.neck, 0.1, 0.02, 0.022, skin, { seg: 10 });
  neck.joint.rotation.x = Math.PI; // points up from the chest
  const head = greyHead(skin, o.head);
  R.head.add(head);
  R.headMesh = head;
  // hands: three long fingers, fingertip pads, a small opposed thumb
  R.hands = R.arms.map((A) => {
    const h = makeHand({
      side: A.side, mat: skin, palm: [0.016, 0.04, 0.036],
      fingers: [{ z: -0.012, len: 0.085, r: 0.0065, n: 3 }, { z: 0.0, len: 0.1, r: 0.0068, n: 3 }, { z: 0.012, len: 0.088, r: 0.0065, n: 3 }],
      thumb: { len: 0.045, r: 0.006, z: 0.017, y: 0.012 }, tipR: 0.0085, tipMat: skinD,
    });
    A.wrist.add(h); return h;
  });
  // feet: long and narrow with a split toe
  for (const L of R.legs) {
    const f = shoe(skin, { h: 0.042, heel: 0.03, toe: 0.095, w: 0.024, profile: [[0, 0.6, 0.7], [0.15, 1, 1], [0.45, 1, 0.8], [0.7, 1.1, 0.45], [0.9, 1.0, 0.3], [1, 0.0, 0.15]] });
    L.ankle.add(f);
  }
  // cast orb in the right palm (hidden unless casting)
  const orb = glowOrb(0.05, 0xffffff, 0xcfe6ff, 1);
  orb.position.set(0.035, -0.035, 0.0); orb.visible = false;
  R.arms[0].wrist.add(orb);
  R.orb = orb;
  const orb2 = glowOrb(0.1, 0xffffff, 0xb8dcff, 1);
  orb2.visible = false; R.rig.add(orb2); R.orb2 = orb2;
  R.onReset = () => {
    orb.visible = false; orb2.visible = false; orb.scale.setScalar(1);
    for (const e of head.eyes) e.flare.visible = false;
    for (const h of R.hands) h.pose(0.35, 0.1);
  };
  return R;
}

// ---------------------------------------------------------------- the Stalker
// A long-limbed grey-green hunter: digitigrade legs (it runs on long toes), a narrow
// waist under a heavy ribbed chest and hunched shoulders, a long ridged skull with a
// hinged jaw, blade claws.
export function buildStalker() {
  const skin = mat(0x7f8d71, { rough: 0.5, map: camo('alien', 0.3) });
  const ribs = mat(0x84917a, { rough: 0.5, map: camo('ribbed', 0.2) });
  const dark = mat(0x4f5947, { rough: 0.45 });
  const bone = mat(0xdcd3b8, { rough: 0.35 });
  const R = makeBiped({
    hipY: 1.12, hipX: 0.11, hipDY: -0.03,
    thigh: [0.5, 0.1, 0.055, 0.12], shin: [0.47, 0.06, 0.034, 0.065],
    foot: { h: 0.03, heel: 0.02, toe: 0.4 },
    waistY: 0.14, chestY: 0.22, shX: 0.23, shY: 0.14, shZ: -0.02,
    upper: [0.44, 0.078, 0.05, 0.085], fore: [0.44, 0.058, 0.036, 0.065],
    neckY: 0.17, neckZ: 0.05, neckLen: 0.16,
    mats: { thigh: skin, shin: skin, upper: skin, fore: skin },
  });
  const T = [
    [0.88, 0.04, 0.04, 0], [0.92, 0.1, 0.085, -0.01], [0.98, 0.13, 0.1, -0.012], [1.04, 0.12, 0.094, -0.008], [1.1, 0.095, 0.082, 0],
    [1.16, 0.1, 0.09, 0.01], [1.24, 0.145, 0.13, 0.02], [1.32, 0.185, 0.15, 0.02], [1.4, 0.205, 0.145, 0.0], [1.47, 0.2, 0.13, -0.025],
    [1.52, 0.14, 0.11, -0.03], [1.56, 0.07, 0.07, -0.02],
  ];
  const pY = 1.0, sY = pY + 0.14, cY = sY + 0.22; // profile heights are for a 1.0 m pelvis
  R.pelvis.add(mesh(sliceGeo(T, 0.88, 1.13, pY), skin));
  R.spine.add(mesh(sliceGeo(T, 1.06, 1.3, sY), skin));
  R.chest.add(mesh(sliceGeo(T, 1.2, 1.56, cY), ribs));
  // hunched upper back and shoulder masses
  R.chest.add(mesh(ellipsoidGeo(0.17, 0.12, 0.1, 14, 8), mat(0x6f7c63, { rough: 0.5, map: camo('alien', 0.3) }), 0, 0.09, -0.075));
  for (const s of [-1, 1]) R.chest.add(mesh(ellipsoidGeo(0.085, 0.07, 0.085), dark, s * 0.2, 0.135, -0.02));
  // back ridge: a row of bony plates down the spine
  for (let i = 0; i < 6; i++) R.chest.add(mesh(new THREE.ConeGeometry(0.02, 0.085 - i * 0.008, 5), bone, 0, 0.19 - i * 0.05, -0.17 + i * 0.012, -1.1, 0, 0));
  for (let i = 0; i < 3; i++) R.spine.add(mesh(new THREE.ConeGeometry(0.016, 0.05, 5), bone, 0, 0.12 - i * 0.06, -0.1, -1.2, 0, 0));
  // neck: thick, forward
  const nk = limb(R.neck, 0.2, 0.075, 0.055, skin, { seg: 12 }); nk.joint.rotation.x = Math.PI;
  // head: a long narrow skull sweeping back into a bony crest; the jaw hinges under it
  const head = new THREE.Group(); head.position.set(0, 0.02, 0.02); R.head.add(head);
  // sections along the skull's length (t: back → snout): [t, halfWidth, halfHeight, lift]
  const hs = [[-0.34, 0, 0, 0.16], [-0.31, 0.014, 0.022, 0.14], [-0.24, 0.035, 0.05, 0.1], [-0.15, 0.058, 0.07, 0.055], [-0.05, 0.07, 0.075, 0.02],
    [0.04, 0.066, 0.064, 0.0], [0.11, 0.05, 0.048, -0.005], [0.17, 0.034, 0.034, -0.01], [0.2, 0.0, 0.0, -0.012]];
  const skull = mesh(loftGeo(hs.map(([t, rx, rz, up]) => ({ y: t, rx, rz, cz: -up })), { seg: 16 }), skin);
  skull.rotation.x = Math.PI / 2; head.add(skull);
  // crest fins along the top, and ridges down the sides of the skull
  for (let i = 0; i < 5; i++) {
    const t = -0.02 - i * 0.065, lift = 0.02 + i * 0.03;
    const fin = mesh(new THREE.ConeGeometry(0.028, 0.09 - i * 0.008, 4), dark, 0, lift + 0.07 - i * 0.004, t - 0.01, -0.85, 0, 0);
    fin.scale.set(0.3, 1, 1); head.add(fin);
    for (const sd of [-1, 1]) head.add(mesh(ellipsoidGeo(0.008, 0.02, 0.028, 6, 5), dark, sd * (0.058 - i * 0.008), lift + 0.02, t, -0.4, 0, sd * 0.5));
  }
  // eyes: deep-set amber slits under a heavy brow
  for (const sd of [-1, 1]) {
    head.add(mesh(ellipsoidGeo(0.022, 0.008, 0.012, 8, 5), glow(0xffb834, 1), sd * 0.047, 0.012, 0.075, 0, sd * 0.55, sd * -0.3));
    head.add(mesh(ellipsoidGeo(0.032, 0.013, 0.024, 8, 5), dark, sd * 0.045, 0.027, 0.07, 0, sd * 0.5, sd * -0.25));
  }
  // jaw with teeth
  const jaw = new THREE.Group(); jaw.position.set(0, -0.04, -0.02); head.add(jaw);
  const jm = mesh(loftGeo([{ y: -0.03, rx: 0.055, rz: 0.03 }, { y: 0.08, rx: 0.045, rz: 0.028, cz: -0.005 }, { y: 0.19, rx: 0.026, rz: 0.018, cz: -0.012 }, { y: 0.21, rx: 0, rz: 0, cz: -0.012 }], { seg: 12 }), skin);
  jm.rotation.x = Math.PI / 2; jaw.add(jm);
  jaw.add(mesh(new THREE.BoxGeometry(0.06, 0.01, 0.16), mat(0x3a1414, { rough: 0.6 }), 0, 0.012, 0.09));
  for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) {
    jaw.add(mesh(new THREE.ConeGeometry(0.006, 0.028, 4), bone, sd * (0.034 - i * 0.004), 0.028, 0.04 + i * 0.03));
    head.add(mesh(new THREE.ConeGeometry(0.006, 0.028, 4), bone, sd * (0.036 - i * 0.004), -0.045, 0.02 + i * 0.03, Math.PI, 0, 0));
  }
  R.jaw = jaw;
  // hands: a small palm and three long blade claws
  R.hands = R.arms.map((A) => {
    const h = makeHand({ side: A.side, mat: skin, palm: [0.035, 0.075, 0.08], fingers: [{ z: -0.025, len: 0.07, r: 0.013, n: 2 }, { z: 0, len: 0.075, r: 0.013, n: 2 }, { z: 0.025, len: 0.07, r: 0.013, n: 2 }], thumb: { len: 0.05, r: 0.011, z: 0.04, y: 0.02 } });
    for (const f of h.fingers) {
      const tip = f.segs[f.segs.length - 1];
      const end = tip.children.find((c) => c.isGroup) || tip;
      const blade = mesh(new THREE.ConeGeometry(0.013, 0.22, 5), bone, 0, -0.1, 0, Math.PI, 0, 0);
      blade.scale.set(1, 1, 0.45);
      end.add(blade);
    }
    A.wrist.add(h); return h;
  });
  // digitigrade feet: the long metatarsal runs forward-down from the ankle to clawed toes
  for (const L of R.legs) {
    const mt = mesh(limbGeo(0.3, 0.045, 0.032), skin); mt.rotation.x = -Math.PI / 2; L.ankle.add(mt);
    for (const sd of [-1, 0, 1]) L.ankle.add(mesh(new THREE.ConeGeometry(0.015, 0.1, 5), bone, sd * 0.03, -0.01, 0.34, Math.PI / 2 + 0.15, sd * 0.25, 0));
    L.ankle.add(mesh(new THREE.ConeGeometry(0.013, 0.07, 5), bone, 0, 0.0, -0.045, -Math.PI / 2, 0, 0)); // dew claw
  }
  // chitin: dark plates along the forearms, thighs and shins, bone spurs at the elbows
  const plate = mat(0x323a2c, { rough: 0.35, metal: 0.1, env: true, envI: 0.3 });
  for (const A of R.arms) {
    const fp = mesh(ellipsoidGeo(0.05, 0.2, 0.03, 10, 6), plate, 0, -0.22, -0.035); A.el.add(fp);
    A.el.add(mesh(new THREE.ConeGeometry(0.022, 0.16, 5), bone, 0, 0.02, -0.07, -2.2, 0, 0)); // elbow spur
    A.sh.add(mesh(ellipsoidGeo(0.06, 0.18, 0.035, 10, 6), plate, -A.side * 0.04, -0.2, -0.03, 0, 0, 0));
  }
  for (const L of R.legs) {
    L.hip.add(mesh(ellipsoidGeo(0.045, 0.2, 0.08, 10, 6), plate, -L.side * 0.07, -0.22, 0.0));
    L.knee.add(mesh(ellipsoidGeo(0.04, 0.2, 0.035, 10, 6), plate, 0, -0.22, 0.035));
    L.knee.add(mesh(new THREE.ConeGeometry(0.02, 0.1, 5), bone, 0, 0.0, 0.07, 1.9, 0, 0)); // knee spike
  }
  // paler belly under the ribs
  R.spine.add(mesh(ellipsoidGeo(0.085, 0.12, 0.05, 12, 8), mat(0xa6b096, { rough: 0.55, map: camo('ribbed', 0.12) }), 0, 0.02, 0.07));
  R.onReset = () => { jaw.rotation.set(0, 0, 0); for (const h of R.hands) h.pose(0.2, 0.3); };
  return R;
}

// ---------------------------------------------------------------- the Overseer
// A 2.4 m Grey elder floating a hand's breadth above the floor: a mantle of ribbed
// carapace plates (a pleated robe below, a high fanned collar behind the head),
// long thin arms, an elongated cranium veined with violet light.
export function veinTex() {
  return canvasTex('overseer-veins', 256, 256, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const rnd = mulberry32(31);
    g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      let x = rnd() * W, y = H * (0.75 + rnd() * 0.2);
      g.lineWidth = 3.5 - rnd() * 1.5;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { x += (rnd() - 0.5) * 22; y -= 14 + rnd() * 14; g.lineTo(x, y); if (rnd() < 0.3) { g.stroke(); g.lineWidth *= 0.75; g.beginPath(); g.moveTo(x, y); } }
      g.stroke();
    }
  });
}
export function buildOverseer() {
  const skin = mat(0x9ea6be, { rough: 0.45, map: camo('alien', 0.4) });
  const chitin = mat(0x3d3350, { rough: 0.35, metal: 0.2, env: true, envI: 0.35 });
  const chitin2 = mat(0x4b3f60, { rough: 0.35, metal: 0.2, env: true, envI: 0.35 });
  const bone = mat(0xd6cab0, { rough: 0.45 });
  const R = makeBiped({
    hipY: 1.25, hipX: 0.07, hipDY: 0,
    thigh: [0.5, 0.05, 0.04], shin: [0.5, 0.04, 0.03],
    waistY: 0.15, chestY: 0.24, shX: 0.155, shY: 0.2, shZ: -0.01,
    upper: [0.44, 0.04, 0.03, 0.042], fore: [0.42, 0.032, 0.024, 0.034],
    neckY: 0.26, neckZ: 0.0, neckLen: 0.14, headZ: 0.0,
    mats: { thigh: skin, shin: skin, upper: skin, fore: skin },
  });
  for (const L of R.legs) L.hip.visible = false;
  // thin grey torso (mostly hidden by the carapace)
  const T = [[1.1, 0.0, 0.0, 0], [1.14, 0.1, 0.08, 0], [1.25, 0.13, 0.1, 0], [1.4, 0.12, 0.1, 0.01], [1.55, 0.14, 0.11, 0.01], [1.7, 0.16, 0.1, 0], [1.8, 0.14, 0.08, -0.01], [1.86, 0.05, 0.05, -0.01]];
  R.pelvis.add(mesh(sliceGeo(T, 1.1, 1.42, 1.25), skin));
  R.spine.add(mesh(sliceGeo(T, 1.36, 1.62, 1.4), skin));
  R.chest.add(mesh(sliceGeo(T, 1.55, 1.86, 1.64), skin));
  // segmented breastplate: overlapping carapace bands across the chest and shoulders
  for (let i = 0; i < 4; i++) {
    const y = 1.5 + i * 0.075, rx = 0.15 + i * 0.012, rz = 0.115;
    const band = mesh(loftGeo([{ y: y - 1.64 - 0.045, rx: rx + 0.012, rz: rz + 0.012, cz: 0.005 }, { y: y - 1.64 + 0.035, rx: rx, rz: rz, cz: 0.0 }], { seg: 20, a0: -Math.PI * 0.8, a1: Math.PI * 0.8 }), i % 2 ? chitin : chitin2);
    band.material = band.material.clone(); band.material.side = THREE.DoubleSide; R.chest.add(band);
  }
  for (const sd of [-1, 1]) R.chest.add(mesh(ellipsoidGeo(0.11, 0.06, 0.1, 12, 6), chitin2, sd * 0.16, 0.19, -0.01, 0, 0, sd * 0.35)); // pauldrons
  // the robe: pleated carapace plates hung from the waist, ribbed with bone, the hem floating
  const robe = new THREE.Group(); R.pelvis.add(robe);
  const N = 16, top = 1.36 - 1.25, hem = 0.1 - 1.25;
  const plates = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, w = (Math.PI * 2 / N) * 0.62;
    const secs = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; secs.push({ y: top + (hem - top) * t, rx: 0.15 + 0.3 * Math.pow(t, 1.3), rz: 0.13 + 0.3 * Math.pow(t, 1.3) }); }
    secs.reverse();
    const pl = new THREE.Group(); pl.position.y = top; robe.add(pl);
    const m = mesh(loftGeo(secs.map((q) => ({ ...q, y: q.y - top })), { seg: 4, a0: a - w, a1: a + w }), i % 2 ? chitin : chitin2); m.userData.noGround = true;
    m.material = m.material.clone(); m.material.side = THREE.DoubleSide; pl.add(m);
    // the rib down the plate's centre
    const pts = secs.map((q) => new THREE.Vector3(Math.sin(a) * (q.rx + 0.012), q.y - top, Math.cos(a) * (q.rz + 0.012)));
    pl.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.014, 5), bone));
    pl.a = a; plates.push(pl);
  }
  // the collar: long plates fanning up behind the head
  const collar = new THREE.Group(); collar.position.set(0, 0.2, -0.06); R.chest.add(collar);
  const cplates = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI * 1.15; // -100°..+100° around the back
    const g = new THREE.Group(); g.rotation.set(0, Math.PI + a, 0); collar.add(g);
    const blade = new THREE.Group(); blade.rotation.x = 0.28 + Math.abs(a) * 0.12; g.add(blade); // leaning out and back
    const len = 0.62 - Math.abs(a) * 0.14;
    const shape = [[-0.055, 0], [0.055, 0], [0.04, len * 0.7], [0.0, len], [-0.04, len * 0.7]];
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 1 });
    blade.add(mesh(geo, i % 2 ? chitin : chitin2, 0, 0, 0.15));
    blade.add(mesh(new THREE.BoxGeometry(0.012, len * 0.85, 0.012), bone, 0, len * 0.42, 0.17));
    cplates.push(blade);
  }
  // neck + elongated cranium with violet veins
  const nk = limb(R.neck, 0.16, 0.035, 0.038, skin, { seg: 10 }); nk.joint.rotation.x = Math.PI;
  const craniumMat = mat(0x9ea6be, { rough: 0.45, map: camo('alien', 0.4), emissive: 0xb04dff, ei: 0.0, emissiveMap: veinTex() });
  const head = greyHead(skin, { s: 1.25, tall: 1.55, back: 0.35, craniumMat });
  R.head.add(head); R.headMesh = head;
  // hands: three very long fingers
  R.hands = R.arms.map((A) => {
    const h = makeHand({ side: A.side, mat: skin, palm: [0.018, 0.05, 0.04], fingers: [{ z: -0.013, len: 0.13, r: 0.0075, n: 3 }, { z: 0, len: 0.15, r: 0.008, n: 3 }, { z: 0.013, len: 0.13, r: 0.0075, n: 3 }], thumb: { len: 0.06, r: 0.007, z: 0.02, y: 0.015 }, tipR: 0.009 });
    A.wrist.add(h); return h;
  });
  // violet light: orbs in the hands, a lance between them
  const orbs = R.arms.map((A) => { const o = glowOrb(0.07, 0xffffff, 0xc98cff, 1); o.position.set(A.side * 0.03, -0.06, 0); o.visible = false; A.wrist.add(o); return o; });
  const lance = new THREE.Group(); R.rig.add(lance); lance.visible = false;
  lance.add(glowOrb(0.16, 0xffffff, 0xb870ff, 1));
  for (let i = 0; i < 5; i++) { const c = mesh(new THREE.ConeGeometry(0.06, 0.55, 6), glow(i % 2 ? 0xe2c4ff : 0xffffff, 1), 0, 0, 0.3, Math.PI / 2, 0, 0); const p = new THREE.Group(); p.rotation.set((i - 2) * 0.12, Math.sin(i * 2) * 0.15, 0); p.add(c); lance.add(p); }
  const aura = mesh(sph(0.3, 16, 10), new THREE.MeshBasicMaterial({ color: 0xa860ff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  head.add(aura); aura.position.set(0, 0.34, -0.1); aura.scale.set(1, 1.35, 1.1); aura.visible = false;
  Object.assign(R, { robe, plates, collar, cplates, craniumMat, orbs, lance, aura, chitin, bone });
  R.glow = (k) => { craniumMat.emissiveIntensity = k; aura.visible = k > 1.2; };
  R.onReset = () => {
    for (const h of R.hands) h.pose(0.3, 0.3);
    for (const o of orbs) { o.visible = false; o.scale.setScalar(1); }
    lance.visible = false; R.glow(0);
    for (const p of plates) { p.rotation.set(0, 0, 0); p.position.set(0, top, 0); p.visible = true; }
    robe.scale.set(1, 1, 1); robe.rotation.set(0, 0, 0);
    for (const c of cplates) c.parent.parent.visible = true;
  };
  return R;
}
