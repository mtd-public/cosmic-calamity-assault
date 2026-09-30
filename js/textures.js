// Procedural textures: diffuse + normal map (+ emissive where it glows), all
// painted in code at load (no image files, the house rule). The early-Xbox
// look comes from tiling detail textures with a normal map and a specular
// highlight on top of smooth low-poly shapes, not from polygon count.
//
// getTex(name) builds lazily and caches: { map, normalMap, emissiveMap?, spec, shine, color? }
import * as THREE from 'three';

// ------------------------------------------------------------ noise (tileable)
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, p, s) { // value noise with period p
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, p, oct = 4, s = 1) {
  let t = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, p * f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
  return t / n;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }

// ------------------------------------------------------------ painter core
// paint(x, y) → [r, g, b, height, emissive?] per pixel, x/y in 0..1 (tileable)
function build(size, paint, { emissive = false, alpha = false, bump = 2.2 } = {}) {
  const N = size * size;
  const col = new Uint8ClampedArray(N * 4), hgt = new Float32Array(N);
  const em = emissive ? new Uint8ClampedArray(N * 4) : null;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const r = paint(i / size, j / size, i, j);
      col[k * 4] = r[0]; col[k * 4 + 1] = r[1]; col[k * 4 + 2] = r[2]; col[k * 4 + 3] = alpha ? (r[5] ?? 255) : 255;
      hgt[k] = r[3];
      if (em) { const e = r[4] || 0; em[k * 4] = e * (r[6] ?? 255); em[k * 4 + 1] = e * (r[7] ?? 255); em[k * 4 + 2] = e * (r[8] ?? 255); em[k * 4 + 3] = 255; }
    }
  }
  // normal from height (Sobel, wrapping)
  const nrm = new Uint8ClampedArray(N * 4);
  const H = (i, j) => hgt[((j + size) % size) * size + ((i + size) % size)];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (H(i + 1, j - 1) + 2 * H(i + 1, j) + H(i + 1, j + 1) - H(i - 1, j - 1) - 2 * H(i - 1, j) - H(i - 1, j + 1)) * bump;
      const dy = (H(i - 1, j + 1) + 2 * H(i, j + 1) + H(i + 1, j + 1) - H(i - 1, j - 1) - 2 * H(i, j - 1) - H(i + 1, j - 1)) * bump;
      const L = Math.hypot(dx, dy, 1), k = (j * size + i) * 4;
      nrm[k] = (-dx / L * 0.5 + 0.5) * 255; nrm[k + 1] = (dy / L * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / L * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
    }
  }
  const tex = (arr, srgb) => {
    const t = new THREE.DataTexture(arr, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(col, true), normalMap: tex(nrm, false), emissiveMap: em ? tex(em, true) : null };
}

// ------------------------------------------------------------ helpers
function panels(u, v, cols, rows, seed) { // irregular panel grid: returns {edge: dist to nearest seam 0..1, id}
  const cu = u * cols, cv = v * rows;
  const ix = Math.floor(cu), iy = Math.floor(cv);
  // split some panels in half for variety
  const split = hash(ix, iy, seed) < 0.4;
  let fu = cu - ix, fv = cv - iy;
  let id = ix * 31 + iy;
  if (split) { if (fu > 0.5) { fu = (fu - 0.5) * 2; id += 1000; } else fu *= 2; }
  const edge = Math.min(fu, 1 - fu, fv, 1 - fv) * (split ? 1 : 1);
  return { edge, id, fu, fv };
}
function rivets(fu, fv, n = 0.06) {
  const cs = [[n, n], [1 - n, n], [n, 1 - n], [1 - n, 1 - n]];
  let h = 0;
  for (const [a, b] of cs) { const d = Math.hypot(fu - a, fv - b); if (d < 0.025) h = Math.max(h, 1 - d / 0.025); }
  return h;
}
function hexCell(u, v, scale) { // pointy hex tiling: distance to cell edge 0..~0.5
  const x = u * scale, y = v * scale * 1.1547;
  const r = y, q = x - y * 0.5;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  const cx = rq + rr * 0.5, cy = rr;
  const px = x - cx, py = (y - cy) * 0.866;
  const d = Math.max(Math.abs(px) * 0.866 + Math.abs(py) * 0.5, Math.abs(py)) ;
  return { d: 0.5 - d, id: rq * 57 + rr * 13 };
}

