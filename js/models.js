// Procedural low-poly models in an early-Xbox style: smooth, bevelled shapes
// (chamfers, lathes, extrusions), Phong specular + normal-mapped detail
// textures, emissive trims. No boxes left raw: every collider is dressed.
//
//   MAT(name)                       shared materials
//   GB                              geometry builder with world-space UVs (static batching)
//   buildStatic(level, theme)       merged meshes for boxes + deco (by material)
//   makeCondor() / makeTarget(kind) / makePines(trees)   (characters: rigs.js, guns: gunmodels.js)
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from './vendor/addons/BufferGeometryUtils.js';
import { getTex, spriteTex, labelTex } from './textures.js';
import { mulberry32 } from './utils.js';

// ------------------------------------------------------------ materials
// rep = metres per texture tile for world-UV geometry
const MDEF = {
  metal: { tex: 'metal', spec: 0x6a6a6a, shine: 38, rep: 3 },
  hull: { tex: 'hull', spec: 0x5a4a78, shine: 46, rep: 9, em: 0x6effa0, emI: 1.2 },
  hullIn: { tex: 'hullIn', spec: 0x6a5088, shine: 34, rep: 5, em: 0x6effa0, emI: 1.1 },
  alienFloor: { tex: 'alienFloor', spec: 0x554466, shine: 40, rep: 3.5, em: 0x6effa0, emI: 0.6 },
  alien: { tex: 'vyrrArmor', spec: 0xaa88dd, shine: 64, rep: 1.6, em: 0x8cffb0, emI: 1.0, color: 0xa898c8 },
  concrete: { tex: 'concrete', spec: 0x1c1c1c, shine: 8, rep: 4 },
  asphalt: { tex: 'asphalt', spec: 0x151515, shine: 6, rep: 4 },
  rock: { tex: 'rock', spec: 0x202020, shine: 10, rep: 4 },
  cliff: { tex: 'cliff', spec: 0x202020, shine: 10, rep: 6 },
  stone: { tex: 'stone', spec: 0x222222, shine: 12, rep: 3 },
  brick: { tex: 'brick', spec: 0x151515, shine: 8, rep: 4 },
  c_red: { tex: 'corrugated', spec: 0x333333, shine: 20, rep: 3, color: 0xa8382c },
  c_blue: { tex: 'corrugated', spec: 0x333333, shine: 20, rep: 3, color: 0x2c5a9a },
  c_orange: { tex: 'corrugated', spec: 0x333333, shine: 20, rep: 3, color: 0xd8782a },
  c_green: { tex: 'corrugated', spec: 0x333333, shine: 20, rep: 3, color: 0x3a7a4a },
  c_grey: { tex: 'corrugated', spec: 0x333333, shine: 20, rep: 3, color: 0x9aa0a4 },
  crate: { tex: 'crate', spec: 0x222222, shine: 14, rep: 1 },
  grate: { tex: 'grate', spec: 0x777777, shine: 40, rep: 1.5, alphaTest: 0.5, side: THREE.DoubleSide },
  wreck: { tex: 'wreck', spec: 0x333333, shine: 20, rep: 2 },
  ecs: { tex: 'ecs', spec: 0x444444, shine: 30, rep: 1.5 },
  pod: { tex: 'pod', spec: 0x88aacc, shine: 60, rep: 2, em: 0x55ffe0, emI: 1.2 },
  door: { tex: 'door', spec: 0x886699, shine: 50, rep: 4, em: 0xb070ff, emI: 1.3 },
  shutter: { tex: 'corrugated', spec: 0x333333, shine: 18, rep: 2.5, color: 0x70767c },
  roof: { tex: 'roof', spec: 0x222222, shine: 10, rep: 3 },
  fence: { tex: 'fence', spec: 0x555555, shine: 30, rep: 2, alphaTest: 0.5, side: THREE.DoubleSide },
  glass: { tex: 'glass', spec: 0xffffff, shine: 90, rep: 2, transparent: true },
  wood: { tex: 'bark', spec: 0x111111, shine: 6, rep: 1 },
  needles: { tex: 'needles', spec: 0x111111, shine: 6, rep: 1 },
  core: { tex: 'hullIn', spec: 0x88ffaa, shine: 80, rep: 2, em: 0x6effa0, emI: 2.2 },
  screen: { tex: 'screen', spec: 0x333333, shine: 60, rep: 1, em: 0xffffff, emI: 1.6 },
  scales: { tex: 'scales', spec: 0x445533, shine: 28, rep: 1 },
  vyrr: { tex: 'vyrrArmor', spec: 0xb090ff, shine: 70, rep: 1, em: 0x8cffb0, emI: 0.9 },
  vyrrGold: { tex: 'vyrrArmor', spec: 0xffe0a0, shine: 70, rep: 1, color: 0xd8a860, em: 0xffd080, emI: 0.6 },
  ecsArmor: { tex: 'ecsArmor', spec: 0x77886a, shine: 46, rep: 1 },
  suit: { tex: 'suit', spec: 0x1a1c20, shine: 10, rep: 1 },
  suitPlate: { tex: 'suitPlate', spec: 0x6a7078, shine: 48, rep: 1 },
  flightsuit: { tex: 'flightsuit', spec: 0x30283a, shine: 14, rep: 1 },
  harness: { tex: 'harness', spec: 0x222222, shine: 12, rep: 1 },
  visor: { color: 0x0b0f14, spec: 0xffffff, shine: 140 },
  windows: { tex: 'windows', spec: 0x333333, shine: 30, rep: 12, em: 0xffffff, emI: 1.0 },
  pineCard: { sprite: 'pineBranch', spec: 0x0a0a0a, shine: 4, rep: 1, alphaTest: 0.5, side: THREE.DoubleSide },
  leafCard: { sprite: 'leafCard', spec: 0x0a0a0a, shine: 4, rep: 1, alphaTest: 0.5, side: THREE.DoubleSide },
  gunmetal: { tex: 'gunmetal', spec: 0x9aa0a8, shine: 60, rep: 1 },
  gunOlive: { tex: 'suitPlate', spec: 0x778088, shine: 44, rep: 1, color: 0xa8aeb0 },
  sand: { tex: 'sand', spec: 0x111111, shine: 6, rep: 3 },
  black: { color: 0x151515, spec: 0x333333, shine: 30 },
  tire: { color: 0x1a1a1a, spec: 0x111111, shine: 8 },
  bush: { tex: 'needles', spec: 0x111111, shine: 6, rep: 1, color: 0x9ac080 },
  soil: { tex: 'scorched', spec: 0x000000, shine: 2, rep: 2, color: 0x6a5a40 },
  rubble: { tex: 'concrete', spec: 0x111111, shine: 6, rep: 2, color: 0x8a847a },
};
const cache = new Map();
let QUALITY = 'high';
export function setQuality(q) { QUALITY = q; }
export function MAT(name) {
  if (cache.has(name)) return cache.get(name);
  const d = MDEF[name] || MDEF.metal;
  const o = { color: d.color ?? 0xffffff, specular: d.spec ?? 0x222222, shininess: d.shine ?? 20 };
  if (d.sprite) { o.map = spriteTex(d.sprite); o.map.wrapS = o.map.wrapT = THREE.RepeatWrapping; }
  if (d.tex) {
    const t = getTex(d.tex);
    o.map = t.map;
    if (QUALITY !== 'low') { o.normalMap = t.normalMap; o.normalScale = new THREE.Vector2(1, 1); }
    if (d.em && t.emissiveMap) { o.emissiveMap = t.emissiveMap; o.emissive = new THREE.Color(d.em); o.emissiveIntensity = d.emI ?? 1; }
  }
  if (d.alphaTest) o.alphaTest = d.alphaTest;
  if (d.side) o.side = d.side;
  if (d.transparent) { o.transparent = true; o.depthWrite = false; o.opacity = 0.55; }
  const m = new THREE.MeshPhongMaterial(o);
  m.userData.rep = d.rep || 2;
  cache.set(name, m);
  return m;
}
export function glowMat(color, opacity = 1) {
  const k = `glow:${color}:${opacity}`;
  if (!cache.has(k)) cache.set(k, new THREE.SpriteMaterial({ map: spriteTex('glow'), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  return cache.get(k);
}
export function basicGlow(color, opacity = 1) {
  const k = `bg:${color}:${opacity}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  return cache.get(k);
}
export function emissiveMat(color, intensity = 1.5) {
  const k = `em:${color}:${intensity}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshPhongMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, specular: 0x222222, shininess: 30 }));
  return cache.get(k);
}

