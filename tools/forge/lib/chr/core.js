// Character toolkit core: smooth lofted shapes (torsos, heads, craniums),
// limbs with metre-based UVs, cached materials and painted canvas textures.
// Everything is in metres, forward +Z, up +Y; a character's right side is -X.
//
//   loftGeo(secs, o)        rings of superellipse sections → one smooth closed surface
//   limbGeo(len, r0, r1, o) capsule-like tapered limb pointing down -Y (joint at 0, end at -len)
//   limb(parent, len, r0, r1, mat, o) → { joint, mesh, end, len }  (rig.js bone() with nicer geometry)
//   mesh(geo, mat, x, y, z, rx, ry, rz, sx, sy, sz)
//   mat(color, o) / glow(color, k) / canvasTex(key, w, h, draw, repeat)
//   camo(kind) → tiling colour texture for BDUs
import * as THREE from 'three';
import { fbm, vnoise, hash, mulberry32 } from '../noise.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ geometry
function se(a, n) {
  const c = Math.cos(a), s = Math.sin(a), p = 2 / n;
  return [Math.sign(s) * Math.pow(Math.abs(s), p), Math.sign(c) * Math.pow(Math.abs(c), p)];
}
// secs: [{ y, rx, rz, cx=0, cz=0, n }] or [y, rx, rz, cz, cx]. Angle 0 is the front (+Z),
// increasing toward +X. o: seg, n (superellipse exponent, 2 = ellipse), a0/a1 (partial,
// open surface), uv: 'unit' (u around 0..1 with the front at 0.5, v by height 0..1) or
// 'metre' (u, v in metres), cap (fan-close open end rings), flipY sections allowed.
export function loftGeo(secs, o = {}) {
  const seg = o.seg ?? 16, n0 = o.n ?? 2;
  const partial = o.a0 !== undefined || o.a1 !== undefined;
  const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI;
  const S = secs.map((s) => (Array.isArray(s) ? { y: s[0], rx: s[1], rz: s[2], cz: s[3] ?? 0, cx: s[4] ?? 0 } : { cx: 0, cz: 0, ...s }));
  const ys = S.map((s) => s.y), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const pos = [], uv = [], idx = [];
  const R = seg + 1;
  let vm = 0;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (i > 0) vm += Math.hypot(s.y - S[i - 1].y, (s.rx + s.rz) / 2 - (S[i - 1].rx + S[i - 1].rz) / 2, s.cz - S[i - 1].cz);
    const n = s.n ?? n0;
    const circ = Math.PI * (s.rx + s.rz) * ((a1 - a0) / (2 * Math.PI));
    for (let j = 0; j <= seg; j++) {
      const a = a0 + ((a1 - a0) * j) / seg;
      const [ex, ez] = se(a, n);
      const tw = s.tw ? s.tw * Math.max(0, ez) : 0; // optional forward bulge weight on the front
      pos.push(s.cx + s.rx * ex, s.y, s.cz + s.rz * ez + tw);
      if (o.uv === 'metre') uv.push((j / seg) * circ, vm);
      else uv.push(partial ? j / seg : (a + Math.PI) / (2 * Math.PI), (s.y - ymin) / (ymax - ymin || 1));
    }
  }
  const up = S[S.length - 1].y >= S[0].y;
  for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
    if (up) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  // caps (fan) on open end rings
  if (o.cap) {
    for (const [ri, top] of [[0, !up], [S.length - 1, up]]) {
      const s = S[ri];
      if (s.rx < 1e-5 && s.rz < 1e-5) continue;
      const ci = pos.length / 3;
      pos.push(s.cx, s.y, s.cz); uv.push(0.5, (s.y - ymin) / (ymax - ymin || 1));
      for (let j = 0; j < seg; j++) {
        const a = ri * R + j, b = a + 1;
        if (top) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam and the poles so closed shapes shade smoothly
  const nrm = g.attributes.normal;
  const tmp = new THREE.Vector3(), t2 = new THREE.Vector3();
  if (!partial) for (let i = 0; i < S.length; i++) {
    tmp.fromBufferAttribute(nrm, i * R).add(t2.fromBufferAttribute(nrm, i * R + seg)).normalize();
    nrm.setXYZ(i * R, tmp.x, tmp.y, tmp.z); nrm.setXYZ(i * R + seg, tmp.x, tmp.y, tmp.z);
  }
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (s.rx > 1e-5 || s.rz > 1e-5) continue;
    const sgn = i === 0 ? (up ? -1 : 1) : (up ? 1 : -1);
    for (let j = 0; j <= seg; j++) nrm.setXYZ(i * R + j, 0, sgn, 0);
  }
  g.computeBoundingSphere();
  return g;
}

// A smooth ellipsoid-ish blob: rings from bottom to top with given radii profile.
export function ellipsoidGeo(rx, ry, rz, seg = 14, rings = 9) {
  const secs = [];
  for (let i = 0; i <= rings; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / rings, c = Math.cos(t);
    secs.push({ y: Math.sin(t) * ry, rx: rx * c, rz: rz * c });
  }
  return loftGeo(secs, { seg });
}

const limbCache = new Map();
// Tapered limb: a rounded cap of r0 at the joint, a shaft (optionally bulging to rm at
// fraction tm) down to r1 at -len, a rounded cap there. sx/sz flatten the section.
export function limbGeo(len, r0, r1, o = {}) {
  const key = JSON.stringify([len, r0, r1, o]);
  if (limbCache.has(key)) return limbCache.get(key);
  const sx = o.sx ?? 1, sz = o.sz ?? 1, seg = o.seg ?? 10;
  const secs = [];
  const capN = 3;
  for (let i = 0; i <= capN; i++) { const t = (Math.PI / 2) * (1 - i / capN); secs.push({ y: Math.sin(t) * r0, rx: Math.cos(t) * r0 * sx, rz: Math.cos(t) * r0 * sz }); }
  if (o.rm) {
    const tm = o.tm ?? 0.35;
    secs.push({ y: -len * tm * 0.5, rx: lerp(r0, o.rm, 0.7) * sx, rz: lerp(r0, o.rm, 0.7) * sz });
    secs.push({ y: -len * tm, rx: o.rm * sx, rz: o.rm * sz });
    secs.push({ y: -len * (tm + (1 - tm) * 0.55), rx: lerp(o.rm, r1, 0.6) * sx, rz: lerp(o.rm, r1, 0.6) * sz });
  } else secs.push({ y: -len * 0.5, rx: (r0 + r1) / 2 * sx, rz: (r0 + r1) / 2 * sz });
  for (let i = 0; i <= capN; i++) { const t = (-Math.PI / 2) * (i / capN); secs.push({ y: -len + Math.sin(t) * r1, rx: Math.cos(t) * r1 * sx, rz: Math.cos(t) * r1 * sz }); }
  // loft wants increasing or decreasing y: this is decreasing (top to bottom)
  const g = loftGeo(secs, { seg, uv: 'metre' });
  limbCache.set(key, g);
  return g;
}

export function joint(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

export function limb(parent, len, r0, r1, material, o = {}) {
  const j = joint(o.x || 0, o.y || 0, o.z || 0);
  const m = new THREE.Mesh(limbGeo(len, r0, r1, { rm: o.rm, tm: o.tm, sx: o.sx, sz: o.sz, seg: o.seg }), material);
  j.add(m);
  const end = joint(0, -len, 0);
  j.add(end);
  parent.add(j);
  return { joint: j, mesh: m, end, len };
}

export function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  return m;
}
export const add = (parent, m) => { parent.add(m); return m; };

// Box with bevelled edges, centred (w, h, d).
const boxCache = new Map();
export function rboxGeo(w, h, d, r = 0.004) {
  const key = [w, h, d, r].join('|');
  if (boxCache.has(key)) return boxCache.get(key);
  // RoundedBox-lite: a box with chamfers via ExtrudeGeometry bevel
  r = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
  const shape = new THREE.Shape();
  const x0 = -w / 2 + r, y0 = -h / 2 + r, x1 = w / 2 - r, y1 = h / 2 - r;
  shape.moveTo(x0, -h / 2 + r); shape.lineTo(x1, -h / 2 + r); shape.lineTo(x1, y1); shape.lineTo(x0, y1); shape.lineTo(x0, y0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, d - 2 * r), bevelEnabled: r > 0, bevelThickness: r, bevelSize: r, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  boxCache.set(key, g);
  return g;
}
export const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sph = (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
export const cyl = (r0, r1, h, s = 10, open = false) => new THREE.CylinderGeometry(r1, r0, h, s, 1, open); // r0 bottom, r1 top

// Extruded side profile (x = thickness): pts [[z, y], ...] in metres.
export function profileGeo(pts, thick, bevel = 0.003) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, thick - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(thick - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2); // shape x → +z, extrude along x
  g.computeVertexNormals();
  return g;
}

// Tube along a list of points (hoses, cables, conduits).
export function tubeGeo(points, r, seg = 20, rs = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(...p))));
  return new THREE.TubeGeometry(curve, seg, r, rs, false);
}

