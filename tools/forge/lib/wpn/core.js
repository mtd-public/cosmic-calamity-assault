// Shared weapon/item toolkit: studio environment, materials with procedural
// normal maps, beveled-profile geometry, and the HUD / pickup renderers.
//
// HUD frames (hud()): like forge.hudFrames, but
//   - the projection keeps the 4:3 aspect (90° horizontal) over the 960x600
//     buffer. three's setViewOffset() resets the aspect to 960/600 = 1.6, which
//     renders square pixels that GZDoom then stretches ×1.2 vertically (psprites
//     are drawn in 320x200 space on a 4:3 frame). Rendering pre-squashed makes
//     the gun look right in game (round muzzles stay round).
//   - it renders `margin` virtual px beyond the left/right screen edges so a
//     hip arm that exits the bottom-right is not cut on 16:9 / 16:10 screens.
//   - a studio environment map, so metal reads as metal.
// Offsets: screen left = -grab[0], top = 32*scale - grab[1] (hw_weapon.cpp).
import * as THREE from 'three';
import { mergeVertices } from '../addons/BufferGeometryUtils.js';
import { fbm, vnoise, hash } from '../noise.js';

export { THREE };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const D2R = Math.PI / 180;

// ------------------------------------------------------------------ environment
const envCache = new Map();
// A photo-studio room: dark walls, a big overhead softbox, a strip light on the
// left, a cool fill on the right, a warm low bounce. Gives metal its highlights
// and a horizon line.
export function studioEnv(renderer, kind = 'studio') {
  if (envCache.has(kind)) return envCache.get(kind);
  const s = new THREE.Scene();
  const basic = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide });
  // gradient room: top brighter than the floor
  const roomGeo = new THREE.SphereGeometry(20, 32, 16);
  const col = [];
  const p = roomGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    const t = y > 0 ? 0.16 + 0.1 * y : 0.1 + 0.04 * (1 + y);
    const warm = y < 0 ? 1 : 0;
    col.push(t * (1 + 0.1 * warm), t * (1 + 0.02 * warm), t * (1.05 - 0.1 * warm));
  }
  roomGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(roomGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, c, k, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(c, k)); m.position.set(...pos); m.lookAt(...look); s.add(m); };
  if (kind === 'studio') {
    panel(14, 6, 0xffffff, 2.2, [-1, 9, 4], [0, 0, 0]);      // overhead softbox, slightly front
    panel(2, 12, 0xfff2e0, 2.6, [-9, 2, 3], [0, 0, 0]);      // strip left
    panel(3, 8, 0xcfe0ff, 1.1, [9, 1, 2], [0, 0, 0]);        // cool fill right
    panel(10, 1.2, 0xffffff, 1.8, [0, 3, -12], [0, 0, 0]);   // horizon strip behind
    panel(16, 4, 0x6a5a48, 0.6, [0, -8, 0], [0, 0, 0]);      // warm floor bounce
  } else if (kind === 'alien') {
    panel(14, 6, 0xf0e8ff, 2.0, [-1, 9, 4], [0, 0, 0]);
    panel(2, 12, 0x9fffe8, 2.2, [-9, 2, 3], [0, 0, 0]);
    panel(3, 8, 0xc890ff, 1.6, [9, 1, 2], [0, 0, 0]);
    panel(10, 1.2, 0xffffff, 1.6, [0, 3, -12], [0, 0, 0]);
    panel(16, 4, 0x4a3a58, 0.6, [0, -8, 0], [0, 0, 0]);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  envCache.set(kind, tex);
  return tex;
}