// ------------------------------------------------------------ geometry builder
// Non-indexed triangles, grouped by material. UV modes:
//   'world' : planar world UVs from the dominant normal axis, / rep (seamless tiling)
//   'local' : a 0..1 square per face (crates, screens)
export class GB {
  constructor() { this.parts = new Map(); }
  _p(mat) { if (!this.parts.has(mat)) this.parts.set(mat, { pos: [], nrm: [], uv: [] }); return this.parts.get(mat); }
  tri(mat, a, b, c, n, uvs) {
    const P = this._p(mat);
    // fix winding to match n
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    let A = a, B = b, C = c, ua = uvs?.[0], ub = uvs?.[1], uc = uvs?.[2];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { B = c; C = b; ub = uvs?.[2]; uc = uvs?.[1]; }
    const rep = MAT(mat).userData.rep;
    for (const [p, u] of [[A, ua], [B, ub], [C, uc]]) {
      P.pos.push(p[0], p[1], p[2]); P.nrm.push(n[0], n[1], n[2]);
      if (u) P.uv.push(u[0], u[1]);
      else {
        const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
        if (ay >= ax && ay >= az) P.uv.push(p[0] / rep, p[2] / rep);
        else if (ax >= az) P.uv.push(p[2] / rep, p[1] / rep);
        else P.uv.push(p[0] / rep, p[1] / rep);
      }
    }
  }
  quad(mat, a, b, c, d, n, uvs) {
    this.tri(mat, a, b, c, n, uvs && [uvs[0], uvs[1], uvs[2]]);
    this.tri(mat, a, c, d, n, uvs && [uvs[0], uvs[2], uvs[3]]);
  }
  // Chamfered box (flat bevel faces catch the specular: the early-Xbox edge highlight).
  cbox(mat, min, max, c = 0.06, uvMode = 'world') {
    c = Math.min(c, (max[0] - min[0]) / 2.2, (max[1] - min[1]) / 2.2, (max[2] - min[2]) / 2.2);
    const lo = min, hi = max;
    const P = (x, y, z) => [x, y, z];
    const S2 = Math.SQRT1_2, S3 = 1 / Math.sqrt(3);
    const local = uvMode === 'local';
    const luv = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
    // six main faces
    for (let a = 0; a < 3; a++) {
      for (const s of [-1, 1]) {
        const b = (a + 1) % 3, e = (a + 2) % 3;
        const v = s > 0 ? hi[a] : lo[a];
        const corner = (bv, ev) => { const p = [0, 0, 0]; p[a] = v; p[b] = bv; p[e] = ev; return p; };
        const n = [0, 0, 0]; n[a] = s;
        const b0 = lo[b] + c, b1 = hi[b] - c, e0 = lo[e] + c, e1 = hi[e] - c;
        this.quad(mat, corner(b0, e0), corner(b1, e0), corner(b1, e1), corner(b0, e1), n, local ? luv(1, 1) : null);
      }
    }
    // twelve edge bevels
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3, e = (a + 2) % 3; // edge runs along e, bevel between faces a and b
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const va = sa > 0 ? hi[a] : lo[a], vb = sb > 0 ? hi[b] : lo[b];
        const pt = (da, db, ev) => { const p = [0, 0, 0]; p[a] = va - sa * da; p[b] = vb - sb * db; p[e] = ev; return p; };
        const n = [0, 0, 0]; n[a] = sa * S2; n[b] = sb * S2;
        const e0 = lo[e] + c, e1 = hi[e] - c;
        this.quad(mat, pt(0, c, e0), pt(c, 0, e0), pt(c, 0, e1), pt(0, c, e1), n, local ? luv(0.05, 1) : null);
      }
    }
    // eight corners
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const X = sx > 0 ? hi[0] : lo[0], Y = sy > 0 ? hi[1] : lo[1], Z = sz > 0 ? hi[2] : lo[2];
      this.tri(mat, P(X, Y - sy * c, Z - sz * c), P(X - sx * c, Y, Z - sz * c), P(X - sx * c, Y - sy * c, Z), [sx * S3, sy * S3, sz * S3], local ? [[0, 0], [0.05, 0], [0, 0.05]] : null);
    }
  }
  // Extrude a closed convex-or-not 2D profile [[u,v],...] (CCW) along an axis.
  // axis 'x': profile is (z, y), from x0 to x1. axis 'z': profile is (x, y). axis 'y': profile is (x, z).
  extrude(mat, prof, axis, a0, a1, { caps = true, smooth = false } = {}) {
    const to3 = (u, v, a) => (axis === 'x' ? [a, v, u] : axis === 'z' ? [u, v, a] : [u, a, v]);
    let area = 0;
    for (let i = 0; i < prof.length; i++) { const p = prof[i], q = prof[(i + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
    if (area < 0) prof = prof.slice().reverse(); // make it CCW so edge normals point out
    // axis 'x' maps (u,v)→(z,y) and 'y' maps (u,v)→(x,z): both mirror handedness, which tri() fixes from n
    const n = prof.length;
    for (let i = 0; i < n; i++) {
      const p = prof[i], q = prof[(i + 1) % n];
      const du = q[0] - p[0], dv = q[1] - p[1], L = Math.hypot(du, dv) || 1;
      // outward normal of a CCW polygon edge: (dv, -du)
      let nu = dv / L, nv = -du / L;
      const nn = axis === 'x' ? [0, nv, nu] : axis === 'z' ? [nu, nv, 0] : [nu, 0, nv];
      if (smooth) { /* flat faces are fine for low-poly */ }
      this.quad(mat, to3(p[0], p[1], a0), to3(q[0], q[1], a0), to3(q[0], q[1], a1), to3(p[0], p[1], a1), nn);
    }
    if (caps) {
      const tris = THREE.ShapeUtils.triangulateShape(prof.map(([u, v]) => new THREE.Vector2(u, v)), []);
      for (const [s, a] of [[-1, a0], [1, a1]]) {
        const nn = axis === 'x' ? [s, 0, 0] : axis === 'z' ? [0, 0, s] : [0, s, 0];
        for (const t of tris) this.tri(mat, to3(...prof[t[0]], a), to3(...prof[t[1]], a), to3(...prof[t[2]], a), nn);
      }
    }
  }
  // Append a BufferGeometry (any three primitive) transformed by matrix m.
  addGeo(mat, geo, m, uvMode = 'world') {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const P = this._p(mat), rep = MAT(mat).userData.rep;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      P.pos.push(v.x, v.y, v.z); P.nrm.push(n.x, n.y, n.z);
      if (uvMode === 'world' || !uv) {
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        if (ay >= ax && ay >= az) P.uv.push(v.x / rep, v.z / rep); else if (ax >= az) P.uv.push(v.z / rep, v.y / rep); else P.uv.push(v.x / rep, v.y / rep);
      } else P.uv.push(uv.getX(i) * (uvMode.su || 1), uv.getY(i) * (uvMode.sv || 1));
    }
  }
  meshes() {
    const out = [];
    for (const [mat, P] of this.parts) {
      if (!P.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, MAT(mat));
      m.matrixAutoUpdate = false;
      m.receiveShadow = true; m.castShadow = true;
      out.push(m);
    }
    return out;
  }
}

// ------------------------------------------------------------ small shape helpers
const M4 = () => new THREE.Matrix4();
function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function noise3(x, y, z, s) {
  return Math.sin(x * 1.7 + s) * Math.sin(y * 2.3 + s * 1.3) * Math.sin(z * 1.9 + s * 0.7) * 0.5
    + Math.sin(x * 3.9 + y * 2.1 + s) * 0.25 + Math.sin(z * 4.7 - x * 1.3 + s * 2) * 0.15;
}
export function rockGeo(seed, detail = 2, rough = 0.28) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + noise3(v.x * 1.3, v.y * 1.3, v.z * 1.3, seed) * rough;
    v.multiplyScalar(k);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3; // flattish base
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}
function lathe(points, seg = 12) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

