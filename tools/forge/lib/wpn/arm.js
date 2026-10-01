// First-person arms for Special Agent Marsh: bare hands with jointed fingers,
// a white shirt cuff, a charcoal suit cuff with buttons, a dark wool trench-coat
// sleeve with a strap and buckle, and a steel wristwatch on the left wrist.
//
// Hand frame (both hands): origin at the wrist joint, fingers along -Z, back
// of the hand +Y, palm -Y. Right hand (side +1): thumb on -X. Left (side -1):
// thumb on +X. Forearm frame: origin at the wrist, +Z toward the elbow, +Y the
// back of the wrist (where the watch face sits).
import { THREE, mat, glow, boxUV, put, group, clamp, lerp, sstep, V3, rbox, latheZ, cylZ, sphere, canvas } from './core.js';
import { fbm, vnoise } from '../noise.js';

// ------------------------------------------------------------------ loft
// sections: [{ p:[x,y,z], w, h, e = 2 (superellipse exponent), off:[dx,dy] }]
// A tube through the section centres; each section is a superellipse in the
// plane perpendicular to the path. up: reference 'up' (+Y) for section frames.
// r(theta, i, s) optional radial multiplier. Caps: 'round' | 'flat' | null.
export function loft(sections, { radial = 24, up = [0, 1, 0], r = null, cap0 = null, cap1 = null, uvScale = 0.05 } = {}) {
  const S = sections.map((s) => ({ ...s, p: V3(...s.p) }));
  const N = S.length, pos = [], idx = [];
  const U = V3(...up);
  const frames = S.map((s, i) => {
    const a = S[Math.max(0, i - 1)].p, b = S[Math.min(N - 1, i + 1)].p;
    let t = s.t ? V3(...s.t) : b.clone().sub(a);
    if (t.lengthSq() < 1e-14) t = S[N - 1].p.clone().sub(S[0].p);
    if (t.lengthSq() < 1e-14) t.set(0, 0, 1);
    t.normalize();
    const u = (s.up ? V3(...s.up) : U.clone()); u.addScaledVector(t, -u.dot(t)).normalize();
    const x = new THREE.Vector3().crossVectors(u, t).normalize(); // side
    return { t, u, x };
  });
  const ring = (s, f, i) => {
    const e = s.e ?? 2, out = [];
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const k = r ? r(th, i, sections[i]) : 1;
      const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * s.w / 2 * k, py = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * s.h / 2 * k;
      const ox = (s.off?.[0] ?? 0) + px, oy = (s.off?.[1] ?? 0) + py;
      out.push(s.p.clone().addScaledVector(f.x, ox).addScaledVector(f.u, oy));
    }
    return out;
  };
  const rings = S.map((s, i) => ring(s, frames[i], i));
  for (const rg of rings) for (const v of rg) pos.push(v.x, v.y, v.z);
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, b, c, b, d, c);
  }
  const addCap = (i, dir) => {
    const rg = rings[i], f = frames[i], s = S[i];
    const centre = rg.reduce((acc, v) => acc.add(v), V3()).divideScalar(rg.length);
    if (dir === 'round') {} // handled via extra sections by callers
    const base = pos.length / 3; const tip = centre.clone().addScaledVector(f.t, (i === 0 ? -1 : 1) * 0.0001);
    pos.push(tip.x, tip.y, tip.z);
    for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial; if (i === 0) idx.push(base, b, a); else idx.push(base, a, b); }
    void s;
  };
  if (cap0) addCap(0, cap0);
  if (cap1) addCap(N - 1, cap1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // uv: around × along
  const uv = [];
  let acc = 0; const along = [0];
  for (let i = 1; i < N; i++) { acc += S[i].p.distanceTo(S[i - 1].p); along.push(acc); }
  for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) uv.push((j / radial) * (Math.PI * (S[i].w + S[i].h) / 2) / uvScale, along[i] / uvScale);
  if (cap0) uv.push(0, 0); if (cap1) uv.push(0, acc / uvScale);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
// Round-ended section list: adds shrinking sections before/after to close a loft smoothly.
export function roundEnds(sec, { start = true, end = true, n = 4 } = {}) {
  const out = [...sec];
  const ext = (s, dirSign, nb) => {
    const p0 = V3(...s.p), p1 = V3(...nb.p), t = p0.clone().sub(p1).normalize();
    const rr = Math.min(s.w, s.h) / 2, res = [];
    for (let k = 1; k <= n; k++) {
      const a = (k / n) * Math.PI / 2, sc = Math.cos(a), dz = Math.sin(a) * rr;
      const p = p0.clone().addScaledVector(t, dz);
      res.push({ ...s, p: [p.x, p.y, p.z], w: Math.max(1e-4, s.w * sc), h: Math.max(1e-4, s.h * sc) });
    }
    return dirSign < 0 ? res.reverse() : res;
  };
  const pre = start ? ext(sec[0], -1, sec[1]) : [];
  const post = end ? ext(sec[sec.length - 1], 1, sec[sec.length - 2]) : [];
  return [...pre, ...out, ...post];
}

