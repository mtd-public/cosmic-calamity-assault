// Geometry builder (from final-halo-like js/models.js): chamfered boxes, extrusions,
// lathes and merged per-material meshes with planar world UVs.
import * as THREE from 'three';
import { mergeVertices } from './addons/BufferGeometryUtils.js';

export class GB {
  // mats: { name: THREE.Material } (or a function name → material); rep: metres per UV tile
  constructor(mats = {}, rep = 1) { this.parts = new Map(); this.mats = mats; this.rep = rep; }
  _mat(name) { return typeof this.mats === 'function' ? this.mats(name) : this.mats[name]; }
  _rep(name) { return this._mat(name)?.userData?.rep ?? this.rep; }
  _p(mat) { if (!this.parts.has(mat)) this.parts.set(mat, { pos: [], nrm: [], uv: [] }); return this.parts.get(mat); }
  tri(mat, a, b, c, n, uvs) {
    const P = this._p(mat);
    // fix winding to match n
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    let A = a, B = b, C = c, ua = uvs?.[0], ub = uvs?.[1], uc = uvs?.[2];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { B = c; C = b; ub = uvs?.[2]; uc = uvs?.[1]; }
    const rep = this._rep(mat);
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
    const P = this._p(mat), rep = this._rep(mat);
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
      const m = new THREE.Mesh(g, this._mat(mat));
      m.matrixAutoUpdate = false;
      m.receiveShadow = true; m.castShadow = true;
      out.push(m);
    }
    return out;
  }
}

// ------------------------------------------------------------ small shape helpers
const M4 = () => new THREE.Matrix4();
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
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
export function lathe(points, seg = 12) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
