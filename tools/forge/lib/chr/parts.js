// Body parts shared by characters: hands with curling fingers, feet/shoes,
// glow orbs and muzzle flashes, blood pools.
import * as THREE from 'three';
import { limb, joint, mesh, ellipsoidGeo, loftGeo, sph, glow, mat, V3 } from './core.js';

// A hand built at the wrist with the fingers along -Y, the palm facing +X*side
// (inward when the arm hangs), the thumb toward +Z. side: +1 right, -1 left.
// o: { side, mat, palm: [thick, len, width], fingers: [{ z, len, r, n }], thumb: { len, r, z, y } | null,
//      tipMat, tipR, nail }
// h.pose(curl 0..1, spread 0..1, thumbCurl)
export function makeHand(o) {
  const side = o.side ?? 1, M = o.mat;
  const h = new THREE.Group();
  const [pt, pl, pw] = o.palm ?? [0.03, 0.08, 0.075];
  const palm = mesh(ellipsoidGeo(pt / 2, pl / 2, pw / 2, 10, 6), M, 0, -pl / 2, 0);
  h.add(palm);
  const fingers = [];
  for (const f of o.fingers) {
    const n = f.n ?? 2;
    let parent = h, segs = [];
    for (let k = 0; k < n; k++) {
      const len = f.len / n * (k === 0 ? 1.1 : 0.9);
      const r0 = f.r * (1 - k * 0.12), r1 = f.r * (1 - (k + 1) * 0.12);
      const b = limb(parent, len, r0, r1, M, k === 0 ? { x: 0, y: -pl * 0.92, z: f.z, seg: 6 } : { seg: 6 });
      segs.push(b.joint); parent = b.end;
    }
    if (o.tipR) { const tip = mesh(sph(o.tipR, 8, 6), o.tipMat || M); parent.add(tip); }
    fingers.push({ segs, z: f.z });
  }
  let thumb = null;
  if (o.thumb) {
    const t0 = limb(h, o.thumb.len * 0.55, o.thumb.r, o.thumb.r * 0.9, M, { x: side * pt * 0.2, y: -(o.thumb.y ?? pl * 0.25), z: o.thumb.z ?? pw * 0.45, seg: 6 });
    const t1 = limb(t0.end, o.thumb.len * 0.45, o.thumb.r * 0.9, o.thumb.r * 0.75, M, { seg: 6 });
    thumb = { a: t0.joint, b: t1.joint };
  }
  h.fingers = fingers; h.thumb = thumb; h.side = side;
  h.pose = (curl = 0.3, spread = 0, tc = curl) => {
    for (const f of fingers) {
      const sp = -Math.sign(f.z) * spread * 0.35;
      f.segs.forEach((j, k) => j.rotation.set(k === 0 ? sp : 0, 0, side * curl * (k === 0 ? 1.1 : 1.3)));
    }
    if (thumb) {
      thumb.a.rotation.set(-0.7 - spread * 0.3, 0, side * (0.3 + tc * 0.6));
      thumb.b.rotation.set(0, 0, side * tc * 0.9);
    }
  };
  h.pose(0.3, 0);
  return h;
}

// Human hand (mitten-ish at sprite scale, but with fingers for gestures).
export function humanHand(side, M, s = 1) {
  return makeHand({
    side, mat: M, palm: [0.028 * s, 0.085 * s, 0.078 * s],
    fingers: [-0.027, -0.009, 0.009, 0.027].map((z, i) => ({ z: z * s, len: (i === 0 || i === 3 ? 0.07 : 0.08) * s, r: 0.0095 * s, n: 2 })),
    thumb: { len: 0.06 * s, r: 0.011 * s, z: 0.036 * s, y: 0.02 * s },
  });
}

// A shoe/boot at the ankle joint: sole flat at y = -h, heel at -heel, toe at +toe.
export function shoe(M, o = {}) {
  const g = new THREE.Group();
  const h = o.h ?? 0.07, heel = o.heel ?? 0.05, toe = o.toe ?? 0.17, w = o.w ?? 0.05;
  const L = heel + toe;
  // side profile lofted along z: sections are across the foot
  const secs = [];
  const prof = o.profile ?? [[0, 0.5, 0.75], [0.15, 0.95, 0.95], [0.4, 1, 0.9], [0.65, 1, 0.55], [0.85, 0.9, 0.42], [0.97, 0.6, 0.32], [1, 0.0, 0.15]];
  // lofted along y, then turned so loft-y runs forward (+Z) and loft-z becomes -Y (height)
  for (const [t, wk, hk] of prof) secs.push({ y: -heel + t * L, rx: w * wk, rz: h * hk * 0.5, cz: h - h * hk * 0.5 });
  const geo = loftGeo(secs, { seg: 12, n: 2.6 });
  geo.rotateX(Math.PI / 2); // (x, y, z) → (x, -z, y)
  const m = new THREE.Mesh(geo, M);
  g.add(m);
  if (o.sole) { const s = mesh(new THREE.BoxGeometry(w * 2.02, 0.014, L * 0.98), o.sole, 0, -h + 0.007, (toe - heel) / 2); g.add(s); }
  return g;
}

// Glowing orb with a soft-looking halo (hard alpha: stepped shells).
export function glowOrb(r, core = 0xffffff, halo = 0xbfe8ff, k = 1) {
  const g = new THREE.Group();
  g.add(mesh(sph(r * 0.55, 12, 8), glow(core, 1.0)));
  const m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(halo).multiplyScalar(k), transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
  g.add(mesh(sph(r, 12, 8), m2));
  return g;
}

// Star-shaped muzzle flash pointing +Z from the origin (length L).
export function muzzleFlash(L = 0.25, seed = 1) {
  const g = new THREE.Group();
  const outer = glow(0xffc040, 1.0), mid = glow(0xffe890, 1.0), core = glow(0xffffff, 1.0);
  const cone = (len, r, m, rx = 0, ry = 0) => {
    const c = mesh(new THREE.ConeGeometry(r, len, 6), m); c.rotation.x = Math.PI / 2; c.position.z = len / 2;
    const p = new THREE.Group(); p.add(c); p.rotation.set(rx, ry, 0); g.add(p); return p;
  };
  cone(L, L * 0.28, outer);
  cone(L * 0.8, L * 0.18, mid);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + seed; cone(L * 0.55, L * 0.1, outer, Math.sin(a) * 0.9, Math.cos(a) * 0.9); }
  g.add(mesh(sph(L * 0.2, 10, 8), core, 0, 0, L * 0.12));
  g.add(mesh(sph(L * 0.3, 10, 8), mid, 0, 0, L * 0.08, 0, 0, 0, 1, 1, 0.6));
  return g;
}

// Flat irregular pool on the floor (blood, oil, alien ichor).
export function pool(r, color, seed = 1, o = {}) {
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.22 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 5 + seed * 2.3);
    pts.push(new THREE.Vector2(Math.cos(a) * r * k * (o.sx ?? 1), Math.sin(a) * r * k * (o.sz ?? 1)));
  }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, o.glow ? glow(color, 1) : mat(color, { rough: 0.15, metal: 0.1 }));
  m.position.y = 0.004;
  m.userData.noGround = true;
  return m;
}