// ------------------------------------------------------------------ hand
// Finger data for the right hand (x mirrored for the left): base (MCP) position,
// phalanx lengths and radii.
const FINGERS = [
  { name: 'index', base: [-0.028, 0.002, -0.094], L: [0.043, 0.025, 0.021], r: [0.0098, 0.0088, 0.0079], splay: 0.06 },
  { name: 'middle', base: [-0.008, 0.003, -0.097], L: [0.047, 0.029, 0.022], r: [0.0101, 0.0091, 0.0081], splay: 0 },
  { name: 'ring', base: [0.011, 0.002, -0.093], L: [0.044, 0.027, 0.021], r: [0.0095, 0.0086, 0.0077], splay: -0.06 },
  { name: 'little', base: [0.028, -0.001, -0.084], L: [0.034, 0.02, 0.019], r: [0.0085, 0.0077, 0.007], splay: -0.14 },
];
// the wrist ellipse shared by the palm's open end, the bridge and the forearm
export const WRIST = { w: 0.055, h: 0.037, e: 2.3, zHand: 0.012, zFore: 0.034 };
const THUMB = { base: [-0.022, -0.009, -0.02], L: [0.04, 0.031, 0.027], r: [0.0138, 0.0112, 0.0102] };

// One phalanx: a lathed capsule along -Z, slightly flattened, thinner mid-shaft.
function phalanxGeo(len, r0, r1, tip = false) {
  const pts = [];
  const n = 5;
  for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + (k / n) * (Math.PI / 2); pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); } // hemisphere at the base (z from -r0 to 0)
  const mid = Math.min(r0, r1) * 0.93;
  pts.push([lerp(r0, mid, 0.6), len * 0.3], [mid, len * 0.55]);
  if (tip) { // fingertip pad: widen slightly then round off
    pts.push([r1 * 1.02, len * 0.8]);
    for (let k = 1; k <= 6; k++) { const a = (k / 6) * (Math.PI / 2); pts.push([Math.cos(a) * r1 * 1.02, len * 0.8 + Math.sin(a) * r1 * 1.15]); }
  } else {
    pts.push([r1, len]);
    for (let k = 1; k <= n; k++) { const a = (k / n) * (Math.PI / 2); pts.push([Math.cos(a) * r1, len + Math.sin(a) * r1]); }
  }
  // latheZ maps [r, z] with z along +Z; we want the phalanx along -Z
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(Math.max(1e-5, r), z)), 16);
  g.rotateX(-Math.PI / 2); // +Y → -Z
  g.scale(1, 0.86, 1);
  return boxUV(g, 0.02);
}
function nailGeo(w, l) {
  const g = rbox(w, 0.0016, l, 0.0008, 2);
  // curve across the width
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - (x * x) / (w * 0.9)); }
  g.computeVertexNormals();
  return g;
}

// Palm: lofted from the wrist to the knuckles; thenar bulge on the thumb side, palm side.
function palmGeo(side) {
  const sec = [];
  // wrist part (continuous skin into the forearm, under the cuffs)
  sec.push({ p: [0, 0.001, 0.012], w: WRIST.w, h: WRIST.h, e: WRIST.e });
  const N = 9;
  for (let i = 1; i <= N; i++) {
    const t = i / N, z = lerp(0.008, -0.094, t);
    const w = lerp(0.056, 0.083, sstep(0, 0.65, t)) - 0.004 * sstep(0.85, 1, t);
    const h = lerp(0.036, 0.024, sstep(0, 0.7, t)) - 0.003 * sstep(0.9, 1, t);
    sec.push({ p: [side * lerp(0, -0.002, t), lerp(0.001, 0.0005, t), z], w, h, e: lerp(2.3, 2.6, sstep(0, 0.3, t)) });
  }
  const g = loft(roundEnds(sec, { start: false, end: true, n: 3 }), {
    radial: 32,
    r: (th, i, s) => {
      // th: 0 = +X side, PI/2 = back (+Y), PI = -X side, 3PI/2 = palm (-Y)
      const z = s.p[2], t = clamp((0.008 - z) / 0.102), wr = sstep(0.004, 0.02, z);
      const thumbSide = side > 0 ? Math.cos(th) < 0 : Math.cos(th) > 0; // -X for right
      const palmSide = Math.sin(th) < 0;
      let k = 1;
      // thenar eminence: the fleshy base of the thumb
      if (thumbSide && palmSide) k += 0.14 * Math.sin(Math.PI * clamp((t - 0.05) / 0.6)) * Math.pow(Math.abs(Math.cos(th - (side > 0 ? Math.PI * 1.2 : -Math.PI * 0.2))), 2);
      // hypothenar pad (little-finger side of the palm)
      if (!thumbSide && palmSide) k += 0.06 * Math.sin(Math.PI * clamp((t - 0.1) / 0.7)) * Math.abs(Math.sin(th));
      // metacarpal ridges on the back near the knuckles
      if (!palmSide) k += 0.018 * Math.max(0, Math.cos(th * 8)) * sstep(0.6, 0.95, t) * Math.sin(th);
      return 1 + (k - 1) * (1 - wr);
    },
  });
  return boxUV(g, 0.03);
}