// ------------------------------------------------------------------ materials
const matCache = new Map();
// o: rough, metal, map (texture), emissive, ei, side, flat, opacity, bump
export function mat(color, o = {}) {
  const key = JSON.stringify([color, { ...o, map: o.map ? o.map.uuid : null, emissiveMap: o.emissiveMap ? o.emissiveMap.uuid : null }]);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0,
    map: o.map || null, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, emissiveMap: o.emissiveMap || null,
    envMap: o.env ? envTex() : null, envMapIntensity: o.envI ?? 1,
    flatShading: !!o.flat, side: o.side ?? THREE.FrontSide,
    transparent: o.opacity != null, opacity: o.opacity ?? 1,
  });
  matCache.set(key, m);
  return m;
}
// A painted studio environment (equirectangular) so chrome and metal have something to
// reflect: a bright sky dome with softboxes, a hard horizon line, a warm dark floor.
let _env = null;
export function envTex() {
  if (_env) return _env;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#f4f8ff'); grd.addColorStop(0.35, '#aebccc'); grd.addColorStop(0.49, '#dfe6ee'); grd.addColorStop(0.5, '#3a3530');
  grd.addColorStop(0.62, '#5a4c40'); grd.addColorStop(1, '#1c1814');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffffff';
  for (const [x, y, w, h] of [[60, 40, 90, 40], [300, 30, 120, 30], [200, 90, 40, 20], [430, 80, 50, 26]]) g.fillRect(x, y, w, h);
  g.fillStyle = '#10141c'; g.fillRect(0, 108, 512, 10);
  _env = new THREE.CanvasTexture(c);
  _env.mapping = THREE.EquirectangularReflectionMapping;
  _env.colorSpace = THREE.SRGBColorSpace;
  return _env;
}
// Self-lit colour (eyes, glows, flashes). k > 1 overdrives toward white.
export function glow(color, k = 1) {
  const key = 'glow|' + color + '|' + k;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ textures
const texCache = new Map();
export function canvasTex(key, w, h, draw, repeat = null) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  texCache.set(key, t);
  return t;
}
// Per-pixel painter into a tiling texture: paint(u, v) → [r, g, b] (0..255)
export function pixTex(key, size, paint, repeat = [1, 1]) {
  return canvasTex(key, size, size, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = paint(i / w, j / h, i, j), o = (j * w + i) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, repeat);
}
export const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Tiling camouflage / fabric textures, UVs in metres (tile = metres per repeat).
export function camo(kind, tile = 0.6) {
  const rep = [1 / tile, 1 / tile];
  if (kind === 'desert') {
    // 3-colour desert: tan base, pale olive drifts, brown streaks
    const base = rgb(0xc8b28a), olive = rgb(0xaea27c), brown = rgb(0x977b5c);
    return pixTex('camo-desert', 128, (u, v, i, j) => {
      const a = fbm(u * 3, v * 3, 3, 4, 101), b = fbm(u * 4 + 7, v * 2.2, 4, 3, 202);
      let c = base;
      if (a > 0.56) c = olive;
      if (b > 0.6 && Math.abs(Math.sin((u * 2 + v) * 9 + a * 6)) > 0.2) c = brown;
      const n = 0.93 + 0.07 * hash(i, j, 3) + ((i + j) % 2 ? 0.02 : -0.02);
      return c.map((x) => x * n);
    }, rep);
  }
  if (kind === 'woodland') {
    const khaki = rgb(0x9c9372), green = rgb(0x5f6c43), brown = rgb(0x6a5138), black = rgb(0x302d27);
    return pixTex('camo-woodland', 128, (u, v, i, j) => {
      const a = fbm(u * 3, v * 3, 3, 4, 11), b = fbm(u * 3 + 5, v * 3 + 2, 3, 4, 22), c2 = fbm(u * 5, v * 5, 5, 3, 33);
      let c = khaki;
      if (a > 0.48) c = green;
      if (b > 0.58) c = brown;
      if (c2 > 0.7) c = black;
      const n = 0.92 + 0.08 * hash(i, j, 5) + ((i + j) % 2 ? 0.02 : -0.02);
      return c.map((x) => x * n);
    }, rep);
  }
  if (kind === 'weave') {
    return pixTex('fab-weave', 64, (u, v, i, j) => { const n = 0.86 + 0.08 * ((i + j) % 2) + 0.08 * fbm(u * 4, v * 4, 4, 3, 7); return [255 * n, 255 * n, 255 * n]; }, rep);
  }
  if (kind === 'skin') {
    return pixTex('skin-mottle', 64, (u, v) => { const n = 0.9 + 0.1 * fbm(u * 5, v * 5, 5, 4, 9); return [255 * n, 255 * n, 255 * n]; }, rep);
  }
  if (kind === 'alien') {
    // mottled with faint darker veins
    return pixTex('skin-alien', 128, (u, v) => {
      const n = 0.88 + 0.12 * fbm(u * 6, v * 6, 6, 4, 41);
      const vein = Math.abs(fbm(u * 4, v * 4, 4, 3, 43) - 0.5) < 0.02 ? 0.86 : 1;
      return [255 * n * vein, 255 * n * vein, 255 * n * vein];
    }, rep);
  }
  if (kind === 'ribbed') {
    return pixTex('ribbed', 64, (u, v, i, j) => { const n = 0.75 + 0.25 * Math.abs(Math.sin(v * Math.PI * 8)) + 0.05 * fbm(u * 4, v * 4, 4, 3, 17); return [255 * n, 255 * n, 255 * n]; }, rep);
  }
  throw new Error('unknown camo ' + kind);
}