// Camera-space light rig for first-person frames: key from upper left behind
// the viewer (like a ceiling light over the shoulder), cool fill from the
// right, a rim from ahead so silhouettes separate from dark levels.
export function hudLights(scene, o = {}) {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0xdfe6ff, 0x40382e, o.hemi ?? 0.55));
  const key = new THREE.DirectionalLight(0xfff1e0, o.key ?? 2.2); key.position.set(-2, 4, 3); g.add(key); g.add(key.target);
  const fill = new THREE.DirectionalLight(0xb8ccff, o.fill ?? 0.6); fill.position.set(4, 0.5, 2); g.add(fill); g.add(fill.target);
  const rim = new THREE.DirectionalLight(0xffffff, o.rim ?? 1.3); rim.position.set(2, 2.5, -4); g.add(rim); g.add(rim.target);
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ textures
const texCache = new Map();
function canvasTex(key, size, paint, { color = false, repeat = 1 } = {}) {
  const k = key + ':' + size;
  if (texCache.has(k)) { const t = texCache.get(k); return t; }
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const r = paint(i / size, j / size, i, j), o = (j * size + i) * 4;
    img.data[o] = r[0]; img.data[o + 1] = r[1]; img.data[o + 2] = r[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  texCache.set(k, t);
  return t;
}
// Tileable normal map from a height field h(u,v) in 0..1 (periodic over the unit square).
export function normalTex(key, size, h, strength = 2) {
  const k = 'n:' + key + ':' + size;
  if (texCache.has(k)) return texCache.get(k);
  const H = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) H[j * size + i] = h(i / size, j / size, i, j);
  const at = (i, j) => H[((j + size) % size) * size + ((i + size) % size)];
  const t = canvasTex(k, size, (u, v, i, j) => {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    const n = new THREE.Vector3(-dx, dy, 1).normalize();
    return [(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255];
  });
  texCache.set(k, t);
  return t;
}
// Cellular bumps (stipple / pores): distance to the nearest jittered point, periodic.
function cells(u, v, n, seed) {
  const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
  let d = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const px = cx + hash(wx, wy, seed), py = cy + hash(wx, wy, seed + 7);
    d = Math.min(d, Math.hypot(x - px, y - py));
  }
  return d;
}
export const NMAP = {
  stipple: () => normalTex('stipple', 256, (u, v) => Math.max(0, 1 - cells(u, v, 40, 3) * 2.2) * 0.8 + fbm(u * 8, v * 8, 8, 3, 5) * 0.2, 5),
  grip: () => normalTex('grip', 256, (u, v) => { const a = Math.max(0, 1 - cells(u, v, 28, 9) * 1.8); return a * a; }, 7),
  wool: () => normalTex('wool', 256, (u, v) => 0.55 * (0.5 + 0.5 * Math.sin((u * 48 + v * 48) * Math.PI * 2)) * (0.7 + 0.3 * vnoise(u * 64, v * 16, 64, 4)) + 0.45 * fbm(u * 16, v * 16, 16, 4, 8), 2.2),
  suit: () => normalTex('suit', 256, (u, v, i, j) => 0.5 * (((i >> 1) + (j >> 1)) % 2) + 0.5 * fbm(u * 32, v * 32, 32, 3, 12), 0.8),
  shirt: () => normalTex('shirt', 128, (u, v, i, j) => 0.5 * ((i + j) % 2) + 0.5 * fbm(u * 16, v * 16, 16, 2, 14), 0.5),
  skin: () => normalTex('skin', 256, (u, v) => 0.6 * fbm(u * 24, v * 24, 24, 4, 21) + 0.4 * Math.max(0, 1 - cells(u, v, 48, 22) * 3), 1.4),
  knurl: () => normalTex('knurl', 128, (u, v) => Math.abs(Math.sin((u + v) * 16 * Math.PI)) * Math.abs(Math.sin((u - v) * 16 * Math.PI)), 3),
  brushed: () => normalTex('brushed', 256, (u, v) => vnoise(u * 256, v * 4, 256, 31) * 0.6 + vnoise(u * 128, v * 2, 128, 33) * 0.4, 0.6),
  cast: () => normalTex('cast', 256, (u, v) => fbm(u * 12, v * 12, 12, 4, 41), 1.2),
  leather: () => normalTex('leather', 256, (u, v) => Math.pow(1 - Math.min(1, cells(u, v, 24, 51) * 1.3), 0.5) * 0.7 + fbm(u * 20, v * 20, 20, 3, 52) * 0.3, 2),
  bone: () => normalTex('bone', 256, (u, v) => fbm(u * 6, v * 20, 6, 5, 61) * 0.8 + fbm(u * 30, v * 30, 30, 2, 62) * 0.2, 2.5),
  alien: () => normalTex('alienskin', 256, (u, v) => Math.abs(fbm(u * 5, v * 5, 5, 5, 71) * 2 - 1), 3),
};
// Colour/roughness variation maps (sRGB multipliers)
export const CMAP = {
  wear: () => canvasTex('c:wear', 256, (u, v) => { const n = 0.86 + 0.14 * fbm(u * 6, v * 6, 6, 4, 81); const x = n * 255; return [x, x, x]; }, { color: true }),
  wool: () => canvasTex('c:wool', 256, (u, v) => { const n = 0.8 + 0.2 * fbm(u * 40, v * 40, 40, 3, 83) + 0.05 * Math.sin((u * 48 + v * 48) * Math.PI * 2); const x = Math.min(255, n * 255); return [x, x, x]; }, { color: true }),
  skin: () => canvasTex('c:skin', 256, (u, v) => { const n = fbm(u * 5, v * 5, 5, 4, 85), m = fbm(u * 13, v * 13, 13, 3, 86), f = Math.max(0, 1 - cells(u, v, 18, 87) * 3) * 0.06; const r = 0.9 + 0.1 * n - f * 0.5, gch = 0.84 + 0.12 * n - 0.06 * m - f, b = 0.82 + 0.1 * n - 0.05 * m - f; return [255 * r, 255 * gch, 255 * b]; }, { color: true }),
  bone: () => canvasTex('c:bone', 256, (u, v) => { const n = fbm(u * 4, v * 14, 4, 5, 87); const s = 0.78 + 0.22 * n; return [255 * s, 255 * (s * 0.97), 255 * (s * 0.9)]; }, { color: true }),
};