// ======================================================================
// STATIC LEVEL DRESSING
// ======================================================================
export function buildStatic(level, gb, dyn) {
  const rng = mulberry32(99);
  const theme = level.theme;
  const rockMat = level.id === 'gorge' ? 'cliff' : 'rock';
  for (const b of level.boxes) {
    const look = b.look || 'wall';
    if (look === 'none' || b.door) continue;
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    switch (look) {
      case 'rock': {
        const s = rng() * 100;
        gb.addGeo(rockMat, rockGeo(s, 2, 0.3), trs(cx, y0 + h * 0.45, cz, 0, rng() * 6, 0, w * 0.62, h * 0.62, d * 0.62));
        break;
      }
      case 'chunk': { // a torn slab of Vyrr hull buried in the dirt
        const s = rng() * 100;
        gb.addGeo('hull', rockGeo(s, 1, 0.45), trs(cx, y0 + h * 0.42, cz, 0.2, rng() * 6, 0.15, w * 0.6, h * 0.6, d * 0.6));
        const plate = new THREE.CylinderGeometry(Math.max(w, d) * 0.7, Math.max(w, d) * 0.7, Math.min(w, d) * 0.9, 10, 1, true, 0, 1.6);
        gb.addGeo('hull', plate, trs(cx, y0 + h * 0.5, cz, 0, rng() * 6, Math.PI / 2 + (rng() - 0.5) * 0.6, 1, 1, 1));
        break;
      }
      case 'container': {
        gb.cbox(b.mat, b.min, b.max, 0.05);
        // corner castings + door bars on the short ends
        const along = b.along === 'x' ? 0 : 2;
        for (const s of [-1, 1]) {
          const e = along === 2 ? (s > 0 ? z1 : z0) : (s > 0 ? x1 : x0);
          for (const t of [0.3, 0.7]) {
            if (along === 2) gb.cbox('metal', [x0 + w * t - 0.04, y0 + 0.15, e - 0.05 * s - 0.03], [x0 + w * t + 0.04, y1 - 0.15, e + 0.05 * s + 0.03], 0.02);
            else gb.cbox('metal', [e - 0.05 * s - 0.03, y0 + 0.15, z0 + d * t - 0.04], [e + 0.05 * s + 0.03, y1 - 0.15, z0 + d * t + 0.04], 0.02);
          }
        }
        break;
      }
      case 'pod': {
        const r = Math.min(w, d) / 2;
        gb.addGeo('pod', new THREE.CylinderGeometry(r * 0.92, r, h * 0.78, 6), trs(cx, y0 + h * 0.39, cz, 0, Math.PI / 6), { su: 3, sv: 2 });
        gb.addGeo('pod', new THREE.CylinderGeometry(r * 0.55, r * 0.92, h * 0.2, 6), trs(cx, y0 + h * 0.88, cz, 0, Math.PI / 6), { su: 3, sv: 1 });
        gb.addGeo('alien', new THREE.TorusGeometry(r * 0.97, 0.06, 4, 6), trs(cx, y0 + h * 0.5, cz, Math.PI / 2, 0, Math.PI / 6));
        break;
      }
      case 'crate': gb.cbox('crate', b.min, b.max, 0.06, 'local'); break;
      case 'console': {
        const along = w >= d ? 'x' : 'z';
        const depth = along === 'x' ? d : w;
        const prof = [[-depth / 2, 0], [depth / 2, 0], [depth / 2, h * 0.55], [depth * 0.1, h], [-depth / 2, h]];
        if (along === 'x') gb.extrude('alien', prof.map(([u, v]) => [cz + u, y0 + v]), 'x', x0, x1);
        else gb.extrude('alien', prof.map(([u, v]) => [cx + u, y0 + v]), 'z', z0, z1);
        // glowing screen on the slope
        const sx0 = along === 'x' ? x0 + 0.15 : cx + depth * 0.52, sx1 = along === 'x' ? x1 - 0.15 : cx + depth * 0.52;
        void sx0; void sx1;
        if (along === 'x') {
          const a = [x0 + 0.15, y0 + h * 0.6, cz + depth * 0.46], bb = [x1 - 0.15, y0 + h * 0.6, cz + depth * 0.46], c = [x1 - 0.15, y0 + h * 0.97, cz + depth * 0.12], dd = [x0 + 0.15, y0 + h * 0.97, cz + depth * 0.12];
          gb.quad('screen', [a[0], a[1], a[2] + 0.01], [bb[0], bb[1], bb[2] + 0.01], [c[0], c[1], c[2] + 0.01], [dd[0], dd[1], dd[2] + 0.01], [0, 0.8, 0.6], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        }
        break;
      }
      case 'barrier': {
        const along = w >= d ? 'x' : 'z', t = along === 'x' ? d : w;
        const prof = [[-t / 2, 0], [t / 2, 0], [t / 2, h * 0.12], [t * 0.2, h * 0.35], [t * 0.16, h], [-t * 0.16, h], [-t * 0.2, h * 0.35], [-t / 2, h * 0.12]];
        if (along === 'x') gb.extrude(b.mat, prof.map(([u, v]) => [cz + u, y0 + v]), 'x', x0, x1);
        else gb.extrude(b.mat, prof.map(([u, v]) => [cx + u, y0 + v]), 'z', z0, z1);
        break;
      }
      case 'car': carWreck(gb, b, rng); break;
      case 'droppod': {
        const r = Math.min(w, d) / 2;
        gb.addGeo('ecs', new THREE.CylinderGeometry(r * 0.85, r, h * 0.75, 8), trs(cx, y0 + h * 0.375, cz), { su: 2, sv: 1 });
        gb.addGeo('ecs', new THREE.CylinderGeometry(r * 0.3, r * 0.85, h * 0.35, 8), trs(cx, y0 + h * 0.92, cz), { su: 2, sv: 0.5 });
        gb.addGeo('metal', new THREE.TorusGeometry(r * 0.9, 0.07, 4, 8), trs(cx, y0 + h * 0.2, cz, Math.PI / 2));
        break;
      }
      case 'catwalk': {
        gb.quad('grate', [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
        const t = 0.12;
        if (w > d) { gb.cbox('metal', [x0, y0 - 0.1, z0], [x1, y1, z0 + t], 0.02); gb.cbox('metal', [x0, y0 - 0.1, z1 - t], [x1, y1, z1], 0.02); }
        else { gb.cbox('metal', [x0, y0 - 0.1, z0], [x0 + t, y1, z1], 0.02); gb.cbox('metal', [x1 - t, y0 - 0.1, z0], [x1, y1, z1], 0.02); }
        break;
      }
      case 'rail': {
        const alongZ = d > w, L = alongZ ? d : w, n = Math.max(2, Math.round(L / 1.6));
        for (let i = 0; i <= n; i++) {
          const t = i / n, px = alongZ ? cx : x0 + w * t, pz = alongZ ? z0 + d * t : cz;
          gb.addGeo('metal', new THREE.CylinderGeometry(0.035, 0.035, h, 5), trs(px, y0 + h / 2, pz));
        }
        for (const hy of [0.5, 0.98]) {
          gb.addGeo('metal', new THREE.CylinderGeometry(0.03, 0.03, L, 5), trs(cx, y0 + h * hy, cz, alongZ ? Math.PI / 2 : 0, 0, alongZ ? 0 : Math.PI / 2));
        }
        break;
      }
      case 'step': gb.cbox(b.mat === 'grate' ? 'metal' : b.mat, b.min, b.max, 0.03); break;
      case 'bridge': stoneBridge(gb, b); break;
      case 'barricade': {
        const along = w >= d ? 'x' : 'z', L = along === 'x' ? w : d;
        const plate = new THREE.CylinderGeometry(L * 0.9, L * 0.9, h, 10, 1, true, -0.55, 1.1);
        gb.addGeo('alien', plate, trs(cx - (along === 'z' ? L * 0.9 - 0.2 : 0), y0 + h / 2, cz - (along === 'x' ? L * 0.9 - 0.2 : 0), 0, along === 'x' ? 0 : Math.PI / 2, 0), { su: 2, sv: 1 });
        gb.cbox('alien', [cx - 0.15, y0, cz - 0.15], [cx + 0.15, y0 + h * 1.25, cz + 0.15], 0.05);
        break;
      }
      case 'sled': {
        gb.addGeo('alien', new THREE.SphereGeometry(1, 8, 5), trs(cx, y0 + h * 0.55, cz, 0, 0, 0, w / 2, h * 0.45, d / 2), { su: 2, sv: 1 });
        gb.cbox('pod', [x0 + 0.3, y0 + h * 0.2, z0 + 0.3], [x1 - 0.3, y0 + h * 0.5, z1 - 0.3], 0.1);
        break;
      }
      case 'pedestal': {
        gb.cbox('ecs', b.min, b.max, 0.08);
        break;
      }
      case 'fountain': {
        const r = w / 2;
        gb.addGeo('stone', new THREE.CylinderGeometry(r, r * 1.05, h, 8, 1, true), trs(cx, y0 + h / 2, cz), { su: 4, sv: 0.5 });
        gb.addGeo('stone', new THREE.CylinderGeometry(r - 0.4, r - 0.4, h, 8, 1, true), trs(cx, y0 + h / 2, cz), { su: 4, sv: 0.5 });
        gb.addGeo('stone', new THREE.RingGeometry(r - 0.4, r, 8), trs(cx, y1, cz, -Math.PI / 2));
        gb.addGeo('stone', new THREE.CylinderGeometry(0.5, 0.8, 3.2, 8), trs(cx, y0 + 1.6, cz), { su: 1, sv: 1 });
        gb.addGeo('stone', new THREE.CylinderGeometry(1.4, 0.3, 0.4, 8), trs(cx, y0 + 3.2, cz), { su: 1, sv: 0.2 });
        break;
      }
      case 'column': {
        const r = w / 2;
        gb.cbox('stone', [x0 - 0.1, y0, z0 - 0.1], [x1 + 0.1, y0 + 0.6, z1 + 0.1], 0.08);
        gb.addGeo('stone', new THREE.CylinderGeometry(r * 0.72, r * 0.8, h - 1.2, 16), trs(cx, y0 + h / 2, cz), { su: 2, sv: 2 });
        gb.cbox('stone', [x0 - 0.15, y1 - 0.6, z0 - 0.15], [x1 + 0.15, y1, z1 + 0.15], 0.1);
        break;
      }
      case 'planter': {
        gb.cbox('stone', b.min, [x1, y1 - 0.05, z1], 0.08);
        gb.addGeo('bush', rockGeo(rng() * 50, 1, 0.35), trs(cx, y1 + 0.35, cz, 0, rng() * 6, 0, w * 0.4, 0.55, d * 0.4));
        break;
      }
      case 'kiosk': {
        gb.cbox('metal', b.min, [x1, y1 - 0.4, z1], 0.06);
        gb.addGeo('c_red', new THREE.CylinderGeometry(w * 0.8, w * 0.8, 0.4, 8, 1, false, 0, Math.PI * 2), trs(cx, y1 - 0.2, cz, 0, Math.PI / 8, 0, 1, 1, 1), { su: 3, sv: 0.3 });
        break;
      }
      case 'busstop': {
        gb.cbox('metal', [x0, y1 - 0.15, z0], [x1, y1, z1], 0.04);
        for (const px of [x0 + 0.1, x1 - 0.1]) gb.addGeo('metal', new THREE.CylinderGeometry(0.06, 0.06, h, 6), trs(px, y0 + h / 2, z0 + 0.1));
        gb.quad('glass', [x0, y0 + 0.2, z0 + 0.1], [x1, y0 + 0.2, z0 + 0.1], [x1, y1 - 0.15, z0 + 0.1], [x0, y1 - 0.15, z0 + 0.1], [0, 0, 1], [[0, 0], [3, 0], [3, 1], [0, 1]]);
        break;
      }
      case 'fence': {
        gb.quad('fence', [x0, y0, cz], [x1, y0, cz], [x1, y1, cz], [x0, y1, cz], [0, 0, 1]);
        for (let px = x0; px <= x1 + 0.01; px += 3) gb.addGeo('metal', new THREE.CylinderGeometry(0.05, 0.05, h, 6), trs(px, y0 + h / 2, cz));
        break;
      }
      case 'roof': {
        gb.cbox('roof', b.min, b.max, 0.05);
        break;
      }
      case 'pillar': {
        gb.cbox(b.mat, b.min, b.max, 0.15);
        break;
      }
      case 'deck': {
        gb.cbox(b.mat, b.min, b.max, 0.1);
        gb.cbox('concrete', [x0, y1, z0], [x1, y1 + 0.8, z0 + 0.25], 0.06);
        gb.cbox('concrete', [x0, y1, z1 - 0.25], [x1, y1 + 0.8, z1], 0.06);
        break;
      }
      case 'core': break; // dynamic (pulses)
      case 'floor': gb.cbox(b.mat, b.min, b.max, 0.02); break;
      case 'barrel': { // a drum, or a stack of them on a footprint
        const rr = Math.min(w, d) / 2;
        const n = Math.max(1, Math.round(h / 0.9));
        for (let i = 0; i < n; i++) {
          const mat = ['c_grey', 'c_orange', 'c_blue'][(i + Math.floor(rng() * 3)) % 3];
          gb.addGeo(mat, new THREE.CylinderGeometry(rr * 0.95, rr * 0.95, 0.88, 12), trs(cx, y0 + 0.45 + i * 0.9, cz, 0, rng() * 6), { su: 3, sv: 0.5 });
          for (const hy of [0.12, 0.44, 0.76]) gb.addGeo('metal', new THREE.TorusGeometry(rr * 0.96, 0.025, 4, 12), trs(cx, y0 + hy + i * 0.9, cz, Math.PI / 2));
        }
        break;
      }
      case 'sandbag': { // a low wall of sausages
        const alongX = w >= d, L = alongX ? w : d, tk = alongX ? d : w;
        const rows = Math.max(1, Math.round(h / 0.28)), per = Math.max(1, Math.round(L / 0.62));
        for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
          const t = (i + 0.5 + (r % 2) * 0.5) / per;
          if (t > 1) continue;
          const px = alongX ? x0 + L * t : cx + (rng() - 0.5) * 0.1, pz = alongX ? cz + (rng() - 0.5) * 0.1 : z0 + L * t;
          const bag = new THREE.SphereGeometry(0.32, 8, 6); bag.scale(alongX ? 1.05 : tk * 0.9, 0.42, alongX ? tk * 0.9 : 1.05);
          gb.addGeo('sand', bag, trs(px, y0 + 0.14 + r * 0.26, pz, 0, rng() * 0.3));
        }
        break;
      }
      case 'pallet': {
        gb.cbox('wood', [x0, y1 - 0.12, z0], [x1, y1, z1], 0.01);
        for (const t of [0.1, 0.5, 0.9]) gb.cbox('wood', [x0 + w * t - 0.06, y0, z0], [x0 + w * t + 0.06, y1 - 0.12, z1], 0.01);
        for (let i = 0; i < 5; i++) gb.cbox('wood', [x0, y1 - 0.02, z0 + d * (i / 5) + 0.03], [x1, y1, z0 + d * ((i + 1) / 5) - 0.03], 0.005);
        break;
      }
      case 'ammo': { gb.cbox('gunOlive', b.min, b.max, 0.04); gb.cbox('black', [x0 - 0.01, y0 + h * 0.4, z0 - 0.01], [x1 + 0.01, y0 + h * 0.5, z1 + 0.01], 0.005); gb.cbox('metal', [cx - 0.12, y1, z0 + d * 0.3], [cx + 0.12, y1 + 0.05, z1 - d * 0.3], 0.01); break; }
      case 'ruinWall': { // a broken stone wall with a ragged top
        const segs = Math.max(2, Math.round((w >= d ? w : d) / 1.2));
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs, t1 = (i + 1) / segs, hh = h * (0.55 + rng() * 0.45);
          if (w >= d) gb.cbox('stone', [x0 + w * t0, y0, z0], [x0 + w * t1, y0 + hh, z1], 0.05); else gb.cbox('stone', [x0, y0, z0 + d * t0], [x1, y0 + hh, z0 + d * t1], 0.05);
        }
        break;
      }
      case 'tree': { // a broadleaf: trunk, forking branches, dark leaf mass inside, leaf cards on the outside
        const rr = Math.max(1.6, Math.min(w, d) * 0.5 + 1.2);
        gb.addGeo('wood', new THREE.CylinderGeometry(0.16, 0.3, h * 0.5, 9), trs(cx, y0 + h * 0.25, cz), { su: 2, sv: 2 });
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + rng() * 0.6, tilt = 0.55 + rng() * 0.3, L = h * 0.42;
          gb.addGeo('wood', new THREE.CylinderGeometry(0.06, 0.13, L, 6), trs(cx + Math.cos(a) * Math.sin(tilt) * L * 0.45, y0 + h * 0.48 + Math.cos(tilt) * L * 0.45, cz + Math.sin(a) * Math.sin(tilt) * L * 0.45, Math.cos(a) * tilt * 0.0 + Math.sin(a) * tilt, 0, -Math.cos(a) * tilt), { su: 1, sv: 2 });
        }
        for (let i = 0; i < 3; i++) { const a = rng() * 6.28, rd = rr * 0.35; gb.addGeo('bush', rockGeo(rng() * 40, 1, 0.3), trs(cx + Math.cos(a) * rd, y0 + h * 0.72 + rng() * 0.6, cz + Math.sin(a) * rd, 0, rng() * 6, 0, rr * 0.9, rr * 0.7, rr * 0.9)); }
        for (let i = 0; i < 16; i++) {
          const a = rng() * 6.28, el = (rng() - 0.35) * 1.6, rd = rr * (0.55 + rng() * 0.5);
          const px = cx + Math.cos(a) * Math.cos(el) * rd, py = y0 + h * 0.75 + Math.sin(el) * rr * 0.7, pz = cz + Math.sin(a) * Math.cos(el) * rd;
          const size = rr * (0.9 + rng() * 0.6);
          gb.addGeo('leafCard', new THREE.PlaneGeometry(size, size), trs(px, py, pz, rng() * 0.8 - 0.4, a + Math.PI / 2 + (rng() - 0.5) * 0.8, rng() * 0.6 - 0.3), { su: 1, sv: 1 });
        }
        break;
      }
      case 'bench': {
        const alongX = w >= d;
        gb.cbox('wood', [x0, y1 - 0.06, z0 + (alongX ? 0 : 0.1)], [x1, y1, z1 - (alongX ? 0 : 0.1)], 0.01);
        for (const t of [0.12, 0.88]) { const px = alongX ? x0 + w * t : cx, pz = alongX ? cz : z0 + d * t; gb.cbox('metal', [px - 0.04, y0, pz - (alongX ? d : w) / 2 + 0.05], [px + 0.04, y1 - 0.06, pz + (alongX ? d : w) / 2 - 0.05], 0.01); }
        if (alongX) gb.cbox('wood', [x0, y1 + 0.25, z1 - 0.08], [x1, y1 + 0.45, z1], 0.01); else gb.cbox('wood', [x1 - 0.08, y1 + 0.25, z0], [x1, y1 + 0.45, z1], 0.01);
        break;
      }
      case 'table': { gb.addGeo('metal', new THREE.CylinderGeometry(w / 2, w / 2, 0.04, 12), trs(cx, y1 - 0.02, cz), { su: 2, sv: 0.1 }); gb.addGeo('metal', new THREE.CylinderGeometry(0.04, 0.04, h, 6), trs(cx, y0 + h / 2, cz)); gb.addGeo('metal', new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), trs(cx, y0 + 0.015, cz)); break; }
      case 'forklift': {
        const alongX = w >= d, L = alongX ? w : d;
        const P = (u, y, v) => (alongX ? [x0 + u, y, cz + v] : [cx + v, y, z0 + u]);
        const bx = (u0, y0_, v0, u1, y1_, v1, mat, c = 0.04) => { const A = P(u0, y0_, v0), B = P(u1, y1_, v1); gb.cbox(mat, [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.min(A[2], B[2])], [Math.max(A[0], B[0]), Math.max(A[1], B[1]), Math.max(A[2], B[2])], c); };
        bx(L * 0.25, y0 + 0.3, -0.6, L, y0 + 1.0, 0.6, 'c_orange');
        bx(L * 0.45, y0 + 1.0, -0.5, L * 0.95, y0 + 1.15, 0.5, 'black');
        bx(L * 0.5, y0 + 1.15, -0.55, L * 0.58, y0 + 2.2, -0.48, 'metal'); bx(L * 0.5, y0 + 1.15, 0.48, L * 0.58, y0 + 2.2, 0.55, 'metal');
        bx(L * 0.5, y0 + 2.1, -0.55, L * 0.58, y0 + 2.2, 0.55, 'metal');
        bx(L * 0.2, y0 + 0.2, -0.65, L * 0.28, y0 + 2.4, 0.65, 'metal', 0.02); // mast
        bx(L * 0.22, y0 + 2.3, -0.65, L * 0.3, y0 + 2.4, 0.65, 'metal', 0.02);
        for (const v of [-0.35, 0.35]) bx(0, y0 + 0.08, v - 0.06, L * 0.24, y0 + 0.14, v + 0.06, 'metal', 0.01); // forks
        for (const [u, v] of [[L * 0.35, -0.7], [L * 0.35, 0.7], [L * 0.88, -0.7], [L * 0.88, 0.7]]) { const c = P(u, y0 + 0.32, v); gb.addGeo('tire', new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), trs(c[0], c[1], c[2], alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0)); }
        break;
      }
      case 'crateStack': { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (rng() < 0.85) gb.cbox('crate', [x0 + w * 0.5 * i + 0.03, y0 + h * 0.5 * j, z0 + 0.03], [x0 + w * 0.5 * (i + 1) - 0.03, y0 + h * 0.5 * (j + 1) - 0.02, z1 - 0.03], 0.05, 'local'); break; }
      case 'tent': { // a canvas ridge tent over the footprint
        const alongX = w >= d;
        if (alongX) gb.extrude('sand', [[z0, y0], [z1, y0], [cz, y1]], 'x', x0, x1); else gb.extrude('sand', [[x0, y0], [x1, y0], [cx, y1]], 'z', z0, z1);
        break;
      }
      default: gb.cbox(b.mat, b.min, b.max, look === 'ceiling' ? 0.04 : 0.07);
    }
  }
  // dynamic pieces: doors, reactor core
  for (const b of level.boxes) {
    if (b.door) dyn.doors.push({ id: b.door, mesh: doorMesh(b), box: b, t: 0 });
    if (b.look === 'core') dyn.cores.push(reactorCore(b));
  }
  for (const d of level.deco) buildDeco(d, gb, dyn, level, rng);
}