export { THREE, fbm, vnoise, hash, mulberry32, mixc };

// Torso from one profile, cut into overlapping pieces that ride different joints.
// profile: [[y, rx, rz, cz?], ...] in rest-pose absolute heights (ascending y).
// Returns a loft geometry for [y0, y1], expressed relative to jointY, with rounded
// (tapering) ends so a piece tucks inside its neighbour without a ring seam.
export function profileAt(profile, y) {
  const P = profile;
  if (y <= P[0][0]) return P[0].slice();
  for (let i = 1; i < P.length; i++) if (y <= P[i][0]) {
    const a = P[i - 1], b = P[i], t = (y - a[0]) / (b[0] - a[0] || 1);
    return [y, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] ?? 0, b[3] ?? 0, t), lerp(a[4] ?? 0, b[4] ?? 0, t)];
  }
  return P[P.length - 1].slice();
}
export function sliceGeo(profile, y0, y1, jointY, o = {}) {
  const secs = [];
  const r0 = profileAt(profile, y0), r1 = profileAt(profile, y1);
  const round = (row, dir, closeBottom) => {
    const out = [];
    const rr = Math.min(row[1], row[2]) * (o.roundK ?? 0.6);
    for (const k of [0.55, 0.85, 1]) {
      const a = k * Math.PI / 2;
      out.push([row[0] + dir * Math.sin(a) * rr, row[1] * Math.cos(a), row[2] * Math.cos(a), row[3] ?? 0, row[4] ?? 0]);
    }
    return out;
  };
  const inner = profile.filter((p) => p[0] > y0 + 1e-4 && p[0] < y1 - 1e-4);
  const body = [r0, ...inner, r1];
  if (o.openBottom) secs.push(...[]); else secs.push(...round(r0, -1).reverse());
  secs.push(...body);
  if (!o.openTop) secs.push(...round(r1, 1));
  return loftGeo(secs.map(([y, rx, rz, cz, cx]) => ({ y: y - jointY, rx, rz, cz: cz ?? 0, cx: cx ?? 0, n: o.n })), { seg: o.seg ?? 18, n: o.n ?? 2, uv: o.uv ?? 'metre' });
}