// ------------------------------------------------------------------ materials
const matCache = new Map();
// mat(name) → a cached material from the palette; mat(name, overrides) for variants.
const PALETTE = {
  // gun finishes
  slide: { c: 0x2c2f34, metal: 0.85, rough: 0.34, n: 'cast', ns: 0.15, map: 'wear' },
  gunmetal: { c: 0x3b3f45, metal: 0.85, rough: 0.36, n: 'cast', ns: 0.15, map: 'wear' },
  alloy: { c: 0x26282c, metal: 0.55, rough: 0.46, n: 'cast', ns: 0.2, map: 'wear' },
  steel: { c: 0x8e939a, metal: 1, rough: 0.26, n: 'brushed', ns: 0.25 },
  darksteel: { c: 0x4a4e55, metal: 1, rough: 0.3, n: 'brushed', ns: 0.2 },
  parkerized: { c: 0x34363a, metal: 0.6, rough: 0.55, n: 'cast', ns: 0.35, map: 'wear' },
  polymer: { c: 0x1c1d20, metal: 0, rough: 0.58, n: 'cast', ns: 0.2 },
  polymerGrip: { c: 0x1e1f22, metal: 0, rough: 0.72, n: 'grip', ns: 1, rep: [3, 3] },
  stipple: { c: 0x1f2023, metal: 0, rough: 0.8, n: 'stipple', ns: 1, rep: [2, 2] },
  rubber: { c: 0x151516, metal: 0, rough: 0.9, n: 'stipple', ns: 0.6 },
  brass: { c: 0xc9a24e, metal: 1, rough: 0.28 },
  copper: { c: 0xb8724a, metal: 1, rough: 0.3 },
  shellRed: { c: 0x9c1c18, metal: 0, rough: 0.45 },
  white: { c: 0xe8e8e2, metal: 0, rough: 0.5 },
  black: { c: 0x0b0b0c, metal: 0, rough: 0.6 },
  bore: { c: 0x050505, metal: 0.3, rough: 0.8 },
  glass: { c: 0x10161c, metal: 0.2, rough: 0.05, phys: { clearcoat: 1, clearcoatRoughness: 0.02 } },
  lensBlue: { c: 0x1a2a4a, metal: 0.4, rough: 0.05, phys: { clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.6 } },
  // flashlight
  alu: { c: 0x3a3c40, metal: 0.8, rough: 0.4, n: 'cast', ns: 0.2 },
  aluKnurl: { c: 0x3a3c40, metal: 0.8, rough: 0.45, n: 'knurl', ns: 1, rep: [6, 6] },
  // the agent
  skin: { c: 0x9a6450, metal: 0, rough: 0.55, n: 'skin', ns: 0.9, map: 'skin', rep: [3, 3], env: 0.55, phys: { sheen: 0.25, sheenColor: 0xd89a80, sheenRoughness: 0.5, clearcoat: 0.06, clearcoatRoughness: 0.5 } },
  nail: { c: 0xc49484, metal: 0, rough: 0.3, env: 0.6, phys: { clearcoat: 0.6, clearcoatRoughness: 0.3 } },
  wool: { c: 0x2a2a2e, metal: 0, rough: 0.95, n: 'wool', ns: 1.1, map: 'wool', rep: [5, 5], phys: { sheen: 0.8, sheenColor: 0x70707a, sheenRoughness: 0.6 } },
  woolLining: { c: 0x2b1e22, metal: 0, rough: 0.8, phys: { sheen: 0.5, sheenColor: 0x5a4048, sheenRoughness: 0.4 }, side: 'double' },
  suit: { c: 0x3c3f47, metal: 0, rough: 0.85, n: 'suit', ns: 0.6, rep: [8, 8], phys: { sheen: 0.5, sheenColor: 0x8088a0, sheenRoughness: 0.5 } },
  shirt: { c: 0xe6e4df, metal: 0, rough: 0.78, n: 'shirt', ns: 0.4, rep: [10, 10], phys: { sheen: 0.4, sheenColor: 0xffffff, sheenRoughness: 0.6 } },
  button: { c: 0xd8d4c8, metal: 0, rough: 0.35 },
  watchSteel: { c: 0xc4c8ce, metal: 1, rough: 0.18 },
  watchFace: { c: 0xece6d6, metal: 0, rough: 0.35 },
  watchStrap: { c: 0x3b2418, metal: 0, rough: 0.6, n: 'leather', ns: 0.7, rep: [4, 4] },
  watchGlass: { c: 0x202428, metal: 0, rough: 0.02, phys: { clearcoat: 1, transmission: 0 }, opacity: 0.25 },
  buckle: { c: 0x2a2826, metal: 0.7, rough: 0.35 },
  leatherBrown: { c: 0x3a2518, metal: 0, rough: 0.55, n: 'leather', ns: 0.8, rep: [3, 3] },
  // alien
  bone: { c: 0xd8cdb0, metal: 0, rough: 0.55, n: 'bone', ns: 1.2, map: 'bone', phys: { clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: 0xfff0d0 } },
  boneDark: { c: 0x8a7c66, metal: 0, rough: 0.6, n: 'bone', ns: 1.2, map: 'bone' },
  chrome: { c: 0xd4d8e0, metal: 1, rough: 0.1 },
  chromeViolet: { c: 0xb8a8d8, metal: 1, rough: 0.14, phys: { iridescence: 0.8, iridescenceIOR: 1.6 } },
  alienFlesh: { c: 0x3a2a4a, metal: 0, rough: 0.45, n: 'alien', ns: 1.5, phys: { clearcoat: 0.8, clearcoatRoughness: 0.25 } },
  alienShell: { c: 0x2a2436, metal: 0.4, rough: 0.3, n: 'alien', ns: 0.8, phys: { clearcoat: 1, clearcoatRoughness: 0.15, iridescence: 0.5 } },
};
export function mat(name, over = {}) {
  const key = name + JSON.stringify(over);
  if (matCache.has(key)) return matCache.get(key);
  const P = { ...(PALETTE[name] || { c: 0xff00ff }), ...over };
  const opts = {
    color: P.c, roughness: P.rough ?? 0.6, metalness: P.metal ?? 0,
    side: P.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
  };
  if (P.n) {
    const t = NMAP[P.n]().clone(); t.needsUpdate = true;
    if (P.rep) t.repeat.set(...P.rep);
    opts.normalMap = t; opts.normalScale = new THREE.Vector2(P.ns ?? 1, P.ns ?? 1);
  }
  if (P.map) { const t = CMAP[P.map]().clone(); t.needsUpdate = true; if (P.rep) t.repeat.set(...P.rep); opts.map = t; }
  if (P.emissive != null) { opts.emissive = P.emissive; opts.emissiveIntensity = P.ei ?? 1; }
  if (P.opacity != null) { opts.transparent = true; opts.opacity = P.opacity; opts.depthWrite = false; }
  let m;
  if (P.phys) {
    const ph = { ...P.phys };
    if (ph.sheenColor != null) ph.sheenColor = new THREE.Color(ph.sheenColor);
    m = new THREE.MeshPhysicalMaterial({ ...opts, ...ph });
  } else m = new THREE.MeshStandardMaterial(opts);
  m.envMapIntensity = P.env ?? 1;
  matCache.set(key, m);
  return m;
}
// Self-lit (sights, lenses, energy): colour at full brightness regardless of light.
export function glow(color, k = 1) {
  const key = 'glow' + color + ':' + k;
  if (matCache.has(key)) return matCache.get(key);
  const c = new THREE.Color(color).multiplyScalar(k);
  const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  matCache.set(key, m);
  return m;
}
// Emissive surface that still shades (glowing panels on alien guns).
export function lit(color, emissive, ei = 1, o = {}) {
  return mat('_lit', { c: color, emissive, ei, rough: o.rough ?? 0.35, metal: o.metal ?? 0, ...o });
}