function carWreck(gb, b, rng) {
  const [x0, y0, z0] = b.min, [x1, , z1] = b.max;
  const alongZ = z1 - z0 > x1 - x0;
  const L = alongZ ? z1 - z0 : x1 - x0, W = alongZ ? x1 - x0 : z1 - z0;
  const c = alongZ ? (x0 + x1) / 2 : (z0 + z1) / 2, a0 = alongZ ? z0 : x0;
  // side profile (length along u, height v), sagging and burnt
  const prof = [[0, 0.35], [L, 0.35], [L, 0.75], [L * 0.8, 0.85], [L * 0.66, 1.35], [L * 0.3, 1.38], [L * 0.18, 0.9], [0, 0.8]].map(([u, v]) => [a0 + u, y0 + v]);
  const side = (s) => c + (s * W) / 2;
  // extrude across the width: build as quads by hand (profile in (along, y), extruded across)
  const P = (u, v, t) => (alongZ ? [t, v, u] : [u, v, t]);
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    const du = q[0] - p[0], dv = q[1] - p[1], Lq = Math.hypot(du, dv) || 1;
    const nu = dv / Lq, nv = -du / Lq;
    gb.quad('wreck', P(p[0], p[1], side(-1)), P(q[0], q[1], side(-1)), P(q[0], q[1], side(1)), P(p[0], p[1], side(1)), alongZ ? [0, nv, nu] : [nu, nv, 0]);
  }
  const tris = THREE.ShapeUtils.triangulateShape(prof.map(([u, v]) => new THREE.Vector2(u, v)), []);
  for (const s of [-1, 1]) for (const t of tris) gb.tri('wreck', P(...prof[t[0]], side(s)), P(...prof[t[1]], side(s)), P(...prof[t[2]], side(s)), alongZ ? [s, 0, 0] : [0, 0, s]);
  // wheels (one missing)
  for (const [f, s] of [[0.18, -1], [0.18, 1], [0.8, -1], [0.8, 1]]) {
    if (rng() < 0.2) continue;
    const u = a0 + L * f, t = side(s) + s * 0.02;
    const m = alongZ ? trs(t, y0 + 0.35, u, 0, 0, Math.PI / 2) : trs(u, y0 + 0.35, t, Math.PI / 2, 0, 0);
    gb.addGeo('tire', new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10), m);
  }
}