export function makeHand(side = 1, o = {}) {
  const skin = o.skin || mat('skin'), nailM = mat('nail');
  const skinF = o.skinF || mat('skin', { c: 0x9e6250 }), skinT = o.skinT || mat('skin', { c: 0xa46252 });
  const crease = mat('skin', { c: 0x5e3a2e, rough: 0.8 });
  const root = new THREE.Group();
  root.name = side > 0 ? 'handR' : 'handL';
  const palm = new THREE.Mesh(palmGeo(side), skin); root.add(palm);
  // knuckle heads (MCP) on the back of the hand
  const fingers = FINGERS.map((f, fi) => {
    const base = new THREE.Group(); base.position.set(f.base[0] * side, f.base[1], f.base[2]); root.add(base);
    const kn = new THREE.Mesh(sphere(f.r[0] * 1.02, 14, 10), skinF); kn.scale.set(1.08, 0.85, 1.1); kn.position.set(0, 0.0028, 0.002); base.add(kn);
    const j = [base];
    let parent = base;
    const segs = [];
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(phalanxGeo(f.L[k], f.r[k], k < 2 ? f.r[k + 1] : f.r[k] * 0.9, k === 2), k === 2 ? skinT : skinF);
      parent.add(m); segs.push(m);
      if (k < 2) { const nj = new THREE.Group(); nj.position.set(0, 0, -f.L[k]); parent.add(nj); j.push(nj); parent = nj;
        const kb = new THREE.Mesh(sphere(f.r[k + 1] * 1.03, 12, 8), skinF); kb.scale.set(1.02, 0.78, 0.9); kb.position.set(0, f.r[k + 1] * 0.2, 0); nj.add(kb);
        for (const dz of [-0.0022, 0.0022]) { const cr = new THREE.Mesh(new THREE.TorusGeometry(f.r[k + 1] * 0.93, 0.00045, 4, 16, Math.PI * 0.8), crease); cr.rotation.set(0, 0, Math.PI * 0.1); cr.position.set(0, 0.0004, dz); nj.add(cr); } }
      else { const nail = new THREE.Mesh(nailGeo(f.r[2] * 1.45, f.L[2] * 0.55), nailM); nail.position.set(0, f.r[2] * 0.78, -f.L[2] * 0.62); nail.rotation.x = 0.06; parent.add(nail); }
    }
    return { ...f, fi, joints: j, segs };
  });
  // thumb: CMC joint on the palm side near the wrist
  const tb = new THREE.Group(); tb.position.set(THUMB.base[0] * side, THUMB.base[1], THUMB.base[2]); root.add(tb);
  const tj = [tb]; let tp = tb;
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(phalanxGeo(THUMB.L[k], THUMB.r[k], k < 2 ? THUMB.r[k + 1] : THUMB.r[k] * 0.9, k === 2), k === 0 ? skin : k === 2 ? skinT : skinF);
    if (k === 0) m.scale.set(1.3, 1.2, 1);
    tp.add(m);
    if (k < 2) { const nj = new THREE.Group(); nj.position.set(0, 0, -THUMB.L[k]); tp.add(nj); tj.push(nj); tp = nj; }
    else { const nail = new THREE.Mesh(nailGeo(THUMB.r[2] * 1.5, THUMB.L[2] * 0.55), nailM); nail.position.set(0, THUMB.r[2] * 0.8, -THUMB.L[2] * 0.6); nail.rotation.x = 0.05; tp.add(nail); }
  }
  const hand = { root, side, fingers, thumb: tj };
  // pose: curl per finger: number (0 open..1 fist) or [mcp, pip, dip] radians
  // spread: extra splay; thumb: { flex, abd, roll, c1, c2 } radians (see defaults)
  hand.pose = (P = {}) => {
    const curl = P.curl ?? 0.2;
    fingers.forEach((f, i) => {
      let c = Array.isArray(curl) ? curl[i] : curl;
      if (typeof c === 'number') c = [c * 1.45, c * 1.65, c * 1.1];
      const sp = (f.splay + (P.spread ?? 0) * (i - 1.5) * -0.08 + (P.splay ? P.splay[i] : 0)) * side;
      f.joints[0].rotation.set(-c[0], sp, 0, 'YXZ');
      f.joints[1].rotation.set(-c[1], 0, 0);
      f.joints[2].rotation.set(-c[2], 0, 0);
    });
    const T = { flex: 0.5, abd: 0.55, roll: 0.9, c1: 0.25, c2: 0.2, ...(P.thumb || {}) };
    if (T.dir) {
      // direction mode: the metacarpal points along dir (hand space, x mirrored for the left hand)
      const d = V3(T.dir[0] * side, T.dir[1], T.dir[2]).normalize();
      tj[0].quaternion.setFromUnitVectors(V3(0, 0, -1), d);
      tj[0].quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), (T.twist ?? 0) * side));
    } else tj[0].rotation.set(-T.flex, T.abd * side, -T.roll * side, 'YXZ');
    tj[1].rotation.set(-T.c1, 0, 0);
    tj[2].rotation.set(-T.c2, 0, 0);
  };
  hand.pose();
  return hand;
}

