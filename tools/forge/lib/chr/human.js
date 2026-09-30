// Human characters: one skeleton (1.8 m male at h = 1), a torso profile cut into
// pelvis / belly / chest pieces, and outfits that dress it: desert or woodland
// BDUs, the black Hybrid BDU, a lab coat with a shirt and tie, scrubs. Gear
// (belts, pouches, vests, radios, holsters) is added per character.
//
//   R = buildHuman({ h, girth, skin, outfit, face, hat, glasses, gloves, ... })
//   R.after()  call after posing (coat skirt panels follow the thighs)
//   R.surf(yAbs, angle, piece) → { p, n, ry, parent }  a point on the torso to hang gear on
import * as THREE from 'three';
import { makeBiped } from './biped.js';
import { humanHand, shoe } from './parts.js';
import { makeHead } from './head.js';
import { loftGeo, sliceGeo, profileAt, ellipsoidGeo, mesh, mat, glow, camo, limb, rboxGeo, cyl, sph, V3, lerp } from './core.js';

// Rest-pose torso profile [y, rx, rz, cz] (absolute heights, 1.8 m male).
export const TORSO = [
  [0.84, 0.05, 0.045, -0.005], [0.87, 0.112, 0.085, -0.01], [0.92, 0.155, 0.105, -0.012], [0.97, 0.166, 0.11, -0.01],
  [1.02, 0.163, 0.106, -0.004], [1.07, 0.156, 0.102, 0.002], [1.13, 0.158, 0.106, 0.008], [1.2, 0.168, 0.113, 0.012],
  [1.28, 0.18, 0.12, 0.013], [1.35, 0.188, 0.12, 0.01], [1.41, 0.19, 0.11, 0.0], [1.455, 0.172, 0.094, -0.012],
  [1.49, 0.118, 0.074, -0.015], [1.515, 0.068, 0.058, -0.012],
];
const N_TORSO = 2.35;

export function outfitMats(kind, o = {}) {
  const skin = mat(o.skin ?? 0xd6a283, { rough: 0.7 });
  const boot = mat(0x16130f, { rough: 0.45 });
  const sole = mat(0x0b0a09, { rough: 0.9 });
  switch (kind) {
    case 'bdu-desert': { const c = mat(0xffffff, { rough: 0.95, map: camo('desert', 0.45) }); return { shirt: c, pants: c, sleeve: c, fore: c, skin, boot, sole, collar: c }; }
    case 'bdu-woodland': { const c = mat(0xffffff, { rough: 0.95, map: camo('woodland', 0.5) }); return { shirt: c, pants: c, sleeve: c, fore: c, skin, boot, sole, collar: c }; }
    case 'bdu-black': { const c = mat(0x3c3e45, { rough: 0.72, map: camo('weave', 0.2) }); return { shirt: c, pants: c, sleeve: c, fore: c, skin, boot, sole, collar: c }; }
    case 'labcoat': {
      const coat = mat(0xf2f2ee, { rough: 0.85, map: camo('weave', 0.25) });
      const pants = mat(0x3a3c44, { rough: 0.85, map: camo('weave', 0.2) });
      return { shirt: coat, pants, sleeve: coat, fore: coat, skin, boot: mat(0x231a14, { rough: 0.35 }), sole, collar: coat, coat, under: mat(0xa9c6e6, { rough: 0.85 }), tie: mat(0x6a1f24, { rough: 0.6 }) };
    }
    case 'scrubs': {
      const s = mat(0x4f8fbf, { rough: 0.9, map: camo('weave', 0.25) });
      return { shirt: s, pants: s, sleeve: s, fore: skin, skin, boot: mat(0xe8e8e4, { rough: 0.7 }), sole: mat(0xc0c0bc, { rough: 0.9 }), collar: s };
    }
    default: throw new Error('outfit ' + kind);
  }
}