function stoneBridge(gb, b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const prof = [[x0 - 1.5, y1], [x1 + 1.5, y1], [x1 + 1.5, y1 - 5], [x1 - 1.2, y1 - 5]];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = (x1 - 1.2) + ((x0 + 1.2) - (x1 - 1.2)) * t;
    prof.push([x, y1 - 5 + (4.3) * Math.sin(Math.PI * t)]);
  }
  prof.push([x0 - 1.5, y1 - 5]);
  // polygon is clockwise in (x, y) → reverse for CCW
  gb.extrude('stone', prof.slice().reverse().map(([x, y]) => [x, y]), 'z', z0, z1);
  for (const [za, zb] of [[z0 - 0.05, z0 + 0.4], [z1 - 0.4, z1 + 0.05]]) gb.cbox('stone', [x0 - 1.5, y1, za], [x1 + 1.5, y1 + 0.7, zb], 0.08);
}

function doorMesh(b) {
  const g = new GB();
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  if (b.look === 'shutter') g.cbox('shutter', b.min, b.max, 0.04);
  else {
    // two halves with a glowing seam, like a Vyrr iris-door
    const alongX = x1 - x0 > z1 - z0;
    if (alongX) { const m = (x0 + x1) / 2; g.cbox('door', [x0, y0, z0], [m - 0.03, y1, z1], 0.06); g.cbox('door', [m + 0.03, y0, z0], [x1, y1, z1], 0.06); }
    else { const m = (z0 + z1) / 2; g.cbox('door', [x0, y0, z0], [x1, y1, m - 0.03], 0.06); g.cbox('door', [x0, y0, m + 0.03], [x1, y1, z1], 0.06); }
  }
  const grp = new THREE.Group();
  for (const m of g.meshes()) { m.matrixAutoUpdate = true; grp.add(m); }
  return grp;
}

function reactorCore(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = (x1 - x0) / 2, h = y1 - y0;
  const grp = new THREE.Group();
  grp.position.set(cx, y0, cz);
  const shell = new THREE.Mesh(lathe([[r * 1.1, 0], [r * 1.2, 0.6], [r * 0.8, 1.2], [r * 0.8, h - 1.2], [r * 1.2, h - 0.6], [r * 1.1, h]], 12), MAT('alien'));
  grp.add(shell);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, h - 2.4, 12, 1, true), basicGlow(0x6effa0, 0.55));
  inner.position.y = h / 2; grp.add(inner);
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.09, 6, 16), emissiveMat(0x6effa0, 2));
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.6 + i * (h - 3.2) / 4; grp.add(ring); rings.push(ring);
  }
  const glow = new THREE.Sprite(glowMat(0x6effa0, 0.7)); glow.scale.set(9, 12, 1); glow.position.y = h / 2; grp.add(glow);
  return { grp, rings, inner, glow };
}