// ------------------------------------------------------------ the library
const LIB = {
  metal: () => build(512, (u, v) => {
    const p = panels(u, v, 4, 4, 3), g = fbm(u * 8, v * 8, 8, 4, 2), s = fbm(u * 64, v * 4, 64, 2, 5);
    const seam = p.edge < 0.012 ? 1 : 0, bevel = clamp01(p.edge / 0.03);
    const tint = hash(p.id, 1, 9) * 0.12;
    const base = 0.42 + tint + g * 0.12 - seam * 0.2 + s * 0.05;
    const rv = rivets(p.fu, p.fv);
    const c = [base * 150 + rv * 30, base * 158 + rv * 30, base * 148 + rv * 25];
    return [...c, bevel * 0.6 + rv * 0.5 + g * 0.08];
  }),
  hull: () => build(512, (u, v) => {
    // Covenant-style plating: big curved plates, soft iridescence, glow only in some seams
    const warp = fbm(u * 2, v * 2, 2, 3, 7) * 0.25;
    const rows = 5, rv = (v + warp) * rows, row = Math.floor(rv), fv = rv - row;
    const cols = 3, cu = u * cols + hash(row, 0, 5) * 0.7, col = Math.floor(cu), fu = cu - col;
    const edge = Math.min(fv, 1 - fv, fu * 1.4, (1 - fu) * 1.4);
    const g = fbm(u * 10, v * 10, 10, 4, 3);
    const dome = Math.sin(fv * Math.PI) * Math.sin(fu * Math.PI);
    const irid = 0.5 + 0.5 * Math.sin((u * 2 + v * 3 + warp) * 6.28);
    const k = 0.62 + g * 0.3 + dome * 0.18;
    const seam = edge < 0.025 ? 1 : 0;
    const glow = seam && hash(row, col, 11) < 0.35 ? 1 : 0;
    return [mix(70, 96, irid) * k, mix(52, 64, 1 - irid) * k, mix(104, 132, irid) * k, clamp01(edge / 0.06) * 0.6 + dome * 0.4 + g * 0.08, glow, 90, 255, 150];
  }, { emissive: true }),
  hullIn: () => build(512, (u, v) => {
    const cols = 6, cu = u * cols, fu = cu - Math.floor(cu);
    const rib = Math.pow(Math.sin(fu * Math.PI), 0.5);
    const g = fbm(u * 12, v * 12, 12, 4, 4);
    const band = Math.abs(v - 0.62) < 0.012 ? 1 : 0;
    const vgroove = Math.abs(((v * 8) % 1) - 0.5) > 0.47 ? 1 : 0;
    const k = 0.6 + g * 0.5;
    return [(46 + rib * 22) * k, (34 + rib * 16) * k, (62 + rib * 30) * k, rib * 0.7 - vgroove * 0.3 + g * 0.08 + band * 0.3, band, 100, 255, 160];
  }, { emissive: true }),
  alienFloor: () => build(512, (u, v) => {
    const h = hexCell(u, v, 8), g = fbm(u * 16, v * 16, 16, 3, 6);
    const edge = clamp01(h.d / 0.05);
    const glow = h.d < 0.014 && hash(h.id, 3, 1) < 0.06 ? 0.7 : 0;
    const k = 0.55 + g * 0.45 + hash(h.id, 2, 2) * 0.12;
    return [48 * k, 44 * k, 58 * k, edge * 0.7 + g * 0.08, glow, 90, 255, 160];
  }, { emissive: true }),
  concrete: () => build(512, (u, v) => {
    const g = fbm(u * 6, v * 6, 6, 5, 11), s = fbm(u * 30, v * 30, 30, 2, 12);
    const form = Math.abs(((v * 4) % 1) - 0.5) > 0.494 ? 1 : 0, tie = Math.hypot(((u * 8) % 1) - 0.5, ((v * 4) % 1) - 0.25) < 0.03 ? 1 : 0;
    const crack = Math.abs(fbm(u * 5, v * 5, 5, 3, 13) - 0.5) < 0.006 ? 1 : 0;
    const c = 120 + g * 70 + s * 20 - form * 25 - crack * 40 - tie * 30;
    return [c, c * 0.98, c * 0.94, g * 0.2 + s * 0.15 - form * 0.4 - crack * 0.5 - tie * 0.4];
  }),
  asphalt: () => build(256, (u, v) => {
    const g = fbm(u * 8, v * 8, 8, 4, 21), s = hash(Math.floor(u * 256), Math.floor(v * 256), 3);
    const c = 48 + g * 30 + s * 22;
    return [c, c, c * 1.02, s * 0.4 + g * 0.2];
  }),
  rock: () => build(512, (u, v) => {
    const warp = fbm(u * 4, v * 4, 4, 3, 31);
    const strata = Math.sin((v + warp * 0.3) * Math.PI * 14) * 0.5 + 0.5;
    const g = fbm(u * 10, v * 10, 10, 5, 32), cr = fbm(u * 24, v * 24, 24, 3, 33);
    const k = 0.55 + g * 0.5;
    const h = strata * 0.35 + g * 0.6 + cr * 0.25;
    return [(118 + strata * 30) * k, (108 + strata * 24) * k, (96 + strata * 16) * k, h];
  }, { bump: 3 }),
  cliff: () => build(512, (u, v) => { // pale limestone for the gorge
    const warp = fbm(u * 3, v * 3, 3, 3, 41);
    const strata = Math.sin((v + warp * 0.25) * Math.PI * 18) * 0.5 + 0.5;
    const g = fbm(u * 8, v * 8, 8, 5, 42), stain = fbm(u * 2, v * 6, 2, 3, 43);
    const k = 0.62 + g * 0.45;
    return [(205 - stain * 60 + strata * 14) * k, (192 - stain * 55 + strata * 10) * k, (170 - stain * 40) * k, strata * 0.4 + g * 0.7];
  }, { bump: 3 }),
  meadow: () => build(512, (u, v) => {
    const g = fbm(u * 8, v * 8, 8, 5, 51), b = fbm(u * 64, v * 64, 64, 2, 52), d = fbm(u * 3, v * 3, 3, 3, 53);
    const dirt = clamp01((d - 0.6) * 5);
    const r = mix(70 + g * 40, 120, dirt), gg = mix(110 + g * 50, 100, dirt), bb = mix(40 + g * 20, 70, dirt);
    return [r * (0.8 + b * 0.4), gg * (0.8 + b * 0.4), bb * (0.8 + b * 0.4), b * 0.6 + g * 0.2];
  }),
  scorched: () => build(512, (u, v) => {
    const g = fbm(u * 6, v * 6, 6, 5, 61), b = fbm(u * 40, v * 40, 40, 2, 62), char = fbm(u * 3, v * 3, 3, 3, 63);
    const burnt = clamp01((char - 0.45) * 3);
    const grass = clamp01((0.4 - char) * 4) * clamp01(g * 2 - 0.6);
    const r = mix(mix(96, 34, burnt), 80, grass), gg = mix(mix(82, 30, burnt), 92, grass), bb = mix(mix(64, 30, burnt), 44, grass);
    const k = 0.75 + g * 0.35 + b * 0.2;
    return [r * k, gg * k, bb * k, b * 0.5 + g * 0.3];
  }),
  grid: () => build(256, (u, v) => {
    const g = fbm(u * 4, v * 4, 4, 3, 71);
    const line = Math.min(Math.abs(((u * 4) % 1) - 0.5), Math.abs(((v * 4) % 1) - 0.5)) > 0.485 ? 1 : 0;
    const major = (u < 0.006 || u > 0.994 || v < 0.006 || v > 0.994) ? 1 : 0;
    const c = 160 + g * 30 - line * 40;
    return [c - major * 60, c - major * 20, c - major * 70 + major * 40, -line * 0.4 - major * 0.5 + g * 0.1];
  }),
  plaza: () => build(512, (u, v) => {
    const rows = 8, rv = v * rows, row = Math.floor(rv), off = (row % 2) * 0.5;
    const cu = (u * 6 + off), cix = Math.floor(cu);
    const fu = cu - cix, fv = rv - row;
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const g = fbm(u * 12, v * 12, 12, 3, 81), t = hash(cix, row, 8);
    const c = 120 + t * 40 + g * 30 - (edge < 0.03 ? 50 : 0);
    return [c * 1.02, c * 0.95, c * 0.86, clamp01(edge / 0.06) * 0.8 + g * 0.1];
  }),
  brick: () => build(512, (u, v) => {
    const rows = 16, rv = v * rows, row = Math.floor(rv), off = (row % 2) * 0.5;
    const cu = u * 8 + off, cix = Math.floor(cu), fu = cu - cix, fv = rv - row;
    const mortar = fu < 0.04 || fv < 0.08;
    const g = fbm(u * 16, v * 16, 16, 3, 91), t = hash(cix, row, 4);
    if (mortar) return [110 + g * 20, 104 + g * 20, 96 + g * 20, 0];
    const k = 0.75 + t * 0.3 + g * 0.2;
    return [128 * k, 64 * k, 48 * k, 0.6 + g * 0.2];
  }),
  corrugated: () => build(256, (u, v) => {
    const rib = Math.sin(u * Math.PI * 24) * 0.5 + 0.5;
    const g = fbm(u * 6, v * 6, 6, 4, 101), rust = clamp01((fbm(u * 4, v * 4, 4, 4, 102) - 0.62) * 5);
    const k = 0.72 + g * 0.28 + rib * 0.1;
    return [mix(235, 150, rust) * k, mix(235, 90, rust) * k, mix(235, 60, rust) * k, rib];
  }, { bump: 3.5 }),
  crate: () => build(256, (u, v) => {
    const frame = u < 0.07 || u > 0.93 || v < 0.07 || v > 0.93;
    const diag = Math.abs(u - v) < 0.04;
    const g = fbm(u * 8, v * 8, 8, 4, 111);
    const stripe = v > 0.45 && v < 0.55 && !frame;
    const k = 0.7 + g * 0.3;
    if (stripe) return [200 * k, 140 * k, 30 * k, 0.5];
    return [(frame || diag ? 88 : 72) * k, (frame || diag ? 92 : 78) * k, (frame || diag ? 60 : 50) * k, frame || diag ? 1 : 0.4 + g * 0.1];
  }),
  grate: () => build(256, (u, v) => {
    const cu = (u * 16) % 1, cv = (v * 16) % 1;
    const hole = cu > 0.18 && cu < 0.82 && cv > 0.18 && cv < 0.82;
    const g = fbm(u * 8, v * 8, 8, 3, 121);
    const c = 70 + g * 30;
    return [c, c * 1.02, c * 0.98, hole ? 0 : 1, 0, hole ? 0 : 255];
  }, { alpha: true }),
  stone: () => build(512, (u, v) => {
    const rows = 6, rv = v * rows, row = Math.floor(rv), off = hash(row, 1, 3) * 0.7;
    const cu = u * 3 + off, cix = Math.floor(cu), fu = cu - cix, fv = rv - row;
    const edge = Math.min(fu * 3, (1 - fu) * 3, fv, 1 - fv);
    const g = fbm(u * 12, v * 12, 12, 4, 131), t = hash(cix, row, 5);
    const k = 0.72 + t * 0.2 + g * 0.3 - (edge < 0.05 ? 0.25 : 0);
    return [196 * k, 180 * k, 150 * k, clamp01(edge / 0.12) * 0.9 + g * 0.2];
  }),
  wreck: () => build(256, (u, v) => {
    const g = fbm(u * 6, v * 6, 6, 5, 141), r = clamp01((fbm(u * 3, v * 3, 3, 3, 142) - 0.4) * 3);
    const k = 0.6 + g * 0.5;
    return [mix(40, 120, r) * k, mix(38, 62, r) * k, mix(40, 38, r) * k, g * 0.6];
  }),
  ecs: () => build(256, (u, v) => { // Earth Cyborg Squad hardware: olive drab + hazard band
    const p = panels(u, v, 2, 2, 151), g = fbm(u * 8, v * 8, 8, 4, 152);
    const band = v > 0.8 && v < 0.92, stripe = band && ((u * 8 + v * 8) % 1) < 0.5;
    const k = 0.75 + g * 0.3;
    if (band) return stripe ? [210 * k, 150 * k, 30 * k, 0.3] : [30 * k, 30 * k, 30 * k, 0.3];
    return [84 * k, 90 * k, 82 * k, clamp01(p.edge / 0.03) * 0.6 + rivets(p.fu, p.fv) * 0.4];
  }),
  pod: () => build(256, (u, v) => {
    const h = hexCell(u, v, 3), g = fbm(u * 8, v * 8, 8, 4, 161);
    const band = Math.abs(v - 0.5) < 0.03;
    const k = 0.6 + g * 0.4;
    return [(40 + h.d * 60) * k, (58 + h.d * 50) * k, (70 + h.d * 70) * k, clamp01(h.d / 0.08) * 0.7, band ? 1 : 0, 120, 255, 200];
  }, { emissive: true }),
  door: () => build(256, (u, v) => {
    const chev = Math.abs(((u * 2 + Math.abs(v - 0.5) * 2) % 1) - 0.5) < 0.05;
    const frame = u < 0.06 || u > 0.94 || v < 0.05 || v > 0.95;
    const g = fbm(u * 6, v * 6, 6, 3, 171);
    const k = 0.6 + g * 0.4;
    return [70 * k, 50 * k, 100 * k, frame ? 1 : chev ? 0.6 : 0.3, chev || frame ? 1 : 0, 170, 90, 255];
  }, { emissive: true }),
  roof: () => build(256, (u, v) => { const rib = Math.sin(u * Math.PI * 16) * 0.5 + 0.5, g = fbm(u * 6, v * 6, 6, 3, 181); const c = 50 + g * 25; return [c, c, c * 1.05, rib]; }),
  fence: () => build(256, (u, v) => {
    const a = Math.abs(((u + v) * 12) % 1 - 0.5) < 0.06 || Math.abs(((u - v + 2) * 12) % 1 - 0.5) < 0.06;
    return [150, 155, 160, a ? 1 : 0, 0, a ? 255 : 0];
  }, { alpha: true }),
  scales: () => build(256, (u, v) => { // Vyrr skin
    const rv = v * 16, row = Math.floor(rv), cu = u * 16 + (row % 2) * 0.5, fu = cu - Math.floor(cu), fv = rv - row;
    const d = Math.hypot(fu - 0.5, fv * 0.9);
    const g = fbm(u * 8, v * 8, 8, 3, 191);
    const k = 0.65 + g * 0.35 + (1 - d) * 0.15;
    return [96 * k, 118 * k, 70 * k, clamp01(1 - d * 1.4)];
  }),
  vyrrArmor: () => build(256, (u, v) => {
    const warp = fbm(u * 3, v * 3, 3, 3, 201);
    const groove = Math.abs(Math.sin((u + warp * 0.5) * Math.PI * 6));
    const g = fbm(u * 10, v * 10, 10, 3, 202);
    const k = 0.7 + g * 0.3;
    return [110 * k, 70 * k, 160 * k, Math.pow(groove, 0.4) * 0.8, groove < 0.05 ? 1 : 0, 140, 255, 190];
  }, { emissive: true }),
  ecsArmor: () => build(256, (u, v) => { // the player's gauntlets: MJOLNIR-ish olive plates
    const p = panels(u, v, 3, 2, 211), g = fbm(u * 10, v * 10, 10, 3, 212);
    const k = 0.72 + g * 0.3;
    return [78 * k, 92 * k, 62 * k, clamp01(p.edge / 0.05) * 0.8 + g * 0.1];
  }),
  suit: () => build(256, (u, v) => { // the player's tactical suit: charcoal ripstop with seams and a subtle weave
    const p = panels(u, v, 3, 3, 301), g = fbm(u * 10, v * 10, 10, 3, 302);
    const weave = (hash(Math.floor(u * 128), Math.floor(v * 128), 5) - 0.5) * 0.12;
    const seam = p.edge < 0.02 ? 1 : 0;
    const k = 0.8 + g * 0.25 + weave;
    return [34 * k, 36 * k, 40 * k, (seam ? 0.55 : 0.2) + g * 0.15 + weave * 2];
  }),
  suitPlate: () => build(256, (u, v) => { // dark composite plates, matte grey with panel lines and wear on the edges
    const p = panels(u, v, 2, 3, 311), g = fbm(u * 8, v * 8, 8, 4, 312), s = fbm(u * 60, v * 4, 60, 2, 313);
    const wear = clamp01((0.06 - p.edge) / 0.06) * 0.25;
    const k = 0.72 + g * 0.3 + s * 0.06;
    const c = 58 * k + wear * 40;
    return [c, c * 1.03, c * 1.08, clamp01(p.edge / 0.03) * 0.7 + rivets(p.fu, p.fv, 0.08) * 0.5 + g * 0.06];
  }),
  flightsuit: () => build(256, (u, v) => { // Vyrr pilot suit: quilted violet-grey fabric with pressure seams
    const q = Math.min(Math.abs(((u * 6) % 1) - 0.5), Math.abs(((v * 6) % 1) - 0.5)), quilt = clamp01(q / 0.08);
    const seam = Math.abs(((v * 3) % 1) - 0.5) > 0.47 ? 1 : 0;
    const g = fbm(u * 12, v * 12, 12, 3, 321), weave = (hash(Math.floor(u * 128), Math.floor(v * 128), 6) - 0.5) * 0.1;
    const k = 0.78 + g * 0.25 + weave;
    return [64 * k, 52 * k, 88 * k, quilt * 0.5 - seam * 0.3 + g * 0.1 + weave];
  }),
  harness: () => build(128, (u, v) => { // black webbing with stitched edges
    const edge = v < 0.12 || v > 0.88 ? 1 : 0, stitch = edge && ((u * 24) % 1) < 0.5 ? 1 : 0;
    const g = fbm(u * 8, v * 8, 8, 3, 331);
    const c = 22 + g * 12 + stitch * 30;
    return [c, c, c * 1.1, ((u * 40) % 1) < 0.5 ? 0.55 : 0.45 + edge * 0.3];
  }),
  windows: () => build(512, (u, v) => { // a facade: dark concrete piers, a grid of windows, some of them lit
    const cols = 6, rows = 14, cu = u * cols, cv = v * rows, ix = Math.floor(cu), iy = Math.floor(cv), fu = cu - ix, fv = cv - iy;
    const inWin = fu > 0.18 && fu < 0.82 && fv > 0.25 && fv < 0.8;
    const g = fbm(u * 8, v * 8, 8, 4, 341);
    const lit = hash(ix, iy, 12) < 0.42, warm = hash(ix, iy, 13) < 0.7;
    if (inWin) {
      const glass = lit ? (warm ? [255, 214, 150] : [190, 220, 255]) : [26, 32, 42];
      const bright = lit ? 0.55 + hash(ix, iy, 14) * 0.45 : 0;
      return [glass[0] * (lit ? 0.9 : 1), glass[1] * (lit ? 0.9 : 1), glass[2], -0.4, bright, glass[0], glass[1], glass[2]];
    }
    const c = 62 + g * 30 - (fv < 0.1 || fv > 0.95 ? 12 : 0);
    return [c, c * 0.98, c * 0.94, g * 0.15 + (fu < 0.18 || fu > 0.82 ? 0.25 : 0)];
  }, { emissive: true }),
  gunmetal: () => build(256, (u, v) => {
    const p = panels(u, v, 3, 3, 221), g = fbm(u * 12, v * 12, 12, 3, 222), s = fbm(u * 80, v * 3, 80, 2, 223);
    const c = 52 + g * 22 + s * 10;
    return [c, c * 1.03, c * 1.06, clamp01(p.edge / 0.03) * 0.6 + g * 0.05];
  }),
  bark: () => build(128, (u, v) => { const g = fbm(u * 8, v * 2, 8, 4, 231); const r = Math.abs(Math.sin(u * Math.PI * 10 + g * 4)); return [70 + r * 30, 52 + r * 20, 38 + r * 12, r]; }),
  needles: () => build(256, (u, v) => {
    const g = fbm(u * 16, v * 16, 16, 4, 241), s = hash(Math.floor(u * 128), Math.floor(v * 128), 7);
    const k = 0.6 + g * 0.5 + s * 0.2;
    return [56 * k, 104 * k, 58 * k, g + s * 0.5];
  }),
  sand: () => build(256, (u, v) => { const g = fbm(u * 8, v * 8, 8, 4, 251), s = hash(Math.floor(u * 256), Math.floor(v * 256), 9); const k = 0.8 + g * 0.3 + s * 0.1; return [180 * k, 160 * k, 120 * k, g * 0.4 + s * 0.3]; }),
  water: () => build(256, (u, v) => { const g = fbm(u * 6, v * 6, 6, 4, 261); return [40, 90, 100, g]; }, { bump: 4 }),
  glass: () => build(128, (u, v) => { const f = u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95; return f ? [60, 64, 70, 1, 0, 255] : [120, 160, 180, 0, 0, 90]; }, { alpha: true }),
  screen: () => build(128, (u, v) => { // alien console glyphs
    const g = hash(Math.floor(u * 12), Math.floor(v * 20), 3) > 0.55 && ((v * 20) % 1) > 0.3;
    const scan = ((v * 64) % 1) > 0.5 ? 1 : 0.8;
    return [10, 20, 16, 0, (g ? 1 : 0.15) * scan, 90, 255, 150];
  }, { emissive: true }),
};