// ------------------------------------------------------------------ geometry
// Smooth normals across coincident vertices whose faces meet at less than
// `crease` radians (precise hashing: small parts are millimetres).
export function creased(geo, crease = 0.6) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, n = pos.count;
  const fn = new Float32Array(n * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const nn = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const area = nn.length(); if (area > 0) nn.divideScalar(area);
    for (let k = 0; k < 3; k++) { fn[(i + k) * 3] = nn.x; fn[(i + k) * 3 + 1] = nn.y; fn[(i + k) * 3 + 2] = nn.z; }
  }
  const map = new Map(), H = 2e4;
  const key = (i) => `${Math.round(pos.getX(i) * H)},${Math.round(pos.getY(i) * H)},${Math.round(pos.getZ(i) * H)}`;
  for (let i = 0; i < n; i++) { const k = key(i); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  const out = new Float32Array(n * 3), cd = Math.cos(crease);
  for (const idx of map.values()) for (const i of idx) {
    let x = 0, y = 0, z = 0;
    for (const j of idx) {
      const d = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
      if (d >= cd) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; }
    }
    const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}
// Box-projected UVs (so tiling normal maps land sensibly on any shape). s = metres per tile.
export function boxUV(geo, s = 0.05) {
  const p = geo.attributes.position, nr = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(nr.getX(i)), ny = Math.abs(nr.getY(i)), nz = Math.abs(nr.getZ(i));
    const x = p.getX(i) / s, y = p.getY(i) / s, z = p.getZ(i) / s;
    if (nx >= ny && nx >= nz) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ny >= nz) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const mk = (geo, m) => { const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m); return o; };