// ------------------------------------------------------------ deco
function buildDeco(d, gb, dyn, level, rng) {
  const [x, y, z] = d.p;
  switch (d.kind) {
    case 'hull': hullShell(gb, d, dyn); break;
    case 'hullRibs': {
      for (let zz = d.z1 - 3; zz > d.z0; zz -= d.every) {
        const prof = [];
        const hw = (d.x1 - d.x0) / 2, H = d.h;
        const outer = [[-hw, 0], [-hw, H * 0.6], [-hw * 0.7, H - 0.05], [hw * 0.7, H - 0.05], [hw, H * 0.6], [hw, 0]];
        const inner = [[hw - 0.5, 0], [hw - 0.5, H * 0.58], [hw * 0.66, H - 0.6], [-hw * 0.66, H - 0.6], [-hw + 0.5, H * 0.58], [-hw + 0.5, 0]];
        for (let i = 0; i < outer.length - 1; i++) {
          const a = outer[i], b2 = outer[i + 1], c = inner[inner.length - 2 - i], dd = inner[inner.length - 1 - i];
          const quadProf = [a, b2, c, dd];
          void quadProf;
          prof.push([a, b2, c, dd]);
        }
        for (const q of prof) gb.extrude('hullIn', q.map(([u, v]) => [u, v + 0.25]).reverse(), 'z', zz - 0.35, zz + 0.35);
      }
      break;
    }
    case 'slab': gb.addGeo('concrete', new THREE.BoxGeometry(d.w, 0.9, d.d), trs(x, 2.2, z, 0, d.rotY || 0, d.rotZ || 0)); break;
    case 'fire': dyn.fires.push({ p: [x, y, z], s: d.s || 1 }); break;
    case 'smoke': dyn.smokes.push({ p: [x, y, z], big: !!d.big }); break;
    case 'streetlight': {
      const g = new THREE.CylinderGeometry(0.1, 0.14, 7, 8);
      gb.addGeo('metal', g, trs(x, 3.5 + level.terrain.fn(x, z), z, d.broken ? 0.4 : 0, 0, 0));
      if (!d.broken) {
        gb.addGeo('metal', new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), trs(x + 0.8, 6.9 + level.terrain.fn(x, z), z, 0, 0, Math.PI / 2));
        dyn.lamps.push({ p: [x + 1.6, 6.8 + level.terrain.fn(x, z), z], color: d.color || 0xffd08a });
      }
      break;
    }
    case 'condor': dyn.condors.push({ p: [x, y, z], late: !!d.late, group: makeCondor() }); break;
    case 'crane': {
      for (const sx of [-4, 4]) for (const sz of [-6, 6]) gb.cbox('c_orange', [x + sx - 0.4, 0, z + sz - 0.4], [x + sx + 0.4, 22, z + sz + 0.4], 0.06);
      gb.cbox('c_orange', [x - 30, 22, z - 1.2], [x + 14, 24, z + 1.2], 0.1);
      gb.cbox('c_orange', [x - 5, 20, z - 7], [x + 5, 22, z + 7], 0.1);
      gb.cbox('metal', [x - 18, 17, z - 1], [x - 15, 21.5, z + 1], 0.05);
      break;
    }
    case 'quay': gb.cbox('concrete', [x, -4, level.bounds.z0 - 20], [x + 1.5, 0, level.bounds.z1 + 20], 0.1); break;
    case 'warehouse': {
      // pilasters outside, trusses + skylights inside
      for (let zz = d.z1 - 8; zz > d.z0; zz -= 12) {
        for (const sx of [d.x0 - 0.35, d.x1 + 0.35]) gb.cbox('concrete', [sx - 0.35, 0, zz - 0.6], [sx + 0.35, d.h + 0.4, zz + 0.6], 0.06);
        gb.cbox('metal', [d.x0 + 1, d.h - 1.4, zz - 0.2], [d.x1 - 1, d.h - 1.0, zz + 0.2], 0.04);
        for (let i = 0; i < 8; i++) {
          const xa = d.x0 + 1 + (i * (d.x1 - d.x0 - 2)) / 8, xb = xa + (d.x1 - d.x0 - 2) / 8;
          const g = new THREE.CylinderGeometry(0.06, 0.06, Math.hypot(xb - xa, 1.2), 4);
          gb.addGeo('metal', g, trs((xa + xb) / 2, d.h - 0.6, zz, 0, 0, Math.atan2(xb - xa, i % 2 ? 1.2 : -1.2)));
        }
        dyn.lamps.push({ p: [0, d.h - 2.5, zz], color: 0xdde6ff, hang: true });
        dyn.lamps.push({ p: [-16, d.h - 2.5, zz], color: 0xdde6ff, hang: true });
        dyn.lamps.push({ p: [16, d.h - 2.5, zz], color: 0xdde6ff, hang: true });
      }
      break;
    }
    case 'rain': dyn.rain = true; break;
    case 'rubble': { // a pile of concrete chunks with rebar sticking out
      const n = d.n || 9, R = d.r || 2.2, ground = level.terrain.fn;
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.28, rd = rng() * R, px = x + Math.cos(a) * rd, pz = z + Math.sin(a) * rd, sc = 0.25 + rng() * 0.6;
        const gy = ground(px, pz) + (d.y || 0);
        gb.addGeo(rng() < 0.75 ? 'rubble' : 'brick', rockGeo(rng() * 90, 1, 0.5), trs(px, gy + sc * 0.3, pz, rng() * 0.6, rng() * 6, rng() * 0.6, sc * 1.4, sc * 0.8, sc * 1.2));
      }
      for (let i = 0; i < Math.ceil(n / 3); i++) {
        const a = rng() * 6.28, rd = rng() * R * 0.8, px = x + Math.cos(a) * rd, pz = z + Math.sin(a) * rd, gy = ground(px, pz) + (d.y || 0);
        gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), trs(px, gy + 0.5, pz, 0.9 + rng() * 0.8, rng() * 6, 0));
        gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), trs(px + 0.3, gy + 0.9, pz, 0.3 + rng() * 0.5, rng() * 6, 1.2));
      }
      break;
    }
    case 'debris': { // shards of Vyrr hull in the dirt
      const n = d.n || 12, R = d.r || 6, ground = level.terrain.fn;
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.28, rd = Math.sqrt(rng()) * R, px = x + Math.cos(a) * rd, pz = z + Math.sin(a) * rd, sc = 0.3 + rng() * 0.9;
        const plate = new THREE.CylinderGeometry(sc, sc, sc * 0.6, 6, 1, true, 0, 1.4);
        gb.addGeo('hull', plate, trs(px, ground(px, pz) + sc * 0.15, pz, (rng() - 0.5) * 1.2, rng() * 6, (rng() - 0.5) * 1.2), { su: 1, sv: 1 });
      }
      break;
    }
    case 'cable': { // a sagging cable from p to p2
      const [x2, y2, z2] = d.p2, sag = d.sag ?? 1.2;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y, z), new THREE.Vector3((x + x2) / 2, Math.min(y, y2) - sag, (z + z2) / 2), new THREE.Vector3(x2, y2, z2));
      gb.addGeo('black', new THREE.TubeGeometry(curve, 10, d.r || 0.03, 5, false), trs(0, 0, 0));
      break;
    }
    case 'pipe': { // a straight pipe with flanges from p to p2
      const [x2, y2, z2] = d.p2, L = Math.hypot(x2 - x, y2 - y, z2 - z), rr = d.r || 0.14;
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(x, y, z), new THREE.Vector3(x2, y2, z2), new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
      const mk = (geo, t, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x + (x2 - x) * t, y + (y2 - y) * t, z + (z2 - z) * t), q, new THREE.Vector3(s, 1, s));
      gb.addGeo(d.mat || 'metal', new THREE.CylinderGeometry(rr, rr, L, 8), mk(null, 0.5), { su: 1, sv: L / 2 });
      for (let i = 0; i <= Math.floor(L / 4); i++) gb.addGeo('gunmetal', new THREE.CylinderGeometry(rr * 1.35, rr * 1.35, 0.12, 8), mk(null, Math.min(0.98, (i * 4 + 0.5) / L)));
      break;
    }
    case 'chains': { // hanging chains from a beam
      for (let i = 0; i < (d.n || 4); i++) {
        const px = x + (rng() - 0.5) * (d.w || 6), pz = z + (rng() - 0.5) * (d.d || 1), L = 1.5 + rng() * (d.h || 3);
        gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.03, 0.03, L, 5), trs(px, y - L / 2, pz));
        gb.addGeo('gunmetal', new THREE.TorusGeometry(0.12, 0.03, 4, 8), trs(px, y - L - 0.1, pz, 0, rng() * 3, 0));
      }
      break;
    }
    case 'bioPods': { // Vyrr growth: a cluster of glowing pods with roots creeping over the ground
      const n = d.n || 5;
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.28, rd = rng() * (d.r || 1.6), px = x + Math.cos(a) * rd, pz = z + Math.sin(a) * rd, sc = 0.3 + rng() * 0.5;
        gb.addGeo('pod', lathe([[0.02, 0], [0.5, 0.2], [0.55, 0.9], [0.3, 1.4], [0.05, 1.6]], 8), trs(px, y, pz, (rng() - 0.5) * 0.4, rng() * 6, (rng() - 0.5) * 0.4, sc, sc, sc), { su: 2, sv: 1 });
        dyn.lamps.push({ p: [px, y + sc * 0.9, pz], color: 0x55ffe0, bare: true, small: true });
      }
      for (let i = 0; i < n + 2; i++) {
        const a = rng() * 6.28, L = 1.5 + rng() * 2.5;
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y + 0.2, z), new THREE.Vector3(x + Math.cos(a) * L * 0.5, y + 0.5 + rng() * 0.6, z + Math.sin(a) * L * 0.5), new THREE.Vector3(x + Math.cos(a) * L, y + 0.02, z + Math.sin(a) * L));
        gb.addGeo('scales', new THREE.TubeGeometry(curve, 8, 0.07 + rng() * 0.05, 5, false), trs(0, 0, 0));
      }
      break;
    }
    case 'roots': { // Vyrr growth up a wall: tendrils from (x,y,z) climbing `h` along `axis`
      for (let i = 0; i < (d.n || 5); i++) {
        const dx = (rng() - 0.5) * (d.w || 4), top = y + (d.h || 4) * (0.5 + rng() * 0.5);
        const A = new THREE.Vector3(x + (d.axis === 'z' ? 0 : dx), y, z + (d.axis === 'z' ? dx : 0));
        const B = new THREE.Vector3(A.x + (d.axis === 'z' ? 0 : (rng() - 0.5) * 1.5), top, A.z + (d.axis === 'z' ? (rng() - 0.5) * 1.5 : 0));
        const mid = new THREE.Vector3((A.x + B.x) / 2 + (d.axis === 'z' ? 0 : (rng() - 0.5)), (A.y + B.y) / 2, (A.z + B.z) / 2 + (d.axis === 'z' ? (rng() - 0.5) : 0));
        gb.addGeo('scales', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, mid, B), 8, 0.05 + rng() * 0.05, 5, false), trs(0, 0, 0));
      }
      break;
    }
    case 'log': { // a fallen trunk
      const L = d.l || 5, a = d.rotY || 0;
      gb.addGeo('wood', new THREE.CylinderGeometry(0.28, 0.36, L, 8), trs(x, y + 0.3, z, 0, a, Math.PI / 2), { su: 2, sv: 3 });
      gb.addGeo('sand', new THREE.CylinderGeometry(0.29, 0.29, 0.04, 8), trs(x + Math.cos(a) * L / 2, y + 0.3, z - Math.sin(a) * L / 2, 0, a, Math.PI / 2));
      for (let i = 0; i < 3; i++) gb.addGeo('wood', new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5), trs(x + Math.cos(a) * (rng() - 0.5) * L * 0.8, y + 0.7, z - Math.sin(a) * (rng() - 0.5) * L * 0.8, rng() * 1.5 - 0.7, rng() * 6, 0.4));
      break;
    }
    case 'bush': { gb.addGeo('bush', rockGeo(rng() * 50, 1, 0.4), trs(x, y + (d.s || 1) * 0.35, z, 0, rng() * 6, 0, (d.s || 1) * 0.9, (d.s || 1) * 0.6, (d.s || 1) * 0.9)); break; }
    case 'banner': { // an ECS flag on a pole
      gb.addGeo('metal', new THREE.CylinderGeometry(0.05, 0.07, d.h || 5, 6), trs(x, y + (d.h || 5) / 2, z));
      dyn.flags.push({ p: [x, y + (d.h || 5) - 1.3, z], w: 1.8, h: 1.1 });
      break;
    }
    case 'sign': { // a text board on two posts
      for (const sx of [-0.9, 0.9]) gb.addGeo('metal', new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), trs(x + sx * Math.cos(d.rotY || 0), y + 1.2, z - sx * Math.sin(d.rotY || 0)));
      dyn.labels.push({ text: d.text, p: [x, y + 2.1, z], w: 2.2, h: 0.6, rotY: d.rotY || 0, bg: d.bg || '#1a1d1a', fg: d.fg || '#e0a040' });
      break;
    }
    case 'grass': dyn.grass.push({ x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, n: d.n || 600, ok: d.ok }); break;
    case 'dust': dyn.dust = d.color || 0xffffff; break;
    case 'birds': dyn.birds.push({ p: [x, y, z], r: d.r || 30, n: d.n || 7 }); break;
    case 'shafts': dyn.shafts.push({ p: [x, y, z], w: d.w || 12, h: d.h || 30, n: d.n || 5, dir: d.dir || [0.4, -0.8, -0.3] }); break;
    case 'puddles': dyn.puddles.push({ x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, n: d.n || 8 }); break;
    case 'mist': dyn.mists.push({ x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, y: d.y ?? 0.5, n: d.n || 20 }); break;
    case 'tower': { // a two-storey control tower on legs (test range)
      for (const [sx, sz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) gb.cbox('metal', [x + sx - 0.2, y, z + sz - 0.2], [x + sx + 0.2, y + 7, z + sz + 0.2], 0.03);
      gb.cbox('ecs', [x - 3, y + 7, z - 3], [x + 3, y + 7.4, z + 3], 0.06);
      gb.cbox('concrete', [x - 2.8, y + 7.4, z - 2.8], [x + 2.8, y + 10.2, z + 2.8], 0.1);
      gb.quad('glass', [x - 2.6, y + 8.2, z - 2.85], [x + 2.6, y + 8.2, z - 2.85], [x + 2.6, y + 9.6, z - 2.85], [x - 2.6, y + 9.6, z - 2.85], [0, 0, -1], [[0, 0], [3, 0], [3, 1], [0, 1]]);
      gb.cbox('roof', [x - 3, y + 10.2, z - 3], [x + 3, y + 10.5, z + 3], 0.05);
      gb.addGeo('metal', new THREE.CylinderGeometry(0.04, 0.06, 4, 5), trs(x + 2, y + 12.5, z + 2));
      dyn.lamps.push({ p: [x + 2, y + 14.5, z + 2], color: 0xff4040, bare: true, small: true });
      break;
    }
    case 'pylon': {
      gb.addGeo('alien', lathe([[0.9, 0], [0.7, 1], [0.35, 5], [0.12, 9], [0.02, 10]], 6), trs(x, y, z), { su: 2, sv: 3 });
      dyn.lamps.push({ p: [x, y + 9.6, z], color: 0x9b6bff, bare: true });
      break;
    }
    case 'pines': dyn.pines = d.trees; break;
    case 'spire': dyn.spire = makeSpire(x, y, z); break;
    case 'waterfall': dyn.waterfall = { p: [x, y, z], w: d.w, h: d.h }; break;
    case 'mountains': dyn.mountains = true; break;
    case 'distanceSign': {
      gb.addGeo('metal', new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), trs(x, 1.2, z));
      dyn.labels.push({ text: d.text, p: [x, 2.3, z], w: 1.6, h: 0.5 });
      break;
    }
    case 'pad': dyn.pads.push({ p: [x, y, z], label: d.label }); break;
    case 'hangar': {
      for (const [hx, hz, w, dd] of [[-60, -30, 20, 40], [62, -20, 18, 50], [0, -110, 60, 16]]) {
        gb.cbox('metal', [hx - w / 2, 0, hz - dd / 2], [hx + w / 2, 12, hz + dd / 2], 0.2);
        gb.addGeo('roof', new THREE.CylinderGeometry(w / 2, w / 2, dd, 12, 1, false, -Math.PI / 2, Math.PI), trs(hx, 12, hz, Math.PI / 2, 0, 0));
      }
      break;
    }
    case 'plazaBuildings': {
      const rr = mulberry32(5);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, R = 52 + rr() * 10;
        const bx = Math.cos(a) * R, bz = Math.sin(a) * R, w = 10 + rr() * 8, h = 12 + rr() * 30;
        gb.cbox(rr() < 0.5 ? 'concrete' : 'brick', [bx - w / 2, -1, bz - w / 2], [bx + w / 2, h, bz + w / 2], 0.2);
        dyn.windows.push({ p: [bx, h, bz], w, h });
      }
      break;
    }
    default: break;
  }
}