const cache = new Map();
export function getTex(name) {
  if (!cache.has(name)) cache.set(name, (LIB[name] || LIB.metal)());
  return cache.get(name);
}

// ------------------------------------------------------------ sprites (canvas)
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const spriteCache = new Map();
export function spriteTex(name) {
  if (spriteCache.has(name)) return spriteCache.get(name);
  let t;
  const radial = (stops) => (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, s, s); };
  if (name === 'glow') t = canvasTex(128, radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]));
  else if (name === 'soft') t = canvasTex(64, radial([[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]));
  else if (name === 'smoke') t = canvasTex(128, (g, s) => {
    for (let i = 0; i < 18; i++) {
      const x = s / 2 + (Math.random() - 0.5) * s * 0.4, y = s / 2 + (Math.random() - 0.5) * s * 0.4, r = s * (0.15 + Math.random() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
  else if (name === 'flash') t = canvasTex(128, (g, s) => {
    radial([[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,220,140,0.7)'], [1, 'rgba(255,160,60,0)']])(g, s);
    g.translate(s / 2, s / 2);
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillStyle = 'rgba(255,240,200,0.8)'; g.beginPath(); g.moveTo(0, -3); g.lineTo(s * 0.48, 0); g.lineTo(0, 3); g.fill(); }
  });
  else if (name === 'spark') t = canvasTex(32, radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,230,160,0.8)'], [1, 'rgba(255,200,100,0)']]));
  else if (name === 'hole') t = canvasTex(64, (g, s) => { radial([[0, 'rgba(0,0,0,0.95)'], [0.25, 'rgba(20,18,16,0.8)'], [0.5, 'rgba(40,36,30,0.35)'], [1, 'rgba(0,0,0,0)']])(g, s); });
  else if (name === 'scorch') t = canvasTex(128, (g, s) => { radial([[0, 'rgba(0,0,0,0.9)'], [0.5, 'rgba(10,8,6,0.6)'], [1, 'rgba(0,0,0,0)']])(g, s); });
  else if (name === 'splat') t = canvasTex(128, (g, s) => {
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = Math.random() * s * 0.35, r = s * (0.04 + Math.random() * 0.1); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, 0, 6.28); g.fill(); }
  });
  else if (name === 'rain') t = canvasTex(64, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(200,220,255,0.6)'); g.fillStyle = gr; g.fillRect(s / 2 - 1, 0, 2, s); });
  else if (name === 'cloud') t = canvasTex(256, (g, s) => {
    for (let i = 0; i < 40; i++) {
      const x = s * (0.15 + Math.random() * 0.7), y = s * (0.35 + Math.random() * 0.3), r = s * (0.08 + Math.random() * 0.14);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
  else if (name === 'grass') t = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x0 = s * (0.1 + Math.random() * 0.8), h = s * (0.45 + Math.random() * 0.5), lean = (Math.random() - 0.5) * s * 0.35, wdt = 3 + Math.random() * 3;
      const gr = g.createLinearGradient(0, s, 0, s - h); gr.addColorStop(0, 'rgba(60,90,30,1)'); gr.addColorStop(1, 'rgba(150,190,80,1)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - wdt, s); g.quadraticCurveTo(x0 + lean * 0.4, s - h * 0.6, x0 + lean, s - h); g.quadraticCurveTo(x0 + lean * 0.5, s - h * 0.6, x0 + wdt, s); g.fill();
    }
  });
  else if (name === 'pineBranch') t = canvasTex(256, (g, s) => {
    // a drooping branch seen side-on: a dark spine with needle tufts either side, transparent elsewhere
    g.clearRect(0, 0, s, s);
    const spineY = (x) => s * 0.35 + (x / s) * (x / s) * s * 0.25;
    for (let i = 0; i < 160; i++) {
      const x = s * 0.02 + Math.random() * s * 0.96, y = spineY(x), side = Math.random() < 0.5 ? -1 : 1;
      const len = s * (0.06 + Math.random() * 0.12) * (1 - x / s * 0.35), ang = side * (0.9 + Math.random() * 0.5) + 0.3;
      const shade = 45 + Math.random() * 70;
      g.strokeStyle = `rgba(${shade * 0.55}, ${shade + 20}, ${shade * 0.5}, ${0.75 + Math.random() * 0.25})`; g.lineWidth = 1.5 + Math.random() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    }
    g.strokeStyle = 'rgba(70,50,30,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, spineY(0)); for (let x = 0; x <= s; x += 16) g.lineTo(x, spineY(x)); g.stroke();
  });
  else if (name === 'leafCard') t = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = s * (0.12 + Math.random() * 0.76), y = s * (0.12 + Math.random() * 0.76), r = s * (0.03 + Math.random() * 0.05);
      const d = Math.hypot(x - s / 2, y - s / 2) / (s * 0.45); if (d > 1) continue;
      const shade = 0.55 + Math.random() * 0.45;
      g.fillStyle = `rgba(${70 * shade}, ${120 * shade + 20}, ${40 * shade}, ${0.85 + Math.random() * 0.15})`;
      g.beginPath(); g.ellipse(x, y, r * 1.4, r * 0.8, Math.random() * 3.14, 0, 6.28); g.fill();
    }
  });
  else if (name === 'flag') t = canvasTex(128, (g, s) => {
    g.fillStyle = '#2b3a2a'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#e0a040'; g.fillRect(0, s * 0.42, s, s * 0.16);
    g.strokeStyle = '#dfe9f3'; g.lineWidth = 6; g.beginPath(); g.arc(s / 2, s / 2, s * 0.26, 0, 6.28); g.stroke();
    g.fillStyle = '#dfe9f3'; g.font = `bold ${s * 0.22}px Oxanium, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ECS', s / 2, s / 2 + 2);
  });
  else if (name === 'leaf') t = canvasTex(64, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) { const x = s * (0.2 + Math.random() * 0.6), y = s * (0.2 + Math.random() * 0.6), r = s * (0.12 + Math.random() * 0.14); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,170,70,1)'); gr.addColorStop(0.7, 'rgba(70,120,40,0.9)'); gr.addColorStop(1, 'rgba(50,90,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  });
  else if (name === 'waterfall') {
    t = canvasTex(128, (g, s) => { for (let x = 0; x < s; x += 2) { const b = 170 + Math.random() * 85; g.fillStyle = `rgba(${b},${b + 10},${b + 20},${0.5 + Math.random() * 0.5})`; g.fillRect(x, 0, 2, s); for (let y = 0; y < s; y += 8) if (Math.random() < 0.3) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x, y, 2, 6); } } });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  spriteCache.set(name, t);
  return t;
}

// A text label painted on a canvas (distance signs, pad labels, AR ammo counter).
export function labelTex(text, { w = 256, h = 64, bg = 'rgba(0,0,0,0)', fg = '#e0a040', font = 'bold 36px Oxanium, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { canvas: c, ctx: g };
  return t;
}