// Common hand poses
export const GRIPS = {
  relaxed: { curl: [0.25, 0.3, 0.35, 0.42], thumb: { flex: 0.35, abd: 0.5, roll: 0.8, c1: 0.2, c2: 0.2 } },
  fist: { curl: 1, thumb: { flex: 0.9, abd: 0.2, roll: 1.2, c1: 0.7, c2: 0.5 } },
  // pistol grip: index along the frame/trigger, three fingers wrapped, thumb high on the left side
  pistol: { curl: [[0.25, 1.05, 0.55], [1.05, 1.55, 0.8], [1.1, 1.6, 0.8], [1.15, 1.65, 0.8]], splay: [0.28, 0.05, 0, -0.05], thumb: { dir: [-0.3, -0.45, -0.84], twist: 1.6, c1: 0.12, c2: 0.08 } },
  pistolFire: { curl: [[0.35, 1.25, 0.7], [1.05, 1.55, 0.8], [1.1, 1.6, 0.8], [1.15, 1.65, 0.8]], splay: [0.28, 0.05, 0, -0.05], thumb: { dir: [-0.3, -0.45, -0.84], twist: 1.6, c1: 0.12, c2: 0.08 } },
  support: { curl: [[0.9, 1.3, 0.7], [0.95, 1.35, 0.75], [1.0, 1.4, 0.8], [1.0, 1.45, 0.85]], thumb: { dir: [-0.58, -0.06, -0.8], twist: 1.6, c1: 0.1, c2: 0.05 } },
  torch: { curl: [[1.0, 1.25, 0.75], [1.05, 1.3, 0.75], [1.05, 1.35, 0.8], [1.05, 1.4, 0.85]], thumb: { dir: [-0.29, -0.5, -0.81], twist: 1.4, c1: 0.3, c2: 0.2 } },
  knife: { curl: [[1.1, 1.4, 0.85], [1.15, 1.45, 0.85], [1.15, 1.5, 0.9], [1.15, 1.55, 0.95]], thumb: { dir: [-0.29, -0.5, -0.81], twist: 1.4, c1: 0.35, c2: 0.25 } },
  pump: { curl: [[0.8, 1.0, 0.55], [0.85, 1.05, 0.55], [0.85, 1.1, 0.6], [0.85, 1.15, 0.65]], thumb: { dir: [-0.9, -0.2, -0.38], twist: 1.4, c1: 0.15, c2: 0.1 } },
  ball: { curl: [[0.75, 0.8, 0.45], [0.8, 0.85, 0.45], [0.85, 0.9, 0.5], [0.9, 0.95, 0.55]], thumb: { dir: [-0.5, -0.55, -0.67], twist: 1.4, c1: 0.35, c2: 0.25 } },
  cradle: { curl: [[0.55, 0.65, 0.4], [0.75, 0.9, 0.5], [0.8, 0.95, 0.55], [0.85, 1.0, 0.6]], thumb: { dir: [-0.39, -0.37, -0.85], twist: 1.4, c1: 0.15, c2: 0.1 } },
  rack: { curl: [[1.0, 1.1, 0.6], [1.05, 1.15, 0.6], [1.1, 1.2, 0.65], [1.15, 1.25, 0.7]], thumb: { dir: [-0.5, -0.6, -0.6], twist: 1.4, c1: 0.3, c2: 0.2 } },
  // wrapping a cylinder of ~4 cm (flashlight body, pump, foregrip)
  wrap: { curl: [[1.05, 1.35, 0.75], [1.1, 1.4, 0.8], [1.1, 1.45, 0.8], [1.05, 1.5, 0.85]], thumb: { flex: 1.0, abd: 0.25, roll: 1.35, c1: 0.4, c2: 0.3 } },
  cup: { curl: [[0.6, 0.8, 0.5], [0.7, 0.9, 0.5], [0.8, 1.0, 0.55], [0.9, 1.1, 0.6]], thumb: { flex: 0.6, abd: 0.4, roll: 1.1, c1: 0.2, c2: 0.2 } },
  pinch: { curl: [[0.7, 0.9, 0.6], [0.9, 1.2, 0.8], [1.1, 1.4, 0.9], [1.2, 1.5, 0.9]], thumb: { flex: 0.9, abd: 0.3, roll: 1.3, c1: 0.35, c2: 0.3 } },
  flat: { curl: [0.05, 0.05, 0.05, 0.05], thumb: { flex: 0.2, abd: 0.7, roll: 0.4, c1: 0.1, c2: 0.05 } },
};
export function mixGrip(a, b, t) {
  const A = typeof a === 'string' ? GRIPS[a] : a, B = typeof b === 'string' ? GRIPS[b] : b;
  const toArr = (c) => (Array.isArray(c) ? c.map((x) => (typeof x === 'number' ? [x * 1.45, x * 1.65, x * 1.1] : x)) : [0, 1, 2, 3].map(() => [c * 1.45, c * 1.65, c * 1.1]));
  const ca = toArr(A.curl), cb = toArr(B.curl);
  const curl = ca.map((f, i) => f.map((v, k) => lerp(v, cb[i][k], t)));
  const thumb = {}; for (const k of ['flex', 'abd', 'roll', 'c1', 'c2']) thumb[k] = lerp(A.thumb[k], B.thumb[k], t);
  return { curl, thumb };
}