export function buildHuman(o = {}) {
  const H = o.h ?? 1, b = o.girth ?? 1, W = o.wide ?? 1;
  const M = { ...outfitMats(o.outfit, o), ...(o.mats || {}) };
  const loose = o.outfit === 'scrubs' ? 1.12 : o.outfit === 'labcoat' ? 1.04 : 1;
  const R = makeBiped({
    hipY: 0.98 * H, hipX: 0.095 * H * W, hipDY: -0.03 * H,
    thigh: [0.45 * H, 0.08 * b * loose, 0.058 * b * loose, 0.086 * b * loose], shin: [0.43 * H, 0.057 * b * loose, 0.041 * b * loose, 0.062 * b * loose],
    foot: { h: 0.08, heel: 0.06, toe: 0.2 },
    waistY: 0.12 * H, chestY: 0.2 * H, shX: 0.188 * H * W, shY: 0.165 * H, shZ: -0.012,
    upper: [0.29 * H, 0.056 * b * loose, 0.045 * b * loose, 0.058 * b * loose], fore: [0.265 * H, 0.046 * b, 0.034 * b, 0.049 * b],
    neckY: 0.215 * H, neckZ: -0.012, neckLen: 0.095 * H,
    mats: { thigh: M.pants, shin: M.pants, upper: o.outfit === 'scrubs' ? M.skin : M.sleeve, fore: o.sleeves === 'rolled' ? M.skin : M.fore },
  });
  R.M = M; R.H = H;
  const T = TORSO.map(([y, rx, rz, cz]) => [y * H, rx * b * W, rz * b, cz * b]);
  R.T = T;
  const pY = 0.98 * H, sY = pY + 0.12 * H, cY = sY + 0.2 * H;
  R.jy = { pelvis: pY, spine: sY, chest: cY };
  const piece = (m, y0, y1, jy, parent, grow = 0, oo = {}) => {
    const prof = grow ? T.map(([y, rx, rz, cz]) => [y, rx + grow, rz + grow, cz]) : T;
    const g = sliceGeo(prof, y0 * H, y1 * H, jy, { n: N_TORSO, seg: 22, ...oo });
    const me = mesh(g, m); parent.add(me); return me;
  };
  R.piece = piece;
  const top = o.outfit === 'labcoat' ? M.coat : M.shirt;
  piece(o.outfit === 'labcoat' || o.outfit === 'scrubs' ? M.pants : M.pants, 0.84, 1.13, pY, R.pelvis);
  piece(top, o.outfit === 'labcoat' ? 0.99 : 1.04, 1.32, sY, R.spine);
  if (o.outfit === 'labcoat') piece(top, 0.96, 1.14, pY, R.pelvis, 0.01);
  piece(top, 1.22, 1.515, cY, R.chest);
  // neck + head
  const neck = limb(R.neck, 0.11 * H, 0.052 * b, 0.05 * b, M.skin, { seg: 12 });
  neck.joint.rotation.x = Math.PI;
  R.headMesh = makeHead({ skin: o.skin ?? 0xd6a283, face: o.face || {}, glasses: o.glasses, hat: o.hat, hatOpts: o.hatOpts, hairVolume: o.hairVolume, hairA0: o.hairA0, hairA1: o.hairA1, hairY: o.hairY, s: o.headS ?? 1 });
  R.headMesh.position.z = 0.012;
  R.head.add(R.headMesh);
  // hands
  const handM = o.gloves ? mat(o.gloves, { rough: 0.6 }) : M.skin;
  R.hands = R.arms.map((A) => { const h = humanHand(A.side, handM, o.handS ?? 1); A.wrist.add(h); return h; });
  // feet
  for (const L of R.legs) {
    const f = shoe(M.boot, { h: 0.08, heel: 0.06, toe: 0.2, w: 0.05, sole: M.sole });
    L.ankle.add(f);
    if (o.boots !== false && o.outfit !== 'labcoat' && o.outfit !== 'scrubs') {
      // boot shaft up the shin, trousers bloused over its top
      L.knee.add(mesh(cyl(0.05, 0.05, 0.15, 12), M.boot, 0, -L.L2 + 0.045, 0.004));
      L.knee.add(mesh(ellipsoidGeo(0.058 * b, 0.04, 0.058 * b, 12, 6), M.pants, 0, -L.L2 + 0.13, 0.004));
    }
  }
  // collar
  if (o.outfit !== 'scrubs') {
    const col = mesh(loftGeo([{ y: 1.47 * H - cY, rx: 0.085 * b, rz: 0.074 * b, cz: -0.004 }, { y: 1.5 * H - cY, rx: 0.074 * b, rz: 0.066 * b, cz: 0.0 }, { y: 1.535 * H - cY, rx: 0.07 * b, rz: 0.064 * b, cz: 0.004 }], { seg: 18, a0: -Math.PI * 0.92, a1: Math.PI * 0.92 }), M.collar);
    col.material = col.material.clone(); col.material.side = THREE.DoubleSide;
    R.chest.add(col);
  }
  // torso surface points for gear: yAbs rest height, angle a (0 front, +X left side)
  R.surf = (yAbs, a, part = 'chest', grow = 0) => {
    const [y, rx, rz, cz] = profileAt(T, yAbs * H);
    const p = 2 / N_TORSO, s = Math.sin(a), c = Math.cos(a);
    const x = (rx + grow) * Math.sign(s) * Math.pow(Math.abs(s), p), z = cz + (rz + grow) * Math.sign(c) * Math.pow(Math.abs(c), p);
    const n = V3(s / rx, 0, c / rz).normalize();
    const parent = R[part];
    return { p: V3(x, y - R.jy[part], z), n, ry: Math.atan2(n.x, n.z), parent };
  };
  // hang a box on the torso: size [w, h, d]
  R.stick = (yAbs, a, size, m, part = 'chest', o2 = {}) => {
    const s = R.surf(yAbs, a, part, o2.grow ?? 0);
    const me = mesh(rboxGeo(size[0], size[1], size[2], o2.r ?? 0.006), m);
    me.position.copy(s.p).addScaledVector(s.n, size[2] / 2 - (o2.sink ?? 0.004));
    me.rotation.set(o2.rx ?? 0, s.ry, o2.rz ?? 0, 'YXZ');
    s.parent.add(me);
    return me;
  };
  R.afterFns = [];
  R.after = () => { for (const f of R.afterFns) f(); };
  if (o.outfit === 'labcoat') labCoat(R, M, H, b);
  if (o.outfit === 'bdu-desert' || o.outfit === 'bdu-woodland' || o.outfit === 'bdu-black') bdu(R, M, H, b, o);
  if (o.outfit === 'scrubs') scrubs(R, M, H, b);
  return R;
}