// The downed carrier's outer shell: a teardrop profile extruded along z,
// with a torn nose (jagged front), dorsal fins and glowing seams.
function hullShell(gb, d, dyn) {
  // teardrop half-profile (x, y), mirrored; the whole shell is rolled a few
  // degrees so the wreck reads as having ploughed in on its side
  const prof = [[16.6, -0.8], [17.6, 2.5], [17.8, 6.8], [16.6, 10], [14.6, 11.8], [10.6, 13.4], [5, 14.4], [0, 14.9]];
  const full = [...prof, ...prof.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  const roll = 0.05, cr = Math.cos(roll), sr = Math.sin(roll);
  const R = ([x, y]) => [x * cr - y * sr, y * cr + x * sr];
  const rng = mulberry32(8);
  const NOSE = 7; // the torn tube mouth overhangs the breach wall by this much
  const zs = [];
  for (let z = d.z0; z < d.z1 + NOSE - 0.01; z += 5) zs.push(z);
  zs.push(d.z1 + NOSE);
  const jag = full.map((_, i) => rng() * 5 * (0.4 + Math.abs(Math.sin(i * 1.7))));
  const pts = (zi) => full.map(([x, y], i) => {
    let z = zs[zi];
    if (zi === zs.length - 1) z = d.z1 + NOSE - jag[i];
    const [rx, ry] = R([x, y]);
    return [rx, ry, z];
  });
  const addStrip = (A, B, inside) => {
    for (let i = 0; i < full.length - 1; i++) {
      const zmid = (A[i][2] + B[i][2]) / 2;
      if (d.door && zmid > d.door[0] - 1 && zmid < d.door[1] + 1 && i < 2) continue; // starboard breach
      const a = A[i], b = A[i + 1], c = B[i + 1], e = B[i];
      const ex = (a[0] + b[0]) / 2, ey = (a[1] + b[1]) / 2 - 3, L = Math.hypot(ex, ey) || 1;
      const n = inside ? [-ex / L, -ey / L, 0] : [ex / L, ey / L, 0];
      gb.quad(inside ? 'hullIn' : 'hull', a, b, c, e, n);
    }
  };
  for (let zi = 0; zi < zs.length - 1; zi++) {
    addStrip(pts(zi), pts(zi + 1), false);
    if (zs[zi] >= d.z1 - 0.5) addStrip(pts(zi), pts(zi + 1), true); // the inside of the torn mouth
  }
  const cap = full.map(R);
  const tris = THREE.ShapeUtils.triangulateShape(cap.map(([x, y]) => new THREE.Vector2(x, y)), []);
  for (const t of tris) gb.tri('hull', [...cap[t[0]], d.z0], [...cap[t[1]], d.z0], [...cap[t[2]], d.z0], [0, 0, -1]);
  // dorsal fins and engine pods
  for (const fz of [d.z0 + 8, d.z0 + 22, d.z0 + 36]) {
    const fin = [[0, 0], [7, 0], [3, 4.5], [0.5, 4.5]];
    gb.extrude('hull', fin.map(([u, v]) => [fz + u, 14.4 + v]), 'x', -0.35 - 14.6 * sr, 0.35 - 14.6 * sr);
  }
  for (const sx of [-1, 1]) {
    gb.addGeo('hull', lathe([[0.1, 0], [2.4, 1], [3, 5], [2.6, 12], [1.2, 15]], 10), trs(sx * 19.5, 5.5 + sx * 19.5 * sr, d.z0 + 6, Math.PI / 2, 0, sx * 0.25), { su: 2, sv: 2 });
    dyn.lamps.push({ p: [sx * 19.5, 5.5 + sx * 19.5 * sr, d.z0 + 5], color: 0x6effa0, bare: true, big: true });
  }
  // torn plates hanging off the mouth, and a sheared wing half-buried beside it
  gb.addGeo('hull', new THREE.CylinderGeometry(6, 6, 5, 8, 1, true, 0, 1.2), trs(6, 12, d.z1 + NOSE - 1, 0.4, 0.3, 1.2));
  gb.addGeo('hull', new THREE.CylinderGeometry(5, 5, 4, 8, 1, true, 0, 1.0), trs(-9, 10, d.z1 + NOSE - 2, -0.3, -0.5, -1.0));
  gb.extrude('hull', [[0, 0], [16, 2], [18, 3.2], [2, 1.2]].map(([u, v]) => [u - 38, v]), 'z', d.z0 + 30, d.z0 + 44);
  dyn.fires.push({ p: [-24, 1, d.z0 + 38], s: 1.3 });
  dyn.smokes.push({ p: [-24, 2, d.z0 + 38], big: true });
}

// ======================================================================
// DYNAMIC MODELS
// ======================================================================
export function mesh(geo, mat) { const m = new THREE.Mesh(geo, typeof mat === 'string' ? MAT(mat) : mat); m.castShadow = true; return m; }
export function cboxGeo(mat, w, h, d, c = 0.05, uv = 'local') { const g = new GB(); g.cbox(mat, [-w / 2, -h / 2, -d / 2], [w / 2, h / 2, d / 2], c, uv); const ms = g.meshes(); const m = ms[0]; m.matrixAutoUpdate = true; return m; }
export function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }
export { lathe, trs };