// ------------------------------------------------------------------ watch
function dialTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#ece6d4'; g.fillRect(0, 0, 256, 256);
  const rg = g.createRadialGradient(128, 128, 20, 128, 128, 128); rg.addColorStop(0, 'rgba(255,255,255,0.3)'); rg.addColorStop(1, 'rgba(120,100,70,0.35)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  for (let i = 0; i < 60; i++) {
    g.save(); g.rotate(i / 60 * Math.PI * 2);
    g.fillStyle = '#1a1a1a';
    if (i % 5 === 0) g.fillRect(-5, -118, 10, 30); else g.fillRect(-1.5, -118, 3, 10);
    g.restore();
  }
  const handAt = (a, L, W, col) => { g.save(); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(-W, 12); g.lineTo(-W * 0.6, -L); g.lineTo(0, -L - 8); g.lineTo(W * 0.6, -L); g.lineTo(W, 12); g.closePath(); g.fill(); g.restore(); };
  handAt(Math.PI * 2 * (10.2 / 12), 62, 7, '#111');   // ~10:10
  handAt(Math.PI * 2 * (10 / 60), 96, 5, '#111');
  g.save(); g.rotate(Math.PI * 2 * 0.62); g.fillStyle = '#b01818'; g.fillRect(-1.5, -104, 3, 124); g.restore();
  g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let dialTex = null;
// A watch centred on the origin, face up (+Y), 12 o'clock toward -Z (the hand).
// wristW/H: the wrist ellipse the strap wraps (strap centred at the origin's y - H/2).
function makeWatch(wristW, wristH) {
  const g = new THREE.Group();
  const R = 0.0175;
  const steel = mat('watchSteel');
  // case: a lathe (axis Y)
  const caseG = new THREE.LatheGeometry([[0.0001, 0], [R * 0.98, 0], [R * 1.04, 0.002], [R * 1.05, 0.006], [R * 1.0, 0.0085], [R * 0.9, 0.0095], [R * 0.86, 0.0092]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  g.add(new THREE.Mesh(caseG, steel));
  // bezel ring
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 0.9, 0.0012, 8, 40), steel); bezel.rotation.x = Math.PI / 2; bezel.position.y = 0.0092; g.add(bezel);
  // dial
  dialTex ||= dialTexture();
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R * 0.84, 40), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.4, metalness: 0 }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0086; g.add(dial);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R * 3, 32, 8, 0, Math.PI * 2, 0, 0.29), mat('watchGlass'));
  glass.position.y = 0.0092 - R * 3 * Math.cos(0.29) + 0.0009; g.add(glass);
  // lugs
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const lug = new THREE.Mesh(rbox(0.003, 0.004, 0.008, 0.001), steel); lug.position.set(sx * 0.0095, 0.004, sz * (R + 0.002)); lug.rotation.x = sz * 0.25; g.add(lug);
  }
  // crown at 3 o'clock (+X when 12 is -Z and face is +Y)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 12), steel); crown.rotation.z = Math.PI / 2; crown.position.set(R * 1.05 + 0.0012, 0.0045, 0); g.add(crown);
  // strap: a band following the wrist ellipse (below the case), leather
  const band = [];
  const cy = -wristH / 2 + 0.0005; // wrist centre relative to the case bottom
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    band.push([Math.cos(a) * (wristW / 2 + 0.0018), cy + Math.sin(a) * (wristH / 2 + 0.0018)]);
  }
  const strapG = new THREE.BufferGeometry();
  const pos = [], idx = []; const bw = 0.018, th = 0.0022;
  band.forEach(([x, y], i) => {
    const a = (i / n) * Math.PI * 2, nx = Math.cos(a) / (wristW / 2), ny = Math.sin(a) / (wristH / 2), L = Math.hypot(nx, ny);
    const ox = nx / L * th, oy = ny / L * th;
    for (const [dx, dy] of [[0, 0], [ox, oy]]) for (const z of [-bw / 2, bw / 2]) pos.push(x + dx, y + dy, z);
  });
  for (let i = 0; i < n; i++) {
    const b0 = i * 4, b1 = (i + 1) * 4;
    // outer face (1: outer -z, 3: outer +z), inner (0, 2), sides
    idx.push(b0 + 1, b1 + 1, b0 + 3, b0 + 3, b1 + 1, b1 + 3); // outer
    idx.push(b0 + 0, b0 + 2, b1 + 0, b0 + 2, b1 + 2, b1 + 0); // inner
    idx.push(b0 + 0, b1 + 0, b0 + 1, b0 + 1, b1 + 0, b1 + 1); // side -z
    idx.push(b0 + 2, b0 + 3, b1 + 2, b0 + 3, b1 + 3, b1 + 2); // side +z
  }
  strapG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); strapG.setIndex(idx); strapG.computeVertexNormals(); boxUV(strapG, 0.02);
  const strap = new THREE.Mesh(strapG, mat('watchStrap')); g.add(strap);
  return g;
}