// ---------------------------------------------------------------- outfits
function bdu(R, M, H, b, o) {
  const dark = mat(0x5a4c38, { rough: 0.95 });
  // chest pockets with flaps
  if (!o.noChestPockets) for (const s of [-1, 1]) {
    R.stick(1.33, s * 0.5, [0.09, 0.1, 0.014], M.shirt, 'chest', { r: 0.004 });
    R.stick(1.378, s * 0.5, [0.095, 0.03, 0.02], M.shirt, 'chest', { r: 0.004, rx: -0.15 });
  }
  // cargo pockets on the thighs
  for (const L of R.legs) {
    L.hip.add(mesh(rboxGeo(0.03, 0.12, 0.11, 0.008), M.pants, -L.side * 0.072 * b, -0.22 * H, -0.004));
    L.hip.add(mesh(rboxGeo(0.034, 0.03, 0.115, 0.006), M.pants, -L.side * 0.074 * b, -0.162 * H, -0.004));
  }
  // belt
  if (o.belt !== false) webBelt(R, o.beltColor ?? 0x2b2a22, o.buckle ?? 0x9a9a8a);
  void dark;
}

export function webBelt(R, color = 0x2b2a22, buckleC = 0x9a9a8a, y0 = 1.035, y1 = 1.075) {
  const bm = mat(color, { rough: 0.8 });
  const T = R.T, H = R.H;
  const a = profileAt(T, y0 * H), c = profileAt(T, y1 * H);
  const band = mesh(loftGeo([{ y: y0 * H - R.jy.pelvis, rx: a[1] + 0.012, rz: a[2] + 0.012, cz: a[3] }, { y: y1 * H - R.jy.pelvis, rx: c[1] + 0.012, rz: c[2] + 0.012, cz: c[3] }], { seg: 22, n: N_TORSO }), bm);
  band.material = band.material.clone(); band.material.side = THREE.DoubleSide;
  R.pelvis.add(band);
  R.stick((y0 + y1) / 2, 0, [0.05, 0.045, 0.014], mat(buckleC, { rough: 0.3, metal: 0.8 }), 'pelvis', { grow: 0.012 });
  return bm;
}