export const mesh = mk;

// Points helpers for 2D profiles
export const arc = (cx, cy, r, a0, a1, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
export function rrect(w, h, r, cx = 0, cy = 0, n = 4) {
  const pts = []; r = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5);
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
  for (const [x, y, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + x + Math.cos(a) * r, cy + y + Math.sin(a) * r]); }
  return pts;
}
// Round the corners of a polygon: r per vertex (number or array), n segments per corner.
export function fillet(pts, r = 0.003, n = 3) {
  const out = [], N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i], a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    const rr = Array.isArray(r) ? r[i] : r;
    if (!rr) { out.push(p); continue; }
    const da = [a[0] - p[0], a[1] - p[1]], db = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...da), lb = Math.hypot(...db);
    const t = Math.min(rr, la * 0.45, lb * 0.45);
    const A = [p[0] + da[0] / la * t, p[1] + da[1] / la * t], B = [p[0] + db[0] / lb * t, p[1] + db[1] / lb * t];
    for (let k = 0; k <= n; k++) { const u = k / n; // quadratic bezier A → p → B
      out.push([(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * p[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * p[1] + u * u * B[1]]); }
  }
  return out;
}
function shapeOf(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  return s;
}
// Extrude a 2D profile with beveled edges. Profile coordinates are (u, v);
// axis selects how they map into the part's space:
//   'x' (side profile): u = forward (toward -Z), v = up (+Y), extruded across X (width)
//   'z' (cross-section): u = X, v = Y, extruded along Z from z0 to z1 (pass [z0, z1] as width)
//   'y' (plan): u = X, v = forward (-Z), extruded along Y
export function extrude(pts, width, { axis = 'x', bevel = 0.0012, seg = 2, holes = [], crease = 0.55, uv = 0.04, curve = 8 } = {}) {
  const [a0, a1] = Array.isArray(width) ? width : [-width / 2, width / 2];
  const depth = a1 - a0;
  const bt = Math.min(bevel, depth * 0.3);
  const geo = new THREE.ExtrudeGeometry(shapeOf(pts, holes), {
    depth: Math.max(1e-5, depth - 2 * bt), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: seg, curveSegments: curve,
  });
  geo.translate(0, 0, a0 + bt);
  if (axis === 'x') geo.rotateY(Math.PI / 2); // (u, v, w) → (w, v, -u)
  else if (axis === 'y') geo.rotateX(-Math.PI / 2); // (u, v, w) → (u, w, -v)
  return boxUV(creased(geo, crease), uv);
}
// A rounded box (all edges radius r), smooth normals (three's RoundedBoxGeometry method).
export function rbox(w, h, d, r = 0.002, seg = 3) {
  r = Math.min(r, w / 2 - 1e-6, h / 2 - 1e-6, d / 2 - 1e-6);
  const S = seg * 2 + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, S, S, S);
  const p = g.attributes.position, nr = g.attributes.normal, half = 0.5 / S;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    n.set(x - Math.sign(x) * half, y - Math.sign(y) * half, z - Math.sign(z) * half).normalize();
    p.setXYZ(i, bx * Math.sign(x) + n.x * r, by * Math.sign(y) + n.y * r, bz * Math.sign(z) + n.z * r);
    nr.setXYZ(i, n.x, n.y, n.z);
  }
  return boxUV(g, 0.04);
}
// Cylinder along Z (from z0 to z1), radius r0 at z0 and r1 at z1.
export function cylZ(r0, r1, z0, z1, seg = 24, open = false) {
  if (z1 < z0) { [z0, z1] = [z1, z0]; [r0, r1] = [r1, r0]; }
  const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg, 1, open);
  g.rotateX(Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); // +Y (top, r1) → +Z
  return boxUV(g, 0.04);
}
// Lathe around Z: pts [[r, z], ...] (z along the axis), smooth.
export function latheZ(pts, seg = 24, phi0 = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(Math.max(1e-5, r), z)), seg, phi0, phiLen);
  g.rotateX(Math.PI / 2); // lathe axis +Y → +Z
  return boxUV(g, 0.04);
}
// Lathe around Y, pts [[r, y]]
export function latheY(pts, seg = 24) {
  return boxUV(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(1e-5, r), y)), seg), 0.04);
}
// Tube through points (smooth), radius r (number or fn(t))
export function tubeAlong(points, r, seg = 24, radial = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, typeof r === 'number' ? r : 1, radial, closed);
  if (typeof r === 'function') {
    const p = g.attributes.position, fr = curve.computeFrenetFrames(seg, closed);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, c = curve.getPointAt(t), rr = r(t);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j; const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k)).sub(c);
        v.multiplyScalar(rr); p.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      }
    }
    g.computeVertexNormals();
  }
  return boxUV(g, 0.04);
}
// Torus arc in the XY plane
export function torus(R, r, arcLen = Math.PI * 2, seg = 24, rad = 8) { return boxUV(new THREE.TorusGeometry(R, r, rad, seg, arcLen), 0.04); }
export function sphere(r, ws = 20, hs = 14) { return boxUV(new THREE.SphereGeometry(r, ws, hs), 0.04); }