// ------------------------------------------------------------------ forearm stack
// Built in forearm space (+Z toward the elbow). len = wrist→elbow. The coat
// sleeve continues past the elbow to `upperLen` along the upper-arm group.
function wrinkle(seed, amp) {
  return (th, i, s) => {
    const z = s.p[2];
    return 1 + amp * (fbm((th / (Math.PI * 2)) * 4 + seed, z * 6 + seed * 0.3, 4, 3, seed) - 0.5) * 2
      + amp * 0.6 * Math.sin(th * 3 + z * 40 + seed) * sstep(0.1, 0.25, z);
  };
}
export function makeForearm(side = 1, o = {}) {
  const g = new THREE.Group();
  const len = o.len ?? 0.27;
  const sx = side;
  // wrist + forearm skin (disappears inside the cuffs)
  const wristSec = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, z = lerp(WRIST.zFore, 0.085, t); wristSec.push({ p: [0, lerp(0.001, 0.002, t), z], w: lerp(WRIST.w, 0.06, t), h: lerp(WRIST.h, 0.043, t), e: 2.3 }); }
  const wrist = new THREE.Mesh(loft(wristSec, { radial: 28 }), o.skin || mat('skin')); g.add(wrist);
  // wrist bone bump (ulna head) on the little-finger side, back
  const ulna = new THREE.Mesh(sphere(0.0075, 12, 8), o.skin || mat('skin')); ulna.position.set(sx * 0.022, 0.009, 0.04); g.add(ulna);
  // shirt cuff (barrel cuff, a button on the outside)
  const shirt = [];
  for (let i = 0; i <= 5; i++) { const z = lerp(0.036, 0.1, i / 5); shirt.push({ p: [0, 0.001, z], w: 0.074 + 0.003 * (i / 5), h: 0.058 + 0.003 * (i / 5), e: 2.2 }); }
  const cuffR = new THREE.Mesh(loft(shirt, { radial: 32, r: wrinkle(3, 0.012) }), mat('shirt')); g.add(cuffR);
  // cuff edge roll (the rounded hem)
  const hem = new THREE.Mesh(loft(ringSections(0.074, 0.058, 0.036, 0.0028), { radial: 32 }), mat('shirt')); g.add(hem);
  // inner dark (so looking into the cuff shows shadow, not the back faces)
  const inner = new THREE.Mesh(loft([{ p: [0, 0.001, 0.034], w: 0.068, h: 0.052 }, { p: [0, 0.001, 0.06], w: 0.066, h: 0.05 }], { radial: 28 }), mat('black', { side: 'double' }));
  g.add(inner);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0018, 16), mat('button'));
  btn.rotation.z = Math.PI / 2; btn.position.set(sx * 0.0385, 0.004, 0.052); g.add(btn);
  // suit jacket cuff (charcoal, with three buttons on the outer side)
  const suit = [];
  for (let i = 0; i <= 6; i++) { const z = lerp(0.052, 0.16, i / 6); suit.push({ p: [0, 0.002, z], w: 0.086 + 0.006 * (i / 6), h: 0.07 + 0.005 * (i / 6), e: 2.2 }); }
  g.add(new THREE.Mesh(loft(suit, { radial: 32, r: wrinkle(7, 0.018) }), mat('suit')));
  g.add(new THREE.Mesh(loft(ringSections(0.086, 0.07, 0.052, 0.003), { radial: 32 }), mat('suit')));
  g.add(new THREE.Mesh(loft([{ p: [0, 0.002, 0.05], w: 0.08, h: 0.064 }, { p: [0, 0.002, 0.08], w: 0.078, h: 0.062 }], { radial: 28 }), mat('black', { side: 'double' })));
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 14), mat('black', { rough: 0.35, c: 0x151518 }));
    b.rotation.z = Math.PI / 2; b.position.set(sx * 0.0445, -0.004, 0.062 + k * 0.0085); g.add(b);
  }
  // trench-coat sleeve: wide wool, turned hem, a strap with a buckle
  const coat = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = lerp(0.07, len + 0.05, t);
    coat.push({ p: [0, 0.003 + 0.006 * t, z], w: lerp(0.106, 0.128, t) + 0.01 * Math.sin(t * Math.PI), h: lerp(0.09, 0.118, t), e: 2.1 });
  }
  g.add(new THREE.Mesh(loft(coat, { radial: 40, r: wrinkle(11, 0.028) }), mat('wool')));
  g.add(new THREE.Mesh(loft(ringSections(0.106, 0.09, 0.07, 0.0045), { radial: 40, r: wrinkle(11, 0.02) }), mat('wool')));
  g.add(new THREE.Mesh(loft([{ p: [0, 0.003, 0.068], w: 0.1, h: 0.084 }, { p: [0, 0.003, 0.11], w: 0.098, h: 0.082 }], { radial: 32 }), mat('woolLining')));
  // sleeve strap (a wool band) + buckle on the outer side
  const strapSec = [{ p: [0, 0.003, 0.098], w: 0.11, h: 0.094 }, { p: [0, 0.003, 0.122], w: 0.11, h: 0.094 }];
  const strap = new THREE.Mesh(loft(strapSec, { radial: 40, r: (th) => 1 + 0.03 + 0.01 * Math.sin(th * 5) }), mat('wool', { c: 0x242428 })); g.add(strap);
  const buckle = new THREE.Group(); buckle.position.set(sx * 0.058, 0.0, 0.11); buckle.rotation.set(0, 0, sx * -0.05); g.add(buckle);
  const bf = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 8, 4, Math.PI * 2), mat('buckle')); bf.rotation.set(0, Math.PI / 2, Math.PI / 4); bf.scale.set(1, 1.3, 1); buckle.add(bf);
  const prong = new THREE.Mesh(rbox(0.002, 0.002, 0.02, 0.0008), mat('buckle')); buckle.add(prong);
  // stitching lines near the hem (thin dark rings)
  for (const z of [0.082]) g.add(new THREE.Mesh(loft([{ p: [0, 0.003, z], w: 0.1085, h: 0.0925 }, { p: [0, 0.003, z + 0.0015], w: 0.1085, h: 0.0925 }], { radial: 40, r: wrinkle(11, 0.028) }), mat('black', { c: 0x18181a })));
  // watch (left wrist only)
  if (o.watch) {
    const w = makeWatch(0.056, 0.038);
    const pivot = new THREE.Group(); pivot.rotation.z = (o.watchRoll ?? 0.55) * -side; g.add(pivot); // turn the face toward the thumb side (reads in first person)
    w.position.set(0, 0.019 + 0.0015, 0.024);
    pivot.add(w);
  }
  return g;
}
// A rounded lip ring at z0 (the turned edge of a cuff): outer w/h, thickness t.
// Sections go from the outer surface, around the front edge, to the inside.
function ringSections(w, h, z0, t) {
  const out = [];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI; // 0 = outer, PI = inner
    out.push({ p: [0, 0.001, z0 + t * (1 - Math.sin(a))], w: w - t * (1 - Math.cos(a)), h: h - t * (1 - Math.cos(a)), t: [0, 0, 1] });
  }
  return out;
}