function labCoat(R, M, H, b) {
  // open V at the chest: the blue shirt, a tie, lapels
  const v = R.surf(1.4, 0, 'chest');
  const shirt = mesh(loftGeo([{ y: -0.1, rx: 0.001, rz: 0.001 }, { y: -0.03, rx: 0.035, rz: 0.01 }, { y: 0.05, rx: 0.06, rz: 0.012 }, { y: 0.1, rx: 0.07, rz: 0.012 }], { seg: 8 }), M.under);
  shirt.position.set(0, v.p.y + 0.02, v.p.z - 0.004); R.chest.add(shirt);
  // tie: knot + blade
  const tie = new THREE.Group(); tie.position.set(0, v.p.y + 0.11, v.p.z + 0.007); R.chest.add(tie);
  tie.add(mesh(rboxGeo(0.022, 0.02, 0.012, 0.004), M.tie, 0, -0.005, 0));
  tie.add(mesh(rboxGeo(0.03, 0.15, 0.006, 0.003), M.tie, 0, -0.085, -0.004, 0.08, 0, 0));
  tie.add(mesh(new THREE.ConeGeometry(0.018, 0.03, 4), M.tie, 0, -0.17, -0.01, Math.PI, Math.PI / 4, 0));
  // lapels
  for (const s of [-1, 1]) {
    const lp = mesh(rboxGeo(0.045, 0.16, 0.01, 0.003), M.coat, s * 0.058, v.p.y + 0.03, v.p.z + 0.004, -0.12, s * 0.35, s * -0.28);
    R.chest.add(lp);
  }
  // pockets: breast pocket with pens, hip pockets
  R.stick(1.34, 0.62, [0.08, 0.08, 0.01], M.coat, 'chest', { r: 0.003 });
  R.chest.add(mesh(cyl(0.004, 0.004, 0.05, 6), mat(0x2040a0, { rough: 0.4 }), R.surf(1.38, 0.62).p.x, R.surf(1.38, 0.62).p.y, R.surf(1.38, 0.62).p.z + 0.012));
  R.chest.add(mesh(cyl(0.004, 0.004, 0.05, 6), mat(0xb02020, { rough: 0.4 }), R.surf(1.38, 0.62).p.x + 0.012, R.surf(1.38, 0.62).p.y, R.surf(1.38, 0.62).p.z + 0.011));
  // ID badge clipped to the pocket
  R.stick(1.3, -0.55, [0.04, 0.055, 0.004], mat(0xe8e0c8, { rough: 0.5 }), 'chest', { r: 0.002, grow: 0.004 });
  // cuffs
  for (const A of R.arms) A.el.add(mesh(cyl(0.05, 0.052, 0.05, 12, true), M.coat, 0, -A.L2 + 0.03, 0));
  // skirt: three panels (right front, left front, back) hinged at the hips, following the thighs
  const top = 1.0 * H - R.jy.pelvis, len = 0.56 * H;
  const P = profileAt(R.T, 1.0 * H);
  const secs = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; secs.push({ y: top - t * len, rx: P[1] + 0.022 + t * 0.05, rz: P[2] + 0.027 + t * 0.045, cz: P[3] - t * 0.005 }); }
  secs.reverse();
  const sideM = M.coat.clone(); sideM.side = THREE.DoubleSide;
  const mk = (a0, a1) => { const piv = new THREE.Group(); piv.position.set(0, top, 0); const m = mesh(loftGeo(secs.map((s) => ({ ...s, y: s.y - top })), { seg: 10, a0, a1 }), sideM); piv.add(m); R.pelvis.add(piv); return piv; };
  const rf = mk(-Math.PI * 0.56, -0.06), lf = mk(0.06, Math.PI * 0.56), bk = mk(Math.PI * 0.45, Math.PI * 1.55);
  R.coat = { rf, lf, bk };
  R.afterFns.push(() => {
    const sw = (i) => { const d = V3(0, -1, 0).applyQuaternion(R.legs[i].hip.quaternion); return Math.atan2(d.z, -d.y); };
    const a0 = sw(0), a1 = sw(1);
    const k = R.coatK ?? 0.8, cap = R.coatCap ?? 1.0;
    rf.rotation.set(-Math.min(cap, Math.max(-0.1, a0)) * k, 0, 0);
    lf.rotation.set(-Math.min(cap, Math.max(-0.1, a1)) * k, 0, 0);
    bk.rotation.set(-Math.min(0.05, a0, a1) * 0.85 + (R.coatFlare ?? 0), 0, 0);
    // hems never go through the floor: swing a panel away from the body until it clears
    if (!R.noHemClamp) for (const [pv, dir] of [[bk, 1], [rf, -1], [lf, -1]]) {
      for (let i = 0; i < 30 && R.lowestOf(pv) < -0.002; i++) pv.rotation.x += dir * 0.05;
    }
  });
}