// Place helper: add mesh to parent with position/rotation(/scale)
export function put(parent, obj, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  obj.position.set(...p); obj.rotation.set(...r); if (s) (Array.isArray(s) ? obj.scale.set(...s) : obj.scale.setScalar(s));
  parent.add(obj); return obj;
}
export function group(parent, p = [0, 0, 0], r = [0, 0, 0]) { const g = new THREE.Group(); return put(parent, g, p, r); }

// ------------------------------------------------------------------ HUD rendering
export const HUD = { scale: 3, below: 40, margin: 64 };
// model: { root: Object3D (in camera space), pose(key, frame) }
// frames: [{ name, key, ... }]; per frame: fr.emitOnly (render only listed objects) etc. handled by pose().
// Returns [{ name, grab, w, h }] and caches the camera for projection helpers.
export async function hud(F, { model, frames, fov = F.HUD_VFOV, ss = 3, lights, env = 'studio', dir = 'graphics/hud', margin = HUD.margin, below = HUD.below, exposure = 1 }) {
  const scene = new THREE.Scene();
  if (env) { scene.environment = studioEnv(F.renderer, env); }
  (lights || hudLights)(scene);
  const cam = hudCamera(fov, margin, below);
  scene.add(cam); cam.add(model.root);
  const out = [];
  F.renderer.toneMapping = THREE.NoToneMapping;
  F.renderer.toneMappingExposure = exposure;
  const { W, H, M } = cam.userData;
  for (const fr of frames) {
    await (fr.pose || model.pose)(fr.key ?? fr.name, fr);
    model.root.updateMatrixWorld(true);
    if (fr.paint) { // a 2D-painted frame (muzzle flashes): fr.paint(cam) → { img, left, top } in 960-space
      const r = await fr.paint(cam, model);
      if (!r) continue;
      await F.emit(`${dir}/${fr.name}.png`, r.img, [-r.left, 32 * HUD.scale - r.top]);
      out.push({ name: fr.name, grab: [-r.left, 96 - r.top], w: r.img.w, h: r.img.h });
      continue;
    }
    const t = F.trim(F.shoot(scene, cam, W, H, { ss }));
    if (t.empty) { console.warn('empty HUD frame', fr.name); continue; }
    const grab = [-(t.x0 - M), 32 * HUD.scale - t.y0];
    await F.emit(`${dir}/${fr.name}.png`, t.img, grab);
    out.push({ name: fr.name, grab, w: t.img.w, h: t.img.h });
  }
  cam.remove(model.root);
  return out;
}
export function hudCamera(fov, margin = HUD.margin, below = HUD.below) {
  const s = HUD.scale, FW = 320 * s, FH = 200 * s, M = margin * s, W = FW + 2 * M, H = (200 + below) * s;
  const cam = new THREE.PerspectiveCamera(fov, 4 / 3, 0.01, 60);
  cam.setViewOffset(FW, FH, -M, 0, W, H);
  cam.aspect = 4 / 3; // see header: keep the 4:3 projection over the 320x200 frame
  cam.updateProjectionMatrix();
  cam.userData = { W, H, M, FW, FH };
  return cam;
}
// Project a camera-space point to 960x600 frame pixels (x may be <0 or >960 in the margins).
export function toScreen(cam, p) {
  const v = (p.isVector3 ? p.clone() : new THREE.Vector3(...p));
  cam.updateMatrixWorld(true);
  v.applyMatrix4(cam.matrixWorld); // camera space → world (cam at origin, identity usually)
  v.project(cam);
  const { W, H, M } = cam.userData;
  return [(v.x * 0.5 + 0.5) * W - M, (1 - (v.y * 0.5 + 0.5)) * H, v.z];
}
// World position of an object (the HUD camera sits at the origin with identity rotation).
export function worldPos(obj) { obj.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld); }