// ---- dropship (ECS "Condor", a Pelican-shaped cousin) --------------------
export function makeCondor() {
  const g = new THREE.Group();
  const gb = new GB();
  const prof = [[0, 0.2], [1.6, 0], [2.0, 1.2], [1.7, 2.3], [0, 2.7]]; // half cross-section (x, y)
  const full = [...prof, ...prof.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  const ordered = [full[0], full[1], full[2], full[3], full[4], full[5], full[6], full[7]];
  gb.extrude('ecs', ordered, 'z', -6, 6);
  gb.cbox('ecs', [-1.4, 0.4, -9], [1.4, 2.2, -6], 0.3);
  gb.cbox('glass', [-1.1, 1.6, -9.2], [1.1, 2.1, -8.4], 0.1);
  gb.cbox('ecs', [-1.8, 1.6, 6], [1.8, 2.8, 9], 0.3);
  for (const s of [-1, 1]) {
    gb.cbox('ecs', [s * 1.8, 1.4, -2], [s * 6.5, 1.8, 2], 0.1);
    gb.addGeo('metal', new THREE.CylinderGeometry(0.9, 1.0, 3.8, 10), trs(s * 6.8, 1.6, 0, Math.PI / 2, 0, 0));
  }
  gb.cbox('ecs', [-0.2, 2.6, 6.5], [0.2, 5.2, 9], 0.08);
  for (const m of gb.meshes()) { m.matrixAutoUpdate = true; g.add(m); }
  for (const s of [-1, 1]) {
    const jet = new THREE.Sprite(glowMat(0x9fd8ff, 0.9)); jet.scale.set(2.6, 2.6, 1); jet.position.set(s * 6.8, 0.6, 0); g.add(jet);
    const nav = new THREE.Sprite(glowMat(s > 0 ? 0x40ff60 : 0xff4040, 1)); nav.scale.set(0.8, 0.8, 1); nav.position.set(s * 6.5, 1.8, 0); g.add(nav);
  }
  return g;
}

// ---- Hymn Spire ------------------------------------------------------------
function makeSpire(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const tower = mesh(lathe([[3.2, 0], [2.6, 1.2], [1.6, 3], [1.2, 6.5], [1.6, 7.6], [1.1, 9.2], [0.4, 10.8], [0.25, 22], [0.05, 26]], 8), 'alien');
  g.add(tower);
  for (let i = 0; i < 3; i++) {
    const arm = mesh(lathe([[0.3, 0], [0.18, 4], [0.02, 7]], 6), 'alien');
    arm.position.set(Math.cos(i * 2.09) * 1.2, 8, Math.sin(i * 2.09) * 1.2);
    arm.rotation.set(Math.sin(i * 2.09) * 0.5, 0, -Math.cos(i * 2.09) * 0.5);
    g.add(arm);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 400, 8, 1, true), basicGlow(0x9b6bff, 0.35));
  beam.position.y = 26 + 200; g.add(beam);
  const halo = new THREE.Sprite(glowMat(0xb68cff, 0.9)); halo.scale.set(10, 10, 1); halo.position.y = 8; g.add(halo);
  return { grp: g, beam, halo, dead: false };
}

// ---- destructible targets ------------------------------------------------
export function makeTarget(kind) {
  const g = new THREE.Group();
  if (kind === 'emitter') {
    g.add(mesh(lathe([[1.0, 0], [1.1, 0.4], [0.6, 1.0], [0.55, 3.6], [0.9, 4.2], [0.4, 4.8], [0.05, 5]], 8), 'alien'));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), emissiveMat(0xd35bff, 2.5)); core.position.y = 2.4; g.add(core);
    const halo = new THREE.Sprite(glowMat(0xd35bff, 0.8)); halo.scale.set(4, 4, 1); halo.position.y = 2.4; g.add(halo);
    for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 16), emissiveMat(0xd35bff, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.4 + i * 1; g.add(ring); }
    return { grp: g, core, halo };
  }
  if (kind === 'conduit') {
    g.add(mesh(lathe([[0.8, 0], [0.9, 0.3], [0.45, 0.8], [0.4, 2.8], [0.2, 3.2]], 8), 'alien'));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 8), emissiveMat(0x9b6bff, 2.5)); core.position.y = 1.8; g.add(core);
    const halo = new THREE.Sprite(glowMat(0x9b6bff, 0.8)); halo.scale.set(3, 3, 1); halo.position.y = 1.8; g.add(halo);
    return { grp: g, core, halo };
  }
  // spire core: a floating crystal inside a cage
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), emissiveMat(0xd35bff, 2.8)); core.scale.y = 1.4; core.position.y = 1.2; g.add(core);
  const halo = new THREE.Sprite(glowMat(0xd35bff, 0.9)); halo.scale.set(6, 6, 1); halo.position.y = 1.2; g.add(halo);
  const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color: 0xb68cff, wireframe: true, transparent: true, opacity: 0.6 })); cage.position.y = 1.2; g.add(cage);
  return { grp: g, core, halo, cage };
}

// ---- pines ----------------------------------------------------------------
export function makePines(trees) {
  // One shared tree: a tapered trunk and seven whorls of drooping branch cards (an alpha-tested
  // needle-branch texture on vertical planes radiating from the trunk), plus a leader at the top.
  // Cards read as real foliage from any angle where stacked cones read as a cartoon.
  const n = trees.length;
  const parts = [], mats = [];
  const trunkG = new THREE.CylinderGeometry(0.1, 0.24, 6.2, 9); trunkG.translate(0, 3.1, 0);
  parts.push(trunkG.toNonIndexed()); mats.push(0);
  const rng = mulberry32(17);
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = 1.5 + f * 4.3, len = 2.6 * (1 - f * 0.78) + 0.3, h = len * 0.55;
    const per = t < tiers - 1 ? 6 : 4;
    for (let k = 0; k < per; k++) {
      const a = (k / per) * Math.PI * 2 + t * 0.55 + rng() * 0.3;
      const card = new THREE.PlaneGeometry(len, h);
      card.translate(len / 2, 0, 0); // root at the trunk, tip outward
      card.rotateZ(-0.22 - rng() * 0.2); // droop
      card.rotateY(a);
      card.translate(0, y, 0);
      parts.push(card.toNonIndexed()); mats.push(1);
    }
  }
  const leader = new THREE.ConeGeometry(0.45, 1.4, 6, 1, true); leader.translate(0, 6.4, 0);
  parts.push(leader.toNonIndexed()); mats.push(1);
  const geo = mergeGeometries(parts, true);
  geo.groups.forEach((gr, gi) => { gr.materialIndex = mats[gi]; });
  const cardMat = MAT('pineCard').clone(); cardMat.color.set(0xe8ffe0);
  const im = new THREE.InstancedMesh(geo, [MAT('wood'), cardMat], n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  trees.forEach(([x, y, z, s], i) => {
    q.setFromEuler(new THREE.Euler((((x * 3.1) % 1) - 0.5) * 0.06, x * 13.1 + z, (((z * 2.7) % 1) - 0.5) * 0.06));
    m.compose(v.set(x, y - 0.1, z), q, sc.set(s, s * (0.9 + ((x * 7) % 1) * 0.3), s));
    im.setMatrixAt(i, m);
    im.setColorAt(i, col.setHSL(0.27 + (((z * 3.3) % 1 + 1) % 1) * 0.05, 0.35, 0.5 + (((x * 1.7) % 1 + 1) % 1) * 0.2));
  });
  im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
  return [im];
}

// A distant mountain range: an annulus of ridges with snow above the tree line, sitting past the fog.
export function makeMountains(cx, cz, R0 = 240, R1 = 760, seed = 12) {
  const rng = mulberry32(seed);
  const NA = 112, NR = 7;
  const pos = [], col = [], idx = [];
  const ph = Array.from({ length: 6 }, () => rng() * 6.28);
  const profile = (a) => Math.max(0, 55 + 75 * Math.sin(a * 5 + ph[0]) + 48 * Math.sin(a * 13 + ph[1]) + 30 * Math.sin(a * 29 + ph[2]) + 18 * Math.sin(a * 61 + ph[3]) + 12 * Math.sin(a * 127 + ph[4]));
  for (let j = 0; j <= NR; j++) {
    const t = j / NR, r = R0 + (R1 - R0) * t;
    const radial = t < 0.45 ? Math.pow(t / 0.45, 1.6) : 1 - (t - 0.45) / 0.55 * 0.35;
    for (let i = 0; i <= NA; i++) {
      const a = (i / NA) * Math.PI * 2;
      const h = (profile(a) * radial + 8 * Math.sin(a * 200 + j * 3) * t) * (1 + 0.3 * Math.sin(a * 3 + t * 5 + ph[5]));
      const y = -25 + h * 1.9;
      pos.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      const snow = Math.max(0, Math.min(1, (y - 150) / 60)), shade = 0.55 + 0.45 * Math.min(1, h / 120);
      const rr = (0.62 + 0.38 * snow) * shade, gg = (0.58 + 0.42 * snow) * shade, bb = (0.55 + 0.45 * snow) * shade;
      col.push(rr + snow * 0.25, gg + snow * 0.25, bb + snow * 0.3);
    }
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0xbfc4c8, specular: 0x111111, shininess: 6, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