function scrubs(R, M, H, b) {
  // V-neck: skin triangle at the collar
  const v = R.surf(1.45, 0, 'chest');
  const vn = mesh(new THREE.ConeGeometry(0.035, 0.09, 3), M.skin, 0, v.p.y + 0.025, v.p.z - 0.002, 0, 0, Math.PI);
  vn.scale.set(1, 1, 0.3); R.chest.add(vn);
  // short sleeves over the upper arms
  for (const A of R.arms) {
    const sl = mesh(loftGeo([{ y: -0.15, rx: 0.072, rz: 0.07 }, { y: -0.05, rx: 0.07, rz: 0.068 }, { y: 0.03, rx: 0.062, rz: 0.06 }], { seg: 12 }), M.shirt);
    sl.material = sl.material.clone(); sl.material.side = THREE.DoubleSide;
    A.sh.add(sl);
  }
  // top hangs untucked over the hips
  const hem = R.piece(M.shirt, 0.92, 1.1, R.jy.pelvis, R.pelvis, 0.014, { openBottom: true });
  hem.material = hem.material.clone(); hem.material.side = THREE.DoubleSide;
  // chest pocket
  R.stick(1.33, 0.55, [0.08, 0.08, 0.008], M.shirt, 'chest', { r: 0.003 });
  // drawstring
  R.stick(1.03, 0.0, [0.012, 0.05, 0.006], mat(0xdfe6ea, { rough: 0.8 }), 'pelvis', { grow: 0.01 });
}

// ---------------------------------------------------------------- gear
export function tacVest(R, color = 0x223355, o = {}) {
  const vm = mat(color, { rough: 0.8, map: camo('weave', 0.3) });
  const H = R.H;
  const g1 = R.piece(vm, 1.06, 1.3, R.jy.spine, R.spine, 0.022, { n: 2.8 });
  const g2 = R.piece(vm, 1.2, 1.46, R.jy.chest, R.chest, 0.022, { n: 2.8 });
  // shoulder straps
  for (const s of [-1, 1]) {
    const p = R.surf(1.45, s * 0.9, 'chest', 0.02);
    R.chest.add(mesh(rboxGeo(0.08, 0.03, 0.2, 0.006), vm, s * 0.1, p.p.y + 0.015, -0.005));
  }
  // front panel seam + pouches
  if (o.pouches !== false) for (const s of [-1, 1]) R.stick(1.2, s * 0.4, [0.075, 0.09, 0.03], vm, 'spine', { grow: 0.022 });
  if (o.badge) R.stick(1.36, -0.45, [0.045, 0.05, 0.006], mat(0xc8a848, { rough: 0.3, metal: 0.8 }), 'chest', { grow: 0.022 });
  void g1; void g2; void H;
  return vm;
}

export function radio(R, yAbs = 1.36, a = 0.55, part = 'chest', grow = 0) {
  const g = new THREE.Group();
  const rm = mat(0x1c1d1f, { rough: 0.5 });
  const box = R.stick(yAbs, a, [0.05, 0.09, 0.03], rm, part, { grow });
  const ant = mesh(cyl(0.004, 0.003, 0.12, 6), rm, 0, 0.1, 0);
  box.add(ant);
  box.add(mesh(new THREE.BoxGeometry(0.03, 0.006, 0.005), glow(0x40ff60, 0.6), 0, 0.02, 0.016));
  return g;
}

export function holster(R, side = 1, color = 0x1a1814) {
  const hm = mat(color, { rough: 0.6 });
  const L = R.legs[side === 1 ? 0 : 1];
  const h = new THREE.Group();
  h.position.set(-L.side * 0.09, -0.08, 0.0);
  h.add(mesh(rboxGeo(0.035, 0.15, 0.07, 0.01), hm, 0, 0, 0.0, -0.1, 0, 0));
  h.add(mesh(rboxGeo(0.03, 0.04, 0.05, 0.008), mat(0x111111, { rough: 0.4 }), 0.0, 0.085, 0.0));
  L.hip.add(h);
  return h;
}

export function pouches(R, list, color) {
  const pm = mat(color, { rough: 0.85 });
  for (const [y, a, w, h, d] of list) R.stick(y, a, [w, h, d], pm, 'pelvis', { grow: 0.014 });
}