// Upper-arm coat sleeve from the elbow (origin) along +Z for len.
function makeUpperSleeve(side, len = 0.34) {
  const g = new THREE.Group();
  const sec = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, z = lerp(-0.06, len, t); sec.push({ p: [0, 0, z], w: lerp(0.13, 0.15, t), h: lerp(0.12, 0.14, t), e: 2.1 }); }
  g.add(new THREE.Mesh(loft(sec, { radial: 36, r: wrinkle(17 + side, 0.03) }), mat('wool')));
  // elbow bulge
  const el = new THREE.Mesh(sphere(0.064, 24, 16), mat('wool')); el.scale.set(1.0, 0.95, 1.0); g.add(el);
  return g;
}

// ------------------------------------------------------------------ arm
// An arm driven from its hand: arm.set(wristMatrixInCameraSpace) → the hand
// is placed there, the forearm follows the hand's back direction (with an
// optional wrist bend), the elbow is at wrist + len along it, and the upper
// sleeve points from the elbow toward the shoulder.
export function makeArm(side = 1, o = {}) {
  const root = new THREE.Group();
  const hand = makeHand(side, o);
  const fore = new THREE.Group(), foreMesh = makeForearm(side, { watch: o.watch ?? side < 0, len: o.len ?? 0.27 });
  fore.add(foreMesh);
  const upper = new THREE.Group(); upper.add(makeUpperSleeve(side));
  root.add(hand.root, fore, upper);
  // wrist bridge: skin blending the palm's open end (hand space) into the forearm's (forearm space)
  const RB = 28, NB = 7;
  const bridgeGeo = new THREE.BufferGeometry();
  bridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RB * NB * 3), 3));
  bridgeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(RB * NB * 2).map((_, i) => (i % 2 ? Math.floor(i / 2 / RB) / NB : (Math.floor(i / 2) % RB) / RB) * 3), 2));
  { const idx = []; for (let i = 0; i < NB - 1; i++) for (let j = 0; j < RB; j++) { const a = i * RB + j, b = i * RB + (j + 1) % RB, c = (i + 1) * RB + j, d = (i + 1) * RB + (j + 1) % RB; idx.push(a, b, c, b, d, c); } bridgeGeo.setIndex(idx); }
  const bridge = new THREE.Mesh(bridgeGeo, o.skin || mat('skin')); bridge.frustumCulled = false; root.add(bridge);
  const ell = []; for (let j = 0; j < RB; j++) { const th = (j / RB) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th); ell.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / WRIST.e) * WRIST.w / 2, Math.sign(sn) * Math.pow(Math.abs(sn), 2 / WRIST.e) * WRIST.h / 2]); }
  const updateBridge = () => {
    // ring A: hand space z = zHand going +Z; ring B: forearm space z = zFore going +Z
    const pA = V3(0, 0.001, WRIST.zHand).applyQuaternion(hand.root.quaternion).add(hand.root.position);
    const pB = V3(0, 0.001, WRIST.zFore).applyQuaternion(fore.quaternion).add(fore.position);
    const tA = V3(0, 0, 1).applyQuaternion(hand.root.quaternion), tB = V3(0, 0, 1).applyQuaternion(fore.quaternion);
    const L = pA.distanceTo(pB);
    const pos = bridgeGeo.attributes.position;
    for (let i = 0; i < NB; i++) {
      const t = i / (NB - 1), h1 = 2 * t ** 3 - 3 * t ** 2 + 1, h2 = t ** 3 - 2 * t ** 2 + t, h3 = -2 * t ** 3 + 3 * t ** 2, h4 = t ** 3 - t ** 2;
      const c = pA.clone().multiplyScalar(h1).addScaledVector(tA, h2 * L).addScaledVector(pB, h3).addScaledVector(tB, h4 * L);
      const q = hand.root.quaternion.clone().slerp(fore.quaternion, t);
      const X = V3(1, 0, 0).applyQuaternion(q), Y = V3(0, 1, 0).applyQuaternion(q);
      for (let j = 0; j < RB; j++) { const v = c.clone().addScaledVector(X, ell[j][0]).addScaledVector(Y, ell[j][1]); pos.setXYZ(i * RB + j, v.x, v.y, v.z); }
    }
    pos.needsUpdate = true; bridgeGeo.computeVertexNormals(); bridgeGeo.computeBoundingSphere();
  };
  const shoulder = V3(...(o.shoulder || [side * 0.24, -0.34, 0.12]));
  const len = o.len ?? 0.27;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V3(), _s = V3();
  const arm = { root, hand, fore, upper, side, shoulder, len, visible: true };
  // wrist: { p:[x,y,z], q: Quaternion } in the arm root's parent space
  // bend: [pitch, yaw] of the forearm relative to the hand (radians)
  // Default elbow: low and out to the side, a little ahead of the camera.
  const elbowDefault = V3(...(o.elbow || [side * 0.25, -0.4, -0.06]));
  arm.place = (p, q, { bend = [0, 0], shoulder: sh = null, roll = 0, elbow = null, twist = 0 } = {}) => {
    hand.root.position.copy(p); hand.root.quaternion.copy(q);
    fore.position.copy(p);
    const E = elbow === 'hand' ? null : elbow ? V3(...elbow) : elbowDefault;
    if (E) {
      // aim the forearm (+Z) from the wrist at the elbow; keep its +Y near the hand's back
      const dir = E.clone().sub(p).normalize();
      const hy = V3(0, 1, 0).applyQuaternion(q);
      let y = hy.clone().addScaledVector(dir, -hy.dot(dir));
      if (y.lengthSq() < 1e-6) y = V3(0, 1, 0).addScaledVector(dir, -dir.y);
      y.normalize();
      const x = new THREE.Vector3().crossVectors(y, dir).normalize();
      _m.makeBasis(x, y, dir);
      fore.quaternion.setFromRotationMatrix(_m);
      if (twist) fore.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), twist * side));
    } else {
      const bq = new THREE.Quaternion().setFromEuler(new THREE.Euler(bend[0], bend[1] * side, roll * side, 'YXZ'));
      fore.quaternion.copy(q).multiply(bq);
    }
    const elbowP = V3(0, 0, len).applyQuaternion(fore.quaternion).add(p);
    const S = sh ? V3(...sh) : shoulder;
    upper.position.copy(elbowP);
    const dir = S.clone().sub(elbowP).normalize();
    const fy = V3(0, 1, 0).applyQuaternion(fore.quaternion);
    const x = new THREE.Vector3().crossVectors(fy, dir).normalize(), y = new THREE.Vector3().crossVectors(dir, x).normalize();
    _m.makeBasis(x, y, dir); upper.quaternion.setFromRotationMatrix(_m);
    arm.elbow = elbowP;
    updateBridge();
  };
  arm.show = (v) => { root.visible = v; arm.visible = v; };
  return arm;
}
// Build a quaternion from Euler (radians) in 'YXZ' order (yaw, pitch, roll) — the natural order for hands.
export const Q = (x = 0, y = 0, z = 0, order = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