// ------------------------------------------------------------------ 2D painting (flashes, FX)
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function imgOf(ctx, w, h) { return { w, h, data: new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data) }; }
// Trim a painted RGBA image (alpha > thr), returning { img, x0, y0 }.
export function trimImg(img, thr = 0, pad = 1) {
  const { w, h, data } = img; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) d.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + W) * 4), y * W * 4);
  return { img: { w: W, h: H, data: d }, x0, y0 };
}
// Canvas pixels come back un-premultiplied: premultiply (colour fades to black
// where the paint is thin, so additive styles add nothing there) and derive a
// soft alpha from brightness so translucent styles work too.
export function soften(img, k = 1.5) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255; d[i] *= a; d[i + 1] *= a; d[i + 2] *= a;
    d[i + 3] = Math.min(255, Math.max(d[i], d[i + 1], d[i + 2]) * k);
  }
  return img;
}
// Additive-friendly: fade colour with alpha (so black edges add nothing) and keep a soft alpha.
export function premulDark(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; d[i] *= a; d[i + 1] *= a; d[i + 2] *= a; }
  return img;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A muzzle flash painted in screen space. at = [x, y] frame px; dir = screen
// direction of the bore (unit, toward the muzzle's forward); len = px length of
// the plume; endOn = 0..1 (1 = seen straight down the bore → a star burst).
// Returns { img, left, top } for hud()'s paint frames.
export function paintFlash({ at, dir = [0, -1], len = 120, width = 60, endOn = 0, seed = 1, color = [255, 214, 140], core = [255, 250, 225], prongs = 5, squash = 1 / 1.2 }) {
  const R = rng(seed);
  const S = Math.ceil(Math.max(len, width) * 2.4 + 40);
  const [c, g] = canvas(S, S);
  const cx = S / 2, cy = S / 2;
  g.globalCompositeOperation = 'lighter';
  const ang = Math.atan2(dir[1], dir[0]);
  g.translate(cx, cy);
  g.scale(1, squash); // pre-squash vertically like the renders (GZDoom stretches ×1.2)
  g.rotate(ang);
  const col = (a, k = 1) => `rgba(${color[0] * k | 0},${color[1] * k | 0},${color[2] * k | 0},${a})`;
  const cor = (a) => `rgba(${core[0]},${core[1]},${core[2]},${a})`;
  // soft bloom
  let rg = g.createRadialGradient(0, 0, 0, 0, 0, width * (0.9 + endOn * 0.6));
  rg.addColorStop(0, col(0.55)); rg.addColorStop(0.5, col(0.18)); rg.addColorStop(1, col(0));
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, width * (0.9 + endOn * 0.6), 0, Math.PI * 2); g.fill();
  // side prongs (a star, strongest when seen end-on)
  const pr = prongs + (endOn > 0.5 ? 2 : 0);
  for (let i = 0; i < pr; i++) {
    const a = (i / pr) * Math.PI * 2 + R() * 0.5;
    const L = width * (0.7 + R() * 0.8) * (0.5 + endOn * 0.9);
    const Wd = width * (0.1 + R() * 0.07);
    g.save(); g.rotate(a);
    const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, cor(0.95)); lg.addColorStop(0.35, col(0.8)); lg.addColorStop(1, col(0));
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, -Wd); g.quadraticCurveTo(L * 0.5, -Wd * 0.6, L, 0); g.quadraticCurveTo(L * 0.5, Wd * 0.6, 0, Wd); g.closePath(); g.fill();
    g.restore();
  }
  // forward plume (along the bore)
  const fl = len * (1 - endOn * 0.75);
  if (fl > 4) {
    for (let k = 0; k < 3; k++) {
      const L = fl * (0.6 + R() * 0.5), Wd = width * (0.34 - k * 0.08);
      const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, cor(0.95)); lg.addColorStop(0.3, col(0.85)); lg.addColorStop(0.75, col(0.35, 0.9)); lg.addColorStop(1, col(0));
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -Wd * 0.5);
      g.bezierCurveTo(L * 0.3, -Wd * (1.1 + R() * 0.3), L * 0.7, -Wd * (0.6 + R() * 0.3), L, (R() - 0.5) * Wd * 0.3);
      g.bezierCurveTo(L * 0.7, Wd * (0.6 + R() * 0.3), L * 0.3, Wd * (1.1 + R() * 0.3), 0, Wd * 0.5); g.closePath(); g.fill();
    }
  }
  // hot core
  rg = g.createRadialGradient(0, 0, 0, 0, 0, width * 0.42);
  rg.addColorStop(0, cor(1)); rg.addColorStop(0.5, cor(0.8)); rg.addColorStop(1, cor(0));
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, width * 0.42, 0, Math.PI * 2); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = imgOf(g, S, S);
  soften(img);
  const t = trimImg(img, 6);
  return { img: t.img, left: Math.round(at[0] - cx + t.x0), top: Math.round(at[1] - cy + t.y0) };
}

// ------------------------------------------------------------------ pickups (world sprites)
// Renders a model lying on the floor with the forge spriteSet (rot 0) in a lit
// scene with the studio environment. model.root: feet at origin.
export async function pickup(F, { prefix, frames = 'A', model, bounds = { w: 1.0, top: 0.5, bottom: -0.05 }, elev = 25, env = 'studio', dir = 'sprites/items', lights, pxPerM = 64, ss = 4, sink = 1 }) {
  const scene = new THREE.Scene();
  if (env) scene.environment = studioEnv(F.renderer, env);
  if (lights) lights(scene); else F.lightRig(scene, { hemi: 1.5, key: 2.8, fill: 0.9, rim: 1.3 });
  scene.add(model.root);
  const fr = typeof frames === 'string' ? [...frames].map((f) => ({ f, rot: 0 })) : frames.map((f) => (typeof f === 'string' ? { f, rot: 0 } : { rot: 0, ...f }));
  const r = await F.spriteSet({ prefix, dir, model, frames: fr, rotations: 0, bounds, elev, pxPerM, ss, scene, sink });
  scene.remove(model.root);
  return r;
}
